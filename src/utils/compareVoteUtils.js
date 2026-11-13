/**
 * 비교심사(Compare) 이력 및 실시간 상태 관리 순수 유틸리티
 * - 특정 무대(stageId)의 비교심사 차수 취소 시 다른 무대의 비교심사 이력이
 *   절대 유실되지 않도록 전체 compares 배열에서 해당 항목만 정확히 제거합니다.
 */

export const removeStageCompareByLocalIndex = (
  allCompares = [],
  stageId,
  localStageCompareIndex
) => {
  if (!Array.isArray(allCompares) || !stageId) {
    return {
      nextAllCompares: Array.isArray(allCompares) ? [...allCompares] : [],
      nextStageCompares: [],
    };
  }

  let currentStageMatchIdx = -1;
  const nextAllCompares = [];
  const nextStageCompares = [];

  allCompares.forEach((item) => {
    if (item?.stageId === stageId) {
      currentStageMatchIdx += 1;
      if (currentStageMatchIdx === localStageCompareIndex) {
        return; // 취소 대상 차수만 제거
      }
      nextStageCompares.push(item);
    }
    nextAllCompares.push(item);
  });

  return {
    nextAllCompares,
    nextStageCompares,
  };
};

export const buildRealtimeCompareAfterCancel = (remainingStageCompares = []) => {
  if (
    !Array.isArray(remainingStageCompares) ||
    remainingStageCompares.length === 0
  ) {
    return {
      compareIndex: null,
      status: {
        compareStart: false,
        compareEnd: false,
        compareCancel: false,
        compareIng: false,
      },
      playerLength: null,
      scoreMode: null,
      players: [],
      confirmed: { count: 0, numbers: [] },
      judges: [],
    };
  }

  const prev = remainingStageCompares[remainingStageCompares.length - 1];
  const restoredPlayers = Array.isArray(prev?.players) ? [...prev.players] : [];
  return {
    stageId: prev.stageId || null,
    compareIndex: prev.compareIndex,
    status: {
      compareStart: false,
      compareEnd: false,
      compareCancel: false,
      compareIng: true,
    },
    playerLength: prev.comparePlayerLength ?? restoredPlayers.length,
    scoreMode: prev.compareScoreMode || "compare",
    players: restoredPlayers,
    confirmed: {
      count: restoredPlayers.length,
      numbers: restoredPlayers
        .map((p) => Number(p?.playerNumber))
        .filter((n) => Number.isFinite(n)),
    },
  };
};
