import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { dedupeContestResultsByGrade } from "../utils/contestResultsUtils.js";

export const generateUUID = () => {
  const uuid = uuidv4();
  return uuid;
};

export const generateToday = () => {
  const currentDateTime = dayjs().format("YYYY-MM-DD HH:mm");
  return currentDateTime;
};

export const matchingCategoriesWithGrades = (categories, grades) => {
  const dummy = [];

  [...(categories || [])]
    .sort(
      (a, b) =>
        (a.contestCategoryIndex ?? 0) - (b.contestCategoryIndex ?? 0)
    )
    .forEach((category) => {
      const matchedGrades = [...(grades || [])]
        .filter((grade) => grade.refCategoryId === category.contestCategoryId)
        .sort(
          (a, b) =>
            (a.contestGradeIndex ?? a.gradeIndex ?? 0) -
            (b.contestGradeIndex ?? b.gradeIndex ?? 0)
        );
      const newCategoryItem = { ...category, grades: [...matchedGrades] };
      dummy.push({ ...newCategoryItem });
    });

  return dummy;
};

export const matchedGradewWithPlayers = (
  contestId = "",
  gradeId = "",
  players = []
) => {
  if (!gradeId || !Array.isArray(players) || players.length === 0) {
    return [];
  }

  return players
    .filter(
      (f) =>
        f?.playerNoShow !== true &&
        (!contestId || !f?.contestId || f.contestId === contestId) &&
        f?.contestGradeId === gradeId
    )
    .sort((a, b) => getStagePlayerSortIndex(a) - getStagePlayerSortIndex(b));
};

