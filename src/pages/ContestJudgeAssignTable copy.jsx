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

const ContestJudgeAssignTable = () => {
  const [isLoading, setIsLoading] = useState(true);

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
      await updateJudgesAssign.updateData(assignId, assignData).then((data) =>
        setMessage({
          body: "저장되었습니다.",
          isButton: true,
          confirmButtonText: "확인",
        })
      );
    } catch (error) {
      console.log(error);
    }
  };

  const handleSelectJudge = async (
    judgePoolId,
    contestId,
    categoryId,
    seatIndex
  ) => {
    const matchedGrades = gradesArray.filter(
      (grade) => grade.refCategoryId === categoryId
    );

    if (judgePoolId === "unselect") {
      // TODO:기존에 배정된 심판의 내용을 삭제해야함
      const newJudgeAssignArray = [...judgesAssignArray];

      const filterArrayOtherCategory = newJudgeAssignArray.filter(
        (filter) => filter.categoryId !== categoryId
      );
      const filterArrayOtherSeatIndex = newJudgeAssignArray.filter(
        (filter) =>
          filter.categoryId === categoryId && filter.seatIndex !== seatIndex
      );

      const unionArray = [
        ...filterArrayOtherSeatIndex,
        ...filterArrayOtherCategory,
      ];
      setJudgesAssignInfo({ ...judgesAssignInfo, judges: [...unionArray] });
    } else {
      const judgeInfo = judgesPoolArray.find((pool) => pool.id === judgePoolId);
      const newJudgeAssignArray = [...judgesAssignArray];
      matchedGrades.map((matched, mIdx) => {
        const judgeAssignInfo = {
          ...judgeInfo,
          ...matched,
          contestId,
          categoryId,
          seatIndex,
        };
        newJudgeAssignArray.push({ ...judgeAssignInfo });
      });
      setJudgesAssignInfo(() => ({
        ...judgesAssignInfo,
        judges: [...newJudgeAssignArray],
      }));
      setJudgesAssignArray(() => [...newJudgeAssignArray]);
    }
  };
  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(
        currentContest.contests.id,
        currentContest.contests.contestJudgesAssignId,
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId
      );
    }
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
              <div className="flex w-full flex-col bg-gray-100 rounded-lg gap-y-2">
                {categoriesArray
                  .sort(
                    (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
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
                                  selectedJudgeInfo = { judgeUid: undefined };
                                }
                                //console.log("불러온값", selectedJudgeInfo);
                                return (
                                  <div className="flex bg-gray-100 w-full px-4 rounded-lg h-auto justify-start items-center ">
                                    <div className="flex w-1/6">{number}</div>
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
                                                {judgeName} ( {judgePromoter} /{" "}
                                                {judgeTel} )
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
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ContestJudgeAssignTable;
