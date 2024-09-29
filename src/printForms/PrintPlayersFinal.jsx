import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { HiUserGroup } from "react-icons/hi";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreGetDocument } from "../hooks/useFirestores";

const PrintPlayersFinal = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({});
  const [msgOpen, setMsgOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState("전체");
  const printRef = useRef();

  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [playerAssignArray, setPlayerAssignArray] = useState([]);

  const { currentContest } = useContext(CurrentContestContext);
  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersFinal = useFirestoreGetDocument("contest_players_final");

  const fetchPool = async (contestId, categoryId, gradeId, playerFinalId) => {
    try {
      await fetchCategories.getDocument(categoryId).then((data) => {
        if (data) {
          setCategoriesArray(() => [...data.categorys]);
        }
      });

      await fetchGrades.getDocument(gradeId).then((data) => {
        if (data) {
          setGradesArray(() => [...data.grades]);
        }
      });

      await fetchPlayersFinal.getDocument(playerFinalId).then((data) => {
        if (data) {
          setPlayerAssignArray(() => [...data.players]);
        }
      });
    } catch (error) {
      console.log(error);
    }
  };

  const groupByCategory = (categories, grades, players, currentSection) => {
    const filteredCategories = categories.filter((category) => {
      if (currentSection === "전체") return true;
      return category.contestCategorySection === currentSection;
    });

    return filteredCategories.map((category) => {
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
        });

      return {
        categoryIndex,
        categoryTitle,
        categorySection,
        grades: relevantGrades,
      };
    });
  };

  const filteredPlayerList = useMemo(() => {
    return groupByCategory(
      categoriesArray,
      gradesArray,
      playerAssignArray,
      currentSection
    );
  }, [categoriesArray, gradesArray, playerAssignArray, currentSection]);

  const sections = useMemo(() => {
    // `contestCategorySection`을 동적으로 그룹화
    const uniqueSections = [
      ...new Set(
        categoriesArray.map((category) => category.contestCategorySection)
      ),
    ];
    return ["전체", ...uniqueSections];
  }, [categoriesArray]);

  useEffect(() => {
    if (!currentContest?.contests?.id) return;

    fetchPool(
      currentContest.contests.id,
      currentContest.contests.contestCategorysListId,
      currentContest.contests.contestGradesListId,
      currentContest.contests.contestPlayersFinalId
    );
  }, [currentContest?.contests]);

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
                선수명단 출력
              </h1>
            </div>
          </div>

          <div className="flex w-full h-full justify-start  px-3 pt-3 flex-col bg-gray-100 rounded-lg">
            <div className="flex w-full"></div>
            <div className="flex h-full w-full gap-x-2 bg-gray-100">
              <div className="flex flex-col w-full h-full bg-white rounded-b-lg p-2 gap-y-2">
                <div className="flex w-full justify-center px-5">
                  <div className="flex w-2/3 gap-x-1">
                    {sections.map((section) => (
                      <button
                        key={section}
                        className="w-24 h-10 bg-white rounded-lg border border-blue-500"
                        onClick={() => setCurrentSection(section)}
                      >
                        {section}
                      </button>
                    ))}
                  </div>

                  <div className="flex w-1/3 justify-end">
                    <ReactToPrint
                      trigger={() => (
                        <button className="w-40 h-10 bg-blue-300 rounded-lg">
                          출력
                        </button>
                      )}
                      content={() => printRef.current}
                      pageStyle={`@page { size: A4; margin: 0; margin-top: 50px; margin-bottom: 50px; }`}
                    />
                  </div>
                </div>

                <div
                  className="flex w-full h-full p-5 flex-col gap-y-2"
                  ref={printRef}
                >
                  <div className="flex w-full h-14 border border-r-2 border-b-2 border-black justify-center items-center">
                    <span
                      className="text-2xl font-semibold"
                      style={{ letterSpacing: "30px" }}
                    >
                      선수명단({currentSection})
                    </span>
                  </div>
                  <div className="flex w-full h-full justify-center items-center flex-col gap-y-2">
                    {filteredPlayerList?.length > 0 &&
                      filteredPlayerList.map((filter, fIdx) => {
                        const { categoryTitle, grades } = filter;

                        return grades.map((grade, gIdx) => {
                          const { contestGradeTitle, players } = grade;

                          return (
                            <>
                              {players.length === 0 ? null : (
                                <div
                                  key={gIdx}
                                  className="flex w-full h-auto p-2 flex-col border-0 border-black page-break"
                                >
                                  <div className="flex h-10 gap-x-2 text-lg font-semibold">
                                    <span>{categoryTitle}</span>
                                    <span>{contestGradeTitle}</span>
                                  </div>
                                  <div className="flex w-full h-auto flex-col">
                                    <div className="flex w-full h-10">
                                      <div className="flex w-1/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                        <span>순번</span>
                                      </div>

                                      <div className="flex w-4/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                        <span>선수번호. 이름</span>
                                      </div>
                                      <div className="flex w-4/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                        <span>소속</span>
                                      </div>
                                      <div className="flex w-3/12 justify-center items-center font-semibold border-b-0 border-black border-r-2 border-t first:border-l">
                                        <span>비고</span>
                                      </div>
                                    </div>
                                    {players.map((player, pIdx) => {
                                      const {
                                        playerNumber,
                                        playerName,
                                        playerGym,
                                        isGradeChanged,
                                      } = player;

                                      return (
                                        <div className="flex w-full h-10 last:border-b-2 border-black">
                                          <div className="flex w-1/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                            <span>{pIdx + 1}</span>
                                          </div>

                                          <div className="flex w-4/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                            <span>{playerNumber}. </span>
                                            <span>{playerName}</span>
                                          </div>
                                          <div className="flex w-4/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                            <span>{playerGym}</span>
                                          </div>
                                          <div className="flex w-3/12 justify-start items-center font-semibold border-b-0 border-black border-r-2 border-t first:border-l">
                                            {isGradeChanged && (
                                              <span className="ml-2">월체</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        });
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PrintPlayersFinal;
