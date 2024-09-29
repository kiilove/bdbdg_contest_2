import React, { useEffect, useState, useRef } from "react";
import { gsap } from "gsap";
import "./RankingAnnouncement.css";

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

const RankingAnnouncement = () => {
  const totalRanks = 5; // 발표할 순위 수 (5위부터 1위까지)
  const [currentRankIndex, setCurrentRankIndex] = useState(0);
  const rankRefs = useRef([]); // 순위 요소들에 대한 참조 배열

  useEffect(() => {
    const timelines = [];

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
  }, []);

  return (
    <div className="ranking-container">
      <h1 className="title">순위 발표</h1>

      {Array.from({ length: totalRanks }).map((_, i) => (
        <div
          key={i}
          ref={(el) => (rankRefs.current[i] = el)}
          className="ranking-item"
          style={{ zIndex: totalRanks - i }}
        >
          <h2>{5 - i}위 발표!</h2>
          <p>이름: {shuffledRankings[i].name}</p>
          <p>소속: {shuffledRankings[i].team}</p>
          <p>선수번호: {shuffledRankings[i].playerNumber}</p>
        </div>
      ))}
    </div>
  );
};

export default RankingAnnouncement;
