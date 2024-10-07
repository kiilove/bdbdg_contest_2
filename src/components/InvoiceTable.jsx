import React from "react";

const InvoiceTable = ({
  data,
  handleInvoiceModal,
  handleIsPriceCheckUpdate,
}) => (
  <table className="w-full bg-white">
    <thead>
      <tr className="bg-gray-200 h-10">
        <th className="w-1/12 text-center">입금확인</th>
        <th className="text-left w-1/12">이름</th>
        <th className="text-left w-2/12">연락처</th>
        <th className="text-left w-2/12 hidden lg:table-cell">생년월일</th>
        <th className="text-left w-2/12 hidden lg:table-cell">소속</th>
        <th className="text-left w-2/12 hidden lg:table-cell">신청종목</th>
        <th className="text-left w-1/12">참가비용</th>
      </tr>
    </thead>
    <tbody>
      {data.map((item, idx) => {
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
        console.log(item);
        return (
          <tr
            className="border border-t-0 border-x-0"
            key={id}
            style={{ height: "45px" }}
          >
            <td className="text-center">
              <input
                type="checkbox"
                checked={isPriceCheck}
                onChange={(e) =>
                  handleIsPriceCheckUpdate(id, playerUid, e.target.checked)
                }
                disabled={isCanceled}
              />
            </td>
            <td
              className="text-left cursor-pointer"
              onClick={() => handleInvoiceModal(id, item)}
            >
              <span
                className={`${
                  isCanceled ? "line-through text-gray-500" : "underline"
                }`}
              >
                {playerName}
              </span>
            </td>
            <td className="text-left">{playerTel}</td>
            <td className="text-left hidden lg:table-cell">{playerBirth}</td>
            <td className="text-left hidden lg:table-cell">{playerGym}</td>
            <td className="text-left hidden lg:table-cell">
              {joins.map(({ contestCategoryTitle, contestGradeTitle }) => (
                <div key={contestCategoryTitle}>
                  {contestCategoryTitle}({contestGradeTitle})
                </div>
              ))}
            </td>
            <td className="text-left">{contestPriceSum?.toLocaleString()}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

export default InvoiceTable;
