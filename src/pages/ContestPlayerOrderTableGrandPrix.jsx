import React, { useContext, useEffect, useState } from "react";
import LoadingPage from "./LoadingPage";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { sanitizeForFirestore } from "../utils/firestoreSanitize";
import { resolveOriginalGradeTitle } from "../utils/playerEntryUtils";
import { dedupeContestResultsByGrade } from "../utils/contestResultsUtils";
import {
  buildGrandPrixPlayersFromResults,
  getGrandPrixPlayerUniqueKey,
  sortByWonGradeOrder,
} from "../utils/grandPrixAutoSyncUtils";
import {
  Trophy,
  Save,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Pencil,
} from "lucide-react";
import BibTag from "../components/ui/BibTag";
import LayerPlayerEditDrawer from "../components/player/LayerPlayerEditDrawer";
import {
  applyStage3FinalDirectEdit,
} from "../utils/layerPlayerEditUtils";

const getPlayerUniqueKey = getGrandPrixPlayerUniqueKey;

const normalizeGradeGrandPrixOrder = (gradePlayers, markCustom = false) =>
  gradePlayers.map((player, idx) => {
    const nextIdx = idx + 1;
    const preservedOriginal =
      player?.playerIndexOriginal !== undefined &&
      player?.playerIndexOriginal !== null
        ? player.playerIndexOriginal
        : player?.playerIndex ?? player?.playerNumber ?? null;
    return {
      ...player,
      playerIndexOriginal: preservedOriginal,
      grandPrixIndex: nextIdx,
      playerIndex: nextIdx,
      isGradeChange: false,
      isGradeChanged: false,
      ...(markCustom ? { isCustomGrandPrixIndex: true } : {}),
    };
  });

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
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [isDirectSaving, setIsDirectSaving] = useState(false);
  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayerFinal = useFirestoreGetDocument("contest_players_final");
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
        variant: "error",
        title: "대회 데이터 확인 필요",
        body: "그랑프리 명단 구성을 위한 문서 ID를 확인할 수 없습니다.",
        body2: "대회 종목·체급 및 계측 최종명단 설정을 먼저 확인해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }
    try {
      const [catDoc, gradeDoc, finalDoc, resultDocs] = await Promise.all([
        fetchCategoryDocument.getDocument(categoriesListId),
        fetchGradeDocument.getDocument(gradesListId),
        fetchPlayerFinal.getDocument(playersFinalId),
        fetchResultQuery.getDocuments("contest_results_list", condition),
      ]);
      setCategoriesArray([...(catDoc?.categorys || [])]);
      setGradesArray([...(gradeDoc?.grades || [])]);
      setPlayersFinalArray([...(finalDoc?.players || [])]);
      setPlayersFinalList({ ...(finalDoc || {}) });
      setResultFinalArray(dedupeContestResultsByGrade(resultDocs || [], contestId));
    } catch (error) {
      console.error(error);
    }
  };

  const initGrandPrixPlayers = (
    resultInfo,
    categories,
    grades,
    existingFinalPlayers = []
  ) =>
    buildGrandPrixPlayersFromResults({
      resultDocs: resultInfo,
      categories,
      grades,
      existingFinalPlayers,
      contestId: currentContest?.contests?.id || "",
    });

  // 그랑프리 체급 내 무대 순번(grandPrixIndex) 상/하 이동
  const handleMoveGrandPrixOrder = (gradeId, currentIndex, direction) => {
    setGrandPrixArray((prev) => {
      const gradePlayers = prev
        .filter((p) => p.contestGradeId === gradeId)
        .sort(
          (a, b) =>
            (a.grandPrixIndex ?? a.playerIndex ?? 0) -
            (b.grandPrixIndex ?? b.playerIndex ?? 0)
        );
      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= gradePlayers.length) return prev;

      const reordered = [...gradePlayers];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      const normalized = normalizeGradeGrandPrixOrder(reordered, true);
      const updatedByKey = new Map(
        normalized.map((p) => [`${gradeId}_${getPlayerUniqueKey(p)}`, p])
      );

      return prev.map((p) => {
        if (p.contestGradeId !== gradeId) return p;
        return updatedByKey.get(`${gradeId}_${getPlayerUniqueKey(p)}`) || p;
      });
    });
  };

  // 그랑프리 무대 순번(grandPrixIndex) 숫자 직접 지정
  const handleDirectGrandPrixIndexChange = (gradeId, playerKey, rawValue) => {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) return;

    setGrandPrixArray((prev) => {
      const gradePlayers = prev
        .filter((p) => p.contestGradeId === gradeId)
        .sort(
          (a, b) =>
            (a.grandPrixIndex ?? a.playerIndex ?? 0) -
            (b.grandPrixIndex ?? b.playerIndex ?? 0)
        );
      const fromIdx = gradePlayers.findIndex(
        (p) => getPlayerUniqueKey(p) === playerKey
      );
      if (fromIdx === -1) return prev;

      const clampedTargetIdx = Math.max(
        0,
        Math.min(gradePlayers.length - 1, parsed - 1)
      );
      if (fromIdx === clampedTargetIdx) return prev;

      const reordered = [...gradePlayers];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(clampedTargetIdx, 0, moved);

      const normalized = normalizeGradeGrandPrixOrder(reordered, true);
      const updatedByKey = new Map(
        normalized.map((p) => [`${gradeId}_${getPlayerUniqueKey(p)}`, p])
      );

      return prev.map((p) => {
        if (p.contestGradeId !== gradeId) return p;
        return updatedByKey.get(`${gradeId}_${getPlayerUniqueKey(p)}`) || p;
      });
    });
  };

  // 해당 그랑프리 체급을 다시 하위 우승 체급 순서(contestGradeIndex)로 초기화
  const handleResetToGradeOrder = (gradeId) => {
    setGrandPrixArray((prev) => {
      const gradePlayers = prev
        .filter((p) => p.contestGradeId === gradeId)
        .sort(sortByWonGradeOrder)
        .map((p, idx) => ({
          ...p,
          playerIndexOriginal:
            p.playerIndexOriginal !== undefined &&
            p.playerIndexOriginal !== null
              ? p.playerIndexOriginal
              : p.playerIndex ?? p.playerNumber ?? null,
          grandPrixIndex: idx + 1,
          playerIndex: idx + 1,
          isGradeChange: false,
          isGradeChanged: false,
          isCustomGrandPrixIndex: false,
        }));

      const updatedByKey = new Map(
        gradePlayers.map((p) => [`${gradeId}_${getPlayerUniqueKey(p)}`, p])
      );

      return prev.map((p) => {
        if (p.contestGradeId !== gradeId) return p;
        return updatedByKey.get(`${gradeId}_${getPlayerUniqueKey(p)}`) || p;
      });
    });
  };

  const initPlayersFinalList = (categories, grades, players) => {
    setIsLoading(true);

    let dummy = [];
    (categories || [])
      .filter(
        (f) =>
          f?.contestCategorySection === "그랑프리" ||
          String(f?.contestCategoryTitle || "").includes("그랑프리")
      )
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

            const seen = new Set();
            const matchedPlayers = [];
            rawMatched.forEach((player) => {
              const k = getPlayerUniqueKey(player);
              if (!seen.has(k)) {
                seen.add(k);
                matchedPlayers.push(player);
              }
            });

            matchedPlayers.sort(
              (a, b) =>
                (a.grandPrixIndex ?? a.playerIndex ?? 0) -
                (b.grandPrixIndex ?? b.playerIndex ?? 0)
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

    setMatchedArray([...dummy]);
    setIsLoading(false);
  };

  const handleUpdatePlayersFinal = async (contestId, playersFinalId, data) => {
    setMessage({
      variant: "loading",
      title: "그랑프리 명단 저장 중",
      body: "그랑프리 진출 선수 명단과 무대 순번(grandPrixIndex)을 저장하고 있습니다.",
      isButton: false,
    });
    setMsgOpen(true);

    try {
      if (!playersFinalId) {
        setMessage({
          variant: "error",
          title: "최종명단 문서 확인 필요",
          body: "최종 출전 명단 문서를 확인할 수 없습니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        return;
      }

      // 1. 체급별로 grandPrixIndex(1..N)와 playerIndex(1..N)를 최종 정규화하여 중복 없이 정리
      const groupedByGrade = new Map();
      const seenGrandPrixKeys = new Set();
      (data || []).forEach((p) => {
        if (!p || !p.contestGradeId) return;
        const k = `${p.contestGradeId}_${getPlayerUniqueKey(p)}`;
        if (seenGrandPrixKeys.has(k)) return;
        seenGrandPrixKeys.add(k);
        if (!groupedByGrade.has(p.contestGradeId)) {
          groupedByGrade.set(p.contestGradeId, []);
        }
        groupedByGrade.get(p.contestGradeId).push(p);
      });

      const dedupedGrandPrixData = [];
      groupedByGrade.forEach((gradeList) => {
        const sorted = [...gradeList].sort(
          (a, b) =>
            (a.grandPrixIndex ?? a.playerIndex ?? 0) -
            (b.grandPrixIndex ?? b.playerIndex ?? 0)
        );
        sorted.forEach((p, idx) => {
          const gpIdx = idx + 1;
          const preservedOriginal =
            p.playerIndexOriginal !== undefined &&
            p.playerIndexOriginal !== null
              ? p.playerIndexOriginal
              : p.playerIndex ?? p.playerNumber ?? null;
          dedupedGrandPrixData.push({
            ...p,
            playerIndexOriginal: preservedOriginal,
            grandPrixIndex: gpIdx,
            playerIndex: gpIdx,
            isGradeChange: false,
            isGradeChanged: false,
            gpLayerSaved: true,
          });
        });
      });

      if (dedupedGrandPrixData.length === 0) {
        setMessage({
          variant: "warning",
          title: "저장할 그랑프리 선수 없음",
          body: "추가할 그랑프리 진출 선수가 없습니다. 각 체급 심사가 완료된 후 확인해 주세요.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        return;
      }

      const incomingGpGradeIds = new Set(
        dedupedGrandPrixData.map((p) => p?.contestGradeId).filter(Boolean)
      );

      const incomingKeySet = new Set(
        dedupedGrandPrixData.map(
          (p) => `${p.contestGradeId}_${getPlayerUniqueKey(p)}`
        )
      );

      const finalRef = doc(db, "contest_players_final", playersFinalId);
      let committedDoc = null;
      let committedPlayers = [];

      await runTransaction(db, async (transaction) => {
        const finalSnap = await transaction.get(finalRef);
        const latestFinalDoc = finalSnap.exists() ? finalSnap.data() : null;
        const baseFinalList = latestFinalDoc || playersFinalList || {};
        const baseFinalPlayers = Array.isArray(latestFinalDoc?.players)
          ? latestFinalDoc.players
          : playersFinalArray || [];

        // 기존 baseFinalPlayers에서 일반 종목 엔트리와 현재 저장 대상에 포함되지 않은 타 그랑프리 체급(자동 동기화분 포함)은 그대로 보존
        const nonGrandPrixPlayers = baseFinalPlayers.filter((p) => {
          if (!incomingGpGradeIds.has(p?.contestGradeId)) return true;
          const pKey = `${p.contestGradeId}_${getPlayerUniqueKey(p)}`;
          if (incomingKeySet.has(pKey)) return false;
          return (
            p?.createdBy === "force" ||
            p?.createBy === "force" ||
            p?.isLiveOverride === true
          );
        });

        const finalPlayersMap = new Map();
        [...nonGrandPrixPlayers, ...dedupedGrandPrixData].forEach((p) => {
          if (!p) return;
          const k = `${p.contestGradeId}_${getPlayerUniqueKey(p)}`;
          if (!finalPlayersMap.has(k)) {
            finalPlayersMap.set(k, p);
          }
        });
        const finalPlayers = Array.from(finalPlayersMap.values());

        const { id: _ignoredId, ...cleanBaseList } = baseFinalList;
        const sanitizedPayload = sanitizeForFirestore({
          ...cleanBaseList,
          ...(contestId ? { contestId } : {}),
          players: finalPlayers,
          updatedAt: new Date().toISOString(),
        });

        if (finalSnap.exists()) {
          transaction.update(finalRef, sanitizedPayload);
        } else {
          transaction.set(finalRef, sanitizedPayload);
        }

        committedDoc = { id: playersFinalId, ...sanitizedPayload };
        committedPlayers = finalPlayers;
      });

      setPlayersFinalList(committedDoc);
      setPlayersFinalArray(committedPlayers);
      setGrandPrixArray(dedupedGrandPrixData);
      setMessage({
        variant: "success",
        title: "그랑프리 명단 저장 완료",
        body: `그랑프리 진출 선수 ${dedupedGrandPrixData.length}명이 체급 순서(grandPrixIndex) 기준으로 저장되었습니다.`,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("그랑프리 명단 저장 실패:", error);
      setMessage({
        variant: "error",
        title: "그랑프리 명단 저장 실패",
        body: "그랑프리 명단을 저장하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    }
  };

  const handleDirectEditGrandPrixSave = async (beforePlayer, patchFields) => {
    const contestId = currentContest?.contests?.id;
    const playersFinalId = currentContest?.contests?.contestPlayersFinalId;
    if (!playersFinalId || !beforePlayer) {
      setMessage({
        variant: "error",
        title: "최종명단 문서 확인 필요",
        body: "최종 출전 명단 문서를 확인할 수 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    setIsDirectSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const finalRef = doc(db, "contest_players_final", playersFinalId);
      let committedDoc = null;
      let committedPlayers = [];

      await runTransaction(db, async (transaction) => {
        const finalSnap = await transaction.get(finalRef);
        const latestFinalDoc = finalSnap.exists() ? finalSnap.data() : null;
        const baseFinalList = latestFinalDoc || playersFinalList || {};
        const baseFinalPlayers = Array.isArray(latestFinalDoc?.players)
          ? latestFinalDoc.players
          : playersFinalArray || [];

        const nextPlayers = applyStage3FinalDirectEdit(
          baseFinalPlayers,
          beforePlayer,
          patchFields,
          { isGrandPrix: true, nowIso }
        );

        const { id: _ignoredId, ...cleanBaseList } = baseFinalList;
        const sanitizedPayload = sanitizeForFirestore({
          ...cleanBaseList,
          ...(contestId ? { contestId } : {}),
          players: nextPlayers,
          updatedAt: nowIso,
        });

        if (finalSnap.exists()) {
          transaction.update(finalRef, sanitizedPayload);
        } else {
          transaction.set(finalRef, sanitizedPayload);
        }

        committedDoc = { id: playersFinalId, ...sanitizedPayload };
        committedPlayers = nextPlayers;
      });

      setPlayersFinalList(committedDoc);
      setPlayersFinalArray(committedPlayers);
      setEditDrawerOpen(false);
      setEditingPlayer(null);
    } catch (error) {
      console.error("그랑프리 선수 직접 수정 실패:", error);
      setMessage({
        variant: "error",
        title: "그랑프리 선수 수정 실패",
        body: "그랑프리 선수 정보를 저장하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsDirectSaving(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentContest?.contests?.id,
    currentContest?.contests?.contestCategorysListId,
    currentContest?.contests?.contestGradesListId,
    currentContest?.contests?.contestPlayersFinalId,
  ]);

  useEffect(() => {
    const contestId = currentContest?.contests?.id;
    const playersFinalId = currentContest?.contests?.contestPlayersFinalId;
    if (!contestId) return undefined;

    const unsubs = [];

    const resultsQ = query(
      collection(db, "contest_results_list"),
      where("contestId", "==", contestId)
    );
    unsubs.push(
      onSnapshot(
        resultsQ,
        (snap) => {
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setResultFinalArray(dedupeContestResultsByGrade(docs, contestId));
        },
        (err) => {
          console.warn("[GrandPrix] contest_results_list 실시간 구독 오류:", err);
        }
      )
    );

    if (playersFinalId) {
      unsubs.push(
        onSnapshot(
          doc(db, "contest_players_final", playersFinalId),
          (snap) => {
            if (!snap.exists()) return;
            const data = snap.data() || {};
            setPlayersFinalList({ id: snap.id, ...data });
            if (Array.isArray(data.players)) {
              setPlayersFinalArray([...data.players]);
            }
          },
          (err) => {
            console.warn("[GrandPrix] contest_players_final 실시간 구독 오류:", err);
          }
        )
      );
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [
    currentContest?.contests?.id,
    currentContest?.contests?.contestPlayersFinalId,
  ]);

  useEffect(() => {
    if (grandPrixArray.length > 0) {
      initPlayersFinalList(categoriesArray, gradesArray, grandPrixArray);
    } else {
      setMatchedArray([]);
    }
  }, [grandPrixArray, categoriesArray, gradesArray]);

  useEffect(() => {
    if (categoriesArray?.length > 0 && gradesArray?.length > 0) {
      setGrandPrixArray((prev) => {
        // 화면에서 아직 저장 버튼을 누르기 전 수동으로 조정 중인 순번(isCustomGrandPrixIndex)도 보존
        const localCustomByKey = new Map();
        (prev || []).forEach((item) => {
          if (item?.isCustomGrandPrixIndex && item?.contestGradeId) {
            localCustomByKey.set(
              `${item.contestGradeId}_${getPlayerUniqueKey(item)}`,
              item
            );
          }
        });

        const mergedSeedPlayers =
          localCustomByKey.size > 0
            ? [
                ...playersFinalArray.filter((fp) => {
                  const k = `${fp?.contestGradeId}_${getPlayerUniqueKey(fp)}`;
                  return !localCustomByKey.has(k);
                }),
                ...Array.from(localCustomByKey.values()),
              ]
            : playersFinalArray;

        return [
          ...initGrandPrixPlayers(
            resultPlayersArray,
            categoriesArray,
            gradesArray,
            mergedSeedPlayers
          ),
        ];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultPlayersArray, categoriesArray, gradesArray, playersFinalArray]);

  return (
    <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-5">
          <ConfirmationModal
            isOpen={msgOpen}
            onConfirm={() => setMsgOpen(false)}
            onCancel={() => setMsgOpen(false)}
            message={message}
          />

          <LayerPlayerEditDrawer
            open={editDrawerOpen}
            onClose={() => {
              if (!isDirectSaving) {
                setEditDrawerOpen(false);
                setEditingPlayer(null);
              }
            }}
            layer="grandprix"
            player={editingPlayer}
            categoriesArray={categoriesArray}
            gradesArray={gradesArray}
            allLayerPlayers={grandPrixArray}
            onSave={handleDirectEditGrandPrixSave}
            isSaving={isDirectSaving}
          />

          <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] flex items-center justify-center shrink-0">
                <Trophy
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[#171717] m-0 tracking-tight">
                  그랑프리 명단
                </h1>
                <p className="text-xs text-[#737373] m-0">
                  월체·선수번호와 무관하게 우승 체급 순서(grandPrixIndex)대로 무대에 배치되며, 순번을 직접 조정할 수 있습니다.
                </p>
              </div>
            </div>

            {grandPrixArray?.length ? (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors duration-150 cursor-pointer border-0 whitespace-nowrap shrink-0"
                onClick={() =>
                  handleUpdatePlayersFinal(
                    currentContest?.contests?.id,
                    currentContest?.contests?.contestPlayersFinalId,
                    grandPrixArray
                  )
                }
              >
                <Save size={15} strokeWidth={1.5} className="shrink-0" />
                <span>그랑프리 명단 저장 ({grandPrixArray.length}명)</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#b45309]/[0.08] text-[#b45309] border border-[#b45309]/20 text-xs font-medium whitespace-nowrap shrink-0">
                <AlertCircle size={15} strokeWidth={1.5} className="shrink-0" />
                <span>집계표가 저장되었는지 확인하세요</span>
              </div>
            )}
          </div>

          {matchedArray.length === 0 ? (
            <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-12 text-center">
              <p className="text-sm text-[#737373] m-0">
                집계된 그랑프리 출전 대상자가 없습니다. 각 체급 심사가 완료된 후 확인하세요.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {matchedArray
                .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
                .map((matched, mIdx) => {
                  const {
                    contestCategoryTitle: categoryTitle,
                    contestGradeId: gradeId,
                    contestGradeTitle: gradeTitle,
                    matchedPlayers,
                  } = matched;

                  if (matchedPlayers.length === 0) return null;

                  const sortedPlayers = [...matchedPlayers].sort(
                    (a, b) =>
                      (a.grandPrixIndex ?? a.playerIndex ?? 0) -
                      (b.grandPrixIndex ?? b.playerIndex ?? 0)
                  );
                  const hasCustomOrder = sortedPlayers.some(
                    (p) => p.isCustomGrandPrixIndex
                  );

                  return (
                    <div
                      className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
                      key={gradeId || mIdx}
                    >
                      <div className="bg-[#f4f4f5] px-5 py-3 border-b border-[#171717]/[0.08] flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#171717]">
                            {categoryTitle}
                            <span className="text-[#525252] font-normal mx-1.5">
                              /
                            </span>
                            <span className="font-medium">{gradeTitle}</span>
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] border border-[#2563eb]/20 text-[11px] font-medium">
                            {hasCustomOrder
                              ? "수동 무대순번 적용됨"
                              : "체급 순서 자동배치 (월체 무시)"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleResetToGradeOrder(gradeId)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[6px] bg-[#ffffff] hover:bg-[#fafafa] text-[#525252] hover:text-[#171717] border border-[#171717]/[0.12] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <RotateCcw size={12} strokeWidth={1.5} />
                            <span>체급순 자동 정렬</span>
                          </button>
                          <span className="text-xs font-medium text-[#525252] font-mono tabular-nums">
                            {sortedPlayers.length}명
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#171717]/[0.08] bg-[#fafafa] text-xs font-medium text-[#525252]">
                              <th className="w-36 py-2.5 px-4 whitespace-nowrap">
                                무대 순번 (GP Index)
                              </th>
                              <th className="w-28 py-2.5 px-4 whitespace-nowrap">
                                선수번호
                              </th>
                              <th className="w-44 py-2.5 px-4 whitespace-nowrap">
                                이름
                              </th>
                              <th className="py-2.5 px-4 whitespace-nowrap">
                                소속
                              </th>
                              <th className="w-56 py-2.5 px-4 whitespace-nowrap">
                                우승 체급 / 비고
                              </th>
                              <th className="w-24 py-2.5 px-4 text-center whitespace-nowrap">
                                관리
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#171717]/[0.06]">
                            {sortedPlayers.map((player, pIdx) => {
                              const {
                                playerName,
                                playerGym,
                                playerUid,
                                playerNumber,
                                playerNoShow,
                                wasGradeChangedInOriginal,
                                createdBy,
                                createBy,
                              } = player;
                              const resolvedOrigGradeTitle =
                                resolveOriginalGradeTitle(player);
                              const gpIndex =
                                player.grandPrixIndex ??
                                player.playerIndex ??
                                pIdx + 1;
                              const pKey = getPlayerUniqueKey(player);
                              const isForce =
                                createdBy === "force" || createBy === "force";

                              return (
                                <tr
                                  key={`${gradeId}_${
                                    playerUid || playerNumber
                                  }_${pIdx}`}
                                  className={`transition-colors duration-150 ${
                                    playerNoShow
                                      ? "bg-[#dc2626]/[0.03]"
                                      : "hover:bg-[#fafafa]"
                                  }`}
                                >
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min={1}
                                        max={sortedPlayers.length}
                                        value={gpIndex}
                                        onChange={(e) =>
                                          handleDirectGrandPrixIndexChange(
                                            gradeId,
                                            pKey,
                                            e.target.value
                                          )
                                        }
                                        className="w-12 h-7 px-1.5 text-center font-mono tabular-nums text-xs font-semibold text-[#171717] bg-[#ffffff] border border-[#171717]/[0.14] rounded-[6px] focus:outline-none focus:border-[#2563eb]"
                                        title="그랑프리 무대 순번 (grandPrixIndex)"
                                      />
                                      <div className="inline-flex items-center border border-[#171717]/[0.12] rounded-[6px] overflow-hidden bg-[#ffffff]">
                                        <button
                                          type="button"
                                          disabled={pIdx === 0}
                                          onClick={() =>
                                            handleMoveGrandPrixOrder(
                                              gradeId,
                                              pIdx,
                                              -1
                                            )
                                          }
                                          className="w-6 h-7 flex items-center justify-center text-[#525252] hover:bg-[#f4f4f5] hover:text-[#171717] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-0 border-r border-[#171717]/[0.08] bg-transparent"
                                          title="앞 순서로 이동"
                                        >
                                          <ChevronUp
                                            size={13}
                                            strokeWidth={1.75}
                                          />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={
                                            pIdx === sortedPlayers.length - 1
                                          }
                                          onClick={() =>
                                            handleMoveGrandPrixOrder(
                                              gradeId,
                                              pIdx,
                                              1
                                            )
                                          }
                                          className="w-6 h-7 flex items-center justify-center text-[#525252] hover:bg-[#f4f4f5] hover:text-[#171717] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-0 bg-transparent"
                                          title="뒤 순서로 이동"
                                        >
                                          <ChevronDown
                                            size={13}
                                            strokeWidth={1.75}
                                          />
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <BibTag
                                      number={playerNumber}
                                      className={
                                        playerNoShow
                                          ? "line-through opacity-50"
                                          : ""
                                      }
                                    />
                                  </td>
                                  <td
                                    className={`py-3 px-4 text-sm font-medium whitespace-nowrap ${
                                      playerNoShow
                                        ? "text-[#dc2626] line-through"
                                        : "text-[#171717]"
                                    }`}
                                  >
                                    {playerName}
                                  </td>
                                  <td
                                    className={`py-3 px-4 text-sm ${
                                      playerNoShow
                                        ? "text-[#737373] line-through"
                                        : "text-[#525252]"
                                    }`}
                                  >
                                    {playerGym || "-"}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {resolvedOrigGradeTitle && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.10] text-[11px] font-medium">
                                          {isForce &&
                                          resolvedOrigGradeTitle === gradeTitle
                                            ? resolvedOrigGradeTitle
                                            : `${resolvedOrigGradeTitle} 1위`}
                                        </span>
                                      )}
                                      {wasGradeChangedInOriginal && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#737373] border border-[#171717]/[0.08] text-[11px]">
                                          원체급 월체 (체급순 반영)
                                        </span>
                                      )}
                                      {isForce && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] border border-[#2563eb]/20 text-[11px] font-medium">
                                          강제등록
                                        </span>
                                      )}
                                      {playerNoShow && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.10] text-[#dc2626] border border-[#dc2626]/20 text-[11px] font-medium">
                                          불참
                                        </span>
                                      )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-center whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPlayer(player);
                                          setEditDrawerOpen(true);
                                        }}
                                        className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-[6px] border border-[#171717]/[0.12] bg-white hover:bg-[#f4f4f5] text-[11px] font-medium text-[#171717] transition-colors cursor-pointer whitespace-nowrap"
                                        title="그랑프리 레이어 선수 정보 직접 수정"
                                      >
                                        <Pencil size={11} strokeWidth={1.75} />
                                        <span>수정</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContestPlayerOrderTableGrandPrix;
