"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  TrophyOutlined,
  EnvironmentOutlined,
  DashboardOutlined,
  ThunderboltOutlined,
  FireOutlined,
  UserOutlined,
} from "@ant-design/icons";
import demoBodybuilderImg from "../../assets/img/demo_bodybuilder.jpg";
import demoBodybuilderBg from "../../assets/img/demo_bodybuilder_bg.jpg";
import defaultIntroVideo from "../../assets/mov/introduce.mp4";
import "./AthleteIntroScene.css";

export const THEME_CONFIGS = {
  GOLD: {
    key: "GOLD",
    name: "골드 챔피언",
    icon: "🏆",
    primary: "text-amber-400",
    border: "border-amber-400",
    border50: "border-amber-400/50",
    border40: "border-amber-400/40",
    bgGradient: "from-amber-500/35 via-yellow-500/15 to-transparent",
    particleRgb1: "251, 191, 36",
    particleRgb2: "245, 158, 11",
    glowRgba: "rgba(251, 191, 36, 0.22)",
    rayRgba: "rgba(251, 191, 36, 0.04)",
    textGradient: "from-amber-300 via-yellow-200 to-amber-400",
    badgeBg: "bg-amber-500/20 text-amber-300 border-amber-400/50",
    specText: "text-amber-300",
    shockColor: "#fbbf24",
    titleClass: "hyper-gold-text",
    laserGradient: "from-amber-400 via-yellow-300 to-transparent",
    laserShadow: "rgba(251, 191, 36, 0.9)",
  },
  BLUE: {
    key: "BLUE",
    name: "일렉트릭 블루",
    icon: "⚡",
    primary: "text-cyan-400",
    border: "border-cyan-400",
    border50: "border-cyan-400/50",
    border40: "border-cyan-400/40",
    bgGradient: "from-cyan-500/35 via-blue-500/15 to-transparent",
    particleRgb1: "34, 211, 238",
    particleRgb2: "59, 130, 246",
    glowRgba: "rgba(6, 182, 212, 0.22)",
    rayRgba: "rgba(6, 182, 212, 0.04)",
    textGradient: "from-cyan-300 via-sky-200 to-blue-400",
    badgeBg: "bg-cyan-500/20 text-cyan-300 border-cyan-400/50",
    specText: "text-cyan-300",
    shockColor: "#22d3ee",
    titleClass: "hyper-cyan-text",
    laserGradient: "from-cyan-400 via-sky-300 to-transparent",
    laserShadow: "rgba(34, 211, 238, 0.9)",
  },
  RED: {
    key: "RED",
    name: "크림슨 파이어",
    icon: "🔥",
    primary: "text-rose-400",
    border: "border-rose-400",
    border50: "border-rose-400/50",
    border40: "border-rose-400/40",
    bgGradient: "from-rose-500/35 via-red-500/15 to-transparent",
    particleRgb1: "244, 63, 94",
    particleRgb2: "239, 68, 68",
    glowRgba: "rgba(244, 63, 94, 0.22)",
    rayRgba: "rgba(244, 63, 94, 0.04)",
    textGradient: "from-rose-300 via-orange-200 to-red-500",
    badgeBg: "bg-rose-500/20 text-rose-300 border-rose-400/50",
    specText: "text-rose-300",
    shockColor: "#f43f5e",
    titleClass: "hyper-crimson-text",
    laserGradient: "from-rose-400 via-orange-300 to-transparent",
    laserShadow: "rgba(244, 63, 94, 0.9)",
  },
  GREEN: {
    key: "GREEN",
    name: "에메랄드 몬스터",
    icon: "💎",
    primary: "text-emerald-400",
    border: "border-emerald-400",
    border50: "border-emerald-400/50",
    border40: "border-emerald-400/40",
    bgGradient: "from-emerald-500/35 via-green-500/15 to-transparent",
    particleRgb1: "52, 211, 153",
    particleRgb2: "16, 185, 129",
    glowRgba: "rgba(16, 185, 129, 0.22)",
    rayRgba: "rgba(16, 185, 129, 0.04)",
    textGradient: "from-emerald-300 via-teal-200 to-green-400",
    badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/50",
    specText: "text-emerald-300",
    shockColor: "#34d399",
    titleClass: "hyper-emerald-text",
    laserGradient: "from-emerald-400 via-teal-300 to-transparent",
    laserShadow: "rgba(52, 211, 153, 0.9)",
  },
  PURPLE: {
    key: "PURPLE",
    name: "로얄 바이올렛",
    icon: "🔮",
    primary: "text-purple-400",
    border: "border-purple-400",
    border50: "border-purple-400/50",
    border40: "border-purple-400/40",
    bgGradient: "from-purple-500/35 via-fuchsia-500/15 to-transparent",
    particleRgb1: "192, 132, 252",
    particleRgb2: "168, 85, 247",
    glowRgba: "rgba(168, 85, 247, 0.22)",
    rayRgba: "rgba(168, 85, 247, 0.04)",
    textGradient: "from-purple-300 via-pink-200 to-fuchsia-400",
    badgeBg: "bg-purple-500/20 text-purple-300 border-purple-400/50",
    specText: "text-purple-300",
    shockColor: "#c084fc",
    titleClass: "hyper-purple-text",
    laserGradient: "from-purple-400 via-fuchsia-300 to-transparent",
    laserShadow: "rgba(192, 132, 252, 0.9)",
  },
};

