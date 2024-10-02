import React, { useContext, useEffect, useState } from "react";
import { TbHeartRateMonitor } from "react-icons/tb";
import { useLocation } from "react-router-dom";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
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

    // 무작위로 배열 섞기 (Fisher-Yates shuffle 알고리즘)
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    return numbers.slice(0, count);
  };

  const calculateTotalScore = (scores) => {
    const sortedScores = [...scores].sort((a, b) => a - b);
    if (sortedScores.length <= 2) return 0;
    sortedScores.pop(); // Remove max
    sortedScores.shift(); // Remove min
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

    // Sorting
    groupedObj.sort((a, b) =>
      sortCriteria === "totalScore"
        ? a.totalScore - b.totalScore
        : a.playerIndex - b.playerIndex
    );

    // Assign rankings
    let rank = 0; // Start from rank 1
    let prevScore = null; // To keep track of previous score
    let sameRankCount = 0; // To keep track of how many players have the same rank
    let isAlertSet = false; // Track if alert has been set for the group

    for (let i = 0; i < groupedObj.length; i++) {
      groupedObj[i].isAlert = false; // Initially set isAlert to false for every player

      if (groupedObj[i].totalScore > 1000) {
        groupedObj[i].playerRank = 1000; // Set rank to 1000 for players with totalScore > 1000
      } else {
        if (prevScore === null || groupedObj[i].totalScore !== prevScore) {
          if (sameRankCount >= 1) {
            // Loop back and set isAlert for previous players with the same rank
            for (let j = 0; j <= sameRankCount; j++) {
              groupedObj[i - j - 1].isAlert = true;
            }
          }
          rank += sameRankCount + 1; // Increment rank by the number of players with the same rank
          sameRankCount = 0; // Reset the count
          isAlertSet = false; // Reset alert flag for new score group
        } else {
          sameRankCount++;
          groupedObj[i].isAlert = true; // If current score is the same as previous, set isAlert to true for all
        }
        groupedObj[i].playerRank = rank;
        prevScore = groupedObj[i].totalScore;
      }
    }

    // 마지막으로, 같은 순위의 선수들이 남아있다면 alert를 설정
    if (sameRankCount >= 1) {
      for (let j = 0; j <= sameRankCount; j++) {
        groupedObj[groupedObj.length - 1 - j].isAlert = true;
      }
    }

    return groupedObj;
  };

  const groupByGrade = (arr, sortType) => {
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
    // if (!/^[0-9]+$/.test(e.target.value)) {
    //   return;
    // }

    const newDataArray = [...dataArray];
    const newRankInfo = {
      ...newDataArray[playerIndex],
      playerRank: parseInt(e.target.value),
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

    // currentResultSaved가 undefined이면 빈 배열로 초기화
    const newResultSaved = currentResultSaved ? [...currentResultSaved] : [];

    // newResultSaved 배열에 gradeId가 있는지 확인
    const gradeExists = newResultSaved.includes(gradeId);

    if (!gradeExists) {
      // gradeId가 없다면 추가
      newResultSaved.push(gradeId);
    }

    // 업데이트 후 Firebase Realtime Database에 저장
    await realtimeResultStateUpdate.updateData(collectionInfo, {
      resultSaved: newResultSaved, // resultSaved에 배열을 저장
    });

    console.log("Updated resultSaved array:", newResultSaved);
  };

  // 만들다가 그만둔 이유는 굳이 여기서 한번에 처리하지 않고 본부석 화면에서 다음으로 넘길때 업데이트 해도 무방하다고 판단함
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
    const condidtion = [
      where("contestId", "==", currentContest.contests.id),
      where("categoryId", "==", categoryId),
      where("gradeId", "==", gradeId),
      where("categoryJudgeType", "==", "ranking"),
    ];

    try {
      await scoreRankingQuery
        .getDocuments(
          currentContest.contestInfo.contestCollectionName,
          condidtion
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
    <div className="flex flex-col w-full h-full bg-white p-3 gap-y-2 justify-start items-start">
      <ConfirmationModal
        isOpen={msgOpen}
        message={message}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setClose(false)}
      />
      <div className="flex w-full h-14">
        <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
          <div className="flex w-1/2 justify-start">
            <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
              <TbHeartRateMonitor />
            </span>
            <h1
              className="font-sans text-lg font-semibold"
              style={{ letterSpacing: "2px" }}
            >
              랭킹형 순위표
            </h1>
          </div>
          <div className="flex w-1/2 justify-end">
            <button
              className="w-20 h-10 rounded-lg bg-red-500 text-gray-100 flex justify-center items-center"
              onClick={() => setClose()}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
      {summaryTable?.length > 0 &&
        summaryTable.map((table, tIdx) => {
          const { categoryTitle, gradeTitle, result } = table;

          return (
            <>
              <div className="flex w-full h-auto">
                <div className="flex w-full h-10 bg-gray-100 justify-start items-center rounded-lg px-3">
                  <div className="flex w-full h-full justify-start ml-5 items-center">
                    {categoryTitle}({gradeTitle})
                  </div>
                </div>
              </div>
              <div className="flex w-full h-auto">
                <div className="flex w-full h-[400px] bg-gray-100 justify-start items-center rounded-lg p-3 overflow-y-auto">
                  <div className="flex w-full h-full justify-center items-center bg-red-200">
                    <div className="flex bg-white w-full h-auto p-2">
                      <div className="flex w-full flex-col px-5 py-2 border">
                        <div className="flex w-full border-b-2 border-b-gray-600">
                          <div className="flex w-full justify-center items-center p-2">
                            선수번호
                          </div>
                          <div className="flex w-full justify-center items-center p-2">
                            순위
                          </div>
                          {result[0]?.score?.length > 0 &&
                            result[0].score.map((score, sIdx) => {
                              const { seatIndex } = score;
                              return (
                                <div
                                  className="flex w-full justify-center items-center p-2"
                                  key={seatIndex}
                                >
                                  {seatIndex}
                                </div>
                              );
                            })}
                          <div className="flex w-full justify-center items-center p-2">
                            기표합산
                          </div>
                        </div>

                        {/* 선수 리스트 */}
                        <div className="flex w-full flex-col h-[300px] overflow-y-auto">
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
                                return (
                                  <div
                                    key={playerNumber}
                                    className={
                                      isAlert
                                        ? "flex w-full border-b border-b-gray-300 bg-blue-200 b"
                                        : "flex w-full border-b border-b-gray-300"
                                    }
                                  >
                                    <div className="flex w-full justify-center items-center p-2">
                                      {playerNumber}
                                    </div>
                                    <div className="flex w-full justify-center items-center p-2 bg-transparent">
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
                                          isAlert
                                            ? "w-10 h-10 bg-transparent border border-blue-400 rounded-lg text-center outline-none"
                                            : "w-10 h-10 bg-transparent text-center"
                                        }
                                        value={playerRank}
                                      />
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
                                          className="flex w-full justify-center items-center p-2"
                                          key={seatIndex}
                                        >
                                          {isMin && (
                                            <span className="w-auto h-auto p-3 px-5 rounded-lg bg-blue-400">
                                              {playerScore >= 100
                                                ? "제외"
                                                : playerScore}
                                            </span>
                                          )}
                                          {isMax && (
                                            <span className="w-auto h-auto p-3 px-5 rounded-lg bg-red-500">
                                              {playerScore >= 100
                                                ? "제외"
                                                : playerScore}
                                            </span>
                                          )}
                                          {!isMax && !isMin && (
                                            <span className="w-auto h-auto p-3 rounded-lg ">
                                              {playerScore >= 100
                                                ? "제외"
                                                : playerScore}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                    <div className="flex w-full justify-center items-center p-2">
                                      {totalScore}
                                    </div>
                                  </div>
                                );
                              })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex w-full h-auto">
                <div className="flex w-full h-20 bg-gray-100 justify-start items-center rounded-lg px-3">
                  <div className="flex w-full h-full justify-end ml-5 items-center px-2">
                    <button
                      className="w-auto h-auto px-5 py-2 bg-blue-800 text-gray-100 rounded-lg"
                      onClick={() => handleSaveResult(summaryTable)}
                    >
                      순위표확정
                    </button>
                  </div>
                </div>
              </div>
            </>
          );
        })}
    </div>
  );
};

export default ContestRankingSummary;
