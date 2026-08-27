"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  FireOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  FieldTimeOutlined,
  NotificationOutlined,
  PlayCircleOutlined,
  StarOutlined,
  RightOutlined,
} from "@ant-design/icons";
import defaultIntroVideo from "../../assets/mov/introduce.mp4";
import defaultAwardVideo from "../../assets/mov/award2.mp4";
import demoBodybuilderImg from "../../assets/img/demo_bodybuilder.jpg";
import { THEME_CONFIGS } from "./AthleteIntroScene";
import "./AthleteIntroScene.css";
import { prepareNextAd, recordAdImpression } from "../../utils/adEngine";
import { getStoredVideoBlobUrl } from "../../utils/indexedDbVideoStorage";

// 기본 협찬사 광고 데모 목록
const DEFAULT_COMMERCIALS = [
  {
    id: "comm_1",
    name: "(주)인바디 (InBody)",
    slogan: "정밀 체성분 분석 공식 파트너",
    tag: "DIAMOND SPONSOR",
    mediaType: "video",
    videoUrl: defaultAwardVideo,
    duration: 10,
    weight: 3,
  },
  {
    id: "comm_2",
    name: "MONSTER ENERGY",
    slogan: "공식 에너지 드링크 파트너 - 한계를 뛰어넘어라!",
    tag: "OFFICIAL ENERGY",
    mediaType: "image",
    imageUrl: demoBodybuilderImg,
    duration: 10,
    weight: 2,
  },
  {
    id: "comm_3",
    name: "HDEX (에이치덱스)",
    slogan: "대한민국 No.1 프리미엄 애슬레틱 스포츠웨어",
    tag: "PLATINUM WEAR",
    mediaType: "video",
    videoUrl: defaultIntroVideo,
    duration: 10,
    weight: 2,
  },
  {
    id: "comm_4",
    name: "골드짐 코리아 (GOLD'S GYM)",
    slogan: "월드 클래스 피트니스 센터 & 공식 트레이닝 파트너",
    tag: "GOLD PARTNER",
    mediaType: "image",
    imageUrl: demoBodybuilderImg,
    duration: 10,
    weight: 1,
  },
];

