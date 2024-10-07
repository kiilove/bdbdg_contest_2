import React, { useState, useEffect, useRef, useContext } from "react";
import LoadingPage from "../pages/LoadingPage";
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

  // Function to fetch categories, grades, and sections
  const fetchCategoryAndGrades = async (contestId) => {
    const condition = [where("refContestId", "==", contestId)];
    const condition2 = [where("contestId", "==", contestId)];

    try {
      setIsLoading(true); // Start loading

      // Fetch and set categories
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

      // Fetch and set grades
      const gradesData = await fetchGrades.getDocuments(
        "contest_grades_list",
        condition
      );
      let sortedGrades = [];
      if (gradesData[0]) {
        sortedGrades = gradesData[0].grades.sort(
          (a, b) => a.gradeIndex - b.gradeIndex
        );
        setGradesArray(sortedGrades);
      }

      // Extract unique sections from categories
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
      setIsLoading(false); // End loading
    }
  };

  // Function to fetch results based on search parameters
  const fetchResultsData = async (contestId, categoryId, gradeId) => {
    const conditions = [where("contestId", "==", contestId)];
    if (categoryId !== "all") {
      conditions.push(where("categoryId", "==", categoryId));
    }
    if (gradeId !== "all") {
      conditions.push(where("gradeId", "==", gradeId));
    }

    try {
      setIsLoading(true); // Start loading
      const resultsData = await fetchResults.getDocuments(
        "contest_results_list",
        conditions
      );

      if (resultsData.length === 0) {
        setNoData(true);
        setFilteredResults([]);
        return;
      }

      // Enrich results with category and grade details
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
          contestGradeTitle: grade ? grade.gradeTitle : "",
        };
      });

      setFilteredResults(enrichedResults);
      setNoData(false);
    } catch (error) {
      console.error("Error fetching results:", error);
      setNoData(true);
      setFilteredResults([]);
    } finally {
      setIsLoading(false); // End loading
    }
  };

  // Handle search button click
  const handleSearch = () => {
    if (!currentContest?.contests?.id) {
      setMessage({ text: "대회 정보가 없습니다." });
      setMsgOpen(true);
      return;
    }

    if (currentCategoryId === "all" || currentGradeId === "all") {
      setMessage({ text: "종목과 체급을 선택해주세요." });
      setMsgOpen(true);
      return;
    }

    setSearchParams({
      contestId: currentContest.contests.id,
      categoryId: currentCategoryId,
      gradeId: currentGradeId,
    });

    fetchResultsData(
      currentContest.contests.id,
      currentCategoryId,
      currentGradeId
    );
    setShowContestRankingSummary(true); // Show results
  };

  // Clear category and grade selections
  const clearDefault = () => {
    setCurrentCategoryId("all");
    setCurrentGradeId("all");
  };

  // Fetch categories and grades on component mount or when contest changes
  useEffect(() => {
    if (currentContest?.contests?.id) {
      setCollectionName(currentContest.contests.collectionName);
      fetchCategoryAndGrades(currentContest.contests.id);
    }
    // Only run when currentContest changes to avoid infinite loops
  }, [currentContest?.contests?.id]);

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-2 gap-y-2">
      {isLoading && <LoadingPage />}
      {!isLoading && (
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
                      clearDefault();
                    }}
                  >
                    전체
                  </button>
                  {sectionArray.length > 0 &&
                    sectionArray.map((section) => (
                      <button
                        key={section}
                        className="w-24 h-10 bg-white rounded-lg border border-blue-500"
                        onClick={() => {
                          setCurrentSection(section);
                          clearDefault();
                        }}
                      >
                        {section}
                      </button>
                    ))}

                  <select
                    value={currentCategoryId}
                    onChange={(e) => {
                      setCurrentCategoryId(e.target.value);
                      setCurrentGradeId("all"); // Reset grade selection when category changes
                    }}
                    className="w-48 h-10 border border-blue-500"
                  >
                    <option value="all">종목선택</option>
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
                    className="w-48 h-10 border border-blue-500 ml-2"
                    disabled={currentCategoryId === "all"}
                  >
                    <option value="all">체급선택</option>
                    {currentCategoryId !== "all" &&
                      gradesArray
                        .filter(
                          (grade) => grade.refCategoryId === currentCategoryId
                        )
                        .map((grade) => (
                          <option
                            key={grade.contestGradeId}
                            value={grade.contestGradeId}
                          >
                            {grade.contestGradeTitle}
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
                    noData ? (
                      <div className="text-center text-red-500">
                        데이터가 없습니다.
                      </div>
                    ) : (
                      <ContestRankingSummaryPrintAll
                        props={searchParams} // Pass search parameters
                        results={filteredResults} // Pass fetched results
                        setClose={() => setShowContestRankingSummary(false)} // Close handler
                      />
                    )
                  ) : (
                    <div className="text-center text-gray-500">
                      검색을 통해 결과를 확인하세요.
                    </div>
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
