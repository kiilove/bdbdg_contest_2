import {
  generateToday,
  isGrandPrixPlayerEntry,
  syncGrandPrixPlayerIndexForStage,
} from "../functions/functions.js";
import { dedupeContestResultsByGrade } from "./contestResultsUtils.js";
import {
  isActiveStagePlayer,
  resolveOriginalGradeTitle,
} from "./playerEntryUtils.js";

const PHOTO_FIELDS = [
  "stagePhoto1",
  "stagePhoto2",
  "stagePhotoUrl1",
  "stagePhotoUrl2",
  "stagePhotoUrl",
  "profileImageUrl",
  "photoUrl",
  "playerPhoto",
  "photos",
];

export const getGrandPrixPlayerUniqueKey = (p) =>
  String(p?.playerUid || p?.playerNumber || p?.playerName || "").trim();

export const isGrandPrixCategoryObj = (cat) =>
  cat?.contestCategorySection === "그랑프리" ||
  String(cat?.contestCategoryTitle || "").includes("그랑프리");

export const sortByWonGradeOrder = (a, b) => {
  const gradeOrderDiff =
    Number(a?.originalGradeIndex ?? 9999) -
    Number(b?.originalGradeIndex ?? 9999);
  if (gradeOrderDiff !== 0) return gradeOrderDiff;
  return Number(a?.playerNumber || 0) - Number(b?.playerNumber || 0);
};

const extractDefinedPhotoFields = (entry) => {
  const out = {};
  if (!entry || typeof entry !== "object") return out;
  PHOTO_FIELDS.forEach((field) => {
    if (entry[field] !== undefined && entry[field] !== "") {
      out[field] = entry[field];
    }
  });
  return out;
};

const isSameWinnerIdentity = (savedEntry, incomingWinner) => {
  if (!savedEntry || !incomingWinner) return false;
  if (savedEntry.playerUid && incomingWinner.playerUid) {
    return String(savedEntry.playerUid) === String(incomingWinner.playerUid);
  }
  return (
    getGrandPrixPlayerUniqueKey(savedEntry) ===
    getGrandPrixPlayerUniqueKey(incomingWinner)
  );
};

const resolveSourceCategoryIdForGpGrade = (gpGrade, categories = []) => {
  if (gpGrade?.originalRefCategoryId) {
    return gpGrade.originalRefCategoryId;
  }
  const targetTitle = String(gpGrade?.contestGradeTitle || "").trim();
  if (!targetTitle) return "";
  const matchedRegularCat = (categories || []).find(
    (cat) =>
      cat &&
      !isGrandPrixCategoryObj(cat) &&
      String(cat.contestCategoryTitle || "").trim() === targetTitle
  );
  return matchedRegularCat?.contestCategoryId || "";
};

/**
 * 확정 결과(contest_results_list)의 체급별 1위 선수와 기존 contest_players_final 데이터를 결합하여
 * 그랑프리 출전 엔트리 배열을 생성하는 단일 진실 공급원(Single Source of Truth) 순수 함수
 */
