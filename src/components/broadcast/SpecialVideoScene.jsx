"use client";

import React, { useEffect, useRef, useState } from "react";
import { getStoredVideoBlobUrl } from "../../utils/indexedDbVideoStorage";

/**
 * 🎬 SpecialVideoScene.jsx
 * 
 * 전광판 특별영상 전체화면 단독 재생 컴포넌트
 * - 어떠한 자막이나 꾸밈 없이 순수 비디오 전체화면 재생
 * - IndexedDB 로컬 캐시 자동 연동 (사전 다운로드 시 0초 버퍼링 재생)
 * - 사운드 토글(isAudioEnabled) 및 자동 반복/완주 지원
 */
const SpecialVideoScene = ({
  videoUrl,
  isAudioEnabled = false,
  onEnded,
}) => {
  const videoRef = useRef(null);
  const [playableSrc, setPlayableSrc] = useState(videoUrl || "");

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

  // 영상 소스 변경 시 즉시 로드 및 재생
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
          className="w-full h-full object-contain bg-black"
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
