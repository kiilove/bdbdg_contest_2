"use client";

import { useContext, useEffect, useState } from "react";
import LoadingPage from "./LoadingPage";
import { TfiWrite } from "react-icons/tfi";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { TbWorldWww } from "react-icons/tb";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { Button, Card, Space, Tag } from "antd";
import {
  SaveOutlined,
  DragOutlined,
  CalendarOutlined,
} from "@ant-design/icons";

const ContestPlayerOrderTable = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [matchedArray, setMatchedArray] = useState([]);
  const [categorysArray, setCategorysArray] = useState([]);
  const [playersArray, setPlayersArray] = useState([]);
  const [playersAssign, setPlayersAssign] = useState({});
  const [playersFinal, setPlayersFinal] = useState({});
  const [gradesArray, setGradesArray] = useState([]);
  const [entrysArray, setEntrysArray] = useState([]);
  const [startPlayerNumber, setStartPlayerNumber] = useState(1);
  const [entryTitle, setEntryTitle] = useState("");
  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersAssignDocument = useFirestoreGetDocument(
    "contest_players_assign"
  );
  const fetchPlayersFinalDocument = useFirestoreGetDocument(
    "contest_players_final"
  );
  const updatePlayersAssign = useFirestoreUpdateData("contest_players_assign");
  const updatePlayersFinal = useFirestoreUpdateData("contest_players_final");
  const fetchEntry = useFirestoreQuery();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchPool = async () => {
    if (currentContest?.contests?.startPlayerNumber) {
      setStartPlayerNumber(currentContest.contests.startPlayerNumber - 1);
    }
    if (currentContest.contests.contestCategorysListId) {
      const returnCategorys = await fetchCategoryDocument.getDocument(
        currentContest.contests.contestCategorysListId
      );

      if (returnCategorys?.categorys?.length > 0) {
        setCategorysArray([
          ...returnCategorys?.categorys.sort(
            (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
          ),
        ]);
      } else {
        setCategorysArray([]);
      }

      const returnGrades = await fetchGradeDocument.getDocument(
        currentContest.contests.contestGradesListId
      );

      setGradesArray([...returnGrades?.grades]);

      const condition = [where("contestId", "==", currentContest.contests.id)];

      const returnEntrys = await fetchEntry.getDocuments(
        "contest_entrys_list",
        condition
      );

      const returnPlayersAssign = await fetchPlayersAssignDocument.getDocument(
        currentContest.contests.contestPlayersAssignId
      );

      const returnPlayersFinal = await fetchPlayersFinalDocument.getDocument(
        currentContest.contests.contestPlayersFinalId
      );

      const promises = [
        setEntrysArray([...returnEntrys]),
        setPlayersAssign({ ...returnPlayersAssign }),
        setPlayersArray([...returnPlayersAssign?.players]),
        setPlayersFinal({ ...returnPlayersFinal }),
      ];

      Promise.all(promises).then(() => console.log("상태값 설정완료"));
    }
  };

  const initEntryList = async () => {
    const dummy = [];
    let playerNumber = startPlayerNumber;

    const condition = [where("contestId", "==", currentContest.contests.id)];

    await fetchEntry
      .getDocuments("contest_entrys_list", condition)
      .then((data) => setEntrysArray(() => [...data]));

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
              ...category,
              ...grade,
              matchedPlayers: matchedPlayerWithPlayerNumber,
              matchedGradesLength,
            };
            dummy.push({ ...matchedInfo });
          });
      });

    const promises = [setMatchedArray([...dummy]), setIsLoading(false)];
    Promise.all(promises).then(() => console.log("초기화됨"));
  };

  const handleUpdatePlayersAssign = async (assignId, finalId) => {
    const newPlayersAssign = { ...playersAssign, players: [...dummyArray] };
    const newPlayersFinal = { ...playersFinal, players: [...dummyArray] };
    try {
      await updatePlayersAssign.updateData(assignId, newPlayersAssign);
      await updatePlayersFinal.updateData(finalId, newPlayersFinal).then(() => {
        setMessage({
          body: "저장되었습니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
      });
    } catch (error) {
      console.log(error);
    }
  };

  const onDragPlayerEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) {
      return;
    }

    const newMatchedArray = [...matchedArray];
    const sourceIndex = source.index;
    const destinationIndex = destination.index;

    const draggedPlayer = newMatchedArray[
      sourceIndex.parentIndex
    ].matchedPlayers.find((player) => player.playerUid === draggableId);

    newMatchedArray[sourceIndex.parentIndex].matchedPlayers.splice(
      sourceIndex.childIndex,
      1
    );

    newMatchedArray[destinationIndex.parentIndex].matchedPlayers.splice(
      destinationIndex.childIndex,
      0,
      draggedPlayer
    );

    const allPlayers = newMatchedArray.flatMap(
      (matched) => matched.matchedPlayers
    );

    allPlayers.forEach((player, index) => {
      player.playerNumber = index + startPlayerNumber + 1;
      player.playerIndex = index + startPlayerNumber + 1;
    });

    setMatchedArray(newMatchedArray);
  };

  useEffect(() => {
    fetchPool();
  }, [currentContest]);

  useEffect(() => {
    if (categorysArray.length > 0 && playersArray?.length === 0) {
      initEntryList();
    }
  }, [categorysArray, gradesArray, entrysArray, playersArray]);

  const dummyArray = [];

  const PlayerCardView = ({ player, index, provided, snapshot }) => {
    const { playerName, playerGym, playerNumber, createBy, invoiceCreateAt } =
      player;

    return (
      <Card
        size="small"
        className={`mb-2 ${
          snapshot.isDragging ? "shadow-lg border-blue-500" : ""
        }`}
        ref={provided.innerRef}
        {...provided.dragHandleProps}
        {...provided.draggableProps}
      >
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <Space>
              <DragOutlined className="text-gray-400" />
              <span className="font-semibold text-base">순번: {index + 1}</span>
            </Space>
            <Tag color="gold" className="text-base font-semibold px-2 py-0.5">
              {playerNumber}
            </Tag>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{playerName}</span>
              {createBy === "manual" && (
                <Tag
                  color="green"
                  className="flex items-center justify-center gap-1 min-w-[60px]"
                >
                  <TfiWrite />
                  <span>수기</span>
                </Tag>
              )}
              {(createBy === undefined || createBy === "web") && (
                <Tag
                  color="blue"
                  className="flex items-center justify-center gap-1 min-w-[60px]"
                >
                  <TbWorldWww />
                  <span>웹</span>
                </Tag>
              )}
            </div>
            <div className="text-gray-600 text-sm">{playerGym}</div>
            {invoiceCreateAt && (
              <div className="text-gray-500 text-xs flex items-center gap-1">
                <CalendarOutlined />
                {invoiceCreateAt}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-2 gap-y-2">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <>
          <ConfirmationModal
            isOpen={msgOpen}
            message={message}
            onCancel={() => setMsgOpen(false)}
            onConfirm={() => setMsgOpen(false)}
          />
          <div className="flex w-full justify-end mb-2">
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              className="w-full"
              onClick={() =>
                handleUpdatePlayersAssign(
                  currentContest.contests.contestPlayersAssignId,
                  currentContest.contests.contestPlayersFinalId
                )
              }
            >
              계측명단 저장
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {matchedArray.length > 0 &&
              matchedArray
                .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
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

                  if (matchedPlayers.length === 0) {
                    return null;
                  } else {
                    dummyArray.push(...matchedPlayers);
                  }

                  return (
                    <Card
                      key={mIdx}
                      title={
                        <span className="text-lg font-semibold">
                          {categoryTitle} / {gradeTitle}
                        </span>
                      }
                      className="shadow-sm"
                    >
                      <DragDropContext onDragEnd={onDragPlayerEnd}>
                        <Droppable droppableId="players">
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                            >
                              {!isMobile && (
                                <div className="flex flex-col w-full">
                                  <div className="flex w-full border-b-2 border-gray-200 h-12 items-center font-semibold bg-gray-50 px-4 rounded-t-lg">
                                    <div className="flex w-1/12">
                                      <DragOutlined />
                                    </div>
                                    <div className="flex w-1/12">순번</div>
                                    <div className="flex w-2/12">선수번호</div>
                                    <div className="flex w-2/12">이름</div>
                                    <div className="flex w-3/12">소속</div>
                                    <div className="flex w-3/12">신청일</div>
                                  </div>
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
                                        createBy,
                                        invoiceCreateAt,
                                      } = player;

                                      return (
                                        <Draggable
                                          draggableId={playerUid}
                                          index={{
                                            parentIndex: mIdx,
                                            childIndex: pIdx,
                                          }}
                                          key={playerUid}
                                        >
                                          {(provided, snapshot) => (
                                            <div
                                              className={`flex w-full h-14 border-b border-gray-200 items-center px-4 hover:bg-gray-50 transition-colors ${
                                                snapshot.isDragging
                                                  ? "bg-blue-50 shadow-lg"
                                                  : ""
                                              }`}
                                              ref={provided.innerRef}
                                              {...provided.dragHandleProps}
                                              {...provided.draggableProps}
                                            >
                                              <div className="flex w-1/12 text-gray-400">
                                                <DragOutlined />
                                              </div>
                                              <div className="flex w-1/12">
                                                {pIdx + 1}
                                              </div>
                                              <div className="flex w-2/12">
                                                <Tag
                                                  color="gold"
                                                  className="text-base font-semibold px-2 py-0.5"
                                                >
                                                  {playerNumber}
                                                </Tag>
                                              </div>
                                              <div className="flex w-2/12 items-center gap-2">
                                                {playerName}
                                                {createBy === "manual" && (
                                                  <Tag
                                                    color="green"
                                                    className="flex items-center justify-center gap-1 min-w-[60px]"
                                                  >
                                                    <TfiWrite />
                                                    <span>수기</span>
                                                  </Tag>
                                                )}
                                                {(createBy === undefined ||
                                                  createBy === "web") && (
                                                  <Tag
                                                    color="blue"
                                                    className="flex items-center justify-center gap-1 min-w-[60px]"
                                                  >
                                                    <TbWorldWww />
                                                    <span>웹</span>
                                                  </Tag>
                                                )}
                                              </div>
                                              <div className="flex w-3/12">
                                                {playerGym}
                                              </div>
                                              <div className="flex w-3/12 text-gray-600">
                                                {invoiceCreateAt}
                                              </div>
                                            </div>
                                          )}
                                        </Draggable>
                                      );
                                    })}
                                </div>
                              )}

                              {isMobile && (
                                <div className="flex flex-col w-full gap-2">
                                  {matchedPlayers
                                    .sort(
                                      (a, b) => a.playerIndex - b.playerIndex
                                    )
                                    .map((player, pIdx) => (
                                      <Draggable
                                        draggableId={player.playerUid}
                                        index={{
                                          parentIndex: mIdx,
                                          childIndex: pIdx,
                                        }}
                                        key={player.playerUid}
                                      >
                                        {(provided, snapshot) => (
                                          <PlayerCardView
                                            player={player}
                                            index={pIdx}
                                            provided={provided}
                                            snapshot={snapshot}
                                          />
                                        )}
                                      </Draggable>
                                    ))}
                                </div>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    </Card>
                  );
                })}
          </div>
        </>
      )}
    </div>
  );
};

export default ContestPlayerOrderTable;
