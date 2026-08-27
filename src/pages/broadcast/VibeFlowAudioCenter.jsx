"use client";

import React, { useEffect, useState, useContext, useRef, useMemo } from "react";
import { useFirebaseRealtimeGetDocument } from "../../hooks/useFirebaseRealtime";
import { useFirestoreGetDocument } from "../../hooks/useFirestores";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import {
  Layout,
  Card,
  Table,
  Tag,
  Typography,
  Space,
  Spin,
  Alert,
  Button,
  Slider,
  Row,
  Col,
  message,
  Switch,
  Input,
  Modal,
  Tabs,
  Tooltip,
  Progress,
} from "antd";
import { database, storage } from "../../firebase";
import {
  PlayCircleFilled,
  PauseCircleFilled,
  CustomerServiceOutlined,
  CloudSyncOutlined,
  ReloadOutlined,
  LoginOutlined,
  LogoutOutlined,
  SearchOutlined,
  SoundFilled,
  CodeOutlined,
  TrophyOutlined,
  CheckCircleFilled,
  UserOutlined,
  ThunderboltFilled,
  CloudUploadOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  HourglassOutlined,
} from "@ant-design/icons";
import { ref as dbRef, set, remove, onValue } from "firebase/database";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  loginVibeFlow,
  fetchVibeFlowContestSongs,
  getStoredVibeFlowToken,
  getStoredVibeFlowUser,
  clearVibeFlowToken,
} from "../../services/vibeflowService";

const { Title, Text } = Typography;

/**
 * ⚡ 하드코딩된 특별 연출 커스텀 음원 카테고리 (VibeFlows 외 자체 업로드 관리)
 */
export const CUSTOM_CATEGORIES = [
  { key: "대기할때 음악", name: "대기할때 음악", icon: "⏳", desc: "선수 무대 대기 및 진행 준비 시 재생되는 배경음악", tagColor: "cyan" },
  { key: "시상식때의 음악", name: "시상식때의 음악", icon: "🏆", desc: "순위 발표 및 메달/트로피 수여 시 재생되는 웅장한 시상식 음악", tagColor: "gold" },
  { key: "쉬는시간의 음악", name: "쉬는시간의 음악", icon: "☕", desc: "인터미션 및 중간 휴식 시간에 재생되는 편안한 배경음악", tagColor: "geekblue" },
];

/**
 * 🚻 성별 판별 함수
 * @param {string} text - 종목명/체급명 문자열 (예: "여자 비키니", "남자 스포츠모델", "맨즈 피지크")
 * @param {string} [explicitGender] - 명시적 성별 필드 ("남", "여", "남자", "여자", "MALE", "FEMALE" 등)
 * @returns {"MALE" | "FEMALE" | "ANY"}
 */
export const extractGender = (text = "", explicitGender = "") => {
  if (explicitGender) {
    const g = String(explicitGender).trim().toLowerCase();
    if (["남", "남자", "남성", "male", "m", "맨즈", "mens", "men"].includes(g)) return "MALE";
    if (["여", "여자", "여성", "female", "f", "우먼스", "womens", "women"].includes(g)) return "FEMALE";
  }

  if (!text || typeof text !== "string") return "ANY";
  const lower = text.toLowerCase().replace(/\s+/g, "");

  // 1. 여성 명시 키워드 or 본질적 여성 전용 종목
  if (
    /(여자|여성|우먼|우먼스|women|woman|female|비키니|모노키니|모던키니|바디피규어|피규어|보디피트니스|바디피트니스|bodyfitness)/.test(lower)
  ) {
    return "FEMALE";
  }

  // 2. 남성 명시 키워드
  if (
    /(남자|남성|맨즈|맨|men|man|male)/.test(lower)
  ) {
    return "MALE";
  }

  // 3. 본질적 남성 종목 (보디빌딩, 피지크 등에서 성별 미지정 시 기본 남성)
  if (lower.includes("보디빌딩") || lower.includes("피지크")) {
    return "MALE";
  }

  return "ANY";
};

/**
 * 🏷️ 종목 어간 정규화 (성별 수식어는 extractGender로 별도 처리하므로 안전하게 분리)
 */
export const normalizeCategory = (name = "") => {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .replace(/\s+/g, "") // 공백 제거
    .replace(/(여자|여성|우먼|우먼스|남자|남성|맨즈|일반부|마스터즈|학생부|클래스)/g, "");
};

/**
 * 🎯 [성별 엄격 구분] VibeFlows 카테고리와 대회 카테고리 간 지능형 매칭
 * - 성별(남성 vs 여성)이 다르면 100% 매칭 불가 차단!
 * - 예: '여자 보디피트니스' ⇄ '여자 비키니' (동일 여성 계열 매칭)
 * - 예: '여자 청바지 모델' ⇄ '여자 스포츠모델' (동일 여성 모델 매칭)
 * - 예: '남자 스포츠모델' ⇄ '여자 스포츠모델' (불일치 차단)
 */
export const isCategoryMatched = (
  vibeflowCat = "",
  stageCat = "",
  explicitStageGender = ""
) => {
  if (!vibeflowCat || !stageCat) return false;

  const vibeLower = String(vibeflowCat).toLowerCase().replace(/\s+/g, "");
  const stageLower = String(stageCat).toLowerCase().replace(/\s+/g, "");

  // 1. 🚻 [성별 엄격 1차 검증: 문자열 직관 검증]
  const isVibeFemale = /(여자|여성|우먼|우먼스|female|women|woman|비키니|모노키니|모던키니|피규어|보디피트니스|바디피트니스)/.test(vibeLower);
  const isVibeMale = /(남자|남성|맨즈|맨|male|men|man)/.test(vibeLower);

  const isStageFemale = /(여자|여성|우먼|우먼스|female|women|woman|비키니|모노키니|모던키니|피규어|보디피트니스|바디피트니스)/.test(stageLower) ||
    ["여", "여자", "여성", "female", "f"].includes(String(explicitStageGender).trim().toLowerCase());
  const isStageMale = /(남자|남성|맨즈|맨|male|men|man)/.test(stageLower) ||
    ["남", "남자", "남성", "male", "m"].includes(String(explicitStageGender).trim().toLowerCase());

  // 성별이 서로 반대이면 100% 매칭 차단 (어떠한 경우에도 매칭 불가!)
  if (isVibeFemale && isStageMale) return false;
  if (isVibeMale && isStageFemale) return false;

  // 2. 🚻 [성별 엄격 2차 검증: extractGender 분석]
  const vibeGender = extractGender(vibeflowCat);
  const stageGender = extractGender(stageCat, explicitStageGender);

  if (vibeGender !== "ANY" && stageGender !== "ANY") {
    if (vibeGender !== stageGender) {
      return false; // 성별 불일치 100% 차단!
    }
  }

  // 🎯 [사용자 지정 특별 규칙]
  // '남자 스포츠모델', '남자 학생부 핏모델', '남자 피지크' ➜ '남자 피지크'로만 매칭! ('남자 스포츠모델' 음원은 완전 배제)
  const isPhysiqueTargetStage =
    /((남자|남성|맨즈|맨)?\s*(스포츠모델|스포츠\s*모델|핏모델|핏\s*모델|피트니스모델|피지크|학생부\s*핏모델))/i.test(stageCat) &&
    stageGender !== "FEMALE";

  if (isPhysiqueTargetStage) {
    // VibeFlows 카테고리가 '스포츠모델'이면 매칭 제외! (노래 안 씀)
    if (/스포츠모델|스포츠\s*모델/i.test(vibeflowCat)) {
      return false;
    }
    // VibeFlows 카테고리가 '남자 피지크' 또는 '피지크'이면 매칭!
    if (/피지크|physique/i.test(vibeflowCat) && vibeGender !== "FEMALE") {
      return true;
    }
  }

  if (vibeflowCat === stageCat) return true;

  // 3. 🏷️ [종목 어간 검증]
  const nVibe = normalizeCategory(vibeflowCat);
  const nStage = normalizeCategory(stageCat);

  if (nVibe && nStage) {
    if (nVibe === nStage) return true;
    if (nVibe.includes(nStage) || nStage.includes(nVibe)) return true;
  }

  // 4. 📚 [대표적 동의어 / 호환 종목 사전]
  const SYNONYM_GROUPS = [
    ["비키니", "모던키니", "모노키니", "보디피트니스", "바디피트니스", "bodyfitness", "bikini"],
    ["피지크", "머슬", "physique"],
    ["보디빌딩", "바디빌딩", "보디빌더", "bodybuilding"],
    ["스포츠모델", "청바지모델", "청바지", "바디핏", "스포츠", "피트니스모델", "sportsmodel", "jean", "jeans"],
    ["클래식피지크", "classicphysique"],
    ["클래식보디빌딩", "classicbodybuilding"],
    ["피규어", "figure"],
    ["애슬레틱", "어슬레틱", "athletic"],
  ];

  for (const group of SYNONYM_GROUPS) {
    const matchVibe = group.some((k) => nVibe.includes(k));
    const matchStage = group.some((k) => nStage.includes(k));
    if (matchVibe && matchStage) return true;
  }

  return false;
};

/**
 * 🧹 오디오 객체 버퍼 및 디코더 메모리 완전 해제 (GC 유도)
 * - 재생 중단
 * - src 속성 제거 및 빈 문자열 설정
 * - load() 호출을 통해 브라우저 미디어 파이프라인과 버퍼 캐시를 즉시 강제 릴리즈
 */
export const flushAudioMemory = (audio) => {
  if (!audio) return;
  try {
    audio.pause();
    audio.removeAttribute("src");
    audio.src = "";
    audio.currentTime = 0;
    audio.load(); // 브라우저 내부 미디어 디코더 및 네트워크 스트림 버퍼 즉시 강제 플러시
  } catch (e) {
    console.warn("[Audio Flush Warning]:", e);
  }
};

/**
 * 🏷️ 체급/부문(Division) 유연 매칭 (예: '-163cm' ⇄ '163cm이하', '일반부' ⇄ '성인부' 등)
 */
export const isDivisionMatched = (vibeflowDiv = "", stageGrade = "") => {
  if (!vibeflowDiv || !stageGrade) return false;
  if (vibeflowDiv === stageGrade) return true;

  const nVibe = vibeflowDiv.replace(/\s+/g, "").toLowerCase();
  const nStage = stageGrade.replace(/\s+/g, "").toLowerCase();

  if (nVibe === nStage) return true;
  if (nVibe.includes(nStage) || nStage.includes(nVibe)) return true;

  // 체급/부문 동의어 그룹
  const DIV_GROUPS = [
    ["일반부", "성인부", "오픈", "open", "adult", "성인"],
    ["학생부", "청소년부", "주니어", "junior", "고등부", "중등부"],
    ["마스터즈", "장년부", "시니어", "masters"],
    ["그랑프리", "통합", "overall"],
  ];

  for (const group of DIV_GROUPS) {
    const matchVibe = group.some((k) => nVibe.includes(k));
    const matchStage = group.some((k) => nStage.includes(k));
    if (matchVibe && matchStage) return true;
  }

  return false;
};

/**
 * 💪 보디빌딩 계열 종목 판별 (보디빌딩, 클래식 보디빌딩, 클래식 피지크, 머슬 등)
 */
