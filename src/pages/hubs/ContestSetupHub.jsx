import React from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Info, QrCode, PlusCircle, ListOrdered } from "lucide-react";
import PipelineStageBanner from "../../components/ui/PipelineStageBanner";
import ContestInfo from "../ContestInfo";
import QRCodeGenerator from "../QRcodeGenerator";
import NewContest from "../NewContest";
import { useIsAdmin } from "./useHubAuth";

const ContestSetupHub = ({ defaultTab }) => {
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const inferredDefault =
    defaultTab ||
    (location.pathname === "/qrcode"
      ? "qr"
      : location.pathname === "/newcontest"
      ? "new"
      : "info");

  const rawTab = searchParams.get("tab") || inferredDefault;
  const activeTab = rawTab === "new" && !isAdmin ? "info" : rawTab;

  const tabs = [
    {
      key: "info",
      label: "대회 기본정보 · 공지",
      icon: <Info size={15} strokeWidth={1.6} />,
    },
    {
      key: "qr",
      label: "참가 접수 QR 코드",
      icon: <QrCode size={15} strokeWidth={1.6} />,
    },
    ...(isAdmin
      ? [
          {
            key: "new",
            label: "새 대회 DB 개설",
            icon: <PlusCircle size={15} strokeWidth={1.6} />,
          },
        ]
      : []),
  ];

  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <PipelineStageBanner
        layerBadge="대회 기준정보 설정"
        title="대회 기본 설정"
        subtitle="대회 요강·일시·장소·채점 DB명 설정 및 참가 접수용 QR 코드를 한곳에서 관리합니다."
        icon={<Info size={17} strokeWidth={1.6} />}
        sourceCollection="contests"
        targetCollection="contest_notice"
        nextStep={{ label: "종목 · 체급 설계", to: "/contest-categories" }}
        actions={[
          {
            key: "categories",
            label: "종목 · 체급 설계 이동",
            to: "/contest-categories",
            icon: <ListOrdered size={14} strokeWidth={1.6} />,
          },
        ]}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setSearchParams({ tab: key })}
      />
      {activeTab === "qr" ? (
        <QRCodeGenerator />
      ) : activeTab === "new" && isAdmin ? (
        <NewContest />
      ) : (
        <ContestInfo />
      )}
    </div>
  );
};

export default ContestSetupHub;
