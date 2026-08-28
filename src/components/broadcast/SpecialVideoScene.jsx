"use client";

import React, { useEffect, useRef, useState } from "react";
import { getStoredVideoBlobUrl } from "../../utils/indexedDbVideoStorage";

/**
 * 🎬 SpecialVideoScene.jsx
 * 
 * 전광판 특별영상 전체화면 단독 재생 컴포넌트
 * - 어떠한 자막이나 프레임 없이 화면 전체에 100% 꽉 차게 재생 (object-cover)
 * - IndexedDB 로컬 캐시 자동 연동 (사전 다운로드 시 0초 버퍼링 재생)
 * - 콘솔 원격 컨트롤 지원: 재생, 일시정지, 정지, 앞으로 10초, 뒤로 10초
 * - 사운드 토글(isAudioEnabled) 및 완주 지원
 */
const SpecialVideoScene = ({
  videoUrl,
  videoCommand = null,
  isAudioEnabled = false,
  onEnded,
}) => {
  const videoRef = useRef(null);
  const [playableSrc, setPlayableSrc] = useState(videoUrl || "");
  const lastCommandTimeRef = useRef(null);

  // IndexedDB 캐시된 로컬 Blob URL 우선 조회
  useEffect(() => {
    let isCancelled = false;

    const resolveVideoSource = async () => {
      if (!videoUrl) return;
      try {
        const cachedBlobUrl = await getStoredVideoBlobUrl(videoUrl);
        if (!isCancelled) {
          if (cachedBlobUrl) {
            setPlayableSrc(cachedBlobUrl);
          } else {
            setPlayableSrc(videoUrl);
          }
        }
      } catch {
        if (!isCancelled) setPlayableSrc(videoUrl);
      }
    };

    resolveVideoSource();

    return () => {
      isCancelled = true;
    };
  }, [videoUrl]);

  // 영상 소스 변경 시 즉시 로드 및 자동 재생
  useEffect(() => {
    const video = videoRef.current;
    if (video && playableSrc) {
      video.load();
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("[SpecialVideoScene] 자동 재생 오류:", err);
        });
      }
    }
  }, [playableSrc]);

  // 🎮 콘솔 원격 비디오 제어 명령 처리 (PLAY, PAUSE, STOP, SEEK_BACK_10, SEEK_FORWARD_10)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoCommand || !videoCommand.timestamp) return;
    if (lastCommandTimeRef.current === videoCommand.timestamp) return;

    lastCommandTimeRef.current = videoCommand.timestamp;
    const { action } = videoCommand;

    try {
      if (action === "PLAY") {
        video.play().catch((err) => console.warn("[SpecialVideoScene] 재생 실패:", err));
      } else if (action === "PAUSE") {
        video.pause();
      } else if (action === "STOP") {
        video.pause();
        video.currentTime = 0;
      } else if (action === "SEEK_BACK_10") {
        video.currentTime = Math.max(0, video.currentTime - 10);
      } else if (action === "SEEK_FORWARD_10") {
        const maxTime = video.duration || 99999;
        video.currentTime = Math.min(maxTime, video.currentTime + 10);
      }
    } catch (err) {
      console.warn("[SpecialVideoScene] 비디오 명령 처리 오류:", err);
    }
  }, [videoCommand]);

  return (
    <div className="relative w-screen h-screen bg-black flex items-center justify-center overflow-hidden select-none">
      {playableSrc ? (
        <video
          ref={videoRef}
          src={playableSrc}
          autoPlay
          playsInline
          loop
          muted={!isAudioEnabled}
          onEnded={onEnded}
          className="w-full h-full object-cover bg-black"
        />
      ) : (
        <div className="text-slate-500 font-mono text-sm">
          재생할 특별영상이 설정되지 않았습니다.
        </div>
      )}
    </div>
  );
};

export default SpecialVideoScene;
