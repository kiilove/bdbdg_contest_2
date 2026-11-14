"use client";

import React, { useEffect, useState, useContext, useRef, useMemo } from "react";
import { useFirebaseRealtimeGetDocument } from "../../hooks/useFirebaseRealtime";
import { useFirestoreGetDocument } from "../../hooks/useFirestores";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import { ConfigProvider, theme } from "antd";
import ConfirmationModal from "../../messageBox/ConfirmationModal";
import { db, database, storage } from "../../firebase";
import { collection, getDocs, where, query } from "firebase/firestore";
import { ref as dbRef, set, remove, onValue } from "firebase/database";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";
import {
  loginVibeFlow,
  fetchVibeFlowContestSongs,
  getStoredVibeFlowToken,
  getStoredVibeFlowUser,
  clearVibeFlowToken,
  isTrackExposed,
  getCachedVibeFlowPlaylist,
} from "../../services/vibeflowService";
import {
  getAudioCacheKey,
  getCachedAudioBlobUrlSync,
  resolvePlayableAudioSource,
  hydrateAllStoredAudioBlobUrls,
  cacheOrWarmAudioTrack,
  batchCacheOrWarmTracks,
  evictCachedAudioTrack,
  clearAllCachedAudio,
} from "../../utils/indexedDbAudioStorage";

// 📦 서브 모듈 & 컴포넌트 임포트
import {
  CUSTOM_CATEGORIES,
  DEFAULT_TAB_CONFIGS,
  extractGender,
  isCategoryMatched,
  isDivisionMatched,
  isAdultPriorityCategory,
  getTrackKey,
  isTrackEqual,
  isNationalCeremonyTrack,
  isCustomTrack,
  isMatchingCustomTab,
  getTrackAudioUrl,
} from "./vibeflow/constants";
import { AudioHeader } from "./vibeflow/AudioHeader";
import { AudioPlayerCard } from "./vibeflow/AudioPlayerCard";
import { AudioTabControls } from "./vibeflow/AudioTabControls";
import { AutopilotCard } from "./vibeflow/AutopilotCard";
import { AudioCategoryTabs } from "./vibeflow/AudioCategoryTabs";
import { AudioTrackTable } from "./vibeflow/AudioTrackTable";
import { AudioModals } from "./vibeflow/AudioModals";

