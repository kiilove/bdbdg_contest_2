"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import { useFirestoreQuery } from "../../hooks/useFirestores";
import { where } from "firebase/firestore";
import { gsap } from "gsap";
import { TrophyOutlined, CheckCircleOutlined } from "@ant-design/icons";
import defaultAwardVideo from "../../assets/mov/award2.mp4";
import demoBodybuilderImg from "../../assets/img/demo_bodybuilder.jpg";
import demoBodybuilderBg from "../../assets/img/demo_bodybuilder_bg.jpg";
import { THEME_CONFIGS } from "./AthleteIntroScene";
import "./AthleteIntroScene.css";

const getRankThemeStyle = (rank, themeKey = "GOLD") => {
  const theme = THEME_CONFIGS[themeKey] || THEME_CONFIGS.GOLD;

  switch (rank) {
    case 1:
      return {
        bg: `from-${themeKey === "GOLD" ? "amber-500/40" : themeKey === "BLUE" ? "cyan-500/40" : themeKey === "RED" ? "rose-500/40" : themeKey === "GREEN" ? "emerald-500/40" : "purple-500/40"} via-slate-950/90 to-black/95 ${theme.border} shadow-[0_15px_50px_${theme.glowRgba}]`,
        badgeBg: `bg-gradient-to-br ${theme.textGradient} text-slate-950`,
        border: theme.border,
        textColor: theme.primary,
        titleBadge: theme.badgeBg,
        title: "1위 • 우승 (대상)",
      };
    case 2:
      return {
        bg: "from-slate-400/25 via-slate-950/90 to-black/95 border-slate-300/80 shadow-[0_10px_35px_rgba(148,163,184,0.25)]",
        badgeBg: "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-950",
        border: "border-slate-300/80",
        textColor: "text-slate-200",
        titleBadge: "bg-slate-500/20 text-slate-200 border-slate-400/50",
        title: "2위 • 준우승",
      };
    case 3:
      return {
        bg: "from-amber-700/25 via-slate-950/90 to-black/95 border-amber-600/70 shadow-[0_10px_35px_rgba(217,119,6,0.25)]",
        badgeBg: "bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 text-white",
        border: "border-amber-600/70",
        textColor: "text-amber-400",
        titleBadge: "bg-amber-700/20 text-amber-300 border-amber-600/50",
        title: "3위",
      };
    default:
      return {
        bg: "from-white/10 to-black/80 border-white/20 shadow-black/40",
        badgeBg: "bg-slate-800 text-white",
        border: "border-white/20",
        textColor: "text-slate-300",
        titleBadge: "bg-white/10 text-slate-300 border-white/20",
        title: `${rank}위`,
      };
  }
};

