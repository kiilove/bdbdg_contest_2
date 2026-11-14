import { doc, runTransaction } from "firebase/firestore";
import { ref, remove, update } from "firebase/database";
import { getStagePlayerSortIndex } from "../functions/functions.js";
import { isActiveStagePlayer } from "./playerEntryUtils.js";
import { normalizeDenseRealtimeJudges } from "./judgeAssignUtils.js";
import {
  sanitizeForFirestore,
  sanitizeForRealtimeDb,
} from "./firestoreSanitize.js";

export const getStageBackupKey = (stageId, gradeIds = []) => {
  if (stageId) return String(stageId);
  const joined = (Array.isArray(gradeIds) ? gradeIds : [gradeIds])
    .filter(Boolean)
    .sort()
    .join("__");
  return joined || "default_stage";
};

export const extractRtdbPlayerArray = (raw) => {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (raw && typeof raw === "object") return Object.values(raw).filter(Boolean);
  return [];
};

export const isLiveStageOverrideActive = (
  realtimeData,
  hasFirestoreBackup = false
) => {
  if (hasFirestoreBackup) return true;
  if (!realtimeData) return false;
  if (realtimeData.isLiveOverridden === true) return true;
  const pushId = String(realtimeData.stagePushId || "");
  if (pushId.startsWith("liveoverride_")) return true;
  return extractRtdbPlayerArray(realtimeData.stagePlayers).some(
    (p) => p && p.isLiveOverride === true
  );
};

/**
 * 개별 선수 객체를 RTDB `currentStage/{contestId}/stagePlayers`에 안전하게 직렬화할 수 있는
 * 경량 스냅샷 엔트리로 정규화합니다. (undefined 완벽 배제 · V1 하위 호환 유지)
 */
export const normalizeStagePlayerSnapshotItem = (
  player,
  fallbackOrderIndex = 0,
  defaults = {}
) => {
  const rawNum = player?.playerNumber;
  const numericBib = Number(rawNum);
  const safePlayerNumber =
    rawNum !== "" && rawNum !== null && rawNum !== undefined && Number.isFinite(numericBib)
      ? numericBib
      : String(rawNum ?? fallbackOrderIndex + 1);

  const rawIdx = Number(player?.playerIndex);
  const safePlayerIndex = Number.isFinite(rawIdx)
    ? rawIdx
    : fallbackOrderIndex + 1;

  const gradeId = String(
    player?.contestGradeId || player?.gradeId || defaults.gradeId || ""
  );
  const gradeTitle = String(
    player?.contestGradeTitle || player?.gradeTitle || defaults.gradeTitle || ""
  );
  const categoryId = String(
    player?.contestCategoryId || player?.categoryId || defaults.categoryId || ""
  );
  const categoryTitle = String(
    player?.contestCategoryTitle ||
      player?.categoryTitle ||
      defaults.categoryTitle ||
      ""
  );

  return {
    playerUid: String(
      player?.playerUid || `live_${gradeId || "stage"}_${safePlayerNumber}`
    ),
    playerNumber: safePlayerNumber,
    playerIndex: safePlayerIndex,
    playerName: String(player?.playerName || ""),
    playerGym: String(player?.playerGym || ""),
    contestCategoryId: categoryId,
    contestCategoryTitle: categoryTitle,
    contestGradeId: gradeId,
    contestGradeTitle: gradeTitle,
    playerNoShow: false,
    isLiveOverride: Boolean(player?.isLiveOverride),
  };
};

/**
 * 무대 시작/재송출 시 현재 무대의 체급(grades) 및 출전 선수(playersPool)를 바탕으로
 * RTDB `currentStage/{contestId}`에 병합할 실시간 무대 스냅샷 페이로드를 생성합니다.
 */
