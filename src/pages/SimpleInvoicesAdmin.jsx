import React, { useEffect, useState, useContext } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { BsTrash } from "react-icons/bs";

const SimpleInvoicesAdmin = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔹 정렬 상태
  const [sortKey, setSortKey] = useState("invoiceCreateAt");
  const [sortOrder, setSortOrder] = useState("desc"); // asc | desc

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
      console.error("❌ 참가신청서 불러오기 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deleteDoc(doc(db, "invoices_pool", id));
      setInvoices((prev) => prev.filter((i) => i.id !== id));
      alert("삭제되었습니다.");
    } catch (err) {
      console.error(err);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  // 🔹 정렬 클릭 시 처리
  const handleSort = (key) => {
    if (sortKey === key) {
      // 동일 키 클릭 → 정렬 방향 반전
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  // 🔹 정렬된 데이터 생성
  const sortedInvoices = [...invoices].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    // 접수일자는 문자열을 Date로 변환
    if (sortKey === "invoiceCreateAt") {
      valA = new Date(valA);
      valB = new Date(valB);
    }

    // 문자열 비교
    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  useEffect(() => {
    fetchInvoices();
  }, [currentContest?.contests?.id]);

  const renderSortIcon = (key) => {
    if (sortKey !== key) return "↕️";
    return sortOrder === "asc" ? "▲" : "▼";
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          참가신청서 수동 관리 (
          {currentContest?.contestInfo?.contestTitle || "대회 선택"})
        </h2>
        <button
          onClick={fetchInvoices}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          🔄 새로고침
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">불러오는 중...</p>
      ) : invoices.length === 0 ? (
        <p className="text-gray-500">해당 대회에 접수된 신청서가 없습니다.</p>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="table-auto w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => handleSort("index")}
                >
                  순번 {renderSortIcon("index")}
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => handleSort("invoiceCreateAt")}
                >
                  접수일자 {renderSortIcon("invoiceCreateAt")}
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => handleSort("playerName")}
                >
                  이름 {renderSortIcon("playerName")}
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => handleSort("playerGender")}
                >
                  성별 {renderSortIcon("playerGender")}
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => handleSort("playerTel")}
                >
                  연락처 {renderSortIcon("playerTel")}
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => handleSort("playerGym")}
                >
                  소속 {renderSortIcon("playerGym")}
                </th>
                <th className="p-2 border">참가 종목/체급</th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => handleSort("invoiceEdited")}
                >
                  수정됨 {renderSortIcon("invoiceEdited")}
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => handleSort("isCanceled")}
                >
                  취소됨 {renderSortIcon("isCanceled")}
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => handleSort("isPriceCheck")}
                >
                  입금확인 {renderSortIcon("isPriceCheck")}
                </th>
                <th className="p-2 border text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {sortedInvoices.map((inv, idx) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="p-2 border text-center">{idx + 1}</td>
                  <td className="p-2 border">{inv.invoiceCreateAt || "-"}</td>
                  <td className="p-2 border">{inv.playerName}</td>
                  <td className="p-2 border">
                    {inv.playerGender === "m" ? "남" : "여"}
                  </td>
                  <td className="p-2 border">{inv.playerTel}</td>
                  <td className="p-2 border">{inv.playerGym}</td>
                  <td className="p-2 border">
                    {inv.joins?.map((j, i) => (
                      <div key={i}>
                        {j.contestCategoryTitle} ({j.contestGradeTitle})
                      </div>
                    ))}
                  </td>
                  <td className="p-2 border text-center">
                    {inv.invoiceEdited ? "예" : "아니오"}
                  </td>
                  <td className="p-2 border text-center">
                    {inv.isCanceled ? "예" : "아니오"}
                  </td>
                  <td className="p-2 border text-center">
                    {inv.isPriceCheck ? "예" : "아니오"}
                  </td>
                  <td className="p-2 border text-center">
                    <button
                      onClick={() => handleDelete(inv.id)}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      <BsTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SimpleInvoicesAdmin;
