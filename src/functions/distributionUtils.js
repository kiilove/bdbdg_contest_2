// 카테고리와 그레이드를 받아 초기 분포도 설정
export const initializeDistributions = (categories, grades) => {
  const initialCategoryDistribution = {};
  const initialGradeDistribution = {};

  categories.forEach((category) => {
    initialCategoryDistribution[category.contestCategoryTitle] = 0;
    initialGradeDistribution[category.contestCategoryTitle] = {};

    const relatedGrades = grades.filter(
      (grade) => grade.refCategoryId === category.contestCategoryId
    );
    relatedGrades.forEach((grade) => {
      initialGradeDistribution[category.contestCategoryTitle][
        grade.contestGradeTitle
      ] = 0;
    });
  });

  return { initialCategoryDistribution, initialGradeDistribution };
};

// 선수 명단을 받아 카테고리와 그레이드 분포 업데이트
export const updateDistributions = (players, categories, grades) => {
  let categoryDistribution = {};
  let gradeDistribution = {};

  // 카테고리와 그레이드의 초기값 설정
  const { initialCategoryDistribution, initialGradeDistribution } =
    initializeDistributions(categories, grades);

  categoryDistribution = { ...initialCategoryDistribution };
  gradeDistribution = { ...initialGradeDistribution };

  // 선수 명단을 순회하면서 분포도 업데이트
  players.forEach((player) => {
    player.joins.forEach((join) => {
      // 카테고리 분포 업데이트
      categoryDistribution[join.contestCategoryTitle] =
        (categoryDistribution[join.contestCategoryTitle] || 0) + 1;

      // 그레이드 분포 업데이트
      gradeDistribution[join.contestCategoryTitle] = {
        ...gradeDistribution[join.contestCategoryTitle],
        [join.contestGradeTitle]:
          (gradeDistribution[join.contestCategoryTitle]?.[
            join.contestGradeTitle
          ] || 0) + 1,
      };
    });
  });

  return { categoryDistribution, gradeDistribution };
};
