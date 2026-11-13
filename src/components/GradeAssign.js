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

/**
 * GradeAssign
 * - 체급(grade) 단위로 심판을 배정/제거/랜덤배정
 * - 저장 시 '원본 필드'만 push (부모가 categoryTitle 등 파생 필드 붙임)
 * - 섹션 탭 + 부모 카테고리 선택(필터)
 * - 심판 선택: 이름순 정렬 + 검색 자동완성
 */
const GradeAssign = ({
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
  const [selectedCategoryId, setSelectedCategoryId] = useState("__ALL_CAT__");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /** 이름 정렬 유틸 (ko 로케일, 대소문자 무시) */
  const sortJudgesByName = (arr = []) =>
    [...arr].sort((a, b) =>
      (a?.judgeName || "").localeCompare(b?.judgeName || "", "ko", {
        sensitivity: "base",
        numeric: true,
      })
    );

  /** 카테고리 id → 카테고리 객체 맵 */
  const categoryById = useMemo(() => {
    const map = {};
    (categoriesArray || []).forEach((c) => {
      if (c?.contestCategoryId) map[c.contestCategoryId] = c;
    });
    return map;
  }, [categoriesArray]);

  /** 해당 체급에 이미 배정된 심판 UID 배열 */
  const getAssignedJudgesForGrade = (contestGradeId) => {
    return (judgesAssignInfo.judges || [])
      .filter((assign) => assign.contestGradeId === contestGradeId)
      .map((assign) => assign.judgeUid);
  };

  /** 체급+좌석 다중 심판 상태 */
  const getSeatStatus = (contestGradeId, seatIndex) => {
    const assigned = (judgesAssignInfo.judges || []).filter(
      (a) => a.contestGradeId === contestGradeId && a.seatIndex === seatIndex
    );
    const uniqueJudges = [...new Set(assigned.map((a) => a.judgeUid))];
    return uniqueJudges.length > 1 ? "multi" : "single";
  };

  /** 체급에 심판 배정 (원본 필드만 push) + 유효성 검사 */
  const assignJudgeToGrade = (
    grade,
    selectedJudge,
    seatNumber,
    updatedJudges
  ) => {
    const missing = [];
    const cat = categoryById[grade?.refCategoryId];

    if (!cat?.contestCategorySection) missing.push("sectionName");
    if (!cat?.contestCategoryId) missing.push("categoryId");
    if (!selectedJudge?.judgeUid) missing.push("judgeUid");
    if (!selectedJudge?.judgeName) missing.push("judgeName");
    if (!currentContest?.contests?.id) missing.push("contestId");
    if (seatNumber == null) missing.push("seatIndex");

    if (grade?.contestGradeId == null) missing.push("contestGradeId");
    if (grade?.contestGradeIndex == null) missing.push("contestGradeIndex");
    if (!grade?.contestGradeTitle) missing.push("contestGradeTitle");
    if (grade?.refCategoryId == null) missing.push("refCategoryId");

    if (missing.length) {
      setMessage?.({
        body:
          `배정할 수 없습니다. 체급 ${
            grade?.contestGradeTitle ?? "(알 수 없음)"
          } / 좌석 ${seatNumber} 누락 정보:\n- ` + missing.join(", "),
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen?.(true);
      return false;
    }

    updatedJudges.push({
      sectionName: cat.contestCategorySection,
      categoryId: cat.contestCategoryId,
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

    return true;
  };

  /** 심판 선택 */
  const handleSelectJudge = (grade, seatIndex, judgeUid) => {
    const selectedJudge = judgesPoolArray.find((j) => j.judgeUid === judgeUid);
    if (!selectedJudge) return;

    const updatedJudges = (judgesAssignInfo.judges || []).filter(
      (assign) =>
        !(
          assign.contestGradeId === grade.contestGradeId &&
          assign.seatIndex === seatIndex
        )
    );

    const ok = assignJudgeToGrade(
      grade,
      selectedJudge,
      seatIndex,
      updatedJudges
    );
    if (!ok) return;

    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: updatedJudges,
    }));
  };

  /** 심판 제거 */
  const handleRemoveAssign = (grade, seatIndex) => {
    const updatedJudges = (judgesAssignInfo.judges || []).filter(
      (assign) =>
        !(
          assign.contestGradeId === grade.contestGradeId &&
          assign.seatIndex === seatIndex
        )
    );
    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: updatedJudges,
    }));
  };

  /** 랜덤 배정 (빈 좌석만) */
  const handleRandomAssign = (grade, unassignedSeats) => {
    const assignedJudges = getAssignedJudgesForGrade(grade.contestGradeId);
    const availableJudges = judgesPoolArray.filter(
      (judge) => !assignedJudges.includes(judge.judgeUid)
    );

    const updatedJudgesAssignInfo = [...(judgesAssignInfo.judges || [])];

    unassignedSeats.forEach((seatNumber) => {
      if (availableJudges.length === 0) return;
      const randomJudge =
        availableJudges[Math.floor(Math.random() * availableJudges.length)];
      if (!randomJudge) return;

      const ok = assignJudgeToGrade(
        grade,
        randomJudge,
        seatNumber,
        updatedJudgesAssignInfo
      );
      if (!ok) return;

      availableJudges.splice(availableJudges.indexOf(randomJudge), 1);
    });

    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: updatedJudgesAssignInfo,
    }));
  };

  /** 전체 랜덤 (해당 체급 모두 재배정) */
  const handleAllRandomAssign = (grade, allSeats) => {
    const availableJudges = [...judgesPoolArray];
    const updatedJudgesAssignInfo = (judgesAssignInfo.judges || []).filter(
      (assign) => assign.contestGradeId !== grade.contestGradeId
    );

    allSeats.forEach((seatNumber) => {
      if (availableJudges.length === 0) return;
      const randomJudge = availableJudges.splice(
        Math.floor(Math.random() * availableJudges.length),
        1
      )[0];
      if (!randomJudge) return;

      const ok = assignJudgeToGrade(
        grade,
        randomJudge,
        seatNumber,
        updatedJudgesAssignInfo
      );
      if (!ok) return;
    });

    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: updatedJudgesAssignInfo,
    }));
  };

  /** 초기화 (해당 체급 전부 제거) */
  const handleResetAssign = (grade) => {
    const cleared = (judgesAssignInfo.judges || []).filter(
      (assign) => assign.contestGradeId !== grade.contestGradeId
    );
    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: cleared,
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

  /** 섹션 탭 구성 */
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

  /** 현재 섹션에 속한 카테고리 목록 */
  const categoriesInActiveSection = useMemo(() => {
    const list = (categoriesArray || []).filter((c) => {
      const sec = c?.contestCategorySection?.trim() || "미지정";
      return activeSection === "__ALL__" ? true : sec === activeSection;
    });
    return [...list].sort(
      (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
    );
  }, [categoriesArray, activeSection]);

  /** 섹션/카테고리 필터링된 그레이드 목록 */
  const filteredGrades = useMemo(() => {
    let list = gradesArray || [];
    if (activeSection !== "__ALL__") {
      list = list.filter((g) => {
        const cat = categoryById[g?.refCategoryId];
        const sec = cat?.contestCategorySection?.trim() || "미지정";
        return sec === activeSection;
      });
    }
    if (selectedCategoryId !== "__ALL_CAT__") {
      list = list.filter((g) => g?.refCategoryId === selectedCategoryId);
    }
    return list;
  }, [gradesArray, activeSection, selectedCategoryId, categoryById]);

  useEffect(() => {
    setSelectedCategoryId("__ALL_CAT__");
  }, [activeSection]);

  return (
    <div className="flex w-full flex-col gap-4 pt-2">
      <Tabs
        activeKey={activeSection}
        onChange={setActiveSection}
        items={sectionTabs.map((tab) => {
          const count =
            tab.key === "__ALL__"
              ? (gradesArray || []).length
              : (gradesArray || []).filter((g) => {
                  const cat = categoryById[g?.refCategoryId];
                  const sec = cat?.contestCategorySection?.trim() || "미지정";
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
            {categoriesInActiveSection
              .sort((a, b) => a.stageNumber - b.stageNumber)
              .map((c) => (
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

        const unassignedSeats = allSeats.filter(
          (seatNumber) =>
            !(judgesAssignInfo.judges || []).some(
              (assign) =>
                assign.contestGradeId === grade.contestGradeId &&
                assign.seatIndex === seatNumber
            )
        );

        const assignedJudges = getAssignedJudgesForGrade(grade.contestGradeId);

        return (
          <div
            key={idx}
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
                  {cat.contestCategorySection?.trim() || "미지정"}
                </span>
                <span className="font-mono text-xs tabular-nums text-[#737373] bg-[#ffffff] border border-[#171717]/[0.08] px-2 py-0.5 rounded-[4px]">
                  {allSeats.length}석
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleRandomAssign(grade, unassignedSeats)}
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
                const seatStatus = getSeatStatus(
                  grade.contestGradeId,
                  seatNumber
                );

                const selectedJudge = (judgesAssignInfo.judges || []).find(
                  (assign) =>
                    assign.contestGradeId === grade.contestGradeId &&
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
                            handleRemoveAssign(grade, seatNumber);
                          } else {
                            handleSelectJudge(grade, seatNumber, val);
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
                            handleRemoveAssign(grade, seatNumber);
                          } else {
                            handleSelectJudge(grade, seatNumber, val);
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

export default GradeAssign;
