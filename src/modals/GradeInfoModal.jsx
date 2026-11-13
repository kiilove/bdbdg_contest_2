import React, { useContext, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { SlidersHorizontal } from "lucide-react";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";

const initGradeInfo = {
  contestGradeId: "",
  contestGradeIndex: "",
  contestGradeTitle: "",
};

const GradeInfoModal = ({ setClose, propState, setState }) => {
  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );
  const [gradesList, setGradesList] = useState({});
  const [gradesArray, setGradesArray] = useState([]);
  const [gradeInfo, setGradeInfo] = useState({
    ...initGradeInfo,
    contestGradeIndex:
      propState.count === undefined ? 1 : parseInt(propState.count) + 1,
  });

  const gradeInfoRef = useRef({});

  const contestGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const contestGradeUpdate = useFirestoreUpdateData("contest_grades_list");

  const getGrades = async () => {
    const returnGrades = await contestGradeDocument.getDocument(
      currentContest.contests.contestGradesListId
    );
    setGradesList({ ...returnGrades });
    setGradesArray([...returnGrades.grades]);
  };

  const handleUpdateGrades = async () => {
    if (
      gradeInfoRef.current.contestGradeIndex.value === "" ||
      gradeInfoRef.current.contestGradeTitle.value === ""
    ) {
      return;
    }

    const updatedGradeInfo = Object.keys(gradeInfoRef.current).reduce(
      (updatedInfo, key) => {
        const currentElement = gradeInfoRef.current[key];
        updatedInfo[key] =
          currentElement.type === "checkbox"
            ? currentElement.checked
            : currentElement.value;
        return updatedInfo;
      },
      {}
    );

    setGradeInfo((prevInfo) => ({
      ...prevInfo,
      ...updatedGradeInfo,
    }));

    const dummy = [...gradesArray];

    switch (propState.title) {
      case "체급추가":
        dummy.push({
          ...updatedGradeInfo,
          contestGradeId: uuidv4(),
          contestGradeIndex: parseInt(updatedGradeInfo.contestGradeIndex),
          refCategoryId: propState.categoryId,
          isCompared: false,
        });

        await handleSaveGrades(dummy);
        setGradesArray(dummy);
        setState(dummy);
        setGradeInfo({
          ...initGradeInfo,
          contestGradeIndex: parseInt(updatedGradeInfo.contestGradeIndex) + 1,
        });
        gradeInfoRef.current.contestGradeTitle.focus();
        break;
      case "체급수정":
        console.log(propState.gradeId);
        const findGradeIndex = dummy.findIndex(
          (grade) => grade.contestGradeId === propState.gradeId
        );

        if (findGradeIndex !== -1) {
          dummy.splice(findGradeIndex, 1, {
            ...dummy[findGradeIndex],
            ...updatedGradeInfo,
            contestGradeIndex: parseInt(updatedGradeInfo.contestGradeIndex),
          });
          await handleSaveGrades(dummy);
          setGradesArray(dummy);
          setState(dummy);
        }
        break;
      default:
        break;
    }
  };

  const handleSaveGrades = async (data) => {
    try {
      await contestGradeUpdate.updateData(
        currentContest.contests.contestGradesListId,
        { ...gradesList, grades: [...data] }
      );
    } catch (error) {
      console.log(error);
    }
  };
  const handleInputValues = (e) => {
    const { name, value } = e.target;

    if (name === "contestGradeIndex") {
      setGradeInfo({
        ...gradeInfo,
        contestGradeIndex: parseInt(value),
      });
    } else {
      setGradeInfo({
        ...gradeInfo,
        [name]: value,
      });
    }
  };

  useEffect(() => {
    getGrades();
    if (propState.title === "체급수정") {
      setGradeInfo({ ...propState.info });
    }
    gradeInfoRef.current.contestGradeTitle.focus();
    console.log(propState);
  }, []);
  return (
    <div className="flex w-full flex-col gap-4 h-auto bg-[#ffffff] text-[#171717] p-2">
      <div className="flex w-full items-center gap-2.5 pb-3 border-b border-[#171717]/[0.08]">
        <div className="w-8 h-8 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] flex items-center justify-center">
          <SlidersHorizontal
            size={15}
            strokeWidth={1.5}
            className="text-[#525252]"
          />
        </div>
        <h1 className="text-base font-semibold text-[#171717] m-0">
          {propState.title}
        </h1>
      </div>

      <div className="bg-[#fafafa] rounded-[12px] border border-[#171717]/[0.08] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            소속 종목
          </label>
          <div className="h-9 w-full rounded-[8px] border border-[#171717]/[0.08] bg-[#f4f4f5] px-3 flex items-center text-sm font-medium text-[#525252]">
            {propState.categoryTitle}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            개최 순서
          </label>
          <input
            type="text"
            name="contestGradeIndex"
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm font-mono tabular-nums text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
            value={gradeInfo.contestGradeIndex ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (gradeInfoRef.current.contestGradeIndex = ref)}
            placeholder="개최 순서 (숫자)"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            체급명
          </label>
          <input
            type="text"
            name="contestGradeTitle"
            onChange={(e) => handleInputValues(e)}
            value={gradeInfo.contestGradeTitle ?? ""}
            ref={(ref) => (gradeInfoRef.current.contestGradeTitle = ref)}
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
            placeholder="예: -65kg, +175cm"
          />
        </div>
      </div>

      <div className="flex w-full justify-end gap-2 pt-1">
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] text-xs font-medium border border-[#171717]/[0.08] transition-colors duration-150 cursor-pointer"
          onClick={() => setClose()}
        >
          닫기
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 px-5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors duration-150 cursor-pointer border-0"
          onClick={() => handleUpdateGrades()}
        >
          저장
        </button>
      </div>
    </div>
  );
};

export default GradeInfoModal;
