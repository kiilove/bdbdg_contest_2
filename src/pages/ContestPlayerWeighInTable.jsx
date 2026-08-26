import { useContext, useEffect, useState, useMemo, useRef } from "react";
import LoadingPage from "./LoadingPage";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useNavigate } from "react-router-dom";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import {
  Button,
  Card,
  Tag,
  Checkbox,
  Space,
  Modal,
  InputNumber,
  Input,
  Tooltip,
  Popconfirm,
  message as antMessage,
} from "antd";
import {
  SaveOutlined,
  FileTextOutlined,
  CalendarOutlined,
  EditOutlined,
  NumberOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  FileImageOutlined,
  UserOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

/** 🔑 다종목 출전 선수를 완벽하게 구분하기 위한 고유 엔트리 키 생성 */
const getPlayerEntryKey = (p) => {
  if (!p) return "";
  const uid = p.playerUid || "";
  const catId = p.contestCategoryId || "";
  const gradeId = p.originalGradeId || p.contestGradeId || "";
  return `${uid}_${catId}_${gradeId}`;
};

/** 📏 신장 / 체중 파싱 유틸 함수 */
const parseHeightWeight = (str = "") => {
  if (!str) return { height: "", weight: "" };
  if (typeof str !== "string") str = String(str);
  if (str.includes("/")) {
    const parts = str.split("/");
    const h = (parts[0] || "").replace(/cm/gi, "").trim();
    const w = (parts[1] || "").replace(/kg/gi, "").trim();
    return { height: h, weight: w };
  }
  return { height: str.replace(/cm/gi, "").trim(), weight: "" };
};

/** 📏 신장 / 체중 포맷팅 유틸 함수 (저장용 문자열 생성) */
const formatHeightWeight = (height = "", weight = "") => {
  const h = (height || "").trim();
  const w = (weight || "").trim();
  if (!h && !w) return "";
  if (h && w) return `${h} / ${w}`;
  if (h) return `${h} /`;
  if (w) return `/ ${w}`;
  return "";
};

/** 📸 선수 사진 추출 유틸리티 (단일 URL, photos/gallery 배열 모두 정규화) */
export const extractPlayerPhotos = (p) => {
  if (!p) return [];
  const list = [
    ...(Array.isArray(p.photos) ? p.photos : []),
    ...(Array.isArray(p.playerPhotos) ? p.playerPhotos : []),
    ...(Array.isArray(p.gallery) ? p.gallery : []),
    ...(Array.isArray(p.images) ? p.images : []),
    p.profileImageUrl,
    p.photoUrl,
    p.playerPhoto,
    p.photo,
  ].filter((url) => typeof url === "string" && url.trim().length > 5);
  return Array.from(new Set(list));
};

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

  // 📸 선수 사진 확인 모달 상태
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoModalPlayer, setPhotoModalPlayer] = useState(null);

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

  const { currentContest } = useContext(CurrentContestContext);
  const navigate = useNavigate();

  const fetchCategoryDocument = useFirestoreGetDocument("contest_categorys_list");
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersAssignDocument = useFirestoreGetDocument("contest_players_assign");
  const fetchPlayersFinalDocument = useFirestoreGetDocument("contest_players_final");

  const updatePlayersFinal = useFirestoreUpdateData("contest_players_final");
  const updatePlayersAssign = useFirestoreUpdateData("contest_players_assign");

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
      if (currentContest?.contests?.contestCategorysListId) {
        const returnCategorys = await fetchCategoryDocument.getDocument(
          currentContest.contests.contestCategorysListId
        );

        setCategorysArray([
          ...returnCategorys?.categorys.sort(
            (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
          ),
        ]);

        const returnGrades = await fetchGradeDocument.getDocument(
          currentContest.contests.contestGradesListId
        );

        setGradesArray([...returnGrades?.grades]);
      }

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

      // 📸 9회 대회 다종목 선수 사진 playerUid 기반 글로벌 매핑 (선수가 1개 종목에만 사진을 올려도 모든 출전 체급에 100% 자동 매핑!)
      const uidPhotoMap = new Map();
      [...assignPlayers, ...finalPlayers].forEach((p) => {
        if (p?.playerUid) {
          const photos = extractPlayerPhotos(p);
          if (photos.length > 0) {
            const existing = uidPhotoMap.get(p.playerUid) || [];
            uidPhotoMap.set(p.playerUid, Array.from(new Set([...existing, ...photos])));
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
        const key = getPlayerEntryKey(p);
        const playerPhotos = (p.playerUid && uidPhotoMap.get(p.playerUid)) || extractPlayerPhotos(p);
        const primaryPhoto = playerPhotos[0] || p.profileImageUrl || p.photoUrl || p.playerPhoto || "";

        let baseObj = {
          ...p,
          profileImageUrl: primaryPhoto,
          photoUrl: primaryPhoto,
          playerPhoto: primaryPhoto,
          photos: playerPhotos,
        };

        if (finalMap.has(key)) {
          const fp = finalMap.get(key);
          const fpPhotos = extractPlayerPhotos(fp);
          const finalAllPhotos = Array.from(new Set([...playerPhotos, ...fpPhotos]));
          const finalPrimary = finalAllPhotos[0] || primaryPhoto;

          baseObj = {
            ...baseObj,
            ...fp,
            heightWeight: fp.heightWeight || p.heightWeight || "",
            playerNoShow: fp.playerNoShow !== undefined ? fp.playerNoShow : p.playerNoShow,
            isGradeChanged: fp.isGradeChanged !== undefined ? fp.isGradeChanged : p.isGradeChanged,
            isWeighedIn: fp.isWeighedIn !== undefined ? fp.isWeighedIn : p.isWeighedIn,
            contestGradeId: fp.contestGradeId || p.contestGradeId,
            contestGradeTitle: fp.contestGradeTitle || p.contestGradeTitle,
            playerNumber: fp.playerNumber || p.playerNumber,
            playerIndex: fp.playerIndex || p.playerIndex,
            profileImageUrl: finalPrimary,
            photoUrl: finalPrimary,
            playerPhoto: finalPrimary,
            photos: finalAllPhotos,
          };
        }
        return baseObj;
      });

      setPlayersArray(mergedLoadedPlayers);
    } catch (error) {
      console.error("계측 데이터 불러오기 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 📡 [다중 계측대 실시간 Live-Sync 리스너]
  // 계측대 1에서 저장 시, 계측대 2 및 모든 화면에서 자동으로 신장/체중/월체/불참이 실시간 자동 업데이트!
  useEffect(() => {
    const assignDocId = currentContest?.contests?.contestPlayersAssignId;
    if (!assignDocId) return;

    const unsub = onSnapshot(
      doc(db, "contest_players_assign", assignDocId),
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          const remotePlayers = remoteData?.players || [];

          if (remotePlayers.length > 0) {
            setPlayersAssign(remoteData);
            setPlayersArray((prevLocal) => {
              if (!prevLocal || prevLocal.length === 0) {
                return remotePlayers;
              }

              const remoteMap = new Map();
              remotePlayers.forEach((rp) => {
                const k = getPlayerEntryKey(rp);
                if (k) remoteMap.set(k, rp);
              });

              return prevLocal.map((localP) => {
                const k = getPlayerEntryKey(localP);
                if (remoteMap.has(k)) {
                  const rp = remoteMap.get(k);
                  // 현재 모달에서 직접 입력 중인 대상이 아니면 원격 최신 데이터로 즉시 실시간 동기화
                  if (k !== editTargetKey) {
                    return {
                      ...localP,
                      heightWeight: rp.heightWeight || "",
                      playerNoShow: !!rp.playerNoShow,
                      isGradeChanged: !!rp.isGradeChanged,
                      isWeighedIn: !!rp.isWeighedIn,
                      contestGradeId: rp.contestGradeId || localP.contestGradeId,
                      contestGradeTitle: rp.contestGradeTitle || localP.contestGradeTitle,
                      playerNumber: Number(rp.playerNumber) || localP.playerNumber,
                      playerIndex: Number(rp.playerIndex) || localP.playerIndex,
                    };
                  }
                }
                return localP;
              });
            });
          }
        }
      },
      (error) => {
        console.warn("실시간 계측 동기화 리스너 오류:", error);
      }
    );

    return () => unsub();
  }, [currentContest?.contests?.contestPlayersAssignId, editTargetKey]);

  const initEntryList = () => {
    const dummy = [];
    categorysArray
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .forEach((category) => {
        const matchedGrades = gradesArray.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );
        const matchedGradesLength = matchedGrades.length;
        matchedGrades
          .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
          .forEach((grade) => {
            const matchedPlayerWithPlayerNumber = [];
            const matchedPlayers = playersArray.filter(
              (entry) =>
                entry.contestCategoryId === category.contestCategoryId &&
                entry.contestGradeId === grade.contestGradeId
            );

            matchedPlayers.forEach((player) => {
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

  /** 🛡️ 다중 데스크 '스마트 병합(Smart Merge)' 저장 엔진 */
  const handleUpdatePlayersFinal = async (
    contestId,
    playerAssignId,
    playersFinalId,
    currentLocalPlayers
  ) => {
    setMessage({ body: "신장/체중 및 계측 데이터를 DB에 안전하게 병합 저장 중입니다...", isButton: false });
    setMsgOpen(true);

    try {
      // 1. 저장 직전 Firestore에서 최신 assign & final 문서를 실시간 fetch
      const [latestAssignDoc, latestFinalDoc] = await Promise.all([
        fetchPlayersAssignDocument.getDocument(playerAssignId),
        fetchPlayersFinalDocument.getDocument(playersFinalId),
      ]);

      const latestAssignPlayers = latestAssignDoc?.players || [];

      // 2. 현재 로컬에서 수정한 선수 목록을 복합키 맵으로 변환
      const localPlayersMap = new Map();
      currentLocalPlayers.forEach((p) => {
        const key = getPlayerEntryKey(p);
        if (key) localPlayersMap.set(key, p);
      });

      // 📸 playerUid 기반 사진 통합 맵 (다종목 출전 시 모든 체급에 동일 선수의 사진 100% 물림 보장)
      const saveUidPhotoMap = new Map();
      [...latestAssignPlayers, ...currentLocalPlayers].forEach((p) => {
        if (p?.playerUid) {
          const photos = extractPlayerPhotos(p);
          if (photos.length > 0) {
            const existing = saveUidPhotoMap.get(p.playerUid) || [];
            saveUidPhotoMap.set(p.playerUid, Array.from(new Set([...existing, ...photos])));
          }
        }
      });

      // 3. 최신 DB 선수 목록에 로컬 변경사항(신장/체중, 월체, 불참, 계측통과 등)을 복합키로 병합
      const mergedAssignPlayers = latestAssignPlayers.map((dbPlayer) => {
        const key = getPlayerEntryKey(dbPlayer);
        const pUidPhotos = (dbPlayer.playerUid && saveUidPhotoMap.get(dbPlayer.playerUid)) || extractPlayerPhotos(dbPlayer);
        const pUidPrimary = pUidPhotos[0] || dbPlayer.profileImageUrl || dbPlayer.photoUrl || dbPlayer.playerPhoto || "";

        if (localPlayersMap.has(key)) {
          const lp = localPlayersMap.get(key);
          const lpPhotos = extractPlayerPhotos(lp);
          const combinedPhotos = Array.from(new Set([...pUidPhotos, ...lpPhotos]));
          const combinedPrimary = combinedPhotos[0] || pUidPrimary;

          return {
            ...dbPlayer,
            heightWeight: lp.heightWeight || "",
            playerNoShow: !!lp.playerNoShow,
            isGradeChanged: !!lp.isGradeChanged,
            isWeighedIn: !!lp.isWeighedIn,
            contestGradeId: lp.contestGradeId || dbPlayer.contestGradeId,
            contestGradeTitle: lp.contestGradeTitle || dbPlayer.contestGradeTitle,
            playerNumber: Number(lp.playerNumber) || dbPlayer.playerNumber,
            playerIndex: Number(lp.playerIndex) || dbPlayer.playerIndex,
            profileImageUrl: combinedPrimary,
            photoUrl: combinedPrimary,
            playerPhoto: combinedPrimary,
            photos: combinedPhotos,
          };
        }
        return {
          ...dbPlayer,
          profileImageUrl: pUidPrimary,
          photoUrl: pUidPrimary,
          playerPhoto: pUidPrimary,
          photos: pUidPhotos,
        };
      });

      // 만약 로컬에 새로 추가된 엔트리가 있다면 추가
      localPlayersMap.forEach((localPlayer, key) => {
        if (!mergedAssignPlayers.some((p) => getPlayerEntryKey(p) === key)) {
          const pUidPhotos = (localPlayer.playerUid && saveUidPhotoMap.get(localPlayer.playerUid)) || extractPlayerPhotos(localPlayer);
          const pUidPrimary = pUidPhotos[0] || localPlayer.profileImageUrl || "";
          mergedAssignPlayers.push({
            ...localPlayer,
            profileImageUrl: pUidPrimary,
            photoUrl: pUidPrimary,
            playerPhoto: pUidPrimary,
            photos: pUidPhotos,
          });
        }
      });

      // 4. 최종 명단 (Final) 데이터 구성 (9회 대회부터 추가된 선수 사진 필드 profileImageUrl, photos 등 100% 온전히 보존!)
      const mergedFinalPlayers = mergedAssignPlayers.map((player) => {
        const pUidPhotos = (player.playerUid && saveUidPhotoMap.get(player.playerUid)) || extractPlayerPhotos(player);
        const pUidPrimary = pUidPhotos[0] || player.profileImageUrl || player.photoUrl || player.playerPhoto || "";

        return {
          ...player,
          contestCategoryId: player.contestCategoryId,
          contestGradeId: player.contestGradeId,
          contestId: player.contestId || contestId,
          playerNumber: Number(player.playerNumber) || 0,
          playerUid: player.playerUid,
          playerName: player.playerName,
          playerGym: player.playerGym || "",
          playerIndex: Number(player.playerIndex) || Number(player.playerNumber) || 0,
          playerNoShow: !!player.playerNoShow,
          playerText: player.playerText || "",
          isGradeChanged: !!player.isGradeChanged,
          isWeighedIn: !!player.isWeighedIn,
          heightWeight: player.heightWeight || "",
          // 📸 선수 사진 및 갤러리 필드 완벽 보존 (playerUid로 100% 결합)
          profileImageUrl: pUidPrimary,
          photoUrl: pUidPrimary,
          playerPhoto: pUidPrimary,
          photos: pUidPhotos,
        };
      });

      // 5. Firestore에 안전 병합된 전체 데이터 저장 (Assign & Final 동시 영구 저장)
      await updatePlayersAssign.updateData(playerAssignId, {
        ...(latestAssignDoc || playersAssign),
        players: mergedAssignPlayers,
      });

      await updatePlayersFinal.updateData(playersFinalId, {
        contestId,
        players: mergedFinalPlayers,
      });

      setPlayersArray([...mergedAssignPlayers]);
      setMessage({
        body: "계측 최종명단이 안전하게 저장되었습니다! (모든 출전 체급 완벽 보존)",
        isButton: true,
        confirmButtonText: "확인",
      });
    } catch (error) {
      console.error("계측 데이터 저장 오류:", error);
      setMessage({
        body: "저장 중 오류가 발생했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
        isButton: true,
        confirmButtonText: "닫기",
      });
    }
  };

  /** 🧹 assign & final 명단 완전 초기화(클리어) 핸들러 */
  const handleClearAssignAndFinal = async () => {
    const contestId = currentContest?.contests?.id;
    const assignId = currentContest?.contests?.contestPlayersAssignId;
    const finalId = currentContest?.contests?.contestPlayersFinalId;

    if (!contestId || !assignId) {
      antMessage.error("대회 정보 또는 배정 문서 ID를 확인할 수 없습니다.");
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
      setPlayersArray([]);
      setMatchedArray([]);

      setMessage({
        body: "현재 대회의 배정 명단(Assign) 및 최종 계측 명단(Final)이 완전히 초기화(클리어)되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("초기화 실패:", error);
      setMessage({
        body: "초기화 중 오류가 발생했습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  /** ✅ 계측 통과 완료 토글 (복합키 기준 업데이트) */
  const handleWeighedInToggle = (playerEntryKey, checked) => {
    const newPlayersArray = playersArray.map((p) => {
      if (getPlayerEntryKey(p) === playerEntryKey) {
        return { ...p, isWeighedIn: checked };
      }
      return p;
    });
    setPlayersArray(newPlayersArray);
  };

  /** 🚫 불참 처리 토글 (동일 선수의 해당 출전 체급 또는 전 종목 불참) */
  const handleNoShow = (playerNumber, playerEntryKey, e) => {
    const isChecked = e.target.checked;
    const newPlayersArray = playersArray.map((p) => {
      if (getPlayerEntryKey(p) === playerEntryKey) {
        return {
          ...p,
          playerNoShow: isChecked,
          isWeighedIn: isChecked ? false : p.isWeighedIn,
        };
      }
      return p;
    });
    setPlayersArray(newPlayersArray);
  };

  /** ⚖️ 월체 처리 (동일 종목 내 바로 다음 체급으로만 안전하게 승급) */
  const handleGradeChage = (
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

    if (isChecked) {
      const sameCategoryGrades = gradesArray
        .filter((g) => g.refCategoryId === currentCategoryId)
        .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex);

      const currentGradeIdxInCat = sameCategoryGrades.findIndex(
        (g) => g.contestGradeId === currentGradeId
      );

      if (
        currentGradeIdxInCat !== -1 &&
        currentGradeIdxInCat < sameCategoryGrades.length - 1
      ) {
        const nextGrade = sameCategoryGrades[currentGradeIdxInCat + 1];

        const newPlayerInfo = {
          ...currentPlayerInfo,
          contestGradeId: nextGrade.contestGradeId,
          contestGradeTitle: nextGrade.contestGradeTitle,
          isGradeChanged: true,
          playerIndex: currentPlayerInfo.playerIndex + 1000,
        };
        newPlayers.splice(playerFindIndex, 1, newPlayerInfo);
      } else {
        alert(
          `해당 종목의 최고 체급입니다. 더 이상 상위 체급이 없어 월체가 불가능합니다.`
        );
        return;
      }
    } else {
      const newPlayerInfo = {
        ...currentPlayerInfo,
        contestGradeId: currentPlayerInfo.originalGradeId || currentGradeId,
        contestGradeTitle:
          currentPlayerInfo.originalGradeTitle || currentGradeTitle,
        isGradeChanged: false,
        playerIndex:
          currentPlayerInfo.playerIndex >= 1000
            ? currentPlayerInfo.playerIndex - 1000
            : currentPlayerInfo.playerIndex,
      };
      newPlayers.splice(playerFindIndex, 1, newPlayerInfo);
    }

    setPlayersArray(newPlayers);
  };

  /** 📏 신장(height) 개별 수정 */
  const handleHeightChange = (playerEntryKey, newHeight) => {
    const newPlayersArray = playersArray.map((p) => {
      if (getPlayerEntryKey(p) === playerEntryKey) {
        const { weight } = parseHeightWeight(p.heightWeight);
        const combined = formatHeightWeight(newHeight, weight);
        return { ...p, heightWeight: combined };
      }
      return p;
    });
    setPlayersArray(newPlayersArray);
  };

  /** 📏 체중(weight) 개별 수정 */
  const handleWeightChange = (playerEntryKey, newWeight) => {
    const newPlayersArray = playersArray.map((p) => {
      if (getPlayerEntryKey(p) === playerEntryKey) {
        const { height } = parseHeightWeight(p.heightWeight);
        const combined = formatHeightWeight(height, newWeight);
        return { ...p, heightWeight: combined };
      }
      return p;
    });
    setPlayersArray(newPlayersArray);
  };

  // ✅ 번호/인덱스/신장체중 수정 모달 열기
  const openNumberModal = (player) => {
    const key = getPlayerEntryKey(player);
    const { height, weight } = parseHeightWeight(player.heightWeight);
    setEditTargetKey(key);
    setEditValues({
      playerNumber: Number(player.playerNumber) || 0,
      playerIndex:
        Number(player.playerIndex) || Number(player.playerNumber) || 0,
      playerName: player.playerName || "",
      height: height || "",
      weight: weight || "",
    });
    setNumModalOpen(true);
  };

  // ✅ 번호/인덱스/신장체중 수정 적용
  const applyNumberChange = () => {
    const { playerNumber, playerIndex, height, weight } = editValues;
    if (playerNumber <= 0 || playerIndex <= 0) return;

    const combinedHW = formatHeightWeight(height, weight);
    const newPlayers = [...playersArray];
    const idx = newPlayers.findIndex((p) => getPlayerEntryKey(p) === editTargetKey);
    if (idx !== -1) {
      newPlayers[idx] = {
        ...newPlayers[idx],
        playerNumber: Number(playerNumber),
        playerIndex: Number(playerIndex),
        heightWeight: combinedHW,
      };
      setPlayersArray(newPlayers);
    }
    setNumModalOpen(false);
    setEditTargetKey(null);
  };

  useEffect(() => {
    if (currentContest?.contests) {
      fetchPool();
    }
  }, [currentContest]);

  useEffect(() => {
    if (categorysArray.length > 0) {
      initEntryList();
    }
  }, [categorysArray, gradesArray, playersArray]);

  // 통계 계산
  const totalPlayersCount = playersArray.length;
  const weighedInCount = playersArray.filter((p) => p.isWeighedIn && !p.playerNoShow).length;
  const noShowCount = playersArray.filter((p) => p.playerNoShow).length;
  const gradeChangedCount = playersArray.filter((p) => p.isGradeChanged).length;
  const progressPercent =
    totalPlayersCount > 0
      ? Math.round((weighedInCount / totalPlayersCount) * 100)
      : 0;

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

        if (filterWeighedStatus === "weighed") {
          players = players.filter((p) => p.isWeighedIn && !p.playerNoShow);
        } else if (filterWeighedStatus === "unweighed") {
          players = players.filter((p) => !p.isWeighedIn && !p.playerNoShow);
        } else if (filterWeighedStatus === "noshow") {
          players = players.filter((p) => p.playerNoShow);
        }

        return {
          ...catGrade,
          matchedPlayers: players,
        };
      })
      .filter((catGrade) => catGrade.matchedPlayers.length > 0);
  }, [matchedArray, selectedSection, searchKeyword, filterWeighedStatus]);

  return (
    <div className="flex flex-col w-full h-full bg-slate-100 min-h-screen p-3 sm:p-5 gap-y-4">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <>
          <ConfirmationModal
            isOpen={msgOpen}
            onConfirm={() => setMsgOpen(false)}
            onCancel={() => setMsgOpen(false)}
            message={message}
          />

          {/* 선수 번호/인덱스/신장체중 수정 모달 */}
          <Modal
            open={numModalOpen}
            title={
              <div className="flex items-center gap-2">
                <EditOutlined className="text-blue-500" />
                <span className="font-bold">선수 번호 / 인덱스 / 신장·체중 수정</span>
              </div>
            }
            onOk={applyNumberChange}
            onCancel={() => {
              setNumModalOpen(false);
              setEditTargetKey(null);
            }}
            okText="적용"
            cancelText="취소"
            destroyOnClose
          >
            <div className="flex flex-col gap-4 py-2">
              <div className="text-sm text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                선수 성명: <strong className="text-blue-600 text-base">{editValues.playerName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">배부 번호표 (playerNumber)</span>
                <InputNumber
                  min={1}
                  value={editValues.playerNumber}
                  onChange={(v) =>
                    setEditValues((prev) => ({ ...prev, playerNumber: v }))
                  }
                  className="w-40"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">표시순서 Index (playerIndex)</span>
                <InputNumber
                  min={1}
                  value={editValues.playerIndex}
                  onChange={(v) =>
                    setEditValues((prev) => ({ ...prev, playerIndex: v }))
                  }
                  className="w-40"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">신장 / 체중 (cm / kg)</span>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex items-center">
                    <Input
                      value={editValues.height}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, height: e.target.value }))
                      }
                      placeholder="신장"
                      className="w-24 text-xs font-bold pr-6 text-center"
                    />
                    <span className="absolute right-1 text-[10px] text-slate-400 font-bold pointer-events-none">
                      cm
                    </span>
                  </div>
                  <span className="text-slate-400 font-bold">/</span>
                  <div className="relative flex items-center">
                    <Input
                      value={editValues.weight}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, weight: e.target.value }))
                      }
                      placeholder="체중"
                      className="w-24 text-xs font-bold pr-6 text-center"
                    />
                    <span className="absolute right-1 text-[10px] text-slate-400 font-bold pointer-events-none">
                      kg
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Modal>

          {/* 📸 9회 대회 선수 사진 확인(뷰어) 모달 */}
          <Modal
            open={photoModalOpen}
            title={
              <div className="flex items-center gap-2">
                <FileImageOutlined className="text-amber-500 text-lg" />
                <span className="font-black text-slate-800">
                  선수 등록 사진 확인 ({photoModalPlayer?.playerName})
                </span>
              </div>
            }
            onCancel={() => {
              setPhotoModalOpen(false);
              setPhotoModalPlayer(null);
            }}
            footer={null}
            centered
            width={520}
            destroyOnClose
          >
            {photoModalPlayer && (() => {
              const photos = extractPlayerPhotos(photoModalPlayer);
              return (
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 font-bold">배부번호:</span>{" "}
                      <strong className="text-amber-600 font-black">
                        #{photoModalPlayer.playerNumber || "미배부"}
                      </strong>
                      <span className="mx-2 text-slate-300">|</span>
                      <span className="text-slate-500 font-bold">소속:</span>{" "}
                      <strong className="text-slate-700">
                        {photoModalPlayer.playerGym || "개인 / 무소속"}
                      </strong>
                    </div>
                    <Tag color={photos.length > 0 ? "gold" : "default"} className="font-bold mr-0">
                      {photos.length > 0 ? `사진 ${photos.length}장` : "사진 미등록"}
                    </Tag>
                  </div>

                  {photos.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <div className="text-4xl text-slate-300 mb-2">📷</div>
                      <h3 className="text-sm font-bold text-slate-600 m-0">등록된 선수 사진이 없습니다.</h3>
                      <p className="text-xs text-slate-400 mt-1 m-0">
                        선수 프로필 사진은 <strong>ybbf 접수 시스템</strong>에서 업로드하거나 관리할 수 있습니다.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-full max-h-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-black flex items-center justify-center shadow-md">
                        <img
                          src={photos[0]}
                          alt={photoModalPlayer.playerName}
                          className="max-h-[380px] w-full object-contain"
                        />
                      </div>
                      {photos.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {photos.map((imgUrl, i) => (
                            <img
                              key={i}
                              src={imgUrl}
                              alt={`사진 ${i + 1}`}
                              className="w-16 h-16 rounded-lg object-cover border-2 border-amber-400 cursor-pointer shadow-sm hover:scale-105 transition-all"
                              onClick={() => {
                                // 첫 번째 사진으로 교체
                                const reordered = [imgUrl, ...photos.filter((_, idx) => idx !== i)];
                                setPhotoModalPlayer((prev) => ({ ...prev, photos: reordered }));
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-center pt-2">
                    <Button
                      type="primary"
                      onClick={() => {
                        setPhotoModalOpen(false);
                        setPhotoModalPlayer(null);
                      }}
                      className="rounded-xl px-6 font-bold bg-slate-900 hover:bg-slate-800"
                    >
                      닫기
                    </Button>
                  </div>
                </div>
              );
            })()}
          </Modal>

          {/* 1. 상단 타이틀 & 실시간 계측 현황 관제 카드 */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white">
                  2단계 계측 현장 데스크
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>다중 데스크 실시간 자동 동기화 ON</span>
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {currentContest?.contests?.contestTitle}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white m-0 tracking-tight flex items-center gap-2">
                <span>선수 계측 & 월체/불참 관리</span>
              </h1>
              <p className="text-xs text-slate-400 m-0">
                신장(cm) / 체중(kg) 2개 필드 분리 입력 및 스마트 병합 저장 지원
              </p>
            </div>

            {/* 계측 통계 & 최종 저장 버튼 */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-800/90 p-3.5 rounded-xl border border-slate-700">
              <div className="min-w-[190px]">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
                  <span>현장 계측 진행률</span>
                  <span className="text-emerald-400 font-black">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 gap-2">
                  <span>통과: <strong className="text-emerald-400">{weighedInCount}</strong>명</span>
                  <span>불참: <strong className="text-rose-400">{noShowCount}</strong>명</span>
                  <span>총: {totalPlayersCount}명</span>
                </div>
              </div>

              <div className="w-px h-8 bg-slate-700 hidden sm:block" />

              {/* 저장 및 클리어 버튼 그룹 */}
              <div className="flex items-center gap-2">
                <Popconfirm
                  title="계측 및 최종 명단 완전 초기화"
                  description="현재 대회의 contest_players_assign 및 contest_players_final 명단을 모두 빈 상태로 클리어합니다. 정말 진행하시겠습니까?"
                  onConfirm={handleClearAssignAndFinal}
                  okText="완전 초기화 실행"
                  cancelText="취소"
                  okButtonProps={{ danger: true }}
                >
                  <button
                    type="button"
                    title="배정 및 계측 명단 완전 비우기"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-rose-100 font-bold text-xs border border-rose-700/60 shadow-sm transition-all cursor-pointer"
                  >
                    <DeleteOutlined />
                    <span>명단 비우기</span>
                  </button>
                </Popconfirm>

                {playersArray?.length > 0 ? (
                  <button
                    onClick={() =>
                      handleUpdatePlayersFinal(
                        currentContest.contests.id,
                        currentContest.contests.contestPlayersAssignId,
                        currentContest.contests.contestPlayersFinalId,
                        playersArray
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-md hover:shadow-lg transition-all cursor-pointer border-0 active:scale-95"
                  >
                    <SaveOutlined className="text-lg" />
                    <span>계측 최종명단 안전 저장</span>
                  </button>
                ) : (
                  <Button
                    type="default"
                    onClick={() => navigate("/contesttimetable", { state: { tabId: 1 } })}
                    className="font-bold"
                  >
                    선수번호 배정 필요
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* 2. 초고속 검색 & 부문 필터 & 상태 필터 바 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* 검색창 */}
            <div className="w-full md:w-84">
              <Input
                placeholder="선수명, 배부번호, 소속, 전화번호 뒤4자리 검색..."
                prefix={<SearchOutlined className="text-blue-500" />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                allowClear
                size="large"
                className="rounded-xl border-slate-300 font-medium text-sm"
              />
            </div>

            {/* 부문 및 상태 필터 */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {sectionOptions.map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setSelectedSection(sec)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-0 cursor-pointer ${
                      selectedSection === sec
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-transparent text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {sec === "all" ? "전체 부문" : sec}
                  </button>
                ))}
              </div>

              {/* 계측상태 필터 */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setFilterWeighedStatus("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border-0 cursor-pointer ${
                    filterWeighedStatus === "all"
                      ? "bg-slate-800 text-white"
                      : "bg-transparent text-slate-600"
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => setFilterWeighedStatus("unweighed")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border-0 cursor-pointer ${
                    filterWeighedStatus === "unweighed"
                      ? "bg-amber-600 text-white"
                      : "bg-transparent text-amber-700"
                  }`}
                >
                  미계측
                </button>
                <button
                  onClick={() => setFilterWeighedStatus("weighed")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border-0 cursor-pointer ${
                    filterWeighedStatus === "weighed"
                      ? "bg-emerald-600 text-white"
                      : "bg-transparent text-emerald-700"
                  }`}
                >
                  계측완료
                </button>
                <button
                  onClick={() => setFilterWeighedStatus("noshow")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border-0 cursor-pointer ${
                    filterWeighedStatus === "noshow"
                      ? "bg-rose-600 text-white"
                      : "bg-transparent text-rose-700"
                  }`}
                >
                  🚨 불참({noShowCount})
                </button>
              </div>

              <button
                onClick={fetchPool}
                title="최신 DB 동기화"
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 cursor-pointer flex items-center gap-1"
              >
                <SyncOutlined />
                <span>새로고침</span>
              </button>
            </div>
          </div>

          {/* 3. 종목 및 체급별 선수 계측 테이블 목록 */}
          <div className="space-y-4">
            {filteredMatchedArray.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <p className="text-slate-400 font-bold text-base m-0">
                  검색 조건에 일치하는 선수가 없습니다.
                </p>
              </div>
            ) : (
              filteredMatchedArray.map((matched, mIdx) => {
                const {
                  contestCategoryId: categoryId,
                  contestCategoryTitle: categoryTitle,
                  contestGradeId: gradeId,
                  contestGradeTitle: gradeTitle,
                  matchedPlayers,
                  matchedGradesLength: gradeLength,
                  contestGradeIndex: gradeIndex,
                } = matched;

                const gradeWeighedCount = matchedPlayers.filter((p) => p.isWeighedIn && !p.playerNoShow).length;
                const gradeNoShowCount = matchedPlayers.filter((p) => p.playerNoShow).length;
                const isGradeAllWeighed =
                  matchedPlayers.length > 0 &&
                  gradeWeighedCount + gradeNoShowCount === matchedPlayers.length;

                return (
                  <div
                    key={mIdx}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                  >
                    {/* 체급 헤더 */}
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        <h2 className="text-base font-black text-slate-900 m-0">
                          {categoryTitle}
                          <span className="text-indigo-600 ml-2 font-black">
                            / {gradeTitle}
                          </span>
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag
                          color={isGradeAllWeighed ? "green" : "blue"}
                          className="font-bold text-xs px-2.5 py-0.5 rounded-md mr-0"
                        >
                          계측 {gradeWeighedCount} / {matchedPlayers.length}명
                          {gradeNoShowCount > 0 && ` (불참 ${gradeNoShowCount}명)`}
                        </Tag>
                      </div>
                    </div>

                    {/* 데스크탑 테이블 */}
                    {!isMobile ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                              <th className="py-3 px-3 w-16 text-center">순번</th>
                              <th className="py-3 px-2 w-16 text-center">사진</th>
                              <th className="py-3 px-3 w-28 text-center">선수번호</th>
                              <th className="py-3 px-3 w-40">선수 성명 / 상태</th>
                              <th className="py-3 px-3 w-36">소속</th>
                              <th className="py-3 px-3 w-60">신장(cm) / 체중(kg)</th>
                              <th className="py-3 px-3 w-24 text-center">계측 통과</th>
                              <th className="py-3 px-3 w-20 text-center">월체</th>
                              <th className="py-3 px-3 w-24 text-center">불참 (NoShow)</th>
                              <th className="py-3 px-3 w-24 text-center">관리</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {matchedPlayers
                              .sort((a, b) => a.playerIndex - b.playerIndex)
                              .map((player, pIdx) => {
                                const {
                                  playerName,
                                  playerGym,
                                  playerUid,
                                  playerNumber,
                                  playerNoShow,
                                  isGradeChanged,
                                  isWeighedIn,
                                  heightWeight,
                                  playerIndex,
                                } = player;

                                const entryKey = getPlayerEntryKey(player);
                                const { height, weight } = parseHeightWeight(heightWeight);
                                const playerPhotos = extractPlayerPhotos(player);

                                return (
                                  <tr
                                    key={entryKey || playerUid}
                                    className={`transition-colors ${
                                      playerNoShow
                                        ? "bg-rose-100/80 border-l-4 border-l-rose-600"
                                        : isWeighedIn
                                        ? "bg-emerald-50/40 hover:bg-emerald-50/70"
                                        : "hover:bg-slate-50"
                                    }`}
                                  >
                                    <td className="py-3 px-3 text-center font-bold text-slate-400">
                                      {pIdx + 1}
                                    </td>

                                    {/* 📸 선수 사진 썸네일 & 뷰어 버튼 */}
                                    <td className="py-2 px-2 text-center">
                                      {playerPhotos.length > 0 ? (
                                        <Tooltip title="클릭하여 등록 사진 확인">
                                          <div
                                            onClick={() => {
                                              setPhotoModalPlayer(player);
                                              setPhotoModalOpen(true);
                                            }}
                                            className="relative inline-block cursor-pointer group"
                                          >
                                            <img
                                              src={playerPhotos[0]}
                                              alt={playerName}
                                              className="w-9 h-9 rounded-full object-cover border-2 border-amber-400 shadow-md group-hover:scale-110 group-hover:border-amber-300 transition-all mx-auto"
                                            />
                                            {playerPhotos.length > 1 && (
                                              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-[9px] text-slate-950 font-black px-1 rounded-full border border-white">
                                                +{playerPhotos.length - 1}
                                              </span>
                                            )}
                                          </div>
                                        </Tooltip>
                                      ) : (
                                        <Tooltip title="사진 미등록 (클릭하여 확인)">
                                          <button
                                            onClick={() => {
                                              setPhotoModalPlayer(player);
                                              setPhotoModalOpen(true);
                                            }}
                                            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-400 hover:text-slate-600 text-xs flex items-center justify-center cursor-pointer transition-all mx-auto"
                                          >
                                            <UserOutlined />
                                          </button>
                                        </Tooltip>
                                      )}
                                    </td>

                                    {/* 선수번호 뱃지 */}
                                    <td className="py-3 px-3 text-center">
                                      <span
                                        className={`inline-flex items-center px-3 py-1 rounded-lg font-black text-sm shadow-sm ${
                                          playerNoShow
                                            ? "bg-rose-800 text-rose-200 line-through opacity-80"
                                            : "bg-slate-900 text-amber-400"
                                        }`}
                                      >
                                        {playerNumber}
                                      </span>
                                    </td>

                                    {/* 선수 성명 & 불참/월체 뱃지 */}
                                    <td className="py-3 px-3">
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className={`font-black text-sm ${
                                              playerNoShow
                                                ? "text-rose-700 line-through font-extrabold"
                                                : "text-slate-900"
                                            }`}
                                          >
                                            {playerName}
                                          </span>
                                          {isGradeChanged && !playerNoShow && (
                                            <Tag color="orange" className="text-[10px] px-1 py-0 mr-0 font-bold">
                                              월체
                                            </Tag>
                                          )}
                                        </div>

                                        {/* 🚨 불참 시 눈에 띄는 확실한 경고 뱃지 */}
                                        {playerNoShow && (
                                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[11px] w-fit shadow-sm animate-pulse">
                                            <WarningOutlined />
                                            <span>불참 확정 (No-Show)</span>
                                          </div>
                                        )}
                                      </div>
                                    </td>

                                    <td className={`py-3 px-3 font-medium ${playerNoShow ? "text-rose-400 line-through" : "text-slate-600"}`}>
                                      {playerGym || "무소속 / 개인"}
                                    </td>

                                    {/* 📏 2개 분리 필드: 신장(cm) / 체중(kg) */}
                                    <td className="py-3 px-3">
                                      <div className="flex items-center gap-1.5">
                                        {/* 신장 입력 */}
                                        <div className="relative flex items-center">
                                          <Input
                                            size="middle"
                                            value={height}
                                            disabled={playerNoShow}
                                            placeholder="신장"
                                            onChange={(e) =>
                                              handleHeightChange(entryKey, e.target.value)
                                            }
                                            className={`w-24 text-xs font-black pr-6 text-center rounded-lg border ${
                                              playerNoShow
                                                ? "bg-slate-100 text-slate-400"
                                                : "border-slate-300 focus:border-blue-500 bg-white text-blue-900 shadow-sm"
                                            }`}
                                          />
                                          <span className="absolute right-1.5 text-[10px] text-slate-400 font-bold pointer-events-none">
                                            cm
                                          </span>
                                        </div>

                                        <span className="text-slate-400 font-black text-sm">/</span>

                                        {/* 체중 입력 */}
                                        <div className="relative flex items-center">
                                          <Input
                                            size="middle"
                                            value={weight}
                                            disabled={playerNoShow}
                                            placeholder="체중"
                                            onChange={(e) =>
                                              handleWeightChange(entryKey, e.target.value)
                                            }
                                            className={`w-24 text-xs font-black pr-6 text-center rounded-lg border ${
                                              playerNoShow
                                                ? "bg-slate-100 text-slate-400"
                                                : "border-slate-300 focus:border-blue-500 bg-white text-blue-900 shadow-sm"
                                            }`}
                                          />
                                          <span className="absolute right-1.5 text-[10px] text-slate-400 font-bold pointer-events-none">
                                            kg
                                          </span>
                                        </div>
                                      </div>
                                    </td>

                                    {/* 계측 통과 체크 */}
                                    <td className="py-3 px-3 text-center">
                                      <Checkbox
                                        checked={isWeighedIn}
                                        disabled={playerNoShow}
                                        onChange={(e) =>
                                          handleWeighedInToggle(entryKey, e.target.checked)
                                        }
                                        className="scale-125"
                                      />
                                      {isWeighedIn && !playerNoShow && (
                                        <div className="text-[10px] text-emerald-600 font-extrabold mt-0.5">
                                          통과 ✓
                                        </div>
                                      )}
                                    </td>

                                    {/* 월체 체크 */}
                                    <td className="py-3 px-3 text-center">
                                      <Checkbox
                                        checked={isGradeChanged}
                                        disabled={playerNoShow}
                                        onChange={(e) =>
                                          handleGradeChage(
                                            e,
                                            categoryId,
                                            gradeId,
                                            gradeTitle,
                                            entryKey
                                          )
                                        }
                                      />
                                    </td>

                                    {/* 🚨 불참 체크박스 */}
                                    <td className="py-3 px-3 text-center">
                                      <Checkbox
                                        checked={playerNoShow}
                                        onChange={(e) => handleNoShow(playerNumber, entryKey, e)}
                                        className={`scale-125 ${playerNoShow ? "accent-red-600" : ""}`}
                                      />
                                      {playerNoShow && (
                                        <div className="text-[10px] text-rose-600 font-black mt-0.5">
                                          불참
                                        </div>
                                      )}
                                    </td>

                                    <td className="py-3 px-3 text-center">
                                      <Button
                                        size="small"
                                        icon={<EditOutlined />}
                                        onClick={() => openNumberModal(player)}
                                        className="text-xs font-semibold rounded-lg"
                                      >
                                        수정
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* 모바일 카드 뷰 */
                      <div className="p-3 space-y-2">
                        {matchedPlayers
                          .sort((a, b) => a.playerIndex - b.playerIndex)
                          .map((player, pIdx) => {
                            const {
                              playerName,
                              playerGym,
                              playerUid,
                              playerNumber,
                              playerNoShow,
                              isGradeChanged,
                              isWeighedIn,
                              heightWeight,
                            } = player;

                            const entryKey = getPlayerEntryKey(player);
                            const { height, weight } = parseHeightWeight(heightWeight);

                            return (
                              <div
                                key={entryKey || playerUid}
                                className={`p-3 rounded-xl border ${
                                  playerNoShow
                                    ? "bg-rose-100/90 border-rose-400"
                                    : isWeighedIn
                                    ? "bg-emerald-50/40 border-emerald-300"
                                    : "bg-white border-slate-200"
                                } space-y-2.5`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {/* 📸 모바일 사진 썸네일 */}
                                    {(() => {
                                      const mPhotos = extractPlayerPhotos(player);
                                      if (mPhotos.length > 0) {
                                        return (
                                          <img
                                            src={mPhotos[0]}
                                            alt={playerName}
                                            onClick={() => {
                                              setPhotoModalPlayer(player);
                                              setPhotoModalOpen(true);
                                            }}
                                            className="w-8 h-8 rounded-full object-cover border-2 border-amber-400 shadow-sm shrink-0 cursor-pointer"
                                          />
                                        );
                                      }
                                      return (
                                        <button
                                          onClick={() => {
                                            setPhotoModalPlayer(player);
                                            setPhotoModalOpen(true);
                                          }}
                                          className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 text-slate-400 text-xs flex items-center justify-center shrink-0"
                                        >
                                          <UserOutlined />
                                        </button>
                                      );
                                    })()}
                                    <span
                                      className={`px-2 py-0.5 rounded font-black text-sm ${
                                        playerNoShow
                                          ? "bg-rose-800 text-rose-200 line-through"
                                          : "bg-slate-900 text-amber-400"
                                      }`}
                                    >
                                      {playerNumber}번
                                    </span>
                                    <span
                                      className={`font-black text-sm ${
                                        playerNoShow ? "line-through text-rose-700 font-bold" : "text-slate-900"
                                      }`}
                                    >
                                      {playerName}
                                    </span>
                                    {isGradeChanged && !playerNoShow && <Tag color="orange">월체</Tag>}
                                  </div>
                                  <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => openNumberModal(player)}
                                  />
                                </div>

                                {playerNoShow && (
                                  <div className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-xs w-fit">
                                    🚨 불참 확정 (No-Show)
                                  </div>
                                )}

                                <div className="text-xs text-slate-500 font-medium">
                                  소속: {playerGym || "개인"}
                                </div>

                                {/* 신장/체중 2개 분리 입력 */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-600">측정:</span>
                                  <div className="relative flex items-center">
                                    <Input
                                      size="small"
                                      value={height}
                                      disabled={playerNoShow}
                                      placeholder="신장"
                                      onChange={(e) =>
                                        handleHeightChange(entryKey, e.target.value)
                                      }
                                      className="w-20 text-xs font-bold text-center pr-5 rounded-lg"
                                    />
                                    <span className="absolute right-1 text-[10px] text-slate-400 font-bold pointer-events-none">
                                      cm
                                    </span>
                                  </div>
                                  <span className="text-slate-400 font-bold">/</span>
                                  <div className="relative flex items-center">
                                    <Input
                                      size="small"
                                      value={weight}
                                      disabled={playerNoShow}
                                      placeholder="체중"
                                      onChange={(e) =>
                                        handleWeightChange(entryKey, e.target.value)
                                      }
                                      className="w-20 text-xs font-bold text-center pr-5 rounded-lg"
                                    />
                                    <span className="absolute right-1 text-[10px] text-slate-400 font-bold pointer-events-none">
                                      kg
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                  <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 cursor-pointer">
                                    <Checkbox
                                      checked={isWeighedIn}
                                      disabled={playerNoShow}
                                      onChange={(e) =>
                                        handleWeighedInToggle(entryKey, e.target.checked)
                                      }
                                    />
                                    <span>계측통과</span>
                                  </label>

                                  <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
                                    <Checkbox
                                      checked={isGradeChanged}
                                      disabled={playerNoShow}
                                      onChange={(e) =>
                                        handleGradeChage(
                                          e,
                                          categoryId,
                                          gradeId,
                                          gradeTitle,
                                          entryKey
                                        )
                                      }
                                    />
                                    <span>월체</span>
                                  </label>

                                  <label className="flex items-center gap-1 text-xs text-rose-700 font-black cursor-pointer">
                                    <Checkbox
                                      checked={playerNoShow}
                                      onChange={(e) => handleNoShow(playerNumber, entryKey, e)}
                                    />
                                    <span>🚨 불참</span>
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ContestPlayerWeighInTable;