export function getRandomNumber(min, max) {
  // min과 max 사이의 임의의 소수를 얻고, 그 소수를 min과 max 사이의 범위로 변환합니다.
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 대회 최종 결과(contest_results_list)를 엑셀 파일(.xlsx)로 다운로드하는 유틸 함수
 * 편집 및 가공하기 가장 좋은 순수 테이블 형태로 출력합니다.
 */
export const exportContestResultsToExcel = async (
  contestTitle = "대회",
  resultsList = [],
  categoriesMap = {},
  gradesMap = {}
) => {
  const XLSX = await import("xlsx");
  if (!resultsList || resultsList.length === 0) {
    alert("다운로드할 집계 데이터가 없습니다.");
    return;
  }

  const dedupedResults = dedupeContestResultsByGrade(resultsList);
  const effectiveResults =
    dedupedResults.length > 0 ? dedupedResults : [...resultsList];

  // 1. 종목/체급 인덱스 기준 정렬
  const sortedResults = [...effectiveResults].sort((a, b) => {
    const catA =
      categoriesMap[a.categoryId]?.contestCategoryIndex ??
      (a.contestCategoryIndex ?? 999);
    const catB =
      categoriesMap[b.categoryId]?.contestCategoryIndex ??
      (b.contestCategoryIndex ?? 999);
    if (catA !== catB) return catA - catB;

    const grdA =
      gradesMap[a.gradeId]?.contestGradeIndex ??
      gradesMap[a.gradeId]?.gradeIndex ??
      a.contestGradeIndex ??
      999;
    const grdB =
      gradesMap[b.gradeId]?.contestGradeIndex ??
      gradesMap[b.gradeId]?.gradeIndex ??
      b.contestGradeIndex ??
      999;
    return grdA - grdB;
  });

  // 최대 심판 좌석 수(maxSeat) 동적 계산 (5심/7심/9심 등 정확히 대응)
  let detectedMaxSeat = 0;
  sortedResults.forEach((res) => {
    (res.result || []).forEach((p) => {
      const scores = p.score || [];
      if (scores.length > detectedMaxSeat) {
        detectedMaxSeat = scores.length;
      }
      scores.forEach((s) => {
        const seatNum = Number(s?.seatIndex);
        if (Number.isFinite(seatNum) && seatNum > detectedMaxSeat) {
          detectedMaxSeat = seatNum;
        }
      });
    });
  });
  const maxSeat =
    detectedMaxSeat <= 5 ? 5 : detectedMaxSeat <= 7 ? 7 : detectedMaxSeat;

  const formatPlayerRank = (rank) => {
    if (rank === undefined || rank === null || rank === "") return "";
    return Number(rank) >= 1000 ? "순위제외" : rank;
  };

  // 시트 1: 최종순위표 (편집 최적화 순수 테이블)
  const summaryRows = [
    [
      "순번",
      "종목명",
      "체급명",
      "순위",
      "배번호",
      "선수명",
      "소속",
      "총점",
    ],
  ];

  let overallIndex = 1;
  sortedResults.forEach((res) => {
    const categoryTitle =
      res.categoryTitle || res.contestCategoryTitle || "미지정 종목";
    const gradeTitle =
      res.gradeTitle || res.contestGradeTitle || "미지정 체급";
    const players = [...(res.result || [])].sort(
      (a, b) => (a.playerRank ?? 9999) - (b.playerRank ?? 9999)
    );

    players.forEach((p) => {
      summaryRows.push([
        overallIndex++,
        categoryTitle,
        gradeTitle,
        formatPlayerRank(p.playerRank),
        p.playerNumber ?? "",
        p.playerName || "",
        p.playerGym || "",
        p.totalScore ?? "",
      ]);
    });
  });

  // 시트 2: 심사위원_상세집계표
  const judgeHeaders = Array.from(
    { length: maxSeat },
    (_, idx) => `심판${idx + 1}`
  );
  const detailRows = [
    [
      "순번",
      "종목명",
      "체급명",
      "순위",
      "배번호",
      "선수명",
      "소속",
      ...judgeHeaders,
      "총점",
    ],
  ];

  let detailIndex = 1;
  sortedResults.forEach((res) => {
    const categoryTitle =
      res.categoryTitle || res.contestCategoryTitle || "미지정 종목";
    const gradeTitle =
      res.gradeTitle || res.contestGradeTitle || "미지정 체급";
    const players = [...(res.result || [])].sort(
      (a, b) => (a.playerRank ?? 9999) - (b.playerRank ?? 9999)
    );

    players.forEach((p) => {
      const scores = p.score || [];
      const hasSeatIndex = scores.some(
        (s) =>
          s?.seatIndex !== undefined &&
          s?.seatIndex !== null &&
          !Number.isNaN(Number(s.seatIndex))
      );
      const judgeScores = Array.from({ length: maxSeat }, (_, idx) => {
        const seat = idx + 1;
        const matched = hasSeatIndex
          ? scores.find((s) => Number(s?.seatIndex) === seat)
          : scores[idx];
        return matched?.playerScore ?? "";
      });

      detailRows.push([
        detailIndex++,
        categoryTitle,
        gradeTitle,
        formatPlayerRank(p.playerRank),
        p.playerNumber ?? "",
        p.playerName || "",
        p.playerGym || "",
        ...judgeScores,
        p.totalScore ?? "",
      ]);
    });
  });

  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [
    { wch: 6 },  // 순번
    { wch: 25 }, // 종목명
    { wch: 18 }, // 체급명
    { wch: 10 }, // 순위
    { wch: 8 },  // 배번호
    { wch: 14 }, // 선수명
    { wch: 24 }, // 소속
    { wch: 8 },  // 총점
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, "최종순위표");

  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail["!cols"] = [
    { wch: 6 },  // 순번
    { wch: 25 }, // 종목명
    { wch: 18 }, // 체급명
    { wch: 10 }, // 순위
    { wch: 8 },  // 배번호
    { wch: 14 }, // 선수명
    { wch: 24 }, // 소속
    ...Array.from({ length: maxSeat }, () => ({ wch: 8 })),
    { wch: 8 },  // 총점
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, "심사위원_상세집계표");

  const safeTitle = (contestTitle || "대회").replace(/[\\/:*?"<>|]/g, "_").trim();
  XLSX.writeFile(wb, `${safeTitle}_최종순위표.xlsx`);
};

/**
 * 해당 선수 엔트리(또는 무대/종목 컨텍스트)가 '그랑프리' 소속인지 엄격 판별
 * - 일반 종목(1부, 2부 등) 엔트리에는 절대 true를 반환하지 않음
 */
export const isGrandPrixPlayerEntry = (player, contextMeta = null) => {
  const section = String(
    contextMeta?.contestCategorySection ??
      contextMeta?.categorySection ??
      player?.contestCategorySection ??
      ""
  ).trim();
  const catTitle = String(
    contextMeta?.contestCategoryTitle ??
      contextMeta?.categoryTitle ??
      player?.contestCategoryTitle ??
      ""
  ).trim();

  return (
    section === "그랑프리" ||
    catTitle === "그랑프리" ||
    catTitle.includes("그랑프리")
  );
};

/**
 * 무대/출전명단 정렬 인덱스 계산
 * - 오직 '그랑프리' 엔트리에만 grandPrixIndex 우선 적용
 * - 일반 종목은 기존과 100% 동일하게 playerIndex만 사용 (월체 후순위 등 완전 유지)
 */
export const getStagePlayerSortIndex = (player, contextMeta = null) => {
  if (isGrandPrixPlayerEntry(player, contextMeta)) {
    return Number(player?.grandPrixIndex ?? player?.playerIndex ?? 0);
  }
  return Number(player?.playerIndex ?? 0);
};

/**
 * 현재 진행 무대(targetStage)가 '그랑프리'인 경우,
 * 해당 무대에 속한 체급(grades) 선수들의 이전 playerIndex를 playerIndexOriginal에 보존하고
 * playerIndex를 grandPrixIndex로 덮어씌운 새로운 players 배열을 반환합니다.
 * - 심판 태블릿(grandPrixIndex 미지원, playerIndex 정렬)과 완벽 호환을 보장합니다.
 * - 일반 종목(1부, 2부 등) 무대일 경우 절대 수정하지 않고 즉시 { players, changed: false }를 반환합니다.
 * - playerIndexOriginal이 이미 존재하는 엔트리는 기존 값을 덮어쓰지 않고 그대로 유지(멱등성 보장)합니다.
 */
export const syncGrandPrixPlayerIndexForStage = (
  players = [],
  targetStage = null,
  categoriesArray = []
) => {
  if (!Array.isArray(players) || players.length === 0 || !targetStage) {
    return {
      players: Array.isArray(players) ? players : [],
      changed: false,
      syncedCount: 0,
      isGrandPrixStage: false,
    };
  }

  const matchedCat = Array.isArray(categoriesArray)
    ? categoriesArray.find(
        (c) =>
          c?.contestCategoryId &&
          c.contestCategoryId === targetStage?.categoryId
      )
    : null;

  const isGrandPrixStage =
    isGrandPrixPlayerEntry(null, targetStage) ||
    (matchedCat ? isGrandPrixPlayerEntry(null, matchedCat) : false);

  if (!isGrandPrixStage) {
    return {
      players,
      changed: false,
      syncedCount: 0,
      isGrandPrixStage: false,
    };
  }

  const stageGradeIds = new Set(
    [
      ...(Array.isArray(targetStage?.grades)
        ? targetStage.grades.map((g) => g?.gradeId || g?.contestGradeId)
        : []),
      targetStage?.gradeId,
    ].filter(Boolean)
  );

  if (stageGradeIds.size === 0) {
    return {
      players,
      changed: false,
      syncedCount: 0,
      isGrandPrixStage: true,
    };
  }

  // 원체급(일반 종목) 엔트리의 playerIndex 조회용 맵 (이전 저장본에 playerIndexOriginal이 없던 경우 복원용)
  const regularIndexByGradeAndKey = new Map();
  players.forEach((p) => {
    if (!p || isGrandPrixPlayerEntry(p)) return;
    if (p.contestGradeId && p.playerIndex !== undefined && p.playerIndex !== null) {
      if (p.playerUid) {
        regularIndexByGradeAndKey.set(
          `${p.contestGradeId}__uid:${p.playerUid}`,
          p.playerIndex
        );
      }
      if (p.playerNumber !== undefined && p.playerNumber !== null) {
        regularIndexByGradeAndKey.set(
          `${p.contestGradeId}__num:${p.playerNumber}`,
          p.playerIndex
        );
      }
    }
  });

  const resolveOriginalPlayerIndex = (p) => {
    if (p?.playerIndexOriginal !== undefined && p?.playerIndexOriginal !== null) {
      return p.playerIndexOriginal;
    }
    if (
      p?.originalGradeId &&
      p.originalGradeId !== p.contestGradeId
    ) {
      const byUid = p.playerUid
        ? regularIndexByGradeAndKey.get(
            `${p.originalGradeId}__uid:${p.playerUid}`
          )
        : undefined;
      if (byUid !== undefined) return byUid;
      const byNum =
        p.playerNumber !== undefined && p.playerNumber !== null
          ? regularIndexByGradeAndKey.get(
              `${p.originalGradeId}__num:${p.playerNumber}`
            )
          : undefined;
      if (byNum !== undefined) return byNum;
    }
    if (p?.playerIndex !== undefined && p?.playerIndex !== null) {
      return p.playerIndex;
    }
    return p?.playerNumber ?? null;
  };

  const patchesByArrIdx = new Map();

  stageGradeIds.forEach((gId) => {
    const entriesWithIdx = [];
    players.forEach((p, arrIdx) => {
      if (p && p.contestGradeId === gId) {
        entriesWithIdx.push({ player: p, arrIdx });
      }
    });

    if (entriesWithIdx.length === 0) return;

    entriesWithIdx.sort((a, b) => {
      const pa = a.player;
      const pb = b.player;
      const aHasGp =
        pa?.grandPrixIndex !== undefined &&
        pa?.grandPrixIndex !== null &&
        Number.isFinite(Number(pa.grandPrixIndex)) &&
        Number(pa.grandPrixIndex) > 0;
      const bHasGp =
        pb?.grandPrixIndex !== undefined &&
        pb?.grandPrixIndex !== null &&
        Number.isFinite(Number(pb.grandPrixIndex)) &&
        Number(pb.grandPrixIndex) > 0;

      if (aHasGp && bHasGp) {
        const gpDiff = Number(pa.grandPrixIndex) - Number(pb.grandPrixIndex);
        if (gpDiff !== 0) return gpDiff;
      } else if (aHasGp !== bHasGp) {
        return aHasGp ? -1 : 1;
      }

      const origGradeDiff =
        Number(pa?.originalGradeIndex ?? 9999) -
        Number(pb?.originalGradeIndex ?? 9999);
      if (origGradeDiff !== 0) return origGradeDiff;

      const origIdxDiff =
        Number(resolveOriginalPlayerIndex(pa) ?? 9999) -
        Number(resolveOriginalPlayerIndex(pb) ?? 9999);
      if (origIdxDiff !== 0) return origIdxDiff;

      return Number(pa?.playerNumber || 0) - Number(pb?.playerNumber || 0);
    });

    entriesWithIdx.forEach(({ player: p, arrIdx }, sortedIdx) => {
      const gpIdx = sortedIdx + 1;
      const preservedOriginal = resolveOriginalPlayerIndex(p);
      patchesByArrIdx.set(arrIdx, {
        ...p,
        playerIndexOriginal: preservedOriginal,
        grandPrixIndex: gpIdx,
        playerIndex: gpIdx,
        isGradeChange: false,
        isGradeChanged: false,
      });
    });
  });

  if (patchesByArrIdx.size === 0) {
    return {
      players,
      changed: false,
      syncedCount: 0,
      isGrandPrixStage: true,
    };
  }

  let changed = false;
  const nextPlayers = players.map((p, arrIdx) => {
    const patched = patchesByArrIdx.get(arrIdx);
    if (!patched) return p;
    if (
      p.playerIndex !== patched.playerIndex ||
      p.grandPrixIndex !== patched.grandPrixIndex ||
      p.playerIndexOriginal !== patched.playerIndexOriginal ||
      Boolean(p.isGradeChange) !== false ||
      Boolean(p.isGradeChanged) !== false
    ) {
      changed = true;
      return patched;
    }
    return p;
  });

  return {
    players: changed ? nextPlayers : players,
    changed,
    syncedCount: patchesByArrIdx.size,
    isGrandPrixStage: true,
  };
};
