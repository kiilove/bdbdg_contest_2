import { useContext, useEffect, useState, useMemo } from "react";
import LoadingPage from "./LoadingPage";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
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

/** 🛡️ Firestore updateDoc 직전 undefined 제거 및 안전한 JSON 직렬화 정제 */
const sanitizeDataForFirestore = (data) => {
  if (data === undefined) return null;
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (value === undefined) {
        return null;
      }
      return value;
    })
  );
};

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

/** 🚫 대회 포스터, 배너, 로고, 수료증, 첨부문서 등 시스템/대회/비이미지 키 필터링 */
export const isNonPlayerKey = (key) => {
  if (!key || typeof key !== "string") return false;
  const lower = key.toLowerCase();
  return (
    lower.includes("poster") ||
    lower.includes("banner") ||
    lower.includes("logo") ||
    lower.includes("notice") ||
    lower.includes("certificate") ||
    lower.includes("trophy") ||
    lower.includes("sponsor") ||
    lower.includes("filelink") ||
    lower.includes("contestcollection") ||
    lower === "contest" ||
    lower === "contestinfo" ||
    lower === "contests" ||
    lower === "contestcategoryslist" ||
    lower === "contestgradeslist" ||
    lower === "backgroundvideourl"
  );
};

/** 🚫 대회 포스터/배너/로고/문서파일(.hwp, .pdf 등) 및 거대 Base64 비선수 URL 필터링 */
export const isNonPlayerUrl = (url) => {
  if (!url || typeof url !== "string") return true;
  // ⚠️ 선수 사진은 R2/Firebase Storage의 유효한 HTTP/HTTPS URL이어야 합니다.
  // 수십~수백 KB의 Base64 인라인 사진 문자열은 Firestore 단일 문서 1MB 한도 초과를 유발하므로 선수 사진 배열에서 배제합니다.
  if (url.startsWith("data:") || url.includes(";base64,") || url.length > 2000) {
    return true;
  }
  const lower = url.toLowerCase();
  if (
    lower.includes("poster") ||
    lower.includes("banner") ||
    lower.includes("logo") ||
    lower.includes("certificate") ||
    lower.includes("contest_notice") ||
    lower.includes("contest_posters") ||
    lower.includes("contest_banners") ||
    lower.includes("sponsor") ||
    lower.includes(".hwp") ||
    lower.includes(".pdf") ||
    lower.includes(".doc") ||
    lower.includes(".zip") ||
    lower.includes("%eb%aa%a8%ec%a7%91%ec%9a%94%ea%b0%95")
  ) {
    return true;
  }
  return false;
};

/** 🔗 문자열, 객체, JSON 문자열, 파일 객체 배열에서 유효한 선수 사진 URL만 재귀 추출 (포스터/배너/문서/Base64 철저히 배제) */
export const extractUrlFromStringOrObject = (item) => {
  if (!item) return [];

  // 1. 문자열인 경우
  if (typeof item === "string") {
    const trimmed = item.trim();
    // Base64 문자열 즉시 배제
    if (trimmed.startsWith("data:") || trimmed.includes(";base64,") || trimmed.length > 2000) {
      return [];
    }

    // 1-1. JSON 배열 또는 JSON 객체 문자열인 경우 (e.g. playerPhotoUrlsJson)
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractUrlFromStringOrObject(parsed);
      } catch (e) {}
    }

    // 1-2. 쉼표(,)로 구분된 다중 URL 문자열인 경우
    if (trimmed.includes(",") && (trimmed.includes("http") || trimmed.includes("worker") || trimmed.includes("firebasestorage"))) {
      return trimmed.split(",").flatMap(extractUrlFromStringOrObject);
    }

    // 1-3. 단일 유효 이미지/스토리지 URL (포스터/배너/문서/Base64 제외)
    if (
      trimmed.length > 5 &&
      trimmed.length < 2000 &&
      !isNonPlayerUrl(trimmed) &&
      (trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("blob:"))
    ) {
      return [trimmed];
    }
    return [];
  }

  // 2. 배열인 경우
  if (Array.isArray(item)) {
    return item.flatMap(extractUrlFromStringOrObject);
  }

  // 3. 객체인 경우
  if (typeof item === "object" && item !== null) {
    const urls = [];

    // 선수 사진용 프로퍼티명 우선 추출
    const playerPhotoProps = [
      "url",
      "compressedUrl",
      "originalUrl",
      "downloadURL",
      "downloadUrl",
      "photoUrl",
      "playerPhotoUrl",
      "playerPhotoUrlsJson",
      "playerPhotoUrls",
      "photoUrlsJson",
      "photoUrls",
      "photosJson",
      "playerPhoto",
      "profileImageUrl",
      "stagePhotoUrl",
      "imageUrl",
      "pictureUrl",
      "fileUrl",
      "src",
      "thumbUrl",
      "preview",
    ];

    playerPhotoProps.forEach((prop) => {
      if (item[prop] && !isNonPlayerKey(prop)) {
        urls.push(...extractUrlFromStringOrObject(item[prop]));
      }
    });

    // Ant Design Upload response 객체
    if (item.response) {
      urls.push(...extractUrlFromStringOrObject(item.response));
    }

    // 객체 내의 모든 키를 순회하되 포스터/대회메타/배너/클라이언트 키는 엄격 제외
    Object.entries(item).forEach(([k, v]) => {
      if (!playerPhotoProps.includes(k) && !isNonPlayerKey(k) && k !== "clientInfo") {
        if (Array.isArray(v) || (typeof v === "object" && v !== null)) {
          urls.push(...extractUrlFromStringOrObject(v));
        } else if (typeof v === "string" && (v.startsWith("http") || v.startsWith("[") || v.startsWith("{") || v.startsWith("data:image"))) {
          urls.push(...extractUrlFromStringOrObject(v));
        }
      }
    });

    return urls;
  }

  return [];
};

