import React from "react";
import { Hash, Printer } from "lucide-react";
import PipelineStageBanner from "../../components/ui/PipelineStageBanner";
import ContestPlayerOrderTableTabType from "../ContestPlayerOrderTableTabType";

const Stage1NumberingHub = () => {
  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <PipelineStageBanner
        layerBadge="1단계 · L1 → L2 스냅샷"
        title="① 초기 배번 확정"
        subtitle="입금 확정된 엔트리(L1)를 불러와 시작 번호 기준 일련번호를 부여하고 계측 기준 명단(L2)을 저장합니다."
        icon={<Hash size={17} strokeWidth={1.6} />}
        sourceCollection="contest_entrys_list (L1)"
        targetCollection="contest_players_assign (L2 초기배번)"
        rollbackHint="순서 변경이나 번호 재배정을 잘못 저장하더라도 입금 확정 엔트리 원본(contest_entrys_list)이 별도 보존되어 있어 언제든 다시 불러와 원복할 수 있습니다."
        prevStep={{ label: "참가 접수 · 입금 확정", to: "/contest-entries" }}
        nextStep={{ label: "② 선수 계측 · 체급 확정", to: "/stage-2-weighin" }}
        actions={[
          {
            key: "print-measure",
            label: "계측 명단 바로 인쇄",
            to: "/print/measurement",
            icon: <Printer size={14} strokeWidth={1.6} />,
            variant: "primary",
          },
        ]}
      />
      <div className="w-full px-5 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
          <ContestPlayerOrderTableTabType />
        </div>
      </div>
    </div>
  );
};

export default Stage1NumberingHub;
