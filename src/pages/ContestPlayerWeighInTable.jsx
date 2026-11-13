import { useContext, useEffect, useState, useMemo, useRef } from "react";
import LoadingPage from "./LoadingPage";
import { useFirestoreGetDocument } from "../hooks/useFirestores";
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  runTransaction,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useNavigate } from "react-router-dom";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import WeighInNumberEditDrawer from "../components/weighIn/WeighInNumberEditDrawer";
import WeighInStagePhotoDrawer from "../components/weighIn/WeighInStagePhotoDrawer";
import WeighInStatsHeader from "../components/weighIn/WeighInStatsHeader";
import WeighInFilterToolbar from "../components/weighIn/WeighInFilterToolbar";
import WeighInGradeSectionList from "../components/weighIn/WeighInGradeSectionList";
import { getStagePlayerSortIndex } from "../functions/functions";
import { sanitizeForFirestore as sanitizeDataForFirestore } from "../utils/firestoreSanitize";
import {
  getPlayerEntryKey,
  getPlayerTupleKey,
  isGrandPrixEntryLike,
  isAutoGrandPrixEntry,
  mergePreservingUnmatchedFinalEntries,
  parseHeightWeightValue as parseHeightWeight,
  formatHeightWeightValue as formatHeightWeight,
} from "../utils/playerEntryUtils";
import {
  isNonPlayerUrl,
  extractPlayerPhotos,
  resolveEffectiveStagePhotoFields,
} from "../utils/playerPhotoUtils";
import { fetchContestPhotoPool } from "../utils/weighInPhotoSyncUtils";

export {
  isNonPlayerKey,
  isNonPlayerUrl,
  extractPlayerPhotos,
} from "../utils/playerPhotoUtils";

