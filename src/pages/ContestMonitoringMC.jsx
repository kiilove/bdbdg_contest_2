"use client";

import React, { useContext, useEffect, useState } from "react";
import {
  Mic,
  Monitor,
  Timer,
  BarChart3,
  ListOrdered,
  Trophy,
  Award,
  Users,
  Play,
  Send,
} from "lucide-react";
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { BibTag, StatusDot } from "../components/ui/BibTag";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import {
  MonitoringBlockingState,
  MonitoringDiagnosticsBar,
} from "../components/monitoring/MonitoringDiagnosticsBar";

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

const ContestMonitoringMC = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const contestId =
    currentContest?.contests?.id || currentContest?.id || "";

  const [isLoading, setIsLoading] = useState(true);
  const [currentStageId, setCurrentStageId] = useState("");
  const [varStageTitle, setVarStageTitle] = useState("");
  const [allStages, setAllStages] = useState([]);
  const [allFinalPlayers, setAllFinalPlayers] = useState([]);
  const [, setStageInfo] = useState({});
  const [playersArray, setPlayersArray] = useState([]);
  const [selectedCalloutPlayers, setSelectedCalloutPlayers] = useState([]);
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});

  const openNotice = (config) => {
    setModalMessage({ isButton: true, confirmButtonText: "확인", ...config });
    setMsgOpen(true);
  };

  const fetchStagesQuery = useFirestoreQuery();
  const fetchPlayers = useFirestoreQuery();
  const fetchFinalPlayersDoc = useFirestoreGetDocument("contest_players_final");

  // 실시간 무대 진행 상태 구독
  const { data: currentStageRealtime } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );

  // 실시간 전광판 송출 상태 구독 및 제어
  const { data: broadcastData } = useFirebaseRealtimeGetDocument(
    contestId ? `currentBroadcast/${contestId}` : null
  );
  const updateBroadcast = useFirebaseRealtimeUpdateData();

  const currentMode = broadcastData?.mode || "STANDBY";

  // 0. 사전 무대 및 최종선수 풀 로드 (무대 개시 전에도 준비도 진단 가능)
  const preloadContestPools = async () => {
    if (!contestId) {
      setAllStages([]);
      setAllFinalPlayers([]);
      setIsLoading(false);
      return;
    }
    try {
      const stageData = await fetchStagesQuery.getDocuments(
        "contest_stages_assign",
        [where("contestId", "==", contestId)]
      );
      if (stageData?.length > 0) {
        setStageInfo({ ...stageData[0] });
        setAllStages(stageData[0]?.stages || []);
      } else {
        setAllStages([]);
      }

      const finalDocId =
        currentContest?.contests?.contestPlayersFinalId || "";
      if (finalDocId) {
        const finalDoc = await fetchFinalPlayersDoc.getDocument(finalDocId);
        const cleanPlayers = (finalDoc?.players || []).filter(
          (p) => p && p.playerNoShow !== true
        );
        setAllFinalPlayers(cleanPlayers);
      } else {
        setAllFinalPlayers([]);
      }
    } catch (err) {
      console.error("사전 무대/선수 데이터 로드 실패:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 1. 현재 무대 종목/체급 로드
  const loadStageData = async (cId, sId) => {
    if (!cId || !sId) return;
    try {
      const condition = [where("contestId", "==", cId)];
      const data = await fetchStagesQuery.getDocuments(
        "contest_stages_assign",
        condition
      );
      if (data?.length > 0) {
        setStageInfo({ ...data[0] });
        setAllStages(data[0]?.stages || []);
        const currentStage = data[0].stages?.find((s) => s.stageId === sId);
        if (currentStage?.grades?.length > 0) {
          if (currentStage.grades.length === 1) {
            const g = currentStage.grades[0];
            setVarStageTitle(
              `${g.categoryTitle || currentStage.categoryTitle || ""} ${
                g.gradeTitle || ""
              }`.trim()
            );
          } else {
            const catTitle =
              currentStage.categoryTitle ||
              currentStage.grades[0]?.categoryTitle ||
              "";
            const joinedGrades = currentStage.grades
              .map((g) => g?.gradeTitle || "")
              .filter(Boolean)
              .join(" · ");
            setVarStageTitle(
              currentStage.stageTitle ||
                `${catTitle} (${joinedGrades} 통합)`.trim()
            );
          }
          const gradeIds = currentStage.grades
            .map((g) => g?.gradeId)
            .filter(Boolean);
          await fetchPlayersList(cId, gradeIds);
        } else {
          setVarStageTitle(
            currentStage?.stageTitle ||
              (currentStageRealtime?.categoryTitle
                ? `${currentStageRealtime.categoryTitle} ${
                    currentStageRealtime.gradeTitle || ""
                  }`.trim()
                : "진행 종목 대기 중")
          );
          setPlayersArray([]);
        }
      }
    } catch (error) {
      console.error("무대 정보 로드 실패:", error);
    }
  };

  // 2. 출전 선수 목록 로드 (contest_players_final 우선 + contest_entrys_list 사진 병합)
  const fetchPlayersList = async (cId, gradeIds) => {
    const ids = (Array.isArray(gradeIds) ? gradeIds : [gradeIds]).filter(
      Boolean
    );
    if (!cId || ids.length === 0) {
      setPlayersArray([]);
      return;
    }
    try {
      const perGradePlayers = await Promise.all(
        ids.map((gId) =>
          fetchPlayers.getDocuments("contest_entrys_list", [
            where("contestId", "==", cId),
            where("contestGradeId", "==", gId),
          ])
        )
      );
      const entryDocs = perGradePlayers
        .flat()
        .filter((p) => p && p.playerNoShow !== true);

      const entryByUid = new Map();
      entryDocs.forEach((e) => {
        if (e?.playerUid) entryByUid.set(e.playerUid, e);
      });

      const idSet = new Set(ids);
      const finalMatched = allFinalPlayers.filter((p) =>
        idSet.has(p.contestGradeId)
      );

      const baseList =
        finalMatched.length > 0
          ? finalMatched.map((fp) => {
              const entry = fp?.playerUid
                ? entryByUid.get(fp.playerUid)
                : null;
              return entry ? { ...entry, ...fp } : fp;
            })
          : entryDocs;

      const seen = new Set();
      const deduped = baseList.filter((p) => {
        const key = String(
          p.playerUid || p.id || `${p.contestGradeId}-${p.playerNumber}`
        );
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setPlayersArray(
        deduped.sort(
          (a, b) =>
            (Number(a.playerIndex) || Number(a.playerNumber) || 0) -
            (Number(b.playerIndex) || Number(b.playerNumber) || 0)
        )
      );
    } catch (error) {
      console.error("선수 목록 로드 실패:", error);
      setPlayersArray([]);
    }
  };

  useEffect(() => {
    preloadContestPools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId, currentContest?.contests?.contestPlayersFinalId]);

  useEffect(() => {
    const nextStageId = currentStageRealtime?.stageId || "";
    setCurrentStageId((prev) => {
      if (prev !== nextStageId) {
        setSelectedCalloutPlayers([]);
      }
      return nextStageId;
    });
    if (!nextStageId) {
      setVarStageTitle("");
      setPlayersArray([]);
    }
  }, [currentStageRealtime?.stageId]);

  useEffect(() => {
    if (contestId && currentStageId) {
      loadStageData(contestId, currentStageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId, currentStageId, allFinalPlayers.length]);

  // 전광판 방송 모드 즉시 스위칭 핸들러
  const handleSwitchMode = async (mode, extraData = {}) => {
    if (!contestId) {
      openNotice({
        variant: "error",
        title: "대회 정보 없음",
        body: "대회 정보를 불러올 수 없습니다.",
      });
      return;
    }

    try {
      const payload = {
        mode,
        updatedAt: Date.now(),
        ...extraData,
      };

      await updateBroadcast.updateData(
        `currentBroadcast/${contestId}`,
        payload
      );
    } catch (error) {
      console.error("방송 모드 전환 실패:", error);
      openNotice({
        variant: "error",
        title: "전광판 송출 오류",
        body: "전광판 송출 전환 중 오류가 발생했습니다.",
      });
    }
  };

  // 특정 선수 단독 소개 송출
  const handleIntroPlayer = (player) => {
    const rawPhotos = [
      player.stagePhoto1,
      player.stagePhotoUrl1,
      player.stagePhoto2,
      player.stagePhotoUrl2,
      ...(Array.isArray(player.photos) ? player.photos : []),
      ...(Array.isArray(player.playerPhotos) ? player.playerPhotos : []),
      player.profileImageUrl,
      player.playerPhoto,
      player.photoUrl,
    ].filter((u) => typeof u === "string" && u.trim().length > 5);

    let stage1 = player.stagePhoto1 || player.stagePhotoUrl1 || "";
    let stage2 =
      player.stagePhoto2 ||
      player.stagePhotoUrl2 ||
      player.backgroundPhotoUrl ||
      "";

    if (!stage1 && rawPhotos.length > 0) stage1 = rawPhotos[0];
    if (!stage2 && rawPhotos.length > 1) stage2 = rawPhotos[1];

    const primary =
      stage1 ||
      rawPhotos[0] ||
      player.profileImageUrl ||
      player.playerPhoto ||
      player.photoUrl ||
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
      photos: rawPhotos,
    };

    handleSwitchMode("ATHLETE_INTRO", {
      player: playerObj,
      activePlayer: playerObj,
    });
  };

  // 비교심사 호명 송출
  const handleSendCallout = () => {
    if (selectedCalloutPlayers.length === 0) {
      openNotice({
        variant: "warning",
        title: "호명 선수 선택 필요",
        body: "비교심사할 선수를 1명 이상 선택해 주세요.",
      });
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

  // 1위 우승자 단독 세레모니 송출
  const handleShowcaseChampion = (player) => {
    const champ = player ||
      playersArray[0] || {
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

    const primary =
      rawPhotos[0] ||
      champ.profileImageUrl ||
      champ.playerPhoto ||
      champ.photoUrl ||
      "";

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

  const togglePlayerSelect = (pNum) => {
    setSelectedCalloutPlayers((prev) =>
      prev.includes(pNum) ? prev.filter((n) => n !== pNum) : [...prev, pNum]
    );
  };

  const modeLabelMap = {
    STANDBY: "대기 및 종목 안내",
    ATHLETE_INTRO: "선수 단독 소개 중",
    COMPARISON_CALLOUT: "비교심사 호명 중",
    POSEDOWN: "포즈다운 배틀 중",
    COMMERCIAL: "점수 집계 중",
    RANKING: "순위 발표 중",
    AWARD_CEREMONY: "공식 시상식",
    CHAMPION_SHOWCASE: "1위 챔피언 세레모니",
  };

  const modeLabel = modeLabelMap[currentMode] || currentMode;

  if (isLoading) {
    return <LoadingPage />;
  }

  const scenes = [
    {
      mode: "STANDBY",
      label: "대기 화면",
      icon: Monitor,
      onClick: () => handleSwitchMode("STANDBY"),
    },
    {
      mode: "POSEDOWN",
      label: "포즈다운",
      icon: Timer,
      onClick: () => handleSwitchMode("POSEDOWN"),
    },
    {
      mode: "COMMERCIAL",
      label: "점수 집계 중",
      icon: BarChart3,
      onClick: () => handleSwitchMode("COMMERCIAL"),
    },
    {
      mode: "RANKING",
      label: "순위 발표",
      icon: ListOrdered,
      onClick: () => handleSwitchMode("RANKING"),
    },
    {
      mode: "AWARD_CEREMONY",
      label: "공식 시상식",
      icon: Trophy,
      onClick: () => handleSwitchMode("AWARD_CEREMONY"),
    },
    {
      mode: "CHAMPION_SHOWCASE",
      label: "1위 단독 송출",
      icon: Award,
      onClick: () => handleShowcaseChampion(),
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#141415] text-[#ededed] select-none flex flex-col">
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />
      {/* 1. 상단 글로벌 헤더 (#0f0f10 deepest) */}
      <header className="bg-[#0f0f10] border-b border-[#ededed]/[0.08] px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-[10px] bg-[#232325] border border-[#ededed]/[0.08] flex items-center justify-center shrink-0">
            <Mic size={18} strokeWidth={1.5} className="text-[#a1a1a6]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#85858b]">
              사회자 방송 제어 콘솔
            </div>
            <h1 className="text-base sm:text-lg font-semibold text-[#ededed] m-0 truncate">
              {currentContest?.contests?.contestTitle ||
                "2026 보디빌딩 챔피언십"}
            </h1>
            <div className="text-xs font-medium text-[#a1a1a6] flex items-center gap-2 pt-1">
              <StatusDot
                status={varStageTitle ? "live" : "idle"}
                live={Boolean(varStageTitle)}
              />
              <span>{varStageTitle || "진행 종목 대기 중"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[#19191b] border border-[#ededed]/[0.08] px-4 py-2.5 rounded-[10px] shrink-0">
          <Monitor size={16} strokeWidth={1.5} className="text-[#85858b]" />
          <div>
            <span className="text-[11px] text-[#85858b] block">
              전광판 실시간 송출 상태
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusDot
                status={currentMode === "STANDBY" ? "idle" : "live"}
                live={currentMode !== "STANDBY"}
              />
              <span className="text-sm font-medium text-[#ededed]">
                {modeLabel}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-5 flex-1">
        {/* 운영 데이터 점검 및 빠른 보강 바 */}
        <MonitoringDiagnosticsBar
          variant="dark"
          screenType="mc"
          stagesCount={allStages.length}
          playersCount={allFinalPlayers.length}
          realtimeData={currentStageRealtime}
          currentStagePlayersCount={
            currentStageRealtime?.stageId ? playersArray.length : undefined
          }
          onRefreshData={() => {
            preloadContestPools();
            if (contestId && currentStageId) {
              loadStageData(contestId, currentStageId);
            }
          }}
        />

        {/* 2. 원터치 방송 제어 스튜디오 스위처 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {scenes.map((scene) => {
            const Icon = scene.icon;
            const isActive = currentMode === scene.mode;
            return (
              <button
                key={scene.mode}
                type="button"
                onClick={scene.onClick}
                className={`flex items-center justify-center gap-2 h-12 px-3 rounded-[10px] font-medium text-sm transition-colors active:scale-[0.98] cursor-pointer border ${
                  isActive
                    ? "bg-[#2563eb] text-white border-[#2563eb]"
                    : "bg-[#19191b] hover:bg-[#232325] text-[#ededed] border-[#ededed]/[0.08]"
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

        {/* 3. 선수 단독 소개 & 비교심사 컨트롤 패널 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 좌측 (2열): 출전 선수 터치 카드 그리드 */}
          <div className="lg:col-span-2 bg-[#19191b] border border-[#ededed]/[0.08] rounded-[12px] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ededed]/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <Users size={16} strokeWidth={1.5} className="text-[#85858b]" />
                <span className="font-semibold text-sm text-[#ededed]">
                  출전 선수 명단 및 단독 소개
                </span>
                <span className="font-mono tabular-nums text-xs text-[#a1a1a6] bg-[#232325] px-2 py-0.5 rounded-[4px] border border-[#ededed]/[0.08]">
                  {playersArray.length}명
                </span>
              </div>
              <span className="text-xs text-[#85858b]">
                번호 영역 선택 시 비교심사 지정 · 소개 송출 시 전광판 전환
              </span>
            </div>

            {playersArray.length === 0 ? (
              <MonitoringBlockingState
                variant="dark"
                screenType="mc"
                screenLabel="사회자 방송 제어 콘솔"
                stagesCount={allStages.length}
                playersCount={allFinalPlayers.length}
                realtimeData={currentStageRealtime}
                currentStagePlayersCount={
                  currentStageRealtime?.stageId ? 0 : undefined
                }
                onRefreshData={() => {
                  preloadContestPools();
                  if (contestId && currentStageId) {
                    loadStageData(contestId, currentStageId);
                  }
                }}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
                {playersArray.map((player) => {
                  const isSelected = selectedCalloutPlayers.includes(
                    player.playerNumber
                  );
                  return (
                    <div
                      key={player.playerNumber || player.playerUid}
                      className={`flex items-center justify-between p-3 rounded-[10px] border transition-colors ${
                        isSelected
                          ? "bg-[#2563eb]/10 border-[#2563eb]"
                          : "bg-[#232325] hover:bg-[#2a2a2d] border-[#ededed]/[0.08]"
                      }`}
                    >
                      <div
                        onClick={() => togglePlayerSelect(player.playerNumber)}
                        className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                      >
                        <BibTag
                          variant={isSelected ? "active" : "dark"}
                          size="lg"
                          prefix="#"
                          number={player.playerNumber}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#ededed] truncate">
                            {player.playerName}
                          </div>
                          <div className="text-xs text-[#a1a1a6] truncate">
                            {player.playerGym || "무소속"}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleIntroPlayer(player)}
                        className="h-8 px-3 rounded-[6px] bg-[#ededed] hover:bg-white active:scale-[0.98] text-[#141415] font-medium text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <Play size={14} strokeWidth={1.5} />
                        <span>소개 송출</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 우측 (1열): 비교심사 호명 & 규정 포즈 대본 */}
          <div className="bg-[#19191b] border border-[#ededed]/[0.08] rounded-[12px] p-5 flex flex-col justify-between gap-5">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#ededed]/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Users
                    size={16}
                    strokeWidth={1.5}
                    className="text-[#85858b]"
                  />
                  <span className="font-semibold text-sm text-[#ededed]">
                    비교심사 호명 컨트롤
                  </span>
                </div>
                <span className="font-mono tabular-nums text-xs font-medium text-[#4cc38a]">
                  선택 {selectedCalloutPlayers.length}명
                </span>
              </div>

              <p className="text-xs text-[#a1a1a6] m-0 leading-5">
                좌측 명단에서 비교심사 대상 선수를 선택한 뒤 전광판에 송출하세요
              </p>

              {selectedCalloutPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-[8px] bg-[#141415] border border-[#ededed]/[0.08]">
                  {selectedCalloutPlayers.map((num) => (
                    <BibTag key={num} variant="dark" size="sm" number={num} />
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleSendCallout}
                disabled={selectedCalloutPlayers.length === 0}
                className={`w-full h-11 rounded-[8px] font-medium text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98] ${
                  selectedCalloutPlayers.length > 0
                    ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white cursor-pointer"
                    : "bg-[#232325] text-[#85858b] border border-[#ededed]/[0.08] cursor-not-allowed"
                }`}
              >
                <Send size={16} strokeWidth={1.5} />
                <span>비교심사 호명 전광판 송출</span>
              </button>
            </div>

            {/* 규정 포즈 진행 멘트 */}
            <div className="bg-[#141415] border border-[#ededed]/[0.08] rounded-[10px] p-4 space-y-2.5">
              <span className="text-xs font-medium text-[#a1a1a6] block">
                규정 포즈 진행 대본
              </span>
              <div className="max-h-[200px] overflow-y-auto space-y-1.5 text-xs text-[#ededed] pr-1">
                {POSES_GUIDE.map((pose, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 rounded-[6px] bg-[#19191b] border border-[#ededed]/[0.06] tabular-nums"
                  >
                    {pose}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContestMonitoringMC;
