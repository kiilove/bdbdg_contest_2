"use client";

import React, { useContext, useEffect, useState, useMemo } from "react";
import {
  Mic,
  Type,
  Maximize2,
  Minimize2,
  Monitor,
  Timer,
  BarChart3,
  Trophy,
  Award,
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
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { matchedGradewWithPlayers } from "../functions/functions";
import { Spin } from "antd";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { BibTag, StatusDot } from "../components/ui/BibTag";
import {
  MonitoringBlockingState,
  MonitoringDiagnosticsBar,
} from "../components/monitoring/MonitoringDiagnosticsBar";

const ContestMonitoringHost = ({ contestId }) => {
  const { currentContest } = useContext(CurrentContestContext);
  const effectiveContestId =
    contestId || currentContest?.contests?.id || currentContest?.id || "";

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

  // 전체 선수 풀에서 playerUid 기준 사진 맵 구축
  const uidPhotoMap = useMemo(() => {
    const map = new Map();
    (currentPlayersArray || []).forEach((g) => {
      (g.players || []).forEach((p) => {
        if (p?.playerUid) {
          const list = [
            ...(Array.isArray(p.photos) ? p.photos : []),
            ...(Array.isArray(p.playerPhotos) ? p.playerPhotos : []),
            ...(Array.isArray(p.gallery) ? p.gallery : []),
            p.profileImageUrl,
            p.playerPhoto,
            p.photoUrl,
          ].filter((u) => typeof u === "string" && u.trim().length > 5);
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
          .sort(
            (a, b) =>
              (a.grandPrixIndex ?? a.playerIndex ?? 0) -
              (b.grandPrixIndex ?? b.playerIndex ?? 0)
          )
          .filter((f) => f.playerNoShow === false);
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

  const handleViewRanking = async (gradeId) => {
    if (isRankingView) {
      setIsRankingView(false);
      setRankingData(null);
    } else {
      const condition = [where("gradeId", "==", gradeId)];
      try {
        const data = await fetchResultQuery.getDocuments(
          "contest_results_list",
          condition
        );

        if (!data || data.length === 0) {
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

        const standingData = [...(data[0]?.result || [])].sort(
          (a, b) => a.playerRank - b.playerRank
        );
        setRankingData(standingData);
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
    const condition = [where("gradeId", "==", gradeId)];
    try {
      const data = await fetchResultQuery.getDocuments(
        "contest_results_list",
        condition
      );

      if (!data || data.length === 0) {
        return;
      }

      const standingData = [...(data[0]?.result || [])].sort(
        (a, b) => a.playerRank - b.playerRank
      );

      const collectionInfo = `currentStage/${effectiveContestId}/screen`;
      const newState = {
        players: [...standingData],
        gradeTitle: gradeTitle,
        status: { playStart: true },
      };
      await updateCurrentStage.updateData(collectionInfo, { ...newState });
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

  // 현재 진행 무대(stageId) 변경 시 출전 선수 매칭 동기화
  useEffect(() => {
    setCalledPlayers({});
    setCalledCompareNums({});
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

  // 프롬프터 글자 크기 매핑 (400~600 웨이트 유지)
  const textClasses = {
    normal: {
      playerNum: "text-3xl",
      playerName: "text-xl",
      playerGym: "text-sm",
      playerText: "text-sm",
      compareNum: "text-4xl",
    },
    large: {
      playerNum: "text-5xl",
      playerName: "text-2xl sm:text-3xl",
      playerGym: "text-base sm:text-lg",
      playerText: "text-base",
      compareNum: "text-6xl",
    },
    xlarge: {
      playerNum: "text-6xl sm:text-7xl",
      playerName: "text-3xl sm:text-4xl",
      playerGym: "text-xl sm:text-2xl",
      playerText: "text-lg sm:text-xl",
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
      await updateBroadcast.updateData(`currentBroadcast/${effectiveContestId}`, {
        mode,
        updatedAt: Date.now(),
        ...extraData,
      });
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

  const handleIntroPlayerToScreen = (player) => {
    const uidPhotos =
      (player.playerUid && uidPhotoMap.get(player.playerUid)) || [];
    const directPhotos = [
      ...(Array.isArray(player.photos) ? player.photos : []),
      ...(Array.isArray(player.playerPhotos) ? player.playerPhotos : []),
      player.profileImageUrl,
      player.playerPhoto,
      player.photoUrl,
    ].filter((u) => typeof u === "string" && u.trim().length > 5);

    const allPhotos = Array.from(new Set([...directPhotos, ...uidPhotos]));

    let stage1 = player.stagePhoto1 || player.stagePhotoUrl1 || "";
    let stage2 =
      player.stagePhoto2 ||
      player.stagePhotoUrl2 ||
      player.backgroundPhotoUrl ||
      "";

    if (!stage1 && allPhotos.length > 0) stage1 = allPhotos[0];
    if (!stage2 && allPhotos.length > 1) stage2 = allPhotos[1];

    const primary =
      stage1 ||
      allPhotos[0] ||
      player.profileImageUrl ||
      player.playerPhoto ||
      "";

    const playerObj = {
      playerUid: player.playerUid || "",
      playerNumber: player.playerNumber || "100",
      playerName: player.playerName || "",
      playerGym: player.playerGym || "",
      heightWeight: player.heightWeight || "",
      stagePhoto1: stage1,
      stagePhoto2: stage2,
      stagePhotoUrl1: stage1,
      stagePhotoUrl2: stage2,
      backgroundPhotoUrl: stage2,
      profileImageUrl: primary,
      photoUrl: primary,
      playerMotivation: player.playerMotivation || player.playerText || "",
      photos: allPhotos,
    };

    handleSwitchBroadcastMode("ATHLETE_INTRO", {
      activePlayer: playerObj,
      player: playerObj,
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

  const triggerChampionShowcase = () => {
    const ranked1st =
      rankingData && rankingData.length > 0
        ? rankingData.find((p) => (p.playerRank || p.rank) === 1) ||
          rankingData[0]
        : currentPlayersArray[0]?.players?.[0];

    const rawTop = ranked1st || {
      playerNumber: "100",
      playerName: "1위 챔피언",
      playerGym: "무소속",
    };

    const uidPhotos =
      (rawTop.playerUid && uidPhotoMap.get(rawTop.playerUid)) || [];
    const directPhotos = [
      ...(Array.isArray(rawTop.photos) ? rawTop.photos : []),
      ...(Array.isArray(rawTop.playerPhotos) ? rawTop.playerPhotos : []),
      rawTop.profileImageUrl,
      rawTop.playerPhoto,
      rawTop.photoUrl,
    ].filter((u) => typeof u === "string" && u.trim().length > 5);

    const allPhotos = Array.from(new Set([...directPhotos, ...uidPhotos]));
    const primary =
      allPhotos[0] || rawTop.profileImageUrl || rawTop.playerPhoto || "";

    const topPlayerObj = {
      ...rawTop,
      profileImageUrl: primary,
      photoUrl: primary,
      photos: allPhotos,
    };

    handleSwitchBroadcastMode("CHAMPION_SHOWCASE", {
      topPlayer: topPlayerObj,
    });
  };

  const quickScenes = [
    {
      mode: "STANDBY",
      label: "대기 화면",
      icon: Monitor,
      onClick: () => handleSwitchBroadcastMode("STANDBY"),
    },
    {
      mode: "POSEDOWN",
      label: "포즈다운 60초",
      icon: Timer,
      onClick: () => handleSwitchBroadcastMode("POSEDOWN"),
    },
    {
      mode: "COMMERCIAL",
      label: "점수 집계 중",
      icon: BarChart3,
      onClick: () => handleSwitchBroadcastMode("COMMERCIAL"),
    },
    {
      mode: "RANKING",
      label: "순위 발표",
      icon: Trophy,
      onClick: () => handleSwitchBroadcastMode("RANKING"),
    },
    {
      mode: "CHAMPION_SHOWCASE",
      label: "1위 단독 송출",
      icon: Award,
      onClick: triggerChampionShowcase,
      spanClass: "col-span-2 sm:col-span-1",
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#141415] text-[#ededed] flex flex-col select-none">
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />
      {/* 사회자 상단 헤더 바 (#0f0f10 deepest) */}
      <header className="sticky top-0 z-30 bg-[#0f0f10] border-b border-[#ededed]/[0.08] px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-[8px] bg-[#232325] border border-[#ededed]/[0.08] flex items-center justify-center shrink-0">
            <Mic size={16} strokeWidth={1.5} className="text-[#a1a1a6]" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#232325] text-[#a1a1a6] border border-[#ededed]/[0.08] text-xs font-medium shrink-0">
              사회자 콘솔
            </span>
            <h1 className="text-sm sm:text-base font-medium text-[#ededed] m-0 truncate">
              {currentContest?.contests?.contestTitle || "보디빌딩 대회"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-2 bg-[#19191b] px-3 h-9 rounded-[8px] border border-[#ededed]/[0.08]">
            <StatusDot
              status={currentBroadcastMode === "STANDBY" ? "idle" : "live"}
              live={currentBroadcastMode !== "STANDBY"}
            />
            <span className="text-xs text-[#85858b]">전광판</span>
            <span className="text-xs font-medium text-[#ededed]">
              {broadcastLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={cycleFontSize}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-[8px] bg-[#232325] hover:bg-[#2c2c2f] text-[#ededed] border border-[#ededed]/[0.08] font-medium text-xs transition-colors active:scale-[0.98] cursor-pointer"
            title="글자 크기 변경"
          >
            <Type size={16} strokeWidth={1.5} className="text-[#a1a1a6]" />
            <span>
              크기:{" "}
              {fontScale === "normal"
                ? "보통"
                : fontScale === "large"
                ? "크게"
                : "아주 크게"}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-[8px] bg-[#232325] hover:bg-[#2c2c2f] text-[#ededed] border border-[#ededed]/[0.08] flex items-center justify-center transition-colors active:scale-[0.98] cursor-pointer"
            title="전체화면 전환"
          >
            {isFullscreen ? (
              <Minimize2 size={16} strokeWidth={1.5} className="text-[#a1a1a6]" />
            ) : (
              <Maximize2 size={16} strokeWidth={1.5} className="text-[#a1a1a6]" />
            )}
          </button>
        </div>
      </header>

      {/* 전광판 원터치 방송 제어 스튜디오 스위처 바 */}
      <div className="bg-[#0f0f10] border-b border-[#ededed]/[0.08] px-4 py-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
        {quickScenes.map((scene) => {
          const Icon = scene.icon;
          const isActive = currentBroadcastMode === scene.mode;
          return (
            <button
              key={scene.mode}
              type="button"
              onClick={scene.onClick}
              className={`${
                scene.spanClass || ""
              } flex items-center justify-center gap-2 h-12 px-3 rounded-[10px] font-medium text-sm transition-colors active:scale-[0.98] cursor-pointer border ${
                isActive
                  ? "bg-[#2563eb] text-white border-[#2563eb]"
                  : "bg-[#232325] hover:bg-[#2c2c2f] text-[#ededed] border-[#ededed]/[0.08]"
              }`}
            >
              <Icon
                size={16}
                strokeWidth={1.5}
                className={isActive ? "text-white" : "text-[#a1a1a6]"}
              />
              <span>{scene.label}</span>
              {isActive && <StatusDot status="live" live />}
            </button>
          );
        })}
      </div>

      {/* 운영 데이터 점검 및 빠른 보강 바 (다크 스튜디오 테마) */}
      <div className="px-4 pt-3">
        <MonitoringDiagnosticsBar
          variant="dark"
          screenType="host"
          contestInfo={contestInfo}
          stagesCount={stagesArray.length}
          playersCount={allFinalPlayers.length}
          realtimeData={realtimeData}
          currentStagePlayersCount={activeStageMatchedPlayersCount}
          onRefreshData={reloadHostData}
        />
      </div>

      {/* 메인 바디 영역 */}
      <div
        className={`flex-1 flex ${
          isLandscape ? "flex-row" : "flex-col"
        } p-4 gap-4 overflow-hidden`}
      >
        {/* 좌측 패널 (현재 무대 및 상태 제어) */}
        <div
          className={
            isLandscape
              ? "w-[320px] lg:w-[352px] flex flex-col gap-3 shrink-0"
              : "w-full flex flex-col gap-3"
          }
        >
          {/* 현재 진행 중인 무대 카드 */}
          <div className="bg-[#19191b] rounded-[12px] border border-[#ededed]/[0.08] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#85858b]">
                현재 진행 무대
              </span>
              {realtimeData?.stageNumber && (
                <BibTag
                  variant="dark"
                  size="sm"
                  prefix="#"
                  number={realtimeData.stageNumber}
                />
              )}
            </div>

            <div>
              <div className="text-xl lg:text-2xl font-semibold text-[#ededed] leading-snug">
                {realtimeData?.categoryTitle || "진행 종목 없음"}
              </div>
              <div className="text-base lg:text-lg font-medium text-[#a1a1a6] mt-1">
                {realtimeData?.gradeTitle || "대기 중"}
              </div>
            </div>

            {currentPlayersArray.length > 0 && (
              <div className="pt-3 border-t border-[#ededed]/[0.08] space-y-2">
                {currentPlayersArray.map((current, cIdx) => {
                  const isSaved =
                    Array.isArray(realtimeData?.resultSaved) &&
                    realtimeData.resultSaved.includes(current.gradeId);
                  return (
                    <div
                      key={cIdx}
                      className="flex items-center justify-between bg-[#232325] px-3 py-2 rounded-[8px] border border-[#ededed]/[0.08]"
                    >
                      <span className="text-sm font-medium text-[#ededed]">
                        {current.gradeTitle}
                      </span>
                      {isSaved ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4cc38a]">
                          <StatusDot status="live" />
                          <span>순위 확정됨</span>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-[#a1a1a6]">
                          심사 진행 중
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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

          {/* 체급별 순위 확인 및 전광판 송출 버튼 */}
          {currentPlayersArray.length > 0 &&
            currentPlayersArray.map((current, cIdx) => {
              const isSaved =
                Array.isArray(realtimeData?.resultSaved) &&
                realtimeData.resultSaved.includes(current.gradeId);
              return (
                <div
                  key={cIdx}
                  className="bg-[#19191b] rounded-[12px] border border-[#ededed]/[0.08] p-4 space-y-2.5"
                >
                  <div className="text-xs font-medium text-[#85858b]">
                    {current.gradeTitle} 발표 제어
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleViewRanking(current.gradeId, current.gradeTitle)
                    }
                    className={`w-full h-11 px-4 rounded-[8px] font-medium text-sm transition-colors active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer border ${
                      isRankingView
                        ? "bg-[#232325] hover:bg-[#2c2c2f] text-[#ededed] border-[#2563eb]"
                        : isSaved
                        ? "bg-[#ededed] hover:bg-white text-[#141415] border-[#ededed]"
                        : "bg-[#232325] hover:bg-[#2c2c2f] text-[#a1a1a6] border-[#ededed]/[0.08]"
                    }`}
                  >
                    {isRankingView ? (
                      <>
                        <Users size={16} strokeWidth={1.5} />
                        <span>참가 선수 명단으로 돌아가기</span>
                      </>
                    ) : (
                      <>
                        <Trophy size={16} strokeWidth={1.5} />
                        <span>
                          {isSaved ? "순위 발표 모드 열기" : "순위 결과 확인"}
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
                      className="w-full h-10 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors active:scale-[0.98] cursor-pointer"
                    >
                      <Send size={16} strokeWidth={1.5} />
                      <span>전광판 순위 화면 송출</span>
                    </button>
                  )}
                </div>
              );
            })}
        </div>

        {/* 우측 메인 프롬프터 뷰 */}
        <main className="flex-1 bg-[#19191b] rounded-[12px] border border-[#ededed]/[0.08] flex flex-col overflow-hidden">
          {/* 프롬프터 상단 바 */}
          <div className="bg-[#0f0f10] border-b border-[#ededed]/[0.08] px-5 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5">
              {isCompareView && compareNumbers.length > 0 ? (
                <Users size={16} strokeWidth={1.5} className="text-[#a1a1a6]" />
              ) : isRankingView ? (
                <Trophy size={16} strokeWidth={1.5} className="text-[#a1a1a6]" />
              ) : (
                <Mic size={16} strokeWidth={1.5} className="text-[#a1a1a6]" />
              )}
              <h2 className="text-base font-semibold text-[#ededed] m-0">
                {isCompareView && compareNumbers.length > 0
                  ? "비교심사 호명 대상 번호판"
                  : isRankingView
                  ? "시상식 순위 발표 프롬프터"
                  : "참가 선수 호명 프롬프터"}
              </h2>
            </div>

            {isRankingView && (
              <button
                type="button"
                onClick={() => setIsReversed((prev) => !prev)}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-[6px] bg-[#232325] hover:bg-[#2c2c2f] border border-[#ededed]/[0.1] text-[#ededed] font-medium text-xs transition-colors active:scale-[0.98] cursor-pointer"
              >
                <ArrowDownUp
                  size={14}
                  strokeWidth={1.5}
                  className="text-[#a1a1a6]"
                />
                <span>
                  {isReversed
                    ? "역순 발표 (하위 → 1위)"
                    : "정순 발표 (1위 → 하위)"}
                </span>
              </button>
            )}

            {!isRankingView && !isCompareView && (
              <span className="text-xs text-[#85858b]">
                선수 카드를 터치하면 전광판에 단독 소개 화면이 송출됩니다
              </span>
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
                  {compareNumbers.map((num) => {
                    const isCalled = calledCompareNums[num];
                    return (
                      <button
                        type="button"
                        key={num}
                        onClick={() => toggleCompareNumCalled(num)}
                        className={`p-6 rounded-[12px] text-center cursor-pointer transition-colors active:scale-[0.98] border flex flex-col items-center justify-center gap-3 ${
                          isCalled
                            ? "bg-[#141415] border-[#ededed]/[0.06] opacity-50"
                            : "bg-[#232325] hover:bg-[#2c2c2f] border-[#2563eb]/60"
                        }`}
                      >
                        <BibTag
                          variant={isCalled ? "dark" : "active"}
                          size="lg"
                          prefix="#"
                          number={num}
                        />
                        <div
                          className={`font-mono tabular-nums font-semibold leading-none ${
                            textClasses.compareNum
                          } ${
                            isCalled
                              ? "text-[#85858b] line-through"
                              : "text-[#ededed]"
                          }`}
                        >
                          {num}
                        </div>
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
                            <span className="text-lg sm:text-xl font-semibold">
                              {rank}위
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              <BibTag
                                variant={isFirst ? "active" : "dark"}
                                size="lg"
                                number={player.playerNumber}
                              />
                              <span
                                className={`font-mono tabular-nums font-semibold text-[#a1a1a6] ${textClasses.playerNum}`}
                              >
                                {player.playerNumber}번
                              </span>
                              <span
                                className={`font-semibold text-[#ededed] ${textClasses.playerName}`}
                              >
                                {player.playerName}
                              </span>
                            </div>
                            <div
                              className={`text-[#a1a1a6] mt-1 ${textClasses.playerGym}`}
                            >
                              소속: {player.playerGym || "무소속"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : currentPlayersArray.length > 0 &&
              activeStageMatchedPlayersCount > 0 ? (
              /* 3. 참가 선수 명단 및 멘트 프롬프터 */
              currentPlayersArray.map((current, cIdx) => (
                <div key={cIdx} className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#ededed]/[0.08]">
                    <h3 className="text-sm font-medium text-[#a1a1a6] m-0">
                      {current.gradeTitle} 선수 명단
                    </h3>
                    <span className="font-mono tabular-nums text-xs text-[#85858b]">
                      총 {current.players.length}명
                    </span>
                  </div>

                  {current.players.length > 0 ? (
                    <div className="space-y-3">
                      {current.players.map((player) => {
                        const isCalled = calledPlayers[player.playerUid];
                        const isSelected =
                          selectedPlayerUid === player.playerUid;

                        return (
                          <div
                            key={player.playerUid}
                            onClick={() => {
                              togglePlayerCalled(player.playerUid);
                              handleIntroPlayerToScreen(player);
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
                              {/* 선수 번호 블록 */}
                              <div className="flex flex-col items-center gap-1.5 shrink-0">
                                <BibTag
                                  variant={isCalled ? "active" : "dark"}
                                  size="lg"
                                  number={player.playerNumber}
                                />
                                <span
                                  className={`font-mono tabular-nums font-semibold leading-none text-[#ededed] ${textClasses.playerNum}`}
                                >
                                  {player.playerNumber}
                                </span>
                              </div>

                              {/* 선수 이름, 소속, 출전 동기 */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-baseline gap-3 flex-wrap">
                                    <span
                                      className={`font-semibold text-[#ededed] ${textClasses.playerName}`}
                                    >
                                      {player.playerName}
                                    </span>
                                    <span
                                      className={`text-[#a1a1a6] ${textClasses.playerGym}`}
                                    >
                                      {player.playerGym || "무소속"}
                                    </span>
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
