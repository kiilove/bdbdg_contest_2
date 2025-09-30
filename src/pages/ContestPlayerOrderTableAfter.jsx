"use client";

import { useContext, useEffect, useState } from "react";
import LoadingPage from "./LoadingPage";
import { useFirestoreGetDocument } from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { Card, Tag } from "antd";
import { FileTextOutlined } from "@ant-design/icons";

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
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-3 gap-y-2">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <>
          <Card className="mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
                <FileTextOutlined className="text-white text-xl" />
              </div>
              <h1
                className="text-xl font-bold"
                style={{ letterSpacing: "1px" }}
              >
                선수확정명단(계측후)
              </h1>
            </div>
          </Card>

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
                    contestCategoryId: categoryId,
                    contestCategoryIndex: categoryIndex,
                    contestCategoryTitle: categoryTitle,
                    contestGradeId: gradeId,
                    contestGradeIndex: gradeIndex,
                    contestGradeTitle: gradeTitle,
                    matchedPlayers,
                    matchedGradesLength: gradeLength,
                  } = matched;

                  if (matchedPlayers.length === 0) return null;

                  return (
                    <Card
                      key={mIdx}
                      title={
                        <span className="text-lg font-semibold">
                          {categoryTitle} / {gradeTitle}
                        </span>
                      }
                      className="shadow-sm"
                    >
                      {isMobile ? (
                        // 모바일 카드 뷰
                        <div className="flex flex-col gap-3">
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
                              } = player;

                              return (
                                <Card
                                  key={pIdx}
                                  size="small"
                                  className={`${
                                    playerNoShow
                                      ? "bg-gray-50 opacity-60"
                                      : "bg-white"
                                  }`}
                                >
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500">
                                          순번: {pIdx + 1}
                                        </span>
                                        <Tag
                                          color="gold"
                                          className="text-base font-semibold px-2 py-0.5"
                                        >
                                          {playerNumber}
                                        </Tag>
                                      </div>
                                      <div className="flex gap-1">
                                        {isGradeChanged && (
                                          <Tag color="orange">월체</Tag>
                                        )}
                                        {playerNoShow && (
                                          <Tag color="red">불참</Tag>
                                        )}
                                      </div>
                                    </div>
                                    <div
                                      className={`${
                                        playerNoShow
                                          ? "line-through text-gray-400"
                                          : ""
                                      }`}
                                    >
                                      <div className="text-base font-semibold">
                                        {playerName}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        {playerGym}
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
                        </div>
                      ) : (
                        // 데스크톱 테이블 뷰
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b-2 border-gray-200">
                                <th className="w-16 text-left py-3 px-4 font-semibold text-gray-700">
                                  순번
                                </th>
                                <th className="w-24 text-left py-3 px-4 font-semibold text-gray-700">
                                  선수번호
                                </th>
                                <th className="w-32 text-left py-3 px-4 font-semibold text-gray-700">
                                  이름
                                </th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">
                                  소속
                                </th>
                                <th className="w-32 text-left py-3 px-4 font-semibold text-gray-700">
                                  비고
                                </th>
                              </tr>
                            </thead>
                            <tbody>
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
                                  } = player;

                                  return (
                                    <tr
                                      key={pIdx}
                                      className="border-b border-gray-100 hover:bg-gray-50"
                                    >
                                      <td
                                        className={`w-16 py-3 px-4 ${
                                          playerNoShow
                                            ? "text-gray-300 line-through"
                                            : ""
                                        }`}
                                      >
                                        {pIdx + 1}
                                      </td>
                                      <td className="w-24 py-3 px-4">
                                        <Tag
                                          color="gold"
                                          className="text-base font-semibold px-2 py-0.5"
                                        >
                                          {playerNumber}
                                        </Tag>
                                      </td>
                                      <td
                                        className={`w-32 py-3 px-4 font-medium ${
                                          playerNoShow
                                            ? "text-gray-300 line-through"
                                            : ""
                                        }`}
                                      >
                                        {playerName}
                                      </td>
                                      <td
                                        className={`py-3 px-4 ${
                                          playerNoShow
                                            ? "text-gray-300 line-through"
                                            : ""
                                        }`}
                                      >
                                        {playerGym}
                                      </td>
                                      <td className="w-32 py-3 px-4">
                                        <div className="flex gap-1">
                                          {isGradeChanged && (
                                            <Tag color="orange">월체</Tag>
                                          )}
                                          {playerNoShow && (
                                            <Tag color="red">불참</Tag>
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
                    </Card>
                  );
                })}
          </div>
        </>
      )}
    </div>
  );
};

export default ContestPlayerOrderTableAfter;
