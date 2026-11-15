"use client";

import React, { useContext, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic,
  ArrowLeft,
  Trophy,
  Users,
  Send,
  ArrowDownUp,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import {
  getStagePlayerSortIndex,
  matchedGradewWithPlayers,
} from "../functions/functions";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { dedupeContestResultsByGrade } from "../utils/contestResultsUtils";
import { extractRtdbPlayerArray } from "../utils/liveStageSnapshotUtils";
import {
  isActiveStagePlayer,
  resolveOriginalGradeTitle,
} from "../utils/playerEntryUtils";
import { isNonPlayerUrl } from "../utils/playerPhotoUtils";
import { Spin } from "antd";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { StatusDot } from "../components/ui/BibTag";
import { MonitoringBlockingState } from "../components/monitoring/MonitoringDiagnosticsBar";

const ContestMonitoringHost = ({ contestId }) => {
  const navigate = useNavigate();
  const { currentContest } = useContext(CurrentContestContext);
  const effectiveContestId =
    contestId || currentContest?.contests?.id || currentContest?.id || "";

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/contestmonitoring/main");
    }
  };

  const [stagesArray, setStagesArray] = useState([]);
  const [allFinalPlayers, setAllFinalPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [currentPlayersArray, setCurrentPlayersArray] = useState([]);
  const [contestInfo, setContestInfo] = useState({});
  const [selectedPlayerUid, setSelectedPlayerUid] = useState(null);
  const [calledPlayers, setCalledPlayers] = useState({});
  const [calledCompareNums, setCalledCompareNums] = useState({});

  const fetchResultQuery = useFirestoreQuery();
  const [rankingData, setRankingData] = useState(null);
  const [isRankingView, setIsRankingView] = useState(false);
  const [activeRankingGrade, setActiveRankingGrade] = useState(null);
  const [confirmedResultGradeIds, setConfirmedResultGradeIds] = useState([]);
  const [isReversed, setIsReversed] = useState(true);
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== "undefined"
      ? window.innerWidth > window.innerHeight
      : false
  );

  // 글자 크기 조절 (normal / large / xlarge)
  const [fontScale, setFontScale] = useState("large");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 사회자 비교심사 전용 상태
  const [isCompareView, setIsCompareView] = useState(false);
  const [compareNumbers, setCompareNumbers] = useState([]);
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});

  const openNotice = (nextMsg) => {
    setModalMessage(nextMsg);
    setMsgOpen(true);
  };

  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    effectiveContestId ? `currentStage/${effectiveContestId}` : null
  );

  const updateCurrentStage = useFirebaseRealtimeUpdateData();

  // 실시간 전광판 송출 상태 구독 및 제어
  const { data: broadcastData } = useFirebaseRealtimeGetDocument(
    effectiveContestId ? `currentBroadcast/${effectiveContestId}` : null
  );
  const updateBroadcast = useFirebaseRealtimeUpdateData();

  // 전체 선수 풀에서 playerUid 기준 사진 맵 구축 (무대 사진 우선 + 포스터 URL 제외)
  const uidPhotoMap = useMemo(() => {
    const map = new Map();
    (currentPlayersArray || []).forEach((g) => {
      (g.players || []).forEach((p) => {
        if (p?.playerUid) {
          const list = [
            p.stagePhoto1,
            p.stagePhotoUrl1,
            p.stagePhotoUrl,
            p.stagePhoto2,
            p.stagePhotoUrl2,
            ...(Array.isArray(p.photos) ? p.photos : []),
            ...(Array.isArray(p.playerPhotos) ? p.playerPhotos : []),
            ...(Array.isArray(p.gallery) ? p.gallery : []),
            p.profileImageUrl,
            p.playerPhoto,
            p.photoUrl,
          ].filter(
            (u) =>
              typeof u === "string" &&
              u.trim().length > 5 &&
              !isNonPlayerUrl(u)
          );
          if (list.length > 0) {
            const existing = map.get(p.playerUid) || [];
            map.set(p.playerUid, Array.from(new Set([...existing, ...list])));
          }
        }
      });
    });
    return map;
  }, [currentPlayersArray]);

  const fetchNotice = useFirestoreGetDocument("contest_notice");
  const fetchStages = useFirestoreGetDocument("contest_stages_assign");
  const fetchFinalPlayers = useFirestoreGetDocument("contest_players_final");

  const fetchPool = async (noticeId, stageAssignId, playerFinalId) => {
    try {
      const [returnNotice, returnContestStage, returnPlayersFinal] =
        await Promise.all([
          noticeId ? fetchNotice.getDocument(noticeId) : Promise.resolve(null),
          stageAssignId
            ? fetchStages.getDocument(stageAssignId)
            : Promise.resolve(null),
          playerFinalId
            ? fetchFinalPlayers.getDocument(playerFinalId)
            : Promise.resolve(null),
        ]);

      if (returnNotice) {
        setContestInfo(returnNotice);
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
        const players = [...(returnPlayersFinal.players || [])]
          .filter((f) => isActiveStagePlayer(f))
          .sort(
            (a, b) =>
              getStagePlayerSortIndex(a) - getStagePlayerSortIndex(b)
          );
        setAllFinalPlayers(players);
      } else {
        setAllFinalPlayers([]);
      }
    } catch (error) {
      console.error("데이터 로드 중 에러:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDedupedGradeStanding = async (targetGradeId) => {
    if (!targetGradeId) return [];
    const condition = [
      ...(effectiveContestId
        ? [where("contestId", "==", effectiveContestId)]
        : []),
      where("gradeId", "==", targetGradeId),
    ];
    const data = await fetchResultQuery.getDocuments(
      "contest_results_list",
      condition
    );
    const deduped = dedupeContestResultsByGrade(
      data || [],
      effectiveContestId || null
    );
    const targetDoc =
      deduped.find((d) => d.gradeId === targetGradeId) || deduped[0];
    if (!targetDoc) return [];
    return [...(targetDoc.result || [])].sort(
      (a, b) => Number(a.playerRank) - Number(b.playerRank)
    );
  };

  const handleViewRanking = async (
    gradeId,
    gradeTitle = "",
    categoryTitle = "",
    categoryId = ""
  ) => {
    if (
      isRankingView &&
      (!gradeId ||
        !activeRankingGrade?.gradeId ||
        activeRankingGrade.gradeId === gradeId)
    ) {
      setIsRankingView(false);
      setRankingData(null);
      setActiveRankingGrade(null);
    } else {
      try {
        const standingData = await fetchDedupedGradeStanding(gradeId);

        if (!standingData || standingData.length === 0) {
          setRankingData([]);
          openNotice({
            variant: "warning",
            title: "순위 결과 미등록",
            body: "해당 체급의 확정된 순위 결과가 아직 등록되지 않았습니다.",
            body2: "심판위원장 화면에서 순위표 확정을 먼저 완료해 주세요.",
            isButton: true,
            confirmButtonText: "확인",
          });
          return;
        }

        setRankingData(standingData);
        setActiveRankingGrade({
          gradeId,
          gradeTitle,
          categoryTitle: categoryTitle || realtimeData?.categoryTitle || "",
          categoryId: categoryId || realtimeData?.categoryId || "",
        });
        setIsRankingView(true);
        setIsCompareView(false);
      } catch (error) {
        console.log("에러 발생:", error);
      }
    }
  };

  const handleSendToScreen = async (gradeId, gradeTitle) => {
    try {
      await fetchResultAndScoreBoard(gradeId, gradeTitle);
      openNotice({
        variant: "success",
        title: "전광판 순위 송출 완료",
        body: `'${gradeTitle || "현재 체급"}' 순위 발표 데이터가 전광판에 송출되었습니다.`,
        isButton: true,
        confirmButtonText: "확인",
      });
    } catch (error) {
      openNotice({
        variant: "error",
        title: "전광판 송출 실패",
        body: "스크린으로 순위를 송출하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      console.log("스크린 송출 중 에러:", error);
    }
  };

  const fetchResultAndScoreBoard = async (gradeId, gradeTitle) => {
    if (!effectiveContestId) return;
    try {
      const standingData = await fetchDedupedGradeStanding(gradeId);

      if (!standingData || standingData.length === 0) {
        return;
      }

      const collectionInfo = `currentStage/${effectiveContestId}/screen`;
      const newState = {
        players: [...standingData],
        gradeTitle: gradeTitle,
        status: { playStart: true },
      };
      const broadcastPayload = {
        mode: "RANKING",
        rankingData: [...standingData],
        stageInfo: {
          stageId: realtimeData?.stageId || "",
          stageNumber: realtimeData?.stageNumber || "",
          categoryId: realtimeData?.categoryId || "",
          categoryTitle: realtimeData?.categoryTitle || "",
          gradeId: gradeId || realtimeData?.gradeId || "",
          gradeTitle: gradeTitle || realtimeData?.gradeTitle || "",
        },
        updatedAt: Date.now(),
      };
      await Promise.all([
        updateCurrentStage.updateData(collectionInfo, { ...newState }),
        updateBroadcast.updateData(
          `currentBroadcast/${effectiveContestId}`,
          broadcastPayload
        ),
        updateBroadcast.updateData("currentBroadcast/ACTIVE_STAGE", {
          ...broadcastPayload,
          contestId: effectiveContestId,
          targetContestId: effectiveContestId,
        }),
      ]);
    } catch (error) {
      console.log(error);
    }
  };

  const togglePlayerCalled = (playerUid) => {
    setCalledPlayers((prev) => ({
      ...prev,
      [playerUid]: !prev[playerUid],
    }));
    setSelectedPlayerUid(playerUid);
  };

  const toggleCompareNumCalled = (num) => {
    setCalledCompareNums((prev) => ({
      ...prev,
      [num]: !prev[num],
    }));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const cycleFontSize = () => {
    if (fontScale === "normal") setFontScale("large");
    else if (fontScale === "large") setFontScale("xlarge");
    else setFontScale("normal");
  };

  const reloadHostData = async () => {
    const noticeId =
      currentContest?.contests?.contestNoticeId ||
      currentContest?.contestInfo?.contestNoticeId ||
      "";
    const stageAssignId =
      currentContest?.contests?.contestStagesAssignId || "";
    const playerFinalId =
      currentContest?.contests?.contestPlayersFinalId || "";

    if (noticeId || stageAssignId || playerFinalId) {
      setIsLoading(true);
      await fetchPool(noticeId, stageAssignId, playerFinalId);
    } else {
      setStagesArray([]);
      setAllFinalPlayers([]);
      setCurrentPlayersArray([]);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadHostData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest]);

  // contest_players_final 실시간 동기화 (그랑프리 자동 진출, 불참 변경 등 즉시 반영)
  useEffect(() => {
    const finalDocId = currentContest?.contests?.contestPlayersFinalId || "";
    if (!finalDocId) return undefined;

    const unsub = onSnapshot(
      doc(db, "contest_players_final", finalDocId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (Array.isArray(data?.players)) {
          const players = [...data.players]
            .filter((f) => isActiveStagePlayer(f))
            .sort(
              (a, b) =>
                getStagePlayerSortIndex(a) - getStagePlayerSortIndex(b)
            );
          setAllFinalPlayers(players);
        }
      },
      (err) => {
        console.error("사회자 최종선수 실시간 구독 오류:", err);
      }
    );

    return () => unsub();
  }, [currentContest?.contests?.contestPlayersFinalId]);

  // 확정 순위(contest_results_list) 실시간 구독 — 순위 확정 즉시 버튼 점등 및 무대 재진입 시에도 활성화 유지
  useEffect(() => {
    if (!effectiveContestId) {
      setConfirmedResultGradeIds([]);
      return undefined;
    }

    const q = query(
      collection(db, "contest_results_list"),
      where("contestId", "==", effectiveContestId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const deduped = dedupeContestResultsByGrade(docs, effectiveContestId);
        const readyIds = deduped
          .filter(
            (item) =>
              item?.gradeId &&
              Array.isArray(item?.result) &&
              item.result.length > 0
          )
          .map((item) => item.gradeId);
        setConfirmedResultGradeIds(readyIds);
      },
      (err) => {
        console.error("사회자 확정순위 실시간 구독 오류:", err);
      }
    );

    return () => unsub();
  }, [effectiveContestId]);

  // contest_stages_assign 실시간 동기화 (대회 중 통합무대 병합·분리 변경 시 즉시 반영)
  useEffect(() => {
    const stageAssignId =
      currentContest?.contests?.contestStagesAssignId || "";
    if (!stageAssignId) return undefined;

    const unsub = onSnapshot(
      doc(db, "contest_stages_assign", stageAssignId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (Array.isArray(data?.stages)) {
          setStagesArray(
            [...data.stages].sort(
              (a, b) => (a.stageNumber || 0) - (b.stageNumber || 0)
            )
          );
        }
      },
      (err) => {
        console.error("사회자 무대배정 실시간 구독 오류:", err);
      }
    );

    return () => unsub();
  }, [currentContest?.contests?.contestStagesAssignId]);

  // 현재 진행 무대(stageId) 변경 시 출전 선수 매칭 동기화
  useEffect(() => {
    setCalledPlayers({});
    setCalledCompareNums({});
    setIsRankingView(false);
    setRankingData(null);
    setActiveRankingGrade(null);
  }, [realtimeData?.stageId]);

  useEffect(() => {
    if (!realtimeData?.stageId || !stagesArray.length) {
      setCurrentPlayersArray([]);
      return;
    }
    const currentStage = stagesArray.find(
      (f) => f.stageId === realtimeData.stageId
    );
    const currentStageGrades = currentStage?.grades || [];
    const playerList = currentStageGrades.length
      ? currentStageGrades.map((grade) => ({
          categoryId:
            grade.categoryId ||
            currentStage?.categoryId ||
            realtimeData?.categoryId ||
            "",
          categoryTitle:
            grade.categoryTitle ||
            currentStage?.categoryTitle ||
            realtimeData?.categoryTitle ||
            "",
          gradeTitle: grade.gradeTitle,
          gradeId: grade.gradeId,
          players: matchedGradewWithPlayers(
            effectiveContestId,
            grade.gradeId,
            allFinalPlayers
          ),
        }))
      : [];
    setCurrentPlayersArray(playerList);
  }, [
    realtimeData?.stageId,
    realtimeData?.categoryId,
    realtimeData?.categoryTitle,
    stagesArray,
    allFinalPlayers,
    effectiveContestId,
  ]);

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
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 비교심사 확정 번호 동기화
  useEffect(() => {
    const nums = realtimeData?.compares?.confirmed?.numbers || [];
    setCompareNumbers(Array.isArray(nums) ? nums : []);
    if (!nums || nums.length === 0) {
      setIsCompareView(false);
    } else {
      setIsCompareView(true);
      setIsRankingView(false);
    }
  }, [realtimeData?.compares?.confirmed?.numbers]);

  const activeStageMatchedPlayersCount = useMemo(() => {
    if (!realtimeData?.stageId) return undefined;
    return currentPlayersArray.reduce(
      (acc, g) => acc + (g?.players?.length || 0),
      0
    );
  }, [realtimeData?.stageId, currentPlayersArray]);

  if ((isLoading || realtimeLoading) && !loadingTimedOut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#141415] text-[#ededed] gap-3">
        <Spin size="large" />
        <p className="text-sm font-medium text-[#a1a1a6] m-0">
          사회자 무대 데이터를 불러오는 중
        </p>
      </div>
    );
  }

  if (realtimeError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#141415] p-6">
        <div className="bg-[#19191b] border border-[#e5484d]/40 rounded-[12px] p-6 text-[#ededed] flex items-center gap-3 max-w-md">
          <AlertCircle size={18} strokeWidth={1.5} className="text-[#e5484d] shrink-0" />
          <p className="text-sm font-medium m-0">
            연결 오류: {realtimeError.message}
          </p>
        </div>
      </div>
    );
  }

  const compareStatus = realtimeData?.compares?.status || {};
  const isCompareRunning =
    Boolean(compareStatus?.compareStart) || Boolean(compareStatus?.compareIng);
  const isCompareConfirmed = (compareNumbers?.length || 0) > 0;
  const rtdbSavedGradeIds = extractRtdbPlayerArray(realtimeData?.resultSaved);

  const isGradeResultReady = (gradeId) => {
    if (!gradeId) return false;
    const isTieBreakRunningForGrade =
      Boolean(compareStatus?.isTieBreak) &&
      isCompareRunning &&
      (!realtimeData?.compares?.tieBreakGradeId ||
        realtimeData.compares.tieBreakGradeId === gradeId);
    if (isTieBreakRunningForGrade) return false;
    return (
      rtdbSavedGradeIds.includes(gradeId) ||
      confirmedResultGradeIds.includes(gradeId)
    );
  };

  // 프롬프터 글자 크기 매핑 (소속·성명 대형 시인성 강화)
  const textClasses = {
    normal: {
      playerNum: "text-3xl",
      playerName: "text-2xl",
      playerGym: "text-xl sm:text-2xl",
      playerText: "text-base",
      compareNum: "text-4xl",
    },
    large: {
      playerNum: "text-5xl",
      playerName: "text-3xl sm:text-4xl",
      playerGym: "text-2xl sm:text-3xl",
      playerText: "text-lg",
      compareNum: "text-6xl",
    },
    xlarge: {
      playerNum: "text-6xl sm:text-7xl",
      playerName: "text-4xl sm:text-5xl",
      playerGym: "text-3xl sm:text-4xl",
      playerText: "text-xl sm:text-2xl",
      compareNum: "text-7xl sm:text-8xl",
    },
  }[fontScale];

  const currentBroadcastMode = broadcastData?.mode || "STANDBY";

  const handleSwitchBroadcastMode = async (mode, extraData = {}) => {
    if (!effectiveContestId) {
      openNotice({
        variant: "warning",
        title: "대회 선택 확인 필요",
        body: "대회 정보를 불러올 수 없습니다. 대회를 먼저 선택해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      return;
    }
    try {
      let resolvedExtra = { ...extraData };
      if (mode === "RANKING" && !resolvedExtra.rankingData) {
        const activeGradeId =
          activeRankingGrade?.gradeId ||
          realtimeData?.gradeId ||
          currentPlayersArray[0]?.gradeId ||
          "";
        const activeGradeTitle =
          activeRankingGrade?.gradeTitle ||
          realtimeData?.gradeTitle ||
          currentPlayersArray[0]?.gradeTitle ||
          "";
        const activeCategoryId =
          activeRankingGrade?.categoryId ||
          realtimeData?.categoryId ||
          currentPlayersArray[0]?.categoryId ||
          "";
        const activeCategoryTitle =
          activeRankingGrade?.categoryTitle ||
          realtimeData?.categoryTitle ||
          currentPlayersArray[0]?.categoryTitle ||
          "";
        if (activeGradeId) {
          const standing = await fetchDedupedGradeStanding(activeGradeId);
          if (standing.length > 0) {
            resolvedExtra = {
              ...resolvedExtra,
              rankingData: standing,
              stageInfo: {
                stageId: realtimeData?.stageId || "",
                stageNumber: realtimeData?.stageNumber || "",
                categoryId: activeCategoryId,
                categoryTitle: activeCategoryTitle,
                gradeId: activeGradeId,
                gradeTitle: activeGradeTitle,
              },
            };
          }
        }
      }

      const activeGradeIdForStage =
        activeRankingGrade?.gradeId ||
        realtimeData?.gradeId ||
        currentPlayersArray[0]?.gradeId ||
        "";
      const activeGradeTitleForStage =
        activeRankingGrade?.gradeTitle ||
        realtimeData?.gradeTitle ||
        currentPlayersArray[0]?.gradeTitle ||
        "";
      const activeCategoryIdForStage =
        activeRankingGrade?.categoryId ||
        realtimeData?.categoryId ||
        currentPlayersArray[0]?.categoryId ||
        "";
      const activeCategoryTitleForStage =
        activeRankingGrade?.categoryTitle ||
        realtimeData?.categoryTitle ||
        currentPlayersArray[0]?.categoryTitle ||
        "";
      const defaultStageInfo = {
        stageId: realtimeData?.stageId || "",
        stageNumber: realtimeData?.stageNumber || "",
        categoryId: activeCategoryIdForStage,
        categoryTitle: activeCategoryTitleForStage,
        gradeId: activeGradeIdForStage,
        gradeTitle: activeGradeTitleForStage,
        players: (currentPlayersArray || []).flatMap((g) => g.players || []),
      };

      const payload = {
        mode,
        stageInfo: resolvedExtra.stageInfo || defaultStageInfo,
        updatedAt: Date.now(),
        ...resolvedExtra,
      };
      await Promise.all([
        updateBroadcast.updateData(
          `currentBroadcast/${effectiveContestId}`,
          payload
        ),
        updateBroadcast.updateData("currentBroadcast/ACTIVE_STAGE", {
          ...payload,
          contestId: effectiveContestId,
          targetContestId: effectiveContestId,
        }),
      ]);
    } catch (error) {
      console.error("방송 모드 전환 실패:", error);
      openNotice({
        variant: "error",
        title: "전광판 전환 실패",
        body: "전광판 송출 모드를 전환하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  const handleIntroPlayerToScreen = (player, gradeContext = null) => {
    const uidPhotos =
      (player.playerUid && uidPhotoMap.get(player.playerUid)) || [];
    const directPhotos = [
      player.stagePhoto1,
      player.stagePhotoUrl1,
      player.stagePhotoUrl,
      player.stagePhoto2,
      player.stagePhotoUrl2,
      ...(Array.isArray(player.photos) ? player.photos : []),
      ...(Array.isArray(player.playerPhotos) ? player.playerPhotos : []),
      player.profileImageUrl,
      player.playerPhoto,
      player.photoUrl,
    ].filter(
      (u) => typeof u === "string" && u.trim().length > 5 && !isNonPlayerUrl(u)
    );

    const allPhotos = Array.from(new Set([...directPhotos, ...uidPhotos]));

    let stage1 =
      (!isNonPlayerUrl(player.stagePhoto1) && player.stagePhoto1) ||
      (!isNonPlayerUrl(player.stagePhotoUrl1) && player.stagePhotoUrl1) ||
      "";
    let stage2 =
      (!isNonPlayerUrl(player.stagePhoto2) && player.stagePhoto2) ||
      (!isNonPlayerUrl(player.stagePhotoUrl2) && player.stagePhotoUrl2) ||
      (!isNonPlayerUrl(player.backgroundPhotoUrl) &&
        player.backgroundPhotoUrl) ||
      "";

    if (!stage1 && allPhotos.length > 0) stage1 = allPhotos[0];
    if (!stage2 && allPhotos.length > 1) stage2 = allPhotos[1];

    const primary =
      stage1 ||
      allPhotos[0] ||
      (!isNonPlayerUrl(player.profileImageUrl) && player.profileImageUrl) ||
      (!isNonPlayerUrl(player.playerPhoto) && player.playerPhoto) ||
      "";

    const origWonGradeTitle = resolveOriginalGradeTitle(player);

    const playerObj = {
      playerUid: player.playerUid || "",
      playerNumber: player.playerNumber ?? "",
      playerName: player.playerName || "",
      playerGym: player.playerGym || "",
      heightWeight: player.heightWeight || "",
      playerHeight: player.playerHeight || player.height || "",
      playerWeight: player.playerWeight || player.weight || "",
      stagePhoto1: stage1,
      stagePhoto2: stage2,
      stagePhotoUrl1: stage1,
      stagePhotoUrl2: stage2,
      stagePhotoUrl: primary,
      backgroundPhotoUrl: stage2,
      profileImageUrl: primary,
      photoUrl: primary,
      playerMotivation: player.playerMotivation || player.playerText || "",
      photos: allPhotos,
      ...(origWonGradeTitle ? { originalGradeTitle: origWonGradeTitle } : {}),
    };

    const customStageInfo = gradeContext
      ? {
          stageId: realtimeData?.stageId || "",
          stageNumber: realtimeData?.stageNumber || "",
          categoryId:
            gradeContext.categoryId || realtimeData?.categoryId || "",
          categoryTitle:
            gradeContext.categoryTitle || realtimeData?.categoryTitle || "",
          gradeId: gradeContext.gradeId || realtimeData?.gradeId || "",
          gradeTitle:
            gradeContext.gradeTitle || realtimeData?.gradeTitle || "",
          players: gradeContext.players || [],
        }
      : undefined;

    handleSwitchBroadcastMode("ATHLETE_INTRO", {
      activePlayer: playerObj,
      player: playerObj,
      ...(customStageInfo ? { stageInfo: customStageInfo } : {}),
    });
  };

  const modeLabelMap = {
    STANDBY: "대기 및 종목 안내",
    ATHLETE_INTRO: "선수 단독 소개 중",
    COMPARISON_CALLOUT: "비교심사 호명 중",
    POSEDOWN: "포즈다운 배틀 중",
    COMMERCIAL: "점수 집계 중",
    RANKING: "순위 발표 중",
    CHAMPION_SHOWCASE: "1위 챔피언 세레모니",
  };

  const broadcastLabel =
    modeLabelMap[currentBroadcastMode] || currentBroadcastMode;

  const triggerChampionShowcase = async (explicitPlayer = null) => {
    const validExplicit =
      explicitPlayer &&
      typeof explicitPlayer === "object" &&
      ("playerNumber" in explicitPlayer || "playerName" in explicitPlayer)
        ? explicitPlayer
        : null;

    let confirmed1st = validExplicit;

    if (!confirmed1st && Array.isArray(rankingData) && rankingData.length > 0) {
      confirmed1st =
        rankingData.find((p) => Number(p?.playerRank ?? p?.rank) === 1) || null;
    }

    if (!confirmed1st) {
      const activeGradeId =
        activeRankingGrade?.gradeId ||
        realtimeData?.gradeId ||
        currentPlayersArray[0]?.gradeId ||
        "";
      if (activeGradeId) {
        try {
          const standing = await fetchDedupedGradeStanding(activeGradeId);
          confirmed1st =
            standing.find((p) => Number(p?.playerRank ?? p?.rank) === 1) ||
            null;
        } catch (err) {
          console.error("1위 우승자 조회 실패:", err);
        }
      }
    }

    if (!confirmed1st) {
      openNotice({
        variant: "warning",
        title: "1위 확정 결과 없음",
        body: "현재 체급의 확정된 1위 우승자 결과가 아직 등록되지 않았습니다.",
        body2: "심판위원장 화면에서 순위표 확정을 완료한 뒤 다시 시도해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      return;
    }

    const uidPhotos =
      (confirmed1st.playerUid && uidPhotoMap.get(confirmed1st.playerUid)) || [];
    const directPhotos = [
      confirmed1st.stagePhoto1,
      confirmed1st.stagePhotoUrl1,
      confirmed1st.stagePhotoUrl,
      confirmed1st.stagePhoto2,
      confirmed1st.stagePhotoUrl2,
      ...(Array.isArray(confirmed1st.photos) ? confirmed1st.photos : []),
      ...(Array.isArray(confirmed1st.playerPhotos)
        ? confirmed1st.playerPhotos
        : []),
      confirmed1st.profileImageUrl,
      confirmed1st.playerPhoto,
      confirmed1st.photoUrl,
    ].filter(
      (u) => typeof u === "string" && u.trim().length > 5 && !isNonPlayerUrl(u)
    );

    const allPhotos = Array.from(new Set([...directPhotos, ...uidPhotos]));
    const stage1 =
      (!isNonPlayerUrl(confirmed1st.stagePhoto1) && confirmed1st.stagePhoto1) ||
      (!isNonPlayerUrl(confirmed1st.stagePhotoUrl1) &&
        confirmed1st.stagePhotoUrl1) ||
      allPhotos[0] ||
      "";
    const stage2 =
      (!isNonPlayerUrl(confirmed1st.stagePhoto2) && confirmed1st.stagePhoto2) ||
      (!isNonPlayerUrl(confirmed1st.stagePhotoUrl2) &&
        confirmed1st.stagePhotoUrl2) ||
      allPhotos[1] ||
      stage1 ||
      "";
    const primary =
      stage1 ||
      allPhotos[0] ||
      (!isNonPlayerUrl(confirmed1st.profileImageUrl) &&
        confirmed1st.profileImageUrl) ||
      (!isNonPlayerUrl(confirmed1st.playerPhoto) && confirmed1st.playerPhoto) ||
      "";

    const topPlayerObj = {
      ...confirmed1st,
      stagePhoto1: stage1,
      stagePhoto2: stage2,
      stagePhotoUrl1: stage1,
      stagePhotoUrl2: stage2,
      stagePhotoUrl: primary,
      profileImageUrl: primary,
      photoUrl: primary,
      photos: allPhotos,
    };

    handleSwitchBroadcastMode("CHAMPION_SHOWCASE", {
      topPlayer: topPlayerObj,
    });
  };

  return (
    <div
      className={`w-full bg-[#141415] text-[#ededed] flex flex-col select-none ${
        isLandscape ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh]"
      }`}
    >
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />

      {/* 메인 바디 영역 (상단 헤더 전면 제거 — 뒤로가기만 유지하여 프롬프터 화면 극대화) */}
      <div
        className={`flex-1 flex ${
          isLandscape ? "flex-row overflow-hidden" : "flex-col"
        } p-3 gap-3`}
      >
        {/* 좌측 패널 (현재 무대 및 상태 제어) */}
        <div
          className={
            isLandscape
              ? "w-[336px] lg:w-[376px] flex flex-col gap-3 shrink-0 overflow-y-auto pr-1"
              : "w-full flex flex-col gap-3"
          }
        >
          {/* 현재 진행 중인 무대 카드 (상단 좌측 뒤로가기 버튼 통합 + 종목·체급 초대형 시인성) */}
          <div className="bg-[#19191b] rounded-[14px] border border-[#fbbf24]/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleGoBack}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#232325] hover:bg-[#2c2c2f] border border-[#ededed]/[0.14] text-xs sm:text-sm font-semibold text-[#ededed] transition-colors active:scale-[0.98] cursor-pointer"
              >
                <ArrowLeft size={16} strokeWidth={2} />
                <span>뒤로가기</span>
              </button>
              {realtimeData?.stageNumber && (
                <span className="inline-flex items-center px-3 py-1 rounded-[6px] bg-[#fbbf24]/15 border border-[#fbbf24]/35 text-sm font-bold text-[#fbbf24] tabular-nums">
                  제 {realtimeData.stageNumber} 무대
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-2xl sm:text-3xl lg:text-[32px] font-extrabold text-[#ffffff] leading-tight tracking-tight">
                {realtimeData?.categoryTitle || "진행 종목 없음"}
              </div>
              <div className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-[#fbbf24] leading-snug">
                {realtimeData?.gradeTitle || "대기 중"}
              </div>
            </div>
          </div>

          {/* 비교심사 진행 상태 알림 */}
          {isCompareRunning && !isCompareConfirmed && (
            <div className="bg-[#19191b] border border-[#2563eb]/40 rounded-[12px] p-4 flex items-start gap-3">
              <div className="mt-1">
                <StatusDot status="active" live />
              </div>
              <div>
                <div className="text-sm font-medium text-[#ededed]">
                  비교심사 투표 진행 중
                </div>
                <div className="text-xs text-[#a1a1a6] mt-1">
                  심사위원 선발 집계가 완료되면 호명 명단이 활성화됩니다
                </div>
              </div>
            </div>
          )}

          {isCompareConfirmed && (
            <button
              type="button"
              onClick={() => {
                setIsCompareView((prev) => !prev);
                setIsRankingView(false);
              }}
              className={`w-full p-4 rounded-[12px] text-left transition-colors active:scale-[0.98] cursor-pointer border ${
                isCompareView
                  ? "bg-[#2563eb] text-white border-[#2563eb]"
                  : "bg-[#19191b] hover:bg-[#232325] text-[#ededed] border-[#4cc38a]/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users
                    size={16}
                    strokeWidth={1.5}
                    className={isCompareView ? "text-white" : "text-[#4cc38a]"}
                  />
                  <span className="text-base font-semibold">
                    비교심사 선수 호명
                  </span>
                </div>
                <span
                  className={`font-mono tabular-nums text-xs px-2 py-0.5 rounded-[4px] ${
                    isCompareView
                      ? "bg-white/20 text-white"
                      : "bg-[#4cc38a]/15 text-[#4cc38a]"
                  }`}
                >
                  {compareNumbers.length}명 선발
                </span>
              </div>
              <div
                className={`text-xs mt-1.5 ${
                  isCompareView ? "text-white/80" : "text-[#a1a1a6]"
                }`}
              >
                {isCompareView
                  ? "호명 화면 표시 중 · 누르면 참가 명단으로 전환"
                  : "누르면 대형 번호판 호명 화면으로 전환"}
              </div>
            </button>
          )}

          {/* 체급별 순위 확인 및 전광판 송출 버튼 (미확정 시 톤 다운 / 확정 즉시 고채도 점등) */}
          {currentPlayersArray.length > 0 &&
            currentPlayersArray.map((current, cIdx) => {
              const isSaved = isGradeResultReady(current.gradeId);
              const isThisGradeRankingOpen =
                isRankingView &&
                (!activeRankingGrade?.gradeId ||
                  activeRankingGrade.gradeId === current.gradeId);

              return (
                <div
                  key={cIdx}
                  className={`rounded-[14px] p-4 space-y-3 transition-all ${
                    isSaved
                      ? "bg-gradient-to-b from-[#2a2208] to-[#181409] border-2 border-[#fbbf24] shadow-[0_0_28px_rgba(251,191,36,0.28)]"
                      : "bg-[#161618] border border-[#242428]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-base sm:text-lg font-bold ${
                        isSaved ? "text-[#fef08a]" : "text-[#71717a]"
                      }`}
                    >
                      {currentPlayersArray.length > 1
                        ? `${current.gradeTitle} 발표 제어`
                        : "순위 발표 제어"}
                    </span>
                    {isSaved ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#4cc38a]/20 border border-[#4cc38a]/50 text-[#4cc38a] text-xs font-bold shrink-0">
                        <span className="w-2 h-2 rounded-full bg-[#4cc38a] animate-pulse" />
                        <span>발표 가능</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#1f1f23] text-[#52525b] text-xs font-medium shrink-0">
                        집계 대기
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleViewRanking(
                        current.gradeId,
                        current.gradeTitle,
                        current.categoryTitle,
                        current.categoryId
                      )
                    }
                    className={`w-full min-h-[76px] py-4 px-5 rounded-[12px] font-extrabold text-lg sm:text-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer border ${
                      isThisGradeRankingOpen
                        ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white border-[#60a5fa] shadow-lg"
                        : isSaved
                        ? "bg-gradient-to-r from-[#f59e0b] via-[#fbbf24] to-[#fde047] hover:brightness-105 text-[#09090b] border-2 border-[#fef9c3] shadow-[0_0_24px_rgba(251,191,36,0.5)] ring-2 ring-[#fbbf24]/45"
                        : "bg-[#1d1d20] hover:bg-[#232327] text-[#52525b] border-[#2a2a2e] opacity-70"
                    }`}
                  >
                    {isThisGradeRankingOpen ? (
                      <>
                        <Users size={22} strokeWidth={2.2} />
                        <span>참가 선수 명단으로 돌아가기</span>
                      </>
                    ) : isSaved ? (
                      <>
                        <Trophy
                          size={26}
                          strokeWidth={2.3}
                          className="text-[#09090b] shrink-0"
                        />
                        <div className="flex flex-col items-start leading-tight text-left">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-[#09090b]/75">
                            순위 확정 완료 · 터치하여 열기
                          </span>
                          <span className="text-lg sm:text-xl font-extrabold">
                            순위 결과 확인 · 발표 열기
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <Trophy
                          size={20}
                          strokeWidth={1.6}
                          className="text-[#52525b] shrink-0"
                        />
                        <span className="font-semibold text-base sm:text-lg">
                          순위 집계 대기 중 (미확정)
                        </span>
                      </>
                    )}
                  </button>

                  {isSaved && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSendToScreen(current.gradeId, current.gradeTitle)
                      }
                      className="w-full min-h-[54px] py-3 px-4 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-base flex items-center justify-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer shadow-md"
                    >
                      <Send size={18} strokeWidth={2} />
                      <span>전광판 순위 화면 송출</span>
                    </button>
                  )}
                </div>
              );
            })}
        </div>

        {/* 우측 메인 프롬프터 뷰 */}
        <main className="flex-1 bg-[#19191b] rounded-[12px] border border-[#ededed]/[0.08] flex flex-col overflow-hidden">
          {/* 프롬프터 상단 바 (종목·체급 중복 표기 제거 — 깔끔한 단일 모드 헤더) */}
          <div className="bg-[#0f0f10] border-b border-[#ededed]/[0.08] px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {isCompareView && compareNumbers.length > 0 ? (
                <Users size={18} strokeWidth={1.8} className="text-[#4cc38a]" />
              ) : isRankingView ? (
                <Trophy size={18} strokeWidth={1.8} className="text-[#fbbf24]" />
              ) : (
                <Mic size={18} strokeWidth={1.8} className="text-[#a1a1aa]" />
              )}
              <h2 className="text-base sm:text-lg font-bold text-[#ededed] m-0">
                {isCompareView && compareNumbers.length > 0
                  ? "비교심사 호명 대상 번호판"
                  : isRankingView
                  ? `${
                      currentPlayersArray.length > 1 &&
                      activeRankingGrade?.gradeTitle
                        ? `[${activeRankingGrade.gradeTitle}] `
                        : ""
                    }시상식 순위 발표 프롬프터`
                  : "참가 선수 호명 프롬프터"}
              </h2>
              {!isCompareView &&
                !isRankingView &&
                typeof activeStageMatchedPlayersCount === "number" && (
                  <span className="font-mono tabular-nums text-xs sm:text-sm font-semibold text-[#a1a1aa] bg-[#1d1d20] px-2.5 py-0.5 rounded-[6px] border border-[#2c2c30]">
                    출전 {activeStageMatchedPlayersCount}명
                  </span>
                )}
            </div>

            {isRankingView && (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsReversed((prev) => !prev)}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[10px] bg-[#232325] hover:bg-[#2c2c2f] border border-[#ededed]/[0.15] text-[#ededed] font-semibold text-sm sm:text-base transition-colors active:scale-[0.98] cursor-pointer"
                >
                  <ArrowDownUp
                    size={18}
                    strokeWidth={1.8}
                    className="text-[#fbbf24]"
                  />
                  <span>
                    {isReversed
                      ? "역순 발표 (하위 → 1위)"
                      : "정순 발표 (1위 → 하위)"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRankingView(false);
                    setRankingData(null);
                    setActiveRankingGrade(null);
                  }}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm sm:text-base transition-colors active:scale-[0.98] cursor-pointer"
                >
                  <Users size={18} strokeWidth={1.8} />
                  <span>선수 명단으로 돌아가기</span>
                </button>
              </div>
            )}
          </div>

          {/* 스크롤 가능한 프롬프터 본문 */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {/* 1. 비교심사 확정 명단 뷰 */}
            {isCompareView && compareNumbers.length > 0 ? (
              <div className="space-y-4">
                <div className="px-4 py-2.5 bg-[#232325] border border-[#ededed]/[0.08] rounded-[8px] text-xs text-[#a1a1a6]">
                  선수 번호를 순서대로 호명하고 터치하여 완료 표시하세요
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {compareNumbers.map((num, cNumIdx) => {
                    const isCalled = calledCompareNums[num];
                    const matchedCalloutPlayer =
                      currentPlayersArray
                        .flatMap((g) => g.players || [])
                        .find(
                          (p) => String(p?.playerNumber) === String(num)
                        ) || null;
                    return (
                      <button
                        type="button"
                        key={num}
                        onClick={() => toggleCompareNumCalled(num)}
                        className={`p-5 rounded-[12px] text-center cursor-pointer transition-colors active:scale-[0.98] border flex flex-col items-center justify-center gap-2 ${
                          isCalled
                            ? "bg-[#141415] border-[#ededed]/[0.06] opacity-50"
                            : "bg-[#232325] hover:bg-[#2c2c2f] border-[#fbbf24]/50"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full text-[11px] text-[#85858b] px-1">
                          <span>{cNumIdx + 1}번째 호명</span>
                          <span className="font-semibold text-[#fbbf24]">
                            선수번호
                          </span>
                        </div>
                        <div
                          className={`font-mono tabular-nums font-bold leading-none py-1 ${
                            textClasses.compareNum
                          } ${
                            isCalled
                              ? "text-[#85858b] line-through"
                              : "text-[#fbbf24]"
                          }`}
                        >
                          {num}번
                        </div>
                        {matchedCalloutPlayer?.playerName && (
                          <div className="text-sm font-semibold text-[#ededed] truncate max-w-full">
                            {matchedCalloutPlayer.playerName}
                          </div>
                        )}
                        <div className="flex items-center justify-center gap-1.5">
                          {isCalled ? (
                            <span className="text-xs font-medium text-[#4cc38a] inline-flex items-center gap-1">
                              <Check size={14} strokeWidth={1.5} />
                              <span>호명 완료</span>
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-[#a1a1a6]">
                              터치하여 완료
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : isRankingView && rankingData ? (
              /* 2. 순위 발표 뷰 */
              <div className="space-y-3">
                {(isReversed ? [...rankingData].reverse() : rankingData)
                  .filter((player) => player.playerRank < 1000)
                  .map((player) => {
                    const rank = player.playerRank;
                    const isSelected = selectedPlayerUid === player.playerUid;
                    const isFirst = rank === 1;

                    return (
                      <div
                        key={player.playerUid}
                        onClick={() => setSelectedPlayerUid(player.playerUid)}
                        className={`p-4 sm:p-5 rounded-[12px] cursor-pointer transition-colors border ${
                          isSelected
                            ? "bg-[#232325] border-[#2563eb]"
                            : isFirst
                            ? "bg-[#232325] border-[#ededed]/20"
                            : "bg-[#141415] hover:bg-[#232325] border-[#ededed]/[0.08]"
                        }`}
                      >
                        <div className="flex items-center gap-4 sm:gap-6">
                          <div
                            className={`min-w-[96px] sm:min-w-[116px] px-3 py-2.5 rounded-[8px] text-center border font-mono tabular-nums ${
                              isFirst
                                ? "bg-[#2563eb] text-white border-[#2563eb]"
                                : "bg-[#19191b] text-[#ededed] border-[#ededed]/[0.1]"
                            }`}
                          >
                            <span className="text-[11px] block opacity-80 mb-0.5">
                              최종 순위
                            </span>
                            <span className="text-lg sm:text-xl font-semibold">
                              {rank}위
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#141415] border border-[#fbbf24]/40">
                                <span className="text-xs font-medium text-[#a1a1a6]">
                                  선수번호
                                </span>
                                <span
                                  className={`font-mono tabular-nums font-bold text-[#fbbf24] leading-none ${textClasses.playerNum}`}
                                >
                                  {player.playerNumber}번
                                </span>
                              </span>
                              <span
                                className={`font-semibold text-[#ededed] ${textClasses.playerName}`}
                              >
                                {player.playerName}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-2.5 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] bg-[#27272a] border border-[#3f3f46] text-xs font-semibold text-[#a1a1aa]">
                                소속
                              </span>
                              <span
                                className={`font-semibold text-[#f4f4f5] leading-snug ${textClasses.playerGym}`}
                              >
                                {player.playerGym || "무소속"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : currentPlayersArray.length > 0 &&
              activeStageMatchedPlayersCount > 0 ? (
              /* 3. 참가 선수 명단 및 멘트 프롬프터 (단일 체급 시 중복 배너 제거, 통합 무대 시에만 체급 구분선 표시) */
              currentPlayersArray.map((current, cIdx) => (
                <div key={cIdx} className="space-y-3 pb-3">
                  {currentPlayersArray.length > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-[10px] bg-[#202024] border border-[#ededed]/[0.12] border-l-4 border-l-[#fbbf24]">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        {current.categoryTitle &&
                          current.categoryTitle !==
                            realtimeData?.categoryTitle && (
                            <span className="text-base sm:text-lg font-bold text-[#e4e4e7]">
                              {current.categoryTitle}
                            </span>
                          )}
                        <h3 className="text-xl sm:text-2xl font-extrabold text-[#fbbf24] m-0 leading-tight">
                          {current.gradeTitle}
                        </h3>
                      </div>
                      <span className="font-mono tabular-nums text-xs sm:text-sm font-bold text-[#ededed] bg-[#141415] px-2.5 py-1 rounded-[6px] border border-[#ededed]/[0.1]">
                        출전 {current.players.length}명
                      </span>
                    </div>
                  )}

                  {current.players.length > 0 ? (
                    <div className="space-y-3">
                      {current.players.map((player, pIdx) => {
                        const callKey =
                          player.playerUid || `num_${player.playerNumber}`;
                        const isCalled = calledPlayers[callKey];
                        const isSelected = selectedPlayerUid === callKey;

                        return (
                          <div
                            key={callKey || `${player.playerNumber}-${pIdx}`}
                            onClick={() => {
                              togglePlayerCalled(callKey);
                              handleIntroPlayerToScreen(player, current);
                            }}
                            className={`p-4 sm:p-5 rounded-[12px] cursor-pointer transition-colors border active:scale-[0.99] ${
                              isCalled
                                ? "bg-[#232325] border-[#4cc38a]/50"
                                : isSelected
                                ? "bg-[#232325] border-[#2563eb]"
                                : "bg-[#141415] hover:bg-[#232325] border-[#ededed]/[0.08]"
                            }`}
                          >
                            <div className="flex items-start gap-4 sm:gap-5">
                              {/* 호명할 선수번호 전용 대형 박스 (연번과 절대 혼동되지 않도록 한글 라벨 + '번' 명시) */}
                              <div
                                className={`min-w-[104px] sm:min-w-[122px] px-3 py-2.5 rounded-[10px] border flex flex-col items-center justify-center shrink-0 ${
                                  isCalled
                                    ? "bg-[#4cc38a]/15 border-[#4cc38a]/50 text-[#4cc38a]"
                                    : "bg-[#0f0f10] border-[#fbbf24]/45 text-[#fbbf24]"
                                }`}
                              >
                                <span
                                  className={`text-[11px] font-semibold tracking-wide mb-1 ${
                                    isCalled ? "text-[#4cc38a]" : "text-[#d4d4d8]"
                                  }`}
                                >
                                  호명 선수번호
                                </span>
                                <span
                                  className={`font-mono tabular-nums font-bold leading-none ${textClasses.playerNum}`}
                                >
                                  {player.playerNumber}번
                                </span>
                              </div>

                              {/* 선수 이름, 소속, 입장 순서(보조 표기), 출전 동기 */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div className="space-y-1.5 min-w-0">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <span
                                        className={`font-bold text-[#ffffff] leading-tight ${textClasses.playerName}`}
                                      >
                                        {player.playerName}
                                      </span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#232325] border border-[#ededed]/[0.08] text-xs font-normal text-[#85858b]">
                                        입장순서 {pIdx + 1}번째
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] bg-[#27272a] border border-[#3f3f46] text-xs font-semibold text-[#a1a1aa]">
                                        소속
                                      </span>
                                      <span
                                        className={`font-semibold text-[#e4e4e7] leading-snug ${textClasses.playerGym}`}
                                      >
                                        {player.playerGym || "무소속"}
                                      </span>
                                    </div>
                                  </div>

                                  {isCalled ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4cc38a] bg-[#4cc38a]/10 px-2.5 py-1 rounded-[6px] border border-[#4cc38a]/30">
                                      <Check size={14} strokeWidth={1.5} />
                                      <span>전광판 소개됨</span>
                                    </span>
                                  ) : (
                                    <span className="text-xs text-[#85858b] bg-[#19191b] px-2.5 py-1 rounded-[6px] border border-[#ededed]/[0.08]">
                                      터치하여 전광판 소개
                                    </span>
                                  )}
                                </div>

                                {(player.playerText ||
                                  player.playerMotivation) && (
                                  <div className="mt-3 p-3.5 rounded-[8px] bg-[#0f0f10] border-l-2 border-[#2563eb] text-[#ededed]">
                                    <div className="text-xs font-medium text-[#85858b] mb-1">
                                      출전 동기 및 소개 멘트
                                    </div>
                                    <div
                                      className={`${textClasses.playerText} leading-relaxed whitespace-pre-wrap text-[#ededed]`}
                                    >
                                      {player.playerText ||
                                        player.playerMotivation}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-sm text-[#85858b]">
                      배정된 참가 선수가 없습니다
                    </div>
                  )}
                </div>
              ))
            ) : (
              <MonitoringBlockingState
                variant="dark"
                screenType="host"
                screenLabel="사회자 호명 프롬프터"
                contestInfo={contestInfo}
                stagesCount={stagesArray.length}
                playersCount={allFinalPlayers.length}
                realtimeData={realtimeData}
                currentStagePlayersCount={activeStageMatchedPlayersCount}
                onRefreshData={reloadHostData}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ContestMonitoringHost;
