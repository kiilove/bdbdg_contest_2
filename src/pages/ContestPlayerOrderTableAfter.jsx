"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import LoadingPage from "./LoadingPage";
import { useFirestoreGetDocument } from "../hooks/useFirestores";
import { doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { FileText, Pencil, Search } from "lucide-react";
import { Input } from "antd";
import BibTag from "../components/ui/BibTag";
import LayerPlayerEditDrawer from "../components/player/LayerPlayerEditDrawer";
import {
  getStagePlayerSortIndex,
  isGrandPrixPlayerEntry,
} from "../functions/functions";
import { sanitizeForFirestore } from "../utils/firestoreSanitize";
import { resolveOriginalGradeTitle } from "../utils/playerEntryUtils";
import { applyStage3FinalDirectEdit } from "../utils/layerPlayerEditUtils";

const ContestPlayerOrderTableAfter = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [matchedArray, setMatchedArray] = useState([]);
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [playersArray, setPlayersArray] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editingIsGp, setEditingIsGp] = useState(false);
  const [isDirectSaving, setIsDirectSaving] = useState(false);

  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayerAssign = useFirestoreGetDocument("contest_players_assign");
  const fetchPlayerFinal = useFirestoreGetDocument("contest_players_final");

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchPool = async (
    categoriesListId,
    gradesListId,
    playersFinalId,
    playersAssignId
  ) => {
    if (
      categoriesListId === undefined ||
      gradesListId === undefined ||
      playersFinalId === undefined
    ) {
      setMessage({
        variant: "error",
        title: "출전 명단 데이터 확인 필요",
        body: "최종 출전 명단 조회에 필요한 문서 정보를 확인할 수 없습니다.",
        body2: "대회 종목·체급 및 계측 최종명단 구성을 먼저 확인해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }
    try {
      setIsLoading(true);
      const [catData, gradeData, finalData] = await Promise.all([
        fetchCategoryDocument.getDocument(categoriesListId),
        fetchGradeDocument.getDocument(gradesListId),
        fetchPlayerFinal.getDocument(playersFinalId),
      ]);

      setCategoriesArray([...(catData?.categorys || [])]);
      setGradesArray([...(gradeData?.grades || [])]);

      let resolvedPlayers = Array.isArray(finalData?.players)
        ? finalData.players
        : [];
      // 3단계 저장본이 아직 비어 있을 때는 2단계(weighInPlayers) -> 1단계(assign) 순으로 초기 승계 조회
      if (resolvedPlayers.length === 0) {
        if (
          Array.isArray(finalData?.weighInPlayers) &&
          finalData.weighInPlayers.length > 0
        ) {
          resolvedPlayers = finalData.weighInPlayers;
        } else if (playersAssignId) {
          const assignData = await fetchPlayerAssign.getDocument(
            playersAssignId
          );
          resolvedPlayers = assignData?.players || [];
        }
      }
      setPlayersArray([...resolvedPlayers]);
    } catch (error) {
      console.error("최종 출전 명단 로드 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const initPlayersFinalList = (categories, grades, players) => {
    const dummy = [];

    [...(categories || [])]
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .forEach((category) => {
        const matchedGrades = (grades || []).filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );
        const matchedGradesLength = matchedGrades.length;
        [...matchedGrades]
          .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
          .forEach((grade) => {
            const matchedPlayers = (players || []).filter(
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
  };

  useEffect(() => {
    if (!currentContest?.contests) {
      return;
    }
    fetchPool(
      currentContest.contests.contestCategorysListId,
      currentContest.contests.contestGradesListId,
      currentContest.contests.contestPlayersFinalId,
      currentContest.contests.contestPlayersAssignId
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests?.id]);

  useEffect(() => {
    if (categoriesArray.length > 0) {
      initPlayersFinalList(categoriesArray, gradesArray, playersArray);
    }
  }, [categoriesArray, gradesArray, playersArray]);

  const handleOpenEditDrawer = (player, isGpRow = false) => {
    setEditingPlayer(player);
    setEditingIsGp(Boolean(isGpRow));
    setEditDrawerOpen(true);
  };

  // 3단계 개별 선수 직접 수정 저장 (contest_players_final.players 단독 반영 — 1·2단계 및 타 레이어 불변)
  const handleDirectEditFinalSave = async (beforePlayer, patchFields) => {
    const playersFinalId = currentContest?.contests?.contestPlayersFinalId;
    const contestId = currentContest?.contests?.id;

    if (!playersFinalId) {
      setMessage({
        variant: "error",
        title: "최종 출전 문서 확인 필요",
        body: "최종 출전 명단 문서를 확인할 수 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    try {
      setIsDirectSaving(true);
      const nowIso = new Date().toISOString();
      let committedPlayers = [];

      await runTransaction(db, async (transaction) => {
        const finalRef = doc(db, "contest_players_final", playersFinalId);
        const finalSnap = await transaction.get(finalRef);
        const existingData = finalSnap.exists() ? finalSnap.data() : {};
        const baseList =
          Array.isArray(existingData?.players) && existingData.players.length > 0
            ? existingData.players
            : playersArray;

        const nextPlayers = applyStage3FinalDirectEdit(
          baseList,
          beforePlayer,
          patchFields,
          {
            isGrandPrix: editingIsGp || isGrandPrixPlayerEntry(beforePlayer),
            nowIso,
          }
        );

        const sanitizedPlayers = sanitizeForFirestore(nextPlayers);

        if (finalSnap.exists()) {
          transaction.update(finalRef, {
            ...(contestId ? { contestId } : {}),
            players: sanitizedPlayers,
            updatedAt: nowIso,
          });
        } else {
          transaction.set(finalRef, {
            ...(contestId ? { contestId } : {}),
            players: sanitizedPlayers,
            updatedAt: nowIso,
          });
        }

        committedPlayers = sanitizedPlayers;
      });

      setPlayersArray([...committedPlayers]);
      setEditDrawerOpen(false);
      setEditingPlayer(null);
    } catch (error) {
      console.error("3단계 선수 직접 수정 오류:", error);
      setMessage({
        variant: "error",
        title: "선수 정보 수정 실패",
        body: "최종 출전 명단(contest_players_final) 저장 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsDirectSaving(false);
    }
  };

  const filteredMatchedArray = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    if (!q) return matchedArray;
    return matchedArray
      .map((item) => ({
        ...item,
        matchedPlayers: (item.matchedPlayers || []).filter((p) => {
          const name = String(p.playerName || "").toLowerCase();
          const gym = String(p.playerGym || "").toLowerCase();
          const num = String(p.playerNumber || "");
          return name.includes(q) || gym.includes(q) || num.includes(q);
        }),
      }))
      .filter((item) => item.matchedPlayers.length > 0);
  }, [matchedArray, searchKeyword]);

  return (
    <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-5">
          <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                  선수 확정 명단 (계측 후 · L3 최종)
                </h1>
                <p className="text-xs text-[#737373] m-0">
                  계측 및 월체·불참 반영이 완료된 출전 명단이며, 행별 [수정]으로 3단계 최종 문서만 단독 수정할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <Input
                allowClear
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="배번 · 이름 · 소속 검색"
                prefix={
                  <Search
                    size={14}
                    strokeWidth={1.6}
                    className="text-[#737373]"
                  />
                }
                className="w-56 h-9 text-xs rounded-[8px]"
              />
              <span className="text-xs font-medium text-[#525252] font-mono tabular-nums bg-[#f4f4f5] px-2.5 py-1.5 rounded-[6px] border border-[#171717]/[0.08]">
                총 {playersArray.length}명
              </span>
            </div>
          </div>

          <ConfirmationModal
            isOpen={msgOpen}
            onConfirm={() => setMsgOpen(false)}
            onCancel={() => setMsgOpen(false)}
            message={message}
          />

          <LayerPlayerEditDrawer
            open={editDrawerOpen}
            onClose={() => {
              if (!isDirectSaving) {
                setEditDrawerOpen(false);
                setEditingPlayer(null);
              }
            }}
            layer={editingIsGp ? "grandprix" : "final"}
            player={editingPlayer}
            categoriesArray={categoriesArray}
            gradesArray={gradesArray}
            allLayerPlayers={playersArray}
            onSave={handleDirectEditFinalSave}
            isSaving={isDirectSaving}
          />

          <div className="flex flex-col gap-4">
            {filteredMatchedArray.length > 0 &&
              [...filteredMatchedArray]
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
                          {[...matchedPlayers]
                            .sort(
                              (a, b) =>
                                getStagePlayerSortIndex(a, matched) -
                                getStagePlayerSortIndex(b, matched)
                            )
                            .map((player, pIdx) => {
                              const {
                                playerName,
                                playerGym,
                                playerNumber,
                                playerNoShow,
                                isGradeChanged,
                              } = player;
                              const isGpRow = isGrandPrixPlayerEntry(
                                player,
                                matched
                              );
                              const origGradeTitle =
                                resolveOriginalGradeTitle(player);

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
                                      <div className="flex gap-1.5 items-center flex-wrap justify-end">
                                        {isGpRow && origGradeTitle && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#525252] border border-[#171717]/[0.08] text-[11px] font-medium">
                                            {origGradeTitle === gradeTitle
                                              ? origGradeTitle
                                              : `${origGradeTitle} 1위`}
                                          </span>
                                        )}
                                        {!isGpRow && isGradeChanged && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] text-[11px] font-medium">
                                            월체
                                          </span>
                                        )}
                                        {playerNoShow && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.10] text-[#dc2626] text-[11px] font-medium">
                                            불참
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleOpenEditDrawer(player, isGpRow)
                                          }
                                          className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-[6px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#525252] hover:text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer shrink-0"
                                        >
                                          <Pencil size={12} strokeWidth={1.6} />
                                          <span>수정</span>
                                        </button>
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
                                <th className="w-40 py-2.5 px-4">비고</th>
                                <th className="w-24 py-2.5 px-4 text-center">
                                  관리
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#171717]/[0.06]">
                              {[...matchedPlayers]
                                .sort(
                                  (a, b) =>
                                    getStagePlayerSortIndex(a, matched) -
                                    getStagePlayerSortIndex(b, matched)
                                )
                                .map((player, pIdx) => {
                                  const {
                                    playerName,
                                    playerGym,
                                    playerNumber,
                                    playerNoShow,
                                    isGradeChanged,
                                    playerText,
                                  } = player;
                                  const isGpRow = isGrandPrixPlayerEntry(
                                    player,
                                    matched
                                  );
                                  const origGradeTitle =
                                    resolveOriginalGradeTitle(player);

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
                                        <div>{playerGym || "-"}</div>
                                        {playerText && (
                                          <div className="text-[11px] text-[#737373] mt-0.5">
                                            {playerText}
                                          </div>
                                        )}
                                      </td>
                                      <td className="w-40 py-3 px-4">
                                        <div className="flex gap-1.5 flex-wrap">
                                          {isGpRow && origGradeTitle && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#525252] border border-[#171717]/[0.08] text-[11px] font-medium">
                                              {origGradeTitle === gradeTitle
                                                ? origGradeTitle
                                                : `${origGradeTitle} 1위`}
                                            </span>
                                          )}
                                          {!isGpRow && isGradeChanged && (
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
                                      <td className="w-24 py-3 px-4 text-center whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleOpenEditDrawer(player, isGpRow)
                                          }
                                          className="inline-flex items-center justify-center gap-1 h-8 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#525252] hover:text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                                        >
                                          <Pencil
                                            size={13}
                                            strokeWidth={1.5}
                                            className="shrink-0"
                                          />
                                          <span>수정</span>
                                        </button>
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
