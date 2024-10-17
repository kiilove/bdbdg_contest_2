import React, { useState, useEffect, useMemo, useRef, useContext } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import { MdOutlineScale } from "react-icons/md";
import { HiUserGroup } from "react-icons/hi";
import { Empty, Radio } from "antd";
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
    try {
      const result = await fetchResults.getDocuments(
        "contest_results_list",
        condition
      );
      setResultArray(result);
    } catch (error) {
      console.log(error);
    }
  };

  const formatResultArray = (data) => {
    return data.map((item) => ({
      contestCategoryTitle: item.categoryTitle,
      grades: [
        {
          contestGradeTitle: item.gradeTitle,
          players: item.result
            .filter((f) => f.playerRank < 1000)
            .sort((a, b) => a.playerRank - b.playerRank)
            .map((player) => ({
              playerNumber: player.playerNumber,
              playerName: player.playerName,
              playerGym: player.playerGym,
              playerRank: player.playerRank,
              note: player.note || "",
            })),
        },
      ],
    }));
  };

  const groupAndCountPlayersByGymAndRank = (data) => {
    const playersFlat = data.flatMap((category) =>
      category.grades.flatMap((grade) =>
        grade.players.map((player) => ({
          ...player,
          contestCategoryTitle: category.contestCategoryTitle,
          contestGradeTitle: grade.contestGradeTitle,
          // 공백 제거된 playerGym 추가
          cleanedPlayerGym: player.playerGym.replace(/\s+/g, ""),
        }))
      )
    );

    const maxRank =
      rankingLimit === "all"
        ? Math.max(...playersFlat.map((player) => player.playerRank))
        : parseInt(rankingLimit.replace("top", ""), 10);

    const groupedData = playersFlat.reduce((acc, player) => {
      const { cleanedPlayerGym, playerRank, contestCategoryTitle } = player;

      if (
        (!includeUnaffiliated && cleanedPlayerGym === "무소속") ||
        (!includeGrandPrix && contestCategoryTitle.endsWith("그랑프리"))
      ) {
        return acc;
      }

      if (!acc[cleanedPlayerGym]) acc[cleanedPlayerGym] = {};

      for (let rank = 1; rank <= maxRank; rank++) {
        const rankTitle = `rankTitle:${rank}`;
        if (!acc[cleanedPlayerGym][rankTitle]) {
          acc[cleanedPlayerGym][rankTitle] = {
            count: 0,
            players: [],
          };
        }
      }

      if (playerRank <= maxRank) {
        const rankTitle = `rankTitle:${playerRank}`;
        acc[cleanedPlayerGym][rankTitle].players.push(player);
        acc[cleanedPlayerGym][rankTitle].count += 1;
      }

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
        ? Math.max(
            ...sortedData.flatMap((gym) =>
              gym.ranks.map((rank) => parseInt(rank.rankTitle))
            )
          )
        : parseInt(rankingLimit.replace("top", ""), 10);

    let currentRank = 1;
    let lastCountSum = null;
    return sortedData.map(({ gymName, ranks }, index) => {
      const rankCounts = ranks.reduce((acc, { rankTitle, count }) => {
        if (parseInt(rankTitle) <= maxRank) {
          acc[`rank${rankTitle}`] = count;
        }
        return acc;
      }, {});

      const countSum = Object.values(rankCounts).reduce(
        (sum, count) => sum + count,
        0
      );

      if (countSum === lastCountSum) {
        // 같은 순위
        lastCountSum = countSum;
      } else {
        // 새로운 순위
        currentRank = index + 1;
        lastCountSum = countSum;
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
        ? Math.max(
            ...topGroupedData.flatMap((row) =>
              Object.keys(row)
                .filter((key) => key.startsWith("rank"))
                .map((key) => parseInt(key.replace("rank", "")))
            )
          )
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
    <div
      className={`flex flex-col w-full h-full ${
        isTabletOrMobile ? "bg-gray-100 p-2" : "bg-gray-50 p-4"
      }`}
    >
      {isLoading ? (
        <LoadingPage />
      ) : (
        <>
          <div
            className={`flex w-full h-14 mb-2 ${
              isTabletOrMobile ? "bg-gray-200" : "bg-gray-100"
            } justify-start items-center rounded-lg px-3`}
          >
            <span
              className={`font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl ${
                isTabletOrMobile ? "bg-blue-300" : "bg-blue-400"
              } text-white mr-3`}
            >
              <MdOutlineScale />
            </span>
            <h1 className="font-sans text-lg font-semibold">클럽별 집계</h1>
          </div>

          <div className="flex w-full mb-4 gap-2 items-center">
            <Radio.Group
              onChange={(e) =>
                setIncludeUnaffiliated(e.target.value === "include")
              }
              value={includeUnaffiliated ? "include" : "exclude"}
            >
              <Radio.Button value="include">무소속 포함</Radio.Button>
              <Radio.Button value="exclude">무소속 제외</Radio.Button>
            </Radio.Group>

            <Radio.Group
              onChange={(e) =>
                setIncludeGrandPrix(e.target.value === "include")
              }
              value={includeGrandPrix ? "include" : "exclude"}
            >
              <Radio.Button value="include">그랑프리 포함</Radio.Button>
              <Radio.Button value="exclude">그랑프리 제외</Radio.Button>
            </Radio.Group>

            <Radio.Group
              onChange={(e) => setRankingLimit(e.target.value)}
              value={rankingLimit}
            >
              <Radio.Button value="top3">TOP 3</Radio.Button>
              <Radio.Button value="top5">TOP 5</Radio.Button>
              <Radio.Button value="all">전체</Radio.Button>
            </Radio.Group>

            <ReactToPrint
              trigger={() => (
                <button className="bg-blue-800 text-white rounded-lg px-4 py-2">
                  출력
                </button>
              )}
              content={() => printRef.current}
            />
          </div>

          <div className="flex w-full h-full bg-white overflow-y-auto p-4">
            <div
              ref={printRef}
              className={`w-full h-full flex justify-center items-start bg-white ${
                isTabletOrMobile ? "p-2" : "p-4"
              }`}
            >
              {topGroupedData.length === 0 ? (
                <p className="text-center text-gray-500">
                  <Empty description="데이터가 없습니다." />
                </p>
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
                              {row[col.key] || 0}
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
  );
};

export default GymGroupPrint;
