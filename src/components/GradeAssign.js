import React from "react";

const GradeAssign = ({
  judgesAssignInfo,
  judgesPoolArray,
  setJudgesAssignInfo,
  categoriesArray,
  gradesArray,
  generateUUID, // generateUUID를 props로 받음
  currentContest, // currentContest를 props로 받음
}) => {
  // 등급별 심판 배정 처리 함수
  const handleSelectJudge = (gradeId, seatIndex, judgeUid) => {
    const selectedJudge = judgesPoolArray.find(
      (judge) => judge.judgeUid === judgeUid
    );
    if (selectedJudge) {
      const updatedJudges = judgesAssignInfo.judges.filter(
        (assign) => assign.gradeId !== gradeId || assign.seatIndex !== seatIndex
      );

      updatedJudges.push({
        gradeId,
        seatIndex,
        judgeUid: selectedJudge.judgeUid,
        judgeName: selectedJudge.judgeName,
        judgesAssignId: generateUUID(), // generateUUID 사용
        contestId: currentContest.contests.id, // currentContest 사용
      });

      setJudgesAssignInfo((prev) => ({
        ...prev,
        judges: updatedJudges,
      }));
    }
  };

  // 배정 취소 기능
  const handleRemoveAssign = (gradeId, seatIndex) => {
    const updatedJudges = judgesAssignInfo.judges.filter(
      (assign) =>
        !(assign.gradeId === gradeId && assign.seatIndex === seatIndex)
    );
    setJudgesAssignInfo((prev) => ({ ...prev, judges: updatedJudges }));
  };

  return (
    <div className="flex w-full flex-col bg-gray-100 rounded-lg gap-y-2">
      {gradesArray.map((grade, gradeIdx) => {
        const allSeats = Array.from(
          { length: grade.judgeCount || 0 },
          (_, seatIdx) => seatIdx + 1
        );
        const assignedJudges = judgesAssignInfo.judges
          .filter((assign) => assign.gradeId === grade.gradeId)
          .map((assign) => assign.judgeUid);

        return (
          <div
            key={gradeIdx}
            className="flex w-full flex-col bg-blue-200 rounded-lg"
          >
            <div className="h-auto w-full flex items-center flex-col lg:flex-row">
              <div className="flex w-1/6 h-14 justify-start items-center pl-4">
                {grade.gradeName}
              </div>
            </div>
            <div className="flex p-2">
              <div className="flex bg-gray-100 w-full gap-2 p-2 rounded-lg flex-col">
                {allSeats.map((seatNumber) => {
                  const selectedJudge = judgesAssignInfo.judges.find(
                    (assign) =>
                      assign.gradeId === grade.gradeId &&
                      assign.seatIndex === seatNumber
                  ) || { judgeUid: "unselect" };

                  return (
                    <div
                      key={seatNumber}
                      className="flex bg-gray-100 w-full px-4 rounded-lg h-auto items-center"
                    >
                      <div className="flex w-1/6">{seatNumber}</div>
                      <div className="flex w-5/6">
                        <select
                          className="w-full text-sm"
                          value={selectedJudge.judgeUid || "unselect"}
                          onChange={(e) => {
                            const newJudgeUid = e.target.value;
                            if (newJudgeUid === "unselect") {
                              handleRemoveAssign(grade.gradeId, seatNumber);
                            } else {
                              handleSelectJudge(
                                grade.gradeId,
                                seatNumber,
                                newJudgeUid
                              );
                            }
                          }}
                        >
                          <option value="unselect">선택</option>
                          {judgesPoolArray
                            .filter(
                              (judge) =>
                                !assignedJudges.includes(judge.judgeUid) ||
                                judge.judgeUid === selectedJudge.judgeUid
                            )
                            .map((judge) => (
                              <option
                                key={judge.judgeUid}
                                value={judge.judgeUid}
                              >
                                {judge.isHead && "위원장 / "}
                                {judge.judgeName} ({judge.judgePromoter} /{" "}
                                {judge.judgeTel})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GradeAssign;
