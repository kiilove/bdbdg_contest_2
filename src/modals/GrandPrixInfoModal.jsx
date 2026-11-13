"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { Trophy, RefreshCw, X } from "lucide-react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { v4 as uuidv4 } from "uuid";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateUUID } from "../functions/functions";

const createInitCategoryInfo = (nextIndex = 1, defaultJudgeCount = 7) => ({
  contestCategoryId: uuidv4(),
  contestCategoryIndex: nextIndex,
  contestCategoryTitle: "종목 그랑프리",
  contestCategorySection: "그랑프리",
  contestCategoryGender: "남",
  contestCategoryPriceType: "기본참가비",
  contestCategoryIsOverall: true,
  contestCategoryType: "그랑프리",
  contestCategoryJudgeType: "ranking",
  contestCategoryJudgeCount: defaultJudgeCount,
});

const GrandPrixInfoModal = ({ setClose, propState, setState, setRefresh }) => {
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setmessage] = useState({});
  const { currentContest } = useContext(CurrentContestContext);

  const nextIdx = Number.parseInt(propState?.count, 10)
    ? Number.parseInt(propState.count, 10) + 1
    : 1;

  const [categoryInfo, setCategoryInfo] = useState(() =>
    propState?.title === "그랑프리수정" && propState?.info
      ? { ...propState.info }
      : createInitCategoryInfo(nextIdx)
  );
  const [categorysList, setCategorysList] = useState({});
  const [categorysArray, setCategorysArray] = useState([]);
  const [gradesList, setGradesList] = useState({});
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

  const loadInitialData = async () => {
    const catListId = currentContest?.contests?.contestCategorysListId;
    const gradeListId = currentContest?.contests?.contestGradesListId;
    if (!catListId || !gradeListId) return;

    const [returnCategorys, returnGrades] = await Promise.all([
      contestCategoryDocument.getDocument(catListId),
      contestGradeDocument.getDocument(gradeListId),
    ]);

    const cats = returnCategorys?.categorys || [];
    const grds = returnGrades?.grades || [];

    setCategorysList({ ...(returnCategorys || {}) });
    setCategorysArray([...cats]);
    setGradesList({ ...(returnGrades || {}) });

    const sampleJudgeCount =
      Number(
        cats.find((c) => Number(c?.contestCategoryJudgeCount) > 0)
          ?.contestCategoryJudgeCount
      ) || 7;

    if (propState?.title === "그랑프리수정" && propState?.info) {
      const targetCatId = propState.info.contestCategoryId;
      setCategoryInfo({
        ...propState.info,
        contestCategoryJudgeCount:
          Number(propState.info.contestCategoryJudgeCount) || sampleJudgeCount,
      });

      const existingLinkedGrades = grds
        .filter((g) => g.refCategoryId === targetCatId)
        .sort(
          (a, b) =>
            Number(a.contestGradeIndex ?? 0) - Number(b.contestGradeIndex ?? 0)
        )
        .map((g) => ({
          contestGradeId: g.contestGradeId,
          contestCategoryTitle: g.contestGradeTitle,
          contestCategoryId: g.originalRefCategoryId || "",
        }));

      setGrandPrixArray(existingLinkedGrades);
    } else {
      setCategoryInfo((prev) => ({
        ...prev,
        contestCategoryJudgeCount:
          Number(prev.contestCategoryJudgeCount) || sampleJudgeCount,
      }));
      // 신규 추가 시 그랑프리 대상(contestCategoryIsOverall === true) 하위 종목을 자동 프리뷰 로드
      const overallSourceCategories = cats
        .filter(
          (f) =>
            Boolean(f.contestCategoryIsOverall) === true &&
            f.contestCategorySection !== "그랑프리"
        )
        .sort(
          (a, b) =>
            Number(a.contestCategoryIndex ?? 0) -
            Number(b.contestCategoryIndex ?? 0)
        )
        .map((c) => ({
          contestGradeId: "",
          contestCategoryTitle: c.contestCategoryTitle,
          contestCategoryId: c.contestCategoryId,
        }));
      setGrandPrixArray(overallSourceCategories);
    }
  };

  const handleRemoveGrades = (gradeIndex, gradeArray) => {
    const dummy = [...gradeArray];
    dummy.splice(gradeIndex, 1);
    setGrandPrixArray(dummy);
  };

  const handleInitGrandPrixFromCategoriesToGrades = () => {
    const existingByOrigId = new Map(
      grandPrixArray
        .filter((g) => g.contestCategoryId && g.contestGradeId)
        .map((g) => [g.contestCategoryId, g.contestGradeId])
    );

    const grandPrixGrades = categorysArray
      .filter(
        (f) =>
          Boolean(f.contestCategoryIsOverall) === true &&
          f.contestCategorySection !== "그랑프리"
      )
      .sort(
        (a, b) =>
          Number(a.contestCategoryIndex ?? 0) -
          Number(b.contestCategoryIndex ?? 0)
      )
      .map((c) => ({
        contestGradeId: existingByOrigId.get(c.contestCategoryId) || "",
        contestCategoryTitle: c.contestCategoryTitle,
        contestCategoryId: c.contestCategoryId,
      }));

    setGrandPrixArray(grandPrixGrades);
  };

  const syncGrandPrixGradesToFirestore = async (targetCategoryId) => {
    const gradeListId = currentContest?.contests?.contestGradesListId;
    if (!gradeListId || !targetCategoryId) return;

    const latestGradesDoc =
      (await contestGradeDocument.getDocument(gradeListId)) || gradesList || {};
    const allGrades = Array.isArray(latestGradesDoc.grades)
      ? latestGradesDoc.grades
      : [];

    // 기존 동일 그랑프리 종목 소속 체급의 ID 보존 맵 (무대/심판배정 ID 유지)
    const prevByOrigId = new Map();
    allGrades
      .filter((g) => g.refCategoryId === targetCategoryId)
      .forEach((g) => {
        if (g.originalRefCategoryId) {
          prevByOrigId.set(g.originalRefCategoryId, g);
        }
      });

    const otherGrades = allGrades.filter(
      (g) => g.refCategoryId !== targetCategoryId && g.refCategoryId !== ""
    );

    const syncedGpGrades = grandPrixArray.map((item, idx) => {
      const prev = prevByOrigId.get(item.contestCategoryId);
      return {
        contestGradeId:
          item.contestGradeId || prev?.contestGradeId || generateUUID(),
        contestGradeIndex: idx + 1,
        contestGradeTitle: item.contestCategoryTitle,
        isCompared: Boolean(prev?.isCompared),
        refCategoryId: targetCategoryId,
        originalRefCategoryId: item.contestCategoryId,
      };
    });

    await contestGradeUpdate.updateData(gradeListId, {
      ...latestGradesDoc,
      grades: [...otherGrades, ...syncedGpGrades],
    });
  };

  const handleUpdateCategorys = async () => {
    const idxVal = Number.parseInt(categoryInfo.contestCategoryIndex, 10);
    const titleVal = (categoryInfo.contestCategoryTitle || "").trim();
    if (!Number.isFinite(idxVal) || !titleVal) {
      setmessage({
        variant: "warning",
        title: "필수 항목 확인",
        body: "개최 순서와 종목명(예: 종목 그랑프리)을 입력해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    const targetCategoryId =
      propState?.title === "그랑프리수정"
        ? propState.categoryId || categoryInfo.contestCategoryId
        : categoryInfo.contestCategoryId || uuidv4();

    const normalizedCategory = {
      ...categoryInfo,
      contestCategoryId: targetCategoryId,
      contestCategoryIndex: idxVal,
      contestCategoryTitle: titleVal,
      contestCategorySection:
        (categoryInfo.contestCategorySection || "").trim() || "그랑프리",
      contestCategoryType:
        (categoryInfo.contestCategoryType || "").trim() || "그랑프리",
      contestCategoryJudgeType:
        categoryInfo.contestCategoryJudgeType || "ranking",
      contestCategoryJudgeCount:
        Number.parseInt(categoryInfo.contestCategoryJudgeCount, 10) || 7,
      contestCategoryIsOverall: true,
      contestCategoryGender: categoryInfo.contestCategoryGender || "남",
      contestCategoryPriceType:
        categoryInfo.contestCategoryPriceType || "기본참가비",
    };

    const nextCategories = [...categorysArray];
    const existingIndex = nextCategories.findIndex(
      (c) => c.contestCategoryId === targetCategoryId
    );
    if (existingIndex !== -1) {
      nextCategories.splice(existingIndex, 1, normalizedCategory);
    } else {
      nextCategories.push(normalizedCategory);
    }

    try {
      await contestCategoryUpdate.updateData(
        currentContest.contests.contestCategorysListId,
        {
          ...categorysList,
          categorys: nextCategories,
        }
      );

      await syncGrandPrixGradesToFirestore(targetCategoryId);

      setCategorysArray(nextCategories);
      setState(nextCategories);

      setmessage({
        variant: "success",
        title: "종목 그랑프리 저장 완료",
        body: `종목 그랑프리 및 하위 우승자 연동 체급(${grandPrixArray.length}개)이 함께 저장되었습니다.`,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } catch (error) {
      console.error(error);
      setmessage({
        variant: "error",
        title: "그랑프리 저장 실패",
        body: "그랑프리 종목 및 연동 체급을 저장하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    }
  };

  const handleInputValues = (e) => {
    const { name, value } = e.target;
    setCategoryInfo((prev) => ({
      ...prev,
      [name]:
        name === "contestCategoryIsOverall"
          ? e.target.checked
          : name === "contestCategoryIndex"
          ? value === ""
            ? ""
            : Number.parseInt(value, 10)
          : value,
    }));
  };

  useEffect(() => {
    loadInitialData();
    categoryInfoRef.current.contestCategoryTitle?.focus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-white text-[#171717]">
      <ConfirmationModal
        isOpen={msgOpen}
        message={message}
        onCancel={() => {
          setMsgOpen(false);
          if (message?.variant === "success") {
            setRefresh(true);
            setClose();
          }
        }}
        onConfirm={() => {
          setMsgOpen(false);
          if (message?.variant === "success") {
            setRefresh(true);
            setClose();
          }
        }}
      />

      {/* 상단 고정 헤더 */}
      <div className="flex w-full items-center justify-between px-5 py-4 border-b border-[#171717]/[0.08] bg-[#fafafa] shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-white border border-[#171717]/[0.08] flex items-center justify-center">
            <Trophy size={15} strokeWidth={1.5} className="text-[#2563eb]" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-[#171717] m-0">
              {propState?.title || "종목 그랑프리 설정"}
            </h1>
            <p className="text-[11px] text-[#737373] m-0 mt-0.5">
              그랑프리 대상(Overall)으로 체크된 하위 종목의 각 체급 1위 우승자를 자동으로 끌고 옵니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setClose()}
          aria-label="닫기"
          className="h-8 w-8 rounded-[8px] inline-flex items-center justify-center text-[#737373] hover:bg-[#e4e4e7]/70 hover:text-[#171717] transition-colors duration-150 cursor-pointer border-0 bg-transparent"
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
              type="number"
              value={categoryInfo.contestCategoryIndex ?? ""}
              onChange={handleInputValues}
              ref={(ref) => (categoryInfoRef.current.contestCategoryIndex = ref)}
              name="contestCategoryIndex"
              className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm font-mono tabular-nums text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
              placeholder="개최 순서 (숫자)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2">
            <label className="text-xs font-medium text-[#525252] sm:text-right">
              구분 (고정 권장)
            </label>
            <input
              type="text"
              name="contestCategorySection"
              value={categoryInfo.contestCategorySection ?? "그랑프리"}
              onChange={handleInputValues}
              ref={(ref) =>
                (categoryInfoRef.current.contestCategorySection = ref)
              }
              className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
              placeholder="그랑프리 (하위 우승자 자동연동 필수값)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-2">
            <label className="text-xs font-medium text-[#525252] sm:text-right">
              종목 대분류
            </label>
            <input
              type="text"
              name="contestCategoryType"
              placeholder="예: 그랑프리"
              value={categoryInfo.contestCategoryType ?? ""}
              onChange={handleInputValues}
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
              placeholder="예: 종목 그랑프리"
              value={categoryInfo.contestCategoryTitle ?? ""}
              onChange={handleInputValues}
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
              onChange={handleInputValues}
              value={categoryInfo.contestCategoryJudgeType || "ranking"}
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
              type="number"
              name="contestCategoryJudgeCount"
              value={categoryInfo.contestCategoryJudgeCount ?? 7}
              onChange={handleInputValues}
              ref={(ref) =>
                (categoryInfoRef.current.contestCategoryJudgeCount = ref)
              }
              className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm font-mono tabular-nums text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-start gap-2 pt-2 border-t border-[#171717]/[0.06]">
            <label className="text-xs font-medium text-[#525252] sm:text-right pt-2">
              연동 하위 종목
            </label>
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleInitGrandPrixFromCategoriesToGrades}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium border border-[#171717]/[0.14] transition-colors duration-150 cursor-pointer"
                >
                  <RefreshCw
                    size={13}
                    strokeWidth={1.6}
                    className="text-[#2563eb]"
                  />
                  <span>그랑프리 대상 종목 다시 불러오기</span>
                </button>
                <span className="text-[11px] text-[#737373]">
                  하단 [저장] 클릭 시 아래 연동 체급이 함께 저장됩니다.
                </span>
              </div>

              {grandPrixArray?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {grandPrixArray.map((grand, gIdx) => (
                    <span
                      key={grand.contestCategoryId || gIdx}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 h-7 rounded-[6px] bg-[#ffffff] border border-[#2563eb]/25 text-xs font-medium text-[#171717]"
                    >
                      <span>{grand.contestCategoryTitle}</span>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-4 h-4 rounded-[4px] text-[#737373] hover:bg-[#dc2626]/[0.10] hover:text-[#dc2626] transition-colors duration-150 cursor-pointer border-0 bg-transparent"
                        onClick={() => handleRemoveGrades(gIdx, grandPrixArray)}
                      >
                        <X size={12} strokeWidth={1.5} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#b45309] m-0">
                  연동된 하위 종목이 없습니다. 일반 종목에서 [그랑프리 대상]을 체크한 뒤 불러오기를 눌러주세요.
                </p>
              )}
            </div>
          </div>
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
          onClick={handleUpdateCategorys}
        >
          저장
        </button>
      </div>
    </div>
  );
};

export default GrandPrixInfoModal;
