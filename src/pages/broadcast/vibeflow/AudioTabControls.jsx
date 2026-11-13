import React from "react";
import { Slider, Switch, Tooltip } from "antd";
import { Volume2, SlidersHorizontal, Clock, RotateCcw } from "lucide-react";
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
    { val: 0, label: "0", sub: "Mute", desc: "0% (음소거)" },
    { val: 0.1, label: "10", sub: "10%", desc: "10% (미세 배경음)" },
    { val: 0.2, label: "20", sub: "Mic", desc: "20% (사회자 멘트 권장)" },
    { val: 0.5, label: "50", sub: "50%", desc: "50% (배경 음악)" },
    { val: 0.8, label: "80", sub: "80%", desc: "80% (표준 경기 음량)" },
    { val: 1.0, label: "100", sub: "Max", desc: "100% (최대 출력)" },
  ];

  return (
    <div className="bg-[#19191b] border border-[#ededed]/[0.08] rounded-[12px] p-5 space-y-5">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-[#ededed] font-medium">
            <Volume2 size={16} strokeWidth={1.5} className="text-[#85858b]" />
            <span>마스터 출력 볼륨</span>
          </span>
          <span className="font-mono tabular-nums text-[#ededed] font-medium">
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

        <div className="grid grid-cols-6 gap-1.5 pt-1">
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
                  className={`h-10 rounded-[8px] border flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] ${
                    isActive
                      ? "bg-[#2563eb] text-white border-[#2563eb]"
                      : "bg-[#232325] hover:bg-[#2c2c2f] text-[#a1a1a6] hover:text-[#ededed] border-[#ededed]/[0.08]"
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

      <div className="pt-4 border-t border-[#ededed]/[0.08] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] leading-5 font-medium text-[#ededed] flex items-center gap-2">
            <SlidersHorizontal
              size={16}
              strokeWidth={1.5}
              className="text-[#85858b]"
            />
            <span>탭별 오디오 설정</span>
          </span>
          <span className="text-xs text-[#a1a1a6] px-2 py-0.5 rounded-[4px] bg-[#232325] border border-[#ededed]/[0.08] truncate max-w-[150px]">
            {selectedCategoryTab === "ALL"
              ? "전체 종목"
              : selectedCategoryTab || "대회 경기"}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-[#a1a1a6]">
              <Clock size={16} strokeWidth={1.5} className="text-[#85858b]" />
              <span>크로스페이드 시간</span>
            </span>
            <span className="font-mono tabular-nums text-[#ededed] font-medium">
              {currentTabConfig.fadeDuration.toFixed(1)}s
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
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            {[
              { sec: 0.0, label: "0.0s 즉시" },
              { sec: 2.0, label: "2.0s 대회" },
              { sec: 5.0, label: "5.0s" },
              { sec: 10.0, label: "10.0s 시상" },
            ].map((p) => (
              <button
                key={p.sec}
                type="button"
                onClick={() => updateTabFadeDuration(selectedCategoryTab, p.sec)}
                className={`h-7 px-2.5 rounded-[6px] border text-xs font-mono tabular-nums cursor-pointer transition-[background-color,border-color,color] duration-150 ${
                  currentTabConfig.fadeDuration === p.sec
                    ? "bg-[#2563eb] border-[#2563eb] text-white"
                    : "bg-[#232325] border-[#ededed]/[0.08] text-[#a1a1a6] hover:text-[#ededed]"
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
              className="h-7 px-2 rounded-[6px] border bg-[#141415] border-[#ededed]/[0.08] text-xs text-[#85858b] hover:text-[#ededed] flex items-center gap-1 ml-auto cursor-pointer transition-colors duration-150"
              title="기본값으로 복구"
            >
              <RotateCcw size={14} strokeWidth={1.5} />
              <span>기본값</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#ededed]/[0.08]">
          <div>
            <div className="text-xs font-medium text-[#ededed]">
              다음 곡 자동 연속 재생
            </div>
            <div className="text-[11px] leading-4 text-[#85858b] mt-0.5">
              {currentTabConfig.autoNext
                ? "곡 종료 시 다음 시드 음원 자동 전환"
                : "곡 완주 후 자동 정지"}
            </div>
          </div>
          <Switch
            checked={currentTabConfig.autoNext}
            onChange={(checked) => updateTabAutoNext(selectedCategoryTab, checked)}
            size="small"
          />
        </div>
      </div>
    </div>
  );
};
