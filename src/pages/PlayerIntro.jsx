import React, { useContext, useEffect, useState } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { debounce } from "lodash";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import ReactPlayer from "react-player";
import PlayerIntroMp4 from "../assets/mov/introduce.mp4";
const ranks = [
  "1.김진배 / 제이앤코어",
  "3.오종일 / 고궁비빔피트니스클럽",
  "2.홍길동 / 다뺀다짐",
  "Alice Kim",
  "Charlie Lee",
];
const PlayerIntro = ({ categoryTitle }) => {
  const [scene, setScene] = useState(1); // 현재 씬 (1, 2, 3)
  const [displayedRank, setDisplayedRank] = useState(5); // 5위부터 시작

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
  return (
    <div className="w-full h-screen p-0">
      <ReactPlayer
        url={PlayerIntroMp4}
        width="1920px"
        height="1080px"
        muted
        playing
        loop
      />
      <div
        id="container1"
        className={`container1-${
          scene === 1 ? "entering" : "entered"
        }  h-32 flex absolute text-7xl font-extrabold text-white justify-center items-center`}
        style={{ width: "90%" }}
      >
        <div className="wrapper h-20 w-full relative justify-center items-center ">
          <div className="bg w-full">{categoryTitle}</div>
          <div className="fg w-full">{categoryTitle}</div>
        </div>
      </div>
      <div
        id="container2"
        className={`container2-${
          scene === 3 ? "entered" : "entering"
        } flex flex-col mt-24 absolute justify-start h-auto gap-y-5 items-center`}
        style={{ width: "80%" }}
      >
        {ranks.map((name, idx) => (
          <div
            key={idx}
            className={` w-full justify-start h-28 bg-gray-800 rounded-lg ${
              idx < displayedRank ? "hidden" : "flex"
            }`}
            style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
          >
            <div
              className={`${
                idx === 0
                  ? "wrapper h-28 w-full text-6xl "
                  : idx > 0 && idx <= 2
                  ? "wrapper h-28 w-full text-5xl "
                  : "wrapper h-28 w-full text-4xl "
              } flex w-full justify-start items-center`}
            >
              <div className="bg w-full flex justify-start px-5">
                <span className="mx-10">{idx + 1}위</span>
                <h1>{name}</h1>
              </div>
              <div className="fg w-full flex justify-start px-5">
                <span className="mx-10">{idx + 1}위</span>
                <h1>{name}</h1>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerIntro;
