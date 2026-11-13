import React from "react";
import { Switch, Tooltip } from "antd";
import { Activity, Play, Pause, SkipForward, Info } from "lucide-react";
import { extractGender } from "./constants";
import { StatusDot } from "../../../components/ui/BibTag";

export const AutopilotCard = ({
  isAutoPlayOnStageChange,
  setIsAutoPlayOnStageChange,
  currentStageCategory,
  currentStageGrade,
  currentStageGender,
  seed1Pool,
  seed2Pool,
  playedTrackIds,
  activeSeedLevel,
  currentTrack,
  isPlaying,
  handlePlayTrack,
  playNextSeedTrack,
  onOpenGuideModal,
}) => {
  const genderType = extractGender(currentStageCategory, currentStageGender);
  const genderPrefix =
    genderType === "FEMALE"
      ? "여성 · "
      : genderType === "MALE"
      ? "남성 · "
      : "";

  return (
    <div className="bg-[#19191b] border border-[#ededed]/[0.08] rounded-[12px] p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#ededed]/[0.08]">
        <div className="flex items-center gap-2">
          <Activity size={16} strokeWidth={1.5} className="text-[#85858b]" />
          <span className="text-[13px] leading-5 font-medium text-[#ededed]">
            스마트 오토파일럿
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#85858b]">
            {isAutoPlayOnStageChange ? "자동" : "수동"}
          </span>
          <Switch
            checked={isAutoPlayOnStageChange}
            onChange={setIsAutoPlayOnStageChange}
            size="small"
          />
        </div>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#85858b] shrink-0">대상 무대</span>
          <span className="font-medium text-[#ededed] truncate text-right">
            {currentStageCategory ? (
              <>
                {genderPrefix}
                {currentStageCategory}
                {currentStageGrade ? ` · ${currentStageGrade}` : ""}
              </>
            ) : (
              <span className="text-[#85858b]">무대 대기 중</span>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[#85858b]">시드 1 (정밀 매칭)</span>
          <span
            className={`font-mono tabular-nums ${
              seed1Pool.length > 0 ? "text-[#ededed] font-medium" : "text-[#85858b]"
            }`}
          >
            {seed1Pool.length}곡
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[#85858b]">시드 2 (확장 매칭)</span>
          <span
            className={`font-mono tabular-nums ${
              seed2Pool.length > 0 ? "text-[#a1a1a6] font-medium" : "text-[#85858b]"
            }`}
          >
            {seed2Pool.length}곡
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[#85858b]">현재 무대 재생</span>
          <span className="font-mono tabular-nums text-[#a1a1a6]">
            {playedTrackIds.length}곡
          </span>
        </div>

        {activeSeedLevel && (
          <div className="pt-1">
            <div className="px-3 py-2 rounded-[8px] bg-[#232325] border border-[#ededed]/[0.08] flex items-center gap-2">
              <StatusDot
                status={isPlaying ? "live" : "active"}
                live={isPlaying}
              />
              <span className="text-xs text-[#ededed] truncate">
                {activeSeedLevel === "CUSTOM"
                  ? "특별 연출 음원 재생 중"
                  : activeSeedLevel === 1
                  ? "시드 1: 정밀 매칭 음원 재생 중"
                  : activeSeedLevel === 2
                  ? "시드 2: 확장 매칭 음원 재생 중"
                  : "셔플 음원 재생 중"}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="pt-1 flex items-center gap-2">
        {currentTrack ? (
          <button
            type="button"
            onClick={() => handlePlayTrack(currentTrack)}
            className={`flex-1 h-9 px-3 rounded-[8px] text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] ${
              isPlaying
                ? "bg-[#232325] hover:bg-[#2c2c2f] text-[#ededed] border border-[#ededed]/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "bg-[#ededed] hover:bg-white text-[#141415] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause size={16} strokeWidth={1.5} />
                <span>일시정지</span>
              </>
            ) : (
              <>
                <Play size={16} strokeWidth={1.5} />
                <span>다시 재생</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => playNextSeedTrack(true)}
            disabled={seed1Pool.length === 0 && seed2Pool.length === 0}
            className="flex-1 h-9 px-3 rounded-[8px] bg-[#ededed] hover:bg-white text-[#141415] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={16} strokeWidth={1.5} />
            <span>무대 첫 곡 재생</span>
          </button>
        )}

        <Tooltip title="다음 시드 음원으로 즉시 교차 재생">
          <button
            type="button"
            onClick={() => playNextSeedTrack(false)}
            disabled={seed1Pool.length === 0 && seed2Pool.length === 0}
            className="h-9 px-3 rounded-[8px] bg-[#232325] hover:bg-[#2c2c2f] border border-[#ededed]/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-xs font-medium text-[#ededed] flex items-center gap-1.5 cursor-pointer transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SkipForward size={16} strokeWidth={1.5} />
            <span>다음 곡</span>
          </button>
        </Tooltip>

        <Tooltip title="매칭 규칙 및 시드 구조 안내">
          <button
            type="button"
            onClick={onOpenGuideModal}
            aria-label="시드 매칭 안내"
            className="h-9 w-9 rounded-[8px] bg-[#232325] hover:bg-[#2c2c2f] border border-[#ededed]/[0.08] text-[#a1a1a6] hover:text-[#ededed] flex items-center justify-center cursor-pointer transition-[background-color,color,transform] duration-150 active:scale-[0.98]"
          >
            <Info size={16} strokeWidth={1.5} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
