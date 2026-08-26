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
import { FaChartPie, FaPrint } from "react-icons/fa";
import PrintTable from "./PrintTable";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { where } from "firebase/firestore";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Empty } from "antd";
import { useDevice } from "../contexts/DeviceContext";

const UnifiedPrint = () => {
  const { isTabletOrMobile } = useDevice();
  const { printType = "measurement" } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState("all");
  const [currentCategoryId, setCurrentCategoryId] = useState("all");
  const [currentGradeId, setCurrentGradeId] = useState("all");
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

  // 서브 출력 메뉴 탭 목록
  const printTabs = [
    { type: "measurement", label: "계측 명단 출력", path: "/print/measurement", icon: <MdOutlineScale /> },
    { type: "final", label: "출전 명단 출력", path: "/print/final", icon: <HiUserGroup /> },
    { type: "ranking", label: "순위표 출력", path: "/print/ranking", icon: <FaChartPie /> },
    { type: "gymgroup", label: "클럽별 집계 출력", path: "/printgymgroup", isExternal: true },
    { type: "judgeassign", label: "심판별 배정 출력", path: "/judgeassignmentPrint", isExternal: true },
    { type: "judgematrix", label: "심판배정 매트릭스", path: "/judgeseatmatrixprint", isExternal: true },
    { type: "summary", label: "집계표 출력", path: "/printsummary", isExternal: true },
  ];

  const handleSearch = useCallback(
    async (categoryId, gradeId, section = currentSection) => {
      const contestId = currentContest?.contests?.id;
      if (!contestId) return;

      const conditions = [where("contestId", "==", contestId)];

      if (categoryId && categoryId !== "all") {
        conditions.push(where("categoryId", "==", categoryId));
        if (gradeId && gradeId !== "all") {
          conditions.push(where("gradeId", "==", gradeId));
        }
      }

      setIsLoading(true);
      try {
        const resultsData = await fetchResults.getDocuments(
          "contest_results_list",
          conditions
        );

        let enhancedResults = (resultsData || []).map((result) => {
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

        // 섹션 필터링
        if (section && section !== "all") {
          enhancedResults = enhancedResults.filter(
            (r) => r.contestCategorySection === section
          );
        }

        const finalSortedResults = enhancedResults.sort((a, b) => {
          if (a.contestCategorySection !== b.contestCategorySection) {
            return (a.contestCategorySection || "").localeCompare(
              b.contestCategorySection || ""
            );
          }
          if (a.contestCategoryIndex !== b.contestCategoryIndex) {
            return a.contestCategoryIndex - b.contestCategoryIndex;
          }
          return a.contestGradeIndex - b.contestGradeIndex;
        });

        setResultArray(finalSortedResults || []);
      } catch (error) {
        console.error("순위표 조회 오류:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [currentContest, categoriesArray, gradesArray, currentSection]
  );

  const fetchPool = async (categoryId, gradeId) => {
    setIsLoading(true);
    try {
      const [categories, grades] = await Promise.all([
        fetchCategories.getDocument(categoryId),
        fetchGrades.getDocument(gradeId),
      ]);
      const loadedCats = categories?.categorys || [];
      const loadedGrades = grades?.grades || [];
      setCategoriesArray(loadedCats);
      setGradesArray(loadedGrades);

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
      } else if (printType === "ranking") {
        setPlayersArray([]);
      }
    } catch (error) {
      console.error("출력 기초 데이터 로드 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId
      );
    }
  }, [currentContest, printType]);

  // ranking 타입일 때 자동 검색 실행
  useEffect(() => {
    if (printType === "ranking" && currentContest?.contests?.id && categoriesArray.length > 0) {
      handleSearch(currentCategoryId, currentGradeId, currentSection);
    }
  }, [printType, currentContest, categoriesArray, currentSection]);

  const formatResultArray = (data) => {
    return data.map((item) => ({
      contestCategoryTitle: item.categoryTitle,
      grades: [
        {
          contestGradeTitle: item.gradeTitle,
          players: (item.result || [])
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
    [printType]
  );

  useEffect(() => {
    const contestTitle = currentContest?.contestInfo?.contestTitle || currentContest?.contests?.contestTitle || "";
    const section = currentSection === "all" ? "전체" : currentSection;
    const titles = {
      measurement: "계측명단",
      final: "출전명단",
      ranking: "순위표",
    };
    setDocumentTitle(`${contestTitle} ${titles[printType] || "출력문서"} (${section})`);
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
        { label: "순위", key: "playerRank", width: 15 },
        { label: "선수", mergeKeys: ["playerNumber", "playerName"], width: 35 },
        { label: "소속", key: "playerGym", width: 30 },
        { label: "비고", key: "note", width: 20 },
      ];
    }
    return [];
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

      if (printType === "ranking") return true;

      const hasPlayers = playersArray.some(
        (player) => player.contestGradeId === grade.contestGradeId
      );

      return hasPlayers;
    });
  }, [gradesArray, currentCategoryId, playersArray, printType]);

  useEffect(() => {
    setCurrentCategoryId("all");
    setCurrentGradeId("all");
  }, [currentSection]);

  useEffect(() => {
    setCurrentGradeId("all");
  }, [currentCategoryId]);

  const filteredPlayerList = useMemo(() => {
    if (printType === "ranking") {
      return formatResultArray(resultArray);
    } else {
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

  // 섹션 목록
  const sectionList = useMemo(() => {
    const rawSections = categoriesArray
      .filter((cat) =>
        printType === "measurement"
          ? cat.contestCategorySection !== "그랑프리"
          : true
      )
      .map((cat) => cat.contestCategorySection)
      .filter(Boolean);
    return ["all", ...new Set(rawSections)];
  }, [categoriesArray, printType]);

  return (
    <div className="flex flex-col w-full h-full min-h-screen bg-slate-100 p-3 sm:p-5">
      {/* 1. 상단 출력 관리 전체 네비게이션 탭 바 */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 mb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {printTabs.map((tab) => {
            const isActive =
              !tab.isExternal && printType === tab.type;

            return (
              <Link
                key={tab.type}
                to={tab.path}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold no-underline whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {tab.icon && <span>{tab.icon}</span>}
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <LoadingPage />
      ) : (
        <div className="space-y-4">
          {/* 2. 문서 타이틀 바 및 컨트롤 패널 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl">
                {printType === "measurement" ? (
                  <MdOutlineScale />
                ) : printType === "final" ? (
                  <HiUserGroup />
                ) : (
                  <FaChartPie />
                )}
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-800 m-0">
                  {documentTitle}
                </h1>
                <p className="text-xs text-slate-500 m-0">
                  A4 용지 규격 인쇄 양식 | 미리보기 및 출력
                </p>
              </div>
            </div>

            {/* 인쇄 버튼 */}
            <ReactToPrint
              trigger={() => (
                <button className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm shadow-md hover:shadow-lg transition-all cursor-pointer border-0">
                  <FaPrint />
                  <span>인쇄하기 (Print)</span>
                </button>
              )}
              content={() => printRef.current}
            />
          </div>

          {/* 3. 섹션 & 종목/체급 필터 바 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold text-slate-500 mr-1">부/종목 구분:</span>
            {sectionList.map((section, idx) => (
              <button
                key={idx}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  currentSection === section
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
                onClick={() => {
                  setCurrentSection(section);
                  if (printType === "ranking") {
                    handleSearch("all", "all", section);
                  }
                }}
              >
                {section === "all" ? "전체 보기" : section}
              </button>
            ))}

            {/* 순위표 검색 필터 */}
            {printType === "ranking" && (
              <div className="flex items-center gap-2 ml-auto">
                <select
                  value={currentCategoryId}
                  onChange={(e) => {
                    const catId = e.target.value;
                    setCurrentCategoryId(catId);
                    handleSearch(catId, "all", currentSection);
                  }}
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-white"
                >
                  <option value="all">전체 종목</option>
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
                  onChange={(e) => {
                    const grdId = e.target.value;
                    setCurrentGradeId(grdId);
                    handleSearch(currentCategoryId, grdId, currentSection);
                  }}
                  disabled={currentCategoryId === "all"}
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-white disabled:bg-slate-100"
                >
                  <option value="all">전체 체급</option>
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
                    handleSearch(currentCategoryId, currentGradeId, currentSection)
                  }
                  className="bg-slate-800 text-white rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-slate-900 transition-colors"
                >
                  새로고침
                </button>
              </div>
            )}
          </div>

          {/* 4. 인쇄 출력 대상 종이 뷰어 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto p-4 sm:p-8">
            <div
              ref={printRef}
              className="w-full max-w-4xl mx-auto bg-white min-h-[500px]"
            >
              {printType === "ranking" && resultArray.length === 0 ? (
                <div className="py-20 text-center">
                  <Empty description="확정된 순위표 데이터가 없습니다. 심판위원장 순위 확정 후 출력 가능합니다." />
                </div>
              ) : filteredPlayerList.length === 0 ? (
                <div className="py-20 text-center">
                  <Empty description="출력할 선수 데이터가 없습니다." />
                </div>
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
        </div>
      )}
    </div>
  );
};

export default UnifiedPrint;
