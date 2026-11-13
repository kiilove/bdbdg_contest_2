"use client";

import React, {
  useCallback,
  useState,
  useEffect,
  useContext,
  useMemo,
  useRef,
} from "react";
import LoadingPage from "./LoadingPage";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirebaseRealtimeAddData,
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import { useNavigate } from "react-router-dom";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { Modal } from "@mui/material";
import CompareSetting from "../modals/CompareSetting";
import ContestRankingSummary from "../modals/ContestRankingSummary";
import ContestPointSummary from "../modals/ContestPointSummary";
import dayjs from "dayjs";
import { where } from "firebase/firestore";
import html2canvas from "html2canvas";
import {
  Play,
  Settings,
  RefreshCw,
  Camera,
  Check,
  X,
  ArrowRight,
  SlidersHorizontal,
  Table2,
} from "lucide-react";
import { BibTag, StatusDot } from "../components/ui/BibTag";
import {
  MonitoringBlockingState,
  MonitoringDiagnosticsBar,
  resolveEffectiveCollectionName,
} from "../components/monitoring/MonitoringDiagnosticsBar";

const ContestMonitoringJudgeHead = ({ isHolding, setIsHolding }) => {
  const navigate = useNavigate();
  const { currentContest } = useContext(CurrentContestContext);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [compareMode, setCompareMode] = useState({
    isCompare: false,
    compareStart: false,
    compareEnd: false,
    compareCancel: false,
  });

  const [isLoading, setIsLoading] = useState(true);

  const [contestInfo, setContestInfo] = useState({});

  const [parentRefresh, setParentRefresh] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [compareCancelMsgOpen, setCompareCancelMsgOpen] = useState(false);
  const [rankingSummaryOpen, setRankingSummaryOpen] = useState(false);
  const [rankingSummaryProp, setRankingSummaryProp] = useState({});
  const [pointSummaryOpen, setPointSummaryOpen] = useState(false);
  const [pointSummaryProp, setPointSummaryProp] = useState({});
  const [message, setMessage] = useState({});

  // 채점 완료 순위 확정 안내 모달 상태
  const [urgentModalOpen, setUrgentModalOpen] = useState(false);
  const [urgentGradeInfo, setUrgentGradeInfo] = useState(null);

  // 브라우저 내장 Web Audio 알림음 재생
  const playChimeSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // 1st note (587Hz - D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // 2nd note (880Hz - A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.2);
      gain2.gain.setValueAtTime(0.3, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.8);
    } catch (e) {
      console.warn("Audio playback not allowed:", e);
    }
  };

  // 집계상황 캡처 중복 방지 ref
  const hasCapturedRef = useRef({});

  // 집계표 영역 자동 캡처 및 이미지 다운로드 함수
  const captureScoreTable = async (gradeId, categoryTitle, gradeTitle) => {
    try {
      const element = document.getElementById(`score-table-card-${gradeId}`);
      if (!element) {
        console.warn(`Element #score-table-card-${gradeId} not found`);
        return;
      }

      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const now = dayjs().format("YYYYMMDD_HHmmss");
      const rawContestTitle =
        contestInfo?.contestTitle ||
        currentContest?.contestInfo?.contestTitle ||
        currentContest?.contests?.contestTitle ||
        "대회";

      const cleanContest = rawContestTitle
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim();
      const cleanCategory = (categoryTitle || "종목")
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim();
      const cleanGrade = (gradeTitle || "체급")
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim();
      const fileName = `${cleanContest}_${cleanCategory}_${cleanGrade}_${now}.png`;

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log(`집계상황 캡처 다운로드 완료: ${fileName}`);
        }
      });
    } catch (error) {
      console.error("화면 캡처 실패:", error);
    }
  };

  const [compareOpen, setCompareOpen] = useState(false);
  const [compareInfo, setCompareInfo] = useState({
    playerLength: undefined,
    scoreMode: undefined,
  });
  const [stagesArray, setStagesArray] = useState([]);
  const [playersArray, setPlayersArray] = useState([]);
  const [comparesList, setComparesList] = useState({});
  const [comparesArray, setComparesArray] = useState([]);
  const [currentCompareInfo, setCurrentCompareInfo] = useState({});
  const [matchedOriginalPlayers, setMatchedOriginalPlayers] = useState([]);
  const [currentStageInfo, setCurrentStageInfo] = useState({ stageId: null });
  const [prevRealtimeData, setPrevRealtimeData] = useState({});
  const [compareStatus, setCompareStatus] = useState({
    compareStart: false,
    compareEnd: false,
    compareCancel: false,
    compareIng: false,
  });
  const [normalScoreData, setNormalScoreData] = useState([]);
  const [normalScoreTable, setNormalScoreTable] = useState([]);
  const [judgesAssignArray, setJudgesAssignArray] = useState([]);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const fetchNotice = useFirestoreGetDocument("contest_notice");
  const fetchStages = useFirestoreGetDocument("contest_stages_assign");
  const fetchFinalPlayers = useFirestoreGetDocument("contest_players_final");
  const fetchCompares = useFirestoreGetDocument("contest_compares_list");
  const fetchJudgesAssign = useFirestoreGetDocument("contest_judges_assign");
  const updateCompare = useFirestoreUpdateData("contest_compares_list");
  const fetchScoreCardQuery = useFirestoreQuery();

  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    currentContest?.contests?.id
      ? `currentStage/${currentContest.contests.id}`
      : null
  );

  const addCurrentStage = useFirebaseRealtimeAddData();
  const updateRealtimeCompare = useFirebaseRealtimeUpdateData();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchPool = async (
    noticeId,
    stageAssignId,
    playerFinalId,
    compareListId,
    judgeAssignId
  ) => {
    try {
      const [
        returnNotice,
        returnContestStage,
        returnPlayersFinal,
        returnCompareList,
        returnJudgesAssign,
      ] = await Promise.all([
        noticeId ? fetchNotice.getDocument(noticeId) : Promise.resolve(null),
        stageAssignId
          ? fetchStages.getDocument(stageAssignId)
          : Promise.resolve(null),
        playerFinalId
          ? fetchFinalPlayers.getDocument(playerFinalId)
          : Promise.resolve(null),
        compareListId
          ? fetchCompares.getDocument(compareListId)
          : Promise.resolve(null),
        judgeAssignId
          ? fetchJudgesAssign.getDocument(judgeAssignId)
          : Promise.resolve(null),
      ]);

      if (returnNotice) {
        setContestInfo({ ...returnNotice });
      }
      if (returnContestStage?.stages) {
        setStagesArray(
          [...(returnContestStage.stages || [])].sort(
            (a, b) => (a.stageNumber || 0) - (b.stageNumber || 0)
          )
        );
      } else {
        setStagesArray([]);
      }
      if (returnPlayersFinal?.players) {
        setPlayersArray(
          [...(returnPlayersFinal.players || [])]
            .sort((a, b) => (a.playerIndex || 0) - (b.playerIndex || 0))
            .filter((f) => f.playerNoShow === false)
        );
      } else {
        setPlayersArray([]);
      }
      if (returnJudgesAssign?.judges) {
        setJudgesAssignArray(returnJudgesAssign.judges || []);
      }

      if (returnCompareList) {
        setComparesList({ ...returnCompareList });
        setComparesArray([...(returnCompareList.compares || [])]);
      }

      if (!returnCompareList?.compares?.length) {
        setCurrentCompareInfo({});
      }
    } catch (error) {
      setMessage({
        body: "데이터를 로드하지 못했습니다.",
        body4: error.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const effectiveCollectionName = resolveEffectiveCollectionName(
    contestInfo,
    currentContest
  );

  const fetchScoreTable = useCallback(
    async (grades) => {
      if (
        !effectiveCollectionName ||
        !Array.isArray(grades) ||
        grades.length === 0
      ) {
        return;
      }

      const allData = [];

      for (const grade of grades) {
        const { gradeId } = grade || {};
        if (!gradeId) continue;
        try {
          const condition = [where("gradeId", "==", gradeId)];
          const data = await fetchScoreCardQuery.getDocuments(
            effectiveCollectionName,
            condition
          );
          if (Array.isArray(data)) {
            allData.push(...data);
          }
        } catch (error) {
          console.log(error);
        }
      }

      setNormalScoreData(allData);
    },
    [effectiveCollectionName]
  );

  const handleJudgeIsLoginedValidated = (judgesArray) => {
    if (judgesArray?.length <= 0) {
      return;
    }
    const validate = judgesArray.some((s) => s.isLogined === false);
    return validate;
  };

  const handleForceScoreTableRefresh = (grades) => {
    if (!grades || grades.length <= 0) {
      return;
    }
    setLastUpdated(dayjs().format("YYYY-MM-DD HH:mm:ss"));
    fetchScoreTable(grades);
  };

  const handleGradeInfo = (grades) => {
    let gradeTitle = "";
    let gradeId = "";

    if (grades?.length === 0) {
      gradeTitle = "오류발생";
      gradeId = "";
    } else if (grades.length === 1) {
      gradeTitle = grades[0].gradeTitle;
      gradeId = grades[0].gradeId;
    } else if (grades.length > 1) {
      const madeTitle = grades.map((grade) => {
        return grade.gradeTitle + " ";
      });
      gradeId = grades[0].gradeId;
      gradeTitle = madeTitle + "통합";
    }

    return { gradeTitle, gradeId };
  };

  const handleAddCurrentStage = async () => {
    const {
      stageId,
      stageNumber,
      categoryJudgeCount,
      categoryId,
      categoryTitle,
      grades,
    } = stagesArray[0];

    const { gradeTitle, gradeId } = handleGradeInfo(grades);

    const judgeInitState = Array.from(
      { length: categoryJudgeCount },
      (_, jIdx) => jIdx + 1
    ).map((number) => {
      return { seatIndex: number, isLogined: false, isEnd: false };
    });

    const newCurrentStateInfo = {
      stageId,
      stageNumber,
      categoryId,
      categoryTitle,
      gradeId,
      gradeTitle,
      stageJudgeCount: categoryJudgeCount,
      judges: judgeInitState,
    };
    try {
      await addCurrentStage.addData(
        "currentStage",
        newCurrentStateInfo,
        currentContest.contests.id
      );
    } catch (error) {
      console.log(error);
    }
  };

  const handleGotoSummary = (categoryId, categoryTitle, grades) => {
    navigate("/contestranksummary", {
      state: { categoryId, categoryTitle, grades },
    });
  };

  const handleCompareCancel = async (contestId, compareIndex) => {
    if (!contestId || compareIndex === undefined || compareIndex < 0) return;
    const collectionInfoByCompares = `currentStage/${contestId}/compares`;
    const newCompareArray = [...comparesArray];
    newCompareArray.splice(compareIndex, 1);

    let newRealtimeInfo = {
      compareIndex: 0,
      playerLength: 0,
      scoreMode: null,
      voteRange: null,
      players: [],
      confirmed: { count: 0, numbers: [] },
      judges: [],
      status: {
        compareStart: false,
        compareEnd: false,
        compareCancel: false,
        compareIng: false,
      },
    };

    if (compareIndex > 0 && newCompareArray.length > 0) {
      const prevCompare = newCompareArray[newCompareArray.length - 1];
      const prevPlayers = Array.isArray(prevCompare?.players)
        ? [...prevCompare.players]
        : [];
      const prevConfirmedNumbers = prevPlayers
        .map((p) => Number(p.playerNumber))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);

      newRealtimeInfo = {
        compareIndex: prevCompare.compareIndex,
        status: {
          compareStart: false,
          compareEnd: false,
          compareCancel: false,
          compareIng: true,
        },
        playerLength: prevCompare.comparePlayerLength,
        scoreMode: prevCompare.compareScoreMode,
        players: prevPlayers,
        confirmed: {
          count: prevConfirmedNumbers.length,
          numbers: prevConfirmedNumbers,
        },
      };
    }

    const otherStageCompares = (comparesList?.compares || []).filter(
      (c) => c.stageId !== realtimeData?.stageId
    );
    const mergedCompares = [...otherStageCompares, ...newCompareArray];

    try {
      await updateRealtimeCompare.updateData(collectionInfoByCompares, {
        ...newRealtimeInfo,
      });
      setCompareStatus(() => ({
        compareStart: false,
        compareEnd: false,
        compareCancel: true,
        compareIng: false,
      }));
      if (comparesList?.id) {
        await updateCompare.updateData(comparesList.id, {
          ...comparesList,
          compares: mergedCompares,
        });
      }
      setComparesList((prev) => ({
        ...(prev || {}),
        compares: mergedCompares,
      }));
      setComparesArray(() => [...newCompareArray]);
      setParentRefresh(true);
      setCompareCancelMsgOpen(false);
    } catch (error) {
      console.log(error);
    }
  };

  const reloadJudgeHeadData = () => {
    const noticeId =
      currentContest?.contests?.contestNoticeId ||
      currentContest?.contestInfo?.contestNoticeId ||
      "";
    const stageAssignId =
      currentContest?.contests?.contestStagesAssignId || "";
    const playerFinalId =
      currentContest?.contests?.contestPlayersFinalId || "";
    const compareListId =
      currentContest?.contests?.contestComparesListId || "";
    const judgeAssignId =
      currentContest?.contests?.contestJudgesAssignId || "";

    if (
      noticeId ||
      stageAssignId ||
      playerFinalId ||
      compareListId ||
      judgeAssignId
    ) {
      fetchPool(
        noticeId,
        stageAssignId,
        playerFinalId,
        compareListId,
        judgeAssignId
      );
    } else {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadJudgeHeadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest, realtimeData?.compares]);

  useEffect(() => {
    if (parentRefresh) {
      setIsLoading(true);
      reloadJudgeHeadData();
      setParentRefresh(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentRefresh]);

  useEffect(() => {
    if (!(isLoading || realtimeLoading)) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      setLoadingTimedOut(true);
    }, 7000);
    return () => clearTimeout(timer);
  }, [isLoading, realtimeLoading]);

  useEffect(() => {
    const foundStage = stagesArray.find(
      (f) => f.stageId === realtimeData?.stageId
    );
    setCurrentStageInfo(foundStage ? { ...foundStage } : { stageId: null });
  }, [realtimeData?.stageId, stagesArray]);

  useEffect(() => {
    if (realtimeData?.judges) {
      setPrevRealtimeData(() => ({ ...realtimeData }));
    }

    if (
      realtimeData?.stageJudgeCount &&
      currentStageInfo?.grades?.length > 0 &&
      playersArray?.length > 0
    ) {
      const stageGradeIds = new Set(
        currentStageInfo.grades.map((g) => g?.gradeId).filter(Boolean)
      );
      const rawStagePlayers = playersArray
        .filter((f) => stageGradeIds.has(f.contestGradeId))
        .sort(
          (a, b) =>
            (a.playerIndex ?? Number(a.playerNumber) ?? 0) -
              (b.playerIndex ?? Number(b.playerNumber) ?? 0) ||
            (Number(a.playerNumber) || 0) - (Number(b.playerNumber) || 0)
        );

      const seenStagePlayerKeys = new Set();
      const dedupedStagePlayers = [];
      rawStagePlayers.forEach((p) => {
        const k = String(p.playerUid || p.playerNumber || p.playerName);
        if (!seenStagePlayerKeys.has(k)) {
          seenStagePlayerKeys.add(k);
          dedupedStagePlayers.push(p);
        }
      });

      setMatchedOriginalPlayers(dedupedStagePlayers);
    } else {
      setMatchedOriginalPlayers([]);
    }
  }, [realtimeData, currentStageInfo, playersArray]);

  // C5: 스테이지 변경 시 이전 점수 초기화 & 심판 점수 변경/무대 준비 시 자동 갱신
  useEffect(() => {
    setNormalScoreData([]);
  }, [realtimeData?.stageId]);

  const judgesSignature = JSON.stringify(realtimeData?.judges || []);
  const stageGradesSignature = JSON.stringify(
    (currentStageInfo?.grades || []).map((g) => g?.gradeId)
  );

  useEffect(() => {
    if (
      !effectiveCollectionName ||
      !currentStageInfo?.stageId ||
      !currentStageInfo?.grades?.length
    ) {
      return;
    }

    let cancelled = false;
    (async () => {
      const allData = [];
      for (const grade of currentStageInfo.grades) {
        if (!grade?.gradeId) continue;
        try {
          const data = await fetchScoreCardQuery.getDocuments(
            effectiveCollectionName,
            [where("gradeId", "==", grade.gradeId)]
          );
          if (Array.isArray(data)) {
            allData.push(...data);
          }
        } catch (err) {
          console.log(err);
        }
      }
      if (!cancelled) {
        setNormalScoreData(allData);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveCollectionName,
    currentStageInfo?.stageId,
    stageGradesSignature,
    judgesSignature,
  ]);

  useEffect(() => {
    if (compareMode.compareStart) {
      setCompareOpen(true);
    }
  }, [compareMode]);

  useEffect(() => {
    if (
      compareInfo.playerLength !== undefined &&
      compareInfo.scoreMode !== undefined
    ) {
      setCompareMode(() => ({
        compareIng: true,
        compareStart: true,
        compareEnd: false,
        compareCancel: false,
      }));
    }
  }, [compareInfo]);

  const handleForceUpdate = useCallback(() => {
    if (currentContest?.contests?.id) {
      setLastUpdated(dayjs().format("YYYY-MM-DD HH:mm:ss"));
    }
    if (currentStageInfo?.grades) {
      handleForceScoreTableRefresh(currentStageInfo.grades);
    }
  }, [currentContest, currentStageInfo]);

  // 현재 스테이지(gradeId)와 일치하는 비교심사만 화면에 표시
  useEffect(() => {
    const currentStageId = realtimeData?.stageId;
    if (!currentStageId) {
      setComparesArray([]);
      setCurrentCompareInfo({});
      return;
    }

    if (comparesArray.length > 0) {
      const filterCurrentStageCompareInfo = comparesArray.filter(
        (f) =>
          f.categoryId === realtimeData.categoryId &&
          f.gradeId === realtimeData.gradeId
      );
      setCurrentCompareInfo({
        ...filterCurrentStageCompareInfo[
          filterCurrentStageCompareInfo?.length - 1
        ],
      });
    }

    const all = comparesList?.compares || [];
    const filtered = all.filter((c) => c.stageId === currentStageId);

    setComparesArray(filtered);
    setCurrentCompareInfo(
      filtered.length > 0 ? { ...filtered[filtered.length - 1] } : {}
    );
  }, [comparesList, realtimeData?.stageId]);

  const prevStageIdRef = useRef(null);

  const resetComparesForNewStage = async () => {
    try {
      const path = `currentStage/${currentContest?.contests?.id}/compares`;
      await updateRealtimeCompare.updateData(path, {
        compareIndex: 0,
        status: {
          compareStart: false,
          compareEnd: false,
          compareCancel: false,
          compareIng: false,
        },
        playerLength: 0,
        scoreMode: null,
        players: [],
        confirmed: { count: 0, numbers: [] },
        judges: [],
      });
    } catch (e) {
      console.warn("스테이지 변경 시 비교 상태 리셋 실패:", e?.message);
    }
    setCompareMode({
      isCompare: false,
      compareStart: false,
      compareEnd: false,
      compareCancel: false,
    });
    setCompareStatus({
      compareStart: false,
      compareEnd: false,
      compareCancel: false,
      compareIng: false,
    });
    setCurrentCompareInfo({});
    setCompareOpen(false);
  };

  useEffect(() => {
    const currentStageId = realtimeData?.stageId || null;
    if (
      prevStageIdRef.current !== null &&
      currentStageId &&
      prevStageIdRef.current !== currentStageId
    ) {
      resetComparesForNewStage();
    }
    prevStageIdRef.current = currentStageId;
  }, [realtimeData?.stageId]);

  const hasAlertedRef = useRef({});
  const alertTimerRef = useRef(null);

  // 스테이지 변경 시 알럿 이력 및 타이머 초기화
  useEffect(() => {
    hasAlertedRef.current = {};
    hasCapturedRef.current = {};
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }
  }, [realtimeData?.stageId]);

  // 모든 심사위원 채점 완료 감지 및 자동 캡처 + 5초 후 순위확정 안내 표시
  useEffect(() => {
    if (
      !currentStageInfo?.grades ||
      currentStageInfo.grades.length === 0 ||
      !realtimeData?.judges ||
      realtimeData.judges.length === 0 ||
      rankingSummaryOpen ||
      pointSummaryOpen
    ) {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }
      return;
    }

    const savedGrades = Array.isArray(realtimeData?.resultSaved)
      ? realtimeData.resultSaved
      : [];
    const unconfirmedGrades = currentStageInfo.grades.filter(
      (g) => !savedGrades.includes(g.gradeId)
    );

    if (unconfirmedGrades.length === 0) {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }
      return;
    }

    const fullyScoredUnconfirmedGrade = unconfirmedGrades.find((grade) => {
      const filtered = playersArray.filter(
        (f) => f.contestGradeId === grade.gradeId && f.playerNoShow === false
      );

      if (filtered.length === 0) return false;

      const isComplete = filtered.every((player) =>
        realtimeData.judges.every((judge) => {
          const scoreEntry = normalScoreData.find(
            (f) =>
              f.playerNumber === player.playerNumber &&
              f.seatIndex === judge.seatIndex
          );
          return (
            scoreEntry &&
            scoreEntry.playerScore !== 0 &&
            scoreEntry.playerScore !== undefined &&
            scoreEntry.playerScore !== null
          );
        })
      );

      return isComplete;
    });

    if (fullyScoredUnconfirmedGrade) {
      // 1. 점수 모두 들어왔을 때 자동으로 집계상황 카드 캡처 및 로컬 파일 저장 (1회)
      if (!hasCapturedRef.current[fullyScoredUnconfirmedGrade.gradeId]) {
        hasCapturedRef.current[fullyScoredUnconfirmedGrade.gradeId] = true;
        setTimeout(() => {
          captureScoreTable(
            fullyScoredUnconfirmedGrade.gradeId,
            fullyScoredUnconfirmedGrade.categoryTitle,
            fullyScoredUnconfirmedGrade.gradeTitle
          );
        }, 500);
      }

      // 2. 5초 후에도 순위확정을 안 누르면 순위확정 안내 다이얼로그 표시
      if (
        !alertTimerRef.current &&
        !hasAlertedRef.current[fullyScoredUnconfirmedGrade.gradeId]
      ) {
        alertTimerRef.current = setTimeout(() => {
          playChimeSound();
          setUrgentGradeInfo(fullyScoredUnconfirmedGrade);
          setUrgentModalOpen(true);
          hasAlertedRef.current[fullyScoredUnconfirmedGrade.gradeId] = true;
          alertTimerRef.current = null;
        }, 5000);
      }
    } else {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }
    }

    return () => {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }
    };
  }, [
    normalScoreData,
    currentStageInfo,
    realtimeData?.judges,
    realtimeData?.resultSaved,
    playersArray,
    rankingSummaryOpen,
    pointSummaryOpen,
  ]);

  useEffect(() => {
    console.log("현재체급 비교심사정보", currentCompareInfo);
  }, [currentCompareInfo]);

  // 참조 유지 (ESLint unused 방지)
  void isHolding;
  void setIsHolding;
  void setCompareInfo;
  void prevRealtimeData;
  void compareStatus;
  void normalScoreTable;
  void setNormalScoreTable;
  void realtimeError;
  void handleJudgeIsLoginedValidated;
  void handleAddCurrentStage;
  void handleGotoSummary;

  const activeStageMatchedPlayersCount = useMemo(() => {
    if (!realtimeData?.stageId) return undefined;
    const grades = currentStageInfo?.grades || [];
    if (!grades.length) return 0;
    const gradeSet = new Set(grades.map((g) => g?.gradeId).filter(Boolean));
    return (playersArray || []).filter((p) => gradeSet.has(p.contestGradeId))
      .length;
  }, [realtimeData?.stageId, currentStageInfo?.grades, playersArray]);

  const emptyJudgeSeatsForDiag = useMemo(() => {
    if (realtimeData?.judges?.length > 0) {
      return realtimeData.judges
        .filter((j) => !j?.judgeUid && !j?.judgeName)
        .map((j, i) => j?.seatIndex ?? i + 1);
    }
    return [];
  }, [realtimeData?.judges]);

  return (
    <>
      {(isLoading || realtimeLoading) && !loadingTimedOut ? (
        <div className="flex w-full min-h-[60vh] justify-center items-center bg-[#fafafa]">
          <LoadingPage propStyles={{ width: "80", height: "60" }} />
        </div>
      ) : (
        <div className="flex flex-col w-full min-h-full bg-[#fafafa] text-[#171717] p-4 md:p-6 gap-4">
          {/* 심판위원장 순위 확정 안내 다이얼로그 (Instrument Dialog) */}
          <Modal
            open={urgentModalOpen}
            onClose={() => setUrgentModalOpen(false)}
          >
            <div
              className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/45"
              style={{ transform: "none" }}
            >
              <div className="w-full max-w-md bg-white rounded-[14px] border border-[#171717]/15 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.12)] space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-[#2563eb]">
                      <StatusDot status="active" live />
                      <span>채점 집계 완료</span>
                    </div>
                    <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#171717] m-0">
                      전 좌석 채점 완료 — 순위 확정이 필요합니다
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUrgentModalOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#737373] hover:bg-[#f4f4f5] hover:text-[#171717] transition-colors cursor-pointer"
                    aria-label="닫기"
                  >
                    <X size={16} strokeWidth={1.5} />
                  </button>
                </div>

                <div className="rounded-[10px] bg-[#f4f4f5] border border-[#171717]/[0.08] p-4 space-y-2">
                  <div className="text-xs font-medium text-[#737373]">
                    대기 중인 무대 체급
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {realtimeData?.stageNumber !== undefined && (
                      <BibTag
                        prefix="#"
                        number={realtimeData.stageNumber}
                        size="md"
                      />
                    )}
                    <span className="text-sm font-semibold text-[#171717]">
                      {urgentGradeInfo?.categoryTitle}
                    </span>
                    <span className="text-[#737373]">/</span>
                    <span className="text-sm font-medium text-[#525252]">
                      {urgentGradeInfo?.gradeTitle}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-[#525252] leading-relaxed m-0">
                  모든 심사위원 좌석의 점수가 수신되었습니다. 순위표를 검토하고 확정을 완료하면 다음 무대 진행 및 공식 결과 집계가 반영됩니다.
                </p>

                <div className="flex flex-col sm:flex-row-reverse gap-2 pt-1">
                  <button
                    type="button"
                    className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-sm transition-colors cursor-pointer"
                    onClick={() => {
                      setUrgentModalOpen(false);
                      if (urgentGradeInfo?.categoryJudgeType === "point") {
                        setPointSummaryProp({
                          categoryId: urgentGradeInfo.categoryId,
                          gradeId: urgentGradeInfo.gradeId,
                          categoryJudgeType: urgentGradeInfo.categoryJudgeType,
                        });
                        setPointSummaryOpen(true);
                      } else {
                        setRankingSummaryProp({
                          categoryId: urgentGradeInfo.categoryId,
                          gradeId: urgentGradeInfo.gradeId,
                          categoryJudgeType: urgentGradeInfo.categoryJudgeType,
                        });
                        setRankingSummaryOpen(true);
                      }
                    }}
                  >
                    <span>순위표 확인 및 확정</span>
                    <ArrowRight size={16} strokeWidth={1.5} />
                  </button>

                  <button
                    type="button"
                    className="inline-flex items-center justify-center h-10 px-4 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#525252] font-medium text-sm transition-colors cursor-pointer"
                    onClick={() => setUrgentModalOpen(false)}
                  >
                    나중에 확인
                  </button>
                </div>
              </div>
            </div>
          </Modal>

          <ConfirmationModal
            isOpen={msgOpen}
            message={message}
            onCancel={() => setMsgOpen(false)}
            onConfirm={() => setMsgOpen(false)}
          />
          <ConfirmationModal
            isOpen={compareCancelMsgOpen}
            message={message}
            onCancel={() => setCompareCancelMsgOpen(false)}
            onConfirm={() =>
              handleCompareCancel(
                currentContest.contests.id,
                comparesArray?.length - 1
              )
            }
          />
          <Modal open={compareOpen} onClose={() => setCompareOpen(false)}>
            <CompareSetting
              stageInfo={currentStageInfo}
              setClose={setCompareOpen}
              matchedOriginalPlayers={matchedOriginalPlayers}
              setRefresh={setParentRefresh}
              propCompareIndex={comparesArray?.length + 1}
              handleCompareCancel={() =>
                handleCompareCancel(
                  currentContest.contests.id,
                  comparesArray?.length - 1
                )
              }
            />
          </Modal>
          <Modal open={rankingSummaryOpen}>
            <ContestRankingSummary
              categoryId={rankingSummaryProp?.categoryId}
              gradeId={rankingSummaryProp?.gradeId}
              stageId={realtimeData?.stageId}
              setClose={setRankingSummaryOpen}
              currentResultSaved={realtimeData?.resultSaved}
            />
          </Modal>
          <Modal open={pointSummaryOpen}>
            <ContestPointSummary
              categoryId={pointSummaryProp?.categoryId}
              gradeId={pointSummaryProp?.gradeId}
              stageId={realtimeData?.stageId}
              setClose={setPointSummaryOpen}
              currentResultSaved={realtimeData?.resultSaved}
            />
          </Modal>

          {/* 울트라퀵 데이터 보강 메뉴 바 */}
          <MonitoringDiagnosticsBar
            variant="light"
            screenType="judgeHead"
            contestInfo={contestInfo}
            stagesCount={stagesArray.length}
            playersCount={playersArray.length}
            judgesAssignCount={judgesAssignArray.length}
            realtimeData={realtimeData}
            currentStagePlayersCount={activeStageMatchedPlayersCount}
            emptyJudgeSeats={emptyJudgeSeatsForDiag}
            onRefreshData={reloadJudgeHeadData}
          />

          {/* 상단 대회 및 현재 무대 요약 바 */}
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 md:p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-[#737373]">
                  <StatusDot
                    status={realtimeData?.stageId ? "live" : "idle"}
                    live={Boolean(realtimeData?.stageId)}
                  />
                  <span>심판위원장 총괄 집계석</span>
                  {effectiveCollectionName && (
                    <>
                      <span>·</span>
                      <span className="font-mono">
                        DB: {effectiveCollectionName}
                      </span>
                    </>
                  )}
                  {lastUpdated && (
                    <>
                      <span>·</span>
                      <span className="font-mono tabular-nums">
                        최근 갱신 {lastUpdated}
                      </span>
                    </>
                  )}
                </div>
                <h1 className="text-lg font-semibold tracking-[-0.02em] text-[#171717] m-0">
                  {contestInfo.contestTitle ||
                    currentContest?.contests?.contestTitle ||
                    "대회 정보 대기 중"}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.06]">
                <span className="text-xs font-medium text-[#737373]">
                  진행 무대
                </span>
                {realtimeData?.stageNumber !== undefined && (
                  <BibTag
                    prefix="#"
                    number={realtimeData.stageNumber}
                    size="sm"
                  />
                )}
                <span className="text-sm font-semibold text-[#171717]">
                  {realtimeData?.categoryTitle
                    ? `${realtimeData.categoryTitle} / ${realtimeData?.gradeTitle || ""}`
                    : "대기 중"}
                </span>
              </div>
            </div>
          </div>

          {/* 실시간 무대 미개시 또는 필수 데이터 누락 시 구체적 진단 안내 */}
          {(!realtimeData?.stageId ||
            !effectiveCollectionName ||
            activeStageMatchedPlayersCount === 0) && (
            <MonitoringBlockingState
              variant="light"
              screenType="judgeHead"
              screenLabel="심판위원장 채점·비교심사 모니터링"
              contestInfo={contestInfo}
              stagesCount={stagesArray.length}
              playersCount={playersArray.length}
              judgesAssignCount={judgesAssignArray.length}
              realtimeData={realtimeData}
              currentStagePlayersCount={activeStageMatchedPlayersCount}
              emptyJudgeSeats={emptyJudgeSeatsForDiag}
              onRefreshData={reloadJudgeHeadData}
            />
          )}

          {/* 비교심사 제어 카드 */}
          {realtimeData?.stageId && (
            <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-[#f4f4f5] border-b border-[#171717]/[0.08]">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal
                    size={16}
                    strokeWidth={1.5}
                    className="text-[#525252]"
                  />
                  <h2 className="text-sm font-semibold text-[#171717] m-0">
                    비교심사 운영
                  </h2>
                  {comparesArray?.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-white border border-[#171717]/10 text-xs font-mono font-medium tabular-nums text-[#525252]">
                      {comparesArray.length}회 진행
                    </span>
                  )}
                </div>

                {realtimeData.judges && comparesArray && (
                  <div
                    className={`flex ${
                      isMobile ? "flex-col w-full" : "flex-row items-center"
                    } gap-2`}
                  >
                    <button
                      type="button"
                      disabled={!currentStageInfo?.grades?.length}
                      onClick={() =>
                        setCompareMode((prev) => ({
                          ...prev,
                          compareStart: true,
                        }))
                      }
                      className={`inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] text-xs font-medium transition-colors ${
                        !currentStageInfo?.grades?.length
                          ? "bg-[#e4e4e7] text-[#737373] cursor-not-allowed"
                          : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white cursor-pointer"
                      } ${isMobile ? "w-full" : ""}`}
                    >
                      <Play size={15} strokeWidth={1.5} />
                      <span className="tabular-nums">
                        {(comparesArray?.length ?? 0) + 1}차 비교심사 시작
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!currentStageInfo?.grades?.length}
                      onClick={() => setCompareOpen(true)}
                      className={`inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] text-xs font-medium border border-[#171717]/15 bg-white hover:bg-[#fafafa] text-[#171717] transition-colors ${
                        !currentStageInfo?.grades?.length
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      } ${isMobile ? "w-full" : ""}`}
                    >
                      <Settings size={15} strokeWidth={1.5} />
                      <span>비교심사 설정 보기</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="p-5">
                {currentCompareInfo?.players?.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.08] text-xs">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] font-medium tabular-nums">
                        <StatusDot status="active" />
                        {currentCompareInfo?.compareIndex}차 비교심사
                      </span>
                      <span className="text-[#525252] font-mono tabular-nums">
                        선발인원 {currentCompareInfo?.comparePlayerLength}명
                      </span>
                      <span className="text-[#737373]">·</span>
                      <span className="text-[#525252]">
                        채점모드:{" "}
                        {currentCompareInfo?.compareScoreMode === "compare" ||
                        currentCompareInfo?.compareScoreMode === "topOnly"
                          ? "대상자만 채점"
                          : "전체 채점"}
                      </span>
                    </div>

                    {comparesArray?.length > 0 &&
                      comparesArray.map((compare, cIdx) => {
                        const { players, compareIndex } = compare;

                        return (
                          <div
                            key={cIdx}
                            className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between p-3.5 rounded-[8px] bg-white border border-[#171717]/[0.08]"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-[#737373] mr-1 tabular-nums">
                                {compareIndex}차 호명
                              </span>
                              {players?.map((top, tIdx) => (
                                <BibTag
                                  key={tIdx}
                                  number={top.playerNumber}
                                  variant="active"
                                  size="lg"
                                />
                              ))}
                            </div>

                            {cIdx === comparesArray.length - 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMessage({
                                    body: "비교심사를 취소하시겠습니까?",
                                    isButton: true,
                                    cancelButtonText: "아니오",
                                    confirmButtonText: "예",
                                  });
                                  setCompareCancelMsgOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[#dc2626]/25 bg-white hover:bg-[#dc2626]/[0.05] text-[#dc2626] text-xs font-medium transition-colors cursor-pointer"
                              >
                                <X size={14} strokeWidth={1.5} />
                                <span className="tabular-nums">
                                  {compareIndex}차 비교심사 취소
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-xs text-[#737373] py-2">
                    현재 체급에서 진행 중인 비교심사가 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 실시간 집계상황 매트릭스 (Moment #2: Judge-by-Athlete Score Matrix) */}
          {realtimeData?.stageId && (
            <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-5 py-3.5 bg-[#f4f4f5] border-b border-[#171717]/[0.08]">
                <div className="flex items-center gap-2">
                  <Table2
                    size={16}
                    strokeWidth={1.5}
                    className="text-[#525252]"
                  />
                  <h2 className="text-sm font-semibold text-[#171717] m-0">
                    집계상황
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleForceUpdate}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#fafafa] text-[#171717] text-xs font-medium transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} strokeWidth={1.5} />
                  <span>새로고침</span>
                </button>
              </div>

              <div className="p-5 space-y-6">
                {currentStageInfo?.grades?.length > 0 ? (
                  currentStageInfo.grades.map((grade, gIdx) => {
                    const { categoryTitle, categoryId, gradeTitle, gradeId } =
                      grade;
                    const { categoryJudgeType } = currentStageInfo;

                    const filterdPlayers = playersArray
                      .filter(
                        (f) =>
                          f.contestGradeId === gradeId &&
                          f.playerNoShow === false
                      )
                      .sort((a, b) => a.playerIndex - b.playerIndex);

                    const judges = realtimeData?.judges || [];

                    const isAllScored =
                      filterdPlayers.length > 0 &&
                      judges.length > 0 &&
                      filterdPlayers.every((player) =>
                        judges.every((judge) => {
                          const scoreEntry = normalScoreData.find(
                            (f) =>
                              f.playerNumber === player.playerNumber &&
                              f.seatIndex === judge.seatIndex
                          );
                          return (
                            scoreEntry &&
                            scoreEntry.playerScore !== 0 &&
                            scoreEntry.playerScore !== undefined &&
                            scoreEntry.playerScore !== null
                          );
                        })
                      );

                    const savedGrades = Array.isArray(realtimeData?.resultSaved)
                      ? realtimeData.resultSaved
                      : [];
                    const isGradeConfirmed = savedGrades.includes(gradeId);

                    return (
                      <div
                        key={gIdx}
                        id={`score-table-card-${gradeId}`}
                        className="p-4 md:p-5 bg-white rounded-[12px] border border-[#171717]/[0.08] space-y-4"
                      >
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                          <div className="space-y-1">
                            <div className="text-xs text-[#737373]">
                              {contestInfo?.contestTitle ||
                                currentContest?.contestInfo?.contestTitle ||
                                currentContest?.contests?.contestTitle ||
                                "대회"}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold tracking-[-0.01em] text-[#171717]">
                                {categoryTitle}
                              </span>
                              <span className="text-[#737373]">/</span>
                              <span className="text-base font-medium text-[#525252]">
                                {gradeTitle}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/10 text-[11px] font-mono font-medium text-[#525252]">
                                {categoryJudgeType === "point"
                                  ? "POINT"
                                  : "RANKING"}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                captureScoreTable(
                                  gradeId,
                                  categoryTitle,
                                  gradeTitle
                                )
                              }
                              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium transition-colors cursor-pointer"
                            >
                              <Camera size={15} strokeWidth={1.5} />
                              <span>캡처</span>
                            </button>

                            {categoryJudgeType === "point" ? (
                              <button
                                type="button"
                                disabled={isGradeConfirmed}
                                onClick={() => {
                                  if (!isGradeConfirmed) {
                                    setPointSummaryProp({
                                      categoryId,
                                      gradeId,
                                      categoryJudgeType,
                                    });
                                    setPointSummaryOpen(true);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 h-9 px-4 rounded-[8px] text-xs font-medium transition-colors ${
                                  isGradeConfirmed
                                    ? "bg-[#f4f4f5] text-[#737373] border border-[#171717]/10 cursor-default"
                                    : isAllScored
                                    ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white cursor-pointer"
                                    : "bg-white hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/20 cursor-pointer"
                                }`}
                              >
                                {isGradeConfirmed ? (
                                  <>
                                    <Check
                                      size={15}
                                      strokeWidth={1.5}
                                      className="text-[#16a34a]"
                                    />
                                    <span>순위표 확정됨</span>
                                  </>
                                ) : isAllScored ? (
                                  <>
                                    <span className="h-2 w-2 rounded-full bg-white" />
                                    <span>점수형 순위 확정 (채점 완료)</span>
                                  </>
                                ) : (
                                  <span>점수형 집계 및 순위 확인</span>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isGradeConfirmed}
                                onClick={() => {
                                  if (!isGradeConfirmed) {
                                    setRankingSummaryProp({
                                      categoryId,
                                      gradeId,
                                      categoryJudgeType,
                                    });
                                    setRankingSummaryOpen(true);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 h-9 px-4 rounded-[8px] text-xs font-medium transition-colors ${
                                  isGradeConfirmed
                                    ? "bg-[#f4f4f5] text-[#737373] border border-[#171717]/10 cursor-default"
                                    : isAllScored
                                    ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white cursor-pointer"
                                    : "bg-white hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/20 cursor-pointer"
                                }`}
                              >
                                {isGradeConfirmed ? (
                                  <>
                                    <Check
                                      size={15}
                                      strokeWidth={1.5}
                                      className="text-[#16a34a]"
                                    />
                                    <span>순위표 확정됨</span>
                                  </>
                                ) : isAllScored ? (
                                  <>
                                    <span className="h-2 w-2 rounded-full bg-white" />
                                    <span>랭킹형 순위 확정 (채점 완료)</span>
                                  </>
                                ) : (
                                  <span>랭킹형 집계 및 순위 확인</span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-[8px] border border-[#171717]/[0.08]">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08]">
                                <th className="sticky left-0 z-10 bg-[#f4f4f5] px-3.5 py-2.5 text-left text-xs font-medium text-[#525252] border-r border-[#171717]/[0.08] whitespace-nowrap w-[108px]">
                                  선수번호
                                </th>
                                {judges.map((judge) => (
                                  <th
                                    key={`head-judge-${judge.seatIndex}`}
                                    className="px-3 py-2.5 text-center text-xs font-medium text-[#525252] whitespace-nowrap min-w-[84px]"
                                  >
                                    <span className="font-mono tabular-nums">
                                      {judge.seatIndex}
                                    </span>
                                    번 심판
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#171717]/[0.06] bg-white">
                              {filterdPlayers.length > 0 ? (
                                filterdPlayers.map((player, pIdx) => (
                                  <tr
                                    key={player.playerUid || pIdx}
                                    className="hover:bg-[#fafafa] transition-colors"
                                  >
                                    <td className="sticky left-0 z-10 bg-white px-3.5 py-2.5 border-r border-[#171717]/[0.08] whitespace-nowrap">
                                      <BibTag
                                        number={player.playerNumber}
                                        size="md"
                                      />
                                    </td>
                                    {judges.map((judge) => {
                                      const finded = normalScoreData.find(
                                        (f) =>
                                          f.playerNumber ===
                                            player.playerNumber &&
                                          f.seatIndex === judge.seatIndex
                                      );

                                      let cellContent = (
                                        <span className="font-mono tabular-nums text-[#737373]">
                                          -
                                        </span>
                                      );

                                      if (finded?.playerScore >= 1000) {
                                        cellContent = (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#737373] text-[11px] font-medium">
                                            순위제외
                                          </span>
                                        );
                                      } else if (
                                        finded?.playerScore !== 0 &&
                                        finded?.playerScore !== undefined &&
                                        finded?.playerScore !== null
                                      ) {
                                        cellContent = (
                                          <span className="font-mono font-medium tabular-nums text-[#171717]">
                                            {finded.playerScore}
                                          </span>
                                        );
                                      }

                                      return (
                                        <td
                                          key={`cell-${player.playerNumber}-${judge.seatIndex}`}
                                          className="px-3 py-2.5 text-center whitespace-nowrap"
                                        >
                                          {cellContent}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td
                                    colSpan={Math.max(judges.length + 1, 2)}
                                    className="px-4 py-8 text-center text-xs text-[#737373]"
                                  >
                                    출전 선수 정보가 없습니다.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-[#737373] py-4 text-center">
                    현재 진행 중인 체급 정보가 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ContestMonitoringJudgeHead;
