import React, { useContext, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreGetDocument,
} from "../hooks/useFirestores"; // Custom hook for Firestore
import {
  FEMALE_NAMES,
  FITNESS_CLUBS,
  HIGH_SCHOOLS,
  MALE_NAMES,
  SURNAMES,
} from "../functions/human";
import { PHONE_NUMBERS } from "../functions/mobileNumber";
import dayjs from "dayjs";

// Import the distribution functions
import {
  initializeDistributions,
  updateDistributions,
} from "../functions/distributionUtils";
import CategoryChart from "../components/CategoryChart";
import GradeStackBarChart from "../components/GradeStackBarChart";

const RandomPlayerGenerator = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [players, setPlayers] = useState([]);
  const [categoryDistribution, setCategoryDistribution] = useState({});
  const [gradeDistribution, setGradeDistribution] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categorysArray, setCategorysArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState([]); // Track selected players
  const [playerCount, setPlayerCount] = useState(0);

  // Firestore hook to add data
  const addInvoice = useFirestoreAddData("invoices_pool"); // Collection name is 'invoices_pool'

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");

  const fetchPool = async () => {
    try {
      if (currentContest.contests.contestCategorysListId) {
        const returnCategorys = await fetchCategoryDocument.getDocument(
          currentContest.contests.contestCategorysListId
        );
        setCategorysArray([...returnCategorys?.categorys]);

        const returnGrades = await fetchGradeDocument.getDocument(
          currentContest.contests.contestGradesListId
        );
        setGradesArray([...returnGrades?.grades]);

        // Initialize category and grade distributions
        const { initialCategoryDistribution, initialGradeDistribution } =
          initializeDistributions(
            returnCategorys?.categorys,
            returnGrades?.grades
          );

        setCategoryDistribution(initialCategoryDistribution);
        setGradeDistribution(initialGradeDistribution);

        setTimeout(() => {
          setIsButtonEnabled(true);
        }, 2000);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const filterCategories = (age, isFemale) => {
    let availableCategories = [];

    if (age <= 19) {
      availableCategories = categorysArray.filter(
        (category) =>
          category.contestCategoryTitle.includes("학생부") &&
          category.contestCategoryGender === (isFemale ? "여" : "남")
      );
    } else if (age >= 20 && age <= 44) {
      availableCategories = categorysArray.filter(
        (category) =>
          !category.contestCategoryTitle.includes("학생부") &&
          !category.contestCategoryTitle.includes("장년부") &&
          (category.contestCategoryGender === (isFemale ? "여" : "남") ||
            category.contestCategoryGender === "무관")
      );
    } else if (age >= 45) {
      availableCategories = categorysArray.filter(
        (category) =>
          !category.contestCategoryTitle.includes("학생부") &&
          ((category.contestCategoryTitle.includes("장년부") && !isFemale) ||
            category.contestCategoryGender === (isFemale ? "여" : "남") ||
            category.contestCategoryGender === "무관")
      );
    }

    return availableCategories;
  };

  const calculateAge = (birthDate) => {
    const today = dayjs();
    const birthDay = dayjs(birthDate);
    let age = today.year() - birthDay.year();

    if (
      today.month() < birthDay.month() ||
      (today.month() === birthDay.month() && today.date() < birthDay.date())
    ) {
      age--;
    }
    return age;
  };

  const calculateContestPriceSum = (player) => {
    let priceSum = 0;

    // 첫 번째 종목에 대해 contestCategoryPriceType에 따라 기본 참가비 결정
    const firstJoin = player.joins[0]; // 첫 번째 종목
    if (firstJoin.contestCategoryPriceType === "기본참가비") {
      priceSum += player.contestPriceBasic || 0;
    } else if (firstJoin.contestCategoryPriceType === "타입1") {
      priceSum += player.contestPriceType1 || 0;
    } else if (firstJoin.contestCategoryPriceType === "타입2") {
      priceSum += player.contestPriceType2 || 0;
    }

    // 종목이 2개 이상일 경우 추가 참가비 계산
    if (player.joins.length > 1) {
      const extraJoinCount = player.joins.length - 1; // 추가 종목 수
      const isAccumulated = player.contestPriceExtraType === "누적";

      if (isAccumulated) {
        // "누적"일 경우, 추가 참가비를 종목 수에 맞게 계산
        priceSum += (player.contestPriceExtra || 0) * extraJoinCount;
      } else {
        // "정액"일 경우, 추가 참가비를 한 번만 더함
        priceSum += player.contestPriceExtra || 0;
      }
    }

    return priceSum;
  };

  const generateAgeBasedOnDistribution = () => {
    const random = Math.random();

    if (random < 0.1) {
      return Math.floor(Math.random() * 3) + 17;
    } else if (random < 0.7) {
      return Math.floor(Math.random() * 11) + 20;
    } else if (random < 0.8) {
      return Math.floor(Math.random() * 14) + 31;
    } else {
      return Math.floor(Math.random() * 36) + 45;
    }
  };

  const generatePlayer = () => {
    try {
      console.log("Starting generatePlayer...");
      const age = generateAgeBasedOnDistribution();
      console.log("Generated age:", age);
      const currentYear = dayjs().year();
      const birthYear = currentYear - age;
      const birthMonth = Math.floor(Math.random() * 12) + 1;
      const birthDay = Math.floor(Math.random() * 28) + 1;
      const birthDate = dayjs(`${birthYear}-${birthMonth}-${birthDay}`).format(
        "YYYY-MM-DD"
      );

      const isFemale = Math.random() < 0.3;
      const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
      const givenName = isFemale
        ? FEMALE_NAMES[Math.floor(Math.random() * FEMALE_NAMES.length)]
        : MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
      const name = `${surname}${givenName}`;

      const phoneNumber =
        PHONE_NUMBERS[Math.floor(Math.random() * PHONE_NUMBERS.length)];
      const email = `${name.toLowerCase()}@example.com`;

      const gym =
        Math.random() < 0.1
          ? "무소속"
          : FITNESS_CLUBS[Math.floor(Math.random() * FITNESS_CLUBS.length)];

      let school = null;
      if (age <= 19) {
        school = HIGH_SCHOOLS[Math.floor(Math.random() * HIGH_SCHOOLS.length)];
      }

      const playerTexts = [
        "우승하자",
        "최고를 향해!",
        "한계를 넘어서!",
        "최고의 순간을 위해",
        "끝까지 포기하지 않는다!",
      ];
      const playerText =
        playerTexts[Math.floor(Math.random() * playerTexts.length)];

      const newPlayer = {
        playerUid: uuidv4(),
        playerName: name,
        playerTel: phoneNumber,
        playerEmail: email,
        playerBirth: birthDate,
        playerGym: school || gym,
        playerGender: isFemale ? "f" : "m",
        playerText: playerText,
        isPriceCheck: false,
        isCanceled: false,
        joins: [],
        createBy: "manual",
        invoiceCreateAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        ...currentContest?.contestInfo,
        contestId: currentContest?.contestInfo.refContestId,
      };

      delete newPlayer.id;
      delete newPlayer.refContestId;

      // 카테고리 선택 로직 개선
      const availableCategories = filterCategories(age, isFemale);
      if (!availableCategories || availableCategories.length === 0) {
        console.log("No valid categories found for this player");
        return null;
      }

      // 카테고리 수 결정 (1-3개)
      const numberOfCategories = Math.min(
        age <= 19 ? 1 : Math.floor(Math.random() * 3) + 1,
        availableCategories.length
      );

      // 사용 가능한 카테고리에서 무작위로 선택
      const shuffledCategories = [...availableCategories].sort(
        () => Math.random() - 0.5
      );
      const selectedCategories = shuffledCategories.slice(
        0,
        numberOfCategories
      );

      const selectedGrades = [];

      // 각 선택된 카테고리에 대해 등급 선택
      for (const category of selectedCategories) {
        const relatedGrades = gradesArray.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );

        if (relatedGrades && relatedGrades.length > 0) {
          const randomGrade =
            relatedGrades[Math.floor(Math.random() * relatedGrades.length)];
          selectedGrades.push({
            contestCategoryId: category.contestCategoryId,
            contestCategoryTitle: category.contestCategoryTitle,
            contestCategoryPriceType: category.contestCategoryPriceType,
            contestGradeId: randomGrade.contestGradeId,
            contestGradeTitle: randomGrade.contestGradeTitle,
          });
        }
      }

      // 최소한 하나의 등급이 선택되었는지 확인
      if (selectedGrades.length === 0) {
        console.log("No valid grades found for selected categories");
        return null;
      }

      newPlayer.joins = selectedGrades;
      return newPlayer;
    } catch (error) {
      console.error("Error in generatePlayer:", error);
      return null;
    }
  };

  const handleGeneratePlayers = () => {
    console.log("Starting handleGeneratePlayers with count:", playerCount);
    const newPlayers = [];
    let attempts = 0;
    const MAX_ATTEMPTS = playerCount * 2; // 최대 시도 횟수 제한

    for (let i = 0; i < playerCount; i++) {
      console.log(`Attempting to generate player ${i + 1} of ${playerCount}`);
      const player = generatePlayer();
      if (player) {
        newPlayers.push(player);
        console.log(`Successfully generated player ${i + 1}`);
      } else {
        console.log(`Failed to generate player ${i + 1}, retrying...`);
        i--; // 실패한 경우 다시 시도
      }

      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        console.log("Reached maximum attempts, stopping generation");
        break;
      }
    }

    console.log(`Generation complete. Generated ${newPlayers.length} players`);
    setPlayers([...newPlayers]);

    const {
      categoryDistribution: updatedCategoryDistribution,
      gradeDistribution: updatedGradeDistribution,
    } = updateDistributions(newPlayers, categorysArray, gradesArray);

    setCategoryDistribution(updatedCategoryDistribution);
    setGradeDistribution(updatedGradeDistribution);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedPlayers(players.map((player) => player.playerUid));
    } else {
      setSelectedPlayers([]);
    }
  };

  const handleSelectPlayer = (e, playerUid) => {
    if (e.target.checked) {
      setSelectedPlayers([...selectedPlayers, playerUid]);
    } else {
      setSelectedPlayers(selectedPlayers.filter((id) => id !== playerUid));
    }
  };

  const handleCategoryClick = (e) => {
    if (e && e.activeLabel) {
      setSelectedCategory(e.activeLabel);
    }
  };

  const handleSubmitSelectedPlayers = async () => {
    // Send selected players to Firestore
    const selectedPlayersData = players.filter((player) =>
      selectedPlayers.includes(player.playerUid)
    );

    // console.log(selectedPlayersData);

    try {
      for (const player of selectedPlayersData) {
        const contestPriceSum = calculateContestPriceSum(player);
        const newValue = { ...player, contestPriceSum };
        await addInvoice.addData(newValue); // Add each selected player to the Firestore collection
      }
      alert(
        "Selected players have been successfully submitted to the invoice pool."
      );
    } catch (error) {
      console.error("Error submitting selected players:", error);
    }
  };

  const sortedCategoryKeys = Object.keys(categoryDistribution).sort((a, b) => {
    const categoryA = categorysArray.find(
      (category) => category.contestCategoryTitle === a
    );
    const categoryB = categorysArray.find(
      (category) => category.contestCategoryTitle === b
    );
    return categoryA.contestCategoryIndex - categoryB.contestCategoryIndex;
  });

  const formatCategoryDataForChart = () => {
    return Object.keys(categoryDistribution).map((category) => ({
      name: category,
      players: categoryDistribution[category],
    }));
  };

  const formatGradeDataForStackedChart = () => {
    if (!selectedCategory) return [];

    const formattedData = [
      {
        category: selectedCategory,
      },
    ];

    Object.keys(gradeDistribution[selectedCategory]).forEach((grade) => {
      formattedData[0][grade] = gradeDistribution[selectedCategory][grade];
    });

    return formattedData;
  };

  useEffect(() => {
    fetchPool();
  }, [currentContest]);

  return (
    <div
      className="w-full"
      style={{ backgroundColor: "white", padding: "20px" }}
    >
      <h1>Random Player Generator</h1>
      <div>
        <label>Number of Players to Generate: </label>
        <input
          type="number"
          value={playerCount}
          onChange={(e) => setPlayerCount(Number(e.target.value))}
        />
        <button onClick={handleGeneratePlayers} disabled={!isButtonEnabled}>
          Generate Players
        </button>
        <button onClick={handleGeneratePlayers} disabled={!isButtonEnabled}>
          Clear Players
        </button>
      </div>
      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                onChange={handleSelectAll}
                checked={
                  players.length > 0 &&
                  selectedPlayers.length === players.length
                }
              />
            </th>
            <th>Name</th>
            <th>Gym</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Birth Date</th>
            <th>Age</th>
            <th>Gender</th>
            <th>Categories</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.playerUid}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedPlayers.includes(player.playerUid)}
                  onChange={(e) => handleSelectPlayer(e, player.playerUid)}
                />
              </td>
              <td>{player.playerName}</td>
              <td>{player.playerGym}</td>
              <td>{player.playerTel}</td>
              <td>{player.playerEmail}</td>
              <td>{player.playerBirth}</td>
              <td>{calculateAge(player.playerBirth)}</td>
              <td>{player.playerGender === "f" ? "Female" : "Male"}</td>
              <td>
                {player.joins.map((join) => (
                  <div key={join.contestGradeId}>
                    {join.contestCategoryTitle} - {join.contestGradeTitle}
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={handleSubmitSelectedPlayers}
        disabled={selectedPlayers.length === 0}
      >
        Submit Selected Players to Invoice Pool
      </button>

      <CategoryChart
        data={formatCategoryDataForChart()}
        title="Category Distribution"
        onBarClick={handleCategoryClick}
      />

      {selectedCategory && (
        <GradeStackBarChart
          data={formatGradeDataForStackedChart()}
          title={`Grade Distribution for ${selectedCategory}`}
        />
      )}
    </div>
  );
};

export default RandomPlayerGenerator;
