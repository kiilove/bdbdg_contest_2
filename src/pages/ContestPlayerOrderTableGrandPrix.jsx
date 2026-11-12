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
    const contestId = currentContest?.contests?.id;
    if (!contestId) return;

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
      setMsgOpen(true);
      return;
    }
    try {
      await fetchCategoryDocument.getDocument(categoriesListId).then((data) => {
        setCategoriesArray(() => [...(data?.categorys || [])]);
      });
      await fetchGradeDocument.getDocument(gradesListId).then((data) => {
        setGradesArray(() => [...(data?.grades || [])]);
      });
      await fetchPlayerFinal.getDocument(playersFinalId).then((data) => {
        setPlayersFinalArray(() => [...(data?.players || [])]);
        setPlayersFinalList(() => ({ ...(data || {}) }));
      });
      await fetchResultQuery
        .getDocuments("contest_results_list", condition)
        .then((data) => {
          setResultFinalArray(() => [...(data || [])]);
        });
    } catch (error) {
      console.error(error);
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

    const flattenedWinner = resultInfo
      .map((infoItem, rIdx) => {
        const {
          result: playerResult,
          contestId,
          categoryId,
          gradeId,
          categoryTitle,
          gradeTitle,
        } = infoItem;

        const findWinner = playerResult?.find((f) => f.playerRank === 1);
        if (!findWinner) return null;

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
      })
      .filter(Boolean);

    console.log("Flattened winners:", flattenedWinner);

    filteredGrades.forEach((grade) => {
      const filteredMatching = flattenedWinner.filter(
        (f) => f.originalCategoryId === grade.originalRefCategoryId
      );

      // 🚨 동일 그랑프리 체급 내 선수 중복 방지 (선수번호 또는 UID 기준)
      const seenPlayers = new Set();
      const renewMatching = [];

      filteredMatching.forEach((match) => {
        const playerKey = String(match.playerUid || match.playerNumber || match.playerName);
        if (!seenPlayers.has(playerKey)) {
          seenPlayers.add(playerKey);
          const { contestGradeId, contestGradeTitle, refCategoryId } = grade;
          const newMatched = {
            ...match,
            contestCategoryId: refCategoryId,
            contestCategoryTitle: "그랑프리",
            contestGradeId,
            contestGradeTitle,
          };
          renewMatching.push(newMatched);
        }
      });

      dummy = [...dummy, ...renewMatching];
    });

    // 전체 dummy에서도 체급별 중복 완벽 제거
    const uniqueMap = new Map();
    dummy.forEach((p) => {
      const uniqueKey = `${p.contestGradeId}_${p.playerUid || p.playerNumber}`;
      if (!uniqueMap.has(uniqueKey)) {
        uniqueMap.set(uniqueKey, p);
      }
    });

    return Array.from(uniqueMap.values());
  };

  const initPlayersFinalList = (categories, grades, players) => {
    setIsLoading(true);

    let dummy = [];
    categories
      .filter((f) => f.contestCategorySection === "그랑프리")
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .forEach((category) => {
        const matchedGrades = grades.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );
        const matchedGradesLength = matchedGrades.length;

        matchedGrades
          .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
          .forEach((grade) => {
            const rawMatched = players.filter(
              (player) => player.contestGradeId === grade.contestGradeId
            );

            // 🚨 화면 렌더링 시 동일 체급 내 선수 번호 중복 방지
            const seen = new Set();
            const matchedPlayers = [];
            rawMatched.forEach((player) => {
              const k = String(player.playerUid || player.playerNumber || player.playerName);
              if (!seen.has(k)) {
                seen.add(k);
                matchedPlayers.push(player);
              }
            });

            const matchedInfo = {
              ...category,
              ...grade,
              matchedPlayers,
              matchedGradesLength,
            };
            dummy.push({ ...matchedInfo });
          });
      });

    console.log("Deduplicated matched Grand Prix array:", dummy);
    setMatchedArray([...dummy]);
    setIsLoading(false);
  };

  const handleUpdatePlayersFinal = async (contestId, playersFinalId, data) => {
    setMessage({ body: "저장중...", isButton: false });
    setMsgOpen(true);

    try {
      if (!playersFinalId) {
        setMessage({
          body: "최종 명단 문서 정보를 확인할 수 없습니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        return;
      }

      // 1. data(그랑프리 선수들) 자체에서 동일 체급 내 중복 완벽 제거
      const dedupedGrandPrixData = [];
      const seenGrandPrixKeys = new Set();
      (data || []).forEach((p) => {
        if (!p) return;
        const k = `${p.contestGradeId}_${p.playerUid || p.playerNumber || p.playerName}`;
        if (!seenGrandPrixKeys.has(k)) {
          seenGrandPrixKeys.add(k);
          dedupedGrandPrixData.push(p);
        }
      });

      if (dedupedGrandPrixData.length === 0) {
        setMessage({
          body: "추가할 그랑프리 명단이 없습니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        return;
      }

      // 최신 contest_players_final 문서를 다시 읽어 동시 계측/강제등록 데이터 손실 방지
      const latestFinalDoc = await fetchPlayerFinal.getDocument(playersFinalId);
      const baseFinalList = latestFinalDoc || playersFinalList || {};
      const baseFinalPlayers = Array.isArray(latestFinalDoc?.players)
        ? latestFinalDoc.players
        : playersFinalArray || [];

      // 그랑프리 종목에 속한 체급 ID 집합 계산
      const grandPrixCategoryIds = new Set(
        (categoriesArray || [])
          .filter((c) => c?.contestCategorySection === "그랑프리")
          .map((c) => c.contestCategoryId)
          .filter(Boolean)
      );
      const grandPrixGradeIds = new Set(
        [
          ...(gradesArray || [])
            .filter((g) => grandPrixCategoryIds.has(g?.refCategoryId))
            .map((g) => g.contestGradeId),
          ...dedupedGrandPrixData.map((p) => p?.contestGradeId),
        ].filter(Boolean)
      );

      // 2. 기존 baseFinalPlayers에서 그랑프리 체급에 속한 기존 선수들 교체 (단, 강제 등록된 선수 createdBy === 'force'는 보존)
      const nonGrandPrixPlayers = baseFinalPlayers.filter(
        (p) =>
          !grandPrixGradeIds.has(p?.contestGradeId) ||
          p?.createdBy === "force" ||
          p?.createBy === "force"
      );

      // 3. 전체 선수 목록 병합 후 중복 검증 (수기 강제 등록 선수 + 전자 집계 우승자)
      const finalPlayersMap = new Map();
      [...nonGrandPrixPlayers, ...dedupedGrandPrixData].forEach((p) => {
        if (!p) return;
        const k = `${p.contestGradeId}_${p.playerUid || p.playerNumber || p.playerName}`;
        if (!finalPlayersMap.has(k)) {
          finalPlayersMap.set(k, p);
        }
      });
      const finalPlayers = Array.from(finalPlayersMap.values());

      await updatePlayerFinal.updateData(playersFinalId, {
        ...baseFinalList,
        ...(contestId ? { contestId } : {}),
        players: finalPlayers,
      });
      setPlayersFinalList({
        ...baseFinalList,
        ...(contestId ? { contestId } : {}),
        players: finalPlayers,
      });
      setPlayersFinalArray(finalPlayers);
      setMessage({
        body: "그랑프리 명단이 중복 없이 성공적으로 저장되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("그랑프리 명단 저장 실패:", error);
      setMessage({
        body: "저장 중 오류가 발생했습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    }
  };

  useEffect(() => {
    if (!currentContest?.contests?.id) {
      return;
    }
    fetchPool(
      currentContest.contests.contestCategorysListId,
      currentContest.contests.contestGradesListId,
      currentContest.contests.contestPlayersFinalId
    );
  }, [
    currentContest?.contests?.id,
    currentContest?.contests?.contestCategorysListId,
    currentContest?.contests?.contestGradesListId,
    currentContest?.contests?.contestPlayersFinalId,
  ]);

  useEffect(() => {
    if (grandPrixArray.length > 0) {
      initPlayersFinalList(categoriesArray, gradesArray, grandPrixArray);
    } else {
      setMatchedArray([]);
    }
  }, [playersFinalArray, grandPrixArray, categoriesArray, gradesArray]);

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
                          currentContest?.contests?.id,
                          currentContest?.contests?.contestPlayersFinalId,
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
                                          <div
                                            key={`${gradeId}_${playerUid || playerNumber}_${pIdx}`}
                                            className="flex w-full h-10 border-b border-gray-300 items-center text-sm lg:px-2"
                                          >
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
