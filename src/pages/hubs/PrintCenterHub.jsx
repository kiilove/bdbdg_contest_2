import React from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Printer,
  Scale,
  Users,
  BarChart3,
  FileText,
  Building2,
  ClipboardCheck,
  Grid3X3,
} from "lucide-react";
import PipelineStageBanner from "../../components/ui/PipelineStageBanner";
import UnifiedPrint from "../../printForms/UnifiedPrint";
import PrintSummary from "../../printForms/PrintSummary";
import GymGroupPrint from "../../printForms/GymGroupPrint";
import JudgeAssignmentPrint from "../JudgeAssignmentPrint";
import JudgeSeatMatrixPrint from "../JudgeSeatMatrixPrint";

const PRINT_TABS = [
  {
    key: "measurement",
    label: "계측 명단",
    badge: "L2",
    path: "/print/measurement",
    icon: <Scale size={14} strokeWidth={1.6} />,
  },
  {
    key: "final",
    label: "최종 출전 명단",
    badge: "L3",
    path: "/print/final",
    icon: <Users size={14} strokeWidth={1.6} />,
  },
  {
    key: "ranking",
    label: "공식 순위표",
    badge: "L4",
    path: "/print/ranking",
    icon: <BarChart3 size={14} strokeWidth={1.6} />,
  },
  {
    key: "summary",
    label: "심판 채점 집계표",
    badge: "L4 Raw",
    path: "/printsummary",
    icon: <FileText size={14} strokeWidth={1.6} />,
  },
  {
    key: "gymgroup",
    label: "클럽·소속별 집계",
    badge: "종합",
    path: "/printgymgroup",
    icon: <Building2 size={14} strokeWidth={1.6} />,
  },
  {
    key: "judgeassign",
    label: "심판별 배정표",
    path: "/judgeassignmentPrint",
    icon: <ClipboardCheck size={14} strokeWidth={1.6} />,
  },
  {
    key: "judgematrix",
    label: "심판 좌석 매트릭스",
    path: "/judgeseatmatrixprint",
    icon: <Grid3X3 size={14} strokeWidth={1.6} />,
  },
];

const PrintCenterHub = ({ defaultType }) => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const resolveActiveKey = () => {
    const qTab = searchParams.get("tab");
    if (qTab) return qTab;
    if (defaultType) return defaultType;
    if (params.printType) {
      if (params.printType === "gymgroup") return "gymgroup";
      if (params.printType === "summary") return "summary";
      if (params.printType === "judgeassignment") return "judgeassign";
      if (params.printType === "judgeseatmatrix") return "judgematrix";
      return params.printType;
    }
    const p = location.pathname.toLowerCase();
    if (p.includes("gymgroup")) return "gymgroup";
    if (p.includes("summary")) return "summary";
    if (p.includes("judgeassignment")) return "judgeassign";
    if (p.includes("judgeseatmatrix")) return "judgematrix";
    return "measurement";
  };

  const activeKey = resolveActiveKey();

  const handleTabChange = (key) => {
    const target = PRINT_TABS.find((t) => t.key === key);
    if (target) {
      navigate(target.path);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#fafafa] print:bg-white">
      <PipelineStageBanner
        layerBadge="A4 공식 문서 · 집계 통합 센터"
        title="통합 출력 · 공식 집계 센터"
        subtitle="계측 기준표(L2), 최종 출전표(L3), 공식 순위·채점 집계표(L4), 심판 배정표 등 대회의 모든 공식 A4 인쇄물과 엑셀 출력을 한곳에서 처리합니다."
        icon={<Printer size={17} strokeWidth={1.6} />}
        tabs={PRINT_TABS}
        activeTab={activeKey}
        onTabChange={handleTabChange}
      />

      {activeKey === "summary" ? (
        <PrintSummary />
      ) : activeKey === "gymgroup" ? (
        <GymGroupPrint />
      ) : activeKey === "judgeassign" ? (
        <JudgeAssignmentPrint />
      ) : activeKey === "judgematrix" ? (
        <JudgeSeatMatrixPrint />
      ) : (
        <UnifiedPrint forcedPrintType={activeKey} hideTopTabs={true} />
      )}
    </div>
  );
};

export default PrintCenterHub;
