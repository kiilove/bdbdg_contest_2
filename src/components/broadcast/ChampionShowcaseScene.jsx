"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  ArrowRightOutlined,
  TrophyOutlined,
  CrownOutlined,
  FireOutlined,
  StarOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import demoBodybuilderImg from "../../assets/img/demo_bodybuilder.jpg";
import defaultAwardVideo from "../../assets/mov/award2.mp4";
import { THEME_CONFIGS } from "./AthleteIntroScene";
import "./AthleteIntroScene.css";

const ChampionShowcaseScene = ({
  contestTitle,
  stageInfo,
  topPlayer,
  backgroundVideoUrl,
  colorTheme = "GOLD",
  onBackToRanking,
  onFinishCeremony,
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const flashRef = useRef(null);
  const heroImageRef = useRef(null);

  const theme = THEME_CONFIGS[colorTheme] || THEME_CONFIGS.GOLD;
  const videoSrc = backgroundVideoUrl || defaultAwardVideo;

  const playerNumber = topPlayer?.playerNumber || "100";
  const playerName = topPlayer?.playerName || "김 재 준";
  const playerGym = topPlayer?.playerGym || "Get_in";

  // 🌟 다중 선수 사진 배열 정규화 (단일 URL, photos 배열, gallery 배열 모두 완벽 지원)
  const photoList = React.useMemo(() => {
    const raw = [
      ...(Array.isArray(topPlayer?.photos) ? topPlayer.photos : []),
      ...(Array.isArray(topPlayer?.playerPhotos) ? topPlayer.playerPhotos : []),
      ...(Array.isArray(topPlayer?.gallery) ? topPlayer.gallery : []),
      ...(Array.isArray(topPlayer?.images) ? topPlayer.images : []),
      topPlayer?.profileImageUrl,
      topPlayer?.photoUrl,
      topPlayer?.playerPhoto,
      topPlayer?.photo,
    ].filter(Boolean);

    const unique = Array.from(new Set(raw));
    return unique.length > 0 ? unique : [demoBodybuilderImg];
  }, [topPlayer]);

  // 📸 4.5초마다 부드러운 사진 슬라이딩 크로스페이드
  const [activePhotoIdx, setActivePhotoIdx] = React.useState(0);

  useEffect(() => {
    if (photoList.length <= 1) return;
    const sliderTimer = setInterval(() => {
      setActivePhotoIdx((prev) => (prev + 1) % photoList.length);
    }, 4500);
    return () => clearInterval(sliderTimer);
  }, [photoList.length]);

  const catTitle = stageInfo?.categoryTitle || "남자 클래식 보디빌딩";
  const grdTitle = stageInfo?.gradeTitle || "-75KG 체급";

  const nameChars = playerName ? playerName.split("") : ["선", "수"];

  // 🌟 1. 파티클 캔버스 애니메이션 (화면 전체를 가로지르는 대형 스파크 & 금가루)
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

    // 80개의 활발한 스파크 파티클
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 3.5 + 1.2,
      speedX: (Math.random() - 0.5) * 1.2,
      speedY: -Math.random() * 2.8 - 1.2, // 화면 상단으로 시원하게 상승!
      alpha: Math.random() * 0.85 + 0.25,
      decay: Math.random() * 0.008 + 0.003,
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.alpha -= p.decay;

        // 화면 밖으로 나가거나 투명해지면 바닥에서 재소환되어 화면 끝까지 치솟음
        if (p.alpha <= 0 || p.y < -20) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + 20;
          p.alpha = Math.random() * 0.85 + 0.25;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${theme.particleRgb1 || "251, 191, 36"}, ${p.alpha})`;
        ctx.shadowBlur = 16;
        ctx.shadowColor = theme.shockColor || "#fbbf24";
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
  }, [theme]);

  // 🎬 2. GSAP 초호화 챔피언 타격 애니메이션 타임라인
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // 초기 세팅
      gsap.set(flashRef.current, { opacity: 0.95 });
      gsap.set(".champ-header", { opacity: 0, y: -40 });
      gsap.set(".champ-hero-img", {
        opacity: 0,
        x: -100,
        y: 30,
        scale: 1.2,
        filter: "blur(25px) brightness(220%)",
      });
      gsap.set(".champ-emblem", { opacity: 0, scale: 2.4, filter: "blur(15px)" });
      gsap.set(".champ-no-badge", { opacity: 0, y: 30, scale: 0.8 });
      gsap.set(".champ-name-char", { opacity: 0, y: 60, scale: 1.5, filter: "blur(12px)" });
      gsap.set(".champ-gym-badge", { opacity: 0, x: 50 });
      gsap.set(".champ-footer", { opacity: 0, y: 20 });

      // ① 0.0s: 화이트/골드 충격파 플래시 폭발
      tl.to(flashRef.current, { opacity: 0, duration: 0.6, ease: "power2.out" }, 0);

      // ② 0.1s: 상단 공식 헤더 안착
      tl.to(".champ-header", { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.1);

      // ③ 0.25s: 좌측 거대한 1위 챔피언 인물 컷 슬라이드 인 & 화면 중심 안착
      tl.to(
        ".champ-hero-img",
        {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          filter: "blur(0px) brightness(100%)",
          duration: 1.1,
          ease: "power4.out",
        },
        0.25
      );

      // ④ 0.5s: 1위 우승 엠블럼 쿵! 안착
      tl.to(
        ".champ-emblem",
        {
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.8,
          ease: "elastic.out(1.2, 0.6)",
        },
        0.5
      );

      // ⑤ 0.8s: 배부번호 NO. 100 뱃지 쾅!
      tl.to(
        ".champ-no-badge",
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          ease: "back.out(2)",
        },
        0.8
      );

      // ⑥ 1.0s: 초대형 성명 글자별 순차 폭발 안착 (쿵! 쿵! 쿵!)
      tl.to(
        ".champ-name-char",
        {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.6,
          stagger: 0.12,
          ease: "elastic.out(1.3, 0.55)",
        },
        1.0
      );

      // ⑦ 1.4s: 소속 체육관 뱃지 슬라이드 인
      tl.to(
        ".champ-gym-badge",
        {
          opacity: 1,
          x: 0,
          duration: 0.6,
          ease: "power3.out",
        },
        1.35
      );

      // ⑧ 1.6s: 하단 공식 방송 바 마무리
      tl.to(".champ-footer", { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 1.55);

      // 🌟 선수 인물 컷 숨쉬는 듯한 호흡(Breathing & Subtle Float) 애니메이션 시원하게 상하 부유
      gsap.to(".champ-hero-img", {
        y: -24,
        duration: 3.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 1.3,
      });

      // 엠블럼 은은한 펄스
      gsap.to(".champ-emblem", {
        scale: 1.04,
        duration: 2.0,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 1.5,
      });
    }, containerRef);

    return () => ctx.revert();
  }, [topPlayer, theme]);

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
          className="w-full h-full object-cover opacity-45 filter contrast-125 brightness-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/70" />
      </div>

      {/* 🌟 [Layer 1: 앰비언트 글로우 & 회전 갓레이 빔] */}
      <div
        className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] rounded-full blur-[220px] pointer-events-none z-1"
        style={{ backgroundColor: theme.glowRgba }}
      />

      {/* ⚡ [Layer 40: 순간 충격파 플래시] */}
      <div ref={flashRef} className="absolute inset-0 z-40 pointer-events-none bg-white" />

      {/* ======================= [ Layer 30: 상단 공식 챔피언 헤더 바 ] ======================= */}
      <div className="champ-header relative z-30 flex items-center justify-between border-b border-white/15 pb-4">
        <div className="flex items-center gap-4">
          <div className={`w-3.5 h-12 rounded-full bg-gradient-to-b ${theme.textGradient}`} />
          <div>
            <div className={`text-xs font-black tracking-widest ${theme.primary} uppercase flex items-center gap-1.5`}>
              <CrownOutlined className="text-amber-400 animate-pulse text-base" />
              <span>OFFICIAL 1ST PLACE CHAMPION • 1위 대상 단독 세레모니</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white m-0 tracking-tight leading-tight">
              {catTitle} <span className={`${theme.primary} ml-2 font-mono`}>{grdTitle}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5 bg-black/80 backdrop-blur-2xl px-6 py-2.5 rounded-2xl border border-white/20 shadow-2xl">
            <CheckCircleOutlined className="text-emerald-400 text-lg" />
            <span className="text-xs font-black text-slate-100 uppercase tracking-wider">
              공식 1위 대상 우승 확정
            </span>
          </div>
        </div>
      </div>

      {/* ======================= [ Layer 10: 메인 중앙 1위 챔피언 인물 & 프로필 정보 ] ======================= */}
      <div className="relative z-10 my-auto flex flex-col lg:flex-row items-center justify-between px-6 lg:px-16 gap-8 w-full h-[calc(100vh-170px)] py-2">
        
        {/* 좌측: 1위 챔피언 다중 스튜디오 인물 컷 슬라이더 */}
        <div className="relative flex items-center justify-center h-full max-h-[82vh] w-full lg:w-1/2">
          
          {/* 뒤 거대한 CHAMPION 워터마크 타이포그래피 */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/[0.05] font-black text-[12rem] lg:text-[16rem] leading-none pointer-events-none select-none font-mono tracking-tighter">
            WINNER
          </div>

          {/* 림 라이트 글로우 링 */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none"
            style={{ backgroundColor: theme.glowRgba }}
          />

          {/* 📸 다중 사진 부드러운 크로스페이드 슬라이더 */}
          <div className="champ-hero-img relative w-full h-full flex items-center justify-center">
            {photoList.map((photoUrl, pIdx) => {
              const isActive = pIdx === activePhotoIdx;
              return (
                <img
                  key={`champ-p-${pIdx}`}
                  src={photoUrl}
                  alt={`${playerName} - ${pIdx + 1}`}
                  className={`absolute max-h-[80vh] w-auto object-contain hero-photo-flawless-mask drop-shadow-[0_30px_90px_rgba(0,0,0,0.98)] transition-all duration-1000 ease-in-out ${
                    isActive
                      ? "opacity-100 scale-100 z-10 filter blur-0"
                      : "opacity-0 scale-105 z-0 pointer-events-none filter blur-sm"
                  }`}
                />
              );
            })}
          </div>

          {/* 📸 다중 사진 인디케이터 닷 (사진이 2장 이상일 때만 표시) */}
          {photoList.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/15">
              {photoList.map((_, dotIdx) => (
                <div
                  key={dotIdx}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    dotIdx === activePhotoIdx
                      ? "w-6 bg-amber-400 shadow-md shadow-amber-400/50"
                      : "w-2 bg-white/30"
                  }`}
                />
              ))}
            </div>
          )}

          {/* 얇고 자연스러운 바닥 페이더 (인물을 가리지 않음) */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-15" />
        </div>

        {/* 우측: 1위 챔피언 초호화 골드 프로필 정보 */}
        <div className="space-y-6 max-w-2xl w-full z-10 text-center lg:text-left">
          
          {/* ① 👑 [1위] 압도적인 초대형 황금 엠블럼 (사족 문구 100% 제거) */}
          <div className="champ-emblem inline-flex items-center gap-4 bg-gradient-to-r from-amber-500/40 via-amber-900/60 to-black/95 border-2 border-amber-400 px-9 py-4 rounded-3xl backdrop-blur-2xl shadow-[0_15px_50px_rgba(251,191,36,0.5)]">
            <CrownOutlined className="text-amber-400 text-4xl sm:text-5xl animate-bounce" />
            <span className="text-4xl sm:text-5xl lg:text-6xl font-black text-amber-300 tracking-tight drop-shadow-[0_4px_15px_rgba(251,191,36,0.8)] font-sans">
              1위
            </span>
          </div>

          {/* ② 배부번호 & 출전 종목/체급 */}
          <div className="champ-no-badge flex items-center justify-center lg:justify-start gap-4 pt-1">
            <span className={`px-6 py-2 rounded-2xl bg-black/90 border-2 ${theme.border} font-mono font-black text-3xl sm:text-4xl ${theme.primary} shadow-2xl`}>
              NO.{playerNumber}
            </span>
            <div className="text-left">
              <span className="text-xl sm:text-2xl font-black text-white leading-tight block">
                {catTitle}
              </span>
              <span className={`text-base sm:text-lg font-bold ${theme.primary}`}>
                {grdTitle}
              </span>
            </div>
          </div>

          {/* ③ 초대형 선수 성명 */}
          <div className="pt-2">
            <h1 className="text-7xl sm:text-8xl lg:text-9xl font-black text-white m-0 tracking-tight leading-none drop-shadow-[0_20px_60px_rgba(0,0,0,0.98)] flex items-center justify-center lg:justify-start gap-3">
              {nameChars.map((char, cIdx) => (
                <span
                  key={cIdx}
                  className={`champ-name-char inline-block ${theme.glintClass}`}
                >
                  {char}
                </span>
              ))}
            </h1>
          </div>

          {/* ④ 선수 소속 클럽 / 체육관 */}
          <div className="champ-gym-badge pt-2">
            <div className="inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-slate-900/90 border border-white/20 backdrop-blur-2xl shadow-2xl">
              <TrophyOutlined className={`${theme.primary} text-2xl sm:text-3xl`} />
              <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
                소속 : <span className={theme.primary}>{playerGym || "무소속"}</span>
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* 🌟 [Layer 25: 화면 전체를 가로지르는 황금빛 파티클 캔버스] */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-25" />

      {/* ======================= [ Layer 30: 하단 공식 방송 바 ] ======================= */}
      <div className="champ-footer relative z-30 flex items-center justify-between border-t border-white/15 pt-3 shrink-0">
        <div className="text-sm text-slate-300 font-bold flex items-center gap-2">
          <ThunderboltOutlined className={theme.primary} />
          <span>{contestTitle}</span>
        </div>

        <div className={`text-sm font-black tracking-widest ${theme.primary} font-mono`}>
          OFFICIAL CHAMPION
        </div>
      </div>
    </div>
  );
};

export default ChampionShowcaseScene;
