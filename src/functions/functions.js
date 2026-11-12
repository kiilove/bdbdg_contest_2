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

  categories

    .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
    .map((category, cIdx) => {
      const matchedGrades = grades
        .filter((grade) => grade.refCategoryId === category.contestCategoryId)
        .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex);
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
      gradesMap[a.gradeId]?.contestGradeIndex ?? (a.contestGradeIndex ?? 999);
    const grdB =
      gradesMap[b.gradeId]?.contestGradeIndex ?? (b.contestGradeIndex ?? 999);
    return grdA - grdB;
  });

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
      (a, b) => (a.playerRank || 999) - (b.playerRank || 999)
    );

    players.forEach((p) => {
      summaryRows.push([
        overallIndex++,
        categoryTitle,
        gradeTitle,
        p.playerRank ?? "",
        p.playerNumber ?? "",
        p.playerName || "",
        p.playerGym || "",
        p.totalScore ?? "",
      ]);
    });
  });

  // 시트 2: 심사위원_상세집계표
  const detailRows = [
    [
      "순번",
      "종목명",
      "체급명",
      "순위",
      "배번호",
      "선수명",
      "소속",
      "심판1",
      "심판2",
      "심판3",
      "심판4",
      "심판5",
      "심판6",
      "심판7",
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
      (a, b) => (a.playerRank || 999) - (b.playerRank || 999)
    );

    players.forEach((p) => {
      const scores = p.score || [];
      const judgeScores = [
        scores[0]?.playerScore ?? "",
        scores[1]?.playerScore ?? "",
        scores[2]?.playerScore ?? "",
        scores[3]?.playerScore ?? "",
        scores[4]?.playerScore ?? "",
        scores[5]?.playerScore ?? "",
        scores[6]?.playerScore ?? "",
      ];

      detailRows.push([
        detailIndex++,
        categoryTitle,
        gradeTitle,
        p.playerRank ?? "",
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
    { wch: 8 },  // 순위
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
    { wch: 8 },  // 순위
    { wch: 8 },  // 배번호
    { wch: 14 }, // 선수명
    { wch: 24 }, // 소속
    { wch: 8 },  // 심판1
    { wch: 8 },  // 심판2
    { wch: 8 },  // 심판3
    { wch: 8 },  // 심판4
    { wch: 8 },  // 심판5
    { wch: 8 },  // 심판6
    { wch: 8 },  // 심판7
    { wch: 8 },  // 총점
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, "심사위원_상세집계표");

  const safeTitle = (contestTitle || "대회").replace(/[\\/:*?"<>|]/g, "_").trim();
  XLSX.writeFile(wb, `${safeTitle}_최종순위표.xlsx`);
};
