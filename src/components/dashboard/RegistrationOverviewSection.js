import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Checkbox, Empty } from "antd";
import {
  ClipboardList,
  Phone,
  ArrowUpRight,
  UserPlus,
  Building2,
  Layers,
} from "lucide-react";
import { BibTag } from "../ui/BibTag";

const RegistrationOverviewSection = ({
  invoices = [],
  onPriceCheckUpdate,
  isUpdatingId = null,
}) => {
  const unconfirmedList = useMemo(
    () =>
      invoices
        .filter(
          (inv) =>
            !inv.isPriceCheck &&
            !inv.isCanceled &&
            inv.playerName &&
            inv.playerName !== "이름 없음"
        )
        .sort((a, b) =>
          String(b.invoiceCreateAt || "").localeCompare(
            String(a.invoiceCreateAt || "")
          )
        ),
    [invoices]
  );

  const [feedMode, setFeedMode] = useState(
    unconfirmedList.length > 0 ? "unconfirmed" : "recent"
  );

  const summary = useMemo(() => {
    let confirmed = 0;
    let unconfirmed = 0;
    let canceled = 0;
    let confirmedFee = 0;
    let unconfirmedFee = 0;
    let webCount = 0;
    let manualCount = 0;

    const athleteJoins = {};
    const gymCounts = {};
    const dailyMap = {};

    invoices.forEach((inv) => {
      const fee = Number(inv.contestPriceSum) || 0;
      if (inv.isCanceled) {
        canceled += 1;
        return;
      }

      if (inv.createBy === "manual") manualCount += 1;
      else webCount += 1;

      const dateKey = String(inv.invoiceCreateAt || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        dailyMap[dateKey] = (dailyMap[dateKey] || 0) + 1;
      }

      const uid = inv.playerUid || inv.id;
      athleteJoins[uid] = (athleteJoins[uid] || 0) + (inv.joins?.length || 1);

      const gym = (inv.playerGym || "무소속 · 개인").trim() || "무소속 · 개인";
      gymCounts[gym] = (gymCounts[gym] || 0) + 1;

      if (inv.isPriceCheck) {
        confirmed += 1;
        confirmedFee += fee;
      } else {
        unconfirmed += 1;
        unconfirmedFee += fee;
      }
    });

    let singleCount = 0;
    let multiCount = 0;
    Object.values(athleteJoins).forEach((cnt) => {
      if (cnt >= 2) multiCount += 1;
      else singleCount += 1;
    });

    const totalAll = confirmed + unconfirmed + canceled;
    const confirmedPct = totalAll > 0 ? Math.round((confirmed / totalAll) * 100) : 0;
    const unconfirmedPct =
      totalAll > 0 ? Math.round((unconfirmed / totalAll) * 100) : 0;
    const canceledPct =
      totalAll > 0 ? Math.max(0, 100 - confirmedPct - unconfirmedPct) : 0;

    const topGyms = Object.entries(gymCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recentDays = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, count]) => ({
        date: date.slice(5),
        fullDate: date,
        count,
      }));
    const maxDaily = Math.max(1, ...recentDays.map((d) => d.count));

    return {
      confirmed,
      unconfirmed,
      canceled,
      totalActive: confirmed + unconfirmed,
      totalAll,
      confirmedFee,
      unconfirmedFee,
      confirmedPct,
      unconfirmedPct,
      canceledPct,
      webCount,
      manualCount,
      singleCount,
      multiCount,
      topGyms,
      recentDays,
      maxDaily,
    };
  }, [invoices]);

  const recentAllList = useMemo(
    () =>
      [...invoices]
        .filter((inv) => inv.playerName && inv.playerName !== "이름 없음")
        .sort((a, b) =>
          String(b.invoiceCreateAt || "").localeCompare(
            String(a.invoiceCreateAt || "")
          )
        ),
    [invoices]
  );

  const effectiveMode =
    feedMode === "unconfirmed" && unconfirmedList.length === 0 && recentAllList.length > 0
      ? "recent"
      : feedMode;

  const displayedInvoices =
    effectiveMode === "unconfirmed"
      ? unconfirmedList.slice(0, 8)
      : recentAllList.slice(0, 8);

  return (
    <section
      aria-label="접수 현황 및 입금 확인 관리"
      className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
    >
      {/* Left 5 Cols: 접수 파이프라인 · 출전 구성 · 소속 요약 */}
      <div className="lg:col-span-5 bg-white rounded-[12px] border border-[#171717]/[0.08] p-5 flex flex-col justify-between space-y-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#171717]/[0.08]">
            <div className="flex items-center gap-2">
              <Layers size={16} strokeWidth={1.5} className="text-[#737373]" />
              <h2 className="text-[15px] leading-5 font-semibold text-[#171717] m-0">
                접수 파이프라인 및 신청 구성
              </h2>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#737373]">
              총 {summary.totalAll}건
            </span>
          </div>

          {/* 접수 상태 파이프라인 바 */}
          <div className="space-y-2">
            <div className="w-full h-3 rounded-[6px] bg-[#f4f4f5] overflow-hidden flex">
              {summary.confirmed > 0 && (
                <div
                  className="bg-[#2563eb] h-full transition-all duration-200"
                  style={{ width: `${summary.confirmedPct}%` }}
                  title={`확정 ${summary.confirmed}건`}
                />
              )}
              {summary.unconfirmed > 0 && (
                <div
                  className="bg-[#f59e0b] h-full transition-all duration-200"
                  style={{ width: `${summary.unconfirmedPct}%` }}
                  title={`입금 대기 ${summary.unconfirmed}건`}
                />
              )}
              {summary.canceled > 0 && (
                <div
                  className="bg-[#d4d4d8] h-full transition-all duration-200"
                  style={{ width: `${summary.canceledPct}%` }}
                  title={`취소 ${summary.canceled}건`}
                />
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.06] p-2.5">
                <div className="flex items-center gap-1.5 text-xs text-[#525252]">
                  <span className="w-2 h-2 rounded-[2px] bg-[#2563eb]" />
                  <span>입금 확정</span>
                </div>
                <div className="mt-1 font-mono tabular-nums text-[15px] font-semibold text-[#171717]">
                  {summary.confirmed}건
                </div>
                <div className="text-[11px] font-mono tabular-nums text-[#737373] truncate">
                  {summary.confirmedFee.toLocaleString()}원
                </div>
              </div>

              <div className="rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.06] p-2.5">
                <div className="flex items-center gap-1.5 text-xs text-[#525252]">
                  <span className="w-2 h-2 rounded-[2px] bg-[#f59e0b]" />
                  <span>미확정 대기</span>
                </div>
                <div className="mt-1 font-mono tabular-nums text-[15px] font-semibold text-[#b45309]">
                  {summary.unconfirmed}건
                </div>
                <div className="text-[11px] font-mono tabular-nums text-[#737373] truncate">
                  {summary.unconfirmedFee.toLocaleString()}원
                </div>
              </div>

              <div className="rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.06] p-2.5">
                <div className="flex items-center gap-1.5 text-xs text-[#525252]">
                  <span className="w-2 h-2 rounded-[2px] bg-[#d4d4d8]" />
                  <span>접수 취소</span>
                </div>
                <div className="mt-1 font-mono tabular-nums text-[15px] font-semibold text-[#525252]">
                  {summary.canceled}건
                </div>
                <div className="text-[11px] text-[#737373] truncate">
                  유효 제외
                </div>
              </div>
            </div>
          </div>

          {/* 중복 출전 & 접수 경로 요약 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.06] px-3 py-2.5 flex items-center justify-between text-xs">
              <span className="text-[#525252]">다종목(중복) 신청</span>
              <span className="font-mono tabular-nums font-medium text-[#171717]">
                {summary.multiCount}명 / 단일 {summary.singleCount}명
              </span>
            </div>
            <div className="rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.06] px-3 py-2.5 flex items-center justify-between text-xs">
              <span className="text-[#525252]">온라인 · 수동 접수</span>
              <span className="font-mono tabular-nums font-medium text-[#171717]">
                웹 {summary.webCount} · 수동 {summary.manualCount}
              </span>
            </div>
          </div>

          {/* 최근 일자별 접수 추이 */}
          {summary.recentDays.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs text-[#525252]">
                <span className="font-medium">최근 일자별 접수 추이</span>
                <span className="text-[11px] text-[#737373]">유효 신청 기준</span>
              </div>
              <div className="grid grid-cols-7 gap-1.5 items-end h-20 pt-2 px-2.5 pb-2 rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.06]">
                {summary.recentDays.map((d) => {
                  const heightPct = Math.max(
                    16,
                    Math.round((d.count / summary.maxDaily) * 100)
                  );
                  return (
                    <div
                      key={d.fullDate}
                      className="flex flex-col items-center justify-end h-full gap-1"
                      title={`${d.fullDate}: ${d.count}건`}
                    >
                      <span className="text-[10px] font-mono tabular-nums text-[#525252] leading-none">
                        {d.count}
                      </span>
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className="w-full rounded-[3px] bg-[#2563eb]/85"
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-[#737373] leading-none">
                        {d.date}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 소속 체육관 Top 5 */}
        <div className="pt-3 border-t border-[#171717]/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#525252]">
              <Building2 size={14} strokeWidth={1.5} className="text-[#737373]" />
              <span>최다 신청 소속 체육관 · 팀</span>
            </span>
            <span className="text-[11px] text-[#737373]">단체 출전 현황</span>
          </div>
          {summary.topGyms.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {summary.topGyms.map((g, idx) => (
                <span
                  key={`${g.name}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#fafafa] border border-[#171717]/[0.08] text-xs"
                >
                  <BibTag
                    size="sm"
                    variant={idx === 0 ? "active" : "default"}
                    number={idx + 1}
                  />
                  <span className="text-[#171717] font-medium truncate max-w-[128px]">
                    {g.name}
                  </span>
                  <span className="font-mono tabular-nums text-[#525252]">
                    {g.count}명
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[#737373]">접수된 소속 정보가 없습니다</div>
          )}
        </div>
      </div>

      {/* Right 7 Cols: 미확정 입금 대기 빠른 승인 & 최근 접수 피드 */}
      <div className="lg:col-span-7 bg-white rounded-[12px] border border-[#171717]/[0.08] p-5 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#171717]/[0.08]">
            <div className="flex items-center gap-2 flex-wrap">
              <ClipboardList
                size={16}
                strokeWidth={1.5}
                className="text-[#737373]"
              />
              <h2 className="text-[15px] leading-5 font-semibold text-[#171717] m-0">
                참가 접수 내역 및 빠른 입금 확인
              </h2>
              <div className="inline-flex items-center p-0.5 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.06] ml-1">
                <button
                  type="button"
                  onClick={() => setFeedMode("unconfirmed")}
                  className={`h-7 px-2.5 rounded-[6px] text-xs font-medium cursor-pointer transition-colors duration-150 inline-flex items-center gap-1.5 ${
                    effectiveMode === "unconfirmed"
                      ? "bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "bg-transparent text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  <span>미확정 대기</span>
                  <span
                    className={`font-mono tabular-nums ${
                      unconfirmedList.length > 0
                        ? "text-[#b45309] font-semibold"
                        : "text-[#737373]"
                    }`}
                  >
                    {unconfirmedList.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeedMode("recent")}
                  className={`h-7 px-2.5 rounded-[6px] text-xs font-medium cursor-pointer transition-colors duration-150 inline-flex items-center gap-1.5 ${
                    effectiveMode === "recent"
                      ? "bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "bg-transparent text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  <span>최근 전체</span>
                  <span className="font-mono tabular-nums text-[#737373]">
                    {recentAllList.length}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/contestnewinvoicemanual"
                className="h-8 px-2.5 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] border border-[#171717]/[0.08] text-xs font-medium text-[#171717] no-underline inline-flex items-center gap-1.5 transition-colors duration-150"
              >
                <UserPlus size={14} strokeWidth={1.5} className="text-[#525252]" />
                <span>수동 접수</span>
              </Link>
              <Link
                to="/contestinvoicetable"
                className="h-8 px-3 rounded-[8px] bg-[#171717] hover:bg-[#262626] text-xs font-medium text-white no-underline inline-flex items-center gap-1 transition-colors duration-150"
              >
                <span>신청서 전체 관리</span>
                <ArrowUpRight size={14} strokeWidth={1.5} />
              </Link>
            </div>
          </div>

          {/* 접수 목록 테이블 */}
          {displayedInvoices.length === 0 ? (
            <div className="py-12 rounded-[8px] border border-[#171717]/[0.06] bg-[#fafafa]">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  effectiveMode === "unconfirmed"
                    ? "미확정 대기 중인 신청서가 없습니다"
                    : "접수된 참가신청서가 없습니다"
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[8px] border border-[#171717]/[0.08]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] text-[#525252] h-9">
                    <th className="px-3 w-16 text-center font-medium">입금확인</th>
                    <th className="px-3 w-36 font-medium">선수 · 소속</th>
                    <th className="px-3 font-medium">신청 종목 · 체급</th>
                    <th className="px-3 w-24 text-right font-medium">참가비</th>
                    <th className="px-3 w-28 text-right font-medium hidden sm:table-cell">
                      접수일시
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171717]/[0.06]">
                  {displayedInvoices.map((inv) => {
                    const isBusy = isUpdatingId === inv.id;
                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-[#fafafa] transition-colors duration-150"
                      >
                        <td className="px-3 py-2.5 text-center">
                          <Checkbox
                            checked={Boolean(inv.isPriceCheck)}
                            disabled={Boolean(inv.isCanceled) || isBusy}
                            onChange={(e) =>
                              onPriceCheckUpdate(
                                inv.id,
                                inv.playerUid,
                                e.target.checked
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[13px] font-medium ${
                                inv.isCanceled
                                  ? "line-through text-[#737373]"
                                  : "text-[#171717]"
                              }`}
                            >
                              {inv.playerName}
                            </span>
                            {inv.isCanceled ? (
                              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.08] text-[#dc2626] text-[10px] font-medium">
                                취소
                              </span>
                            ) : inv.isPriceCheck ? (
                              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#16a34a]/[0.08] text-[#16a34a] text-[10px] font-medium">
                                확정
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] text-[10px] font-medium">
                                대기
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[#737373] mt-0.5">
                            <span className="truncate max-w-[110px]">
                              {inv.playerGym || "무소속"}
                            </span>
                            {inv.playerTel && (
                              <a
                                href={`tel:${inv.playerTel}`}
                                className="inline-flex items-center gap-0.5 font-mono tabular-nums text-[#525252] hover:text-[#2563eb] no-underline"
                              >
                                <Phone size={10} strokeWidth={1.5} />
                                <span>{inv.playerTel}</span>
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(inv.joins || []).map((j, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.06] text-[#171717]"
                              >
                                <span>{j.contestCategoryTitle}</span>
                                <span className="text-[#737373] ml-1">
                                  ({j.contestGradeTitle})
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums font-medium text-[#171717]">
                          {Number(inv.contestPriceSum || 0).toLocaleString()}원
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#737373] hidden sm:table-cell">
                          {inv.invoiceCreateAt
                            ? String(inv.invoiceCreateAt)
                                .slice(5, 16)
                                .replace("T", " ")
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-[#171717]/[0.06] flex items-center justify-between text-xs text-[#737373]">
          <span>
            입금확인 체크 시 출전 선수 명단과 입금 처리 로그에 즉시 반영됩니다
          </span>
          <Link
            to="/contestinvoicetable"
            className="text-[#2563eb] hover:underline font-medium no-underline shrink-0"
          >
            상세 신청서/유료서비스 보기 →
          </Link>
        </div>
      </div>
    </section>
  );
};

export default RegistrationOverviewSection;
