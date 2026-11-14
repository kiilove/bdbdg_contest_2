import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
  writeBatch,
} from "firebase/firestore";
import { ref, update } from "firebase/database";
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  KeyRound,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { db, database } from "../firebase";
import {
  applyEmergencyJudgeSeatSwap,
  normalizeSectionName,
  sortJudgesByName,
} from "../utils/judgeAssignUtils";

const LiveJudgeSwapModal = ({
  isOpen,
  onClose,
  targetSeat,
  contestId,
  judgesAssignDocId,
  effectiveCollectionName,
  currentStageInfo,
  realtimeData,
  judgesPoolMap = {},
  judgesArray = [],
  stagesArray = [],
  categoriesArray = [],
  gradesArray = [],
  normalScoreData = [],
  onSwapSuccess,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // "all" | "standby" | "seated"
  const [selectedJudgeUid, setSelectedJudgeUid] = useState("");
  const [swapMode, setSwapMode] = useState("replace"); // "replace" | "exchange"
  const [scope, setScope] = useState("current_stage"); // "current_stage" | "section_remaining"
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const seatNumber = Number(targetSeat?.seatIndex || 0);
  const currentJudgeUid = targetSeat?.judge?.judgeUid || "";
  const currentJudgeName = targetSeat?.judge?.judgeName || "";
  const currentJudgePin = targetSeat?.judge?.onedayPassword || "";

  // 현재 무대에 배정된 좌석 맵 (judgeUid -> seatIndex[])
  const seatedSeatsByUid = useMemo(() => {
    const map = new Map();
    const list = Array.isArray(realtimeData?.judges) ? realtimeData.judges : [];
    list.forEach((j, idx) => {
      const uid = j?.judgeUid;
      if (!uid) return;
      const sNum = Number(j?.seatIndex || idx + 1);
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid).push(sNum);
    });
    return map;
  }, [realtimeData?.judges]);

  // 전체 심판 풀 후보 정규화 (심판 풀 + 혹시 배정표에만 존재하는 심판 보강)
  const poolCandidates = useMemo(() => {
    const byUid = new Map();
    Object.values(judgesPoolMap || {}).forEach((item) => {
      if (!item?.judgeUid) return;
      byUid.set(item.judgeUid, {
        judgeUid: item.judgeUid,
        judgeName: item.judgeName || "이름 미상",
        judgeOrganization: item.judgeGym || item.judgePromoter || "",
        onedayPassword: item.onedayPassword ?? null,
        isHead: Boolean(item.isHead),
      });
    });

    (Array.isArray(judgesArray) ? judgesArray : []).forEach((row) => {
      if (!row?.judgeUid || byUid.has(row.judgeUid)) return;
      byUid.set(row.judgeUid, {
        judgeUid: row.judgeUid,
        judgeName: row.judgeName || "이름 미상",
        judgeOrganization: row.judgePromoter || "",
        onedayPassword: row.onedayPassword ?? null,
        isHead: Boolean(row.isHead),
      });
    });

    const all = sortJudgesByName(Array.from(byUid.values()));

    // 대기 심판 우선 → 타 좌석 배정 심판 → 현재 좌석 본인 순 정렬
    return all.sort((a, b) => {
      const aIsSelf = a.judgeUid === currentJudgeUid ? 2 : 0;
      const bIsSelf = b.judgeUid === currentJudgeUid ? 2 : 0;
      if (aIsSelf !== bIsSelf) return aIsSelf - bIsSelf;

      const aSeated = seatedSeatsByUid.has(a.judgeUid) ? 1 : 0;
      const bSeated = seatedSeatsByUid.has(b.judgeUid) ? 1 : 0;
      if (aSeated !== bSeated) return aSeated - bSeated;

      return (a.judgeName || "").localeCompare(b.judgeName || "", "ko", {
        sensitivity: "base",
        numeric: true,
      });
    });
  }, [judgesPoolMap, judgesArray, currentJudgeUid, seatedSeatsByUid]);

  const standbyCount = useMemo(
    () =>
      poolCandidates.filter(
        (c) => !seatedSeatsByUid.has(c.judgeUid) && c.judgeUid !== currentJudgeUid
      ).length,
    [poolCandidates, seatedSeatsByUid, currentJudgeUid]
  );

  const otherSeatedCount = useMemo(
    () =>
      poolCandidates.filter((c) => {
        if (c.judgeUid === currentJudgeUid) return false;
        const seats = seatedSeatsByUid.get(c.judgeUid) || [];
        return seats.some((s) => s !== seatNumber);
      }).length,
    [poolCandidates, seatedSeatsByUid, currentJudgeUid, seatNumber]
  );

  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm("");
    setFilterMode("all");
    setSelectedJudgeUid("");
    setSwapMode("replace");
    setScope("current_stage");
    setErrorMsg("");
  }, [isOpen, seatNumber]);

  const selectedJudge = useMemo(
    () => poolCandidates.find((c) => c.judgeUid === selectedJudgeUid) || null,
    [poolCandidates, selectedJudgeUid]
  );

  const selectedJudgeOtherSeats = useMemo(() => {
    if (!selectedJudge) return [];
    return (seatedSeatsByUid.get(selectedJudge.judgeUid) || []).filter(
      (s) => s !== seatNumber
    );
  }, [selectedJudge, seatedSeatsByUid, seatNumber]);

  const partnerSeatIndex =
    selectedJudgeOtherSeats.length > 0 ? selectedJudgeOtherSeats[0] : null;

  // 타 좌석에 배정된 심판을 선택하면 기본적으로 1:1 좌석 맞교체 권장
  useEffect(() => {
    if (partnerSeatIndex) {
      setSwapMode("exchange");
    } else {
      setSwapMode("replace");
    }
  }, [partnerSeatIndex, selectedJudgeUid]);

  const filteredCandidates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return poolCandidates.filter((c) => {
      if (filterMode === "standby") {
        if (seatedSeatsByUid.has(c.judgeUid) || c.judgeUid === currentJudgeUid) {
          return false;
        }
      } else if (filterMode === "seated") {
        const seats = (seatedSeatsByUid.get(c.judgeUid) || []).filter(
          (s) => s !== seatNumber
        );
        if (seats.length === 0) return false;
      }

      if (!q) return true;
      const nameMatch = (c.judgeName || "").toLowerCase().includes(q);
      const orgMatch = (c.judgeOrganization || "").toLowerCase().includes(q);
      const pinMatch = String(c.onedayPassword || "")
        .toLowerCase()
        .includes(q);
      return nameMatch || orgMatch || pinMatch;
    });
  }, [
    poolCandidates,
    filterMode,
    searchTerm,
    seatedSeatsByUid,
    currentJudgeUid,
    seatNumber,
  ]);

  const currentSectionInfo = useMemo(() => {
    const catObj = (categoriesArray || []).find(
      (c) => c?.contestCategoryId === currentStageInfo?.categoryId
    );
    const sectionName = normalizeSectionName(
      currentStageInfo?.categorySection || catObj?.contestCategorySection
    );
    const curStageNum = Number(
      currentStageInfo?.stageNumber ?? realtimeData?.stageNumber ?? 0
    );

    const remainingStages = (stagesArray || []).filter((st) => {
      if (!st || st.stageId === currentStageInfo?.stageId) return false;
      if (Number(st.stageNumber || 0) <= curStageNum) return false;
      const stCat = (categoriesArray || []).find(
        (c) => c?.contestCategoryId === st.categoryId
      );
      const stSec = normalizeSectionName(
        st.categorySection || stCat?.contestCategorySection
      );
      return stSec === sectionName;
    });

    return {
      sectionName,
      remainingCount: remainingStages.length,
      totalSectionRemainingCount: 1 + remainingStages.length,
    };
  }, [
    categoriesArray,
    currentStageInfo?.categoryId,
    currentStageInfo?.categorySection,
    currentStageInfo?.stageId,
    currentStageInfo?.stageNumber,
    realtimeData?.stageNumber,
    stagesArray,
  ]);

  const currentStageGradeIds = useMemo(() => {
    if (
      Array.isArray(currentStageInfo?.grades) &&
      currentStageInfo.grades.length > 0
    ) {
      return currentStageInfo.grades
        .map((g) => g?.gradeId || g?.contestGradeId)
        .filter(Boolean);
    }
    if (
      Array.isArray(realtimeData?.stageGrades) &&
      realtimeData.stageGrades.length > 0
    ) {
      return realtimeData.stageGrades
        .map((g) => g?.gradeId || g?.contestGradeId)
        .filter(Boolean);
    }
    return realtimeData?.gradeId ? [realtimeData.gradeId] : [];
  }, [
    currentStageInfo?.grades,
    realtimeData?.stageGrades,
    realtimeData?.gradeId,
  ]);

  const affectedSeatsPreview = useMemo(() => {
    if (swapMode === "exchange" && partnerSeatIndex) {
      return [seatNumber, partnerSeatIndex];
    }
    return [seatNumber];
  }, [swapMode, partnerSeatIndex, seatNumber]);

  const seatsWithSubmittedScores = useMemo(() => {
    if (!Array.isArray(normalScoreData) || normalScoreData.length === 0) {
      return [];
    }
    const gradeSet = new Set(currentStageGradeIds);
    return affectedSeatsPreview.filter((sNum) =>
      normalScoreData.some(
        (docItem) =>
          Number(docItem?.seatIndex) === Number(sNum) &&
          (!docItem?.gradeId || gradeSet.size === 0 || gradeSet.has(docItem.gradeId)) &&
          docItem?.playerScore !== undefined &&
          docItem?.playerScore !== null &&
          docItem?.playerScore !== 0
      )
    );
  }, [normalScoreData, currentStageGradeIds, affectedSeatsPreview]);

  if (!isOpen || !seatNumber) return null;

  const handleConfirmSwap = async () => {
    if (!selectedJudge || submitting) return;
    if (selectedJudge.judgeUid === currentJudgeUid) {
      setErrorMsg("현재 이미 이 좌석에 배정되어 있는 심판입니다.");
      return;
    }
    if (!contestId) {
      setErrorMsg("대회 식별자(contestId)를 확인할 수 없습니다.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const now = Date.now();
      const stageContext =
        currentStageInfo?.stageId
          ? currentStageInfo
          : {
              stageId: realtimeData?.stageId || "",
              stageNumber: realtimeData?.stageNumber || 1,
              categoryId: realtimeData?.categoryId || "",
              categoryTitle: realtimeData?.categoryTitle || "",
              categoryJudgeCount: Number(
                realtimeData?.stageJudgeCount ||
                  (realtimeData?.judges || []).length ||
                  5
              ),
              gradeId: realtimeData?.gradeId || "",
              gradeTitle: realtimeData?.gradeTitle || "",
              grades:
                Array.isArray(realtimeData?.stageGrades) &&
                realtimeData.stageGrades.length > 0
                  ? realtimeData.stageGrades
                  : undefined,
            };

      let finalSwapResult = null;

      // 1. Firestore contest_judges_assign 원자적 트랜잭션 업데이트
      if (judgesAssignDocId) {
        const assignRef = doc(db, "contest_judges_assign", judgesAssignDocId);
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(assignRef);
          const remoteData = snap.exists() ? snap.data() || {} : {};
          const baseJudges = Array.isArray(remoteData.judges)
            ? remoteData.judges
            : judgesArray;

          finalSwapResult = applyEmergencyJudgeSeatSwap({
            judges: baseJudges,
            categories: categoriesArray,
            grades: gradesArray,
            stages: stagesArray,
            currentStage: stageContext,
            seatIndex: seatNumber,
            replacementJudge: selectedJudge,
            scope,
            swapMode: partnerSeatIndex ? swapMode : "replace",
            partnerSeatIndex,
            currentRealtimeJudges: realtimeData?.judges || [],
            contestId,
            timestamp: now,
          });

          if (snap.exists()) {
            transaction.update(assignRef, {
              judges: finalSwapResult.nextJudgesAssign,
              updatedAt: new Date(now).toISOString(),
            });
          } else {
            transaction.set(assignRef, {
              contestId,
              judges: finalSwapResult.nextJudgesAssign,
              updatedAt: new Date(now).toISOString(),
            });
          }
        });
      } else {
        finalSwapResult = applyEmergencyJudgeSeatSwap({
          judges: judgesArray,
          categories: categoriesArray,
          grades: gradesArray,
          stages: stagesArray,
          currentStage: stageContext,
          seatIndex: seatNumber,
          replacementJudge: selectedJudge,
          scope,
          swapMode: partnerSeatIndex ? swapMode : "replace",
          partnerSeatIndex,
          currentRealtimeJudges: realtimeData?.judges || [],
          contestId,
          timestamp: now,
        });
      }

      // 2. 현재 무대에서 교체 대상 좌석이 이미 제출했던 이전 심판 채점표 정리 (집계표 잔상 방지)
      let clearedScoreDocsCount = 0;
      if (
        effectiveCollectionName &&
        finalSwapResult.currentStageGradeIds.length > 0
      ) {
        const affectedSeatSet = new Set(
          finalSwapResult.affectedSeats.map((s) => Number(s))
        );
        const docsToDelete = [];

        for (const gid of finalSwapResult.currentStageGradeIds) {
          if (!gid) continue;
          const scoreSnap = await getDocs(
            query(
              collection(db, effectiveCollectionName),
              where("gradeId", "==", gid)
            )
          );
          scoreSnap.docs.forEach((docSnap) => {
            const d = docSnap.data();
            if (affectedSeatSet.has(Number(d?.seatIndex))) {
              docsToDelete.push(docSnap.ref);
            }
          });
        }

        if (docsToDelete.length > 0) {
          const batch = writeBatch(db);
          docsToDelete.forEach((docRef) => batch.delete(docRef));
          await batch.commit();
          clearedScoreDocsCount = docsToDelete.length;
        }
      }

      // 3. RTDB currentStage/{contestId} 즉시 동기화 (태블릿 대기화면 자동 퇴출 및 새 심판 이름/비밀번호 반영)
      const rtdbUpdates = {
        judges: finalSwapResult.nextRealtimeJudges,
      };

      // 이미 확정 처리되었던 체급이라면 재채점 후 다시 확정할 수 있도록 resultSaved에서 현재 체급 제거
      if (Array.isArray(realtimeData?.resultSaved)) {
        const currentGradeSet = new Set(finalSwapResult.currentStageGradeIds);
        rtdbUpdates.resultSaved = realtimeData.resultSaved.filter(
          (gid) => !currentGradeSet.has(gid)
        );
      }

      // 비교심사 투표 진행 중이었다면 교체된 좌석 투표 상태도 초기화
      if (realtimeData?.compares?.status?.compareStart) {
        finalSwapResult.affectedSeats.forEach((sNum) => {
          rtdbUpdates[`compares/judges/${Number(sNum) - 1}`] = {
            seatIndex: Number(sNum),
            messageStatus: "확인전",
            votedPlayerNumber: [],
          };
        });
      }

      await update(ref(database, `currentStage/${contestId}`), rtdbUpdates);

      if (typeof onSwapSuccess === "function") {
        onSwapSuccess({
          seatIndex: seatNumber,
          partnerSeatIndex: finalSwapResult.isSeatExchange
            ? partnerSeatIndex
            : null,
          isSeatExchange: finalSwapResult.isSeatExchange,
          replacementJudge: selectedJudge,
          outgoingJudge: finalSwapResult.outgoingJudge,
          scope,
          affectedStagesCount: finalSwapResult.affectedStagesCount,
          clearedScoreDocsCount,
        });
      }
      onClose();
    } catch (err) {
      console.error("[LiveJudgeSwapModal] 심판 긴급 변경 실패:", err);
      setErrorMsg(
        err?.message || "심판 변경을 저장하는 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-[14px] border border-[#171717]/10 shadow-[0_24px_60px_rgba(0,0,0,0.22)] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="px-5 py-4 bg-[#fafafa] border-b border-[#171717]/[0.08] flex items-start justify-between gap-3 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center justify-center h-6 px-2.5 rounded-[6px] bg-[#171717] text-white text-xs font-bold tabular-nums">
                {seatNumber}번 심판석
              </span>
              <h2 className="text-base font-bold text-[#171717] m-0">
                심판 긴급 변경
              </h2>
            </div>
            <p className="text-xs text-[#525252] m-0">
              현재 배정:{" "}
              <strong className="text-[#171717]">
                {currentJudgeName ? `${currentJudgeName} 심판` : "미배정"}
              </strong>
              {currentJudgePin ? ` (인증번호 ${currentJudgePin})` : ""} · 변경 즉시{" "}
              {seatNumber}번 태블릿이 대기화면으로 전환됩니다.
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-[8px] text-[#737373] hover:text-[#171717] hover:bg-[#e4e4e7]/60 transition-colors cursor-pointer"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* 검색 및 필터 바 */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="교체할 심판 성함, 소속 또는 인증번호(4자리) 검색..."
                  className="w-full h-9 pl-9 pr-3 rounded-[8px] border border-[#171717]/15 bg-white text-sm text-[#171717] placeholder:text-[#a3a3a3] focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              <div className="inline-flex items-center p-0.5 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`h-8 px-2.5 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                    filterMode === "all"
                      ? "bg-white text-[#171717] shadow-2xs"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  전체 ({poolCandidates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("standby")}
                  className={`h-8 px-2.5 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                    filterMode === "standby"
                      ? "bg-white text-[#16a34a] shadow-2xs"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  대기 심판 ({standbyCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("seated")}
                  className={`h-8 px-2.5 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                    filterMode === "seated"
                      ? "bg-white text-[#2563eb] shadow-2xs"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  타 좌석 맞교체 ({otherSeatedCount})
                </button>
              </div>
            </div>

            {/* 심판 목록 */}
            <div className="border border-[#171717]/10 rounded-[10px] divide-y divide-[#171717]/[0.06] max-h-[250px] overflow-y-auto bg-white">
              {filteredCandidates.length === 0 ? (
                <div className="py-8 px-4 text-center text-xs text-[#737373]">
                  조건에 맞는 대회 심판이 없습니다. [심판 명단 관리]에 등록된 심판인지 확인해 주세요.
                </div>
              ) : (
                filteredCandidates.map((cand) => {
                  const isSelf = cand.judgeUid === currentJudgeUid;
                  const isSelected = cand.judgeUid === selectedJudgeUid;
                  const otherSeats = (
                    seatedSeatsByUid.get(cand.judgeUid) || []
                  ).filter((s) => s !== seatNumber);
                  const isStandby = !isSelf && otherSeats.length === 0;

                  return (
                    <button
                      key={cand.judgeUid}
                      type="button"
                      disabled={isSelf}
                      onClick={() => {
                        setSelectedJudgeUid(cand.judgeUid);
                        setErrorMsg("");
                      }}
                      className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors ${
                        isSelf
                          ? "bg-[#fafafa] opacity-55 cursor-not-allowed"
                          : isSelected
                          ? "bg-[#eff6ff] hover:bg-[#eff6ff] cursor-pointer"
                          : "hover:bg-[#fafafa] cursor-pointer"
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div
                          className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-[#2563eb] border-[#2563eb] text-white"
                              : "border-[#d4d4d8] bg-white"
                          }`}
                        >
                          {isSelected && <Check size={12} strokeWidth={2.5} />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-[#171717]">
                              {cand.judgeName}
                            </span>
                            {cand.isHead && (
                              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#fef3c7] text-[#b45309] text-[11px] font-semibold">
                                심판위원장
                              </span>
                            )}
                            {cand.judgeOrganization && (
                              <span className="text-xs text-[#737373] truncate">
                                · {cand.judgeOrganization}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#737373] font-mono tabular-nums mt-0.5">
                            <span className="inline-flex items-center gap-1">
                              <KeyRound size={11} />
                              인증번호:{" "}
                              <strong className="text-[#171717]">
                                {cand.onedayPassword || "미발급"}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isSelf ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] bg-[#e4e4e7] text-[#525252] text-[11px] font-medium">
                            현재 {seatNumber}번석 배정중
                          </span>
                        ) : isStandby ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] bg-[#dcfce7] text-[#15803d] text-[11px] font-semibold">
                            교체 가능 (대기중)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] bg-[#dbeafe] text-[#1d4ed8] text-[11px] font-semibold">
                            현재 {otherSeats.join(", ")}번석 배정중
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 타 좌석에 이미 앉아있는 심판을 선택한 경우: 맞교체 옵션 */}
          {selectedJudge && partnerSeatIndex && (
            <div className="p-3.5 rounded-[10px] bg-[#eff6ff] border border-[#2563eb]/25 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1d4ed8]">
                <ArrowLeftRight size={14} strokeWidth={2} />
                <span>
                  선택한 [{selectedJudge.judgeName} 심판]은 현재{" "}
                  {partnerSeatIndex}번 심판석에 배정되어 있습니다
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSwapMode("exchange")}
                  className={`p-2.5 rounded-[8px] border text-left transition-colors cursor-pointer ${
                    swapMode === "exchange"
                      ? "bg-white border-[#2563eb] ring-1 ring-[#2563eb]"
                      : "bg-white/70 border-[#171717]/10 hover:bg-white"
                  }`}
                >
                  <div className="text-xs font-bold text-[#171717]">
                    {seatNumber}번 ↔ {partnerSeatIndex}번 1:1 좌석 맞교체 (권장)
                  </div>
                  <div className="text-[11px] text-[#525252] mt-0.5">
                    {seatNumber}번에 {selectedJudge.judgeName} 심판,{" "}
                    {partnerSeatIndex}번에{" "}
                    {currentJudgeName ? `${currentJudgeName} 심판` : "공석"} 배치
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSwapMode("replace")}
                  className={`p-2.5 rounded-[8px] border text-left transition-colors cursor-pointer ${
                    swapMode === "replace"
                      ? "bg-white border-[#2563eb] ring-1 ring-[#2563eb]"
                      : "bg-white/70 border-[#171717]/10 hover:bg-white"
                  }`}
                >
                  <div className="text-xs font-bold text-[#171717]">
                    {seatNumber}번 좌석만 변경
                  </div>
                  <div className="text-[11px] text-[#525252] mt-0.5">
                    {partnerSeatIndex}번 좌석은 그대로 두고 {seatNumber}번만 변경
                    (중복 배정 주의)
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 적용 범위 선택 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#171717]">
              <Users size={14} className="text-[#525252]" />
              <span>변경 적용 범위</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope("current_stage")}
                className={`p-3 rounded-[9px] border text-left transition-colors cursor-pointer ${
                  scope === "current_stage"
                    ? "bg-[#f8fafc] border-[#2563eb] ring-1 ring-[#2563eb]"
                    : "bg-white border-[#171717]/12 hover:bg-[#fafafa]"
                }`}
              >
                <div className="text-xs font-bold text-[#171717]">
                  현재 무대만 즉시 변경 (기본)
                </div>
                <div className="text-[11px] text-[#525252] mt-0.5">
                  현재 진행 중인 제{" "}
                  {currentStageInfo?.stageNumber ??
                    realtimeData?.stageNumber ??
                    "-"}{" "}
                  무대 체급에만 적용합니다.
                </div>
              </button>

              <button
                type="button"
                disabled={currentSectionInfo.remainingCount === 0}
                onClick={() => setScope("section_remaining")}
                className={`p-3 rounded-[9px] border text-left transition-colors ${
                  currentSectionInfo.remainingCount === 0
                    ? "bg-[#fafafa] border-[#171717]/[0.08] opacity-55 cursor-not-allowed"
                    : scope === "section_remaining"
                    ? "bg-[#f8fafc] border-[#2563eb] ring-1 ring-[#2563eb] cursor-pointer"
                    : "bg-white border-[#171717]/12 hover:bg-[#fafafa] cursor-pointer"
                }`}
              >
                <div className="text-xs font-bold text-[#171717]">
                  현재 섹션({currentSectionInfo.sectionName}) 남은 무대 일괄 변경
                </div>
                <div className="text-[11px] text-[#525252] mt-0.5">
                  {currentSectionInfo.remainingCount > 0
                    ? `현재 무대 포함 총 ${currentSectionInfo.totalSectionRemainingCount}개 무대의 ${seatNumber}번 좌석을 함께 변경합니다.`
                    : "현재 섹션에 이후 남은 무대가 없습니다."}
                </div>
              </button>
            </div>
          </div>

          {/* 이미 제출된 점수가 있을 때 안내 배너 */}
          {seatsWithSubmittedScores.length > 0 && (
            <div className="p-3.5 rounded-[10px] bg-[#fffbeb] border border-[#f59e0b]/40 flex items-start gap-2.5">
              <AlertTriangle
                size={16}
                className="text-[#d97706] shrink-0 mt-0.5"
              />
              <div className="text-xs text-[#92400e] leading-relaxed">
                <strong>기존 제출 점수 초기화 안내:</strong> 현재 무대에서{" "}
                <strong>
                  {seatsWithSubmittedScores.map((s) => `${s}번`).join(", ")} 심판석
                </strong>
                이 이미 제출한 채점 데이터가 있습니다. 심판을 변경하면 이전 심판의
                점수는 삭제되며, 새 심판이 로그인하여 다시 채점합니다.
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-[8px] bg-[#fef2f2] border border-[#dc2626]/30 flex items-center gap-2 text-xs font-medium text-[#dc2626]">
              <ShieldAlert size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* 하단 액션 바 */}
        <div className="px-5 py-3.5 bg-[#fafafa] border-t border-[#171717]/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#525252]">
            {selectedJudge ? (
              <span>
                변경 대상:{" "}
                <strong className="text-[#171717]">
                  {seatNumber}번 심판석 → {selectedJudge.judgeName} 심판
                </strong>{" "}
                (인증번호:{" "}
                <strong className="font-mono text-[#2563eb]">
                  {selectedJudge.onedayPassword || "미발급"}
                </strong>
                )
              </span>
            ) : (
              <span>목록에서 새로 배정할 심판을 선택해 주세요.</span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="h-9 px-4 rounded-[8px] border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] text-xs font-semibold text-[#525252] transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!selectedJudge || submitting}
              onClick={handleConfirmSwap}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#a3a3a3] text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <UserCheck size={14} strokeWidth={2} />
              <span>
                {submitting
                  ? "변경 반영 중..."
                  : swapMode === "exchange" && partnerSeatIndex
                  ? `${seatNumber}번 ↔ ${partnerSeatIndex}번 맞교체 확정`
                  : `${seatNumber}번 심판 변경 확정`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveJudgeSwapModal;
