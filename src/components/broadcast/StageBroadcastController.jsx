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
import { where, doc, getDoc } from "firebase/firestore";
import {
  extractPlayerPhotos,
  isNonPlayerUrl,
} from "../../utils/playerPhotoUtils";
import { dedupeContestResultsByGrade } from "../../utils/contestResultsUtils";
import {
  isActiveStagePlayer,
  resolveOriginalGradeTitle,
} from "../../utils/playerEntryUtils";
import { storage, db } from "../../firebase";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  Drawer,
  Input,
  Select,
  Popconfirm,
  Checkbox,
  Progress,
} from "antd";
import ConfirmationModal from "../../messageBox/ConfirmationModal";
import {
  Monitor,
  ExternalLink,
  Palette,
  Volume2,
  VolumeX,
  Tv,
  Users,
  Activity,
  Megaphone,
  ListOrdered,
  Layers,
  Award,
  Trophy,
  SkipForward,
  Film,
  Upload,
  Play,
  Pause,
  Square,
  RotateCcw,
  RotateCw,
  User,
  Trash2,
  Link2,
} from "lucide-react";
import { THEME_CONFIGS } from "./AthleteIntroScene";
import { BibTag, StatusDot } from "../ui/BibTag";

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

const MODE_LABELS = {
  STANDBY: "대기 / 종목 안내",
  ATHLETE_INTRO: "선수 프로필 소개 중",
  COMPARISON_CALLOUT: "비교심사 호명 중",
  POSEDOWN: "포즈다운 배틀 중",
  COMMERCIAL: "스폰서 광고 로테이션 중",
  RANKING: "전체 순위 발표 중",
  SQUARE_RANKING: "단계별 순위 발표 중",
  AWARD_CEREMONY: "공식 시상식 송출 중",
  CHAMPION_SHOWCASE: "1위 챔피언 단독 송출 중",
  SPECIAL_VIDEO: "특별영상 송출 중",
  SPECIAL_SCREEN: "특수화면 송출 중",
};

