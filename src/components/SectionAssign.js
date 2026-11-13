"use client";

import { useEffect, useState } from "react";
import { Select } from "antd";
import {
  User,
  Phone,
  Users,
  RotateCcw,
  Shuffle,
  Trash2,
  AlertTriangle,
} from "lucide-react";

const SectionAssign = ({
  judgesAssignInfo,
  judgesPoolArray,
  filteredBySection,
  setJudgesAssignInfo,
  currentContest,
  generateUUID,
  setMessage,
  setMsgOpen,
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

  /** 이름 정렬 유틸 (ko 로케일, 대소문자 무시) */
  const sortJudgesByName = (arr = []) =>
    [...arr].sort((a, b) =>
      (a?.judgeName || "").localeCompare(b?.judgeName || "", "ko", {
        sensitivity: "base",
        numeric: true,
      })
    );

  /** 이미 배정된 심판 목록 */
  const getAssignedJudgesForSection = (sectionName) => {
    return (judgesAssignInfo.judges || [])
      .filter((assign) => assign.sectionName === sectionName)
      .map((assign) => assign.judgeUid);
  };

  /** 다중 심판 상태 확인 */
  const getSeatStatus = (sectionName, seatIndex) => {
    const assigned = (judgesAssignInfo.judges || []).filter(
      (a) =>
        (a.sectionName === sectionName || a.refSectionName === sectionName) &&
        a.seatIndex === seatIndex
    );
    const uniqueJudges = [...new Set(assigned.map((a) => a.judgeUid))];
    return uniqueJudges.length > 1 ? "multi" : "single";
  };

  /** 좌석에 심판 배정 (원본 필드만 push) */
  const assignJudgeToGrades = (
    sectionGrades,
    selectedJudge,
    seatNumber,
    sectionName,
    updatedJudges,
    generateUUID,
    currentContest
  ) => {
    let hasError = false;

    sectionGrades.forEach((grade) => {
      const errorFields = [];

      if (grade.refCategoryId == null) errorFields.push("refCategoryId");
      if (grade.contestGradeId == null) errorFields.push("contestGradeId");
      if (!grade.contestGradeTitle) errorFields.push("contestGradeTitle");
      if (grade.contestGradeIndex == null)
        errorFields.push("contestGradeIndex");
      if (!selectedJudge || !selectedJudge.judgeUid)
        errorFields.push("judgeUid");
      if (!selectedJudge || !selectedJudge.judgeName)
        errorFields.push("judgeName");
      if (!currentContest?.contests?.id) errorFields.push("contestId");
      if (seatNumber == null) errorFields.push("seatIndex");

      if (errorFields.length > 0) {
        setMessage({
          body: `배정할 수 없습니다. ${sectionName}의 ${seatNumber}번 좌석에 필수 정보가 누락되었습니다: ${errorFields.join(
            ", "
          )}`,
        });
        setMsgOpen(true);
        hasError = true;
        return;
      }

      updatedJudges.push({
        sectionName,
        seatIndex: seatNumber,
        judgeUid: selectedJudge.judgeUid,
        judgeName: selectedJudge.judgeName,
        judgesAssignId: generateUUID(),
        contestId: currentContest.contests.id,
        isHead: !!selectedJudge.isHead,
        onedayPassword: selectedJudge.onedayPassword || null,
        categoryId: grade.refCategoryId,
        contestGradeId: grade.contestGradeId,
        contestGradeIndex: grade.contestGradeIndex,
        contestGradeTitle: grade.contestGradeTitle,
        isCompared: !!grade.isCompared,
        refCategoryId: grade.refCategoryId || null,
      });
    });

    return !hasError;
  };

  /** 좌석에서 심판 선택 */
  const handleSelectJudge = (sectionName, seatIndex, judgeUid) => {
    const selectedJudge = judgesPoolArray.find(
      (judge) => judge.judgeUid === judgeUid
    );
    if (!selectedJudge) return;

    const existingForSeat = (judgesAssignInfo.judges || []).filter(
      (assign) =>
        assign.sectionName === sectionName && assign.seatIndex === seatIndex
    );
    const isBatchReplace =
      existingForSeat.length > 0 &&
      existingForSeat.some((a) => a.judgeUid !== selectedJudge.judgeUid);

    const updatedJudges = (judgesAssignInfo.judges || []).filter(
      (assign) =>
        !(
          assign.seatIndex === seatIndex &&
          (assign.sectionName === sectionName || !assign.sectionName)
        )
    );

    const sectionInfo = filteredBySection.find(
      (section) => section.sectionName === sectionName
    );
    if (!sectionInfo) return;

    const { sectionGrades } = sectionInfo;

    if (
      assignJudgeToGrades(
        sectionGrades,
        selectedJudge,
        seatIndex,
        sectionName,
        updatedJudges,
        generateUUID,
        currentContest
      )
    ) {
      if (isBatchReplace) {
        setMessage({
          body: "이 좌석을 새 심판으로 변경하면, 이 섹션의 하위 카테고리에 이미 배정된 동일 좌석 심판이 모두 함께 변경됩니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
      }

      setJudgesAssignInfo((prev) => ({
        ...(prev || {}),
        judges: updatedJudges,
      }));
    }
  };

  /** 랜덤 배정 */
  const handleRandomAssign = (sectionName, unassignedSeats) => {
    const availableJudges = judgesPoolArray.filter(
      (judge) =>
        !getAssignedJudgesForSection(sectionName).includes(judge.judgeUid)
    );
    const updatedJudgesAssignInfo = [...(judgesAssignInfo.judges || [])];

    const sectionInfo = filteredBySection.find(
      (section) => section.sectionName === sectionName
    );
    if (!sectionInfo) return;

    const { sectionGrades } = sectionInfo;

    unassignedSeats.forEach((seatNumber) => {
      if (availableJudges.length > 0) {
        const randomJudge =
          availableJudges[Math.floor(Math.random() * availableJudges.length)];
        if (randomJudge) {
          assignJudgeToGrades(
            sectionGrades,
            randomJudge,
            seatNumber,
            sectionName,
            updatedJudgesAssignInfo,
            generateUUID,
            currentContest
          );
          availableJudges.splice(availableJudges.indexOf(randomJudge), 1);
        }
      }
    });

    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: updatedJudgesAssignInfo,
    }));
  };

  /** 전체 랜덤 */
  const handleAllRandomAssign = (sectionName, allSeats) => {
    const availableJudges = [...judgesPoolArray];
    const updatedJudgesAssignInfo = (judgesAssignInfo.judges || []).filter(
      (assign) => assign.sectionName !== sectionName
    );

    const sectionInfo = filteredBySection.find(
      (section) => section.sectionName === sectionName
    );
    if (!sectionInfo) return;

    const { sectionGrades } = sectionInfo;

    allSeats.forEach((seatNumber) => {
      if (availableJudges.length > 0) {
        const randomJudge = availableJudges.splice(
          Math.floor(Math.random() * availableJudges.length),
          1
        )[0];
        if (randomJudge) {
          assignJudgeToGrades(
            sectionGrades,
            randomJudge,
            seatNumber,
            sectionName,
            updatedJudgesAssignInfo,
            generateUUID,
            currentContest
          );
        }
      }
    });

    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: updatedJudgesAssignInfo,
    }));
  };

  /** 초기화 */
  const handleResetAssign = (sectionName) => {
    const clearedJudges = (judgesAssignInfo.judges || []).filter(
      (assign) => assign.sectionName !== sectionName
    );
    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: clearedJudges,
    }));
  };

  const handleRemoveAssign = (sectionName, seatIndex) => {
    const updatedJudges = (judgesAssignInfo.judges || []).filter(
      (assign) =>
        !(assign.sectionName === sectionName && assign.seatIndex === seatIndex)
    );
    setJudgesAssignInfo((prev) => ({
      ...(prev || {}),
      judges: updatedJudges,
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

  return (
    <div className="flex w-full flex-col gap-4 pt-2">
      {filteredBySection.map((section, sectionIdx) => {
        const allSeats = Array.from(
          {
            length: Number(
              section.sectionCategory[0]?.contestCategoryJudgeCount || 0
            ),
          },
          (_, seatIdx) => seatIdx + 1
        );

        const unassignedSeats = allSeats.filter(
          (seatNumber) =>
            !(judgesAssignInfo.judges || []).some(
              (assign) =>
                assign.sectionName === section.sectionName &&
                assign.seatIndex === seatNumber
            )
        );

        const assignedJudges = getAssignedJudgesForSection(section.sectionName);

        return (
          <div
            key={sectionIdx}
            className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            <div className="px-4 py-3 bg-[#f4f4f5] border-b border-[#171717]/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Users size={16} strokeWidth={1.5} className="text-[#525252]" />
                <span className="text-[15px] font-semibold text-[#171717]">
                  {section.sectionName || "미지정 섹션"}
                </span>
                <span className="font-mono text-xs tabular-nums text-[#737373] bg-[#ffffff] border border-[#171717]/[0.08] px-2 py-0.5 rounded-[4px]">
                  {allSeats.length}석
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    handleRandomAssign(section.sectionName, unassignedSeats)
                  }
                  className="h-9 px-3 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors duration-150"
                >
                  <RotateCcw size={14} strokeWidth={1.5} />
                  <span>{isMobile ? "랜덤" : "빈 좌석 랜덤"}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAllRandomAssign(section.sectionName, allSeats)
                  }
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
                  onClick={() => handleResetAssign(section.sectionName)}
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
                  section.sectionName,
                  seatNumber
                );
                const selectedJudge = (judgesAssignInfo.judges || []).find(
                  (assign) =>
                    assign.sectionName === section.sectionName &&
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
                        onChange={(newJudgeUid) => {
                          if (newJudgeUid === "unselect") {
                            handleRemoveAssign(section.sectionName, seatNumber);
                          } else {
                            handleSelectJudge(
                              section.sectionName,
                              seatNumber,
                              newJudgeUid
                            );
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
                        onChange={(newJudgeUid) => {
                          if (newJudgeUid === "unselect") {
                            handleRemoveAssign(section.sectionName, seatNumber);
                          } else {
                            handleSelectJudge(
                              section.sectionName,
                              seatNumber,
                              newJudgeUid
                            );
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

export default SectionAssign;
