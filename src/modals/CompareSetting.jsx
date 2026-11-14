"use client";

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
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
  getComparePlayerKey,
  buildAuthorityComparePlayers,
} from "../utils/compareVoteUtils";
import { normalizeDenseRealtimeJudges } from "../utils/judgeAssignUtils";
import { extractRtdbPlayerArray } from "../utils/liveStageSnapshotUtils";
import { getStagePlayerSortIndex } from "../functions/functions";
import { Card, Button, Space, Tag, InputNumber, Progress, Badge } from "antd";
import {
  TrophyOutlined,
  InfoCircleOutlined,
  CloseOutlined,
  SafetyCertificateOutlined,
  CheckCircleFilled,
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

  // 심판위원장 직권확정 전용 상태 (기존 투표 플로우와 독립·상호 호환)
  const [authoritySelectedKeys, setAuthoritySelectedKeys] = useState([]);
  const [authorityTouched, setAuthorityTouched] = useState(false);
  const [authorityScoreMode, setAuthorityScoreMode] = useState(undefined);
  const [authorityConfirmOpen, setAuthorityConfirmOpen] = useState(false);
  const [warnModalOpen, setWarnModalOpen] = useState(false);
  const [warnMessage, setWarnMessage] = useState({});
  const [isConfirmSubmitting, setIsConfirmSubmitting] = useState(false);
  const authorityCardRef = useRef(null);

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

  // 현재 스테이지/체급의 마지막 compare만 제거 (다른 무대 이력 100% 보존 + 미확정 투표중 취소 대응)
  const handleCompareCancel = async (contestId) => {
    const collectionInfoByCompares = `currentStage/${contestId}/compares`;

    const currentStageId = stageInfo?.stageId || realtimeData?.stageId;
    const currentCategoryId = stageInfo?.categoryId;
    const currentGradeId = stageInfo?.grades?.[0]?.gradeId;

    const wasCompareIng = Boolean(realtimeData?.compares?.status?.compareIng);
    const isVotingUnconfirmed = Boolean(
      realtimeData?.compares?.status?.compareStart && !wasCompareIng
    );

    const all = Array.isArray(compareList?.compares)
      ? compareList.compares
      : Array.isArray(compareArray)
      ? compareArray
      : [];

    let newCompares = [...all];
    let remainingStageCompares = [];

    const isCurrentGroup = (c) =>
      (currentStageId && c?.stageId === currentStageId) ||
      (!c?.stageId &&
        c?.categoryId === currentCategoryId &&
        c?.gradeId === currentGradeId);

    if (isVotingUnconfirmed) {
      // 아직 명단 확정 전(투표 진행 중) 취소: Firestore 직전 차수 이력은 그대로 보존하고 RTDB 투표 상태만 회수
      remainingStageCompares = all.filter(isCurrentGroup);
      newCompares = [...all];
    } else if (currentStageId && all.some((c) => c?.stageId === currentStageId)) {
      const stageItems = all.filter((c) => c?.stageId === currentStageId);
      if (stageItems.length > 0) {
        const removed = removeStageCompareByLocalIndex(
          all,
          currentStageId,
          stageItems.length - 1
        );
        newCompares = removed.nextAllCompares;
        remainingStageCompares = removed.nextStageCompares;
      }
    } else {
      const currentGroup = all.filter(isCurrentGroup);
      const others = all.filter((c) => !isCurrentGroup(c));

      if (currentGroup.length > 0) {
        const maxIdx = Math.max(
          ...currentGroup.map((c) => Number(c.compareIndex || 0))
        );
        remainingStageCompares = currentGroup.filter(
          (c) => Number(c.compareIndex) !== maxIdx
        );
        newCompares = [...others, ...remainingStageCompares];
      }
    }

    const nextRealtimePayload = buildRealtimeCompareAfterCancel(
      remainingStageCompares
    );

    try {
      // 1) 실시간 DB 상태 리셋 / 직전 차수 복원 (취소 시그널 명시)
      await updateRealtimeCompare.updateData(collectionInfoByCompares, {
        ...nextRealtimePayload,
        status: {
          ...nextRealtimePayload.status,
          compareCancel: true,
        },
        canceledAt: Date.now(),
        judges: extractRtdbPlayerArray(realtimeData?.compares?.judges).map(
          (j) => ({
            ...j,
            messageStatus: "확인전",
          })
        ),
      });

      // 1-2) 이미 확정된 비교심사 채점 도중 취소한 경우, 먼저 제출한 심판석(isEnd: true) 잠금을 즉시 해제
      const denseStageJudges = normalizeDenseRealtimeJudges(
        realtimeData?.judges,
        realtimeData?.stageJudgeCount
      );
      if (wasCompareIng && denseStageJudges.length > 0) {
        const unlockedJudges = denseStageJudges.map((j, idx) => ({
          ...j,
          seatIndex: j?.seatIndex ?? idx + 1,
          isEnd: false,
          errors: "",
        }));
        await updateRealtimeCompare.updateData(`currentStage/${contestId}`, {
          judges: unlockedJudges,
        });
      }

      // 2) 확정 이력 변경 시에만 Firestore(compare 이력) 업데이트
      if (!isVotingUnconfirmed && compareList?.id) {
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

    const judgeMessageInfo = normalizeDenseRealtimeJudges(
      realtimeData?.judges,
      realtimeData?.stageJudgeCount
    ).map((judge, idx) => {
      const seatIndex = judge?.seatIndex ?? idx + 1;
      return { seatIndex, messageStatus: "확인전" };
    });

    const realtimeCompareInfo = {
      compareIndex: propCompareIndex,
      status: { ...newCompareMode },
      playerLength: votedInfo.playerLength,
      scoreMode: votedInfo.scoreMode,
      voteRange: votedInfo.voteRange,
      prevPlayers: Number(propCompareIndex) > 1 ? [...prevRoundPlayers] : [],
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
    compareListId,
    options = {}
  ) => {
    if (isConfirmSubmitting) return;

    const isAuthority = Boolean(options.isAuthority);
    const resolvedScoreMode =
      options.scoreMode ||
      votedInfo.scoreMode ||
      realtimeData?.compares?.scoreMode;

    const sanitizedPlayers = (Array.isArray(playerTopResult)
      ? playerTopResult
      : []
    )
      .filter(
        (p) => p && p.playerNumber !== undefined && p.playerNumber !== null
      )
      .map((p) => {
        const entry = {
          playerNumber: p.playerNumber,
          playerUid: p.playerUid || "",
          votedCount: Number(p.votedCount || 0),
        };
        if (p.playerName) entry.playerName = String(p.playerName);
        if (p.playerGym) entry.playerGym = String(p.playerGym);
        return entry;
      });

    if (sanitizedPlayers.length === 0) {
      setWarnMessage({
        variant: "warning",
        title: "확정 대상 선수 미선택",
        body: "비교심사 대상 선수가 선택되지 않았습니다.",
        body2: isAuthority
          ? "심판위원장 직권확정 카드에서 호명할 선수번호를 1명 이상 선택해 주세요."
          : "심판 득표 집계 결과가 없거나 대상 선수가 비어 있습니다. 직권확정에서 선수번호를 직접 선택할 수 있습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setWarnModalOpen(true);
      return;
    }

    if (!resolvedScoreMode) {
      setWarnMessage({
        variant: "warning",
        title: "채점모드 선택 필요",
        body: "채점모드(대상자 / 전체)가 선택되지 않았습니다.",
        body2: "채점모드를 먼저 선택한 뒤 확정을 진행해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setWarnModalOpen(true);
      return;
    }

    const parsedVotedLen = Number.parseInt(
      votedInfo.playerLength ?? realtimeData?.compares?.playerLength,
      10
    );
    const resolvedPlayerLength = isAuthority
      ? sanitizedPlayers.length
      : Number.isFinite(parsedVotedLen) && parsedVotedLen > 0
      ? parsedVotedLen
      : sanitizedPlayers.length;

    const compareInfo = {
      contestId,
      stageId: stageInfo?.stageId || realtimeData?.stageId || "",
      categoryId: stageInfo?.categoryId || realtimeData?.categoryId || "",
      gradeId:
        stageInfo?.grades?.[0]?.gradeId || realtimeData?.gradeId || "",
      categoryTitle:
        stageInfo?.categoryTitle || realtimeData?.categoryTitle || "",
      gradeTitle: stageGradeLabel,
      compareIndex: propCompareIndex,
      comparePlayerLength: resolvedPlayerLength,
      compareScoreMode: resolvedScoreMode,
      confirmedBy: isAuthority ? "head_authority" : "judge_vote",
      players: sanitizedPlayers,
      votedResult: [...(playerVoteResult || [])],
    };

    setIsConfirmSubmitting(true);
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
      const targetStageIdForPrev =
        stageInfo?.stageId || realtimeData?.stageId || "";
      const prevStageCompares = baseAllCompares.filter((c) =>
        targetStageIdForPrev ? c?.stageId === targetStageIdForPrev : true
      );
      const prevRoundPlayers =
        prevStageCompares.length > 0 &&
        Array.isArray(prevStageCompares[prevStageCompares.length - 1]?.players)
          ? [...prevStageCompares[prevStageCompares.length - 1].players]
          : [];
      const newCompares = [...baseAllCompares, compareInfo];

      const confirmedNumbers = sanitizedPlayers
        .map((p) => Number(p.playerNumber))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);

      await updateRealtimeCompare.updateData(collectionInfoCompares, {
        ...(realtimeData?.compares || {}),
        stageId: stageInfo?.stageId || realtimeData?.stageId || "",
        compareIndex: propCompareIndex,
        playerLength: resolvedPlayerLength,
        scoreMode: resolvedScoreMode,
        voteRange:
          votedInfo?.voteRange || realtimeData?.compares?.voteRange || "all",
        confirmedBy: isAuthority ? "head_authority" : "judge_vote",
        tieBreakGradeId: null,
        tieBreakGradeTitle: null,
        tieBreakStartRank: null,
        tieBreakEndRank: null,
        lockedPlayers: [],
        status: { ...newStatus, isTieBreak: false },
        players: sanitizedPlayers,
        prevPlayers: prevRoundPlayers,
        confirmed: {
          count: confirmedNumbers.length,
          numbers: confirmedNumbers,
        },
      });

      // 비교심사 확정 시 기존 채점 종료(isEnd: true) 좌석을 재채점 가능 상태(isEnd: false)로 동기화
      const denseStageJudges = normalizeDenseRealtimeJudges(
        realtimeData?.judges,
        realtimeData?.stageJudgeCount
      );
      if (denseStageJudges.length > 0) {
        const resetJudges = denseStageJudges.map((j, idx) => ({
          ...j,
          seatIndex: j?.seatIndex ?? idx + 1,
          isEnd: false,
          errors: "",
        }));
        await updateRealtimeCompare.updateData(`currentStage/${contestId}`, {
          judges: resetJudges,
        });
      }

      if (compareListId) {
        await updateCompare.updateData(compareListId, {
          ...compareList,
          compares: [...newCompares],
        });
      }

      setCompareArray(newCompares);
      setCompareList((prev) => ({ ...(prev || {}), compares: newCompares }));

      // 명단확정까지 완료했으므로 롤백 대상 아님
      setStartedInThisSession(false);
      setAuthorityConfirmOpen(false);

      setRefresh(true);
      setClose(false);
    } catch (error) {
      console.error("Error updating compare players:", error);
    } finally {
      setIsConfirmSubmitting(false);
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
            const safeUid = vote?.playerUid || "";
            const key = `${vote.playerNumber}-${safeUid}`;
            if (!voteCounts[key]) {
              voteCounts[key] = {
                playerNumber: vote.playerNumber,
                playerUid: safeUid,
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
        prevPlayers:
          realtimeData?.compares?.prevPlayers ||
          (Number(realtimeData?.compares?.compareIndex) > 1
            ? [...prevRoundPlayers]
            : []),
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
    const compareJudgesList = extractRtdbPlayerArray(
      realtimeData?.compares?.judges
    );
    if (compareJudgesList.length > 0) {
      setVotedResult(handleCountPlayerVotes(compareJudgesList));
      const validatedMessages = compareJudgesList.some(
        (s) => s?.messageStatus !== "투표완료"
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

  // 출전 선수 오름차순 목록 및 직전 차수 선발 명단 (직권확정용)
  const sortedStagePlayers = useMemo(() => {
    const list = Array.isArray(matchedOriginalPlayers)
      ? [...matchedOriginalPlayers]
      : [];
    return list.sort(
      (a, b) =>
        getStagePlayerSortIndex(a, stageInfo) -
          getStagePlayerSortIndex(b, stageInfo) ||
        Number(a?.playerNumber || 0) - Number(b?.playerNumber || 0)
    );
  }, [matchedOriginalPlayers, stageInfo]);

  const prevRoundPlayers = useMemo(() => {
    if (!Array.isArray(currentCompareArray) || currentCompareArray.length === 0) {
      return [];
    }
    const lastRound = currentCompareArray[currentCompareArray.length - 1];
    return Array.isArray(lastRound?.players) ? lastRound.players : [];
  }, [currentCompareArray]);

  const prevRoundNumberSet = useMemo(
    () =>
      new Set(
        prevRoundPlayers
          .map((p) =>
            p?.playerNumber !== undefined && p?.playerNumber !== null
              ? String(p.playerNumber)
              : ""
          )
          .filter(Boolean)
      ),
    [prevRoundPlayers]
  );

  // 상단 채점모드 설정과 직권확정 채점모드 동기화
  useEffect(() => {
    const syncedMode =
      realtimeData?.compares?.status?.compareStart
        ? realtimeData?.compares?.scoreMode || votedInfo.scoreMode
        : votedInfo.scoreMode;
    if (syncedMode) {
      setAuthorityScoreMode(syncedMode);
    }
  }, [
    votedInfo.scoreMode,
    realtimeData?.compares?.status?.compareStart,
    realtimeData?.compares?.scoreMode,
  ]);

  // 투표 진행 중 득표 집계(topResult)가 갱신되면 수동 조작 전에는 자동으로 직권 후보에 반영
  useEffect(() => {
    if (
      realtimeData?.compares?.status?.compareStart &&
      !authorityTouched &&
      Array.isArray(topResult) &&
      topResult.length > 0
    ) {
      const matchedKeys = sortedStagePlayers
        .filter((stagePlayer) =>
          topResult.some((top) =>
            stagePlayer?.playerUid && top?.playerUid
              ? top.playerUid === stagePlayer.playerUid &&
                String(top.playerNumber) === String(stagePlayer.playerNumber)
              : String(top?.playerNumber) === String(stagePlayer?.playerNumber)
          )
        )
        .map((p) => getComparePlayerKey(p))
        .filter(Boolean);
      setAuthoritySelectedKeys(matchedKeys);
    }
  }, [
    realtimeData?.compares?.status?.compareStart,
    authorityTouched,
    topResult,
    sortedStagePlayers,
  ]);

  const effectiveAuthorityScoreMode =
    authorityScoreMode ||
    votedInfo.scoreMode ||
    realtimeData?.compares?.scoreMode;

  const authoritySelectedPlayers = useMemo(
    () =>
      buildAuthorityComparePlayers(
        sortedStagePlayers,
        authoritySelectedKeys,
        votedResult
      ),
    [sortedStagePlayers, authoritySelectedKeys, votedResult]
  );

  const authoritySelectedKeySet = useMemo(
    () => new Set(authoritySelectedKeys),
    [authoritySelectedKeys]
  );

  const getScoreModeLabel = (mode) => {
    if (mode === "all") return "전체 (출전선수 전원 채점)";
    if (mode === "topOnly") return "대상자 (비교심사 대상자만 채점)";
    if (mode === "topWithSub")
      return `${propCompareIndex - 1}차 전체 (이전 차수 대상 전체 채점)`;
    return "미선택";
  };

  const handleToggleAuthorityPlayer = (player) => {
    const key = getComparePlayerKey(player);
    if (!key) return;
    setAuthorityTouched(true);
    setAuthoritySelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleLoadCurrentTopToAuthority = () => {
    const matchedKeys = sortedStagePlayers
      .filter((stagePlayer) =>
        (topResult || []).some((top) =>
          stagePlayer?.playerUid && top?.playerUid
            ? top.playerUid === stagePlayer.playerUid &&
              String(top.playerNumber) === String(stagePlayer.playerNumber)
            : String(top?.playerNumber) === String(stagePlayer?.playerNumber)
        )
      )
      .map((p) => getComparePlayerKey(p))
      .filter(Boolean);
    setAuthorityTouched(true);
    setAuthoritySelectedKeys(matchedKeys);
  };

  const handleLoadPrevRoundToAuthority = () => {
    const matchedKeys = sortedStagePlayers
      .filter((stagePlayer) =>
        prevRoundNumberSet.has(String(stagePlayer?.playerNumber))
      )
      .map((p) => getComparePlayerKey(p))
      .filter(Boolean);
    setAuthorityTouched(true);
    setAuthoritySelectedKeys(matchedKeys);
  };

  const handleClearAuthorityPlayers = () => {
    setAuthorityTouched(true);
    setAuthoritySelectedKeys([]);
  };

  const handleSelectAuthorityScoreMode = (mode) => {
    setAuthorityScoreMode(mode);
    if (!realtimeData?.compares?.status?.compareStart) {
      setVotedInfo((prev) => ({
        ...prev,
        scoreMode: mode,
      }));
    }
  };

  const handleRequestAuthorityConfirm = () => {
    if (authoritySelectedPlayers.length === 0) {
      authorityCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setWarnMessage({
        variant: "warning",
        title: "직권 선발 선수 선택 필요",
        body: "심판위원장 직권으로 호명할 선수번호를 먼저 선택해 주세요.",
        body2:
          "심판위원장 직권확정 영역(또는 득표표의 선수번호)을 클릭해 대상 선수를 지정할 수 있습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setWarnModalOpen(true);
      return;
    }

    if (!effectiveAuthorityScoreMode) {
      authorityCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setWarnMessage({
        variant: "warning",
        title: "채점모드 선택 필요",
        body: "직권확정에 적용할 채점모드(대상자 / 전체)를 선택해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setWarnModalOpen(true);
      return;
    }

    setAuthorityConfirmOpen(true);
  };

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

  const renderAuthorityCard = () => {
    const isVoteRunning = Boolean(realtimeData?.compares?.status?.compareStart);
    const targetLenHint = Number(
      votedInfo?.playerLength || realtimeData?.compares?.playerLength || 0
    );
    const selectedNumbersText = authoritySelectedPlayers
      .map((p) => `${p.playerNumber}번`)
      .join(", ");

    return (
      <div ref={authorityCardRef} className="w-full">
        <Card
          className="w-full border border-[#f59e0b]/60 bg-white shadow-xs"
          title={
            <div className="flex flex-wrap items-center justify-between gap-2 py-0.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fffbeb] border border-[#fde68a]">
                  <SafetyCertificateOutlined className="text-[#d97706] text-base" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-[#171717]">
                      심판위원장 직권확정
                    </span>
                    <Tag color="gold" className="m-0 font-bold">
                      위원장 권한
                    </Tag>
                  </div>
                </div>
              </div>
              <span className="text-xs sm:text-sm font-bold text-[#b45309] bg-[#fffbeb] border border-[#fde68a] px-2.5 py-1 rounded-md tabular-nums">
                직권 선택 {authoritySelectedPlayers.length}명
                {targetLenHint > 0 ? ` (참고 TOP ${targetLenHint})` : ""}
              </span>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="text-xs sm:text-sm text-[#525252] bg-[#fafafa] border border-[#e4e4e7] rounded-lg px-3.5 py-2.5 leading-relaxed">
              {isVoteRunning
                ? "심판 투표 미완료(0표 포함) 또는 동점자 발생 시에도 심판위원장 직권으로 호명 선수를 직접 선택·조정하여 즉시 명단을 확정할 수 있습니다."
                : "심판 태블릿 투표를 거치지 않고 심판위원장 직권으로 비교심사 대상 선수를 직접 지명하여 즉시 확정할 수 있습니다."}
            </div>

            {/* 1. 직권확정 채점모드 확인/선택 */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#0f172a]">
                  직권확정 적용 채점모드
                </span>
                {effectiveAuthorityScoreMode && (
                  <span className="text-xs font-semibold text-[#2563eb]">
                    선택됨: {getScoreModeLabel(effectiveAuthorityScoreMode)}
                  </span>
                )}
              </div>
              <Space wrap>
                <Button
                  size="middle"
                  type={
                    effectiveAuthorityScoreMode === "all"
                      ? "primary"
                      : "default"
                  }
                  onClick={() => handleSelectAuthorityScoreMode("all")}
                  className="min-w-[105px] font-semibold"
                >
                  전체
                </Button>
                {propCompareIndex > 1 && (
                  <Button
                    size="middle"
                    type={
                      effectiveAuthorityScoreMode === "topWithSub"
                        ? "primary"
                        : "default"
                    }
                    onClick={() => handleSelectAuthorityScoreMode("topWithSub")}
                    className="min-w-[105px] font-semibold"
                  >
                    {propCompareIndex - 1}차 전체
                  </Button>
                )}
                <Button
                  size="middle"
                  type={
                    effectiveAuthorityScoreMode === "topOnly"
                      ? "primary"
                      : "default"
                  }
                  onClick={() => handleSelectAuthorityScoreMode("topOnly")}
                  className="min-w-[105px] font-semibold"
                >
                  대상자
                </Button>
              </Space>
            </div>

            {/* 2. 직권 선발 선수 번호 원터치 선택 */}
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#0f172a]">
                  호명 대상 선수 직접 선택 (번호 터치)
                </span>
                <Space size="small" wrap>
                  {topResult?.length > 0 && (
                    <Button
                      size="small"
                      onClick={handleLoadCurrentTopToAuthority}
                      className="font-semibold"
                    >
                      현재 TOP ({topResult.length}명) 불러오기
                    </Button>
                  )}
                  {propCompareIndex > 1 && prevRoundPlayers.length > 0 && (
                    <Button
                      size="small"
                      onClick={handleLoadPrevRoundToAuthority}
                      className="font-semibold"
                    >
                      {propCompareIndex - 1}차 명단 ({prevRoundPlayers.length}명)
                      불러오기
                    </Button>
                  )}
                  {authoritySelectedKeys.length > 0 && (
                    <Button
                      size="small"
                      danger
                      onClick={handleClearAuthorityPlayers}
                      className="font-semibold"
                    >
                      선택 초기화
                    </Button>
                  )}
                </Space>
              </div>

              {sortedStagePlayers.length === 0 ? (
                <div className="text-sm text-[#737373] py-3 px-3.5 rounded-lg bg-[#fafafa] border border-[#e4e4e7]">
                  현재 무대의 출전 선수 명단을 불러오는 중이거나 등록된 선수가 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {sortedStagePlayers.map((player, idx) => {
                    const pKey = getComparePlayerKey(player);
                    const isSelected = authoritySelectedKeySet.has(pKey);
                    const isPrevTop =
                      propCompareIndex > 1 &&
                      prevRoundNumberSet.has(String(player.playerNumber));
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
                        .reduce((sum, item) => sum + (item.votedCount || 0), 0) ||
                      0;

                    return (
                      <button
                        key={pKey || idx}
                        type="button"
                        onClick={() => handleToggleAuthorityPlayer(player)}
                        className={`relative flex flex-col items-center justify-center rounded-[10px] px-2.5 py-2.5 border transition-all cursor-pointer select-none ${
                          isSelected
                            ? "bg-[#fffbeb] border-2 border-[#d97706] text-[#92400e] shadow-xs"
                            : "bg-white hover:bg-[#f8fafc] border-[#cbd5e1] text-[#0f172a]"
                        }`}
                      >
                        {isSelected && (
                          <CheckCircleFilled className="absolute top-1.5 right-1.5 text-[#d97706] text-sm" />
                        )}
                        {isPrevTop && !isSelected && (
                          <span className="absolute top-1 left-1.5 text-[10px] font-bold text-[#2563eb]">
                            {propCompareIndex - 1}차
                          </span>
                        )}
                        <span className="text-lg font-extrabold font-mono tabular-nums leading-tight">
                          {player.playerNumber}번
                        </span>
                        {player.playerName && (
                          <span className="text-[11px] font-medium text-[#525252] truncate max-w-full mt-0.5">
                            {player.playerName}
                          </span>
                        )}
                        {isVoteRunning && (
                          <span
                            className={`mt-1 px-1.5 py-0.2 rounded text-[11px] font-bold tabular-nums ${
                              votes > 0
                                ? "bg-[#eff6ff] text-[#1d4ed8]"
                                : "bg-[#f1f5f9] text-[#64748b]"
                            }`}
                          >
                            {votes}표
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. 선택 요약 및 직권확정 실행 버튼 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#e4e4e7]">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-[#64748b]">
                  직권 확정 예정 명단
                </span>
                {authoritySelectedPlayers.length > 0 ? (
                  <span className="text-sm sm:text-base font-extrabold text-[#171717] tabular-nums">
                    {selectedNumbersText} (총 {authoritySelectedPlayers.length}명)
                  </span>
                ) : (
                  <span className="text-sm font-medium text-[#94a3b8]">
                    위 번호 버튼을 눌러 직권 선발할 선수를 선택해 주세요
                  </span>
                )}
              </div>

              <Button
                type="primary"
                size="large"
                disabled={
                  isConfirmSubmitting ||
                  authoritySelectedPlayers.length === 0 ||
                  !effectiveAuthorityScoreMode
                }
                loading={isConfirmSubmitting}
                icon={<SafetyCertificateOutlined />}
                onClick={handleRequestAuthorityConfirm}
                style={
                  authoritySelectedPlayers.length > 0 &&
                  effectiveAuthorityScoreMode
                    ? {
                        backgroundColor: "#d97706",
                        borderColor: "#d97706",
                        color: "#ffffff",
                      }
                    : undefined
                }
                className="w-full sm:w-auto min-w-[230px] h-12 font-bold text-base"
              >
                심판위원장 직권확정
                {authoritySelectedPlayers.length > 0
                  ? ` (${authoritySelectedPlayers.length}명)`
                  : ""}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
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
            <ConfirmationModal
              isOpen={warnModalOpen}
              message={warnMessage}
              onCancel={() => setWarnModalOpen(false)}
              onConfirm={() => setWarnModalOpen(false)}
            />
            <ConfirmationModal
              isOpen={authorityConfirmOpen}
              message={{
                variant: "warning",
                title: "심판위원장 직권확정 확인",
                body: `${propCompareIndex}차 비교심사 직권 선발: ${authoritySelectedPlayers
                  .map((p) => `${p.playerNumber}번`)
                  .join(", ")} (총 ${authoritySelectedPlayers.length}명)`,
                body2: `적용 채점모드: ${getScoreModeLabel(
                  effectiveAuthorityScoreMode
                )} — 심판위원장 직권으로 비교심사 명단을 즉시 확정하시겠습니까?`,
                isButton: true,
                cancelButtonText: "취소",
                confirmButtonText: "직권확정 실행",
              }}
              onCancel={() => setAuthorityConfirmOpen(false)}
              onConfirm={() =>
                handleUpdateComparePlayers(
                  authoritySelectedPlayers,
                  votedResult,
                  currentContest?.contests?.id,
                  currentContest?.contests?.contestComparesListId,
                  {
                    isAuthority: true,
                    scoreMode: effectiveAuthorityScoreMode,
                  }
                )
              }
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

            {/* 투표 개시 전에도 심판 투표 없이 바로 위원장 직권확정 가능 */}
            {!realtimeData?.compares?.status?.compareStart &&
              renderAuthorityCard()}

            {realtimeData?.compares?.status?.compareStart && (
              <div className="flex w-full h-auto flex-col gap-y-4">
                {/* 득표 현황 */}
                <Card
                  className="border border-[#cbd5e1] shadow-xs"
                  title={
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#eff6ff] border border-[#bfdbfe]">
                          <TrophyOutlined className="text-[#2563eb]" />
                        </div>
                        <span className="font-bold text-base text-[#171717]">
                          비교심사 득표 및 투표현황
                        </span>
                      </div>
                      <span className="text-xs font-medium text-[#64748b]">
                        선수번호 클릭 시 직권확정 명단에 반영됩니다
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
                              (player, pIdx) => {
                                const isAuthSelected =
                                  authoritySelectedKeySet.has(
                                    getComparePlayerKey(player)
                                  );
                                return (
                                  <th
                                    key={
                                      player.playerUid ||
                                      `${player.contestGradeId || ""}-${player.playerNumber}-${pIdx}`
                                    }
                                    onClick={() =>
                                      handleToggleAuthorityPlayer(player)
                                    }
                                    title="클릭하여 심판위원장 직권확정 대상 선택/해제"
                                    className="border border-gray-300 p-3 text-center font-bold cursor-pointer hover:bg-[#eff6ff] transition-colors"
                                  >
                                    <Tag
                                      color={isAuthSelected ? "gold" : "blue"}
                                      className="text-base font-bold px-2.5 py-0.5 m-0 cursor-pointer select-none"
                                    >
                                      {player.playerNumber}
                                      {isAuthSelected ? " ✓" : ""}
                                    </Tag>
                                  </th>
                                );
                              }
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
                      {topResult?.length > 0 ? (
                        topResult.map((top, tIdx) => (
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
                        ))
                      ) : (
                        <span className="text-sm font-medium text-[#15803d]/80">
                          아직 집계된 심판 득표가 없습니다. 심판 투표를 대기하거나 아래{" "}
                          <strong className="font-bold text-[#14532d]">
                            심판위원장 직권확정
                          </strong>
                          에서 호명 선수를 직접 선택해 확정할 수 있습니다.
                        </span>
                      )}
                    </Space>
                  </div>
                </Card>

                {/* 투표 진행 중에도 즉시 직권 지명·조정 가능한 위원장 직권확정 카드 */}
                {renderAuthorityCard()}

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
                            {extractRtdbPlayerArray(realtimeData?.judges).map(
                              (judge, pIdx) => (
                                <th
                                  key={pIdx}
                                  className="border border-gray-300 p-3 text-center font-bold"
                                >
                                  {judge.seatIndex}
                                </th>
                              )
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 p-3 font-bold bg-[#f8fafc]">
                              투표상황
                            </td>
                            {extractRtdbPlayerArray(
                              realtimeData?.compares?.judges
                            ).map((judge, pIdx) => (
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
                            ))}
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
                      {extractRtdbPlayerArray(
                        realtimeData?.compares?.judges
                      ).map((judge, pIdx) => (
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

                      {/* 서브 버튼: 심판위원장 직권확정 */}
                      <Button
                        type="default"
                        size="large"
                        icon={<SafetyCertificateOutlined />}
                        disabled={isConfirmSubmitting}
                        loading={isConfirmSubmitting}
                        onClick={handleRequestAuthorityConfirm}
                        style={{
                          borderColor: "#d97706",
                          color: "#b45309",
                          backgroundColor: "#fffbeb",
                        }}
                        className="w-full md:w-auto min-w-[220px] h-11 font-bold"
                      >
                        심판위원장 직권확정
                        {authoritySelectedPlayers.length > 0
                          ? ` (${authoritySelectedPlayers.length}명)`
                          : ""}
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
