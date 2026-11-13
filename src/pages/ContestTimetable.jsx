"use client";

import { useContext, useState, useEffect } from "react";
import { Tabs } from "antd";
import { ClipboardList, ListOrdered, Users, UserCheck } from "lucide-react";
import {
  useFirestoreAddData,
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useLocation } from "react-router-dom";
import ContestPlayerOrderTableTabType from "./ContestPlayerOrderTableTabType";
import ContestCategoryOrderTable from "./ContestCategoryOrderTable";
import ContestJudgeAssignTable from "./ContestJudgeAssignTable";

const ContestTimetable = () => {
  const [currentOrders, setCurrentOrders] = useState();
  const [currentTab, setCurrentTab] = useState("0");
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

  const tabItems = [
    {
      key: "0",
      label: (
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <ListOrdered size={16} strokeWidth={1.5} className="text-[#737373]" />
          <span>종목·체급 진행순서</span>
        </span>
      ),
      children: <ContestCategoryOrderTable />,
    },
    {
      key: "1",
      label: (
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Users size={16} strokeWidth={1.5} className="text-[#737373]" />
          <span>선수번호 배정</span>
        </span>
      ),
      children: <ContestPlayerOrderTableTabType />,
    },
    {
      key: "2",
      label: (
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <UserCheck size={16} strokeWidth={1.5} className="text-[#737373]" />
          <span>심판 좌석 배정</span>
        </span>
      ),
      children: <ContestJudgeAssignTable />,
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
    const newOrder = [];
    prevOrder.map((item, idx) =>
      newOrder.push({ ...item, contestCategoryIndex: idx + 1 })
    );
    return newOrder;
  };

  const handleSaveCategorys = async (data) => {
    if (!currentContest?.contests?.contestCategorysListId) return;
    try {
      await contestCategoryUpdate.updateData(
        currentContest.contests.contestCategorysListId,
        {
          ...categorysList,
          categorys: [...data],
        }
      );
    } catch (error) {
      console.log(error);
    }
  };

  const handleReOrderGrade = (data) => {
    const prevOrder = [...data];
    const dummy = [...gradesArray];
    const newOrder = [];
    prevOrder.map((item, idx) =>
      newOrder.push({ ...item, contestGradeIndex: idx + 1 })
    );
    newOrder.forEach((order) => {
      const findIndex = dummy.findIndex(
        (grade) => grade.contestGradeId === order.contestGradeId
      );
      if (findIndex !== -1) {
        dummy.splice(findIndex, 1, { ...order });
      }
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
    if (!currentContest?.contests?.id) return;

    if (currentContest.contests.contestCategorysListId) {
      const returnCategorys = await fetchCategoryDocument.getDocument(
        currentContest.contests.contestCategorysListId
      );
      if (returnCategorys) {
        setCategorysList({ ...returnCategorys });
        setCategorysArray(
          Array.isArray(returnCategorys?.categorys)
            ? [...returnCategorys.categorys].sort(
                (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
              )
            : []
        );
      } else {
        setCategorysList({});
        setCategorysArray([]);
      }
    }

    if (currentContest.contests.contestGradesListId) {
      const returnGrades = await fetchGradeDocument.getDocument(
        currentContest.contests.contestGradesListId
      );
      setGradesArray(
        Array.isArray(returnGrades?.grades) ? [...returnGrades.grades] : []
      );
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

    setEntrysArray(Array.isArray(returnEntrys) ? [...returnEntrys] : []);
    setJudgesArray(Array.isArray(returnJudges) ? [...returnJudges] : []);
    setJudgeAssignTable(
      Array.isArray(returnAssign?.[0]?.judges)
        ? [...returnAssign[0].judges]
        : []
    );
  };

  // Preserve state references for compatibility
  void currentOrders;
  void setCurrentOrders;
  void entrysArray;
  void judgesArray;
  void judgeAssignTable;
  void setCurrentCategoryId;
  void currentSubMenu;
  void setCurrentSubMenu;
  void setCurrentContest;
  void isOpen;
  void updateAssignTable;
  void updateContests;
  void addAssignTable;
  void onDragCategoryEnd;
  void onDragGradeEnd;
  void handleCategoryClose;
  void handleGradeClose;
  void handlePlayerClose;
  void handleJudgeClose;

  useEffect(() => {
    if (location?.state?.tabId) {
      setCurrentTab(location.state.tabId.toString());
    }
  }, [location]);

  useEffect(() => {
    if (!currentContest?.contests?.id) return;
    fetchPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests?.id]);

  const contestTitle =
    currentContest?.contestInfo?.contestTitle ||
    currentContest?.contests?.contestTitle ||
    "";

  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-5">
        <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex justify-center items-center w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#525252] shrink-0">
              <ClipboardList size={16} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-[18px] leading-6 font-semibold text-[#171717] m-0">
                기초데이터 (1단계)
              </h1>
              <p className="text-xs text-[#737373] m-0 mt-0.5">
                종목·체급 순서 구성, 선수 등번호 배정, 심판 좌석 배정
              </p>
            </div>
          </div>
          {contestTitle && (
            <span className="text-xs text-[#737373] bg-[#f4f4f5] border border-[#171717]/[0.08] px-2.5 py-1 rounded-[4px]">
              {contestTitle}
            </span>
          )}
        </div>

        <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
          <Tabs
            activeKey={currentTab}
            onChange={(key) => setCurrentTab(key)}
            items={tabItems}
            className="contest-timetable-tabs"
          />
        </div>
      </div>
    </div>
  );
};

export default ContestTimetable;
