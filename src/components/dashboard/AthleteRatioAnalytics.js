import React, { useMemo } from "react";
import { BarChart3, Layers, Building2 } from "lucide-react";
import { BibTag } from "../ui/BibTag";

const iconProps = { size: 16, strokeWidth: 1.5 };

const AthleteRatioAnalytics = ({
  confirmedPlayersCount = 0,
  unconfirmedPlayersCount = 0,
  invoices = [],
  categories = [],
}) => {
  // 1. 단일 종목 출전 vs 다종목(2개 이상) 출전자 집계
  const multiEntryStats = useMemo(() => {
    const athleteJoinCounts = {};
    invoices
      .filter((inv) => inv.isPriceCheck && !inv.isCanceled)
      .forEach((inv) => {
        const uid = inv.playerUid || inv.id;
        const joinsCount = inv.joins?.length || 1;
        athleteJoinCounts[uid] = (athleteJoinCounts[uid] || 0) + joinsCount;
      });

    let singleCount = 0;
    let multiCount = 0;
    Object.values(athleteJoinCounts).forEach((count) => {
      if (count === 1) singleCount += 1;
      else if (count >= 2) multiCount += 1;
    });

    const total = singleCount + multiCount;
    const singlePercent = total > 0 ? Math.round((singleCount / total) * 100) : 0;
    const multiPercent = total > 0 ? 100 - singlePercent : 0;

    return { singleCount, multiCount, singlePercent, multiPercent, total };
  }, [invoices]);

  // 2. 등록 확정 vs 미등록 비율
  const registrationStats = useMemo(() => {
    const total = confirmedPlayersCount + unconfirmedPlayersCount;
    const confirmedPercent =
      total > 0 ? Math.round((confirmedPlayersCount / total) * 100) : 0;
    const unconfirmedPercent = total > 0 ? 100 - confirmedPercent : 0;
    return { total, confirmedPercent, unconfirmedPercent };
  }, [confirmedPlayersCount, unconfirmedPlayersCount]);

  // 3. 종목별 출전 점유율 집계 (그랑프리 제외)
  const categoryRatios = useMemo(() => {
    const regularCats = categories.filter((c) => {
      const title = c.contestCategoryTitle || "";
      return !title.includes("그랑프리");
    });

    const totalPlayersInCats = regularCats.reduce(
      (sum, c) => sum + (c.playerCount || 0),
      0
    );

    const sorted = regularCats
      .filter((c) => (c.playerCount || 0) > 0)
      .map((c) => {
        const count = c.playerCount || 0;
        const percent =
          totalPlayersInCats > 0
            ? Math.round((count / totalPlayersInCats) * 100)
            : 0;
        return {
          id: c.contestCategoryId,
          title: c.contestCategoryTitle,
          count,
          percent,
        };
      })
      .sort((a, b) => b.count - a.count);

    const maxCount = sorted[0]?.count || 1;
    return sorted.map((item) => ({
      ...item,
      barWidth: Math.round((item.count / maxCount) * 100),
    }));
  }, [categories]);

  // 4. 소속 체육관/팀 Top 6 랭킹
  const topGyms = useMemo(() => {
    const gymMap = {};
    invoices
      .filter((inv) => inv.isPriceCheck && !inv.isCanceled)
      .forEach((inv) => {
        const gym = (inv.playerGym || "무소속 · 개인").trim();
        gymMap[gym] = (gymMap[gym] || 0) + 1;
      });

    return Object.entries(gymMap)
      .map(([gymName, count]) => ({ gymName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [invoices]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Primary Main Chart (7 cols): 종목별 출전 점유율 */}
      <div className="lg:col-span-7 rounded-[12px] bg-[#fafafa] border border-[#171717]/[0.08] p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#171717]/[0.08]">
            <div className="flex items-center gap-2">
              <BarChart3 {...iconProps} className="text-[#737373]" />
              <h3 className="text-[15px] leading-5 font-medium text-[#171717] m-0">
                종목별 출전 엔트리 분포
              </h3>
            </div>
            <span className="text-xs leading-4 text-[#737373]">
              정규 종목 기준
            </span>
          </div>

          <div className="mt-4 space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {categoryRatios.length > 0 ? (
              categoryRatios.map((cat, idx) => {
                const isLead = idx === 0;
                return (
                  <div
                    key={cat.id || idx}
                    className="rounded-[8px] bg-white border border-[#171717]/[0.08] px-3.5 py-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs leading-4 tabular-nums">
                      <span className="font-medium text-[#171717] truncate">
                        {cat.title}
                      </span>
                      <span className="font-mono text-[#525252] shrink-0">
                        {cat.count}명 · {cat.percent}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-[4px] bg-[#f4f4f5] overflow-hidden">
                      <div
                        className={`h-full rounded-[4px] ${
                          isLead ? "bg-[#2563eb]" : "bg-[#737373]"
                        }`}
                        style={{ width: `${cat.barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[8px] bg-white border border-[#171717]/[0.08] py-12 text-center text-xs leading-4 text-[#737373]">
                집계된 출전 데이터가 없습니다
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#171717]/[0.06] flex items-center justify-between text-xs leading-4 text-[#737373]">
          <span>최다 출전 종목이 코발트 색상으로 강조됩니다</span>
          <span>그랑프리 제외</span>
        </div>
      </div>

      {/* Secondary Column (5 cols): Stacked Shares & Top Gyms */}
      <div className="lg:col-span-5 space-y-4">
        {/* Share Breakdown Card */}
        <div className="rounded-[12px] bg-[#fafafa] border border-[#171717]/[0.08] p-5 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-[#171717]/[0.08]">
            <Layers {...iconProps} className="text-[#737373]" />
            <h3 className="text-[15px] leading-5 font-medium text-[#171717] m-0">
              등록 확정 및 중복 출전 구성
            </h3>
          </div>

          {/* Stacked Bar 1: 등록 확정 비율 */}
          <div className="space-y-2 tabular-nums">
            <div className="flex items-center justify-between text-xs leading-4">
              <span className="font-medium text-[#171717]">선수 등록 확정 비율</span>
              <span className="font-mono text-[#525252]">
                {registrationStats.confirmedPercent}% 확정
              </span>
            </div>
            <div className="w-full h-2.5 rounded-[4px] bg-[#e4e4e7] overflow-hidden flex">
              <div
                className="bg-[#2563eb] h-full"
                style={{ width: `${registrationStats.confirmedPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs leading-4 text-[#737373]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[2px] bg-[#2563eb]" />
                확정 {confirmedPlayersCount}명 ({registrationStats.confirmedPercent}%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[2px] bg-[#d4d4d8]" />
                미확정 {unconfirmedPlayersCount}명 ({registrationStats.unconfirmedPercent}%)
              </span>
            </div>
          </div>

          {/* Stacked Bar 2: 단일 vs 다종목 출전 비율 */}
          <div className="space-y-2 pt-3 border-t border-[#171717]/[0.06] tabular-nums">
            <div className="flex items-center justify-between text-xs leading-4">
              <span className="font-medium text-[#171717]">
                단일 · 다종목(중복) 출전 비율
              </span>
              <span className="font-mono text-[#525252]">
                중복 {multiEntryStats.multiPercent}%
              </span>
            </div>
            <div className="w-full h-2.5 rounded-[4px] bg-[#e4e4e7] overflow-hidden flex">
              <div
                className="bg-[#2563eb] h-full"
                style={{ width: `${multiEntryStats.multiPercent}%` }}
              />
              <div
                className="bg-[#a1a1aa] h-full"
                style={{ width: `${multiEntryStats.singlePercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs leading-4 text-[#737373]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[2px] bg-[#2563eb]" />
                2종목 이상 {multiEntryStats.multiCount}명 ({multiEntryStats.multiPercent}%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[2px] bg-[#a1a1aa]" />
                단일 종목 {multiEntryStats.singleCount}명 ({multiEntryStats.singlePercent}%)
              </span>
            </div>
            <p className="text-xs leading-4 text-[#737373] pt-1 m-0">
              시간표 편성 시 다종목 출전자({multiEntryStats.multiPercent}%)의 무대 간격을 확인하세요
            </p>
          </div>
        </div>

        {/* Top Affiliations Ranked Table Card */}
        <div className="rounded-[12px] bg-[#fafafa] border border-[#171717]/[0.08] p-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#171717]/[0.08]">
            <div className="flex items-center gap-2">
              <Building2 {...iconProps} className="text-[#737373]" />
              <h3 className="text-[15px] leading-5 font-medium text-[#171717] m-0">
                최다 출전 소속 체육관 · 팀
              </h3>
            </div>
            <span className="text-xs leading-4 text-[#737373]">단체상 참고</span>
          </div>

          <div className="mt-3 rounded-[8px] bg-white border border-[#171717]/[0.08] divide-y divide-[#171717]/[0.06]">
            {topGyms.length > 0 ? (
              topGyms.map((g, idx) => (
                <div
                  key={`${g.gymName}-${idx}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-xs leading-4 tabular-nums"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BibTag
                      size="sm"
                      variant={idx === 0 ? "active" : "default"}
                      number={idx + 1}
                    />
                    <span className="font-medium text-[#171717] truncate">
                      {g.gymName}
                    </span>
                  </div>
                  <span className="font-mono text-[#525252] shrink-0">
                    {g.count}명
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs leading-4 text-[#737373]">
                등록된 소속 데이터가 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AthleteRatioAnalytics;
