"use client";

import { useContext, useEffect, useState, useRef } from "react";
import { TbHeartRateMonitor } from "react-icons/tb";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { useFirebaseRealtimeUpdateData } from "../hooks/useFirebaseRealtime";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const ContestRankingSummary = ({
  categoryId,
  gradeId,
  setClose,
  currentResultSaved,
  categoryJudgeType,
  stageId,
}) => {
  const [scoreData, setScoreData] = useState([]);
  const [summaryTable, setSummaryTable] = useState([]);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const modalContentRef = useRef(null);

  const { currentContest } = useContext(CurrentContestContext);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const scoreRankingQuery = useFirestoreQuery();
  const resultQuery = useFirestoreQuery();
  const resultDelete = useFirestoreDeleteData("contest_results_list");
  const resultAdd = useFirestoreAddData("contest_results_list");

  const realtimeResultStateUpdate = useFirebaseRealtimeUpdateData();

  const generateUniqueRandomNumbers = (min, max, count) => {
    const numbers = Array.from({ length: max - min + 1 }, (_, i) => i + min);

    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    return numbers.slice(0, count);
  };

  const calculateTotalScore = (scores) => {
    const sortedScores = [...scores].sort((a, b) => a - b);
    if (sortedScores.length <= 2) return 0;
    sortedScores.pop();
    sortedScores.shift();
    return sortedScores.reduce((acc, curr) => acc + curr, 0);
  };

  const assignMinMaxFlags = (group) => {
    const maxScore = Math.max(...group.score.map((s) => s.playerScore));
    const minScore = Math.min(...group.score.map((s) => s.playerScore));

    group.score.forEach((s) => {
      s.isMin = false;
      s.isMax = false;
    });

    if (maxScore === minScore) {
      group.score[0].isMin = true;
      group.score[1].isMax = true;
    } else {
      group.score.find((s) => s.playerScore === maxScore).isMax = true;
      group.score.find((s) => s.playerScore === minScore).isMin = true;
    }
  };

  const groupedByPlayerNumber = (arr, sortCriteria = "playerIndex") => {
    const groupedObj = arr.reduce((acc, curr) => {
      let group = acc.find((g) => g.playerNumber === curr.playerNumber);
      const scoreData = {
        seatIndex: curr.seatIndex,
        playerScore: curr.playerScore,
        randomIndex: generateUniqueRandomNumbers(11, 300, 1)[0],
        isMin: false,
        isMax: false,
      };

      if (!group) {
        group = {
          playerNumber: curr.playerNumber,
          playerIndex: curr.playerIndex,
          playerGym: curr.playerGym,
          playerName: curr.playerName,
          playerUid: curr.playerUid,
          score: [],
        };
        acc.push(group);
      }
      group.score.push(scoreData);
      return acc;
    }, []);

    groupedObj.forEach((group) => {
      assignMinMaxFlags(group);
      group.totalScore = calculateTotalScore(
        group.score.map((s) => s.playerScore)
      );
    });

    groupedObj.sort((a, b) =>
      sortCriteria === "totalScore"
        ? a.totalScore - b.totalScore
        : a.playerIndex - b.playerIndex
    );

    let rank = 0;
    let prevScore = null;
    let sameRankCount = 0;
    let isAlertSet = false;

    for (let i = 0; i < groupedObj.length; i++) {
      groupedObj[i].isAlert = false;

      if (groupedObj[i].totalScore > 1000) {
        groupedObj[i].playerRank = 1000;
      } else {
        if (prevScore === null || groupedObj[i].totalScore !== prevScore) {
          if (sameRankCount >= 1) {
            for (let j = 0; j <= sameRankCount; j++) {
              groupedObj[i - j - 1].isAlert = true;
            }
          }
          rank += sameRankCount + 1;
          sameRankCount = 0;
          isAlertSet = false;
        } else {
          sameRankCount++;
          groupedObj[i].isAlert = true;
        }
        groupedObj[i].playerRank = rank;
        prevScore = groupedObj[i].totalScore;
      }
    }

    if (sameRankCount >= 1) {
      for (let j = 0; j <= sameRankCount; j++) {
        groupedObj[groupedObj.length - 1 - j].isAlert = true;
      }
    }

    return groupedObj;
  };

  const groupByGrade = (arr, sortType) => {
    console.log(arr);
    return arr
      .reduce((acc, curr) => {
        let group = acc.find((g) => g.gradeId === curr.gradeId);

        if (!group) {
          group = {
            contestId: curr.contestId,
            categoryId: curr.categoryId,
            categoryTitle: curr.categoryTitle,
            scoreType: curr.categoryJudgeType,
            gradeId: curr.gradeId,
            gradeTitle: curr.gradeTitle,
            result: [],
          };
          acc.push(group);
        }

        return acc;
      }, [])
      .map((group) => {
        const gradeItems = arr.filter((item) => item.gradeId === group.gradeId);
        group.result = groupedByPlayerNumber(gradeItems, sortType);
        return group;
      });
  };

  const handleSummaryTable = (dataArray, e, summaryIndex, playerIndex) => {
    const newDataArray = [...dataArray];
    const newRankInfo = {
      ...newDataArray[playerIndex],
      playerRank: Number.parseInt(e.target.value),
    };
    newDataArray.splice(playerIndex, 1, newRankInfo);
    const newSummaryTable = [...summaryTable];
    newSummaryTable.splice(summaryIndex, 1, {
      ...newSummaryTable[summaryIndex],
      result: [...newDataArray],
    });

    setSummaryTable(() => [...newSummaryTable]);
  };

  const handleDeleteResult = async (contestId, gradeId) => {
    const condition = [
      where("contestId", "==", contestId),
      where("gradeId", "==", gradeId),
    ];

    try {
      const returnQuery = await resultQuery.getDocuments(
        "contest_results_list",
        condition
      );
      console.log(returnQuery);

      if (returnQuery?.length === 0) {
        return;
      }

      returnQuery.map(async (result, rIdx) => {
        const { id } = result;
        await resultDelete.deleteData(id).then((data) => console.log(data));
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleRealtimeUpdate = async (contestId, gradeId) => {
    const collectionInfo = `currentStage/${contestId}`;

    const newResultSaved = currentResultSaved ? [...currentResultSaved] : [];

    const gradeExists = newResultSaved.includes(gradeId);

    if (!gradeExists) {
      newResultSaved.push(gradeId);
    }

    await realtimeResultStateUpdate.updateData(collectionInfo, {
      resultSaved: newResultSaved,
    });

    console.log("Updated resultSaved array:", newResultSaved);
  };

  const handleUpdateStageAssign = async (stageAssignId) => {
    if (!stageAssignId) {
      return;
    }

    try {
    } catch (error) {}
  };

  const handleSaveResult = async (resultData) => {
    if (resultData?.length === 0) {
      return;
    }
    try {
      resultData.map(async (data, dIdx) => {
        const { contestId, gradeId } = data;

        await handleDeleteResult(contestId, gradeId);
        try {
          await resultAdd
            .addData({ ...data })
            .then((data) => console.log(data));
        } catch (error) {
          console.log(error);
        }
      });
    } catch (error) {
      console.log(error);
    } finally {
      await handleRealtimeUpdate(currentContest.contests.id, gradeId).then(
        () => {
          setMessage({
            body: "저장되었습니다.",
            body2: "확인 버튼을 누르시면 모니터링화면으로 돌아갑니다.",
            isButton: true,
            cancelButtonText: "되돌아가기",
            confirmButtonText: "확인",
          });
          setMsgOpen(true);
        }
      );
    }
  };

  const fetchScoreRank = async () => {
    const condition = [
      where("contestId", "==", currentContest.contests.id),
      where("categoryId", "==", categoryId),
      where("gradeId", "==", gradeId),
      where("categoryJudgeType", "==", "ranking"),
    ];

    try {
      await scoreRankingQuery
        .getDocuments(
          currentContest.contestInfo.contestCollectionName,
          condition
        )
        .then((data) => {
          if (data.length > 0) {
            setScoreData(data.sort((a, b) => a.seatIndex - b.seatIndex));
          }
        });
    } catch (error) {
      console.log(error);
    }
  };

  const hasDuplicateRanks = (resultArray) => {
    const ranks = resultArray
      .filter((player) => player.totalScore < 1000)
      .map((player) => player.playerRank);

    const rankSet = new Set(ranks);
    return ranks.length !== rankSet.size;
  };

  useEffect(() => {
    const checkOverflow = () => {
      if (modalContentRef.current) {
        const hasVerticalScrollbar =
          modalContentRef.current.scrollHeight >
          modalContentRef.current.clientHeight;
        setIsOverflowing(hasVerticalScrollbar);
      }
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);

    return () => {
      window.removeEventListener("resize", checkOverflow);
    };
  }, [summaryTable]);

  useEffect(() => {
    if (gradeId && currentContest?.contests?.id) {
      fetchScoreRank();
    }
  }, [gradeId, categoryId, currentContest]);

  useEffect(() => {
    if (scoreData?.length > 0) {
      console.log(groupByGrade(scoreData, "totalScore"));
      setSummaryTable(() => [...groupByGrade(scoreData, "totalScore")]);
    }
  }, [scoreData]);

  return (
    <div
      ref={modalContentRef}
      className="flex flex-col w-full h-full max-h-screen bg-gradient-to-br from-slate-50 to-slate-100 overflow-y-auto"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "#3b82f6 #e2e8f0",
      }}
    >
      <ConfirmationModal
        isOpen={msgOpen}
        message={message}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setClose(false)}
      />

      <div className="sticky top-0 z-10 bg-white shadow-md border-b border-slate-200 p-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
              <TbHeartRateMonitor className="text-xl" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              랭킹형 순위표
            </h1>
          </div>
          <button
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold shadow-lg hover:shadow-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:scale-105 active:scale-95"
            onClick={() => setClose()}
          >
            닫기
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {summaryTable?.length > 0 &&
          summaryTable.map((table, tIdx) => {
            const { categoryTitle, gradeTitle, result } = table;
            const hasDuplicates = hasDuplicateRanks(result);
            const duplicateRanks = result
              .filter((player) => player.totalScore < 1000)
              .map((player) => player.playerRank)
              .filter((rank, index, self) => self.indexOf(rank) !== index);

            return (
              <div key={tIdx} className="space-y-4">
                <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-xl shadow-md p-4">
                  <h2 className="text-lg font-semibold text-white">
                    {categoryTitle} ({gradeTitle})
                  </h2>
                </div>

                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="min-w-full">
                      <div className="flex bg-gradient-to-r from-slate-700 to-slate-800 text-white font-semibold sticky top-0 z-5">
                        <div className="flex-1 min-w-[100px] p-4 flex items-center justify-center border-r border-slate-600">
                          선수번호
                        </div>
                        <div className="flex-1 min-w-[100px] p-4 flex items-center justify-center border-r border-slate-600">
                          순위
                        </div>
                        {result[0]?.score?.length > 0 &&
                          result[0].score.map((score, sIdx) => {
                            const { seatIndex } = score;
                            return (
                              <div
                                className="flex-1 min-w-[100px] p-4 flex items-center justify-center border-r border-slate-600"
                                key={seatIndex}
                              >
                                심사 {seatIndex}
                              </div>
                            );
                          })}
                        <div className="flex-1 min-w-[100px] p-4 flex items-center justify-center">
                          기표합산
                        </div>
                      </div>

                      <div
                        className="max-h-[400px] overflow-y-auto"
                        style={{
                          scrollbarWidth: "thin",
                          scrollbarColor: "#3b82f6 #e2e8f0",
                        }}
                      >
                        {result?.length > 0 &&
                          result
                            .sort((a, b) => a.playerIndex - b.playerIndex)
                            .map((player, pIdx) => {
                              const {
                                playerNumber,
                                totalScore,
                                playerRank,
                                score,
                                isAlert,
                              } = player;
                              if (totalScore >= 1000) {
                                return null;
                              }
                              const isRankDuplicated =
                                duplicateRanks.includes(playerRank);

                              return (
                                <div
                                  key={playerNumber}
                                  className={
                                    isAlert
                                      ? "flex border-b border-slate-200 bg-gradient-to-r from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 transition-colors"
                                      : "flex border-b border-slate-200 hover:bg-slate-50 transition-colors"
                                  }
                                >
                                  <div className="flex-1 min-w-[100px] p-4 flex items-center justify-center font-semibold text-slate-700">
                                    {playerNumber}
                                  </div>
                                  <div className="flex-1 min-w-[100px] p-4 flex justify-center items-center">
                                    <div className="relative">
                                      <input
                                        type="number"
                                        name="playerRank"
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) =>
                                          handleSummaryTable(
                                            result,
                                            e,
                                            tIdx,
                                            pIdx
                                          )
                                        }
                                        className={
                                          isRankDuplicated
                                            ? "w-16 h-12 bg-white border-2 border-red-500 rounded-lg text-center outline-none focus:ring-2 focus:ring-red-500 font-semibold text-slate-800 shadow-md"
                                            : isAlert
                                            ? "w-16 h-12 bg-white border-2 border-amber-400 rounded-lg text-center outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-800 shadow-sm"
                                            : "w-16 h-12 bg-slate-50 border border-slate-300 rounded-lg text-center outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                                        }
                                        value={playerRank}
                                      />
                                      {isRankDuplicated && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md">
                                          !
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {score.map((score, sIdx) => {
                                    const {
                                      seatIndex,
                                      playerScore,
                                      isMin,
                                      isMax,
                                    } = score;
                                    return (
                                      <div
                                        className="flex-1 min-w-[100px] p-4 flex justify-center items-center"
                                        key={seatIndex}
                                      >
                                        {isMin && (
                                          <span className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow-md">
                                            {playerScore >= 100
                                              ? "제외"
                                              : playerScore}
                                          </span>
                                        )}
                                        {isMax && (
                                          <span className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold shadow-md">
                                            {playerScore >= 100
                                              ? "제외"
                                              : playerScore}
                                          </span>
                                        )}
                                        {!isMax && !isMin && (
                                          <span className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium">
                                            {playerScore >= 100
                                              ? "제외"
                                              : playerScore}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <div className="flex-1 min-w-[100px] p-4 flex items-center justify-center font-bold text-slate-800">
                                    {totalScore}
                                  </div>
                                </div>
                              );
                            })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 p-4 bg-white rounded-xl shadow-md border border-slate-200">
                  {hasDuplicates && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border-2 border-red-300 rounded-lg">
                      <span className="text-red-700  flex items-center">
                        <div className="flex-shrink-0 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-5">
                          !
                        </div>
                        동점자가 있습니다. 순위를 수정한 후 확정해주세요.
                      </span>
                    </div>
                  )}
                  <div className="flex justify-end gap-3">
                    <button
                      className={
                        hasDuplicates
                          ? "px-8 py-3 rounded-lg bg-gray-400 text-gray-200 font-bold text-lg shadow-md cursor-not-allowed"
                          : "px-8 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 active:scale-95"
                      }
                      onClick={() =>
                        !hasDuplicates && handleSaveResult(summaryTable)
                      }
                      disabled={hasDuplicates}
                    >
                      순위표 확정
                    </button>
                    {hasDuplicates && (
                      <button
                        className="px-8 py-3 rounded-lg bg-slate-400 text-white font-bold text-lg shadow-md hover:bg-slate-500 hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 opacity-70 hover:opacity-90"
                        onClick={() => handleSaveResult(summaryTable)}
                      >
                        강제등록
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {isOverflowing && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold animate-bounce">
          ↓ 스크롤하여 더 보기 ↓
        </div>
      )}
    </div>
  );
};

export default ContestRankingSummary;
