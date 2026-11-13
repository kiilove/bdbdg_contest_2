"use client";

import { useEffect, useMemo, useState } from "react";
import { Select, Tabs } from "antd";
import {
  User,
  Phone,
  Users,
  RotateCcw,
  Shuffle,
  Trash2,
  AlertTriangle,
  LayoutGrid,
  Layers,
} from "lucide-react";

const CategoryAssign = ({
  judgesAssignInfo,
  judgesPoolArray,
  setJudgesAssignInfo,
  categoriesArray,
  gradesArray,
  currentContest,
  generateUUID,
  setMessage,
  setMsgOpen,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [activeSection, setActiveSection] = useState("__ALL__");

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  /** 이름 정렬 유틸 (ko 로케일, 대소문자 무시) */
  const sortJudgesByName = (arr = []) =>
    [...arr].sort((a, b) =>
      (a?.judgeName || "").localeCompare(b?.judgeName || "", "ko", {
        sensitivity: "base",
        numeric: true,
      })
    );

  /** 카테고리별 이미 배정된 심판 UID 배열 */
  const getAssignedJudgesForCategory = (categoryId) => {
    return (judgesAssignInfo.judges || [])
      .filter((assign) => assign.categoryId === categoryId)
      .map((assign) => assign.judgeUid);
  };

  /** 다중 심판 체크 */
  const getSeatStatus = (categoryId, seatIndex) => {
    const assigned = (judgesAssignInfo.judges || []).filter(
      (a) => a.categoryId === categoryId && a.seatIndex === seatIndex
    );
    const uniqueJudges = [...new Set(assigned.map((a) => a.judgeUid))];
    return uniqueJudges.length > 1 ? "multi" : "single";
  };

  /** 카테고리에 심판 배정 (원본 필드만 push) + grade 단위 유효성 검사 */
  const assignJudgeToCategory = (
    category,
    grades,
    selectedJudge,
    seatNumber,
    updatedJudges
  ) => {
    const allErrors = [];

    grades.forEach((grade) => {
      const missing = [];

      if (!category?.contestCategorySection) missing.push("sectionName");
      if (!category?.contestCategoryId) missing.push("categoryId");
      if (!selectedJudge?.judgeUid) missing.push("judgeUid");
      if (!selectedJudge?.judgeName) missing.push("judgeName");
      if (!currentContest?.contests?.id) missing.push("contestId");
      if (seatNumber == null) missing.push("seatIndex");

      if (grade?.contestGradeId == null) missing.push("contestGradeId");
      if (grade?.contestGradeIndex == null) missing.push("contestGradeIndex");
      if (!grade?.contestGradeTitle) missing.push("contestGradeTitle");
      if (grade?.refCategoryId == null) missing.push("refCategoryId");

      if (missing.length) {
        const label =
          grade?.contestGradeTitle ??
          grade?.contestGradeId ??
          "(알 수 없는 체급)";
        allErrors.push(`${label} → ${missing.join(", ")}`);
        return;
      }

      updatedJudges.push({
        sectionName: category.contestCategorySection,
        categoryId: category.contestCategoryId,
        seatIndex: seatNumber,
        judgeUid: selectedJudge.judgeUid,
        judgeName: selectedJudge.judgeName,
        judgesAssignId: generateUUID(),
        contestId: currentContest.contests.id,
        isHead: !!selectedJudge.isHead,
        onedayPassword: selectedJudge.onedayPassword || null,
        contestGradeId: grade.contestGradeId,
        contestGradeIndex: grade.contestGradeIndex,
        contestGradeTitle: grade.contestGradeTitle,
        isCompared: !!grade.isCompared,
        refCategoryId: grade.refCategoryId || null,
      });
    });

    if (allErrors.length) {
      setMessage?.({
        body:
          `배정할 수 없습니다. ${
            category?.contestCategoryTitle ?? "(이름 없는 카테고리)"
          } / 좌석 ${seatNumber} 누락 정보:\n- ` + allErrors.join("\n- "),
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen?.(true);
      return false;
    }
    return true;
  };

  /** 심판 선택 */
  const handleSelectJudge = (category, seatIndex, judgeUid) => {
    const selectedJudge = judgesPoolArray.find(
      (judge) => judge.judgeUid === judgeUid
    );
    if (!selectedJudge) return;

    const updatedJudges = (judgesAssignInfo.judges || []).filter(
      (assign) =>
        !(
          assign.categoryId === category.contestCategoryId &&
          assign.seatIndex === seatIndex
        )
    );

    const categoryGrades = (gradesArray || []).filter(
      (g) => g.refCategoryId === category.contestCategoryId
    );

    if (
      assignJudgeToCategory(
        category,
        categoryGrades,
        selectedJudge,
        seatIndex,
        updatedJudges
      )
    ) {
      setJudgesAssignInfo((prev) => ({
        ...(prev || {}),
        judges: updatedJudges,
      }));
    }
  };

  /** 심판 제거 */
  const handleRemoveAssign = (category, seatIndex) => {
    const updatedJudges = (judgesAssignInfo.judges || []).filter(
      (assign) =>
        !(
          assign.categoryId === category.contestCategoryId &&
          assign.seatIndex === seatIndex
        )
    );
    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: updatedJudges,
    }));
  };

  /** 랜덤 배정 (빈 좌석만) */
  const handleRandomAssign = (category, unassignedSeats) => {
    const availableJudges = judgesPoolArray.filter(
      (judge) =>
        !getAssignedJudgesForCategory(category.contestCategoryId).includes(
          judge.judgeUid
        )
    );

    const updatedJudgesAssignInfo = [...(judgesAssignInfo.judges || [])];
    const categoryGrades = (gradesArray || []).filter(
      (g) => g.refCategoryId === category.contestCategoryId
    );

    unassignedSeats.forEach((seatNumber) => {
      if (availableJudges.length > 0) {
        const randomJudge =
          availableJudges[Math.floor(Math.random() * availableJudges.length)];
        if (randomJudge) {
          const ok = assignJudgeToCategory(
            category,
            categoryGrades,
            randomJudge,
            seatNumber,
            updatedJudgesAssignInfo
          );
          if (!ok) return;
          availableJudges.splice(availableJudges.indexOf(randomJudge), 1);
        }
      }
    });

    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: updatedJudgesAssignInfo,
    }));
  };

  /** 전체 랜덤 (해당 카테고리 모두 재배정) */
  const handleAllRandomAssign = (category, allSeats) => {
    const availableJudges = [...judgesPoolArray];
    const updatedJudgesAssignInfo = (judgesAssignInfo.judges || []).filter(
      (assign) => assign.categoryId !== category.contestCategoryId
    );

    const categoryGrades = (gradesArray || []).filter(
      (g) => g.refCategoryId === category.contestCategoryId
    );

    allSeats.forEach((seatNumber) => {
      if (availableJudges.length > 0) {
        const randomJudge = availableJudges.splice(
          Math.floor(Math.random() * availableJudges.length),
          1
        )[0];
        if (randomJudge) {
          const ok = assignJudgeToCategory(
            category,
            categoryGrades,
            randomJudge,
            seatNumber,
            updatedJudgesAssignInfo
          );
          if (!ok) return;
        }
      }
    });

    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: updatedJudgesAssignInfo,
    }));
  };

  /** 초기화 */
  const handleResetAssign = (category) => {
    const clearedJudges = (judgesAssignInfo.judges || []).filter(
      (assign) => assign.categoryId !== category.contestCategoryId
    );
    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: clearedJudges,
    }));
  };

  const commonSelectProps = {
    showSearch: true,
    allowClear: true,
    optionFilterProp: "data-search",
    filterOption: (input, option) => {
      const hay = (option?.props?.["data-search"] || "")
        .toString()
        .toLowerCase();
      return hay.includes((input || "").toLowerCase());
    },
    placeholder: "심판 선택",
  };

  /** 섹션 목록 + 탭 아이템 생성 */
  const { sectionTabs } = useMemo(() => {
    const namesSet = new Set(
      (categoriesArray || []).map(
        (c) => c?.contestCategorySection?.trim() || "미지정"
      )
    );
    const names = Array.from(namesSet).sort((a, b) =>
      a.localeCompare(b, "ko", { sensitivity: "base", numeric: true })
    );

    const items = [
      {
        key: "__ALL__",
        label: (
          <span className="inline-flex items-center gap-1.5">
            <LayoutGrid
              size={14}
              strokeWidth={1.5}
              className="text-[#737373]"
            />
            <span>전체</span>
          </span>
        ),
      },
      ...names.map((name) => ({
        key: name,
        label: (
          <span className="inline-flex items-center gap-1.5">
            <Layers size={14} strokeWidth={1.5} className="text-[#737373]" />
            <span>{name}</span>
          </span>
        ),
      })),
    ];
    return { sectionNames: names, sectionTabs: items };
  }, [categoriesArray]);

  const filteredCategories = useMemo(() => {
    if (activeSection === "__ALL__") return categoriesArray || [];
    return (categoriesArray || []).filter(
      (c) => (c?.contestCategorySection?.trim() || "미지정") === activeSection
    );
  }, [categoriesArray, activeSection]);

  return (
    <div className="flex w-full flex-col gap-4 pt-2">
      <Tabs
        activeKey={activeSection}
        onChange={setActiveSection}
        items={sectionTabs.map((tab) => {
          const count =
            tab.key === "__ALL__"
              ? (categoriesArray || []).length
              : (categoriesArray || []).filter(
                  (c) =>
                    (c?.contestCategorySection?.trim() || "미지정") === tab.key
                ).length;

          return {
            ...tab,
            label: (
              <span className="inline-flex items-center gap-2 text-sm">
                {tab.label}
                <span className="font-mono text-xs tabular-nums text-[#737373] bg-[#f4f4f5] px-1.5 py-0.5 rounded-[4px]">
                  {count}
                </span>
              </span>
            ),
          };
        })}
      />

      {(filteredCategories || []).map((category, idx) => {
        const allSeats = Array.from(
          { length: Number(category.contestCategoryJudgeCount || 0) },
          (_, i) => i + 1
        );

        const unassignedSeats = allSeats.filter(
          (seatNumber) =>
            !(judgesAssignInfo.judges || []).some(
              (assign) =>
                assign.categoryId === category.contestCategoryId &&
                assign.seatIndex === seatNumber
            )
        );

        const assignedJudges = getAssignedJudgesForCategory(
          category.contestCategoryId
        );

        return (
          <div
            key={idx}
            className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            <div className="px-4 py-3 bg-[#f4f4f5] border-b border-[#171717]/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Users size={16} strokeWidth={1.5} className="text-[#525252]" />
                <span className="text-[15px] font-semibold text-[#171717]">
                  {category.contestCategoryTitle ||
                    category.contestCategoryName ||
                    category.contestCategoryInfo?.name ||
                    "이름 없는 카테고리"}
                </span>
                <span className="px-2 py-0.5 rounded-[4px] bg-[#ffffff] border border-[#171717]/[0.08] text-xs text-[#525252]">
                  {category.contestCategorySection?.trim() || "미지정"}
                </span>
                <span className="font-mono text-xs tabular-nums text-[#737373] bg-[#ffffff] border border-[#171717]/[0.08] px-2 py-0.5 rounded-[4px]">
                  {allSeats.length}석
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleRandomAssign(category, unassignedSeats)}
                  className="h-9 px-3 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors duration-150"
                >
                  <RotateCcw size={14} strokeWidth={1.5} />
                  <span>{isMobile ? "랜덤" : "빈 좌석 랜덤"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAllRandomAssign(category, allSeats)}
                  className="h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#eaeaea] border border-[#171717]/[0.12] text-xs font-medium text-[#171717] inline-flex items-center gap-1.5 transition-colors duration-150"
                >
                  <Shuffle
                    size={14}
                    strokeWidth={1.5}
                    className="text-[#525252]"
                  />
                  <span>{isMobile ? "전체" : "모두 재배정"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleResetAssign(category)}
                  className="h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/20 text-xs font-medium text-[#dc2626] inline-flex items-center gap-1.5 transition-colors duration-150"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                  <span>초기화</span>
                </button>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-2">
              {allSeats.map((seatNumber) => {
                const seatStatus = getSeatStatus(
                  category.contestCategoryId,
                  seatNumber
                );

                const selectedJudge = (judgesAssignInfo.judges || []).find(
                  (assign) =>
                    assign.categoryId === category.contestCategoryId &&
                    assign.seatIndex === seatNumber
                ) || { judgeUid: undefined };

                const selectedJudgeInfo = judgesPoolArray.find(
                  (j) => j.judgeUid === selectedJudge.judgeUid
                );

                const selectableSorted = sortJudgesByName(
                  judgesPoolArray.filter(
                    (judge) =>
                      !assignedJudges.includes(judge.judgeUid) ||
                      judge.judgeUid === selectedJudge.judgeUid
                  )
                );

                if (isMobile) {
                  return (
                    <div
                      key={seatNumber}
                      className="p-3 bg-[#fafafa] border border-[#171717]/[0.08] rounded-[8px] space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium tabular-nums text-[#171717]">
                          좌석 {seatNumber}
                        </span>
                        {seatStatus === "multi" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-medium bg-[#dc2626]/[0.08] text-[#dc2626]">
                            <AlertTriangle size={12} strokeWidth={1.5} />
                            <span>다중 심판</span>
                          </span>
                        )}
                      </div>

                      {selectedJudgeInfo && (
                        <div className="p-2.5 bg-[#ffffff] border border-[#171717]/[0.08] rounded-[8px] space-y-1">
                          <div className="flex items-center gap-2">
                            <User
                              size={14}
                              strokeWidth={1.5}
                              className="text-[#525252]"
                            />
                            <span className="text-sm font-medium text-[#171717]">
                              {selectedJudgeInfo.judgeName}
                            </span>
                            {selectedJudgeInfo.isHead && (
                              <span className="px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#b45309]/[0.08] text-[#b45309]">
                                위원장
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#525252] tabular-nums">
                            <Phone
                              size={12}
                              strokeWidth={1.5}
                              className="text-[#737373]"
                            />
                            <span>{selectedJudgeInfo.judgeTel}</span>
                          </div>
                          <div className="text-xs text-[#737373]">
                            {selectedJudgeInfo.judgePromoter}
                          </div>
                        </div>
                      )}

                      <Select
                        {...commonSelectProps}
                        className="w-full"
                        value={selectedJudge.judgeUid || "unselect"}
                        onChange={(val) => {
                          if (val === "unselect") {
                            handleRemoveAssign(category, seatNumber);
                          } else {
                            handleSelectJudge(category, seatNumber, val);
                          }
                        }}
                      >
                        <Select.Option value="unselect" data-search="">
                          선택 안함
                        </Select.Option>
                        {selectableSorted.map((judge) => {
                          const label = `${judge.isHead ? "위원장 / " : ""}${
                            judge.judgeName
                          } (${judge.judgePromoter} / ${judge.judgeTel})`;
                          const searchBlob = `${judge.judgeName} ${judge.judgePromoter} ${judge.judgeTel}`;
                          return (
                            <Select.Option
                              key={judge.judgeUid}
                              value={judge.judgeUid}
                              data-search={searchBlob}
                            >
                              {label}
                            </Select.Option>
                          );
                        })}
                      </Select>
                    </div>
                  );
                }

                return (
                  <div
                    key={seatNumber}
                    className="flex items-center gap-4 px-3.5 py-2 bg-[#fafafa] border border-[#171717]/[0.06] rounded-[8px] hover:bg-[#f4f4f5] transition-colors duration-150"
                  >
                    <div className="flex items-center gap-2 w-32 shrink-0">
                      <span className="font-mono text-sm font-medium tabular-nums text-[#525252]">
                        좌석 {seatNumber}
                      </span>
                      {seatStatus === "multi" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#dc2626]/[0.08] text-[#dc2626]">
                          <AlertTriangle size={12} strokeWidth={1.5} />
                          <span>다중</span>
                        </span>
                      )}
                    </div>

                    <div className="flex-1">
                      <Select
                        {...commonSelectProps}
                        className="w-full"
                        value={selectedJudge.judgeUid || "unselect"}
                        onChange={(val) => {
                          if (val === "unselect") {
                            handleRemoveAssign(category, seatNumber);
                          } else {
                            handleSelectJudge(category, seatNumber, val);
                          }
                        }}
                      >
                        <Select.Option value="unselect" data-search="">
                          선택 안함
                        </Select.Option>
                        {selectableSorted.map((judge) => {
                          const label = `${judge.isHead ? "위원장 / " : ""}${
                            judge.judgeName
                          } (${judge.judgePromoter} / ${judge.judgeTel})`;
                          const searchBlob = `${judge.judgeName} ${judge.judgePromoter} ${judge.judgeTel}`;
                          return (
                            <Select.Option
                              key={judge.judgeUid}
                              value={judge.judgeUid}
                              data-search={searchBlob}
                            >
                              {label}
                            </Select.Option>
                          );
                        })}
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CategoryAssign;
