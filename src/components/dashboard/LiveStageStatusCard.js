import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Monitor,
  ShieldCheck,
  Mic,
  Tv,
  Medal,
  Printer,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { BibTag, StatusDot } from "../ui/BibTag";

const iconProps = { size: 15, strokeWidth: 1.5 };

const LiveStageStatusCard = ({
  realtimeData,
  totalGradesCount = 0,
  savedGradesCount = 0,
}) => {
  const isLive = Boolean(realtimeData?.stageId);
  const [expanded, setExpanded] = useState(false);

  const currentCategory = realtimeData?.categoryTitle || "진행 중인 무대 없음";
  const currentGrade = realtimeData?.gradeTitle || "";
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
    },
    {
      to: "/contestmonitoring/judgeHead",
      label: "심판위원장",
      icon: <ShieldCheck {...iconProps} />,
    },
    {
      to: "/contestmonitoring/MC",
      label: "사회자 모니터",
      icon: <Mic {...iconProps} />,
    },
    {
      to: "/stage-live",
      label: "무대 전광판",
      icon: <Tv {...iconProps} />,
    },
    {
      to: "/contestranksummary",
      label: "순위표 집계",
      icon: <Medal {...iconProps} />,
    },
    {
      to: "/print/measurement",
      label: "인쇄 센터",
      icon: <Printer {...iconProps} />,
    },
  ];

  return (
    <section
      aria-label="당일 실시간 무대 상태 바"
      className={`rounded-[10px] border transition-colors duration-150 ${
        isLive
          ? "bg-[#141415] text-[#ededed] border-[#171717]/15"
          : "bg-white text-[#171717] border-[#171717]/[0.08]"
      }`}
    >
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Compact Live Status */}
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-xs font-medium ${
              isLive
                ? "bg-[#2563eb]/20 text-[#60a5fa] border border-[#2563eb]/40"
                : "bg-[#f4f4f5] text-[#525252] border border-[#171717]/[0.06]"
            }`}
          >
            <StatusDot status={isLive ? "live" : "idle"} live={isLive} />
            <span>{isLive ? "당일 경기 진행 중" : "당일 경기 대기"}</span>
          </span>

          {isLive ? (
            <div className="flex items-center gap-2 min-w-0">
              <BibTag
                variant="dark"
                size="sm"
                prefix="#"
                number={stageNumber ?? "-"}
              />
              <span className="text-[13px] leading-5 font-medium text-[#ededed] truncate">
                {currentCategory}
              </span>
              {currentGrade && (
                <span className="text-xs text-[#a1a1a6] truncate">
                  · {currentGrade}
                </span>
              )}
              {isCurrentStageSaved && (
                <span className="inline-flex items-center gap-1 text-xs text-[#4cc38a]">
                  <CheckCircle2 size={13} strokeWidth={1.75} />
                  <span>확정</span>
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-[#737373]">
              대회 당일 실시간 무대 진행 상태가 이 바에 요약 표시됩니다
            </span>
          )}
        </div>

        {/* Right: Progress + Compact Day-of Links Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {(isLive || savedGradesCount > 0) && (
            <div
              className={`inline-flex items-center gap-2 text-xs font-mono tabular-nums px-2.5 py-1 rounded-[6px] ${
                isLive
                  ? "bg-[#19191b] text-[#ededed] border border-[#ededed]/[0.08]"
                  : "bg-[#f4f4f5] text-[#525252]"
              }`}
            >
              <span>체급 완료</span>
              <span className="font-medium">
                {savedGradesCount}/{totalGradesCount} ({progressPercent}%)
              </span>
            </div>
          )}

          <Link
            to="/contestmonitoring/main"
            className={`h-7 px-2.5 rounded-[6px] text-xs font-medium no-underline inline-flex items-center gap-1.5 transition-colors duration-150 ${
              isLive
                ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                : "bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] border border-[#171717]/[0.08]"
            }`}
          >
            <Monitor size={13} strokeWidth={1.5} />
            <span>본부석 관제</span>
          </Link>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={`h-7 px-2.5 rounded-[6px] text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors duration-150 ${
              isLive
                ? "bg-[#19191b] hover:bg-[#232325] text-[#a1a1a6] border border-[#ededed]/[0.08]"
                : "bg-transparent hover:bg-[#f4f4f5] text-[#525252] border border-[#171717]/[0.08]"
            }`}
          >
            <span>당일 화면 바로가기</span>
            {expanded ? (
              <ChevronUp size={13} strokeWidth={1.5} />
            ) : (
              <ChevronDown size={13} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          className={`px-4 py-3 border-t grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 ${
            isLive
              ? "border-[#ededed]/[0.08] bg-[#19191b]/60"
              : "border-[#171717]/[0.06] bg-[#fafafa]"
          }`}
        >
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`h-9 px-3 rounded-[6px] no-underline flex items-center justify-between gap-2 text-xs font-medium transition-colors duration-150 ${
                isLive
                  ? "bg-[#232325] hover:bg-[#2c2c2f] text-[#ededed] border border-[#ededed]/[0.08]"
                  : "bg-white hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.08]"
              }`}
            >
              <span className="inline-flex items-center gap-1.5 truncate">
                <span className={isLive ? "text-[#a1a1a6]" : "text-[#737373]"}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </span>
              <ArrowUpRight
                size={13}
                strokeWidth={1.5}
                className="text-[#737373] shrink-0"
              />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};

export default LiveStageStatusCard;
