import React, { useContext, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

import {
  MdTimeline,
  MdOutlineSearch,
  MdEditNote,
  MdOutlineScale,
} from "react-icons/md";
import { Modal } from "@mui/material";
import CategoryInfoModal from "../modals/CategoryInfoModal";
import { useEffect } from "react";
import GradeInfoModal from "../modals/GradeInfoModal.jsx";
import { HiOutlineTrash } from "react-icons/hi";
import { TbEdit } from "react-icons/tb";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";

const ContestTimetable = () => {
  const [currentOrders, setCurrentOrders] = useState();
  const [currentTab, setCurrentTab] = useState(0);
  const [categorysList, setCategorysList] = useState([]);
  const [gradesList, setGradesList] = useState([]);
  const [currentSection, setSection] = useState([{ id: 0, title: "전체" }]);
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

  const tabArray = [
    {
      id: 0,
      title: "종목/체급진행순서",
      subTitle: "대회진행순서를 먼저 설정합니다.",
      children: "",
    },
    {
      id: 1,
      title: "선수배정현황",
      subTitle: "선수의 출전 순서를 설정합니다.",
      children: "",
    },
    {
      id: 2,
      title: "심판배정현황",
      subTitle: "종목/체급 심사를 위한 심판을 배정합니다.",
      children: "",
    },
  ];

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) {
      return;
    }

    // Determine whether we're dealing with categories or grades
    const isGrade = draggableId.startsWith("grade");

    if (isGrade) {
      const items = Array.from(gradesList);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);

      setGradesList(items);
    } else {
      const items = Array.from(categorysList);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);

      setCategorysList(items);
    }
  };

  const handleCategoryClose = () => {
    setIsOpen(() => ({
      category: false,
      title: "",
      info: {},
      categoryId: "",
      gradeId: "",
    }));
  };
  const handleGradeClose = () => {
    setIsOpen((prevState) => ({
      ...prevState,
      grade: false,
      title: "",
      categoryId: "",
      gradeId: "",
    }));
  };

  const fetchPool = async () => {
    if (currentContest.contests.contestCategorysListId) {
      const returnCategorys = await fetchCategoryDocument.getDocument(
        currentContest.contests.contestCategorysListId
      );
      console.log(returnCategorys);
      setCategorysList([
        ...returnCategorys?.categorys.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        ),
      ]);
      const returnGrades = await fetchGradeDocument.getDocument(
        currentContest.contests.contestGradesListId
      );
      console.log("grades", returnGrades);
      setGradesList([...returnGrades?.grades]);
    }
  };

  useEffect(() => {
    console.log(currentContest);
    fetchPool();
  }, [currentContest]);

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
            setState={setCategorysList}
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
            setState={setGradesList}
          />
        </div>
      </Modal>
      <div className="w-full bg-blue-100 flex rounded-lg flex-col p-2 h-full gap-y-2">
        <div className="flex bg-gray-100 h-auto rounded-lg justify-start items-start lg:items-center gay-y-2 flex-col p-2 gap-y-2">
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
                  count: categorysList.length,
                })
              }
            >
              종목추가
            </button>
          </div>
        </div>
        <div className="flex bg-gray-100 w-full h-auto rounded-lg p-2">
          <div className="w-full bg-blue-100 rounded-lg flex flex-col p-2 gap-y-2">
            <div className="w-full bg-blue-300 rounded-lg flex justify-start items-center px-2">
              <div className="w-1/4 h-10 text-left font-normal flex justify-start items-center">
                개최순서
              </div>
              <div className="w-2/4 h-10 text-left font-normal flex justify-start items-center">
                종목명
              </div>
              <div className="w-1/4 h-10"></div>
            </div>
            <div className="flex flex-col gap-y-2 w-full">
              {categorysList?.length <= 0 ? (
                <div className="h-auto">
                  <div colSpan={3} className="w-full text-center">
                    종목데이터 내용이 없습니다. 다시 불러오기를 누르거나 종목을
                    추가하세요
                  </div>
                </div>
              ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="flex w-full flex-col gap-y-2">
                    {categorysList
                      .sort(
                        (a, b) =>
                          a.contestCategoryIndex - b.contestCategoryIndex
                      )
                      .map((category, cIdx) => {
                        const {
                          contestCategoryId: categoryId,
                          contestCategoryIndex: categoryIndex,
                          contestCategoryTitle: categoryTitle,
                        } = category;

                        const matchedGrades = gradesList
                          .filter((grade) => grade.refCategoryId === categoryId)
                          .sort(
                            (a, b) => a.contestGradeIndex - b.contestGradeIndex
                          );
                        return (
                          <div className="flex w-full flex-col bg-blue-200 rounded-lg">
                            <div className="flex w-full">
                              {/* 종목필드 시작 */}
                              <div className="h-auto w-full flex items-center flex-col lg:flex-row">
                                <div className="flex w-full h-auto justify-start items-center">
                                  <div className="w-1/4 h-14 flex justify-start items-center pl-4">
                                    {categoryIndex}
                                  </div>
                                  <div className="w-2/4 h-14 flex justify-start items-center">
                                    {categoryTitle}
                                  </div>
                                </div>
                                <div className="flex w-full h-auto justify-end items-center">
                                  <div className="w-1/4 h-14 flex justify-end items-center pr-2">
                                    <div className="flex w-full justify-end items-center h-14 gap-x-2">
                                      <button
                                        onClick={() =>
                                          setIsOpen({
                                            ...isOpen,
                                            category: true,
                                            title: "종목수정",
                                            categoryId,
                                            info: { ...category },
                                            count: gradesList.length,
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
                              {/* 종목필드 종료 */}
                            </div>
                            <div className="flex w-full px-2 pb-2 h-auto flex-wrap">
                              <div className="flex bg-blue-100 w-full gap-2 p-2 rounded-lg h-auto flex-wrap">
                                {matchedGrades?.length > 0 &&
                                  matchedGrades.map((match, mIdx) => {
                                    const {
                                      contestGradeId: gradeId,
                                      contestGradeTitle: gradeTitle,
                                      contestGradeIndex: gradeIndex,
                                    } = match;
                                    return (
                                      <div className="flex items-center justify-start bg-white px-2 py-1 rounded-lg gap-2 h-auto w-full lg:w-auto">
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
                                                title: "체급수정",
                                                gradeId: gradeId,
                                                info: { ...match },
                                                count: gradesList.length,
                                              })
                                            }
                                          >
                                            <TbEdit className=" text-xl text-gray-500" />
                                          </button>
                                          <buton className="bg-blue-100 w-10 h-10 rounded-lg flex justify-center items-center">
                                            <HiOutlineTrash className=" text-xl text-gray-500" />
                                          </buton>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                            {/* 체급콘테이너 */}
                            {/* <div className="flex h-auto  bg-red-200">
                          
                        </div> */}
                          </div>
                        );
                      })}
                  </div>
                </DragDropContext>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-3 gap-y-2">
      <div className="flex w-full h-14">
        <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
          <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
            <MdTimeline />
          </span>
          <h1
            className="font-sans text-lg font-semibold"
            style={{ letterSpacing: "2px" }}
          >
            타임테이블
          </h1>
        </div>
      </div>
      <div className="flex w-full h-full ">
        <div className="flex w-full justify-start items-center">
          <div className="flex w-full h-full justify-start items-start px-3 pt-3 flex-col bg-gray-100 rounded-lg">
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
            {currentTab === 0 && ContestOrdersRender}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContestTimetable;
