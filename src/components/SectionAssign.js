"use client";

import React, { useMemo } from "react";
import {
  Users,
  RotateCcw,
  Shuffle,
  Trash2,
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
import { JudgeSeatSlotCard } from "./judges/JudgeSeatSlotCard";

const SectionAssign = ({
  judgesAssignInfo,
  rawJudges = [],
  judgesPoolArray,
  categoriesArray = [],
  filteredBySection,
  setJudgesAssignInfo,
  currentContest,
  generateUUID,
  setMessage,
  setMsgOpen,
  excludeHeadInRandom = true,
  balanceWorkload = true,
  workloadByUid = {},
}) => {
  const categoryById = useMemo(() => {
    const map = {};
    (categoriesArray || []).forEach((c) => {
      if (c?.contestCategoryId) map[c.contestCategoryId] = c;
    });
    (filteredBySection || []).forEach((sec) => {
      (sec.sectionCategory || []).forEach((c) => {
        if (c?.contestCategoryId) map[c.contestCategoryId] = c;
      });
    });
    return map;
  }, [categoriesArray, filteredBySection]);

  const poolByUid = useMemo(() => {
    const map = {};
    (judgesPoolArray || []).forEach((j) => {
      if (j?.judgeUid) map[j.judgeUid] = j;
    });
    return map;
  }, [judgesPoolArray]);

  /** 섹션 내 체급들에 대해 특정 좌석 배정 레코드 배열 생성 (해당 종목 심판 수 범위 내만) */
  const createRecordsForSectionSeat = (
    sectionGrades,
    selectedJudge,
    seatNumber,
    contestId,
    onlyGradeIdsSet = null
  ) => {
    const records = [];
    (sectionGrades || []).forEach((grade) => {
      if (!grade?.contestGradeId) return;
      if (onlyGradeIdsSet && !onlyGradeIdsSet.has(grade.contestGradeId)) return;

      const cat = categoryById[grade.refCategoryId];
      if (!cat) return;

      const maxSeats = Number(cat.contestCategoryJudgeCount || 0);
      if (seatNumber > maxSeats) return;

      records.push(
        buildJudgeAssignRecord({
          category: cat,
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

  /** 좌석에서 심판 수동 선택 (섹션 하위 전체 체급 일괄 반영) */
  const handleSelectJudge = (section, seatIndex, judgeUid) => {
    const selectedJudge = poolByUid[judgeUid];
    const contestId = currentContest?.contests?.id;
    if (!selectedJudge || !contestId) return;

    const sectionGradeIds = new Set(
      (section.sectionGrades || []).map((g) => g.contestGradeId).filter(Boolean)
    );

    const seatCheck = inspectScopeSeat({
      judges: judgesAssignInfo?.judges || [],
      targetGrades: section.sectionGrades,
      categoryById,
      seatIndex,
    });

    if (seatCheck.status === "multi") {
      setMessage?.({
        variant: "info",
        title: "부별 좌석 일괄 통일",
        body: `'${section.sectionName}' ${seatIndex}번 좌석의 하위 체급 배정이 '${selectedJudge.judgeName}' 심판으로 통일되었습니다.`,
        body2: "상단 저장 버튼을 눌러야 데이터베이스에 최종 반영됩니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen?.(true);
    }

    setJudgesAssignInfo((prev) => {
      const prevJudges = prev?.judges || [];
      const cleaned = prevJudges.filter(
        (r) =>
          !(
            sectionGradeIds.has(r.contestGradeId) &&
            Number(r.seatIndex) === Number(seatIndex)
          )
      );
      const added = createRecordsForSectionSeat(
        section.sectionGrades,
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

  /** 부분 누락된 체급만 기존 대표 심판으로 채우기 */
  const handleFillPartialSeat = (section, seatIndex, judgeUid) => {
    const selectedJudge = poolByUid[judgeUid];
    const contestId = currentContest?.contests?.id;
    if (!selectedJudge || !contestId) return;

    setJudgesAssignInfo((prev) => {
      const prevJudges = prev?.judges || [];
      const alreadyAssignedGradeIds = new Set(
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

      const missingTargetIds = new Set(
        (section.sectionGrades || [])
          .map((g) => g.contestGradeId)
          .filter(
            (gid) =>
              gid &&
              !alreadyAssignedGradeIds.has(gid) &&
              !conflictGradeIds.has(gid)
          )
      );

      const added = createRecordsForSectionSeat(
        section.sectionGrades,
        selectedJudge,
        seatIndex,
        contestId,
        missingTargetIds
      );

      return {
        ...(prev || {}),
        judges: [...prevJudges, ...added],
      };
    });
  };

  /** 빈 좌석 + 누락 좌석 공정 랜덤 배정 */
  const handleRandomAssign = (section, allSeats) => {
    const contestId = currentContest?.contests?.id;
    if (!contestId) return;

    setJudgesAssignInfo((prev) => {
      let workingJudges = [...(prev?.judges || [])];
      const sectionGradeIds = new Set(
        (section.sectionGrades || [])
          .map((g) => g.contestGradeId)
          .filter(Boolean)
      );

      // 1단계: 일부 체급만 배정된(partial) 좌석은 기존 좌석 심판으로 누락 체급을 먼저 동기화
      allSeats.forEach((seatNum) => {
        const info = inspectScopeSeat({
          judges: workingJudges,
          targetGrades: section.sectionGrades,
          categoryById,
          seatIndex: seatNum,
        });
        if (
          info.status === "partial" &&
          info.primaryJudgeUid &&
          poolByUid[info.primaryJudgeUid]
        ) {
          const judgeObj = poolByUid[info.primaryJudgeUid];
          const assignedGradesAtSeat = new Set(
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
            (section.sectionGrades || [])
              .map((g) => g.contestGradeId)
              .filter(
                (gid) =>
                  gid &&
                  !assignedGradesAtSeat.has(gid) &&
                  !conflictGrades.has(gid)
              )
          );
          const filled = createRecordsForSectionSeat(
            section.sectionGrades,
            judgeObj,
            seatNum,
            contestId,
            targetIds
          );
          workingJudges = [...workingJudges, ...filled];
        }
      });

      // 2단계: 완전히 비어있는 좌석 추출
      const emptySeats = allSeats.filter((seatNum) => {
        const info = inspectScopeSeat({
          judges: workingJudges,
          targetGrades: section.sectionGrades,
          categoryById,
          seatIndex: seatNum,
        });
        return info.status === "empty";
      });

      if (emptySeats.length > 0) {
        const alreadyInSection = workingJudges
          .filter((r) => sectionGradeIds.has(r.contestGradeId))
          .map((r) => r.judgeUid);

        const pickedJudges = pickFairRandomJudges({
          judgesPool: judgesPoolArray,
          excludedJudgeUids: alreadyInSection,
          count: emptySeats.length,
          currentJudges: workingJudges,
          excludeHead: excludeHeadInRandom,
          balanceWorkload,
        });

        emptySeats.forEach((seatNum, idx) => {
          const picked = pickedJudges[idx];
          if (!picked) return;
          const added = createRecordsForSectionSeat(
            section.sectionGrades,
            picked,
            seatNum,
            contestId
          );
          workingJudges = [...workingJudges, ...added];
        });
      }

      return {
        ...(prev || {}),
        judges: workingJudges,
      };
    });
  };

  /** 섹션 전체 재배정 (공정 랜덤) */
  const handleAllRandomAssign = (section, allSeats) => {
    const contestId = currentContest?.contests?.id;
    if (!contestId) return;

    const sectionGradeIds = new Set(
      (section.sectionGrades || []).map((g) => g.contestGradeId).filter(Boolean)
    );

    setJudgesAssignInfo((prev) => {
      const remainingJudges = (prev?.judges || []).filter(
        (r) => !sectionGradeIds.has(r.contestGradeId)
      );

      const pickedJudges = pickFairRandomJudges({
        judgesPool: judgesPoolArray,
        excludedJudgeUids: [],
        count: allSeats.length,
        currentJudges: remainingJudges,
        excludeHead: excludeHeadInRandom,
        balanceWorkload,
      });

      const newRecords = [];
      allSeats.forEach((seatNum, idx) => {
        const picked = pickedJudges[idx];
        if (!picked) return;
        newRecords.push(
          ...createRecordsForSectionSeat(
            section.sectionGrades,
            picked,
            seatNum,
            contestId
          )
        );
      });

      return {
        ...(prev || {}),
        judges: [...remainingJudges, ...newRecords],
      };
    });
  };

  /** 섹션 초기화 */
  const handleResetAssign = (section) => {
    const sectionGradeIds = new Set(
      (section.sectionGrades || []).map((g) => g.contestGradeId).filter(Boolean)
    );
    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: (prev?.judges || []).filter(
        (r) => !sectionGradeIds.has(r.contestGradeId)
      ),
    }));
  };

  /** 좌석 단일 해제 */
  const handleRemoveAssign = (section, seatIndex) => {
    const sectionGradeIds = new Set(
      (section.sectionGrades || []).map((g) => g.contestGradeId).filter(Boolean)
    );
    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: (prev?.judges || []).filter(
        (r) =>
          !(
            sectionGradeIds.has(r.contestGradeId) &&
            Number(r.seatIndex) === Number(seatIndex)
          )
      ),
    }));
  };

  /** 종목·체급 재생성으로 끊어진 동일 섹션 이전 좌석 배정을 현재 체급들로 복원 */
  const handleRestoreOrphanSeats = (section, recoverableSeats) => {
    const contestId = currentContest?.contests?.id;
    if (!contestId || !recoverableSeats.length) return;

    const sectionGradeIds = new Set(
      (section.sectionGrades || []).map((g) => g.contestGradeId).filter(Boolean)
    );

    setJudgesAssignInfo((prev) => {
      const cleaned = (prev?.judges || []).filter(
        (r) => !sectionGradeIds.has(r.contestGradeId)
      );
      const restored = [];
      recoverableSeats.forEach(({ seatIndex, judge }) => {
        restored.push(
          ...createRecordsForSectionSeat(
            section.sectionGrades,
            judge,
            seatIndex,
            contestId
          )
        );
      });
      return {
        ...(prev || {}),
        judges: [...cleaned, ...restored],
      };
    });
  };

  if (!filteredBySection || filteredBySection.length === 0) {
    return (
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] py-12 text-center text-sm text-[#737373]">
        등록된 종목 및 부(섹션) 정보가 없습니다
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {filteredBySection.map((section, sectionIdx) => {
        const judgeCountsInSection = (section.sectionCategory || [])
          .map((c) => Number(c?.contestCategoryJudgeCount || 0))
          .filter((n) => n > 0);
        const maxSeats =
          judgeCountsInSection.length > 0
            ? Math.max(...judgeCountsInSection)
            : 0;
        const minSeats =
          judgeCountsInSection.length > 0
            ? Math.min(...judgeCountsInSection)
            : 0;

        const allSeats = Array.from({ length: maxSeats }, (_, i) => i + 1);
        const sectionGradeIds = new Set(
          (section.sectionGrades || [])
            .map((g) => g.contestGradeId)
            .filter(Boolean)
        );

        // 섹션 내 총 필요 좌석 vs 배정 완료 좌석 계산
        const expectedSectionSlots = (section.sectionGrades || []).reduce(
          (sum, g) => {
            const cat = categoryById[g?.refCategoryId];
            return sum + Number(cat?.contestCategoryJudgeCount || 0);
          },
          0
        );
        const assignedSectionSlots = (judgesAssignInfo.judges || []).filter(
          (r) => sectionGradeIds.has(r.contestGradeId) && Boolean(r.judgeUid)
        ).length;
        const isSectionComplete =
          expectedSectionSlots > 0 &&
          assignedSectionSlots >= expectedSectionSlots;

        const assignedJudgesInSection = Array.from(
          new Set(
            (judgesAssignInfo.judges || [])
              .filter((r) => sectionGradeIds.has(r.contestGradeId))
              .map((r) => r.judgeUid)
              .filter(Boolean)
          )
        );

        // 종목/체급 삭제·재생성으로 연결이 끊어진 동일 섹션(예: 그랑프리)의 이전 좌석 배정 감지
        const recoverableSeats = [];
        if (assignedSectionSlots === 0 && (section.sectionGrades || []).length > 0) {
          const orphanBySeat = new Map();
          (rawJudges || []).forEach((r) => {
            const rSec = normalizeSectionName(r?.sectionName);
            const sNo = Number(r?.seatIndex);
            if (
              rSec === section.sectionName &&
              Number.isFinite(sNo) &&
              sNo >= 1 &&
              sNo <= maxSeats &&
              r?.judgeUid &&
              poolByUid[r.judgeUid] &&
              !sectionGradeIds.has(r.contestGradeId)
            ) {
              if (!orphanBySeat.has(sNo)) {
                orphanBySeat.set(sNo, poolByUid[r.judgeUid]);
              }
            }
          });
          Array.from(orphanBySeat.entries())
            .sort((a, b) => a[0] - b[0])
            .forEach(([seatIndex, judge]) => {
              recoverableSeats.push({ seatIndex, judge });
            });
        }

        return (
          <div
            key={section.sectionName || sectionIdx}
            className="bg-white rounded-[12px] border border-[#171717]/[0.08] overflow-hidden"
          >
            {/* 섹션 헤더 */}
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
                  {section.sectionName || "미지정"}
                </span>
                <span className="font-mono text-xs tabular-nums text-[#525252] bg-white border border-[#171717]/[0.08] px-2 py-0.5 rounded-[5px]">
                  {minSeats !== maxSeats
                    ? `${minSeats}~${maxSeats}인 심판제`
                    : `${maxSeats}인 심판제`}
                </span>
                <span className="text-xs text-[#737373] font-mono tabular-nums">
                  {section.sectionCategory.length}종목 ·{" "}
                  {section.sectionGrades.length}체급
                </span>
                {expectedSectionSlots > 0 && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] font-mono text-xs tabular-nums border ${
                      isSectionComplete
                        ? "bg-[#16a34a]/[0.08] text-[#16a34a] border-[#16a34a]/20 font-medium"
                        : "bg-[#dc2626]/[0.06] text-[#dc2626] border-[#dc2626]/20 font-medium"
                    }`}
                  >
                    {isSectionComplete && (
                      <CheckCircle2 size={12} strokeWidth={1.8} />
                    )}
                    <span>
                      {assignedSectionSlots}/{expectedSectionSlots}석
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleRandomAssign(section, allSeats)}
                  className="h-8 px-3 rounded-[7px] bg-[#2563eb] hover:bg-[#1d4ed8] text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer border-0"
                >
                  <RotateCcw size={13} strokeWidth={1.6} />
                  <span>빈·누락 좌석 채우기</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAllRandomAssign(section, allSeats)}
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
                  onClick={() => handleResetAssign(section)}
                  className="h-8 px-2.5 rounded-[7px] bg-white hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/20 text-xs font-medium text-[#dc2626] inline-flex items-center gap-1 transition-colors duration-150 cursor-pointer"
                >
                  <Trash2 size={13} strokeWidth={1.6} />
                  <span>초기화</span>
                </button>
              </div>
            </div>

            {recoverableSeats.length > 0 && (
              <div className="mx-4 mt-4 px-3.5 py-2.5 rounded-[8px] bg-[#b45309]/[0.06] border border-[#b45309]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-2 text-xs text-[#171717]">
                  <AlertTriangle
                    size={14}
                    strokeWidth={1.7}
                    className="text-[#b45309] shrink-0 mt-0.5 sm:mt-0"
                  />
                  <span>
                    종목·체급 재생성 전 배정된{" "}
                    <strong className="font-semibold">
                      {recoverableSeats
                        .map((s) => `${s.seatIndex}번 ${s.judge.judgeName}`)
                        .join(", ")}
                    </strong>{" "}
                    기록이 남아 있습니다. 현재 체급에 연결하시겠습니까?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleRestoreOrphanSeats(section, recoverableSeats)
                  }
                  className="h-8 px-3 rounded-[7px] bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer border-0 shrink-0"
                >
                  <span>이전 배정 현재 체급에 복원</span>
                </button>
              </div>
            )}

            {/* 좌석 번호판 그리드 */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {allSeats.map((seatNumber) => {
                const seatState = inspectScopeSeat({
                  judges: judgesAssignInfo.judges || [],
                  targetGrades: section.sectionGrades,
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
                      !assignedJudgesInSection.includes(judge.judgeUid) ||
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

                const isHigherSeatOnly = minSeats > 0 && seatNumber > minSeats;

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
                    isHigherSeatOnly={isHigherSeatOnly}
                    missingCount={seatState.missingCount}
                    multiLabel="종목별 상이"
                    breakdownText={breakdownText}
                    selectableJudges={selectableSorted}
                    workloadByUid={workloadByUid}
                    onSelectChange={(newJudgeUid) => {
                      if (newJudgeUid === "__MULTI__") return;
                      if (newJudgeUid === "unselect") {
                        handleRemoveAssign(section, seatNumber);
                      } else {
                        handleSelectJudge(section, seatNumber, newJudgeUid);
                      }
                    }}
                    onClearSeat={() => handleRemoveAssign(section, seatNumber)}
                    onFillPartial={
                      seatState.status === "partial" &&
                      seatState.primaryJudgeUid
                        ? () =>
                            handleFillPartialSeat(
                              section,
                              seatNumber,
                              seatState.primaryJudgeUid
                            )
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SectionAssign;
