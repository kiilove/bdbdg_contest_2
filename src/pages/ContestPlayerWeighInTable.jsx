import { useContext, useEffect, useState, useMemo, useRef } from "react";
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
import ConfirmModalTrigger from "../components/ui/ConfirmModalTrigger";
import {
  Checkbox,
  Drawer,
  Button,
  InputNumber,
  Input,
  Tooltip,
} from "antd";
import {
  Save,
  Pencil,
  Search,
  Check,
  RefreshCw,
  AlertTriangle,
  Image,
  User,
  Trash2,
  ArrowLeftRight,
  Plus,
  Scale,
} from "lucide-react";
import BibTag, { StatusDot } from "../components/ui/BibTag";

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
  const idPart =
    p.playerUid ||
    `num:${p.playerNumber ?? ""}_name:${(p.playerName || "").trim()}`;
  const catId = p.contestCategoryId || "";
  const gradeId = p.originalGradeId || p.contestGradeId || "";
  return `${idPart}_${catId}_${gradeId}`;
};

/** 🔑 최종명단 보존 판별용 (contestGradeId, playerNumber, playerUid) 엄격 튜플 키 */
const getPlayerTupleKey = (p) => {
  if (!p) return "";
  return `${p.contestGradeId || ""}__${p.playerNumber ?? ""}__${p.playerUid || ""}`;
};

/** 🛡️ 그랑프리 엔트리 여부 엄격 판별 (일반 종목의 originalGradeId 등과 절대 혼동하지 않음) */
const isGrandPrixEntryLike = (p) => {
  if (!p) return false;
  const section = String(p.contestCategorySection || "").trim();
  const catTitle = String(p.contestCategoryTitle || "").trim();
  return (
    section === "그랑프리" ||
    catTitle === "그랑프리" ||
    catTitle.includes("그랑프리")
  );
};

/** 🛡️ 그랑프리 자동생성 엔트리 여부 판별 (강제등록 createdBy === 'force' 제외) */
const isAutoGrandPrixEntry = (p) => {
  if (!p) return false;
  if (p.createdBy === "force" || p.createBy === "force") return false;
  return isGrandPrixEntryLike(p);
};

