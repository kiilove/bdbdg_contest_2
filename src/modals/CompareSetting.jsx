"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Users,
  Info,
  X,
  RefreshCw,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
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
import { InputNumber } from "antd";
import { BibTag, StatusDot } from "../components/ui/BibTag";

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

  const [, setCompareStatus] = useState({
    compareStart: false,
    compareEnd: false,
    compareCancel: false,
    compareIng: false,
  });

  const [votedResult, setVotedResult] = useState([]);
  const [topResult, setTopResult] = useState([]);
  const [votedValidate, setVotedValidate] = useState(true);

  // 롤백용: 모달 오픈 시점의 compares 스냅샷 + 세션내 시작 여부
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

  // 모달 로드시 Firestore 비교 이력 로드
  const fetchPool = async (gradeId, compareListId) => {
    if (gradeId === undefined || compareListId === undefined) {
      setMessage({
        body: "데이터 로드에 문제가 발생했습니다",
        body2: "다시 시도해 주세요",
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
      setStartedInThisSession(true);
    } catch (error) {
      console.error("Error starting compare mode:", error);
    }
  };

  // 현재 스테이지/체급의 마지막 compare만 제거
  const handleCompareCancel = async (contestId) => {
    const collectionInfoByCompares = `currentStage/${contestId}/compares`;

    const currentStageId = stageInfo?.stageId;
    const currentCategoryId = stageInfo?.categoryId;
    const currentGradeId = stageInfo?.grades?.[0]?.gradeId;

    const all = Array.isArray(compareArray) ? compareArray : [];

    const isCurrentGroup = (c) =>
      c?.stageId === currentStageId &&
      c?.categoryId === currentCategoryId &&
      c?.gradeId === currentGradeId;

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
    const trimmedGroup = currentGroup.filter(
      (c) => Number(c.compareIndex) !== maxIdx
    );

    const newCompares = [...others, ...trimmedGroup];

    try {
      await updateRealtimeCompare.updateData(collectionInfoByCompares, {
        status: {
          compareStart: false,
          compareEnd: false,
          compareCancel: true,
          compareIng: false,
        },
        confirmed: { count: 0, numbers: [] },
        players: [],
        playerLength: 0,
        scoreMode: null,
        judges: (realtimeData?.compares?.judges || []).map((j) => ({
          ...j,
          messageStatus: "확인전",
        })),
      });

      await updateCompare.updateData(compareList.id, {
        ...compareList,
        compares: newCompares,
      });

      setCompareArray(newCompares);
      setCompareList((prev) => ({ ...(prev || {}), compares: newCompares }));

      setCompareStatus({
        compareStart: false,
        compareEnd: false,
        compareCancel: true,
        compareIng: false,
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

  const handleUpdateComparePlayers = async (
    playerTopResult,
    playerVoteResult,
    contestId,
    compareListId
  ) => {
    const primaryGrade = stageInfo?.grades?.[0];
    if (!primaryGrade?.gradeId) {
      setMessage({
        body: "체급 정보를 찾을 수 없어 비교심사 명단을 확정할 수 없습니다",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    const combinedGradeTitle =
      stageInfo?.grades?.length > 1
        ? `${stageInfo.grades
            .map((g) => g?.gradeTitle || "")
            .filter(Boolean)
            .join(" ")} 통합`
        : primaryGrade?.gradeTitle || "";

    const compareInfo = {
      contestId,
      stageId: stageInfo?.stageId || "",
      categoryId: stageInfo?.categoryId || "",
      gradeId: primaryGrade.gradeId,
      categoryTitle: stageInfo?.categoryTitle || "",
      gradeTitle: combinedGradeTitle,
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

      const newCompares = [...compareArray, compareInfo];

      const confirmedNumbers = (playerTopResult || [])
        .map((p) => Number(p.playerNumber))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);

      await updateRealtimeCompare.updateData(collectionInfoCompares, {
        ...realtimeData?.compares,
        status: { ...newStatus },
        players: [...playerTopResult],
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

      setStartedInThisSession(false);

      setRefresh(true);
      setClose(false);
    } catch (error) {
      console.error("Error updating compare players:", error);
    }
  };

  const handleGetTopPlayers = (players, playerLength) => {
    if (!Array.isArray(players) || !playerLength || playerLength <= 0) {
      return [];
    }
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
        message: "재계산할 수 있는 데이터가 없습니다",
      });
      return;
    }

    const newTop = handleGetTopPlayers(votedResult, playerLength);
    setTopResult(newTop);

    const confirmedNumbers = newTop
      .map((p) => Number(p.playerNumber))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

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
      message: "TOP 선발 인원을 다시 계산했습니다",
    });
  };

  // 모달 초기에 compares 스냅샷 1회 저장
  useEffect(() => {
    if (!snapshotTakenRef.current && realtimeData?.compares) {
      snapshotTakenRef.current = true;
      initialComparesRef.current = JSON.parse(
        JSON.stringify(realtimeData.compares)
      );
    }
  }, [realtimeData?.compares]);

  // Firestore 이력/필터
  useEffect(() => {
    const firstGradeId = stageInfo?.grades?.[0]?.gradeId;
    const compareListId = currentContest?.contests?.contestComparesListId;
    if (firstGradeId && compareListId) {
      fetchPool(firstGradeId, compareListId);
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
    if (compareArray?.length > 0) {
      const filterCompares = compareArray.filter(
        (f) =>
          f.categoryId === realtimeData?.categoryId &&
          f.gradeId === realtimeData?.gradeId
      );
      setCurrentCompareArray(filterCompares);
    }
  }, [
    realtimeData?.stageId,
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
    if (votedResult?.length > 0 && realtimeData?.compares?.playerLength) {
      setTopResult(
        handleGetTopPlayers(votedResult, realtimeData.compares.playerLength)
      );
    }
  }, [votedResult, realtimeData?.compares?.playerLength]);

  const maxVotes =
    votedResult.length > 0
      ? Math.max(...votedResult.map((v) => v.votedCount))
      : 0;

  // 닫기 시 롤백 처리
  const handleCloseWithRollback = async () => {
    try {
      const contestId = currentContest?.contests?.id;
      const path = `currentStage/${contestId}/compares`;
      const compares = realtimeData?.compares ?? {};
      const { compareIndex = 0, status = {} } = compares;

      const shouldRollback =
        Boolean(contestId) &&
        startedInThisSession &&
        status.compareStart === true &&
        status.compareIng !== true;

      if (shouldRollback) {
        if (compareIndex > 1 && initialComparesRef.current) {
          await updateRealtimeCompare.updateData(
            path,
            JSON.parse(JSON.stringify(initialComparesRef.current))
          );
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
    } catch (e) {
      console.warn("닫기 롤백 실패:", e?.message);
    } finally {
      setRefresh(true);
      setClose(false);
    }
  };

  const isVotingStarted = Boolean(realtimeData?.compares?.status?.compareStart);

  const optionButtonClass = (active) =>
    `h-9 px-4 rounded-[8px] text-sm font-medium transition-colors cursor-pointer border ${
      active
        ? "bg-[#2563eb] text-white border-[#2563eb]"
        : "bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] border-[#171717]/[0.08]"
    }`;

  return (
    <div className="w-full h-full max-h-screen bg-[#fafafa] text-[#171717] overflow-y-auto p-4 sm:p-6">
      {isLoading ? (
        <LoadingPage />
      ) : (
        <div className="max-w-5xl mx-auto space-y-4">
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

          {/* 상단 헤더 카드 */}
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] flex items-center justify-center shrink-0">
                <Users size={18} strokeWidth={1.5} className="text-[#525252]" />
              </div>
              <div>
                <div className="text-base font-semibold text-[#171717]">
                  {stageInfo?.categoryTitle || ""}
                  {stageInfo?.grades?.length > 0 &&
                    ` (${
                      stageInfo.grades.length > 1
                        ? `${stageInfo.grades
                            .map((g) => g?.gradeTitle || "")
                            .filter(Boolean)
                            .join(" ")} 통합`
                        : stageInfo.grades[0]?.gradeTitle || ""
                    })`}
                </div>
                <div className="text-xs text-[#525252] mt-0.5 font-mono tabular-nums">
                  {propCompareIndex}차 비교심사 설정
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseWithRollback}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#dc2626]/[0.06] border border-[#dc2626]/30 text-[#dc2626] text-xs font-medium transition-colors cursor-pointer self-end sm:self-auto"
            >
              <X size={16} strokeWidth={1.5} />
              <span>취소 및 닫기</span>
            </button>
          </div>

          {/* 옵션 설정 카드 */}
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 space-y-5">
            {propCompareIndex > 1 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-[#525252]">
                  투표 대상 설정
                </div>
                <div className="flex flex-wrap gap-2">
                  {isVotingStarted ? (
                    <span className="inline-flex items-center h-9 px-4 rounded-[8px] bg-[#2563eb]/[0.08] border border-[#2563eb]/30 text-[#2563eb] text-sm font-medium">
                      {votedInfo?.voteRange === "all"
                        ? "해당 체급 전체"
                        : `${propCompareIndex - 1}차 선발 인원만`}
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setVotedInfo((prev) => ({
                            ...prev,
                            voteRange: "all",
                          }))
                        }
                        className={optionButtonClass(
                          votedInfo.voteRange === "all"
                        )}
                      >
                        해당 체급 전체
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setVotedInfo((prev) => ({
                            ...prev,
                            voteRange: "voted",
                          }))
                        }
                        className={optionButtonClass(
                          votedInfo.voteRange === "voted"
                        )}
                      >
                        {propCompareIndex - 1}차 선발 인원만
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-medium text-[#525252]">
                심사 대상 인원수 설정
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isVotingStarted ? (
                  <span className="inline-flex items-center h-9 px-4 rounded-[8px] bg-[#2563eb]/[0.08] border border-[#2563eb]/30 text-[#2563eb] font-mono tabular-nums text-sm font-medium">
                    TOP {votedInfo.playerLength}
                  </span>
                ) : (
                  <>
                    {matchedOriginalPlayers?.length >= 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          setVotedInfo((prev) => ({
                            ...prev,
                            playerLength: 3,
                          }));
                          setIsVotedPlayerLengthInput(false);
                        }}
                        className={optionButtonClass(
                          votedInfo.playerLength === 3 &&
                            !isVotedPlayerLengthInput
                        )}
                      >
                        TOP 3
                      </button>
                    )}
                    {matchedOriginalPlayers?.length >= 5 && (
                      <button
                        type="button"
                        onClick={() => {
                          setVotedInfo((prev) => ({
                            ...prev,
                            playerLength: 5,
                          }));
                          setIsVotedPlayerLengthInput(false);
                        }}
                        className={optionButtonClass(
                          votedInfo.playerLength === 5 &&
                            !isVotedPlayerLengthInput
                        )}
                      >
                        TOP 5
                      </button>
                    )}
                    {matchedOriginalPlayers?.length >= 7 && (
                      <button
                        type="button"
                        onClick={() => {
                          setVotedInfo((prev) => ({
                            ...prev,
                            playerLength: 7,
                          }));
                          setIsVotedPlayerLengthInput(false);
                        }}
                        className={optionButtonClass(
                          votedInfo.playerLength === 7 &&
                            !isVotedPlayerLengthInput
                        )}
                      >
                        TOP 7
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsVotedPlayerLengthInput((prev) => !prev);
                        setVotedInfo((prev) => ({
                          ...prev,
                          playerLength: undefined,
                        }));
                      }}
                      className={optionButtonClass(isVotedPlayerLengthInput)}
                    >
                      직접 입력
                    </button>
                    {isVotedPlayerLengthInput && (
                      <InputNumber
                        min={1}
                        max={matchedOriginalPlayers?.length}
                        placeholder="인원수"
                        onChange={(value) => {
                          setVotedInfo((prev) => ({
                            ...prev,
                            playerLength: Number.parseInt(value, 10),
                          }));
                        }}
                        className="w-24 font-mono tabular-nums"
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-[#525252]">
                채점 모드 설정
              </div>
              <div className="flex flex-wrap gap-2">
                {isVotingStarted ? (
                  <span className="inline-flex items-center h-9 px-4 rounded-[8px] bg-[#2563eb]/[0.08] border border-[#2563eb]/30 text-[#2563eb] text-sm font-medium">
                    {votedInfo.scoreMode === "all" && "전체 채점"}
                    {votedInfo.scoreMode === "topOnly" && "선발 대상자만 채점"}
                    {votedInfo.scoreMode === "topWithSub" &&
                      `${propCompareIndex - 1}차 전체 채점`}
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setVotedInfo((prev) => ({
                          ...prev,
                          scoreMode: "all",
                        }))
                      }
                      className={optionButtonClass(
                        votedInfo.scoreMode === "all"
                      )}
                    >
                      전체
                    </button>
                    {propCompareIndex > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setVotedInfo((prev) => ({
                            ...prev,
                            scoreMode: "topWithSub",
                          }))
                        }
                        className={optionButtonClass(
                          votedInfo.scoreMode === "topWithSub"
                        )}
                      >
                        {propCompareIndex - 1}차 전체
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setVotedInfo((prev) => ({
                          ...prev,
                          scoreMode: "topOnly",
                        }))
                      }
                      className={optionButtonClass(
                        votedInfo.scoreMode === "topOnly"
                      )}
                    >
                      대상자
                    </button>
                  </>
                )}
              </div>

              {!isVotingStarted && votedInfo.scoreMode && (
                <div className="flex items-center gap-2 mt-2 px-3.5 py-2.5 bg-[#f4f4f5] border border-[#171717]/[0.06] rounded-[8px] text-xs text-[#525252]">
                  <Info size={16} strokeWidth={1.5} className="text-[#737373] shrink-0" />
                  <span>
                    {votedInfo.scoreMode === "all" &&
                      "출전 선수 전원 채점을 완료해야 합니다"}
                    {votedInfo.scoreMode === "topOnly" &&
                      "비교심사 선발 대상만 채점하며 나머지 선수는 순위 외 처리됩니다"}
                    {votedInfo.scoreMode === "topWithSub" &&
                      "이전 차수 비교심사 대상 전체를 채점합니다"}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-[#171717]/[0.06]">
              {isVotingStarted ? (
                <div className="inline-flex items-center gap-2 h-10 px-4 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-sm font-medium text-[#525252]">
                  <StatusDot status="active" live />
                  <span>비교심사 투표 진행 중</span>
                </div>
              ) : (
                votedInfo.playerLength !== undefined &&
                votedInfo.scoreMode !== undefined && (
                  <button
                    type="button"
                    onClick={() => handleAdd(currentContest.contests.id)}
                    className="h-10 px-5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium transition-colors active:scale-[0.98] cursor-pointer w-full sm:w-auto"
                  >
                    비교심사 투표 개시
                  </button>
                )
              )}
            </div>
          </div>

          {/* 실시간 득표 및 심판 투표 현황 */}
          {isVotingStarted && (
            <div className="space-y-4">
              {/* 득표 현황 카드 */}
              <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] px-5 py-3 flex items-center gap-2">
                  <BarChart3
                    size={16}
                    strokeWidth={1.5}
                    className="text-[#525252]"
                  />
                  <span className="text-sm font-semibold text-[#171717]">
                    비교심사 득표 현황
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  {!isMobile ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-center">
                        <thead>
                          <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] text-xs font-medium text-[#525252]">
                            <th className="py-2.5 px-3 text-left w-24">
                              선수번호
                            </th>
                            {(matchedOriginalPlayers || []).map(
                              (player, pIdx) => (
                                <th
                                  key={pIdx}
                                  className="py-2.5 px-2 min-w-[64px]"
                                >
                                  <BibTag number={player.playerNumber} />
                                </th>
                              )
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-[#171717]/[0.06]">
                            <td className="py-3 px-3 text-left text-xs font-medium text-[#525252] bg-[#fafafa]">
                              득표수
                            </td>
                            {(matchedOriginalPlayers || []).map(
                              (player, pIdx) => {
                                const votes =
                                  votedResult?.find(
                                    (f) =>
                                      f.playerNumber === player.playerNumber
                                  )?.votedCount || 0;
                                const percentage =
                                  maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                                return (
                                  <td key={pIdx} className="py-3 px-2">
                                    <div className="flex flex-col items-center gap-1.5">
                                      <span className="font-mono tabular-nums text-sm font-semibold text-[#171717]">
                                        {votes}표
                                      </span>
                                      <div className="w-12 h-1.5 rounded-full bg-[#f4f4f5] overflow-hidden">
                                        <div
                                          className="h-full bg-[#2563eb] rounded-full"
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
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
                    <div className="space-y-2">
                      {(matchedOriginalPlayers || []).map((player, pIdx) => {
                        const votes =
                          votedResult?.find(
                            (f) => f.playerNumber === player.playerNumber
                          )?.votedCount || 0;
                        const percentage =
                          maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                        return (
                          <div
                            key={pIdx}
                            className="p-3 rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.08] space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <BibTag number={player.playerNumber} />
                              <span className="font-mono tabular-nums text-sm font-semibold text-[#171717]">
                                {votes}표
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[#f4f4f5] overflow-hidden">
                              <div
                                className="h-full bg-[#2563eb] rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 이전 차수 TOP N */}
                  {currentCompareArray?.length > 0 && (
                    <div className="p-4 rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.08] space-y-2.5">
                      <div className="text-xs font-medium text-[#525252] font-mono tabular-nums">
                        {currentCompareArray.length}차 선발 TOP{" "}
                        {
                          currentCompareArray[currentCompareArray.length - 1]
                            ?.comparePlayerLength
                        }
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentCompareArray[
                          currentCompareArray.length - 1
                        ]?.players?.map((top, tIdx) => (
                          <BibTag
                            key={tIdx}
                            number={top.playerNumber}
                            size="lg"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 현재 TOP N */}
                  <div className="p-4 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#171717] font-mono tabular-nums">
                        현재 선발 대상 TOP {realtimeData?.compares?.playerLength}
                      </span>
                      <button
                        type="button"
                        onClick={handleManualRecalculate}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] bg-white hover:bg-[#fafafa] border border-[#171717]/[0.12] text-xs font-medium text-[#171717] transition-colors cursor-pointer"
                      >
                        <RefreshCw size={14} strokeWidth={1.5} className="text-[#525252]" />
                        <span>재계산</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {topResult?.length > 0 ? (
                        topResult.map((top, tIdx) => (
                          <BibTag
                            key={tIdx}
                            number={top.playerNumber}
                            size="lg"
                            variant="active"
                          />
                        ))
                      ) : (
                        <span className="text-xs text-[#737373]">
                          수신된 투표 결과가 없습니다
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 심판 투표 상황 카드 */}
              <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] px-5 py-3 flex items-center gap-2">
                  <CheckCircle2
                    size={16}
                    strokeWidth={1.5}
                    className="text-[#525252]"
                  />
                  <span className="text-sm font-semibold text-[#171717]">
                    심판석 투표 상태
                  </span>
                </div>

                <div className="p-5 space-y-5">
                  {!isMobile ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-center">
                        <thead>
                          <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] text-xs font-medium text-[#525252]">
                            <th className="py-2.5 px-3 text-left w-24">
                              심판석
                            </th>
                            {(realtimeData?.judges || []).map((judge, pIdx) => (
                              <th key={pIdx} className="py-2.5 px-2">
                                <BibTag number={judge.seatIndex} size="sm" />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-[#171717]/[0.06]">
                            <td className="py-3 px-3 text-left text-xs font-medium text-[#525252] bg-[#fafafa]">
                              상태
                            </td>
                            {(realtimeData?.compares?.judges || []).map(
                              (judge, pIdx) => {
                                const done =
                                  judge.messageStatus === "투표완료";
                                return (
                                  <td key={pIdx} className="py-3 px-2">
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-xs font-medium ${
                                        done
                                          ? "bg-[#16a34a]/[0.08] text-[#16a34a]"
                                          : "bg-[#f4f4f5] text-[#737373]"
                                      }`}
                                    >
                                      <StatusDot
                                        status={done ? "live" : "idle"}
                                      />
                                      <span>{judge.messageStatus}</span>
                                    </span>
                                  </td>
                                );
                              }
                            )}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(realtimeData?.compares?.judges || []).map(
                        (judge, pIdx) => {
                          const done = judge.messageStatus === "투표완료";
                          return (
                            <div
                              key={pIdx}
                              className="flex items-center justify-between px-3.5 py-2.5 rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.08]"
                            >
                              <div className="flex items-center gap-2">
                                <BibTag number={judge.seatIndex} size="sm" />
                                <span className="text-xs font-medium text-[#171717]">
                                  번 심판석
                                </span>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-xs font-medium ${
                                  done
                                    ? "bg-[#16a34a]/[0.08] text-[#16a34a]"
                                    : "bg-[#f4f4f5] text-[#737373]"
                                }`}
                              >
                                <StatusDot status={done ? "live" : "idle"} />
                                <span>{judge.messageStatus}</span>
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-2 pt-2 border-t border-[#171717]/[0.06]">
                    {votedValidate ? (
                      <button
                        type="button"
                        disabled
                        className="h-10 px-6 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#737373] text-sm font-medium cursor-not-allowed w-full sm:w-auto min-w-[200px]"
                      >
                        심판 투표 대기 중
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateComparePlayers(
                            topResult,
                            votedResult,
                            currentContest.contests.id,
                            currentContest.contests.contestComparesListId
                          )
                        }
                        className="h-10 px-6 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium transition-colors active:scale-[0.98] cursor-pointer w-full sm:w-auto min-w-[200px]"
                      >
                        명단 확정
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateComparePlayers(
                          topResult,
                          votedResult,
                          currentContest.contests.id,
                          currentContest.contests.contestComparesListId
                        )
                      }
                      className="text-xs text-[#737373] hover:text-[#171717] py-1 px-2 transition-colors cursor-pointer"
                    >
                      직권 확정
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompareSetting;
