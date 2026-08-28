import React from "react";
import { Button, Tag, Progress } from "antd";
import {
  TrophyOutlined,
  CloudUploadOutlined,
} from "@ant-design/icons";
import {
  CUSTOM_CATEGORIES,
  extractGender,
  isCategoryMatched,
  isDivisionMatched,
} from "./constants";

export const AudioCategoryTabs = ({
  categoryTabs,
  selectedCategoryTab,
  setSelectedCategoryTab,
  selectedDivision,
  setSelectedDivision,
  searchText,
  setSearchText,
  tracks,
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
  return (
    <div className="space-y-3">
      {/* 검색 및 필터 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {currentStageCategory && (
            <Button
              size="small"
              type={
                selectedCategoryTab === matchedVibeCategory ||
                selectedCategoryTab === "CURRENT_STAGE"
                  ? "primary"
                  : "default"
              }
              onClick={handleFilterCurrentStage}
              className={`rounded-lg text-xs font-bold ${
                selectedCategoryTab === matchedVibeCategory ||
                selectedCategoryTab === "CURRENT_STAGE"
                  ? "bg-indigo-600 font-black"
                  : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              }`}
            >
              🎯 현재 무대 [{currentStageCategory}
              {currentStageGrade ? ` • ${currentStageGrade}` : ""}] 자동 매칭
            </Button>
          )}
          {(selectedCategoryTab !== "ALL" ||
            selectedDivision !== "ALL" ||
            searchText) && (
            <Button
              size="small"
              onClick={() => {
                setSelectedCategoryTab("ALL");
                setSelectedDivision("ALL");
                setSearchText("");
              }}
              className="rounded-lg text-xs text-slate-500 hover:text-slate-700 border-slate-200"
            >
              필터 초기화
            </Button>
          )}
        </div>
      </div>

      {/* 🏷️ 1단계: 종목 카테고리 선택 바 */}
      <div className="space-y-3 pb-2 border-b border-slate-100">
        {/* 🏆 VibeFlows 공식 경기 종목 영역 */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <TrophyOutlined className="text-indigo-600" />
              <span>1단계: 대회 공식 경기 종목 (VibeFlows)</span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              총 {tracks.length}곡 등록됨
            </span>
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
                const catGender = extractGender(cat.name);
                const genderIcon =
                  catGender === "FEMALE"
                    ? "♀️ "
                    : catGender === "MALE"
                    ? "♂️ "
                    : "";

                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryTab(cat.name);
                      setSelectedDivision("ALL");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300"
                        : isCurrentMatch
                        ? "bg-magenta-50 text-magenta-700 border border-magenta-200 hover:bg-magenta-100"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <span>
                      {cat.name === "ALL" ? "전체 종목" : `${genderIcon}${cat.name}`}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : isCurrentMatch
                          ? "bg-magenta-200/60 text-magenta-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {cat.count}
                    </span>
                    {isCurrentMatch && (
                      <span
                        className={`text-[9px] px-1 rounded font-black ${
                          isSelected
                            ? "bg-white/30 text-white"
                            : "bg-magenta-600 text-white"
                        }`}
                      >
                        무대진행
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>

        {/* ⚡ 특별 연출 음원 영역 */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="text-amber-500">⚡</span>
            <span>특별 연출 음원 (국민의례 / 내빈소개 / 대기 / 시상식 / 쉬는시간)</span>
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      isSelected
                        ? "bg-slate-900 text-white shadow-sm ring-2 ring-slate-400"
                        : "bg-gradient-to-r from-slate-50 to-indigo-50/40 text-slate-800 hover:bg-indigo-50 border border-indigo-200/80"
                    }`}
                  >
                    <span className="text-sm">{cat.icon}</span>
                    <span>{cat.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-indigo-100 text-indigo-700"
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

      {/* ☁️ 하드코딩된 커스텀 음원 탭 선택 시 노출되는 전용 업로드 & 가이드 바 */}
      {CUSTOM_CATEGORIES.some((c) => c.name === selectedCategoryTab) && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-slate-50 border border-indigo-100/90 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-xs">
                {CUSTOM_CATEGORIES.find((c) => c.name === selectedCategoryTab)
                  ?.icon || "🎵"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-sm">
                    {selectedCategoryTab}
                  </span>
                  <Tag color="indigo" className="font-bold text-[10px] m-0">
                    자체 음원 보관소
                  </Tag>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {
                    CUSTOM_CATEGORIES.find(
                      (c) => c.name === selectedCategoryTab
                    )?.desc
                  }
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
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                loading={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl h-9 px-4 shadow-sm text-xs"
              >
                {isUploading
                  ? `업로드 중 (${uploadProgress}%)`
                  : `+ '${selectedCategoryTab}' 파일 업로드`}
              </Button>
            </div>
          </div>

          {isUploading && (
            <div className="space-y-1 bg-white/80 p-2.5 rounded-xl border border-indigo-100">
              <div className="flex justify-between text-xs font-bold text-indigo-700">
                <span>음원 파일 업로드 및 동기화 중...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress
                percent={uploadProgress}
                showInfo={false}
                strokeColor="#4f46e5"
                size="small"
              />
            </div>
          )}
        </div>
      )}

      {/* 🏷️ 2단계: 세부 체급/부문 칩스 (Division Pills) */}
      {!CUSTOM_CATEGORIES.some((c) => c.name === selectedCategoryTab) &&
        availableDivisions.length > 0 && (
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                <span>2단계: 세부 부문 / 체급 (Division) 필터</span>
              </span>
              <span className="text-[11px] text-slate-500">
                원하는 체급을 클릭하면 해당 체급 전용 음원만 압축 표출됩니다.
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
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
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      isSelected
                        ? "bg-slate-800 text-white shadow-sm ring-1 ring-slate-400"
                        : isCurrentMatch
                        ? "bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 font-bold"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <span>{div.name === "ALL" ? "전체 체급" : div.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : isCurrentMatch
                          ? "bg-amber-200 text-amber-900"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {div.count}
                    </span>
                    {isCurrentMatch && (
                      <span className="text-[9px] px-1 rounded bg-amber-500 text-white font-black">
                        현재체급
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
};