const RankingCeremonyScene = ({
  contestTitle,
  categoryTitle = "공식 시상식",
  gradeTitle = "",
  gradeId = "",
  rankingData = [],
  backgroundVideoUrl,
  colorTheme = "GOLD",
  onFinishCeremony,
}) => {
  const containerRef = useRef(null);
  const card1Ref = useRef(null);
  const card2Ref = useRef(null);
  const card3Ref = useRef(null);

  const [ranks, setRanks] = useState(rankingData);

  const { currentContest } = useContext(CurrentContestContext);
  const fetchResultQuery = useFirestoreQuery();

  const theme = THEME_CONFIGS[colorTheme] || THEME_CONFIGS.GOLD;
  const videoSrc = backgroundVideoUrl || defaultAwardVideo;

  // 1. 순위 데이터 필터링
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

  // 1, 2, 3위 및 4~10위 안정적 매핑
  const top1 = ranks.find((item) => (item.playerRank || 0) === 1) || ranks[0] || null;
  const top2 = ranks.find((item) => (item.playerRank || 0) === 2) || (ranks[1]?.playerNumber !== top1?.playerNumber ? ranks[1] : null);
  const top3 = ranks.find((item) => (item.playerRank || 0) === 3) || (ranks[2]?.playerNumber !== top1?.playerNumber && ranks[2]?.playerNumber !== top2?.playerNumber ? ranks[2] : null);
  
  const restRanks = ranks.filter(
    (item) =>
      item.playerNumber !== top1?.playerNumber &&
      item.playerNumber !== top2?.playerNumber &&
      item.playerNumber !== top3?.playerNumber
  );

  const style1 = getRankThemeStyle(1, colorTheme);
  const style2 = getRankThemeStyle(2, colorTheme);
  const style3 = getRankThemeStyle(3, colorTheme);

  const getPlayerPhoto = (player, fallback) => {
    return player?.profileImageUrl || player?.photoUrl || fallback;
  };

  // 🎬 GSAP 실제 시상식 순차 타격 애니메이션 (3위 ➜ 2위 ➜ 1위 순차 리빌)
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // 0. 초기 상태: 프레임은 고정되어 있고, 내부 카드가 살짝 축소 & 투명 상태
      gsap.set(".header-bar", { opacity: 0, y: -20 });
      gsap.set(".rest-rank-item", { opacity: 0, x: 40 });
      gsap.set(card3Ref.current, { opacity: 0, x: -60, scale: 0.95 });
      gsap.set(card2Ref.current, { opacity: 0, x: -60, scale: 0.95 });
      gsap.set(card1Ref.current, { opacity: 0, x: -80, scale: 0.9 });

      // [0.0s] 헤더 바 슬라이드
      tl.to(".header-bar", { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0);

      // [0.3s] 우측 4~10위 입상자 순차 슬라이드 (0.12s 간격)
      tl.to(".rest-rank-item", {
        opacity: 1,
        x: 0,
        duration: 0.45,
        stagger: 0.12,
        ease: "power3.out",
      }, 0.3);

      // [1.2s] 🥉 3위 카드 안착 (쾅!)
      tl.to(card3Ref.current, {
        opacity: 1,
        x: 0,
        scale: 1,
        duration: 0.65,
        ease: "back.out(1.8)",
      }, 1.2);

      // [2.5s] 🥈 2위 카드 안착 (쾅!)
      tl.to(card2Ref.current, {
        opacity: 1,
        x: 0,
        scale: 1,
        duration: 0.65,
        ease: "back.out(1.8)",
      }, 2.5);

      // [4.0s] 🥇 대망의 1위 카드 웅장한 확대 안착 (쿵!)
      tl.to(card1Ref.current, {
        opacity: 1,
        x: 0,
        scale: 1,
        duration: 0.8,
        ease: "elastic.out(1, 0.6)",
      }, 4.0);

    }, containerRef);

    return () => ctx.revert();
  }, [ranks, colorTheme]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-black text-white flex flex-col justify-between p-6 sm:p-8 lg:p-10 overflow-hidden select-none"
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
          className="w-full h-full object-cover opacity-40 filter contrast-125"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-slate-950/85" />
      </div>

      {/* 🌟 앰비언트 테마 글로우 */}
      <div
        className="absolute -top-40 left-1/3 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-[180px] pointer-events-none z-1"
        style={{ backgroundColor: theme.glowRgba }}
      />

      {/* 1. 상단: 순수 한글 친화적 공식 방송 헤더 바 */}
      <div className="header-bar relative z-20 flex items-center justify-between border-b border-white/15 pb-4">
        <div className="flex items-center gap-4">
          <div className={`w-3.5 h-10 rounded-full bg-gradient-to-b ${theme.textGradient}`} />
          <div>
            <div className={`text-xs font-black tracking-widest ${theme.primary}`}>
              공식 순위 확정 발표
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white m-0 tracking-tight leading-tight">
              {categoryTitle}
              {gradeTitle && <span className={`${theme.primary} ml-3 font-bold`}>{gradeTitle}</span>}
            </h1>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-black/70 backdrop-blur-xl px-5 py-2 rounded-2xl border border-white/15">
          <CheckCircleOutlined className="text-emerald-400" />
          <span className="text-xs font-bold text-slate-200">심사 결과 확정</span>
        </div>
      </div>

      {/* 2. 메인: 2열 전체 순위표 (좌: 1, 2, 3위 3단 고정 포디움, 우: 4~10위 입상자) */}
      <div className="relative z-10 my-auto grid grid-cols-1 lg:grid-cols-12 gap-6 w-full h-[calc(100vh-170px)] py-2">
        
        {/* ===================== [ 좌측 60%: 1위, 2위, 3위 3단 고정 포디움 (정확한 33% 높이 분할) ] ===================== */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-3 h-full">
          
          {/* 🥇 1위 카드 (상단 32% 영역 - 4.0s 시점에 쿵! 안착) */}
          <div
            ref={card1Ref}
            className={`relative h-[32%] rounded-3xl px-5 py-3 border-2 backdrop-blur-2xl bg-gradient-to-r ${
              style1.bg
            } flex items-center justify-between shadow-2xl overflow-hidden`}
          >
            <div className="relative z-10 flex items-center gap-4 lg:gap-6 min-w-0">
              {/* 1위 사진 */}
              <div className="relative shrink-0">
                <div className={`w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl overflow-hidden border-2 ${style1.border} bg-slate-950 shadow-xl`}>
                  <img
                    src={getPlayerPhoto(top1, demoBodybuilderImg)}
                    alt={top1?.playerName || "1위"}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className={`absolute -bottom-1.5 -right-1.5 px-2.5 py-0.5 rounded-lg ${style1.badgeBg} font-black text-xs shadow-lg`}>
                  1위
                </div>
              </div>

              {/* 선수 정보 */}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-md bg-slate-950 border ${style1.border} font-mono font-black text-sm lg:text-base ${style1.textColor}`}>
                    NO.{top1?.playerNumber || "100"}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full ${style1.titleBadge} font-black text-[10px] lg:text-[11px]`}>
                    1위 • 우승 (대상)
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white m-0 tracking-tight leading-tight break-keep drop-shadow-md">
                  {top1?.playerName || "1위 선수"}
                </h2>

                <div className="text-xs sm:text-sm text-slate-200 font-bold break-keep">
                  {top1?.playerGym || "무소속 / 개인 출전"}
                </div>
              </div>
            </div>

            <div className="relative z-10 text-right hidden sm:block shrink-0 pr-2">
              <span className={`text-base lg:text-lg font-black tracking-widest ${style1.textColor} uppercase font-mono block`}>
                1ST WINNER
              </span>
            </div>
          </div>

          {/* 🥈 2위 카드 (중단 31% 영역 - 2.5s 시점에 쾅! 안착) */}
          <div
            ref={card2Ref}
            className={`relative h-[31%] rounded-3xl px-5 py-3 border backdrop-blur-2xl bg-gradient-to-r ${
              style2.bg
            } flex items-center justify-between shadow-xl overflow-hidden`}
          >
            <div className="relative z-10 flex items-center gap-4 lg:gap-6 min-w-0">
              {/* 2위 사진 */}
              <div className="relative shrink-0">
                <div className="w-18 h-18 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-2xl overflow-hidden border border-slate-300/80 bg-slate-950 shadow-lg">
                  <img
                    src={getPlayerPhoto(top2, demoBodybuilderBg)}
                    alt={top2?.playerName || "2위"}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className={`absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-md ${style2.badgeBg} font-black text-[10px]`}>
                  2위
                </div>
              </div>

              {/* 선수 정보 */}
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-400/50 font-mono font-black text-xs sm:text-sm text-slate-200">
                    NO.{top2?.playerNumber || "102"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">2위 • 준우승</span>
                </div>

                <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white m-0 tracking-tight leading-tight break-keep drop-shadow-md">
                  {top2?.playerName || "2위 선수"}
                </h3>
                
                <div className="text-xs sm:text-sm text-slate-300 font-semibold break-keep">
                  {top2?.playerGym || "무소속 / 개인 출전"}
                </div>
              </div>
            </div>

            <div className="relative z-10 text-right hidden sm:block shrink-0 pr-2">
              <span className="text-sm font-black text-slate-300 uppercase font-mono">2ND PLACE</span>
            </div>
          </div>

          {/* 🥉 3위 카드 (하단 31% 영역 - 1.2s 시점에 쾅! 안착) */}
          <div
            ref={card3Ref}
            className={`relative h-[31%] rounded-3xl px-5 py-3 border backdrop-blur-2xl bg-gradient-to-r ${
              style3.bg
            } flex items-center justify-between shadow-xl overflow-hidden`}
          >
            <div className="relative z-10 flex items-center gap-4 lg:gap-6 min-w-0">
              {/* 3위 사진 */}
              <div className="relative shrink-0">
                <div className="w-18 h-18 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-2xl overflow-hidden border border-amber-600/80 bg-slate-950 shadow-lg">
                  <img
                    src={getPlayerPhoto(top3, demoBodybuilderImg)}
                    alt={top3?.playerName || "3위"}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className={`absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-md ${style3.badgeBg} font-black text-[10px]`}>
                  3위
                </div>
              </div>

              {/* 선수 정보 */}
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded bg-slate-950 border border-amber-600/50 font-mono font-black text-xs sm:text-sm ${theme.primary}`}>
                    NO.{top3?.playerNumber || "103"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">3위</span>
                </div>

                <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white m-0 tracking-tight leading-tight break-keep drop-shadow-md">
                  {top3?.playerName || "3위 선수"}
                </h3>
                
                <div className="text-xs sm:text-sm text-slate-300 font-semibold break-keep">
                  {top3?.playerGym || "무소속 / 개인 출전"}
                </div>
              </div>
            </div>

            <div className="relative z-10 text-right hidden sm:block shrink-0 pr-2">
              <span className={`text-sm font-black ${theme.primary} uppercase font-mono`}>3RD PLACE</span>
            </div>
          </div>

        </div>

        {/* ===================== [ 우측 40%: 본선 입상자 (4위 ~ 최대 10위) ] ===================== */}
        <div className="lg:col-span-5 flex flex-col h-full bg-slate-950/85 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 shrink-0">
            <span className="font-black text-sm text-slate-200 tracking-wider flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${theme.primary} bg-current`} />
              <span>본선 입상자 순위 (4위 ~ 10위)</span>
            </span>
            <span className="text-xs text-slate-400 font-bold">
              총 {ranks.length}명 입상
            </span>
          </div>

          {/* 4위 ~ 10위 카드 목록 */}
          <div className="flex-1 flex flex-col justify-start gap-2 overflow-y-auto pr-1">
            {restRanks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-bold text-xs">
                <span>추가 입상 순위 없음</span>
              </div>
            ) : (
              restRanks.map((item, idx) => {
                const rank = item.playerRank || idx + 4;

                return (
                  <div
                    key={idx}
                    className="rest-rank-item rounded-2xl p-3 border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-between shadow-md backdrop-blur-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-white font-black text-sm shrink-0">
                        {rank}위
                      </div>

                      <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-white/10 shrink-0">
                        <span className={`text-sm font-mono font-black ${theme.primary}`}>
                          NO.{item.playerNumber}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="text-base lg:text-lg font-black text-white leading-tight break-keep">
                          {item.playerName}
                        </div>
                        <div className="text-xs text-slate-400 font-medium break-keep">
                          {item.playerGym || "무소속"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 3. 하단 공식 방송 바 (순수 Info 집중) */}
      <div className="relative z-20 flex items-center justify-between border-t border-white/15 pt-3 shrink-0">
        <div className="text-xs text-slate-400 font-bold flex items-center gap-2">
          <TrophyOutlined className={theme.primary} />
          <span>{contestTitle} 공식 시상식 • 최종 순위 확정 발표</span>
        </div>

        <div className={`text-xs font-black tracking-widest ${theme.primary} uppercase font-mono`}>
          CERTIFIED OFFICIAL RANKINGS • 공식 순위 발표
        </div>
      </div>
    </div>
  );
};

export default RankingCeremonyScene;
