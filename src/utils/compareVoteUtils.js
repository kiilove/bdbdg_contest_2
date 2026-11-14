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

export const getComparePlayerKey = (player) => {
  if (!player) return "";
  const num = player.playerNumber !== undefined && player.playerNumber !== null
    ? String(player.playerNumber)
    : "";
  const uid = player.playerUid ? String(player.playerUid) : "";
  return uid ? `${uid}::${num}` : `num::${num}`;
};

export const buildAuthorityComparePlayers = (
  candidatePlayers = [],
  selectedKeys = [],
  votedResult = []
) => {
  if (!Array.isArray(candidatePlayers) || !Array.isArray(selectedKeys)) {
    return [];
  }

  const keySet = new Set(selectedKeys.filter(Boolean));
  if (keySet.size === 0) return [];

  const votesList = Array.isArray(votedResult) ? votedResult : [];

  return candidatePlayers
    .filter((player) => keySet.has(getComparePlayerKey(player)))
    .map((player) => {
      const matchedVotes = votesList
        .filter((v) =>
          player?.playerUid && v?.playerUid
            ? v.playerUid === player.playerUid &&
              String(v.playerNumber) === String(player.playerNumber)
            : String(v?.playerNumber) === String(player?.playerNumber)
        )
        .reduce((sum, item) => sum + Number(item?.votedCount || 0), 0);

      const entry = {
        playerNumber: player.playerNumber,
        playerUid: player.playerUid || "",
        votedCount: matchedVotes,
      };
      if (player.playerName) {
        entry.playerName = String(player.playerName);
      }
      if (player.playerGym) {
        entry.playerGym = String(player.playerGym);
      }
      return entry;
    })
    .sort((a, b) => Number(a.playerNumber || 0) - Number(b.playerNumber || 0));
};

export const extractTieBreakGroupsFromResult = (
  resultArray = [],
  gradeId = ""
) => {
  if (!Array.isArray(resultArray) || resultArray.length === 0) {
    return [];
  }

  const hasMissing = resultArray.some((p) =>
    Array.isArray(p?.score) ? p.score.some((s) => s?.isMissing) : false
  );
  if (hasMissing) {
    return [];
  }

  const validScored = resultArray.filter(
    (p) =>
      p &&
      Number(p.totalScore) < 1000 &&
      typeof p.playerRank === "number" &&
      Number.isInteger(p.playerRank) &&
      p.playerRank >= 1 &&
      p.playerRank < 1000
  );

  const rankBucketMap = new Map();
  validScored.forEach((p) => {
    const rk = p.playerRank;
    if (!rankBucketMap.has(rk)) {
      rankBucketMap.set(rk, []);
    }
    rankBucketMap.get(rk).push(p);
  });

  const groups = [];
  const sortedRanks = Array.from(rankBucketMap.keys()).sort((a, b) => a - b);

  sortedRanks.forEach((startRank) => {
    const bucket = rankBucketMap.get(startRank) || [];
    if (bucket.length < 2) return;

    const sortedBucket = [...bucket].sort(
      (a, b) =>
        (Number(a.playerIndex) || Number(a.playerNumber) || 0) -
        (Number(b.playerIndex) || Number(b.playerNumber) || 0)
    );
    const count = sortedBucket.length;
    const endRank = startRank + count - 1;
    const rankRange = Array.from({ length: count }, (_, idx) => startRank + idx);

    const tiedBibSet = new Set(
      sortedBucket.map((p) => String(p.playerNumber))
    );

    const tiedPlayers = sortedBucket.map((p) => {
      const entry = {
        playerNumber: p.playerNumber,
        playerUid: String(p.playerUid || ""),
        playerIndex: Number(p.playerIndex || p.playerNumber || 0),
        votedCount: 0,
      };
      if (gradeId) entry.contestGradeId = String(gradeId);
      if (p.playerName) entry.playerName = String(p.playerName);
      if (p.playerGym) entry.playerGym = String(p.playerGym);
      return entry;
    });

    const lockedPlayers = resultArray
      .filter((p) => p && !tiedBibSet.has(String(p.playerNumber)))
      .map((p) => {
        const rawRank = Number(p.playerRank);
        const lockedRank =
          Number(p.totalScore) >= 1000 ||
          !Number.isFinite(rawRank) ||
          rawRank < 1
            ? 1000
            : rawRank;
        return {
          playerNumber: p.playerNumber,
          playerUid: String(p.playerUid || ""),
          lockedRank,
        };
      });

    groups.push({
      startRank,
      endRank,
      count,
      rankRange,
      tiedPlayers,
      lockedPlayers,
    });
  });

  return groups;
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
        isTieBreak: false,
      },
      playerLength: null,
      scoreMode: null,
      tieBreakGradeId: null,
      tieBreakGradeTitle: null,
      tieBreakStartRank: null,
      tieBreakEndRank: null,
      players: [],
      lockedPlayers: [],
      confirmed: { count: 0, numbers: [] },
      judges: [],
    };
  }

  const prev = remainingStageCompares[remainingStageCompares.length - 1];
  const beforePrev =
    remainingStageCompares.length >= 2
      ? remainingStageCompares[remainingStageCompares.length - 2]
      : null;
  const restoredPlayers = Array.isArray(prev?.players) ? [...prev.players] : [];
  const restoredPrevPlayers = Array.isArray(beforePrev?.players)
    ? [...beforePrev.players]
    : [];
  const isPrevTieBreak = prev?.compareScoreMode === "tieBreak";

  return {
    stageId: prev.stageId || null,
    compareIndex: prev.compareIndex,
    status: {
      compareStart: false,
      compareEnd: false,
      compareCancel: false,
      compareIng: true,
      isTieBreak: isPrevTieBreak,
    },
    playerLength: prev.comparePlayerLength ?? restoredPlayers.length,
    scoreMode: prev.compareScoreMode || "compare",
    tieBreakGradeId: isPrevTieBreak ? prev.gradeId || null : null,
    tieBreakGradeTitle: isPrevTieBreak ? prev.gradeTitle || null : null,
    tieBreakStartRank: isPrevTieBreak ? Number(prev.tieBreakStartRank || 1) : null,
    tieBreakEndRank: isPrevTieBreak
      ? Number(prev.tieBreakEndRank || restoredPlayers.length)
      : null,
    players: restoredPlayers,
    prevPlayers: restoredPrevPlayers,
    lockedPlayers:
      isPrevTieBreak && Array.isArray(prev.lockedPlayers)
        ? [...prev.lockedPlayers]
        : [],
    confirmed: {
      count: restoredPlayers.length,
      numbers: restoredPlayers
        .map((p) => Number(p?.playerNumber))
        .filter((n) => Number.isFinite(n)),
    },
  };
};
