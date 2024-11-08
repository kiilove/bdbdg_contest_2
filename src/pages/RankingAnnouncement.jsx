import React, { useEffect, useState, useRef } from "react";
import { gsap } from "gsap";
import "./RankingAnnouncement.css";
import AwardVideo from "../assets/mov/award2.mp4";
import ReactPlayer from "react-player";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";

const RankingAnnouncement = () => {
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

  const [currentPage, setCurrentPage] = useState(0); // Final Ranking의 현재 페이지 인덱스
  const [scoreCurrentPage, setScoreCurrentPage] = useState(0); // Score Result의 현재 페이지 인덱스
  const itemsPerPage = 5; // 페이지당 표시할 항목 수

  // Delay 설정 값 불러오기
  const rankingDelay = Number(localStorage.getItem("rankingDelay")) || 5;
  const rankingFinalDelay =
    Number(localStorage.getItem("rankingFinalDelay")) || 5;
  const pageDelay = Number(localStorage.getItem("pageDelay")) || 5;
  const pageFinalDelay = Number(localStorage.getItem("pageFinalDelay")) || 5;
  const scorePageDelay = Number(localStorage.getItem("scorePageDelay")) || 5;
  const scoreFinalDelay = Number(localStorage.getItem("scoreFinalDelay")) || 5;
  const playersToShow = Number(localStorage.getItem("playersToShow")) || 5;

  // Contest ID 설정
  useEffect(() => {
    if (location?.state?.contestId) {
      setContestId(location.state.contestId);
      console.log(`Contest ID 설정됨: ${location.state.contestId}`);
    }
  }, [location]);

  // playStart 상태 확인 및 idle 페이지로 이동
  useEffect(() => {
    if (realtimeData?.screen) {
      if (!realtimeData.screen.status.playStart) {
        console.log("playStart 상태가 false입니다. /idle 페이지로 이동합니다.");
        navigate("/idle", { state: { contestId } });
      }
    }
  }, [realtimeData, navigate, contestId]);

  // 랜덤 인덱스 생성 함수
  const generateShuffledIndexes = (numberOfJudges) => {
    const indexes = Array.from({ length: numberOfJudges }, (_, index) => index);
    return indexes.sort(() => Math.random() - 0.5); // 배열을 랜덤하게 섞음
  };

  // 선수별 랜덤 인덱스 설정
  useEffect(() => {
    if (realtimeData?.screen?.players) {
      const newShuffledIndexes = {};
      realtimeData.screen.players.forEach((player) => {
        const numberOfJudges = player.score.length;
        newShuffledIndexes[player.playerUid] =
          generateShuffledIndexes(numberOfJudges);
      });
      setPlayerShuffledIndexes(newShuffledIndexes); // 선수별로 randomIndex 배열을 저장
      console.log("선수별 랜덤 인덱스 설정 완료:", newShuffledIndexes);
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
  const topRankings = sortedRankings.slice(0, playersToShow).reverse();

  // 애니메이션 리셋 (애니메이션 1: Top Players Animation)
  useEffect(() => {
    if (!realtimeData?.screen?.players || !topRankings.length) return;

    const totalRanks = topRankings.length; // 최대 playersToShow명으로 제한
    const timelines = [];

    for (let i = 0; i < totalRanks; i++) {
      const rankRef = rankRefs.current[i];

      // rankRef가 존재하는지 확인
      if (!rankRef) continue;

      // 초기 위치 설정
      gsap.set(rankRef, {
        x: -800,
        opacity: 0,
        scale: 0.3,
        rotate: -90,
      });

      const timeline = gsap.timeline();

      // 등장 애니메이션
      timeline
        .fromTo(
          rankRef,
          { x: -800, opacity: 0, scale: 0.3, rotate: -90 },
          {
            x: 0,
            opacity: 1,
            scale: 1,
            rotate: 0,
            duration: 1.5,
            ease: "back.out(1.7)",
            delay: i * rankingDelay, // 각 순위별로 딜레이를 줘서 순차적으로 등장
          }
        )
        .add(() => {
          console.log(
            `애니메이션 시작: 선수 ${i + 1} (${topRankings[i].playerName})`
          );
        });

      // 사라지는 애니메이션 (마지막 순위는 사라지지 않음)
      if (i < totalRanks - 1) {
        timeline
          .to(rankRef, {
            x: 800,
            opacity: 0,
            scale: 0.7,
            rotate: 90,
            duration: 1.2, // 사라지는 시간을 1.2초로 설정 (기존보다 빠르게)
            ease: "power1.in",
            delay: rankingDelay - 2, // 중앙에서 머무르는 시간을 조정하여 더 빨리 사라짐
          })
          .add(() => {
            console.log(
              `애니메이션 종료: 선수 ${i + 1} (${
                topRankings[i].playerName
              }) 사라짐`
            );
          });
      }

      timelines.push(timeline);
    }

    // 전체 순위표를 표시하기 위한 딜레이
    const lastDelay = rankingDelay * (totalRanks - 1) + 1.2 + rankingFinalDelay;
    console.log(`전체 순위표 표시까지 총 딜레이: ${lastDelay}초`);

    const timeoutId = setTimeout(() => {
      if (finalRankingRef.current) {
        gsap.fromTo(
          finalRankingRef.current,
          { opacity: 0, y: 50 },
          { opacity: 1, y: 0, duration: 1 }
        );
      }
      console.log("전체 순위표 애니메이션 시작");
      setShowFinalRank(true);
      setCurrentPage(0); // Reset current page for final ranking
    }, lastDelay * 1000);

    console.log(
      `애니메이션 1: 타이머 설정됨 (${lastDelay}초 후 전체 순위표 표시)`
    );
    return () => {
      clearTimeout(timeoutId);
      console.log("애니메이션 1: 타이머 해제됨");
    };
  }, [
    realtimeData?.screen?.players,
    topRankings,
    rankingDelay,
    rankingFinalDelay,
  ]);

  // 애니메이션 2: Final Ranking with Pagination
  useEffect(() => {
    if (showFinalRank) {
      const totalPages = Math.ceil(sortedRankings.length / itemsPerPage);
      let pageTimeoutId;

      // 부드러운 전환 애니메이션 적용
      if (finalRankingRef.current) {
        gsap.fromTo(
          finalRankingRef.current,
          { opacity: 0, y: 50 },
          { opacity: 1, y: 0, duration: 1 }
        );
      }
      setCurrentPage(0);
      console.log(`Final Ranking 시작: 총 페이지 수 ${totalPages}`);

      if (totalPages === 1) {
        // 페이지가 1개인 경우
        pageTimeoutId = setTimeout(() => {
          console.log("Final Ranking: 단일 페이지 표시 후 Score Result로 이동");
          // 마지막 페이지 딜레이 후 Animation 3으로 이동
          setShowScoreResult(true);
          setScoreCurrentPage(0);
          if (finalRankingRef.current) {
            gsap.to(finalRankingRef.current, {
              opacity: 0,
              duration: 1,
              onComplete: () => {
                console.log("Final Ranking: 애니메이션 종료 및 언마운트");
                setUnmountFinalRank(true);
              },
            });
          }
        }, pageFinalDelay * 1000);
        console.log(
          `Final Ranking: 단일 페이지 타이머 설정됨 (${pageFinalDelay}초 후 Score Result로 이동)`
        );
      } else {
        // 페이지가 여러 개인 경우
        let currentPageIndex = 0;
        console.log(`Final Ranking: 페이지 1/${totalPages} 표시`);

        const showNextPage = () => {
          currentPageIndex++;
          setCurrentPage(currentPageIndex);
          console.log(
            `Final Ranking: 페이지 ${currentPageIndex + 1}/${totalPages} 표시`
          );

          if (currentPageIndex < totalPages - 1) {
            // 마지막 페이지가 아닌 경우, pageDelay 후 다음 페이지로 이동
            pageTimeoutId = setTimeout(showNextPage, pageDelay * 1000);
            console.log(
              `Final Ranking: 다음 페이지로 이동하기 위해 타이머 설정됨 (${pageDelay}초 후)`
            );
          } else {
            // 마지막 페이지인 경우, pageFinalDelay 후 Animation 3으로 이동
            pageTimeoutId = setTimeout(() => {
              console.log(
                "Final Ranking: 마지막 페이지 도달. Score Result로 이동"
              );
              setShowScoreResult(true);
              setScoreCurrentPage(0);
              if (finalRankingRef.current) {
                gsap.to(finalRankingRef.current, {
                  opacity: 0,
                  duration: 1,
                  onComplete: () => {
                    console.log("Final Ranking: 애니메이션 종료 및 언마운트");
                    setUnmountFinalRank(true);
                  },
                });
              }
            }, pageFinalDelay * 1000);
            console.log(
              `Final Ranking: 마지막 페이지 타이머 설정됨 (${pageFinalDelay}초 후 Score Result로 이동)`
            );
          }
        };

        // 첫 번째 페이지는 이미 표시되었으므로, 두 번째 페이지부터 시작
        pageTimeoutId = setTimeout(showNextPage, pageDelay * 1000);
        console.log(
          `Final Ranking: 페이지 전환 타이머 설정됨 (${pageDelay}초 후)`
        );
      }

      return () => {
        clearTimeout(pageTimeoutId);
        console.log("Final Ranking: 타이머 해제됨");
      };
    }
  }, [
    showFinalRank,
    sortedRankings.length,
    itemsPerPage,
    pageDelay,
    pageFinalDelay,
  ]);

  // 애니메이션 3: Score Result with Pagination - 초기화
  useEffect(() => {
    if (showScoreResult) {
      const scoreTotalPages = Math.ceil(sortedRankings.length / itemsPerPage);
      console.log(`Score Result 시작: 총 페이지 수 ${scoreTotalPages}`);
      console.log(`sortedRankings.length: ${sortedRankings.length}`);

      if (scoreTotalPages > 0) {
        setScoreCurrentPage(0);
        console.log(`Score Result: 페이지 1/${scoreTotalPages} 표시`);
      }
    }
  }, [showScoreResult, sortedRankings.length, itemsPerPage]);

  // 애니메이션 3: Score Result with Pagination - 페이지 전환
  useEffect(() => {
    if (showScoreResult) {
      const scoreTotalPages = Math.ceil(sortedRankings.length / itemsPerPage);
      console.log(`Score Result: 현재 페이지 인덱스는 ${scoreCurrentPage}`);
      console.log(`Score Result: 총 페이지 수는 ${scoreTotalPages}`);

      if (scoreTotalPages === 0) {
        console.log("Score Result: 페이지 수가 0입니다.");
        return;
      }

      if (scoreCurrentPage < scoreTotalPages - 1) {
        // 마지막 페이지가 아닌 경우, scorePageDelay 후 다음 페이지로 이동
        const timeoutId = setTimeout(() => {
          setScoreCurrentPage((prevPage) => prevPage + 1);
          console.log(
            `Score Result: 다음 페이지로 이동 (페이지 ${
              scoreCurrentPage + 2
            }/${scoreTotalPages})`
          );
        }, scorePageDelay * 1000);
        console.log(
          `Score Result: 다음 페이지로 이동하기 위해 타이머 설정됨 (${scorePageDelay}초 후)`
        );

        return () => clearTimeout(timeoutId);
      } else if (scoreCurrentPage === scoreTotalPages - 1) {
        // 마지막 페이지인 경우, scoreFinalDelay 후 애니메이션 종료
        const timeoutId = setTimeout(() => {
          console.log("Score Result: 마지막 페이지 도달. 애니메이션 종료");
          if (realtimeData?.screen?.status?.playStart) {
            updateData.updateData(`currentStage/${contestId}/screen/status`, {
              playStart: false,
            });
            console.log("Score Result: playStart 상태 업데이트 완료");
          }
        }, scoreFinalDelay * 1000);
        console.log(
          `Score Result: 마지막 페이지 타이머 설정됨 (${scoreFinalDelay}초 후 애니메이션 종료)`
        );

        return () => clearTimeout(timeoutId);
      }
    }
  }, [
    showScoreResult,
    scoreCurrentPage,
    sortedRankings.length,
    itemsPerPage,
    scorePageDelay,
    scoreFinalDelay,
    contestId,
    realtimeData,
    updateData,
  ]);

  // Score Result 페이지 인덱스 변경 시 로그
  useEffect(() => {
    console.log(`Score Result: 현재 페이지 인덱스는 ${scoreCurrentPage}`);
  }, [scoreCurrentPage]);

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
      <div className="ranking-title w-full">
        {realtimeData?.categoryTitle &&
          realtimeData?.screen?.gradeTitle &&
          `${realtimeData.categoryTitle} ${realtimeData.screen.gradeTitle} 순위발표`}
      </div>
      {/* Step 1: Top 5 Players Animation */}
      {!showFinalRank &&
        topRankings.map((player, i) => (
          <div
            key={i}
            ref={(el) => (rankRefs.current[i] = el)}
            className="ranking-item"
            style={{ zIndex: topRankings.length - i }}
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
                    length:
                      realtimeData?.screen?.players[0]?.score?.length || 0,
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
                {realtimeData?.categoryJudgeType === "point" ? (
                  <li>
                    점수형 채점 방식에서는 숫자가 높을수록 더 높은 순위를
                    의미합니다.
                  </li>
                ) : (
                  <li>
                    랭킹형 채점 방식에서는 숫자가 낮을수록 더 높은 순위를
                    의미합니다.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RankingAnnouncement;
