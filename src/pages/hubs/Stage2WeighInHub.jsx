import React from "react";
import { Scale, Printer, FileSpreadsheet } from "lucide-react";
import PipelineStageBanner from "../../components/ui/PipelineStageBanner";
import ContestPlayerWeighInTable from "../ContestPlayerWeighInTable";

const Stage2WeighInHub = () => {
  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <PipelineStageBanner
        layerBadge="2단계 · L2 → L3 스냅샷"
        title="② 선수 계측 · 체급 확정"
        subtitle="초기 배번 명단(L2)을 기준으로 현장 체중·신장 계측, 월체(체급 변경), 결시(불참)를 반영하여 최종 출전 명단(L3)을 확정합니다."
        icon={<Scale size={17} strokeWidth={1.6} />}
        sourceCollection="contest_players_assign (L2)"
        targetCollection="contest_players_final (L3 최종출전)"
        rollbackHint="현장 계측 중 월체 이동이나 결시 처리를 잘못하더라도 계측 전 초기 배번 원본(contest_players_assign)과 원래 체급(originalGradeId)이 보존되어 즉시 원복할 수 있습니다."
        prevStep={{ label: "① 초기 배번 확정", to: "/stage-1-numbering" }}
        nextStep={{ label: "③ 최종 출전 · 그랑프리", to: "/stage-3-final" }}
        actions={[
          {
            key: "print-measure",
            label: "계측 명단 인쇄",
            to: "/print/measurement",
            icon: <Printer size={14} strokeWidth={1.6} />,
          },
          {
            key: "print-final",
            label: "최종 출전 명단 인쇄",
            to: "/print/final",
            icon: <FileSpreadsheet size={14} strokeWidth={1.6} />,
            variant: "primary",
          },
        ]}
      />
      <ContestPlayerWeighInTable />
    </div>
  );
};

export default Stage2WeighInHub;
