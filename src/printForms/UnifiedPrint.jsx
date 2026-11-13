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
import {
  Scale,
  Users,
  PieChart,
  Printer,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import PrintTable from "./PrintTable";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import {
  exportContestResultsToExcel,
  getStagePlayerSortIndex,
  isGrandPrixPlayerEntry,
} from "../functions/functions";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Empty } from "antd";
import { useDevice } from "../contexts/DeviceContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const UnifiedPrint = ({ forcedPrintType, hideTopTabs = false }) => {
  const { isTabletOrMobile } = useDevice();
  const params = useParams();
  const printType = forcedPrintType || params.printType || "measurement";
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});
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
    {
      type: "measurement",
      label: "계측 명단 출력",
      path: "/print/measurement",
      icon: <Scale size={14} strokeWidth={1.5} />,
    },
    {
      type: "final",
      label: "출전 명단 출력",
      path: "/print/final",
      icon: <Users size={14} strokeWidth={1.5} />,
    },
    {
      type: "ranking",
      label: "순위표 출력",
      path: "/print/ranking",
      icon: <PieChart size={14} strokeWidth={1.5} />,
    },
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
            contestCategoryIndex: category?.contestCategoryIndex ?? 0,
            contestGradeIndex:
              grade?.contestGradeIndex ?? grade?.gradeIndex ?? 0,
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

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    const contestId = currentContest?.contests?.id;
    if (!contestId) {
      setModalMessage({
        variant: "warning",
        title: "대회 선택 필요",
        body: "현재 선택된 대회 정보가 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }
    try {
      setIsExporting(true);
      const q = query(
        collection(db, "contest_results_list"),
        where("contestId", "==", contestId)
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (rows.length === 0) {
        setModalMessage({
          variant: "warning",
          title: "다운로드할 결과 없음",
          body: "집계된 최종 순위 결과 데이터가 없습니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        return;
      }

      const contestTitle =
        currentContest?.contestInfo?.contestTitle ||
        currentContest?.contests?.contestTitle ||
        documentTitle ||
        "제2회 DMZ한반도평화통일기원보디빌딩대회";

      const categoriesMap = {};
      categoriesArray.forEach((c) => {
        categoriesMap[c.contestCategoryId] = c;
      });

      const gradesMap = {};
      gradesArray.forEach((g) => {
        gradesMap[g.contestGradeId] = g;
      });

      await exportContestResultsToExcel(
        contestTitle,
        rows,
        categoriesMap,
        gradesMap
      );
    } catch (e) {
      console.error(e);
      setModalMessage({
        variant: "error",
        title: "엑셀 다운로드 실패",
        body: "엑셀 파일을 생성하는 중 오류가 발생했습니다.",
        body4: e?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsExporting(false);
    }
  };

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
            .sort(
              (a, b) =>
                (a.contestGradeIndex ?? a.gradeIndex ?? 0) -
                (b.contestGradeIndex ?? b.gradeIndex ?? 0)
            )
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

                  const isGpRow = isGrandPrixPlayerEntry(player, category);

                  if (printType === "final") {
                    if (player.playerNoShow) {
                      note = "불참";
                    } else if (isGpRow && player.originalgradeTitle) {
                      note = `${player.originalgradeTitle} 1위`;
                    } else if (!isGpRow && player.isGradeChanged) {
                      note = "월체 반영됨";
                    }
                  }

                  return {
                    index: index + 1,
                    playerNumber: player.playerNumber,
                    contestCategorySection:
                      player.contestCategorySection ||
                      category?.contestCategorySection ||
                      category?.categorySection,
                    contestCategoryTitle:
                      player.contestCategoryTitle ||
                      category?.contestCategoryTitle ||
                      category?.categoryTitle,
                    grandPrixIndex: isGpRow ? player.grandPrixIndex : undefined,
                    playerIndex: getStagePlayerSortIndex(player, category),
                    playerName,
                    heightWeight: player.heightWeight || "",
                    playerGym: player.playerGym || "",
                    note,
                  };
                });

              return {
                contestGradeTitle:
                  grade.contestGradeTitle || grade.gradeTitle || "",
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
        { label: "비고", key: "note", width: 25 },
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
            (a, b) =>
              getStagePlayerSortIndex(a, category) -
              getStagePlayerSortIndex(b, category)
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
    <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />
      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
        {/* 1. 상단 출력 관리 전체 네비게이션 탭 바 */}
        {!hideTopTabs && (
          <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-2 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-1 overflow-x-auto overflow-y-hidden no-scrollbar">
              {printTabs.map((tab) => {
                const isActive = !tab.isExternal && printType === tab.type;

                return (
                  <Link
                    key={tab.type}
                    to={tab.path}
                    className={`h-9 px-3.5 rounded-[8px] text-[13px] font-medium no-underline whitespace-nowrap transition-colors duration-150 inline-flex items-center gap-1.5 ${
                      isActive
                        ? "bg-[#2563eb] text-[#ffffff]"
                        : "text-[#525252] hover:bg-[#f4f4f5] hover:text-[#171717]"
                    }`}
                  >
                    {tab.icon && <span className="inline-flex items-center">{tab.icon}</span>}
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {isLoading ? (
          <LoadingPage />
        ) : (
          <div className="space-y-5">
            {/* 2. 문서 타이틀 바 및 컨트롤 패널 */}
            <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-5 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#525252] flex items-center justify-center shrink-0">
                  {printType === "measurement" ? (
                    <Scale size={16} strokeWidth={1.5} />
                  ) : printType === "final" ? (
                    <Users size={16} strokeWidth={1.5} />
                  ) : (
                    <PieChart size={16} strokeWidth={1.5} />
                  )}
                </div>
                <div>
                  <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#171717] m-0">
                    {documentTitle}
                  </h1>
                  <p className="text-[12px] text-[#737373] m-0 mt-0.5">
                    A4 용지 규격 인쇄 양식 · 미리보기 및 출력
                  </p>
                </div>
              </div>

              {/* 액션 버튼 그룹 (엑셀 다운로드 + 인쇄) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className="h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.12] font-medium text-[13px] inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet size={15} strokeWidth={1.5} className="text-[#525252]" />
                  <span>{isExporting ? "엑셀 생성 중..." : "엑셀 다운로드"}</span>
                </button>

                {/* 인쇄 버튼 */}
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
            </div>

            {/* 3. 섹션 & 종목/체급 필터 바 */}
            <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-4 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-[#737373] mr-1">부/종목 구분</span>
              <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-[8px] bg-[#f4f4f5]">
                {sectionList.map((section, idx) => (
                  <button
                    key={idx}
                    className={`h-7 px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-150 ${
                      currentSection === section
                        ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                        : "text-[#525252] hover:text-[#171717]"
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
              </div>

              {/* 순위표 검색 필터 */}
              {printType === "ranking" && (
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  <select
                    value={currentCategoryId}
                    onChange={(e) => {
                      const catId = e.target.value;
                      setCurrentCategoryId(catId);
                      handleSearch(catId, "all", currentSection);
                    }}
                    className="h-9 border border-[#171717]/[0.12] rounded-[8px] px-3 text-[13px] font-normal text-[#171717] bg-[#ffffff] focus:outline-none focus:border-[#2563eb]"
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
                    className="h-9 border border-[#171717]/[0.12] rounded-[8px] px-3 text-[13px] font-normal text-[#171717] bg-[#ffffff] disabled:bg-[#f4f4f5] disabled:text-[#737373] focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="all">전체 체급</option>
                    {availableGrades.map((grade) => (
                      <option
                        key={grade.contestGradeId}
                        value={grade.contestGradeId}
                      >
                        {grade.contestGradeTitle || grade.gradeTitle}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() =>
                      handleSearch(currentCategoryId, currentGradeId, currentSection)
                    }
                    className="h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.12] text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150"
                  >
                    <RefreshCw size={14} strokeWidth={1.5} className="text-[#525252]" />
                    <span>새로고침</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. 인쇄 출력 대상 종이 뷰어 */}
            <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-x-auto p-4 sm:p-8 print:border-0 print:shadow-none print:p-0">
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
    </div>
  );
};

export default UnifiedPrint;
