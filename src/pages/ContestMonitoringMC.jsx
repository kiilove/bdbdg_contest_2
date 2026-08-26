"use client";

import React, { useContext, useEffect, useState } from "react";
import { ref, get, child } from "firebase/database";
import { database } from "../firebase";
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import {
  Card,
  Typography,
  Space,
  Tag,
  Button,
  message,
  Tabs,
  Badge,
} from "antd";
import {
  TrophyOutlined,
  UserOutlined,
  FireOutlined,
  NotificationOutlined,
  CrownOutlined,
  DesktopOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  SoundOutlined,
  ForwardOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

// 규정 포즈 멘트 가이드 (사회자 진행용)
const POSES_GUIDE = [
  "호명된 선수들은 무대 중앙으로 나와 라인업 해주시기 바랍니다.",
  "1. LINE UP (기본 라인업 자세)",
  "2. FRONT DOUBLE BICEPS (전면 이두근)",
  "3. FRONT LAT SPREAD (전면 광배근)",
  "4. SIDE CHEST (측면 가슴)",
  "5. BACK DOUBLE BICEPS (후면 이두근)",
  "6. BACK LAT SPREAD (후면 광배근)",
  "7. SIDE TRICEPS (측면 삼두근)",
  "8. ABDOMINALS & THIGHS (복근 및 대퇴부)",
  "호명된 선수들은 제자리로 복귀해 주시기 바랍니다.",
];

// 필요한 필드값을 가져오는 함수
const fetchSpecificFields = async (path, fields) => {
  const dbRef = ref(database);
  const result = {};
  for (const field of fields) {
    const fieldPath = `${path}/${field}`;
    try {
      const snapshot = await get(child(dbRef, fieldPath));
      if (snapshot.exists()) {
        result[field] = snapshot.val();
      }
    } catch (error) {
      console.error(`데이터 로드 오류: ${field}`, error);
    }
  }
  return result;
};

const ContestMonitoringMC = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const contestId = currentContest?.contests?.id || "";

  const [isLoading, setIsLoading] = useState(true);
  const [currentStageId, setCurrentStageId] = useState("");
  const [varStageTitle, setVarStageTitle] = useState("");
  const [stageInfo, setStageInfo] = useState({});
  const [playersArray, setPlayersArray] = useState([]);
  const [selectedCalloutPlayers, setSelectedCalloutPlayers] = useState([]);

  const fetchStagesQuery = useFirestoreQuery();
  const fetchPlayers = useFirestoreQuery();
  const fetchRankingsQuery = useFirestoreQuery();

  // 📡 실시간 전광판 송출 상태 구독 및 제어
  const { data: broadcastData } = useFirebaseRealtimeGetDocument(
    contestId ? `currentBroadcast/${contestId}` : null
  );
  const updateBroadcast = useFirebaseRealtimeUpdateData();

  const currentMode = broadcastData?.mode || "STANDBY";

  // 1. 현재 무대 종목/체급 로드
  const loadStageData = async (cId, sId) => {
    if (!cId || !sId) return;
    try {
      const condition = [where("contestId", "==", cId)];
      const data = await fetchStagesQuery.getDocuments("contest_stages_assign", condition);
      if (data?.length > 0) {
        setStageInfo({ ...data[0] });
        const currentStage = data[0].stages?.find((s) => s.stageId === sId);
        if (currentStage?.grades?.length === 1) {
          const g = currentStage.grades[0];
          setVarStageTitle(`${g.categoryTitle} ${g.gradeTitle}`);
          fetchPlayersList(cId, g.gradeId);
        } else {
          setVarStageTitle(currentStage?.stageTitle || "통합 체급 경기");
        }
      }
    } catch (error) {
      console.error("무대 정보 로드 실패:", error);
    }
  };

  // 2. 출전 선수 목록 로드
  const fetchPlayersList = async (cId, gradeId) => {
    try {
      const condition = [
        where("contestId", "==", cId),
        where("contestGradeId", "==", gradeId),
      ];
      const players = await fetchPlayers.getDocuments("contest_entrys_list", condition);
      setPlayersArray(
        players.sort((a, b) => (Number(a.playerNumber) || 0) - (Number(b.playerNumber) || 0))
      );
    } catch (error) {
      console.error("선수 목록 로드 실패:", error);
      setPlayersArray([]);
    }
  };

  useEffect(() => {
    if (contestId) {
      setIsLoading(false);
      const path = `currentStage/${contestId}`;
      fetchSpecificFields(path, ["stageId"]).then((data) => {
        if (data.stageId) {
          setCurrentStageId(data.stageId);
        }
      });
    }
  }, [contestId]);

  useEffect(() => {
    if (contestId && currentStageId) {
      loadStageData(contestId, currentStageId);
    }
  }, [contestId, currentStageId]);

  // 📡 전광판 방송 모드 즉시 스위칭 핸들러
  const handleSwitchMode = async (mode, extraData = {}) => {
    if (!contestId) {
      message.error("대회 정보를 불러올 수 없습니다.");
      return;
    }

    try {
      const payload = {
        mode,
        updatedAt: Date.now(),
        ...extraData,
      };

      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, payload);

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

  // 👤 특정 선수 단독 소개 송출 (playerUid 기반 사진 및 photos 배열 완벽 송출)
  const handleIntroPlayer = (player) => {
    const rawPhotos = [
      ...(Array.isArray(player.photos) ? player.photos : []),
      ...(Array.isArray(player.playerPhotos) ? player.playerPhotos : []),
      player.profileImageUrl,
      player.playerPhoto,
      player.photoUrl,
    ].filter((u) => typeof u === "string" && u.trim().length > 5);

    const primary = rawPhotos[0] || player.profileImageUrl || player.playerPhoto || player.photoUrl || "";

    const playerObj = {
      playerUid: player.playerUid || "",
      playerNumber: player.playerNumber || "100",
      playerName: player.playerName || "",
      playerGym: player.playerGym || "",
      profileImageUrl: primary,
      photoUrl: primary,
      playerMotivation: player.playerMotivation || player.playerText || "",
      photos: rawPhotos,
    };

    handleSwitchMode("ATHLETE_INTRO", {
      player: playerObj,
      activePlayer: playerObj,
    });
  };

  // ⚔️ 비교심사 호명 송출
  const handleSendCallout = () => {
    if (selectedCalloutPlayers.length === 0) {
      message.warning("비교심사할 선수를 1명 이상 선택해 주세요.");
      return;
    }
    const calloutList = playersArray.filter((p) =>
      selectedCalloutPlayers.includes(p.playerNumber)
    );
    handleSwitchMode("COMPARISON_CALLOUT", {
      calloutData: {
        calloutTitle: "1차 비교심사 (FIRST CALLOUT)",
        players: calloutList,
      },
    });
  };

  // 👑 1위 우승자 단독 세레모니 송출 (playerUid 기반 사진 및 photos 배열 완벽 송출)
  const handleShowcaseChampion = (player) => {
    const champ = player || playersArray[0] || {
      playerNumber: "100",
      playerName: "김재준",
      playerGym: "Get_in",
    };

    const rawPhotos = [
      ...(Array.isArray(champ.photos) ? champ.photos : []),
      ...(Array.isArray(champ.playerPhotos) ? champ.playerPhotos : []),
      champ.profileImageUrl,
      champ.playerPhoto,
      champ.photoUrl,
    ].filter((u) => typeof u === "string" && u.trim().length > 5);

    const primary = rawPhotos[0] || champ.profileImageUrl || champ.playerPhoto || champ.photoUrl || "";

    const topPlayerObj = {
      ...champ,
      playerUid: champ.playerUid || "",
      profileImageUrl: primary,
      photoUrl: primary,
      photos: rawPhotos,
    };

    handleSwitchMode("CHAMPION_SHOWCASE", {
      topPlayer: topPlayerObj,
    });
  };

  // 비교심사 선수 선택 토글
  const togglePlayerSelect = (pNum) => {
    setSelectedCalloutPlayers((prev) =>
      prev.includes(pNum) ? prev.filter((n) => n !== pNum) : [...prev, pNum]
    );
  };

  const getModeBadge = (mode) => {
    const config = {
      STANDBY: { label: "대기 / 종목안내", color: "blue" },
      ATHLETE_INTRO: { label: "선수 단독 소개 중", color: "cyan" },
      COMPARISON_CALLOUT: { label: "비교심사 호명 중", color: "purple" },
      POSEDOWN: { label: "🔥 포즈다운 배틀 중", color: "volcano" },
      COMMERCIAL: { label: "📊 점수 집계중 (광고)", color: "orange" },
      RANKING: { label: "🏆 순위 발표 중", color: "gold" },
      CHAMPION_SHOWCASE: { label: "👑 1위 챔피언 세레모니", color: "magenta" },
    };
    return config[mode] || { label: mode, color: "default" };
  };

  const modeBadge = getModeBadge(currentMode);

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 text-white select-none p-3 sm:p-5 lg:p-6 space-y-4">
      
      {/* ========================================================================================= */}
      {/* 📱 1. [태블릿 상단 헤더: 대회명 & 실시간 전광판 송출 모드 상태 뱃지] */}
      {/* ========================================================================================= */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* 좌측: 대회명 & 현재 체급 */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shrink-0">
            <TrophyOutlined />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/30">
                LIVE MC STAGE CONTROLLER
              </span>
              <span className="text-xs text-slate-400 font-bold hidden sm:inline">
                사회자 태블릿 방송 콘솔
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white m-0 tracking-tight">
              {currentContest?.contests?.contestTitle || "2026 보디빌딩 챔피언십"}
            </h1>
            <div className="text-sm font-bold text-amber-300 flex items-center gap-1.5 pt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{varStageTitle || "진행 종목 대기중"}</span>
            </div>
          </div>
        </div>

        {/* 우측: 📡 실시간 전광판 현재 송출 상태 */}
        <div className="flex items-center gap-3 bg-black/60 border border-white/10 px-5 py-3 rounded-2xl shrink-0">
          <DesktopOutlined className="text-cyan-400 text-xl" />
          <div className="text-left">
            <span className="text-[10px] text-slate-400 font-bold block uppercase font-mono">
              전광판 실시간 송출 상태
            </span>
            <Tag color={modeBadge.color} className="font-mono font-black text-sm px-2.5 py-0.5 mr-0 mt-0.5">
              {modeBadge.label}
            </Tag>
          </div>
        </div>

      </div>

      {/* ========================================================================================= */}
      {/* 🚀 2. [원터치 대형 방송 제어 퀵 바 (56px+ 터치 친화 버튼)] */}
      {/* ========================================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        
        {/* ① 대기화면 */}
        <button
          onClick={() => handleSwitchMode("STANDBY")}
          className={`flex items-center justify-center gap-2.5 h-16 rounded-2xl font-black text-base transition-all shadow-lg active:scale-95 ${
            currentMode === "STANDBY"
              ? "bg-blue-600 text-white border-2 border-white"
              : "bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700"
          }`}
        >
          <DesktopOutlined className="text-xl" />
          <span>대기 화면</span>
        </button>

        {/* ② 🔥 포즈다운 60초 */}
        <button
          onClick={() => handleSwitchMode("POSEDOWN")}
          className={`flex items-center justify-center gap-2.5 h-16 rounded-2xl font-black text-base transition-all shadow-lg active:scale-95 ${
            currentMode === "POSEDOWN"
              ? "bg-gradient-to-r from-red-600 to-orange-500 text-white border-2 border-white ring-4 ring-orange-500/30"
              : "bg-gradient-to-r from-red-950 to-orange-950 hover:from-red-900 hover:to-orange-900 text-orange-200 border border-orange-700/50"
          }`}
        >
          <FireOutlined className="text-2xl text-amber-400 animate-bounce" />
          <span>🔥 포즈다운 (60s)</span>
        </button>

        {/* ③ 📊 점수 집계중 (광고) */}
        <button
          onClick={() => handleSwitchMode("COMMERCIAL")}
          className={`flex items-center justify-center gap-2.5 h-16 rounded-2xl font-black text-base transition-all shadow-lg active:scale-95 ${
            currentMode === "COMMERCIAL"
              ? "bg-indigo-600 text-white border-2 border-white ring-4 ring-indigo-500/30"
              : "bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/50"
          }`}
        >
          <NotificationOutlined className="text-xl text-indigo-400" />
          <span>📊 점수 집계중</span>
        </button>

        {/* ④ 🏆 1~3위 순위 발표 */}
        <button
          onClick={() => handleSwitchMode("RANKING")}
          className={`flex items-center justify-center gap-2.5 h-16 rounded-2xl font-black text-base transition-all shadow-lg active:scale-95 ${
            currentMode === "RANKING"
              ? "bg-amber-500 text-slate-950 border-2 border-white font-black"
              : "bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-700/50"
          }`}
        >
          <TrophyOutlined className="text-xl text-amber-400" />
          <span>🏆 순위 발표</span>
        </button>

        {/* ⑤ 👑 1위 챔피언 세레모니 */}
        <button
          onClick={() => handleShowcaseChampion()}
          className={`col-span-2 sm:col-span-1 flex items-center justify-center gap-2.5 h-16 rounded-2xl font-black text-base transition-all shadow-lg active:scale-95 ${
            currentMode === "CHAMPION_SHOWCASE"
              ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 border-2 border-white ring-4 ring-yellow-400/40"
              : "bg-gradient-to-r from-amber-900/80 to-yellow-900/80 hover:from-amber-800 text-amber-200 border border-amber-500/60"
          }`}
        >
          <CrownOutlined className="text-2xl text-amber-300 animate-bounce" />
          <span>👑 1위 송출</span>
        </button>

      </div>

      {/* ========================================================================================= */}
      {/* 👥 3. [선수 단독 소개 & 비교심사 컨트롤 패널] */}
      {/* ========================================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* 좌측 (2열): 👤 무대 위 출전 선수 터치 카드 그리드 (원터치 선수 소개) */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <UserOutlined className="text-amber-400 text-lg" />
              <span className="font-black text-base text-white">
                출전 선수 명단 • 원터치 전광판 선수 소개
              </span>
              <span className="text-xs text-slate-400 font-bold bg-slate-800 px-2.5 py-0.5 rounded-full font-mono">
                {playersArray.length}명
              </span>
            </div>
            <span className="text-xs text-slate-400">
              💡 선수를 터치하면 전광판에 즉시 단독 소개됩니다.
            </span>
          </div>

          {playersArray.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-bold">
              현재 진행 중인 체급에 배정된 선수가 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
              {playersArray.map((player) => {
                const isSelected = selectedCalloutPlayers.includes(player.playerNumber);
                return (
                  <div
                    key={player.playerNumber || player.playerUid}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-400/60 transition-all shadow-md group"
                  >
                    {/* 선수 정보 */}
                    <div
                      onClick={() => togglePlayerSelect(player.playerNumber)}
                      className="flex items-center gap-3 cursor-pointer flex-1"
                    >
                      <span
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono font-black text-lg shadow-md transition-all ${
                          isSelected
                            ? "bg-purple-600 text-white ring-2 ring-purple-400"
                            : "bg-slate-800 text-amber-400 group-hover:bg-amber-400 group-hover:text-slate-950"
                        }`}
                      >
                        #{player.playerNumber}
                      </span>
                      <div className="text-left">
                        <div className="text-base font-black text-white group-hover:text-amber-300">
                          {player.playerName}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[140px]">
                          {player.playerGym || "무소속"}
                        </div>
                      </div>
                    </div>

                    {/* 전광판 송출 버튼 */}
                    <button
                      onClick={() => handleIntroPlayer(player)}
                      className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shrink-0"
                    >
                      <PlayCircleOutlined />
                      <span>소개 송출</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 우측 (1열): ⚔️ 비교심사 호명 & 사회자 포즈 가이드 대본 */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 flex flex-col justify-between">
          
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <TeamOutlined className="text-purple-400 text-lg" />
                <span className="font-black text-base text-white">
                  비교심사 호명 컨트롤
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-purple-300">
                선택: {selectedCalloutPlayers.length}명
              </span>
            </div>

            <p className="text-xs text-slate-400 m-0">
              좌측 선수 번호를 터치하여 비교심사 대상자를 지정한 후 송출하세요.
            </p>

            {/* 비교심사 송출 버튼 */}
            <button
              onClick={handleSendCallout}
              disabled={selectedCalloutPlayers.length === 0}
              className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 ${
                selectedCalloutPlayers.length > 0
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              }`}
            >
              <ThunderboltOutlined className="text-xl text-yellow-300" />
              <span>비교심사 호명 전광판 송출</span>
            </button>
          </div>

          {/* 사회자 규정 포즈 멘트 가이드 */}
          <div className="bg-black/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
            <span className="text-[11px] font-mono font-black text-amber-400 uppercase block tracking-wider">
              MC POSING GUIDE (규정 포즈 진행 멘트)
            </span>
            <div className="max-h-[190px] overflow-y-auto space-y-1 text-xs text-slate-300 font-medium pr-1">
              {POSES_GUIDE.map((pose, idx) => (
                <div key={idx} className="p-1.5 rounded-lg bg-slate-900/60 border border-white/5">
                  {pose}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default ContestMonitoringMC;
