// FinalPlayerListPrint.js
import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import { HiUserGroup } from "react-icons/hi";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreGetDocument } from "../hooks/useFirestores";
import PrintTable from "./PrintTable";

const FinalPlayerListPrint = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState("전체");
  const printRef = useRef();
  const [documentTitle, setDocumentTitle] = useState("출전명단");

  const { currentContest } = useContext(CurrentContestContext);
  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersFinal = useFirestoreGetDocument("contest_players_final");

  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [playerFinalArray, setPlayerFinalArray] = useState([]);

  const fetchPool = async (categoryId, gradeId, playerFinalId) => {
    try {
      const [categories, grades, players] = await Promise.all([
        fetchCategories.getDocument(categoryId),
        fetchGrades.getDocument(gradeId),
        fetchPlayersFinal.getDocument(playerFinalId),
      ]);
      setCategoriesArray(categories?.categorys || []);
      setGradesArray(grades?.grades || []);
      setPlayerFinalArray(players?.players || []);
    } catch (error) {
      console.error(error);
    }
  };

  const groupByCategory = (categories, grades, players, currentSection) => {
    const filteredCategories = categories.filter((category) => {
      if (currentSection === "전체") return true;
      return category.contestCategorySection === currentSection;
    });

    return (
      filteredCategories
        .map((category) => {
          const {
            contestCategoryIndex: categoryIndex,
            contestCategoryTitle: categoryTitle,
            contestCategoryId: categoryId,
            contestCategorySection: categorySection,
          } = category;

          const relevantGrades = grades
            .filter((grade) => grade.refCategoryId === categoryId)
            .sort((a, b) => a.gradeIndex - b.gradeIndex)
            .map((grade) => {
              const playersForGrade = players
                .filter(
                  (player) =>
                    player.contestGradeId === grade.contestGradeId &&
                    player.playerNoShow === false
                )
                .sort((a, b) => a.playerIndex - b.playerIndex);
              return {
                ...grade,
                players: playersForGrade,
              };
            })
            // 선수 숫자가 0인 grade를 제외합니다.
            .filter((grade) => grade.players.length > 0);

          return {
            categoryIndex,
            categoryTitle,
            categorySection,
            grades: relevantGrades,
          };
        })
        // `grades` 배열에 선수가 없는 category도 제외합니다.
        .filter((category) => category.grades.length > 0)
    );
  };

  const filteredPlayerList = useMemo(() => {
    return groupByCategory(
      categoriesArray,
      gradesArray,
      playerFinalArray,
      currentSection
    );
  }, [categoriesArray, gradesArray, playerFinalArray, currentSection]);

  const columns = [
    { label: "순번", key: "index", width: 10 },
    {
      label: "선수번호. 이름",
      mergeKeys: ["playerNumber", "playerName"],
      width: 30,
    },
    { label: "소속", key: "playerGym", width: 30 },
    { label: "비고", key: "note", width: 30 },
  ];

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId,
        currentContest.contests.contestPlayersFinalId
      );
    }
  }, [currentContest]);

  useEffect(() => {
    const contestTitle = currentContest?.contestInfo?.contestTitle;
    const section = currentSection;

    setDocumentTitle((prev) => (prev = `${contestTitle} 출전명단 ${section}`));
  }, [currentContest, currentSection]);

  return (
    <div className="flex flex-col w-full h-full bg-gray-50 p-4">
      {isLoading ? (
        <LoadingPage />
      ) : (
        <>
          <div className="flex w-full h-14 mb-4 bg-gray-100 justify-start items-center rounded-lg px-3">
            <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
              <HiUserGroup />
            </span>
            <h1 className="font-sans text-lg font-semibold">출전명단 출력</h1>
          </div>

          <div className="flex w-full mb-4 gap-2">
            {[
              "전체",
              ...new Set(
                categoriesArray.map((cat) => cat.contestCategorySection)
              ),
            ].map((section) => (
              <button
                key={section}
                className={`w-24 h-10 px-4 py-2 rounded-lg border ${
                  currentSection === section
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-700"
                }`}
                onClick={() => setCurrentSection(section)}
              >
                {section}
              </button>
            ))}
            <ReactToPrint
              trigger={() => (
                <button className="w-24 h-10 bg-blue-300 rounded-lg">
                  출력
                </button>
              )}
              content={() => printRef.current}
            />
          </div>

          <div className="flex w-full h-full bg-white overflow-y-auto p-4">
            <div
              ref={printRef}
              className="w-full h-full flex justify-center items-start bg-white"
            >
              <PrintTable
                data={filteredPlayerList}
                columns={columns}
                addEmptyRows={false}
                documentTitle={documentTitle}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FinalPlayerListPrint;
