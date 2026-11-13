import React from "react";
import { Link } from "react-router-dom";
import {
  Monitor,
  ShieldCheck,
  Mic,
  Tv,
  Medal,
  Printer,
  ArrowUpRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { BibTag, StatusDot } from "../ui/BibTag";

const iconProps = { size: 16, strokeWidth: 1.5 };

const LiveStageStatusCard = ({
  realtimeData,
  currentContest,
  totalGradesCount = 0,
  savedGradesCount = 0,
}) => {
  const contestTitle =
    currentContest?.contests?.contestTitle ||
    currentContest?.contestInfo?.contestTitle ||
    "대회 명칭 미설정";
  const isLive = Boolean(realtimeData?.stageId);
  const currentCategory = realtimeData?.categoryTitle || "진행 중인 무대 없음";
  const currentGrade = realtimeData?.gradeTitle || "대기 중";
  const stageNumber = realtimeData?.stageNumber;

  const savedList = realtimeData?.resultSaved || [];
  const isCurrentStageSaved = Boolean(
    realtimeData?.gradeId && savedList.includes(realtimeData.gradeId)
  );

  const progressPercent =
    totalGradesCount > 0
      ? Math.round((savedGradesCount / totalGradesCount) * 100)
      : 0;

  const quickLinks = [
    {
      to: "/contestmonitoring/main",
      label: "본부석 모니터링",
      icon: <Monitor {...iconProps} />,
      desc: "실시간 경기 총괄 진행",
    },
    {
      to: "/contestmonitoring/judgeHead",
      label: "심판위원장",
      icon: <ShieldCheck {...iconProps} />,
      desc: "집계 확인 및 순위 확정",
    },
    {
      to: "/contestmonitoring/MC",
      label: "사회자 모니터",
      icon: <Mic {...iconProps} />,
      desc: "태블릿 호명 프롬프터",
    },
    {
      to: "/stage-live",
      label: "실시간 무대 전광판",
      icon: <Tv {...iconProps} />,
      desc: "대기 · 선수 · 순위 송출",
    },
    {
      to: "/contestranksummary",
      label: "순위표 집계",
      icon: <Medal {...iconProps} />,
      desc: "전체 체급 순위 결과표",
    },
    {
      to: "/print/measurement",
      label: "인쇄 출력 센터",
      icon: <Printer {...iconProps} />,
      desc: "계측 · 출전 · 순위 · 배정표",
    },
  ];

  return (
    <section
      aria-label="실시간 무대 관제"
      className="bg-[#141415] text-[#ededed] rounded-[12px] border border-[#171717]/10 p-6"
    >
      {/* Top Instrument Row: Live Stage Info & Contest Progress */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-[#ededed]/[0.08]">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 text-xs leading-4">
            <StatusDot status={isLive ? "live" : "idle"} live={isLive} />
            <span className="font-medium text-[#ededed]">
              {isLive ? "실시간 무대 관제" : "무대 대기"}
            </span>
            <span className="text-[#85858b]" aria-hidden="true">
              ·
            </span>
            <span className="text-[#85858b] truncate">{contestTitle}</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <BibTag
              variant="dark"
              size="md"
              prefix="#"
              number={stageNumber ?? "-"}
            />
            <h2 className="text-[22px] sm:text-[26px] leading-8 font-medium text-[#ededed] m-0 tracking-[-0.01em]">
              {currentCategory}
            </h2>
            <span className="text-[18px] sm:text-[20px] leading-7 font-normal text-[#a1a1a6]">
              {currentGrade}
            </span>
          </div>
        </div>

        {/* Stage Status & Single-Accent Progress Gauge */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-[#19191b] px-4 py-3 rounded-[8px] border border-[#ededed]/[0.08] shrink-0">
          <div>
            <div className="text-xs leading-4 text-[#85858b]">
              현재 체급 심사 상태
            </div>
            {isCurrentStageSaved ? (
              <div className="mt-1 inline-flex items-center gap-1.5 text-[13px] leading-5 font-medium text-[#4cc38a]">
                <CheckCircle2 size={16} strokeWidth={1.5} />
                <span>순위 확정 완료</span>
              </div>
            ) : (
              <div className="mt-1 inline-flex items-center gap-1.5 text-[13px] leading-5 font-medium text-[#ededed]">
                <Clock
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#85858b]"
                />
                <span>{isLive ? "심사 진행 중" : "진행 대기"}</span>
              </div>
            )}
          </div>

          <div
            aria-hidden="true"
            className="hidden sm:block w-px h-8 bg-[#ededed]/[0.08]"
          />

          <div className="min-w-[216px]">
            <div className="flex items-center justify-between gap-3 text-xs leading-4 tabular-nums">
              <span className="text-[#85858b]">전체 경기 진행률</span>
              <span className="font-mono text-[#ededed]">
                {savedGradesCount} / {totalGradesCount} 체급 완료 ·{" "}
                {progressPercent}%
              </span>
            </div>
            <div className="w-full bg-[#232325] rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-[#2563eb] h-1.5 rounded-full transition-opacity duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: 6 Uniform Quiet Console Quick-Link Cards */}
      <div className="pt-4">
        <div className="text-xs leading-4 font-medium text-[#85858b] mb-3">
          주요 운영 화면 바로가기
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group p-3 rounded-[8px] bg-[#19191b] hover:bg-[#232325] active:scale-[0.98] border border-[#ededed]/[0.08] no-underline transition-[background-color,border-color,transform] duration-150 flex flex-col justify-between gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[#85858b] group-hover:text-[#ededed] transition-colors duration-150">
                  {item.icon}
                </span>
                <ArrowUpRight
                  size={14}
                  strokeWidth={1.5}
                  className="text-[#85858b] group-hover:text-[#ededed] transition-colors duration-150"
                />
              </div>
              <div>
                <div className="text-[13px] leading-5 font-medium text-[#ededed]">
                  {item.label}
                </div>
                <div className="text-[11px] leading-4 text-[#85858b] mt-0.5 truncate">
                  {item.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LiveStageStatusCard;