export const isBodybuildingFamily = (categoryTitle = "") => {
  if (!categoryTitle) return false;
  return /(보디빌딩|바디빌딩|bodybuilding|클래식보디빌딩|classicbodybuilding|클래식\s*보디빌딩|클래식피지크|classicphysique|클래식\s*피지크|머슬|muscle)/i.test(categoryTitle);
};

/**
 * 🎯 성인부 우선 매칭 대상 종목 판별 (보디빌딩 계열 + 남자 피지크/스포츠모델 계열)
 */
export const isAdultPriorityCategory = (categoryTitle = "", gender = "") => {
  if (!categoryTitle) return false;
  if (isBodybuildingFamily(categoryTitle)) return true;
  return (
    /((남자|남성|맨즈|맨)?\s*(스포츠모델|스포츠\s*모델|핏모델|핏\s*모델|피트니스모델|피지크|학생부\s*핏모델))/i.test(categoryTitle) &&
    extractGender(categoryTitle, gender) !== "FEMALE"
  );
};

/**
 * 🔑 음원 고유 식별 키 추출 (제목이 아닌 UUID / ID / URL 고유값으로만 엄격 식별)
 */
export const getTrackKey = (t) => {
  if (!t || typeof t !== "object") return "";
  return String(t.uuid || t.id || t.song_id || t._id || t.audio_url || t.downloadURL || t.url || "");
};

/**
 * 🎵 두 음원 객체가 동일한지 정확히 판별 (UUID / ID / 고유 오디오 URL 기준)
 */
export const isTrackEqual = (t1, t2) => {
  if (!t1 || !t2) return false;
  if (t1 === t2) return true;

  const key1 = getTrackKey(t1);
  const key2 = getTrackKey(t2);

  if (key1 && key2) {
    return key1 === key2;
  }

  return false;
};

/**
 * 🎯 특정 종목/체급/성별에 대한 최우선 매칭 시드 음원 추출 함수 (사전 캐싱용)
 */
export const getMatchingSeedTrack = (categoryTitle = "", gradeTitle = "", gender = "", allTracks = []) => {
  if (!categoryTitle || !Array.isArray(allTracks) || allTracks.length === 0) return null;
  const isAdultPriority = isAdultPriorityCategory(categoryTitle, gender);

  // 1순위: 종목 + 체급/부문 일치 (또는 성인부 일치)
  const seed1 = allTracks.filter((t) => {
    const matchCat = isCategoryMatched(t.contest_category_kr, categoryTitle, gender);
    if (!matchCat) return false;
    if (isAdultPriority) {
      return isDivisionMatched(t.contest_division_kr, "성인부");
    }
    if (gradeTitle) {
      return isDivisionMatched(t.contest_division_kr, gradeTitle);
    }
    return true;
  });

  if (seed1.length > 0) return seed1[0];

  // 2순위: 동일 종목 일치
  const seed2 = allTracks.filter((t) =>
    isCategoryMatched(t.contest_category_kr, categoryTitle, gender)
  );
  if (seed2.length > 0) return seed2[0];

  return null;
};

