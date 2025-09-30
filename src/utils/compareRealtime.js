// src/utils/compareRealtime.js
// Firebase Realtime Database 안정 유틸 (compare 전용)

import {
  getDatabase,
  ref,
  runTransaction,
  update,
  serverTimestamp,
} from "firebase/database";

/** 숫자 안전 변환 */
export const toInt = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** judges 배열 -> seatIndex Map으로 정규화 */
export const toSeatMap = (arr = []) => {
  const map = {};
  arr.forEach((j) => {
    const seat = toInt(j?.seatIndex);
    if (!seat) return;
    map[String(seat)] = {
      seatIndex: seat,
      judgeUid: j?.judgeUid || null,
      judgeName: j?.judgeName || null,
      messageStatus: j?.messageStatus || "확인전",
      votedPlayerNumber: Array.isArray(j?.votedPlayerNumber)
        ? j.votedPlayerNumber
        : [],
      isLogined: !!j?.isLogined, // 호환 필드 있어도 안전
      isEnd: !!j?.isEnd,
    };
  });
  return map;
};

export const toPlayerKey = (p) =>
  `${toInt(p?.playerNumber)}::${p?.playerUid || ""}`;

export const uniqPlayers = (players = []) => {
  const seen = new Set();
  return players.filter((p) => {
    const k = toPlayerKey(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** 투표 집계 (judges Map -> [{playerNumber, playerUid, votedCount}]) */
export const countVotes = (judges = {}) => {
  const tally = {};
  Object.values(judges || {}).forEach((j) => {
    const list = Array.isArray(j?.votedPlayerNumber) ? j.votedPlayerNumber : [];
    list.forEach((v) => {
      const key = toPlayerKey(v);
      if (!tally[key]) {
        tally[key] = {
          playerNumber: toInt(v?.playerNumber),
          playerUid: v?.playerUid || null,
          votedCount: 0,
        };
      }
      tally[key].votedCount += 1;
    });
  });
  return Object.values(tally);
};

/** 동점 포함 TOP N 추출 */
export const pickTop = (voted = [], n) => {
  const N = toInt(n);
  if (N <= 0) return [];
  const sorted = [...voted].sort((a, b) => b.votedCount - a.votedCount);
  const base = sorted.slice(0, N);
  if (base.length === 0) return base;
  const last = base[base.length - 1].votedCount;
  let i = N;
  while (sorted[i] && sorted[i].votedCount === last) {
    base.push(sorted[i]);
    i++;
  }
  return base;
};

/** 내부: phase -> status 미러링(기존 코드 호환) */
const mirrorStatus = (phase) => {
  switch (phase) {
    case "voting":
      return {
        compareStart: true,
        compareEnd: false,
        compareCancel: false,
        compareIng: false,
      };
    case "in_progress":
      return {
        compareStart: false,
        compareEnd: false,
        compareCancel: false,
        compareIng: true,
      };
    case "ended":
      return {
        compareStart: false,
        compareEnd: true,
        compareCancel: false,
        compareIng: false,
      };
    case "canceled":
      return {
        compareStart: false,
        compareEnd: false,
        compareCancel: true,
        compareIng: false,
      };
    default:
      return {
        compareStart: false,
        compareEnd: false,
        compareCancel: false,
        compareIng: false,
      }; // idle
  }
};

/** 비교심사 시작 (phase=voting) */
export const startCompare = async ({
  contestId,
  index,
  playerLength,
  scoreMode,
  voteRange,
  judgesArray, // [{seatIndex, judgeUid?, judgeName?}]
  updatedBy, // {uid, name} | optional
}) => {
  const db = getDatabase();
  const comparesRef = ref(db, `currentStage/${contestId}/compares`);
  await runTransaction(comparesRef, (prev) => {
    const phase = "voting";
    return {
      ...(prev || {}),
      index: toInt(index, 1),
      phase,
      status: mirrorStatus(phase),
      settings: {
        playerLength: toInt(playerLength, 3),
        scoreMode: scoreMode || "all",
        voteRange: voteRange || "all",
      },
      judges: toSeatMap(judgesArray || []),
      players: null,
      version: (prev?.version || 0) + 1,
      lastUpdatedAt: serverTimestamp(),
      updatedBy: updatedBy || null,
    };
  });
};

/** 명단 확정 -> 진행중 (phase=in_progress) + history 스냅샷 */
export const confirmCompare = async ({
  contestId,
  index,
  selectedPlayers, // [{playerNumber, playerUid}]
  updatedBy,
}) => {
  const db = getDatabase();
  const basePath = `currentStage/${contestId}/compares`;
  const currentRef = ref(db, `${basePath}`);
  await runTransaction(currentRef, (prev) => {
    const phase = "in_progress";
    const cleanPlayers = uniqPlayers(selectedPlayers || []).map((p) => ({
      playerNumber: toInt(p?.playerNumber),
      playerUid: p?.playerUid || null,
    }));
    const next = {
      ...(prev || {}),
      index: toInt(index, 1),
      phase,
      status: mirrorStatus(phase),
      players: cleanPlayers,
      version: (prev?.version || 0) + 1,
      lastUpdatedAt: serverTimestamp(),
      updatedBy: updatedBy || null,
    };
    return next;
  });

  // history/{index} 스냅샷 저장 (멀티 업데이트)
  const snapRef = ref(db, `${basePath}`);
  const histRef = ref(db, `${basePath}/history/${toInt(index, 1)}`);
  await update(ref(db), {
    [`${basePath}/history/${toInt(index, 1)}`]: {
      index: toInt(index, 1),
      phase: "in_progress",
      settings: (await (async () => null)()) || undefined, // 필요시 별도로 합쳐서 넣기
      judges: undefined, // 필요시 prev를 읽어 합쳐서 저장
      players: uniqPlayers(selectedPlayers || []).map((p) => ({
        playerNumber: toInt(p?.playerNumber),
        playerUid: p?.playerUid || null,
      })),
      lastUpdatedAt: serverTimestamp(),
      updatedBy: updatedBy || null,
    },
  });
};

/** 비교심사 취소 (phase=canceled) */
export const cancelCompare = async ({ contestId, updatedBy }) => {
  const db = getDatabase();
  const comparesRef = ref(db, `currentStage/${contestId}/compares`);
  await runTransaction(comparesRef, (prev) => {
    const phase = "canceled";
    return {
      ...(prev || {}),
      phase,
      status: mirrorStatus(phase),
      // players는 비움
      players: null,
      version: (prev?.version || 0) + 1,
      lastUpdatedAt: serverTimestamp(),
      updatedBy: updatedBy || null,
    };
  });
};
