"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import LoadingPage from "./LoadingPage";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { doc, runTransaction, where } from "firebase/firestore";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import ConfirmModalTrigger from "../components/ui/ConfirmModalTrigger";
import ContestHealthCheckModal from "../modals/ContestHealthCheckModal";
import { Checkbox } from "antd";
import {
  Save,
  GripVertical,
  Calendar,
  AlertTriangle,
  Trash2,
  CheckSquare,
  Eraser,
  RotateCcw,
  FolderOpen,
  Globe,
  PenLine,
  Pencil,
  UserPlus,
  Hash,
} from "lucide-react";
import BibTag from "../components/ui/BibTag";
import LayerPlayerEditDrawer from "../components/player/LayerPlayerEditDrawer";
import { sanitizeForFirestore } from "../utils/firestoreSanitize";
import { resolveEntryOrigin } from "../utils/playerEntryUtils";
import {
  applyStage1AssignDirectEdit,
  buildPatchedLayerPlayer,
  isSameLayerPlayerEntry,
} from "../utils/layerPlayerEditUtils";

let orderRowCounter = 0;
const createOrderRowId = () =>
  `ord_${++orderRowCounter}_${Math.random().toString(36).slice(2, 7)}`;

const stripInternalPlayerProps = (player) => {
  if (!player || typeof player !== "object") return player;
  const { _rowId, ...rest } = player;
  return rest;
};

const getPlayerRowEntryKey = (player, fallbackIdx = 0) => {
  if (player?._rowId) return player._rowId;
  return `${player?.contestGradeId || "g"}:${player?.playerUid || "u"}:${
    player?.playerNumber ?? fallbackIdx
  }`;
};

