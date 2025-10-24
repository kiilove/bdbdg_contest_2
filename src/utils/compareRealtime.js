/**
 * compareRealtime.js
 * 비교심사와 일반심사에서 공통으로 사용하는 실시간 데이터 처리 유틸
 */

// ================== 기존 로직 (예전부터 사용하던 함수) ==================

// 비교심사 시작
export const startCompare = async (
  updateRealtimeCompare,
  contestId,
  compareInfo
) => {
  const path = `currentStage/${contestId}/compares`;
  await updateRealtimeCompare.updateData(path, compareInfo);
};

// 비교심사 확정
export const confirmCompare = async (
  updateRealtimeCompare,
  contestId,
  compareInfo
) => {
  const path = `currentStage/${contestId}/compares`;
  await updateRealtimeCompare.updateData(path, compareInfo);
};

// 비교심사 취소
export const cancelCompare = async (updateRealtimeCompare, contestId) => {
  const path = `currentStage/${contestId}/compares`;
  await updateRealtimeCompare.updateData(path, {
    status: {
      compareStart: false,
      compareEnd: false,
      compareCancel: true,
      compareIng: false,
    },
  });
};

// 투표수 집계 (기존 기본 집계 로직)
export const countVotes = (votes = []) => {
  const map = {};
  votes.forEach((vote) => {
    const key = `${vote.playerNumber}-${vote.playerUid}`;
    if (!map[key]) {
      map[key] = { ...vote, votedCount: 0 };
    }
    map[key].votedCount += 1;
  });
  return Object.values(map);
};

// TOP N 추출 (기존 pickTop)
export const pickTop = (players = [], length = 0) => {
  if (!players || players.length === 0) return [];
  const sorted = [...players].sort((a, b) => b.votedCount - a.votedCount);
  return sorted.slice(0, length);
};

// 좌석 정보 만들기 (기존 유틸)
export const toSeatArray = (judges = []) =>
  judges.map((j) => ({
    seatIndex: j.seatIndex,
    messageStatus: j.messageStatus || "확인전",
  }));

export const toPlayerKey = (p) => `${p.playerNumber}-${p.playerUid}`;
export const toInt = (val) => parseInt(val, 10) || 0;

