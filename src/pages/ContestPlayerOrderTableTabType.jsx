"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import LoadingPage from "./LoadingPage";
import { TfiWrite } from "react-icons/tfi";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { TbWorldWww } from "react-icons/tb";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { Button, Card, Space, Tag, Checkbox, Alert, Divider } from "antd";
import {
  SaveOutlined,
  DragOutlined,
  CalendarOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  CheckSquareOutlined,
  ClearOutlined,
} from "@ant-design/icons";

const ContestPlayerOrderTable = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [matchedArray, setMatchedArray] = useState([]);
  const [categorysArray, setCategorysArray] = useState([]);
  const [playersArray, setPlayersArray] = useState([]);
  const [playersAssign, setPlayersAssign] = useState({});
  const [playersFinal, setPlayersFinal] = useState({});
  const [gradesArray, setGradesArray] = useState([]);
  const [entrysArray, setEntrysArray] = useState([]);
  const [startPlayerNumber, setStartPlayerNumber] = useState(1);

  // ✅ 개별 항목 선택 상태 (행 단위: mIdx:pIdx:playerUid)
  const [selectedEntries, setSelectedEntries] = useState(new Set());

  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersAssignDocument = useFirestoreGetDocument(
    "contest_players_assign"
  );
  const fetchPlayersFinalDocument = useFirestoreGetDocument(
    "contest_players_final"
  );
  const updatePlayersAssign = useFirestoreUpdateData("contest_players_assign");
  const updatePlayersFinal = useFirestoreUpdateData("contest_players_final");
  const fetchEntry = useFirestoreQuery();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchPool = async () => {
    if (!currentContest?.contests) return;

    setIsLoading(true);

    try {
      if (currentContest.contests.startPlayerNumber) {
        setStartPlayerNumber(currentContest.contests.startPlayerNumber - 1);
      }

      if (currentContest.contests.contestCategorysListId) {
        const returnCategorys = await fetchCategoryDocument.getDocument(
          currentContest.contests.contestCategorysListId
        );
        if (returnCategorys?.categorys?.length > 0) {
          setCategorysArray([
            ...returnCategorys.categorys.sort(
              (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
            ),
          ]);
        } else {
          setCategorysArray([]);
        }
      }

      const returnGrades = await fetchGradeDocument.getDocument(
        currentContest.contests.contestGradesListId
      );
      setGradesArray([...(returnGrades?.grades || [])]);

      const condition = [where("contestId", "==", currentContest.contests.id)];
      const returnEntrys = await fetchEntry.getDocuments(
        "contest_entrys_list",
        condition
      );

      const returnPlayersAssign = await fetchPlayersAssignDocument.getDocument(
        currentContest.contests.contestPlayersAssignId
      );
      const returnPlayersFinal = await fetchPlayersFinalDocument.getDocument(
        currentContest.contests.contestPlayersFinalId
      );

      setEntrysArray([...(returnEntrys || [])]);
      setPlayersAssign({ ...(returnPlayersAssign || {}) });
      setPlayersArray([...(returnPlayersAssign?.players || [])]);
      setPlayersFinal({ ...(returnPlayersFinal || {}) });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const initEntryList = async () => {
    // 엔트리 기준으로 플레이어 번호 할당해 초기 matchedArray 구성
    const dummy = [];
    let playerNumber = startPlayerNumber;

    const condition = [where("contestId", "==", currentContest.contests.id)];
    const data = await fetchEntry.getDocuments(
      "contest_entrys_list",
      condition
    );
    setEntrysArray(() => [...data]);

    categorysArray
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .forEach((category) => {
        const matchedGrades = gradesArray.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );
        const matchedGradesLength = matchedGrades.length;

        matchedGrades
          .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
          .forEach((grade) => {
            const matchedPlayerWithPlayerNumber = [];
            const matchedPlayers = data.filter(
              (entry) => entry.contestGradeId === grade.contestGradeId
            );

            matchedPlayers.forEach((player) => {
              playerNumber++;
              const newPlayer = {
                ...player,
                playerNumber: playerNumber,
                playerNoShow: false,
                playerIndex: playerNumber,
              };
              matchedPlayerWithPlayerNumber.push({ ...newPlayer });
            });

            const matchedInfo = {
              ...category,
              ...grade,
              matchedPlayers: matchedPlayerWithPlayerNumber,
              matchedGradesLength,
            };
            dummy.push({ ...matchedInfo });
          });
      });

    setMatchedArray([...dummy]);
  };

  // ✅ 중복 계산 (그룹: contestGradeId__playerUid, 항목: entryKey = mIdx:pIdx:playerUid)
  const duplicatesMap = useMemo(() => {
    const groups = {};
    matchedArray.forEach((m, mIdx) => {
      const gradeId = m.contestGradeId;
      const catTitle = m.contestCategoryTitle;
      const gradeTitle = m.contestGradeTitle;

      (m.matchedPlayers || []).forEach((p, pIdx) => {
        const groupKey = `${gradeId}__${p.playerUid}`;
        const entryKey = `${mIdx}:${pIdx}:${p.playerUid}`;

        if (!groups[groupKey]) {
          groups[groupKey] = {
            entries: [],
            metaGroup: {
              contestGradeId: gradeId,
              categoryTitle: catTitle,
              gradeTitle: gradeTitle,
              playerUid: p.playerUid,
              playerName: p.playerName,
            },
          };
        }

        groups[groupKey].entries.push({
          entryKey,
          mIdx,
          pIdx,
          meta: {
            playerName: p.playerName,
            playerNumber: p.playerNumber,
            invoiceCreateAt: p.invoiceCreateAt,
            playerGym: p.playerGym,
          },
        });
      });
    });

    return Object.fromEntries(
      Object.entries(groups).filter(([, v]) => (v.entries?.length || 0) > 1)
    );
  }, [matchedArray]);

  const duplicateGroupKeys = useMemo(
    () => new Set(Object.keys(duplicatesMap)),
    [duplicatesMap]
  );

  const deleteSelectedDuplicates = () => {
    if (selectedEntries.size === 0) return;

    const newMatched = matchedArray.map((m) => ({
      ...m,
      matchedPlayers: [...(m.matchedPlayers || [])],
    }));

    const toDeleteByGroup = {};
    selectedEntries.forEach((entryKey) => {
      const [mIdxStr, pIdxStr] = entryKey.split(":");
      const mIdx = parseInt(mIdxStr, 10);
      const pIdx = parseInt(pIdxStr, 10);
      if (Number.isNaN(mIdx) || Number.isNaN(pIdx)) return;
      if (!toDeleteByGroup[mIdx]) toDeleteByGroup[mIdx] = [];
      toDeleteByGroup[mIdx].push(pIdx);
    });

    Object.entries(toDeleteByGroup).forEach(([mIdxStr, list]) => {
      const mIdx = parseInt(mIdxStr, 10);
      const sortedDesc = [...list].sort((a, b) => b - a);
      sortedDesc.forEach((pIdx) => {
        if (newMatched[mIdx]?.matchedPlayers?.[pIdx]) {
          newMatched[mIdx].matchedPlayers.splice(pIdx, 1);
        }
      });
    });

    // 전체 재번호
    const allPlayers = newMatched.flatMap((mm) => mm.matchedPlayers || []);
    allPlayers.forEach((player, idx) => {
      player.playerNumber = idx + startPlayerNumber + 1;
      player.playerIndex = idx + startPlayerNumber + 1;
    });

    setMatchedArray(newMatched);
    setSelectedEntries(new Set());
  };

  const handleUpdatePlayersAssign = async (assignId, finalId) => {
    const allPlayers = matchedArray.flatMap((m) => m.matchedPlayers || []);
    const newPlayersAssign = { ...playersAssign, players: [...allPlayers] };
    const newPlayersFinal = { ...playersFinal, players: [...allPlayers] };

    try {
      await updatePlayersAssign.updateData(assignId, newPlayersAssign);
      await updatePlayersFinal.updateData(finalId, newPlayersFinal);
      const hasDup = Object.keys(duplicatesMap).length > 0;
      setMessage({
        body: hasDup
          ? "저장되었습니다. (중복 플레이어가 남아있습니다)"
          : "저장되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.log(error);
      setMessage({
        body: "저장 중 오류가 발생했습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    }
  };

  const onDragPlayerEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const newMatchedArray = [...matchedArray];

    // 원 코드 패턴 유지: index에 parentIndex/childIndex 포함
    const draggedPlayer =
      newMatchedArray[source.index.parentIndex].matchedPlayers[
        source.index.childIndex
      ];

    newMatchedArray[source.index.parentIndex].matchedPlayers.splice(
      source.index.childIndex,
      1
    );

    newMatchedArray[destination.index.parentIndex].matchedPlayers.splice(
      destination.index.childIndex,
      0,
      draggedPlayer
    );

    // 전체 재번호
    const allPlayers = newMatchedArray.flatMap((m) => m.matchedPlayers);
    allPlayers.forEach((player, index) => {
      player.playerNumber = index + startPlayerNumber + 1;
      player.playerIndex = index + startPlayerNumber + 1;
    });

    setMatchedArray(newMatchedArray);

    // ✅ 인덱스가 바뀌므로 선택 초기화
    setSelectedEntries(new Set());
  };

  useEffect(() => {
    fetchPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest]);

  useEffect(() => {
    if (categorysArray.length > 0 && (playersArray?.length || 0) === 0) {
      initEntryList();
    } else if ((playersArray?.length || 0) > 0) {
      // playersAssign 기반으로 matchedArray 재구성
      const grouped = {};
      playersArray.forEach((p) => {
        const key = `${p.contestCategoryId}__${p.contestGradeId}`;
        if (!grouped[key]) {
          const cat = categorysArray.find(
            (c) => c.contestCategoryId === p.contestCategoryId
          );
          const grd = gradesArray.find(
            (g) => g.contestGradeId === p.contestGradeId
          );
          grouped[key] = {
            ...(cat || {}),
            ...(grd || {}),
            matchedPlayers: [],
            matchedGradesLength: 0,
          };
        }
        grouped[key].matchedPlayers.push({ ...p });
      });
      const rebuilt = Object.values(grouped).map((g) => ({
        ...g,
        matchedGradesLength: 1,
      }));
      setMatchedArray(rebuilt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorysArray, gradesArray, entrysArray, playersArray]);

  const PlayerCardView = ({
    player,
    index,
    provided,
    snapshot,
    isDuplicate,
    dupGroupKey,
    entryKey,
  }) => {
    const { playerName, playerGym, playerNumber, createBy, invoiceCreateAt } =
      player;
    const checked = selectedEntries.has(entryKey);

    return (
      <Card
        size="small"
        className={`mb-2 ${
          snapshot.isDragging ? "shadow-lg border-blue-500" : ""
        } ${isDuplicate ? "border-red-400" : ""}`}
        ref={provided.innerRef}
        {...provided.dragHandleProps}
        {...provided.draggableProps}
      >
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <Space>
              <DragOutlined className="text-gray-400" />
              <span className="font-semibold text-base">순번: {index + 1}</span>
            </Space>
            <Space>
              {isDuplicate && (
                <>
                  <Tag color="red">중복</Tag>
                  <Checkbox
                    checked={checked}
                    onChange={(e) => {
                      setSelectedEntries((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(entryKey);
                        else next.delete(entryKey);
                        return next;
                      });
                    }}
                  >
                    삭제 대상
                  </Checkbox>
                </>
              )}
              <Tag color="gold" className="text-base font-semibold px-2 py-0.5">
                {playerNumber}
              </Tag>
            </Space>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{playerName}</span>
              {createBy === "manual" && (
                <Tag
                  color="green"
                  className="flex items-center justify-center gap-1 min-w-[60px]"
                >
                  <TfiWrite />
                  <span>수기</span>
                </Tag>
              )}
              {(createBy === undefined || createBy === "web") && (
                <Tag
                  color="blue"
                  className="flex items-center justify-center gap-1 min-w-[60px]"
                >
                  <TbWorldWww />
                  <span>웹</span>
                </Tag>
              )}
            </div>
            <div className="text-gray-600 text-sm">{playerGym}</div>
            {invoiceCreateAt && (
              <div className="text-gray-500 text-xs flex items-center gap-1">
                <CalendarOutlined />
                {invoiceCreateAt}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const DuplicateSummary = () => {
    const dupEntries = Object.entries(duplicatesMap);
    if (dupEntries.length === 0) return null;

    const selectAll = () => {
      const all = new Set();
      dupEntries.forEach(([, info]) => {
        // 전체 선택(필요 시 info.entries.slice(1)로 "첫 1개 유지" 제안 가능)
        info.entries.forEach((e) => all.add(e.entryKey));
      });
      setSelectedEntries(all);
    };

    const clearAll = () => setSelectedEntries(new Set());

    return (
      <Card className="shadow-sm border-red-200">
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={<div className="font-semibold">중복 감지</div>}
          description={
            <div className="mt-2 text-sm">
              <div className="mb-2">
                <Space wrap>
                  <Button
                    icon={<CheckSquareOutlined />}
                    onClick={selectAll}
                    size="small"
                  >
                    모두 선택
                  </Button>
                  <Button
                    icon={<ClearOutlined />}
                    onClick={clearAll}
                    size="small"
                  >
                    선택 해제
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={deleteSelectedDuplicates}
                    size="small"
                  >
                    선택 항목 삭제
                  </Button>
                </Space>
              </div>
              <Divider className="my-2" />
              <div className="flex flex-col gap-3">
                {dupEntries.map(([groupKey, info]) => (
                  <div key={groupKey} className="border rounded p-2">
                    <div className="mb-1">
                      <Tag color="red">중복 {info.entries.length}건</Tag>
                      <span className="font-medium ml-2">
                        {info.metaGroup.playerName} (
                        {info.metaGroup.categoryTitle} /{" "}
                        {info.metaGroup.gradeTitle})
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {info.entries.map((e, idx) => {
                        const checked = selectedEntries.has(e.entryKey);
                        return (
                          <div
                            key={e.entryKey}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={checked}
                                onChange={(evt) =>
                                  setSelectedEntries((prev) => {
                                    const next = new Set(prev);
                                    if (evt.target.checked)
                                      next.add(e.entryKey);
                                    else next.delete(e.entryKey);
                                    return next;
                                  })
                                }
                              />
                              <span className="text-xs text-gray-600">
                                항목 {idx + 1} · 선수번호 {e.meta.playerNumber}{" "}
                                · 소속 {e.meta.playerGym || "-"} · 신청일{" "}
                                {e.meta.invoiceCreateAt || "-"}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400">
                              entryKey: {e.entryKey}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          }
        />
      </Card>
    );
  };

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-2 gap-y-2">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <>
          <ConfirmationModal
            isOpen={msgOpen}
            message={message}
            onCancel={() => setMsgOpen(false)}
            onConfirm={() => setMsgOpen(false)}
          />

          {/* ✅ 상단 중복 요약 */}
          <DuplicateSummary />

          <div className="flex w-full justify-end mb-2">
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              className="w-full"
              onClick={() =>
                handleUpdatePlayersAssign(
                  currentContest.contests.contestPlayersAssignId,
                  currentContest.contests.contestPlayersFinalId
                )
              }
            >
              계측명단 저장
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {matchedArray.length > 0 &&
              matchedArray
                .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
                .map((matched, mIdx) => {
                  const {
                    contestCategoryTitle: categoryTitle,
                    contestGradeTitle: gradeTitle,
                    contestGradeId,
                    matchedPlayers = [],
                  } = matched;

                  if (matchedPlayers.length === 0) return null;

                  return (
                    <Card
                      key={`${contestGradeId}_${mIdx}`}
                      title={
                        <span className="text-lg font-semibold">
                          {categoryTitle} / {gradeTitle}
                        </span>
                      }
                      className="shadow-sm"
                    >
                      <DragDropContext onDragEnd={onDragPlayerEnd}>
                        <Droppable droppableId={`players_${contestGradeId}`}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                            >
                              {/* 데스크톱 테이블 */}
                              {!isMobile && (
                                <div className="flex flex-col w-full">
                                  <div className="flex w-full border-b-2 border-gray-200 h-12 items-center font-semibold bg-gray-50 px-4 rounded-t-lg">
                                    <div className="flex w-1/12">
                                      <DragOutlined />
                                    </div>
                                    <div className="flex w-1/12">순번</div>
                                    <div className="flex w-2/12">선수번호</div>
                                    <div className="flex w-[30%]">이름</div>
                                    <div className="flex w-3/12">소속</div>
                                    <div className="flex w-3/12">신청일</div>
                                  </div>
                                  {matchedPlayers
                                    .sort(
                                      (a, b) => a.playerIndex - b.playerIndex
                                    )
                                    .map((player, pIdx) => {
                                      const {
                                        playerName,
                                        playerGym,
                                        playerUid,
                                        playerNumber,
                                        createBy,
                                        invoiceCreateAt,
                                      } = player;

                                      const dupGroupKey = `${contestGradeId}__${playerUid}`;
                                      const isDuplicate =
                                        duplicateGroupKeys.has(dupGroupKey);
                                      const entryKey = `${mIdx}:${pIdx}:${playerUid}`;
                                      const checked =
                                        selectedEntries.has(entryKey);

                                      return (
                                        <Draggable
                                          draggableId={playerUid}
                                          index={{
                                            parentIndex: mIdx,
                                            childIndex: pIdx,
                                          }} // 라이브러리 스펙과 다르지만 기존 패턴 유지
                                          key={`${playerUid}_${mIdx}_${pIdx}`}
                                        >
                                          {(provided, snapshot) => (
                                            <div
                                              className={`flex w-full h-14 border-b items-center px-4 hover:bg-gray-50 transition-colors ${
                                                snapshot.isDragging
                                                  ? "bg-blue-50 shadow-lg"
                                                  : ""
                                              } ${
                                                isDuplicate
                                                  ? "border-red-400 bg-red-50/20"
                                                  : "border-gray-200"
                                              }`}
                                              ref={provided.innerRef}
                                              {...provided.dragHandleProps}
                                              {...provided.draggableProps}
                                            >
                                              <div className="flex w-1/12 text-gray-400">
                                                <DragOutlined />
                                              </div>
                                              <div className="flex w-1/12">
                                                {pIdx + 1}
                                              </div>
                                              <div className="flex w-2/12">
                                                <Tag
                                                  color="gold"
                                                  className="text-base font-semibold px-2 py-0.5"
                                                >
                                                  {playerNumber}
                                                </Tag>
                                              </div>
                                              <div className="flex w-[30%] items-center gap-2">
                                                {playerName}
                                                {createBy === "manual" && (
                                                  <Tag
                                                    color="green"
                                                    className="flex items-center justify-center gap-1 min-w-[60px]"
                                                  >
                                                    <TfiWrite />
                                                    <span>수기</span>
                                                  </Tag>
                                                )}
                                                {(createBy === undefined ||
                                                  createBy === "web") && (
                                                  <Tag
                                                    color="blue"
                                                    className="flex items-center justify-center gap-1 min-w-[60px]"
                                                  >
                                                    <TbWorldWww />
                                                    <span>웹</span>
                                                  </Tag>
                                                )}
                                                {isDuplicate && (
                                                  <>
                                                    <Tag color="red">중복</Tag>
                                                    <Checkbox
                                                      checked={checked}
                                                      onChange={(e) => {
                                                        setSelectedEntries(
                                                          (prev) => {
                                                            const next =
                                                              new Set(prev);
                                                            if (
                                                              e.target.checked
                                                            )
                                                              next.add(
                                                                entryKey
                                                              );
                                                            else
                                                              next.delete(
                                                                entryKey
                                                              );
                                                            return next;
                                                          }
                                                        );
                                                      }}
                                                    >
                                                      삭제 대상
                                                    </Checkbox>
                                                  </>
                                                )}
                                              </div>
                                              <div className="flex w-3/12">
                                                {playerGym}
                                              </div>
                                              <div className="flex w-3/12 text-gray-600">
                                                {invoiceCreateAt}
                                              </div>
                                            </div>
                                          )}
                                        </Draggable>
                                      );
                                    })}
                                </div>
                              )}

                              {/* 모바일 카드 */}
                              {isMobile && (
                                <div className="flex flex-col w-full gap-2">
                                  {matchedPlayers
                                    .sort(
                                      (a, b) => a.playerIndex - b.playerIndex
                                    )
                                    .map((player, pIdx) => {
                                      const dupGroupKey = `${contestGradeId}__${player.playerUid}`;
                                      const isDuplicate =
                                        duplicateGroupKeys.has(dupGroupKey);
                                      const entryKey = `${mIdx}:${pIdx}:${player.playerUid}`;

                                      return (
                                        <Draggable
                                          draggableId={player.playerUid}
                                          index={{
                                            parentIndex: mIdx,
                                            childIndex: pIdx,
                                          }}
                                          key={`${player.playerUid}_${mIdx}_${pIdx}`}
                                        >
                                          {(provided, snapshot) => (
                                            <PlayerCardView
                                              player={player}
                                              index={pIdx}
                                              provided={provided}
                                              snapshot={snapshot}
                                              isDuplicate={isDuplicate}
                                              dupGroupKey={dupGroupKey}
                                              entryKey={entryKey}
                                            />
                                          )}
                                        </Draggable>
                                      );
                                    })}
                                </div>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    </Card>
                  );
                })}
          </div>
        </>
      )}
    </div>
  );
};

export default ContestPlayerOrderTable;
