"use client";

import React, { useMemo, useState } from "react";
import {
  Users,
  RotateCcw,
  Shuffle,
  Trash2,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  normalizeSectionName,
  sortJudgesByName,
  buildJudgeAssignRecord,
  pickFairRandomJudges,
  inspectScopeSeat,
} from "../utils/judgeAssignUtils";
import {
  JudgeSeatSlotCard,
  SectionFilterBar,
} from "./judges/JudgeSeatSlotCard";

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
  workloadByUid = {},
}) => {
  const [activeSection, setActiveSection] = useState("__ALL__");
  const [categoryKeyword, setCategoryKeyword] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

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
        variant: "warning",
        title: "하위 체급 등록 필요",
        body: `'${
          category?.contestCategoryTitle || "해당 종목"
        }'에 등록된 하위 체급이 없어 좌석을 배정할 수 없습니다.`,
        body2: "종목/체급 설정 탭에서 먼저 세부 체급을 등록해 주세요.",
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

  // 종목별 배정 충족도 사전 계산
  const categoryStatsById = useMemo(() => {
    const stats = {};
    (categoriesArray || []).forEach((c) => {
      const cid = c?.contestCategoryId;
      if (!cid) return;
      const seatCnt = Number(c?.contestCategoryJudgeCount || 0);
      const catGrades = (gradesArray || []).filter(
        (g) => g.refCategoryId === cid
      );
      const gIds = new Set(catGrades.map((g) => g.contestGradeId).filter(Boolean));
      const expected = seatCnt * catGrades.length;
      const assigned = (judgesAssignInfo?.judges || []).filter(
        (r) => gIds.has(r.contestGradeId) && Boolean(r.judgeUid)
      ).length;
      stats[cid] = {
        expected,
        assigned,
        hasGap: expected > 0 && assigned < expected,
      };
    });
    return stats;
  }, [categoriesArray, gradesArray, judgesAssignInfo?.judges]);

  const sectionItems = useMemo(() => {
    const namesSet = new Set(
      (categoriesArray || []).map((c) =>
        normalizeSectionName(c?.contestCategorySection)
      )
    );
    const names = Array.from(namesSet).sort((a, b) =>
      a.localeCompare(b, "ko", { sensitivity: "base", numeric: true })
    );

    const anyGapAll = (categoriesArray || []).some(
      (c) => categoryStatsById[c?.contestCategoryId]?.hasGap
    );

    return [
      {
        key: "__ALL__",
        label: "전체 부",
        count: (categoriesArray || []).length,
        hasGap: anyGapAll,
      },
      ...names.map((name) => {
        const inSec = (categoriesArray || []).filter(
          (c) => normalizeSectionName(c?.contestCategorySection) === name
        );
        const hasGap = inSec.some(
          (c) => categoryStatsById[c?.contestCategoryId]?.hasGap
        );
        return {
          key: name,
          label: name,
          count: inSec.length,
          hasGap,
        };
      }),
    ];
  }, [categoriesArray, categoryStatsById]);

  const filteredCategories = useMemo(() => {
    const kw = categoryKeyword.trim().toLowerCase();
    return (categoriesArray || []).filter((c) => {
      if (
        activeSection !== "__ALL__" &&
        normalizeSectionName(c?.contestCategorySection) !== activeSection
      ) {
        return false;
      }
      if (onlyMissing && !categoryStatsById[c?.contestCategoryId]?.hasGap) {
        return false;
      }
      if (kw) {
        const title = (
          c?.contestCategoryTitle ||
          c?.contestCategoryName ||
          c?.contestCategoryInfo?.name ||
          ""
        ).toLowerCase();
        return title.includes(kw);
      }
      return true;
    });
  }, [categoriesArray, activeSection, onlyMissing, categoryKeyword, categoryStatsById]);

  return (
    <div className="flex w-full flex-col gap-4">
      {/* 섹션 필터 + 종목 검색 바 */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <SectionFilterBar
          items={sectionItems}
          activeKey={activeSection}
          onChange={setActiveSection}
        />

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setOnlyMissing((v) => !v)}
            className={`h-8 px-3 rounded-[8px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer border shrink-0 ${
              onlyMissing
                ? "bg-[#dc2626]/[0.08] text-[#dc2626] border-[#dc2626]/25"
                : "bg-white text-[#525252] border-[#171717]/[0.10] hover:bg-[#f4f4f5]"
            }`}
          >
            <AlertTriangle size={13} strokeWidth={1.6} />
            <span>미배정 종목만</span>
          </button>

          <div className="relative flex-1 sm:w-56 flex items-center">
            <Search
              size={14}
              strokeWidth={1.5}
              className="absolute left-3 text-[#737373] pointer-events-none"
            />
            <input
              type="text"
              value={categoryKeyword}
              onChange={(e) => setCategoryKeyword(e.target.value)}
              placeholder="종목명 검색"
              className="h-8 w-full rounded-[8px] border border-[#171717]/[0.12] bg-[#fafafa] focus:bg-white pl-8 pr-7 text-xs text-[#171717] placeholder:text-[#737373] outline-none focus:border-[#2563eb] transition-colors duration-150"
            />
            {categoryKeyword && (
              <button
                type="button"
                onClick={() => setCategoryKeyword("")}
                className="absolute right-2 w-4 h-4 rounded-[4px] inline-flex items-center justify-center text-[#737373] hover:text-[#171717] bg-transparent border-0 cursor-pointer"
              >
                <X size={12} strokeWidth={1.6} />
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] py-12 text-center text-sm text-[#737373]">
          해당 조건의 종목이 없습니다
        </div>
      ) : (
        filteredCategories.map((category, idx) => {
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

          const cStat = categoryStatsById[category.contestCategoryId] || {
            expected: 0,
            assigned: 0,
            hasGap: false,
          };
          const isComplete = cStat.expected > 0 && !cStat.hasGap;

          return (
            <div
              key={category.contestCategoryId || idx}
              className="bg-white rounded-[12px] border border-[#171717]/[0.08] overflow-hidden"
            >
              <div className="px-5 py-3.5 bg-[#fafafa] border-b border-[#171717]/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-7 h-7 rounded-[6px] bg-white border border-[#171717]/[0.08] flex items-center justify-center shrink-0">
                    <Users
                      size={14}
                      strokeWidth={1.6}
                      className="text-[#525252]"
                    />
                  </div>
                  <span className="text-base font-semibold text-[#171717]">
                    {category.contestCategoryTitle ||
                      category.contestCategoryName ||
                      category.contestCategoryInfo?.name ||
                      "이름 없는 종목"}
                  </span>
                  <span className="px-2 py-0.5 rounded-[5px] bg-white border border-[#171717]/[0.08] text-xs text-[#525252]">
                    {normalizeSectionName(category.contestCategorySection)}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[#737373] bg-white border border-[#171717]/[0.08] px-2 py-0.5 rounded-[5px]">
                    {allSeats.length}심제 · {categoryGrades.length}체급
                  </span>
                  {cStat.expected > 0 && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] font-mono text-xs tabular-nums border ${
                        isComplete
                          ? "bg-[#16a34a]/[0.08] text-[#16a34a] border-[#16a34a]/20 font-medium"
                          : "bg-[#dc2626]/[0.06] text-[#dc2626] border-[#dc2626]/20 font-medium"
                      }`}
                    >
                      {isComplete && (
                        <CheckCircle2 size={12} strokeWidth={1.8} />
                      )}
                      <span>
                        {cStat.assigned}/{cStat.expected}석
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={categoryGrades.length === 0}
                    onClick={() =>
                      handleRandomAssign(category, categoryGrades, allSeats)
                    }
                    className="h-8 px-3 rounded-[7px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer border-0"
                  >
                    <RotateCcw size={13} strokeWidth={1.6} />
                    <span>빈·누락 좌석 채우기</span>
                  </button>
                  <button
                    type="button"
                    disabled={categoryGrades.length === 0}
                    onClick={() =>
                      handleAllRandomAssign(category, categoryGrades, allSeats)
                    }
                    className="h-8 px-3 rounded-[7px] bg-white hover:bg-[#f4f4f5] disabled:opacity-50 border border-[#171717]/[0.12] text-xs font-medium text-[#171717] inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
                  >
                    <Shuffle
                      size={13}
                      strokeWidth={1.6}
                      className="text-[#525252]"
                    />
                    <span>모두 재배정</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetAssign(categoryGrades)}
                    className="h-8 px-2.5 rounded-[7px] bg-white hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/20 text-xs font-medium text-[#dc2626] inline-flex items-center gap-1 transition-colors duration-150 cursor-pointer"
                  >
                    <Trash2 size={13} strokeWidth={1.6} />
                    <span>초기화</span>
                  </button>
                </div>
              </div>

              {categoryGrades.length === 0 ? (
                <div className="p-5 text-center text-xs text-[#737373]">
                  이 종목에 등록된 하위 체급이 없습니다
                </div>
              ) : (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {allSeats.map((seatNumber) => {
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

                    return (
                      <JudgeSeatSlotCard
                        key={seatNumber}
                        seatNumber={seatNumber}
                        status={seatState.status}
                        selectValue={selectValue}
                        selectedJudgeInfo={selectedJudgeInfo}
                        fallbackJudgeName={
                          seatState.judgeBreakdown[0]?.judgeName ||
                          seatState.primaryJudgeUid
                        }
                        isRemovedFromPool={isRemovedFromPool}
                        missingCount={seatState.missingCount}
                        multiLabel="체급별 상이"
                        breakdownText={breakdownText}
                        selectableJudges={selectableSorted}
                        workloadByUid={workloadByUid}
                        onSelectChange={(val) => {
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
                        onClearSeat={() =>
                          handleRemoveAssign(categoryGrades, seatNumber)
                        }
                        onFillPartial={
                          seatState.status === "partial" &&
                          seatState.primaryJudgeUid
                            ? () =>
                                handleFillPartialSeat(
                                  category,
                                  categoryGrades,
                                  seatNumber,
                                  seatState.primaryJudgeUid
                                )
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default CategoryAssign;