export const buildGrandPrixPlayersFromResults = ({
  resultDocs = [],
  categories = [],
  grades = [],
  existingFinalPlayers = [],
  contestId = "",
  targetGpGradeIds = null,
  invoiceCreateAt = null,
  markAutoSynced = false,
} = {}) => {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeGrades = Array.isArray(grades) ? grades : [];
  const safeExisting = Array.isArray(existingFinalPlayers)
    ? existingFinalPlayers
    : [];
  const targetSet =
    targetGpGradeIds instanceof Set
      ? targetGpGradeIds
      : Array.isArray(targetGpGradeIds) && targetGpGradeIds.length > 0
      ? new Set(targetGpGradeIds.filter(Boolean))
      : null;

  const gradeById = new Map(
    safeGrades.filter(Boolean).map((g) => [g.contestGradeId, g])
  );
  const categoryById = new Map(
    safeCategories.filter(Boolean).map((c) => [c.contestCategoryId, c])
  );

  const gpCategoryIdSet = new Set(
    safeCategories
      .filter(isGrandPrixCategoryObj)
      .map((c) => c.contestCategoryId)
      .filter(Boolean)
  );

  const regularByUidAndGrade = new Map();
  const photoByUid = new Map();
  const savedGpByGradeAndKey = new Map();
  const savedGpByGradeAndOrigGrade = new Map();

  safeExisting.forEach((fp) => {
    if (!fp) return;
    const uKey = getGrandPrixPlayerUniqueKey(fp);
    const parentCat = fp.contestCategoryId
      ? categoryById.get(fp.contestCategoryId)
      : null;
    const isGpLike =
      isGrandPrixPlayerEntry(fp, parentCat) ||
      gpCategoryIdSet.has(fp.contestCategoryId);

    if (isGpLike && fp.contestGradeId && uKey) {
      savedGpByGradeAndKey.set(`${fp.contestGradeId}_${uKey}`, fp);
      if (fp.originalGradeId) {
        savedGpByGradeAndOrigGrade.set(
          `${fp.contestGradeId}__orig:${fp.originalGradeId}`,
          fp
        );
      }
    } else {
      if (fp.contestGradeId && uKey) {
        regularByUidAndGrade.set(`${fp.contestGradeId}_${uKey}`, fp);
      }
      if (fp.playerUid && !photoByUid.has(fp.playerUid)) {
        const photoFields = extractDefinedPhotoFields(fp);
        if (Object.keys(photoFields).length > 0) {
          photoByUid.set(fp.playerUid, photoFields);
        }
      }
    }
  });

  const filteredCategories = safeCategories
    .filter(isGrandPrixCategoryObj)
    .sort(
      (a, b) =>
        (Number(a?.contestCategoryIndex) || 0) -
        (Number(b?.contestCategoryIndex) || 0)
    );

  let filteredGrades = filteredCategories.reduce((acc, category) => {
    const matchingGrades = safeGrades
      .filter((grade) => grade?.refCategoryId === category.contestCategoryId)
      .sort(
        (a, b) =>
          (Number(a?.contestGradeIndex) || 0) -
          (Number(b?.contestGradeIndex) || 0)
      );
    return [...acc, ...matchingGrades];
  }, []);

  if (targetSet) {
    const inFilteredIds = new Set(
      filteredGrades.map((g) => g?.contestGradeId).filter(Boolean)
    );
    filteredGrades = filteredGrades.filter((g) =>
      targetSet.has(g?.contestGradeId)
    );
    // 혹시 상위 카테고리 필터에 누락된 target GP grade가 있으면 직접 보충
    targetSet.forEach((gid) => {
      if (!inFilteredIds.has(gid) && gradeById.has(gid)) {
        filteredGrades.push(gradeById.get(gid));
      }
    });
  }

  const dedupedResults = dedupeContestResultsByGrade(
    Array.isArray(resultDocs) ? resultDocs : [],
    contestId
  );

  const createdTimestamp = invoiceCreateAt || generateToday();

  const flattenedWinner = dedupedResults
    .map((infoItem) => {
      const {
        result: playerResult,
        contestId: docContestId,
        categoryId,
        gradeId,
        categoryTitle,
        gradeTitle,
      } = infoItem || {};

      const findWinner = (Array.isArray(playerResult) ? playerResult : []).find(
        (f) => Number(f?.playerRank) === 1
      );
      if (!findWinner) return null;

      const wonGrade =
        gradeById.get(gradeId) ||
        safeGrades.find(
          (g) =>
            g?.refCategoryId === categoryId &&
            g?.contestGradeTitle === gradeTitle
        );
      const originalGradeIndex = Number.isFinite(
        Number(wonGrade?.contestGradeIndex)
      )
        ? Number(wonGrade.contestGradeIndex)
        : 9999;

      const winnerKey = getGrandPrixPlayerUniqueKey(findWinner);
      const regularEntry = regularByUidAndGrade.get(`${gradeId}_${winnerKey}`);
      const inheritedPhotos = {
        ...(findWinner.playerUid
          ? photoByUid.get(findWinner.playerUid) || {}
          : {}),
        ...extractDefinedPhotoFields(regularEntry),
      };
      const resolvedWonCategoryTitle =
        categoryTitle ||
        categoryById.get(categoryId)?.contestCategoryTitle ||
        "";
      const resolvedWonGradeTitle =
        wonGrade?.contestGradeTitle || gradeTitle || "";

      return {
        ...inheritedPhotos,
        contestId: docContestId || contestId || "",
        originalCategoryId: categoryId || "",
        originalGradeId: gradeId || "",
        originalGradeIndex,
        originalcategoryTitle: resolvedWonCategoryTitle,
        originalCategoryTitle: resolvedWonCategoryTitle,
        originalgradeTitle: resolvedWonGradeTitle,
        originalGradeTitle: resolvedWonGradeTitle,
        wasGradeChangedInOriginal: Boolean(
          regularEntry?.isGradeChanged || regularEntry?.isGradeChange
        ),
        regularPlayerIndex:
          regularEntry?.playerIndex ??
          findWinner?.playerIndex ??
          findWinner?.playerNumber ??
          null,
        playerName: regularEntry?.playerName || findWinner.playerName || "",
        playerNumber: regularEntry?.playerNumber ?? findWinner.playerNumber,
        playerGym:
          regularEntry?.playerGym !== undefined
            ? regularEntry.playerGym
            : findWinner.playerGym || "",
        playerUid: findWinner.playerUid || regularEntry?.playerUid || "",
        totalScore: findWinner.totalScore,
        isGradeChange: false,
        isGradeChanged: false,
        createBy: "web",
        id: "",
        invoiceCreateAt: createdTimestamp,
        invoiceId: "",
        playerTel: regularEntry?.playerTel || "",
        playerBirth: regularEntry?.playerBirth || "",
        playerText: regularEntry?.playerText || "",
        playerNoShow: false,
      };
    })
    .filter(Boolean);

  let output = [];

  filteredGrades.forEach((grade) => {
    if (!grade?.contestGradeId) return;
    const parentCategory = categoryById.get(grade.refCategoryId);
    const sourceCategoryId = resolveSourceCategoryIdForGpGrade(
      grade,
      safeCategories
    );

    const filteredMatching = sourceCategoryId
      ? flattenedWinner.filter(
          (f) => f.originalCategoryId === sourceCategoryId
        )
      : [];

    const forceEntriesInGrade = safeExisting.filter(
      (fp) =>
        fp?.contestGradeId === grade.contestGradeId &&
        (fp?.createdBy === "force" ||
          fp?.createBy === "force" ||
          fp?.isLiveOverride === true)
    );

    const seenPlayers = new Set();
    const seenOriginalGrades = new Set();
    const candidates = [];

    filteredMatching.forEach((match) => {
      const playerKey = getGrandPrixPlayerUniqueKey(match);
      if (!playerKey || seenPlayers.has(playerKey)) return;
      if (
        match.originalGradeId &&
        seenOriginalGrades.has(match.originalGradeId)
      ) {
        return;
      }
      seenPlayers.add(playerKey);
      if (match.originalGradeId) {
        seenOriginalGrades.add(match.originalGradeId);
      }

      const directSaved = savedGpByGradeAndKey.get(
        `${grade.contestGradeId}_${playerKey}`
      );
      const origGradeSaved = match.originalGradeId
        ? savedGpByGradeAndOrigGrade.get(
            `${grade.contestGradeId}__orig:${match.originalGradeId}`
          )
        : null;

      // 동일 선수이거나, 수동 레이어 편집(layer3Edited)된 동일 선수일 때만 기존 저장본 승계
      // (재집계로 1위 우승자가 바뀐 경우에는 이전 우승자 이름/번호가 섞이지 않도록 차단)
      const saved =
        directSaved ||
        (origGradeSaved &&
        origGradeSaved.layer3Edited &&
        isSameWinnerIdentity(origGradeSaved, match)
          ? origGradeSaved
          : null);

      const { regularPlayerIndex, ...matchRest } = match;
      const resolvedOriginalIndex =
        saved?.playerIndexOriginal !== undefined &&
        saved?.playerIndexOriginal !== null
          ? saved.playerIndexOriginal
          : regularPlayerIndex !== undefined && regularPlayerIndex !== null
          ? regularPlayerIndex
          : saved?.playerIndex ?? matchRest.playerNumber ?? null;

      const savedOrigTitle = saved ? resolveOriginalGradeTitle(saved) : "";
      const savedPhotos = extractDefinedPhotoFields(saved);

      candidates.push({
        ...matchRest,
        ...savedPhotos,
        ...(saved?.invoiceCreateAt
          ? { invoiceCreateAt: saved.invoiceCreateAt }
          : {}),
        ...(saved?._entryId ? { _entryId: saved._entryId } : {}),
        playerName: saved?.playerName || matchRest.playerName,
        playerNumber:
          saved?.playerNumber !== undefined && saved?.playerNumber !== null
            ? saved.playerNumber
            : matchRest.playerNumber,
        playerGym:
          saved?.playerGym !== undefined ? saved.playerGym : matchRest.playerGym,
        playerTel:
          saved?.playerTel !== undefined ? saved.playerTel : matchRest.playerTel,
        playerBirth:
          saved?.playerBirth !== undefined
            ? saved.playerBirth
            : matchRest.playerBirth,
        playerText:
          saved?.playerText !== undefined
            ? saved.playerText
            : matchRest.playerText,
        ...(savedOrigTitle
          ? {
              originalGradeTitle: savedOrigTitle,
              originalgradeTitle: savedOrigTitle,
            }
          : {}),
        ...(saved?.layer3Edited ? { layer3Edited: true } : {}),
        ...(saved?.layer3EditedAt
          ? { layer3EditedAt: saved.layer3EditedAt }
          : {}),
        ...(saved?.gpLayerSaved ? { gpLayerSaved: true } : {}),
        ...(markAutoSynced && !saved?.gpLayerSaved
          ? { gpAutoSynced: true }
          : {}),
        contestCategoryId: grade.refCategoryId || "",
        contestCategoryTitle:
          parentCategory?.contestCategoryTitle || "그랑프리",
        contestCategorySection: "그랑프리",
        contestGradeId: grade.contestGradeId,
        contestGradeTitle: grade.contestGradeTitle || "",
        playerIndexOriginal: resolvedOriginalIndex,
        playerNoShow: Boolean(saved?.playerNoShow ?? matchRest.playerNoShow),
        savedGrandPrixIndex: Number.isFinite(Number(saved?.grandPrixIndex))
          ? Number(saved.grandPrixIndex)
          : null,
        isCustomGrandPrixIndex: Boolean(saved?.isCustomGrandPrixIndex),
      });
    });

    forceEntriesInGrade.forEach((fp) => {
      const playerKey = getGrandPrixPlayerUniqueKey(fp);
      if (!playerKey || seenPlayers.has(playerKey)) return;
      seenPlayers.add(playerKey);

      const wonGrade = fp.originalGradeId
        ? gradeById.get(fp.originalGradeId)
        : null;
      const resolvedWonOrder = Number.isFinite(
        Number(fp.originalGradeIndex ?? wonGrade?.contestGradeIndex)
      )
        ? Number(fp.originalGradeIndex ?? wonGrade?.contestGradeIndex)
        : 9999;
      const resolvedForceOriginalIndex =
        fp?.playerIndexOriginal !== undefined &&
        fp?.playerIndexOriginal !== null
          ? fp.playerIndexOriginal
          : fp?.playerIndex ?? fp?.playerNumber ?? null;
      const resolvedForceOrigGradeTitle =
        resolveOriginalGradeTitle(fp) || wonGrade?.contestGradeTitle || "";
      const resolvedForceOrigCategoryTitle =
        fp.originalcategoryTitle || fp.originalCategoryTitle || "";

      candidates.push({
        ...fp,
        contestCategoryId: grade.refCategoryId || fp.contestCategoryId || "",
        contestCategoryTitle:
          parentCategory?.contestCategoryTitle ||
          fp.contestCategoryTitle ||
          "그랑프리",
        contestCategorySection: "그랑프리",
        contestGradeId: grade.contestGradeId,
        contestGradeTitle: grade.contestGradeTitle || fp.contestGradeTitle || "",
        originalgradeTitle: resolvedForceOrigGradeTitle,
        originalGradeTitle: resolvedForceOrigGradeTitle,
        ...(resolvedForceOrigCategoryTitle
          ? {
              originalcategoryTitle: resolvedForceOrigCategoryTitle,
              originalCategoryTitle: resolvedForceOrigCategoryTitle,
            }
          : {}),
        originalGradeIndex: resolvedWonOrder,
        playerIndexOriginal: resolvedForceOriginalIndex,
        isGradeChange: false,
        isGradeChanged: false,
        savedGrandPrixIndex: Number.isFinite(Number(fp?.grandPrixIndex))
          ? Number(fp.grandPrixIndex)
          : null,
        isCustomGrandPrixIndex: Boolean(fp?.isCustomGrandPrixIndex),
      });
    });

    const hasCustomSavedOrder = candidates.some(
      (c) => c.isCustomGrandPrixIndex && c.savedGrandPrixIndex !== null
    );

    candidates.sort((a, b) => {
      if (hasCustomSavedOrder) {
        const aSaved = a.savedGrandPrixIndex ?? 9999;
        const bSaved = b.savedGrandPrixIndex ?? 9999;
        if (aSaved !== bSaved) return aSaved - bSaved;
      }
      return sortByWonGradeOrder(a, b);
    });

    const orderedForGrade = candidates.map((item, idx) => {
      const { savedGrandPrixIndex, ...rest } = item;
      const gpIndex = idx + 1;
      const preservedOriginal =
        rest.playerIndexOriginal !== undefined &&
        rest.playerIndexOriginal !== null
          ? rest.playerIndexOriginal
          : rest.playerIndex ?? rest.playerNumber ?? null;
      return {
        ...rest,
        playerIndexOriginal: preservedOriginal,
        grandPrixIndex: gpIndex,
        playerIndex: gpIndex,
        isGradeChange: false,
        isGradeChanged: false,
      };
    });

    output = [...output, ...orderedForGrade];
  });

  const uniqueMap = new Map();
  output.forEach((p) => {
    const uniqueKey = `${p.contestGradeId}_${getGrandPrixPlayerUniqueKey(p)}`;
    if (!uniqueMap.has(uniqueKey)) {
      uniqueMap.set(uniqueKey, p);
    }
  });

  return Array.from(uniqueMap.values());
};

