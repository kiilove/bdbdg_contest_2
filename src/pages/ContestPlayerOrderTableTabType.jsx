"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import LoadingPage from "./LoadingPage";
import { TfiWrite } from "react-icons/tfi";
import {
  useFirestoreAddData,
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { TbWorldWww } from "react-icons/tb";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import ContestHealthCheckModal from "../modals/ContestHealthCheckModal";
import { Button, Card, Space, Tag, Checkbox, Alert, Divider, Popconfirm } from "antd";
import {
  SaveOutlined,
  DragOutlined,
  CalendarOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  CheckSquareOutlined,
  ClearOutlined,
  ReloadOutlined,
  FolderOpenOutlined,
  WarningOutlined,
} from "@ant-design/icons";

const ContestPlayerOrderTable = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [matchedArray, setMatchedArray] = useState([]);
  const [categorysArray, setCategorysArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [entrysArray, setEntrysArray] = useState([]);
  const [playersAssign, setPlayersAssign] = useState({}); // assign만 관리
  const [startPlayerNumber, setStartPlayerNumber] = useState(1);

  // ✅ 개별 항목 선택 상태 (행 단위: mIdx:pIdx:playerUid)
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [healthModalOpen, setHealthModalOpen] = useState(false);

  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersAssignDocument = useFirestoreGetDocument(
    "contest_players_assign"
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

  // 공통 재배정 유틸: 전체 일련번호/표시순서를 startBase+1부터 부여
  const renumberAll = (arr, startBase) => {
    const allPlayers = arr.flatMap((m) => m.matchedPlayers || []);
    allPlayers.forEach((p, i) => {
      const num = i + startBase + 1;
      p.playerNumber = num;
      p.playerIndex = num;
    });
    return arr;
  };

  const fetchPool = async () => {
    if (!currentContest?.contests) return;
    setIsLoading(true);

    try {
      if (currentContest.contests.startPlayerNumber) {
        // 내부 계산 편의를 위해 -1 보정
        setStartPlayerNumber(currentContest.contests.startPlayerNumber - 1);
      }

      // 카테고리
      if (currentContest.contests.contestCategorysListId) {
        const returnCategorys = await fetchCategoryDocument.getDocument(
          currentContest.contests.contestCategorysListId
        );
        if (returnCategorys?.categorys?.length > 0) {
          setCategorysArray([
            ...returnCategorys.categorys
              .slice()
              .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex),
          ]);
        } else {
          setCategorysArray([]);
        }
      }

      // 그레이드
      if (currentContest.contests.contestGradesListId) {
        const returnGrades = await fetchGradeDocument.getDocument(
          currentContest.contests.contestGradesListId
        );
        setGradesArray([...(returnGrades?.grades || [])]);
      }

      // 엔트리
      const condition = [where("contestId", "==", currentContest.contests.id)];
      const returnEntrys = await fetchEntry.getDocuments(
        "contest_entrys_list",
        condition
      );
      setEntrysArray([...(returnEntrys || [])]);

      // assign (저장본)
      if (currentContest.contests.contestPlayersAssignId) {
        const returnPlayersAssign = await fetchPlayersAssignDocument.getDocument(
          currentContest.contests.contestPlayersAssignId
        );
        setPlayersAssign({ ...(returnPlayersAssign || {}) });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // 엔트리 기준 초기 구성
  const initEntryList = () => {
    const dummy = [];
    let playerNumber = startPlayerNumber;

    const categories = [...categorysArray].sort(
      (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
    );

    categories.forEach((category) => {
      const matchedGrades = [...gradesArray]
        .filter((grade) => grade.refCategoryId === category.contestCategoryId)
        .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex);

      const matchedGradesLength = matchedGrades.length;

      matchedGrades.forEach((grade) => {
        const matchedPlayers = entrysArray.filter(
          (entry) => entry.contestGradeId === grade.contestGradeId
        );

        const withNumbers = matchedPlayers.map((player) => {
          playerNumber++;
          return {
            ...player,
            playerNumber: playerNumber,
            playerNoShow: false,
            playerIndex: playerNumber,
          };
        });

        const matchedInfo = {
          ...category,
          ...grade,
          matchedPlayers: withNumbers,
          matchedGradesLength,
        };
        dummy.push(matchedInfo);
      });
    });

    setMatchedArray(renumberAll(dummy, startPlayerNumber));
    setSelectedEntries(new Set());
  };

  // assign 저장본으로 화면 재구성 (있을 때만)
  const rebuildFromAssign = () => {
    const grouped = {};
    const assigned = playersAssign?.players || [];
    assigned.forEach((p) => {
      const key = `${p.contestCategoryId}__${p.contestGradeId}`;
      if (!grouped[key]) {
        const cat =
          categorysArray.find(
            (c) => c.contestCategoryId === p.contestCategoryId
          ) || {};
        const grd =
          gradesArray.find((g) => g.contestGradeId === p.contestGradeId) || {};
        grouped[key] = {
          ...cat,
          ...grd,
          matchedPlayers: [],
          matchedGradesLength: 1,
        };
      }
      grouped[key].matchedPlayers.push({ ...p });
    });

    const rebuilt = Object.values(grouped);
    setMatchedArray(renumberAll(rebuilt, startPlayerNumber));
    setSelectedEntries(new Set());
  };

  // 초기 데이터 로드
  useEffect(() => {
    fetchPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest]);

  // 카테고리/그레이드/엔트리/assign이 준비되면 화면 데이터 구성
  useEffect(() => {
    if (!categorysArray.length) return;

    // assign 저장본이 있으면 우선 사용, 없으면 엔트리로 초기화
    if (playersAssign?.players?.length > 0) {
      rebuildFromAssign();
    } else {
      initEntryList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    categorysArray,
    gradesArray,
    entrysArray,
    playersAssign,
    startPlayerNumber,
  ]);

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

    setMatchedArray(renumberAll(newMatched, startPlayerNumber));
    setSelectedEntries(new Set());
  };

  // 🧹 assign & final 명단 완전 초기화(클리어) 핸들러
  const handleClearAssignAndFinal = async () => {
    const contestId = currentContest?.contests?.id;
    const assignId = currentContest?.contests?.contestPlayersAssignId;
    const finalId = currentContest?.contests?.contestPlayersFinalId;

    if (!contestId || !assignId) {
      alert("대회 정보 또는 배정 문서 ID를 확인할 수 없습니다.");
      return;
    }

    try {
      setIsLoading(true);
      // 1. assign 문서 비우기
      await updatePlayersAssign.updateData(assignId, {
        contestId,
        players: [],
        updatedAt: Date.now(),
      });

      // 2. final 문서 비우기 (있을 경우)
      if (finalId) {
        await updatePlayersFinal.updateData(finalId, {
          contestId,
          players: [],
          updatedAt: Date.now(),
        });
      }

      setPlayersAssign({ contestId, players: [] });
      setMatchedArray([]);
      setSelectedEntries(new Set());

      setMessage({
        body: "현재 대회의 배정 명단(Assign) 및 최종 명단(Final)이 깨끗하게 초기화(클리어)되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("초기화 실패:", error);
      setMessage({
        body: "초기화 중 오류가 발생했습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 저장은 assign + final 동기화
  const handleUpdatePlayersAssign = async (assignId) => {
    const targetAssignId =
      assignId || currentContest?.contests?.contestPlayersAssignId;

    if (!targetAssignId) {
      setMessage({
        body: "관련 문서를 확인할 수 없습니다. 다시 로그인하시면 해결될 수 있습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    const allPlayers = matchedArray.flatMap((m) => m.matchedPlayers || []);
    const newPlayersAssign = {
      contestId: currentContest?.contests?.id,
      ...playersAssign,
      players: [...allPlayers],
    };

    try {
      setIsLoading(true);
      await updatePlayersAssign.updateData(targetAssignId, newPlayersAssign);

      // 계측 명단 contest_players_final도 함께 동기화
      const targetFinalId = currentContest?.contests?.contestPlayersFinalId;
      if (targetFinalId) {
        await updatePlayersFinal.updateData(targetFinalId, {
          contestId: currentContest?.contests?.id,
          players: [...allPlayers],
        });
      }

      setPlayersAssign({ ...newPlayersAssign, id: targetAssignId });

      const hasDup = Object.keys(duplicatesMap).length > 0;
      setMessage({
        body: hasDup
          ? "저장되었습니다. (중복 플레이어가 남아있습니다)"
          : "계측명단(선수 배정)이 성공적으로 저장되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("선수 배정 저장 에러:", error);
      setMessage({
        body: "저장 중 오류가 발생했습니다: " + (error?.message || ""),
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // DnD: 숫자 index 사용, parent는 droppableId로 구분
  const onDragPlayerEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const fromGradeId = source.droppableId.replace("players_", "");
    const toGradeId = destination.droppableId.replace("players_", "");

    const newMatchedArray = matchedArray.map((m) => ({
      ...m,
      matchedPlayers: [...(m.matchedPlayers || [])],
    }));

    const fromIdx = newMatchedArray.findIndex(
      (m) => m.contestGradeId === fromGradeId
    );
    const toIdx = newMatchedArray.findIndex(
      (m) => m.contestGradeId === toGradeId
    );
    if (fromIdx < 0 || toIdx < 0) return;

    const [dragged] = newMatchedArray[fromIdx].matchedPlayers.splice(
      source.index,
      1
    );
    newMatchedArray[toIdx].matchedPlayers.splice(destination.index, 0, dragged);

    setMatchedArray(renumberAll(newMatchedArray, startPlayerNumber));
    setSelectedEntries(new Set());
  };

  const PlayerCardView = ({
    player,
    index,
    provided,
    snapshot,
    isDuplicate,
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

          <ContestHealthCheckModal
            isOpen={healthModalOpen}
            onClose={() => setHealthModalOpen(false)}
          />

          {!currentContest?.contests?.contestPlayersAssignId && (
            <Alert
              type="warning"
              showIcon
              message="관련 문서를 확인할 수 없습니다."
              description="대회 필수 데이터 구조가 아직 생성되지 않았거나 연결이 누락되었을 수 있습니다."
              action={
                <Button
                  size="small"
                  type="primary"
                  danger
                  onClick={() => setHealthModalOpen(true)}
                  className="font-bold"
                >
                  대회 구조 점검 & 즉시 복구
                </Button>
              }
              className="mb-3"
            />
          )}

          {/* ✅ 상단 중복 요약 */}
          <DuplicateSummary />

          <div className="flex flex-col sm:flex-row w-full justify-between items-center mb-2 gap-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Popconfirm
                title="배정 및 최종 명단 완전 초기화"
                description="현재 대회의 contest_players_assign 및 contest_players_final 문서를 모두 빈 상태로 클리어합니다. 정말 진행하시겠습니까?"
                onConfirm={handleClearAssignAndFinal}
                okText="완전 초기화 실행"
                cancelText="취소"
                okButtonProps={{ danger: true }}
              >
                <Button
                  danger
                  type="dashed"
                  size="large"
                  icon={<DeleteOutlined />}
                  className="font-bold border-red-400 bg-red-50 text-red-700 hover:bg-red-100"
                >
                  배정명단 초기화(비우기)
                </Button>
              </Popconfirm>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                type="default"
                size="large"
                icon={<ReloadOutlined />}
                className="w-full sm:w-auto font-bold"
                onClick={() => initEntryList()}
              >
                신청서 기준 번호 재계산
              </Button>
              <Button
                color="cyan"
                size="large"
                icon={<FolderOpenOutlined />}
                className="w-full sm:w-auto font-bold"
                onClick={() => rebuildFromAssign()}
              >
                저장본 불러오기
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                className="w-full sm:w-auto font-black bg-blue-600 hover:bg-blue-500"
                onClick={() =>
                  handleUpdatePlayersAssign(
                    currentContest.contests.contestPlayersAssignId
                  )
                }
              >
                계측명단 저장(덮어씌우기)
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {matchedArray.length > 0 &&
              [...matchedArray]
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

                                  {[...matchedPlayers]
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
                                          draggableId={`${contestGradeId}::${playerUid}`}
                                          index={pIdx} // 숫자만
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
                                  {[...matchedPlayers]
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
                                          draggableId={`${contestGradeId}::${player.playerUid}`}
                                          index={pIdx}
                                          key={`${player.playerUid}_${mIdx}_${pIdx}`}
                                        >
                                          {(provided, snapshot) => (
                                            <PlayerCardView
                                              player={player}
                                              index={pIdx}
                                              provided={provided}
                                              snapshot={snapshot}
                                              isDuplicate={isDuplicate}
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
