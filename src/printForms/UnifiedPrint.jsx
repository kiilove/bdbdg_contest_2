import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useCallback,
} from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import { MdOutlineScale } from "react-icons/md";
import { HiUserGroup } from "react-icons/hi";
import PrintTable from "./PrintTable";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { where } from "firebase/firestore";
import { useMediaQuery } from "react-responsive";
import { useParams } from "react-router-dom";
import { Empty } from "antd";
import { useDevice } from "../contexts/DeviceContext";

const UnifiedPrint = () => {
  const { isTabletOrMobile } = useDevice();
  const { printType } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState("all");
  const [currentCategoryId, setCurrentCategoryId] = useState("all");
  const [currentGradeId, setCurrentGradeId] = useState("");
  const printRef = useRef();
  const [documentTitle, setDocumentTitle] = useState("");
  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersAssign = useFirestoreGetDocument("contest_players_assign");
  const fetchPlayersFinal = useFirestoreGetDocument("contest_players_final");
  const fetchResults = useFirestoreQuery();

  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [playersArray, setPlayersArray] = useState([]);
  const [resultArray, setResultArray] = useState([]);

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId
      );
    }
  }, [currentContest, currentSection, printType]);

  const fetchPool = async (categoryId, gradeId) => {
    try {
      const [categories, grades] = await Promise.all([
        fetchCategories.getDocument(categoryId),
        fetchGrades.getDocument(gradeId),
      ]);
      setCategoriesArray(categories?.categorys || []);
      setGradesArray(grades?.grades || []);

      if (printType === "measurement") {
        const playerData = await fetchPlayersAssign.getDocument(
          currentContest.contests.contestPlayersAssignId
        );
        setPlayersArray(playerData?.players || []);
      } else if (printType === "final") {
        const playerData = await fetchPlayersFinal.getDocument(
          currentContest.contests.contestPlayersFinalId
        );
        setPlayersArray(playerData?.players || []);
      } else {
        // ranking이나 다른 타입일 경우 playersArray 초기화
        setPlayersArray([]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = async (categoryId, gradeId) => {
    try {
      const contestId = currentContest?.contests?.id;
      if (!contestId) {
        console.error("Contest ID가 유효하지 않습니다.");
        return;
      }

      const conditions = [where("contestId", "==", contestId)];

      if (categoryId === "all") {
        if (currentSection !== "all") {
          conditions.push(
            where("contestCategorySection", "==", currentSection)
          );
        }
      } else {
        conditions.push(where("categoryId", "==", categoryId));
        if (gradeId && gradeId !== "all") {
          conditions.push(where("gradeId", "==", gradeId));
        }
      }

      setIsLoading(true);

      const resultsData = await fetchResults.getDocuments(
        "contest_results_list",
        conditions
      );

      const enhancedResults = resultsData.map((result) => {
        const category = categoriesArray.find(
          (cat) => cat.contestCategoryId === result.categoryId
        );
        const grade = gradesArray.find(
          (grd) => grd.contestGradeId === result.gradeId
        );

        return {
          ...result,
          contestCategorySection: category?.contestCategorySection || "",
          contestCategoryIndex: category?.contestCategoryIndex || 0,
          contestGradeIndex: grade?.contestGradeIndex || 0,
        };
      });

      const finalSortedResults = enhancedResults.sort((a, b) => {
        if (a.contestCategorySection !== b.contestCategorySection) {
          return a.contestCategorySection.localeCompare(
            b.contestCategorySection
          );
        }
        if (a.contestCategoryIndex !== b.contestCategoryIndex) {
          return a.contestCategoryIndex - b.contestCategoryIndex;
        }
        return a.contestGradeIndex - b.contestGradeIndex;
      });

      setResultArray(finalSortedResults || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupAndCountPlayersByGymAndRank = (data) => {
    // players를 flat하게 변환하고 각 player에 카테고리와 등급 정보를 추가
    const playersFlat = data.flatMap((category) =>
      category.grades.flatMap((grade) =>
        grade.players.map((player) => ({
          ...player,
          contestCategoryTitle: category.contestCategoryTitle,
          contestGradeTitle: grade.contestGradeTitle,
        }))
      )
    );

    // 전체 데이터에서 최대 순위를 동적으로 결정
    const maxRank = Math.max(...playersFlat.map((player) => player.playerRank));

    // playerGym으로 그룹화 후 rankTitle별로 선수 집계 및 정보 추가
    const result = playersFlat.reduce((acc, player) => {
      const { playerGym, playerRank } = player;

      // 각 Gym을 위한 객체 초기화
      if (!acc[playerGym]) acc[playerGym] = {};

      // 모든 rankTitle을 0으로 초기화 (1부터 maxRank까지)
      for (let rank = 1; rank <= maxRank; rank++) {
        const rankTitle = `rankTitle:${rank}`;
        if (!acc[playerGym][rankTitle]) {
          acc[playerGym][rankTitle] = {
            count: 0,
            players: [],
          };
        }
      }

      // 실제 선수의 순위 데이터를 추가
      const rankTitle = `rankTitle:${playerRank}`;
      acc[playerGym][rankTitle].players.push(player);
      acc[playerGym][rankTitle].count += 1;

      return acc;
    }, {});

    return result;
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
  const processCategoriesGradesPlayers = useCallback(
    (filteredCategories, gradesArray, playersArray) => {
      return filteredCategories
        .map((category) => {
          const grades = gradesArray
            .filter(
              (grade) => grade.refCategoryId === category.contestCategoryId
            )
            .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
            .map((grade) => {
              const players = playersArray
                .filter((player) => {
                  if (printType === "measurement") {
                    return player.originalGradeId === grade.contestGradeId;
                  } else {
                    return player.contestGradeId === grade.contestGradeId;
                  }
                })
                .map((player, index) => {
                  let note = player.note || "";
                  let playerName = player.playerName;

                  if (printType === "final") {
                    if (player.playerNoShow) {
                      note = "불참";
                    } else if (player.isGradeChanged) {
                      note = "월체 반영됨";
                    }
                  }

                  return {
                    index: index + 1,
                    playerNumber: player.playerNumber,
                    playerIndex: player.playerIndex,
                    playerName,
                    heightWeight: player.heightWeight || "",
                    playerGym: player.playerGym || "",
                    note,
                  };
                });

              return {
                contestGradeTitle: grade.contestGradeTitle,
                players: players,
              };
            })
            .filter((grade) => grade.players.length > 0);

          return {
            contestCategoryTitle: category.contestCategoryTitle,
            grades,
          };
        })
        .filter((category) => category.grades.length > 0);
    },
    [printType] // Ensure that printType is included in dependencies
  );

  // const processCategoriesGradesPlayers = useCallback(
  //   (filteredCategories, gradesArray, playersArray) => {
  //     return filteredCategories
  //       .map((category) => {
  //         const grades = gradesArray
  //           .filter(
  //             (grade) => grade.refCategoryId === category.contestCategoryId
  //           )
  //           .map((grade) => {
  //             const players = playersArray
  //               .filter(
  //                 (player) => player.contestGradeId === grade.contestGradeId
  //               )
  //               .map((player, index) => ({
  //                 index: index + 1,
  //                 playerNumber: player.playerNumber,
  //                 playerIndex: player.playerIndex,
  //                 playerName: player.playerName,
  //                 heightWeight: player.heightWeight || "",
  //                 playerGym: player.playerGym || "",
  //                 note: player.note || "",
  //               }));

  //             return {
  //               contestGradeTitle: grade.contestGradeTitle,
  //               players,
  //             };
  //           })
  //           .filter((grade) => grade.players.length > 0);

  //         return {
  //           contestCategoryTitle: category.contestCategoryTitle,
  //           grades,
  //         };
  //       })
  //       .filter((category) => category.grades.length > 0);
  //   },
  //   []
  // );

  useEffect(() => {
    const contestTitle = currentContest?.contestInfo?.contestTitle;
    const section = currentSection === "all" ? "전체" : currentSection;
    const titles = {
      measurement: "계측명단",
      final: "출전명단",
      ranking: "순위표",
    };
    setDocumentTitle(`${contestTitle} ${titles[printType]} ${section}`);
  }, [currentContest, currentSection, printType]);

  const columns = useMemo(() => {
    if (printType === "measurement") {
      return [
        { label: "순번", key: "index", width: 10 },
        { label: "선수번호", key: "playerNumber", width: 15 },
        { label: "이름", key: "playerName", width: 20 },
        {
          label: "신장/체중",
          key: "heightWeight",
          width: 30,
          forcedValue: "/",
        },
        { label: "비고", key: "notes", width: 25 },
      ];
    } else if (printType === "final") {
      return [
        { label: "순번", key: "index", width: 10 },
        { label: "선수", mergeKeys: ["playerNumber", "playerName"], width: 30 },
        { label: "소속", key: "playerGym", width: 30 },
        { label: "비고", key: "note", width: 30 },
      ];
    } else if (printType === "ranking") {
      return [
        { label: "순위", key: "playerRank" },
        { label: "선수", mergeKeys: ["playerNumber", "playerName"], width: 30 },
        { label: "소속", key: "playerGym", width: 30 },
        { label: "비고", key: "note", width: 30 },
      ];
    }
  }, [printType]);

  const availableCategories = useMemo(() => {
    return categoriesArray.filter(
      (cat) =>
        currentSection === "all" ||
        cat.contestCategorySection === currentSection
    );
  }, [categoriesArray, currentSection]);

  const availableGrades = useMemo(() => {
    return gradesArray.filter((grade) => {
      const isCategoryMatch =
        currentCategoryId === "all" ||
        grade.refCategoryId === currentCategoryId;

      if (!isCategoryMatch) return false;

      const hasPlayers = playersArray.some(
        (player) => player.contestGradeId === grade.contestGradeId
      );

      return hasPlayers;
    });
  }, [gradesArray, currentCategoryId, playersArray]);

  useEffect(() => {
    setCurrentCategoryId("all");
    setCurrentGradeId("");
  }, [currentSection]);

  useEffect(() => {
    setCurrentGradeId("");
  }, [currentCategoryId]);

  const filteredPlayerList = useMemo(() => {
    if (printType === "ranking") {
      // Format the resultArray using formatResultArray function
      const formattedResults = formatResultArray(resultArray);

      console.log(
        "클럽그룹화",
        groupAndCountPlayersByGymAndRank(formattedResults)
      );
      return formattedResults;
    } else {
      // For other print types, use the new function
      const filteredCategories = categoriesArray.filter((category) => {
        return (
          currentSection === "all" ||
          category.contestCategorySection === currentSection
        );
      });

      let result = processCategoriesGradesPlayers(
        filteredCategories,
        gradesArray,
        playersArray
      );

      // Sort by playerIndex for measurement type
      // result = result.map((category) => ({
      //   ...category,
      //   grades: category.grades.map((grade) => ({
      //     ...grade,
      //     players: grade.players.sort((a, b) => a.playerIndex - b.playerIndex), // Sort by playerIndex (index)
      //   })),
      // }));
      // return result;
      // 정렬 후, grade별로 순번(index) 1부터 다시 매겨주기(연번)
      result = result.map((category) => ({
        ...category,
        grades: category.grades.map((grade) => {
          const sorted = [...grade.players].sort(
            (a, b) => a.playerIndex - b.playerIndex
          );
          const renumbered = sorted.map((p, i) => ({ ...p, index: i + 1 }));
          return { ...grade, players: renumbered };
        }),
      }));
      return result;
    }
  }, [
    categoriesArray,
    gradesArray,
    playersArray,
    resultArray,
    currentSection,
    printType,
    processCategoriesGradesPlayers,
  ]);

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
            className={`flex w-full h-14 mb-4 ${
              isTabletOrMobile ? "bg-gray-200" : "bg-gray-100"
            } justify-start items-center rounded-lg px-3`}
          >
            <span
              className={`font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl ${
                isTabletOrMobile ? "bg-blue-300" : "bg-blue-400"
              } text-white mr-3`}
            >
              {printType === "measurement" ? (
                <MdOutlineScale />
              ) : (
                <HiUserGroup />
              )}
            </span>
            <h1 className="font-sans text-lg font-semibold">{documentTitle}</h1>
          </div>

          <div className="flex fw w-full mb-4 gap-2">
            {[
              "all",
              ...new Set(
                categoriesArray
                  .filter((cat) =>
                    printType === "measurement"
                      ? cat.contestCategorySection !== "그랑프리"
                      : true
                  )
                  .map((cat) => cat.contestCategorySection)
              ),
            ].map((section, idx) => (
              <button
                key={idx}
                className={`px-4 py-2 rounded-lg border ${
                  currentSection === section
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-700"
                }`}
                onClick={() => setCurrentSection(section)}
              >
                {section === "all" ? "전체" : section}
              </button>
            ))}

            {printType === "ranking" && (
              <>
                <select
                  value={currentCategoryId}
                  onChange={(e) => setCurrentCategoryId(e.target.value)}
                  className="border rounded-lg p-2"
                >
                  <option value="all">종목 선택</option>
                  {availableCategories.map((category) => (
                    <option
                      key={category.contestCategoryId}
                      value={category.contestCategoryId}
                    >
                      {category.contestCategoryTitle}
                    </option>
                  ))}
                </select>

                <select
                  value={currentGradeId}
                  onChange={(e) => setCurrentGradeId(e.target.value)}
                  className={`border rounded-lg p-2 ${
                    currentCategoryId === "all"
                      ? "bg-gray-200 cursor-not-allowed"
                      : ""
                  }`}
                >
                  <option value="all">체급 선택</option>
                  {availableGrades.map((grade) => (
                    <option
                      key={grade.contestGradeId}
                      value={grade.contestGradeId}
                    >
                      {grade.contestGradeTitle}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() =>
                    handleSearch(currentCategoryId, currentGradeId)
                  }
                  className="bg-blue-500 text-white rounded-lg px-4 py-2"
                >
                  검색
                </button>
              </>
            )}

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
              {printType === "ranking" && resultArray.length === 0 ? (
                <p className="text-center text-gray-500">
                  <Empty description="데이터가 없습니다." />
                </p>
              ) : (
                <PrintTable
                  documentTitle={documentTitle}
                  data={filteredPlayerList}
                  columns={columns}
                  addEmptyRows={printType === "measurement"}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UnifiedPrint;
