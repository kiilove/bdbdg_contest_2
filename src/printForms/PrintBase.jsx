import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { MdOutlineScale } from "react-icons/md";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreGetDocument } from "../hooks/useFirestores";

const tabArray = [
  {
    id: 0,
    title: "전체",
  },
  {
    id: 1,
    title: "섹션별",
  },
  {
    id: 2,
    title: "종목별",
  },
];

const PrintBase = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({});
  const [msgOpen, setMsgOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [currentSection, setCurrentSection] = useState("전체");
  const printRef = useRef();

  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [playerAssignArray, setPlayerAssignArray] = useState([]);

  const { currentContest } = useContext(CurrentContestContext);
  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersAssign = useFirestoreGetDocument("contest_players_assign");

  const fetchPool = async (contestId, categoryId, gradeId, playerAssignId) => {
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

      await fetchPlayersAssign.getDocument(playerAssignId).then((data) => {
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
            .filter((player) => player.contestGradeId === grade.contestGradeId)
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

  // useMemo 사용
  const filteredPlayerList = useMemo(() => {
    return groupByCategory(
      categoriesArray,
      gradesArray,
      playerAssignArray,
      currentSection
    );
  }, [categoriesArray, gradesArray, playerAssignArray, currentSection]);

  // contestCategorySection을 동적으로 그룹화하여 버튼 생성
  const sections = useMemo(() => {
    const uniqueSections = [
      ...new Set(
        categoriesArray.map((category) => category.contestCategorySection)
      ),
    ];
    return ["전체", ...uniqueSections];
  }, [categoriesArray]);

  const renderEmptyRows = (numPlayers) => {
    const emptyRows = [];
    const emptyRowCount = numPlayers <= 10 ? 3 : 5;

    for (let i = 0; i < emptyRowCount; i++) {
      emptyRows.push(
        <div
          key={i}
          className={`flex w-full h-10 ${
            i === emptyRowCount - 1 ? "border-b-2" : ""
          } border-black`}
        >
          <div className="flex w-1/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
            <span></span>
          </div>
          <div className="flex w-1/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
            <span></span>
          </div>
          <div className="flex w-1/6 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
            <span></span>
          </div>
          <div className="flex w-2/6 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
            <span></span>
          </div>
          <div className="flex w-2/6 justify-center items-center font-semibold border-b-0 border-black border-r-2 border-t first:border-l">
            <span></span>
          </div>
        </div>
      );
    }
    return emptyRows;
  };

  useEffect(() => {
    if (!currentContest?.contests?.id) {
      return;
    }

    fetchPool(
      currentContest.contests.id,
      currentContest.contests.contestCategorysListId,
      currentContest.contests.contestGradesListId,
      currentContest.contests.contestPlayersAssignId
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
                <MdOutlineScale />
              </span>
              <h1
                className="font-sans text-lg font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                계측명단 출력
              </h1>
            </div>
          </div>

          <div className="flex w-full h-full justify-start px-3 pt-3 flex-col bg-gray-100 rounded-lg">
            <div className="flex w-full">
              {sections.map((section, idx) => (
                <button
                  key={idx}
                  className={`${
                    currentSection === section
                      ? "flex w-auto h-10 bg-white px-4"
                      : "flex w-auto h-10 bg-gray-100 px-4"
                  } h-14 rounded-t-lg justify-center items-center`}
                  style={{ minWidth: "130px" }}
                  onClick={() => setCurrentSection(section)}
                >
                  <span>{section}</span>
                </button>
              ))}
            </div>

            <div className="flex h-full w-full gap-x-2 bg-gray-100">
              <div className="flex flex-col w-full h-full bg-white rounded-b-lg p-2 gap-y-2">
                <div className="flex w-full justify-center px-5">
                  <div className="flex w-2/3 gap-x-1">
                    {sections.map((section, idx) => (
                      <button
                        key={idx}
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
                      계측명단({currentSection})
                    </span>
                  </div>
                  <div className="flex w-full h-full justify-center items-center flex-col gap-y-2">
                    {filteredPlayerList?.length > 0 &&
                      filteredPlayerList.map((filter, fIdx) => {
                        const { categoryTitle, categoryId, grades } = filter;

                        return grades.map((grade, gIdx) => {
                          const { contestGradeId, contestGradeTitle, players } =
                            grade;

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
                                      <div className="flex w-1/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                        <span>선수번호</span>
                                      </div>
                                      <div className="flex w-1/6 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                        <span>이름</span>
                                      </div>
                                      <div className="flex w-2/6 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                        <span>신장/체중</span>
                                      </div>
                                      <div className="flex w-2/6 justify-center items-center font-semibold border-b-0 border-black border-r-2 border-t first:border-l">
                                        <span>비고</span>
                                      </div>
                                    </div>
                                    {players.map((player, pIdx) => {
                                      const { playerNumber, playerName } =
                                        player;

                                      return (
                                        <div
                                          key={pIdx}
                                          className="flex w-full h-10 last:border-b-2 border-black"
                                        >
                                          <div className="flex w-1/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                            <span>{pIdx + 1}</span>
                                          </div>
                                          <div className="flex w-1/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                            <span>{playerNumber}</span>
                                          </div>
                                          <div className="flex w-1/6 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                            <span>{playerName}</span>
                                          </div>
                                          <div className="flex w-2/6 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                            <span>/</span>
                                          </div>
                                          <div className="flex w-2/6 justify-center items-center font-semibold border-b-0 border-black border-r-2 border-t first:border-l">
                                            <span></span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {/* 빈 공백줄 생성 */}
                                    {renderEmptyRows(players.length)}
                                    <div className="flex w-full h-10 page-break"></div>
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

export default PrintBase;
