import React from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { UserCog, Shuffle, RotateCcw } from "lucide-react";
import PipelineStageBanner from "../../components/ui/PipelineStageBanner";
import AssociationManagers from "../AssociationManagers";
import RandomPlayerGenerator from "../RandomPlayerGenerator";
import ContestSearchAndDelete from "../ContestSearchAndDelete";
import { useIsAdmin } from "./useHubAuth";

const SystemToolsHub = ({ defaultTab }) => {
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const inferredDefault =
    defaultTab ||
    (location.pathname === "/randomgenerator"
      ? "random"
      : location.pathname === "/clear"
      ? "clear"
      : "managers");

  const activeTab = searchParams.get("tab") || inferredDefault;

  const tabs = [
    {
      key: "managers",
      label: "협회 관리자 계정 관리",
      icon: <UserCog size={15} strokeWidth={1.6} />,
    },
    {
      key: "random",
      label: "테스트용 랜덤 신청서 생성",
      icon: <Shuffle size={15} strokeWidth={1.6} />,
      badge: "테스트 전용",
    },
    {
      key: "clear",
      label: "대회 신청 데이터 초기화",
      icon: <RotateCcw size={15} strokeWidth={1.6} />,
      badge: "주의",
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <PipelineStageBanner
        layerBadge="시스템 권한 · 테스트 유틸리티"
        title="시스템 · 테스트 도구"
        subtitle="협회별 운영 관리자 계정 권한을 관리하며, 사전 리허설용 테스트 데이터 생성 및 초기화 도구를 일상 운영 메뉴와 안전하게 분리해 제공합니다."
        icon={<UserCog size={17} strokeWidth={1.6} />}
        rollbackHint="랜덤 신청서 생성 및 데이터 초기화 탭은 사전 리허설/테스트 대회 전용입니다. 실제 접수 중인 본대회에서는 절대 초기화 기능을 실행하지 마십시오."
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setSearchParams({ tab: key })}
      />
      {activeTab === "random" ? (
        <RandomPlayerGenerator />
      ) : activeTab === "clear" ? (
        <ContestSearchAndDelete />
      ) : (
        <AssociationManagers />
      )}
    </div>
  );
};

export default SystemToolsHub;
