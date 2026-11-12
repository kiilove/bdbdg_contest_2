import React, { useContext, useState, useEffect, useMemo } from "react";
import { BsCheckAll } from "react-icons/bs";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import LoadingPage from "./LoadingPage";
import InvoiceInfoModal from "../modals/InvoiceInfoModal";
import SearchBar from "../components/SearchBar";
import InvoiceTable from "../components/InvoiceTable";
import PaginationControls from "../components/PaginationControls";
import TabNavigation from "../components/TabNavigation";
import {
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { Modal } from "@mui/material";
import { writePriceCheckLog } from "../utils/priceCheckLogger";

const ContestInvoiceTable = () => {
  const [currentTab, setCurrentTab] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceList, setInvoiceList] = useState([]);
  const [searchInfo, setSearchInfo] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [isOpen, setIsOpen] = useState({
    category: false,
    grade: false,
    player: false,
    categoryId: "",
    gradeId: "",
  });

  // 🔹 로그 관련 상태
  const [logs, setLogs] = useState([]);
  const [logSortKey, setLogSortKey] = useState("timestamp");
  const [logSortOrder, setLogSortOrder] = useState("desc");
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const [logItemsPerPage, setLogItemsPerPage] = useState(10);

  const { currentContest } = useContext(CurrentContestContext);
  const getQuery = useFirestoreQuery();
  const updateInvoice = useFirestoreUpdateData("invoices_pool");
  const deleteEntry = useFirestoreDeleteData("contest_entrys_list");
  const addEntry = useFirestoreAddData("contest_entrys_list");

  const tabArray = [
    { id: 0, title: "전체목록", subTitle: "접수된 전체 신청서목록입니다." },
    {
      id: 1,
      title: "미확정목록",
      subTitle: "입금확인이 필요한 신청서목록입니다.",
    },
    { id: 2, title: "확정목록", subTitle: "입금확인된 신청서목록입니다." },
    { id: 3, title: "취소목록", subTitle: "참가신청후 취소된목록입니다." },
    {
      id: 5,
      title: "로그보기",
      subTitle: "가격확인 로그를 확인할 수 있습니다.",
    },
    { id: 4, title: "유료서비스", subTitle: "유료서비스 신청된목록입니다." },
  ];

  /** ✅ 참가신청서 목록 불러오기 */
  const fetchQuery = async (contestId) => {
    setIsLoading(true);
    const invoiceCondition = [where("contestId", "==", contestId)];
    const invoiceData = await getQuery.getDocuments(
      "invoices_pool",
      invoiceCondition
    );
    setInvoiceList(invoiceData || []);
    setIsLoading(false);
  };

  /** ✅ 가격확인 로그 불러오기 */
  const fetchLogs = async () => {
    if (!currentContest?.contests?.id) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "contests", currentContest.contests.id, "priceCheckLogs")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setLogs(data);
    } catch (err) {
      console.error("로그 불러오기 실패:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentContest?.contests?.id) fetchQuery(currentContest.contests.id);
  }, [currentContest?.contests?.id]);

  useEffect(() => {
    if (currentTab === 5) {
      fetchLogs();
    }
  }, [currentTab]);

  /** ✅ 참가신청서 필터링 */
  const filteredData = useMemo(() => {
    let data = invoiceList;
    if (searchInfo) {
      data = data.filter(
        (invoice) =>
          invoice.playerName?.includes(searchInfo) ||
          invoice.playerTel?.includes(searchInfo) ||
          invoice.playerGym?.includes(searchInfo)
      );
    }
    switch (currentTab) {
      case 1:
        return data.filter(
          (invoice) => !invoice.isPriceCheck && !invoice.isCanceled
        );
      case 2:
        return data.filter(
          (invoice) => invoice.isPriceCheck && !invoice.isCanceled
        );
      case 3:
        return data.filter((invoice) => invoice.isCanceled);
      case 4:
        return data.filter(
          (invoice) =>
            invoice.isPriceCheck && !invoice.isCanceled && invoice.playerService
        );
      default:
        return data;
    }
  }, [currentTab, invoiceList, searchInfo]);

  /** ✅ 페이지네이션 적용된 데이터 */
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  /** ✅ 로그 정렬 */
  const sortedLogs = useMemo(() => {
    let data = [...logs];
    data.sort((a, b) => {
      let valA = a[logSortKey];
      let valB = b[logSortKey];
      if (logSortKey === "timestamp") {
        valA = new Date(valA);
        valB = new Date(valB);
      }
      if (valA < valB) return logSortOrder === "asc" ? -1 : 1;
      if (valA > valB) return logSortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }, [logs, logSortKey, logSortOrder]);

  /** ✅ 로그 페이지네이션 */
  const paginatedLogs = useMemo(() => {
    const start = (logCurrentPage - 1) * logItemsPerPage;
    return sortedLogs.slice(start, start + logItemsPerPage);
  }, [sortedLogs, logCurrentPage, logItemsPerPage]);

  const logTotalPages = Math.ceil(sortedLogs.length / logItemsPerPage);

  /** ✅ 검색/페이지네이션 핸들러 */
  const handlePageChange = (page) => setCurrentPage(page);
  const handleSearch = (keyword) => {
    setSearchInfo(keyword);
    setCurrentPage(1);
  };

  /** ✅ 모달 */
  const handleInvoiceModal = (invoiceId, invoiceInfo) => {
    if (invoiceId) {
      setIsOpen({
        invoice: true,
        title: "신청서확인",
        info: invoiceInfo,
        list: invoiceList,
        setList: setInvoiceList,
      });
    }
  };
  const handleInoviceClose = () => {
    setIsOpen({ invoice: false, title: "", info: {} });
  };

  /** ✅ 입금확인 처리 */
  const handleIsPriceCheckUpdate = async (invoiceId, playerUid, checked) => {
    if (!invoiceId) return;
    setIsLoading(true);
    try {
      const sessionUser = JSON.parse(sessionStorage.getItem("user") || "{}");
      const findIndex = invoiceList.findIndex(
        (invoice) => invoice.id === invoiceId
      );
      if (findIndex === -1) return;

      const targetInvoice = invoiceList[findIndex];
      const newInvoiceList = [...invoiceList];
      const newInvoice = {
        ...targetInvoice,
        isPriceCheck: checked,
      };
      newInvoiceList.splice(findIndex, 1, newInvoice);

      if (checked) {
        let createdEntries = [];
        if (Array.isArray(targetInvoice.joins) && targetInvoice.joins.length > 0) {
          const {
            contestId,
            playerUid: invPlayerUid,
            playerName,
            playerBirth,
            playerGym,
            playerTel,
            playerText,
            invoiceCreateAt,
            createBy,
          } = targetInvoice;

          const resolvedContestId = contestId || currentContest?.contests?.id;
          const resolvedInvoiceId = targetInvoice.id || invoiceId;

          const addedResults = await Promise.all(
            targetInvoice.joins.map(async (join) => {
              const {
                contestCategoryTitle,
                contestCategoryId,
                contestGradeTitle,
                contestGradeId,
              } = join;

              const entryInfo = {
                contestId: resolvedContestId,
                invoiceId: resolvedInvoiceId,
                playerUid: invPlayerUid ?? "",
                playerName: playerName ?? "",
                playerBirth: playerBirth ?? "",
                playerGym: playerGym ?? "",
                playerTel: playerTel ?? "",
                playerText: playerText ?? "",
                invoiceCreateAt: invoiceCreateAt ?? null,
                createBy: createBy || "web",
                contestCategoryTitle,
                contestCategoryId,
                contestGradeTitle,
                contestGradeId,
                originalGradeTitle: contestGradeTitle,
                originalGradeId: contestGradeId,
                isGradeChanged: false,
                clientInfo: {
                  userID: sessionUser.userID || null,
                  userGroup: sessionUser.userGroup || null,
                  userContext: sessionUser.userContext || null,
                  userDocId: sessionUser.id || null,
                  clickedAt: new Date().toISOString(),
                  clientDevice: navigator.userAgent,
                },
              };
              return await addEntry.addData(entryInfo);
            })
          );

          createdEntries = addedResults.filter((res) => res && res.id);
          const hasAddFailure = addedResults.some((res) => !res || !res.id);

          if (hasAddFailure) {
            if (createdEntries.length > 0) {
              await Promise.all(
                createdEntries.map((entry) => deleteEntry.deleteData(entry.id))
              );
            }
            alert(
              "출전 명단 등록 중 오류가 발생하여 입금확인이 취소되었습니다. 다시 시도해주세요."
            );
            return;
          }
        }

        const updatedInvoice = await updateInvoice.updateData(invoiceId, {
          ...newInvoice,
        });
        if (!updatedInvoice) {
          if (createdEntries.length > 0) {
            await Promise.all(
              createdEntries.map((entry) => deleteEntry.deleteData(entry.id))
            );
          }
          alert("입금확인 상태 저장 중 오류가 발생했습니다. 다시 시도해주세요.");
          return;
        }

        await writePriceCheckLog({
          action: "add",
          invoice: newInvoice,
          sessionUser,
          currentContest,
        });
      } else {
        const deletedOk = await initInvoice(targetInvoice, playerUid);
        if (!deletedOk) {
          alert(
            "출전 명단 삭제 중 오류가 발생하여 입금확인 해제가 취소되었습니다. 다시 시도해주세요."
          );
          return;
        }

        const updatedInvoice = await updateInvoice.updateData(invoiceId, {
          ...newInvoice,
        });
        if (!updatedInvoice) {
          alert(
            "신청서 상태 업데이트 중 오류가 발생했습니다. 페이지를 새로고침 후 확인해주세요."
          );
          return;
        }

        await writePriceCheckLog({
          action: "del",
          invoice: newInvoice,
          sessionUser,
          currentContest,
        });
      }

      setInvoiceList([...newInvoiceList]);
    } catch (error) {
      console.error(error);
      alert("입금확인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const initInvoice = async (invoice, fallbackPlayerUid = "") => {
    const activeContestId =
      invoice?.contestId || currentContest?.contests?.id || "";
    if (!activeContestId) {
      return false;
    }

    const invoiceCondition = [where("contestId", "==", activeContestId)];
    const returnEntry = await getQuery.getDocuments(
      "contest_entrys_list",
      invoiceCondition
    );

    if (!Array.isArray(returnEntry) || returnEntry.length === 0) {
      console.log("일치하는 선수명단이 없습니다.");
      return true;
    }

    const targetInvoiceId = invoice?.id || "";
    const trimmedUid = String(
      invoice?.playerUid ?? fallbackPlayerUid ?? ""
    ).trim();
    const joinGradeIds = new Set(
      Array.isArray(invoice?.joins)
        ? invoice.joins.map((j) => j?.contestGradeId).filter(Boolean)
        : []
    );

    let entriesToDelete = [];
    if (targetInvoiceId) {
      entriesToDelete = returnEntry.filter(
        (entry) => entry.invoiceId && entry.invoiceId === targetInvoiceId
      );
    }

    // invoiceId가 저장되지 않은 구버전 엔트리 폴백 (빈 playerUid 전체 매칭 절대 금지)
    if (entriesToDelete.length === 0) {
      entriesToDelete = returnEntry.filter((entry) => {
        if (entry.invoiceId && targetInvoiceId && entry.invoiceId !== targetInvoiceId) {
          return false;
        }
        if (entry.contestId !== activeContestId) {
          return false;
        }
        if (trimmedUid !== "") {
          return entry.playerUid === trimmedUid;
        }
        const hasNameAndTel =
          Boolean(invoice?.playerName) &&
          Boolean(invoice?.playerTel) &&
          entry.playerName === invoice.playerName &&
          entry.playerTel === invoice.playerTel;
        if (!hasNameAndTel) {
          return false;
        }
        return (
          joinGradeIds.size > 0 && joinGradeIds.has(entry.contestGradeId)
        );
      });
    }

    if (entriesToDelete.length <= 0) {
      console.log("일치하는 선수명단이 없습니다.");
      return true;
    }

    const deleteResults = await Promise.all(
      entriesToDelete.map(async (entry) => {
        return await deleteEntry.deleteData(entry.id);
      })
    );

    return deleteResults.every(Boolean);
  };

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-3 gap-y-2">
      {isLoading ? (
        <LoadingPage />
      ) : (
        <>
          <div className="flex w-full h-14 items-center bg-gray-100 rounded-lg px-3">
            <BsCheckAll className="font-sans text-lg font-semibold w-6 h-6 bg-blue-400 text-white rounded-2xl mr-3" />
            <h1 className="font-sans text-lg font-semibold">참가신청서</h1>
          </div>
          <TabNavigation
            tabs={tabArray}
            currentTab={currentTab}
            onTabChange={setCurrentTab}
          />

          {currentTab === 5 ? (
            <div className="flex flex-col w-full gap-3">
              {/* 🔹 정렬 옵션 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-2 items-center">
                  <label className="text-sm text-gray-600">정렬:</label>
                  <select
                    value={logSortKey}
                    onChange={(e) => setLogSortKey(e.target.value)}
                    className="border rounded p-1 text-sm"
                  >
                    <option value="timestamp">시간순</option>
                    <option value="action">액션순</option>
                    <option value="playerName">선수명순</option>
                  </select>
                  <select
                    value={logSortOrder}
                    onChange={(e) => setLogSortOrder(e.target.value)}
                    className="border rounded p-1 text-sm"
                  >
                    <option value="desc">내림차순</option>
                    <option value="asc">오름차순</option>
                  </select>
                </div>
              </div>

              {/* 🔹 로그 테이블 */}
              <div className="overflow-auto border rounded">
                <table className="table-auto w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="p-2 border">시간</th>
                      <th className="p-2 border">액션</th>
                      <th className="p-2 border">선수명</th>
                      <th className="p-2 border">아이디</th>
                      <th className="p-2 border">조직</th>
                      <th className="p-2 border">권한</th>
                      <th className="p-2 border">IP</th>
                      <th className="p-2 border">디바이스</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.map((log) => {
                      const device = log.clientInfo?.clientDevice || "-";
                      const os = device.includes("Windows")
                        ? "Windows"
                        : device.includes("Mac")
                        ? "MacOS"
                        : device.includes("Linux")
                        ? "Linux"
                        : "기타";
                      const browser = device.includes("Chrome")
                        ? "Chrome"
                        : device.includes("Safari")
                        ? "Safari"
                        : device.includes("Firefox")
                        ? "Firefox"
                        : "기타";
                      const deviceShort = `${os} / ${browser}`;

                      return (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="p-2 border">
                            {new Date(log.timestamp).toLocaleString("ko-KR", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td
                            className={`p-2 border font-semibold ${
                              log.action === "add"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {log.action === "add" ? "추가" : "삭제"}
                          </td>
                          <td className="p-2 border">
                            {log.playerName || "-"}
                          </td>
                          <td className="p-2 border">
                            {log.clientInfo?.userID || "-"}
                          </td>
                          <td className="p-2 border">
                            {log.clientInfo?.userContext || "-"}
                          </td>
                          <td className="p-2 border">
                            {log.clientInfo?.userGroup || "-"}
                          </td>
                          <td className="p-2 border">
                            {log.clientInfo?.clientIp || "-"}
                          </td>
                          <td className="p-2 border">{deviceShort}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 🔹 로그 페이지네이션 컨트롤 */}
              <div className="flex justify-between items-center mt-2 text-sm">
                <div>
                  페이지 {logCurrentPage} / {logTotalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={logCurrentPage === 1}
                    onClick={() => setLogCurrentPage((p) => p - 1)}
                    className={`px-2 py-1 border rounded ${
                      logCurrentPage === 1 ? "opacity-40" : "hover:bg-gray-100"
                    }`}
                  >
                    이전
                  </button>
                  <button
                    disabled={logCurrentPage === logTotalPages}
                    onClick={() => setLogCurrentPage((p) => p + 1)}
                    className={`px-2 py-1 border rounded ${
                      logCurrentPage === logTotalPages
                        ? "opacity-40"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    다음
                  </button>
                  <select
                    value={logItemsPerPage}
                    onChange={(e) => {
                      setLogItemsPerPage(parseInt(e.target.value));
                      setLogCurrentPage(1);
                    }}
                    className="border rounded p-1 text-sm"
                  >
                    <option value={10}>10개</option>
                    <option value={20}>20개</option>
                    <option value={50}>50개</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <>
              <SearchBar onSearch={handleSearch} />
              <InvoiceTable
                data={paginatedData}
                handleInvoiceModal={handleInvoiceModal}
                handleIsPriceCheckUpdate={handleIsPriceCheckUpdate}
              />
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={(e) =>
                  setItemsPerPage(parseInt(e.target.value))
                }
              />
            </>
          )}

          <Modal open={isOpen.invoice} onClose={handleInoviceClose}>
            <div
              className="flex w-full lg:w-1/2 h-screen lg:h-auto absolute top-1/2 left-1/2 lg:shadow-md lg:rounded-lg bg-white p-3"
              style={{ transform: "translate(-50%, -50%)" }}
            >
              <InvoiceInfoModal
                setClose={handleInoviceClose}
                propState={isOpen}
                setState={setInvoiceList}
              />
            </div>
          </Modal>
        </>
      )}
    </div>
  );
};

export default ContestInvoiceTable;
