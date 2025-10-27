"use client";

import { useContext, useEffect, useState } from "react";
import LoadingPage from "../pages/LoadingPage";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { Card, Button, Space, Tag, InputNumber, Progress, Badge } from "antd";
import {
  TrophyOutlined,
  InfoCircleOutlined,
  CloseOutlined,
  StopOutlined,
} from "@ant-design/icons";

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
  const [isVotedPlayerLengthInput, setIsVotedPlayerLengthInput] =
    useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  const [votedResult, setVotedResult] = useState([]);
  const [topResult, setTopResult] = useState([]);
  const [votedValidate, setVotedValidate] = useState(true);

  const updateRealtimeCompare = useFirebaseRealtimeUpdateData();

  const fetchCompare = useFirestoreGetDocument("contest_compares_list");
  const updateCompare = useFirestoreUpdateData("contest_compares_list");

  const { currentContest } = useContext(CurrentContestContext);

  const { data: realtimeData } = useFirebaseRealtimeGetDocument(
    currentContest?.contests?.id
      ? `currentStage/${currentContest.contests.id}`
      : null
  );

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchPool = async (gradeId, compareListId) => {
    if (gradeId === undefined || compareListId === undefined) {
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
      const compareData = await fetchCompare.getDocument(compareListId);
      setCompareList({ ...compareData });
      if (compareData?.compares?.length > 0) {
        setCompareArray([...compareData.compares]);
      }
    } catch (error) {
      console.error("Error fetching compare data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompareModeStart = async (contestId, data) => {
    const collectionInfo = `currentStage/${contestId}/compares`;
    try {
      setVotedInfo({});
      await updateRealtimeCompare.updateData(collectionInfo, data);
      setCompareStatus({
        compareStart: true,
        compareEnd: false,
        compareCancel: false,
        compareIng: false,
      });
    } catch (error) {
      console.error("Error starting compare mode:", error);
    }
  };

  const handleCompareCancel = async (contestId) => {
    const collectionInfoByCompares = `currentStage/${contestId}/compares`;
    const newCompareArray = [...compareArray];
    newCompareArray.splice(compareArray.length - 1, 1);

    try {
      await updateRealtimeCompare.updateData(collectionInfoByCompares, {
        status: {
          compareStart: false,
          compareEnd: false,
          compareCancel: true,
          compareIng: false,
        },
        confirmed: { count: 0, numbers: [] },
      });

      setCompareStatus({
        compareStart: false,
        compareEnd: false,
        compareCancel: true,
        compareIng: false,
      });

      await updateCompare.updateData(compareList.id, {
        ...compareList,
        compares: [...newCompareArray],
      });

      setCompareList({
        ...compareList,
        compares: [...newCompareArray],
      });
      setCompareArray([...newCompareArray]);

      setRefresh(true);
      setClose(false);
    } catch (error) {
      console.error("Error cancelling compare:", error);
    }
  };

  const handleAdd = async (contestId) => {
    setTopResult([]);
    const newCompareMode = {
      compareStart: true,
      compareEnd: false,
      compareCancel: false,
      compareIng: false,
    };

    const judgeMessageInfo = realtimeData?.judges.map((judge) => {
      const { seatIndex } = judge;
      return { seatIndex, messageStatus: "확인전" };
    });

    const realtimeCompareInfo = {
      compareIndex: propCompareIndex,
      status: { ...newCompareMode },
      playerLength: votedInfo.playerLength,
      scoreMode: votedInfo.scoreMode,
      voteRange: votedInfo.voteRange,
      judges: [...judgeMessageInfo],
    };

    try {
      await handleCompareModeStart(contestId, realtimeCompareInfo);
    } catch (error) {
      console.error("Error adding compare:", error);
    }
  };

  const getConfirmedNumbersSorted = (players) => {
    if (!Array.isArray(players)) return [];
    return players
      .map((p) => Number(p.playerNumber))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b); // 번호 오름차순
  };

  const handleUpdateComparePlayers = async (
    playerTopResult,
    playerVoteResult,
    contestId,
    compareListId
  ) => {
    // 확정 정보(이력용)
    const compareInfo = {
      contestId,
      stageId: stageInfo.stageId,
      categoryId: stageInfo.categoryId,
      gradeId: stageInfo.grades[0].gradeId,
      categoryTitle: stageInfo.categoryTitle,
      gradeTitle: stageInfo.grades[0].gradeTitle,
      compareIndex: propCompareIndex,
      comparePlayerLength: Number.parseInt(votedInfo.playerLength, 10),
      compareScoreMode: votedInfo.scoreMode, // "all" | "topOnly" | "topWithSub"
      players: [...playerTopResult], // 확정된 선수 객체 리스트
      votedResult: [...playerVoteResult], // 득표 상세 (옵션)
    };

    try {
      const collectionInfoCompares = `currentStage/${contestId}/compares`;

      // 진행 상태(확정 완료 후, 진행중으로 전환)
      const newStatus = {
        compareStart: false,
        compareEnd: false,
        compareCancel: false,
        compareIng: true,
      };

      // Firestore 이력 append
      const newCompares = [...compareArray, compareInfo];

      // ✅ 확정된 "선수 번호만" 오름차순으로 추출
      const confirmedNumbers = (playerTopResult || [])
        .map((p) => Number(p.playerNumber))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);

      // 1) Realtime DB 업데이트 (상태 + 확정 번호만 저장)
      await updateRealtimeCompare.updateData(collectionInfoCompares, {
        ...realtimeData?.compares,
        status: { ...newStatus },
        // 호환성을 위해 기존 players 필드는 유지 (필요 없으면 제거 가능)
        players: [...playerTopResult],
        confirmed: {
          count: confirmedNumbers.length,
          numbers: confirmedNumbers, // ← 번호만, 오름차순
        },
      });

      // 2) Firestore(compare 이력) 업데이트
      await updateCompare.updateData(compareListId, {
        ...compareList,
        compares: [...newCompares],
      });

      // 3) 로컬 상태 동기화
      setCompareArray(newCompares);
      setCompareList((prev) => ({ ...(prev || {}), compares: newCompares }));

      // 4) 상위 리프레시 및 모달 닫기
      setRefresh(true);
      setClose(false);
    } catch (error) {
      console.error("Error updating compare players:", error);
    }
  };

  const handleGetTopPlayers = (players, playerLength) => {
    if (!players || players.length === 0) {
      return [];
    }

    const sortedPlayers = players.sort((a, b) => b.votedCount - a.votedCount);

    const topPlayers = sortedPlayers.slice(0, playerLength);

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

    const result = Object.values(voteCounts);
    return result;
  };

  useEffect(() => {
    if (
      stageInfo.grades[0].gradeId &&
      currentContest.contests.contestComparesListId
    ) {
      fetchPool(
        stageInfo.grades[0].gradeId,
        currentContest.contests.contestComparesListId
      );
    }
  }, [stageInfo.grades, currentContest.contests.contestComparesListId]);

  useEffect(() => {
    if (realtimeData?.compares?.status?.compareStart) {
      setVotedInfo({
        playerLength: realtimeData.compares.playerLength,
        scoreMode: realtimeData.compares.scoreMode,
        voteRange: realtimeData.compares.voteRange,
      });
    }
  }, [realtimeData?.compares]);

  useEffect(() => {
    if (realtimeData?.compares?.judges?.length > 0) {
      setVotedResult(handleCountPlayerVotes(realtimeData.compares.judges));
      const validatedMessages = realtimeData.compares.judges.some(
        (s) => s.messageStatus !== "투표완료"
      );
      setVotedValidate(validatedMessages);
    }
  }, [realtimeData?.compares?.judges]);

  useEffect(() => {
    if (votedResult?.length > 0) {
      setTopResult(
        handleGetTopPlayers(votedResult, realtimeData.compares.playerLength)
      );
    }
  }, [votedResult, realtimeData?.compares?.playerLength]);

  const maxVotes =
    votedResult.length > 0
      ? Math.max(...votedResult.map((v) => v.votedCount))
      : 0;

  return (
    <>
      <div className="flex w-full h-full flex-col bg-white justify-start items-center p-5 gap-y-2 overflow-y-auto">
        {isLoading && <LoadingPage />}
        {!isLoading && (
          <>
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

            <Card className="w-full mb-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-lg"
                    style={{
                      width: "48px",
                      height: "48px",
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    }}
                  >
                    <TrophyOutlined className="text-white text-2xl" />
                  </div>
                  <div className="flex flex-col">
                    <div className="text-xl font-bold text-gray-800">
                      {stageInfo?.categoryTitle}(
                      {stageInfo?.grades[0]?.gradeTitle})
                    </div>
                    <div className="text-base text-gray-600">
                      {propCompareIndex}차 비교심사 설정
                    </div>
                  </div>
                </div>
                <Space>
                  <Button
                    danger
                    icon={<StopOutlined />}
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
                  </Button>
                  <Button
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setRefresh(true);
                      setClose(false);
                    }}
                  >
                    닫기
                  </Button>
                </Space>
              </div>
            </Card>

            <Card className="w-full mb-4">
              <Space direction="vertical" size="large" className="w-full">
                {/* 투표대상 설정 */}
                {propCompareIndex > 1 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-base font-semibold text-gray-700">
                      투표대상 설정
                    </div>
                    <Space wrap>
                      {realtimeData?.compares?.status?.compareStart ? (
                        <Button
                          disabled
                          style={
                            votedInfo?.voteRange === "all"
                              ? {
                                  backgroundColor: "#1890ff",
                                  borderColor: "#1890ff",
                                  color: "white",
                                  opacity: 0.7,
                                }
                              : {}
                          }
                          className="min-w-[120px]"
                        >
                          {votedInfo?.voteRange === "all"
                            ? "해당체급 전체"
                            : `${propCompareIndex - 1}차 선발인원만`}
                        </Button>
                      ) : (
                        <>
                          <Button
                            type={
                              votedInfo.voteRange === "all"
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo(() => ({
                                ...votedInfo,
                                voteRange: "all",
                              }));
                            }}
                            className="min-w-[120px]"
                          >
                            해당체급 전체
                          </Button>
                          <Button
                            type={
                              votedInfo.voteRange === "voted"
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo(() => ({
                                ...votedInfo,
                                voteRange: "voted",
                              }));
                            }}
                            className="min-w-[120px]"
                          >
                            {propCompareIndex - 1}차 선발인원만
                          </Button>
                        </>
                      )}
                    </Space>
                  </div>
                )}

                {/* 심사대상 인원수 설정 */}
                <div className="flex flex-col gap-2">
                  <div className="text-base font-semibold text-gray-700">
                    심사대상 인원수 설정
                  </div>
                  <Space wrap>
                    {realtimeData?.compares?.status?.compareStart ? (
                      <Button
                        disabled
                        style={{
                          backgroundColor: "#1890ff",
                          borderColor: "#1890ff",
                          color: "white",
                          opacity: 0.7,
                        }}
                        className="min-w-[120px]"
                      >
                        TOP {votedInfo.playerLength}
                      </Button>
                    ) : (
                      <>
                        {matchedOriginalPlayers?.length >= 3 && (
                          <Button
                            type={
                              votedInfo.playerLength === 3
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo(() => ({
                                ...votedInfo,
                                playerLength: 3,
                              }));
                              setIsVotedPlayerLengthInput(false);
                            }}
                            className="min-w-[120px]"
                          >
                            TOP 3
                          </Button>
                        )}
                        {matchedOriginalPlayers?.length >= 5 && (
                          <Button
                            type={
                              votedInfo.playerLength === 5
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo(() => ({
                                ...votedInfo,
                                playerLength: 5,
                              }));
                              setIsVotedPlayerLengthInput(false);
                            }}
                            className="min-w-[120px]"
                          >
                            TOP 5
                          </Button>
                        )}
                        {matchedOriginalPlayers?.length >= 7 && (
                          <Button
                            type={
                              votedInfo.playerLength === 7
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo(() => ({
                                ...votedInfo,
                                playerLength: 7,
                              }));
                              setIsVotedPlayerLengthInput(false);
                            }}
                            className="min-w-[120px]"
                          >
                            TOP 7
                          </Button>
                        )}
                        <Button
                          type={
                            isVotedPlayerLengthInput ? "primary" : "default"
                          }
                          onClick={() => {
                            setIsVotedPlayerLengthInput(
                              () => !isVotedPlayerLengthInput
                            );
                            setVotedInfo(() => ({
                              ...votedInfo,
                              playerLength: undefined,
                            }));
                          }}
                          className="min-w-[120px]"
                        >
                          직접입력
                        </Button>
                        {isVotedPlayerLengthInput && (
                          <InputNumber
                            min={1}
                            max={matchedOriginalPlayers?.length}
                            placeholder="인원수"
                            onChange={(value) => {
                              setVotedInfo(() => ({
                                ...votedInfo,
                                playerLength: Number.parseInt(value),
                              }));
                            }}
                            className="w-24"
                          />
                        )}
                      </>
                    )}
                  </Space>
                </div>

                {/* 채점모드 설정 */}
                <div className="flex flex-col gap-2">
                  <div className="text-base font-semibold text-gray-700">
                    채점모드 설정
                  </div>
                  <Space wrap>
                    {realtimeData?.compares?.status?.compareStart ? (
                      <Button
                        disabled
                        style={{
                          backgroundColor: "#1890ff",
                          borderColor: "#1890ff",
                          color: "white",
                          opacity: 0.7,
                        }}
                        className="min-w-[120px]"
                      >
                        {votedInfo.scoreMode === "all" && "전체"}
                        {votedInfo.scoreMode === "topOnly" && "대상자"}
                        {votedInfo.scoreMode === "topWithSub" &&
                          `${propCompareIndex - 1}차 전체`}
                      </Button>
                    ) : (
                      <>
                        <Button
                          type={
                            votedInfo.scoreMode === "all"
                              ? "primary"
                              : "default"
                          }
                          onClick={() => {
                            setVotedInfo(() => ({
                              ...votedInfo,
                              scoreMode: "all",
                            }));
                          }}
                          className="min-w-[120px]"
                        >
                          전체
                        </Button>
                        {propCompareIndex > 1 && (
                          <Button
                            type={
                              votedInfo.scoreMode === "topWithSub"
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo(() => ({
                                ...votedInfo,
                                scoreMode: "topWithSub",
                              }));
                            }}
                            className="min-w-[120px]"
                          >
                            {propCompareIndex - 1}차 전체
                          </Button>
                        )}
                        <Button
                          type={
                            votedInfo.scoreMode === "topOnly"
                              ? "primary"
                              : "default"
                          }
                          onClick={() => {
                            setVotedInfo(() => ({
                              ...votedInfo,
                              scoreMode: "topOnly",
                            }));
                          }}
                          className="min-w-[120px]"
                        >
                          대상자
                        </Button>
                      </>
                    )}
                  </Space>
                  {!realtimeData?.compares?.status?.compareStart && (
                    <div className="flex items-center gap-2 mt-2 p-3 bg-blue-50 rounded-lg">
                      <InfoCircleOutlined className="text-blue-600" />
                      <span className="text-sm text-gray-700">
                        {votedInfo.scoreMode === "all" &&
                          "출전선수 전원 채점을 완료해야합니다."}
                        {votedInfo.scoreMode === "topOnly" &&
                          "비교심사 대상만 채점합니다. 나머지 선수는 순위외 처리됩니다."}
                        {votedInfo.scoreMode === "topWithSub" &&
                          "이전 차수 비교심사 대상 전체를 채점합니다."}
                      </span>
                    </div>
                  )}
                </div>

                {/* 비교심사 투표개시 버튼 */}
                <div className="flex justify-center pt-4">
                  {realtimeData?.compares?.status?.compareStart ? (
                    <Button
                      size="large"
                      disabled
                      className="w-full md:w-auto min-w-[200px]"
                    >
                      비교심사 투표중
                    </Button>
                  ) : (
                    votedInfo.playerLength !== undefined &&
                    votedInfo.scoreMode !== undefined && (
                      <Button
                        type="primary"
                        size="large"
                        onClick={() => handleAdd(currentContest.contests.id)}
                        className="w-full md:w-auto min-w-[200px]"
                      >
                        비교심사 투표개시
                      </Button>
                    )
                  )}
                </div>
              </Space>
            </Card>

            {realtimeData?.compares?.status?.compareStart && (
              <div className="flex w-full h-auto flex-col gap-y-4">
                {/* 득표 현황 */}
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center justify-center rounded-lg"
                        style={{
                          width: "32px",
                          height: "32px",
                          background:
                            "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                        }}
                      >
                        <TrophyOutlined className="text-white" />
                      </div>
                      <span>비교심사 득표 및 투표현황</span>
                    </div>
                  }
                >
                  {!isMobile ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 p-3 text-left font-semibold">
                              선수번호
                            </th>
                            {matchedOriginalPlayers.map((player, pIdx) => (
                              <th
                                key={pIdx}
                                className="border border-gray-300 p-3 text-center font-semibold"
                              >
                                <Tag color="blue" className="text-base">
                                  {player.playerNumber}
                                </Tag>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 p-3 font-semibold bg-gray-50">
                              득표수
                            </td>
                            {matchedOriginalPlayers.map((player, pIdx) => {
                              const votes =
                                votedResult?.find(
                                  (f) => f.playerNumber === player.playerNumber
                                )?.votedCount || 0;
                              const percentage =
                                maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                              return (
                                <td
                                  key={pIdx}
                                  className="border border-gray-300 p-3 text-center"
                                >
                                  <div className="flex flex-col gap-2">
                                    <span className="text-lg font-bold">
                                      {votes}표
                                    </span>
                                    <Progress
                                      percent={percentage}
                                      showInfo={false}
                                      strokeColor="#1890ff"
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Space
                      direction="vertical"
                      size="middle"
                      className="w-full"
                    >
                      {matchedOriginalPlayers.map((player, pIdx) => {
                        const votes =
                          votedResult?.find(
                            (f) => f.playerNumber === player.playerNumber
                          )?.votedCount || 0;
                        const percentage =
                          maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                        return (
                          <Card key={pIdx} size="small">
                            <div className="flex justify-between items-center mb-2">
                              <Tag color="blue" className="text-base">
                                선수 {player.playerNumber}
                              </Tag>
                              <span className="text-lg font-bold">
                                {votes}표
                              </span>
                            </div>
                            <Progress
                              percent={percentage}
                              strokeColor="#1890ff"
                            />
                          </Card>
                        );
                      })}
                    </Space>
                  )}

                  {/* 이전 차수 TOP N */}
                  {compareArray?.length > 0 && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <div className="text-base font-semibold mb-3 text-gray-700">
                        {compareArray?.length}차 TOP{" "}
                        {
                          compareArray[compareArray?.length - 1]
                            ?.comparePlayerLength
                        }
                      </div>
                      <Space wrap>
                        {compareArray[compareArray?.length - 1]?.players?.map(
                          (top, tIdx) => (
                            <Badge
                              key={tIdx}
                              count={top.playerNumber}
                              overflowCount={9999}
                              style={{
                                backgroundColor: "#1890ff",
                                fontSize: "16px",
                                width: "auto",
                                minWidth: "48px",
                                height: "48px",
                                padding: "0 12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            />
                          )
                        )}
                      </Space>
                    </div>
                  )}

                  {/* 현재 TOP N */}
                  <div className="mt-4 p-4 bg-green-50 rounded-lg">
                    <div className="text-base font-semibold mb-3 text-gray-700">
                      현재 TOP {realtimeData?.compares?.playerLength}
                    </div>
                    <Space wrap>
                      {topResult?.length > 0 &&
                        topResult?.map((top, tIdx) => (
                          <Badge
                            key={tIdx}
                            count={top.playerNumber}
                            overflowCount={9999}
                            style={{
                              backgroundColor: "#52c41a",
                              fontSize: "16px",
                              width: "auto",
                              minWidth: "48px",
                              height: "48px",
                              padding: "0 12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          />
                        ))}
                    </Space>
                  </div>
                </Card>

                {/* 심판 투표 상황 */}
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center justify-center rounded-lg"
                        style={{
                          width: "32px",
                          height: "32px",
                          background:
                            "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                        }}
                      >
                        <InfoCircleOutlined className="text-white" />
                      </div>
                      <span>심판 투표 상황</span>
                    </div>
                  }
                >
                  {!isMobile ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 p-3 text-left font-semibold">
                              심판번호
                            </th>
                            {realtimeData?.judges.map((judge, pIdx) => (
                              <th
                                key={pIdx}
                                className="border border-gray-300 p-3 text-center font-semibold"
                              >
                                {judge.seatIndex}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 p-3 font-semibold bg-gray-50">
                              투표상황
                            </td>
                            {realtimeData?.compares?.judges.map(
                              (judge, pIdx) => (
                                <td
                                  key={pIdx}
                                  className="border border-gray-300 p-3 text-center"
                                >
                                  <Tag
                                    color={
                                      judge.messageStatus === "투표완료"
                                        ? "success"
                                        : "default"
                                    }
                                  >
                                    {judge.messageStatus}
                                  </Tag>
                                </td>
                              )
                            )}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Space
                      direction="vertical"
                      size="middle"
                      className="w-full"
                    >
                      {realtimeData?.compares?.judges.map((judge, pIdx) => (
                        <Card key={pIdx} size="small">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold">
                              심판 {judge.seatIndex}
                            </span>
                            <Tag
                              color={
                                judge.messageStatus === "투표완료"
                                  ? "success"
                                  : "default"
                              }
                            >
                              {judge.messageStatus}
                            </Tag>
                          </div>
                        </Card>
                      ))}
                    </Space>
                  )}

                  <div className="flex justify-center mt-6">
                    <Space
                      direction="vertical"
                      size="small"
                      className="w-full items-center"
                    >
                      {/* 메인 버튼: 투표중 또는 명단확정 */}
                      {votedValidate ? (
                        <Button
                          size="large"
                          disabled
                          className="w-full md:w-auto min-w-[200px]"
                        >
                          투표중
                        </Button>
                      ) : (
                        <Button
                          type="primary"
                          size="large"
                          onClick={() =>
                            handleUpdateComparePlayers(
                              topResult,
                              votedResult,
                              currentContest.contests.id,
                              currentContest.contests.contestComparesListId
                            )
                          }
                          className="w-full md:w-auto min-w-[200px]"
                        >
                          명단확정
                        </Button>
                      )}

                      {/* 서브 버튼: 직권확정 (항상 표시, 눈에 띄지 않게) */}
                      <Button
                        type="link"
                        size="small"
                        onClick={() =>
                          handleUpdateComparePlayers(
                            topResult,
                            votedResult,
                            currentContest.contests.id,
                            currentContest.contests.contestComparesListId
                          )
                        }
                        className="text-gray-400 hover:text-gray-600"
                      >
                        직권확정
                      </Button>
                    </Space>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default CompareSetting;
