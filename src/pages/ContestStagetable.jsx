import React, { useContext, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { PiSplitHorizontalFill } from "react-icons/pi";
import { AiOutlineGroup } from "react-icons/ai";
import ConfirmationModal from "../messageBox/ConfirmationModal";

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
        const {
          contestCategoryId: categoryId,
          contestCategoryTitle: categoryTitle,
          contestCategoryIndex: categoryIndex,
          contestCategoryIsOverall: categoryIsOverall,
          contestCategoryJudgeType: categoryJudgeType,
          contestCategoryJudgeCount: categoryJudgeCount,
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

    if (stageIndex === -1) return; // stage not found, do nothing

    const [removedGrade] = updatedStagesArray[stageIndex].grades.splice(
      gradeIndex,
      1
    );

    const newStage = {
      stageId: uuidv4(),
      grades: [removedGrade],
    };

    // Insert the new stage after the current one
    updatedStagesArray.splice(stageIndex + 1, 0, newStage);

    // Recalculate stage numbers (optional, as it's not used in state)
    updatedStagesArray = updatedStagesArray.map((stage, index) => ({
      ...stage,
      stageNumber: index + 1,
    }));

    setStagesArray(updatedStagesArray);
  };

  const handleRefreshCategories = () => {
    let updatedStages = [...stagesArray];

    categoriesArray
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .forEach((category) => {
        const matchedGrades = gradesArray.filter(
          (grade) => grade.refCategoryId === category.contestCategoryId
        );

        if (matchedGrades?.length === 0) return;

        matchedGrades.forEach((grade) => {
          // If the category is "그랑프리", skip the player count validation
          const matchedPlayers =
            category.contestCategorySection === "그랑프리"
              ? [] // Allow empty players for Grand Prix
              : playersArray.filter(
                  (player) =>
                    player.contestGradeId === grade.contestGradeId &&
                    player.playerNoShow === false
                );

          // If not "그랑프리" and there are no players, skip
          if (
            category.contestCategorySection !== "그랑프리" &&
            matchedPlayers.length === 0
          )
            return;

          const isAlreadyInStage = updatedStages.some((stage) =>
            stage.grades.some((g) => g.gradeId === grade.contestGradeId)
          );

          // Only add the stage if it's not already present
          if (!isAlreadyInStage) {
            const newStageInfo = {
              stageId: uuidv4(),
              stageNumber: updatedStages.length + 1,
              categoryJudgeCount: category.contestCategoryJudgeCount,
              categoryId: category.contestCategoryId,
              categoryTitle: category.contestCategoryTitle,
              categoryIsOverall: category.contestCategoryIsOverall,
              categoryJudgeType: category.contestCategoryJudgeType,
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
                      ? 0 // No player count for Grand Prix
                      : matchedPlayers?.length,
                },
              ],
            };

            console.log(newStageInfo);

            updatedStages.push(newStageInfo);
          }
        });
      });

    // Set the updated stages with the new categories appended
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
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-2 gap-y-2">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <>
          <div className="flex w-full h-14">
            <ConfirmationModal
              isOpen={msgOpen}
              message={message}
              onCancel={() => setMsgOpen(false)}
              onConfirm={() => setMsgOpen(false)}
            />
            <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
              <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr={3}">
                <AiOutlineGroup />
              </span>
              <h1
                className="font-sans text-lg font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                무대설정(4단계)
              </h1>
            </div>
          </div>
          <div className="flex w-full h-full ">
            <div className="flex w-full justify-start items-center">
              <div className="flex w-full h-full justify-start lg:px-2 lg:pt-2 flex-col bg-gray-100 rounded-lg gap-y-2">
                <div className="flex w-full gap-x-5">
                  <button
                    className="w-full h-12 bg-gradient-to-l from-green-300 to-green-200 rounded-lg"
                    onClick={() => handleInitStages(currentContest.contests.id)}
                  >
                    초기화(계측명단 변동이 있는경우)
                  </button>
                  <button
                    className="w-full h-12 bg-gradient-to-r from-blue-300 to-cyan-200 rounded-lg"
                    onClick={() => {
                      handleUpdateStages(
                        currentContest.contests.contestStagesAssignId,
                        {
                          ...stagesInfo,
                          stages: [...stagesArray],
                        }
                      );
                    }}
                  >
                    저장(대회진행을 위한 최종명단)
                  </button>
                  <button
                    className="w-full h-12 bg-gradient-to-r from-yellow-300 to-orange-200 rounded-lg"
                    onClick={() => handleRefreshCategories()}
                  >
                    종목 새로고침
                  </button>
                </div>
                <div className="flex w-full h-auto bg-blue-300 flex-col rounded-lg gap-y-2">
                  <div className="flex flex-col p-1 lg:p-2 gap-y-2">
                    <DragDropContext onDragEnd={onDragEnd}>
                      <Droppable droppableId="stages" type="STAGE">
                        {(provided) => (
                          <div
                            className="flex gap-y-2 flex-col w-full"
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
                                  {(provided) => (
                                    <div
                                      className="flex w-full h-auto"
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                    >
                                      <div className="flex w-full h-auto p-2 flex-col bg-gray-100 rounded-lg">
                                        <div className="flex h-10 items-center px-2">
                                          <span className="text-sm">
                                            무대순서 : {stageNumber}
                                          </span>
                                        </div>
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
                                                    {(provided) => (
                                                      <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                      >
                                                        <div className="flex p-2 w-auto bg-blue-100 rounded-lg gap-x-2">
                                                          <span className="text-sm flex justify-start items-center">
                                                            {`${categoryTitle}(${gradeTitle})`}
                                                            <div className="flex justify-center items-center w-10 h-5 rounded-full bg-blue-500 text-xs text-gray-100 ml-5">
                                                              {playerCount}
                                                            </div>
                                                          </span>
                                                          <button
                                                            className="flex justify-center items-center w-10 h-5 rounded-full bg-blue-500 text-gray-100"
                                                            onClick={(e) => {
                                                              e.preventDefault();
                                                              e.stopPropagation();
                                                              splitStage(
                                                                stageId,
                                                                gIdx
                                                              );
                                                            }}
                                                          >
                                                            <PiSplitHorizontalFill />
                                                          </button>
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
                                  )}
                                </Draggable>
                              );
                            })}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ContestStagetable;
