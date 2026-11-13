import { collection, getDocs, query, where } from "firebase/firestore";
import {
  extractPlayerPhotos,
  extractUrlFromStringOrObject,
  isNonPlayerUrl,
} from "./playerPhotoUtils.js";

/**
 * 대회 신청서/엔트리/참가자 풀에서 선수 사진 및 지정 슬롯(stagePhoto1/2), 원체급 정보를 일괄 수집하는 유틸리티
 */
export const fetchContestPhotoPool = async ({
  db,
  contestId,
  includePlayersList = false,
}) => {
  const uidPhotosMap = new Map();
  const stage1Map = new Map();
  const stage2Map = new Map();
  const namePhonePhotosMap = new Map();
  const nameOnlyPhotosMap = new Map();
  const entryOriginalGradeMap = new Map();
  const counts = {
    invoices: 0,
    entries: 0,
    contestInvoices: 0,
    playersList: 0,
  };

  if (!db || !contestId) {
    return {
      uidPhotosMap,
      stage1Map,
      stage2Map,
      namePhonePhotosMap,
      nameOnlyPhotosMap,
      entryOriginalGradeMap,
      counts,
    };
  }

  const filterValid = (u) => (u && !isNonPlayerUrl(u) ? u : "");

  const collectDocPhotos = (docData) => {
    if (!docData) return;
    const photos = extractPlayerPhotos(docData);
    const rawName = (
      docData.playerName ||
      docData.contestPlayerName ||
      docData.name ||
      ""
    ).trim();
    const rawTel =
      docData.playerTel ||
      docData.contestPlayerPhoneNumber ||
      docData.phone ||
      "";
    const telPart = String(rawTel).replace(/[^0-9]/g, "").slice(-4);

    if (photos.length > 0) {
      if (docData.playerUid) {
        const existing = uidPhotosMap.get(docData.playerUid) || [];
        uidPhotosMap.set(
          docData.playerUid,
          Array.from(new Set([...existing, ...photos]))
        );
      }
      if (rawName) {
        if (telPart) {
          const nameKey = `${rawName}_${telPart}`;
          const existingByName = namePhonePhotosMap.get(nameKey) || [];
          namePhonePhotosMap.set(
            nameKey,
            Array.from(new Set([...existingByName, ...photos]))
          );
        }
        const existingNameOnly = nameOnlyPhotosMap.get(rawName) || [];
        nameOnlyPhotosMap.set(
          rawName,
          Array.from(new Set([...existingNameOnly, ...photos]))
        );
      }
    }

    const s1 =
      filterValid(docData.stagePhoto1) || filterValid(docData.stagePhotoUrl1);
    const s2 =
      filterValid(docData.stagePhoto2) || filterValid(docData.stagePhotoUrl2);
    const selectedList = extractUrlFromStringOrObject(
      docData.selectedPhotoUrls || docData.selectedPhotoUrlsJson
    );
    const sel1 = s1 || filterValid(selectedList[0]);
    const sel2 = s2 || filterValid(selectedList[1]);

    if (sel1 || sel2) {
      if (docData.playerUid) {
        if (sel1) stage1Map.set(docData.playerUid, sel1);
        if (sel2) stage2Map.set(docData.playerUid, sel2);
      }
      if (rawName) {
        if (telPart) {
          const nameKey = `${rawName}_${telPart}`;
          if (sel1) stage1Map.set(nameKey, sel1);
          if (sel2) stage2Map.set(nameKey, sel2);
        }
        if (sel1) stage1Map.set(rawName, sel1);
        if (sel2) stage2Map.set(rawName, sel2);
      }
    }
  };

  const safeQueryCollection = async (colName) => {
    try {
      const snap = await getDocs(
        query(collection(db, colName), where("contestId", "==", contestId))
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn(`${colName} 조회 오류:`, err);
      return [];
    }
  };

  const [invoices, entries, contestInvoices, playersList] = await Promise.all([
    safeQueryCollection("invoices_pool"),
    safeQueryCollection("contest_entrys_list"),
    safeQueryCollection("contest_invoices_list"),
    includePlayersList
      ? safeQueryCollection("contest_players_list")
      : Promise.resolve([]),
  ]);

  counts.invoices = invoices.length;
  counts.entries = entries.length;
  counts.contestInvoices = contestInvoices.length;
  counts.playersList = playersList.length;

  invoices.forEach(collectDocPhotos);
  entries.forEach((data) => {
    collectDocPhotos(data);
    const uid = data.playerUid || "";
    const catId = data.contestCategoryId || "";
    const rawName = (
      data.playerName ||
      data.contestPlayerName ||
      data.name ||
      ""
    ).trim();
    const gId = data.contestGradeId || "";
    const gTitle = data.contestGradeTitle || "";
    if (gId) {
      if (uid && catId) {
        entryOriginalGradeMap.set(`${uid}_${catId}`, {
          contestGradeId: gId,
          contestGradeTitle: gTitle,
        });
      }
      if (rawName && catId) {
        entryOriginalGradeMap.set(`${rawName}_${catId}`, {
          contestGradeId: gId,
          contestGradeTitle: gTitle,
        });
      }
    }
  });
  contestInvoices.forEach(collectDocPhotos);
  playersList.forEach(collectDocPhotos);

  return {
    uidPhotosMap,
    stage1Map,
    stage2Map,
    namePhonePhotosMap,
    nameOnlyPhotosMap,
    entryOriginalGradeMap,
    counts,
  };
};
