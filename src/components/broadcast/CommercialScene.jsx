"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  TrophyOutlined,
  LoadingOutlined,
  NotificationOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { prepareNextAd, recordAdImpression } from "../../utils/adEngine";
import defaultAwardVideo from "../../assets/mov/award2.mp4";
import defaultIntroVideo from "../../assets/mov/introduce.mp4";
import demoBodybuilderImg from "../../assets/img/demo_bodybuilder.jpg";

// 기본 공식 협찬사 프리셋 4종
const DEFAULT_SPONSORS = [
  {
    id: "sp_def_1",
    name: "(주)인바디 (InBody)",
    slogan: "정밀 체성분 분석 공식 파트너",
    desc: "대한민국 대표 체성분 분석기 인바디와 함께합니다",
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
    desc: "무대 위 최고의 집중력과 폭발적인 에너지를 지원합니다",
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
    desc: "최고의 핏과 내구성, 대한민국 대표 피트니스 브랜드",
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
    desc: "세계적인 보디빌딩 & 피트니스 메카 골드짐",
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
}) => {
  // 사용자가 등록한 활성 광고 풀
  const basePool = useMemo(() => {
    const userActive = (sponsors || []).filter((ad) => ad.isActive !== false);
    if (userActive.length > 0) {
      return userActive;
    }
    // 등록된 광고가 없을 때만 공식 대회 브랜딩 1종 노출
    return [
      {
        id: "sp_official_championship",
        name: contestTitle || "공식 대회 조직위원회",
        slogan: "2026 OFFICIAL CHAMPIONSHIP",
        desc: "공식 대회 파트너 & 후원사 브랜딩",
        mediaType: "video",
        videoUrl: defaultAwardVideo,
        bgColor: "from-amber-950 via-slate-900 to-black",
        accentColor: "text-amber-400",
        tag: "OFFICIAL",
        weight: 1,
      },
    ];
  }, [sponsors, contestTitle]);

  const basePoolRef = useRef(basePool);
  basePoolRef.current = basePool;

  const videoRef = useRef(null);

  // 🎯 현재 송출 중인 광고
  const [currentAd, setCurrentAd] = useState(() =>
    prepareNextAd(basePool, null, "STAGE_LIVE", "COMMERCIAL") || basePool[0]
  );
  const currentAdRef = useRef(currentAd);
  currentAdRef.current = currentAd;

  const upcomingAdRef = useRef(null);
  const isPrefetchedRef = useRef(false);

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

  // ⏱️ [핵심] 10초 타이머 & 2초 전(80% 시점) 광고엔진 질의 & 프리로드
  useEffect(() => {
    setAdProgress(0);
    upcomingAdRef.current = null;
    isPrefetchedRef.current = false;

    const intervalTime = 50; // 50ms마다 갱신
    const step = (intervalTime / adDurationMs) * 100;

    const progressTimer = setInterval(() => {
      setAdProgress((prev) => {
        const nextVal = prev + step;

        // 🌟 [2초 전 = 80% 도달 시]: 광고 엔진에게 다음 광고를 미리 물어보고 사전 준비(Preload)!
        if (nextVal >= 80 && !isPrefetchedRef.current) {
          isPrefetchedRef.current = true;
          const nextTarget = prepareNextAd(
            basePoolRef.current,
            currentAdRef.current,
            "STAGE_LIVE",
            "COMMERCIAL"
          );
          if (nextTarget) {
            upcomingAdRef.current = nextTarget;
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

        // 🎯 [10초 완료 = 100% 도달 시]: 준비된 upcomingAd로 즉시 전환!
        if (nextVal >= 100) {
          clearInterval(progressTimer);
          const finalNext =
            upcomingAdRef.current ||
            prepareNextAd(
              basePoolRef.current,
              currentAdRef.current,
              "STAGE_LIVE",
              "COMMERCIAL"
            );
          if (finalNext) {
            setCurrentAd(finalNext);
          }
          return 0;
        }

        return nextVal;
      });
    }, intervalTime);

    return () => clearInterval(progressTimer);
  }, [currentAdKey]);

  // 비디오 광고 재생 보장
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [currentAd]);

  const mediaSrc =
    currentAd?.videoUrl ||
    currentAd?.mediaUrl ||
    currentAd?.imageUrl ||
    currentAd?.logoUrl;

  const isVideoAd =
    currentAd?.mediaType === "VIDEO" ||
    currentAd?.mediaType === "video" ||
    !!currentAd?.videoUrl ||
    (typeof mediaSrc === "string" &&
      /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(mediaSrc));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white select-none animate-fade-in flex flex-col justify-between">
      
      {/* ========================================================================================= */}
      {/* 🎬 1. 풀스크린 메인 미디어 상영관 (스크린골프 스타일 100% Fullscreen) */}
      {/* ========================================================================================= */}
      <div className="absolute inset-0 w-full h-full">
        {isVideoAd && mediaSrc ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              key={`comm-v-${currentAd?.id || currentAd?.name}`}
              src={mediaSrc}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover animate-fade-in"
            />
            {/* 은은한 상하 비네팅 (가독성 확보) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/75 pointer-events-none" />
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {mediaSrc ? (
              <img
                key={`comm-img-${currentAd?.id || currentAd?.name}`}
                src={mediaSrc}
                alt={currentAd?.name}
                className="w-full h-full object-cover animate-fade-in"
              />
            ) : (
              <div
                className={`absolute inset-0 bg-gradient-to-br ${
                  currentAd?.bgColor || "from-slate-900 to-black"
                }`}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/75 pointer-events-none" />
          </div>
        )}
      </div>

      {/* ========================================================================================= */}
      {/* 🏆 2. [스크린골프 스타일 상단 공식 헤더 바] */}
      {/* ========================================================================================= */}
      <div className="relative z-30 px-8 pt-7 flex items-center justify-between">
        
        {/* 좌측: 대회 타이틀 */}
        <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/15 shadow-2xl">
          <TrophyOutlined className="text-amber-400 text-lg" />
          <div className="text-left">
            <span className="text-[10px] text-amber-300/80 font-mono font-bold uppercase tracking-widest block">
              OFFICIAL CHAMPIONSHIP
            </span>
            <span className="text-base sm:text-lg font-black text-white tracking-tight">
              {titleText}
            </span>
          </div>
        </div>

        {/* 우측: 현재 진행 종목 및 체급 */}
        <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/15 shadow-2xl">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-sm font-black text-slate-200">
            {catTitle}
          </span>
          <span className="text-xs font-bold text-amber-400 px-2 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/30">
            {grdTitle}
          </span>
        </div>

      </div>

      {/* ========================================================================================= */}
      {/* 📊 3. [스크린골프 스타일 중앙 하단: 공식 점수 집계중 대형 배너] */}
      {/* ========================================================================================= */}
      <div className="relative z-30 pb-10 px-8 flex flex-col items-center justify-center text-center space-y-4">
        
        {/* 골프존 스타일 세련된 점수 집계중 알림 캡슐 */}
        <div className="flex items-center gap-4 px-8 py-3.5 rounded-full bg-black/80 backdrop-blur-2xl border-2 border-amber-400/80 shadow-[0_0_40px_rgba(251,191,36,0.35)] animate-pulse">
          <div className="w-3.5 h-3.5 rounded-full bg-amber-400 animate-ping" />
          <span className="text-lg sm:text-2xl font-black text-white tracking-wide">
            현재 심사위원 점수 집계중입니다
          </span>
          <span className="text-xs font-mono font-bold text-amber-300 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 uppercase tracking-widest">
            SCORING IN PROGRESS
          </span>
        </div>

        {/* 서브 가이드 문구 */}
        <p className="text-sm sm:text-base font-bold text-slate-300 m-0 drop-shadow-lg flex items-center gap-2">
          <span>심사위원단의 공식 채점 집계가 완료되는 즉시 최종 순위 발표가 진행됩니다.</span>
        </p>

        {/* 스폰서 브랜드명 (미세하게 표기) */}
        {currentAd?.name && (
          <div className="text-xs font-mono font-semibold text-slate-400/80 flex items-center gap-1.5 pt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300">SPONSORED BY</span>
            <span>{currentAd.name}</span>
          </div>
        )}

      </div>

      {/* ========================================================================================= */}
      {/* 📏 4. 화면 최하단: 얇고 세련된 미세 프로그레스 라인 (2px) */}
      {/* ========================================================================================= */}
      <div className="absolute bottom-0 left-0 right-0 z-30 h-1 bg-white/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-75 ease-linear shadow-[0_0_10px_rgba(251,191,36,0.8)]"
          style={{ width: `${adProgress}%` }}
        />
      </div>

    </div>
  );
};

export default CommercialScene;
