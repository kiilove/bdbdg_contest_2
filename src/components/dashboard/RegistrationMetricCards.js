import React from "react";
import { Popover, List } from "antd";
import {
  CalendarOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  TeamOutlined,
  IdcardOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const RegistrationMetricCards = ({
  invoices = [],
  confirmedPlayersCount = 0,
  unconfirmedPlayersCount = 0,
  totalUniqueAthletes = 0,
  totalEntries = 0,
  judgesCount = 0,
  noRegistrationCategories = [],
  contestDate,
}) => {
  // D-Day 계산
  const formatDDay = (dateStr) => {
    if (!dateStr) return { text: "일정 미정", color: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
    const target = dayjs(dateStr, "YYYY-MM-DD", true);
    if (!target.isValid()) return { text: "일정 미정", color: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
    const diff = target.startOf("day").diff(dayjs().startOf("day"), "day");
    if (diff === 0) return { text: "D-DAY 오늘!", color: "text-red-600", bg: "bg-red-50 border-red-200 animate-pulse" };
    if (diff > 0) {
      if (diff <= 3) return { text: `D-${diff}일`, color: "text-rose-600", bg: "bg-rose-50 border-rose-200" };
      if (diff <= 7) return { text: `D-${diff}일`, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" };
      return { text: `D-${diff}일`, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" };
    }
    return { text: `D+${Math.abs(diff)}일 (종료)`, color: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
  };

  const dDayInfo = formatDDay(contestDate);

  // 등록 확정률
  const confirmationRate =
    totalUniqueAthletes > 0
      ? Math.round((confirmedPlayersCount / totalUniqueAthletes) * 100)
      : 0;

  // 1인당 평균 출전 종목 수
  const avgEntriesPerAthlete =
    confirmedPlayersCount > 0
      ? (totalEntries / confirmedPlayersCount).toFixed(1)
      : "1.0";

  // 그랑프리 제외된 미등록 체급 리스트
  const noPlayersList = noRegistrationCategories || [];
  const noPlayersCount = noPlayersList.length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {/* 1. 대회 D-Day */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <CalendarOutlined className="text-blue-500" />
            대회 D-Day
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
            {contestDate || "일정 확인필요"}
          </span>
        </div>
        <div className="mt-3">
          <div className={`text-2xl sm:text-3xl font-black ${dDayInfo.color}`}>
            {dDayInfo.text}
          </div>
          <div className="text-xs text-slate-400 font-medium mt-1">
            계측 및 경기 일정
          </div>
        </div>
      </div>

      {/* 2. 선수 등록 확정률 & 인원 */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <CheckCircleOutlined className="text-emerald-500" />
            선수 등록 확정
          </span>
          <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {confirmationRate}%
          </span>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-800">
              {confirmedPlayersCount}
            </span>
            <span className="text-sm font-bold text-slate-400">
              / 총 {totalUniqueAthletes}명
            </span>
          </div>
          {/* 프로그레스 바 */}
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${confirmationRate}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>미확정 {unconfirmedPlayersCount}명</span>
            <span className="text-emerald-600 font-semibold">확정 완료</span>
          </div>
        </div>
      </div>

      {/* 3. 총 출전 번호표 (티켓수) & 중복출전 */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <IdcardOutlined className="text-indigo-500" />
            총 출전 번호표
          </span>
          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
            인당 {avgEntriesPerAthlete}종목
          </span>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-black text-indigo-600">
            {totalEntries}
            <span className="text-sm font-bold text-slate-500 ml-1">개</span>
          </div>
          <div className="text-xs text-slate-400 font-medium mt-1">
            중복 출전 포함 총 배부 번호표
          </div>
        </div>
      </div>

      {/* 4. 위촉 심판진 현황 */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <TeamOutlined className="text-purple-500" />
            위촉 심판진
          </span>
          <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
            심사 운영
          </span>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-black text-purple-700">
            {judgesCount}
            <span className="text-sm font-bold text-slate-500 ml-1">명</span>
          </div>
          <div className="text-xs text-slate-400 font-medium mt-1">
            심사위원장 · 주심 · 부심 구성
          </div>
        </div>
      </div>

      {/* 5. 미등록 체급 (그랑프리 제외) */}
      <Popover
        placement="bottom"
        content={
          noPlayersCount > 0 ? (
            <div className="max-w-xs max-h-60 overflow-y-auto">
              <div className="font-bold text-xs text-slate-700 mb-2 pb-1 border-b">
                신청자가 없는 종목/체급 (그랑프리 제외)
              </div>
              <List
                size="small"
                dataSource={noPlayersList}
                renderItem={(c) => (
                  <List.Item className="text-xs py-1">
                    <span className="font-bold text-slate-700">
                      {c.contestCategoryTitle}
                    </span>
                  </List.Item>
                )}
              />
            </div>
          ) : (
            <div className="text-xs text-emerald-600 font-bold p-1">
              ✓ 모든 정규 종목에 선수가 등록되어 있습니다!
            </div>
          )
        }
        trigger="hover"
      >
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <ExclamationCircleOutlined className="text-orange-500" />
              미달 종목
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              그랑프리 제외
            </span>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl sm:text-3xl font-black ${
                noPlayersCount > 0 ? "text-orange-600" : "text-emerald-600"
              }`}
            >
              {noPlayersCount > 0 ? `${noPlayersCount}개` : "없음 (전체 등록)"}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-1">
              신청자 0명 종목 (호버 시 명단)
            </div>
          </div>
        </div>
      </Popover>
    </div>
  );
};

export default RegistrationMetricCards;