export const VibeFlowAudioCenter = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const contestId = currentContest?.contests?.id;

  // 🔑 VibeFlows 인증 & 데이터 상태
  const [token, setToken] = useState(() => getStoredVibeFlowToken());
  const [user, setUser] = useState(() => getStoredVibeFlowUser());
  const [tracks, setTracks] = useState([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [rawApiResponse, setRawApiResponse] = useState(null);

  // 🔐 로그인 모달 상태
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(!token);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(true);

  // 🔍 검색 & 2단계 종목(Category) / 체급·부문(Division) 필터
  const [searchText, setSearchText] = useState("");
  const [selectedCategoryTab, setSelectedCategoryTab] = useState("ALL");
  const [selectedDivision, setSelectedDivision] = useState("ALL");
  const [isRawModalOpen, setIsRawModalOpen] = useState(false);

  // ⚡ 스마트 오토파일럿 & 시드 재생 상태
  const [isAutoPlayOnStageChange, setIsAutoPlayOnStageChange] = useState(true);
  const [activeSeedLevel, setActiveSeedLevel] = useState(null); // 1 | 2 | 3 | null
  const [playedTrackIds, setPlayedTrackIds] = useState([]);
  const [lastStageKey, setLastStageKey] = useState("");

  // ☁️ 커스텀 업로드 음원 상태 (Firebase Realtime DB & Storage)
  const [customTracks, setCustomTracks] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // 🎧 오디오 플레이어 상태
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [preCuedTrack, setPreCuedTrack] = useState(null); // 5초 전 빈 데크에 걸어둔 다음 곡

  // 📡 원격 동기화 상태
  const [isRemoteSync, setIsRemoteSync] = useState(true);
  const [lastProcessedSelectedAt, setLastProcessedSelectedAt] = useState(0);

  // 🎛️ 듀얼 오디오 재생 데크 (Deck A & Deck B 크로스페이더)
  const deckARef = useRef(null);
  const deckBRef = useRef(null);
  const [activeDeck, setActiveDeck] = useState("A"); // "A" | "B"
  const activeDeckRef = useRef("A");
  const isCrossfadingRef = useRef(false);
  const fadeAnimationRef = useRef(null);
  const pauseFadeAnimationRef = useRef(null);
  const masterVolumeRef = useRef(volume);
  const rafRef = useRef(null);

  // 🎧 [사전 로드 & 재시도 & 2.0초 무중단 크로스페이드 Refs]
  const preCuedTrackRef = useRef(null);
  const isPreCuedRef = useRef(false);
  const preMountAttemptCountRef = useRef(0);
  const lastPreMountAttemptTimeRef = useRef(0);
  const hasAlertedPreMountFailRef = useRef(false);
  const hasAutoCrossfadedRef = useRef(false);
  const playedTrackIdsRef = useRef(playedTrackIds);
  const isAutoPlayRef = useRef(isAutoPlayOnStageChange);
  const getNextSeedTrackRef = useRef(null);
  const playNextSeedTrackRef = useRef(null);

  useEffect(() => {
    playedTrackIdsRef.current = playedTrackIds;
  }, [playedTrackIds]);

  useEffect(() => {
    isAutoPlayRef.current = isAutoPlayOnStageChange;
  }, [isAutoPlayOnStageChange]);

  useEffect(() => {
    masterVolumeRef.current = volume;
  }, [volume]);

  // Audio 객체 초기화 & 클린업
  useEffect(() => {
    if (typeof Audio !== "undefined") {
      const a = new Audio();
      const b = new Audio();
      a.preload = "auto";
      b.preload = "auto";
      deckARef.current = a;
      deckBRef.current = b;
    }
    return () => {
      flushAudioMemory(deckARef.current);
      flushAudioMemory(deckBRef.current);
      if (fadeAnimationRef.current) {
        cancelAnimationFrame(fadeAnimationRef.current);
      }
      if (pauseFadeAnimationRef.current) {
        cancelAnimationFrame(pauseFadeAnimationRef.current);
      }
    };
  }, []);

  // 🌐 Firebase Realtime DB Stage & nowPlaying 구독
  const { data: realtimeStage } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );
  const currentStageCategory = realtimeStage?.categoryTitle || "";
  const currentStageGrade = realtimeStage?.gradeTitle || "";
  const currentStageGender =
    realtimeStage?.contestCategoryGender ||
    realtimeStage?.gender ||
    realtimeStage?.categoryGender ||
    "";

  const { data: nowPlaying } = useFirebaseRealtimeGetDocument("nowPlaying");

  // 📅 [대회 전체 시간표 무대 목록 로드 (다음 순서 무대 시드곡 사전 캐싱용)]
  const fetchStagesDoc = useFirestoreGetDocument("contest_stages_assign");
  const [contestStagesList, setContestStagesList] = useState([]);

  useEffect(() => {
    const stageAssignId =
      currentContest?.contests?.contestStagesAssignId ||
      currentContest?.contestInfo?.contestStagesAssignId ||
      currentContest?.contestStagesAssignId;
    if (!stageAssignId) return;

    fetchStagesDoc
      .getDocument(stageAssignId)
      .then((res) => {
        if (res?.stages && Array.isArray(res.stages)) {
          const sorted = [...res.stages].sort(
            (a, b) => (a.stageNumber || 0) - (b.stageNumber || 0)
          );
          setContestStagesList(sorted);
        }
      })
      .catch((e) => {
        console.warn("[VibeFlow Audio] 대회 무대 시간표 로드 실패:", e);
      });
  }, [currentContest]);

  // ⚡ [다음 순서 무대(종목) 1~2개 시드 음원 사전 백그라운드 캐싱(Prefetching) 엔진]
  const prefetchedUrlsRef = useRef(new Set());

  useEffect(() => {
    if (contestStagesList.length === 0 || tracks.length === 0) return;

    const curStageNum = Number(
      realtimeStage?.stageNumber || realtimeStage?.contestStageNumber || 0
    );
    const curStageId = realtimeStage?.stageId;

    let curIdx = contestStagesList.findIndex(
      (s) =>
        (curStageId && s.stageId === curStageId) ||
        (s.stageNumber && Number(s.stageNumber) === curStageNum)
    );

    if (curIdx < 0 && curStageNum > 0) {
      curIdx = contestStagesList.findIndex(
        (s) => Number(s.stageNumber) === curStageNum
      );
    }

    // 다음 1번째 및 2번째 무대 추출
    const upcomingStages = [];
    if (curIdx >= 0) {
      if (curIdx + 1 < contestStagesList.length) {
        upcomingStages.push(contestStagesList[curIdx + 1]);
      }
      if (curIdx + 2 < contestStagesList.length) {
        upcomingStages.push(contestStagesList[curIdx + 2]);
      }
    } else if (contestStagesList.length > 0) {
      // 대회 시작 전이면 1번 및 2번 무대 사전 캐싱
      upcomingStages.push(contestStagesList[0]);
      if (contestStagesList.length > 1) {
        upcomingStages.push(contestStagesList[1]);
      }
    }

    upcomingStages.forEach((stg) => {
      const cat = stg.categoryTitle || stg.contestCategoryTitle || "";
      const grd =
        stg.gradeTitle ||
        stg.contestGradeTitle ||
        stg.grades?.[0]?.gradeTitle ||
        "";
      const gnd =
        stg.contestCategoryGender || stg.gender || stg.categoryGender || "";

      const seedTrack = getMatchingSeedTrack(cat, grd, gnd, tracks);
      if (!seedTrack) return;

      const url =
        seedTrack.audio_url || seedTrack.downloadURL || seedTrack.url;
      if (!url || prefetchedUrlsRef.current.has(url)) return;

      prefetchedUrlsRef.current.add(url);
      console.log(
        `[VibeFlow Prefetch] 🚀 다음 예정 무대 [${stg.stageNumber}번: ${cat} - ${grd}] 음원 사전 캐싱 시작: ${seedTrack.title}`
      );

      // 브라우저 백그라운드 프리페치 (브라우저 HTTP Disk/Memory Cache에 즉시 적재)
      fetch(url, { mode: "cors" })
        .then((res) => res.blob())
        .then(() => {
          console.log(
            `[VibeFlow Prefetch] ⚡ 다음 무대 음원 로컬 캐싱 완료 (전환 시 0초 즉시 재생 보장): ${seedTrack.title}`
          );
        })
        .catch(() => {
          try {
            const tempAudio = new Audio();
            tempAudio.preload = "auto";
            tempAudio.src = url;
          } catch (e) {}
        });
    });
  }, [
    contestStagesList,
    realtimeStage?.stageNumber,
    realtimeStage?.stageId,
    tracks,
  ]);

  // ⏱️ 트랙 재생 시간 업데이트 & 8초 전 다음 곡 사전 다운로드 & 2.0초 전 듀얼 데크 오버랩 믹싱 루프
  const startTracking = () => {
    const update = () => {
      const curAudio = activeDeckRef.current === "A" ? deckARef.current : deckBRef.current;
      if (curAudio) {
        const curTime = curAudio.currentTime || 0;
        const dur = curAudio.duration || 0;
        if (!isNaN(curTime)) setCurrentTime(curTime);
        if (!isNaN(dur) && dur > 0) setTrackDuration(dur);

        // 🎧 [지능형 다단계 사전 장착: 10초 ➜ 20초 ➜ 1초 간격 5회 재시도 ➜ 화면 무음 알림]
        if (dur > 6 && curTime > 1) {
          const remaining = dur - curTime;
          const isCustom = isCustomTrack(currentTrack);
          const crossfadeThreshold = isCustom
            ? dur > 22
              ? 10.0
              : Math.max(2.0, dur * 0.4)
            : 2.0;
          const crossfadeDurationMs = isCustom
            ? dur > 22
              ? 10000
              : Math.round(crossfadeThreshold * 1000)
            : 2000;

          const preMountThreshold1 = dur > 25 ? 10.0 : 3.0;
          const preMountThreshold2 = dur > 25 ? 20.0 : 6.0;

          // 🌟 이미 빈 데크에 다음 곡이 잘 걸려있다면 일체의 추가 시도/알림 없이 패스!
          if (!isPreCuedRef.current && remaining > crossfadeThreshold) {
            let shouldAttempt = false;

            // ① 1차 시도 (10초 경과 시점)
            if (curTime >= preMountThreshold1 && preMountAttemptCountRef.current === 0) {
              shouldAttempt = true;
              preMountAttemptCountRef.current = 1;
              lastPreMountAttemptTimeRef.current = curTime;
            }
            // ② 2차 시도 (10초 시점을 놓쳤거나 실패하여 20초 경과 시점)
            else if (curTime >= preMountThreshold2 && preMountAttemptCountRef.current === 1) {
              shouldAttempt = true;
              preMountAttemptCountRef.current = 2;
              lastPreMountAttemptTimeRef.current = curTime;
            }
            // ③ 3차~7차 시도 (20초 이후에도 안 걸렸을 때 1초에 1번씩 총 5회 연속 재시도)
            else if (
              curTime >= preMountThreshold2 &&
              preMountAttemptCountRef.current >= 2 &&
              preMountAttemptCountRef.current < 7 &&
              curTime - lastPreMountAttemptTimeRef.current >= 1.0
            ) {
              shouldAttempt = true;
              preMountAttemptCountRef.current += 1;
              lastPreMountAttemptTimeRef.current = curTime;
            }

            // 🎯 사전 장착 실행 (자체 음원은 동일 폴더에서 추출하여 빈 데크 적재)
            if (shouldAttempt) {
              const nextInfo = getNextSeedTrackRef.current
                ? getNextSeedTrackRef.current(playedTrackIdsRef.current)
                : null;

              if (nextInfo && nextInfo.track) {
                const playableUrl =
                  nextInfo.track.audio_url || nextInfo.track.downloadURL || nextInfo.track.url;

                if (playableUrl) {
                  preCuedTrackRef.current = nextInfo;
                  setPreCuedTrack(nextInfo.track);
                  isPreCuedRef.current = true; // ✅ 성공적으로 빈 데크에 장착 완료!

                  const idleDeckName = activeDeckRef.current === "A" ? "B" : "A";
                  const idleAudio = idleDeckName === "A" ? deckARef.current : deckBRef.current;
                  if (idleAudio) {
                    idleAudio.preload = "auto";
                    if (idleAudio.src !== playableUrl) {
                      idleAudio.src = playableUrl;
                    }
                    idleAudio.volume = 0;
                    idleAudio.currentTime = 0;
                    idleAudio.load(); // 빈 데크에 완벽 적재!
                  }
                }
              }

              // ④ 마지막 5회(총 7차) 시도 후에도 음원을 못 걸었을 경우 ➜ 화면에 무음 시각 알림 표시!
              if (
                !isPreCuedRef.current &&
                preMountAttemptCountRef.current >= 7 &&
                !hasAlertedPreMountFailRef.current
              ) {
                hasAlertedPreMountFailRef.current = true;
                message.warning({
                  content: "⚠️ 다음 곡 사전 대기(스탠바이) 장착 실패: 재생 가능한 음원 목록을 확인해 주세요.",
                  duration: 6,
                });
              }
            }
          }

          // 2단계: 크로스페이드 실행 (자체/로컬 음원은 종료 10.0초 전부터 10초간 완벽한 무중단 페이드인/아웃 전환!)
          if (
            remaining <= crossfadeThreshold &&
            !hasAutoCrossfadedRef.current
          ) {
            hasAutoCrossfadedRef.current = true;
            setPreCuedTrack(null);
            if (playNextSeedTrackRef.current) {
              // 자체 음원은 10초(10000ms), 일반 경기 음원은 2초(2000ms) 듀얼 데크 오버랩 크로스페이드 실행
              playNextSeedTrackRef.current(false, true, crossfadeDurationMs);
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(update);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(update);
  };

  const stopTracking = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const hasLoadedRef = useRef(false);

  // 📥 VibeFlows 음원 목록 로드
  const loadVibeFlowTracks = async (authToken = token) => {
    if (!authToken) {
      setIsLoadingTracks(false);
      setIsLoginModalOpen(true);
      return;
    }

    setIsLoadingTracks(true);
    try {
      const res = await fetchVibeFlowContestSongs(authToken);
      setRawApiResponse(res.raw);

      if (res.success && Array.isArray(res.tracks)) {
        setTracks(res.tracks);
        message.success(`VibeFlows 음원 총 ${res.tracks.length}곡을 성공적으로 불러왔습니다!`);
      } else {
        if (res.isUnauthorized) {
          setToken(null);
          setUser(null);
          hasLoadedRef.current = false;
          setIsLoginModalOpen(true);
          message.error("VibeFlows 세션이 만료되었습니다. 다시 로그인해주세요.");
        } else {
          message.error(res.error || "음원 목록을 불러오지 못했습니다.");
        }
      }
    } catch (err) {
      console.error(err);
      message.error("VibeFlows API 통신 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingTracks(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadVibeFlowTracks(token);
    } else {
      setIsLoadingTracks(false);
      setIsLoginModalOpen(true);
    }
  }, [token]);

  // 🔐 로그인 핸들러
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!loginEmail || !loginPassword) {
      message.warning("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await loginVibeFlow(loginEmail, loginPassword, rememberLogin);
      if (res.success && res.token) {
        setToken(res.token);
        setUser(res.user);
        setIsLoginModalOpen(false);
        setLoginPassword("");
        message.success("VibeFlows 공식 인증에 성공했습니다!");
      } else {
        message.error(res.error || "로그인에 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      message.error("로그인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 🚪 로그아웃 핸들러
  const handleLogout = () => {
    Modal.confirm({
      title: "VibeFlows 계정에서 로그아웃하시겠습니까?",
      content: "저장된 인증 토큰이 삭제되며 음원 목록을 새로 불러오려면 다시 로그인해야 합니다.",
      okText: "로그아웃",
      okType: "danger",
      cancelText: "취소",
      onOk: () => {
        clearVibeFlowToken();
        setToken(null);
        setUser(null);
        setTracks([]);
        flushAudioMemory(deckARef.current);
        flushAudioMemory(deckBRef.current);
        setIsPlaying(false);
        setCurrentTrack(null);
        message.info("로그아웃되었습니다.");
        setIsLoginModalOpen(true);
      },
    });
  };

  // 📡 Firebase Realtime DB 커스텀 음원 구독 (실시간 자동 동기화)
  useEffect(() => {
    const bgmDbRef = dbRef(database, "custom_bgm");
    const unsubscribe = onValue(
      bgmDbRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const list = Object.entries(data).map(([id, item]) => ({
            ...item,
            id: id,
            uuid: item.uuid || `custom_${id}`,
            is_custom: true,
          }));
          list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
          setCustomTracks(list);
        } else {
          setCustomTracks([]);
        }
      },
      (error) => {
        console.warn("[Custom BGM Fetch Error]:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // ☁️ 커스텀 음원 파일 업로드 핸들러 (Firebase Storage + Realtime DB)
  const handleUploadCustomMusic = async (fileList, targetCategory) => {
    if (!fileList || fileList.length === 0) return;
    const category = targetCategory || selectedCategoryTab || "대기할때 음악";

    setIsUploading(true);
    setUploadProgress(0);

    const files = Array.from(fileList);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // 1. 재생시간(Duration) 추출
        const durationSec = await new Promise((resolve) => {
          try {
            const tempAudio = new Audio(URL.createObjectURL(file));
            tempAudio.onloadedmetadata = () => resolve(Math.round(tempAudio.duration) || 0);
            tempAudio.onerror = () => resolve(0);
          } catch {
            resolve(0);
          }
        });

        // 2. Firebase Storage 업로드
        const cleanName = file.name.replace(/[^a-zA-Z0-9._가-힣-]/g, "_");
        const songId = `bgm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const storagePath = `custom_bgm/${category}/${Date.now()}_${cleanName}`;
        const sRef = storageRef(storage, storagePath);

        const uploadTask = uploadBytesResumable(sRef, file);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const filePercent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              const totalPercent = Math.round(((i + filePercent / 100) / files.length) * 100);
              setUploadProgress(totalPercent);
            },
            (error) => reject(error),
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

              const songData = {
                id: songId,
                uuid: songId,
                title: file.name.replace(/\.[^/.]+$/, ""),
                name: file.name.replace(/\.[^/.]+$/, ""),
                artist: "자체 방송 음원",
                audio_url: downloadURL,
                downloadURL: downloadURL,
                url: downloadURL,
                storagePath: storagePath,
                contest_category_kr: category,
                contest_division_kr: "공통 / 전체",
                duration: durationSec,
                duration_sec: durationSec,
                created_at: Date.now(),
                is_custom: true,
                is_active: 1,
              };

              await set(dbRef(database, `custom_bgm/${songId}`), songData);
              successCount++;
              resolve();
            }
          );
        });
      } catch (err) {
        console.error("음원 업로드 실패:", err);
        message.error(`'${file.name}' 업로드 실패: ${err.message}`);
      }
    }

    setIsUploading(false);
    setUploadProgress(0);

    if (successCount > 0) {
      message.success(`총 ${successCount}곡의 [${category}] 음원 업로드가 완료되었습니다! 🎉`);
    }
  };

  // 🗑️ 커스텀 음원 삭제 핸들러
  const handleDeleteCustomMusic = (record) => {
    Modal.confirm({
      title: `'${record.title}' 음원을 삭제하시겠습니까?`,
      content: "음원 목록에서 완전히 삭제되며 복구할 수 없습니다.",
      okText: "삭제",
      okType: "danger",
      cancelText: "취소",
      onOk: async () => {
        try {
          // 1. 현재 재생 중인 트랙이면 정지
          if (isTrackEqual(currentTrack, record)) {
            flushAudioMemory(deckARef.current);
            flushAudioMemory(deckBRef.current);
            setIsPlaying(false);
            setCurrentTrack(null);
            stopTracking();
          }

          // 2. Firebase Storage 파일 삭제
          if (record.storagePath) {
            try {
              const sRef = storageRef(storage, record.storagePath);
              await deleteObject(sRef);
            } catch (storageErr) {
              console.warn("스토리지 파일 삭제 경고:", storageErr);
            }
          }

          // 3. Realtime DB 레코드 삭제
          await remove(dbRef(database, `custom_bgm/${record.id}`));
          message.success("음원이 성공적으로 삭제되었습니다.");
        } catch (err) {
          message.error("삭제 실패: " + err.message);
        }
      },
    });
  };

  // 📡 nowPlaying 원격 제어 수신
  useEffect(() => {
    if (!nowPlaying || !isRemoteSync) return;

    const curAudio = activeDeckRef.current === "A" ? deckARef.current : deckBRef.current;
    if (!curAudio) return;

    const { downloadURL, status, selectedAt } = nowPlaying;
    if (!downloadURL && status !== "stop") return;

    if (selectedAt === lastProcessedSelectedAt) {
      if (status === "play" && curAudio.paused) {
        curAudio.play().catch(() => {});
        setIsPlaying(true);
      } else if (status === "pause" && !curAudio.paused) {
        curAudio.pause();
        setIsPlaying(false);
      } else if (status === "stop") {
        curAudio.pause();
        curAudio.currentTime = 0;
        setIsPlaying(false);
      }
      return;
    }

    setLastProcessedSelectedAt(selectedAt);

    if (status === "play") {
      const playableURL = downloadURL;
      if (!playableURL) return;

      crossfadeToTrack({ audio_url: playableURL, title: nowPlaying.fileName || "VibeFlow Track" }, 1500);
    } else if (status === "stop" || status === "pause") {
      if (status === "stop") {
        flushAudioMemory(deckARef.current);
        flushAudioMemory(deckBRef.current);
      } else {
        if (deckARef.current) deckARef.current.pause();
        if (deckBRef.current) deckBRef.current.pause();
      }
      setIsPlaying(false);
      stopTracking();
    }
  }, [nowPlaying, isRemoteSync, lastProcessedSelectedAt]);

  // 📡 nowPlaying 원격 브로드캐스트
  const updateRemoteNowPlaying = (track, status) => {
    if (!isRemoteSync) return;
    const timestamp = Date.now();
    setLastProcessedSelectedAt(timestamp);

    const data = {
      fileName: track.title || track.name || "VibeFlow Track",
      filePath: track.uuid || track.id || "",
      downloadURL: track.audio_url || track.url || track.downloadURL || "",
      category: track.contest_category_kr || "",
      division: track.contest_division_kr || "",
      artist: track.artist || "",
      selectedAt: timestamp,
      status: status,
    };
    set(dbRef(database, "nowPlaying"), data);
  };

  // 🎛️ 듀얼 데크 지능형 크로스페이드 (현재 곡 재생 유지 ➜ 새 곡 로딩 완료 시 자연스럽고 빠른 페이드아웃/페이드인 전환)
  const crossfadeToTrack = (track, crossfadeDuration = 800) => {
    if (!track || (!track.audio_url && !track.downloadURL && !track.url)) {
      message.error("재생 가능한 음원 URL이 없습니다.");
      return;
    }

    if (!deckARef.current) deckARef.current = new Audio();
    if (!deckBRef.current) deckBRef.current = new Audio();

    // 1. 이전 페이드 애니메이션 취소
    if (fadeAnimationRef.current) {
      cancelAnimationFrame(fadeAnimationRef.current);
      fadeAnimationRef.current = null;
    }

    const currentDeckName = activeDeckRef.current;
    const nextDeckName = currentDeckName === "A" ? "B" : "A";

    const currentAudio = currentDeckName === "A" ? deckARef.current : deckBRef.current;
    const nextAudio = nextDeckName === "A" ? deckARef.current : deckBRef.current;

    const targetVol = masterVolumeRef.current;
    const playableUrl = track.audio_url || track.downloadURL || track.url;

    // 현재 재생 중인 곡이 정상 동작 중인지 확인
    const isCurrentlyActive = currentAudio && !currentAudio.paused && isPlaying;

    // 2. 새 데크 준비: 8초 전에 이미 다운로드/버퍼링되어 있다면 src를 재할당하지 않고 버퍼 보존 상태로 즉시 play()!
    if (nextAudio.src !== playableUrl) {
      nextAudio.src = playableUrl;
      nextAudio.preload = "auto";
      nextAudio.load();
    }
    nextAudio.currentTime = 0;
    // 🎚️ 크로스페이드 시작 즉시 다음 곡의 사운드가 귀에 바로 꽂히도록 초기 볼륨을 즉각 부여
    nextAudio.volume = isCurrentlyActive ? Math.min(0.25 * targetVol, targetVol) : targetVol;

    nextAudio
      .play()
      .then(() => {
        // 새 곡의 음원 데이터가 로드되어 실제 사운드 출력이 시작된 순간!
        setIsPlaying(true);
        setActiveDeck(nextDeckName);
        activeDeckRef.current = nextDeckName;
        setCurrentTrack(track);
        setPreCuedTrack(null);
        isPreCuedRef.current = false;
        preCuedTrackRef.current = null;
        preMountAttemptCountRef.current = 0;
        lastPreMountAttemptTimeRef.current = 0;
        hasAlertedPreMountFailRef.current = false;
        hasAutoCrossfadedRef.current = false;
        updateRemoteNowPlaying(track, "play");
        startTracking();

        if (isCurrentlyActive) {
          // 🎚️ 전문 DJ Equal-Loudness 크로스페이드 (시작하자마자 2곡이 귀에 바로 겹치며 완벽한 하모니 연출)
          const startTime = performance.now();
          const startOutVol = currentAudio.volume > 0 ? currentAudio.volume : targetVol;
          isCrossfadingRef.current = true;

          const step = (now) => {
            const progress = Math.min((now - startTime) / crossfadeDuration, 1);
            
            // ⚡ 다음 곡: 시작하자마자 0.5초 만에 35% 이상으로 확 치고 올라와 10초 내내 명확히 들림!
            const inVol = targetVol * Math.pow(progress, 0.4);
            // 🌊 기존 곡: 초반에 소리가 급격히 꺼지지 않고 7~8초간 에너지를 유지하며 서서히 페이드아웃
            const outVol = startOutVol * Math.pow(1 - progress, 0.7);

            if (nextAudio) nextAudio.volume = Math.max(0, Math.min(1, inVol));
            if (currentAudio && !currentAudio.paused) {
              currentAudio.volume = Math.max(0, Math.min(1, outVol));
            }

            if (progress < 1) {
              fadeAnimationRef.current = requestAnimationFrame(step);
            } else {
              isCrossfadingRef.current = false;
              fadeAnimationRef.current = null;
              // 페이드아웃 완료 ➜ 이전 데크 정지 및 메모리 즉시 플러시
              if (currentAudio) {
                flushAudioMemory(currentAudio);
              }
              if (nextAudio) nextAudio.volume = targetVol;
            }
          };

          fadeAnimationRef.current = requestAnimationFrame(step);
        } else {
          // 정지 상태에서 시작한 경우 즉시 볼륨 복원
          if (currentAudio) flushAudioMemory(currentAudio);
          nextAudio.volume = targetVol;
        }
      })
      .catch((err) => {
        console.warn("[Dual-Deck Crossfade Error]:", err);
        message.warning("음원 재생 실패: " + err.message);
      });
  };

  // 🎵 트랙 재생 / 일시정지 (0.8초 확실한 페이드아웃 / 0.5초 페이드인 적용)
  const handlePlayTrack = (track) => {
    if (!track || (!track.audio_url && !track.downloadURL && !track.url)) {
      message.error("재생 가능한 음원 URL이 없습니다.");
      return;
    }

    const isSameTrack = isTrackEqual(currentTrack, track);
    const curAudio = activeDeckRef.current === "A" ? deckARef.current : deckBRef.current;
    const otherAudio = activeDeckRef.current === "A" ? deckBRef.current : deckARef.current;

    // 진행 중인 일시정지 애니메이션 취소
    if (pauseFadeAnimationRef.current) {
      cancelAnimationFrame(pauseFadeAnimationRef.current);
      pauseFadeAnimationRef.current = null;
    }

    // 🛑 동일 트랙 토글: 일시정지 (0.8초 페이드아웃) ⇄ 다시재생 (0.5초 페이드인)
    if (isSameTrack && curAudio) {
      if (isPlaying) {
        // 1. UI 및 타이머 정지 (반응성 즉시 체감)
        setIsPlaying(false);
        stopTracking();

        // 2. 🎚️ 0.8초(800ms) 동안 확실하게 귀로 체감되는 부드러운 페이드아웃 진행
        const startVol = curAudio.volume > 0 ? curAudio.volume : masterVolumeRef.current;
        const startTime = performance.now();
        const fadeOutDuration = 800;

        const fadeOutStep = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / fadeOutDuration, 1);
          // 코사인 곡선으로 100% ➜ 0%로 자연스럽게 소리가 사라짐
          curAudio.volume = Math.max(0, startVol * Math.cos((progress * Math.PI) / 2));

          if (progress < 1) {
            pauseFadeAnimationRef.current = requestAnimationFrame(fadeOutStep);
          } else {
            pauseFadeAnimationRef.current = null;
            if (deckARef.current) deckARef.current.pause();
            if (deckBRef.current) deckBRef.current.pause();
            curAudio.volume = masterVolumeRef.current;
            updateRemoteNowPlaying(track, "pause");
          }
        };

        pauseFadeAnimationRef.current = requestAnimationFrame(fadeOutStep);
      } else {
        // 반대편 데크 완전 정지 및 플러시 (단독 재생 보장)
        if (otherAudio) flushAudioMemory(otherAudio);

        // 🎚️ 0.5초(500ms) 부드러운 페이드인 재생
        curAudio.volume = 0;
        curAudio
          .play()
          .then(() => {
            setIsPlaying(true);
            startTracking();
            updateRemoteNowPlaying(track, "play");

            const targetVol = masterVolumeRef.current;
            const startTime = performance.now();
            const fadeInDuration = 500;

            const fadeInStep = (now) => {
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / fadeInDuration, 1);
              curAudio.volume = Math.max(0, Math.min(1, targetVol * Math.sin((progress * Math.PI) / 2)));

              if (progress < 1) {
                pauseFadeAnimationRef.current = requestAnimationFrame(fadeInStep);
              } else {
                pauseFadeAnimationRef.current = null;
                curAudio.volume = targetVol;
              }
            };

            pauseFadeAnimationRef.current = requestAnimationFrame(fadeInStep);
          })
          .catch((err) => {
            message.error("음원 재생 실패: " + err.message);
          });
      }
      return;
    }

    // 🚀 다른 트랙 선택 시 새로운 트랙으로 지능형 크로스페이드 전환
    crossfadeToTrack(track);
  };

  const handleSliderChange = (value) => {
    const curAudio = activeDeckRef.current === "A" ? deckARef.current : deckBRef.current;
    if (curAudio) {
      curAudio.currentTime = value;
      setCurrentTime(value);
    }
  };

  const handleVolumeChange = (value) => {
    setVolume(value);
    masterVolumeRef.current = value;
    const curAudio = activeDeckRef.current === "A" ? deckARef.current : deckBRef.current;
    if (curAudio && !isCrossfadingRef.current) {
      curAudio.volume = value;
    }
  };

  // 🎵 VibeFlows 음원 + 커스텀 업로드 음원 통합 목록
  const allTracks = useMemo(() => {
    return [...tracks, ...customTracks];
  }, [tracks, customTracks]);

  // 🏷️ 1단계: 종목 카테고리 탭 목록 (VibeFlows 경기 종목 + 하드코딩된 특별 연출 커스텀 탭 3개)
  const categoryTabs = useMemo(() => {
    const vibeCounts = {};
    tracks.forEach((t) => {
      const cat = t.contest_category_kr || "기타";
      vibeCounts[cat] = (vibeCounts[cat] || 0) + 1;
    });

    const vibeList = Object.keys(vibeCounts).map((name) => ({
      name,
      count: vibeCounts[name],
      isCustom: false,
    }));

    const customList = CUSTOM_CATEGORIES.map((cat) => {
      const count = customTracks.filter(
        (t) => (t.contest_category_kr || "").trim() === cat.name
      ).length;
      return {
        name: cat.name,
        key: cat.key,
        icon: cat.icon,
        desc: cat.desc,
        tagColor: cat.tagColor,
        count: count,
        isCustom: true,
      };
    });

    return [
      { name: "ALL", count: tracks.length + customTracks.length, isCustom: false },
      ...vibeList,
      ...customList,
    ];
  }, [tracks, customTracks]);

  // 🎯 현재 무대 종목과 매칭되는 VibeFlow 탭 찾기 ('비키니 피트니스' ⇄ '여자 비키니')
  const matchedVibeCategory = useMemo(() => {
    if (!currentStageCategory) return null;
    const found = categoryTabs.find(
      (cat) => cat.name !== "ALL" && !cat.isCustom && isCategoryMatched(cat.name, currentStageCategory, currentStageGender)
    );
    return found ? found.name : null;
  }, [categoryTabs, currentStageCategory, currentStageGender]);

  // 📦 선택된 대분류 종목에 속한 기본 트랙 목록 (탭 선택 시 100% 정확한 종목 필터링)
  const categoryBaseTracks = useMemo(() => {
    if (selectedCategoryTab === "ALL") return allTracks;
    if (selectedCategoryTab === "CURRENT_STAGE") {
      return allTracks.filter((t) => isCategoryMatched(t.contest_category_kr, currentStageCategory, currentStageGender));
    }
    // 탭을 직접 클릭한 경우 해당 탭의 종목명과 100% 정확히 일치하는 음원만 추출 (타 종목 누출 방지)
    const targetCat = selectedCategoryTab.trim();
    return allTracks.filter((t) => (t.contest_category_kr || "").trim() === targetCat);
  }, [allTracks, selectedCategoryTab, currentStageCategory, currentStageGender]);

  // 🏷️ 2단계: 선택된 종목의 세부 부문/체급(Division) 목록 및 곡 수 집계
  const availableDivisions = useMemo(() => {
    const counts = {};
    categoryBaseTracks.forEach((t) => {
      const div = (t.contest_division_kr || "공통 / 전체").trim();
      counts[div] = (counts[div] || 0) + 1;
    });

    const isAdultPriority = isAdultPriorityCategory(currentStageCategory, currentStageGender);
    const targetGrade = isAdultPriority ? "성인부" : currentStageGrade;

    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      isCurrentMatch: Boolean(targetGrade && isDivisionMatched(name, targetGrade)),
    }));
  }, [categoryBaseTracks, currentStageCategory, currentStageGrade, currentStageGender]);

  // 🔍 최종 필터링된 트랙 목록 (Category + Division + Search Query)
  const filteredTracks = useMemo(() => {
    return categoryBaseTracks.filter((t) => {
      // 체급/부문 필터링 (정확한 일치)
      let matchDivision = true;
      if (selectedDivision !== "ALL") {
        const div = (t.contest_division_kr || "공통 / 전체").trim();
        matchDivision = div === selectedDivision;
      }

      // 검색어 필터링
      const q = searchText.trim().toLowerCase();
      const matchSearch =
        !q ||
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.artist && t.artist.toLowerCase().includes(q)) ||
        (t.contest_category_kr && t.contest_category_kr.toLowerCase().includes(q)) ||
        (t.contest_division_kr && t.contest_division_kr.toLowerCase().includes(q));

      return matchDivision && matchSearch;
    });
  }, [categoryBaseTracks, selectedDivision, searchText]);

  // 🎯 현재 무대 종목 & 체급 원클릭 자동 매칭 핸들러
  const handleFilterCurrentStage = () => {
    let targetCategory = "ALL";
    if (matchedVibeCategory) {
      targetCategory = matchedVibeCategory;
      setSelectedCategoryTab(matchedVibeCategory);
    } else {
      targetCategory = "CURRENT_STAGE";
      setSelectedCategoryTab("CURRENT_STAGE");
    }

    const isAdultPriority = isAdultPriorityCategory(currentStageCategory, currentStageGender);
    const effectiveGrade = isAdultPriority ? "성인부" : currentStageGrade;

    // 체급/부문까지 자동 매칭 시도
    let targetDivision = "ALL";
    if (effectiveGrade) {
      const matchedDiv = availableDivisions.find((d) => isDivisionMatched(d.name, effectiveGrade));
      if (matchedDiv) {
        targetDivision = matchedDiv.name;
        setSelectedDivision(matchedDiv.name);
      } else {
        setSelectedDivision("ALL");
      }
    } else {
      setSelectedDivision("ALL");
    }

    const genderText = extractGender(currentStageCategory, currentStageGender) === "FEMALE" ? "♀️ 여성" : extractGender(currentStageCategory, currentStageGender) === "MALE" ? "♂️ 남성" : "";

    message.success({
      content: `🎯 [${currentStageCategory || "현재 무대"} ${genderText ? `(${genderText})` : ""} ${currentStageGrade ? `• ${currentStageGrade}` : ""}] ➜ VibeFlows [${targetCategory}${targetDivision !== "ALL" ? ` • ${targetDivision}` : ""}] 음원 자동 매칭 완료!`,
      duration: 3,
    });
  };

  // 🌱 [시드 1] 1순위 최우선 매칭 풀: 현재 무대의 종목(Category) + 성별(Gender) + 체급/부문(Division) 완전 일치 음원
  const seed1Pool = useMemo(() => {
    if (!currentStageCategory || tracks.length === 0) return [];

    const isAdultPriority = isAdultPriorityCategory(currentStageCategory, currentStageGender);

    return tracks.filter((t) => {
      const matchCat = isCategoryMatched(t.contest_category_kr, currentStageCategory, currentStageGender);
      if (!matchCat) return false;

      // 🎯 보디빌딩 계열 및 피지크 계열은 '성인부' 위주로 1순위 시드1 매칭!
      if (isAdultPriority) {
        return isDivisionMatched(t.contest_division_kr, "성인부");
      }

      if (currentStageGrade) {
        return isDivisionMatched(t.contest_division_kr, currentStageGrade);
      }
      return true;
    });
  }, [tracks, currentStageCategory, currentStageGrade, currentStageGender]);

  // 🌿 [시드 2] 2순위 확장 매칭 풀: 동일 성별 & 동일 종목(Category)의 타 체급 및 공통 음원 풀
  const seed2Pool = useMemo(() => {
    if (!currentStageCategory || tracks.length === 0) return [];
    const seed1Ids = new Set(seed1Pool.map((t) => getTrackKey(t)).filter(Boolean));
    return tracks.filter((t) => {
      const matchCat = isCategoryMatched(t.contest_category_kr, currentStageCategory, currentStageGender);
      if (!matchCat) return false;
      const key = getTrackKey(t);
      return key ? !seed1Ids.has(key) : true;
    });
  }, [tracks, currentStageCategory, currentStageGender, seed1Pool]);

  // 🎲 스마트 시드 다음 곡 추출 (자체 음원 동일 폴더 우선 ➜ 시드 1 ➜ 시드 2 ➜ 활성 탭 ➜ 전체 음원 순차 소진 알고리즘)
  const isCustomTrack = (t) => {
    if (!t) return false;
    if (t.is_custom || t.isCustom) return true;
    const cat = (t.contest_category_kr || "").trim();
    return CUSTOM_CATEGORIES.some((c) => c.name === cat);
  };

  const getNextSeedTrack = (currentPlayed = playedTrackIds) => {
    // 📁 [1] 자체 음원(커스텀 BGM) 처리: 맥락(분위기) 유지를 위해 오직 "동일한 폴더(카테고리)" 안에서만 다음 곡 추출!
    const isPlayingCustom = isCustomTrack(currentTrack);
    const isViewingCustomTab = CUSTOM_CATEGORIES.some((c) => c.name === selectedCategoryTab);

    if (isPlayingCustom || isViewingCustomTab) {
      const targetFolder = (
        currentTrack?.contest_category_kr ||
        selectedCategoryTab ||
        "대기할때 음악"
      ).trim();

      const folderTracks = customTracks.filter(
        (t) => (t.contest_category_kr || "").trim() === targetFolder
      );

      if (folderTracks.length > 0) {
        // ① 해당 폴더 안에서 아직 안 튼 곡 무작위 추출
        const unplayed = folderTracks.filter(
          (t) => !currentPlayed.includes(getTrackKey(t))
        );

        if (unplayed.length > 0) {
          const randomIndex = Math.floor(Math.random() * unplayed.length);
          return {
            track: unplayed[randomIndex],
            seedLevel: "CUSTOM",
            folder: targetFolder,
            isCustom: true,
          };
        }

        // ② 해당 폴더의 모든 곡을 소진한 경우 ➜ 현재 재생 곡 제외하고 재순환
        const otherTracks = folderTracks.filter(
          (t) => getTrackKey(t) !== getTrackKey(currentTrack)
        );
        const pool = otherTracks.length > 0 ? otherTracks : folderTracks;
        const randomIndex = Math.floor(Math.random() * pool.length);
        return {
          track: pool[randomIndex],
          seedLevel: "CUSTOM",
          folder: targetFolder,
          isCustom: true,
          isReset: true,
        };
      }
    }

    // 🏟️ [2] VibeFlows 공식 경기 음원 처리 (시드 1 ➜ 시드 2 ➜ 활성 탭)
    // 1. 시드 1에서 미재생 곡 무작위 추출
    if (seed1Pool.length > 0) {
      const unplayedSeed1 = seed1Pool.filter(
        (t) => !currentPlayed.includes(getTrackKey(t))
      );
      if (unplayedSeed1.length > 0) {
        const randomIndex = Math.floor(Math.random() * unplayedSeed1.length);
        return { track: unplayedSeed1[randomIndex], seedLevel: 1, isExhausted: false };
      }
    }

    // 2. 시드 1 소진 시 ➜ 시드 2에서 미재생 곡 무작위 추출
    if (seed2Pool.length > 0) {
      const unplayedSeed2 = seed2Pool.filter(
        (t) => !currentPlayed.includes(getTrackKey(t))
      );
      if (unplayedSeed2.length > 0) {
        const randomIndex = Math.floor(Math.random() * unplayedSeed2.length);
        return { track: unplayedSeed2[randomIndex], seedLevel: 2, isExhausted: false };
      }
    }

    // 3. 시드 1과 시드 2 모두 소진된 경우 ➜ 시드 1부터 재생 기록 리셋 후 재순환
    if (seed1Pool.length > 0) {
      const randomIndex = Math.floor(Math.random() * seed1Pool.length);
      return { track: seed1Pool[randomIndex], seedLevel: 1, isReset: true };
    } else if (seed2Pool.length > 0) {
      const randomIndex = Math.floor(Math.random() * seed2Pool.length);
      return { track: seed2Pool[randomIndex], seedLevel: 2, isReset: true };
    }

    // 4. 현재 활성화된 탭 목록(또는 커스텀 탭)에서 미재생 곡 무작위 추출
    const activeTabList = filteredTracks.length > 0 ? filteredTracks : tracks;
    if (activeTabList.length > 0) {
      const unplayed = activeTabList.filter((t) => !currentPlayed.includes(getTrackKey(t)));
      if (unplayed.length > 0) {
        const randomIndex = Math.floor(Math.random() * unplayed.length);
        return { track: activeTabList[randomIndex], seedLevel: 3, isFallback: true };
      }
      const randomIndex = Math.floor(Math.random() * activeTabList.length);
      return { track: activeTabList[randomIndex], seedLevel: 3, isReset: true };
    }

    return { track: null, seedLevel: null };
  };

  // 🎵 다음 시드 음원 재생 트리거 (무대/종목 변경 또는 2.0초 전 듀얼 데크 오버랩)
  const playNextSeedTrack = (isStageTransition = false, silent = false, duration = 800) => {
    // 🎧 8초 전에 프리로드(Pre-cued)된 음원이 있다면 즉시 사용
    let nextTrackInfo = null;
    if (!isStageTransition && preCuedTrackRef.current && preCuedTrackRef.current.track) {
      nextTrackInfo = preCuedTrackRef.current;
      preCuedTrackRef.current = null;
    } else {
      nextTrackInfo = getNextSeedTrack(isStageTransition ? [] : playedTrackIds);
    }

    const { track, seedLevel, isReset } = nextTrackInfo || {};

    if (!track) {
      if (!silent) message.warning("재생 가능한 음원 풀이 비어 있습니다.");
      return;
    }

    const trackKey = getTrackKey(track);
    const nextPlayed = isStageTransition || isReset
      ? (trackKey ? [trackKey] : [])
      : (trackKey ? [...playedTrackIds, trackKey] : playedTrackIds);

    setPlayedTrackIds(nextPlayed);
    setActiveSeedLevel(seedLevel);

    // 🎛️ 지정된 시간(곡 종료 시점엔 정확히 2.0초간 겹쳐서 오버랩) 무중단 크로스페이드 실행!
    crossfadeToTrack(track, duration);

    const seedLabel =
      seedLevel === "CUSTOM"
        ? `📂 [자체 음원 • ${nextTrackInfo?.folder || track.contest_category_kr || "폴더"}]`
        : seedLevel === 1
        ? "🌱 [시드 1: 정밀 매칭]"
        : seedLevel === 2
        ? "🌿 [시드 2: 확장 매칭]"
        : "🍃 [전체 풀]";

    if (!silent) {
      message.info({
        content: `⚡ ${seedLabel} '${track.title || track.name}' 재생 시작! (${track.contest_category_kr || ""} ${track.contest_division_kr ? `• ${track.contest_division_kr}` : ""})`,
        duration: 3,
      });
    }
  };

  getNextSeedTrackRef.current = getNextSeedTrack;
  playNextSeedTrackRef.current = playNextSeedTrack;

  // 🔄 [무대/종목 변경 감지 시] 스마트 오토파일럿 단일 트리거 엔진
  const lastTriggeredStageKeyRef = useRef("");

  useEffect(() => {
    if (!currentStageCategory || tracks.length === 0) return;

    const stageNumber = realtimeStage?.stageNumber || realtimeStage?.contestStageNumber || 0;
    const stageKey = `${realtimeStage?.categoryId || ""}_${realtimeStage?.gradeId || ""}_${stageNumber}_${currentStageCategory}_${currentStageGrade}`;

    // 1. 화면 탭을 현재 무대와 매칭되는 VibeFlow 종목 탭으로 자동 전환!
    const targetCat = matchedVibeCategory || "CURRENT_STAGE";
    setSelectedCategoryTab(targetCat);
    setSelectedDivision("ALL");

    // 동일 무대 상태면 중복 재생 방지 (단 한 번만 재생)
    if (stageKey === lastTriggeredStageKeyRef.current) return;
    lastTriggeredStageKeyRef.current = stageKey;

    // 2. 무대/종목 변경 시 이전 무대 재생 기록 및 사전 장착 상태 리셋
    setPlayedTrackIds([]);
    isPreCuedRef.current = false;
    preCuedTrackRef.current = null;
    preMountAttemptCountRef.current = 0;
    lastPreMountAttemptTimeRef.current = 0;
    hasAlertedPreMountFailRef.current = false;
    setPreCuedTrack(null);

    // 3. ⚡ 스마트 오토파일럿이 켜져있을 때 종목/무대가 바뀌면 즉각(50ms) 1회만 정확히 음원 자동 재생!
    if (isAutoPlayOnStageChange) {
      const timer = setTimeout(() => {
        playNextSeedTrack(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [
    currentStageCategory,
    currentStageGrade,
    currentStageGender,
    realtimeStage?.stageNumber,
    realtimeStage?.contestStageNumber,
    realtimeStage?.categoryId,
    realtimeStage?.gradeId,
    tracks.length,
    matchedVibeCategory,
    isAutoPlayOnStageChange,
  ]);

  // 🔁 [곡 종료 시 다음 시드곡/자체음원 자동 연속 크로스페이드 재생 (Deck A & Deck B)]
  useEffect(() => {
    const a = deckARef.current;
    const b = deckBRef.current;

    const handleEnded = (e) => {
      const audio = e?.target;
      // 실제로 곡이 끝까지 정상 재생(재생 위치가 끝에 도달)되었을 때만 다음 곡 트리거 (메모리 플러시나 빈 소스로 인한 오작동 원천 차단)
      if (audio && audio.duration > 3 && audio.currentTime >= audio.duration - 1.5) {
        if (!isCrossfadingRef.current && (isAutoPlayOnStageChange || isCustomTrack(currentTrack))) {
          playNextSeedTrack(false);
        }
      }
    };

    if (a) a.addEventListener("ended", handleEnded);
    if (b) b.addEventListener("ended", handleEnded);

    return () => {
      if (a) a.removeEventListener("ended", handleEnded);
      if (b) b.removeEventListener("ended", handleEnded);
    };
  }, [isAutoPlayOnStageChange, playedTrackIds, seed1Pool, seed2Pool, tracks, customTracks, currentTrack]);

  const formatSeconds = (sec) => {
    if (!sec || isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // 📋 깔끔한 화이트 테마 테이블 컬럼
  const columns = [
    {
      title: "No",
      key: "index",
      width: 60,
      align: "center",
      render: (_, __, idx) => <span className="font-mono text-slate-500 font-semibold">{idx + 1}</span>,
    },
    {
      title: "커버",
      dataIndex: "cover_url",
      key: "cover",
      width: 70,
      align: "center",
      render: (cover) => (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto shadow-sm">
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <CustomerServiceOutlined className="text-lg text-indigo-500" />
          )}
        </div>
      ),
    },
    {
      title: "곡명 / 아티스트",
      key: "title",
      render: (_, record) => {
        const isThisTrackActive = isTrackEqual(currentTrack, record);
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={`font-bold text-sm ${isThisTrackActive ? "text-indigo-600 font-black" : "text-slate-800"}`}>
                {record.title || "제목 없음"}
              </span>
              {isThisTrackActive && isPlaying && (
                <Tag color="processing" className="text-[10px] font-bold">
                  재생중
                </Tag>
              )}
            </div>
            <div className="text-xs text-slate-500">
              {record.artist || "Unknown Artist"}
            </div>
          </div>
        );
      },
    },
    {
      title: "대회 종목 (Category)",
      dataIndex: "contest_category_kr",
      key: "category",
      width: 170,
      render: (cat, record) => {
        if (!cat) return <span className="text-slate-400 text-xs">-</span>;
        if (record.is_custom) {
          const customObj = CUSTOM_CATEGORIES.find((c) => c.name === cat);
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{customObj?.icon || "🎵"}</span>
              <Tag color={customObj?.tagColor || "geekblue"} className="font-bold rounded-md text-[10px] m-0 px-1.5 py-0">
                자체음원
              </Tag>
              <span className="font-bold text-xs text-slate-800">{cat}</span>
            </div>
          );
        }
        const g = extractGender(cat);
        return (
          <div className="flex items-center gap-1.5">
            {g === "FEMALE" ? (
              <Tag color="magenta" className="font-bold rounded-md text-[10px] m-0 px-1.5 py-0">♀️ 여성</Tag>
            ) : g === "MALE" ? (
              <Tag color="blue" className="font-bold rounded-md text-[10px] m-0 px-1.5 py-0">♂️ 남성</Tag>
            ) : null}
            <span className="font-bold text-xs text-slate-800">{cat}</span>
          </div>
        );
      },
    },
    {
      title: "부문 / 체급 (Division)",
      dataIndex: "contest_division_kr",
      key: "division",
      width: 150,
      render: (div) => (
        div && div !== "공통 / 전체" ? (
          <Tooltip title={`클릭 시 '${div}' 체급 음원만 필터링`}>
            <Tag
              color="purple"
              className="font-bold rounded-md cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setSelectedDivision(div)}
            >
              {div}
            </Tag>
          </Tooltip>
        ) : (
          <span className="text-slate-400 text-xs font-mono">공통 / 전체</span>
        )
      ),
    },
    {
      title: "재생시간",
      dataIndex: "duration",
      key: "duration",
      width: 90,
      align: "center",
      render: (dur) => <span className="font-mono text-xs text-slate-600 font-medium">{formatSeconds(dur)}</span>,
    },
    {
      title: "재생 제어",
      key: "action",
      width: 130,
      align: "center",
      render: (_, record) => {
        const isThisTrackActive = isTrackEqual(currentTrack, record);
        const activePlaying = isThisTrackActive && isPlaying;

        return (
          <Space size="small">
            <Button
              type={activePlaying ? "default" : "primary"}
              size="middle"
              icon={activePlaying ? <PauseCircleFilled className="text-amber-500" /> : <PlayCircleFilled />}
              onClick={() => handlePlayTrack(record)}
              className={
                activePlaying
                  ? "font-bold rounded-lg border-amber-400 text-amber-600 bg-amber-50 shadow-xs"
                  : "bg-indigo-600 hover:bg-indigo-500 font-bold rounded-lg shadow-xs"
              }
            >
              {activePlaying ? "정지" : "재생"}
            </Button>
            {record.is_custom && (
              <Tooltip title="자체 음원 삭제">
                <Button
                  danger
                  type="text"
                  size="middle"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteCustomMusic(record)}
                  className="rounded-lg hover:bg-red-50"
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800 space-y-6">
      
      {/* ─────────────────────────────────────────────── */}
      {/* 🔝 상단 타이틀 & 컨트롤 헤더 바 */}
      {/* ─────────────────────────────────────────────── */}
      <Card className="shadow-sm rounded-2xl border-slate-200 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-2xl shadow-xs">
              <CustomerServiceOutlined />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Title level={4} style={{ margin: 0, fontWeight: 800, color: "#1e293b" }}>
                  VibeFlows 공식 대회 음향 센터
                </Title>
                <Tag color="indigo" className="font-bold">
                  Official API
                </Tag>
              </div>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                {currentStageCategory ? (
                  <span className="text-indigo-600 font-bold">
                    🏆 현재 무대 진행 종목: [{currentStageCategory}]
                  </span>
                ) : (
                  "VibeFlows 클라우드 음원 실시간 스트리밍 및 무대 전광판 동기화"
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* 원격 무대 동기화 스위치 */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <CloudSyncOutlined className={isRemoteSync ? "text-emerald-500 text-base" : "text-slate-400 text-base"} />
              <span className="text-xs font-bold text-slate-700">무대 전광판 원격 동기화</span>
              <Switch
                checked={isRemoteSync}
                onChange={setIsRemoteSync}
                size="small"
              />
            </div>

            {/* API Raw Inspector 버튼 */}
            {rawApiResponse && (
              <Button
                icon={<CodeOutlined />}
                onClick={() => setIsRawModalOpen(true)}
                className="rounded-xl font-semibold text-xs border-slate-300"
              >
                API 응답 검사
              </Button>
            )}

            {/* 음원 리스트 새로고침 */}
            <Button
              icon={<ReloadOutlined spin={isLoadingTracks} />}
              loading={isLoadingTracks}
              onClick={() => loadVibeFlowTracks()}
              className="rounded-xl font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              음원 새로고침
            </Button>

            {/* 계정 로그인 / 로그아웃 */}
            {token ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-medium flex items-center justify-end gap-1">
                    <span>연결 계정</span>
                    <Tooltip title="보안을 위해 로그인 세션은 24시간 동안 유효하며, 24시간 후 자동 로그아웃됩니다.">
                      <Tag color="cyan" className="m-0 text-[9px] px-1 py-0 rounded font-bold cursor-help">
                        24시간 유효
                      </Tag>
                    </Tooltip>
                  </div>
                  <div className="text-xs font-bold text-indigo-600 truncate max-w-[150px]">
                    {user?.email || "VibeFlows Account"}
                  </div>
                </div>
                <Button
                  danger
                  size="small"
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                  className="rounded-lg text-xs font-semibold"
                >
                  로그아웃
                </Button>
              </div>
            ) : (
              <Button
                type="primary"
                icon={<LoginOutlined />}
                onClick={() => setIsLoginModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold"
              >
                VibeFlows 로그인
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ─────────────────────────────────────────────── */}
      {/* 🎛️ 메인 본문 (좌측: 마스터 플레이어 / 우측: 음원 리스트) */}
      {/* ─────────────────────────────────────────────── */}
      <Row gutter={[20, 20]}>
        
        {/* 좌측: 마스터 오디오 플레이어 */}
        <Col xs={24} lg={8} xl={7}>
          <div className="space-y-4">
            <Card className="shadow-sm rounded-2xl border-slate-200 bg-white text-center">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <SoundFilled className="text-indigo-600" />
                  <span>MASTER AUDIO CONTROLLER</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <Tag color={activeDeck === "A" ? "blue" : "purple"} className="font-bold text-[11px] m-0">
                    🎛️ Deck {activeDeck} 활성
                  </Tag>
                  {isPlaying ? (
                    <Tag color="processing" className="font-bold text-xs m-0">
                      재생중
                    </Tag>
                  ) : (
                    <Tag className="font-bold text-xs m-0 bg-slate-100 text-slate-500 border-none">
                      대기중
                    </Tag>
                  )}
                </div>
              </div>

              {/* 앨범 커버 */}
              <div className="relative w-36 h-36 mx-auto rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center mb-4">
                {currentTrack?.cover_url ? (
                  <img
                    src={currentTrack.cover_url}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <CustomerServiceOutlined className="text-5xl text-slate-300" />
                )}

                {isPlaying && (
                  <div className="absolute inset-0 bg-indigo-950/20 backdrop-blur-2xs flex items-center justify-center">
                    <SoundFilled className="text-3xl text-indigo-600 animate-bounce" />
                  </div>
                )}
              </div>

              {/* 음원 상세 정보 */}
              <div className="space-y-1 mb-4">
                <h3 className="text-base font-bold text-slate-900 m-0 truncate">
                  {currentTrack?.title || "선택된 음원 없음"}
                </h3>
                <p className="text-xs text-slate-500 font-medium m-0 truncate">
                  {currentTrack?.artist || "우측 목록에서 음원을 선택해주세요"}
                </p>

                {(currentTrack?.contest_category_kr || currentTrack?.contest_division_kr) && (
                  <div className="flex items-center justify-center gap-1.5 pt-1 flex-wrap">
                    {currentTrack?.contest_category_kr && (
                      <Tag color="blue" className="font-bold text-[11px] m-0">
                        {currentTrack.contest_category_kr}
                      </Tag>
                    )}
                    {currentTrack?.contest_division_kr && (
                      <Tag color="purple" className="font-bold text-[11px] m-0">
                        {currentTrack.contest_division_kr}
                      </Tag>
                    )}
                  </div>
                )}
              </div>

              {/* 프로그레스 슬라이더 */}
              <div className="space-y-1 mb-4">
                <Slider
                  min={0}
                  max={trackDuration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSliderChange}
                  tooltip={{ formatter: (v) => formatSeconds(v) }}
                  className="m-0"
                />

                <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-400">
                  <span>{formatSeconds(currentTime)}</span>
                  <span>{formatSeconds(trackDuration)}</span>
                </div>
              </div>

              {/* 마스터 플레이/정지 버튼 */}
              <Button
                type="primary"
                size="large"
                disabled={!currentTrack}
                icon={isPlaying ? <PauseCircleFilled /> : <PlayCircleFilled />}
                onClick={() => currentTrack && handlePlayTrack(currentTrack)}
                className={`w-full h-11 rounded-xl font-bold text-sm ${
                  isPlaying
                    ? "bg-amber-500 hover:bg-amber-400 border-none"
                    : "bg-indigo-600 hover:bg-indigo-500 border-none"
                }`}
              >
                {isPlaying ? "일시정지 (PAUSE)" : "재생 (PLAY)"}
              </Button>
            </Card>

            {/* 🎚️ 듀얼 데크 크로스페이더 인디케이터 */}
            <Card className="shadow-sm rounded-2xl border-slate-200 bg-white">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                <span className="flex items-center gap-1.5">
                  <CustomerServiceOutlined className="text-indigo-600" />
                  <span>듀얼 데크 크로스페이더 (A⇄B)</span>
                </span>
                <Tag color="cyan" className="font-bold text-[10px] m-0">
                  2.0s 오버랩 페이드
                </Tag>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
                {/* Audio Deck A */}
                <div
                  className={`p-2 rounded-xl border transition-all ${
                    activeDeck === "A"
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-bold shadow-xs"
                      : preCuedTrack
                      ? "bg-amber-50/80 border-amber-300 text-amber-800 font-medium"
                      : "bg-slate-50 border-slate-200 text-slate-400"
                  }`}
                >
                  <div className="text-[10px] uppercase font-mono">Audio Deck A</div>
                  <div className="text-xs mt-0.5">
                    {activeDeck === "A" ? (
                      isPlaying ? "🔊 재생중" : "⏸️ 일시정지"
                    ) : preCuedTrack ? (
                      <span className="text-[10px] text-amber-700 font-bold animate-pulse block truncate">
                        ⏳ 다음 곡 준비완료: {preCuedTrack.title || preCuedTrack.name}
                      </span>
                    ) : (
                      "대기 (유휴)"
                    )}
                  </div>
                </div>

                {/* Audio Deck B */}
                <div
                  className={`p-2 rounded-xl border transition-all ${
                    activeDeck === "B"
                      ? "bg-purple-50 border-purple-300 text-purple-700 font-bold shadow-xs"
                      : preCuedTrack
                      ? "bg-amber-50/80 border-amber-300 text-amber-800 font-medium"
                      : "bg-slate-50 border-slate-200 text-slate-400"
                  }`}
                >
                  <div className="text-[10px] uppercase font-mono">Audio Deck B</div>
                  <div className="text-xs mt-0.5">
                    {activeDeck === "B" ? (
                      isPlaying ? "🔊 재생중" : "⏸️ 일시정지"
                    ) : preCuedTrack ? (
                      <span className="text-[10px] text-amber-700 font-bold animate-pulse block truncate">
                        ⏳ 다음 곡 준비완료: {preCuedTrack.title || preCuedTrack.name}
                      </span>
                    ) : (
                      "대기 (유휴)"
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* 마스터 볼륨 슬라이더 */}
            <Card className="shadow-sm rounded-2xl border-slate-200 bg-white">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                <span className="flex items-center gap-1.5">
                  <SoundFilled className="text-indigo-600" />
                  <span>마스터 볼륨</span>
                </span>
                <span className="font-mono text-indigo-600">{Math.round(volume * 100)}%</span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolumeChange}
                className="m-0"
              />
            </Card>

            {/* ⚡ 무대 스마트 오토파일럿 (시드 1 ➜ 시드 2 자동 셔플 재생) 카드 */}
            <Card className="shadow-sm rounded-2xl border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                  <div className="flex items-center gap-1.5">
                    <ThunderboltFilled className="text-amber-500 text-base animate-pulse" />
                    <span className="font-bold text-xs text-slate-800">
                      스마트 오토파일럿
                    </span>
                  </div>
                  <Switch
                    checked={isAutoPlayOnStageChange}
                    onChange={setIsAutoPlayOnStageChange}
                    checkedChildren="자동"
                    unCheckedChildren="수동"
                    size="small"
                  />
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>🏆 타겟 무대</span>
                    <span className="font-bold text-indigo-600 truncate max-w-[170px]">
                      {currentStageCategory ? (
                        <>
                          {extractGender(currentStageCategory, currentStageGender) === "FEMALE" ? "♀️ " : extractGender(currentStageCategory, currentStageGender) === "MALE" ? "♂️ " : ""}
                          {currentStageCategory} {currentStageGrade ? `• ${currentStageGrade}` : ""}
                        </>
                      ) : (
                        "무대 대기중"
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>🌱 시드 1 (정밀 매칭)</span>
                    <span className="font-bold text-emerald-600 font-mono">
                      {seed1Pool.length}곡
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>🌿 시드 2 (확장 매칭)</span>
                    <span className="font-bold text-purple-600 font-mono">
                      {seed2Pool.length}곡
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>🎲 현재 재생 상태</span>
                    {activeSeedLevel === 1 ? (
                      <Tag color="green" className="m-0 font-bold text-[10px]">
                        🌱 시드 1 재생중
                      </Tag>
                    ) : activeSeedLevel === 2 ? (
                      <Tag color="orange" className="m-0 font-bold text-[10px]">
                        🌿 시드 2 확장재생
                      </Tag>
                    ) : activeSeedLevel === 3 ? (
                      <Tag color="blue" className="m-0 font-bold text-[10px]">
                        🍃 일반 풀 재생
                      </Tag>
                    ) : (
                      <Tag className="m-0 text-[10px] text-slate-400">대기</Tag>
                    )}
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-1.5">
                  <Button
                    type="primary"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => playNextSeedTrack(false)}
                    className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs h-8"
                  >
                    다음 시드곡 셔플 재생
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setPlayedTrackIds([]);
                      message.info("시드 재생 기록이 초기화되었습니다.");
                    }}
                    className="rounded-xl text-xs h-8 border-slate-300"
                  >
                    기록 리셋
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </Col>

        {/* 우측: VibeFlows 음원 데이터 테이블 */}
        <Col xs={24} lg={16} xl={17}>
          <Card className="shadow-sm rounded-2xl border-slate-200 bg-white space-y-4">
            
            {/* 검색 및 필터 헤더 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Input
                  placeholder="곡명, 아티스트, 체급/부문 검색..."
                  prefix={<SearchOutlined className="text-slate-400" />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                  className="w-full sm:w-72 rounded-xl"
                />
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  총 <strong className="text-indigo-600">{tracks.length}곡</strong> 중{" "}
                  <strong className="text-slate-800">{filteredTracks.length}곡</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                {currentStageCategory && (
                  <Button
                    size="small"
                    type={selectedCategoryTab === matchedVibeCategory || selectedCategoryTab === "CURRENT_STAGE" ? "primary" : "default"}
                    onClick={handleFilterCurrentStage}
                    className={`rounded-lg text-xs font-bold ${
                      selectedCategoryTab === matchedVibeCategory || selectedCategoryTab === "CURRENT_STAGE"
                        ? "bg-indigo-600 font-black"
                        : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    }`}
                  >
                    🎯 현재 무대 [{currentStageCategory}{currentStageGrade ? ` • ${currentStageGrade}` : ""}] 자동 매칭
                  </Button>
                )}
                {(selectedCategoryTab !== "ALL" || selectedDivision !== "ALL" || searchText) && (
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedCategoryTab("ALL");
                      setSelectedDivision("ALL");
                      setSearchText("");
                    }}
                    className="rounded-lg text-xs text-slate-500 hover:text-slate-700 border-slate-200"
                  >
                    필터 초기화
                  </Button>
                )}
              </div>
            </div>

            {/* 🏷️ 1단계: 종목 카테고리 선택 바 (말줄임 ... 없이 100% 노출되는 2단 랩핑 구조) */}
            <div className="space-y-3 pb-2 border-b border-slate-100">
              {/* 🏆 VibeFlows 공식 경기 종목 영역 */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <TrophyOutlined className="text-indigo-600" />
                    <span>1단계: 대회 공식 경기 종목 (VibeFlows)</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    총 {tracks.length}곡 등록됨
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {categoryTabs
                    .filter((cat) => !cat.isCustom)
                    .map((cat) => {
                      const isSelected = selectedCategoryTab === cat.name;
                      const isCurrentMatch =
                        cat.name !== "ALL" &&
                        isCategoryMatched(cat.name, currentStageCategory, currentStageGender);
                      const catGender = extractGender(cat.name);
                      const genderIcon = catGender === "FEMALE" ? "♀️ " : catGender === "MALE" ? "♂️ " : "";

                      return (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => {
                            setSelectedCategoryTab(cat.name);
                            setSelectedDivision("ALL");
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300"
                              : isCurrentMatch
                              ? "bg-magenta-50 text-magenta-700 border border-magenta-200 hover:bg-magenta-100"
                              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                          }`}
                        >
                          <span>{cat.name === "ALL" ? "전체 종목" : `${genderIcon}${cat.name}`}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : isCurrentMatch
                                ? "bg-magenta-200/60 text-magenta-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {cat.count}
                          </span>
                          {isCurrentMatch && (
                            <span
                              className={`text-[9px] px-1 rounded font-black ${
                                isSelected ? "bg-white/30 text-white" : "bg-magenta-600 text-white"
                              }`}
                            >
                              무대진행
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* ⚡ 특별 연출 음원 영역 */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-amber-500">⚡</span>
                  <span>특별 연출 음원 (대기 / 시상식 / 쉬는시간)</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {categoryTabs
                    .filter((cat) => cat.isCustom)
                    .map((cat) => {
                      const isSelected = selectedCategoryTab === cat.name;
                      return (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => {
                            setSelectedCategoryTab(cat.name);
                            setSelectedDivision("ALL");
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isSelected
                              ? "bg-slate-900 text-white shadow-sm ring-2 ring-slate-400"
                              : "bg-gradient-to-r from-slate-50 to-indigo-50/40 text-slate-800 hover:bg-indigo-50 border border-indigo-200/80"
                          }`}
                        >
                          <span className="text-sm">{cat.icon}</span>
                          <span>{cat.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                              isSelected ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
                            }`}
                          >
                            {cat.count}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* ☁️ 하드코딩된 커스텀 음원 탭 선택 시 노출되는 전용 업로드 & 가이드 바 */}
            {CUSTOM_CATEGORIES.some((c) => c.name === selectedCategoryTab) && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-slate-50 border border-indigo-100/90 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-xs">
                      {CUSTOM_CATEGORIES.find((c) => c.name === selectedCategoryTab)?.icon || "🎵"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">
                          {selectedCategoryTab}
                        </span>
                        <Tag color="indigo" className="font-bold text-[10px] m-0">
                          자체 음원 보관소
                        </Tag>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {CUSTOM_CATEGORIES.find((c) => c.name === selectedCategoryTab)?.desc}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleUploadCustomMusic(e.target.files, selectedCategoryTab);
                          e.target.value = "";
                        }
                      }}
                      className="hidden"
                    />
                    <Button
                      type="primary"
                      icon={<CloudUploadOutlined />}
                      loading={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl h-9 px-4 shadow-sm text-xs"
                    >
                      {isUploading ? `업로드 중 (${uploadProgress}%)` : `+ '${selectedCategoryTab}' 파일 업로드`}
                    </Button>
                  </div>
                </div>

                {isUploading && (
                  <div className="space-y-1 bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                    <div className="flex justify-between text-xs font-bold text-indigo-700">
                      <span>음원 파일 업로드 및 동기화 중...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress percent={uploadProgress} showInfo={false} strokeColor="#4f46e5" size="small" />
                  </div>
                )}
              </div>
            )}

            {/* 🏷️ 2단계: 세부 체급/부문 칩스 (Division Pills - 경기 종목일 때만 노출) */}
            {!CUSTOM_CATEGORIES.some((c) => c.name === selectedCategoryTab) && availableDivisions.length > 0 && (
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                    <span>2단계: 세부 부문 / 체급 (Division) 필터</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    원하는 체급을 클릭하면 해당 체급 전용 음원만 압축 표출됩니다.
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {/* 전체 부문 버튼 */}
                  <button
                    type="button"
                    onClick={() => setSelectedDivision("ALL")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      selectedDivision === "ALL"
                        ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <span>전체 부문 (ALL)</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        selectedDivision === "ALL" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {categoryBaseTracks.length}
                    </span>
                  </button>

                  {/* 세부 부문 버튼들 */}
                  {availableDivisions.map((div) => {
                    const isSelected = selectedDivision === div.name;
                    return (
                      <button
                        key={div.name}
                        type="button"
                        onClick={() => setSelectedDivision(div.name)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300"
                            : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        <span>{div.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                            isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {div.count}
                        </span>
                        {div.isCurrentMatch && (
                          <Tag color="magenta" className="text-[9px] m-0 px-1 py-0 rounded-full font-bold">
                            현재체급
                          </Tag>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 음원 목록 테이블 */}
            <Table
              dataSource={filteredTracks}
              columns={columns}
              rowKey={(record, idx) => getTrackKey(record) || idx}
              loading={isLoadingTracks}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50", "100"],
                className: "pt-2",
              }}
              locale={{
                emptyText: (
                  <div className="py-12 text-center text-slate-400 space-y-3">
                    <CustomerServiceOutlined className="text-4xl text-slate-300" />
                    <div>
                      {CUSTOM_CATEGORIES.some((c) => c.name === selectedCategoryTab)
                        ? `등록된 '${selectedCategoryTab}' 음원이 없습니다. 위의 [+ 파일 업로드] 버튼을 눌러 음원을 등록해보세요!`
                        : token
                        ? "불러온 VibeFlows 음원이 없거나 검색 결과가 없습니다."
                        : "VibeFlows 계정으로 로그인하여 음원 목록을 불러와주세요."}
                    </div>
                    {!token && !CUSTOM_CATEGORIES.some((c) => c.name === selectedCategoryTab) && (
                      <Button
                        type="primary"
                        icon={<LoginOutlined />}
                        onClick={() => setIsLoginModalOpen(true)}
                        className="bg-indigo-600 rounded-xl font-bold"
                      >
                        VibeFlows 로그인
                      </Button>
                    )}
                  </div>
                ),
              }}
            />

          </Card>
        </Col>

      </Row>

      {/* ========================================================================= */}
      {/* 🔐 표준 깔끔한 로그인 모달 */}
      {/* ========================================================================= */}
      <Modal
        open={isLoginModalOpen}
        onCancel={() => setIsLoginModalOpen(false)}
        footer={null}
        width={420}
        centered
        destroyOnClose
      >
        <form onSubmit={handleLogin} className="space-y-4 pt-2">
          <div className="text-center space-y-1 pb-3 border-b border-slate-100">
            <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl shadow-xs mb-2">
              <CustomerServiceOutlined />
            </div>
            <h2 className="text-lg font-bold text-slate-900 m-0">
              VibeFlows 계정 로그인
            </h2>
            <p className="text-xs text-slate-500 m-0">
              VibeFlows 계정으로 인증하여 공식 대회 음원 목록을 가져옵니다.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">이메일 계정</label>
              <Input
                type="email"
                size="large"
                placeholder="example@vibeflows.net"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">비밀번호</label>
              <Input.Password
                size="large"
                placeholder="비밀번호 입력"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => setRememberLogin(e.target.checked)}
                  className="rounded"
                />
                <span>로그인 정보 로컬에 저장 (24시간 동안 유지)</span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={isLoggingIn}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold"
            >
              {isLoggingIn ? "인증 확인 중..." : "로그인 및 음원 로드"}
            </Button>
          </div>

          <div className="text-[11px] text-slate-400 text-center">
            🔒 토큰은 브라우저 로컬 스토리지에 안전하게 보관됩니다.
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 🔍 API Raw JSON 검사 모달 */}
      {/* ========================================================================= */}
      <Modal
        open={isRawModalOpen}
        onCancel={() => setIsRawModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsRawModalOpen(false)} className="bg-indigo-600 rounded-lg font-bold">
            닫기
          </Button>,
        ]}
        width={700}
        centered
        title={
          <span className="font-bold flex items-center gap-2 text-slate-900">
            <CodeOutlined className="text-indigo-600" />
            <span>VibeFlows API 응답 원본 (Raw JSON)</span>
          </span>
        }
      >
        <div className="space-y-2 pt-2">
          <div className="text-xs text-slate-500 font-mono">
            엔드포인트: GET https://api.vibeflows.net/playlist/contest-songs
          </div>
          <pre className="bg-slate-900 p-4 rounded-xl text-xs font-mono text-emerald-400 max-h-[420px] overflow-y-auto select-text">
            {JSON.stringify(rawApiResponse, null, 2)}
          </pre>
        </div>
      </Modal>

    </div>
  );
};

export default VibeFlowAudioCenter;
