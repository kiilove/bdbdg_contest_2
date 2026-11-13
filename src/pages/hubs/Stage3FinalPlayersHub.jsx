import React from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ListOrdered, UserPlus, Trophy, Printer } from "lucide-react";
import PipelineStageBanner from "../../components/ui/PipelineStageBanner";
import ContestPlayerOrderTableAfter from "../ContestPlayerOrderTableAfter";
import ContestForceManual from "../ContestForceManual";
import ContestPlayerOrderTableGrandPrix from "../ContestPlayerOrderTableGrandPrix";
import { useIsAdmin } from "./useHubAuth";

const Stage3FinalPlayersHub = ({ defaultTab }) => {
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const inferredDefault =
    defaultTab ||
    (location.pathname === "/contestforcemanual"
      ? "force"
      : location.pathname === "/contestplayerordergrandprix"
      ? "grandprix"
      : "final");

  const rawTab = searchParams.get("tab") || inferredDefault;
  const activeTab = rawTab === "force" && !isAdmin ? "final" : rawTab;

  const tabs = [
    {
      key: "final",
      label: "최종 출전 명단 확인",
      icon: <ListOrdered size={15} strokeWidth={1.6} />,
      badge: "L3",
    },
    ...(isAdmin
      ? [
          {
            key: "force",
            label: "당일 현장 강제 등록",
            icon: <UserPlus size={15} strokeWidth={1.6} />,
          },
        ]
      : []),
    {
      key: "grandprix",
      label: "그랑프리 진출자 편성",
      icon: <Trophy size={15} strokeWidth={1.6} />,
      badge: "1위 자동연동",
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <PipelineStageBanner
        layerBadge="3단계 · L3 최종 출전 확정본"
        title="③ 최종 출전 · 그랑프리"
        subtitle="계측 통과 확정 명단 열람, 당일 현장 긴급 추가(강제 등록), 그리고 각 체급 1위 선수의 그랑프리 명단 합류를 한곳에서 관리합니다."
        icon={<ListOrdered size={17} strokeWidth={1.6} />}
        sourceCollection="contest_players_final · contest_results_list"
        targetCollection="contest_players_final (L3 통합)"
        rollbackHint="현장 강제 등록(createdBy: force) 및 그랑프리 자동 편성 엔트리는 일반 계측 선수와 구분 태그로 관리되어, 계측 명단을 다시 저장해도 누락 없이 안전하게 병합·유지됩니다."
        prevStep={{ label: "② 선수 계측 · 체급 확정", to: "/stage-2-weighin" }}
        nextStep={{ label: "④ 무대 진행 큐 편성", to: "/stage-4-stages" }}
        actions={[
          {
            key: "print-final",
            label: "최종 출전 명단 바로 인쇄",
            to: "/print/final",
            icon: <Printer size={14} strokeWidth={1.6} />,
            variant: "primary",
          },
        ]}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setSearchParams({ tab: key })}
      />
      {activeTab === "force" && isAdmin ? (
        <ContestForceManual />
      ) : activeTab === "grandprix" ? (
        <ContestPlayerOrderTableGrandPrix />
      ) : (
        <ContestPlayerOrderTableAfter />
      )}
    </div>
  );
};

export default Stage3FinalPlayersHub;
