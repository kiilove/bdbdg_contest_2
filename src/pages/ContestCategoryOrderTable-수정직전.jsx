import { Modal } from "@mui/material";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import CategoryInfoModal from "../modals/CategoryInfoModal";
import GradeInfoModal from "../modals/GradeInfoModal";
import { MdOutlineSearch } from "react-icons/md";
import { TbEdit } from "react-icons/tb";
import { HiOutlineTrash } from "react-icons/hi";
import GrandPrixInfoModal from "../modals/GrandPrixInfoModal";

const ContestCategoryOrderTable = () => {
  const [categoriesList, setCategoriesList] = useState({});
  const [categoriesArray, setCategoriesArray] = useState([]);

  const [gradesArray, setGradesArray] = useState([]);
  const [isOpen, setIsOpen] = useState({
    category: false,
    grade: false,
    player: false,
    categoryId: "",
    gradeId: "",
  });

  const [isRefresh, setIsRefresh] = useState(false);
  const { currentContest } = useContext(CurrentContestContext);
  const fetchCategroyDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const contestCategoryUpdate = useFirestoreUpdateData(
    "contest_categorys_list"
  );

  const fetchPool = async () => {
    const returnCategories = await fetchCategroyDocument.getDocument(
      currentContest.contests.contestCategorysListId
    );

    const returnGrades = await fetchGradeDocument.getDocument(
      currentContest.contests.contestGradesListId
    );

    if (returnCategories) {
      setCategoriesList(returnCategories);
      setCategoriesArray([
        ...returnCategories?.categorys.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        ),
      ]);
    }

    if (returnGrades) {
      setGradesArray([...returnGrades?.grades]);
    }
  };

  const onDragCategoryEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) {
      return;
    }

    const dummy = [...categoriesArray];
    const [reorderCategory] = dummy.splice(source.index, 1);
    dummy.splice(destination.index, 0, reorderCategory);
    handleSaveCategorys(handleReOrderCategory(dummy));
    setCategoriesArray(handleReOrderCategory(dummy));
  };

  const handleReOrderCategory = (data) => {
    const prevOrder = [...data];
    let newOrder = [];
    prevOrder.map((item, idx) =>
      newOrder.push({ ...item, contestCategoryIndex: idx + 1 })
    );

    return newOrder;
  };

  const handleSaveCategorys = async (data) => {
    try {
      await contestCategoryUpdate.updateData(
        currentContest.contests.contestCategorysListId,
        { ...categoriesList, categorys: [...data] }
      );
    } catch (error) {
      console.log(error);
    }
  };

  const handleGrandPrixClose = () => {
    setIsOpen(() => ({
      grandPrix: false,
      title: "",
      info: {},
      categoryId: "",
      categoryTitle: "",
      gradeId: "",
    }));
  };

  const handleCategoryClose = () => {
    setIsOpen(() => ({
      category: false,
      title: "",
      info: {},
      categoryId: "",
      categoryTitle: "",
      gradeId: "",
    }));
  };

  const handleGradeClose = () => {
    setIsOpen((prevState) => ({
      ...prevState,
      grade: false,
      title: "",
      info: {},
      categoryId: "",
      categoryTitle: "",
      gradeId: "",
    }));
  };

  useEffect(() => {
    if (currentContest?.contests.id) {
      fetchPool();
    }
  }, [currentContest]);
  useEffect(() => {
    if (isRefresh) {
      fetchPool();
    }
  }, [isRefresh]);
  return (
    <div className="flex flex-col lg:flex-row gap-y-2 w-full h-auto bg-white mb-3 rounded-tr-lg rounded-b-lg p-2 gap-x-4">
      <Modal open={isOpen.grandPrix} onClose={handleGrandPrixClose}>
        <div
          className="flex w-full lg:w-full h-screen lg:h-auto absolute top-1/2 left-1/2 lg:shadow-md lg:rounded-lg bg-white p-3"
          style={{
            transform: "translate(-50%, -50%)",
          }}
        >
          <GrandPrixInfoModal
            setClose={handleGrandPrixClose}
            propState={isOpen}
            setState={setCategoriesArray}
            setRefresh={setIsRefresh}
          />
        </div>
      </Modal>
      <Modal open={isOpen.category} onClose={handleCategoryClose}>
        <div
          className="flex w-full lg:w-1/3 h-screen lg:h-auto absolute top-1/2 left-1/2 lg:shadow-md lg:rounded-lg bg-white p-3"
          style={{
            transform: "translate(-50%, -50%)",
          }}
        >
          <CategoryInfoModal
            setClose={handleCategoryClose}
            propState={isOpen}
            setState={setCategoriesArray}
            setRefresh={setIsRefresh}
          />
        </div>
      </Modal>
      <Modal open={isOpen.grade} onClose={handleGradeClose}>
        <div
          className="flex w-full lg:w-1/3 h-screen lg:h-auto absolute top-1/2 left-1/2 lg:shadow-md lg:rounded-lg bg-white p-3"
          style={{
            transform: "translate(-50%, -50%)",
          }}
        >
          <GradeInfoModal
            setClose={handleGradeClose}
            propState={isOpen}
            setState={setGradesArray}
            setRefresh={setIsRefresh}
          />
        </div>
      </Modal>
      <div className="w-full blue-100 flex rounded-lg flex-col p-0 h-full gap-y-2">
        <div className="flex bg-gray-100 w-full h-auto rounded-lg p-2 flex-col gap-y-2">
          <div className="flex w-full justify-start items-center gap-x-1">
            <button
              className="w-1/2 h-12 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-lg"
              onClick={() =>
                setIsOpen({
                  ...isOpen,
                  grandPrix: true,
                  title: "그랑프리추가",
                  count: categoriesArray.length,
                })
              }
            >
              그랑프리추가
            </button>
            <button
              className="w-1/2 h-12 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-lg"
              onClick={() =>
                setIsOpen({
                  ...isOpen,
                  category: true,
                  title: "종목추가",
                  count: categoriesArray.length,
                })
              }
            >
              종목추가
            </button>
          </div>
          <div className="w-full rounded-lg flex flex-col gap-y-2">
            <div className="flex flex-col gap-y-2 w-full">
              {categoriesArray?.length <= 0 ? (
                <div className="h-auto">
                  <div colSpan={3} className="w-full text-center">
                    종목데이터 내용이 없습니다. 다시 불러오기를 누르거나 종목을
                    추가하세요
                  </div>
                </div>
              ) : (
                <div className="flex w-full h-auto">
                  <DragDropContext onDragEnd={onDragCategoryEnd}>
                    <Droppable droppableId="dropCategory">
                      {(p, s) => (
                        <div
                          className="flex w-full flex-col bg-gray-100 rounded-lg gap-y-2"
                          ref={p.innerRef}
                        >
                          {categoriesArray
                            .sort(
                              (a, b) =>
                                a.contestCategoryIndex - b.contestCategoryIndex
                            )
                            .map((category, cIdx) => {
                              const {
                                contestCategoryId: categoryId,
                                contestCategoryIndex: categoryIndex,
                                contestCategoryTitle: categoryTitle,
                                contestCategoryJudgeCount: judgeCount,
                                contestCategorySection: categorySection,
                                contestCategoryJudgeType: categoryJudgeType,
                                contestCategoryIsOverall: categoryIsOverall,
                              } = category;

                              const matchedGrades = gradesArray
                                .filter(
                                  (grade) => grade.refCategoryId === categoryId
                                )
                                .sort(
                                  (a, b) =>
                                    a.contestGradeIndex - b.contestGradeIndex
                                );
                              return (
                                <Draggable
                                  key={categoryId}
                                  draggableId={categoryId}
                                  id={categoryId}
                                  index={cIdx}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      className={`${
                                        snapshot.isDragging
                                          ? "flex w-full flex-col bg-blue-400 rounded-lg"
                                          : "flex w-full flex-col bg-blue-200 rounded-lg"
                                      }`}
                                      key={categoryId + cIdx}
                                      id={categoryId + "div"}
                                      ref={provided.innerRef}
                                      {...provided.dragHandleProps}
                                      {...provided.draggableProps}
                                    >
                                      <div className="h-auto w-full flex items-center flex-col lg:flex-row">
                                        <div className="flex w-full lg:w-2/3 h-auto justify-start items-center ">
                                          <div className="w-1/12 h-14 flex justify-start items-center pl-4">
                                            {categoryIndex}
                                          </div>
                                          <div className="w-4/6 h-14 flex justify-start items-center gap-x-2">
                                            {categoryTitle}
                                            <span className="w-auto h-auto p-1 bg-blue-400 rounded-lg text-gray-100 flex justify-center items-center text-sm">
                                              {categorySection}
                                            </span>
                                            <span className="w-auto h-auto p-1 bg-blue-400 rounded-lg text-gray-100 hidden lg:flex justify-center items-center text-sm">
                                              {categoryJudgeType === "ranking"
                                                ? "랭킹"
                                                : "점수"}
                                            </span>
                                            {categoryIsOverall && (
                                              <span className="w-auto h-auto p-1 bg-blue-400 rounded-lg text-gray-100 hidden lg:flex justify-center items-center text-sm">
                                                그랑프리
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex w-full lg:w-1/3 h-auto justify-end items-center">
                                          <div className="w-1/6 h-14 flex justify-end items-center pr-2">
                                            <div className="flex w-full justify-end items-center h-14 gap-x-2">
                                              {categorySection ===
                                              "그랑프리" ? (
                                                <button
                                                  onClick={() =>
                                                    setIsOpen({
                                                      ...isOpen,
                                                      grandPrix: true,
                                                      category: false,
                                                      title: "그랑프리수정",
                                                      categoryId,
                                                      info: { ...category },
                                                      count: gradesArray.length,
                                                    })
                                                  }
                                                >
                                                  <span className="flex px-2 py-1 justify-center items-center bg-sky-500 rounded-lg text-gray-100 h-10">
                                                    <TbEdit className=" text-xl text-gray-100" />
                                                  </span>
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={() =>
                                                    setIsOpen({
                                                      ...isOpen,
                                                      category: true,
                                                      title: "종목수정",
                                                      categoryId,
                                                      info: { ...category },
                                                      count: gradesArray.length,
                                                    })
                                                  }
                                                >
                                                  <span className="flex px-2 py-1 justify-center items-center bg-sky-500 rounded-lg text-gray-100 h-10">
                                                    <TbEdit className=" text-xl text-gray-100" />
                                                  </span>
                                                </button>
                                              )}

                                              <button>
                                                <span className="flex px-2 py-1 justify-center items-center bg-sky-500 rounded-lg text-gray-100 h-10">
                                                  <HiOutlineTrash className=" text-xl text-gray-100" />
                                                </span>
                                              </button>
                                              <button
                                                className="flex"
                                                onClick={() =>
                                                  setIsOpen({
                                                    ...isOpen,
                                                    grade: true,
                                                    title: "체급추가",
                                                    categoryId,
                                                    categoryTitle,
                                                    info: { ...category },
                                                  })
                                                }
                                              >
                                                <span className="flex px-2 py-1 justify-center items-center bg-orange-600 rounded-lg text-gray-100 h-10 w-20">
                                                  체급추가
                                                </span>
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex w-full px-2 pb-2 h-auto flex-wrap">
                                        <DragDropContext>
                                          <Droppable droppableId="dropGrade">
                                            {(p2, s2) => (
                                              <div
                                                className="flex bg-blue-100 w-full gap-2 p-2 rounded-lg h-auto flex-wrap"
                                                ref={p2.innerRef}
                                              >
                                                {matchedGrades?.length > 0 &&
                                                  matchedGrades.map(
                                                    (match, mIdx) => {
                                                      const {
                                                        contestGradeId: gradeId,
                                                        contestGradeTitle:
                                                          gradeTitle,
                                                        contestGradeIndex:
                                                          gradeIndex,
                                                      } = match;
                                                      return (
                                                        <div
                                                          className="flex items-center justify-start bg-white px-2 py-1 rounded-lg gap-2 h-auto w-full lg:w-auto"
                                                          key={gradeId + mIdx}
                                                          id={gradeId + "grade"}
                                                        >
                                                          <div className="flex w-full">
                                                            <span className="mr-5 text-sm">
                                                              {gradeTitle}
                                                            </span>
                                                          </div>
                                                          <div className="flex w-full justify-end gap-x-2">
                                                            <button
                                                              className="bg-blue-100 w-10 h-10 rounded-lg flex justify-center items-center"
                                                              onClick={() =>
                                                                setIsOpen({
                                                                  ...isOpen,
                                                                  grade: true,
                                                                  title:
                                                                    "체급수정",
                                                                  gradeId:
                                                                    gradeId,
                                                                  info: {
                                                                    ...match,
                                                                  },
                                                                  categoryTitle,
                                                                  count:
                                                                    gradesArray.length,
                                                                })
                                                              }
                                                            >
                                                              <TbEdit className=" text-xl text-gray-500" />
                                                            </button>
                                                            <button className="bg-blue-100 w-10 h-10 rounded-lg flex justify-center items-center hover:cursor-pointer">
                                                              <HiOutlineTrash className=" text-xl text-gray-500" />
                                                            </button>
                                                          </div>
                                                        </div>
                                                      );
                                                    }
                                                  )}
                                                {p2.placeholder}
                                              </div>
                                            )}
                                          </Droppable>
                                        </DragDropContext>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                          {p.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContestCategoryOrderTable;
