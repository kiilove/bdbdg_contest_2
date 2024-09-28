import React, { useState, useEffect } from "react";
import ReactPlayer from "react-player";
import "../styles/style.scss";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import { debounce } from "lodash";
import { useParams } from "react-router-dom";
import ScreenPlayerIntro from "./ScreenPlayerIntro";
import ScreenScoreIntro from "./ScreenScoreIntro";
import LoadingPage from "./LoadingPage";
import CountDown from "../assets/mov/countdown.mp4"; // 카운트다운 동영상 파일

const StandingTableType1 = () => {
  const { data: realtimeData, getDocument: currentStageFunction } =
    useFirebaseRealtimeGetDocument();

  const [scene, setScene] = useState(1); // 현재 씬 (1, 2, 3)
  const [displayedRank, setDisplayedRank] = useState(5); // 5위부터 시작
  const [isLoading, setIsLoading] = useState(true); // 데이터를 로딩 중인 상태
  const [isCountdown, setIsCountdown] = useState(true); // 카운트다운 중인 상태
  const { contestId } = useParams();

  // 카운트다운 후 데이터를 로드
  useEffect(() => {
    console.log("contestId:", contestId); // 콘솔 로그로 확인
    if (contestId) {
      const debouncedGetDocument = debounce(
        () => currentStageFunction(`currentStage/${contestId}`),
        0
      );
      // 5초 후 카운트다운이 끝나고 데이터를 로드
      const countdownTimer = setTimeout(() => {
        setIsCountdown(false); // 카운트다운 종료
        debouncedGetDocument(); // 데이터 로드 시작
      }, 5000); // 5초 동안 카운트다운 재생

      return () => clearTimeout(countdownTimer);
    }
  }, [currentStageFunction, contestId]);

  // 데이터가 로드된 후 로딩 상태를 변경
  useEffect(() => {
    if (realtimeData?.screen) {
      console.log("Realtime data loaded:", realtimeData.screen); // 콘솔 로그 추가
      setIsLoading(false); // 데이터가 로드되면 로딩 완료
    }
  }, [realtimeData?.screen]);

  return (
    <div className="flex w-full h-full  items-start justify-center">
      {/* 카운트다운 중이면 CountDown 동영상 재생 */}
      {isCountdown && (
        <div className="absolute top-0 left-0 w-full h-full">
          <ReactPlayer
            url={CountDown}
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
      )}

      {/* 데이터 로딩 중일 때 로딩 페이지 표시 */}
      {!isCountdown && isLoading && (
        <div className="flex w-full h-screen justify-center items-center bg-black">
          <LoadingPage />
        </div>
      )}

      {/* 데이터가 로드되고 플레이가 시작되면 ScreenPlayerIntro */}
      {!isCountdown &&
        !isLoading &&
        realtimeData &&
        realtimeData.screen.status.playStart && (
          <ScreenPlayerIntro
            categoryTitle={realtimeData.categoryTitle}
            gradeTitle={realtimeData.screen.gradeTitle}
            rankOrder={realtimeData.screen.players}
          />
        )}

      {/* 데이터가 로드되고 스탠딩이 시작되면 ScreenScoreIntro */}
      {!isCountdown &&
        !isLoading &&
        realtimeData &&
        realtimeData.screen.status.standingStart && (
          <ScreenScoreIntro
            categoryTitle={realtimeData.categoryTitle}
            gradeTitle={realtimeData.screen.gradeTitle}
            rankOrder={realtimeData.screen.players}
          />
        )}
    </div>
  );
};

export default StandingTableType1;