export const VibeFlowAudioCenter = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const contestId =
    currentContest?.contests?.id ||
    currentContest?.contestInfo?.id ||
    currentContest?.id ||
    "";

  // 🔑 VibeFlows 인증 & 데이터 상태 (로컬 플레이리스트 백업이 있으면 0ms 즉시 복원)
  const [token, setToken] = useState(() => getStoredVibeFlowToken());
  const [user, setUser] = useState(() => getStoredVibeFlowUser());
  const [rawTracks, setRawTracks] = useState(() =>
    getCachedVibeFlowPlaylist().filter(isTrackExposed)
  );
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [rawApiResponse, setRawApiResponse] = useState(null);

  // 🔐 모달 & 오프라인 음원 캐시 상태 (기본값: SSD에 저장된 음원만 재생/노출)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRawModalOpen, setIsRawModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isCacheModalOpen, setIsCacheModalOpen] = useState(false);
  const [audioCacheMap, setAudioCacheMap] = useState({});
  const [ssdOnlyMode, setSsdOnlyModeState] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("vf_ssd_only_mode_v1");
    return saved === null ? true : saved === "true";
  });
  const ssdOnlyModeRef = useRef(ssdOnlyMode);
  ssdOnlyModeRef.current = ssdOnlyMode;

  const setSsdOnlyMode = (val) => {
    const next = Boolean(val);
    ssdOnlyModeRef.current = next;
    setSsdOnlyModeState(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("vf_ssd_only_mode_v1", String(next));
      } catch {}
    }
  };

  // SSD 전용 모드가 켜져 있으면 IndexedDB에 완전히 저장된("cached") 음원만 콘솔·시드 풀에 노출
  const tracks = useMemo(() => {
    if (!ssdOnlyMode) return rawTracks;
    return rawTracks.filter((t) => {
      const ck = getAudioCacheKey(t);
      return Boolean(ck && audioCacheMap[ck]?.mode === "cached");
    });
  }, [rawTracks, ssdOnlyMode, audioCacheMap]);

  const [isBatchCaching, setIsBatchCaching] = useState(false);
  const [batchCacheProgress, setBatchCacheProgress] = useState(null);
  const batchAbortRef = useRef(null);
  const inFlightSilentCacheRef = useRef(new Set());
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState({});

  const message = {
    success: (text) => {
      setNoticeMessage({
        variant: "success",
        title: "오디오 센터 알림",
        body: String(text || ""),
        isButton: true,
        confirmButtonText: "확인",
      });
      setNoticeOpen(true);
    },
    error: (text) => {
      setNoticeMessage({
        variant: "error",
        title: "오디오 처리 오류",
        body: String(text || ""),
        isButton: true,
        confirmButtonText: "확인",
      });
      setNoticeOpen(true);
    },
    warning: (text) => {
      setNoticeMessage({
        variant: "warning",
        title: "오디오 재생 확인",
        body: String(text || ""),
        isButton: true,
        confirmButtonText: "확인",
      });
      setNoticeOpen(true);
    },
    info: (text) => {
      setNoticeMessage({
        variant: "info",
        title: "안내",
        body: String(text || ""),
        isButton: true,
        confirmButtonText: "확인",
      });
      setNoticeOpen(true);
    },
  };
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberLogin, setRememberLogin] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 🔍 탭 및 검색 필터링 상태
  const [selectedCategoryTab, setSelectedCategoryTab] = useState("ALL");
  const [selectedDivision, setSelectedDivision] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [isAutoPlayOnStageChange, setIsAutoPlayOnStageChange] = useState(true);
  const [playedTrackIds, setPlayedTrackIds] = useState([]);
  const [activeSeedLevel, setActiveSeedLevel] = useState(null);

  // ☁️ 커스텀 자체 음원 상태 (Realtime DB custom_bgm + Storage 전용 폴더 스캔 통합)
  const [rtCustomTracks, setRtCustomTracks] = useState([]);
  const [storageDirectTracks, setStorageDirectTracks] = useState([]);

  const customTracks = useMemo(() => {
    const map = {};
    storageDirectTracks.forEach((t) => {
      const k = t.storagePath || t.audio_url || getTrackKey(t);
      if (k) map[k] = t;
    });
    rtCustomTracks.forEach((t) => {
      const k = t.storagePath || t.audio_url || getTrackKey(t);
      if (k) map[k] = t;
    });
    return Object.values(map);
  }, [storageDirectTracks, rtCustomTracks]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // 🎧 오디오 플레이어 상태
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const [currentTime, setCurrentTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // 🎚️ 탭별 오디오 설정 (페이드 시간, 다음 곡 자동 준비 모드)
  const [tabConfigs, setTabConfigs] = useState(DEFAULT_TAB_CONFIGS);

  // 현재 선택된 탭의 실시간 설정 도우미
  const currentTabConfig = useMemo(() => {
    if (tabConfigs[selectedCategoryTab]) {
      return tabConfigs[selectedCategoryTab];
    }
    return tabConfigs.DEFAULT_CONTEST || { fadeDuration: 2.0, autoNext: true };
  }, [tabConfigs, selectedCategoryTab]);

  const updateTabFadeDuration = (tabKey, sec) => {
    setTabConfigs((prev) => {
      const isCustom = CUSTOM_CATEGORIES.some((c) => c.name === tabKey);
      const base = prev[tabKey] || (isCustom ? { autoNext: true } : prev.DEFAULT_CONTEST);
      return {
        ...prev,
        [tabKey]: {
          ...base,
          fadeDuration: Number(sec),
        },
      };
    });
  };

  const updateTabAutoNext = (tabKey, enabled) => {
    setTabConfigs((prev) => {
      const isCustom = CUSTOM_CATEGORIES.some((c) => c.name === tabKey);
      const base = prev[tabKey] || (isCustom ? { fadeDuration: 10.0 } : prev.DEFAULT_CONTEST);
      return {
        ...prev,
        [tabKey]: {
          ...base,
          autoNext: Boolean(enabled),
        },
      };
    });
  };

  const [preCuedTrack, setPreCuedTrack] = useState(null);

  // 🎚️ 데크별 실시간 개별 볼륨 (0 ~ 100%)
  const [deckAVolume, setDeckAVolume] = useState(100);
  const [deckBVolume, setDeckBVolume] = useState(0);

  // 📡 원격 동기화 상태
  const [isRemoteSync, setIsRemoteSync] = useState(true);
  const [lastProcessedSelectedAt, setLastProcessedSelectedAt] = useState(0);

  // 🎛️ 듀얼 오디오 재생 데크 (Deck A & Deck B 크로스페이더)
  const deckARef = useRef(null);
  const deckBRef = useRef(null);
  const [activeDeck, setActiveDeck] = useState("A");
  const activeDeckRef = useRef("A");
  const [audioTransition, setAudioTransition] = useState(null);
  const audioTransitionRef = useRef(null);
  const lastTransitionTickRef = useRef(0);
  const isCrossfadingRef = useRef(false);
  const isFadingRef = useRef(false);
  const fadeAnimationRef = useRef(null);
  const fadeTimeoutsRef = useRef([]);
  const loadingWatchdogTimersRef = useRef([]);
  const playRequestIdRef = useRef(0);
  const deckRequestIdRef = useRef({ A: 0, B: 0 });
  const stageAutoPlayTimeoutRef = useRef(null);
  const masterVolumeRef = useRef(volume);
  const rafRef = useRef(null);

  const clearLoadingWatchdogs = () => {
    if (loadingWatchdogTimersRef.current.length > 0) {
      loadingWatchdogTimersRef.current.forEach((id) => clearTimeout(id));
      loadingWatchdogTimersRef.current = [];
    }
  };

  const updateAudioTransition = (nextVal) => {
    audioTransitionRef.current = nextVal;
    lastTransitionTickRef.current = performance.now();
    setAudioTransition(nextVal);
  };

  const updateTransitionProgressThrottled = (progressPct, nowTs) => {
    const cur = audioTransitionRef.current;
    if (!cur) return;
    const clamped = Math.max(0, Math.min(100, Math.round(progressPct)));
    if (
      clamped === cur.progress ||
      (clamped < 100 && nowTs - lastTransitionTickRef.current < 75)
    ) {
      return;
    }
    const updated = { ...cur, progress: clamped };
    audioTransitionRef.current = updated;
    lastTransitionTickRef.current = nowTs;
    setAudioTransition(updated);
  };

  const registerFadeTimeout = (callback, delayMs) => {
    const timeoutId = setTimeout(() => {
      fadeTimeoutsRef.current = fadeTimeoutsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, delayMs);
    fadeTimeoutsRef.current.push(timeoutId);
    return timeoutId;
  };

  const stopAllFades = (clearTransition = true) => {
    clearLoadingWatchdogs();
    if (fadeAnimationRef.current) {
      cancelAnimationFrame(fadeAnimationRef.current);
      fadeAnimationRef.current = null;
    }
    if (fadeTimeoutsRef.current.length > 0) {
      fadeTimeoutsRef.current.forEach((id) => clearTimeout(id));
      fadeTimeoutsRef.current = [];
    }
    isFadingRef.current = false;
    isCrossfadingRef.current = false;
    if (clearTransition && audioTransitionRef.current) {
      audioTransitionRef.current = null;
      setAudioTransition(null);
    }
  };

  // 🎧 [사전 로드 & 재생 추적 Refs — 스테일 클로저 완벽 방지]
  const preCuedTrackRef = useRef(null);
  const isPreCuedRef = useRef(false);
  const playedTrackIdsRef = useRef(playedTrackIds);
  const isAutoPlayRef = useRef(isAutoPlayOnStageChange);
  const currentTrackRef = useRef(currentTrack);
  const selectedCategoryTabRef = useRef(selectedCategoryTab);
  const selectedDivisionRef = useRef(selectedDivision);
  const searchTextRef = useRef(searchText);
  const tabConfigsRef = useRef(tabConfigs);
  const tracksRef = useRef(tracks);
  const rawTracksRef = useRef(rawTracks);
  const customTracksRef = useRef(customTracks);
  const allAvailableTracksRef = useRef([]);
  const allRawTracksRef = useRef([]);
  const filteredTracksRef = useRef([]);
  const seed1PoolRef = useRef([]);
  const seed2PoolRef = useRef([]);
  const matchedVibeCategoryRef = useRef(null);
  const isRemoteSyncRef = useRef(isRemoteSync);
  const getNextSeedTrackRef = useRef(null);
  const playNextSeedTrackRef = useRef(null);

  currentTrackRef.current = currentTrack;
  selectedCategoryTabRef.current = selectedCategoryTab;
  selectedDivisionRef.current = selectedDivision;
  searchTextRef.current = searchText;
  tabConfigsRef.current = tabConfigs;
  tracksRef.current = tracks;
  rawTracksRef.current = rawTracks;
  customTracksRef.current = customTracks;
  isRemoteSyncRef.current = isRemoteSync;

  // 현재 재생 중인 트랙의 카테고리 기준 탭 설정 반환 (탭 이동과 무관하게 재생 중인 곡 설정 유지)
  const getEffectiveTabConfig = (track = currentTrackRef.current) => {
    const configs = tabConfigsRef.current || DEFAULT_TAB_CONFIGS;
    const trackCat = String(
      track?.contest_category_kr || track?.category || track?.folder || ""
    ).trim();

    if (trackCat && configs[trackCat]) {
      return configs[trackCat];
    }
    if (track && isCustomTrack(track)) {
      const matchedCustom = CUSTOM_CATEGORIES.find((c) =>
        isMatchingCustomTab(track, c.name)
      );
      if (matchedCustom && configs[matchedCustom.name]) {
        return configs[matchedCustom.name];
      }
    }
    if (trackCat) {
      return configs.DEFAULT_CONTEST || { fadeDuration: 2.0, autoNext: true };
    }
    return (
      configs[selectedCategoryTabRef.current] ||
      configs.DEFAULT_CONTEST ||
      { fadeDuration: 2.0, autoNext: true }
    );
  };

  // 의전/시상/개회식 등 무대 변경 시 자동 중단하면 안 되는 특별 이벤트 음원 판별
  const isProtectedCeremonyTrack = (track) => {
    if (!track) return false;
    if (isNationalCeremonyTrack(track)) return true;
    const cat = String(
      track.contest_category_kr || track.category || track.folder || ""
    ).trim();
    const title = String(track.title || track.name || "").trim();
    const ceremonyPattern =
      /(국민의례|애국가|묵념|의전|시상식|시상|내빈소개|내빈|귀빈|오프닝|opening|개회식|개회|폐회식|폐회|쉬는시간|휴식|인터미션|intermission|특별|이벤트|축하|찬조)/i;
    if (ceremonyPattern.test(cat) || ceremonyPattern.test(title)) return true;
    if (isCustomTrack(track) && !/(대기|wait)/i.test(cat)) return true;
    return false;
  };

  useEffect(() => {
    playedTrackIdsRef.current = playedTrackIds;
  }, [playedTrackIds]);

  useEffect(() => {
    isAutoPlayRef.current = isAutoPlayOnStageChange;
  }, [isAutoPlayOnStageChange]);

  useEffect(() => {
    masterVolumeRef.current = volume;
  }, [volume]);

  // 로컬 SSD(IndexedDB) 캐시 초기 적재 & 백그라운드 자동 저장 도우미
  const isCacheHydratedRef = useRef(false);
  useEffect(() => {
    let mounted = true;
    hydrateAllStoredAudioBlobUrls()
      .then((initialMap) => {
        if (mounted && initialMap) {
          setAudioCacheMap(initialMap);
        }
      })
      .finally(() => {
        isCacheHydratedRef.current = true;
      });
    return () => {
      mounted = false;
      if (batchAbortRef.current) {
        try {
          batchAbortRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const backgroundCacheTrackSilently = (track) => {
    // SSD 전용 모드에서는 미저장 VibeFlows 음원에 대해 백그라운드 서버 요청도 원천 차단
    if (ssdOnlyModeRef.current && !isCustomTrack(track)) {
      return;
    }
    const ck = getAudioCacheKey(track);
    if (!ck || getCachedAudioBlobUrlSync(ck) || inFlightSilentCacheRef.current.has(ck)) {
      return;
    }
    inFlightSilentCacheRef.current.add(ck);
    cacheOrWarmAudioTrack(track)
      .then((res) => {
        if (res?.success && res.cacheKey) {
          setAudioCacheMap((prev) => ({
            ...prev,
            [res.cacheKey]: {
              mode: res.mode,
              size: res.size || 0,
              savedAt: res.savedAt || Date.now(),
            },
          }));
        }
      })
      .catch(() => {})
      .finally(() => {
        inFlightSilentCacheRef.current.delete(ck);
      });
  };

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
      playRequestIdRef.current += 1;
      deckRequestIdRef.current = { A: 0, B: 0 };
      isPlayingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (volumeRampRef.current) cancelAnimationFrame(volumeRampRef.current);
      if (stageAutoPlayTimeoutRef.current) {
        clearTimeout(stageAutoPlayTimeoutRef.current);
        stageAutoPlayTimeoutRef.current = null;
      }
      stopAllFades();
      if (deckARef.current) {
        deckARef.current.pause();
        deckARef.current.src = "";
      }
      if (deckBRef.current) {
        deckBRef.current.pause();
        deckBRef.current.src = "";
      }
    };
  }, []);

  const volumeRampRef = useRef(null);

  const handleVolumeChange = (val) => {
    setVolume(val);
    masterVolumeRef.current = val;
    if (!isCrossfadingRef.current && !isFadingRef.current) {
      if (activeDeckRef.current === "A" && deckARef.current) {
        deckARef.current.volume = val;
        setDeckAVolume(Math.round(val * 100));
      } else if (activeDeckRef.current === "B" && deckBRef.current) {
        deckBRef.current.volume = val;
        setDeckBVolume(Math.round(val * 100));
      }
    }
  };

  // 🎚️ 부드러운 볼륨 이동 (사회자 마이크 연동 간이 믹싱 / 더킹)
  const handleSmoothVolumeChange = (targetVal, durationMs = 250) => {
    if (volumeRampRef.current) {
      cancelAnimationFrame(volumeRampRef.current);
      volumeRampRef.current = null;
    }

    const clampedTarget = Math.max(0, Math.min(1, targetVal));
    const startVol = masterVolumeRef.current;

    if (Math.abs(startVol - clampedTarget) < 0.005 || durationMs <= 0) {
      handleVolumeChange(clampedTarget);
      return;
    }

    const startTime = performance.now();

    const ramp = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentVol = startVol + (clampedTarget - startVol) * ease;

      handleVolumeChange(currentVol);

      if (progress < 1) {
        volumeRampRef.current = requestAnimationFrame(ramp);
      } else {
        handleVolumeChange(clampedTarget);
        volumeRampRef.current = null;
      }
    };

    volumeRampRef.current = requestAnimationFrame(ramp);
  };

  // 📡 1. Firebase Realtime DB 무대 모니터링
  const { data: realtimeStage } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );

  // 📡 2. Firestore 대회 진행표(stageAssign) 전체 로드
  const [contestStagesList, setContestStagesList] = useState([]);
  const fetchStagesDoc = useFirestoreGetDocument("contest_stages_assign");

  useEffect(() => {
    if (!contestId) return;
    const stageAssignId =
      currentContest?.contests?.contestStagesAssignId ||
      currentContest?.contests?.stageAssignId;
    let cancelled = false;

    (async () => {
      try {
        let stageDoc = null;
        if (stageAssignId) {
          stageDoc = await fetchStagesDoc.getDocument(stageAssignId);
        } else {
          const snap = await getDocs(
            query(
              collection(db, "contest_stages_assign"),
              where("contestId", "==", contestId)
            )
          );
          if (!snap.empty) {
            stageDoc = snap.docs[0].data();
          }
        }
        if (!cancelled && Array.isArray(stageDoc?.stages)) {
          const sorted = [...stageDoc.stages].sort(
            (a, b) => (a.stageNumber || 0) - (b.stageNumber || 0)
          );
          setContestStagesList(sorted);
        }
      } catch (e) {
        console.warn("[VibeFlow Audio] 대회 무대 시간표 로드 실패:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest, contestId]);

  // ⏱️ 재생 시간 추적 및 8초 전 대기 데크 프리로드
  const startTracking = () => {
    const update = () => {
      const curAudio = activeDeckRef.current === "A" ? deckARef.current : deckBRef.current;
      const otherAudio = activeDeckRef.current === "A" ? deckBRef.current : deckARef.current;

      if (!isPlayingRef.current) return;

      if (curAudio) {
        // 🔒 어떤 페이드도 진행 중이지 않을 때만 볼륨 동기화
        if (!isFadingRef.current && !isCrossfadingRef.current && !curAudio.paused) {
          if (curAudio.volume !== masterVolumeRef.current) {
            curAudio.volume = masterVolumeRef.current;
          }
          if (otherAudio && otherAudio.volume > 0) {
            otherAudio.volume = 0;
          }
        }

        setDeckAVolume(Math.round((deckARef.current?.volume || 0) * 100));
        setDeckBVolume(Math.round((deckBRef.current?.volume || 0) * 100));

        const curTime = curAudio.currentTime || 0;
        const dur = curAudio.duration || 0;
        if (!isNaN(curTime)) setCurrentTime(curTime);
        if (!isNaN(dur) && dur > 0) setTrackDuration(dur);

        // 🎧 [연속 재생 모드] 현재 재생 중인 트랙의 카테고리 기준 autoNext 설정을 조회하여 대기 데크 프리로드(Pre-Cue)
        const autoNextEnabled = getEffectiveTabConfig(currentTrackRef.current).autoNext;
        const remaining = dur > 0 ? dur - curTime : Infinity;
        if (
          autoNextEnabled &&
          (curTime >= 4.0 || (dur > 0 && remaining <= 10.0)) &&
          !isPreCuedRef.current
        ) {
          const nextInfo = getNextSeedTrackRef.current
            ? getNextSeedTrackRef.current(playedTrackIdsRef.current, {
                isStageTransition: false,
              })
            : null;

          if (nextInfo && nextInfo.track) {
            const { src: nextSrc, remoteUrl, isCachedBlob } = resolvePlayableAudioSource(
              nextInfo.track
            );

            if (nextSrc || remoteUrl) {
              preCuedTrackRef.current = nextInfo;
              setPreCuedTrack(nextInfo.track);
              isPreCuedRef.current = true;

              // 원격 HTTP 소켓을 대기 데크에 미리 열어두면 해외 CDN(LAX) Keep-Alive 만료 시 좀비 연결이 발생하므로,
              // 대기 곡은 백그라운드에서 즉시 로컬 SSD(IndexedDB)로 통째로 받아두고 Blob일 때만 데크에 적재
              if (!isCachedBlob) {
                backgroundCacheTrackSilently(nextInfo.track);
              } else {
                const idleDeckName = activeDeckRef.current === "A" ? "B" : "A";
                const idleAudio = idleDeckName === "A" ? deckARef.current : deckBRef.current;
                if (idleAudio) {
                  idleAudio.preload = "auto";
                  if (idleAudio.src !== nextSrc) {
                    idleAudio.src = nextSrc;
                    idleAudio.load();
                  }
                  idleAudio.volume = 0;
                  idleAudio.currentTime = 0;
                }
              }
            }
          }
        }
      }

      if (isPlayingRef.current) {
        rafRef.current = requestAnimationFrame(update);
      }
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

  // ☁️ 1. Firebase Realtime DB 커스텀 음원 구독 (custom_bgm + contests/${contestId}/customTracks)
  useEffect(() => {
    const unsubscribes = [];
    const allCustomMap = {};

    const syncCustomTracks = () => {
      const list = Object.values(allCustomMap);
      list.sort((a, b) => (b.created_at || b.uploadedAt || 0) - (a.created_at || a.uploadedAt || 0));
      setRtCustomTracks(list);
    };

    // 1. 📌 [이전 원본 위치] custom_bgm 구독
    const bgmDbRef = dbRef(database, "custom_bgm");
    const unsubBgm = onValue(bgmDbRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        Object.entries(data).forEach(([id, item]) => {
          if (item && typeof item === "object") {
            allCustomMap[id] = {
              ...item,
              id: id,
              uuid: item.uuid || `custom_${id}`,
              is_custom: true,
              duration: item.duration || item.duration_sec || 180,
            };
          }
        });
      }
      syncCustomTracks();
    });
    unsubscribes.push(unsubBgm);

    // 2. 대회별 경로 구독 (contests/${contestId}/customTracks)
    if (contestId) {
      const contestCustomRef = dbRef(database, `contests/${contestId}/customTracks`);
      const unsubContest = onValue(contestCustomRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          Object.entries(data).forEach(([id, val]) => {
            if (val && typeof val === "object") {
              allCustomMap[id] = {
                id,
                uuid: val.uuid || id,
                ...val,
                is_custom: true,
                duration: val.duration || 180,
              };
            }
          });
        }
        syncCustomTracks();
      });
      unsubscribes.push(unsubContest);
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [contestId]);

  // ☁️ 2. Firebase Storage 'custom_bgm' 전용 폴더 스캔 (지정된 4대 카테고리 폴더만 정확히 로드)
  useEffect(() => {
    let isCancelled = false;

    async function scanStorageCustomBgm() {
      try {
        const rootRef = storageRef(storage, "custom_bgm");
        const rootResult = await listAll(rootRef);
        const storageTracks = [];

        // 오직 명확한 4대 카테고리 하위 폴더만 순회 (custom_bgm/대기할때 음악, custom_bgm/시상식때의 음악 등)
        for (const folderRef of rootResult.prefixes) {
          const folderName = folderRef.name;
          const isKnownCategory = CUSTOM_CATEGORIES.some((c) => c.name === folderName);
          if (!isKnownCategory) continue;

          try {
            const subResult = await listAll(folderRef);
            for (const itemRef of subResult.items) {
              try {
                const downloadURL = await getDownloadURL(itemRef);
                const fileName = itemRef.name;
                const cleanTitle = fileName.replace(/^\d+_/, "").replace(/\.[^/.]+$/, "");

                storageTracks.push({
                  id: `storage_${itemRef.fullPath.replace(/[^a-zA-Z0-9]/g, "_")}`,
                  uuid: `storage_${itemRef.fullPath.replace(/[^a-zA-Z0-9]/g, "_")}`,
                  title: cleanTitle,
                  name: cleanTitle,
                  artist: "Storage 자체 음원",
                  audio_url: downloadURL,
                  downloadURL: downloadURL,
                  url: downloadURL,
                  storagePath: itemRef.fullPath,
                  contest_category_kr: folderName,
                  contest_division_kr: "공통 / 전체",
                  duration: 180,
                  is_custom: true,
                  source: "firebase_storage_direct",
                });
              } catch (e) {}
            }
          } catch (e) {}
        }

        if (!isCancelled && storageTracks.length > 0) {
          console.log("[VibeFlow Audio] Storage custom_bgm 전용 폴더 스캔 완료:", storageTracks.length);
          setStorageDirectTracks(storageTracks);
        }
      } catch (err) {
        console.warn("[VibeFlow Audio] Storage custom_bgm 스캔 건너뜀/에러:", err);
      }
    }

    scanStorageCustomBgm();

    return () => {
      isCancelled = true;
    };
  }, []);

  // ☁️ 커스텀 음원 업로드 핸들러 (custom_bgm + contests/${contestId}/customTracks)
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
        const durationSec = await new Promise((resolve) => {
          let objectUrl = "";
          try {
            objectUrl = URL.createObjectURL(file);
            const tempAudio = new Audio(objectUrl);
            tempAudio.onloadedmetadata = () => {
              const dur = Math.round(tempAudio.duration) || 0;
              URL.revokeObjectURL(objectUrl);
              resolve(dur);
            };
            tempAudio.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              resolve(180);
            };
          } catch {
            if (objectUrl) {
              try {
                URL.revokeObjectURL(objectUrl);
              } catch {
                // ignore revoke error
              }
            }
            resolve(180);
          }
        });

        const cleanName = file.name.replace(/[^a-zA-Z0-9._가-힣]/g, "_");
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
              try {
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
                  uploadedAt: Date.now(),
                  is_custom: true,
                  is_active: 1,
                };

                await set(dbRef(database, `custom_bgm/${songId}`), songData);
                if (contestId) {
                  try {
                    await set(dbRef(database, `contests/${contestId}/customTracks/${songId}`), songData);
                  } catch (e) {}
                }
                successCount++;
                resolve();
              } catch (err) {
                reject(err);
              }
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
      message.success(`총 ${successCount}개의 음원이 '${category}'에 등록되었습니다.`);
    }
  };

  // 🗑️ 커스텀 음원 삭제 핸들러
  const handleDeleteCustomMusic = async (track) => {
    if (!track || !track.id) return;
    try {
      if (
        isTrackEqual(currentTrackRef.current, track) ||
        isTrackEqual(audioTransitionRef.current?.targetTrack, track)
      ) {
        playRequestIdRef.current += 1;
        deckRequestIdRef.current = { A: 0, B: 0 };
        stopAllFades(true);
        isPlayingRef.current = false;
        setIsPlaying(false);
        setCurrentTrack(null);
        currentTrackRef.current = null;
        stopTracking();
        if (deckARef.current) {
          deckARef.current.pause();
          deckARef.current.src = "";
        }
        if (deckBRef.current) {
          deckBRef.current.pause();
          deckBRef.current.src = "";
        }
      }

      if (track.storagePath) {
        try {
          const fileStorageRef = storageRef(storage, track.storagePath);
          await deleteObject(fileStorageRef);
        } catch (storageErr) {
          console.warn("Storage 파일 삭제 건너뜀:", storageErr);
        }
      }

      await remove(dbRef(database, `custom_bgm/${track.id}`));
      if (contestId) {
        try {
          await remove(dbRef(database, `contests/${contestId}/customTracks/${track.id}`));
        } catch (e) {}
      }
      const deletedCacheKey = getAudioCacheKey(track);
      await evictCachedAudioTrack(track);
      if (deletedCacheKey) {
        setAudioCacheMap((prev) => {
          if (!prev[deletedCacheKey]) return prev;
          const next = { ...prev };
          delete next[deletedCacheKey];
          return next;
        });
      }
      message.success(`'${track.title || track.name}' 음원이 삭제되었습니다.`);
    } catch (error) {
      console.error("커스텀 음원 삭제 실패:", error);
      message.error("삭제 실패: " + error.message);
    }
  };

  // 🎵 VibeFlows 음원 목록 로드 (해외 CDN/API 일시 지연 시 기존·백업 목록 보존)
  const loadVibeFlowTracks = async (authToken = token) => {
    if (!authToken) return;
    setIsLoadingTracks(true);
    try {
      const res = await fetchVibeFlowContestSongs(authToken);
      console.log("[VibeFlow Audio] fetchVibeFlowContestSongs 결과:", res);
      setRawApiResponse(res?.raw || res);

      if (res?.isUnauthorized) {
        const backup = getCachedVibeFlowPlaylist().filter(isTrackExposed);
        if (rawTracksRef.current.length === 0 && backup.length > 0) {
          setRawTracks(backup);
        }
        // 로컬 백업·SSD 음원이 이미 확보된 대회 현장에서는 토큰 만료 시에도 목록을 비우거나 로그인 모달로 화면을 가리지 않음
        if (rawTracksRef.current.length === 0 && backup.length === 0) {
          clearVibeFlowToken();
          setToken(null);
          setUser(null);
          setIsLoginModalOpen(true);
        }
        return;
      }

      if (!res?.success) {
        const backup = getCachedVibeFlowPlaylist().filter(isTrackExposed);
        if (rawTracksRef.current.length === 0 && backup.length > 0) {
          setRawTracks(backup);
        }
        if (rawTracksRef.current.length === 0 && backup.length === 0) {
          message.warning(res?.error || "음원 목록 수신이 지연되고 있습니다. 잠시 후 새로고침해 주세요.");
        }
        return;
      }

      let rawTrackList = [];
      if (Array.isArray(res.tracks)) {
        rawTrackList = res.tracks;
      } else if (Array.isArray(res.songs)) {
        rawTrackList = res.songs;
      } else if (Array.isArray(res)) {
        rawTrackList = res;
      } else if (res?.data && Array.isArray(res.data)) {
        rawTrackList = res.data;
      }

      // 👁️ is_active = 1 (노출 중인 음원만 100% 필터링)
      const finalExposed = rawTrackList.filter(isTrackExposed);
      if (finalExposed.length > 0 || rawTracksRef.current.length === 0) {
        setRawTracks(finalExposed);
      }
    } catch (err) {
      console.error("[VibeFlow Audio] 트랙 로드 에러:", err);
      if (err.message?.includes("401") || err.message?.includes("인증")) {
        clearVibeFlowToken();
        setToken(null);
        setUser(null);
        setIsLoginModalOpen(true);
      }
    } finally {
      setIsLoadingTracks(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadVibeFlowTracks(token);
    }
  }, [token]);

  // 🔑 로그인 핸들러
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!loginEmail || !loginPassword) {
      message.warning("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setIsLoggingIn(true);
    try {
      const res = await loginVibeFlow(
        loginEmail,
        loginPassword,
        rememberLogin
      );
      if (res && res.success) {
        const { token: newToken, user: newUser } = res;
        setToken(newToken);
        setUser(newUser);
        setIsLoginModalOpen(false);
        message.success(`${newUser?.name || newUser?.email} 계정으로 연결되었습니다`);
        loadVibeFlowTracks(newToken);
      } else {
        message.error(res?.error || "로그인에 실패했습니다.");
      }
    } catch (err) {
      message.error(err.message || "로그인에 실패했습니다.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 🚪 로그아웃 핸들러
  const handleLogout = () => {
    clearVibeFlowToken();
    setToken(null);
    setUser(null);
    setRawTracks([]);
    message.info("로그아웃되었습니다.");
  };

  // 📡 nowPlaying 원격 브로드캐스트
  const updateRemoteNowPlaying = (track, status) => {
    if (!isRemoteSyncRef.current || !track) return;
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

  // 🎚️ 탭 설정 기반 페이드 지속 시간 (ms 반환)
  const getFadeDuration = (targetTrack, currentTrk = currentTrackRef.current) => {
    const config = getEffectiveTabConfig(targetTrack || currentTrk);
    return Math.round((config.fadeDuration || 0) * 1000);
  };

  // 🛑 지연 중인 대기 데크 로딩 수동 취소 (현재 재생 중인 데크는 그대로 유지)
  const handleCancelLoading = () => {
    const activeTrans = audioTransitionRef.current;
    if (!activeTrans || activeTrans.phase !== "loading") return;

    playRequestIdRef.current += 1;
    clearLoadingWatchdogs();

    const targetDeckName = activeTrans.targetDeck;
    const curDeckName = activeDeckRef.current;

    if (targetDeckName && targetDeckName !== curDeckName) {
      const targetAudio = targetDeckName === "A" ? deckARef.current : deckBRef.current;
      deckRequestIdRef.current[targetDeckName] = 0;
      if (targetAudio) {
        try {
          targetAudio.pause();
          targetAudio.removeAttribute("src");
          targetAudio.load();
          targetAudio.volume = 0;
        } catch {}
      }
    } else if (!isPlayingRef.current) {
      const targetAudio = targetDeckName === "A" ? deckARef.current : deckBRef.current;
      deckRequestIdRef.current = { A: 0, B: 0 };
      if (targetAudio) {
        try {
          targetAudio.pause();
          targetAudio.removeAttribute("src");
          targetAudio.load();
          targetAudio.volume = 0;
        } catch {}
      }
    }

    updateAudioTransition(null);
  };

  // 🛡️ 해외 CDN(LAX) 스트림 버퍼링 지연 시 자동 소켓 재연결 & 무한 대기 방지 워치독
  const armLoadingWatchdog = ({
    audioEl,
    deckName,
    requestId,
    remoteUrl,
    targetVol,
    crossfadeDuration,
    triggerSource,
  }) => {
    clearLoadingWatchdogs();
    if (!audioEl || !remoteUrl) return;

    // 4.5초 경과 시에도 버퍼가 시작되지 않으면 좀비 소켓을 강제 리셋 후 재요청
    const retryTimer = setTimeout(() => {
      if (
        requestId !== playRequestIdRef.current ||
        audioTransitionRef.current?.phase !== "loading" ||
        audioEl.readyState >= 3
      ) {
        return;
      }
      try {
        const sep = remoteUrl.includes("?") ? "&" : "?";
        audioEl.pause();
        audioEl.removeAttribute("src");
        audioEl.load();
        audioEl.src = `${remoteUrl}${sep}_retry=${Date.now()}`;
        audioEl.preload = "auto";
        audioEl.volume = crossfadeDuration <= 0 ? targetVol : 0;
        audioEl.load();
        audioEl.play().catch(() => {});
      } catch {}
    }, 4500);

    // 11초 경과 시에도 응답이 없으면 버튼 잠금 완전 해제 및 연속 재생 시 다음 곡으로 자동 우회
    const giveUpTimer = setTimeout(() => {
      if (
        requestId !== playRequestIdRef.current ||
        audioTransitionRef.current?.phase !== "loading"
      ) {
        return;
      }
      playRequestIdRef.current += 1;
      deckRequestIdRef.current[deckName] = 0;
      try {
        audioEl.pause();
        audioEl.removeAttribute("src");
        audioEl.load();
        audioEl.volume = 0;
      } catch {}
      updateAudioTransition(null);

      if (
        (triggerSource === "auto-ended" ||
          triggerSource === "autopilot" ||
          triggerSource === "stage") &&
        playNextSeedTrackRef.current
      ) {
        playNextSeedTrackRef.current(false, true, undefined, "autopilot");
      } else {
        message.warning(
          "음원 서버 응답이 지연되어 로딩을 취소했습니다. 다시 클릭하거나 상단 '전곡 사전 다운로드'로 로컬에 저장해 주세요."
        );
      }
    }, 11000);

    loadingWatchdogTimersRef.current = [retryTimer, giveUpTimer];
  };

  // 💾 전곡 사전 다운로드 / 워밍업 제어 핸들러 (전체 원본 풀 기준으로 미저장 음원만 안전하게 수신)
  const handleStartBatchCache = async ({ force = false } = {}) => {
    if (isBatchCaching) return;
    const pool = allRawTracksRef.current || [];
    if (pool.length === 0) {
      message.warning("다운로드할 음원 목록이 아직 로드되지 않았습니다.");
      return;
    }

    const controller = new AbortController();
    batchAbortRef.current = controller;
    setIsBatchCaching(true);

    try {
      const result = await batchCacheOrWarmTracks(pool, {
        concurrency: 1,
        force,
        existingStatusMap: audioCacheMap,
        signal: controller.signal,
        onTrackUpdate: (cacheKey, nextEntry) => {
          setAudioCacheMap((prev) => {
            const copy = { ...prev };
            if (!nextEntry) {
              delete copy[cacheKey];
            } else {
              copy[cacheKey] = nextEntry;
            }
            return copy;
          });
        },
        onProgressSummary: (summary) => {
          setBatchCacheProgress(summary);
        },
      });

      if (!result.aborted) {
        if (result.failedCount === 0) {
          message.success(
            `총 ${result.total}곡 사전 준비가 완료되었습니다. (SSD 저장 ${result.cachedCount}곡${
              result.warmedCount > 0 ? `, 워밍업 ${result.warmedCount}곡` : ""
            })`
          );
        } else {
          message.warning(
            `완료 ${result.cachedCount + result.warmedCount}곡 / 실패 ${result.failedCount}곡 — 실패 항목은 '재시도'를 눌러 다시 받을 수 있습니다.`
          );
        }
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        message.error("일괄 다운로드 중 오류가 발생했습니다: " + (err?.message || ""));
      }
    } finally {
      batchAbortRef.current = null;
      setIsBatchCaching(false);
    }
  };

  const handleCancelBatchCache = () => {
    if (batchAbortRef.current) {
      try {
        batchAbortRef.current.abort();
      } catch {}
    }
  };

  const handleCacheSingleTrack = async (track) => {
    const ck = getAudioCacheKey(track);
    if (!ck) return;
    setAudioCacheMap((prev) => ({
      ...prev,
      [ck]: { mode: "downloading", progress: 0 },
    }));
    try {
      const res = await cacheOrWarmAudioTrack(track, {
        force: true,
        onProgress: (pct) => {
          setAudioCacheMap((prev) => ({
            ...prev,
            [ck]: { mode: "downloading", progress: pct },
          }));
        },
      });
      if (res.success) {
        setAudioCacheMap((prev) => ({
          ...prev,
          [ck]: {
            mode: res.mode,
            size: res.size || 0,
            savedAt: res.savedAt || Date.now(),
          },
        }));
      } else {
        setAudioCacheMap((prev) => ({
          ...prev,
          [ck]: { mode: "failed", error: res.error || "다운로드 실패" },
        }));
      }
    } catch (err) {
      setAudioCacheMap((prev) => ({
        ...prev,
        [ck]: { mode: "failed", error: err?.message || "오류 발생" },
      }));
    }
  };

  const handleClearAudioCache = async () => {
    if (isBatchCaching) return;
    await clearAllCachedAudio();
    setAudioCacheMap({});
    setBatchCacheProgress(null);
    message.info("로컬에 저장된 오프라인 음원 캐시를 모두 비웠습니다.");
  };

  // 🎛️ 듀얼 데크 지능형 크로스페이드 (로컬 SSD Blob 우선 0ms 재생 + 좀비 소켓 강제 갱신 + 워치독 내장)
  const crossfadeToTrack = (
    track,
    customDuration,
    triggerSource = "track",
    options = {}
  ) => {
    const { forceRemote = false, ssdSkipDepth = 0 } = options;
    const remoteUrl = getTrackAudioUrl(track);
    const resolved = forceRemote
      ? { src: remoteUrl, remoteUrl, isCachedBlob: false }
      : resolvePlayableAudioSource(track);
    const playableUrl = resolved.src;
    const isCachedBlob = resolved.isCachedBlob;

    // 🔒 SSD 전용 모드 강제 가드: 로컬 SSD에 없는 VibeFlows 음원은 외부 서버 요청(Rate Limit 소모) 없이 즉시 차단
    //    (비동기 깊이 제한 ssdSkipDepth <= 2 적용으로 동기 무한 재귀 가능성 100% 원천 차단)
    if (ssdOnlyModeRef.current && !isCachedBlob && !isCustomTrack(track)) {
      if (
        ssdSkipDepth < 2 &&
        (triggerSource === "auto-ended" ||
          triggerSource === "autopilot" ||
          triggerSource === "stage") &&
        tracksRef.current.length > 0 &&
        playNextSeedTrackRef.current
      ) {
        setTimeout(() => {
          if (playNextSeedTrackRef.current) {
            playNextSeedTrackRef.current(
              false,
              true,
              customDuration,
              "autopilot",
              ssdSkipDepth + 1
            );
          }
        }, 60);
      } else if (ssdSkipDepth === 0) {
        message.warning("현재 'SSD 전용 재생 모드'가 켜져 있어 디스크에 저장된 음원만 재생됩니다.");
      }
      return;
    }

    if (!track || !playableUrl) {
      message.error("재생 가능한 음원 URL이 없습니다.");
      return;
    }

    const prevTrack = currentTrackRef.current;
    const isCurrentCustom = isCustomTrack(prevTrack);
    const isTargetCustom = isCustomTrack(track);
    const isModeSwitching = !prevTrack || isCurrentCustom !== isTargetCustom;

    const crossfadeDuration =
      customDuration !== undefined
        ? customDuration
        : getFadeDuration(track, prevTrack);

    if (!deckARef.current) deckARef.current = new Audio();
    if (!deckBRef.current) deckBRef.current = new Audio();

    const requestId = ++playRequestIdRef.current;
    stopAllFades(false);

    const targetVol = masterVolumeRef.current;

    // 🌟 [원칙 1: 대회 음원 ⇄ 자체 음원 영역 전환 시 무조건 Deck A 전담 리셋]
    if (isModeSwitching) {
      deckRequestIdRef.current.A = requestId;
      deckRequestIdRef.current.B = 0;

      updateAudioTransition({
        phase: "loading",
        source: triggerSource,
        targetDeck: "A",
        fromDeck: null,
        targetTrack: track,
        fromTrack: prevTrack,
        progress: 0,
        durationMs: crossfadeDuration,
        startedAt: Date.now(),
      });

      if (deckBRef.current) {
        try {
          deckBRef.current.pause();
          deckBRef.current.currentTime = 0;
          deckBRef.current.volume = 0;
        } catch (e) {}
      }
      if (deckARef.current) {
        try {
          deckARef.current.pause();
          deckARef.current.currentTime = 0;
        } catch (e) {}
      }

      activeDeckRef.current = "A";
      setActiveDeck("A");
      setPreCuedTrack(null);
      isPreCuedRef.current = false;
      preCuedTrackRef.current = null;

      const deckA = deckARef.current;
      // 이전 프리로드 연결이 끊겼거나 에러 상태인 경우(readyState < 3) 무조건 새 소켓으로 강제 재로드
      if (deckA.src !== playableUrl || deckA.readyState < 3 || deckA.error) {
        deckA.src = playableUrl;
        deckA.preload = "auto";
        deckA.load();
      }
      deckA.currentTime = 0;
      deckA.volume = crossfadeDuration <= 0 ? targetVol : 0;

      setCurrentTrack(track);
      currentTrackRef.current = track;

      if (!isCachedBlob) {
        armLoadingWatchdog({
          audioEl: deckA,
          deckName: "A",
          requestId,
          remoteUrl,
          targetVol,
          crossfadeDuration,
          triggerSource,
        });
      }

      deckA
        .play()
        .then(() => {
          clearLoadingWatchdogs();
          if (requestId !== playRequestIdRef.current) {
            if (deckRequestIdRef.current.A !== playRequestIdRef.current || !isPlayingRef.current) {
              try {
                deckA.pause();
                deckA.volume = 0;
              } catch (e) {}
            }
            return;
          }

          setIsPlaying(true);
          isPlayingRef.current = true;
          updateRemoteNowPlaying(track, "play");
          startTracking();

          if (!isCachedBlob) {
            setTimeout(() => backgroundCacheTrackSilently(track), 1200);
          }

          if (crossfadeDuration <= 0) {
            const latestVol = masterVolumeRef.current;
            deckA.volume = latestVol;
            if (deckBRef.current) deckBRef.current.volume = 0;
            setDeckAVolume(Math.round(latestVol * 100));
            setDeckBVolume(0);
            updateAudioTransition(null);
            return;
          }

          const startTime = performance.now();
          const fadeInDuration = crossfadeDuration;
          isFadingRef.current = true;
          isCrossfadingRef.current = true;

          updateAudioTransition({
            phase: "fading-in",
            source: triggerSource,
            targetDeck: "A",
            fromDeck: null,
            targetTrack: track,
            fromTrack: prevTrack,
            progress: 0,
            durationMs: fadeInDuration,
            startedAt: audioTransitionRef.current?.startedAt || Date.now(),
          });

          const finalizeFadeIn = () => {
            if (requestId !== playRequestIdRef.current) return;
            stopAllFades(true);
            const latestVol = masterVolumeRef.current;
            if (deckA) deckA.volume = latestVol;
            if (deckBRef.current) deckBRef.current.volume = 0;
            setDeckAVolume(Math.round(latestVol * 100));
            setDeckBVolume(0);
          };

          const step = (now) => {
            if (requestId !== playRequestIdRef.current) return;
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / fadeInDuration, 1);
            const latestVol = masterVolumeRef.current;
            const inVol = latestVol * (progress < 1 ? Math.sin((progress * Math.PI) / 2) : 1);

            if (deckA) deckA.volume = Math.max(0, Math.min(latestVol, inVol));
            if (deckBRef.current) deckBRef.current.volume = 0;

            setDeckAVolume(Math.round((deckA?.volume || 0) * 100));
            setDeckBVolume(0);
            updateTransitionProgressThrottled(progress * 100, now);

            if (progress < 1) {
              fadeAnimationRef.current = requestAnimationFrame(step);
            } else {
              finalizeFadeIn();
            }
          };

          fadeAnimationRef.current = requestAnimationFrame(step);
          registerFadeTimeout(finalizeFadeIn, fadeInDuration + 80);
        })
        .catch((err) => {
          if (requestId !== playRequestIdRef.current) return;
          clearLoadingWatchdogs();
          if (
            isCachedBlob &&
            remoteUrl &&
            !forceRemote &&
            err?.name !== "AbortError" &&
            err?.name !== "NotAllowedError"
          ) {
            const badKey = getAudioCacheKey(track);
            evictCachedAudioTrack(track).finally(() => {
              if (badKey) {
                setAudioCacheMap((prev) => {
                  const next = { ...prev };
                  delete next[badKey];
                  return next;
                });
              }
              if (!ssdOnlyModeRef.current) {
                crossfadeToTrack(track, customDuration, triggerSource, { forceRemote: true });
              } else {
                updateAudioTransition(null);
              }
            });
            return;
          }
          updateAudioTransition(null);
          if (err.name === "AbortError") return;
          console.warn("[Mode Switch Play Error]:", err);
          message.warning("음원 재생 실패: " + err.message);
        });

      return;
    }

    // 🌟 [원칙 2: 동일 영역 내 연속 재생 시 듀얼 데크 A ⇄ B 크로스페이드]
    const currentDeckName = activeDeckRef.current;
    const nextDeckName = currentDeckName === "A" ? "B" : "A";

    const currentAudio = currentDeckName === "A" ? deckARef.current : deckBRef.current;
    const nextAudio = nextDeckName === "A" ? deckARef.current : deckBRef.current;

    const isCurrentlyActive = currentAudio && !currentAudio.paused && isPlayingRef.current;

    updateAudioTransition({
      phase: "loading",
      source: triggerSource,
      targetDeck: nextDeckName,
      fromDeck: isCurrentlyActive ? currentDeckName : null,
      targetTrack: track,
      fromTrack: prevTrack,
      progress: 0,
      durationMs: crossfadeDuration,
      startedAt: Date.now(),
    });

    deckRequestIdRef.current[nextDeckName] = requestId;
    if (!isCurrentlyActive) {
      deckRequestIdRef.current[currentDeckName] = 0;
    }

    // 이전 미완료 전환에서 nextAudio가 아직 재생 중이었다면 즉시 안전 정지 후 새 소스 로드
    if (nextAudio && !nextAudio.paused) {
      try {
        nextAudio.pause();
      } catch (e) {}
    }

    // 대기 데크 소켓이 유휴 만료되었거나 버퍼 미완료(readyState < 3) 상태면 무조건 새 소켓으로 강제 재로드
    if (nextAudio.src !== playableUrl || nextAudio.readyState < 3 || nextAudio.error) {
      nextAudio.src = playableUrl;
      nextAudio.preload = "auto";
      nextAudio.load();
    }
    nextAudio.currentTime = 0;
    nextAudio.volume = crossfadeDuration <= 0 ? targetVol : 0;

    if (!isCachedBlob) {
      armLoadingWatchdog({
        audioEl: nextAudio,
        deckName: nextDeckName,
        requestId,
        remoteUrl,
        targetVol,
        crossfadeDuration,
        triggerSource,
      });
    }

    nextAudio
      .play()
      .then(() => {
        clearLoadingWatchdogs();
        if (requestId !== playRequestIdRef.current) {
          if (deckRequestIdRef.current[nextDeckName] !== playRequestIdRef.current || !isPlayingRef.current) {
            try {
              nextAudio.pause();
              nextAudio.volume = 0;
            } catch (e) {}
          }
          return;
        }

        setIsPlaying(true);
        isPlayingRef.current = true;
        setActiveDeck(nextDeckName);
        activeDeckRef.current = nextDeckName;
        deckRequestIdRef.current[currentDeckName] = 0;
        setCurrentTrack(track);
        currentTrackRef.current = track;
        setPreCuedTrack(null);
        isPreCuedRef.current = false;
        preCuedTrackRef.current = null;
        updateRemoteNowPlaying(track, "play");
        startTracking();

        if (!isCachedBlob) {
          setTimeout(() => backgroundCacheTrackSilently(track), 1200);
        }

        if (isCurrentlyActive && crossfadeDuration > 0) {
          const startTime = performance.now();
          const startOutVol = currentAudio.volume > 0 ? currentAudio.volume : targetVol;
          isFadingRef.current = true;
          isCrossfadingRef.current = true;

          updateAudioTransition({
            phase: "crossfading",
            source: triggerSource,
            targetDeck: nextDeckName,
            fromDeck: currentDeckName,
            targetTrack: track,
            fromTrack: prevTrack,
            progress: 0,
            durationMs: crossfadeDuration,
            startedAt: audioTransitionRef.current?.startedAt || Date.now(),
          });

          const finalizeCrossfade = () => {
            if (requestId !== playRequestIdRef.current) return;
            stopAllFades(true);
            if (currentAudio && activeDeckRef.current !== currentDeckName) {
              try {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio.volume = 0;
              } catch (e) {}
            }
            if (nextAudio) {
              nextAudio.volume = masterVolumeRef.current;
            }
            setDeckAVolume(Math.round((deckARef.current?.volume || 0) * 100));
            setDeckBVolume(Math.round((deckBRef.current?.volume || 0) * 100));
          };

          const step = (now) => {
            if (requestId !== playRequestIdRef.current) return;
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / crossfadeDuration, 1);
            const latestVol = masterVolumeRef.current;

            const inVol = latestVol * (progress < 1 ? Math.sin((progress * Math.PI) / 2) : 1);
            const outVol = startOutVol * Math.cos((progress * Math.PI) / 2);

            if (nextAudio) nextAudio.volume = Math.max(0, Math.min(latestVol, inVol));
            if (currentAudio && !currentAudio.paused) {
              currentAudio.volume = Math.max(0, Math.min(startOutVol, outVol));
            }

            setDeckAVolume(Math.round((deckARef.current?.volume || 0) * 100));
            setDeckBVolume(Math.round((deckBRef.current?.volume || 0) * 100));
            updateTransitionProgressThrottled(progress * 100, now);

            if (progress < 1) {
              fadeAnimationRef.current = requestAnimationFrame(step);
            } else {
              finalizeCrossfade();
            }
          };

          fadeAnimationRef.current = requestAnimationFrame(step);
          registerFadeTimeout(finalizeCrossfade, crossfadeDuration + 80);
        } else if (!isCurrentlyActive && crossfadeDuration > 0) {
          // 정지 상태에서 새 트랙 재생 시에도 탭 설정 페이드인 적용 및 진행률 표시
          if (currentAudio) {
            try {
              currentAudio.pause();
              currentAudio.currentTime = 0;
              currentAudio.volume = 0;
            } catch (e) {}
          }
          nextAudio.volume = 0;
          const startTime = performance.now();
          isFadingRef.current = true;
          isCrossfadingRef.current = true;

          updateAudioTransition({
            phase: "fading-in",
            source: triggerSource,
            targetDeck: nextDeckName,
            fromDeck: null,
            targetTrack: track,
            fromTrack: null,
            progress: 0,
            durationMs: crossfadeDuration,
            startedAt: audioTransitionRef.current?.startedAt || Date.now(),
          });

          const finalizeFadeIn = () => {
            if (requestId !== playRequestIdRef.current) return;
            stopAllFades(true);
            if (nextAudio) nextAudio.volume = masterVolumeRef.current;
            setDeckAVolume(Math.round((deckARef.current?.volume || 0) * 100));
            setDeckBVolume(Math.round((deckBRef.current?.volume || 0) * 100));
          };

          const step = (now) => {
            if (requestId !== playRequestIdRef.current) return;
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / crossfadeDuration, 1);
            const latestVol = masterVolumeRef.current;
            const inVol = latestVol * (progress < 1 ? Math.sin((progress * Math.PI) / 2) : 1);
            if (nextAudio) nextAudio.volume = Math.max(0, Math.min(latestVol, inVol));
            setDeckAVolume(Math.round((deckARef.current?.volume || 0) * 100));
            setDeckBVolume(Math.round((deckBRef.current?.volume || 0) * 100));
            updateTransitionProgressThrottled(progress * 100, now);
            if (progress < 1) {
              fadeAnimationRef.current = requestAnimationFrame(step);
            } else {
              finalizeFadeIn();
            }
          };

          fadeAnimationRef.current = requestAnimationFrame(step);
          registerFadeTimeout(finalizeFadeIn, crossfadeDuration + 80);
        } else {
          if (currentAudio) {
            try {
              currentAudio.pause();
              currentAudio.currentTime = 0;
              currentAudio.volume = 0;
            } catch (e) {}
          }
          if (nextAudio) nextAudio.volume = masterVolumeRef.current;
          setDeckAVolume(Math.round((deckARef.current?.volume || 0) * 100));
          setDeckBVolume(Math.round((deckBRef.current?.volume || 0) * 100));
          updateAudioTransition(null);
        }
      })
      .catch((err) => {
        if (requestId !== playRequestIdRef.current) return;
        clearLoadingWatchdogs();
        if (
          isCachedBlob &&
          remoteUrl &&
          !forceRemote &&
          err?.name !== "AbortError" &&
          err?.name !== "NotAllowedError"
        ) {
          const badKey = getAudioCacheKey(track);
          evictCachedAudioTrack(track).finally(() => {
            if (badKey) {
              setAudioCacheMap((prev) => {
                const next = { ...prev };
                delete next[badKey];
                return next;
              });
            }
            if (!ssdOnlyModeRef.current) {
              crossfadeToTrack(track, customDuration, triggerSource, { forceRemote: true });
            } else {
              updateAudioTransition(null);
            }
          });
          return;
        }
        updateAudioTransition(null);
        if (err.name === "AbortError") return;
        console.warn("[Dual-Deck Crossfade Error]:", err);
        message.warning("음원 재생 실패: " + err.message);
      });
  };

  // 🎵 트랙 재생 / 일시정지 (2중 클릭 방지 및 페이드인·아웃 진행 상태 표시)
  const handlePlayTrack = (track, triggerSource = "track") => {
    const playableUrl = getTrackAudioUrl(track);
    if (!track || !playableUrl) {
      message.error("재생 가능한 음원 URL이 없습니다.");
      return;
    }

    const activeTrans = audioTransitionRef.current;
    // 🔒 동일 트랙이 현재 다운로드(loading) 중이거나 페이드아웃 정지 중이면 2중 클릭 무시
    if (activeTrans && isTrackEqual(activeTrans.targetTrack, track)) {
      if (
        activeTrans.phase === "loading" ||
        activeTrans.phase === "fading-out"
      ) {
        return;
      }
      // 크로스페이드/페이드인 초기 무음 구간에서 반사적인 2중 클릭으로 일시정지되는 현상 차단 (1.5초 이후에는 수동 정지 허용)
      const guardMs = triggerSource === "track" ? 1500 : 900;
      if (
        (activeTrans.phase === "crossfading" ||
          activeTrans.phase === "fading-in") &&
        Date.now() - activeTrans.startedAt < guardMs
      ) {
        return;
      }
    }

    const isSameTrack = isTrackEqual(currentTrackRef.current, track);
    const curDeckName = activeDeckRef.current;
    const curAudio = curDeckName === "A" ? deckARef.current : deckBRef.current;
    const otherAudio = curDeckName === "A" ? deckBRef.current : deckARef.current;

    // 🛑 동일 트랙 토글: 일시정지 (2초 안전 감쇄 후 완전정지) ⇄ 다시재생 (2초 안전 페이드인)
    if (isSameTrack && curAudio) {
      if (isPlayingRef.current) {
        const requestId = ++playRequestIdRef.current;
        deckRequestIdRef.current = { A: 0, B: 0 };

        // 🔒 [일시정지] 1단계: 즉시 상태 잠금 및 모든 백그라운드 프리로드/타이머 차단
        setIsPlaying(false);
        isPlayingRef.current = false;
        stopAllFades(false);
        stopTracking();

        // 🛑 대기 데크 및 프리로드 즉시 완전 소거
        setPreCuedTrack(null);
        isPreCuedRef.current = false;
        preCuedTrackRef.current = null;
        if (otherAudio) {
          try {
            otherAudio.pause();
            otherAudio.currentTime = 0;
            otherAudio.volume = 0;
          } catch (e) {}
        }

        // 🔒 [일시정지] 2단계: 2.0초 동안 부드럽게 0으로 감쇄 후 확실하게 pause()
        const startVol = curAudio.volume > 0 ? curAudio.volume : masterVolumeRef.current;
        const startTime = performance.now();
        const fadeOutDuration = 2000; // 2.0초 고정
        isFadingRef.current = true;

        updateAudioTransition({
          phase: "fading-out",
          source: triggerSource,
          targetDeck: curDeckName,
          fromDeck: curDeckName,
          targetTrack: track,
          fromTrack: track,
          progress: 0,
          durationMs: fadeOutDuration,
          startedAt: Date.now(),
        });

        const finalizePause = () => {
          if (requestId !== playRequestIdRef.current) return;
          stopAllFades(true);
          if (curAudio) {
            try {
              curAudio.pause();
            } catch (e) {}
            curAudio.volume = masterVolumeRef.current;
          }
          updateRemoteNowPlaying(track, "pause");
          setDeckAVolume(activeDeckRef.current === "A" ? Math.round(masterVolumeRef.current * 100) : 0);
          setDeckBVolume(activeDeckRef.current === "B" ? Math.round(masterVolumeRef.current * 100) : 0);
        };

        if (curAudio.paused) {
          finalizePause();
          return;
        }

        const fadeOutStep = (now) => {
          if (requestId !== playRequestIdRef.current) return;
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / fadeOutDuration, 1);
          const newVol = startVol * Math.cos((progress * Math.PI) / 2);

          if (curAudio) {
            curAudio.volume = Math.max(0, Math.min(startVol, newVol));
          }

          setDeckAVolume(activeDeckRef.current === "A" ? Math.round((curAudio?.volume || 0) * 100) : 0);
          setDeckBVolume(activeDeckRef.current === "B" ? Math.round((curAudio?.volume || 0) * 100) : 0);
          updateTransitionProgressThrottled(progress * 100, now);

          if (progress < 1) {
            fadeAnimationRef.current = requestAnimationFrame(fadeOutStep);
          } else {
            finalizePause();
          }
        };

        fadeAnimationRef.current = requestAnimationFrame(fadeOutStep);
        registerFadeTimeout(finalizePause, fadeOutDuration + 80);
        return;
      } else {
        const requestId = ++playRequestIdRef.current;
        deckRequestIdRef.current[curDeckName] = requestId;
        deckRequestIdRef.current[curDeckName === "A" ? "B" : "A"] = 0;

        // 🔊 [다시재생] 1단계: 모든 잔여 페이드 정리 & 대기 데크 정지
        stopAllFades(false);
        if (otherAudio) {
          try {
            otherAudio.pause();
            otherAudio.currentTime = 0;
            otherAudio.volume = 0;
          } catch (e) {}
        }

        updateAudioTransition({
          phase: "loading",
          source: triggerSource,
          targetDeck: curDeckName,
          fromDeck: null,
          targetTrack: track,
          fromTrack: null,
          progress: 0,
          durationMs: 2000,
          startedAt: Date.now(),
        });

        // 🔊 [다시재생] 2단계: 0에서 시작하여 2.0초 동안 부드럽게 페이드인
        curAudio.volume = 0;
        curAudio
          .play()
          .then(() => {
            if (requestId !== playRequestIdRef.current) {
              if (deckRequestIdRef.current[curDeckName] !== playRequestIdRef.current || !isPlayingRef.current) {
                try {
                  curAudio.pause();
                  curAudio.volume = 0;
                } catch (e) {}
              }
              return;
            }

            setIsPlaying(true);
            isPlayingRef.current = true;
            startTracking();
            updateRemoteNowPlaying(track, "play");

            const startTime = performance.now();
            const fadeInDuration = 2000; // 2.0초 고정
            isFadingRef.current = true;

            updateAudioTransition({
              phase: "fading-in",
              source: triggerSource,
              targetDeck: curDeckName,
              fromDeck: null,
              targetTrack: track,
              fromTrack: null,
              progress: 0,
              durationMs: fadeInDuration,
              startedAt: audioTransitionRef.current?.startedAt || Date.now(),
            });

            const finalizeResume = () => {
              if (requestId !== playRequestIdRef.current) return;
              stopAllFades(true);
              const latestVol = masterVolumeRef.current;
              if (curAudio) curAudio.volume = latestVol;
              setDeckAVolume(activeDeckRef.current === "A" ? Math.round(latestVol * 100) : 0);
              setDeckBVolume(activeDeckRef.current === "B" ? Math.round(latestVol * 100) : 0);
            };

            const fadeInStep = (now) => {
              if (requestId !== playRequestIdRef.current) return;
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / fadeInDuration, 1);
              const latestVol = masterVolumeRef.current;
              const newVol = latestVol * Math.sin((progress * Math.PI) / 2);

              if (curAudio) {
                curAudio.volume = Math.max(0, Math.min(latestVol, newVol));
              }

              setDeckAVolume(activeDeckRef.current === "A" ? Math.round((curAudio?.volume || 0) * 100) : 0);
              setDeckBVolume(activeDeckRef.current === "B" ? Math.round((curAudio?.volume || 0) * 100) : 0);
              updateTransitionProgressThrottled(progress * 100, now);

              if (progress < 1) {
                fadeAnimationRef.current = requestAnimationFrame(fadeInStep);
              } else {
                finalizeResume();
              }
            };

            fadeAnimationRef.current = requestAnimationFrame(fadeInStep);
            registerFadeTimeout(finalizeResume, fadeInDuration + 80);
          })
          .catch((err) => {
            if (requestId !== playRequestIdRef.current) return;
            updateAudioTransition(null);
            if (err.name === "AbortError") return;
            message.error("음원 재생 실패: " + err.message);
          });
        return;
      }
    }

    // 🔀 다른 곡 선택 시 듀얼 데크 크로스페이드 실행
    crossfadeToTrack(track, undefined, triggerSource);
  };

  const handleSliderChange = (value) => {
    const curAudio = activeDeckRef.current === "A" ? deckARef.current : deckBRef.current;
    if (curAudio) {
      curAudio.currentTime = value;
      setCurrentTime(value);
    }
  };

  // 🏆 현재 무대 정보
  const currentStageCategory =
    realtimeStage?.categoryTitle ||
    realtimeStage?.categoryName ||
    realtimeStage?.contestCategoryTitle ||
    "";
  const currentStageGrade =
    realtimeStage?.gradeTitle ||
    realtimeStage?.gradeName ||
    realtimeStage?.contestGradeTitle ||
    "";
  const currentStageGender =
    realtimeStage?.categoryGender ||
    realtimeStage?.gender ||
    realtimeStage?.contestCategoryGender ||
    "";

  // 🎵 재생 활성 음원 풀 (SSD 전용 모드 시 SSD 저장 음원 + 특별 연출 자체 음원만 포함)
  const allAvailableTracks = useMemo(() => {
    return [...tracks, ...customTracks];
  }, [tracks, customTracks]);
  allAvailableTracksRef.current = allAvailableTracks;

  // 📦 사전 다운로드 매니저용 전체 원본 음원 풀 (미저장 음원 이어받기 지원)
  const allRawTracks = useMemo(() => {
    return [...rawTracks, ...customTracks];
  }, [rawTracks, customTracks]);
  allRawTracksRef.current = allRawTracks;

  // 📂 카테고리 탭 목록 생성 (공식 대표 종목 + 현재 대회 종목 + 로드된 트랙 + 특별 연출 통합)
  const categoryTabs = useMemo(() => {
    // 1. 기본 공식 대표 경기 종목 목록
    const defaultCategories = [
      "보디빌딩",
      "클래식보디빌딩",
      "클래식피지크",
      "피지크",
      "비키니",
      "스포츠모델",
      "피트니스모델",
      "피규어",
    ];

    // 2. 현재 대회 무대 진행표의 종목 목록 수집
    const stageCategories = contestStagesList
      .map((s) => s.categoryTitle || s.contestCategoryTitle || s.categoryName)
      .filter(Boolean);

    // 3. 실제 로드된 트랙의 종목 목록 수집
    const trackCategories = tracks
      .map((t) => (t.contest_category_kr || "").trim())
      .filter(Boolean);

    const allStandardCategoryNames = Array.from(
      new Set([...trackCategories, ...stageCategories, ...defaultCategories])
    ).filter(Boolean);

    const standardTabs = allStandardCategoryNames.map((name) => {
      const count = allAvailableTracks.filter((t) => {
        const cat = (t.contest_category_kr || t.category || t.folder || "").trim();
        return isCategoryMatched(cat, name) || cat === name || cat.includes(name) || name.includes(cat);
      }).length;

      return {
        name,
        count,
        isCustom: false,
      };
    });

    const customTabs = CUSTOM_CATEGORIES.map((cat) => {
      const count = customTracks.filter((t) =>
        isMatchingCustomTab(t, cat.name)
      ).length;
      return {
        name: cat.name,
        count,
        isCustom: true,
        icon: cat.icon,
        desc: cat.desc,
        tagColor: cat.tagColor,
      };
    });

    return [
      { name: "ALL", count: allAvailableTracks.length, isCustom: false },
      ...standardTabs,
      ...customTabs,
    ];
  }, [tracks, customTracks, allAvailableTracks, contestStagesList]);

  // 🎯 현재 무대와 가장 잘 매칭되는 VibeFlow 종목 탭 찾기
  const matchedVibeCategory = useMemo(() => {
    if (!currentStageCategory) return null;
    const direct = categoryTabs.find(
      (c) =>
        !c.isCustom &&
        c.name !== "ALL" &&
        isCategoryMatched(c.name, currentStageCategory, currentStageGender)
    );
    if (direct) return direct.name;

    const partial = categoryTabs.find(
      (c) =>
        !c.isCustom &&
        c.name !== "ALL" &&
        (c.name.includes(currentStageCategory) || currentStageCategory.includes(c.name))
    );
    return partial ? partial.name : null;
  }, [categoryTabs, currentStageCategory, currentStageGender]);
  matchedVibeCategoryRef.current = matchedVibeCategory;

  // 🎯 현재 무대 탭 자동 전환 필터
  const handleFilterCurrentStage = () => {
    if (matchedVibeCategory) {
      setSelectedCategoryTab(matchedVibeCategory);
      setSelectedDivision("ALL");
    } else {
      setSelectedCategoryTab("CURRENT_STAGE");
      setSelectedDivision("ALL");
    }
  };

  // 1단계: 카테고리(종목) 기준 1차 필터링된 음원 풀
  const categoryBaseTracks = useMemo(() => {
    if (selectedCategoryTab === "ALL") {
      return allAvailableTracks;
    }

    if (CUSTOM_CATEGORIES.some((c) => c.name === selectedCategoryTab)) {
      const matchedCustom = customTracks.filter((t) =>
        isMatchingCustomTab(t, selectedCategoryTab)
      );
      // 특별 연출 탭에 곡이 있으면 해당 곡 반환, 없더라도 전체에서 검색 가능하게 지원
      return matchedCustom.length > 0 ? matchedCustom : allAvailableTracks;
    }

    if (selectedCategoryTab === "CURRENT_STAGE") {
      if (!currentStageCategory) return allAvailableTracks;
      const matched = allAvailableTracks.filter((t) => {
        const cat = t.contest_category_kr || t.category || t.folder || "";
        return isCategoryMatched(cat, currentStageCategory, currentStageGender);
      });
      // 🌟 현재 무대 맞춤 곡이 있으면 우선 표시하되, 0곡이면 사람이 수동으로 틀 수 있도록 전체 음원 풀 반환
      return matched.length > 0 ? matched : allAvailableTracks;
    }

    const matched = allAvailableTracks.filter((t) => {
      const cat = (t.contest_category_kr || t.category || t.folder || "").trim();
      return isCategoryMatched(cat, selectedCategoryTab) || cat === selectedCategoryTab || cat.includes(selectedCategoryTab) || selectedCategoryTab.includes(cat);
    });

    // 🌟 선택된 종목에 곡이 없으면 전체 음원 목록을 보여주어 수동 선곡 가능하게 보장
    return matched.length > 0 ? matched : allAvailableTracks;
  }, [
    allAvailableTracks,
    tracks,
    customTracks,
    selectedCategoryTab,
    currentStageCategory,
    currentStageGender,
  ]);

  // 🏷️ 2단계: 현재 선택된 카테고리 내에서 존재하는 체급/부문(Division) 목록
  const availableDivisions = useMemo(() => {
    const divCounts = {};
    categoryBaseTracks.forEach((t) => {
      const div = (t.contest_division_kr || "공통 / 전체").trim();
      divCounts[div] = (divCounts[div] || 0) + 1;
    });

    const list = Object.entries(divCounts).map(([name, count]) => {
      const isCurrentMatch =
        currentStageGrade &&
        name !== "ALL" &&
        name !== "공통 / 전체" &&
        isDivisionMatched(name, currentStageGrade);

      return {
        name,
        count,
        isCurrentMatch,
      };
    });

    list.sort((a, b) => {
      if (a.isCurrentMatch && !b.isCurrentMatch) return -1;
      if (!a.isCurrentMatch && b.isCurrentMatch) return 1;
      return 0;
    });

    return list;
  }, [categoryBaseTracks, currentStageGrade]);

  // 📋 최종 렌더링용 필터링된 음원 리스트 (수동 선곡을 위해 전체 풀 상시 접근 가능)
  const filteredTracks = useMemo(() => {
    let list = categoryBaseTracks.filter((t) => {
      if (selectedDivision !== "ALL") {
        const tDiv = (t.contest_division_kr || "공통 / 전체").trim();
        if (tDiv !== selectedDivision) return false;
      }

      if (searchText) {
        const q = searchText.toLowerCase();
        const titleMatch = (t.title || t.name || "").toLowerCase().includes(q);
        const artistMatch = (t.artist || "").toLowerCase().includes(q);
        const catMatch = (t.contest_category_kr || t.category || "").toLowerCase().includes(q);
        const divMatch = (t.contest_division_kr || "").toLowerCase().includes(q);
        if (!titleMatch && !artistMatch && !catMatch && !divMatch) return false;
      }

      return true;
    });

    // 🌟 만약 필터 조건으로 인해 0곡이 된 경우, 수동 재생을 위해 전체 음원에서 검색어만 적용하여 폴백 제공
    if (list.length === 0 && allAvailableTracks.length > 0 && !searchText) {
      list = allAvailableTracks;
    }

    return list;
  }, [categoryBaseTracks, selectedDivision, searchText, allAvailableTracks]);
  filteredTracksRef.current = filteredTracks;

  // 🔄 탭 · 세부 체급(2단계 필터) · 검색어 변경 시 현재 리스트에 없는 기존 대기곡(Pre-Cue) 즉시 갱신
  useEffect(() => {
    const cued = preCuedTrackRef.current?.track;
    if (!cued) return;
    const stillInList =
      filteredTracks.length > 0 &&
      filteredTracks.some((t) => isTrackEqual(t, cued));
    if (!stillInList) {
      preCuedTrackRef.current = null;
      isPreCuedRef.current = false;
      setPreCuedTrack(null);
      if (!isCrossfadingRef.current && !isFadingRef.current) {
        const idleDeckName = activeDeckRef.current === "A" ? "B" : "A";
        const idleAudio = idleDeckName === "A" ? deckARef.current : deckBRef.current;
        if (idleAudio) {
          try {
            idleAudio.pause();
            idleAudio.removeAttribute("src");
            idleAudio.load();
            idleAudio.volume = 0;
          } catch {}
        }
      }
    }
  }, [selectedCategoryTab, selectedDivision, searchText, filteredTracks]);

  // ⏪ 이전 곡 재생 (로딩 지연 시에도 즉시 다른 곡 전환 가능)
  const handlePrevTrack = () => {
    const activeTrans = audioTransitionRef.current;
    if (
      activeTrans &&
      (activeTrans.phase === "fading-out" ||
        Date.now() - activeTrans.startedAt < 250)
    ) {
      return;
    }

    const list = filteredTracks.length > 0 ? filteredTracks : allAvailableTracks;
    if (!list || list.length === 0) {
      message.info("재생할 음원 목록이 없습니다.");
      return;
    }

    if (!currentTrack) {
      const target = list[0];
      crossfadeToTrack(target, getFadeDuration(target, null), "prev");
      return;
    }

    const currentIndex = list.findIndex((t) => isTrackEqual(t, currentTrack));
    let prevIndex = 0;
    if (currentIndex === -1) {
      prevIndex = 0;
    } else if (currentIndex > 0) {
      prevIndex = currentIndex - 1;
    } else {
      prevIndex = list.length - 1;
    }

    const targetTrack = list[prevIndex];
    if (!targetTrack) return;

    if (isTrackEqual(targetTrack, currentTrack)) {
      const curAudio = activeDeckRef.current === "A" ? deckARef.current : deckBRef.current;
      if (curAudio) {
        curAudio.currentTime = 0;
        if (!isPlaying) {
          handlePlayTrack(currentTrack, "prev");
        }
      }
      return;
    }

    crossfadeToTrack(
      targetTrack,
      getFadeDuration(targetTrack, currentTrackRef.current),
      "prev"
    );
  };

  // ⏩ 다음 곡 재생 (로딩 지연 시에도 즉시 다른 곡 전환 가능)
  const handleNextTrack = () => {
    const activeTrans = audioTransitionRef.current;
    if (
      activeTrans &&
      (activeTrans.phase === "fading-out" ||
        Date.now() - activeTrans.startedAt < 250)
    ) {
      return;
    }

    // 1. 대기 데크에 이미 프리로드된 트랙이 있다면 즉시 전환
    if (preCuedTrackRef.current && preCuedTrackRef.current.track) {
      playNextSeedTrack(false, false, undefined, "next");
      return;
    }

    const list = filteredTracks.length > 0 ? filteredTracks : allAvailableTracks;
    if (!list || list.length === 0) {
      message.info("재생할 음원 목록이 없습니다.");
      return;
    }

    if (!currentTrack) {
      const target = list[0];
      const tk = getTrackKey(target);
      if (tk && !playedTrackIdsRef.current.includes(tk)) {
        const nextPlayed = [...playedTrackIdsRef.current, tk];
        playedTrackIdsRef.current = nextPlayed;
        setPlayedTrackIds(nextPlayed);
      }
      crossfadeToTrack(target, getFadeDuration(target, null), "next");
      return;
    }

    const currentIndex = list.findIndex((t) => isTrackEqual(t, currentTrack));
    let nextIndex = 0;
    if (currentIndex === -1) {
      nextIndex = 0;
    } else {
      nextIndex = (currentIndex + 1) % list.length;
    }

    const targetTrack = list[nextIndex];
    if (!targetTrack) return;

    if (isTrackEqual(targetTrack, currentTrack)) {
      const curAudio = activeDeckRef.current === "A" ? deckARef.current : deckBRef.current;
      if (curAudio) {
        curAudio.currentTime = 0;
        if (!isPlaying) {
          handlePlayTrack(currentTrack, "next");
        }
      }
      return;
    }

    const tk = getTrackKey(targetTrack);
    if (tk && !playedTrackIdsRef.current.includes(tk)) {
      const nextPlayed = [...playedTrackIdsRef.current, tk];
      playedTrackIdsRef.current = nextPlayed;
      setPlayedTrackIds(nextPlayed);
    }

    crossfadeToTrack(
      targetTrack,
      getFadeDuration(targetTrack, currentTrackRef.current),
      "next"
    );
  };

  // 🌱 [시드 1] 1순위 정밀 매칭 풀
  const seed1Pool = useMemo(() => {
    if (!currentStageCategory || tracks.length === 0) return [];
    const isAdultPriority = isAdultPriorityCategory(currentStageCategory, currentStageGender);

    return tracks.filter((t) => {
      const matchCat = isCategoryMatched(t.contest_category_kr, currentStageCategory, currentStageGender);
      if (!matchCat) return false;

      if (isAdultPriority) {
        return isDivisionMatched(t.contest_division_kr, "성인부");
      }

      if (currentStageGrade) {
        return isDivisionMatched(t.contest_division_kr, currentStageGrade);
      }
      return true;
    });
  }, [tracks, currentStageCategory, currentStageGrade, currentStageGender]);
  seed1PoolRef.current = seed1Pool;

  // 🌿 [시드 2] 2순위 확장 매칭 풀
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
  seed2PoolRef.current = seed2Pool;

  // 🎲 다음 시드 음원 추출 알고리즘 (재생 중인 트랙 카테고리 우선 유지 + 최신 Ref 기반)
  const getNextSeedTrack = (
    currentPlayed = playedTrackIdsRef.current,
    options = {}
  ) => {
    const { isStageTransition = false } = options;
    const activeTrack = isStageTransition ? null : currentTrackRef.current;
    const playingCategory = String(
      activeTrack?.contest_category_kr ||
        activeTrack?.category ||
        activeTrack?.folder ||
        ""
    ).trim();
    const effectiveCategory = playingCategory || selectedCategoryTabRef.current;

    const customPool = customTracksRef.current;
    const standardPool = tracksRef.current;
    const s1Pool = seed1PoolRef.current;
    const s2Pool = seed2PoolRef.current;
    const activeFilteredList = filteredTracksRef.current;

    // 0. 사용자가 2단계 세부 부문/체급 필터(예: 마스터즈부, 학생부 등), 검색어, 또는 타 종목 탭을 명시 선택한 경우
    //    화면에 표시된 해당 리스트(filteredTracks) 안에 있는 곡들만 다음 곡/연속 재생에 진입하도록 엄격 제한
    const hasExplicitListFilter =
      !isStageTransition &&
      activeFilteredList.length > 0 &&
      (selectedDivisionRef.current !== "ALL" ||
        Boolean(searchTextRef.current && searchTextRef.current.trim()) ||
        (selectedCategoryTabRef.current !== "ALL" &&
          selectedCategoryTabRef.current !== "CURRENT_STAGE" &&
          selectedCategoryTabRef.current !== matchedVibeCategoryRef.current));

    if (hasExplicitListFilter) {
      const unplayedInList = activeFilteredList.filter(
        (t) =>
          !currentPlayed.includes(getTrackKey(t)) &&
          (!activeTrack || !isTrackEqual(t, activeTrack))
      );
      if (unplayedInList.length > 0) {
        const randomIndex = Math.floor(Math.random() * unplayedInList.length);
        return {
          track: unplayedInList[randomIndex],
          seedLevel: selectedDivisionRef.current !== "ALL" ? 1 : 2,
          isExhausted: false,
        };
      }
      const otherInList = activeTrack
        ? activeFilteredList.filter((t) => !isTrackEqual(t, activeTrack))
        : activeFilteredList;
      const pool = otherInList.length > 0 ? otherInList : activeFilteredList;
      const randomIndex = Math.floor(Math.random() * pool.length);
      return {
        track: pool[randomIndex],
        seedLevel: selectedDivisionRef.current !== "ALL" ? 1 : 2,
        isReset: true,
      };
    }

    // 1. 자체 커스텀 음원 재생 중이거나(비-무대전환), 무재생 상태에서 커스텀 탭 선택 중인 경우
    const isPlayingCustom = !isStageTransition && activeTrack && isCustomTrack(activeTrack);
    const isIdleOnCustomTab =
      !isStageTransition &&
      !activeTrack &&
      CUSTOM_CATEGORIES.some((c) => c.name === effectiveCategory);

    if (isPlayingCustom || isIdleOnCustomTab) {
      const matchedCustomCat = activeTrack
        ? CUSTOM_CATEGORIES.find((c) => isMatchingCustomTab(activeTrack, c.name))?.name
        : null;
      const targetFolder = (
        matchedCustomCat ||
        effectiveCategory ||
        "시상식때의 음악"
      ).trim();

      const folderTracks = customPool.filter((t) =>
        isMatchingCustomTab(t, targetFolder)
      );

      if (folderTracks.length > 0) {
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

        const otherTracks = folderTracks.filter(
          (t) => getTrackKey(t) !== getTrackKey(activeTrack)
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

    // 2. 현재 재생 중인 경기 음원의 카테고리가 현재 무대 종목과 다를 경우, 재생 중인 카테고리 풀에서 우선 선곡
    if (
      !isStageTransition &&
      activeTrack &&
      playingCategory &&
      (!currentStageCategory ||
        !isCategoryMatched(playingCategory, currentStageCategory, currentStageGender))
    ) {
      const playingCategoryTracks = standardPool.filter((t) => {
        const cat = (t.contest_category_kr || t.category || t.folder || "").trim();
        return (
          isCategoryMatched(cat, playingCategory) ||
          cat === playingCategory ||
          (cat && (cat.includes(playingCategory) || playingCategory.includes(cat)))
        );
      });

      if (playingCategoryTracks.length > 0) {
        const unplayed = playingCategoryTracks.filter(
          (t) => !currentPlayed.includes(getTrackKey(t))
        );
        if (unplayed.length > 0) {
          const randomIndex = Math.floor(Math.random() * unplayed.length);
          return { track: unplayed[randomIndex], seedLevel: 2, isExhausted: false };
        }
        const otherTracks = playingCategoryTracks.filter(
          (t) => getTrackKey(t) !== getTrackKey(activeTrack)
        );
        const pool = otherTracks.length > 0 ? otherTracks : playingCategoryTracks;
        const randomIndex = Math.floor(Math.random() * pool.length);
        return { track: pool[randomIndex], seedLevel: 2, isReset: true };
      }
    }

    // 3. 시드 1 & 시드 2 정밀 매칭 풀
    if (s1Pool.length > 0) {
      const unplayedSeed1 = s1Pool.filter(
        (t) => !currentPlayed.includes(getTrackKey(t))
      );
      if (unplayedSeed1.length > 0) {
        const randomIndex = Math.floor(Math.random() * unplayedSeed1.length);
        return { track: unplayedSeed1[randomIndex], seedLevel: 1, isExhausted: false };
      }
    }

    if (s2Pool.length > 0) {
      const unplayedSeed2 = s2Pool.filter(
        (t) => !currentPlayed.includes(getTrackKey(t))
      );
      if (unplayedSeed2.length > 0) {
        const randomIndex = Math.floor(Math.random() * unplayedSeed2.length);
        return { track: unplayedSeed2[randomIndex], seedLevel: 2, isExhausted: false };
      }
    }

    if (s1Pool.length > 0) {
      const otherS1 = activeTrack
        ? s1Pool.filter((t) => getTrackKey(t) !== getTrackKey(activeTrack))
        : s1Pool;
      const pool = otherS1.length > 0 ? otherS1 : s1Pool;
      const randomIndex = Math.floor(Math.random() * pool.length);
      return { track: pool[randomIndex], seedLevel: 1, isReset: true };
    } else if (s2Pool.length > 0) {
      const otherS2 = activeTrack
        ? s2Pool.filter((t) => getTrackKey(t) !== getTrackKey(activeTrack))
        : s2Pool;
      const pool = otherS2.length > 0 ? otherS2 : s2Pool;
      const randomIndex = Math.floor(Math.random() * pool.length);
      return { track: pool[randomIndex], seedLevel: 2, isReset: true };
    }

    // 4. 시드 3 폴백 (현재 재생 중인 트랙 카테고리 우선 → 필터링 목록 → 전체 트랙)
    let activeTabList = [];
    if (!isStageTransition && playingCategory) {
      activeTabList = standardPool.filter((t) => {
        const cat = (t.contest_category_kr || t.category || t.folder || "").trim();
        return (
          isCategoryMatched(cat, playingCategory) ||
          cat === playingCategory ||
          (cat && (cat.includes(playingCategory) || playingCategory.includes(cat)))
        );
      });
    }
    if (activeTabList.length === 0) {
      activeTabList =
        filteredTracksRef.current.length > 0
          ? filteredTracksRef.current
          : standardPool;
    }

    if (activeTabList.length > 0) {
      const unplayed = activeTabList.filter(
        (t) => !currentPlayed.includes(getTrackKey(t))
      );
      if (unplayed.length > 0) {
        const randomIndex = Math.floor(Math.random() * unplayed.length);
        return { track: unplayed[randomIndex], seedLevel: 3, isFallback: true };
      }
      const otherPool = activeTrack
        ? activeTabList.filter((t) => getTrackKey(t) !== getTrackKey(activeTrack))
        : activeTabList;
      const fallbackPool = otherPool.length > 0 ? otherPool : activeTabList;
      const randomIndex = Math.floor(Math.random() * fallbackPool.length);
      return { track: fallbackPool[randomIndex], seedLevel: 3, isReset: true };
    }

    return { track: null, seedLevel: null };
  };

  // 🎵 다음 시드 음원 재생 트리거
  const playNextSeedTrack = (
    isStageTransition = false,
    silent = false,
    customDuration,
    triggerSource = "autopilot",
    ssdSkipDepth = 0
  ) => {
    if (!isStageTransition && (triggerSource === "autopilot" || triggerSource === "next")) {
      const activeTrans = audioTransitionRef.current;
      if (
        activeTrans &&
        (activeTrans.phase === "fading-out" ||
          Date.now() - activeTrans.startedAt < 250)
      ) {
        return;
      }
    }

    const latestPlayed = playedTrackIdsRef.current;
    let nextTrackInfo = null;
    const cuedCandidate = preCuedTrackRef.current;
    const isCuedValidForActiveFilter =
      cuedCandidate?.track &&
      (filteredTracksRef.current.length === 0 ||
        filteredTracksRef.current.some((t) =>
          isTrackEqual(t, cuedCandidate.track)
        ));

    if (!isStageTransition && cuedCandidate?.track && isCuedValidForActiveFilter) {
      nextTrackInfo = cuedCandidate;
      preCuedTrackRef.current = null;
    } else {
      preCuedTrackRef.current = null;
      nextTrackInfo = getNextSeedTrack(isStageTransition ? [] : latestPlayed, {
        isStageTransition,
      });
    }

    const { track, seedLevel, isReset } = nextTrackInfo || {};

    if (!track) {
      if (!silent) message.warning("재생 가능한 음원 풀이 비어 있습니다.");
      return;
    }

    const trackKey = getTrackKey(track);
    const nextPlayed = isStageTransition || isReset
      ? (trackKey ? [trackKey] : [])
      : (trackKey ? [...latestPlayed, trackKey] : latestPlayed);

    playedTrackIdsRef.current = nextPlayed;
    setPlayedTrackIds(nextPlayed);
    setActiveSeedLevel(seedLevel);

    const effectiveDuration =
      customDuration !== undefined
        ? customDuration
        : getFadeDuration(track, currentTrackRef.current);

    crossfadeToTrack(
      track,
      effectiveDuration,
      isStageTransition ? "stage" : triggerSource,
      { ssdSkipDepth }
    );
  };

  getNextSeedTrackRef.current = getNextSeedTrack;
  playNextSeedTrackRef.current = playNextSeedTrack;

  // 🔄 [무대/종목 변경 감지 시] 스마트 오토파일럿 단일 트리거 엔진
  // 오직 실제 무대 식별자(stageId / categoryTitle + gradeTitle)가 변경되었을 때만 반응하며,
  // 의전/시상/개회식 등 특별 연출 음원 재생 중에는 절대 자동 중단하거나 탭을 강제 이동하지 않음
  const prevStageKeyRef = useRef("");
  const isInitialStageLoadedRef = useRef(false);

  useEffect(() => {
    if (!currentStageCategory) return;

    const stageIdPart = realtimeStage?.stageId || "";
    const stageNumber = realtimeStage?.stageNumber || realtimeStage?.contestStageNumber || 0;
    const stageKey = `${stageIdPart}_${realtimeStage?.categoryId || ""}_${realtimeStage?.gradeId || ""}_${stageNumber}_${currentStageCategory}_${currentStageGrade}`;

    if (!isInitialStageLoadedRef.current) {
      isInitialStageLoadedRef.current = true;
      prevStageKeyRef.current = stageKey;
      if (!isPlayingRef.current) {
        const initialTargetCat = matchedVibeCategoryRef.current || "CURRENT_STAGE";
        setSelectedCategoryTab(initialTargetCat);
        setSelectedDivision("ALL");
      }
      return;
    }

    // 무대 식별자가 실제로 바뀌지 않았다면 탭 스냅 및 자동 재생 절대 금지
    if (stageKey === prevStageKeyRef.current) return;
    prevStageKeyRef.current = stageKey;

    // 국민의례/시상식/내빈소개/오프닝/개회식 등 특별 연출 음원이 재생 중이면 음악 끊김 및 탭 전환 차단
    if (isPlayingRef.current && isProtectedCeremonyTrack(currentTrackRef.current)) {
      return;
    }

    const targetCat = matchedVibeCategoryRef.current || "CURRENT_STAGE";
    setSelectedCategoryTab(targetCat);
    setSelectedDivision("ALL");

    playedTrackIdsRef.current = [];
    setPlayedTrackIds([]);
    isPreCuedRef.current = false;
    preCuedTrackRef.current = null;
    setPreCuedTrack(null);

    if (stageAutoPlayTimeoutRef.current) {
      clearTimeout(stageAutoPlayTimeoutRef.current);
      stageAutoPlayTimeoutRef.current = null;
    }

    if (isAutoPlayRef.current) {
      stageAutoPlayTimeoutRef.current = setTimeout(() => {
        stageAutoPlayTimeoutRef.current = null;
        if (!isAutoPlayRef.current) return;
        if (isPlayingRef.current && isProtectedCeremonyTrack(currentTrackRef.current)) {
          return;
        }
        if (tracksRef.current.length > 0 && playNextSeedTrackRef.current) {
          playNextSeedTrackRef.current(true, true);
        }
      }, 50);
    }

    return () => {
      if (stageAutoPlayTimeoutRef.current) {
        clearTimeout(stageAutoPlayTimeoutRef.current);
        stageAutoPlayTimeoutRef.current = null;
      }
    };
  }, [
    realtimeStage?.stageId,
    realtimeStage?.stageNumber,
    realtimeStage?.contestStageNumber,
    realtimeStage?.categoryId,
    realtimeStage?.gradeId,
    currentStageCategory,
    currentStageGrade,
  ]);

  // 🔁 [곡 완주 시 다음 곡 자동 트리거 리스너 — 최신 Ref 참조로 스테일 클로저 완벽 차단]
  useEffect(() => {
    const a = deckARef.current;
    const b = deckBRef.current;

    const handleEnded = (e) => {
      const audio = e?.target;
      const activeAudio = activeDeckRef.current === "A" ? deckARef.current : deckBRef.current;

      if (audio !== activeAudio) return;
      if (!isPlayingRef.current) return;

      const activeCfg = getEffectiveTabConfig(currentTrackRef.current);
      if (activeCfg.autoNext && playNextSeedTrackRef.current) {
        playNextSeedTrackRef.current(false, false, undefined, "auto-ended");
      } else {
        playRequestIdRef.current += 1;
        deckRequestIdRef.current = { A: 0, B: 0 };
        stopAllFades(true);
        setIsPlaying(false);
        isPlayingRef.current = false;
        stopTracking();
        updateRemoteNowPlaying(currentTrackRef.current, "stop");
      }
    };

    if (a) a.addEventListener("ended", handleEnded);
    if (b) b.addEventListener("ended", handleEnded);

    return () => {
      if (a) a.removeEventListener("ended", handleEnded);
      if (b) b.removeEventListener("ended", handleEnded);
    };
  }, []);

  const cacheHeaderStats = useMemo(() => {
    const seen = new Set();
    let total = 0;
    let ready = 0;
    let ssdCached = 0;
    for (const t of allRawTracks) {
      const ck = getAudioCacheKey(t);
      if (!ck || seen.has(ck)) continue;
      seen.add(ck);
      total += 1;
      const mode = audioCacheMap[ck]?.mode;
      if (mode === "cached") {
        ssdCached += 1;
        ready += 1;
      } else if (mode === "warmed") {
        ready += 1;
      }
    }
    return { total, ready, ssdCached };
  }, [allRawTracks, audioCacheMap]);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#2563eb",
          colorBgContainer: "#19191b",
          colorBgElevated: "#232325",
          colorBorder: "rgba(237,237,237,0.10)",
          colorText: "#ededed",
          colorTextSecondary: "#a1a1a6",
          colorTextTertiary: "#85858b",
          borderRadius: 8,
          fontFamily: "var(--font-sans)",
        },
      }}
    >
      <div className="min-h-screen bg-[#141415] text-[#ededed]">
        <AudioHeader
          currentStageCategory={currentStageCategory}
          isRemoteSync={isRemoteSync}
          setIsRemoteSync={setIsRemoteSync}
          ssdOnlyMode={ssdOnlyMode}
          setSsdOnlyMode={setSsdOnlyMode}
          ssdCachedCount={cacheHeaderStats.ssdCached}
          rawApiResponse={rawApiResponse}
          setIsRawModalOpen={setIsRawModalOpen}
          isLoadingTracks={isLoadingTracks}
          loadVibeFlowTracks={loadVibeFlowTracks}
          token={token}
          user={user}
          handleLogout={handleLogout}
          setIsLoginModalOpen={setIsLoginModalOpen}
          onOpenCacheModal={() => setIsCacheModalOpen(true)}
          totalTrackCount={cacheHeaderStats.total}
          readyTrackCount={cacheHeaderStats.ready}
          isBatchCaching={isBatchCaching}
          batchCacheProgress={batchCacheProgress}
        />

        <div className="w-full px-5 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5 xl:col-span-4 space-y-4">
              <AudioPlayerCard
                activeDeck={activeDeck}
                isPlaying={isPlaying}
                currentTrack={currentTrack}
                preCuedTrack={preCuedTrack}
                deckAVolume={deckAVolume}
                deckBVolume={deckBVolume}
                currentTabConfig={currentTabConfig}
                currentTime={currentTime}
                trackDuration={trackDuration}
                volume={volume}
                audioTransition={audioTransition}
                handleVolumeChange={handleVolumeChange}
                handleSmoothVolumeChange={handleSmoothVolumeChange}
                handleSliderChange={handleSliderChange}
                handlePlayTrack={handlePlayTrack}
                handlePrevTrack={handlePrevTrack}
                handleNextTrack={handleNextTrack}
                handleCancelLoading={handleCancelLoading}
              />

              <AudioTabControls
                volume={volume}
                handleVolumeChange={handleVolumeChange}
                handleSmoothVolumeChange={handleSmoothVolumeChange}
                selectedCategoryTab={selectedCategoryTab}
                currentTabConfig={currentTabConfig}
                updateTabFadeDuration={updateTabFadeDuration}
                updateTabAutoNext={updateTabAutoNext}
              />

              <AutopilotCard
                isAutoPlayOnStageChange={isAutoPlayOnStageChange}
                setIsAutoPlayOnStageChange={setIsAutoPlayOnStageChange}
                currentStageCategory={currentStageCategory}
                currentStageGrade={currentStageGrade}
                currentStageGender={currentStageGender}
                seed1Pool={seed1Pool}
                seed2Pool={seed2Pool}
                playedTrackIds={playedTrackIds}
                activeSeedLevel={activeSeedLevel}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                audioTransition={audioTransition}
                hasPlayableTracks={
                  filteredTracks.length > 0 || allAvailableTracks.length > 0
                }
                handlePlayTrack={handlePlayTrack}
                playNextSeedTrack={playNextSeedTrack}
                onOpenGuideModal={() => setIsGuideModalOpen(true)}
              />
            </div>

            <div className="lg:col-span-7 xl:col-span-8 bg-[#19191b] border border-[#ededed]/[0.08] rounded-[12px] p-5 space-y-5">
              <AudioCategoryTabs
                categoryTabs={categoryTabs}
                selectedCategoryTab={selectedCategoryTab}
                setSelectedCategoryTab={setSelectedCategoryTab}
                selectedDivision={selectedDivision}
                setSelectedDivision={setSelectedDivision}
                searchText={searchText}
                setSearchText={setSearchText}
                tracks={tracks}
                allAvailableTracks={allAvailableTracks}
                currentStageCategory={currentStageCategory}
                currentStageGrade={currentStageGrade}
                currentStageGender={currentStageGender}
                matchedVibeCategory={matchedVibeCategory}
                availableDivisions={availableDivisions}
                handleFilterCurrentStage={handleFilterCurrentStage}
                fileInputRef={fileInputRef}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                handleUploadCustomMusic={handleUploadCustomMusic}
              />

              <AudioTrackTable
                filteredTracks={filteredTracks}
                allAvailableTracks={allAvailableTracks}
                isLoadingTracks={isLoadingTracks}
                searchText={searchText}
                setSearchText={setSearchText}
                selectedCategoryTab={selectedCategoryTab}
                setSelectedCategoryTab={setSelectedCategoryTab}
                selectedDivision={selectedDivision}
                setSelectedDivision={setSelectedDivision}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                audioTransition={audioTransition}
                hasPlayableTracks={
                  filteredTracks.length > 0 || allAvailableTracks.length > 0
                }
                handlePlayTrack={handlePlayTrack}
                handleDeleteCustomMusic={handleDeleteCustomMusic}
                seed1Pool={seed1Pool}
                seed2Pool={seed2Pool}
                token={token}
                audioCacheMap={audioCacheMap}
              />
            </div>
          </div>
        </div>

        <AudioModals
          isLoginModalOpen={isLoginModalOpen}
          setIsLoginModalOpen={setIsLoginModalOpen}
          handleLogin={handleLogin}
          loginEmail={loginEmail}
          setLoginEmail={setLoginEmail}
          loginPassword={loginPassword}
          setLoginPassword={setLoginPassword}
          rememberLogin={rememberLogin}
          setRememberLogin={setRememberLogin}
          isLoggingIn={isLoggingIn}
          isRawModalOpen={isRawModalOpen}
          setIsRawModalOpen={setIsRawModalOpen}
          rawApiResponse={rawApiResponse}
          isGuideModalOpen={isGuideModalOpen}
          setIsGuideModalOpen={setIsGuideModalOpen}
          isCacheModalOpen={isCacheModalOpen}
          setIsCacheModalOpen={setIsCacheModalOpen}
          allAvailableTracks={allRawTracks}
          ssdOnlyMode={ssdOnlyMode}
          setSsdOnlyMode={setSsdOnlyMode}
          audioCacheMap={audioCacheMap}
          isBatchCaching={isBatchCaching}
          batchCacheProgress={batchCacheProgress}
          handleStartBatchCache={handleStartBatchCache}
          handleCancelBatchCache={handleCancelBatchCache}
          handleCacheSingleTrack={handleCacheSingleTrack}
          handleClearAudioCache={handleClearAudioCache}
        />
        <ConfirmationModal
          isOpen={noticeOpen}
          message={noticeMessage}
          onCancel={() => setNoticeOpen(false)}
          onConfirm={() => setNoticeOpen(false)}
        />
      </div>
    </ConfigProvider>
  );
};

export default VibeFlowAudioCenter;
