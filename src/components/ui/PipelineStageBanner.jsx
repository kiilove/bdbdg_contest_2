import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Database,
  ShieldCheck,
} from "lucide-react";

/**
 * PipelineStageBanner
 * - 단계별 로우데이터(원본 스냅샷) 보존 구조와 작업 동선, 바로 인쇄 버튼을 상단에 일관되게 표시합니다.
 * - 인쇄 시(no-print print:hidden) 자동으로 숨겨져 A4 인쇄물에 영향을 주지 않습니다.
 */
const PipelineStageBanner = ({
  layerBadge,
  title,
  subtitle,
  icon,
  sourceCollection,
  targetCollection,
  rollbackHint,
  prevStep,
  nextStep,
  actions = [],
  tabs = [],
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="no-print print:hidden bg-white border-b border-[#171717]/[0.08]">
      <div className="max-w-[1440px] mx-auto px-6 pt-4 pb-3.5 space-y-3">
        {/* Row 1: Step Breadcrumb + Prev/Next Pipeline Links */}
        {(layerBadge || prevStep || nextStep) && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {layerBadge && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[5px] bg-[#2563eb]/[0.08] border border-[#2563eb]/20 text-[11px] font-semibold text-[#2563eb]">
                  <Database size={12} strokeWidth={1.7} />
                  <span>{layerBadge}</span>
                </span>
              )}
              {sourceCollection && targetCollection && (
                <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-[#525252] bg-[#f4f4f5] border border-[#171717]/[0.07] rounded-[5px] px-2 py-0.5">
                  <span className="text-[#737373]">원본:</span>
                  <code className="font-mono text-[11px] text-[#171717] font-medium">
                    {sourceCollection}
                  </code>
                  <ArrowRight size={11} className="text-[#737373]" />
                  <span className="text-[#737373]">저장본:</span>
                  <code className="font-mono text-[11px] text-[#2563eb] font-medium">
                    {targetCollection}
                  </code>
                </div>
              )}
            </div>

            {(prevStep || nextStep) && (
              <div className="flex items-center gap-1.5 text-xs">
                {prevStep && (
                  <Link
                    to={prevStep.to}
                    className="h-7 px-2.5 rounded-[6px] bg-[#fafafa] hover:bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#525252] hover:text-[#171717] no-underline inline-flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft size={12} strokeWidth={1.6} />
                    <span>{prevStep.label}</span>
                  </Link>
                )}
                {nextStep && (
                  <Link
                    to={nextStep.to}
                    className="h-7 px-2.5 rounded-[6px] bg-[#fafafa] hover:bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#171717] font-medium no-underline inline-flex items-center gap-1 transition-colors"
                  >
                    <span>{nextStep.label}</span>
                    <ArrowRight size={12} strokeWidth={1.6} className="text-[#2563eb]" />
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Row 2: Main Title + Quick Actions (바로 인쇄 등) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#171717] flex items-center justify-center shrink-0 mt-0.5">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-[18px] leading-6 font-semibold text-[#171717] m-0 tracking-[-0.01em]">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs leading-4 text-[#737373] m-0 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {actions.map((act, idx) => {
                const baseCls =
                  act.variant === "primary"
                    ? "h-8 px-3 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white border border-[#2563eb] text-xs font-medium no-underline inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    : "h-8 px-3 rounded-[8px] bg-white hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.12] text-xs font-medium no-underline inline-flex items-center gap-1.5 transition-colors cursor-pointer";

                if (act.onClick) {
                  return (
                    <button
                      key={act.key || idx}
                      type="button"
                      onClick={act.onClick}
                      className={baseCls}
                    >
                      {act.icon}
                      <span>{act.label}</span>
                    </button>
                  );
                }

                if (act.external) {
                  return (
                    <a
                      key={act.key || idx}
                      href={act.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={baseCls}
                    >
                      {act.icon}
                      <span>{act.label}</span>
                    </a>
                  );
                }

                return (
                  <Link key={act.key || idx} to={act.to} className={baseCls}>
                    {act.icon}
                    <span>{act.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Row 3: Raw-Data Rollback Safety Strip */}
        {rollbackHint && (
          <div className="rounded-[8px] bg-[#f8fafc] border border-[#2563eb]/[0.14] px-3 py-2 flex items-start gap-2 text-xs leading-4 text-[#334155]">
            <ShieldCheck
              size={14}
              strokeWidth={1.7}
              className="text-[#2563eb] shrink-0 mt-0.5"
            />
            <span>
              <strong className="font-semibold text-[#171717]">
                원복 안전망 보존:
              </strong>{" "}
              {rollbackHint}
            </span>
          </div>
        )}

        {/* Row 4: Integrated Sub-Workflow Tabs */}
        {tabs.length > 0 && (
          <div className="pt-1 flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-[#171717]/[0.06]">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange && onTabChange(tab.key)}
                  className={`h-9 px-3.5 rounded-[8px] text-[13px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer border-0 ${
                    isActive
                      ? "bg-[#171717] text-white"
                      : "bg-transparent text-[#525252] hover:bg-[#f4f4f5] hover:text-[#171717]"
                  }`}
                >
                  {tab.icon && (
                    <span className={isActive ? "text-white" : "text-[#737373]"}>
                      {tab.icon}
                    </span>
                  )}
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-mono ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-[#f4f4f5] text-[#525252]"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PipelineStageBanner;
