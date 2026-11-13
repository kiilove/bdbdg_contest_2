import React, { useContext, useEffect, useState } from "react";
import LoadingPage from "./LoadingPage";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import {
  generateToday,
  isGrandPrixPlayerEntry,
} from "../functions/functions";
import {
  Trophy,
  Save,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import BibTag from "../components/ui/BibTag";

const getPlayerUniqueKey = (p) =>
  String(p?.playerUid || p?.playerNumber || p?.playerName || "");

const normalizeGradeGrandPrixOrder = (gradePlayers, markCustom = false) =>
  gradePlayers.map((player, idx) => {
    const nextIdx = idx + 1;
    return {
      ...player,
      grandPrixIndex: nextIdx,
      playerIndex: nextIdx,
      isGradeChange: false,
      isGradeChanged: false,
      ...(markCustom ? { isCustomGrandPrixIndex: true } : {}),
    };
  });

const sortByWonGradeOrder = (a, b) => {
  const gradeOrderDiff =
    Number(a?.originalGradeIndex ?? 9999) -
    Number(b?.originalGradeIndex ?? 9999);
  if (gradeOrderDiff !== 0) return gradeOrderDiff;
  return Number(a?.playerNumber || 0) - Number(b?.playerNumber || 0);
};

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
      setResultFinalArray([...(resultDocs || [])]);
    } catch (error) {
      console.error(error);
    }
  };

  const initGrandPrixPlayers = (
    resultInfo,
    categories,
    grades,
    existingFinalPlayers = []
  ) => {
    let dummy = [];

    const gradeById = new Map(
      (grades || []).map((g) => [g?.contestGradeId, g])
    );
    const categoryById = new Map(
      (categories || []).map((c) => [c?.contestCategoryId, c])
    );

    // 정규 종목 출전 엔트리에서 프로필/무대 사진 및 원체급 월체 이력(참고용) 조회
    const regularByUidAndGrade = new Map();
    const photoByUid = new Map();
    const savedGpByGradeAndKey = new Map();

    (existingFinalPlayers || []).forEach((fp) => {
      if (!fp) return;
      const uKey = getPlayerUniqueKey(fp);
      const isGpLike = isGrandPrixPlayerEntry(fp);

      if (isGpLike && fp.contestGradeId && uKey) {
        savedGpByGradeAndKey.set(`${fp.contestGradeId}_${uKey}`, fp);
      } else {
        if (fp.contestGradeId && uKey) {
          regularByUidAndGrade.set(`${fp.contestGradeId}_${uKey}`, fp);
        }
        if (fp.playerUid && !photoByUid.has(fp.playerUid)) {
          const photoFields = {};
          [
            "stagePhoto1",
            "stagePhoto2",
            "stagePhotoUrl1",
            "stagePhotoUrl2",
            "stagePhotoUrl",
            "profileImageUrl",
            "photoUrl",
            "playerPhoto",
            "photos",
          ].forEach((field) => {
            if (fp[field] !== undefined && fp[field] !== "") {
              photoFields[field] = fp[field];
            }
          });
          if (Object.keys(photoFields).length > 0) {
            photoByUid.set(fp.playerUid, photoFields);
          }
        }
      }
    });

    const filteredCategories = (categories || [])
      .filter((f) => f.contestCategorySection === "그랑프리")
      .sort(
        (a, b) =>
          (Number(a?.contestCategoryIndex) || 0) -
          (Number(b?.contestCategoryIndex) || 0)
      );

    const filteredGrades = filteredCategories.reduce((acc, category) => {
      const matchingGrades = (grades || [])
        .filter((grade) => grade.refCategoryId === category.contestCategoryId)
        .sort(
          (a, b) =>
            (Number(a?.contestGradeIndex) || 0) -
            (Number(b?.contestGradeIndex) || 0)
        );
      return [...acc, ...matchingGrades];
    }, []);

    const flattenedWinner = (resultInfo || [])
      .map((infoItem) => {
        const {
          result: playerResult,
          contestId,
          categoryId,
          gradeId,
          categoryTitle,
          gradeTitle,
        } = infoItem || {};

        const findWinner = playerResult?.find(
          (f) => Number(f?.playerRank) === 1
        );
        if (!findWinner) return null;

        const wonGrade =
          gradeById.get(gradeId) ||
          (grades || []).find(
            (g) =>
              g.refCategoryId === categoryId &&
              g.contestGradeTitle === gradeTitle
          );
        const originalGradeIndex = Number.isFinite(
          Number(wonGrade?.contestGradeIndex)
        )
          ? Number(wonGrade.contestGradeIndex)
          : 9999;

        const winnerKey = getPlayerUniqueKey(findWinner);
        const regularEntry = regularByUidAndGrade.get(
          `${gradeId}_${winnerKey}`
        );
        const inheritedPhotos = findWinner.playerUid
          ? photoByUid.get(findWinner.playerUid) || {}
          : {};

        return {
          ...inheritedPhotos,
          contestId,
          originalCategoryId: categoryId,
          originalGradeId: gradeId,
          originalGradeIndex,
          originalcategoryTitle: categoryTitle,
          originalgradeTitle: wonGrade?.contestGradeTitle || gradeTitle,
          wasGradeChangedInOriginal: Boolean(
            regularEntry?.isGradeChanged || regularEntry?.isGradeChange
          ),
          playerName: findWinner.playerName,
          playerNumber: findWinner.playerNumber,
          playerGym: findWinner.playerGym,
          playerUid: findWinner.playerUid,
          totalScore: findWinner.totalScore,
          // 그랑프리에서는 월체를 완전히 무시하고 체급 순서(grandPrixIndex)로만 무대에 정렬
          isGradeChange: false,
          isGradeChanged: false,
          createBy: "web",
          id: "",
          invoiceCreateAt: generateToday(),
          invoiceId: "",
          playerTel: regularEntry?.playerTel || "",
          playerText: regularEntry?.playerText || "",
          playerNoShow: false,
        };
      })
      .filter(Boolean);

    filteredGrades.forEach((grade) => {
      const parentCategory = categoryById.get(grade.refCategoryId);
      const filteredMatching = flattenedWinner.filter(
        (f) => f.originalCategoryId === grade.originalRefCategoryId
      );

      // 강제 등록(createdBy === 'force')으로 해당 그랑프리 체급에 직접 추가된 선수도 함께 포함
      const forceEntriesInGrade = (existingFinalPlayers || []).filter(
        (fp) =>
          fp?.contestGradeId === grade.contestGradeId &&
          (fp?.createdBy === "force" || fp?.createBy === "force")
      );

      const seenPlayers = new Set();
      const candidates = [];

      filteredMatching.forEach((match) => {
        const playerKey = getPlayerUniqueKey(match);
        if (!playerKey || seenPlayers.has(playerKey)) return;
        seenPlayers.add(playerKey);

        const saved = savedGpByGradeAndKey.get(
          `${grade.contestGradeId}_${playerKey}`
        );
        candidates.push({
          ...match,
          contestCategoryId: grade.refCategoryId,
          contestCategoryTitle:
            parentCategory?.contestCategoryTitle || "그랑프리",
          contestCategorySection: "그랑프리",
          contestGradeId: grade.contestGradeId,
          contestGradeTitle: grade.contestGradeTitle,
          playerNoShow: Boolean(saved?.playerNoShow ?? match.playerNoShow),
          savedGrandPrixIndex: Number.isFinite(Number(saved?.grandPrixIndex))
            ? Number(saved.grandPrixIndex)
            : null,
          isCustomGrandPrixIndex: Boolean(saved?.isCustomGrandPrixIndex),
        });
      });

      forceEntriesInGrade.forEach((fp) => {
        const playerKey = getPlayerUniqueKey(fp);
        if (!playerKey || seenPlayers.has(playerKey)) return;
        seenPlayers.add(playerKey);

        const wonGrade = fp.originalGradeId
          ? gradeById.get(fp.originalGradeId)
          : null;
        const resolvedWonOrder = Number.isFinite(
          Number(fp.originalGradeIndex ?? wonGrade?.contestGradeIndex)
        )
          ? Number(fp.originalGradeIndex ?? wonGrade?.contestGradeIndex)
          : 9999;

        candidates.push({
          ...fp,
          contestCategoryId: grade.refCategoryId,
          contestCategoryTitle:
            parentCategory?.contestCategoryTitle ||
            fp.contestCategoryTitle ||
            "그랑프리",
          contestCategorySection: "그랑프리",
          contestGradeId: grade.contestGradeId,
          contestGradeTitle: grade.contestGradeTitle,
          originalGradeIndex: resolvedWonOrder,
          isGradeChange: false,
          isGradeChanged: false,
          savedGrandPrixIndex: Number.isFinite(Number(fp?.grandPrixIndex))
            ? Number(fp.grandPrixIndex)
            : null,
          isCustomGrandPrixIndex: Boolean(fp?.isCustomGrandPrixIndex),
        });
      });

      // 기본 정렬: 월체/선수번호 무시, 오직 하위 우승 체급 순서(contestGradeIndex) 기준!
      // 단, 운영자가 수동 조정 후 저장한 경우(isCustomGrandPrixIndex) 저장된 grandPrixIndex 우선 반영
      const hasCustomSavedOrder = candidates.some(
        (c) => c.isCustomGrandPrixIndex && c.savedGrandPrixIndex !== null
      );

      candidates.sort((a, b) => {
        if (hasCustomSavedOrder) {
          const aSaved = a.savedGrandPrixIndex ?? 9999;
          const bSaved = b.savedGrandPrixIndex ?? 9999;
          if (aSaved !== bSaved) return aSaved - bSaved;
        }
        return sortByWonGradeOrder(a, b);
      });

      const orderedForGrade = candidates.map((item, idx) => {
        const { savedGrandPrixIndex, ...rest } = item;
        const gpIndex = idx + 1;
        return {
          ...rest,
          grandPrixIndex: gpIndex,
          playerIndex: gpIndex,
          isGradeChange: false,
          isGradeChanged: false,
        };
      });

      dummy = [...dummy, ...orderedForGrade];
    });

    const uniqueMap = new Map();
    dummy.forEach((p) => {
      const uniqueKey = `${p.contestGradeId}_${getPlayerUniqueKey(p)}`;
      if (!uniqueMap.has(uniqueKey)) {
        uniqueMap.set(uniqueKey, p);
      }
    });

    return Array.from(uniqueMap.values());
  };

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
          dedupedGrandPrixData.push({
            ...p,
            grandPrixIndex: gpIdx,
            playerIndex: gpIdx,
            isGradeChange: false,
            isGradeChanged: false,
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

      const latestFinalDoc = await fetchPlayerFinal.getDocument(playersFinalId);
      const baseFinalList = latestFinalDoc || playersFinalList || {};
      const baseFinalPlayers = Array.isArray(latestFinalDoc?.players)
        ? latestFinalDoc.players
        : playersFinalArray || [];

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

      const incomingKeySet = new Set(
        dedupedGrandPrixData.map(
          (p) => `${p.contestGradeId}_${getPlayerUniqueKey(p)}`
        )
      );

      // 기존 baseFinalPlayers에서 일반 종목 엔트리는 그대로 유지하고,
      // 아직 집계되지 않은 다른 그랑프리 체급의 강제 등록(force) 선수도 보존
      const nonGrandPrixPlayers = baseFinalPlayers.filter((p) => {
        if (!grandPrixGradeIds.has(p?.contestGradeId)) return true;
        const pKey = `${p.contestGradeId}_${getPlayerUniqueKey(p)}`;
        if (incomingKeySet.has(pKey)) return false;
        return p?.createdBy === "force" || p?.createBy === "force";
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
    if (grandPrixArray.length > 0) {
      initPlayersFinalList(categoriesArray, gradesArray, grandPrixArray);
    } else {
      setMatchedArray([]);
    }
  }, [grandPrixArray, categoriesArray, gradesArray]);

  useEffect(() => {
    if (categoriesArray?.length > 0 && gradesArray?.length > 0) {
      setGrandPrixArray([
        ...initGrandPrixPlayers(
          resultPlayersArray,
          categoriesArray,
          gradesArray,
          playersFinalArray
        ),
      ]);
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
                                originalgradeTitle,
                                wasGradeChangedInOriginal,
                                createdBy,
                                createBy,
                              } = player;
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
                                      {originalgradeTitle && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.10] text-[11px] font-medium">
                                          {originalgradeTitle} 1위
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
