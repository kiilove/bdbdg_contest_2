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

  // 🎯 스마트 가중치 & 누적 노출 트래킹 광고 풀 구성 (매 렌더링마다 배열 참조가 바뀌지 않도록 useMemo)
  const basePool = React.useMemo(() => {
    const userActiveSponsors = (sponsors || []).filter((s) => s.isActive !== false);
    if (userActiveSponsors.length > 0) {
      return userActiveSponsors;
    }
    return [
      {
        id: "posedown_official_sponsor",
        name: contestTitle || "공식 대회 후원사",
        tag: "OFFICIAL PARTNER",
        duration: 10,
        mediaType: "video",
        videoUrl: defaultIntroVideo,
        desc: "2026 보디빌딩 공식 챔피언십",
      },
    ];
  }, [sponsors, contestTitle]);

  const basePoolRef = useRef(basePool);
  basePoolRef.current = basePool;

  // 🎯 현재 송출 중인 광고
  const [currentAd, setCurrentAd] = useState(() =>
    prepareNextAd(basePool, null, "STAGE_LIVE", "POSEDOWN") || basePool[0]
  );
  const currentAdRef = useRef(currentAd);
  currentAdRef.current = currentAd;

  // 🚀 2초 전에 광고 엔진에게 미리 물어봐서 프리로드할 '다음 광고'
  const [upcomingAd, setUpcomingAd] = useState(null);
  const upcomingAdRef = useRef(null);
  const isPrefetchedRef = useRef(false);

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

  // ⏱️ 10초 타이머 & 2초 전(80% 시점) 광고엔진 질의 & 프리로드
  useEffect(() => {
    setAdProgress(0);
    setUpcomingAd(null);
    upcomingAdRef.current = null;
    isPrefetchedRef.current = false;

    const intervalTime = 50;
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
            "POSEDOWN"
          );
          if (nextTarget) {
            upcomingAdRef.current = nextTarget;
            setUpcomingAd(nextTarget);

            const mediaUrl = nextTarget.videoUrl || nextTarget.imageUrl || nextTarget.logoUrl;
            if (mediaUrl && (nextTarget.mediaType === "image" || !nextTarget.videoUrl)) {
              const img = new Image();
              img.src = mediaUrl;
            }
          }
        }

        // 🎯 [10초 완료 = 100% 도달 시]: 준비된 upcomingAd로 즉시 전환
        if (nextVal >= 100) {
          clearInterval(progressTimer);
          const finalNext =
            upcomingAdRef.current ||
            prepareNextAd(basePoolRef.current, currentAdRef.current, "STAGE_LIVE", "POSEDOWN");
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
        ctx.shadowBlur = 18;
        ctx.shadowColor = "#f43f5e";
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

  const adMediaSrc =
    currentAd?.videoUrl ||
    currentAd?.mediaUrl ||
    currentAd?.imageUrl ||
    currentAd?.logoUrl ||
    demoBodybuilderImg;

  const isAdVideo =
    currentAd?.mediaType === "video" ||
    currentAd?.mediaType === "VIDEO" ||
    !!currentAd?.videoUrl ||
    (typeof adMediaSrc === "string" &&
      /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(adMediaSrc));

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-black text-white flex flex-col justify-between p-6 sm:p-8 lg:p-10 overflow-hidden select-none animate-fade-in"
    >
      {/* 🎬 [Layer 0: 바닥 배경 MP4 비디오] */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <video
          key={videoSrc}
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-40 filter contrast-150 brightness-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/75" />
      </div>

      {/* 🌟 [Layer 1: 다이내믹 앰비언트 글로우] */}
      <div
        className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] rounded-full blur-[240px] pointer-events-none z-1 animate-pulse"
        style={{ backgroundColor: theme.glowRgba }}
      />

      {/* 🌟 [Layer 25: 화면 전체를 가로지르는 불꽃 스파크 캔버스] */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-25" />

      {/* ⚡ [Layer 40: 순간 플래시] */}
      <div ref={flashRef} className="absolute inset-0 z-40 pointer-events-none bg-white" />

      {/* ======================= [ Layer 30: 1. 상단 공식 헤더 & 대회 Info ] ======================= */}
      <div className="relative z-30 flex items-center justify-between border-b border-white/15 pb-4">
        <div className="flex items-center gap-4">
          <div className={`w-3.5 h-12 rounded-full bg-gradient-to-b ${theme.textGradient}`} />
          <div className="posedown-badge space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg ${theme.badgeBg} border text-xs font-black uppercase tracking-widest ${theme.primary} shadow-lg`}>
                <FireOutlined className="animate-pulse" />
                <span>OFFICIAL POSEDOWN • 포즈다운 배틀</span>
              </span>
              <span className="text-xs text-slate-300 font-mono font-black">
                {catTitle} • {grdTitle}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white m-0 tracking-tight leading-tight">
              {contestTitle || "보디빌딩 & 피트니스 챔피언십"}
            </h1>
          </div>
        </div>

        {/* 출전 선수 인원 수 Info 뱃지 */}
        <div className="hidden sm:flex items-center gap-3 bg-black/80 backdrop-blur-2xl px-6 py-3 rounded-2xl border border-white/20 shadow-2xl">
          <TrophyOutlined className={`${theme.primary} text-2xl animate-pulse`} />
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">무대 진출 선수</span>
            <span className="text-2xl font-black font-mono text-white leading-none">
              총 <span className={theme.primary}>{activePlayers.length}명</span>
            </span>
          </div>
        </div>
      </div>

      {/* ======================= [ Layer 10: 2. 메인 듀얼 스테이지: 좌측 포즈다운 배틀 vs 우측 대형 광고 상영관 ] ======================= */}
      <div className="relative z-10 my-auto flex flex-col lg:flex-row items-center justify-between gap-8 w-full h-[calc(100vh-170px)] py-2">
        
        {/* ================= 좌측: 포즈다운 엠블럼 + 60초 타이머 + 출전 선수 그리드 (58% 영역) ================= */}
        <div className="flex flex-col justify-center items-center lg:items-start text-center lg:text-left space-y-5 w-full lg:w-[56%] max-w-3xl">
          
          {/* 🔥 초대형 POSEDOWN 타이틀 */}
          <div className="posedown-title space-y-2">
            <div className="inline-flex items-center gap-2.5 px-5 py-1.5 rounded-full bg-red-600/35 border border-red-500/80 backdrop-blur-xl text-red-300 text-xs sm:text-sm font-black uppercase tracking-widest shadow-2xl">
              <FireOutlined className="animate-bounce text-amber-400" />
              <span>UNLEASH YOUR PHYSIQUE • 60 SECONDS FREE BATTLE</span>
              <FireOutlined className="animate-bounce text-amber-400" />
            </div>

            <h1 className="text-6xl sm:text-8xl lg:text-[8.5rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-rose-300 to-red-600 m-0 tracking-tighter leading-none drop-shadow-[0_20px_80px_rgba(225,29,72,0.95)]">
              POSEDOWN
            </h1>
            <p className="text-base sm:text-xl font-black text-slate-200 tracking-wide drop-shadow-md">
              무대 위 최고의 자유 포징을 펼쳐주시기 바랍니다!
            </p>
          </div>

          {/* ⏱️ 배틀 카운트다운 타이머 */}
          <div className="posedown-timer inline-flex items-center gap-4 bg-black/85 backdrop-blur-2xl border-2 border-red-500/80 px-8 py-3.5 rounded-3xl shadow-[0_10px_40px_rgba(239,68,68,0.5)]">
            <FieldTimeOutlined className="text-amber-400 text-4xl animate-spin" />
            <div className="text-left">
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider font-mono">
                POSEDOWN BATTLE TIME
              </span>
              <span className="text-3xl sm:text-4xl font-black font-mono text-amber-400 leading-none">
                {seconds}초
              </span>
            </div>
          </div>

          {/* 🏷️ 출전 선수 칩 카드 그리드 */}
          <div className="space-y-2 w-full pt-1">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrophyOutlined className="text-amber-400" />
              <span>무대 위 출전 선수 (ATHLETES ON STAGE)</span>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
              {activePlayers.length === 0 ? (
                <div className="px-4 py-2.5 rounded-2xl bg-slate-900/60 border border-white/10 text-xs text-slate-400 font-bold">
                  무대 위 출전 선수 명단 준비 중
                </div>
              ) : (
                activePlayers.map((player, idx) => (
                  <div
                    key={player.playerNumber || idx}
                    className="posedown-player-chip flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-white/20 backdrop-blur-xl shadow-xl hover:scale-105 transition-all"
                  >
                    <span className="font-mono font-black text-xl text-amber-400">
                      #{player.playerNumber}
                    </span>
                    <div className="text-left">
                      <div className="text-sm font-black text-white">{player.playerName}</div>
                      {player.playerGym && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[100px]">
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

        {/* ================= 우측: 📢 대형 공식 스폰서 광고 상영관 (42% 영역) ================= */}
        <div className="posedown-ad-screen w-full lg:w-[42%] h-[68vh] max-h-[560px] flex flex-col rounded-3xl overflow-hidden bg-slate-950/90 border-2 border-amber-400/70 shadow-[0_20px_60px_rgba(251,191,36,0.35)] backdrop-blur-2xl relative">
          
          {/* ① 광고 상단 헤더 & 프로그레스 바 */}
          <div className="bg-black/85 backdrop-blur-xl px-5 py-3 border-b border-white/15 flex items-center justify-between z-20 shrink-0">
            <div className="flex items-center gap-2">
              <NotificationOutlined className="text-amber-400 text-base animate-pulse" />
              <div>
                <div className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-wider">
                  OFFICIAL STAGE SPONSOR ADS
                </div>
                <div className="text-sm font-black text-white truncate max-w-[220px]">
                  {currentAd?.name || "공식 협찬사"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md">
                10초 로테이션
              </span>
              <span className="text-xs font-mono font-black text-amber-300">
                {Math.ceil(((100 - adProgress) / 100) * (currentAd?.duration || 10))}s
              </span>
            </div>
          </div>

          {/* 광고 실시간 진행 프로그레스 바 (10초 네온 게이지) */}
          <div className="w-full bg-black/60 h-2 z-20 shrink-0 overflow-hidden border-b border-white/10">
            <div
              className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 h-full transition-all duration-75 shadow-[0_0_15px_rgba(251,191,36,1)]"
              style={{ width: `${adProgress}%` }}
            />
          </div>

          {/* ② 광고 메인 미디어 뷰 (영상 MP4 or 대형 이미지) */}
          <div className="relative flex-1 w-full h-full overflow-hidden bg-black flex items-center justify-center">
            {isAdVideo ? (
              <video
                ref={adVideoRef}
                key={`ad-v-${currentAd?.id || currentAd?.name}`}
                src={adMediaSrc}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                key={`ad-img-${currentAd?.id || currentAd?.name}`}
                src={adMediaSrc}
                alt={currentAd?.name}
                className="w-full h-full object-cover animate-fade-in"
              />
            )}

            {/* 미디어 오버레이 그라디언트 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent pointer-events-none" />

            {/* ③ 광고 하단 스폰서 상세 정보 오버레이 */}
            <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/90 to-transparent z-10 text-left space-y-1">
              <div className="flex items-center gap-2">
                {currentAd?.tag && (
                  <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 uppercase shadow-md">
                    {currentAd.tag}
                  </span>
                )}
                <span className="text-xs font-bold text-slate-300 font-mono">
                  {contestTitle} 공식 파트너
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white m-0 tracking-tight leading-tight">
                {currentAd?.name}
              </h2>

              {currentAd?.slogan && (
                <p className="text-xs sm:text-sm font-bold text-amber-300 m-0 line-clamp-2">
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
