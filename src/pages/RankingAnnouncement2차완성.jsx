import React, { useEffect, useState, useRef } from "react";
import { gsap } from "gsap";
import "./RankingAnnouncement.css";
import AwardVideo from "../assets/mov/award3.mp4";
import ReactPlayer from "react-player";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";

const RankingAnnouncement = (props) => {
  const [showFinalRank, setShowFinalRank] = useState(false); // 전체 순위표를 보여줄 상태 변수
  const [showScoreResult, setShowScoreResult] = useState(false); // 채점 결과를 보여줄 상태 변수
  const [unmountFinalRank, setUnmountFinalRank] = useState(false); // 최종 순위표를 언마운트하기 위한 상태 변수
  const rankRefs = useRef([]); // 순위 요소들에 대한 참조 배열
  const finalRankingRef = useRef(null); // final-ranking 요소에 대한 참조
  const [playerShuffledIndexes, setPlayerShuffledIndexes] = useState({}); // 선수별로 섞인 randomIndex를 저장할 객체

  const navigate = useNavigate();
  const location = useLocation();
  const [contestId, setContestId] = useState("");
  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );
  const updateData = useFirebaseRealtimeUpdateData();

  const [currentPage, setCurrentPage] = useState(0); // Pagination for final ranking
  const [scoreCurrentPage, setScoreCurrentPage] = useState(0); // Pagination for score result
  const itemsPerPage = 5; // Number of items per page

  useEffect(() => {
    if (location?.state?.contestId) {
      setContestId(location.state.contestId);
    }
  }, [location]);

  useEffect(() => {
    if (realtimeData?.screen) {
      if (!realtimeData?.screen?.status?.playStart) {
        navigate("/idle", { state: { contestId } });
      }
    }
  }, [realtimeData]);

  // 새로 랜덤 인덱스 배열을 생성하는 함수 (선수별로 호출)
  const generateShuffledIndexes = (numberOfJudges) => {
    const indexes = Array.from({ length: numberOfJudges }, (_, index) => index);
    return indexes.sort(() => Math.random() - 0.5); // 배열을 랜덤하게 섞음
  };

  useEffect(() => {
    if (realtimeData?.screen?.players) {
      const newShuffledIndexes = {};
      realtimeData.screen.players.forEach((player) => {
        const numberOfJudges = player.score.length;
        newShuffledIndexes[player.playerUid] =
          generateShuffledIndexes(numberOfJudges);
      });
      setPlayerShuffledIndexes(newShuffledIndexes); // 선수별로 randomIndex 배열을 저장
    }
  }, [realtimeData?.screen?.players]);

  // 합산 점수 계산 (isMin, isMax가 아닌 점수들의 합산)
  const calculateTotalScore = (scoreArray) => {
    return scoreArray
      .filter((score) => !score.isMin && !score.isMax)
      .reduce((total, score) => total + score.playerScore, 0);
  };

  // 순위를 정렬하고 100위 이상의 선수는 제외
  const sortedRankings =
    realtimeData?.screen?.players
      ?.filter((player) => player.playerRank <= 100)
      ?.sort((a, b) => a.playerRank - b.playerRank) || [];

  // Step 1: Top 5 players from 5th to 1st place
  const top5Rankings = sortedRankings.slice(0, 5).reverse();

  // 애니메이션 리셋
  useEffect(() => {
    if (!realtimeData?.screen?.players || !top5Rankings.length) return;

    const totalRanks = top5Rankings.length; // 최대 5명으로 제한
    const timelines = [];
    const lastDelay = 4.5 * totalRanks + 2.5; // 마지막 순위 발표 후 딜레이

    for (let i = 0; i < totalRanks; i++) {
      const rankRef = rankRefs.current[i];

      // 초기 위치 설정
      gsap.set(rankRef, {
        x: -800,
        opacity: 0,
        scale: 0.3,
        rotate: -90,
      });

      const timeline = gsap.timeline();

      // 등장 애니메이션
      timeline.fromTo(
        rankRef,
        { x: -800, opacity: 0, scale: 0.3, rotate: -90 },
        {
          x: 0,
          opacity: 1,
          scale: 1,
          rotate: 0,
          duration: 1.5,
          ease: "back.out(1.7)",
          delay: i * 4.5, // 각 순위별로 딜레이를 줘서 순차적으로 등장
        }
      );

      // 사라지는 애니메이션 (마지막 순위는 사라지지 않음)
      if (i < totalRanks - 1) {
        timeline.to(rankRef, {
          x: 800,
          opacity: 0,
          scale: 0.7,
          rotate: 90,
          duration: 1.5,
          ease: "power1.in",
          delay: 2.5, // 중앙에서 머무르는 시간
        });
      }

      timelines.push(timeline);
    }

    // 전체 순위표를 표시하기 위한 딜레이
    setTimeout(() => {
      gsap.fromTo(
        finalRankingRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1 } // Step 1에서 Step 2로 부드럽게 전환
      );
      setShowFinalRank(true);
      setCurrentPage(0); // Reset current page for final ranking
    }, lastDelay * 1000); // 딜레이 후 전체 순위표 표시
  }, [realtimeData?.screen?.gradeTitle, top5Rankings]); // top5Rankings와 gradeTitle에 의존

  // Pagination for final ranking
  useEffect(() => {
    if (showFinalRank) {
      const totalPages = Math.ceil(sortedRankings.length / itemsPerPage);
      let pageInterval = setInterval(() => {
        setCurrentPage((prevPage) => {
          if (prevPage < totalPages - 1) {
            return prevPage + 1;
          } else {
            clearInterval(pageInterval);
            // Proceed to show score results after last page
            setTimeout(() => {
              setShowScoreResult(true);
              setScoreCurrentPage(0); // Reset page for score result
              // Fade out the final ranking
              gsap.to(finalRankingRef.current, {
                opacity: 0,
                duration: 1,
                onComplete: () => {
                  setUnmountFinalRank(true);
                },
              });
            }, 5000); // 5초 후에 채점 결과 표시
            return prevPage;
          }
        });
      }, 5000); // 페이지 전환 간격

      return () => clearInterval(pageInterval);
    }
  }, [showFinalRank, sortedRankings]);

  // Pagination for score result
  useEffect(() => {
    if (showScoreResult) {
      const scoreTotalPages = Math.ceil(sortedRankings.length / itemsPerPage);
      let scorePageInterval = setInterval(() => {
        setScoreCurrentPage((prevPage) => {
          if (prevPage < scoreTotalPages - 1) {
            return prevPage + 1;
          } else {
            clearInterval(scorePageInterval);
            // Step 3 애니메이션이 2번 재생되면 screen.status.playStart를 false로 설정
            if (realtimeData?.screen?.status?.playStart) {
              updateData.updateData(`currentStage/${contestId}/screen/status`, {
                playStart: false,
              });
            }
            return prevPage;
          }
        });
      }, 5000); // 페이지 전환 간격

      return () => clearInterval(scorePageInterval);
    }
  }, [showScoreResult, sortedRankings, contestId, realtimeData]);

  return (
    <div className="ranking-container">
      <ReactPlayer
        url={AwardVideo}
        width="100%"
        height="auto"
        playing
        loop
        muted
        style={{ position: "absolute", top: 0, left: 0 }}
      />
      <div className="ranking-title  w-full ">
        {realtimeData?.categoryTitle &&
          realtimeData?.screen?.gradeTitle &&
          `${realtimeData.categoryTitle} ${realtimeData.screen.gradeTitle} 순위발표`}
      </div>
      {/* Step 1: Top 5 Players Animation */}
      {!showFinalRank &&
        top5Rankings.map((player, i) => (
          <div
            key={i}
            ref={(el) => (rankRefs.current[i] = el)}
            className="ranking-item"
            style={{ zIndex: top5Rankings.length - i }}
          >
            <h2 className="gap-x-5">
              <span className="rank">{player.playerRank}위</span>
              <span className="player-number ml-5">
                {player.playerNumber}번 {player.playerName}
              </span>
            </h2>
            <p>{player.playerGym}</p> {/* 소속은 아랫줄에 배치 */}
          </div>
        ))}
      {/* Step 2: Final Ranking with Pagination */}
      {showFinalRank && (
        <>
          {!unmountFinalRank && (
            <div className="final-ranking fixed-position" ref={finalRankingRef}>
              <h2 className="mb-10 font-bold" style={{ fontSize: 45 }}>
                전체 순위표
              </h2>
              <table className="styled-table">
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>선수</th>
                    <th>소속</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRankings
                    .slice(
                      currentPage * itemsPerPage,
                      (currentPage + 1) * itemsPerPage
                    )
                    .map((player, i) => (
                      <tr key={player.playerUid}>
                        <td>{player.playerRank}위</td>
                        <td>
                          {player.playerNumber}번 {player.playerName}
                        </td>
                        <td>{player.playerGym}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Step 3: Score Result with Pagination */}
          <div
            className={`score-result fixed-position ${
              showScoreResult ? "show" : ""
            }`}
          >
            <h2 className="mb-10 font-bold" style={{ fontSize: 45 }}>
              채점 결과
            </h2>
            <table className="styled-table">
              <thead>
                <tr>
                  <th>선수</th>
                  {Array.from({
                    length: realtimeData?.screen?.players[0]?.score?.length,
                  }).map((_, index) => (
                    <th key={index}>{String.fromCharCode(65 + index)}</th> // A, B, C... 헤더
                  ))}
                  <th>기표합산</th>
                </tr>
              </thead>
              <tbody>
                {sortedRankings
                  .slice(
                    scoreCurrentPage * itemsPerPage,
                    (scoreCurrentPage + 1) * itemsPerPage
                  )
                  .map((player, i) => (
                    <tr key={player.playerUid}>
                      <td>
                        {player.playerNumber}번 {player.playerName}
                      </td>
                      {/* 선수별로 생성된 randomIndex에 따라 점수를 표시 */}
                      {playerShuffledIndexes[player.playerUid]?.map(
                        (shuffledIndex, index) => (
                          <td
                            key={index}
                            className={
                              player.score[shuffledIndex]?.isMin
                                ? "min-score"
                                : player.score[shuffledIndex]?.isMax
                                ? "max-score"
                                : ""
                            }
                          >
                            {player.score[shuffledIndex]?.playerScore}
                          </td>
                        )
                      )}
                      <td>{calculateTotalScore(player.score)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {/* 안내 사항을 바닥 정렬 */}
            <div className="w-full text-left absolute bottom-5 left-0 px-5">
              <ul className="list-disc text-xl text-white pl-14">
                <li className="mb-2">
                  점수와 심판 자리는 서로 일치하지 않습니다. 채점표가 공개될
                  때는 무작위로 자리가 배정됩니다.
                </li>
                <li className="mb-2">
                  채점 결과는 최고점과 최저점을 제외한 점수들의 합으로
                  계산됩니다.
                </li>
                <li>
                  랭킹형 채점 방식에서는 숫자가 낮을수록 더 높은 순위를
                  의미합니다.
                </li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RankingAnnouncement;
