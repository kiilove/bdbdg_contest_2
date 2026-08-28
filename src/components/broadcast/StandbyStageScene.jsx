"use client";

import React from "react";
import { UserOutlined, FireOutlined } from "@ant-design/icons";
import { THEME_CONFIGS } from "./AthleteIntroScene";
import "./AthleteIntroScene.css";

// 기본 협찬사 데모 목록
const DEFAULT_SPONSORS = [
  { name: "(주)인바디", slogan: "체성분 분석 공식 파트너", tag: "DIAMOND" },
  { name: "MONSTER ENERGY", slogan: "공식 에너지 드링크 파트너", tag: "OFFICIAL" },
  { name: "HDEX (에이치덱스)", slogan: "공식 스포츠웨어 파트너", tag: "PLATINUM" },
  { name: "골드짐 코리아", slogan: "공식 피트니스 센터 파트너", tag: "GOLD" },
  { name: "마이프로틴", slogan: "공식 뉴트리션 파트너", tag: "OFFICIAL" },
  { name: "대한보디빌딩협회", slogan: "공식 경기 주관 협회", tag: "OFFICIAL" },
];

const StandbyStageScene = ({
  contestTitle,
  stageInfo,
  sponsors = [],
  backgroundVideoUrl,
  colorTheme = "GOLD",
}) => {
  const theme = THEME_CONFIGS[colorTheme] || THEME_CONFIGS.GOLD;

  const isStageActive = stageInfo && (stageInfo.categoryTitle || stageInfo.gradeTitle);

  // 스폰서 기본 목록 (최소 6개 이상이 되도록 반복 구성)
  const rawList = sponsors && sponsors.length > 0 ? sponsors : DEFAULT_SPONSORS;
  const singleTrackList = rawList.length >= 6 ? rawList : [...rawList, ...rawList, ...rawList];

  return (
    <div className="relative w-screen h-screen bg-transparent text-white flex flex-col justify-between p-6 sm:p-8 lg:p-10 overflow-hidden select-none">
      {/* ======================= [ Layer 3: 상단 대회 헤더 ] ======================= */}
      <div className="relative z-20 flex items-center justify-between gap-4 border-b border-white/15 pb-3 sm:pb-4">
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] sm:text-xs font-black tracking-widest ${theme.primary} uppercase flex items-center gap-1.5 mb-0.5`}>
            <FireOutlined className="animate-pulse" />
            <span>OFFICIAL STAGE BROADCAST</span>
          </div>
          <h1
            className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black text-white m-0 tracking-tight break-keep leading-tight"
            style={{
              textShadow:
                "0 2px 14px rgba(0,0,0,0.95), 0 0 24px rgba(0,0,0,0.85), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
            }}
          >
            {contestTitle}
          </h1>
        </div>
      </div>

      {/* ======================= [ Layer 4: 중앙 무대 경기 안내 ] ======================= */}
      <div className="relative z-10 my-auto text-center flex flex-col items-center justify-center py-2 sm:py-4 px-2">
        {isStageActive ? (
          /* 🏁 종목 진행 중 화면 */
          <div className="space-y-4 sm:space-y-6 max-w-5xl animate-fade-in w-full px-4 py-6 rounded-3xl bg-black/25 backdrop-blur-[2px]">
            <div className={`inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full ${theme.badgeBg} border bg-black/85 font-black text-xs sm:text-sm lg:text-base tracking-widest uppercase shadow-2xl`}>
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span>NOW ON STAGE • 무대 심사진행</span>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <h2
                className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight break-keep leading-tight m-0"
                style={{
                  textShadow:
                    "0 0 24px rgba(0,0,0,0.95), 0 4px 12px rgba(0,0,0,1), 0 12px 36px rgba(0,0,0,0.9), -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 4px 0 #000",
                }}
              >
                {stageInfo.categoryTitle}
              </h2>
              {stageInfo.gradeTitle && (
                <div
                  className={`text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black ${theme.primary} tracking-wide break-keep leading-tight`}
                  style={{
                    textShadow:
                      "0 0 24px rgba(0,0,0,0.95), 0 4px 12px rgba(0,0,0,1), 0 10px 30px rgba(0,0,0,0.9), -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 0 #000",
                  }}
                >
                  {stageInfo.gradeTitle}
                </div>
              )}
            </div>

            {/* 출전 선수 수 뱃지 */}
            {Boolean(stageInfo.playerCount) && (
              <div className="flex items-center justify-center pt-1">
                <div className="flex items-center gap-2.5 sm:gap-3 bg-black/90 px-4 sm:px-6 py-1.5 sm:py-2.5 rounded-2xl border border-white/20 shadow-2xl">
                  <UserOutlined className={`${theme.primary} text-base sm:text-lg`} />
                  <span className="text-[11px] sm:text-xs text-slate-300 font-bold uppercase">출전 선수</span>
                  <span className="text-base sm:text-xl font-black text-white font-mono">{stageInfo.playerCount}명</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ⏳ 경기 준비 및 대기 화면 */
          <div className="space-y-4 sm:space-y-6 max-w-4xl animate-fade-in w-full px-4 py-6 rounded-3xl bg-black/25 backdrop-blur-[2px]">
            <div className={`inline-flex items-center gap-2 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full ${theme.badgeBg} border font-black text-xs sm:text-sm tracking-widest uppercase bg-black/85 shadow-2xl`}>
              Standby & Preparation
            </div>
            <h2
              className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-tight break-keep"
              style={{
                textShadow:
                  "0 0 24px rgba(0,0,0,0.95), 0 4px 12px rgba(0,0,0,1), 0 12px 36px rgba(0,0,0,0.9), -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000",
              }}
            >
              잠시 후 다음 경기가
              <br />
              <span className={`text-transparent bg-clip-text bg-gradient-to-r ${theme.textGradient}`}>
                시작됩니다
              </span>
            </h2>
            <p
              className="text-base sm:text-xl text-slate-200 font-bold max-w-2xl mx-auto break-keep"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8)" }}
            >
              출전 선수 여러분께서는 무대 대기실에서 준비하여 주시기 바랍니다.
            </p>
          </div>
        )}
      </div>

      {/* ======================= [ Layer 5: 하단 대형 협찬사 로고 끊김 없는 무한 롤링 마키 ] ======================= */}
      <div className="relative z-20 border-t border-white/15 pt-3">
        
        {/* 마키 헤더 캡션 */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2 px-1">
          <span className={`uppercase tracking-widest ${theme.primary} flex items-center gap-1.5 font-black`}>
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            <span>OFFICIAL SPONSORS & PARTNERS</span>
          </span>
          <span className="text-slate-300 font-bold">{contestTitle || "대회"} 공식 협찬사</span>
        </div>

        {/* 🌟 2개 트랙 완벽 Seamless 무한 롤링 컨테이너 (4K GPU 가속) */}
        <div className="marquee-container bg-black/85 rounded-2xl border border-white/15 py-3.5 relative overflow-hidden">
          
          {/* 좌우 부드러운 페이드아웃 그라디언트 마스크 */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black via-black/80 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black via-black/80 to-transparent z-10 pointer-events-none" />

          {/* 🌟 트랙 1 (Track A) */}
          <div className="marquee-track">
            {singleTrackList.map((sp, idx) => (
              <div
                key={`t1-${idx}`}
                className="flex items-center gap-4 px-7 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 shadow-xl shrink-0 transition-all"
              >
                {/* 🖼️ 대형 스폰서 로고 */}
                {sp.logoUrl || sp.imageUrl ? (
                  <img
                    src={sp.logoUrl || sp.imageUrl}
                    alt={sp.name}
                    className="h-12 sm:h-14 lg:h-16 max-w-[200px] object-contain filter brightness-110 drop-shadow-md"
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-xl bg-slate-900 border border-white/20 flex items-center justify-center font-mono font-black text-lg ${theme.primary} shadow-md`}>
                    {sp.tag ? sp.tag.slice(0, 1) : "P"}
                  </div>
                )}

                {/* 📝 큼직한 스폰서 텍스트 */}
                <div className="text-left min-w-0 pr-2">
                  <div className="text-lg lg:text-xl font-black text-white tracking-wide break-keep whitespace-nowrap drop-shadow-sm">
                    {sp.name}
                  </div>
                  {sp.slogan && (
                    <div className="text-xs lg:text-sm text-slate-300 font-semibold truncate max-w-[240px]">
                      {sp.slogan}
                    </div>
                  )}
                </div>

                {/* 🏷️ 등급 뱃지 */}
                {sp.tag && (
                  <span className={`text-[10px] font-mono font-black px-2.5 py-1 rounded-lg bg-white/10 ${theme.primary} border border-white/20 uppercase shadow-sm`}>
                    {sp.tag}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* 🌟 트랙 2 (Track B - 트랙 1 바로 뒤에 0.001초 빈틈없이 연결) */}
          <div className="marquee-track" aria-hidden="true">
            {singleTrackList.map((sp, idx) => (
              <div
                key={`t2-${idx}`}
                className="flex items-center gap-4 px-7 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 shadow-xl shrink-0 transition-all"
              >
                {/* 🖼️ 대형 스폰서 로고 */}
                {sp.logoUrl || sp.imageUrl ? (
                  <img
                    src={sp.logoUrl || sp.imageUrl}
                    alt={sp.name}
                    className="h-12 sm:h-14 lg:h-16 max-w-[200px] object-contain filter brightness-110 drop-shadow-md"
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-xl bg-slate-900 border border-white/20 flex items-center justify-center font-mono font-black text-lg ${theme.primary} shadow-md`}>
                    {sp.tag ? sp.tag.slice(0, 1) : "P"}
                  </div>
                )}

                {/* 📝 큼직한 스폰서 텍스트 */}
                <div className="text-left min-w-0 pr-2">
                  <div className="text-lg lg:text-xl font-black text-white tracking-wide break-keep whitespace-nowrap drop-shadow-sm">
                    {sp.name}
                  </div>
                  {sp.slogan && (
                    <div className="text-xs lg:text-sm text-slate-300 font-semibold truncate max-w-[240px]">
                      {sp.slogan}
                    </div>
                  )}
                </div>

                {/* 🏷️ 등급 뱃지 */}
                {sp.tag && (
                  <span className={`text-[10px] font-mono font-black px-2.5 py-1 rounded-lg bg-white/10 ${theme.primary} border border-white/20 uppercase shadow-sm`}>
                    {sp.tag}
                  </span>
                )}
              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
};

export default StandbyStageScene;