const COMPARE_SCALAR_FIELDS = [
  "_entryId",
  "contestCategoryId",
  "contestCategoryTitle",
  "contestCategorySection",
  "contestGradeId",
  "contestGradeTitle",
  "originalCategoryId",
  "originalGradeId",
  "originalGradeTitle",
  "playerUid",
  "playerNumber",
  "playerName",
  "playerGym",
  "playerIndex",
  "grandPrixIndex",
  "playerIndexOriginal",
  "playerNoShow",
  "isCustomGrandPrixIndex",
  "stagePhoto1",
  "stagePhoto2",
  "profileImageUrl",
  "photoUrl",
];

const areGradePlayerListsEqual = (prevList = [], nextList = []) => {
  if (prevList.length !== nextList.length) return false;
  for (let i = 0; i < prevList.length; i += 1) {
    const a = prevList[i] || {};
    const b = nextList[i] || {};
    for (const field of COMPARE_SCALAR_FIELDS) {
      if ((a[field] ?? "") !== (b[field] ?? "")) {
        return false;
      }
    }
  }
  return true;
};

/**
 * 그랑프리 명단 미저장/누락 방어용 자동 병합 함수
 * - 지정된 targetGpGradeIds 범위의 그랑프리 체급만 안전하게 갱신하며, 일반 종목 및 다른 그랑프리 체급은 절대 건드리지 않습니다.
 * - 확정 결과가 0건인 상태에서는 기존에 수동 등록된 그랑프리 엔트리를 지우지 않고 그대로 보존합니다.
 * - 원 종목(originalRefCategoryId) 소속 체급 중 실제 출전 선수가 있는데 아직 순위 확정(1위)이 없는 체급 목록(missingSourceGrades)도 함께 반환합니다.
 */
