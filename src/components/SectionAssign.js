"use client";

import { useEffect, useMemo, useState } from "react";
import { Select } from "antd";
import {
  User,
  Phone,
  Users,
  RotateCcw,
  Shuffle,
  Trash2,
  AlertTriangle,
  Check,
} from "lucide-react";
import {
  sortJudgesByName,
  buildJudgeAssignRecord,
  pickFairRandomJudges,
  inspectScopeSeat,
} from "../utils/judgeAssignUtils";

const SectionAssign = ({
  judgesAssignInfo,
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
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
      // 동일 체급 다른 좌석에 이미 앉아있는 체급은 충돌 방지를 위해 제외
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

  return (
    <div className="flex w-full flex-col gap-4 pt-2">
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

        // 현재 섹션에서 모든 대상 체급에 완전히 배정된 심판 UID 집합 (중복 배정 방지용)
        const assignedJudgesInSection = Array.from(
          new Set(
            (judgesAssignInfo.judges || [])
              .filter((r) => sectionGradeIds.has(r.contestGradeId))
              .map((r) => r.judgeUid)
              .filter(Boolean)
          )
        );

        return (
          <div
            key={section.sectionName || sectionIdx}
            className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            <div className="px-4 py-3 bg-[#f4f4f5] border-b border-[#171717]/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Users size={16} strokeWidth={1.5} className="text-[#525252]" />
                <span className="text-[15px] font-semibold text-[#171717]">
                  {section.sectionName || "미지정"}
                </span>
                <span className="font-mono text-xs tabular-nums text-[#737373] bg-[#ffffff] border border-[#171717]/[0.08] px-2 py-0.5 rounded-[4px]">
                  {minSeats !== maxSeats
                    ? `${minSeats}~${maxSeats}석`
                    : `${maxSeats}석`}
                </span>
                <span className="text-xs text-[#737373] tabular-nums">
                  {section.sectionCategory.length}종목 ·{" "}
                  {section.sectionGrades.length}체급
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleRandomAssign(section, allSeats)}
                  className="h-9 px-3 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors duration-150"
                >
                  <RotateCcw size={14} strokeWidth={1.5} />
                  <span>{isMobile ? "랜덤" : "빈·누락 좌석 채우기"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAllRandomAssign(section, allSeats)}
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
                  onClick={() => handleResetAssign(section)}
                  className="h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/20 text-xs font-medium text-[#dc2626] inline-flex items-center gap-1.5 transition-colors duration-150"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                  <span>초기화</span>
                </button>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-2">
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

                const statusBadges = (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isHigherSeatOnly && (
                      <span className="px-1.5 py-0.5 rounded-[4px] text-[11px] font-mono tabular-nums bg-[#f4f4f5] text-[#737373]">
                        {seatNumber}인+ 전용
                      </span>
                    )}
                    {seatState.status === "multi" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#2563eb]/[0.08] text-[#2563eb]">
                        <AlertTriangle size={12} strokeWidth={1.5} />
                        <span>종목별 상이</span>
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
                        onChange={(newJudgeUid) => {
                          if (newJudgeUid === "__MULTI__") return;
                          if (newJudgeUid === "unselect") {
                            handleRemoveAssign(section, seatNumber);
                          } else {
                            handleSelectJudge(section, seatNumber, newJudgeUid);
                          }
                        }}
                      >
                        <Select.Option value="unselect" data-search="">
                          선택 안함
                        </Select.Option>

                        {seatState.status === "multi" && (
                          <Select.Option value="__MULTI__" data-search="">
                            종목·체급별 개별 배정됨 ({breakdownText})
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
                                section,
                                seatNumber,
                                seatState.primaryJudgeUid
                              )
                            }
                            className="h-8 px-2.5 rounded-[6px] bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-medium inline-flex items-center gap-1 shrink-0 transition-colors"
                            title="누락된 하위 체급에도 이 심판을 동일하게 채웁니다"
                          >
                            <Check size={13} strokeWidth={1.75} />
                            <span>누락 채우기</span>
                          </button>
                        )}
                    </div>

                    {seatState.status === "multi" && (
                      <span className="text-[11px] text-[#737373] pl-1">
                        현재 하위 배정: {breakdownText} (새 심판 선택 시 섹션
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
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SectionAssign;
