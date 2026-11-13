import {
  getStagePlayerSortIndex,
  isGrandPrixPlayerEntry,
} from "../functions/functions.js";

/**
 * 무대 출전 활성 선수 여부 판별 (불참자 제외 표준 단일 기준)
 * - playerNoShow가 명시적으로 true인 경우만 불참으로 제외하고,
 *   false / undefined / null 은 모두 정상 출전 선수로 인정합니다.
 */
export const isActiveStagePlayer = (player) =>
  Boolean(player) && player.playerNoShow !== true;

/**
 * 선수 엔트리 생성 경로 표준 판별 ("force" | "manual" | "web")
 */
export const resolveEntryOrigin = (player) => {
  const raw = String(player?.createdBy || player?.createBy || "")
    .trim()
    .toLowerCase();
  if (raw === "force") return "force";
  if (raw === "manual") return "manual";
  return "web";
};

/**
 * 원체급 명칭 조회 (camelCase originalGradeTitle 및 레거시 소문자 originalgradeTitle 모두 호환)
 */
export const resolveOriginalGradeTitle = (player) =>
  String(
    player?.originalgradeTitle || player?.originalGradeTitle || ""
  ).trim();

/**
 * 원종목 명칭 조회 (camelCase originalCategoryTitle 및 레거시 소문자 originalcategoryTitle 모두 호환)
 */
export const resolveOriginalCategoryTitle = (player) =>
  String(
    player?.originalcategoryTitle || player?.originalCategoryTitle || ""
  ).trim();

/**
 * 신장 / 체중 문자열 파싱 ("175 / 72.4" -> { height: "175", weight: "72.4" })
 */
export const parseHeightWeightValue = (str = "") => {
  if (!str) return { height: "", weight: "" };
  const s = typeof str === "string" ? str : String(str);
  if (s.includes("/")) {
    const parts = s.split("/");
    const h = (parts[0] || "").replace(/cm/gi, "").trim();
    const w = (parts[1] || "").replace(/kg/gi, "").trim();
    return { height: h, weight: w };
  }
  return { height: s.replace(/cm/gi, "").trim(), weight: "" };
};

/**
 * 신장 / 체중 저장용 포맷팅
 */
export const formatHeightWeightValue = (height = "", weight = "") => {
  const h = String(height ?? "").trim();
  const w = String(weight ?? "").trim();
  if (!h && !w) return "";
  if (h && w) return `${h} / ${w}`;
  if (h) return `${h} /`;
  if (w) return `/ ${w}`;
  return "";
};

/**
 * 다종목 출전 선수를 구분하는 고유 엔트리 키 생성
 */
export const getPlayerEntryKey = (p) => {
  if (!p) return "";
  const idPart =
    p.playerUid ||
    `num:${p.playerNumber ?? ""}_name:${(p.playerName || "").trim()}`;
  const catId = p.contestCategoryId || "";
  const gradeId = p.originalGradeId || p.contestGradeId || "";
  return `${idPart}_${catId}_${gradeId}`;
};

/**
 * 최종명단 보존 판별용 (contestGradeId, playerNumber, playerUid) 엄격 튜플 키
 */
export const getPlayerTupleKey = (p) => {
  if (!p) return "";
  return `${p.contestGradeId || ""}__${p.playerNumber ?? ""}__${
    p.playerUid || ""
  }`;
};

/**
 * 그랑프리 엔트리 여부 판별
 */
export const isGrandPrixEntryLike = (p, contextMeta = null) =>
  isGrandPrixPlayerEntry(p, contextMeta);

/**
 * 그랑프리 자동생성 엔트리 여부 판별 (현장 강제등록 'force' 제외)
 */
export const isAutoGrandPrixEntry = (p, contextMeta = null) => {
  if (!p) return false;
  if (resolveEntryOrigin(p) === "force") return false;
  return isGrandPrixEntryLike(p, contextMeta);
};

/**
 * contest_players_final 저장 시 assign에 없는 그랑프리/강제등록 선수 보존 병합
 */
export const mergePreservingUnmatchedFinalEntries = (
  targetFinalPlayers = [],
  existingFinalPlayers = []
) => {
  if (
    !Array.isArray(existingFinalPlayers) ||
    existingFinalPlayers.length === 0
  ) {
    return targetFinalPlayers;
  }

  const entryKeySet = new Set(
    targetFinalPlayers.map((p) => getPlayerEntryKey(p)).filter(Boolean)
  );
  const tupleKeySet = new Set(
    targetFinalPlayers.map((p) => getPlayerTupleKey(p)).filter(Boolean)
  );
  const regularUidCatSet = new Set(
    targetFinalPlayers
      .filter(
        (p) =>
          p?.playerUid &&
          p?.contestCategoryId &&
          !isGrandPrixEntryLike(p)
      )
      .map((p) => `${p.playerUid}__${p.contestCategoryId}`)
  );

  const preserved = [...targetFinalPlayers];
  existingFinalPlayers.forEach((fp) => {
    if (!fp) return;
    const eKey = getPlayerEntryKey(fp);
    const tKey = getPlayerTupleKey(fp);
    if ((eKey && entryKeySet.has(eKey)) || (tKey && tupleKeySet.has(tKey))) {
      return;
    }
    const isForce = resolveEntryOrigin(fp) === "force";
    const isGrandPrix = isGrandPrixEntryLike(fp);
    if (
      !isForce &&
      !isGrandPrix &&
      fp.isGradeChanged &&
      fp.playerUid &&
      fp.contestCategoryId &&
      regularUidCatSet.has(`${fp.playerUid}__${fp.contestCategoryId}`)
    ) {
      return;
    }
    if (eKey) entryKeySet.add(eKey);
    if (tKey) tupleKeySet.add(tKey);
    preserved.push(fp);
  });

  return preserved;
};

/**
 * 단일 체급(gradeId)의 무대 출전 선수 필터링 · 중복제거 · 정렬
 */
export const getStagePlayersForGrade = (
  players = [],
  gradeId,
  contextMeta = null
) => {
  if (!Array.isArray(players) || !gradeId) return [];
  const raw = players
    .filter((p) => p?.contestGradeId === gradeId && isActiveStagePlayer(p))
    .sort(
      (a, b) =>
        getStagePlayerSortIndex(a, contextMeta) -
        getStagePlayerSortIndex(b, contextMeta)
    );

  const seen = new Set();
  const deduped = [];
  raw.forEach((p) => {
    const key = String(p.playerUid || p.playerNumber || p.playerName || "");
    if (!key || !seen.has(key)) {
      if (key) seen.add(key);
      deduped.push(p);
    }
  });
  return deduped;
};

/**
 * 무대(통합 무대 포함) 전체 출전 선수 목록 조회
 */
export const getAllStagePlayers = (
  players = [],
  grades = [],
  stageMeta = null
) => {
  if (!Array.isArray(grades) || grades.length === 0) return [];
  const combined = [];
  grades.forEach((g) => {
    const gId = g?.gradeId || g?.contestGradeId;
    if (!gId) return;
    const gradePlayers = getStagePlayersForGrade(
      players,
      gId,
      stageMeta || g
    );
    combined.push(...gradePlayers);
  });
  return combined;
};
