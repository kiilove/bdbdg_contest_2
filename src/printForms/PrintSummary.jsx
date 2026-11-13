import React, { useState, useEffect, useRef, useContext } from "react";
import LoadingPage from "../pages/LoadingPage";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { FileText, FileSpreadsheet, Search } from "lucide-react";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { exportContestResultsToExcel } from "../functions/functions";
import ContestRankingSummaryPrintAll from "../modals/ContestRankingSummaryPrintAll";
import { useDevice } from "../contexts/DeviceContext";

const PrintSummary = () => {
  const { isTabletOrMobile } = useDevice();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({});
  const [msgOpen, setMsgOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [currentSection, setCurrentSection] = useState("all");
  const [currentCategoryId, setCurrentCategoryId] = useState("all");
  const [currentGradeId, setCurrentGradeId] = useState("all");
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [sectionArray, setSectionArray] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]); // Filtered results after search
  const [noData, setNoData] = useState(false); // No data flag
  const [showContestRankingSummary, setShowContestRankingSummary] =
    useState(false);
  const [searchParams, setSearchParams] = useState({});
  const printRef = useRef();
  const { currentContest } = useContext(CurrentContestContext);
  const fetchCategories = useFirestoreQuery();
  const fetchGrades = useFirestoreQuery();
  const fetchResults = useFirestoreQuery();

  const fetchCategoryAndGrades = async (contestId) => {
    const condition = [where("refContestId", "==", contestId)];
    try {
      setIsLoading(true);
      const categoriesData = await fetchCategories.getDocuments(
        "contest_categorys_list",
        condition
      );
      let sortedCategories = [];
      if (categoriesData[0]) {
        sortedCategories = categoriesData[0].categorys.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        );
        setCategoriesArray(sortedCategories);
      }

      const gradesData = await fetchGrades.getDocuments(
        "contest_grades_list",
        condition
      );
      let sortedGrades = [];
      if (gradesData?.[0]?.grades) {
        sortedGrades = [...gradesData[0].grades].sort(
          (a, b) =>
            (a.contestGradeIndex ?? a.gradeIndex ?? 0) -
            (b.contestGradeIndex ?? b.gradeIndex ?? 0)
        );
        setGradesArray(sortedGrades);
      }

      const sectionsGroup = sortedCategories.reduce((acc, category) => {
        const { contestCategorySection } = category;
        if (!acc.includes(contestCategorySection)) {
          acc.push(contestCategorySection);
        }
        return acc;
      }, []);

      setSectionArray(sectionsGroup);
    } catch (error) {
      console.error("Error fetching categories and grades:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchResultsData = async (contestId, categoryId, gradeId) => {
    const conditions = [where("contestId", "==", contestId)];
    if (categoryId !== "all") {
      conditions.push(where("categoryId", "==", categoryId));
    }
    if (gradeId !== "all") {
      conditions.push(where("gradeId", "==", gradeId));
    }

    try {
      setIsLoading(true);
      const resultsData = await fetchResults.getDocuments(
        "contest_results_list",
        conditions
      );

      if (resultsData.length === 0) {
        setNoData(true);
        setFilteredResults([]);
        return;
      }

      const enrichedResults = resultsData.map((result) => {
        const category = categoriesArray.find(
          (cat) => cat.contestCategoryId === result.categoryId
        );
        const grade = gradesArray.find(
          (grd) => grd.contestGradeId === result.gradeId
        );
        return {
          ...result,
          contestCategoryTitle: category ? category.contestCategoryTitle : "",
          contestGradeTitle: grade
            ? grade.contestGradeTitle || grade.gradeTitle || ""
            : "",
        };
      });

      setFilteredResults(enrichedResults);
      setNoData(false);
    } catch (error) {
      console.error("Error fetching results:", error);
      setNoData(true);
      setFilteredResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    if (!currentContest?.contests?.id) {
      setMessage({
        variant: "warning",
        title: "대회 선택 필요",
        body: "현재 선택된 대회 정보가 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    if (currentCategoryId === "all" || currentGradeId === "all") {
      setMessage({
        variant: "warning",
        title: "조회 대상 선택 필요",
        body: "조회할 종목과 세부 체급을 모두 선택해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    const selectedCategory = categoriesArray.find(
      (cat) => cat.contestCategoryId === currentCategoryId
    );

    setSearchParams({
      contestId: currentContest.contests.id,
      categoryId: currentCategoryId,
      gradeId: currentGradeId,
      categoryJudgeType: selectedCategory?.contestCategoryJudgeType,
    });

    fetchResultsData(
      currentContest.contests.id,
      currentCategoryId,
      currentGradeId
    );
    setShowContestRankingSummary(true);
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    const contestId = currentContest?.contests?.id;
    if (!contestId) {
      setMessage({
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
        setMessage({
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
      setMessage({
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

  const clearDefault = () => {
    setCurrentCategoryId("all");
    setCurrentGradeId("all");
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      setCollectionName(currentContest.contests.collectionName);
      fetchCategoryAndGrades(currentContest.contests.id);
    }
  }, [currentContest?.contests?.id]);

  return (
    <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
      <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-5">
        {isLoading && <LoadingPage />}
        {!isLoading && (
          <>
            <ConfirmationModal
              isOpen={msgOpen}
              message={message}
              onCancel={() => setMsgOpen(false)}
              onConfirm={() => setMsgOpen(false)}
            />
            <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-5 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#525252] flex items-center justify-center shrink-0">
                  <FileText size={16} strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#171717] m-0">
                    집계표 출력
                  </h1>
                  <p className="text-[12px] text-[#737373] m-0 mt-0.5">
                    종목 및 체급별 상세 채점 집계표를 조회하고 출력합니다.
                  </p>
                </div>
              </div>
              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.12] font-medium text-[13px] inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet size={15} strokeWidth={1.5} className="text-[#525252]" />
                <span>{isExporting ? "엑셀 생성 중..." : "전체 최종순위표 엑셀 다운로드"}</span>
              </button>
            </div>

            <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-4 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-2">
              <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-[8px] bg-[#f4f4f5]">
                <button
                  className={`h-7 px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-150 ${
                    currentSection === "all"
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                  onClick={() => {
                    setCurrentSection("all");
                    clearDefault();
                  }}
                >
                  전체
                </button>
                {sectionArray.length > 0 &&
                  sectionArray.map((section) => (
                    <button
                      key={section}
                      className={`h-7 px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-150 ${
                        currentSection === section
                          ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                          : "text-[#525252] hover:text-[#171717]"
                      }`}
                      onClick={() => {
                        setCurrentSection(section);
                        clearDefault();
                      }}
                    >
                      {section}
                    </button>
                  ))}
              </div>

              <select
                value={currentCategoryId}
                onChange={(e) => {
                  setCurrentCategoryId(e.target.value);
                  setCurrentGradeId("all");
                }}
                className="h-9 border border-[#171717]/[0.12] rounded-[8px] px-3 text-[13px] font-normal text-[#171717] bg-[#ffffff] focus:outline-none focus:border-[#2563eb]"
              >
                <option value="all">종목 선택</option>
                {categoriesArray
                  .filter(
                    (category) =>
                      currentSection === "all" ||
                      category.contestCategorySection === currentSection
                  )
                  .map((category) => (
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
                className="h-9 border border-[#171717]/[0.12] rounded-[8px] px-3 text-[13px] font-normal text-[#171717] bg-[#ffffff] disabled:bg-[#f4f4f5] disabled:text-[#737373] disabled:cursor-not-allowed focus:outline-none focus:border-[#2563eb]"
                disabled={currentCategoryId === "all"}
              >
                <option value="all">체급 선택</option>
                {currentCategoryId !== "all" &&
                  gradesArray
                    .filter((grade) => grade.refCategoryId === currentCategoryId)
                    .map((grade) => (
                      <option
                        key={grade.contestGradeId}
                        value={grade.contestGradeId}
                      >
                        {grade.contestGradeTitle || grade.gradeTitle}
                      </option>
                    ))}
              </select>

              <button
                className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-[#ffffff] text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150"
                onClick={handleSearch}
              >
                <Search size={14} strokeWidth={1.5} />
                <span>조회</span>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.12] ml-auto font-medium text-[13px] inline-flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-50"
              >
                <FileSpreadsheet size={15} strokeWidth={1.5} className="text-[#525252]" />
                <span>{isExporting ? "생성 중..." : "엑셀 다운로드"}</span>
              </button>
            </div>

            <div className="print-sheet-preview flex w-full bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-y-auto p-6 justify-center min-h-[320px] print:border-0 print:shadow-none print:p-0">
              {showContestRankingSummary ? (
                noData ? (
                  <div className="py-16 text-center text-[13px] text-[#dc2626]">
                    집계된 데이터가 없습니다.
                  </div>
                ) : (
                  <ContestRankingSummaryPrintAll
                    props={searchParams}
                    results={filteredResults}
                    setClose={() => setShowContestRankingSummary(false)}
                  />
                )
              ) : (
                <div className="py-16 text-center text-[13px] text-[#737373]">
                  상단 필터에서 종목과 체급을 선택한 뒤 조회하세요.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PrintSummary;