const StageBroadcastController = ({
  currentStage,
  currentPlayers = [],
  rankingResults = [],
}) => {
  void rankingResults;

  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState({});

  const message = {
    error: (text) => {
      setNoticeMessage({
        variant: "error",
        title: "전광판 제어 오류",
        body: String(text || "작업 처리 중 오류가 발생했습니다."),
        isButton: true,
        confirmButtonText: "확인",
      });
      setNoticeOpen(true);
    },
    warning: (text) => {
      const body = String(text || "");
      if (body.startsWith("특별영상:")) return;
      setNoticeMessage({
        variant: "warning",
        title: "확인 필요",
        body,
        isButton: true,
        confirmButtonText: "확인",
      });
      setNoticeOpen(true);
    },
    success: (text) => {
      const body = String(text || "");
      if (body.includes("등록 완료") || body.includes("삭제되었습니다")) {
        setNoticeMessage({
          variant: "success",
          title: "특별영상 관리 완료",
          body,
          isButton: true,
          confirmButtonText: "확인",
        });
        setNoticeOpen(true);
      }
    },
    info: () => {},
  };

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
  const updateSpecialVideosQuery = useFirestoreUpdateData(
    "contest_special_videos"
  );
  const addSpecialVideosQuery = useFirestoreAddData("contest_special_videos");

  // 특별영상 상태 (동적 업로드 및 목록 관리)
  const [specialVideos, setSpecialVideos] = useState([]);
  const [specialVideosDocId, setSpecialVideosDocId] = useState(null);
  const [isSpecialVideoModalOpen, setIsSpecialVideoModalOpen] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [newVideoTitle, setNewVideoTitle] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const specialVideoFileInputRef = useRef(null);

  // 비교심사 모달 상태
  const [isCalloutModalOpen, setIsCalloutModalOpen] = useState(false);
  const [selectedCalloutPlayers, setSelectedCalloutPlayers] = useState([]);
  const [calloutRound, setCalloutRound] = useState(
    "1차 비교심사 (FIRST CALLOUT)"
  );
  const [calloutPose, setCalloutPose] = useState(POSES_PRESET[0]);

  const currentMode = broadcastData?.mode || "STANDBY";
  const activePlayer = broadcastData?.activePlayer || null;
  const currentTheme = broadcastData?.colorTheme || "GOLD";
  const currentSpecialVideoId =
    broadcastData?.specialVideoData?.id ||
    broadcastData?.specialVideoUrl ||
    null;

  // 통합 무대(2개 이상 체급 결합) 감지 및 개별 체급 시상 선택 상태
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

  const activeGradeObj =
    stageGrades.find((g) => g.gradeId === selectedGradeId) ||
    stageGrades[0] ||
    null;
  const activeGradeTitle =
    activeGradeObj?.gradeTitle ||
    currentStage?.gradeTitle ||
    currentStage?.contestGradeTitle ||
    "";
  const activeGradeId =
    activeGradeObj?.gradeId ||
    currentStage?.gradeId ||
    stageGrades[0]?.gradeId ||
    "";
  const activeCategoryTitle =
    activeGradeObj?.categoryTitle ||
    currentStage?.categoryTitle ||
    currentStage?.contestCategoryTitle ||
    "공식 시상식";

  const [invoicePhotoMap, setInvoicePhotoMap] = useState(new Map());

  // invoices_pool 원본 참가신청서 사진 직접 로드
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
              const telPart = (inv.playerTel || "")
                .replace(/[^0-9]/g, "")
                .slice(-4);
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

  // 1. 특별영상 목록 DB 로드
  const fetchSpecialVideos = async () => {
    if (!contestId) return;
    try {
      const condition = [where("contestId", "==", contestId)];
      const data = await fetchResultQuery.getDocuments(
        "contest_special_videos",
        condition
      );
      if (data && data.length > 0 && Array.isArray(data[0]?.videos)) {
        setSpecialVideosDocId(data[0].id);
        setSpecialVideos(data[0].videos);
      } else {
        setSpecialVideosDocId(null);
        setSpecialVideos([]);
      }
    } catch (error) {
      console.error("특별영상 로드 오류:", error);
    }
  };

  useEffect(() => {
    fetchSpecialVideos();
  }, [contestId]);

  // 특별영상 목록 저장 (Firestore + Realtime DB 실시간 동기화)
  const handleSaveSpecialVideos = async (newVideos) => {
    if (!contestId) return;
    try {
      if (specialVideosDocId) {
        await updateSpecialVideosQuery.updateData(specialVideosDocId, {
          contestId,
          videos: newVideos,
          updatedAt: Date.now(),
        });
      } else {
        const res = await addSpecialVideosQuery.addData({
          contestId,
          videos: newVideos,
          createdAt: Date.now(),
        });
        if (res?.id) setSpecialVideosDocId(res.id);
      }
      setSpecialVideos(newVideos);
      await updateBroadcast.updateData(
        `contests/${contestId}/specialVideos`,
        newVideos
      );
    } catch (error) {
      console.error("특별영상 저장 실패:", error);
      message.error("저장 중 오류가 발생했습니다.");
    }
  };

  const realContestTitle =
    currentContest?.contestInfo?.contestTitle ||
    currentContest?.contests?.contestTitle ||
    currentStage?.contestTitle ||
    "";

  // 대회별 슬롯(currentBroadcast/${contestId})과 전역 백업 슬롯(ACTIVE_STAGE) 동시 동기화 헬퍼
  const syncBroadcastPayload = async (payload) => {
    if (!contestId) return;
    await Promise.all([
      updateBroadcast.updateData(`currentBroadcast/${contestId}`, payload),
      updateBroadcast.updateData("currentBroadcast/ACTIVE_STAGE", {
        ...payload,
        targetContestId: contestId,
      }),
    ]);
  };

  // 테마 색상 변경 핸들러
  const handleSelectTheme = async (themeKey) => {
    if (!contestId) return;
    try {
      await syncBroadcastPayload({
        colorTheme: themeKey,
        contestTitle: realContestTitle,
        updatedAt: Date.now(),
      });
      message.success(
        `전광판 색상 테마: [${THEME_CONFIGS[themeKey]?.name}] 적용 완료`
      );
    } catch (error) {
      console.error("테마 변경 오류:", error);
    }
  };

  // 전광판 사운드 ON/OFF 토글 핸들러
  const isAudioEnabled = Boolean(broadcastData?.isAudioEnabled);
  const handleToggleAudio = async () => {
    if (!contestId) return;
    try {
      const nextState = !isAudioEnabled;
      await syncBroadcastPayload({
        isAudioEnabled: nextState,
        updatedAt: Date.now(),
      });
      message.success(
        nextState ? "전광판 사운드: 음향 출력 켜짐" : "전광판 사운드: 음소거됨"
      );
    } catch (error) {
      console.error("사운드 변경 오류:", error);
    }
  };

  const activeStagePlayers = (currentPlayers || []).filter((p) =>
    isActiveStagePlayer(p)
  );

  // 종목이나 체급(무대) 변경 시 전광판 화면을 대기 및 종목/체급 안내(STANDBY)로 전환
  const lastBroadcastStageKeyRef = useRef("");

  useEffect(() => {
    if (!contestId || !currentStage) return;
    const cat =
      currentStage?.categoryTitle || currentStage?.contestCategoryTitle || "";
    const grd =
      currentStage?.gradeTitle || currentStage?.contestGradeTitle || "";
    const gradeId =
      currentStage?.gradeId || currentStage?.grades?.[0]?.gradeId || "";
    const stageNum =
      currentStage?.stageNumber ||
      currentStage?.stageIndex ||
      currentStage?.stageId ||
      "";
    if (!cat && !grd) return;

    const currentKey = `${currentStage?.stageId || ""}_${gradeId}_${stageNum}_${cat}_${grd}`;
    if (!lastBroadcastStageKeyRef.current) {
      lastBroadcastStageKeyRef.current = currentKey;
      return;
    }
    if (currentKey === lastBroadcastStageKeyRef.current) return;
    lastBroadcastStageKeyRef.current = currentKey;

    syncBroadcastPayload({
      mode: "STANDBY",
      contestTitle: realContestTitle,
      stageInfo: {
        categoryTitle: cat,
        gradeTitle: grd,
        gradeId: gradeId,
        stageNumber: stageNum,
        playerCount: activeStagePlayers.length,
      },
      activePlayer: null,
      specialScreenData: null,
      videoCommand: null,
      calloutData: null,
      updatedAt: Date.now(),
    }).catch((err) => {
      console.error("무대 변경 실시간 브로드캐스트 동기화 오류:", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentStage?.stageId,
    currentStage?.gradeId,
    currentStage?.categoryTitle,
    currentStage?.gradeTitle,
    currentStage?.stageNumber,
    activeStagePlayers.length,
    contestId,
  ]);

  // 1. 대기 및 현재 종목 안내 송출
  const handleSetStandby = async () => {
    if (!contestId) return;
    try {
      const filteredPlayers = (currentPlayers || []).filter((p) =>
        isActiveStagePlayer(p)
      );
      await syncBroadcastPayload({
        mode: "STANDBY",
        contestTitle: realContestTitle,
        stageInfo: {
          categoryTitle:
            currentStage?.categoryTitle ||
            currentStage?.contestCategoryTitle ||
            "",
          gradeTitle:
            currentStage?.gradeTitle || currentStage?.contestGradeTitle || "",
          gradeId:
            currentStage?.gradeId || currentStage?.grades?.[0]?.gradeId || "",
          stageNumber:
            currentStage?.stageNumber || currentStage?.stageIndex || "",
          playerCount: filteredPlayers.length,
        },
        activePlayer: null,
        specialScreenData: null,
        videoCommand: null,
        calloutData: null,
        updatedAt: Date.now(),
      });
      message.info("전광판: 대기 및 종목 안내 송출 중");
    } catch (error) {
      console.error("대기 화면 송출 오류:", error);
    }
  };

  // 2. 실시간 선수 전체 화면 스포트라이트 송출
  const handleIntroPlayer = async (player) => {
    if (!contestId || !player) return;
    try {
      let latestPlayer = player;
      const finalDocId = currentContest?.contests?.contestPlayersFinalId;
      if (finalDocId) {
        try {
          const finalSnap = await getDoc(
            doc(db, "contest_players_final", finalDocId)
          );
          if (finalSnap.exists()) {
            const finalPlayers = finalSnap.data()?.players || [];
            const targetGradeId =
              player.contestGradeId || activeGradeId || "";
            const matched =
              (targetGradeId
                ? finalPlayers.find(
                    (fp) =>
                      fp?.contestGradeId === targetGradeId &&
                      ((fp.playerUid &&
                        player.playerUid &&
                        fp.playerUid === player.playerUid) ||
                        (fp.playerNumber !== undefined &&
                          player.playerNumber !== undefined &&
                          String(fp.playerNumber) ===
                            String(player.playerNumber)))
                  )
                : null) ||
              finalPlayers.find(
                (fp) =>
                  (fp.playerUid &&
                    player.playerUid &&
                    fp.playerUid === player.playerUid &&
                    fp.contestCategoryId === player.contestCategoryId) ||
                  (fp.playerNumber &&
                    player.playerNumber &&
                    String(fp.playerNumber) === String(player.playerNumber) &&
                    fp.contestCategoryId === player.contestCategoryId)
              ) ||
              finalPlayers.find(
                (fp) =>
                  (fp.playerUid &&
                    player.playerUid &&
                    fp.playerUid === player.playerUid) ||
                  (fp.playerName === player.playerName &&
                    String(fp.playerNumber) === String(player.playerNumber))
              );
            if (matched) {
              latestPlayer = { ...matched, ...player, ...matched };
            }
          }
        } catch (fErr) {
          console.warn(
            "선수 소개 시 최신 final 조회 실패(기존 데이터 사용):",
            fErr
          );
        }
      }

      const resolvedPhotos = getPlayerResolvedPhotos(latestPlayer);
      let stage1 =
        (!isNonPlayerUrl(latestPlayer.stagePhoto1) &&
          latestPlayer.stagePhoto1) ||
        (!isNonPlayerUrl(latestPlayer.stagePhotoUrl1) &&
          latestPlayer.stagePhotoUrl1) ||
        "";
      let stage2 =
        (!isNonPlayerUrl(latestPlayer.stagePhoto2) &&
          latestPlayer.stagePhoto2) ||
        (!isNonPlayerUrl(latestPlayer.stagePhotoUrl2) &&
          latestPlayer.stagePhotoUrl2) ||
        "";

      if (!stage1 && resolvedPhotos.length > 0) stage1 = resolvedPhotos[0];
      if (!stage2 && resolvedPhotos.length > 1) stage2 = resolvedPhotos[1];

      const designatedStagePhoto =
        stage1 ||
        stage2 ||
        (!isNonPlayerUrl(latestPlayer.stagePhotoUrl) &&
          latestPlayer.stagePhotoUrl) ||
        (!isNonPlayerUrl(latestPlayer.profileImageUrl) &&
          latestPlayer.profileImageUrl) ||
        resolvedPhotos[0] ||
        "";

      const origWonGradeTitle = resolveOriginalGradeTitle(latestPlayer);
      const resolvedStageCategoryTitle =
        currentStage?.categoryTitle ||
        currentStage?.contestCategoryTitle ||
        "";
      const resolvedStageGradeTitle =
        currentStage?.gradeTitle || currentStage?.contestGradeTitle || "";

      const payload = {
        mode: "ATHLETE_INTRO",
        contestTitle: realContestTitle,
        stageInfo: {
          stageId: currentStage?.stageId || "",
          stageNumber: currentStage?.stageNumber || "",
          categoryId: currentStage?.categoryId || "",
          categoryTitle: resolvedStageCategoryTitle,
          gradeId: activeGradeId || latestPlayer.contestGradeId || "",
          gradeTitle: resolvedStageGradeTitle,
        },
        activePlayer: {
          playerNumber: latestPlayer.playerNumber,
          playerName: latestPlayer.playerName,
          playerGym: latestPlayer.playerGym || "",
          heightWeight:
            latestPlayer.heightWeight ||
            (latestPlayer.playerHeight && latestPlayer.playerWeight
              ? `${latestPlayer.playerHeight} / ${latestPlayer.playerWeight}`
              : "") ||
            "",
          playerHeight: latestPlayer.playerHeight || latestPlayer.height || "",
          playerWeight: latestPlayer.playerWeight || latestPlayer.weight || "",
          stagePhoto1: stage1,
          stagePhoto2: stage2,
          stagePhotoUrl1: stage1,
          stagePhotoUrl2: stage2,
          backgroundPhotoUrl: stage2 || latestPlayer.backgroundPhotoUrl || "",
          stagePhotoUrl: designatedStagePhoto,
          profileImageUrl: designatedStagePhoto,
          photos: resolvedPhotos,
          categoryTitle: resolvedStageCategoryTitle,
          gradeTitle: resolvedStageGradeTitle,
          ...(origWonGradeTitle ? { originalGradeTitle: origWonGradeTitle } : {}),
        },
        specialScreenData: null,
        videoCommand: null,
        calloutData: null,
        updatedAt: Date.now(),
      };

      await syncBroadcastPayload(payload);
      message.success(
        `${latestPlayer.playerNumber}번 ${latestPlayer.playerName} 선수 프로필 송출`
      );
    } catch (error) {
      console.error("선수 소개 송출 오류:", error);
    }
  };

  // 3. 비교심사 호명 송출
  const handleSendCallout = async () => {
    if (!contestId) return;
    if (selectedCalloutPlayers.length === 0) {
      message.warning("비교심사에 호명할 선수를 1명 이상 선택하세요.");
      return;
    }

    const calloutList = currentPlayers
      .filter((p) =>
        selectedCalloutPlayers.includes(p.playerNumber || p.playerUid)
      )
      .map((p) => ({
        playerNumber: p.playerNumber,
        playerName: p.playerName,
        playerGym: p.playerGym || "",
        profileImageUrl: p.profileImageUrl || p.photoUrl || "",
      }));

    try {
      await syncBroadcastPayload({
        mode: "COMPARISON_CALLOUT",
        contestTitle: realContestTitle,
        stageInfo: {
          categoryTitle:
            currentStage?.categoryTitle ||
            currentStage?.contestCategoryTitle ||
            "",
          gradeTitle:
            currentStage?.gradeTitle || currentStage?.contestGradeTitle || "",
          gradeId:
            currentStage?.gradeId || currentStage?.grades?.[0]?.gradeId || "",
          stageNumber:
            currentStage?.stageNumber || currentStage?.stageIndex || "",
        },
        calloutData: {
          roundTitle: calloutRound,
          currentPose: calloutPose,
          players: calloutList,
        },
        activePlayer: null,
        specialScreenData: null,
        videoCommand: null,
        updatedAt: Date.now(),
      });
      message.success(
        `전광판: [${calloutRound}] ${calloutList.length}명 비교심사 화면 송출`
      );
      setIsCalloutModalOpen(false);
    } catch (error) {
      console.error("비교심사 송출 오류:", error);
    }
  };

  // 4. 포즈다운 배틀 송출
  const handleSendPosedown = async () => {
    if (!contestId) return;
    try {
      const filteredPlayers = (currentPlayers || []).filter((p) =>
        isActiveStagePlayer(p)
      );
      await syncBroadcastPayload({
        mode: "POSEDOWN",
        contestTitle: realContestTitle,
        stageInfo: {
          categoryTitle:
            currentStage?.categoryTitle ||
            currentStage?.contestCategoryTitle ||
            "",
          gradeTitle:
            currentStage?.gradeTitle || currentStage?.contestGradeTitle || "",
          gradeId:
            currentStage?.gradeId || currentStage?.grades?.[0]?.gradeId || "",
          stageNumber:
            currentStage?.stageNumber || currentStage?.stageIndex || "",
          players: filteredPlayers,
        },
        activePlayer: null,
        specialScreenData: null,
        videoCommand: null,
        calloutData: null,
        updatedAt: Date.now(),
      });
      message.success("전광판: 포즈다운 배틀 송출 시작");
    } catch (error) {
      console.error("포즈다운 송출 오류:", error);
    }
  };

  // 특정 체급의 Firestore contest_results_list 조회 유틸
  const fetchCurrentGradeRankings = async (targetGradeId = null) => {
    const gId = targetGradeId || activeGradeId;
    if (!gId) return [];

    try {
      const condition = contestId
        ? [where("contestId", "==", contestId), where("gradeId", "==", gId)]
        : [where("gradeId", "==", gId)];
      const data = await fetchResultQuery.getDocuments(
        "contest_results_list",
        condition
      );
      const deduped = dedupeContestResultsByGrade(data, contestId || null);
      const targetDoc =
        deduped.find((d) => d.gradeId === gId) || deduped[0] || null;
      if (targetDoc?.result) {
        return [...targetDoc.result].sort(
          (a, b) => (a.playerRank || 0) - (b.playerRank || 0)
        );
      }
    } catch (error) {
      console.error(`순위 데이터 조회 실패 (gradeId: ${gId}):`, error);
    }
    return [];
  };

  // 5. 스폰서 광고 송출 (10초 무한 로테이션)
  const handleStartCommercials = async () => {
    if (!contestId) return;

    const finalRanks = await fetchCurrentGradeRankings(activeGradeId);

    try {
      await syncBroadcastPayload({
        mode: "COMMERCIAL",
        contestTitle: realContestTitle,
        stageInfo: {
          categoryTitle: activeCategoryTitle,
          gradeTitle: activeGradeTitle,
          gradeId: activeGradeId,
          stageNumber:
            currentStage?.stageNumber || currentStage?.stageIndex || "",
        },
        rankingData: finalRanks,
        activePlayer: null,
        specialScreenData: null,
        videoCommand: null,
        calloutData: null,
        updatedAt: Date.now(),
      });
      message.success("전광판: 스폰서 광고 로테이션 송출 시작");
    } catch (error) {
      console.error("광고 송출 오류:", error);
    }
  };

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

  const enrichRankingsWithPhotos = (reliableRanks) =>
    reliableRanks.map((r) => {
      const p =
        (currentPlayers || []).find(
          (cp) =>
            (r.playerUid && cp.playerUid && cp.playerUid === r.playerUid) ||
            (r.playerNumber !== undefined &&
              cp.playerNumber !== undefined &&
              String(cp.playerNumber).trim() === String(r.playerNumber).trim())
        ) ||
        (currentPlayers || []).find((cp) => cp.playerName === r.playerName);
      if (p) {
        const photos = extractPlayerPhotos(p);
        const stage1 =
          (!isNonPlayerUrl(p.stagePhoto1) && p.stagePhoto1) ||
          (!isNonPlayerUrl(p.stagePhotoUrl1) && p.stagePhotoUrl1) ||
          photos[0] ||
          "";
        const stage2 =
          (!isNonPlayerUrl(p.stagePhoto2) && p.stagePhoto2) ||
          (!isNonPlayerUrl(p.stagePhotoUrl2) && p.stagePhotoUrl2) ||
          (!isNonPlayerUrl(p.backgroundPhotoUrl) && p.backgroundPhotoUrl) ||
          photos[1] ||
          "";
        return {
          ...p,
          ...r,
          stagePhoto1: stage1,
          stagePhoto2: stage2,
          stagePhotoUrl1: stage1,
          stagePhotoUrl2: stage2,
          stagePhotoUrl: stage1 || r.stagePhotoUrl,
          profileImageUrl: p.profileImageUrl || photos[0] || r.profileImageUrl,
          playerGym: r.playerGym || p.playerGym,
          heightWeight: p.heightWeight || r.heightWeight || "",
          playerHeight: p.playerHeight || p.height || r.playerHeight || "",
          playerWeight: p.playerWeight || p.weight || r.playerWeight || "",
        };
      }
      return r;
    });

  // 6. 순위 발표 즉시 송출 (선택된 체급 전용)
  const handleDirectRanking = async () => {
    if (!contestId) {
      message.warning("대회 ID를 확인할 수 없습니다. 대회를 선택해주세요.");
      return;
    }

    const finalRanks = await fetchCurrentGradeRankings(activeGradeId);
    const reliableRanks = getReliableRankings(finalRanks);
    const enrichedRanks = enrichRankingsWithPhotos(reliableRanks);

    const payload = {
      mode: "RANKING",
      contestTitle: realContestTitle,
      stageInfo: {
        categoryTitle: activeCategoryTitle,
        gradeTitle: activeGradeTitle,
        gradeId: activeGradeId,
        stageNumber:
          currentStage?.stageNumber || currentStage?.stageIndex || "",
      },
      rankingData: enrichedRanks,
      activePlayer: null,
      specialScreenData: null,
      videoCommand: null,
      calloutData: null,
      updatedAt: Date.now(),
    };

    try {
      await syncBroadcastPayload(payload);
      message.success(`전광판: [${activeGradeTitle}] 순위 발표 화면 송출`);
    } catch (error) {
      console.error("[CONTROLLER] 순위 발표 송출 오류:", error);
    }
  };

  // 6-1. 공식 시상식 (1위·2위·3위 포디움 단상 + TOP 5 리스트) 송출
  const handleSendAwardCeremony = async () => {
    if (!contestId) {
      message.warning("대회 ID를 확인할 수 없습니다.");
      return;
    }

    const finalRanks = await fetchCurrentGradeRankings(activeGradeId);
    const reliableRanks = getReliableRankings(finalRanks);
    const enrichedRanks = enrichRankingsWithPhotos(reliableRanks);

    const payload = {
      mode: "AWARD_CEREMONY",
      contestTitle: realContestTitle,
      stageInfo: {
        categoryTitle: activeCategoryTitle,
        gradeTitle: activeGradeTitle,
        gradeId: activeGradeId,
        stageNumber:
          currentStage?.stageNumber || currentStage?.stageIndex || "",
      },
      rankingData: enrichedRanks,
      activePlayer: null,
      specialScreenData: null,
      videoCommand: null,
      calloutData: null,
      updatedAt: Date.now(),
    };

    try {
      await syncBroadcastPayload(payload);
      message.success(
        `전광판: [${activeGradeTitle}] 공식 시상식 (포디움) 화면 송출`
      );
    } catch (error) {
      console.error("공식 시상식 송출 오류:", error);
    }
  };

  // 7. 1위 우승자 단독 전체화면 송출
  const handleShowChampion = async () => {
    if (!contestId) {
      message.warning("대회 ID를 확인할 수 없습니다.");
      return;
    }

    const finalRanks = await fetchCurrentGradeRankings(activeGradeId);
    const reliableRanks = getReliableRankings(finalRanks);
    const enrichedRanks = enrichRankingsWithPhotos(reliableRanks);

    const top1 =
      enrichedRanks.find((p) => (p.playerRank || p.rank || 0) === 1) ||
      enrichedRanks[0] ||
      null;

    const payload = {
      mode: "CHAMPION_SHOWCASE",
      contestTitle: realContestTitle,
      stageInfo: {
        categoryTitle: activeCategoryTitle,
        gradeTitle: activeGradeTitle,
        gradeId: activeGradeId,
        stageNumber:
          currentStage?.stageNumber || currentStage?.stageIndex || "",
      },
      rankingData: enrichedRanks,
      activePlayer: top1 || null,
      topPlayer: top1 || null,
      specialScreenData: null,
      videoCommand: null,
      calloutData: null,
      updatedAt: Date.now(),
    };

    try {
      await syncBroadcastPayload(payload);
      message.success(
        top1
          ? `1위 [${top1.playerName}] (${activeGradeTitle}) 챔피언 단독 송출`
          : `[${activeGradeTitle}] 1위 챔피언 단독 송출`
      );
    } catch (error) {
      console.error("1위 단독 송출 오류:", error);
    }
  };

  // 7-1. 2~10위 발표 → 1위 단독 시상식 송출
  const handleSendSquareRanking = async () => {
    if (!contestId) {
      message.warning("대회 ID를 확인할 수 없습니다.");
      return;
    }

    const finalRanks = await fetchCurrentGradeRankings(activeGradeId);
    const reliableRanks = getReliableRankings(finalRanks);
    const enrichedRanks = enrichRankingsWithPhotos(reliableRanks);

    const payload = {
      mode: "SQUARE_RANKING",
      rankingPhase: "FULL_RANKING",
      contestTitle: realContestTitle,
      stageInfo: {
        categoryTitle: activeCategoryTitle,
        gradeTitle: activeGradeTitle,
        gradeId: activeGradeId,
        stageNumber:
          currentStage?.stageNumber || currentStage?.stageIndex || "",
      },
      rankingData: enrichedRanks,
      activePlayer: null,
      specialScreenData: null,
      videoCommand: null,
      calloutData: null,
      updatedAt: Date.now(),
    };

    try {
      await syncBroadcastPayload(payload);
      message.success("전광판: [2~10위 발표 → 1위 단독 시상식] 송출 시작");
    } catch (error) {
      console.error("순위발표 송출 오류:", error);
    }
  };

  // 7-2. 1위 우승자 단독 선수소개 샷 즉시 전환
  const handleSquareChampionSolo = async () => {
    if (!contestId) return;
    try {
      await syncBroadcastPayload({
        mode: "SQUARE_RANKING",
        rankingPhase: "CHAMPION_SOLO",
        updatedAt: Date.now(),
      });
      message.success("전광판: 1위 단독 선수소개 화면 송출");
    } catch (error) {
      console.error("1위 단독 샷 전환 오류:", error);
    }
  };

  // 7-3. 전체 순위표 복귀
  const handleSquareBackToFullRanking = async () => {
    if (!contestId) return;
    try {
      await syncBroadcastPayload({
        mode: "SQUARE_RANKING",
        rankingPhase: "FULL_RANKING",
        updatedAt: Date.now(),
      });
      message.success("전광판: 2~10위 순위표 화면으로 복귀했습니다.");
    } catch (error) {
      console.error("전체 순위표 복귀 오류:", error);
    }
  };

  // 8. 특별영상 전체화면 즉시 송출 핸들러
  const handleSendSpecialVideo = async (video) => {
    if (!contestId || !video) return;
    const now = Date.now();
    const shouldLoop = video.loop !== false;
    const videoMeta = {
      id: video.id,
      title: video.title,
      videoUrl: video.videoUrl,
      loop: shouldLoop,
    };
    const payload = {
      mode: "SPECIAL_VIDEO",
      contestTitle: realContestTitle,
      specialVideo: videoMeta,
      specialVideoData: videoMeta,
      specialVideoUrl: video.videoUrl,
      specialVideoTitle: video.title,
      videoCommand: {
        action: "PLAY",
        timestamp: now,
      },
      activePlayer: null,
      calloutData: null,
      updatedAt: now,
    };

    try {
      await syncBroadcastPayload(payload);
      message.success(`전광판: 특별영상 [${video.title}] 전체화면 송출`);
    } catch (error) {
      console.error("특별영상 송출 오류:", error);
    }
  };

  // 특별영상 실시간 원격 재생 제어
  const handleVideoCommand = async (action) => {
    if (!contestId) return;
    const cmd = {
      action,
      timestamp: Date.now(),
    };
    try {
      await Promise.all([
        updateBroadcast.updateData(
          `currentBroadcast/${contestId}/videoCommand`,
          cmd
        ),
        updateBroadcast.updateData(
          "currentBroadcast/ACTIVE_STAGE/videoCommand",
          cmd
        ),
      ]);

      if (action === "PLAY") message.success("특별영상: 재생 시작");
      else if (action === "PAUSE") message.info("특별영상: 일시정지");
      else if (action === "STOP") message.warning("특별영상: 정지 (처음으로)");
      else if (action === "SEEK_BACK_10") message.info("특별영상: 10초 뒤로");
      else if (action === "SEEK_FORWARD_10")
        message.info("특별영상: 10초 앞으로");
    } catch (err) {
      console.error("비디오 제어 명령 전송 실패:", err);
    }
  };

  // 특별영상 파일 업로드 핸들러 (Firebase Storage 연동)
  const handleUploadSpecialVideoFile = async (file) => {
    if (!file || !contestId) return;
    const title = newVideoTitle.trim() || file.name.replace(/\.[^/.]+$/, "");
    setIsUploadingVideo(true);
    setVideoUploadProgress(0);

    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9._가-힣]/g, "_");
      const storagePath = `special_videos/${contestId}/${Date.now()}_${cleanName}`;
      const sRef = storageRef(storage, storagePath);

      const uploadTask = uploadBytesResumable(sRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setVideoUploadProgress(percent);
        },
        (error) => {
          console.error("영상 업로드 실패:", error);
          message.error("영상 업로드 실패: " + error.message);
          setIsUploadingVideo(false);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            const newVideoItem = {
              id: `spvid_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 5)}`,
              title: title,
              videoUrl: downloadUrl,
              storagePath: storagePath,
              createdAt: Date.now(),
            };

            const updated = [...specialVideos, newVideoItem];
            await handleSaveSpecialVideos(updated);
            message.success(`특별영상 '${title}' 등록 완료`);
            setIsUploadingVideo(false);
            setVideoUploadProgress(0);
            setNewVideoTitle("");
            setNewVideoUrl("");
            if (specialVideoFileInputRef.current) {
              specialVideoFileInputRef.current.value = "";
            }
          } catch (e) {
            console.error("URL 획득 오류:", e);
            message.error("업로드 완료 후 URL 처리 실패: " + e.message);
            setIsUploadingVideo(false);
          }
        }
      );
    } catch (err) {
      console.error("업로드 오류:", err);
      message.error("업로드 처리 중 오류 발생: " + err.message);
      setIsUploadingVideo(false);
    }
  };

  // URL 직접 입력으로 특별영상 추가
  const handleAddVideoByUrl = async () => {
    if (!newVideoUrl.trim()) {
      message.warning("동영상 URL을 입력해주세요.");
      return;
    }
    const title =
      newVideoTitle.trim() || `특별영상 ${specialVideos.length + 1}`;
    const newVideoItem = {
      id: `spvid_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      title: title,
      videoUrl: newVideoUrl.trim(),
      storagePath: "",
      createdAt: Date.now(),
    };
    const updated = [...specialVideos, newVideoItem];
    await handleSaveSpecialVideos(updated);
    message.success(`특별영상 '${title}' 등록 완료`);
    setNewVideoTitle("");
    setNewVideoUrl("");
  };

  // 특별영상 삭제 핸들러
  const handleDeleteSpecialVideo = async (video) => {
    try {
      if (video.storagePath) {
        try {
          const sRef = storageRef(storage, video.storagePath);
          await deleteObject(sRef);
        } catch (e) {
          console.warn("Storage 파일 삭제 건너뜀:", e);
        }
      }
      const updated = specialVideos.filter((v) => v.id !== video.id);
      await handleSaveSpecialVideos(updated);
      message.success(`'${video.title}' 영상이 삭제되었습니다.`);
    } catch (err) {
      message.error("삭제 실패: " + err.message);
    }
  };

  // 전광판 새창 열기 (기본 16:9 와이드)
  const openDisplayWindow = () => {
    window.open(
      `/stage-live?contestId=${contestId}`,
      "StageLiveDisplay",
      "width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no"
    );
  };

  // 1:1 정방형 전광판 새창 열기
  const openSquareDisplayWindow = () => {
    window.open(
      `/stage-square?contestId=${contestId}`,
      "StageSquareDisplay",
      "width=1080,height=1080,menubar=no,toolbar=no,location=no,status=no"
    );
  };

  const isCombinedStage =
    Array.isArray(currentStage?.grades) && currentStage.grades.length > 1;

  useEffect(() => {
    if (isCombinedStage && isCalloutModalOpen) {
      setIsCalloutModalOpen(false);
    }
  }, [isCombinedStage, isCalloutModalOpen]);

  const sceneButtons = [
    {
      key: "STANDBY",
      label: "종목/체급 안내",
      icon: Tv,
      isActive: currentMode === "STANDBY",
      onClick: handleSetStandby,
    },
    ...(!isCombinedStage
      ? [
          {
            key: "COMPARISON_CALLOUT",
            label: "비교심사 호명",
            icon: Users,
            isActive: currentMode === "COMPARISON_CALLOUT",
            onClick: () => setIsCalloutModalOpen(true),
          },
        ]
      : []),
    {
      key: "POSEDOWN",
      label: "포즈다운 배틀",
      icon: Activity,
      isActive: currentMode === "POSEDOWN",
      onClick: handleSendPosedown,
    },
    {
      key: "COMMERCIAL",
      label: "광고 로테이션",
      icon: Megaphone,
      isActive: currentMode === "COMMERCIAL",
      onClick: handleStartCommercials,
    },
    {
      key: "RANKING",
      label: "전체 순위 발표",
      icon: ListOrdered,
      isActive: currentMode === "RANKING",
      onClick: handleDirectRanking,
    },
    {
      key: "SQUARE_RANKING",
      label: "2~10위 → 1위 시상",
      icon: Layers,
      isActive: currentMode === "SQUARE_RANKING",
      onClick: handleSendSquareRanking,
    },
    {
      key: "AWARD_CEREMONY",
      label: "공식 시상식 (포디움)",
      icon: Award,
      isActive: currentMode === "AWARD_CEREMONY",
      onClick: handleSendAwardCeremony,
    },
    {
      key: "CHAMPION_SHOWCASE",
      label: "1위 챔피언 단독",
      icon: Trophy,
      isActive: currentMode === "CHAMPION_SHOWCASE",
      onClick: handleShowChampion,
    },
    {
      key: "NEXT_STANDBY",
      label: "다음 종목 대기",
      icon: SkipForward,
      isActive: false,
      onClick: handleSetStandby,
    },
  ];

  const isLiveScene = currentMode !== "STANDBY";

  return (
    <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden mb-4">
      <ConfirmationModal
        isOpen={noticeOpen}
        message={noticeMessage}
        onCancel={() => setNoticeOpen(false)}
        onConfirm={() => setNoticeOpen(false)}
      />
      {/* 상단 컨트롤러 헤더 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 md:px-5 py-3 bg-[#f4f4f5] border-b border-[#171717]/[0.08]">
        <div className="flex items-center gap-2.5">
          <Monitor size={16} strokeWidth={1.5} className="text-[#525252]" />
          <span className="text-sm font-semibold text-[#171717]">
            실시간 무대 전광판 송출 콘솔
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 h-7 px-2.5 rounded-[6px] bg-white border border-[#171717]/10 text-xs">
            <StatusDot
              status={isLiveScene ? "live" : "idle"}
              live={isLiveScene}
            />
            <span className="text-[#737373]">송출:</span>
            <span className="font-medium text-[#171717]">
              {MODE_LABELS[currentMode] || currentMode}
            </span>
          </div>

          <button
            type="button"
            onClick={openSquareDisplayWindow}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#fafafa] text-[#171717] text-xs font-medium transition-colors cursor-pointer"
          >
            <ExternalLink size={14} strokeWidth={1.5} />
            <span className="tabular-nums">1:1 전광판</span>
          </button>

          <button
            type="button"
            onClick={openDisplayWindow}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <ExternalLink size={14} strokeWidth={1.5} />
            <span>전광판 화면 열기</span>
          </button>
        </div>
      </div>

      <div className="p-4 md:p-5 space-y-4">
        {/* 테마 색상 선택 및 전광판 음향 제어 바 */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-3.5 py-2.5 rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.08]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#525252] shrink-0">
              <Palette
                size={15}
                strokeWidth={1.5}
                className="text-[#737373]"
              />
              <span>전광판 테마</span>
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.values(THEME_CONFIGS).map((t) => {
                const isSelected = currentTheme === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => handleSelectTheme(t.key)}
                    className={`h-7 px-2.5 rounded-[6px] text-xs font-medium transition-colors cursor-pointer border ${
                      isSelected
                        ? "bg-[#2563eb]/[0.08] text-[#2563eb] border-[#2563eb]"
                        : "bg-white text-[#525252] border-[#171717]/10 hover:bg-[#f4f4f5] hover:text-[#171717]"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 lg:pl-3 lg:border-l lg:border-[#171717]/[0.08] shrink-0">
            <span className="text-xs font-medium text-[#525252]">
              전광판 음향
            </span>
            <button
              type="button"
              onClick={handleToggleAudio}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-[6px] text-xs font-medium border transition-colors cursor-pointer ${
                isAudioEnabled
                  ? "bg-[#2563eb]/[0.08] border-[#2563eb] text-[#2563eb]"
                  : "bg-white border-[#171717]/15 text-[#525252] hover:bg-[#f4f4f5]"
              }`}
            >
              {isAudioEnabled ? (
                <>
                  <StatusDot status="live" live />
                  <Volume2 size={14} strokeWidth={1.5} />
                  <span>출력 중 (ON)</span>
                </>
              ) : (
                <>
                  <VolumeX size={14} strokeWidth={1.5} />
                  <span>음소거 (OFF)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 통합 무대 전용 개별 체급 시상 선택 바 */}
        {isIntegratedStage && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/12">
            <div className="flex items-start sm:items-center gap-2.5">
              <StatusDot status="active" live />
              <div>
                <div className="text-xs font-medium text-[#525252]">
                  통합 무대 개별 시상 대상 선택 (순위 발표는 선택된 체급 기준으로 송출)
                </div>
                <div className="text-sm font-semibold text-[#171717] flex items-center gap-1.5 mt-0.5">
                  <span>선택 체급:</span>
                  <span className="px-2 py-0.5 rounded-[4px] bg-white border border-[#171717]/15 text-xs font-mono font-medium text-[#2563eb]">
                    {activeGradeTitle}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {stageGrades.map((g, gIdx) => {
                const isSelected =
                  g.gradeId === selectedGradeId ||
                  (!selectedGradeId && gIdx === 0);
                const gradePlayers = (currentPlayers || []).filter(
                  (p) => p.contestGradeId === g.gradeId
                );

                return (
                  <button
                    key={g.gradeId || gIdx}
                    type="button"
                    onClick={() => {
                      setSelectedGradeId(g.gradeId);
                      message.info(
                        `시상 대상 체급이 [${g.gradeTitle}]로 선택되었습니다.`
                      );
                    }}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] text-xs font-medium border transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#2563eb] text-white border-[#2563eb]"
                        : "bg-white text-[#171717] border-[#171717]/15 hover:bg-[#fafafa]"
                    }`}
                  >
                    <span>{g.gradeTitle}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-[4px] text-[11px] font-mono tabular-nums ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-[#f4f4f5] text-[#525252]"
                      }`}
                    >
                      {gradePlayers.length}명
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 스튜디오 씬 스위처 그리드 (Studio Switcher Grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
          {sceneButtons.map((scene) => {
            const IconComponent = scene.icon;
            return (
              <button
                key={scene.key}
                type="button"
                onClick={scene.onClick}
                className={`relative p-3 rounded-[8px] text-xs font-medium flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer border ${
                  scene.isActive
                    ? "bg-[#2563eb]/[0.08] text-[#2563eb] border-[#2563eb]"
                    : "bg-[#f4f4f5] hover:bg-[#e4e4e7]/70 text-[#171717] border-[#171717]/[0.08]"
                }`}
              >
                {scene.isActive && (
                  <span className="absolute top-2 right-2">
                    <StatusDot status="live" live />
                  </span>
                )}
                <IconComponent
                  size={16}
                  strokeWidth={1.5}
                  className={
                    scene.isActive ? "text-[#2563eb]" : "text-[#525252]"
                  }
                />
                <span className="text-center leading-tight">{scene.label}</span>
              </button>
            );
          })}
        </div>

        {/* [2~10위 → 1위 단독 시상식] 실시간 원격 제어 바 */}
        {currentMode === "SQUARE_RANKING" && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-[8px] bg-[#f4f4f5] border border-[#2563eb]/30">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusDot status="live" live />
              <span className="text-xs font-semibold text-[#171717]">
                단계별 시상식 원격 제어
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-white border border-[#171717]/10 text-xs font-medium text-[#2563eb]">
                {broadcastData?.rankingPhase === "CHAMPION_SOLO"
                  ? "1위 단독 화면 송출 중"
                  : "2~10위 순위표 송출 중"}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSquareChampionSolo}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Trophy size={14} strokeWidth={1.5} />
                <span>1위 단독 화면 전환</span>
              </button>

              <button
                type="button"
                onClick={handleSquareBackToFullRanking}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#fafafa] text-[#171717] text-xs font-medium transition-colors cursor-pointer"
              >
                <RotateCcw size={14} strokeWidth={1.5} />
                <span>2~10위 순위표 복귀</span>
              </button>

              <button
                type="button"
                onClick={handleSetStandby}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#fafafa] text-[#525252] text-xs font-medium transition-colors cursor-pointer"
              >
                <SkipForward size={14} strokeWidth={1.5} />
                <span>대기 화면 복귀</span>
              </button>
            </div>
          </div>
        )}

        {/* 특별영상 전체화면 송출 패널 */}
        <div className="p-3.5 rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.08] space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Film size={15} strokeWidth={1.5} className="text-[#525252]" />
              <span className="text-xs font-semibold text-[#171717]">
                특별영상 전체화면 송출
              </span>
              {currentMode === "SPECIAL_VIDEO" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] text-[11px] font-medium">
                  <StatusDot status="live" live />
                  <span>송출 중</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsSpecialVideoModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium transition-colors cursor-pointer"
            >
              <Upload size={13} strokeWidth={1.5} />
              <span>특별영상 업로드 및 관리</span>
            </button>
          </div>

          {specialVideos.length === 0 ? (
            <div className="text-xs text-[#737373] py-2.5 text-center rounded-[6px] border border-dashed border-[#171717]/15 bg-white">
              등록된 특별영상이 없습니다. 우측 상단 [특별영상 업로드 및 관리] 버튼으로 추가하세요.
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {specialVideos.map((video, idx) => {
                const isVideoActive =
                  currentMode === "SPECIAL_VIDEO" &&
                  (currentSpecialVideoId === video.id ||
                    broadcastData?.specialVideoUrl === video.videoUrl);

                return (
                  <button
                    key={video.id || idx}
                    type="button"
                    onClick={() => handleSendSpecialVideo(video)}
                    className={`inline-flex items-center gap-2 h-8 px-3 rounded-[6px] text-xs font-medium border transition-colors cursor-pointer ${
                      isVideoActive
                        ? "bg-[#2563eb]/[0.08] text-[#2563eb] border-[#2563eb]"
                        : "bg-white hover:bg-[#f4f4f5] text-[#171717] border-[#171717]/12"
                    }`}
                  >
                    {isVideoActive ? (
                      <StatusDot status="live" live />
                    ) : (
                      <Film
                        size={14}
                        strokeWidth={1.5}
                        className="text-[#737373]"
                      />
                    )}
                    <span>{video.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 특별영상 실시간 원격 재생 제어 바 */}
        {currentMode === "SPECIAL_VIDEO" && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-[8px] bg-[#f4f4f5] border border-[#2563eb]/30">
            <div className="flex items-center gap-2">
              <StatusDot status="live" live />
              <Film size={15} strokeWidth={1.5} className="text-[#2563eb]" />
              <span className="text-xs font-semibold text-[#171717]">
                {broadcastData?.specialVideoTitle || "특별영상 재생 중"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleVideoCommand("SEEK_BACK_10")}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#fafafa] text-[#171717] text-xs font-mono font-medium tabular-nums cursor-pointer"
                title="10초 뒤로 이동"
              >
                <RotateCcw size={13} strokeWidth={1.5} />
                <span>-10s</span>
              </button>

              <button
                type="button"
                onClick={() => handleVideoCommand("PLAY")}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-[6px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium cursor-pointer"
              >
                <Play size={13} strokeWidth={1.5} />
                <span>재생</span>
              </button>

              <button
                type="button"
                onClick={() => handleVideoCommand("PAUSE")}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#fafafa] text-[#171717] text-xs font-medium cursor-pointer"
              >
                <Pause size={13} strokeWidth={1.5} />
                <span>일시정지</span>
              </button>

              <button
                type="button"
                onClick={() => handleVideoCommand("SEEK_FORWARD_10")}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#fafafa] text-[#171717] text-xs font-mono font-medium tabular-nums cursor-pointer"
                title="10초 앞으로 이동"
              >
                <RotateCw size={13} strokeWidth={1.5} />
                <span>+10s</span>
              </button>

              <button
                type="button"
                onClick={() => handleVideoCommand("STOP")}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-[6px] border border-[#dc2626]/25 bg-white hover:bg-[#dc2626]/[0.05] text-[#dc2626] text-xs font-medium cursor-pointer"
              >
                <Square size={13} strokeWidth={1.5} />
                <span>정지</span>
              </button>

              <button
                type="button"
                onClick={handleSetStandby}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#fafafa] text-[#525252] text-xs font-medium cursor-pointer"
              >
                <SkipForward size={13} strokeWidth={1.5} />
                <span>송출 종료</span>
              </button>
            </div>
          </div>
        )}

        {/* 선수 입장 전체화면 프로필 소개 버튼 바 */}
        {currentPlayers && currentPlayers.length > 0 && (
          <div className="p-3.5 rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.08] space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#171717]">
                <User size={15} strokeWidth={1.5} className="text-[#525252]" />
                <span>선수 입장 프로필 송출</span>
                <span className="font-normal text-[#737373]">
                  (선택 시 전광판에 해당 선수 프로필 즉시 표시)
                </span>
              </span>
              {activePlayer && currentMode === "ATHLETE_INTRO" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] font-medium tabular-nums">
                  <StatusDot status="live" live />
                  <span>
                    #{activePlayer.playerNumber} {activePlayer.playerName} 송출 중
                  </span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {currentPlayers
                .filter((p) => isActiveStagePlayer(p))
                .map((player) => {
                  const isActive =
                    currentMode === "ATHLETE_INTRO" &&
                    activePlayer?.playerNumber === player.playerNumber;

                  const photos = getPlayerResolvedPhotos(player);
                  const hasPhoto = photos.length > 0;

                  return (
                    <button
                      key={player.playerUid || player.playerNumber}
                      type="button"
                      onClick={() => handleIntroPlayer(player)}
                      className={`inline-flex items-center gap-2 h-9 px-3 rounded-[8px] text-xs font-medium border transition-colors cursor-pointer ${
                        isActive
                          ? "bg-[#2563eb]/[0.08] text-[#2563eb] border-[#2563eb]"
                          : "bg-white hover:bg-[#f4f4f5] text-[#171717] border-[#171717]/12"
                      }`}
                    >
                      {hasPhoto && (
                        <img
                          src={photos[0]}
                          alt={player.playerName}
                          className="w-5 h-5 rounded-full object-cover border border-[#171717]/15"
                        />
                      )}
                      <BibTag
                        number={player.playerNumber}
                        variant={isActive ? "active" : "default"}
                        size="sm"
                      />
                      <span>{player.playerName}</span>
                      {player.heightWeight && (
                        <span className="text-[11px] font-mono tabular-nums text-[#737373]">
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

      {/* 비교심사 호명 전용 드로어 */}
      <Drawer
        placement="right"
        width={520}
        title={
          <div className="flex items-center gap-2 text-[#171717]">
            <Users size={16} strokeWidth={1.5} className="text-[#2563eb]" />
            <span className="text-sm font-semibold">
              비교심사 선수 호명 및 전광판 송출
            </span>
          </div>
        }
        open={isCalloutModalOpen}
        onClose={() => setIsCalloutModalOpen(false)}
        styles={{
          header: {
            borderBottom: "1px solid rgba(23, 23, 23, 0.08)",
            padding: "16px 24px",
          },
          body: {
            padding: "20px 24px",
          },
          footer: {
            borderTop: "1px solid rgba(23, 23, 23, 0.08)",
            padding: "12px 24px",
          },
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCalloutModalOpen(false)}
              className="h-9 px-4 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] border border-[#171717]/[0.08] text-xs font-medium text-[#171717] cursor-pointer transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSendCallout}
              className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium cursor-pointer transition-colors"
            >
              전광판에 비교심사 송출
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">
                비교심사 라운드 차수
              </label>
              <Select
                value={calloutRound}
                onChange={(val) => setCalloutRound(val)}
                className="w-full"
                options={[
                  {
                    value: "1차 비교심사 (FIRST CALLOUT)",
                    label: "1차 비교심사 (FIRST CALLOUT)",
                  },
                  {
                    value: "2차 비교심사 (SECOND CALLOUT)",
                    label: "2차 비교심사 (SECOND CALLOUT)",
                  },
                  {
                    value: "3차 비교심사 (THIRD CALLOUT)",
                    label: "3차 비교심사 (THIRD CALLOUT)",
                  },
                  {
                    value: "TOP 4 최상위 비교심사",
                    label: "TOP 4 최상위 비교심사",
                  },
                  {
                    value: "최종 순위 결정 비교심사",
                    label: "최종 순위 결정 비교심사",
                  },
                ]}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">
                포즈 안내 지시문
              </label>
              <Select
                value={calloutPose}
                onChange={(val) => setCalloutPose(val)}
                className="w-full"
                options={POSES_PRESET.map((p) => ({ value: p, label: p }))}
              />
            </div>
          </div>

          <div className="border-t border-[#171717]/[0.08] pt-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-medium text-[#525252]">
                호명 대상 선수 선택 (다중 선택 가능)
              </span>
              <span className="text-xs font-mono tabular-nums text-[#737373]">
                선택됨: {selectedCalloutPlayers.length}명
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {currentPlayers
                .filter((p) => isActiveStagePlayer(p))
                .map((p) => {
                  const id = p.playerNumber || p.playerUid;
                  const isChecked = selectedCalloutPlayers.includes(id);
                  return (
                    <div
                      key={p.playerUid || p.playerNumber}
                      onClick={() => {
                        if (isChecked) {
                          setSelectedCalloutPlayers(
                            selectedCalloutPlayers.filter((v) => v !== id)
                          );
                        } else {
                          setSelectedCalloutPlayers([
                            ...selectedCalloutPlayers,
                            id,
                          ]);
                        }
                      }}
                      className={`p-2.5 rounded-[8px] border flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-[#2563eb]/[0.06] border-[#2563eb] text-[#171717]"
                          : "bg-[#fafafa] border-[#171717]/10 hover:bg-[#f4f4f5] text-[#171717]"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <BibTag
                          number={p.playerNumber}
                          variant={isChecked ? "active" : "default"}
                          size="sm"
                        />
                        <span className="text-xs font-medium truncate">
                          {p.playerName}
                        </span>
                      </div>
                      <Checkbox checked={isChecked} />
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </Drawer>

      {/* 특별영상 업로드 및 관리 드로어 */}
      <Drawer
        placement="right"
        width={560}
        title={
          <div className="flex items-center gap-2 text-[#171717]">
            <Film size={16} strokeWidth={1.5} className="text-[#2563eb]" />
            <span className="text-sm font-semibold">
              특별영상 업로드 및 목록 관리
            </span>
          </div>
        }
        open={isSpecialVideoModalOpen}
        onClose={() => setIsSpecialVideoModalOpen(false)}
        destroyOnClose
        styles={{
          header: {
            borderBottom: "1px solid rgba(23, 23, 23, 0.08)",
            padding: "16px 24px",
          },
          body: {
            padding: "20px 24px",
          },
        }}
      >
        <div className="space-y-4">
          <div className="p-4 bg-[#fafafa] rounded-[10px] border border-[#171717]/[0.08] space-y-3">
            <div className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
              <Upload size={14} strokeWidth={1.5} className="text-[#525252]" />
              <span>새 특별영상 파일 업로드 (.mp4, .mov 등)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#525252] block mb-1">
                  영상 제목
                </label>
                <Input
                  placeholder="예: 개회식 오프닝 영상"
                  value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#525252] block mb-1">
                  동영상 파일 선택
                </label>
                <input
                  type="file"
                  accept="video/*"
                  ref={specialVideoFileInputRef}
                  disabled={isUploadingVideo}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadSpecialVideoFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-xs text-[#525252] file:mr-2 file:py-1.5 file:px-3 file:rounded-[6px] file:border-0 file:text-xs file:font-medium file:bg-[#2563eb] file:text-white hover:file:bg-[#1d4ed8] file:cursor-pointer"
                />
              </div>
            </div>

            {isUploadingVideo && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs font-medium text-[#171717]">
                  <span>Firebase Storage 업로드 중...</span>
                  <span className="font-mono tabular-nums">
                    {videoUploadProgress}%
                  </span>
                </div>
                <Progress
                  percent={videoUploadProgress}
                  status="active"
                  strokeColor="#2563eb"
                />
              </div>
            )}

            <div className="border-t border-[#171717]/[0.08] pt-3 space-y-1.5">
              <span className="text-xs font-medium text-[#525252] block">
                또는 외부 영상 URL 직접 입력
              </span>
              <div className="flex gap-2">
                <Input
                  placeholder="https://... (직접 비디오 URL 입력)"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  prefix={
                    <Link2
                      size={14}
                      strokeWidth={1.5}
                      className="text-[#737373]"
                    />
                  }
                  className="text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddVideoByUrl}
                  className="h-8 px-3.5 rounded-[6px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium shrink-0 cursor-pointer"
                >
                  URL 등록
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#171717] tabular-nums">
                등록된 특별영상 목록 ({specialVideos.length}개)
              </span>
              <span className="text-[#737373]">
                송출 시 전광판 전체화면으로 재생됩니다
              </span>
            </div>

            {specialVideos.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#737373] bg-[#fafafa] rounded-[8px] border border-[#171717]/[0.08]">
                등록된 특별영상이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {specialVideos.map((vid, idx) => (
                  <div
                    key={vid.id || idx}
                    className="p-3 bg-white rounded-[8px] border border-[#171717]/10 flex items-center justify-between gap-3 hover:border-[#171717]/25 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <BibTag prefix="#" number={idx + 1} size="sm" />
                        <span className="text-xs font-medium text-[#171717] truncate">
                          {vid.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#737373] font-mono truncate">
                        {vid.videoUrl}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          handleSendSpecialVideo(vid);
                          setIsSpecialVideoModalOpen(false);
                        }}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[6px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium cursor-pointer"
                      >
                        <Play size={12} strokeWidth={1.5} />
                        <span>송출</span>
                      </button>

                      <Popconfirm
                        title="이 특별영상을 삭제하시겠습니까?"
                        onConfirm={() => handleDeleteSpecialVideo(vid)}
                        okText="삭제"
                        cancelText="취소"
                      >
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[#737373] hover:bg-[#dc2626]/[0.08] hover:text-[#dc2626] transition-colors cursor-pointer"
                          aria-label="삭제"
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      </Popconfirm>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-[11px] text-[#737373] text-center pt-2 border-t border-[#171717]/[0.08]">
            등록된 특별영상은 사전 다운로드 매니저에도 자동 등록되어 오프라인 환경에서도 재생됩니다.
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default StageBroadcastController;
