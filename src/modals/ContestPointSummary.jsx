"use client";

import React, { useContext, useEffect, useState, useRef, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Volume2,
  X,
} from "lucide-react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { useFirebaseRealtimeUpdateData } from "../hooks/useFirebaseRealtime";
import { Modal } from "@mui/material";
import { resolveEffectiveCollectionName } from "../components/monitoring/MonitoringDiagnosticsBar";
import { getStagePlayerSortIndex } from "../functions/functions";
import { db } from "../firebase";
import {
  isScoreEntered,
  getTrimCountPerSide,
  computeJudgeSeatNumbers,
  assignMinMaxAndCalculatePointTotal,
  playWarningSoundSafe,
} from "../utils/scoringEngine";
import { saveGradeResultsAtomically } from "../utils/contestResultsUtils";
import { isActiveStagePlayer } from "../utils/playerEntryUtils";

const ContestPointSummary = ({
  categoryId,
  gradeId,
  setClose,
  currentResultSaved,
  categoryJudgeType,
  stageId,
  expectedJudgeCount = 0,
  stagePlayers = [],
  categoryTitleProp = "",
  gradeTitleProp = "",
}) => {
  const [scoreData, setScoreData] = useState([]);
  const [summaryTable, setSummaryTable] = useState([]);
  const [isLoadingScores, setIsLoadingScores] = useState(true);
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

  void categoryJudgeType;
  void stageId;

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

  const scorePointQuery = useFirestoreQuery();

  const realtimeResultStateUpdate = useFirebaseRealtimeUpdateData();

  const generateUniqueRandomNumbers = (min, max, count) => {
    const numbers = Array.from({ length: max - min + 1 }, (_, i) => i + min);

    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    return numbers.slice(0, count);
  };

  // 전체 심판 좌석 번호 목록 계산 (설정된 심판제 인원이 있으면 해당 좌석 수 고정)
  const seatNumbers = useMemo(
    () => computeJudgeSeatNumbers(scoreData, expectedJudgeCount),
    [scoreData, expectedJudgeCount]
  );

  const groupedByPlayerNumber = (arr, seats, sortCriteria = "playerIndex") => {
    const mapByNum = new Map();

    (stagePlayers || []).forEach((sp) => {
      if (!isActiveStagePlayer(sp)) return;
      mapByNum.set(sp.playerNumber, {
        playerNumber: sp.playerNumber,
        playerIndex:
          getStagePlayerSortIndex(sp) || Number(sp.playerNumber) || 0,
        playerGym: sp.playerGym || "",
        playerName: sp.playerName || "",
        playerUid: sp.playerUid || "",
        rawBySeat: new Map(),
      });
    });

    arr.forEach((curr) => {
      let group = mapByNum.get(curr.playerNumber);
      if (!group) {
        group = {
          playerNumber: curr.playerNumber,
          playerIndex:
            getStagePlayerSortIndex(curr) || Number(curr.playerNumber) || 0,
          playerGym: curr.playerGym || "",
          playerName: curr.playerName || "",
          playerUid: curr.playerUid || "",
          rawBySeat: new Map(),
        };
        mapByNum.set(curr.playerNumber, group);
      }
      group.rawBySeat.set(Number(curr.seatIndex), curr);
    });

    const effectiveSeats =
      seats.length > 0
        ? seats
        : Array.from(
            new Set(arr.map((c) => Number(c.seatIndex)).filter(Boolean))
          ).sort((a, b) => a - b);

    const groupedObj = Array.from(mapByNum.values()).map((g) => {
      const alignedScores = effectiveSeats.map((seatNo) => {
        const found = g.rawBySeat.get(seatNo);
        const entered = found && isScoreEntered(found.playerScore);
        return {
          seatIndex: seatNo,
          playerScore: entered ? Number(found.playerScore) : null,
          playerPointArray: found?.playerPointArray || [],
          isMissing: !entered,
          randomIndex: generateUniqueRandomNumbers(11, 300, 1)[0],
          isMin: false,
          isMax: false,
        };
      });

      const playerObj = {
        playerNumber: g.playerNumber,
        playerIndex: g.playerIndex,
        playerGym: g.playerGym,
        playerName: g.playerName,
        playerUid: g.playerUid,
        score: alignedScores,
      };
      assignMinMaxAndCalculatePointTotal(playerObj);
      return playerObj;
    });

    // 점수형 순위 산정: 높은 합산이 상위 (순위제외 >= 1000 및 미채점 0점 선수는 하단 배치)
    groupedObj.sort((a, b) => {
      if (sortCriteria === "totalScore") {
        const aExcluded = a.totalScore >= 1000;
        const bExcluded = b.totalScore >= 1000;
        if (aExcluded !== bExcluded) return aExcluded ? 1 : -1;
        const aHasValid = a.score.some((s) => !s.isMissing);
        const bHasValid = b.score.some((s) => !s.isMissing);
        if (aHasValid !== bHasValid) return aHasValid ? -1 : 1;
        return b.totalScore - a.totalScore;
      }
      return a.playerIndex - b.playerIndex;
    });

    // 순위 부여
    let rank = 0;
    let prevScore = null;
    let sameRankCount = 0;
    let lastValidIdx = -1;

    for (let i = 0; i < groupedObj.length; i++) {
      groupedObj[i].isAlert = false;
      const hasAnySubmitted = groupedObj[i].score.some((s) => !s.isMissing);

      if (!hasAnySubmitted) {
        groupedObj[i].playerRank = null;
      } else if (groupedObj[i].totalScore >= 1000) {
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

    // 화면 표시는 선수 등번호(playerIndex) 순으로 고정하여 심판위원장이 찾기 쉽게 정렬
    groupedObj.sort((a, b) => a.playerIndex - b.playerIndex);

    return groupedObj;
  };

  const groupByGrade = (arr, seats, sortType) => {
    if ((!arr || arr.length === 0) && stagePlayers?.length > 0) {
      return [
        {
          contestId: currentContest?.contests?.id || "",
          categoryId: categoryId || "",
          categoryTitle: categoryTitleProp || "종목",
          scoreType: "point",
          gradeId: gradeId || "",
          gradeTitle: gradeTitleProp || "체급",
          result: groupedByPlayerNumber([], seats, sortType),
        },
      ];
    }

    return arr
      .reduce((acc, curr) => {
        let group = acc.find((g) => g.gradeId === curr.gradeId);

        if (!group) {
          group = {
            contestId: currentContest?.contests?.id || curr?.contestId,
            categoryId: curr.categoryId,
            categoryTitle: curr.categoryTitle || categoryTitleProp,
            scoreType: curr.categoryJudgeType || "point",
            gradeId: curr.gradeId,
            gradeTitle: curr.gradeTitle || gradeTitleProp,
            result: [],
          };
          acc.push(group);
        }

        return acc;
      }, [])
      .map((group) => {
        const gradeItems = arr.filter((item) => item.gradeId === group.gradeId);
        group.result = groupedByPlayerNumber(gradeItems, seats, sortType);
        return group;
      });
  };

  const handleSummaryTable = (targetPlayerNumber, e, summaryIndex) => {
    const rawValue = e.target.value;
    const parsedRank = rawValue === "" ? null : Number(rawValue);

    setSummaryTable((prev) => {
      const next = [...prev];
      const currentGroup = next[summaryIndex];
      if (!currentGroup) return prev;
      const updatedResult = currentGroup.result.map((item) =>
        item.playerNumber === targetPlayerNumber
          ? {
              ...item,
              playerRank: Number.isNaN(parsedRank) ? null : parsedRank,
            }
          : item
      );
      next[summaryIndex] = {
        ...currentGroup,
        result: updatedResult,
      };
      return next;
    });
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
      await saveGradeResultsAtomically({
        db,
        resultTables: resultData,
        fallbackContestId: currentContest?.contests?.id,
        includePointArray: true,
      });

      await handleRealtimeUpdate(currentContest.contests.id, gradeId);

      setIsSaveSuccess(true);
      setMessage({
        title: "순위표 최종 확정 완료",
        body: "점수형 순위 결과가 정상적으로 저장되었습니다.",
        body2:
          "본부석 · 사회자 프롬프터 · 전광판 집계 데이터에 즉시 반영되었습니다.",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error(error);
      setIsSaveSuccess(false);
      setMessage({
        title: "순위 저장 실패 — 확인 필요",
        body: "순위 결과를 저장하지 못했습니다.",
        body2: error?.message || "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
      });
      setMsgOpen(true);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const effectiveCollectionName = resolveEffectiveCollectionName(
    currentContest?.contestInfo,
    currentContest
  );

  const fetchScorePoint = async () => {
    if (!effectiveCollectionName || !currentContest?.contests?.id) {
      setIsLoadingScores(false);
      return;
    }

    setIsLoadingScores(true);
    const condition = [
      where("contestId", "==", currentContest.contests.id),
      where("categoryId", "==", categoryId),
      where("gradeId", "==", gradeId),
      where("categoryJudgeType", "==", "point"),
    ];

    try {
      const data = await scorePointQuery.getDocuments(
        effectiveCollectionName,
        condition
      );
      if (Array.isArray(data) && data.length > 0) {
        setScoreData(data.sort((a, b) => a.seatIndex - b.seatIndex));
      } else {
        setScoreData([]);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoadingScores(false);
    }
  };

  const getMissingJudgeSeats = (resultArray = []) => {
    const missingSeats = new Set();
    resultArray.forEach((player) => {
      (player.score || []).forEach((s) => {
        if (s.isMissing || !isScoreEntered(s.playerScore)) {
          missingSeats.add(s.seatIndex);
        }
      });
    });
    return Array.from(missingSeats).sort((a, b) => a - b);
  };

  useEffect(() => {
    if (gradeId && currentContest?.contests?.id) {
      fetchScorePoint();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId, categoryId, currentContest, effectiveCollectionName]);

  useEffect(() => {
    if (scoreData?.length > 0 || (!isLoadingScores && stagePlayers?.length > 0)) {
      const grouped = groupByGrade(scoreData, seatNumbers, "totalScore");
      setSummaryTable(() => [...grouped]);

      // 동점자 감지 시 경고 팝업 및 경고음 1회 자동 실행
      if (!hasWarnedDuplicateRef.current && scoreData?.length > 0) {
        const hasAnyDuplicate = grouped.some((table) =>
          hasDuplicateRanks(table.result)
        );
        if (hasAnyDuplicate) {
          playWarningSoundSafe();
          setDuplicateWarningOpen(true);
          hasWarnedDuplicateRef.current = true;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreData, seatNumbers, isLoadingScores]);

  // 전체 동점 선수 요약 텍스트 (모달 표시용)
  const allTiedPlayersSummary = useMemo(() => {
    const items = [];
    summaryTable.forEach((t) => {
      const validPlayers = (t.result || []).filter(
        (p) => p.totalScore < 1000 && isValidPlayerRank(p.playerRank)
      );
      const counts = {};
      validPlayers.forEach((p) => {
        counts[p.playerRank] = (counts[p.playerRank] || 0) + 1;
      });
      Object.entries(counts).forEach(([rk, cnt]) => {
        if (cnt > 1) {
          const tiedNums = validPlayers
            .filter((p) => String(p.playerRank) === String(rk))
            .map((p) => `#${p.playerNumber}번`)
            .join(", ");
          items.push(`${rk}위 동점 (${tiedNums})`);
        }
      });
    });
    return items;
  }, [summaryTable]);

  return (
    <div
      ref={modalContentRef}
      className="flex flex-col w-full h-full max-h-screen bg-[#fafafa] text-[#171717] overflow-y-auto select-none"
    >
      {/* 저장 성공 / 오류 알림 모달 */}
      <Modal open={msgOpen} onClose={() => setMsgOpen(false)}>
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-[#171717]/40 backdrop-blur-[2px]"
          style={{ transform: "none" }}
        >
          <div className="w-full max-w-md bg-white rounded-[16px] border border-[#171717]/[0.10] p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.16)] space-y-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border ${
                  isSaveSuccess
                    ? "bg-[#f0fdf4] border-[#bbf7d0] text-[#16a34a]"
                    : "bg-[#fef2f2] border-[#fecaca] text-[#dc2626]"
                }`}
              >
                {isSaveSuccess ? (
                  <CheckCircle2 size={20} strokeWidth={2.1} />
                ) : (
                  <AlertTriangle size={20} strokeWidth={2.1} />
                )}
              </div>
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#171717] m-0">
                  {message.title || "알림"}
                </h2>
                <p className="text-sm font-semibold text-[#262626] m-0">
                  {message.body}
                </p>
                {message.body2 && (
                  <p className="text-xs sm:text-sm font-medium text-[#525252] m-0 leading-relaxed">
                    {message.body2}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMsgOpen(false);
                if (isSaveSuccess) {
                  setClose(false);
                }
              }}
              className={`w-full h-10 px-5 rounded-[10px] text-white font-bold text-sm sm:text-base transition-colors cursor-pointer ${
                isSaveSuccess
                  ? "bg-[#2563eb] hover:bg-[#1d4ed8]"
                  : "bg-[#dc2626] hover:bg-[#b91c1c]"
              }`}
            >
              {isSaveSuccess ? "확인 (집계 화면으로 돌아가기)" : "확인"}
            </button>
          </div>
        </div>
      </Modal>

      {/* 1. 동점자 발생 경고 다이얼로그 */}
      <Modal
        open={duplicateWarningOpen}
        onClose={() => setDuplicateWarningOpen(false)}
      >
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-[#171717]/40 backdrop-blur-[2px]"
          style={{ transform: "none" }}
        >
          <div className="w-full max-w-md bg-white rounded-[16px] border border-[#171717]/[0.10] p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.16)] space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-[10px] bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] flex items-center justify-center shrink-0">
                <AlertTriangle size={20} strokeWidth={2.2} />
              </div>
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] text-xs font-bold">
                  <Volume2 size={12} strokeWidth={2.2} />
                  동점자 확인 필요
                </span>
                <h2 className="text-base sm:text-lg font-bold text-[#171717] m-0 pt-0.5">
                  동점 선수가 있습니다 — 최종순위를 조정해 주세요
                </h2>
              </div>
            </div>

            {allTiedPlayersSummary.length > 0 && (
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-[10px] px-3.5 py-2.5 space-y-0.5">
                <div className="text-xs font-semibold text-[#991b1b]">
                  감지된 동점 선수
                </div>
                {allTiedPlayersSummary.map((line, idx) => (
                  <div
                    key={idx}
                    className="text-sm sm:text-base font-bold text-[#dc2626] tabular-nums"
                  >
                    · {line}
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-[10px] px-3.5 py-3 text-xs sm:text-sm font-medium text-[#404040] space-y-1 leading-relaxed">
              <p className="m-0">
                1. 표에서 <strong className="text-[#dc2626]">붉게 표시된 행</strong>이 유효 합산 점수가 같은 동점 선수입니다.
              </p>
              <p className="m-0">
                2. 심판위원장 판정 기준에 따라 <strong className="text-[#1d4ed8]">[최종순위] 숫자를 서로 다르게 입력</strong>하신 뒤 확정해 주세요.
              </p>
            </div>

            <button
              type="button"
              className="w-full h-10 px-5 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm sm:text-base transition-colors cursor-pointer"
              onClick={() => setDuplicateWarningOpen(false)}
            >
              확인하고 동점 순위 조정하기
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
          className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-[#171717]/40 backdrop-blur-[2px]"
          style={{ transform: "none" }}
        >
          <div className="w-full max-w-md bg-white rounded-[16px] border border-[#171717]/[0.10] p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.16)] space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-[10px] bg-[#fef2f2] text-[#dc2626] border border-[#fecaca] flex items-center justify-center shrink-0">
                <AlertTriangle size={20} strokeWidth={2.2} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#171717] m-0">
                  동점자가 남아 있습니다
                </h2>
                <p className="text-xs sm:text-sm font-medium text-[#525252] mt-0.5 mb-0">
                  공동 순위(동점) 상태 그대로 확정하시겠습니까?
                </p>
              </div>
            </div>

            <div className="bg-[#fef2f2] border border-[#fecaca] rounded-[10px] px-3.5 py-3 text-xs sm:text-sm font-medium text-[#991b1b] leading-relaxed">
              동점자가 남아 있는 상태로 저장하면 전광판 순위 발표, 시상식 호명, 상장 출력에서 공동 순위로 처리됩니다.
            </div>

            <div className="flex flex-col gap-2 pt-0.5">
              <button
                type="button"
                className="w-full h-10 px-4 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm sm:text-base transition-colors cursor-pointer"
                onClick={() => setForceConfirmOpen(false)}
              >
                돌아가서 동점 순위 수정하기 (권장)
              </button>

              <button
                type="button"
                className="w-full h-9 px-4 rounded-[10px] bg-white hover:bg-[#fef2f2] border border-[#fca5a5] disabled:opacity-50 disabled:cursor-not-allowed text-[#dc2626] font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                disabled={isSaving}
                onClick={() => {
                  if (isSaving) return;
                  setForceConfirmOpen(false);
                  handleSaveResult(summaryTable);
                }}
              >
                {isSaving ? "저장 중..." : "공동 순위(동점) 상태로 강제 확정"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 상단 고정 헤더 바 */}
      <div className="sticky top-0 z-20 bg-white text-[#171717] border-b border-[#e4e4e7] px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-8 h-8 rounded-[8px] bg-[#eff6ff] border border-[#bfdbfe] flex items-center justify-center shrink-0">
            <ClipboardCheck size={17} strokeWidth={2} className="text-[#2563eb]" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#2563eb]">
              심판위원장 검수 화면 · 높은 합산이 상위 등수
            </div>
            <h1 className="text-base sm:text-lg font-bold text-[#171717] m-0 tracking-tight">
              점수형 순위 집계표
            </h1>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#d4d4d8] text-[#171717] font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
          onClick={() => setClose()}
        >
          <X size={15} strokeWidth={2} className="text-[#525252]" />
          <span>닫기</span>
        </button>
      </div>

      {/* 본문 영역 */}
      <div className="flex-1 p-4 sm:p-5 space-y-3.5 w-full max-w-[1360px] mx-auto">
        {!isLoadingScores && summaryTable?.length === 0 && (
          <div className="bg-white rounded-[12px] border border-[#fca5a5] p-6 text-center space-y-2">
            <AlertTriangle
              size={30}
              strokeWidth={1.9}
              className="text-[#dc2626] mx-auto"
            />
            <h2 className="text-base sm:text-lg font-bold text-[#dc2626] m-0">
              수신된 채점 데이터가 아직 없습니다
            </h2>
            <p className="text-xs sm:text-sm font-medium text-[#525252] m-0">
              심판석에서 채점표를 제출했는지 확인한 뒤 창을 닫고 다시 열어주세요.
            </p>
          </div>
        )}

        {summaryTable?.length > 0 &&
          summaryTable.map((table, tIdx) => {
            const { categoryTitle, gradeTitle, result } = table;
            const missingSeats = getMissingJudgeSeats(result);
            const hasMissingScores = missingSeats.length > 0;
            const hasDuplicates = hasDuplicateRanks(result);
            const hasInvalid = hasInvalidRanks(result);
            const hasAnyInvalid = summaryTable.some((t) =>
              hasInvalidRanks(t.result)
            );
            const hasAnyDuplicates = summaryTable.some((t) =>
              hasDuplicateRanks(t.result)
            );
            const hasAnyMissing = summaryTable.some(
              (t) => getMissingJudgeSeats(t.result).length > 0
            );

            const cannotConfirm =
              hasDuplicates ||
              hasInvalid ||
              hasAnyInvalid ||
              hasAnyDuplicates ||
              hasMissingScores ||
              hasAnyMissing ||
              isSaving;

            const duplicateRanks = Array.from(
              new Set(
                result
                  .filter(
                    (player) =>
                      player.totalScore < 1000 &&
                      isValidPlayerRank(player.playerRank)
                  )
                  .map((player) => player.playerRank)
                  .filter((rank, index, self) => self.indexOf(rank) !== index)
              )
            ).sort((a, b) => a - b);

            const tiedPlayerNumbers = result
              .filter(
                (p) =>
                  p.totalScore < 1000 && duplicateRanks.includes(p.playerRank)
              )
              .map((p) => `#${p.playerNumber}번(${p.playerRank}위)`);

            const headerSeats =
              seatNumbers.length > 0
                ? seatNumbers
                : (result[0]?.score || []).map((s) => s.seatIndex);

            const trimPerSide = getTrimCountPerSide(headerSeats.length);

            return (
              <div key={tIdx} className="space-y-3">
                {/* 1. 종목 · 체급 & 범례 카드 */}
                <div className="bg-white rounded-[12px] border border-[#e4e4e7] px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-[#f4f4f5] border border-[#d4d4d8] text-[#171717] font-bold text-xs sm:text-sm rounded-[6px]">
                      {categoryTitle}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-[#171717]">
                      {gradeTitle}
                    </span>
                    <span className="px-2 py-0.5 rounded-[5px] bg-[#eff6ff] border border-[#bfdbfe] text-[#1d4ed8] text-xs font-semibold">
                      {headerSeats.length}심제 ·{" "}
                      {trimPerSide > 0
                        ? `최고 ${trimPerSide} · 최저 ${trimPerSide} 제외 후 유효 ${
                            headerSeats.length - trimPerSide * 2
                          }심 합산`
                        : "전원 합산"}
                    </span>
                  </div>

                  {/* 시각 범례 */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#525252]">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[5px] bg-[#fafafa] border border-[#e4e4e7] text-[#171717]">
                      <span className="text-xs font-bold">85</span>
                      <span>유효 점수</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[5px] bg-[#fafafa] border border-[#e4e4e7] text-[#737373]">
                      <span className="line-through text-[#a1a1aa] font-semibold">
                        90
                      </span>
                      <span className="text-[11px] font-semibold">
                        최고·최저 제외
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[5px] bg-[#fef2f2] border border-[#fecaca] text-[#dc2626]">
                      <span className="font-bold">미채점</span>
                      <span>점수 누락</span>
                    </span>
                  </div>
                </div>

                {/* 2. 상태 메시지 배너 */}
                {hasMissingScores ? (
                  <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[10px] px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={18} strokeWidth={2.2} className="text-[#dc2626] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm sm:text-[15px] font-bold text-[#dc2626]">
                          심판 채점 누락 —{" "}
                          {missingSeats.map((s) => `${s}번`).join(", ")} 심판의 점수가 빠져 있습니다
                        </div>
                        <div className="text-xs sm:text-[13px] font-medium text-[#991b1b]">
                          표의 붉은색 [점수누락] 칸을 확인해 주세요. 전 좌석 점수가 들어와야 순위 확정이 가능합니다.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : hasDuplicates ? (
                  <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[10px] px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={18} strokeWidth={2.2} className="text-[#dc2626] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm sm:text-[15px] font-bold text-[#dc2626]">
                          동점자 발생 ({duplicateRanks.map((r) => `${r}위`).join(", ")} 동점) — 대상: {tiedPlayerNumbers.join(", ")}
                        </div>
                        <div className="text-xs sm:text-[13px] font-medium text-[#991b1b]">
                          강조된 행의 [최종순위] 숫자를 서로 다르게 조정하면 [순위표 최종 확정] 버튼이 활성화됩니다.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : hasInvalid ? (
                  <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[10px] px-4 py-3 flex items-start gap-2.5">
                    <AlertTriangle size={18} strokeWidth={2.2} className="text-[#dc2626] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm sm:text-[15px] font-bold text-[#dc2626]">
                        최종순위 미입력 선수가 있습니다
                      </div>
                      <div className="text-xs sm:text-[13px] font-medium text-[#991b1b]">
                        비어 있거나 잘못된 [최종순위] 칸에 1 이상의 순위 숫자를 입력해 주세요.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#f0fdf4] border border-[#86efac] rounded-[10px] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 size={18} strokeWidth={2.2} className="text-[#16a34a] shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-[#15803d]">
                          전 심판 채점 완료 · 동점자 없음 (확정 가능)
                        </div>
                        <div className="text-xs font-medium text-[#166534]">
                          점수 및 최종순위를 확인하신 후 우측 하단의 [순위표 최종 확정] 버튼을 눌러주세요.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. 채점 매트릭스 테이블 */}
                <div className="bg-white rounded-[12px] border border-[#e4e4e7] overflow-hidden w-full">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-center border-collapse">
                      <thead>
                        <tr className="bg-[#f4f4f5] text-[#171717] border-b border-[#d4d4d8]">
                          <th className="py-2.5 px-3 w-24 text-xs sm:text-sm font-bold border-r border-[#e4e4e7] whitespace-nowrap">
                            선수번호
                          </th>
                          <th className="py-2.5 px-3 w-32 text-xs sm:text-sm font-bold border-r border-[#d4d4d8] whitespace-nowrap bg-[#fafafa]">
                            최종순위
                          </th>
                          {headerSeats.map((seatNo) => {
                            const seatMissing = missingSeats.includes(seatNo);
                            return (
                              <th
                                key={seatNo}
                                className={`py-2.5 px-2 min-w-[74px] text-xs sm:text-sm font-bold border-r border-[#e4e4e7] whitespace-nowrap ${
                                  seatMissing
                                    ? "bg-[#fef2f2] text-[#dc2626]"
                                    : "text-[#3f3f46]"
                                }`}
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  <span>{seatNo}번 심판</span>
                                  {seatMissing && (
                                    <span className="px-1.5 py-0.5 rounded-[4px] bg-[#dc2626] text-white text-[10px] font-bold leading-none">
                                      미채점
                                    </span>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                          <th className="py-2.5 px-3 w-28 text-xs sm:text-sm font-bold bg-[#eff6ff] text-[#1d4ed8] border-l border-[#bfdbfe] whitespace-nowrap">
                            유효 점수합산
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#e4e4e7]">
                        {result?.length > 0 &&
                          result.map((player) => {
                            const {
                              playerNumber,
                              playerName,
                              totalScore,
                              playerRank,
                              score,
                              isAlert,
                            } = player;

                            const isExcludedFromRank = totalScore >= 1000;
                            if (isExcludedFromRank) {
                              return (
                                <tr
                                  key={playerNumber}
                                  className="bg-[#fafafa] text-[#737373]"
                                >
                                  <td className="py-2.5 px-3 border-r border-[#e4e4e7]">
                                    <span className="inline-flex items-center justify-center min-w-[48px] h-8 px-2 rounded-[7px] font-mono tabular-nums text-sm sm:text-base font-bold bg-[#f4f4f5] border border-[#d4d4d8] text-[#737373]">
                                      {playerNumber}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 border-r border-[#d4d4d8]">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] bg-[#f4f4f5] border border-[#d4d4d8] text-xs font-semibold text-[#737373]">
                                      순위제외
                                    </span>
                                  </td>
                                  {score.map((s) => (
                                    <td
                                      key={s.seatIndex}
                                      className="py-2.5 px-2 border-r border-[#e4e4e7]"
                                    >
                                      <span className="text-xs font-semibold text-[#a1a1aa]">
                                        {s.playerScore >= 1000
                                          ? "순위제외"
                                          : s.playerScore ?? "-"}
                                      </span>
                                    </td>
                                  ))}
                                  <td className="py-2.5 px-3 bg-[#f4f4f5] border-l border-[#d4d4d8]">
                                    <span className="text-xs sm:text-sm font-semibold text-[#737373]">
                                      제외
                                    </span>
                                  </td>
                                </tr>
                              );
                            }

                            const rowHasMissing = (score || []).some(
                              (s) => s.isMissing || !isScoreEntered(s.playerScore)
                            );
                            const isRankInvalid = !isValidPlayerRank(playerRank);
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
                                    ? "bg-[#fef2f2]/70 hover:bg-[#fef2f2] transition-colors"
                                    : rowHasMissing
                                    ? "bg-[#fffbeb]/60 hover:bg-[#fffbeb] transition-colors"
                                    : "bg-white hover:bg-[#fafafa] transition-colors"
                                }
                              >
                                {/* 선수 번호 */}
                                <td
                                  className={`py-2.5 px-3 border-r border-[#e4e4e7] ${
                                    needsTieBreak
                                      ? "border-l-4 border-l-[#dc2626]"
                                      : ""
                                  }`}
                                >
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span
                                      className={`inline-flex items-center justify-center min-w-[48px] h-8 px-2 rounded-[7px] font-mono tabular-nums text-sm sm:text-base font-bold tracking-tight border ${
                                        needsTieBreak
                                          ? "bg-[#dc2626] border-[#dc2626] text-white"
                                          : "bg-[#fafafa] border-[#d4d4d8] text-[#171717]"
                                      }`}
                                    >
                                      {playerNumber}
                                    </span>
                                    {playerName && (
                                      <span className="text-[11px] font-medium text-[#525252] truncate max-w-[84px]">
                                        {playerName}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* 최종 순위 입력칸 */}
                                <td
                                  className={`py-2.5 px-2.5 border-r border-[#d4d4d8] ${
                                    needsTieBreak
                                      ? "bg-[#fef2f2]"
                                      : "bg-[#fafafa]/70"
                                  }`}
                                >
                                  <div className="flex flex-col items-center justify-center gap-1">
                                    <div className="inline-flex items-center gap-1">
                                      <input
                                        type="number"
                                        name="playerRank"
                                        min={1}
                                        step={1}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) =>
                                          handleSummaryTable(
                                            playerNumber,
                                            e,
                                            tIdx
                                          )
                                        }
                                        className={
                                          needsTieBreak
                                            ? "w-14 h-9 bg-white border-2 border-[#dc2626] rounded-[8px] text-center font-mono tabular-nums font-extrabold text-[#dc2626] text-base sm:text-lg outline-none"
                                            : playerRank === 1
                                            ? "w-14 h-9 bg-[#eff6ff] hover:bg-white focus:bg-white border border-[#2563eb] rounded-[8px] text-center font-mono tabular-nums font-extrabold text-[#1d4ed8] text-base sm:text-lg outline-none"
                                            : "w-14 h-9 bg-white hover:bg-[#fafafa] focus:bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[8px] text-center font-mono tabular-nums font-bold text-[#171717] text-base sm:text-lg outline-none"
                                        }
                                        value={
                                          playerRank === null ||
                                          playerRank === undefined ||
                                          Number.isNaN(playerRank)
                                            ? ""
                                            : playerRank
                                        }
                                      />
                                      <span
                                        className={`text-xs sm:text-sm font-semibold ${
                                          needsTieBreak
                                            ? "text-[#dc2626]"
                                            : "text-[#525252]"
                                        }`}
                                      >
                                        위
                                      </span>
                                    </div>

                                    {isRankDuplicated && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] bg-[#dc2626] text-white text-[11px] font-bold">
                                        <AlertTriangle
                                          size={12}
                                          strokeWidth={2.3}
                                        />
                                        동점 · 순위 수정
                                      </span>
                                    )}
                                    {isRankInvalid && !rowHasMissing && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] bg-[#dc2626] text-white text-[11px] font-bold">
                                        순위 미입력
                                      </span>
                                    )}
                                    {!needsTieBreak && isAlert && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[5px] bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] text-[11px] font-semibold">
                                        동점 조정됨
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* 심사위원 좌석별 점수 셀 */}
                                {score.map((s) => {
                                  const {
                                    seatIndex,
                                    playerScore,
                                    isMin,
                                    isMax,
                                    isMissing,
                                  } = s;

                                  if (isMissing || !isScoreEntered(playerScore)) {
                                    return (
                                      <td
                                        key={seatIndex}
                                        className="py-2.5 px-1.5 border-r border-[#e4e4e7] bg-[#fef2f2]"
                                      >
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] bg-white border border-[#fca5a5] text-[#dc2626] text-xs font-bold">
                                          점수누락
                                        </span>
                                      </td>
                                    );
                                  }

                                  if (isMin || isMax) {
                                    return (
                                      <td
                                        key={seatIndex}
                                        className="py-2 px-1.5 border-r border-[#e4e4e7] bg-[#fafafa]"
                                      >
                                        <div className="inline-flex flex-col items-center justify-center min-w-[54px] px-1.5 py-0.5 rounded-[6px] bg-[#f4f4f5]/80 border border-[#e4e4e7]">
                                          <span className="font-mono tabular-nums text-xs sm:text-sm font-semibold line-through text-[#a1a1aa]">
                                            {playerScore >= 1000
                                              ? "제외"
                                              : playerScore}
                                          </span>
                                          <span className="text-[10px] font-medium text-[#737373] leading-tight">
                                            {isMax ? "최고제외" : "최저제외"}
                                          </span>
                                        </div>
                                      </td>
                                    );
                                  }

                                  return (
                                    <td
                                      key={seatIndex}
                                      className="py-2.5 px-2 border-r border-[#e4e4e7]"
                                    >
                                      <span className="font-mono tabular-nums font-bold text-[#171717] text-base sm:text-[17px]">
                                        {playerScore >= 1000
                                          ? "순위제외"
                                          : playerScore}
                                      </span>
                                    </td>
                                  );
                                })}

                                {/* 유효 점수합산 */}
                                <td
                                  className={
                                    needsTieBreak
                                      ? "py-2.5 px-3 bg-[#fef2f2] border-l border-[#fca5a5]"
                                      : "py-2.5 px-3 bg-[#eff6ff]/50 border-l border-[#bfdbfe]"
                                  }
                                >
                                  <div className="flex flex-col items-center justify-center">
                                    <span
                                      className={
                                        needsTieBreak
                                          ? "font-mono tabular-nums font-extrabold text-[#dc2626] text-base sm:text-lg"
                                          : "font-mono tabular-nums font-extrabold text-[#1d4ed8] text-base sm:text-lg"
                                      }
                                    >
                                      {rowHasMissing ? "미완료" : totalScore}
                                    </span>
                                    {needsTieBreak && !rowHasMissing && (
                                      <span className="mt-0.5 px-1.5 py-0.5 rounded-[4px] bg-[#dc2626] text-white text-[10px] font-bold leading-none">
                                        동점 합산
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. 하단 확정 액션 바 */}
                <div
                  className={`flex flex-col lg:flex-row items-center justify-between gap-3 px-4 py-3 rounded-[12px] border ${
                    cannotConfirm
                      ? "bg-[#fef2f2] border-[#fca5a5]"
                      : "bg-white border-[#e4e4e7]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {hasMissingScores || hasAnyMissing ? (
                      <>
                        <AlertTriangle
                          size={18}
                          strokeWidth={2.2}
                          className="text-[#dc2626] shrink-0"
                        />
                        <span className="text-xs sm:text-sm font-bold text-[#dc2626]">
                          미채점 심판석({missingSeats.map((s) => `${s}번`).join(", ")})이 남아 있어 아직 확정할 수 없습니다
                        </span>
                      </>
                    ) : hasInvalid || hasAnyInvalid ? (
                      <>
                        <AlertTriangle
                          size={18}
                          strokeWidth={2.2}
                          className="text-[#dc2626] shrink-0"
                        />
                        <span className="text-xs sm:text-sm font-bold text-[#dc2626]">
                          최종순위가 비어 있는 선수가 있습니다. 1 이상의 순위를 입력해 주세요
                        </span>
                      </>
                    ) : hasDuplicates || hasAnyDuplicates ? (
                      <>
                        <AlertTriangle
                          size={18}
                          strokeWidth={2.2}
                          className="text-[#dc2626] shrink-0"
                        />
                        <span className="text-xs sm:text-sm font-bold text-[#dc2626]">
                          동점자({tiedPlayerNumbers.join(", ")})의 최종순위를 서로 다르게 수정해야 확정됩니다
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2
                          size={18}
                          strokeWidth={2.2}
                          className="text-[#16a34a] shrink-0"
                        />
                        <span className="text-xs sm:text-sm font-semibold text-[#171717]">
                          점수 검수가 완료되었습니다. [순위표 최종 확정] 시 전광판 및 공식 기록에 즉시 반영됩니다.
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                    {hasDuplicates &&
                      !hasInvalid &&
                      !hasAnyInvalid &&
                      !hasMissingScores &&
                      !hasAnyMissing && (
                        <button
                          type="button"
                          className="h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#fef2f2] disabled:opacity-50 disabled:cursor-not-allowed text-[#dc2626] font-semibold text-xs sm:text-sm border border-[#fca5a5] transition-colors cursor-pointer"
                          disabled={isSaving}
                          onClick={() => !isSaving && setForceConfirmOpen(true)}
                        >
                          공동 순위(동점) 강제 등록
                        </button>
                      )}

                    <button
                      type="button"
                      className={
                        cannotConfirm
                          ? "h-10 px-5 rounded-[8px] bg-[#e4e4e7] text-[#737373] font-bold text-xs sm:text-sm cursor-not-allowed"
                          : "h-10 px-5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm sm:text-base shadow-xs transition-colors active:scale-[0.99] cursor-pointer"
                      }
                      onClick={() =>
                        !cannotConfirm && handleSaveResult(summaryTable)
                      }
                      disabled={cannotConfirm}
                    >
                      {isSaving ? "저장 처리 중..." : "순위표 최종 확정"}
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

export default ContestPointSummary;
