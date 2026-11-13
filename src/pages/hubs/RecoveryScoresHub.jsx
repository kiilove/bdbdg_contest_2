import React from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Table2, Medal, Printer } from "lucide-react";
import PipelineStageBanner from "../../components/ui/PipelineStageBanner";
import ScoreResultManager from "../ScoreResultManager";
import ContestResultManager from "../ContestResultManager";

const RecoveryScoresHub = ({ defaultTab }) => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const inferredDefault =
    defaultTab ||
    (location.pathname === "/contestresultmanager" ? "results" : "raw");

  const activeTab = searchParams.get("tab") || inferredDefault;

  const tabs = [
    {
      key: "raw",
      label: "심판 원시 채점표 검증 · 복구",
      icon: <Table2 size={15} strokeWidth={1.6} />,
      badge: "L4 Raw 기표",
    },
    {
      key: "results",
      label: "확정 순위표 재집계 · 보정",
      icon: <Medal size={15} strokeWidth={1.6} />,
      badge: "공식 순위",
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <PipelineStageBanner
        layerBadge="관리자 복구 · L4 원시 기표 ↔ 공식 순위"
        title="채점 · 순위 원복 관리"
        subtitle="심판 각 좌석에서 제출한 원시 기표 로우데이터와 공식 확정 순위표를 대조·보정하거나 원시 데이터 기준으로 재집계합니다."
        icon={<Table2 size={17} strokeWidth={1.6} />}
        sourceCollection="{collectionName} (원시 채점표)"
        targetCollection="contest_results_list (확정 순위표)"
        rollbackHint="순위 확정 이후 오류가 발견되더라도 심판 개별 좌석의 원시 채점 문서({collectionName})가 별도 보존되어 있으므로 언제든 정확하게 재집계·원복할 수 있습니다."
        actions={[
          {
            key: "print-summary",
            label: "심판 채점 집계표 인쇄",
            to: "/printsummary",
            icon: <Printer size={14} strokeWidth={1.6} />,
          },
          {
            key: "print-ranking",
            label: "공식 순위표 인쇄",
            to: "/print/ranking",
            icon: <Printer size={14} strokeWidth={1.6} />,
            variant: "primary",
          },
        ]}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setSearchParams({ tab: key })}
      />
      {activeTab === "results" ? (
        <ContestResultManager />
      ) : (
        <ScoreResultManager />
      )}
    </div>
  );
};

export default RecoveryScoresHub;
