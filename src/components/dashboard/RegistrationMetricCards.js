import React from "react";
import { Popover } from "antd";
import dayjs from "dayjs";

const RegistrationMetricCards = ({
  confirmedPlayersCount = 0,
  unconfirmedPlayersCount = 0,
  totalUniqueAthletes = 0,
  totalEntries = 0,
  judgesCount = 0,
  noRegistrationCategories = [],
  contestDate,
}) => {
  const formatDDay = (dateStr) => {
    if (!dateStr) {
      return { figure: "미정", sub: "대회 일자 미등록" };
    }
    const target = dayjs(dateStr, "YYYY-MM-DD", true);
    if (!target.isValid()) {
      return { figure: "미정", sub: "대회 일자 확인 필요" };
    }
    const diff = target.startOf("day").diff(dayjs().startOf("day"), "day");
    if (diff === 0) {
      return { figure: "D-Day", sub: "금일 대회 진행" };
    }
    if (diff > 0) {
      return { figure: `D-${diff}`, sub: "계측 및 경기 예정" };
    }
    return { figure: `D+${Math.abs(diff)}`, sub: "종료된 대회" };
  };

  const dDayInfo = formatDDay(contestDate);

  const confirmationRate =
    totalUniqueAthletes > 0
      ? Math.round((confirmedPlayersCount / totalUniqueAthletes) * 100)
      : 0;

  const avgEntriesPerAthlete =
    confirmedPlayersCount > 0
      ? (totalEntries / confirmedPlayersCount).toFixed(1)
      : "0.0";

  const noPlayersList = noRegistrationCategories || [];
  const noPlayersCount = noPlayersList.length;

  return (
    <section
      aria-label="대회 핵심 지표"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
    >
      {/* 1. 대회 일정 D-Day */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs leading-4 text-[#737373]">대회 일정</span>
          <span className="font-mono text-xs leading-4 text-[#737373] tabular-nums">
            {contestDate || "-"}
          </span>
        </div>
        <div>
          <div className="text-[28px] leading-none font-medium tabular-nums text-[#171717]">
            {dDayInfo.figure}
          </div>
          <div className="text-xs leading-4 text-[#737373] mt-2">
            {dDayInfo.sub}
          </div>
        </div>
      </div>

      {/* 2. 선수 등록 확정 */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs leading-4 text-[#737373]">선수 등록 확정</span>
          <span className="font-mono text-xs leading-4 text-[#16a34a] font-medium tabular-nums">
            {confirmationRate}%
          </span>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-[28px] leading-none font-medium text-[#171717]">
              {confirmedPlayersCount}
            </span>
            <span className="text-sm leading-5 text-[#737373]">
              / {totalUniqueAthletes}명
            </span>
          </div>
          <div className="text-xs leading-4 text-[#737373] tabular-nums mt-2">
            미확정 대기 {unconfirmedPlayersCount}명
          </div>
        </div>
      </div>

      {/* 3. 총 출전 번호표 */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs leading-4 text-[#737373]">총 출전 번호표</span>
          <span className="font-mono text-xs leading-4 text-[#737373] tabular-nums">
            1인당 {avgEntriesPerAthlete}종목
          </span>
        </div>
        <div>
          <div className="flex items-baseline gap-1 tabular-nums">
            <span className="text-[28px] leading-none font-medium text-[#171717]">
              {totalEntries}
            </span>
            <span className="text-sm leading-5 text-[#737373]">건</span>
          </div>
          <div className="text-xs leading-4 text-[#737373] mt-2">
            중복 출전 포함 배부 기준
          </div>
        </div>
      </div>

      {/* 4. 위촉 심판진 */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs leading-4 text-[#737373]">위촉 심판진</span>
          <span className="text-xs leading-4 text-[#737373]">공인 심판</span>
        </div>
        <div>
          <div className="flex items-baseline gap-1 tabular-nums">
            <span className="text-[28px] leading-none font-medium text-[#171717]">
              {judgesCount}
            </span>
            <span className="text-sm leading-5 text-[#737373]">명</span>
          </div>
          <div className="text-xs leading-4 text-[#737373] mt-2">
            위원장 · 주심 · 부심 구성
          </div>
        </div>
      </div>

      {/* 5. 접수 미달 종목 */}
      <Popover
        placement="bottomRight"
        trigger="hover"
        content={
          noPlayersCount > 0 ? (
            <div className="w-64 max-h-60 overflow-y-auto p-1">
              <div className="text-xs leading-4 font-medium text-[#171717] pb-2 mb-2 border-b border-[#171717]/[0.08]">
                신청자 0명 종목 ({noPlayersCount}개 · 그랑프리 제외)
              </div>
              <ul className="space-y-1 m-0 p-0 list-none">
                {noPlayersList.map((c) => (
                  <li
                    key={c.contestCategoryId || c.contestCategoryTitle}
                    className="text-xs leading-5 text-[#525252] py-0.5 truncate"
                  >
                    {c.contestCategoryTitle}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-xs leading-4 text-[#525252] p-1">
              모든 정규 종목에 선수가 등록되어 있습니다
            </div>
          )
        }
      >
        <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] hover:border-[#171717]/[0.16] transition-colors duration-150 p-5 flex flex-col justify-between gap-3 cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs leading-4 text-[#737373]">미달 종목</span>
            <span className="text-xs leading-4 text-[#737373]">
              그랑프리 제외
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1 tabular-nums">
              <span
                className={`text-[28px] leading-none font-medium ${
                  noPlayersCount > 0 ? "text-[#b45309]" : "text-[#171717]"
                }`}
              >
                {noPlayersCount}
              </span>
              <span className="text-sm leading-5 text-[#737373]">종목</span>
            </div>
            <div className="text-xs leading-4 text-[#737373] mt-2">
              {noPlayersCount > 0
                ? "신청자 0명 종목 · 마우스 오버 확인"
                : "모든 정규 종목 등록됨"}
            </div>
          </div>
        </div>
      </Popover>
    </section>
  );
};

export default RegistrationMetricCards;
