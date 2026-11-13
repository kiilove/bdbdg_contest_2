import React from "react";
import { Checkbox, Input, Tooltip } from "antd";
import { Save, Pencil, Check, User } from "lucide-react";
import BibTag from "../ui/BibTag";
import { getStagePlayerSortIndex } from "../../functions/functions";
import {
  getPlayerEntryKey,
  parseHeightWeightValue,
} from "../../utils/playerEntryUtils";
import { extractPlayerPhotos } from "../../utils/playerPhotoUtils";

const WeighInGradeSectionList = ({
  filteredMatchedArray,
  isMobile,
  focusedPlayerKeyRef,
  onOpenPhotoModal,
  onHeightChange,
  onWeightChange,
  onSavePlayerWeighIn,
  onGradeChange,
  onNoShowChange,
  onOpenNumberModal,
}) => {
  return (
    <div className="space-y-4">
      {filteredMatchedArray.length === 0 ? (
        <div className="bg-[#ffffff] rounded-[12px] p-12 text-center border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="text-[#737373] font-medium text-sm m-0">
            검색 조건에 일치하는 선수가 없습니다.
          </p>
        </div>
      ) : (
        filteredMatchedArray.map((matched, mIdx) => {
          const {
            contestCategoryId: categoryId,
            contestCategoryTitle: categoryTitle,
            contestGradeId: gradeId,
            contestGradeTitle: gradeTitle,
            matchedPlayers,
          } = matched;

          const gradeNoShowCount = matchedPlayers.filter(
            (p) => p.playerNoShow
          ).length;

          return (
            <div
              key={gradeId || mIdx}
              className="bg-[#ffffff] rounded-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-[#171717]/[0.08] overflow-hidden"
            >
              {/* 체급 헤더 */}
              <div className="bg-[#f4f4f5] px-5 py-3 border-b border-[#171717]/[0.08] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-[#171717] m-0">
                    {categoryTitle}
                    <span className="text-[#525252] font-normal mx-1.5">/</span>
                    <span className="text-[#171717] font-medium">
                      {gradeTitle}
                    </span>
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] bg-[#ffffff] border border-[#171717]/[0.08] text-xs font-medium text-[#525252] tabular-nums">
                    출전 {matchedPlayers.length - gradeNoShowCount} /{" "}
                    {matchedPlayers.length}명
                    {gradeNoShowCount > 0 && (
                      <span className="text-[#dc2626] ml-1">
                        (불참 {gradeNoShowCount}명)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* 데스크탑 테이블 */}
              {!isMobile ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#171717]/[0.08] bg-[#fafafa] text-xs font-medium text-[#525252]">
                        <th className="py-2.5 px-3 w-14 text-center whitespace-nowrap">
                          순번
                        </th>
                        <th className="py-2.5 px-2 w-20 text-center whitespace-nowrap">
                          사진
                        </th>
                        <th className="py-2.5 px-3 w-28 text-center whitespace-nowrap">
                          선수번호
                        </th>
                        <th className="py-2.5 px-4 w-48 whitespace-nowrap">
                          선수 성명 / 상태
                        </th>
                        <th className="py-2.5 px-3 w-40 whitespace-nowrap">
                          소속
                        </th>
                        <th className="py-2.5 px-4 min-w-[330px] whitespace-nowrap">
                          신장(cm) / 체중(kg) 계측
                        </th>
                        <th className="py-2.5 px-3 w-16 text-center whitespace-nowrap">
                          월체
                        </th>
                        <th className="py-2.5 px-3 w-16 text-center whitespace-nowrap">
                          불참
                        </th>
                        <th className="py-2.5 px-3 w-24 min-w-[88px] text-center whitespace-nowrap">
                          관리
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#171717]/[0.06]">
                      {[...matchedPlayers]
                        .sort(
                          (a, b) =>
                            getStagePlayerSortIndex(a, matched) -
                            getStagePlayerSortIndex(b, matched)
                        )
                        .map((player, pIdx) => {
                          const {
                            playerName,
                            playerGym,
                            playerUid,
                            playerNumber,
                            playerNoShow,
                            isGradeChanged,
                            isWeighedIn,
                            heightWeight,
                          } = player;

                          const entryKey = getPlayerEntryKey(player);
                          const { height, weight } =
                            parseHeightWeightValue(heightWeight);
                          const playerPhotos = extractPlayerPhotos(player);

                          return (
                            <tr
                              key={entryKey || playerUid}
                              className={`transition-colors duration-150 ${
                                playerNoShow
                                  ? "bg-[#dc2626]/[0.04]"
                                  : isWeighedIn
                                  ? "bg-[#16a34a]/[0.03] hover:bg-[#16a34a]/[0.06]"
                                  : "hover:bg-[#fafafa]"
                              }`}
                            >
                              {/* 순번 */}
                              <td className="py-3.5 px-3 text-center font-mono tabular-nums text-xs text-[#737373]">
                                {pIdx + 1}
                              </td>

                              {/* 선수 사진 썸네일 */}
                              <td className="py-3 px-2 text-center">
                                {playerPhotos.length > 0 ? (
                                  <Tooltip title="클릭하여 무대 송출 사진 지정 및 갤러리 확인">
                                    <div
                                      onClick={() => onOpenPhotoModal(player)}
                                      className="relative inline-block cursor-pointer"
                                    >
                                      <img
                                        src={
                                          player.stagePhoto1 ||
                                          player.stagePhotoUrl1 ||
                                          player.stagePhotoUrl ||
                                          playerPhotos[0]
                                        }
                                        alt={playerName}
                                        className="w-10 h-10 rounded-[8px] object-cover border border-[#171717]/[0.14] mx-auto"
                                      />
                                      {playerPhotos.length > 1 && (
                                        <span className="absolute -bottom-1 -right-1 bg-[#171717] text-[10px] text-white font-mono tabular-nums px-1 py-0.2 rounded-[4px]">
                                          +{playerPhotos.length - 1}
                                        </span>
                                      )}
                                    </div>
                                  </Tooltip>
                                ) : (
                                  <Tooltip title="사진 미등록 (클릭하여 확인)">
                                    <button
                                      type="button"
                                      onClick={() => onOpenPhotoModal(player)}
                                      className="w-10 h-10 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] border border-[#171717]/[0.08] text-[#737373] hover:text-[#171717] flex items-center justify-center cursor-pointer transition-colors duration-150 mx-auto"
                                    >
                                      <User size={16} strokeWidth={1.5} />
                                    </button>
                                  </Tooltip>
                                )}
                              </td>

                              {/* 선수번호 뱃지 */}
                              <td className="py-3.5 px-3 text-center">
                                <BibTag
                                  number={playerNumber}
                                  variant={
                                    isWeighedIn && !playerNoShow
                                      ? "active"
                                      : "default"
                                  }
                                  size="md"
                                  className={
                                    playerNoShow
                                      ? "line-through opacity-50"
                                      : ""
                                  }
                                />
                              </td>

                              {/* 선수 성명 & 불참/월체 상태 */}
                              <td className="py-3.5 px-4">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`font-medium text-sm ${
                                        playerNoShow
                                          ? "text-[#dc2626] line-through"
                                          : "text-[#171717]"
                                      }`}
                                    >
                                      {playerName}
                                    </span>
                                    {isGradeChanged && !playerNoShow && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] border border-[#b45309]/20 text-[11px] font-medium">
                                        월체
                                      </span>
                                    )}
                                    {playerNoShow && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.10] text-[#dc2626] border border-[#dc2626]/20 text-[11px] font-medium">
                                        불참
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td
                                className={`py-3.5 px-3 text-sm ${
                                  playerNoShow
                                    ? "text-[#737373] line-through"
                                    : "text-[#525252]"
                                }`}
                              >
                                {playerGym || "무소속 / 개인"}
                              </td>

                              {/* 신장(cm) / 체중(kg) 분리 입력란 + 저장 버튼 */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="relative flex items-center">
                                    <Input
                                      value={height}
                                      disabled={playerNoShow}
                                      placeholder="신장"
                                      onFocus={() => {
                                        focusedPlayerKeyRef.current = entryKey;
                                      }}
                                      onBlur={() => {
                                        if (
                                          focusedPlayerKeyRef.current ===
                                          entryKey
                                        ) {
                                          focusedPlayerKeyRef.current = null;
                                        }
                                      }}
                                      onChange={(e) =>
                                        onHeightChange(entryKey, e.target.value)
                                      }
                                      className={`w-24 h-9 text-sm font-medium font-mono tabular-nums pr-7 text-center rounded-[8px] transition-colors duration-150 ${
                                        playerNoShow
                                          ? "bg-[#f4f4f5] text-[#737373] border-[#171717]/[0.08]"
                                          : "border-[#171717]/[0.14] focus:border-[#2563eb] bg-[#ffffff] text-[#171717]"
                                      }`}
                                    />
                                    <span className="absolute right-2 text-[11px] text-[#737373] pointer-events-none">
                                      cm
                                    </span>
                                  </div>

                                  <span className="text-[#737373] text-sm">
                                    /
                                  </span>

                                  <div className="relative flex items-center">
                                    <Input
                                      value={weight}
                                      disabled={playerNoShow}
                                      placeholder="체중"
                                      onFocus={() => {
                                        focusedPlayerKeyRef.current = entryKey;
                                      }}
                                      onBlur={() => {
                                        if (
                                          focusedPlayerKeyRef.current ===
                                          entryKey
                                        ) {
                                          focusedPlayerKeyRef.current = null;
                                        }
                                      }}
                                      onChange={(e) =>
                                        onWeightChange(entryKey, e.target.value)
                                      }
                                      className={`w-24 h-9 text-sm font-medium font-mono tabular-nums pr-7 text-center rounded-[8px] transition-colors duration-150 ${
                                        playerNoShow
                                          ? "bg-[#f4f4f5] text-[#737373] border-[#171717]/[0.08]"
                                          : "border-[#171717]/[0.14] focus:border-[#2563eb] bg-[#ffffff] text-[#171717]"
                                      }`}
                                    />
                                    <span className="absolute right-2 text-[11px] text-[#737373] pointer-events-none">
                                      kg
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={playerNoShow}
                                    onClick={() => onSavePlayerWeighIn(player)}
                                    className={`inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-[8px] font-medium text-xs transition-colors duration-150 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                                      isWeighedIn && !playerNoShow
                                        ? "bg-[#16a34a]/[0.10] hover:bg-[#16a34a]/[0.16] text-[#16a34a] border border-[#16a34a]/25"
                                        : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white border border-transparent"
                                    }`}
                                  >
                                    {isWeighedIn && !playerNoShow ? (
                                      <>
                                        <Check size={14} strokeWidth={1.75} />
                                        <span>계측 완료</span>
                                      </>
                                    ) : (
                                      <>
                                        <Save size={14} strokeWidth={1.5} />
                                        <span>계측 저장</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* 월체 체크 */}
                              <td className="py-3.5 px-3 text-center">
                                <Checkbox
                                  checked={isGradeChanged}
                                  disabled={playerNoShow}
                                  onChange={(e) =>
                                    onGradeChange(
                                      e,
                                      categoryId,
                                      gradeId,
                                      gradeTitle,
                                      entryKey
                                    )
                                  }
                                />
                              </td>

                              {/* 불참 체크박스 */}
                              <td className="py-3.5 px-3 text-center">
                                <Checkbox
                                  checked={playerNoShow}
                                  onChange={(e) =>
                                    onNoShowChange(playerNumber, entryKey, e)
                                  }
                                />
                              </td>

                              <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => onOpenNumberModal(player)}
                                  className="inline-flex items-center justify-center gap-1 h-8 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#525252] hover:text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <Pencil
                                    size={13}
                                    strokeWidth={1.5}
                                    className="shrink-0"
                                  />
                                  <span className="whitespace-nowrap">
                                    수정
                                  </span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* 모바일 카드 뷰 */
                <div className="p-3 space-y-2.5">
                  {[...matchedPlayers]
                    .sort(
                      (a, b) =>
                        getStagePlayerSortIndex(a, matched) -
                        getStagePlayerSortIndex(b, matched)
                    )
                    .map((player) => {
                      const {
                        playerName,
                        playerGym,
                        playerUid,
                        playerNumber,
                        playerNoShow,
                        isGradeChanged,
                        isWeighedIn,
                        heightWeight,
                      } = player;

                      const entryKey = getPlayerEntryKey(player);
                      const { height, weight } =
                        parseHeightWeightValue(heightWeight);
                      const mPhotos = extractPlayerPhotos(player);

                      return (
                        <div
                          key={entryKey || playerUid}
                          className={`p-3.5 rounded-[8px] border ${
                            playerNoShow
                              ? "bg-[#dc2626]/[0.04] border-[#dc2626]/25"
                              : isWeighedIn
                              ? "bg-[#16a34a]/[0.03] border-[#16a34a]/25"
                              : "bg-[#ffffff] border-[#171717]/[0.08]"
                          } space-y-3`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {mPhotos.length > 0 ? (
                                <img
                                  src={
                                    player.stagePhoto1 ||
                                    player.stagePhotoUrl1 ||
                                    player.stagePhotoUrl ||
                                    mPhotos[0]
                                  }
                                  alt={playerName}
                                  onClick={() => onOpenPhotoModal(player)}
                                  className="w-10 h-10 rounded-[8px] object-cover border border-[#171717]/[0.14] shrink-0 cursor-pointer"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onOpenPhotoModal(player)}
                                  className="w-10 h-10 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#737373] flex items-center justify-center shrink-0 cursor-pointer"
                                >
                                  <User size={16} strokeWidth={1.5} />
                                </button>
                              )}
                              <BibTag
                                number={playerNumber}
                                variant={
                                  isWeighedIn && !playerNoShow
                                    ? "active"
                                    : "default"
                                }
                                className={
                                  playerNoShow ? "line-through opacity-50" : ""
                                }
                              />
                              <span
                                className={`font-medium text-sm ${
                                  playerNoShow
                                    ? "line-through text-[#dc2626]"
                                    : "text-[#171717]"
                                }`}
                              >
                                {playerName}
                              </span>
                              {isGradeChanged && !playerNoShow && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] text-[11px] font-medium">
                                  월체
                                </span>
                              )}
                              {playerNoShow && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.10] text-[#dc2626] text-[11px] font-medium">
                                  불참
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => onOpenNumberModal(player)}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#525252] border border-[#171717]/[0.12] cursor-pointer"
                            >
                              <Pencil size={14} strokeWidth={1.5} />
                            </button>
                          </div>

                          <div className="text-xs text-[#525252]">
                            소속: {playerGym || "개인 / 무소속"}
                          </div>

                          <div className="flex items-center gap-2 bg-[#fafafa] p-2.5 rounded-[8px] border border-[#171717]/[0.08]">
                            <div className="relative flex-1 flex items-center">
                              <Input
                                value={height}
                                disabled={playerNoShow}
                                placeholder="신장"
                                onFocus={() => {
                                  focusedPlayerKeyRef.current = entryKey;
                                }}
                                onBlur={() => {
                                  if (
                                    focusedPlayerKeyRef.current === entryKey
                                  ) {
                                    focusedPlayerKeyRef.current = null;
                                  }
                                }}
                                onChange={(e) =>
                                  onHeightChange(entryKey, e.target.value)
                                }
                                className="h-9 text-sm font-medium font-mono tabular-nums text-center pr-7 rounded-[8px] border-[#171717]/[0.14] bg-[#ffffff]"
                              />
                              <span className="absolute right-2 text-[11px] text-[#737373] pointer-events-none">
                                cm
                              </span>
                            </div>
                            <span className="text-[#737373] text-sm">/</span>
                            <div className="relative flex-1 flex items-center">
                              <Input
                                value={weight}
                                disabled={playerNoShow}
                                placeholder="체중"
                                onFocus={() => {
                                  focusedPlayerKeyRef.current = entryKey;
                                }}
                                onBlur={() => {
                                  if (
                                    focusedPlayerKeyRef.current === entryKey
                                  ) {
                                    focusedPlayerKeyRef.current = null;
                                  }
                                }}
                                onChange={(e) =>
                                  onWeightChange(entryKey, e.target.value)
                                }
                                className="h-9 text-sm font-medium font-mono tabular-nums text-center pr-7 rounded-[8px] border-[#171717]/[0.14] bg-[#ffffff]"
                              />
                              <span className="absolute right-2 text-[11px] text-[#737373] pointer-events-none">
                                kg
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={playerNoShow}
                              onClick={() => onSavePlayerWeighIn(player)}
                              className={`inline-flex items-center justify-center gap-1 px-3 h-9 rounded-[8px] font-medium text-xs transition-colors duration-150 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                                isWeighedIn && !playerNoShow
                                  ? "bg-[#16a34a]/[0.10] text-[#16a34a] border border-[#16a34a]/25"
                                  : "bg-[#2563eb] text-white border border-transparent"
                              }`}
                            >
                              {isWeighedIn && !playerNoShow
                                ? "계측 완료"
                                : "계측 저장"}
                            </button>
                          </div>

                          <div className="flex items-center justify-end gap-4 pt-2 border-t border-[#171717]/[0.06]">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-[#525252] cursor-pointer">
                              <Checkbox
                                checked={isGradeChanged}
                                disabled={playerNoShow}
                                onChange={(e) =>
                                  onGradeChange(
                                    e,
                                    categoryId,
                                    gradeId,
                                    gradeTitle,
                                    entryKey
                                  )
                                }
                              />
                              <span>월체</span>
                            </label>

                            <label className="flex items-center gap-1.5 text-xs font-medium text-[#dc2626] cursor-pointer">
                              <Checkbox
                                checked={playerNoShow}
                                onChange={(e) =>
                                  onNoShowChange(playerNumber, entryKey, e)
                                }
                              />
                              <span>불참</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default WeighInGradeSectionList;
