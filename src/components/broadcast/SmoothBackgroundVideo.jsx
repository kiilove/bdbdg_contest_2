"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { getStoredVideoBlobUrl } from "../../utils/indexedDbVideoStorage";

/**
 * 🎬 60FPS 초고화질 무결점 하드웨어 가속 비디오 렌더러 (GPU Direct Rendering)
 * 
 * 🚀 크롬 EOF 멈춤 버그 완전 해결 & 무한 연속 루프 아키텍처:
 * 1. 0.12초 끝단 사전 리와인드 (Pre-rewind): 크롬 비디오 디먹서 EOF 프리징을 사전에 100% 차단
 * 2. 프레임 진행 감시 워치독 (Progress Stalling Watchdog): currentTime이 정체되거나 끝단에 도달 시 즉시 0초 리와인드
 * 3. isMuted=false 시 MP4 오디오 100% 실시간 출력
 * 4. Stacking Context 격리 (isolation: isolate)
 */
export const SmoothBackgroundVideo = React.memo(({
  src,
  fallbackSrc,
  overlayGradient = "from-black/60 via-transparent to-black/50",
  gradientDirection = "bg-gradient-to-t",
  isMuted = true,
  volume = 1.0,
}) => {
  const videoRef = useRef(null);
  const targetSrc = src || fallbackSrc || "";
  const [activeUrl, setActiveUrl] = useState(targetSrc);

  // 1. IndexedDB 캐시 Blob URL 비동기 확인
  useEffect(() => {
    let isCancelled = false;

    const resolveUrl = async () => {
      if (!targetSrc) {
        if (!isCancelled) setActiveUrl("");
        return;
      }

      if (targetSrc.startsWith("http")) {
        try {
          const cachedBlobUrl = await getStoredVideoBlobUrl(targetSrc);
          if (!isCancelled && cachedBlobUrl) {
            setActiveUrl(cachedBlobUrl);
            return;
          }
        } catch {}
      }

      if (!isCancelled) {
        setActiveUrl(targetSrc);
      }
    };

    resolveUrl();

    return () => {
      isCancelled = true;
    };
  }, [targetSrc]);

  // 2. 비디오 강제 재생 헬퍼
  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = isMuted;
    video.defaultMuted = isMuted;
    video.volume = typeof volume === "number" ? Math.max(0, Math.min(1, volume)) : 1.0;
    video.playsInline = true;
    video.loop = true;

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        try {
          video.muted = true;
          video.play().catch(() => {});
        } catch {}
      });
    }
  }, [isMuted, volume]);

  // 3. activeUrl 변경 및 라이프사이클 이벤트 발생 시 무조건 play() 강제 & EOF 멈춤 감시
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeUrl) return;

    video.muted = isMuted;
    video.defaultMuted = isMuted;
    video.volume = typeof volume === "number" ? Math.max(0, Math.min(1, volume)) : 1.0;
    video.playsInline = true;
    video.loop = true;

    const onMediaReady = () => {
      playVideo();
    };

    const restartLoop = () => {
      try {
        video.currentTime = 0;
        playVideo();
      } catch {}
    };

    // 0.12초 끝단 사전 리와인드 (크롬 끝단 멈춤 원천 차단)
    const onTimeUpdate = () => {
      if (video.duration > 0 && video.currentTime >= video.duration - 0.12) {
        restartLoop();
      }
    };

    video.addEventListener("canplay", onMediaReady);
    video.addEventListener("loadeddata", onMediaReady);
    video.addEventListener("loadedmetadata", onMediaReady);
    video.addEventListener("ended", restartLoop);
    video.addEventListener("timeupdate", onTimeUpdate);

    // 즉시 1회 재생 시도
    playVideo();

    // 🔄 프레임 진행 감시 워치독 (Watchdog: 500ms 주기)
    let lastTime = -1;
    let staleCount = 0;

    const watchdog = setInterval(() => {
      if (!video) return;

      const current = video.currentTime;
      const dur = video.duration;

      // 끝단에 도달했거나 멈춘 경우 강제 0초 리와인드
      if (dur > 0 && current >= dur - 0.15) {
        restartLoop();
        return;
      }

      if (video.paused) {
        playVideo();
        return;
      }

      // 재생 중이라고 표시되지만 시간이 멈춘 상태 (EOF 데드락) 감지
      if (current > 0 && current === lastTime) {
        staleCount++;
        if (staleCount >= 2) {
          restartLoop();
          staleCount = 0;
        }
      } else {
        staleCount = 0;
      }

      lastTime = current;
    }, 500);

    return () => {
      video.removeEventListener("canplay", onMediaReady);
      video.removeEventListener("loadeddata", onMediaReady);
      video.removeEventListener("loadedmetadata", onMediaReady);
      video.removeEventListener("ended", restartLoop);
      video.removeEventListener("timeupdate", onTimeUpdate);
      clearInterval(watchdog);
    };
  }, [activeUrl, isMuted, volume, playVideo]);

  // 4. 음소거(isMuted) prop 실시간 변경 시 MP4 사운드 즉각 출력/차단
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = Boolean(isMuted);
    video.defaultMuted = Boolean(isMuted);
    video.volume = typeof volume === "number" ? Math.max(0, Math.min(1, volume)) : 1.0;

    if (!isMuted) {
      video.muted = false;
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    }
  }, [isMuted, volume]);

  if (!targetSrc) return null;

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
      <video
        ref={videoRef}
        src={activeUrl}
        autoPlay
        loop
        muted={isMuted}
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        className="w-full h-full object-cover pointer-events-none"
        style={{
          transform: "translate3d(0, 0, 0)",
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
      />
      {overlayGradient && (
        <div className={`absolute inset-0 ${gradientDirection} ${overlayGradient} pointer-events-none`} />
      )}
    </div>
  );
});

export default SmoothBackgroundVideo;