const AthleteIntroScene = ({
  contestTitle,
  player,
  stageInfo,
  backgroundVideoUrl,
  colorTheme = "GOLD",
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const flashRef = useRef(null);
  const bgPhotoRef = useRef(null);
  const heroWrapperRef = useRef(null);
  const heroImageRef = useRef(null);
  const shockwaveRef = useRef(null);
  const numberBadgeRef = useRef(null);
  const gymBadgeRef = useRef(null);

  // 현재 테마 설정 추출
  const theme = THEME_CONFIGS[colorTheme] || THEME_CONFIGS.GOLD;

  const {
    playerNumber = "100",
    playerName = "김 재 준",
    playerGym = "Get_in",
    heightWeight = "178.5cm / 76.2kg",
    profileImageUrl,
    photoUrl,
    playerPhoto,
    photos,
    backgroundPhotoUrl,
    categoryTitle,
    gradeTitle,
  } = player || {};

  const catTitle = categoryTitle || stageInfo?.categoryTitle || "남자 클래식 보디빌딩";
  const grdTitle = gradeTitle || stageInfo?.gradeTitle || "-75KG CLASS";

  const firstArrayPhoto = Array.isArray(photos) && photos.length > 0 ? photos[0] : "";
  const heroPhoto = profileImageUrl || photoUrl || playerPhoto || firstArrayPhoto || demoBodybuilderImg;
  const bgPhoto = backgroundPhotoUrl || heroPhoto || demoBodybuilderBg;
  const videoSrc = backgroundVideoUrl || defaultIntroVideo;

  const numberChars = (`#${playerNumber}`).split("");
  const nameChars = playerName ? playerName.split("") : ["선", "수"];

  const hwParts = heightWeight ? heightWeight.split("/").map((s) => s.trim()) : [];
  const heightValue = hwParts[0] || "178.5cm";
  const weightValue = hwParts[1] || "76.2kg";

  // 🎬 GSAP 묵직한 타격감 타임라인
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      gsap.set(flashRef.current, { opacity: 1, backgroundColor: "#ffffff" });
      gsap.set(bgPhotoRef.current, { opacity: 0, scale: 1.25, filter: "blur(20px)" });
      gsap.set(heroImageRef.current, { opacity: 0, scale: 1.5, x: 60, filter: "blur(25px) brightness(2.2)" });
      gsap.set(shockwaveRef.current, { scale: 0.1, opacity: 1 });
      gsap.set(numberBadgeRef.current, { opacity: 0, scale: 2.2, rotationY: -60, transformPerspective: 900 });

      gsap.set(".num-digit", { opacity: 0, scale: 2.5, y: -60 });
      gsap.set(".name-char", { opacity: 0, scale: 2.5, y: 50, filter: "blur(15px)" });
      gsap.set(gymBadgeRef.current, { opacity: 0, x: -80 });
      gsap.set(".bio-card-item", { opacity: 0, scale: 0.8, y: 40, filter: "blur(8px)" });
      gsap.set(".bar-elem", { opacity: 0, y: (i) => (i === 0 ? -30 : 30) });
      gsap.set(".laser-line", { scaleX: 0, transformOrigin: "left center" });

      // ⚡ [0.00s] 화면 플래시 폭발 + 공식 방송 바 슬라이드
      tl.to(flashRef.current, { opacity: 0, duration: 0.5, ease: "power2.out" }, 0);
      tl.to(".bar-elem", { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.05);

      // 🎬 [0.10s] 배경 흑백 와이드 아트 컷 켄번스 스며들기
      tl.to(bgPhotoRef.current, {
        opacity: 0.35,
        scale: 1.05,
        filter: "blur(0px)",
        duration: 1.0,
        ease: "power2.out",
      }, 0.10);

      // 💥 [0.15s] 전면 히어로 인물 줌인 쿵! 안착
      tl.to(heroImageRef.current, {
        opacity: 1,
        scale: 1,
        x: 0,
        filter: "blur(0px) brightness(1)",
        duration: 0.85,
        ease: "power3.out",
      }, 0.15);

      // 💫 [0.25s] 충격파 링 확산
      tl.to(shockwaveRef.current, {
        scale: 2.8,
        opacity: 0,
        duration: 1.0,
        ease: "power2.out",
      }, 0.25);

      // 🎲 [0.45s] 배부번호 3D 스탬핑 쾅! (#100)
      tl.to(numberBadgeRef.current, {
        opacity: 1,
        scale: 1,
        rotationY: 0,
        duration: 0.6,
        ease: "elastic.out(1, 0.6)",
      }, 0.45);

      tl.to(".num-digit", {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.3,
        stagger: 0.08,
        ease: "back.out(2.0)",
      }, 0.50);

      // 레이저 라인 그어짐
      tl.to(".laser-line", { scaleX: 1, duration: 0.5, ease: "power4.out" }, 0.70);

      // 💥 [0.80s] 선수 이름 글자별 타격 리빌 (김 ➜ 재 ➜ 준 각 0.18s 템포)
      tl.to(".name-char", {
        opacity: 1,
        scale: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.5,
        stagger: 0.18,
        ease: "back.out(2.2)",
      }, 0.80);

      // 🏢 [1.45s] 소속 헬스장 슬라이드 (Get_in)
      tl.to(gymBadgeRef.current, {
        opacity: 1,
        x: 0,
        duration: 0.5,
        ease: "power3.out",
      }, 1.45);

      // 📊 [1.70s] BIO 스펙 항목별 순차 팝업 (HEIGHT ➜ WEIGHT ➜ CLASS 각 0.14s 템포)
      tl.to(".bio-card-item", {
        opacity: 1,
        scale: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.4,
        stagger: 0.14,
        ease: "back.out(1.6)",
      }, 1.70);

      // 🌌 [2.3s ~ 무한] 3D 패럴랙스 브리딩 모션
      gsap.to(heroWrapperRef.current, {
        y: -10,
        scale: 1.015,
        duration: 3.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 2.3,
      });

      gsap.to(bgPhotoRef.current, {
        scale: 1.12,
        x: -15,
        duration: 9,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 2.3,
      });
    }, containerRef);

    return () => ctx.revert();
  }, [player?.playerNumber, colorTheme]);

  // 🌌 WebGL / Canvas 파티클 렌더러 (테마 색상 실시간 반영)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particleCount = 75;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height + height * 0.1,
      size: Math.random() * 2.8 + 1,
      speedY: Math.random() * 2.0 + 0.6,
      speedX: (Math.random() - 0.5) * 1.0,
      opacity: Math.random() * 0.85 + 0.15,
      color: Math.random() > 0.35 ? theme.particleRgb1 : theme.particleRgb2,
    }));

    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      angle += 0.0035;
      const rayCount = 8;
      ctx.save();
      ctx.translate(width * 0.65, height * 0.5);
      for (let i = 0; i < rayCount; i++) {
        const rayAngle = angle + (i * Math.PI * 2) / rayCount;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, width * 0.9, rayAngle, rayAngle + 0.16);
        ctx.closePath();
        ctx.fillStyle = theme.rayRgba;
        ctx.fill();
      }
      ctx.restore();

      particles.forEach((p) => {
        p.y -= p.speedY;
        p.x += p.speedX;
        if (p.y < 0) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.opacity})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(${p.color}, 0.9)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-black text-white select-none"
    >
      {/* ======================= [ Layer 1: 배경 MP4 비디오 ] ======================= */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <video
          key={videoSrc}
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-40 filter contrast-125 brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/60" />
      </div>

      {/* ======================= [ Layer 2: 사진 1 - 배경 흑백 와이드 컷 ] ======================= */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-1">
        <img
          ref={bgPhotoRef}
          src={bgPhoto}
          alt="배경 아트"
          className="w-full h-full object-cover bg-photo-mask mix-blend-luminosity filter contrast-150 brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      {/* ======================= [ Layer 3: WebGL / Canvas 테마 파티클 캔버스 ] ======================= */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-2" />

      {/* ⚡ 화면 충격파 플래시 */}
      <div ref={flashRef} className="absolute inset-0 z-40 pointer-events-none bg-white" />

      {/* ======================= [ Layer 4: 상단 공식 대회 헤더 바 ] ======================= */}
      <div className="bar-elem relative z-20 flex items-center justify-between px-10 lg:px-16 pt-7">
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2.5 px-4 py-1.5 rounded-xl ${theme.badgeBg} border backdrop-blur-2xl font-black text-xs tracking-widest uppercase shadow-lg`}>
            <FireOutlined className={`${theme.primary} animate-pulse`} />
            <span>OFFICIAL STAGE SPOTLIGHT</span>
          </div>
          <div className="h-4 w-[1px] bg-white/20" />
          <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight m-0 uppercase">
            {catTitle} <span className={`${theme.primary} ml-2 font-mono`}>{grdTitle}</span>
          </h2>
        </div>

        <div className="flex items-center gap-3 bg-black/80 backdrop-blur-2xl px-5 py-2 rounded-2xl border border-white/15 shadow-2xl">
          <TrophyOutlined className={`${theme.primary} text-xl`} />
          <span className="text-xs font-black tracking-widest text-slate-200 uppercase">
            ATHLETE PROFILE
          </span>
        </div>
      </div>

      {/* ======================= [ Layer 5: 메인 뷰 ] ======================= */}
      <div className="relative z-10 w-full h-[calc(100vh-140px)] flex flex-col lg:flex-row items-center justify-between px-10 lg:px-20">
        
        {/* -------------------- [ 좌측: 선수 핵심 BIO 영역 ] -------------------- */}
        <div className="space-y-6 max-w-2xl z-20">
          
          {/* ① 배부번호 3D 스탬핑 (#100) */}
          <div
            ref={numberBadgeRef}
            className={`inline-flex items-center gap-4 bg-gradient-to-r ${theme.bgGradient} border-l-4 ${theme.border} pl-6 pr-10 py-2.5 rounded-r-3xl backdrop-blur-2xl shadow-2xl`}
          >
            <div className="flex flex-col">
              <span className={`text-[10px] font-black tracking-[0.3em] uppercase ${theme.primary}`}>
                ENTRY NO
              </span>
              <span className="text-xs text-slate-300 font-bold">배부번호</span>
            </div>

            <div className={`flex items-center font-mono font-black text-6xl sm:text-7xl tracking-tighter ${theme.primary} neon-number-glow`}>
              {numberChars.map((digit, i) => (
                <span key={i} className="num-digit inline-block">
                  {digit}
                </span>
              ))}
            </div>
          </div>

          {/* 레이저 라인 */}
          <div
            className="laser-line h-[2px] w-full"
            style={{
              background: `linear-gradient(to right, ${theme.shockColor}, transparent)`,
              boxShadow: `0 0 12px ${theme.laserShadow}`,
            }}
          />

          {/* ② 이름 글자별 묵직한 타격 리빌 (김 ➜ 재 ➜ 준) */}
          <div className="space-y-1">
            <div className="text-xs font-black tracking-widest text-slate-400 uppercase flex items-center gap-2">
              <UserOutlined className={theme.primary} />
              <span>ATHLETE NAME</span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              {nameChars.map((char, i) => (
                <span
                  key={i}
                  className={`name-char inline-block text-7xl sm:text-8xl lg:text-[7.5rem] font-black tracking-tighter leading-none m-0 uppercase drop-shadow-[0_15px_40px_rgba(0,0,0,0.95)] ${theme.titleClass}`}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>

          {/* ③ 소속 헬스장 (Get_in) */}
          <div
            ref={gymBadgeRef}
            className="flex items-center gap-4 text-2xl sm:text-3xl lg:text-4xl text-slate-100 font-black"
          >
            <div className={`p-2.5 rounded-2xl bg-white/10 border ${theme.border50} ${theme.primary} shadow-xl`}>
              <EnvironmentOutlined />
            </div>
            <span className="break-keep font-black tracking-tight drop-shadow-md">
              {playerGym || "무소속 / 개인 출전"}
            </span>
          </div>

          {/* ④ BIO 스펙 항목별 순차 팝업 */}
          <div className="grid grid-cols-3 gap-3.5 pt-1">
            {/* 1. HEIGHT */}
            <div className={`bio-card-item bg-black/80 backdrop-blur-2xl border ${theme.border40} rounded-2xl p-3.5 shadow-xl`}>
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                HEIGHT
              </span>
              <span className={`text-xl sm:text-2xl font-black font-mono ${theme.specText}`}>
                {heightValue}
              </span>
            </div>

            {/* 2. WEIGHT */}
            <div className={`bio-card-item bg-black/80 backdrop-blur-2xl border ${theme.border40} rounded-2xl p-3.5 shadow-xl`}>
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                WEIGHT
              </span>
              <span className={`text-xl sm:text-2xl font-black font-mono ${theme.specText}`}>
                {weightValue}
              </span>
            </div>

            {/* 3. CLASS */}
            <div className={`bio-card-item bg-black/80 backdrop-blur-2xl border ${theme.border40} rounded-2xl p-3.5 shadow-xl`}>
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                CLASS
              </span>
              <span className="text-sm sm:text-base font-black text-slate-200 truncate block">
                {grdTitle}
              </span>
            </div>
          </div>

        </div>

        {/* -------------------- [ 우측: 사진 2 - 경계선 완전 소멸 마스크 인물 ] -------------------- */}
        <div className="relative flex items-end justify-center h-full max-h-[88vh] w-full lg:w-1/2 z-10">
          
          {/* 뒤쪽 3D 테마 글로우 */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full blur-[160px] pointer-events-none"
            style={{ backgroundColor: theme.glowRgba }}
          />

          {/* 충격파 링 */}
          <div
            ref={shockwaveRef}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border-4 pointer-events-none"
            style={{ borderColor: theme.shockColor }}
          />

          {/* 🖼️ 초정밀 다중 페더링 마스크가 적용된 전면 히어로 컷 */}
          <div ref={heroWrapperRef} className="relative h-full flex items-end justify-center">
            <img
              ref={heroImageRef}
              src={heroPhoto}
              alt={playerName}
              className="max-h-[84vh] w-auto object-contain hero-photo-flawless-mask drop-shadow-[0_25px_80px_rgba(0,0,0,0.98)]"
            />
            {/* 바닥 자연스러운 안착 그라디언트 */}
            <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-black via-black/85 to-transparent pointer-events-none z-20" />
          </div>
        </div>

      </div>

      {/* ======================= [ Layer 6: 하단 공식 라이브 상태 바 ] ======================= */}
      <div className="bar-elem relative z-20 border-t border-white/10 px-10 lg:px-16 py-3.5 bg-black/80 backdrop-blur-2xl flex items-center justify-between text-xs text-slate-400 font-bold">
        <div className="flex items-center gap-2">
          <ThunderboltOutlined className={theme.primary} />
          <span>{contestTitle || "보디빌딩 & 피트니스"} • LIVE BROADCAST</span>
        </div>
        <div className={`${theme.primary} font-black tracking-widest uppercase`}>
          NOW POSING ON STAGE • 무대 위 포징
        </div>
      </div>
    </div>
  );
};

export default AthleteIntroScene;