const ContestPlayerWeighInTable = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [matchedArray, setMatchedArray] = useState([]);
  const [categorysArray, setCategorysArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [playersAssign, setPlayersAssign] = useState({});
  const [playersArray, setPlayersArray] = useState([]);
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  // 🔍 현장 검색 & 필터 상태
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedSection, setSelectedSection] = useState("all");
  const [filterWeighedStatus, setFilterWeighedStatus] = useState("all"); // 'all', 'weighed', 'unweighed', 'noshow'

  // 📸 선수 사진 확인 및 무대 송출 사진 지정 모달 상태
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoModalPlayer, setPhotoModalPlayer] = useState(null);
  const [isSyncingPhotos, setIsSyncingPhotos] = useState(false);

  // ✅ 번호/인덱스/신장체중 수정 모달 상태
  const [numModalOpen, setNumModalOpen] = useState(false);
  const [editTargetKey, setEditTargetKey] = useState(null);
  const [editValues, setEditValues] = useState({
    playerNumber: null,
    playerIndex: null,
    playerName: "",
    height: "",
    weight: "",
  });

  // 🛡️ 다중 계측대 입력 보호용 포커스 / 로컬 미저장 행 추적 Ref
  const focusedPlayerKeyRef = useRef(null);
  const dirtyPlayerKeysRef = useRef(new Set());
  const dirtyPhotoKeysRef = useRef(new Set());
  const isInitialHydratedRef = useRef(false);
  const editTargetKeyRef = useRef(null);
  editTargetKeyRef.current = editTargetKey;

  const { currentContest } = useContext(CurrentContestContext);
  const navigate = useNavigate();

  const fetchCategoryDocument = useFirestoreGetDocument("contest_categorys_list");
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersAssignDocument = useFirestoreGetDocument("contest_players_assign");
  const fetchPlayersFinalDocument = useFirestoreGetDocument("contest_players_final");

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchPool = async () => {
    setIsLoading(true);
    try {
      const contestId =
        currentContest?.contests?.id ||
        currentContest?.contestInfo?.id ||
        currentContest?.id ||
        "";

      if (currentContest?.contests?.contestCategorysListId) {
        const returnCategorys = await fetchCategoryDocument.getDocument(
          currentContest.contests.contestCategorysListId
        );

        setCategorysArray(
          [...(returnCategorys?.categorys || [])].sort(
            (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
          )
        );

        const returnGrades = await fetchGradeDocument.getDocument(
          currentContest.contests.contestGradesListId
        );

        setGradesArray([...returnGrades?.grades]);
      }

      // 📥 1. 신청서/엔트리 풀에서 선수 사진 · 지정 슬롯 · 원체급 맵 일괄 로드
      const {
        uidPhotosMap: invoicePhotosMap,
        stage1Map: invoiceStage1Map,
        stage2Map: invoiceStage2Map,
        namePhonePhotosMap: namePhonePhotoMap,
        nameOnlyPhotosMap: nameOnlyPhotoMap,
        entryOriginalGradeMap,
      } = await fetchContestPhotoPool({
        db,
        contestId,
        includePlayersList: false,
      });

      // assign 문서와 final 문서 모두 조회
      let assignPlayers = [];
      if (currentContest?.contests?.contestPlayersAssignId) {
        const returnPlayersAssign = await fetchPlayersAssignDocument.getDocument(
          currentContest.contests.contestPlayersAssignId
        );
        if (returnPlayersAssign) {
          setPlayersAssign({ ...returnPlayersAssign });
          assignPlayers = returnPlayersAssign?.players || [];
        }
      }

      let finalPlayers = [];
      if (currentContest?.contests?.contestPlayersFinalId) {
        const returnPlayersFinal = await fetchPlayersFinalDocument.getDocument(
          currentContest.contests.contestPlayersFinalId
        );
        finalPlayers = returnPlayersFinal?.players || [];
      }

      // 📸 다종목 선수 사진 playerUid 기반 글로벌 매핑
      const uidPhotoMap = new Map();
      [...assignPlayers, ...finalPlayers].forEach((p) => {
        if (p?.playerUid) {
          const photos = extractPlayerPhotos(p);
          const fromInv = invoicePhotosMap.get(p.playerUid) || [];
          const allFound = Array.from(new Set([...photos, ...fromInv]));
          if (allFound.length > 0) {
            const existing = uidPhotoMap.get(p.playerUid) || [];
            uidPhotoMap.set(p.playerUid, Array.from(new Set([...existing, ...allFound])));
          }
        }
      });

      // 🔑 복합 키(getPlayerEntryKey)를 사용하여 다종목 출전 선수의 체급 정보가 덮어써지지 않도록 안전 병합
      const finalMap = new Map();
      finalPlayers.forEach((p) => {
        const key = getPlayerEntryKey(p);
        if (key) finalMap.set(key, p);
      });

      const mergedLoadedPlayers = assignPlayers.map((p) => {
        const trimmedName = (p.playerName || "").trim();
        const catId = p.contestCategoryId || "";
        const telPart = (p.playerTel || "").replace(/[^0-9]/g, "").slice(-4);
        const nameKey = `${trimmedName}_${telPart}`;
        const entryKeyUid = p.playerUid ? `${p.playerUid}_${catId}` : "";
        const entryKeyName = trimmedName ? `${trimmedName}_${catId}` : "";

        // 🌟 참가신청서 원본(contest_entrys_list)에서 선수의 '진짜 원래 배정 체급' 확정
        const entryOriginal = (entryKeyUid && entryOriginalGradeMap.get(entryKeyUid)) ||
                              (entryKeyName && entryOriginalGradeMap.get(entryKeyName));

        const origGradeId = entryOriginal?.contestGradeId || p.originalGradeId || p.contestGradeId;
        const origGradeTitle = entryOriginal?.contestGradeTitle || p.originalGradeTitle || p.contestGradeTitle;

        // 원본 체급 기반 엔트리 키 생성하여 final 데이터 검색
        const keyWithOrig = getPlayerEntryKey({ ...p, originalGradeId: origGradeId });
        const keyCurrent = getPlayerEntryKey(p);
        const fp = finalMap.get(keyWithOrig) || finalMap.get(keyCurrent) || null;
        const fpPhotos = fp ? extractPlayerPhotos(fp) : [];

        // 🌟 모든 소스(신청서 풀, UID맵, 전화번호/이름맵, 배정/최종문서)에서 등록된 '모든 사진'을 빠짐없이 통합 병합
        const allPlayerPhotos = Array.from(
          new Set([
            ...((p.playerUid && uidPhotoMap.get(p.playerUid)) || []),
            ...((p.playerUid && invoicePhotosMap.get(p.playerUid)) || []),
            ...(namePhonePhotoMap.get(nameKey) || []),
            ...((trimmedName && nameOnlyPhotoMap.get(trimmedName)) || []),
            ...extractPlayerPhotos(p),
            ...fpPhotos,
          ])
        );

        // 🌟 사용자가 계측 명단에서 명시적으로 선택한 '무대 전광판 송출용 사진' (fp > p > 신청서 원본 순으로 절대 우선, 명시적 초기화("") 존중)
        const invoiceFallbackPhotos = {
          stagePhoto1:
            (p.playerUid && invoiceStage1Map.get(p.playerUid)) ||
            invoiceStage1Map.get(nameKey) ||
            (trimmedName && invoiceStage1Map.get(trimmedName)) ||
            "",
          stagePhoto2:
            (p.playerUid && invoiceStage2Map.get(p.playerUid)) ||
            invoiceStage2Map.get(nameKey) ||
            (trimmedName && invoiceStage2Map.get(trimmedName)) ||
            "",
          stagePhotoUrl: allPlayerPhotos[0] || "",
        };
        const assignResolvedPhotos = resolveEffectiveStagePhotoFields(
          p,
          invoiceFallbackPhotos
        );
        const effectiveStagePhotos = fp
          ? resolveEffectiveStagePhotoFields(fp, assignResolvedPhotos)
          : assignResolvedPhotos;

        const isGradeChanged = fp ? !!fp.isGradeChanged : !!p.isGradeChanged;

        let baseObj = {
          ...p,
          originalGradeId: origGradeId,
          originalGradeTitle: origGradeTitle,
          isGradeChanged: isGradeChanged,
          // 🌟 월체(isGradeChanged === true)일 때만 변경 체급 유지, 월체 취소(false)면 무조건 원래 체급(origGradeId)으로 복귀!
          contestGradeId: isGradeChanged ? (fp?.contestGradeId || p.contestGradeId || origGradeId) : origGradeId,
          contestGradeTitle: isGradeChanged ? (fp?.contestGradeTitle || p.contestGradeTitle || origGradeTitle) : origGradeTitle,
          ...effectiveStagePhotos,
          photos: allPlayerPhotos,
        };

        if (fp) {
          baseObj = {
            ...baseObj,
            ...fp,
            // 🌟 1단계 신청서/배정의 원래 체급을 항상 originalGradeId로 절대 보존!
            originalGradeId: origGradeId,
            originalGradeTitle: origGradeTitle,
            isGradeChanged: isGradeChanged,
            contestGradeId: isGradeChanged ? (fp.contestGradeId || origGradeId) : origGradeId,
            contestGradeTitle: isGradeChanged ? (fp.contestGradeTitle || origGradeTitle) : origGradeTitle,
            // 🌟 [비즈니스 로직 핵심]: 선수 번호 및 표시 순서는 1단계 선수 번호 배정(assign: p)이 무조건 절대 우선!
            playerNumber: p.playerNumber !== undefined ? p.playerNumber : fp.playerNumber,
            playerIndex: p.playerIndex !== undefined ? p.playerIndex : fp.playerIndex,
            // 계측 현장에서 측정한 신장/체중/통과/불참 데이터는 안전하게 보존
            heightWeight: fp.heightWeight || p.heightWeight || "",
            playerNoShow: fp.playerNoShow !== undefined ? fp.playerNoShow : p.playerNoShow,
            isWeighedIn: fp.isWeighedIn !== undefined ? fp.isWeighedIn : p.isWeighedIn,
            ...effectiveStagePhotos,
            photos: allPlayerPhotos,
          };
        }
        return baseObj;
      });

      // 🛡️ contest_players_final에만 존재하는 선수(강제등록 createdBy === 'force' 및 그랑프리 선수 등) 누락 없이 병합 보존
      const hydratedEntryKeys = new Set(
        mergedLoadedPlayers.map((p) => getPlayerEntryKey(p)).filter(Boolean)
      );
      const hydratedTupleKeys = new Set(
        mergedLoadedPlayers.map((p) => getPlayerTupleKey(p)).filter(Boolean)
      );

      finalPlayers.forEach((fp) => {
        if (!fp) return;
        const eKey = getPlayerEntryKey(fp);
        const tKey = getPlayerTupleKey(fp);
        if (
          (eKey && hydratedEntryKeys.has(eKey)) ||
          (tKey && hydratedTupleKeys.has(tKey))
        ) {
          return;
        }
        const trimmedName = (fp.playerName || "").trim();
        const telPart = (fp.playerTel || "").replace(/[^0-9]/g, "").slice(-4);
        const nameKey = `${trimmedName}_${telPart}`;
        const allPlayerPhotos = Array.from(
          new Set([
            ...((fp.playerUid && uidPhotoMap.get(fp.playerUid)) || []),
            ...((fp.playerUid && invoicePhotosMap.get(fp.playerUid)) || []),
            ...(namePhonePhotoMap.get(nameKey) || []),
            ...((trimmedName && nameOnlyPhotoMap.get(trimmedName)) || []),
            ...extractPlayerPhotos(fp),
          ])
        );
        const fpFallbackPhotos = {
          stagePhoto1:
            (fp.playerUid && invoiceStage1Map.get(fp.playerUid)) ||
            invoiceStage1Map.get(nameKey) ||
            (trimmedName && invoiceStage1Map.get(trimmedName)) ||
            "",
          stagePhoto2:
            (fp.playerUid && invoiceStage2Map.get(fp.playerUid)) ||
            invoiceStage2Map.get(nameKey) ||
            (trimmedName && invoiceStage2Map.get(trimmedName)) ||
            "",
          stagePhotoUrl: allPlayerPhotos[0] || "",
        };
        const resolvedFpPhotos = resolveEffectiveStagePhotoFields(
          fp,
          fpFallbackPhotos
        );

        if (eKey) hydratedEntryKeys.add(eKey);
        if (tKey) hydratedTupleKeys.add(tKey);

        mergedLoadedPlayers.push({
          ...fp,
          originalGradeId: fp.originalGradeId || fp.contestGradeId,
          originalGradeTitle: fp.originalGradeTitle || fp.contestGradeTitle,
          isGradeChanged: !!fp.isGradeChanged,
          playerNoShow: !!fp.playerNoShow,
          isWeighedIn: !!fp.isWeighedIn,
          heightWeight: fp.heightWeight || "",
          ...resolvedFpPhotos,
          photos: allPlayerPhotos,
        });
      });

      dirtyPlayerKeysRef.current.clear();
      setPlayersArray(mergedLoadedPlayers);
      isInitialHydratedRef.current = true;
    } catch (error) {
      console.error("계측 데이터 불러오기 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 📡 [다중 계측대 실시간 Live-Sync 리스너]
  // 계측대 1에서 저장 시, 계측대 2 및 모든 화면에서 자동으로 신장/체중/월체/불참/무대사진이 실시간 자동 업데이트!
  // 단, 현재 운영자가 직접 포커스하거나 타이핑 중인 행(focusedPlayerKeyRef / dirtyPlayerKeysRef / editTargetKeyRef)은 덮어쓰지 않음!
  useEffect(() => {
    const assignDocId = currentContest?.contests?.contestPlayersAssignId;
    if (!assignDocId) return;

    const unsub = onSnapshot(
      doc(db, "contest_players_assign", assignDocId),
      (docSnap) => {
        if (!isInitialHydratedRef.current) return;
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          const remotePlayers = remoteData?.players || [];

          if (remotePlayers.length > 0) {
            setPlayersAssign(remoteData);
            setPlayersArray((prevLocal) => {
              if (!prevLocal || prevLocal.length === 0) {
                return remotePlayers.map((rp) => ({
                  ...rp,
                  originalGradeId: rp.originalGradeId || rp.contestGradeId,
                  originalGradeTitle:
                    rp.originalGradeTitle || rp.contestGradeTitle,
                }));
              }

              const remoteMap = new Map();
              remotePlayers.forEach((rp) => {
                const k = getPlayerEntryKey(rp);
                if (k) remoteMap.set(k, rp);
              });

              const seenKeys = new Set();
              const updatedLocal = prevLocal.map((localP) => {
                const k = getPlayerEntryKey(localP);
                if (k) seenKeys.add(k);

                if (remoteMap.has(k)) {
                  const rp = remoteMap.get(k);
                  const isProtectedRow =
                    k === editTargetKeyRef.current ||
                    k === focusedPlayerKeyRef.current ||
                    dirtyPlayerKeysRef.current.has(k);

                  // 현재 모달/인라인 입력 포커스 또는 미저장 타이핑 중인 행은 입력값을 절대 덮어쓰지 않음!
                  if (isProtectedRow) {
                    return {
                      ...localP,
                      ...(dirtyPhotoKeysRef.current.has(k)
                        ? {}
                        : resolveEffectiveStagePhotoFields(rp, localP)),
                      photos:
                        localP.photos && localP.photos.length > 0
                          ? localP.photos
                          : rp.photos || [],
                    };
                  }

                  const resolvedPhotoFields = dirtyPhotoKeysRef.current.has(k)
                    ? resolveEffectiveStagePhotoFields(localP, rp)
                    : resolveEffectiveStagePhotoFields(rp, localP);

                  return {
                    ...localP,
                    heightWeight: rp.heightWeight || "",
                    playerHeight: rp.playerHeight ?? localP.playerHeight,
                    playerWeight: rp.playerWeight ?? localP.playerWeight,
                    height: rp.height ?? localP.height,
                    weight: rp.weight ?? localP.weight,
                    playerNoShow: !!rp.playerNoShow,
                    isGradeChanged: !!rp.isGradeChanged,
                    isWeighedIn: !!rp.isWeighedIn,
                    originalGradeId:
                      rp.originalGradeId || localP.originalGradeId,
                    originalGradeTitle:
                      rp.originalGradeTitle || localP.originalGradeTitle,
                    contestGradeId:
                      rp.contestGradeId || localP.contestGradeId,
                    contestGradeTitle:
                      rp.contestGradeTitle || localP.contestGradeTitle,
                    playerNumber:
                      Number(rp.playerNumber) || localP.playerNumber,
                    playerIndex: Number(rp.playerIndex) || localP.playerIndex,
                    ...resolvedPhotoFields,
                    photos:
                      rp.photos && rp.photos.length > 0
                        ? rp.photos
                        : localP.photos,
                  };
                }
                return localP;
              });

              // 타 계측대/강제등록에서 새로 추가된 선수가 있으면 추가 반영
              remotePlayers.forEach((rp) => {
                const k = getPlayerEntryKey(rp);
                if (k && !seenKeys.has(k)) {
                  seenKeys.add(k);
                  updatedLocal.push({
                    ...rp,
                    originalGradeId: rp.originalGradeId || rp.contestGradeId,
                    originalGradeTitle:
                      rp.originalGradeTitle || rp.contestGradeTitle,
                  });
                }
              });

              return updatedLocal;
            });
          }
        }
      },
      (error) => {
        console.warn("실시간 계측 동기화 리스너 오류:", error);
      }
    );

    return () => unsub();
  }, [currentContest?.contests?.contestPlayersAssignId]);

  const initEntryList = () => {
    const dummy = [];
    [...categorysArray]
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .forEach((category) => {
        const matchedGrades = gradesArray.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );
        const matchedGradesLength = matchedGrades.length;
        [...matchedGrades]
          .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
          .forEach((grade) => {
            const matchedPlayerWithPlayerNumber = [];
            const matchedPlayers = playersArray.filter(
              (entry) =>
                entry.contestCategoryId === category.contestCategoryId &&
                entry.contestGradeId === grade.contestGradeId
            );

            [...matchedPlayers]
              .sort(
                (a, b) =>
                  getStagePlayerSortIndex(a) - getStagePlayerSortIndex(b)
              )
              .forEach((player) => {
                const {
                  playerNumber,
                  playerIndex,
                  playerNoShow,
                  isGradeChanged,
                  isWeighedIn,
                  heightWeight,
                } = player;

                const newPlayer = {
                  ...player,
                  playerNumber,
                  playerNoShow: !!playerNoShow,
                  isGradeChanged: !!isGradeChanged,
                  isWeighedIn: !!isWeighedIn,
                  heightWeight: heightWeight || "",
                  playerIndex,
                };
                matchedPlayerWithPlayerNumber.push({ ...newPlayer });
              });

            const matchedInfo = {
              ...category,
              ...grade,
              matchedPlayers: matchedPlayerWithPlayerNumber,
              matchedGradesLength,
            };
            dummy.push({ ...matchedInfo });
          });
      });

    setMatchedArray([...dummy]);
  };

  /** 🛡️ 다중 데스크 '스마트 병합(Smart Merge)' 저장 엔진 (Firestore 트랜잭션 + 그랑프리/강제등록 보존) */
  const handleUpdatePlayersFinal = async (
    contestId,
    playerAssignId,
    playersFinalId,
    currentLocalPlayers
  ) => {
    setMessage({
      variant: "loading",
      title: "계측 명단 병합 저장 중",
      body: "신장·체중 및 계측 데이터를 데이터베이스에 병합 저장하고 있습니다.",
      isButton: false,
    });
    setMsgOpen(true);

    try {
      const localPlayersMap = new Map();
      (currentLocalPlayers || []).forEach((p) => {
        const key = getPlayerEntryKey(p);
        if (key) localPlayersMap.set(key, p);
      });

      const dirtySet = new Set(dirtyPlayerKeysRef.current);
      let committedPlayersForState = [];

      await runTransaction(db, async (transaction) => {
        const assignRef = playerAssignId
          ? doc(db, "contest_players_assign", playerAssignId)
          : null;
        const finalRef = playersFinalId
          ? doc(db, "contest_players_final", playersFinalId)
          : null;

        const assignSnap = assignRef ? await transaction.get(assignRef) : null;
        const finalSnap = finalRef ? await transaction.get(finalRef) : null;

        const latestAssignDoc = assignSnap?.exists()
          ? assignSnap.data()
          : playersAssign || {};
        const latestAssignPlayers = latestAssignDoc?.players || [];
        const latestFinalDoc = finalSnap?.exists() ? finalSnap.data() : {};
        const latestFinalPlayers = latestFinalDoc?.players || [];

        // 📸 playerUid 기반 사진 통합 맵 (다종목 출전 시 모든 체급에 동일 선수의 사진 100% 물림 보장)
        const saveUidPhotoMap = new Map();
        [
          ...latestAssignPlayers,
          ...latestFinalPlayers,
          ...(currentLocalPlayers || []),
        ].forEach((p) => {
          if (p?.playerUid) {
            const photos = extractPlayerPhotos(p);
            if (photos.length > 0) {
              const existing = saveUidPhotoMap.get(p.playerUid) || [];
              saveUidPhotoMap.set(
                p.playerUid,
                Array.from(new Set([...existing, ...photos]))
              );
            }
          }
        });

        // 3. 최신 DB 선수 목록에 로컬 변경사항을 복합키로 안전 병합 (수정하지 않은 행은 타 데스크 원격 저장값 우선 보존)
        const mergedAssignPlayers = latestAssignPlayers.map((dbPlayer) => {
          const key = getPlayerEntryKey(dbPlayer);
          const pUidPhotos =
            (dbPlayer.playerUid && saveUidPhotoMap.get(dbPlayer.playerUid)) ||
            extractPlayerPhotos(dbPlayer);
          const pUidPrimary =
            pUidPhotos[0] ||
            dbPlayer.profileImageUrl ||
            dbPlayer.photoUrl ||
            dbPlayer.playerPhoto ||
            "";

          if (localPlayersMap.has(key)) {
            const lp = localPlayersMap.get(key);
            const isLocalDirty = dirtySet.has(key);
            const isPhotoDirty = dirtyPhotoKeysRef.current.has(key);
            const lpPhotos = extractPlayerPhotos(lp);
            const combinedPhotos = Array.from(
              new Set([...pUidPhotos, ...lpPhotos])
            );
            const primaryPhotoSrc = isPhotoDirty ? lp : dbPlayer;
            const secondaryPhotoSrc = isPhotoDirty ? dbPlayer : lp;
            const resolvedPhotoFields = resolveEffectiveStagePhotoFields(
              primaryPhotoSrc,
              {
                ...secondaryPhotoSrc,
                stagePhotoUrl:
                  (!isNonPlayerUrl(secondaryPhotoSrc?.stagePhotoUrl) &&
                    secondaryPhotoSrc?.stagePhotoUrl) ||
                  (!isNonPlayerUrl(secondaryPhotoSrc?.profileImageUrl) &&
                    secondaryPhotoSrc?.profileImageUrl) ||
                  combinedPhotos[0] ||
                  "",
              }
            );

            const effectiveHWSource = isLocalDirty
              ? lp.heightWeight
              : lp.heightWeight || dbPlayer.heightWeight || "";
            const { height: parsedH, weight: parsedW } =
              parseHeightWeight(effectiveHWSource);
            const safeHeight = isLocalDirty
              ? parsedH
              : parsedH ||
                lp.playerHeight ||
                lp.height ||
                dbPlayer.playerHeight ||
                dbPlayer.height ||
                "";
            const safeWeight = isLocalDirty
              ? parsedW
              : parsedW ||
                lp.playerWeight ||
                lp.weight ||
                dbPlayer.playerWeight ||
                dbPlayer.weight ||
                "";
            const safeHW =
              (isLocalDirty ? lp.heightWeight : effectiveHWSource) ||
              formatHeightWeight(safeHeight, safeWeight) ||
              "";

            const resolvedGradeChanged = isLocalDirty
              ? !!lp.isGradeChanged
              : dbPlayer.isGradeChanged !== undefined
              ? !!dbPlayer.isGradeChanged
              : !!lp.isGradeChanged;

            return {
              ...dbPlayer,
              heightWeight: safeHW,
              playerHeight: safeHeight,
              playerWeight: safeWeight,
              height: safeHeight,
              weight: safeWeight,
              playerNoShow: isLocalDirty
                ? !!lp.playerNoShow
                : dbPlayer.playerNoShow !== undefined
                ? !!dbPlayer.playerNoShow
                : !!lp.playerNoShow,
              isWeighedIn: isLocalDirty
                ? !!lp.isWeighedIn
                : Boolean(dbPlayer.isWeighedIn || lp.isWeighedIn),
              isGradeChanged: resolvedGradeChanged,
              originalGradeId:
                dbPlayer.originalGradeId ||
                lp.originalGradeId ||
                dbPlayer.contestGradeId,
              originalGradeTitle:
                dbPlayer.originalGradeTitle ||
                lp.originalGradeTitle ||
                dbPlayer.contestGradeTitle,
              contestGradeId: resolvedGradeChanged
                ? lp.contestGradeId || dbPlayer.contestGradeId
                : dbPlayer.originalGradeId || dbPlayer.contestGradeId,
              contestGradeTitle: resolvedGradeChanged
                ? lp.contestGradeTitle || dbPlayer.contestGradeTitle
                : dbPlayer.originalGradeTitle || dbPlayer.contestGradeTitle,
              playerNumber:
                lp.playerNumber !== undefined &&
                lp.playerNumber !== null &&
                Number(lp.playerNumber) > 0
                  ? Number(lp.playerNumber)
                  : dbPlayer.playerNumber !== undefined
                  ? dbPlayer.playerNumber
                  : Number(lp.playerNumber) || 0,
              playerIndex:
                lp.playerIndex !== undefined &&
                lp.playerIndex !== null &&
                Number(lp.playerIndex) > 0
                  ? Number(lp.playerIndex)
                  : dbPlayer.playerIndex !== undefined
                  ? dbPlayer.playerIndex
                  : Number(lp.playerIndex) || 0,
              ...resolvedPhotoFields,
              photos: combinedPhotos,
            };
          }

          const resolvedDbPhotoFields = resolveEffectiveStagePhotoFields(
            dbPlayer,
            { stagePhotoUrl: pUidPrimary }
          );

          const { height: dbH, weight: dbW } = parseHeightWeight(
            dbPlayer.heightWeight
          );
          const safeDbH = dbH || dbPlayer.playerHeight || dbPlayer.height || "";
          const safeDbW = dbW || dbPlayer.playerWeight || dbPlayer.weight || "";

          return {
            ...dbPlayer,
            heightWeight:
              dbPlayer.heightWeight ||
              formatHeightWeight(safeDbH, safeDbW) ||
              "",
            playerHeight: safeDbH,
            playerWeight: safeDbW,
            height: safeDbH,
            weight: safeDbW,
            ...resolvedDbPhotoFields,
            photos: pUidPhotos,
          };
        });

        // 로컬에 새로 추가된 엔트리 병합 (자동 생성된 그랑프리 엔트리는 assign에서 제외하되 final에는 포함)
        const extraFinalFromLocal = [];
        localPlayersMap.forEach((localPlayer, key) => {
          if (!mergedAssignPlayers.some((p) => getPlayerEntryKey(p) === key)) {
            const pUidPhotos =
              (localPlayer.playerUid &&
                saveUidPhotoMap.get(localPlayer.playerUid)) ||
              extractPlayerPhotos(localPlayer);
            const resolvedLocalPhotoFields = resolveEffectiveStagePhotoFields(
              localPlayer,
              { stagePhotoUrl: pUidPhotos[0] || "" }
            );
            const { height: lH, weight: lW } = parseHeightWeight(
              localPlayer.heightWeight
            );
            const safeLH =
              lH || localPlayer.playerHeight || localPlayer.height || "";
            const safeLW =
              lW || localPlayer.playerWeight || localPlayer.weight || "";

            const normalizedLocal = {
              ...localPlayer,
              heightWeight:
                localPlayer.heightWeight ||
                formatHeightWeight(safeLH, safeLW) ||
                "",
              playerHeight: safeLH,
              playerWeight: safeLW,
              height: safeLH,
              weight: safeLW,
              ...resolvedLocalPhotoFields,
              photos: pUidPhotos,
            };

            if (isAutoGrandPrixEntry(normalizedLocal)) {
              extraFinalFromLocal.push(normalizedLocal);
            } else {
              mergedAssignPlayers.push(normalizedLocal);
            }
          }
        });

        // 4. 최종 명단 (Final) 데이터 구성 + 기존 contest_players_final의 그랑프리/강제등록 선수 100% 보존
        const baseFinalPlayers = [
          ...mergedAssignPlayers,
          ...extraFinalFromLocal,
        ].map((player) => {
          const pUidPhotos =
            (player.playerUid && saveUidPhotoMap.get(player.playerUid)) ||
            extractPlayerPhotos(player);
          const resolvedFinalPhotoFields = resolveEffectiveStagePhotoFields(
            player,
            { stagePhotoUrl: pUidPhotos[0] || "" }
          );

          const { height: fH, weight: fW } = parseHeightWeight(
            player.heightWeight
          );
          const safeFH = fH || player.playerHeight || player.height || "";
          const safeFW = fW || player.playerWeight || player.weight || "";

          return {
            ...player,
            contestCategoryId: player.contestCategoryId,
            contestGradeId: player.contestGradeId,
            contestId: player.contestId || contestId,
            playerNumber: Number(player.playerNumber) || 0,
            playerUid: player.playerUid,
            playerName: player.playerName,
            playerGym: player.playerGym || "",
            playerIndex:
              Number(player.playerIndex) || Number(player.playerNumber) || 0,
            playerNoShow: !!player.playerNoShow,
            playerText: player.playerText || "",
            isGradeChanged: !!player.isGradeChanged,
            heightWeight:
              player.heightWeight || formatHeightWeight(safeFH, safeFW) || "",
            playerHeight: safeFH,
            playerWeight: safeFW,
            height: safeFH,
            weight: safeFW,
            ...resolvedFinalPhotoFields,
            photos: pUidPhotos,
          };
        });

        const mergedFinalPlayers = mergePreservingUnmatchedFinalEntries(
          baseFinalPlayers,
          latestFinalPlayers
        );

        const nowIso = new Date().toISOString();
        const sanitizedAssign = sanitizeDataForFirestore(mergedAssignPlayers);
        const sanitizedFinal = sanitizeDataForFirestore(mergedFinalPlayers);

        if (assignRef && assignSnap?.exists()) {
          transaction.update(assignRef, {
            ...latestAssignDoc,
            players: sanitizedAssign,
            updatedAt: nowIso,
          });
        } else if (assignRef) {
          transaction.set(assignRef, {
            ...latestAssignDoc,
            contestId,
            players: sanitizedAssign,
            updatedAt: nowIso,
          });
        }

        if (finalRef && finalSnap?.exists()) {
          transaction.update(finalRef, {
            ...latestFinalDoc,
            contestId: latestFinalDoc.contestId || contestId,
            players: sanitizedFinal,
            updatedAt: nowIso,
          });
        } else if (finalRef) {
          transaction.set(finalRef, {
            contestId,
            players: sanitizedFinal,
            updatedAt: nowIso,
          });
        }

        committedPlayersForState = mergedFinalPlayers;
      });

      dirtyPlayerKeysRef.current.clear();
      setPlayersArray([...committedPlayersForState]);
      setMessage({
        variant: "success",
        title: "계측 최종명단 저장 완료",
        body: "계측 데이터와 최종 출전 명단이 안전하게 저장되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
    } catch (error) {
      console.error("계측 데이터 저장 오류:", error);
      setMessage({
        variant: "error",
        title: "계측 데이터 저장 실패",
        body: "저장 중 오류가 발생했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  /** 📸 선수 무대 송출 사진 슬롯(1, 2) 갱신 및 Firestore 트랜잭션 즉시 영구 저장 */
  const persistPlayerStageSlots = async (targetPlayer, newStage1 = "", newStage2 = "") => {
    const stage1 = (!isNonPlayerUrl(newStage1) && newStage1) || "";
    const stage2 = (!isNonPlayerUrl(newStage2) && newStage2) || "";
    const primaryStage = stage1 || stage2 || "";

    const currentPhotos = extractPlayerPhotos(targetPlayer);
    const targetKey = getPlayerEntryKey(targetPlayer);
    const contestId =
      currentContest?.contests?.id ||
      currentContest?.contestInfo?.id ||
      currentContest?.id ||
      "";

    const isSamePhotoOwner = (p) => {
      if (!p) return false;
      if (targetKey && getPlayerEntryKey(p) === targetKey) return true;
      if (targetPlayer.playerUid && p.playerUid === targetPlayer.playerUid) {
        return true;
      }
      return (
        p.playerName === targetPlayer.playerName &&
        (p.playerNumber === targetPlayer.playerNumber || !p.playerNumber)
      );
    };

    const applyStageSlotsToPlayer = (p) => {
      const mergedPhotos = Array.from(
        new Set([...extractPlayerPhotos(p), ...currentPhotos])
      );
      return {
        ...p,
        stagePhoto1: stage1,
        stagePhoto2: stage2,
        stagePhotoUrl1: stage1,
        stagePhotoUrl2: stage2,
        stagePhotoUrl: primaryStage,
        profileImageUrl: primaryStage,
        photoUrl: primaryStage,
        playerPhoto: primaryStage,
        photos: mergedPhotos,
      };
    };

    // 1. 로컬 상태 함수형 업데이트 (동일 선수의 모든 출전 체급에 슬롯1, 2 동기화)
    const touchedKeys = [];
    setPlayersArray((prev) =>
      prev.map((p) => {
        if (isSamePhotoOwner(p)) {
          const pk = getPlayerEntryKey(p);
          if (pk) {
            dirtyPhotoKeysRef.current.add(pk);
            touchedKeys.push(pk);
          }
          return applyStageSlotsToPlayer(p);
        }
        return p;
      })
    );
    if (targetKey) {
      dirtyPhotoKeysRef.current.add(targetKey);
      touchedKeys.push(targetKey);
    }
    setPhotoModalPlayer((prev) =>
      prev ? applyStageSlotsToPlayer(prev) : null
    );

    // 2. Firestore runTransaction으로 타 데스크 동시 계측 덮어쓰기 방지 + 그랑프리/강제등록 보존
    try {
      const assignId = currentContest?.contests?.contestPlayersAssignId;
      const finalId = currentContest?.contests?.contestPlayersFinalId;

      if (assignId || finalId) {
        await runTransaction(db, async (transaction) => {
          const assignRef = assignId
            ? doc(db, "contest_players_assign", assignId)
            : null;
          const finalRef = finalId
            ? doc(db, "contest_players_final", finalId)
            : null;

          const assignSnap = assignRef
            ? await transaction.get(assignRef)
            : null;
          const finalSnap = finalRef ? await transaction.get(finalRef) : null;

          const nowIso = new Date().toISOString();
          const remoteAssignPlayers = assignSnap?.exists()
            ? assignSnap.data()?.players || []
            : [];
          const nextAssignPlayers = remoteAssignPlayers.map((p) =>
            isSamePhotoOwner(p) ? applyStageSlotsToPlayer(p) : p
          );

          const remoteFinalPlayers = finalSnap?.exists()
            ? finalSnap.data()?.players || []
            : [];
          const baseFinalSource =
            remoteFinalPlayers.length > 0
              ? remoteFinalPlayers
              : nextAssignPlayers;
          const patchedFinalPlayers = baseFinalSource.map((p) =>
            isSamePhotoOwner(p) ? applyStageSlotsToPlayer(p) : p
          );
          const nextFinalPlayers = mergePreservingUnmatchedFinalEntries(
            patchedFinalPlayers,
            remoteFinalPlayers
          );

          if (assignRef && assignSnap?.exists()) {
            transaction.update(assignRef, {
              players: sanitizeDataForFirestore(nextAssignPlayers),
              updatedAt: nowIso,
            });
          }
          if (finalRef && finalSnap?.exists()) {
            transaction.update(finalRef, {
              players: sanitizeDataForFirestore(nextFinalPlayers),
              updatedAt: nowIso,
            });
          } else if (finalRef && nextFinalPlayers.length > 0) {
            transaction.set(finalRef, {
              contestId,
              players: sanitizeDataForFirestore(nextFinalPlayers),
              updatedAt: nowIso,
            });
          }
        });
      }
      touchedKeys.forEach((pk) => dirtyPhotoKeysRef.current.delete(pk));

      // 3. 참가신청서 원본(contest_entrys_list & invoices_pool)에도 stagePhoto1, stagePhoto2 영구 동기화
      if (contestId && targetPlayer.playerName) {
        try {
          const entryQueryCondition = targetPlayer.playerUid
            ? [
                where("contestId", "==", contestId),
                where("playerUid", "==", targetPlayer.playerUid),
              ]
            : [
                where("contestId", "==", contestId),
                where("playerName", "==", targetPlayer.playerName),
              ];

          const entryUpdatePromises = [];
          const entrySnap = await getDocs(
            query(collection(db, "contest_entrys_list"), ...entryQueryCondition)
          );
          entrySnap.forEach((entryDoc) => {
            entryUpdatePromises.push(
              updateDoc(doc(db, "contest_entrys_list", entryDoc.id), {
                stagePhoto1: stage1,
                stagePhoto2: stage2,
                stagePhotoUrl1: stage1,
                stagePhotoUrl2: stage2,
                stagePhotoUrl: primaryStage,
                profileImageUrl: primaryStage,
                selectedPhotoUrls: [stage1, stage2].filter(Boolean),
                updatedAt: new Date().toISOString(),
              })
            );
          });

          const invSnap = await getDocs(
            query(collection(db, "invoices_pool"), ...entryQueryCondition)
          );
          invSnap.forEach((invDoc) => {
            entryUpdatePromises.push(
              updateDoc(doc(db, "invoices_pool", invDoc.id), {
                stagePhoto1: stage1,
                stagePhoto2: stage2,
                stagePhotoUrl1: stage1,
                stagePhotoUrl2: stage2,
                stagePhotoUrl: primaryStage,
                profileImageUrl: primaryStage,
                selectedPhotoUrls: [stage1, stage2].filter(Boolean),
                updatedAt: new Date().toISOString(),
              })
            );
          });

          await Promise.all(entryUpdatePromises);
        } catch (entryErr) {
          console.warn("신청서 원본 사진 동기화 실패(무시가능):", entryErr);
        }
      }

      console.log("무대 사진 슬롯 전체 DB 영구 저장 완료:", { stage1, stage2 });
    } catch (e) {
      console.error("무대 사진 슬롯 DB 저장 실패:", e);
      setMessage({
        variant: "error",
        title: "무대 사진 저장 실패",
        body: "무대 송출 사진 저장 중 오류가 발생했습니다.",
        body4: e?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    }
  };

  /** 특정 슬롯(1번 또는 2번)에 사진 직접 지정 및 DB 즉시 저장 */
  const handleSetStageSlot = async (slotNumber, imgUrl) => {
    if (!photoModalPlayer || !imgUrl) return;

    const currentStage1 =
      (!isNonPlayerUrl(photoModalPlayer.stagePhoto1) && photoModalPlayer.stagePhoto1) ||
      (!isNonPlayerUrl(photoModalPlayer.stagePhotoUrl1) && photoModalPlayer.stagePhotoUrl1) ||
      "";
    const currentStage2 =
      (!isNonPlayerUrl(photoModalPlayer.stagePhoto2) && photoModalPlayer.stagePhoto2) ||
      (!isNonPlayerUrl(photoModalPlayer.stagePhotoUrl2) && photoModalPlayer.stagePhotoUrl2) ||
      "";

    let nextStage1 = currentStage1;
    let nextStage2 = currentStage2;

    if (slotNumber === 1) {
      nextStage1 = imgUrl;
      // 만약 2번에 같은 사진이 있었다면 2번은 비워줌 (중복 방지)
      if (nextStage2 === imgUrl) nextStage2 = "";
    } else if (slotNumber === 2) {
      nextStage2 = imgUrl;
      // 만약 1번에 같은 사진이 있었다면 1번은 비워줌 (중복 방지)
      if (nextStage1 === imgUrl) nextStage1 = "";
    }

    await persistPlayerStageSlots(photoModalPlayer, nextStage1, nextStage2);
  };

  /** 1번 사진과 2번 사진 순서 맞바꾸기(Swap) */
  const handleSwapStageSlots = async () => {
    if (!photoModalPlayer) return;

    const currentStage1 =
      (!isNonPlayerUrl(photoModalPlayer.stagePhoto1) && photoModalPlayer.stagePhoto1) ||
      (!isNonPlayerUrl(photoModalPlayer.stagePhotoUrl1) && photoModalPlayer.stagePhotoUrl1) ||
      "";
    const currentStage2 =
      (!isNonPlayerUrl(photoModalPlayer.stagePhoto2) && photoModalPlayer.stagePhoto2) ||
      (!isNonPlayerUrl(photoModalPlayer.stagePhotoUrl2) && photoModalPlayer.stagePhotoUrl2) ||
      "";

    if (!currentStage1 && !currentStage2) {
      setMessage({
        variant: "warning",
        title: "교체할 사진 없음",
        body: "먼저 무대 송출용 사진을 1장 이상 지정해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    await persistPlayerStageSlots(photoModalPlayer, currentStage2, currentStage1);
  };

  /** 갤러리 사진 클릭 시 빈 슬롯에 자동 순차 배치 */
  const handleAssignStageSlot = async (imgUrl) => {
    if (!photoModalPlayer || !imgUrl) return;

    const currentStage1 =
      (!isNonPlayerUrl(photoModalPlayer.stagePhoto1) && photoModalPlayer.stagePhoto1) ||
      (!isNonPlayerUrl(photoModalPlayer.stagePhotoUrl1) && photoModalPlayer.stagePhotoUrl1) ||
      "";
    const currentStage2 =
      (!isNonPlayerUrl(photoModalPlayer.stagePhoto2) && photoModalPlayer.stagePhoto2) ||
      (!isNonPlayerUrl(photoModalPlayer.stagePhotoUrl2) && photoModalPlayer.stagePhotoUrl2) ||
      "";

    if (!currentStage1) {
      await handleSetStageSlot(1, imgUrl);
    } else if (!currentStage2) {
      await handleSetStageSlot(2, imgUrl);
    } else {
      // 둘 다 차있는 경우 1번 사진을 새 사진으로 교체
      await handleSetStageSlot(1, imgUrl);
    }
  };

  /** 무대 사진 슬롯 비우기 핸들러 */
  const handleClearStageSlot = async (slotNumber) => {
    if (!photoModalPlayer) return;

    const currentStage1 =
      (!isNonPlayerUrl(photoModalPlayer.stagePhoto1) && photoModalPlayer.stagePhoto1) ||
      (!isNonPlayerUrl(photoModalPlayer.stagePhotoUrl1) && photoModalPlayer.stagePhotoUrl1) ||
      "";
    const currentStage2 =
      (!isNonPlayerUrl(photoModalPlayer.stagePhoto2) && photoModalPlayer.stagePhoto2) ||
      (!isNonPlayerUrl(photoModalPlayer.stagePhotoUrl2) && photoModalPlayer.stagePhotoUrl2) ||
      "";

    if (slotNumber === 1) {
      await persistPlayerStageSlots(photoModalPlayer, "", currentStage2);
    } else if (slotNumber === 2) {
      await persistPlayerStageSlots(photoModalPlayer, currentStage1, "");
    }
  };

  /** 모달 내 [무대 송출 사진 확정 저장] 버튼 클릭 핸들러 */
  const handleConfirmSavePhotoModal = async () => {
    if (!photoModalPlayer) return;
    const savedPlayer = photoModalPlayer;
    const stage1 =
      (!isNonPlayerUrl(savedPlayer.stagePhoto1) && savedPlayer.stagePhoto1) ||
      (!isNonPlayerUrl(savedPlayer.stagePhotoUrl1) && savedPlayer.stagePhotoUrl1) ||
      "";
    const stage2 =
      (!isNonPlayerUrl(savedPlayer.stagePhoto2) && savedPlayer.stagePhoto2) ||
      (!isNonPlayerUrl(savedPlayer.stagePhotoUrl2) && savedPlayer.stagePhotoUrl2) ||
      "";

    await persistPlayerStageSlots(savedPlayer, stage1, stage2);
    setPhotoModalOpen(false);
    setPhotoModalPlayer(null);
    setMessage({
      variant: "success",
      title: "무대 송출 사진 저장 완료",
      body: `#${savedPlayer.playerNumber || ""} ${savedPlayer.playerName} 선수의 무대 송출 사진이 저장되었습니다.`,
      body2: `1번 슬롯: ${stage1 ? "등록됨" : "미등록"} · 2번 슬롯: ${stage2 ? "등록됨" : "미등록"}`,
      isButton: true,
      confirmButtonText: "확인",
    });
    setMsgOpen(true);
  };

  /** 신청서 원본 및 엔트리에서 순수 선수 사진만 재추출하여 포스터/오류 사진을 정리하고 DB에 갱신 */
  const handleSyncCleanPhotoData = async () => {
    const contestId =
      currentContest?.contests?.id ||
      currentContest?.contestInfo?.id ||
      currentContest?.id ||
      "";

    const assignId = currentContest?.contests?.contestPlayersAssignId;
    const finalId = currentContest?.contests?.contestPlayersFinalId;

    if (!contestId) {
      setMessage({
        variant: "error",
        title: "대회 정보 확인 필요",
        body: "현재 선택된 대회 정보를 확인할 수 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    setIsSyncingPhotos(true);
    try {
      console.log("=== [사진데이터 갱신 시작] Contest ID:", contestId, "Assign ID:", assignId, "Final ID:", finalId);

      // 1. 모든 풀 컬렉션에서 선수 사진 · 지정 슬롯 일괄 조회
      const {
        uidPhotosMap,
        stage1Map: syncStage1Map,
        stage2Map: syncStage2Map,
        namePhonePhotosMap,
        nameOnlyPhotosMap,
        counts,
      } = await fetchContestPhotoPool({
        db,
        contestId,
        includePlayersList: true,
      });

      console.log(
        `[신청서 풀 조회 결과] invoices_pool: ${counts.invoices}, entries: ${counts.entries}, contestInvoices: ${counts.contestInvoices}, playersList: ${counts.playersList}`
      );

      // 2. 최신 assign 문서 및 final 문서 로드
      let basePlayers = [...playersArray];
      if (basePlayers.length === 0 && assignId) {
        const assignSnap = await getDoc(doc(db, "contest_players_assign", assignId));
        if (assignSnap.exists()) {
          basePlayers = assignSnap.data().players || [];
        }
      }
      if (basePlayers.length === 0 && finalId) {
        const finalSnap = await getDoc(doc(db, "contest_players_final", finalId));
        if (finalSnap.exists()) {
          basePlayers = finalSnap.data().players || [];
        }
      }

      console.log(`[정리 대상 선수 수]: ${basePlayers.length}명`);

      // 3. 선수별 포스터 제거 및 깨끗한 사진 재매핑
      let photoAthleteCount = 0;
      let totalPhotoCount = 0;

      const cleanedPlayers = basePlayers.map((player) => {
        const trimmedName = (player.playerName || "").trim();
        const telPart = (player.playerTel || "").replace(/[^0-9]/g, "").slice(-4);
        const nameKey = `${trimmedName}_${telPart}`;

        // UID, 전화번호, 이름, 선수 객체 자체에서 깨끗한 사진만 취합
        const fromUid = (player.playerUid && uidPhotosMap.get(player.playerUid)) || [];
        const fromNamePhone = namePhonePhotosMap.get(nameKey) || [];
        const fromNameOnly = (trimmedName && nameOnlyPhotosMap.get(trimmedName)) || [];
        const fromPlayerDirect = extractPlayerPhotos(player);

        const mergedPhotos = Array.from(
          new Set([...fromUid, ...fromNamePhone, ...fromNameOnly, ...fromPlayerDirect])
        );

        // 포스터나 비선수 URL이 아닌 유효한 대표 사진 선택
        const filterValid = (u) => (u && !isNonPlayerUrl(u) ? u : "");
        const currentStage1 =
          filterValid(player.stagePhoto1) ||
          filterValid(player.stagePhotoUrl1) ||
          (player.playerUid && syncStage1Map.get(player.playerUid)) ||
          syncStage1Map.get(nameKey) ||
          (trimmedName && syncStage1Map.get(trimmedName)) ||
          "";
        const currentStage2 =
          filterValid(player.stagePhoto2) ||
          filterValid(player.stagePhotoUrl2) ||
          (player.playerUid && syncStage2Map.get(player.playerUid)) ||
          syncStage2Map.get(nameKey) ||
          (trimmedName && syncStage2Map.get(trimmedName)) ||
          "";
        const currentStage = filterValid(player.stagePhotoUrl);
        const currentProfile = filterValid(player.profileImageUrl);
        const currentPhotoUrl = filterValid(player.photoUrl);

        const designatedStagePhoto =
          currentStage1 ||
          currentStage2 ||
          currentStage ||
          currentProfile ||
          currentPhotoUrl ||
          mergedPhotos[0] ||
          "";

        if (mergedPhotos.length > 0) {
          photoAthleteCount++;
          totalPhotoCount += mergedPhotos.length;
        }

        return {
          ...player,
          stagePhoto1: currentStage1 || "",
          stagePhoto2: currentStage2 || "",
          stagePhotoUrl1: currentStage1 || "",
          stagePhotoUrl2: currentStage2 || "",
          stagePhotoUrl: designatedStagePhoto,
          profileImageUrl: designatedStagePhoto,
          photoUrl: designatedStagePhoto,
          playerPhoto: designatedStagePhoto,
          photos: mergedPhotos,
        };
      });

      // 4. 로컬 상태 업데이트
      setPlayersArray(cleanedPlayers);

      // 5. Firestore 트랜잭션으로 그랑프리/강제등록 선수 손실 없이 안전 저장
      await runTransaction(db, async (transaction) => {
        const assignRef = assignId
          ? doc(db, "contest_players_assign", assignId)
          : null;
        const finalRef = finalId
          ? doc(db, "contest_players_final", finalId)
          : null;
        const assignSnap = assignRef ? await transaction.get(assignRef) : null;
        const finalSnap = finalRef ? await transaction.get(finalRef) : null;

        const nowIso = new Date().toISOString();
        const assignCleanList = cleanedPlayers.filter(
          (p) => !isAutoGrandPrixEntry(p)
        );
        const existingFinalPlayers = finalSnap?.exists()
          ? finalSnap.data()?.players || []
          : [];
        const finalCleanList = mergePreservingUnmatchedFinalEntries(
          cleanedPlayers,
          existingFinalPlayers
        );

        if (assignRef && assignSnap?.exists()) {
          transaction.update(assignRef, {
            players: sanitizeDataForFirestore(assignCleanList),
            updatedAt: nowIso,
          });
        }
        if (finalRef && finalSnap?.exists()) {
          transaction.update(finalRef, {
            contestId,
            players: sanitizeDataForFirestore(finalCleanList),
            updatedAt: nowIso,
          });
        } else if (finalRef) {
          transaction.set(finalRef, {
            contestId,
            players: sanitizeDataForFirestore(finalCleanList),
            updatedAt: nowIso,
          });
        }
      });

      // 화면 다시 그리기
      await fetchPool();

      setMessage({
        variant: "success",
        title: "선수 사진 데이터 동기화 완료",
        body: `총 ${cleanedPlayers.length}명의 출전 명단 중 ${photoAthleteCount}명의 사진 ${totalPhotoCount}장이 동기화되었습니다.`,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("사진 데이터 갱신 실패 상세 원인:", error);
      setMessage({
        variant: "error",
        title: "사진 데이터 동기화 실패",
        body: "사진 데이터를 갱신하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsSyncingPhotos(false);
    }
  };

  /** 1단계 선수 번호 배정(assign) 기준으로 계측 명단 새로 갱신 */
  const handleRefreshAndSyncAssign = async () => {
    try {
      setIsLoading(true);
      await fetchPool();
      setMessage({
        variant: "success",
        title: "계측 명단 최신화 완료",
        body: "선수 번호 배정 기준으로 계측 명단을 새로 불러왔습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("명단 갱신 실패:", error);
      setMessage({
        variant: "error",
        title: "명단 갱신 실패",
        body: "계측 명단을 갱신하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  /** 기존 계측/월체 데이터 무시하고 1단계 선수 번호 배정 원본으로 초기화(덮어쓰기) */
  const handleForceResetToAssign = async () => {
    const contestId =
      currentContest?.contests?.id ||
      currentContest?.contestInfo?.id ||
      currentContest?.id ||
      "";
    const assignId = currentContest?.contests?.contestPlayersAssignId;
    const finalId = currentContest?.contests?.contestPlayersFinalId;

    if (!assignId) {
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

    try {
      setIsLoading(true);
      // 1. 1단계 배정 문서 및 신청서 원본 실시간 조회
      const returnPlayersAssign = await fetchPlayersAssignDocument.getDocument(assignId);
      const rawAssignPlayers = returnPlayersAssign?.players || [];

      if (rawAssignPlayers.length === 0) {
        setMessage({
          variant: "warning",
          title: "배정된 선수 명단 없음",
          body: "1단계에 배정된 선수 명단이 없습니다. 먼저 선수 번호 배정을 진행해 주세요.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        return;
      }

      // 신청서 원본(contest_entrys_list) 체급 맵 구축
      const entryGradeMap = new Map();
      if (contestId) {
        try {
          const entrySnap = await getDocs(
            query(collection(db, "contest_entrys_list"), where("contestId", "==", contestId))
          );
          entrySnap.docs.forEach((d) => {
            const data = d.data();
            const uid = data.playerUid || "";
            const catId = data.contestCategoryId || "";
            const rawName = (data.playerName || data.contestPlayerName || data.name || "").trim();
            const gId = data.contestGradeId || "";
            const gTitle = data.contestGradeTitle || "";
            if (gId) {
              if (uid && catId) entryGradeMap.set(`${uid}_${catId}`, { contestGradeId: gId, contestGradeTitle: gTitle });
              if (rawName && catId) entryGradeMap.set(`${rawName}_${catId}`, { contestGradeId: gId, contestGradeTitle: gTitle });
            }
          });
        } catch (e) {
          console.warn("신청서 원본 조회 실패:", e);
        }
      }

      // 2. 모든 월체/불참/계측 오염 데이터를 지우고 1단계 순수 배정본으로 깨끗하게 재구성
      const cleanResetPlayers = rawAssignPlayers.map((p) => {
        const catId = p.contestCategoryId || "";
        const rawName = (p.playerName || "").trim();
        const entryOrig =
          (p.playerUid && entryGradeMap.get(`${p.playerUid}_${catId}`)) ||
          (rawName && entryGradeMap.get(`${rawName}_${catId}`));

        const trueGradeId = entryOrig?.contestGradeId || p.originalGradeId || p.contestGradeId;
        const trueGradeTitle = entryOrig?.contestGradeTitle || p.originalGradeTitle || p.contestGradeTitle;

        return {
          ...p,
          originalGradeId: trueGradeId,
          originalGradeTitle: trueGradeTitle,
          contestGradeId: trueGradeId,
          contestGradeTitle: trueGradeTitle,
          isGradeChanged: false,
          playerNoShow: false,
          isWeighedIn: false,
          heightWeight: "",
          playerHeight: "",
          playerWeight: "",
          height: "",
          weight: "",
          playerIndex:
            Number(p.playerIndex) >= 1000
              ? Number(p.playerIndex) - 1000
              : Number(p.playerIndex) || Number(p.playerNumber) || 0,
        };
      });

      const sanitizedAssignList = sanitizeDataForFirestore(cleanResetPlayers);

      // 3. assign 문서 및 final 문서를 순수 원본 배정본으로 덮어쓰되, final 전용 그랑프리/강제등록 선수는 안전 보존!
      await runTransaction(db, async (transaction) => {
        const assignRef = doc(db, "contest_players_assign", assignId);
        const finalRef = finalId
          ? doc(db, "contest_players_final", finalId)
          : null;
        const assignSnap = await transaction.get(assignRef);
        const finalSnap = finalRef ? await transaction.get(finalRef) : null;
        const nowIso = new Date().toISOString();

        if (assignSnap.exists()) {
          transaction.update(assignRef, {
            players: sanitizedAssignList,
            updatedAt: nowIso,
          });
        }

        if (finalRef) {
          const existingFinalPlayers = finalSnap?.exists()
            ? finalSnap.data()?.players || []
            : [];
          const preservedSpecialFinal = existingFinalPlayers.filter(
            (fp) =>
              fp &&
              (fp.createdBy === "force" ||
                fp.createBy === "force" ||
                isGrandPrixEntryLike(fp))
          );
          const nextFinalPlayers = mergePreservingUnmatchedFinalEntries(
            cleanResetPlayers,
            preservedSpecialFinal
          );
          const sanitizedFinalList =
            sanitizeDataForFirestore(nextFinalPlayers);

          if (finalSnap?.exists()) {
            transaction.update(finalRef, {
              contestId,
              players: sanitizedFinalList,
              updatedAt: nowIso,
            });
          } else {
            transaction.set(finalRef, {
              contestId,
              players: sanitizedFinalList,
              updatedAt: nowIso,
            });
          }
        }
      });

      // 4. 화면 로컬 상태 즉시 갱신
      await fetchPool();

      setMessage({
        variant: "success",
        title: "계측 명단 원상복구 완료",
        body: `1단계 선수 번호 배정 원본으로 초기화되었습니다 (총 ${cleanResetPlayers.length}명 복구).`,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("완전 초기화 덮어쓰기 실패:", error);
      setMessage({
        variant: "error",
        title: "초기화 덮어쓰기 실패",
        body: "배정 원본으로 초기화하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  /** 🎯 핀셋 개별 선수 계측 확인 및 DB 트랜잭션 즉시 저장 함수 (다중 데스크 동시성 및 그랑프리/강제등록 보존) */
  const persistSinglePlayerWeighIn = async (targetEntryKey, updatedFields) => {
    const assignId = currentContest?.contests?.contestPlayersAssignId;
    const finalId = currentContest?.contests?.contestPlayersFinalId;
    const contestId =
      currentContest?.contests?.id ||
      currentContest?.contestInfo?.id ||
      currentContest?.id ||
      "";

    const isTargetMatch = (p) => {
      if (!p) return false;
      const pKey = getPlayerEntryKey(p);
      if (pKey === targetEntryKey) return true;
      return Boolean(
        p.playerUid &&
          updatedFields.playerUid &&
          p.playerUid === updatedFields.playerUid &&
          p.contestCategoryId ===
            (updatedFields.contestCategoryId || p.contestCategoryId)
      );
    };

    const applyPatchToPlayer = (p) => {
      const hwCandidate =
        updatedFields.heightWeight !== undefined
          ? updatedFields.heightWeight
          : p.heightWeight;
      const { height, weight } = parseHeightWeight(hwCandidate);
      const safeH =
        updatedFields.heightWeight !== undefined
          ? height
          : height ||
            updatedFields.playerHeight ||
            p.playerHeight ||
            p.height ||
            "";
      const safeW =
        updatedFields.heightWeight !== undefined
          ? weight
          : weight ||
            updatedFields.playerWeight ||
            p.playerWeight ||
            p.weight ||
            "";
      const origGId =
        updatedFields.originalGradeId || p.originalGradeId || p.contestGradeId;
      const origGTitle =
        updatedFields.originalGradeTitle ||
        p.originalGradeTitle ||
        p.contestGradeTitle;
      const isGpEntry = isGrandPrixEntryLike(p);
      const isGradeChanged = isGpEntry
        ? false
        : updatedFields.isGradeChanged !== undefined
        ? !!updatedFields.isGradeChanged
        : !!p.isGradeChanged;

      const gpIndexPatch =
        isGpEntry && updatedFields.playerIndex !== undefined
          ? {
              playerIndexOriginal:
                p.playerIndexOriginal !== undefined &&
                p.playerIndexOriginal !== null
                  ? p.playerIndexOriginal
                  : p.playerIndex ?? p.playerNumber ?? null,
              grandPrixIndex:
                updatedFields.grandPrixIndex ?? updatedFields.playerIndex,
              isCustomGrandPrixIndex: true,
              isGradeChange: false,
            }
          : {};

      return {
        ...p,
        ...updatedFields,
        ...gpIndexPatch,
        originalGradeId: origGId,
        originalGradeTitle: origGTitle,
        isGradeChanged: isGradeChanged,
        contestGradeId: isGpEntry
          ? updatedFields.contestGradeId || p.contestGradeId
          : isGradeChanged
          ? updatedFields.contestGradeId || p.contestGradeId || origGId
          : origGId,
        contestGradeTitle: isGpEntry
          ? updatedFields.contestGradeTitle || p.contestGradeTitle
          : isGradeChanged
          ? updatedFields.contestGradeTitle || p.contestGradeTitle || origGTitle
          : origGTitle,
        playerHeight: safeH,
        playerWeight: safeW,
        height: safeH,
        weight: safeW,
        heightWeight:
          updatedFields.heightWeight !== undefined
            ? updatedFields.heightWeight
            : formatHeightWeight(safeH, safeW) || p.heightWeight || "",
      };
    };

    const currentMatchedLocal = playersArray.find((p) => isTargetMatch(p));
    let updatedTargetPlayer = currentMatchedLocal
      ? applyPatchToPlayer(currentMatchedLocal)
      : null;

    setPlayersArray((prev) =>
      prev.map((p) => {
        if (isTargetMatch(p)) {
          const nextObj = applyPatchToPlayer(p);
          updatedTargetPlayer = nextObj;
          return nextObj;
        }
        return p;
      })
    );

    if (!updatedTargetPlayer) return;

    // Firestore runTransaction으로 해당 선수 엔트리만 원자적(Atomic)으로 핀셋 갱신!
    try {
      await runTransaction(db, async (transaction) => {
        const assignRef = assignId
          ? doc(db, "contest_players_assign", assignId)
          : null;
        const finalRef = finalId
          ? doc(db, "contest_players_final", finalId)
          : null;

        const assignSnap = assignRef ? await transaction.get(assignRef) : null;
        const finalSnap = finalRef ? await transaction.get(finalRef) : null;
        const nowIso = new Date().toISOString();

        const remoteAssignPlayers = assignSnap?.exists()
          ? assignSnap.data()?.players || []
          : [];
        let matchedInAssign = false;
        const nextAssignPlayers = remoteAssignPlayers.map((rp) => {
          if (isTargetMatch(rp)) {
            matchedInAssign = true;
            return applyPatchToPlayer(rp);
          }
          return rp;
        });

        if (!matchedInAssign && !isAutoGrandPrixEntry(updatedTargetPlayer)) {
          nextAssignPlayers.push(updatedTargetPlayer);
        }

        const remoteFinalPlayers = finalSnap?.exists()
          ? finalSnap.data()?.players || []
          : [];

        let nextFinalPlayers = [];
        if (remoteFinalPlayers.length > 0) {
          let matchedInFinal = false;
          const patchedFinal = remoteFinalPlayers.map((fp) => {
            if (isTargetMatch(fp)) {
              matchedInFinal = true;
              return applyPatchToPlayer(fp);
            }
            return fp;
          });
          if (!matchedInFinal) {
            patchedFinal.push(updatedTargetPlayer);
          }
          // assign에만 있고 final에 없던 선수도 누락 없이 병합하며, final 전용(그랑프리/강제등록) 선수는 100% 유지
          nextFinalPlayers = mergePreservingUnmatchedFinalEntries(
            patchedFinal,
            nextAssignPlayers
          );
        } else {
          const seedFinal = [...nextAssignPlayers];
          if (
            !seedFinal.some((p) => isTargetMatch(p)) &&
            updatedTargetPlayer
          ) {
            seedFinal.push(updatedTargetPlayer);
          }
          nextFinalPlayers = seedFinal;
        }

        if (assignRef && assignSnap?.exists()) {
          transaction.update(assignRef, {
            players: sanitizeDataForFirestore(nextAssignPlayers),
            updatedAt: nowIso,
          });
        }

        if (finalRef && finalSnap?.exists()) {
          transaction.update(finalRef, {
            contestId,
            players: sanitizeDataForFirestore(nextFinalPlayers),
            updatedAt: nowIso,
          });
        } else if (finalRef) {
          transaction.set(finalRef, {
            contestId,
            players: sanitizeDataForFirestore(nextFinalPlayers),
            updatedAt: nowIso,
          });
        }
      });

      if (focusedPlayerKeyRef.current !== targetEntryKey) {
        dirtyPlayerKeysRef.current.delete(targetEntryKey);
      }
    } catch (error) {
      console.error("핀셋 계측 저장 실패:", error);
      setMessage({
        variant: "error",
        title: "계측 데이터 즉시 저장 실패",
        body: "변경사항을 저장하는 중 오류가 발생했습니다. 네트워크를 확인해 주세요.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    }
  };

  /** 신장/체중 입력란 옆 [계측완료] 버튼 클릭 시 DB 즉시 저장 */
  const handleSavePlayerWeighIn = async (player) => {
    const entryKey = getPlayerEntryKey(player);
    const { height, weight } = parseHeightWeight(player.heightWeight);
    const safeH = height || player.playerHeight || player.height || "";
    const safeW = weight || player.playerWeight || player.weight || "";
    const combinedHW = formatHeightWeight(safeH, safeW);

    await persistSinglePlayerWeighIn(entryKey, {
      heightWeight: combinedHW,
      playerHeight: safeH,
      playerWeight: safeW,
      height: safeH,
      weight: safeW,
      isWeighedIn: true,
    });
  };

  /** 불참 처리 토글 (체크/해제 즉시 DB에 핀셋 영구 저장) */
  const handleNoShow = async (playerNumber, playerEntryKey, e) => {
    const isChecked = e.target.checked;
    const targetPlayer = playersArray.find((p) => getPlayerEntryKey(p) === playerEntryKey);

    const updateObj = {
      playerNoShow: isChecked,
      isWeighedIn: isChecked ? false : targetPlayer?.isWeighedIn,
    };

    void playerNumber;
    await persistSinglePlayerWeighIn(playerEntryKey, updateObj);
  };

  /** ⚖️ 월체 처리 (동일 종목 내 바로 다음 체급으로 승급 / 체크 해제 시 원래 배정 체급으로 100% 완벽 원복) */
  const handleGradeChage = async (
    e,
    currentCategoryId,
    currentGradeId,
    currentGradeTitle,
    playerEntryKey
  ) => {
    const isChecked = e.target.checked;
    const newPlayers = [...playersArray];

    const playerFindIndex = newPlayers.findIndex(
      (entry) => getPlayerEntryKey(entry) === playerEntryKey
    );

    if (playerFindIndex === -1) return;

    const currentPlayerInfo = newPlayers[playerFindIndex];
    const catId = currentPlayerInfo.contestCategoryId || currentCategoryId;

    // 🌟 선수의 진짜 원래 배정 체급(Original Grade) 확정
    const assignOriginal = (playersAssign?.players || []).find(
      (p) =>
        p.playerUid === currentPlayerInfo.playerUid &&
        p.contestCategoryId === catId
    );

    const origGradeId =
      currentPlayerInfo.originalGradeId ||
      assignOriginal?.contestGradeId ||
      currentGradeId;

    const origGradeTitle =
      currentPlayerInfo.originalGradeTitle ||
      assignOriginal?.contestGradeTitle ||
      currentGradeTitle;

    const sameCategoryGrades = gradesArray
      .filter((g) => g.refCategoryId === catId)
      .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex);

    let gradeUpdate = {};

    if (isChecked) {
      // 1. 월체 신청: 원래 체급(origGradeId) 기준 바로 다음 상위 체급으로 이동
      const origGradeIdxInCat = sameCategoryGrades.findIndex(
        (g) => g.contestGradeId === origGradeId
      );

      if (
        origGradeIdxInCat !== -1 &&
        origGradeIdxInCat < sameCategoryGrades.length - 1
      ) {
        const nextGrade = sameCategoryGrades[origGradeIdxInCat + 1];

        gradeUpdate = {
          originalGradeId: origGradeId,
          originalGradeTitle: origGradeTitle,
          contestGradeId: nextGrade.contestGradeId,
          contestGradeTitle: nextGrade.contestGradeTitle,
          isGradeChanged: true,
          playerIndex:
            currentPlayerInfo.playerIndex >= 1000
              ? currentPlayerInfo.playerIndex
              : currentPlayerInfo.playerIndex + 1000,
        };
        setMessage({
          variant: "info",
          title: "체급 월체 이동 완료",
          body: `#${currentPlayerInfo.playerNumber} ${currentPlayerInfo.playerName} 선수가 '${nextGrade.contestGradeTitle}' 체급으로 이동되었습니다.`,
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
      } else {
        setMessage({
          variant: "warning",
          title: "월체 이동 불가",
          body: "해당 종목의 최고 체급이므로 상위 체급으로 월체할 수 없습니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        return;
      }
    } else {
      // 2. 월체 취소: 원래 체급(origGradeId)으로 100% 완벽 원복!
      const originalGradeObj = sameCategoryGrades.find(
        (g) => g.contestGradeId === origGradeId
      );

      gradeUpdate = {
        originalGradeId: origGradeId,
        originalGradeTitle: origGradeTitle,
        contestGradeId: origGradeId,
        contestGradeTitle:
          originalGradeObj?.contestGradeTitle || origGradeTitle,
        isGradeChanged: false,
        playerIndex:
          currentPlayerInfo.playerIndex >= 1000
            ? currentPlayerInfo.playerIndex - 1000
            : currentPlayerInfo.playerIndex,
      };
      setMessage({
        variant: "info",
        title: "월체 해제 및 원복 완료",
        body: `#${currentPlayerInfo.playerNumber} ${currentPlayerInfo.playerName} 선수가 원래 체급('${gradeUpdate.contestGradeTitle}')으로 복귀했습니다.`,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    }

    // 🌟 월체 변경/취소는 체급 이동이므로 즉시 DB에 핀셋 영구 저장하여 상태를 동기화!
    await persistSinglePlayerWeighIn(playerEntryKey, gradeUpdate);
  };

  /** 📏 신장(height) 개별 수정 (로컬 dirty 등록으로 onSnapshot 입력 증발 방지) */
  const handleHeightChange = (playerEntryKey, newHeight) => {
    if (playerEntryKey) {
      dirtyPlayerKeysRef.current.add(playerEntryKey);
    }
    setPlayersArray((prev) =>
      prev.map((p) => {
        if (getPlayerEntryKey(p) === playerEntryKey) {
          const { weight } = parseHeightWeight(p.heightWeight);
          const combined = formatHeightWeight(newHeight, weight);
          return { ...p, heightWeight: combined };
        }
        return p;
      })
    );
  };

  /** 📏 체중(weight) 개별 수정 (로컬 dirty 등록으로 onSnapshot 입력 증발 방지) */
  const handleWeightChange = (playerEntryKey, newWeight) => {
    if (playerEntryKey) {
      dirtyPlayerKeysRef.current.add(playerEntryKey);
    }
    setPlayersArray((prev) =>
      prev.map((p) => {
        if (getPlayerEntryKey(p) === playerEntryKey) {
          const { height } = parseHeightWeight(p.heightWeight);
          const combined = formatHeightWeight(height, newWeight);
          return { ...p, heightWeight: combined };
        }
        return p;
      })
    );
  };

  // ✅ 번호/인덱스/신장체중 수정 모달 열기
  const openNumberModal = (player) => {
    const key = getPlayerEntryKey(player);
    const { height, weight } = parseHeightWeight(player.heightWeight);
    setEditTargetKey(key);
    setEditValues({
      playerNumber: Number(player.playerNumber) || 0,
      playerIndex:
        Number(
          isGrandPrixEntryLike(player)
            ? player.grandPrixIndex ?? player.playerIndex
            : player.playerIndex
        ) ||
        Number(player.playerNumber) ||
        0,
      playerName: player.playerName || "",
      height: height || "",
      weight: weight || "",
    });
    setNumModalOpen(true);
  };

  // ✅ 번호/인덱스/신장체중 수정 적용 (DB 즉시 영구 저장)
  const applyNumberChange = async () => {
    const { playerNumber, playerIndex, height, weight } = editValues;
    if (!editTargetKey || playerNumber <= 0 || playerIndex <= 0) return;

    const targetKey = editTargetKey;
    const num = Number(playerNumber);
    const pIdx = Number(playerIndex);
    const combinedHW = formatHeightWeight(height, weight);

    setNumModalOpen(false);
    setEditTargetKey(null);

    await persistSinglePlayerWeighIn(targetKey, {
      playerNumber: num,
      playerIndex: pIdx,
      heightWeight: combinedHW,
      playerHeight: height || "",
      playerWeight: weight || "",
      height: height || "",
      weight: weight || "",
    });
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      isInitialHydratedRef.current = false;
      fetchPool();
    }
  }, [currentContest?.contests?.id]);

  useEffect(() => {
    if (categorysArray.length > 0) {
      initEntryList();
    }
  }, [categorysArray, gradesArray, playersArray]);

  // 통계 계산
  // 통계 계산
  const totalPlayersCount = playersArray.length;
  const noShowCount = playersArray.filter((p) => p.playerNoShow).length;
  const activePlayersCount = totalPlayersCount - noShowCount;
  const gradeChangedCount = playersArray.filter((p) => p.isGradeChanged).length;

  // 부문(Section) 목록
  const sectionOptions = useMemo(() => {
    const raw = categorysArray.map((c) => c.contestCategorySection).filter(Boolean);
    return ["all", ...new Set(raw)];
  }, [categorysArray]);

  // 필터링된 매칭 배열 계산
  const filteredMatchedArray = useMemo(() => {
    return matchedArray
      .filter((catGrade) => {
        if (selectedSection !== "all" && catGrade.contestCategorySection !== selectedSection) {
          return false;
        }
        return true;
      })
      .map((catGrade) => {
        let players = catGrade.matchedPlayers || [];

        if (searchKeyword.trim()) {
          const q = searchKeyword.trim().toLowerCase();
          players = players.filter((p) => {
            const name = (p.playerName || "").toLowerCase();
            const num = String(p.playerNumber || "");
            const gym = (p.playerGym || "").toLowerCase();
            const tel = String(p.playerTel || "");
            return (
              name.includes(q) ||
              num.includes(q) ||
              gym.includes(q) ||
              tel.includes(q)
            );
          });
        }

        if (filterWeighedStatus === "active") {
          players = players.filter((p) => !p.playerNoShow);
        } else if (filterWeighedStatus === "noshow") {
          players = players.filter((p) => p.playerNoShow);
        } else if (filterWeighedStatus === "gradeChanged") {
          players = players.filter((p) => p.isGradeChanged && !p.playerNoShow);
        }

        return {
          ...catGrade,
          matchedPlayers: players,
        };
      })
      .filter((catGrade) => catGrade.matchedPlayers.length > 0);
  }, [matchedArray, selectedSection, searchKeyword, filterWeighedStatus]);

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

          {/* 선수 번호/인덱스/신장·체중 수정 드로어 */}
          <WeighInNumberEditDrawer
            open={numModalOpen}
            onClose={() => {
              setNumModalOpen(false);
              setEditTargetKey(null);
            }}
            editValues={editValues}
            setEditValues={setEditValues}
            onApply={applyNumberChange}
          />

          {/* 선수 사진 확인 및 무대용 사진 1, 2 지정 드로어 */}
          <WeighInStagePhotoDrawer
            open={photoModalOpen}
            onClose={() => {
              setPhotoModalOpen(false);
              setPhotoModalPlayer(null);
            }}
            player={photoModalPlayer}
            onSwapStageSlots={handleSwapStageSlots}
            onClearStageSlot={handleClearStageSlot}
            onAssignStageSlot={handleAssignStageSlot}
            onSetStageSlot={handleSetStageSlot}
            onConfirmSave={handleConfirmSavePhotoModal}
          />

          {/* 1. 상단 타이틀 & 실시간 계측 현황 카드 */}
          <WeighInStatsHeader
            contestTitle={currentContest?.contests?.contestTitle}
            activePlayersCount={activePlayersCount}
            totalPlayersCount={totalPlayersCount}
            noShowCount={noShowCount}
            gradeChangedCount={gradeChangedCount}
            isSyncingPhotos={isSyncingPhotos}
            hasPlayers={Boolean(playersArray?.length > 0)}
            onRefreshAndSyncAssign={handleRefreshAndSyncAssign}
            onForceResetToAssign={handleForceResetToAssign}
            onSyncCleanPhotoData={handleSyncCleanPhotoData}
            onSavePlayersFinal={() =>
              handleUpdatePlayersFinal(
                currentContest?.contests?.id,
                currentContest?.contests?.contestPlayersAssignId,
                currentContest?.contests?.contestPlayersFinalId,
                playersArray
              )
            }
            onNavigateToAssign={() =>
              navigate("/contesttimetable", { state: { tabId: 1 } })
            }
          />

          {/* 2. 검색 & 부문 필터 & 상태 필터 바 */}
          <WeighInFilterToolbar
            searchKeyword={searchKeyword}
            onSearchChange={setSearchKeyword}
            sectionOptions={sectionOptions}
            selectedSection={selectedSection}
            onSelectSection={setSelectedSection}
            filterWeighedStatus={filterWeighedStatus}
            onSelectStatus={setFilterWeighedStatus}
            totalPlayersCount={totalPlayersCount}
            activePlayersCount={activePlayersCount}
            gradeChangedCount={gradeChangedCount}
            noShowCount={noShowCount}
            onRefresh={fetchPool}
          />

          {/* 3. 종목 및 체급별 선수 계측 테이블 목록 */}
          <WeighInGradeSectionList
            filteredMatchedArray={filteredMatchedArray}
            isMobile={isMobile}
            focusedPlayerKeyRef={focusedPlayerKeyRef}
            onOpenPhotoModal={(player) => {
              setPhotoModalPlayer(player);
              setPhotoModalOpen(true);
            }}
            onHeightChange={handleHeightChange}
            onWeightChange={handleWeightChange}
            onSavePlayerWeighIn={handleSavePlayerWeighIn}
            onGradeChange={handleGradeChage}
            onNoShowChange={handleNoShow}
            onOpenNumberModal={openNumberModal}
          />
        </div>
      )}
    </div>
  );
};

export default ContestPlayerWeighInTable;
