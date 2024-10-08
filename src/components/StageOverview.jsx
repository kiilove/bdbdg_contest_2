// ../components/StageOverview.js
import React from "react";
import { PiSpinner } from "react-icons/pi";

const StageOverview = ({
  currentSubTab,
  realtimeData,
  stagesArray,
  handleUpdateCurrentStage,
}) => (
  <div className="flex w-full h-auto justify-start items-center bg-blue-100 rounded-tr-lg rounded-b-lg p-2">
    {realtimeData && stagesArray?.length > 0 && (
      <div className="flex w-full flex-col h-auto gap-y-2">
        <div className="flex bg-white p-2 w-full h-auto rounded-lg flex-col justify-center items-start">
          <div className="flex w-full h-14 justify-between items-center gap-x-2 px-2">
            <div className="flex w-full justify-start items-center gap-x-2">
              <span className="font-bold text-lg">무대목록</span>
            </div>
          </div>
          <div className="flex flex-col w-full h-auto gap-y-2 p-2">
            {stagesArray
              .sort((a, b) => a.stageNumber - b.stageNumber)
              .map((stage, sIdx) => {
                const {
                  grades,
                  stageNumber,
                  stageId,
                  categoryTitle,
                  categoryJudgeType,
                } = stage;
                const playersCount = grades.reduce(
                  (total, grade) => total + parseInt(grade.playerCount || 0),
                  0
                );
                return (
                  <div
                    key={stageId}
                    className={`${
                      realtimeData.stageId === stageId
                        ? "flex w-full h-16 justify-start items-center px-5 bg-blue-400 rounded-lg text-gray-100"
                        : "flex w-full h-10 justify-start items-center px-5 bg-blue-100 rounded-lg"
                    }`}
                  >
                    <div className="flex w-1/2 justify-start items-center flex-wrap">
                      <div className="flex w-10 h-auto items-center">
                        <span className="font-semibold">{stageNumber}</span>
                      </div>
                      <div
                        className="flex w-auto px-2 h-auto items-center"
                        style={{ minWidth: "450px" }}
                      >
                        <span className="font-semibold mr-2">
                          {categoryTitle}
                        </span>
                        <div className="flex w-14 justify-center items-center">
                          {categoryJudgeType === "point" ? (
                            <span className="bg-blue-400 w-10 flex justify-center rounded-lg text-gray-100">
                              P
                            </span>
                          ) : (
                            <span className="bg-green-500 w-10 flex justify-center rounded-lg text-gray-100">
                              R
                            </span>
                          )}
                        </div>
                        {realtimeData.stageId === stageId && (
                          <div className="flex w-auto px-2">
                            <PiSpinner
                              className="animate-spin w-8 h-8"
                              style={{ animationDuration: "1.5s" }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex w-auto px-2 text-base font-normal">
                        <span className="mx-2">출전인원수 :</span>
                        <span className="font-semibold">{playersCount}</span>
                      </div>
                    </div>
                    <div className="flex w-1/2 justify-end items-center flex-wrap py-2">
                      <button
                        onClick={() => handleUpdateCurrentStage(sIdx, "force")}
                        className={`${
                          realtimeData.stageId === stageId
                            ? "flex w-24 justify-center items-center bg-blue-100 rounded-lg p-2 text-gray-900"
                            : "flex w-24 justify-center items-center bg-blue-400 rounded-lg p-2 text-gray-100"
                        }`}
                      >
                        {realtimeData.stageId === stageId
                          ? "강제 재시작"
                          : "강제시작"}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    )}
  </div>
);

export default StageOverview;
