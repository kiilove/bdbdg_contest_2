import React, { useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Monitor, Scale, Mic } from "lucide-react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ContestMonitoringBasecamp from "./ContestMonitoringBasecamp";
import ContestMonitoringJudgeHead from "./ContestMonitoringJudgeHead";
import StandingTableType1 from "./StandingTableType1";
import ContestMonitoringHost from "./ContestMonitoringHost";
import {
  MonitoringBlockingState,
  MonitoringDiagnosticsBar,
} from "../components/monitoring/MonitoringDiagnosticsBar";

const ContestMonitoring = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const params = useParams();
  const [currentTab, setCurrentTab] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  const normalizedTarget = useMemo(
    () => String(params.target || "main").toLowerCase(),
    [params.target]
  );

  useEffect(() => {
    switch (normalizedTarget) {
      case "all":
        break;
      case "main":
      case "basecamp":
        setCurrentTab(0);
        break;
      case "judgehead":
        setCurrentTab(1);
        break;
      case "mc":
      case "host":
        setCurrentTab(2);
        break;
      case "screen":
      case "standing":
        setCurrentTab(3);
        break;
      default:
        setCurrentTab(0);
        break;
    }
  }, [normalizedTarget]);

  const tabArray = [
    {
      id: 0,
      title: "본부석 화면",
      icon: Monitor,
      visible:
        normalizedTarget === "all" ||
        normalizedTarget === "main" ||
        normalizedTarget === "basecamp",
    },
    {
      id: 1,
      title: "심판위원장 화면",
      icon: Scale,
      visible: normalizedTarget === "all" || normalizedTarget === "judgehead",
    },
    {
      id: 2,
      title: "사회자 화면",
      icon: Mic,
      visible:
        normalizedTarget === "all" ||
        normalizedTarget === "mc" ||
        normalizedTarget === "host",
    },
  ];

  const contestId = currentContest?.contests?.id || currentContest?.id || "";
  const isDarkScreen = currentTab === 2;
  const screenMeta =
    currentTab === 1
      ? { type: "judgeHead", label: "심판위원장 모니터링 화면" }
      : currentTab === 2
      ? { type: "host", label: "사회자 프롬프터 콘솔" }
      : { type: "basecamp", label: "본부석 운영 콘솔" };

  // 선택된 대회가 없을 때 무한 로딩 대신 명확한 데이터 미선택 진단 및 울트라퀵 메뉴 표시
  if (!contestId) {
    return (
      <div
        className={`flex flex-col w-full min-h-screen p-4 md:p-6 gap-4 ${
          isDarkScreen
            ? "bg-[#141415] text-[#ededed]"
            : "bg-[#fafafa] text-[#171717]"
        }`}
      >
        <MonitoringDiagnosticsBar
          variant={isDarkScreen ? "dark" : "light"}
          screenType={screenMeta.type}
          defaultExpanded={true}
        />
        <MonitoringBlockingState
          variant={isDarkScreen ? "dark" : "light"}
          screenType={screenMeta.type}
          screenLabel={screenMeta.label}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#fafafa] text-[#171717]">
      {normalizedTarget === "all" && (
        <div className="flex items-center gap-1 w-full bg-[#f4f4f5] border-b border-[#171717]/[0.08] px-6 pt-2">
          {tabArray.map((tab) => {
            if (!tab.visible) return null;
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCurrentTab(tab.id)}
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
        {currentTab === 0 && (
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
        {currentTab === 2 && <ContestMonitoringHost contestId={contestId} />}
        {currentTab === 3 && <StandingTableType1 />}
      </div>
    </div>
  );
};

export default ContestMonitoring;
