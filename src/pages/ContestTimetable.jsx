import React, { useContext, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

import { MdTimeline, MdOutlineSearch, MdOutlineBalance } from "react-icons/md";
import { Modal } from "@mui/material";
import CategoryInfoModal from "../modals/CategoryInfoModal";
import { useEffect } from "react";
import GradeInfoModal from "../modals/GradeInfoModal.jsx";
import { HiOutlineTrash } from "react-icons/hi";
import { TbEdit, TbUsers } from "react-icons/tb";
import { v4 as uuidv4 } from "uuid";
import {
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import PlayerInfoModal from "../modals/PlayerInfoModal";
import JudgeInfoModal from "../modals/JudgeInfoModal";
import ContestPlayerOrderTableTabType from "./ContestPlayerOrderTableTabType";
import ContestCategoryOrderTable from "./ContestCategoryOrderTable";
import ContestStagetable from "./ContestStagetable";
import { BsClipboardData } from "react-icons/bs";
import { useLocation } from "react-router-dom";
import ContestJudgeAssignTable from "./ContestJudgeAssignTable";
const ContestTimetable = () => {
  const [currentOrders, setCurrentOrders] = useState();
  const [currentTab, setCurrentTab] = useState(0);
  const [categorysArray, setCategorysArray] = useState([]);
  const [categorysList, setCategorysList] = useState({});
  const [gradesArray, setGradesArray] = useState([]);
  const [entrysArray, setEntrysArray] = useState([]);
  const [judgesArray, setJudgesArray] = useState([]);
  const [judgeAssignTable, setJudgeAssignTable] = useState([]);
  const [currentCategoryId, setCurrentCategoryId] = useState("");
  const location = useLocation();
  const [currentSubMenu, setCurrentSubMenu] = useState({
    categoryId: "",
    gradeId: "",
    player: false,
    judge: false,
  });
  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );

  const [isOpen, setIsOpen] = useState({
    category: false,
    grade: false,
    player: false,
    categoryId: "",
    gradeId: "",
  });

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );

  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const contestCategoryUpdate = useFirestoreUpdateData(
    "contest_categorys_list"
  );
  const fetchEntry = useFirestoreQuery();
  const fetchJudge = useFirestoreQuery();
  const fetchAssign = useFirestoreQuery();

  //심판 배정에서 콜렉션을 새로 만들었는데 왜 예전 데이터가 그대로 살아있는지 체크가 필요함
  const updateAssignTable = useFirestoreUpdateData("contest_judges_assign");
  const updateContests = useFirestoreUpdateData("contests");
  const addAssignTable = useFirestoreAddData("contest_judges_assign");

  const tabArray = [
    {
      id: 0,
      title: "종목/체급진행순서",
      subTitle: "대회진행순서를 먼저 설정합니다.",
      children: "",
    },
    {
      id: 1,
      title: "선수번호배정",
      subTitle: "대회출전을 위한 선수 명단(계측전)입니다.",
      children: "",
    },
    {
      id: 2,
      title: "심판배정",
      subTitle: "종목/체급 심사를 위한 심판을 배정합니다.",
      children: "",
    },
  ];

  const onDragCategoryEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) {
      return;
    }

    const dummy = [...categorysArray];
    const [reorderCategory] = dummy.splice(source.index, 1);
    dummy.splice(destination.index, 0, reorderCategory);
    handleSaveCategorys(handleReOrderCategory(dummy));
    setCategorysArray(handleReOrderCategory(dummy));
  };

  const onDragGradeEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) {
      return;
    }

    const dummy = gradesArray.filter(
      (grade) => grade.refCategoryId === currentCategoryId
    );
    const [reorderGrade] = dummy.splice(source.index, 1);
    dummy.splice(destination.index, 0, reorderGrade);

    setGradesArray(handleReOrderGrade(dummy));
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
        { ...categorysList, categorys: [...data] }
      );
    } catch (error) {
      console.log(error);
    }
  };

  const handleReOrderGrade = (data) => {
    const prevOrder = [...data];
    const dummy = [...gradesArray];
    let newOrder = [];
    prevOrder.map((item, idx) =>
      newOrder.push({ ...item, contestGradeIndex: idx + 1 })
    );
    console.log(newOrder);
    newOrder.map((order, oIdx) => {
      const findIndex = dummy.findIndex(
        (grade) => grade.contestGradeId === order.contestGradeId
      );
      dummy.splice(findIndex, 1, { ...order });
    });
    console.log(dummy);
    return dummy;
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
  const handlePlayerClose = () => {
    setIsOpen((prevState) => ({
      ...prevState,
      player: false,
      title: "",
      info: {},
      categoryId: "",
      categoryTitle: "",
      gradeId: "",
    }));
  };
  const handleJudgeClose = () => {
    setIsOpen((prevState) => ({
      ...prevState,
      judge: false,
      title: "",
      info: {},
      categoryId: "",
      categoryTitle: "",
      gradeId: "",
    }));
  };
  const fetchPool = async () => {
    if (currentContest.contests.contestCategorysListId) {
      const returnCategorys = await fetchCategoryDocument.getDocument(
        currentContest.contests.contestCategorysListId
      );
      setCategorysList({ ...returnCategorys });
      setCategorysArray([
        ...returnCategorys?.categorys.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        ),
      ]);

      const returnGrades = await fetchGradeDocument.getDocument(
        currentContest.contests.contestGradesListId
      );

      setGradesArray([...returnGrades?.grades]);
    }

    const condition = [where("contestId", "==", currentContest.contests.id)];
    const condition2 = [
      where("contestId", "==", currentContest.contests.id),
      where("isJoined", "==", true),
    ];
    const returnEntrys = await fetchEntry.getDocuments(
      "contest_entrys_list",
      condition
    );

    const returnJudges = await fetchJudge.getDocuments(
      "contest_judges_list",
      condition2
    );

    const returnAssign = await fetchAssign.getDocuments(
      "contest_judges_assign",
      condition
    );

    setEntrysArray([...returnEntrys]);
    setJudgesArray([...returnJudges]);
    setJudgeAssignTable([...returnAssign[0].judges]);
    //console.log(returnAssign[0].judges);
  };

  const handleSelectJudge = (judgeId, contestId, categoryId, seatIndex) => {
    const newAssignTable = [...judgeAssignTable];
    const newGradeList = gradesArray.filter(
      (grade) => grade.refCategoryId === categoryId
    );

    const filterAssignTable = newAssignTable.filter(
      (assign) =>
        assign.contestId === contestId &&
        assign.categoryId === categoryId &&
        assign.seatIndex === seatIndex
    );

    const filterJudgeInfo = judgesArray.find((judge) => judge.id === judgeId);

    const addJudgeInGrades = (gradeArray, assignArray) => {
      gradeArray?.length > 0 &&
        gradeArray.map((grade, gIdx) => {
          const { contestGradeId: gradeId, contestGradeTitle: gradeTitle } =
            grade;

          const {
            judgeName,
            judgeUid,
            judgePromoter,
            judgeTel,
            onedayPassword,
          } = filterJudgeInfo;
          const newJudgeInfo = {
            contestId,
            categoryId,
            seatIndex,
            gradeId,
            gradeTitle,
            judgeUid,
            judgeName,
            judgePromoter,
            judgeTel,
            onedayPassword,
          };
          assignArray.push(newJudgeInfo);
        });

      return assignArray;
    };

    const delJugeInGrades = (assignArray, categoryId, seatIndex) => {
      const newAssignArray = assignArray.filter(
        (item) => item.categoryId !== categoryId || item.seatIndex !== seatIndex
      );

      return newAssignArray;
    };

    const handleJudgeAssignTable = () => {
      const newArray = [];
      if (filterAssignTable?.length === 0) {
        newArray.push(
          addJudgeInGrades(newGradeList, newAssignTable).sort(
            (a, b) => a.seatIndex - b.seatIndex
          )
        );
      } else {
        const delArray = delJugeInGrades(newAssignTable, categoryId, seatIndex);

        newArray.push(
          addJudgeInGrades(newGradeList, delArray).sort(
            (a, b) => a.seatIndex - b.seatIndex
          )
        );
      }
      return newArray;
    };

    setJudgeAssignTable(...handleJudgeAssignTable());
  };

  const handleAddAssignTable = async (contestId, assignArray) => {
    try {
      const added = await addAssignTable.addData({
        judges: [...assignArray],
        contestId,
      });
      await updateContests.updateData(contestId, {
        ...currentContest.contests,
        contestJudgeAssignListId: added.id,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleUpdateAssignTable = async (judgeAssignId, assignArray) => {
    try {
      await updateAssignTable
        .updateData(judgeAssignId, { judges: [...assignArray] })
        .then(() => console.log("업데이트완료"));
    } catch (error) {
      console.log(error);
    }
  };

  const initScheduleInfo = () => {
    const scheduleArray = [];
    let stageNumber = 0;
    categorysArray
      .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex)
      .map((category, cIdx) => {
        let schedule = {};
        const {
          contestCategoryId: contestId,
          contestCategoryIndex: contestIndex,
          contestCategoryTitle: contestTitle,
          contestCategory,
        } = category;
        const filteredGrades = gradesArray.filter(
          (grade) => grade.refCategoryId === contestId
        );

        console.log(filteredGrades);

        if (filteredGrades.length > 0) {
          filteredGrades.map((filter, fIdx) => {
            stageNumber++;
            const {
              contestGradeId: gradeId,
              contestGradeTitle: gradeTitle,
              contestGradeIndex: gradeIndex,
            } = filter;

            schedule = {
              ...category,
              stageId: uuidv4(),
              stageNumber,
              matchedGrades: [{ gradeId, gradeTitle, gradeIndex }],
            };
            scheduleArray.push(schedule);
          });
        }
      });
    console.log(scheduleArray);
    return scheduleArray;
  };

  useEffect(() => {
    if (location?.state?.tabId) {
      setCurrentTab(location.state.tabId);
    }
  }, [location]);

  useEffect(() => {
    initScheduleInfo();
  }, []);

  const ContestStagesRender = (
    <div className="flex flex-col lg:flex-row gap-y-2 w-full h-auto bg-white mb-3 rounded-tr-lg rounded-b-lg p-2 gap-x-4">
      <div className="w-full bg-blue-100 flex rounded-lg flex-col p-2 h-full gap-y-2">
        <div className="flex bg-gray-100 h-auto rounded-lg justify-start categoryIdart lg:items-center gay-y-2 flex-col p-2 gap-y-2">
          <div className="flex w-full justify-start items-center">
            <button className="w-full h-12 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-lg">
              스테이지 추가
            </button>
          </div>
        </div>
        <div className="flex bg-gray-100 w-full h-auto rounded-lg p-2">
          <div className="w-full rounded-lg flex flex-col gap-y-2">
            <div className="flex flex-col gap-y-2 w-full">
              {categorysArray?.length <= 0 ? (
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
                          className="flex w-full flex-col bg-blue-100 rounded-lg gap-y-2"
                          ref={p.innerRef}
                        >
                          {gradesArray
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
                                        <div className="flex w-full h-auto justify-start items-center">
                                          <div className="w-1/6 h-14 flex justify-start items-center pl-4">
                                            {categoryIndex}
                                          </div>
                                          <div className="w-4/6 h-14 flex justify-start items-center">
                                            {categoryTitle}
                                            {judgeCount &&
                                              `(${judgeCount}심제)`}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex w-full px-2 pb-2 h-auto flex-wrap"></div>
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

  const ContestOrdersRender = (
    <div className="flex flex-col lg:flex-row gap-y-2 w-full h-auto bg-white mb-3 rounded-tr-lg rounded-b-lg p-2 gap-x-4">
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
            setState={setCategorysArray}
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
          />
        </div>
      </Modal>
      <div className="w-full bg-blue-100 flex rounded-lg flex-col p-2 h-full gap-y-2">
        <div className="flex bg-gray-100 h-auto rounded-lg justify-start categoryIdart lg:items-center gay-y-2 flex-col p-2 gap-y-2">
          <div className="flex w-full justify-start items-center ">
            <div className="h-12 w-full rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <h1 className="text-2xl text-gray-600 mr-3">
                  <MdOutlineSearch />
                </h1>
                <input
                  type="text"
                  name="contestCategoryTitle"
                  className="h-12 outline-none"
                  placeholder="종목검색"
                />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center">
            <button
              className="w-full h-12 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-lg"
              onClick={() =>
                setIsOpen({
                  ...isOpen,
                  category: true,
                  title: "종목추가",
                  count: categorysArray.length,
                })
              }
            >
              종목추가
            </button>
          </div>
        </div>
        <div className="flex bg-gray-100 w-full h-auto rounded-lg p-2">
          <div className="w-full rounded-lg flex flex-col gap-y-2">
            <div className="flex flex-col gap-y-2 w-full">
              {categorysArray?.length <= 0 ? (
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
                          className="flex w-full flex-col bg-blue-100 rounded-lg gap-y-2"
                          ref={p.innerRef}
                        >
                          {categorysArray
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
                                        <div className="flex w-full h-auto justify-start items-center">
                                          <div className="w-1/6 h-14 flex justify-start items-center pl-4">
                                            {categoryIndex}
                                          </div>
                                          <div className="w-4/6 h-14 flex justify-start items-center">
                                            {categoryTitle}
                                            {judgeCount &&
                                              `(${judgeCount}심제)`}
                                          </div>
                                        </div>
                                        <div className="flex w-full h-auto justify-end items-center">
                                          <div className="w-1/6 h-14 flex justify-end items-center pr-2">
                                            <div className="flex w-full justify-end items-center h-14 gap-x-2">
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
                                        <DragDropContext
                                          onDragEnd={onDragGradeEnd}
                                        >
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
                                                            <span className="mr-5">
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
                                                            <div className="flex">
                                                              <button
                                                                className="bg-blue-200 w-10 h-10 rounded-lg flex justify-center items-center "
                                                                onClick={() =>
                                                                  setCurrentSubMenu(
                                                                    {
                                                                      categoryId,
                                                                      gradeId,
                                                                      categoryTitle,
                                                                      gradeTitle,
                                                                      player: true,
                                                                      judge: false,
                                                                    }
                                                                  )
                                                                }
                                                              >
                                                                <TbUsers className="text-xl text-gray-500" />
                                                              </button>
                                                            </div>

                                                            <button
                                                              className="bg-green-100 w-10 h-10 rounded-lg flex justify-center items-center"
                                                              onClick={() =>
                                                                setCurrentSubMenu(
                                                                  {
                                                                    categoryId,
                                                                    gradeId,
                                                                    categoryTitle,
                                                                    gradeTitle,
                                                                    player: false,
                                                                    judge: true,
                                                                  }
                                                                )
                                                              }
                                                            >
                                                              <MdOutlineBalance className=" text-xl text-gray-500" />
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
                                      {currentSubMenu.player &&
                                        currentSubMenu.categoryId ===
                                          categoryId &&
                                        (() => {
                                          if (entrysArray?.length <= 0) {
                                            return;
                                          }
                                          const filtered = entrysArray
                                            .filter(
                                              (e) =>
                                                e.contestGradeId ===
                                                currentSubMenu.gradeId
                                            )
                                            .sort((a, b) => {
                                              const dateA = new Date(
                                                a.invoiceCreateAt
                                              );
                                              const dateB = new Date(
                                                b.invoiceCreateAt
                                              );
                                              return (
                                                dateA.getTime() -
                                                dateB.getTime()
                                              );
                                            });

                                          return (
                                            <div className="flex w-full px-2 pb-2 h-auto flex-wrap flex-col gap-y-1">
                                              <div className="flex bg-gray-100 w-full gap-2 px-4 py-2 rounded-lg h-auto justify-start items-center ">
                                                <span className="font-sans font-semibold w-4 h-4 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-1">
                                                  <TbUsers className="text-sm" />
                                                </span>
                                                <h1>
                                                  참가신청명단(
                                                  {currentSubMenu.gradeTitle})
                                                </h1>
                                              </div>
                                              <div className="flex bg-gray-100 w-full gap-2 p-2 rounded-lg h-auto justify-start items-center flex-col">
                                                <div className="flex w-full bg-white rounded-lg p-2">
                                                  <div className="flex w-1/6">
                                                    순번
                                                  </div>
                                                  <div className="flex w-2/6">
                                                    이름
                                                  </div>
                                                  <div className="flex w-3/6">
                                                    연락처
                                                  </div>
                                                  <div className="hidden lg:flex lg:w-3/6">
                                                    소속
                                                  </div>
                                                </div>
                                                {filtered?.length > 0 &&
                                                  filtered.map(
                                                    (entry, eIdx) => {
                                                      const {
                                                        playerName,
                                                        playerTel,
                                                        playerGym,
                                                      } = entry;

                                                      return (
                                                        <div className="flex bg-gray-100 w-full px-4 rounded-lg h-auto justify-start items-center ">
                                                          <div className="flex w-1/6">
                                                            {eIdx + 1}
                                                          </div>
                                                          <div className="flex w-2/6">
                                                            {playerName}
                                                          </div>
                                                          <div className="flex w-3/6">
                                                            {playerTel}
                                                          </div>
                                                          <div className="hidden lg:flex lg:w-3/6">
                                                            {playerGym}
                                                          </div>
                                                        </div>
                                                      );
                                                    }
                                                  )}
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      {/* 심판배정 */}
                                      {currentSubMenu.judge &&
                                        currentSubMenu.categoryId ===
                                          categoryId &&
                                        (() => {
                                          console.log(judgesArray);
                                          if (judgesArray?.length <= 0) {
                                            return;
                                          }
                                          const filtered =
                                            judgeAssignTable.filter(
                                              (e) =>
                                                e.gradeId ===
                                                currentSubMenu.gradeId
                                            );

                                          console.log(filtered);

                                          return (
                                            <div className="flex w-full px-2 pb-2 h-auto flex-wrap flex-col gap-y-1">
                                              <div className="flex bg-gray-100 w-full gap-2 px-4 py-2 rounded-lg h-auto justify-start items-center ">
                                                <span className="font-sans font-semibold w-4 h-4 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-1">
                                                  <TbUsers className="text-sm" />
                                                </span>
                                                <h1>
                                                  심판배정명단(
                                                  {currentSubMenu.gradeTitle})
                                                </h1>
                                              </div>
                                              <div className="flex bg-gray-100 w-full gap-2 p-2 rounded-lg h-auto justify-start items-center flex-col">
                                                <div className="flex w-full bg-white rounded-lg p-2">
                                                  <div className="flex w-1/6">
                                                    좌석
                                                  </div>
                                                  <div className="flex w-2/6">
                                                    이름
                                                  </div>
                                                  <div className="flex w-3/6">
                                                    연락처
                                                  </div>
                                                  <div className="hidden lg:flex lg:w-3/6">
                                                    소속
                                                  </div>
                                                </div>
                                                {judgeCount > 0 &&
                                                  Array.from(
                                                    { length: judgeCount },
                                                    (_, jIdx) => jIdx + 1
                                                  ).map((number) => {
                                                    let judgeName;
                                                    let judgePromoter;
                                                    let judgeTel;
                                                    let judgeInfo;
                                                    const findIndex =
                                                      filtered.findIndex(
                                                        (f) =>
                                                          f.seatIndex === number
                                                      );

                                                    if (findIndex === -1) {
                                                      judgeInfo = {
                                                        judgeName: "",
                                                        judgeTel: "",
                                                        judgePromoter: "",
                                                      };
                                                    } else {
                                                      const findJudgeBySeatIndex =
                                                        filtered.find(
                                                          (f) =>
                                                            f.seatIndex ===
                                                            number
                                                        );

                                                      judgeInfo = {
                                                        judgeName:
                                                          findJudgeBySeatIndex.judgeName,
                                                        judgeTel:
                                                          findJudgeBySeatIndex.judgeTel,
                                                        judgePromoter:
                                                          findJudgeBySeatIndex.judgePromoter,
                                                      };
                                                    }

                                                    // const { judgeName } =
                                                    //   filteredJudgeBySeatIndex[0];
                                                    return (
                                                      <div className="flex bg-gray-100 w-full px-4 rounded-lg h-auto justify-start items-center ">
                                                        <div className="flex w-1/6">
                                                          {number}
                                                        </div>
                                                        <div className="flex w-2/6">
                                                          {judgeInfo.judgeName}
                                                        </div>
                                                        <div className="flex w-3/6">
                                                          {judgeInfo.judgeTel}
                                                        </div>
                                                        <div className="hidden lg:flex lg:w-3/6">
                                                          {
                                                            judgeInfo.judgePromoter
                                                          }
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                              </div>
                                            </div>
                                          );
                                        })()}
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

  // TODO: 일관성을 위해서 이부분 외부 컴포넌트로 분리시켜야함
  // 심판 리스트 받아오는 부분 다시 체크해야함 의도하지 않게 예전 데이터 불러오고 있음

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-3 gap-y-2 ">
      <div className="flex w-full h-14">
        <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
          <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
            <BsClipboardData />
          </span>
          <h1
            className="font-sans text-lg font-semibold"
            style={{ letterSpacing: "2px" }}
          >
            기초데이터(1단계)
          </h1>
        </div>
      </div>
      <div className="flex w-full h-full ">
        <div className="flex w-full justify-start items-center">
          <div className="flex w-full h-full justify-start  px-3 pt-3 flex-col bg-gray-100 rounded-lg">
            <div className="flex w-full">
              {tabArray.map((tab, tIdx) => (
                <>
                  <button
                    className={`${
                      currentTab === tab.id
                        ? " flex w-auto h-10 bg-white px-4"
                        : " flex w-auto h-10 bg-gray-100 px-4"
                    }  h-14 rounded-t-lg justify-center items-center`}
                    onClick={() => setCurrentTab(tIdx)}
                  >
                    <span>{tab.title}</span>
                  </button>
                </>
              ))}
            </div>
            <div className="flex w-full h-auto">
              {currentTab === 0 && <ContestCategoryOrderTable />}
              {currentTab === 1 && <ContestPlayerOrderTableTabType />}
              {currentTab === 2 && <ContestJudgeAssignTable />}
              {currentTab === 3 && <ContestStagetable />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContestTimetable;
