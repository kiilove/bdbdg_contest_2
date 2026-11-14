"use client";

import { useContext, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import {
  Layers,
  RotateCcw,
  Save,
  RefreshCw,
  Split,
  Users,
  GripVertical,
} from "lucide-react";
import BibTag from "../components/ui/BibTag";
import { isActiveStagePlayer } from "../utils/playerEntryUtils";
import { buildStageWithSyncedMetadata } from "../utils/stageMetadataUtils";

const ContestStagetable = () => {
  const [isLoading, setIsLoading] = useState(false);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [playersArray, setPlayersArray] = useState([]);
  const [stagesArray, setStagesArray] = useState([]);
  const [stagesInfo, setStagesInfo] = useState({});

  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategoies = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersFinal = useFirestoreGetDocument("contest_players_final");
  const fetchStagesAssign = useFirestoreGetDocument("contest_stages_assign");
  const updateStages = useFirestoreUpdateData("contest_stages_assign");

  const fetchPool = async () => {
    if (!currentContest?.contests?.id) return;

    setIsLoading(true);
    try {
      const [
        returnCategoies,
        returnGrades,
        returnPlayersFinal,
        returnStagesAssign,
      ] = await Promise.all([
        currentContest.contests.contestCategorysListId
          ? fetchCategoies.getDocument(
              currentContest.contests.contestCategorysListId
            )
          : Promise.resolve(null),
        currentContest.contests.contestGradesListId
          ? fetchGrades.getDocument(currentContest.contests.contestGradesListId)
          : Promise.resolve(null),
        currentContest.contests.contestPlayersFinalId
          ? fetchPlayersFinal.getDocument(
              currentContest.contests.contestPlayersFinalId
            )
          : Promise.resolve(null),
        currentContest.contests.contestStagesAssignId
          ? fetchStagesAssign.getDocument(
              currentContest.contests.contestStagesAssignId
            )
          : Promise.resolve(null),
      ]);

      const loadedCategories = returnCategoies?.categorys
        ? [...returnCategoies.categorys].sort(
            (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
          )
        : [];
      const loadedGrades = returnGrades?.grades ? [...returnGrades.grades] : [];
      const loadedPlayers = returnPlayersFinal?.players
        ? [...returnPlayersFinal.players]
        : [];

      setCategoriesArray(loadedCategories);
      setGradesArray(loadedGrades);
      setPlayersArray(loadedPlayers);

      if (returnStagesAssign) {
        setStagesInfo({ ...returnStagesAssign });
        if (returnStagesAssign.stages?.length > 0) {
          fetchStages([...returnStagesAssign.stages]);
        }
      } else {
        setStagesInfo({});
      }
    } catch (error) {
      console.error("무대설정 데이터 로드 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStages = (propData) => {
    console.log(propData);
    setStagesArray([...propData]);
  };

  const handleInitStages = () => {
    const stages = [];
    let stageNumber = 0;

    [...categoriesArray]
      .sort(
        (a, b) =>
          (Number(a?.contestCategoryIndex) || 0) -
          (Number(b?.contestCategoryIndex) || 0)
      )
      .forEach((category) => {
        const {
          contestCategoryId: categoryId,
          contestCategoryTitle: categoryTitle,
          contestCategoryIndex: categoryIndex,
          contestCategoryIsOverall: categoryIsOverall,
          contestCategoryJudgeCount: categoryJudgeCount,
          contestCategorySection: categorySection,
        } = category;
        const matchedGrades = gradesArray.filter(
          (grade) => grade.refCategoryId === categoryId
        );

        if (matchedGrades?.length === 0) {
          return null;
        }
        [...matchedGrades]
          .sort(
            (a, b) =>
              (Number(a?.contestGradeIndex) || 0) -
              (Number(b?.contestGradeIndex) || 0)
          )
          .forEach((grade) => {
            const {
              contestGradeId: gradeId,
              contestGradeTitle: gradeTitle,
              contestGradeIndex: gradeIndex,
            } = grade;

            const matchedPlayers = playersArray.filter(
              (player) =>
                player.contestGradeId === gradeId && isActiveStagePlayer(player)
            );

            if (
              matchedPlayers?.length === 0 &&
              categorySection !== "그랑프리" &&
              !categoryIsOverall
            ) {
              return null;
            }

            stageNumber++;
            const newStageInfo = buildStageWithSyncedMetadata(
              {
                stageId: uuidv4(),
                stageNumber,
              },
              [
                {
                  categoryId,
                  categoryTitle,
                  categoryIndex,
                  categoryJudgeCount,
                  categoryIsOverall,
                  categoryJudgeType: "ranking",
                  categorySection,
                  gradeId,
                  gradeTitle,
                  gradeIndex,
                  playerCount: matchedPlayers.length,
                },
              ],
              categoriesArray,
              playersArray
            );

            stages.push({ ...newStageInfo });
          });
      });
    setStagesArray([...stages]);
  };

  const handleUpdateStages = async (id, propData) => {
    if (!id) {
      setMessage({
        variant: "error",
        title: "무대 배정 문서 확인 필요",
        body: "무대 순서 문서를 확인할 수 없습니다. 대회 데이터 설정을 먼저 확인해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }
    setMessage({
      variant: "loading",
      title: "무대 진행 순서 저장 중",
      body: "설정하신 무대 진행 순서를 저장하고 있습니다.",
      isButton: false,
    });
    setMsgOpen(true);
    try {
      await updateStages.updateData(id, { ...propData });
      setMessage({
        variant: "success",
        title: "무대 진행 순서 저장 완료",
        body: `총 ${(propData?.stages || []).length}개 무대 진행 순서가 저장되었습니다.`,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("무대 설정 저장 오류:", error);
      setMessage({
        variant: "error",
        title: "무대 순서 저장 실패",
        body: "무대 설정을 저장하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    }
  };

  const splitStage = (stageId, gradeIndex) => {
    const stageIndex = stagesArray.findIndex(
      (stage) => stage.stageId === stageId
    );

    if (stageIndex === -1) return;

    const parentStage = stagesArray[stageIndex];
    if (
      !parentStage ||
      !Array.isArray(parentStage.grades) ||
      parentStage.grades.length <= 1
    ) {
      return;
    }

    if (gradeIndex < 0 || gradeIndex >= parentStage.grades.length) {
      return;
    }

    const remainingGrades = [...parentStage.grades];
    const [removedGrade] = remainingGrades.splice(gradeIndex, 1);
    if (!removedGrade || remainingGrades.length === 0) return;

    const updatedParentStage = buildStageWithSyncedMetadata(
      { ...parentStage, stageId: parentStage.stageId },
      remainingGrades,
      categoriesArray,
      playersArray
    );

    const newStage = buildStageWithSyncedMetadata(
      { ...parentStage, stageId: uuidv4() },
      [removedGrade],
      categoriesArray,
      playersArray
    );

    let updatedStagesArray = [...stagesArray];
    updatedStagesArray.splice(stageIndex, 1, updatedParentStage, newStage);

    updatedStagesArray = updatedStagesArray
      .filter((stage) => Array.isArray(stage.grades) && stage.grades.length > 0)
      .map((stage, index) => ({
        ...stage,
        stageNumber: index + 1,
      }));

    setStagesArray(updatedStagesArray);
  };

  const handleRefreshCategories = () => {
    const updatedStages = stagesArray.map((stage) =>
      buildStageWithSyncedMetadata(
        stage,
        stage.grades || [],
        categoriesArray,
        playersArray
      )
    );

    [...categoriesArray]
      .sort(
        (a, b) =>
          (Number(a?.contestCategoryIndex) || 0) -
          (Number(b?.contestCategoryIndex) || 0)
      )
      .forEach((category) => {
        const matchedGrades = gradesArray
          .filter((grade) => grade.refCategoryId === category.contestCategoryId)
          .sort(
            (a, b) =>
              (Number(a?.contestGradeIndex) || 0) -
              (Number(b?.contestGradeIndex) || 0)
          );

        if (matchedGrades?.length === 0) return;

        const isGrandPrixOrOverall =
          category.contestCategorySection === "그랑프리" ||
          Boolean(category.contestCategoryIsOverall);

        matchedGrades.forEach((grade) => {
          const matchedPlayers = playersArray.filter(
            (player) =>
              player.contestGradeId === grade.contestGradeId &&
              isActiveStagePlayer(player)
          );

          if (!isGrandPrixOrOverall && matchedPlayers.length === 0) {
            return;
          }

          const isAlreadyInStage = updatedStages.some((stage) =>
            (stage.grades || []).some((g) => g.gradeId === grade.contestGradeId)
          );

          if (!isAlreadyInStage) {
            const newStageInfo = buildStageWithSyncedMetadata(
              {
                stageId: uuidv4(),
                stageNumber: updatedStages.length + 1,
              },
              [
                {
                  categoryId: category.contestCategoryId,
                  categoryTitle: category.contestCategoryTitle,
                  categoryIndex: category.contestCategoryIndex,
                  categoryJudgeCount: category.contestCategoryJudgeCount,
                  categoryIsOverall: category.contestCategoryIsOverall,
                  categoryJudgeType: "ranking",
                  categorySection: category.contestCategorySection,
                  gradeId: grade.contestGradeId,
                  gradeTitle: grade.contestGradeTitle,
                  gradeIndex: grade.contestGradeIndex,
                  playerCount: matchedPlayers.length,
                },
              ],
              categoriesArray,
              playersArray
            );

            updatedStages.push(newStageInfo);
          }
        });
      });

    setStagesArray(
      updatedStages.map((stage, idx) => ({
        ...stage,
        stageNumber: idx + 1,
      }))
    );
  };

  const onDragEnd = (result) => {
    const { destination, source, type } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === "STAGE") {
      const newStagesArray = Array.from(stagesArray);
      const [removed] = newStagesArray.splice(source.index, 1);
      newStagesArray.splice(destination.index, 0, removed);

      setStagesArray(
        newStagesArray.map((stage, idx) => ({
          ...stage,
          stageNumber: idx + 1,
        }))
      );
      return;
    }

    const start = stagesArray.find(
      (stage) => stage.stageId === source.droppableId
    );
    const finish = stagesArray.find(
      (stage) => stage.stageId === destination.droppableId
    );

    if (!start || !finish) return;

    if (start === finish) {
      const newGradeIds = Array.from(start.grades || []);
      const [removed] = newGradeIds.splice(source.index, 1);
      newGradeIds.splice(destination.index, 0, removed);

      const newStage = buildStageWithSyncedMetadata(
        start,
        newGradeIds,
        categoriesArray,
        playersArray
      );

      const newStagesArray = stagesArray
        .map((stage) => (stage.stageId === start.stageId ? newStage : stage))
        .filter((stage) => (stage.grades || []).length !== 0)
        .map((stage, idx) => ({
          ...stage,
          stageNumber: idx + 1,
        }));

      setStagesArray(newStagesArray);
      return;
    }

    const startGradeIds = Array.from(start.grades || []);
    const [removed] = startGradeIds.splice(source.index, 1);
    const newStart =
      startGradeIds.length > 0
        ? buildStageWithSyncedMetadata(
            start,
            startGradeIds,
            categoriesArray,
            playersArray
          )
        : {
            ...start,
            grades: [],
          };

    const finishGradeIds = Array.from(finish.grades || []);
    finishGradeIds.splice(destination.index, 0, removed);
    const newFinish = buildStageWithSyncedMetadata(
      finish,
      finishGradeIds,
      categoriesArray,
      playersArray
    );

    const newStagesArray = stagesArray
      .map((stage) => {
        if (stage.stageId === start.stageId) {
          return newStart;
        }
        if (stage.stageId === finish.stageId) {
          return newFinish;
        }
        return stage;
      })
      .filter((stage) => (stage.grades || []).length !== 0)
      .map((stage, idx) => ({
        ...stage,
        stageNumber: idx + 1,
      }));

    setStagesArray(newStagesArray);
  };

  useEffect(() => {
    if (!currentContest?.contests?.id) return;
    if (stagesInfo?.stages?.length > 0) {
      fetchStages([...stagesInfo.stages]);
    } else if (categoriesArray.length > 0 && gradesArray.length > 0) {
      handleInitStages(currentContest.contests.id);
    }
  }, [stagesInfo, currentContest?.contests?.id, categoriesArray, gradesArray]);

  useEffect(() => {
    if (
      currentContest?.contests?.id &&
      currentContest?.contests?.contestCategorysListId
    ) {
      fetchPool();
    }
  }, [currentContest?.contests?.id, currentContest?.contests?.contestCategorysListId]);

  return (
    <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-5">
          <ConfirmationModal
            isOpen={msgOpen}
            message={message}
            onCancel={() => setMsgOpen(false)}
            onConfirm={() => setMsgOpen(false)}
          />

          <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] flex items-center justify-center">
                <Layers
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[#171717] m-0 tracking-tight">
                  무대 설정 (4단계)
                </h1>
                <p className="text-xs text-[#737373] m-0">
                  무대 진행 순서 변경, 체급 통합 및 분리 설정
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleInitStages(currentContest?.contests?.id)}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer"
              >
                <RotateCcw
                  size={15}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
                <span>초기화 (계측명단 변동 반영)</span>
              </button>
              <button
                type="button"
                onClick={() => handleRefreshCategories()}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] text-xs font-medium border border-[#171717]/[0.08] transition-colors duration-150 cursor-pointer"
              >
                <RefreshCw
                  size={15}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
                <span>종목 새로고침</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleUpdateStages(
                    currentContest?.contests?.contestStagesAssignId,
                    {
                      ...stagesInfo,
                      stages: [...stagesArray],
                    }
                  );
                }}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors duration-150 cursor-pointer border-0"
              >
                <Save size={15} strokeWidth={1.5} />
                <span>무대 설정 저장</span>
              </button>
            </div>
          </div>

          <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4">
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="stages" type="STAGE">
                {(provided) => (
                  <div
                    className="flex gap-y-3 flex-col w-full"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {stagesArray.map((stage, sIdx) => {
                      const { stageId, stageNumber, grades } = stage;

                      return (
                        <Draggable
                          draggableId={stageId}
                          index={sIdx}
                          key={stageId}
                        >
                          {(provided, snapshot) => (
                            <div
                              className="flex w-full h-auto"
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <div
                                className={`w-full rounded-[12px] border overflow-hidden transition-colors duration-150 ${
                                  snapshot.isDragging
                                    ? "bg-[#ffffff] border-[#2563eb] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                                    : "bg-[#ffffff] border-[#171717]/[0.08]"
                                }`}
                              >
                                <div className="bg-[#f4f4f5] px-4 py-2.5 border-b border-[#171717]/[0.08] flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <GripVertical
                                      size={15}
                                      strokeWidth={1.5}
                                      className="text-[#737373]"
                                    />
                                    <span className="text-xs font-medium text-[#525252]">
                                      무대 순서
                                    </span>
                                    <BibTag
                                      prefix="#"
                                      number={stageNumber}
                                      size="sm"
                                    />
                                  </div>
                                  <span className="text-xs text-[#737373] font-mono tabular-nums">
                                    {(grades || []).length}개 체급
                                  </span>
                                </div>

                                <div className="p-3">
                                  <Droppable
                                    droppableId={stageId}
                                    type="DRAG_ITEM"
                                  >
                                    {(provided) => (
                                      <div
                                        className="flex w-auto gap-2 flex-col"
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                      >
                                        {(grades || []).map((grade, gIdx) => {
                                          const {
                                            categoryTitle,
                                            gradeTitle,
                                            playerCount,
                                          } = grade;
                                          const gradeDragId = `${stageId}::${
                                            grade.gradeId || gIdx
                                          }`;

                                          return (
                                            <Draggable
                                              draggableId={gradeDragId}
                                              index={gIdx}
                                              key={gradeDragId}
                                            >
                                              {(provided, snapshot) => (
                                                <div
                                                  ref={provided.innerRef}
                                                  {...provided.draggableProps}
                                                  {...provided.dragHandleProps}
                                                >
                                                  <div
                                                    className={`rounded-[8px] border px-3.5 py-2.5 transition-colors duration-150 ${
                                                      snapshot.isDragging
                                                        ? "bg-[#2563eb]/[0.05] border-[#2563eb]/40 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                                                        : "bg-[#fafafa] hover:bg-[#f4f4f5]/60 border-[#171717]/[0.08]"
                                                    }`}
                                                  >
                                                    <div className="flex items-center justify-between gap-3">
                                                      <div className="flex items-center gap-2.5 flex-1 flex-wrap">
                                                        <GripVertical
                                                          size={14}
                                                          strokeWidth={1.5}
                                                          className="text-[#737373]"
                                                        />
                                                        <span className="text-sm font-medium text-[#171717]">
                                                          {categoryTitle}
                                                          <span className="text-[#737373] mx-1.5 font-normal">
                                                            ·
                                                          </span>
                                                          {gradeTitle}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#ffffff] border border-[#171717]/[0.08] text-xs font-medium text-[#525252] font-mono tabular-nums">
                                                          <Users
                                                            size={12}
                                                            strokeWidth={1.5}
                                                            className="text-[#737373]"
                                                          />
                                                          <span>
                                                            {playerCount}명
                                                          </span>
                                                        </span>
                                                      </div>
                                                      <button
                                                        type="button"
                                                        disabled={
                                                          (grades?.length ||
                                                            0) <= 1
                                                        }
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                          splitStage(
                                                            stageId,
                                                            gIdx
                                                          );
                                                        }}
                                                        className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                                      >
                                                        <Split
                                                          size={13}
                                                          strokeWidth={1.5}
                                                          className="text-[#525252]"
                                                        />
                                                        <span>분리</span>
                                                      </button>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                            </Draggable>
                                          );
                                        })}
                                        {provided.placeholder}
                                      </div>
                                    )}
                                  </Droppable>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContestStagetable;
