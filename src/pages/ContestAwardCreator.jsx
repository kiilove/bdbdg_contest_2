import React, { useEffect, useState } from "react";
import { Award, X } from "lucide-react";
import { useFirestoreAddData, useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import dayjs from "dayjs";
import { generateToday } from "../functions/functions";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { BibTag } from "../components/ui/BibTag";
import { dedupeContestResultsByGrade } from "../utils/contestResultsUtils";

const getAwardAthleteKey = (player) =>
  String(
    player?.playerUid ||
      `num:${player?.playerNumber ?? ""}_${(player?.playerName || "").trim()}`
  );

const ContestAwardCreator = ({ props, setClose }) => {
  const [resultArray, setResultArray] = useState([]);
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});
  const [awardArray, setAwardArray] = useState([]);
  const [currentResult, setCurrentResult] = useState([]);
  const [awardAddArray, setAwardAddArray] = useState([]);
  const [awardUniqeNumber, setAwardUniqueNumber] = useState(0);

  const fetchQuery = useFirestoreQuery();
  const addDataAward = useFirestoreAddData("contest_award_list");
  const { categoryTitle, gradeId, gradeTitle, contestId } = props || {};

  const fetchPool = async () => {
    if (!contestId) return;
    const condition = [where("contestId", "==", contestId)];
    const fetchedData = await fetchQuery.getDocuments(
      "contest_results_list",
      condition
    );

    const fetchAwardData = await fetchQuery.getDocuments(
      "contest_award_list",
      condition
    );

    const dedupedResults = dedupeContestResultsByGrade(
      fetchedData || [],
      contestId
    );
    setResultArray(() => [...dedupedResults]);
    setAwardArray(() => [...(fetchAwardData || [])]);
  };

  const findCurrentResultAndFlatten = (arr) => {
    const finded = arr.find(
      (f) => (!f.contestId || f.contestId === contestId) && f.gradeId === gradeId
    );

    if (finded) {
      const newPlayerInfo = {
        ...finded,
      };

      const flattenPlayerInfo = (newPlayerInfo?.result || [])
        .filter((player) => {
          const r = Number(player?.playerRank);
          return (
            Number.isFinite(r) &&
            r >= 1 &&
            r < 1000 &&
            player?.playerNoShow !== true &&
            player?.isRankExcluded !== true
          );
        })
        .map((player) => {
        const { playerName, playerGym, playerNumber, playerRank, playerUid } =
          player;
        const {
          categoryId: foundCategoryId,
          categoryTitle: foundCategoryTitle,
          gradeId: foundGradeId,
          gradeTitle: foundGradeTitle,
          contestId: foundContestId,
        } = newPlayerInfo;
        return {
          categoryId: foundCategoryId,
          categoryTitle1: foundCategoryTitle,
          categoryTitle2: "",
          categoryTitle: foundCategoryTitle,
          gradeId: foundGradeId,
          gradeTitle: foundGradeTitle,
          contestId: foundContestId,
          playerName,
          playerGym,
          playerGym1: playerGym,
          playerGym2: "",
          playerNumber,
          playerRank,
          playerUid,
          isAward: false,
          isMaded: false,
          playerGymFontSize: "22px",
          categoryFontSize: "18px",
          madeYear: dayjs(generateToday()).year().toString(),
        };
      });

      return flattenPlayerInfo || [];
    }
    return [];
  };

  const computeBaseAwardNumber = (existingAwards = []) => {
    if (!Array.isArray(existingAwards) || existingAwards.length === 0) return 0;
    const maxNum = existingAwards.reduce((max, item) => {
      const n = Number(item?.awardNumber);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    return Math.max(existingAwards.length, maxNum);
  };

  const issuedKeySet = React.useMemo(() => {
    const set = new Set();
    (awardArray || []).forEach((item) => {
      if (!gradeId || item?.gradeId === gradeId) {
        set.add(getAwardAthleteKey(item));
      }
    });
    return set;
  }, [awardArray, gradeId]);

  const handleAwardCheck = (e, targetAthlete) => {
    if (!targetAthlete) return;
    const { checked } = e.target;
    const targetKey = getAwardAthleteKey(targetAthlete);
    if (issuedKeySet.has(targetKey)) return;
    const baseNo = computeBaseAwardNumber(awardArray);

    let nextSelected;
    if (checked) {
      const exists = awardAddArray.some(
        (item) => getAwardAthleteKey(item) === targetKey
      );
      nextSelected = exists
        ? [...awardAddArray]
        : [...awardAddArray, { ...targetAthlete, isAward: true }];
    } else {
      nextSelected = awardAddArray.filter(
        (item) => getAwardAthleteKey(item) !== targetKey
      );
    }

    const renumbered = [...nextSelected]
      .sort((a, b) => (a.playerRank || 0) - (b.playerRank || 0))
      .map((item, idx) => ({
        ...item,
        isAward: true,
        awardNumber: baseNo + idx + 1,
      }));

    setAwardUniqueNumber(baseNo);
    setAwardAddArray(renumbered);
  };

  const handleSaveAwardList = async (addArr = []) => {
    const freshFiltered = (addArr || []).filter(
      (item) => !issuedKeySet.has(getAwardAthleteKey(item))
    );
    if (freshFiltered.length > 0) {
      try {
        const baseNo = computeBaseAwardNumber(awardArray);
        const finalToSave = freshFiltered.map((add, idx) => ({
          ...add,
          awardNumber: baseNo + idx + 1,
        }));
        await Promise.all(
          finalToSave.map((add) => addDataAward.addData({ ...add }))
        );
        setAwardAddArray([]);
        await fetchPool();
        setMessage({
          variant: "success",
          title: "상장 목록 저장 완료",
          body: `${finalToSave.length}건의 상장 발급 데이터가 저장되었습니다.`,
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
      } catch (error) {
        console.log(error);
        setMessage({
          variant: "error",
          title: "상장 목록 저장 실패",
          body: "상장 목록을 저장하는 중 오류가 발생했습니다.",
          body4: error?.message,
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
      }
    }
  };

  useEffect(() => {
    setAwardUniqueNumber(() => computeBaseAwardNumber(awardArray));
  }, [awardArray]);

  useEffect(() => {
    if (resultArray.length > 0) {
      setCurrentResult(() => [...findCurrentResultAndFlatten(resultArray)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultArray]);

  useEffect(() => {
    fetchPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId]);

  const sortedResult = [...currentResult].sort(
    (a, b) => a.playerRank - b.playerRank
  );

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden text-[#171717]">
      <ConfirmationModal
        isOpen={msgOpen}
        message={message}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />

      <div className="sticky top-0 z-10 shrink-0 bg-[#f4f4f5] border-b border-[#171717]/[0.08] px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Award size={18} strokeWidth={1.5} className="text-[#525252]" />
          <div>
            <h2 className="text-sm font-semibold text-[#171717] m-0">
              상장 발급 대상 등록
            </h2>
            <p className="text-xs text-[#525252] m-0">
              {categoryTitle} ({gradeTitle})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setClose(false)}
          className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#525252] hover:bg-white hover:text-[#171717] transition-colors cursor-pointer"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#fafafa] border-b border-[#171717]/[0.08] text-[#525252] text-xs font-medium">
              <th className="py-2.5 px-3 w-14 text-center">선택</th>
              <th className="py-2.5 px-3 w-16 text-center">연번</th>
              <th className="py-2.5 px-3 w-16 text-center">순위</th>
              <th className="py-2.5 px-3 w-20 text-center">번호</th>
              <th className="py-2.5 px-3 text-left">이름</th>
              <th className="py-2.5 px-4 text-left">소속</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#171717]/[0.06]">
            {sortedResult.length > 0 ? (
              sortedResult.map((curr, cIdx) => {
                const {
                  playerName,
                  playerRank,
                  playerUid,
                  playerGym,
                  playerNumber,
                } = curr;
                const athleteKey = getAwardAthleteKey(curr);
                const isAlreadyIssued = issuedKeySet.has(athleteKey);
                const selectedEntry = awardAddArray.find(
                  (item) => getAwardAthleteKey(item) === athleteKey
                );
                const isChecked = Boolean(selectedEntry);
                const existingAwardItem = isAlreadyIssued
                  ? awardArray.find(
                      (a) =>
                        (!gradeId || a?.gradeId === gradeId) &&
                        getAwardAthleteKey(a) === athleteKey
                    )
                  : null;
                const displayAwardNo = isAlreadyIssued
                  ? existingAwardItem?.awardNumber || "-"
                  : selectedEntry
                  ? selectedEntry.awardNumber
                  : awardUniqeNumber + awardAddArray.length + 1;
                return (
                  <tr
                    key={athleteKey || cIdx}
                    className={`transition-colors ${
                      isAlreadyIssued
                        ? "bg-[#fafafa] opacity-65"
                        : "hover:bg-[#fafafa]"
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center">
                      {isAlreadyIssued ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#f4f4f5] text-[#525252] text-[10px] font-semibold">
                          발급완료
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          name="playerAward"
                          className="w-4 h-4 accent-[#2563eb] cursor-pointer"
                          value={playerUid || playerNumber || ""}
                          checked={isChecked}
                          onChange={(e) => handleAwardCheck(e, curr)}
                        />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-xs text-[#737373]">
                      {isAlreadyIssued || isChecked ? displayAwardNo : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums font-medium text-[#171717]">
                      {playerRank}위
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <BibTag number={playerNumber} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#171717]">
                      {playerName}
                    </td>
                    <td className="py-2.5 px-4 text-[#525252]">
                      {playerGym || "무소속"}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-xs text-[#737373]"
                >
                  확정된 순위 데이터가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 z-10 shrink-0 bg-[#f4f4f5] border-t border-[#171717]/[0.08] px-5 py-3 flex items-center justify-between gap-3">
        <span className="font-mono tabular-nums text-xs text-[#525252]">
          선택 인원 {awardAddArray.length}명
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setClose(false)}
            className="h-9 px-4 rounded-[8px] bg-white border border-[#171717]/[0.12] hover:bg-[#fafafa] text-sm font-medium text-[#171717] transition-colors cursor-pointer"
          >
            닫기
          </button>
          {awardAddArray.length > 0 && (
            <button
              type="button"
              onClick={() => handleSaveAwardList(awardAddArray)}
              className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium transition-colors active:scale-[0.98] cursor-pointer"
            >
              상장 추가
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContestAwardCreator;
