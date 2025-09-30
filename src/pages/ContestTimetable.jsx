"use client";

import { useContext, useState, useEffect } from "react";
import { Tabs, Card } from "antd";
import { BsClipboardData } from "react-icons/bs";
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
      label: "종목/체급진행순서",
      children: <ContestCategoryOrderTable />,
    },
    {
      key: "1",
      label: "선수번호배정",
      children: <ContestPlayerOrderTableTabType />,
    },
    {
      key: "2",
      label: "심판배정",
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
      setCurrentTab(location.state.tabId.toString());
    }
  }, [location]);

  useEffect(() => {
    fetchPool();
  }, []);

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-3 md:p-6 gap-y-4">
      <Card className="shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex justify-center items-center w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
            <BsClipboardData className="text-xl" />
          </div>
          <h1 className="text-xl font-bold tracking-wide">기초데이터(1단계)</h1>
        </div>
      </Card>

      <Card className="shadow-sm">
        <Tabs
          activeKey={currentTab}
          onChange={(key) => setCurrentTab(key)}
          items={tabItems}
          size="large"
          className="contest-timetable-tabs"
        />
      </Card>
    </div>
  );
};

export default ContestTimetable;
