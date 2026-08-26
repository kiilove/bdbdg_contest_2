import React, { useState } from "react";
import { Tag, Input, Badge } from "antd";
import {
  TrophyOutlined,
  SearchOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
} from "@ant-design/icons";

const CategoryGradeStatusGrid = ({
  categories = [],
  savedGradeIds = [],
}) => {
  const [filterQuery, setFilterQuery] = useState("");

  const filteredCategories = categories.filter((cat) => {
    const title = cat.contestCategoryTitle || "";
    const isGrandPrix = title.includes("그랑프리");
    if (isGrandPrix) return false; // 그랑프리 제외

    const matchCat = title.toLowerCase().includes(filterQuery.toLowerCase());
    const matchGrade = (cat.grades || []).some((g) =>
      (g.contestGradeTitle || "").toLowerCase().includes(filterQuery.toLowerCase())
    );
    return matchCat || matchGrade;
  });

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      {/* 상단 검색 & 필터 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-base font-black text-slate-800 m-0">
            종목 및 체급별 출전 현황 (심사 완료율)
          </h3>
          <p className="text-xs text-slate-500 m-0">
            각 종목별 체급 출전 인원수와 심사위원장 순위 확정 완료 상태를 한눈에 확인합니다.
          </p>
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="종목명, 체급명 검색..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            allowClear
            size="small"
            className="rounded-lg"
          />
        </div>
      </div>

      {/* 카테고리 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredCategories.map((cat) => {
          const grades = cat.grades || [];
          const totalCategoryPlayers = cat.playerCount || 0;
          const isCategoryEmpty = totalCategoryPlayers === 0;

          return (
            <div
              key={cat.contestCategoryId}
              className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
                isCategoryEmpty
                  ? "bg-amber-50/40 border-amber-200"
                  : "bg-slate-50/60 border-slate-200 hover:border-blue-300 hover:shadow-sm"
              }`}
            >
              <div>
                {/* 카테고리 헤더 */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <TrophyOutlined className="text-blue-600 text-base" />
                    <span className="font-extrabold text-slate-800 text-sm">
                      {cat.contestCategoryTitle}
                    </span>
                  </div>
                  <Tag
                    color={isCategoryEmpty ? "orange" : "blue"}
                    className="font-bold text-xs mr-0 rounded-md"
                  >
                    총 {totalCategoryPlayers}명
                  </Tag>
                </div>

                {/* 체급 목록 */}
                <div className="mt-3 space-y-1.5">
                  {grades.map((grade) => {
                    const gradeCount = grade.playerCount || 0;
                    const isGradeEmpty = gradeCount === 0;
                    const isSaved = savedGradeIds.includes(grade.contestGradeId);

                    return (
                      <div
                        key={grade.contestGradeId}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs border ${
                          isSaved
                            ? "bg-emerald-50/80 border-emerald-200 text-emerald-950 font-bold"
                            : isGradeEmpty
                            ? "bg-white border-amber-200 text-amber-900"
                            : "bg-white border-slate-200 text-slate-700 font-medium"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isSaved ? (
                            <CheckCircleFilled className="text-emerald-500 text-sm" />
                          ) : (
                            <ClockCircleFilled className="text-slate-300 text-sm" />
                          )}
                          <span className={isSaved ? "font-bold text-emerald-900" : ""}>
                            {grade.contestGradeTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-black ${
                              isGradeEmpty
                                ? "text-amber-600"
                                : isSaved
                                ? "text-emerald-700"
                                : "text-slate-800"
                            }`}
                          >
                            {gradeCount}명
                          </span>
                          {isSaved && (
                            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-black">
                              확정
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 하단 요약 */}
              <div className="mt-3 pt-2 text-[11px] text-slate-400 flex items-center justify-between">
                <span>체급 수: {grades.length}개</span>
                <span>
                  완료:{" "}
                  {grades.filter((g) => savedGradeIds.includes(g.contestGradeId)).length}{" "}
                  / {grades.length}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryGradeStatusGrid;
