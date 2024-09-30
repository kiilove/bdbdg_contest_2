import React, { useEffect, useState, useRef } from "react";
import { gsap } from "gsap";
import "./RankingAnnouncement.css";
import AwardVideo from "../assets/mov/award3.mp4";
import ReactPlayer from "react-player";

const players = [
  { uid: 1, name: "김철수", team: "A팀", playerNumber: 23 },
  { uid: 2, name: "박영희", team: "B팀", playerNumber: 45 },
  { uid: 3, name: "이민호", team: "C팀", playerNumber: 12 },
  { uid: 4, name: "최수정", team: "D팀", playerNumber: 67 },
  { uid: 5, name: "정우성", team: "E팀", playerNumber: 89 },
  { uid: 6, name: "강호동", team: "F팀", playerNumber: 34 },
  { uid: 7, name: "이효리", team: "G팀", playerNumber: 56 },
];

// 순위를 무작위로 섞음
const shuffledRankings = [...players].sort(() => Math.random() - 0.5);

const RankingAnnouncement = ({
  categoryTitle,
  gradeTitle,
  rankOrder = [],
  results = [],
}) => {
  const totalRanks = 5; // 발표할 순위 수 (5위부터 1위까지)
  const [showFinalRank, setShowFinalRank] = useState(false); // 전체 순위표를 보여줄 상태 변수
  const [showScoreResult, setShowScoreResult] = useState(false); // 채점 결과를 보여줄 상태 변수
  const [unmountFinalRank, setUnmountFinalRank] = useState(false); // 최종 순위표를 언마운트하기 위한 상태 변수
  const rankRefs = useRef([]); // 순위 요소들에 대한 참조 배열
  const finalRankingRef = useRef(null); // final-ranking 요소에 대한 참조

  useEffect(() => {
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
      setShowFinalRank(true);
    }, lastDelay * 1000); // 딜레이 후 전체 순위표 표시

    // 채점 결과를 표시하기 위한 추가 딜레이
    setTimeout(() => {
      setShowScoreResult(true);

      // final-ranking을 서서히 사라지게 하고, 사라진 후 언마운트
      gsap.to(finalRankingRef.current, {
        opacity: 0,
        duration: 1,
        onComplete: () => {
          setUnmountFinalRank(true);
        },
      });
    }, lastDelay * 1000 + 5000); // 전체 순위표 이후 5초 후에 채점 결과 표시
  }, [totalRanks]);

  // 순위를 1위부터 정렬하여 렌더링
  const sortedRankings = shuffledRankings
    .slice(0, totalRanks)
    .sort((a, b) => a.uid - b.uid);

  return (
    <div className="ranking-container">
      <ReactPlayer
        url={AwardVideo}
        width="100%"
        height="auto"
        playing
        loop
        muted
      />
      {!showFinalRank &&
        Array.from({ length: totalRanks }).map((_, i) => (
          <div
            key={i}
            ref={(el) => (rankRefs.current[i] = el)}
            className="ranking-item"
            style={{ zIndex: totalRanks - i }}
          >
            <h2 className="gap-x-5">
              <span className="rank">{5 - i}위</span>
              <span className="player-number ml-5">
                {shuffledRankings[i].playerNumber}번
              </span>
              <span className="player-name ml-10">
                {shuffledRankings[i].name}
              </span>
            </h2>
            <p>{shuffledRankings[i].team}</p> {/* 소속은 아랫줄에 배치 */}
          </div>
        ))}
      {showFinalRank && (
        <>
          {!unmountFinalRank && (
            <div className="final-ranking" ref={finalRankingRef}>
              <h2>전체 순위표</h2>
              <ul>
                {sortedRankings.map((player, i) => (
                  <li key={player.uid}>
                    {i + 1}위: {player.playerNumber}번 {player.name} (
                    {player.team})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={`score-result ${showScoreResult ? "show" : ""}`}>
            <h2>채점 결과</h2>
            <ul>
              {sortedRankings.map((player, i) => (
                <li key={player.uid}>
                  {i + 1}위: {player.playerNumber}번 {player.name} - 최종 점수:{" "}
                  {Math.floor(Math.random() * 100)}점
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default RankingAnnouncement;
