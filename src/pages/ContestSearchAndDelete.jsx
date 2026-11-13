import React, { useState } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { Search, Trash2, Terminal, AlertCircle } from "lucide-react";
import { db } from "../firebase";

const inputClass =
  "w-full h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] px-3 font-mono text-[13px] text-[#171717] placeholder:text-[#737373] placeholder:font-sans focus:outline-none focus:border-[#2563eb] transition-colors duration-150";

const ContestSearchAndDelete = () => {
  const [contestId, setContestId] = useState("");
  const [resultContestId, setResultContestId] = useState("");
  const [inputId, setInputId] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [entryCount, setEntryCount] = useState(0);
  const [resultCount, setResultCount] = useState(0);
  const [collectionDocs, setCollectionDocs] = useState([]);
  const [invoiceDocs, setInvoiceDocs] = useState([]);
  const [entryDocs, setEntryDocs] = useState([]);
  const [resultDocs, setResultDocs] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  void inputId;
  void setInputId;

  const addLog = (message) => {
    setLogs((prevLogs) => [...prevLogs, message]);
  };

  const handleSearchByContestId = async () => {
    setErrorMessage("");
    if (!contestId) {
      setErrorMessage("대회 ID를 입력하세요.");
      return;
    }

    try {
      addLog(`Searching invoices_pool with contestId: ${contestId}`);
      const invoiceResults = await getDocs(
        query(
          collection(db, "invoices_pool"),
          where("contestId", "==", contestId)
        )
      );
      setInvoiceDocs(
        invoiceResults.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setInvoiceCount(invoiceResults.docs.length);
      addLog(`Found ${invoiceResults.docs.length} documents in invoices_pool`);

      addLog(`Searching contest_entrys_list with contestId: ${contestId}`);
      const entryResults = await getDocs(
        query(
          collection(db, "contest_entrys_list"),
          where("contestId", "==", contestId)
        )
      );
      setEntryDocs(
        entryResults.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setEntryCount(entryResults.docs.length);
      addLog(
        `Found ${entryResults.docs.length} documents in contest_entrys_list`
      );
    } catch (error) {
      console.error("Error fetching documents:", error);
      addLog(`Error fetching documents: ${error.message}`);
    }
  };

  const handleSearchResultsByContestId = async () => {
    setErrorMessage("");
    if (!resultContestId) {
      setErrorMessage("결과 대회 ID를 입력하세요.");
      return;
    }

    try {
      addLog(
        `Searching contest_results_list with contestId: ${resultContestId}`
      );
      const resultResults = await getDocs(
        query(
          collection(db, "contest_results_list"),
          where("contestId", "==", resultContestId)
        )
      );
      setResultDocs(
        resultResults.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setResultCount(resultResults.docs.length);
      addLog(
        `Found ${resultResults.docs.length} documents in contest_results_list`
      );
    } catch (error) {
      console.error("Error fetching documents:", error);
      addLog(`Error fetching documents: ${error.message}`);
    }
  };

  const handleDeleteByContestId = async () => {
    addLog(`Deleting documents for contestId: ${contestId}`);

    try {
      for (const docItem of invoiceDocs) {
        await deleteDoc(doc(db, "invoices_pool", docItem.id));
        addLog(`Deleted document ${docItem.id} from invoices_pool`);
      }

      for (const docItem of entryDocs) {
        await deleteDoc(doc(db, "contest_entrys_list", docItem.id));
        addLog(`Deleted document ${docItem.id} from contest_entrys_list`);
      }

      setInvoiceDocs([]);
      setEntryDocs([]);
      setInvoiceCount(0);
      setEntryCount(0);
      addLog("Deletion of all contest entries and invoices completed.");
    } catch (error) {
      console.error("Error deleting documents:", error);
      addLog(`Error deleting documents: ${error.message}`);
    }
  };

  const handleDeleteResultsByContestId = async () => {
    addLog(
      `Deleting documents from contest_results_list for contestId: ${resultContestId}`
    );

    const failedDeletions = [];

    for (const resultDoc of resultDocs) {
      try {
        const docRef = doc(db, "contest_results_list", resultDoc.id);
        await deleteDoc(docRef);
        addLog(`Deleted document ${resultDoc.id} from contest_results_list`);
      } catch (error) {
        console.error("Error deleting document:", error);
        addLog(`Failed to delete document ${resultDoc.id}: ${error.message}`);
        failedDeletions.push(resultDoc.id);
      }
    }

    if (failedDeletions.length > 0) {
      addLog("Retrying failed deletions...");
      for (const failedId of failedDeletions) {
        try {
          const docRef = doc(db, "contest_results_list", failedId);
          await deleteDoc(docRef);
          addLog(`Deleted document ${failedId} on retry`);
        } catch (error) {
          console.error("Retry failed to delete document:", error);
          addLog(
            `Retry failed to delete document ${failedId}: ${error.message}`
          );
        }
      }
    }

    setResultDocs([]);
    setResultCount(0);
    addLog("Deletion of all contest results completed.");
  };

  const handleSearchByCollectionName = async () => {
    setErrorMessage("");
    if (!collectionName) {
      setErrorMessage("컬렉션 이름을 입력하세요.");
      return;
    }

    try {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (docs.length === 0) {
        setErrorMessage(`컬렉션: ${collectionName}에 문서가 없습니다.`);
      } else {
        setCollectionDocs(docs);
        addLog(`Found ${docs.length} documents in ${collectionName}`);
      }
    } catch (error) {
      console.error("Error fetching collection documents:", error);
      setErrorMessage("문서 검색 중 오류 발생. 컬렉션 이름을 확인하세요.");
      addLog(`Error fetching documents: ${error.message}`);
    }
  };

  const handleDeleteByCollectionName = async () => {
    if (collectionDocs.length === 0) {
      setErrorMessage("삭제할 문서가 없습니다.");
      return;
    }

    try {
      for (const docItem of collectionDocs) {
        const docRef = doc(db, collectionName, docItem.id);
        await deleteDoc(docRef);
        addLog(`Deleted document ${docItem.id} from ${collectionName}`);
      }

      setCollectionDocs([]);
      setErrorMessage(`모든 문서가 ${collectionName}에서 삭제되었습니다.`);
    } catch (error) {
      console.error(`Error deleting documents from ${collectionName}:`, error);
      setErrorMessage(`문서 삭제 실패: ${collectionName}`);
      addLog(`Error deleting documents: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-[1440px] mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              대회 데이터 검색 및 삭제
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              대회 ID 또는 컬렉션 단위로 접수·출전·집계 문서를 조회하고 일괄 정리합니다
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowLogs(!showLogs)}
              className="h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <Terminal size={15} strokeWidth={1.5} className="text-[#525252]" />
              <span>{showLogs ? "디버그 로그 숨기기" : "디버그 로그 보기"}</span>
              <span className="font-mono text-[11px] tabular-nums text-[#737373]">
                ({logs.length})
              </span>
            </button>
          </div>
        </header>

        {errorMessage && (
          <div className="rounded-[8px] bg-[#dc2626]/[0.08] border border-[#dc2626]/20 px-4 py-3 flex items-center gap-2.5 text-[13px] text-[#dc2626]">
            <AlertCircle size={16} strokeWidth={1.5} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* 1. 접수 및 출전 명단 검색/삭제 */}
          <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
            <div className="border-b border-[#171717]/[0.06] pb-3">
              <h2 className="text-[15px] font-medium text-[#171717]">
                접수 신청서 및 출전 명단
              </h2>
              <p className="text-[12px] text-[#737373] mt-0.5">
                invoices_pool · contest_entrys_list
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="contestId"
                className="block text-[13px] font-medium text-[#525252]"
              >
                대회 ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="contestId"
                  placeholder="contestId 입력"
                  value={contestId}
                  onChange={(e) => setContestId(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleSearchByContestId}
                  className="h-9 px-3.5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[13px] font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors duration-150"
                >
                  <Search size={15} strokeWidth={1.5} />
                  <span>검색</span>
                </button>
              </div>
            </div>

            <div className="bg-[#f4f4f5] rounded-[8px] p-3.5 space-y-2 border border-[#171717]/[0.06]">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-mono text-[12px] text-[#525252]">
                  invoices_pool
                </span>
                <span className="font-mono font-medium tabular-nums text-[#171717]">
                  {invoiceCount}건
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-mono text-[12px] text-[#525252]">
                  contest_entrys_list
                </span>
                <span className="font-mono font-medium tabular-nums text-[#171717]">
                  {entryCount}건
                </span>
              </div>
            </div>

            {invoiceCount > 0 || entryCount > 0 ? (
              <button
                type="button"
                onClick={handleDeleteByContestId}
                className="w-full h-9 px-4 rounded-[8px] bg-[#dc2626] hover:bg-[#b91c1c] text-white text-[13px] font-medium inline-flex items-center justify-center gap-2 transition-colors duration-150"
              >
                <Trash2 size={15} strokeWidth={1.5} />
                <span>조회된 접수·출전 문서 전체 삭제</span>
              </button>
            ) : (
              <p className="text-[12px] text-[#737373]">
                조회된 대상 문서가 없습니다
              </p>
            )}
          </section>

          {/* 2. 대회 결과 검색/삭제 */}
          <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
            <div className="border-b border-[#171717]/[0.06] pb-3">
              <h2 className="text-[15px] font-medium text-[#171717]">
                대회 최종 결과 문서
              </h2>
              <p className="text-[12px] text-[#737373] mt-0.5">
                contest_results_list
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="resultContestId"
                className="block text-[13px] font-medium text-[#525252]"
              >
                결과 대회 ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="resultContestId"
                  placeholder="contestId 입력"
                  value={resultContestId}
                  onChange={(e) => setResultContestId(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleSearchResultsByContestId}
                  className="h-9 px-3.5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[13px] font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors duration-150"
                >
                  <Search size={15} strokeWidth={1.5} />
                  <span>검색</span>
                </button>
              </div>
            </div>

            <div className="bg-[#f4f4f5] rounded-[8px] p-3.5 space-y-2 border border-[#171717]/[0.06]">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-mono text-[12px] text-[#525252]">
                  contest_results_list
                </span>
                <span className="font-mono font-medium tabular-nums text-[#171717]">
                  {resultCount}건
                </span>
              </div>
            </div>

            {resultCount > 0 ? (
              <button
                type="button"
                onClick={handleDeleteResultsByContestId}
                className="w-full h-9 px-4 rounded-[8px] bg-[#dc2626] hover:bg-[#b91c1c] text-white text-[13px] font-medium inline-flex items-center justify-center gap-2 transition-colors duration-150"
              >
                <Trash2 size={15} strokeWidth={1.5} />
                <span>조회된 결과 문서 전체 삭제</span>
              </button>
            ) : (
              <p className="text-[12px] text-[#737373]">
                조회된 대상 문서가 없습니다
              </p>
            )}
          </section>

          {/* 3. 컬렉션 전체 삭제 */}
          <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
            <div className="border-b border-[#171717]/[0.06] pb-3">
              <h2 className="text-[15px] font-medium text-[#171717]">
                지정 컬렉션 전체 비우기
              </h2>
              <p className="text-[12px] text-[#737373] mt-0.5">
                특정 채점·임시 컬렉션의 모든 문서 삭제
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="collectionName"
                className="block text-[13px] font-medium text-[#525252]"
              >
                컬렉션 이름
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="collectionName"
                  placeholder="컬렉션 식별자 입력"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleSearchByCollectionName}
                  className="h-9 px-3.5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[13px] font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors duration-150"
                >
                  <Search size={15} strokeWidth={1.5} />
                  <span>검색</span>
                </button>
              </div>
            </div>

            <div className="bg-[#f4f4f5] rounded-[8px] p-3.5 space-y-2 border border-[#171717]/[0.06]">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-mono text-[12px] text-[#525252] truncate max-w-[160px]">
                  {collectionName || "대상 미지정"}
                </span>
                <span className="font-mono font-medium tabular-nums text-[#171717]">
                  {collectionDocs.length}건
                </span>
              </div>
            </div>

            {collectionDocs.length > 0 ? (
              <button
                type="button"
                onClick={handleDeleteByCollectionName}
                className="w-full h-9 px-4 rounded-[8px] bg-[#dc2626] hover:bg-[#b91c1c] text-white text-[13px] font-medium inline-flex items-center justify-center gap-2 transition-colors duration-150"
              >
                <Trash2 size={15} strokeWidth={1.5} />
                <span>{collectionDocs.length}개 문서 전체 삭제</span>
              </button>
            ) : (
              <p className="text-[12px] text-[#737373]">
                조회된 대상 문서가 없습니다
              </p>
            )}
          </section>
        </div>

        {/* 디버그 로그 패널 */}
        {showLogs && (
          <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-[#171717]">
                실행 로그
              </h2>
              <span className="font-mono text-[12px] tabular-nums text-[#737373]">
                {logs.length} lines
              </span>
            </div>
            <div className="overflow-y-auto h-48 rounded-[8px] bg-[#141415] p-3.5 border border-[#171717]/[0.08]">
              <pre className="font-mono text-[12px] leading-5 text-[#ededed] whitespace-pre-wrap">
                {logs.length > 0 ? logs.join("\n") : "기록된 로그가 없습니다"}
              </pre>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ContestSearchAndDelete;
