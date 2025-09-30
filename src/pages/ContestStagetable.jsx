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
import { Card, Button, Tag, Space } from "antd";
import {
  AppstoreOutlined,
  ReloadOutlined,
  SaveOutlined,
  SyncOutlined,
  SplitCellsOutlined,
  TeamOutlined,
} from "@ant-design/icons";

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
    const returnCategoies = await fetchCategoies.getDocument(
      currentContest.contests.contestCategorysListId
    );
    const returnGrades = await fetchGrades.getDocument(
      currentContest.contests.contestGradesListId
    );
    const returnPlayersFinal = await fetchPlayersFinal.getDocument(
      currentContest.contests.contestPlayersFinalId
    );

    const returnStagesAssign = await fetchStagesAssign.getDocument(
      currentContest.contests.contestStagesAssignId
    );

    if (returnCategoies) {
      setCategoriesArray([
        ...returnCategoies.categorys.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        ),
      ]);
    }

    if (returnGrades) {
      setGradesArray([...returnGrades.grades]);
    }

    if (returnPlayersFinal) {
      setPlayersArray([...returnPlayersFinal.players]);
      console.log(returnPlayersFinal.players);
    }

    if (returnStagesAssign) {
      setStagesInfo({ ...returnStagesAssign });
      if (returnStagesAssign.stages.length > 0) {
        fetchStages([...returnStagesAssign.stages]);
      }
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
    console.log(id);
    try {
      await updateStages.updateData(id, { ...propData }).then((data) => {
        console.log(propData);
        console.log(data);
        setMessage({
          body: "저장되었습니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
      });
    } catch (error) {
      console.log(error);
    }
  };

  const splitStage = (stageId, gradeIndex) => {
    let updatedStagesArray = [...stagesArray];
    const stageIndex = updatedStagesArray.findIndex(
      (stage) => stage.stageId === stageId
    );

    if (stageIndex === -1) return;

    const [removedGrade] = updatedStagesArray[stageIndex].grades.splice(
      gradeIndex,
      1
    );

    const newStage = {
      stageId: uuidv4(),
      grades: [removedGrade],
    };

    updatedStagesArray.splice(stageIndex + 1, 0, newStage);

    updatedStagesArray = updatedStagesArray.map((stage, index) => ({
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

      newStagesArray.forEach((stage, idx) => {
        stage.stageNumber = idx + 1;
      });

      setStagesArray(newStagesArray);
      return;
    }

    const start = stagesArray.find(
      (stage) => stage.stageId === source.droppableId
    );
    const finish = stagesArray.find(
      (stage) => stage.stageId === destination.droppableId
    );

    if (start === finish) {
      const newGradeIds = Array.from(start.grades);
      const [removed] = newGradeIds.splice(source.index, 1);
      newGradeIds.splice(destination.index, 0, removed);

      const newStage = {
        ...start,
        grades: newGradeIds,
      };

      let newStagesArray = stagesArray.map((stage) =>
        stage.stageId === start.stageId ? newStage : stage
      );

      newStagesArray = newStagesArray.filter(
        (stage) => stage.grades.length !== 0
      );

      newStagesArray.forEach((stage, idx) => {
        stage.stageNumber = idx + 1;
      });

      setStagesArray(newStagesArray);
      return;
    }

    const startGradeIds = Array.from(start.grades);
    const [removed] = startGradeIds.splice(source.index, 1);
    const newStart = {
      ...start,
      grades: startGradeIds,
    };

    const finishGradeIds = Array.from(finish.grades);
    finishGradeIds.splice(destination.index, 0, removed);
    const newFinish = {
      ...finish,
      grades: finishGradeIds,
    };

    let newStagesArray = stagesArray.map((stage) => {
      if (stage.stageId === start.stageId) {
        return newStart;
      }
      if (stage.stageId === finish.stageId) {
        return newFinish;
      }
      return stage;
    });

    newStagesArray = newStagesArray.filter(
      (stage) => stage.grades.length !== 0
    );

    newStagesArray.forEach((stage, idx) => {
      stage.stageNumber = idx + 1;
    });

    setStagesArray(newStagesArray);
  };

  useEffect(() => {
    if (stagesInfo.stages?.length > 0) {
      fetchStages([...stagesInfo.stages]);
    } else {
      handleInitStages(currentContest.contests.id);
    }
  }, [stagesInfo]);

  useEffect(() => {
    if (currentContest?.contests?.contestCategorysListId) {
      fetchPool();
    }
  }, [currentContest]);

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-4 gap-y-4">
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

          <Card className="shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <AppstoreOutlined className="text-white text-xl" />
              </div>
              <h1 className="text-xl font-semibold">무대설정(4단계)</h1>
            </div>
          </Card>

          <Card className="shadow-sm">
            <Space direction="vertical" size="middle" className="w-full">
              <Space wrap className="w-full" size="middle">
                <Button
                  type="default"
                  icon={<ReloadOutlined />}
                  size="large"
                  onClick={() => handleInitStages(currentContest.contests.id)}
                  className="flex-1 min-w-[200px]"
                >
                  초기화(계측명단 변동이 있는경우)
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  size="large"
                  onClick={() => {
                    handleUpdateStages(
                      currentContest.contests.contestStagesAssignId,
                      {
                        ...stagesInfo,
                        stages: [...stagesArray],
                      }
                    );
                  }}
                  className="flex-1 min-w-[200px]"
                >
                  저장(대회진행을 위한 최종명단)
                </Button>
                <Button
                  type="default"
                  icon={<SyncOutlined />}
                  size="large"
                  onClick={() => handleRefreshCategories()}
                  className="flex-1 min-w-[200px]"
                >
                  종목 새로고침
                </Button>
              </Space>
            </Space>
          </Card>

          <Card className="shadow-sm flex-1 overflow-auto">
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
                              <Card
                                className={`w-full transition-shadow ${
                                  snapshot.isDragging
                                    ? "shadow-lg"
                                    : "shadow-sm"
                                }`}
                                title={
                                  <div className="flex items-center gap-2">
                                    <Tag
                                      color="blue"
                                      className="text-base px-3 py-1"
                                    >
                                      무대순서: {stageNumber}
                                    </Tag>
                                  </div>
                                }
                              >
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
                                      {grades.map((grade, gIdx) => {
                                        const {
                                          categoryId,
                                          categoryTitle,
                                          gradeId,
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
                                                <Card
                                                  size="small"
                                                  className={`transition-shadow ${
                                                    snapshot.isDragging
                                                      ? "shadow-md"
                                                      : ""
                                                  }`}
                                                >
                                                  <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2 flex-1">
                                                      <span className="text-sm font-medium">
                                                        {categoryTitle} -{" "}
                                                        {gradeTitle}
                                                      </span>
                                                      <Tag
                                                        color="blue"
                                                        className="flex items-center gap-1"
                                                      >
                                                        <TeamOutlined />
                                                        {playerCount}명
                                                      </Tag>
                                                    </div>
                                                    <Button
                                                      type="primary"
                                                      size="small"
                                                      icon={
                                                        <SplitCellsOutlined />
                                                      }
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        splitStage(
                                                          stageId,
                                                          gIdx
                                                        );
                                                      }}
                                                    >
                                                      분리
                                                    </Button>
                                                  </div>
                                                </Card>
                                              </div>
                                            )}
                                          </Draggable>
                                        );
                                      })}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              </Card>
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
          </Card>
        </>
      )}
    </div>
  );
};

export default ContestStagetable;
