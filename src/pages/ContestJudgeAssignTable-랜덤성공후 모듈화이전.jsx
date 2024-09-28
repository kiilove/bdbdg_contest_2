import React, { useContext, useEffect, useState, useMemo } from "react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateUUID } from "../functions/functions";

const ContestJudgeAssignTable = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentSubTab, setCurrentSubTab] = useState("0");
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});
  const [judgesAssignInfo, setJudgesAssignInfo] = useState({});
  const [judgesPoolArray, setJudgesPoolArray] = useState([]);
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);

  const { currentContest } = useContext(CurrentContestContext);
  const fetchJudgesAssign = useFirestoreGetDocument("contest_judges_assign");
  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchJudgesPoolQuery = useFirestoreQuery();
  const updateJudgesAssign = useFirestoreUpdateData("contest_judges_assign");

  // 데이터 가져오기 함수
  const fetchPool = async (contestId) => {
    try {
      const [judgesPool, judgesAssign, categories, grades] = await Promise.all([
        fetchJudgesPoolQuery.getDocuments("contest_judges_pool", [
          where("contestId", "==", contestId),
        ]),
        fetchJudgesAssign.getDocument(
          currentContest.contests.contestJudgesAssignId
        ),
        fetchCategories.getDocument(
          currentContest.contests.contestCategorysListId
        ),
        fetchGrades.getDocument(currentContest.contests.contestGradesListId),
      ]);

      setJudgesPoolArray(judgesPool);
      setJudgesAssignInfo(judgesAssign);
      setCategoriesArray(categories.categorys);
      setGradesArray(grades.grades);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // 심사위원 할당 업데이트 함수
  const handleUpdateJudgesAssign = async () => {
    try {
      setMessage({ body: "저장중...", isButton: false });
      setMsgOpen(true);
      await updateJudgesAssign.updateData(
        judgesAssignInfo.id,
        judgesAssignInfo
      );
      setMessage({
        body: "저장되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
    } catch (error) {
      console.log(error);
    }
  };

  // 심사위원 할당 및 삭제 처리 함수
  const updateAssignArray = (
    originArr,
    seatIndex,
    grades,
    judgeInfo,
    isAdding,
    sectionName // sectionName을 추가로 받음
  ) => {
    // 기존 할당된 배열에서 동일한 gradeId와 seatIndex를 가진 항목을 제거
    const updatedArr = originArr.filter(
      (assign) =>
        !grades.some(
          (grade) =>
            assign.contestGradeId === grade.contestGradeId &&
            assign.seatIndex === seatIndex
        )
    );

    // isAdding이 true인 경우 새 심사위원을 추가
    if (isAdding) {
      grades.forEach((grade) => {
        updatedArr.push({
          ...grade,
          judgeName: judgeInfo.judgeName,
          judgeUid: judgeInfo.judgeUid,
          onedayPassword: judgeInfo.onedayPassword,
          isHead: judgeInfo.isHead,
          seatIndex,
          categoryId: grade.refCategoryId,
          judgesAssignId: generateUUID(),
          contestId: currentContest.contests.id,
          sectionName: sectionName, // sectionName을 추가
        });
      });
    }

    return updatedArr;
  };

  // 심사위원 선택 핸들러
  const handleSelectJudge = (sectionName, seatIndex, judgeUid) => {
    console.log("선택한 심사위원 UID:", judgeUid);

    // 선택한 심사위원 정보 가져오기
    const selectedJudge = judgesPoolArray.find(
      (judge) => judge.judgeUid === judgeUid
    );
    console.log("선택한 심사위원 정보:", selectedJudge);

    // 선택한 섹션에서 해당 좌석의 등급 정보 가져오기
    const sectionGrades = filteredBySection.find(
      (section) => section.sectionName === sectionName
    )?.sectionGrades;
    console.log("선택된 섹션 정보:", sectionGrades);

    if (sectionGrades && selectedJudge) {
      // 기존 할당 배열에서 선택된 좌석의 심사위원 정보 업데이트
      const newAssignArray = updateAssignArray(
        judgesAssignInfo.judges,
        seatIndex,
        sectionGrades,
        selectedJudge,
        true,
        sectionName
      );

      console.log("업데이트된 할당 배열:", newAssignArray);

      // 업데이트된 할당 배열을 상태에 저장
      setJudgesAssignInfo((prev) => ({ ...prev, judges: newAssignArray }));
      console.log("상태 업데이트 완료 후의 judgesAssignInfo:", newAssignArray);
    }
  };

  // 해당 섹션에서 이미 배정된 심판의 judgeUid를 반환하는 함수
  const getAssignedJudgesForSection = (sectionName) => {
    return judgesAssignInfo.judges
      .filter((assign) => assign.sectionName === sectionName)
      .map((assign) => assign.judgeUid);
  };

  // 상태가 제대로 반영되었는지 확인하기 위한 useEffect 추가
  useEffect(() => {
    console.log("judgesAssignInfo 상태가 변경됨:", judgesAssignInfo);
  }, [judgesAssignInfo]);

  // 섹션별 필터링
  const filteredBySection = useMemo(() => {
    return categoriesArray.reduce((acc, curr) => {
      const section = acc.find(
        (item) => item.sectionName === curr.contestCategorySection
      );
      const matchingGrades = gradesArray.filter(
        (grade) => grade.refCategoryId === curr.contestCategoryId
      );

      if (!section) {
        acc.push({
          sectionName: curr.contestCategorySection,
          sectionCategory: [curr],
          sectionGrades: matchingGrades,
        });
      } else {
        section.sectionCategory.push(curr);
        section.sectionGrades.push(...matchingGrades);
      }

      return acc;
    }, []);
  }, [categoriesArray, gradesArray]);

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(currentContest.contests.id);
    }
    setCurrentSubTab("0");
  }, [currentContest]);

  return (
    <div className="flex flex-col lg:flex-row gap-y-2 w-full h-auto bg-white mb-3 rounded-t-lg rounded-b-lg p-2 gap-x-4">
      {isLoading ? (
        <LoadingPage />
      ) : (
        <>
          <div className="w-full bg-gray-100 flex rounded-lg flex-col p-2 h-full gap-y-2">
            <ConfirmationModal
              isOpen={msgOpen}
              message={message}
              onCancel={() => setMsgOpen(false)}
              onConfirm={() => setMsgOpen(false)}
            />
            <div className="flex w-full h-auto justify-start items-center">
              {["섹션별", "종목별", "체급별"].map((label, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSubTab(idx.toString())}
                  className={`w-40 h-10 ${
                    currentSubTab === idx.toString()
                      ? "bg-blue-500 text-gray-100"
                      : "bg-white text-gray-700 border-t border-r"
                  } rounded-t-lg`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex bg-gray-100 h-auto rounded-lg justify-start items-center flex-col gap-y-2">
              <button
                className="w-full h-12 bg-gradient-to-r from-blue-300 to-cyan-200 rounded-lg"
                onClick={handleUpdateJudgesAssign}
              >
                저장
              </button>

              {currentSubTab === "0" && filteredBySection.length > 0 && (
                <div className="flex w-full flex-col bg-gray-100 rounded-lg gap-y-2">
                  {filteredBySection.map((section, sectionIdx) => {
                    const assignedJudges = getAssignedJudgesForSection(
                      section.sectionName
                    ); // 이미 배정된 심판 목록 가져오기

                    const allSeats = Array.from(
                      {
                        length:
                          section.sectionCategory[0]
                            ?.contestCategoryJudgeCount || 0,
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

                    // 1. 랜덤 배정 함수 (비어있는 seat에만 배정)
                    const handleRandomAssign = (
                      sectionName,
                      unassignedSeats
                    ) => {
                      const availableJudges = judgesPoolArray.filter(
                        (judge) =>
                          !getAssignedJudgesForSection(sectionName).includes(
                            judge.judgeUid
                          )
                      );

                      let updatedJudgesAssignInfo = [
                        ...judgesAssignInfo.judges,
                      ];

                      if (
                        unassignedSeats.length > 0 &&
                        availableJudges.length > 0
                      ) {
                        unassignedSeats.forEach((seatNumber) => {
                          const randomJudge =
                            availableJudges[
                              Math.floor(Math.random() * availableJudges.length)
                            ];

                          if (randomJudge) {
                            updatedJudgesAssignInfo.push({
                              sectionName,
                              seatIndex: seatNumber,
                              judgeName: randomJudge.judgeName,
                              judgeUid: randomJudge.judgeUid,
                              judgesAssignId: generateUUID(),
                              contestId: currentContest.contests.id,
                            });

                            // 배정된 심판을 availableJudges에서 제거
                            availableJudges.splice(
                              availableJudges.indexOf(randomJudge),
                              1
                            );
                          }
                        });

                        setJudgesAssignInfo((prev) => ({
                          ...prev,
                          judges: updatedJudgesAssignInfo,
                        }));
                      }
                    };

                    // 2. 모두 랜덤 배정 함수 (기존 배정된 seat도 무시하고 모든 seat에 배정)
                    const handleAllRandomAssign = (sectionName, allSeats) => {
                      let availableJudges = [...judgesPoolArray]; // 사용 가능한 심판 배열 복사

                      // 기존 배정된 심판을 모두 제거하고 새롭게 배정할 준비
                      let updatedJudgesAssignInfo =
                        judgesAssignInfo.judges.filter(
                          (assign) => assign.sectionName !== sectionName
                        );

                      allSeats.forEach((seatNumber) => {
                        if (availableJudges.length > 0) {
                          const randomJudge = availableJudges.splice(
                            Math.floor(Math.random() * availableJudges.length),
                            1
                          )[0]; // 랜덤 심판 선택 후 제거

                          updatedJudgesAssignInfo.push({
                            sectionName,
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

                    // 3. 초기화 함수 (해당 섹션의 모든 배정 삭제)
                    const handleResetAssign = () => {
                      const clearedJudges = judgesAssignInfo.judges.filter(
                        (assign) => assign.sectionName !== section.sectionName
                      );
                      setJudgesAssignInfo((prev) => ({
                        ...prev,
                        judges: clearedJudges,
                      }));
                    };

                    // 4. 배정 취소 기능 (해당 자리의 배정 취소)
                    const handleRemoveAssign = (sectionName, seatIndex) => {
                      const updatedJudges = judgesAssignInfo.judges.filter(
                        (assign) =>
                          !(
                            assign.sectionName === sectionName &&
                            assign.seatIndex === seatIndex
                          )
                      );
                      setJudgesAssignInfo((prev) => ({
                        ...prev,
                        judges: updatedJudges,
                      }));
                    };

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
                              {/* 버튼 추가 */}
                              <button
                                className="ml-2 bg-green-500 text-white rounded px-2"
                                onClick={() =>
                                  handleRandomAssign(
                                    section.sectionName,
                                    unassignedSeats
                                  )
                                }
                              >
                                랜덤배정
                              </button>
                              <button
                                className="ml-2 bg-yellow-500 text-white rounded px-2"
                                onClick={() =>
                                  handleAllRandomAssign(
                                    section.sectionName,
                                    allSeats
                                  )
                                }
                              >
                                모두랜덤배정
                              </button>
                              <button
                                className="ml-2 bg-red-500 text-white rounded px-2"
                                onClick={handleResetAssign}
                              >
                                초기화
                              </button>
                            </div>
                            {allSeats.map((seatNumber) => {
                              const selectedJudge =
                                judgesAssignInfo.judges.find(
                                  (assign) =>
                                    assign.sectionName ===
                                      section.sectionName &&
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
                                      value={
                                        selectedJudge.judgeUid || "unselect"
                                      }
                                      onChange={(e) => {
                                        const newJudgeUid = e.target.value;
                                        if (newJudgeUid === "unselect") {
                                          // 배정 취소
                                          handleRemoveAssign(
                                            section.sectionName,
                                            seatNumber
                                          );
                                        } else {
                                          // 배정 변경 (즉시 변경)
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
                                            !assignedJudges.includes(
                                              judge.judgeUid
                                            ) ||
                                            judge.judgeUid ===
                                              selectedJudge.judgeUid
                                        )
                                        .map((judge) => (
                                          <option
                                            key={judge.judgeUid}
                                            value={judge.judgeUid}
                                          >
                                            {judge.isHead && "위원장 / "}
                                            {judge.judgeName} (
                                            {judge.judgePromoter} /{" "}
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
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ContestJudgeAssignTable;
