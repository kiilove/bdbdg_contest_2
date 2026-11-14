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
import { getStagePlayerSortIndex } from "../functions/functions";
import { Drawer, Modal } from "@mui/material";
import CompareSetting from "../modals/CompareSetting";
import ContestRankingSummary from "../modals/ContestRankingSummary";
import dayjs from "dayjs";
import { doc, onSnapshot, where } from "firebase/firestore";
import { db } from "../firebase";
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
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { StatusDot } from "../components/ui/BibTag";
import {
  MonitoringBlockingState,
  MonitoringDiagnosticsBar,
  resolveEffectiveCollectionName,
} from "../components/monitoring/MonitoringDiagnosticsBar";
import {
  normalizeDenseRealtimeJudges,
  summarizeJudgeSeatGaps,
} from "../utils/judgeAssignUtils";
import {
  removeStageCompareByLocalIndex,
  buildRealtimeCompareAfterCancel,
} from "../utils/compareVoteUtils";
import {
  buildLiveStageRealtimeSnapshot,
  extractRtdbPlayerArray,
  resolveEffectiveStagePlayers,
} from "../utils/liveStageSnapshotUtils";
import { isActiveStagePlayer } from "../utils/playerEntryUtils";

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
      osc2.onended = () => {
        try {
          ctx.close();
        } catch {
          // ignore close error
        }
      };
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

      const { default: html2canvas } = await import("html2canvas");
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
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
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
  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
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
    judgeAssignId,
    categoryListId,
    gradeListId
  ) => {
    try {
      const [
        returnNotice,
        returnContestStage,
        returnPlayersFinal,
        returnCompareList,
        returnJudgesAssign,
        returnCategories,
        returnGrades,
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
        categoryListId
          ? fetchCategories.getDocument(categoryListId)
          : Promise.resolve(null),
        gradeListId
          ? fetchGrades.getDocument(gradeListId)
          : Promise.resolve(null),
      ]);

      if (returnNotice) {
        setContestInfo({ ...returnNotice });
      }
      if (returnCategories?.categorys) {
        setCategoriesArray(returnCategories.categorys || []);
      } else {
        setCategoriesArray([]);
      }
      if (returnGrades?.grades) {
        setGradesArray(returnGrades.grades || []);
      } else {
        setGradesArray([]);
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
            .filter((f) => isActiveStagePlayer(f))
            .sort(
              (a, b) =>
                getStagePlayerSortIndex(a) - getStagePlayerSortIndex(b)
            )
        );
      } else {
        setPlayersArray([]);
      }
      if (returnJudgesAssign?.judges) {
        setJudgesAssignArray(returnJudgesAssign.judges || []);
      }

      if (returnCompareList) {
        setComparesList({ ...returnCompareList });
      } else {
        setComparesList({});
      }

      if (!returnCompareList?.compares?.length) {
        setComparesArray([]);
        setCurrentCompareInfo({});
      }
    } catch (error) {
      setMessage({
        variant: "error",
        title: "모니터링 데이터 로드 실패",
        body: "심판위원장 모니터링 데이터를 불러오지 못했습니다.",
        body4: error.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 계측 파이널 및 그랑프리/불참 변경 실시간 Live-Sync 리스너
  useEffect(() => {
    const finalDocId =
      currentContest?.contests?.contestPlayersFinalId ||
      currentContest?.contestPlayersFinalId;
    if (!finalDocId) return;

    const unsub = onSnapshot(
      doc(db, "contest_players_final", finalDocId),
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          const remotePlayers = Array.isArray(remoteData?.players)
            ? remoteData.players
            : [];
          setPlayersArray(
            [...remotePlayers]
              .filter((f) => isActiveStagePlayer(f))
              .sort(
                (a, b) =>
                  getStagePlayerSortIndex(a) - getStagePlayerSortIndex(b)
              )
          );
        }
      },
      (err) => {
        console.warn(
          "[JudgeHead] contest_players_final 실시간 리스너 오류:",
          err
        );
      }
    );

    return () => unsub();
  }, [
    currentContest?.contests?.contestPlayersFinalId,
    currentContest?.contestPlayersFinalId,
  ]);

  // 심판 좌석 배정 실시간 Live-Sync 리스너
  useEffect(() => {
    const judgeAssignDocId =
      currentContest?.contests?.contestJudgesAssignId ||
      currentContest?.contestJudgesAssignId;
    if (!judgeAssignDocId) return;

    const unsub = onSnapshot(
      doc(db, "contest_judges_assign", judgeAssignDocId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data?.judges)) {
            setJudgesAssignArray(data.judges);
          }
        }
      },
      (err) => {
        console.warn(
          "[JudgeHead] contest_judges_assign 실시간 리스너 오류:",
          err
        );
      }
    );

    return () => unsub();
  }, [
    currentContest?.contests?.contestJudgesAssignId,
    currentContest?.contestJudgesAssignId,
  ]);

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
    const firstStage = stagesArray?.[0];
    if (!firstStage) return;

    const {
      stageId,
      stageNumber,
      categoryJudgeCount,
      categoryJudgeType,
      categoryId,
      categoryTitle,
      grades,
    } = firstStage;

    const { gradeTitle, gradeId } = handleGradeInfo(grades);
    const targetJudgeCount = Number(categoryJudgeCount) || 5;

    const judgeInitState = Array.from(
      { length: targetJudgeCount },
      (_, jIdx) => {
        const seat = jIdx + 1;
        const matchingRows = (judgesAssignArray || []).filter(
          (j) =>
            (j?.contestGradeId === gradeId || j?.gradeId === gradeId) &&
            Number(j?.seatIndex) === seat
        );
        const assigned =
          matchingRows.length > 0
            ? matchingRows[matchingRows.length - 1]
            : null;
        return {
          seatIndex: seat,
          isLogined: false,
          isEnd: false,
          judgeName: assigned?.judgeName ?? null,
          judgeUid: assigned?.judgeUid ?? null,
          onedayPassword: assigned?.onedayPassword ?? null,
        };
      }
    );

    const stageSnapshot = buildLiveStageRealtimeSnapshot({
      targetStage: firstStage,
      playersPool: playersArray,
      pushIdPrefix: "stage",
    });

    const newCurrentStateInfo = {
      stageId: stageId || "",
      stageNumber: stageNumber || 1,
      categoryId: categoryId || "",
      categoryTitle: categoryTitle || "",
      categoryJudgeType: categoryJudgeType || "ranking",
      gradeId: gradeId || "",
      gradeTitle: gradeTitle || "",
      stageJudgeCount: targetJudgeCount,
      judges: judgeInitState,
      resultSaved: [],
      compares: {
        status: {
          compareStart: false,
          compareEnd: false,
          compareCancel: false,
          compareIng: false,
        },
        confirmed: { count: 0 },
      },
      screen: { status: { playStart: false } },
      ...stageSnapshot,
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
    const collectionInfoByCompares = `currentStage/${contestId}/compares`;
    const targetStageId = currentStageInfo?.stageId || realtimeData?.stageId;
    const { nextAllCompares, nextStageCompares } =
      removeStageCompareByLocalIndex(
        comparesList?.compares || [],
        targetStageId,
        compareIndex
      );
    const newRealtimeInfo = buildRealtimeCompareAfterCancel(nextStageCompares);

    try {
      await updateRealtimeCompare.updateData(collectionInfoByCompares, {
        ...newRealtimeInfo,
        status: {
          ...newRealtimeInfo.status,
          compareCancel: true,
        },
        canceledAt: Date.now(),
      });
      const denseJudges = normalizeDenseRealtimeJudges(
        realtimeData?.judges,
        realtimeData?.stageJudgeCount
      );
      if (denseJudges.length > 0) {
        const unlockedJudges = denseJudges.map((j, idx) => ({
          ...j,
          seatIndex: j?.seatIndex ?? idx + 1,
          isEnd: false,
          errors: "",
        }));
        await updateRealtimeCompare.updateData(`currentStage/${contestId}`, {
          judges: unlockedJudges,
        });
      }
      setCompareStatus(() => ({
        ...newRealtimeInfo.status,
        compareCancel: true,
      }));
      if (comparesList?.id) {
        await updateCompare.updateData(comparesList.id, {
          ...comparesList,
          compares: [...nextAllCompares],
        });
      }
      setComparesList((prev) => ({
        ...(prev || {}),
        compares: [...nextAllCompares],
      }));
      setComparesArray(() => [...nextStageCompares]);
      setCurrentCompareInfo(
        nextStageCompares.length > 0
          ? { ...nextStageCompares[nextStageCompares.length - 1] }
          : {}
      );
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
    const categoryListId =
      currentContest?.contests?.contestCategorysListId || "";
    const gradeListId =
      currentContest?.contests?.contestGradesListId || "";

    if (
      noticeId ||
      stageAssignId ||
      playerFinalId ||
      compareListId ||
      judgeAssignId ||
      categoryListId ||
      gradeListId
    ) {
      fetchPool(
        noticeId,
        stageAssignId,
        playerFinalId,
        compareListId,
        judgeAssignId,
        categoryListId,
        gradeListId
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
      (currentStageInfo?.grades?.length > 0 ||
        realtimeData?.stageGrades?.length > 0) &&
      (playersArray?.length > 0 || realtimeData?.hasLiveStageSnapshot)
    ) {
      const effectiveGrades =
        currentStageInfo?.grades?.length > 0
          ? currentStageInfo.grades
          : realtimeData.stageGrades || [];
      const combinedStagePlayers = resolveEffectiveStagePlayers({
        realtimeData,
        fallbackPlayers: playersArray,
        gradeIds: effectiveGrades.map((g) => g?.gradeId).filter(Boolean),
        stageInfo: currentStageInfo,
      });
      setMatchedOriginalPlayers(combinedStagePlayers);
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

  // 현재 스테이지(stageId)와 일치하는 비교심사만 화면에 표시 (comparesList 원본 전체 보존)
  useEffect(() => {
    const currentStageId = realtimeData?.stageId;
    if (!currentStageId) {
      setComparesArray([]);
      setCurrentCompareInfo({});
      return;
    }

    const all = Array.isArray(comparesList?.compares)
      ? comparesList.compares
      : [];
    const filtered = all.filter((c) => c?.stageId === currentStageId);

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
    const activeRealtimeJudges = extractRtdbPlayerArray(realtimeData?.judges);
    if (
      !currentStageInfo?.grades ||
      currentStageInfo.grades.length === 0 ||
      activeRealtimeJudges.length === 0 ||
      rankingSummaryOpen
    ) {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }
      return;
    }

    const assignedSeats = activeRealtimeJudges.filter(
      (j) => Boolean(j?.judgeUid || j?.judgeName || j?.isLogined)
    );
    const judgeSeatsToCheck =
      assignedSeats.length > 0 ? assignedSeats : activeRealtimeJudges;
    const allJudgesSubmitted = judgeSeatsToCheck.every((j) =>
      Boolean(j?.isEnd)
    );
    const isCompareVoting = Boolean(
      realtimeData?.compares?.status?.compareStart
    );

    // 심판들이 채점/재채점/투표 중(isEnd === false)일 때는 DB에 남아 있는 이전 점수로 인해 완료 팝업이 미리 뜨지 않도록 차단
    if (!allJudgesSubmitted || isCompareVoting) {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }
      setUrgentModalOpen(false);
      const savedList = Array.isArray(realtimeData?.resultSaved)
        ? realtimeData.resultSaved
        : [];
      currentStageInfo.grades.forEach((g) => {
        if (g?.gradeId && !savedList.includes(g.gradeId)) {
          hasAlertedRef.current[g.gradeId] = false;
          hasCapturedRef.current[g.gradeId] = false;
        }
      });
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

    const fullyScoredUnconfirmedGrades = unconfirmedGrades.filter((grade) => {
      const filtered = resolveEffectiveStagePlayers({
        realtimeData,
        fallbackPlayers: playersArray,
        gradeIds: grade.gradeId,
        stageInfo: currentStageInfo,
      });

      if (filtered.length === 0) return false;

      const isComplete = filtered.every((player) =>
        judgeSeatsToCheck.every((judge) => {
          const scoreEntry = normalScoreData.find(
            (f) =>
              (!f.gradeId || f.gradeId === grade.gradeId) &&
              String(f.playerNumber) === String(player.playerNumber) &&
              Number(f.seatIndex) === Number(judge.seatIndex)
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

    const fullyScoredUnconfirmedGrade = fullyScoredUnconfirmedGrades[0] || null;

    if (fullyScoredUnconfirmedGrades.length > 0) {
      // 1. 점수 모두 들어왔을 때 자동으로 집계상황 카드 캡처 및 로컬 파일 저장 (통합 무대의 모든 미확정 체급 개별 1회씩)
      fullyScoredUnconfirmedGrades.forEach((doneGrade, idx) => {
        if (!hasCapturedRef.current[doneGrade.gradeId]) {
          hasCapturedRef.current[doneGrade.gradeId] = true;
          setTimeout(() => {
            captureScoreTable(
              doneGrade.gradeId,
              doneGrade.categoryTitle || currentStageInfo?.categoryTitle || "",
              doneGrade.gradeTitle
            );
          }, 500 + idx * 350);
        }
      });

      // 2. 5초 후에도 순위확정을 안 누르면 순위확정 안내 다이얼로그 표시
      if (
        fullyScoredUnconfirmedGrade &&
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
    realtimeData?.compares?.status?.compareStart,
    realtimeData?.resultSaved,
    playersArray,
    rankingSummaryOpen,
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
    const grades =
      currentStageInfo?.grades?.length > 0
        ? currentStageInfo.grades
        : realtimeData?.stageGrades || [];
    if (!grades.length) return 0;
    const gradeIds = grades.map((g) => g?.gradeId).filter(Boolean);
    return resolveEffectiveStagePlayers({
      realtimeData,
      fallbackPlayers: playersArray,
      gradeIds,
      stageInfo: currentStageInfo,
    }).length;
  }, [realtimeData, currentStageInfo, playersArray]);

  // 2개 이상의 체급이 함께 묶인 통합무대 여부 (통합무대에서는 비교심사 비노출)
  const isCombinedStage = useMemo(() => {
    const stageGradesList =
      Array.isArray(currentStageInfo?.grades) &&
      currentStageInfo.grades.length > 0
        ? currentStageInfo.grades
        : Array.isArray(realtimeData?.stageGrades) &&
          realtimeData.stageGrades.length > 0
        ? realtimeData.stageGrades
        : [];
    if (stageGradesList.length > 0) {
      return stageGradesList.length > 1;
    }
    return /\s+통합$/.test(String(realtimeData?.gradeTitle || "").trim());
  }, [
    currentStageInfo?.grades,
    realtimeData?.stageGrades,
    realtimeData?.gradeTitle,
  ]);

  useEffect(() => {
    if (isCombinedStage && compareOpen) {
      setCompareOpen(false);
    }
  }, [isCombinedStage, compareOpen]);

  const emptyJudgeSeatsForDiag = useMemo(() => {
    const realtimeJudges = extractRtdbPlayerArray(realtimeData?.judges);
    const expectedCount =
      Number(realtimeData?.stageJudgeCount) || realtimeJudges.length;
    if (expectedCount > 0 && realtimeJudges.length > 0) {
      return Array.from({ length: expectedCount }, (_, i) => {
        const seatNo = i + 1;
        const matched =
          realtimeJudges.find((j) => Number(j?.seatIndex) === seatNo) ??
          (realtimeJudges[i]?.seatIndex === undefined
            ? realtimeJudges[i]
            : null);
        return !matched?.judgeUid && !matched?.judgeName ? seatNo : null;
      }).filter(Boolean);
    }
    return [];
  }, [realtimeData?.judges, realtimeData?.stageJudgeCount]);

  const judgeSeatGapSummary = useMemo(
    () =>
      summarizeJudgeSeatGaps({
        judges: judgesAssignArray,
        categories: categoriesArray,
        grades: gradesArray,
        stages: stagesArray,
      }),
    [judgesAssignArray, categoriesArray, gradesArray, stagesArray]
  );

  return (
    <>
      {(isLoading || realtimeLoading) && !loadingTimedOut ? (
        <div className="flex w-full min-h-[60vh] justify-center items-center bg-[#fafafa]">
          <LoadingPage propStyles={{ width: "80", height: "60" }} />
        </div>
      ) : (
        <div className="flex flex-col w-full min-h-full bg-[#fafafa] text-[#171717] px-5 sm:px-6 lg:px-8 py-5 gap-4">
          {/* 심판위원장 순위 확정 알림 다이얼로그 */}
          <Modal
            open={urgentModalOpen}
            onClose={() => setUrgentModalOpen(false)}
          >
            <div
              className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-[#171717]/40 backdrop-blur-[2px]"
              style={{ transform: "none" }}
            >
              <div className="w-[min(92vw,500px)] bg-white rounded-[16px] border border-[#171717]/[0.10] shadow-[0_20px_50px_rgba(0,0,0,0.16)] overflow-hidden">
                <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#171717]/[0.08] flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[6px] bg-[#eff6ff] border border-[#bfdbfe] text-[#1d4ed8] text-xs font-bold">
                      <CheckCircle2 size={14} strokeWidth={2.2} />
                      <span>채점 집계 완료</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#171717] leading-snug m-0">
                      전 좌석 채점이 완료되었습니다 — 순위를 확정해 주세요
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUrgentModalOpen(false)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#525252] hover:text-[#171717] transition-colors cursor-pointer"
                    aria-label="닫기"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>

                <div className="p-5 sm:p-6 space-y-4 bg-white">
                  <div className="rounded-[10px] bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 space-y-1">
                    <div className="text-xs font-semibold text-[#64748b]">
                      순위 확정 대기 체급
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {realtimeData?.stageNumber !== undefined && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-[#eff6ff] border border-[#bfdbfe] text-[#1d4ed8] font-mono text-sm font-bold">
                          #{realtimeData.stageNumber}
                        </span>
                      )}
                      <span className="text-base sm:text-lg font-bold text-[#171717]">
                        {urgentGradeInfo?.categoryTitle}
                      </span>
                      <span className="text-sm font-medium text-[#a1a1aa]">
                        /
                      </span>
                      <span className="text-base sm:text-lg font-bold text-[#2563eb]">
                        {urgentGradeInfo?.gradeTitle}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm font-medium text-[#525252] leading-relaxed m-0">
                    모든 심사위원 좌석의 점수가 수신되었습니다. 순위 집계표에서 동점 여부를 확인하고 확정을 완료하면 다음 무대 진행과 공식 결과에 반영됩니다.
                  </p>

                  <div className="flex flex-col sm:flex-row-reverse gap-2.5 pt-1">
                    <button
                      type="button"
                      className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-5 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm sm:text-base transition-colors cursor-pointer"
                      onClick={() => {
                        setUrgentModalOpen(false);
                        setRankingSummaryProp({
                          categoryId: urgentGradeInfo.categoryId,
                          gradeId: urgentGradeInfo.gradeId,
                          categoryJudgeType: "ranking",
                          categoryTitle: urgentGradeInfo.categoryTitle || "",
                          gradeTitle: urgentGradeInfo.gradeTitle || "",
                        });
                        setRankingSummaryOpen(true);
                      }}
                    >
                      <span>순위표 확인 및 확정</span>
                      <ArrowRight size={17} strokeWidth={2.2} />
                    </button>

                    <button
                      type="button"
                      className="inline-flex items-center justify-center h-10 px-4 rounded-[10px] bg-white hover:bg-[#f4f4f5] border border-[#d4d4d8] text-[#525252] font-semibold text-sm transition-colors cursor-pointer"
                      onClick={() => setUrgentModalOpen(false)}
                    >
                      나중에 확인
                    </button>
                  </div>
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
          <Drawer
            anchor="right"
            open={compareOpen}
            onClose={(_, reason) => {
              if (
                (reason === "backdropClick" || reason === "escapeKeyDown") &&
                realtimeData?.compares?.status?.compareStart &&
                !realtimeData?.compares?.status?.compareIng
              ) {
                return;
              }
              setCompareOpen(false);
            }}
            PaperProps={{
              sx: {
                width: { xs: "100vw", sm: "680px", lg: "820px" },
                maxWidth: "100vw",
                backgroundColor: "#fafafa",
              },
            }}
          >
            {compareOpen && !isCombinedStage && (
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
            )}
          </Drawer>
          <Drawer
            anchor="right"
            open={rankingSummaryOpen}
            onClose={() => setRankingSummaryOpen(false)}
            PaperProps={{
              sx: {
                width: { xs: "100vw", xl: "min(92vw, 1320px)" },
                maxWidth: "100vw",
                bgcolor: "#f8fafc",
                boxShadow: "-12px 0 40px rgba(15, 23, 42, 0.14)",
              },
            }}
          >
            <div className="w-full h-full overflow-y-auto outline-none">
              <ContestRankingSummary
                categoryId={rankingSummaryProp?.categoryId}
                gradeId={rankingSummaryProp?.gradeId}
                stageId={realtimeData?.stageId}
                setClose={setRankingSummaryOpen}
                currentResultSaved={realtimeData?.resultSaved}
                expectedJudgeCount={
                  realtimeData?.stageJudgeCount ||
                  extractRtdbPlayerArray(realtimeData?.judges).length ||
                  0
                }
                stagePlayers={resolveEffectiveStagePlayers({
                  realtimeData,
                  fallbackPlayers: playersArray,
                  gradeIds: rankingSummaryProp?.gradeId,
                  stageInfo: currentStageInfo,
                })}
                categoryTitleProp={rankingSummaryProp?.categoryTitle || ""}
                gradeTitleProp={rankingSummaryProp?.gradeTitle || ""}
              />
            </div>
          </Drawer>

          {/* 운영 데이터 점검 및 빠른 보강 바 */}
          <MonitoringDiagnosticsBar
            variant="light"
            screenType="judgeHead"
            contestInfo={contestInfo}
            stagesCount={stagesArray.length}
            playersCount={playersArray.length}
            judgesAssignCount={
              judgeSeatGapSummary.totalExpectedSeats > 0
                ? judgeSeatGapSummary.totalAssignedSeats
                : judgesAssignArray.length
            }
            judgeSeatGapSummary={judgeSeatGapSummary}
            realtimeData={realtimeData}
            currentStagePlayersCount={activeStageMatchedPlayersCount}
            emptyJudgeSeats={emptyJudgeSeatsForDiag}
            onRefreshData={reloadJudgeHeadData}
          />

          {/* 상단 대회 및 현재 진행 무대 요약 카드 */}
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.09] shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-4 py-3.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#525252]">
                  <StatusDot
                    status={realtimeData?.stageId ? "live" : "idle"}
                    live={Boolean(realtimeData?.stageId)}
                  />
                  <span className="text-[#171717]">심판위원장 총괄 집계석</span>
                  {effectiveCollectionName && (
                    <>
                      <span className="text-[#a1a1aa]">·</span>
                      <span className="font-mono text-[#737373]">
                        DB: {effectiveCollectionName}
                      </span>
                    </>
                  )}
                  {lastUpdated && (
                    <>
                      <span className="text-[#a1a1aa]">·</span>
                      <span className="font-mono tabular-nums text-[#737373]">
                        갱신 {lastUpdated}
                      </span>
                    </>
                  )}
                </div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#171717] m-0">
                  {contestInfo.contestTitle ||
                    currentContest?.contests?.contestTitle ||
                    "대회 정보 대기 중"}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 px-3.5 py-2 rounded-[10px] bg-[#eff6ff] border border-[#bfdbfe]">
                <span className="text-xs font-semibold text-[#1d4ed8]">
                  현재 무대
                </span>
                {realtimeData?.stageNumber !== undefined && (
                  <span className="px-2 py-0.5 rounded-[6px] bg-[#2563eb] text-white font-mono text-xs sm:text-sm font-bold tabular-nums">
                    #{realtimeData.stageNumber}
                  </span>
                )}
                <span className="text-sm sm:text-base font-bold text-[#171717]">
                  {realtimeData?.categoryTitle
                    ? `${realtimeData.categoryTitle} / ${
                        realtimeData?.gradeTitle || ""
                      }`
                    : "본부석 무대 시작 대기 중"}
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
              judgesAssignCount={
                judgeSeatGapSummary.totalExpectedSeats > 0
                  ? judgeSeatGapSummary.totalAssignedSeats
                  : judgesAssignArray.length
              }
              judgeSeatGapSummary={judgeSeatGapSummary}
              realtimeData={realtimeData}
              currentStagePlayersCount={activeStageMatchedPlayersCount}
              emptyJudgeSeats={emptyJudgeSeatsForDiag}
              onRefreshData={reloadJudgeHeadData}
            />
          )}

          {/* 비교심사 운영 카드 (단일 체급 무대에서만 표시 · 통합무대에서는 비노출) */}
          {realtimeData?.stageId && !isCombinedStage && (
            <div className="bg-white rounded-[12px] border border-[#171717]/[0.09] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 bg-[#fafafa] border-b border-[#171717]/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-[8px] bg-white border border-[#171717]/[0.10] flex items-center justify-center shrink-0">
                    <SlidersHorizontal
                      size={16}
                      strokeWidth={1.8}
                      className="text-[#2563eb]"
                    />
                  </div>
                  <h2 className="text-[15px] sm:text-base font-bold text-[#171717] m-0">
                    비교심사 운영
                  </h2>
                  {comparesArray?.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] bg-[#eff6ff] border border-[#bfdbfe] text-[#1d4ed8] text-xs font-mono font-bold tabular-nums">
                      {comparesArray.length}회 진행 중
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
                      onClick={() =>
                        setCompareMode((prev) => ({
                          ...prev,
                          compareStart: true,
                        }))
                      }
                      className={`inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] text-xs sm:text-sm font-bold transition-colors bg-[#2563eb] hover:bg-[#1d4ed8] text-white cursor-pointer ${
                        isMobile ? "w-full" : ""
                      }`}
                    >
                      <Play size={14} strokeWidth={2.2} />
                      <span className="tabular-nums">
                        {(comparesArray?.length ?? 0) + 1}차 비교심사 시작
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCompareOpen(true)}
                      className={`inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[8px] text-xs sm:text-sm font-semibold border border-[#d4d4d8] bg-white hover:bg-[#f4f4f5] text-[#171717] transition-colors cursor-pointer ${
                        isMobile ? "w-full" : ""
                      }`}
                    >
                      <Settings size={14} strokeWidth={1.8} className="text-[#525252]" />
                      <span>비교심사 설정 보기</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="px-4 py-3.5">
                {currentCompareInfo?.players?.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5 rounded-[8px] bg-[#eff6ff] border border-[#bfdbfe] text-xs sm:text-sm font-semibold text-[#1e3a8a]">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[5px] bg-[#2563eb] text-white font-bold tabular-nums">
                        <StatusDot status="active" />
                        {currentCompareInfo?.compareIndex}차 비교심사 진행 중
                      </span>
                      {currentCompareInfo?.confirmedBy === "head_authority" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] bg-[#fffbeb] border border-[#fde68a] text-[#b45309] text-xs font-bold">
                          심판위원장 직권확정
                        </span>
                      )}
                      {(currentCompareInfo?.confirmedBy === "tie_break" ||
                        currentCompareInfo?.compareScoreMode === "tieBreak") && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] bg-[#f5f3ff] border border-[#c4b5fd] text-[#6d28d9] text-xs font-bold">
                          동점자 재심사 (
                          {currentCompareInfo?.tieBreakStartRank || 1}~
                          {currentCompareInfo?.tieBreakEndRank ||
                            currentCompareInfo?.comparePlayerLength ||
                            2}
                          위 결정)
                        </span>
                      )}
                      <span className="font-mono tabular-nums">
                        선발 인원: {currentCompareInfo?.comparePlayerLength}명
                      </span>
                      <span>·</span>
                      <span>
                        채점 방식:{" "}
                        {currentCompareInfo?.compareScoreMode === "tieBreak"
                          ? `동점자 전용 (${
                              currentCompareInfo?.tieBreakStartRank || 1
                            }~${
                              currentCompareInfo?.tieBreakEndRank ||
                              currentCompareInfo?.comparePlayerLength ||
                              2
                            }위만 선택)`
                          : currentCompareInfo?.compareScoreMode === "compare" ||
                            currentCompareInfo?.compareScoreMode === "topOnly"
                          ? "비교심사 대상자만 채점"
                          : currentCompareInfo?.compareScoreMode === "topWithSub"
                          ? "이전 차수 선발 인원 전체 채점"
                          : "출전 선수 전원 채점"}
                      </span>
                    </div>

                    {comparesArray?.length > 0 &&
                      comparesArray.map((compare, cIdx) => {
                        const { players, compareIndex, confirmedBy } = compare;

                        return (
                          <div
                            key={cIdx}
                            className="flex flex-col md:flex-row gap-2.5 items-start md:items-center justify-between p-3 rounded-[10px] bg-[#fafafa] border border-[#e4e4e7]"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-1 rounded-[6px] bg-white border border-[#d4d4d8] text-[#171717] text-xs sm:text-sm font-bold mr-0.5 tabular-nums">
                                {compareIndex}차 호명 선수
                              </span>
                              {confirmedBy === "head_authority" && (
                                <span className="px-2 py-0.5 rounded-[5px] bg-[#fffbeb] border border-[#fde68a] text-[#b45309] text-xs font-bold">
                                  직권확정
                                </span>
                              )}
                              {(confirmedBy === "tie_break" ||
                                compare?.compareScoreMode === "tieBreak") && (
                                <span className="px-2 py-0.5 rounded-[5px] bg-[#f5f3ff] border border-[#c4b5fd] text-[#6d28d9] text-xs font-bold tabular-nums">
                                  동점자 재심사 ({compare?.tieBreakStartRank || 1}~
                                  {compare?.tieBreakEndRank ||
                                    players?.length ||
                                    2}
                                  위)
                                </span>
                              )}
                              {players?.map((top, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="inline-flex items-center justify-center min-w-[46px] h-8 px-2.5 rounded-[7px] bg-[#eff6ff] border border-[#93c5fd] text-[#1d4ed8] font-mono tabular-nums text-sm sm:text-base font-bold"
                                >
                                  {top.playerNumber}번
                                </span>
                              ))}
                            </div>

                            {cIdx === comparesArray.length - 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMessage({
                                    variant: "danger",
                                    title: "비교심사 취소 확인",
                                    body: `${compareIndex}차 비교심사를 취소하시겠습니까?`,
                                    body2: "취소 시 진행 중인 비교심사 상태가 해제됩니다.",
                                    isButton: true,
                                    cancelButtonText: "닫기",
                                    confirmButtonText: "비교심사 취소",
                                  });
                                  setCompareCancelMsgOpen(true);
                                }}
                                className="inline-flex items-center gap-1 h-8 px-3 rounded-[7px] border border-[#fca5a5] bg-white hover:bg-[#fef2f2] text-[#dc2626] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                              >
                                <X size={14} strokeWidth={2} />
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
                  <div className="text-sm font-medium text-[#737373] py-0.5">
                    현재 체급에서 진행 중인 비교심사가 없습니다. 필요 시 우측 상단의 비교심사 시작 버튼을 눌러 진행해 주세요.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 실시간 심판 채점 집계상황 매트릭스 */}
          {realtimeData?.stageId && (
            <div className="bg-white rounded-[12px] border border-[#171717]/[0.09] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 px-4 py-3 bg-[#fafafa] border-b border-[#171717]/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-[8px] bg-white border border-[#171717]/[0.10] flex items-center justify-center shrink-0">
                    <Table2
                      size={16}
                      strokeWidth={1.8}
                      className="text-[#2563eb]"
                    />
                  </div>
                  <h2 className="text-[15px] sm:text-base font-bold text-[#171717] m-0">
                    실시간 심판별 채점 현황 · 순위 확정
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleForceUpdate}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#d4d4d8] bg-white hover:bg-[#f4f4f5] text-[#171717] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} strokeWidth={1.8} className="text-[#525252]" />
                  <span>점수 새로고침</span>
                </button>
              </div>

              <div className="p-4 space-y-4">
                {currentStageInfo?.grades?.length > 0 ? (
                  currentStageInfo.grades.map((grade, gIdx) => {
                    const {
                      gradeTitle,
                      gradeId,
                    } = grade;
                    const categoryTitle =
                      grade.categoryTitle ||
                      currentStageInfo?.categoryTitle ||
                      "";
                    const categoryId =
                      grade.categoryId || currentStageInfo?.categoryId || "";

                    const filterdPlayers = resolveEffectiveStagePlayers({
                      realtimeData,
                      fallbackPlayers: playersArray,
                      gradeIds: gradeId,
                      stageInfo: currentStageInfo,
                    });

                    const judges = extractRtdbPlayerArray(realtimeData?.judges);

                    // 좌석별 미채점 여부 및 전체 미채점 칸 수 실시간 계산
                    const missingSeatSet = new Set();
                    let missingCellCount = 0;

                    filterdPlayers.forEach((player) => {
                      judges.forEach((judge) => {
                        const scoreEntry = normalScoreData.find(
                          (f) =>
                            (!f.gradeId || f.gradeId === gradeId) &&
                            String(f.playerNumber) ===
                              String(player.playerNumber) &&
                            Number(f.seatIndex) === Number(judge.seatIndex)
                        );
                        const hasScore =
                          scoreEntry &&
                          scoreEntry.playerScore !== 0 &&
                          scoreEntry.playerScore !== undefined &&
                          scoreEntry.playerScore !== null &&
                          scoreEntry.playerScore !== "";

                        if (!hasScore) {
                          missingSeatSet.add(judge.seatIndex);
                          missingCellCount++;
                        }
                      });
                    });

                    const missingSeatList = Array.from(missingSeatSet).sort(
                      (a, b) => a - b
                    );

                    const isAllScored =
                      filterdPlayers.length > 0 &&
                      judges.length > 0 &&
                      missingCellCount === 0;

                    const savedGrades = Array.isArray(realtimeData?.resultSaved)
                      ? realtimeData.resultSaved
                      : [];
                    const isGradeConfirmed = savedGrades.includes(gradeId);

                    return (
                      <div
                        key={gIdx}
                        id={`score-table-card-${gradeId}`}
                        className="p-4 bg-white rounded-[10px] border border-[#e4e4e7] space-y-3"
                      >
                        {/* 체급 헤더 + 순위 확정 액션 버튼 */}
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                          <div className="space-y-0.5">
                            <div className="text-xs font-medium text-[#737373]">
                              {contestInfo?.contestTitle ||
                                currentContest?.contestInfo?.contestTitle ||
                                currentContest?.contests?.contestTitle ||
                                "대회"}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-[6px] bg-[#f4f4f5] border border-[#d4d4d8] text-[#171717] text-xs sm:text-sm font-bold">
                                {categoryTitle}
                              </span>
                              <span className="text-base sm:text-lg font-bold text-[#171717]">
                                {gradeTitle}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                captureScoreTable(
                                  gradeId,
                                  categoryTitle,
                                  gradeTitle
                                )
                              }
                              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#d4d4d8] bg-white hover:bg-[#f4f4f5] text-[#171717] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                            >
                              <Camera size={15} strokeWidth={1.8} className="text-[#525252]" />
                              <span>집계표 캡처</span>
                            </button>

                            <button
                              type="button"
                              disabled={isGradeConfirmed}
                              onClick={() => {
                                if (!isGradeConfirmed) {
                                  setRankingSummaryProp({
                                    categoryId,
                                    gradeId,
                                    categoryJudgeType: "ranking",
                                    categoryTitle,
                                    gradeTitle,
                                  });
                                  setRankingSummaryOpen(true);
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] text-xs sm:text-sm font-bold transition-colors ${
                                isGradeConfirmed
                                  ? "bg-[#f0fdf4] text-[#15803d] border border-[#86efac] cursor-default"
                                  : isAllScored
                                  ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs cursor-pointer"
                                  : "bg-[#fffbeb] hover:bg-[#fef3c7] text-[#b45309] border border-[#fcd34d] cursor-pointer"
                              }`}
                            >
                              {isGradeConfirmed ? (
                                <>
                                  <Check
                                    size={15}
                                    strokeWidth={2.4}
                                    className="text-[#16a34a]"
                                  />
                                  <span>순위표 확정 완료</span>
                                </>
                              ) : isAllScored ? (
                                <>
                                  <span className="h-2 w-2 rounded-full bg-white" />
                                  <span>순위 집계표 열기 · 확정</span>
                                </>
                              ) : (
                                <span>순위 집계표 보기 (채점 중)</span>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* 상태 안내 배너 */}
                        {isGradeConfirmed ? (
                          <div className="bg-[#f0fdf4] border border-[#86efac] rounded-[8px] px-3.5 py-2.5 flex items-center gap-2.5">
                            <CheckCircle2
                              size={18}
                              strokeWidth={2.2}
                              className="text-[#16a34a] shrink-0"
                            />
                            <div className="text-sm font-bold text-[#15803d]">
                              이 체급의 순위표 확정이 완료되었습니다. (전광판 · 본부석 반영 완료)
                            </div>
                          </div>
                        ) : isAllScored ? (
                          <div className="bg-[#eff6ff] border border-[#93c5fd] rounded-[8px] px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <CheckCircle2
                                size={18}
                                strokeWidth={2.2}
                                className="text-[#2563eb] shrink-0"
                              />
                              <div>
                                <div className="text-sm sm:text-[15px] font-bold text-[#1d4ed8]">
                                  전 심판 채점 완료 — 순위표를 검토하고 확정해 주세요
                                </div>
                                <div className="text-xs sm:text-[13px] font-medium text-[#1e40af]">
                                  우측 상단 [순위 집계표 열기 · 확정] 버튼을 눌러 동점 여부를 확인한 뒤 확정해 주세요.
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : filterdPlayers.length > 0 && judges.length > 0 ? (
                          <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[8px] px-3.5 py-2.5 flex items-start sm:items-center gap-2.5">
                            <AlertTriangle
                              size={18}
                              strokeWidth={2.2}
                              className="text-[#dc2626] shrink-0 mt-0.5 sm:mt-0"
                            />
                            <div>
                              <div className="text-sm sm:text-[15px] font-bold text-[#dc2626]">
                                미제출 심판석:{" "}
                                {missingSeatList.map((s) => `${s}번`).join(", ")} 심판 (미입력 {missingCellCount}칸)
                              </div>
                              <div className="text-xs sm:text-[13px] font-medium text-[#991b1b]">
                                표에 빨간색 [미채점]으로 표시된 좌석의 점수가 모두 제출되면 순위 확정 창이 자동으로 안내됩니다.
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* 채점 매트릭스 테이블 */}
                        <div className="overflow-x-auto rounded-[8px] border border-[#e4e4e7]">
                          <table className="w-full border-collapse text-center">
                            <thead>
                              <tr className="bg-[#f4f4f5] text-[#171717] border-b border-[#d4d4d8]">
                                <th className="sticky left-0 z-10 bg-[#f4f4f5] px-3 py-2.5 text-center text-xs sm:text-sm font-bold text-[#171717] border-r border-[#d4d4d8] whitespace-nowrap w-[100px]">
                                  선수번호
                                </th>
                                {judges.map((judge) => {
                                  const isSeatMissing = missingSeatSet.has(
                                    judge.seatIndex
                                  );
                                  return (
                                    <th
                                      key={`head-judge-${judge.seatIndex}`}
                                      className={`px-2.5 py-2.5 text-center text-xs sm:text-sm font-bold border-r border-[#e4e4e7] last:border-r-0 whitespace-nowrap min-w-[78px] ${
                                        isSeatMissing && !isGradeConfirmed
                                          ? "bg-[#fef2f2] text-[#dc2626]"
                                          : "text-[#3f3f46]"
                                      }`}
                                    >
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="tabular-nums">
                                          {judge.seatIndex}번 심판
                                        </span>
                                        {isSeatMissing && !isGradeConfirmed && (
                                          <span className="px-1.5 py-0.5 rounded-[4px] bg-[#dc2626] text-white text-[10px] font-bold leading-none">
                                            미채점
                                          </span>
                                        )}
                                      </div>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e4e4e7] bg-white">
                              {filterdPlayers.length > 0 ? (
                                filterdPlayers.map((player, pIdx) => (
                                  <tr
                                    key={player.playerUid || pIdx}
                                    className="hover:bg-[#fafafa] transition-colors"
                                  >
                                    <td className="sticky left-0 z-10 bg-[#fafafa] px-3 py-2.5 border-r border-[#d4d4d8] whitespace-nowrap">
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="inline-flex items-center justify-center min-w-[48px] h-8 px-2 rounded-[7px] bg-white border border-[#d4d4d8] text-[#171717] font-mono tabular-nums text-sm sm:text-base font-bold">
                                          {player.playerNumber}
                                        </span>
                                        {player.playerName && (
                                          <span className="text-[11px] font-medium text-[#525252] truncate max-w-[84px]">
                                            {player.playerName}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    {judges.map((judge) => {
                                      const finded = normalScoreData.find(
                                        (f) =>
                                          (!f.gradeId ||
                                            f.gradeId === gradeId) &&
                                          f.playerNumber ===
                                            player.playerNumber &&
                                          f.seatIndex === judge.seatIndex
                                      );

                                      const hasValidScore =
                                        finded?.playerScore !== 0 &&
                                        finded?.playerScore !== undefined &&
                                        finded?.playerScore !== null &&
                                        finded?.playerScore !== "";

                                      if (finded?.playerScore >= 1000) {
                                        return (
                                          <td
                                            key={`cell-${player.playerNumber}-${judge.seatIndex}`}
                                            className="px-2 py-2.5 text-center border-r border-[#e4e4e7] last:border-r-0 bg-[#fafafa] whitespace-nowrap"
                                          >
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] bg-[#f4f4f5] border border-[#d4d4d8] text-[#737373] text-xs font-semibold">
                                              순위제외
                                            </span>
                                          </td>
                                        );
                                      }

                                      if (hasValidScore) {
                                        return (
                                          <td
                                            key={`cell-${player.playerNumber}-${judge.seatIndex}`}
                                            className="px-2.5 py-2.5 text-center border-r border-[#e4e4e7] last:border-r-0 whitespace-nowrap"
                                          >
                                            <span className="font-mono font-bold tabular-nums text-[#171717] text-base sm:text-[17px]">
                                              {finded.playerScore}
                                            </span>
                                          </td>
                                        );
                                      }

                                      return (
                                        <td
                                          key={`cell-${player.playerNumber}-${judge.seatIndex}`}
                                          className="px-2 py-2.5 text-center border-r border-[#e4e4e7] last:border-r-0 bg-[#fef2f2] whitespace-nowrap"
                                        >
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] bg-white border border-[#fca5a5] text-[#dc2626] text-xs font-bold">
                                            미채점
                                          </span>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td
                                    colSpan={Math.max(judges.length + 1, 2)}
                                    className="px-4 py-8 text-center text-sm font-semibold text-[#737373]"
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
                  <div className="text-sm font-semibold text-[#737373] py-5 text-center">
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
