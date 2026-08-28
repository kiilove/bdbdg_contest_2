import React from "react";
import { Card, Switch, Button, Tooltip, Badge } from "antd";
import {
  ThunderboltFilled,
  StepForwardOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { extractGender } from "./constants";

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

  return (
    <Card className="shadow-sm rounded-2xl border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50">
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-1.5">
            <ThunderboltFilled className="text-amber-500 text-base animate-pulse" />
            <span className="font-bold text-xs text-slate-800">
              스마트 오토파일럿
            </span>
          </div>
          <Switch
            checked={isAutoPlayOnStageChange}
            onChange={setIsAutoPlayOnStageChange}
            checkedChildren="자동"
            unCheckedChildren="수동"
            size="small"
          />
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>🏆 타겟 무대</span>
            <span className="font-bold text-indigo-600 truncate max-w-[170px]">
              {currentStageCategory ? (
                <>
                  {genderType === "FEMALE"
                    ? "♀️ "
                    : genderType === "MALE"
                    ? "♂️ "
                    : ""}
                  {currentStageCategory}{" "}
                  {currentStageGrade ? `• ${currentStageGrade}` : ""}
                </>
              ) : (
                "무대 대기중"
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span>🌱 시드 1 (정밀 매칭)</span>
            <span className="font-bold text-slate-800">
              {seed1Pool.length > 0 ? (
                <span className="text-emerald-600 font-mono">
                  {seed1Pool.length}곡 준비
                </span>
              ) : (
                <span className="text-slate-400">0곡</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span>🌿 시드 2 (확장 매칭)</span>
            <span className="font-bold text-slate-800">
              {seed2Pool.length > 0 ? (
                <span className="text-blue-600 font-mono">
                  {seed2Pool.length}곡 준비
                </span>
              ) : (
                <span className="text-slate-400">0곡</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span>📊 현재 무대 재생</span>
            <span className="font-bold text-slate-700 font-mono">
              {playedTrackIds.length}곡 재생됨
            </span>
          </div>

          {activeSeedLevel && (
            <div className="pt-1">
              <Badge
                status={
                  activeSeedLevel === 1
                    ? "success"
                    : activeSeedLevel === 2
                    ? "processing"
                    : "default"
                }
                text={
                  <span className="text-[11px] font-semibold text-slate-700">
                    {activeSeedLevel === "CUSTOM"
                      ? "자체 특별 연출 음원 재생중"
                      : activeSeedLevel === 1
                      ? "시드 1: 정밀 매칭 음원 재생중"
                      : activeSeedLevel === 2
                      ? "시드 2: 확장 매칭 음원 재생중"
                      : "랜덤 셔플 음원 재생중"}
                  </span>
                }
              />
            </div>
          )}
        </div>

        {/* 조작 버튼 */}
        <div className="pt-1 flex gap-2">
          {currentTrack ? (
            <Button
              type={isPlaying ? "default" : "primary"}
              icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handlePlayTrack(currentTrack)}
              className="flex-1 font-bold text-xs h-8 rounded-xl"
            >
              {isPlaying ? "일시정지" : "다시재생"}
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => playNextSeedTrack(true)}
              disabled={seed1Pool.length === 0 && seed2Pool.length === 0}
              className="flex-1 font-bold text-xs h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700"
            >
              무대 첫곡 재생
            </Button>
          )}

          <Tooltip title="다음 시드 음원으로 즉시 교차 재생합니다.">
            <Button
              icon={<StepForwardOutlined />}
              onClick={() => playNextSeedTrack(false)}
              disabled={seed1Pool.length === 0 && seed2Pool.length === 0}
              className="font-bold text-xs h-8 rounded-xl"
            >
              다음곡
            </Button>
          </Tooltip>

          <Tooltip title="매칭 규칙 및 시드 구조 안내">
            <Button
              icon={<InfoCircleOutlined />}
              onClick={onOpenGuideModal}
              className="text-xs h-8 w-8 px-0 rounded-xl text-slate-400 hover:text-indigo-600"
            />
          </Tooltip>
        </div>
      </div>
    </Card>
  );
};
