import {
  formatHeightWeightValue,
  getPlayerEntryKey,
  getPlayerTupleKey,
  isAutoGrandPrixEntry,
  isGrandPrixEntryLike,
  parseHeightWeightValue,
  resolveEntryOrigin,
} from "./playerEntryUtils.js";

/**
 * 내부 임시 UI 키(_rowId 등) 제거 후 영속화 가능한 선수 객체 반환
 */
export const stripTransientUiProps = (player) => {
  if (!player || typeof player !== "object") return player;
  const { _rowId, savedGrandPrixIndex, ...rest } = player;
  return rest;
};

/**
 * 레이어 내 동일 선수 엔트리 여부를 수정 전 스냅샷(targetSnapshot) 기준으로 안전 판별
 * - 이름/선수번호/체급이 수정되더라도 수정 전 스냅샷과 정확히 매칭하여 중복 생성 없이 제자리(in-place) 치환
 */
export const isSameLayerPlayerEntry = (candidate, targetSnapshot) => {
  if (!candidate || !targetSnapshot) return false;

  // 같은 그랑프리 여부 구분 (일반 체급 엔트리와 그랑프리 엔트리가 서로 덮어쓰지 않도록 최우선 보호)
  const candIsGp = isGrandPrixEntryLike(candidate);
  const targetIsGp = isGrandPrixEntryLike(targetSnapshot);
  if (candIsGp !== targetIsGp) return false;

  if (
    candidate._entryId &&
    targetSnapshot._entryId &&
    candidate._entryId === targetSnapshot._entryId
  ) {
    return true;
  }

  const candKey = getPlayerEntryKey(candidate);
  const targetKey = getPlayerEntryKey(targetSnapshot);
  if (candKey && targetKey && candKey === targetKey) {
    return true;
  }

  const candGrade = candidate.contestGradeId || "";
  const targetGrade = targetSnapshot.contestGradeId || "";
  const candOrigGrade = candidate.originalGradeId || candGrade;
  const targetOrigGrade = targetSnapshot.originalGradeId || targetGrade;

  if (candidate.playerUid && targetSnapshot.playerUid) {
    if (candidate.playerUid === targetSnapshot.playerUid) {
      if (candIsGp) {
        return candGrade !== "" && candGrade === targetGrade;
      }
      if (
        (candidate.contestCategoryId || "") ===
          (targetSnapshot.contestCategoryId || "") &&
        (candGrade === targetGrade || candOrigGrade === targetOrigGrade)
      ) {
        return true;
      }
    }
    return false;
  }

  const candName = String(candidate.playerName || "").trim();
  const targetName = String(targetSnapshot.playerName || "").trim();
  const candNum = Number(candidate.playerNumber);
  const targetNum = Number(targetSnapshot.playerNumber);

  if (
    candGrade &&
    candGrade === targetGrade &&
    candName &&
    candName === targetName &&
    Number.isFinite(candNum) &&
    candNum === targetNum
  ) {
    return true;
  }

  return false;
};

/**
 * 레이어별 선수 정보 직접 수정 패치 생성
 * @param {object} basePlayer 수정 전 원본 선수 객체
 * @param {object} patchFields 모달에서 입력한 수정 필드
 * @param {object} options { layer: "assign" | "weighin" | "final" | "grandprix", nowIso?: string }
 */
