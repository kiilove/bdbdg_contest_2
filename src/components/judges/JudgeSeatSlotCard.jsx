import React from "react";
import { Select } from "antd";
import {
  AlertTriangle,
  Check,
  Crown,
  Phone,
  X,
} from "lucide-react";

/**
 * 심판 좌석 배정 공용 좌석 카드 (부별 · 종목별 · 체급별 공통)
 * - Light Graphite 표면 + 좌석 번호 모노 키캡 시그니처 디테일
 * - 드롭다운 내부에서 심판 소속·위원장 여부·현재 누적 배정 체급 수를 한눈에 비교 가능
 */
export const JudgeSeatSlotCard = ({
  seatNumber,
  status = "empty", // "empty" | "complete" | "partial" | "multi"
  selectValue = "unselect",
  selectedJudgeInfo = null,
  fallbackJudgeName = "",
  isRemovedFromPool = false,
  isHigherSeatOnly = false,
  missingCount = 0,
  multiLabel = "하위 상이",
  breakdownText = "",
  selectableJudges = [],
  workloadByUid = {},
  onSelectChange,
  onClearSeat,
  onFillPartial,
}) => {
  const seatLabel = String(seatNumber).padStart(2, "0");
  const isOccupied =
    status === "complete" ||
    status === "partial" ||
    status === "multi" ||
    isRemovedFromPool;

  // 표면 및 키캡 상태 스타일 (단일 뉴트럴 램프 + 절제된 시맨틱 역할)
  const cardSurfaceCls = isRemovedFromPool
    ? "bg-[#dc2626]/[0.03] border-[#dc2626]/30 border-solid"
    : status === "partial"
    ? "bg-[#b45309]/[0.03] border-[#b45309]/30 border-solid"
    : status === "multi"
    ? "bg-[#2563eb]/[0.03] border-[#2563eb]/25 border-solid"
    : status === "complete"
    ? "bg-[#ffffff] border-[#171717]/[0.10] border-solid hover:border-[#171717]/[0.18]"
    : "bg-[#fafafa] border-[#171717]/[0.14] border-dashed hover:border-[#171717]/[0.24] hover:bg-[#f4f4f5]/60";

  const keycapCls = isRemovedFromPool
    ? "bg-[#dc2626] text-white border-[#dc2626]"
    : status === "partial"
    ? "bg-[#b45309] text-white border-[#b45309]"
    : status === "multi"
    ? "bg-[#2563eb] text-white border-[#2563eb]"
    : status === "complete"
    ? "bg-[#171717] text-white border-[#171717]"
    : "bg-white text-[#737373] border-[#171717]/[0.14]";

  const currentWorkload = selectedJudgeInfo?.judgeUid
    ? workloadByUid[selectedJudgeInfo.judgeUid]?.gradeCount || 0
    : 0;

  return (
    <div
      className={`rounded-[10px] border p-3 flex flex-col justify-between gap-2.5 transition-colors duration-150 ${cardSurfaceCls}`}
    >
      {/* 상단: 좌석 번호 키캡 + 상태 배지 + 빠른 동작 */}
      <div className="flex items-center justify-between gap-2 min-h-[26px]">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span
            className={`inline-flex items-center justify-center h-6 min-w-[30px] px-1.5 rounded-[5px] border font-mono text-xs font-semibold tabular-nums select-none ${keycapCls}`}
          >
            {seatLabel}
          </span>
          <span className="text-xs font-medium text-[#525252] tabular-nums">
            {seatNumber}번석
          </span>

          {isHigherSeatOnly && (
            <span className="px-1.5 py-0.5 rounded-[4px] text-[11px] font-mono tabular-nums bg-[#f4f4f5] text-[#737373] border border-[#171717]/[0.06]">
              {seatNumber}심+ 전용
            </span>
          )}

          {status === "multi" && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#2563eb]/[0.10] text-[#2563eb]">
              <AlertTriangle size={11} strokeWidth={1.6} />
              <span>{multiLabel}</span>
            </span>
          )}

          {status === "partial" && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#b45309]/[0.10] text-[#b45309] tabular-nums">
              <AlertTriangle size={11} strokeWidth={1.6} />
              <span>누락 {missingCount}체급</span>
            </span>
          )}

          {isRemovedFromPool && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#dc2626]/[0.10] text-[#dc2626]">
              <AlertTriangle size={11} strokeWidth={1.6} />
              <span>선발 해제됨</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {status === "partial" && onFillPartial && !isRemovedFromPool && (
            <button
              type="button"
              onClick={onFillPartial}
              title="누락된 하위 체급에도 이 심판을 동일하게 채웁니다"
              className="h-6 px-2 rounded-[5px] bg-[#b45309] hover:bg-[#92400e] text-white text-[11px] font-medium inline-flex items-center gap-1 transition-colors duration-150 cursor-pointer border-0"
            >
              <Check size={11} strokeWidth={1.8} />
              <span>누락 채우기</span>
            </button>
          )}

          {isOccupied && onClearSeat && (
            <button
              type="button"
              onClick={onClearSeat}
              title={`${seatNumber}번석 배정 해제`}
              aria-label={`${seatNumber}번석 배정 해제`}
              className="w-6 h-6 rounded-[5px] inline-flex items-center justify-center text-[#737373] hover:text-[#dc2626] hover:bg-[#dc2626]/[0.08] transition-colors duration-150 cursor-pointer bg-transparent border-0"
            >
              <X size={13} strokeWidth={1.6} />
            </button>
          )}
        </div>
      </div>

      {/* 중단: 검색형 심판 선택 드롭다운 */}
      <Select
        showSearch
        allowClear={false}
        optionLabelProp="label"
        placeholder="심판 선택"
        popupMatchSelectWidth={false}
        dropdownStyle={{ minWidth: 300 }}
        className="w-full"
        value={selectValue}
        filterOption={(input, option) => {
          const hay = (
            option?.["data-search"] ||
            option?.props?.["data-search"] ||
            ""
          )
            .toString()
            .toLowerCase();
          return hay.includes((input || "").trim().toLowerCase());
        }}
        onChange={onSelectChange}
      >
        <Select.Option
          value="unselect"
          label={<span className="text-[#737373]">미배정 (비워두기)</span>}
          data-search="미배정 선택안함 비우기"
        >
          <span className="text-xs text-[#737373]">미배정 (좌석 비우기)</span>
        </Select.Option>

        {status === "multi" && (
          <Select.Option
            value="__MULTI__"
            label={
              <span className="text-[#2563eb] font-medium">
                개별 배정됨 ({breakdownText})
              </span>
            }
            data-search={breakdownText}
          >
            <div className="text-xs text-[#2563eb] font-medium py-0.5">
              하위 개별 배정 유지 ({breakdownText})
            </div>
          </Select.Option>
        )}

        {isRemovedFromPool && selectValue && selectValue !== "unselect" && (
          <Select.Option
            value={selectValue}
            label={
              <span className="text-[#dc2626] font-medium">
                [선발 해제됨] {fallbackJudgeName || selectValue}
              </span>
            }
            data-search={fallbackJudgeName}
          >
            <span className="text-xs text-[#dc2626] font-medium">
              [선발 해제됨] {fallbackJudgeName || selectValue}
            </span>
          </Select.Option>
        )}

        {selectableJudges.map((judge) => {
          const jStats = workloadByUid[judge.judgeUid];
          const gCount = jStats?.gradeCount || 0;
          const closedLabel = (
            <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
              <span className="font-medium text-[#171717]">
                {judge.judgeName}
              </span>
              {judge.isHead && (
                <span className="text-[11px] font-medium text-[#b45309]">
                  위원장
                </span>
              )}
              {judge.judgePromoter && (
                <span className="text-xs text-[#737373] truncate">
                  · {judge.judgePromoter}
                </span>
              )}
            </span>
          );
          const searchBlob = `${judge.judgeName || ""} ${
            judge.judgePromoter || ""
          } ${judge.judgeTel || ""} ${judge.isHead ? "위원장" : ""}`;

          return (
            <Select.Option
              key={judge.judgeUid}
              value={judge.judgeUid}
              label={closedLabel}
              data-search={searchBlob}
            >
              <div className="flex items-center justify-between gap-3 py-0.5">
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="text-sm font-medium text-[#171717] truncate">
                    {judge.judgeName}
                  </span>
                  {judge.isHead && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] text-[10px] font-medium shrink-0">
                      <Crown size={10} strokeWidth={1.5} />
                      <span>위원장</span>
                    </span>
                  )}
                  <span className="text-xs text-[#737373] truncate">
                    {judge.judgePromoter || "-"}
                  </span>
                </div>
                <span
                  className={`font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded-[4px] shrink-0 ${
                    gCount === 0
                      ? "bg-[#f4f4f5] text-[#737373]"
                      : "bg-[#2563eb]/[0.08] text-[#2563eb] font-medium"
                  }`}
                >
                  {gCount}체급
                </span>
              </div>
            </Select.Option>
          );
        })}
      </Select>

      {/* 하단: 선택 심판 메타데이터 또는 다중 배정 내역 */}
      <div className="min-h-[18px] flex items-center justify-between gap-2 text-xs">
        {status === "multi" ? (
          <span
            className="text-[11px] text-[#525252] truncate"
            title={breakdownText}
          >
            내역: {breakdownText}
          </span>
        ) : selectedJudgeInfo ? (
          <>
            <div className="flex items-center gap-2 min-w-0 text-[#525252]">
              {selectedJudgeInfo.isHead && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] text-[11px] font-medium shrink-0">
                  <Crown size={10} strokeWidth={1.5} />
                  <span>위원장</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-[#737373] truncate">
                <Phone size={11} strokeWidth={1.5} className="shrink-0" />
                <span>{selectedJudgeInfo.judgeTel || "-"}</span>
              </span>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-[#737373] shrink-0">
              누적 {currentWorkload}체급
            </span>
          </>
        ) : isRemovedFromPool ? (
          <span className="text-[11px] text-[#dc2626]">
            선발 명단에서 제외된 심판입니다. 다른 심판으로 교체하세요.
          </span>
        ) : (
          <span className="text-[11px] text-[#737373]">
            좌석이 비어 있습니다
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * 섹션(부) 필터 필 바 — AntD 중첩 밑줄 탭 대신 정돈된 세그먼트 필 사용
 */
export const SectionFilterBar = ({
  items = [], // [{ key, label, count, hasGap }]
  activeKey,
  onChange,
}) => {
  if (!items || items.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
      {items.map((item) => {
        const isActive = activeKey === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`h-8 px-3 rounded-[8px] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors duration-150 cursor-pointer border ${
              isActive
                ? "bg-[#171717] text-white border-[#171717]"
                : "bg-white text-[#525252] border-[#171717]/[0.10] hover:bg-[#f4f4f5] hover:text-[#171717]"
            }`}
          >
            {item.hasGap && (
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isActive ? "bg-[#f87171]" : "bg-[#dc2626]"
                }`}
                title="미배정 좌석 있음"
              />
            )}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={`font-mono text-[11px] tabular-nums px-1.5 py-0 rounded-[4px] ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "bg-[#f4f4f5] text-[#737373]"
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default JudgeSeatSlotCard;
