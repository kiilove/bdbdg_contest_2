import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "antd";
import {
  Search,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ArrowUpRight,
} from "lucide-react";
import { StatusDot } from "../ui/BibTag";

const CategoryGradeStatusGrid = ({
  categories = [],
  savedGradeIds = [],
}) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [viewFilter, setViewFilter] = useState("all"); // all | active | low | empty
  const [expandedGradeIds, setExpandedGradeIds] = useState({});

  const toggleGradeExpand = (gradeId) => {
    setExpandedGradeIds((prev) => ({
      ...prev,
      [gradeId]: !prev[gradeId],
    }));
  };

  const regularCategories = useMemo(
    () =>
      categories.filter((cat) => {
        const title = cat.contestCategoryTitle || "";
        const section = cat.contestCategorySection || "";
        const type = cat.contestCategoryType || "";
        return (
          !title.includes("그랑프리") &&
          !section.includes("그랑프리") &&
          !type.includes("그랑프리")
        );
      }),
    [categories]
  );

  // 전체 체급 중 최대 인원 (분포 막대 스케일 기준)
  const maxGradeTotal = useMemo(() => {
    let max = 1;
    regularCategories.forEach((cat) => {
      (cat.grades || []).forEach((g) => {
        const tot = (g.playerCount || 0) + (g.pendingCount || 0);
        if (tot > max) max = tot;
      });
    });
    return max;
  }, [regularCategories]);

  // 종목별 총원 (확정 + 대기) 상위 요약 바 데이터
  const categorySummaryBars = useMemo(() => {
    const list = regularCategories
      .map((cat) => {
        const confirmed = cat.playerCount || 0;
        const pending = cat.pendingCount || 0;
        const total = confirmed + pending;
        return {
          id: cat.contestCategoryId,
          title: cat.contestCategoryTitle,
          confirmed,
          pending,
          total,
        };
      })
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);

    const maxCat = list[0]?.total || 1;
    const sumAll = list.reduce((acc, c) => acc + c.total, 0);

    return list.map((item) => ({
      ...item,
      widthPct: Math.max(6, Math.round((item.total / maxCat) * 100)),
      sharePct: sumAll > 0 ? Math.round((item.total / sumAll) * 100) : 0,
    }));
  }, [regularCategories]);

  // 필터 카운트 계산
  const filterCounts = useMemo(() => {
    let active = 0;
    let low = 0;
    let empty = 0;

    regularCategories.forEach((cat) => {
      const catTotal = (cat.playerCount || 0) + (cat.pendingCount || 0);
      if (catTotal > 0) active += 1;

      const grades = cat.grades || [];
      const hasLowGrade = grades.some((g) => {
        const tot = (g.playerCount || 0) + (g.pendingCount || 0);
        return tot >= 1 && tot <= 2;
      });
      const hasEmptyGrade =
        grades.length === 0
          ? catTotal === 0
          : grades.some(
              (g) => (g.playerCount || 0) + (g.pendingCount || 0) === 0
            );

      if (hasLowGrade) low += 1;
      if (hasEmptyGrade) empty += 1;
    });

    return {
      all: regularCategories.length,
      active,
      low,
      empty,
    };
  }, [regularCategories]);

  const filteredCategories = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();

    return regularCategories.filter((cat) => {
      const grades = cat.grades || [];
      const catTotal = (cat.playerCount || 0) + (cat.pendingCount || 0);

      if (viewFilter === "active" && catTotal === 0) return false;
      if (viewFilter === "low") {
        const hasLow = grades.some((g) => {
          const tot = (g.playerCount || 0) + (g.pendingCount || 0);
          return tot >= 1 && tot <= 2;
        });
        if (!hasLow) return false;
      }
      if (viewFilter === "empty") {
        const hasEmpty =
          grades.length === 0
            ? catTotal === 0
            : grades.some(
                (g) => (g.playerCount || 0) + (g.pendingCount || 0) === 0
              );
        if (!hasEmpty) return false;
      }

      if (!q) return true;

      const title = (cat.contestCategoryTitle || "").toLowerCase();
      if (title.includes(q)) return true;

      return grades.some((g) => {
        if ((g.contestGradeTitle || "").toLowerCase().includes(q)) return true;
        const allGradeAthletes = [
          ...(g.players || []),
          ...(g.pendingPlayers || []),
        ];
        return allGradeAthletes.some(
          (p) =>
            (p.playerName || "").toLowerCase().includes(q) ||
            (p.playerGym || "").toLowerCase().includes(q)
        );
      });
    });
  }, [regularCategories, viewFilter, filterQuery]);

  const filterTabs = [
    { key: "all", label: "전체 종목", count: filterCounts.all },
    { key: "active", label: "신청 있음", count: filterCounts.active },
    {
      key: "low",
      label: "소수 체급(1~2명 · 통합검토)",
      count: filterCounts.low,
    },
    { key: "empty", label: "0명 미달 포함", count: filterCounts.empty },
  ];

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-[#171717]/[0.08]">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[16px] leading-6 font-semibold text-[#171717] m-0">
              종목 및 체급별 선수 분포
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#525252] font-mono tabular-nums">
              정규 {regularCategories.length}개 종목
            </span>
          </div>
          <p className="text-xs leading-4 text-[#737373] mt-1 mb-0">
            체급을 클릭하면 해당 체급 신청 선수 명단(확정·입금대기)을 바로 확인할 수 있으며, 1~2명 소수 체급은 통합 검토 대상으로 표시됩니다
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-full sm:w-64">
            <Input
              placeholder="종목, 체급, 선수명, 소속 검색"
              prefix={
                <Search size={15} strokeWidth={1.5} className="text-[#737373]" />
              }
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              allowClear
            />
          </div>
          <Link
            to="/contestplayerweighintable"
            className="h-9 px-3 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] border border-[#171717]/[0.08] text-xs font-medium text-[#171717] no-underline inline-flex items-center gap-1 transition-colors duration-150 shrink-0"
          >
            <span>계측 · 체급조정 관리</span>
            <ArrowUpRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      </div>

      {/* 종목별 인원 분포 요약 바 (신청 데이터가 있을 때 상단에 한눈에 표시) */}
      {categorySummaryBars.length > 0 && (
        <div className="rounded-[10px] bg-[#fafafa] border border-[#171717]/[0.08] p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[#171717]">
              종목별 신청 엔트리 비중 (확정 + 입금대기)
            </span>
            <div className="flex items-center gap-3 text-[#737373]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-[2px] bg-[#2563eb]" />
                <span>확정</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-[2px] bg-[#f59e0b]" />
                <span>입금대기</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {categorySummaryBars.map((item) => {
              const confirmedRatio =
                item.total > 0
                  ? Math.round((item.confirmed / item.total) * 100)
                  : 0;
              return (
                <div
                  key={item.id || item.title}
                  className="bg-white rounded-[8px] border border-[#171717]/[0.06] px-3 py-2 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                    <span className="font-medium text-[#171717] truncate">
                      {item.title}
                    </span>
                    <span className="font-mono text-[#525252] shrink-0">
                      {item.confirmed}명
                      {item.pending > 0 ? ` (+${item.pending})` : ""} ·{" "}
                      {item.sharePct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-[3px] bg-[#f4f4f5] overflow-hidden">
                    <div
                      className="h-full flex rounded-[3px] overflow-hidden"
                      style={{ width: `${item.widthPct}%` }}
                    >
                      <div
                        className="bg-[#2563eb] h-full"
                        style={{ width: `${confirmedRatio}%` }}
                      />
                      {item.pending > 0 && (
                        <div
                          className="bg-[#f59e0b] h-full"
                          style={{ width: `${100 - confirmedRatio}%` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 빠른 필터 바 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs text-[#737373] mr-1">
            <SlidersHorizontal size={13} strokeWidth={1.5} />
            <span>분포 필터</span>
          </span>
          {filterTabs.map((tab) => {
            const isSelected = viewFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setViewFilter(tab.key)}
                className={`h-8 px-3 rounded-[8px] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150 ${
                  isSelected
                    ? "bg-[#171717] text-white"
                    : "bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#525252] border border-[#171717]/[0.06]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono tabular-nums ${
                    isSelected ? "text-white/80" : "text-[#737373]"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <span className="text-xs text-[#737373] tabular-nums">
          표시 {filteredCategories.length} / 전체 {regularCategories.length}종목
        </span>
      </div>

      {/* Category Cards Grid */}
      {filteredCategories.length === 0 ? (
        <div className="py-12 text-center rounded-[12px] bg-[#fafafa] border border-[#171717]/[0.08] text-xs text-[#737373]">
          선택한 필터 조건에 해당하는 종목 또는 체급이 없습니다
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const grades = cat.grades || [];
            const confirmedInCat = cat.playerCount || 0;
            const pendingInCat = cat.pendingCount || 0;
            const totalInCat = confirmedInCat + pendingInCat;
            const isCategoryEmpty = totalInCat === 0;
            const nonEmptyGradesCount = grades.filter(
              (g) => (g.playerCount || 0) + (g.pendingCount || 0) > 0
            ).length;

            return (
              <div
                key={cat.contestCategoryId}
                className="rounded-[12px] bg-[#fafafa] border border-[#171717]/[0.08] p-4 flex flex-col justify-between"
              >
                <div>
                  {/* Category Header */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#171717]/[0.08]">
                    <span className="text-[14px] leading-5 font-semibold text-[#171717] truncate">
                      {cat.contestCategoryTitle}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs tabular-nums">
                      <span
                        className={`font-semibold ${
                          isCategoryEmpty ? "text-[#b45309]" : "text-[#171717]"
                        }`}
                      >
                        확정 {confirmedInCat}명
                      </span>
                      {pendingInCat > 0 && (
                        <span className="px-1.5 py-0.5 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] text-[11px] font-medium">
                          +{pendingInCat} 대기
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Grades List with Proportional Bars & Expandable Roster */}
                  <div className="mt-3 space-y-1.5">
                    {grades.map((grade) => {
                      const confirmedCount = grade.playerCount || 0;
                      const pendingCount = grade.pendingCount || 0;
                      const totalGradeCount = confirmedCount + pendingCount;
                      const isGradeEmpty = totalGradeCount === 0;
                      const isLowCount =
                        totalGradeCount >= 1 && totalGradeCount <= 2;
                      const isSaved = savedGradeIds.includes(
                        grade.contestGradeId
                      );
                      const barWidthPct = isGradeEmpty
                        ? 0
                        : Math.max(
                            8,
                            Math.round((totalGradeCount / maxGradeTotal) * 100)
                          );
                      const confirmedSegmentPct =
                        totalGradeCount > 0
                          ? Math.round((confirmedCount / totalGradeCount) * 100)
                          : 0;
                      const isExpanded = Boolean(
                        expandedGradeIds[grade.contestGradeId]
                      );
                      const roster = [
                        ...(grade.players || []).map((p) => ({
                          ...p,
                          _status: "confirmed",
                        })),
                        ...(grade.pendingPlayers || []).map((p) => ({
                          ...p,
                          _status: "pending",
                        })),
                      ];

                      return (
                        <div
                          key={grade.contestGradeId}
                          className="rounded-[8px] bg-white border border-[#171717]/[0.08] overflow-hidden"
                        >
                          <button
                            type="button"
                            disabled={isGradeEmpty}
                            onClick={() =>
                              !isGradeEmpty &&
                              toggleGradeExpand(grade.contestGradeId)
                            }
                            className={`w-full px-3 py-2 text-left transition-colors duration-150 ${
                              isGradeEmpty
                                ? "cursor-default"
                                : "cursor-pointer hover:bg-[#fafafa]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs leading-4">
                              <div className="flex items-center gap-2 min-w-0">
                                <StatusDot
                                  status={
                                    isSaved
                                      ? "live"
                                      : isGradeEmpty
                                      ? "warning"
                                      : "active"
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
                                {isLowCount && (
                                  <span className="px-1.5 py-0.5 rounded-[4px] bg-[#b45309]/[0.08] text-[#b45309] text-[10px] leading-3 font-medium shrink-0">
                                    소수
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                                <span
                                  className={`font-mono font-medium ${
                                    isGradeEmpty
                                      ? "text-[#b45309]"
                                      : "text-[#171717]"
                                  }`}
                                >
                                  {confirmedCount}명
                                </span>
                                {pendingCount > 0 && (
                                  <span className="font-mono text-[11px] text-[#b45309]">
                                    (+{pendingCount})
                                  </span>
                                )}
                                {isSaved && (
                                  <span className="px-1.5 py-0.5 rounded-[4px] bg-[#16a34a]/[0.08] text-[#16a34a] text-[10px] leading-3 font-medium">
                                    순위확정
                                  </span>
                                )}
                                {!isGradeEmpty &&
                                  (isExpanded ? (
                                    <ChevronUp
                                      size={13}
                                      strokeWidth={1.5}
                                      className="text-[#737373]"
                                    />
                                  ) : (
                                    <ChevronDown
                                      size={13}
                                      strokeWidth={1.5}
                                      className="text-[#737373]"
                                    />
                                  ))}
                              </div>
                            </div>

                            {/* 체급별 인원 비례 분포 바 */}
                            <div className="mt-1.5 w-full h-1 rounded-full bg-[#f4f4f5] overflow-hidden">
                              {barWidthPct > 0 && (
                                <div
                                  className="h-full flex rounded-full overflow-hidden"
                                  style={{ width: `${barWidthPct}%` }}
                                >
                                  <div
                                    className="bg-[#2563eb] h-full"
                                    style={{ width: `${confirmedSegmentPct}%` }}
                                  />
                                  {pendingCount > 0 && (
                                    <div
                                      className="bg-[#f59e0b] h-full"
                                      style={{
                                        width: `${100 - confirmedSegmentPct}%`,
                                      }}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          </button>

                          {/* 클릭 시 펼쳐지는 해당 체급 신청 선수 명단 */}
                          {isExpanded && roster.length > 0 && (
                            <div className="px-3 py-2 bg-[#fafafa] border-t border-[#171717]/[0.06] space-y-1">
                              {roster.map((athlete, rIdx) => (
                                <div
                                  key={`${athlete.id || athlete.playerUid}-${rIdx}`}
                                  className="flex items-center justify-between gap-2 text-[11px] leading-4 py-0.5"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono text-[#737373] w-4 shrink-0">
                                      {rIdx + 1}.
                                    </span>
                                    <span className="font-medium text-[#171717] truncate">
                                      {athlete.playerName}
                                    </span>
                                    <span className="text-[#737373] truncate">
                                      · {athlete.playerGym || "무소속"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {athlete.playerTel && (
                                      <span className="font-mono tabular-nums text-[#737373]">
                                        {athlete.playerTel}
                                      </span>
                                    )}
                                    <span
                                      className={`px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium ${
                                        athlete._status === "confirmed"
                                          ? "bg-[#16a34a]/[0.10] text-[#16a34a]"
                                          : "bg-[#b45309]/[0.10] text-[#b45309]"
                                      }`}
                                    >
                                      {athlete._status === "confirmed"
                                        ? "확정"
                                        : "대기"}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Summary */}
                <div className="mt-3 pt-2.5 border-t border-[#171717]/[0.06] text-xs leading-4 text-[#737373] flex items-center justify-between tabular-nums">
                  <span>
                    전체 {grades.length}개 체급 중{" "}
                    <strong className="font-medium text-[#525252]">
                      {nonEmptyGradesCount}개
                    </strong>{" "}
                    접수됨
                  </span>
                  <span className="font-mono">
                    총 신청 {totalInCat}건
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategoryGradeStatusGrid;
