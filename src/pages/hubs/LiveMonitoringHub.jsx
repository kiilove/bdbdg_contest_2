import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Monitor,
  ShieldCheck,
  Mic,
  Activity,
  ExternalLink,
  AudioWaveform,
  Tv,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import ContestMonitoring from "../ContestMonitoring";
import { STATION_ROLES } from "../../utils/liveIntercomEngine";

const CONSOLE_MODES = [
  {
    key: "main",
    label: "본부석 진행 콘솔",
    path: "/contestmonitoring/main",
    icon: <Monitor size={14} strokeWidth={1.6} />,
  },
  {
    key: "judgehead",
    label: "심판위원장 총괄 집계석",
    path: "/contestmonitoring/judgeHead",
    icon: <ShieldCheck size={14} strokeWidth={1.6} />,
  },
  {
    key: "mc",
    label: "사회자(MC) 진행석",
    path: "/contestmonitoring/MC",
    icon: <Mic size={14} strokeWidth={1.6} />,
  },
  {
    key: "all",
    label: "전체 통합 모니터링",
    path: "/contestmonitoring/all",
    icon: <Activity size={14} strokeWidth={1.6} />,
  },
];

const LiveMonitoringHub = () => {
  const params = useParams();
  const navigate = useNavigate();
  const activeKey = String(params.target || "main").toLowerCase();

  const fallbackRole =
    activeKey === "judgehead" ? "HEAD_JUDGE" : activeKey === "mc" ? "MC" : "HQ";

  const [intercomState, setIntercomState] = useState({
    unreadCount: 0,
    hasUrgent: false,
    activeRole: fallbackRole,
  });

  useEffect(() => {
    const handleUnreadState = (e) => {
      if (!e?.detail) return;
      setIntercomState((prev) => ({
        unreadCount: Number(e.detail.unreadCount || 0),
        hasUrgent: Boolean(e.detail.hasUrgent),
        activeRole: e.detail.activeRole || prev.activeRole || fallbackRole,
      }));
    };
    const handleRoleSync = (e) => {
      const nextRole = e?.detail?.role;
      if (nextRole && STATION_ROLES[nextRole]) {
        setIntercomState((prev) => ({ ...prev, activeRole: nextRole }));
      }
    };
    window.addEventListener("bdbdg:intercom-unread-state", handleUnreadState);
    window.addEventListener("bdbdg:intercom-role-sync", handleRoleSync);
    return () => {
      window.removeEventListener(
        "bdbdg:intercom-unread-state",
        handleUnreadState
      );
      window.removeEventListener("bdbdg:intercom-role-sync", handleRoleSync);
    };
  }, [fallbackRole]);

  const effectiveRole =
    activeKey === "all"
      ? intercomState.activeRole || "HQ"
      : fallbackRole;
  const roleShortLabel =
    STATION_ROLES[effectiveRole]?.shortLabel || "본부석";
  const hasUnread = intercomState.unreadCount > 0;

  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      {/* 현장 좌석 빠른 전환 바 (인쇄 시 자동 숨김) */}
      <div className="no-print print:hidden bg-white border-b border-[#171717]/[0.08]">
        <div className="w-full px-5 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {CONSOLE_MODES.map((m) => {
              const isActive = activeKey === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => navigate(m.path)}
                  className={`h-8 px-3 rounded-[8px] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer border-0 ${
                    isActive
                      ? "bg-[#171717] text-white"
                      : "bg-transparent text-[#525252] hover:bg-[#f4f4f5] hover:text-[#171717]"
                  }`}
                >
                  <span className={isActive ? "text-white" : "text-[#737373]"}>
                    {m.icon}
                  </span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("bdbdg:open-intercom"))
              }
              className={`h-8 px-3 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                hasUnread
                  ? intercomState.hasUrgent
                    ? "bg-[#DC2626] text-white border-2 border-[#FEE500] shadow-md animate-pulse"
                    : "bg-[#FEE500] text-[#191919] border-2 border-[#191919] shadow-md animate-pulse"
                  : "bg-[#FEE500] hover:bg-[#FDD835] border border-black/15 text-[#191919]"
              }`}
            >
              {hasUnread && intercomState.hasUrgent ? (
                <AlertTriangle size={13} strokeWidth={2.2} />
              ) : (
                <MessageSquare size={12} strokeWidth={2.1} />
              )}
              <span>{roleShortLabel} 실시간 톡</span>
              {hasUnread && (
                <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#FF3B30] text-white text-[10px] font-mono font-extrabold tabular-nums inline-flex items-center justify-center">
                  {intercomState.unreadCount}
                </span>
              )}
            </button>
            <a
              href="/mc"
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 px-2.5 rounded-[6px] bg-[#fafafa] hover:bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs text-[#525252] hover:text-[#171717] no-underline inline-flex items-center gap-1 transition-colors"
            >
              <Mic size={12} strokeWidth={1.6} />
              <span>MC 단독창</span>
              <ExternalLink size={11} strokeWidth={1.6} />
            </a>
            <a
              href="/stage-live"
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 px-2.5 rounded-[6px] bg-[#fafafa] hover:bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs text-[#525252] hover:text-[#171717] no-underline inline-flex items-center gap-1 transition-colors"
            >
              <Tv size={12} strokeWidth={1.6} />
              <span>전광판 새창</span>
              <ExternalLink size={11} strokeWidth={1.6} />
            </a>
            <Link
              to="/audio-center"
              className="h-7 px-2.5 rounded-[6px] bg-[#fafafa] hover:bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs text-[#525252] hover:text-[#171717] no-underline inline-flex items-center gap-1 transition-colors"
            >
              <AudioWaveform size={12} strokeWidth={1.6} />
              <span>음원센터</span>
            </Link>
          </div>
        </div>
      </div>

      <ContestMonitoring />
    </div>
  );
};

export default LiveMonitoringHub;
