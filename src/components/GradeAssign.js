"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Select, Button, Space, Tag, Tabs, Badge } from "antd";
import {
  UserOutlined,
  PhoneOutlined,
  TeamOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ClearOutlined,
  WarningOutlined,
  AppstoreOutlined,
  PartitionOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";

/**
 * GradeAssign
 * - 체급(grade) 단위로 심판을 배정/제거/랜덤배정
 * - 저장 시 '원본 필드'만 push (부모가 categoryTitle 등 파생 필드 붙임)
 * - 섹션 탭 + 부모 카테고리 선택(필터)
 * - 심판 선택: 이름순 정렬 + 검색 자동완성
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

  // 섹션 탭 / 카테고리 선택 상태
  const [activeSection, setActiveSection] = useState("__ALL__"); // "__ALL__" = 전체, 나머지는 섹션명
  const [selectedCategoryId, setSelectedCategoryId] = useState("__ALL_CAT__");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /** 🔤 이름 정렬 유틸 (ko 로케일, 대소문자 무시) */
  const sortJudgesByName = (arr = []) =>
    [...arr].sort((a, b) =>
      (a?.judgeName || "").localeCompare(b?.judgeName || "", "ko", {
        sensitivity: "base",
        numeric: true,
      })
    );

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

  /** 🧭 섹션 탭 구성 */
  const { sectionNames, sectionTabs } = useMemo(() => {
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
          <span className="flex items-center gap-2">
            <AppstoreOutlined />
            전체
          </span>
        ),
      },
      ...names.map((name) => ({
        key: name,
        label: (
          <span className="flex items-center gap-2">
            <PartitionOutlined />
            {name}
          </span>
        ),
      })),
    ];
    return { sectionNames: names, sectionTabs: items };
  }, [categoriesArray]);

  /** 현재 섹션에 속한 카테고리 목록 (카테고리 선택 박스용) */
  const categoriesInActiveSection = useMemo(() => {
    const list = (categoriesArray || []).filter((c) => {
      const sec = c?.contestCategorySection?.trim() || "미지정";
      return activeSection === "__ALL__" ? true : sec === activeSection;
    });
    // 표시 정렬
    return [...list].sort(
      (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
    );
  }, [categoriesArray, activeSection]);

  /** 섹션/카테고리 필터링된 그레이드 목록 */
  const filteredGrades = useMemo(() => {
    let list = gradesArray || [];
    // 섹션 필터
    if (activeSection !== "__ALL__") {
      list = list.filter((g) => {
        const cat = categoryById[g?.refCategoryId];
        const sec = cat?.contestCategorySection?.trim() || "미지정";
        return sec === activeSection;
      });
    }
    // 카테고리 필터
    if (selectedCategoryId !== "__ALL_CAT__") {
      list = list.filter((g) => g?.refCategoryId === selectedCategoryId);
    }
    return list;
  }, [gradesArray, activeSection, selectedCategoryId, categoryById]);

  // 섹션 바뀌면 카테고리 선택 초기화
  useEffect(() => {
    setSelectedCategoryId("__ALL_CAT__");
  }, [activeSection]);

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      {/* 상단: 섹션 탭 */}
      <Tabs
        activeKey={activeSection}
        onChange={setActiveSection}
        items={sectionTabs.map((tab) => {
          // 탭 우측 뱃지: 그 섹션에 속한 grade 수
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
              <span className="flex items-center gap-2">
                {tab.label}
                <Badge
                  count={count}
                  overflowCount={999}
                  style={{ backgroundColor: "#1677ff" }}
                />
              </span>
            ),
          };
        })}
      />

      {/* 상단: 카테고리 선택 (현재 섹션 내) */}
      <Card size="small" className="shadow-sm">
        <div className="flex items-center gap-3">
          <ApartmentOutlined />
          <span className="text-sm text-gray-700">카테고리</span>
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
              <Select.Option value="__ALL_CAT__">전체</Select.Option>
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
      </Card>

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
          <Card
            key={idx}
            className="shadow-md"
            title={
              <div className="flex items-center gap-2">
                <TeamOutlined className="text-blue-600" />
                <span className="text-lg font-semibold">
                  {(cat.contestCategoryTitle ||
                    cat.contestCategoryName ||
                    cat.contestCategoryInfo?.name ||
                    "이름 없는 카테고리") +
                    " - " +
                    (grade.contestGradeTitle || "(이름 없는 체급)")}
                </span>
                <Tag color="default">
                  섹션: {cat.contestCategorySection?.trim() || "미지정"}
                </Tag>
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

                // 🔤 이 체급에서 선택 가능한 후보 → 이름순 정렬
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
          </Card>
        );
      })}
    </div>
  );
};

export default GradeAssign;
