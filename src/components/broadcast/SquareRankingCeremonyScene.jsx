"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import { useFirestoreQuery } from "../../hooks/useFirestores";
import { where } from "firebase/firestore";
import { gsap } from "gsap";
import {
  TrophyOutlined,
  CheckCircleOutlined,
  CrownOutlined,
  ThunderboltOutlined,
  StarFilled,
  FireOutlined,
  UserOutlined,
  EnvironmentOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import defaultAwardVideo from "../../assets/mov/award2.mp4";
import defaultBody1 from "../../assets/img/body1.png";
import defaultBody2 from "../../assets/img/body2.png";
import defaultDemoBodybuilder from "../../assets/img/demo_bodybuilder.jpg";
import SmoothBackgroundVideo from "./SmoothBackgroundVideo";
import { THEME_CONFIGS } from "./AthleteIntroScene";
import "./AthleteIntroScene.css";

const SquareRankingCeremonyScene = ({
  contestTitle,
  categoryTitle = "공식 시상식",
  gradeTitle = "",
  gradeId = "",
  rankingData = [],
  backgroundVideoUrl,
  colorTheme = "GOLD",
  rankingPhase, // "FULL_RANKING" or "CHAMPION_SOLO" (Realtime DB 콘솔 제어)
  onFinishCeremony,
  autoTransitionSeconds = 3, // 1위 단독 전환까지 걸리는 시간 (빠르고 다이내믹한 3초 카운트다운)
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const flashRef = useRef(null);
  const bgPhotoRef = useRef(null);
  const heroImageRef = useRef(null);
  const numberBadgeRef = useRef(null);
  const gymBadgeRef = useRef(null);
  const card2Ref = useRef(null);
  const card3Ref = useRef(null);

  // 🎯 화면 페이즈 상태: "FULL_RANKING" (1단계: 2~10위 발표) ➜ "CHAMPION_SOLO" (2단계: 1위 선수소개급 풀스펙 단독 샷)
  const [phase, setPhase] = useState(rankingPhase || "FULL_RANKING");
  const [ranks, setRanks] = useState(rankingData);
  const [countdown, setCountdown] = useState(autoTransitionSeconds);

  // 📡 본부석 콘솔에서 rankingPhase 변경 시 즉시 동기화
  useEffect(() => {
    if (rankingPhase) {
      setPhase(rankingPhase);
    }
  }, [rankingPhase]);

  const { currentContest } = useContext(CurrentContestContext);
  const fetchResultQuery = useFirestoreQuery();

  const theme = THEME_CONFIGS[colorTheme] || THEME_CONFIGS.GOLD;
  const videoSrc = backgroundVideoUrl || defaultAwardVideo;

  // 1. 순위 데이터 정렬 및 필터링
  const processRankingData = (rawList) => {
    if (!rawList || rawList.length === 0) return [];
    return rawList
      .filter((item) => {
        const r = item.playerRank || item.rank || 0;
        return r > 0 && r <= 10 && !item.playerNoShow && !item.isRankExcluded;
      })
      .sort((a, b) => (a.playerRank || a.rank || 0) - (b.playerRank || b.rank || 0))
      .slice(0, 10);
  };

  useEffect(() => {
    if (rankingData && rankingData.length > 0) {
      setRanks(processRankingData(rankingData));
    } else if (gradeId) {
      const fetchDbRankings = async () => {
        try {
          const condition = [where("gradeId", "==", gradeId)];
          const data = await fetchResultQuery.getDocuments(
            "contest_results_list",
            condition
          );
          if (data && data.length > 0 && data[0]?.result) {
            setRanks(processRankingData(data[0].result));
          }
        } catch (error) {
          console.error("순위 데이터 DB 조회 실패:", error);
        }
      };
      fetchDbRankings();
    }
  }, [rankingData, gradeId]);

  // 1, 2, 3위 및 4~10위 슬롯 동적 추출 (실제 참가 선수 인원 수 동적 반영)
  const top1 = ranks.find((item) => (item.playerRank || 0) === 1) || (ranks.length > 0 ? ranks[0] : null);
  const top2 = ranks.find((item) => (item.playerRank || 0) === 2) || (ranks.length > 1 && ranks[1]?.playerNumber !== top1?.playerNumber ? ranks[1] : null);
  const top3 = ranks.find((item) => (item.playerRank || 0) === 3) || (ranks.length > 2 && ranks[2]?.playerNumber !== top1?.playerNumber && ranks[2]?.playerNumber !== top2?.playerNumber ? ranks[2] : null);

  const restRanks = ranks.filter(
    (item) =>
      item.playerNumber !== top1?.playerNumber &&
      item.playerNumber !== top2?.playerNumber &&
      item.playerNumber !== top3?.playerNumber
  );

  const displayTop1 = top1 || {
    playerRank: 1,
    playerNumber: "-",
    playerName: "데이터 없음",
    playerGym: "심사 결과 집계 대기",
    playerHeight: "",
    playerWeight: "",
  };

  const displayTop2 = top2 || null;
  const displayTop3 = top3 || null;
  const displayRestRanks = restRanks && restRanks.length > 0 ? restRanks : [];

  // 🗄️ 현재 대회의 실제 등록 선수 목록에서 사진 실시간 조회
  const [realPlayersMap, setRealPlayersMap] = useState({});

  useEffect(() => {
    const fetchRealPlayers = async () => {
      const cId = currentContest?.contests?.id || currentContest?.contestInfo?.id;
      if (!cId) return;
      try {
        const condition = [where("contestId", "==", cId)];
        const data = await fetchResultQuery.getDocuments("contest_players", condition);
        if (data && data.length > 0) {
          const map = {};
          data.forEach((p) => {
            if (p.playerNumber) map[String(p.playerNumber).trim()] = p;
            if (p.playerName) map[String(p.playerName).trim()] = p;
          });
          setRealPlayersMap(map);
        }
      } catch (e) {
        console.error("선수 사진 데이터 로드 실패:", e);
      }
    };
    fetchRealPlayers();
  }, [currentContest?.contests?.id, currentContest?.contestInfo?.id]);

  const matchedReal =
    realPlayersMap[String(displayTop1.playerNumber).trim()] ||
    realPlayersMap[String(displayTop1.playerName).trim()] ||
    {};

  // 📸 [선수소개급 듀얼 실제 사진 구성]
  // 1번 사진: 3:4 메인 전면 히어로 컷 (Hero Photo)
  const heroPhoto =
    displayTop1.stagePhoto1 ||
    displayTop1.stagePhotoUrl1 ||
    displayTop1.stagePhotoUrl ||
    displayTop1.profileImageUrl ||
    displayTop1.photoUrl ||
    matchedReal.stagePhoto1 ||
    matchedReal.stagePhotoUrl1 ||
    matchedReal.stagePhotoUrl ||
    matchedReal.profileImageUrl ||
    matchedReal.photoUrl ||
    null;

  // 2번 사진: 16:9 와이드 시네마틱 배경 융합 컷 (Background Photo)
  const bgPhoto =
    displayTop1.stagePhoto2 ||
    displayTop1.stagePhotoUrl2 ||
    displayTop1.backgroundPhotoUrl ||
    matchedReal.stagePhoto2 ||
    matchedReal.stagePhotoUrl2 ||
    matchedReal.backgroundPhotoUrl ||
    heroPhoto;

  const numberChars =
    displayTop1.playerNumber && displayTop1.playerNumber !== "-"
      ? (`#${displayTop1.playerNumber}`).split("")
      : ["#", "-"];
  const nameChars = (displayTop1.playerName || "데이터 없음").split("");

  const top1Hw = displayTop1.heightWeight ? displayTop1.heightWeight.split("/").map((s) => s.trim()) : [];
  const matchedHw = matchedReal.heightWeight ? matchedReal.heightWeight.split("/").map((s) => s.trim()) : [];

  const rawH =
    displayTop1.playerHeight ||
    displayTop1.height ||
    top1Hw[0] ||
    matchedReal.playerHeight ||
    matchedReal.height ||
    matchedHw[0] ||
    "";
  const rawW =
    displayTop1.playerWeight ||
    displayTop1.weight ||
    top1Hw[1] ||
    matchedReal.playerWeight ||
    matchedReal.weight ||
    matchedHw[1] ||
    "";
  const heightValue = rawH ? (rawH.includes("cm") ? rawH : `${rawH}cm`) : "-";
  const weightValue = rawW ? (rawW.includes("kg") ? rawW : `${rawW}kg`) : "-";
  const classDisplay = gradeTitle || categoryTitle || "공식 체급";

  // 🎬 Step 1: 전체 순위 발표 애니메이션 & 카운트다운 타이머
  useEffect(() => {
    if (phase !== "FULL_RANKING") return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      if (flashRef.current) {
        gsap.set(flashRef.current, { opacity: 0 });
      }

      // [0.0s] 헤더 바
      tl.fromTo(".header-bar", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 0);

      // [0.1s] 4위 이상 입상자 카드 (있을 때만)
      if (document.querySelectorAll(".rest-rank-item").length > 0) {
        tl.fromTo(".rest-rank-item", { opacity: 0, x: 30 }, {
          opacity: 1,
          x: 0,
          duration: 0.3,
          stagger: 0.05,
          ease: "power3.out",
        }, 0.1);
      }

      // [0.25s] 🥉 3위 카드 (있을 때만)
      if (card3Ref.current) {
        tl.fromTo(card3Ref.current, { opacity: 0, x: -40, scale: 0.95 }, {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.4,
          ease: "back.out(1.8)",
        }, 0.25);
      }

      // [0.5s] 🥈 2위 카드 (있을 때만)
      if (card2Ref.current) {
        tl.fromTo(card2Ref.current, { opacity: 0, x: -40, scale: 0.95 }, {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.4,
          ease: "back.out(1.8)",
        }, 0.5);
      }

      // [0.75s] 👑 1위 대상 발표 대기 뱃지 등장
      tl.fromTo(".pending-champion-box", { opacity: 0, y: 20 }, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: "power2.out",
      }, 0.75);

    }, containerRef);

    // 자동 카운트다운 ➜ 1위 단독 샷으로 전환
    let timerId = null;
    let count = autoTransitionSeconds;
    setCountdown(count);

    timerId = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(timerId);
        setPhase("CHAMPION_SOLO");
      }
    }, 1000);

    return () => {
      ctx.revert();
      if (timerId) clearInterval(timerId);
    };
  }, [phase, ranks, autoTransitionSeconds]);

  // 🎬 Step 2: 👑 선수소개급 1위 단독 하이라이트 GSAP 묵직한 타격 타임라인
  useEffect(() => {
    if (phase !== "CHAMPION_SOLO") return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      gsap.set(flashRef.current, { opacity: 1, backgroundColor: "#ffffff" });
      if (bgPhotoRef.current) {
        gsap.set(bgPhotoRef.current, { opacity: 0, scale: 1.3, x: 40 });
      }
      gsap.set(heroImageRef.current, {
        opacity: 0,
        scale: 1.25,
        y: 0,
        filter: "blur(20px)",
        transformOrigin: "50% 42%",
      });
      gsap.set(numberBadgeRef.current, { opacity: 0, scale: 2.4, rotationY: -60, transformPerspective: 900 });
      gsap.set(".laurel-wreath-container", { opacity: 0, scale: 0.8, y: -20 });
      gsap.set(".num-digit", { opacity: 0, scale: 2.5, y: -60 });
      gsap.set(".name-char", { opacity: 0, scale: 2.5, y: 50, filter: "blur(15px)" });
      gsap.set(gymBadgeRef.current, { opacity: 0, x: -80 });
      gsap.set(".bio-card-item", { opacity: 0, scale: 0.8, y: 40, filter: "blur(8px)" });
      gsap.set(".bar-elem", { opacity: 0, y: (i) => (i === 0 ? -30 : 30) });
      gsap.set(".laser-line", { scaleX: 0, transformOrigin: "left center" });

      // ⚡ [0.00s] 화면 플래시 폭발 + 공식 방송 바 슬라이드
      tl.to(flashRef.current, { opacity: 0, duration: 0.5, ease: "power2.out" }, 0);
      tl.to(".bar-elem", { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.05);

      // 🎬 [0.10s] 16:9 와이드 배경 컷 다이내믹 줌인 & 시네마틱 페이드인
      if (bgPhotoRef.current) {
        tl.to(bgPhotoRef.current, { opacity: 0.75, scale: 1.0, x: 0, duration: 1.2, ease: "power3.out" }, 0.10);
      }

      // 💥 [0.20s] 메인 챔피언 히어로 컷 웅장한 다이내믹 서지 (Scale Entrance - 위아래 흔들림 없이 줌인 안착)
      if (heroImageRef.current) {
        tl.to(heroImageRef.current, {
          opacity: 1,
          scale: 1.0,
          y: 0,
          filter: "blur(0px)",
          duration: 0.85,
          ease: "power3.out",
        }, 0.20);
      }

      // 🌿 [0.25s] 3D 황금 월계관 1위 공식 엠블럼 임팩트 등장
      tl.to(".laurel-wreath-container", {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.6,
        ease: "back.out(1.8)",
      }, 0.25);

      // 🎲 [0.35s] 배부번호 3D 스탬핑 쾅! (#15)
      tl.to(numberBadgeRef.current, {
        opacity: 1,
        scale: 1,
        rotationY: 0,
        duration: 0.6,
        ease: "elastic.out(1, 0.6)",
      }, 0.35);

      tl.to(".num-digit", {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.3,
        stagger: 0.08,
        ease: "back.out(2.0)",
      }, 0.45);

      // 레이저 라인 그어짐
      tl.to(".laser-line", { scaleX: 1, duration: 0.5, ease: "power4.out" }, 0.65);

      // 💥 [0.75s] 선수 이름 글자별 타격 리빌 (김 ➜ 챔 ➜ 피 ➜ 언)
      tl.to(".name-char", {
        opacity: 1,
        scale: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.5,
        stagger: 0.16,
        ease: "back.out(2.2)",
      }, 0.75);

      // 🏢 [1.35s] 소속 헬스장 슬라이드
      tl.to(gymBadgeRef.current, {
        opacity: 1,
        x: 0,
        duration: 0.5,
        ease: "power3.out",
      }, 1.35);

      // 📊 [1.60s] 챔피언 공식 BIO 스펙 항목별 순차 팝업 (HEIGHT ➜ WEIGHT ➜ DIVISION)
      tl.to(".bio-card-item", {
        opacity: 1,
        scale: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.4,
        stagger: 0.12,
        ease: "back.out(1.6)",
      }, 1.60);

      // 🌟 [1.80s] 히어로 이미지 시네마틱 줌인/줌아웃 (Ken Burns Breathing Loop - 위아래 흔들림 없이 깊이감 있는 줌 효과)
      if (heroImageRef.current) {
        tl.to(heroImageRef.current, {
          scale: 1.08,
          duration: 3.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        }, 1.80);
      }

    }, containerRef);

    return () => ctx.revert();
  }, [phase, colorTheme]);

  // 🫧 [다이내믹 3D 골드 라이트 버블 & 오브 캔버스 엔진]
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

    const bubbleCount = 100;
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
      className="relative w-screen h-screen bg-black text-white flex flex-col justify-between overflow-hidden select-none"
    >
      {/* 🎬 배경 비디오 */}
      <SmoothBackgroundVideo
        src={videoSrc}
        fallbackSrc={defaultAwardVideo}
        overlayGradient="from-black/85 via-black/50 to-black/90"
        gradientDirection="bg-gradient-to-t"
        isMuted={true}
      />

      {/* 🫧 캔버스 파티클 레이어 */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

      {/* ⚡ 화면 플래시 */}
      <div ref={flashRef} className="absolute inset-0 z-50 pointer-events-none bg-white opacity-0" />

      {/* ========================================================================================= */}
      {/* 1. 상단: 공식 방송 헤더 바 */}
      {/* ========================================================================================= */}
      <div className="header-bar bar-elem relative z-20 flex items-center justify-between px-4 sm:px-8 pt-3 sm:pt-4 border-b border-white/15 pb-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl ${theme.badgeBg} border backdrop-blur-2xl font-black text-[10px] sm:text-xs tracking-widest uppercase shadow-lg`}>
            {/* 🔴 실시간 스테이지 라이브 EQ 펄스 바 */}
            <div className="flex items-end gap-0.5 h-3.5 mr-1">
              <span className="w-0.5 bg-current rounded-full eq-bar-1" />
              <span className="w-0.5 bg-current rounded-full eq-bar-2" />
              <span className="w-0.5 bg-current rounded-full eq-bar-3" />
              <span className="w-0.5 bg-current rounded-full eq-bar-4" />
            </div>
            <span>OFFICIAL RANKING CEREMONY</span>
          </div>
          <div className="h-4 w-[1px] bg-white/20" />
          <h1 className="text-base sm:text-xl font-black text-white m-0 tracking-tight leading-tight truncate">
            {categoryTitle || "공식 종목"} {gradeTitle && <span className={`${theme.primary} ml-2 font-mono`}>{gradeTitle}</span>}
          </h1>
        </div>

        <div className="flex items-center gap-2 bg-black/80 px-3.5 py-1.5 rounded-2xl border border-white/15 shadow-xl">
          <CheckCircleOutlined className="text-emerald-400" />
          <span className="text-[11px] sm:text-xs font-bold text-slate-200">
            {phase === "CHAMPION_SOLO" ? "👑 1위 챔피언 세레모니" : "심사 결과 발표"}
          </span>
        </div>
      </div>

      {/* ========================================================================================= */}
      {/* 2. 메인 바디 영역: Step 1 (2~10위 발표) vs Step 2 (선수소개급 1위 단독 샷) */}
      {/* ========================================================================================= */}
      <div className="relative z-20 flex-1 flex items-center justify-center w-full h-[calc(100vh-115px)] px-4 sm:px-8 py-2 overflow-hidden">
        
        {/* ======================================================================================= */}
        {/* 🌟 [PHASE 1]: 2~10위 순위 발표 (좌: 2·3위 포디움 / 우: 4~10위 카드) */}
        {/* ======================================================================================= */}
        {phase === "FULL_RANKING" && (
          displayRestRanks.length > 0 ? (
            /* 4명 이상 출전: 좌측 2·3위 포디움 + 우측 4~N위 순위표 */
            <div className="w-full h-full grid grid-cols-12 gap-3 sm:gap-4 items-stretch max-w-5xl mx-auto animate-fade-in py-1">
              
              {/* ◀️ [좌측 (50%)]: 2위 & 3위 대형 포디움 카드 + 1위 발표 카운트다운 */}
              <div className="col-span-6 flex flex-col justify-between gap-2.5 h-full">
                
                {/* 🥈 2위 포디움 카드 */}
                {displayTop2 && (
                  <div
                    ref={card2Ref}
                    className="relative flex-1 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border-2 border-slate-300/80 bg-slate-950/95 flex items-center justify-between shadow-[0_15px_40px_rgba(0,0,0,0.95)] overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-400/15 via-transparent to-black/80 pointer-events-none z-0" />
                    <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 z-10" />

                    <div className="relative z-10 flex items-center gap-3 sm:gap-4 min-w-0 pl-1.5">
                      <div className="relative shrink-0">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-slate-300 bg-black shadow-xl flex items-center justify-center">
                          {displayTop2.stagePhotoUrl || displayTop2.profileImageUrl || displayTop2.photoUrl ? (
                            <img
                              src={displayTop2.stagePhotoUrl || displayTop2.profileImageUrl || displayTop2.photoUrl}
                              alt={displayTop2.playerName}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <TrophyOutlined className="text-2xl text-slate-300" />
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 font-black text-[10px] sm:text-xs shadow">
                          2위
                        </div>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-black border border-slate-400/50 font-mono font-black text-xs text-slate-200">
                            NO.{displayTop2.playerNumber}
                          </span>
                          <span className="text-[10px] text-slate-300 font-bold">2위 • 준우승</span>
                        </div>

                        <h2 className="text-lg sm:text-2xl font-black text-white m-0 tracking-tight leading-tight truncate drop-shadow-md">
                          {displayTop2.playerName}
                        </h2>
                        
                        <div className="text-xs text-slate-300 font-semibold truncate drop-shadow">
                          {displayTop2.playerGym || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 🥉 3위 포디움 카드 */}
                {displayTop3 && (
                  <div
                    ref={card3Ref}
                    className="relative flex-1 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border-2 border-amber-600/80 bg-slate-950/95 flex items-center justify-between shadow-[0_15px_40px_rgba(0,0,0,0.95)] overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-600/15 via-transparent to-black/80 pointer-events-none z-0" />
                    <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 z-10" />

                    <div className="relative z-10 flex items-center gap-3 sm:gap-4 min-w-0 pl-1.5">
                      <div className="relative shrink-0">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-amber-600 bg-black shadow-xl flex items-center justify-center">
                          {displayTop3.stagePhotoUrl || displayTop3.profileImageUrl || displayTop3.photoUrl ? (
                            <img
                              src={displayTop3.stagePhotoUrl || displayTop3.profileImageUrl || displayTop3.photoUrl}
                              alt={displayTop3.playerName}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <TrophyOutlined className="text-2xl text-amber-500" />
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-600 to-amber-800 text-white font-black text-[10px] sm:text-xs shadow">
                          3위
                        </div>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-black border border-amber-600/50 font-mono font-black text-xs text-amber-400">
                            NO.{displayTop3.playerNumber}
                          </span>
                          <span className="text-[10px] text-amber-400/90 font-bold">3위 • 입상</span>
                        </div>

                        <h2 className="text-lg sm:text-2xl font-black text-white m-0 tracking-tight leading-tight truncate drop-shadow-md">
                          {displayTop3.playerName}
                        </h2>
                        
                        <div className="text-xs text-slate-300 font-semibold truncate drop-shadow">
                          {displayTop3.playerGym || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 👑 1위 대상 발표 대기 알림 바 */}
                <div className="pending-champion-box bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 p-2.5 rounded-2xl border border-amber-400/50 flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                    <span className="text-xs sm:text-sm font-black text-amber-300">
                      👑 1위 우승자 발표
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/70 px-2.5 py-0.5 rounded-lg border border-amber-400/40 text-xs font-mono font-bold text-amber-300">
                    <span>{countdown}초 후 단독 공개</span>
                    <ArrowRightOutlined className="animate-pulse" />
                  </div>
                </div>

              </div>

              {/* ▶️ [우측 (50%)]: 4위 ~ N위 실제 입상자 카드 스택 */}
              <div className="col-span-6 flex flex-col justify-between gap-1.5 sm:gap-2 h-full bg-black/60 rounded-3xl p-3 sm:p-3.5 border border-white/15 shadow-2xl backdrop-blur-md overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5 px-1">
                  <span className="text-xs font-mono font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <StarFilled className="text-amber-400 text-[10px]" />
                    <span>TOP 4 ~ {ranks.length} 입상자 순위</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-bold">공식 순위표</span>
                </div>

                <div className="flex-1 flex flex-col justify-between gap-1.5 overflow-hidden">
                  {displayRestRanks.map((player, idx) => (
                    <div
                      key={`sq-rank-${player.playerNumber}-${idx}`}
                      className="rest-rank-item flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 shadow-md transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 border border-white/20 flex items-center justify-center font-mono font-black text-xs text-slate-300 shadow shrink-0">
                          {player.playerRank}위
                        </span>
                        <span className="font-mono font-bold text-xs text-amber-400 shrink-0">
                          NO.{player.playerNumber}
                        </span>
                        <span className="font-black text-sm text-white truncate max-w-[120px]">
                          {player.playerName}
                        </span>
                      </div>

                      <span className="text-xs text-slate-400 font-semibold truncate max-w-[120px] text-right">
                        {player.playerGym || "-"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            /* 2~3명 출전 또는 데이터 대기: 가짜 더미 순위표 없이 실제 인원(2위 or 2·3위)만 중앙 정렬 쇼케이스 */
            <div className="w-full max-w-2xl mx-auto flex flex-col justify-center gap-3 sm:gap-4 h-full animate-fade-in py-1">
              
              {/* 데이터 없음 / 심사 집계 대기 안내 카드 */}
              {!displayTop2 && !displayTop3 && (
                <div className="rounded-3xl p-6 sm:p-8 border border-white/15 bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center text-center space-y-2.5 py-10 shadow-2xl">
                  <TrophyOutlined className="text-5xl text-amber-400 animate-pulse mb-1" />
                  <div className="text-2xl font-black text-white">순위 집계 대기중</div>
                  <div className="text-sm text-slate-300 font-semibold">심사 결과가 확정되면 순위가 전광판에 표시됩니다.</div>
                </div>
              )}

              {/* 🥈 2위 포디움 카드 */}
              {displayTop2 && (
                <div
                  ref={card2Ref}
                  className="relative rounded-3xl p-4 sm:p-6 border-2 border-slate-300/80 bg-slate-950/95 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.95)] overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-400/15 via-transparent to-black/80 pointer-events-none z-0" />
                  <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 z-10" />

                  <div className="relative z-10 flex items-center gap-4 sm:gap-6 min-w-0 pl-2">
                    <div className="relative shrink-0">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-slate-300 bg-black shadow-xl flex items-center justify-center">
                        {displayTop2.stagePhotoUrl || displayTop2.profileImageUrl || displayTop2.photoUrl ? (
                          <img
                            src={displayTop2.stagePhotoUrl || displayTop2.profileImageUrl || displayTop2.photoUrl}
                            alt={displayTop2.playerName}
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <TrophyOutlined className="text-3xl text-slate-300" />
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 font-black text-xs sm:text-sm shadow">
                        2위
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-black border border-slate-400/50 font-mono font-black text-sm text-slate-200">
                          NO.{displayTop2.playerNumber}
                        </span>
                        <span className="text-xs text-slate-300 font-bold">2위 • 준우승</span>
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-black text-white m-0 tracking-tight leading-tight truncate drop-shadow-md">
                        {displayTop2.playerName}
                      </h2>
                      
                      <div className="text-sm text-slate-300 font-semibold truncate drop-shadow">
                        {displayTop2.playerGym || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 🥉 3위 포디움 카드 (3명 이상일 때만 노출) */}
              {displayTop3 && (
                <div
                  ref={card3Ref}
                  className="relative rounded-3xl p-4 sm:p-6 border-2 border-amber-600/80 bg-slate-950/95 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.95)] overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600/15 via-transparent to-black/80 pointer-events-none z-0" />
                  <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 z-10" />

                  <div className="relative z-10 flex items-center gap-4 sm:gap-6 min-w-0 pl-2">
                    <div className="relative shrink-0">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-amber-600 bg-black shadow-xl flex items-center justify-center">
                        {displayTop3.stagePhotoUrl || displayTop3.profileImageUrl || displayTop3.photoUrl ? (
                          <img
                            src={displayTop3.stagePhotoUrl || displayTop3.profileImageUrl || displayTop3.photoUrl}
                            alt={displayTop3.playerName}
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <TrophyOutlined className="text-3xl text-amber-500" />
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-amber-600 to-amber-800 text-white font-black text-xs sm:text-sm shadow">
                        3위
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-black border border-amber-600/50 font-mono font-black text-sm text-amber-400">
                          NO.{displayTop3.playerNumber}
                        </span>
                        <span className="text-xs text-amber-400 font-bold">3위 • 입상</span>
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-black text-white m-0 tracking-tight leading-tight truncate drop-shadow-md">
                        {displayTop3.playerName}
                      </h2>
                      
                      <div className="text-sm text-slate-300 font-semibold truncate drop-shadow">
                        {displayTop3.playerGym || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 👑 1위 대상 발표 대기 알림 바 */}
              <div className="pending-champion-box bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 p-3.5 rounded-2xl border border-amber-400/50 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span className="text-sm sm:text-base font-black text-amber-300">
                    👑 1위 우승자 발표
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-black/70 px-3 py-1 rounded-xl border border-amber-400/40 text-xs sm:text-sm font-mono font-bold text-amber-300">
                  <span>{countdown}초 후 단독 공개</span>
                  <ArrowRightOutlined className="animate-pulse" />
                </div>
              </div>

            </div>
          )
        )}

        {/* ======================================================================================= */}
        {/* 👑 [PHASE 2]: 1위 단독 챔피언 선수소개급 풀스펙 하이라이트 (AthleteIntroScene 동급 완성) */}
        {/* ======================================================================================= */}
        {phase === "CHAMPION_SOLO" && (
          <div className={`relative w-full h-full flex items-center ${heroPhoto ? "justify-between" : "justify-center"} gap-4 sm:gap-8 px-2 sm:px-6 overflow-hidden`}>
            
            {/* 🌌 Layer 1: 16:9 와이드 배경 사진 (시네마틱 블렌딩) */}
            {bgPhoto && (
              <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <img
                  ref={bgPhotoRef}
                  src={bgPhoto}
                  alt="무대 배경"
                  className="w-full h-full object-cover filter brightness-95 contrast-105 bg-photo-cinematic-blend opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/70 pointer-events-none" />
              </div>
            )}

            {/* -------------------- [ ◀️ 챔피언 공식 BIO & 압도적 타이포그래피 (사진 없을 시 중앙 정렬) ] -------------------- */}
            <div className={`space-y-3 sm:space-y-4 ${heroPhoto ? "w-[48%] max-w-xl shrink-0" : "w-full max-w-2xl mx-auto flex flex-col items-center text-center justify-center my-auto"} z-20`}>
              
              {/* 🌿 3D 황금 월계관 (Laurel Wreath) & 종목/체급 1위 공식 엠블럼 */}
              <div className={`laurel-wreath-container flex items-center gap-3.5 bg-gradient-to-r from-amber-500/25 via-yellow-500/15 to-transparent border border-amber-400/50 rounded-3xl p-2.5 sm:p-3 backdrop-blur-2xl shadow-[0_0_35px_rgba(251,191,36,0.35)] ${heroPhoto ? "" : "w-full max-w-xl justify-center"}`}>
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full filter drop-shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-pulse">
                    <defs>
                      <linearGradient id="goldLaurelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fef08a" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#b45309" />
                      </linearGradient>
                    </defs>
                    {/* Left Laurel Branch */}
                    <path d="M50 95 C30 90 15 70 18 45 C20 30 30 18 45 12" stroke="url(#goldLaurelGrad)" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
                    <path d="M42 16 C35 15 32 22 36 26 C40 24 43 19 42 16Z" fill="url(#goldLaurelGrad)"/>
                    <path d="M32 27 C25 28 24 36 29 39 C33 36 34 30 32 27Z" fill="url(#goldLaurelGrad)"/>
                    <path d="M25 42 C18 44 19 53 25 54 C28 50 28 44 25 42Z" fill="url(#goldLaurelGrad)"/>
                    <path d="M22 58 C16 62 19 71 25 70 C27 66 26 60 22 58Z" fill="url(#goldLaurelGrad)"/>
                    <path d="M26 74 C22 80 28 87 34 84 C35 79 32 74 26 74Z" fill="url(#goldLaurelGrad)"/>
                    <path d="M36 87 C34 93 42 98 47 93 C47 88 42 84 36 87Z" fill="url(#goldLaurelGrad)"/>

                    {/* Right Laurel Branch */}
                    <path d="M70 95 C90 90 105 70 102 45 C100 30 90 18 75 12" stroke="url(#goldLaurelGrad)" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
                    <path d="M78 16 C85 15 88 22 84 26 C80 24 77 19 78 16Z" fill="url(#goldLaurelGrad)"/>
                    <path d="M88 27 C95 28 96 36 91 39 C87 36 86 30 88 27Z" fill="url(#goldLaurelGrad)"/>
                    <path d="M95 42 C102 44 101 53 95 54 C92 50 92 44 95 42Z" fill="url(#goldLaurelGrad)"/>
                    <path d="M98 58 C104 62 101 71 95 70 C93 66 94 60 98 58Z" fill="url(#goldLaurelGrad)"/>
                    <path d="M94 74 C98 80 92 87 86 84 C85 79 88 74 94 74Z" fill="url(#goldLaurelGrad)"/>
                    <path d="M84 87 C86 93 78 98 73 93 C73 88 78 84 84 87Z" fill="url(#goldLaurelGrad)"/>

                    {/* Bottom Ribbon */}
                    <path d="M52 94 C57 92 63 92 68 94 C65 98 55 98 52 94Z" fill="url(#goldLaurelGrad)"/>
                    <path d="M54 96 C48 104 42 108 38 110 C44 106 50 102 54 96Z" fill="url(#goldLaurelGrad)"/>
                    <path d="M66 96 C72 104 78 108 82 110 C76 106 70 102 66 96Z" fill="url(#goldLaurelGrad)"/>
                  </svg>
                  {/* Center 1st Place Crown & Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center -space-y-0.5 pointer-events-none">
                    <CrownOutlined className="text-yellow-300 text-sm sm:text-base animate-bounce drop-shadow" />
                    <span className="font-mono font-black text-2xl sm:text-3xl text-amber-300 tracking-tighter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                      1<span className="text-xs sm:text-sm">ST</span>
                    </span>
                  </div>
                </div>

                <div className={`flex flex-col min-w-0 flex-1 ${heroPhoto ? "" : "text-left"}`}>
                  <div className="flex items-center gap-2">
                    <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                      1ST PLACE
                    </span>
                    <span className="text-amber-300 font-bold text-xs sm:text-sm tracking-tight flex items-center gap-1">
                      <TrophyOutlined className="text-amber-400" /> 공식 1위 우승
                    </span>
                  </div>
                  <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight m-0 bg-gradient-to-r from-white via-amber-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-md truncate">
                    {classDisplay} 1위 우승
                  </div>
                </div>
              </div>

              {/* ① 배부번호 3D 스탬핑 (#15) */}
              <div
                ref={numberBadgeRef}
                className={`inline-flex items-center gap-3 sm:gap-4 bg-gradient-to-r ${theme.bgGradient} ${heroPhoto ? "border-l-4 rounded-r-3xl pl-4 sm:pl-6 pr-6 sm:pr-8" : "border-2 rounded-3xl px-6 sm:px-10"} ${theme.border} py-2 backdrop-blur-2xl shadow-2xl`}
              >
                <div className="flex flex-col">
                  <span className={`text-[10px] font-black tracking-[0.3em] uppercase ${theme.primary}`}>
                    WINNER NO
                  </span>
                  <span className="text-xs text-amber-300 font-bold">1위 우승자 배부번호</span>
                </div>

                <div className={`flex items-center font-mono font-black text-5xl sm:text-6xl lg:text-7xl tracking-tighter ${theme.primary} neon-number-glow`}>
                  {numberChars.map((digit, i) => (
                    <span key={i} className="num-digit inline-block">
                      {digit}
                    </span>
                  ))}
                </div>
              </div>

              {/* 황금 레이저 라인 */}
              <div
                className="laser-line h-[2px] w-full"
                style={{
                  background: heroPhoto
                    ? `linear-gradient(to right, ${theme.shockColor}, transparent)`
                    : `linear-gradient(to right, transparent, ${theme.shockColor}, transparent)`,
                  boxShadow: `0 0 14px ${theme.laserShadow}`,
                }}
              />

              {/* ② 1위 챔피언 이름 글자별 타격 리빌 */}
              <div className="space-y-1">
                <div className={`text-xs font-black tracking-widest text-amber-400 uppercase flex items-center ${heroPhoto ? "" : "justify-center"} gap-2`}>
                  <CrownOutlined className="text-amber-400 animate-bounce" />
                  <span>1ST PLACE WINNER • 1위 우승</span>
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

              {/* ③ 소속 헬스장 */}
              <div
                ref={gymBadgeRef}
                className={`flex items-center ${heroPhoto ? "" : "justify-center"} gap-3 sm:gap-4 text-xl sm:text-2xl lg:text-3xl text-slate-100 font-black`}
              >
                <div className={`p-2 sm:p-2.5 rounded-2xl bg-amber-400/20 border ${theme.border50} text-amber-300 shadow-xl`}>
                  <EnvironmentOutlined />
                </div>
                <span className="break-keep font-black tracking-tight drop-shadow-md text-amber-200">
                  {displayTop1.playerGym || "공식 소속팀"}
                </span>
              </div>

              {/* ④ BIO 챔피언 스펙 카드 그리드 */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-1 w-full max-w-xl">
                {/* 1. HEIGHT */}
                <div className={`bio-card-item bg-black/80 backdrop-blur-2xl border ${theme.border40} rounded-2xl p-2.5 sm:p-3 shadow-xl`}>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                    HEIGHT
                  </span>
                  <span className={`text-base sm:text-xl lg:text-2xl font-black font-mono ${theme.specText}`}>
                    {heightValue}
                  </span>
                </div>

                {/* 2. WEIGHT */}
                <div className={`bio-card-item bg-black/80 backdrop-blur-2xl border ${theme.border40} rounded-2xl p-2.5 sm:p-3 shadow-xl`}>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                    WEIGHT
                  </span>
                  <span className={`text-base sm:text-xl lg:text-2xl font-black font-mono ${theme.specText}`}>
                    {weightValue}
                  </span>
                </div>

                {/* 3. DIVISION */}
                <div className={`bio-card-item bg-black/80 backdrop-blur-2xl border ${theme.border40} rounded-2xl p-2.5 sm:p-3 shadow-xl`}>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                    DIVISION
                  </span>
                  <span className="text-xs sm:text-sm lg:text-base font-black text-amber-300 truncate block">
                    {classDisplay}
                  </span>
                </div>
              </div>

            </div>

            {/* -------------------- [ ▶️ 우측: 1번 메인 히어로 컷 (사진이 있을 때만 프레임 노출) ] -------------------- */}
            {heroPhoto && (
              <div className="flex-1 h-full flex items-center justify-center relative z-10 pl-2">
                
                {/* 뒤쪽 초대형 골드 파워 글로우 */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full blur-[160px] pointer-events-none"
                  style={{ backgroundColor: theme.glowRgba }}
                />

                {/* 🌟 아나모픽 호라이즌 렌즈 플레어 스트릭 */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[4px] pointer-events-none animate-anamorphic-flare z-0"
                  style={{
                    background: `linear-gradient(to right, transparent, ${theme.shockColor}, #ffffff, ${theme.shockColor}, transparent)`,
                    boxShadow: `0 0 28px 4px ${theme.laserShadow}`,
                  }}
                />

                {/* 🌫️ 무대 스모크 & 앰비언트 라이트 */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[500px] h-[500px] bg-amber-400/10 rounded-full blur-[100px] pointer-events-none" />
                </div>

                {/* 🖼️ 메인 챔피언 인물 사진 (타원형 Oval 초정밀 소프트 페더링 마스크로 직사각형 테두리 100% 완전 소멸) */}
                <div className="relative w-full h-[88vh] sm:h-[90vh] lg:h-[92vh] max-h-[950px] flex items-center justify-center z-10 pointer-events-none hero-photo-oval-feather-mask">
                  <img
                    ref={heroImageRef}
                    src={heroPhoto}
                    alt={displayTop1.playerName}
                    className="w-full h-full max-w-[950px] object-cover object-top filter brightness-105 contrast-105 pointer-events-none hero-photo-oval-feather-mask"
                  />

                  {/* ✨ 대각선 챔피언 크롬 라이트 스윕 */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden hero-photo-oval-feather-mask">
                    <div className="w-[200%] h-[200%] bg-gradient-to-r from-transparent via-white/20 to-transparent animate-card-sheen" />
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </div>

      {/* ========================================================================================= */}
      {/* 3. 하단: 공식 방송 푸터 */}
      {/* ========================================================================================= */}
      <div className="bar-elem relative z-20 flex items-center justify-between border-t border-white/15 px-4 sm:px-8 py-2 shrink-0 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ThunderboltOutlined className={theme.primary} />
          <span className="font-bold text-slate-300">
            {contestTitle || "보디빌딩 & 피트니스"} • 공식 순위 시상식
          </span>
        </div>
        <div className="font-mono text-slate-400 text-[11px]">
          OFFICIAL STAGE BROADCAST
        </div>
      </div>

    </div>
  );
};

export default SquareRankingCeremonyScene;
