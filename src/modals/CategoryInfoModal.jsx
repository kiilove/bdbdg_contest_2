import React, { useContext, useEffect, useRef, useState } from "react";
import { Layers, X } from "lucide-react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { v4 as uuidv4 } from "uuid";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const parsePositiveInt = (val, fallback) => {
  const parsed = Number.parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const initCategoryInfo = {
  contestCategoryId: "",
  contestCategoryIndex: "",
  contestCategoryTitle: "",
  contestCategorySection: "",
  contestCategoryGender: "남",
  contestCategoryPriceType: "기본참가비",
  contestCategoryIsOverall: false,
  contestCategoryType: "",
  contestCategoryJudgeType: "ranking",
  contestCategoryJudgeCount: 5,
};

const CategoryInfoModal = ({ setClose, propState, setState, setRefresh }) => {
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setmessage] = useState({});
  const { currentContest } = useContext(CurrentContestContext);
  const [categoryInfo, setCategoryInfo] = useState({
    ...initCategoryInfo,
    contestCategoryIndex: (Number.parseInt(propState?.count, 10) || 0) + 1,
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

    const safeCategoryIndex = parsePositiveInt(
      updatedCategoryInfo.contestCategoryIndex,
      1
    );
    const safeJudgeCount = parsePositiveInt(
      updatedCategoryInfo.contestCategoryJudgeCount,
      5
    );

    const normalizedUpdatedInfo = {
      ...updatedCategoryInfo,
      contestCategoryIndex: safeCategoryIndex,
      contestCategoryJudgeCount: safeJudgeCount,
      contestCategoryIsOverall: Boolean(
        updatedCategoryInfo.contestCategoryIsOverall
      ),
    };

    setCategoryInfo((prevInfo) => ({
      ...prevInfo,
      ...normalizedUpdatedInfo,
    }));

    const dummy = [...categorysArray];

    switch (propState.title) {
      case "종목추가":
        dummy.push({
          ...normalizedUpdatedInfo,
          contestCategoryId: uuidv4(),
        });

        await handleSaveCategorys(dummy);
        setCategorysArray(dummy);
        setState(dummy);
        setCategoryInfo({
          ...initCategoryInfo,
          contestCategoryIndex: safeCategoryIndex + 1,
          contestCategoryJudgeCount: safeJudgeCount,
        });

        categoryInfoRef.current.contestCategorySection?.focus?.();

        break;

      case "종목수정": {
        const findCategoryIndex = dummy.findIndex(
          (category) => category.contestCategoryId === propState.categoryId
        );

        if (findCategoryIndex !== -1) {
          dummy.splice(findCategoryIndex, 1, {
            ...dummy[findCategoryIndex],
            ...normalizedUpdatedInfo,
          });
          await handleSaveCategorys(dummy);
          setCategorysArray(dummy);
          setState(dummy);
        }
        break;
      }

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
            variant: "success",
            title: "종목 정보 저장 완료",
            body: "종목 설정이 정상적으로 저장되었습니다.",
            isButton: true,
            confirmButtonText: "확인",
          });
          setMsgOpen(true);
        });
    } catch (error) {
      console.log(error);
      setmessage({
        variant: "error",
        title: "종목 저장 실패",
        body: "종목 정보를 저장하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
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
      const trimmed = String(value ?? "").trim();
      const parsed = Number.parseInt(trimmed, 10);
      setCategoryInfo({
        ...categoryInfo,
        contestCategoryIndex: trimmed === "" ? "" : Number.isFinite(parsed) ? parsed : "",
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
    if (propState.title === "종목수정" && propState.info) {
      const rawOverall =
        propState.info.contestCategoryIsOverall ??
        propState.info.contestCategroyIsOverall;
      setCategoryInfo({
        ...initCategoryInfo,
        ...propState.info,
        contestCategoryGender:
          propState.info.contestCategoryGender ||
          propState.info.contestCategroyGender ||
          "남",
        contestCategoryIsOverall:
          Boolean(rawOverall) && rawOverall !== "off",
        contestCategoryJudgeCount: parsePositiveInt(
          propState.info.contestCategoryJudgeCount,
          5
        ),
      });
    }
    categoryInfoRef.current.contestCategorySection?.focus?.();
  }, []);

  useEffect(() => {
    console.log(propState);
  }, [propState]);

  return (
    <div className="flex flex-col w-full h-full bg-white text-[#171717]">
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
            <Layers size={15} strokeWidth={1.5} className="text-[#525252]" />
          </div>
          <h1 className="text-base font-semibold text-[#171717] m-0">
            {propState?.title || "종목 설정"}
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

      {/* 스크롤 폼 영역 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
      </div>

      {/* 하단 고정 액션 바 */}
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

export default CategoryInfoModal;
