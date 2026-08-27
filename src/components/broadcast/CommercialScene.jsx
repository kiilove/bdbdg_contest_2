"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  TrophyOutlined,
  NotificationOutlined,
  StarFilled,
} from "@ant-design/icons";
import { prepareNextAd, recordAdImpression } from "../../utils/adEngine";
import { getStoredVideoBlobUrl } from "../../utils/indexedDbVideoStorage";
import defaultAwardVideo from "../../assets/mov/award2.mp4";
import defaultIntroVideo from "../../assets/mov/introduce.mp4";
import demoBodybuilderImg from "../../assets/img/demo_bodybuilder.jpg";

// 기본 공식 협찬사 프리셋 4종
export const DEFAULT_SPONSORS = [
  {
    id: "sp_def_1",
    name: "(주)인바디 (InBody)",
    slogan: "정밀 체성분 분석 공식 파트너",
    desc: "대한민국 대표 체성분 분석기 인바디와 함께합니다. 대회 현장의 정확한 계측과 데이터 분석을 지원합니다.",
    mediaType: "video",
    videoUrl: defaultAwardVideo,
    bgColor: "from-indigo-950 via-slate-900 to-black",
    accentColor: "text-blue-400",
    tag: "DIAMOND PARTNER",
    weight: 3,
  },
  {
    id: "sp_def_2",
    name: "MONSTER ENERGY",
    slogan: "UNLEASH THE BEAST • 한계를 뛰어넘는 에너지",
    desc: "무대 위 최고의 집중력과 폭발적인 에너지를 지원합니다. 대한민국 피트니스 선수들의 뜨거운 열정을 응원합니다.",
    mediaType: "image",
    imageUrl: demoBodybuilderImg,
    bgColor: "from-emerald-950 via-slate-900 to-black",
    accentColor: "text-emerald-400",
    tag: "OFFICIAL ENERGY DRINK",
    weight: 2,
  },
  {
    id: "sp_def_3",
    name: "HDEX (에이치덱스)",
    slogan: "FORGED FOR EXCELLENCE • 프리미엄 짐웨어",
    desc: "최고의 핏과 내구성, 대한민국 대표 피트니스 브랜드. 선수들의 완벽한 퍼포먼스를 위한 최고의 어패럴을 제공합니다.",
    mediaType: "video",
    videoUrl: defaultIntroVideo,
    bgColor: "from-slate-950 via-zinc-900 to-stone-900",
    accentColor: "text-amber-400",
    tag: "PLATINUM APPAREL",
    weight: 2,
  },
  {
    id: "sp_def_4",
    name: "골드짐 코리아 (GOLD'S GYM)",
    slogan: "월드 클래스 피트니스 센터 & 공식 트레이닝 파트너",
    desc: "세계적인 보디빌딩 & 피트니스 메카 골드짐. 챔피언들의 산실이자 최고의 트레이닝 환경을 약속합니다.",
    mediaType: "image",
    imageUrl: demoBodybuilderImg,
    bgColor: "from-amber-950 via-slate-900 to-black",
    accentColor: "text-amber-400",
    tag: "GOLD PARTNER",
    weight: 1,
  },
];

