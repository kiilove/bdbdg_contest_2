import React, { useContext, useEffect, useState } from "react";
import LoadingPage from "./LoadingPage";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateToday } from "../functions/functions";
import { Trophy, Save, AlertCircle } from "lucide-react";
import BibTag from "../components/ui/BibTag";

const ContestPlayerOrderTableGrandPrix = () => {
  const [isLoading, setIsLoading] = useState(false);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [matchedArray, setMatchedArray] = useState([]);
  const [categoriesArray, setCategoriesArray] = useState([]);

  const [gradesArray, setGradesArray] = useState([]);
  const [playersFinalArray, setPlayersFinalArray] = useState([]);
  const [playersFinalList, setPlayersFinalList] = useState({});
  const [resultPlayersArray, setResultFinalArray] = useState([]);
  const [grandPrixArray, setGrandPrixArray] = useState([]);
  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayerFinal = useFirestoreGetDocument("contest_players_final");
  const updatePlayerFinal = useFirestoreUpdateData("contest_players_final");
  const fetchResultQuery = useFirestoreQuery();

  const fetchPool = async (categoriesListId, gradesListId, playersFinalId) => {
    const contestId = currentContest?.contests?.id;
    if (!contestId) return;

    const condition = [where("contestId", "==", contestId)];
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
      setMsgOpen(true);
      return;
    }
    try {
      await fetchCategoryDocument.getDocument(categoriesListId).then((data) => {
        setCategoriesArray(() => [...(data?.categorys || [])]);
      });
      await fetchGradeDocument.getDocument(gradesListId).then((data) => {
        setGradesArray(() => [...(data?.grades || [])]);
      });
      await fetchPlayerFinal.getDocument(playersFinalId).then((data) => {
        setPlayersFinalArray(() => [...(data?.players || [])]);
        setPlayersFinalList(() => ({ ...(data || {}) }));
      });
      await fetchResultQuery
        .getDocuments("contest_results_list", condition)
        .then((data) => {
          setResultFinalArray(() => [...(data || [])]);
        });
    } catch (error) {
      console.error(error);
    }
  };

  const initGrandPrixPlayers = (resultInfo, categories, grades) => {
    let dummy = [];
    console.log(resultInfo);
    console.log(categories);

    // Filter categories with section "그랑프리"
    const filteredCategories = categories.filter(
      (f) => f.contestCategorySection === "그랑프리"
    );
    console.log(filteredCategories);

    // Collect all matching grades for each filtered category
    const filteredGrades = filteredCategories.reduce((acc, category) => {
      const matchingGrades = grades.filter(
        (grade) => grade.refCategoryId === category.contestCategoryId
      );
      return [...acc, ...matchingGrades]; // Merge the arrays
    }, []);

    console.log(filteredGrades);

    const flattenedWinner = resultInfo
      .map((infoItem, rIdx) => {
        const {
          result: playerResult,
          contestId,
          categoryId,
          gradeId,
          categoryTitle,
          gradeTitle,
        } = infoItem;

        const findWinner = playerResult?.find((f) => f.playerRank === 1);
        if (!findWinner) return null;

        const newResult = {
          contestId,
          originalCategoryId: categoryId,
          originalGradeId: gradeId,
          originalcategoryTitle: categoryTitle,
          originalgradeTitle: gradeTitle,
          playerName: findWinner.playerName,
          playerNumber: findWinner.playerNumber,
          playerGym: findWinner.playerGym,
          playerIndex: findWinner.playerIndex,
          playerUid: findWinner.playerUid,
          totalScore: findWinner.totalScore,
          isGradeChange: false,
          createBy: "web",
          id: "",
          invoiceCreateAt: generateToday(),
          invoiceId: "",
          playerTel: "",
          playerText: "",
          playerNoShow: false,
        };
        return newResult;
      })
      .filter(Boolean);

    console.log("Flattened winners:", flattenedWinner);

    filteredGrades.forEach((grade) => {
      const filteredMatching = flattenedWinner.filter(
        (f) => f.originalCategoryId === grade.originalRefCategoryId
      );

      // 🚨 동일 그랑프리 체급 내 선수 중복 방지 (선수번호 또는 UID 기준)
      const seenPlayers = new Set();
      const renewMatching = [];

      filteredMatching.forEach((match) => {
        const playerKey = String(match.playerUid || match.playerNumber || match.playerName);
        if (!seenPlayers.has(playerKey)) {
          seenPlayers.add(playerKey);
          const { contestGradeId, contestGradeTitle, refCategoryId } = grade;
          const newMatched = {
            ...match,
            contestCategoryId: refCategoryId,
            contestCategoryTitle: "그랑프리",
            contestGradeId,
            contestGradeTitle,
          };
          renewMatching.push(newMatched);
        }
      });

      dummy = [...dummy, ...renewMatching];
    });

    // 전체 dummy에서도 체급별 중복 완벽 제거
    const uniqueMap = new Map();
    dummy.forEach((p) => {
      const uniqueKey = `${p.contestGradeId}_${p.playerUid || p.playerNumber}`;
      if (!uniqueMap.has(uniqueKey)) {
        uniqueMap.set(uniqueKey, p);
      }
    });

    return Array.from(uniqueMap.values());
  };

  const initPlayersFinalList = (categories, grades, players) => {
    setIsLoading(true);

    let dummy = [];
    categories
      .filter((f) => f.contestCategorySection === "그랑프리")
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .forEach((category) => {
        const matchedGrades = grades.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );
        const matchedGradesLength = matchedGrades.length;

        matchedGrades
          .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
          .forEach((grade) => {
            const rawMatched = players.filter(
              (player) => player.contestGradeId === grade.contestGradeId
            );

            // 🚨 화면 렌더링 시 동일 체급 내 선수 번호 중복 방지
            const seen = new Set();
            const matchedPlayers = [];
            rawMatched.forEach((player) => {
              const k = String(player.playerUid || player.playerNumber || player.playerName);
              if (!seen.has(k)) {
                seen.add(k);
                matchedPlayers.push(player);
              }
            });

            const matchedInfo = {
              ...category,
              ...grade,
              matchedPlayers,
              matchedGradesLength,
            };
            dummy.push({ ...matchedInfo });
          });
      });

    console.log("Deduplicated matched Grand Prix array:", dummy);
    setMatchedArray([...dummy]);
    setIsLoading(false);
  };

  const handleUpdatePlayersFinal = async (contestId, playersFinalId, data) => {
    setMessage({ body: "저장중...", isButton: false });
    setMsgOpen(true);

    try {
      if (!playersFinalId) {
        setMessage({
          body: "최종 명단 문서 정보를 확인할 수 없습니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        return;
      }

      // 1. data(그랑프리 선수들) 자체에서 동일 체급 내 중복 완벽 제거
      const dedupedGrandPrixData = [];
      const seenGrandPrixKeys = new Set();
      (data || []).forEach((p) => {
        if (!p) return;
        const k = `${p.contestGradeId}_${p.playerUid || p.playerNumber || p.playerName}`;
        if (!seenGrandPrixKeys.has(k)) {
          seenGrandPrixKeys.add(k);
          dedupedGrandPrixData.push(p);
        }
      });

      if (dedupedGrandPrixData.length === 0) {
        setMessage({
          body: "추가할 그랑프리 명단이 없습니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        return;
      }

      // 최신 contest_players_final 문서를 다시 읽어 동시 계측/강제등록 데이터 손실 방지
      const latestFinalDoc = await fetchPlayerFinal.getDocument(playersFinalId);
      const baseFinalList = latestFinalDoc || playersFinalList || {};
      const baseFinalPlayers = Array.isArray(latestFinalDoc?.players)
        ? latestFinalDoc.players
        : playersFinalArray || [];

      // 그랑프리 종목에 속한 체급 ID 집합 계산
      const grandPrixCategoryIds = new Set(
        (categoriesArray || [])
          .filter((c) => c?.contestCategorySection === "그랑프리")
          .map((c) => c.contestCategoryId)
          .filter(Boolean)
      );
      const grandPrixGradeIds = new Set(
        [
          ...(gradesArray || [])
            .filter((g) => grandPrixCategoryIds.has(g?.refCategoryId))
            .map((g) => g.contestGradeId),
          ...dedupedGrandPrixData.map((p) => p?.contestGradeId),
        ].filter(Boolean)
      );

      // 2. 기존 baseFinalPlayers에서 그랑프리 체급에 속한 기존 선수들 교체 (단, 강제 등록된 선수 createdBy === 'force'는 보존)
      const nonGrandPrixPlayers = baseFinalPlayers.filter(
        (p) =>
          !grandPrixGradeIds.has(p?.contestGradeId) ||
          p?.createdBy === "force" ||
          p?.createBy === "force"
      );

      // 3. 전체 선수 목록 병합 후 중복 검증 (수기 강제 등록 선수 + 전자 집계 우승자)
      const finalPlayersMap = new Map();
      [...nonGrandPrixPlayers, ...dedupedGrandPrixData].forEach((p) => {
        if (!p) return;
        const k = `${p.contestGradeId}_${p.playerUid || p.playerNumber || p.playerName}`;
        if (!finalPlayersMap.has(k)) {
          finalPlayersMap.set(k, p);
        }
      });
      const finalPlayers = Array.from(finalPlayersMap.values());

      await updatePlayerFinal.updateData(playersFinalId, {
        ...baseFinalList,
        ...(contestId ? { contestId } : {}),
        players: finalPlayers,
      });
      setPlayersFinalList({
        ...baseFinalList,
        ...(contestId ? { contestId } : {}),
        players: finalPlayers,
      });
      setPlayersFinalArray(finalPlayers);
      setMessage({
        body: "그랑프리 명단이 중복 없이 성공적으로 저장되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("그랑프리 명단 저장 실패:", error);
      setMessage({
        body: "저장 중 오류가 발생했습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    }
  };

  useEffect(() => {
    if (!currentContest?.contests?.id) {
      return;
    }
    fetchPool(
      currentContest.contests.contestCategorysListId,
      currentContest.contests.contestGradesListId,
      currentContest.contests.contestPlayersFinalId
    );
  }, [
    currentContest?.contests?.id,
    currentContest?.contests?.contestCategorysListId,
    currentContest?.contests?.contestGradesListId,
    currentContest?.contests?.contestPlayersFinalId,
  ]);

  useEffect(() => {
    if (grandPrixArray.length > 0) {
      initPlayersFinalList(categoriesArray, gradesArray, grandPrixArray);
    } else {
      setMatchedArray([]);
    }
  }, [playersFinalArray, grandPrixArray, categoriesArray, gradesArray]);

  useEffect(() => {
    console.log(resultPlayersArray);
    console.log(categoriesArray);
    if (categoriesArray?.length > 0 && gradesArray?.length > 0) {
      setGrandPrixArray([
        ...initGrandPrixPlayers(
          resultPlayersArray,
          categoriesArray,
          gradesArray
        ),
      ]);
    }
  }, [resultPlayersArray, categoriesArray, gradesArray]);

  return (
    <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
          <ConfirmationModal
            isOpen={msgOpen}
            onConfirm={() => setMsgOpen(false)}
            onCancel={() => setMsgOpen(false)}
            message={message}
          />

          <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] flex items-center justify-center">
                <Trophy
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[#171717] m-0 tracking-tight">
                  그랑프리 명단
                </h1>
                <p className="text-xs text-[#737373] m-0">
                  체급별 1위 수상자 자동 집계 및 그랑프리 출전 명단 반영
                </p>
              </div>
            </div>

            {grandPrixArray?.length ? (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors duration-150 cursor-pointer border-0"
                onClick={() =>
                  handleUpdatePlayersFinal(
                    currentContest?.contests?.id,
                    currentContest?.contests?.contestPlayersFinalId,
                    grandPrixArray
                  )
                }
              >
                <Save size={15} strokeWidth={1.5} />
                <span>그랑프리 명단 저장 ({grandPrixArray.length}명)</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#b45309]/[0.08] text-[#b45309] border border-[#b45309]/20 text-xs font-medium">
                <AlertCircle size={15} strokeWidth={1.5} />
                <span>집계표가 저장되었는지 확인하세요</span>
              </div>
            )}
          </div>

          {matchedArray.length === 0 ? (
            <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-12 text-center">
              <p className="text-sm text-[#737373] m-0">
                집계된 그랑프리 출전 대상자가 없습니다. 각 체급 심사가 완료된 후 확인하세요.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {matchedArray
                .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
                .map((matched, mIdx) => {
                  const {
                    contestCategoryTitle: categoryTitle,
                    contestGradeId: gradeId,
                    contestGradeTitle: gradeTitle,
                    matchedPlayers,
                  } = matched;

                  if (matchedPlayers.length === 0) return null;

                  return (
                    <div
                      className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
                      key={mIdx}
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
                          {matchedPlayers.length}명
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#171717]/[0.08] bg-[#fafafa] text-xs font-medium text-[#525252]">
                              <th className="w-20 py-2.5 px-4">순번</th>
                              <th className="w-28 py-2.5 px-4">선수번호</th>
                              <th className="w-44 py-2.5 px-4">이름</th>
                              <th className="py-2.5 px-4">소속</th>
                              <th className="w-44 py-2.5 px-4">출전 체급 / 비고</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#171717]/[0.06]">
                            {matchedPlayers
                              .sort((a, b) => a.playerIndex - b.playerIndex)
                              .map((player, pIdx) => {
                                const {
                                  playerName,
                                  playerGym,
                                  playerUid,
                                  playerNumber,
                                  playerNoShow,
                                  isGradeChanged,
                                  originalgradeTitle,
                                } = player;

                                return (
                                  <tr
                                    key={`${gradeId}_${
                                      playerUid || playerNumber
                                    }_${pIdx}`}
                                    className={`transition-colors duration-150 ${
                                      playerNoShow
                                        ? "bg-[#dc2626]/[0.03]"
                                        : "hover:bg-[#fafafa]"
                                    }`}
                                  >
                                    <td
                                      className={`py-3 px-4 font-mono tabular-nums text-xs ${
                                        playerNoShow
                                          ? "text-[#737373] line-through"
                                          : "text-[#737373]"
                                      }`}
                                    >
                                      {pIdx + 1}
                                    </td>
                                    <td className="py-3 px-4">
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
                                      className={`py-3 px-4 text-sm font-medium ${
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
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {originalgradeTitle && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#525252] border border-[#171717]/[0.08] text-[11px] font-medium">
                                            {originalgradeTitle} 1위
                                          </span>
                                        )}
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
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContestPlayerOrderTableGrandPrix;
