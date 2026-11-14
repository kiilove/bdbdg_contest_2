import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { get as rtdbGet, ref as rtdbRef, update as rtdbUpdate } from "firebase/database";
import { sanitizeForFirestore } from "./firestoreSanitize.js";

/**
 * contest_results_list 문서 타임스탬프 추출 (밀리초 숫자)
 */
export const extractResultDocTimestamp = (item) => {
  if (!item || typeof item !== "object") return 0;
  const raw =
    item.updatedAt ?? item.savedAt ?? item.createdAt ?? item.timestamp ?? 0;
  if (!raw) return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof raw?.toMillis === "function") {
    return raw.toMillis();
  }
  if (typeof raw?.seconds === "number") {
    return raw.seconds * 1000;
  }
  return 0;
};

/**
 * 결정적(Deterministic) 결과 문서 ID 생성 — 중복 저장 원천 방지
 */
export const buildContestResultDocId = (contestId, gradeId) => {
  const safeContestId = String(contestId || "").replace(/\//g, "_").trim();
  const safeGradeId = String(gradeId || "").replace(/\//g, "_").trim();
  return `${safeContestId}__${safeGradeId}`;
};

/**
 * contest_results_list 조회 결과에서 동일 gradeId 중복 문서를 단일 최신 문서로 정규화
 * - 모든 조회처(본부석, 호스트, 전광판, 그랑프리, 상장, 클럽집계, 엑셀출력, 통합출력)가
 *   100% 동일한 단일 결과를 바라보도록 보장합니다.
 */
export const dedupeContestResultsByGrade = (
  resultDocs = [],
  expectedContestId = null
) => {
  if (!Array.isArray(resultDocs) || resultDocs.length === 0) return [];

  const byGrade = new Map();
  resultDocs.forEach((docItem) => {
    if (!docItem || !docItem.gradeId) return;
    if (
      expectedContestId &&
      docItem.contestId &&
      docItem.contestId !== expectedContestId
    ) {
      return;
    }

    const existing = byGrade.get(docItem.gradeId);
    if (!existing) {
      byGrade.set(docItem.gradeId, docItem);
      return;
    }

    const incomingTs = extractResultDocTimestamp(docItem);
    const existingTs = extractResultDocTimestamp(existing);

    if (incomingTs > existingTs) {
      byGrade.set(docItem.gradeId, docItem);
    } else if (incomingTs === existingTs) {
      // 타임스탬프가 모두 없는 구버전 중복 문서 간에도 결정적(Deterministic) 선택 보장:
      // 결정적 ID(`${contestId}__${gradeId}`) 문서를 최우선하고, 그 외에는 ID 사전순 첫 문서 유지
      const deterministicId = docItem.contestId
        ? buildContestResultDocId(docItem.contestId, docItem.gradeId)
        : "";
      if (deterministicId && docItem.id === deterministicId) {
        byGrade.set(docItem.gradeId, docItem);
      } else if (
        existing.id !== deterministicId &&
        String(docItem.id || "") < String(existing.id || "")
      ) {
        byGrade.set(docItem.gradeId, docItem);
      }
    }
  });

  return Array.from(byGrade.values());
};

/**
 * 순위표 확정 데이터를 Firestore writeBatch로 원자적(Atomic) 저장
 * - 기존 레거시 랜덤 ID 중복 문서를 일괄 삭제하고 결정적 문서 ID(`${contestId}__${gradeId}`)로 덮어씁니다.
 * - 네트워크 순단 시에도 '기존 결과만 삭제되고 신규 결과가 없는 0건 상태'나 '중복 2건 상태'가 절대 발생하지 않습니다.
 */
export const saveGradeResultsAtomically = async ({
  db,
  resultTables = [],
  fallbackContestId = "",
  includePointArray = false,
}) => {
  if (!db || !Array.isArray(resultTables) || resultTables.length === 0) {
    throw new Error("저장할 순위 결과 데이터가 없습니다.");
  }

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const batch = writeBatch(db);
  const savedDocs = [];

  for (const table of resultTables) {
    const effectiveContestId = String(
      fallbackContestId || table?.contestId || ""
    ).trim();
    const targetGradeId = String(table?.gradeId || "").trim();

    if (!effectiveContestId || !targetGradeId) {
      throw new Error("순위 저장에 필요한 대회 ID 또는 체급 ID가 누락되었습니다.");
    }

    const targetDocId = buildContestResultDocId(
      effectiveContestId,
      targetGradeId
    );

    // 기존 동일 (contestId, gradeId) 문서 조회 후 targetDocId 이외의 레거시 중복 문서 삭제 예약
    const existingSnap = await getDocs(
      query(
        collection(db, "contest_results_list"),
        where("contestId", "==", effectiveContestId),
        where("gradeId", "==", targetGradeId)
      )
    );

    existingSnap.docs.forEach((existingDoc) => {
      if (existingDoc.id !== targetDocId) {
        batch.delete(existingDoc.ref);
      }
    });

    const cleanPayload = sanitizeForFirestore({
      ...table,
      contestId: effectiveContestId,
      gradeId: targetGradeId,
      savedAt: nowMs,
      updatedAt: nowIso,
      result: (table.result || []).map((p) => ({
        ...p,
        score: (p.score || []).map(({ isMissing, ...restScore }) => ({
          ...restScore,
          playerScore: restScore.playerScore ?? 0,
          ...(includePointArray
            ? { playerPointArray: restScore.playerPointArray || [] }
            : {}),
        })),
      })),
    });

    const targetRef = doc(db, "contest_results_list", targetDocId);
    batch.set(targetRef, cleanPayload);
    savedDocs.push({ id: targetDocId, ...cleanPayload });
  }

  await batch.commit();
  return savedDocs;
};

export const formatResultDocTimestamp = (item) => {
  const ts = extractResultDocTimestamp(item);
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch (e) {
    return "";
  }
};

const syncRealtimeResultSavedAfterDelete = async ({
  db,
  database,
  contestId,
  gradeIds = [],
}) => {
  const effectiveContestId = String(contestId || "").trim();
  const uniqueGradeIds = Array.from(
    new Set(
      (gradeIds || [])
        .map((gid) => String(gid || "").trim())
        .filter(Boolean)
    )
  );
  if (!db || !database || !effectiveContestId || uniqueGradeIds.length === 0) {
    return;
  }

  try {
    const emptyGradeIds = [];
    for (const gid of uniqueGradeIds) {
      const remainSnap = await getDocs(
        query(
          collection(db, "contest_results_list"),
          where("contestId", "==", effectiveContestId),
          where("gradeId", "==", gid)
        )
      );
      if (remainSnap.empty) {
        emptyGradeIds.push(gid);
      }
    }
    if (emptyGradeIds.length === 0) return;

    const stageSnap = await rtdbGet(
      rtdbRef(database, `currentStage/${effectiveContestId}/resultSaved`)
    );
    if (!stageSnap.exists()) return;
    const currentSaved = stageSnap.val();
    if (!Array.isArray(currentSaved)) return;

    const emptySet = new Set(emptyGradeIds);
    const nextSaved = currentSaved.filter((gid) => !emptySet.has(gid));
    if (nextSaved.length !== currentSaved.length) {
      await rtdbUpdate(rtdbRef(database, `currentStage/${effectiveContestId}`), {
        resultSaved: nextSaved,
      });
    }
  } catch (err) {
    console.warn("RTDB resultSaved 동기화 건너뜀:", err);
  }
};

/**
 * contest_results_list 단일 문서를 정확한 문서 ID(docId)로만 삭제
 */
export const deleteContestResultDocumentById = async ({
  db,
  database = null,
  docId,
  contestId = "",
  gradeId = "",
}) => {
  const exactDocId = String(docId || "").trim();
  if (!db || !exactDocId) {
    throw new Error("삭제할 채점표(집계) 문서 ID가 지정되지 않았습니다.");
  }

  const targetRef = doc(db, "contest_results_list", exactDocId);
  let resolvedContestId = String(contestId || "").trim();
  let resolvedGradeId = String(gradeId || "").trim();

  if (!resolvedContestId || !resolvedGradeId) {
    try {
      const snap = await getDoc(targetRef);
      if (snap.exists()) {
        const data = snap.data() || {};
        resolvedContestId = resolvedContestId || String(data.contestId || "").trim();
        resolvedGradeId = resolvedGradeId || String(data.gradeId || "").trim();
      }
    } catch (e) {
      // 사전 메타 조회 실패 시에도 정확히 targetRef 삭제는 진행
    }
  }

  await deleteDoc(targetRef);

  if (database && resolvedContestId && resolvedGradeId) {
    await syncRealtimeResultSavedAfterDelete({
      db,
      database,
      contestId: resolvedContestId,
      gradeIds: [resolvedGradeId],
    });
  }

  return exactDocId;
};

/**
 * contest_results_list 명시된 문서 ID 배열만 원자적(chunked writeBatch) 삭제
 */
export const deleteContestResultDocumentsByIds = async ({
  db,
  database = null,
  docs = [],
  contestId = "",
}) => {
  if (!db) {
    throw new Error("데이터베이스 연결이 유효하지 않습니다.");
  }

  const normalized = [];
  const seen = new Set();
  (docs || []).forEach((entry) => {
    const id = String(typeof entry === "string" ? entry : entry?.id || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    normalized.push({
      id,
      contestId:
        typeof entry === "object" && entry
          ? String(entry.contestId || contestId || "").trim()
          : String(contestId || "").trim(),
      gradeId:
        typeof entry === "object" && entry
          ? String(entry.gradeId || "").trim()
          : "",
    });
  });

  if (normalized.length === 0) return [];

  const CHUNK_SIZE = 400;
  for (let i = 0; i < normalized.length; i += CHUNK_SIZE) {
    const chunk = normalized.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((item) => {
      batch.delete(doc(db, "contest_results_list", item.id));
    });
    await batch.commit();
  }

  const effectiveContestId =
    String(contestId || "").trim() || normalized[0]?.contestId || "";
  const affectedGradeIds = normalized.map((item) => item.gradeId).filter(Boolean);

  if (database && effectiveContestId && affectedGradeIds.length > 0) {
    await syncRealtimeResultSavedAfterDelete({
      db,
      database,
      contestId: effectiveContestId,
      gradeIds: affectedGradeIds,
    });
  }

  return normalized.map((item) => item.id);
};