export const buildPatchedLayerPlayer = (
  basePlayer = {},
  patchFields = {},
  options = {}
) => {
  const layer = options.layer || "final";
  const nowIso = options.nowIso || new Date().toISOString();
  const cleanBase = stripTransientUiProps(basePlayer);

  const nextPlayerNumber =
    patchFields.playerNumber !== undefined && patchFields.playerNumber !== ""
      ? Number(patchFields.playerNumber)
      : Number(cleanBase.playerNumber) || 0;

  const nextPlayerIndex =
    patchFields.playerIndex !== undefined && patchFields.playerIndex !== ""
      ? Number(patchFields.playerIndex)
      : Number(cleanBase.playerIndex) || nextPlayerNumber || 0;

  const nextCategoryId =
    patchFields.contestCategoryId !== undefined
      ? patchFields.contestCategoryId
      : cleanBase.contestCategoryId || "";
  const nextCategoryTitle =
    patchFields.contestCategoryTitle !== undefined
      ? patchFields.contestCategoryTitle
      : cleanBase.contestCategoryTitle || "";
  const nextCategorySection =
    patchFields.contestCategorySection !== undefined
      ? patchFields.contestCategorySection
      : cleanBase.contestCategorySection || "";

  const nextGradeId =
    patchFields.contestGradeId !== undefined
      ? patchFields.contestGradeId
      : cleanBase.contestGradeId || "";
  const nextGradeTitle =
    patchFields.contestGradeTitle !== undefined
      ? patchFields.contestGradeTitle
      : cleanBase.contestGradeTitle || "";

  const baseParsedHW = parseHeightWeightValue(cleanBase.heightWeight);
  const nextHeight =
    patchFields.height !== undefined
      ? String(patchFields.height ?? "").trim()
      : String(
          cleanBase.playerHeight || cleanBase.height || baseParsedHW.height || ""
        ).trim();
  const nextWeight =
    patchFields.weight !== undefined
      ? String(patchFields.weight ?? "").trim()
      : String(
          cleanBase.playerWeight || cleanBase.weight || baseParsedHW.weight || ""
        ).trim();
  const nextHeightWeight =
    patchFields.height !== undefined || patchFields.weight !== undefined
      ? formatHeightWeightValue(nextHeight, nextWeight)
      : cleanBase.heightWeight || formatHeightWeightValue(nextHeight, nextWeight);

  const isGp = layer === "grandprix" || isGrandPrixEntryLike(cleanBase);

  // 체급 직접 변경 처리:
  // - 1단계(assign): 기준 체급 자체를 수정하므로 originalGradeId도 새 체급으로 동기화
  // - 2·3단계(weighin/final): 월체 체크가 아니면 직접 지정한 체급을 기준 체급으로 반영하되,
  //   월체 상태(isGradeChanged)를 유지하는 경우 기존 originalGradeId 보존
  const nextIsGradeChanged = isGp
    ? false
    : patchFields.isGradeChanged !== undefined
    ? Boolean(patchFields.isGradeChanged)
    : Boolean(cleanBase.isGradeChanged);

  let nextOriginalGradeId = cleanBase.originalGradeId || cleanBase.contestGradeId || nextGradeId;
  let nextOriginalGradeTitle =
    cleanBase.originalGradeTitle ||
    cleanBase.originalgradeTitle ||
    cleanBase.contestGradeTitle ||
    nextGradeTitle;

  if (isGp) {
    if (patchFields.originalGradeTitle !== undefined) {
      nextOriginalGradeTitle = String(patchFields.originalGradeTitle).trim();
    }
  } else if (layer === "assign" || !nextIsGradeChanged) {
    nextOriginalGradeId = nextGradeId;
    nextOriginalGradeTitle = nextGradeTitle;
  }

  const stableEntryId =
    cleanBase._entryId ||
    `ent_${cleanBase.playerUid || "m"}_${nextCategoryId || "c"}_${
      nextOriginalGradeId || nextGradeId || "g"
    }_${cleanBase.playerNumber ?? nextPlayerNumber}`;

  const patched = {
    ...cleanBase,
    _entryId: stableEntryId,
    playerNumber: nextPlayerNumber,
    playerIndex: nextPlayerIndex,
    playerName:
      patchFields.playerName !== undefined
        ? String(patchFields.playerName).trim()
        : cleanBase.playerName || "",
    playerGym:
      patchFields.playerGym !== undefined
        ? String(patchFields.playerGym).trim()
        : cleanBase.playerGym || "",
    playerTel:
      patchFields.playerTel !== undefined
        ? String(patchFields.playerTel).trim()
        : cleanBase.playerTel || "",
    playerBirth:
      patchFields.playerBirth !== undefined
        ? String(patchFields.playerBirth).trim()
        : cleanBase.playerBirth || "",
    playerText:
      patchFields.playerText !== undefined
        ? String(patchFields.playerText)
        : cleanBase.playerText || "",
    contestCategoryId: nextCategoryId,
    contestCategoryTitle: nextCategoryTitle,
    ...(nextCategorySection ? { contestCategorySection: nextCategorySection } : {}),
    contestGradeId: nextGradeId,
    contestGradeTitle: nextGradeTitle,
    originalGradeId: nextOriginalGradeId,
    originalGradeTitle: nextOriginalGradeTitle,
    ...(isGp ? { originalgradeTitle: nextOriginalGradeTitle } : {}),
    isGradeChanged: nextIsGradeChanged,
    ...(patchFields.playerNoShow !== undefined
      ? { playerNoShow: Boolean(patchFields.playerNoShow) }
      : {}),
  };

  if (layer !== "assign") {
    patched.heightWeight = nextHeightWeight;
    patched.playerHeight = nextHeight;
    patched.playerWeight = nextWeight;
    patched.height = nextHeight;
    patched.weight = nextWeight;
    if (
      patchFields.isWeighedIn !== undefined
    ) {
      patched.isWeighedIn = Boolean(patchFields.isWeighedIn);
    } else if ((nextHeight || nextWeight) && !patched.playerNoShow) {
      patched.isWeighedIn = Boolean(cleanBase.isWeighedIn ?? true);
    }
  }

  if (isGp) {
    const gpIdx =
      patchFields.grandPrixIndex !== undefined && patchFields.grandPrixIndex !== ""
        ? Number(patchFields.grandPrixIndex)
        : nextPlayerIndex;
    patched.grandPrixIndex = gpIdx;
    patched.playerIndex = gpIdx;
    patched.isCustomGrandPrixIndex = true;
    patched.isGradeChange = false;
    patched.isGradeChanged = false;
    patched.gpLayerSaved = true;
    patched.layer3Edited = true;
    patched.layer3EditedAt = nowIso;
  } else if (layer === "assign") {
    patched.assignEditedAt = nowIso;
  } else if (layer === "weighin") {
    patched.weighInEditedAt = nowIso;
  } else if (layer === "final") {
    patched.layer3Edited = true;
    patched.layer3EditedAt = nowIso;
  }

  return patched;
};

