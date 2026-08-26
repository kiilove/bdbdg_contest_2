"use client";

import { useContext, useEffect, useState, useMemo } from "react";
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
import { Spin, message } from "antd";
import {
  UpOutlined,
  DownOutlined,
  EyeOutlined,
  SendOutlined,
  TrophyOutlined,
  UnorderedListOutlined,
  CheckCircleFilled,
  FullscreenOutlined,
  FullscreenExitOutlined,
  FontSizeOutlined,
  SoundOutlined,
} from "@ant-design/icons";

const ContestMonitoringHost = ({ contestId }) => {
  const { currentContest } = useContext(CurrentContestContext);
  const effectiveContestId = contestId || currentContest?.contests?.id || "";

  const [stagesArray, setStagesArray] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPlayersArray, setCurrentPlayersArray] = useState([]);
  const [contestInfo, setContestInfo] = useState({});
  const [selectedPlayerUid, setSelectedPlayerUid] = useState(null);
  const [calledPlayers, setCalledPlayers] = useState({}); // 호명 완료 체크 상태
  const [calledCompareNums, setCalledCompareNums] = useState({}); // 비교심사 호명 체크

  const fetchResultQuery = useFirestoreQuery();
  const [rankingData, setRankingData] = useState(null);
  const [isRankingView, setIsRankingView] = useState(false);
  const [isReversed, setIsReversed] = useState(true); // 사회자는 기본 역순(5위->1위)이 편함
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== "undefined"
      ? window.innerWidth > window.innerHeight
      : false
  );

  // 글자 크기 조절 (normal / large / xlarge)
  const [fontScale, setFontScale] = useState("large"); // tablet default = large
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 사회자 비교심사 전용 상태
  const [isCompareView, setIsCompareView] = useState(false);
  const [compareNumbers, setCompareNumbers] = useState([]);

  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    effectiveContestId ? `currentStage/${effectiveContestId}` : null
  );

  const updateCurrentStage = useFirebaseRealtimeUpdateData();

  // 📡 실시간 전광판 송출 상태 구독 및 제어 (최상단 호출)
  const { data: broadcastData } = useFirebaseRealtimeGetDocument(
    effectiveContestId ? `currentBroadcast/${effectiveContestId}` : null
  );
  const updateBroadcast = useFirebaseRealtimeUpdateData();

  // 📸 전체 선수 풀에서 playerUid 기준 사진 맵 구축 (최상단 호출로 React Rules of Hooks 준수)
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

  const fetchPool = async (
    noticeId,
    contestId,
    stageAssignId,
    playerFinalId,
    currentStageId
  ) => {
    try {
      const [returnNotice, returnContestStage, returnPlayersFinal] =
        await Promise.all([
          fetchNotice.getDocument(noticeId),
          fetchStages.getDocument(stageAssignId),
          fetchFinalPlayers.getDocument(playerFinalId),
        ]);

      if (returnNotice && returnContestStage && returnPlayersFinal) {
        setStagesArray(
          returnContestStage.stages.sort(
            (a, b) => a.stageNumber - b.stageNumber
          )
        );
        setContestInfo(returnNotice);

        const players = returnPlayersFinal.players
          .sort((a, b) => a.playerIndex - b.playerIndex)
          .filter((f) => f.playerNoShow === false);

        const currentStage = returnContestStage.stages.find(
          (f) => f.stageId === currentStageId
        );
        const currentStageGrades = currentStage ? currentStage.grades : [];

        const playerList = currentStageGrades.length
          ? currentStageGrades.map((grade) => {
              const matchedPlayers = matchedGradewWithPlayers(
                contestId,
                grade.gradeId,
                players
              );
              return {
                gradeTitle: grade.gradeTitle,
                gradeId: grade.gradeId,
                players: matchedPlayers,
              };
            })
          : [];

        setCurrentPlayersArray(playerList);
      }
    } catch (error) {
      console.error("데이터 로드 중 에러:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewRanking = async (gradeId, gradeTitle) => {
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
          message.error("순위결과가 아직 등록되지 않았습니다.");
          return;
        }

        const standingData = data[0].result.sort(
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
      message.success("전광판에 순위가 송출되었습니다!");
    } catch (error) {
      message.error("스크린 송출 중 에러 발생");
      console.log("스크린 송출 중 에러:", error);
    }
  };

  const fetchResultAndScoreBoard = async (gradeId, gradeTitle) => {
    const condition = [where("gradeId", "==", gradeId)];
    try {
      const data = await fetchResultQuery.getDocuments(
        "contest_results_list",
        condition
      );

      if (data?.length === 0) {
        return;
      }

      const standingData = data[0].result.sort(
        (a, b) => a.playerRank - b.playerRank
      );

      const collectionInfo = `currentStage/${currentContest.contests.id}/screen`;
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

  // 호명 완료 토글
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

  // 전체화면 토글
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // 폰트 크기 변경
  const cycleFontSize = () => {
    if (fontScale === "normal") setFontScale("large");
    else if (fontScale === "large") setFontScale("xlarge");
    else setFontScale("normal");
  };

  useEffect(() => {
    const loadData = async () => {
      if (
        currentContest?.contests?.contestNoticeId &&
        currentContest?.contests?.contestStagesAssignId &&
        currentContest?.contests?.contestPlayersFinalId &&
        realtimeData?.stageId
      ) {
        setIsLoading(true);
        // 체급 변경 시 호명 상태 초기화
        setCalledPlayers({});
        setCalledCompareNums({});
        await fetchPool(
          currentContest.contests.contestNoticeId,
          currentContest.contests.id,
          currentContest.contests.contestStagesAssignId,
          currentContest.contests.contestPlayersFinalId,
          realtimeData.stageId
        );
      }
    };

    loadData();
  }, [currentContest, realtimeData?.stageId]);

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
      // 새로운 비교심사가 오면 자동으로 비교심사 뷰 활성화
      setIsCompareView(true);
      setIsRankingView(false);
    }
  }, [realtimeData?.compares?.confirmed?.numbers]);

  if (isLoading || realtimeLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white gap-4">
        <Spin size="large" />
        <p className="text-lg font-bold text-slate-300">사회자 무대 데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (realtimeError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 p-6">
        <div className="bg-red-900/40 border border-red-500 rounded-2xl p-6 text-white text-center">
          <p className="text-xl font-bold">오류 발생: {realtimeError.message}</p>
        </div>
      </div>
    );
  }

  // 비교 상태 파생값
  const compareStatus = realtimeData?.compares?.status || {};
  const isCompareRunning =
    !!compareStatus?.compareStart || !!compareStatus?.compareIng;
  const isCompareConfirmed = (compareNumbers?.length || 0) > 0;

  // 글자 크기 매핑
  const textClasses = {
    normal: {
      playerNum: "text-4xl",
      playerName: "text-2xl",
      playerGym: "text-base",
      playerText: "text-sm",
      rankTitle: "text-5xl",
      rankName: "text-3xl",
      compareNum: "text-5xl",
    },
    large: {
      playerNum: "text-6xl",
      playerName: "text-3xl sm:text-4xl",
      playerGym: "text-lg sm:text-xl",
      playerText: "text-base sm:text-lg",
      rankTitle: "text-7xl",
      rankName: "text-4xl sm:text-5xl",
      compareNum: "text-7xl",
    },
    xlarge: {
      playerNum: "text-7xl sm:text-8xl",
      playerName: "text-4xl sm:text-5xl",
      playerGym: "text-2xl sm:text-3xl",
      playerText: "text-xl sm:text-2xl",
      rankTitle: "text-8xl sm:text-9xl",
      rankName: "text-5xl sm:text-6xl",
      compareNum: "text-8xl sm:text-9xl",
    },
  }[fontScale];

  const currentBroadcastMode = broadcastData?.mode || "STANDBY";

  // 📡 전광판 방송 모드 즉시 스위칭 핸들러
  const handleSwitchBroadcastMode = async (mode, extraData = {}) => {
    if (!effectiveContestId) {
      message.error("대회 정보를 불러올 수 없습니다.");
      return;
    }
    try {
      await updateBroadcast.updateData(`currentBroadcast/${effectiveContestId}`, {
        mode,
        updatedAt: Date.now(),
        ...extraData,
      });

      const modeNames = {
        STANDBY: "🏠 대기 및 종목안내",
        ATHLETE_INTRO: "📢 선수 단독 소개",
        COMPARISON_CALLOUT: "⚔️ 비교심사 호명",
        POSEDOWN: "🔥 60초 포즈다운 배틀",
        COMMERCIAL: "📊 점수 집계중 (광고)",
        RANKING: "🏆 1~3위 순위 발표",
        CHAMPION_SHOWCASE: "👑 1위 챔피언 세레모니",
      };

      message.success(`전광판 송출 전환: [${modeNames[mode] || mode}]`);
    } catch (error) {
      console.error("방송 모드 전환 실패:", error);
      message.error("전광판 송출 전환 중 오류가 발생했습니다.");
    }
  };

  // 👤 특정 선수 단독 소개 송출 (playerUid 기반으로 사진을 확실하게 물고 전광판 송출)
  const handleIntroPlayerToScreen = (player) => {
    const uidPhotos = (player.playerUid && uidPhotoMap.get(player.playerUid)) || [];
    const directPhotos = [
      ...(Array.isArray(player.photos) ? player.photos : []),
      ...(Array.isArray(player.playerPhotos) ? player.playerPhotos : []),
      player.profileImageUrl,
      player.playerPhoto,
      player.photoUrl,
    ].filter((u) => typeof u === "string" && u.trim().length > 5);

    const allPhotos = Array.from(new Set([...directPhotos, ...uidPhotos]));
    const primary = allPhotos[0] || player.profileImageUrl || player.playerPhoto || "";

    const playerObj = {
      playerUid: player.playerUid || "",
      playerNumber: player.playerNumber || "100",
      playerName: player.playerName || "",
      playerGym: player.playerGym || "",
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

  const getBroadcastBadge = (mode) => {
    const config = {
      STANDBY: { label: "대기 / 종목안내", color: "bg-blue-600" },
      ATHLETE_INTRO: { label: "선수 단독 소개 중", color: "bg-cyan-600" },
      COMPARISON_CALLOUT: { label: "비교심사 호명 중", color: "bg-purple-600" },
      POSEDOWN: { label: "🔥 포즈다운 배틀 중", color: "bg-red-600 animate-pulse" },
      COMMERCIAL: { label: "📊 점수 집계중 (광고)", color: "bg-indigo-600" },
      RANKING: { label: "🏆 순위 발표 중", color: "bg-amber-600" },
      CHAMPION_SHOWCASE: { label: "👑 1위 챔피언 세레모니", color: "bg-yellow-500 text-slate-950 font-black animate-bounce" },
    };
    return config[mode] || { label: mode, color: "bg-slate-700" };
  };

  const broadcastBadge = getBroadcastBadge(currentBroadcastMode);

  return (
    <div className="w-full min-h-screen bg-slate-900 text-slate-100 flex flex-col select-none">
      {/* 👑 사회자 상단 글로벌 헤더 바 */}
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <SoundOutlined className="text-white text-lg" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-900/70 text-indigo-300 border border-indigo-700">
                사회자 모니터 & 방송 제어
              </span>
              <h1 className="text-base sm:text-lg font-black text-white m-0 tracking-tight">
                {currentContest?.contests?.contestTitle || "보디빌딩 대회"}
              </h1>
            </div>
          </div>
        </div>

        {/* 📡 전광판 현재 송출 상태 뱃지 & 상단 컨트롤 */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 bg-black/80 px-3 py-1 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 font-bold uppercase">전광판:</span>
            <span className={`text-xs px-2 py-0.5 rounded-lg text-white font-bold ${broadcastBadge.color}`}>
              {broadcastBadge.label}
            </span>
          </div>

          <button
            onClick={cycleFontSize}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 font-bold text-xs sm:text-sm cursor-pointer transition-all"
            title="글자 크기 변경"
          >
            <FontSizeOutlined />
            <span>크기: {fontScale === "normal" ? "보통" : fontScale === "large" ? "크게" : "아주크게"}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-all"
            title="전체화면 토글"
          >
            {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          </button>
        </div>
      </header>

      {/* 🚀 [사회자 태블릿 전광판 원터치 방송 제어 대형 퀵 바] */}
      <div className="bg-slate-950 border-b border-slate-800 p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 shadow-xl">
        {/* ① 대기화면 */}
        <button
          onClick={() => handleSwitchBroadcastMode("STANDBY")}
          className={`flex items-center justify-center gap-2 h-14 rounded-xl font-black text-sm sm:text-base transition-all shadow-md active:scale-95 cursor-pointer ${
            currentBroadcastMode === "STANDBY"
              ? "bg-blue-600 text-white border-2 border-white"
              : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          }`}
        >
          <span>🏠 대기 화면</span>
        </button>

        {/* ② 🔥 포즈다운 60초 */}
        <button
          onClick={() => handleSwitchBroadcastMode("POSEDOWN")}
          className={`flex items-center justify-center gap-2 h-14 rounded-xl font-black text-sm sm:text-base transition-all shadow-md active:scale-95 cursor-pointer ${
            currentBroadcastMode === "POSEDOWN"
              ? "bg-gradient-to-r from-red-600 to-orange-500 text-white border-2 border-white ring-4 ring-orange-500/30"
              : "bg-gradient-to-r from-red-950 to-orange-950 hover:from-red-900 text-orange-200 border border-orange-700/60"
          }`}
        >
          <span>🔥 포즈다운 (60s)</span>
        </button>

        {/* ③ 📊 점수 집계중 (광고) */}
        <button
          onClick={() => handleSwitchBroadcastMode("COMMERCIAL")}
          className={`flex items-center justify-center gap-2 h-14 rounded-xl font-black text-sm sm:text-base transition-all shadow-md active:scale-95 cursor-pointer ${
            currentBroadcastMode === "COMMERCIAL"
              ? "bg-indigo-600 text-white border-2 border-white ring-4 ring-indigo-500/30"
              : "bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/60"
          }`}
        >
          <span>📊 점수 집계중</span>
        </button>

        {/* ④ 🏆 1~3위 순위 발표 */}
        <button
          onClick={() => handleSwitchBroadcastMode("RANKING")}
          className={`flex items-center justify-center gap-2 h-14 rounded-xl font-black text-sm sm:text-base transition-all shadow-md active:scale-95 cursor-pointer ${
            currentBroadcastMode === "RANKING"
              ? "bg-amber-500 text-slate-950 border-2 border-white font-black"
              : "bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/60"
          }`}
        >
          <span>🏆 순위 발표</span>
        </button>

        {/* ⑤ 👑 1위 챔피언 세레모니 */}
        <button
          onClick={() => {
            const ranked1st =
              rankingData && rankingData.length > 0
                ? rankingData.find((p) => (p.playerRank || p.rank) === 1) || rankingData[0]
                : currentPlayersArray[0]?.players?.[0];

            const rawTop = ranked1st || {
              playerNumber: "100",
              playerName: "1위 챔피언",
              playerGym: "Get_in",
            };

            const uidPhotos = (rawTop.playerUid && uidPhotoMap.get(rawTop.playerUid)) || [];
            const directPhotos = [
              ...(Array.isArray(rawTop.photos) ? rawTop.photos : []),
              ...(Array.isArray(rawTop.playerPhotos) ? rawTop.playerPhotos : []),
              rawTop.profileImageUrl,
              rawTop.playerPhoto,
              rawTop.photoUrl,
            ].filter((u) => typeof u === "string" && u.trim().length > 5);

            const allPhotos = Array.from(new Set([...directPhotos, ...uidPhotos]));
            const primary = allPhotos[0] || rawTop.profileImageUrl || rawTop.playerPhoto || "";

            const topPlayerObj = {
              ...rawTop,
              profileImageUrl: primary,
              photoUrl: primary,
              photos: allPhotos,
            };

            handleSwitchBroadcastMode("CHAMPION_SHOWCASE", {
              topPlayer: topPlayerObj,
            });
          }}
          className={`col-span-2 sm:col-span-1 flex items-center justify-center gap-2 h-14 rounded-xl font-black text-sm sm:text-base transition-all shadow-md active:scale-95 cursor-pointer ${
            currentBroadcastMode === "CHAMPION_SHOWCASE"
              ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 border-2 border-white ring-4 ring-yellow-400/40 font-black"
              : "bg-gradient-to-r from-amber-900 to-yellow-900 hover:from-amber-800 text-amber-200 border border-amber-500/60"
          }`}
        >
          <span>👑 1위 송출</span>
        </button>
      </div>

      {/* 메인 바디 영역 (좌우/상하 반응형) */}
      <div className={`flex-1 flex ${isLandscape ? "flex-row" : "flex-col"} p-3 sm:p-4 gap-3 sm:gap-4 overflow-hidden`}>
        {/* 📱 좌측 패널 (무대 정보 및 퀵 컨트롤 버튼) */}
        <div className={isLandscape ? "w-[320px] lg:w-[360px] flex flex-col gap-3 flex-shrink-0" : "w-full flex flex-col gap-3"}>
          {/* 현재 진행 중인 무대 카드 */}
          <div className="bg-slate-800/90 rounded-2xl border border-slate-700 p-4 shadow-xl">
            <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">
              현재 무대 종목 / 체급
            </div>
            <div className="text-2xl lg:text-3xl font-black text-white leading-tight">
              {realtimeData?.categoryTitle || "진행 종목 없음"}
            </div>
            <div className="text-xl lg:text-2xl font-bold text-amber-400 mt-1">
              {realtimeData?.gradeTitle || "대기 중"}
            </div>

            {/* 체급별 심사/확정 상태 */}
            {currentPlayersArray.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                {currentPlayersArray.map((current, cIdx) => {
                  const isSaved = (realtimeData?.resultSaved || []).includes(current.gradeId);
                  return (
                    <div key={cIdx} className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                      <span className="font-bold text-sm text-slate-200">{current.gradeTitle}</span>
                      {isSaved ? (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-300 font-extrabold text-xs border border-emerald-600 animate-pulse">
                          🏆 순위 확정됨
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 font-bold text-xs border border-amber-600">
                          심사진행중
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 🚨 비교심사(Call-out) 퀵 알림 & 전환 버튼 */}
          {isCompareRunning && !isCompareConfirmed && (
            <div className="bg-amber-950/80 border-2 border-amber-500 rounded-2xl p-4 text-center animate-pulse shadow-lg">
              <div className="text-2xl mb-1">⏳</div>
              <div className="text-lg font-black text-amber-300">비교심사 투표 진행 중...</div>
              <div className="text-xs text-amber-400 mt-1">심사위원들이 비교심사 선수를 선발하고 있습니다.</div>
            </div>
          )}

          {isCompareConfirmed && (
            <button
              onClick={() => {
                setIsCompareView((prev) => !prev);
                setIsRankingView(false);
              }}
              className={`w-full py-4 px-4 rounded-2xl font-black text-lg transition-all flex flex-col items-center justify-center gap-1 shadow-2xl cursor-pointer border-none ${
                isCompareView
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-400"
                  : "bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 text-white animate-bounce-short hover:opacity-95"
              }`}
            >
              <div className="flex items-center gap-2">
                <UnorderedListOutlined className="text-2xl" />
                <span className="text-xl">📢 비교심사 선수 호명</span>
              </div>
              <span className="text-xs text-emerald-100 font-medium">
                {isCompareView ? "✓ 호명 화면 표시 중 (클릭 시 명단 전환)" : `총 ${compareNumbers.length}명 선발 완료! (지금 클릭)`}
              </span>
            </button>
          )}

          {/* 🏆 순위확정 및 발표 버튼들 */}
          {currentPlayersArray.length > 0 &&
            currentPlayersArray.map((current, cIdx) => {
              const isSaved = (realtimeData?.resultSaved || []).includes(current.gradeId);
              return (
                <div key={cIdx} className="bg-slate-800/80 rounded-2xl border border-slate-700 p-3 space-y-2">
                  <div className="text-xs text-slate-400 font-semibold px-1">
                    {current.gradeTitle} 발표 제어
                  </div>

                  <button
                    onClick={() => handleViewRanking(current.gradeId, current.gradeTitle)}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 cursor-pointer border-none ${
                      isRankingView
                        ? "bg-slate-700 hover:bg-slate-600 text-white ring-2 ring-indigo-400"
                        : isSaved
                        ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/20 font-black animate-pulse"
                        : "bg-slate-700/80 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    {isRankingView ? (
                      <>
                        <UnorderedListOutlined />
                        <span>참가 선수 명단으로 돌아가기</span>
                      </>
                    ) : (
                      <>
                        <TrophyOutlined className={isSaved ? "text-xl text-yellow-200" : ""} />
                        <span>{isSaved ? "🏆 순위 발표 모드 (시상식)" : "순위 결과 확인"}</span>
                      </>
                    )}
                  </button>

                  {isSaved && (
                    <button
                      onClick={() => handleSendToScreen(current.gradeId, current.gradeTitle)}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer border-none transition-colors"
                    >
                      <SendOutlined />
                      <span>전광판 화면 송출</span>
                    </button>
                  )}
                </div>
              );
            })}
        </div>

        {/* 📋 우측 메인 프롬프터 뷰 (선수 카드 / 비교심사 / 순위 발표) */}
        <main className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl">
          {/* 프롬프터 상단 타이틀 바 */}
          <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {isCompareView && compareNumbers.length > 0
                  ? "📢"
                  : isRankingView
                  ? "🏆"
                  : "🎙️"}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white m-0 tracking-tight">
                {isCompareView && compareNumbers.length > 0
                  ? "비교심사 호명 대상 선수 (대형 번호판)"
                  : isRankingView
                  ? "시상식 순위 발표"
                  : "참가 선수 호명 명단"}
              </h2>
            </div>

            {/* 순위 발표 시 역순/정순 토글 */}
            {isRankingView && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden sm:inline font-medium">발표 순서:</span>
                <button
                  onClick={() => setIsReversed((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer border-none transition-all shadow-md"
                >
                  {isReversed ? <DownOutlined /> : <UpOutlined />}
                  <span>{isReversed ? "역순 발표 (5위➔1위)" : "정순 발표 (1위➔5위)"}</span>
                </button>
              </div>
            )}

            {/* 일반 선수 호명 시 도움말 */}
            {!isRankingView && !isCompareView && (
              <div className="text-xs text-slate-300 font-bold bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
                💡 <span className="text-amber-300">선수 이름/카드</span>를 터치하면 <strong className="text-emerald-400">전광판에 즉시 소개</strong>됩니다!
              </div>
            )}
          </div>

          {/* 스크롤 가능한 본문 */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3">
            {/* 1️⃣ 비교심사 확정 명단 뷰 (대형 번호 타일 그리드) */}
            {isCompareView && compareNumbers.length > 0 ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-950/40 border border-emerald-700/60 rounded-xl text-center text-emerald-300 text-sm font-bold">
                  아래 번호를 큰 소리로 호명해 주세요. 호명한 번호를 터치하면 체크됩니다.
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {compareNumbers.map((num) => {
                    const isCalled = calledCompareNums[num];
                    return (
                      <div
                        key={num}
                        onClick={() => toggleCompareNumCalled(num)}
                        className={`p-6 sm:p-8 rounded-2xl text-center cursor-pointer transition-all transform active:scale-95 border-2 ${
                          isCalled
                            ? "bg-slate-900 border-slate-700 opacity-40 shadow-none"
                            : "bg-gradient-to-b from-slate-800 to-slate-900 border-emerald-500 shadow-xl hover:border-emerald-400 hover:shadow-emerald-500/20"
                        }`}
                      >
                        <div className={`${textClasses.compareNum} font-black ${isCalled ? "text-slate-500 line-through" : "text-emerald-400"} leading-none`}>
                          {num}
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-1.5">
                          {isCalled ? (
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                              <CheckCircleFilled /> 호명 완료
                            </span>
                          ) : (
                            <span className="text-xs sm:text-sm font-extrabold text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-700">
                              호명 대상 (탭하여 완료)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : isRankingView && rankingData ? (
              /* 2️⃣ 순위 발표 뷰 (시상식 전용) */
              <div className="space-y-3">
                {(isReversed ? [...rankingData].reverse() : rankingData)
                  .filter((player) => player.playerRank < 1000)
                  .map((player) => {
                    const rank = player.playerRank;
                    const isSelected = selectedPlayerUid === player.playerUid;

                    let badgeColor = "bg-slate-800 border-slate-700 text-slate-300";
                    let rankText = `${rank}위`;
                    let rankBg = "bg-slate-900 border-slate-800";

                    if (rank === 1) {
                      badgeColor = "bg-gradient-to-br from-yellow-400 to-amber-600 text-slate-950 font-black border-amber-300 shadow-lg shadow-amber-500/30";
                      rankText = "🥇 1위 (우승)";
                      rankBg = "bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-amber-500/80";
                    } else if (rank === 2) {
                      badgeColor = "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950 font-black border-white shadow-md";
                      rankText = "🥈 2위 (준우승)";
                      rankBg = "bg-gradient-to-r from-slate-800/60 via-slate-900 to-slate-900 border-slate-400/60";
                    } else if (rank === 3) {
                      badgeColor = "bg-gradient-to-br from-amber-700 to-amber-900 text-amber-100 font-black border-amber-600 shadow-md";
                      rankText = "🥉 3위";
                      rankBg = "bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border-orange-700/50";
                    }

                    return (
                      <div
                        key={player.playerUid}
                        onClick={() => setSelectedPlayerUid(player.playerUid)}
                        className={`p-4 sm:p-5 rounded-2xl cursor-pointer transition-all border-2 ${rankBg} ${
                          isSelected ? "ring-4 ring-amber-400 shadow-2xl scale-[1.01]" : "hover:border-slate-700 hover:shadow-lg"
                        }`}
                      >
                        <div className="flex items-center gap-4 sm:gap-6">
                          {/* 순위 뱃지 */}
                          <div className={`min-w-[110px] sm:min-w-[140px] px-3 py-2 rounded-xl text-center border font-black ${badgeColor}`}>
                            <span className="text-xl sm:text-2xl">{rankText}</span>
                          </div>

                          {/* 선수 번호 및 이름 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-3 flex-wrap">
                              <span className={`font-black text-amber-400 ${textClasses.playerNum}`}>
                                {player.playerNumber}번
                              </span>
                              <span className={`font-black text-white ${textClasses.playerName}`}>
                                {player.playerName}
                              </span>
                            </div>
                            <div className={`text-slate-400 font-bold mt-0.5 ${textClasses.playerGym}`}>
                              소속: {player.playerGym || "무소속"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              /* 3️⃣ 일반 참가 선수 명단 뷰 (사회자 멘트 및 호명 프롬프터) */
              currentPlayersArray.map((current, cIdx) => (
                <div key={cIdx} className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h3 className="text-lg font-bold text-slate-300 m-0">
                      {current.gradeTitle} 선수 리스트 ({current.players.length}명)
                    </h3>
                  </div>

                  {current.players.length > 0 ? (
                    <div className="space-y-3">
                      {current.players.map((player) => {
                        const isCalled = calledPlayers[player.playerUid];
                        const isSelected = selectedPlayerUid === player.playerUid;

                        return (
                          <div
                            key={player.playerUid}
                            onClick={() => {
                              togglePlayerCalled(player.playerUid);
                              handleIntroPlayerToScreen(player);
                            }}
                            className={`p-4 sm:p-5 rounded-2xl cursor-pointer transition-all border-2 active:scale-[0.99] ${
                              isCalled
                                ? "bg-slate-900/90 border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                                : isSelected
                                ? "bg-slate-800 border-indigo-500 shadow-xl"
                                : "bg-slate-900 border-slate-800 hover:border-amber-400/60 hover:shadow-xl"
                            }`}
                          >
                            <div className="flex items-start gap-4 sm:gap-6">
                              {/* 선수 번호 대형 뱃지 */}
                              <div
                                className={`min-w-[85px] sm:min-w-[110px] py-2.5 px-2 rounded-2xl flex flex-col items-center justify-center border-2 shadow-inner transition-colors ${
                                  isCalled
                                    ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                                    : "bg-slate-800 border-indigo-500/60 text-indigo-300"
                                }`}
                              >
                                <span className={`font-black ${textClasses.playerNum} leading-none`}>
                                  {player.playerNumber}
                                </span>
                                <span className="text-[11px] font-bold mt-1 text-slate-400">
                                  {isCalled ? "소개중 ✓" : "선수번호"}
                                </span>
                              </div>

                              {/* 선수 정보 및 소개 멘트 */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-baseline gap-3">
                                    <span className={`font-black text-white hover:text-amber-300 transition-colors ${textClasses.playerName}`}>
                                      {player.playerName}
                                    </span>
                                    <span className={`font-bold text-slate-400 ${textClasses.playerGym}`}>
                                      {player.playerGym || "무소속"}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {isCalled ? (
                                      <span className="flex items-center gap-1 text-xs font-black text-emerald-300 bg-emerald-950/90 px-3 py-1 rounded-full border border-emerald-600 shadow-sm">
                                        <CheckCircleFilled className="text-emerald-400" /> 전광판 소개됨
                                      </span>
                                    ) : (
                                      <span className="text-xs font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
                                        터치하여 전광판 소개
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 출전 동기 / 소개 멘트 박스 */}
                                {(player.playerText || player.playerMotivation) && (
                                  <div className="mt-3 p-3 sm:p-3.5 rounded-xl bg-slate-950 border-l-4 border-indigo-500 text-slate-300">
                                    <div className="text-xs font-bold text-indigo-400 mb-1 flex items-center gap-1">
                                      <span>🎙️</span>
                                      <span>소개 멘트 / 출전 동기:</span>
                                    </div>
                                    <div className={`${textClasses.playerText} leading-relaxed whitespace-pre-wrap`}>
                                      {player.playerText || player.playerMotivation}
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
                    <div className="py-12 text-center text-slate-500 font-bold text-lg">
                      참가한 선수가 없습니다.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ContestMonitoringHost;
