import React, { useEffect, useState } from "react";
import { Award, X } from "lucide-react";
import { useFirestoreAddData, useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import dayjs from "dayjs";
import { generateToday } from "../functions/functions";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { BibTag } from "../components/ui/BibTag";

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

    setResultArray(() => [...(fetchedData || [])]);
    setAwardArray(() => [...(fetchAwardData || [])]);
  };

  const findCurrentResultAndFlatten = (arr) => {
    const finded = arr.find(
      (f) => f.contestId === contestId && f.gradeId === gradeId
    );

    if (finded) {
      const newPlayerInfo = {
        ...finded,
      };

      const flattenPlayerInfo = newPlayerInfo?.result?.map((player) => {
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

  const handleAwardCheck = (e, listIndex, awardNumber) => {
    const { checked } = e.target;

    const newAdded = [...awardAddArray];

    if (checked) {
      newAdded.push({
        ...currentResult[listIndex],
        isAward: checked,
        awardNumber,
      });
      setAwardUniqueNumber(() => awardArray.length);
    } else {
      newAdded.splice(listIndex, 1);
    }

    setAwardAddArray(() => [...newAdded]);
  };

  const handleSaveAwardList = async (addArr = []) => {
    if (addArr.length > 0) {
      addArr.map(async (add) => {
        try {
          await addDataAward.addData({ ...add }).then(() => {
            setMessage({
              body: "상장 목록이 저장되었습니다",
              isButton: true,
              confirmButtonText: "확인",
            });
            setMsgOpen(true);
          });
        } catch (error) {
          console.log(error);
        }
      });
    }
  };

  useEffect(() => {
    setAwardUniqueNumber(() => awardArray.length);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <ConfirmationModal
        isOpen={msgOpen}
        message={message}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />

      <div className="w-full max-w-2xl max-h-[88vh] bg-white rounded-[14px] border border-[#171717]/15 shadow-[0_16px_40px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden text-[#171717]">
        <div className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] px-5 py-3.5 flex items-center justify-between">
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
                  return (
                    <tr
                      key={playerUid || cIdx}
                      className="hover:bg-[#fafafa] transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          name="playerAward"
                          className="w-4 h-4 accent-[#2563eb] cursor-pointer"
                          value={playerUid}
                          onChange={(e) =>
                            handleAwardCheck(
                              e,
                              cIdx,
                              awardUniqeNumber + cIdx + 1
                            )
                          }
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums text-xs text-[#737373]">
                        {awardUniqeNumber + cIdx + 1}
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

        <div className="bg-[#f4f4f5] border-t border-[#171717]/[0.08] px-5 py-3 flex items-center justify-between gap-3">
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
    </div>
  );
};

export default ContestAwardCreator;