export const buildLiveStageRealtimeSnapshot = ({
  targetStage = {},
  playersPool = [],
  customStagePlayers = null,
  pushIdPrefix = "push",
  preservedOriginalPlayers = null,
}) => {
  const rawGrades = Array.isArray(targetStage?.grades) ? targetStage.grades : [];
  const defaultCategoryId = String(targetStage?.categoryId || "");
  const defaultCategoryTitle = String(targetStage?.categoryTitle || "");

  const gradeMap = new Map();
  rawGrades.forEach((g) => {
    const gId = String(g?.gradeId || g?.contestGradeId || "");
    if (!gId) return;
    gradeMap.set(gId, {
      categoryId: String(g?.categoryId || defaultCategoryId),
      categoryTitle: String(g?.categoryTitle || defaultCategoryTitle),
      gradeId: gId,
      gradeTitle: String(g?.gradeTitle || g?.contestGradeTitle || ""),
    });
  });

  let normalizedPlayers = [];

  if (Array.isArray(customStagePlayers)) {
    // 본부석 긴급 현장 편성 모달에서 직접 지정한 선수 목록
    normalizedPlayers = customStagePlayers
      .filter(Boolean)
      .map((p, idx) => {
        const gId = String(
          p?.contestGradeId ||
            p?.gradeId ||
            rawGrades[0]?.gradeId ||
            targetStage?.gradeId ||
            ""
        );
        const gMeta = gradeMap.get(gId) || {};
        return normalizeStagePlayerSnapshotItem(p, idx, {
          gradeId: gId,
          gradeTitle: gMeta.gradeTitle || targetStage?.gradeTitle || "",
          categoryId: gMeta.categoryId || defaultCategoryId,
          categoryTitle: gMeta.categoryTitle || defaultCategoryTitle,
        });
      });
  } else {
    // 표준 무대 시작: 체급별 활성 출전선수를 정렬 순서대로 스냅샷화
    const pool = Array.isArray(playersPool) ? playersPool : [];
    rawGrades.forEach((g) => {
      const gId = String(g?.gradeId || g?.contestGradeId || "");
      if (!gId) return;
      const gMeta = gradeMap.get(gId) || {};
      const matched = pool
        .filter((p) => p?.contestGradeId === gId && isActiveStagePlayer(p))
        .sort(
          (a, b) =>
            getStagePlayerSortIndex(a, targetStage) -
            getStagePlayerSortIndex(b, targetStage)
        );

      matched.forEach((p, idx) => {
        normalizedPlayers.push(
          normalizeStagePlayerSnapshotItem(p, idx, {
            gradeId: gId,
            gradeTitle: gMeta.gradeTitle || "",
            categoryId: gMeta.categoryId || defaultCategoryId,
            categoryTitle: gMeta.categoryTitle || defaultCategoryTitle,
          })
        );
      });
    });
  }

  const stageGrades = Array.from(gradeMap.values()).map((g) => ({
    categoryId: g.categoryId,
    categoryTitle: g.categoryTitle,
    gradeId: g.gradeId,
    gradeTitle: g.gradeTitle,
    playerCount: normalizedPlayers.filter((p) => p.contestGradeId === g.gradeId)
      .length,
  }));

  const now = Date.now();
  const isOverridePush = pushIdPrefix === "liveoverride";
  const baselinePlayers = Array.isArray(preservedOriginalPlayers)
    ? preservedOriginalPlayers
    : normalizedPlayers;

  return {
    hasLiveStageSnapshot: true,
    isLiveOverridden: isOverridePush,
    stagePushId: `${pushIdPrefix}_${now}_${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    stagePushedAt: now,
    stageGrades,
    stagePlayerCount: normalizedPlayers.length,
    stagePlayers: normalizedPlayers,
    originalStagePlayers: baselinePlayers,
    originalStageGrades: stageGrades,
  };
};

/**
 * 현장 선수 재설정(밀어넣기)으로 변경된 무대 라인업을 원래 배정 정보로 원자적 롤백합니다.
 * 1) Firestore `contest_players_final`의 `stageOverrideBackups[backupKey]`가 존재하면
 *    변경 전 원본 배열(결시 여부·순서 포함)을 100% 그대로 복원하고 현장 투입(`isLiveOverride`) 엔트리를 제거합니다.
 * 2) 백업 이전 구버전 오버라이드 상태라도 `originalStagePlayers` 또는 비-오버라이드 원본 명단으로 안전 복원합니다.
 * 3) RTDB `currentStage/{contestId}`에 `rollback_` 스냅샷을 송출해 전 심판 태블릿 채점판을 즉시 원복합니다.
 */
export const rollbackLiveStageToOriginal = async ({
  db,
  database,
  contestId,
  finalPlayersDocId,
  currentStageInfo = {},
  realtimeData = {},
}) => {
  if (!contestId) {
    throw new Error("대회 ID를 확인할 수 없습니다.");
  }

  const rawGrades =
    Array.isArray(currentStageInfo?.grades) && currentStageInfo.grades.length > 0
      ? currentStageInfo.grades
      : extractRtdbPlayerArray(realtimeData?.stageGrades);

  const stageGradeIds = new Set(
    rawGrades.map((g) => g?.gradeId || g?.contestGradeId).filter(Boolean)
  );
  if (stageGradeIds.size === 0 && realtimeData?.gradeId) {
    stageGradeIds.add(String(realtimeData.gradeId));
  }

  const stageId = currentStageInfo?.stageId || realtimeData?.stageId || "";
  const backupKey = getStageBackupKey(stageId, Array.from(stageGradeIds));
  const rtdbBaselinePlayers = extractRtdbPlayerArray(
    realtimeData?.originalStagePlayers
  ).filter((p) => stageGradeIds.size === 0 || stageGradeIds.has(p.contestGradeId));

  let restoredFirestoreGradePlayers = null;
  let hasSavedFirestoreBackup = false;

  if (db && finalPlayersDocId && stageGradeIds.size > 0) {
    await runTransaction(db, async (tx) => {
      const finalRef = doc(db, "contest_players_final", finalPlayersDocId);
      const snap = await tx.get(finalRef);
      if (!snap.exists()) return;

      const docData = snap.data() || {};
      const existingPlayers = Array.isArray(docData.players)
        ? [...docData.players]
        : [];
      const existingBackups =
        docData.stageOverrideBackups &&
        typeof docData.stageOverrideBackups === "object"
          ? { ...docData.stageOverrideBackups }
          : {};

      const otherGradePlayers = existingPlayers.filter(
        (p) => !p || !stageGradeIds.has(p.contestGradeId)
      );

      const savedBackup = existingBackups[backupKey];
      let restoredForStage = [];

      if (savedBackup && Array.isArray(savedBackup.players)) {
        hasSavedFirestoreBackup = true;
        restoredForStage = savedBackup.players.map((p) => ({ ...p }));
        delete existingBackups[backupKey];
      } else {
        // 백업 생성 이전에 밀어넣기가 실행된 무대에 대한 안전 폴백:
        // 현장 임시 투입(isLiveOverride / force) 엔트리를 제거하고 원래 체급 선수들로 복원
        const baselineBibSet =
          rtdbBaselinePlayers.length > 0
            ? new Set(
                rtdbBaselinePlayers.map(
                  (bp) => `${bp.contestGradeId}::${String(bp.playerNumber)}`
                )
              )
            : null;

        const cleanOriginalGradePlayers = existingPlayers
          .filter(
            (p) =>
              p &&
              stageGradeIds.has(p.contestGradeId) &&
              p.isLiveOverride !== true
          )
          .sort(
            (a, b) =>
              (Number(a?.playerNumber) || 0) - (Number(b?.playerNumber) || 0)
          );

        const perGradeCounter = new Map();
        restoredForStage = cleanOriginalGradePlayers.map((p) => {
          const gId = p.contestGradeId || "";
          const nextIdx = (perGradeCounter.get(gId) || 0) + 1;
          perGradeCounter.set(gId, nextIdx);

          const key = `${gId}::${String(p.playerNumber)}`;
          const nextNoShow = baselineBibSet ? !baselineBibSet.has(key) : false;

          return {
            ...p,
            playerNoShow: nextNoShow,
            playerIndex: nextIdx,
          };
        });
      }

      restoredFirestoreGradePlayers = restoredForStage;

      tx.update(
        finalRef,
        sanitizeForFirestore({
          players: [...otherGradePlayers, ...restoredForStage],
          stageOverrideBackups: existingBackups,
          updatedAt: new Date().toISOString(),
        })
      );
    });
  }

  // RTDB로 재송출할 원래 활성 선수 목록 결정
  let restoredActivePlayers = [];
  if (hasSavedFirestoreBackup && Array.isArray(restoredFirestoreGradePlayers)) {
    restoredActivePlayers = restoredFirestoreGradePlayers
      .filter((p) => isActiveStagePlayer(p))
      .sort(
        (a, b) =>
          getStagePlayerSortIndex(a, currentStageInfo) -
          getStagePlayerSortIndex(b, currentStageInfo)
      );
  } else if (rtdbBaselinePlayers.length > 0) {
    restoredActivePlayers = rtdbBaselinePlayers.filter((p) =>
      isActiveStagePlayer(p)
    );
  } else if (Array.isArray(restoredFirestoreGradePlayers)) {
    restoredActivePlayers = restoredFirestoreGradePlayers
      .filter((p) => isActiveStagePlayer(p))
      .sort(
        (a, b) =>
          getStagePlayerSortIndex(a, currentStageInfo) -
          getStagePlayerSortIndex(b, currentStageInfo)
      );
  }

  const effectiveGrades =
    rawGrades.length > 0
      ? rawGrades
      : [
          {
            categoryId:
              currentStageInfo?.categoryId || realtimeData?.categoryId || "",
            categoryTitle:
              currentStageInfo?.categoryTitle ||
              realtimeData?.categoryTitle ||
              "",
            gradeId: realtimeData?.gradeId || "",
            gradeTitle: realtimeData?.gradeTitle || "",
          },
        ];

  const rollbackSnapshot = buildLiveStageRealtimeSnapshot({
    targetStage: {
      ...currentStageInfo,
      grades: effectiveGrades,
      categoryId:
        currentStageInfo?.categoryId || realtimeData?.categoryId || "",
      categoryTitle:
        currentStageInfo?.categoryTitle || realtimeData?.categoryTitle || "",
    },
    customStagePlayers: restoredActivePlayers,
    pushIdPrefix: "rollback",
    preservedOriginalPlayers: restoredActivePlayers,
  });

  const nextJudges = normalizeDenseRealtimeJudges(
    realtimeData?.judges,
    realtimeData?.stageJudgeCount
  ).map((j) => ({
    ...j,
    isEnd: false,
  }));

  try {
    await remove(ref(database, `currentStage/${contestId}/compares`));
  } catch {
    // ignore
  }

  await update(
    ref(database, `currentStage/${contestId}`),
    sanitizeForRealtimeDb({
      ...rollbackSnapshot,
      isLiveOverridden: false,
      judges: nextJudges,
      resultSaved: [],
      compares: {
        status: {
          compareStart: false,
          compareEnd: false,
          compareCancel: false,
          compareIng: false,
        },
        confirmed: { count: 0 },
      },
    })
  );

  return {
    restoredCount: rollbackSnapshot.stagePlayerCount,
    restoredBibs: rollbackSnapshot.stagePlayers.map((p) => p.playerNumber),
  };
};

/**
 * 본부석 / 심판위원장 모니터링 화면에서 현재 체급 출전선수를 조회할 때
 * RTDB에 `hasLiveStageSnapshot`이 존재하면 현장 실시간 스냅샷을 최우선 반영하고,
 * 구버전(V1) 송출 데이터일 때는 기존 Firestore `playersArray`로 폴백합니다.
 */
export const resolveEffectiveStagePlayers = ({
  realtimeData,
  fallbackPlayers = [],
  gradeIds = null,
  stageInfo = null,
}) => {
  const targetSet = Array.isArray(gradeIds)
    ? new Set(gradeIds.filter(Boolean))
    : gradeIds
    ? new Set([gradeIds])
    : null;

  if (realtimeData?.hasLiveStageSnapshot) {
    const rawRtdbPlayers = Array.isArray(realtimeData?.stagePlayers)
      ? realtimeData.stagePlayers
      : realtimeData?.stagePlayers && typeof realtimeData.stagePlayers === "object"
      ? Object.values(realtimeData.stagePlayers)
      : [];

    return rawRtdbPlayers
      .filter(
        (p) =>
          isActiveStagePlayer(p) &&
          (!targetSet || targetSet.has(p?.contestGradeId))
      )
      .sort(
        (a, b) =>
          (Number(a?.playerIndex) || Number(a?.playerNumber) || 0) -
          (Number(b?.playerIndex) || Number(b?.playerNumber) || 0)
      );
  }

  const pool = Array.isArray(fallbackPlayers) ? fallbackPlayers : [];
  return pool
    .filter(
      (p) =>
        isActiveStagePlayer(p) &&
        (!targetSet || targetSet.has(p?.contestGradeId))
    )
    .sort(
      (a, b) =>
        getStagePlayerSortIndex(a, stageInfo) -
        getStagePlayerSortIndex(b, stageInfo)
    );
};
