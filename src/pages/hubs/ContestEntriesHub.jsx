import React from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ClipboardList, FilePlus2, Inbox, Hash } from "lucide-react";
import PipelineStageBanner from "../../components/ui/PipelineStageBanner";
import ContestInvoiceTable from "../ContestInvoiceTable";
import ContestNewInvoiceManual from "../ContestNewInvoiceManual";
import SimpleInvoicesAdmin from "../SimpleInvoicesAdmin";
import { useIsAdmin } from "./useHubAuth";

const ContestEntriesHub = ({ defaultTab }) => {
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const inferredDefault =
    defaultTab ||
    (location.pathname === "/contestnewinvoicemanual"
      ? "manual"
      : location.pathname === "/simpleinvoiceadmin"
      ? "raw"
      : "invoices");

  const rawTab = searchParams.get("tab") || inferredDefault;
  const activeTab = rawTab === "raw" && !isAdmin ? "invoices" : rawTab;

  const tabs = [
    {
      key: "invoices",
      label: "신청서 목록 · 입금 확정",
      icon: <ClipboardList size={15} strokeWidth={1.6} />,
      badge: "L0 → L1",
    },
    {
      key: "manual",
      label: "+ 수기 신청서 등록",
      icon: <FilePlus2 size={15} strokeWidth={1.6} />,
    },
    ...(isAdmin
      ? [
          {
            key: "raw",
            label: "원본 신청서 정리 (관리자)",
            icon: <Inbox size={15} strokeWidth={1.6} />,
            badge: "L0 Raw",
          },
        ]
      : []),
  ];

  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <PipelineStageBanner
        layerBadge="접수 단계 · L0 → L1 스냅샷"
        title="참가 접수 · 입금 확정"
        subtitle="온라인·수기 참가신청서(L0)의 입금 여부를 확인하여 초기 배번 대상인 확정 엔트리(L1)를 생성합니다."
        icon={<ClipboardList size={17} strokeWidth={1.6} />}
        sourceCollection="invoices_pool (L0 원본)"
        targetCollection="contest_entrys_list (L1 확정엔트리)"
        rollbackHint="입금 확인을 해제하거나 이후 배번이 꼬이더라도, 선수가 접수한 최초 신청서 원본(invoices_pool)과 처리 이력(priceCheckLogs)은 영구 보존됩니다."
        prevStep={{ label: "종목 · 체급 설계", to: "/contest-categories" }}
        nextStep={{ label: "① 초기 배번 확정", to: "/stage-1-numbering" }}
        actions={[
          {
            key: "numbering",
            label: "① 초기 배번 확정으로 이동",
            to: "/stage-1-numbering",
            icon: <Hash size={14} strokeWidth={1.6} />,
          },
        ]}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setSearchParams({ tab: key })}
      />
      {activeTab === "manual" ? (
        <ContestNewInvoiceManual />
      ) : activeTab === "raw" && isAdmin ? (
        <SimpleInvoicesAdmin />
      ) : (
        <ContestInvoiceTable />
      )}
    </div>
  );
};

export default ContestEntriesHub;
