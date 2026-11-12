import React from "react";
import { Slider, Switch, Tag, Card, Tooltip } from "antd";
import { SoundFilled, ClockCircleOutlined } from "@ant-design/icons";
import { DEFAULT_TAB_CONFIGS } from "./constants";

export const AudioTabControls = ({
  volume = 1,
  handleVolumeChange,
  handleSmoothVolumeChange,
  selectedCategoryTab,
  currentTabConfig,
  updateTabFadeDuration,
  updateTabAutoNext,
}) => {
  const currentVolumePercent = Math.round((volume ?? 1) * 100);

  const mixingPresets = [
    { val: 0, label: "0", sub: "MUTE", desc: "0% (음소거 / Mute)" },
    { val: 0.1, label: "10", sub: "10%", desc: "10% (초미세 BGM)" },
    { val: 0.2, label: "20", sub: "MIC", desc: "20% (🎤 사회자 멘트 권장)" },
    { val: 0.5, label: "50", sub: "50%", desc: "50% (배경 음악)" },
    { val: 0.8, label: "80", sub: "80%", desc: "80% (표준 경기 음량)" },
    { val: 1.0, label: "100", sub: "MAX", desc: "100% (최대 출력)" },
  ];

  return (
    <Card className="shadow-sm rounded-2xl border-slate-200 bg-white">
      <div className="space-y-4">
        {/* 1. 마스터 볼륨 & 간이 믹싱 버튼 */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5">
              <SoundFilled className="text-indigo-600" />
              <span>마스터 볼륨 (간이 믹싱)</span>
            </span>
            <span className="font-mono text-indigo-600 font-black text-sm">
              {currentVolumePercent}%
            </span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            className="m-0"
          />

          {/* 🎚️ 0, 10, 20, 50, 80, 100 간이 믹싱 버튼 바 */}
          <div className="grid grid-cols-6 gap-1 mt-2.5">
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
                    className={`py-1.5 px-0.5 rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      isActive
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-xs scale-105 ring-1 ring-indigo-300"
                        : p.val === 0.2
                        ? "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 font-bold"
                        : p.val === 0
                        ? "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300"
                    }`}
                  >
                    <span className="font-black text-xs leading-none">{p.label}</span>
                    <span
                      className={`text-[8px] font-bold leading-none ${
                        isActive
                          ? "text-indigo-100"
                          : p.val === 0.2
                          ? "text-amber-600"
                          : "text-slate-400"
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

        {/* 2. 현재 선택된 탭별 페이드 & 자동 연속 재생 설정 */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <span>⚙️ 탭별 오디오 설정</span>
            </span>
            <Tag
              color="geekblue"
              className="text-[11px] font-bold px-2 py-0.5 m-0 border-0 rounded-md"
            >
              {selectedCategoryTab || "대회 경기"}
            </Tag>
          </div>

          {/* 페이드 전환 시간 */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span className="flex items-center gap-1">
                <ClockCircleOutlined className="text-amber-500" />
                <span className="font-bold">페이드 전환 시간</span>
              </span>
              <span className="font-mono text-amber-600 font-black">
                {currentTabConfig.fadeDuration.toFixed(1)}초
              </span>
            </div>
            <Slider
              min={0}
              max={15}
              step={0.5}
              value={currentTabConfig.fadeDuration}
              onChange={(val) => updateTabFadeDuration(selectedCategoryTab, val)}
              className="m-0"
            />
            {/* 프리셋 버튼 */}
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {[
                { sec: 0.0, label: "0초 (즉시)" },
                { sec: 2.0, label: "2초 (대회)" },
                { sec: 5.0, label: "5초" },
                { sec: 10.0, label: "10초 (시상식)" },
              ].map((p) => (
                <button
                  key={p.sec}
                  type="button"
                  onClick={() => updateTabFadeDuration(selectedCategoryTab, p.sec)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                    currentTabConfig.fadeDuration === p.sec
                      ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-bold shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const defaultVal =
                    DEFAULT_TAB_CONFIGS[selectedCategoryTab]?.fadeDuration ??
                    DEFAULT_TAB_CONFIGS.DEFAULT_CONTEST.fadeDuration;
                  updateTabFadeDuration(selectedCategoryTab, defaultVal);
                }}
                className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 ml-auto"
                title="기본값으로 복구"
              >
                🔄 기본값
              </button>
            </div>
          </div>

          {/* 다음 곡 자동 준비 / 연속 재생 스위치 */}
          <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-100">
            <div>
              <div className="text-xs font-bold text-slate-700">다음 곡 자동 연속 재생</div>
              <div className="text-[10px] text-slate-400">
                {currentTabConfig.autoNext
                  ? "곡 종료 시 다음 곡 자동 재생"
                  : "곡 완주 후 자동 정지"}
              </div>
            </div>
            <Switch
              checked={currentTabConfig.autoNext}
              onChange={(checked) => updateTabAutoNext(selectedCategoryTab, checked)}
              checkedChildren="연속 재생"
              unCheckedChildren="단발 정지"
              size="small"
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
