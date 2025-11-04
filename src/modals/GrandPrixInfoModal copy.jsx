import React, { useContext, useEffect, useRef, useState } from "react";
import { BiCategory } from "react-icons/bi";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { v4 as uuidv4 } from "uuid";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateUUID } from "../functions/functions";

const initCategoryInfo = {
  contestCategoryId: "",
  contestCategoryIndex: "",
  contestCategoryTitle: "",
  contestCategorySection: "그랑프리",
  contestCategroyGender: "남",
  contestCategoryPriceType: "기본참가비",
  contestCategroyIsOverall: "off",
  contestCategoryType: "그랑프리",
  contestCategoryJudgeType: "ranking",
};

const GrandPrixInfoModal = ({ setClose, propState, setState, setRefresh }) => {
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setmessage] = useState({});
  const { currentContest } = useContext(CurrentContestContext);
  const [categoryInfo, setCategoryInfo] = useState({
    ...initCategoryInfo,
    contestCategoryIndex: parseInt(propState.count) + 1,
  });
  const [categorysList, setCategorysList] = useState({});
  const [categorysArray, setCategorysArray] = useState([]);
  const [gradesList, setGradesList] = useState({});
  const [gradesArray, setGradesArray] = useState([]);

  const [grandPrixArray, setGrandPrixArray] = useState([]);

  const categoryInfoRef = useRef({});

  const contestCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const contestGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const contestCategoryUpdate = useFirestoreUpdateData(
    "contest_categorys_list"
  );
  const contestGradeUpdate = useFirestoreUpdateData("contest_grades_list");

  const getCategorys = async () => {
    const returnCategorys = await contestCategoryDocument.getDocument(
      currentContest.contests.contestCategorysListId
    );
    setCategorysList({ ...returnCategorys });
    setCategorysArray([...returnCategorys.categorys]);
  };

  const getGrades = async () => {
    const returnGrades = await contestGradeDocument.getDocument(
      currentContest.contests.contestGradesListId
    );
    setGradesList({ ...returnGrades });
    setGradesArray([...returnGrades.grades]);
    return returnGrades;
  };

  const handleRemoveGrades = (gradeIndex, gradeArray) => {
    const dummy = [...gradeArray];
    dummy.splice(gradeIndex, 1);
    setGrandPrixArray([...dummy]);
  };

  const handleInitGrandPrixFromCategoriesToGrades = () => {
    setGrandPrixArray([]);
    const grandPrixGrades = categorysArray.filter(
      (f) =>
        f.contestCategoryIsOverall === true &&
        f.contestCategorySection !== "그랑프리"
    );
    setGrandPrixArray([...grandPrixGrades]);
    console.log(grandPrixGrades);
  };

  const handleGradeAdd = async (objGrade, arrNewGrade) => {
    console.log("Adding grades to Grand Prix:", objGrade, arrNewGrade);

    if (objGrade && arrNewGrade?.length > 0) {
      // Mapping over the new grades to prepare them for addition
      const newGrades = arrNewGrade.map((grandPrix, gIdx) => {
        const {
          contestCategoryTitle: contestGradeTitle,
          contestCategoryId: originalRefCategoryId,
        } = grandPrix;

        const refCategoryId = categoryInfo.contestCategoryId;
        const contestGradeIndex = gIdx + 1;
        const isCompared = false;
        const contestGradeId = generateUUID();

        // New grade structure for the Grand Prix
        const newGradeInfo = {
          contestGradeId,
          contestGradeIndex,
          contestGradeTitle,
          isCompared,
          refCategoryId,
          originalRefCategoryId,
        };

        // Log the new grade for debugging
        console.log("New Grade Info:", newGradeInfo);

        return newGradeInfo;
      });

      console.log("Mapped new grades:", newGrades);

      if (newGrades?.length > 0) {
        // Append the new grades to the existing grades in objGrade
        objGrade.grades = [...objGrade.grades, ...newGrades];

        try {
          console.log("Updated objGrade with new grades:", objGrade);

          // Update Firestore with the modified objGrade
          await contestGradeUpdate.updateData(
            currentContest.contests.contestGradesListId,
            {
              ...objGrade,
            }
          );

          setGradesList((prev) => ({ ...prev })); // Ensure UI is updated
          console.log("Grade addition completed:", objGrade);
        } catch (error) {
          console.log("Error updating grades:", error);
        }
      }
    }
  };

  const handleUpdateGrandPrixGrades = async () => {
    const gradesData = await getGrades();
    await handleGradeAdd(gradesData, grandPrixArray);
  };

  const updateCategory = (updatedCategoryInfo, action) => {
    const dummy = [...categorysArray];
    if (action === "추가") {
      dummy.push({
        ...updatedCategoryInfo,
        contestCategoryId: uuidv4(),
        contestCategoryIsOverall: true,
      });
    } else if (action === "수정") {
      const index = dummy.findIndex(
        (category) => category.contestCategoryId === propState.categoryId
      );
      if (index !== -1) {
        dummy.splice(index, 1, {
          ...dummy[index],
          ...updatedCategoryInfo,
          contestCategoryIsOverall: true,
        });
      }
    }
    return dummy;
  };

  const handleUpdateCategorys = async () => {
    if (
      categoryInfoRef.current.contestCategoryIndex.value === "" ||
      categoryInfoRef.current.contestCategoryTitle.value === ""
    ) {
      return;
    }

    const updatedCategoryInfo = Object.keys(categoryInfoRef.current).reduce(
      (updatedInfo, key) => {
        const currentElement = categoryInfoRef.current[key];
        updatedInfo[key] =
          currentElement.type === "checkbox"
            ? currentElement.checked
            : currentElement.value;
        return updatedInfo;
      },
      {}
    );

    setCategoryInfo((prevInfo) => ({
      ...prevInfo,
      ...updatedCategoryInfo,
    }));

    const action = propState.title === "그랑프리추가" ? "추가" : "수정";
    const dummy = updateCategory(updatedCategoryInfo, action);

    await handleSaveCategorys(dummy);
    setCategorysArray(dummy);
    setState(dummy);

    if (action === "추가") {
      setCategoryInfo({
        ...initCategoryInfo,
        contestCategoryIsOverall: true,
        contestCategoryIndex:
          parseInt(updatedCategoryInfo.contestCategoryIndex) + 1,
        contestCategoryJudgeCount: parseInt(
          updatedCategoryInfo.contestCategoryJudgeCount
        ),
      });
      categoryInfoRef.current.contestCategorySection.focus();
    }
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
      setmessage({
        body: "저장되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.log(error);
    }
  };

  const handleInputValues = (e) => {
    const { name, value } = e.target;
    setCategoryInfo({
      ...categoryInfo,
      [name]:
        name === "contestCategoryIsOverall"
          ? e.target.checked
          : name === "contestCategoryIndex"
          ? parseInt(value)
          : value,
    });
  };

  useEffect(() => {
    getCategorys();
    if (propState.title === "그랑프리수정") {
      setCategoryInfo({ ...propState.info });
    }
    categoryInfoRef.current.contestCategorySection.focus();
  }, []);

  return (
    <div className="flex w-full flex-col gap-y-2 h-auto">
      <ConfirmationModal
        isOpen={msgOpen}
        message={message}
        onCancel={() => {
          setRefresh(true);
          setClose();
        }}
        onConfirm={() => {
          setRefresh(true);
          setClose();
        }}
      />
      <div className="flex w-full h-14">
        <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
          <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
            <BiCategory />
          </span>
          <h1
            className="font-sans text-lg font-semibold"
            style={{ letterSpacing: "2px" }}
          >
            {propState?.title || ""}
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
                개최순서
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  value={categoryInfo.contestCategoryIndex}
                  onChange={(e) => {
                    const value = e.target.value;
                    const parsedValue = parseInt(value, 10); // Convert to a number
                    if (!isNaN(parsedValue)) {
                      handleInputValues({
                        target: {
                          name: "contestCategoryIndex",
                          value: parsedValue,
                        },
                      });
                    } else {
                      handleInputValues({
                        target: {
                          name: "contestCategoryIndex",
                          value: "",
                        },
                      });
                    }
                  }}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryIndex = ref)
                  }
                  name="contestCategoryIndex"
                  className="h-12 outline-none"
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
                구분
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="contestCategorySection"
                  value={categoryInfo.contestCategorySection}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategorySection = ref)
                  }
                  className="h-12 outline-none"
                  placeholder="예)1부, 2부, 그랑프리"
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
                종목대분류
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="contestCategoryType"
                  placeholder="예)피지크, 보디빌딩"
                  value={categoryInfo.contestCategoryType}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryType = ref)
                  }
                  className="h-12 outline-none"
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
                종목명
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="contestCategoryTitle"
                  value={categoryInfo.contestCategoryTitle}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryTitle = ref)
                  }
                  className="h-12 outline-none"
                />
              </div>
            </div>
          </div>
          {/* <div className="flex w-full justify-start items-center hidden">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                참가가능성별
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg hidden">
              <div className="flex w-full justify-start items-center h-12">
                <select
                  name="contestCategoryGender"
                  onChange={(e) => handleInputValues(e)}
                  value={categoryInfo.contestCategoryGender}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryGender = ref)
                  }
                  className="w-full h-full pl-2"
                >
                  <option>남</option>
                  <option>여</option>
                  <option>무관</option>
                </select>
              </div>
            </div>
          </div> */}
          {/* <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                참가비종류
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg ">
              <div className="flex w-full justify-start items-center h-12">
                <select
                  name="contestCategoryPriceType"
                  onChange={(e) => handleInputValues(e)}
                  value={categoryInfo.contestCategoryPriceType}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryPriceType = ref)
                  }
                  className="w-full h-full pl-2"
                >
                  <option>기본참가비</option>
                  <option>타입1</option>
                  <option>타입2</option>
                </select>
              </div>
            </div>
          </div> */}
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                심사종류
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg ">
              <div className="flex w-full justify-start items-center h-12">
                <select
                  name="contestCategoryJudgeType"
                  onChange={(e) => handleInputValues(e)}
                  value={categoryInfo.contestCategoryJudgeType}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryJudgeType = ref)
                  }
                  className="w-full h-full pl-2"
                >
                  <option value="ranking">랭킹형</option>
                  <option value="point">점수형</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                심판수
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="contestCategoryJudgeCount"
                  value={categoryInfo.contestCategoryJudgeCount}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryJudgeCount = ref)
                  }
                  className="h-12 outline-none"
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
                그랑프리종목
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg ">
              <div className="flex w-full justify-start items-center h-12">
                <button
                  onClick={() => handleInitGrandPrixFromCategoriesToGrades()}
                >
                  그랑프리 종목 불러오기
                </button>
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                체급목록
              </h3>
            </div>
            <div className="h-auto w-3/4 rounded-lg flex justify-start items-center flex-col">
              <div className="flex w-full justify-start items-center h-auto gap-1">
                <button onClick={() => handleUpdateGrandPrixGrades()}>
                  그랑프리 체급으로 저장
                </button>
              </div>
              <div className="flex w-full justify-start items-center h-auto gap-1">
                {grandPrixArray?.length > 0 &&
                  grandPrixArray.map((grand, gIdx) => {
                    const { contestCategoryTitle: categoryTitle } = grand;
                    return (
                      <div className="flex px-2 h-8 bg-blue-200 justify-center items-center">
                        <span>{categoryTitle}</span>
                        <button
                          className="bg-blue-400 h-5 w-5 flex justify-center items-center"
                          onClick={() => {
                            handleRemoveGrades(gIdx, grandPrixArray);
                          }}
                        >
                          X
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex w-full gap-x-2 h-auto">
        <button
          className="w-full h-12 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-lg"
          onClick={() => handleUpdateCategorys()}
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

export default GrandPrixInfoModal;
