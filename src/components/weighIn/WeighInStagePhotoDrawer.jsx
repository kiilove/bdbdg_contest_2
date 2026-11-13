import React from "react";
import { Drawer } from "antd";
import { Image, ArrowLeftRight, Trash2, Plus, Save } from "lucide-react";
import BibTag from "../ui/BibTag";
import { extractPlayerPhotos, isNonPlayerUrl } from "../../utils/playerPhotoUtils";

const WeighInStagePhotoDrawer = ({
  open,
  onClose,
  player,
  onSwapStageSlots,
  onClearStageSlot,
  onAssignStageSlot,
  onSetStageSlot,
  onConfirmSave,
}) => {
  return (
    <Drawer
      placement="right"
      width={720}
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-[#171717]">
          <Image size={16} strokeWidth={1.5} className="text-[#525252]" />
          <span className="font-semibold text-sm text-[#171717]">
            무대 송출용 사진 지정 ({player?.playerName})
          </span>
        </div>
      }
      footer={null}
      destroyOnClose
    >
      {player &&
        (() => {
          const photos = extractPlayerPhotos(player);
          const stage1 =
            (!isNonPlayerUrl(player.stagePhoto1) && player.stagePhoto1) ||
            (!isNonPlayerUrl(player.stagePhotoUrl1) && player.stagePhotoUrl1) ||
            "";
          const stage2 =
            (!isNonPlayerUrl(player.stagePhoto2) && player.stagePhoto2) ||
            (!isNonPlayerUrl(player.stagePhotoUrl2) && player.stagePhotoUrl2) ||
            "";

          return (
            <div className="flex flex-col gap-4 py-1">
              {/* 선수 기본 정보 */}
              <div className="flex items-center justify-between bg-[#f4f4f5] px-3.5 py-2.5 rounded-[8px] border border-[#171717]/[0.08] text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[#737373]">배부번호</span>
                  <BibTag number={player.playerNumber || "-"} size="sm" />
                  <span className="text-[#171717]/[0.15]">|</span>
                  <span className="text-[#737373]">소속</span>
                  <span className="font-medium text-[#171717]">
                    {player.playerGym || "개인 / 무소속"}
                  </span>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#ffffff] border border-[#171717]/[0.08] text-[11px] font-medium text-[#525252] tabular-nums">
                  {photos.length > 0
                    ? `등록 사진 ${photos.length}장`
                    : "사진 미등록"}
                </span>
              </div>

              {/* 1. 무대용 사진 1, 2 슬롯 섹션 */}
              <div className="bg-[#f4f4f5] rounded-[12px] p-4 border border-[#171717]/[0.08] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[#171717] font-semibold text-xs">
                    무대 공식 송출 지정 사진 (슬롯 1 · 슬롯 2)
                  </span>
                  <button
                    type="button"
                    onClick={onSwapStageSlots}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#fafafa] text-[#171717] text-xs font-medium border border-[#171717]/[0.12] cursor-pointer transition-colors duration-150"
                  >
                    <ArrowLeftRight
                      size={14}
                      strokeWidth={1.5}
                      className="text-[#525252]"
                    />
                    <span>1번 · 2번 맞바꾸기</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* 슬롯 1: 무대용 사진 1 */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-xs font-medium text-[#171717] flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-[4px] bg-[#2563eb] text-white text-[10px] font-mono tabular-nums">
                          1
                        </span>
                        <span>무대용 사진 1 (전면 메인)</span>
                      </span>
                      {stage1 && (
                        <button
                          type="button"
                          onClick={() => onClearStageSlot(1)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#dc2626]/[0.08] hover:bg-[#dc2626]/[0.14] text-[#dc2626] text-[11px] font-medium border border-[#dc2626]/20 cursor-pointer transition-colors duration-150"
                        >
                          <Trash2 size={12} strokeWidth={1.5} />
                          <span>비우기</span>
                        </button>
                      )}
                    </div>

                    {stage1 ? (
                      <div className="relative h-48 rounded-[8px] overflow-hidden bg-[#141415] border border-[#2563eb]/60 flex items-center justify-center">
                        <img
                          src={stage1}
                          alt="무대용 사진 1"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center">
                          <span className="text-white text-[11px] font-medium">
                            1번 전면 메인 송출용
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-48 rounded-[8px] border border-dashed border-[#171717]/[0.16] bg-[#ffffff] flex flex-col items-center justify-center p-4 text-center gap-1.5">
                        <Plus
                          size={18}
                          strokeWidth={1.5}
                          className="text-[#737373]"
                        />
                        <span className="text-xs font-medium text-[#525252]">
                          무대용 사진 1 비어 있음
                        </span>
                        <span className="text-[11px] text-[#737373]">
                          하단 갤러리에서 1번 지정을 선택하세요
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 슬롯 2: 무대용 사진 2 */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-xs font-medium text-[#171717] flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-[4px] bg-[#16a34a] text-white text-[10px] font-mono tabular-nums">
                          2
                        </span>
                        <span>무대용 사진 2 (배경 와이드)</span>
                      </span>
                      {stage2 && (
                        <button
                          type="button"
                          onClick={() => onClearStageSlot(2)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#dc2626]/[0.08] hover:bg-[#dc2626]/[0.14] text-[#dc2626] text-[11px] font-medium border border-[#dc2626]/20 cursor-pointer transition-colors duration-150"
                        >
                          <Trash2 size={12} strokeWidth={1.5} />
                          <span>비우기</span>
                        </button>
                      )}
                    </div>

                    {stage2 ? (
                      <div className="relative h-48 rounded-[8px] overflow-hidden bg-[#141415] border border-[#16a34a]/60 flex items-center justify-center">
                        <img
                          src={stage2}
                          alt="무대용 사진 2"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center">
                          <span className="text-white text-[11px] font-medium">
                            2번 배경 와이드 송출용
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-48 rounded-[8px] border border-dashed border-[#171717]/[0.16] bg-[#ffffff] flex flex-col items-center justify-center p-4 text-center gap-1.5">
                        <Plus
                          size={18}
                          strokeWidth={1.5}
                          className="text-[#737373]"
                        />
                        <span className="text-xs font-medium text-[#525252]">
                          무대용 사진 2 비어 있음
                        </span>
                        <span className="text-[11px] text-[#737373]">
                          하단 갤러리에서 2번 지정을 선택하세요
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. 전체 선수 등록 사진 갤러리 */}
              {photos.length === 0 ? (
                <div className="p-8 text-center bg-[#fafafa] rounded-[12px] border border-dashed border-[#171717]/[0.14] space-y-1.5">
                  <Image
                    size={24}
                    strokeWidth={1.5}
                    className="text-[#737373] mx-auto"
                  />
                  <h3 className="text-sm font-medium text-[#525252] m-0">
                    참가신청서에 등록된 사진이 없습니다.
                  </h3>
                  <p className="text-xs text-[#737373] m-0">
                    상단의 사진데이터 갱신 버튼으로 신청서 원본과 동기화할 수 있습니다.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-xs text-[#525252] mb-2.5 flex items-center justify-between flex-wrap gap-1">
                    <span className="text-xs font-semibold text-[#171717] tabular-nums">
                      선수 등록 사진 갤러리 ({photos.length}장)
                    </span>
                    <span className="text-xs text-[#737373]">
                      1번 지정 또는 2번 지정 선택 시 즉시 저장됩니다
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto p-0.5">
                    {photos.map((imgUrl, i) => {
                      const isSlot1 = imgUrl === stage1;
                      const isSlot2 = imgUrl === stage2;

                      return (
                        <div
                          key={i}
                          className={`flex flex-col rounded-[8px] border overflow-hidden transition-colors duration-150 bg-[#ffffff] ${
                            isSlot1
                              ? "border-[#2563eb] ring-1 ring-[#2563eb]/30"
                              : isSlot2
                              ? "border-[#16a34a] ring-1 ring-[#16a34a]/30"
                              : "border-[#171717]/[0.10] hover:border-[#171717]/[0.24]"
                          }`}
                        >
                          <div
                            onClick={() => onAssignStageSlot(imgUrl)}
                            className="relative h-28 bg-[#141415] cursor-pointer flex items-center justify-center overflow-hidden"
                          >
                            <img
                              src={imgUrl}
                              alt={`사진 ${i + 1}`}
                              className="w-full h-full object-cover"
                            />

                            {isSlot1 && (
                              <div className="absolute top-1.5 left-1.5 bg-[#2563eb] text-white text-[10px] font-medium px-1.5 py-0.5 rounded-[4px]">
                                1번 지정됨
                              </div>
                            )}
                            {isSlot2 && (
                              <div className="absolute top-1.5 left-1.5 bg-[#16a34a] text-white text-[10px] font-medium px-1.5 py-0.5 rounded-[4px]">
                                2번 지정됨
                              </div>
                            )}
                          </div>

                          {/* 1번 / 2번 직접 지정 버튼 */}
                          <div className="grid grid-cols-2 gap-1 p-1.5 bg-[#fafafa] border-t border-[#171717]/[0.06]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetStageSlot(1, imgUrl);
                              }}
                              className={`h-7 px-1 rounded-[4px] text-[11px] font-medium transition-colors duration-150 cursor-pointer border ${
                                isSlot1
                                  ? "bg-[#2563eb] text-white border-[#2563eb]"
                                  : "bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border-[#171717]/[0.10]"
                              }`}
                            >
                              {isSlot1 ? "1번 완료" : "1번 지정"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetStageSlot(2, imgUrl);
                              }}
                              className={`h-7 px-1 rounded-[4px] text-[11px] font-medium transition-colors duration-150 cursor-pointer border ${
                                isSlot2
                                  ? "bg-[#16a34a] text-white border-[#16a34a]"
                                  : "bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border-[#171717]/[0.10]"
                              }`}
                            >
                              {isSlot2 ? "2번 완료" : "2번 지정"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 하단 액션 버튼 바 */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#171717]/[0.08] flex-wrap">
                <div className="text-xs text-[#737373]">
                  선택된 1번·2번 사진이 무대 전광판 및 시상식 화면에 송출됩니다.
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center px-4 h-9 rounded-[8px] text-xs font-medium text-[#171717] bg-[#f4f4f5] hover:bg-[#e4e4e7] border border-[#171717]/[0.08] transition-colors duration-150 cursor-pointer"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={onConfirmSave}
                    className="inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-[8px] font-medium text-xs text-white bg-[#2563eb] hover:bg-[#1d4ed8] transition-colors duration-150 cursor-pointer border-0"
                  >
                    <Save size={15} strokeWidth={1.5} />
                    <span>무대 송출 사진 확정 저장</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </Drawer>
  );
};

export default WeighInStagePhotoDrawer;
