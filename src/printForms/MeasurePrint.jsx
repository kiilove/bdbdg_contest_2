// MeasurePrint.js
import React, { useEffect, useContext, useState, useMemo, useRef } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import { MdOutlineScale } from "react-icons/md";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreGetDocument } from "../hooks/useFirestores";
import PrintTable from "./PrintTable";
import { useMediaQuery } from "react-responsive";

const MeasurePrint = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState("전체");
  const printRef = useRef();
  const { currentContest } = useContext(CurrentContestContext);
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [playerAssignArray, setPlayerAssignArray] = useState([]);
  const [documentTitle, setDocumentTitle] = useState("계측명단");

  // 태블릿 이하의 화면을 인식
  const isTabletOrMobile = useMediaQuery({ maxWidth: 1024 });

  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersAssign = useFirestoreGetDocument("contest_players_assign");

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId,
        currentContest.contests.contestPlayersAssignId
      );
    }
  }, [currentContest]);

  const fetchPool = async (categoryId, gradeId, playerAssignId) => {
    try {
      const [categories, grades, players] = await Promise.all([
        fetchCategories.getDocument(categoryId),
        fetchGrades.getDocument(gradeId),
        fetchPlayersAssign.getDocument(playerAssignId),
      ]);
      setCategoriesArray(categories?.categorys || []);
      setGradesArray(grades?.grades || []);
      setPlayerAssignArray(players?.players || []);
    } catch (error) {
      console.error(error);
    }
  };

  const filteredPlayerList = useMemo(() => {
    const filteredCategories = categoriesArray.filter((category) => {
      return (
        currentSection === "전체" ||
        category.contestCategorySection === currentSection
      );
    });

    return filteredCategories
      .map((category) => {
        const grades = gradesArray
          .filter((grade) => grade.refCategoryId === category.contestCategoryId)
          .map((grade) => ({
            ...grade,
            players: playerAssignArray.filter(
              (player) => player.contestGradeId === grade.contestGradeId
            ),
          }))
          .filter((grade) => grade.players.length > 0);

        return { ...category, grades };
      })
      .filter((category) => category.grades.length > 0);
  }, [categoriesArray, gradesArray, playerAssignArray, currentSection]);

  useEffect(() => {
    const contestTitle = currentContest?.contestInfo?.contestTitle;
    const section = currentSection;

    setDocumentTitle(`${contestTitle} 계측명단 ${section}`);
  }, [currentContest, currentSection]);

  const columns = [
    { label: "순번", key: "index", width: 10 },
    { label: "선수번호", key: "playerNumber", width: 15 },
    { label: "이름", key: "playerName", width: 20 },
    { label: "신장/체중", key: "heightWeight", width: 30, forcedValue: "/" },
    { label: "비고", key: "notes", width: 25 },
  ];

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
              <MdOutlineScale />
            </span>
            <h1 className="font-sans text-lg font-semibold">계측명단 출력</h1>
          </div>

          <div className="flex w-full mb-4 gap-2">
            {[
              "전체",
              ...new Set(
                categoriesArray.map((cat) => cat.contestCategorySection)
              ),
            ].map((section, idx) => (
              <button
                key={idx}
                className={`w-[200px] h-[50px] px-4 py-2 rounded-lg border ${
                  currentSection === section
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-700"
                } hover:bg-blue-400 hover:text-white`}
                onClick={() => setCurrentSection(section)}
              >
                {section}
              </button>
            ))}
            <ReactToPrint
              trigger={() => (
                <button className="w-[200px] h-[50px] px-4 py-2 rounded-lg border bg-blue-800 text-white">
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
              <PrintTable
                documentTitle={documentTitle}
                data={filteredPlayerList}
                columns={columns}
                addEmptyRows={true}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MeasurePrint;
