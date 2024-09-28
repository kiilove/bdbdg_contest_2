import React, { useState, useEffect, useContext } from "react";
import ReactPlayer from "react-player";
import AwardVideo from "../assets/mov/award.mp4";
import "../styles/style.scss";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import { debounce } from "lodash";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ScreenPlayerIntro from "./ScreenPlayerIntro";
import ScreenScoreIntro from "./ScreenScoreIntro";
import { useParams } from "react-router-dom";
import LoadingPage from "./LoadingPage";
import CountDown from "../assets/mov/countdown.mp4";

const StandingTableType1 = () => {
  const { data: realtimeData, getDocument: currentStageFunction } =
    useFirebaseRealtimeGetDocument();

  const [scene, setScene] = useState(1); // 현재 씬 (1, 2, 3)
  const [displayedRank, setDisplayedRank] = useState(5); // 5위부터 시작
  const [isLoading, setIsLoading] = useState(true);
  const { contestId } = useParams();
  useEffect(() => {
    if (contestId) {
      const debouncedGetDocument = debounce(
        () => currentStageFunction(`currentStage/${contestId}`),
        10000
      );
      debouncedGetDocument();
    }

    return () => {};
  }, [currentStageFunction, contestId]);

  useEffect(() => {
    if (realtimeData?.screen) {
      console.log(realtimeData.screen);
      setIsLoading(false);
    }
  }, [realtimeData?.screen]);

  return (
    <div className="flex w-full h-full relative items-start justify-center overflow-hidden">
      {isLoading && (
        <div className="flex w-full h-screen justify-center items-center bg-white">
          <LoadingPage />
        </div>
      )}
      {!isLoading && realtimeData && realtimeData.screen.status.playStart && (
        <ScreenPlayerIntro
          categoryTitle={realtimeData.categoryTitle}
          gradeTitle={realtimeData.screen.gradeTitle}
          rankOrder={realtimeData.screen.players}
        />
      )}
      {!isLoading &&
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
