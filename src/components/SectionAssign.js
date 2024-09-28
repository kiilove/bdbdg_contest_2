import React from "react";
import { useEffect } from "react";

const SectionAssign = ({
  judgesAssignInfo,
  judgesPoolArray,
  filteredBySection,
  setJudgesAssignInfo,
  currentContest,
  generateUUID,
  setMessage,
  setMsgOpen,
}) => {
  // 이미 배정된 심판 목록을 가져오는 함수
  const getAssignedJudgesForSection = (sectionName) => {
    return judgesAssignInfo.judges
      .filter((assign) => assign.sectionName === sectionName)
      .map((assign) => assign.judgeUid);
  };

  // 모든 그레이드를 순회하며 심판을 각 그레이드에 배정하는 함수
  const assignJudgeToGrades = (
    sectionGrades,
    selectedJudge,
    seatNumber,
    sectionName,
    updatedJudges,
    generateUUID,
    currentContest
  ) => {
    let hasError = false;
    let errorFields = [];

    sectionGrades.forEach((grade) => {
      // 각 필드를 검사하여 누락된 필드를 errorFields에 추가
      if (!grade.refCategoryId) errorFields.push("refCategoryId");
      if (!grade.contestGradeId) errorFields.push("contestGradeId");
      if (!grade.contestGradeIndex && grade.contestGradeIndex !== 0)
        errorFields.push("contestGradeIndex");
      if (!grade.contestGradeTitle) errorFields.push("contestGradeTitle");
      if (
        selectedJudge.judgeUid === undefined ||
        selectedJudge.judgeUid === null
      )
        errorFields.push("judgeUid");
      if (
        selectedJudge.judgeName === undefined ||
        selectedJudge.judgeName === null
      )
        errorFields.push("judgeName");
      if (!currentContest.contests.id) errorFields.push("contestId");
      if (!seatNumber && seatNumber !== 0) errorFields.push("seatIndex");

      // 필수 필드가 누락된 경우
      if (errorFields.length > 0) {
        setMessage({
          body: `배정할 수 없습니다. ${sectionName}의 ${seatNumber}번 좌석에 필수 정보가 누락되었습니다: ${errorFields.join(
            ", "
          )}.`,
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        hasError = true;
        return; // 더 이상 진행하지 않고 종료
      }

      // 필수 데이터가 모두 있는 경우에만 배정 진행
      if (!hasError) {
        updatedJudges.push({
          sectionName,
          seatIndex: seatNumber,
          judgeUid: selectedJudge.judgeUid,
          judgeName: selectedJudge.judgeName,
          judgesAssignId: generateUUID(),
          contestId: currentContest.contests.id,
          isHead: selectedJudge.isHead,
          onedayPassword: selectedJudge.onedayPassword || null,
          categoryId: grade.refCategoryId, // 카테고리 ID
          contestGradeId: grade.contestGradeId, // 그레이드 ID
          contestGradeIndex: grade.contestGradeIndex, // 그레이드 순서
          contestGradeTitle: grade.contestGradeTitle, // 그레이드 이름
          isCompared: grade.isCompared || false, // 비교 여부
          refCategoryId: grade.refCategoryId || null, // 참조 카테고리
        });
      }
    });

    return !hasError; // 오류 발생 여부를 반환
  };

  // 심판 선택 및 배정하는 함수
  const handleSelectJudge = (sectionName, seatIndex, judgeUid) => {
    const selectedJudge = judgesPoolArray.find(
      (judge) => judge.judgeUid === judgeUid
    );

    if (selectedJudge) {
      const updatedJudges = judgesAssignInfo.judges.filter(
        (assign) =>
          assign.sectionName !== sectionName || assign.seatIndex !== seatIndex
      );

      const sectionInfo = filteredBySection.find(
        (section) => section.sectionName === sectionName
      );

      if (sectionInfo) {
        const { sectionGrades } = sectionInfo;

        // 배정이 성공하면 상태를 업데이트
        if (
          assignJudgeToGrades(
            sectionGrades,
            selectedJudge,
            seatIndex,
            sectionName,
            updatedJudges,
            generateUUID,
            currentContest,
            setMessage, // 메시지 함수
            setMsgOpen // 메시지 창 열기 함수
          )
        ) {
          setJudgesAssignInfo((prev) => ({
            ...prev,
            judges: updatedJudges,
          }));
        }
      }
    }
  };

  // 랜덤 배정 함수 (비어있는 seat에만 배정)
  const handleRandomAssign = (sectionName, unassignedSeats) => {
    const availableJudges = judgesPoolArray.filter(
      (judge) =>
        !getAssignedJudgesForSection(sectionName).includes(judge.judgeUid)
    );

    let updatedJudgesAssignInfo = [...judgesAssignInfo.judges];

    if (unassignedSeats.length > 0 && availableJudges.length > 0) {
      const sectionInfo = filteredBySection.find(
        (section) => section.sectionName === sectionName
      );

      if (sectionInfo) {
        const { sectionGrades } = sectionInfo;

        unassignedSeats.forEach((seatNumber) => {
          const randomJudge =
            availableJudges[Math.floor(Math.random() * availableJudges.length)];

          if (randomJudge) {
            // 배정이 성공하면 상태를 업데이트
            if (
              assignJudgeToGrades(
                sectionGrades,
                randomJudge,
                seatNumber,
                sectionName,
                updatedJudgesAssignInfo,
                generateUUID,
                currentContest,
                setMessage,
                setMsgOpen
              )
            ) {
              // 배정된 심판을 availableJudges에서 제거
              availableJudges.splice(availableJudges.indexOf(randomJudge), 1);
            }
          }
        });

        setJudgesAssignInfo((prev) => ({
          ...prev,
          judges: updatedJudgesAssignInfo,
        }));
      }
    }
  };

  // 모두 랜덤 배정 함수 (기존 배정된 seat도 무시하고 모든 seat에 배정)
  const handleAllRandomAssign = (sectionName, allSeats) => {
    let availableJudges = [...judgesPoolArray]; // 사용 가능한 심판 배열 복사

    // 기존 배정된 심판을 모두 제거하고 새롭게 배정할 준비
    let updatedJudgesAssignInfo = judgesAssignInfo.judges.filter(
      (assign) => assign.sectionName !== sectionName
    );

    const sectionInfo = filteredBySection.find(
      (section) => section.sectionName === sectionName
    );

    if (sectionInfo) {
      const { sectionGrades } = sectionInfo;

      allSeats.forEach((seatNumber) => {
        if (availableJudges.length > 0) {
          const randomJudge = availableJudges.splice(
            Math.floor(Math.random() * availableJudges.length),
            1
          )[0]; // 랜덤 심판 선택 후 제거

          if (randomJudge) {
            assignJudgeToGrades(
              sectionGrades,
              randomJudge,
              seatNumber,
              sectionName,
              updatedJudgesAssignInfo,
              generateUUID,
              currentContest,
              setMessage,
              setMsgOpen
            );
          }
        }
      });

      // 새로운 배정으로 상태 업데이트
      setJudgesAssignInfo((prev) => ({
        ...prev,
        judges: updatedJudgesAssignInfo,
      }));
    }
  };

  // 초기화 함수 (해당 섹션의 모든 배정 삭제)
  const handleResetAssign = (sectionName) => {
    const clearedJudges = judgesAssignInfo.judges.filter(
      (assign) => assign.sectionName !== sectionName
    );
    setJudgesAssignInfo((prev) => ({
      ...prev,
      judges: clearedJudges,
    }));
  };

  // 배정 취소 함수 (해당 자리의 배정 취소)
  const handleRemoveAssign = (sectionName, seatIndex) => {
    const updatedJudges = judgesAssignInfo.judges.filter(
      (assign) =>
        !(assign.sectionName === sectionName && assign.seatIndex === seatIndex)
    );
    setJudgesAssignInfo((prev) => ({
      ...prev,
      judges: updatedJudges,
    }));
  };

  useEffect(() => {
    console.log(filteredBySection);
  }, [filteredBySection]);

  return (
    <div className="flex w-full flex-col bg-gray-100 rounded-lg gap-y-2">
      {filteredBySection.map((section, sectionIdx) => {
        const allSeats = Array.from(
          {
            length: section.sectionCategory[0]?.contestCategoryJudgeCount || 0,
          },
          (_, seatIdx) => seatIdx + 1
        );

        const unassignedSeats = allSeats.filter(
          (seatNumber) =>
            !judgesAssignInfo.judges.some(
              (assign) =>
                assign.sectionName === section.sectionName &&
                assign.seatIndex === seatNumber
            )
        );

        const assignedJudges = getAssignedJudgesForSection(section.sectionName);

        return (
          <div
            key={sectionIdx}
            className="flex w-full flex-col bg-blue-200 rounded-lg"
          >
            <div className="h-auto w-full flex items-center flex-col lg:flex-row">
              <div className="flex w-1/6 h-14 justify-start items-center pl-4">
                {section.sectionName}
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
                      handleRandomAssign(section.sectionName, unassignedSeats)
                    }
                  >
                    랜덤배정
                  </button>
                  {/* 모두 랜덤 배정 버튼 추가 */}
                  <button
                    className="ml-2 bg-yellow-500 text-white rounded px-2"
                    onClick={() =>
                      handleAllRandomAssign(section.sectionName, allSeats)
                    }
                  >
                    모두랜덤배정
                  </button>
                  {/* 초기화 버튼 추가 */}
                  <button
                    className="ml-2 bg-red-500 text-white rounded px-2"
                    onClick={() => handleResetAssign(section.sectionName)}
                  >
                    초기화
                  </button>
                </div>
                {allSeats.map((seatNumber) => {
                  const selectedJudge = judgesAssignInfo.judges.find(
                    (assign) =>
                      assign.sectionName === section.sectionName &&
                      assign.seatIndex === seatNumber
                  ) || { judgeUid: undefined };

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
                                section.sectionName,
                                seatNumber
                              );
                            } else {
                              handleSelectJudge(
                                section.sectionName,
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

export default SectionAssign;
