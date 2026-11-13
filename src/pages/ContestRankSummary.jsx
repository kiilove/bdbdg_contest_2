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

  const assignMinMaxAndCalculateTotal = (group) => {
    const N = group.score.length;
    // 제외 개수: 5심제=0개, 7심제=1개, 9심제=2개 (최종 5명 점수 사용)
    const trimCount = Math.floor(Math.max(0, N - 5) / 2);

    group.score.forEach((s) => {
      s.isMin = false;
      s.isMax = false;
    });

    if (trimCount > 0) {
      const sorted = [...group.score].sort(
        (a, b) => a.playerScore - b.playerScore
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
      .reduce((acc, curr) => acc + curr.playerScore, 0);
  };

  const groupedByPlayerNumber = (arr, sortCriteria = "playerIndex") => {
    const groupedObj = arr.reduce((acc, curr) => {
      let group = acc.find((g) => g.playerNumber === curr.playerNumber);
      const scoreItem = {
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
      group.score.push(scoreItem);
      return acc;
    }, []);

    groupedObj.forEach((group) => {
      assignMinMaxAndCalculateTotal(group);
    });

    groupedObj.sort((a, b) =>
      sortCriteria === "totalScore"
        ? b.totalScore - a.totalScore
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
        group.result = groupedByPlayerNumber(gradeItems);
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

  const ScoreTable = ({ data }) => {
    if (!data || data.length === 0) return null;
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
                    return (
                      <td key={seatIndex} className="py-2.5 px-2">
                        {isMin || isMax ? (
                          <div className="inline-flex flex-col items-center justify-center px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.06] leading-tight">
                            <span className="font-mono tabular-nums text-xs line-through text-[#737373]">
                              {playerScore}
                            </span>
                            <span className="text-[10px] text-[#737373] mt-0.5">
                              {isMin ? "최저제외" : "최고제외"}
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
          const { categoryTitle, gradeTitle, result } = table;
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
                  최고·최저 제외 유효 5심 합산
                </span>
              </div>
              <ScoreTable data={result} />
            </div>
          );
        })}
    </div>
  );
};

export default ContestRankSummary;
