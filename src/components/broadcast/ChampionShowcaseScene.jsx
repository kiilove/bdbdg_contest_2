import React, { useEffect, useRef, useState, useMemo } from "react";
import { gsap } from "gsap";
import {
  TrophyOutlined,
  CrownOutlined,
  FireOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
} from "@ant-design/icons";
import defaultAwardVideo from "../../assets/mov/award2.mp4";
import SmoothBackgroundVideo from "./SmoothBackgroundVideo";
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

  const theme = THEME_CONFIGS[colorTheme] || THEME_CONFIGS.GOLD;
  const videoSrc = backgroundVideoUrl || defaultAwardVideo;

  const hasChampionData = Boolean(
    topPlayer && (topPlayer.playerName || topPlayer.playerNumber)
  );

  // 🌟 데이터가 없을 때의 안전한 기본 표기
  const playerNumber = topPlayer?.playerNumber || "-";
  const playerName = topPlayer?.playerName || "데이터 없음";
  const playerGym = topPlayer?.playerGym || "심사 결과 집계 대기";

  // 🌟 실제 선수 사진 목록 (지정된 stagePhotoUrl 최우선 노출)
  const photoList = React.useMemo(() => {
    if (!hasChampionData) return [];
    const raw = [
      topPlayer?.stagePhotoUrl,
      topPlayer?.profileImageUrl,
      ...(Array.isArray(topPlayer?.photos) ? topPlayer.photos : []),
      ...(Array.isArray(topPlayer?.playerPhotos) ? topPlayer.playerPhotos : []),
      ...(Array.isArray(topPlayer?.gallery) ? topPlayer.gallery : []),
      ...(Array.isArray(topPlayer?.images) ? topPlayer.images : []),
      topPlayer?.photoUrl,
      topPlayer?.playerPhoto,
      topPlayer?.photo,
    ].filter(Boolean);

    const isValidPhoto = (u) =>
      typeof u === "string" &&
      u.trim().length > 5 &&
      !u.toLowerCase().includes("poster") &&
      !u.toLowerCase().includes("banner") &&
      !u.toLowerCase().includes("logo") &&
      !u.toLowerCase().includes("certificate");

    return Array.from(new Set(raw.filter(isValidPhoto)));
  }, [topPlayer, hasChampionData]);

  // 📸 4.5초마다 다중 사진 슬라이딩 크로스페이드
  const [activePhotoIdx, setActivePhotoIdx] = React.useState(0);

  useEffect(() => {
    if (photoList.length <= 1) return;
    const sliderTimer = setInterval(() => {
      setActivePhotoIdx((prev) => (prev + 1) % photoList.length);
    }, 4500);
    return () => clearInterval(sliderTimer);
  }, [photoList.length]);

  const catTitle =
    stageInfo?.categoryTitle ||
    topPlayer?.contestCategoryTitle ||
    topPlayer?.categoryTitle ||
    "공식 종목";

  const grdTitle =
    stageInfo?.gradeTitle ||
    topPlayer?.contestGradeTitle ||
    topPlayer?.gradeTitle ||
    "";

  // 성명 글자별 키네틱 타이포그래피 분리
  const nameChars = playerName ? playerName.split("") : ["[", "1", "위", " ", "챔", "피", "언", "]"];

  // 🌟 [Canvas: 황금빛 챔피언 축하 스파크 & 엠버 물리 파티클 엔진]
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

    const particleCount = 70;
    const particles = [];

    const sparkColors = [
      "rgba(251, 191, 36, ",
      "rgba(245, 158, 11, ",
      "rgba(254, 240, 138, ",
      "rgba(255, 255, 255, ",
    ];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 3 + 1,
        colorBase: sparkColors[Math.floor(Math.random() * sparkColors.length)],
        alpha: Math.random() * 0.8 + 0.2,
        speedX: (Math.random() - 0.5) * 1.5,
        speedY: -(Math.random() * 2 + 0.8),
        pulseSpeed: Math.random() * 0.03 + 0.01,
        angle: Math.random() * Math.PI * 2,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.angle += p.pulseSpeed;

        const dynamicAlpha = Math.max(
          0.1,
          Math.min(1, p.alpha + Math.sin(p.angle) * 0.3)
        );

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.colorBase}${dynamicAlpha})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 🎬 [GSAP 챔피언 등장 웅장한 시네마틱 타격 연출]
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // 0. 초기 상태
      gsap.set(".champ-header", { opacity: 0, y: -30 });
      gsap.set(".champ-emblem", { opacity: 0, scale: 0.1, rotation: -45 });
      gsap.set(".champ-no-badge", { opacity: 0, scale: 0.8, x: -40 });
      gsap.set(".champ-name-char", { opacity: 0, y: 120, rotationX: 90 });
      gsap.set(".champ-gym-badge", { opacity: 0, y: 40, scale: 0.9 });
      gsap.set(".champ-hero-img", { opacity: 0, scale: 1.15, filter: "brightness(2)" });
      gsap.set(".champ-footer", { opacity: 0, y: 30 });

      // [0.0s] 화이트 플래시 폭발 & 서서히 페이드
      if (flashRef.current) {
        tl.fromTo(flashRef.current, { opacity: 0.8 }, { opacity: 0, duration: 0.8, ease: "power2.out" }, 0);
      }

      // [0.1s] 상단 헤더 슬라이드
      tl.to(".champ-header", { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.1);

      // [0.3s] 좌측 챔피언 사진 안착
      tl.to(
        ".champ-hero-img",
        {
          opacity: 1,
          scale: 1,
          filter: "brightness(1)",
          duration: 1.2,
          ease: "power3.out",
        },
        0.3
      );

      // [0.6s] 👑 1위 골드 엠블럼 회전 폭발 등장
      tl.to(
        ".champ-emblem",
        {
          opacity: 1,
          scale: 1,
          rotation: 0,
          duration: 0.9,
          ease: "elastic.out(1.2, 0.5)",
        },
        0.6
      );

      // [0.9s] 배부번호 뱃지 쾅!
      tl.to(
        ".champ-no-badge",
        {
          opacity: 1,
          scale: 1,
          x: 0,
          duration: 0.6,
          ease: "back.out(2)",
        },
        0.9
      );

      // [1.1s] 초대형 이름 글자별 타격 리빌
      tl.to(
        ".champ-name-char",
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.06,
          ease: "back.out(1.8)",
        },
        1.1
      );

      // [1.6s] 소속 클럽 뱃지 슬라이드
      tl.to(
        ".champ-gym-badge",
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.5,
          ease: "power3.out",
        },
        1.6
      );

      // [1.8s] 하단 바 표시
      tl.to(
        ".champ-footer",
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "power2.out",
        },
        1.8
      );
    }, containerRef);

    return () => ctx.revert();
  }, [hasChampionData, theme]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-transparent text-white flex flex-col justify-between p-6 sm:p-8 lg:p-10 overflow-hidden select-none"
    >
      {/* ⚡ [Layer 40: 순간 충격파 플래시] */}
      <div ref={flashRef} className="absolute inset-0 z-40 pointer-events-none bg-white opacity-0" />

      {/* ======================= [ Layer 30: 상단 공식 챔피언 헤더 바 ] ======================= */}
      <div className="champ-header relative z-30 flex items-center justify-between border-b border-white/15 pb-4">
        <div className="flex items-center gap-4">
          <div className={`w-3.5 h-10 rounded-full bg-gradient-to-b ${theme.textGradient}`} />
          <div>
            <div className={`text-xs font-black tracking-widest ${theme.primary} uppercase flex items-center gap-1.5`}>
              <FireOutlined className="animate-pulse" />
              <span>OFFICIAL 1ST PLACE WINNER • 공식 1위 단독 세레모니</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white m-0 tracking-tight leading-tight">
              {catTitle} <span className={`${theme.primary} ml-2 font-mono`}>{grdTitle}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black/85 px-5 py-2 rounded-2xl border border-white/15 shadow-xl">
            {hasChampionData ? (
              <>
                <CheckCircleOutlined className="text-emerald-400 text-lg" />
                <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                  공식 1위 우승 확정
                </span>
              </>
            ) : (
              <>
                <FieldTimeOutlined className="text-amber-400 text-lg animate-pulse" />
                <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                  심사 집계 중
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ======================= [ Layer 10: 메인 중앙 컨텐츠 영역 (테스트 지원 슬롯) ] ======================= */}
      <div className="relative z-10 my-auto flex flex-col lg:flex-row items-center justify-between px-6 lg:px-16 gap-8 w-full h-[calc(100vh-170px)] py-2">
        
        {/* 좌측: 1위 챔피언 인물 컷 슬라이더 / 엠블럼 */}
        <div className="relative flex items-center justify-center h-full max-h-[82vh] w-full lg:w-1/2">
          
          {/* 거대한 CHAMPION 워터마크 */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/[0.05] font-black text-[12rem] lg:text-[16rem] leading-none pointer-events-none select-none font-mono tracking-tighter">
            WINNER
          </div>

          {/* 림 라이트 글로우 */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none"
            style={{ backgroundColor: theme.glowRgba }}
          />

          {/* 📸 다중 사진 또는 트로피 엠블럼 */}
          <div className="champ-hero-img relative w-full h-full flex items-center justify-center">
            {photoList.length > 0 ? (
              photoList.map((photoUrl, pIdx) => {
                const isActive = pIdx === activePhotoIdx;
                return (
                  <img
                    key={`champ-p-${pIdx}`}
                    src={photoUrl}
                    alt={`${playerName} - ${pIdx + 1}`}
                    className={`absolute max-h-[80vh] w-auto object-contain hero-photo-flawless-mask drop-shadow-[0_30px_90px_rgba(0,0,0,0.98)] transition-opacity duration-700 ${
                      isActive
                        ? "opacity-100 scale-100 z-10"
                        : "opacity-0 scale-100 z-0 pointer-events-none"
                    }`}
                  />
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center p-12 rounded-3xl bg-slate-950/95 border border-amber-400/40 shadow-[0_0_80px_rgba(251,191,36,0.3)]">
                <CrownOutlined className="text-8xl text-amber-400 animate-bounce mb-4" />
                <TrophyOutlined className="text-6xl text-amber-300" />
                <span className="mt-4 text-xs font-black text-amber-300/80 uppercase tracking-widest font-mono">
                  1ST PLACE TROPHY
                </span>
              </div>
            )}
          </div>

          {/* 📸 다중 사진 인디케이터 닷 */}
          {photoList.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/85 px-4 py-1.5 rounded-full border border-white/15 shadow-xl">
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

          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-15" />
        </div>

        {/* 우측: 1위 챔피언 프로필 정보 */}
        <div className="space-y-6 max-w-2xl w-full z-10 text-center lg:text-left">
          
          {/* ① 🌿 3D 골드 월계관 (Laurel Wreath) & 1위 황금 엠블럼 */}
          <div className="champ-emblem inline-flex items-center gap-5 bg-gradient-to-r from-amber-500/30 via-yellow-500/20 to-black/90 border-2 border-amber-400/80 px-8 py-3.5 rounded-3xl shadow-[0_0_40px_rgba(251,191,36,0.45)] backdrop-blur-2xl">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full filter drop-shadow-[0_0_14px_rgba(251,191,36,0.9)] animate-pulse">
                <defs>
                  <linearGradient id="goldLaurelGradShowcase" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#b45309" />
                  </linearGradient>
                </defs>
                <path d="M50 95 C30 90 15 70 18 45 C20 30 30 18 45 12" stroke="url(#goldLaurelGradShowcase)" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
                <path d="M42 16 C35 15 32 22 36 26 C40 24 43 19 42 16Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M32 27 C25 28 24 36 29 39 C33 36 34 30 32 27Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M25 42 C18 44 19 53 25 54 C28 50 28 44 25 42Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M22 58 C16 62 19 71 25 70 C27 66 26 60 22 58Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M26 74 C22 80 28 87 34 84 C35 79 32 74 26 74Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M36 87 C34 93 42 98 47 93 C47 88 42 84 36 87Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M70 95 C90 90 105 70 102 45 C100 30 90 18 75 12" stroke="url(#goldLaurelGradShowcase)" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
                <path d="M78 16 C85 15 88 22 84 26 C80 24 77 19 78 16Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M88 27 C95 28 96 36 91 39 C87 36 86 30 88 27Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M95 42 C102 44 101 53 95 54 C92 50 92 44 95 42Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M98 58 C104 62 101 71 95 70 C93 66 94 60 98 58Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M94 74 C98 80 92 87 86 84 C85 79 88 74 94 74Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M84 87 C86 93 78 98 73 93 C73 88 78 84 84 87Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M52 94 C57 92 63 92 68 94 C65 98 55 98 52 94Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M54 96 C48 104 42 108 38 110 C44 106 50 102 54 96Z" fill="url(#goldLaurelGradShowcase)"/>
                <path d="M66 96 C72 104 78 108 82 110 C76 106 70 102 66 96Z" fill="url(#goldLaurelGradShowcase)"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center -space-y-0.5 pointer-events-none">
                <CrownOutlined className="text-yellow-300 text-sm sm:text-base animate-bounce drop-shadow" />
                <span className="font-mono font-black text-2xl sm:text-3xl text-amber-300 tracking-tighter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  1<span className="text-xs sm:text-sm">ST</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                  1ST PLACE
                </span>
                <span className="text-amber-300 font-bold text-xs sm:text-sm tracking-tight flex items-center gap-1">
                  <TrophyOutlined className="text-amber-400" /> 공식 체급 1위 우승
                </span>
              </div>
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-amber-300 tracking-tight drop-shadow-[0_4px_15px_rgba(251,191,36,0.8)] font-sans">
                1위 우승자
              </span>
            </div>
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
              {grdTitle && (
                <span className={`text-base sm:text-lg font-bold ${theme.primary}`}>
                  {grdTitle}
                </span>
              )}
            </div>
          </div>

          {/* ③ 초대형 선수 성명 */}
          <div className="pt-2">
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black text-white m-0 tracking-tight leading-none drop-shadow-[0_20px_60px_rgba(0,0,0,0.98)] flex items-center justify-center lg:justify-start gap-2 sm:gap-3 flex-wrap">
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
            <div className="inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-slate-950/95 border border-white/20 shadow-2xl">
              <TrophyOutlined className={`${theme.primary} text-2xl sm:text-3xl`} />
              <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
                소속 : <span className={theme.primary}>{playerGym}</span>
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
