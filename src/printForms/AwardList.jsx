import React from "react";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import LoadingPage from "../pages/LoadingPage";
import { useState } from "react";
import { TbCertificate } from "react-icons/tb";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useContext } from "react";
import { useEffect } from "react";
import { where } from "firebase/firestore";
import { handleCategoriesWithGrades } from "../functions/functions";
import { useMemo } from "react";
import PrintAwardForm from "./PrintAwardForm";
import ReactToPrint from "react-to-print";
import { useRef } from "react";

const AwardList = () => {
  const [isLoading, setIsLoading] = useState(false);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});
  const [categoriesArray, setCategoriesArray] = useState([]);

  const [gradesArray, setGradesArray] = useState([]);
  const [categoryTable, setCategoryTable] = useState([]);
  const [awardsArray, setAwardsArray] = useState([]);
  const [currentAwardInfo, setCurrentAwardInfo] = useState({});
  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchQuery = useFirestoreQuery();
  const { currentContest } = useContext(CurrentContestContext);
  const printRef = useRef();

  const fetchPool = async (categoriesListId, gradesListId) => {
    const contestId = currentContest.contests.id;
    const condition = [where("contestId", "==", contestId)];
    if (categoriesListId === undefined || gradesListId === undefined) {
      setMessage({
        body: "데이터를 불러오는데 문제가 발생했습니다.",
        body2: "시스템 관리자에게 연락하세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
    }

    try {
      await fetchCategoryDocument.getDocument(categoriesListId).then((data) => {
        setCategoriesArray(() => [...data.categorys]);
      });
      await fetchGradeDocument.getDocument(gradesListId).then((data) => {
        setGradesArray(() => [...data.grades]);
      });
      await fetchQuery
        .getDocuments("contest_award_list", condition)
        .then((data) => {
          console.log(data);
          setAwardsArray(() => [...data]);
        });
    } catch (error) {
      console.log(error);
    }
  };

  const handleUpdateCurrentAward = (currentInfo, e, actionType) => {
    const { name, value } = e.target;
    let newCurrentInfo = {};
    if (name === "playerGymFontSize" || name === "categoryFontSize") {
      let newValue = value.slice(0, -2); // 마지막 2글자를 제외한 값 추출
      newValue = parseInt(newValue);
      console.log(newValue);

      if (actionType === "plus") {
        newValue += 1;
      } else {
        newValue -= 1;
      }

      newCurrentInfo = { ...currentInfo, [name]: `${newValue}px` };
    } else {
      newCurrentInfo = { ...currentInfo, [name]: value };
    }
    console.log(newCurrentInfo);
    setCurrentAwardInfo(() => ({ ...newCurrentInfo })); // 수정: [] 불필요, newResult로 대체
  };

  const findAwardCategory = (categoryData = [], awardData = []) => {
    let dummy = [];
    categoryData
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .map((category, cIdx) => {
        const { contestCategoryId, contestCategoryTitle, grades } = category;
        grades
          .sort((a, b) => a.gradeIndex - b.gradeIndex)
          .map((grade, gIdx) => {
            const { contestGradeId, contestGradeTitle } = grade;
            const findAward = awardData.filter(
              (f) => f.gradeId === contestGradeId
            );

            if (findAward?.length > 0) {
              const newData = {
                contestCategoryTitle,
                contestCategoryId,
                contestGradeId,
                contestGradeTitle,
                awards: [...findAward],
              };

              dummy.push({ ...newData });
            }
          });
      });

    return dummy;
  };

  const filtedAwardList = useMemo(() => {
    const awards = findAwardCategory(categoryTable, awardsArray);
    return awards;
  }, [categoryTable, awardsArray]);

  useEffect(() => {
    if (!currentContest?.contests) {
      return;
    }
    fetchPool(
      currentContest.contests.contestCategorysListId,
      currentContest.contests.contestGradesListId
    );
  }, [currentContest?.contests]);

  useEffect(() => {
    if (categoriesArray?.length > 0 && gradesArray?.length > 0) {
      setCategoryTable(() => [
        ...handleCategoriesWithGrades(categoriesArray, gradesArray),
      ]);
    }
  }, [categoriesArray, gradesArray]);

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-3 gap-y-2">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <div>
          <div className="flex w-full h-14">
            <ConfirmationModal
              isOpen={msgOpen}
              onConfirm={() => setMsgOpen(false)}
              onCancel={() => setMsgOpen(false)}
              message={message}
            />
            <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
              <div className="flex w-2/3">
                <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
                  <TbCertificate />
                </span>
                <h1
                  className="font-sans text-lg font-semibold"
                  style={{ letterSpacing: "2px" }}
                >
                  상장출력
                </h1>
              </div>
            </div>
          </div>
          <div className="flex w-full">
            <div className="flex w-1/5 flex-col">
              {filtedAwardList?.length > 0 &&
                filtedAwardList.map((award, aIdx) => {
                  console.log(award);
                  const {
                    contestCategoryTitle,
                    contestCategoryId,
                    contestGradeId,
                    contestGradeTitle,
                    awards,
                  } = award;

                  return (
                    <div className="flex w-full h-auto flex-col p-2 justify-start items-center">
                      <div className="flex w-full h-auto bg-blue-500 justify-center items-center text-gray-100 rounded-lg flex-col p-2">
                        <div className="flex w-full justify-center items-center">
                          {contestCategoryTitle}({contestGradeTitle})
                        </div>
                        <div className="flex w-full flex-col h-auto bg-white rounded-lg ">
                          {awards?.length > 0 &&
                            awards
                              .sort((a, b) => a.playerRank - b.playerRank)
                              .map((item, idx) => {
                                const {
                                  playerName,
                                  playerNumber,
                                  awardNumber,
                                  categoryTitle1,
                                  categoryTitle2,
                                  categoryFontSize,
                                  gradeTitle,
                                  playerRank,
                                  playerGym1,
                                  playerGym2,
                                  playerGymFontSize,
                                } = item;
                                return (
                                  <button
                                    className="flex w-full h-auto justify-start items-center text-gray-800 px-5 py-2"
                                    onClick={() => {
                                      setCurrentAwardInfo(() => ({
                                        playerName,
                                        awardNumber,
                                        categoryTitle1,
                                        categoryTitle2,
                                        categoryFontSize,
                                        gradeTitle,
                                        playerRank,
                                        playerGym1,
                                        playerGym2,
                                        playerGymFontSize,
                                        awardIndex: idx,
                                      }));
                                    }}
                                  >
                                    <div className="flex justify-start items-center mr-2">
                                      {playerRank}위
                                    </div>
                                    <div className="flex justify-start items-center">
                                      {playerNumber}.
                                    </div>
                                    <div className="flex justify-start items-center">
                                      {playerName}
                                    </div>
                                  </button>
                                );
                              })}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="flex w-4/5">
              <div className="flex bg-gray-100 w-full h-full overflow-auto flex-col justify-between items-center mb-5">
                <div
                  className="flex justify-center items-start gap-x-1"
                  style={{ width: "210mm" }}
                >
                  <div className="flex w-32 flex-col bg-white">
                    <div className="flex bg-gray-400 h-6 w-full justify-center">
                      종목폰트크기
                    </div>
                    <div className="flex w-full justify-center h-14">
                      <div className="flex">
                        <button
                          className="bg-gray-200 w-10 h-full"
                          name="categoryFontSize"
                          value={currentAwardInfo.categoryFontSize}
                          onClick={(e) =>
                            handleUpdateCurrentAward(
                              currentAwardInfo,
                              e,
                              "minus"
                            )
                          }
                        >
                          ㅡ
                        </button>
                      </div>
                      <div className="flex w-full justify-center items-center text-lg">
                        {currentAwardInfo.categoryFontSize}
                      </div>
                      <div className="flex">
                        <button
                          className="bg-gray-200 w-10 h-full"
                          name="categoryFontSize"
                          value={currentAwardInfo.categoryFontSize}
                          onClick={(e) =>
                            handleUpdateCurrentAward(
                              currentAwardInfo,
                              e,
                              "plus"
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-40 flex-col  gap-y-1 bg-white">
                    <div className="flex bg-gray-400 h-6 w-full justify-center">
                      종목 줄바꿈
                    </div>
                    <div className="flex gap-y-1 flex-col justify-center items-center">
                      <div className="flex w-full justify-center items-center h-auto">
                        <input
                          type="text"
                          name="categoryTitle1"
                          value={currentAwardInfo.categoryTitle1}
                          onChange={(e) =>
                            handleUpdateCurrentAward(currentAwardInfo, e)
                          }
                          className="w-32 h-6 bg-gray-100"
                        />
                      </div>
                      <div className="flex w-full justify-center items-center h-auto">
                        <input
                          type="text"
                          name="categoryTitle2"
                          value={currentAwardInfo.categoryTitle2}
                          onChange={(e) =>
                            handleUpdateCurrentAward(currentAwardInfo, e)
                          }
                          className="w-32 h-6 bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex w-32 flex-col bg-white">
                    <div className="flex bg-gray-400 h-6 w-full justify-center">
                      소속폰트크기
                    </div>
                    <div className="flex w-full justify-center h-14">
                      <div className="flex">
                        <button
                          className="bg-gray-200 w-10 h-full"
                          name="playerGymFontSize"
                          value={currentAwardInfo.playerGymFontSize}
                          onClick={(e) =>
                            handleUpdateCurrentAward(
                              currentAwardInfo,
                              e,
                              "minus"
                            )
                          }
                        >
                          ㅡ
                        </button>
                      </div>
                      <div className="flex w-full justify-center items-center text-lg">
                        {currentAwardInfo.playerGymFontSize}
                      </div>
                      <div className="flex">
                        <button
                          className="bg-gray-200 w-10 h-full"
                          name="playerGymFontSize"
                          value={currentAwardInfo.playerGymFontSize}
                          onClick={(e) =>
                            handleUpdateCurrentAward(
                              currentAwardInfo,
                              e,
                              "plus"
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-40 flex-col  gap-y-1 bg-white">
                    <div className="flex bg-gray-400 h-6 w-full justify-center">
                      소속 줄바꿈
                    </div>
                    <div className="flex gap-y-1 flex-col justify-center items-center">
                      <div className="flex w-full justify-center items-center h-auto">
                        <input
                          type="text"
                          name="playerGym1"
                          value={currentAwardInfo.playerGym1}
                          onChange={(e) =>
                            handleUpdateCurrentAward(currentAwardInfo, e)
                          }
                          className="w-32 h-6 bg-gray-100"
                        />
                      </div>
                      <div className="flex w-full justify-center items-center h-auto">
                        <input
                          type="text"
                          name="playerGym2"
                          value={currentAwardInfo.playerGym2}
                          onChange={(e) =>
                            handleUpdateCurrentAward(currentAwardInfo, e)
                          }
                          className="w-32 h-6 bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex">
                    <ReactToPrint
                      trigger={() => (
                        <button className="w-40 h-20 bg-blue-300 rounded-lg">
                          상장출력
                        </button>
                      )}
                      content={() => printRef.current}
                      pageStyle="@page { size: A4; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; box-shadow:none; } }"
                    />
                  </div>
                </div>
                <div
                  className="flex w-full justify-center items-start h-full"
                  ref={printRef}
                >
                  <PrintAwardForm
                    playerName={currentAwardInfo.playerName}
                    awardNumber={currentAwardInfo.awardNumber}
                    categoryTitle1={currentAwardInfo.categoryTitle1}
                    categoryTitle2={currentAwardInfo.categoryTitle2}
                    categoryFontSize={currentAwardInfo.categoryFontSize}
                    gradeTitle={currentAwardInfo.gradeTitle}
                    playerRank={currentAwardInfo.playerRank}
                    playerGym1={currentAwardInfo.playerGym1}
                    playerGym2={currentAwardInfo.playerGym2}
                    playerGymFontSize={currentAwardInfo.playerGymFontSize}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AwardList;
