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

const CategoryAssign = ({
  judgesAssignInfo, // 표시용: 부모에서 파생(제목 포함) 내려와도, 저장은 원본 필드만
  judgesPoolArray,
  setJudgesAssignInfo, // 부모가 감싼 '원본 업데이트' setter
  categoriesArray,
  gradesArray,
  currentContest,
  generateUUID,
  setMessage, // ✨ 부모에서 내려주는 모달 메시지
  setMsgOpen, // ✨ 부모에서 내려주는 모달 오픈
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
      if (seatNumber == null) missing.push("seatIndex"); // 0 허용

      if (grade?.contestGradeId == null) missing.push("contestGradeId");
      if (grade?.contestGradeIndex == null) missing.push("contestGradeIndex"); // 0 허용
      if (!grade?.contestGradeTitle) missing.push("contestGradeTitle");
      if (grade?.refCategoryId == null) missing.push("refCategoryId");

      if (missing.length) {
        const label =
          grade?.contestGradeTitle ??
          grade?.contestGradeId ??
          "(알 수 없는 체급)";
        allErrors.push(`${label} → ${missing.join(", ")}`);
        return; // 이 grade는 skip
      }

      // ✅ 원본 필드만 저장 (categoryTitle 등 파생 필드는 저장하지 않음)
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
      // 부모의 원본 상태를 업데이트 → 부모가 파생(제목) 붙여서 렌더/저장
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

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      {(categoriesArray || []).map((category, idx) => {
        const allSeats = Array.from(
          { length: Number(category.contestCategoryJudgeCount || 0) }, // 안전 캐스팅
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
          <Card
            key={idx}
            className="shadow-md"
            title={
              <div className="flex items-center gap-2">
                <TeamOutlined className="text-blue-600" />
                <span className="text-lg font-semibold">
                  {category.contestCategoryTitle ||
                    category.contestCategoryName ||
                    category.contestCategoryInfo?.name ||
                    "이름 없는 카테고리"}
                </span>
              </div>
            }
            extra={
              <Space wrap>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={() => handleRandomAssign(category, unassignedSeats)}
                  size={isMobile ? "small" : "middle"}
                >
                  {isMobile ? "랜덤" : "랜덤배정"}
                </Button>
                <Button
                  type="default"
                  icon={<ThunderboltOutlined />}
                  onClick={() => handleAllRandomAssign(category, allSeats)}
                  size={isMobile ? "small" : "middle"}
                  className="bg-yellow-50 border-yellow-400 text-yellow-700 hover:bg-yellow-100"
                >
                  {isMobile ? "전체" : "모두랜덤"}
                </Button>
                <Button
                  danger
                  icon={<ClearOutlined />}
                  onClick={() => handleResetAssign(category)}
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
                        className="w-full"
                        value={selectedJudge.judgeUid || "unselect"}
                        onChange={(val) => {
                          if (val === "unselect") {
                            handleRemoveAssign(category, seatNumber);
                          } else {
                            handleSelectJudge(category, seatNumber, val);
                          }
                        }}
                        placeholder="심판 선택"
                      >
                        <Select.Option value="unselect">
                          선택 안함
                        </Select.Option>
                        {judgesPoolArray
                          .filter(
                            (judge) =>
                              !assignedJudges.includes(judge.judgeUid) ||
                              judge.judgeUid === selectedJudge.judgeUid
                          )
                          .map((judge) => (
                            <Select.Option
                              key={judge.judgeUid}
                              value={judge.judgeUid}
                            >
                              {judge.isHead && "위원장 / "}
                              {judge.judgeName} ({judge.judgePromoter} /{" "}
                              {judge.judgeTel})
                            </Select.Option>
                          ))}
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
                        className="w-full"
                        value={selectedJudge.judgeUid || "unselect"}
                        onChange={(val) => {
                          if (val === "unselect") {
                            handleRemoveAssign(category, seatNumber);
                          } else {
                            handleSelectJudge(category, seatNumber, val);
                          }
                        }}
                        placeholder="심판 선택"
                      >
                        <Select.Option value="unselect">
                          선택 안함
                        </Select.Option>
                        {judgesPoolArray
                          .filter(
                            (judge) =>
                              !getAssignedJudgesForCategory(
                                category.contestCategoryId
                              ).includes(judge.judgeUid) ||
                              judge.judgeUid === selectedJudge.judgeUid
                          )
                          .map((judge) => (
                            <Select.Option
                              key={judge.judgeUid}
                              value={judge.judgeUid}
                            >
                              {judge.isHead && "위원장 / "}
                              {judge.judgeName} ({judge.judgePromoter} /{" "}
                              {judge.judgeTel})
                            </Select.Option>
                          ))}
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

export default CategoryAssign;
