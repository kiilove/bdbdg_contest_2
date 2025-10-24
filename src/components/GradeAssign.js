"use client";

import { useEffect, useMemo, useState } from "react";
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

/**
 * GradeAssign
 * - 체급(grade) 단위로 심판을 배정/제거/랜덤배정
 * - 저장 시 '원본 필드'만 push (부모가 categoryTitle 등 파생 필드 붙임)
 */
const GradeAssign = ({
  judgesAssignInfo, // 표시용(파생 포함) - 수정은 원본만
  judgesPoolArray,
  setJudgesAssignInfo, // 부모가 감싼 '원본 업데이트' setter
  categoriesArray,
  gradesArray,
  currentContest,
  generateUUID,
  setMessage, // 모달 메시지
  setMsgOpen, // 모달 오픈
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /** 카테고리 id → 카테고리 객체 맵 (좌석 수/섹션명/타이틀 접근용) */
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
    if (seatNumber == null) missing.push("seatIndex"); // 0 허용

    if (grade?.contestGradeId == null) missing.push("contestGradeId");
    if (grade?.contestGradeIndex == null) missing.push("contestGradeIndex"); // 0 허용
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

    // ✅ 원본 필드만 저장
    updatedJudges.push({
      sectionName: cat.contestCategorySection, // 카테고리에서 가져옴
      categoryId: cat.contestCategoryId, // 카테고리에서 가져옴
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

    // 해당 체급+좌석의 기존 배정 제거
    const updatedJudges = (judgesAssignInfo.judges || []).filter(
      (assign) =>
        !(
          assign.contestGradeId === grade.contestGradeId &&
          assign.seatIndex === seatIndex
        )
    );

    // push
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

      // 한 번 배정된 심판은 제거해서 중복 배정 최소화
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
    // 해당 체급 기존 배정 제거
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

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      {(gradesArray || []).map((grade, idx) => {
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
          <Card
            key={idx}
            className="shadow-md"
            title={
              <div className="flex items-center gap-2">
                <TeamOutlined className="text-blue-600" />
                <span className="text-lg font-semibold">
                  {/* 상단에 카테고리명 / 체급명 함께 표기 (표시만) */}
                  {(cat.contestCategoryTitle ||
                    cat.contestCategoryName ||
                    cat.contestCategoryInfo?.name ||
                    "이름 없는 카테고리") +
                    " - " +
                    (grade.contestGradeTitle || "(이름 없는 체급)")}
                </span>
              </div>
            }
            extra={
              <Space wrap>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={() => handleRandomAssign(grade, unassignedSeats)}
                  size={isMobile ? "small" : "middle"}
                >
                  {isMobile ? "랜덤" : "랜덤배정"}
                </Button>
                <Button
                  type="default"
                  icon={<ThunderboltOutlined />}
                  onClick={() => handleAllRandomAssign(grade, allSeats)}
                  size={isMobile ? "small" : "middle"}
                  className="bg-yellow-50 border-yellow-400 text-yellow-700 hover:bg-yellow-100"
                >
                  {isMobile ? "전체" : "모두랜덤"}
                </Button>
                <Button
                  danger
                  icon={<ClearOutlined />}
                  onClick={() => handleResetAssign(grade)}
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
                            handleRemoveAssign(grade, seatNumber);
                          } else {
                            handleSelectJudge(grade, seatNumber, val);
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
                            handleRemoveAssign(grade, seatNumber);
                          } else {
                            handleSelectJudge(grade, seatNumber, val);
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
                              !getAssignedJudgesForGrade(
                                grade.contestGradeId
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

export default GradeAssign;
