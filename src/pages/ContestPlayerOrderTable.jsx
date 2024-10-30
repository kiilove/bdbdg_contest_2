import React, { useContext, useEffect, useState } from "react";

import LoadingPage from "./LoadingPage";
import { TiInputChecked } from "react-icons/ti";

import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";

import { CurrentContestContext } from "../contexts/CurrentContestContext";

import { useNavigate } from "react-router-dom";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { MdOutlineScale } from "react-icons/md";

const ContestPlayerOrderTable = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [matchedArray, setMatchedArray] = useState([]);
  const [categorysArray, setCategorysArray] = useState([]);

  const [gradesArray, setGradesArray] = useState([]);
  const [playersAssign, setPlayersAssign] = useState({});
  const [playersArray, setPlayersArray] = useState([]);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

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
  // TODO: contest_players_assign에서 선수 정보를 불러오고, 월체에 대한 부분도 여기서 처리해야한다.
  // 월체정리 이후에는 불참선수 처리까지 완료해야한다.

  const updatePlayersFinal = useFirestoreUpdateData("contest_players_final");
  const updatePlayersAssign = useFirestoreUpdateData("contest_players_assign");

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
    let dummy = [];
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
            const matchedPlayers = playersArray.filter(
              (entry) => entry.contestGradeId === grade.contestGradeId
            );

            matchedPlayers.map((player, pIdx) => {
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

    const finalPlayers = data.map((player, pIdx) => {
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
      (player) => player.playerNumber === parseInt(playerNumber)
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
      // 다음 grade가 있는지 확인
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
        // 다음 grade가 없으면 불가 사유를 console에 출력
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

  const handleGradeChageOld = async (
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

    const { contestGradeId: nextGradeId, contestGradeTitle: nextGradeTitle } =
      newMatched[entryFindIndex + 1];

    if (e.target.checked) {
      const newPlayerInfo = {
        ...currentPlayerInfo,
        contestGradeId: nextGradeId,
        contestGradeTitle: nextGradeTitle,
        isGradeChanged: true,
        playerIndex: currentPlayerInfo.playerIndex + 1000,
      };
      newPlayers.splice(playerFindIndex, 1, { ...newPlayerInfo });

      setPlayersArray([...newPlayers]);
      initEntryList();
    } else {
      const newPlayerInfo = {
        ...currentPlayerInfo,
        contestGradeId: currentPlayerInfo.originalGradeId,
        contestGradeTitle: currentPlayerInfo.originalGradeTitle,
        isGradeChanged: false,
        playerIndex: currentPlayerInfo.playerIndex - 1000,
      };
      newPlayers.splice(playerFindIndex, 1, { ...newPlayerInfo });

      setPlayersArray([...newPlayers]);
      initEntryList();
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPool();
  }, [currentContest]);

  useEffect(() => {
    console.log(playersArray);
    if (categorysArray.length > 0) {
      initEntryList();
    }
  }, [categorysArray, gradesArray, playersArray]);

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
              <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
                <MdOutlineScale />
              </span>
              <h1
                className="font-sans text-lg font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                계측(2단계)
              </h1>
            </div>
          </div>
          <div className="flex w-full h-full">
            <div className="flex w-full justify-start items-center">
              <div className="flex w-full h-full justify-start lg:px-3 lg:pt-3 flex-col bg-gray-100 rounded-lg gap-y-2">
                {playersArray?.length ? (
                  <div className="flex w-full gap-x-5">
                    <button
                      className="w-full h-12 bg-gradient-to-r from-blue-300 to-cyan-200 rounded-lg"
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
                    </button>
                  </div>
                ) : (
                  <div className="flex w-full gap-x-5">
                    <button
                      className="w-full h-12 bg-gradient-to-l from-green-300 to-green-200 rounded-lg"
                      onClick={() =>
                        navigate("/contesttimetable", { state: { tabId: 1 } })
                      }
                    >
                      선수번호 배정이 필요합니다.
                    </button>
                  </div>
                )}

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
                                          invoiceCreateAt,
                                        } = player;

                                        return (
                                          <div
                                            className="flex w-full h-10 border-b border-gray-300 items-center text-sm lg:px-2"
                                            key={playerUid}
                                            id={playerUid}
                                          >
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
                                                  ? "flex w-1/6"
                                                  : "flex w-1/6 text-gray-300 line-through"
                                              }`}
                                            >
                                              {playerGym}
                                            </div>
                                            <div
                                              className={`${
                                                !playerNoShow
                                                  ? "flex w-1/6"
                                                  : "flex w-1/6 text-gray-300 line-through"
                                              }`}
                                            >
                                              {gradeIndex <
                                                parseInt(gradeLength) ||
                                              isGradeChanged ? (
                                                <input
                                                  type="checkbox"
                                                  checked={isGradeChanged}
                                                  className={`${
                                                    playerNoShow
                                                      ? "hidden"
                                                      : "w-5 h-5"
                                                  }`}
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
                                                <span>불가</span>
                                              )}
                                            </div>
                                            <div
                                              className={`${
                                                !playerNoShow
                                                  ? "flex w-1/6"
                                                  : "flex w-1/6 text-gray-300 line-through"
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={playerNoShow}
                                                className="w-5 h-5"
                                                onChange={(e) =>
                                                  handleNoShow(playerNumber, e)
                                                }
                                              />
                                            </div>
                                            <div
                                              className={`${
                                                !playerNoShow
                                                  ? "hidden lg:flex w-1/6"
                                                  : "hidden lg:flex w-1/6 text-gray-300 line-through"
                                              }`}
                                            >
                                              {invoiceCreateAt}
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

export default ContestPlayerOrderTable;
