import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc, runTransaction } from "firebase/firestore";
import { ref, remove, update } from "firebase/database";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  Radio,
  RotateCcw,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { db, database } from "../firebase";
import { isGrandPrixPlayerEntry } from "../functions/functions";
import {
  sanitizeForFirestore,
  sanitizeForRealtimeDb,
} from "../utils/firestoreSanitize";
import { normalizeDenseRealtimeJudges } from "../utils/judgeAssignUtils";
import {
  buildLiveStageRealtimeSnapshot,
  extractRtdbPlayerArray,
  getStageBackupKey,
  isLiveStageOverrideActive,
  rollbackLiveStageToOriginal,
} from "../utils/liveStageSnapshotUtils";

const LiveStagePlayersPushModal = ({
  isOpen,
  onClose,
  contestId,
  finalPlayersDocId,
  currentStageInfo,
  realtimeData,
  onAfterPush,
  onAfterRollback,
}) => {
  const grades = useMemo(
    () =>
      Array.isArray(currentStageInfo?.grades) && currentStageInfo.grades.length > 0
        ? currentStageInfo.grades
        : extractRtdbPlayerArray(realtimeData?.stageGrades),
    [currentStageInfo?.grades, realtimeData?.stageGrades]
  );

  const [activeGradeId, setActiveGradeId] = useState("");
  const [allFinalPlayers, setAllFinalPlayers] = useState([]);
  const [draftRoster, setDraftRoster] = useState([]);
  const [loadingPool, setLoadingPool] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualBib, setManualBib] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualGym, setManualGym] = useState("");
  const [syncToFirestore, setSyncToFirestore] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackConfirmStep, setRollbackConfirmStep] = useState(false);
  const [savedBackupPlayers, setSavedBackupPlayers] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg("");
    setSearchQuery("");
    setManualBib("");
    setManualName("");
    setManualGym("");
    setRollbackConfirmStep(false);

    const firstGradeId = grades[0]?.gradeId || realtimeData?.gradeId || "";
    setActiveGradeId(firstGradeId);

    let cancelled = false;
    (async () => {
      setLoadingPool(true);
      try {
        let fullPlayers = [];
        let backupForStage = null;
        const stageGradeIds = new Set(
          grades.map((g) => g?.gradeId).filter(Boolean)
        );
        const stageId = currentStageInfo?.stageId || realtimeData?.stageId || "";
        const backupKey = getStageBackupKey(stageId, Array.from(stageGradeIds));

        if (finalPlayersDocId) {
          const snap = await getDoc(
            doc(db, "contest_players_final", finalPlayersDocId)
          );
          if (snap.exists()) {
            const snapData = snap.data() || {};
            if (Array.isArray(snapData.players)) {
              fullPlayers = snapData.players;
            }
            const rawBackup = snapData.stageOverrideBackups?.[backupKey];
            if (rawBackup && Array.isArray(rawBackup.players)) {
              backupForStage = rawBackup.players;
            }
          }
        }
        if (cancelled) return;
        setAllFinalPlayers(fullPlayers);
        setSavedBackupPlayers(backupForStage);

        const rtdbActivePlayers = realtimeData?.hasLiveStageSnapshot
          ? Array.isArray(realtimeData?.stagePlayers)
            ? realtimeData.stagePlayers
            : Object.values(realtimeData?.stagePlayers || {})
          : null;

        const mergedRows = [];
        const seenKeys = new Set();

        const makeKey = (p) =>
          `${p?.contestGradeId || ""}::${
            p?.playerUid || `num_${p?.playerNumber}`
          }`;

        // 1) 현재 실시간 스냅샷에 올라와 있는 선수들을 최우선 배치 (출전 ON)
        if (Array.isArray(rtdbActivePlayers)) {
          rtdbActivePlayers.forEach((p, idx) => {
            if (!p || !stageGradeIds.has(p.contestGradeId)) return;
            const key = makeKey(p);
            if (seenKeys.has(key)) return;
            seenKeys.add(key);
            mergedRows.push({
              ...p,
              included: p.playerNoShow !== true,
              wasNoShow: false,
              orderIndex: Number(p.playerIndex) || idx + 1,
            });
          });
        }

        // 2) Firestore 최종명단에 등록된 해당 체급 선수들 병합 (결시자 포함 -> 토글로 즉시 살릴 수 있게)
        fullPlayers.forEach((p, idx) => {
          if (!p || !stageGradeIds.has(p.contestGradeId)) return;
          const key = makeKey(p);
          if (seenKeys.has(key)) return;
          seenKeys.add(key);

          const includedByDefault = rtdbActivePlayers
            ? false
            : p.playerNoShow !== true;

          mergedRows.push({
            playerUid: p.playerUid || `uid_${p.playerNumber}_${idx}`,
            playerNumber: p.playerNumber,
            playerIndex: Number(p.playerIndex) || idx + 1,
            playerName: p.playerName || "",
            playerGym: p.playerGym || "",
            contestCategoryId:
              p.contestCategoryId || currentStageInfo?.categoryId || "",
            contestCategoryTitle:
              p.contestCategoryTitle || currentStageInfo?.categoryTitle || "",
            contestGradeId: p.contestGradeId,
            contestGradeTitle: p.contestGradeTitle || "",
            included: includedByDefault,
            wasNoShow: p.playerNoShow === true,
            isLiveOverride: false,
            orderIndex: Number(p.playerIndex) || idx + 1,
          });
        });

        mergedRows.sort(
          (a, b) =>
            (Number(a.orderIndex) || Number(a.playerNumber) || 0) -
            (Number(b.orderIndex) || Number(b.playerNumber) || 0)
        );
        setDraftRoster(mergedRows);
      } catch (err) {
        console.error("[LiveStagePlayersPushModal] 초기 명단 로드 오류:", err);
        setErrorMsg("선수 명단을 불러오는 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoadingPool(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    finalPlayersDocId,
    grades,
    realtimeData?.gradeId,
    realtimeData?.hasLiveStageSnapshot,
    realtimeData?.stagePlayers,
    currentStageInfo?.categoryId,
    currentStageInfo?.categoryTitle,
  ]);

  const activeGradeMeta = useMemo(
    () =>
      grades.find((g) => g?.gradeId === activeGradeId) ||
      grades[0] || {
        gradeId: realtimeData?.gradeId || "",
        gradeTitle: realtimeData?.gradeTitle || "",
        categoryId:
          currentStageInfo?.categoryId || realtimeData?.categoryId || "",
        categoryTitle:
          currentStageInfo?.categoryTitle || realtimeData?.categoryTitle || "",
      },
    [grades, activeGradeId, realtimeData, currentStageInfo]
  );

  const visibleGradeRoster = useMemo(
    () =>
      draftRoster.filter(
        (row) => row.contestGradeId === activeGradeMeta.gradeId
      ),
    [draftRoster, activeGradeMeta.gradeId]
  );

  const totalIncludedCount = useMemo(
    () => draftRoster.filter((r) => r.included).length,
    [draftRoster]
  );

  const canRollbackToOriginal = useMemo(
    () =>
      isLiveStageOverrideActive(
        realtimeData,
        Array.isArray(savedBackupPlayers)
      ),
    [realtimeData, savedBackupPlayers]
  );

  const baselinePreviewBibs = useMemo(() => {
    const stageGradeIds = new Set(
      grades.map((g) => g?.gradeId).filter(Boolean)
    );
    if (Array.isArray(savedBackupPlayers) && savedBackupPlayers.length > 0) {
      return savedBackupPlayers
        .filter((p) => p && p.playerNoShow !== true)
        .sort(
          (a, b) =>
            (Number(a.playerIndex) || Number(a.playerNumber) || 0) -
            (Number(b.playerIndex) || Number(b.playerNumber) || 0)
        )
        .map((p) => p.playerNumber);
    }
    const rtdbOrig = extractRtdbPlayerArray(realtimeData?.originalStagePlayers);
    if (rtdbOrig.length > 0) {
      return rtdbOrig
        .filter((p) => p && p.playerNoShow !== true)
        .map((p) => p.playerNumber);
    }
    return allFinalPlayers
      .filter(
        (p) =>
          p &&
          stageGradeIds.has(p.contestGradeId) &&
          p.isLiveOverride !== true
      )
      .sort((a, b) => (Number(a.playerNumber) || 0) - (Number(b.playerNumber) || 0))
      .map((p) => p.playerNumber);
  }, [grades, savedBackupPlayers, realtimeData?.originalStagePlayers, allFinalPlayers]);

  const otherContestCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const existingKeys = new Set(
      visibleGradeRoster.map(
        (r) => `${r.playerUid || ""}::${String(r.playerNumber)}`
      )
    );
    return allFinalPlayers
      .filter((p) => {
        if (!p) return false;
        const key = `${p.playerUid || ""}::${String(p.playerNumber)}`;
        if (existingKeys.has(key)) return false;
        const bibStr = String(p.playerNumber ?? "").toLowerCase();
        const nameStr = String(p.playerName ?? "").toLowerCase();
        const gymStr = String(p.playerGym ?? "").toLowerCase();
        return (
          bibStr.includes(q) || nameStr.includes(q) || gymStr.includes(q)
        );
      })
      .slice(0, 8);
  }, [searchQuery, allFinalPlayers, visibleGradeRoster]);

  if (!isOpen) return null;

  const handleToggleInclude = (targetRow) => {
    setDraftRoster((prev) =>
      prev.map((row) =>
        row === targetRow ? { ...row, included: !row.included } : row
      )
    );
  };

  const handleMoveOrder = (targetRow, direction) => {
    setDraftRoster((prev) => {
      const gradeItems = prev.filter(
        (r) => r.contestGradeId === activeGradeMeta.gradeId
      );
      const others = prev.filter(
        (r) => r.contestGradeId !== activeGradeMeta.gradeId
      );
      const idx = gradeItems.indexOf(targetRow);
      const swapIdx = idx + direction;
      if (idx < 0 || swapIdx < 0 || swapIdx >= gradeItems.length) return prev;

      const reordered = [...gradeItems];
      const [moved] = reordered.splice(idx, 1);
      reordered.splice(swapIdx, 0, moved);

      const reindexed = reordered.map((item, i) => ({
        ...item,
        playerIndex: i + 1,
        orderIndex: i + 1,
      }));
      return [...others, ...reindexed];
    });
  };

  const handleAddFromOtherGrade = (candidate) => {
    const parsedBib = Number(candidate.playerNumber);
    const nextOrder = visibleGradeRoster.length + 1;
    const newEntry = {
      playerUid:
        candidate.playerUid ||
        `live_${activeGradeMeta.gradeId}_${candidate.playerNumber}`,
      playerNumber: Number.isFinite(parsedBib)
        ? parsedBib
        : candidate.playerNumber,
      playerIndex: nextOrder,
      orderIndex: nextOrder,
      playerName: candidate.playerName || "",
      playerGym: candidate.playerGym || "",
      contestCategoryId:
        activeGradeMeta.categoryId || currentStageInfo?.categoryId || "",
      contestCategoryTitle:
        activeGradeMeta.categoryTitle || currentStageInfo?.categoryTitle || "",
      contestGradeId: activeGradeMeta.gradeId,
      contestGradeTitle: activeGradeMeta.gradeTitle || "",
      included: true,
      wasNoShow: false,
      isLiveOverride: true,
      sourceGradeTitle: candidate.contestGradeTitle || "",
    };
    setDraftRoster((prev) => [...prev, newEntry]);
    setSearchQuery("");
  };

  const handleAddManualAthlete = (e) => {
    e.preventDefault();
    const trimmedBib = String(manualBib || "").trim();
    if (!trimmedBib) return;

    const numericBib = Number(trimmedBib);
    const finalBib = Number.isFinite(numericBib) ? numericBib : trimmedBib;

    const duplicate = visibleGradeRoster.some(
      (r) => String(r.playerNumber) === String(finalBib)
    );
    if (duplicate) {
      setErrorMsg(
        `이미 현재 체급 목록에 ${finalBib}번 선수가 있습니다. 목록에서 출전 체크를 켜주세요.`
      );
      return;
    }

    const nextOrder = visibleGradeRoster.length + 1;
    const newEntry = {
      playerUid: `live_${activeGradeMeta.gradeId}_${finalBib}_${Date.now()
        .toString(36)
        .slice(-4)}`,
      playerNumber: finalBib,
      playerIndex: nextOrder,
      orderIndex: nextOrder,
      playerName: String(manualName || "").trim() || `${finalBib}번 현장추가`,
      playerGym: String(manualGym || "").trim(),
      contestCategoryId:
        activeGradeMeta.categoryId || currentStageInfo?.categoryId || "",
      contestCategoryTitle:
        activeGradeMeta.categoryTitle || currentStageInfo?.categoryTitle || "",
      contestGradeId: activeGradeMeta.gradeId,
      contestGradeTitle: activeGradeMeta.gradeTitle || "",
      included: true,
      wasNoShow: false,
      isLiveOverride: true,
    };

    setErrorMsg("");
    setDraftRoster((prev) => [...prev, newEntry]);
    setManualBib("");
    setManualName("");
    setManualGym("");
  };

  const handlePushLiveStage = async () => {
    if (!contestId || submitting) return;
    const activePlayers = draftRoster
      .filter((r) => r.included)
      .map((r, idx) => ({
        ...r,
        playerIndex: idx + 1,
        playerNoShow: false,
      }));

    if (activePlayers.length === 0) {
      setErrorMsg("최소 1명 이상의 출전 선수를 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const stageGradeIds = new Set(
        grades.map((g) => g?.gradeId).filter(Boolean)
      );
      const stageId = currentStageInfo?.stageId || realtimeData?.stageId || "";
      const backupKey = getStageBackupKey(stageId, Array.from(stageGradeIds));

      // 최초 오버라이드 전 기준 선수 목록 확보 (RTDB originalStagePlayers 보존용)
      const existingRtdbOriginals = extractRtdbPlayerArray(
        realtimeData?.originalStagePlayers
      );
      const fallbackCurrentRtdb = !isLiveStageOverrideActive(realtimeData)
        ? extractRtdbPlayerArray(realtimeData?.stagePlayers)
        : [];
      const preservedOriginalRtdbPlayers =
        existingRtdbOriginals.length > 0
          ? existingRtdbOriginals
          : fallbackCurrentRtdb.length > 0
          ? fallbackCurrentRtdb
          : null;

      // 1) 선택 시 Firestore `contest_players_final`도 함께 동기화 + 최초 변경 전 원본 백업 자동 보관
      if (syncToFirestore && finalPlayersDocId) {
        await runTransaction(db, async (tx) => {
          const finalRef = doc(db, "contest_players_final", finalPlayersDocId);
          const snap = await tx.get(finalRef);
          if (!snap.exists()) return;

          const docData = snap.data() || {};
          const existingPlayers = Array.isArray(docData.players)
            ? [...docData.players]
            : [];
          const existingBackups =
            docData.stageOverrideBackups &&
            typeof docData.stageOverrideBackups === "object"
              ? { ...docData.stageOverrideBackups }
              : {};

          // 아직 해당 무대의 원본 백업이 없다면 최초 1회 원본 상태를 그대로 스냅샷 저장 (여러 번 밀어넣어도 최초 원본 유지)
          if (!existingBackups[backupKey]) {
            const pristineSlice = existingPlayers
              .filter(
                (p) =>
                  p &&
                  stageGradeIds.has(p.contestGradeId) &&
                  p.isLiveOverride !== true
              )
              .map((p) => ({ ...p }));

            existingBackups[backupKey] = {
              stageId: backupKey,
              savedAt: new Date().toISOString(),
              players: pristineSlice,
            };
          }

          // 현재 무대 체급 소속 선수들의 출전/결시 및 순서 동기화
          const draftMapByGradeAndBib = new Map();
          draftRoster.forEach((d) => {
            draftMapByGradeAndBib.set(
              `${d.contestGradeId}::${String(d.playerNumber)}`,
              d
            );
          });

          const updatedExisting = existingPlayers.map((p) => {
            if (!p || !stageGradeIds.has(p.contestGradeId)) return p;
            const matchedDraft = draftMapByGradeAndBib.get(
              `${p.contestGradeId}::${String(p.playerNumber)}`
            );
            if (!matchedDraft) return p;
            const nextIdx =
              Number(matchedDraft.playerIndex) || p.playerIndex || 1;
            const isGpEntry = isGrandPrixPlayerEntry(p, currentStageInfo);
            return {
              ...p,
              playerNoShow: !matchedDraft.included,
              playerIndex: nextIdx,
              ...(isGpEntry
                ? {
                    grandPrixIndex: nextIdx,
                    isCustomGrandPrixIndex: true,
                  }
                : {}),
            };
          });

          // 타 체급 이동 투입 또는 현장 신규 배번 선수 추가
          activePlayers.forEach((ap) => {
            const alreadyInGrade = updatedExisting.some(
              (ep) =>
                ep?.contestGradeId === ap.contestGradeId &&
                String(ep?.playerNumber) === String(ap.playerNumber)
            );
            if (!alreadyInGrade) {
              updatedExisting.push({
                contestId,
                contestCategoryId: ap.contestCategoryId || "",
                contestCategoryTitle: ap.contestCategoryTitle || "",
                contestGradeId: ap.contestGradeId || "",
                contestGradeTitle: ap.contestGradeTitle || "",
                playerUid: ap.playerUid,
                playerNumber: ap.playerNumber,
                playerIndex: ap.playerIndex,
                playerName: ap.playerName || "",
                playerGym: ap.playerGym || "",
                playerNoShow: false,
                createdBy: "force",
                isLiveOverride: true,
              });
            }
          });

          tx.update(
            finalRef,
            sanitizeForFirestore({
              players: updatedExisting,
              stageOverrideBackups: existingBackups,
              updatedAt: new Date().toISOString(),
            })
          );
        });
      }

      // 2) RTDB `currentStage/{contestId}`에 실시간 선수 스냅샷 + 새 stagePushId 송출 (원본 스냅샷 보존)
      const liveSnapshot = buildLiveStageRealtimeSnapshot({
        targetStage: {
          ...currentStageInfo,
          grades,
          categoryId:
            currentStageInfo?.categoryId || realtimeData?.categoryId || "",
          categoryTitle:
            currentStageInfo?.categoryTitle ||
            realtimeData?.categoryTitle ||
            "",
        },
        customStagePlayers: activePlayers,
        pushIdPrefix: "liveoverride",
        preservedOriginalPlayers: preservedOriginalRtdbPlayers,
      });

      // 이미 로그인한 심판은 로그인 상태를 유지하되, 채점 제출 완료(isEnd)만 해제하여 재채점 가능화
      const nextJudges = normalizeDenseRealtimeJudges(
        realtimeData?.judges,
        realtimeData?.stageJudgeCount
      ).map((j) => ({
        ...j,
        isEnd: false,
      }));

      try {
        await remove(ref(database, `currentStage/${contestId}/compares`));
      } catch {
        // ignore
      }

      await update(
        ref(database, `currentStage/${contestId}`),
        sanitizeForRealtimeDb({
          ...liveSnapshot,
          judges: nextJudges,
          resultSaved: [],
          compares: {
            status: {
              compareStart: false,
              compareEnd: false,
              compareCancel: false,
              compareIng: false,
            },
            confirmed: { count: 0 },
          },
        })
      );

      onAfterPush?.(activePlayers.length);
      onClose?.();
    } catch (err) {
      console.error("[LiveStagePlayersPushModal] 실시간 재송출 실패:", err);
      setErrorMsg(
        err?.message || "실시간 무대 선수 송출 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRollbackOriginal = async () => {
    if (!contestId || submitting || rollingBack) return;
    setRollingBack(true);
    setErrorMsg("");

    try {
      const result = await rollbackLiveStageToOriginal({
        db,
        database,
        contestId,
        finalPlayersDocId,
        currentStageInfo: {
          ...currentStageInfo,
          grades,
        },
        realtimeData,
      });
      onAfterRollback?.(result);
      onClose?.();
    } catch (err) {
      console.error("[LiveStagePlayersPushModal] 원래 명단 롤백 실패:", err);
      setErrorMsg(
        err?.message || "원래 출전 명단으로 롤백하는 중 오류가 발생했습니다."
      );
    } finally {
      setRollingBack(false);
      setRollbackConfirmStep(false);
    }
  };

  const isBusy = submitting || rollingBack;

  return (
    <div
      className="fixed inset-0 z-[1300] bg-black/50 flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[680px] max-h-[90vh] bg-white rounded-[14px] border border-[#171717]/15 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 py-4 bg-[#171717] text-white flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-[#60a5fa] shrink-0" />
              <span className="text-base font-bold truncate">
                현재 무대 출전선수 긴급 설정 · 즉시 밀어넣기
              </span>
            </div>
            <div className="text-xs text-[#a3a3a3] truncate">
              #{realtimeData?.stageNumber} {realtimeData?.categoryTitle} (
              {realtimeData?.gradeTitle}) — 심판 태블릿 채점판에 실시간 즉시 반영됩니다
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-[8px] bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center cursor-pointer border-0 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#fafafa]">
          {errorMsg && (
            <div className="p-3 rounded-[8px] bg-[#fef2f2] border border-[#dc2626]/30 text-xs font-semibold text-[#b91c1c] flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 현장 재설정 적용 중일 때 원래 배정 정보로 즉시 롤백 패널 */}
          {canRollbackToOriginal && (
            <div className="p-3.5 rounded-[10px] bg-[#fffbeb] border border-[#d97706]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#92400e]">
                  <RotateCcw size={13} className="shrink-0" />
                  <span>현재 현장 재설정 명단이 적용되어 있습니다</span>
                </div>
                <div className="text-xs text-[#b45309] break-keep leading-relaxed">
                  {baselinePreviewBibs.length > 0 ? (
                    <>
                      원래 배정 정보{" "}
                      <strong>
                        {baselinePreviewBibs.length}명 (
                        {baselinePreviewBibs.map((b) => `${b}번`).join(", ")})
                      </strong>
                      으로 즉시 되돌릴 수 있습니다.
                    </>
                  ) : (
                    "현장 추가·변경 전 원래 배정 명단으로 즉시 되돌릴 수 있습니다."
                  )}
                </div>
              </div>

              {!rollbackConfirmStep ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setRollbackConfirmStep(true)}
                  className="h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#fef3c7] border border-[#d97706]/45 text-[#92400e] text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors disabled:opacity-40"
                >
                  <RotateCcw size={13} strokeWidth={2.2} />
                  <span>원래 명단으로 롤백</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setRollbackConfirmStep(false)}
                    className="h-9 px-3 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/15 text-[#525252] text-xs font-semibold cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleRollbackOriginal}
                    className="h-9 px-3.5 rounded-[8px] bg-[#d97706] hover:bg-[#b45309] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border-0 shadow-xs disabled:opacity-40"
                  >
                    <RotateCcw size={13} strokeWidth={2.2} />
                    <span>
                      {rollingBack ? "롤백 복원 중..." : "확인 · 즉시 롤백"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 통합 무대일 때 체급 탭 */}
          {grades.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {grades.map((g) => {
                const isSelected = g.gradeId === activeGradeMeta.gradeId;
                const countInGrade = draftRoster.filter(
                  (r) => r.contestGradeId === g.gradeId && r.included
                ).length;
                return (
                  <button
                    key={g.gradeId}
                    type="button"
                    onClick={() => setActiveGradeId(g.gradeId)}
                    className={`h-8 px-3 rounded-[8px] text-xs font-bold border cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#171717] text-white border-[#171717]"
                        : "bg-white text-[#525252] border-[#171717]/15 hover:bg-[#f4f4f5]"
                    }`}
                  >
                    {g.gradeTitle} (출전 {countInGrade}명)
                  </button>
                );
              })}
            </div>
          )}

          {/* 1. 현재 무대 라인업 체크/순서 조정 */}
          <div className="bg-white rounded-[10px] border border-[#171717]/10 overflow-hidden">
            <div className="px-4 py-2.5 bg-[#f4f4f5] border-b border-[#171717]/[0.08] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#171717]">
                <Users size={14} />
                <span>
                  {activeGradeMeta.gradeTitle || "현재 체급"} 무대 라인업 (체크된 선수만 채점판 표시)
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-[#2563eb]">
                출전 {visibleGradeRoster.filter((r) => r.included).length}명
              </span>
            </div>

            {loadingPool ? (
              <div className="p-6 text-center text-xs text-[#737373]">
                선수 데이터를 불러오는 중...
              </div>
            ) : visibleGradeRoster.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#737373]">
                등록된 선수가 없습니다. 아래 검색 또는 현장 배번 추가로 즉시 투입하세요.
              </div>
            ) : (
              <div className="divide-y divide-[#171717]/[0.06] max-h-[260px] overflow-y-auto">
                {visibleGradeRoster.map((row, idx) => (
                  <div
                    key={`${row.playerUid}_${row.playerNumber}`}
                    className={`px-4 py-2.5 flex items-center justify-between gap-3 ${
                      row.included ? "bg-white" : "bg-[#fafafa] opacity-60"
                    }`}
                  >
                    <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={() => handleToggleInclude(row)}
                        className="w-4 h-4 accent-[#2563eb] cursor-pointer"
                      />
                      <span className="min-w-[44px] h-7 px-2 rounded-[6px] bg-[#171717] text-white font-mono text-xs font-bold inline-flex items-center justify-center tabular-nums">
                        {row.playerNumber}번
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-[#171717] truncate">
                            {row.playerName || `${row.playerNumber}번 선수`}
                          </span>
                          {row.wasNoShow && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                              결시 등록됨
                            </span>
                          )}
                          {row.isLiveOverride && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                              현장 투입
                            </span>
                          )}
                        </div>
                        {row.playerGym && (
                          <div className="text-xs text-[#737373] truncate">
                            {row.playerGym}
                          </div>
                        )}
                      </div>
                    </label>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveOrder(row, -1)}
                        className="w-7 h-7 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] disabled:opacity-30 inline-flex items-center justify-center cursor-pointer"
                        title="순서 위로"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === visibleGradeRoster.length - 1}
                        onClick={() => handleMoveOrder(row, 1)}
                        className="w-7 h-7 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] disabled:opacity-30 inline-flex items-center justify-center cursor-pointer"
                        title="순서 아래로"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. 대회 내 타 체급 선수 검색 투입 */}
          <div className="bg-white rounded-[10px] border border-[#171717]/10 p-3.5 space-y-2.5">
            <div className="text-xs font-bold text-[#171717] flex items-center gap-1.5">
              <Search size={13} />
              <span>타 체급 등록 선수 검색하여 현재 무대에 투입</span>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="배번, 선수 이름, 소속으로 검색..."
              className="w-full h-9 px-3 rounded-[8px] border border-[#171717]/15 text-xs focus:outline-none focus:border-[#2563eb]"
            />
            {otherContestCandidates.length > 0 && (
              <div className="divide-y divide-[#171717]/[0.06] border border-[#171717]/10 rounded-[8px] max-h-[160px] overflow-y-auto">
                {otherContestCandidates.map((cand, cIdx) => (
                  <div
                    key={`${cand.playerUid || cIdx}_${cand.contestGradeId}`}
                    className="px-3 py-2 flex items-center justify-between gap-2 text-xs bg-[#fafafa]"
                  >
                    <div className="min-w-0 truncate">
                      <span className="font-mono font-bold text-[#171717] mr-1.5">
                        {cand.playerNumber}번
                      </span>
                      <span className="font-semibold text-[#171717] mr-1.5">
                        {cand.playerName}
                      </span>
                      <span className="text-[#737373]">
                        ({cand.contestCategoryTitle} · {cand.contestGradeTitle})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddFromOtherGrade(cand)}
                      className="h-7 px-2.5 rounded-[6px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer border-0"
                    >
                      <Plus size={12} />
                      <span>무대 투입</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. 미등록 현장 배번 직접 추가 */}
          <form
            onSubmit={handleAddManualAthlete}
            className="bg-white rounded-[10px] border border-[#171717]/10 p-3.5 space-y-2.5"
          >
            <div className="text-xs font-bold text-[#171717] flex items-center gap-1.5">
              <UserPlus size={13} />
              <span>명단에 없는 현장 배번 즉시 추가</span>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <input
                type="text"
                value={manualBib}
                onChange={(e) => setManualBib(e.target.value)}
                placeholder="배번 (필수)"
                className="w-24 h-9 px-3 rounded-[8px] border border-[#171717]/15 text-xs font-mono focus:outline-none focus:border-[#2563eb]"
              />
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="선수명 (선택)"
                className="flex-1 min-w-[110px] h-9 px-3 rounded-[8px] border border-[#171717]/15 text-xs focus:outline-none focus:border-[#2563eb]"
              />
              <input
                type="text"
                value={manualGym}
                onChange={(e) => setManualGym(e.target.value)}
                placeholder="소속 (선택)"
                className="flex-1 min-w-[110px] h-9 px-3 rounded-[8px] border border-[#171717]/15 text-xs focus:outline-none focus:border-[#2563eb]"
              />
              <button
                type="submit"
                disabled={!String(manualBib).trim()}
                className="h-9 px-3.5 rounded-[8px] bg-[#171717] hover:bg-[#262626] disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer border-0"
              >
                <Plus size={13} />
                <span>추가</span>
              </button>
            </div>
          </form>

          {/* Firestore 동시 반영 옵션 */}
          <label className="flex items-start gap-2.5 px-3.5 py-3 rounded-[10px] bg-[#eff6ff] border border-[#2563eb]/20 cursor-pointer">
            <input
              type="checkbox"
              checked={syncToFirestore}
              onChange={(e) => setSyncToFirestore(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#2563eb] cursor-pointer"
            />
            <div className="text-xs leading-relaxed text-[#1e3a8a]">
              <div className="font-bold">
                최종 출전명단(Firestore)에도 함께 반영하기 (권장)
              </div>
              <div className="text-[#1d4ed8]/85">
                체크 시 심판 태블릿 실시간 반영과 동시에 심판위원장 최종 순위확정·시상식·기록지 명단까지 일치시킵니다.
              </div>
            </div>
          </label>
        </div>

        {/* 푸터 */}
        <div className="px-5 py-3.5 bg-white border-t border-[#171717]/10 flex items-center justify-between gap-3">
          <div className="text-xs text-[#525252]">
            총 <strong className="text-[#171717]">{totalIncludedCount}명</strong>의 선수가 전 심판 태블릿 채점판으로 송출됩니다.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={onClose}
              className="h-9 px-3.5 rounded-[8px] border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] disabled:opacity-40 text-xs font-semibold text-[#525252] cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              disabled={isBusy || totalIncludedCount === 0}
              onClick={handlePushLiveStage}
              className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border-0 shadow-sm"
            >
              <Check size={14} strokeWidth={2.2} />
              <span>
                {submitting
                  ? "송출 중..."
                  : `심판 태블릿에 즉시 밀어넣기 (${totalIncludedCount}명)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveStagePlayersPushModal;
