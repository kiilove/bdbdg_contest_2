import React, { useEffect, useState, useContext, useRef } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import {
  RefreshCw,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const SimpleInvoicesAdmin = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});
  const confirmActionRef = useRef(null);

  const [sortKey, setSortKey] = useState("invoiceCreateAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const openNotice = (config, onConfirm = null) => {
    confirmActionRef.current = onConfirm;
    setModalMessage({ isButton: true, confirmButtonText: "확인", ...config });
    setModalOpen(true);
  };

  const fetchInvoices = async () => {
    if (!currentContest?.contests?.id) return;
    setLoading(true);
    try {
      const colRef = collection(db, "invoices_pool");
      const snapshot = await getDocs(colRef);
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = data.filter(
        (inv) => inv.contestId === currentContest.contests.id
      );
      setInvoices(filtered);
    } catch (err) {
      console.error("참가신청서 불러오기 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    const target = invoices.find((inv) => inv.id === id);
    openNotice(
      {
        variant: "danger",
        title: "참가신청서 영구 삭제",
        body: target?.playerName
          ? `'${target.playerName}' 선수의 참가신청서를 영구 삭제하시겠습니까?`
          : "선택한 참가신청서를 영구 삭제하시겠습니까?",
        body2: "원본 신청서(invoices_pool)에서 즉시 제거되며 복구할 수 없습니다.",
        isCancelButton: true,
        confirmButtonText: "삭제",
        cancelButtonText: "취소",
      },
      async () => {
        setModalOpen(false);
        try {
          await deleteDoc(doc(db, "invoices_pool", id));
          setInvoices((prev) => prev.filter((i) => i.id !== id));
          openNotice({
            variant: "success",
            title: "삭제 완료",
            body: "참가신청서가 삭제되었습니다.",
          });
        } catch (err) {
          console.error(err);
          openNotice({
            variant: "error",
            title: "삭제 오류",
            body: "참가신청서 삭제 중 오류가 발생했습니다.",
          });
        }
      }
    );
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sortedInvoices = [...invoices].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    if (sortKey === "invoiceCreateAt") {
      valA = new Date(valA);
      valB = new Date(valB);
    }

    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests?.id]);

  const renderSortIcon = (key) => {
    if (sortKey !== key) {
      return <ArrowUpDown size={13} strokeWidth={1.5} className="text-[#737373]" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp size={13} strokeWidth={1.5} className="text-[#2563eb]" />
    ) : (
      <ArrowDown size={13} strokeWidth={1.5} className="text-[#2563eb]" />
    );
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <ConfirmationModal
        isOpen={modalOpen}
        message={modalMessage}
        onCancel={() => {
          confirmActionRef.current = null;
          setModalOpen(false);
        }}
        onConfirm={() => {
          const fn = confirmActionRef.current;
          confirmActionRef.current = null;
          if (fn) {
            fn();
          } else {
            setModalOpen(false);
          }
        }}
      />
      <div className="max-w-[1440px] mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              참가신청서 수동 관리
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              {currentContest?.contestInfo?.contestTitle || "선택된 대회 없음"} ·
              접수된 원본 신청서를 조회하고 삭제합니다
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-mono tabular-nums text-[#737373]">
              총 {invoices.length}건
            </span>
            <button
              type="button"
              onClick={fetchInvoices}
              disabled={loading}
              className="h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <RefreshCw
                size={15}
                strokeWidth={1.5}
                className={`text-[#525252] ${loading ? "animate-spin" : ""}`}
              />
              <span>새로고침</span>
            </button>
          </div>
        </header>

        <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-[13px] text-[#737373]">
              신청서 목록을 불러오는 중입니다
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-[13px] text-[#737373]">
              해당 대회에 접수된 신청서가 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="bg-[#f4f4f5] text-[#525252] border-b border-[#171717]/[0.08] h-10 select-none">
                    <th
                      className="px-3 font-medium cursor-pointer hover:text-[#171717] w-16"
                      onClick={() => handleSort("index")}
                    >
                      <span className="inline-flex items-center gap-1">
                        순번 {renderSortIcon("index")}
                      </span>
                    </th>
                    <th
                      className="px-3 font-medium cursor-pointer hover:text-[#171717]"
                      onClick={() => handleSort("invoiceCreateAt")}
                    >
                      <span className="inline-flex items-center gap-1">
                        접수일자 {renderSortIcon("invoiceCreateAt")}
                      </span>
                    </th>
                    <th
                      className="px-3 font-medium cursor-pointer hover:text-[#171717]"
                      onClick={() => handleSort("playerName")}
                    >
                      <span className="inline-flex items-center gap-1">
                        이름 {renderSortIcon("playerName")}
                      </span>
                    </th>
                    <th
                      className="px-3 font-medium cursor-pointer hover:text-[#171717]"
                      onClick={() => handleSort("playerGender")}
                    >
                      <span className="inline-flex items-center gap-1">
                        성별 {renderSortIcon("playerGender")}
                      </span>
                    </th>
                    <th
                      className="px-3 font-medium cursor-pointer hover:text-[#171717]"
                      onClick={() => handleSort("playerTel")}
                    >
                      <span className="inline-flex items-center gap-1">
                        연락처 {renderSortIcon("playerTel")}
                      </span>
                    </th>
                    <th
                      className="px-3 font-medium cursor-pointer hover:text-[#171717]"
                      onClick={() => handleSort("playerGym")}
                    >
                      <span className="inline-flex items-center gap-1">
                        소속 {renderSortIcon("playerGym")}
                      </span>
                    </th>
                    <th className="px-3 font-medium">참가 종목 및 체급</th>
                    <th
                      className="px-3 font-medium text-center cursor-pointer hover:text-[#171717]"
                      onClick={() => handleSort("invoiceEdited")}
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        수정 {renderSortIcon("invoiceEdited")}
                      </span>
                    </th>
                    <th
                      className="px-3 font-medium text-center cursor-pointer hover:text-[#171717]"
                      onClick={() => handleSort("isCanceled")}
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        취소 {renderSortIcon("isCanceled")}
                      </span>
                    </th>
                    <th
                      className="px-3 font-medium text-center cursor-pointer hover:text-[#171717]"
                      onClick={() => handleSort("isPriceCheck")}
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        입금 {renderSortIcon("isPriceCheck")}
                      </span>
                    </th>
                    <th className="px-3 font-medium text-center w-16">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171717]/[0.06]">
                  {sortedInvoices.map((inv, idx) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-[#f4f4f5]/50 transition-colors duration-150"
                    >
                      <td className="px-3 py-2.5 font-mono text-[12px] tabular-nums text-[#737373]">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] tabular-nums text-[#525252]">
                        {inv.invoiceCreateAt || "-"}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-[#171717]">
                        {inv.playerName || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-[#525252]">
                        {inv.playerGender === "m" ? "남" : "여"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] tabular-nums text-[#525252]">
                        {inv.playerTel || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-[#525252]">
                        {inv.playerGym || "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {inv.joins?.map((j, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[12px] text-[#171717]"
                            >
                              {j.contestCategoryTitle}
                              <span className="text-[#737373] ml-1">
                                · {j.contestGradeTitle}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-[12px] text-[#525252]">
                        {inv.invoiceEdited ? "수정됨" : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {inv.isCanceled ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#dc2626]/[0.08] text-[#dc2626]">
                            취소
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#737373]">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {inv.isPriceCheck ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#16a34a]/[0.08] text-[#16a34a]">
                            완료
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#f4f4f5] text-[#737373]">
                            대기
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(inv.id)}
                          aria-label="신청서 삭제"
                          className="h-8 w-8 rounded-[6px] inline-flex items-center justify-center text-[#dc2626] hover:bg-[#dc2626]/[0.08] transition-colors duration-150"
                        >
                          <Trash2 size={15} strokeWidth={1.5} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SimpleInvoicesAdmin;
