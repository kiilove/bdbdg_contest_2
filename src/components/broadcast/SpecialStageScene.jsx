"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  TrophyOutlined,
  CrownOutlined,
  StarOutlined,
  FireOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import demoBodybuilderImg from "../../assets/img/demo_bodybuilder.jpg";
import demoBodybuilderBg from "../../assets/img/demo_bodybuilder_bg.jpg";
import defaultAwardVideo from "../../assets/mov/award2.mp4";
import { THEME_CONFIGS } from "./AthleteIntroScene";
import "./AthleteIntroScene.css";

const SpecialStageScene = ({
  contestTitle,
  specialData,
  backgroundVideoUrl,
  colorTheme = "GOLD",
  onFinishCeremony,
}) => {
  const containerRef = useRef(null);
  const theme = THEME_CONFIGS[specialData?.colorTheme || colorTheme] || THEME_CONFIGS.GOLD;
  const videoSrc = backgroundVideoUrl || defaultAwardVideo;

  const title = specialData?.title || "🏆 그랑프리 (OVERALL) 결정전";
  const subTitle = specialData?.subTitle || "대회 최고 영예의 통합 챔피언 공식 발표";
  const displayType = specialData?.displayType || "GRAND_PRIX"; // "GRAND_PRIX" | "SPECIAL_AWARD" | "SCORE_BOARD"
  const players = specialData?.players || [
    { playerRank: 1, playerNumber: "100", playerName: "김재준", playerGym: "Get_in", score: 98.5, note: "통합 대상 (그랑프리)" },
    { playerRank: 2, playerNumber: "104", playerName: "이정우", playerGym: "몬스터짐", score: 96.2, note: "준우승" },
    { playerRank: 3, playerNumber: "108", playerName: "박성민", playerGym: "골드피트니스", score: 94.8, note: "3위" },
  ];

  const top1 = players.find((p) => (p.playerRank || 0) === 1) || players[0] || {};
  const restPlayers = players.filter((p) => p !== top1);

  // 🎬 GSAP 엔트런스 애니메이션
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      gsap.set(".special-header", { opacity: 0, y: -30 });
      gsap.set(".special-hero", { opacity: 0, scale: 0.85, filter: "blur(15px)" });
      gsap.set(".special-card-item", { opacity: 0, x: 40 });

      tl.to(".special-header", { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0);
      tl.to(".special-hero", { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "elastic.out(1, 0.6)" }, 0.2);
      tl.to(".special-card-item", { opacity: 1, x: 0, duration: 0.5, stagger: 0.12, ease: "power3.out" }, 0.5);
    }, containerRef);

    return () => ctx.revert();
  }, [specialData]);

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
          className="w-full h-full object-cover opacity-45 filter contrast-125"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-slate-950/80" />
      </div>

      {/* 🌟 앰비언트 테마 글로우 */}
      <div
        className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full blur-[180px] pointer-events-none z-1"
        style={{ backgroundColor: theme.glowRgba }}
      />

      {/* 1. 상단: 공식 특수화면 헤더 바 */}
      <div className="special-header relative z-20 flex items-center justify-between border-b border-white/15 pb-4">
        <div className="flex items-center gap-4">
          <div className={`w-3.5 h-10 rounded-full bg-gradient-to-b ${theme.textGradient}`} />
          <div>
            <div className={`text-xs font-black tracking-widest ${theme.primary} uppercase flex items-center gap-1.5`}>
              <StarOutlined />
              <span>SPECIAL STAGE CEREMONY • 공식 특별 시상</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white m-0 tracking-tight leading-tight">
              {title}
            </h1>
            {subTitle && (
              <p className="text-xs sm:text-sm text-slate-300 m-0 font-medium pt-0.5">
                {subTitle}
              </p>
            )}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-black/70 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/15 shadow-xl">
          <CheckCircleOutlined className="text-emerald-400" />
          <span className="text-xs font-bold text-slate-200 uppercase">공식 최종 집계 확정</span>
        </div>
      </div>

      {/* 2. 메인 화면: 타입별 다이내믹 렌더링 */}
      <div className="relative z-10 my-auto w-full h-[calc(100vh-170px)] py-2 flex items-center justify-center">
        
        {/* ========================================================================================= */}
        {/* 🏆 [TYPE A] GRAND_PRIX: 그랑프리 / 통합 오버롤 챔피언전 */}
        {/* ========================================================================================= */}
        {displayType === "GRAND_PRIX" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full h-full items-center">
            
            {/* 좌측: 1위 그랑프리 대상 수상자 대형 스포트라이트 */}
            <div className="special-hero lg:col-span-7 flex flex-col justify-between h-full bg-gradient-to-r from-amber-500/35 via-slate-950/90 to-black/95 rounded-3xl p-6 lg:p-8 border-2 border-amber-400 shadow-2xl relative overflow-hidden">
              <div className="absolute right-0 bottom-0 text-white/5 font-black text-[13rem] leading-none pointer-events-none select-none font-mono">
                OVERALL
              </div>

              <div className="relative z-10 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-500/25 border border-amber-400 text-amber-300 font-black text-xs uppercase tracking-widest">
                  <CrownOutlined className="text-amber-400" />
                  <span>OVERALL GRAND PRIX CHAMPION</span>
                </div>
                {top1.score && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">집계 점수</span>
                    <span className="text-2xl font-black font-mono text-amber-300">{top1.score}점</span>
                  </div>
                )}
              </div>

              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 my-auto">
                <div className="w-32 h-32 lg:w-44 lg:h-44 rounded-3xl overflow-hidden border-2 border-amber-400 bg-slate-950 shadow-2xl shrink-0">
                  <img
                    src={top1.photoUrl || demoBodybuilderImg}
                    alt={top1.playerName}
                    className="w-full h-full object-cover object-top"
                  />
                </div>

                <div className="space-y-2 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-3">
                    <span className="px-3 py-1 rounded-xl bg-slate-950 border border-amber-400 font-mono font-black text-xl text-amber-400">
                      NO.{top1.playerNumber || "100"}
                    </span>
                    <span className="text-xs text-amber-300 font-bold uppercase">{top1.note || "통합 그랑프리 대상"}</span>
                  </div>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white m-0 tracking-tight leading-none drop-shadow-lg">
                    {top1.playerName}
                  </h1>
                  <div className="text-lg lg:text-xl font-bold text-slate-200">
                    소속 : <span className="text-amber-300">{top1.playerGym || "무소속"}</span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 border-t border-white/10 pt-3 text-xs text-slate-400 font-bold flex items-center justify-between">
                <span>대한보디빌딩협회 통합 최고 챔피언상 수여</span>
                <span className="text-amber-400 font-mono font-black">CERTIFIED GRAND PRIX</span>
              </div>
            </div>

            {/* 우측: 후보자 및 2위 이하 점수 리스트 */}
            <div className="lg:col-span-5 flex flex-col h-full bg-slate-950/85 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 shrink-0">
                <span className="font-black text-sm text-slate-200 tracking-wider flex items-center gap-2">
                  <TrophyOutlined className="text-amber-400 text-base" />
                  <span>그랑프리 최종 순위 및 점수</span>
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  총 {players.length}명 심사
                </span>
              </div>

              <div className="flex-1 flex flex-col justify-start gap-2.5 overflow-y-auto pr-1">
                {players.map((item, idx) => {
                  const rank = item.playerRank || idx + 1;
                  const isWinner = rank === 1;

                  return (
                    <div
                      key={idx}
                      className={`special-card-item rounded-2xl p-3.5 border transition-all flex items-center justify-between shadow-md backdrop-blur-md ${
                        isWinner
                          ? "bg-amber-500/20 border-amber-400/80 shadow-amber-500/20"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-xl font-mono font-black text-sm shrink-0 ${
                            isWinner
                              ? "bg-amber-400 text-slate-950 shadow-md"
                              : "bg-slate-800 text-white border border-slate-700"
                          }`}
                        >
                          {rank}위
                        </div>

                        <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-white/10 shrink-0">
                          <span className={`text-sm font-mono font-black ${isWinner ? "text-amber-400" : "text-slate-300"}`}>
                            NO.{item.playerNumber}
                          </span>
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="text-base lg:text-lg font-black text-white leading-tight break-keep">
                            {item.playerName}
                          </div>
                          <div className="text-xs text-slate-400 font-medium break-keep">
                            {item.playerGym || "무소속"} {item.note && `• ${item.note}`}
                          </div>
                        </div>
                      </div>

                      {item.score && (
                        <div className="text-right shrink-0 pl-2">
                          <span className={`text-base font-mono font-black ${isWinner ? "text-amber-300" : "text-slate-300"}`}>
                            {item.score}점
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================================= */}
        {/* ✨ [TYPE B] SPECIAL_AWARD: 단독 특별상 / 인기상 / 베스트 포즈상 */}
        {/* ========================================================================================= */}
        {displayType === "SPECIAL_AWARD" && (
          <div className="special-hero max-w-4xl w-full bg-gradient-to-br from-slate-950/90 via-slate-900/90 to-black/95 rounded-3xl p-8 lg:p-12 border-2 border-purple-400/80 shadow-[0_20px_80px_rgba(192,132,252,0.25)] text-center space-y-6 relative overflow-hidden backdrop-blur-2xl">
            
            <div className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full bg-purple-500/20 border border-purple-400 text-purple-300 font-black text-sm tracking-widest uppercase shadow-xl">
              <StarOutlined />
              <span>SPECIAL INDIVIDUAL SPOTLIGHT</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-tight m-0">
                {title}
              </h2>
              <p className="text-lg text-purple-300 font-bold">{subTitle}</p>
            </div>

            {/* 수상자 카드 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
              <div className="w-36 h-36 lg:w-48 lg:h-48 rounded-3xl overflow-hidden border-2 border-purple-400 bg-slate-950 shadow-2xl">
                <img
                  src={top1.photoUrl || demoBodybuilderImg}
                  alt={top1.playerName}
                  className="w-full h-full object-cover object-top"
                />
              </div>

              <div className="space-y-3 text-center sm:text-left">
                <div className="inline-block px-4 py-1 rounded-xl bg-slate-950 border border-purple-400 font-mono font-black text-2xl text-purple-300 shadow-md">
                  NO.{top1.playerNumber || "100"}
                </div>
                <h1 className="text-5xl sm:text-6xl font-black text-white m-0 tracking-tight">
                  {top1.playerName}
                </h1>
                <div className="text-2xl font-bold text-slate-200">
                  소속 : <span className="text-purple-300">{top1.playerGym || "무소속"}</span>
                </div>
                {top1.note && (
                  <div className="text-sm text-slate-400 font-medium">
                    {top1.note}
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-400 font-bold pt-4 border-t border-white/10">
              대한보디빌딩협회 공식 심사위원단 특별상 시상
            </div>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* 📊 [TYPE C] SCORE_BOARD: 동적 점수 / 투표 집계판 */}
        {/* ========================================================================================= */}
        {displayType === "SCORE_BOARD" && (
          <div className="w-full max-w-5xl h-full bg-slate-950/85 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 border border-white/15 shadow-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-4">
              <div>
                <h2 className="text-2xl lg:text-3xl font-black text-white m-0 tracking-tight">
                  {title}
                </h2>
                <p className="text-xs text-slate-400 m-0">{subTitle}</p>
              </div>
              <span className={`text-xs font-mono font-black px-3 py-1 rounded-lg ${theme.badgeBg} border`}>
                TOTAL {players.length} ATHLETES
              </span>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-1">
              {players.map((item, idx) => (
                <div
                  key={idx}
                  className="special-card-item rounded-2xl p-4 bg-white/5 border border-white/10 flex items-center justify-between shadow-md"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 font-mono font-black text-base shrink-0">
                      #{item.playerNumber}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-lg font-black text-white leading-tight break-keep">
                        {item.playerName}
                      </div>
                      <div className="text-xs text-slate-400 font-medium break-keep">
                        {item.playerGym || "무소속"} {item.note && `• ${item.note}`}
                      </div>
                    </div>
                  </div>

                  {item.score && (
                    <div className="text-right pl-3 shrink-0">
                      <span className="text-xs text-slate-400 uppercase font-bold block">SCORE</span>
                      <span className="text-xl font-black font-mono text-amber-300">{item.score}점</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-3 text-xs text-slate-400 flex items-center justify-between">
              <span>실시간 동적 채점 및 심사 결과</span>
              <span className="text-amber-400 font-bold">KBFA OFFICIAL JUDGING SYSTEM</span>
            </div>
          </div>
        )}

      </div>

      {/* 3. 하단 공식 방송 바 (순수 Info 집중) */}
      <div className="relative z-20 flex items-center justify-between border-t border-white/15 pt-3 shrink-0">
        <div className="text-xs text-slate-400 font-bold flex items-center gap-2">
          <StarOutlined className={theme.primary} />
          <span>{contestTitle} 공식 특수화면 송출 시스템</span>
        </div>

        <div className={`text-xs font-black tracking-widest ${theme.primary} uppercase font-mono`}>
          OFFICIAL SPECIAL CEREMONY • 특별상 공식 시상
        </div>
      </div>
    </div>
  );
};

export default SpecialStageScene;
