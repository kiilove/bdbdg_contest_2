import React from "react";
import { UserOutlined, EnvironmentOutlined, DashboardOutlined } from "@ant-design/icons";

const AthleteIntroOverlay = ({ player }) => {
  if (!player || !player.playerNumber) return null;

  const {
    playerNumber,
    playerName,
    playerGym,
    heightWeight,
    categoryTitle,
    gradeTitle,
  } = player;

  return (
    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 w-full max-w-5xl px-6 pointer-events-none animate-slide-up select-none">
      <div className="relative overflow-hidden rounded-3xl bg-slate-900/90 backdrop-blur-2xl border-2 border-amber-400/40 shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-6 text-white flex items-center justify-between gap-6">
        {/* 🌟 황금빛 하이라이트 라인 */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />

        {/* 1. 대형 선수 번호판 */}
        <div className="flex items-center gap-6">
          <div className="relative flex flex-col items-center justify-center w-28 h-28 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-xl shadow-amber-500/30 border border-amber-300">
            <span className="text-[11px] font-black tracking-widest uppercase opacity-80">
              ENTRY NO
            </span>
            <span className="text-5xl font-black font-mono tracking-tighter leading-none">
              {playerNumber}
            </span>
          </div>

          {/* 2. 선수 성명 및 소속 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="px-3 py-0.5 rounded-full text-xs font-black bg-blue-600/80 text-white border border-blue-400/40">
                무대 입장 선수
              </span>
              {(categoryTitle || gradeTitle) && (
                <span className="text-xs font-bold text-slate-400">
                  {categoryTitle} {gradeTitle && `• ${gradeTitle}`}
                </span>
              )}
            </div>

            <h2 className="text-4xl lg:text-5xl font-black text-white m-0 tracking-tight drop-shadow-md">
              {playerName}
            </h2>

            <div className="flex items-center gap-2 text-base text-slate-300 font-bold">
              <EnvironmentOutlined className="text-amber-400" />
              <span>{playerGym || "무소속 / 개인 출전"}</span>
            </div>
          </div>
        </div>

        {/* 3. 신장 / 체중 계측 정보 (있을 경우) */}
        {heightWeight && (
          <div className="hidden sm:flex flex-col items-end justify-center bg-white/5 border border-white/10 px-5 py-3 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
              <DashboardOutlined className="text-amber-400" />
              <span>OFFICIAL STATS</span>
            </div>
            <div className="text-xl font-black text-amber-400 font-mono tracking-wide">
              {heightWeight}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AthleteIntroOverlay;
