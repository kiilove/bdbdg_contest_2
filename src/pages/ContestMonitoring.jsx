import React, { useEffect } from "react";
import { useState } from "react";
import LoadingPage from "./LoadingPage";
import { TbHeartRateMonitor } from "react-icons/tb";

import { useContext } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";

import ContestMonitoringBasecamp from "./ContestMonitoringBasecamp";
import ContestMonitoringJudgeHead from "./ContestMonitoringJudgeHead";
import StandingTableType1 from "./StandingTableType1";
import ContestMonitoringStage from "./ContestMonitoringStage";
import { useParams } from "react-router-dom";
import ContestMonitoringMC from "./ContestMonitoringMC";
import ContestMonitoringHost from "./ContestMonitoringHost";

const ContestMonitoring = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const params = useParams();
  const [currentTab, setCurrentTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
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
      children: "",
      visible:
        params.target === "all" || params.target === "main" ? true : false,
    },
    {
      id: 1,
      title: "심판위원장 화면",
      children: "",
      visible:
        params.target === "all" || params.target === "judgeHead" ? true : false,
    },
    {
      id: 2,
      title: "사회자 화면",
      children: "",
      visible: params.target === "all" || params.target === "MC" ? true : false,
    },
    {
      id: 3,
      title: "전광판 화면",
      children: "",
      visible:
        params.target === "all" || params.target === "screen" ? true : false,
    },
  ];

  return (
    <>
      {isLoading && <LoadingPage />}
      {!isLoading && (
        <div className="flex flex-col w-full h-full bg-white rounded-lg p-0 gap-y-2">
          <div className="flex w-full h-full ">
            <div className="flex w-full justify-start items-center">
              <div className="flex w-full h-full justify-start categoryIdart p-0 flex-col bg-gray-100 rounded-lg">
                <div className="flex w-full">
                  {tabArray.map((tab, tIdx) => {
                    if (!tab.visible) {
                      return null;
                    } else {
                      if (params.target === "all") {
                        return (
                          <>
                            <button
                              className={`${
                                currentTab === tab.id
                                  ? " flex w-auto h-10 bg-white px-4"
                                  : " flex w-auto h-10 bg-gray-100 px-4"
                              }  h-14 rounded-t-lg justify-center items-center`}
                              onClick={() => setCurrentTab(tIdx)}
                            >
                              <span>{tab.title}</span>
                            </button>
                          </>
                        );
                      }
                    }
                  })}
                </div>
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
                    contestId={currentContest?.contests.id}
                  />
                )}
                {currentTab === 3 && <StandingTableType1 />}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ContestMonitoring;
