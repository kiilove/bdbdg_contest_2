import { isActiveStagePlayer } from "./playerEntryUtils.js";

/**
 * 무대(Stage) 편성 시 대표 체급(grades[0]) 기준 종목 메타데이터 및 출전 인원 동기화 순수 유틸리티
 * - 무대 분할(split), 병합(merge), 드래그 이동(onDragEnd), 종목 새로고침(refresh) 모든 경로에서
 *   categoryJudgeCount, categorySection, categoryJudgeType, categoryIsOverall, playerCount 누락을 원천 차단합니다.
 */
export const buildStageWithSyncedMetadata = (
  baseStage = {},
  nextGrades = [],
  categoriesArray = [],
  playersArray = null
) => {
  const safeGrades = (Array.isArray(nextGrades) ? nextGrades : []).map((g) => {
    const gId = g?.gradeId || g?.contestGradeId || "";
    const hasLivePlayers = Array.isArray(playersArray);
    const livePlayerCount =
      hasLivePlayers && gId
        ? playersArray.filter(
            (p) => p?.contestGradeId === gId && isActiveStagePlayer(p)
          ).length
        : Number.parseInt(g?.playerCount ?? 0, 10) || 0;

    return {
      ...g,
      gradeId: gId,
      playerCount: livePlayerCount,
    };
  });

  const primaryGrade = safeGrades[0] || {};
  const matchedCat = (Array.isArray(categoriesArray) ? categoriesArray : []).find(
    (c) =>
      c?.contestCategoryId &&
      c.contestCategoryId ===
        (primaryGrade.categoryId ||
          primaryGrade.refCategoryId ||
          baseStage.categoryId)
  );

  return {
    ...baseStage,
    categoryId:
      matchedCat?.contestCategoryId ??
      primaryGrade.categoryId ??
      baseStage.categoryId ??
      "",
    categoryTitle:
      matchedCat?.contestCategoryTitle ??
      primaryGrade.categoryTitle ??
      baseStage.categoryTitle ??
      "",
    categoryJudgeCount:
      Number(
        matchedCat?.contestCategoryJudgeCount ??
          primaryGrade.categoryJudgeCount ??
          baseStage.categoryJudgeCount
      ) || 5,
    categoryJudgeType: "ranking",
    categoryIsOverall:
      matchedCat?.contestCategoryIsOverall ??
      primaryGrade.categoryIsOverall ??
      baseStage.categoryIsOverall ??
      false,
    categorySection:
      matchedCat?.contestCategorySection ??
      primaryGrade.categorySection ??
      baseStage.categorySection ??
      "",
    grades: safeGrades,
  };
};