const ContestPlayerOrderTable = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [matchedArray, setMatchedArray] = useState([]);
  const [categorysArray, setCategorysArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [entrysArray, setEntrysArray] = useState([]);
  const [playersAssign, setPlayersAssign] = useState({}); // assign만 관리
  const [startPlayerNumber, setStartPlayerNumber] = useState(0);

  // ✅ 개별 항목 선택 상태 (고유 행 key 기준)
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [isDirectSaving, setIsDirectSaving] = useState(false);
  const deletedSignaturesRef = useRef(new Set());

  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersAssignDocument = useFirestoreGetDocument(
    "contest_players_assign"
  );
  const updatePlayersAssign = useFirestoreUpdateData("contest_players_assign");
  const updatePlayersFinal = useFirestoreUpdateData("contest_players_final");
  const fetchEntry = useFirestoreQuery();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 공통 재배정 유틸: 전체 일련번호/표시순서를 startBase+1부터 부여 (항상 정렬 및 고유 _rowId 보장)
  const renumberAll = (arr, startBase) => {
    const sortedGroups = [...arr]
      .sort(
        (a, b) =>
          (a.contestCategoryIndex ?? 9999) - (b.contestCategoryIndex ?? 9999) ||
          (a.contestGradeIndex ?? 9999) - (b.contestGradeIndex ?? 9999)
      )
      .map((m) => ({
        ...m,
        matchedPlayers: (m.matchedPlayers || []).map((p) => ({
          ...p,
          _rowId: p._rowId || createOrderRowId(),
        })),
      }));

    let seq = 0;
    sortedGroups.forEach((group) => {
      group.matchedPlayers.forEach((p) => {
        const num = seq + startBase + 1;
        p.playerNumber = num;
        p.playerIndex = num;
        seq++;
      });
    });

    return sortedGroups;
  };

  const fetchPool = async () => {
    if (!currentContest?.contests?.id) return;
    setIsLoading(true);

    try {
      const configuredStart = Number(currentContest.contests.startPlayerNumber);
      // DB에 startPlayerNumber가 없으면 기본 1번부터 시작 (내부 계산 편의를 위해 -1 보정 → 0)
      setStartPlayerNumber(
        Number.isFinite(configuredStart) && configuredStart >= 1
          ? configuredStart - 1
          : 0
      );

      // 카테고리
      if (currentContest.contests.contestCategorysListId) {
        const returnCategorys = await fetchCategoryDocument.getDocument(
          currentContest.contests.contestCategorysListId
        );
        if (returnCategorys?.categorys?.length > 0) {
          setCategorysArray([
            ...returnCategorys.categorys
              .slice()
              .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex),
          ]);
        } else {
          setCategorysArray([]);
        }
      }

      // 그레이드
      if (currentContest.contests.contestGradesListId) {
        const returnGrades = await fetchGradeDocument.getDocument(
          currentContest.contests.contestGradesListId
        );
        setGradesArray([...(returnGrades?.grades || [])]);
      }

      // 엔트리
      const condition = [where("contestId", "==", currentContest.contests.id)];
      const returnEntrys = await fetchEntry.getDocuments(
        "contest_entrys_list",
        condition
      );
      setEntrysArray([...(returnEntrys || [])]);

      // assign (저장본)
      if (currentContest.contests.contestPlayersAssignId) {
        const returnPlayersAssign = await fetchPlayersAssignDocument.getDocument(
          currentContest.contests.contestPlayersAssignId
        );
        setPlayersAssign({ ...(returnPlayersAssign || {}) });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // 엔트리 기준 초기 구성
  const initEntryList = () => {
    const dummy = [];
    let playerNumber = startPlayerNumber;

    const categories = [...categorysArray].sort(
      (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
    );

    categories.forEach((category) => {
      const matchedGrades = [...gradesArray]
        .filter((grade) => grade.refCategoryId === category.contestCategoryId)
        .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex);

      const matchedGradesLength = matchedGrades.length;

      matchedGrades.forEach((grade) => {
        const matchedPlayers = entrysArray.filter(
          (entry) => entry.contestGradeId === grade.contestGradeId
        );

        const withNumbers = matchedPlayers.map((player) => {
          playerNumber++;
          return {
            ...player,
            _rowId: createOrderRowId(),
            playerNumber: playerNumber,
            playerNoShow: false,
            playerIndex: playerNumber,
          };
        });

        const matchedInfo = {
          ...category,
          ...grade,
          matchedPlayers: withNumbers,
          matchedGradesLength,
        };
        dummy.push(matchedInfo);
      });
    });

    deletedSignaturesRef.current = new Set();
    setMatchedArray(renumberAll(dummy, startPlayerNumber));
    setSelectedEntries(new Set());
  };

  // assign 저장본으로 화면 재구성 (수동 수정된 선수번호/순번 보존)
  const rebuildFromAssign = (explicitAssignedList = null) => {
    const grouped = {};
    const sortedCategories = [...categorysArray].sort(
      (a, b) => (a.contestCategoryIndex ?? 9999) - (b.contestCategoryIndex ?? 9999)
    );
    sortedCategories.forEach((cat) => {
      const catGrades = [...gradesArray]
        .filter((g) => g.refCategoryId === cat.contestCategoryId)
        .sort((a, b) => (a.contestGradeIndex ?? 9999) - (b.contestGradeIndex ?? 9999));
      catGrades.forEach((grd) => {
        const key = `${cat.contestCategoryId}__${grd.contestGradeId}`;
        grouped[key] = {
          ...cat,
          ...grd,
          contestCategoryId: cat.contestCategoryId,
          contestCategoryTitle: cat.contestCategoryTitle,
          contestGradeId: grd.contestGradeId,
          contestGradeTitle: grd.contestGradeTitle,
          matchedPlayers: [],
          matchedGradesLength: catGrades.length,
        };
      });
    });

    const assigned = Array.isArray(explicitAssignedList)
      ? explicitAssignedList
      : playersAssign?.players || [];
    let fallbackSeq = startPlayerNumber;
    assigned.forEach((p) => {
      fallbackSeq += 1;
      const key = `${p.contestCategoryId}__${p.contestGradeId}`;
      if (!grouped[key]) {
        const cat =
          categorysArray.find(
            (c) => c.contestCategoryId === p.contestCategoryId
          ) || {};
        const grd =
          gradesArray.find((g) => g.contestGradeId === p.contestGradeId) || {};
        grouped[key] = {
          ...cat,
          ...grd,
          contestCategoryId: cat.contestCategoryId || p.contestCategoryId,
          contestCategoryTitle:
            cat.contestCategoryTitle || p.contestCategoryTitle,
          contestGradeId: grd.contestGradeId || p.contestGradeId,
          contestGradeTitle: grd.contestGradeTitle || p.contestGradeTitle,
          matchedPlayers: [],
          matchedGradesLength: 1,
        };
      }
      const preservedNum = Number(p.playerNumber) > 0 ? Number(p.playerNumber) : fallbackSeq;
      const preservedIdx = Number(p.playerIndex) > 0 ? Number(p.playerIndex) : preservedNum;
      grouped[key].matchedPlayers.push({
        ...p,
        playerNumber: preservedNum,
        playerIndex: preservedIdx,
        _rowId: p._rowId || createOrderRowId(),
      });
    });

    const rebuilt = Object.values(grouped)
      .sort(
        (a, b) =>
          (a.contestCategoryIndex ?? 9999) - (b.contestCategoryIndex ?? 9999) ||
          (a.contestGradeIndex ?? 9999) - (b.contestGradeIndex ?? 9999)
      )
      .map((group) => ({
        ...group,
        matchedPlayers: [...group.matchedPlayers].sort(
          (a, b) =>
            (Number(a.playerIndex) || Number(a.playerNumber) || 0) -
            (Number(b.playerIndex) || Number(b.playerNumber) || 0)
        ),
      }));

    deletedSignaturesRef.current = new Set();
    setMatchedArray(rebuilt);
    setSelectedEntries(new Set());
  };

  // 초기 데이터 로드
  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests?.id]);

  // 카테고리/그레이드/엔트리/assign이 준비되면 화면 데이터 구성
  useEffect(() => {
    if (!categorysArray.length) return;

    // assign 저장본이 있으면 우선 사용, 없으면 엔트리로 초기화
    if (playersAssign?.players?.length > 0) {
      rebuildFromAssign();
    } else {
      initEntryList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    categorysArray,
    gradesArray,
    entrysArray,
    playersAssign,
    startPlayerNumber,
  ]);

  // ✅ 중복 계산 (그룹: contestGradeId__playerUid, 항목: 고유 entryKey = _rowId)
  const duplicatesMap = useMemo(() => {
    const groups = {};
    matchedArray.forEach((m, mIdx) => {
      const gradeId = m.contestGradeId;
      const catTitle = m.contestCategoryTitle;
      const gradeTitle = m.contestGradeTitle;

      (m.matchedPlayers || []).forEach((p, pIdx) => {
        const uidOrIdentity =
          p.playerUid || `${(p.playerName || "").trim()}_${p.playerTel || ""}`;
        const groupKey = `${gradeId}__${uidOrIdentity}`;
        const entryKey = getPlayerRowEntryKey(p, pIdx);

        if (!groups[groupKey]) {
          groups[groupKey] = {
            entries: [],
            metaGroup: {
              contestGradeId: gradeId,
              categoryTitle: catTitle,
              gradeTitle: gradeTitle,
              playerUid: p.playerUid,
              playerName: p.playerName,
            },
          };
        }

        groups[groupKey].entries.push({
          entryKey,
          mIdx,
          pIdx,
          meta: {
            playerName: p.playerName,
            playerNumber: p.playerNumber,
            invoiceCreateAt: p.invoiceCreateAt,
            playerGym: p.playerGym,
          },
        });
      });
    });

    return Object.fromEntries(
      Object.entries(groups).filter(([, v]) => (v.entries?.length || 0) > 1)
    );
  }, [matchedArray]);

  const duplicateGroupKeys = useMemo(
    () => new Set(Object.keys(duplicatesMap)),
    [duplicatesMap]
  );

  const deleteSelectedDuplicates = () => {
    if (selectedEntries.size === 0) return;

    const newMatched = matchedArray.map((m) => ({
      ...m,
      matchedPlayers: (m.matchedPlayers || []).filter((p, pIdx) => {
        const key = getPlayerRowEntryKey(p, pIdx);
        if (selectedEntries.has(key)) {
          const sig = `${p.contestGradeId || ""}__${p.playerUid || ""}__${
            p.playerNumber ?? ""
          }`;
          deletedSignaturesRef.current.add(sig);
          return false;
        }
        return true;
      }),
    }));

    setMatchedArray(renumberAll(newMatched, startPlayerNumber));
    setSelectedEntries(new Set());
  };

  // 🧹 assign & final 명단 완전 초기화(클리어) 핸들러
  const handleClearAssignAndFinal = async () => {
    const contestId = currentContest?.contests?.id;
    const assignId = currentContest?.contests?.contestPlayersAssignId;
    const finalId = currentContest?.contests?.contestPlayersFinalId;

    if (!contestId || !assignId) {
      setMessage({
        variant: "error",
        title: "문서 정보 확인 필요",
        body: "대회 정보 또는 선수 배정 문서 ID를 확인할 수 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    try {
      setIsLoading(true);
      // 1. assign 문서 비우기
      await updatePlayersAssign.updateData(assignId, {
        contestId,
        players: [],
        updatedAt: Date.now(),
      });

      // 2. final 문서 비우기 (있을 경우)
      if (finalId) {
        await updatePlayersFinal.updateData(finalId, {
          contestId,
          players: [],
          updatedAt: Date.now(),
        });
      }

      setPlayersAssign({ contestId, players: [] });
      setMatchedArray([]);
      setSelectedEntries(new Set());

      setMessage({
        variant: "success",
        title: "배정 및 최종 명단 초기화 완료",
        body: "현재 대회의 배정 명단과 최종 명단이 모두 초기화되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("초기화 실패:", error);
      setMessage({
        variant: "error",
        title: "명단 초기화 실패",
        body: "명단을 초기화하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 1단계 저장: 오직 contest_players_assign 레이어 문서만 갱신 (이미 저장된 2·3단계 문서는 역연동하지 않음)
  const handleUpdatePlayersAssign = async (assignId) => {
    const targetAssignId =
      assignId || currentContest?.contests?.contestPlayersAssignId;
    const contestId = currentContest?.contests?.id;

    if (!targetAssignId) {
      setMessage({
        variant: "error",
        title: "배정 문서 확인 필요",
        body: "선수 배정 문서를 확인할 수 없습니다. 대회를 다시 선택하거나 재로그인해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    const allPlayers = matchedArray.flatMap((m) =>
      (m.matchedPlayers || []).map(stripInternalPlayerProps)
    );

    const isForceEntry = (p) => resolveEntryOrigin(p) === "force";

    const mergePlayerPreservingAssignMeta = (ap, existingPool, usedIdxSet) => {
      const apOrigGrade = ap.originalGradeId || ap.contestGradeId;
      const matchIdx = existingPool.findIndex((efp, idx) => {
        if (usedIdxSet.has(idx) || !efp) return false;
        const efpOrigGrade = efp.originalGradeId || efp.contestGradeId;
        if (ap.playerUid && efp.playerUid) {
          return (
            efp.playerUid === ap.playerUid &&
            efp.contestCategoryId === ap.contestCategoryId &&
            efpOrigGrade === apOrigGrade
          );
        }
        return (
          (efp.playerName || "").trim() === (ap.playerName || "").trim() &&
          efp.contestCategoryId === ap.contestCategoryId &&
          efpOrigGrade === apOrigGrade
        );
      });

      if (matchIdx === -1) {
        return {
          ...ap,
          originalGradeId: apOrigGrade,
          originalGradeTitle: ap.originalGradeTitle || ap.contestGradeTitle,
        };
      }

      usedIdxSet.add(matchIdx);
      const efp = existingPool[matchIdx];

      return {
        ...efp,
        ...ap,
        originalGradeId: ap.contestGradeId,
        originalGradeTitle: ap.contestGradeTitle,
        contestGradeId: ap.contestGradeId,
        contestGradeTitle: ap.contestGradeTitle,
        playerNumber: ap.playerNumber,
        playerIndex: ap.playerIndex,
        stagePhoto1: efp.stagePhoto1 || ap.stagePhoto1 || "",
        stagePhoto2: efp.stagePhoto2 || ap.stagePhoto2 || "",
        stagePhotoUrl1: efp.stagePhotoUrl1 || ap.stagePhotoUrl1 || "",
        stagePhotoUrl2: efp.stagePhotoUrl2 || ap.stagePhotoUrl2 || "",
        stagePhotoUrl: efp.stagePhotoUrl || ap.stagePhotoUrl || "",
        profileImageUrl: efp.profileImageUrl || ap.profileImageUrl || "",
        photoUrl: efp.photoUrl || ap.photoUrl || "",
        playerPhoto: efp.playerPhoto || ap.playerPhoto || "",
        photos:
          (Array.isArray(efp.photos) && efp.photos.length > 0
            ? efp.photos
            : ap.photos) || [],
        ...(efp.createdBy || ap.createdBy
          ? { createdBy: efp.createdBy || ap.createdBy }
          : {}),
        ...(efp.createBy || ap.createBy
          ? { createBy: efp.createBy || ap.createBy }
          : {}),
      };
    };

    try {
      setIsLoading(true);
      let savedAssignDoc = null;

      await runTransaction(db, async (transaction) => {
        const assignRef = doc(db, "contest_players_assign", targetAssignId);
        const assignSnap = await transaction.get(assignRef);

        const existingAssignData = assignSnap.exists()
          ? assignSnap.data()
          : playersAssign || {};
        const existingAssignPlayers = existingAssignData?.players || [];

        const usedAssignIdx = new Set();
        const mergedAssignPlayers = allPlayers.map((ap) =>
          mergePlayerPreservingAssignMeta(ap, existingAssignPlayers, usedAssignIdx)
        );

        const isExplicitlyDeleted = (p) => {
          const sig = `${p?.contestGradeId || ""}__${p?.playerUid || ""}__${
            p?.playerNumber ?? ""
          }`;
          return deletedSignaturesRef.current.has(sig);
        };

        existingAssignPlayers.forEach((ep) => {
          if (!isForceEntry(ep) || isExplicitlyDeleted(ep)) return;
          const alreadyExists = mergedAssignPlayers.some(
            (mp) =>
              mp.contestGradeId === ep.contestGradeId &&
              ((mp.playerUid && ep.playerUid && mp.playerUid === ep.playerUid) ||
                (Number(mp.playerNumber) === Number(ep.playerNumber) &&
                  (mp.playerName || "").trim() === (ep.playerName || "").trim()))
          );
          if (!alreadyExists) {
            mergedAssignPlayers.push(stripInternalPlayerProps(ep));
          }
        });

        const nextAssignDoc = sanitizeForFirestore({
          ...existingAssignData,
          contestId,
          players: mergedAssignPlayers,
          updatedAt: new Date().toISOString(),
        });
        savedAssignDoc = nextAssignDoc;

        if (assignSnap.exists()) {
          transaction.update(assignRef, nextAssignDoc);
        } else {
          transaction.set(assignRef, nextAssignDoc);
        }
      });

      deletedSignaturesRef.current = new Set();
      if (savedAssignDoc) {
        setPlayersAssign({ ...savedAssignDoc, id: targetAssignId });
      }

      const hasDup = Object.keys(duplicatesMap).length > 0;
      setMessage({
        variant: hasDup ? "warning" : "success",
        title: hasDup
          ? "1단계 초기 배번 저장 완료 (중복 확인)"
          : "1단계 초기 배번 저장 완료",
        body: hasDup
          ? "초기 배번 문서(contest_players_assign)가 저장되었으나 중복 항목이 남아 있습니다."
          : "1단계 초기 배번 문서(contest_players_assign)에 정상 저장되었습니다. 아직 2단계를 저장하지 않았다면 다음 단계로 자동 승계됩니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("선수 배정 저장 에러:", error);
      setMessage({
        variant: "error",
        title: "선수 배정 저장 실패",
        body: "선수 배정 데이터를 저장하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 1단계 개별 선수 직접 수정 저장 (contest_players_assign 단독 반영)
  const handleDirectEditAssignSave = async (beforePlayer, patchFields) => {
    const targetAssignId = currentContest?.contests?.contestPlayersAssignId;
    const contestId = currentContest?.contests?.id;

    if (!targetAssignId) {
      setMessage({
        variant: "error",
        title: "배정 문서 확인 필요",
        body: "선수 배정 문서를 확인할 수 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    try {
      setIsDirectSaving(true);
      const nowIso = new Date().toISOString();
      const currentScreenFlat = matchedArray.flatMap((m) =>
        (m.matchedPlayers || []).map(stripInternalPlayerProps)
      );

      let committedAssignDoc = null;
      let committedList = [];

      await runTransaction(db, async (transaction) => {
        const assignRef = doc(db, "contest_players_assign", targetAssignId);
        const assignSnap = await transaction.get(assignRef);
        const existingAssignData = assignSnap.exists()
          ? assignSnap.data()
          : playersAssign || {};
        const baseList =
          Array.isArray(existingAssignData?.players) &&
          existingAssignData.players.length > 0
            ? existingAssignData.players
            : currentScreenFlat;

        const nextPlayers = applyStage1AssignDirectEdit(
          baseList,
          beforePlayer,
          patchFields,
          nowIso
        );

        const nextDoc = sanitizeForFirestore({
          ...existingAssignData,
          contestId,
          players: nextPlayers,
          updatedAt: nowIso,
        });

        if (assignSnap.exists()) {
          transaction.update(assignRef, nextDoc);
        } else {
          transaction.set(assignRef, nextDoc);
        }

        committedAssignDoc = nextDoc;
        committedList = nextPlayers;
      });

      // 화면 로컬 상태도 즉시 갱신 (다른 번호는 건드리지 않고 수정 행만 반영)
      const patchedLocalPlayer = {
        ...buildPatchedLayerPlayer(beforePlayer, patchFields, {
          layer: "assign",
          nowIso,
        }),
        _rowId: beforePlayer._rowId || createOrderRowId(),
      };

      setMatchedArray((prev) => {
        const strippedGroups = prev.map((group) => ({
          ...group,
          matchedPlayers: (group.matchedPlayers || []).filter(
            (p) =>
              p._rowId !== beforePlayer._rowId &&
              !isSameLayerPlayerEntry(p, beforePlayer)
          ),
        }));

        const targetGroupIdx = strippedGroups.findIndex(
          (g) => g.contestGradeId === patchedLocalPlayer.contestGradeId
        );
        if (targetGroupIdx >= 0) {
          strippedGroups[targetGroupIdx] = {
            ...strippedGroups[targetGroupIdx],
            matchedPlayers: [
              ...strippedGroups[targetGroupIdx].matchedPlayers,
              patchedLocalPlayer,
            ].sort(
              (a, b) =>
                (Number(a.playerIndex) || Number(a.playerNumber) || 0) -
                (Number(b.playerIndex) || Number(b.playerNumber) || 0)
            ),
          };
          return strippedGroups;
        }
        return prev;
      });

      if (committedAssignDoc) {
        setPlayersAssign({ ...committedAssignDoc, id: targetAssignId });
      } else if (committedList.length > 0) {
        rebuildFromAssign(committedList);
      }

      setEditDrawerOpen(false);
      setEditingPlayer(null);
    } catch (error) {
      console.error("1단계 선수 직접 수정 실패:", error);
      setMessage({
        variant: "error",
        title: "선수 정보 수정 실패",
        body: "1단계 초기 배번 문서에 선수 정보를 저장하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsDirectSaving(false);
    }
  };

  // DnD: 숫자 index 사용, parent는 droppableId로 구분
  const onDragPlayerEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const fromGradeId = source.droppableId.replace("players_", "");
    const toGradeId = destination.droppableId.replace("players_", "");

    const newMatchedArray = matchedArray.map((m) => ({
      ...m,
      matchedPlayers: [...(m.matchedPlayers || [])],
    }));

    const fromIdx = newMatchedArray.findIndex(
      (m) => m.contestGradeId === fromGradeId
    );
    const toIdx = newMatchedArray.findIndex(
      (m) => m.contestGradeId === toGradeId
    );
    if (fromIdx < 0 || toIdx < 0) return;

    const [dragged] = newMatchedArray[fromIdx].matchedPlayers.splice(
      source.index,
      1
    );
    newMatchedArray[toIdx].matchedPlayers.splice(destination.index, 0, dragged);

    setMatchedArray(renumberAll(newMatchedArray, startPlayerNumber));
    setSelectedEntries(new Set());
  };

  const PlayerCardView = ({
    player,
    index,
    provided,
    snapshot,
    isDuplicate,
    entryKey,
  }) => {
    const { playerName, playerGym, playerNumber, invoiceCreateAt } = player;
    const entryOrigin = resolveEntryOrigin(player);
    const checked = selectedEntries.has(entryKey);

    return (
      <div
        className={`rounded-[8px] border p-3.5 bg-[#ffffff] transition-colors duration-150 ${
          snapshot.isDragging
            ? "border-[#2563eb] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            : isDuplicate
            ? "border-[#dc2626]/40 bg-[#dc2626]/[0.03]"
            : "border-[#171717]/[0.08]"
        }`}
        ref={provided.innerRef}
        {...provided.dragHandleProps}
        {...provided.draggableProps}
      >
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <GripVertical
                size={16}
                strokeWidth={1.5}
                className="text-[#737373]"
              />
              <span className="text-xs font-medium text-[#737373] font-mono tabular-nums">
                순번 {index + 1}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isDuplicate && (
                <>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.10] text-[#dc2626] text-[11px] font-medium">
                    중복
                  </span>
                  <Checkbox
                    checked={checked}
                    onChange={(e) => {
                      setSelectedEntries((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(entryKey);
                        else next.delete(entryKey);
                        return next;
                      });
                    }}
                  >
                    <span className="text-xs text-[#dc2626]">삭제 대상</span>
                  </Checkbox>
                </>
              )}
              <BibTag number={playerNumber} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingPlayer(player);
                  setEditDrawerOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-[6px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#525252] hover:text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer shrink-0"
              >
                <Pencil size={12} strokeWidth={1.6} />
                <span>수정</span>
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-sm text-[#171717]">
                {playerName}
              </span>
              {entryOrigin === "force" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] border border-[#2563eb]/20 text-[11px] font-medium">
                  <UserPlus size={11} strokeWidth={1.5} />
                  <span>강제</span>
                </span>
              )}
              {entryOrigin === "manual" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#16a34a]/[0.08] text-[#16a34a] border border-[#16a34a]/20 text-[11px] font-medium">
                  <PenLine size={11} strokeWidth={1.5} />
                  <span>수기</span>
                </span>
              )}
              {entryOrigin === "web" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#525252] border border-[#171717]/[0.08] text-[11px] font-medium">
                  <Globe size={11} strokeWidth={1.5} />
                  <span>웹</span>
                </span>
              )}
            </div>
            <div className="text-[#525252] text-xs">{playerGym || "-"}</div>
            {invoiceCreateAt && (
              <div className="text-[#737373] text-xs flex items-center gap-1 font-mono tabular-nums">
                <Calendar size={12} strokeWidth={1.5} />
                <span>{invoiceCreateAt}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const DuplicateSummary = () => {
    const dupEntries = Object.entries(duplicatesMap);
    if (dupEntries.length === 0) return null;

    const selectAll = () => {
      const all = new Set();
      dupEntries.forEach(([, info]) => {
        info.entries.forEach((e) => all.add(e.entryKey));
      });
      setSelectedEntries(all);
    };

    const clearAll = () => setSelectedEntries(new Set());

    return (
      <div className="bg-[#ffffff] rounded-[12px] border border-[#dc2626]/25 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[#dc2626]">
            <AlertTriangle size={16} strokeWidth={1.5} />
            <span className="text-sm font-semibold">
              동일 체급 내 중복 출전 감지 ({dupEntries.length}그룹)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] text-xs font-medium border border-[#171717]/[0.08] transition-colors duration-150 cursor-pointer"
            >
              <CheckSquare size={14} strokeWidth={1.5} className="text-[#525252]" />
              <span>모두 선택</span>
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#525252] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer"
            >
              <Eraser size={14} strokeWidth={1.5} className="text-[#525252]" />
              <span>선택 해제</span>
            </button>
            <button
              type="button"
              onClick={deleteSelectedDuplicates}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#dc2626]/[0.08] hover:bg-[#dc2626]/[0.14] text-[#dc2626] text-xs font-medium border border-[#dc2626]/25 transition-colors duration-150 cursor-pointer"
            >
              <Trash2 size={14} strokeWidth={1.5} />
              <span>선택 항목 삭제</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-[#171717]/[0.06]">
          {dupEntries.map(([groupKey, info]) => (
            <div
              key={groupKey}
              className="rounded-[8px] border border-[#171717]/[0.08] bg-[#fafafa] p-3 space-y-1.5"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.10] text-[#dc2626] text-[11px] font-medium tabular-nums">
                  중복 {info.entries.length}건
                </span>
                <span className="text-xs font-semibold text-[#171717]">
                  {info.metaGroup.playerName}
                </span>
                <span className="text-xs text-[#525252]">
                  ({info.metaGroup.categoryTitle} / {info.metaGroup.gradeTitle})
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {info.entries.map((e, idx) => {
                  const checked = selectedEntries.has(e.entryKey);
                  return (
                    <div
                      key={e.entryKey}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onChange={(evt) =>
                            setSelectedEntries((prev) => {
                              const next = new Set(prev);
                              if (evt.target.checked) next.add(e.entryKey);
                              else next.delete(e.entryKey);
                              return next;
                            })
                          }
                        />
                        <span className="text-xs text-[#525252] tabular-nums">
                          항목 {idx + 1} · 번호 #{e.meta.playerNumber} · 소속{" "}
                          {e.meta.playerGym || "-"} · 신청일{" "}
                          {e.meta.invoiceCreateAt || "-"}
                        </span>
                      </label>
                      <span className="text-[11px] font-mono text-[#737373]">
                        {e.entryKey}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full space-y-4 pt-2 text-[#171717]">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <>
          <ConfirmationModal
            isOpen={msgOpen}
            message={message}
            onCancel={() => setMsgOpen(false)}
            onConfirm={() => setMsgOpen(false)}
          />

          <ContestHealthCheckModal
            isOpen={healthModalOpen}
            onClose={() => setHealthModalOpen(false)}
          />

          <LayerPlayerEditDrawer
            open={editDrawerOpen}
            onClose={() => {
              if (!isDirectSaving) {
                setEditDrawerOpen(false);
                setEditingPlayer(null);
              }
            }}
            layer="assign"
            player={editingPlayer}
            categoriesArray={categorysArray}
            gradesArray={gradesArray}
            allLayerPlayers={matchedArray.flatMap((m) => m.matchedPlayers || [])}
            onSave={handleDirectEditAssignSave}
            isSaving={isDirectSaving}
          />

          {!currentContest?.contests?.contestPlayersAssignId && (
            <div className="bg-[#b45309]/[0.06] border border-[#b45309]/25 rounded-[12px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#b45309] mt-0.5 shrink-0"
                />
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-[#171717]">
                    관련 문서를 확인할 수 없습니다
                  </div>
                  <div className="text-xs text-[#525252]">
                    대회 필수 데이터 구조가 아직 생성되지 않았거나 연결이 누락되었을 수 있습니다.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHealthModalOpen(true)}
                className="inline-flex items-center justify-center h-9 px-3.5 rounded-[8px] bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-medium transition-colors duration-150 cursor-pointer border-0 shrink-0"
              >
                대회 구조 점검 및 복구
              </button>
            </div>
          )}

          {/* 상단 중복 요약 */}
          <DuplicateSummary />

          {/* 액션 툴바 */}
          <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 flex flex-col lg:flex-row w-full justify-between lg:items-center gap-3">
            <div className="flex items-center gap-2">
              <ConfirmModalTrigger
                variant="danger"
                title="배정 및 최종 명단 비우기"
                body="현재 대회의 선수 번호 배정 명단과 계측 최종 명단을 모두 빈 상태로 초기화합니다."
                body2="원본 참가 신청서 데이터는 그대로 보존되며, 언제든 번호 재계산으로 다시 구성할 수 있습니다."
                onConfirm={handleClearAssignAndFinal}
                confirmText="초기화 실행"
                cancelText="취소"
              >
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#dc2626]/[0.06] hover:bg-[#dc2626]/[0.12] text-[#dc2626] text-xs font-medium border border-[#dc2626]/25 transition-colors duration-150 cursor-pointer"
                >
                  <Trash2 size={15} strokeWidth={1.5} />
                  <span>배정명단 초기화 (비우기)</span>
                </button>
              </ConfirmModalTrigger>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setMatchedArray((prev) => renumberAll(prev, startPlayerNumber))
                }
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer"
                title="현재 순서 기준으로 시작번호부터 일련번호를 다시 매깁니다"
              >
                <Hash
                  size={15}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
                <span>일련번호 재정렬</span>
              </button>
              <button
                type="button"
                onClick={() => initEntryList()}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer"
              >
                <RotateCcw
                  size={15}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
                <span>신청서 기준 번호 재계산</span>
              </button>
              <button
                type="button"
                onClick={() => rebuildFromAssign()}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] text-xs font-medium border border-[#171717]/[0.08] transition-colors duration-150 cursor-pointer"
              >
                <FolderOpen
                  size={15}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
                <span>저장본 불러오기</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdatePlayersAssign(
                    currentContest?.contests?.contestPlayersAssignId
                  )
                }
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors duration-150 cursor-pointer border-0"
              >
                <Save size={15} strokeWidth={1.5} />
                <span>계측명단 저장</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {matchedArray.length > 0 &&
              matchedArray.map((matched, mIdx) => {
                const {
                  contestCategoryTitle: categoryTitle,
                  contestGradeTitle: gradeTitle,
                  contestGradeId,
                  matchedPlayers = [],
                } = matched;

                if (matchedPlayers.length === 0) return null;

                return (
                  <div
                    key={`${contestGradeId}_${mIdx}`}
                    className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
                  >
                    <div className="bg-[#f4f4f5] px-5 py-3 border-b border-[#171717]/[0.08] flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#171717]">
                        {categoryTitle}
                        <span className="text-[#525252] font-normal mx-1.5">
                          /
                        </span>
                        <span className="font-medium">{gradeTitle}</span>
                      </span>
                      <span className="text-xs font-medium text-[#525252] font-mono tabular-nums">
                        {matchedPlayers.length}명
                      </span>
                    </div>

                    <DragDropContext onDragEnd={onDragPlayerEnd}>
                      <Droppable droppableId={`players_${contestGradeId}`}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                          >
                            {/* 데스크톱 테이블 */}
                            {!isMobile && (
                              <div className="flex flex-col w-full">
                                <div className="flex w-full border-b border-[#171717]/[0.08] h-10 items-center text-xs font-medium text-[#525252] bg-[#fafafa] px-4">
                                  <div className="flex w-12 items-center">
                                    <GripVertical
                                      size={14}
                                      strokeWidth={1.5}
                                      className="text-[#737373]"
                                    />
                                  </div>
                                  <div className="flex w-16">순번</div>
                                  <div className="flex w-28">선수번호</div>
                                  <div className="flex flex-1 min-w-[200px]">
                                    이름
                                  </div>
                                  <div className="flex w-3/12">소속</div>
                                  <div className="flex w-28">신청일</div>
                                  <div className="flex w-20 justify-center">
                                    관리
                                  </div>
                                </div>

                                {matchedPlayers.map((player, pIdx) => {
                                  const {
                                    playerName,
                                    playerGym,
                                    playerUid,
                                    playerNumber,
                                    invoiceCreateAt,
                                  } = player;
                                  const entryOrigin =
                                    resolveEntryOrigin(player);

                                  const uidOrIdentity =
                                    playerUid ||
                                    `${(playerName || "").trim()}_${
                                      player.playerTel || ""
                                    }`;
                                  const dupGroupKey = `${contestGradeId}__${uidOrIdentity}`;
                                  const isDuplicate =
                                    duplicateGroupKeys.has(dupGroupKey);
                                  const entryKey = getPlayerRowEntryKey(
                                    player,
                                    pIdx
                                  );
                                  const checked = selectedEntries.has(entryKey);
                                  const uniqueDraggableId = `${
                                    contestGradeId || "g"
                                  }-${playerUid || "u"}-${
                                    player._rowId || `${playerNumber}-${pIdx}`
                                  }`;

                                  return (
                                    <Draggable
                                      draggableId={uniqueDraggableId}
                                      index={pIdx}
                                      key={uniqueDraggableId}
                                    >
                                      {(provided, snapshot) => (
                                        <div
                                          className={`flex w-full min-h-[48px] py-2 border-b last:border-b-0 items-center px-4 transition-colors duration-150 ${
                                            snapshot.isDragging
                                              ? "bg-[#2563eb]/[0.06] border-[#2563eb]/30 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                                              : isDuplicate
                                              ? "border-[#dc2626]/25 bg-[#dc2626]/[0.03]"
                                              : "border-[#171717]/[0.06] hover:bg-[#fafafa]"
                                          }`}
                                          ref={provided.innerRef}
                                          {...provided.dragHandleProps}
                                          {...provided.draggableProps}
                                        >
                                          <div className="flex w-12 text-[#737373]">
                                            <GripVertical
                                              size={15}
                                              strokeWidth={1.5}
                                            />
                                          </div>
                                          <div className="flex w-16 font-mono tabular-nums text-xs text-[#737373]">
                                            {pIdx + 1}
                                          </div>
                                          <div className="flex w-28">
                                            <BibTag number={playerNumber} />
                                          </div>
                                          <div className="flex flex-1 min-w-[200px] items-center gap-2 flex-wrap text-sm font-medium text-[#171717]">
                                            <span>{playerName}</span>
                                            {entryOrigin === "force" && (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] border border-[#2563eb]/20 text-[11px] font-medium">
                                                <UserPlus
                                                  size={11}
                                                  strokeWidth={1.5}
                                                />
                                                <span>강제</span>
                                              </span>
                                            )}
                                            {entryOrigin === "manual" && (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#16a34a]/[0.08] text-[#16a34a] border border-[#16a34a]/20 text-[11px] font-medium">
                                                <PenLine
                                                  size={11}
                                                  strokeWidth={1.5}
                                                />
                                                <span>수기</span>
                                              </span>
                                            )}
                                            {entryOrigin === "web" && (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#525252] border border-[#171717]/[0.08] text-[11px] font-medium">
                                                <Globe
                                                  size={11}
                                                  strokeWidth={1.5}
                                                />
                                                <span>웹</span>
                                              </span>
                                            )}
                                            {isDuplicate && (
                                              <>
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.10] text-[#dc2626] text-[11px] font-medium">
                                                  중복
                                                </span>
                                                <Checkbox
                                                  checked={checked}
                                                  onChange={(e) => {
                                                    setSelectedEntries(
                                                      (prev) => {
                                                        const next = new Set(
                                                          prev
                                                        );
                                                        if (e.target.checked)
                                                          next.add(entryKey);
                                                        else
                                                          next.delete(entryKey);
                                                        return next;
                                                      }
                                                    );
                                                  }}
                                                >
                                                  <span className="text-xs text-[#dc2626]">
                                                    삭제 대상
                                                  </span>
                                                </Checkbox>
                                              </>
                                            )}
                                          </div>
                                          <div className="flex w-3/12 text-sm text-[#525252]">
                                            {playerGym || "-"}
                                          </div>
                                          <div className="flex w-28 text-xs text-[#737373] font-mono tabular-nums">
                                            {invoiceCreateAt || "-"}
                                          </div>
                                          <div className="flex w-20 justify-center">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingPlayer(player);
                                                setEditDrawerOpen(true);
                                              }}
                                              className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#525252] hover:text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                                            >
                                              <Pencil
                                                size={13}
                                                strokeWidth={1.5}
                                                className="shrink-0"
                                              />
                                              <span>수정</span>
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  );
                                })}
                              </div>
                            )}

                            {/* 모바일 카드 */}
                            {isMobile && (
                              <div className="flex flex-col w-full gap-2 p-3">
                                {matchedPlayers.map((player, pIdx) => {
                                  const uidOrIdentity =
                                    player.playerUid ||
                                    `${(player.playerName || "").trim()}_${
                                      player.playerTel || ""
                                    }`;
                                  const dupGroupKey = `${contestGradeId}__${uidOrIdentity}`;
                                  const isDuplicate =
                                    duplicateGroupKeys.has(dupGroupKey);
                                  const entryKey = getPlayerRowEntryKey(
                                    player,
                                    pIdx
                                  );
                                  const uniqueDraggableId = `${
                                    contestGradeId || "g"
                                  }-${player.playerUid || "u"}-${
                                    player._rowId ||
                                    `${player.playerNumber}-${pIdx}`
                                  }`;

                                  return (
                                    <Draggable
                                      draggableId={uniqueDraggableId}
                                      index={pIdx}
                                      key={uniqueDraggableId}
                                    >
                                      {(provided, snapshot) => (
                                        <PlayerCardView
                                          player={player}
                                          index={pIdx}
                                          provided={provided}
                                          snapshot={snapshot}
                                          isDuplicate={isDuplicate}
                                          entryKey={entryKey}
                                        />
                                      )}
                                    </Draggable>
                                  );
                                })}
                              </div>
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
};

export default ContestPlayerOrderTable;
