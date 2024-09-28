import React, { useContext, useEffect, useState } from "react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { FaCrown, FaSleigh } from "react-icons/fa";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { useMemo } from "react";
import { generateUUID } from "../functions/functions";

const ContestJudgeAssignTable = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentSubTab, setCurrentSubTab] = useState("0");

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [judgesAssignInfo, setJudgesAssignInfo] = useState({});
  const [judgesAssignArray, setJudgesAssignArray] = useState([]);
  const [judgesPoolArray, setJudgesPoolArray] = useState([]);
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const { currentContest } = useContext(CurrentContestContext);

  const fetchJudgesAssign = useFirestoreGetDocument("contest_judges_assign");
  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchJudgesPoolQuery = useFirestoreQuery();

  const updateJudgesAssign = useFirestoreUpdateData("contest_judges_assign");
  const fetchPool = async (contestId, judgesAssignId, categoryId, gradeId) => {
    const condition = [where("contestId", "==", contestId)];

    try {
      const returnJudgesPoolQuery = await fetchJudgesPoolQuery.getDocuments(
        "contest_judges_pool",
        condition
      );
      const returnJudgesAssign = await fetchJudgesAssign.getDocument(
        judgesAssignId
      );
      const returnCategories = await fetchCategories.getDocument(categoryId);
      const returnGrades = await fetchGrades.getDocument(gradeId);

      setJudgesPoolArray([...returnJudgesPoolQuery]);
      setCategoriesArray([...returnCategories.categorys]);
      setGradesArray([...returnGrades.grades]);
      setJudgesAssignInfo({ ...returnJudgesAssign });
      setJudgesAssignArray([...returnJudgesAssign.judges]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateJudgesAssign = async (assignId, assignData) => {
    console.log(assignData);
    try {
      setMessage({ body: "저장중...", isButton: false });
      setMsgOpen(true);
      await updateJudgesAssign.updateData(assignId, assignData).then((data) => {
        console.log(data);
        setMessage({
          body: "저장되었습니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleDeleteAssign = (originArr, gradesArray, propSeatIndex) => {
    const newArrs = [...originArr];
    if (gradesArray.length > 0) {
      gradesArray.map((grade, gIdx) => {
        const filterArrs = newArrs.filter(
          (f) =>
            f.contestGradeId === grade.contestGradeId &&
            f.seatIndex === propSeatIndex
        );
        //중복데이터가 있는지 체크했어 있다면 전부 삭제
        if (filterArrs?.length > 0) {
          filterArrs.map((fArr, fIdx) => {
            const findIdx = newArrs.findIndex(
              (f) => f.judgesAssignId === fArr.judgesAssignId
            );
            newArrs.splice(findIdx, 1);
          });
        }
      });
    }
    console.log([...newArrs]);
    return [...newArrs];
  };

  const handleAddAssign = (arrs, gradesArray, propSeatIndex, propJudgeInfo) => {
    const newArrs = handleDeleteAssign(arrs, gradesArray, propSeatIndex);

    if (gradesArray.length > 0) {
      gradesArray.map((grade, gIdx) => {
        const newInfo = {
          ...grade,
          judgeName: propJudgeInfo.judgeName,
          judgeUid: propJudgeInfo.judgeUid,
          onedayPassword: propJudgeInfo.onedayPassword,
          isHead: propJudgeInfo.isHead,
          seatIndex: propSeatIndex,
          categoryId: grade.refCategoryId,
          judgesAssignId: generateUUID(),
          contestId: currentContest.contests.id,
        };
        newArrs.push({ ...newInfo });
      });
    }
    return newArrs;
  };
  const handleSelectJudge = async (
    actionType,
    actionId,
    seatIndex,
    judgeUid
  ) => {
    const newJudgesAssigninfo = { ...judgesAssignInfo };
    const addJudgeInfo = judgesPoolArray.find((f) => f.judgeUid === judgeUid);

    switch (actionType) {
      case "section":
        if (filteredBySection?.length > 0) {
          const grades = filteredBySection.find(
            (f) => f.sectionName === actionId
          )?.sectionGrades;
          const newAssign = handleAddAssign(
            newJudgesAssigninfo.judges,
            grades,
            seatIndex,
            addJudgeInfo
          );
          console.log(newAssign);
          setJudgesAssignInfo({
            ...judgesAssignInfo,
            judges: [...newAssign],
          });
        }

        break;

      default:
        break;
    }
  };

  const filteredBySection = useMemo(() => {
    const groupedBySection = categoriesArray.reduce((acc, curr) => {
      const sectionIndex = acc.findIndex(
        (item) => item.sectionName === curr.contestCategorySection
      );

      const matchingGrades = gradesArray
        .filter((grade) => grade.refCategoryId === curr.contestCategoryId)
        .map((grade) => ({
          ...grade,
          sectionName: curr.contestCategorySection,
        }));

      if (sectionIndex === -1) {
        acc.push({
          sectionName: curr.contestCategorySection,
          sectionCategory: [curr],
          sectionGrades: matchingGrades,
        });
      } else {
        acc[sectionIndex].sectionCategory.push(curr);
        acc[sectionIndex].sectionGrades.push(...matchingGrades);
      }

      return acc;
    }, []);

    return groupedBySection;
  }, [currentSubTab, categoriesArray, gradesArray]);

  useEffect(() => {
    console.log(filteredBySection);
  }, [filteredBySection]);

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(
        currentContest.contests.id,
        currentContest.contests.contestJudgesAssignId,
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId
      );
    }
    setCurrentSubTab("0");
  }, [currentContest?.contests?.id]);

  useEffect(() => {
    console.log(judgesAssignInfo);
  }, [judgesAssignInfo]);

  return (
    <div className="flex flex-col lg:flex-row gap-y-2 w-full h-auto bg-white mb-3 rounded-t-lg rounded-b-lg p-2 gap-x-4">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
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
              <button
                onClick={() => setCurrentSubTab("0")}
                className={`${
                  currentSubTab === "0"
                    ? "w-40 h-10 bg-blue-500 text-gray-100 rounded-t-lg"
                    : "w-40 h-10 bg-white text-gray-700 rounded-t-lg border-t border-r"
                }`}
              >
                섹션별
              </button>
              <button
                onClick={() => setCurrentSubTab("1")}
                className={`${
                  currentSubTab === "1"
                    ? "w-40 h-10 bg-blue-500 text-gray-100 rounded-t-lg"
                    : "w-40 h-10 bg-white text-gray-700 rounded-t-lg border-t border-r"
                }`}
              >
                종목별
              </button>
              <button
                onClick={() => setCurrentSubTab("2")}
                className={`${
                  currentSubTab === "2"
                    ? "w-40 h-10 bg-blue-500 text-gray-100 rounded-t-lg"
                    : "w-40 h-10 bg-white text-gray-700 rounded-t-lg border-t border-r"
                }`}
              >
                체급별
              </button>
            </div>
            <div className="flex bg-gray-100 h-auto rounded-lg justify-start categoryIdart lg:items-center gay-y-2 flex-col p-0 lg:p-0 gap-y-2">
              <div className="flex w-full justify-start items-center">
                <button
                  className="w-full h-12 bg-gradient-to-r from-blue-300 to-cyan-200 rounded-lg"
                  onClick={() =>
                    handleUpdateJudgesAssign(
                      judgesAssignInfo.id,
                      judgesAssignInfo
                    )
                  }
                >
                  저장
                </button>
              </div>
              {currentSubTab === "0" && (
                <>
                  <div className="flex w-full flex-col bg-gray-100 rounded-lg gap-y-2">
                    {filteredBySection?.length > 0 &&
                      filteredBySection.map((section, cIdx) => {
                        const { sectionName, setctionGrades, sectionCategory } =
                          section;

                        console.log(
                          sectionCategory[0].contestCategoryJudgeCount
                        );
                        const judgeCount =
                          sectionCategory[0].contestCategoryJudgeCount;

                        return (
                          <div className="flex w-full flex-col bg-blue-200 rounded-lg">
                            <div className="h-auto w-full flex items-center flex-col lg:flex-row">
                              <div className="flex w-full h-auto justify-start items-center">
                                <div className="w-1/6 h-14 flex justify-start items-center pl-4">
                                  {sectionName}
                                </div>
                                <div className="w-4/6 h-14 flex justify-start items-center"></div>
                              </div>
                            </div>
                            <div className="flex p-2">
                              <div className="flex bg-gray-100 w-full gap-2 p-2 rounded-lg h-auto justify-start items-center flex-col">
                                <div className="flex w-full bg-white rounded-lg p-2">
                                  <div className="flex w-1/6">좌석</div>
                                  <div className="flex w-5/6">선택</div>
                                </div>
                                {judgeCount > 0 &&
                                  Array.from(
                                    { length: judgeCount },
                                    (_, jIdx) => jIdx + 1
                                  ).map((number) => {
                                    // const { judgeName, judgeTel, judgePromoter } =
                                    //   judgeAssignTable.find(
                                    //     (assign) =>
                                    //       assign.categoryId === categoryId &&
                                    //       assign.seatIndex === number
                                    //   );
                                    let selectedJudgeInfo = {};
                                    const findAssignIndex =
                                      judgesAssignArray.findIndex(
                                        (assign) =>
                                          assign.sectionName === sectionName &&
                                          assign.seatIndex === number
                                      );
                                    if (findAssignIndex != -1) {
                                      selectedJudgeInfo = {
                                        ...judgesAssignArray.find(
                                          (assign) =>
                                            assign.sectionName ===
                                              sectionName &&
                                            assign.seatIndex === number
                                        ),
                                      };
                                    } else {
                                      selectedJudgeInfo = {
                                        judgeUid: undefined,
                                      };
                                    }
                                    //console.log("불러온값", selectedJudgeInfo);
                                    return (
                                      <div className="flex bg-gray-100 w-full px-4 rounded-lg h-auto justify-start items-center ">
                                        <div className="flex w-1/6">
                                          {number}
                                        </div>
                                        <div className="flex w-5/6">
                                          <select
                                            name="categoryJudgeSelect"
                                            className="w-full text-sm"
                                            onChange={(e) =>
                                              handleSelectJudge(
                                                "section",
                                                sectionName,
                                                number,
                                                e.target.value
                                              )
                                            }
                                          >
                                            <option
                                              value="unselect"
                                              selected={
                                                selectedJudgeInfo.judgeUid ===
                                                undefined
                                              }
                                            >
                                              선택
                                            </option>
                                            {judgesPoolArray
                                              .sort((a, b) =>
                                                a.judgeName.localeCompare(
                                                  b.judgeName
                                                )
                                              )
                                              .map((judge, jIdx) => {
                                                const {
                                                  id,
                                                  judgeName,
                                                  judgeTel,
                                                  judgePromoter,
                                                  judgeUid,
                                                  isHead,
                                                } = judge;

                                                return (
                                                  <option
                                                    value={judgeUid}
                                                    className="text-sm"
                                                    selected={
                                                      selectedJudgeInfo.judgeUid ===
                                                      judgeUid
                                                    }
                                                  >
                                                    {isHead && "위원장 / "}
                                                    {judgeName} ({" "}
                                                    {judgePromoter} / {judgeTel}{" "}
                                                    )
                                                  </option>
                                                );
                                              })}
                                          </select>
                                        </div>
                                        <div className="flex w-3/6"></div>
                                        <div className="hidden lg:flex lg:w-3/6"></div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
              {currentSubTab === "1" && (
                <>
                  <div className="flex w-full flex-col bg-gray-100 rounded-lg gap-y-2">
                    {categoriesArray
                      .sort(
                        (a, b) =>
                          a.contestCategoryIndex - b.contestCategoryIndex
                      )
                      .map((category, cIdx) => {
                        const {
                          contestCategoryId: categoryId,
                          contestCategoryIndex: categoryIndex,
                          contestCategoryTitle: categoryTitle,
                          contestCategoryJudgeCount: judgeCount,
                        } = category;

                        const matchedGrades = gradesArray
                          .filter((grade) => grade.refCategoryId === categoryId)
                          .sort(
                            (a, b) => a.contestGradeIndex - b.contestGradeIndex
                          );
                        return (
                          <div className="flex w-full flex-col bg-blue-200 rounded-lg">
                            <div className="h-auto w-full flex items-center flex-col lg:flex-row">
                              <div className="flex w-full h-auto justify-start items-center">
                                <div className="w-1/6 h-14 flex justify-start items-center pl-4">
                                  {categoryIndex}
                                </div>
                                <div className="w-4/6 h-14 flex justify-start items-center">
                                  {categoryTitle}
                                  {judgeCount && `(${judgeCount}심제)`}
                                </div>
                              </div>
                            </div>
                            <div className="flex p-2">
                              <div className="flex bg-gray-100 w-full gap-2 p-2 rounded-lg h-auto justify-start items-center flex-col">
                                <div className="flex w-full bg-white rounded-lg p-2">
                                  <div className="flex w-1/6">좌석</div>
                                  <div className="flex w-5/6">선택</div>
                                </div>
                                {judgeCount > 0 &&
                                  Array.from(
                                    { length: judgeCount },
                                    (_, jIdx) => jIdx + 1
                                  ).map((number) => {
                                    // const { judgeName, judgeTel, judgePromoter } =
                                    //   judgeAssignTable.find(
                                    //     (assign) =>
                                    //       assign.categoryId === categoryId &&
                                    //       assign.seatIndex === number
                                    //   );
                                    let selectedJudgeInfo = {};
                                    const findAssignIndex =
                                      judgesAssignArray.findIndex(
                                        (assign) =>
                                          assign.categoryId === categoryId &&
                                          assign.seatIndex === number
                                      );
                                    if (findAssignIndex != -1) {
                                      selectedJudgeInfo = {
                                        ...judgesAssignArray.find(
                                          (assign) =>
                                            assign.categoryId === categoryId &&
                                            assign.seatIndex === number
                                        ),
                                      };
                                    } else {
                                      selectedJudgeInfo = {
                                        judgeUid: undefined,
                                      };
                                    }
                                    //console.log("불러온값", selectedJudgeInfo);
                                    return (
                                      <div className="flex bg-gray-100 w-full px-4 rounded-lg h-auto justify-start items-center ">
                                        <div className="flex w-1/6">
                                          {number}
                                        </div>
                                        <div className="flex w-5/6">
                                          <select
                                            name="categoryJudgeSelect"
                                            className="w-full text-sm"
                                            onChange={(e) =>
                                              handleSelectJudge(
                                                e.target.value,
                                                currentContest.contests.id,
                                                categoryId,
                                                number
                                              )
                                            }
                                          >
                                            <option
                                              value="unselect"
                                              selected={
                                                selectedJudgeInfo.judgeUid ===
                                                undefined
                                              }
                                            >
                                              선택
                                            </option>
                                            {judgesPoolArray
                                              .sort((a, b) =>
                                                a.judgeName.localeCompare(
                                                  b.judgeName
                                                )
                                              )
                                              .map((judge, jIdx) => {
                                                const {
                                                  id,
                                                  judgeName,
                                                  judgeTel,
                                                  judgePromoter,
                                                  judgeUid,
                                                  isHead,
                                                } = judge;

                                                return (
                                                  <option
                                                    value={id}
                                                    className="text-sm"
                                                    selected={
                                                      selectedJudgeInfo.judgeUid ===
                                                      judgeUid
                                                    }
                                                  >
                                                    {isHead && "위원장 / "}
                                                    {judgeName} ({" "}
                                                    {judgePromoter} / {judgeTel}{" "}
                                                    )
                                                  </option>
                                                );
                                              })}
                                          </select>
                                        </div>
                                        <div className="flex w-3/6"></div>
                                        <div className="hidden lg:flex lg:w-3/6"></div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ContestJudgeAssignTable;