/** 🛡️ contest_players_final 저장 시 assign에 없는 그랑프리/강제등록 선수 완벽 보존 */
const mergePreservingUnmatchedFinalEntries = (
  targetFinalPlayers = [],
  existingFinalPlayers = []
) => {
  if (!Array.isArray(existingFinalPlayers) || existingFinalPlayers.length === 0) {
    return targetFinalPlayers;
  }

  const entryKeySet = new Set(
    targetFinalPlayers.map((p) => getPlayerEntryKey(p)).filter(Boolean)
  );
  const tupleKeySet = new Set(
    targetFinalPlayers.map((p) => getPlayerTupleKey(p)).filter(Boolean)
  );
  const regularUidCatSet = new Set(
    targetFinalPlayers
      .filter(
        (p) =>
          p?.playerUid &&
          p?.contestCategoryId &&
          !isGrandPrixEntryLike(p)
      )
      .map((p) => `${p.playerUid}__${p.contestCategoryId}`)
  );

  const preserved = [...targetFinalPlayers];
  existingFinalPlayers.forEach((fp) => {
    if (!fp) return;
    const eKey = getPlayerEntryKey(fp);
    const tKey = getPlayerTupleKey(fp);
    if ((eKey && entryKeySet.has(eKey)) || (tKey && tupleKeySet.has(tKey))) {
      return;
    }
    const isForce = fp.createdBy === "force" || fp.createBy === "force";
    const isGrandPrix = isGrandPrixEntryLike(fp);
    if (
      !isForce &&
      !isGrandPrix &&
      fp.isGradeChanged &&
      fp.playerUid &&
      fp.contestCategoryId &&
      regularUidCatSet.has(`${fp.playerUid}__${fp.contestCategoryId}`)
    ) {
      return;
    }
    if (eKey) entryKeySet.add(eKey);
    if (tKey) tupleKeySet.add(tKey);
    preserved.push(fp);
  });

  return preserved;
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

  // 🛡️ 다중 계측대 입력 보호용 포커스 / 로컬 미저장 행 추적 Ref
  const focusedPlayerKeyRef = useRef(null);
  const dirtyPlayerKeysRef = useRef(new Set());
  const editTargetKeyRef = useRef(null);
  editTargetKeyRef.current = editTargetKey;

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

      // 🌟 참가신청서 원본(contest_entrys_list) 기반 '진짜 원래 체급(Original Grade)' 맵 구축
      const entryOriginalGradeMap = new Map();
      if (contestId) {
        try {
          const invSnap = await getDocs(query(collection(db, "invoices_pool"), where("contestId", "==", contestId)));
          invSnap.docs.forEach((d) => processDocPhotos(d.data()));
        } catch (err) {
          console.warn("invoices_pool 사진 조회 실패:", err);
        }

        try {
          const entrySnap = await getDocs(query(collection(db, "contest_entrys_list"), where("contestId", "==", contestId)));
          entrySnap.docs.forEach((d) => {
            const data = d.data();
            processDocPhotos(data);

            const uid = data.playerUid || "";
            const catId = data.contestCategoryId || "";
            const rawName = (data.playerName || data.contestPlayerName || data.name || "").trim();
            const gId = data.contestGradeId || "";
            const gTitle = data.contestGradeTitle || "";

            if (gId) {
              if (uid && catId) entryOriginalGradeMap.set(`${uid}_${catId}`, { contestGradeId: gId, contestGradeTitle: gTitle });
              if (rawName && catId) entryOriginalGradeMap.set(`${rawName}_${catId}`, { contestGradeId: gId, contestGradeTitle: gTitle });
            }
          });
        } catch (err) {
          console.warn("contest_entrys_list 사진/체급 조회 실패:", err);
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

        // 🌟 사용자가 계측 명단에서 명시적으로 선택한 '무대 전광판 송출용 사진' (fp > p > 신청서 원본 순으로 절대 우선)
        const stage1 =
          filterValid(fp?.stagePhoto1) ||
          filterValid(fp?.stagePhotoUrl1) ||
          filterValid(p?.stagePhoto1) ||
          filterValid(p?.stagePhotoUrl1) ||
          (p.playerUid && invoiceStage1Map.get(p.playerUid)) ||
          invoiceStage1Map.get(nameKey) ||
          (trimmedName && invoiceStage1Map.get(trimmedName)) ||
          "";
        const stage2 =
          filterValid(fp?.stagePhoto2) ||
          filterValid(fp?.stagePhotoUrl2) ||
          filterValid(p?.stagePhoto2) ||
          filterValid(p?.stagePhotoUrl2) ||
          (p.playerUid && invoiceStage2Map.get(p.playerUid)) ||
          invoiceStage2Map.get(nameKey) ||
          (trimmedName && invoiceStage2Map.get(trimmedName)) ||
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

        const isGradeChanged = fp ? !!fp.isGradeChanged : !!p.isGradeChanged;

        let baseObj = {
          ...p,
          originalGradeId: origGradeId,
          originalGradeTitle: origGradeTitle,
          isGradeChanged: isGradeChanged,
          // 🌟 월체(isGradeChanged === true)일 때만 변경 체급 유지, 월체 취소(false)면 무조건 원래 체급(origGradeId)으로 복귀!
          contestGradeId: isGradeChanged ? (fp?.contestGradeId || p.contestGradeId || origGradeId) : origGradeId,
          contestGradeTitle: isGradeChanged ? (fp?.contestGradeTitle || p.contestGradeTitle || origGradeTitle) : origGradeTitle,
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
        const stage1 =
          filterValid(fp.stagePhoto1) ||
          filterValid(fp.stagePhotoUrl1) ||
          (fp.playerUid && invoiceStage1Map.get(fp.playerUid)) ||
          invoiceStage1Map.get(nameKey) ||
          (trimmedName && invoiceStage1Map.get(trimmedName)) ||
          "";
        const stage2 =
          filterValid(fp.stagePhoto2) ||
          filterValid(fp.stagePhotoUrl2) ||
          (fp.playerUid && invoiceStage2Map.get(fp.playerUid)) ||
          invoiceStage2Map.get(nameKey) ||
          (trimmedName && invoiceStage2Map.get(trimmedName)) ||
          "";
        const designatedStagePhoto =
          stage1 ||
          stage2 ||
          filterValid(fp.stagePhotoUrl) ||
          filterValid(fp.profileImageUrl) ||
          allPlayerPhotos[0] ||
          "";

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
          stagePhoto1: stage1,
          stagePhoto2: stage2,
          stagePhotoUrl1: stage1,
          stagePhotoUrl2: stage2,
          stagePhotoUrl: designatedStagePhoto,
          profileImageUrl: designatedStagePhoto,
          photoUrl: designatedStagePhoto,
          playerPhoto: designatedStagePhoto,
          photos: allPlayerPhotos,
        });
      });

      dirtyPlayerKeysRef.current.clear();
      setPlayersArray(mergedLoadedPlayers);
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
                      photos:
                        localP.photos && localP.photos.length > 0
                          ? localP.photos
                          : rp.photos || [],
                    };
                  }

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
                    stagePhoto1:
                      rp.stagePhoto1 !== undefined
                        ? rp.stagePhoto1
                        : localP.stagePhoto1,
                    stagePhoto2:
                      rp.stagePhoto2 !== undefined
                        ? rp.stagePhoto2
                        : localP.stagePhoto2,
                    stagePhotoUrl1:
                      rp.stagePhotoUrl1 !== undefined
                        ? rp.stagePhotoUrl1
                        : localP.stagePhotoUrl1,
                    stagePhotoUrl2:
                      rp.stagePhotoUrl2 !== undefined
                        ? rp.stagePhotoUrl2
                        : localP.stagePhotoUrl2,
                    stagePhotoUrl: rp.stagePhotoUrl || localP.stagePhotoUrl,
                    profileImageUrl:
                      rp.profileImageUrl || localP.profileImageUrl,
                    photoUrl: rp.photoUrl || localP.photoUrl,
                    playerPhoto: rp.playerPhoto || localP.playerPhoto,
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
                  updatedLocal.push(rp);
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

            matchedPlayers
              .sort((a, b) => (Number(a.playerIndex) || Number(a.playerNumber) || 0) - (Number(b.playerIndex) || Number(b.playerNumber) || 0))
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
            const lpPhotos = extractPlayerPhotos(lp);
            const combinedPhotos = Array.from(
              new Set([...pUidPhotos, ...lpPhotos])
            );
            const stage1 =
              (!isNonPlayerUrl(lp?.stagePhoto1) && lp?.stagePhoto1) ||
              (!isNonPlayerUrl(dbPlayer?.stagePhoto1) &&
                dbPlayer?.stagePhoto1) ||
              "";
            const stage2 =
              (!isNonPlayerUrl(lp?.stagePhoto2) && lp?.stagePhoto2) ||
              (!isNonPlayerUrl(dbPlayer?.stagePhoto2) &&
                dbPlayer?.stagePhoto2) ||
              "";
            const designatedStagePhoto =
              stage1 ||
              stage2 ||
              lp.stagePhotoUrl ||
              dbPlayer.stagePhotoUrl ||
              lp.profileImageUrl ||
              dbPlayer.profileImageUrl ||
              combinedPhotos[0] ||
              "";

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

          const stage1 =
            (!isNonPlayerUrl(dbPlayer?.stagePhoto1) && dbPlayer?.stagePhoto1) ||
            "";
          const stage2 =
            (!isNonPlayerUrl(dbPlayer?.stagePhoto2) && dbPlayer?.stagePhoto2) ||
            "";
          const designatedStagePhoto =
            stage1 ||
            stage2 ||
            dbPlayer.stagePhotoUrl ||
            dbPlayer.profileImageUrl ||
            pUidPrimary;

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

        // 로컬에 새로 추가된 엔트리 병합 (자동 생성된 그랑프리 엔트리는 assign에서 제외하되 final에는 포함)
        const extraFinalFromLocal = [];
        localPlayersMap.forEach((localPlayer, key) => {
          if (!mergedAssignPlayers.some((p) => getPlayerEntryKey(p) === key)) {
            const pUidPhotos =
              (localPlayer.playerUid &&
                saveUidPhotoMap.get(localPlayer.playerUid)) ||
              extractPlayerPhotos(localPlayer);
            const stage1 =
              (!isNonPlayerUrl(localPlayer.stagePhoto1) &&
                localPlayer.stagePhoto1) ||
              "";
            const stage2 =
              (!isNonPlayerUrl(localPlayer.stagePhoto2) &&
                localPlayer.stagePhoto2) ||
              "";
            const pUidPrimary =
              stage1 ||
              stage2 ||
              localPlayer.stagePhotoUrl ||
              pUidPhotos[0] ||
              localPlayer.profileImageUrl ||
              "";
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
              stagePhoto1: stage1,
              stagePhoto2: stage2,
              stagePhotoUrl1: stage1,
              stagePhotoUrl2: stage2,
              stagePhotoUrl: pUidPrimary,
              profileImageUrl: pUidPrimary,
              photoUrl: pUidPrimary,
              playerPhoto: pUidPrimary,
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
          const stage1 =
            (!isNonPlayerUrl(player.stagePhoto1) && player.stagePhoto1) || "";
          const stage2 =
            (!isNonPlayerUrl(player.stagePhoto2) && player.stagePhoto2) || "";
          const stagePhoto =
            stage1 ||
            stage2 ||
            player.stagePhotoUrl ||
            player.profileImageUrl ||
            pUidPhotos[0] ||
            "";

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
    setPlayersArray((prev) =>
      prev.map((p) => (isSamePhotoOwner(p) ? applyStageSlotsToPlayer(p) : p))
    );
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
                fp.contestCategoryTitle === "그랑프리")
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
      const isGradeChanged =
        updatedFields.isGradeChanged !== undefined
          ? !!updatedFields.isGradeChanged
          : !!p.isGradeChanged;

      return {
        ...p,
        ...updatedFields,
        originalGradeId: origGId,
        originalGradeTitle: origGTitle,
        isGradeChanged: isGradeChanged,
        contestGradeId: isGradeChanged
          ? updatedFields.contestGradeId || p.contestGradeId || origGId
          : origGId,
        contestGradeTitle: isGradeChanged
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
        Number(player.playerIndex) || Number(player.playerNumber) || 0,
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
        <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
          <ConfirmationModal
            isOpen={msgOpen}
            onConfirm={() => setMsgOpen(false)}
            onCancel={() => setMsgOpen(false)}
            message={message}
          />

          {/* 선수 번호/인덱스/신장·체중 수정 드로어 */}
          <Drawer
            placement="right"
            width={440}
            open={numModalOpen}
            onClose={() => {
              setNumModalOpen(false);
              setEditTargetKey(null);
            }}
            title={
              <div className="flex items-center gap-2 text-[#171717]">
                <Pencil size={16} strokeWidth={1.5} className="text-[#525252]" />
                <span className="text-sm font-semibold">
                  선수 번호 · 순서 · 신장/체중 수정
                </span>
              </div>
            }
            footer={
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setNumModalOpen(false);
                    setEditTargetKey(null);
                  }}
                >
                  취소
                </Button>
                <Button type="primary" onClick={applyNumberChange}>
                  적용
                </Button>
              </div>
            }
            destroyOnClose
          >
            <div className="flex flex-col gap-3.5 py-2">
              <div className="flex items-center justify-between text-sm text-[#525252] bg-[#f4f4f5] px-3.5 py-2.5 rounded-[8px] border border-[#171717]/[0.08]">
                <span>선수 성명</span>
                <span className="font-semibold text-[#171717]">
                  {editValues.playerName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#525252]">
                  배부 번호표 (playerNumber)
                </span>
                <InputNumber
                  min={1}
                  value={editValues.playerNumber}
                  onChange={(v) =>
                    setEditValues((prev) => ({ ...prev, playerNumber: v }))
                  }
                  className="w-40 h-9 rounded-[8px] font-mono tabular-nums"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#525252]">
                  표시 순서 (playerIndex)
                </span>
                <InputNumber
                  min={1}
                  value={editValues.playerIndex}
                  onChange={(v) =>
                    setEditValues((prev) => ({ ...prev, playerIndex: v }))
                  }
                  className="w-40 h-9 rounded-[8px] font-mono tabular-nums"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#525252]">
                  신장 / 체중 (cm / kg)
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex items-center">
                    <Input
                      value={editValues.height}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          height: e.target.value,
                        }))
                      }
                      placeholder="신장"
                      className="w-24 h-9 rounded-[8px] text-xs font-mono tabular-nums pr-6 text-center"
                    />
                    <span className="absolute right-2 text-[11px] text-[#737373] pointer-events-none">
                      cm
                    </span>
                  </div>
                  <span className="text-[#737373] text-xs">/</span>
                  <div className="relative flex items-center">
                    <Input
                      value={editValues.weight}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          weight: e.target.value,
                        }))
                      }
                      placeholder="체중"
                      className="w-24 h-9 rounded-[8px] text-xs font-mono tabular-nums pr-6 text-center"
                    />
                    <span className="absolute right-2 text-[11px] text-[#737373] pointer-events-none">
                      kg
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Drawer>

          {/* 선수 사진 확인 및 무대용 사진 1, 2 지정 드로어 */}
          <Drawer
            placement="right"
            width={720}
            open={photoModalOpen}
            onClose={() => {
              setPhotoModalOpen(false);
              setPhotoModalPlayer(null);
            }}
            title={
              <div className="flex items-center gap-2 text-[#171717]">
                <Image size={16} strokeWidth={1.5} className="text-[#525252]" />
                <span className="font-semibold text-sm text-[#171717]">
                  무대 송출용 사진 지정 ({photoModalPlayer?.playerName})
                </span>
              </div>
            }
            footer={null}
            destroyOnClose
          >
            {photoModalPlayer &&
              (() => {
                const photos = extractPlayerPhotos(photoModalPlayer);
                const stage1 =
                  (!isNonPlayerUrl(photoModalPlayer.stagePhoto1) &&
                    photoModalPlayer.stagePhoto1) ||
                  (!isNonPlayerUrl(photoModalPlayer.stagePhotoUrl1) &&
                    photoModalPlayer.stagePhotoUrl1) ||
                  "";
                const stage2 =
                  (!isNonPlayerUrl(photoModalPlayer.stagePhoto2) &&
                    photoModalPlayer.stagePhoto2) ||
                  (!isNonPlayerUrl(photoModalPlayer.stagePhotoUrl2) &&
                    photoModalPlayer.stagePhotoUrl2) ||
                  "";

                return (
                  <div className="flex flex-col gap-4 py-1">
                    {/* 선수 기본 정보 */}
                    <div className="flex items-center justify-between bg-[#f4f4f5] px-3.5 py-2.5 rounded-[8px] border border-[#171717]/[0.08] text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[#737373]">배부번호</span>
                        <BibTag
                          number={photoModalPlayer.playerNumber || "-"}
                          size="sm"
                        />
                        <span className="text-[#171717]/[0.15]">|</span>
                        <span className="text-[#737373]">소속</span>
                        <span className="font-medium text-[#171717]">
                          {photoModalPlayer.playerGym || "개인 / 무소속"}
                        </span>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#ffffff] border border-[#171717]/[0.08] text-[11px] font-medium text-[#525252] tabular-nums">
                        {photos.length > 0
                          ? `등록 사진 ${photos.length}장`
                          : "사진 미등록"}
                      </span>
                    </div>

                    {/* 1. 무대용 사진 1, 2 슬롯 섹션 */}
                    <div className="bg-[#f4f4f5] rounded-[12px] p-4 border border-[#171717]/[0.08] space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[#171717] font-semibold text-xs">
                          무대 공식 송출 지정 사진 (슬롯 1 · 슬롯 2)
                        </span>
                        <button
                          type="button"
                          onClick={handleSwapStageSlots}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#fafafa] text-[#171717] text-xs font-medium border border-[#171717]/[0.12] cursor-pointer transition-colors duration-150"
                        >
                          <ArrowLeftRight
                            size={14}
                            strokeWidth={1.5}
                            className="text-[#525252]"
                          />
                          <span>1번 · 2번 맞바꾸기</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* 슬롯 1: 무대용 사진 1 */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between px-0.5">
                            <span className="text-xs font-medium text-[#171717] flex items-center gap-1.5">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-[4px] bg-[#2563eb] text-white text-[10px] font-mono tabular-nums">
                                1
                              </span>
                              <span>무대용 사진 1 (전면 메인)</span>
                            </span>
                            {stage1 && (
                              <button
                                type="button"
                                onClick={() => handleClearStageSlot(1)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#dc2626]/[0.08] hover:bg-[#dc2626]/[0.14] text-[#dc2626] text-[11px] font-medium border border-[#dc2626]/20 cursor-pointer transition-colors duration-150"
                              >
                                <Trash2 size={12} strokeWidth={1.5} />
                                <span>비우기</span>
                              </button>
                            )}
                          </div>

                          {stage1 ? (
                            <div className="relative h-48 rounded-[8px] overflow-hidden bg-[#141415] border border-[#2563eb]/60 flex items-center justify-center">
                              <img
                                src={stage1}
                                alt="무대용 사진 1"
                                className="w-full h-full object-contain"
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center">
                                <span className="text-white text-[11px] font-medium">
                                  1번 전면 메인 송출용
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="h-48 rounded-[8px] border border-dashed border-[#171717]/[0.16] bg-[#ffffff] flex flex-col items-center justify-center p-4 text-center gap-1.5">
                              <Plus
                                size={18}
                                strokeWidth={1.5}
                                className="text-[#737373]"
                              />
                              <span className="text-xs font-medium text-[#525252]">
                                무대용 사진 1 비어 있음
                              </span>
                              <span className="text-[11px] text-[#737373]">
                                하단 갤러리에서 1번 지정을 선택하세요
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 슬롯 2: 무대용 사진 2 */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between px-0.5">
                            <span className="text-xs font-medium text-[#171717] flex items-center gap-1.5">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-[4px] bg-[#16a34a] text-white text-[10px] font-mono tabular-nums">
                                2
                              </span>
                              <span>무대용 사진 2 (배경 와이드)</span>
                            </span>
                            {stage2 && (
                              <button
                                type="button"
                                onClick={() => handleClearStageSlot(2)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#dc2626]/[0.08] hover:bg-[#dc2626]/[0.14] text-[#dc2626] text-[11px] font-medium border border-[#dc2626]/20 cursor-pointer transition-colors duration-150"
                              >
                                <Trash2 size={12} strokeWidth={1.5} />
                                <span>비우기</span>
                              </button>
                            )}
                          </div>

                          {stage2 ? (
                            <div className="relative h-48 rounded-[8px] overflow-hidden bg-[#141415] border border-[#16a34a]/60 flex items-center justify-center">
                              <img
                                src={stage2}
                                alt="무대용 사진 2"
                                className="w-full h-full object-contain"
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center">
                                <span className="text-white text-[11px] font-medium">
                                  2번 배경 와이드 송출용
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="h-48 rounded-[8px] border border-dashed border-[#171717]/[0.16] bg-[#ffffff] flex flex-col items-center justify-center p-4 text-center gap-1.5">
                              <Plus
                                size={18}
                                strokeWidth={1.5}
                                className="text-[#737373]"
                              />
                              <span className="text-xs font-medium text-[#525252]">
                                무대용 사진 2 비어 있음
                              </span>
                              <span className="text-[11px] text-[#737373]">
                                하단 갤러리에서 2번 지정을 선택하세요
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 2. 전체 선수 등록 사진 갤러리 */}
                    {photos.length === 0 ? (
                      <div className="p-8 text-center bg-[#fafafa] rounded-[12px] border border-dashed border-[#171717]/[0.14] space-y-1.5">
                        <Image
                          size={24}
                          strokeWidth={1.5}
                          className="text-[#737373] mx-auto"
                        />
                        <h3 className="text-sm font-medium text-[#525252] m-0">
                          참가신청서에 등록된 사진이 없습니다.
                        </h3>
                        <p className="text-xs text-[#737373] m-0">
                          상단의 사진데이터 갱신 버튼으로 신청서 원본과 동기화할 수 있습니다.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs text-[#525252] mb-2.5 flex items-center justify-between flex-wrap gap-1">
                          <span className="text-xs font-semibold text-[#171717] tabular-nums">
                            선수 등록 사진 갤러리 ({photos.length}장)
                          </span>
                          <span className="text-xs text-[#737373]">
                            1번 지정 또는 2번 지정 선택 시 즉시 저장됩니다
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto p-0.5">
                          {photos.map((imgUrl, i) => {
                            const isSlot1 = imgUrl === stage1;
                            const isSlot2 = imgUrl === stage2;

                            return (
                              <div
                                key={i}
                                className={`flex flex-col rounded-[8px] border overflow-hidden transition-colors duration-150 bg-[#ffffff] ${
                                  isSlot1
                                    ? "border-[#2563eb] ring-1 ring-[#2563eb]/30"
                                    : isSlot2
                                    ? "border-[#16a34a] ring-1 ring-[#16a34a]/30"
                                    : "border-[#171717]/[0.10] hover:border-[#171717]/[0.24]"
                                }`}
                              >
                                <div
                                  onClick={() => handleAssignStageSlot(imgUrl)}
                                  className="relative h-28 bg-[#141415] cursor-pointer flex items-center justify-center overflow-hidden"
                                >
                                  <img
                                    src={imgUrl}
                                    alt={`사진 ${i + 1}`}
                                    className="w-full h-full object-cover"
                                  />

                                  {isSlot1 && (
                                    <div className="absolute top-1.5 left-1.5 bg-[#2563eb] text-white text-[10px] font-medium px-1.5 py-0.5 rounded-[4px]">
                                      1번 지정됨
                                    </div>
                                  )}
                                  {isSlot2 && (
                                    <div className="absolute top-1.5 left-1.5 bg-[#16a34a] text-white text-[10px] font-medium px-1.5 py-0.5 rounded-[4px]">
                                      2번 지정됨
                                    </div>
                                  )}
                                </div>

                                {/* 1번 / 2번 직접 지정 버튼 */}
                                <div className="grid grid-cols-2 gap-1 p-1.5 bg-[#fafafa] border-t border-[#171717]/[0.06]">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetStageSlot(1, imgUrl);
                                    }}
                                    className={`h-7 px-1 rounded-[4px] text-[11px] font-medium transition-colors duration-150 cursor-pointer border ${
                                      isSlot1
                                        ? "bg-[#2563eb] text-white border-[#2563eb]"
                                        : "bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border-[#171717]/[0.10]"
                                    }`}
                                  >
                                    {isSlot1 ? "1번 완료" : "1번 지정"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetStageSlot(2, imgUrl);
                                    }}
                                    className={`h-7 px-1 rounded-[4px] text-[11px] font-medium transition-colors duration-150 cursor-pointer border ${
                                      isSlot2
                                        ? "bg-[#16a34a] text-white border-[#16a34a]"
                                        : "bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border-[#171717]/[0.10]"
                                    }`}
                                  >
                                    {isSlot2 ? "2번 완료" : "2번 지정"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 하단 액션 버튼 바 */}
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#171717]/[0.08] flex-wrap">
                      <div className="text-xs text-[#737373]">
                        선택된 1번·2번 사진이 무대 전광판 및 시상식 화면에 송출됩니다.
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoModalOpen(false);
                            setPhotoModalPlayer(null);
                          }}
                          className="inline-flex items-center justify-center px-4 h-9 rounded-[8px] text-xs font-medium text-[#171717] bg-[#f4f4f5] hover:bg-[#e4e4e7] border border-[#171717]/[0.08] transition-colors duration-150 cursor-pointer"
                        >
                          닫기
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmSavePhotoModal}
                          className="inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-[8px] font-medium text-xs text-white bg-[#2563eb] hover:bg-[#1d4ed8] transition-colors duration-150 cursor-pointer border-0"
                        >
                          <Save size={15} strokeWidth={1.5} />
                          <span>무대 송출 사진 확정 저장</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </Drawer>

          {/* 1. 상단 타이틀 & 실시간 계측 현황 카드 */}
          <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#f4f4f5] text-[#525252] border border-[#171717]/[0.08]">
                  <Scale size={13} strokeWidth={1.5} className="text-[#525252]" />
                  <span>2단계 계측 데스크</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#16a34a]/[0.08] text-[#16a34a] border border-[#16a34a]/20">
                  <StatusDot status="live" live />
                  <span>다중 데스크 실시간 자동 동기화</span>
                </span>
                {currentContest?.contests?.contestTitle && (
                  <span className="text-xs text-[#737373]">
                    {currentContest.contests.contestTitle}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-semibold text-[#171717] m-0 tracking-tight">
                선수 계측 및 월체·불참 관리
              </h1>
              <p className="text-xs text-[#737373] m-0">
                신장(cm) · 체중(kg) 분리 입력 및 다중 데스크 병합 저장
              </p>
            </div>

            {/* 계측 통계 & 액션 버튼 */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="min-w-[210px] bg-[#fafafa] px-3.5 py-2.5 rounded-[8px] border border-[#171717]/[0.08]">
                <div className="flex items-center justify-between text-xs font-medium text-[#525252] mb-1.5">
                  <span>출전 선수 현황</span>
                  <span className="font-mono tabular-nums font-semibold text-[#171717]">
                    {activePlayersCount} / {totalPlayersCount}명
                  </span>
                </div>
                <div className="w-full bg-[#e4e4e7] rounded-[4px] h-1.5 overflow-hidden">
                  <div
                    className="bg-[#16a34a] h-1.5 rounded-[4px] transition-all duration-300"
                    style={{
                      width: `${
                        totalPlayersCount > 0
                          ? Math.round(
                              (activePlayersCount / totalPlayersCount) * 100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#737373] mt-1.5 gap-3 tabular-nums">
                  <span>
                    출전{" "}
                    <strong className="font-semibold text-[#16a34a]">
                      {activePlayersCount}
                    </strong>
                    명
                  </span>
                  <span>
                    불참{" "}
                    <strong className="font-semibold text-[#dc2626]">
                      {noShowCount}
                    </strong>
                    명
                  </span>
                  <span>
                    월체{" "}
                    <strong className="font-semibold text-[#b45309]">
                      {gradeChangedCount}
                    </strong>
                    명
                  </span>
                </div>
              </div>

              {/* 저장 및 갱신/초기화 버튼 그룹 */}
              <div className="flex flex-wrap items-center gap-2">
                <ConfirmModalTrigger
                  variant="warning"
                  title="1단계 배정 기준 명단 갱신"
                  body="선수 번호 배정 단계의 최신 번호와 명단을 기준으로 계측 명단을 새로 갱신합니다."
                  body2="기존에 입력된 계측 기록(신장·체중·월체·불참)은 유지한 채 신규·변경 배정 내역만 동기화됩니다. 진행하시겠습니까?"
                  onConfirm={handleRefreshAndSyncAssign}
                  confirmText="명단 갱신 실행"
                  cancelText="취소"
                >
                  <button
                    type="button"
                    title="1단계 배정본 기준으로 명단 최신 갱신"
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] font-medium text-xs border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer"
                  >
                    <RefreshCw
                      size={15}
                      strokeWidth={1.5}
                      className="text-[#525252]"
                    />
                    <span>명단 갱신</span>
                  </button>
                </ConfirmModalTrigger>

                <ConfirmModalTrigger
                  variant="danger"
                  title="계측 데이터 초기화"
                  body="기존에 기록된 신장·체중, 월체, 불참 내역을 모두 비우고 1단계 선수 번호 배정 원본 상태로 되돌립니다."
                  body2="초기화된 계측 기록은 복구할 수 없습니다. 계속 진행하시겠습니까?"
                  onConfirm={handleForceResetToAssign}
                  confirmText="배정본으로 초기화"
                  cancelText="취소"
                >
                  <button
                    type="button"
                    title="기존 계측/월체 데이터를 지우고 1단계 번호 배정 원본으로 덮어씁니다."
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#dc2626]/[0.06] hover:bg-[#dc2626]/[0.12] text-[#dc2626] font-medium text-xs border border-[#dc2626]/25 transition-colors duration-150 cursor-pointer"
                  >
                    <AlertTriangle size={15} strokeWidth={1.5} />
                    <span>계측 초기화</span>
                  </button>
                </ConfirmModalTrigger>

                <button
                  type="button"
                  onClick={handleSyncCleanPhotoData}
                  disabled={isSyncingPhotos}
                  title="신청서 원본에서 선수 사진만 정밀 추출하여 계측 명단에 동기화합니다."
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] font-medium text-xs border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    size={15}
                    strokeWidth={1.5}
                    className={`text-[#525252] ${
                      isSyncingPhotos ? "animate-spin" : ""
                    }`}
                  />
                  <span>
                    {isSyncingPhotos ? "사진 정리 중..." : "사진데이터 갱신"}
                  </span>
                </button>

                {playersArray?.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdatePlayersFinal(
                        currentContest?.contests?.id,
                        currentContest?.contests?.contestPlayersAssignId,
                        currentContest?.contests?.contestPlayersFinalId,
                        playersArray
                      )
                    }
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-xs transition-colors duration-150 cursor-pointer border-0"
                  >
                    <Save size={16} strokeWidth={1.5} />
                    <span>계측 최종명단 저장</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/contesttimetable", { state: { tabId: 1 } })
                    }
                    className="inline-flex items-center justify-center h-9 px-3.5 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] font-medium text-xs border border-[#171717]/[0.10] transition-colors duration-150 cursor-pointer"
                  >
                    선수번호 배정 필요
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. 검색 & 부문 필터 & 상태 필터 바 */}
          <div className="bg-[#ffffff] rounded-[12px] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-[#171717]/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="w-full lg:w-80">
              <Input
                placeholder="선수명, 배부번호, 소속, 전화번호 뒤 4자리 검색"
                prefix={
                  <Search
                    size={15}
                    strokeWidth={1.5}
                    className="text-[#737373] mr-1"
                  />
                }
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                allowClear
                className="h-9 rounded-[8px] border-[#171717]/[0.14] text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 bg-[#f4f4f5] p-1 rounded-[8px]">
                {sectionOptions.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSelectedSection(sec)}
                    className={`h-7 px-2.5 rounded-[6px] text-xs font-medium transition-colors duration-150 border-0 cursor-pointer ${
                      selectedSection === sec
                        ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                        : "bg-transparent text-[#525252] hover:text-[#171717]"
                    }`}
                  >
                    {sec === "all" ? "전체 부문" : sec}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1 bg-[#f4f4f5] p-1 rounded-[8px] tabular-nums">
                <button
                  type="button"
                  onClick={() => setFilterWeighedStatus("all")}
                  className={`h-7 px-2.5 rounded-[6px] text-xs font-medium border-0 cursor-pointer transition-colors duration-150 ${
                    filterWeighedStatus === "all"
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "bg-transparent text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  전체 ({totalPlayersCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterWeighedStatus("active")}
                  className={`h-7 px-2.5 rounded-[6px] text-xs font-medium border-0 cursor-pointer transition-colors duration-150 ${
                    filterWeighedStatus === "active"
                      ? "bg-[#16a34a] text-white"
                      : "bg-transparent text-[#16a34a] hover:bg-[#16a34a]/[0.08]"
                  }`}
                >
                  정상출전 ({activePlayersCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterWeighedStatus("gradeChanged")}
                  className={`h-7 px-2.5 rounded-[6px] text-xs font-medium border-0 cursor-pointer transition-colors duration-150 ${
                    filterWeighedStatus === "gradeChanged"
                      ? "bg-[#b45309] text-white"
                      : "bg-transparent text-[#b45309] hover:bg-[#b45309]/[0.08]"
                  }`}
                >
                  월체 ({gradeChangedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterWeighedStatus("noshow")}
                  className={`h-7 px-2.5 rounded-[6px] text-xs font-medium border-0 cursor-pointer transition-colors duration-150 ${
                    filterWeighedStatus === "noshow"
                      ? "bg-[#dc2626] text-white"
                      : "bg-transparent text-[#dc2626] hover:bg-[#dc2626]/[0.08]"
                  }`}
                >
                  불참 ({noShowCount})
                </button>
              </div>

              <button
                type="button"
                onClick={fetchPool}
                title="최신 DB 동기화"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer"
              >
                <RefreshCw
                  size={14}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
                <span>새로고침</span>
              </button>
            </div>
          </div>

          {/* 3. 종목 및 체급별 선수 계측 테이블 목록 */}
          <div className="space-y-4">
            {filteredMatchedArray.length === 0 ? (
              <div className="bg-[#ffffff] rounded-[12px] p-12 text-center border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <p className="text-[#737373] font-medium text-sm m-0">
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
                } = matched;

                const gradeNoShowCount = matchedPlayers.filter(
                  (p) => p.playerNoShow
                ).length;

                return (
                  <div
                    key={mIdx}
                    className="bg-[#ffffff] rounded-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-[#171717]/[0.08] overflow-hidden"
                  >
                    {/* 체급 헤더 */}
                    <div className="bg-[#f4f4f5] px-5 py-3 border-b border-[#171717]/[0.08] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-[#171717] m-0">
                          {categoryTitle}
                          <span className="text-[#525252] font-normal mx-1.5">
                            /
                          </span>
                          <span className="text-[#171717] font-medium">
                            {gradeTitle}
                          </span>
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] bg-[#ffffff] border border-[#171717]/[0.08] text-xs font-medium text-[#525252] tabular-nums">
                          출전 {matchedPlayers.length - gradeNoShowCount} /{" "}
                          {matchedPlayers.length}명
                          {gradeNoShowCount > 0 && (
                            <span className="text-[#dc2626] ml-1">
                              (불참 {gradeNoShowCount}명)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* 데스크탑 테이블 */}
                    {!isMobile ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#171717]/[0.08] bg-[#fafafa] text-xs font-medium text-[#525252]">
                              <th className="py-2.5 px-3 w-14 text-center whitespace-nowrap">
                                순번
                              </th>
                              <th className="py-2.5 px-2 w-20 text-center whitespace-nowrap">
                                사진
                              </th>
                              <th className="py-2.5 px-3 w-28 text-center whitespace-nowrap">
                                선수번호
                              </th>
                              <th className="py-2.5 px-4 w-48 whitespace-nowrap">
                                선수 성명 / 상태
                              </th>
                              <th className="py-2.5 px-3 w-40 whitespace-nowrap">소속</th>
                              <th className="py-2.5 px-4 min-w-[330px] whitespace-nowrap">
                                신장(cm) / 체중(kg) 계측
                              </th>
                              <th className="py-2.5 px-3 w-16 text-center whitespace-nowrap">
                                월체
                              </th>
                              <th className="py-2.5 px-3 w-16 text-center whitespace-nowrap">
                                불참
                              </th>
                              <th className="py-2.5 px-3 w-24 min-w-[88px] text-center whitespace-nowrap">
                                관리
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#171717]/[0.06]">
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
                                const { height, weight } =
                                  parseHeightWeight(heightWeight);
                                const playerPhotos = extractPlayerPhotos(player);

                                return (
                                  <tr
                                    key={entryKey || playerUid}
                                    className={`transition-colors duration-150 ${
                                      playerNoShow
                                        ? "bg-[#dc2626]/[0.04]"
                                        : isWeighedIn
                                        ? "bg-[#16a34a]/[0.03] hover:bg-[#16a34a]/[0.06]"
                                        : "hover:bg-[#fafafa]"
                                    }`}
                                  >
                                    {/* 순번 */}
                                    <td className="py-3.5 px-3 text-center font-mono tabular-nums text-xs text-[#737373]">
                                      {pIdx + 1}
                                    </td>

                                    {/* 선수 사진 썸네일 */}
                                    <td className="py-3 px-2 text-center">
                                      {playerPhotos.length > 0 ? (
                                        <Tooltip title="클릭하여 무대 송출 사진 지정 및 갤러리 확인">
                                          <div
                                            onClick={() => {
                                              setPhotoModalPlayer(player);
                                              setPhotoModalOpen(true);
                                            }}
                                            className="relative inline-block cursor-pointer"
                                          >
                                            <img
                                              src={
                                                player.stagePhoto1 ||
                                                player.stagePhotoUrl1 ||
                                                player.stagePhotoUrl ||
                                                playerPhotos[0]
                                              }
                                              alt={playerName}
                                              className="w-10 h-10 rounded-[8px] object-cover border border-[#171717]/[0.14] mx-auto"
                                            />
                                            {playerPhotos.length > 1 && (
                                              <span className="absolute -bottom-1 -right-1 bg-[#171717] text-[10px] text-white font-mono tabular-nums px-1 py-0.2 rounded-[4px]">
                                                +{playerPhotos.length - 1}
                                              </span>
                                            )}
                                          </div>
                                        </Tooltip>
                                      ) : (
                                        <Tooltip title="사진 미등록 (클릭하여 확인)">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setPhotoModalPlayer(player);
                                              setPhotoModalOpen(true);
                                            }}
                                            className="w-10 h-10 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] border border-[#171717]/[0.08] text-[#737373] hover:text-[#171717] flex items-center justify-center cursor-pointer transition-colors duration-150 mx-auto"
                                          >
                                            <User
                                              size={16}
                                              strokeWidth={1.5}
                                            />
                                          </button>
                                        </Tooltip>
                                      )}
                                    </td>

                                    {/* 선수번호 뱃지 */}
                                    <td className="py-3.5 px-3 text-center">
                                      <BibTag
                                        number={playerNumber}
                                        variant={
                                          isWeighedIn && !playerNoShow
                                            ? "active"
                                            : "default"
                                        }
                                        size="md"
                                        className={
                                          playerNoShow
                                            ? "line-through opacity-50"
                                            : ""
                                        }
                                      />
                                    </td>

                                    {/* 선수 성명 & 불참/월체 상태 */}
                                    <td className="py-3.5 px-4">
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span
                                            className={`font-medium text-sm ${
                                              playerNoShow
                                                ? "text-[#dc2626] line-through"
                                                : "text-[#171717]"
                                            }`}
                                          >
                                            {playerName}
                                          </span>
                                          {isGradeChanged && !playerNoShow && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] border border-[#b45309]/20 text-[11px] font-medium">
                                              월체
                                            </span>
                                          )}
                                          {playerNoShow && (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.10] text-[#dc2626] border border-[#dc2626]/20 text-[11px] font-medium">
                                              불참
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    <td
                                      className={`py-3.5 px-3 text-sm ${
                                        playerNoShow
                                          ? "text-[#737373] line-through"
                                          : "text-[#525252]"
                                      }`}
                                    >
                                      {playerGym || "무소속 / 개인"}
                                    </td>

                                    {/* 신장(cm) / 체중(kg) 분리 입력란 + 저장 버튼 */}
                                    <td className="py-3.5 px-4">
                                      <div className="flex items-center gap-2">
                                        <div className="relative flex items-center">
                                          <Input
                                            value={height}
                                            disabled={playerNoShow}
                                            placeholder="신장"
                                            onFocus={() => {
                                              focusedPlayerKeyRef.current =
                                                entryKey;
                                            }}
                                            onBlur={() => {
                                              if (
                                                focusedPlayerKeyRef.current ===
                                                entryKey
                                              ) {
                                                focusedPlayerKeyRef.current =
                                                  null;
                                              }
                                            }}
                                            onChange={(e) =>
                                              handleHeightChange(
                                                entryKey,
                                                e.target.value
                                              )
                                            }
                                            className={`w-24 h-9 text-sm font-medium font-mono tabular-nums pr-7 text-center rounded-[8px] transition-colors duration-150 ${
                                              playerNoShow
                                                ? "bg-[#f4f4f5] text-[#737373] border-[#171717]/[0.08]"
                                                : "border-[#171717]/[0.14] focus:border-[#2563eb] bg-[#ffffff] text-[#171717]"
                                            }`}
                                          />
                                          <span className="absolute right-2 text-[11px] text-[#737373] pointer-events-none">
                                            cm
                                          </span>
                                        </div>

                                        <span className="text-[#737373] text-sm">
                                          /
                                        </span>

                                        <div className="relative flex items-center">
                                          <Input
                                            value={weight}
                                            disabled={playerNoShow}
                                            placeholder="체중"
                                            onFocus={() => {
                                              focusedPlayerKeyRef.current =
                                                entryKey;
                                            }}
                                            onBlur={() => {
                                              if (
                                                focusedPlayerKeyRef.current ===
                                                entryKey
                                              ) {
                                                focusedPlayerKeyRef.current =
                                                  null;
                                              }
                                            }}
                                            onChange={(e) =>
                                              handleWeightChange(
                                                entryKey,
                                                e.target.value
                                              )
                                            }
                                            className={`w-24 h-9 text-sm font-medium font-mono tabular-nums pr-7 text-center rounded-[8px] transition-colors duration-150 ${
                                              playerNoShow
                                                ? "bg-[#f4f4f5] text-[#737373] border-[#171717]/[0.08]"
                                                : "border-[#171717]/[0.14] focus:border-[#2563eb] bg-[#ffffff] text-[#171717]"
                                            }`}
                                          />
                                          <span className="absolute right-2 text-[11px] text-[#737373] pointer-events-none">
                                            kg
                                          </span>
                                        </div>

                                        <button
                                          type="button"
                                          disabled={playerNoShow}
                                          onClick={() =>
                                            handleSavePlayerWeighIn(player)
                                          }
                                          className={`inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-[8px] font-medium text-xs transition-colors duration-150 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                                            isWeighedIn && !playerNoShow
                                              ? "bg-[#16a34a]/[0.10] hover:bg-[#16a34a]/[0.16] text-[#16a34a] border border-[#16a34a]/25"
                                              : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white border border-transparent"
                                          }`}
                                        >
                                          {isWeighedIn && !playerNoShow ? (
                                            <>
                                              <Check
                                                size={14}
                                                strokeWidth={1.75}
                                              />
                                              <span>계측 완료</span>
                                            </>
                                          ) : (
                                            <>
                                              <Save
                                                size={14}
                                                strokeWidth={1.5}
                                              />
                                              <span>계측 저장</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </td>

                                    {/* 월체 체크 */}
                                    <td className="py-3.5 px-3 text-center">
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

                                    {/* 불참 체크박스 */}
                                    <td className="py-3.5 px-3 text-center">
                                      <Checkbox
                                        checked={playerNoShow}
                                        onChange={(e) =>
                                          handleNoShow(playerNumber, entryKey, e)
                                        }
                                      />
                                    </td>

                                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => openNumberModal(player)}
                                        className="inline-flex items-center justify-center gap-1 h-8 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#525252] hover:text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                                      >
                                        <Pencil
                                          size={13}
                                          strokeWidth={1.5}
                                          className="shrink-0"
                                        />
                                        <span className="whitespace-nowrap">수정</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* 모바일 카드 뷰 */
                      <div className="p-3 space-y-2.5">
                        {matchedPlayers
                          .sort((a, b) => a.playerIndex - b.playerIndex)
                          .map((player) => {
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
                            const { height, weight } =
                              parseHeightWeight(heightWeight);

                            return (
                              <div
                                key={entryKey || playerUid}
                                className={`p-3.5 rounded-[8px] border ${
                                  playerNoShow
                                    ? "bg-[#dc2626]/[0.04] border-[#dc2626]/25"
                                    : isWeighedIn
                                    ? "bg-[#16a34a]/[0.03] border-[#16a34a]/25"
                                    : "bg-[#ffffff] border-[#171717]/[0.08]"
                                } space-y-3`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {(() => {
                                      const mPhotos =
                                        extractPlayerPhotos(player);
                                      if (mPhotos.length > 0) {
                                        return (
                                          <img
                                            src={
                                              player.stagePhoto1 ||
                                              player.stagePhotoUrl1 ||
                                              player.stagePhotoUrl ||
                                              mPhotos[0]
                                            }
                                            alt={playerName}
                                            onClick={() => {
                                              setPhotoModalPlayer(player);
                                              setPhotoModalOpen(true);
                                            }}
                                            className="w-10 h-10 rounded-[8px] object-cover border border-[#171717]/[0.14] shrink-0 cursor-pointer"
                                          />
                                        );
                                      }
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPhotoModalPlayer(player);
                                            setPhotoModalOpen(true);
                                          }}
                                          className="w-10 h-10 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#737373] flex items-center justify-center shrink-0 cursor-pointer"
                                        >
                                          <User size={16} strokeWidth={1.5} />
                                        </button>
                                      );
                                    })()}
                                    <BibTag
                                      number={playerNumber}
                                      variant={
                                        isWeighedIn && !playerNoShow
                                          ? "active"
                                          : "default"
                                      }
                                      className={
                                        playerNoShow
                                          ? "line-through opacity-50"
                                          : ""
                                      }
                                    />
                                    <span
                                      className={`font-medium text-sm ${
                                        playerNoShow
                                          ? "line-through text-[#dc2626]"
                                          : "text-[#171717]"
                                      }`}
                                    >
                                      {playerName}
                                    </span>
                                    {isGradeChanged && !playerNoShow && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] text-[11px] font-medium">
                                        월체
                                      </span>
                                    )}
                                    {playerNoShow && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.10] text-[#dc2626] text-[11px] font-medium">
                                        불참
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openNumberModal(player)}
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#525252] border border-[#171717]/[0.12] cursor-pointer"
                                  >
                                    <Pencil size={14} strokeWidth={1.5} />
                                  </button>
                                </div>

                                <div className="text-xs text-[#525252]">
                                  소속: {playerGym || "개인 / 무소속"}
                                </div>

                                <div className="flex items-center gap-2 bg-[#fafafa] p-2.5 rounded-[8px] border border-[#171717]/[0.08]">
                                  <div className="relative flex-1 flex items-center">
                                    <Input
                                      value={height}
                                      disabled={playerNoShow}
                                      placeholder="신장"
                                      onFocus={() => {
                                        focusedPlayerKeyRef.current = entryKey;
                                      }}
                                      onBlur={() => {
                                        if (
                                          focusedPlayerKeyRef.current ===
                                          entryKey
                                        ) {
                                          focusedPlayerKeyRef.current = null;
                                        }
                                      }}
                                      onChange={(e) =>
                                        handleHeightChange(
                                          entryKey,
                                          e.target.value
                                        )
                                      }
                                      className="h-9 text-sm font-medium font-mono tabular-nums text-center pr-7 rounded-[8px] border-[#171717]/[0.14] bg-[#ffffff]"
                                    />
                                    <span className="absolute right-2 text-[11px] text-[#737373] pointer-events-none">
                                      cm
                                    </span>
                                  </div>
                                  <span className="text-[#737373] text-sm">
                                    /
                                  </span>
                                  <div className="relative flex-1 flex items-center">
                                    <Input
                                      value={weight}
                                      disabled={playerNoShow}
                                      placeholder="체중"
                                      onFocus={() => {
                                        focusedPlayerKeyRef.current = entryKey;
                                      }}
                                      onBlur={() => {
                                        if (
                                          focusedPlayerKeyRef.current ===
                                          entryKey
                                        ) {
                                          focusedPlayerKeyRef.current = null;
                                        }
                                      }}
                                      onChange={(e) =>
                                        handleWeightChange(
                                          entryKey,
                                          e.target.value
                                        )
                                      }
                                      className="h-9 text-sm font-medium font-mono tabular-nums text-center pr-7 rounded-[8px] border-[#171717]/[0.14] bg-[#ffffff]"
                                    />
                                    <span className="absolute right-2 text-[11px] text-[#737373] pointer-events-none">
                                      kg
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={playerNoShow}
                                    onClick={() =>
                                      handleSavePlayerWeighIn(player)
                                    }
                                    className={`inline-flex items-center justify-center gap-1 px-3 h-9 rounded-[8px] font-medium text-xs transition-colors duration-150 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                                      isWeighedIn && !playerNoShow
                                        ? "bg-[#16a34a]/[0.10] text-[#16a34a] border border-[#16a34a]/25"
                                        : "bg-[#2563eb] text-white border border-transparent"
                                    }`}
                                  >
                                    {isWeighedIn && !playerNoShow
                                      ? "계측 완료"
                                      : "계측 저장"}
                                  </button>
                                </div>

                                <div className="flex items-center justify-end gap-4 pt-2 border-t border-[#171717]/[0.06]">
                                  <label className="flex items-center gap-1.5 text-xs font-medium text-[#525252] cursor-pointer">
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

                                  <label className="flex items-center gap-1.5 text-xs font-medium text-[#dc2626] cursor-pointer">
                                    <Checkbox
                                      checked={playerNoShow}
                                      onChange={(e) =>
                                        handleNoShow(playerNumber, entryKey, e)
                                      }
                                    />
                                    <span>불참</span>
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
        </div>
      )}
    </div>
  );
};

export default ContestPlayerWeighInTable;
