import React from "react";
import YbbfLogo from "../assets/img/ybbf_logo.png";
import CanvasWithImageData from "./CanvasWithImageData";

const ScoreSheet = ({
  contestId,
  contestInfo,
  gradeId,
  categoryTitle,
  gradeTitle,
  scoreTable,
  judgeHeadInfo,
}) => {
  return (
    <div className="flex w-full h-auto flex-col">
      <div className="flex w-full h-auto p-10">
        <div className="flex w-1/6">
          <div className="flex p-2 w-full justify-center items-center border border-gray-500">
            <img src={YbbfLogo} className="w-42" />
          </div>
        </div>
        <div className="flex w-5/6 justify-start pl-5 py-3">
          <div className="flex w-full justify-start items-start flex-col gap-y-2">
            <span className="font-extrabold text-lg text-gray-700">
              {contestInfo.contestTitle}
            </span>
            <span className="font-semibold text-base text-gray-700">
              <span className="mr-2">장소 : </span>
              {contestInfo.contestLocation}
            </span>
            <span className="font-semibold text-base text-gray-700">
              <span className="mr-2">일자 : </span>
              {contestInfo.contestDate}
            </span>
          </div>
        </div>
      </div>
      <div className="flex h-auto w-full bg-gray-100 items-center py-1 px-8 border-t border-gray-400">
        <div className="flex w-full h-8 px-4 items-center">
          <span className="font-base  text-gray-900">
            <span className="mr-2">종목 :</span>
            {categoryTitle}
          </span>
        </div>
        <div className="flex w-full h-8 px-4 items-center">
          <span className="font-base  text-gray-900">
            <span className="mr-2">체급 :</span>
            {gradeTitle}
          </span>
        </div>
      </div>
      <div className="flex h-auto w-full bg-gray-200 items-center justify-center py-1 px-8 border-t-2 border-b-2 border-gray-600">
        <div className="flex w-full h-12 px-4 items-center justify-center">
          <span className="  text-gray-900">
            <span
              className="mr-2 text-xl font-semibold font-sans"
              style={{ letterSpacing: "22px" }}
            >
              집계테이블
            </span>
          </span>
        </div>
      </div>
      <div className="flex h-auto w-full  items-center py-1 px-8 flex-col mt-5">
        <div className="flex w-full h-14 items-center border-b-2 border-gray-600 text-gray-900 font-semibold text-lg border-r-2 border-l border-t bg-gray-300">
          <div
            className="flex h-full justify-center items-center border-r border-gray-600"
            style={{ width: "10%" }}
          >
            구분
          </div>
          <div
            className="flex h-full justify-center items-center border-r border-gray-600"
            style={{ width: "8%" }}
          >
            순위
          </div>
          {scoreTable?.length > 0 &&
            scoreTable[0].score.map((judge, jIdx) => {
              const { seatIndex } = judge;
              return (
                <div
                  className="flex h-full justify-center items-center border-r border-gray-600"
                  style={{ width: "8%" }}
                >
                  {seatIndex}
                </div>
              );
            })}
          <div
            className="flex h-full justify-center items-center "
            style={{ width: "10%" }}
          >
            합계
          </div>
        </div>

        {scoreTable?.length > 0 &&
          scoreTable.map((player, pIdx) => {
            const { playerNumber, score, playerRank, totalScore } = player;

            return (
              <>
                {playerRank >= 1000 ? null : (
                  <div className="flex w-full h-14 items-center border-b border-gray-600 text-gray-900 font-semibold text-lg border-l border-r-2 last:border-b-2">
                    <div
                      className="flex h-full justify-center items-center border-r border-gray-600 text-gray-900 font-semibold text-l"
                      style={{ width: "10%" }}
                    >
                      {playerNumber}
                    </div>
                    <div
                      className="flex h-full justify-center items-center  font-normal border-r border-gray-400 italic"
                      style={{ width: "8%" }}
                    >
                      {playerRank}
                    </div>
                    {score?.length > 0 &&
                      score.map((item, iIdx) => {
                        const { playerScore, isMax, isMin } = item;

                        return (
                          <>
                            {isMax && (
                              <div
                                className="flex h-full justify-center items-center border-r border-gray-400 text-sm font-normal p-1 "
                                style={{ width: "8%" }}
                              >
                                <span className="bg-gray-600 text-white w-full h-full flex justify-center items-center">
                                  {playerScore}
                                </span>
                              </div>
                            )}
                            {isMin && (
                              <div
                                className="flex h-full justify-center items-center border-r border-gray-400 text-sm font-normal p-1 "
                                style={{ width: "8%" }}
                              >
                                <span className="bg-gray-400 text-white w-full h-full flex justify-center items-center">
                                  {playerScore}
                                </span>
                              </div>
                            )}
                            {!isMax && !isMin && (
                              <div
                                className="flex h-full justify-center items-center border-r border-gray-400 text-sm font-normal"
                                style={{ width: "8%" }}
                              >
                                {playerScore}
                              </div>
                            )}
                          </>
                        );
                      })}
                    <div
                      className="flex h-full justify-center items-center  font-normal border-gray-400 italic"
                      style={{ width: "10%" }}
                    >
                      {totalScore}
                    </div>
                  </div>
                )}
              </>
            );
          })}
      </div>
      <div className="flex h-20 w-full justify-start items-center py-1 px-8 flex-col mt-10">
        <div className="flex w-full h-full text-lg font-semibold justify-start items-center border-b border-gray-800">
          <span className="mr-5">심사위원장 : </span>
          <span className="text-xl" style={{ letterSpacing: "40px" }}>
            {judgeHeadInfo?.judgeName}
          </span>
          <div className="flex">
            <CanvasWithImageData imageData={judgeHeadInfo?.judgeSignature} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreSheet;
