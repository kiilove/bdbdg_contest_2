"use client";

import { useContext, useEffect, useState } from "react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { matchedGradewWithPlayers } from "../functions/functions";
import { Card, Button, Tag, Space, Spin, message } from "antd";
import {
  UpOutlined,
  DownOutlined,
  EyeOutlined,
  SendOutlined,
  TrophyOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";

const ContestMonitoringHost = ({ contestId }) => {
  const [players, setPlayers] = useState([]);
  const [stagesArray, setStagesArray] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPlayersArray, setCurrentPlayersArray] = useState([]);
  const [contestInfo, setContestInfo] = useState({});
  const [selectedPlayerUid, setSelectedPlayerUid] = useState(null);
  const { currentContest } = useContext(CurrentContestContext);
  const fetchResultQuery = useFirestoreQuery();
  const [rankingData, setRankingData] = useState(null);
  const [isRankingView, setIsRankingView] = useState(false);
  const [isReversed, setIsReversed] = useState(false);
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== "undefined"
      ? window.innerWidth > window.innerHeight
      : false
  );

  // ✅ 사회자 비교심사 전용 상태
  const [isCompareView, setIsCompareView] = useState(false);
  const [compareNumbers, setCompareNumbers] = useState([]);

  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );

  const updateCurrentStage = useFirebaseRealtimeUpdateData();

  const fetchNotice = useFirestoreGetDocument("contest_notice");
  const fetchStages = useFirestoreGetDocument("contest_stages_assign");
  const fetchFinalPlayers = useFirestoreGetDocument("contest_players_final");

  const fetchPool = async (
    noticeId,
    contestId,
    stageAssignId,
    playerFinalId,
    currentStageId
  ) => {
    try {
      const [returnNotice, returnContestStage, returnPlayersFinal] =
        await Promise.all([
          fetchNotice.getDocument(noticeId),
          fetchStages.getDocument(stageAssignId),
          fetchFinalPlayers.getDocument(playerFinalId),
        ]);

      if (returnNotice && returnContestStage && returnPlayersFinal) {
        setStagesArray(
          returnContestStage.stages.sort(
            (a, b) => a.stageNumber - b.stageNumber
          )
        );
        setContestInfo(returnNotice);

        const players = returnPlayersFinal.players
          .sort((a, b) => a.playerIndex - b.playerIndex)
          .filter((f) => f.playerNoShow === false);

        const currentStage = returnContestStage.stages.find(
          (f) => f.stageId === currentStageId
        );
        const currentStageGrades = currentStage ? currentStage.grades : [];

        const playerList = currentStageGrades.length
          ? currentStageGrades.map((grade) => {
              const matchedPlayers = matchedGradewWithPlayers(
                contestId,
                grade.gradeId,
                players
              );
              return {
                gradeTitle: grade.gradeTitle,
                gradeId: grade.gradeId,
                players: matchedPlayers,
              };
            })
          : [];

        setCurrentPlayersArray(playerList);
      }
    } catch (error) {
      console.error("데이터 로드 중 에러:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewRanking = async (gradeId, gradeTitle) => {
    if (isRankingView) {
      setIsRankingView(false);
      setRankingData(null);
    } else {
      const condition = [where("gradeId", "==", gradeId)];
      try {
        const data = await fetchResultQuery.getDocuments(
          "contest_results_list",
          condition
        );

        if (!data || data.length === 0) {
          setRankingData([]);
          message.error("순위결과가 없습니다.");
          return;
        }

        const standingData = data[0].result.sort(
          (a, b) => a.playerRank - b.playerRank
        );
        setRankingData(standingData);
        setIsRankingView(true);
      } catch (error) {
        console.log("에러 발생:", error);
      }
    }
  };

  const handleSendToScreen = async (gradeId, gradeTitle) => {
    try {
      await fetchResultAndScoreBoard(gradeId, gradeTitle);
      message.success("스크린 송출 완료");
    } catch (error) {
      message.error("스크린 송출 중 에러 발생");
      console.log("스크린 송출 중 에러:", error);
    }
  };

  const fetchResultAndScoreBoard = async (gradeId, gradeTitle) => {
    const condition = [where("gradeId", "==", gradeId)];
    try {
      const data = await fetchResultQuery.getDocuments(
        "contest_results_list",
        condition
      );

      if (data?.length === 0) {
        return;
      }

      const standingData = data[0].result.sort(
        (a, b) => a.playerRank - b.playerRank
      );

      const collectionInfo = `currentStage/${currentContest.contests.id}/screen`;
      const newState = {
        players: [...standingData],
        gradeTitle: gradeTitle,
        status: { playStart: true },
      };
      await updateCurrentStage.updateData(collectionInfo, { ...newState });
    } catch (error) {
      console.log(error);
    }
  };

  const handleRowClick = (playerUid) => {
    setSelectedPlayerUid(playerUid);
  };

  const saveSortOrder = (isReversed) => {
    localStorage.setItem("sortOrder", isReversed ? "reversed" : "normal");
  };

  useEffect(() => {
    const storedOrder = localStorage.getItem("sortOrder");
    setIsReversed(storedOrder === "reversed");
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (
        currentContest?.contests?.contestNoticeId &&
        currentContest?.contests?.contestStagesAssignId &&
        currentContest?.contests?.contestPlayersFinalId &&
        realtimeData?.stageId
      ) {
        setIsLoading(true);
        await fetchPool(
          currentContest.contests.contestNoticeId,
          currentContest.contests.id,
          currentContest.contests.contestStagesAssignId,
          currentContest.contests.contestPlayersFinalId,
          realtimeData.stageId
        );
      }
    };

    loadData();
  }, [currentContest, realtimeData?.stageId]);

  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ✅ 비교심사 확정 번호 동기화 (실시간 DB -> 로컬 상태)
  useEffect(() => {
    const nums = realtimeData?.compares?.confirmed?.numbers || [];
    setCompareNumbers(Array.isArray(nums) ? nums : []);
    if (!nums || nums.length === 0) setIsCompareView(false);
  }, [realtimeData?.compares?.confirmed?.numbers]);

  if (isLoading || realtimeLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" tip="로딩 중..." />
      </div>
    );
  }

  if (realtimeError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card>
          <p className="text-red-500">오류 발생: {realtimeError.message}</p>
        </Card>
      </div>
    );
  }

  // ✅ 비교 상태 파생값
  const compareStatus = realtimeData?.compares?.status || {};
  const isCompareRunning =
    !!compareStatus?.compareStart || !!compareStatus?.compareIng;
  const isCompareConfirmed = (compareNumbers?.length || 0) > 0;

  return (
    <div className="w-full h-auto p-4 bg-gray-50">
      <div className={`flex ${isLandscape ? "flex-row" : "flex-col"} gap-4`}>
        {/* 좌측 카드 */}
        <div className={isLandscape ? "flex-[1]" : "w-full"}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <TrophyOutlined className="text-2xl" />
                <span className="text-xl">현재 무대 정보</span>
              </div>
            }
            className="shadow-lg h-full"
          >
            <div className="mb-4">
              <span className="font-semibold text-lg">카테고리: </span>
              <span className="text-lg">
                {realtimeData?.categoryTitle || "정보 없음"}{" "}
                {realtimeData?.gradeTitle || "정보 없음"}
              </span>
            </div>

            {/* 🔔 비교심사 상태 안내 & 버튼들 */}
            <div className="mb-4">
              {isCompareRunning && !isCompareConfirmed && (
                <Button
                  size="large"
                  block
                  disabled
                  loading
                  className="w-full h-24 text-2xl font-extrabold"
                >
                  비교심사 투표중...
                </Button>
              )}

              {isCompareConfirmed && (
                <Button
                  type="primary"
                  size="large"
                  icon={<UnorderedListOutlined />}
                  onClick={() => setIsCompareView((prev) => !prev)}
                  className="w-full h-24 text-2xl font-extrabold animate-pulse shadow-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, #22c1c3 0%, #2e8bff 50%, #764ba2 100%)",
                    borderColor: "transparent",
                  }}
                >
                  {isCompareView ? "비교 명단 닫기" : "비교심사명단 확인"}
                </Button>
              )}
            </div>

            {currentPlayersArray.length > 0 ? (
              currentPlayersArray.map((current, cIdx) => (
                <div key={cIdx} className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-lg">
                        {current.gradeTitle}
                      </h4>
                      {(realtimeData?.resultSaved || []).includes(
                        current.gradeId
                      ) ? (
                        <Tag color="success" className="text-base">
                          순위표 확정됨
                        </Tag>
                      ) : (
                        <Tag color="warning" className="text-base">
                          심사중
                        </Tag>
                      )}
                    </div>

                    <Space direction="vertical" size="small" className="w-full">
                      {(realtimeData?.resultSaved || []).includes(
                        current.gradeId
                      ) ? (
                        <>
                          <Button
                            type="primary"
                            icon={<EyeOutlined />}
                            onClick={() =>
                              handleViewRanking(
                                current.gradeId,
                                current.gradeTitle
                              )
                            }
                            className="w-full"
                          >
                            {isRankingView ? "명단확인" : "순위확인"}
                          </Button>
                          <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={() =>
                              handleSendToScreen(
                                current.gradeId,
                                current.gradeTitle
                              )
                            }
                            className="w-full"
                            style={{
                              background:
                                "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                              borderColor: "transparent",
                            }}
                          >
                            스크린송출
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-600 text-sm">
                            심사 진행 중...
                          </span>
                          <Button
                            type={isRankingView ? "default" : "primary"}
                            danger={!isRankingView}
                            size="large"
                            icon={
                              isRankingView ? (
                                <UnorderedListOutlined />
                              ) : (
                                <TrophyOutlined />
                              )
                            }
                            onClick={() =>
                              handleViewRanking(
                                current.gradeId,
                                current.gradeTitle
                              )
                            }
                            className="w-full h-20 text-xl font-bold"
                          >
                            {isRankingView ? "명단보기" : "순위확인"}
                          </Button>
                        </>
                      )}
                    </Space>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">확정된 순위가 없습니다.</p>
            )}
          </Card>
        </div>

        {/* 우측 카드 */}
        <div className={isLandscape ? "flex-[4]" : "w-full"}>
          <Card
            title={
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {isCompareView && compareNumbers.length > 0
                    ? "비교심사 확정 명단"
                    : isRankingView
                    ? "순위"
                    : "참가 선수 명단"}
                </span>
                {isRankingView && (
                  <Button
                    size="large"
                    icon={isReversed ? <DownOutlined /> : <UpOutlined />}
                    onClick={() => {
                      setIsReversed((prev) => !prev);
                      saveSortOrder(!isReversed);
                    }}
                  >
                    {isReversed ? "역순" : "정순"}
                  </Button>
                )}
              </div>
            }
            className="shadow-lg h-full"
          >
            <div
              className={
                isLandscape ? "overflow-y-auto max-h-[calc(100vh-200px)]" : ""
              }
            >
              {/* ✅ 비교심사 확정 명단(번호만) 최우선 노출 */}
              {isCompareView && compareNumbers.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {compareNumbers.map((num) => (
                    <div
                      key={num}
                      className="p-6 rounded-xl bg-white border-2 border-blue-300 text-center shadow-sm"
                    >
                      <div className="text-5xl font-extrabold text-blue-600">
                        {num}
                      </div>
                      <div className="mt-2 text-gray-500">비교 확정</div>
                    </div>
                  ))}
                </div>
              ) : isRankingView && rankingData ? (
                <div className="space-y-4">
                  {(isReversed ? [...rankingData].reverse() : rankingData)
                    .filter((player) => player.playerRank < 1000)
                    .map((player) => {
                      const isSelected = selectedPlayerUid === player.playerUid;
                      const rank = player.playerRank;

                      let rankColor = "bg-white";
                      if (rank === 1)
                        rankColor =
                          "bg-gradient-to-r from-yellow-400 to-yellow-300";
                      else if (rank === 2)
                        rankColor =
                          "bg-gradient-to-r from-gray-300 to-gray-200";
                      else if (rank === 3)
                        rankColor =
                          "bg-gradient-to-r from-orange-400 to-orange-300";

                      return (
                        <div
                          key={player.playerUid}
                          onClick={() => handleRowClick(player.playerUid)}
                          className={`p-6 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? "bg-yellow-200 border-4 border-yellow-500 shadow-2xl"
                              : `${rankColor} border-2 border-gray-200 hover:shadow-lg`
                          }`}
                        >
                          <div className="flex items-center gap-8">
                            <div className="text-8xl font-bold text-gray-800 min-w-[120px] text-center">
                              {rank}위
                            </div>
                            <div className="flex-1">
                              <div className="text-5xl font-bold text-gray-900 mb-2">
                                {player.playerNumber}. {player.playerName}
                              </div>
                              <div className="text-2xl text-gray-700">
                                {player.playerGym}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                currentPlayersArray.map((current, cIdx) => (
                  <div key={cIdx} className="mb-8">
                    <h4 className="font-bold text-2xl mb-4 pb-2 border-b-2 border-gray-300">
                      {current.gradeTitle}
                    </h4>
                    <div className="space-y-4">
                      {current.players.length > 0 ? (
                        current.players.map((player) => {
                          const isSelected =
                            selectedPlayerUid === player.playerUid;
                          return (
                            <div
                              key={player.playerUid}
                              onClick={() => handleRowClick(player.playerUid)}
                              className={`p-6 rounded-xl cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-yellow-200 border-4 border-yellow-500 shadow-2xl"
                                  : "bg-white border-2 border-gray-200 hover:shadow-lg"
                              }`}
                            >
                              <div className="flex items-start gap-6">
                                <div className="text-7xl font-bold text-blue-600 min-w-[100px] text-center">
                                  {player.playerNumber}
                                </div>
                                <div className="flex-1">
                                  <div className="text-4xl font-bold text-gray-900 mb-2">
                                    {player.playerName}
                                  </div>
                                  <div className="text-2xl text-gray-700 mb-3">
                                    {player.playerGym}
                                  </div>
                                  {player.playerText && (
                                    <div className="text-xl text-gray-600 whitespace-pre-wrap leading-relaxed mt-4 p-4 bg-gray-50 rounded-lg">
                                      {player.playerText}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xl text-gray-500 text-center py-8">
                          참가한 선수가 없습니다.
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ContestMonitoringHost;
