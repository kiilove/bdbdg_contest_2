import React from "react";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import { useState } from "react";
import { useFirestoreGetDocument } from "../hooks/useFirestores";
import { PiSpinner } from "react-icons/pi";
import { useEffect } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useContext } from "react";
import { debounce } from "lodash";
import { useMemo } from "react";

const ContestMonitoringStage = () => {
  const [stagesArray, setStagesArray] = useState([]);
  const [introAuto, setIntroAuto] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSubTab, setCurrentSubTab] = useState("0");
  const [autoCount, setAutoCount] = useState(0);
  const [autoInterval, setAutoInterval] = useState(3000);
  const [playersArray, setPlayersArray] = useState([]);
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});
  const [currentStageInfo, setCurrentStageInfo] = useState({ stageId: null });
  const [currentPlayersInfo, setCurrentPlayersInfo] = useState([]);
  const [currentGradesInfo, setCurrentGradesInfo] = useState([]);
  const fetchStages = useFirestoreGetDocument("contest_stages_assign");
  const fetchFinalPlayers = useFirestoreGetDocument("contest_players_final");
  const { currentContest } = useContext(CurrentContestContext);
  const { data: realtimeData, getDocument: currentStageFunction } =
    useFirebaseRealtimeGetDocument();

  const updatePlayerIntro = useFirebaseRealtimeUpdateData();

  const fetchPool = async (stageAssignId, playerFinalId) => {
    try {
      const returnContestStage = await fetchStages.getDocument(stageAssignId);
      const returnPlayersFinal = await fetchFinalPlayers.getDocument(
        playerFinalId
      );

      if (returnContestStage && returnPlayersFinal) {
        const promises = [
          setStagesArray(
            returnContestStage.stages.sort(
              (a, b) => a.stageNumber - b.stageNumber
            )
          ),
          setPlayersArray(() => [...returnPlayersFinal.players]),

          setIsLoading(false),
        ];

        Promise.all(promises);

        // 1초 후에 setIsLoading을 false로 설정
        // setTimeout(() => {
        //   setIsLoading(false);
        // }, 2000);
      }
    } catch (error) {
      setMessage({
        body: "데이터를 로드하지 못했습니다.",
        body4: error.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  useEffect(() => {
    handlePlayerInfoUpdate(
      currentContest?.contests.id,
      playersArray[autoCount]
    );
  }, [autoCount]);

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
  }, [introAuto, autoCount, isHolding]);

  const handlePlayerInfoUpdate = async (contestId, playerInfo) => {
    const collectionInfo = `currentScreen/${contestId}/playerInfo`;
    try {
      await updatePlayerIntro.updateData(collectionInfo, { ...playerInfo });
    } catch (error) {
      console.log(error);
    }
  };

  const handlePlayerIntroUpdate = async (contestId, actionType) => {
    const collectionInfo = `currentStage/${contestId}/screen`;
    let status = {
      playerIntro: false,
      playerIntroAuto: false,
    };

    let players = { ...playersArray[0] };
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

    if (grades?.length === 0) {
      gradeTitle = "오류발생";
      gradeId = "";
    }
    if (grades.length === 1) {
      gradeTitle = grades[0].gradeTitle;
      gradeId = grades[0].gradeId;
      matchedJudgesCount = grades[0].categoryJudgeCount;
      matchedPlayersCount = grades[0].playerCount;
    } else if (grades.length > 1) {
      const madeTitle = grades.map((grade, gIdx) => {
        return grade.gradeTitle + " ";
      });
      matchedJudgesCount = grades[0].categoryJudgeCount;
      grades.map((grade, gIdx) => {
        matchedPlayersCount = matchedPlayersCount + parseInt(grade.playerCount);
      });
      gradeId = grades[0].gradeId;
      gradeTitle = madeTitle + "통합";
    }

    return { gradeTitle, gradeId, matchedJudgesCount, matchedPlayersCount };
  };

  useEffect(() => {
    console.log(stagesArray);
    console.log(playersArray);
    console.log(realtimeData);
  }, [stagesArray, playersArray]);

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(
        currentContest.contests.contestStagesAssignId,
        currentContest.contests.contestPlayersFinalId
      );
    }
  }, [currentContest?.contests]);

  useEffect(() => {
    if (currentContest?.contests?.id) {
      const debouncedGetDocument = debounce(
        () =>
          currentStageFunction(
            `currentStage/${currentContest.contests.id}`,
            currentContest.contests.id
          ),
        2000
      );
      debouncedGetDocument();
    }

    return () => {};
  }, [currentStageFunction]);

  useEffect(() => {
    let dummy = [];
    const filteredGrades = currentStageInfo?.grades;
    if (filteredGrades?.length > 0) {
      setCurrentGradesInfo(() => [...filteredGrades]);
      const flatted = filteredGrades.map((filter, fIdx) => {
        const filterdPlayers = playersArray.filter(
          (f) => f.contestGradeId === filter.gradeId
        );
        dummy = [...dummy, ...filterdPlayers];
        const newInfo = {
          gradeId: filter.gradeId,
          players: [...filterdPlayers],
        };

        return newInfo;
      });
      setCurrentGradesInfo(() => [...flatted]);
      setPlayersArray(() => [...dummy]);
    }
  }, [currentStageInfo]);

  useEffect(() => {
    setCurrentStageInfo({
      ...stagesArray.find((f) => f.stageId === realtimeData?.stageId),
    });
  }, [realtimeData]);

  return (
    <div className="flex w-full h-auto flex-col justify-start items-center bg-blue-100 rounded-tr-lg rounded-b-lg p-2">
      <div className="flex w-full h-auto justify-start items-center">
        <button
          onClick={() => setCurrentSubTab("0")}
          className={`${
            currentSubTab === "0"
              ? "w-40 h-10 bg-blue-500 text-gray-100 rounded-t-lg"
              : "w-40 h-10 bg-white text-gray-700 rounded-t-lg border-t border-r"
          }`}
        >
          현재 무대상황
        </button>
        <button
          onClick={() => setCurrentSubTab("1")}
          className={`${
            currentSubTab === "1"
              ? "w-40 h-10 bg-blue-500 text-gray-100 rounded-t-lg"
              : "w-40 h-10 bg-white text-gray-700 rounded-t-lg border-t border-r"
          }`}
        >
          전체 무대목록
        </button>
      </div>
      {currentSubTab === "0" && (
        <>
          {realtimeData && (
            <div className="flex w-full flex-col h-auto gap-y-2">
              <div className="flex bg-white p-2 w-full h-auto rounded-lg flex-col justify-center items-start">
                <div className="flex w-full h-14 justify-between items-center gap-x-2 px-2">
                  <div className="flex w-full justify-start items-center gap-x-2">
                    <span className="font-bold text-lg">종목명</span>
                    <span className="font-bold text-lg mx-2">:</span>
                    <span className="font-bold text-lg">
                      {realtimeData.categoryTitle}({realtimeData.gradeTitle})
                    </span>
                    <button
                      className="bg-blue-300 px-4 py-2 rounded-lg"
                      onClick={() => {
                        handlePlayerIntroUpdate(
                          currentContest?.contests?.id,
                          "playerIntroStart"
                        );
                        setAutoCount(0);
                      }}
                    >
                      화면소개시작
                    </button>
                    <input
                      type="checkbox"
                      className="w-5 h-5"
                      onChange={(e) => setIntroAuto(() => e.target.checked)}
                    />
                    <span>자동화면넘김</span>

                    <button
                      className="text-2xl"
                      onClick={() => setAutoInterval(() => autoInterval - 1000)}
                    >
                      ㅡ
                    </button>
                    <span>{autoInterval / 1000}초</span>
                    <button
                      className="text-2xl"
                      onClick={() => setAutoInterval(() => autoInterval + 1000)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex w-full justify-start items-center gap-x-2 bg-white rounded-lg p-2">
                {currentGradesInfo?.length > 0 &&
                  currentGradesInfo.map((grade, gIdx) => {
                    const { players } = grade;
                    return (
                      <div className="flex w-full h-full  gap-2 flex-wrap">
                        {players?.length > 0 &&
                          players.map((pInfo, pIdx) => {
                            return (
                              <>
                                <div
                                  className={
                                    autoCount === pIdx
                                      ? "flex flex-col w-44 h-60 gap-y-1 bg-blue-700 p-5 rounded-lg text-white"
                                      : "flex flex-col w-44 h-60 gap-y-1 bg-blue-200 p-5 rounded-lg"
                                  }
                                >
                                  <div className="flex font-semibold">
                                    <span>{pInfo.playerNumber}</span>
                                    <span>.</span>
                                    <span>{pInfo.playerName}</span>
                                  </div>
                                  <div className="flex font-semibold">
                                    <span>{pInfo.playerGym}</span>
                                  </div>
                                  <div className="flex font-semibold">
                                    <span>{pInfo.playerBirth}</span>
                                  </div>
                                  <div className="flex flex-wrap box-border overflow-auto font-normal">
                                    <span>{pInfo.playerText}</span>
                                  </div>
                                </div>
                              </>
                            );
                          })}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
      {currentSubTab === "1" && (
        <>
          {realtimeData && stagesArray?.length > 0 && (
            <div className="flex w-full flex-col h-auto gap-y-2">
              <div className="flex bg-white p-2 w-full h-auto rounded-lg flex-col justify-center items-start">
                <div className="flex w-full h-14 justify-between items-center gap-x-2 px-2">
                  <div className="flex w-full justify-start items-center gap-x-2">
                    <span className="font-bold text-lg">무대목록</span>
                  </div>
                </div>
                <div className="flex flex-col w-full h-auto gap-y-2 p-2">
                  {stagesArray
                    .sort((a, b) => a.stageNumber - b.stageNumber)
                    .map((stage, sIdx) => {
                      const {
                        grades,
                        stageNumber,
                        stageId,
                        categoryTitle,
                        categoryJudgeType,
                        categoryId,
                      } = stage;
                      const gradeTitle = handleGradeInfo(grades).gradeTitle;
                      const playersCount =
                        handleGradeInfo(grades).matchedPlayersCount;

                      const judgesCount =
                        handleGradeInfo(grades).matchedJudgesCount;
                      return (
                        <div
                          className={`${
                            realtimeData.stageId === stageId
                              ? "flex w-full h-24 justify-start items-center px-5 bg-blue-400 rounded-lg text-gray-100"
                              : "flex w-full h-20 justify-start items-center px-5 bg-blue-100 rounded-lg"
                          }`}
                        >
                          <div className="flex w-full justify-start items-center flex-wrap">
                            <div className="flex w-10  h-auto items-center">
                              <span className="font-semibold">
                                {stageNumber}
                              </span>
                            </div>
                            <div
                              className="flex w-auto px-2 h-auto items-center"
                              style={{ minWidth: "450px" }}
                            >
                              <span className="font-semibold mr-2">
                                {categoryTitle}
                              </span>
                              <span className="font-semibold">
                                ({gradeTitle})
                              </span>
                              <div className="flex w-14 justify-center items-center">
                                {categoryJudgeType === "point" ? (
                                  <span className="bg-blue-400 w-10 flex justify-center rounded-lg text-gray-100">
                                    P
                                  </span>
                                ) : (
                                  <span className="bg-green-500 w-10 flex justify-center rounded-lg text-gray-100">
                                    R
                                  </span>
                                )}
                              </div>
                              {realtimeData.stageId === stageId && (
                                <div className="flex w-auto px-2">
                                  <PiSpinner
                                    className="animate-spin w-8 h-8 "
                                    style={{ animationDuration: "1.5s" }}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex w-auto px-2 text-base font-normal">
                              <span className="mx-10">출전인원수 : </span>
                              <span className="font-semibold">
                                {playersCount}
                              </span>
                            </div>
                          </div>
                          <div className="flex w-1/2 justify-end items-center flex-wrap py-2">
                            <div className="flex w-full gap-x-2 justify-end items-center"></div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ContestMonitoringStage;