export const syncGrandPrixRosterIntoFinalPlayers = ({
  existingFinalPlayers = [],
  resultDocs = [],
  categories = [],
  grades = [],
  contestId = "",
  targetGpGradeIds = null,
  targetStage = null,
  invoiceCreateAt = null,
} = {}) => {
  const safeExisting = Array.isArray(existingFinalPlayers)
    ? existingFinalPlayers
    : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeGrades = Array.isArray(grades) ? grades : [];

  const gpCategoryIds = new Set(
    safeCategories
      .filter(isGrandPrixCategoryObj)
      .map((c) => c.contestCategoryId)
      .filter(Boolean)
  );

  const allGpGrades = safeGrades.filter(
    (g) => g?.contestGradeId && gpCategoryIds.has(g?.refCategoryId)
  );
  const gradeById = new Map(
    safeGrades.filter(Boolean).map((g) => [g.contestGradeId, g])
  );

  const requestedIds =
    targetGpGradeIds instanceof Set
      ? Array.from(targetGpGradeIds).filter(Boolean)
      : Array.isArray(targetGpGradeIds) && targetGpGradeIds.length > 0
      ? targetGpGradeIds.filter(Boolean)
      : allGpGrades.map((g) => g.contestGradeId);

  const scopedGradeIdSet = new Set(requestedIds);
  if (scopedGradeIdSet.size === 0) {
    return {
      players: safeExisting,
      changed: false,
      addedCount: 0,
      updatedCount: 0,
      totalGpPlayersInScope: 0,
      missingSourceGrades: [],
    };
  }

  const dedupedResults = dedupeContestResultsByGrade(
    Array.isArray(resultDocs) ? resultDocs : [],
    contestId
  );

  const confirmedWinnerGradeIdSet = new Set();
  const confirmedWinnerCategoryIdSet = new Set();
  dedupedResults.forEach((docItem) => {
    const hasRank1 = (Array.isArray(docItem?.result) ? docItem.result : []).some(
      (r) => Number(r?.playerRank) === 1
    );
    if (hasRank1) {
      if (docItem?.gradeId) confirmedWinnerGradeIdSet.add(docItem.gradeId);
      if (docItem?.categoryId) {
        confirmedWinnerCategoryIdSet.add(docItem.categoryId);
      }
    }
  });

  // 원 종목 내 실제 출전 선수가 존재하는데 아직 1위 순위 확정이 안 된 하위 체급 탐지
  const missingSourceGrades = [];
  const seenMissingGradeIds = new Set();

  scopedGradeIdSet.forEach((gpGradeId) => {
    const gpGrade = gradeById.get(gpGradeId);
    if (!gpGrade) return;
    const sourceCatId = resolveSourceCategoryIdForGpGrade(
      gpGrade,
      safeCategories
    );
    if (!sourceCatId) return;

    const regularGradesInSource = safeGrades
      .filter((g) => g?.refCategoryId === sourceCatId && g?.contestGradeId)
      .sort(
        (a, b) =>
          (Number(a?.contestGradeIndex) || 0) -
          (Number(b?.contestGradeIndex) || 0)
      );

    regularGradesInSource.forEach((regGrade) => {
      const regGradeId = regGrade.contestGradeId;
      if (seenMissingGradeIds.has(regGradeId)) return;

      const hasActiveRegularPlayers = safeExisting.some(
        (p) =>
          p &&
          p.contestGradeId === regGradeId &&
          !isGrandPrixPlayerEntry(p) &&
          isActiveStagePlayer(p)
      );
      if (!hasActiveRegularPlayers) return;

      if (!confirmedWinnerGradeIdSet.has(regGradeId)) {
        seenMissingGradeIds.add(regGradeId);
        missingSourceGrades.push({
          gpGradeId,
          gpGradeTitle: gpGrade.contestGradeTitle || "",
          sourceCategoryId: sourceCatId,
          gradeId: regGradeId,
          gradeTitle: regGrade.contestGradeTitle || "",
        });
      }
    });
  });

  const generatedScopedPlayers = buildGrandPrixPlayersFromResults({
    resultDocs: dedupedResults,
    categories: safeCategories,
    grades: safeGrades,
    existingFinalPlayers: safeExisting,
    contestId,
    targetGpGradeIds: scopedGradeIdSet,
    invoiceCreateAt,
    markAutoSynced: true,
  });

  const generatedByGrade = new Map();
  generatedScopedPlayers.forEach((p) => {
    if (!generatedByGrade.has(p.contestGradeId)) {
      generatedByGrade.set(p.contestGradeId, []);
    }
    generatedByGrade.get(p.contestGradeId).push(p);
  });

  let addedCount = 0;
  let updatedCount = 0;
  let rosterChanged = false;
  const gradesToReplace = new Map();

  scopedGradeIdSet.forEach((gpGradeId) => {
    const gpGrade = gradeById.get(gpGradeId);
    const sourceCatId = gpGrade
      ? resolveSourceCategoryIdForGpGrade(gpGrade, safeCategories)
      : "";
    const hasConfirmedSourceWinner = sourceCatId
      ? confirmedWinnerCategoryIdSet.has(sourceCatId)
      : false;

    const existingInGrade = safeExisting.filter(
      (p) => p && p.contestGradeId === gpGradeId
    );
    const nextInGrade = generatedByGrade.get(gpGradeId) || [];

    // 확정된 하위 체급 1위가 아직 0명인 경우 기존 수동 엔트리를 지우지 않고 보존
    if (!hasConfirmedSourceWinner && nextInGrade.length === 0) {
      return;
    }

    const existingKeySet = new Set(
      existingInGrade.map((p) => getGrandPrixPlayerUniqueKey(p)).filter(Boolean)
    );
    nextInGrade.forEach((np) => {
      const k = getGrandPrixPlayerUniqueKey(np);
      if (k && !existingKeySet.has(k)) {
        addedCount += 1;
      }
    });

    if (!areGradePlayerListsEqual(existingInGrade, nextInGrade)) {
      rosterChanged = true;
      updatedCount += nextInGrade.length;
      gradesToReplace.set(gpGradeId, nextInGrade);
    }
  });

  let mergedPlayers = safeExisting;
  if (rosterChanged && gradesToReplace.size > 0) {
    const untouchedPlayers = safeExisting.filter(
      (p) => !p || !gradesToReplace.has(p.contestGradeId)
    );
    const replacementPlayers = [];
    gradesToReplace.forEach((list) => {
      replacementPlayers.push(...list);
    });
    mergedPlayers = [...untouchedPlayers, ...replacementPlayers];
  }

  let finalPlayers = mergedPlayers;
  let stageIndexChanged = false;
  if (targetStage) {
    const stageSync = syncGrandPrixPlayerIndexForStage(
      mergedPlayers,
      targetStage,
      safeCategories
    );
    finalPlayers = stageSync.players;
    stageIndexChanged = stageSync.changed;
  }

  const totalGpPlayersInScope = finalPlayers.filter(
    (p) =>
      p &&
      scopedGradeIdSet.has(p.contestGradeId) &&
      isActiveStagePlayer(p)
  ).length;

  return {
    players: finalPlayers,
    changed: rosterChanged || stageIndexChanged,
    addedCount,
    updatedCount,
    totalGpPlayersInScope,
    missingSourceGrades,
  };
};

/**
 * 일반 종목 체급의 categoryId가 연결된 그랑프리 체급 ID 목록 반환
 */
export const findLinkedGrandPrixGradeIdsForCategory = (
  sourceCategoryId,
  categories = [],
  grades = []
) => {
  if (!sourceCategoryId) return [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeGrades = Array.isArray(grades) ? grades : [];

  const gpCategoryIds = new Set(
    safeCategories
      .filter(isGrandPrixCategoryObj)
      .map((c) => c.contestCategoryId)
      .filter(Boolean)
  );

  return safeGrades
    .filter((g) => {
      if (!g?.contestGradeId || !gpCategoryIds.has(g?.refCategoryId)) {
        return false;
      }
      const resolvedSourceId = resolveSourceCategoryIdForGpGrade(
        g,
        safeCategories
      );
      return resolvedSourceId === sourceCategoryId;
    })
    .map((g) => g.contestGradeId);
};
