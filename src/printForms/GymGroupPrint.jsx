import React, { useState, useEffect, useMemo, useRef, useContext } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import { Award, Printer } from "lucide-react";
import { Empty } from "antd";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { where } from "firebase/firestore";
import { useDevice } from "../contexts/DeviceContext";

const GymGroupPrint = () => {
  const { isTabletOrMobile } = useDevice();
  const { currentContest } = useContext(CurrentContestContext);
  const [isLoading, setIsLoading] = useState(false);
  const [resultArray, setResultArray] = useState([]);
  const [includeUnaffiliated, setIncludeUnaffiliated] = useState(true);
  const [includeGrandPrix, setIncludeGrandPrix] = useState(true);
  const [rankingLimit, setRankingLimit] = useState("top5");
  const printRef = useRef();
  const fetchResults = useFirestoreQuery();

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(currentContest.contests.id);
    }
  }, [currentContest]);

  const fetchPool = async (contestId) => {
    const condition = [where("contestId", "==", contestId)];
    setIsLoading(true);
    try {
      const result = await fetchResults.getDocuments(
        "contest_results_list",
        condition
      );
      setResultArray(result || []);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatResultArray = (data) => {
    return (data || []).map((item) => ({
      contestCategoryTitle: item?.categoryTitle || "",
      grades: [
        {
          contestGradeTitle: item?.gradeTitle || "",
          players: (item?.result || [])
            .filter(
              (f) =>
                f?.playerRank != null &&
                f.playerRank > 0 &&
                f.playerRank < 1000
            )
            .sort((a, b) => a.playerRank - b.playerRank)
            .map((player) => ({
              playerNumber: player.playerNumber,
              playerName: player.playerName || "",
              playerGym: player.playerGym || "",
              playerRank: player.playerRank,
              note: player.note || "",
            })),
        },
      ],
    }));
  };

  const groupAndCountPlayersByGymAndRank = (data) => {
    const playersFlat = (data || []).flatMap((category) =>
      (category.grades || []).flatMap((grade) =>
        (grade.players || []).map((player) => {
          const rawGym = (player.playerGym || "").replace(/\s+/g, "");
          return {
            ...player,
            contestCategoryTitle: category.contestCategoryTitle || "",
            contestGradeTitle: grade.contestGradeTitle || "",
            // 공백 제거된 playerGym 추가 (빈 문자열이면 무소속 처리)
            cleanedPlayerGym: rawGym || "무소속",
          };
        })
      )
    );

    const maxRank =
      rankingLimit === "all"
        ? playersFlat.length > 0
          ? Math.max(1, ...playersFlat.map((player) => player.playerRank || 0))
          : 5
        : parseInt(rankingLimit.replace("top", ""), 10);

    const groupedData = playersFlat.reduce((acc, player) => {
      const { cleanedPlayerGym, playerRank, contestCategoryTitle } = player;

      if (
        (!includeUnaffiliated && cleanedPlayerGym === "무소속") ||
        (!includeGrandPrix && (contestCategoryTitle || "").endsWith("그랑프리"))
      ) {
        return acc;
      }

      if (!(playerRank >= 1 && playerRank <= maxRank)) {
        return acc;
      }

      if (!acc[cleanedPlayerGym]) {
        acc[cleanedPlayerGym] = {};
        for (let rank = 1; rank <= maxRank; rank++) {
          acc[cleanedPlayerGym][`rankTitle:${rank}`] = {
            count: 0,
            players: [],
          };
        }
      }

      const rankTitle = `rankTitle:${playerRank}`;
      acc[cleanedPlayerGym][rankTitle].players.push(player);
      acc[cleanedPlayerGym][rankTitle].count += 1;

      return acc;
    }, {});

    return Object.entries(groupedData)
      .map(([gymName, ranks]) => ({
        gymName,
        ranks: Object.entries(ranks).map(([rankTitle, { count, players }]) => ({
          rankTitle: rankTitle.split(":")[1],
          count,
          players,
        })),
      }))
      .sort((a, b) => {
        for (let rank = 1; rank <= maxRank; rank++) {
          const rankTitle = rank.toString();
          const countA =
            a.ranks.find((r) => r.rankTitle === rankTitle)?.count || 0;
          const countB =
            b.ranks.find((r) => r.rankTitle === rankTitle)?.count || 0;

          if (countA !== countB) {
            return countB - countA;
          }
        }
        return 0;
      });
  };

  const prepareDataForPrintTable = (sortedData) => {
    const maxRank =
      rankingLimit === "all"
        ? sortedData.length > 0
          ? Math.max(
              1,
              ...sortedData.flatMap((gym) =>
                gym.ranks.map((rank) => parseInt(rank.rankTitle, 10) || 0)
              )
            )
          : 5
        : parseInt(rankingLimit.replace("top", ""), 10);

    let currentRank = 1;
    let prevRankSignature = null;
    return sortedData.map(({ gymName, ranks }, index) => {
      const rankCounts = ranks.reduce((acc, { rankTitle, count }) => {
        const parsedRank = parseInt(rankTitle, 10);
        if (parsedRank >= 1 && parsedRank <= maxRank) {
          acc[`rank${parsedRank}`] = count;
        }
        return acc;
      }, {});

      const currentSignature = Array.from(
        { length: maxRank },
        (_, i) => rankCounts[`rank${i + 1}`] || 0
      ).join(",");

      if (
        prevRankSignature !== null &&
        currentSignature === prevRankSignature
      ) {
        // 모든 순위별 메달(1위..N위) 개수가 동일할 때만 동순위 유지
      } else {
        currentRank = index + 1;
        prevRankSignature = currentSignature;
      }

      const row = { gymName, clubRank: currentRank };
      for (let i = 1; i <= maxRank; i++) {
        row[`rank${i}`] = rankCounts[`rank${i}`] || 0;
      }
      return row;
    });
  };

  const { topGroupedData } = useMemo(() => {
    const formattedResults = formatResultArray(resultArray);
    const allGrouped = groupAndCountPlayersByGymAndRank(formattedResults);
    const topGroupedData = prepareDataForPrintTable(allGrouped);
    return { topGroupedData };
  }, [resultArray, includeUnaffiliated, includeGrandPrix, rankingLimit]);

  const columns = useMemo(() => {
    const maxRank =
      rankingLimit === "all"
        ? topGroupedData.length > 0
          ? Math.max(
              1,
              ...topGroupedData.flatMap((row) =>
                Object.keys(row)
                  .filter((key) => key.startsWith("rank"))
                  .map((key) => parseInt(key.replace("rank", ""), 10) || 0)
              )
            )
          : 5
        : parseInt(rankingLimit.replace("top", ""), 10);

    return [
      { key: "clubRank", label: "클럽순위", width: 15 },
      { key: "gymName", label: "클럽명", width: 35 },
      ...Array.from({ length: maxRank }, (_, i) => ({
        key: `rank${i + 1}`,
        label: `${i + 1}위`,
        width: 50 / maxRank,
      })),
    ];
  }, [rankingLimit, topGroupedData]);

  const filterConditions = `(${
    includeUnaffiliated ? "무소속포함" : "무소속제외"
  }, ${
    includeGrandPrix ? "그랑프리포함" : "그랑프리제외"
  }, ${rankingLimit.toUpperCase()})`;

  return (
    <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
        {isLoading ? (
          <LoadingPage />
        ) : (
          <>
            <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-5 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#525252] flex items-center justify-center shrink-0">
                  <Award size={16} strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#171717] m-0">
                    클럽별 집계 출력
                  </h1>
                  <p className="text-[12px] text-[#737373] m-0 mt-0.5">
                    소속 클럽별 입상 현황을 집계하여 A4 규격으로 인쇄합니다.
                  </p>
                </div>
              </div>

              <ReactToPrint
                trigger={() => (
                  <button className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-[#ffffff] font-medium text-[13px] inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer border-0">
                    <Printer size={15} strokeWidth={1.5} />
                    <span>인쇄하기</span>
                  </button>
                )}
                content={() => printRef.current}
              />
            </div>

            <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-4 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-[8px] bg-[#f4f4f5]">
                <button
                  type="button"
                  onClick={() => setIncludeUnaffiliated(true)}
                  className={`h-7 px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-150 ${
                    includeUnaffiliated
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  무소속 포함
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeUnaffiliated(false)}
                  className={`h-7 px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-150 ${
                    !includeUnaffiliated
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  무소속 제외
                </button>
              </div>

              <div className="inline-flex items-center gap-1 p-1 rounded-[8px] bg-[#f4f4f5]">
                <button
                  type="button"
                  onClick={() => setIncludeGrandPrix(true)}
                  className={`h-7 px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-150 ${
                    includeGrandPrix
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  그랑프리 포함
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeGrandPrix(false)}
                  className={`h-7 px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-150 ${
                    !includeGrandPrix
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  그랑프리 제외
                </button>
              </div>

              <div className="inline-flex items-center gap-1 p-1 rounded-[8px] bg-[#f4f4f5]">
                {[
                  { value: "top3", label: "상위 3위" },
                  { value: "top5", label: "상위 5위" },
                  { value: "all", label: "전체 순위" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRankingLimit(opt.value)}
                    className={`h-7 px-3 rounded-[6px] text-[12px] font-medium tabular-nums transition-colors duration-150 ${
                      rankingLimit === opt.value
                        ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                        : "text-[#525252] hover:text-[#171717]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <span className="ml-auto text-[12px] text-[#737373] tabular-nums">
                집계 클럽 {topGroupedData.length}곳
              </span>
            </div>

            <div className="flex w-full bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-y-auto p-4 sm:p-6 print:border-0 print:shadow-none print:p-0">
              <div
                ref={printRef}
                className={`w-full h-full flex justify-center items-start bg-white ${
                  isTabletOrMobile ? "p-2" : "p-4"
                }`}
              >
              {topGroupedData.length === 0 ? (
                <div className="text-center text-gray-500">
                  <Empty description="데이터가 없습니다." />
                </div>
              ) : (
                <div className="flex w-full h-full flex-col">
                  <div
                    className="flex w-full flex-col mb-5 h-20 justify-center items-center bg-white border border-gray-400 rounded-md"
                    style={{
                      borderTopColor: "#cbd5e0",
                      borderLeftColor: "#cbd5e0",
                      borderBottomColor: "#4a5568",
                      borderRightColor: "#4a5568",
                    }}
                  >
                    <span className="text-lg font-semibold text-gray-800">
                      클럽별 집계
                    </span>
                    <div className="text-gray-500 font-semibold ">
                      {filterConditions}
                    </div>
                  </div>
                  <table
                    className="w-full border-collapse border border-gray-400 text-center"
                    style={{
                      fontSize: "14px",
                      marginBottom: "20px",
                      borderRadius: "5px",
                    }}
                  >
                    <thead>
                      <tr className="bg-gray-300">
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            className="border px-2 py-1"
                            style={{ width: `${col.width}%` }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {topGroupedData.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              className="p-2 border"
                              style={{ width: `${col.width}%` }}
                            >
                              {col.key === "gymName"
                                ? row.gymName || "-"
                                : row[col.key] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GymGroupPrint;
