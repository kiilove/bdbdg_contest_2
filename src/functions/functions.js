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
