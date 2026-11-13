"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
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
import {
  removeStageCompareByLocalIndex,
  buildRealtimeCompareAfterCancel,
} from "../utils/compareVoteUtils";
import { Card, Button, Space, Tag, InputNumber, Progress, Badge } from "antd";
import {
  TrophyOutlined,
  InfoCircleOutlined,
  CloseOutlined,
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
  const [currentCompareArray, setCurrentCompareArray] = useState([]);
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
  void compareStatus;

  const [votedResult, setVotedResult] = useState([]);
  const [topResult, setTopResult] = useState([]);
  const [votedValidate, setVotedValidate] = useState(true);

  // 롤백용: 오픈 시점의 compares 스냅샷 + 세션내 시작 여부
  const initialComparesRef = useRef(null);
  const snapshotTakenRef = useRef(false);
  const [startedInThisSession, setStartedInThisSession] = useState(false);

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

  // 로드시 Firestore 비교 이력 로드 (main 원본 로직 유지)
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
      // 이 세션에서 시작함 표시
      setStartedInThisSession(true);
    } catch (error) {
      console.error("Error starting compare mode:", error);
    }
  };

  // 현재 스테이지/체급의 마지막 compare만 제거 (다른 무대 이력 100% 보존)
  const handleCompareCancel = async (contestId) => {
    const collectionInfoByCompares = `currentStage/${contestId}/compares`;

    const currentStageId = stageInfo?.stageId || realtimeData?.stageId;
    const currentCategoryId = stageInfo?.categoryId;
    const currentGradeId = stageInfo?.grades?.[0]?.gradeId;

    const all = Array.isArray(compareList?.compares)
      ? compareList.compares
      : Array.isArray(compareArray)
      ? compareArray
      : [];

    let newCompares = [];
    let remainingStageCompares = [];

    if (currentStageId && all.some((c) => c?.stageId === currentStageId)) {
      const stageItems = all.filter((c) => c?.stageId === currentStageId);
      if (stageItems.length === 0) {
        setRefresh(true);
        setClose(false);
        return;
      }
      const removed = removeStageCompareByLocalIndex(
        all,
        currentStageId,
        stageItems.length - 1
      );
      newCompares = removed.nextAllCompares;
      remainingStageCompares = removed.nextStageCompares;
    } else {
      const isCurrentGroup = (c) =>
        c?.stageId === currentStageId ||
        (c?.categoryId === currentCategoryId && c?.gradeId === currentGradeId);

      const currentGroup = all.filter(isCurrentGroup);
      const others = all.filter((c) => !isCurrentGroup(c));

      if (currentGroup.length === 0) {
        setRefresh(true);
        setClose(false);
        return;
      }

      const maxIdx = Math.max(
        ...currentGroup.map((c) => Number(c.compareIndex || 0))
      );
      remainingStageCompares = currentGroup.filter(
        (c) => Number(c.compareIndex) !== maxIdx
      );
      newCompares = [...others, ...remainingStageCompares];
    }

    const nextRealtimePayload = buildRealtimeCompareAfterCancel(
      remainingStageCompares
    );

    try {
      // 1) 실시간 DB 상태 리셋 / 직전 차수 복원
      await updateRealtimeCompare.updateData(collectionInfoByCompares, {
        ...nextRealtimePayload,
        judges: (realtimeData?.compares?.judges || []).map((j) => ({
          ...j,
          messageStatus: "확인전",
        })),
      });

      // 2) Firestore(compare 이력) 업데이트
      if (compareList?.id) {
        await updateCompare.updateData(compareList.id, {
          ...compareList,
          compares: newCompares,
        });
      }

      // 3) 로컬 상태 동기화
      setCompareArray(newCompares);
      setCompareList((prev) => ({ ...(prev || {}), compares: newCompares }));

      setCompareStatus({
        ...nextRealtimePayload.status,
        compareCancel: true,
      });

      setStartedInThisSession(false);

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

    const judgeMessageInfo = (realtimeData?.judges || []).map((judge) => {
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

  const stageGradeLabel =
    Array.isArray(stageInfo?.grades) && stageInfo.grades.length > 1
      ? `${stageInfo.grades
          .map((g) => g?.gradeTitle)
          .filter(Boolean)
          .join(" ")} 통합`
      : stageInfo?.grades?.[0]?.gradeTitle || "";

  const handleUpdateComparePlayers = async (
    playerTopResult,
    playerVoteResult,
    contestId,
    compareListId
  ) => {
    const compareInfo = {
      contestId,
      stageId: stageInfo?.stageId,
      categoryId: stageInfo?.categoryId,
      gradeId: stageInfo?.grades?.[0]?.gradeId,
      categoryTitle: stageInfo?.categoryTitle,
      gradeTitle: stageGradeLabel,
      compareIndex: propCompareIndex,
      comparePlayerLength: Number.parseInt(votedInfo.playerLength, 10),
      compareScoreMode: votedInfo.scoreMode,
      players: [...(playerTopResult || [])],
      votedResult: [...(playerVoteResult || [])],
    };

    try {
      const collectionInfoCompares = `currentStage/${contestId}/compares`;

      const newStatus = {
        compareStart: false,
        compareEnd: false,
        compareCancel: false,
        compareIng: true,
      };

      const baseAllCompares = Array.isArray(compareList?.compares)
        ? compareList.compares
        : compareArray;
      const newCompares = [...baseAllCompares, compareInfo];

      const confirmedNumbers = (playerTopResult || [])
        .map((p) => Number(p.playerNumber))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);

      await updateRealtimeCompare.updateData(collectionInfoCompares, {
        ...realtimeData?.compares,
        status: { ...newStatus },
        players: [...(playerTopResult || [])],
        confirmed: {
          count: confirmedNumbers.length,
          numbers: confirmedNumbers,
        },
      });

      await updateCompare.updateData(compareListId, {
        ...compareList,
        compares: [...newCompares],
      });

      setCompareArray(newCompares);
      setCompareList((prev) => ({ ...(prev || {}), compares: newCompares }));

      // 명단확정까지 완료했으므로 롤백 대상 아님
      setStartedInThisSession(false);

      setRefresh(true);
      setClose(false);
    } catch (error) {
      console.error("Error updating compare players:", error);
    }
  };

  const handleGetTopPlayers = (players, playerLength) => {
    console.log(players, playerLength);
    if (!Array.isArray(players)) return [];
    const validPlayers = players.filter((p) => p?.votedCount !== undefined);
    if (validPlayers.length === 0) return [];

    const sortedPlayers = [...validPlayers].sort(
      (a, b) => b.votedCount - a.votedCount
    );
    const topPlayers = sortedPlayers.slice(0, playerLength);
    if (topPlayers.length === 0) return [];

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
    return Object.values(voteCounts);
  };

  const handleManualRecalculate = async () => {
    const playerLength = Number(realtimeData?.compares?.playerLength || 0);

    if (!playerLength || votedResult.length === 0) {
      window.postMessage({
        type: "TOAST",
        message: "재계산할 수 있는 데이터가 없습니다.",
      });
      return;
    }

    const newTop = handleGetTopPlayers(votedResult, playerLength);
    console.log(newTop);
    setTopResult(newTop);

    const confirmedNumbers = newTop
      .map((p) => Number(p.playerNumber))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    // Realtime DB에 TOP N까지 저장해서 UI가 최신 데이터로 렌더링되도록 (main 원본 유지)
    await updateRealtimeCompare.updateData(
      `currentStage/${currentContest.contests.id}/compares`,
      {
        ...realtimeData?.compares,
        players: [...newTop],
        confirmed: {
          count: confirmedNumbers.length,
          numbers: confirmedNumbers,
        },
        status: {
          ...realtimeData?.compares?.status,
          compareStart: true,
        },
      }
    );

    window.postMessage({
      type: "TOAST",
      message: "TOP 인원을 다시 계산했습니다",
    });
  };

  // 초기에 compares 스냅샷 1회 저장
  useEffect(() => {
    if (!snapshotTakenRef.current && realtimeData?.compares) {
      snapshotTakenRef.current = true;
      initialComparesRef.current = JSON.parse(
        JSON.stringify(realtimeData.compares)
      );
    }
  }, [realtimeData?.compares]);

  // Firestore 이력/필터 (main 원본 유지)
  useEffect(() => {
    if (
      stageInfo?.grades?.[0]?.gradeId &&
      currentContest?.contests?.contestComparesListId
    ) {
      fetchPool(
        stageInfo.grades[0].gradeId,
        currentContest.contests.contestComparesListId
      );
    } else if (stageInfo && currentContest?.contests) {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageInfo?.grades, currentContest?.contests?.contestComparesListId]);

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
    const all = Array.isArray(compareList?.compares)
      ? compareList.compares
      : compareArray;
    if (all?.length > 0) {
      const targetStageId = stageInfo?.stageId || realtimeData?.stageId;
      const filterCompares = all.filter((f) =>
        targetStageId
          ? f.stageId === targetStageId
          : f.categoryId === realtimeData?.categoryId &&
            f.gradeId === realtimeData?.gradeId
      );
      setCurrentCompareArray(filterCompares);
    } else {
      setCurrentCompareArray([]);
    }
  }, [
    stageInfo?.stageId,
    realtimeData?.stageId,
    compareList,
    compareArray,
    realtimeData?.categoryId,
    realtimeData?.gradeId,
  ]);

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
        handleGetTopPlayers(votedResult, realtimeData?.compares?.playerLength)
      );
    }
  }, [votedResult, realtimeData?.compares?.playerLength]);

  const maxVotes =
    votedResult.length > 0
      ? Math.max(...votedResult.map((v) => v.votedCount))
      : 0;

  // 닫기 시 롤백 처리 (main 원본 유지)
  const handleCloseWithRollback = async () => {
    try {
      const path = `currentStage/${currentContest?.contests?.id}/compares`;
      const compares = realtimeData?.compares ?? {};
      const { compareIndex = 0, status = {} } = compares;

      const shouldRollback =
        startedInThisSession &&
        status.compareStart === true &&
        status.compareIng !== true;

      if (shouldRollback) {
        if (compareIndex > 1 && initialComparesRef.current) {
          // 2차 이상 → 스냅샷으로 롤백
          await updateRealtimeCompare.updateData(
            path,
            JSON.parse(JSON.stringify(initialComparesRef.current))
          );
        } else {
          // compareIndex === 1 → 완전 초기화
          if (typeof updateRealtimeCompare.setData === "function") {
            await updateRealtimeCompare.setData(path, {
              status: {
                compareStart: false,
                compareIng: false,
                compareEnd: false,
                compareCancel: false,
              },
            });
          } else {
            await updateRealtimeCompare.updateData(path, {
              compareIndex: 0,
              playerLength: 0,
              scoreMode: null,
              voteRange: null,
              players: [],
              confirmed: { count: 0, numbers: [] },
              judges: [],
              status: {
                compareStart: false,
                compareIng: false,
                compareEnd: false,
                compareCancel: false,
              },
            });
          }
        }
      }
    } catch (e) {
      console.warn("닫기 롤백 실패:", e?.message);
    } finally {
      setRefresh(true);
      setClose(false);
    }
  };

  return (
    <div className="flex w-full h-full flex-col bg-[#fafafa] overflow-y-auto">
      {/* 드로어 상단 고정 헤더 */}
      <div className="sticky top-0 z-20 bg-white text-[#171717] px-5 py-4 border-b border-[#e4e4e7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-[#eff6ff] border border-[#bfdbfe] shrink-0">
            <TrophyOutlined className="text-[#2563eb] text-lg" />
          </div>
          <div className="flex flex-col">
            <div className="text-lg sm:text-xl font-bold text-[#171717] leading-tight">
              {stageInfo?.categoryTitle}({stageGradeLabel})
            </div>
            <div className="text-sm font-semibold text-[#2563eb] mt-0.5">
              {propCompareIndex}차 비교심사 설정
            </div>
          </div>
        </div>
        <Space>
          <Button
            danger
            size="large"
            icon={<CloseOutlined />}
            onClick={handleCloseWithRollback}
            className="font-semibold"
          >
            취소(오류시 재비교심사설정)
          </Button>
        </Space>
      </div>

      {/* 드로어 본문 */}
      <div className="flex-1 p-4 sm:p-5 space-y-4">
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

            <Card className="w-full border border-[#cbd5e1] shadow-xs">
              <Space direction="vertical" size="large" className="w-full">
                {/* 투표대상 설정 */}
                {propCompareIndex > 1 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-base font-bold text-[#0f172a]">
                      투표대상 설정
                    </div>
                    <Space wrap>
                      {realtimeData?.compares?.status?.compareStart ? (
                        <Button
                          size="large"
                          disabled
                          style={
                            votedInfo?.voteRange === "all"
                              ? {
                                  backgroundColor: "#1890ff",
                                  borderColor: "#1890ff",
                                  color: "white",
                                  opacity: 0.85,
                                }
                              : {}
                          }
                          className="min-w-[130px] font-bold"
                        >
                          {votedInfo?.voteRange === "all"
                            ? "해당체급 전체"
                            : `${propCompareIndex - 1}차 선발인원만`}
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="large"
                            type={
                              votedInfo.voteRange === "all"
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                voteRange: "all",
                              }));
                            }}
                            className="min-w-[130px] font-semibold"
                          >
                            해당체급 전체
                          </Button>
                          <Button
                            size="large"
                            type={
                              votedInfo.voteRange === "voted"
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                voteRange: "voted",
                              }));
                            }}
                            className="min-w-[130px] font-semibold"
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
                  <div className="text-base font-bold text-[#0f172a]">
                    심사대상 인원수 설정
                  </div>
                  <Space wrap>
                    {realtimeData?.compares?.status?.compareStart ? (
                      <Button
                        size="large"
                        disabled
                        style={{
                          backgroundColor: "#1890ff",
                          borderColor: "#1890ff",
                          color: "white",
                          opacity: 0.85,
                        }}
                        className="min-w-[120px] font-bold"
                      >
                        TOP {votedInfo.playerLength}
                      </Button>
                    ) : (
                      <>
                        {matchedOriginalPlayers?.length >= 3 && (
                          <Button
                            size="large"
                            type={
                              votedInfo.playerLength === 3
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                playerLength: 3,
                              }));
                              setIsVotedPlayerLengthInput(false);
                            }}
                            className="min-w-[120px] font-semibold"
                          >
                            TOP 3
                          </Button>
                        )}
                        {matchedOriginalPlayers?.length >= 5 && (
                          <Button
                            size="large"
                            type={
                              votedInfo.playerLength === 5
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                playerLength: 5,
                              }));
                              setIsVotedPlayerLengthInput(false);
                            }}
                            className="min-w-[120px] font-semibold"
                          >
                            TOP 5
                          </Button>
                        )}
                        {matchedOriginalPlayers?.length >= 7 && (
                          <Button
                            size="large"
                            type={
                              votedInfo.playerLength === 7
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                playerLength: 7,
                              }));
                              setIsVotedPlayerLengthInput(false);
                            }}
                            className="min-w-[120px] font-semibold"
                          >
                            TOP 7
                          </Button>
                        )}
                        <Button
                          size="large"
                          type={
                            isVotedPlayerLengthInput ? "primary" : "default"
                          }
                          onClick={() => {
                            setIsVotedPlayerLengthInput((prev) => !prev);
                            setVotedInfo((prev) => ({
                              ...prev,
                              playerLength: undefined,
                            }));
                          }}
                          className="min-w-[120px] font-semibold"
                        >
                          직접입력
                        </Button>
                        {isVotedPlayerLengthInput && (
                          <InputNumber
                            size="large"
                            min={1}
                            max={matchedOriginalPlayers?.length}
                            placeholder="인원수"
                            onChange={(value) => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                playerLength: Number.parseInt(value),
                              }));
                            }}
                            className="w-28"
                          />
                        )}
                      </>
                    )}
                  </Space>
                </div>

                {/* 채점모드 설정 */}
                <div className="flex flex-col gap-2">
                  <div className="text-base font-bold text-[#0f172a]">
                    채점모드 설정
                  </div>
                  <Space wrap>
                    {realtimeData?.compares?.status?.compareStart ? (
                      <Button
                        size="large"
                        disabled
                        style={{
                          backgroundColor: "#1890ff",
                          borderColor: "#1890ff",
                          color: "white",
                          opacity: 0.85,
                        }}
                        className="min-w-[120px] font-bold"
                      >
                        {votedInfo.scoreMode === "all" && "전체"}
                        {votedInfo.scoreMode === "topOnly" && "대상자"}
                        {votedInfo.scoreMode === "topWithSub" &&
                          `${propCompareIndex - 1}차 전체`}
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="large"
                          type={
                            votedInfo.scoreMode === "all"
                              ? "primary"
                              : "default"
                          }
                          onClick={() => {
                            setVotedInfo((prev) => ({
                              ...prev,
                              scoreMode: "all",
                            }));
                          }}
                          className="min-w-[120px] font-semibold"
                        >
                          전체
                        </Button>
                        {propCompareIndex > 1 && (
                          <Button
                            size="large"
                            type={
                              votedInfo.scoreMode === "topWithSub"
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                scoreMode: "topWithSub",
                              }));
                            }}
                            className="min-w-[120px] font-semibold"
                          >
                            {propCompareIndex - 1}차 전체
                          </Button>
                        )}
                        <Button
                          size="large"
                          type={
                            votedInfo.scoreMode === "topOnly"
                              ? "primary"
                              : "default"
                          }
                          onClick={() => {
                            setVotedInfo((prev) => ({
                              ...prev,
                              scoreMode: "topOnly",
                            }));
                          }}
                          className="min-w-[120px] font-semibold"
                        >
                          대상자
                        </Button>
                      </>
                    )}
                  </Space>
                  {!realtimeData?.compares?.status?.compareStart &&
                    Boolean(votedInfo.scoreMode) && (
                      <div className="flex items-center gap-2 mt-2 p-3 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg">
                        <InfoCircleOutlined className="text-[#2563eb]" />
                        <span className="text-sm font-semibold text-[#1e3a8a]">
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
                <div className="flex justify-center pt-2">
                  {realtimeData?.compares?.status?.compareStart ? (
                    <Button
                      size="large"
                      disabled
                      className="w-full md:w-auto min-w-[220px] h-12 font-bold text-base"
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
                        className="w-full md:w-auto min-w-[220px] h-12 font-bold text-base"
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
                  className="border border-[#cbd5e1] shadow-xs"
                  title={
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#eff6ff] border border-[#bfdbfe]">
                        <TrophyOutlined className="text-[#2563eb]" />
                      </div>
                      <span className="font-bold text-base text-[#171717]">
                        비교심사 득표 및 투표현황
                      </span>
                    </div>
                  }
                >
                  {!isMobile ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-[#f1f5f9]">
                            <th className="border border-gray-300 p-3 text-left font-bold">
                              선수번호
                            </th>
                            {(matchedOriginalPlayers || []).map(
                              (player, pIdx) => (
                                <th
                                  key={
                                    player.playerUid ||
                                    `${player.contestGradeId || ""}-${player.playerNumber}-${pIdx}`
                                  }
                                  className="border border-gray-300 p-3 text-center font-bold"
                                >
                                  <Tag
                                    color="blue"
                                    className="text-base font-bold px-2.5 py-0.5 m-0"
                                  >
                                    {player.playerNumber}
                                  </Tag>
                                </th>
                              )
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 p-3 font-bold bg-[#f8fafc]">
                              득표수
                            </td>
                            {(matchedOriginalPlayers || []).map(
                              (player, pIdx) => {
                                const votes =
                                  votedResult
                                    ?.filter((f) =>
                                      player.playerUid && f.playerUid
                                        ? f.playerUid === player.playerUid &&
                                          String(f.playerNumber) ===
                                            String(player.playerNumber)
                                        : String(f.playerNumber) ===
                                          String(player.playerNumber)
                                    )
                                    .reduce(
                                      (sum, item) =>
                                        sum + (item.votedCount || 0),
                                      0
                                    ) || 0;
                                const percentage =
                                  maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                                return (
                                  <td
                                    key={
                                      player.playerUid ||
                                      `${player.contestGradeId || ""}-${player.playerNumber}-${pIdx}`
                                    }
                                    className="border border-gray-300 p-3 text-center"
                                  >
                                    <div className="flex flex-col gap-2">
                                      <span className="text-lg font-extrabold text-[#0f172a]">
                                        {votes}표
                                      </span>
                                      <Progress
                                        percent={percentage}
                                        showInfo={false}
                                        strokeColor="#2563eb"
                                      />
                                    </div>
                                  </td>
                                );
                              }
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
                      {(matchedOriginalPlayers || []).map((player, pIdx) => {
                        const votes =
                          votedResult
                            ?.filter((f) =>
                              player.playerUid && f.playerUid
                                ? f.playerUid === player.playerUid &&
                                  String(f.playerNumber) ===
                                    String(player.playerNumber)
                                : String(f.playerNumber) ===
                                  String(player.playerNumber)
                            )
                            .reduce(
                              (sum, item) => sum + (item.votedCount || 0),
                              0
                            ) || 0;
                        const percentage =
                          maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                        return (
                          <Card
                            key={
                              player.playerUid ||
                              `${player.contestGradeId || ""}-${player.playerNumber}-${pIdx}`
                            }
                            size="small"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <Tag color="blue" className="text-base font-bold">
                                선수 {player.playerNumber}
                              </Tag>
                              <span className="text-lg font-bold">
                                {votes}표
                              </span>
                            </div>
                            <Progress
                              percent={percentage}
                              strokeColor="#2563eb"
                            />
                          </Card>
                        );
                      })}
                    </Space>
                  )}

                  {/* 이전 차수 TOP N */}
                  {currentCompareArray?.length > 0 && (
                    <div className="mt-6 p-4 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg">
                      <div className="text-base font-bold mb-3 text-[#1e3a8a]">
                        {currentCompareArray?.length}차 TOP{" "}
                        {
                          currentCompareArray[currentCompareArray?.length - 1]
                            ?.comparePlayerLength
                        }
                      </div>
                      <Space wrap>
                        {currentCompareArray[
                          currentCompareArray?.length - 1
                        ]?.players?.map((top, tIdx) => (
                          <Badge
                            key={tIdx}
                            count={top.playerNumber}
                            overflowCount={9999}
                            style={{
                              backgroundColor: "#2563eb",
                              fontSize: "18px",
                              fontWeight: 800,
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
                  )}

                  {/* 현재 TOP N */}
                  <div className="mt-4 p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-base font-bold text-[#14532d]">
                        현재 TOP {realtimeData?.compares?.playerLength}
                      </span>
                      <Space>
                        <Button
                          type="default"
                          onClick={handleManualRecalculate}
                          className="font-semibold"
                        >
                          재계산
                        </Button>
                      </Space>
                    </div>

                    <Space wrap>
                      {topResult?.length > 0 &&
                        topResult?.map((top, tIdx) => (
                          <Badge
                            key={tIdx}
                            count={top.playerNumber}
                            overflowCount={9999}
                            style={{
                              backgroundColor: "#16a34a",
                              fontSize: "18px",
                              fontWeight: 800,
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
                  className="border border-[#cbd5e1] shadow-xs"
                  title={
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#eff6ff] border border-[#bfdbfe]">
                        <InfoCircleOutlined className="text-[#2563eb]" />
                      </div>
                      <span className="font-bold text-base text-[#171717]">
                        심판 투표 상황
                      </span>
                    </div>
                  }
                >
                  {!isMobile ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-[#f1f5f9]">
                            <th className="border border-gray-300 p-3 text-left font-bold">
                              심판번호
                            </th>
                            {(realtimeData?.judges || []).map((judge, pIdx) => (
                              <th
                                key={pIdx}
                                className="border border-gray-300 p-3 text-center font-bold"
                              >
                                {judge.seatIndex}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 p-3 font-bold bg-[#f8fafc]">
                              투표상황
                            </td>
                            {(realtimeData?.compares?.judges || []).map(
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
                                    className="font-bold m-0"
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
                      {(realtimeData?.compares?.judges || []).map(
                        (judge, pIdx) => (
                          <Card key={pIdx} size="small">
                            <div className="flex justify-between items-center">
                              <span className="font-bold">
                                심판 {judge.seatIndex}
                              </span>
                              <Tag
                                color={
                                  judge.messageStatus === "투표완료"
                                    ? "success"
                                    : "default"
                                }
                                className="font-bold m-0"
                              >
                                {judge.messageStatus}
                              </Tag>
                            </div>
                          </Card>
                        )
                      )}
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
                          className="w-full md:w-auto min-w-[220px] h-12 font-bold text-base"
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
                          className="w-full md:w-auto min-w-[220px] h-12 font-bold text-base"
                        >
                          명단확정
                        </Button>
                      )}

                      {/* 서브 버튼: 직권확정 */}
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
                        className="text-gray-500 hover:text-gray-800 font-medium"
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
    </div>
  );
};

export default CompareSetting;
