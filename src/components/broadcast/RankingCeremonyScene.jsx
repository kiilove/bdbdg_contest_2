"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import { useFirestoreQuery } from "../../hooks/useFirestores";
import { where } from "firebase/firestore";
import { gsap } from "gsap";
import { TrophyOutlined, CheckCircleOutlined } from "@ant-design/icons";
import defaultAwardVideo from "../../assets/mov/award2.mp4";
import SmoothBackgroundVideo from "./SmoothBackgroundVideo";
import { THEME_CONFIGS } from "./AthleteIntroScene";
import "./AthleteIntroScene.css";

const getRankThemeStyle = (rank, themeKey = "GOLD") => {
  const theme = THEME_CONFIGS[themeKey] || THEME_CONFIGS.GOLD;

  switch (rank) {
    case 1:
      return {
        bg: `bg-slate-950/98 ${theme.border} shadow-[0_20px_60px_rgba(0,0,0,0.95)]`,
        badgeBg: `bg-gradient-to-br ${theme.textGradient} text-slate-950`,
        border: theme.border,
        textColor: theme.primary,
        titleBadge: theme.badgeBg,
      };
    case 2:
      return {
        bg: "bg-slate-950/98 border-slate-300/80 shadow-[0_15px_40px_rgba(0,0,0,0.9)]",
        badgeBg: "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950",
        border: "border-slate-300/80",
        textColor: "text-slate-200",
        titleBadge: "bg-slate-300/20 text-slate-200 border-slate-300/30",
      };
    case 3:
      return {
        bg: "bg-slate-950/98 border-amber-600/80 shadow-[0_15px_40px_rgba(0,0,0,0.9)]",
        badgeBg: "bg-gradient-to-br from-amber-600 to-amber-800 text-white",
        border: "border-amber-600/80",
        textColor: "text-amber-400",
        titleBadge: "bg-amber-700/20 text-amber-300 border-amber-600/30",
      };
    default:
      return {
        bg: "bg-slate-950/98 border-white/10 shadow-lg",
        badgeBg: "bg-slate-800 text-slate-300",
        border: "border-white/10",
        textColor: "text-slate-200",
        titleBadge: "bg-white/10 text-slate-300 border-white/10",
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

  // 1, 2, 3위 및 4~10위 안정적 매핑 (데이터가 없을 때도 테스트 가능한 슬롯 지원)
  const top1 = ranks.find((item) => (item.playerRank || 0) === 1) || ranks[0] || null;
  const top2 = ranks.find((item) => (item.playerRank || 0) === 2) || (ranks[1]?.playerNumber !== top1?.playerNumber ? ranks[1] : null);
  const top3 = ranks.find((item) => (item.playerRank || 0) === 3) || (ranks[2]?.playerNumber !== top1?.playerNumber && ranks[2]?.playerNumber !== top2?.playerNumber ? ranks[2] : null);
  
  const restRanks = ranks.filter(
    (item) =>
      item.playerNumber !== top1?.playerNumber &&
      item.playerNumber !== top2?.playerNumber &&
      item.playerNumber !== top3?.playerNumber
  );

  const displayTop1 = top1 || {
    playerRank: 1,
    playerNumber: "-",
    playerName: "[1위 대상 집계중]",
    playerGym: "심사위원 채점 진행중",
  };

  const displayTop2 = top2 || {
    playerRank: 2,
    playerNumber: "-",
    playerName: "[2위 준우승 집계중]",
    playerGym: "심사위원 채점 진행중",
  };

  const displayTop3 = top3 || {
    playerRank: 3,
    playerNumber: "-",
    playerName: "[3위 입상자 집계중]",
    playerGym: "심사위원 채점 진행중",
  };

  const displayRestRanks = (restRanks && restRanks.length > 0)
    ? restRanks
    : (!ranks || ranks.length === 0)
      ? [
          { playerRank: 4, playerNumber: "-", playerName: "[4위 입상자 대기]", playerGym: "채점 집계 대기" },
          { playerRank: 5, playerNumber: "-", playerName: "[5위 입상자 대기]", playerGym: "채점 집계 대기" },
          { playerRank: 6, playerNumber: "-", playerName: "[6위 입상자 대기]", playerGym: "채점 집계 대기" },
        ]
      : [];

  const style1 = getRankThemeStyle(1, colorTheme);
  const style2 = getRankThemeStyle(2, colorTheme);
  const style3 = getRankThemeStyle(3, colorTheme);

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
      className="relative w-screen h-screen bg-transparent text-white flex flex-col justify-between p-6 sm:p-8 lg:p-10 overflow-hidden select-none"
    >
      {/* 1. 상단: 공식 방송 헤더 바 */}
      <div className="header-bar relative z-20 flex items-center justify-between gap-3 border-b border-white/15 pb-3 sm:pb-4 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 mr-2">
          <div className={`w-2.5 sm:w-3.5 h-10 rounded-full bg-gradient-to-b ${theme.textGradient} shrink-0`} />
          <div className="min-w-0 flex-1">
            <div className={`text-[10px] sm:text-xs font-black tracking-widest ${theme.primary} uppercase flex items-center gap-1.5`}>
              <span>OFFICIAL RANKING CEREMONY • 공식 순위 발표</span>
            </div>
            <h1 className="text-base sm:text-2xl lg:text-3xl font-black text-white m-0 tracking-tight leading-tight truncate">
              {categoryTitle || "공식 종목"} {gradeTitle && <span className={`${theme.primary} ml-2 font-mono`}>{gradeTitle}</span>}
            </h1>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 bg-black/85 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-2xl border border-white/15 shadow-xl">
          <CheckCircleOutlined className={ranks.length > 0 ? "text-emerald-400" : "text-amber-400 animate-pulse"} />
          <span className="text-[11px] sm:text-xs font-bold text-slate-200">
            {ranks.length > 0 ? "심사 결과 확정" : "실시간 채점 집계 모드"}
          </span>
        </div>
      </div>

      {/* 2. 메인: 2열 전체 순위표 (좌: 1, 2, 3위 3단 고정 포디움, 우: 4~10위 입상자) - 1:1 / 4:3 / 16:9 상시 2열 유지 */}
      <div className="relative z-10 my-auto grid grid-cols-12 gap-2.5 sm:gap-4 lg:gap-6 w-full h-[calc(100vh-130px)] py-1 sm:py-2">
        
        {/* ===================== [ 좌측: 1위, 2위, 3위 3단 고정 포디움 ] ===================== */}
        <div className="col-span-6 lg:col-span-7 flex flex-col justify-between gap-2 sm:gap-3 h-full">
          
          {/* 🥇 1위 카드 (상단 33% 영역 - 100% 솔리드 딥블랙 음영 차폐) */}
          <div
            ref={card1Ref}
            className={`relative h-[33%] rounded-2xl sm:rounded-3xl px-3 sm:px-5 py-2 sm:py-3 border-2 ${
              style1.border
            } bg-slate-950 flex items-center justify-between shadow-[0_25px_60px_rgba(0,0,0,0.98)] overflow-hidden`}
          >
            {/* 100% 차폐 딥블랙 배경 레이어 & 테마 앰비언트 글로우 */}
            <div className="absolute inset-0 bg-slate-950 pointer-events-none z-0" />
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-transparent to-black/80 pointer-events-none z-0" />
            <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-b from-amber-400 via-yellow-300 to-amber-500 z-10" />

            <div className="relative z-10 flex items-center gap-2.5 sm:gap-4 lg:gap-6 min-w-0 pl-1.5">
              {/* 1위 사진 */}
              <div className="relative shrink-0">
                <div className={`w-14 h-14 sm:w-20 sm:h-20 lg:w-28 lg:h-28 rounded-xl sm:rounded-2xl overflow-hidden border-2 ${style1.border} bg-black shadow-2xl flex items-center justify-center`}>
                  {displayTop1.stagePhotoUrl || displayTop1.profileImageUrl || displayTop1.photoUrl ? (
                    <img
                      src={displayTop1.stagePhotoUrl || displayTop1.profileImageUrl || displayTop1.photoUrl}
                      alt={displayTop1.playerName}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <TrophyOutlined className="text-2xl sm:text-4xl text-amber-400" />
                  )}
                </div>
                <div className={`absolute -bottom-1 -right-1 px-1.5 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg ${style1.badgeBg} font-black text-[10px] sm:text-xs shadow-lg`}>
                  1위
                </div>
              </div>

              {/* 선수 정보 */}
              <div className="min-w-0 space-y-0.5 sm:space-y-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className={`px-1.5 sm:px-2.5 py-0.5 rounded-md bg-black border ${style1.border} font-mono font-black text-xs sm:text-sm lg:text-base ${style1.textColor}`}>
                    NO.{displayTop1.playerNumber}
                  </span>
                  <span className={`px-1.5 sm:px-2.5 py-0.5 rounded-full ${style1.titleBadge} font-black text-[9px] sm:text-[10px] lg:text-[11px]`}>
                    1위 • 우승 (대상)
                  </span>
                </div>

                <h2 className="text-lg sm:text-2xl lg:text-4xl font-black text-white m-0 tracking-tight leading-tight break-keep drop-shadow-[0_4px_15px_rgba(0,0,0,1)] truncate">
                  {displayTop1.playerName}
                </h2>

                <div className="text-[11px] sm:text-xs lg:text-sm text-slate-200 font-bold break-keep truncate drop-shadow-md">
                  {displayTop1.playerGym}
                </div>
              </div>
            </div>

            <div className="relative z-10 text-right hidden xl:block shrink-0 pr-2">
              <span className={`text-base lg:text-lg font-black tracking-widest ${style1.textColor} uppercase font-mono block`}>
                1ST WINNER
              </span>
            </div>
          </div>

          {/* 🥈 2위 카드 (중단 32% 영역 - 100% 솔리드 딥블랙 음영 차폐) */}
          <div
            ref={card2Ref}
            className="relative h-[32%] rounded-2xl sm:rounded-3xl px-3 sm:px-5 py-2 sm:py-3 border border-slate-300/80 bg-slate-950 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.95)] overflow-hidden"
          >
            <div className="absolute inset-0 bg-slate-950 pointer-events-none z-0" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-400/15 via-transparent to-black/80 pointer-events-none z-0" />
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-slate-200 to-slate-400 z-10" />

            <div className="relative z-10 flex items-center gap-2.5 sm:gap-4 lg:gap-6 min-w-0 pl-1">
              {/* 2위 사진 */}
              <div className="relative shrink-0">
                <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl overflow-hidden border border-slate-300/80 bg-black shadow-xl flex items-center justify-center">
                  {displayTop2.stagePhotoUrl || displayTop2.profileImageUrl || displayTop2.photoUrl ? (
                    <img
                      src={displayTop2.stagePhotoUrl || displayTop2.profileImageUrl || displayTop2.photoUrl}
                      alt={displayTop2.playerName}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <TrophyOutlined className="text-xl sm:text-3xl text-slate-300" />
                  )}
                </div>
                <div className={`absolute -bottom-1 -right-1 px-1.5 sm:px-2 py-0.5 rounded-md ${style2.badgeBg} font-black text-[9px] sm:text-[10px]`}>
                  2위
                </div>
              </div>

              {/* 선수 정보 */}
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="px-1.5 sm:px-2 py-0.5 rounded bg-black border border-slate-400/50 font-mono font-black text-[11px] sm:text-xs lg:text-sm text-slate-200">
                    NO.{displayTop2.playerNumber}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold">2위 • 준우승</span>
                </div>

                <h3 className="text-base sm:text-xl lg:text-3xl font-black text-white m-0 tracking-tight leading-tight break-keep drop-shadow-[0_4px_15px_rgba(0,0,0,1)] truncate">
                  {displayTop2.playerName}
                </h3>
                
                <div className="text-[10px] sm:text-xs lg:text-sm text-slate-300 font-semibold break-keep truncate drop-shadow-md">
                  {displayTop2.playerGym}
                </div>
              </div>
            </div>

            <div className="relative z-10 text-right hidden xl:block shrink-0 pr-2">
              <span className="text-sm font-black text-slate-300 uppercase font-mono">2ND PLACE</span>
            </div>
          </div>

          {/* 🥉 3위 카드 (하단 32% 영역 - 100% 솔리드 딥블랙 음영 차폐) */}
          <div
            ref={card3Ref}
            className="relative h-[32%] rounded-2xl sm:rounded-3xl px-3 sm:px-5 py-2 sm:py-3 border border-amber-600/80 bg-slate-950 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.95)] overflow-hidden"
          >
            <div className="absolute inset-0 bg-slate-950 pointer-events-none z-0" />
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600/15 via-transparent to-black/80 pointer-events-none z-0" />
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-amber-600 to-amber-800 z-10" />

            <div className="relative z-10 flex items-center gap-2.5 sm:gap-4 lg:gap-6 min-w-0 pl-1">
              {/* 3위 사진 */}
              <div className="relative shrink-0">
                <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl overflow-hidden border border-amber-600/80 bg-black shadow-xl flex items-center justify-center">
                  {displayTop3.stagePhotoUrl || displayTop3.profileImageUrl || displayTop3.photoUrl ? (
                    <img
                      src={displayTop3.stagePhotoUrl || displayTop3.profileImageUrl || displayTop3.photoUrl}
                      alt={displayTop3.playerName}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <TrophyOutlined className="text-xl sm:text-3xl text-amber-500" />
                  )}
                </div>
                <div className={`absolute -bottom-1 -right-1 px-1.5 sm:px-2 py-0.5 rounded-md ${style3.badgeBg} font-black text-[9px] sm:text-[10px]`}>
                  3위
                </div>
              </div>

              {/* 선수 정보 */}
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className={`px-1.5 sm:px-2 py-0.5 rounded bg-black border border-amber-600/50 font-mono font-black text-[11px] sm:text-xs lg:text-sm ${theme.primary}`}>
                    NO.{displayTop3.playerNumber}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold">3위</span>
                </div>

                <h3 className="text-base sm:text-xl lg:text-3xl font-black text-white m-0 tracking-tight leading-tight break-keep drop-shadow-[0_4px_15px_rgba(0,0,0,1)] truncate">
                  {displayTop3.playerName}
                </h3>
                
                <div className="text-[10px] sm:text-xs lg:text-sm text-slate-300 font-semibold break-keep truncate drop-shadow-md">
                  {displayTop3.playerGym}
                </div>
              </div>
            </div>

            <div className="relative z-10 text-right hidden xl:block shrink-0 pr-2">
              <span className={`text-sm font-black ${theme.primary} uppercase font-mono`}>3RD PLACE</span>
            </div>
          </div>

        </div>

        {/* ===================== [ 우측: 본선 입상자 (4위 ~ 최대 10위) - 스크롤 없이 100% 한 화면 노출 ] ===================== */}
        <div className="col-span-6 lg:col-span-5 flex flex-col h-full bg-slate-950/95 rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-white/15 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 sm:pb-3 mb-2 shrink-0">
            <span className="font-black text-xs sm:text-sm text-slate-200 tracking-wider flex items-center gap-1.5 sm:gap-2">
              <span className={`w-2 h-2 rounded-full ${theme.primary} bg-current`} />
              <span>본선 입상자 (4위 ~ 10위)</span>
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-bold">
              {ranks.length > 0 ? `총 ${ranks.length}명` : "집계 모드"}
            </span>
          </div>

          {/* 4위 ~ 10위 카드 목록 (상단부터 단정하게 정렬) */}
          <div className="flex-1 flex flex-col justify-start gap-2 sm:gap-2.5 overflow-y-auto pr-0.5">
            {displayRestRanks.map((item, idx) => {
              const rank = item.playerRank || idx + 4;
              const isDense = displayRestRanks.length >= 6;

              return (
                <div
                  key={idx}
                  className={`rest-rank-item rounded-xl sm:rounded-2xl ${
                    isDense ? "p-1.5 sm:p-2" : "p-2.5 sm:p-3"
                  } border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-between shadow-md backdrop-blur-md transition-all`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className={`flex items-center justify-center ${
                      isDense ? "w-7 h-7 sm:w-8 sm:h-8 text-xs font-black" : "w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm font-black"
                    } rounded-lg sm:rounded-xl bg-slate-800 border border-slate-700 text-white shrink-0`}>
                      {rank}위
                    </div>

                    <div className={`${isDense ? "px-2 py-0.5" : "px-2.5 py-1"} rounded-md sm:rounded-lg bg-slate-950 border border-white/10 shrink-0`}>
                      <span className={`text-xs sm:text-sm font-mono font-black ${theme.primary}`}>
                        NO.{item.playerNumber}
                      </span>
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className={`${isDense ? "text-xs sm:text-sm lg:text-base" : "text-sm sm:text-base lg:text-lg"} font-black text-white leading-tight break-keep truncate`}>
                        {item.playerName}
                      </div>
                      {item.playerGym && (
                        <div className="text-[10px] sm:text-xs text-slate-400 font-medium break-keep truncate max-w-[100px] sm:max-w-[160px]">
                          {item.playerGym}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
