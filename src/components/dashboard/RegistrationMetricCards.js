import React from "react";
import { Popover } from "antd";
import dayjs from "dayjs";

const formatWon = (amount) => {
  const num = Number(amount) || 0;
  if (num >= 10000) {
    const man = num / 10000;
    return Number.isInteger(man)
      ? `${man.toLocaleString()}만원`
      : `${man.toFixed(1)}만원`;
  }
  return `${num.toLocaleString()}원`;
};

const RegistrationMetricCards = ({
  activeInvoicesCount = 0,
  confirmedInvoicesCount = 0,
  unconfirmedInvoicesCount = 0,
  canceledInvoicesCount = 0,
  confirmedPlayersCount = 0,
  totalUniqueAthletes = 0,
  totalEntries = 0,
  pendingEntries = 0,
  confirmedFeeTotal = 0,
  expectedFeeTotal = 0,
  regularCategoriesCount = 0,
  regularGradesCount = 0,
  emptyGradesList = [],
  noRegistrationCategories = [],
  judgesCount = 0,
  contestDate,
  startPlayerNumber = 1,
}) => {
  const formatDDay = (dateStr) => {
    if (!dateStr) {
      return { figure: "일정 미정", sub: "대회 일자 미등록" };
    }
    const target = dayjs(dateStr, "YYYY-MM-DD", true);
    if (!target.isValid()) {
      return { figure: dateStr, sub: "대회 일자 확인" };
    }
    const diff = target.startOf("day").diff(dayjs().startOf("day"), "day");
    if (diff === 0) {
      return { figure: "D-Day", sub: "금일 대회 개최" };
    }
    if (diff > 0) {
      return { figure: `D-${diff}`, sub: `${dateStr} 개최 예정` };
    }
    return { figure: `D+${Math.abs(diff)}`, sub: `${dateStr} 개최 완료` };
  };

  const dDayInfo = formatDDay(contestDate);

  const confirmationRate =
    activeInvoicesCount > 0
      ? Math.round((confirmedInvoicesCount / activeInvoicesCount) * 100)
      : 0;

  const avgEntriesPerAthlete =
    confirmedPlayersCount > 0
      ? (totalEntries / confirmedPlayersCount).toFixed(1)
      : "0.0";

  const pendingFeeTotal = Math.max(0, expectedFeeTotal - confirmedFeeTotal);
  const activeGradesCount = Math.max(
    0,
    regularGradesCount - emptyGradesList.length
  );

  return (
    <section
      aria-label="대회 전반 핵심 데이터"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5"
    >
      {/* 1. 참가신청서 접수 현황 */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-4 flex flex-col justify-between gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs leading-4 font-medium text-[#525252]">
            총 유효 접수
          </span>
          <span
            className={`font-mono text-xs leading-4 font-medium tabular-nums ${
              unconfirmedInvoicesCount > 0 ? "text-[#b45309]" : "text-[#16a34a]"
            }`}
          >
            {unconfirmedInvoicesCount > 0
              ? `미확정 ${unconfirmedInvoicesCount}건`
              : "전원 확정"}
          </span>
        </div>
        <div>
          <div className="flex items-baseline gap-1 tabular-nums">
            <span className="text-[26px] leading-none font-semibold text-[#171717] font-mono">
              {activeInvoicesCount}
            </span>
            <span className="text-xs leading-4 text-[#737373]">건 신청</span>
          </div>
          <div className="text-xs leading-4 text-[#737373] tabular-nums mt-2">
            확정 {confirmedInvoicesCount} · 대기 {unconfirmedInvoicesCount} · 취소{" "}
            {canceledInvoicesCount}
          </div>
        </div>
      </div>

      {/* 2. 선수 실인원 현황 */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-4 flex flex-col justify-between gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs leading-4 font-medium text-[#525252]">
            출전 선수 (실인원)
          </span>
          <span className="font-mono text-xs leading-4 text-[#2563eb] font-medium tabular-nums">
            확정 {confirmationRate}%
          </span>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-[26px] leading-none font-semibold text-[#171717] font-mono">
              {confirmedPlayersCount}
            </span>
            <span className="text-xs leading-4 text-[#737373]">
              / 신청 {totalUniqueAthletes}명
            </span>
          </div>
          <div className="text-xs leading-4 text-[#737373] tabular-nums mt-2">
            입금 확인 완료 선수 기준
          </div>
        </div>
      </div>

      {/* 3. 체급 엔트리 연인원 */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-4 flex flex-col justify-between gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs leading-4 font-medium text-[#525252]">
            총 출전 엔트리
          </span>
          <span className="font-mono text-xs leading-4 text-[#737373] tabular-nums">
            평균 {avgEntriesPerAthlete}종목
          </span>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-[26px] leading-none font-semibold text-[#171717] font-mono">
              {totalEntries}
            </span>
            <span className="text-xs leading-4 text-[#737373]">
              체급 (연인원)
            </span>
          </div>
          <div className="text-xs leading-4 text-[#737373] tabular-nums mt-2">
            {pendingEntries > 0
              ? `미확정 대기 +${pendingEntries}건 별도`
              : "중복 출전 포함 확정 엔트리"}
          </div>
        </div>
      </div>

      {/* 4. 참가비 정산 요약 */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-4 flex flex-col justify-between gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs leading-4 font-medium text-[#525252]">
            참가비 입금 현황
          </span>
          <span className="font-mono text-xs leading-4 text-[#16a34a] font-medium tabular-nums">
            {expectedFeeTotal > 0
              ? `${Math.round((confirmedFeeTotal / expectedFeeTotal) * 100)}%`
              : "0%"}
          </span>
        </div>
        <div>
          <div className="text-[24px] leading-none font-semibold text-[#171717] font-mono tabular-nums truncate">
            {formatWon(confirmedFeeTotal)}
          </div>
          <div className="text-xs leading-4 text-[#737373] tabular-nums mt-2 truncate">
            총 신청 {formatWon(expectedFeeTotal)} · 대기 {formatWon(pendingFeeTotal)}
          </div>
        </div>
      </div>

      {/* 5. 종목 · 체급 개설 및 미달 현황 */}
      <Popover
        placement="bottomRight"
        trigger="hover"
        content={
          emptyGradesList.length > 0 || noRegistrationCategories.length > 0 ? (
            <div className="w-72 max-h-64 overflow-y-auto p-1 space-y-2">
              {noRegistrationCategories.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-[#171717] pb-1 border-b border-[#171717]/[0.08]">
                    신청자 0명 종목 ({noRegistrationCategories.length}개)
                  </div>
                  <ul className="mt-1 space-y-0.5 m-0 p-0 list-none">
                    {noRegistrationCategories.map((c) => (
                      <li
                        key={c.contestCategoryId || c.contestCategoryTitle}
                        className="text-xs text-[#525252] truncate py-0.5"
                      >
                        · {c.contestCategoryTitle}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {emptyGradesList.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-[#171717] pb-1 border-b border-[#171717]/[0.08]">
                    신청자 0명 체급 ({emptyGradesList.length}개)
                  </div>
                  <ul className="mt-1 space-y-0.5 m-0 p-0 list-none">
                    {emptyGradesList.slice(0, 15).map((g, idx) => (
                      <li
                        key={g.contestGradeId || idx}
                        className="text-xs text-[#525252] truncate py-0.5"
                      >
                        · {g.categoryTitle} — {g.contestGradeTitle}
                      </li>
                    ))}
                    {emptyGradesList.length > 15 && (
                      <li className="text-[11px] text-[#737373] pt-0.5">
                        외 {emptyGradesList.length - 15}개 체급
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-[#525252] p-1">
              모든 정규 종목 및 체급에 신청 선수가 등록되어 있습니다
            </div>
          )
        }
      >
        <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] hover:border-[#171717]/[0.18] transition-colors duration-150 p-4 flex flex-col justify-between gap-2.5 cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs leading-4 font-medium text-[#525252]">
              체급 접수 충원
            </span>
            <span className="text-xs leading-4 text-[#737373] font-mono tabular-nums">
              {regularCategoriesCount}종목
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 tabular-nums">
              <span className="text-[26px] leading-none font-semibold text-[#171717] font-mono">
                {activeGradesCount}
              </span>
              <span className="text-xs leading-4 text-[#737373]">
                / {regularGradesCount}체급
              </span>
            </div>
            <div
              className={`text-xs leading-4 mt-2 tabular-nums ${
                emptyGradesList.length > 0 ? "text-[#b45309]" : "text-[#737373]"
              }`}
            >
              {emptyGradesList.length > 0
                ? `0명 미달 ${emptyGradesList.length}개 체급 (마우스 오버)`
                : "전 체급 접수 완료"}
            </div>
          </div>
        </div>
      </Popover>

      {/* 6. 대회 일정 및 준비 정보 */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-4 flex flex-col justify-between gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs leading-4 font-medium text-[#525252]">
            대회 일정 · 준비
          </span>
          <span className="font-mono text-xs leading-4 text-[#737373] tabular-nums">
            #{startPlayerNumber}번 시작
          </span>
        </div>
        <div>
          <div className="text-[26px] leading-none font-semibold text-[#171717] font-mono tabular-nums">
            {dDayInfo.figure}
          </div>
          <div className="text-xs leading-4 text-[#737373] mt-2 tabular-nums truncate">
            {dDayInfo.sub} · 심판 {judgesCount}명
          </div>
        </div>
      </div>
    </section>
  );
};

export default RegistrationMetricCards;
