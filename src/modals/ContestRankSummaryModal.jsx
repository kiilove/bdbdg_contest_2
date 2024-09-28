import React, { useContext, useEffect, useState } from "react";
import { TbHeartRateMonitor } from "react-icons/tb";
import { useLocation } from "react-router-dom";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";
const randomTitle = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const ContestRankSummaryModal = ({
  categoryId,
  gradeId,
  tableType,
  setClose,
}) => {
  const [basicInfo, setBasicInfo] = useState({});
  const [scoreData, setScoreData] = useState([]);
  const [summaryTable, setSummaryTable] = useState([]);
  const [rankTable, setRankTable] = useState([]);
  const location = useLocation();
  const { currentContest } = useContext(CurrentContestContext);

  const scoreRankQuery = useFirestoreQuery();

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
        } else {
          sameRankCount++;
          groupedObj[i].isAlert = true; // If current score is the same as previous, set isAlert to true
        }
        groupedObj[i].playerRank = rank;
        prevScore = groupedObj[i].totalScore;
      }
    }

    // Check after the loop to ensure the last set of players with the same rank also get the alert
    if (sameRankCount >= 1) {
      for (let j = 0; j <= sameRankCount; j++) {
        groupedObj[groupedObj.length - 1 - j].isAlert = true;
      }
    }

    console.log(groupedObj);
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

  const handleSummaryTable = (dataArray, e) => {
    console.log(dataArray);
  };

  const fetchScoreRank = async () => {
    const condidtion = [
      where("contestId", "==", currentContest.contests.id),
      where("categoryId", "==", basicInfo.categoryId),
      where("gradeId", "==", basicInfo.gradeId),
    ];

    try {
      await scoreRankQuery
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

    console.log(scoreData);
    console.log(groupByGrade(scoreData));
  };

  useEffect(() => {
    setBasicInfo({ categoryId, gradeId, tableType });
  }, []);

  useEffect(() => {
    console.log(basicInfo);
    if (basicInfo.gradeId && currentContest?.contests?.id) {
      fetchScoreRank();
    }
  }, [basicInfo, currentContest]);

  useEffect(() => {
    if (scoreData?.length > 0) {
      setSummaryTable(() => [...groupByGrade(scoreData, "totalScore")]);
      setRankTable(() => [...groupByGrade(scoreData, "totalScore")]);
    }
  }, [scoreData]);

  const ScoreTable = ({ data }) => {
    return (
      <div className="flex w-full flex-col px-5 py-2border">
        <div className="flex w-full border-b-2 border-b-gray-600">
          <div className="flex w-full justify-center items-center p-2">
            선수번호
          </div>
          <div className="flex w-full justify-center items-center p-2">
            순위
          </div>
          {data[0].score.map((score, sIdx) => {
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
        {data
          .sort((a, b) => a.playerIndex - b.playerIndex)
          .map((player, pIdx) => {
            const { playerNumber, totalScore, playerRank, score, isAlert } =
              player;
            if (totalScore >= 1000) {
              return null;
            }
            return (
              <div
                key={playerNumber}
                className={
                  isAlert
                    ? "flex w-full border-b border-b-gray-300 bg-blue-200"
                    : "flex w-full border-b border-b-gray-300"
                }
              >
                <div className="flex w-full justify-center items-center p-2">
                  {playerNumber}
                </div>
                <div className="flex w-full justify-center items-center p-2 bg-transparent">
                  {playerRank}
                  {isAlert && (
                    <button
                      className="flex w-10 h-10 bg-blue-800 justify-center items-center "
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log("first");
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
                {score.map((score, sIdx) => {
                  const { seatIndex, playerScore, isMin, isMax } = score;
                  return (
                    <div
                      className="flex w-full justify-center items-center p-2"
                      key={seatIndex}
                    >
                      {isMin && (
                        <span className="w-auto h-auto p-3 px-5 rounded-lg bg-blue-400">
                          {playerScore >= 1000 ? "제외" : playerScore}
                        </span>
                      )}
                      {isMax && (
                        <span className="w-auto h-auto p-3 px-5 rounded-lg bg-red-500">
                          {playerScore >= 1000 ? "제외" : playerScore}
                        </span>
                      )}
                      {!isMax && !isMin && (
                        <span className="w-auto h-auto p-3 rounded-lg ">
                          {playerScore >= 1000 ? "제외" : playerScore}
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
    );
  };
  const RankTable = ({ data }) => {
    return (
      <div className="flex w-full flex-col px-5 py-2border">
        <div className="flex w-full border-b-2 border-b-gray-600">
          <div className="flex w-full justify-center items-center p-2">
            선수번호
          </div>
          <div className="flex w-full justify-center items-center p-2">
            순위
          </div>
          {data[0].score.map((score, sIdx) => {
            return (
              <div
                className="flex w-full justify-center items-center p-2"
                key={sIdx}
              >
                {randomTitle[sIdx]}
              </div>
            );
          })}

          <div className="flex w-full justify-center items-center p-2">
            기표합산
          </div>
        </div>
        {data
          .sort((a, b) => a.playerRank - b.playerRank)

          .map((player, pIdx) => {
            const { playerNumber, totalScore, playerRank, score } = player;
            if (totalScore >= 1000) {
              return null;
            }
            return (
              <div
                key={playerNumber}
                className="flex w-full border-b border-b-gray-300"
              >
                <div className="flex w-full justify-center items-center p-2">
                  {playerNumber}
                </div>
                <div className="flex w-full justify-center items-center p-2">
                  {playerRank}
                </div>
                {score
                  .sort((a, b) => a.randomIndex - b.randomIndex)
                  .map((score, sIdx) => {
                    const { seatIndex, playerScore, isMin, isMax } = score;
                    return (
                      <div
                        className="flex w-full justify-center items-center p-2"
                        key={seatIndex}
                      >
                        {isMin && (
                          <span className="w-auto h-auto p-3 px-5 rounded-lg bg-blue-400">
                            {playerScore >= 1000 ? "제외" : playerScore}
                          </span>
                        )}
                        {isMax && (
                          <span className="w-auto h-auto p-3 px-5 rounded-lg bg-red-500">
                            {playerScore >= 1000 ? "제외" : playerScore}
                          </span>
                        )}
                        {!isMax && !isMin && (
                          <span className="w-auto h-auto p-3 rounded-lg ">
                            {playerScore >= 1000 ? "제외" : playerScore}
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
    );
  };

  return (
    <div className="flex flex-col w-full h-full bg-white p-3 gap-y-2 justify-start items-start">
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
              {basicInfo?.tableType === "summaryboard" ? "집계표" : "순위표"}
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
      {basicInfo?.tableType === "summaryboard" &&
        summaryTable?.length > 0 &&
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
                <div className="flex w-full h-auto bg-gray-100 justify-start items-center rounded-lg p-3">
                  <div className="flex w-full h-full justify-center items-center bg-red-200">
                    <div className="flex bg-white w-full h-auto p-2">
                      <ScoreTable data={result} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })}
      {basicInfo?.tableType === "rankboard" &&
        rankTable?.length > 0 &&
        rankTable.map((table, tIdx) => {
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
                <div className="flex w-full h-auto bg-gray-100 justify-start items-center rounded-lg p-3">
                  <div className="flex w-full h-full justify-center items-center bg-red-200">
                    <div className="flex bg-white w-full h-auto p-2">
                      <RankTable data={result} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })}
    </div>
  );
};

export default ContestRankSummaryModal;
