import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";

export const generateUUID = () => {
  const uuid = uuidv4();
  return uuid;
};

export const generateToday = () => {
  const currentDateTime = dayjs().format("YYYY-MM-DD HH:mm");
  return currentDateTime;
};

export const matchingCategoriesWithGrades = (categories, grades) => {
  let dummy = [];

  (categories || [])
    .sort(
      (a, b) =>
        (a.contestCategoryIndex ?? 0) - (b.contestCategoryIndex ?? 0)
    )
    .map((category, cIdx) => {
      const matchedGrades = (grades || [])
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
  let filteredPlayers;
  if (contestId === "" || gradeId === "" || players.length === 0) {
    filteredPlayers = [];
  }

  filteredPlayers = players
    .filter((f) => f.contestId === contestId && f.contestGradeId === gradeId)
    .sort((a, b) => a.playerIndex - b.playerIndex);

  return filteredPlayers;
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

  // 1. 종목/체급 인덱스 기준 정렬
  const sortedResults = [...resultsList].sort((a, b) => {
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

  // 최대 심판 좌석 수(maxSeat) 동적 계산 (기본 7심, 9심 이상도 자동 지원)
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
  const maxSeat = Math.max(7, detectedMaxSeat > 7 ? Math.max(9, detectedMaxSeat) : 7);

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
