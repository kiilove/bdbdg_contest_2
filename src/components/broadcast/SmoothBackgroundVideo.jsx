"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { getStoredVideoBlobUrl } from "../../utils/indexedDbVideoStorage";

/**
 * 🎬 듀얼 버퍼 크로스페이드 배경 비디오 렌더러
 *
 * 🚀 핵심 원리: <video> 태그 2개(Layer A / Layer B)를 항상 겹쳐서 렌더링
 * - src가 바뀌면 → 비활성 레이어에 새 영상을 미리 로드
 * - canplay 이벤트 확인 후 → CSS opacity 크로스페이드 (500ms)
 * - 이전 영상은 전환이 끝난 뒤에야 정지 → 끊김 0%
 * - 크롬 EOF 멈춤 방지: 0.12초 끝단 사전 리와인드 + 500ms 워치독
 */
export const SmoothBackgroundVideo = React.memo(({
  src,
  fallbackSrc,
  overlayGradient = "from-black/60 via-transparent to-black/50",
  gradientDirection = "bg-gradient-to-t",
  isMuted = true,
  muted,
  volume = 1.0,
}) => {
  const effectiveMuted = muted !== undefined ? Boolean(muted) : Boolean(isMuted);

  const videoARef = useRef(null);
  const videoBRef = useRef(null);
  // "A" or "B" — 현재 화면에 보이는 활성 레이어
  const activeLayerRef = useRef("A");
  // 마지막으로 적용된 resolved URL (중복 전환 방지)
  const currentResolvedUrlRef = useRef("");
  // 크로스페이드(불투명도 전환) 진행 중 플래그
  const isCrossfadingRef = useRef(false);
  // 최신 요청된 원본 URL 추적 (빠른 연속 전환 시 누락 방지)
  const latestTargetSrcRef = useRef("");
  const transitionSeqRef = useRef(0);
  const isMountedRef = useRef(true);

  // 진행 중인 비활성 레이어 로딩 취소 핸들러 & 페이드 완료 타이머
  const pendingLoadCleanupRef = useRef(null);
  const fadeSettleTimeoutRef = useRef(null);
  const runTransitionRef = useRef(null);

  // 워치독 인터벌 ID 및 루프 이벤트 정리 함수
  const watchdogARef = useRef(null);
  const watchdogBRef = useRef(null);
  const loopCleanupARef = useRef(null);
  const loopCleanupBRef = useRef(null);

  // 음소거/볼륨 최신값 Ref (전환 중 토글 시에도 트랜지션 재실행 없이 즉시 반영)
  const effectiveMutedRef = useRef(effectiveMuted);
  const volumeRef = useRef(volume);
  effectiveMutedRef.current = effectiveMuted;
  volumeRef.current = volume;

  const targetSrc = src || fallbackSrc || "";
  latestTargetSrcRef.current = targetSrc;

  // ─── 비디오 재생 헬퍼 ───
  const forcePlay = useCallback((video, forceMuteOverride) => {
    if (!video) return;
    const shouldMute =
      forceMuteOverride !== undefined ? forceMuteOverride : effectiveMutedRef.current;
    const curVol = volumeRef.current;

    video.muted = shouldMute;
    video.defaultMuted = shouldMute;
    video.volume = typeof curVol === "number" ? Math.max(0, Math.min(1, curVol)) : 1.0;
    video.playsInline = true;
    video.loop = true;

    const p = video.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        try {
          video.muted = true;
          video.play().catch(() => {});
        } catch {}
      });
    }
  }, []);

  // ─── EOF 리와인드 + 워치독 세팅 ───
  const setupLoopGuard = useCallback((video, watchdogRef, cleanupHolderRef) => {
    if (cleanupHolderRef?.current) {
      cleanupHolderRef.current();
      cleanupHolderRef.current = null;
    }
    if (!video) return () => {};

    const restartLoop = () => {
      try {
        video.currentTime = 0;
        forcePlay(video);
      } catch {}
    };

    const onTimeUpdate = () => {
      if (video.duration > 0 && video.currentTime >= video.duration - 0.12) {
        restartLoop();
      }
    };

    const onEnded = () => restartLoop();

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);

    // 워치독: 500ms 주기
    let lastTime = -1;
    let staleCount = 0;

    if (watchdogRef.current) clearInterval(watchdogRef.current);
    watchdogRef.current = setInterval(() => {
      if (!video) return;
      const cur = video.currentTime;
      const dur = video.duration;

      if (dur > 0 && cur >= dur - 0.15) {
        restartLoop();
        return;
      }
      if (video.paused && !video.ended) {
        forcePlay(video);
        return;
      }
      if (cur > 0 && cur === lastTime) {
        staleCount++;
        if (staleCount >= 2) {
          restartLoop();
          staleCount = 0;
        }
      } else {
        staleCount = 0;
      }
      lastTime = cur;
    }, 500);

    const cleanup = () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
    };

    if (cleanupHolderRef) {
      cleanupHolderRef.current = cleanup;
    }
    return cleanup;
  }, [forcePlay]);

  // ─── URL 해석 (IndexedDB 캐시 → 원본 URL) ───
  const resolveUrl = useCallback(async (rawUrl) => {
    if (!rawUrl) return "";
    if (rawUrl.startsWith("http")) {
      try {
        const cached = await getStoredVideoBlobUrl(rawUrl);
        if (cached) return cached;
      } catch {}
    }
    return rawUrl;
  }, []);

  // ─── 트랜지션 실행기 (취소 복구 및 대기열 자동 후속 전환 지원) ───
  const executeTransition = useCallback(async (requestedRawSrc) => {
    if (!isMountedRef.current || !requestedRawSrc) return;

    // CSS 크로스페이드가 실제 진행 중(550ms 구간)이면 완료 후 최신 URL로 자동 이어서 전환됨
    if (isCrossfadingRef.current) return;

    // 아직 크로스페이드 시작 전(로딩 대기 중)인 이전 요청이 있으면 즉시 정리 후 새 URL 로드
    if (pendingLoadCleanupRef.current) {
      pendingLoadCleanupRef.current();
      pendingLoadCleanupRef.current = null;
    }

    const seq = ++transitionSeqRef.current;
    const resolvedUrl = await resolveUrl(requestedRawSrc);

    if (!isMountedRef.current || seq !== transitionSeqRef.current || !resolvedUrl) {
      return;
    }

    // 동일 URL이면 전환 불필요
    if (resolvedUrl === currentResolvedUrlRef.current) return;

    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB) return;

    // 첫 로드 (아직 아무것도 재생 중이 아닐 때)
    if (!currentResolvedUrlRef.current) {
      currentResolvedUrlRef.current = resolvedUrl;
      videoA.src = resolvedUrl;
      videoA.load();
      videoA.style.opacity = "1";
      videoB.style.opacity = "0";
      activeLayerRef.current = "A";

      const onFirstReady = () => {
        videoA.removeEventListener("canplay", onFirstReady);
        if (isMountedRef.current && activeLayerRef.current === "A") {
          forcePlay(videoA);
        }
      };
      videoA.addEventListener("canplay", onFirstReady);
      forcePlay(videoA);
      setupLoopGuard(videoA, watchdogARef, loopCleanupARef);

      // 첫 로드 도중 최신 URL이 또 변경되었다면 즉시 후속 전환 트리거
      if (latestTargetSrcRef.current && latestTargetSrcRef.current !== requestedRawSrc) {
        if (runTransitionRef.current) {
          runTransitionRef.current(latestTargetSrcRef.current);
        }
      }
      return;
    }

    // 다시 한번 크로스페이드 잠금 확인
    if (isCrossfadingRef.current) return;

    // 활성/비활성 레이어 결정
    const isAActive = activeLayerRef.current === "A";
    const activeVideo = isAActive ? videoA : videoB;
    const nextVideo = isAActive ? videoB : videoA;
    const nextWatchdogRef = isAActive ? watchdogBRef : watchdogARef;
    const nextLoopCleanupRef = isAActive ? loopCleanupBRef : loopCleanupARef;
    const prevLoopCleanupRef = isAActive ? loopCleanupARef : loopCleanupBRef;

    let safetyTimerId = null;
    let hasStartedFade = false;

    const cleanupPendingLoad = () => {
      nextVideo.removeEventListener("canplay", onNextReady);
      nextVideo.removeEventListener("error", onNextError);
      if (safetyTimerId) {
        clearTimeout(safetyTimerId);
        safetyTimerId = null;
      }
      if (!hasStartedFade) {
        isCrossfadingRef.current = false;
      }
    };

    const onNextError = () => {
      cleanupPendingLoad();
      if (pendingLoadCleanupRef.current === cleanupPendingLoad) {
        pendingLoadCleanupRef.current = null;
      }
      isCrossfadingRef.current = false;
      // 에러 발생 후 다른 최신 URL이 대기 중이라면 전환 시도
      if (
        isMountedRef.current &&
        latestTargetSrcRef.current &&
        latestTargetSrcRef.current !== requestedRawSrc &&
        runTransitionRef.current
      ) {
        runTransitionRef.current(latestTargetSrcRef.current);
      }
    };

    // 2. canplay 이벤트에서 크로스페이드 시작
    function onNextReady() {
      if (hasStartedFade) return;
      if (!isMountedRef.current || seq !== transitionSeqRef.current) {
        cleanupPendingLoad();
        if (pendingLoadCleanupRef.current === cleanupPendingLoad) {
          pendingLoadCleanupRef.current = null;
        }
        isCrossfadingRef.current = false;
        return;
      }

      hasStartedFade = true;
      isCrossfadingRef.current = true;
      cleanupPendingLoad();
      if (pendingLoadCleanupRef.current === cleanupPendingLoad) {
        pendingLoadCleanupRef.current = null;
      }

      forcePlay(nextVideo);

      // CSS opacity 크로스페이드 (500ms)
      nextVideo.style.transition = "opacity 500ms ease-in-out";
      activeVideo.style.transition = "opacity 500ms ease-in-out";
      nextVideo.style.opacity = "1";
      activeVideo.style.opacity = "0";

      // 새 레이어에 워치독 설정
      setupLoopGuard(nextVideo, nextWatchdogRef, nextLoopCleanupRef);

      // 전환 완료 후 이전 레이어 정지 및 대기 중인 최신 URL 확인
      if (fadeSettleTimeoutRef.current) {
        clearTimeout(fadeSettleTimeoutRef.current);
      }
      fadeSettleTimeoutRef.current = setTimeout(() => {
        fadeSettleTimeoutRef.current = null;
        if (!isMountedRef.current) {
          isCrossfadingRef.current = false;
          return;
        }

        // 이전 루프/워치독 먼저 정리 후 메모리 해제
        if (prevLoopCleanupRef.current) {
          prevLoopCleanupRef.current();
          prevLoopCleanupRef.current = null;
        }

        try {
          activeVideo.muted = true;
          activeVideo.pause();
          activeVideo.removeAttribute("src");
          activeVideo.load();
        } catch {}

        activeLayerRef.current = isAActive ? "B" : "A";
        currentResolvedUrlRef.current = resolvedUrl;
        isCrossfadingRef.current = false;

        // 크로스페이드 도중 새로운 URL로 변경 요청이 들어왔다면 즉시 후속 전환 수행!
        const newestRaw = latestTargetSrcRef.current;
        if (newestRaw && newestRaw !== requestedRawSrc && runTransitionRef.current) {
          runTransitionRef.current(newestRaw);
        }
      }, 550);
    }

    pendingLoadCleanupRef.current = cleanupPendingLoad;
    nextVideo.muted = true;
    nextVideo.addEventListener("canplay", onNextReady);
    nextVideo.addEventListener("error", onNextError);

    // 1. 비활성 레이어에 새 영상 로드 (보이지 않는 상태)
    nextVideo.src = resolvedUrl;
    nextVideo.load();

    // 3초 타임아웃 안전장치 (canplay가 지연되는 상황 방어)
    safetyTimerId = setTimeout(() => {
      safetyTimerId = null;
      if (!hasStartedFade && isMountedRef.current && seq === transitionSeqRef.current) {
        onNextReady();
      }
    }, 3000);
  }, [resolveUrl, forcePlay, setupLoopGuard]);

  runTransitionRef.current = executeTransition;

  // ─── 핵심: src 변경 시 듀얼 버퍼 크로스페이드 ───
  useEffect(() => {
    if (!targetSrc) return;
    executeTransition(targetSrc);

    return () => {
      // 아직 실제 opacity 크로스페이드가 시작되기 전(로딩 단계)에 URL이 바뀌면 즉시 취소 및 잠금 해제
      if (!isCrossfadingRef.current && pendingLoadCleanupRef.current) {
        pendingLoadCleanupRef.current();
        pendingLoadCleanupRef.current = null;
      }
    };
  }, [targetSrc, executeTransition]);

  // ─── 음소거/볼륨 실시간 반영 ───
  useEffect(() => {
    const isAActive = activeLayerRef.current === "A";
    const active = isAActive ? videoARef.current : videoBRef.current;
    const inactive = isAActive ? videoBRef.current : videoARef.current;

    if (inactive && !isCrossfadingRef.current) {
      inactive.muted = true;
      inactive.defaultMuted = true;
    }

    if (!active) return;

    active.muted = effectiveMuted;
    active.defaultMuted = effectiveMuted;
    active.volume = typeof volume === "number" ? Math.max(0, Math.min(1, volume)) : 1.0;

    if (!effectiveMuted) {
      active.muted = false;
      const p = active.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    }
  }, [effectiveMuted, volume]);

  // ─── 언마운트 시 정리 ───
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isCrossfadingRef.current = false;
      if (pendingLoadCleanupRef.current) {
        pendingLoadCleanupRef.current();
        pendingLoadCleanupRef.current = null;
      }
      if (fadeSettleTimeoutRef.current) {
        clearTimeout(fadeSettleTimeoutRef.current);
        fadeSettleTimeoutRef.current = null;
      }
      if (loopCleanupARef.current) {
        loopCleanupARef.current();
        loopCleanupARef.current = null;
      }
      if (loopCleanupBRef.current) {
        loopCleanupBRef.current();
        loopCleanupBRef.current = null;
      }
      if (watchdogARef.current) clearInterval(watchdogARef.current);
      if (watchdogBRef.current) clearInterval(watchdogBRef.current);
    };
  }, []);

  if (!targetSrc) return null;

  const videoStyle = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    pointerEvents: "none",
    transform: "translate3d(0, 0, 0)",
    willChange: "opacity, transform",
    backfaceVisibility: "hidden",
  };

  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 bg-black"
      style={{
        transform: "translate3d(0, 0, 0)",
        contain: "strict",
        isolation: "isolate",
        backfaceVisibility: "hidden",
      }}
    >
      {/* Layer A */}
      <video
        ref={videoARef}
        autoPlay
        loop
        muted={effectiveMuted}
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        style={{ ...videoStyle, opacity: 1 }}
      />
      {/* Layer B */}
      <video
        ref={videoBRef}
        autoPlay
        loop
        muted={effectiveMuted}
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        style={{ ...videoStyle, opacity: 0 }}
      />
      {overlayGradient && (
        <div className={`absolute inset-0 ${gradientDirection} ${overlayGradient} pointer-events-none`} style={{ zIndex: 2 }} />
      )}
    </div>
  );
});

export default SmoothBackgroundVideo;
