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
import LayerPlayerEditDrawer from "../components/player/LayerPlayerEditDrawer";
import WeighInStagePhotoDrawer from "../components/weighIn/WeighInStagePhotoDrawer";
import WeighInStatsHeader from "../components/weighIn/WeighInStatsHeader";
import WeighInFilterToolbar from "../components/weighIn/WeighInFilterToolbar";
import WeighInGradeSectionList from "../components/weighIn/WeighInGradeSectionList";
import { getStagePlayerSortIndex } from "../functions/functions";
import { sanitizeForFirestore as sanitizeDataForFirestore } from "../utils/firestoreSanitize";
import {
  getPlayerEntryKey,
  isGrandPrixEntryLike,
  isAutoGrandPrixEntry,
  parseHeightWeightValue as parseHeightWeight,
  formatHeightWeightValue as formatHeightWeight,
} from "../utils/playerEntryUtils";
import {
  buildPatchedLayerPlayer,
  forwardWeighInToFinalPlayers,
  hydrateWeighInLayerPlayers,
  isSameLayerPlayerEntry,
} from "../utils/layerPlayerEditUtils";
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

  // ✅ 선수 정보 직접 수정 드로어 상태
  const [numModalOpen, setNumModalOpen] = useState(false);
  const [editTargetKey, setEditTargetKey] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [isDirectSaving, setIsDirectSaving] = useState(false);

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

      let finalDocData = null;
      let finalPlayers = [];
      if (currentContest?.contests?.contestPlayersFinalId) {
        const returnPlayersFinal = await fetchPlayersFinalDocument.getDocument(
          currentContest.contests.contestPlayersFinalId
        );
        finalDocData = returnPlayersFinal || null;
        finalPlayers = returnPlayersFinal?.players || [];
      }

      const weighInSavedPlayers = Array.isArray(finalDocData?.weighInPlayers)
        ? finalDocData.weighInPlayers
        : [];

      // 📸 다종목 선수 사진 playerUid 기반 글로벌 매핑
      const uidPhotoMap = new Map();
      [...assignPlayers, ...weighInSavedPlayers, ...finalPlayers].forEach((p) => {
        if (p?.playerUid) {
          const photos = extractPlayerPhotos(p);
          const fromInv = invoicePhotosMap.get(p.playerUid) || [];
          const allFound = Array.from(new Set([...photos, ...fromInv]));
          if (allFound.length > 0) {
            const existing = uidPhotoMap.get(p.playerUid) || [];
            uidPhotoMap.set(
              p.playerUid,
              Array.from(new Set([...existing, ...allFound]))
            );
          }
        }
      });

      // 🛡️ 2단계 레이어 하이드레이션:
      // - 2단계 저장본(weighInPlayers)이 없으면 1단계(assignPlayers) 수정값을 그대로 승계!
      // - 이미 2단계 저장본이 있으면 2단계의 선수번호·이름·소속·체급·계측값을 보존하고 1단계 사후 수정으로 덮어쓰지 않음!
      const rawLayer2Players = hydrateWeighInLayerPlayers({
        assignPlayers,
        finalDocData,
      });

      const mergedLoadedPlayers = rawLayer2Players.map((p) => {
        const trimmedName = (p.playerName || "").trim();
        const catId = p.contestCategoryId || "";
        const telPart = (p.playerTel || "").replace(/[^0-9]/g, "").slice(-4);
        const nameKey = `${trimmedName}_${telPart}`;
        const entryKeyUid = p.playerUid ? `${p.playerUid}_${catId}` : "";
        const entryKeyName = trimmedName ? `${trimmedName}_${catId}` : "";

        const entryOriginal =
          (entryKeyUid && entryOriginalGradeMap.get(entryKeyUid)) ||
          (entryKeyName && entryOriginalGradeMap.get(entryKeyName));

        const origGradeId =
          p.originalGradeId ||
          entryOriginal?.contestGradeId ||
          p.contestGradeId;
        const origGradeTitle =
          p.originalGradeTitle ||
          entryOriginal?.contestGradeTitle ||
          p.contestGradeTitle;

        const allPlayerPhotos = Array.from(
          new Set([
            ...((p.playerUid && uidPhotoMap.get(p.playerUid)) || []),
            ...((p.playerUid && invoicePhotosMap.get(p.playerUid)) || []),
            ...(namePhonePhotoMap.get(nameKey) || []),
            ...((trimmedName && nameOnlyPhotoMap.get(trimmedName)) || []),
            ...extractPlayerPhotos(p),
          ])
        );

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
        const effectiveStagePhotos = resolveEffectiveStagePhotoFields(
          p,
          invoiceFallbackPhotos
        );

        const isGradeChanged = Boolean(p.isGradeChanged);

        return {
          ...p,
          originalGradeId: origGradeId,
          originalGradeTitle: origGradeTitle,
          isGradeChanged,
          contestGradeId: isGradeChanged
            ? p.contestGradeId || origGradeId
            : p.contestGradeId || origGradeId,
          contestGradeTitle: isGradeChanged
            ? p.contestGradeTitle || origGradeTitle
            : p.contestGradeTitle || origGradeTitle,
          heightWeight: p.heightWeight || "",
          playerNoShow: Boolean(p.playerNoShow),
          isWeighedIn: Boolean(p.isWeighedIn),
          ...effectiveStagePhotos,
          photos: allPlayerPhotos,
        };
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

  // 📡 [다중 계측대 실시간 Live-Sync 리스너 — 2단계 계측 레이어(weighInPlayers) 구독]
  useEffect(() => {
    const finalDocId = currentContest?.contests?.contestPlayersFinalId;
    if (!finalDocId) return;

    const unsub = onSnapshot(
      doc(db, "contest_players_final", finalDocId),
      (docSnap) => {
        if (!isInitialHydratedRef.current) return;
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          const remotePlayers = Array.isArray(remoteData?.weighInPlayers)
            ? remoteData.weighInPlayers
            : (remoteData?.players || []).filter((p) => !isAutoGrandPrixEntry(p));

          if (remotePlayers.length > 0) {
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

                const matchedRemote =
                  remoteMap.get(k) ||
                  remotePlayers.find((rp) => isSameLayerPlayerEntry(rp, localP));

                if (matchedRemote) {
                  const matchedKey = getPlayerEntryKey(matchedRemote);
                  if (matchedKey) seenKeys.add(matchedKey);

                  const isProtectedRow =
                    k === editTargetKeyRef.current ||
                    k === focusedPlayerKeyRef.current ||
                    dirtyPlayerKeysRef.current.has(k);

                  if (isProtectedRow) {
                    return {
                      ...localP,
                      ...(dirtyPhotoKeysRef.current.has(k)
                        ? {}
                        : resolveEffectiveStagePhotoFields(matchedRemote, localP)),
                      photos:
                        localP.photos && localP.photos.length > 0
                          ? localP.photos
                          : matchedRemote.photos || [],
                    };
                  }

                  const resolvedPhotoFields = dirtyPhotoKeysRef.current.has(k)
                    ? resolveEffectiveStagePhotoFields(localP, matchedRemote)
                    : resolveEffectiveStagePhotoFields(matchedRemote, localP);

                  return {
                    ...localP,
                    ...matchedRemote,
                    playerNoShow: Boolean(matchedRemote.playerNoShow),
                    isGradeChanged: Boolean(matchedRemote.isGradeChanged),
                    isWeighedIn: Boolean(matchedRemote.isWeighedIn),
                    ...resolvedPhotoFields,
                    photos:
                      matchedRemote.photos && matchedRemote.photos.length > 0
                        ? matchedRemote.photos
                        : localP.photos,
                  };
                }
                return localP;
              });

              remotePlayers.forEach((rp) => {
                const k = getPlayerEntryKey(rp);
                const alreadyInLocal =
                  (k && seenKeys.has(k)) ||
                  updatedLocal.some((lp) => isSameLayerPlayerEntry(lp, rp));
                if (!alreadyInLocal) {
                  if (k) seenKeys.add(k);
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
  }, [currentContest?.contests?.contestPlayersFinalId]);

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
        const latestWeighInPlayers = Array.isArray(latestFinalDoc?.weighInPlayers)
          ? latestFinalDoc.weighInPlayers
          : hydrateWeighInLayerPlayers({
              assignPlayers: latestAssignPlayers,
              finalDocData: latestFinalDoc,
            });

        // 📸 playerUid 기반 사진 통합 맵 (다종목 출전 시 모든 체급에 동일 선수의 사진 100% 물림 보장)
        const saveUidPhotoMap = new Map();
        [
          ...latestAssignPlayers,
          ...latestWeighInPlayers,
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

        // 2단계 기준 목록(latestWeighInPlayers)에 로컬 변경사항을 안전 병합 (1단계 assign 문서는 절대 역수정하지 않음!)
        const mergedWeighInPlayers = latestWeighInPlayers.map((dbPlayer) => {
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

          const matchedLocal =
            localPlayersMap.get(key) ||
            (currentLocalPlayers || []).find((lp) =>
              isSameLayerPlayerEntry(lp, dbPlayer)
            );

          if (matchedLocal) {
            const lp = matchedLocal;
            const lpKey = getPlayerEntryKey(lp);
            const isLocalDirty = dirtySet.has(key) || dirtySet.has(lpKey);
            const isPhotoDirty =
              dirtyPhotoKeysRef.current.has(key) ||
              dirtyPhotoKeysRef.current.has(lpKey);
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
              ...lp,
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
                lp.originalGradeId ||
                dbPlayer.originalGradeId ||
                dbPlayer.contestGradeId,
              originalGradeTitle:
                lp.originalGradeTitle ||
                dbPlayer.originalGradeTitle ||
                dbPlayer.contestGradeTitle,
              contestGradeId: resolvedGradeChanged
                ? lp.contestGradeId || dbPlayer.contestGradeId
                : lp.contestGradeId || dbPlayer.originalGradeId || dbPlayer.contestGradeId,
              contestGradeTitle: resolvedGradeChanged
                ? lp.contestGradeTitle || dbPlayer.contestGradeTitle
                : lp.contestGradeTitle || dbPlayer.originalGradeTitle || dbPlayer.contestGradeTitle,
              playerNumber:
                Number(lp.playerNumber) || Number(dbPlayer.playerNumber) || 0,
              playerIndex:
                Number(lp.playerIndex) || Number(dbPlayer.playerIndex) || 0,
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

        localPlayersMap.forEach((localPlayer) => {
          if (
            !isAutoGrandPrixEntry(localPlayer) &&
            !mergedWeighInPlayers.some((p) => isSameLayerPlayerEntry(p, localPlayer))
          ) {
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

            mergedWeighInPlayers.push({
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
            });
          }
        });

        const normalizedWeighInPlayers = mergedWeighInPlayers.map((player) => {
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

        // 🛡️ 3단계에서 이미 직접 수정·저장한 항목(layer3Edited) 및 그랑프리 항목은 덮어쓰지 않고 보존!
        const mergedFinalPlayers = forwardWeighInToFinalPlayers({
          nextWeighInPlayers: normalizedWeighInPlayers,
          existingFinalPlayers: latestFinalPlayers,
        });

        const nowIso = new Date().toISOString();
        const sanitizedWeighIn = sanitizeDataForFirestore(
          normalizedWeighInPlayers
        );
        const sanitizedFinal = sanitizeDataForFirestore(mergedFinalPlayers);

        if (finalRef && finalSnap?.exists()) {
          transaction.update(finalRef, {
            ...latestFinalDoc,
            contestId: latestFinalDoc.contestId || contestId,
            weighInPlayers: sanitizedWeighIn,
            players: sanitizedFinal,
            updatedAt: nowIso,
          });
        } else if (finalRef) {
          transaction.set(finalRef, {
            contestId,
            weighInPlayers: sanitizedWeighIn,
            players: sanitizedFinal,
            updatedAt: nowIso,
          });
        }

        committedPlayersForState = normalizedWeighInPlayers;
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

      if (finalId) {
        await runTransaction(db, async (transaction) => {
          const assignRef = assignId
            ? doc(db, "contest_players_assign", assignId)
            : null;
          const finalRef = doc(db, "contest_players_final", finalId);

          const assignSnap = assignRef
            ? await transaction.get(assignRef)
            : null;
          const finalSnap = await transaction.get(finalRef);

          const nowIso = new Date().toISOString();
          const remoteAssignPlayers = assignSnap?.exists()
            ? assignSnap.data()?.players || []
            : [];
          const remoteFinalData = finalSnap.exists() ? finalSnap.data() : {};
          const remoteFinalPlayers = remoteFinalData?.players || [];
          const remoteWeighInPlayers = Array.isArray(
            remoteFinalData?.weighInPlayers
          )
            ? remoteFinalData.weighInPlayers
            : hydrateWeighInLayerPlayers({
                assignPlayers: remoteAssignPlayers,
                finalDocData: remoteFinalData,
              });

          const nextWeighInPlayers = remoteWeighInPlayers.map((p) =>
            isSamePhotoOwner(p) ? applyStageSlotsToPlayer(p) : p
          );

          const baseFinalSource =
            remoteFinalPlayers.length > 0
              ? remoteFinalPlayers
              : nextWeighInPlayers;
          const nextFinalPlayers = baseFinalSource.map((p) =>
            isSamePhotoOwner(p) ? applyStageSlotsToPlayer(p) : p
          );

          if (finalSnap.exists()) {
            transaction.update(finalRef, {
              weighInPlayers: sanitizeDataForFirestore(nextWeighInPlayers),
              players: sanitizeDataForFirestore(nextFinalPlayers),
              updatedAt: nowIso,
            });
          } else if (nextWeighInPlayers.length > 0) {
            transaction.set(finalRef, {
              contestId,
              weighInPlayers: sanitizeDataForFirestore(nextWeighInPlayers),
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

      // 5. Firestore 트랜잭션으로 2단계(weighInPlayers) 및 미수정 3단계(players)에 사진 동기화 (1단계 assign 원본 보존)
      await runTransaction(db, async (transaction) => {
        const finalRef = finalId
          ? doc(db, "contest_players_final", finalId)
          : null;
        if (!finalRef) return;
        const finalSnap = await transaction.get(finalRef);

        const nowIso = new Date().toISOString();
        const weighInCleanList = cleanedPlayers.filter(
          (p) => !isAutoGrandPrixEntry(p)
        );
        const existingFinalPlayers = finalSnap?.exists()
          ? finalSnap.data()?.players || []
          : [];
        const finalCleanList = forwardWeighInToFinalPlayers({
          nextWeighInPlayers: weighInCleanList,
          existingFinalPlayers,
        });

        if (finalSnap?.exists()) {
          transaction.update(finalRef, {
            contestId,
            weighInPlayers: sanitizeDataForFirestore(weighInCleanList),
            players: sanitizeDataForFirestore(finalCleanList),
            updatedAt: nowIso,
          });
        } else {
          transaction.set(finalRef, {
            contestId,
            weighInPlayers: sanitizeDataForFirestore(weighInCleanList),
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

      // 3. 1단계 assign 원본 문서는 건드리지 않고, 2단계(weighInPlayers) 및 미수정 3단계 항목만 1단계 배정본으로 초기화!
      await runTransaction(db, async (transaction) => {
        const finalRef = finalId
          ? doc(db, "contest_players_final", finalId)
          : null;
        if (!finalRef) return;
        const finalSnap = await transaction.get(finalRef);
        const nowIso = new Date().toISOString();

        const existingFinalPlayers = finalSnap?.exists()
          ? finalSnap.data()?.players || []
          : [];
        const nextFinalPlayers = forwardWeighInToFinalPlayers({
          nextWeighInPlayers: cleanResetPlayers,
          existingFinalPlayers,
        });
        const sanitizedWeighInList = sanitizeDataForFirestore(cleanResetPlayers);
        const sanitizedFinalList = sanitizeDataForFirestore(nextFinalPlayers);

        if (finalSnap?.exists()) {
          transaction.update(finalRef, {
            contestId,
            weighInPlayers: sanitizedWeighInList,
            players: sanitizedFinalList,
            updatedAt: nowIso,
          });
        } else {
          transaction.set(finalRef, {
            contestId,
            weighInPlayers: sanitizedWeighInList,
            players: sanitizedFinalList,
            updatedAt: nowIso,
          });
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

  /** 🎯 2단계 핀셋 개별 선수 계측/정보 수정 및 DB 트랜잭션 즉시 저장
   * - 1단계(contest_players_assign)는 절대 역수정하지 않음
   * - 2단계(weighInPlayers)를 즉시 갱신하고, 3단계에서 직접 수정되지 않은 항목(layer3Edited !== true)만 3단계로 단방향 승계
   */
  const persistSinglePlayerWeighIn = async (
    targetEntryKey,
    updatedFields,
    explicitBeforeSnapshot = null
  ) => {
    const assignId = currentContest?.contests?.contestPlayersAssignId;
    const finalId = currentContest?.contests?.contestPlayersFinalId;
    const contestId =
      currentContest?.contests?.id ||
      currentContest?.contestInfo?.id ||
      currentContest?.id ||
      "";

    const beforeSnapshot =
      explicitBeforeSnapshot ||
      playersArray.find((p) => getPlayerEntryKey(p) === targetEntryKey) ||
      null;

    const isTargetMatch = (p) => {
      if (!p) return false;
      if (beforeSnapshot && isSameLayerPlayerEntry(p, beforeSnapshot)) {
        return true;
      }
      const pKey = getPlayerEntryKey(p);
      return Boolean(targetEntryKey && pKey === targetEntryKey);
    };

    const applyPatchToPlayer = (p) => {
      const hwCandidate =
        updatedFields.heightWeight !== undefined
          ? updatedFields.heightWeight
          : p.heightWeight;
      const { height, weight } = parseHeightWeight(hwCandidate);
      const safeH =
        updatedFields.height !== undefined
          ? String(updatedFields.height).trim()
          : updatedFields.heightWeight !== undefined
          ? height
          : height ||
            updatedFields.playerHeight ||
            p.playerHeight ||
            p.height ||
            "";
      const safeW =
        updatedFields.weight !== undefined
          ? String(updatedFields.weight).trim()
          : updatedFields.heightWeight !== undefined
          ? weight
          : weight ||
            updatedFields.playerWeight ||
            p.playerWeight ||
            p.weight ||
            "";
      const isGpEntry = isGrandPrixEntryLike(p);
      const isGradeChanged = isGpEntry
        ? false
        : updatedFields.isGradeChanged !== undefined
        ? !!updatedFields.isGradeChanged
        : !!p.isGradeChanged;

      // 직접 체급 변경 시(월체 해제 상태) 새로운 체급을 기준 체급으로도 반영
      const origGId = isGradeChanged
        ? updatedFields.originalGradeId || p.originalGradeId || p.contestGradeId
        : updatedFields.contestGradeId ||
          updatedFields.originalGradeId ||
          p.originalGradeId ||
          p.contestGradeId;
      const origGTitle = isGradeChanged
        ? updatedFields.originalGradeTitle ||
          p.originalGradeTitle ||
          p.contestGradeTitle
        : updatedFields.contestGradeTitle ||
          updatedFields.originalGradeTitle ||
          p.originalGradeTitle ||
          p.contestGradeTitle;

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
        isGradeChanged,
        contestGradeId: isGpEntry
          ? updatedFields.contestGradeId || p.contestGradeId
          : isGradeChanged
          ? updatedFields.contestGradeId || p.contestGradeId || origGId
          : updatedFields.contestGradeId || origGId,
        contestGradeTitle: isGpEntry
          ? updatedFields.contestGradeTitle || p.contestGradeTitle
          : isGradeChanged
          ? updatedFields.contestGradeTitle || p.contestGradeTitle || origGTitle
          : updatedFields.contestGradeTitle || origGTitle,
        playerHeight: safeH,
        playerWeight: safeW,
        height: safeH,
        weight: safeW,
        heightWeight:
          updatedFields.heightWeight !== undefined
            ? updatedFields.heightWeight
            : formatHeightWeight(safeH, safeW) || p.heightWeight || "",
        weighInEditedAt: new Date().toISOString(),
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

    if (!updatedTargetPlayer || !finalId) return;

    try {
      await runTransaction(db, async (transaction) => {
        const assignRef = assignId
          ? doc(db, "contest_players_assign", assignId)
          : null;
        const finalRef = doc(db, "contest_players_final", finalId);

        const assignSnap = assignRef ? await transaction.get(assignRef) : null;
        const finalSnap = await transaction.get(finalRef);
        const nowIso = new Date().toISOString();

        const remoteAssignPlayers = assignSnap?.exists()
          ? assignSnap.data()?.players || []
          : [];
        const remoteFinalData = finalSnap.exists() ? finalSnap.data() : {};
        const remoteFinalPlayers = remoteFinalData?.players || [];
        const remoteWeighInBase = Array.isArray(remoteFinalData?.weighInPlayers)
          ? remoteFinalData.weighInPlayers
          : hydrateWeighInLayerPlayers({
              assignPlayers: remoteAssignPlayers,
              finalDocData: remoteFinalData,
            });

        let matchedInWeighIn = false;
        const nextWeighInPlayers = remoteWeighInBase.map((wp) => {
          if (!matchedInWeighIn && isTargetMatch(wp)) {
            matchedInWeighIn = true;
            return applyPatchToPlayer(wp);
          }
          return wp;
        });

        if (!matchedInWeighIn && !isAutoGrandPrixEntry(updatedTargetPlayer)) {
          nextWeighInPlayers.push(updatedTargetPlayer);
        }

        const nextFinalPlayers = forwardWeighInToFinalPlayers({
          nextWeighInPlayers,
          existingFinalPlayers: remoteFinalPlayers,
          beforeSnapshot: beforeSnapshot || currentMatchedLocal,
        });

        if (finalSnap.exists()) {
          transaction.update(finalRef, {
            contestId,
            weighInPlayers: sanitizeDataForFirestore(nextWeighInPlayers),
            players: sanitizeDataForFirestore(nextFinalPlayers),
            updatedAt: nowIso,
          });
        } else {
          transaction.set(finalRef, {
            contestId,
            weighInPlayers: sanitizeDataForFirestore(nextWeighInPlayers),
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

  // ✅ 2단계 선수 정보 직접 수정 드로어 열기
  const openNumberModal = (player) => {
    const key = getPlayerEntryKey(player);
    setEditTargetKey(key);
    setEditingPlayer(player);
    setNumModalOpen(true);
  };

  // ✅ 2단계 선수 정보 직접 수정 적용 (2단계 계측 레이어 즉시 저장 + 미수정 3단계 단방향 승계)
  const handleDirectWeighInEditSave = async (beforePlayer, patchFields) => {
    const targetKey = editTargetKey || getPlayerEntryKey(beforePlayer);
    if (!beforePlayer) return;

    try {
      setIsDirectSaving(true);
      const patchedPreview = buildPatchedLayerPlayer(beforePlayer, patchFields, {
        layer: "weighin",
      });
      const {
        _entryId,
        playerNumber,
        playerIndex,
        playerName,
        playerGym,
        playerTel,
        playerBirth,
        playerText,
        contestCategoryId,
        contestCategoryTitle,
        contestCategorySection,
        contestGradeId,
        contestGradeTitle,
        originalGradeId,
        originalGradeTitle,
        isGradeChanged,
        heightWeight,
        playerHeight,
        playerWeight,
        height,
        weight,
        playerNoShow,
        isWeighedIn,
      } = patchedPreview;

      await persistSinglePlayerWeighIn(
        targetKey,
        {
          _entryId,
          playerNumber,
          playerIndex,
          playerName,
          playerGym,
          playerTel,
          playerBirth,
          playerText,
          contestCategoryId,
          contestCategoryTitle,
          ...(contestCategorySection ? { contestCategorySection } : {}),
          contestGradeId,
          contestGradeTitle,
          originalGradeId,
          originalGradeTitle,
          isGradeChanged,
          heightWeight,
          playerHeight,
          playerWeight,
          height,
          weight,
          playerNoShow,
          ...(isWeighedIn !== undefined ? { isWeighedIn } : {}),
        },
        beforePlayer
      );

      setNumModalOpen(false);
      setEditTargetKey(null);
      setEditingPlayer(null);
    } finally {
      setIsDirectSaving(false);
    }
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

          {/* 2단계 선수 정보 직접 수정 드로어 */}
          <LayerPlayerEditDrawer
            open={numModalOpen}
            onClose={() => {
              if (!isDirectSaving) {
                setNumModalOpen(false);
                setEditTargetKey(null);
                setEditingPlayer(null);
              }
            }}
            layer="weighin"
            player={editingPlayer}
            categoriesArray={categorysArray}
            gradesArray={gradesArray}
            allLayerPlayers={playersArray}
            onSave={handleDirectWeighInEditSave}
            isSaving={isDirectSaving}
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