/** 📸 선수 사진 추출 유틸리티 (대회 포스터/배너를 제외하고 순수 선수 등록 사진만 100% 추출) */
export const extractPlayerPhotos = (p) => {
  if (!p || typeof p !== "object") return [];
  const list = [];

  // 1. 주요 사진 배열 및 필드 직접 추출
  const targetFields = [
    "photos",
    "playerPhotos",
    "playerPhotoUrlsJson",
    "playerPhotoUrls",
    "photoUrlsJson",
    "photoUrls",
    "photosJson",
    "gallery",
    "images",
    "fileList",
    "files",
    "photoList",
    "attachments",
    "stagePhotoUrl",
    "profileImageUrl",
    "playerPhotoUrl",
    "photoUrl",
    "playerPhoto",
    "photo",
    "photoURL",
    "playerProfileUrl",
    "pictureUrl",
    "imageUrl",
    "fileUrl",
    "userPhotoUrl",
    "downloadURL",
    "downloadUrl",
    "compressedUrl",
    "originalUrl",
  ];

  targetFields.forEach((field) => {
    if (p[field] && !isNonPlayerKey(field)) {
      list.push(...extractUrlFromStringOrObject(p[field]));
    }
  });

  // 2. 선수 관련 중첩 객체 (대회 메타 객체인 contest, contestInfo는 철저히 배제)
  const nestedPlayerFields = [
    "player",
    "playerInfo",
    "userInfo",
    "user",
    "clientInfo",
    "applicantInfo",
    "invoice",
    "invoiceInfo",
    "extra",
  ];
  nestedPlayerFields.forEach((field) => {
    if (p[field] && typeof p[field] === "object" && !isNonPlayerKey(field)) {
      list.push(...extractPlayerPhotos(p[field]));
    }
  });

  // 3. 중첩 신청 종목 (joins 배열)
  if (Array.isArray(p.joins)) {
    p.joins.forEach((j) => {
      if (j && typeof j === "object" && !isNonPlayerKey("joins")) {
        list.push(...extractPlayerPhotos(j));
      }
    });
  }

  // 4. 객체의 나머지 모든 키에 대해서도 포스터/배너 제외 후 안전하게 탐색
  Object.entries(p).forEach(([key, val]) => {
    if (
      !targetFields.includes(key) &&
      !nestedPlayerFields.includes(key) &&
      key !== "joins" &&
      !isNonPlayerKey(key)
    ) {
      list.push(...extractUrlFromStringOrObject(val));
    }
  });

  // 중복 제거 및 비선수(포스터/배너) URL 제외 후 반환
  return Array.from(
    new Set(
      list
        .filter((url) => typeof url === "string" && url.trim().length > 5)
        .filter((url) => !isNonPlayerUrl(url))
        .map((url) => url.trim())
    )
  );
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

  const { currentContest } = useContext(CurrentContestContext);
  const navigate = useNavigate();

  const fetchCategoryDocument = useFirestoreGetDocument("contest_categorys_list");
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersAssignDocument = useFirestoreGetDocument("contest_players_assign");
  const fetchPlayersFinalDocument = useFirestoreGetDocument("contest_players_final");
  const fetchInvoicesQuery = useFirestoreQuery();

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
      const contestId =
        currentContest?.contests?.id ||
        currentContest?.contestInfo?.id ||
        currentContest?.id ||
        "";

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

      // 📥 1. Firestore에서 신청서/엔트리/참가자 풀 전체에서 사진 수집 (선수 본인 사진만 정확 매핑)
      const invoicePhotosMap = new Map();
      const invoiceStage1Map = new Map();
      const invoiceStage2Map = new Map();
      const namePhonePhotoMap = new Map();
      const nameOnlyPhotoMap = new Map();

      const filterValid = (u) => (u && !isNonPlayerUrl(u) ? u : "");

      const processDocPhotos = (docData) => {
        if (!docData) return;
        const photos = extractPlayerPhotos(docData);
        if (photos.length > 0) {
          if (docData.playerUid) {
            const existing = invoicePhotosMap.get(docData.playerUid) || [];
            invoicePhotosMap.set(
              docData.playerUid,
              Array.from(new Set([...existing, ...photos]))
            );
          }
          const rawName = (docData.playerName || docData.contestPlayerName || docData.name || "").trim();
          const rawTel = (docData.playerTel || docData.contestPlayerPhoneNumber || docData.phone || "");
          const telPart = rawTel.replace(/[^0-9]/g, "").slice(-4);

          if (rawName) {
            if (telPart) {
              const nameKey = `${rawName}_${telPart}`;
              const existingByName = namePhonePhotoMap.get(nameKey) || [];
              namePhonePhotoMap.set(
                nameKey,
                Array.from(new Set([...existingByName, ...photos]))
              );
            }
            const existingNameOnly = nameOnlyPhotoMap.get(rawName) || [];
            nameOnlyPhotoMap.set(
              rawName,
              Array.from(new Set([...existingNameOnly, ...photos]))
            );
          }
        }

        // 🌟 YBBF 신청서에 기저장된 stagePhoto1, stagePhoto2 또는 selectedPhotoUrls 매핑
        const s1 = filterValid(docData.stagePhoto1) || filterValid(docData.stagePhotoUrl1);
        const s2 = filterValid(docData.stagePhoto2) || filterValid(docData.stagePhotoUrl2);
        const selectedList = extractUrlFromStringOrObject(docData.selectedPhotoUrls || docData.selectedPhotoUrlsJson);
        const sel1 = s1 || filterValid(selectedList[0]);
        const sel2 = s2 || filterValid(selectedList[1]);

        if (sel1 || sel2) {
          if (docData.playerUid) {
            if (sel1) invoiceStage1Map.set(docData.playerUid, sel1);
            if (sel2) invoiceStage2Map.set(docData.playerUid, sel2);
          }
          const rawName = (docData.playerName || docData.contestPlayerName || docData.name || "").trim();
          const rawTel = (docData.playerTel || docData.contestPlayerPhoneNumber || docData.phone || "");
          const telPart = rawTel.replace(/[^0-9]/g, "").slice(-4);
          if (rawName) {
            if (telPart) {
              const nameKey = `${rawName}_${telPart}`;
              if (sel1) invoiceStage1Map.set(nameKey, sel1);
              if (sel2) invoiceStage2Map.set(nameKey, sel2);
            }
            if (sel1) invoiceStage1Map.set(rawName, sel1);
            if (sel2) invoiceStage2Map.set(rawName, sel2);
          }
        }
      };

      if (contestId) {
        try {
          const invSnap = await getDocs(query(collection(db, "invoices_pool"), where("contestId", "==", contestId)));
          invSnap.docs.forEach((d) => processDocPhotos(d.data()));
        } catch (err) {
          console.warn("invoices_pool 사진 조회 실패:", err);
        }

        try {
          const entrySnap = await getDocs(query(collection(db, "contest_entrys_list"), where("contestId", "==", contestId)));
          entrySnap.docs.forEach((d) => processDocPhotos(d.data()));
        } catch (err) {
          console.warn("contest_entrys_list 사진 조회 실패:", err);
        }

        try {
          const contestInvSnap = await getDocs(query(collection(db, "contest_invoices_list"), where("contestId", "==", contestId)));
          contestInvSnap.docs.forEach((d) => processDocPhotos(d.data()));
        } catch (err) {
          console.warn("contest_invoices_list 사진 조회 실패:", err);
        }
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
        const key = getPlayerEntryKey(p);
        const trimmedName = (p.playerName || "").trim();
        const telPart = (p.playerTel || "").replace(/[^0-9]/g, "").slice(-4);
        const nameKey = `${trimmedName}_${telPart}`;

        const fp = finalMap.has(key) ? finalMap.get(key) : null;
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

        // 🌟 사용자가 계측 명단에서 명시적으로 선택한 '무대 전광판 송출용 사진' 또는 신청서(YBBF) 지정 사진
        const stage1 =
          filterValid(fp?.stagePhoto1) ||
          filterValid(p?.stagePhoto1) ||
          (p.playerUid && invoiceStage1Map.get(p.playerUid)) ||
          invoiceStage1Map.get(nameKey) ||
          (trimmedName && invoiceStage1Map.get(trimmedName)) ||
          filterValid(fp?.stagePhotoUrl1) ||
          filterValid(p?.stagePhotoUrl1) ||
          "";
        const stage2 =
          filterValid(fp?.stagePhoto2) ||
          filterValid(p?.stagePhoto2) ||
          (p.playerUid && invoiceStage2Map.get(p.playerUid)) ||
          invoiceStage2Map.get(nameKey) ||
          (trimmedName && invoiceStage2Map.get(trimmedName)) ||
          filterValid(fp?.stagePhotoUrl2) ||
          filterValid(p?.stagePhotoUrl2) ||
          "";

        const designatedStagePhoto =
          stage1 ||
          stage2 ||
          filterValid(fp?.stagePhotoUrl) ||
          filterValid(p?.stagePhotoUrl) ||
          filterValid(fp?.profileImageUrl) ||
          filterValid(p?.profileImageUrl) ||
          allPlayerPhotos[0] ||
          "";

        let baseObj = {
          ...p,
          stagePhoto1: stage1,
          stagePhoto2: stage2,
          stagePhotoUrl1: stage1,
          stagePhotoUrl2: stage2,
          stagePhotoUrl: designatedStagePhoto,
          profileImageUrl: designatedStagePhoto,
          photoUrl: designatedStagePhoto,
          playerPhoto: designatedStagePhoto,
          photos: allPlayerPhotos,
        };

        if (fp) {
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
            stagePhoto1: stage1,
            stagePhoto2: stage2,
            stagePhotoUrl1: stage1,
            stagePhotoUrl2: stage2,
            stagePhotoUrl: designatedStagePhoto,
            profileImageUrl: designatedStagePhoto,
            photoUrl: designatedStagePhoto,
            playerPhoto: designatedStagePhoto,
            photos: allPlayerPhotos,
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
          const stage1 = (!isNonPlayerUrl(lp?.stagePhoto1) && lp?.stagePhoto1) || (!isNonPlayerUrl(dbPlayer?.stagePhoto1) && dbPlayer?.stagePhoto1) || "";
          const stage2 = (!isNonPlayerUrl(lp?.stagePhoto2) && lp?.stagePhoto2) || (!isNonPlayerUrl(dbPlayer?.stagePhoto2) && dbPlayer?.stagePhoto2) || "";
          const designatedStagePhoto =
            stage1 ||
            stage2 ||
            lp.stagePhotoUrl ||
            dbPlayer.stagePhotoUrl ||
            lp.profileImageUrl ||
            dbPlayer.profileImageUrl ||
            combinedPhotos[0] ||
            "";

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
            stagePhoto1: stage1,
            stagePhoto2: stage2,
            stagePhotoUrl1: stage1,
            stagePhotoUrl2: stage2,
            stagePhotoUrl: designatedStagePhoto,
            profileImageUrl: designatedStagePhoto,
            photoUrl: designatedStagePhoto,
            playerPhoto: designatedStagePhoto,
            photos: combinedPhotos,
          };
        }

        const stage1 = (!isNonPlayerUrl(dbPlayer?.stagePhoto1) && dbPlayer?.stagePhoto1) || "";
        const stage2 = (!isNonPlayerUrl(dbPlayer?.stagePhoto2) && dbPlayer?.stagePhoto2) || "";
        const designatedStagePhoto =
          stage1 ||
          stage2 ||
          dbPlayer.stagePhotoUrl ||
          dbPlayer.profileImageUrl ||
          pUidPrimary;

        return {
          ...dbPlayer,
          stagePhoto1: stage1,
          stagePhoto2: stage2,
          stagePhotoUrl1: stage1,
          stagePhotoUrl2: stage2,
          stagePhotoUrl: designatedStagePhoto,
          profileImageUrl: designatedStagePhoto,
          photoUrl: designatedStagePhoto,
          playerPhoto: designatedStagePhoto,
          photos: pUidPhotos,
        };
      });

      // 만약 로컬에 새로 추가된 엔트리가 있다면 추가
      localPlayersMap.forEach((localPlayer, key) => {
        if (!mergedAssignPlayers.some((p) => getPlayerEntryKey(p) === key)) {
          const pUidPhotos = (localPlayer.playerUid && saveUidPhotoMap.get(localPlayer.playerUid)) || extractPlayerPhotos(localPlayer);
          const stage1 = (!isNonPlayerUrl(localPlayer.stagePhoto1) && localPlayer.stagePhoto1) || "";
          const stage2 = (!isNonPlayerUrl(localPlayer.stagePhoto2) && localPlayer.stagePhoto2) || "";
          const pUidPrimary = stage1 || stage2 || localPlayer.stagePhotoUrl || pUidPhotos[0] || localPlayer.profileImageUrl || "";
          mergedAssignPlayers.push({
            ...localPlayer,
            stagePhoto1: stage1,
            stagePhoto2: stage2,
            stagePhotoUrl1: stage1,
            stagePhotoUrl2: stage2,
            stagePhotoUrl: pUidPrimary,
            profileImageUrl: pUidPrimary,
            photoUrl: pUidPrimary,
            playerPhoto: pUidPrimary,
            photos: pUidPhotos,
          });
        }
      });

      // 4. 최종 명단 (Final) 데이터 구성 (선수 사진 필드 및 무대 1, 2번 슬롯 100% 온전히 보존)
      const mergedFinalPlayers = mergedAssignPlayers.map((player) => {
        const pUidPhotos = (player.playerUid && saveUidPhotoMap.get(player.playerUid)) || extractPlayerPhotos(player);
        const stage1 = (!isNonPlayerUrl(player.stagePhoto1) && player.stagePhoto1) || "";
        const stage2 = (!isNonPlayerUrl(player.stagePhoto2) && player.stagePhoto2) || "";
        const stagePhoto =
          stage1 ||
          stage2 ||
          player.stagePhotoUrl ||
          player.profileImageUrl ||
          pUidPhotos[0] ||
          "";

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
          heightWeight: player.heightWeight || "",
          // 📸 선수 사진 및 무대 송출 슬롯(1, 2) 완벽 보존
          stagePhoto1: stage1,
          stagePhoto2: stage2,
          stagePhotoUrl1: stage1,
          stagePhotoUrl2: stage2,
          stagePhotoUrl: stagePhoto,
          profileImageUrl: stagePhoto,
          photoUrl: stagePhoto,
          playerPhoto: stagePhoto,
          photos: pUidPhotos,
        };
      });

      // 5. Firestore에 안전 병합된 전체 데이터 저장 (Assign & Final 동시 영구 저장)
      const sanitizedAssign = sanitizeDataForFirestore(mergedAssignPlayers);
      const sanitizedFinal = sanitizeDataForFirestore(mergedFinalPlayers);

      await updateDoc(doc(db, "contest_players_assign", playerAssignId), {
        ...(latestAssignDoc || playersAssign),
        players: sanitizedAssign,
        updatedAt: new Date().toISOString(),
      });

      await updateDoc(doc(db, "contest_players_final", playersFinalId), {
        contestId,
        players: sanitizedFinal,
        updatedAt: new Date().toISOString(),
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

  /** 📸 선수 무대 송출 사진 슬롯(1, 2) 갱신 및 Firestore 즉시 영구 저장 */
  const persistPlayerStageSlots = async (targetPlayer, newStage1 = "", newStage2 = "") => {
    const stage1 = (!isNonPlayerUrl(newStage1) && newStage1) || "";
    const stage2 = (!isNonPlayerUrl(newStage2) && newStage2) || "";
    const primaryStage = stage1 || stage2 || "";

    const currentPhotos = extractPlayerPhotos(targetPlayer);
    const targetKey = getPlayerEntryKey(targetPlayer);

    // 1. playersArray 업데이트 (동일 선수의 모든 출전 체급에 슬롯1, 2 동기화)
    const updatedList = playersArray.map((p) => {
      const isMatch =
        (targetKey && getPlayerEntryKey(p) === targetKey) ||
        (targetPlayer.playerUid && p.playerUid === targetPlayer.playerUid) ||
        (p.playerName === targetPlayer.playerName &&
          (p.playerNumber === targetPlayer.playerNumber || !p.playerNumber));

      if (isMatch) {
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
          photos: currentPhotos,
        };
      }
      return p;
    });

    setPlayersArray(updatedList);
    setPhotoModalPlayer((prev) =>
      prev
        ? {
            ...prev,
            stagePhoto1: stage1,
            stagePhoto2: stage2,
            stagePhotoUrl1: stage1,
            stagePhotoUrl2: stage2,
            stagePhotoUrl: primaryStage,
            profileImageUrl: primaryStage,
            photoUrl: primaryStage,
            playerPhoto: primaryStage,
            photos: currentPhotos,
          }
        : null
    );

    // 2. Firestore 직접 updateDoc으로 즉시 영구 저장!
    try {
      const assignId = currentContest?.contests?.contestPlayersAssignId;
      const finalId = currentContest?.contests?.contestPlayersFinalId;
      const sanitizedList = sanitizeDataForFirestore(updatedList);
      if (finalId) {
        await updateDoc(doc(db, "contest_players_final", finalId), {
          players: sanitizedList,
          updatedAt: new Date().toISOString(),
        });
      }
      if (assignId) {
        await updateDoc(doc(db, "contest_players_assign", assignId), {
          players: sanitizedList,
          updatedAt: new Date().toISOString(),
        });
      }
      console.log("무대 사진 슬롯 DB 저장 완료:", { stage1, stage2 });
    } catch (e) {
      console.error("무대 사진 슬롯 DB 저장 실패:", e);
      antMessage.error("DB 저장 중 오류가 발생했습니다.");
    }
  };

  /** 📺 갤러리 사진 클릭 시 무대 사진 1, 2 슬롯에 순차 배치 (이미 차있는 경우 덮어쓰지 않고 경고) */
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

    if (currentStage1 === imgUrl) {
      antMessage.info("이미 [무대용 사진 1]에 등록된 사진입니다.");
      return;
    }
    if (currentStage2 === imgUrl) {
      antMessage.info("이미 [무대용 사진 2]에 등록된 사진입니다.");
      return;
    }

    if (!currentStage1) {
      await persistPlayerStageSlots(photoModalPlayer, imgUrl, currentStage2);
      antMessage.success("[무대용 사진 1]에 등록 및 DB 저장이 완료되었습니다!");
    } else if (!currentStage2) {
      await persistPlayerStageSlots(photoModalPlayer, currentStage1, imgUrl);
      antMessage.success("[무대용 사진 2]에 등록 및 DB 저장이 완료되었습니다!");
    } else {
      antMessage.warning(
        "무대용 사진 1, 2가 모두 등록되어 있습니다. 변경하시려면 기존 슬롯의 [비우기] 버튼을 누른 후 다시 선택해 주세요."
      );
    }
  };

  /** 🗑️ 무대 사진 슬롯 비우기 핸들러 */
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
      antMessage.info("[무대용 사진 1] 슬롯이 비워졌습니다.");
    } else if (slotNumber === 2) {
      await persistPlayerStageSlots(photoModalPlayer, currentStage1, "");
      antMessage.info("[무대용 사진 2] 슬롯이 비워졌습니다.");
    }
  };

  /** 📸 신청서 원본 및 엔트리에서 순수 선수 사진만 재추출하여 포스터/오류 사진을 정리하고 DB에 갱신 */
  const handleSyncCleanPhotoData = async () => {
    const contestId =
      currentContest?.contests?.id ||
      currentContest?.contestInfo?.id ||
      currentContest?.id ||
      "";

    const assignId = currentContest?.contests?.contestPlayersAssignId;
    const finalId = currentContest?.contests?.contestPlayersFinalId;

    if (!contestId) {
      antMessage.error("대회 정보를 확인할 수 없습니다.");
      return;
    }

    setIsSyncingPhotos(true);
    try {
      console.log("=== [사진데이터 갱신 시작] Contest ID:", contestId, "Assign ID:", assignId, "Final ID:", finalId);

      // 1. 직접 Firestore getDocs로 모든 풀 컬렉션 조회
      const queryInvoicesPool = async () => {
        try {
          const q = query(collection(db, "invoices_pool"), where("contestId", "==", contestId));
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn("invoices_pool 조회 오류:", e);
          return [];
        }
      };

      const queryEntriesList = async () => {
        try {
          const q = query(collection(db, "contest_entrys_list"), where("contestId", "==", contestId));
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn("contest_entrys_list 조회 오류:", e);
          return [];
        }
      };

      const queryContestInvoices = async () => {
        try {
          const q = query(collection(db, "contest_invoices_list"), where("contestId", "==", contestId));
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn("contest_invoices_list 조회 오류:", e);
          return [];
        }
      };

      const queryContestPlayersList = async () => {
        try {
          const q = query(collection(db, "contest_players_list"), where("contestId", "==", contestId));
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (e) {
          return [];
        }
      };

      const [invoices, entries, contestInvoices, playersList] = await Promise.all([
        queryInvoicesPool(),
        queryEntriesList(),
        queryContestInvoices(),
        queryContestPlayersList(),
      ]);

      console.log(`[신청서 풀 조회 결과] invoices_pool: ${invoices.length}, entries: ${entries.length}, contestInvoices: ${contestInvoices.length}, playersList: ${playersList.length}`);

      const uidPhotosMap = new Map();
      const syncStage1Map = new Map();
      const syncStage2Map = new Map();
      const namePhonePhotosMap = new Map();
      const nameOnlyPhotosMap = new Map();

      const collectCleanPhotos = (docData) => {
        if (!docData) return;
        const filterValid = (u) => (u && !isNonPlayerUrl(u) ? u : "");
        // 대회 메타 제외하고 순수 선수 객체/필드에서만 사진 추출
        const photos = extractPlayerPhotos(docData);
        if (photos.length > 0) {
          if (docData.playerUid) {
            const existing = uidPhotosMap.get(docData.playerUid) || [];
            uidPhotosMap.set(
              docData.playerUid,
              Array.from(new Set([...existing, ...photos]))
            );
          }
          const rawName = (docData.playerName || docData.contestPlayerName || docData.name || "").trim();
          const rawTel = (docData.playerTel || docData.contestPlayerPhoneNumber || docData.phone || "");
          const telPart = rawTel.replace(/[^0-9]/g, "").slice(-4);
          if (rawName) {
            if (telPart) {
              const nameKey = `${rawName}_${telPart}`;
              const existing = namePhonePhotosMap.get(nameKey) || [];
              namePhonePhotosMap.set(
                nameKey,
                Array.from(new Set([...existing, ...photos]))
              );
            }
            const existingNameOnly = nameOnlyPhotosMap.get(rawName) || [];
            nameOnlyPhotosMap.set(
              rawName,
              Array.from(new Set([...existingNameOnly, ...photos]))
            );
          }
        }

        // YBBF 지정 stagePhoto1, stagePhoto2 또는 selectedPhotoUrls
        const s1 = filterValid(docData.stagePhoto1) || filterValid(docData.stagePhotoUrl1);
        const s2 = filterValid(docData.stagePhoto2) || filterValid(docData.stagePhotoUrl2);
        const selectedList = extractUrlFromStringOrObject(docData.selectedPhotoUrls || docData.selectedPhotoUrlsJson);
        const sel1 = s1 || filterValid(selectedList[0]);
        const sel2 = s2 || filterValid(selectedList[1]);

        if (sel1 || sel2) {
          if (docData.playerUid) {
            if (sel1) syncStage1Map.set(docData.playerUid, sel1);
            if (sel2) syncStage2Map.set(docData.playerUid, sel2);
          }
          const rawName = (docData.playerName || docData.contestPlayerName || docData.name || "").trim();
          const rawTel = (docData.playerTel || docData.contestPlayerPhoneNumber || docData.phone || "");
          const telPart = rawTel.replace(/[^0-9]/g, "").slice(-4);
          if (rawName) {
            if (telPart) {
              const nameKey = `${rawName}_${telPart}`;
              if (sel1) syncStage1Map.set(nameKey, sel1);
              if (sel2) syncStage2Map.set(nameKey, sel2);
            }
            if (sel1) syncStage1Map.set(rawName, sel1);
            if (sel2) syncStage2Map.set(rawName, sel2);
          }
        }
      };

      [...invoices, ...entries, ...contestInvoices, ...playersList].forEach(collectCleanPhotos);

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

      // 5. Firestore DB 즉시 직접 안전 저장 (undefined 완벽 정제)
      const sanitizedPlayers = sanitizeDataForFirestore(cleanedPlayers);

      if (assignId) {
        await updateDoc(doc(db, "contest_players_assign", assignId), {
          players: sanitizedPlayers,
          updatedAt: new Date().toISOString(),
        });
      }
      if (finalId) {
        await updateDoc(doc(db, "contest_players_final", finalId), {
          contestId,
          players: sanitizedPlayers,
          updatedAt: new Date().toISOString(),
        });
      }

      // 화면 다시 그리기
      await fetchPool();

      antMessage.success(
        `선수 사진 데이터 갱신 완료! (총 ${cleanedPlayers.length}명의 출전 명단 중 ${photoAthleteCount}명의 사진 ${totalPhotoCount}장이 정리되어 DB에 안전하게 동기화되었습니다.)`
      );
    } catch (error) {
      console.error("사진 데이터 갱신 실패 상세 원인:", error);
      antMessage.error(
        `사진 데이터 갱신 중 오류가 발생했습니다: ${error?.message || "네트워크를 확인해 주세요"}`
      );
    } finally {
      setIsSyncingPhotos(false);
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

          {/* 📸 선수 사진 확인 및 무대용 사진 1, 2 지정 모달 */}
          <Modal
            open={photoModalOpen}
            title={
              <div className="flex items-center gap-2">
                <FileImageOutlined className="text-amber-500 text-lg" />
                <span className="font-black text-slate-800 text-base">
                  선수 무대 송출용 사진 지정 ({photoModalPlayer?.playerName} 선수)
                </span>
              </div>
            }
            onCancel={() => {
              setPhotoModalOpen(false);
              setPhotoModalPlayer(null);
            }}
            footer={null}
            centered
            width={680}
            destroyOnClose
          >
            {photoModalPlayer && (() => {
              const photos = extractPlayerPhotos(photoModalPlayer);
              const stage1 =
                (!isNonPlayerUrl(photoModalPlayer.stagePhoto1) && photoModalPlayer.stagePhoto1) ||
                (!isNonPlayerUrl(photoModalPlayer.stagePhotoUrl1) && photoModalPlayer.stagePhotoUrl1) ||
                "";
              const stage2 =
                (!isNonPlayerUrl(photoModalPlayer.stagePhoto2) && photoModalPlayer.stagePhoto2) ||
                (!isNonPlayerUrl(photoModalPlayer.stagePhotoUrl2) && photoModalPlayer.stagePhotoUrl2) ||
                "";

              return (
                <div className="flex flex-col gap-4 py-1">
                  {/* 선수 기본 정보 */}
                  <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs">
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
                    <div>
                      <Tag color={photos.length > 0 ? "gold" : "default"} className="font-bold mr-0">
                        {photos.length > 0 ? `등록된 사진 총 ${photos.length}장` : "사진 미등록"}
                      </Tag>
                    </div>
                  </div>

                  {/* 📺 1. 무대용 사진 1, 2 슬롯 섹션 */}
                  <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-black text-sm flex items-center gap-1.5">
                          <span className="animate-pulse">📺</span>
                          <span>무대 공식 송출용 지정 사진 (슬롯 1, 슬롯 2)</span>
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        * 하단 갤러리에서 사진 클릭 시 빈 슬롯에 자동 배치
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* 🌟 슬롯 1: 무대용 사진 1 */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-black text-amber-300 flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black">1</span>
                            <span>무대용 사진 1 (메인)</span>
                          </span>
                          {stage1 && (
                            <button
                              type="button"
                              onClick={() => handleClearStageSlot(1)}
                              className="px-2 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 hover:text-rose-100 text-[11px] font-bold border border-rose-500/30 cursor-pointer transition-all"
                            >
                              🗑️ 비우기
                            </button>
                          )}
                        </div>

                        {stage1 ? (
                          <div className="relative h-48 rounded-xl overflow-hidden bg-black border-2 border-amber-400 shadow-md group flex items-center justify-center">
                            <img
                              src={stage1}
                              alt="무대용 사진 1"
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent py-1 text-center">
                              <span className="text-amber-300 text-[11px] font-black">
                                ★ 1번 메인 송출용
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-48 rounded-xl border-2 border-dashed border-amber-400/50 bg-amber-950/20 flex flex-col items-center justify-center p-4 text-center gap-1.5">
                            <div className="text-2xl text-amber-400/60">➕</div>
                            <span className="text-xs font-bold text-amber-200">
                              [무대용 사진 1] 비어있음
                            </span>
                            <span className="text-[11px] text-slate-400">
                              하단 갤러리에서 사진을 선택하세요
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 🌟 슬롯 2: 무대용 사진 2 */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-black text-emerald-300 flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-black">2</span>
                            <span>무대용 사진 2 (서브/교차)</span>
                          </span>
                          {stage2 && (
                            <button
                              type="button"
                              onClick={() => handleClearStageSlot(2)}
                              className="px-2 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 hover:text-rose-100 text-[11px] font-bold border border-rose-500/30 cursor-pointer transition-all"
                            >
                              🗑️ 비우기
                            </button>
                          )}
                        </div>

                        {stage2 ? (
                          <div className="relative h-48 rounded-xl overflow-hidden bg-black border-2 border-emerald-400 shadow-md group flex items-center justify-center">
                            <img
                              src={stage2}
                              alt="무대용 사진 2"
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent py-1 text-center">
                              <span className="text-emerald-300 text-[11px] font-black">
                                ★ 2번 서브 송출용
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-48 rounded-xl border-2 border-dashed border-emerald-400/50 bg-emerald-950/20 flex flex-col items-center justify-center p-4 text-center gap-1.5">
                            <div className="text-2xl text-emerald-400/60">➕</div>
                            <span className="text-xs font-bold text-emerald-200">
                              [무대용 사진 2] 비어있음
                            </span>
                            <span className="text-[11px] text-slate-400">
                              하단 갤러리에서 사진을 선택하세요
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 🖼️ 2. 전체 선수 등록 사진 갤러리 */}
                  {photos.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 space-y-2">
                      <div className="text-4xl text-slate-300">📷</div>
                      <h3 className="text-sm font-bold text-slate-600 m-0">
                        참가신청서에 등록된 사진이 없습니다.
                      </h3>
                      <p className="text-xs text-slate-400 m-0">
                        상단의 [사진데이터 갱신]을 눌러 신청서 원본과 동기화해 보세요.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                        <span>
                          선수 등록 사진 갤러리 ({photos.length}장)
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          사진을 클릭하면 빈 슬롯(1 ➜ 2)에 안전하게 등록됩니다
                        </span>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
                        {photos.map((imgUrl, i) => {
                          const isSlot1 = imgUrl === stage1;
                          const isSlot2 = imgUrl === stage2;
                          const isAssigned = isSlot1 || isSlot2;

                          return (
                            <div
                              key={i}
                              onClick={() => handleAssignStageSlot(imgUrl)}
                              className={`relative rounded-xl border-2 overflow-hidden transition-all group cursor-pointer ${
                                isSlot1
                                  ? "border-amber-400 ring-2 ring-amber-300 shadow-md scale-[1.02]"
                                  : isSlot2
                                  ? "border-emerald-400 ring-2 ring-emerald-300 shadow-md scale-[1.02]"
                                  : "border-slate-200 hover:border-blue-400 hover:shadow"
                              }`}
                            >
                              <img
                                src={imgUrl}
                                alt={`사진 ${i + 1}`}
                                className="w-full h-24 object-cover"
                              />

                              {isSlot1 && (
                                <div className="absolute inset-x-0 bottom-0 bg-amber-500 text-slate-950 text-[10px] font-black text-center py-0.5 shadow">
                                  ★ 무대 1번 등록됨
                                </div>
                              )}
                              {isSlot2 && (
                                <div className="absolute inset-x-0 bottom-0 bg-emerald-500 text-slate-950 text-[10px] font-black text-center py-0.5 shadow">
                                  ★ 무대 2번 등록됨
                                </div>
                              )}
                              {!isAssigned && (
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-black text-white transition-opacity text-center px-1">
                                  {!stage1 ? "무대 1번에 등록" : !stage2 ? "무대 2번에 등록" : "슬롯 가득참 (비우기 필요)"}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="text-center pt-2">
                    <Button
                      type="primary"
                      onClick={() => {
                        setPhotoModalOpen(false);
                        setPhotoModalPlayer(null);
                      }}
                      className="rounded-xl px-8 font-bold bg-slate-900 hover:bg-slate-800"
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
                  <span>출전 선수 현황</span>
                  <span className="text-emerald-400 font-black">{activePlayersCount} / {totalPlayersCount}명</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${totalPlayersCount > 0 ? Math.round((activePlayersCount / totalPlayersCount) * 100) : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 gap-2">
                  <span>출전: <strong className="text-emerald-400">{activePlayersCount}</strong>명</span>
                  <span>불참: <strong className="text-rose-400">{noShowCount}</strong>명</span>
                  <span>월체: <strong className="text-orange-400">{gradeChangedCount}</strong>명</span>
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

                {/* 📸 사진 데이터 정밀 갱신/동기화 버튼 */}
                <button
                  type="button"
                  onClick={handleSyncCleanPhotoData}
                  disabled={isSyncingPhotos}
                  title="신청서 원본에서 순수 선수 사진만 다시 정밀 추출하여 포스터/오류 사진을 정리하고 계측 명단에 동기화합니다."
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-100 font-black text-xs border border-amber-500/40 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <SyncOutlined spin={isSyncingPhotos} className="text-amber-400" />
                  <span>{isSyncingPhotos ? "사진 정리/동기화 중..." : "사진데이터 갱신"}</span>
                </button>

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

              {/* 출전상태 필터 */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setFilterWeighedStatus("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-0 cursor-pointer transition-all ${
                    filterWeighedStatus === "all"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "bg-transparent text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  전체 ({totalPlayersCount})
                </button>
                <button
                  onClick={() => setFilterWeighedStatus("active")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-0 cursor-pointer transition-all ${
                    filterWeighedStatus === "active"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-transparent text-emerald-700 hover:bg-slate-200"
                  }`}
                >
                  정상출전 ({activePlayersCount})
                </button>
                <button
                  onClick={() => setFilterWeighedStatus("noshow")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-0 cursor-pointer transition-all ${
                    filterWeighedStatus === "noshow"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-transparent text-rose-700 hover:bg-slate-200"
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

                const gradeNoShowCount = matchedPlayers.filter((p) => p.playerNoShow).length;
                const gradeActiveCount = matchedPlayers.length - gradeNoShowCount;

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
                          color={gradeNoShowCount === 0 ? "blue" : "default"}
                          className="font-bold text-xs px-2.5 py-0.5 rounded-md mr-0"
                        >
                          출전 {matchedPlayers.length - gradeNoShowCount} / {matchedPlayers.length}명
                          {gradeNoShowCount > 0 && ` (불참 ${gradeNoShowCount}명)`}
                        </Tag>
                      </div>
                    </div>

                    {/* 데스크탑 테이블 */}
                    {!isMobile ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            {/* 테이블 헤더 (넉넉한 높이 & 높은 시인성) */}
                            <tr className="border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                              <th className="py-4 px-3 w-14 text-center">순번</th>
                              <th className="py-4 px-2 w-20 text-center">사진</th>
                              <th className="py-4 px-3 w-32 text-center">선수번호</th>
                              <th className="py-4 px-4 w-48">선수 성명 / 상태</th>
                              <th className="py-4 px-3 w-40">소속</th>
                              <th className="py-4 px-4 w-96">신장(cm) / 체중(kg) 계측 입력</th>
                              <th className="py-4 px-3 w-24 text-center">월체</th>
                              <th className="py-4 px-3 w-28 text-center">불참 (NoShow)</th>
                              <th className="py-4 px-3 w-24 text-center">관리</th>
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
                                        : "hover:bg-slate-50"
                                    }`}
                                  >
                                    {/* 순번 */}
                                    <td className="py-5 px-3 text-center font-black text-sm text-slate-400">
                                      {pIdx + 1}
                                    </td>

                                    {/* 📸 선수 사진 썸네일 (확대 & 클릭 쉬운 타겟) */}
                                    <td className="py-4 px-2 text-center">
                                      {playerPhotos.length > 0 ? (
                                        <Tooltip title="클릭하여 무대 송출 사진 지정 및 갤러리 확인">
                                          <div
                                            onClick={() => {
                                              setPhotoModalPlayer(player);
                                              setPhotoModalOpen(true);
                                            }}
                                            className="relative inline-block cursor-pointer group"
                                          >
                                            <img
                                              src={player.stagePhoto1 || player.stagePhotoUrl1 || player.stagePhotoUrl || playerPhotos[0]}
                                              alt={playerName}
                                              className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-400 shadow-md group-hover:scale-110 group-hover:border-amber-300 transition-all mx-auto"
                                            />
                                            {playerPhotos.length > 1 && (
                                              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-[10px] text-slate-950 font-black px-1.5 py-0.2 rounded-full border border-white shadow">
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
                                            className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-400 hover:text-slate-600 text-base flex items-center justify-center cursor-pointer transition-all mx-auto"
                                          >
                                            <UserOutlined />
                                          </button>
                                        </Tooltip>
                                      )}
                                    </td>

                                    {/* 선수번호 뱃지 (크고 뚜렷하게) */}
                                    <td className="py-5 px-3 text-center">
                                      <span
                                        className={`inline-flex items-center px-4 py-2 rounded-xl font-mono font-black text-base sm:text-lg shadow-sm ${
                                          playerNoShow
                                            ? "bg-rose-800 text-rose-200 line-through opacity-80"
                                            : "bg-slate-900 text-amber-400"
                                        }`}
                                      >
                                        {playerNumber}
                                      </span>
                                    </td>

                                    {/* 선수 성명 & 불참/월체 뱃지 */}
                                    <td className="py-5 px-4">
                                      <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`font-black text-base tracking-tight ${
                                              playerNoShow
                                                ? "text-rose-700 line-through font-extrabold"
                                                : "text-slate-900"
                                            }`}
                                          >
                                            {playerName}
                                          </span>
                                          {isGradeChanged && !playerNoShow && (
                                            <Tag color="orange" className="text-[11px] px-1.5 py-0.5 mr-0 font-black rounded-md">
                                              월체
                                            </Tag>
                                          )}
                                        </div>

                                        {/* 🚨 불참 시 눈에 띄는 확실한 경고 뱃지 */}
                                        {playerNoShow && (
                                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black text-xs w-fit shadow animate-pulse">
                                            <WarningOutlined />
                                            <span>불참 확정 (No-Show)</span>
                                          </div>
                                        )}
                                      </div>
                                    </td>

                                    <td className={`py-5 px-3 font-semibold text-sm ${playerNoShow ? "text-rose-400 line-through" : "text-slate-600"}`}>
                                      {playerGym || "무소속 / 개인"}
                                    </td>

                                    {/* 📏 대형 신장(cm) / 체중(kg) 분리 입력란 */}
                                    <td className="py-5 px-4">
                                      <div className="flex items-center gap-2.5">
                                        {/* 신장 입력 (더 크고 시원하게) */}
                                        <div className="relative flex items-center">
                                          <Input
                                            value={height}
                                            disabled={playerNoShow}
                                            placeholder="신장"
                                            onChange={(e) =>
                                              handleHeightChange(entryKey, e.target.value)
                                            }
                                            className={`w-32 sm:w-36 h-12 text-base sm:text-lg font-black font-mono pr-7 text-center rounded-xl border-2 transition-all ${
                                              playerNoShow
                                                ? "bg-slate-100 text-slate-400 border-slate-200"
                                                : "border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 bg-white text-blue-950 shadow-sm"
                                            }`}
                                          />
                                          <span className="absolute right-2 text-xs font-black text-slate-400 pointer-events-none">
                                            cm
                                          </span>
                                        </div>

                                        <span className="text-slate-300 font-black text-xl">/</span>

                                        {/* 체중 입력 (더 크고 시원하게) */}
                                        <div className="relative flex items-center">
                                          <Input
                                            value={weight}
                                            disabled={playerNoShow}
                                            placeholder="체중"
                                            onChange={(e) =>
                                              handleWeightChange(entryKey, e.target.value)
                                            }
                                            className={`w-32 sm:w-36 h-12 text-base sm:text-lg font-black font-mono pr-7 text-center rounded-xl border-2 transition-all ${
                                              playerNoShow
                                                ? "bg-slate-100 text-slate-400 border-slate-200"
                                                : "border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 bg-white text-blue-950 shadow-sm"
                                            }`}
                                          />
                                          <span className="absolute right-2 text-xs font-black text-slate-400 pointer-events-none">
                                            kg
                                          </span>
                                        </div>
                                      </div>
                                    </td>

                                    {/* 월체 체크 */}
                                    <td className="py-5 px-3 text-center">
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
                                        className="scale-150"
                                      />
                                    </td>

                                    {/* 🚨 불참 체크박스 */}
                                    <td className="py-5 px-3 text-center">
                                      <Checkbox
                                        checked={playerNoShow}
                                        onChange={(e) => handleNoShow(playerNumber, entryKey, e)}
                                        className={`scale-150 ${playerNoShow ? "accent-red-600" : ""}`}
                                      />
                                      {playerNoShow && (
                                        <div className="text-xs text-rose-600 font-black mt-1">
                                          불참
                                        </div>
                                      )}
                                    </td>

                                    <td className="py-5 px-3 text-center">
                                      <Button
                                        size="middle"
                                        icon={<EditOutlined />}
                                        onClick={() => openNumberModal(player)}
                                        className="text-xs font-bold rounded-xl px-3"
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
                      /* 모바일 카드 뷰 (여유로운 입력 터치 공간) */
                      <div className="p-3 space-y-3">
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
                                className={`p-4 rounded-2xl border-2 ${
                                  playerNoShow
                                    ? "bg-rose-100/90 border-rose-400"
                                    : "bg-white border-slate-200 shadow-sm"
                                } space-y-3.5`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    {/* 📸 모바일 사진 썸네일 */}
                                    {(() => {
                                      const mPhotos = extractPlayerPhotos(player);
                                      if (mPhotos.length > 0) {
                                        return (
                                          <img
                                            src={player.stagePhoto1 || player.stagePhotoUrl1 || player.stagePhotoUrl || mPhotos[0]}
                                            alt={playerName}
                                            onClick={() => {
                                              setPhotoModalPlayer(player);
                                              setPhotoModalOpen(true);
                                            }}
                                            className="w-11 h-11 rounded-xl object-cover border-2 border-amber-400 shadow-sm shrink-0 cursor-pointer"
                                          />
                                        );
                                      }
                                      return (
                                        <button
                                          onClick={() => {
                                            setPhotoModalPlayer(player);
                                            setPhotoModalOpen(true);
                                          }}
                                          className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-300 text-slate-400 text-sm flex items-center justify-center shrink-0"
                                        >
                                          <UserOutlined />
                                        </button>
                                      );
                                    })()}
                                    <span
                                      className={`px-3 py-1 rounded-xl font-mono font-black text-base shadow-sm ${
                                        playerNoShow
                                          ? "bg-rose-800 text-rose-200 line-through"
                                          : "bg-slate-900 text-amber-400"
                                      }`}
                                    >
                                      #{playerNumber}
                                    </span>
                                    <span
                                      className={`font-black text-base tracking-tight ${
                                        playerNoShow ? "line-through text-rose-700" : "text-slate-900"
                                      }`}
                                    >
                                      {playerName}
                                    </span>
                                    {isGradeChanged && !playerNoShow && (
                                      <Tag color="orange" className="font-black rounded-md">
                                        월체
                                      </Tag>
                                    )}
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

                                <div className="text-xs text-slate-500 font-semibold">
                                  소속: {playerGym || "개인 / 무소속"}
                                </div>

                                {/* 대형 신장/체중 2개 분리 입력란 */}
                                <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                  <span className="text-xs font-black text-slate-700 shrink-0">계측:</span>
                                  <div className="relative flex-1 flex items-center">
                                    <Input
                                      value={height}
                                      disabled={playerNoShow}
                                      placeholder="신장"
                                      onChange={(e) =>
                                        handleHeightChange(entryKey, e.target.value)
                                      }
                                      className="h-11 text-base font-black font-mono text-center pr-7 rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 bg-white shadow-sm"
                                    />
                                    <span className="absolute right-2 text-xs font-black text-slate-400 pointer-events-none">
                                      cm
                                    </span>
                                  </div>
                                  <span className="text-slate-300 font-black text-lg">/</span>
                                  <div className="relative flex-1 flex items-center">
                                    <Input
                                      value={weight}
                                      disabled={playerNoShow}
                                      placeholder="체중"
                                      onChange={(e) =>
                                        handleWeightChange(entryKey, e.target.value)
                                      }
                                      className="h-11 text-base font-black font-mono text-center pr-7 rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 bg-white shadow-sm"
                                    />
                                    <span className="absolute right-2 text-xs font-black text-slate-400 pointer-events-none">
                                      kg
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2.5 border-t border-slate-100">
                                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
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
                                      className="scale-125"
                                    />
                                    <span>월체</span>
                                  </label>

                                  <label className="flex items-center gap-1.5 text-xs text-rose-700 font-black cursor-pointer">
                                    <Checkbox
                                      checked={playerNoShow}
                                      onChange={(e) => handleNoShow(playerNumber, entryKey, e)}
                                      className="scale-125"
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
