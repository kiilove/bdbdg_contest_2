import React, { useContext, useEffect, useMemo, useState } from "react";
import { BsCheckAll } from "react-icons/bs";
import LoadingPage from "./LoadingPage";
import { TiInputChecked } from "react-icons/ti";
import {
  useFirestoreAddData,
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { Checkbox } from "@mui/material";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const ContestPlayerOrderTableAfter = () => {
  const [isLoading, setIsLoading] = useState(false);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [matchedArray, setMatchedArray] = useState([]);
  const [categoriesArray, setCategoriesArray] = useState([]);

  const [gradesArray, setGradesArray] = useState([]);
  const [playersArray, setPlayersArray] = useState([]);
  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayerFinal = useFirestoreGetDocument("contest_players_final");
  const fetchPool = async (categoriesListId, gradesListId, playersFinalId) => {
    if (
      categoriesListId === undefined ||
      gradesListId === undefined ||
      playersFinalId === undefined
    ) {
      setMessage({
        body: "데이터를 불러오는데 문제가 발생했습니다.",
        body2: "시스템 관리자에게 연락하세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
    }
    try {
      await fetchCategoryDocument.getDocument(categoriesListId).then((data) => {
        setCategoriesArray(() => [...data.categorys]);
      });
      await fetchGradeDocument.getDocument(gradesListId).then((data) => {
        setGradesArray(() => [...data.grades]);
      });
      await fetchPlayerFinal.getDocument(playersFinalId).then((data) => {
        setPlayersArray(() => [...data.players]);
      });
    } catch (error) {}
  };

  const initPlayersFinalList = (categories, grades, players) => {
    setIsLoading(true);
    let dummy = [];

    categories
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .map((category, cIdx) => {
        const matchedGrades = grades.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );
        const matchedGradesLength = matchedGrades.length;
        matchedGrades
          .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
          .map((grade, gIdx) => {
            const matchedPlayerWithPlayerNumber = [];
            const matchedPlayers = players.filter(
              (player) => player.contestGradeId === grade.contestGradeId
            );

            const matchedInfo = {
              ...category,
              ...grade,
              matchedPlayers,
              matchedGradesLength,
            };
            dummy.push({ ...matchedInfo });
          });
      });

    setMatchedArray([...dummy]);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!currentContest?.contests) {
      return;
    }
    fetchPool(
      currentContest.contests.contestCategorysListId,
      currentContest.contests.contestGradesListId,
      currentContest.contests.contestPlayersFinalId
    );
  }, [currentContest?.contests]);

  useEffect(() => {
    if (playersArray.length > 0) {
      initPlayersFinalList(categoriesArray, gradesArray, playersArray);
    }
  }, [playersArray]);

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-3 gap-y-2">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <>
          <div className="flex w-full h-14">
            <ConfirmationModal
              isOpen={msgOpen}
              onConfirm={() => setMsgOpen(false)}
              onCancel={() => setMsgOpen(false)}
              message={message}
            />
            <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
              <div className="flex w-2/3">
                <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
                  <TiInputChecked />
                </span>
                <h1
                  className="font-sans text-lg font-semibold"
                  style={{ letterSpacing: "2px" }}
                >
                  선수확정명단(계측후)
                </h1>
              </div>
            </div>
          </div>
          <div className="flex w-full h-full">
            <div className="flex w-full justify-start items-center">
              <div className="flex w-full h-full justify-start lg:px-3 lg:pt-3 flex-col bg-gray-100 rounded-lg gap-y-2">
                {matchedArray.length > 0 &&
                  matchedArray
                    .sort(
                      (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
                    )
                    .map((matched, mIdx) => {
                      const {
                        contestCategoryId: categoryId,
                        contestCategoryIndex: categoryIndex,
                        contestCategoryTitle: categoryTitle,
                        contestGradeId: gradeId,
                        contestGradeIndex: gradeIndex,
                        contestGradeTitle: gradeTitle,
                        matchedPlayers,
                        matchedGradesLength: gradeLength,
                      } = matched;

                      if (matchedPlayers.length === 0) return null;

                      let categoryNumber = 0;
                      return (
                        <div
                          className="flex w-full h-auto bg-blue-300 flex-col rounded-lg"
                          key={mIdx}
                        >
                          <div className="flex flex-col p-1 lg:p-2 gap-y-2">
                            <div className="flex flex-col bg-blue-100 rounded-lg">
                              <div className="flex h-10 items-center px-2">
                                {categoryTitle}({gradeTitle})
                              </div>

                              <div className="flex flex-col w-full lg:p-2">
                                <div className="flex flex-col w-full bg-white p-2 border border-b-2 border-gray-400 rounded-lg">
                                  <div className="flex w-full border-b border-gray-300 h-8 items-center text-sm lg:px-2">
                                    <div className="flex w-1/6">순번</div>
                                    <div className="flex w-1/6">선수번호</div>
                                    <div className="flex w-1/6">이름</div>
                                    <div className="flex w-2/6">소속</div>
                                    <div className="flex w-1/6">비고</div>
                                  </div>
                                  <div>
                                    {matchedPlayers
                                      .sort(
                                        (a, b) => a.playerIndex - b.playerIndex
                                      )
                                      .map((player, pIdx) => {
                                        const {
                                          playerName,
                                          playerGym,
                                          playerUid,
                                          playerNumber,
                                          playerNoShow,
                                          isGradeChanged,
                                        } = player;

                                        return (
                                          <div className="flex w-full h-10 border-b border-gray-300 items-center text-sm lg:px-2">
                                            <div
                                              className={`${
                                                !playerNoShow
                                                  ? "flex w-1/6"
                                                  : "flex w-1/6 text-gray-300 line-through"
                                              }`}
                                            >
                                              {pIdx + 1}
                                            </div>
                                            <div
                                              className={`${
                                                !playerNoShow
                                                  ? "flex w-1/6"
                                                  : "flex w-1/6 text-gray-300 line-through"
                                              }`}
                                            >
                                              {playerNumber}
                                            </div>
                                            <div
                                              className={`${
                                                !playerNoShow
                                                  ? "flex w-1/6"
                                                  : "flex w-1/6 text-gray-300 line-through"
                                              }`}
                                            >
                                              {playerName}
                                            </div>
                                            <div
                                              className={`${
                                                !playerNoShow
                                                  ? "flex w-2/6"
                                                  : "flex w-2/6 text-gray-300 line-through"
                                              }`}
                                            >
                                              {playerGym}
                                            </div>
                                            <div className="flex w-1/6 ">
                                              {isGradeChanged && (
                                                <span className="w-full font-bold">
                                                  월체
                                                </span>
                                              )}
                                              {playerNoShow && (
                                                <span className="w-full font-bold">
                                                  불참
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ContestPlayerOrderTableAfter;
