import React from "react";

const InvoiceTable = ({
  data,
  handleInvoiceModal,
  handleIsPriceCheckUpdate,
}) => (
  <div className="overflow-x-auto border border-[#171717]/[0.08] rounded-[8px] bg-white">
    <table className="w-full text-left text-[13px] border-collapse">
      <thead>
        <tr className="bg-[#f4f4f5] text-[#525252] border-b border-[#171717]/[0.08] h-10">
          <th className="w-24 px-3 text-center font-medium">입금확인</th>
          <th className="w-28 px-3 font-medium">이름</th>
          <th className="w-36 px-3 font-medium">연락처</th>
          <th className="w-32 px-3 font-medium hidden lg:table-cell">생년월일</th>
          <th className="w-40 px-3 font-medium hidden lg:table-cell">소속</th>
          <th className="px-3 font-medium hidden lg:table-cell">신청 종목</th>
          <th className="w-32 px-3 text-right font-medium">참가비</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#171717]/[0.06]">
        {!data || data.length === 0 ? (
          <tr>
            <td
              colSpan={7}
              className="px-4 py-12 text-center text-[13px] text-[#737373]"
            >
              조건에 해당하는 참가신청서가 없습니다
            </td>
          </tr>
        ) : (
          data.map((item) => {
            const {
              id,
              playerUid,
              playerName,
              playerTel,
              playerBirth,
              playerGym,
              isPriceCheck,
              isCanceled,
              joins,
              contestPriceSum,
            } = item;

            return (
              <tr
                key={id}
                className="min-h-[44px] hover:bg-[#f4f4f5]/50 transition-colors duration-150"
              >
                <td className="px-3 py-2.5 text-center">
                  <div className="inline-flex items-center justify-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(isPriceCheck)}
                      onChange={(e) =>
                        handleIsPriceCheckUpdate(
                          id,
                          playerUid,
                          e.target.checked
                        )
                      }
                      disabled={isCanceled}
                      className="w-4 h-4 rounded-[4px] accent-[#2563eb] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </div>
                </td>
                <td
                  className="px-3 py-2.5 cursor-pointer"
                  onClick={() => handleInvoiceModal(id, item)}
                >
                  <div className="inline-flex items-center gap-2">
                    <span
                      className={`font-medium transition-colors duration-150 ${
                        isCanceled
                          ? "line-through text-[#737373]"
                          : "text-[#171717] hover:text-[#2563eb] underline decoration-[#171717]/25 underline-offset-4"
                      }`}
                    >
                      {playerName || "-"}
                    </span>
                    {isCanceled ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#dc2626]/[0.08] text-[#dc2626]">
                        취소
                      </span>
                    ) : isPriceCheck ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#16a34a]/[0.08] text-[#16a34a]">
                        확정
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-[13px] tabular-nums text-[#525252]">
                  {playerTel || "-"}
                </td>
                <td className="px-3 py-2.5 font-mono text-[13px] tabular-nums text-[#525252] hidden lg:table-cell">
                  {playerBirth || "-"}
                </td>
                <td className="px-3 py-2.5 text-[#525252] hidden lg:table-cell">
                  {playerGym || "-"}
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {(joins || []).map(
                      ({ contestCategoryTitle, contestGradeTitle }, jIdx) => (
                        <span
                          key={`${contestCategoryTitle}-${jIdx}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[12px] text-[#171717]"
                        >
                          {contestCategoryTitle}
                          <span className="text-[#737373] ml-1">
                            · {contestGradeTitle}
                          </span>
                        </span>
                      )
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] font-medium tabular-nums text-[#171717]">
                  {contestPriceSum !== undefined && contestPriceSum !== null
                    ? `${Number(contestPriceSum).toLocaleString()}원`
                    : "0원"}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
);

export default InvoiceTable;
