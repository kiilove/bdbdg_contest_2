"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import { useFirestoreQuery } from "../../hooks/useFirestores";
import { where } from "firebase/firestore";
import { gsap } from "gsap";
import {
  TrophyOutlined,
  CrownOutlined,
  StarFilled,
  CheckCircleOutlined,
  ThunderboltFilled,
  FireFilled,
} from "@ant-design/icons";
import { THEME_CONFIGS } from "./AthleteIntroScene";
import "./AthleteIntroScene.css";

const AwardCeremonyScene = ({
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
  const podium1Ref = useRef(null);
  const podium2Ref = useRef(null);
  const podium3Ref = useRef(null);
  const bottomRibbonRef = useRef(null);

  const [ranks, setRanks] = useState([]);
  const { currentContest } = useContext(CurrentContestContext);
  const fetchResultQuery = useFirestoreQuery();

  const theme = THEME_CONFIGS[colorTheme] || THEME_CONFIGS.GOLD;

  const isValidPhoto = (u) =>
    typeof u === "string" &&
    u.trim().length > 5 &&
    !u.toLowerCase().includes("poster") &&
    !u.toLowerCase().includes("banner") &&
    !u.toLowerCase().includes("logo") &&
    !u.toLowerCase().includes("certificate");

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

  const getPlayerPhoto = (p) => {
    if (!p) return "";
    const matched = realPlayersMap[String(p.playerNumber).trim()] || realPlayersMap[String(p.playerName).trim()];
    return (
      (isValidPhoto(p.stagePhoto1) && p.stagePhoto1) ||
      (isValidPhoto(p.stagePhotoUrl1) && p.stagePhotoUrl1) ||
      (isValidPhoto(p.stagePhotoUrl) && p.stagePhotoUrl) ||
      (isValidPhoto(p.stagePhoto2) && p.stagePhoto2) ||
      (isValidPhoto(p.stagePhotoUrl2) && p.stagePhotoUrl2) ||
      (isValidPhoto(p.profileImageUrl) && p.profileImageUrl) ||
      (isValidPhoto(p.photoUrl) && p.photoUrl) ||
      (isValidPhoto(p.playerPhoto) && p.playerPhoto) ||
      (Array.isArray(p.photos) && p.photos.find(isValidPhoto)) ||
      (matched && (
        (isValidPhoto(matched.stagePhoto1) && matched.stagePhoto1) ||
        (isValidPhoto(matched.stagePhotoUrl1) && matched.stagePhotoUrl1) ||
        (isValidPhoto(matched.stagePhotoUrl) && matched.stagePhotoUrl) ||
        (isValidPhoto(matched.stagePhoto2) && matched.stagePhoto2) ||
        (isValidPhoto(matched.profileImageUrl) && matched.profileImageUrl) ||
        (isValidPhoto(matched.photoUrl) && matched.photoUrl)
      )) ||
      ""
    );
  };

  // 1. 순위 데이터 필터링 & 정렬
  const processRankingData = (rawList) => {
    if (!rawList || rawList.length === 0) return [];
    return rawList
      .filter((item) => {
        const r = item.playerRank || item.rank || 0;
        return r > 0 && r <= 10 && !item.playerNoShow && !item.isRankExcluded;
      })
      .sort((a, b) => (a.playerRank || a.rank || 0) - (b.playerRank || b.rank || 0));
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
        } catch (err) {
          console.error("시상식 순위 데이터 로드 실패:", err);
        }
      };
      fetchDbRankings();
    }
  }, [rankingData, gradeId]);

  // 포디움 3인방 및 하위 순위 분리 (실제 참가 인원만 분리)
  const firstPlayer =
    ranks.find((p) => (p.playerRank || p.rank) === 1) ||
    (ranks.length > 0 ? ranks[0] : null) || {
      playerRank: 1,
      playerNumber: "-",
      playerName: "데이터 없음",
      playerGym: "심사 결과 집계 대기",
    };

  const secondPlayer =
    ranks.find((p) => (p.playerRank || p.rank) === 2) ||
    (ranks.length > 1 && ranks[1]?.playerNumber !== firstPlayer?.playerNumber ? ranks[1] : null);

  const thirdPlayer =
    ranks.find((p) => (p.playerRank || p.rank) === 3) ||
    (ranks.length > 2 &&
    ranks[2]?.playerNumber !== firstPlayer?.playerNumber &&
    ranks[2]?.playerNumber !== secondPlayer?.playerNumber
      ? ranks[2]
      : null);

  const otherFinalists =
    ranks.length > 3
      ? ranks.filter(
          (p) =>
            p.playerNumber !== firstPlayer?.playerNumber &&
            p.playerNumber !== secondPlayer?.playerNumber &&
            p.playerNumber !== thirdPlayer?.playerNumber
        )
      : [];

  // 🏷️ 시상식 체급 표기: 통합 단어 및 다중 체급 나열 제거 ➜ 1위 선수 고유 체급명 우선 반영
  const matchedFirst = realPlayersMap[String(firstPlayer.playerNumber).trim()] || realPlayersMap[String(firstPlayer.playerName).trim()];
  const getSingleGradeTitle = (rawGradeTitle, athlete, matched) => {
    if (athlete?.contestGradeTitle) return athlete.contestGradeTitle;
    if (athlete?.gradeTitle) return athlete.gradeTitle;
    if (matched?.contestGradeTitle) return matched.contestGradeTitle;
    if (matched?.gradeTitle) return matched.gradeTitle;
    if (!rawGradeTitle) return "";
    let cleaned = rawGradeTitle.replace(/\s*통합\s*/g, " ").trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      return parts[0];
    }
    return cleaned;
  };

  const cleanGradeTitle = getSingleGradeTitle(gradeTitle, firstPlayer, matchedFirst);

  // 🎬 GSAP 웅장한 포디움 등장 애니메이션
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      // 3위 (있을 때만) -> 2위 -> 1위 순차 등장
      if (podium3Ref.current) {
        tl.fromTo(
          podium3Ref.current,
          { y: 150, opacity: 0, scale: 0.8 },
          { y: 0, opacity: 1, scale: 1, duration: 1 },
          0.2
        );
      }

      if (podium2Ref.current) {
        tl.fromTo(
          podium2Ref.current,
          { y: 150, opacity: 0, scale: 0.8 },
          { y: 0, opacity: 1, scale: 1, duration: 1 },
          0.5
        );
      }

      if (podium1Ref.current) {
        tl.fromTo(
          podium1Ref.current,
          { y: 220, opacity: 0, scale: 0.7, rotateX: 25 },
          { y: 0, opacity: 1, scale: 1, rotateX: 0, duration: 1.3, ease: "elastic.out(1, 0.6)" },
          0.8
        );
      }

      if (bottomRibbonRef.current) {
        tl.fromTo(
          bottomRibbonRef.current,
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8 },
          1.2
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, [firstPlayer, secondPlayer, thirdPlayer]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-transparent text-white flex flex-col justify-between p-6 sm:p-8 select-none"
    >
      {/* 2. 상단 헤더: 공식 시상식 타이틀 */}
      <div className="relative z-10 flex items-center justify-between gap-3 border-b border-amber-500/30 pb-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 text-xl sm:text-2xl shadow-[0_0_25px_rgba(251,191,36,0.6)] shrink-0">
            <TrophyOutlined />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 sm:px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] sm:text-[11px] font-black tracking-widest uppercase font-mono shrink-0">
                OFFICIAL AWARD CEREMONY • 공식 시상식
              </span>
            </div>
            <h1 className="text-base sm:text-xl md:text-2xl font-black text-white m-0 tracking-tight flex items-center gap-2 pt-0.5 truncate">
              <span>{contestTitle || "보디빌딩 & 피트니스 챔피언십"}</span>
              <span className="text-amber-400 font-mono">/</span>
              <span className="text-amber-300 truncate">
                {categoryTitle} {cleanGradeTitle && `• ${cleanGradeTitle}`}
              </span>
            </h1>
          </div>
        </div>

        {onFinishCeremony && (
          <button
            onClick={onFinishCeremony}
            className="shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-bold text-xs cursor-pointer transition-all"
          >
            시상식 완료 & 복귀
          </button>
        )}
      </div>

      {/* 3. 중앙 메인: 🏆 포디움 단상 (인원수에 따라 2인 or 3인 동적 렌더링) */}
      <div className="relative z-10 flex-1 flex items-end justify-center gap-6 sm:gap-8 lg:gap-10 my-auto max-h-[68vh]">
        
        {/* ========================================================================================= */}
        {/* 🥈 [2위 SILVER PODIUM] */}
        {/* ========================================================================================= */}
        {secondPlayer && (
          <div
            ref={podium2Ref}
            className="w-72 sm:w-80 flex flex-col items-center justify-end group transition-all"
          >
            {/* 선수 카드 */}
            <div className="w-full bg-gradient-to-b from-slate-800/90 via-slate-900/90 to-black/95 rounded-3xl border-2 border-slate-300/60 p-4 shadow-[0_10px_35px_rgba(203,213,225,0.2)] flex flex-col items-center text-center space-y-3 relative overflow-hidden backdrop-blur-md">
              
              {/* 2위 뱃지 */}
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 font-black text-xs shadow-md">
                🥈 2위 SILVER
              </div>

              {/* 배부번호 */}
              {secondPlayer?.playerNumber && (
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/60 border border-slate-400/50 font-mono font-black text-xs text-slate-200">
                  NO.{secondPlayer.playerNumber}
                </div>
              )}

              {/* 선수 사진 */}
              <div className="w-32 h-44 rounded-2xl overflow-hidden border-2 border-slate-400/40 bg-slate-950 shadow-inner mt-6 flex items-center justify-center">
                {getPlayerPhoto(secondPlayer) ? (
                  <img
                    src={getPlayerPhoto(secondPlayer)}
                    alt={secondPlayer?.playerName || "2위"}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <TrophyOutlined className="text-4xl text-slate-400" />
                )}
              </div>

              {/* 선수 이름 및 소속 */}
              <div className="space-y-1 w-full">
                <h2 className="text-2xl font-black text-slate-100 tracking-tight truncate">
                  {secondPlayer?.playerName || "2위 선수"}
                </h2>
                <p className="text-xs font-bold text-slate-400 truncate m-0">
                  {secondPlayer?.playerGym || "개인 / 무소속"}
                </p>
              </div>
            </div>

            {/* 2위 단상 받침대 (높이: 중간) */}
            <div className="w-full h-20 bg-gradient-to-b from-slate-600 via-slate-700 to-slate-900 rounded-b-2xl border-t border-slate-400 flex items-center justify-center shadow-2xl">
              <span className="font-mono font-black text-4xl text-slate-200 tracking-widest drop-shadow-md">
                2
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* 🥇 [1위 챔피언 GOLD - CENTER PODIUM (가장 높고 화려함)] */}
        {/* ========================================================================================= */}
        {firstPlayer && (
          <div
            ref={podium1Ref}
            className="w-80 sm:w-96 flex flex-col items-center justify-end -translate-y-4 group transition-all z-20"
          >
            {/* 선수 카드 (골드 특화 디자인) */}
            <div className="w-full bg-gradient-to-b from-amber-950/90 via-slate-950/95 to-black rounded-3xl border-2 border-amber-400 p-5 shadow-[0_0_50px_rgba(251,191,36,0.45)] flex flex-col items-center text-center space-y-3 relative overflow-hidden backdrop-blur-lg">
              
              {/* 왕관 & 1위 골드 뱃지 */}
              <div className="absolute top-3 left-3 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs shadow-lg flex items-center gap-1.5 animate-pulse">
                <CrownOutlined className="text-sm" />
                <span>🥇 1위 WINNER</span>
              </div>

              {/* 배부번호 */}
              {firstPlayer?.playerNumber && (
                <div className="absolute top-3 right-3 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/60 font-mono font-black text-sm text-amber-300 shadow-md">
                  NO.{firstPlayer.playerNumber}
                </div>
              )}

              {/* 1위 선수 사진 (대형) */}
              <div className="w-40 h-52 rounded-2xl overflow-hidden border-2 border-amber-400/80 bg-slate-950 shadow-[0_0_25px_rgba(251,191,36,0.3)] mt-6 flex items-center justify-center relative">
                {getPlayerPhoto(firstPlayer) ? (
                  <img
                    src={getPlayerPhoto(firstPlayer)}
                    alt={firstPlayer?.playerName || "1위"}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <TrophyOutlined className="text-6xl text-amber-400" />
                )}
              </div>

              {/* 선수 이름 및 소속 */}
              <div className="space-y-1 w-full">
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 tracking-tight truncate">
                  {firstPlayer?.playerName || "1위 우승자"}
                </h2>
                <p className="text-sm font-bold text-amber-200/80 truncate m-0">
                  {firstPlayer?.playerGym || "개인 / 무소속"}
                </p>
              </div>
            </div>

            {/* 1위 단상 받침대 (높이: 최고 높음) */}
            <div className="w-full h-32 bg-gradient-to-b from-amber-500 via-amber-600 to-yellow-800 rounded-b-2xl border-t-2 border-yellow-200 flex flex-col items-center justify-center shadow-[0_15px_40px_rgba(251,191,36,0.5)]">
              <span className="font-mono font-black text-6xl text-slate-950 tracking-widest drop-shadow-md">
                1
              </span>
              <span className="text-[10px] font-black text-slate-950/80 tracking-widest uppercase font-mono">
                CHAMPION
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* 🥉 [3위 BRONZE PODIUM - 3명 이상 출전 시에만 렌더링] */}
        {/* ========================================================================================= */}
        {thirdPlayer && (
          <div
            ref={podium3Ref}
            className="w-72 sm:w-80 flex flex-col items-center justify-end group transition-all"
          >
            {/* 선수 카드 */}
            <div className="w-full bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-black/95 rounded-3xl border-2 border-amber-600/60 p-4 shadow-[0_10px_35px_rgba(217,119,6,0.2)] flex flex-col items-center text-center space-y-3 relative overflow-hidden backdrop-blur-md">
              
              {/* 3위 뱃지 */}
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-gradient-to-r from-amber-600 to-amber-800 text-white font-black text-xs shadow-md">
                🥉 3위 BRONZE
              </div>

              {/* 배부번호 */}
              {thirdPlayer?.playerNumber && (
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/60 border border-amber-500/50 font-mono font-black text-xs text-amber-300">
                  NO.{thirdPlayer.playerNumber}
                </div>
              )}

              {/* 선수 사진 */}
              <div className="w-32 h-44 rounded-2xl overflow-hidden border-2 border-amber-600/40 bg-slate-950 shadow-inner mt-6 flex items-center justify-center">
                {getPlayerPhoto(thirdPlayer) ? (
                  <img
                    src={getPlayerPhoto(thirdPlayer)}
                    alt={thirdPlayer?.playerName || "3위"}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <TrophyOutlined className="text-4xl text-amber-500" />
                )}
              </div>

              {/* 선수 이름 및 소속 */}
              <div className="space-y-1 w-full">
                <h2 className="text-2xl font-black text-amber-100 tracking-tight truncate">
                  {thirdPlayer?.playerName || "3위 선수"}
                </h2>
                <p className="text-xs font-bold text-amber-200/60 truncate m-0">
                  {thirdPlayer?.playerGym || "개인 / 무소속"}
                </p>
              </div>
            </div>

            {/* 3위 단상 받침대 (높이: 낮음) */}
            <div className="w-full h-14 bg-gradient-to-b from-amber-800 via-amber-900 to-stone-950 rounded-b-2xl border-t border-amber-600 flex items-center justify-center shadow-xl">
              <span className="font-mono font-black text-3xl text-amber-300 tracking-widest drop-shadow-md">
                3
              </span>
            </div>
          </div>
        )}

      </div>

      {/* 4. 하단 바: 4위, 5위, 6위 파이널리스트 리본 바 */}
      {otherFinalists.length > 0 && (
        <div
          ref={bottomRibbonRef}
          className="relative z-10 bg-slate-950/80 border border-white/15 rounded-2xl p-3 backdrop-blur-md flex items-center justify-center gap-6 shadow-xl"
        >
          <span className="text-xs font-mono font-black text-amber-400 uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 border border-amber-400/30">
            FINALISTS
          </span>
          <div className="flex items-center gap-6 overflow-x-auto">
            {otherFinalists.map((player) => (
              <div
                key={player.playerNumber || player.playerName}
                className="flex items-center gap-2.5 bg-white/5 px-4 py-1.5 rounded-xl border border-white/10"
              >
                <span className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center font-mono font-black text-xs text-slate-300">
                  {player.playerRank || player.rank}위
                </span>
                <span className="font-mono font-black text-amber-300 text-xs">
                  #{player.playerNumber}
                </span>
                <span className="font-black text-sm text-white">{player.playerName}</span>
                <span className="text-xs text-slate-400">{player.playerGym}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AwardCeremonyScene;
