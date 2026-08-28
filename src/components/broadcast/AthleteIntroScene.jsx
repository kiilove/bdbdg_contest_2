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
import SmoothBackgroundVideo from "./SmoothBackgroundVideo";
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
    name: "크림슨 레드",
    icon: "🔥",
    primary: "text-rose-400",
    border: "border-rose-500",
    border50: "border-rose-500/50",
    border40: "border-rose-500/40",
    bgGradient: "from-rose-600/35 via-red-600/15 to-transparent",
    particleRgb1: "244, 63, 94",
    particleRgb2: "225, 29, 72",
    glowRgba: "rgba(244, 63, 94, 0.22)",
    rayRgba: "rgba(244, 63, 94, 0.04)",
    textGradient: "from-rose-300 via-red-200 to-rose-500",
    badgeBg: "bg-rose-500/20 text-rose-300 border-rose-500/50",
    specText: "text-rose-300",
    shockColor: "#f43f5e",
    titleClass: "hyper-crimson-text",
    laserGradient: "from-rose-500 via-red-400 to-transparent",
    laserShadow: "rgba(244, 63, 94, 0.9)",
  },
  GREEN: {
    key: "GREEN",
    name: "에메랄드 그린",
    icon: "💎",
    primary: "text-emerald-400",
    border: "border-emerald-400",
    border50: "border-emerald-400/50",
    border40: "border-emerald-400/40",
    bgGradient: "from-emerald-500/35 via-teal-500/15 to-transparent",
    particleRgb1: "16, 185, 129",
    particleRgb2: "5, 150, 105",
    glowRgba: "rgba(16, 185, 129, 0.22)",
    rayRgba: "rgba(16, 185, 129, 0.04)",
    textGradient: "from-emerald-300 via-teal-200 to-emerald-400",
    badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/50",
    specText: "text-emerald-300",
    shockColor: "#10b981",
    titleClass: "hyper-emerald-text",
    laserGradient: "from-emerald-400 via-teal-300 to-transparent",
    laserShadow: "rgba(16, 185, 129, 0.9)",
  },
  PURPLE: {
    key: "PURPLE",
    name: "로열 퍼플",
    icon: "👑",
    primary: "text-purple-400",
    border: "border-purple-400",
    border50: "border-purple-400/50",
    border40: "border-purple-400/40",
    bgGradient: "from-purple-500/35 via-fuchsia-500/15 to-transparent",
    particleRgb1: "192, 132, 252",
    particleRgb2: "147, 51, 234",
    glowRgba: "rgba(168, 85, 247, 0.22)",
    rayRgba: "rgba(168, 85, 247, 0.04)",
    textGradient: "from-purple-300 via-fuchsia-200 to-purple-400",
    badgeBg: "bg-purple-500/20 text-purple-300 border-purple-400/50",
    specText: "text-purple-300",
    shockColor: "#a855f7",
    titleClass: "hyper-purple-text",
    laserGradient: "from-purple-400 via-fuchsia-300 to-transparent",
    laserShadow: "rgba(168, 85, 247, 0.9)",
  },
  DARK: {
    key: "DARK",
    name: "티타늄 다크",
    icon: "⚔️",
    primary: "text-slate-200",
    border: "border-slate-400",
    border50: "border-slate-400/50",
    border40: "border-slate-400/40",
    bgGradient: "from-slate-700/35 via-zinc-800/20 to-transparent",
    particleRgb1: "226, 232, 240",
    particleRgb2: "148, 163, 184",
    glowRgba: "rgba(226, 232, 240, 0.18)",
    rayRgba: "rgba(226, 232, 240, 0.03)",
    textGradient: "from-white via-slate-200 to-slate-400",
    badgeBg: "bg-slate-700/40 text-slate-200 border-slate-400/50",
    specText: "text-slate-100",
    shockColor: "#e2e8f0",
    titleClass: "hyper-gold-text",
    laserGradient: "from-slate-300 via-slate-400 to-transparent",
    laserShadow: "rgba(226, 232, 240, 0.8)",
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
  const numberBadgeRef = useRef(null);
  const gymBadgeRef = useRef(null);

  // 현재 테마 설정 추출
  const theme = THEME_CONFIGS[colorTheme] || THEME_CONFIGS.GOLD;

  const {
    playerNumber = "",
    playerName = "",
    playerGym = "",
    heightWeight = "",
    stagePhoto1,
    stagePhoto2,
    stagePhotoUrl1,
    stagePhotoUrl2,
    stagePhotoUrl,
    profileImageUrl,
    photoUrl,
    playerPhoto,
    photos,
    backgroundPhotoUrl,
    categoryTitle,
    gradeTitle,
  } = player || {};

  const catTitle =
    categoryTitle ||
    player?.categoryTitle ||
    player?.contestCategoryTitle ||
    stageInfo?.categoryTitle ||
    "공식 종목";

  const grdTitle =
    gradeTitle ||
    player?.gradeTitle ||
    player?.contestGradeTitle ||
    player?.playerGrade ||
    player?.playerClass ||
    player?.classTitle ||
    player?.grade ||
    stageInfo?.gradeTitle ||
    "";

  // CLASS (체급/구분) 표시값: 체급명이 있으면 체급명, 단일 체급일 경우 OPEN
  const classDisplay =
    grdTitle ||
    player?.gradeTitle ||
    player?.contestGradeTitle ||
    player?.playerGrade ||
    player?.playerClass ||
    player?.classTitle ||
    stageInfo?.gradeTitle ||
    "OPEN";

  const isValidPhoto = (u) =>
    typeof u === "string" &&
    u.trim().length > 5 &&
    !u.toLowerCase().includes("poster") &&
    !u.toLowerCase().includes("banner") &&
    !u.toLowerCase().includes("logo") &&
    !u.toLowerCase().includes("certificate");

  const validPhotos = (Array.isArray(photos) ? photos : []).filter(isValidPhoto);
  
  // 1번 사진: 3:4 메인 인물 사진 (전면 히어로)
  const heroPhoto =
    (isValidPhoto(stagePhoto1) && stagePhoto1) ||
    (isValidPhoto(stagePhotoUrl1) && stagePhotoUrl1) ||
    (isValidPhoto(player?.stagePhoto1) && player?.stagePhoto1) ||
    (isValidPhoto(player?.stagePhotoUrl1) && player?.stagePhotoUrl1) ||
    (isValidPhoto(stagePhotoUrl) && stagePhotoUrl) ||
    (isValidPhoto(profileImageUrl) && profileImageUrl) ||
    (isValidPhoto(photoUrl) && photoUrl) ||
    (isValidPhoto(playerPhoto) && playerPhoto) ||
    validPhotos[0] ||
    null;

  // 2번 사진: 16:9 와이드 배경 사진 (배경 컷)
  const fallback2nd = validPhotos.length > 1 ? validPhotos[1] : "";
  const rawBgPhoto =
    (isValidPhoto(stagePhoto2) && stagePhoto2) ||
    (isValidPhoto(stagePhotoUrl2) && stagePhotoUrl2) ||
    (isValidPhoto(backgroundPhotoUrl) && backgroundPhotoUrl) ||
    (isValidPhoto(player?.stagePhoto2) && player?.stagePhoto2) ||
    (isValidPhoto(player?.stagePhotoUrl2) && player?.stagePhotoUrl2) ||
    (isValidPhoto(player?.backgroundPhotoUrl) && player?.backgroundPhotoUrl) ||
    (isValidPhoto(fallback2nd) && fallback2nd) ||
    "";

  // 1번과 2번이 동일한 단일 사진일 경우 배경을 비우고 비디오로 폴백 (중복 방지)
  const bgPhoto = rawBgPhoto && rawBgPhoto !== heroPhoto ? rawBgPhoto : "";

  const videoSrc = backgroundVideoUrl || defaultIntroVideo;

  const numberChars = playerNumber ? (`#${playerNumber}`).split("") : [];
  const nameChars = playerName ? playerName.split("") : [];

  const hwParts = heightWeight ? heightWeight.split("/").map((s) => s.trim()) : [];
  const rawH = hwParts[0] || player?.playerHeight || player?.height || "";
  const rawW = hwParts[1] || player?.playerWeight || player?.weight || "";

  const heightValue = rawH ? (rawH.includes("cm") ? rawH : `${rawH}cm`) : "-";
  const weightValue = rawW ? (rawW.includes("kg") ? rawW : `${rawW}kg`) : "-";

  // 🎬 GSAP 묵직한 타격감 타임라인
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      gsap.set(flashRef.current, { opacity: 1, backgroundColor: "#ffffff" });
      if (bgPhotoRef.current) {
        gsap.set(bgPhotoRef.current, { opacity: 0 });
      }
      gsap.set(heroImageRef.current, {
        opacity: 0,
      });
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

      // 🎬 [0.10s] 16:9 와이드 배경 컷 안정적인 페이드인
      if (bgPhotoRef.current) {
        tl.to(bgPhotoRef.current, {
          opacity: 1,
          duration: 0.6,
          ease: "power2.out",
        }, 0.10);
      }

      // 💥 [0.15s] 3:4 메인 히어로 컷 안정적인 페이드인 (고정)
      tl.to(heroImageRef.current, {
        opacity: 1,
        duration: 0.6,
        ease: "power2.out",
      }, 0.15);

      // 🎲 [0.40s] 배부번호 3D 스탬핑 쾅! (#100)
      tl.to(numberBadgeRef.current, {
        opacity: 1,
        scale: 1,
        rotationY: 0,
        duration: 0.6,
        ease: "elastic.out(1, 0.6)",
      }, 0.40);

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
    }, containerRef);

    return () => ctx.revert();
  }, [player?.playerNumber, colorTheme]);

  // 🫧 [다이내믹 3D 라이트 버블 & 물방울 캔버스 엔진]
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let time = 0;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // 하단에서 솟아오르는 투명 3D 물방울 / 오브 (105개)
    const bubbleCount = 105;
    const bubbles = Array.from({ length: bubbleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * (height + 100),
      vx: (Math.random() - 0.5) * 0.6,
      vy: -Math.random() * 2.0 - 0.8,
      size: Math.random() * 4.5 + 1.2,
      alpha: Math.random() * 0.65 + 0.25,
      pulseSpeed: Math.random() * 0.03 + 0.01,
      color: Math.random() > 0.35 ? theme.particleRgb1 : theme.particleRgb2,
    }));

    const render = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      bubbles.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx + Math.sin(time * 1.5 + p.y * 0.018) * 0.8;
        p.alpha += Math.sin(time * p.pulseSpeed * 10) * 0.015;

        if (p.y < -30) {
          p.y = height + Math.random() * 40;
          p.x = Math.random() * width;
          p.alpha = Math.random() * 0.65 + 0.25;
        }
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        ctx.save();
        ctx.beginPath();
        
        // 3D 입체 투명 구체 버블 그라디언트
        const grad = ctx.createRadialGradient(
          p.x - p.size * 0.32,
          p.y - p.size * 0.32,
          p.size * 0.08,
          p.x,
          p.y,
          p.size
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, p.alpha * 1.6)})`);
        grad.addColorStop(0.35, `rgba(${p.color}, ${Math.min(1, p.alpha * 0.95)})`);
        grad.addColorStop(0.85, `rgba(${p.color}, ${Math.min(1, p.alpha * 0.35)})`);
        grad.addColorStop(1, `rgba(${p.color}, 0)`);

        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.shadowColor = `rgba(${p.color}, 0.85)`;
        ctx.shadowBlur = 10;
        ctx.fill();

        // 버블 상단 하이라이트 광택 점
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.32, p.y - p.size * 0.32, Math.max(0.8, p.size * 0.22), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, p.alpha * 1.2)})`;
        ctx.fill();

        ctx.restore();
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
      className="relative w-screen h-screen overflow-hidden bg-transparent text-white select-none"
    >
      {/* ======================= [ Layer 1: 16:9 와이드 배경 사진 (배경 비디오와 자연스러운 시네마틱 융합 블렌딩) ] ======================= */}
      {bgPhoto && (
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <img
            ref={bgPhotoRef}
            src={bgPhoto}
            alt="16:9 무대 배경"
            className="w-full h-full object-cover filter brightness-95 contrast-105 bg-photo-cinematic-blend opacity-85"
          />
          {/* 좌측 텍스트 가독성을 위한 시네마틱 다크 비네팅 & 바닥 안착 그라디언트 */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/45 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/60 pointer-events-none" />
        </div>
      )}

      {/* ======================= [ Layer 3: WebGL / Canvas 테마 파티클 캔버스 ] ======================= */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-2" />

      {/* ⚡ 화면 충격파 플래시 */}
      <div ref={flashRef} className="absolute inset-0 z-40 pointer-events-none bg-white" />

      {/* ======================= [ Layer 4: 상단 공식 대회 헤더 바 ] ======================= */}
      <div className="bar-elem relative z-20 flex items-center justify-between px-6 sm:px-10 lg:px-16 pt-4 sm:pt-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className={`flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-xl ${theme.badgeBg} border backdrop-blur-2xl font-black text-[10px] sm:text-xs tracking-widest uppercase shadow-lg`}>
            {/* 🔴 실시간 스테이지 라이브 EQ 펄스 바 */}
            <div className="flex items-end gap-0.5 h-3.5 mr-1">
              <span className="w-0.5 bg-current rounded-full eq-bar-1" />
              <span className="w-0.5 bg-current rounded-full eq-bar-2" />
              <span className="w-0.5 bg-current rounded-full eq-bar-3" />
              <span className="w-0.5 bg-current rounded-full eq-bar-4" />
            </div>
            <span>OFFICIAL STAGE SPOTLIGHT</span>
          </div>
          <div className="h-4 w-[1px] bg-white/20" />
          <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight m-0 uppercase flex items-center gap-2">
            <span>{catTitle}</span>
            {grdTitle && <span className={`${theme.primary} font-mono`}>{grdTitle}</span>}
          </h2>
        </div>

        <div className="flex items-center gap-3 bg-black/80 backdrop-blur-2xl px-5 py-2 rounded-2xl border border-white/15 shadow-2xl">
          <TrophyOutlined className={`${theme.primary} text-xl`} />
          <span className="text-xs font-black tracking-widest text-slate-200 uppercase">
            ATHLETE PROFILE
          </span>
        </div>
      </div>

      {/* ======================= [ Layer 5: 메인 뷰 (16:9, 4:3, 1:1 반응형 완벽 대응) ] ======================= */}
      <div className={`relative z-10 w-full h-[calc(100vh-130px)] flex items-center ${heroPhoto ? "justify-between" : "justify-center"} gap-4 sm:gap-8 px-6 sm:px-10 lg:px-16 overflow-hidden`}>
        
        {/* -------------------- [ 선수 핵심 BIO 영역 (사진이 없으면 중앙 집중 정렬) ] -------------------- */}
        <div className={`space-y-4 sm:space-y-6 ${heroPhoto ? "w-[45%] max-w-xl shrink-0" : "w-full max-w-2xl mx-auto flex flex-col items-center text-center justify-center"} z-20`}>
          
          {/* ① 배부번호 3D 스탬핑 (#100) */}
          <div
            ref={numberBadgeRef}
            className={`inline-flex items-center gap-3 sm:gap-4 bg-gradient-to-r ${theme.bgGradient} ${heroPhoto ? "border-l-4 rounded-r-3xl pl-4 sm:pl-6 pr-6 sm:pr-10" : "border-2 rounded-3xl px-6 sm:px-10"} ${theme.border} py-2 sm:py-2.5 backdrop-blur-2xl shadow-2xl`}
          >
            <div className="flex flex-col">
              <span className={`text-[10px] font-black tracking-[0.3em] uppercase ${theme.primary}`}>
                ENTRY NO
              </span>
              <span className="text-xs text-slate-300 font-bold">배부번호</span>
            </div>

            <div className={`flex items-center font-mono font-black text-5xl sm:text-6xl lg:text-7xl tracking-tighter ${theme.primary} neon-number-glow`}>
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
              background: heroPhoto
                ? `linear-gradient(to right, ${theme.shockColor}, transparent)`
                : `linear-gradient(to right, transparent, ${theme.shockColor}, transparent)`,
              boxShadow: `0 0 12px ${theme.laserShadow}`,
            }}
          />

          {/* ② 이름 글자별 묵직한 타격 리빌 (인 ➜ 경 ➜ 미) */}
          <div className="space-y-1">
            <div className={`text-xs font-black tracking-widest text-slate-400 uppercase flex items-center ${heroPhoto ? "" : "justify-center"} gap-2`}>
              <UserOutlined className={theme.primary} />
              <span>ATHLETE NAME</span>
            </div>
            
            <div className={`flex items-center gap-2 sm:gap-3 flex-wrap ${heroPhoto ? "" : "justify-center"}`}>
              {nameChars.map((char, i) => (
                <span
                  key={i}
                  className={`name-char inline-block text-6xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-none m-0 uppercase drop-shadow-[0_15px_40px_rgba(0,0,0,0.95)] ${theme.titleClass}`}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>

          {/* ③ 소속 헬스장 (포항IN) */}
          <div
            ref={gymBadgeRef}
            className={`flex items-center ${heroPhoto ? "" : "justify-center"} gap-3 sm:gap-4 text-xl sm:text-2xl lg:text-3xl text-slate-100 font-black`}
          >
            <div className={`p-2 sm:p-2.5 rounded-2xl bg-white/10 border ${theme.border50} ${theme.primary} shadow-xl`}>
              <EnvironmentOutlined />
            </div>
            <span className="break-keep font-black tracking-tight drop-shadow-md">
              {playerGym || "무소속 / 개인 출전"}
            </span>
          </div>

          {/* ④ BIO 스펙 항목별 순차 팝업 */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 pt-1 w-full">
            {/* 1. HEIGHT */}
            <div className={`bio-card-item bg-black/80 backdrop-blur-2xl border ${theme.border40} rounded-2xl p-2.5 sm:p-3.5 shadow-xl`}>
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                HEIGHT
              </span>
              <span className={`text-lg sm:text-xl lg:text-2xl font-black font-mono ${theme.specText}`}>
                {heightValue}
              </span>
            </div>

            {/* 2. WEIGHT */}
            <div className={`bio-card-item bg-black/80 backdrop-blur-2xl border ${theme.border40} rounded-2xl p-2.5 sm:p-3.5 shadow-xl`}>
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                WEIGHT
              </span>
              <span className={`text-lg sm:text-xl lg:text-2xl font-black font-mono ${theme.specText}`}>
                {weightValue}
              </span>
            </div>

            {/* 3. CLASS */}
            <div className={`bio-card-item bg-black/80 backdrop-blur-2xl border ${theme.border40} rounded-2xl p-2.5 sm:p-3.5 shadow-xl`}>
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                CLASS
              </span>
              <span className="text-xs sm:text-sm lg:text-base font-black text-slate-200 truncate block">
                {classDisplay}
              </span>
            </div>
          </div>

        </div>

        {/* -------------------- [ 우측: 1번 메인 사진 (사진이 있을 때만 프레임 렌더링) ] -------------------- */}
        {heroPhoto && (
          <div className="flex-1 h-full flex items-center justify-center relative z-10 pl-2">
            
            {/* 뒤쪽 3D 테마 글로우 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none"
              style={{ backgroundColor: theme.glowRgba }}
            />

            {/* 🌟 헐리우드급 아나모픽 호라이즌 렌즈 플레어 스트릭 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[3px] pointer-events-none animate-anamorphic-flare z-0"
              style={{
                background: `linear-gradient(to right, transparent, ${theme.shockColor}, #ffffff, ${theme.shockColor}, transparent)`,
                boxShadow: `0 0 24px 2px ${theme.laserShadow}`,
              }}
            />

            {/* 🌫️ 무대 스모크/포그 앰비언스 이펙트 */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[540px] h-[380px] bg-white/10 rounded-full blur-[90px] animate-pulse pointer-events-none" />
            </div>

            {/* 🖼️ 1번 메인 사진 (3:4 비율 전용 박스 + 센터 정렬 + 럭셔리 크롬 림 & 라이트 스윕) */}
            <div
              ref={heroWrapperRef}
              className="relative h-[74vh] sm:h-[78vh] lg:h-[82vh] max-h-[800px] aspect-[3/4] flex items-center justify-center rounded-[32px] overflow-hidden border border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.95)] z-10"
            >
              <img
                ref={heroImageRef}
                src={heroPhoto}
                alt={playerName}
                className="w-full h-full object-cover object-top hero-photo-34-mask drop-shadow-[0_25px_80px_rgba(0,0,0,0.98)]"
              />

              {/* ✨ 대각선 챔피언 크롬 라이트 스윕 (Card Light Sheen) */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="w-[200%] h-[200%] bg-gradient-to-r from-transparent via-white/20 to-transparent animate-card-sheen" />
              </div>

              {/* 📐 정밀 프로 방송 HUD 코너 브래킷 액센트 */}
              <div className="absolute top-3 left-3 w-3.5 h-3.5 border-t-2 border-l-2 border-white/60 pointer-events-none" />
              <div className="absolute top-3 right-3 w-3.5 h-3.5 border-t-2 border-r-2 border-white/60 pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-3.5 h-3.5 border-b-2 border-l-2 border-white/60 pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-3.5 h-3.5 border-b-2 border-r-2 border-white/60 pointer-events-none" />

              {/* 테두리 이질감 완전 소멸 4방향 소프트 앰비언트 비네팅 */}
              <div className="absolute inset-0 rounded-[32px] pointer-events-none shadow-[inset_0_0_60px_rgba(0,0,0,0.9),inset_0_0_20px_rgba(0,0,0,0.95)]" />
            </div>
          </div>
        )}

      </div>

      {/* ======================= [ Layer 6: 하단 공식 라이브 상태 바 ] ======================= */}
      <div className="bar-elem relative z-20 border-t border-white/10 px-6 sm:px-10 lg:px-16 py-2.5 sm:py-3.5 bg-black/80 backdrop-blur-2xl flex items-center justify-between text-[11px] sm:text-xs text-slate-400 font-bold">
        <div className="flex items-center gap-2">
          <ThunderboltOutlined className={theme.primary} />
          <span>{contestTitle || "보디빌딩 & 피트니스"} • LIVE BROADCAST</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className={`${theme.primary} font-black tracking-widest uppercase`}>
            NOW POSING ON STAGE • 무대 위 포징
          </span>
        </div>
      </div>
    </div>
  );
};

export default AthleteIntroScene;
