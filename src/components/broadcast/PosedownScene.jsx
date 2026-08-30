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
    durationSeconds: 10,
    weight: 3,
  },
  {
    id: "comm_2",
    name: "MONSTER ENERGY",
    slogan: "공식 에너지 드링크 파트너 - 한계를 뛰어넘어라!",
    tag: "OFFICIAL ENERGY",
    mediaType: "image",
    imageUrl: demoBodybuilderImg,
    duration: 5,
    durationSeconds: 5,
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
    durationSeconds: 10,
    weight: 2,
  },
  {
    id: "comm_4",
    name: "골드짐 코리아 (GOLD'S GYM)",
    slogan: "월드 클래스 피트니스 센터 & 공식 트레이닝 파트너",
    tag: "GOLD PARTNER",
    mediaType: "image",
    imageUrl: demoBodybuilderImg,
    duration: 5,
    durationSeconds: 5,
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
  isAudioEnabled = false,
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

  const progressBarRef = useRef(null);

  // 🎯 현재 송출 중인 광고
  const [currentAd, setCurrentAd] = useState(() =>
    prepareNextAd(basePool, null, "STAGE_LIVE", "POSEDOWN") || basePool[0]
  );
  const currentAdRef = useRef(currentAd);
  currentAdRef.current = currentAd;

  // 🔄 무한 사이클 제어용 state
  const [adCycle, setAdCycle] = useState(0);

  // 🚀 종료 1.5초 전에 광고 엔진에게 미리 물어봐서 프리로드할 '다음 광고'
  const [upcomingAd, setUpcomingAd] = useState(null);

  // ⏱️ [핵심] 스폰서별 커스텀 노출 시간 (영상 기본 10초 / 로고·이미지 기본 5초 or 사용자 설정 초)
  const isCurrentVideo =
    currentAd?.mediaType === "video" ||
    currentAd?.mediaType === "VIDEO" ||
    !!currentAd?.videoUrl;
  const displayAdDurationSeconds =
    Number(currentAd?.durationSeconds || currentAd?.duration) ||
    (isCurrentVideo ? 10 : 5);
  // 🌟 [유저 요구사항] 표기는 10초로 표시하되, 실제 동영상 재생은 +1초(11초)를 주어 마지막 1초가 급하게 바뀌지 않도록 여유 버퍼 부여
  const actualDurationSeconds = isCurrentVideo
    ? displayAdDurationSeconds + 1
    : displayAdDurationSeconds;
  const adDurationMs = Math.max(2000, actualDurationSeconds * 1000);

  // ⏱️ 1초에 1번만 업데이트되어 리렌더링 부하를 95% 절감하는 카운트다운 state
  const [remainingSeconds, setRemainingSeconds] = useState(displayAdDurationSeconds);

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

  // ⏱️ [초경량 고성능 타이머] React 리렌더링 없이 GPU 가속으로 부드럽게 프로그레스 바를 구동하고, 1초에 1번만 UI 갱신
  useEffect(() => {
    setRemainingSeconds(displayAdDurationSeconds);
    setUpcomingAd(null);
    if (progressBarRef.current) {
      progressBarRef.current.style.width = "0%";
    }

    const startTime = Date.now();
    let isPrefetched = false;
    let nextTarget = null;
    let animFrameId = null;

    // 1. 60FPS DOM 직접 제어 프로그레스 바 (React 리렌더링 0회)
    const updateBar = () => {
      const elapsed = Date.now() - startTime;
      const progressPercent = Math.min((elapsed / adDurationMs) * 100, 100);
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${progressPercent}%`;
      }
      if (elapsed < adDurationMs) {
        animFrameId = requestAnimationFrame(updateBar);
      }
    };
    animFrameId = requestAnimationFrame(updateBar);

    // 2. 1초에 1번만 숫자 카운트다운 갱신 (CPU 메인스레드 부하 0%에 수렴)
    const secondTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainMs = Math.max(0, adDurationMs - elapsed);
      const remainSec = Math.max(1, Math.ceil((remainMs / adDurationMs) * displayAdDurationSeconds));
      setRemainingSeconds(remainSec);
    }, 1000);

    // 3. 종료 1.5초 전 다음 광고 사전 프리패치
    const prefetchDelay = Math.max(0, adDurationMs - 1500);
    const prefetchTimer = setTimeout(() => {
      if (!isPrefetched) {
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
    }, prefetchDelay);

    // 4. 설정 시간 완료 시 다음 광고로 전환
    const switchTimer = setTimeout(() => {
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
    }, adDurationMs);

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      clearInterval(secondTimer);
      clearTimeout(prefetchTimer);
      clearTimeout(switchTimer);
    };
  }, [adCycle, currentAdKey, adDurationMs, displayAdDurationSeconds]);

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

      // 타이틀 부드러운 펄스 (좌측 기준 확대)
      gsap.to(".posedown-title", {
        scale: 1.02,
        transformOrigin: "center left",
        duration: 0.9,
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

      {/* ======================= [ Layer 30: 1. 상단 공식 헤더 ] ======================= */}
      <div className="relative z-30 flex items-center justify-between border-b border-white/15 pb-2.5 sm:pb-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl ${theme.badgeBg} border backdrop-blur-xl font-black text-xs sm:text-sm tracking-wider uppercase shadow-lg shrink-0`}>
            <FireOutlined className="text-amber-400 animate-pulse text-sm sm:text-base" />
            <span className="text-white">POSEDOWN BATTLE</span>
          </div>
          <div className="h-4 w-[1px] bg-white/20 shrink-0" />
          <h1 className="text-sm sm:text-lg lg:text-xl font-black text-white m-0 tracking-tight leading-tight truncate">
            {catTitle} {grdTitle && <span className={`${theme.primary} ml-2 font-mono`}>{grdTitle}</span>}
          </h1>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-black/70 px-3.5 py-1.5 rounded-xl border border-white/15 text-xs text-slate-300 font-bold shrink-0">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span>자유 포징 배틀 진행중</span>
        </div>
      </div>

      {/* ======================= [ Layer 10: 2. 세로형 전광판: 상단 광고 + 하단 포즈다운 배틀 ] ======================= */}
      <div className="relative z-10 my-auto flex flex-col gap-3 w-full h-[calc(100vh-110px)] py-1 overflow-hidden">
        
        {/* ================= 상단: 📢 공식 스폰서 광고 상영관 (가로 꽉 채움) ================= */}
        <div
          className="posedown-ad-screen flex flex-col rounded-2xl overflow-hidden bg-slate-950/90 border-2 border-amber-400/70 shadow-[0_20px_60px_rgba(251,191,36,0.35)] backdrop-blur-2xl relative shrink-0 w-full"
          style={{ height: "45%" }}
        >
          
          {/* ① 광고 상단 헤더 & 프로그레스 바 */}
          <div className="bg-black/85 backdrop-blur-xl px-4 py-2 border-b border-white/15 flex items-center justify-between z-20 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <NotificationOutlined className="text-amber-400 text-sm animate-pulse shrink-0" />
              <div className="min-w-0">
                <div className="text-[9px] font-mono font-black text-amber-400 uppercase tracking-wider">
                  OFFICIAL SPONSOR
                </div>
                <div className="text-xs sm:text-sm font-black text-white truncate max-w-[200px]">
                  {currentAd?.name || "공식 협찬사"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md">
                {displayAdDurationSeconds}초
              </span>
              <span className="text-xs font-mono font-black text-amber-300">
                {remainingSeconds}s
              </span>
            </div>
          </div>

          {/* 광고 프로그레스 바 */}
          <div className="w-full bg-black/60 h-1 z-20 shrink-0 overflow-hidden border-b border-white/10">
            <div
              ref={progressBarRef}
              className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 h-full shadow-[0_0_15px_rgba(251,191,36,1)]"
              style={{ width: "0%" }}
            />
          </div>

          {/* ② 광고 메인 미디어 뷰 */}
          <div className="relative flex-1 w-full h-full overflow-hidden bg-slate-950 flex items-center justify-center">
            {isAdVideo ? (
              <>
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
                  <video
                    ref={adVideoRef}
                    key={`ad-v-${currentAd?.id || currentAd?.name}`}
                    src={adMediaSrc}
                    autoPlay
                    loop
                    muted={!isAudioEnabled}
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 하단 스폰서 오버레이 */}
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black via-black/80 to-transparent z-10 text-left space-y-0.5 pointer-events-none">
                  {currentAd?.tag && (
                    <span className="inline-block text-[9px] font-mono font-black px-2 py-0.5 rounded bg-amber-400 text-slate-950 uppercase shadow-md mb-0.5">
                      {currentAd.tag}
                    </span>
                  )}

                  <h2 className="text-sm sm:text-base font-black text-white m-0 tracking-tight leading-tight drop-shadow-md truncate">
                    {currentAd?.name}
                  </h2>

                  {currentAd?.slogan && (
                    <p className="text-[11px] font-bold text-amber-300 m-0 truncate drop-shadow">
                      {currentAd.slogan}
                    </p>
                  )}
                </div>
              </>
            ) : (
              /* 로고/이미지 광고 */
              <div className="relative w-full h-full flex items-center justify-center p-3 overflow-hidden bg-slate-950">
                {adMediaSrc && (
                  <img
                    src={adMediaSrc}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-110 pointer-events-none"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-tr from-black via-slate-950/90 to-black pointer-events-none" />

                <div className="relative z-10 w-[94%] h-[90%] rounded-2xl bg-white/[0.06] border border-white/20 p-4 backdrop-blur-xl flex items-center justify-center overflow-hidden shadow-lg group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
                  {adMediaSrc ? (
                    <img
                      key={`ad-img-${currentAd?.id || currentAd?.name}`}
                      src={adMediaSrc}
                      alt={currentAd?.name}
                      className="w-full h-full max-h-full max-w-full object-contain filter brightness-105 drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)] animate-fade-in"
                    />
                  ) : (
                    <div className="text-3xl font-black text-amber-400 font-mono">
                      {currentAd?.name?.slice(0, 2) || "LOGO"}
                    </div>
                  )}
                </div>

                {currentAd?.slogan && (
                  <div className="absolute bottom-2 left-3 right-3 z-20 text-center pointer-events-none">
                    <span className="inline-block px-3 py-0.5 rounded-full bg-black/80 border border-amber-400/50 text-[10px] font-bold text-amber-300 shadow-lg truncate max-w-[90%]">
                      "{currentAd.slogan}"
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* ================= 하단: 포즈다운 배틀 정보 (타이틀 + 타이머 + 선수 목록) ================= */}
        <div className="flex flex-col justify-center items-center text-center space-y-3 flex-1 min-w-0 overflow-hidden">
          
          {/* 🔥 POSEDOWN 타이틀 */}
          <div className="posedown-title space-y-1.5 w-full">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-600/30 border border-red-500/60 backdrop-blur-xl text-red-300 text-xs font-black uppercase tracking-wider shadow-lg">
              <FireOutlined className="animate-bounce text-amber-400" />
              <span>60 SECONDS FREE BATTLE</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-rose-200 to-red-600 m-0 tracking-tight leading-none drop-shadow-[0_15px_40px_rgba(225,29,72,0.8)]">
              POSEDOWN
            </h1>
            <p className="text-sm font-bold text-slate-200 tracking-wide drop-shadow m-0">
              무대 위 최고의 자유 포징을 펼쳐주시기 바랍니다!
            </p>
          </div>

          {/* ⏱️ 배틀 카운트다운 타이머 */}
          <div className="posedown-timer inline-flex items-center gap-4 bg-black/85 backdrop-blur-2xl border-2 border-red-500/80 px-7 py-3 rounded-2xl shadow-[0_10px_35px_rgba(239,68,68,0.45)]">
            <FieldTimeOutlined className="text-amber-400 text-3xl animate-spin" />
            <div className="text-left">
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider font-mono">
                REMAINING TIME
              </span>
              <span className="text-4xl font-black font-mono text-amber-400 leading-none">
                {seconds}초
              </span>
            </div>
          </div>

          {/* 🏷️ 출전 선수 칩 카드 그리드 */}
          {activePlayers.length > 0 && (
            <div className="space-y-1.5 w-full pt-1">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 justify-center">
                <TrophyOutlined className="text-amber-400" />
                <span>출전 선수 명단</span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 max-h-[100px] overflow-y-auto px-2">
                {activePlayers.map((player, idx) => (
                  <div
                    key={player.playerNumber || idx}
                    className="posedown-player-chip flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/20 backdrop-blur-xl shadow-md"
                  >
                    <span className="font-mono font-black text-base text-amber-400">
                      #{player.playerNumber}
                    </span>
                    <span className="text-sm font-bold text-white">
                      {player.playerName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ======================= [ Layer 30: 3. 하단 공식 방송 바 (간결하고 정돈된 1줄) ] ======================= */}
      <div className="relative z-30 flex items-center justify-between border-t border-white/15 pt-2 sm:pt-2.5 shrink-0 text-xs">
        <div className="text-slate-400 font-bold flex items-center gap-2 truncate mr-2">
          <ThunderboltOutlined className={theme.primary} />
          <span className="truncate">{contestTitle || "보디빌딩 & 피트니스"} • 포즈다운 배틀</span>
        </div>

        <div className={`font-black tracking-widest ${theme.primary} uppercase font-mono shrink-0 text-[11px]`}>
          STAGE LIVE
        </div>
      </div>

    </div>
  );
};

export default PosedownScene;
