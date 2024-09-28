import React, { useContext, useEffect, useMemo, useState } from "react";
import { BsCheckAll } from "react-icons/bs";
import LoadingPage from "./LoadingPage";
import { TiInputChecked } from "react-icons/ti";
import { v4 as uuidv4 } from "uuid";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { Checkbox } from "@mui/material";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";

const ContestPlayerOrderTable = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [matchedArray, setMatchedArray] = useState([]);
  const [categorysArray, setCategorysArray] = useState([]);
  const [categorysList, setCategorysList] = useState({});
  const [gradesArray, setGradesArray] = useState([]);
  const [entrysArray, setEntrysArray] = useState([]);
  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const updateEntrys = useFirestoreUpdateData("contest_entrys_list");
  const updateContestData = useFirestoreUpdateData("contest_data");
  const fetchEntry = useFirestoreQuery();
  let categoryNumber = 0;
  let totalPlayerNumber = 0;
  const fetchPool = async () => {
    if (currentContest.contests.contestCategorysListId) {
      const returnCategorys = await fetchCategoryDocument.getDocument(
        currentContest.contests.contestCategorysListId
      );

      setCategorysArray([
        ...returnCategorys?.categorys.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        ),
      ]);

      const returnGrades = await fetchGradeDocument.getDocument(
        currentContest.contests.contestGradesListId
      );

      setGradesArray([...returnGrades?.grades]);
    }

    const condition = [where("contestId", "==", currentContest.contests.id)];
    const returnEntrys = await fetchEntry.getDocuments(
      "contest_entrys_list",
      condition
    );
    setEntrysArray([...returnEntrys]);
  };

  const initEntryList = () => {
    setIsLoading(true);
    let dummy = [];
    let playerNumber = 0;
    let stageNumber = 0;
    categorysArray
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .map((category, cIdx) => {
        const matchedGrades = gradesArray.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );
        const matchedGradesLength = matchedGrades.length;
        matchedGrades
          .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
          .map((grade, gIdx) => {
            stageNumber++;
            const matchedPlayerWithPlayerNumber = [];
            const matchedPlayers = entrysArray.filter(
              (entry) => entry.contestGradeId === grade.contestGradeId
            );

            matchedPlayers.map((player, pIdx) => {
              playerNumber++;
              const newPlayer = {
                ...player,
                playerNumber,
                playerNoShow: false,
                playerIndex: playerNumber,
              };
              matchedPlayerWithPlayerNumber.push({ ...newPlayer });
            });

            const matchedInfo = {
              matchedPlayers: matchedPlayerWithPlayerNumber,
            };
            dummy.push({ ...matchedInfo });
          });
      });

    setMatchedArray([...dummy]);
    setIsLoading(false);
  };

  const handleUpdateContestData = async () => {
    try {
      await updateContestData.updateData(
        currentContest.contests.contestDataId,
        { schedule: [...matchedArray] }
      );
    } catch (error) {}
  };

  const gradeChage = (
    e,
    currentCategoryId,
    currentGradeId,
    currentPlayerUid
  ) => {
    //현재 종목, 체급 코드를 받아와서
    // 종목에 포함된 체급의 갯수를 계산한후에
    // 현재 체급 코드의 gradeIndex가 체급 갯수보다 작다면 다음 체급으로 변경하도록 코드를 작성한다.
    // originalGrade와 isGradeChanged가 추가되었어.

    const newMatched = [...matchedArray];

    const entryFindIndex = newMatched.findIndex(
      (entry) =>
        entry.contestCategoryId === currentCategoryId &&
        entry.contestGradeId === currentGradeId
    );

    const currentPlayerInfo = newMatched
      .find(
        (entry) =>
          entry.contestCategoryId === currentCategoryId &&
          entry.contestGradeId === currentGradeId
      )
      .matchedPlayers.find((player) => player.playerUid === currentPlayerUid);

    const playerFindIndex = newMatched
      .find(
        (entry) =>
          entry.contestCategoryId === currentCategoryId &&
          entry.contestGradeId === currentGradeId
      )
      .matchedPlayers.findIndex(
        (player) => player.playerUid === currentPlayerUid
      );

    if (e.target.checked) {
      const newPlayerInfo = {
        ...currentPlayerInfo,
        isGradeChanged: true,
        playerIndex: currentPlayerInfo.playerIndex + 100,
      };
      //기존 선수 배열에서 삭제
      newMatched[entryFindIndex].matchedPlayers.splice(playerFindIndex, 1);
      //다음 선수 배열에 추가
      newMatched[entryFindIndex + 1].matchedPlayers.push({
        ...newPlayerInfo,
      });

      setMatchedArray(() => [...newMatched]);
    } else {
      const newPlayerInfo = {
        ...currentPlayerInfo,
        isGradeChanged: false,
        playerIndex: currentPlayerInfo.playerIndex - 100,
      };
      //기존 선수 배열에서 삭제
      newMatched[entryFindIndex].matchedPlayers.splice(playerFindIndex, 1);
      //다음 선수 배열에 추가
      newMatched[entryFindIndex - 1].matchedPlayers.push({
        ...newPlayerInfo,
      });
      setMatchedArray(() => [...newMatched]);
    }
  };
  const handleReOrderPlayer = (data) => {
    const prevOrder = [...data];
    let newOrder = [];
    prevOrder.map((item, idx) => newOrder.push({ ...item }));

    return newOrder;
  };

  const handleSavePlayerOrder = async (data) => {
    try {
      await updateEntrys.updateData([...data]);
    } catch (error) {
      console.log(error);
    }
  };
  const onDragPlayerEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) {
      return;
    }
    console.log(result);

    const dummy = [...categorysArray];
    const [reorderCategory] = dummy.splice(source.index, 1);
    dummy.splice(destination.index, 0, reorderCategory);
    //handleSavePlayerOrder(handleReOrderPlayer(dummy));
    //setEntrysArray(handleReOrderPlayer(dummy));
  };

  useEffect(() => {
    fetchPool();
  }, [currentContest]);

  useEffect(() => {
    if (categorysArray.length > 0) {
      initEntryList();
    }
  }, [categorysArray, gradesArray, entrysArray]);

  useEffect(() => {
    console.log(matchedArray);
  }, [matchedArray]);

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-3 gap-y-2">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <>
          <div className="flex w-full h-14">
            <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
              <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
                <TiInputChecked />
              </span>
              <h1
                className="font-sans text-lg font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                선수명단
              </h1>
            </div>
          </div>
          <div className="flex w-full h-full">
            <div className="flex w-full justify-start items-center">
              <div className="flex w-full h-full justify-start lg:px-3 lg:pt-3 flex-col bg-gray-100 rounded-lg gap-y-2">
                <div className="flex">
                  <button
                    className="w-full h-12 bg-gradient-to-r from-blue-300 to-cyan-200 rounded-lg"
                    onClick={() => handleUpdateContestData()}
                  >
                    저장
                  </button>
                </div>
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
                                    <div className="flex w-1/6">소속</div>
                                    <div className="flex w-1/6">월체</div>
                                    <div className="flex w-1/6">불참</div>
                                    <div className="hidden lg:flex w-1/6">
                                      신청일
                                    </div>
                                  </div>

                                  <DragDropContext onDragEnd={onDragPlayerEnd}>
                                    <Droppable droppableId="players">
                                      {(provided) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.droppableProps}
                                        >
                                          {matchedPlayers
                                            .sort(
                                              (a, b) =>
                                                a.playerIndex - b.playerIndex
                                            )
                                            .map((player, pIdx) => {
                                              const {
                                                playerName,
                                                playerGym,
                                                playerUid,
                                                playerNumber,
                                                playerNoShow,
                                                isGradeChanged,
                                                invoiceCreateAt,
                                              } = player;

                                              return (
                                                <Draggable
                                                  draggableId={playerUid}
                                                  index={pIdx}
                                                  key={playerUid}
                                                >
                                                  {(provided, snapshot) => (
                                                    <div
                                                      className={`${
                                                        snapshot.isDragging
                                                          ? "flex w-full h-10 border-b border-gray-300 items-center text-sm lg:px-2 bg-blue-400 text-white"
                                                          : "flex w-full h-10 border-b border-gray-300 items-center text-sm lg:px-2"
                                                      }`}
                                                      key={playerUid}
                                                      id={playerUid}
                                                      ref={provided.innerRef}
                                                      {...provided.dragHandleProps}
                                                      {...provided.draggableProps}
                                                    >
                                                      <div className="flex w-1/6">
                                                        {pIdx + 1}
                                                      </div>
                                                      <div className="flex w-1/6">
                                                        {playerNumber}
                                                      </div>
                                                      <div className="flex w-1/6">
                                                        {playerName}
                                                      </div>
                                                      <div className="flex w-1/6">
                                                        {playerGym}
                                                      </div>
                                                      <div className="flex w-1/6">
                                                        {gradeIndex <
                                                          parseInt(
                                                            gradeLength
                                                          ) ||
                                                        isGradeChanged ? (
                                                          <input
                                                            type="checkbox"
                                                            checked={
                                                              isGradeChanged
                                                            }
                                                            onChange={(e) =>
                                                              gradeChage(
                                                                e,
                                                                categoryId,
                                                                gradeId,
                                                                playerUid
                                                              )
                                                            }
                                                          />
                                                        ) : (
                                                          <span>불가</span>
                                                        )}
                                                      </div>
                                                      <div className="flex w-1/6">
                                                        <input
                                                          type="checkbox"
                                                          checked={playerNoShow}
                                                        />
                                                      </div>
                                                      <div className="hidden lg:flex w-1/6">
                                                        {invoiceCreateAt}
                                                      </div>
                                                    </div>
                                                  )}
                                                </Draggable>
                                              );
                                            })}
                                          {provided.placeholder}
                                        </div>
                                      )}
                                    </Droppable>
                                  </DragDropContext>
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

export default ContestPlayerOrderTable;
