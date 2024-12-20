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
import { FaArrowUp, FaArrowDown } from "react-icons/fa";
import { message } from "antd";

const ContestMonitoringHost = ({ contestId }) => {
  const [players, setPlayers] = useState([]);
  const [stagesArray, setStagesArray] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPlayersArray, setCurrentPlayersArray] = useState([]);
  const [contestInfo, setContestInfo] = useState({});
  const [selectedPlayerUid, setSelectedPlayerUid] = useState(null); // 선택된 선수의 Uid
  const { currentContest } = useContext(CurrentContestContext);
  const fetchResultQuery = useFirestoreQuery();
  const [rankingData, setRankingData] = useState(null);
  const [isRankingView, setIsRankingView] = useState(false); // 순위확인/명단확인 상태
  const [isReversed, setIsReversed] = useState(false); // 정순/역순 상태

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

        console.log(playerList);

        setCurrentPlayersArray(playerList);
      }
    } catch (error) {
      console.error("데이터 로드 중 에러:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 순위확인 함수 (사회자가 미리 확인)
  const handleViewRanking = async (gradeId, gradeTitle) => {
    if (isRankingView) {
      // 순위확인 모드인 경우, 명단확인 모드로 돌아가기
      setIsRankingView(false);
      setRankingData(null); // 순위 데이터를 초기화
    } else {
      // 순위가 아닌 경우 순위 데이터를 조회하고 보여줌
      const condition = [where("gradeId", "==", gradeId)];
      try {
        const data = await fetchResultQuery.getDocuments(
          "contest_results_list",
          condition
        );

        if (!data || data.length === 0) {
          setRankingData([]);
          message.error("순위결과가 없습니다.");
          console.log("데이터가 없습니다.");
          return;
        }

        const standingData = data[0].result.sort(
          (a, b) => a.playerRank - b.playerRank
        );
        setRankingData(standingData); // 순위 데이터를 상태에 저장
        setIsRankingView(true); // 순위확인 모드로 전환
      } catch (error) {
        console.log("에러 발생:", error);
      }
    }
  };

  // 스크린 송출 함수 (화면에 순위를 송출)
  const handleSendToScreen = async (gradeId, gradeTitle) => {
    try {
      await fetchResultAndScoreBoard(gradeId, gradeTitle);
      console.log("스크린 송출 완료");
    } catch (error) {
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
      console.log(standingData);

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
    setSelectedPlayerUid(playerUid); // 클릭한 선수의 Uid 저장
  };

  // 정렬 상태를 저장하는 함수
  const saveSortOrder = (isReversed) => {
    localStorage.setItem("sortOrder", isReversed ? "reversed" : "normal");
  };

  // 로드 시 localStorage에서 정렬 방식 불러오기
  useEffect(() => {
    const storedOrder = localStorage.getItem("sortOrder");
    setIsReversed(storedOrder === "reversed");
  }, []);

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
  }, [currentContest, realtimeData?.stageId]);

  if (isLoading || realtimeLoading) {
    return <p>로딩 중...</p>;
  }

  if (realtimeError) {
    return <p>오류 발생: {realtimeError.message}</p>;
  }

  return (
    <div className="w-full h-auto p-4 bg-white shadow-lg rounded-lg flex flex-col gap-6">
      {/* 상단 화면 - 현재 대회 상태 및 순위 확정 정보 */}
      <div className="bg-gray-100 p-4 rounded-lg shadow-inner">
        <h2 className="text-2xl font-bold mb-4 border-b pb-2">
          현재 무대 정보
        </h2>
        <div className="mb-4">
          <span className="font-semibold">카테고리: </span>
          <span>{realtimeData?.categoryTitle || "정보 없음"} </span>
          <span>{realtimeData?.gradeTitle || "정보 없음"}</span>
        </div>

        {currentPlayersArray.length > 0 ? (
          currentPlayersArray.map((current, cIdx) => (
            <div key={cIdx} className="mb-4">
              {/* gradeTitle을 세로로 배치 */}
              <h4 className="font-bold mb-2">{current.gradeTitle}</h4>

              {/* 하위 항목들을 가로로 배치 */}
              <div className="flex items-center">
                {/* 심사중 또는 순위확정 구분 */}
                {(realtimeData?.resultSaved || []).includes(current.gradeId) ? (
                  <span className="ml-4 text-red-500 font-semibold">
                    순위표 확정됨
                  </span>
                ) : (
                  <span className="ml-4 text-yellow-500 font-semibold">
                    심사중
                  </span>
                )}

                {/* 버튼은 가로로 배치 */}
                {(realtimeData?.resultSaved || []).includes(current.gradeId) ? (
                  <div className="ml-4 flex gap-4">
                    {/* 순위확인 버튼 */}
                    <button
                      className="bg-green-500 text-white px-4 py-2 rounded-lg"
                      onClick={() =>
                        handleViewRanking(current.gradeId, current.gradeTitle)
                      }
                    >
                      {isRankingView ? "명단확인" : "순위확인"}
                    </button>

                    {/* 스크린송출 버튼 */}
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                      onClick={() =>
                        handleSendToScreen(current.gradeId, current.gradeTitle)
                      }
                    >
                      스크린송출
                    </button>
                  </div>
                ) : (
                  <div className="flex w-auto justify-start gap-x-2 items-center">
                    <span className="ml-4">심사 진행 중...</span>
                    <button
                      className="bg-red-500 text-white px-4 py-2 rounded-lg"
                      onClick={() =>
                        handleViewRanking(current.gradeId, current.gradeTitle)
                      }
                    >
                      순위강제확인
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <p>확정된 순위가 없습니다.</p>
        )}
      </div>

      {/* 하단 화면 - 참가 선수 명단 또는 순위 */}
      <div className="bg-gray-50 p-4 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold mb-4 border-b pb-2 flex justify-between items-center">
          {isRankingView ? "순위" : "참가 선수 명단"}
          {isRankingView && (
            <button
              className="text-lg"
              onClick={() => {
                setIsReversed((prev) => !prev);
                saveSortOrder(!isReversed);
              }}
            >
              {isReversed ? <FaArrowDown /> : <FaArrowUp />}
            </button>
          )}
        </h3>

        {isRankingView && rankingData ? (
          <table className="w-full table-auto text-lg">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2">순위</th>
                <th className="px-4 py-2">선수</th>
                <th className="px-4 py-2">소속</th>
              </tr>
            </thead>
            <tbody>
              {(isReversed ? [...rankingData].reverse() : rankingData).map(
                (player) => (
                  <tr
                    key={player.playerUid} // playerUid로 key 설정
                    className={`text-center cursor-pointer ${
                      selectedPlayerUid === player.playerUid
                        ? "font-bold text-xl bg-yellow-200" // 선택된 행의 스타일 적용
                        : "hover:bg-blue-100"
                    }`}
                    onClick={() => setSelectedPlayerUid(player.playerUid)} // 클릭 시 playerUid를 저장
                  >
                    <td className="border px-4 py-2">{player.playerRank}</td>
                    <td className="border px-4 py-2">
                      {player.playerNumber}. {player.playerName}
                    </td>
                    <td className="border px-4 py-2">{player.playerGym}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        ) : (
          currentPlayersArray.map((current, cIdx) => (
            <div key={cIdx} className="mb-4">
              <h4 className="font-bold mb-2">{current.gradeTitle}</h4>
              <table className="w-full table-fixed text-lg">
                {" "}
                {/* table-fixed로 테이블 레이아웃 고정 */}
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 w-1/6">번호</th>{" "}
                    {/* 열 너비 지정 */}
                    <th className="px-4 py-2 w-1/4">이름</th>
                    <th className="px-4 py-2 w-1/4">소속</th>
                    <th className="px-4 py-2 w-1/3">출전동기</th>{" "}
                    {/* 열 너비 지정 */}
                  </tr>
                </thead>
                <tbody>
                  {current.players.length > 0 ? (
                    current.players.map((player) => (
                      <tr
                        key={player.playerUid} // playerUid로 key 설정
                        className={`text-center cursor-pointer ${
                          selectedPlayerUid === player.playerUid
                            ? "font-bold text-xl bg-yellow-200" // 선택된 행의 스타일 적용
                            : "hover:bg-blue-100"
                        }`}
                        onClick={() => setSelectedPlayerUid(player.playerUid)} // 클릭 시 playerUid를 저장
                      >
                        <td className="border px-4 py-2">
                          {player.playerNumber}
                        </td>
                        <td className="border px-4 py-2">
                          {player.playerName}
                        </td>
                        <td className="border px-4 py-2">{player.playerGym}</td>
                        <td className="border px-4 py-2 text-left whitespace-pre-wrap">
                          {" "}
                          {/* 줄바꿈 처리 */}
                          {player?.playerText}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center py-4">
                        참가한 선수가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ContestMonitoringHost;
