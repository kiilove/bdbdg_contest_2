// PrintBase.js
import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import { MdOutlineScale } from "react-icons/md";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreGetDocument } from "../hooks/useFirestores";

const PrintBase = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState("전체");
  const printRef = useRef();

  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [playerAssignArray, setPlayerAssignArray] = useState([]);
  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersAssign = useFirestoreGetDocument("contest_players_assign");

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
            players: playerAssignArray
              .filter(
                (player) => player.contestGradeId === grade.contestGradeId
              )
              .map((player, index) => {
                let note = player.note || "";
                let playerName = player.playerName;

                if (player.playerNoShow) {
                  note = "불참";
                  playerName = (
                    <span style={{ color: "gray" }}>
                      <s>{player.playerName}</s>
                    </span>
                  );
                } else if (player.isGradeChanged) {
                  note = "월체";
                }

                return {
                  index: index + 1,
                  playerNumber: player.playerNumber,
                  playerName,
                  heightWeight: player.heightWeight || "",
                  playerGym: player.playerGym || "",
                  note,
                };
              })
              .filter((player) => player.players.length > 0),
          }))
          .filter((grade) => grade.players.length > 0);

        return { ...category, grades };
      })
      .filter((category) => category.grades.length > 0);
  }, [categoriesArray, gradesArray, playerAssignArray, currentSection]);

  const sections = useMemo(() => {
    return [
      "전체",
      ...new Set(
        categoriesArray.map((category) => category.contestCategorySection)
      ),
    ];
  }, [categoriesArray]);

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId,
        currentContest.contests.contestPlayersAssignId
      );
    }
  }, [currentContest]);

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-2 gap-y-2">
      {isLoading ? (
        <LoadingPage />
      ) : (
        <>
          {/* 헤더 부분 */}
          <div className="flex w-full h-14">
            <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
              <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
                <MdOutlineScale />
              </span>
              <h1 className="font-sans text-lg font-semibold">계측명단 출력</h1>
            </div>
          </div>

          {/* 섹션 버튼 */}
          <div className="flex w-full mb-4 gap-2">
            {sections.map((section, idx) => (
              <button
                key={idx}
                className={`flex-grow px-4 py-2 rounded-lg border ${
                  currentSection === section
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-700"
                } hover:bg-blue-400 hover:text-white`}
                onClick={() => setCurrentSection(section)}
              >
                {section}
              </button>
            ))}
          </div>

          {/* 출력 내용 */}
          <div className="flex w-full h-full bg-white overflow-y-auto">
            <div className="flex flex-col w-full h-full bg-white rounded-b-lg p-2 gap-y-2">
              <div className="flex w-full justify-center mb-4">
                <ReactToPrint
                  trigger={() => (
                    <button className="w-40 h-10 bg-blue-300 rounded-lg">
                      출력
                    </button>
                  )}
                  content={() => printRef.current}
                />
              </div>

              {/* 인쇄 영역 */}
              <div
                ref={printRef}
                className="print-container flex flex-col w-full"
              >
                <div
                  className="flex w-full mb-5 h-14 justify-center items-center bg-white border border-gray-400 rounded-md"
                  style={{
                    borderTopColor: "#cbd5e0",
                    borderLeftColor: "#cbd5e0",
                    borderBottomColor: "#4a5568",
                    borderRightColor: "#4a5568",
                  }}
                >
                  <span className="text-lg font-semibold text-gray-800">
                    {currentContest?.contestInfo?.contestTitle} 계측명단
                  </span>
                </div>

                {filteredPlayerList.map((category, cIdx) =>
                  category.grades.map((grade, gIdx) => (
                    <div
                      key={`${cIdx}-${gIdx}`}
                      className="mb-6 break-page"
                      style={{ pageBreakInside: "avoid" }}
                    >
                      <h2 className="text-left font-bold text-lg mb-2 ml-4">
                        {category.contestCategoryTitle} /{" "}
                        {grade.contestGradeTitle}
                      </h2>
                      <table
                        className="w-full border-collapse border border-gray-400 text-center"
                        style={{ fontSize: "14px", marginBottom: "20px" }}
                      >
                        <thead>
                          <tr className="bg-gray-300">
                            <th className="border px-2 py-1 w-1/12">순번</th>
                            <th className="border px-2 py-1 w-1/12">
                              선수번호
                            </th>
                            <th className="border px-2 py-1 w-1/4">이름</th>
                            <th className="border px-2 py-1 w-1/4">
                              신장/체중
                            </th>
                            <th className="border px-2 py-1 w-1/4">비고</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grade.players.map((player, pIdx) => (
                            <tr key={pIdx} className="border-t">
                              <td className="p-2 border">{player.index}</td>
                              <td className="p-2 border">
                                {player.playerNumber}
                              </td>
                              <td className="p-2 border">
                                {player.playerName}
                              </td>
                              <td className="p-2 border">
                                {player.heightWeight}
                              </td>
                              <td className="p-2 border">{player.note}</td>
                            </tr>
                          ))}
                          {[...Array(3)].map((_, idx) => (
                            <tr key={`empty-${idx}`} className="border-t">
                              <td className="p-2 border">&nbsp;</td>
                              <td className="p-2 border">&nbsp;</td>
                              <td className="p-2 border">&nbsp;</td>
                              <td className="p-2 border">&nbsp;</td>
                              <td className="p-2 border">&nbsp;</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PrintBase;
