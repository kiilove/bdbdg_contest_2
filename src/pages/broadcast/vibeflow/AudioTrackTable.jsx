import React, { useState, useEffect } from "react";
import { Input, Tooltip } from "antd";
import {
  Search,
  Play,
  Pause,
  Trash2,
  Music,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  CUSTOM_CATEGORIES,
  extractGender,
  getTrackKey,
  isTrackEqual,
  formatSeconds,
  isMatchingCustomTab,
} from "./constants";
import { BibTag, StatusDot } from "../../../components/ui/BibTag";

export const AudioTrackTable = ({
  filteredTracks = [],
  allAvailableTracks = [],
  isLoadingTracks,
  searchText,
  setSearchText,
  selectedCategoryTab,
  setSelectedCategoryTab,
  selectedDivision,
  setSelectedDivision,
  currentTrack,
  isPlaying,
  audioTransition = null,
  handlePlayTrack,
  handleDeleteCustomMusic,
  seed1Pool = [],
  seed2Pool = [],
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryTab, selectedDivision, searchText, filteredTracks.length]);

  const seed1Set = new Set(seed1Pool.map((t) => getTrackKey(t)).filter(Boolean));
  const seed2Set = new Set(seed2Pool.map((t) => getTrackKey(t)).filter(Boolean));

  const totalAllCount = allAvailableTracks.length;
  const isFiltered =
    selectedCategoryTab !== "ALL" || selectedDivision !== "ALL" || !!searchText;

  const handleResetFilters = () => {
    if (setSelectedCategoryTab) setSelectedCategoryTab("ALL");
    if (setSelectedDivision) setSelectedDivision("ALL");
    if (setSearchText) setSearchText("");
  };

  const totalPages = Math.max(1, Math.ceil(filteredTracks.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageItems = filteredTracks.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px] max-w-md">
          <Input
            prefix={<Search size={16} strokeWidth={1.5} className="text-[#85858b]" />}
            placeholder="곡 제목, 아티스트, 종목명, 체급 검색"
            value={searchText}
            onChange={(e) => setSearchText && setSearchText(e.target.value)}
            allowClear
          />
        </div>

        <div className="flex items-center gap-3">
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-8 px-3 rounded-[8px] bg-[#232325] hover:bg-[#2c2c2f] border border-[#ededed]/[0.08] text-xs font-medium text-[#ededed] cursor-pointer transition-colors duration-150"
            >
              전체 목록 보기 ({totalAllCount})
            </button>
          )}
          <div className="text-xs text-[#85858b]">
            표시{" "}
            <span className="font-mono tabular-nums text-[#ededed] font-medium">
              {filteredTracks.length}
            </span>{" "}
            / 전체{" "}
            <span className="font-mono tabular-nums text-[#a1a1a6]">
              {totalAllCount}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-[8px] border border-[#ededed]/[0.08] overflow-hidden bg-[#141415]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#0f0f10] border-b border-[#ededed]/[0.08] text-xs font-medium text-[#85858b]">
                <th className="py-2.5 px-3 w-[96px] font-medium">번호 · 시드</th>
                <th className="py-2.5 px-3 font-medium">음원 정보</th>
                <th className="py-2.5 px-3 w-[180px] font-medium">대회 종목</th>
                <th className="py-2.5 px-3 w-[148px] font-medium">부문 · 체급</th>
                <th className="py-2.5 px-3 w-[88px] text-right font-medium">
                  재생시간
                </th>
                <th className="py-2.5 px-3 w-[156px] text-right font-medium">
                  제어
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ededed]/[0.06]">
              {isLoadingTracks ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="inline-flex items-center gap-2 text-xs text-[#a1a1a6]">
                      <RefreshCw
                        size={16}
                        strokeWidth={1.5}
                        className="animate-spin text-[#85858b]"
                      />
                      <span>음원 목록을 불러오는 중</span>
                    </div>
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="space-y-3 flex flex-col items-center">
                      <div className="w-10 h-10 rounded-[8px] bg-[#19191b] border border-[#ededed]/[0.08] flex items-center justify-center text-[#85858b]">
                        <Music size={18} strokeWidth={1.5} />
                      </div>
                      <div className="text-xs text-[#a1a1a6]">
                        선택한 조건에 일치하는 음원이 없습니다
                      </div>
                      {totalAllCount > 0 && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="h-9 px-4 rounded-[8px] bg-[#ededed] hover:bg-white text-[#141415] text-xs font-medium cursor-pointer transition-colors duration-150"
                        >
                          전체 음원 목록 보기 ({totalAllCount})
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageItems.map((record, idx) => {
                  const globalIdx = startIndex + idx;
                  const key = getTrackKey(record) || globalIdx;
                  const isSeed1 = key && seed1Set.has(key);
                  const isSeed2 = key && seed2Set.has(key);
                  const isThisTrackActive = isTrackEqual(currentTrack, record);
                  const activePlaying = isThisTrackActive && isPlaying;

                  const isTransitionTarget = Boolean(
                    audioTransition?.targetTrack &&
                      isTrackEqual(audioTransition.targetTrack, record)
                  );
                  const isTransitionOutgoing = Boolean(
                    audioTransition?.phase === "crossfading" &&
                      audioTransition?.fromTrack &&
                      isTrackEqual(audioTransition.fromTrack, record) &&
                      !isTransitionTarget
                  );
                  const transPhase = isTransitionTarget
                    ? audioTransition.phase
                    : null;
                  const transProgress = isTransitionTarget
                    ? Math.max(
                        0,
                        Math.min(100, Math.round(audioTransition.progress || 0))
                      )
                    : 0;
                  const isRowButtonLocked =
                    transPhase === "loading" || transPhase === "fading-out";

                  const categoryName =
                    record.contest_category_kr ||
                    record.category ||
                    record.folder ||
                    "";
                  const customObj = record.is_custom
                    ? CUSTOM_CATEGORIES.find((c) =>
                        isMatchingCustomTab(record, c.name)
                      )
                    : null;
                  const gender = !record.is_custom
                    ? extractGender(categoryName)
                    : "ANY";
                  const div = record.contest_division_kr;

                  return (
                    <tr
                      key={key}
                      className={`h-12 transition-colors duration-150 focus-within:bg-[#232325]/90 ${
                        isTransitionTarget || isThisTrackActive
                          ? "bg-[#232325] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                          : "bg-[#19191b] hover:bg-[#232325]/60"
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <BibTag
                            number={String(globalIdx + 1).padStart(2, "0")}
                            variant={
                              isTransitionTarget || isThisTrackActive
                                ? "active"
                                : "dark"
                            }
                            size="sm"
                          />
                          {isTransitionTarget ? (
                            <Loader2
                              size={12}
                              strokeWidth={2}
                              className={`animate-spin ${
                                transPhase === "fading-out"
                                  ? "text-[#fbbf24]"
                                  : "text-[#60a5fa]"
                              }`}
                            />
                          ) : isThisTrackActive ? (
                            <StatusDot status="live" live={isPlaying} />
                          ) : isSeed1 ? (
                            <span className="text-[11px] leading-4 font-mono px-1.5 py-0.5 rounded-[4px] bg-[#2563eb]/15 text-[#60a5fa] border border-[#2563eb]/30">
                              S1
                            </span>
                          ) : isSeed2 ? (
                            <span className="text-[11px] leading-4 font-mono px-1.5 py-0.5 rounded-[4px] bg-[#232325] text-[#a1a1a6] border border-[#ededed]/[0.08]">
                              S2
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] leading-5 font-medium truncate max-w-[260px] text-[#ededed]">
                            {record.title || record.name || "Untitled"}
                          </span>
                          {transPhase === "loading" ? (
                            <span className="text-[11px] leading-4 px-1.5 py-0.5 rounded-[4px] bg-[#2563eb]/20 text-[#60a5fa] border border-[#2563eb]/40 shrink-0 inline-flex items-center gap-1">
                              <Loader2
                                size={10}
                                strokeWidth={2}
                                className="animate-spin"
                              />
                              <span>음원 수신 중...</span>
                            </span>
                          ) : transPhase === "crossfading" ? (
                            <span className="text-[11px] leading-4 font-mono tabular-nums px-1.5 py-0.5 rounded-[4px] bg-[#2563eb]/20 text-[#60a5fa] border border-[#2563eb]/40 shrink-0">
                              교차 진입 {transProgress}%
                            </span>
                          ) : transPhase === "fading-in" ? (
                            <span className="text-[11px] leading-4 font-mono tabular-nums px-1.5 py-0.5 rounded-[4px] bg-[#2563eb]/20 text-[#60a5fa] border border-[#2563eb]/40 shrink-0">
                              페이드인 {transProgress}%
                            </span>
                          ) : transPhase === "fading-out" ? (
                            <span className="text-[11px] leading-4 font-mono tabular-nums px-1.5 py-0.5 rounded-[4px] bg-[#d97706]/20 text-[#fbbf24] border border-[#d97706]/40 shrink-0">
                              감쇄 정지 {transProgress}%
                            </span>
                          ) : isTransitionOutgoing ? (
                            <span className="text-[11px] leading-4 px-1.5 py-0.5 rounded-[4px] bg-[#d97706]/15 text-[#fbbf24] border border-[#d97706]/35 shrink-0">
                              감쇄 종료 중
                            </span>
                          ) : activePlaying ? (
                            <span className="text-[11px] leading-4 px-1.5 py-0.5 rounded-[4px] bg-[#2563eb]/20 text-[#60a5fa] border border-[#2563eb]/35 shrink-0">
                              출력 중
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-[#85858b] truncate max-w-[280px]">
                          {record.artist || "Unknown Artist"}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        {record.is_custom ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] leading-4 px-1.5 py-0.5 rounded-[4px] bg-[#232325] border border-[#ededed]/[0.10] text-[#a1a1a6]">
                              자체음원
                            </span>
                            <span className="text-xs text-[#ededed]">
                              {categoryName || customObj?.name || "특별 연출"}
                            </span>
                          </div>
                        ) : categoryName ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {gender === "FEMALE" ? (
                              <span className="text-[11px] leading-4 px-1.5 py-0.5 rounded-[4px] bg-[#232325] border border-[#ededed]/[0.08] text-[#a1a1a6]">
                                여성
                              </span>
                            ) : gender === "MALE" ? (
                              <span className="text-[11px] leading-4 px-1.5 py-0.5 rounded-[4px] bg-[#232325] border border-[#ededed]/[0.08] text-[#a1a1a6]">
                                남성
                              </span>
                            ) : null}
                            <span className="text-xs text-[#ededed]">
                              {categoryName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-[#85858b]">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {div && div !== "공통 / 전체" ? (
                          <Tooltip title={`클릭 시 '${div}' 체급 필터링`}>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedDivision && setSelectedDivision(div)
                              }
                              className="text-xs px-2 py-0.5 rounded-[4px] bg-[#232325] hover:bg-[#2c2c2f] border border-[#ededed]/[0.08] text-[#a1a1a6] hover:text-[#ededed] cursor-pointer transition-colors duration-150"
                            >
                              {div}
                            </button>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-[#85858b] font-mono">
                            공통 / 전체
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <span className="font-mono tabular-nums text-xs text-[#a1a1a6]">
                          {formatSeconds(record.duration)}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isRowButtonLocked}
                            onClick={() => handlePlayTrack(record, "track")}
                            className={`h-8 px-3 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-[background-color,border-color,color,transform,opacity] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed ${
                              transPhase === "loading"
                                ? "bg-[#2563eb] text-white border border-[#3b82f6] opacity-95"
                                : transPhase === "fading-out"
                                ? "bg-[#232325] text-[#fbbf24] border border-[#d97706]/55 opacity-95"
                                : transPhase === "crossfading" ||
                                  transPhase === "fading-in"
                                ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white border border-[#3b82f6]"
                                : activePlaying
                                ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white border border-[#2563eb]"
                                : "bg-[#232325] hover:bg-[#ededed] text-[#ededed] hover:text-[#141415] border border-[#ededed]/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                            }`}
                          >
                            {transPhase === "loading" ? (
                              <>
                                <Loader2
                                  size={13}
                                  strokeWidth={2}
                                  className="animate-spin"
                                />
                                <span>로딩 중</span>
                              </>
                            ) : transPhase === "fading-out" ? (
                              <>
                                <Loader2
                                  size={13}
                                  strokeWidth={2}
                                  className="animate-spin"
                                />
                                <span className="font-mono tabular-nums">
                                  정지 {transProgress}%
                                </span>
                              </>
                            ) : transPhase === "crossfading" ? (
                              <>
                                <Loader2
                                  size={13}
                                  strokeWidth={2}
                                  className="animate-spin"
                                />
                                <span className="font-mono tabular-nums">
                                  전환 {transProgress}%
                                </span>
                              </>
                            ) : transPhase === "fading-in" ? (
                              <>
                                <Loader2
                                  size={13}
                                  strokeWidth={2}
                                  className="animate-spin"
                                />
                                <span className="font-mono tabular-nums">
                                  페이드인 {transProgress}%
                                </span>
                              </>
                            ) : activePlaying ? (
                              <>
                                <Pause size={14} strokeWidth={1.5} />
                                <span>정지</span>
                              </>
                            ) : (
                              <>
                                <Play size={14} strokeWidth={1.5} />
                                <span>재생</span>
                              </>
                            )}
                          </button>

                          {record.is_custom && (
                            <Tooltip title="자체 음원 삭제">
                              <button
                                type="button"
                                aria-label="자체 음원 삭제"
                                onClick={() => handleDeleteCustomMusic(record)}
                                className="h-8 w-8 rounded-[6px] bg-transparent hover:bg-[#e5484d]/15 text-[#85858b] hover:text-[#e5484d] inline-flex items-center justify-center cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e5484d]"
                              >
                                <Trash2 size={15} strokeWidth={1.5} />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredTracks.length > 0 && (
          <div className="px-4 py-2.5 bg-[#0f0f10] border-t border-[#ededed]/[0.08] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#85858b] mr-1">페이지당</span>
              {[10, 20, 50, 100].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => {
                    setPageSize(sz);
                    setCurrentPage(1);
                  }}
                  className={`h-7 px-2 rounded-[4px] font-mono tabular-nums text-xs cursor-pointer transition-colors duration-150 ${
                    pageSize === sz
                      ? "bg-[#232325] text-[#ededed] border border-[#ededed]/[0.14]"
                      : "text-[#85858b] hover:text-[#ededed]"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono tabular-nums text-[#85858b]">
                {startIndex + 1}–
                {Math.min(startIndex + pageSize, filteredTracks.length)} /{" "}
                {filteredTracks.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="이전 페이지"
                  className="h-7 w-7 rounded-[4px] bg-[#19191b] hover:bg-[#232325] border border-[#ededed]/[0.08] text-[#ededed] flex items-center justify-center cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={15} strokeWidth={1.5} />
                </button>
                <span className="px-2 text-xs font-mono tabular-nums text-[#ededed]">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  aria-label="다음 페이지"
                  className="h-7 w-7 rounded-[4px] bg-[#19191b] hover:bg-[#232325] border border-[#ededed]/[0.08] text-[#ededed] flex items-center justify-center cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={15} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
