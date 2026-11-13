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
  Check,
} from "lucide-react";
import {
  normalizeSectionName,
  sortJudgesByName,
  buildJudgeAssignRecord,
  pickFairRandomJudges,
  inspectScopeSeat,
} from "../utils/judgeAssignUtils";

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
  excludeHeadInRandom = true,
  balanceWorkload = true,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [activeSection, setActiveSection] = useState("__ALL__");

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const categoryById = useMemo(() => {
    const map = {};
    (categoriesArray || []).forEach((c) => {
      if (c?.contestCategoryId) map[c.contestCategoryId] = c;
    });
    return map;
  }, [categoriesArray]);

  const poolByUid = useMemo(() => {
    const map = {};
    (judgesPoolArray || []).forEach((j) => {
      if (j?.judgeUid) map[j.judgeUid] = j;
    });
    return map;
  }, [judgesPoolArray]);

  const createRecordsForCategorySeat = (
    category,
    categoryGrades,
    selectedJudge,
    seatNumber,
    contestId,
    onlyGradeIdsSet = null
  ) => {
    const maxSeats = Number(category?.contestCategoryJudgeCount || 0);
    if (seatNumber > maxSeats) return [];

    const records = [];
    (categoryGrades || []).forEach((grade) => {
      if (!grade?.contestGradeId) return;
      if (onlyGradeIdsSet && !onlyGradeIdsSet.has(grade.contestGradeId)) return;

      records.push(
        buildJudgeAssignRecord({
          category,
          grade,
          judge: selectedJudge,
          seatIndex: seatNumber,
          contestId,
          generateUUID,
        })
      );
    });
    return records;
  };

  /** 심판 선택 */
  const handleSelectJudge = (category, categoryGrades, seatIndex, judgeUid) => {
    const selectedJudge = poolByUid[judgeUid];
    const contestId = currentContest?.contests?.id;
    if (!selectedJudge || !contestId) return;

    if (!categoryGrades.length) {
      setMessage?.({
        body: `'${
          category?.contestCategoryTitle || "해당 종목"
        }'에 등록된 하위 체급이 없어 좌석을 배정할 수 없습니다. 먼저 체급을 등록해 주세요.`,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen?.(true);
      return;
    }

    const gradeIdsSet = new Set(
      categoryGrades.map((g) => g.contestGradeId).filter(Boolean)
    );

    setJudgesAssignInfo((prev) => {
      const cleaned = (prev?.judges || []).filter(
        (r) =>
          !(
            gradeIdsSet.has(r.contestGradeId) &&
            Number(r.seatIndex) === Number(seatIndex)
          )
      );
      const added = createRecordsForCategorySeat(
        category,
        categoryGrades,
        selectedJudge,
        seatIndex,
        contestId
      );
      return {
        ...(prev || {}),
        judges: [...cleaned, ...added],
      };
    });
  };

  /** 부분 누락 체급 동기화 */
  const handleFillPartialSeat = (
    category,
    categoryGrades,
    seatIndex,
    judgeUid
  ) => {
    const selectedJudge = poolByUid[judgeUid];
    const contestId = currentContest?.contests?.id;
    if (!selectedJudge || !contestId) return;

    setJudgesAssignInfo((prev) => {
      const prevJudges = prev?.judges || [];
      const assignedGradeIds = new Set(
        prevJudges
          .filter((r) => Number(r.seatIndex) === Number(seatIndex) && r.judgeUid)
          .map((r) => r.contestGradeId)
      );
      const conflictGradeIds = new Set(
        prevJudges
          .filter(
            (r) =>
              r.judgeUid === judgeUid &&
              Number(r.seatIndex) !== Number(seatIndex)
          )
          .map((r) => r.contestGradeId)
      );
      const targetIds = new Set(
        categoryGrades
          .map((g) => g.contestGradeId)
          .filter(
            (gid) =>
              gid && !assignedGradeIds.has(gid) && !conflictGradeIds.has(gid)
          )
      );
      const added = createRecordsForCategorySeat(
        category,
        categoryGrades,
        selectedJudge,
        seatIndex,
        contestId,
        targetIds
      );
      return {
        ...(prev || {}),
        judges: [...prevJudges, ...added],
      };
    });
  };

  /** 심판 제거 */
  const handleRemoveAssign = (categoryGrades, seatIndex) => {
    const gradeIdsSet = new Set(
      (categoryGrades || []).map((g) => g.contestGradeId).filter(Boolean)
    );
    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: (prev?.judges || []).filter(
        (r) =>
          !(
            gradeIdsSet.has(r.contestGradeId) &&
            Number(r.seatIndex) === Number(seatIndex)
          )
      ),
    }));
  };

  /** 빈·누락 좌석 공정 랜덤 배정 */
  const handleRandomAssign = (category, categoryGrades, allSeats) => {
    const contestId = currentContest?.contests?.id;
    if (!contestId || !categoryGrades.length) return;

    const gradeIdsSet = new Set(
      categoryGrades.map((g) => g.contestGradeId).filter(Boolean)
    );

    setJudgesAssignInfo((prev) => {
      let workingJudges = [...(prev?.judges || [])];

      // 1단계: 일부 체급만 배정된(partial) 좌석 동기화
      allSeats.forEach((seatNum) => {
        const info = inspectScopeSeat({
          judges: workingJudges,
          targetGrades: categoryGrades,
          categoryById,
          seatIndex: seatNum,
        });
        if (
          info.status === "partial" &&
          info.primaryJudgeUid &&
          poolByUid[info.primaryJudgeUid]
        ) {
          const judgeObj = poolByUid[info.primaryJudgeUid];
          const assignedAtSeat = new Set(
            workingJudges
              .filter(
                (r) => Number(r.seatIndex) === Number(seatNum) && r.judgeUid
              )
              .map((r) => r.contestGradeId)
          );
          const conflictGrades = new Set(
            workingJudges
              .filter(
                (r) =>
                  r.judgeUid === judgeObj.judgeUid &&
                  Number(r.seatIndex) !== Number(seatNum)
              )
              .map((r) => r.contestGradeId)
          );
          const targetIds = new Set(
            categoryGrades
              .map((g) => g.contestGradeId)
              .filter(
                (gid) =>
                  gid && !assignedAtSeat.has(gid) && !conflictGrades.has(gid)
              )
          );
          const filled = createRecordsForCategorySeat(
            category,
            categoryGrades,
            judgeObj,
            seatNum,
            contestId,
            targetIds
          );
          workingJudges = [...workingJudges, ...filled];
        }
      });

      // 2단계: 완전히 빈 좌석 공정 랜덤 배정
      const emptySeats = allSeats.filter((seatNum) => {
        const info = inspectScopeSeat({
          judges: workingJudges,
          targetGrades: categoryGrades,
          categoryById,
          seatIndex: seatNum,
        });
        return info.status === "empty";
      });

      if (emptySeats.length > 0) {
        const alreadyInCategory = workingJudges
          .filter((r) => gradeIdsSet.has(r.contestGradeId))
          .map((r) => r.judgeUid);

        const picked = pickFairRandomJudges({
          judgesPool: judgesPoolArray,
          excludedJudgeUids: alreadyInCategory,
          count: emptySeats.length,
          currentJudges: workingJudges,
          excludeHead: excludeHeadInRandom,
          balanceWorkload,
        });

        emptySeats.forEach((seatNum, idx) => {
          const judgeObj = picked[idx];
          if (!judgeObj) return;
          workingJudges.push(
            ...createRecordsForCategorySeat(
              category,
              categoryGrades,
              judgeObj,
              seatNum,
              contestId
            )
          );
        });
      }

      return {
        ...(prev || {}),
        judges: workingJudges,
      };
    });
  };

  /** 전체 랜덤 (해당 종목 모두 재배정) */
  const handleAllRandomAssign = (category, categoryGrades, allSeats) => {
    const contestId = currentContest?.contests?.id;
    if (!contestId || !categoryGrades.length) return;

    const gradeIdsSet = new Set(
      categoryGrades.map((g) => g.contestGradeId).filter(Boolean)
    );

    setJudgesAssignInfo((prev) => {
      const remaining = (prev?.judges || []).filter(
        (r) => !gradeIdsSet.has(r.contestGradeId)
      );
      const picked = pickFairRandomJudges({
        judgesPool: judgesPoolArray,
        excludedJudgeUids: [],
        count: allSeats.length,
        currentJudges: remaining,
        excludeHead: excludeHeadInRandom,
        balanceWorkload,
      });

      const added = [];
      allSeats.forEach((seatNum, idx) => {
        const judgeObj = picked[idx];
        if (!judgeObj) return;
        added.push(
          ...createRecordsForCategorySeat(
            category,
            categoryGrades,
            judgeObj,
            seatNum,
            contestId
          )
        );
      });

      return {
        ...(prev || {}),
        judges: [...remaining, ...added],
      };
    });
  };

  /** 종목 초기화 */
  const handleResetAssign = (categoryGrades) => {
    const gradeIdsSet = new Set(
      (categoryGrades || []).map((g) => g.contestGradeId).filter(Boolean)
    );
    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: (prev?.judges || []).filter(
        (r) => !gradeIdsSet.has(r.contestGradeId)
      ),
    }));
  };

  const commonSelectProps = {
    showSearch: true,
    allowClear: false,
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
      (categoriesArray || []).map((c) =>
        normalizeSectionName(c?.contestCategorySection)
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
      (c) => normalizeSectionName(c?.contestCategorySection) === activeSection
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
                    normalizeSectionName(c?.contestCategorySection) === tab.key
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

        const categoryGrades = (gradesArray || []).filter(
          (g) => g.refCategoryId === category.contestCategoryId
        );
        const categoryGradeIds = new Set(
          categoryGrades.map((g) => g.contestGradeId).filter(Boolean)
        );

        const assignedJudges = Array.from(
          new Set(
            (judgesAssignInfo.judges || [])
              .filter((r) => categoryGradeIds.has(r.contestGradeId))
              .map((r) => r.judgeUid)
              .filter(Boolean)
          )
        );

        return (
          <div
            key={category.contestCategoryId || idx}
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
                  {normalizeSectionName(category.contestCategorySection)}
                </span>
                <span className="font-mono text-xs tabular-nums text-[#737373] bg-[#ffffff] border border-[#171717]/[0.08] px-2 py-0.5 rounded-[4px]">
                  {allSeats.length}석 · {categoryGrades.length}체급
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={categoryGrades.length === 0}
                  onClick={() =>
                    handleRandomAssign(category, categoryGrades, allSeats)
                  }
                  className="h-9 px-3 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors duration-150"
                >
                  <RotateCcw size={14} strokeWidth={1.5} />
                  <span>{isMobile ? "랜덤" : "빈·누락 좌석 채우기"}</span>
                </button>
                <button
                  type="button"
                  disabled={categoryGrades.length === 0}
                  onClick={() =>
                    handleAllRandomAssign(category, categoryGrades, allSeats)
                  }
                  className="h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#eaeaea] disabled:opacity-50 border border-[#171717]/[0.12] text-xs font-medium text-[#171717] inline-flex items-center gap-1.5 transition-colors duration-150"
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
                  onClick={() => handleResetAssign(categoryGrades)}
                  className="h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/20 text-xs font-medium text-[#dc2626] inline-flex items-center gap-1.5 transition-colors duration-150"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                  <span>초기화</span>
                </button>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-2">
              {categoryGrades.length === 0 ? (
                <div className="py-4 text-center text-xs text-[#737373] bg-[#fafafa] rounded-[8px] border border-[#171717]/[0.06]">
                  이 종목에 등록된 하위 체급이 없습니다.
                </div>
              ) : (
                allSeats.map((seatNumber) => {
                  const seatState = inspectScopeSeat({
                    judges: judgesAssignInfo.judges || [],
                    targetGrades: categoryGrades,
                    categoryById,
                    seatIndex: seatNumber,
                  });

                  const selectValue =
                    seatState.status === "multi"
                      ? "__MULTI__"
                      : seatState.primaryJudgeUid || "unselect";

                  const selectedJudgeInfo = seatState.primaryJudgeUid
                    ? poolByUid[seatState.primaryJudgeUid]
                    : null;
                  const isRemovedFromPool =
                    Boolean(seatState.primaryJudgeUid) &&
                    seatState.status !== "multi" &&
                    !selectedJudgeInfo;

                  const selectableSorted = sortJudgesByName(
                    judgesPoolArray.filter(
                      (judge) =>
                        !assignedJudges.includes(judge.judgeUid) ||
                        judge.judgeUid === seatState.primaryJudgeUid
                    )
                  );

                  const breakdownText =
                    seatState.status === "multi"
                      ? seatState.judgeBreakdown
                          .map(
                            (b) =>
                              `${
                                poolByUid[b.judgeUid]?.judgeName ||
                                b.judgeName ||
                                "미상"
                              }(${b.count})`
                          )
                          .join(", ") +
                        (seatState.missingCount > 0
                          ? ` · 미배정(${seatState.missingCount})`
                          : "")
                      : "";

                  const statusBadges = (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {seatState.status === "multi" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#2563eb]/[0.08] text-[#2563eb]">
                          <AlertTriangle size={12} strokeWidth={1.5} />
                          <span>체급별 상이</span>
                        </span>
                      )}
                      {seatState.status === "partial" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#b45309]/[0.10] text-[#b45309] tabular-nums">
                          <AlertTriangle size={12} strokeWidth={1.5} />
                          <span>누락 {seatState.missingCount}체급</span>
                        </span>
                      )}
                      {isRemovedFromPool && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#dc2626]/[0.10] text-[#dc2626]">
                          선발 해제됨
                        </span>
                      )}
                    </div>
                  );

                  const selectElement = (
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center gap-2">
                        <Select
                          {...commonSelectProps}
                          className="flex-1"
                          value={selectValue}
                          onChange={(val) => {
                            if (val === "__MULTI__") return;
                            if (val === "unselect") {
                              handleRemoveAssign(categoryGrades, seatNumber);
                            } else {
                              handleSelectJudge(
                                category,
                                categoryGrades,
                                seatNumber,
                                val
                              );
                            }
                          }}
                        >
                          <Select.Option value="unselect" data-search="">
                            선택 안함
                          </Select.Option>

                          {seatState.status === "multi" && (
                            <Select.Option value="__MULTI__" data-search="">
                              체급별 개별 배정됨 ({breakdownText})
                            </Select.Option>
                          )}

                          {isRemovedFromPool && (
                            <Select.Option
                              value={seatState.primaryJudgeUid}
                              data-search=""
                            >
                              [선발 해제됨]{" "}
                              {seatState.judgeBreakdown[0]?.judgeName ||
                                seatState.primaryJudgeUid}
                            </Select.Option>
                          )}

                          {selectableSorted.map((judge) => {
                            const label = `${judge.isHead ? "위원장 / " : ""}${
                              judge.judgeName
                            } (${judge.judgePromoter || "-"} / ${
                              judge.judgeTel || "-"
                            })`;
                            const searchBlob = `${judge.judgeName || ""} ${
                              judge.judgePromoter || ""
                            } ${judge.judgeTel || ""}`;
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

                        {seatState.status === "partial" &&
                          seatState.primaryJudgeUid &&
                          !isRemovedFromPool && (
                            <button
                              type="button"
                              onClick={() =>
                                handleFillPartialSeat(
                                  category,
                                  categoryGrades,
                                  seatNumber,
                                  seatState.primaryJudgeUid
                                )
                              }
                              className="h-8 px-2.5 rounded-[6px] bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-medium inline-flex items-center gap-1 shrink-0 transition-colors"
                            >
                              <Check size={13} strokeWidth={1.75} />
                              <span>누락 채우기</span>
                            </button>
                          )}
                      </div>

                      {seatState.status === "multi" && (
                        <span className="text-[11px] text-[#737373] pl-1">
                          현재 체급별 배정: {breakdownText} (새 심판 선택 시 종목
                          일괄 변경)
                        </span>
                      )}
                    </div>
                  );

                  if (isMobile) {
                    return (
                      <div
                        key={seatNumber}
                        className={`p-3 border rounded-[8px] space-y-2.5 ${
                          seatState.status === "partial" || isRemovedFromPool
                            ? "bg-[#b45309]/[0.03] border-[#b45309]/25"
                            : "bg-[#fafafa] border-[#171717]/[0.08]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-medium tabular-nums text-[#171717]">
                            좌석 {seatNumber}
                          </span>
                          {statusBadges}
                        </div>

                        {selectedJudgeInfo && seatState.status !== "multi" && (
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

                        {selectElement}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={seatNumber}
                      className={`flex items-center gap-4 px-3.5 py-2 border rounded-[8px] transition-colors duration-150 ${
                        seatState.status === "partial" || isRemovedFromPool
                          ? "bg-[#b45309]/[0.03] border-[#b45309]/25"
                          : "bg-[#fafafa] border-[#171717]/[0.06] hover:bg-[#f4f4f5]"
                      }`}
                    >
                      <div className="flex items-center gap-2 w-44 shrink-0">
                        <span className="font-mono text-sm font-medium tabular-nums text-[#525252]">
                          좌석 {seatNumber}
                        </span>
                        {statusBadges}
                      </div>

                      <div className="flex-1">{selectElement}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CategoryAssign;
