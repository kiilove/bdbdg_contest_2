import React, { useState, useEffect, useContext } from "react";
import { Play, Minus, Plus, Monitor, List } from "lucide-react";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import { useFirestoreGetDocument } from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import LoadingPage from "./LoadingPage";
import { BibTag, StatusDot } from "../components/ui/BibTag";

const ContestMonitoringStage = () => {
  const [stagesArray, setStagesArray] = useState([]);
  const [introAuto, setIntroAuto] = useState(false);
  const [isHolding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSubTab, setCurrentSubTab] = useState("0");
  const [autoCount, setAutoCount] = useState(0);
  const [autoInterval, setAutoInterval] = useState(3000);
  const [allPlayersArray, setAllPlayersArray] = useState([]);
  const [playersArray, setPlayersArray] = useState([]);
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});
  const [currentStageInfo, setCurrentStageInfo] = useState({ stageId: null });
  const [currentGradesInfo, setCurrentGradesInfo] = useState([]);

  const fetchStages = useFirestoreGetDocument("contest_stages_assign");
  const fetchFinalPlayers = useFirestoreGetDocument("contest_players_final");
  const { currentContest } = useContext(CurrentContestContext);
  const { data: realtimeData } = useFirebaseRealtimeGetDocument(
    currentContest?.contests?.id
      ? `currentStage/${currentContest.contests.id}`
      : null
  );

  const updatePlayerIntro = useFirebaseRealtimeUpdateData();

  const fetchPool = async (stageAssignId, playerFinalId) => {
    try {
      const returnContestStage = await fetchStages.getDocument(stageAssignId);
      const returnPlayersFinal = await fetchFinalPlayers.getDocument(
        playerFinalId
      );

      if (returnContestStage && returnPlayersFinal) {
        setStagesArray(
          (returnContestStage.stages || []).sort(
            (a, b) => a.stageNumber - b.stageNumber
          )
        );
        setAllPlayersArray([...(returnPlayersFinal.players || [])]);
        setIsLoading(false);
      }
    } catch (error) {
      setMessage({
        variant: "error",
        title: "무대 데이터 로드 실패",
        body: "무대 모니터링 데이터를 불러오지 못했습니다.",
        body4: error.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const contestId = currentContest?.contests?.id;
    const playerInfo = playersArray[autoCount];
    if (contestId && playerInfo) {
      handlePlayerInfoUpdate(contestId, playerInfo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCount, currentContest?.contests?.id, playersArray]);

  useEffect(() => {
    let interval;

    if (!isHolding && introAuto && autoCount < playersArray.length) {
      interval = setInterval(() => {
        setAutoCount((prevCount) => prevCount + 1);
      }, autoInterval);
    } else {
      clearInterval(interval);
    }

    return () => {
      clearInterval(interval);
    };
  }, [introAuto, autoCount, isHolding, playersArray.length, autoInterval]);

  const handlePlayerInfoUpdate = async (contestId, playerInfo) => {
    if (!contestId || !playerInfo) return;
    const collectionInfo = `currentScreen/${contestId}/playerInfo`;
    try {
      await updatePlayerIntro.updateData(collectionInfo, { ...playerInfo });
    } catch (error) {
      console.log(error);
    }
  };

  const handlePlayerIntroUpdate = async (contestId, actionType) => {
    if (!contestId) return;
    const collectionInfo = `currentStage/${contestId}/screen`;
    let status = {
      playerIntro: false,
      playerIntroAuto: false,
    };

    const players = playersArray[0] ? { ...playersArray[0] } : {};
    switch (actionType) {
      case "playerIntroStart":
        status = { playerIntro: true, playerIntroAuto: introAuto, players };
        break;
      default:
        break;
    }

    try {
      await updatePlayerIntro.updateData(collectionInfo, { ...status });
    } catch (error) {
      console.log(error);
    }
  };

  const handleGradeInfo = (grades) => {
    let gradeTitle = "";
    let gradeId = "";
    let matchedJudgesCount = 0;
    let matchedPlayersCount = 0;

    if (!grades || grades.length === 0) {
      return {
        gradeTitle: "미지정",
        gradeId: "",
        matchedJudgesCount: 0,
        matchedPlayersCount: 0,
      };
    }
    if (grades.length === 1) {
      gradeTitle = grades[0].gradeTitle;
      gradeId = grades[0].gradeId;
      matchedJudgesCount = grades[0].categoryJudgeCount;
      matchedPlayersCount = grades[0].playerCount;
    } else if (grades.length > 1) {
      const madeTitle = grades
        .map((grade) => `${grade.gradeTitle || ""} `)
        .join("");
      matchedJudgesCount = grades[0].categoryJudgeCount;
      grades.forEach((grade) => {
        matchedPlayersCount =
          matchedPlayersCount + (parseInt(grade.playerCount, 10) || 0);
      });
      gradeId = grades[0].gradeId;
      gradeTitle = madeTitle + "통합";
    }

    return { gradeTitle, gradeId, matchedJudgesCount, matchedPlayersCount };
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(
        currentContest.contests.contestStagesAssignId,
        currentContest.contests.contestPlayersFinalId
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests]);

  useEffect(() => {
    const filteredGrades = currentStageInfo?.grades;
    if (filteredGrades?.length > 0) {
      let dummy = [];
      const flatted = filteredGrades.map((filter) => {
        const filterdPlayers = allPlayersArray
          .filter(
            (f) =>
              f.contestGradeId === filter.gradeId && f.playerNoShow !== true
          )
          .sort(
            (a, b) =>
              (a.grandPrixIndex ?? a.playerIndex ?? 0) -
              (b.grandPrixIndex ?? b.playerIndex ?? 0)
          );
        dummy = [...dummy, ...filterdPlayers];
        return {
          gradeId: filter.gradeId,
          players: [...filterdPlayers],
        };
      });
      setCurrentGradesInfo(() => [...flatted]);
      setPlayersArray(() => [...dummy]);
      setAutoCount(0);
    } else {
      setCurrentGradesInfo([]);
      setPlayersArray([]);
    }
  }, [currentStageInfo, allPlayersArray]);

  useEffect(() => {
    const found = stagesArray.find((f) => f.stageId === realtimeData?.stageId);
    setCurrentStageInfo(found ? { ...found } : { stageId: null });
  }, [realtimeData, stagesArray]);

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#fafafa] text-[#171717] p-6 space-y-4">
      <ConfirmationModal
        isOpen={msgOpen}
        message={message}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />

      <div className="inline-flex items-center gap-1 p-1 bg-[#f4f4f5] border border-[#171717]/[0.08] rounded-[10px] self-start">
        <button
          type="button"
          onClick={() => setCurrentSubTab("0")}
          className={`inline-flex items-center gap-2 h-8 px-3.5 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
            currentSubTab === "0"
              ? "bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
              : "text-[#525252] hover:text-[#171717]"
          }`}
        >
          <Monitor size={16} strokeWidth={1.5} className="text-[#737373]" />
          <span>현재 무대 현황</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentSubTab("1")}
          className={`inline-flex items-center gap-2 h-8 px-3.5 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
            currentSubTab === "1"
              ? "bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
              : "text-[#525252] hover:text-[#171717]"
          }`}
        >
          <List size={16} strokeWidth={1.5} className="text-[#737373]" />
          <span>전체 무대 목록</span>
        </button>
      </div>

      {currentSubTab === "0" && realtimeData && (
        <div className="space-y-4">
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <StatusDot status="live" live />
              <div>
                <div className="text-xs text-[#737373]">현재 진행 종목</div>
                <div className="text-base font-semibold text-[#171717]">
                  {realtimeData.categoryTitle}{" "}
                  <span className="text-[#525252] font-normal">
                    ({realtimeData.gradeTitle})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium transition-colors active:scale-[0.98] cursor-pointer"
                onClick={() => {
                  handlePlayerIntroUpdate(
                    currentContest?.contests?.id,
                    "playerIntroStart"
                  );
                  setAutoCount(0);
                }}
              >
                <Play size={16} strokeWidth={1.5} />
                <span>화면 소개 시작</span>
              </button>

              <label className="inline-flex items-center gap-2 h-9 px-3 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs font-medium text-[#171717] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={introAuto}
                  className="w-4 h-4 accent-[#2563eb]"
                  onChange={(e) => setIntroAuto(() => e.target.checked)}
                />
                <span>자동 화면 전환</span>
              </label>

              <div className="inline-flex items-center gap-1 h-9 px-2 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08]">
                <button
                  type="button"
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[#525252] hover:bg-white hover:text-[#171717] transition-colors cursor-pointer"
                  onClick={() =>
                    setAutoInterval(() => Math.max(1000, autoInterval - 1000))
                  }
                >
                  <Minus size={16} strokeWidth={1.5} />
                </button>
                <span className="min-w-[44px] text-center font-mono tabular-nums text-xs font-medium text-[#171717]">
                  {autoInterval / 1000}초
                </span>
                <button
                  type="button"
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[#525252] hover:bg-white hover:text-[#171717] transition-colors cursor-pointer"
                  onClick={() => setAutoInterval(() => autoInterval + 1000)}
                >
                  <Plus size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {currentGradesInfo?.length > 0 &&
              currentGradesInfo.map((grade, gIdx) => {
                const { players } = grade;
                return (
                  <div
                    key={grade.gradeId || gIdx}
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
                  >
                    {players?.length > 0 &&
                      players.map((pInfo, pIdx) => {
                        const isActive = autoCount === pIdx;
                        return (
                          <div
                            key={pInfo.playerUid || pInfo.playerNumber || pIdx}
                            className={`flex flex-col gap-2 rounded-[12px] p-4 border transition-colors ${
                              isActive
                                ? "bg-white border-[#2563eb] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                                : "bg-white border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <BibTag
                                  number={pInfo.playerNumber}
                                  variant={isActive ? "active" : "default"}
                                />
                                <span className="text-sm font-medium text-[#171717]">
                                  {pInfo.playerName}
                                </span>
                              </div>
                              {isActive && (
                                <StatusDot status="active" live={introAuto} />
                              )}
                            </div>

                            <div className="text-xs text-[#525252]">
                              {pInfo.playerGym || "무소속"}
                              {pInfo.playerBirth ? ` · ${pInfo.playerBirth}` : ""}
                            </div>

                            {pInfo.playerText && (
                              <div className="text-xs text-[#737373] bg-[#f4f4f5] rounded-[8px] p-2.5 max-h-28 overflow-y-auto leading-5">
                                {pInfo.playerText}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {currentSubTab === "1" && realtimeData && stagesArray?.length > 0 && (
        <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-[#171717]">
              전체 무대 목록
            </span>
            <span className="font-mono tabular-nums text-xs text-[#737373]">
              총 {stagesArray.length}개 무대
            </span>
          </div>

          <div className="divide-y divide-[#171717]/[0.06]">
            {[...stagesArray]
              .sort((a, b) => a.stageNumber - b.stageNumber)
              .map((stage, sIdx) => {
                const {
                  grades,
                  stageNumber,
                  stageId,
                  categoryTitle,
                  categoryJudgeType,
                } = stage;
                const info = handleGradeInfo(grades);
                const isCurrent = realtimeData.stageId === stageId;

                return (
                  <div
                    key={stageId || sIdx}
                    className={`flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 transition-colors ${
                      isCurrent ? "bg-[#2563eb]/[0.05]" : "hover:bg-[#fafafa]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <BibTag
                        number={stageNumber}
                        size="sm"
                        variant={isCurrent ? "active" : "default"}
                      />
                      <span className="text-sm font-medium text-[#171717]">
                        {categoryTitle}
                      </span>
                      <span className="text-sm text-[#525252]">
                        ({info.gradeTitle})
                      </span>
                      <span className="px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] font-mono text-[11px] font-medium text-[#525252]">
                        {categoryJudgeType === "point" ? "P" : "R"}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563eb]">
                          <StatusDot status="live" live />
                          <span>진행 중</span>
                        </span>
                      )}
                    </div>

                    <div className="font-mono tabular-nums text-xs text-[#525252]">
                      출전 인원 {info.matchedPlayersCount}명
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContestMonitoringStage;
