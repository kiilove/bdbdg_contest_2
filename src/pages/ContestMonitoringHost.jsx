import React, { useContext, useEffect, useState } from "react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime"; // 커스텀 훅 사용
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";

const ContestMonitoringHost = ({ contestId }) => {
  const [players, setPlayers] = useState([]);
  const [stagesArray, setStagesArray] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playersArray, setPlayersArray] = useState([]);
  const [contestInfo, setContestInfo] = useState({});
  const [message, setMessage] = useState({});
  const { currentContest } = useContext(CurrentContestContext);
  const [normalScoreData, setNormalScoreData] = useState([]);
  const [currentStageInfo, setCurrentStageInfo] = useState({ stageId: null });

  // realtimeData 불러오기
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
  const fetchScoreCardQuery = useFirestoreQuery();
  const fetchResultQuery = useFirestoreQuery();
  const updateCurrentStage = useFirebaseRealtimeUpdateData();

  const fetchPool = async (noticeId, stageAssignId, playerFinalId) => {
    try {
      const returnNotice = await fetchNotice.getDocument(noticeId);
      const returnContestStage = await fetchStages.getDocument(stageAssignId);
      const returnPlayersFinal = await fetchFinalPlayers.getDocument(
        playerFinalId
      );

      if (returnNotice && returnContestStage) {
        setStagesArray(
          returnContestStage.stages.sort(
            (a, b) => a.stageNumber - b.stageNumber
          )
        );
        setContestInfo({ ...returnNotice });
        setPlayersArray(
          returnPlayersFinal.players
            .sort((a, b) => a.playerIndex - b.playerIndex)
            .filter((f) => f.playerNoShow === false)
        );
        console.log(stagesArray);
        console.log(playersArray);
        setIsLoading(false);
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

  const fetchResultAndScoreBoard = async (gradeId, gradeTitle) => {
    const condition = [where("gradeId", "==", gradeId)];
    try {
      const data = await fetchResultQuery.getDocuments(
        "contest_results_list",
        condition
      );

      if (data?.length === 0) {
        window.alert("데이터가 없습니다.");
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

  const handleScreenEnd = async () => {
    const collectionInfo = `currentStage/${currentContest.contests.id}/screen/status`;
    const newState = {
      playStart: false,
      standingStart: false,
    };
    await updateCurrentStage.updateData(collectionInfo, { ...newState });
  };

  const fetchScoreTable = async (grades) => {
    if (!grades || grades.length === 0) return;

    const allData = [];

    for (let grade of grades) {
      const { gradeId } = grade;
      try {
        const condition = [where("gradeId", "==", gradeId)];
        const data = await fetchScoreCardQuery.getDocuments(
          contestInfo.contestCollectionName,
          condition
        );
        allData.push(...data);
      } catch (error) {
        console.log(error);
      }
    }

    setNormalScoreData(allData);
    setIsLoading(false);
  };

  const handlePlayerList = (stages, players, currentStageId) => {};

  // 선수 데이터를 Firestore에서 불러오기
  useEffect(() => {
    const fetchPlayers = async () => {
      if (realtimeData?.categoryId && realtimeData?.gradeId) {
        try {
          // categoryId와 gradeId로 필터링하여 선수 데이터를 가져옴
          const condition = [
            where("categoryId", "==", realtimeData.categoryId),
            where("gradeId", "==", realtimeData.gradeId),
          ];
          const data = await fetchFinalPlayers.getDocuments(
            "contest_players_final",
            condition
          );
          if (data.length > 0) {
            setPlayers(data);
          }
        } catch (error) {
          console.error("선수 데이터를 불러오는 중 오류 발생: ", error);
        }
      }
    };

    fetchPlayers();
  }, [realtimeData, fetchFinalPlayers]);

  useEffect(() => {
    if (
      currentContest?.contests?.contestNoticeId &&
      currentContest?.contests?.contestStagesAssignId &&
      currentContest?.contests?.contestPlayersFinalId
    ) {
      fetchPool(
        currentContest.contests.contestNoticeId,
        currentContest.contests.contestStagesAssignId,
        currentContest?.contests?.contestPlayersFinalId
      );
    }
  }, [currentContest]);

  if (realtimeLoading) {
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
        {players.length > 0 ? (
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2">번호</th>
                <th className="px-4 py-2">이름</th>
                <th className="px-4 py-2">소속</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={index} className="text-center">
                  <td className="border px-4 py-2">{player.playerNumber}</td>
                  <td className="border px-4 py-2">{player.playerName}</td>
                  <td className="border px-4 py-2">{player.playerGym}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>참가한 선수가 없습니다.</p>
        )}
      </div>
    </div>
  );
};

export default ContestMonitoringHost;
