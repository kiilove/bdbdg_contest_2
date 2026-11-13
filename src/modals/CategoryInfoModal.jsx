import React, { useContext, useEffect, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { v4 as uuidv4 } from "uuid";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const initCategoryInfo = {
  contestCategoryId: "",
  contestCategoryIndex: "",
  contestCategoryTitle: "",
  contestCategorySection: "",
  contestCategroyGender: "남",
  contestCategoryPriceType: "기본참가비",
  contestCategroyIsOverall: "off",
  contestCategoryType: "",
  contestCategoryJudgeType: "ranking",
};

const CategoryInfoModal = ({ setClose, propState, setState, setRefresh }) => {
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setmessage] = useState({});
  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );
  const [categoryInfo, setCategoryInfo] = useState({
    ...initCategoryInfo,
    contestCategoryIndex: parseInt(propState.count) + 1,
  });
  const [categorysList, setCategorysList] = useState({});
  const [categorysArray, setCategorysArray] = useState([]);

  const categoryInfoRef = useRef({});

  const contestCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const contestCategoryUpdate = useFirestoreUpdateData(
    "contest_categorys_list"
  );

  const getCategorys = async () => {
    const returnCategorys = await contestCategoryDocument.getDocument(
      currentContest.contests.contestCategorysListId
    );
    setCategorysList({ ...returnCategorys });
    setCategorysArray([...returnCategorys.categorys]);
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

    const dummy = [...categorysArray];

    switch (propState.title) {
      case "종목추가":
        dummy.push({
          ...updatedCategoryInfo,
          contestCategoryId: uuidv4(),
          contestCategoryIndex: parseInt(
            updatedCategoryInfo.contestCategoryIndex
          ),
        });

        await handleSaveCategorys(dummy);
        setCategorysArray(dummy);
        setState(dummy);
        setCategoryInfo({
          ...initCategoryInfo,
          contestCategoryIndex:
            parseInt(updatedCategoryInfo.contestCategoryIndex) + 1,
          contestCategoryJudgeCount: parseInt(
            updatedCategoryInfo.contestCategoryJudgeCount
          ),
        });

        categoryInfoRef.current.contestCategorySection.focus();

        break;

      case "종목수정":
        const findCategoryIndex = dummy.findIndex(
          (category) => category.contestCategoryId === propState.categoryId
        );

        if (findCategoryIndex !== -1) {
          dummy.splice(findCategoryIndex, 1, {
            ...dummy[findCategoryIndex],
            ...updatedCategoryInfo,
            contestCategoryIndex: parseInt(
              updatedCategoryInfo.contestCategoryIndex
            ),
            contestCategoryJudgeCount: parseInt(
              updatedCategoryInfo.contestCategoryJudgeCount
            ),
          });
          await handleSaveCategorys(dummy);
          setCategorysArray(dummy);
          setState(dummy);
        }
        break;

      default:
        break;
    }
  };

  const handleSaveCategorys = async (data) => {
    try {
      await contestCategoryUpdate
        .updateData(currentContest.contests.contestCategorysListId, {
          ...categorysList,
          categorys: [...data],
        })
        .then(() => {
          setmessage({
            body: "저장되었습니다.",
            isButton: true,
            confirmButtonText: "확인",
          });
          setMsgOpen(true);
        });
    } catch (error) {
      console.log(error);
    }
  };

  const handleInputValues = (e) => {
    const { name, value } = e.target;

    if (name === "contestCategoryIsOverall") {
      setCategoryInfo({
        ...categoryInfo,
        contestCategoryIsOverall: e.target.checked,
      });
    } else if (name === "contestCategoryIndex") {
      setCategoryInfo({
        ...categoryInfo,
        contestCategoryIndex: parseInt(value),
      });
    } else {
      setCategoryInfo({
        ...categoryInfo,
        [name]: value,
      });
    }
  };

  useEffect(() => {
    getCategorys();
    if (propState.title === "종목수정") {
      setCategoryInfo({ ...propState.info });
    }
    categoryInfoRef.current.contestCategorySection.focus();
  }, []);

  useEffect(() => {
    console.log(propState);
  }, [propState]);

  return (
    <div className="flex w-full flex-col gap-4 h-auto bg-[#ffffff] text-[#171717] p-2">
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

      <div className="flex w-full items-center gap-2.5 pb-3 border-b border-[#171717]/[0.08]">
        <div className="w-8 h-8 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] flex items-center justify-center">
          <Layers size={15} strokeWidth={1.5} className="text-[#525252]" />
        </div>
        <h1 className="text-base font-semibold text-[#171717] m-0">
          {propState?.title || "종목 설정"}
        </h1>
      </div>

      <div className="bg-[#fafafa] rounded-[12px] border border-[#171717]/[0.08] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            개최 순서
          </label>
          <input
            type="text"
            value={categoryInfo.contestCategoryIndex ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (categoryInfoRef.current.contestCategoryIndex = ref)}
            name="contestCategoryIndex"
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm font-mono tabular-nums text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
            placeholder="개최 순서 (숫자)"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            구분 (부문)
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
            placeholder="예: 1부, 2부"
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
            placeholder="종목명 입력"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            참가 가능 성별
          </label>
          <select
            name="contestCategoryGender"
            onChange={(e) => handleInputValues(e)}
            value={categoryInfo.contestCategoryGender}
            ref={(ref) =>
              (categoryInfoRef.current.contestCategoryGender = ref)
            }
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          >
            <option>남</option>
            <option>여</option>
            <option>무관</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            참가비 종류
          </label>
          <select
            name="contestCategoryPriceType"
            onChange={(e) => handleInputValues(e)}
            value={categoryInfo.contestCategoryPriceType}
            ref={(ref) =>
              (categoryInfoRef.current.contestCategoryPriceType = ref)
            }
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          >
            <option>기본참가비</option>
            <option>타입1</option>
            <option>타입2</option>
          </select>
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
            placeholder="예: 7, 9"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2 pt-1">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            오버롤 종목
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-[#525252]">
            <input
              type="checkbox"
              name="contestCategoryIsOverall"
              checked={Boolean(categoryInfo.contestCategoryIsOverall)}
              ref={(ref) =>
                (categoryInfoRef.current.contestCategoryIsOverall = ref)
              }
              onChange={(e) => handleInputValues(e)}
              className="w-4 h-4 rounded-[4px] accent-[#2563eb]"
            />
            <span>그랑프리(오버롤) 진출 대상 종목으로 지정</span>
          </label>
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
          onClick={() => handleUpdateCategorys()}
        >
          저장
        </button>
      </div>
    </div>
  );
};

export default CategoryInfoModal;
