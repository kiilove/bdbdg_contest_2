import React, { useState, useEffect, useMemo, useContext, useRef } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import { HiUserGroup } from "react-icons/hi";
import PrintTable from "./PrintTable";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { where } from "firebase/firestore";
import { useDevice } from "../contexts/DeviceContext";

const StandingPrint = () => {
  const { isTabletOrMobile } = useDevice();
  const [isLoading, setIsLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState("all");
  const [currentCategoryId, setCurrentCategoryId] = useState("all");
  const [currentGradeId, setCurrentGradeId] = useState("all");
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [resultArray, setResultArray] = useState([]);
  const printRef = useRef();
  const { currentContest } = useContext(CurrentContestContext);
  const fetchCategories = useFirestoreQuery();
  const fetchGrades = useFirestoreQuery();
  const fetchResults = useFirestoreQuery();

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchCategoryAndGrades(currentContest.contests.id);
    }
  }, [currentContest?.contests]);

  const fetchCategoryAndGrades = async (contestId) => {
    setIsLoading(true);
    const condition = [where("refContestId", "==", contestId)];
    try {
      const categoriesData = await fetchCategories.getDocuments(
        "contest_categorys_list",
        condition
      );
      const gradesData = await fetchGrades.getDocuments(
        "contest_grades_list",
        condition
      );

      setCategoriesArray(categoriesData?.[0]?.categorys || []);
      setGradesArray(gradesData?.[0]?.grades || []);
    } catch (error) {
      console.error("데이터 로드 중 오류 발생:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (contestId, categoryId, gradeId) => {
    try {
      if (!contestId) {
        console.error("Contest ID가 유효하지 않습니다.");
        return;
      }

      const conditions = [where("contestId", "==", contestId)];

      if (categoryId !== "all" && categoryId) {
        conditions.push(where("categoryId", "==", categoryId));
      }
      if (gradeId !== "all" && gradeId) {
        conditions.push(where("gradeId", "==", gradeId));
      }

      setIsLoading(true);

      const resultsData = await fetchResults.getDocuments(
        "contest_results_list",
        conditions
      );

      setResultArray(resultsData || []);
    } catch (error) {
      console.error("검색 중 오류 발생:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 데이터 형식을 맞추고 순위에 따라 정렬하는 함수
  const formatResultArray = (data) => {
    return data.map((item) => ({
      contestCategoryTitle: item.categoryTitle,
      grades: [
        {
          contestGradeTitle: item.gradeTitle,
          players: item.result
            .sort((a, b) => a.playerRank - b.playerRank) // 순위에 따라 정렬
            .map((player) => ({
              playerNumber: player.playerNumber,
              playerName: player.playerName,
              playerGym: player.playerGym,
              playerRank: player.playerRank,
            })),
        },
      ],
    }));
  };

  const availableCategories = useMemo(() => {
    return categoriesArray.filter(
      (cat) =>
        cat.contestCategorySection === currentSection ||
        currentSection === "all"
    );
  }, [categoriesArray, currentSection]);

  const availableGrades = useMemo(() => {
    return gradesArray.filter(
      (grade) =>
        grade.refCategoryId === currentCategoryId || currentCategoryId === "all"
    );
  }, [gradesArray, currentCategoryId]);

  useEffect(() => {
    setCurrentCategoryId("all");
    setCurrentGradeId("all");
  }, [currentSection]);

  const formattedResults = useMemo(
    () => formatResultArray(resultArray),
    [resultArray]
  );

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
              <HiUserGroup />
            </span>
            <h1 className="font-sans text-lg font-semibold">순위표 출력</h1>
          </div>

          <div className="flex w-full mb-4 gap-2">
            {[
              "all",
              ...new Set(
                categoriesArray.map((cat) => cat.contestCategorySection)
              ),
            ].map((section) => (
              <button
                key={section}
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
              className="border rounded-lg p-2"
            >
              <option value="all">체급 선택</option>
              {availableGrades.map((grade) => (
                <option key={grade.contestGradeId} value={grade.contestGradeId}>
                  {grade.contestGradeTitle}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                handleSearch(
                  currentContest?.contests?.id,
                  currentCategoryId,
                  currentGradeId
                );
              }}
              className="bg-blue-500 text-white rounded-lg px-4 py-2"
            >
              검색
            </button>

            <ReactToPrint
              trigger={() => (
                <button className="bg-blue-500 text-white rounded-lg px-4 py-2">
                  출력
                </button>
              )}
              content={() => printRef.current}
            />
          </div>

          <div ref={printRef}>
            <PrintTable
              documentTitle="순위표"
              data={formattedResults}
              columns={[
                { label: "순위", key: "playerRank" },
                {
                  label: "선수",
                  mergeKeys: ["playerNumber", "playerName"],
                  width: 30,
                },
                { label: "소속", key: "playerGym", width: 30 },
                { label: "비고", key: "note", width: 30 },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default StandingPrint;
