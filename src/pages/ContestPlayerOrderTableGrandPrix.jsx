import React, { useContext, useEffect, useMemo, useState } from "react";
import { BsCheckAll } from "react-icons/bs";
import LoadingPage from "./LoadingPage";
import { TiInputChecked } from "react-icons/ti";
import {
  useFirestoreAddData,
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { Checkbox } from "@mui/material";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateToday } from "../functions/functions";

const ContestPlayerOrderTableGrandPrix = () => {
  const [isLoading, setIsLoading] = useState(false);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [matchedArray, setMatchedArray] = useState([]);
  const [categoriesArray, setCategoriesArray] = useState([]);

  const [gradesArray, setGradesArray] = useState([]);
  const [playersFinalArray, setPlayersFinalArray] = useState([]);
  const [playersFinalList, setPlayersFinalList] = useState({});
  const [resultPlayersArray, setResultFinalArray] = useState([]);
  const [grandPrixArray, setGrandPrixArray] = useState([]);
  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayerFinal = useFirestoreGetDocument("contest_players_final");
  const updatePlayerFinal = useFirestoreUpdateData("contest_players_final");
  const fetchResultQuery = useFirestoreQuery();

  const fetchPool = async (categoriesListId, gradesListId, playersFinalId) => {
    const contestId = currentContest.contests.id;
    const condition = [where("contestId", "==", contestId)];
    if (
      categoriesListId === undefined ||
      gradesListId === undefined ||
      playersFinalId === undefined
    ) {
      setMessage({
        body: "데이터를 불러오는데 문제가 발생했습니다.",
        body2: "시스템 관리자에게 연락하세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
    }
    try {
      await fetchCategoryDocument.getDocument(categoriesListId).then((data) => {
        console.log(data);
        setCategoriesArray(() => [...data.categorys]);
      });
      await fetchGradeDocument.getDocument(gradesListId).then((data) => {
        setGradesArray(() => [...data.grades]);
      });
      await fetchPlayerFinal.getDocument(playersFinalId).then((data) => {
        setPlayersFinalArray(() => [...data.players]);
        setPlayersFinalList(() => ({ ...data }));
      });
      await fetchResultQuery
        .getDocuments("contest_results_list", condition)
        .then((data) => {
          setResultFinalArray(() => [...data]);
        });
    } catch (error) {
      console.log(error);
    }
  };

  const initGrandPrixPlayers = (resultInfo, categories, grades) => {
    let dummy = [];
    console.log(resultInfo);
    console.log(categories);

    // Filter categories with section "그랑프리"
    const filteredCategories = categories.filter(
      (f) => f.contestCategorySection === "그랑프리"
    );
    console.log(filteredCategories);

    // Collect all matching grades for each filtered category
    const filteredGrades = filteredCategories.reduce((acc, category) => {
      const matchingGrades = grades.filter(
        (grade) => grade.refCategoryId === category.contestCategoryId
      );
      return [...acc, ...matchingGrades]; // Merge the arrays
    }, []);

    console.log(filteredGrades);

    const flattenedWinner = resultInfo.map((infoItem, rIdx) => {
      const {
        result: playerResult,
        contestId,
        categoryId,
        gradeId,
        categoryTitle,
        gradeTitle,
      } = infoItem;

      const findWinner = playerResult.find((f) => f.playerRank === 1);
      const newResult = {
        contestId,
        originalCategoryId: categoryId,
        originalGradeId: gradeId,
        originalcategoryTitle: categoryTitle,
        originalgradeTitle: gradeTitle,
        playerName: findWinner.playerName,
        playerNumber: findWinner.playerNumber,
        playerGym: findWinner.playerGym,
        playerIndex: findWinner.playerIndex,
        playerUid: findWinner.playerUid,
        totalScore: findWinner.totalScore,
        isGradeChange: false,
        createBy: "web",
        id: "",
        invoiceCreateAt: generateToday(),
        invoiceId: "",
        playerTel: "",
        playerText: "",
        playerNoShow: false,
      };
      return newResult;
    });

    console.log(flattenedWinner);

    const matchingGradeWithWinner = filteredGrades.map((grade, gIdx) => {
      console.log(grade);
      const filteredMatching = flattenedWinner.filter(
        (f) => f.originalCategoryId === grade.originalRefCategoryId
      );

      console.log(filteredMatching);

      const renewMatching = filteredMatching.map((match, mIdx) => {
        const { contestGradeId, contestGradeTitle, refCategoryId } = grade;
        const newMatched = {
          ...match,
          contestCategoryId: refCategoryId,
          contestCategoryTitle: "그랑프리",
          contestGradeId,
          contestGradeTitle,
        };
        return newMatched;
      });
      dummy = [...dummy, ...renewMatching];

      return filteredMatching;
    });

    console.log(flattenedWinner);
    console.log(matchingGradeWithWinner);

    console.log(dummy);
    return dummy;
  };

  const initPlayersFinalList = (categories, grades, players) => {
    setIsLoading(true);

    console.log(categories);
    let dummy = [];
    console.log(
      categories.filter((f) => f.contestCategorySection === "그랑프리")
    );
    //53754e7a-410c-41d0-8391-9c0dec5a04fc
    categories
      .filter((f) => f.contestCategorySection === "그랑프리")
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .map((category, cIdx) => {
        console.log(category);
        console.log(grades);
        const matchedGrades = grades.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );
        const matchedGradesLength = matchedGrades.length;
        console.log(matchedGrades);
        matchedGrades
          .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
          .map((grade, gIdx) => {
            console.log(players);
            const matchedPlayerWithPlayerNumber = [];
            const matchedPlayers = players.filter(
              (player) => player.contestGradeId === grade.contestGradeId
            );

            const matchedInfo = {
              ...category,
              ...grade,
              matchedPlayers,
              matchedGradesLength,
            };
            dummy.push({ ...matchedInfo });
          });
      });

    console.log(dummy);

    setMatchedArray([...dummy]);
    setIsLoading(false);
  };

  const handleUpdatePlayersFinal = async (contestId, playersFinalId, data) => {
    setMessage({ body: "저장중", isButton: false });
    setMsgOpen(true);

    console.log(data);
    console.log(playersFinalArray);
    // 기존 선수 목록에서 중복되지 않은 선수들만 추가하도록 필터링
    const uniqueNewPlayers = data.filter(
      (newPlayer) =>
        !playersFinalArray.some(
          (existingPlayer) =>
            existingPlayer.playerUid === newPlayer.playerUid &&
            existingPlayer.contestCategoryId === newPlayer?.contestCategoryId
        )
    );

    if (uniqueNewPlayers.length === 0) {
      setMessage({
        body: "추가된 명단이 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    const finalPlayers = [...playersFinalArray, ...uniqueNewPlayers];

    try {
      await updatePlayerFinal
        .updateData(playersFinalId, {
          ...playersFinalList,
          players: finalPlayers,
        })
        .then(() =>
          setMessage({
            body: "저장되었습니다.",
            isButton: true,
            confirmButtonText: "확인",
          })
        );
    } catch (error) {
      console.log(error);
    }
    console.log({
      ...playersFinalList,
      players: finalPlayers,
    });
  };

  useEffect(() => {
    if (!currentContest?.contests) {
      return;
    }
    fetchPool(
      currentContest.contests.contestCategorysListId,
      currentContest.contests.contestGradesListId,
      currentContest.contests.contestPlayersFinalId
    );
  }, [currentContest?.contests]);

  useEffect(() => {
    if (playersFinalArray.length > 0 && grandPrixArray.length > 0) {
      initPlayersFinalList(categoriesArray, gradesArray, grandPrixArray);
    }
  }, [playersFinalArray, grandPrixArray]);

  useEffect(() => {
    console.log(resultPlayersArray);
    console.log(categoriesArray);
    if (categoriesArray?.length > 0 && gradesArray?.length > 0) {
      setGrandPrixArray([
        ...initGrandPrixPlayers(
          resultPlayersArray,
          categoriesArray,
          gradesArray
        ),
      ]);
    }
  }, [resultPlayersArray, categoriesArray, gradesArray]);

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-3 gap-y-2">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <>
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
                  <TiInputChecked />
                </span>
                <h1
                  className="font-sans text-lg font-semibold"
                  style={{ letterSpacing: "2px" }}
                >
                  그랑프리명단
                </h1>
              </div>
            </div>
          </div>
          <div className="flex w-full h-full">
            <div className="flex w-full justify-start items-center">
              <div className="flex w-full h-full justify-start lg:px-3 lg:pt-3 flex-col bg-gray-100 rounded-lg gap-y-2">
                {grandPrixArray?.length ? (
                  <div className="flex w-full gap-x-5">
                    <button
                      className="w-full h-12 bg-gradient-to-r from-blue-300 to-cyan-200 rounded-lg"
                      onClick={() =>
                        handleUpdatePlayersFinal(
                          currentContest.contests.id,
                          currentContest.contests.contestPlayersFinalId,
                          grandPrixArray
                        )
                      }
                    >
                      그랑프리명단 저장
                    </button>
                  </div>
                ) : (
                  <div className="flex w-full gap-x-5">
                    <button className="w-full h-12 bg-gradient-to-l from-green-300 to-green-200 rounded-lg">
                      집계표가 저장되었는지 확인하세요
                    </button>
                  </div>
                )}
                {matchedArray.length > 0 &&
                  matchedArray
                    .sort(
                      (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
                    )
                    .map((matched, mIdx) => {
                      const {
                        contestCategoryId: categoryId,
                        contestCategoryIndex: categoryIndex,
                        contestCategoryTitle: categoryTitle,
                        contestGradeId: gradeId,
                        contestGradeIndex: gradeIndex,
                        contestGradeTitle: gradeTitle,
                        matchedPlayers,
                        matchedGradesLength: gradeLength,
                      } = matched;

                      console.log(matched);

                      if (matchedPlayers.length === 0) return null;

                      let categoryNumber = 0;
                      return (
                        <div
                          className="flex w-full h-auto bg-blue-300 flex-col rounded-lg"
                          key={mIdx}
                        >
                          <div className="flex flex-col p-1 lg:p-2 gap-y-2">
                            <div className="flex flex-col bg-blue-100 rounded-lg">
                              <div className="flex h-10 items-center px-2">
                                {categoryTitle}({gradeTitle})
                              </div>

                              <div className="flex flex-col w-full lg:p-2">
                                <div className="flex flex-col w-full bg-white p-2 border border-b-2 border-gray-400 rounded-lg">
                                  <div className="flex w-full border-b border-gray-300 h-8 items-center text-sm lg:px-2">
                                    <div className="flex w-1/6">순번</div>
                                    <div className="flex w-1/6">선수번호</div>
                                    <div className="flex w-1/6">이름</div>
                                    <div className="flex w-2/6">소속</div>
                                    <div className="flex w-1/6">비고</div>
                                  </div>
                                  <div>
                                    {matchedPlayers
                                      .sort(
                                        (a, b) => a.playerIndex - b.playerIndex
                                      )
                                      .map((player, pIdx) => {
                                        const {
                                          playerName,
                                          playerGym,
                                          playerUid,
                                          playerNumber,
                                          playerNoShow,
                                          isGradeChanged,
                                        } = player;

                                        return (
                                          <div className="flex w-full h-10 border-b border-gray-300 items-center text-sm lg:px-2">
                                            <div
                                              className={`${
                                                !playerNoShow
                                                  ? "flex w-1/6"
                                                  : "flex w-1/6 text-gray-300 line-through"
                                              }`}
                                            >
                                              {pIdx + 1}
                                            </div>
                                            <div
                                              className={`${
                                                !playerNoShow
                                                  ? "flex w-1/6"
                                                  : "flex w-1/6 text-gray-300 line-through"
                                              }`}
                                            >
                                              {playerNumber}
                                            </div>
                                            <div
                                              className={`${
                                                !playerNoShow
                                                  ? "flex w-1/6"
                                                  : "flex w-1/6 text-gray-300 line-through"
                                              }`}
                                            >
                                              {playerName}
                                            </div>
                                            <div
                                              className={`${
                                                !playerNoShow
                                                  ? "flex w-2/6"
                                                  : "flex w-2/6 text-gray-300 line-through"
                                              }`}
                                            >
                                              {playerGym}
                                            </div>
                                            <div className="flex w-1/6 ">
                                              {isGradeChanged && (
                                                <span className="w-full font-bold">
                                                  월체
                                                </span>
                                              )}
                                              {playerNoShow && (
                                                <span className="w-full font-bold">
                                                  불참
                                                </span>
                                              )}
                                              {playerUid}
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              </div>
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

export default ContestPlayerOrderTableGrandPrix;