const PosedownScene = ({
  contestTitle,
  stageInfo,
  currentPlayers = [],
  sponsors = [],
  backgroundVideoUrl,
  colorTheme = "RED",
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const flashRef = useRef(null);
  const adVideoRef = useRef(null);

  const theme = THEME_CONFIGS[colorTheme] || THEME_CONFIGS.RED;
  const videoSrc = backgroundVideoUrl || defaultIntroVideo;

  // ⏱️ 60초 포즈다운 카운트다운 타이머
  const [seconds, setSeconds] = useState(60);

  // 🎯 스마트 가중치 & 누적 노출 트래킹 광고 풀 구성 (등록 광고가 없으면 기본 4종 협찬사 풀로 무한 로테이션)
  const basePool = React.useMemo(() => {
    const userActiveSponsors = (sponsors || []).filter((s) => s.isActive !== false);
    if (userActiveSponsors.length > 0) {
      return userActiveSponsors;
    }
    return DEFAULT_COMMERCIALS;
  }, [sponsors]);

  const basePoolRef = useRef(basePool);
  basePoolRef.current = basePool;

  // 🎯 현재 송출 중인 광고
  const [currentAd, setCurrentAd] = useState(() =>
    prepareNextAd(basePool, null, "STAGE_LIVE", "POSEDOWN") || basePool[0]
  );
  const currentAdRef = useRef(currentAd);
  currentAdRef.current = currentAd;

  // 🔄 무한 사이클 제어용 state
  const [adCycle, setAdCycle] = useState(0);

  // 🚀 2초 전에 광고 엔진에게 미리 물어봐서 프리로드할 '다음 광고'
  const [upcomingAd, setUpcomingAd] = useState(null);

  const [adProgress, setAdProgress] = useState(0);
  const adDurationMs = 10000; // 10초 보장

  const currentAdKey = currentAd?.id || currentAd?.name;

  const catTitle = stageInfo?.categoryTitle || "남자 클래식 보디빌딩";
  const grdTitle = stageInfo?.gradeTitle || "-75KG 체급";

  const activePlayers =
    currentPlayers && currentPlayers.length > 0
      ? currentPlayers.filter((p) => !p.playerNoShow)
      : [];

  // ⏱️ 포즈다운 카운트다운
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 📈 광고 최초 및 교체 시 노출 카운트 1회 기록
  useEffect(() => {
    if (currentAdKey) {
      recordAdImpression("STAGE_LIVE", currentAdKey);
    }
  }, [currentAdKey]);

  // ⏱️ 10초 타이머 & 2초 전(80% 시점) 광고엔진 질의 & 프리로드 & 무한 로테이션
  useEffect(() => {
    setAdProgress(0);
    setUpcomingAd(null);
    let isPrefetched = false;
    let nextTarget = null;
    const startTime = Date.now();

    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progressPercent = Math.min((elapsed / adDurationMs) * 100, 100);
      setAdProgress(progressPercent);

      // 🌟 [2초 전 = 80% 도달 시]: 다음 광고 미리 질의 & 프리로드
      if (progressPercent >= 80 && !isPrefetched) {
        isPrefetched = true;
        nextTarget = prepareNextAd(
          basePoolRef.current,
          currentAdRef.current,
          "STAGE_LIVE",
          "POSEDOWN"
        );
        if (nextTarget) {
          setUpcomingAd(nextTarget);

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

      // 🎯 [10초 완료 = 100% 도달 시]: 다음 광고로 전환 및 다음 사이클 구동
      if (elapsed >= adDurationMs) {
        clearInterval(progressTimer);
        const finalNext =
          nextTarget ||
          prepareNextAd(
            basePoolRef.current,
            currentAdRef.current,
            "STAGE_LIVE",
            "POSEDOWN"
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

  // 비디오 변경 시 자동 재생
  useEffect(() => {
    if (adVideoRef.current) {
      adVideoRef.current.currentTime = 0;
      adVideoRef.current.play().catch(() => {});
    }
  }, [currentAd]);

  // 🌟 1. 불꽃 & 파이어 스파크 캔버스 애니메이션
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const sparks = Array.from({ length: 85 }, () => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 50,
      radius: Math.random() * 3.5 + 1.2,
      speedX: (Math.random() - 0.5) * 2.2,
      speedY: -Math.random() * 3.5 - 1.8,
      alpha: Math.random() * 0.9 + 0.3,
      decay: Math.random() * 0.012 + 0.004,
      hue: Math.random() > 0.4 ? "244, 63, 94" : "251, 191, 36",
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      sparks.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.alpha -= p.decay;

        if (p.alpha <= 0 || p.y < -30) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + 20;
          p.alpha = Math.random() * 0.9 + 0.3;
          p.speedY = -Math.random() * 3.5 - 1.8;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.hue}, ${p.alpha})`;
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 🎬 2. GSAP 다이내믹 포즈다운 인트로 애니메이션
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      gsap.set(flashRef.current, { opacity: 0.9 });
      gsap.set(".posedown-title", { scale: 0.4, opacity: 0, filter: "blur(20px)" });
      gsap.set(".posedown-badge", { opacity: 0, y: -40 });
      gsap.set(".posedown-player-chip", { opacity: 0, scale: 0.7, y: 30 });
      gsap.set(".posedown-timer", { scale: 1.8, opacity: 0, filter: "blur(10px)" });
      gsap.set(".posedown-ad-screen", { opacity: 0, x: 60, scale: 0.95 });

      tl.to(flashRef.current, { opacity: 0, duration: 0.6, ease: "power2.out" }, 0);
      tl.to(".posedown-badge", { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.1);
      tl.to(".posedown-title", {
        scale: 1,
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.9,
        ease: "elastic.out(1.2, 0.6)",
      }, 0.2);
      tl.to(".posedown-timer", {
        scale: 1,
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.7,
        ease: "back.out(2)",
      }, 0.4);
      tl.to(".posedown-ad-screen", {
        opacity: 1,
        x: 0,
        scale: 1,
        duration: 0.8,
        ease: "power3.out",
      }, 0.5);
      tl.to(
        ".posedown-player-chip",
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.08,
          ease: "power3.out",
        },
        0.7
      );

      // 타이틀 광란의 펄스 비트
      gsap.to(".posedown-title", {
        scale: 1.03,
        duration: 0.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 1.2,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const rawAdMediaSrc =
    currentAd?.videoUrl ||
    currentAd?.mediaUrl ||
    currentAd?.imageUrl ||
    currentAd?.logoUrl ||
    demoBodybuilderImg;

  const [adMediaSrc, setAdMediaSrc] = useState(rawAdMediaSrc);

  useEffect(() => {
    let isCancelled = false;
    const resolveCached = async () => {
      if (!rawAdMediaSrc) {
        if (!isCancelled) setAdMediaSrc(demoBodybuilderImg);
        return;
      }
      if (typeof rawAdMediaSrc === "string" && rawAdMediaSrc.startsWith("http")) {
        try {
          const cachedBlobUrl = await getStoredVideoBlobUrl(rawAdMediaSrc);
          if (!isCancelled && cachedBlobUrl) {
            setAdMediaSrc(cachedBlobUrl);
            return;
          }
        } catch {}
      }
      if (!isCancelled) setAdMediaSrc(rawAdMediaSrc);
    };
    resolveCached();
    return () => {
      isCancelled = true;
    };
  }, [rawAdMediaSrc]);

  const isAdVideo =
    currentAd?.mediaType === "video" ||
    currentAd?.mediaType === "VIDEO" ||
    !!currentAd?.videoUrl ||
    (typeof adMediaSrc === "string" &&
      /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(adMediaSrc));

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-transparent text-white flex flex-col justify-between p-6 sm:p-8 lg:p-10 overflow-hidden select-none"
    >
      {/* 🌟 [Layer 25: 화면 전체를 가로지르는 불꽃 스파크 캔버스] */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-25" />

      {/* ⚡ [Layer 40: 순간 플래시] */}
      <div ref={flashRef} className="absolute inset-0 z-40 pointer-events-none bg-white" />

      {/* ======================= [ Layer 30: 1. 상단 공식 헤더 & 대회 Info ] ======================= */}
      <div className="relative z-30 flex items-center justify-between gap-3 border-b border-white/15 pb-3 sm:pb-4 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 mr-2">
          <div className={`w-2.5 sm:w-3.5 h-10 sm:h-12 rounded-full bg-gradient-to-b ${theme.textGradient} shrink-0`} />
          <div className="posedown-badge space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg ${theme.badgeBg} border text-[10px] sm:text-xs font-black uppercase tracking-widest ${theme.primary} shadow-lg shrink-0`}>
                <FireOutlined className="animate-pulse" />
                <span>OFFICIAL POSEDOWN • 포즈다운 배틀</span>
              </span>
              <span className="text-[11px] sm:text-xs text-slate-300 font-mono font-black truncate">
                {catTitle} {grdTitle && `• ${grdTitle}`}
              </span>
            </div>
            <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-black text-white m-0 tracking-tight leading-tight truncate">
              {contestTitle || "보디빌딩 & 피트니스 챔피언십"}
            </h1>
          </div>
        </div>
      </div>

      {/* ======================= [ Layer 10: 2. 메인 듀얼 스테이지: 좌측 포즈다운 배틀 vs 우측 대형 광고 상영관 ] ======================= */}
      <div className="relative z-10 my-auto flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-6 w-full h-[calc(100vh-140px)] py-1 overflow-hidden">
        
        {/* ================= 좌측: 포즈다운 엠블럼 + 60초 타이머 + 출전 선수 그리드 ================= */}
        <div className="flex flex-col justify-center items-center md:items-start text-center md:text-left space-y-2 sm:space-y-3 w-full md:w-[50%] lg:w-[54%] min-w-0">
          
          {/* 🔥 초대형 POSEDOWN 타이틀 (반응형 폰트 축소 적용) */}
          <div className="posedown-title space-y-1 w-full">
            <div className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-0.5 sm:py-1 rounded-full bg-red-600/35 border border-red-500/80 backdrop-blur-xl text-red-300 text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-2xl">
              <FireOutlined className="animate-bounce text-amber-400" />
              <span>UNLEASH YOUR PHYSIQUE • 60 SECONDS FREE BATTLE</span>
              <FireOutlined className="animate-bounce text-amber-400" />
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-rose-300 to-red-600 m-0 tracking-tighter leading-none drop-shadow-[0_20px_80px_rgba(225,29,72,0.95)]">
              POSEDOWN
            </h1>
            <p className="text-xs sm:text-sm lg:text-base font-black text-slate-200 tracking-wide drop-shadow-md m-0 break-keep">
              무대 위 최고의 자유 포징을 펼쳐주시기 바랍니다!
            </p>
          </div>

          {/* ⏱️ 배틀 카운트다운 타이머 */}
          <div className="posedown-timer inline-flex items-center gap-3 sm:gap-4 bg-black/85 backdrop-blur-2xl border-2 border-red-500/80 px-4 sm:px-6 py-1.5 sm:py-2.5 rounded-2xl shadow-[0_10px_40px_rgba(239,68,68,0.5)]">
            <FieldTimeOutlined className="text-amber-400 text-xl sm:text-2xl animate-spin" />
            <div className="text-left">
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider font-mono">
                POSEDOWN BATTLE TIME
              </span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-black font-mono text-amber-400 leading-none">
                {seconds}초
              </span>
            </div>
          </div>

          {/* 🏷️ 출전 선수 칩 카드 그리드 */}
          <div className="space-y-1 w-full pt-1">
            <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 justify-center md:justify-start">
              <TrophyOutlined className="text-amber-400" />
              <span>무대 위 출전 선수 (ATHLETES ON STAGE)</span>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 max-h-[110px] sm:max-h-[140px] overflow-y-auto">
              {activePlayers.length === 0 ? (
                <div className="px-3 py-1 rounded-xl bg-slate-900/60 border border-white/10 text-xs text-slate-400 font-bold">
                  무대 위 출전 선수 명단 준비 중
                </div>
              ) : (
                activePlayers.map((player, idx) => (
                  <div
                    key={player.playerNumber || idx}
                    className="posedown-player-chip flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-white/20 backdrop-blur-xl shadow-md hover:scale-105 transition-all"
                  >
                    <span className="font-mono font-black text-sm sm:text-base text-amber-400">
                      #{player.playerNumber}
                    </span>
                    <div className="text-left">
                      <div className="text-xs sm:text-sm font-black text-white">{player.playerName}</div>
                      {player.playerGym && (
                        <div className="text-[9px] sm:text-[10px] text-slate-400 truncate max-w-[75px]">
                          {player.playerGym}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* ================= 우측: 📢 대형 공식 스폰서 광고 상영관 ================= */}
        <div className="posedown-ad-screen w-full md:w-[50%] lg:w-[46%] h-full max-h-[540px] flex flex-col rounded-3xl overflow-hidden bg-slate-950/90 border-2 border-amber-400/70 shadow-[0_20px_60px_rgba(251,191,36,0.35)] backdrop-blur-2xl relative">
          
          {/* ① 광고 상단 헤더 & 프로그레스 바 */}
          <div className="bg-black/85 backdrop-blur-xl px-4 py-2.5 border-b border-white/15 flex items-center justify-between z-20 shrink-0">
            <div className="flex items-center gap-2">
              <NotificationOutlined className="text-amber-400 text-sm animate-pulse" />
              <div>
                <div className="text-[9px] sm:text-[10px] font-mono font-black text-amber-400 uppercase tracking-wider">
                  OFFICIAL STAGE SPONSOR ADS
                </div>
                <div className="text-xs sm:text-sm font-black text-white truncate max-w-[180px] sm:max-w-[220px]">
                  {currentAd?.name || "공식 협찬사"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md">
                10초 로테이션
              </span>
              <span className="text-xs font-mono font-black text-amber-300">
                {Math.ceil(((100 - adProgress) / 100) * (currentAd?.duration || 10))}s
              </span>
            </div>
          </div>

          {/* 광고 실시간 진행 프로그레스 바 (10초 네온 게이지) */}
          <div className="w-full bg-black/60 h-1.5 z-20 shrink-0 overflow-hidden border-b border-white/10">
            <div
              className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 h-full transition-all duration-75 shadow-[0_0_15px_rgba(251,191,36,1)]"
              style={{ width: `${adProgress}%` }}
            />
          </div>

          {/* ② 광고 메인 미디어 뷰 (영상 MP4 or 대형 이미지) */}
          <div className="relative flex-1 w-full h-full overflow-hidden bg-slate-950 flex items-center justify-center">
            {isAdVideo ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
                {/* 1. 배경을 채워주는 은은한 블러 앰비언트 비디오 백드롭 */}
                <video
                  src={adMediaSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-110 pointer-events-none"
                />

                {/* 2. 전면 센터 정렬: 16:9, 4:3, 1:1 등 어떤 해상도에서도 상하/좌우 잘림 0% 완전 보존 */}
                <video
                  ref={adVideoRef}
                  key={`ad-v-${currentAd?.id || currentAd?.name}`}
                  src={adMediaSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="relative z-1 max-h-[88%] max-w-[94%] object-contain drop-shadow-[0_10px_35px_rgba(0,0,0,0.95)]"
                />
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
                {/* 1. 배경을 은은하고 고급스럽게 채워주는 블러 앰비언트 백드롭 */}
                <img
                  src={adMediaSrc}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110 pointer-events-none"
                />

                {/* 2. 전면 센터 정렬: 원본 비율 100% 완전 보존 (원형 로고·포스터 등 잘림 0% 보장) */}
                <img
                  key={`ad-img-${currentAd?.id || currentAd?.name}`}
                  src={adMediaSrc}
                  alt={currentAd?.name}
                  className="relative z-1 max-h-[75%] max-w-[90%] object-contain drop-shadow-[0_15px_40px_rgba(0,0,0,0.95)] animate-fade-in"
                />
              </div>
            )}

            {/* ③ 광고 하단 스폰서 상세 정보 오버레이 */}
            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black via-black/85 to-transparent z-10 text-left space-y-0.5 pointer-events-none">
              <div className="flex items-center gap-2">
                {currentAd?.tag && (
                  <span className="text-[9px] sm:text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 uppercase shadow-md">
                    {currentAd.tag}
                  </span>
                )}
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-300 font-mono">
                  {contestTitle} 공식 파트너
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-black text-white m-0 tracking-tight leading-tight drop-shadow-md">
                {currentAd?.name}
              </h2>

              {currentAd?.slogan && (
                <p className="text-[11px] sm:text-xs font-bold text-amber-300 m-0 line-clamp-1 drop-shadow-md">
                  {currentAd.slogan}
                </p>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* ======================= [ Layer 30: 3. 하단 공식 방송 바 (순수 Info 집중) ] ======================= */}
      <div className="relative z-30 flex items-center justify-between border-t border-white/15 pt-3 shrink-0">
        <div className="text-xs text-slate-400 font-bold flex items-center gap-2">
          <ThunderboltOutlined className={theme.primary} />
          <span>{contestTitle || "보디빌딩 & 피트니스"} • 공식 포즈다운 & 스폰서 쇼케이스</span>
        </div>

        <div className={`text-xs font-black tracking-widest ${theme.primary} uppercase font-mono`}>
          OFFICIAL STAGE PERFORMANCE & SPONSOR SHOWCASE
        </div>
      </div>

    </div>
  );
};

export default PosedownScene;
