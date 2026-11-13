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
  Loader2,
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
  audioTransition = null,
  handleVolumeChange,
  handleSmoothVolumeChange,
  handleSliderChange,
  handlePlayTrack,
  handlePrevTrack,
  handleNextTrack,
}) => {
  const currentVolumePercent = Math.round((volume ?? 1) * 100);

  const phase = audioTransition?.phase || null;
  const progress = Math.max(
    0,
    Math.min(100, Math.round(audioTransition?.progress || 0))
  );
  const durationSec = ((audioTransition?.durationMs || 0) / 1000).toFixed(1);
  const remainingSec = Math.max(
    0,
    ((100 - progress) / 100) * ((audioTransition?.durationMs || 0) / 1000)
  ).toFixed(1);
  const targetTitle =
    audioTransition?.targetTrack?.title ||
    audioTransition?.targetTrack?.name ||
    "";

  const isSkipBlocked = phase === "loading" || phase === "fading-out";
  const isToggleBlocked =
    (!currentTrack && !audioTransition?.targetTrack) ||
    phase === "loading" ||
    phase === "fading-out";

  const isPrevTriggering =
    audioTransition?.source === "prev" &&
    (phase === "loading" || phase === "crossfading" || phase === "fading-in");
  const isNextTriggering =
    (audioTransition?.source === "next" ||
      audioTransition?.source === "autopilot") &&
    (phase === "loading" || phase === "crossfading" || phase === "fading-in");

  const displayTrack =
    !currentTrack && audioTransition?.targetTrack
      ? audioTransition.targetTrack
      : currentTrack;

  const mixingPresets = [
    { val: 0, label: "0", sub: "Mute", desc: "0% (음소거)" },
    { val: 0.1, label: "10", sub: "10%", desc: "10% (미세 배경음)" },
    { val: 0.2, label: "20", sub: "Mic", desc: "20% (사회자 멘트 권장 볼륨)" },
    { val: 0.5, label: "50", sub: "50%", desc: "50% (배경 음악)" },
    { val: 0.8, label: "80", sub: "80%", desc: "80% (표준 경기 음량)" },
    { val: 1.0, label: "100", sub: "Max", desc: "100% (최대 출력)" },
  ];

  const renderTopStatusBadge = () => {
    if (phase === "loading") {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#2563eb]/20 border border-[#2563eb]/45 text-xs font-medium text-[#60a5fa]">
          <Loader2 size={12} strokeWidth={2} className="animate-spin" />
          <span>음원 수신 중</span>
        </div>
      );
    }
    if (phase === "crossfading") {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#2563eb]/20 border border-[#2563eb]/45 text-xs font-mono tabular-nums font-medium text-[#60a5fa]">
          <Loader2 size={12} strokeWidth={2} className="animate-spin" />
          <span>교차 전환 {progress}%</span>
        </div>
      );
    }
    if (phase === "fading-in") {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#2563eb]/20 border border-[#2563eb]/45 text-xs font-mono tabular-nums font-medium text-[#60a5fa]">
          <Loader2 size={12} strokeWidth={2} className="animate-spin" />
          <span>페이드인 {progress}%</span>
        </div>
      );
    }
    if (phase === "fading-out") {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#d97706]/20 border border-[#d97706]/45 text-xs font-mono tabular-nums font-medium text-[#fbbf24]">
          <Loader2 size={12} strokeWidth={2} className="animate-spin" />
          <span>감쇄 정지 {progress}%</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#232325] border border-[#ededed]/[0.08] text-xs text-[#a1a1a6]">
        <StatusDot status={isPlaying ? "live" : "idle"} live={isPlaying} />
        <span>{isPlaying ? "재생 중" : "대기"}</span>
      </div>
    );
  };

  const renderTransitionBanner = () => {
    if (!phase) return null;

    const isStopping = phase === "fading-out";
    let headline = "";
    let detail = "";

    if (phase === "loading") {
      headline = "음원 다운로드 · 버퍼링 준비 중";
      detail = targetTitle
        ? `수신 완료 즉시 부드럽게 재생됩니다 · ${targetTitle}`
        : "클라우드 음원을 데크로 불러오는 중입니다";
    } else if (phase === "crossfading") {
      headline = `듀얼 데크 크로스페이드 전환 중 (${durationSec}s)`;
      detail = targetTitle
        ? `Deck ${audioTransition?.fromDeck || "-"} 감쇄 → Deck ${
            audioTransition?.targetDeck || activeDeck
          } 볼륨 상승 · ${targetTitle}`
        : `이전 곡에서 다음 곡으로 교차 전환 중`;
    } else if (phase === "fading-in") {
      headline = `페이드인 볼륨 상승 중 (${durationSec}s)`;
      detail = targetTitle
        ? `0%에서 목표 볼륨까지 부드럽게 진입 중 · ${targetTitle}`
        : "목표 볼륨까지 부드럽게 음량을 올리는 중";
    } else if (phase === "fading-out") {
      headline = `페이드아웃 안전 정지 중 (${durationSec}s)`;
      detail = targetTitle
        ? `음량을 자연스럽게 줄인 뒤 일시정지합니다 · ${targetTitle}`
        : "음량을 자연스럽게 감쇄하는 중";
    }

    return (
      <div
        role="status"
        aria-live="polite"
        className={`rounded-[8px] px-3 py-2.5 border space-y-2 transition-colors duration-150 ${
          isStopping
            ? "bg-[#d97706]/[0.10] border-[#d97706]/40"
            : "bg-[#2563eb]/[0.12] border-[#2563eb]/45"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2
              size={14}
              strokeWidth={2}
              className={`animate-spin shrink-0 ${
                isStopping ? "text-[#fbbf24]" : "text-[#60a5fa]"
              }`}
            />
            <span
              className={`text-xs font-medium truncate ${
                isStopping ? "text-[#fde68a]" : "text-[#ededed]"
              }`}
            >
              {headline}
            </span>
          </div>
          <span
            className={`text-[11px] font-mono tabular-nums shrink-0 ${
              isStopping ? "text-[#fbbf24]" : "text-[#93c5fd]"
            }`}
          >
            {phase === "loading"
              ? `Deck ${audioTransition?.targetDeck || activeDeck}`
              : `${progress}% · -${remainingSec}s`}
          </span>
        </div>

        <p className="text-[11px] leading-4 text-[#a1a1a6] m-0 truncate">
          {detail}
        </p>

        <div className="w-full h-1.5 rounded-[4px] bg-[#0f0f10] overflow-hidden border border-[#ededed]/[0.06]">
          {phase === "loading" ? (
            <div className="h-full w-2/5 rounded-[4px] bg-[#3b82f6] animate-pulse" />
          ) : (
            <div
              className={`h-full w-full origin-left transition-transform duration-100 ${
                isStopping ? "bg-[#d97706]" : "bg-[#2563eb]"
              }`}
              style={{
                transform: `scaleX(${Math.max(0.03, progress / 100)})`,
              }}
            />
          )}
        </div>
      </div>
    );
  };

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
            {renderTopStatusBadge()}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-[8px] overflow-hidden bg-[#141415] border border-[#ededed]/[0.08] flex items-center justify-center shrink-0 relative">
            {displayTrack?.cover_url ? (
              <img
                src={displayTrack.cover_url}
                alt={displayTrack.title || "Album cover"}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music size={20} strokeWidth={1.5} className="text-[#85858b]" />
            )}
            {phase === "loading" && (
              <div className="absolute inset-0 bg-[#141415]/75 flex items-center justify-center">
                <Loader2
                  size={20}
                  strokeWidth={2}
                  className="animate-spin text-[#60a5fa]"
                />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-[15px] leading-5 font-medium text-[#ededed] m-0 truncate">
              {displayTrack?.title || displayTrack?.name || "선택된 음원 없음"}
            </h3>
            <p className="text-xs text-[#a1a1a6] m-0 truncate">
              {displayTrack?.artist || "우측 목록에서 음원을 선택하세요"}
            </p>
            {(displayTrack?.contest_category_kr ||
              displayTrack?.contest_division_kr) && (
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                {displayTrack?.contest_category_kr && (
                  <span className="text-[11px] leading-4 px-2 py-0.5 rounded-[4px] bg-[#232325] border border-[#ededed]/[0.08] text-[#ededed]">
                    {displayTrack.contest_category_kr}
                  </span>
                )}
                {displayTrack?.contest_division_kr && (
                  <span className="text-[11px] leading-4 px-2 py-0.5 rounded-[4px] bg-[#141415] border border-[#ededed]/[0.08] text-[#a1a1a6]">
                    {displayTrack.contest_division_kr}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {renderTransitionBanner()}

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
          <Tooltip
            title={
              isSkipBlocked
                ? "음원 전환 처리 중입니다 (중복 클릭 방지)"
                : "이전 곡"
            }
          >
            <button
              type="button"
              disabled={isSkipBlocked}
              onClick={handlePrevTrack}
              aria-label="이전 곡"
              className={`w-11 h-11 rounded-[8px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-center cursor-pointer transition-[background-color,border-color,transform,opacity] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-45 disabled:cursor-not-allowed ${
                isPrevTriggering
                  ? "bg-[#2563eb]/20 border-[#2563eb]/60 text-[#60a5fa]"
                  : "bg-[#232325] hover:bg-[#2c2c2f] border-[#ededed]/[0.08] text-[#ededed]"
              }`}
            >
              {phase === "loading" && audioTransition?.source === "prev" ? (
                <Loader2 size={18} strokeWidth={1.75} className="animate-spin" />
              ) : (
                <SkipBack size={18} strokeWidth={1.5} />
              )}
            </button>
          </Tooltip>

          <Tooltip
            title={
              phase === "loading"
                ? "음원 다운로드 · 버퍼링 중입니다"
                : phase === "fading-out"
                ? "페이드아웃 정지 진행 중입니다"
                : isPlaying
                ? "일시정지 (2.0s 페이드아웃)"
                : "재생 (2.0s 페이드인)"
            }
          >
            <button
              type="button"
              disabled={isToggleBlocked}
              onClick={() =>
                currentTrack && handlePlayTrack(currentTrack, "player")
              }
              aria-label={isPlaying ? "일시정지" : "재생"}
              className={`h-11 px-5 min-w-[152px] rounded-[8px] text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-[background-color,border-color,color,transform,opacity] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed ${
                phase === "loading"
                  ? "bg-[#2563eb] text-white border border-[#3b82f6] opacity-95"
                  : phase === "fading-out"
                  ? "bg-[#232325] text-[#fbbf24] border border-[#d97706]/55 opacity-95"
                  : phase === "crossfading" || phase === "fading-in"
                  ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white border border-[#3b82f6] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                  : "bg-[#ededed] hover:bg-white text-[#141415] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] disabled:opacity-40"
              }`}
            >
              {phase === "loading" ? (
                <>
                  <Loader2 size={17} strokeWidth={2} className="animate-spin" />
                  <span>음원 준비 중...</span>
                </>
              ) : phase === "fading-out" ? (
                <>
                  <Loader2 size={17} strokeWidth={2} className="animate-spin" />
                  <span className="font-mono tabular-nums">
                    정지 중 {progress}%
                  </span>
                </>
              ) : phase === "crossfading" ? (
                <>
                  <Loader2 size={17} strokeWidth={2} className="animate-spin" />
                  <span className="font-mono tabular-nums">
                    전환 중 {progress}%
                  </span>
                </>
              ) : phase === "fading-in" ? (
                <>
                  <Loader2 size={17} strokeWidth={2} className="animate-spin" />
                  <span className="font-mono tabular-nums">
                    페이드인 {progress}%
                  </span>
                </>
              ) : isPlaying ? (
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

          <Tooltip
            title={
              isSkipBlocked
                ? "음원 전환 처리 중입니다 (중복 클릭 방지)"
                : "다음 곡 (크로스페이드)"
            }
          >
            <button
              type="button"
              disabled={isSkipBlocked}
              onClick={handleNextTrack}
              aria-label="다음 곡"
              className={`w-11 h-11 rounded-[8px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-center cursor-pointer transition-[background-color,border-color,transform,opacity] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-45 disabled:cursor-not-allowed ${
                isNextTriggering
                  ? "bg-[#2563eb]/20 border-[#2563eb]/60 text-[#60a5fa]"
                  : "bg-[#232325] hover:bg-[#2c2c2f] border-[#ededed]/[0.08] text-[#ededed]"
              }`}
            >
              {phase === "loading" &&
              (audioTransition?.source === "next" ||
                audioTransition?.source === "autopilot") ? (
                <Loader2 size={18} strokeWidth={1.75} className="animate-spin" />
              ) : (
                <SkipForward size={18} strokeWidth={1.5} />
              )}
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
          audioTransition={audioTransition}
        />
      </div>
    </div>
  );
};
