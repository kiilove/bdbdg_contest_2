"use client";

import { useContext, useEffect, useState, useRef } from "react";
import { TbHeartRateMonitor } from "react-icons/tb";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { useFirebaseRealtimeUpdateData } from "../hooks/useFirebaseRealtime";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { Modal } from "@mui/material";

const ContestRankingSummary = ({
  categoryId,
  gradeId,
  setClose,
  currentResultSaved,
  categoryJudgeType,
  stageId,
}) => {
  const [scoreData, setScoreData] = useState([]);
  const [summaryTable, setSummaryTable] = useState([]);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const modalContentRef = useRef(null);

  const { currentContest } = useContext(CurrentContestContext);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  // 🚨 동점자 감지 강력 경고 및 강제등록 확인 모달 상태
  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
  const [forceConfirmOpen, setForceConfirmOpen] = useState(false);
  const hasWarnedDuplicateRef = useRef(false);

  // 🔔 경고음 재생
  const playWarningSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {}
  };

  const scoreRankingQuery = useFirestoreQuery();
  const resultQuery = useFirestoreQuery();
  const resultDelete = useFirestoreDeleteData("contest_results_list");
  const resultAdd = useFirestoreAddData("contest_results_list");

  const realtimeResultStateUpdate = useFirebaseRealtimeUpdateData();

  const generateUniqueRandomNumbers = (min, max, count) => {
    const numbers = Array.from({ length: max - min + 1 }, (_, i) => i + min);

    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    return numbers.slice(0, count);
  };

  const assignMinMaxAndCalculateTotal = (group) => {
    const N = group.score.length;
    // 제외 개수: 5심제=0개, 7심제=1개, 9심제=2개 (최종 5명 점수 사용)
    const trimCount = Math.floor(Math.max(0, N - 5) / 2);

    group.score.forEach((s) => {
      s.isMin = false;
      s.isMax = false;
    });

    if (trimCount > 0) {
      // 등수(랭킹) 기준 오름차순 정렬 (참조 유지)
      const sorted = [...group.score].sort(
        (a, b) => a.playerScore - b.playerScore
      );

      // 가장 좋은 등수(가장 작은 숫자) trimCount개 제외 -> isMin = true
      for (let i = 0; i < trimCount; i++) {
        sorted[i].isMin = true;
      }

      // 가장 안 좋은 등수(가장 큰 숫자) trimCount개 제외 -> isMax = true
      for (let i = N - trimCount; i < N; i++) {
        sorted[i].isMax = true;
      }
    }

    // 제외되지 않은 유효 5개 점수만 합산
    group.totalScore = group.score
      .filter((s) => !s.isMin && !s.isMax)
      .reduce((acc, curr) => acc + curr.playerScore, 0);
  };

  const groupedByPlayerNumber = (arr, sortCriteria = "playerIndex") => {
    const groupedObj = arr.reduce((acc, curr) => {
      let group = acc.find((g) => g.playerNumber === curr.playerNumber);
      const scoreData = {
        seatIndex: curr.seatIndex,
        playerScore: curr.playerScore,
        randomIndex: generateUniqueRandomNumbers(11, 300, 1)[0],
        isMin: false,
        isMax: false,
      };

      if (!group) {
        group = {
          playerNumber: curr.playerNumber,
          playerIndex: curr.playerIndex,
          playerGym: curr.playerGym,
          playerName: curr.playerName,
          playerUid: curr.playerUid,
          score: [],
        };
        acc.push(group);
      }
      group.score.push(scoreData);
      return acc;
    }, []);

    groupedObj.forEach((group) => {
      assignMinMaxAndCalculateTotal(group);
    });

    groupedObj.sort((a, b) =>
      sortCriteria === "totalScore"
        ? a.totalScore - b.totalScore
        : a.playerIndex - b.playerIndex
    );

    let rank = 0;
    let prevScore = null;
    let sameRankCount = 0;
    let isAlertSet = false;

    for (let i = 0; i < groupedObj.length; i++) {
      groupedObj[i].isAlert = false;

      if (groupedObj[i].totalScore > 1000) {
        groupedObj[i].playerRank = 1000;
      } else {
        if (prevScore === null || groupedObj[i].totalScore !== prevScore) {
          if (sameRankCount >= 1) {
            for (let j = 0; j <= sameRankCount; j++) {
              groupedObj[i - j - 1].isAlert = true;
            }
          }
          rank += sameRankCount + 1;
          sameRankCount = 0;
          isAlertSet = false;
        } else {
          sameRankCount++;
          groupedObj[i].isAlert = true;
        }
        groupedObj[i].playerRank = rank;
        prevScore = groupedObj[i].totalScore;
      }
    }

    if (sameRankCount >= 1) {
      for (let j = 0; j <= sameRankCount; j++) {
        groupedObj[groupedObj.length - 1 - j].isAlert = true;
      }
    }

    return groupedObj;
  };

  const groupByGrade = (arr, sortType) => {
    console.log(arr);
    return arr
      .reduce((acc, curr) => {
        let group = acc.find((g) => g.gradeId === curr.gradeId);

        if (!group) {
          group = {
            contestId: curr.contestId,
            categoryId: curr.categoryId,
            categoryTitle: curr.categoryTitle,
            scoreType: curr.categoryJudgeType,
            gradeId: curr.gradeId,
            gradeTitle: curr.gradeTitle,
            result: [],
          };
          acc.push(group);
        }

        return acc;
      }, [])
      .map((group) => {
        const gradeItems = arr.filter((item) => item.gradeId === group.gradeId);
        group.result = groupedByPlayerNumber(gradeItems, sortType);
        return group;
      });
  };

  const handleSummaryTable = (dataArray, e, summaryIndex, playerIndex) => {
    const newDataArray = [...dataArray];
    const newRankInfo = {
      ...newDataArray[playerIndex],
      playerRank: Number.parseInt(e.target.value),
    };
    newDataArray.splice(playerIndex, 1, newRankInfo);
    const newSummaryTable = [...summaryTable];
    newSummaryTable.splice(summaryIndex, 1, {
      ...newSummaryTable[summaryIndex],
      result: [...newDataArray],
    });

    setSummaryTable(() => [...newSummaryTable]);
  };

  const handleDeleteResult = async (contestId, gradeId) => {
    const condition = [
      where("contestId", "==", contestId),
      where("gradeId", "==", gradeId),
    ];

    try {
      const returnQuery = await resultQuery.getDocuments(
        "contest_results_list",
        condition
      );
      console.log(returnQuery);

      if (returnQuery?.length === 0) {
        return;
      }

      returnQuery.map(async (result, rIdx) => {
        const { id } = result;
        await resultDelete.deleteData(id).then((data) => console.log(data));
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleRealtimeUpdate = async (contestId, gradeId) => {
    const collectionInfo = `currentStage/${contestId}`;

    const newResultSaved = currentResultSaved ? [...currentResultSaved] : [];

    const gradeExists = newResultSaved.includes(gradeId);

    if (!gradeExists) {
      newResultSaved.push(gradeId);
    }

    await realtimeResultStateUpdate.updateData(collectionInfo, {
      resultSaved: newResultSaved,
    });

    console.log("Updated resultSaved array:", newResultSaved);
  };

  const handleUpdateStageAssign = async (stageAssignId) => {
    if (!stageAssignId) {
      return;
    }

    try {
    } catch (error) {}
  };

  const handleSaveResult = async (resultData) => {
    if (resultData?.length === 0) {
      return;
    }
    try {
      resultData.map(async (data, dIdx) => {
        const { contestId, gradeId } = data;

        await handleDeleteResult(contestId, gradeId);
        try {
          await resultAdd
            .addData({ ...data })
            .then((data) => console.log(data));
        } catch (error) {
          console.log(error);
        }
      });
    } catch (error) {
      console.log(error);
    } finally {
      await handleRealtimeUpdate(currentContest.contests.id, gradeId).then(
        () => {
          setMessage({
            body: "저장되었습니다.",
            body2: "확인 버튼을 누르시면 모니터링화면으로 돌아갑니다.",
            isButton: true,
            cancelButtonText: "되돌아가기",
            confirmButtonText: "확인",
          });
          setMsgOpen(true);
        }
      );
    }
  };

  const fetchScoreRank = async () => {
    const condition = [
      where("contestId", "==", currentContest.contests.id),
      where("categoryId", "==", categoryId),
      where("gradeId", "==", gradeId),
      where("categoryJudgeType", "==", "ranking"),
    ];

    try {
      await scoreRankingQuery
        .getDocuments(
          currentContest.contestInfo.contestCollectionName,
          condition
        )
        .then((data) => {
          if (data.length > 0) {
            setScoreData(data.sort((a, b) => a.seatIndex - b.seatIndex));
          }
        });
    } catch (error) {
      console.log(error);
    }
  };

  const hasDuplicateRanks = (resultArray) => {
    const ranks = resultArray
      .filter((player) => player.totalScore < 1000)
      .map((player) => player.playerRank);

    const rankSet = new Set(ranks);
    return ranks.length !== rankSet.size;
  };

  useEffect(() => {
    if (gradeId && currentContest?.contests?.id) {
      fetchScoreRank();
    }
  }, [gradeId, categoryId, currentContest]);

  useEffect(() => {
    if (scoreData?.length > 0) {
      console.log(groupByGrade(scoreData, "totalScore"));
      const grouped = groupByGrade(scoreData, "totalScore");
      setSummaryTable(() => [...grouped]);

      // 🚨 동점자 감지 시 강력 경고 팝업 및 경고음 1회 자동 실행
      if (!hasWarnedDuplicateRef.current) {
        const hasAnyDuplicate = grouped.some((table) =>
          hasDuplicateRanks(table.result)
        );
        if (hasAnyDuplicate) {
          playWarningSound();
          setDuplicateWarningOpen(true);
          hasWarnedDuplicateRef.current = true;
        }
      }
    }
  }, [scoreData]);

  return (
    <div
      ref={modalContentRef}
      className="flex flex-col w-full h-full max-h-screen bg-gradient-to-br from-slate-50 to-slate-100 overflow-y-auto"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "#3b82f6 #e2e8f0",
      }}
    >
      <ConfirmationModal
        isOpen={msgOpen}
        message={message}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setClose(false)}
      />

      {/* 🚨 1. 동점자 발생 강력 경고 모달 */}
      <Modal
        open={duplicateWarningOpen}
        onClose={() => setDuplicateWarningOpen(false)}
      >
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/70 backdrop-blur-sm"
          style={{ transform: "none" }}
        >
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border-4 border-amber-500 overflow-hidden animate-bounce-short">
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 p-6 text-white text-center relative">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-md mb-2 shadow-inner">
                <span className="text-3xl animate-bounce">⚠️</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white m-0">
                동점자 발생 경고!
              </h2>
              <p className="text-amber-100 text-sm md:text-base mt-1 font-semibold">
                동일한 등수를 받은 선수가 감지되었습니다
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-center">
                <p className="text-red-900 text-base font-bold m-0">
                  순위표에서 동점인 선수의 순위(등수)를<br />
                  <span className="text-red-600 underline underline-offset-4 font-black">직접 수정한 후 확정</span>해 주시기 바랍니다.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs md:text-sm text-slate-600 space-y-1">
                <p className="m-0 font-semibold flex items-center gap-1 text-slate-700">
                  <span>💡</span> 동점자 처리 방법 안내:
                </p>
                <p className="m-0 pl-4">
                  1. 중복된 순위 입력란에 <strong className="text-red-500">붉은 테두리 및 느낌표(!)</strong>가 표시됩니다.
                </p>
                <p className="m-0 pl-4">
                  2. 심판 규정 및 심사위원 합의에 따라 순위 숫자를 직접 입력하여 중복을 해소하세요.
                </p>
              </div>

              <button
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-lg shadow-xl shadow-amber-500/30 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
                onClick={() => setDuplicateWarningOpen(false)}
              >
                <span>확인 및 순위 수정하기</span>
                <span>➔</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ⚠️ 2. 강제등록 2차 최종 확인 경고 모달 */}
      <Modal
        open={forceConfirmOpen}
        onClose={() => setForceConfirmOpen(false)}
      >
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/80 backdrop-blur-md"
          style={{ transform: "none" }}
        >
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border-4 border-red-600 overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 via-rose-700 to-red-800 p-6 text-white text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-md mb-2 shadow-inner">
                <span className="text-4xl animate-pulse">🚨</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white m-0">
                강제등록 최종 확인
              </h2>
              <p className="text-red-200 text-sm md:text-base mt-1 font-semibold">
                정말로 동점자를 무시하고 등록하시겠습니까?
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 text-center">
                <p className="text-red-950 text-sm md:text-base font-bold m-0 leading-relaxed">
                  ⚠️ 동점자가 처리되지 않은 상태로 강제 등록하면<br />
                  <strong className="text-red-600 underline">전광판 순위 발표, 시상식 명단, 상장 출력</strong> 등에서<br />
                  심각한 오류 및 충돌이 발생할 수 있습니다.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-lg shadow-xl shadow-blue-500/30 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
                  onClick={() => setForceConfirmOpen(false)}
                >
                  <span>❌ 취소하고 순위 다시 수정하기 (권장)</span>
                </button>

                <button
                  className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors cursor-pointer border-none opacity-90 hover:opacity-100 flex items-center justify-center gap-1.5"
                  onClick={() => {
                    setForceConfirmOpen(false);
                    handleSaveResult(summaryTable);
                  }}
                >
                  <span>⚠️ 위험을 감수하고 강제등록 진행</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* 깔끔한 상단 헤더 바 */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 py-2.5">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <TbHeartRateMonitor className="text-lg" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 m-0 tracking-tight">
                랭킹형 순위 집계표
              </h1>
            </div>
          </div>
          <button
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors cursor-pointer border-none"
            onClick={() => setClose()}
          >
            닫기
          </button>
        </div>
      </div>

      {/* 테이블 본문 - 가로 100% 꽉 채움 */}
      <div className="flex-1 p-2 sm:p-3 space-y-3 w-full">
        {summaryTable?.length > 0 &&
          summaryTable.map((table, tIdx) => {
            const { categoryTitle, gradeTitle, result } = table;
            const hasDuplicates = hasDuplicateRanks(result);
            const duplicateRanks = result
              .filter((player) => player.totalScore < 1000)
              .map((player) => player.playerRank)
              .filter((rank, index, self) => self.indexOf(rank) !== index);

            return (
              <div key={tIdx} className="space-y-3">
                {/* 체급 헤더 */}
                <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 font-bold text-xs sm:text-sm rounded border border-blue-200">
                      {categoryTitle}
                    </span>
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 font-bold text-xs sm:text-sm rounded border border-slate-200">
                      {gradeTitle}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    * 최고·최저 점수를 제외한 5명의 점수가 합산됩니다.
                  </div>
                </div>

                {/* 정갈하고 시인성 높은 100% 풀 와이드 테이블 */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden w-full">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-center border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold text-xs sm:text-sm">
                          <th className="py-2.5 px-2 w-16 sm:w-20">선수번호</th>
                          <th className="py-2.5 px-2 w-16 sm:w-20">최종순위</th>
                          {result[0]?.score?.length > 0 &&
                            result[0].score.map((score) => (
                              <th
                                key={score.seatIndex}
                                className="py-2.5 px-1 font-semibold text-slate-600 text-xs min-w-[45px]"
                              >
                                {score.seatIndex}번
                              </th>
                            ))}
                          <th className="py-2.5 px-2 w-20 text-blue-700 bg-blue-50/50">
                            기표합산
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                        {result?.length > 0 &&
                          result
                            .sort((a, b) => a.playerIndex - b.playerIndex)
                            .map((player, pIdx) => {
                              const {
                                playerNumber,
                                totalScore,
                                playerRank,
                                score,
                                isAlert,
                              } = player;
                              if (totalScore >= 1000) {
                                return null;
                              }
                              const isRankDuplicated =
                                duplicateRanks.includes(playerRank);

                              const isHighlightRow = isRankDuplicated || isAlert;

                              return (
                                <tr
                                  key={playerNumber}
                                  className={
                                    isHighlightRow
                                      ? "bg-amber-100/85 border-y-2 border-amber-400 font-semibold hover:bg-amber-100 transition-colors"
                                      : "hover:bg-slate-50/80 transition-colors"
                                  }
                                >
                                  {/* 선수 번호 */}
                                  <td className="py-2 px-2">
                                    <span
                                      className={
                                        isHighlightRow
                                          ? "inline-flex items-center justify-center px-2 py-0.5 bg-red-600 text-white font-black text-xs sm:text-sm rounded shadow-sm ring-2 ring-red-300 animate-pulse"
                                          : "inline-flex items-center justify-center px-2 py-0.5 bg-slate-800 text-white font-extrabold text-xs sm:text-sm rounded shadow-sm"
                                      }
                                    >
                                      {playerNumber}
                                    </span>
                                  </td>

                                  {/* 순위 입력창 */}
                                  <td className="py-2 px-2">
                                    <div className="relative inline-block">
                                      <input
                                        type="number"
                                        name="playerRank"
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) =>
                                          handleSummaryTable(
                                            result,
                                            e,
                                            tIdx,
                                            pIdx
                                          )
                                        }
                                        className={
                                          isRankDuplicated
                                            ? "w-11 sm:w-12 h-8 sm:h-9 bg-red-50 border-2 border-red-500 rounded text-center font-black text-red-600 text-sm outline-none ring-1 ring-red-200"
                                            : isAlert
                                            ? "w-11 sm:w-12 h-8 sm:h-9 bg-amber-50 border-2 border-amber-400 rounded text-center font-bold text-amber-900 text-sm outline-none"
                                            : "w-11 sm:w-12 h-8 sm:h-9 bg-slate-50 hover:bg-white border border-slate-300 focus:border-blue-500 focus:bg-white rounded text-center font-bold text-slate-800 text-sm outline-none transition-all"
                                        }
                                        value={playerRank}
                                      />
                                      {isRankDuplicated && (
                                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-black">
                                          !
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* 심사위원 점수 리스트 */}
                                  {score.map((s) => {
                                    const {
                                      seatIndex,
                                      playerScore,
                                      isMin,
                                      isMax,
                                    } = s;
                                    return (
                                      <td
                                        key={seatIndex}
                                        className="py-2 px-1"
                                      >
                                        {isMin && (
                                          <div className="inline-flex flex-col items-center justify-center px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 leading-none">
                                            <span className="font-bold text-xs line-through text-blue-400">
                                              {playerScore >= 100
                                                ? "제외"
                                                : playerScore}
                                            </span>
                                            <span className="text-[8px] font-semibold text-blue-600 mt-0.5">
                                              최고제외
                                            </span>
                                          </div>
                                        )}
                                        {isMax && (
                                          <div className="inline-flex flex-col items-center justify-center px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 leading-none">
                                            <span className="font-bold text-xs line-through text-rose-400">
                                              {playerScore >= 100
                                                ? "제외"
                                                : playerScore}
                                            </span>
                                            <span className="text-[8px] font-semibold text-rose-600 mt-0.5">
                                              최저제외
                                            </span>
                                          </div>
                                        )}
                                        {!isMax && !isMin && (
                                          <span className="font-bold text-slate-800 text-sm sm:text-base">
                                            {playerScore >= 100
                                              ? "-"
                                              : playerScore}
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}

                                  {/* 기표합산 (총점) */}
                                  <td
                                    className={
                                      isHighlightRow
                                        ? "py-2 px-2 bg-amber-200/50"
                                        : "py-2 px-2 bg-blue-50/30"
                                    }
                                  >
                                    <span
                                      className={
                                        isHighlightRow
                                          ? "font-black text-amber-950 text-base sm:text-lg"
                                          : "font-black text-blue-600 text-base sm:text-lg"
                                      }
                                    >
                                      {totalScore}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 하단 확정 액션 바 */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                  {hasDuplicates ? (
                    <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs sm:text-sm">
                      <span className="text-base">⚠️</span>
                      <span>동점자가 존재합니다. 순위를 수정한 후 확정해 주세요.</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 font-medium">
                      순위표 확정 시 전광판 및 결과 집계에 즉시 반영됩니다.
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                    {hasDuplicates && (
                      <button
                        className="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs sm:text-sm border border-red-200 transition-colors cursor-pointer"
                        onClick={() => setForceConfirmOpen(true)}
                      >
                        ⚠️ 강제등록 (위험)
                      </button>
                    )}
                    <button
                      className={
                        hasDuplicates
                          ? "px-6 py-2.5 rounded-lg bg-slate-200 text-slate-400 font-bold text-sm sm:text-base cursor-not-allowed border-none"
                          : "px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-sm sm:text-base shadow-md shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer border-none"
                      }
                      onClick={() =>
                        !hasDuplicates && handleSaveResult(summaryTable)
                      }
                      disabled={hasDuplicates}
                    >
                      순위표 확정
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default ContestRankingSummary;
