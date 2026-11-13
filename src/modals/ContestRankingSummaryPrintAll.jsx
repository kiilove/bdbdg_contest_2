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
import { Printer, X } from "lucide-react";
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
    const scoreCollectionName =
      currentContest?.contestInfo?.contestCollectionName ||
      currentContest?.contests?.collectionName;
    if (!props?.contestId || !props?.gradeId || !scoreCollectionName) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchPool(props.contestId, props.gradeId, scoreCollectionName);
  }, [
    props,
    currentContest?.contestInfo?.contestCollectionName,
    currentContest?.contests?.collectionName,
  ]);

  useEffect(() => {
    if (
      currentContest?.contestInfo?.contestTitle &&
      resultTable?.[0]?.categoryTitle &&
      resultTable?.[0]?.gradeTitle
    ) {
      const { contestTitle } = currentContest.contestInfo;
      const { categoryTitle, gradeTitle } = resultTable[0];
      document.title = `${contestTitle}_${categoryTitle}_${gradeTitle}_집계표`;
    }
  }, [currentContest, resultTable]);
  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
      <div className="sticky top-0 z-10 shrink-0 bg-white border-b border-[#171717]/[0.08] px-5 py-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#171717] m-0">
            집계표 및 채점표 출력 미리보기
          </h2>
          {(props?.categoryTitle ||
            resultTable?.[0]?.categoryTitle ||
            props?.gradeTitle ||
            resultTable?.[0]?.gradeTitle) && (
            <p className="text-xs text-[#525252] m-0 truncate">
              {props?.categoryTitle || resultTable?.[0]?.categoryTitle || ""}
              {props?.gradeTitle || resultTable?.[0]?.gradeTitle
                ? ` (${props?.gradeTitle || resultTable?.[0]?.gradeTitle})`
                : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ReactToPrint
            trigger={() => (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium transition-colors cursor-pointer"
              >
                <Printer size={15} strokeWidth={1.5} />
                <span>집계표출력</span>
              </button>
            )}
            content={() => printRef.current}
            pageStyle="@page { size: A4; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; box-shadow:none; } }"
          />
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] text-sm font-medium transition-colors cursor-pointer"
            onClick={() => setClose(false)}
          >
            <X size={15} strokeWidth={1.5} />
            <span>닫기</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#fafafa] p-4 flex flex-col items-center">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <LoadingPage />
          </div>
        ) : resultTable?.length > 0 ? (
          resultTable.map((table, rIdx) => {
            const {
              contestId,
              categoryTitle,
              gradeId,
              gradeTitle,
              result,
            } = table;

            return (
              <div
                key={table.id || rIdx}
                className="flex shadow-[0_1px_3px_rgba(0,0,0,0.08)] bg-white"
                ref={printRef}
                style={{ width: "210mm", minHeight: "297mm" }}
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
                      [...scoreCardPrintArray]
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
                          const isPointType =
                            (props?.categoryJudgeType || table?.scoreType) ===
                            "point";
                          return (
                            <React.Fragment key={seatIndex ?? cIdx}>
                              {isPointType ? (
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
                            </React.Fragment>
                          );
                        })}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex-1 flex items-center justify-center py-16 text-xs text-[#737373]">
            확정된 집계표 데이터가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default ContestRankingSummaryPrintAll;
