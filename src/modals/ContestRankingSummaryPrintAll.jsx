import React, { useRef } from "react";
import ScoreSheet from "../components/ScoreSheet";
import ScoreCardRankForm from "../components/ScoreCardRankForm";
import ScoreCardPointForm from "../components/ScoreCardPointForm";
import { useState } from "react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { useContext } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useEffect } from "react";
import { where } from "firebase/firestore";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import { result } from "lodash";

const ContestRankingSummaryPrintAll = ({ props, setClose }) => {
  const [resultTable, setResultTable] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [judgesArray, setJudgesArray] = useState([]);
  const [judgeHeadInfo, setJudgeHeadInfo] = useState();
  const [scoreCardsArray, setScoreCardsArray] = useState([]);
  const [scoreCardPrintArray, setScoreCardPrintArray] = useState([]);
  const printRef = useRef();
  const fetchQuery = useFirestoreQuery();

  const { currentContest } = useContext(CurrentContestContext);

  const fetchPool = async (propContestId, propGradeId, scoreCollectionName) => {
    const condition = [
      where("contestId", "==", propContestId),
      where("gradeId", "==", propGradeId),
    ];

    console.log(propGradeId);

    const conditionJudge = [where("contestId", "==", propContestId)];
    console.log(propContestId);
    try {
      await fetchQuery
        .getDocuments("contest_results_list", condition)
        .then((data) => {
          console.log(data);
          if (data.length === 0) {
            console.log("데이터가 없음");
            return;
          } else {
            setResultTable(() => [...data]);
          }
        });
    } catch (error) {
      console.log(error);
    }

    try {
      await fetchQuery
        .getDocuments(scoreCollectionName, condition)
        .then((data) => {
          console.log(data);
          if (data.length === 0) {
            console.log("데이터가 없음");
            return;
          } else {
            setScoreCardsArray(() => [...data]);
          }
        });
    } catch (error) {
      console.log(error);
    }

    try {
      await fetchQuery
        .getDocuments("contest_judges_pool", conditionJudge)
        .then((data) => {
          if (data?.length === 0) {
            return;
          } else {
            setJudgesArray(() => [...data]);
          }
        });
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupBySeatIndex = (scoreArray, JudgeArray) => {
    const groupedSeatIndex = scoreArray.reduce((acc, curr) => {
      let group = acc.find((g) => g.seatIndex === curr.seatIndex);

      if (!group) {
        group = {
          seatIndex: curr.seatIndex,
          contestId: curr.contestId,
          categoryId: curr.categoryId,
          categoryTitle: curr.categoryTitle,
          gradeId: curr.gradeId,
          gradeTitle: curr.gradeTitle,
          judgeUid: curr.judgeUid,
          players: [],
        };
        acc.push(group);
      }

      return acc;
    }, []);

    groupedSeatIndex
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((judge, jIdx) => {
        const findJudgeSignature = JudgeArray.find(
          (f) => f.judgeUid === judge.judgeUid
        );
        if (findJudgeSignature) {
          groupedSeatIndex[jIdx].judgeSignature =
            findJudgeSignature.judgeSignature;
          groupedSeatIndex[jIdx].judgeName = findJudgeSignature.judgeName;
          groupedSeatIndex[jIdx].judgePromoter =
            findJudgeSignature.judgePromoter;
        }
        const findPlayers = scoreArray.filter(
          (f) => f.seatIndex === judge.seatIndex
        );
        const { playerNumber, playerScore, judgeUid } = findPlayers;

        groupedSeatIndex[jIdx].players = [...findPlayers];
      });

    console.log(groupedSeatIndex);
    return groupedSeatIndex;
    // .map((group) => {
    //   const playerItem = arr.filter(
    //     (item) => item.seatIndex === group.seatIndex
    //   );
    //   console.log(playerItem);
    //   group.result = groupedByPlayerNumber(gradeItems, sortType);
    //   return group;
    // });
  };

  const handleJudgeHeadInfo = (judges) => {
    if (judges.length === 0) {
      return;
    }
    const findHeadInfo = judges.filter((f) => f.isHead === true);
    console.log(findHeadInfo);
    if (findHeadInfo.length === 0) {
      return;
    } else {
      return findHeadInfo[0];
    }
  };

  useEffect(() => {
    if (judgesArray?.length > 0) {
      setJudgeHeadInfo(() => handleJudgeHeadInfo(judgesArray));
    }
  }, [judgesArray]);

  useEffect(() => {
    if (scoreCardsArray?.length > 0 && judgesArray?.length > 0) {
      setScoreCardPrintArray(() => [
        ...handleGroupBySeatIndex(scoreCardsArray, judgesArray),
      ]);
    }
  }, [scoreCardsArray, judgesArray]);

  useEffect(() => {
    console.log(resultTable);
  }, [resultTable]);

  useEffect(() => {
    if (
      !props?.contestId ||
      !props?.gradeId ||
      !currentContest?.contestInfo?.contestCollectionName
    ) {
      return;
    }
    fetchPool(
      props.contestId,
      props.gradeId,
      currentContest?.contestInfo?.contestCollectionName
    );
  }, [props, currentContest?.contestInfo]);
  return (
    <div className="w-full h-auto flex flex-col bg-gray-100 justify-start items-center overflow-auto">
      {isLoading && <LoadingPage />}
      {!isLoading && (
        <>
          <div
            className="flex h-14 justify-end items-center gap-x-2"
            style={{ width: "210mm" }}
          >
            <ReactToPrint
              trigger={() => (
                <button className="w-40 h-10 bg-blue-300 rounded-lg">
                  집계표출력
                </button>
              )}
              content={() => printRef.current}
              pageStyle="@page { size: A4; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; box-shadow:none; } }"
            />
            <button
              className="flex w-40 h-10 bg-gray-300 rounded-lg justify-center items-center"
              onClick={() => setClose(false)}
            >
              닫기
            </button>
          </div>
          {resultTable?.length > 0 &&
            resultTable.map((table, rIdx) => {
              const {
                contestId,
                categoryId,
                categoryTitle,
                gradeId,
                gradeTitle,
                result,
              } = table;

              return (
                <div
                  className="flex shadow bg-white"
                  ref={printRef}
                  style={{ width: "210mm", height: "297mm" }}
                >
                  <div className="flex flex-col w-full h-auto">
                    <div className="flex w-full break-after-page mb-20">
                      <ScoreSheet
                        contestId={contestId}
                        contestInfo={currentContest.contestInfo}
                        gradeId={gradeId}
                        categoryTitle={categoryTitle}
                        gradeTitle={gradeTitle}
                        scoreTable={result}
                        judgeHeadInfo={judgeHeadInfo}
                      />
                    </div>
                    <div className="flex w-full h-auto flex-col">
                      {scoreCardPrintArray?.length > 0 &&
                        scoreCardPrintArray
                          .sort((a, b) => a.seatIndex - b.seatIndex)
                          .map((card, cIdx) => {
                            const {
                              seatIndex,
                              categoryTitle,
                              gradeTitle,
                              judgeSignature,
                              judgeName,
                              judgePromoter,
                              players,
                            } = card;
                            return (
                              <>
                                {props.categoryJudgeType === "point" ? (
                                  <div className="flex w-full h-auto justify-center items-start break-after-page">
                                    <ScoreCardPointForm
                                      contestInfo={currentContest.contestInfo}
                                      seatIndex={seatIndex}
                                      categoryTitle={categoryTitle}
                                      gradeTitle={gradeTitle}
                                      judgeSignature={judgeSignature}
                                      judgeName={judgeName}
                                      judgePromoter={judgePromoter}
                                      players={players}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex w-full h-auto justify-center items-start break-after-page">
                                    <ScoreCardRankForm
                                      contestInfo={currentContest.contestInfo}
                                      seatIndex={seatIndex}
                                      categoryTitle={categoryTitle}
                                      gradeTitle={gradeTitle}
                                      judgeSignature={judgeSignature}
                                      judgeName={judgeName}
                                      judgePromoter={judgePromoter}
                                      players={players}
                                    />
                                  </div>
                                )}
                              </>
                            );
                          })}
                    </div>
                  </div>
                </div>
              );
            })}
        </>
      )}
    </div>
  );
};

export default ContestRankingSummaryPrintAll;
