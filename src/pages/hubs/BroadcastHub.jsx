import React, { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  Tv,
  Megaphone,
  Timer,
  ExternalLink,
  Copy,
  Check,
  Monitor,
  Mic,
  Award,
  Sparkles,
} from "lucide-react";
import PipelineStageBanner from "../../components/ui/PipelineStageBanner";
import ContestSponsorManager from "../broadcast/ContestSponsorManager";
import DelaySettings from "../DelaySettings";
import { useIsAdmin } from "./useHubAuth";

const SCREEN_ENDPOINTS = [
  {
    key: "stage-live",
    title: "실시간 무대 전광판 (16:9 와이드)",
    desc: "메인 무대 LED 전광판 표준 송출 화면 (선수 소개 · 비교심사 · 스폰서 연동)",
    path: "/stage-live",
    badge: "메인 LED",
    icon: <Tv size={18} strokeWidth={1.6} />,
  },
  {
    key: "stage-square",
    title: "정방형 무대 전광판 (1:1 스퀘어)",
    desc: "정방형 비율 보조 LED 또는 세로형 무대 스크린 전용 송출 화면",
    path: "/stage-square",
    badge: "1:1 비율",
    icon: <Monitor size={18} strokeWidth={1.6} />,
  },
  {
    key: "mc",
    title: "사회자(MC) 단독 태블릿 화면",
    desc: "사이드바 없이 사회자 석 태블릿에 전체화면으로 띄우는 전용 진행 뷰",
    path: "/mc",
    badge: "MC 전용",
    icon: <Mic size={18} strokeWidth={1.6} />,
  },
  {
    key: "ranking",
    title: "공식 순위 발표 스크린",
    desc: "시상식 및 확정 순위 발표 전용 전체화면 디스플레이",
    path: "/ranking",
    badge: "시상 발표",
    icon: <Award size={18} strokeWidth={1.6} />,
  },
  {
    key: "screenlobby",
    title: "선수 대기실 · 로비 안내 스크린",
    desc: "백스테이지 선수 대기 구역용 현재 진행 무대 안내 화면",
    path: "/screenlobby",
    badge: "대기실",
    icon: <Sparkles size={18} strokeWidth={1.6} />,
  },
  {
    key: "idle",
    title: "휴식 · 대기(Idle) 스크린",
    desc: "개회 전 또는 브레이크 타임 송출용 대기 화면",
    path: "/idle",
    badge: "대기 화면",
    icon: <Timer size={18} strokeWidth={1.6} />,
  },
];

const BroadcastHub = ({ defaultTab }) => {
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [copiedKey, setCopiedKey] = useState("");

  const inferredDefault =
    defaultTab ||
    (location.pathname === "/sponsors" ||
    location.pathname === "/sponsor-management"
      ? "sponsors"
      : location.pathname === "/delay"
      ? "delay"
      : "screens");

  const rawTab = searchParams.get("tab") || inferredDefault;
  const activeTab = rawTab === "delay" && !isAdmin ? "screens" : rawTab;

  const tabs = [
    {
      key: "screens",
      label: "전광판 · 송출 화면 런처",
      icon: <Tv size={15} strokeWidth={1.6} />,
    },
    {
      key: "sponsors",
      label: "스폰서 · 광고 배너 관리",
      icon: <Megaphone size={15} strokeWidth={1.6} />,
    },
    ...(isAdmin
      ? [
          {
            key: "delay",
            label: "스크린 딜레이 설정",
            icon: <Timer size={15} strokeWidth={1.6} />,
          },
        ]
      : []),
  ];

  const handleCopy = async (key, path) => {
    const fullUrl = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <PipelineStageBanner
        layerBadge="무대 송출 · 연출 통합 허브"
        title="전광판 · 스폰서 연출"
        subtitle="현장 전광판·대기실·사회자 전체화면 송출 창 실행과 스폰서 롤링 배너, 스크린 딜레이를 한곳에서 제어합니다."
        icon={<Tv size={17} strokeWidth={1.6} />}
        actions={[
          {
            key: "open-main-led",
            label: "16:9 메인 전광판 새 창 실행",
            to: "/stage-live",
            external: true,
            icon: <ExternalLink size={14} strokeWidth={1.6} />,
            variant: "primary",
          },
        ]}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setSearchParams({ tab: key })}
      />

      {activeTab === "sponsors" ? (
        <ContestSponsorManager />
      ) : activeTab === "delay" && isAdmin ? (
        <DelaySettings />
      ) : (
        <div className="w-full px-5 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SCREEN_ENDPOINTS.map((scr) => (
              <div
                key={scr.key}
                className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#171717] flex items-center justify-center">
                      {scr.icon}
                    </div>
                    <span className="px-2 py-0.5 rounded-[5px] bg-[#f4f4f5] text-[11px] font-medium text-[#525252]">
                      {scr.badge}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-[#171717] m-0">
                      {scr.title}
                    </h2>
                    <p className="text-xs leading-5 text-[#737373] m-0 mt-1">
                      {scr.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#171717]/[0.06] flex items-center justify-between gap-2">
                  <code className="text-xs font-mono text-[#737373] truncate">
                    {scr.path}
                  </code>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(scr.key, scr.path)}
                      className="h-8 px-2.5 rounded-[8px] bg-[#fafafa] hover:bg-[#f4f4f5] border border-[#171717]/[0.10] text-xs font-medium text-[#525252] inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedKey === scr.key ? (
                        <>
                          <Check size={13} className="text-[#16a34a]" />
                          <span className="text-[#16a34a]">복사됨</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>URL 복사</span>
                        </>
                      )}
                    </button>
                    <a
                      href={scr.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium no-underline inline-flex items-center gap-1 transition-colors"
                    >
                      <span>새 창 열기</span>
                      <ExternalLink size={13} strokeWidth={1.6} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BroadcastHub;
