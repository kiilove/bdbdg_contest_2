import React from "react";
import { Tag } from "antd";

export const DualDeckMonitor = ({
  activeDeck,
  isPlaying,
  currentTrack,
  preCuedTrack,
  deckAVolume,
  deckBVolume,
  currentTabConfig,
}) => {
  return (
    <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
          <span>🎛️ 듀얼 재생 데크 모니터</span>
        </span>
        <Tag
          color={currentTabConfig.fadeDuration === 0 ? "magenta" : "cyan"}
          className="font-bold text-[10px] m-0"
        >
          {currentTabConfig.fadeDuration.toFixed(1)}s{" "}
          {currentTabConfig.fadeDuration === 0 ? "즉시 재생" : "오버랩 페이드"}
        </Tag>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
        {/* Audio Deck A */}
        <div
          className={`p-3 rounded-2xl border transition-all flex flex-col justify-between ${
            activeDeck === "A"
              ? "bg-indigo-50/90 border-indigo-300 text-indigo-700 shadow-sm"
              : preCuedTrack
              ? "bg-amber-50/80 border-amber-300 text-amber-800"
              : "bg-slate-50 border-slate-200 text-slate-400"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider font-black opacity-80">
                Deck A
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-700">
                {deckAVolume}%
              </span>
            </div>
            <div className="text-xs mt-1.5 text-left">
              {activeDeck === "A" ? (
                <div>
                  <span className="font-black text-indigo-700 block">
                    {isPlaying ? "🔊 재생중" : "⏸️ 일시정지"}
                  </span>
                  {currentTrack && (
                    <span
                      className="text-[11px] text-slate-800 block truncate font-bold mt-0.5"
                      title={currentTrack.title || currentTrack.name}
                    >
                      {currentTrack.title || currentTrack.name}
                    </span>
                  )}
                </div>
              ) : preCuedTrack ? (
                <div>
                  <span className="text-[10px] text-amber-700 font-bold animate-pulse block">
                    ⏳{" "}
                    {preCuedTrack.title === currentTrack?.title
                      ? "연속 반복 대기"
                      : "다음 곡 스탠바이"}
                  </span>
                  <span
                    className="text-[11px] text-slate-700 block truncate font-semibold mt-0.5"
                    title={preCuedTrack.title || preCuedTrack.name}
                  >
                    {preCuedTrack.title || preCuedTrack.name}
                  </span>
                </div>
              ) : !currentTabConfig.autoNext ? (
                <span className="text-slate-400 block py-1 font-medium">
                  단발 재생 (다음 곡 없음)
                </span>
              ) : (
                <span className="text-slate-400 block py-1">대기 (유휴 0%)</span>
              )}
            </div>
          </div>

          {/* 데크 A 실시간 볼륨 게이지 */}
          <div className="w-full bg-slate-200/90 h-2 rounded-full overflow-hidden mt-2.5">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-150"
              style={{ width: `${deckAVolume}%` }}
            />
          </div>
        </div>

        {/* Audio Deck B */}
        <div
          className={`p-3 rounded-2xl border transition-all flex flex-col justify-between ${
            activeDeck === "B"
              ? "bg-purple-50/90 border-purple-300 text-purple-700 shadow-sm"
              : preCuedTrack
              ? "bg-amber-50/80 border-amber-300 text-amber-800"
              : "bg-slate-50 border-slate-200 text-slate-400"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider font-black opacity-80">
                Deck B
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-700">
                {deckBVolume}%
              </span>
            </div>
            <div className="text-xs mt-1.5 text-left">
              {activeDeck === "B" ? (
                <div>
                  <span className="font-black text-purple-700 block">
                    {isPlaying ? "🔊 재생중" : "⏸️ 일시정지"}
                  </span>
                  {currentTrack && (
                    <span
                      className="text-[11px] text-slate-800 block truncate font-bold mt-0.5"
                      title={currentTrack.title || currentTrack.name}
                    >
                      {currentTrack.title || currentTrack.name}
                    </span>
                  )}
                </div>
              ) : preCuedTrack ? (
                <div>
                  <span className="text-[10px] text-amber-700 font-bold animate-pulse block">
                    ⏳{" "}
                    {preCuedTrack.title === currentTrack?.title
                      ? "연속 반복 대기"
                      : "다음 곡 스탠바이"}
                  </span>
                  <span
                    className="text-[11px] text-slate-700 block truncate font-semibold mt-0.5"
                    title={preCuedTrack.title || preCuedTrack.name}
                  >
                    {preCuedTrack.title || preCuedTrack.name}
                  </span>
                </div>
              ) : !currentTabConfig.autoNext ? (
                <span className="text-slate-400 block py-1 font-medium">
                  단발 재생 (다음 곡 없음)
                </span>
              ) : (
                <span className="text-slate-400 block py-1">대기 (유휴 0%)</span>
              )}
            </div>
          </div>

          {/* 데크 B 실시간 볼륨 게이지 */}
          <div className="w-full bg-slate-200/90 h-2 rounded-full overflow-hidden mt-2.5">
            <div
              className="bg-purple-600 h-full rounded-full transition-all duration-150"
              style={{ width: `${deckBVolume}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