/**
 * 1단계(contest_players_assign) 단독 직접 수정 적용
 * - contest_players_assign 배열만 갱신하며 하위 레이어(2·3단계)는 건드리지 않음
 */
export const applyStage1AssignDirectEdit = (
  existingAssignPlayers = [],
  beforeSnapshot,
  patchFields,
  nowIso = new Date().toISOString()
) => {
  let matched = false;
  const nextPlayers = (existingAssignPlayers || []).map((p) => {
    if (!matched && isSameLayerPlayerEntry(p, beforeSnapshot)) {
      matched = true;
      return buildPatchedLayerPlayer(p, patchFields, {
        layer: "assign",
        nowIso,
      });
    }
    return stripTransientUiProps(p);
  });

  if (!matched && beforeSnapshot) {
    nextPlayers.push(
      buildPatchedLayerPlayer(beforeSnapshot, patchFields, {
        layer: "assign",
        nowIso,
      })
    );
  }

  return nextPlayers;
};

/**
 * 2단계(계측 레이어) 초기 로드 시 1단계 -> 2단계 단방향 승계 및 저장본 보존
 * - 이미 2단계 저장본(weighInPlayers)이 존재하면 2단계 저장값을 100% 우선 유지하고,
 *   1단계에서 사후 수정된 값으로 기존 2단계 저장 행을 덮어쓰지 않음!
 * - 단, 아직 2단계 저장본이 전혀 없을 때(최초 진입)는 1단계 수정값을 그대로 물고 들어옴!
 * - 레거시 호환: weighInPlayers 필드가 없던 기존 대회는 finalDoc.players(그랑프리 자동생성 제외)를
 *   2단계 저장본으로 인정하여 선수번호·이름·계측값 덮어쓰기를 방지함.
 */
