import React from "react";
import { SlidersHorizontal, UserCheck, Monitor } from "lucide-react";
import PipelineStageBanner from "../../components/ui/PipelineStageBanner";
import ContestStagetable from "../ContestStagetable";

const Stage4StagesHub = () => {
  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <PipelineStageBanner
        layerBadge="4단계 · L3 → L4 무대 진행 큐"
        title="④ 무대 진행 큐 편성"
        subtitle="최종 출전 명단(L3)을 바탕으로 단독·통합 무대 구성 및 실제 본대회 무대 호출 순서(L4)를 확정합니다."
        icon={<SlidersHorizontal size={17} strokeWidth={1.6} />}
        sourceCollection="contest_players_final (L3)"
        targetCollection="contest_stages_assign (L4 무대큐)"
        rollbackHint="체급 통합·분리나 무대 순서를 잘못 편집하더라도 최종 출전 명단(contest_players_final) 원본은 훼손되지 않으므로 언제든 무대 목록을 안전하게 초기화·재생성할 수 있습니다."
        prevStep={{ label: "③ 최종 출전 · 그랑프리", to: "/stage-3-final" }}
        nextStep={{ label: "심판 선발 · 좌석 배정", to: "/judges-hub" }}
        actions={[
          {
            key: "judges",
            label: "심판 좌석 배정",
            to: "/judges-hub?tab=assign",
            icon: <UserCheck size={14} strokeWidth={1.6} />,
          },
          {
            key: "live",
            label: "본부석 라이브 콘솔",
            to: "/contestmonitoring/main",
            icon: <Monitor size={14} strokeWidth={1.6} />,
            variant: "primary",
          },
        ]}
      />
      <ContestStagetable />
    </div>
  );
};

export default Stage4StagesHub;
