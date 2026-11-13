import { Drawer } from "@mui/material";
import React, { useContext, useEffect, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import CategoryInfoModal from "../modals/CategoryInfoModal";
import GradeInfoModal from "../modals/GradeInfoModal";
import GrandPrixInfoModal from "../modals/GrandPrixInfoModal";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import BibTag from "../components/ui/BibTag";
import { GripVertical, Plus, Pencil, Trash2, Trophy } from "lucide-react";

const ContestCategoryOrderTable = () => {
  const [categoriesList, setCategoriesList] = useState({});
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);
  const [isOpen, setIsOpen] = useState({
    category: false,
    grade: false,
    player: false,
    grandPrix: false,
    categoryId: "",
    gradeId: "",
  });

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState({});
  const [deleteAction, setDeleteAction] = useState(null);
  const [isRefresh, setIsRefresh] = useState(false);
  const { currentContest } = useContext(CurrentContestContext);
  const fetchCategroyDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const contestCategoryUpdate = useFirestoreUpdateData(
    "contest_categorys_list"
  );
  const contestGradesUpdate = useFirestoreUpdateData("contest_grades_list");

  const fetchPool = async () => {
    const returnCategories = await fetchCategroyDocument.getDocument(
      currentContest.contests.contestCategorysListId
    );
    const returnGrades = await fetchGradeDocument.getDocument(
      currentContest.contests.contestGradesListId
    );

    if (returnCategories) {
      setCategoriesList(returnCategories);
      setCategoriesArray([
        ...returnCategories?.categorys.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        ),
      ]);
    }

    if (returnGrades) {
      setGradesArray([...returnGrades?.grades]);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      const updatedCategories = categoriesArray.filter(
        (category) => category.contestCategoryId !== categoryId
      );
      const updatedGrades = gradesArray.filter(
        (grade) => grade.refCategoryId !== categoryId
      );

      await contestCategoryUpdate.updateData(
        currentContest.contests.contestCategorysListId,
        { ...categoriesList, categorys: updatedCategories }
      );
      await contestGradesUpdate.updateData(
        currentContest.contests.contestGradesListId,
        { grades: updatedGrades }
      );

      setCategoriesArray(updatedCategories);
      setGradesArray(updatedGrades);
      setConfirmationOpen(false);
    } catch (error) {
      console.error("Category deletion failed:", error);
    }
  };

  const handleDeleteGrade = async (gradeId) => {
    try {
      const updatedGrades = gradesArray.filter(
        (grade) => grade.contestGradeId !== gradeId
      );
      await contestGradesUpdate.updateData(
        currentContest.contests.contestGradesListId,
        { grades: updatedGrades }
      );

      setGradesArray(updatedGrades);
      setConfirmationOpen(false);
    } catch (error) {
      console.error("Grade deletion failed:", error);
    }
  };

  const confirmDeletion = (message, action) => {
    setConfirmationMessage(message);
    setDeleteAction(() => () => action());
    setConfirmationOpen(true);
  };

  const onDragCategoryEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const dummy = [...categoriesArray];
    const [reorderCategory] = dummy.splice(source.index, 1);
    dummy.splice(destination.index, 0, reorderCategory);
    handleSaveCategorys(handleReOrderCategory(dummy));
    setCategoriesArray(handleReOrderCategory(dummy));
  };

  const handleReOrderCategory = (data) => {
    const prevOrder = [...data];
    return prevOrder.map((item, idx) => ({
      ...item,
      contestCategoryIndex: idx + 1,
    }));
  };

  const handleSaveCategorys = async (data) => {
    try {
      await contestCategoryUpdate.updateData(
        currentContest.contests.contestCategorysListId,
        { ...categoriesList, categorys: [...data] }
      );
    } catch (error) {
      console.log(error);
    }
  };

  const handleGrandPrixClose = () => {
    setIsOpen((prevState) => ({ ...prevState, grandPrix: false }));
  };

  const handleCategoryClose = () => {
    setIsOpen((prevState) => ({ ...prevState, category: false }));
  };

  const handleGradeClose = () => {
    setIsOpen((prevState) => ({ ...prevState, grade: false }));
  };

  useEffect(() => {
    if (currentContest?.contests?.id) fetchPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest]);

  useEffect(() => {
    if (isRefresh) {
      fetchPool();
      setIsRefresh(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefresh]);

  return (
    <div className="w-full space-y-4 pt-2">
      <Drawer
        anchor="right"
        open={Boolean(isOpen?.grandPrix)}
        onClose={handleGrandPrixClose}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 540 },
            bgcolor: "#ffffff",
            boxShadow: "-12px 0 40px rgba(15, 23, 42, 0.14)",
          },
        }}
      >
        <div className="h-full w-full flex flex-col bg-white overflow-hidden">
          <GrandPrixInfoModal
            setClose={handleGrandPrixClose}
            propState={isOpen}
            setState={setCategoriesArray}
            setRefresh={setIsRefresh}
          />
        </div>
      </Drawer>
      <Drawer
        anchor="right"
        open={Boolean(isOpen?.category)}
        onClose={handleCategoryClose}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 540 },
            bgcolor: "#ffffff",
            boxShadow: "-12px 0 40px rgba(15, 23, 42, 0.14)",
          },
        }}
      >
        <div className="h-full w-full flex flex-col bg-white overflow-hidden">
          <CategoryInfoModal
            setClose={handleCategoryClose}
            propState={isOpen}
            setState={setCategoriesArray}
            setRefresh={setIsRefresh}
          />
        </div>
      </Drawer>
      <Drawer
        anchor="right"
        open={Boolean(isOpen?.grade)}
        onClose={handleGradeClose}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 540 },
            bgcolor: "#ffffff",
            boxShadow: "-12px 0 40px rgba(15, 23, 42, 0.14)",
          },
        }}
      >
        <div className="h-full w-full flex flex-col bg-white overflow-hidden">
          <GradeInfoModal
            setClose={handleGradeClose}
            propState={isOpen}
            setState={setGradesArray}
            setRefresh={setIsRefresh}
          />
        </div>
      </Drawer>

      {/* 상단 액션 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fafafa] border border-[#171717]/[0.08] rounded-[12px] px-4 py-3">
        <div className="text-xs text-[#737373] flex items-center gap-3">
          <span>
            등록 종목{" "}
            <strong className="font-mono font-medium tabular-nums text-[#171717]">
              {categoriesArray.length}
            </strong>
            개
          </span>
          <span className="text-[#171717]/15">·</span>
          <span>
            세부 체급{" "}
            <strong className="font-mono font-medium tabular-nums text-[#171717]">
              {gradesArray.length}
            </strong>
            개
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-sm font-medium text-[#171717] inline-flex items-center gap-2 transition-colors duration-150"
            onClick={() =>
              setIsOpen({
                ...isOpen,
                grandPrix: true,
                title: "그랑프리추가",
                count: categoriesArray.length,
              })
            }
          >
            <Trophy size={16} strokeWidth={1.5} className="text-[#525252]" />
            <span>그랑프리 추가</span>
          </button>
          <button
            type="button"
            className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-sm font-medium text-white inline-flex items-center gap-2 transition-colors duration-150"
            onClick={() =>
              setIsOpen({
                ...isOpen,
                category: true,
                title: "종목추가",
                count: categoriesArray.length,
              })
            }
          >
            <Plus size={16} strokeWidth={1.5} />
            <span>종목 추가</span>
          </button>
        </div>
      </div>

      {/* 종목 및 체급 드래그 리스트 */}
      {categoriesArray?.length <= 0 ? (
        <div className="rounded-[12px] border border-[#171717]/[0.08] bg-[#fafafa] py-12 px-4 text-center text-sm text-[#737373]">
          등록된 종목 데이터가 없습니다. 상단의 종목 추가 버튼을 눌러 종목을 생성하세요.
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragCategoryEnd}>
          <Droppable droppableId="dropCategory">
            {(p) => (
              <div
                className="flex w-full flex-col gap-3"
                ref={p.innerRef}
                {...p.droppableProps}
              >
                {categoriesArray
                  .sort(
                    (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
                  )
                  .map((category, cIdx) => {
                    const {
                      contestCategoryId: categoryId,
                      contestCategoryIndex: categoryIndex,
                      contestCategoryTitle: categoryTitle,
                      contestCategoryJudgeCount: judgeCount,
                      contestCategorySection: categorySection,
                      contestCategoryJudgeType: categoryJudgeType,
                      contestCategoryIsOverall: categoryIsOverall,
                    } = category;

                    const matchedGrades = gradesArray
                      .filter((grade) => grade.refCategoryId === categoryId)
                      .sort(
                        (a, b) => a.contestGradeIndex - b.contestGradeIndex
                      );

                    return (
                      <Draggable
                        key={categoryId}
                        draggableId={categoryId}
                        id={categoryId}
                        index={cIdx}
                      >
                        {(provided, snapshot) => (
                          <div
                            className={`flex w-full flex-col rounded-[12px] border transition-colors duration-150 ${
                              snapshot.isDragging
                                ? "bg-[#f4f4f5] border-[#2563eb] shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                                : "bg-[#ffffff] border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                            }`}
                            id={categoryId + "div"}
                            ref={provided.innerRef}
                            {...provided.dragHandleProps}
                            {...provided.draggableProps}
                          >
                            <div className="w-full flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <GripVertical
                                  size={16}
                                  strokeWidth={1.5}
                                  className="text-[#737373] shrink-0"
                                />
                                <BibTag
                                  prefix="#"
                                  number={categoryIndex}
                                  size="sm"
                                />
                                <span className="text-[15px] font-medium text-[#171717]">
                                  {categoryTitle}
                                </span>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {judgeCount && (
                                    <span className="px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs text-[#525252] tabular-nums">
                                      {judgeCount}심제
                                    </span>
                                  )}
                                  {categorySection && (
                                    <span className="px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs text-[#525252]">
                                      {categorySection}
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs text-[#737373]">
                                    {categoryJudgeType === "ranking"
                                      ? "랭킹형"
                                      : "점수형"}
                                  </span>
                                  {categoryIsOverall && (
                                    <span className="px-2 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-xs font-medium text-[#2563eb]">
                                      그랑프리 대상
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  className="h-8 px-3 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7]/70 border border-[#171717]/[0.08] text-xs font-medium text-[#171717] inline-flex items-center gap-1.5 transition-colors duration-150"
                                  onClick={() =>
                                    setIsOpen({
                                      ...isOpen,
                                      grade: true,
                                      title: "체급추가",
                                      categoryId,
                                      categoryTitle,
                                      count: matchedGrades.length,
                                      info: { ...category },
                                    })
                                  }
                                >
                                  <Plus
                                    size={14}
                                    strokeWidth={1.5}
                                    className="text-[#525252]"
                                  />
                                  <span>체급 추가</span>
                                </button>

                                {categorySection === "그랑프리" ? (
                                  <button
                                    type="button"
                                    title="그랑프리 수정"
                                    className="w-8 h-8 rounded-[8px] bg-transparent hover:bg-[#f4f4f5] text-[#525252] inline-flex items-center justify-center transition-colors duration-150"
                                    onClick={() =>
                                      setIsOpen({
                                        ...isOpen,
                                        grandPrix: true,
                                        category: false,
                                        title: "그랑프리수정",
                                        categoryId,
                                        info: { ...category },
                                        count: gradesArray.length,
                                      })
                                    }
                                  >
                                    <Pencil size={16} strokeWidth={1.5} />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    title="종목 수정"
                                    className="w-8 h-8 rounded-[8px] bg-transparent hover:bg-[#f4f4f5] text-[#525252] inline-flex items-center justify-center transition-colors duration-150"
                                    onClick={() =>
                                      setIsOpen({
                                        ...isOpen,
                                        category: true,
                                        title: "종목수정",
                                        categoryId,
                                        info: { ...category },
                                        count: gradesArray.length,
                                      })
                                    }
                                  >
                                    <Pencil size={16} strokeWidth={1.5} />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  title="종목 삭제"
                                  className="w-8 h-8 rounded-[8px] bg-transparent hover:bg-[#dc2626]/[0.08] text-[#737373] hover:text-[#dc2626] inline-flex items-center justify-center transition-colors duration-150"
                                  onClick={() =>
                                    confirmDeletion(
                                      {
                                        variant: "danger",
                                        title: "종목 삭제 확인",
                                        body: `'${categoryTitle}' 종목을 삭제하시겠습니까?`,
                                        body2:
                                          "삭제 후에는 복구할 수 없으며 연결된 체급 구성에 영향을 줄 수 있습니다.",
                                        isButton: true,
                                        confirmButtonText: "삭제",
                                        cancelButtonText: "취소",
                                      },
                                      () => handleDeleteCategory(categoryId)
                                    )
                                  }
                                >
                                  <Trash2 size={16} strokeWidth={1.5} />
                                </button>
                              </div>
                            </div>

                            {/* 하위 체급 목록 */}
                            <div className="w-full bg-[#fafafa] border-t border-[#171717]/[0.06] px-4 py-2.5 rounded-b-[12px]">
                              <div className="flex w-full gap-2 flex-wrap items-center min-h-[36px]">
                                {matchedGrades?.length > 0 ? (
                                  matchedGrades.map((match, mIdx) => {
                                    const {
                                      contestGradeId: gradeId,
                                      contestGradeTitle: gradeTitle,
                                    } = match;
                                    return (
                                      <div
                                        className="inline-flex items-center justify-between bg-[#ffffff] border border-[#171717]/[0.08] px-3 h-9 rounded-[8px] gap-2.5 w-full sm:w-auto"
                                        key={gradeId + mIdx}
                                        id={gradeId + "grade"}
                                      >
                                        <span className="text-sm text-[#171717]">
                                          {gradeTitle}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            title="체급 수정"
                                            className="w-6 h-6 rounded-[4px] hover:bg-[#f4f4f5] text-[#737373] hover:text-[#171717] flex justify-center items-center transition-colors duration-150"
                                            onClick={() =>
                                              setIsOpen({
                                                ...isOpen,
                                                grade: true,
                                                title: "체급수정",
                                                gradeId: gradeId,
                                                info: { ...match },
                                                categoryTitle,
                                              })
                                            }
                                          >
                                            <Pencil
                                              size={14}
                                              strokeWidth={1.5}
                                            />
                                          </button>
                                          <button
                                            type="button"
                                            title="체급 삭제"
                                            className="w-6 h-6 rounded-[4px] hover:bg-[#dc2626]/[0.08] text-[#737373] hover:text-[#dc2626] flex justify-center items-center transition-colors duration-150"
                                            onClick={() =>
                                              confirmDeletion(
                                                {
                                                  variant: "danger",
                                                  title: "체급 삭제 확인",
                                                  body: `'${categoryTitle} - ${gradeTitle}' 체급을 삭제하시겠습니까?`,
                                                  isButton: true,
                                                  confirmButtonText: "삭제",
                                                  cancelButtonText: "취소",
                                                },
                                                () => handleDeleteGrade(gradeId)
                                              )
                                            }
                                          >
                                            <Trash2
                                              size={14}
                                              strokeWidth={1.5}
                                            />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <span className="text-xs text-[#737373]">
                                    등록된 세부 체급이 없습니다
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                {p.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <ConfirmationModal
        isOpen={confirmationOpen}
        onConfirm={() => {
          if (deleteAction) deleteAction();
        }}
        onCancel={() => setConfirmationOpen(false)}
        message={confirmationMessage}
      />
    </div>
  );
};

export default ContestCategoryOrderTable;
