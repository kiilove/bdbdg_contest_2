import React, { useContext, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Shuffle, RefreshCw, Upload } from "lucide-react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreGetDocument,
} from "../hooks/useFirestores";
import {
  FEMALE_NAMES,
  FITNESS_CLUBS,
  HIGH_SCHOOLS,
  MALE_NAMES,
  SURNAMES,
} from "../functions/human";
import { PHONE_NUMBERS } from "../functions/mobileNumber";
import dayjs from "dayjs";

import {
  initializeDistributions,
  updateDistributions,
} from "../functions/distributionUtils";
import CategoryChart from "../components/CategoryChart";
import GradeStackBarChart from "../components/GradeStackBarChart";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const RandomPlayerGenerator = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [players, setPlayers] = useState([]);
  const [categoryDistribution, setCategoryDistribution] = useState({});
  const [gradeDistribution, setGradeDistribution] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categorysArray, setCategorysArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});

  const addInvoice = useFirestoreAddData("invoices_pool");

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");

  const fetchPool = async () => {
    try {
      if (currentContest?.contests?.contestCategorysListId) {
        const returnCategorys = await fetchCategoryDocument.getDocument(
          currentContest.contests.contestCategorysListId
        );
        setCategorysArray([...(returnCategorys?.categorys || [])]);

        const returnGrades = await fetchGradeDocument.getDocument(
          currentContest.contests.contestGradesListId
        );
        setGradesArray([...(returnGrades?.grades || [])]);

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

    const firstJoin = player.joins[0];
    if (firstJoin.contestCategoryPriceType === "기본참가비") {
      priceSum += player.contestPriceBasic || 0;
    } else if (firstJoin.contestCategoryPriceType === "타입1") {
      priceSum += player.contestPriceType1 || 0;
    } else if (firstJoin.contestCategoryPriceType === "타입2") {
      priceSum += player.contestPriceType2 || 0;
    }

    if (player.joins.length > 1) {
      const extraJoinCount = player.joins.length - 1;
      const isAccumulated = player.contestPriceExtraType === "누적";

      if (isAccumulated) {
        priceSum += (player.contestPriceExtra || 0) * extraJoinCount;
      } else {
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
      const age = generateAgeBasedOnDistribution();
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
        "우승을 목표로 준비했습니다",
        "최선을 다해 무대에 오르겠습니다",
        "꾸준한 훈련의 결과를 확인하고 싶습니다",
        "최고의 컨디션으로 출전합니다",
        "끝까지 집중하겠습니다",
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
        contestId: currentContest?.contestInfo?.refContestId,
      };

      delete newPlayer.id;
      delete newPlayer.refContestId;

      const availableCategories = filterCategories(age, isFemale);
      if (!availableCategories || availableCategories.length === 0) {
        return null;
      }

      const numberOfCategories = Math.min(
        age <= 19 ? 1 : Math.floor(Math.random() * 3) + 1,
        availableCategories.length
      );

      const shuffledCategories = [...availableCategories].sort(
        () => Math.random() - 0.5
      );
      const selectedCategories = shuffledCategories.slice(
        0,
        numberOfCategories
      );

      const selectedGrades = [];

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

      if (selectedGrades.length === 0) {
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
    const newPlayers = [];
    let attempts = 0;
    const MAX_ATTEMPTS = playerCount * 2;

    for (let i = 0; i < playerCount; i++) {
      const player = generatePlayer();
      if (player) {
        newPlayers.push(player);
      } else {
        i--;
      }

      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        break;
      }
    }

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
    const selectedPlayersData = players.filter((player) =>
      selectedPlayers.includes(player.playerUid)
    );

    try {
      for (const player of selectedPlayersData) {
        const contestPriceSum = calculateContestPriceSum(player);
        const newValue = { ...player, contestPriceSum };
        await addInvoice.addData(newValue);
      }
      setModalMessage({
        variant: "success",
        title: "가상 신청서 등록 완료",
        body: `선택한 테스트 선수 ${selectedPlayersData.length}명의 참가신청서가 등록되었습니다.`,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("Error submitting selected players:", error);
      setModalMessage({
        variant: "error",
        title: "가상 신청서 등록 오류",
        body: "테스트 선수 등록 중 오류가 발생했습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    }
  };

  const sortedCategoryKeys = Object.keys(categoryDistribution).sort((a, b) => {
    const categoryA = categorysArray.find(
      (category) => category.contestCategoryTitle === a
    );
    const categoryB = categorysArray.find(
      (category) => category.contestCategoryTitle === b
    );
    return (
      (categoryA?.contestCategoryIndex || 0) -
      (categoryB?.contestCategoryIndex || 0)
    );
  });
  void sortedCategoryKeys;

  const formatCategoryDataForChart = () => {
    return Object.keys(categoryDistribution).map((category) => ({
      name: category,
      players: categoryDistribution[category],
    }));
  };

  const formatGradeDataForStackedChart = () => {
    if (!selectedCategory || !gradeDistribution[selectedCategory]) return [];

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest]);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />
      <div className="max-w-[1440px] mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              테스트 선수 생성기
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              종목·체급 분포 시뮬레이션 및 리허설용 가상 참가신청서를 생성합니다
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={handleSubmitSelectedPlayers}
              disabled={selectedPlayers.length === 0}
              className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#f4f4f5] disabled:text-[#737373] disabled:border disabled:border-[#171717]/[0.08] text-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <Upload size={16} strokeWidth={1.5} />
              <span className="tabular-nums">
                선택 선수 접수 풀 등록 ({selectedPlayers.length}명)
              </span>
            </button>
          </div>
        </header>

        {/* 생성 컨트롤 바 */}
        <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[13px] font-medium text-[#525252]">
              생성 인원 수
            </label>
            <div className="relative flex items-center w-28">
              <input
                type="number"
                min={0}
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="w-full h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] pl-3 pr-7 text-right font-mono text-[14px] tabular-nums text-[#171717] focus:outline-none focus:border-[#2563eb] transition-colors duration-150"
              />
              <span className="absolute right-2.5 text-[12px] text-[#737373] pointer-events-none">
                명
              </span>
            </div>
            <button
              type="button"
              onClick={handleGeneratePlayers}
              disabled={!isButtonEnabled}
              className="h-9 px-4 rounded-[8px] bg-[#171717] hover:bg-[#262626] disabled:opacity-40 text-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <Shuffle size={15} strokeWidth={1.5} />
              <span>선수 생성</span>
            </button>
            <button
              type="button"
              onClick={handleGeneratePlayers}
              disabled={!isButtonEnabled}
              className="h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] disabled:opacity-40 text-[#171717] text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <RefreshCw size={15} strokeWidth={1.5} className="text-[#525252]" />
              <span>다시 생성</span>
            </button>
          </div>
          <div className="text-[12px] font-mono tabular-nums text-[#737373]">
            {!isButtonEnabled
              ? "종목·체급 데이터 불러오는 중"
              : `생성됨 ${players.length}명 · 선택됨 ${selectedPlayers.length}명`}
          </div>
        </section>

        {/* 분포 차트 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section
            className={`${
              selectedCategory ? "lg:col-span-7" : "lg:col-span-12"
            } bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-3`}
          >
            <h2 className="text-[15px] font-medium text-[#171717]">
              종목별 생성 분포
            </h2>
            <CategoryChart
              data={formatCategoryDataForChart()}
              title="종목별 인원 분포"
              onBarClick={handleCategoryClick}
            />
          </section>

          {selectedCategory && (
            <section className="lg:col-span-5 bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-3">
              <h2 className="text-[15px] font-medium text-[#171717]">
                {selectedCategory} · 체급 분포
              </h2>
              <GradeStackBarChart
                data={formatGradeDataForStackedChart()}
                title={`${selectedCategory} 체급별 분포`}
              />
            </section>
          )}
        </div>

        {/* 생성된 선수 테이블 */}
        <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#171717]/[0.06] flex items-center justify-between">
            <h2 className="text-[15px] font-medium text-[#171717]">
              생성된 가상 선수 목록
            </h2>
            <span className="text-[12px] font-mono tabular-nums text-[#737373]">
              총 {players.length}명
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead>
                <tr className="bg-[#f4f4f5] text-[#525252] border-b border-[#171717]/[0.08] h-10">
                  <th className="w-12 px-3 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={
                        players.length > 0 &&
                        selectedPlayers.length === players.length
                      }
                      className="w-4 h-4 rounded-[4px] accent-[#2563eb] cursor-pointer"
                    />
                  </th>
                  <th className="px-3 font-medium">이름</th>
                  <th className="px-3 font-medium">소속</th>
                  <th className="px-3 font-medium">연락처</th>
                  <th className="px-3 font-medium">이메일</th>
                  <th className="px-3 font-medium">생년월일</th>
                  <th className="px-3 font-medium text-right">나이</th>
                  <th className="px-3 font-medium text-center">성별</th>
                  <th className="px-3 font-medium">신청 종목 및 체급</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#171717]/[0.06]">
                {players.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-[13px] text-[#737373]"
                    >
                      생성 인원 수를 입력하고 선수 생성 버튼을 눌러주세요
                    </td>
                  </tr>
                ) : (
                  players.map((player) => (
                    <tr
                      key={player.playerUid}
                      className="hover:bg-[#f4f4f5]/50 transition-colors duration-150"
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedPlayers.includes(player.playerUid)}
                          onChange={(e) =>
                            handleSelectPlayer(e, player.playerUid)
                          }
                          className="w-4 h-4 rounded-[4px] accent-[#2563eb] cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-[#171717]">
                        {player.playerName}
                      </td>
                      <td className="px-3 py-2.5 text-[#525252]">
                        {player.playerGym}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] tabular-nums text-[#525252]">
                        {player.playerTel}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-[#737373]">
                        {player.playerEmail}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] tabular-nums text-[#525252]">
                        {player.playerBirth}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] tabular-nums text-[#525252]">
                        {calculateAge(player.playerBirth)}세
                      </td>
                      <td className="px-3 py-2.5 text-center text-[#525252]">
                        {player.playerGender === "f" ? "여" : "남"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {player.joins.map((join) => (
                            <span
                              key={join.contestGradeId}
                              className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[12px] text-[#171717]"
                            >
                              {join.contestCategoryTitle}
                              <span className="text-[#737373] ml-1">
                                · {join.contestGradeTitle}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RandomPlayerGenerator;
