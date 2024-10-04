import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { HiUserGroup } from "react-icons/hi";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { where } from "firebase/firestore";
import ContestRankingSummaryPrintAll from "../modals/ContestRankingSummaryPrintAll";

const PrintSummary = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({});
  const [msgOpen, setMsgOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [currentSection, setCurrentSection] = useState("all");
  const [currentCategoryId, setCurrentCategoryId] = useState("all");
  const [currentGradeId, setCurrentGradeId] = useState("all");
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [resultArray, setResultArray] = useState([]);
  const [sectionArray, setSectionArray] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]); // 검색 후 보여줄 필터링된 결과
  const [noData, setNoData] = useState(false); // No data 처리
  const [showContestRankingSummary, setShowContestRankingSummary] =
    useState(false); // 추가
  const [searchParams, setSearchParams] = useState({}); // 검색 시 넘길 파라미터 추가
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
      let sortedCategories;
      let sortedGrades;
      // Fetch and set categories
      await fetchCategories
        .getDocuments("contest_categorys_list", condition)
        .then((categoriesData) => {
          if (categoriesData[0]) {
            sortedCategories = categoriesData[0].categorys.sort(
              (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
            );
            setCategoriesArray(sortedCategories);
          }
        });

      // Fetch and set grades
      await fetchGrades
        .getDocuments("contest_grades_list", condition)
        .then((gradesData) => {
          if (gradesData[0]) {
            sortedGrades = gradesData[0].grades.sort(
              (a, b) => a.gradeIndex - b.gradeIndex
            );
            setGradesArray(sortedGrades);
          }
        });

      // Fetch results and modify them by adding category and grade indexes
      await fetchResults
        .getDocuments("contest_results_list", condition2)
        .then((resultsData) => {
          const updatedResults = resultsData.map((result) => {
            const matchingCategory = sortedCategories.find(
              (category) => category.contestCategoryId === result.categoryId
            );

            const matchingGrade = sortedGrades.find(
              (grade) => grade.contestGradeId === result.gradeId
            );

            return {
              ...result,
              contestCategoryIndex: matchingCategory
                ? matchingCategory.contestCategoryIndex
                : null,
              contestCategoryTitle: matchingCategory
                ? matchingCategory.contestCategoryTitle
                : null,
              contestCategorySection: matchingCategory
                ? matchingCategory.contestCategorySection
                : null,
              contestGradeIndex: matchingGrade
                ? matchingGrade.contestGradeIndex
                : null,
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

          // Group by contestCategorySection
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

          setResultArray(finalGroupedResults);
          setSectionArray(finalSectionsGroup);
        });
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false); // End loading
    }
  };

  // 필터링된 데이터를 검색 버튼을 눌렀을 때만 설정
  const handleSearch = () => {
    let newResult = [...resultArray];

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
        const filteredGrades = category.matchedGrades.filter(
          (grade) => grade.gradeId === currentGradeId
        );
        return { ...category, matchedGrades: filteredGrades };
      });
    }

    setSearchParams({
      contestId: currentContest?.contests?.id,
      categoryId: currentCategoryId,
      gradeId: currentGradeId,
    });

    setFilteredResults(newResult); // 기존 결과 필터링
    setShowContestRankingSummary(true); // 검색 후 컴포넌트 보여주기
  };

  const clearDeafult = () => {
    setCurrentCategoryId("all");
    setCurrentGradeId("all");
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      setCollectionName(currentContest.contests.collectionName);
      fetchCategoryAndGrades(currentContest.contests.id);
    }
  }, [currentContest?.contests, currentSection]);

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-2 gap-y-2">
      {isLoading && <LoadingPage />}
      {!isLoading && resultArray.length > 0 && (
        <>
          <div className="flex w-full h-14">
            <ConfirmationModal
              isOpen={msgOpen}
              message={message}
              onCancel={() => setMsgOpen(false)}
              onConfirm={() => setMsgOpen(false)}
            />
            <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
              <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
                <HiUserGroup />
              </span>
              <h1
                className="font-sans text-lg font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                집계표 출력
              </h1>
            </div>
          </div>
          <div className="flex w-full h-full justify-start px-3 pt-3 flex-col bg-gray-100 rounded-lg gap-y-2">
            <div className="flex h-full w-full gap-x-2 bg-gray-100">
              <div className="flex flex-col w-full h-full bg-white rounded-b-lg p-2 gap-y-2">
                {/* Category and Grade Selection */}
                <div className="flex w-full justify-center px-5 gap-x-2">
                  <button
                    className="w-24 h-10 bg-white rounded-lg border border-blue-500"
                    onClick={() => {
                      setCurrentSection("all");
                      clearDeafult();
                    }}
                  >
                    전체
                  </button>
                  {sectionArray?.length > 0 &&
                    sectionArray.map((section) => {
                      const { contestCategorySection } = section;
                      return (
                        <button
                          key={contestCategorySection}
                          className="w-24 h-10 bg-white rounded-lg border border-blue-500"
                          onClick={() => {
                            setCurrentSection(contestCategorySection);
                            clearDeafult();
                          }}
                        >
                          {contestCategorySection}
                        </button>
                      );
                    })}

                  <select
                    value={currentCategoryId}
                    onChange={(e) => setCurrentCategoryId(e.target.value)}
                    className="w-48 h-10 border border-blue-500"
                  >
                    <option value="all">종목선택</option>
                    {resultArray.length > 0 &&
                      resultArray.map((category) => (
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
                    className="w-48 h-10 border border-blue-500 ml-2"
                  >
                    <option value="all">체급선택</option>
                    {resultArray
                      .find((f) => f.categoryId === currentCategoryId)
                      ?.matchedGrades?.map((grade) => (
                        <option key={grade.gradeId} value={grade.gradeId}>
                          {grade.gradeTitle}
                        </option>
                      ))}
                  </select>

                  {/* 검색 버튼 추가 */}
                  <button
                    className="w-28 h-10 bg-blue-300 rounded-lg"
                    onClick={handleSearch}
                  >
                    검색
                  </button>
                </div>

                <div
                  className="flex w-full h-full p-5 flex-col gap-y-2"
                  ref={printRef}
                >
                  {showContestRankingSummary ? (
                    <ContestRankingSummaryPrintAll
                      props={searchParams} // 검색된 파라미터를 전달
                      setClose={() => setShowContestRankingSummary(false)} // 닫기 버튼 핸들러
                    />
                  ) : (
                    // 기존 테이블 렌더링 로직은 여기서 제외하거나 유지할 수 있습니다.
                    <div>검색을 통해 결과를 확인하세요.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PrintSummary;
