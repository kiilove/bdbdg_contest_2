import React, { useMemo } from "react";
import { Card, Tag } from "antd";
import {
  PieChartOutlined,
  ApartmentOutlined,
  TrophyOutlined,
  TeamOutlined,
} from "@ant-design/icons";

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
    const multiPercent = total > 0 ? Math.round((multiCount / total) * 100) : 0;

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

    return regularCats
      .filter((c) => (c.playerCount || 0) > 0)
      .map((c) => {
        const percent =
          totalPlayersInCats > 0
            ? Math.round(((c.playerCount || 0) / totalPlayersInCats) * 100)
            : 0;
        return {
          id: c.contestCategoryId,
          title: c.contestCategoryTitle,
          count: c.playerCount || 0,
          percent,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [categories]);

  // 4. 소속 체육관/팀 Top 5 랭킹
  const topGyms = useMemo(() => {
    const gymMap = {};
    invoices
      .filter((inv) => inv.isPriceCheck && !inv.isCanceled)
      .forEach((inv) => {
        const gym = (inv.playerGym || "무소속 / 개인").trim();
        gymMap[gym] = (gymMap[gym] || 0) + 1;
      });

    return Object.entries(gymMap)
      .map(([gymName, count]) => ({ gymName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [invoices]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. 등록 확정 vs 미등록 비율 카드 */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm mb-3">
            <PieChartOutlined className="text-emerald-500" />
            <span>선수 등록 확정 비율</span>
          </div>

          <div className="flex items-center justify-center my-4">
            <div className="relative w-32 h-32 flex items-center justify-center">
              {/* 원형 시각화 */}
              <div
                className="w-32 h-32 rounded-full border-8 border-slate-100 flex items-center justify-center relative"
                style={{
                  background: `conic-gradient(#10b981 ${registrationStats.confirmedPercent}%, #f59e0b 0)`,
                }}
              >
                <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                  <span className="text-2xl font-black text-slate-800">
                    {registrationStats.confirmedPercent}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">확정률</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              확정 완료 선수:
            </span>
            <span className="font-extrabold text-emerald-600">
              {confirmedPlayersCount}명 ({registrationStats.confirmedPercent}%)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              미확정(미등록) 선수:
            </span>
            <span className="font-extrabold text-amber-600">
              {unconfirmedPlayersCount}명 ({registrationStats.unconfirmedPercent}%)
            </span>
          </div>
        </div>
      </div>

      {/* 2. 단일 vs 다종목 출전자 비율 카드 */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm mb-3">
            <ApartmentOutlined className="text-indigo-500" />
            <span>단일 vs 다종목(중복) 출전 비율</span>
          </div>

          <div className="space-y-4 my-4">
            {/* 단일 출전 바 */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span>1개 종목 출전</span>
                <span className="text-indigo-600">{multiEntryStats.singleCount}명 ({multiEntryStats.singlePercent}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-500 h-3 rounded-full"
                  style={{ width: `${multiEntryStats.singlePercent}%` }}
                />
              </div>
            </div>

            {/* 다종목 출전 바 */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span>2개 이상 다종목 출전</span>
                <span className="text-purple-600">{multiEntryStats.multiCount}명 ({multiEntryStats.multiPercent}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-purple-600 h-3 rounded-full"
                  style={{ width: `${multiEntryStats.multiPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed">
          💡 다종목 출전자가 <strong>{multiEntryStats.multiPercent}%</strong>입니다. 경기 시간표 편성 시 무대 겹침에 유의하세요.
        </div>
      </div>

      {/* 3. 종목별 출전 점유율 Top */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm mb-3">
            <TrophyOutlined className="text-amber-500" />
            <span>종목별 출전 점유율</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {categoryRatios.length > 0 ? (
              categoryRatios.map((cat, idx) => (
                <div key={cat.id || idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 truncate max-w-[130px]">
                      {idx + 1}. {cat.title}
                    </span>
                    <span className="text-slate-500 font-semibold">
                      {cat.count}명 ({cat.percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full"
                      style={{ width: `${cat.percent}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-6 text-center">
                출전 데이터 집계 중
              </div>
            )}
          </div>
        </div>

        <div className="text-[11px] text-slate-400 pt-2 border-t text-right">
          * 그랑프리 제외 정규 종목 기준
        </div>
      </div>

      {/* 4. 최다 출전 소속팀/체육관 Top 랭킹 */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm mb-3">
            <TeamOutlined className="text-rose-500" />
            <span>최다 출전 체육관 / 팀 Top 랭킹</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {topGyms.length > 0 ? (
              topGyms.map((g, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        idx === 0
                          ? "bg-amber-400 text-slate-900"
                          : idx === 1
                          ? "bg-slate-300 text-slate-800"
                          : idx === 2
                          ? "bg-orange-300 text-slate-900"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-800 truncate">
                      {g.gymName}
                    </span>
                  </div>
                  <Tag color={idx < 3 ? "blue" : "default"} className="mr-0 font-bold">
                    {g.count}명
                  </Tag>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-6 text-center">
                소속 데이터 없음
              </div>
            )}
          </div>
        </div>

        <div className="text-[11px] text-slate-400 pt-2 border-t text-right">
          단체상 집계 참고 자료
        </div>
      </div>
    </div>
  );
};

export default AthleteRatioAnalytics;