export const hydrateWeighInLayerPlayers = ({
  assignPlayers = [],
  finalDocData = null,
}) => {
  const savedWeighIn = Array.isArray(finalDocData?.weighInPlayers)
    ? finalDocData.weighInPlayers
    : null;
  const legacyFinalRegular =
    !savedWeighIn && Array.isArray(finalDocData?.players) && finalDocData.players.length > 0
      ? finalDocData.players.filter((p) => p && !isAutoGrandPrixEntry(p))
      : null;

  const activeLayer2Saved =
    savedWeighIn && savedWeighIn.length > 0 ? savedWeighIn : legacyFinalRegular;

  // 2단계에 아직 저장된 데이터가 없으면 1단계(assignPlayers) 값을 그대로 승계!
  if (!activeLayer2Saved || activeLayer2Saved.length === 0) {
    return (assignPlayers || []).map((ap) => ({
      ...stripTransientUiProps(ap),
      originalGradeId: ap.originalGradeId || ap.contestGradeId,
      originalGradeTitle: ap.originalGradeTitle || ap.contestGradeTitle,
      isGradeChanged: Boolean(ap.isGradeChanged),
      playerNoShow: Boolean(ap.playerNoShow),
      isWeighedIn: Boolean(ap.isWeighedIn),
      heightWeight: ap.heightWeight || "",
    }));
  }

  // 이미 2단계 저장본이 있는 경우: 2단계 저장본을 절대 우선 보존하고,
  // 1단계에 '새로 추가된 미등록 엔트리'만 뒤에 병합 (기존 저장값 역전파 차단!)
  const result = activeLayer2Saved.map((wp) => ({
    ...stripTransientUiProps(wp),
    originalGradeId: wp.originalGradeId || wp.contestGradeId,
    originalGradeTitle: wp.originalGradeTitle || wp.contestGradeTitle,
    isGradeChanged: Boolean(wp.isGradeChanged),
    playerNoShow: Boolean(wp.playerNoShow),
    isWeighedIn: Boolean(wp.isWeighedIn),
    heightWeight: wp.heightWeight || "",
  }));

  (assignPlayers || []).forEach((ap) => {
    if (!ap) return;
    const alreadySavedInL2 = result.some((wp) => isSameLayerPlayerEntry(wp, ap));
    if (!alreadySavedInL2) {
      result.push({
        ...stripTransientUiProps(ap),
        originalGradeId: ap.originalGradeId || ap.contestGradeId,
        originalGradeTitle: ap.originalGradeTitle || ap.contestGradeTitle,
        isGradeChanged: Boolean(ap.isGradeChanged),
        playerNoShow: Boolean(ap.playerNoShow),
        isWeighedIn: Boolean(ap.isWeighedIn),
        heightWeight: ap.heightWeight || "",
      });
    }
  });

  return result;
};

/**
 * 2단계(weighInPlayers) 저장 시 3단계(contest_players_final.players)로의 조건부 단방향 승계
 * - 3단계에서 직접 수정된 행(layer3Edited === true)이나 그랑프리 저장 행(isGrandPrixEntryLike)은
 *   이미 3단계에서 확정된 데이터이므로 절대 덮어쓰지 않음!
 * - 아직 3단계에서 별도 수정하지 않은 일반 행은 2단계 수정/계측값이 자연스럽게 3단계로 승계됨!
 */
