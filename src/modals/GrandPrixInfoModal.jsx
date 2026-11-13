"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { Trophy, RefreshCw, Save, X } from "lucide-react";
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
    contestCategoryIndex: Number.parseInt(propState.count) + 1,
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
      const newGrades = arrNewGrade.map((grandPrix, gIdx) => {
        const {
          contestCategoryTitle: contestGradeTitle,
          contestCategoryId: originalRefCategoryId,
        } = grandPrix;

        const refCategoryId = categoryInfo.contestCategoryId;
        const contestGradeIndex = gIdx + 1;
        const isCompared = false;
        const contestGradeId = generateUUID();

        const newGradeInfo = {
          contestGradeId,
          contestGradeIndex,
          contestGradeTitle,
          isCompared,
          refCategoryId,
          originalRefCategoryId,
        };

        console.log("New Grade Info:", newGradeInfo);

        return newGradeInfo;
      });

      console.log("Mapped new grades:", newGrades);

      if (newGrades?.length > 0) {
        objGrade.grades = [...objGrade.grades, ...newGrades];

        try {
          console.log("Updated objGrade with new grades:", objGrade);

          await contestGradeUpdate.updateData(
            currentContest.contests.contestGradesListId,
            {
              ...objGrade,
            }
          );

          setGradesList((prev) => ({ ...prev }));
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
          Number.parseInt(updatedCategoryInfo.contestCategoryIndex) + 1,
        contestCategoryJudgeCount: Number.parseInt(
          updatedCategoryInfo.contestCategoryJudgeCount
        ),
      });
      categoryInfoRef.current.contestCategorySection?.focus?.();
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
        variant: "success",
        title: "그랑프리 종목 저장 완료",
        body: "그랑프리 종목 설정이 정상적으로 저장되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.log(error);
      setmessage({
        variant: "error",
        title: "그랑프리 저장 실패",
        body: "그랑프리 종목을 저장하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
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
          ? Number.parseInt(value)
          : value,
    });
  };

  useEffect(() => {
    getCategorys();
    if (propState.title === "그랑프리수정") {
      setCategoryInfo({ ...propState.info });
    }
    categoryInfoRef.current.contestCategorySection?.focus?.();
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-white text-[#171717]">
      <ConfirmationModal
        isOpen={msgOpen}
        message={message}
        onCancel={() => {
          setMsgOpen(false);
          if (message?.variant !== "error") {
            setRefresh(true);
            setClose();
          }
        }}
        onConfirm={() => {
          setMsgOpen(false);
          if (message?.variant !== "error") {
            setRefresh(true);
            setClose();
          }
        }}
      />

      {/* 상단 고정 헤더 */}
      <div className="flex w-full items-center justify-between px-5 py-4 border-b border-[#171717]/[0.08] bg-[#fafafa] shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-white border border-[#171717]/[0.08] flex items-center justify-center">
            <Trophy size={15} strokeWidth={1.5} className="text-[#525252]" />
          </div>
          <h1 className="text-base font-semibold text-[#171717] m-0">
            {propState?.title || "그랑프리 설정"}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setClose()}
          aria-label="닫기"
          className="h-8 w-8 rounded-[8px] inline-flex items-center justify-center text-[#737373] hover:bg-[#e4e4e7]/70 hover:text-[#171717] transition-colors duration-150 cursor-pointer"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* 스크롤 본문 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="bg-[#fafafa] rounded-[12px] border border-[#171717]/[0.08] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2">
            <label className="text-xs font-medium text-[#525252] sm:text-right">
              개최 순서
            </label>
            <input
              type="text"
              value={categoryInfo.contestCategoryIndex ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                const parsedValue = Number.parseInt(value, 10);
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
              ref={(ref) => (categoryInfoRef.current.contestCategoryIndex = ref)}
              name="contestCategoryIndex"
              className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm font-mono tabular-nums text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
              placeholder="개최 순서 (숫자)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2">
            <label className="text-xs font-medium text-[#525252] sm:text-right">
              구분
            </label>
            <input
              type="text"
              name="contestCategorySection"
              value={categoryInfo.contestCategorySection ?? ""}
              onChange={(e) => handleInputValues(e)}
              ref={(ref) =>
                (categoryInfoRef.current.contestCategorySection = ref)
              }
              className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
              placeholder="예: 그랑프리"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2">
            <label className="text-xs font-medium text-[#525252] sm:text-right">
              종목 대분류
            </label>
            <input
              type="text"
              name="contestCategoryType"
              placeholder="예: 피지크, 보디빌딩"
              value={categoryInfo.contestCategoryType ?? ""}
              onChange={(e) => handleInputValues(e)}
              ref={(ref) => (categoryInfoRef.current.contestCategoryType = ref)}
              className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2">
            <label className="text-xs font-medium text-[#525252] sm:text-right">
              종목명
            </label>
            <input
              type="text"
              name="contestCategoryTitle"
              value={categoryInfo.contestCategoryTitle ?? ""}
              onChange={(e) => handleInputValues(e)}
              ref={(ref) => (categoryInfoRef.current.contestCategoryTitle = ref)}
              className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2">
            <label className="text-xs font-medium text-[#525252] sm:text-right">
              심사 종류
            </label>
            <select
              name="contestCategoryJudgeType"
              onChange={(e) => handleInputValues(e)}
              value={categoryInfo.contestCategoryJudgeType}
              ref={(ref) =>
                (categoryInfoRef.current.contestCategoryJudgeType = ref)
              }
              className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
            >
              <option value="ranking">랭킹형</option>
              <option value="point">점수형</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2">
            <label className="text-xs font-medium text-[#525252] sm:text-right">
              심판 수
            </label>
            <input
              type="text"
              name="contestCategoryJudgeCount"
              value={categoryInfo.contestCategoryJudgeCount ?? ""}
              onChange={(e) => handleInputValues(e)}
              ref={(ref) =>
                (categoryInfoRef.current.contestCategoryJudgeCount = ref)
              }
              className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm font-mono tabular-nums text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2 pt-1">
            <label className="text-xs font-medium text-[#525252] sm:text-right">
              그랑프리 종목
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleInitGrandPrixFromCategoriesToGrades()}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium border border-[#171717]/[0.14] transition-colors duration-150 cursor-pointer"
              >
                <RefreshCw
                  size={14}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
                <span>그랑프리 종목 불러오기</span>
              </button>
              <button
                type="button"
                onClick={() => handleUpdateGrandPrixGrades()}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] text-xs font-medium border border-[#171717]/[0.08] transition-colors duration-150 cursor-pointer"
              >
                <Save size={14} strokeWidth={1.5} className="text-[#525252]" />
                <span>그랑프리 체급으로 저장</span>
              </button>
            </div>
          </div>

          {grandPrixArray?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-start gap-2">
              <label className="text-xs font-medium text-[#525252] sm:text-right pt-1.5">
                체급 목록
              </label>
              <div className="flex flex-wrap gap-1.5">
                {grandPrixArray.map((grand, gIdx) => {
                  const { contestCategoryTitle: categoryTitle } = grand;
                  return (
                    <span
                      key={gIdx}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 h-7 rounded-[4px] bg-[#ffffff] border border-[#171717]/[0.12] text-xs font-medium text-[#171717]"
                    >
                      <span>{categoryTitle}</span>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-4 h-4 rounded-[4px] text-[#737373] hover:bg-[#dc2626]/[0.10] hover:text-[#dc2626] transition-colors duration-150 cursor-pointer border-0 bg-transparent"
                        onClick={() => {
                          handleRemoveGrades(gIdx, grandPrixArray);
                        }}
                      >
                        <X size={12} strokeWidth={1.5} />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 하단 고정 푸터 */}
      <div className="flex w-full items-center justify-end gap-2 px-5 py-3.5 border-t border-[#171717]/[0.08] bg-[#fafafa] shrink-0 sticky bottom-0">
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] bg-white hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer"
          onClick={() => setClose()}
        >
          취소
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 px-5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors duration-150 cursor-pointer border-0"
          onClick={() => handleUpdateCategorys()}
        >
          저장
        </button>
      </div>
    </div>
  );
};

export default GrandPrixInfoModal;
