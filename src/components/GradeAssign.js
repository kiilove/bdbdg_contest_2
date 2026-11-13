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
  GitBranch,
} from "lucide-react";
import {
  normalizeSectionName,
  sortJudgesByName,
  buildJudgeAssignRecord,
  pickFairRandomJudges,
} from "../utils/judgeAssignUtils";

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
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [activeSection, setActiveSection] = useState("__ALL__");
  const [selectedCategoryId, setSelectedCategoryId] = useState("__ALL_CAT__");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /** 상단 누락 검증 패널에서 특정 종목 클릭 시 즉시 포커스 */
  useEffect(() => {
    if (focusCategoryId) {
      setActiveSection("__ALL__");
      setSelectedCategoryId(focusCategoryId);
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

  /** 섹션 탭 구성 */
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

  /** 현재 섹션에 속한 카테고리 목록 (진행 순서 기준 정렬) */
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

  /** 섹션/카테고리 필터링된 그레이드 목록 */
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
  }, [gradesArray, activeSection, selectedCategoryId, categoryById]);

  const handleSectionChange = (nextSec) => {
    setActiveSection(nextSec);
    setSelectedCategoryId("__ALL_CAT__");
  };

  return (
    <div className="flex w-full flex-col gap-4 pt-2">
      <Tabs
        activeKey={activeSection}
        onChange={handleSectionChange}
        items={sectionTabs.map((tab) => {
          const count =
            tab.key === "__ALL__"
              ? (gradesArray || []).length
              : (gradesArray || []).filter((g) => {
                  const cat = categoryById[g?.refCategoryId];
                  const sec = normalizeSectionName(cat?.contestCategorySection);
                  return sec === tab.key;
                }).length;

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

      {/* 상단: 카테고리 선택 필터 */}
      <div className="bg-[#fafafa] border border-[#171717]/[0.08] rounded-[8px] px-3.5 py-2.5 flex items-center gap-3">
        <GitBranch
          size={16}
          strokeWidth={1.5}
          className="text-[#737373] shrink-0"
        />
        <span className="text-xs font-medium text-[#525252] shrink-0">
          종목 필터
        </span>
        <div className="flex-1 max-w-md">
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
            <Select.Option value="__ALL_CAT__">전체 종목</Select.Option>
            {categoriesInActiveSection.map((c) => (
              <Select.Option
                key={c.contestCategoryId}
                value={c.contestCategoryId}
              >
                {c.contestCategoryTitle ||
                  c.contestCategoryName ||
                  c.contestCategoryInfo?.name ||
                  "이름 없는 카테고리"}
              </Select.Option>
            ))}
          </Select>
        </div>
      </div>

      {(filteredGrades || []).map((grade, idx) => {
        const cat = categoryById[grade.refCategoryId] || {};
        const judgeCount = Number(cat.contestCategoryJudgeCount || 0);

        const allSeats = Array.from({ length: judgeCount }, (_, i) => i + 1);
        const assignedJudges = getAssignedJudgesForGrade(
          grade.contestGradeId,
          judgesAssignInfo.judges
        );
        const filledCount = allSeats.filter((s) =>
          (judgesAssignInfo.judges || []).some(
            (a) =>
              a.contestGradeId === grade.contestGradeId &&
              Number(a.seatIndex) === s &&
              Boolean(a.judgeUid)
          )
        ).length;

        return (
          <div
            key={grade.contestGradeId || idx}
            className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            <div className="px-4 py-3 bg-[#f4f4f5] border-b border-[#171717]/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Users size={16} strokeWidth={1.5} className="text-[#525252]" />
                <span className="text-[15px] font-semibold text-[#171717]">
                  {(cat.contestCategoryTitle ||
                    cat.contestCategoryName ||
                    cat.contestCategoryInfo?.name ||
                    "이름 없는 카테고리") +
                    " · " +
                    (grade.contestGradeTitle || "(이름 없는 체급)")}
                </span>
                <span className="px-2 py-0.5 rounded-[4px] bg-[#ffffff] border border-[#171717]/[0.08] text-xs text-[#525252]">
                  {normalizeSectionName(cat.contestCategorySection)}
                </span>
                <span
                  className={`font-mono text-xs tabular-nums px-2 py-0.5 rounded-[4px] border ${
                    filledCount === allSeats.length
                      ? "bg-[#ffffff] border-[#171717]/[0.08] text-[#737373]"
                      : "bg-[#dc2626]/[0.08] border-[#dc2626]/20 text-[#dc2626] font-medium"
                  }`}
                >
                  {filledCount}/{allSeats.length}석
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleRandomAssign(grade, allSeats)}
                  className="h-9 px-3 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors duration-150"
                >
                  <RotateCcw size={14} strokeWidth={1.5} />
                  <span>{isMobile ? "랜덤" : "빈 좌석 랜덤"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAllRandomAssign(grade, allSeats)}
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
                  onClick={() => handleResetAssign(grade)}
                  className="h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/20 text-xs font-medium text-[#dc2626] inline-flex items-center gap-1.5 transition-colors duration-150"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                  <span>초기화</span>
                </button>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-2">
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

                if (isMobile) {
                  return (
                    <div
                      key={seatNumber}
                      className={`p-3 border rounded-[8px] space-y-2.5 ${
                        isRemovedFromPool
                          ? "bg-[#dc2626]/[0.03] border-[#dc2626]/25"
                          : "bg-[#fafafa] border-[#171717]/[0.08]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium tabular-nums text-[#171717]">
                          좌석 {seatNumber}
                        </span>
                        {isRemovedFromPool && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-medium bg-[#dc2626]/[0.08] text-[#dc2626]">
                            <AlertTriangle size={12} strokeWidth={1.5} />
                            <span>선발 해제됨</span>
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
                            handleRemoveAssign(grade, seatNumber);
                          } else {
                            handleSelectJudge(grade, seatNumber, val);
                          }
                        }}
                      >
                        <Select.Option value="unselect" data-search="">
                          선택 안함
                        </Select.Option>
                        {isRemovedFromPool && (
                          <Select.Option
                            value={selectedJudge.judgeUid}
                            data-search=""
                          >
                            [선발 해제됨]{" "}
                            {selectedJudge.judgeName || selectedJudge.judgeUid}
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
                    </div>
                  );
                }

                return (
                  <div
                    key={seatNumber}
                    className={`flex items-center gap-4 px-3.5 py-2 border rounded-[8px] transition-colors duration-150 ${
                      isRemovedFromPool
                        ? "bg-[#dc2626]/[0.03] border-[#dc2626]/25"
                        : "bg-[#fafafa] border-[#171717]/[0.06] hover:bg-[#f4f4f5]"
                    }`}
                  >
                    <div className="flex items-center gap-2 w-44 shrink-0">
                      <span className="font-mono text-sm font-medium tabular-nums text-[#525252]">
                        좌석 {seatNumber}
                      </span>
                      {isRemovedFromPool && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#dc2626]/[0.08] text-[#dc2626]">
                          <AlertTriangle size={12} strokeWidth={1.5} />
                          <span>선발 해제됨</span>
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
                            handleRemoveAssign(grade, seatNumber);
                          } else {
                            handleSelectJudge(grade, seatNumber, val);
                          }
                        }}
                      >
                        <Select.Option value="unselect" data-search="">
                          선택 안함
                        </Select.Option>
                        {isRemovedFromPool && (
                          <Select.Option
                            value={selectedJudge.judgeUid}
                            data-search=""
                          >
                            [선발 해제됨]{" "}
                            {selectedJudge.judgeName || selectedJudge.judgeUid}
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

export default GradeAssign;
