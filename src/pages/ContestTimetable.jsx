import React, { useContext, useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

import { MdTimeline, MdOutlineSearch, MdOutlineBalance } from "react-icons/md";
import { Modal } from "@mui/material";
import CategoryInfoModal from "../modals/CategoryInfoModal";
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
    const { source, destination } = result;

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
    const { source, destination } = result;

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
    newOrder.map((order) => {
      const findIndex = dummy.findIndex(
        (grade) => grade.contestGradeId === order.contestGradeId
      );
      dummy.splice(findIndex, 1, { ...order });
    });
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
  };

  useEffect(() => {
    if (location?.state?.tabId) {
      setCurrentTab(location.state.tabId);
    }
  }, [location]);

  useEffect(() => {
    fetchPool();
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
                      {(provided) => (
                        <div
                          className="flex w-full flex-col bg-blue-100 rounded-lg gap-y-2"
                          ref={provided.innerRef}
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
                                  key={categoryId} // 유니크한 key 값 사용
                                  draggableId={categoryId} // draggableId도 고유해야 함
                                  index={cIdx} // index는 배열에서의 순서
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`${
                                        snapshot.isDragging
                                          ? "flex w-full flex-col bg-blue-400 rounded-lg"
                                          : "flex w-full flex-col bg-blue-200 rounded-lg"
                                      }`}
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
                                      <div className="flex w-full px-2 pb-2 h-auto flex-wrap">
                                        <DragDropContext
                                          onDragEnd={onDragGradeEnd}
                                        >
                                          <Droppable droppableId="dropGrade">
                                            {(provided) => (
                                              <div
                                                className="flex bg-blue-100 w-full gap-2 p-2 rounded-lg h-auto flex-wrap"
                                                ref={provided.innerRef}
                                              >
                                                {matchedGrades?.length > 0 &&
                                                  matchedGrades.map(
                                                    (match, mIdx) => {
                                                      const {
                                                        contestGradeId: gradeId,
                                                        contestGradeTitle:
                                                          gradeTitle,
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
                                                        </div>
                                                      );
                                                    }
                                                  )}
                                                {provided.placeholder}
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
                          {provided.placeholder}
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
                <button
                  key={tab.id}
                  className={`${
                    currentTab === tab.id
                      ? " flex w-auto h-10 bg-white px-4"
                      : " flex w-auto h-10 bg-gray-100 px-4"
                  }  h-14 rounded-t-lg justify-center items-center`}
                  onClick={() => setCurrentTab(tIdx)}
                >
                  <span>{tab.title}</span>
                </button>
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