export const forwardWeighInToFinalPlayers = ({
  nextWeighInPlayers = [],
  existingFinalPlayers = [],
  beforeSnapshot = null,
}) => {
  const cleanWeighIn = (nextWeighInPlayers || []).filter(
    (p) => p && !isAutoGrandPrixEntry(p)
  );

  if (!Array.isArray(existingFinalPlayers) || existingFinalPlayers.length === 0) {
    return cleanWeighIn.map((wp) => stripTransientUiProps(wp));
  }

  const usedFinalIndices = new Set();

  const forwarded = cleanWeighIn.map((wp) => {
    const matchIdx = existingFinalPlayers.findIndex((fp, idx) => {
      if (usedFinalIndices.has(idx) || !fp || isGrandPrixEntryLike(fp)) {
        return false;
      }
      if (isSameLayerPlayerEntry(fp, wp)) return true;
      if (beforeSnapshot && isSameLayerPlayerEntry(wp, beforeSnapshot)) {
        return isSameLayerPlayerEntry(fp, beforeSnapshot);
      }
      if (beforeSnapshot && isSameLayerPlayerEntry(fp, beforeSnapshot)) {
        const wpAfterKey = getPlayerEntryKey(wp);
        const beforePatchKey = getPlayerEntryKey(beforeSnapshot);
        if (wp._entryId && beforeSnapshot._entryId && wp._entryId === beforeSnapshot._entryId) {
          return true;
        }
        if (wpAfterKey === beforePatchKey) return true;
      }
      return false;
    });

    if (matchIdx !== -1) {
      usedFinalIndices.add(matchIdx);
      const existingFp = existingFinalPlayers[matchIdx];
      // 🛡️ 핵심 규칙: 이미 3단계에서 직접 수정·저장된 항목은 2단계 수정값으로 덮어쓰지 않음!
      if (existingFp?.layer3Edited === true) {
        return stripTransientUiProps(existingFp);
      }
    }

    return stripTransientUiProps(wp);
  });

  // 기존 3단계 전용 항목(그랑프리 진출자, 3단계 현장 강제등록, 3단계 직접 수정 항목) 누락 없이 보존
  const forwardedEntryKeys = new Set(
    forwarded.map((p) => getPlayerEntryKey(p)).filter(Boolean)
  );
  const forwardedTupleKeys = new Set(
    forwarded.map((p) => getPlayerTupleKey(p)).filter(Boolean)
  );

  existingFinalPlayers.forEach((fp, idx) => {
    if (!fp || usedFinalIndices.has(idx)) return;
    // beforeSnapshot이 체급/번호 변경으로 치환된 경우 이전 잔상은 추가하지 않음 (단, layer3Edited 제외)
    if (
      beforeSnapshot &&
      !fp.layer3Edited &&
      !isGrandPrixEntryLike(fp) &&
      isSameLayerPlayerEntry(fp, beforeSnapshot)
    ) {
      return;
    }

    const isGp = isGrandPrixEntryLike(fp);
    const isForce = resolveEntryOrigin(fp) === "force";
    const isL3Edited = fp.layer3Edited === true;

    if (!isGp && !isForce && !isL3Edited) {
      return;
    }

    const eKey = getPlayerEntryKey(fp);
    const tKey = getPlayerTupleKey(fp);
    if ((eKey && forwardedEntryKeys.has(eKey)) || (tKey && forwardedTupleKeys.has(tKey))) {
      return;
    }
    if (eKey) forwardedEntryKeys.add(eKey);
    if (tKey) forwardedTupleKeys.add(tKey);
    forwarded.push(stripTransientUiProps(fp));
  });

  return forwarded;
};

/**
 * 3단계(최종 출전 / 그랑프리) 단독 직접 수정 적용
 * - contest_players_final.players 내 해당 엔트리만 핀셋 수정하며,
 *   1단계(contest_players_assign)나 2단계(weighInPlayers), 그리고 다른 체급/그랑프리 엔트리는 건드리지 않음!
 */
export const applyStage3FinalDirectEdit = (
  existingFinalPlayers = [],
  beforeSnapshot,
  patchFields,
  options = {}
) => {
  const isGrandPrix =
    Boolean(options.isGrandPrix) || isGrandPrixEntryLike(beforeSnapshot);
  const nowIso = options.nowIso || new Date().toISOString();
  const layerMode = isGrandPrix ? "grandprix" : "final";

  let matched = false;
  const nextPlayers = (existingFinalPlayers || []).map((fp) => {
    if (!matched && isSameLayerPlayerEntry(fp, beforeSnapshot)) {
      matched = true;
      return buildPatchedLayerPlayer(fp, patchFields, {
        layer: layerMode,
        nowIso,
      });
    }
    return stripTransientUiProps(fp);
  });

  if (!matched && beforeSnapshot) {
    nextPlayers.push(
      buildPatchedLayerPlayer(beforeSnapshot, patchFields, {
        layer: layerMode,
        nowIso,
      })
    );
  }

  return nextPlayers;
};
