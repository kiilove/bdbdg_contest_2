"use client";

import React, { useContext, useEffect, useState, useRef } from "react";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../../hooks/useFirebaseRealtime";
import {
  useFirestoreQuery,
  useFirestoreUpdateData,
  useFirestoreAddData,
} from "../../hooks/useFirestores";
import { where } from "firebase/firestore";
import { extractPlayerPhotos, isNonPlayerUrl } from "../../pages/ContestPlayerWeighInTable";
import {
  Card,
  Tag,
  Button,
  Space,
  Typography,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Popconfirm,
  Divider,
  Checkbox,
} from "antd";
import {
  DesktopOutlined,
  PlayCircleOutlined,
  NotificationOutlined,
  TrophyOutlined,
  UserOutlined,
  ForwardOutlined,
  ExportOutlined,
  BgColorsOutlined,
  CrownOutlined,
  StarOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ThunderboltOutlined,
  FireOutlined,
  SoundOutlined,
  AudioMutedOutlined,
  AppstoreOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { THEME_CONFIGS } from "./AthleteIntroScene";

// 기본 특수화면 프리셋
const DEFAULT_SPECIAL_SCREENS = [
  {
    id: "special_overall",
    title: "🏆 그랑프리 (OVERALL) 결정전",
    subTitle: "각 체급 1위 통합 최강자전 공식 심사 결과",
    displayType: "GRAND_PRIX",
    colorTheme: "GOLD",
    players: [
      { playerRank: 1, playerNumber: "-", playerName: "데이터 없음", playerGym: "심사 결과 집계 대기", score: null, note: "통합 그랑프리" },
      { playerRank: 2, playerNumber: "-", playerName: "데이터 없음", playerGym: "심사 결과 집계 대기", score: null, note: "준우승" },
      { playerRank: 3, playerNumber: "-", playerName: "데이터 없음", playerGym: "심사 결과 집계 대기", score: null, note: "3위" },
    ],
  },
  {
    id: "special_best_pose",
    title: "✨ 베스트 포즈상 (BEST POSING)",
    subTitle: "심사위원단 만장일치 최고 포징 아티스트",
    displayType: "SPECIAL_AWARD",
    colorTheme: "PURPLE",
    players: [
      { playerNumber: "-", playerName: "데이터 없음", playerGym: "심사 결과 집계 대기", note: "베스트 포즈상" },
    ],
  },
];

const POSES_PRESET = [
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

const StageBroadcastController = ({
  currentStage,
  currentPlayers = [],
  rankingResults = [],
}) => {
  const { currentContest } = useContext(CurrentContestContext);
  const contestId =
    currentContest?.contests?.id ||
    currentContest?.contestInfo?.id ||
    currentContest?.id ||
    currentStage?.contestId ||
    "";

  const { data: broadcastData } = useFirebaseRealtimeGetDocument(
    contestId ? `currentBroadcast/${contestId}` : null
  );

  const updateBroadcast = useFirebaseRealtimeUpdateData();
  const fetchResultQuery = useFirestoreQuery();
  const updateSpecialQuery = useFirestoreUpdateData("contest_special_screens");
  const addSpecialQuery = useFirestoreAddData("contest_special_screens");

  const [specialScreens, setSpecialScreens] = useState(DEFAULT_SPECIAL_SCREENS);
  const [specialDocId, setSpecialDocId] = useState(null);
  const [isSpecialModalOpen, setIsSpecialModalOpen] = useState(false);
  const [editingSpecialIdx, setEditingSpecialIdx] = useState(null);
  const [specialForm] = Form.useForm();

  // ⚔️ 비교심사 모달 상태
  const [isCalloutModalOpen, setIsCalloutModalOpen] = useState(false);
  const [selectedCalloutPlayers, setSelectedCalloutPlayers] = useState([]);
  const [calloutRound, setCalloutRound] = useState("1차 비교심사 (FIRST CALLOUT)");
  const [calloutPose, setCalloutPose] = useState(POSES_PRESET[0]);

  const currentMode = broadcastData?.mode || "STANDBY";
  const activePlayer = broadcastData?.activePlayer || null;
  const currentTheme = broadcastData?.colorTheme || "GOLD";
  const currentSpecialId = broadcastData?.specialScreenData?.id || null;

  // 🏆 통합 무대(2개 이상 체급 결합) 감지 및 개별 체급 시상 선택 상태
  const stageGrades = currentStage?.grades || [];
  const isIntegratedStage = stageGrades.length > 1;
  const [selectedGradeId, setSelectedGradeId] = useState("");

  useEffect(() => {
    if (stageGrades.length > 0) {
      setSelectedGradeId(stageGrades[0]?.gradeId || "");
    } else {
      setSelectedGradeId(currentStage?.gradeId || "");
    }
  }, [currentStage?.gradeId, stageGrades.length]);

  // 현재 시상 대상으로 선택된 개별 체급 정보 도출
  const activeGradeObj =
    stageGrades.find((g) => g.gradeId === selectedGradeId) ||
    stageGrades[0] ||
    null;
  const activeGradeTitle =
    activeGradeObj?.gradeTitle || currentStage?.gradeTitle || currentStage?.contestGradeTitle || "";
  const activeGradeId =
    activeGradeObj?.gradeId || currentStage?.gradeId || stageGrades[0]?.gradeId || "";
  const activeCategoryTitle =
    activeGradeObj?.categoryTitle || currentStage?.categoryTitle || currentStage?.contestCategoryTitle || "공식 시상식";

  const [invoicePhotoMap, setInvoicePhotoMap] = useState(new Map());

  // 📥 invoices_pool 원본 참가신청서 사진 직접 로드 (선수 명단 사진 누락 100% 방지)
  useEffect(() => {
    if (!contestId) return;
    const loadInvoicePhotos = async () => {
      try {
        const invoices = await fetchResultQuery.getDocuments("invoices_pool", [
          where("contestId", "==", contestId),
        ]);
        const map = new Map();
        (invoices || []).forEach((inv) => {
          const photos = extractPlayerPhotos(inv);
          if (photos.length > 0) {
            if (inv.playerUid) map.set(inv.playerUid, photos);
            if (inv.playerName) {
              const trimmed = inv.playerName.trim();
              if (!map.has(trimmed)) map.set(trimmed, photos);
              const telPart = (inv.playerTel || "").replace(/[^0-9]/g, "").slice(-4);
              if (telPart) map.set(`${trimmed}_${telPart}`, photos);
            }
          }
        });
        setInvoicePhotoMap(map);
      } catch (err) {
        console.warn("전광판 제어기: 신청서 사진 로드 실패:", err);
      }
    };
    loadInvoicePhotos();
  }, [contestId]);

  const getPlayerResolvedPhotos = (player) => {
    if (!player) return [];
    const directPhotos = extractPlayerPhotos(player);
    const invoicePhotos = [
      ...(player.playerUid && invoicePhotoMap.has(player.playerUid)
        ? invoicePhotoMap.get(player.playerUid)
        : []),
      ...(player.playerName && invoicePhotoMap.has(player.playerName.trim())
        ? invoicePhotoMap.get(player.playerName.trim())
        : []),
    ];

    const all = [
      (!isNonPlayerUrl(player.stagePhotoUrl) && player.stagePhotoUrl) || "",
      ...directPhotos,
      ...invoicePhotos,
    ]
      .filter((u) => typeof u === "string" && u.trim().length > 5)
      .filter((u) => !isNonPlayerUrl(u));

    return Array.from(new Set(all));
  };

  // 1. 특수화면 목록 DB 로드
  const fetchSpecialScreens = async () => {
    if (!contestId) return;
    try {
      const condition = [where("contestId", "==", contestId)];
      const data = await fetchResultQuery.getDocuments(
        "contest_special_screens",
        condition
      );
      if (data && data.length > 0 && data[0]?.screens) {
        setSpecialDocId(data[0].id);
        setSpecialScreens(data[0].screens);
      } else {
        setSpecialDocId(null);
        setSpecialScreens(DEFAULT_SPECIAL_SCREENS);
      }
    } catch (error) {
      console.error("특수화면 로드 오류:", error);
    }
  };

  useEffect(() => {
    fetchSpecialScreens();
  }, [contestId]);

  // 특수화면 저장
  const handleSaveSpecialScreensToDb = async (newScreens) => {
    if (!contestId) return;
    try {
      if (specialDocId) {
        await updateSpecialQuery.updateData(specialDocId, {
          contestId,
          screens: newScreens,
          updatedAt: Date.now(),
        });
      } else {
        await addSpecialQuery.addData({
          contestId,
          screens: newScreens,
          createdAt: Date.now(),
        });
      }
      setSpecialScreens(newScreens);
      message.success("특수화면 설정이 저장되었습니다.");
      fetchSpecialScreens();
    } catch (error) {
      console.error("특수화면 저장 실패:", error);
      message.error("저장 중 오류가 발생했습니다.");
    }
  };

  // 실제 대회명 추출
  const realContestTitle =
    currentContest?.contestInfo?.contestTitle ||
    currentContest?.contests?.contestTitle ||
    currentStage?.contestTitle ||
    "";

  // 테마 색상 변경 핸들러
  const handleSelectTheme = async (themeKey) => {
    if (!contestId) return;
    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, {
        colorTheme: themeKey,
        contestTitle: realContestTitle,
        updatedAt: Date.now(),
      });
      message.success(`전광판 색상 테마: [${THEME_CONFIGS[themeKey]?.name}] 적용!`);
    } catch (error) {
      console.error("테마 변경 오류:", error);
    }
  };

  // 🔊 전광판 사운드 ON/OFF 토글 핸들러
  const isAudioEnabled = Boolean(broadcastData?.isAudioEnabled);
  const handleToggleAudio = async () => {
    if (!contestId) return;
    try {
      const nextState = !isAudioEnabled;
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, {
        isAudioEnabled: nextState,
        updatedAt: Date.now(),
      });
      message.success(nextState ? "전광판 사운드: [ON - 음향 출력]" : "전광판 사운드: [OFF - 음소거]");
    } catch (error) {
      console.error("사운드 변경 오류:", error);
    }
  };

  // 🔄 종목이나 체급(무대) 변경 시 무조건 전광판 화면을 [대기 및 종목/체급 안내(STANDBY)]로 즉시 강제 전환!
  const lastBroadcastStageKeyRef = useRef("");

  useEffect(() => {
    if (!contestId || !currentStage) return;
    const cat = currentStage?.categoryTitle || currentStage?.contestCategoryTitle || "";
    const grd = currentStage?.gradeTitle || currentStage?.contestGradeTitle || "";
    const gradeId = currentStage?.gradeId || currentStage?.grades?.[0]?.gradeId || "";
    const stageNum = currentStage?.stageNumber || currentStage?.stageIndex || currentStage?.stageId || "";
    if (!cat && !grd) return;

    const currentKey = `${currentStage?.stageId || ""}_${gradeId}_${stageNum}_${cat}_${grd}`;
    if (!lastBroadcastStageKeyRef.current) {
      lastBroadcastStageKeyRef.current = currentKey;
      return;
    }
    if (currentKey === lastBroadcastStageKeyRef.current) return;
    lastBroadcastStageKeyRef.current = currentKey;

    // 🎯 종목이나 체급이 바뀌면 무조건 전광판을 [대기 및 종목/체급 안내 씬(STANDBY)]으로 즉각 강제 전환!
    updateBroadcast.updateData(`currentBroadcast/${contestId}`, {
      mode: "STANDBY",
      contestTitle: realContestTitle,
      stageInfo: {
        categoryTitle: cat,
        gradeTitle: grd,
        gradeId: gradeId,
        stageNumber: stageNum,
        playerCount: currentPlayers?.length || 0,
      },
      activePlayer: null,
      specialScreenData: null,
      calloutData: null,
      updatedAt: Date.now(),
    }).catch((err) => {
      console.error("무대 변경 실시간 브로드캐스트 동기화 오류:", err);
    });
  }, [
    currentStage?.stageId,
    currentStage?.gradeId,
    currentStage?.categoryTitle,
    currentStage?.gradeTitle,
    currentStage?.stageNumber,
    currentPlayers?.length,
    contestId
  ]);

  // 1. 대기 및 현재 종목 안내 송출
  const handleSetStandby = async () => {
    if (!contestId) return;
    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, {
        mode: "STANDBY",
        contestTitle: realContestTitle,
        stageInfo: {
          categoryTitle: currentStage?.categoryTitle || currentStage?.contestCategoryTitle || "",
          gradeTitle: currentStage?.gradeTitle || currentStage?.contestGradeTitle || "",
          gradeId: currentStage?.gradeId || currentStage?.grades?.[0]?.gradeId || "",
          stageNumber: currentStage?.stageNumber || currentStage?.stageIndex || "",
          playerCount: currentPlayers?.length || 0,
        },
        activePlayer: null,
        specialScreenData: null,
        calloutData: null,
        updatedAt: Date.now(),
      });
      message.info("전광판: [대기 / 종목 안내] 송출 중");
    } catch (error) {
      console.error("대기 화면 송출 오류:", error);
    }
  };

  // 2. 실시간 선수 전체 화면 스포트라이트 송출 (계측에서 지정한 무대용 사진 stagePhotoUrl 100% 우선 송출)
  const handleIntroPlayer = async (player) => {
    if (!contestId || !player) return;
    try {
      const resolvedPhotos = getPlayerResolvedPhotos(player);
      let stage1 =
        (!isNonPlayerUrl(player.stagePhoto1) && player.stagePhoto1) ||
        (!isNonPlayerUrl(player.stagePhotoUrl1) && player.stagePhotoUrl1) ||
        "";
      let stage2 =
        (!isNonPlayerUrl(player.stagePhoto2) && player.stagePhoto2) ||
        (!isNonPlayerUrl(player.stagePhotoUrl2) && player.stagePhotoUrl2) ||
        "";

      if (!stage1 && resolvedPhotos.length > 0) stage1 = resolvedPhotos[0];
      if (!stage2 && resolvedPhotos.length > 1) stage2 = resolvedPhotos[1];

      const designatedStagePhoto =
        stage1 ||
        stage2 ||
        (!isNonPlayerUrl(player.stagePhotoUrl) && player.stagePhotoUrl) ||
        (!isNonPlayerUrl(player.profileImageUrl) && player.profileImageUrl) ||
        resolvedPhotos[0] ||
        "";

      const payload = {
        mode: "ATHLETE_INTRO",
        contestTitle: realContestTitle,
        activePlayer: {
          playerNumber: player.playerNumber,
          playerName: player.playerName,
          playerGym: player.playerGym || "",
          heightWeight:
            player.heightWeight ||
            (player.playerHeight && player.playerWeight
              ? `${player.playerHeight} / ${player.playerWeight}`
              : "") ||
            "",
          playerHeight: player.playerHeight || player.height || "",
          playerWeight: player.playerWeight || player.weight || "",
          stagePhoto1: stage1,
          stagePhoto2: stage2,
          stagePhotoUrl1: stage1,
          stagePhotoUrl2: stage2,
          backgroundPhotoUrl: stage2 || player.backgroundPhotoUrl || "",
          stagePhotoUrl: designatedStagePhoto,
          profileImageUrl: designatedStagePhoto,
          photos: resolvedPhotos,
          categoryTitle: currentStage?.categoryTitle || currentStage?.contestCategoryTitle || "",
          gradeTitle: currentStage?.gradeTitle || currentStage?.contestGradeTitle || "",
        },
        specialScreenData: null,
        calloutData: null,
        updatedAt: Date.now(),
      };

      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, payload);
      await updateBroadcast.updateData(`currentBroadcast/ACTIVE_STAGE`, {
        ...payload,
        targetContestId: contestId,
      });
      message.success(`${player.playerNumber}번 ${player.playerName} 선수 전체화면 소개 송출!`);
    } catch (error) {
      console.error("선수 소개 송출 오류:", error);
    }
  };

  // 3. ⚔️ 비교심사 호명 송출
  const handleSendCallout = async () => {
    if (!contestId) return;
    if (selectedCalloutPlayers.length === 0) {
      message.warning("비교심사에 호명할 선수를 1명 이상 선택하세요.");
      return;
    }

    const calloutList = currentPlayers
      .filter((p) => selectedCalloutPlayers.includes(p.playerNumber || p.playerUid))
      .map((p) => ({
        playerNumber: p.playerNumber,
        playerName: p.playerName,
        playerGym: p.playerGym || "",
        profileImageUrl: p.profileImageUrl || p.photoUrl || "",
      }));

    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, {
        mode: "COMPARISON_CALLOUT",
        contestTitle: realContestTitle,
        stageInfo: {
          categoryTitle: currentStage?.categoryTitle || currentStage?.contestCategoryTitle || "",
          gradeTitle: currentStage?.gradeTitle || currentStage?.contestGradeTitle || "",
          gradeId: currentStage?.gradeId || currentStage?.grades?.[0]?.gradeId || "",
          stageNumber: currentStage?.stageNumber || currentStage?.stageIndex || "",
        },
        calloutData: {
          roundTitle: calloutRound,
          currentPose: calloutPose,
          players: calloutList,
        },
        activePlayer: null,
        specialScreenData: null,
        updatedAt: Date.now(),
      });
      message.success(`전광판: [${calloutRound}] ${calloutList.length}명 비교심사 화면 송출!`);
      setIsCalloutModalOpen(false);
    } catch (error) {
      console.error("비교심사 송출 오류:", error);
    }
  };

  // 4. 🔥 포즈다운 배틀 송출
  const handleSendPosedown = async () => {
    if (!contestId) return;
    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, {
        mode: "POSEDOWN",
        contestTitle: realContestTitle,
        stageInfo: {
          categoryTitle: currentStage?.categoryTitle || currentStage?.contestCategoryTitle || "",
          gradeTitle: currentStage?.gradeTitle || currentStage?.contestGradeTitle || "",
          gradeId: currentStage?.gradeId || currentStage?.grades?.[0]?.gradeId || "",
          stageNumber: currentStage?.stageNumber || currentStage?.stageIndex || "",
          players: currentPlayers || [],
        },
        activePlayer: null,
        specialScreenData: null,
        calloutData: null,
        updatedAt: Date.now(),
      });
      message.success("전광판: [🔥 포즈다운 배틀] 송출 시작!");
    } catch (error) {
      console.error("포즈다운 송출 오류:", error);
    }
  };

  // 특정 체급의 Firestore contest_results_list 조회 유틸 (통합 무대 개별 체급 분리 조회)
  const fetchCurrentGradeRankings = async (targetGradeId = null) => {
    const gId = targetGradeId || activeGradeId;
    if (!gId) return [];

    try {
      const condition = [where("gradeId", "==", gId)];
      const data = await fetchResultQuery.getDocuments(
        "contest_results_list",
        condition
      );
      if (data && data.length > 0 && data[0]?.result) {
        return [...data[0].result].sort(
          (a, b) => (a.playerRank || 0) - (b.playerRank || 0)
        );
      }
    } catch (error) {
      console.error(`순위 데이터 조회 실패 (gradeId: ${gId}):`, error);
    }
    return [];
  };

  // 5. 📢 스폰서 광고 송출 (10초 무한 로테이션)
  const handleStartCommercials = async () => {
    if (!contestId) return;

    let finalRanks = await fetchCurrentGradeRankings(activeGradeId);

    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, {
        mode: "COMMERCIAL",
        contestTitle: realContestTitle,
        stageInfo: {
          categoryTitle: activeCategoryTitle,
          gradeTitle: activeGradeTitle,
          gradeId: activeGradeId,
          stageNumber: currentStage?.stageNumber || currentStage?.stageIndex || "",
        },
        rankingData: finalRanks,
        activePlayer: null,
        specialScreenData: null,
        calloutData: null,
        updatedAt: Date.now(),
      });
      message.success("전광판: 스폰서 광고 송출 시작! (10초씩 무한 로테이션)");
    } catch (error) {
      console.error("광고 송출 오류:", error);
    }
  };

  // 🏆 랭킹 데이터가 비어있을 때는 임의의 가짜 순위를 만들지 않고 '데이터 없음'으로 정직하게 대체
  const getReliableRankings = (rawRanks) => {
    if (rawRanks && rawRanks.length > 0) {
      return rawRanks;
    }
    return [
      {
        playerRank: 1,
        rank: 1,
        playerNumber: "-",
        playerName: "데이터 없음",
        playerGym: "심사 결과 집계 대기",
        playerHeight: "",
        playerWeight: "",
      },
    ];
  };

  // 6. 🏆 순위 발표 즉시 송출 (선택된 체급 전용)
  const handleDirectRanking = async () => {
    console.log("%c[CONTROLLER] 📢 [전체 순위 동시발표] 버튼 클릭됨!", "background:#22c55e;color:black;font-weight:bold;font-size:14px;", {
      contestId,
      currentContest,
      currentStage,
      activeGradeTitle,
      activeGradeId,
      currentPlayers,
    });

    if (!contestId) {
      console.warn("[CONTROLLER] ⚠️ contestId가 비어있습니다! currentContest 확인 필요");
      message.warning("대회 ID를 확인할 수 없습니다. 대회를 선택해주세요.");
      return;
    }

    let finalRanks = await fetchCurrentGradeRankings(activeGradeId);
    const reliableRanks = getReliableRankings(finalRanks);

    // 📸 실제 등록된 선수의 무대 사진 및 프로필 사진 실시간 매칭
    const enrichedRanks = reliableRanks.map((r) => {
      const p = (currentPlayers || []).find(
        (cp) =>
          String(cp.playerNumber).trim() === String(r.playerNumber).trim() ||
          cp.playerName === r.playerName ||
          cp.playerUid === r.playerUid
      );
      if (p) {
        const photos = extractPlayerPhotos(p);
        const stage1 = (!isNonPlayerUrl(p.stagePhoto1) && p.stagePhoto1) || (!isNonPlayerUrl(p.stagePhotoUrl1) && p.stagePhotoUrl1) || photos[0] || "";
        const stage2 = (!isNonPlayerUrl(p.stagePhoto2) && p.stagePhoto2) || (!isNonPlayerUrl(p.stagePhotoUrl2) && p.stagePhotoUrl2) || (!isNonPlayerUrl(p.backgroundPhotoUrl) && p.backgroundPhotoUrl) || photos[1] || "";
        return {
          ...r,
          ...p,
          stagePhoto1: stage1,
          stagePhoto2: stage2,
          stagePhotoUrl1: stage1,
          stagePhotoUrl2: stage2,
          stagePhotoUrl: stage1 || r.stagePhotoUrl,
          profileImageUrl: p.profileImageUrl || photos[0] || r.profileImageUrl,
          playerGym: p.playerGym || r.playerGym,
          playerHeight: p.playerHeight || p.height || r.playerHeight || "",
          playerWeight: p.playerWeight || p.weight || r.playerWeight || "",
        };
      }
      return r;
    });

    const payload = {
      mode: "RANKING",
      contestTitle: realContestTitle,
      stageInfo: {
        categoryTitle: activeCategoryTitle,
        gradeTitle: activeGradeTitle,
        gradeId: activeGradeId,
        stageNumber: currentStage?.stageNumber || currentStage?.stageIndex || "",
      },
      rankingData: enrichedRanks,
      activePlayer: null,
      specialScreenData: null,
      calloutData: null,
      updatedAt: Date.now(),
    };

    console.log("%c[CONTROLLER] 🚀 Firebase 전송 시작:", "background:#3b82f6;color:white;font-weight:bold;", {
      path: `currentBroadcast/${contestId}`,
      payload,
    });

    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, payload);
      // 전역 fallback 슬롯에도 동시 업데이트 (전광판 화면 contestId 불일치 자동 방어)
      await updateBroadcast.updateData(`currentBroadcast/ACTIVE_STAGE`, {
        ...payload,
        targetContestId: contestId,
      });
      console.log("%c[CONTROLLER] ✅ [전체 순위 동시발표] Firebase 전송 완료!", "background:#10b981;color:black;font-weight:bold;font-size:14px;");
      message.success(`전광판: [${activeGradeTitle}] 순위 발표 화면 송출!`);
    } catch (error) {
      console.error("[CONTROLLER] ❌ 순위 발표 송출 오류:", error);
    }
  };

  // 6-1. 🏅 공식 시상식 (1위·2위·3위 포디움 단상 + TOP 5 리스트) 송출
  const handleSendAwardCeremony = async () => {
    if (!contestId) {
      message.warning("대회 ID를 확인할 수 없습니다.");
      return;
    }

    let finalRanks = await fetchCurrentGradeRankings(activeGradeId);
    const reliableRanks = getReliableRankings(finalRanks);

    // 📸 실제 등록된 선수의 무대 사진 및 프로필 사진 실시간 매칭
    const enrichedRanks = reliableRanks.map((r) => {
      const p = (currentPlayers || []).find(
        (cp) =>
          String(cp.playerNumber).trim() === String(r.playerNumber).trim() ||
          cp.playerName === r.playerName ||
          cp.playerUid === r.playerUid
      );
      if (p) {
        const photos = extractPlayerPhotos(p);
        const stage1 = (!isNonPlayerUrl(p.stagePhoto1) && p.stagePhoto1) || (!isNonPlayerUrl(p.stagePhotoUrl1) && p.stagePhotoUrl1) || photos[0] || "";
        const stage2 = (!isNonPlayerUrl(p.stagePhoto2) && p.stagePhoto2) || (!isNonPlayerUrl(p.stagePhotoUrl2) && p.stagePhotoUrl2) || (!isNonPlayerUrl(p.backgroundPhotoUrl) && p.backgroundPhotoUrl) || photos[1] || "";
        return {
          ...r,
          ...p,
          stagePhoto1: stage1,
          stagePhoto2: stage2,
          stagePhotoUrl1: stage1,
          stagePhotoUrl2: stage2,
          stagePhotoUrl: stage1 || r.stagePhotoUrl,
          profileImageUrl: p.profileImageUrl || photos[0] || r.profileImageUrl,
          playerGym: p.playerGym || r.playerGym,
          playerHeight: p.playerHeight || p.height || r.playerHeight || "",
          playerWeight: p.playerWeight || p.weight || r.playerWeight || "",
        };
      }
      return r;
    });

    const payload = {
      mode: "AWARD_CEREMONY",
      contestTitle: realContestTitle,
      stageInfo: {
        categoryTitle: activeCategoryTitle,
        gradeTitle: activeGradeTitle,
        gradeId: activeGradeId,
        stageNumber: currentStage?.stageNumber || currentStage?.stageIndex || "",
      },
      rankingData: enrichedRanks,
      activePlayer: null,
      specialScreenData: null,
      calloutData: null,
      updatedAt: Date.now(),
    };

    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, payload);
      await updateBroadcast.updateData(`currentBroadcast/ACTIVE_STAGE`, {
        ...payload,
        targetContestId: contestId,
      });
      message.success(`전광판: [${activeGradeTitle}] 공식 시상식 (포디움) 화면 송출 시작!`);
    } catch (error) {
      console.error("공식 시상식 송출 오류:", error);
    }
  };

  // 7. 👑 1위 우승자 단독 전체화면 송출
  const handleShowChampion = async () => {
    if (!contestId) {
      message.warning("대회 ID를 확인할 수 없습니다.");
      return;
    }

    let finalRanks = await fetchCurrentGradeRankings(activeGradeId);
    const reliableRanks = getReliableRankings(finalRanks);

    // 📸 실제 등록된 선수의 무대 사진 및 프로필 사진 실시간 매칭
    const enrichedRanks = reliableRanks.map((r) => {
      const p = (currentPlayers || []).find(
        (cp) =>
          String(cp.playerNumber).trim() === String(r.playerNumber).trim() ||
          cp.playerName === r.playerName ||
          cp.playerUid === r.playerUid
      );
      if (p) {
        const photos = extractPlayerPhotos(p);
        const stage1 = (!isNonPlayerUrl(p.stagePhoto1) && p.stagePhoto1) || (!isNonPlayerUrl(p.stagePhotoUrl1) && p.stagePhotoUrl1) || photos[0] || "";
        const stage2 = (!isNonPlayerUrl(p.stagePhoto2) && p.stagePhoto2) || (!isNonPlayerUrl(p.stagePhotoUrl2) && p.stagePhotoUrl2) || (!isNonPlayerUrl(p.backgroundPhotoUrl) && p.backgroundPhotoUrl) || photos[1] || "";
        return {
          ...r,
          ...p,
          stagePhoto1: stage1,
          stagePhoto2: stage2,
          stagePhotoUrl1: stage1,
          stagePhotoUrl2: stage2,
          stagePhotoUrl: stage1 || r.stagePhotoUrl,
          profileImageUrl: p.profileImageUrl || photos[0] || r.profileImageUrl,
          playerGym: p.playerGym || r.playerGym,
          playerHeight: p.playerHeight || p.height || r.playerHeight || "",
          playerWeight: p.playerWeight || p.weight || r.playerWeight || "",
        };
      }
      return r;
    });

    const top1 = enrichedRanks.find((p) => (p.playerRank || p.rank || 0) === 1) || enrichedRanks[0] || null;

    const payload = {
      mode: "CHAMPION_SHOWCASE",
      contestTitle: realContestTitle,
      stageInfo: {
        categoryTitle: activeCategoryTitle,
        gradeTitle: activeGradeTitle,
        gradeId: activeGradeId,
        stageNumber: currentStage?.stageNumber || currentStage?.stageIndex || "",
      },
      rankingData: enrichedRanks,
      activePlayer: top1 || null,
      topPlayer: top1 || null,
      specialScreenData: null,
      calloutData: null,
      updatedAt: Date.now(),
    };

    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, payload);
      await updateBroadcast.updateData(`currentBroadcast/ACTIVE_STAGE`, {
        ...payload,
        targetContestId: contestId,
      });
      message.success(
        top1 ? `1위 [${top1.playerName}] (${activeGradeTitle}) 챔피언 단독 전체화면 송출!` : `[${activeGradeTitle}] 1위 챔피언 단독 송출!`
      );
    } catch (error) {
      console.error("1위 단독 송출 오류:", error);
    }
  };

  // 7-1. 🔲 2~10위 발표 ➜ 1위 단독 시상식 송출
  const handleSendSquareRanking = async () => {
    if (!contestId) {
      message.warning("대회 ID를 확인할 수 없습니다.");
      return;
    }

    let finalRanks = await fetchCurrentGradeRankings(activeGradeId);
    const reliableRanks = getReliableRankings(finalRanks);

    // 📸 실제 등록된 선수의 무대 사진 및 프로필 사진 실시간 매칭
    const enrichedRanks = reliableRanks.map((r) => {
      const p = (currentPlayers || []).find(
        (cp) =>
          String(cp.playerNumber).trim() === String(r.playerNumber).trim() ||
          cp.playerName === r.playerName ||
          cp.playerUid === r.playerUid
      );
      if (p) {
        const photos = extractPlayerPhotos(p);
        const stage1 = (!isNonPlayerUrl(p.stagePhoto1) && p.stagePhoto1) || (!isNonPlayerUrl(p.stagePhotoUrl1) && p.stagePhotoUrl1) || photos[0] || "";
        const stage2 = (!isNonPlayerUrl(p.stagePhoto2) && p.stagePhoto2) || (!isNonPlayerUrl(p.stagePhotoUrl2) && p.stagePhotoUrl2) || (!isNonPlayerUrl(p.backgroundPhotoUrl) && p.backgroundPhotoUrl) || photos[1] || "";
        return {
          ...r,
          ...p,
          stagePhoto1: stage1,
          stagePhoto2: stage2,
          stagePhotoUrl1: stage1,
          stagePhotoUrl2: stage2,
          stagePhotoUrl: stage1 || r.stagePhotoUrl,
          profileImageUrl: p.profileImageUrl || photos[0] || r.profileImageUrl,
          playerGym: p.playerGym || r.playerGym,
          playerHeight: p.playerHeight || p.height || r.playerHeight || "",
          playerWeight: p.playerWeight || p.weight || r.playerWeight || "",
        };
      }
      return r;
    });

    const payload = {
      mode: "SQUARE_RANKING",
      rankingPhase: "FULL_RANKING",
      contestTitle: realContestTitle,
      stageInfo: {
        categoryTitle: currentStage?.categoryTitle || currentStage?.contestCategoryTitle || "공식 시상식",
        gradeTitle: currentStage?.gradeTitle || currentStage?.contestGradeTitle || "",
        gradeId: currentStage?.gradeId || currentStage?.grades?.[0]?.gradeId || "",
        stageNumber: currentStage?.stageNumber || currentStage?.stageIndex || "",
      },
      rankingData: enrichedRanks,
      activePlayer: null,
      specialScreenData: null,
      calloutData: null,
      updatedAt: Date.now(),
    };

    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, payload);
      await updateBroadcast.updateData(`currentBroadcast/ACTIVE_STAGE`, {
        ...payload,
        targetContestId: contestId,
      });
      message.success("전광판: [2~10위 발표 ➜ 1위 단독 시상식] 송출 시작!");
    } catch (error) {
      console.error("순위발표 송출 오류:", error);
    }
  };

  // 7-2. 👑 1:1 1위 우승자 단독 선수소개 샷 즉시 전환 (콘솔 원클릭)
  const handleSquareChampionSolo = async () => {
    if (!contestId) return;
    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, {
        mode: "SQUARE_RANKING",
        rankingPhase: "CHAMPION_SOLO",
        updatedAt: Date.now(),
      });
      message.success("전광판: [👑 1위 단독 선수소개 샷] 즉시 송출!");
    } catch (error) {
      console.error("1위 단독 샷 전환 오류:", error);
    }
  };

  // 7-3. 📋 1:1 전체 순위표 복귀 (콘솔 원클릭)
  const handleSquareBackToFullRanking = async () => {
    if (!contestId) return;
    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, {
        mode: "SQUARE_RANKING",
        rankingPhase: "FULL_RANKING",
        updatedAt: Date.now(),
      });
      message.success("전광판: [📋 1:1 전체 순위표] 로 복귀했습니다.");
    } catch (error) {
      console.error("전체 순위표 복귀 오류:", error);
    }
  };

  // 8. ⭐ 동적 특수화면 송출 핸들러
  const handleSendSpecialScreen = async (screen) => {
    if (!contestId || !screen) return;
    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, {
        mode: "SPECIAL_SCREEN",
        contestTitle: realContestTitle,
        specialScreenData: screen,
        colorTheme: screen.colorTheme || currentTheme,
        updatedAt: Date.now(),
      });
      message.success(`전광판: 특수화면 [${screen.title}] 송출 시작!`);
    } catch (error) {
      console.error("특수화면 송출 오류:", error);
    }
  };

  // 특수화면 모달 열기
  const openSpecialModal = (index = null) => {
    setEditingSpecialIdx(index);
    if (index !== null && specialScreens[index]) {
      specialForm.setFieldsValue(specialScreens[index]);
    } else {
      specialForm.resetFields();
      specialForm.setFieldsValue({
        id: `special_${Date.now()}`,
        displayType: "GRAND_PRIX",
        colorTheme: "GOLD",
        players: [
          { playerRank: 1, playerNumber: "", playerName: "", playerGym: "", score: null, note: "대상" },
          { playerRank: 2, playerNumber: "", playerName: "", playerGym: "", score: null, note: "준우승" },
        ],
      });
    }
    setIsSpecialModalOpen(true);
  };

  // 특수화면 모달 저장
  const handleSpecialSubmit = (values) => {
    const newScreens = [...specialScreens];
    const itemData = {
      ...values,
      id: values.id || `special_${Date.now()}`,
    };

    if (editingSpecialIdx !== null) {
      newScreens[editingSpecialIdx] = itemData;
    } else {
      newScreens.push(itemData);
    }

    handleSaveSpecialScreensToDb(newScreens);
    setIsSpecialModalOpen(false);
  };

  // 특수화면 삭제
  const handleDeleteSpecial = (index) => {
    const newScreens = specialScreens.filter((_, i) => i !== index);
    handleSaveSpecialScreensToDb(newScreens);
  };

  // 전광판 새창 열기 (기본 16:9 와이드)
  const openDisplayWindow = () => {
    window.open(
      `/stage-live?contestId=${contestId}`,
      "StageLiveDisplay",
      "width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no"
    );
  };

  // 🔲 1:1 정방형 전광판 새창 열기 (신규)
  const openSquareDisplayWindow = () => {
    window.open(
      `/stage-square?contestId=${contestId}`,
      "StageSquareDisplay",
      "width=1080,height=1080,menubar=no,toolbar=no,location=no,status=no"
    );
  };

  return (
    <Card
      size="small"
      className="bg-slate-900 text-white rounded-2xl border-slate-700 shadow-2xl overflow-hidden mb-4"
      title={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1">
          <div className="flex items-center gap-2">
            <DesktopOutlined className="text-amber-400 text-lg" />
            <span className="font-black text-white text-sm tracking-wide">
              실시간 무대 전광판 송출 콘솔 (Live Broadcast Control)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-bold">송출 상태:</span>
            {currentMode === "STANDBY" && (
              <Tag color="blue" className="font-black text-xs mr-0">
                대기 / 종목 안내
              </Tag>
            )}
            {currentMode === "ATHLETE_INTRO" && (
              <Tag color="cyan" className="font-black text-xs mr-0 animate-pulse">
                선수 전체화면 소개 중
              </Tag>
            )}
            {currentMode === "COMPARISON_CALLOUT" && (
              <Tag color="red" className="font-black text-xs mr-0 animate-pulse">
                ⚔️ 비교심사 호명 중
              </Tag>
            )}
            {currentMode === "POSEDOWN" && (
              <Tag color="volcano" className="font-black text-xs mr-0 animate-pulse">
                🔥 포즈다운 배틀 중
              </Tag>
            )}
            {currentMode === "COMMERCIAL" && (
              <Tag color="orange" className="font-black text-xs mr-0 animate-pulse">
                📢 스폰서 광고 로테이션 중
              </Tag>
            )}
            {currentMode === "RANKING" && (
              <Tag color="gold" className="font-black text-xs mr-0">
                🏆 순위 발표 중
              </Tag>
            )}
            {currentMode === "AWARD_CEREMONY" && (
              <Tag color="gold" className="font-black text-xs mr-0 animate-pulse">
                🏅 공식 시상식 송출 중
              </Tag>
            )}
            {currentMode === "CHAMPION_SHOWCASE" && (
              <Tag color="purple" className="font-black text-xs mr-0 animate-pulse">
                👑 1위 챔피언 단독 송출 중
              </Tag>
            )}
            {currentMode === "SPECIAL_SCREEN" && (
              <Tag color="magenta" className="font-black text-xs mr-0 animate-pulse">
                ⭐ 특수화면 송출 중
              </Tag>
            )}

            <Button
              size="small"
              type="primary"
              icon={<ExportOutlined />}
              onClick={openDisplayWindow}
              className="bg-blue-600 hover:bg-blue-500 font-bold text-xs ml-2 rounded-lg"
            >
              📺 실시간 전광판 화면 열기
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 py-1">
        
        {/* 테마 색상 5종 선택 및 전광판 음향(사운드) 제어 바 */}
        <div className="bg-slate-950/70 px-3.5 py-2 rounded-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* 테마 색상 선택 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
              <BgColorsOutlined className="text-amber-400 text-sm" />
              <span>화면 색상 테마:</span>
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.values(THEME_CONFIGS).map((t) => {
                const isSelected = currentTheme === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => handleSelectTheme(t.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-slate-800 text-white border-white shadow-md scale-105"
                        : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    <span className={isSelected ? t.primary : ""}>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 🔊 전광판 사운드 ON/OFF 원클릭 제어 버튼 */}
          <div className="flex items-center gap-2 lg:pl-3 lg:border-l lg:border-slate-800 shrink-0">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1 shrink-0">
              {isAudioEnabled ? (
                <SoundOutlined className="text-cyan-400 animate-pulse" />
              ) : (
                <AudioMutedOutlined className="text-slate-400" />
              )}
              <span>전광판 사운드:</span>
            </span>
            <Button
              size="small"
              type={isAudioEnabled ? "primary" : "default"}
              onClick={handleToggleAudio}
              className={`font-black text-xs rounded-lg transition-all ${
                isAudioEnabled
                  ? "bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)] animate-pulse"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
              }`}
              icon={isAudioEnabled ? <SoundOutlined /> : <AudioMutedOutlined />}
            >
              {isAudioEnabled ? "사운드 출력 중 (ON)" : "음소거 (OFF)"}
            </Button>
          </div>
        </div>

        {/* 🏆 [통합 무대 전용] 시상/성적 발표 체급 선택 바 (무대는 통합이나 순위는 체급별로 독립 발표) */}
        {isIntegratedStage && (
          <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-black p-3 sm:p-3.5 rounded-2xl border-2 border-amber-500/80 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
              <div>
                <div className="text-[11px] font-bold text-amber-400 tracking-wide">
                  ⚡ 통합 무대 개별 시상 제어기 (무대는 통합 진행, 순위 발표는 체급별 독립 송출)
                </div>
                <div className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>현재 시상/순위발표 대상 체급:</span>
                  <span className="text-amber-300 font-mono text-base font-black px-2 py-0.5 rounded bg-black/60 border border-amber-400/60">
                    {activeGradeTitle}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 hidden sm:inline">체급 선택:</span>
              {stageGrades.map((g, gIdx) => {
                const isSelected = (g.gradeId === selectedGradeId) || (!selectedGradeId && gIdx === 0);
                const gradePlayers = (currentPlayers || []).filter((p) => p.contestGradeId === g.gradeId);

                return (
                  <button
                    key={g.gradeId || gIdx}
                    onClick={() => {
                      setSelectedGradeId(g.gradeId);
                      message.info(`시상 대상 체급이 [${g.gradeTitle}]로 선택되었습니다.`);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer border flex items-center gap-2 ${
                      isSelected
                        ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 border-white shadow-xl shadow-amber-500/30 scale-105"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-400/50"
                    }`}
                  >
                    <TrophyOutlined className={isSelected ? "text-slate-950" : "text-amber-400"} />
                    <span>{g.gradeTitle}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                      isSelected ? "bg-slate-950 text-amber-300 font-bold" : "bg-slate-800 text-slate-400"
                    }`}>
                      {gradePlayers.length}명
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 1. 8대 주요 송출 원클릭 액션 버튼 바 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {/* ① 종목 안내 / 대기 화면 */}
          <button
            onClick={handleSetStandby}
            className={`p-3 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
              currentMode === "STANDBY"
                ? "bg-blue-600 text-white border-blue-400 shadow-lg"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <PlayCircleOutlined className="text-lg" />
            <span>종목/체급 안내</span>
          </button>

          {/* ② ⚔️ 비교심사 호명 송출 */}
          <button
            onClick={() => setIsCalloutModalOpen(true)}
            className={`p-3 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
              currentMode === "COMPARISON_CALLOUT"
                ? "bg-red-600 text-white border-red-300 shadow-lg shadow-red-600/50"
                : "bg-gradient-to-r from-red-950 to-rose-900 text-red-200 border-red-600/40 hover:border-red-400"
            }`}
          >
            <ThunderboltOutlined className="text-lg text-amber-400" />
            <span>⚔️ 비교심사 호명</span>
          </button>

          {/* ③ 🔥 포즈다운 배틀 송출 */}
          <button
            onClick={handleSendPosedown}
            className={`p-3 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
              currentMode === "POSEDOWN"
                ? "bg-orange-600 text-white border-orange-300 shadow-lg shadow-orange-600/50"
                : "bg-gradient-to-r from-rose-950 to-orange-950 text-orange-200 border-orange-500/40 hover:border-orange-400"
            }`}
          >
            <FireOutlined className="text-lg text-amber-400 animate-pulse" />
            <span>🔥 포즈다운 배틀</span>
          </button>

          {/* ④ 📢 스폰서 광고 송출 (10초 무한 로테이션) */}
          <button
            onClick={handleStartCommercials}
            className={`p-3 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
              currentMode === "COMMERCIAL"
                ? "bg-orange-500 text-slate-950 border-orange-300 shadow-lg"
                : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-amber-400/50 shadow-lg shadow-amber-600/20 active:scale-95"
            }`}
          >
            <NotificationOutlined className="text-lg" />
            <span>광고 무한 로테이션</span>
          </button>

          {/* ⑤ 시상식 1: 기존 전체 순위 동시 발표 (1~10위 동시 노출) */}
          <button
            onClick={handleDirectRanking}
            className={`p-3 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
              currentMode === "RANKING"
                ? "bg-amber-500 text-slate-950 border-amber-300 shadow-lg"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <TrophyOutlined className="text-lg" />
            <span>🏆 전체 순위 동시발표</span>
          </button>

          {/* ⑤-0 시상식 2: 2~10위 먼저 발표 ➜ 1위 단독 샷으로 이어지는 시상식 */}
          <button
            onClick={handleSendSquareRanking}
            className={`p-3 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
              currentMode === "SQUARE_RANKING"
                ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 border-white shadow-xl shadow-amber-500/50 scale-105"
                : "bg-gradient-to-r from-amber-950/90 to-yellow-950/90 hover:from-amber-900 hover:to-yellow-900 text-amber-300 border-amber-500/60"
            }`}
          >
            <CrownOutlined className="text-lg text-amber-400 animate-pulse" />
            <span>🥇 2~10위 ➜ 1위단독 시상</span>
          </button>

          {/* ⑤-1 🏅 공식 시상식 (포디움 단상) 송출 */}
          <button
            onClick={handleSendAwardCeremony}
            className={`p-3 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
              currentMode === "AWARD_CEREMONY"
                ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 border-white shadow-xl shadow-amber-500/50 scale-105"
                : "bg-gradient-to-r from-amber-950/80 to-yellow-950/80 hover:from-amber-900 hover:to-yellow-900 text-amber-300 border-amber-500/60"
            }`}
          >
            <TrophyOutlined className="text-lg text-amber-300" />
            <span>🏅 공식 시상식 (포디움)</span>
          </button>

          {/* ⑥ 👑 1위 챔피언 단독 송출 */}
          <button
            onClick={handleShowChampion}
            className={`p-3 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
              currentMode === "CHAMPION_SHOWCASE"
                ? "bg-purple-600 text-white border-purple-300 shadow-lg"
                : "bg-gradient-to-r from-purple-900/80 to-indigo-900/80 text-purple-200 border-purple-500/50 hover:bg-purple-800"
            }`}
          >
            <CrownOutlined className="text-lg text-amber-400" />
            <span>1위 챔피언 단독</span>
          </button>

          {/* ⑦ 다음 종목 대기 복귀 */}
          <button
            onClick={handleSetStandby}
            className="p-3 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
          >
            <ForwardOutlined className="text-lg" />
            <span>다음 종목 대기</span>
          </button>
        </div>

        {/* 🌟 [2~10위 ➜ 1위 단독 시상식] 실시간 원격 제어 바 */}
        {currentMode === "SQUARE_RANKING" && (
          <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-black p-3.5 rounded-2xl border-2 border-amber-400/60 flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              <span className="font-black text-xs sm:text-sm text-amber-300">
                🥇 [2~10위 발표 ➜ 1위 단독 시상식] 실시간 제어 중
              </span>
              <Tag color={broadcastData?.rankingPhase === "CHAMPION_SOLO" ? "purple" : "gold"} className="font-black text-xs">
                {broadcastData?.rankingPhase === "CHAMPION_SOLO" ? "👑 1위 단독 샷 송출 중" : "📋 2·3위 + 4~10위 발표 중"}
              </Tag>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="primary"
                icon={<CrownOutlined />}
                onClick={handleSquareChampionSolo}
                className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs border-none shadow-lg hover:opacity-90"
              >
                👑 1위 단독 샷 즉시 송출
              </Button>

              <Button
                icon={<ReloadOutlined />}
                onClick={handleSquareBackToFullRanking}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600 font-bold text-xs shadow"
              >
                📋 2~10위 순위표 복귀
              </Button>

              <Button
                icon={<ForwardOutlined />}
                onClick={handleSetStandby}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700 font-bold text-xs"
              >
                대기 화면 복귀
              </Button>
            </div>
          </div>
        )}

        {/* 🌟 2. 대회별 동적 특수화면 송출 바 */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-3.5 rounded-2xl border border-indigo-500/30 space-y-2.5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-black text-xs text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
              <StarOutlined className="text-amber-400" />
              <span>특수화면 송출 (대회별 동적 점수 및 특별 세레모니 버튼)</span>
            </span>

            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => openSpecialModal()}
              className="text-xs text-indigo-300 border-indigo-400/50 hover:text-white"
            >
              특수화면 추가 / 점수 관리
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {specialScreens.map((screen, idx) => {
              const isScreenActive =
                currentMode === "SPECIAL_SCREEN" && currentSpecialId === screen.id;

              return (
                <div key={screen.id || idx} className="flex items-center gap-1">
                  <button
                    onClick={() => handleSendSpecialScreen(screen)}
                    className={`px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer border flex items-center gap-2 ${
                      isScreenActive
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-white shadow-lg scale-105"
                        : "bg-slate-800/90 hover:bg-slate-700 text-slate-100 border-indigo-500/40"
                    }`}
                  >
                    <span>{screen.title}</span>
                    {screen.players?.length > 0 && (
                      <span className="bg-black/40 px-1.5 py-0.5 rounded text-[10px] text-amber-300 font-mono">
                        {screen.players.length}명
                      </span>
                    )}
                  </button>

                  <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined className="text-slate-400 hover:text-white text-xs" />}
                    onClick={() => openSpecialModal(idx)}
                    title="특수화면 수정"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. 선수 무대 입장 시 전체 화면 소개 송출 버튼 */}
        {currentPlayers && currentPlayers.length > 0 && (
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-400 flex items-center gap-1.5">
                <UserOutlined className="text-amber-400" />
                <span>선수 입장 전체화면 소개 (클릭 시 전광판에 선수 프로필 즉시 송출)</span>
              </span>
              {activePlayer && currentMode === "ATHLETE_INTRO" && (
                <Tag color="cyan" className="font-black text-xs mr-0 animate-pulse">
                  {activePlayer.playerNumber}번 {activePlayer.playerName} 전체화면 송출 중
                </Tag>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {currentPlayers
                .filter((p) => !p.playerNoShow)
                .map((player) => {
                  const isActive =
                    currentMode === "ATHLETE_INTRO" &&
                    activePlayer?.playerNumber === player.playerNumber;

                  const photos = getPlayerResolvedPhotos(player);
                  const hasPhoto = photos.length > 0;

                  return (
                    <button
                      key={player.playerUid || player.playerNumber}
                      onClick={() => handleIntroPlayer(player)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center gap-2 ${
                        isActive
                          ? "bg-amber-400 text-slate-950 border-amber-300 shadow-lg scale-105"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                      }`}
                    >
                      {hasPhoto && (
                        <img
                          src={photos[0]}
                          alt={player.playerName}
                          className="w-5 h-5 rounded-full object-cover border border-amber-400"
                        />
                      )}
                      <span className="font-mono text-amber-400 bg-slate-950 px-1.5 py-0.5 rounded font-black">
                        {player.playerNumber}번
                      </span>
                      <span className="text-sm">{player.playerName}</span>
                      {player.heightWeight && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({player.heightWeight})
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* ⚔️ 비교심사 호명 전용 모달 */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <ThunderboltOutlined className="text-red-500 text-lg" />
            <span className="font-black text-slate-900">비교심사 선수 호명 & 전광판 송출</span>
          </div>
        }
        open={isCalloutModalOpen}
        onCancel={() => setIsCalloutModalOpen(false)}
        onOk={handleSendCallout}
        okText="전광판에 비교심사 즉시 송출"
        cancelText="취소"
        width={720}
        okButtonProps={{ className: "bg-red-600 font-black hover:bg-red-700" }}
      >
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">비교심사 단계</label>
              <Select
                value={calloutRound}
                onChange={setCalloutRound}
                className="w-full"
                options={[
                  { value: "1차 비교심사 (FIRST CALLOUT)", label: "1차 비교심사 (FIRST CALLOUT)" },
                  { value: "2차 비교심사 (SECOND CALLOUT)", label: "2차 비교심사 (SECOND CALLOUT)" },
                  { value: "3차 비교심사 (THIRD CALLOUT)", label: "3차 비교심사 (THIRD CALLOUT)" },
                  { value: "TOP 4 최상위 비교심사", label: "TOP 4 최상위 비교심사" },
                  { value: "최종 순위 결정 비교심사", label: "최종 순위 결정 비교심사" },
                ]}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">무대 포즈 안내 지시문</label>
              <Select
                value={calloutPose}
                onChange={setCalloutPose}
                className="w-full"
                options={POSES_PRESET.map((p) => ({ value: p, label: p }))}
              />
            </div>
          </div>

          <Divider className="my-2">
            <span className="text-xs text-slate-500 font-bold">
              호명할 출전 선수 선택 (다중 선택 가능, 선택: {selectedCalloutPlayers.length}명)
            </span>
          </Divider>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
            {currentPlayers
              .filter((p) => !p.playerNoShow)
              .map((p) => {
                const pKey = p.playerNumber || p.playerUid;
                const isChecked = selectedCalloutPlayers.includes(pKey);

                return (
                  <div
                    key={pKey}
                    onClick={() => {
                      if (isChecked) {
                        setSelectedCalloutPlayers(selectedCalloutPlayers.filter((k) => k !== pKey));
                      } else {
                        setSelectedCalloutPlayers([...selectedCalloutPlayers, pKey]);
                      }
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isChecked
                        ? "bg-red-50 border-red-500 text-red-900 font-black shadow-sm"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-mono px-2 py-0.5 rounded text-xs font-black ${
                        isChecked ? "bg-red-600 text-white" : "bg-slate-200 text-slate-800"
                      }`}>
                        #{p.playerNumber}
                      </span>
                      <span className="text-sm">{p.playerName}</span>
                    </div>
                    <Checkbox checked={isChecked} />
                  </div>
                );
              })}
          </div>
        </div>
      </Modal>

      {/* 🌟 특수화면 추가 및 점수 입력 모달 */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <StarOutlined className="text-amber-500" />
            <span>{editingSpecialIdx !== null ? "특수화면 및 점수 수정" : "새 특수화면 등록"}</span>
          </div>
        }
        open={isSpecialModalOpen}
        onCancel={() => setIsSpecialModalOpen(false)}
        footer={null}
        destroyOnClose
        width={720}
      >
        <Form form={specialForm} layout="vertical" onFinish={handleSpecialSubmit} className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item
              name="title"
              label="특수화면 명칭"
              rules={[{ required: true, message: "화면 명칭을 입력하세요." }]}
            >
              <Input placeholder="예: 🏆 그랑프리 (OVERALL) 결정전, ✨ 베스트 포즈상" />
            </Form.Item>

            <Form.Item name="displayType" label="특수화면 표출 형태" required>
              <Select>
                <Select.Option value="GRAND_PRIX">🏆 그랑프리/통합 오버롤 (포디움 + 후보자)</Select.Option>
                <Select.Option value="SPECIAL_AWARD">✨ 단독 특별상 (대상 1명 집중 조명)</Select.Option>
                <Select.Option value="SCORE_BOARD">📊 동적 점수/투표 집계 스코어보드</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item name="subTitle" label="부제 / 설명 문구">
              <Input placeholder="예: 각 체급 1위 통합 최강자전 공식 심사 결과" />
            </Form.Item>

            <Form.Item name="colorTheme" label="화면 테마 색상">
              <Select>
                <Select.Option value="GOLD">🏆 골드 챔피언</Select.Option>
                <Select.Option value="PURPLE">🔮 로얄 바이올렛</Select.Option>
                <Select.Option value="BLUE">⚡ 일렉트릭 블루</Select.Option>
                <Select.Option value="RED">🔥 크림슨 파이어</Select.Option>
                <Select.Option value="GREEN">💎 에메랄드 몬스터</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <Divider className="my-2">
            <span className="text-xs text-slate-500 font-bold">출전 선수 및 동적 점수 입력</span>
          </Divider>

          <Form.List name="players">
            {(fields, { add, remove }) => (
              <div className="space-y-2">
                {fields.map(({ key, name, ...restField }, idx) => (
                  <div key={key} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border">
                    <span className="font-bold text-xs text-slate-500 w-8 text-center">{idx + 1}위</span>
                    
                    <Form.Item
                      {...restField}
                      name={[name, "playerNumber"]}
                      rules={[{ required: true, message: "번호" }]}
                      className="mb-0 w-20"
                    >
                      <Input placeholder="번호" />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, "playerName"]}
                      rules={[{ required: true, message: "선수명" }]}
                      className="mb-0 w-28"
                    >
                      <Input placeholder="선수명" />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, "playerGym"]}
                      className="mb-0 flex-1"
                    >
                      <Input placeholder="소속 체육관" />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, "score"]}
                      className="mb-0 w-24"
                    >
                      <InputNumber placeholder="점수" step={0.1} className="w-full" />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, "note"]}
                      className="mb-0 w-28"
                    >
                      <Input placeholder="비고(예: 대상)" />
                    </Form.Item>

                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(name)}
                    />
                  </div>
                ))}

                <Button
                  type="dashed"
                  onClick={() => add({ playerRank: fields.length + 1 })}
                  block
                  icon={<PlusOutlined />}
                  className="rounded-xl"
                >
                  선수 추가하기
                </Button>
              </div>
            )}
          </Form.List>

          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>

          <div className="flex justify-between items-center pt-4 mt-3 border-t">
            {editingSpecialIdx !== null && (
              <Popconfirm
                title="정말 이 특수화면을 삭제하시겠습니까?"
                onConfirm={() => {
                  handleDeleteSpecial(editingSpecialIdx);
                  setIsSpecialModalOpen(false);
                }}
                okText="삭제"
                cancelText="취소"
              >
                <Button danger>특수화면 삭제</Button>
              </Popconfirm>
            )}

            <div className="flex gap-2 ml-auto">
              <Button onClick={() => setIsSpecialModalOpen(false)}>취소</Button>
              <Button type="primary" htmlType="submit" className="bg-indigo-600 font-bold">
                저장하기
              </Button>
            </div>
          </div>
        </Form>
      </Modal>
    </Card>
  );
};

export default StageBroadcastController;
