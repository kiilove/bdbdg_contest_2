"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  TrophyOutlined,
  ThunderboltOutlined,
  UsergroupAddOutlined,
  FireOutlined,
  CheckCircleOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import demoBodybuilderImg from "../../assets/img/demo_bodybuilder.jpg";
import defaultAwardVideo from "../../assets/mov/award2.mp4";
import { THEME_CONFIGS } from "./AthleteIntroScene";
import "./AthleteIntroScene.css";

const ComparisonCalloutScene = ({
  contestTitle,
  stageInfo,
  calloutData,
  backgroundVideoUrl,
  colorTheme = "GOLD",
}) => {
  const containerRef = useRef(null);
  const theme = THEME_CONFIGS[colorTheme] || THEME_CONFIGS.GOLD;
  const videoSrc = backgroundVideoUrl || defaultAwardVideo;

  const roundTitle = calloutData?.roundTitle || "1차 비교심사 (FIRST CALLOUT)";
  const calloutPlayers = calloutData?.players || [
    { playerNumber: "101", playerName: "김재준", playerGym: "Get_in", photoUrl: "" },
    { playerNumber: "104", playerName: "이정우", playerGym: "몬스터짐", photoUrl: "" },
    { playerNumber: "107", playerName: "박성민", playerGym: "골드피트니스", photoUrl: "" },
    { playerNumber: "109", playerName: "최현진", playerGym: "에슬레틱짐", photoUrl: "" },
  ];

  const activePose = calloutData?.currentPose || "호명된 선수들은 무대 중앙으로 나와 라인업 해주시기 바랍니다.";

  const catTitle = stageInfo?.categoryTitle || "남자 클래식 보디빌딩";
  const grdTitle = stageInfo?.gradeTitle || "-75KG 체급";

  // 🎬 GSAP 선수별 시간차 순차 타격 애니메이션 (Staggered Impact Entrance)
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // 초기 숨김 세팅
      gsap.set(".callout-badge", { opacity: 0, scale: 0.8 });
      gsap.set(".callout-header", { opacity: 0, y: -40 });
      gsap.set(".callout-pose-banner", { opacity: 0, y: 30, scale: 0.95 });
      gsap.set(".callout-player-card", {
        opacity: 0,
        y: 80,
        scale: 1.3,
        filter: "blur(12px) brightness(180%)",
      });
      gsap.set(".callout-footer", { opacity: 0, y: 20 });

      // 1. 0.0s ~ 0.8s: 상단 공식 비교심사 타이틀 웅장하게 등장
      tl.to(".callout-badge", { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.7)" }, 0);
      tl.to(".callout-header", { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0.1);
      tl.to(".callout-pose-banner", { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power2.out" }, 0.5);

      // 2. 1.2s부터: 호명된 선수들이 1명씩 1.0초 시간차로 쿵! 쿵! 쿵! 화면에 타격 안착!
      tl.to(
        ".callout-player-card",
        {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px) brightness(100%)",
          duration: 0.75,
          stagger: 0.95, // ⏳ 선수 1명당 0.95초 간격 시간차 순차 호명 연출!
          ease: "elastic.out(1.1, 0.65)",
        },
        1.0
      );

      // 3. 전체 호명 완료 후 하단 상태 바 마무리
      tl.to(".callout-footer", { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
    }, containerRef);

    return () => ctx.revert();
  }, [calloutData]);

  // 선수 수에 따른 그리드 컬럼 설정
  const gridColsClass =
    calloutPlayers.length <= 2
      ? "grid-cols-1 sm:grid-cols-2 max-w-4xl"
      : calloutPlayers.length === 3
      ? "grid-cols-1 sm:grid-cols-3 max-w-6xl"
      : calloutPlayers.length === 4
      ? "grid-cols-2 sm:grid-cols-4 max-w-7xl"
      : calloutPlayers.length === 5
      ? "grid-cols-2 sm:grid-cols-5 max-w-[95vw]"
      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 max-w-[95vw]";

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-black text-white flex flex-col justify-between p-6 sm:p-8 lg:p-10 overflow-hidden select-none animate-fade-in"
    >
      {/* 🎬 배경 MP4 비디오 레이어 */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <video
          key={videoSrc}
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-45 filter contrast-125 brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-slate-950/80" />
      </div>

      {/* 🌟 앰비언트 테마 글로우 */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full blur-[200px] pointer-events-none z-1"
        style={{ backgroundColor: theme.glowRgba }}
      />

      {/* ======================= [ 1. 상단 공식 비교심사 헤더 바 ] ======================= */}
      <div className="relative z-20 flex items-center justify-between border-b border-white/15 pb-4">
        <div className="flex items-center gap-4">
          <div className={`w-3.5 h-12 rounded-full bg-gradient-to-b ${theme.textGradient}`} />
          <div className="callout-header space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg ${theme.badgeBg} border text-xs font-black uppercase tracking-widest ${theme.primary} shadow-lg`}>
                <FireOutlined className="animate-pulse" />
                <span>OFFICIAL CALLOUT • 비교심사</span>
              </span>
              <span className="text-xs text-slate-300 font-mono font-black">
                {catTitle} • {grdTitle}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white m-0 tracking-tight leading-tight">
              {roundTitle}
            </h1>
          </div>
        </div>

        {/* 호명 선수 인원 수 뱃지 */}
        <div className="callout-badge hidden sm:flex items-center gap-3 bg-black/80 backdrop-blur-2xl px-6 py-3 rounded-2xl border border-white/20 shadow-2xl">
          <UsergroupAddOutlined className={`${theme.primary} text-2xl animate-pulse`} />
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">호명 선수단</span>
            <span className="text-2xl font-black font-mono text-white leading-none">
              총 <span className={theme.primary}>{calloutPlayers.length}명</span>
            </span>
          </div>
        </div>
      </div>

      {/* ======================= [ 2. 중앙: 호명된 선수들 대형 카드 그리드 (시간차 타격) ] ======================= */}
      <div className="relative z-10 my-auto w-full flex flex-col items-center justify-center py-2">
        <div className={`grid ${gridColsClass} gap-4 sm:gap-6 w-full justify-center`}>
          {calloutPlayers.map((player, idx) => (
            <div
              key={player.playerNumber || idx}
              className="callout-player-card relative flex flex-col justify-between bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-black/95 rounded-3xl p-5 sm:p-6 border-2 border-white/20 hover:border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-all overflow-hidden text-center"
            >
              {/* 상단 테마 컬러 림 라이트 */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r"
                style={{ backgroundImage: `linear-gradient(to right, transparent, ${theme.shockColor}, transparent)` }}
              />

              {/* 🌟 거대한 배부번호 뱃지 */}
              <div className="relative z-10 my-2">
                <div className="inline-block px-5 py-2 rounded-2xl bg-black/80 border-2 border-amber-400/80 shadow-2xl">
                  <span className="text-4xl sm:text-5xl lg:text-6xl font-black font-mono text-amber-400 tracking-tight drop-shadow-md">
                    #{player.playerNumber}
                  </span>
                </div>
              </div>

              {/* 🖼️ 선수 썸네일 */}
              <div className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 mx-auto my-3 rounded-2xl overflow-hidden border-2 border-white/20 bg-slate-950 shadow-xl shrink-0">
                <img
                  src={player.profileImageUrl || player.photoUrl || demoBodybuilderImg}
                  alt={player.playerName}
                  className="w-full h-full object-cover object-top"
                />
              </div>

              {/* 📝 성명 및 소속 */}
              <div className="relative z-10 space-y-1 mt-1">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white m-0 tracking-tight leading-tight">
                  {player.playerName}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-bold m-0 truncate">
                  {player.playerGym || "무소속"}
                </p>
              </div>

              {/* 카드 하단 태그 */}
              <div className="relative z-10 pt-3 mt-3 border-t border-white/10 flex items-center justify-center gap-1.5 text-[11px] text-amber-400 font-black">
                <CheckCircleOutlined />
                <span>비교심사 호명</span>
              </div>
            </div>
          ))}
        </div>

        {/* 📢 중앙 안내 포즈 캡션 바 */}
        <div className="callout-pose-banner mt-6 bg-black/80 backdrop-blur-2xl px-8 py-3 rounded-2xl border border-white/15 shadow-2xl max-w-4xl text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1.5">
            <SoundOutlined className="text-amber-400" />
            <span>무대 진행 포즈 지시</span>
          </div>
          <div className={`text-xl sm:text-2xl lg:text-3xl font-black ${theme.primary} tracking-wide drop-shadow-md`}>
            {activePose}
          </div>
        </div>
      </div>

      {/* ======================= [ 3. 하단 공식 방송 바 ] ======================= */}
      <div className="callout-footer relative z-20 flex items-center justify-between border-t border-white/15 pt-3 shrink-0">
        <div className="text-xs text-slate-400 font-bold flex items-center gap-2">
          <ThunderboltOutlined className={theme.primary} />
          <span>{contestTitle || "보디빌딩 & 피트니스"} • 공식 비교심사 진행</span>
        </div>

        <div className="text-xs font-black tracking-widest text-slate-300 uppercase">
          JUDGING IN PROGRESS • 심사위원 채점 진행 중
        </div>
      </div>
    </div>
  );
};

export default ComparisonCalloutScene;
