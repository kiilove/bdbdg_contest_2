import React, { useContext } from "react";
import { useState } from "react";
import LoadingPage from "../pages/LoadingPage";
import { useEffect } from "react";
import { debounce, isNumber } from "lodash";
import { MdLiveHelp } from "react-icons/md";
import {
  useFirebaseRealtimeDeleteData,
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import { generateUUID } from "../functions/functions";
import {
  useFirestoreAddData,
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { setRef } from "@mui/material";

const CompareSetting = ({
  stageInfo,
  setClose,
  matchedOriginalPlayers,
  setRefresh,
  propCompareIndex,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [compareList, setCompareList] = useState({});
  const [compareArray, setCompareArray] = useState([]);

  const [compareMsgOpen, setCompareMsgOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [votedInfo, setVotedInfo] = useState({
    playerLength: undefined,
    scoreMode: undefined,
    voteRange: "all",
  });

  const [compareStatus, setCompareStatus] = useState({
    compareStart: false,
    compareEnd: false,
    compareCancel: false,
    compareIng: false,
  });

  const [compareId, setCompareId] = useState("");

  const [isVotedPlayerLengthInput, setIsVotedPlayerLengthInput] =
    useState(false);

  const [votedResult, setVotedResult] = useState([]);
  const [topResult, setTopResult] = useState([]);
  const [votedValidate, setVotedValidate] = useState(true);
  const { data: realtimeData, getDocument: realtimeFunction } =
    useFirebaseRealtimeGetDocument();
  const updateRealtimeCompare = useFirebaseRealtimeUpdateData();

  const fetchCompare = useFirestoreGetDocument("contest_compares_list");
  const updateCompare = useFirestoreUpdateData("contest_compares_list");

  const { currentContest } = useContext(CurrentContestContext);

  const fetchPool = async (gradeId, compareListId) => {
    if (gradeId === undefined || compareId === undefined) {
      setMessage({
        body: "데이터 로드에 문제가 발생했습니다.",
        body2: "다시 시도해주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    try {
      await fetchCompare
        .getDocument(compareListId)
        .then((data) => {
          console.log(data);
          setCompareList({ ...data });
          return data;
        })
        .then((data) => {
          console.log(data.compares);
          console.log(data.compares.length);
          data?.compares?.length > 0 && setCompareArray([...data.compares]);
        });
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompareModeStart = async (contestId, data) => {
    const collectionInfo = `currentStage/${contestId}/compares`;
    try {
      setVotedInfo({});
      await updateRealtimeCompare.updateData(collectionInfo, data).then(() =>
        setCompareStatus(() => ({
          compareStart: true,
          compareEnd: false,
          compareCancel: false,
          compareIng: false,
        }))
      );
    } catch (error) {
      console.log(error);
    }
  };

  const handleCompareCancel = async (contestId) => {
    const collectionInfoByCompares = `currentStage/${contestId}/compares`;
    const newCompareArray = [...compareArray];
    newCompareArray.splice(compareArray?.length - 1, 1);

    try {
      await updateRealtimeCompare
        .updateData(collectionInfoByCompares, {
          status: {
            compareStart: false,
            compareEnd: false,
            compareCancel: false,
            compareIng: false,
          },
        })
        .then((data) => console.log(data))
        .then(() =>
          setCompareStatus(() => ({
            compareStart: false,
            compareEnd: false,
            compareCancel: true,
            compareIng: false,
          }))
        )
        .then(async () => {
          await updateCompare.updateData(compareList.id, {
            ...compareList,
            compares: [...newCompareArray],
          });
        })
        .then(() => {
          setCompareList(() => ({
            ...compareList,
            compares: [...newCompareArray],
          }));
          setCompareArray(() => [...newCompareArray]);
        })

        .then(() =>
          setCompareStatus(() => ({
            compareStart: false,
            compareEnd: false,
            compareCancel: true,
            compareIng: false,
          }))
        )
        .then(() => setRefresh(true))
        .then(() => setClose(false));
    } catch (error) {
      console.log(error);
    }
  };

  const handleAdd = async (contestId, compareId) => {
    const collection = `currentStage/${contestId}/compare`;
    setTopResult({});

    const newCompareMode = {
      compareStart: true,
      compareEnd: false,
      compareCancel: false,
      compareIng: false,
    };

    //상황판
    const judgeMessageInfo = realtimeData?.judges.map((judge, sIdx) => {
      const { seatIndex } = judge;
      return { seatIndex, messageStatus: "확인전" };
    });

    //realtime Update
    const realtimeCompareInfo = {
      compareIndex: propCompareIndex,
      status: { ...newCompareMode },
      playerLength: votedInfo.playerLength,
      scoreMode: votedInfo.scoreMode,
      voteRange: votedInfo.voteRange,
      judges: [...judgeMessageInfo],
    };

    try {
      await handleCompareModeStart(
        currentContest.contests.id,
        realtimeCompareInfo
      );
    } catch (error) {
      console.log(error);
    }
  };

  const handleUpdateComparePlayers = async (
    playerTopResult,
    playerVoteResult,
    contestId,
    compareListId
  ) => {
    //console.log(playerVoteResult);

    //firestore Update
    const compareInfo = {
      contestId,
      categoryId: stageInfo.categoryId,
      gradeId: stageInfo.grades[0].gradeId,
      categoryTitle: stageInfo.categoryTitle,
      gradeTitle: stageInfo.grades[0].gradeTitle,
      compareIndex: propCompareIndex,
      comparePlayerLength: parseInt(votedInfo.playerLength),
      compareScoreMode: votedInfo.scoreMode,
      players: [...playerTopResult],
      votedResult: [...playerVoteResult],
    };

    try {
      const collectionInfoCompares = `currentStage/${contestId}/compares`;

      const newStatus = {
        compareStart: false,
        compareEnd: false,
        compareCancel: false,
        compareIng: true,
      };
      const newCompares = [...compareArray];
      newCompares.push({ ...compareInfo });

      await updateRealtimeCompare
        .updateData(collectionInfoCompares, {
          ...realtimeData.compares,
          status: { ...newStatus },
          players: [...playerTopResult],
        })
        .then(
          async () =>
            await updateCompare.updateData(compareListId, {
              ...compareList,
              compares: [...newCompares],
            })
        )
        .then(() => setCompareArray(() => [...newCompares]))
        .then(() =>
          setCompareList(() => ({
            ...compareList,
            compares: [...newCompares],
          }))
        )
        .then(() => setRefresh(true))
        .then(() => setClose(false));
    } catch (error) {
      console.log(error);
    }
  };

  const handleGetTopPlayers = (players, playerLength) => {
    if (!players || players.length === 0) {
      return [];
    }

    // votedCount 기준으로 내림차순 정렬
    const sortedPlayers = players.sort((a, b) => b.votedCount - a.votedCount);

    // playerLength만큼 상위 선수 추출
    let topPlayers = sortedPlayers.slice(0, playerLength);

    // 만약 playerLength번째 선수와 같은 투표수를 가진 다른 선수가 있다면 그들도 포함
    const lastVotedCount = topPlayers[topPlayers.length - 1].votedCount;
    let i = playerLength;
    while (sortedPlayers[i] && sortedPlayers[i].votedCount === lastVotedCount) {
      topPlayers.push(sortedPlayers[i]);
      i++;
    }

    return topPlayers;
  };
  const handleCountPlayerVotes = (data) => {
    const voteCounts = {};

    if (data?.length > 0) {
      data.forEach((entry) => {
        // votedPlayerNumber가 존재하고, 배열이며, 그 길이가 0보다 클 경우에만 처리
        if (
          entry.votedPlayerNumber &&
          Array.isArray(entry.votedPlayerNumber) &&
          entry.votedPlayerNumber.length > 0
        ) {
          entry.votedPlayerNumber.forEach((vote) => {
            const key = `${vote.playerNumber}-${vote.playerUid}`;
            if (!voteCounts[key]) {
              voteCounts[key] = {
                playerNumber: vote.playerNumber,
                playerUid: vote.playerUid,
                votedCount: 0,
              };
            }
            voteCounts[key].votedCount += 1;
          });
        }
      });
    }

    // 결과 객체 배열 생성
    const result = [];
    for (let key in voteCounts) {
      result.push(voteCounts[key]);
    }

    return result;
  };

  useEffect(() => {
    console.log(stageInfo);
    console.log(currentContest);
    if (
      stageInfo.grades[0].gradeId &&
      currentContest.contests.contestComparesListId
    ) {
      fetchPool(
        stageInfo.grades[0].gradeId,
        currentContest.contests.contestComparesListId
      );
    }
  }, [
    stageInfo.grades[0].gradeId,
    currentContest.contests.contestComparesListId,
  ]);

  useEffect(() => {
    if (realtimeData?.compares?.status?.compareStart) {
      setVotedInfo(() => ({
        playerLength: realtimeData.compares.playerLength,
        scoreMode: realtimeData.compares.scoreMode,
        voteRange: realtimeData.compares.voteRange,
      }));
    }
  }, [realtimeData?.compares]);

  useEffect(() => {
    if (realtimeData?.compares?.judges?.length > 0) {
      setVotedResult(handleCountPlayerVotes(realtimeData?.compares?.judges));
      const validatedMessages = realtimeData.compares.judges.some(
        (s) => s.messageStatus !== "투표완료"
      );
      setVotedValidate(validatedMessages);
    }
  }, [realtimeData?.compares?.judges]);

  useEffect(() => {
    if (votedResult?.length > 0) {
      setTopResult(
        handleGetTopPlayers(votedResult, realtimeData?.compares?.playerLength)
      );
    }

    // console.log(topResult);
  }, [votedResult]);

  useEffect(() => {
    if (currentContest?.contests?.id) {
      const debouncedGetDocument = debounce(
        () => realtimeFunction(`currentStage/${currentContest.contests.id}`),
        2000
      );
      debouncedGetDocument();
    }

    return () => {};
  }, [realtimeFunction]);

  useEffect(() => {
    // /console.log(stageInfo);
  }, [stageInfo]);

  return (
    <>
      <div className="flex w-full h-full flex-col bg-white justify-start items-center p-5 gap-y-2 overflow-y-auto">
        {isLoading && <LoadingPage />}
        {!isLoading && (
          <>
            <div className="flex text-2xl font-bold  bg-blue-300 rounded-lg w-full h-auto justify-center items-center text-gray-700 flex-col p-2 gap-y-2">
              <ConfirmationModal
                isOpen={msgOpen}
                message={message}
                onCancel={() => setMsgOpen(false)}
                onConfirm={() => {
                  setClose(false);
                  setMsgOpen(false);
                }}
              />
              <ConfirmationModal
                isOpen={compareMsgOpen}
                message={message}
                onCancel={() => setCompareMsgOpen(false)}
                onConfirm={() => {
                  handleCompareCancel(currentContest?.contests?.id);
                }}
              />
              <div className="flex w-full bg-blue-100 rounded-lg py-3 flex-col">
                <div className="flex w-full h-auto justify-center items-center">
                  <div className="flex w-1/4 h-auto"> </div>
                  <div className="flex w-1/2 h-auto justify-center items-center">
                    <span>
                      {stageInfo?.categoryTitle}(
                      {stageInfo?.grades[0]?.gradeTitle}){" "}
                    </span>
                    <span className="pl-5 pr-2">{propCompareIndex}차</span>
                    <span> 비교심사 설정</span>
                  </div>
                  <div className="flex w-1/4 h-auto justify-end px-3 gap-x-2">
                    <button
                      className="w-40 text-base font-normal bg-red-400 p-2 rounded-lg text-gray-100"
                      onClick={() => {
                        setMessage({
                          body: "비교심사를 취소하시겠습니까?",
                          isButton: true,
                          cancelButtonText: "아니오",
                          confirmButtonText: "예",
                        });
                        setCompareMsgOpen(true);
                      }}
                    >
                      비교심사취소
                    </button>
                    <button
                      className="w-32 text-base font-normal bg-gray-600 p-2 rounded-lg text-gray-100"
                      onClick={() => {
                        setRefresh(true);
                        setClose(false);
                      }}
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex w-full bg-gray-100 rounded-lg py-3 flex-col text-xl">
                {propCompareIndex > 1 && (
                  <>
                    {realtimeData?.compares?.status?.compareStart ? (
                      <div className="flex w-full h-auto px-5 py-2">
                        <div
                          className="flex h-auto justify-start items-center"
                          style={{ width: "10%", minWidth: "230px" }}
                        >
                          투표대상 설정
                        </div>
                        <div className="flex h-auto justify-center items-center gap-2 text-lg flex-wrap box-border">
                          {votedInfo?.voteRange === "all" ? (
                            <button
                              className="bg-gray-500 p-2 rounded-lg border border-gray-600 text-gray-100"
                              style={{ minWidth: "80px" }}
                            >
                              해당체급 전체
                            </button>
                          ) : (
                            <button
                              className="bg-gray-500 p-2 rounded-lg border border-gray-600 text-gray-100"
                              style={{ minWidth: "80px" }}
                            >
                              {propCompareIndex - 1}차 선발인원만
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex w-full h-auto px-5 py-2">
                        <div
                          className="flex h-auto justify-start items-center"
                          style={{ width: "10%", minWidth: "230px" }}
                        >
                          투표대상 설정
                        </div>
                        <div className="flex h-auto justify-center items-center gap-2 text-lg flex-wrap box-border">
                          <button
                            className={`${
                              votedInfo.voteRange === "all"
                                ? "bg-blue-500 p-2 rounded-lg border border-blue-600 text-gray-100"
                                : "bg-white p-2 rounded-lg border border-blue-200"
                            }`}
                            style={{ minWidth: "80px" }}
                            onClick={() => {
                              setVotedInfo(() => ({
                                ...votedInfo,
                                voteRange: "all",
                              }));
                            }}
                          >
                            해당체급 전체
                          </button>
                          <button
                            className={`${
                              votedInfo.voteRange === "voted"
                                ? "bg-blue-500 p-2 rounded-lg border border-blue-600 text-gray-100"
                                : "bg-white p-2 rounded-lg border border-blue-200"
                            }`}
                            style={{ minWidth: "80px" }}
                            onClick={() => {
                              setVotedInfo(() => ({
                                ...votedInfo,
                                voteRange: "voted",
                              }));
                            }}
                          >
                            {propCompareIndex - 1}차 선발인원만
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {realtimeData?.compares?.status?.compareStart ? (
                  <div className="flex w-full h-auto px-5 py-2">
                    <div
                      className="flex h-auto justify-start items-center"
                      style={{ width: "10%", minWidth: "230px" }}
                    >
                      심사대상 인원수 설정
                    </div>
                    <div className="flex h-auto justify-center items-center gap-2 text-lg flex-wrap box-border">
                      <button
                        className="bg-gray-500 p-2 rounded-lg border border-gray-600 text-gray-100"
                        style={{ minWidth: "80px" }}
                      >
                        TOP {votedInfo.playerLength}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full h-auto px-5 py-2">
                    <div
                      className="flex h-auto justify-start items-center"
                      style={{ width: "10%", minWidth: "230px" }}
                    >
                      심사대상 인원수 설정
                    </div>
                    <div className="flex h-auto justify-center items-center gap-2 text-lg flex-wrap box-border">
                      {matchedOriginalPlayers?.length >= 3 && (
                        <button
                          value={3}
                          onClick={(e) => {
                            setVotedInfo(() => ({
                              ...votedInfo,
                              playerLength: parseInt(e.target.value),
                            }));
                            setIsVotedPlayerLengthInput(false);
                          }}
                          className={`${
                            votedInfo.playerLength === 3
                              ? "bg-blue-500 p-2 rounded-lg border border-blue-600 text-gray-100"
                              : "bg-white p-2 rounded-lg border border-blue-200"
                          }`}
                          style={{ minWidth: "80px" }}
                        >
                          TOP 3
                        </button>
                      )}
                      {matchedOriginalPlayers?.length >= 5 && (
                        <button
                          value={5}
                          onClick={(e) => {
                            setVotedInfo(() => ({
                              ...votedInfo,
                              playerLength: parseInt(e.target.value),
                            }));
                            setIsVotedPlayerLengthInput(false);
                          }}
                          className={`${
                            votedInfo.playerLength === 5
                              ? "bg-blue-500 p-2 rounded-lg border border-blue-600 text-gray-100"
                              : "bg-white p-2 rounded-lg border border-blue-200"
                          }`}
                          style={{ minWidth: "80px" }}
                        >
                          TOP 5
                        </button>
                      )}
                      {matchedOriginalPlayers?.length >= 7 && (
                        <button
                          value={7}
                          onClick={(e) => {
                            setVotedInfo(() => ({
                              ...votedInfo,
                              playerLength: parseInt(e.target.value),
                            }));
                            setIsVotedPlayerLengthInput(false);
                          }}
                          className={`${
                            votedInfo.playerLength === 7
                              ? "bg-blue-500 p-2 rounded-lg border border-blue-600 text-gray-100"
                              : "bg-white p-2 rounded-lg border border-blue-200"
                          }`}
                          style={{ minWidth: "80px" }}
                        >
                          TOP 7
                        </button>
                      )}

                      <button
                        className={`${
                          isVotedPlayerLengthInput
                            ? "bg-blue-500 p-2 rounded-lg border border-blue-600 text-gray-100"
                            : "bg-white p-2 rounded-lg border border-blue-200"
                        }`}
                        onClick={() => {
                          setIsVotedPlayerLengthInput(
                            () => !isVotedPlayerLengthInput
                          );
                          setVotedInfo(() => ({
                            ...votedInfo,
                            playerLength: undefined,
                          }));
                        }}
                      >
                        직접입력
                      </button>
                      {isVotedPlayerLengthInput && (
                        <div className="flex">
                          <input
                            type="number"
                            name="playerLength"
                            className="w-auto h-auto p-2 rounded-lg border border-blue-600 text-center"
                            style={{ maxWidth: "80px" }}
                            onChange={(e) => {
                              setVotedInfo(() => ({
                                ...votedInfo,
                                playerLength: parseInt(e.target.value),
                              }));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex w-full h-auto px-5 py-2">
                  <div
                    className="flex h-auto justify-start items-center"
                    style={{ width: "10%", minWidth: "230px" }}
                  >
                    채점모드 설정
                  </div>
                  <div className="flex w-full flex-col gap-y-1">
                    {realtimeData?.compares?.status?.compareStart ? (
                      <>
                        <div className="flex h-auto justify-start items-center gap-2 text-lg">
                          <button
                            className="bg-gray-500 p-2 rounded-lg border border-gray-600 text-gray-100"
                            style={{ minWidth: "80px" }}
                          >
                            {votedInfo.scoreMode === "all" && "전체"}
                            {votedInfo.scoreMode === "topOnly" && "대상자"}
                            {votedInfo.scoreMode === "topWithSub" &&
                              `${propCompareIndex - 1}차 전체`}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex h-auto justify-start items-center gap-2 text-lg">
                          <button
                            value="all"
                            onClick={(e) => {
                              setVotedInfo(() => ({
                                ...votedInfo,
                                scoreMode: e.target.value,
                              }));
                            }}
                            className={`${
                              votedInfo.scoreMode === "all"
                                ? "bg-blue-500 p-2 rounded-lg border border-blue-600 text-gray-100"
                                : "bg-white p-2 rounded-lg border border-blue-200"
                            }`}
                            style={{ minWidth: "80px" }}
                          >
                            전체
                          </button>
                          {propCompareIndex > 1 && (
                            <button
                              value="topWithSub"
                              onClick={(e) => {
                                setVotedInfo(() => ({
                                  ...votedInfo,
                                  scoreMode: e.target.value,
                                }));
                              }}
                              className={`${
                                votedInfo.scoreMode === "topWithSub"
                                  ? "bg-blue-500 p-2 rounded-lg border border-blue-600 text-gray-100"
                                  : "bg-white p-2 rounded-lg border border-blue-200"
                              }`}
                              style={{ minWidth: "80px" }}
                            >
                              {propCompareIndex - 1}차 전체
                            </button>
                          )}

                          <button
                            value="topOnly"
                            onClick={(e) => {
                              setVotedInfo(() => ({
                                ...votedInfo,
                                scoreMode: e.target.value,
                              }));
                            }}
                            className={`${
                              votedInfo.scoreMode === "topOnly"
                                ? "bg-blue-500 p-2 rounded-lg border border-blue-600 text-gray-100"
                                : "bg-white p-2 rounded-lg border border-blue-200"
                            }`}
                            style={{ minWidth: "80px" }}
                          >
                            대상자
                          </button>
                        </div>
                        <div className="flex">
                          {votedInfo.scoreMode === "all" && (
                            <div className="flex justify-start items-center gap-x-2 ml-2">
                              <span className="text-lg text-blue-700">
                                <MdLiveHelp />
                              </span>
                              <span className="text-base font-semibold">
                                출전선수 전원 채점을 완료해야합니다.
                              </span>
                            </div>
                          )}
                          {votedInfo.scoreMode === "topOnly" && (
                            <div className="flex justify-start items-center gap-x-2 ml-2">
                              <span className="text-lg text-blue-700">
                                <MdLiveHelp />
                              </span>
                              <span className="text-base font-semibold">
                                비교심사 대상만 채점합니다. 나머지 선수는 순위외
                                처리됩니다.
                              </span>
                            </div>
                          )}
                          {votedInfo.scoreMode === "topWithSub" && (
                            <div className="flex justify-start items-center gap-x-2 ml-2">
                              <span className="text-lg text-blue-700">
                                <MdLiveHelp />
                              </span>
                              <span className="text-base font-semibold">
                                이전 차수 비교심사 대상 전체를 채점합니다.
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {realtimeData?.compares?.status?.compareStart ? (
                  <div className="flex w-full h-auto px-5 py-2 justify-center items-center">
                    {votedInfo.playerLength !== undefined &&
                      votedInfo.scoreMode !== undefined && (
                        <div className="flex justify-center items-center w-full h-auto px-5 py-2 bg-gray-500 rounded-lg text-gray-100 cursor-not-allowed">
                          비교심사 투표중
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="flex w-full h-auto px-5 py-2">
                    {votedInfo.playerLength !== undefined &&
                      votedInfo.scoreMode !== undefined && (
                        <button
                          className="w-full h-auto px-5 py-2 bg-blue-500 rounded-lg text-gray-100"
                          onClick={() =>
                            handleAdd(
                              currentContest.contests.id,
                              currentContest.contests.contestComparesListId
                            )
                          }
                        >
                          비교심사 투표개시
                        </button>
                      )}
                  </div>
                )}
              </div>
              {realtimeData?.compares?.status?.compareStart && (
                <div className="flex w-full h-auto flex-col gap-y-2">
                  <div className="flex w-full bg-blue-100 rounded-lg py-3 flex-col">
                    <div className="flex w-full justify-center items-center">
                      비교심사 득표 및 투표현황
                    </div>
                  </div>
                  <div className="flex w-full bg-blue-100 rounded-lg py-3 flex-col">
                    <div
                      className="flex w-full justify-center items-center"
                      onClick={() =>
                        handleUpdateComparePlayers(
                          topResult,
                          votedResult,
                          currentContest.contests.id,
                          currentContest.contests.contestComparesListId
                        )
                      }
                    >
                      명단확정(임시버튼)
                    </div>
                  </div>
                  <div className="flex w-full bg-gray-100 rounded-lg py-3 flex-col items-start justify-start">
                    <div className="flex w-full justify-start items-center px-7">
                      <div
                        className="h-full p-2 justify-center items-start flex w-full border first:border-l border-l-0 border-gray-400 "
                        style={{ maxWidth: "200px" }}
                      >
                        선수번호
                      </div>
                      {matchedOriginalPlayers.map((player, pIdx) => {
                        const { playerNumber } = player;
                        return (
                          <div
                            className="h-full p-2 justify-center items-start flex w-full border first:border-l border-l-0 border-gray-400 "
                            style={{ maxWidth: "15%" }}
                          >
                            {playerNumber}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex w-full justify-start items-center px-7">
                      <div
                        className="h-full p-2 justify-center items-start flex w-full border first:border-l border-l-0 border-gray-400 "
                        style={{ maxWidth: "200px" }}
                      >
                        득표수
                      </div>
                      {matchedOriginalPlayers.map((player, pIdx) => {
                        const { playerNumber } = player;

                        return (
                          <div
                            className="h-full p-2 justify-center items-start flex w-full border first:border-l border-l-0 border-gray-400 "
                            style={{ maxWidth: "15%" }}
                          >
                            {(votedResult?.length > 0 &&
                              votedResult.find(
                                (f) => f.playerNumber === playerNumber
                              )?.votedCount) ||
                              0}
                          </div>
                        );
                      })}
                    </div>
                    {compareArray?.length > 0 && (
                      <div className="flex w-full bg-gray-100 rounded-lg py-3 flex-col p-2">
                        <div className="flex w-full h-20 justify-start items-center px-5">
                          <div
                            className="h-full p-2 justify-center items-center flex w-full border first:border-l border-l-0 border-gray-400 "
                            style={{ maxWidth: "200px" }}
                          >
                            {compareArray?.length}차 TOP{" "}
                            {
                              compareArray[compareArray?.length - 1]
                                ?.comparePlayerLength
                            }
                          </div>
                          <div className="h-full p-2 justify-start items-center flex w-full border first:border-l border-l-0 border-gray-400 gap-2">
                            {compareArray[
                              compareArray?.length - 1
                            ]?.players?.map((top, tIdx) => {
                              const { playerNumber } = top;
                              return (
                                <div className="w-14 h-14 p-2 bg-blue-400 text-gray-100 rounded-lg justify-center items-center flex">
                                  {playerNumber}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex w-full bg-gray-100 rounded-lg py-3 flex-col p-2">
                      <div className="flex w-full h-20 justify-start items-center px-5">
                        <div
                          className="h-full p-2 justify-center items-center flex w-full border first:border-l border-l-0 border-gray-400 "
                          style={{ maxWidth: "200px" }}
                        >
                          현재 TOP {realtimeData?.compares?.playerLength}
                        </div>
                        <div className="h-full p-2 justify-start items-center flex w-full border first:border-l border-l-0 border-gray-400 gap-2">
                          {topResult?.length > 0 &&
                            topResult?.map((top, tIdx) => {
                              const { playerNumber } = top;
                              return (
                                <div className="w-14 h-14 p-2 bg-blue-400 text-gray-100 rounded-lg justify-center items-center flex">
                                  {playerNumber}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                    <div className="flex w-full bg-gray-100 rounded-lg py-3 flex-col text-base font-normal p-2  justify-start">
                      <div className="flex w-full justify-start items-center px-5">
                        <div
                          className="h-full p-2 justify-center items-start flex w-full border first:border-l border-l-0 border-gray-400 "
                          style={{ maxWidth: "10%", minWidth: "200px" }}
                        >
                          심판번호
                        </div>
                        {realtimeData?.judges.map((judge, pIdx) => {
                          const { seatIndex } = judge;
                          return (
                            <div
                              className="h-full p-2 justify-center items-start flex w-full border first:border-l border-l-0 border-gray-400 "
                              style={{ maxWidth: "10%" }}
                            >
                              {seatIndex}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex w-full justify-start items-center px-5">
                        <div
                          className="h-full p-2 justify-center items-start flex w-full border first:border-l border-l-0 border-gray-400 "
                          style={{ maxWidth: "10%", minWidth: "200px" }}
                        >
                          투표상황
                        </div>
                        {realtimeData?.compares?.judges.map((judge, pIdx) => {
                          const { messageStatus } = judge;

                          return (
                            <div
                              className="h-full p-2 justify-center items-start flex w-full border first:border-l border-l-0 border-gray-400 "
                              style={{ maxWidth: "10%" }}
                            >
                              {messageStatus}
                            </div>
                          );
                        })}
                      </div>
                      {votedValidate ? (
                        <div className="flex w-full h-auto px-5 py-2 justify-center items-center ">
                          {votedValidate && (
                            <div className="flex justify-center items-center w-full h-auto px-5 py-2 bg-gray-500 rounded-lg text-gray-100 cursor-not-allowed  text-xl font-semibold">
                              투표중
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex w-full h-auto px-5 py-2">
                          <button
                            className="w-full h-14 px-5 py-2 bg-blue-500 rounded-lg text-gray-100 text-xl font-semibold"
                            onClick={() =>
                              handleUpdateComparePlayers(
                                topResult,
                                votedResult,
                                currentContest.contests.id,
                                currentContest.contests.contestComparesListId
                              )
                            }
                            //  여기에서 finalPlayers를 받아서 topResult에 있는 선수번호 명단만 따로 추리고 나머지 명단을 또 따로 추려서
                            // playoff와 normal로 분기시켜서 autoScore쪽으로 넘겨줘야한다.
                          >
                            선수명단 확정
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default CompareSetting;
