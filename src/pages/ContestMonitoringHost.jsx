import React, { useEffect, useState } from "react";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime"; // 커스텀 훅 사용
import { where } from "firebase/firestore";

const ContestMonitoringHost = ({ contestId }) => {
  const [players, setPlayers] = useState([]);
  const fetchFinalPlayers = useFirestoreQuery();

  // realtimeData 불러오기
  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );

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
