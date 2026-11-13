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

  const handleInitStages = (contestId) => {
    const stages = [];
    let stageNumber = 0;

    categoriesArray
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .forEach((category) => {
        console.log(category);
        const {
          contestCategoryId: categoryId,
          contestCategoryTitle: categoryTitle,
          contestCategoryIndex: categoryIndex,
          contestCategoryIsOverall: categoryIsOverall,
          contestCategoryJudgeType: categoryJudgeType,
          contestCategoryJudgeCount: categoryJudgeCount,
          contestCategorySection: categorySection,
        } = category;
        const matchedGrades = gradesArray.filter(
          (grade) => grade.refCategoryId === categoryId
        );

        if (matchedGrades?.length === 0) {
          return null;
        }
        matchedGrades
          .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex)
          .forEach((grade) => {
            const {
              contestGradeId: gradeId,
              contestGradeTitle: gradeTitle,
              contestGradeIndex: gradeIndex,
            } = grade;

            const matchedPlayers = playersArray.filter(
              (player) =>
                player.contestGradeId === gradeId &&
                player.playerNoShow === false
            );

            if (matchedPlayers?.length === 0) {
              return null;
            }

            stageNumber++;
            const newStageInfo = {
              stageId: uuidv4(),
              stageNumber,
              categoryJudgeCount,
              categoryId,
              categoryTitle,
              categoryIsOverall,
              categoryJudgeType,
              categorySection,
              grades: [
                {
                  categoryId,
                  categoryTitle,
                  categoryIndex,
                  categoryJudgeCount,
                  gradeId,
                  gradeTitle,
                  gradeIndex,
                  playerCount: matchedPlayers?.length,
                },
              ],
            };

            stages.push({ ...newStageInfo });
          });
      });
    setStagesArray([...stages]);
  };

  const handleUpdateStages = async (id, propData) => {
    if (!id) {
      setMessage({
        body: "무대 배정 문서를 확인할 수 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }
    try {
      await updateStages.updateData(id, { ...propData });
      setMessage({
        body: "저장되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error("무대 설정 저장 오류:", error);
      setMessage({
        body: "저장 중 오류가 발생했습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    }
  };

  const buildStageWithMetadata = (baseStage, primaryGrade) => {
    const matchedCat = (categoriesArray || []).find(
      (c) => c?.contestCategoryId === primaryGrade?.categoryId
    );
    const resolvedSection =
      matchedCat?.contestCategorySection ??
      primaryGrade?.categorySection ??
      baseStage?.categorySection ??
      baseStage?.section;

    return {
      ...baseStage,
      categoryId:
        matchedCat?.contestCategoryId ??
        primaryGrade?.categoryId ??
        baseStage?.categoryId,
      categoryTitle:
        matchedCat?.contestCategoryTitle ??
        primaryGrade?.categoryTitle ??
        baseStage?.categoryTitle,
      categoryJudgeCount:
        matchedCat?.contestCategoryJudgeCount ??
        primaryGrade?.categoryJudgeCount ??
        baseStage?.categoryJudgeCount,
      categoryIsOverall:
        matchedCat?.contestCategoryIsOverall ??
        primaryGrade?.categoryIsOverall ??
        baseStage?.categoryIsOverall,
      categoryJudgeType:
        matchedCat?.contestCategoryJudgeType ??
        primaryGrade?.categoryJudgeType ??
        baseStage?.categoryJudgeType,
      categorySection: resolvedSection,
      ...(baseStage?.section !== undefined || resolvedSection !== undefined
        ? { section: baseStage?.section ?? resolvedSection }
        : {}),
    };
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

    const updatedParentStage = {
      ...buildStageWithMetadata(parentStage, remainingGrades[0]),
      stageId: parentStage.stageId,
      grades: remainingGrades,
    };

    const newStage = {
      ...buildStageWithMetadata(parentStage, removedGrade),
      stageId: uuidv4(),
      grades: [removedGrade],
    };

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
    const updatedStages = [...stagesArray];

    categoriesArray
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .forEach((category) => {
        const matchedGrades = gradesArray.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );

        if (matchedGrades?.length === 0) return;

        matchedGrades.forEach((grade) => {
          const matchedPlayers =
            category.contestCategorySection === "그랑프리"
              ? []
              : playersArray.filter(
                  (player) =>
                    player.contestGradeId === grade.contestGradeId &&
                    player.playerNoShow === false
                );

          if (
            category.contestCategorySection !== "그랑프리" &&
            matchedPlayers.length === 0
          )
            return;

          const isAlreadyInStage = updatedStages.some((stage) =>
            stage.grades.some((g) => g.gradeId === grade.contestGradeId)
          );

          if (!isAlreadyInStage) {
            const newStageInfo = {
              stageId: uuidv4(),
              stageNumber: updatedStages.length + 1,
              categoryJudgeCount: category.contestCategoryJudgeCount,
              categoryId: category.contestCategoryId,
              categoryTitle: category.contestCategoryTitle,
              categoryIsOverall: category.contestCategoryIsOverall,
              categoryJudgeType: category.contestCategoryJudgeType,
              categorySection: category.contestCategorySection,
              grades: [
                {
                  categoryId: category.contestCategoryId,
                  categoryTitle: category.contestCategoryTitle,
                  categoryIndex: category.contestCategoryIndex,
                  categoryJudgeCount: category.contestCategoryJudgeCount,
                  gradeId: grade.contestGradeId,
                  gradeTitle: grade.contestGradeTitle,
                  gradeIndex: grade.contestGradeIndex,
                  playerCount:
                    category.contestCategorySection === "그랑프리"
                      ? 0
                      : matchedPlayers?.length,
                },
              ],
            };

            console.log(newStageInfo);

            updatedStages.push(newStageInfo);
          }
        });
      });

    setStagesArray([...updatedStages]);
  };

  const onDragEnd = (result) => {
    const { destination, source, draggableId, type } = result;

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

      const newStage = {
        ...start,
        grades: newGradeIds,
      };

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
    const newStart = {
      ...start,
      grades: startGradeIds,
    };

    const finishGradeIds = Array.from(finish.grades || []);
    finishGradeIds.splice(destination.index, 0, removed);
    const newFinish = {
      ...finish,
      grades: finishGradeIds,
    };

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
        <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
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

                                          return (
                                            <Draggable
                                              draggableId={`${stageId}-${gIdx}`}
                                              index={gIdx}
                                              key={`${stageId}-${gIdx}`}
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
