import React, { useState, useEffect, useRef, useContext } from "react";
import LoadingPage from "../pages/LoadingPage";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { HiUserGroup } from "react-icons/hi";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { where } from "firebase/firestore";
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
      if (gradesData[0]) {
        sortedGrades = gradesData[0].grades.sort(
          (a, b) => a.gradeIndex - b.gradeIndex
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
      setIsLoading(false);
    }
  };

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
    setShowContestRankingSummary(true);
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
    <div
      className={`flex flex-col w-full h-full ${
        isTabletOrMobile ? "bg-gray-100 p-2" : "bg-gray-50 p-4"
      }`}
    >
      {isLoading && <LoadingPage />}
      {!isLoading && (
        <>
          <ConfirmationModal
            isOpen={msgOpen}
            message={message}
            onCancel={() => setMsgOpen(false)}
            onConfirm={() => setMsgOpen(false)}
          />
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
              <HiUserGroup />
            </span>
            <h1
              className="font-sans text-lg font-semibold"
              style={{ letterSpacing: "2px" }}
            >
              집계표 출력
            </h1>
          </div>
          <div className="flex flex-wrap w-full mb-4 gap-2 px-3">
            <button
              className={`px-4 py-2 rounded-lg border ${
                currentSection === "all"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700"
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
                  className={`px-4 py-2 rounded-lg border ${
                    currentSection === section
                      ? "bg-blue-500 text-white"
                      : "bg-white text-gray-700"
                  }`}
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
                setCurrentGradeId("all");
              }}
              className="border rounded-lg p-2"
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
              className={`border rounded-lg p-2 ${
                currentCategoryId === "all"
                  ? "bg-gray-200 cursor-not-allowed"
                  : ""
              }`}
              disabled={currentCategoryId === "all"}
            >
              <option value="all">체급선택</option>
              {currentCategoryId !== "all" &&
                gradesArray
                  .filter((grade) => grade.refCategoryId === currentCategoryId)
                  .map((grade) => (
                    <option
                      key={grade.contestGradeId}
                      value={grade.contestGradeId}
                    >
                      {grade.contestGradeTitle}
                    </option>
                  ))}
            </select>
            <button
              className="bg-blue-500 text-white rounded-lg px-4 py-2"
              onClick={handleSearch}
            >
              검색
            </button>
          </div>
          <div className="flex w-full h-full bg-white overflow-y-auto p-4 justify-center">
            {showContestRankingSummary ? (
              noData ? (
                <div className="text-center text-red-500">
                  데이터가 없습니다.
                </div>
              ) : (
                <ContestRankingSummaryPrintAll
                  props={searchParams}
                  results={filteredResults}
                  setClose={() => setShowContestRankingSummary(false)}
                />
              )
            ) : (
              <div className="text-center text-gray-500">
                체급까지 선택하세요.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PrintSummary;
