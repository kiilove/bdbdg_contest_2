import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { HiUserGroup } from "react-icons/hi";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { where } from "firebase/firestore";

const PrintPlayerStanding = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({});
  const [msgOpen, setMsgOpen] = useState(false);
  const [currentCategoryId, setCurrentCategoryId] = useState("");
  const [currentGradeId, setCurrentGradeId] = useState("");
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [resultArray, setResultArray] = useState([]);
  const [noData, setNoData] = useState(false); // New state to handle no data scenario
  const printRef = useRef();
  const { currentContest } = useContext(CurrentContestContext);
  const fetchCategories = useFirestoreQuery();
  const fetchGrades = useFirestoreQuery();
  const fetchResults = useFirestoreQuery();

  // Function to fetch categories and grades
  const fetchCategoryAndGrades = async (contestId) => {
    const condition = [where("refContestId", "==", contestId)];
    const condition2 = [where("contestId", "==", contestId)];

    try {
      setIsLoading(true); // Start loading
      let sortedCategories;
      let sortedGrades;
      // Fetch and set categories
      await fetchCategories
        .getDocuments("contest_categorys_list", condition)
        .then((categoriesData) => {
          if (categoriesData[0]) {
            sortedCategories = categoriesData[0].categorys.sort(
              (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
            );
            setCategoriesArray(sortedCategories);
          }
        });

      // Fetch and set grades
      await fetchGrades
        .getDocuments("contest_grades_list", condition)
        .then((gradesData) => {
          if (gradesData[0]) {
            sortedGrades = gradesData[0].grades.sort(
              (a, b) => a.gradeIndex - b.gradeIndex
            );
            setGradesArray(sortedGrades);
          }
        });

      // Fetch results and modify them by adding category and grade indexes
      await fetchResults
        .getDocuments("contest_results_list", condition2)
        .then((resultsData) => {
          const updatedResults = resultsData.map((result) => {
            const matchingCategory = sortedCategories.find(
              (category) => category.contestCategoryId === result.categoryId
            );

            const matchingGrade = sortedGrades.find(
              (grade) => grade.contestGradeId === result.gradeId
            );

            return {
              ...result,
              contestCategoryIndex: matchingCategory
                ? matchingCategory.contestCategoryIndex
                : null,
              contestCategoryTitle: matchingCategory
                ? matchingCategory.contestCategoryTitle
                : null,
              contestGradeIndex: matchingGrade
                ? matchingGrade.contestGradeIndex
                : null,
            };
          });

          const groupedResults = updatedResults
            .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
            .reduce((acc, result) => {
              const { categoryId } = result;
              if (!acc[categoryId]) {
                acc[categoryId] = {
                  categoryId,
                  contestCategoryTitle: result.contestCategoryTitle,
                  contestCategoryIndex: result.contestCategoryIndex,
                  matchedGrades: [],
                };
              }

              acc[categoryId].matchedGrades.push(result);

              acc[categoryId].matchedGrades.sort(
                (a, b) => a.contestGradeIndex - b.contestGradeIndex
              );

              return acc;
            }, {});

          const finalGroupedResults = Object.values(groupedResults);
          console.log(finalGroupedResults);
          setResultArray(finalGroupedResults);
        });
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false); // End loading
    }
  };

  const findResults = useMemo(() => {
    let newResult = {};
    if (currentCategoryId && currentGradeId) {
      const filterCategory = resultArray.filter(
        (f) => f.categoryId === currentCategoryId
      );

      const filterResult = filterCategory[0].matchedGrades.filter(
        (g) => g.gradeId === currentGradeId
      );

      newResult = { ...filterResult };
    }
    return newResult;
  }, [currentCategoryId, currentGradeId]);

  useEffect(() => {
    console.log(findResults);
  }, [findResults]);

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchCategoryAndGrades(currentContest.contests.id);
    }
  }, [currentContest?.contests]);

  useEffect(() => {
    let timer;

    // Start 3-second timer
    if (isLoading) {
      timer = setTimeout(() => {
        if (resultArray.length === 0) {
          setNoData(true); // Show "No data available" message
        }
        setIsLoading(false); // Stop loading after 3 seconds
      }, 3000);
    }

    // Clear timer if resultArray is populated before 3 seconds
    if (resultArray.length > 0) {
      console.log(resultArray);
      clearTimeout(timer);
      setIsLoading(false); // Stop loading immediately
    }

    return () => clearTimeout(timer); // Cleanup the timer on unmount or rerender
  }, [resultArray, isLoading]);

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-2 gap-y-2">
      {isLoading && <LoadingPage />}
      {!isLoading && resultArray.length > 0 && (
        <>
          <div className="flex w-full h-14">
            <ConfirmationModal
              isOpen={msgOpen}
              message={message}
              onCancel={() => setMsgOpen(false)}
              onConfirm={() => setMsgOpen(false)}
            />
            <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
              <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
                <HiUserGroup />
              </span>
              <h1
                className="font-sans text-lg font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                순위표 출력
              </h1>
            </div>
          </div>

          <div className="flex w-full h-full justify-start  px-3 pt-3 flex-col bg-gray-100 rounded-lg">
            <div className="flex h-full w-full gap-x-2 bg-gray-100">
              <div className="flex flex-col w-full h-full bg-white rounded-b-lg p-2 gap-y-2">
                {/* Category and Grade Selection */}
                <div className="flex w-full justify-center px-5">
                  <select
                    value={currentCategoryId}
                    onChange={(e) => setCurrentCategoryId(e.target.value)}
                    className="w-48 h-10 border border-blue-500"
                  >
                    <option value="all">종목선택</option>
                    {resultArray.length > 0 &&
                      resultArray.map((category) => (
                        <option
                          key={category.categoryId}
                          value={category.categoryId}
                        >
                          {category?.contestCategoryTitle}
                        </option>
                      ))}
                  </select>
                  <select
                    value={currentGradeId}
                    onChange={(e) => setCurrentGradeId(e.target.value)}
                    className="w-48 h-10 border border-blue-500 ml-2"
                  >
                    <option value="all">체급선택</option>
                    {resultArray
                      .find((f) => f.categoryId === currentCategoryId)
                      ?.matchedGrades?.map((grade) => {
                        return (
                          <option key={grade.gradeId} value={grade.gradeId}>
                            {grade.gradeTitle}
                          </option>
                        );
                      })}
                  </select>
                </div>

                {/* Player Standings Display */}
                {findResults?.categoryTitle && (
                  <>
                    <div
                      className="flex w-full h-full p-5 flex-col gap-y-2"
                      ref={printRef}
                    >
                      <div className="flex w-full h-14 border border-r-2 border-b-2 border-black justify-center items-center">
                        <span
                          className="text-2xl font-semibold"
                          style={{ letterSpacing: "0px" }}
                        >
                          {findResults.categoryTitle +
                            " " +
                            findResults.gradeTitle}
                        </span>
                      </div>
                      <div className="flex w-full h-full justify-center items-center flex-col ">
                        <div className="flex w-full h-auto flex-col">
                          <div className="flex w-full h-10">
                            <div className="flex w-1/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                              <span>순위</span>
                            </div>

                            <div className="flex w-5/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                              <span>선수번호. 이름</span>
                            </div>
                            <div className="flex w-6/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                              <span>소속</span>
                            </div>
                          </div>
                        </div>
                        {findResults?.result?.length > 0 &&
                          findResults.result
                            .sort((a, b) => a.playerRank - b.playerRank)
                            .map((player) => {
                              const {
                                playerRank,
                                playerName,
                                playerNumber,
                                playerGym,
                              } = player;
                              return (
                                <div className="flex w-full h-10 last:border-b-2 border-black ">
                                  <div className="flex w-1/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                    <span>{playerRank}</span>
                                  </div>
                                  <div className="flex w-5/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                    <span>
                                      {playerNumber}. {playerName}
                                    </span>
                                  </div>
                                  <div className="flex w-6/12 justify-center items-center font-semibold border-b-0 border-black border-r border-t first:border-l">
                                    <span>{playerGym}</span>
                                  </div>
                                </div>
                              );
                            })}
                      </div>
                    </div>

                    {/* Print Button */}
                    <div className="flex w-full justify-end px-5">
                      <ReactToPrint
                        trigger={() => (
                          <button className="w-40 h-10 bg-blue-300 rounded-lg">
                            Print Standings
                          </button>
                        )}
                        content={() => printRef.current}
                        pageStyle={`
                       @page {
      size: A4;
      margin: 0;
      margin-top: 50px;
      margin-bottom: 50px;
    }
    @page::after {
      content: counter(page);
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      font-size: 16px;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
      }
      .footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 12px;
      }
      .page-break { page-break-inside:avoid; page-break-after:auto }
    }
                    `}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {!isLoading && noData && (
        <div className="flex justify-center items-center h-full">
          <h2 className="text-xl font-semibold">No data available</h2>
        </div>
      )}
    </div>
  );
};

export default PrintPlayerStanding;
