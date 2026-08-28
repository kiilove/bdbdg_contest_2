import React from "react";
import { Card, Tag, Slider, Button, Tooltip } from "antd";
import {
  SoundFilled,
  CustomerServiceOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  CaretRightOutlined,
  PauseOutlined,
} from "@ant-design/icons";
import { formatSeconds } from "./constants";
import { DualDeckMonitor } from "./DualDeckMonitor";

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
  handleSliderChange,
  handlePlayTrack,
  handlePrevTrack,
  handleNextTrack,
}) => {
  return (
    <div className="space-y-4">
      {/* 마스터 플레이어 카드 */}
      <Card className="shadow-sm rounded-2xl border-slate-200 bg-white text-center">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <SoundFilled className="text-indigo-600" />
            <span>MASTER AUDIO CONTROLLER</span>
          </span>
          <div className="flex items-center gap-1.5">
            <Tag
              color={activeDeck === "A" ? "blue" : "purple"}
              className="font-bold text-[11px] m-0"
            >
              🎛️ Deck {activeDeck} 활성
            </Tag>
            {isPlaying ? (
              <Tag color="processing" className="font-bold text-xs m-0">
                재생중
              </Tag>
            ) : (
              <Tag className="font-bold text-xs m-0 bg-slate-100 text-slate-500 border-none">
                대기중
              </Tag>
            )}
          </div>
        </div>

        {/* 앨범 커버 */}
        <div className="relative w-36 h-36 mx-auto rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center mb-4">
          {currentTrack?.cover_url ? (
            <img
              src={currentTrack.cover_url}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <CustomerServiceOutlined className="text-5xl text-slate-300" />
          )}

          {isPlaying && (
            <div className="absolute inset-0 bg-indigo-950/20 backdrop-blur-2xs flex items-center justify-center">
              <SoundFilled className="text-3xl text-indigo-600 animate-bounce" />
            </div>
          )}
        </div>

        {/* 음원 상세 정보 */}
        <div className="space-y-1 mb-4">
          <h3 className="text-base font-bold text-slate-900 m-0 truncate">
            {currentTrack?.title || currentTrack?.name || "선택된 음원 없음"}
          </h3>
          <p className="text-xs text-slate-500 font-medium m-0 truncate">
            {currentTrack?.artist || "우측 목록에서 음원을 선택해주세요"}
          </p>

          {(currentTrack?.contest_category_kr ||
            currentTrack?.contest_division_kr) && (
            <div className="flex items-center justify-center gap-1.5 pt-1 flex-wrap">
              {currentTrack?.contest_category_kr && (
                <Tag color="blue" className="font-bold text-[11px] m-0">
                  {currentTrack.contest_category_kr}
                </Tag>
              )}
              {currentTrack?.contest_division_kr && (
                <Tag color="purple" className="font-bold text-[11px] m-0">
                  {currentTrack.contest_division_kr}
                </Tag>
              )}
            </div>
          )}
        </div>

        {/* 프로그레스 슬라이더 */}
        <div className="space-y-1 mb-5">
          <Slider
            min={0}
            max={trackDuration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSliderChange}
            tooltip={{ formatter: (v) => formatSeconds(v) }}
            className="m-0"
          />

          <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-400">
            <span>{formatSeconds(currentTime)}</span>
            <span>{formatSeconds(trackDuration)}</span>
          </div>
        </div>

        {/* 🎛️ 표준 미디어 플레이어 컨트롤 바 (이전곡 / 재생·일시정지 / 다음곡) */}
        <div className="flex items-center justify-center gap-6 py-2">
          {/* 이전곡 버튼 */}
          <Tooltip title="이전 곡 재생">
            <button
              type="button"
              onClick={handlePrevTrack}
              aria-label="이전 곡"
              className="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] rounded-full border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 shadow-xs flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 focus:outline-none"
            >
              <StepBackwardOutlined className="text-lg" />
            </button>
          </Tooltip>

          {/* 메인 재생 / 일시정지 버튼 (완벽한 원형 기하구조) */}
          <Tooltip title={isPlaying ? "일시정지 (2초 안전 정지)" : "재생 (2초 페이드인)"}>
            <button
              type="button"
              disabled={!currentTrack}
              onClick={() => currentTrack && handlePlayTrack(currentTrack)}
              aria-label={isPlaying ? "일시정지" : "재생"}
              className={`w-14 h-14 min-w-[56px] min-h-[56px] max-w-[56px] max-h-[56px] rounded-full flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-108 active:scale-95 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                isPlaying
                  ? "bg-amber-500 hover:bg-amber-400 text-white shadow-amber-200"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200"
              }`}
            >
              {isPlaying ? (
                <PauseOutlined className="text-2xl text-white" />
              ) : (
                <CaretRightOutlined className="text-2xl text-white ml-0.5" />
              )}
            </button>
          </Tooltip>

          {/* 다음곡 버튼 */}
          <Tooltip title="다음 곡 재생 (크로스페이드)">
            <button
              type="button"
              onClick={handleNextTrack}
              aria-label="다음 곡"
              className="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] rounded-full border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 shadow-xs flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 focus:outline-none"
            >
              <StepForwardOutlined className="text-lg" />
            </button>
          </Tooltip>
        </div>
      </Card>

      {/* 🎚️ 듀얼 데크 크로스페이더 인디케이터 카드 */}
      <Card className="shadow-sm rounded-2xl border-slate-200 bg-white">
        <DualDeckMonitor
          activeDeck={activeDeck}
          isPlaying={isPlaying}
          currentTrack={currentTrack}
          preCuedTrack={preCuedTrack}
          deckAVolume={deckAVolume}
          deckBVolume={deckBVolume}
          currentTabConfig={currentTabConfig}
        />
      </Card>
    </div>
  );
};
