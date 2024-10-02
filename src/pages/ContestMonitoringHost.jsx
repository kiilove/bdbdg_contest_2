import React, { useContext, useEffect, useState } from "react";
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

const ContestMonitoringHost = ({ contestId }) => {
  const [players, setPlayers] = useState([]);
  const [stagesArray, setStagesArray] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPlayersArray, setCurrentPlayersArray] = useState([]);
  const [contestInfo, setContestInfo] = useState({});
  const [message, setMessage] = useState({});
  const { currentContest } = useContext(CurrentContestContext);

  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );

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
                players: matchedPlayers,
              };
            })
          : [];

        setCurrentPlayersArray(playerList);
      }
    } catch (error) {
      setMessage({
        body: "데이터를 로드하지 못했습니다.",
        body4: error.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    } finally {
      setIsLoading(false); // 데이터를 모두 불러온 후 로딩 상태 해제
    }
  };

  // Fetch data for players
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
  }, [currentContest, realtimeData?.stageId]); // realtimeData.stageId 변경 시마다 fetch 호출

  if (isLoading || realtimeLoading) {
    return <p>로딩 중...</p>;
  }

  if (realtimeError) {
    return <p>오류 발생: {realtimeError.message}</p>;
  }

  return (
    <div className="w-full h-auto p-4 bg-white shadow-lg rounded-lg">
      <h2 className="text-xl font-bold mb-4">현재 무대 정보</h2>
      <div className="mb-4">
        <span className="font-semibold">카테고리: </span>
        <span>{realtimeData?.categoryTitle || "정보 없음"}</span>
      </div>
      <div className="mb-4">
        <span className="font-semibold">등급: </span>
        <span>{realtimeData?.gradeTitle || "정보 없음"}</span>
      </div>
      <div>
        <h3 className="font-semibold mb-2">참가 선수 명단:</h3>
        {currentPlayersArray.length > 0 ? (
          currentPlayersArray.map((current, cIdx) => (
            <div key={cIdx} className="mb-4">
              {/* 등급 제목 표시 */}
              <h4 className="font-bold mb-2">{current.gradeTitle}</h4>
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2">번호</th>
                    <th className="px-4 py-2">이름</th>
                    <th className="px-4 py-2">소속</th>
                  </tr>
                </thead>
                <tbody>
                  {current.players.length > 0 ? (
                    current.players.map((player, index) => (
                      <tr key={index} className="text-center">
                        <td className="border px-4 py-2">
                          {player.playerNumber}
                        </td>
                        <td className="border px-4 py-2">
                          {player.playerName}
                        </td>
                        <td className="border px-4 py-2">{player.playerGym}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="text-center py-4">
                        참가한 선수가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))
        ) : (
          <p>참가한 선수가 없습니다.</p>
        )}
      </div>
    </div>
  );
};

export default ContestMonitoringHost;