const CommercialScene = ({
  contestTitle,
  stageInfo,
  sponsors = [],
  isAudioEnabled = false,
}) => {
  // 사용자가 등록한 활성 광고 풀 (등록 광고가 없으면 기본 4종 협찬사 풀로 무한 로테이션)
  const basePool = useMemo(() => {
    const userActive = (sponsors || []).filter((ad) => ad.isActive !== false);
    if (userActive.length > 0) {
      return userActive;
    }
    return DEFAULT_SPONSORS;
  }, [sponsors]);

  const basePoolRef = useRef(basePool);
  basePoolRef.current = basePool;

  const videoRef = useRef(null);

  // 🎯 현재 송출 중인 광고
  const [currentAd, setCurrentAd] = useState(() =>
    prepareNextAd(basePool, null, "STAGE_LIVE", "COMMERCIAL") || basePool[0]
  );
  const currentAdRef = useRef(currentAd);
  currentAdRef.current = currentAd;

  // 🔄 10초마다 무한 전환을 보장하는 사이클 카운터
  const [adCycle, setAdCycle] = useState(0);

  // ⏱️ 10초(10,000ms) 프로그레스 타이머
  const [adProgress, setAdProgress] = useState(0);
  const adDurationMs = 10000; // 10초 보장

  const currentAdKey = currentAd?.id || currentAd?.name;

  const titleText =
    contestTitle || "2026 대한민국 보디빌딩 & 피트니스 챔피언십";
  const catTitle = stageInfo?.categoryTitle || "남자 클래식 보디빌딩";
  const grdTitle = stageInfo?.gradeTitle || "-75KG 체급";

  // 📈 광고 최초 및 교체 시 노출 카운트 1회 기록
  useEffect(() => {
    if (currentAdKey) {
      recordAdImpression("STAGE_LIVE", currentAdKey);
    }
  }, [currentAdKey]);

  // ⏱️ [핵심] 10초 타이머 & 2초 전(80% 시점) 광고엔진 질의 & 프리로드 & 무한 로테이션
  useEffect(() => {
    setAdProgress(0);
    let isPrefetched = false;
    let nextTarget = null;
    const startTime = Date.now();

    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progressPercent = Math.min((elapsed / adDurationMs) * 100, 100);
      setAdProgress(progressPercent);

      // 🌟 [2초 전 = 80% 도달 시]: 다음 광고 미리 질의 및 프리로드
      if (progressPercent >= 80 && !isPrefetched) {
        isPrefetched = true;
        nextTarget = prepareNextAd(
          basePoolRef.current,
          currentAdRef.current,
          "STAGE_LIVE",
          "COMMERCIAL"
        );
        if (nextTarget) {
          const mediaUrl =
            nextTarget.videoUrl || nextTarget.imageUrl || nextTarget.logoUrl;
          if (
            mediaUrl &&
            (nextTarget.mediaType === "image" || !nextTarget.videoUrl)
          ) {
            const img = new Image();
            img.src = mediaUrl;
          }
        }
      }

      // 🎯 [10초 완료 = 100% 도달 시]: 준비된 다음 광고로 즉시 전환 및 다음 사이클 구동
      if (elapsed >= adDurationMs) {
        clearInterval(progressTimer);
        const finalNext =
          nextTarget ||
          prepareNextAd(
            basePoolRef.current,
            currentAdRef.current,
            "STAGE_LIVE",
            "COMMERCIAL"
          ) ||
          basePoolRef.current[0];

        if (finalNext) {
          currentAdRef.current = finalNext;
          setCurrentAd(finalNext);
        }
        setAdCycle((prev) => prev + 1);
      }
    }, 50);

    return () => clearInterval(progressTimer);
  }, [adCycle]);

  // 🔊 비디오 광고 오디오 및 재생 제어
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isAudioEnabled;
      videoRef.current.defaultMuted = !isAudioEnabled;
      videoRef.current.volume = 1.0;
      videoRef.current.currentTime = 0;
      const playPromise = videoRef.current.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [currentAd, isAudioEnabled]);

  const rawMediaSrc =
    currentAd?.videoUrl ||
    currentAd?.mediaUrl ||
    currentAd?.imageUrl ||
    currentAd?.logoUrl;

  const [mediaSrc, setMediaSrc] = useState(rawMediaSrc);

  useEffect(() => {
    let isCancelled = false;
    const resolveCached = async () => {
      if (!rawMediaSrc) {
        if (!isCancelled) setMediaSrc("");
        return;
      }
      if (typeof rawMediaSrc === "string" && rawMediaSrc.startsWith("http")) {
        try {
          const cachedBlobUrl = await getStoredVideoBlobUrl(rawMediaSrc);
          if (!isCancelled && cachedBlobUrl) {
            setMediaSrc(cachedBlobUrl);
            return;
          }
        } catch {}
      }
      if (!isCancelled) setMediaSrc(rawMediaSrc);
    };
    resolveCached();
    return () => {
      isCancelled = true;
    };
  }, [rawMediaSrc]);

  const isVideoAd =
    currentAd?.mediaType === "VIDEO" ||
    currentAd?.mediaType === "video" ||
    !!currentAd?.videoUrl ||
    (typeof mediaSrc === "string" &&
      /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(mediaSrc));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-transparent text-white select-none flex items-center justify-center p-4 sm:p-6 lg:p-8">
      
      {/* ========================================================================================= */}
      {/* 📺 90% 플로팅 메인 스폰서 쇼케이스 무대 박스 (대기화면 배경 비디오 위 중앙 배치) */}
      {/* ========================================================================================= */}
      <div className="relative w-full max-w-[94vw] h-[88vh] max-h-[900px] flex flex-col justify-between rounded-3xl overflow-hidden bg-slate-950/90 border-2 border-amber-400/60 shadow-[0_30px_90px_rgba(0,0,0,0.95)] z-10">
        
        {/* ======================= [ 1. 상단 공식 헤더 & 10초 타이머 ] ======================= */}
        <div className="bg-black/85 px-6 py-3.5 border-b border-white/15 flex items-center justify-between z-20 shrink-0">
          
          {/* 좌측: 공식 스폰서 쇼케이스 & 대회 타이틀 */}
          <div className="flex items-center gap-3 min-w-0 max-w-[55vw]">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 text-lg shadow-lg shrink-0">
              <TrophyOutlined />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-[10px] sm:text-xs font-mono font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <NotificationOutlined className="animate-pulse" />
                <span>OFFICIAL SPONSOR SHOWCASE • 공식 협찬사</span>
              </div>
              <h1 className="text-sm sm:text-base lg:text-lg font-black text-white m-0 tracking-tight leading-tight truncate">
                {titleText}
              </h1>
            </div>
          </div>

          {/* 우측: 현재 무대 정보 & 채점 집계중 & 10초 로테이션 타이머 */}
          <div className="flex items-center gap-3 shrink-0">
            {/* 종목 & 체급 뱃지 */}
            <div className="hidden md:flex items-center gap-2 bg-slate-900/90 px-3.5 py-1.5 rounded-xl border border-white/15 text-xs font-bold text-slate-200">
              <span className="truncate max-w-[140px]">{catTitle}</span>
              {grdTitle && (
                <span className="text-amber-400 font-mono font-black">{grdTitle}</span>
              )}
            </div>

            {/* 채점 집계중 안내 */}
            <div className="hidden sm:flex items-center gap-2 bg-amber-500/20 px-3.5 py-1.5 rounded-xl border border-amber-400/40 text-amber-300 text-xs font-black">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>점수 집계 진행중</span>
            </div>

            {/* 10초 카운트다운 게이지 뱃지 */}
            <div className="flex items-center gap-2 bg-black/80 px-3.5 py-1.5 rounded-xl border border-white/20 text-xs font-mono">
              <span className="text-slate-400 font-bold">10초 로테이션</span>
              <span className="text-amber-400 font-black text-sm">
                {Math.max(1, Math.ceil((adDurationMs - (adDurationMs * adProgress) / 100) / 1000))}s
              </span>
            </div>
          </div>

        </div>

        {/* 📏 10초 상단 골드 프로그레스 바 */}
        <div className="w-full bg-black/60 h-1.5 z-20 shrink-0 overflow-hidden border-b border-white/10">
          <div
            className="bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-400 h-full transition-all duration-75 ease-linear shadow-[0_0_15px_rgba(251,191,36,0.9)]"
            style={{ width: `${adProgress}%` }}
          />
        </div>

        {/* ======================= [ 2. 중앙 메인 미디어 상영관 ] ======================= */}
        <div className="relative flex-1 w-full h-full overflow-hidden bg-slate-950 flex items-center justify-center">
          {isVideoAd && mediaSrc ? (
            <video
              ref={videoRef}
              key={`comm-v-${currentAd?.id || currentAd?.name}`}
              src={mediaSrc}
              autoPlay
              loop
              muted={!isAudioEnabled}
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
              {mediaSrc ? (
                <>
                  {/* 배경을 채워주는 은은한 블러 앰비언트 백드롭 */}
                  <img
                    src={mediaSrc}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-110 pointer-events-none"
                  />

                  {/* 전면 센터 정렬: 원본 비율 100% 완전 보존 (잘림 0% 보장) */}
                  <img
                    key={`comm-img-${currentAd?.id || currentAd?.name}`}
                    src={mediaSrc}
                    alt={currentAd?.name}
                    className="relative z-1 max-h-[78%] max-w-[85%] object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.95)] animate-fade-in"
                  />
                </>
              ) : (
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${
                    currentAd?.bgColor || "from-slate-900 via-indigo-950 to-black"
                  }`}
                />
              )}
            </div>
          )}

          {/* ======================= [ 3. 하단 스폰서 상세 정보 오버레이 바 ] ======================= */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7 bg-gradient-to-t from-black via-black/85 to-transparent z-10 text-left flex flex-col lg:flex-row items-end justify-between gap-4 pointer-events-none">
            
            <div className="space-y-1 max-w-3xl">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md">
                  <StarFilled className="text-[10px]" />
                  {currentAd?.tag || "OFFICIAL SPONSOR"}
                </span>
                <span className="text-xs font-bold text-slate-300 font-mono">
                  {titleText} 공식 파트너
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white m-0 tracking-tight leading-tight drop-shadow-md">
                {currentAd?.name}
              </h2>

              {currentAd?.slogan && (
                <p className="text-sm sm:text-base font-extrabold text-amber-300 m-0 line-clamp-1 drop-shadow-md">
                  {currentAd.slogan}
                </p>
              )}

              {currentAd?.desc && (
                <p className="text-xs sm:text-sm font-bold text-slate-300/90 m-0 line-clamp-2 max-w-2xl pt-0.5">
                  {currentAd.desc}
                </p>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-2.5 bg-black/70 px-4 py-2 rounded-xl border border-white/15 text-xs text-slate-300 shrink-0 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-mono font-bold text-amber-300">NEXT AD</span>
              <span className="font-mono text-slate-400 font-semibold">
                {Math.max(1, Math.ceil((adDurationMs - (adDurationMs * adProgress) / 100) / 1000))}s
              </span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

export default CommercialScene;
