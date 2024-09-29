import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import "./RankingAnnouncement.css";

// 플레이어 데이터
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
  const rankRefs = useRef([]);

  useEffect(() => {
    const totalRanks = 5;

    for (let i = 0; i < totalRanks; i++) {
      const rankRef = rankRefs.current[i];
      const chars = rankRef.querySelectorAll(".char");

      // 등장 애니메이션: 부서진 상태에서 중앙으로 모임
      gsap.fromTo(
        chars,
        {
          x: () => gsap.utils.random(-100, 100), // 랜덤 X 위치
          y: () => gsap.utils.random(-100, 100), // 랜덤 Y 위치
          opacity: 0,
          scale: 0.1,
          rotation: () => gsap.utils.random(-360, 360),
        },
        {
          x: 0,
          y: 0,
          opacity: 1,
          scale: 1,
          rotation: 0,
          stagger: 0.05, // 글자 하나씩 순차적으로
          duration: 1.5,
          delay: i * 4.5, // 순위마다 딜레이 추가
          ease: "back.out(1.7)",
        }
      );

      // 중앙에 모인 후 사라지는 애니메이션
      gsap.to(chars, {
        x: () => gsap.utils.random(100, 300),
        y: () => gsap.utils.random(100, 300),
        opacity: 0,
        scale: 0.1,
        rotation: () => gsap.utils.random(360, -360),
        stagger: 0.05,
        delay: i * 4.5 + 2.5, // 2.5초 후에 사라짐
        duration: 1.5,
        ease: "power3.in",
      });
    }
  }, []);

  return (
    <div className="ranking-container">
      <h1 className="title">순위 발표</h1>

      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          ref={(el) => (rankRefs.current[i] = el)}
          className="ranking-item"
          style={{ zIndex: 5 - i }}
        >
          <h2>{splitText(`${5 - i}위 발표!`)}</h2>
          <p>{splitText(`이름: ${shuffledRankings[i].name}`)}</p>
          <p>{splitText(`소속: ${shuffledRankings[i].team}`)}</p>
          <p>{splitText(`선수번호: ${shuffledRankings[i].playerNumber}`)}</p>
        </div>
      ))}
    </div>
  );
};

// 텍스트를 글자 단위로 쪼개서 span으로 감쌈
const splitText = (text) => {
  return text.split("").map((char, index) => (
    <span key={index} className="char">
      {char}
    </span>
  ));
};

export default RankingAnnouncement;
