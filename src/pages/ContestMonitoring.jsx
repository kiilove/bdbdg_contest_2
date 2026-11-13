import React, { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Monitor, Scale, Mic } from "lucide-react";
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ContestMonitoringBasecamp from "./ContestMonitoringBasecamp";
import ContestMonitoringJudgeHead from "./ContestMonitoringJudgeHead";
import StandingTableType1 from "./StandingTableType1";
import ContestMonitoringHost from "./ContestMonitoringHost";

const ContestMonitoring = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const params = useParams();
  const [currentTab, setCurrentTab] = useState(0);
  const [isLoading] = useState(false);
  const [isHolding, setIsHolding] = useState(false);

  useEffect(() => {
    switch (params.target) {
      case "all":
        break;
      case "main":
        setCurrentTab(0);
        break;
      case "judgeHead":
        setCurrentTab(1);
        break;
      case "MC":
        setCurrentTab(2);
        break;
      default:
        break;
    }
  }, [params]);

  const tabArray = [
    {
      id: 0,
      title: "본부석 화면",
      icon: Monitor,
      children: "",
      visible: params.target === "all" || params.target === "main",
    },
    {
      id: 1,
      title: "심판위원장 화면",
      icon: Scale,
      children: "",
      visible: params.target === "all" || params.target === "judgeHead",
    },
    {
      id: 2,
      title: "사회자 화면",
      icon: Mic,
      children: "",
      visible: params.target === "all" || params.target === "MC",
    },
  ];

  // 대회 정보가 완전히 불러와질 때까지 대기
  const isContestLoaded = Boolean(
    currentContest?.contests?.id || currentContest?.id
  );

  if (isLoading || !isContestLoaded) {
    return <LoadingPage />;
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#fafafa] text-[#171717]">
      {params.target === "all" && (
        <div className="flex items-center gap-1 w-full bg-[#f4f4f5] border-b border-[#171717]/[0.08] px-6 pt-2">
          {tabArray.map((tab, tIdx) => {
            if (!tab.visible) return null;
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCurrentTab(tIdx)}
                className={`inline-flex items-center gap-2 h-10 px-4 rounded-t-[8px] text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#fafafa] text-[#171717] border border-b-0 border-[#171717]/[0.08]"
                    : "bg-transparent text-[#525252] hover:text-[#171717]"
                }`}
              >
                <Icon
                  size={16}
                  strokeWidth={1.5}
                  className={isActive ? "text-[#2563eb]" : "text-[#737373]"}
                />
                <span>{tab.title}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 w-full">
        {params.target === "all" && currentTab === 0 && (
          <ContestMonitoringBasecamp
            isHolding={isHolding}
            setIsHolding={setIsHolding}
          />
        )}
        {params.target === "main" && currentTab === 0 && (
          <ContestMonitoringBasecamp
            isHolding={isHolding}
            setIsHolding={setIsHolding}
          />
        )}
        {currentTab === 1 && (
          <ContestMonitoringJudgeHead
            isHolding={isHolding}
            setIsHolding={setIsHolding}
          />
        )}
        {currentTab === 2 && (
          <ContestMonitoringHost
            contestId={currentContest?.contests?.id || currentContest?.id || ""}
          />
        )}
        {currentTab === 3 && <StandingTableType1 />}
      </div>
    </div>
  );
};

export default ContestMonitoring;
