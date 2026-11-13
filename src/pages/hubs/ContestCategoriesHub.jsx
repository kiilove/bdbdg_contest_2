import React from "react";
import { Layers, UserCheck } from "lucide-react";
import PipelineStageBanner from "../../components/ui/PipelineStageBanner";
import ContestCategoryOrderTable from "../ContestCategoryOrderTable";

const ContestCategoriesHub = () => {
  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <PipelineStageBanner
        layerBadge="대회 골격 설계"
        title="종목 · 체급 설계"
        subtitle="부(1부/2부/그랑프리) 구분, 종목별 심판제(5·7·9심) 및 심사방식(랭킹·점수형), 체급 진행 순서를 구성합니다."
        icon={<Layers size={17} strokeWidth={1.6} />}
        sourceCollection="대회 요강 기준"
        targetCollection="contest_categorys_list · contest_grades_list"
        rollbackHint="종목·체급 설계 문서는 접수 원본(invoices_pool) 및 선수 명단과 분리 저장되어, 순서나 심판제를 조정해도 기존 접수 원본은 보존됩니다."
        prevStep={{ label: "대회 기본 설정", to: "/contest-setup" }}
        nextStep={{ label: "참가 접수 · 입금 확정", to: "/contest-entries" }}
        actions={[
          {
            key: "judges",
            label: "심판 좌석 배정 이동",
            to: "/judges-hub?tab=assign",
            icon: <UserCheck size={14} strokeWidth={1.6} />,
          },
        ]}
      />
      <div className="max-w-[1440px] mx-auto px-6 py-6">
        <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
          <ContestCategoryOrderTable />
        </div>
      </div>
    </div>
  );
};

export default ContestCategoriesHub;
