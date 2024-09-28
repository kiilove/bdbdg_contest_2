import React from "react";

const CategoryAssign = ({
  judgesAssignInfo,
  judgesPoolArray,
  setJudgesAssignInfo,
  categoriesArray,
  generateUUID, // generateUUID를 props로 받음
  currentContest, // currentContest를 props로 받음
}) => {
  // 이미 배정된 심판 목록을 가져오는 함수
  const getAssignedJudgesForCategory = (categoryId) => {
    console.log(judgesAssignInfo);
    return judgesAssignInfo.judges
      .filter((assign) => assign.categoryId === categoryId)
      .map((assign) => assign.judgeUid);
  };

  // 심판 선택 및 배정하는 함수
  const handleSelectJudge = (categoryId, seatIndex, judgeUid) => {
    const selectedJudge = judgesPoolArray.find(
      (judge) => judge.judgeUid === judgeUid
    );

    if (selectedJudge) {
      const updatedJudges = judgesAssignInfo.judges.filter(
        (assign) =>
          assign.categoryId !== categoryId || assign.seatIndex !== seatIndex
      );

      updatedJudges.push({
        categoryId,
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

  // 랜덤 배정 함수 (비어있는 seat에만 배정)
  const handleRandomAssign = (categoryId, unassignedSeats) => {
    const availableJudges = judgesPoolArray.filter(
      (judge) =>
        !getAssignedJudgesForCategory(categoryId).includes(judge.judgeUid)
    );

    let updatedJudgesAssignInfo = [...judgesAssignInfo.judges];

    if (unassignedSeats.length > 0 && availableJudges.length > 0) {
      unassignedSeats.forEach((seatNumber) => {
        const randomJudge =
          availableJudges[Math.floor(Math.random() * availableJudges.length)];

        if (randomJudge) {
          updatedJudgesAssignInfo.push({
            categoryId,
            seatIndex: seatNumber,
            judgeName: randomJudge.judgeName,
            judgeUid: randomJudge.judgeUid,
            judgesAssignId: generateUUID(),
            contestId: currentContest.contests.id,
          });

          // 배정된 심판을 availableJudges에서 제거
          availableJudges.splice(availableJudges.indexOf(randomJudge), 1);
        }
      });

      setJudgesAssignInfo((prev) => ({
        ...prev,
        judges: updatedJudgesAssignInfo,
      }));
    }
  };

  // 모두 랜덤 배정 함수 (기존 배정된 seat도 무시하고 모든 seat에 배정)
  const handleAllRandomAssign = (categoryId, allSeats) => {
    let availableJudges = [...judgesPoolArray]; // 사용 가능한 심판 배열 복사

    // 기존 배정된 심판을 모두 제거하고 새롭게 배정할 준비
    let updatedJudgesAssignInfo = judgesAssignInfo.judges.filter(
      (assign) => assign.categoryId !== categoryId
    );

    allSeats.forEach((seatNumber) => {
      if (availableJudges.length > 0) {
        const randomJudge = availableJudges.splice(
          Math.floor(Math.random() * availableJudges.length),
          1
        )[0]; // 랜덤 심판 선택 후 제거

        updatedJudgesAssignInfo.push({
          categoryId,
          seatIndex: seatNumber,
          judgeName: randomJudge.judgeName,
          judgeUid: randomJudge.judgeUid,
          judgesAssignId: generateUUID(),
          contestId: currentContest.contests.id,
        });
      }
    });

    // 새로운 배정으로 상태 업데이트
    setJudgesAssignInfo((prev) => ({
      ...prev,
      judges: updatedJudgesAssignInfo,
    }));
  };

  // 초기화 함수 (해당 카테고리의 모든 배정 삭제)
  const handleResetAssign = (categoryId) => {
    const clearedJudges = judgesAssignInfo.judges.filter(
      (assign) => assign.categoryId !== categoryId
    );
    setJudgesAssignInfo((prev) => ({
      ...prev,
      judges: clearedJudges,
    }));
  };

  // 배정 취소 처리 함수
  const handleRemoveAssign = (categoryId, seatIndex) => {
    const updatedJudges = judgesAssignInfo.judges.filter(
      (assign) =>
        !(assign.categoryId === categoryId && assign.seatIndex === seatIndex)
    );
    setJudgesAssignInfo((prev) => ({ ...prev, judges: updatedJudges }));
  };

  return (
    <div className="flex w-full flex-col bg-gray-100 rounded-lg gap-y-2">
      {categoriesArray.map((category, categoryIdx) => {
        const allSeats = Array.from(
          { length: category.judgeCount || 0 },
          (_, seatIdx) => seatIdx + 1
        );

        const unassignedSeats = allSeats.filter(
          (seatNumber) =>
            !judgesAssignInfo.judges.some(
              (assign) =>
                assign.categoryId === category.contestCategoryId &&
                assign.seatIndex === seatNumber
            )
        );

        const assignedJudges = getAssignedJudgesForCategory(
          category.contestCategoryId
        );
        console.log(assignedJudges);

        return (
          <div
            key={categoryIdx}
            className="flex w-full flex-col bg-blue-200 rounded-lg"
          >
            <div className="h-auto w-full flex items-center flex-col lg:flex-row">
              <div className="flex w-1/6 h-14 justify-start items-center pl-4">
                {category.contestCategoryTitle}
              </div>
            </div>
            <div className="flex p-2">
              <div className="flex bg-gray-100 w-full gap-2 p-2 rounded-lg flex-col">
                <div className="flex w-full bg-white rounded-lg p-2">
                  <div className="w-1/6">좌석</div>
                  <div className="w-5/6">선택</div>
                  {/* 랜덤 배정 버튼 추가 */}
                  <button
                    className="ml-2 bg-green-500 text-white rounded px-2"
                    onClick={() =>
                      handleRandomAssign(
                        category.contestCategoryId,
                        unassignedSeats
                      )
                    }
                  >
                    랜덤배정
                  </button>
                  {/* 모두 랜덤 배정 버튼 추가 */}
                  <button
                    className="ml-2 bg-yellow-500 text-white rounded px-2"
                    onClick={() =>
                      handleAllRandomAssign(
                        category.contestCategoryId,
                        allSeats
                      )
                    }
                  >
                    모두랜덤배정
                  </button>
                  {/* 초기화 버튼 추가 */}
                  <button
                    className="ml-2 bg-red-500 text-white rounded px-2"
                    onClick={() =>
                      handleResetAssign(category.contestCategoryId)
                    }
                  >
                    초기화
                  </button>
                </div>
                {allSeats.map((seatNumber) => {
                  const selectedJudge = judgesAssignInfo.judges.find(
                    (assign) =>
                      assign.categoryId === category.contestCategoryId &&
                      assign.seatIndex === seatNumber
                  ) || { judgeUid: "unselect" };
                  console.log(selectedJudge);

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
                              handleRemoveAssign(
                                category.contestCategoryId,
                                seatNumber
                              );
                            } else {
                              handleSelectJudge(
                                category.contestCategoryId,
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

export default CategoryAssign;
