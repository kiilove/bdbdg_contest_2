"use client";

import React, { useContext, useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../../hooks/useFirebaseRealtime";
import { useFirestoreQuery, useFirestoreGetDocument } from "../../hooks/useFirestores";
import { where } from "firebase/firestore";
import StandbyStageScene from "../../components/broadcast/StandbyStageScene";
import CommercialScene from "../../components/broadcast/CommercialScene";
import AthleteIntroScene from "../../components/broadcast/AthleteIntroScene";
import SquareRankingCeremonyScene from "../../components/broadcast/SquareRankingCeremonyScene";
import RankingCeremonyScene from "../../components/broadcast/RankingCeremonyScene";
import AwardCeremonyScene from "../../components/broadcast/AwardCeremonyScene";
import ChampionShowcaseScene from "../../components/broadcast/ChampionShowcaseScene";
import SpecialVideoScene from "../../components/broadcast/SpecialVideoScene";
import ComparisonCalloutScene from "../../components/broadcast/ComparisonCalloutScene";
import PosedownScene from "../../components/broadcast/PosedownScene";
import {
  FullscreenOutlined,
  FullscreenExitOutlined,
  DatabaseOutlined,
  CheckCircleFilled,
  ReloadOutlined,
  SearchOutlined,
  CloseOutlined,
  CloudDownloadOutlined,
  SoundOutlined,
  AudioMutedOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { Drawer, Input, message, Tag } from "antd";
import PreDownloadModal from "../../components/broadcast/PreDownloadModal";
import SmoothBackgroundVideo from "../../components/broadcast/SmoothBackgroundVideo";
import defaultStandbyVideo from "../../assets/mov/ybbf_mp4.mp4";
import defaultIntroVideo from "../../assets/mov/introduce.mp4";
import defaultCalloutVideo from "../../assets/mov/countdown_low.mp4";
import defaultAwardVideo from "../../assets/mov/award2.mp4";

const StageLiveDisplaySquare = () => {
  const location = useLocation();
  const { currentContest, setCurrentContest } = useContext(CurrentContestContext);

  // 📡 1. Firebase Realtime DB 글로벌 전역 활성 대회 구독
  const { data: globalActiveContest } = useFirebaseRealtimeGetDocument(
    "systemSettings/activeContest"
  );
  const updateGlobalSetting = useFirebaseRealtimeUpdateData();

  // 🎯 2. 스크린 화면에서 수동으로 선택한 대회 정보
  const [manualContest, setManualContest] = useState(() => {
    try {
      const saved = localStorage.getItem("screen_manual_contest");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // 🏆 3. 최종 유효 contestId & contestTitle 도출
  const urlContestId = new URLSearchParams(location.search).get("contestId") || location?.state?.contestId;

  const contestId =
    urlContestId ||
    manualContest?.contestId ||
    globalActiveContest?.contestId ||
    currentContest?.contests?.id ||
    currentContest?.contestInfo?.id ||
    localStorage.getItem("screen_active_contest_id") ||
    "";

  const contestTitle =
    manualContest?.contestTitle ||
    globalActiveContest?.contestTitle ||
    currentContest?.contestInfo?.contestTitle ||
    currentContest?.contests?.contestTitle ||
    "2026 보디빌딩 & 피트니스 챔피언십";

  // 🗄️ 데이터베이스(대회) 선택 모달 상태
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isPreDownloadOpen, setIsPreDownloadOpen] = useState(false);
  const [contestList, setContestList] = useState([]);
  const [isContestLoading, setIsContestLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCursorVisible, setIsCursorVisible] = useState(true);
  const cursorTimeoutRef = useRef(null);

  // 🔲 순위 발표 스타일 선택: "SQUARE_V2" (1:1 2·3위(좌) + 4~10위(우) ➜ 1위 단독 샷) vs "ORIGINAL_16_9" (기본 2열)
  const [rankingStyle, setRankingStyle] = useState("SQUARE_V2");

  const [sponsors, setSponsors] = useState([]);
  const [specialVideos, setSpecialVideos] = useState([]);
  const [videoSettings, setVideoSettings] = useState({
    standbyVideoUrl: "",
    introVideoUrl: "",
    calloutVideoUrl: "",
    posedownVideoUrl: "",
    rankingVideoUrl: "",
    championVideoUrl: "",
    awardVideoUrl: "",
  });

  const sponsorQuery = useFirestoreQuery();
  const fetchNoticeQuery = useFirestoreQuery();
  const fetchContestsQuery = useFirestoreQuery();
  const updateBroadcast = useFirebaseRealtimeUpdateData();

  // 📡 Realtime DB 실시간 브로드캐스트 상태 리스너
  const { data: directBroadcastData } = useFirebaseRealtimeGetDocument(
    contestId ? `currentBroadcast/${contestId}` : null
  );

  // 📡 전역 ACTIVE_STAGE 브로드캐스트 슬롯도 함께 구독 (contestId 불일치 방어)
  const { data: globalActiveBroadcast } = useFirebaseRealtimeGetDocument(
    "currentBroadcast/ACTIVE_STAGE"
  );

  const broadcastData = directBroadcastData || globalActiveBroadcast || null;

  const { data: legacyStageData } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );

  // 전체 대회 목록 불러오기
  const loadAllContests = async () => {
    setIsContestLoading(true);
    try {
      const condition = [
        where("contestStatus", "in", [
          "접수중",
          "수정됨",
          "데모용",
          "수동접수",
          "대회마감",
          "종료됨",
        ]),
      ];
      const notices = await fetchNoticeQuery.getDocuments("contest_notice", condition);
      const sorted = (notices || []).sort((a, b) =>
        (a.contestTitle || "").localeCompare(b.contestTitle || "")
      );
      setContestList(sorted);
    } catch (error) {
      console.error("대회 목록 로드 오류:", error);
    } finally {
      setIsContestLoading(false);
    }
  };

  useEffect(() => {
    if (isDbModalOpen) {
      loadAllContests();
    }
  }, [isDbModalOpen]);

  // 특정 대회로 데이터베이스 즉시 변경 핸들러
  const handleSelectContest = async (notice) => {
    try {
      const condition = [where("contestNoticeId", "==", notice.id)];
      const returnContest = await fetchContestsQuery.getDocuments("contests", condition);

      if (returnContest && returnContest[0]?.id) {
        const selectedId = returnContest[0].id;
        const selectedTitle = notice.contestTitle || "";

        const newContestData = {
          contestId: selectedId,
          contestNoticeId: notice.id,
          contestTitle: selectedTitle,
        };

        setManualContest(newContestData);
        localStorage.setItem("screen_manual_contest", JSON.stringify(newContestData));
        localStorage.setItem("screen_active_contest_id", selectedId);

        const fullContestObj = {
          contestInfo: { ...notice },
          contests: { ...returnContest[0] },
        };
        setCurrentContest(fullContestObj);
        sessionStorage.setItem("currentContest", JSON.stringify(fullContestObj));

        await updateGlobalSetting.updateData("systemSettings/activeContest", {
          contestId: selectedId,
          contestNoticeId: notice.id,
          contestTitle: selectedTitle,
          updatedAt: Date.now(),
        });

        message.success(`전광판 데이터베이스가 [${selectedTitle}] 로 변경되었습니다!`);
        setIsDbModalOpen(false);
      }
    } catch (error) {
      console.error("대회 선택 오류:", error);
      message.error("대회 데이터베이스 변경 중 오류가 발생했습니다.");
    }
  };

  // 마우스 커서 자동 숨김
  useEffect(() => {
    const handleActivity = () => {
      setIsCursorVisible(true);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
      cursorTimeoutRef.current = setTimeout(() => {
        setIsCursorVisible(false);
      }, 1500);
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("keydown", handleActivity);

    cursorTimeoutRef.current = setTimeout(() => {
      setIsCursorVisible(false);
    }, 1500);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
    };
  }, []);

  // 스폰서, 미디어 설정 및 특별영상 불러오기
  const fetchMediaSettings = async (cId) => {
    if (!cId) return;
    try {
      const condition = [where("contestId", "==", cId)];
      const data = await sponsorQuery.getDocuments("contest_sponsor_list", condition);
      if (data && data.length > 0) {
        const item = data[0];
        setSponsors(Array.isArray(item.sponsors) ? item.sponsors : []);
        setVideoSettings({
          standbyVideoUrl: item?.standbyVideoUrl || "",
          introVideoUrl: item?.introVideoUrl || "",
          calloutVideoUrl: item?.calloutVideoUrl || "",
          posedownVideoUrl: item?.posedownVideoUrl || "",
          rankingVideoUrl: item?.rankingVideoUrl || "",
          championVideoUrl: item?.championVideoUrl || "",
          awardVideoUrl: item?.awardVideoUrl || "",
        });
      }

      // 🎬 특별영상 목록 로드
      const spData = await sponsorQuery.getDocuments("contest_special_videos", condition);
      if (spData && spData.length > 0 && Array.isArray(spData[0]?.videos)) {
        setSpecialVideos(spData[0].videos);
      } else {
        setSpecialVideos([]);
      }
    } catch (error) {
      console.error("미디어 설정 로드 실패:", error);
    }
  };

  useEffect(() => {
    if (contestId) {
      fetchMediaSettings(contestId);
    }
  }, [contestId]);

  // 전체화면 토글
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // 사운드 ON/OFF
  const [isAudioEnabled, setIsAudioEnabled] = useState(() => {
    try {
      return localStorage.getItem("screen_audio_enabled") === "true";
    } catch {
      return false;
    }
  });

  // Firebase Realtime DB 사운드 설정 실시간 동기화
  useEffect(() => {
    if (broadcastData?.isAudioEnabled !== undefined) {
      setIsAudioEnabled(Boolean(broadcastData.isAudioEnabled));
    }
  }, [broadcastData?.isAudioEnabled]);

  const toggleAudio = async () => {
    const nextState = !isAudioEnabled;
    setIsAudioEnabled(nextState);
    try {
      localStorage.setItem("screen_audio_enabled", String(nextState));
      const payload = {
        isAudioEnabled: nextState,
        updatedAt: Date.now(),
      };
      if (contestId) {
        await updateBroadcast.updateData(`currentBroadcast/${contestId}`, payload);
      }
      if (!contestId || !globalActiveBroadcast?.targetContestId || globalActiveBroadcast?.targetContestId === contestId) {
        await updateBroadcast.updateData("currentBroadcast/ACTIVE_STAGE", payload);
      }
      message.success(nextState ? "전광판 사운드 [ON]" : "전광판 사운드 [OFF]");
    } catch {}
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "d" || e.key === "D") setIsDbModalOpen((prev) => !prev);
      if (e.key === "p" || e.key === "P") setIsPreDownloadOpen((prev) => !prev);
      if (e.key === "m" || e.key === "M") toggleAudio();
      if (e.key === "v" || e.key === "V") {
        setRankingStyle((prev) => (prev === "SQUARE_V2" ? "ORIGINAL_16_9" : "SQUARE_V2"));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAudioEnabled, contestId]);

  // 현재 송출 모드 결정
  let currentMode = broadcastData?.mode || "STANDBY";
  if (!broadcastData?.mode && legacyStageData?.screen?.status?.playStart) {
    currentMode = "RANKING";
  }
  const isSpecialVideoMode =
    currentMode === "SPECIAL_VIDEO" || currentMode === "SPECIAL_SCREEN";

  useEffect(() => {
    console.log("%c[STAGE LIVE DISPLAY SQUARE (1:1)] 📡 수신 상태 변경 감지!", "background:#a855f7;color:white;font-weight:bold;font-size:14px;", {
      contestId,
      currentMode,
      broadcastData,
      directBroadcastData,
      globalActiveBroadcast,
    });
  }, [contestId, currentMode, broadcastData, directBroadcastData, globalActiveBroadcast]);

  const activeCategory =
    broadcastData?.stageInfo?.categoryTitle ||
    legacyStageData?.categoryTitle ||
    legacyStageData?.screen?.gradeTitle ||
    "";
  const activeGrade =
    broadcastData?.stageInfo?.gradeTitle ||
    legacyStageData?.gradeTitle ||
    "";
  const activeGradeId =
    broadcastData?.stageInfo?.gradeId ||
    legacyStageData?.gradeId ||
    "";
  const activeStageNumber =
    broadcastData?.stageInfo?.stageNumber ||
    legacyStageData?.stageNumber ||
    legacyStageData?.stageId ||
    "";
  const activePlayers =
    broadcastData?.stageInfo?.players ||
    legacyStageData?.stagePlayers ||
    legacyStageData?.players ||
    legacyStageData?.screen?.players ||
    [];
  const activePlayerCount =
    broadcastData?.stageInfo?.players?.length ||
    broadcastData?.stageInfo?.playerCount ||
    legacyStageData?.stagePlayers?.length ||
    legacyStageData?.players?.length ||
    legacyStageData?.playerCount ||
    0;

  const stageInfo = {
    categoryTitle: activeCategory,
    gradeTitle: activeGrade,
    gradeId: activeGradeId,
    stageNumber: activeStageNumber,
    playerCount: activePlayerCount,
    players: activePlayers,
  };

  const activePlayer = broadcastData?.activePlayer || broadcastData?.player || null;
  const rankingData = broadcastData?.rankingData || legacyStageData?.screen?.players || [];
  const top1Player =
    rankingData.find((p) => (p.playerRank || p.rank || 0) === 1) ||
    activePlayer ||
    (rankingData.length > 0 ? rankingData[0] : null);

  const handleFinishCeremony = async () => {
    try {
      const payload = {
        mode: "STANDBY",
        activePlayer: null,
        specialScreenData: null,
        videoCommand: null,
        calloutData: null,
        updatedAt: Date.now(),
      };
      if (contestId) {
        await updateBroadcast.updateData(`currentBroadcast/${contestId}`, payload);
      }
      if (!contestId || !globalActiveBroadcast?.targetContestId || globalActiveBroadcast?.targetContestId === contestId) {
        await updateBroadcast.updateData("currentBroadcast/ACTIVE_STAGE", payload);
      }
    } catch (error) {
      console.error("대기 화면 복귀 오류:", error);
    }
  };

  const handleBackToRanking = async () => {
    try {
      const payload = {
        mode: "RANKING",
        updatedAt: Date.now(),
      };
      if (contestId) {
        await updateBroadcast.updateData(`currentBroadcast/${contestId}`, payload);
      }
      if (!contestId || !globalActiveBroadcast?.targetContestId || globalActiveBroadcast?.targetContestId === contestId) {
        await updateBroadcast.updateData("currentBroadcast/ACTIVE_STAGE", payload);
      }
    } catch (error) {
      console.error("순위표 복귀 오류:", error);
    }
  };

  const filteredContests = contestList.filter((c) =>
    (c.contestTitle || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden bg-black select-none ${
        !isCursorVisible ? "cursor-none" : ""
      }`}
    >
      {/* ========================================================================================= */}
      {/* 🌟 전광판 기본 컨트롤 버튼 바 (마우스 호버 시 사운드/DB/전체화면만 최소 표시) */}
      {/* ========================================================================================= */}
      <div
        className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 transition-all duration-300 ${
          isCursorVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        {/* 사운드 토글 */}
        <button
          onClick={toggleAudio}
          title={isAudioEnabled ? "사운드 음소거 (단축키 M)" : "사운드 켜기 (단축키 M)"}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full ${
            isAudioEnabled
              ? "bg-cyan-950/85 hover:bg-cyan-900 text-cyan-300 border-cyan-400/60 shadow-[0_4px_20px_rgba(6,182,212,0.4)]"
              : "bg-black/75 hover:bg-slate-900 text-slate-400 border-white/20"
          } border backdrop-blur-xl transition-all cursor-pointer text-xs font-bold font-mono`}
        >
          {isAudioEnabled ? <SoundOutlined className="text-cyan-400" /> : <AudioMutedOutlined />}
          <span>{isAudioEnabled ? "사운드 ON" : "사운드 OFF"}</span>
        </button>

        {/* DB 선택 */}
        <button
          onClick={() => setIsDbModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/75 hover:bg-slate-900 text-amber-300 border border-amber-500/50 backdrop-blur-xl shadow-lg transition-all cursor-pointer text-xs font-bold font-mono"
        >
          <DatabaseOutlined className="text-amber-400" />
          <span className="max-w-[140px] truncate">{contestTitle || "DB 선택"}</span>
        </button>

        {/* 전체화면 */}
        <button
          onClick={toggleFullscreen}
          className="p-3 rounded-full bg-black/75 hover:bg-slate-900 backdrop-blur-xl text-white/70 hover:text-white border border-white/20 shadow-xl cursor-pointer"
        >
          {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        </button>
      </div>

      {/* 🎬 [Global Root Layer 0: 씬(모드)별 배경 비디오 — 듀얼 버퍼 크로스페이드로 끊김 없이 전환] */}
      <SmoothBackgroundVideo
        src={(() => {
          switch (currentMode) {
            case "STANDBY": case "COMMERCIAL": default:
              return videoSettings.standbyVideoUrl;
            case "ATHLETE_INTRO":
              return videoSettings.introVideoUrl;
            case "COMPARISON_CALLOUT":
              return videoSettings.calloutVideoUrl;
            case "POSEDOWN":
              return videoSettings.posedownVideoUrl;
            case "RANKING": case "SQUARE_RANKING":
              return videoSettings.rankingVideoUrl;
            case "CHAMPION_SHOWCASE":
              return videoSettings.championVideoUrl || videoSettings.rankingVideoUrl;
            case "AWARD_CEREMONY":
              return videoSettings.awardVideoUrl || videoSettings.rankingVideoUrl;
          }
        })()}
        fallbackSrc={defaultStandbyVideo}
        overlayGradient="from-black/75 via-transparent to-black/65"
        gradientDirection="bg-gradient-to-t"
        isMuted={!isAudioEnabled || isSpecialVideoMode}
        muted={!isAudioEnabled || isSpecialVideoMode}
      />

      {/* ========================================================================================= */}
      {/* 씬별 렌더링 */}
      {/* ========================================================================================= */}

      {currentMode === "STANDBY" && (
        <StandbyStageScene
          contestTitle={contestTitle}
          stageInfo={stageInfo}
          sponsors={sponsors}
          backgroundVideoUrl={videoSettings.standbyVideoUrl}
          colorTheme={broadcastData?.colorTheme || "GOLD"}
        />
      )}

      {currentMode === "ATHLETE_INTRO" && (
        <AthleteIntroScene
          contestTitle={contestTitle}
          player={activePlayer}
          stageInfo={stageInfo}
          backgroundVideoUrl={videoSettings.introVideoUrl}
          colorTheme={broadcastData?.colorTheme || "GOLD"}
        />
      )}

      {currentMode === "COMPARISON_CALLOUT" && (
        <ComparisonCalloutScene
          contestTitle={contestTitle}
          stageInfo={stageInfo}
          calloutData={broadcastData?.calloutData}
          backgroundVideoUrl={videoSettings.calloutVideoUrl}
          colorTheme={broadcastData?.colorTheme || "GOLD"}
        />
      )}

      {currentMode === "POSEDOWN" && (
        <PosedownScene
          contestTitle={contestTitle}
          stageInfo={stageInfo}
          currentPlayers={stageInfo?.players || []}
          sponsors={sponsors}
          backgroundVideoUrl={videoSettings.posedownVideoUrl}
          colorTheme={broadcastData?.colorTheme || "RED"}
          isAudioEnabled={isAudioEnabled}
        />
      )}

      {currentMode === "COMMERCIAL" && (
        <CommercialScene
          contestTitle={contestTitle}
          stageInfo={stageInfo}
          sponsors={sponsors}
          isAudioEnabled={isAudioEnabled}
        />
      )}

      {/* ⑤ 🌟 순위 발표 씬 (1:1 정방형 V2 및 SQUARE_RANKING 모드) */}
      {(currentMode === "RANKING" || currentMode === "SQUARE_RANKING") && (
        <SquareRankingCeremonyScene
          contestTitle={contestTitle}
          categoryTitle={stageInfo?.categoryTitle || "공식 시상식"}
          gradeTitle={stageInfo?.gradeTitle || ""}
          gradeId={stageInfo?.gradeId || legacyStageData?.gradeId || ""}
          rankingData={rankingData}
          backgroundVideoUrl={videoSettings.rankingVideoUrl}
          colorTheme={broadcastData?.colorTheme || "GOLD"}
          rankingPhase={broadcastData?.rankingPhase}
          phaseUpdatedAt={broadcastData?.updatedAt}
          onFinishCeremony={handleFinishCeremony}
        />
      )}

      {currentMode === "CHAMPION_SHOWCASE" && (
        <ChampionShowcaseScene
          contestTitle={contestTitle}
          stageInfo={stageInfo}
          topPlayer={broadcastData?.topPlayer || broadcastData?.activePlayer || top1Player}
          backgroundVideoUrl={videoSettings.championVideoUrl}
          colorTheme={broadcastData?.colorTheme || "GOLD"}
          onBackToRanking={handleBackToRanking}
          onFinishCeremony={handleFinishCeremony}
        />
      )}

      {/* ⑦ 특별 영상 씬 (전체화면 단독 비디오 재생) */}
      {(currentMode === "SPECIAL_VIDEO" || currentMode === "SPECIAL_SCREEN") && (
        <SpecialVideoScene
          videoUrl={broadcastData?.specialVideoData?.videoUrl || broadcastData?.specialVideoUrl || videoSettings.standbyVideoUrl}
          videoCommand={broadcastData?.videoCommand}
          isAudioEnabled={isAudioEnabled}
          loop={broadcastData?.specialVideo?.loop ?? broadcastData?.specialVideoData?.loop}
          broadcastData={broadcastData}
          onEnded={handleFinishCeremony}
        />
      )}

      {currentMode === "AWARD_CEREMONY" && (
        <AwardCeremonyScene
          contestTitle={contestTitle}
          categoryTitle={stageInfo?.categoryTitle || "공식 시상식"}
          gradeTitle={stageInfo?.gradeTitle || ""}
          gradeId={stageInfo?.gradeId || legacyStageData?.gradeId || ""}
          rankingData={rankingData}
          backgroundVideoUrl={videoSettings.awardVideoUrl}
          colorTheme={broadcastData?.colorTheme || "GOLD"}
          onFinishCeremony={handleFinishCeremony}
        />
      )}

      {/* DB 선택 드로어 */}
      <Drawer
        placement="right"
        width={520}
        open={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        title="전광판 대회 데이터베이스 선택"
        destroyOnClose
      >
        <div className="space-y-4">
          <Input
            placeholder="대회명 검색..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
          />
          <div className="space-y-2">
            {filteredContests.map((c) => (
              <div
                key={c.id}
                onClick={() => handleSelectContest(c)}
                className="p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 cursor-pointer flex items-center justify-between gap-3"
              >
                <span className="font-bold text-slate-800 truncate">{c.contestTitle}</span>
                <Tag color="gold" className="m-0 shrink-0">선택</Tag>
              </div>
            ))}
          </div>
        </div>
      </Drawer>

      {/* 사전 다운로드 모달 */}
      <PreDownloadModal
        open={isPreDownloadOpen}
        onClose={() => setIsPreDownloadOpen(false)}
        contestId={contestId}
        contestTitle={contestTitle}
        videoSettings={videoSettings}
        sponsors={sponsors}
        specialVideos={specialVideos}
      />
    </div>
  );
};

class StageDisplaySquareErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[StageLiveDisplaySquare Error Boundary]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleCopyError = () => {
    const errorText = [
      "=== StageLiveDisplaySquare Error ===",
      this.state.error?.toString() || "",
      "\n=== Stack Trace ===",
      this.state.error?.stack || "",
      "\n=== Component Stack ===",
      this.state.errorInfo?.componentStack || "",
    ].join("\n");

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(errorText);
      alert("✅ 에러 내용이 클립보드에 복사되었습니다! 채팅창에 붙여넣기(Ctrl+V) 해주세요.");
    } else {
      alert("직접 아래 텍스트 상자에서 Ctrl+A, Ctrl+C로 복사해 주세요.");
    }
  };

  render() {
    if (this.state.hasError) {
      const errorFullText = [
        this.state.error?.toString() || "",
        this.state.error?.stack || "",
        this.state.errorInfo?.componentStack || "",
      ].filter(Boolean).join("\n\n");

      return (
        <div className="w-screen h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-text overflow-auto" style={{ userSelect: "text" }}>
          <div className="max-w-3xl w-full space-y-4 bg-slate-900/95 p-8 rounded-3xl border-2 border-red-500/40 shadow-2xl select-text" style={{ userSelect: "text" }}>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 border border-red-400/40 flex items-center justify-center text-red-400 text-3xl animate-pulse">
              <DatabaseOutlined />
            </div>
            <h2 className="text-2xl font-black text-white m-0 select-text">무대 송출 화면 오류 감지 및 디버깅</h2>

            <div className="space-y-2 text-left select-text">
              <div className="flex justify-between items-center text-xs font-mono text-red-300">
                <span className="font-bold">❌ 에러 상세 내용:</span>
                <button
                  onClick={this.handleCopyError}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs cursor-pointer border-none shadow transition-all"
                >
                  📋 에러 내용 1초 복사하기
                </button>
              </div>

              <textarea
                readOnly
                value={errorFullText}
                rows={8}
                onClick={(e) => e.target.select()}
                className="w-full bg-black/90 p-3 rounded-xl border border-red-500/40 text-[11px] font-mono text-red-300 select-text focus:outline-none focus:border-red-400"
                style={{ userSelect: "text" }}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleCopyError}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-base shadow-xl transition-all cursor-pointer border-none"
              >
                📋 에러 내용 복사하기
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-base shadow-xl hover:opacity-90 transition-all cursor-pointer border-none"
              >
                화면 새로고침 (F5)
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const SafeStageLiveDisplaySquare = () => (
  <StageDisplaySquareErrorBoundary>
    <StageLiveDisplaySquare />
  </StageDisplaySquareErrorBoundary>
);

export default SafeStageLiveDisplaySquare;
