// ../components/CurrentStageDetails.js
import React from "react";

const CurrentStageDetails = ({
  realtimeData,
  stagesArray,
  judgesIsEndValidated,
  currentStageInfo,
  playersArray,
  normalScoreData,
  handleForceReStart,
  handleUpdateCurrentStage,
  handleForceScoreTableRefresh,
  handleScreenEnd,
  fetchResultAndScoreBoard,
  setSummaryPrintPreviewOpen,
  setAwardPrintPreviewOpen,
  setSummaryProp,
  setAwardProp,
  currentContest,
}) => (
  <>
    {realtimeData && (
      <div className="flex w-full flex-col h-auto gap-y-2">
        <div className="flex bg-white p-2 w-full h-auto rounded-lg flex-col justify-center items-start">
          <div className="flex w-full h-14 justify-between items-center gap-x-2 px-2">
            <div className="flex w-full justify-start items-center gap-x-2">
              <span className="font-bold text-lg">진행상황</span>
            </div>
            {!judgesIsEndValidated && (
              <div className="flex w-full justify-end items-center gap-x-2">
                <button
                  className="w-24 h-10 bg-blue-500 rounded-lg text-gray-100"
                  onClick={() =>
                    handleUpdateCurrentStage(realtimeData.stageNumber, "next")
                  }
                >
                  다음진행
                </button>
              </div>
            )}
          </div>
          <div className="flex w-full h-10 justify-start items-center px-2">
            <span className="font-semibold">
              {realtimeData?.categoryTitle}({realtimeData?.gradeTitle})
            </span>
            <div className="flex w-14 justify-center items-center">
              {stagesArray[realtimeData?.stageNumber - 1].categoryJudgeType ===
              "point" ? (
                <span className="bg-blue-400 w-10 flex justify-center rounded-lg text-gray-100">
                  P
                </span>
              ) : (
                <span className="bg-green-500 w-10 flex justify-center rounded-lg text-gray-100">
                  R
                </span>
              )}
            </div>
          </div>
          {/* Table Header */}
          <div className="flex w-full h-auto flex-wrap box-border flex-col px-2">
            <div className="flex w-full h-10 text-lg ">
              {realtimeData?.judges &&
                realtimeData.judges.map((judge, jIdx) => (
                  <div
                    key={jIdx}
                    className="h-full p-2 justify-center items-center flex last:border-l-0 border-blue-400 border-y border-r bg-blue-200 first:border-l w-full"
                    style={{ maxWidth: "15%" }}
                  >
                    {judge.seatIndex}
                  </div>
                ))}
            </div>
            {/* Judging Status */}
            <div className="flex w-full h-auto text-lg bg-gray-100 items-start">
              {realtimeData?.judges &&
                realtimeData.judges.map((judge, jIdx) => (
                  <div
                    key={jIdx}
                    className="h-full p-2 justify-center items-start flex last:border-l-0 border-blue-400 border-y border-r border-t-0 text-sm first:border-l w-full"
                    style={{ maxWidth: "15%" }}
                  >
                    {judge.isEnd && judge.isLogined && "심사종료"}
                    {!judge.isEnd && judge.isLogined && "심사중"}
                    {!judge.isEnd && !judge.isLogined && "로그인대기"}
                  </div>
                ))}
            </div>
            {/* Force Restart */}
            <div className="flex w-full h-auto text-lg bg-gray-100 items-start">
              {realtimeData?.judges &&
                realtimeData.judges.map((judge, jIdx) => (
                  <div
                    key={jIdx}
                    className="h-full p-2 justify-center items-start flex last:border-l-0 border-blue-400 border-y border-r border-t-0 text-sm first:border-l w-full"
                    style={{ maxWidth: "15%" }}
                  >
                    <button
                      className="w-32 h-8 rounded-lg border border-blue-500 bg-white"
                      onClick={() =>
                        handleForceReStart(jIdx, currentContest.contests.id)
                      }
                    >
                      강제다시시작
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Score Summary */}
        <div className="flex bg-white p-2 w-full h-auto rounded-lg flex-col justify-center items-start">
          <div className="flex w-full h-14 justify-between items-center gap-x-2 px-2">
            <span className="font-bold text-lg">집계상황</span>
            <button
              className="ml-2"
              onClick={() =>
                handleForceScoreTableRefresh(currentStageInfo.grades)
              }
            >
              새로고침
            </button>
          </div>
          {currentStageInfo?.grades?.length > 0 &&
            currentStageInfo.grades.map((grade, gIdx) => {
              const filterdPlayers = playersArray
                .filter(
                  (f) =>
                    f.contestGradeId === grade.gradeId &&
                    f.playerNoShow === false
                )
                .sort((a, b) => a.playerIndex - b.playerIndex);
              return (
                <div key={gIdx} className="flex w-full h-auto p-2 flex-col">
                  <div className="flex w-full h-20 justify-start items-center">
                    <div className="flex w-1/2">
                      {grade.categoryTitle}({grade.gradeTitle})
                      {(realtimeData?.resultSaved || []).includes(
                        grade.gradeId
                      ) && (
                        <span className="ml-2 text-red-500 font-semibold">
                          순위표확정
                        </span>
                      )}
                    </div>
                    <div className="flex w-2/3 justify-end items-center gap-x-2">
                      <button
                        className="w-auto h-10 bg-blue-900 rounded-lg text-gray-100 px-5"
                        onClick={handleScreenEnd}
                      >
                        화면종료
                      </button>
                      <button
                        className="w-auto h-10 bg-blue-900 rounded-lg text-gray-100 px-5"
                        onClick={() =>
                          fetchResultAndScoreBoard(
                            grade.gradeId,
                            grade.gradeTitle
                          )
                        }
                      >
                        순위표공개
                      </button>
                      <button
                        className="w-auto h-10 bg-blue-900 rounded-lg text-gray-100 px-5"
                        onClick={() => {
                          setSummaryProp({
                            contestId: currentContest.contests.id,
                            gradeId: grade.gradeId,
                            categoryTitle: grade.categoryTitle,
                            gradeTitle: grade.gradeTitle,
                            categoryJudgeType:
                              currentStageInfo.categoryJudgeType,
                          });
                          setSummaryPrintPreviewOpen(true);
                        }}
                      >
                        집계/채점 통합 출력
                      </button>
                      <button
                        className="w-auto h-10 bg-blue-900 rounded-lg text-gray-100 px-5"
                        onClick={() => {
                          setAwardProp({
                            contestId: currentContest.contests.id,
                            gradeId: grade.gradeId,
                            categoryTitle: grade.categoryTitle,
                            gradeTitle: grade.gradeTitle,
                            categoryJudgeType:
                              currentStageInfo.categoryJudgeType,
                          });
                          setAwardPrintPreviewOpen(true);
                        }}
                      >
                        상장출력
                      </button>
                    </div>
                  </div>

                  {/* Player Scores */}
                  <div className="flex w-full h-10 justify-start items-center">
                    <div
                      className="h-full p-2 justify-center items-start flex w-full border border-gray-400 border-b-2"
                      style={{ maxWidth: "15%" }}
                    >
                      구분
                    </div>
                    {realtimeData?.judges &&
                      realtimeData.judges.map((judge, jIdx) => (
                        <div
                          key={jIdx}
                          className="h-full p-2 justify-center items-start flex w-full border-t border-b-2 border-r border-gray-400"
                          style={{ maxWidth: "15%" }}
                        >
                          {judge.seatIndex}
                        </div>
                      ))}
                  </div>

                  {filterdPlayers.map((player, pIdx) => (
                    <div key={pIdx} className="flex">
                      <div
                        className="h-full p-2 justify-center items-start flex w-full border-l border-b border-r border-gray-400"
                        style={{ maxWidth: "15%" }}
                      >
                        {player.playerNumber}
                      </div>
                      {realtimeData?.judges.map((judge, jIdx) => {
                        const finded = normalScoreData.find(
                          (f) =>
                            f.playerNumber === player.playerNumber &&
                            f.seatIndex === judge.seatIndex
                        );
                        return (
                          <div
                            key={jIdx}
                            className="h-auto p-2 justify-center items-start flex w-full border-r border-b border-gray-400"
                            style={{ maxWidth: "15%" }}
                          >
                            {finded?.playerScore !== 0 &&
                            finded?.playerScore !== undefined &&
                            finded?.playerScore !== 1000
                              ? finded.playerScore
                              : ""}
                            {finded?.playerScore === 1000 && "순위제외"}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
        </div>
      </div>
    )}
  </>
);

export default CurrentStageDetails;
