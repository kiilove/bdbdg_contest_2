import React, { useRef } from "react";
import { useEffect } from "react";
import { useFirestoreAddData, useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { useState } from "react";
import { array } from "yup";
import PrintAwardForm from "./PrintAwardForm";
import dayjs from "dayjs";
import { generateToday } from "../functions/functions";
import ReactToPrint from "react-to-print";

const PrintAward = ({ props, setClose }) => {
  const [resultsArray, setResultsArray] = useState([]);
  const [currentResult, setCurrentResult] = useState([]);
  const [awardList, setAwardList] = useState([]);
  const [currentAwardList, setCurrentAwardList] = useState([]);
  const fetchResults = useFirestoreQuery();
  const addAward = useFirestoreAddData("contest_award_list");

  const fetchQuery = useFirestoreQuery();
  const [currentAwardNumber, setCurrentAwardNumber] = useState();
  const printRef = useRef();

  const fetchPool = async (contestId) => {
    const condition = [where("contestId", "==", contestId)];
    try {
      await fetchResults
        .getDocuments("contest_results_list", condition)
        .then((data) => {
          console.log(data);
          setResultsArray(() => [
            ...data.sort((a, b) =>
              a.categoryTitle.localeCompare(b.categoryTitle)
            ),
          ]);
        });
    } catch (error) {
      console.log(error);
    }

    try {
      const awardData = await fetchResults.getDocuments(
        "contest_award_list",
        condition
      );
      console.log(awardData);

      if (awardData?.length > 0) {
        const filtered = awardData.filter(
          (item) => item.madeYear === dayjs(generateToday()).year()
        );
        setCurrentAwardNumber(filtered.length === 0 ? 1 : filtered.length + 1);
        setAwardList(() =>
          [...awardData].sort((a, b) =>
            a.categoryTitle.localeCompare(b.categoryTitle)
          )
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleAddAward = async (awardList, contestId) => {
    const condition = [where("contestId", "==", contestId)];
    const newList = awardList.filter((f) => f.isAward === true);

    if (newList.length > 0) {
      try {
        const existingAwards = await fetchResults.getDocuments(
          "contest_award_list",
          condition
        );
        const currentYear = dayjs(generateToday()).year();

        let maxAwardNumber = 0;
        existingAwards.forEach((award) => {
          if (
            award.madeYear === currentYear &&
            award.awardNumber > maxAwardNumber
          ) {
            maxAwardNumber = award.awardNumber;
          }
        });

        for (const list of newList) {
          const newAwardNumber = maxAwardNumber + 1;

          const addedData = await addAward.addData({
            ...list,
            isMaded: true,
            awardNumber: newAwardNumber,
          });
          console.log(addedData);

          const newAwardList = [...currentAwardList];
          newAwardList.push({
            ...list,
            isMaded: true,
            awardNumber: newAwardNumber,
          });
          setCurrentAwardList(newAwardList);

          maxAwardNumber = newAwardNumber;
        }
      } catch (error) {
        console.log(error);
      }
    }
  };

  const handleCurrentResult = (resultId, resultArray) => {
    if (resultId === "noId") {
      return;
    }

    const findResult = resultArray.find((f) => f.id === resultId);
    if (findResult) {
      const newPlayerInfo = {
        ...findResult,
      };

      const flattenPlayerInfo = newPlayerInfo?.result?.map((player, pIdx) => {
        const { playerName, playerGym, playerNumber, playerRank, playerUid } =
          player;
        const { categoryId, categoryTitle, gradeId, gradeTitle, contestId } =
          newPlayerInfo;
        const newInfo = {
          categoryId,
          categoryTitle1: categoryTitle,
          categoryTitle2: "",
          categoryTitle,
          gradeId,
          gradeTitle,
          contestId,
          playerName,
          playerGym,
          playerGym1: playerGym,
          playerGym2: "",
          playerNumber,
          playerRank,
          playerUid,
          isAward: false,
          isMaded: false,
          playerGymFontSize: "22px",
          categoryFontSize: "18px",
          madeYear: dayjs(generateToday()).year().toString(),
          awardNumber: currentAwardNumber + pIdx,
        };

        return newInfo;
      });

      console.log(flattenPlayerInfo);

      setCurrentResult(() => [...flattenPlayerInfo]);
    }
  };

  const handleUpdateCurrentResult = (
    resultArray,
    resultIndex,
    e,
    actionType
  ) => {
    const newResult = [...resultArray];
    let matchResult = { ...newResult[resultIndex] };
    const { name, value } = e.target;

    if (name === "playerGymFontSize" || name === "categoryFontSize") {
      let newValue = value.slice(0, -2); // 마지막 2글자를 제외한 값 추출
      newValue = parseInt(newValue);
      console.log(newValue);

      if (actionType === "plus") {
        newValue += 1;
      } else {
        newValue -= 1;
      }

      matchResult = { ...matchResult, [name]: `${newValue}px` };
    } else {
      matchResult = { ...matchResult, [name]: value };
    }

    newResult.splice(resultIndex, 1, { ...matchResult });
    setCurrentResult([...newResult]); // 수정: [] 불필요, newResult로 대체
  };

  const handleCheckAllAwardPlayer = (e) => {
    const { name, checked, value } = e.target;
    console.log(checked);

    const newArray = [...currentResult];
    const newChecked = newArray.map((arr, aIdx) => {
      if (!arr.isMaded) {
        const newInfo = { ...arr, isAward: checked };
        console.log(newInfo);
        return newInfo;
      }
    });
    console.log(newArray);

    setCurrentResult(() => [...newChecked]);
  };
  const handleCheckAwardPlayer = (e, resultIndex) => {
    const { name, checked, value } = e.target;

    const findIndexPlayer = currentResult.findIndex(
      (f) => f.playerUid === name
    );
    const newInfo = { ...currentResult[findIndexPlayer], isAward: checked };
    const newArray = [...currentResult];
    newArray.splice(findIndexPlayer, 1, { ...newInfo });
    setCurrentResult(() => [...newArray]);

    console.log(newInfo);
  };

  useEffect(() => {
    console.log(currentResult);
    if (currentResult?.length > 0) {
      let dummy = [];
      currentResult.map((item, idx) => {
        const { contestId, categoryId, gradeId, playerUid } = item;
        const findAward = awardList.findIndex(
          (f) =>
            f.contestId === contestId &&
            f.categoryId === categoryId &&
            f.gradeId === gradeId &&
            f.playerUid === playerUid
        );
        if (findAward != -1) {
          dummy.push({ ...item });
        }
      });
      setCurrentAwardList(() => [...dummy]);
    }
  }, [currentResult]);

  useEffect(() => {
    if (props.contestId) {
      fetchPool(props.contestId);
    }
  }, [props]);

  const AwardForm = ({ playerName }) => {
    return (
      <div
        className="flex flex-col"
        style={{ width: "210mm", height: "297mm" }}
      >
        <div className="flex">상장</div>
      </div>
    );
  };

  return (
    <div className="flex w-full h-auto bg-gray-100 justify-center items-start  overflow-auto ">
      <div className="flex flex-col w-full h-full justify-start items-start gap-y-2 bg-white">
        <div className="flex w-full justify-center items-center h-10 p-3 ">
          <div className="flex w-full bg-blue-100 p-2 rounded-lg mt-5">
            <div className="flex w-1/2 justify-start">
              <select
                onChange={(e) =>
                  handleCurrentResult(e.target.value, resultsArray)
                }
              >
                <option value="noId">종목 선택</option>
                {resultsArray?.map((result) => {
                  const { categoryTitle, gradeTitle, id } = result;
                  return (
                    <option value={id}>
                      {categoryTitle}({gradeTitle})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex">
              <button
                className="w-32 h-10 bg-blue-400"
                onClick={() => handleAddAward(currentResult, props.contestId)}
              >
                상장만들기
              </button>
              <button
                className="w-32 h-10 bg-blue-400"
                onClick={() => fetchPool(props.contestId)}
              >
                새로고침
              </button>
            </div>
          </div>
        </div>
        <div className="flex w-full h-auto p-5 flex-col">
          {currentResult && (
            <>
              <div className="flex w-full bg-gray-300">
                <div
                  className="flex h-10 justify-center items-center"
                  style={{ width: "10%" }}
                >
                  <input
                    type="checkbox"
                    name="all"
                    onChange={(e) => handleCheckAllAwardPlayer(e)}
                  />
                </div>
                <div className="flex">상장연번</div>
                <div
                  className="flex h-10 justify-center items-center"
                  style={{ width: "25%" }}
                >
                  종목명
                </div>
                <div
                  className="flex h-10 justify-center items-center"
                  style={{ width: "10%" }}
                >
                  순위
                </div>
                <div
                  className="flex h-10 justify-center items-center"
                  style={{ width: "10%" }}
                >
                  선수번호
                </div>
                <div
                  className="flex h-10 justify-center items-center"
                  style={{ width: "25%" }}
                >
                  이름
                </div>
                <div
                  className="flex h-10 justify-center items-center"
                  style={{ width: "30%" }}
                >
                  소속
                </div>
              </div>
              {currentResult.length > 0 &&
                currentResult
                  .sort((a, b) => a.playerRank - b.playerRank)
                  .map((player, pIdx) => {
                    const {
                      playerRank,
                      playerName,
                      playerNumber,
                      playerGym1,
                      playerGym2,
                      playerUid,
                      isAward,
                      isMaded,
                      playerGymFontSize,
                      categoryTitle1,
                      categoryTitle2,
                      categoryFontSize,
                    } = player;

                    return (
                      <div className="flex w-full">
                        <div
                          className="flex h-auto justify-center items-center"
                          style={{ width: "10%" }}
                        >
                          {isMaded ? (
                            <span>완료</span>
                          ) : (
                            <input
                              type="checkbox"
                              value={playerUid}
                              checked={isAward}
                              name={playerUid}
                              onChange={(e) => handleCheckAwardPlayer(e, pIdx)}
                            />
                          )}
                        </div>
                        <div className="flex"></div>
                        <div
                          className="flex h-10 justify-center items-center flex-col"
                          style={{ width: "25%" }}
                        >
                          <div className="flex">
                            <div className="flex">
                              <button
                                className="w-8 h-8 bg-gray-400"
                                name="categoryFontSize"
                                value={categoryFontSize}
                                onClick={(e) =>
                                  handleUpdateCurrentResult(
                                    currentResult,
                                    pIdx,
                                    e,
                                    "minus"
                                  )
                                }
                              >
                                -
                              </button>
                            </div>
                            <div className="flex">
                              <input
                                type="text"
                                name="categoryTitle1"
                                className="w-28 border"
                                onChange={(e) =>
                                  handleUpdateCurrentResult(
                                    currentResult,
                                    pIdx,
                                    e
                                  )
                                }
                                value={categoryTitle1}
                              />
                            </div>
                            <div className="flex">
                              <button
                                className="w-8 h-8 bg-gray-400"
                                name="categoryFontSize"
                                value={categoryFontSize}
                                onClick={(e) =>
                                  handleUpdateCurrentResult(
                                    currentResult,
                                    pIdx,
                                    e,
                                    "plus"
                                  )
                                }
                              >
                                +
                              </button>
                            </div>
                            <div className="flex">{categoryFontSize}</div>
                          </div>
                          <div className="flex">
                            <div className="flex">
                              <button
                                className="w-8 h-8 bg-gray-400"
                                name="categoryFontSize"
                                value={categoryFontSize}
                                onClick={(e) =>
                                  handleUpdateCurrentResult(
                                    currentResult,
                                    pIdx,
                                    e,
                                    "minus"
                                  )
                                }
                              >
                                -
                              </button>
                            </div>
                            <div className="flex">
                              <input
                                type="text"
                                name="categoryTitle2"
                                className="w-28 border"
                                onChange={(e) =>
                                  handleUpdateCurrentResult(
                                    currentResult,
                                    pIdx,
                                    e
                                  )
                                }
                                value={categoryTitle2}
                              />
                            </div>
                            <div className="flex">
                              <button
                                className="w-8 h-8 bg-gray-400"
                                name="categoryFontSize"
                                value={categoryFontSize}
                                onClick={(e) =>
                                  handleUpdateCurrentResult(
                                    currentResult,
                                    pIdx,
                                    e,
                                    "plus"
                                  )
                                }
                              >
                                +
                              </button>
                            </div>
                            <div className="flex">{playerGymFontSize}</div>
                          </div>
                        </div>
                        <div
                          className="flex h-10 justify-center items-center"
                          style={{ width: "10%" }}
                        >
                          {playerRank}
                        </div>
                        <div
                          className="flex h-10 justify-center items-center"
                          style={{ width: "10%" }}
                        >
                          {playerNumber}
                        </div>
                        <div
                          className="flex h-10 justify-center items-center"
                          style={{ width: "25%" }}
                        >
                          {playerName}
                        </div>
                        <div
                          className="flex h-20 justify-center items-center flex-col"
                          style={{ width: "30%" }}
                        >
                          <div className="flex">
                            <div className="flex">
                              <button
                                className="w-8 h-8 bg-gray-400"
                                name="playerGymFontSize"
                                value={playerGymFontSize}
                                onClick={(e) =>
                                  handleUpdateCurrentResult(
                                    currentResult,
                                    pIdx,
                                    e,
                                    "minus"
                                  )
                                }
                              >
                                -
                              </button>
                            </div>
                            <div className="flex">
                              <input
                                type="text"
                                name="playerGym1"
                                className="w-28 border"
                                onChange={(e) =>
                                  handleUpdateCurrentResult(
                                    currentResult,
                                    pIdx,
                                    e
                                  )
                                }
                                value={playerGym1}
                              />
                            </div>
                            <div className="flex">
                              <button
                                className="w-8 h-8 bg-gray-400"
                                name="playerGymFontSize"
                                value={playerGymFontSize}
                                onClick={(e) =>
                                  handleUpdateCurrentResult(
                                    currentResult,
                                    pIdx,
                                    e,
                                    "plus"
                                  )
                                }
                              >
                                +
                              </button>
                            </div>
                            <div className="flex">{playerGymFontSize}</div>
                          </div>
                          <div className="flex">
                            <div className="flex">
                              <button className="w-8 h-8 bg-gray-400">-</button>
                            </div>
                            <div className="flex">
                              <input
                                type="text"
                                name="playerGym2"
                                className="w-28 border"
                                value={playerGym2}
                                onChange={(e) =>
                                  handleUpdateCurrentResult(
                                    currentResult,
                                    pIdx,
                                    e
                                  )
                                }
                              />
                            </div>
                            <div className="flex">
                              <button className="w-8 h-8 bg-gray-400">+</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
            </>
          )}
        </div>
        <div className="flex w-full h-10">
          <ReactToPrint
            trigger={() => (
              <button className="w-40 h-10 bg-blue-300 rounded-lg">
                상장출력
              </button>
            )}
            content={() => printRef.current}
            pageStyle="@page { size: A4; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; box-shadow:none; } }"
          />
        </div>
        <div
          className="flex flex-col w-full h-full bg-white gap-y-2 justify-start items-center"
          ref={printRef}
        >
          {currentAwardList.length > 0 &&
            currentAwardList.map((award, aIdx) => {
              const {
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
              } = award;
              return (
                <div className="flex">
                  <div className="flex w-full flex-col p-10 break-after-page">
                    <PrintAwardForm
                      playerName={playerName}
                      playerRank={playerRank}
                      awardNumber={awardNumber}
                      categoryTitle1={categoryTitle1}
                      categoryTitle2={categoryTitle2}
                      categoryFontSize={categoryFontSize}
                      gradeTitle={gradeTitle}
                      playerGym1={playerGym1}
                      playerGym2={playerGym2}
                      playerGymFontSize={playerGymFontSize}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default PrintAward;
