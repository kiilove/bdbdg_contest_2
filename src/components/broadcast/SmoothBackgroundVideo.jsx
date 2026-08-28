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
  volume = 1.0,
}) => {
  const videoARef = useRef(null);
  const videoBRef = useRef(null);
  // "A" or "B" — 현재 화면에 보이는 활성 레이어
  const activeLayerRef = useRef("A");
  // 마지막으로 적용된 resolved URL (중복 전환 방지)
  const currentResolvedUrlRef = useRef("");
  // 크로스페이드 진행 중 플래그
  const isCrossfadingRef = useRef(false);
  // 워치독 인터벌 ID
  const watchdogARef = useRef(null);
  const watchdogBRef = useRef(null);

  const targetSrc = src || fallbackSrc || "";

  // ─── 비디오 재생 헬퍼 ───
  const forcePlay = useCallback((video) => {
    if (!video) return;
    video.muted = isMuted;
    video.defaultMuted = isMuted;
    video.volume = typeof volume === "number" ? Math.max(0, Math.min(1, volume)) : 1.0;
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
  }, [isMuted, volume]);

  // ─── EOF 리와인드 + 워치독 세팅 ───
  const setupLoopGuard = useCallback((video, watchdogRef) => {
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

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
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

  // ─── 핵심: src 변경 시 듀얼 버퍼 크로스페이드 ───
  useEffect(() => {
    let isCancelled = false;

    const performTransition = async () => {
      const resolvedUrl = await resolveUrl(targetSrc);
      if (isCancelled || !resolvedUrl) return;

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
          if (!isCancelled) forcePlay(videoA);
          videoA.removeEventListener("canplay", onFirstReady);
        };
        videoA.addEventListener("canplay", onFirstReady);
        forcePlay(videoA);
        setupLoopGuard(videoA, watchdogARef);
        return;
      }

      // 크로스페이드 진행 중이면 무시 (빠른 연속 전환 보호)
      if (isCrossfadingRef.current) return;
      isCrossfadingRef.current = true;

      // 활성/비활성 레이어 결정
      const isAActive = activeLayerRef.current === "A";
      const activeVideo = isAActive ? videoA : videoB;
      const nextVideo = isAActive ? videoB : videoA;
      const nextWatchdogRef = isAActive ? watchdogBRef : watchdogARef;
      const prevWatchdogRef = isAActive ? watchdogARef : watchdogBRef;

      // 1. 비활성 레이어에 새 영상 로드 (보이지 않는 상태)
      nextVideo.src = resolvedUrl;
      nextVideo.load();

      // 2. canplay 이벤트에서 크로스페이드 시작
      const onNextReady = () => {
        if (isCancelled) {
          isCrossfadingRef.current = false;
          return;
        }

        forcePlay(nextVideo);

        // CSS opacity 크로스페이드 (500ms)
        nextVideo.style.transition = "opacity 500ms ease-in-out";
        activeVideo.style.transition = "opacity 500ms ease-in-out";
        nextVideo.style.opacity = "1";
        activeVideo.style.opacity = "0";

        // 전환 완료 후 이전 레이어 정지
        setTimeout(() => {
          if (!isCancelled) {
            try {
              activeVideo.pause();
              activeVideo.removeAttribute("src");
              activeVideo.load(); // 메모리 해제
            } catch {}

            // 이전 워치독 정리
            if (prevWatchdogRef.current) {
              clearInterval(prevWatchdogRef.current);
              prevWatchdogRef.current = null;
            }
          }

          activeLayerRef.current = isAActive ? "B" : "A";
          currentResolvedUrlRef.current = resolvedUrl;
          isCrossfadingRef.current = false;
        }, 550);

        // 새 레이어에 워치독 설정
        setupLoopGuard(nextVideo, nextWatchdogRef);

        nextVideo.removeEventListener("canplay", onNextReady);
      };

      nextVideo.addEventListener("canplay", onNextReady);

      // 3초 타임아웃 안전장치 (canplay가 발생하지 않는 극단적 상황)
      setTimeout(() => {
        if (isCrossfadingRef.current && !isCancelled) {
          nextVideo.removeEventListener("canplay", onNextReady);
          onNextReady();
        }
      }, 3000);
    };

    performTransition();

    return () => {
      isCancelled = true;
    };
  }, [targetSrc, resolveUrl, forcePlay, setupLoopGuard]);

  // ─── 음소거/볼륨 실시간 반영 ───
  useEffect(() => {
    const active = activeLayerRef.current === "A" ? videoARef.current : videoBRef.current;
    if (!active) return;

    active.muted = Boolean(isMuted);
    active.defaultMuted = Boolean(isMuted);
    active.volume = typeof volume === "number" ? Math.max(0, Math.min(1, volume)) : 1.0;

    if (!isMuted) {
      active.muted = false;
      const p = active.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    }
  }, [isMuted, volume]);

  // ─── 언마운트 시 정리 ───
  useEffect(() => {
    return () => {
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
        muted={isMuted}
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
        muted={isMuted}
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
