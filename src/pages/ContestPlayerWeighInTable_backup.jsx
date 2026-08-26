"use client";

import { useContext, useEffect, useState } from "react";
import LoadingPage from "./LoadingPage";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useNavigate } from "react-router-dom";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import {
  Button,
  Card,
  Tag,
  Checkbox,
  Space,
  Modal,
  InputNumber,
  Tooltip,
} from "antd";
import {
  SaveOutlined,
  FileTextOutlined,
  CalendarOutlined,
  EditOutlined,
  NumberOutlined,
} from "@ant-design/icons";

const ContestPlayerWeighInTable = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [matchedArray, setMatchedArray] = useState([]);
  const [categorysArray, setCategorysArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [playersAssign, setPlayersAssign] = useState({});
  const [playersArray, setPlayersArray] = useState([]);
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  // ✅ 번호/인덱스 수정 모달 상태
  const [numModalOpen, setNumModalOpen] = useState(false);
  const [editTargetUid, setEditTargetUid] = useState(null);
  const [editValues, setEditValues] = useState({
    playerNumber: null,
    playerIndex: null,
    playerName: "",
  });

  const { currentContest } = useContext(CurrentContestContext);
  const navigate = useNavigate();

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

  const updatePlayersFinal = useFirestoreUpdateData("contest_players_final");
  const updatePlayersAssign = useFirestoreUpdateData("contest_players_assign");

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

    const returnPlayersAssign = await fetchPlayersAssignDocument.getDocument(
      currentContest.contests.contestPlayersAssignId
    );
    if (!returnPlayersAssign) {
      return;
    } else {
      setPlayersAssign({ ...returnPlayersAssign });
      setPlayersArray([...returnPlayersAssign?.players]);
    }
  };

  const initEntryList = () => {
    const dummy = [];
    categorysArray
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .map((category) => {
        const matchedGrades = gradesArray.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );
        const matchedGradesLength = matchedGrades.length;
        matchedGrades
          .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
          .map((grade) => {
            const matchedPlayerWithPlayerNumber = [];
            const matchedPlayers = playersArray.filter(
              (entry) => entry.contestGradeId === grade.contestGradeId
            );

            matchedPlayers.map((player) => {
              const { playerNumber, playerIndex, playerNoShow } = player;

              const newPlayer = {
                ...player,
                playerNumber,
                playerNoShow,
                playerIndex,
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

    setMatchedArray([...dummy]);
    setIsLoading(false);
  };

  const handleUpdatePlayersFinal = async (
    contestId,
    playerAssignId,
    playersFinalId,
    data
  ) => {
    setMessage({ body: "저장중", isButton: false });
    setMsgOpen(true);

    const finalPlayers = data.map((player) => {
      const {
        contestCategoryId,
        contestGradeId,
        contestId,
        playerNumber,
        playerUid,
        playerName,
        playerGym,
        playerIndex,
        playerNoShow,
        playerText,
        isGradeChanged,
      } = player;
      const playerInfo = {
        contestCategoryId,
        contestGradeId,
        contestId,
        playerNumber,
        playerUid,
        playerName,
        playerGym,
        playerIndex,
        playerNoShow,
        playerText,
        isGradeChanged,
      };
      return playerInfo;
    });

    try {
      await updatePlayersAssign.updateData(playerAssignId, {
        ...playersAssign,
        players: [...data],
      });
      await updatePlayersFinal
        .updateData(playersFinalId, {
          contestId,
          players: [...finalPlayers],
        })
        .then(() => setPlayersArray([...data]))
        .then(() =>
          setMessage({
            body: "저장되었습니다.",
            isButton: true,
            confirmButtonText: "확인",
          })
        );
    } catch (error) {
      console.log(error);
    }
  };

  const handleNoShow = async (playerNumber, e) => {
    setIsLoading(true);
    const newPlayersArray = [...playersArray];
    const findIndexPlayer = playersArray.findIndex(
      (player) => player.playerNumber === Number.parseInt(playerNumber)
    );

    if (findIndexPlayer === -1) {
      return;
    } else {
      const newPlayerInfo = {
        ...playersArray[findIndexPlayer],
        playerNoShow: e.target.checked,
      };

      newPlayersArray.splice(findIndexPlayer, 1, { ...newPlayerInfo });
      setPlayersArray([...newPlayersArray]);
    }
    setIsLoading(false);
  };

  const handleGradeChage = async (
    e,
    currentCategoryId,
    currentGradeId,
    currentGradeTitle,
    currentPlayerUid
  ) => {
    setIsLoading(true);
    const newMatched = [...matchedArray];
    const newPlayers = [...playersArray];

    const entryFindIndex = newMatched.findIndex(
      (entry) =>
        entry.contestCategoryId === currentCategoryId &&
        entry.contestGradeId === currentGradeId
    );

    const playerFindIndex = playersArray.findIndex(
      (entry) =>
        entry.contestCategoryId === currentCategoryId &&
        entry.contestGradeId === currentGradeId &&
        entry.playerUid === currentPlayerUid
    );

    const currentPlayerInfo = newPlayers.find(
      (entry) =>
        entry.contestCategoryId === currentCategoryId &&
        entry.contestGradeId === currentGradeId &&
        entry.playerUid === currentPlayerUid
    );

    if (e.target.checked) {
      if (entryFindIndex < newMatched.length - 1) {
        const {
          contestGradeId: nextGradeId,
          contestGradeTitle: nextGradeTitle,
        } = newMatched[entryFindIndex + 1];

        const newPlayerInfo = {
          ...currentPlayerInfo,
          contestGradeId: nextGradeId,
          contestGradeTitle: nextGradeTitle,
          isGradeChanged: true,
          playerIndex: currentPlayerInfo.playerIndex + 1000,
        };
        newPlayers.splice(playerFindIndex, 1, { ...newPlayerInfo });
      } else {
        console.log(
          `불가: 선수 ${currentPlayerInfo.playerName} (UID: ${currentPlayerInfo.playerUid}) 는 마지막 grade에 속해있습니다. 다음 grade가 없습니다.`
        );
      }
    } else {
      const newPlayerInfo = {
        ...currentPlayerInfo,
        contestGradeId: currentPlayerInfo.originalGradeId,
        contestGradeTitle: currentPlayerInfo.originalGradeTitle,
        isGradeChanged: false,
        playerIndex: currentPlayerInfo.playerIndex - 1000,
      };
      newPlayers.splice(playerFindIndex, 1, { ...newPlayerInfo });
    }

    setPlayersArray([...newPlayers]);
    initEntryList();
    setIsLoading(false);
  };

  // ✅ 번호/인덱스 수정 모달 열기
  const openNumberModal = (player) => {
    setEditTargetUid(player.playerUid);
    setEditValues({
      playerNumber: Number(player.playerNumber) || 0,
      playerIndex:
        Number(player.playerIndex) || Number(player.playerNumber) || 0,
      playerName: player.playerName || "",
    });
    setNumModalOpen(true);
  };

  // ✅ 번호/인덱스 수정 적용
  const applyNumberChange = () => {
    const { playerNumber, playerIndex } = editValues;
    if (playerNumber <= 0 || playerIndex <= 0) {
      // 간단 검증
      return;
    }

    const newPlayers = [...playersArray];
    const idx = newPlayers.findIndex((p) => p.playerUid === editTargetUid);
    if (idx !== -1) {
      newPlayers[idx] = {
        ...newPlayers[idx],
        playerNumber: Number(playerNumber),
        playerIndex: Number(playerIndex),
      };
      setPlayersArray(newPlayers);
      // 리스트 재구성 (화면 반영)
      initEntryList();
    }
    setNumModalOpen(false);
    setEditTargetUid(null);
  };

  useEffect(() => {
    fetchPool();
  }, [currentContest]);

  useEffect(() => {
    if (categorysArray.length > 0) {
      initEntryList();
    }
  }, [categorysArray, gradesArray, playersArray]);

  const PlayerWeighInCard = ({
    player,
    pIdx,
    gradeIndex,
    gradeLength,
    categoryId,
    gradeId,
    gradeTitle,
  }) => {
    const {
      playerName,
      playerGym,
      playerUid,
      playerNumber,
      playerNoShow,
      isGradeChanged,
      invoiceCreateAt,
      playerIndex,
    } = player;

    return (
      <Card size="small" className="mb-2">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <Space>
              <span className="font-semibold text-base">순번: {pIdx + 1}</span>
            </Space>
            <Space>
              <Tag color="gold" className="text-base font-semibold px-2 py-0.5">
                {playerNumber}
              </Tag>
              <Tooltip title="번호/인덱스 수정">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openNumberModal(player)}
                />
              </Tooltip>
            </Space>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className={`font-medium ${
                  playerNoShow ? "text-gray-300 line-through" : ""
                }`}
              >
                {playerName}
              </span>
              <Tag
                icon={<NumberOutlined />}
                className="ml-1"
              >{`idx ${playerIndex}`}</Tag>
            </div>
            <div
              className={`text-gray-600 text-sm ${
                playerNoShow ? "text-gray-300 line-through" : ""
              }`}
            >
              {playerGym}
            </div>
            {invoiceCreateAt && (
              <div
                className={`text-gray-500 text-xs flex items-center gap-1 ${
                  playerNoShow ? "text-gray-300 line-through" : ""
                }`}
              >
                <CalendarOutlined />
                {invoiceCreateAt}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">월체:</span>
              {gradeIndex < Number.parseInt(gradeLength) || isGradeChanged ? (
                <Checkbox
                  checked={isGradeChanged}
                  disabled={playerNoShow}
                  onChange={(e) =>
                    handleGradeChage(
                      e,
                      categoryId,
                      gradeId,
                      gradeTitle,
                      playerUid
                    )
                  }
                />
              ) : (
                <span className="text-sm text-gray-400">불가</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">불참:</span>
              <Checkbox
                checked={playerNoShow}
                onChange={(e) => handleNoShow(playerNumber, e)}
              />
            </div>
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
            onConfirm={() => setMsgOpen(false)}
            onCancel={() => setMsgOpen(false)}
            message={message}
          />

          {/* 번호/인덱스 수정 모달 */}
          <Modal
            open={numModalOpen}
            title={
              <div className="flex items-center gap-2">
                <EditOutlined />
                <span>선수 번호 / Index 수정</span>
              </div>
            }
            onOk={applyNumberChange}
            onCancel={() => {
              setNumModalOpen(false);
              setEditTargetUid(null);
            }}
            okText="적용"
            cancelText="취소"
            destroyOnClose
          >
            <div className="flex flex-col gap-4">
              <div className="text-sm text-gray-600">
                선수:{" "}
                <span className="font-semibold">{editValues.playerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="mr-4">선수번호 (playerNumber)</span>
                <InputNumber
                  min={1}
                  value={editValues.playerNumber}
                  onChange={(v) =>
                    setEditValues((prev) => ({ ...prev, playerNumber: v }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="mr-4">표시순서 Index (playerIndex)</span>
                <InputNumber
                  min={1}
                  value={editValues.playerIndex}
                  onChange={(v) =>
                    setEditValues((prev) => ({ ...prev, playerIndex: v }))
                  }
                />
              </div>
              <div className="text-xs text-gray-500">
                * 기본값은 기존 선수의 번호/인덱스를 불러옵니다. 필요 시
                수정하세요.
              </div>
            </div>
          </Modal>

          <Card className="shadow-sm mb-2">
            <div className="flex items-center gap-3">
              <div className="flex w-10 h-10 justify-center items-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                <FileTextOutlined className="text-xl" />
              </div>
              <h1
                className="text-xl font-bold"
                style={{ letterSpacing: "1px" }}
              >
                계측(2단계)
              </h1>
            </div>
          </Card>

          <div className="flex w-full justify-end mb-2">
            {playersArray?.length ? (
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                className="w-full"
                onClick={() =>
                  handleUpdatePlayersFinal(
                    currentContest.contests.id,
                    currentContest.contests.contestPlayersAssignId,
                    currentContest.contests.contestPlayersFinalId,
                    playersArray
                  )
                }
              >
                최종명단 저장
              </Button>
            ) : (
              <Button
                type="default"
                size="large"
                onClick={() =>
                  navigate("/contesttimetable", { state: { tabId: 1 } })
                }
              >
                선수번호 배정이 필요합니다.
              </Button>
            )}
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

                  if (matchedPlayers.length === 0) return null;

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
                      {!isMobile && (
                        <div className="flex flex-col w-full">
                          <div className="flex w-full border-b-2 border-gray-200 h-12 items-center font-semibold bg-gray-50 px-4 rounded-t-lg">
                            <div className="flex w-1/12">순번</div>
                            <div className="flex w-2/12">선수번호</div>
                            <div className="flex w-[30%]">이름</div>
                            <div className="flex w-2/12">소속</div>
                            <div className="flex w-1/12">월체</div>
                            <div className="flex w-1/12">불참</div>
                            <div className="flex w-3/12">신청일</div>
                          </div>

                          {matchedPlayers
                            .sort((a, b) => a.playerIndex - b.playerIndex)
                            .map((player, pIdx) => {
                              const {
                                playerName,
                                playerGym,
                                playerUid,
                                playerNumber,
                                playerNoShow,
                                isGradeChanged,
                                invoiceCreateAt,
                                playerIndex,
                              } = player;

                              return (
                                <div
                                  className="flex w-full h-14 border-b border-gray-200 items-center px-4 hover:bg-gray-50 transition-colors"
                                  key={playerUid}
                                  id={playerUid}
                                >
                                  <div
                                    className={`flex w-1/12 ${
                                      playerNoShow
                                        ? "text-gray-300 line-through"
                                        : ""
                                    }`}
                                  >
                                    {pIdx + 1}
                                  </div>
                                  <div className="flex w-2/12 items-center gap-2">
                                    <Tag
                                      color="gold"
                                      className="text-base font-semibold px-2 py-0.5"
                                    >
                                      {playerNumber}
                                    </Tag>
                                    <Tooltip title="번호/인덱스 수정">
                                      <Button
                                        size="small"
                                        icon={<EditOutlined />}
                                        onClick={() => openNumberModal(player)}
                                      />
                                    </Tooltip>
                                  </div>
                                  <div
                                    className={`flex w-[30%] items-center gap-2 ${
                                      playerNoShow
                                        ? "text-gray-300 line-through"
                                        : ""
                                    }`}
                                  >
                                    {playerName}
                                  </div>
                                  <div
                                    className={`flex w-2/12 ${
                                      playerNoShow
                                        ? "text-gray-300 line-through"
                                        : ""
                                    }`}
                                  >
                                    {playerGym}
                                  </div>
                                  <div className="flex w-1/12">
                                    {gradeIndex <
                                      Number.parseInt(gradeLength) ||
                                    isGradeChanged ? (
                                      <Checkbox
                                        checked={isGradeChanged}
                                        disabled={playerNoShow}
                                        onChange={(e) =>
                                          handleGradeChage(
                                            e,
                                            categoryId,
                                            gradeId,
                                            gradeTitle,
                                            playerUid
                                          )
                                        }
                                      />
                                    ) : (
                                      <span className="text-gray-400">
                                        불가
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex w-1/12">
                                    <Checkbox
                                      checked={playerNoShow}
                                      onChange={(e) =>
                                        handleNoShow(playerNumber, e)
                                      }
                                    />
                                  </div>
                                  <div
                                    className={`flex w-3/12 text-gray-600 ${
                                      playerNoShow
                                        ? "text-gray-300 line-through"
                                        : ""
                                    }`}
                                  >
                                    {invoiceCreateAt}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}

                      {isMobile && (
                        <div className="flex flex-col w-full gap-2">
                          {matchedPlayers
                            .sort((a, b) => a.playerIndex - b.playerIndex)
                            .map((player, pIdx) => (
                              <PlayerWeighInCard
                                key={player.playerUid}
                                player={player}
                                pIdx={pIdx}
                                gradeIndex={gradeIndex}
                                gradeLength={gradeLength}
                                categoryId={categoryId}
                                gradeId={gradeId}
                                gradeTitle={gradeTitle}
                              />
                            ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
          </div>
        </>
      )}
    </div>
  );
};

export default ContestPlayerWeighInTable;
