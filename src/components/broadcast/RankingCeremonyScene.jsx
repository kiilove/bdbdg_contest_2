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

  // 1, 2, 3위 및 4~10위 슬롯 동적 추출 (실제 참가 선수 인원 수 동적 반영)
  const top1 = ranks.find((item) => (item.playerRank || item.rank || 0) === 1) || (ranks.length > 0 ? ranks[0] : null);
  const top2 = ranks.find((item) => (item.playerRank || item.rank || 0) === 2) || (ranks.length > 1 && ranks[1]?.playerNumber !== top1?.playerNumber ? ranks[1] : null);
  const top3 = ranks.find((item) => (item.playerRank || item.rank || 0) === 3) || (ranks.length > 2 && ranks[2]?.playerNumber !== top1?.playerNumber && ranks[2]?.playerNumber !== top2?.playerNumber ? ranks[2] : null);
  
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

  const getPlayerPhoto = (player) => {
    if (!player) return "";
    const matched = realPlayersMap[String(player.playerNumber).trim()] || realPlayersMap[String(player.playerName).trim()];
    return (
      player.stagePhoto1 ||
      player.stagePhotoUrl1 ||
      player.stagePhotoUrl ||
      player.profileImageUrl ||
      player.photoUrl ||
      matched?.stagePhoto1 ||
      matched?.stagePhotoUrl1 ||
      matched?.stagePhotoUrl ||
      matched?.profileImageUrl ||
      matched?.photoUrl ||
      ""
    );
  };

  const style1 = getRankThemeStyle(1, colorTheme);
  const style2 = getRankThemeStyle(2, colorTheme);
  const style3 = getRankThemeStyle(3, colorTheme);

  useEffect(() => {
    console.log("%c[SCENE: RANKING] 🏆 공식 순위 발표 화면 렌더링!", "background:#eab308;color:black;font-weight:bold;font-size:14px;", {
      contestTitle,
      categoryTitle,
      gradeTitle,
      rankingData,
      ranks,
      displayTop1,
      displayTop2,
      displayTop3,
      displayRestRanks,
    });
  }, [contestTitle, categoryTitle, gradeTitle, rankingData, ranks, displayTop1, displayTop2, displayTop3, displayRestRanks]);

  // 🎬 GSAP 실제 시상식 순차 타격 애니메이션
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // [0.0s] 헤더 바 슬라이드
      tl.fromTo(".header-bar", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0);

      // [0.2s] 4위 이상 입상자 (있을 때만)
      if (document.querySelectorAll(".rest-rank-item").length > 0) {
        tl.fromTo(".rest-rank-item", { opacity: 0, x: 40 }, {
          opacity: 1,
          x: 0,
          duration: 0.45,
          stagger: 0.1,
          ease: "power3.out",
        }, 0.2);
      }

      // [0.8s] 🥉 3위 카드 (있을 때만)
      if (card3Ref.current) {
        tl.fromTo(card3Ref.current, { opacity: 0, x: -60, scale: 0.95 }, {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.65,
          ease: "back.out(1.8)",
        }, 0.8);
      }

      // [1.4s] 🥈 2위 카드
      if (card2Ref.current) {
        tl.fromTo(card2Ref.current, { opacity: 0, x: -60, scale: 0.95 }, {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.65,
          ease: "back.out(1.8)",
        }, 1.4);
      }

      // [2.0s] 🥇 대망의 1위 카드 웅장한 확대 안착
      if (card1Ref.current) {
        tl.fromTo(card1Ref.current, { opacity: 0, x: -80, scale: 0.9 }, {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.8,
          ease: "elastic.out(1, 0.6)",
        }, 2.0);
      }

    }, containerRef);

    return () => ctx.revert();
  }, [ranks, colorTheme, displayTop1?.playerNumber, displayTop2?.playerNumber, displayTop3?.playerNumber]);

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
            {ranks.length > 0 ? `출전 선수 ${ranks.length}명 심사 결과` : "실시간 채점 집계 모드"}
          </span>
        </div>
      </div>

      {/* 2. 메인: 동적 전체 순위표 (인원수에 맞게 자동 적응) */}
      <div className="relative z-10 my-auto w-full h-[calc(100vh-130px)] py-1 sm:py-2 flex items-center justify-center">
        
        {displayRestRanks.length > 0 ? (
          /* 4명 이상 출전: 좌측 1·2·3위 포디움 + 우측 4~N위 순위표 */
          <div className="grid grid-cols-12 gap-2.5 sm:gap-4 lg:gap-6 w-full h-full">
            
            {/* ===================== [ 좌측: 1위, 2위, 3위 포디움 ] ===================== */}
            <div className="col-span-6 lg:col-span-7 flex flex-col justify-between gap-2 sm:gap-3 h-full">
              
              {/* 🥇 1위 카드 */}
              {displayTop1 && (
                <div
                  ref={card1Ref}
                  className={`relative flex-1 rounded-2xl sm:rounded-3xl px-3 sm:px-5 py-2 sm:py-3 border-2 ${
                    style1.border
                  } bg-slate-950 flex items-center justify-between shadow-[0_25px_60px_rgba(0,0,0,0.98)] overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-slate-950 pointer-events-none z-0" />
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-transparent to-black/80 pointer-events-none z-0" />
                  <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-b from-amber-400 via-yellow-300 to-amber-500 z-10" />

                  <div className="relative z-10 flex items-center gap-2.5 sm:gap-4 lg:gap-6 min-w-0 pl-1.5">
                    <div className="relative shrink-0">
                      <div className={`w-14 h-14 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl overflow-hidden border-2 ${style1.border} bg-black shadow-2xl flex items-center justify-center`}>
                        {getPlayerPhoto(displayTop1) ? (
                          <img
                            src={getPlayerPhoto(displayTop1)}
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

                    <div className="min-w-0 space-y-0.5 sm:space-y-1">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className={`px-1.5 sm:px-2.5 py-0.5 rounded-md bg-black border ${style1.border} font-mono font-black text-xs sm:text-sm lg:text-base ${style1.textColor}`}>
                          NO.{displayTop1.playerNumber}
                        </span>
                        <span className={`px-1.5 sm:px-2.5 py-0.5 rounded-full ${style1.titleBadge} font-black text-[9px] sm:text-[10px] lg:text-[11px]`}>
                          1위 • 우승
                        </span>
                      </div>

                      <h2 className="text-lg sm:text-2xl lg:text-3xl font-black text-white m-0 tracking-tight leading-tight break-keep truncate">
                        {displayTop1.playerName}
                      </h2>

                      <div className="text-[11px] sm:text-xs lg:text-sm text-slate-200 font-bold break-keep truncate drop-shadow-md">
                        {displayTop1.playerGym || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 text-right hidden xl:block shrink-0 pr-2">
                    <span className={`text-base lg:text-lg font-black tracking-widest ${style1.textColor} uppercase font-mono block`}>
                      1ST WINNER
                    </span>
                  </div>
                </div>
              )}

              {/* 🥈 2위 카드 */}
              {displayTop2 && (
                <div
                  ref={card2Ref}
                  className="relative flex-1 rounded-2xl sm:rounded-3xl px-3 sm:px-5 py-2 sm:py-3 border border-slate-300/80 bg-slate-950 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.95)] overflow-hidden"
                >
                  <div className="absolute inset-0 bg-slate-950 pointer-events-none z-0" />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-400/15 via-transparent to-black/80 pointer-events-none z-0" />
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-slate-200 to-slate-400 z-10" />

                  <div className="relative z-10 flex items-center gap-2.5 sm:gap-4 lg:gap-6 min-w-0 pl-1">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-xl sm:rounded-2xl overflow-hidden border border-slate-300/80 bg-black shadow-xl flex items-center justify-center">
                        {getPlayerPhoto(displayTop2) ? (
                          <img
                            src={getPlayerPhoto(displayTop2)}
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

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="px-1.5 sm:px-2 py-0.5 rounded bg-black border border-slate-400/50 font-mono font-black text-[11px] sm:text-xs lg:text-sm text-slate-200">
                          NO.{displayTop2.playerNumber}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold">2위 • 준우승</span>
                      </div>

                      <h3 className="text-base sm:text-xl lg:text-2xl font-black text-white m-0 tracking-tight leading-tight break-keep truncate">
                        {displayTop2.playerName}
                      </h3>
                      
                      <div className="text-[10px] sm:text-xs lg:text-sm text-slate-300 font-semibold break-keep truncate drop-shadow-md">
                        {displayTop2.playerGym || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 text-right hidden xl:block shrink-0 pr-2">
                    <span className="text-sm font-black text-slate-300 uppercase font-mono">2ND PLACE</span>
                  </div>
                </div>
              )}

              {/* 🥉 3위 카드 */}
              {displayTop3 && (
                <div
                  ref={card3Ref}
                  className="relative flex-1 rounded-2xl sm:rounded-3xl px-3 sm:px-5 py-2 sm:py-3 border border-amber-600/80 bg-slate-950 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.95)] overflow-hidden"
                >
                  <div className="absolute inset-0 bg-slate-950 pointer-events-none z-0" />
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600/15 via-transparent to-black/80 pointer-events-none z-0" />
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-amber-600 to-amber-800 z-10" />

                  <div className="relative z-10 flex items-center gap-2.5 sm:gap-4 lg:gap-6 min-w-0 pl-1">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-xl sm:rounded-2xl overflow-hidden border border-amber-600/80 bg-black shadow-xl flex items-center justify-center">
                        {getPlayerPhoto(displayTop3) ? (
                          <img
                            src={getPlayerPhoto(displayTop3)}
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

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className={`px-1.5 sm:px-2 py-0.5 rounded bg-black border border-amber-600/50 font-mono font-black text-[11px] sm:text-xs lg:text-sm ${theme.primary}`}>
                          NO.{displayTop3.playerNumber}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold">3위 • 입상</span>
                      </div>

                      <h3 className="text-base sm:text-xl lg:text-2xl font-black text-white m-0 tracking-tight leading-tight break-keep truncate">
                        {displayTop3.playerName}
                      </h3>
                      
                      <div className="text-[10px] sm:text-xs lg:text-sm text-slate-300 font-semibold break-keep truncate drop-shadow-md">
                        {displayTop3.playerGym || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 text-right hidden xl:block shrink-0 pr-2">
                    <span className={`text-sm font-black ${theme.primary} uppercase font-mono`}>3RD PLACE</span>
                  </div>
                </div>
              )}

            </div>

            {/* ===================== [ 우측: 본선 입상자 (4위 ~ N위) ] ===================== */}
            <div className="col-span-6 lg:col-span-5 flex flex-col h-full bg-slate-950/95 rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-white/15 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 sm:pb-3 mb-2 shrink-0">
                <span className="font-black text-xs sm:text-sm text-slate-200 tracking-wider flex items-center gap-1.5 sm:gap-2">
                  <span className={`w-2 h-2 rounded-full ${theme.primary} bg-current`} />
                  <span>본선 입상자 (TOP 4 ~ {ranks.length})</span>
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 font-bold">
                  총 {ranks.length}명
                </span>
              </div>

              {/* 4위 ~ N위 카드 목록 */}
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
        ) : (
          /* 2~3명 출전: 우측 더미 박스 없이 1위·2위(·3위)를 화면 중앙에 웅장하게 배치 */
          <div className="w-full max-w-3xl lg:max-w-4xl mx-auto flex flex-col justify-center gap-3 sm:gap-4 h-full py-1">
            
            {/* 🥇 1위 카드 */}
            {displayTop1 && (
              <div
                ref={card1Ref}
                className={`relative flex-1 rounded-3xl p-4 sm:p-6 border-2 ${
                  style1.border
                } bg-slate-950 flex items-center justify-between shadow-[0_25px_60px_rgba(0,0,0,0.98)] overflow-hidden`}
              >
                <div className="absolute inset-0 bg-slate-950 pointer-events-none z-0" />
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-transparent to-black/80 pointer-events-none z-0" />
                <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-b from-amber-400 via-yellow-300 to-amber-500 z-10" />

                <div className="relative z-10 flex items-center gap-4 sm:gap-6 min-w-0 pl-2">
                  <div className="relative shrink-0">
                    <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 ${style1.border} bg-black shadow-2xl flex items-center justify-center`}>
                      {getPlayerPhoto(displayTop1) ? (
                        <img
                          src={getPlayerPhoto(displayTop1)}
                          alt={displayTop1.playerName}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <TrophyOutlined className="text-3xl sm:text-4xl text-amber-400" />
                      )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-md ${style1.badgeBg} font-black text-xs sm:text-sm shadow-lg`}>
                      1위
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded bg-black border ${style1.border} font-mono font-black text-sm ${style1.textColor}`}>
                        NO.{displayTop1.playerNumber}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full ${style1.titleBadge} font-black text-[10px] sm:text-xs`}>
                        1위 • 우승
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white m-0 tracking-tight leading-tight break-keep truncate drop-shadow-md">
                      {displayTop1.playerName}
                    </h2>

                    <div className="text-sm text-slate-200 font-bold break-keep truncate drop-shadow">
                      {displayTop1.playerGym || "-"}
                    </div>
                  </div>
                </div>

                <div className="relative z-10 text-right hidden md:block shrink-0 pr-4">
                  <span className={`text-lg font-black tracking-widest ${style1.textColor} uppercase font-mono block`}>
                    1ST WINNER
                  </span>
                </div>
              </div>
            )}

            {/* 🥈 2위 카드 */}
            {displayTop2 && (
              <div
                ref={card2Ref}
                className="relative flex-1 rounded-3xl p-4 sm:p-6 border border-slate-300/80 bg-slate-950 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.95)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-slate-950 pointer-events-none z-0" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-400/15 via-transparent to-black/80 pointer-events-none z-0" />
                <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-b from-slate-200 to-slate-400 z-10" />

                <div className="relative z-10 flex items-center gap-4 sm:gap-6 min-w-0 pl-2">
                  <div className="relative shrink-0">
                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-slate-300/80 bg-black shadow-xl flex items-center justify-center">
                      {getPlayerPhoto(displayTop2) ? (
                        <img
                          src={getPlayerPhoto(displayTop2)}
                          alt={displayTop2.playerName}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <TrophyOutlined className="text-2xl sm:text-3xl text-slate-300" />
                      )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-md ${style2.badgeBg} font-black text-xs`}>
                      2위
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-black border border-slate-400/50 font-mono font-black text-xs sm:text-sm text-slate-200">
                        NO.{displayTop2.playerNumber}
                      </span>
                      <span className="text-[10px] sm:text-xs text-slate-400 font-bold">2위 • 준우승</span>
                    </div>

                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white m-0 tracking-tight leading-tight break-keep truncate drop-shadow-md">
                      {displayTop2.playerName}
                    </h3>
                    
                    <div className="text-xs sm:text-sm text-slate-300 font-semibold break-keep truncate drop-shadow">
                      {displayTop2.playerGym || "-"}
                    </div>
                  </div>
                </div>

                <div className="relative z-10 text-right hidden md:block shrink-0 pr-4">
                  <span className="text-sm font-black text-slate-300 uppercase font-mono">2ND PLACE</span>
                </div>
              </div>
            )}

            {/* 🥉 3위 카드 (3명일 때만 노출) */}
            {displayTop3 && (
              <div
                ref={card3Ref}
                className="relative flex-1 rounded-3xl p-4 sm:p-6 border border-amber-600/80 bg-slate-950 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.95)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-slate-950 pointer-events-none z-0" />
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/15 via-transparent to-black/80 pointer-events-none z-0" />
                <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-b from-amber-600 to-amber-800 z-10" />

                <div className="relative z-10 flex items-center gap-4 sm:gap-6 min-w-0 pl-2">
                  <div className="relative shrink-0">
                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-amber-600/80 bg-black shadow-xl flex items-center justify-center">
                      {getPlayerPhoto(displayTop3) ? (
                        <img
                          src={getPlayerPhoto(displayTop3)}
                          alt={displayTop3.playerName}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <TrophyOutlined className="text-2xl sm:text-3xl text-amber-500" />
                      )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-md ${style3.badgeBg} font-black text-xs`}>
                      3위
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded bg-black border border-amber-600/50 font-mono font-black text-xs sm:text-sm ${theme.primary}`}>
                        NO.{displayTop3.playerNumber}
                      </span>
                      <span className="text-[10px] sm:text-xs text-slate-400 font-bold">3위 • 입상</span>
                    </div>

                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white m-0 tracking-tight leading-tight break-keep truncate drop-shadow-md">
                      {displayTop3.playerName}
                    </h3>
                    
                    <div className="text-xs sm:text-sm text-slate-300 font-semibold break-keep truncate drop-shadow">
                      {displayTop3.playerGym || "-"}
                    </div>
                  </div>
                </div>

                <div className="relative z-10 text-right hidden md:block shrink-0 pr-4">
                  <span className={`text-sm font-black ${theme.primary} uppercase font-mono`}>3RD PLACE</span>
                </div>
              </div>
            )}

          </div>
        )}

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
