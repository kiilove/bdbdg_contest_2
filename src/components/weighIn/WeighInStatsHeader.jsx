import React from "react";
import { Scale, RefreshCw, AlertTriangle, Save } from "lucide-react";
import { StatusDot } from "../ui/BibTag";
import ConfirmModalTrigger from "../ui/ConfirmModalTrigger";

const WeighInStatsHeader = ({
  contestTitle,
  activePlayersCount,
  totalPlayersCount,
  noShowCount,
  gradeChangedCount,
  isSyncingPhotos,
  hasPlayers,
  onRefreshAndSyncAssign,
  onForceResetToAssign,
  onSyncCleanPhotoData,
  onSavePlayersFinal,
  onNavigateToAssign,
}) => {
  return (
    <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#f4f4f5] text-[#525252] border border-[#171717]/[0.08]">
            <Scale size={13} strokeWidth={1.5} className="text-[#525252]" />
            <span>2단계 계측 데스크</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#16a34a]/[0.08] text-[#16a34a] border border-[#16a34a]/20">
            <StatusDot status="live" live />
            <span>다중 데스크 실시간 자동 동기화</span>
          </span>
          {contestTitle && (
            <span className="text-xs text-[#737373]">{contestTitle}</span>
          )}
        </div>
        <h1 className="text-xl font-semibold text-[#171717] m-0 tracking-tight">
          선수 계측 및 월체·불참 관리
        </h1>
        <p className="text-xs text-[#737373] m-0">
          신장(cm) · 체중(kg) 분리 입력 및 다중 데스크 병합 저장
        </p>
      </div>

      {/* 계측 통계 & 액션 버튼 */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="min-w-[210px] bg-[#fafafa] px-3.5 py-2.5 rounded-[8px] border border-[#171717]/[0.08]">
          <div className="flex items-center justify-between text-xs font-medium text-[#525252] mb-1.5">
            <span>출전 선수 현황</span>
            <span className="font-mono tabular-nums font-semibold text-[#171717]">
              {activePlayersCount} / {totalPlayersCount}명
            </span>
          </div>
          <div className="w-full bg-[#e4e4e7] rounded-[4px] h-1.5 overflow-hidden">
            <div
              className="bg-[#16a34a] h-1.5 rounded-[4px] transition-all duration-300"
              style={{
                width: `${
                  totalPlayersCount > 0
                    ? Math.round((activePlayersCount / totalPlayersCount) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#737373] mt-1.5 gap-3 tabular-nums">
            <span>
              출전{" "}
              <strong className="font-semibold text-[#16a34a]">
                {activePlayersCount}
              </strong>
              명
            </span>
            <span>
              불참{" "}
              <strong className="font-semibold text-[#dc2626]">
                {noShowCount}
              </strong>
              명
            </span>
            <span>
              월체{" "}
              <strong className="font-semibold text-[#b45309]">
                {gradeChangedCount}
              </strong>
              명
            </span>
          </div>
        </div>

        {/* 저장 및 갱신/초기화 버튼 그룹 */}
        <div className="flex flex-wrap items-center gap-2">
          <ConfirmModalTrigger
            variant="warning"
            title="1단계 배정 기준 명단 갱신"
            body="선수 번호 배정 단계의 최신 번호와 명단을 기준으로 계측 명단을 새로 갱신합니다."
            body2="기존에 입력된 계측 기록(신장·체중·월체·불참)은 유지한 채 신규·변경 배정 내역만 동기화됩니다. 진행하시겠습니까?"
            onConfirm={onRefreshAndSyncAssign}
            confirmText="명단 갱신 실행"
            cancelText="취소"
          >
            <button
              type="button"
              title="1단계 배정본 기준으로 명단 최신 갱신"
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] font-medium text-xs border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer"
            >
              <RefreshCw
                size={15}
                strokeWidth={1.5}
                className="text-[#525252]"
              />
              <span>명단 갱신</span>
            </button>
          </ConfirmModalTrigger>

          <ConfirmModalTrigger
            variant="danger"
            title="계측 데이터 초기화"
            body="기존에 기록된 신장·체중, 월체, 불참 내역을 모두 비우고 1단계 선수 번호 배정 원본 상태로 되돌립니다."
            body2="초기화된 계측 기록은 복구할 수 없습니다. 계속 진행하시겠습니까?"
            onConfirm={onForceResetToAssign}
            confirmText="배정본으로 초기화"
            cancelText="취소"
          >
            <button
              type="button"
              title="기존 계측/월체 데이터를 지우고 1단계 번호 배정 원본으로 덮어씁니다."
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#dc2626]/[0.06] hover:bg-[#dc2626]/[0.12] text-[#dc2626] font-medium text-xs border border-[#dc2626]/25 transition-colors duration-150 cursor-pointer"
            >
              <AlertTriangle size={15} strokeWidth={1.5} />
              <span>계측 초기화</span>
            </button>
          </ConfirmModalTrigger>

          <button
            type="button"
            onClick={onSyncCleanPhotoData}
            disabled={isSyncingPhotos}
            title="신청서 원본에서 선수 사진만 정밀 추출하여 계측 명단에 동기화합니다."
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] font-medium text-xs border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              strokeWidth={1.5}
              className={`text-[#525252] ${
                isSyncingPhotos ? "animate-spin" : ""
              }`}
            />
            <span>
              {isSyncingPhotos ? "사진 정리 중..." : "사진데이터 갱신"}
            </span>
          </button>

          {hasPlayers ? (
            <button
              type="button"
              onClick={onSavePlayersFinal}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-xs transition-colors duration-150 cursor-pointer border-0"
            >
              <Save size={16} strokeWidth={1.5} />
              <span>계측 최종명단 저장</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onNavigateToAssign}
              className="inline-flex items-center justify-center h-9 px-3.5 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] font-medium text-xs border border-[#171717]/[0.10] transition-colors duration-150 cursor-pointer"
            >
              선수번호 배정 필요
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeighInStatsHeader;
