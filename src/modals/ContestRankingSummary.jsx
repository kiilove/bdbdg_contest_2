"use client";

import React, { useContext, useEffect, useState, useRef } from "react";
import { AlertTriangle, ClipboardCheck, X } from "lucide-react";
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
import { BibTag } from "../components/ui/BibTag";

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
  const [isSaving, setIsSaving] = useState(false);
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);
  const isSavingRef = useRef(false);
  const modalContentRef = useRef(null);

  const { currentContest } = useContext(CurrentContestContext);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  // 동점자 감지 경고 및 강제등록 확인 모달 상태
  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
  const [forceConfirmOpen, setForceConfirmOpen] = useState(false);
  const hasWarnedDuplicateRef = useRef(false);

  // 경고음 재생
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

    // 제외되지 않은 유효 5개 점수만 합산 (심판이 순위제외(>=1000) 부여 시 제외 상태 반영)
    const activeScores = group.score.filter((s) => !s.isMin && !s.isMax);
    if (activeScores.some((s) => Number(s.playerScore) >= 1000)) {
      group.totalScore = Math.max(
        1000,
        activeScores.reduce(
          (acc, curr) => acc + Number(curr.playerScore || 0),
          0
        )
      );
    } else {
      group.totalScore = activeScores.reduce(
        (acc, curr) => acc + Number(curr.playerScore || 0),
        0
      );
    }
  };

  const groupedByPlayerNumber = (arr, sortCriteria = "playerIndex") => {
    const groupedObj = arr.reduce((acc, curr) => {
      let group = acc.find((g) => g.playerNumber === curr.playerNumber);
      const scoreItem = {
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
      group.score.push(scoreItem);
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
    let lastValidIdx = -1;

    for (let i = 0; i < groupedObj.length; i++) {
      groupedObj[i].isAlert = false;

      if (groupedObj[i].totalScore >= 1000) {
        groupedObj[i].playerRank = 1000;
      } else {
        if (prevScore === null || groupedObj[i].totalScore !== prevScore) {
          rank += sameRankCount + 1;
          sameRankCount = 0;
        } else {
          sameRankCount++;
          groupedObj[i].isAlert = true;
          if (lastValidIdx >= 0) {
            groupedObj[lastValidIdx].isAlert = true;
          }
        }
        groupedObj[i].playerRank = rank;
        prevScore = groupedObj[i].totalScore;
        lastValidIdx = i;
      }
    }

    return groupedObj;
  };

  const groupByGrade = (arr, sortType) => {
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
    const rawValue = e.target.value;
    const parsedRank = rawValue === "" ? null : Number(rawValue);

    const newDataArray = [...dataArray];
    const newRankInfo = {
      ...newDataArray[playerIndex],
      playerRank: Number.isNaN(parsedRank) ? null : parsedRank,
    };
    newDataArray.splice(playerIndex, 1, newRankInfo);
    const newSummaryTable = [...summaryTable];
    newSummaryTable.splice(summaryIndex, 1, {
      ...newSummaryTable[summaryIndex],
      result: [...newDataArray],
    });

    setSummaryTable(() => [...newSummaryTable]);
  };

  const handleDeleteResult = async (contestId, targetGradeId) => {
    const condition = [
      where("contestId", "==", contestId),
      where("gradeId", "==", targetGradeId),
    ];

    const returnQuery = await resultQuery.getDocuments(
      "contest_results_list",
      condition
    );

    if (!returnQuery || returnQuery.length === 0) {
      return;
    }

    const deleteResults = await Promise.all(
      returnQuery.map((result) => resultDelete.deleteData(result.id))
    );

    if (deleteResults.some((ok) => !ok)) {
      throw new Error("기존 순위 결과 삭제 중 오류가 발생했습니다");
    }
  };

  const handleRealtimeUpdate = async (contestId, targetGradeId = gradeId) => {
    const collectionInfo = `currentStage/${contestId}`;
    const base = Array.isArray(currentResultSaved) ? currentResultSaved : [];
    const newResultSaved =
      targetGradeId && !base.includes(targetGradeId)
        ? [...base, targetGradeId]
        : base;

    const updated = await realtimeResultStateUpdate.updateData(collectionInfo, {
      resultSaved: newResultSaved,
    });

    if (!updated) {
      throw new Error("실시간 순위 확정 상태 업데이트에 실패했습니다");
    }
  };

  const handleSaveResult = async (resultData) => {
    if (!resultData || resultData.length === 0) {
      return;
    }
    if (isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);

    try {
      for (const data of resultData) {
        const { contestId, gradeId: itemGradeId } = data;
        await handleDeleteResult(contestId, itemGradeId);
      }

      const addedDocs = await Promise.all(
        resultData.map((data) => resultAdd.addData({ ...data }))
      );

      if (addedDocs.some((doc) => !doc)) {
        throw new Error("순위 결과 저장 중 오류가 발생했습니다");
      }

      await handleRealtimeUpdate(currentContest.contests.id, gradeId);

      setIsSaveSuccess(true);
      setMessage({
        body: "저장되었습니다",
        body2: "확인 버튼을 누르시면 모니터링 화면으로 돌아갑니다",
        isButton: true,
        cancelButtonText: "되돌아가기",
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error(error);
      setIsSaveSuccess(false);
      setMessage({
        body: "저장에 실패했습니다",
        body2: error?.message || "잠시 후 다시 시도해 주세요",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
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

  const isValidPlayerRank = (rank) =>
    typeof rank === "number" &&
    Number.isInteger(rank) &&
    rank >= 1 &&
    rank < 1000;

  const hasInvalidRanks = (resultArray = []) => {
    return resultArray
      .filter((player) => player.totalScore < 1000)
      .some((player) => !isValidPlayerRank(player.playerRank));
  };

  const hasDuplicateRanks = (resultArray = []) => {
    const ranks = resultArray
      .filter(
        (player) =>
          player.totalScore < 1000 && isValidPlayerRank(player.playerRank)
      )
      .map((player) => player.playerRank);

    const rankSet = new Set(ranks);
    return ranks.length !== rankSet.size;
  };

  useEffect(() => {
    if (gradeId && currentContest?.contests?.id) {
      fetchScoreRank();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId, categoryId, currentContest]);

  useEffect(() => {
    if (scoreData?.length > 0) {
      const grouped = groupByGrade(scoreData, "totalScore");
      setSummaryTable(() => [...grouped]);

      // 동점자 감지 시 경고 팝업 및 경고음 1회 자동 실행
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreData]);

  return (
    <div
      ref={modalContentRef}
      className="flex flex-col w-full h-full max-h-screen bg-[#fafafa] text-[#171717] overflow-y-auto"
    >
      <ConfirmationModal
        isOpen={msgOpen}
        message={message}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => {
          setMsgOpen(false);
          if (isSaveSuccess) {
            setClose(false);
          }
        }}
      />

      {/* 1. 동점자 발생 안내 다이얼로그 */}
      <Modal
        open={duplicateWarningOpen}
        onClose={() => setDuplicateWarningOpen(false)}
      >
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/50"
          style={{ transform: "none" }}
        >
          <div className="w-full max-w-md bg-white rounded-[14px] border border-[#171717]/15 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.12)] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-[#dc2626]/[0.08] border border-[#dc2626]/20 flex items-center justify-center shrink-0">
                <AlertTriangle
                  size={18}
                  strokeWidth={1.5}
                  className="text-[#dc2626]"
                />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#171717] m-0">
                  동점자 순위 조정이 필요합니다
                </h2>
                <p className="text-xs text-[#525252] mt-1 mb-0">
                  기표 합산이 동일한 선수가 감지되었습니다
                </p>
              </div>
            </div>

            <div className="bg-[#f4f4f5] border border-[#171717]/[0.08] rounded-[8px] p-3.5 text-xs text-[#525252] space-y-1.5 leading-5">
              <p className="m-0 text-[#171717] font-medium">처리 안내</p>
              <p className="m-0">
                1. 중복된 순위 입력란이 붉은색으로 표시됩니다.
              </p>
              <p className="m-0">
                2. 심판 규정에 따라 순위 숫자를 직접 입력하여 중복을 해소한 뒤
                순위표를 확정해 주세요.
              </p>
            </div>

            <button
              type="button"
              className="w-full h-10 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-sm transition-colors active:scale-[0.98] cursor-pointer"
              onClick={() => setDuplicateWarningOpen(false)}
            >
              확인 후 순위 입력하기
            </button>
          </div>
        </div>
      </Modal>

      {/* 2. 강제등록 최종 확인 다이얼로그 */}
      <Modal
        open={forceConfirmOpen}
        onClose={() => setForceConfirmOpen(false)}
      >
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/50"
          style={{ transform: "none" }}
        >
          <div className="w-full max-w-md bg-white rounded-[14px] border border-[#171717]/15 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.12)] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-[#dc2626]/[0.08] border border-[#dc2626]/20 flex items-center justify-center shrink-0">
                <AlertTriangle
                  size={18}
                  strokeWidth={1.5}
                  className="text-[#dc2626]"
                />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#171717] m-0">
                  동점 상태 강제 등록 확인
                </h2>
                <p className="text-xs text-[#525252] mt-1 mb-0">
                  중복된 순위가 해소되지 않았습니다
                </p>
              </div>
            </div>

            <div className="bg-[#dc2626]/[0.06] border border-[#dc2626]/20 rounded-[8px] p-3.5 text-xs text-[#171717] leading-5">
              동점자가 남아 있는 상태로 저장하면 전광판 순위 발표, 시상식 명단,
              상장 출력에서 순위 충돌이 발생할 수 있습니다.
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                className="w-full h-10 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-sm transition-colors active:scale-[0.98] cursor-pointer"
                onClick={() => setForceConfirmOpen(false)}
              >
                돌아가서 순위 수정하기 (권장)
              </button>

              <button
                type="button"
                className="w-full h-9 px-4 rounded-[8px] bg-white hover:bg-[#dc2626]/[0.06] border border-[#dc2626]/30 disabled:opacity-50 disabled:cursor-not-allowed text-[#dc2626] font-medium text-xs transition-colors cursor-pointer"
                disabled={isSaving}
                onClick={() => {
                  if (isSaving) return;
                  setForceConfirmOpen(false);
                  handleSaveResult(summaryTable);
                }}
              >
                {isSaving ? "저장 중..." : "동점 상태로 강제 등록"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 상단 고정 헤더 바 */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#171717]/[0.08] px-5 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <ClipboardCheck
            size={18}
            strokeWidth={1.5}
            className="text-[#525252]"
          />
          <h1 className="text-base font-semibold text-[#171717] m-0">
            랭킹형 순위 집계표
          </h1>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] font-medium text-sm transition-colors cursor-pointer"
          onClick={() => setClose()}
        >
          <X size={16} strokeWidth={1.5} className="text-[#525252]" />
          <span>닫기</span>
        </button>
      </div>

      {/* 본문 영역 */}
      <div className="flex-1 p-4 sm:p-6 space-y-4 w-full max-w-[1440px] mx-auto">
        {summaryTable?.length > 0 &&
          summaryTable.map((table, tIdx) => {
            const { categoryTitle, gradeTitle, result } = table;
            const hasDuplicates = hasDuplicateRanks(result);
            const hasInvalid = hasInvalidRanks(result);
            const hasAnyInvalid = summaryTable.some((t) =>
              hasInvalidRanks(t.result)
            );
            const hasAnyDuplicates = summaryTable.some((t) =>
              hasDuplicateRanks(t.result)
            );
            const cannotConfirm =
              hasDuplicates ||
              hasInvalid ||
              hasAnyInvalid ||
              hasAnyDuplicates ||
              isSaving;
            const duplicateRanks = result
              .filter(
                (player) =>
                  player.totalScore < 1000 &&
                  isValidPlayerRank(player.playerRank)
              )
              .map((player) => player.playerRank)
              .filter((rank, index, self) => self.indexOf(rank) !== index);

            return (
              <div key={tIdx} className="space-y-4">
                {/* 체급 정보 카드 */}
                <div className="flex flex-wrap items-center justify-between bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-5 py-3.5 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-[#f4f4f5] text-[#171717] font-medium text-xs rounded-[6px] border border-[#171717]/[0.08]">
                      {categoryTitle}
                    </span>
                    <span className="text-sm font-semibold text-[#171717]">
                      {gradeTitle}
                    </span>
                  </div>
                  <div className="text-xs text-[#737373]">
                    최고·최저 점수를 제외한 유효 5심 합산 (낮은 합산이 상위)
                  </div>
                </div>

                {/* 채점 매트릭스 테이블 */}
                <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden w-full">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-center border-collapse">
                      <thead>
                        <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] text-[#525252] text-xs font-medium">
                          <th className="py-3 px-3 w-24">선수번호</th>
                          <th className="py-3 px-3 w-28">최종순위</th>
                          {result[0]?.score?.length > 0 &&
                            result[0].score.map((score) => (
                              <th
                                key={score.seatIndex}
                                className="py-3 px-2 font-medium text-[#525252] text-xs min-w-[56px]"
                              >
                                {score.seatIndex}번
                              </th>
                            ))}
                          <th className="py-3 px-3 w-24 text-[#171717]">
                            기표합산
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#171717]/[0.06] text-sm">
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
                              const isRankInvalid =
                                !isValidPlayerRank(playerRank);
                              const isRankDuplicated =
                                !isRankInvalid &&
                                duplicateRanks.includes(playerRank);
                              const needsTieBreak =
                                isRankInvalid || isRankDuplicated;

                              return (
                                <tr
                                  key={playerNumber}
                                  className={
                                    needsTieBreak
                                      ? "bg-[#dc2626]/[0.04] hover:bg-[#dc2626]/[0.07] transition-colors"
                                      : "hover:bg-[#fafafa] transition-colors"
                                  }
                                >
                                  {/* 선수 번호 */}
                                  <td className="py-2.5 px-3">
                                    <BibTag
                                      number={playerNumber}
                                      className={
                                        needsTieBreak
                                          ? "!border-[#dc2626]/50 !text-[#dc2626] !bg-[#dc2626]/[0.08]"
                                          : ""
                                      }
                                    />
                                  </td>

                                  {/* 순위 입력창 */}
                                  <td className="py-2.5 px-3">
                                    <div className="inline-flex items-center justify-center gap-1.5">
                                      <input
                                        type="number"
                                        name="playerRank"
                                        min={1}
                                        step={1}
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
                                          needsTieBreak
                                            ? "w-14 h-8 bg-white border border-[#dc2626] rounded-[6px] text-center font-mono tabular-nums font-semibold text-[#dc2626] text-sm outline-none"
                                            : "w-14 h-8 bg-[#f4f4f5] hover:bg-white focus:bg-white border border-[#171717]/15 focus:border-[#2563eb] rounded-[6px] text-center font-mono tabular-nums font-medium text-[#171717] text-sm outline-none transition-colors"
                                        }
                                        value={
                                          playerRank === null ||
                                          playerRank === undefined ||
                                          Number.isNaN(playerRank)
                                            ? ""
                                            : playerRank
                                        }
                                      />
                                      {isRankDuplicated && (
                                        <span className="px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.1] text-[#dc2626] text-[10px] font-medium">
                                          동점
                                        </span>
                                      )}
                                      {!needsTieBreak && isAlert && (
                                        <span className="px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#737373] text-[10px]">
                                          조정됨
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
                                        className="py-2.5 px-2"
                                      >
                                        {isMin || isMax ? (
                                          <div className="inline-flex flex-col items-center justify-center px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.06] leading-tight">
                                            <span className="font-mono tabular-nums text-xs line-through text-[#737373]">
                                              {playerScore >= 1000
                                                ? "제외"
                                                : playerScore}
                                            </span>
                                            <span className="text-[10px] text-[#737373] mt-0.5">
                                              {isMin ? "최고제외" : "최저제외"}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="font-mono tabular-nums font-medium text-[#171717] text-sm">
                                            {playerScore >= 1000
                                              ? "-"
                                              : playerScore}
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}

                                  {/* 기표합산 */}
                                  <td
                                    className={
                                      needsTieBreak
                                        ? "py-2.5 px-3 bg-[#dc2626]/[0.06]"
                                        : "py-2.5 px-3 bg-[#f4f4f5]/50"
                                    }
                                  >
                                    <span
                                      className={
                                        needsTieBreak
                                          ? "font-mono tabular-nums font-semibold text-[#dc2626] text-base"
                                          : "font-mono tabular-nums font-semibold text-[#2563eb] text-base"
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  {hasInvalid || hasAnyInvalid ? (
                    <div className="flex items-center gap-2 text-[#dc2626] font-medium text-xs sm:text-sm">
                      <AlertTriangle size={16} strokeWidth={1.5} />
                      <span>
                        유효하지 않은 순위가 있습니다. 1 이상의 정수로 입력해
                        주세요
                      </span>
                    </div>
                  ) : hasDuplicates ? (
                    <div className="flex items-center gap-2 text-[#dc2626] font-medium text-xs sm:text-sm">
                      <AlertTriangle size={16} strokeWidth={1.5} />
                      <span>
                        동점자가 존재합니다. 순위를 조정한 후 확정해 주세요
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-[#737373]">
                      순위표 확정 시 전광판 및 결과 집계에 즉시 반영됩니다
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                    {hasDuplicates && !hasInvalid && !hasAnyInvalid && (
                      <button
                        type="button"
                        className="h-10 px-4 rounded-[8px] bg-white hover:bg-[#dc2626]/[0.06] disabled:opacity-50 disabled:cursor-not-allowed text-[#dc2626] font-medium text-xs sm:text-sm border border-[#dc2626]/30 transition-colors cursor-pointer"
                        disabled={isSaving}
                        onClick={() => !isSaving && setForceConfirmOpen(true)}
                      >
                        강제 등록
                      </button>
                    )}
                    <button
                      type="button"
                      className={
                        cannotConfirm
                          ? "h-10 px-5 rounded-[8px] bg-[#f4f4f5] text-[#737373] font-medium text-sm cursor-not-allowed border border-[#171717]/[0.08]"
                          : "h-10 px-5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-sm transition-colors active:scale-[0.98] cursor-pointer"
                      }
                      onClick={() =>
                        !cannotConfirm && handleSaveResult(summaryTable)
                      }
                      disabled={cannotConfirm}
                    >
                      {isSaving ? "저장 중..." : "순위표 확정"}
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