export const uniqPlayers = (arr = []) => {
  const seen = new Set();
  return arr.filter((p) => {
    const key = toPlayerKey(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ================== 새로 추가된 공통 함수 ==================

/**
 * 현재 무대 / 심판 / 선수 정보를 실시간 DB에 저장
 */
export const updateRealtimeCurrentStageInfo = async (
  updateRealtimeCompare,
  contestId,
  { stageInfo, judges = [], players = [] }
) => {
  if (!contestId) return;
  const path = `currentStage/${contestId}`;
  try {
    await updateRealtimeCompare.updateData(path, {
      stage: {
        categoryId: stageInfo?.categoryId,
        categoryTitle: stageInfo?.categoryTitle,
        gradeId: stageInfo?.grades?.[0]?.gradeId,
        gradeTitle: stageInfo?.grades?.[0]?.gradeTitle,
      },
      judges: judges.map((j) => ({
        seatIndex: j.seatIndex,
        judgeId: j.judgeId || null,
        name: j.name || null,
      })),
      players: players.map((p) => ({
        playerNumber: p.playerNumber,
        playerUid: p.playerUid,
        name: p.name || null,
      })),
    });
  } catch (error) {
    console.error("Error updating realtime current stage info:", error);
  }
};

/**
 * 득표 수 집계 (비교심사용)
 */
export const countPlayerVotes = (data = []) => {
  const voteCounts = {};
  data.forEach((entry) => {
    if (
      entry.votedPlayerNumber &&
      Array.isArray(entry.votedPlayerNumber) &&
      entry.votedPlayerNumber.length > 0
    ) {
      entry.votedPlayerNumber.forEach((vote) => {
        const key = `${vote.playerNumber}-${vote.playerUid}`;
        if (!voteCounts[key]) {
          voteCounts[key] = {
            playerNumber: vote.playerNumber,
            playerUid: vote.playerUid,
            votedCount: 0,
          };
        }
        voteCounts[key].votedCount += 1;
      });
    }
  });
  return Object.values(voteCounts);
};

/**
 * TOP N 선수 추출 (동점자 포함)
 */
export const getTopPlayers = (players = [], playerLength = 0) => {
  if (!players || players.length === 0) return [];

  const sortedPlayers = [...players].sort(
    (a, b) => b.votedCount - a.votedCount
  );
  let topPlayers = sortedPlayers.slice(0, playerLength);

  const lastVotedCount = topPlayers[topPlayers.length - 1]?.votedCount;
  let i = playerLength;
  while (sortedPlayers[i] && sortedPlayers[i].votedCount === lastVotedCount) {
    topPlayers.push(sortedPlayers[i]);
    i++;
  }

  return topPlayers;
};

/**
 * [위원장 직권] 임시 명단 확정
 */
export const forceConfirmPlayers = async ({
  updateRealtimeCompare,
  updateCompare,
  realtimeData,
  compareArray,
  compareList,
  contestId,
  stageInfo,
  propCompareIndex,
  votedInfo,
  votedResult,
  setCompareArray,
  setCompareList,
  setRefresh,
  setClose,
}) => {
  try {
    const topResult = getTopPlayers(votedResult, votedInfo.playerLength);

    const compareInfo = {
      contestId,
      categoryId: stageInfo.categoryId,
      gradeId: stageInfo.grades[0].gradeId,
      categoryTitle: stageInfo.categoryTitle,
      gradeTitle: stageInfo.grades[0].gradeTitle,
      compareIndex: propCompareIndex,
      comparePlayerLength: parseInt(votedInfo.playerLength),
      compareScoreMode: votedInfo.scoreMode,
      players: [...topResult],
      votedResult: [...votedResult],
    };

    const path = `currentStage/${contestId}/compares`;
    const newStatus = {
      compareStart: false,
      compareEnd: false,
      compareCancel: false,
      compareIng: true,
    };
    const newCompares = [...compareArray, compareInfo];

    await updateRealtimeCompare.updateData(path, {
      ...realtimeData.compares,
      status: { ...newStatus },
      players: [...topResult],
    });

    await updateCompare.updateData(compareList.id, {
      ...compareList,
      compares: [...newCompares],
    });

    setCompareArray(newCompares);
    setCompareList({ ...compareList, compares: newCompares });
    setRefresh(true);
    setClose(false);
  } catch (err) {
    console.error("Error force confirming players:", err);
  }
};

/**
 * [정상] 투표 완료 후 명단 확정
 */
export const confirmPlayers = async ({
  updateRealtimeCompare,
  updateCompare,
  realtimeData,
  compareArray,
  compareList,
  contestId,
  stageInfo,
  propCompareIndex,
  votedInfo,
  topResult,
  votedResult,
  setCompareArray,
  setCompareList,
  setRefresh,
  setClose,
}) => {
  try {
    const compareInfo = {
      contestId,
      categoryId: stageInfo.categoryId,
      gradeId: stageInfo.grades[0].gradeId,
      categoryTitle: stageInfo.categoryTitle,
      gradeTitle: stageInfo.grades[0].gradeTitle,
      compareIndex: propCompareIndex,
      comparePlayerLength: parseInt(votedInfo.playerLength),
      compareScoreMode: votedInfo.scoreMode,
      players: [...topResult],
      votedResult: [...votedResult],
    };

    const path = `currentStage/${contestId}/compares`;
    const newStatus = {
      compareStart: false,
      compareEnd: false,
      compareCancel: false,
      compareIng: true,
    };
    const newCompares = [...compareArray, compareInfo];

    await updateRealtimeCompare.updateData(path, {
      ...realtimeData.compares,
      status: { ...newStatus },
      players: [...topResult],
    });

    await updateCompare.updateData(compareList.id, {
      ...compareList,
      compares: [...newCompares],
    });

    setCompareArray(newCompares);
    setCompareList({ ...compareList, compares: newCompares });
    setRefresh(true);
    setClose(false);
  } catch (err) {
    console.error("Error confirming players:", err);
  }
};
