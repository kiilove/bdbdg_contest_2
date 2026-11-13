import React, { useState } from "react";
import { Input } from "antd";
import { Search } from "lucide-react";
import { StatusDot } from "../ui/BibTag";

const CategoryGradeStatusGrid = ({
  categories = [],
  savedGradeIds = [],
}) => {
  const [filterQuery, setFilterQuery] = useState("");

  const filteredCategories = categories.filter((cat) => {
    const title = cat.contestCategoryTitle || "";
    if (title.includes("그랑프리")) return false;

    const matchCat = title.toLowerCase().includes(filterQuery.toLowerCase());
    const matchGrade = (cat.grades || []).some((g) =>
      (g.contestGradeTitle || "")
        .toLowerCase()
        .includes(filterQuery.toLowerCase())
    );
    return matchCat || matchGrade;
  });

  return (
    <div className="space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#171717]/[0.08]">
        <div>
          <h3 className="text-[16px] leading-6 font-medium text-[#171717] m-0">
            종목 및 체급별 출전 현황
          </h3>
          <p className="text-xs leading-4 text-[#737373] mt-1 mb-0">
            종목별 출전 인원수와 심사위원장 순위 확정 완료 상태를 확인합니다
          </p>
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="종목명 또는 체급명 검색"
            prefix={
              <Search size={15} strokeWidth={1.5} className="text-[#737373]" />
            }
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            allowClear
          />
        </div>
      </div>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredCategories.map((cat) => {
          const grades = cat.grades || [];
          const totalCategoryPlayers = cat.playerCount || 0;
          const isCategoryEmpty = totalCategoryPlayers === 0;
          const savedInCat = grades.filter((g) =>
            savedGradeIds.includes(g.contestGradeId)
          ).length;

          return (
            <div
              key={cat.contestCategoryId}
              className="rounded-[12px] bg-[#fafafa] border border-[#171717]/[0.08] p-4 flex flex-col justify-between"
            >
              <div>
                {/* Category Header */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#171717]/[0.08]">
                  <span className="text-[14px] leading-5 font-medium text-[#171717] truncate">
                    {cat.contestCategoryTitle}
                  </span>
                  <span
                    className={`font-mono text-xs leading-4 font-medium tabular-nums shrink-0 ${
                      isCategoryEmpty ? "text-[#b45309]" : "text-[#525252]"
                    }`}
                  >
                    총 {totalCategoryPlayers}명
                  </span>
                </div>

                {/* Grades List */}
                <div className="mt-3 space-y-1.5">
                  {grades.map((grade) => {
                    const gradeCount = grade.playerCount || 0;
                    const isGradeEmpty = gradeCount === 0;
                    const isSaved = savedGradeIds.includes(
                      grade.contestGradeId
                    );

                    return (
                      <div
                        key={grade.contestGradeId}
                        className="flex items-center justify-between px-3 py-2 rounded-[8px] bg-white border border-[#171717]/[0.08] text-xs leading-4"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusDot
                            status={
                              isSaved
                                ? "live"
                                : isGradeEmpty
                                ? "warning"
                                : "idle"
                            }
                          />
                          <span
                            className={`truncate ${
                              isGradeEmpty
                                ? "text-[#737373]"
                                : "text-[#171717] font-medium"
                            }`}
                          >
                            {grade.contestGradeTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 tabular-nums">
                          <span
                            className={`font-mono ${
                              isGradeEmpty
                                ? "text-[#b45309]"
                                : "text-[#525252]"
                            }`}
                          >
                            {gradeCount}명
                          </span>
                          {isSaved && (
                            <span className="px-1.5 py-0.5 rounded-[4px] bg-[#16a34a]/[0.08] text-[#16a34a] text-[11px] leading-4 font-medium">
                              확정
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Summary */}
              <div className="mt-3 pt-2.5 border-t border-[#171717]/[0.06] text-xs leading-4 text-[#737373] flex items-center justify-between tabular-nums">
                <span>체급 {grades.length}개</span>
                <span className="font-mono">
                  완료 {savedInCat} / {grades.length}
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
