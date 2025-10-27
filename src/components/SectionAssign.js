"use client";

import { useEffect, useState } from "react";
import { Card, Select, Button, Space, Tag } from "antd";
import {
  UserOutlined,
  PhoneOutlined,
  TeamOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ClearOutlined,
  WarningOutlined,
} from "@ant-design/icons";

const SectionAssign = ({
  judgesAssignInfo, // ← 부모에서 파생(카테고리 제목 포함) 버전을 내려줌 (표시용)
  judgesPoolArray,
  filteredBySection,
  setJudgesAssignInfo, // ← 반드시 원본만 업데이트하도록 부모에서 감싸 전달
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

  /** 🔤 이름 정렬 유틸 (ko 로케일, 대소문자 무시) */
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

    // 현재 좌석에 기존 배정이 있었는지 확인 (최초 배정인지 판단)
    const existingForSeat = (judgesAssignInfo.judges || []).filter(
      (assign) =>
        assign.sectionName === sectionName && assign.seatIndex === seatIndex
    );
    const isBatchReplace =
      existingForSeat.length > 0 &&
      existingForSeat.some((a) => a.judgeUid !== selectedJudge.judgeUid);

    // 기존 해당 좌석 배정 제거
    const updatedJudges = (judgesAssignInfo.judges || []).filter(
      (assign) =>
        !(
          assign.seatIndex === seatIndex &&
          (assign.sectionName === sectionName || !assign.sectionName)
        )
    );

    // 이 섹션의 모든 grade를 가져와서 일괄 배정
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
      // ✅ 최초 배정(기존 없음)일 때는 모달을 띄우지 않음
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

  useEffect(() => {
    console.log("filteredBySection", filteredBySection);
  }, [filteredBySection]);

  /** 🔎 공통 Select props: 검색/자동완성 설정 */
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
    <div className="flex w-full flex-col gap-4 p-4">
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
          <Card
            key={sectionIdx}
            className="shadow-md"
            title={
              <div className="flex items-center gap-2">
                <TeamOutlined className="text-blue-600" />
                <span className="text-lg font-semibold">
                  {section.sectionName}
                </span>
              </div>
            }
            extra={
              <Space wrap>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={() =>
                    handleRandomAssign(section.sectionName, unassignedSeats)
                  }
                  size={isMobile ? "small" : "middle"}
                >
                  {isMobile ? "랜덤" : "랜덤배정"}
                </Button>
                <Button
                  type="default"
                  icon={<ThunderboltOutlined />}
                  onClick={() =>
                    handleAllRandomAssign(section.sectionName, allSeats)
                  }
                  size={isMobile ? "small" : "middle"}
                  className="bg-yellow-50 border-yellow-400 text-yellow-700 hover:bg-yellow-100"
                >
                  {isMobile ? "전체" : "모두랜덤"}
                </Button>
                <Button
                  danger
                  icon={<ClearOutlined />}
                  onClick={() => handleResetAssign(section.sectionName)}
                  size={isMobile ? "small" : "middle"}
                >
                  초기화
                </Button>
              </Space>
            }
          >
            <div className="flex flex-col gap-3">
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

                // 🔤 섹션별 “선택 가능 목록”을 이름순 정렬해서 준비
                const selectableSorted = sortJudgesByName(
                  judgesPoolArray.filter(
                    (judge) =>
                      !assignedJudges.includes(judge.judgeUid) ||
                      judge.judgeUid === selectedJudge.judgeUid
                  )
                );

                if (isMobile) {
                  return (
                    <Card
                      key={seatNumber}
                      size="small"
                      className="bg-gray-50"
                      title={
                        <div className="flex items-center justify-between">
                          <span className="text-base font-semibold">
                            좌석 {seatNumber}
                          </span>
                          {seatStatus === "multi" && (
                            <Tag color="error" icon={<WarningOutlined />}>
                              다중 심판
                            </Tag>
                          )}
                        </div>
                      }
                    >
                      {selectedJudgeInfo && (
                        <div className="mb-3 p-2 bg-blue-50 rounded">
                          <div className="flex items-center gap-2 mb-1">
                            <UserOutlined className="text-blue-600" />
                            <span className="font-medium">
                              {selectedJudgeInfo.judgeName}
                            </span>
                            {selectedJudgeInfo.isHead && (
                              <Tag color="gold">위원장</Tag>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <PhoneOutlined />
                            <span>{selectedJudgeInfo.judgeTel}</span>
                          </div>
                          <div className="text-sm text-gray-600">
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
                    </Card>
                  );
                }

                return (
                  <div
                    key={seatNumber}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 w-32">
                      <span className="font-semibold text-gray-700">
                        좌석 {seatNumber}
                      </span>
                      {seatStatus === "multi" && (
                        <Tag
                          color="error"
                          icon={<WarningOutlined />}
                          className="text-xs"
                        >
                          다중
                        </Tag>
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
          </Card>
        );
      })}
    </div>
  );
};

export default SectionAssign;
