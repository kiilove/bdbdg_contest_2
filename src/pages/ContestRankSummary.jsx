import React, { useContext, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { useLocation } from "react-router-dom";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { BibTag } from "../components/ui/BibTag";

const ContestRankSummary = () => {
  const [basicInfo, setBasicInfo] = useState({});
  const [scoreData, setScoreData] = useState([]);
  const [dataTable, setDataTable] = useState([]);
  const location = useLocation();
  const { currentContest } = useContext(CurrentContestContext);

  const scoreRankQuery = useFirestoreQuery();

  const generateUniqueRandomNumbers = (min, max, count) => {
    const numbers = Array.from({ length: max - min + 1 }, (_, i) => i + min);

    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    return numbers.slice(0, count);
  };

  const getTrimCountPerSide = (count) => {
    const n = Number(count) || 0;
    if (n >= 9) return 2;
    if (n >= 7) return 1;
    return 0;
  };

  const assignMinMaxAndCalculateTotal = (group) => {
    const N = group.score.length;
    const trimCount = getTrimCountPerSide(N);

    group.score.forEach((s) => {
      s.isMin = false;
      s.isMax = false;
    });

    if (trimCount > 0) {
      const sorted = [...group.score].sort(
        (a, b) => Number(a.playerScore) - Number(b.playerScore)
      );

      for (let i = 0; i < trimCount; i++) {
        sorted[i].isMin = true;
      }

      for (let i = N - trimCount; i < N; i++) {
        sorted[i].isMax = true;
      }
    }

    group.totalScore = group.score
      .filter((s) => !s.isMin && !s.isMax)
      .reduce((acc, curr) => acc + Number(curr.playerScore || 0), 0);
  };

  const groupedByPlayerNumber = (
    arr,
    sortCriteria = "playerIndex",
    scoreType = "ranking"
  ) => {
    const groupedObj = arr.reduce((acc, curr) => {
      let group = acc.find((g) => g.playerNumber === curr.playerNumber);
      const scoreItem = {
        seatIndex: Number(curr.seatIndex),
        playerScore: Number(curr.playerScore),
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
      const existingSeatIdx = group.score.findIndex(
        (s) => s.seatIndex === scoreItem.seatIndex
      );
      if (existingSeatIdx >= 0) {
        group.score[existingSeatIdx] = scoreItem;
      } else {
        group.score.push(scoreItem);
      }
      return acc;
    }, []);

    groupedObj.forEach((group) => {
      group.score.sort((a, b) => a.seatIndex - b.seatIndex);
      assignMinMaxAndCalculateTotal(group);
    });

    groupedObj.sort((a, b) =>
      sortCriteria === "totalScore"
        ? scoreType === "point"
          ? b.totalScore - a.totalScore
          : a.totalScore - b.totalScore
        : a.playerIndex - b.playerIndex
    );

    let rank = 1;
    for (let i = 0; i < groupedObj.length; i++) {
      groupedObj[i].playerRank = rank;
      if (
        i < groupedObj.length - 1 &&
        groupedObj[i].totalScore === groupedObj[i + 1].totalScore
      ) {
        rank--;
      }
      rank++;
    }

    return groupedObj;
  };

  const groupByGrade = (arr) => {
    const isPointMode = basicInfo?.categoryJudgeType === "point";
    return arr
      .reduce((acc, curr) => {
        let group = acc.find((g) => g.gradeId === curr.gradeId);

        if (!group) {
          group = {
            contestId: curr.contestId,
            categoryId: curr.categoryId,
            categoryTitle: curr.categoryTitle,
            scoreType:
              curr.categoryJudgeType || basicInfo?.categoryJudgeType || "ranking",
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
        group.result = groupedByPlayerNumber(
          gradeItems,
          "totalScore",
          group.scoreType || (isPointMode ? "point" : "ranking")
        );
        return group;
      });
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

    setDataTable(() => [...groupByGrade(scoreData)]);
  };

  useEffect(() => {
    setBasicInfo({ ...location.state });
  }, [location]);

  useEffect(() => {
    if (basicInfo.gradeId && currentContest?.contests?.id) {
      fetchScoreRank();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basicInfo, currentContest]);

  useEffect(() => {
    if (scoreData?.length > 0) {
      setDataTable(() => [...groupByGrade(scoreData)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreData]);

  const ScoreTable = ({ data, scoreType = "ranking" }) => {
    if (!data || data.length === 0) return null;
    const isPoint = scoreType === "point";
    return (
      <div className="overflow-x-auto w-full">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] text-[#525252] text-xs font-medium">
              <th className="py-2.5 px-3 w-24">선수번호</th>
              <th className="py-2.5 px-3 w-20">순위</th>
              {data[0]?.score?.map((s) => (
                <th key={s.seatIndex} className="py-2.5 px-2 min-w-[52px]">
                  {s.seatIndex}번
                </th>
              ))}
              <th className="py-2.5 px-3 w-24 text-[#171717]">기표합산</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#171717]/[0.06] text-sm">
            {data.map((player) => {
              const { playerNumber, totalScore, playerRank, score } = player;
              if (totalScore >= 1000) return null;
              return (
                <tr
                  key={playerNumber}
                  className="hover:bg-[#fafafa] transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <BibTag number={playerNumber} />
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums font-medium text-[#171717]">
                    {playerRank}위
                  </td>
                  {score.map((item) => {
                    const { seatIndex, playerScore, isMin, isMax } = item;
                    const excludedLabel = isPoint
                      ? isMax
                        ? "최고제외"
                        : "최저제외"
                      : isMin
                      ? "최고제외"
                      : "최저제외";
                    return (
                      <td key={seatIndex} className="py-2.5 px-2">
                        {isMin || isMax ? (
                          <div className="inline-flex flex-col items-center justify-center px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.06] leading-tight">
                            <span className="font-mono tabular-nums text-xs line-through text-[#737373]">
                              {playerScore}
                            </span>
                            <span className="text-[10px] text-[#737373] mt-0.5">
                              {excludedLabel}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono tabular-nums font-medium text-[#171717]">
                            {playerScore}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-[#2563eb] bg-[#f4f4f5]/50">
                    {totalScore}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#fafafa] text-[#171717] p-6 space-y-4">
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-5 py-4 flex items-center gap-2.5">
        <ClipboardList size={18} strokeWidth={1.5} className="text-[#525252]" />
        <h1 className="text-base font-semibold text-[#171717] m-0">집계표</h1>
      </div>

      {dataTable?.length > 0 &&
        dataTable.map((table, tIdx) => {
          const { categoryTitle, gradeTitle, result, scoreType } = table;
          const judgeCnt = result?.[0]?.score?.length || 0;
          const trimCnt = getTrimCountPerSide(judgeCnt);
          return (
            <div
              key={table.gradeId || tIdx}
              className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
            >
              <div className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] px-5 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#171717]">
                    {categoryTitle}
                  </span>
                  <span className="text-sm text-[#525252]">({gradeTitle})</span>
                </div>
                <span className="text-xs text-[#737373]">
                  {trimCnt > 0
                    ? `${judgeCnt}심제 · 최고 ${trimCnt} · 최저 ${trimCnt} 제외 후 유효 ${
                        judgeCnt - trimCnt * 2
                      }심 합산`
                    : "전원 합산"}
                </span>
              </div>
              <ScoreTable data={result} scoreType={scoreType} />
            </div>
          );
        })}
    </div>
  );
};

export default ContestRankSummary;
