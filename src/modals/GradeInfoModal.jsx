import React, { useContext, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { TbWeight } from "react-icons/tb";
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
    <div className="flex w-full flex-col gap-y-2 h-auto">
      <div className="flex w-full h-14">
        <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
          <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
            <TbWeight />
          </span>
          <h1
            className="font-sans text-lg font-semibold"
            style={{ letterSpacing: "2px" }}
          >
            {propState.title}
          </h1>
        </div>
      </div>
      <div className="flex bg-gradient-to-r from-blue-200 to-cyan-200 p-3 rounded-lg">
        <div className="flex w-full bg-gray-100 h-auto rounded-lg justify-start items-start lg:items-center gay-y-2 flex-col p-2 gap-y-2">
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                소속종목
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full h-full justify-start items-center text-gray-400">
                {propState.categoryTitle}
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                개최순서
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="contestGradeIndex"
                  className="h-12 outline-none"
                  value={gradeInfo.contestGradeIndex}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (gradeInfoRef.current.contestGradeIndex = ref)}
                  placeholder="개최순서(숫자)"
                />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                체급명
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="contestGradeTitle"
                  onChange={(e) => handleInputValues(e)}
                  value={gradeInfo.contestGradeTitle}
                  ref={(ref) => (gradeInfoRef.current.contestGradeTitle = ref)}
                  className="h-12 outline-none"
                />
              </div>
            </div>
          </div>
          {/* <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                비교심사
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="checkbox"
                  name="isCompared"
                  onChange={(e) =>
                    setGradeInfo({
                      ...gradeInfo,
                      isCompared: e.target.checked,
                    })
                  }
                  checked={gradeInfo.isCompared}
                  ref={(ref) => (gradeInfoRef.current.isCompared = ref)}
                  className="h-12 outline-none"
                />
              </div>
            </div>
          </div> */}
        </div>
      </div>
      <div className="flex w-full gap-x-2 h-auto">
        <button
          className="w-full h-12 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-lg"
          onClick={() => handleUpdateGrades()}
        >
          저장
        </button>
        <button
          className="w-full h-12 bg-gradient-to-r from-blue-300 to-cyan-300 rounded-lg"
          onClick={() => setClose()}
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default GradeInfoModal;
