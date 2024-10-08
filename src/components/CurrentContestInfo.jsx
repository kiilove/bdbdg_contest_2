// ../components/CurrentContestInfo.js
import React from "react";

const CurrentContestInfo = ({
  contestInfo,
  isHolding,
  realtimeData,
  lastUpdated,
  setIsHolding,
}) => (
  <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg p-3">
    <div className="flex w-3/5 px-2 flex-col gap-y-2">
      <h1 className="font-sans text-base font-semibold">
        대회명 : {contestInfo.contestTitle}
      </h1>
      <h1 className="font-sans text-base font-semibold">
        채점표DB : {contestInfo.contestCollectionName}
      </h1>
      <h1 className="font-sans text-base font-semibold">
        모니터링상태 :{" "}
        {realtimeData?.stageId && !isHolding && "실시간모니터링중"}
        {isHolding && "모니터링 일시정지"}
        {!realtimeData?.stageId && !isHolding && "대회시작전"}
      </h1>
      {lastUpdated && (
        <h1 className="font-sans text-sm text-gray-500">
          마지막 업데이트: {lastUpdated}
        </h1>
      )}
    </div>
    <div className="flex w-2/5 h-full gap-x-2">
      {isHolding && (
        <button
          className="bg-blue-600 w-full h-full text-white text-lg rounded-lg"
          onClick={() => setIsHolding(false)}
        >
          모니터링 시작
        </button>
      )}
      {!realtimeData?.stageId && !isHolding && (
        <button
          className="bg-blue-400 w-full h-full text-white text-lg rounded-lg"
          onClick={() => setIsHolding(false)}
        >
          대회시작
        </button>
      )}
    </div>
  </div>
);

export default CurrentContestInfo;
