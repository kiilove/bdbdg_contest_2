import React from "react";
import { BibTag, StatusDot } from "../../../components/ui/BibTag";

export const DualDeckMonitor = ({
  activeDeck,
  isPlaying,
  currentTrack,
  preCuedTrack,
  deckAVolume,
  deckBVolume,
  currentTabConfig,
}) => {
  const renderDeckChannel = (deckId, deckVolume) => {
    const isActive = activeDeck === deckId;
    const isPreCued = !isActive && Boolean(preCuedTrack);
    const clampedRatio = Math.max(0, Math.min(1, (deckVolume || 0) / 100));

    return (
      <div
        key={deckId}
        className={`p-3 rounded-[8px] border flex flex-col justify-between transition-[background-color,border-color] duration-150 ${
          isActive
            ? "bg-[#232325] border-[#2563eb]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            : isPreCued
            ? "bg-[#141415] border-[#2563eb]/35"
            : "bg-[#141415] border-[#ededed]/[0.08]"
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BibTag
                prefix="Deck "
                number={deckId}
                variant={isActive ? "active" : "dark"}
                size="sm"
              />
              {isActive && isPlaying && <StatusDot status="live" live />}
            </div>
            <span className="text-xs font-mono tabular-nums text-[#a1a1a6]">
              {deckVolume}%
            </span>
          </div>

          <div className="mt-2.5 text-left min-h-[36px]">
            {isActive ? (
              <div>
                <span className="text-xs font-medium text-[#ededed] block">
                  {isPlaying ? "출력 중" : "일시정지"}
                </span>
                {currentTrack && (
                  <span
                    className="text-xs text-[#a1a1a6] block truncate mt-0.5"
                    title={currentTrack.title || currentTrack.name}
                  >
                    {currentTrack.title || currentTrack.name}
                  </span>
                )}
              </div>
            ) : isPreCued ? (
              <div>
                <span className="text-xs font-medium text-[#60a5fa] block">
                  {preCuedTrack.title === currentTrack?.title
                    ? "반복 재생 대기"
                    : "다음 곡 스탠바이"}
                </span>
                <span
                  className="text-xs text-[#a1a1a6] block truncate mt-0.5"
                  title={preCuedTrack.title || preCuedTrack.name}
                >
                  {preCuedTrack.title || preCuedTrack.name}
                </span>
              </div>
            ) : !currentTabConfig.autoNext ? (
              <span className="text-xs text-[#85858b] block py-1">
                단발 재생 모드
              </span>
            ) : (
              <span className="text-xs text-[#85858b] block py-1">
                대기 유휴
              </span>
            )}
          </div>
        </div>

        <div className="w-full bg-[#0f0f10] h-1.5 rounded-[4px] overflow-hidden mt-3 border border-[#ededed]/[0.06]">
          <div
            className={`w-full h-full origin-left transition-transform duration-150 ${
              isActive && isPlaying
                ? "bg-[#4cc38a]"
                : isActive
                ? "bg-[#2563eb]"
                : "bg-[#85858b]"
            }`}
            style={{ transform: `scaleX(${clampedRatio})` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] leading-5 font-medium text-[#ededed]">
          듀얼 데크 모니터
        </span>
        <span className="text-xs font-mono tabular-nums text-[#a1a1a6] px-2 py-0.5 rounded-[4px] bg-[#232325] border border-[#ededed]/[0.08]">
          {currentTabConfig.fadeDuration.toFixed(1)}s{" "}
          {currentTabConfig.fadeDuration === 0 ? "즉시 전환" : "크로스페이드"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {renderDeckChannel("A", deckAVolume)}
        {renderDeckChannel("B", deckBVolume)}
      </div>
    </div>
  );
};
