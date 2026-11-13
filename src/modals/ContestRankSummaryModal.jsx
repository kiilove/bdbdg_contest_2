import React, { useContext, useEffect, useState } from "react";
import { ClipboardList, X } from "lucide-react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { BibTag } from "../components/ui/BibTag";

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

  const groupedByPlayerNumber = (arr, sortCriteria = "playerIndex") => {
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
        ? a.totalScore - b.totalScore
        : a.playerIndex - b.playerIndex
    );

    let rank = 0;
    let prevScore = null;
    let sameRankCount = 0;
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
  };

  useEffect(() => {
    setBasicInfo({ categoryId, gradeId, tableType });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (basicInfo.gradeId && currentContest?.contests?.id) {
      fetchScoreRank();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basicInfo, currentContest]);

  useEffect(() => {
    if (scoreData?.length > 0) {
      setSummaryTable(() => [...groupByGrade(scoreData, "totalScore")]);
      setRankTable(() => [...groupByGrade(scoreData, "totalScore")]);
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
              <th className="py-2.5 px-3 w-24">순위</th>
              {data[0]?.score?.map((s) => (
                <th key={s.seatIndex} className="py-2.5 px-2 min-w-[52px]">
                  {s.seatIndex}번
                </th>
              ))}
              <th className="py-2.5 px-3 w-24 text-[#171717]">기표합산</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#171717]/[0.06] text-sm">
            {[...data]
              .sort((a, b) => a.playerIndex - b.playerIndex)
              .map((player) => {
                const { playerNumber, totalScore, playerRank, score, isAlert } =
                  player;
                if (totalScore >= 1000) return null;
                return (
                  <tr
                    key={playerNumber}
                    className={
                      isAlert
                        ? "bg-[#dc2626]/[0.05] hover:bg-[#dc2626]/[0.08] transition-colors"
                        : "hover:bg-[#fafafa] transition-colors"
                    }
                  >
                    <td className="py-2.5 px-3">
                      <BibTag
                        number={playerNumber}
                        className={
                          isAlert
                            ? "!border-[#dc2626]/50 !text-[#dc2626] !bg-[#dc2626]/[0.08]"
                            : ""
                        }
                      />
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums font-medium">
                      <div className="inline-flex items-center gap-1.5">
                        <span
                          className={
                            isAlert ? "text-[#dc2626]" : "text-[#171717]"
                          }
                        >
                          {playerRank}위
                        </span>
                        {isAlert && (
                          <span className="px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.1] text-[#dc2626] text-[10px] font-sans font-medium">
                            동점
                          </span>
                        )}
                      </div>
                    </td>
                    {score.map((item) => {
                      const { seatIndex, playerScore, isMin, isMax } = item;
                      return (
                        <td key={seatIndex} className="py-2.5 px-2">
                          {isMin || isMax ? (
                            <div className="inline-flex flex-col items-center justify-center px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.06] leading-tight">
                              <span className="font-mono tabular-nums text-xs line-through text-[#737373]">
                                {playerScore >= 1000 ? "제외" : playerScore}
                              </span>
                              <span className="text-[10px] text-[#737373] mt-0.5">
                                {isMin ? "최고제외" : "최저제외"}
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono tabular-nums font-medium text-[#171717]">
                              {playerScore >= 1000 ? "제외" : playerScore}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td
                      className={`py-2.5 px-3 font-mono tabular-nums font-semibold ${
                        isAlert ? "text-[#dc2626]" : "text-[#2563eb]"
                      }`}
                    >
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

  const RankTable = ({ data }) => {
    if (!data || data.length === 0) return null;
    return (
      <div className="overflow-x-auto w-full">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] text-[#525252] text-xs font-medium">
              <th className="py-2.5 px-3 w-24">선수번호</th>
              <th className="py-2.5 px-3 w-20">순위</th>
              {data[0]?.score?.map((_, sIdx) => (
                <th key={sIdx} className="py-2.5 px-2 min-w-[52px]">
                  {randomTitle[sIdx]}
                </th>
              ))}
              <th className="py-2.5 px-3 w-24 text-[#171717]">기표합산</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#171717]/[0.06] text-sm">
            {[...data]
              .sort((a, b) => a.playerRank - b.playerRank)
              .map((player) => {
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
                    {[...score]
                      .sort((a, b) => a.randomIndex - b.randomIndex)
                      .map((item) => {
                        const { seatIndex, playerScore, isMin, isMax } = item;
                        return (
                          <td key={seatIndex} className="py-2.5 px-2">
                            {isMin || isMax ? (
                              <div className="inline-flex flex-col items-center justify-center px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.06] leading-tight">
                                <span className="font-mono tabular-nums text-xs line-through text-[#737373]">
                                  {playerScore >= 1000 ? "제외" : playerScore}
                                </span>
                                <span className="text-[10px] text-[#737373] mt-0.5">
                                  {isMin ? "최고제외" : "최저제외"}
                                </span>
                              </div>
                            ) : (
                              <span className="font-mono tabular-nums font-medium text-[#171717]">
                                {playerScore >= 1000 ? "제외" : playerScore}
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

  const activeTables =
    basicInfo?.tableType === "summaryboard" ? summaryTable : rankTable;

  return (
    <div className="flex flex-col w-full h-full max-h-screen overflow-y-auto bg-[#fafafa] text-[#171717] p-4 sm:p-6 space-y-4">
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ClipboardList
            size={18}
            strokeWidth={1.5}
            className="text-[#525252]"
          />
          <h1 className="text-base font-semibold text-[#171717] m-0">
            {basicInfo?.tableType === "summaryboard" ? "집계표" : "순위표"}
          </h1>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] text-sm font-medium transition-colors cursor-pointer"
          onClick={() => setClose()}
        >
          <X size={16} strokeWidth={1.5} className="text-[#525252]" />
          <span>닫기</span>
        </button>
      </div>

      {activeTables?.length > 0 &&
        activeTables.map((table, tIdx) => {
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

              {basicInfo?.tableType === "summaryboard" ? (
                <ScoreTable data={result} />
              ) : (
                <RankTable data={result} />
              )}
            </div>
          );
        })}
    </div>
  );
};

export default ContestRankSummaryModal;
