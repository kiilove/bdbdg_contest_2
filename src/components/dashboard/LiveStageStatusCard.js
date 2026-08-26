import React from "react";
import { Link } from "react-router-dom";
import {
  TbHeartRateMonitor,
  TbScreenShare,
  TbPrinter,
  TbUsers,
  TbAward,
} from "react-icons/tb";
import { SoundOutlined, TrophyOutlined } from "@ant-design/icons";

const LiveStageStatusCard = ({
  realtimeData,
  currentContest,
  totalGradesCount = 0,
  savedGradesCount = 0,
}) => {
  const contestTitle = currentContest?.contests?.contestTitle || "대회 명칭 미설정";
  const currentCategory = realtimeData?.categoryTitle || "진행 무대 없음";
  const currentGrade = realtimeData?.gradeTitle || "대기 중";
  const stageNumber = realtimeData?.stageNumber;

  const savedList = realtimeData?.resultSaved || [];
  const isCurrentStageSaved =
    realtimeData?.gradeId && savedList.includes(realtimeData.gradeId);

  // 진행률 계산
  const progressPercent =
    totalGradesCount > 0
      ? Math.round((savedGradesCount / totalGradesCount) * 100)
      : 0;

  const quickLinks = [
    {
      to: "/contestmonitoring/main",
      label: "본부석 모니터링",
      icon: <TbHeartRateMonitor className="text-lg" />,
      color: "from-blue-600 to-indigo-600",
      desc: "실시간 경기 총괄 진행",
    },
    {
      to: "/contestmonitoring/judgeHead",
      label: "심판위원장",
      icon: <TrophyOutlined className="text-lg" />,
      color: "from-purple-600 to-indigo-700",
      desc: "집계 확인 및 순위 확정",
    },
    {
      to: "/contestmonitoring/MC",
      label: "사회자 모니터",
      icon: <SoundOutlined className="text-lg" />,
      color: "from-teal-600 to-emerald-700",
      desc: "태블릿 호명 프롬프터",
    },
    {
      to: "/stage-live",
      label: "실시간 무대 전광판",
      icon: <TbScreenShare className="text-lg" />,
      color: "from-amber-600 to-orange-700",
      desc: "대기/광고/선수/순위 송출",
    },
    {
      to: "/contestranksummary",
      label: "순위표 집계",
      icon: <TbAward className="text-lg" />,
      color: "from-rose-600 to-pink-700",
      desc: "전체 체급 순위 결과표",
    },
    {
      to: "/print/measurement",
      label: "인쇄 출력 센터",
      icon: <TbPrinter className="text-lg" />,
      color: "from-slate-700 to-slate-800",
      desc: "계측/출전/순위/배정표",
    },
  ];

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-5 text-white shadow-xl border border-slate-700">
      {/* 상단: 대회명 & 실시간 무대 현황 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-700/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-red-600 text-white animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              LIVE 무대 관제
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {contestTitle}
            </span>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-black text-white m-0 tracking-tight">
              {currentCategory}
            </h2>
            <span className="text-xl sm:text-2xl font-black text-amber-400">
              {currentGrade}
            </span>
            {stageNumber && (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                무대 #{stageNumber}
              </span>
            )}
          </div>
        </div>

        {/* 심사 상태 뱃지 & 진행률 게이지 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
          <div className="text-center sm:text-left">
            <div className="text-xs text-slate-400 font-semibold mb-1">무대 심사 상태</div>
            {isCurrentStageSaved ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-500 font-black text-sm">
                🏆 순위 확정 완료
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950 text-amber-300 border border-amber-500 font-bold text-sm">
                ⏳ 심사 진행 중
              </span>
            )}
          </div>

          <div className="w-px h-8 bg-slate-700 hidden sm:block" />

          {/* 전체 경기 진행률 */}
          <div className="min-w-[160px]">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
              <span>전체 경기 진행률</span>
              <span className="text-indigo-400 font-black">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 mt-1 text-right">
              {savedGradesCount} / {totalGradesCount} 체급 완료
            </div>
          </div>
        </div>
      </div>

      {/* 하단: 주요 관제 페이지 원클릭 퀵 링크 버튼 그리드 */}
      <div className="mt-4">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <span>⚡</span>
          <span>주요 운영 화면 바로가기</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {quickLinks.map((item, idx) => (
            <Link
              key={idx}
              to={item.to}
              className={`p-3 rounded-xl bg-gradient-to-br ${item.color} hover:opacity-95 text-white no-underline shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg opacity-90">{item.icon}</span>
                <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-bold">
                  GO ➔
                </span>
              </div>
              <div className="mt-2">
                <div className="font-black text-sm leading-tight">{item.label}</div>
                <div className="text-[10px] text-white/70 font-medium mt-0.5 truncate">
                  {item.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveStageStatusCard;
