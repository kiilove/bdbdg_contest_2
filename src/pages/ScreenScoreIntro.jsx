import React, { useContext, useEffect, useState } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { debounce } from "lodash";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import ReactPlayer from "react-player";
import AwardVideo from "../assets/mov/award.mp4";
import AwardVideo2 from "../assets/mov/award2.mp4";
const ranks = [
  "1.김진배 / 제이앤코어",
  "3.오종일 / 고궁비빔피트니스클럽",
  "2.홍길동 / 다뺀다짐",
  "Alice Kim",
  "Charlie Lee",
];
const ScreenScoreIntro = ({ categoryTitle, gradeTitle, rankOrder = [] }) => {
  const [scene, setScene] = useState(1); // 현재 씬 (1, 2, 3)
  const [displayedRank, setDisplayedRank] = useState(rankOrder.length); // 5위부터 시작

  useEffect(() => {
    if (scene === 1) {
      setTimeout(() => {
        setScene(2);
      }, 2000); // 2초 대기 후 scene 2로 변경
    }
    if (scene === 2) {
      setTimeout(() => {
        setScene(3);
      }, 1000); // 8초 대기 후 scene 3로 변경
    }
    if (scene === 3 && displayedRank > 0) {
      const timeout = setTimeout(() => {
        setDisplayedRank((prev) => prev - 1); // 1초마다 순위를 1씩 줄여 나갑니다.
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [scene, displayedRank]);

  useEffect(() => {
    setDisplayedRank(rankOrder?.length);
  }, [rankOrder?.length]);

  console.log(rankOrder.length);
  return (
    <div className="overflow-hidden overflow-y-hidden h-screen w-full">
      <div className="absolute top-0 left-0 w-full h-full">
        <ReactPlayer
          url={AwardVideo2}
          width="100%"
          height="100%"
          playing
          loop
          muted
          style={{ position: "absolute", top: 0, left: 0 }}
          config={{
            file: {
              attributes: {
                style: {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                },
              },
            },
          }}
        />
      </div>
      <div
        id="container1"
        className={`container1-${
          scene === 1 ? "entering" : "entered"
        }  h-32 flex absolute text-6xl font-extrabold text-white justify-center items-center`}
        style={{ width: "90%" }}
      >
        <div className="wrapper h-20 w-auto relative justify-center items-center ">
          <div className="bg w-full">{categoryTitle} </div>
          <div className="fg w-full">{categoryTitle} </div>
        </div>
        <div className="wrapper h-20 w-auto  justify-center items-center ">
          <div className="bg w-full">{gradeTitle} </div>
          <div className="fg w-full">{gradeTitle} </div>
        </div>
        <div className="wrapper h-20 w-auto  justify-center items-center ">
          <div className="bg w-full"> 채점결과 </div>
          <div className="fg w-full"> 채점결과 </div>
        </div>
      </div>
      <div
        id="container2"
        className={`container2-${
          scene === 3 ? "entered" : "entering"
        } flex flex-col mt-0 absolute justify-start h-auto gap-y-5 items-center`}
        style={{ width: "80%" }}
      >
        <div
          className={` w-full justify-start h-auto bg-gray-800 rounded-lg flex-col`}
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        >
          <div className="flex w-full text-white text-xl p-10 h-auto flex-col gap-y-2">
            <div className="flex">
              <span>1. </span>
              <span>
                랭킹형의 경우는 기재된 숫자가 작을수록 높은 순위를 뜻합니다.
              </span>
            </div>
            <div className="flex">
              <span>2. </span>
              <span>
                심판의 위치는 랜덤으로 표기됩니다. 자리위치를 보장하지 않습니다.
              </span>
            </div>
          </div>
          <div className="flex w-full text-white font-bold text-2xl  border-b border-white border-t">
            <div
              className="flex h-14 justify-center items-center"
              style={{ width: "10%" }}
            >
              선수번호
            </div>
            <div
              className="flex h-14 justify-center items-center"
              style={{ width: "10%" }}
            >
              A
            </div>
            <div
              className="flex h-14 justify-center items-center"
              style={{ width: "10%" }}
            >
              B
            </div>
            <div
              className="flex h-14 justify-center items-center"
              style={{ width: "10%" }}
            >
              C
            </div>
            <div
              className="flex h-14 justify-center items-center"
              style={{ width: "10%" }}
            >
              D
            </div>
            <div
              className="flex h-14 justify-center items-center"
              style={{ width: "10%" }}
            >
              E
            </div>
            <div
              className="flex h-14 justify-center items-center"
              style={{ width: "10%" }}
            >
              F
            </div>
            <div
              className="flex h-14 justify-center items-center"
              style={{ width: "10%" }}
            >
              G
            </div>
            <div
              className="flex h-14 justify-center items-center"
              style={{ width: "10%" }}
            >
              H
            </div>
            <div
              className="flex h-14 justify-center items-center"
              style={{ width: "10%" }}
            >
              I
            </div>
          </div>
          {rankOrder.length > 0 &&
            rankOrder
              .sort((a, b) => a.playerRank - b.playerRank)
              .map((player, pIdx) => {
                const { score, playerNumber } = player;
                const randomScore = score.sort(
                  (a, b) => a.randomIndex - b.randomIndex
                );

                return (
                  <>
                    <div className="flex w-full last:border-b-0">
                      <div
                        className="flex h-14 justify-center items-center text-white text-2xl border-b border-white"
                        style={{ width: "10%" }}
                      >
                        {playerNumber}
                      </div>
                      {Array.from({ length: 9 }).map((_, idx) => (
                        <div
                          key={idx} // 각 요소에 고유한 key가 필요합니다.
                          className="flex h-18 justify-center items-center text-white  border-b border-white text-xl"
                          style={{ width: "10%" }}
                        >
                          {randomScore[idx]?.playerScore}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })}{" "}
        </div>
      </div>
    </div>
  );
};

export default ScreenScoreIntro;
