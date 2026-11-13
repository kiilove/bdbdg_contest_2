"use client";

import { useContext, useEffect, useState } from "react";
import LoadingPage from "./LoadingPage";
import { useFirestoreGetDocument } from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { FileText } from "lucide-react";
import BibTag from "../components/ui/BibTag";

const ContestPlayerOrderTableAfter = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [matchedArray, setMatchedArray] = useState([]);
  const [categoriesArray, setCategoriesArray] = useState([]);

  const [gradesArray, setGradesArray] = useState([]);
  const [playersArray, setPlayersArray] = useState([]);
  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayerFinal = useFirestoreGetDocument("contest_players_final");

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchPool = async (categoriesListId, gradesListId, playersFinalId) => {
    if (
      categoriesListId === undefined ||
      gradesListId === undefined ||
      playersFinalId === undefined
    ) {
      setMessage({
        body: "데이터를 불러오는데 문제가 발생했습니다.",
        body2: "시스템 관리자에게 연락하세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
    }
    try {
      await fetchCategoryDocument.getDocument(categoriesListId).then((data) => {
        setCategoriesArray(() => [...data.categorys]);
      });
      await fetchGradeDocument.getDocument(gradesListId).then((data) => {
        setGradesArray(() => [...data.grades]);
      });
      await fetchPlayerFinal.getDocument(playersFinalId).then((data) => {
        setPlayersArray(() => [...data.players]);
      });
    } catch (error) {}
  };

  const initPlayersFinalList = (categories, grades, players) => {
    setIsLoading(true);
    const dummy = [];

    categories
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .map((category, cIdx) => {
        const matchedGrades = grades.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );
        const matchedGradesLength = matchedGrades.length;
        matchedGrades
          .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
          .map((grade, gIdx) => {
            const matchedPlayerWithPlayerNumber = [];
            const matchedPlayers = players.filter(
              (player) => player.contestGradeId === grade.contestGradeId
            );

            const matchedInfo = {
              ...category,
              ...grade,
              matchedPlayers,
              matchedGradesLength,
            };
            dummy.push({ ...matchedInfo });
          });
      });

    setMatchedArray([...dummy]);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!currentContest?.contests) {
      return;
    }
    fetchPool(
      currentContest.contests.contestCategorysListId,
      currentContest.contests.contestGradesListId,
      currentContest.contests.contestPlayersFinalId
    );
  }, [currentContest?.contests]);

  useEffect(() => {
    if (playersArray.length > 0) {
      initPlayersFinalList(categoriesArray, gradesArray, playersArray);
    }
  }, [playersArray]);

  return (
    <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
          <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08]">
                <FileText
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[#171717] m-0 tracking-tight">
                  선수 확정 명단 (계측 후)
                </h1>
                <p className="text-xs text-[#737373] m-0">
                  계측 및 월체·불참 반영이 완료된 체급별 출전 선수 명단
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-[#525252] font-mono tabular-nums bg-[#f4f4f5] px-2.5 py-1 rounded-[4px] border border-[#171717]/[0.08]">
              총 {playersArray.length}명
            </span>
          </div>

          <ConfirmationModal
            isOpen={msgOpen}
            onConfirm={() => setMsgOpen(false)}
            onCancel={() => setMsgOpen(false)}
            message={message}
          />

          <div className="flex flex-col gap-4">
            {matchedArray.length > 0 &&
              matchedArray
                .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
                .map((matched, mIdx) => {
                  const {
                    contestCategoryTitle: categoryTitle,
                    contestGradeTitle: gradeTitle,
                    matchedPlayers,
                  } = matched;

                  if (matchedPlayers.length === 0) return null;

                  const noShowCount = matchedPlayers.filter(
                    (p) => p.playerNoShow
                  ).length;

                  return (
                    <div
                      key={mIdx}
                      className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
                    >
                      <div className="bg-[#f4f4f5] px-5 py-3 border-b border-[#171717]/[0.08] flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#171717]">
                          {categoryTitle}
                          <span className="text-[#525252] font-normal mx-1.5">
                            /
                          </span>
                          <span className="font-medium">{gradeTitle}</span>
                        </span>
                        <span className="text-xs font-medium text-[#525252] font-mono tabular-nums">
                          출전 {matchedPlayers.length - noShowCount} /{" "}
                          {matchedPlayers.length}명
                        </span>
                      </div>

                      {isMobile ? (
                        <div className="flex flex-col gap-2.5 p-3">
                          {matchedPlayers
                            .sort((a, b) => a.playerIndex - b.playerIndex)
                            .map((player, pIdx) => {
                              const {
                                playerName,
                                playerGym,
                                playerNumber,
                                playerNoShow,
                                isGradeChanged,
                              } = player;

                              return (
                                <div
                                  key={pIdx}
                                  className={`rounded-[8px] border p-3.5 ${
                                    playerNoShow
                                      ? "bg-[#dc2626]/[0.03] border-[#dc2626]/20"
                                      : "bg-[#ffffff] border-[#171717]/[0.08]"
                                  }`}
                                >
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-[#737373] font-mono tabular-nums">
                                          순번 {pIdx + 1}
                                        </span>
                                        <BibTag
                                          number={playerNumber}
                                          className={
                                            playerNoShow
                                              ? "line-through opacity-50"
                                              : ""
                                          }
                                        />
                                      </div>
                                      <div className="flex gap-1">
                                        {isGradeChanged && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] text-[11px] font-medium">
                                            월체
                                          </span>
                                        )}
                                        {playerNoShow && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.10] text-[#dc2626] text-[11px] font-medium">
                                            불참
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div
                                      className={
                                        playerNoShow
                                          ? "line-through text-[#737373]"
                                          : ""
                                      }
                                    >
                                      <div className="text-sm font-medium text-[#171717]">
                                        {playerName}
                                      </div>
                                      <div className="text-xs text-[#525252]">
                                        {playerGym || "-"}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[#171717]/[0.08] bg-[#fafafa] text-xs font-medium text-[#525252]">
                                <th className="w-20 py-2.5 px-4">순번</th>
                                <th className="w-28 py-2.5 px-4">선수번호</th>
                                <th className="w-44 py-2.5 px-4">이름</th>
                                <th className="py-2.5 px-4">소속</th>
                                <th className="w-36 py-2.5 px-4">비고</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#171717]/[0.06]">
                              {matchedPlayers
                                .sort((a, b) => a.playerIndex - b.playerIndex)
                                .map((player, pIdx) => {
                                  const {
                                    playerName,
                                    playerGym,
                                    playerNumber,
                                    playerNoShow,
                                    isGradeChanged,
                                  } = player;

                                  return (
                                    <tr
                                      key={pIdx}
                                      className={`transition-colors duration-150 ${
                                        playerNoShow
                                          ? "bg-[#dc2626]/[0.03]"
                                          : "hover:bg-[#fafafa]"
                                      }`}
                                    >
                                      <td
                                        className={`w-20 py-3 px-4 font-mono tabular-nums text-xs ${
                                          playerNoShow
                                            ? "text-[#737373] line-through"
                                            : "text-[#737373]"
                                        }`}
                                      >
                                        {pIdx + 1}
                                      </td>
                                      <td className="w-28 py-3 px-4">
                                        <BibTag
                                          number={playerNumber}
                                          className={
                                            playerNoShow
                                              ? "line-through opacity-50"
                                              : ""
                                          }
                                        />
                                      </td>
                                      <td
                                        className={`w-44 py-3 px-4 text-sm font-medium ${
                                          playerNoShow
                                            ? "text-[#dc2626] line-through"
                                            : "text-[#171717]"
                                        }`}
                                      >
                                        {playerName}
                                      </td>
                                      <td
                                        className={`py-3 px-4 text-sm ${
                                          playerNoShow
                                            ? "text-[#737373] line-through"
                                            : "text-[#525252]"
                                        }`}
                                      >
                                        {playerGym || "-"}
                                      </td>
                                      <td className="w-36 py-3 px-4">
                                        <div className="flex gap-1.5">
                                          {isGradeChanged && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] border border-[#b45309]/20 text-[11px] font-medium">
                                              월체
                                            </span>
                                          )}
                                          {playerNoShow && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.10] text-[#dc2626] border border-[#dc2626]/20 text-[11px] font-medium">
                                              불참
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContestPlayerOrderTableAfter;
