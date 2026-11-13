import React from "react";
import {
  Music,
  Upload,
  RotateCcw,
  Flag,
  Mic,
  Clock,
  Award,
  Coffee,
  Layers,
} from "lucide-react";
import {
  CUSTOM_CATEGORIES,
  isCategoryMatched,
  isDivisionMatched,
} from "./constants";
import { StatusDot } from "../../../components/ui/BibTag";

const renderCustomIcon = (name) => {
  if (name.includes("국민의례")) return <Flag size={16} strokeWidth={1.5} />;
  if (name.includes("내빈")) return <Mic size={16} strokeWidth={1.5} />;
  if (name.includes("대기")) return <Clock size={16} strokeWidth={1.5} />;
  if (name.includes("시상")) return <Award size={16} strokeWidth={1.5} />;
  if (name.includes("쉬는")) return <Coffee size={16} strokeWidth={1.5} />;
  return <Music size={16} strokeWidth={1.5} />;
};

export const AudioCategoryTabs = ({
  categoryTabs,
  selectedCategoryTab,
  setSelectedCategoryTab,
  selectedDivision,
  setSelectedDivision,
  searchText,
  setSearchText,
  tracks = [],
  allAvailableTracks = [],
  currentStageCategory,
  currentStageGrade,
  currentStageGender,
  matchedVibeCategory,
  availableDivisions,
  handleFilterCurrentStage,
  fileInputRef,
  isUploading,
  uploadProgress,
  handleUploadCustomMusic,
}) => {
  const totalCount = allAvailableTracks.length || tracks.length;
  const isAllUnfiltered =
    selectedCategoryTab === "ALL" && selectedDivision === "ALL" && !searchText;
  const activeCustomMeta = CUSTOM_CATEGORIES.find(
    (c) => c.name === selectedCategoryTab
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryTab("ALL");
              setSelectedDivision("ALL");
              setSearchText("");
            }}
            className={`h-8 px-3 rounded-[8px] border text-xs font-medium flex items-center gap-2 cursor-pointer transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] ${
              isAllUnfiltered
                ? "bg-[#2563eb] border-[#2563eb] text-white"
                : "bg-[#232325] hover:bg-[#2c2c2f] border-[#ededed]/[0.08] text-[#ededed]"
            }`}
          >
            <Layers size={16} strokeWidth={1.5} />
            <span>전체 음원</span>
            <span className="font-mono tabular-nums opacity-80">{totalCount}</span>
          </button>

          {currentStageCategory && (
            <button
              type="button"
              onClick={handleFilterCurrentStage}
              className={`h-8 px-3 rounded-[8px] border text-xs font-medium flex items-center gap-2 cursor-pointer transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] ${
                selectedCategoryTab === matchedVibeCategory ||
                selectedCategoryTab === "CURRENT_STAGE"
                  ? "bg-[#2563eb] border-[#2563eb] text-white"
                  : "bg-[#232325] hover:bg-[#2c2c2f] border-[#2563eb]/40 text-[#ededed]"
              }`}
            >
              <StatusDot status="live" live />
              <span>
                현재 무대 매칭 ({currentStageCategory}
                {currentStageGrade ? ` · ${currentStageGrade}` : ""})
              </span>
            </button>
          )}

          {!isAllUnfiltered && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryTab("ALL");
                setSelectedDivision("ALL");
                setSearchText("");
              }}
              className="h-8 px-3 rounded-[8px] border border-[#ededed]/[0.08] bg-[#141415] hover:bg-[#232325] text-xs font-medium text-[#a1a1a6] hover:text-[#ededed] flex items-center gap-1.5 cursor-pointer transition-[background-color,color] duration-150"
            >
              <RotateCcw size={14} strokeWidth={1.5} />
              <span>필터 해제</span>
            </button>
          )}
        </div>

        <div className="text-xs text-[#85858b]">
          전체 보유{" "}
          <span className="font-mono tabular-nums text-[#ededed] font-medium">
            {totalCount}
          </span>
          곡
        </div>
      </div>

      <div className="space-y-4 pb-4 border-b border-[#ededed]/[0.08]">
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#85858b]">
            1단계 · 대회 공식 경기 종목
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {categoryTabs
              .filter((cat) => !cat.isCustom)
              .map((cat) => {
                const isSelected = selectedCategoryTab === cat.name;
                const isCurrentMatch =
                  cat.name !== "ALL" &&
                  isCategoryMatched(
                    cat.name,
                    currentStageCategory,
                    currentStageGender
                  );

                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryTab(cat.name);
                      setSelectedDivision("ALL");
                    }}
                    className={`h-8 px-3 rounded-[8px] border text-xs font-medium flex items-center gap-2 cursor-pointer transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] ${
                      isSelected
                        ? "bg-[#2563eb] border-[#2563eb] text-white"
                        : isCurrentMatch
                        ? "bg-[#232325] border-[#2563eb]/50 text-[#ededed] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "bg-[#141415] hover:bg-[#232325] border-[#ededed]/[0.08] text-[#a1a1a6] hover:text-[#ededed]"
                    }`}
                  >
                    {isCurrentMatch && <StatusDot status="live" live />}
                    <span>{cat.name === "ALL" ? "전체 종목" : cat.name}</span>
                    <span
                      className={`text-[11px] leading-4 font-mono tabular-nums ${
                        isSelected ? "text-white/85" : "text-[#85858b]"
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-[#85858b]">
            특별 연출 및 공식 의전 음원
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {categoryTabs
              .filter((cat) => cat.isCustom)
              .map((cat) => {
                const isSelected = selectedCategoryTab === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryTab(cat.name);
                      setSelectedDivision("ALL");
                    }}
                    className={`h-8 px-3 rounded-[8px] border text-xs font-medium flex items-center gap-2 cursor-pointer transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] ${
                      isSelected
                        ? "bg-[#2563eb] border-[#2563eb] text-white"
                        : "bg-[#232325] hover:bg-[#2c2c2f] border-[#ededed]/[0.08] text-[#ededed] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    }`}
                  >
                    <span className={isSelected ? "text-white" : "text-[#85858b]"}>
                      {renderCustomIcon(cat.name)}
                    </span>
                    <span>{cat.name}</span>
                    <span
                      className={`text-[11px] leading-4 font-mono tabular-nums ${
                        isSelected ? "text-white/85" : "text-[#85858b]"
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {activeCustomMeta && (
        <div className="p-4 rounded-[8px] bg-[#141415] border border-[#ededed]/[0.08] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-[#232325] border border-[#ededed]/[0.08] flex items-center justify-center text-[#a1a1a6] shrink-0">
                {renderCustomIcon(selectedCategoryTab)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#ededed] text-[13px]">
                    {selectedCategoryTab}
                  </span>
                  <span className="text-[11px] leading-4 px-2 py-0.5 rounded-[4px] bg-[#232325] border border-[#ededed]/[0.08] text-[#a1a1a6]">
                    자체 보관소
                  </span>
                </div>
                <div className="text-xs text-[#85858b] mt-0.5">
                  {activeCustomMeta.desc}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleUploadCustomMusic(
                      e.target.files,
                      selectedCategoryTab
                    );
                    e.target.value = "";
                  }
                }}
                className="hidden"
              />
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-9 px-3.5 rounded-[8px] bg-[#ededed] hover:bg-white text-[#141415] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] text-xs font-medium flex items-center gap-2 cursor-pointer transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={16} strokeWidth={1.5} />
                <span>
                  {isUploading
                    ? `업로드 중 (${uploadProgress}%)`
                    : `${selectedCategoryTab} 파일 업로드`}
                </span>
              </button>
            </div>
          </div>

          {isUploading && (
            <div className="space-y-1.5 bg-[#19191b] p-3 rounded-[8px] border border-[#ededed]/[0.08]">
              <div className="flex justify-between text-xs text-[#a1a1a6]">
                <span>음원 파일 업로드 및 동기화 중</span>
                <span className="font-mono tabular-nums text-[#ededed]">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#0f0f10] rounded-[4px] overflow-hidden">
                <div
                  className="w-full h-full bg-[#2563eb] origin-left transition-transform duration-150"
                  style={{
                    transform: `scaleX(${Math.max(
                      0,
                      Math.min(1, (uploadProgress || 0) / 100)
                    )})`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {!activeCustomMeta && availableDivisions.length > 0 && (
        <div className="bg-[#141415] border border-[#ededed]/[0.08] rounded-[8px] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-medium text-[#a1a1a6]">
              2단계 · 세부 부문 및 체급 필터
            </span>
            <span className="text-xs text-[#85858b]">
              체급을 선택하면 해당 체급 음원만 표시됩니다
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedDivision("ALL")}
              className={`h-7 px-2.5 rounded-[6px] border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-[background-color,border-color,color] duration-150 ${
                selectedDivision === "ALL"
                  ? "bg-[#2563eb] border-[#2563eb] text-white"
                  : "bg-[#19191b] hover:bg-[#232325] border-[#ededed]/[0.08] text-[#a1a1a6] hover:text-[#ededed]"
              }`}
            >
              <span>전체 체급</span>
            </button>

            {availableDivisions.map((div) => {
              const isSelected = selectedDivision === div.name;
              const isCurrentMatch =
                currentStageGrade &&
                div.name !== "ALL" &&
                isDivisionMatched(div.name, currentStageGrade);

              return (
                <button
                  key={div.name}
                  type="button"
                  onClick={() => setSelectedDivision(div.name)}
                  className={`h-7 px-2.5 rounded-[6px] border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-[background-color,border-color,color] duration-150 ${
                    isSelected
                      ? "bg-[#2563eb] border-[#2563eb] text-white"
                      : isCurrentMatch
                      ? "bg-[#232325] border-[#2563eb]/50 text-[#ededed]"
                      : "bg-[#19191b] hover:bg-[#232325] border-[#ededed]/[0.08] text-[#a1a1a6] hover:text-[#ededed]"
                  }`}
                >
                  {isCurrentMatch && <StatusDot status="live" live />}
                  <span>{div.name === "ALL" ? "전체 체급" : div.name}</span>
                  <span
                    className={`text-[11px] font-mono tabular-nums ${
                      isSelected ? "text-white/85" : "text-[#85858b]"
                    }`}
                  >
                    {div.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
