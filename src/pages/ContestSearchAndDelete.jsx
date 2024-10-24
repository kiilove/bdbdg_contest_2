import React, { useState } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore"; // Firestore methods
import { db } from "../firebase"; // Ensure your Firestore is correctly configured

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
  const [logs, setLogs] = useState([]); // Logs state for easier debugging
  const [showLogs, setShowLogs] = useState(false); // Control log display

  // Helper function to add logs
  const addLog = (message) => {
    setLogs((prevLogs) => [...prevLogs, message]);
  };

  // Search by contestId in both invoices_pool and contest_entrys_list
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

  // Search by contestId in contest_results_list (separate)
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

  // Delete documents by contestId in both invoices_pool and contest_entrys_list
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

  // Delete documents from contest_results_list by contestId
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

    // Retry failed deletions
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

  // Search all documents in a specific collection
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

  // Delete all documents in a specific collection
  const handleDeleteByCollectionName = async () => {
    if (collectionDocs.length === 0) {
      setErrorMessage("삭제할 문서가 없습니다.");
      return;
    }

    try {
      for (const docItem of collectionDocs) {
        const docRef = doc(db, collectionName, docItem.id); // Corrected document reference
        await deleteDoc(docRef); // Delete each document in the collection
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
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">대회 검색 및 삭제</h1>

      {/* Search by contestId in invoices_pool and contest_entrys_list */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">
          대회 접수 및 송장 검색/삭제
        </h2>
        <label htmlFor="contestId" className="block mb-1">
          대회 ID:
        </label>
        <input
          type="text"
          id="contestId"
          value={contestId}
          onChange={(e) => setContestId(e.target.value)}
          className="w-full p-2 border mb-2"
        />
        <button
          onClick={handleSearchByContestId}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          대회 ID로 검색
        </button>

        <div className="mt-4">
          <h3 className="text-lg font-semibold">검색 결과</h3>
          <p>invoices_pool: {invoiceCount}</p>
          <p>contest_entrys_list: {entryCount}</p>
        </div>

        {invoiceCount > 0 || entryCount > 0 ? (
          <button
            onClick={handleDeleteByContestId}
            className="bg-red-500 text-white px-4 py-2 mt-2 rounded"
          >
            모든 접수/송장 삭제
          </button>
        ) : (
          <p className="mt-2">해당하는 문서가 없습니다.</p>
        )}
      </div>

      {/* Search by contestId in contest_results_list (separate) */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">대회 결과 검색/삭제</h2>
        <label htmlFor="resultContestId" className="block mb-1">
          결과 대회 ID:
        </label>
        <input
          type="text"
          id="resultContestId"
          value={resultContestId}
          onChange={(e) => setResultContestId(e.target.value)}
          className="w-full p-2 border mb-2"
        />
        <button
          onClick={handleSearchResultsByContestId}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          결과 대회 ID로 검색
        </button>

        <div className="mt-4">
          <h3 className="text-lg font-semibold">검색 결과</h3>
          <p>contest_results_list: {resultCount}</p>
        </div>

        {resultCount > 0 ? (
          <button
            onClick={handleDeleteResultsByContestId}
            className="bg-red-500 text-white px-4 py-2 mt-2 rounded"
          >
            모든 결과 삭제
          </button>
        ) : (
          <p className="mt-2">해당하는 문서가 없습니다.</p>
        )}
      </div>

      {/* Search and delete all documents in a specific collection */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">컬렉션 문서 전체 삭제</h2>
        <label htmlFor="collectionName" className="block mb-1">
          컬렉션 이름:
        </label>
        <input
          type="text"
          id="collectionName"
          value={collectionName}
          onChange={(e) => setCollectionName(e.target.value)}
          className="w-full p-2 border mb-2"
        />
        <button
          onClick={handleSearchByCollectionName}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          컬렉션 검색
        </button>

        {collectionDocs.length > 0 && (
          <>
            <h3 className="text-lg font-semibold mt-4">
              {collectionDocs.length}개의 문서를 찾았습니다.
            </h3>
            <button
              onClick={handleDeleteByCollectionName}
              className="bg-red-500 text-white px-4 py-2 mt-2 rounded"
            >
              모든 문서 삭제
            </button>
          </>
        )}
        {errorMessage && <p className="text-red-500 mt-2">{errorMessage}</p>}
      </div>

      {/* Logs display */}
      <div className="bg-gray-200 p-4 rounded-lg mt-6">
        <h2 className="text-lg font-bold mb-2">디버그 로그</h2>
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="bg-gray-500 text-white px-4 py-2 mb-2 rounded"
        >
          {showLogs ? "로그 숨기기" : "로그 보기"}
        </button>
        {showLogs && (
          <div className="overflow-y-auto h-40 bg-gray-100 p-2 border">
            <pre className="text-xs">{logs.join("\n")}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContestSearchAndDelete;
