import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { Trophy, FileSpreadsheet, Printer } from "lucide-react";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { where } from "firebase/firestore";
import { exportContestResultsToExcel } from "../functions/functions";

const PrintPlayerStanding = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({});
  const [msgOpen, setMsgOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState("all");
  const [currentCategoryId, setCurrentCategoryId] = useState("all");
  const [currentGradeId, setCurrentGradeId] = useState("all");
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [resultArray, setResultArray] = useState([]);
  const [sectionArray, setSectionArray] = useState([]);
  const [noData, setNoData] = useState(false); // New state to handle no data scenario
  const printRef = useRef();
  const { currentContest } = useContext(CurrentContestContext);
  const fetchCategories = useFirestoreQuery();
  const fetchGrades = useFirestoreQuery();
  const fetchResults = useFirestoreQuery();

  // Function to fetch categories and grades
  const fetchCategoryAndGrades = async (contestId) => {
    const condition = [where("refContestId", "==", contestId)];
    const condition2 = [where("contestId", "==", contestId)];

    try {
      setIsLoading(true); // Start loading
      let sortedCategories = [];
      let sortedGrades = [];
      // Fetch and set categories
      await fetchCategories
        .getDocuments("contest_categorys_list", condition)
        .then((categoriesData) => {
          if (categoriesData?.[0]?.categorys) {
            sortedCategories = [...categoriesData[0].categorys].sort(
              (a, b) =>
                (a.contestCategoryIndex ?? 0) - (b.contestCategoryIndex ?? 0)
            );
            setCategoriesArray(sortedCategories);
          }
        });

      // Fetch and set grades
      await fetchGrades
        .getDocuments("contest_grades_list", condition)
        .then((gradesData) => {
          if (gradesData?.[0]?.grades) {
            sortedGrades = [...gradesData[0].grades].sort(
              (a, b) =>
                (a.contestGradeIndex ?? a.gradeIndex ?? 0) -
                (b.contestGradeIndex ?? b.gradeIndex ?? 0)
            );
            setGradesArray(sortedGrades);
          }
        });

      // Fetch results and modify them by adding category and grade indexes
      await fetchResults
        .getDocuments("contest_results_list", condition2)
        .then((resultsData) => {
          const updatedResults = (resultsData || []).map((result) => {
            const matchingCategory = sortedCategories.find(
              (category) => category.contestCategoryId === result.categoryId
            );

            const matchingGrade = sortedGrades.find(
              (grade) => grade.contestGradeId === result.gradeId
            );

            return {
              ...result,
              contestCategoryIndex: matchingCategory
                ? matchingCategory.contestCategoryIndex ?? 0
                : 0,
              contestCategoryTitle: matchingCategory
                ? matchingCategory.contestCategoryTitle
                : result.categoryTitle || "",
              contestCategorySection: matchingCategory
                ? matchingCategory.contestCategorySection
                : "",
              contestGradeIndex: matchingGrade
                ? matchingGrade.contestGradeIndex ??
                  matchingGrade.gradeIndex ??
                  0
                : 0,
            };
          });

          const groupedResults = updatedResults
            .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
            .reduce((acc, result) => {
              const { categoryId } = result;
              if (!acc[categoryId]) {
                acc[categoryId] = {
                  categoryId,
                  contestCategoryTitle: result.contestCategoryTitle,
                  contestCategoryIndex: result.contestCategoryIndex,
                  contestCategorySection: result.contestCategorySection,
                  matchedGrades: [],
                };
              }

              acc[categoryId].matchedGrades.push(result);

              acc[categoryId].matchedGrades.sort(
                (a, b) => a.contestGradeIndex - b.contestGradeIndex
              );

              return acc;
            }, {});

          // New grouping by contestCategorySection
          const sectionsGroup = updatedResults.reduce((acc, result) => {
            const { contestCategorySection } = result;
            if (!acc[contestCategorySection]) {
              acc[contestCategorySection] = {
                contestCategorySection,
                categories: [],
              };
            }

            acc[contestCategorySection].categories.push(result);

            return acc;
          }, {});

          const finalGroupedResults = Object.values(groupedResults);
          const finalSectionsGroup = Object.values(sectionsGroup);
          console.log(finalSectionsGroup);
          setResultArray(finalGroupedResults);
          setSectionArray(finalSectionsGroup);
        });
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false); // End loading
    }
  };

  const findResults = useMemo(() => {
    let newResult = [...resultArray];

    if (
      currentSection === "all" &&
      currentCategoryId === "all" &&
      currentGradeId === "all"
    ) {
      newResult = [...resultArray];
    }

    if (currentSection !== "all") {
      newResult = resultArray.filter(
        (f) => f.contestCategorySection === currentSection
      );
    }

    if (currentCategoryId !== "all") {
      newResult = newResult.filter((f) => f.categoryId === currentCategoryId);
    }

    if (currentGradeId !== "all") {
      newResult = newResult.map((category) => {
        // Filter matchedGrades array based on currentGradeId
        const filteredGrades = category.matchedGrades.filter(
          (grade) => grade.gradeId === currentGradeId
        );

        // Return the category with the filtered grades
        return {
          ...category,
          matchedGrades: filteredGrades,
        };
      });
    }

    return newResult;
  }, [resultArray, currentCategoryId, currentGradeId, currentSection]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    const flatResults = resultArray.flatMap((cat) => cat.matchedGrades || []);
    if (flatResults.length === 0) {
      alert("다운로드할 집계 데이터가 없습니다.");
      return;
    }
    try {
      setIsExporting(true);
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
        flatResults,
        categoriesMap,
        gradesMap
      );
    } catch (e) {
      console.error(e);
      alert("엑셀 다운로드 중 오류 발생: " + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const clearDeafult = () => {
    setCurrentCategoryId("all");
    setCurrentGradeId("all");
  };

  useEffect(() => {
    console.log(findResults);
  }, [findResults]);

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchCategoryAndGrades(currentContest.contests.id);
    }
  }, [currentContest?.contests]);

  useEffect(() => {
    let timer;

    // Start 3-second timer
    if (isLoading) {
      timer = setTimeout(() => {
        if (resultArray.length === 0) {
          setNoData(true); // Show "No data available" message
        }
        setIsLoading(false); // Stop loading after 3 seconds
      }, 3000);
    }

    // Clear timer if resultArray is populated before 3 seconds
    if (resultArray.length > 0) {
      console.log(resultArray);
      clearTimeout(timer);
      setIsLoading(false); // Stop loading immediately
    }

    return () => clearTimeout(timer); // Cleanup the timer on unmount or rerender
  }, [resultArray, isLoading]);

  return (
    <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
        {isLoading && <LoadingPage />}
        {!isLoading && resultArray.length === 0 && (
          <>
            <ConfirmationModal
              isOpen={msgOpen}
              message={message}
              onCancel={() => setMsgOpen(false)}
              onConfirm={() => setMsgOpen(false)}
            />
            <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-5 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#525252] flex items-center justify-center shrink-0">
                  <Trophy size={16} strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#171717] m-0">
                    순위표 출력
                  </h1>
                  <p className="text-[12px] text-[#737373] m-0 mt-0.5">
                    확정된 종목·체급별 순위표를 A4 규격으로 출력합니다.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex w-full min-h-[240px] justify-center items-center bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-[13px] text-[#737373]">
              확정된 순위표 데이터가 없습니다.
            </div>
          </>
        )}
        {!isLoading && resultArray.length > 0 && (
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
                  <Trophy size={16} strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#171717] m-0">
                    순위표 출력
                  </h1>
                  <p className="text-[12px] text-[#737373] m-0 mt-0.5">
                    확정된 종목·체급별 순위표를 A4 규격으로 출력합니다.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className="h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.12] font-medium text-[13px] inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet size={15} strokeWidth={1.5} className="text-[#525252]" />
                  <span>{isExporting ? "엑셀 생성 중..." : "전체 최종순위표 엑셀 다운로드"}</span>
                </button>
                <ReactToPrint
                  trigger={() => (
                    <button className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-[#ffffff] rounded-[8px] font-medium text-[13px] inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer">
                      <Printer size={15} strokeWidth={1.5} />
                      <span>인쇄하기</span>
                    </button>
                  )}
                  content={() => printRef.current}
                  pageStyle={`
                       @page {
      size: A4;
      margin: 0;
      margin-top: 50px;
      margin-bottom: 50px;
    }
    @page::after {
      content: counter(page);
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      font-size: 16px;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
      }
      .footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 12px;
      }
      .page-break { page-break-inside:avoid; page-break-after:auto }
    }
                    `}
                />
              </div>
            </div>

            {/* Category and Grade Selection */}
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
                    clearDeafult();
                  }}
                >
                  전체
                </button>
                {sectionArray?.length > 0 &&
                  sectionArray.map((section, sIdx) => {
                    const { contestCategorySection } = section;
                    return (
                      <button
                        key={contestCategorySection || sIdx}
                        className={`h-7 px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-150 ${
                          currentSection === contestCategorySection
                            ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                            : "text-[#525252] hover:text-[#171717]"
                        }`}
                        onClick={() => {
                          setCurrentSection(contestCategorySection);
                          clearDeafult();
                        }}
                      >
                        {contestCategorySection}
                      </button>
                    );
                  })}
              </div>

              <select
                value={currentCategoryId}
                onChange={(e) => setCurrentCategoryId(e.target.value)}
                className="h-9 border border-[#171717]/[0.12] rounded-[8px] px-3 text-[13px] font-normal text-[#171717] bg-[#ffffff] focus:outline-none focus:border-[#2563eb]"
              >
                <option value="all">전체 종목</option>
                {findResults.length > 0 &&
                  findResults.map((category) => (
                    <option
                      key={category.categoryId}
                      value={category.categoryId}
                    >
                      {category?.contestCategoryTitle}
                    </option>
                  ))}
              </select>

              <select
                value={currentGradeId}
                onChange={(e) => setCurrentGradeId(e.target.value)}
                className="h-9 border border-[#171717]/[0.12] rounded-[8px] px-3 text-[13px] font-normal text-[#171717] bg-[#ffffff] focus:outline-none focus:border-[#2563eb]"
              >
                <option value="all">전체 체급</option>
                {findResults
                  .find((f) => f.categoryId === currentCategoryId)
                  ?.matchedGrades?.map((grade) => {
                    return (
                      <option key={grade.gradeId} value={grade.gradeId}>
                        {grade.gradeTitle}
                      </option>
                    );
                  })}
              </select>

              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.12] ml-auto font-medium text-[13px] inline-flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-50"
              >
                <FileSpreadsheet size={15} strokeWidth={1.5} className="text-[#525252]" />
                <span>{isExporting ? "생성 중..." : "엑셀 다운로드"}</span>
              </button>
            </div>

            <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-x-auto print:border-0 print:shadow-none">
              <div
                className="flex w-full h-full p-5 flex-col gap-y-2"
                ref={printRef}
              >
                  {findResults?.length > 0 &&
                    findResults.map((result) => {
                      const { contestCategoryTitle, matchedGrades } = result;

                      return (
                        <div
                          key={result.categoryId}
                          className="gap-y-2"
                          style={{ pageBreakAfter: "always" }}
                        >
                          {matchedGrades?.length > 0 &&
                            [...matchedGrades]
                              .sort(
                                (a, b) =>
                                  (a.contestGradeIndex ?? 0) -
                                  (b.contestGradeIndex ?? 0)
                              )
                              .map((grade, gIdx) => {
                                const { gradeTitle, result } = grade;

                                return (
                                  <div
                                    key={grade.gradeId || gIdx}
                                    className="flex flex-col"
                                  >
                                    <div className="flex w-full h-14 border border-r-2 border-b-0  border-black justify-center items-center">
                                      <span
                                        className="text-2xl font-semibold"
                                        style={{ letterSpacing: "0px" }}
                                      >
                                        {`${contestCategoryTitle} ${gradeTitle} 순위`}
                                      </span>
                                    </div>
                                    <div className="flex w-full h-full justify-center items-center flex-col mb-10">
                                      <div className="flex w-full h-auto flex-col">
                                        <div className="flex w-full h-10">
                                          <div className="flex w-1/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                            <span>순위</span>
                                          </div>

                                          <div className="flex w-5/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l ">
                                            <span>선수번호. 이름</span>
                                          </div>
                                          <div className="flex w-6/12 justify-center items-center font-semibold border-b-0 border-black  border-t first:border-l last: border-r-2">
                                            <span>소속</span>
                                          </div>
                                        </div>
                                      </div>
                                      {result?.length > 0 &&
                                        [...result]
                                          .sort(
                                            (a, b) =>
                                              a.playerRank - b.playerRank
                                          )
                                          .map((player, pIdx) => {
                                            const {
                                              playerRank,
                                              playerName,
                                              playerNumber,
                                              playerGym,
                                            } = player;

                                            // playerRank가 1000 이상이면 건너뛰기
                                            if (playerRank >= 1000) {
                                              return null;
                                            }

                                            return (
                                              <div
                                                key={`${playerNumber}-${pIdx}`}
                                                className="flex w-full h-10 last:border-b-2 border-black "
                                              >
                                                <div className="flex w-1/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                                  <span>{playerRank}</span>
                                                </div>
                                                <div className="flex w-5/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                                  <span>
                                                    {playerNumber}. {playerName}
                                                  </span>
                                                </div>
                                                <div className="flex w-6/12 justify-center items-center font-semibold border-b-0 border-black  border-t first:border-l last: border-r-2">
                                                  <span>{playerGym}</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                    </div>
                                  </div>
                                );
                              })}
                        </div>
                      );
                    })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PrintPlayerStanding;
