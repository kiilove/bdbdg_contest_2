import React from "react";
import { Slider, Tooltip } from "antd";
import {
  Disc3,
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Mic,
} from "lucide-react";
import { formatSeconds } from "./constants";
import { DualDeckMonitor } from "./DualDeckMonitor";
import { BibTag, StatusDot } from "../../../components/ui/BibTag";

export const AudioPlayerCard = ({
  activeDeck,
  isPlaying,
  currentTrack,
  preCuedTrack,
  deckAVolume,
  deckBVolume,
  currentTabConfig,
  currentTime,
  trackDuration,
  volume = 1,
  handleVolumeChange,
  handleSmoothVolumeChange,
  handleSliderChange,
  handlePlayTrack,
  handlePrevTrack,
  handleNextTrack,
}) => {
  const currentVolumePercent = Math.round((volume ?? 1) * 100);

  const mixingPresets = [
    { val: 0, label: "0", sub: "Mute", desc: "0% (음소거)" },
    { val: 0.1, label: "10", sub: "10%", desc: "10% (미세 배경음)" },
    { val: 0.2, label: "20", sub: "Mic", desc: "20% (사회자 멘트 권장 볼륨)" },
    { val: 0.5, label: "50", sub: "50%", desc: "50% (배경 음악)" },
    { val: 0.8, label: "80", sub: "80%", desc: "80% (표준 경기 음량)" },
    { val: 1.0, label: "100", sub: "Max", desc: "100% (최대 출력)" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-[#19191b] border border-[#ededed]/[0.08] rounded-[12px] p-5 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#ededed]/[0.08]">
          <div className="flex items-center gap-2">
            <Disc3 size={16} strokeWidth={1.5} className="text-[#85858b]" />
            <span className="text-[13px] leading-5 font-medium text-[#ededed]">
              마스터 플레이어
            </span>
          </div>
          <div className="flex items-center gap-2">
            <BibTag prefix="Deck " number={activeDeck} variant="dark" size="sm" />
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#232325] border border-[#ededed]/[0.08] text-xs text-[#a1a1a6]">
              <StatusDot status={isPlaying ? "live" : "idle"} live={isPlaying} />
              <span>{isPlaying ? "재생 중" : "대기"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-[8px] overflow-hidden bg-[#141415] border border-[#ededed]/[0.08] flex items-center justify-center shrink-0">
            {currentTrack?.cover_url ? (
              <img
                src={currentTrack.cover_url}
                alt={currentTrack.title || "Album cover"}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music size={20} strokeWidth={1.5} className="text-[#85858b]" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-[15px] leading-5 font-medium text-[#ededed] m-0 truncate">
              {currentTrack?.title || currentTrack?.name || "선택된 음원 없음"}
            </h3>
            <p className="text-xs text-[#a1a1a6] m-0 truncate">
              {currentTrack?.artist || "우측 목록에서 음원을 선택하세요"}
            </p>
            {(currentTrack?.contest_category_kr ||
              currentTrack?.contest_division_kr) && (
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                {currentTrack?.contest_category_kr && (
                  <span className="text-[11px] leading-4 px-2 py-0.5 rounded-[4px] bg-[#232325] border border-[#ededed]/[0.08] text-[#ededed]">
                    {currentTrack.contest_category_kr}
                  </span>
                )}
                {currentTrack?.contest_division_kr && (
                  <span className="text-[11px] leading-4 px-2 py-0.5 rounded-[4px] bg-[#141415] border border-[#ededed]/[0.08] text-[#a1a1a6]">
                    {currentTrack.contest_division_kr}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="text-[#ededed]">{formatSeconds(currentTime)}</span>
            <span className="text-[#85858b]">
              {formatSeconds(currentTime)} / {formatSeconds(trackDuration)}
            </span>
          </div>
          <Slider
            min={0}
            max={trackDuration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSliderChange}
            tooltip={{ formatter: (v) => formatSeconds(v) }}
            className="m-0"
          />
        </div>

        <div className="flex items-center justify-center gap-3 pt-1">
          <Tooltip title="이전 곡">
            <button
              type="button"
              onClick={handlePrevTrack}
              aria-label="이전 곡"
              className="w-11 h-11 rounded-[8px] bg-[#232325] hover:bg-[#2c2c2f] border border-[#ededed]/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-[#ededed] flex items-center justify-center cursor-pointer transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <SkipBack size={18} strokeWidth={1.5} />
            </button>
          </Tooltip>

          <Tooltip title={isPlaying ? "일시정지 (2.0s 페이드아웃)" : "재생 (2.0s 페이드인)"}>
            <button
              type="button"
              disabled={!currentTrack}
              onClick={() => currentTrack && handlePlayTrack(currentTrack)}
              aria-label={isPlaying ? "일시정지" : "재생"}
              className="h-11 px-6 min-w-[128px] rounded-[8px] bg-[#ededed] hover:bg-white text-[#141415] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-[background-color,transform,opacity] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPlaying ? (
                <>
                  <Pause size={18} strokeWidth={1.5} />
                  <span>일시정지</span>
                </>
              ) : (
                <>
                  <Play size={18} strokeWidth={1.5} />
                  <span>재생</span>
                </>
              )}
            </button>
          </Tooltip>

          <Tooltip title="다음 곡 (크로스페이드)">
            <button
              type="button"
              onClick={handleNextTrack}
              aria-label="다음 곡"
              className="w-11 h-11 rounded-[8px] bg-[#232325] hover:bg-[#2c2c2f] border border-[#ededed]/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-[#ededed] flex items-center justify-center cursor-pointer transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <SkipForward size={18} strokeWidth={1.5} />
            </button>
          </Tooltip>
        </div>

        <div className="pt-4 border-t border-[#ededed]/[0.08] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-[#a1a1a6] font-medium">
              <Mic size={16} strokeWidth={1.5} className="text-[#85858b]" />
              <span>간이 믹싱 (사회자 마이크 연동)</span>
            </span>
            <span className="font-mono tabular-nums text-[#ededed] font-medium">
              {currentVolumePercent}%
            </span>
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {mixingPresets.map((p) => {
              const targetPercent = Math.round(p.val * 100);
              const isActive = Math.abs(currentVolumePercent - targetPercent) <= 3;

              return (
                <Tooltip key={p.label} title={p.desc}>
                  <button
                    type="button"
                    onClick={() => {
                      if (handleSmoothVolumeChange) {
                        handleSmoothVolumeChange(p.val);
                      } else if (handleVolumeChange) {
                        handleVolumeChange(p.val);
                      }
                    }}
                    className={`h-11 rounded-[8px] border flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                      isActive
                        ? "bg-[#2563eb] text-white border-[#2563eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                        : "bg-[#232325] hover:bg-[#2c2c2f] text-[#ededed] border-[#ededed]/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    }`}
                  >
                    <span className="font-mono tabular-nums text-xs font-medium leading-none">
                      {p.label}
                    </span>
                    <span
                      className={`text-[10px] font-mono leading-none ${
                        isActive ? "text-white/80" : "text-[#85858b]"
                      }`}
                    >
                      {p.sub}
                    </span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-[#19191b] border border-[#ededed]/[0.08] rounded-[12px] p-5">
        <DualDeckMonitor
          activeDeck={activeDeck}
          isPlaying={isPlaying}
          currentTrack={currentTrack}
          preCuedTrack={preCuedTrack}
          deckAVolume={deckAVolume}
          deckBVolume={deckBVolume}
          currentTabConfig={currentTabConfig}
        />
      </div>
    </div>
  );
};
