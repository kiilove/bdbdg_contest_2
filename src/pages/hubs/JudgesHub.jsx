import React from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  Users,
  UserCheck,
  ClipboardCheck,
  Grid3X3,
  Printer,
  Monitor,
} from "lucide-react";
import PipelineStageBanner from "../../components/ui/PipelineStageBanner";
import ContestJudgeTable from "../ContestJudgeTable";
import ContestJudgeAssignTable from "../ContestJudgeAssignTable";
import JudgeAssignmentPrint from "../JudgeAssignmentPrint";
import JudgeSeatMatrixPrint from "../JudgeSeatMatrixPrint";

const JudgesHub = ({ defaultTab }) => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // 기존 ContestTimetable state({ tabId: 2 }) 호환
  const legacyStateTab =
    location?.state?.tabId === 2 || location?.state?.tabId === "2"
      ? "assign"
      : null;

  const activeTab =
    searchParams.get("tab") || legacyStateTab || defaultTab || "pool";

  const tabs = [
    {
      key: "pool",
      label: "심판 선발 · 인증번호",
      icon: <Users size={15} strokeWidth={1.6} />,
      badge: "Step 1",
    },
    {
      key: "assign",
      label: "부 · 종목 · 체급 좌석 배정",
      icon: <UserCheck size={15} strokeWidth={1.6} />,
      badge: "Step 2",
    },
    {
      key: "print-assign",
      label: "심판별 배정 안내표 인쇄",
      icon: <ClipboardCheck size={15} strokeWidth={1.6} />,
    },
    {
      key: "print-matrix",
      label: "전체 좌석 매트릭스 인쇄",
      icon: <Grid3X3 size={15} strokeWidth={1.6} />,
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <PipelineStageBanner
        layerBadge="심판 운영 통합 허브"
        title="심판 선발 · 좌석 배정"
        subtitle="전체 심판 풀에서 이번 대회 심판진과 위원장을 선발하고, 부·종목·체급별 심사석 배정부터 안내표 인쇄까지 한 곳에서 처리합니다"
        icon={<UserCheck size={17} strokeWidth={1.6} />}
        sourceCollection="judges_pool (전자서명 원본)"
        targetCollection="contest_judges_pool · contest_judges_assign"
        rollbackHint="전체 심판 풀(judges_pool)의 계정·전자서명 원본은 영구 보존되며, 이번 대회 선발 명단과 좌석 배정만 독립 스냅샷으로 관리됩니다"
        prevStep={{ label: "④ 무대 진행 큐 편성", to: "/stage-4-stages" }}
        nextStep={{ label: "진행 · 채점 모니터링", to: "/contestmonitoring/main" }}
        actions={[
          {
            key: "matrix-print",
            label: "좌석 매트릭스 인쇄",
            onClick: () => setSearchParams({ tab: "print-matrix" }),
            icon: <Printer size={14} strokeWidth={1.6} />,
          },
          {
            key: "judge-head",
            label: "심판위원장 집계석",
            to: "/contestmonitoring/judgeHead",
            icon: <Monitor size={14} strokeWidth={1.6} />,
            variant: "primary",
          },
        ]}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setSearchParams({ tab: key })}
      />

      {activeTab === "assign" ? (
        <div className="w-full px-5 sm:px-6 lg:px-8 py-6">
          <ContestJudgeAssignTable
            onGoPool={() => setSearchParams({ tab: "pool" })}
          />
        </div>
      ) : activeTab === "print-assign" ? (
        <JudgeAssignmentPrint />
      ) : activeTab === "print-matrix" ? (
        <JudgeSeatMatrixPrint />
      ) : (
        <ContestJudgeTable
          onGoAssign={() => setSearchParams({ tab: "assign" })}
        />
      )}
    </div>
  );
};

export default JudgesHub;
