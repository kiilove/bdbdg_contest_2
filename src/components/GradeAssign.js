"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Select } from "antd";
import {
  Users,
  RotateCcw,
  Shuffle,
  Trash2,
  GitBranch,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  normalizeSectionName,
  sortJudgesByName,
  buildJudgeAssignRecord,
  pickFairRandomJudges,
} from "../utils/judgeAssignUtils";
import {
  JudgeSeatSlotCard,
  SectionFilterBar,
} from "./judges/JudgeSeatSlotCard";

const GradeAssign = ({
  judgesAssignInfo,
  judgesPoolArray,
  setJudgesAssignInfo,
  categoriesArray,
  gradesArray,
  currentContest,
  generateUUID,
  excludeHeadInRandom = true,
  balanceWorkload = true,
  focusCategoryId = null,
  onClearFocusCategory,
  workloadByUid = {},
}) => {
  const [activeSection, setActiveSection] = useState("__ALL__");
  const [selectedCategoryId, setSelectedCategoryId] = useState("__ALL_CAT__");
  const [onlyMissingGrades, setOnlyMissingGrades] = useState(false);

  /** 상단 누락 검증 패널에서 특정 종목 클릭 시 즉시 포커스 */
  useEffect(() => {
    if (focusCategoryId) {
      setActiveSection("__ALL__");
      setSelectedCategoryId(focusCategoryId);
      setOnlyMissingGrades(false);
      onClearFocusCategory?.();
    }
  }, [focusCategoryId, onClearFocusCategory]);

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

  const getAssignedJudgesForGrade = (contestGradeId, list) =>
    (list || [])
      .filter((assign) => assign.contestGradeId === contestGradeId)
      .map((assign) => assign.judgeUid)
      .filter(Boolean);

  /** 심판 선택 */
  const handleSelectJudge = (grade, seatIndex, judgeUid) => {
    const selectedJudge = poolByUid[judgeUid];
    const contestId = currentContest?.contests?.id;
    const cat = categoryById[grade?.refCategoryId];
    if (!selectedJudge || !contestId || !cat) return;

    setJudgesAssignInfo((prev) => {
      const cleaned = (prev?.judges || []).filter(
        (assign) =>
          !(
            assign.contestGradeId === grade.contestGradeId &&
            Number(assign.seatIndex) === Number(seatIndex)
          )
      );
      const record = buildJudgeAssignRecord({
        category: cat,
        grade,
        judge: selectedJudge,
        seatIndex,
        contestId,
        generateUUID,
      });
      return {
        ...(prev || {}),
        judges: [...cleaned, record],
      };
    });
  };

  /** 심판 제거 */
  const handleRemoveAssign = (grade, seatIndex) => {
    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: (prev?.judges || []).filter(
        (assign) =>
          !(
            assign.contestGradeId === grade.contestGradeId &&
            Number(assign.seatIndex) === Number(seatIndex)
          )
      ),
    }));
  };

  /** 랜덤 배정 (빈 좌석만, 공정 균등 추출) */
  const handleRandomAssign = (grade, allSeats) => {
    const contestId = currentContest?.contests?.id;
    const cat = categoryById[grade?.refCategoryId];
    if (!contestId || !cat) return;

    setJudgesAssignInfo((prev) => {
      const prevJudges = prev?.judges || [];
      const occupiedSeats = new Set(
        prevJudges
          .filter(
            (a) => a.contestGradeId === grade.contestGradeId && a.judgeUid
          )
          .map((a) => Number(a.seatIndex))
      );
      const emptySeats = allSeats.filter((s) => !occupiedSeats.has(s));
      if (emptySeats.length === 0) return prev;

      const assignedUids = getAssignedJudgesForGrade(
        grade.contestGradeId,
        prevJudges
      );

      const picked = pickFairRandomJudges({
        judgesPool: judgesPoolArray,
        excludedJudgeUids: assignedUids,
        count: emptySeats.length,
        currentJudges: prevJudges,
        excludeHead: excludeHeadInRandom,
        balanceWorkload,
      });

      const added = [];
      emptySeats.forEach((seatNum, idx) => {
        const judgeObj = picked[idx];
        if (!judgeObj) return;
        added.push(
          buildJudgeAssignRecord({
            category: cat,
            grade,
            judge: judgeObj,
            seatIndex: seatNum,
            contestId,
            generateUUID,
          })
        );
      });

      return {
        ...(prev || {}),
        judges: [...prevJudges, ...added],
      };
    });
  };

  /** 전체 랜덤 (해당 체급 모두 재배정) */
  const handleAllRandomAssign = (grade, allSeats) => {
    const contestId = currentContest?.contests?.id;
    const cat = categoryById[grade?.refCategoryId];
    if (!contestId || !cat) return;

    setJudgesAssignInfo((prev) => {
      const remaining = (prev?.judges || []).filter(
        (assign) => assign.contestGradeId !== grade.contestGradeId
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
          buildJudgeAssignRecord({
            category: cat,
            grade,
            judge: judgeObj,
            seatIndex: seatNum,
            contestId,
            generateUUID,
          })
        );
      });

      return {
        ...(prev || {}),
        judges: [...remaining, ...added],
      };
    });
  };

  /** 초기화 (해당 체급 전부 제거) */
  const handleResetAssign = (grade) => {
    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: (prev?.judges || []).filter(
        (assign) => assign.contestGradeId !== grade.contestGradeId
      ),
    }));
  };

  // 체급별 배정 완료 여부 사전 계산
  const gradeStatsById = useMemo(() => {
    const stats = {};
    (gradesArray || []).forEach((g) => {
      const gid = g?.contestGradeId;
      if (!gid) return;
      const cat = categoryById[g?.refCategoryId];
      const expected = Number(cat?.contestCategoryJudgeCount || 0);
      const assigned = (judgesAssignInfo?.judges || []).filter(
        (a) =>
          a.contestGradeId === gid &&
          Number(a.seatIndex) >= 1 &&
          Number(a.seatIndex) <= expected &&
          Boolean(a.judgeUid)
      ).length;
      stats[gid] = {
        expected,
        assigned,
        hasGap: expected > 0 && assigned < expected,
      };
    });
    return stats;
  }, [gradesArray, categoryById, judgesAssignInfo?.judges]);

  const sectionItems = useMemo(() => {
    const namesSet = new Set(
      (categoriesArray || []).map((c) =>
        normalizeSectionName(c?.contestCategorySection)
      )
    );
    const names = Array.from(namesSet).sort((a, b) =>
      a.localeCompare(b, "ko", { sensitivity: "base", numeric: true })
    );

    const anyGapAll = (gradesArray || []).some(
      (g) => gradeStatsById[g?.contestGradeId]?.hasGap
    );

    return [
      {
        key: "__ALL__",
        label: "전체 부",
        count: (gradesArray || []).length,
        hasGap: anyGapAll,
      },
      ...names.map((name) => {
        const inSec = (gradesArray || []).filter((g) => {
          const cat = categoryById[g?.refCategoryId];
          return normalizeSectionName(cat?.contestCategorySection) === name;
        });
        const hasGap = inSec.some(
          (g) => gradeStatsById[g?.contestGradeId]?.hasGap
        );
        return {
          key: name,
          label: name,
          count: inSec.length,
          hasGap,
        };
      }),
    ];
  }, [categoriesArray, gradesArray, categoryById, gradeStatsById]);

  const categoriesInActiveSection = useMemo(() => {
    const list = (categoriesArray || []).filter((c) => {
      const sec = normalizeSectionName(c?.contestCategorySection);
      return activeSection === "__ALL__" ? true : sec === activeSection;
    });
    return [...list].sort(
      (a, b) =>
        Number(a?.contestCategoryIndex ?? 9999) -
        Number(b?.contestCategoryIndex ?? 9999)
    );
  }, [categoriesArray, activeSection]);

  const filteredGrades = useMemo(() => {
    let list = gradesArray || [];
    if (activeSection !== "__ALL__") {
      list = list.filter((g) => {
        const cat = categoryById[g?.refCategoryId];
        const sec = normalizeSectionName(cat?.contestCategorySection);
        return sec === activeSection;
      });
    }
    if (selectedCategoryId !== "__ALL_CAT__") {
      list = list.filter((g) => g?.refCategoryId === selectedCategoryId);
    }
    if (onlyMissingGrades) {
      list = list.filter((g) => gradeStatsById[g?.contestGradeId]?.hasGap);
    }
    return [...list].sort((a, b) => {
      const ca = Number(
        categoryById[a.refCategoryId]?.contestCategoryIndex ?? 9999
      );
      const cb = Number(
        categoryById[b.refCategoryId]?.contestCategoryIndex ?? 9999
      );
      if (ca !== cb) return ca - cb;
      return (
        Number(a?.contestGradeIndex ?? 9999) -
        Number(b?.contestGradeIndex ?? 9999)
      );
    });
  }, [
    gradesArray,
    activeSection,
    selectedCategoryId,
    onlyMissingGrades,
    categoryById,
    gradeStatsById,
  ]);

  const handleSectionChange = (nextSec) => {
    setActiveSection(nextSec);
    setSelectedCategoryId("__ALL_CAT__");
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {/* 섹션 + 종목 드롭다운 + 미배정 필터 통합 바 */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <SectionFilterBar
          items={sectionItems}
          activeKey={activeSection}
          onChange={handleSectionChange}
        />

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setOnlyMissingGrades((v) => !v)}
            className={`h-8 px-3 rounded-[8px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer border shrink-0 ${
              onlyMissingGrades
                ? "bg-[#dc2626]/[0.08] text-[#dc2626] border-[#dc2626]/25"
                : "bg-white text-[#525252] border-[#171717]/[0.10] hover:bg-[#f4f4f5]"
            }`}
          >
            <AlertTriangle size={13} strokeWidth={1.6} />
            <span>미배정 체급만</span>
          </button>

          <div className="flex items-center gap-2 flex-1 sm:w-72">
            <GitBranch
              size={14}
              strokeWidth={1.5}
              className="text-[#737373] shrink-0"
            />
            <Select
              className="w-full"
              value={selectedCategoryId}
              onChange={setSelectedCategoryId}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children || "")
                  .toString()
                  .toLowerCase()
                  .includes((input || "").toLowerCase())
              }
            >
              <Select.Option value="__ALL_CAT__">전체 종목 보기</Select.Option>
              {categoriesInActiveSection.map((c) => (
                <Select.Option
                  key={c.contestCategoryId}
                  value={c.contestCategoryId}
                >
                  {c.contestCategoryTitle ||
                    c.contestCategoryName ||
                    c.contestCategoryInfo?.name ||
                    "이름 없는 종목"}
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {filteredGrades.length === 0 ? (
        <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] py-12 text-center text-sm text-[#737373]">
          해당 조건의 체급이 없습니다
        </div>
      ) : (
        filteredGrades.map((grade, idx) => {
          const cat = categoryById[grade.refCategoryId] || {};
          const judgeCount = Number(cat.contestCategoryJudgeCount || 0);
          const allSeats = Array.from({ length: judgeCount }, (_, i) => i + 1);
          const assignedJudges = getAssignedJudgesForGrade(
            grade.contestGradeId,
            judgesAssignInfo.judges
          );
          const gStat = gradeStatsById[grade.contestGradeId] || {
            expected: judgeCount,
            assigned: 0,
            hasGap: false,
          };
          const isComplete = gStat.expected > 0 && !gStat.hasGap;

          return (
            <div
              key={grade.contestGradeId || idx}
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
                    {(cat.contestCategoryTitle ||
                      cat.contestCategoryName ||
                      cat.contestCategoryInfo?.name ||
                      "이름 없는 종목") +
                      " · " +
                      (grade.contestGradeTitle || "(이름 없는 체급)")}
                  </span>
                  <span className="px-2 py-0.5 rounded-[5px] bg-white border border-[#171717]/[0.08] text-xs text-[#525252]">
                    {normalizeSectionName(cat.contestCategorySection)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums px-2 py-0.5 rounded-[5px] border ${
                      isComplete
                        ? "bg-[#16a34a]/[0.08] border-[#16a34a]/20 text-[#16a34a] font-medium"
                        : "bg-[#dc2626]/[0.06] border-[#dc2626]/20 text-[#dc2626] font-medium"
                    }`}
                  >
                    {isComplete && <CheckCircle2 size={12} strokeWidth={1.8} />}
                    <span>
                      {gStat.assigned}/{allSeats.length}석
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleRandomAssign(grade, allSeats)}
                    className="h-8 px-3 rounded-[7px] bg-[#2563eb] hover:bg-[#1d4ed8] text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer border-0"
                  >
                    <RotateCcw size={13} strokeWidth={1.6} />
                    <span>빈 좌석 랜덤</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAllRandomAssign(grade, allSeats)}
                    className="h-8 px-3 rounded-[7px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-xs font-medium text-[#171717] inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
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
                    onClick={() => handleResetAssign(grade)}
                    className="h-8 px-2.5 rounded-[7px] bg-white hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/20 text-xs font-medium text-[#dc2626] inline-flex items-center gap-1 transition-colors duration-150 cursor-pointer"
                  >
                    <Trash2 size={13} strokeWidth={1.6} />
                    <span>초기화</span>
                  </button>
                </div>
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {allSeats.map((seatNumber) => {
                  const selectedJudge = (judgesAssignInfo.judges || []).find(
                    (assign) =>
                      assign.contestGradeId === grade.contestGradeId &&
                      Number(assign.seatIndex) === seatNumber
                  ) || { judgeUid: undefined };

                  const selectedJudgeInfo = selectedJudge.judgeUid
                    ? poolByUid[selectedJudge.judgeUid]
                    : null;
                  const isRemovedFromPool =
                    Boolean(selectedJudge.judgeUid) && !selectedJudgeInfo;

                  const selectableSorted = sortJudgesByName(
                    judgesPoolArray.filter(
                      (judge) =>
                        !assignedJudges.includes(judge.judgeUid) ||
                        judge.judgeUid === selectedJudge.judgeUid
                    )
                  );

                  return (
                    <JudgeSeatSlotCard
                      key={seatNumber}
                      seatNumber={seatNumber}
                      status={selectedJudge.judgeUid ? "complete" : "empty"}
                      selectValue={selectedJudge.judgeUid || "unselect"}
                      selectedJudgeInfo={selectedJudgeInfo}
                      fallbackJudgeName={
                        selectedJudge.judgeName || selectedJudge.judgeUid
                      }
                      isRemovedFromPool={isRemovedFromPool}
                      selectableJudges={selectableSorted}
                      workloadByUid={workloadByUid}
                      onSelectChange={(val) => {
                        if (val === "unselect") {
                          handleRemoveAssign(grade, seatNumber);
                        } else {
                          handleSelectJudge(grade, seatNumber, val);
                        }
                      }}
                      onClearSeat={() => handleRemoveAssign(grade, seatNumber)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default GradeAssign;
