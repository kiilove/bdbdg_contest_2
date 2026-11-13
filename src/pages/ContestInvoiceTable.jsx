import React, { useContext, useState, useEffect, useMemo, useRef } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import LoadingPage from "./LoadingPage";
import InvoiceInfoModal from "../modals/InvoiceInfoModal";
import InvoiceTable from "../components/InvoiceTable";
import {
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { Drawer } from "@mui/material";
import { writePriceCheckLog } from "../utils/priceCheckLogger";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const ContestInvoiceTable = () => {
  const [currentTab, setCurrentTab] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceList, setInvoiceList] = useState([]);
  const [searchInfo, setSearchInfo] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState({});

  const openNotice = (config) => {
    setNoticeMessage({ isButton: true, confirmButtonText: "확인", ...config });
    setModalOpen(true);
  };
  const [isOpen, setIsOpen] = useState({
    category: false,
    grade: false,
    player: false,
    categoryId: "",
    gradeId: "",
  });

  // 로그 관련 상태
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
  const inFlightPriceCheckRef = useRef(new Set());

  const tabArray = [
    { id: 0, title: "전체 목록", subTitle: "접수된 전체 참가신청서 목록" },
    {
      id: 1,
      title: "미확정 목록",
      subTitle: "입금 확인이 필요한 참가신청서 목록",
    },
    { id: 2, title: "확정 목록", subTitle: "입금 확인이 완료된 참가신청서 목록" },
    { id: 3, title: "취소 목록", subTitle: "참가 신청 후 취소 처리된 목록" },
    { id: 4, title: "유료 서비스", subTitle: "유료 서비스가 포함된 확정 목록" },
    {
      id: 5,
      title: "처리 로그",
      subTitle: "입금 확인 및 해제 이력 기록",
    },
  ];

  /** 참가신청서 목록 불러오기 */
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

  /** 가격확인 로그 불러오기 */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests?.id]);

  useEffect(() => {
    if (currentTab === 5) {
      fetchLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab]);

  /** 탭별 카운트 */
  const tabCounts = useMemo(() => {
    return {
      0: invoiceList.length,
      1: invoiceList.filter((i) => !i.isPriceCheck && !i.isCanceled).length,
      2: invoiceList.filter((i) => i.isPriceCheck && !i.isCanceled).length,
      3: invoiceList.filter((i) => i.isCanceled).length,
      4: invoiceList.filter(
        (i) => i.isPriceCheck && !i.isCanceled && i.playerService
      ).length,
      5: logs.length,
    };
  }, [invoiceList, logs.length]);

  /** 참가신청서 필터링 */
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

  /** 페이지네이션 적용된 데이터 */
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  /** 로그 정렬 */
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

  /** 로그 페이지네이션 */
  const paginatedLogs = useMemo(() => {
    const start = (logCurrentPage - 1) * logItemsPerPage;
    return sortedLogs.slice(start, start + logItemsPerPage);
  }, [sortedLogs, logCurrentPage, logItemsPerPage]);

  const logTotalPages = Math.ceil(sortedLogs.length / logItemsPerPage);

  /** 검색/페이지네이션 핸들러 */
  const handlePageChange = (page) => setCurrentPage(page);
  const handleSearch = (keyword) => {
    setSearchInfo(keyword);
    setCurrentPage(1);
  };

  /** 모달 */
  const handleInvoiceModal = (invoiceId, invoiceInfo) => {
    if (invoiceId) {
      setIsOpen({
        invoice: true,
        title: "신청서 상세 및 수정",
        info: invoiceInfo,
        list: invoiceList,
        setList: setInvoiceList,
      });
    }
  };
  const handleInoviceClose = () => {
    setIsOpen({ invoice: false, title: "", info: {} });
  };

  /** 입금확인 처리 */
  const handleIsPriceCheckUpdate = async (invoiceId, playerUid, checked) => {
    if (!invoiceId || inFlightPriceCheckRef.current.has(invoiceId)) return;
    inFlightPriceCheckRef.current.add(invoiceId);
    setIsLoading(true);
    try {
      const sessionUser = JSON.parse(sessionStorage.getItem("user") || "{}");
      const findIndex = invoiceList.findIndex(
        (invoice) => invoice.id === invoiceId
      );
      if (findIndex === -1) return;

      const targetInvoice = invoiceList[findIndex];
      const nextChecked = Boolean(checked);
      if (Boolean(targetInvoice.isPriceCheck) === nextChecked) {
        return;
      }

      const newInvoice = {
        ...targetInvoice,
        isPriceCheck: nextChecked,
      };
      const invoicePatch = {
        isPriceCheck: nextChecked,
        ...(newInvoice.priceCheckLogs !== undefined
          ? { priceCheckLogs: newInvoice.priceCheckLogs }
          : {}),
      };

      if (nextChecked) {
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
            createdBy,
          } = targetInvoice;

          const resolvedContestId = contestId || currentContest?.contests?.id;
          const resolvedInvoiceId = targetInvoice.id || invoiceId;

          const existingEntries = resolvedContestId
            ? await getQuery.getDocuments("contest_entrys_list", [
                where("contestId", "==", resolvedContestId),
              ])
            : [];
          const existingGradeIdsForInvoice = new Set(
            (existingEntries || [])
              .filter(
                (entry) =>
                  entry?.invoiceId && entry.invoiceId === resolvedInvoiceId
              )
              .map((entry) => entry.contestGradeId)
              .filter(Boolean)
          );

          const joinsToCreate = targetInvoice.joins.filter(
            (join) =>
              join?.contestGradeId &&
              !existingGradeIdsForInvoice.has(join.contestGradeId)
          );

          const addedResults = await Promise.all(
            joinsToCreate.map(async (join) => {
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
                createBy: createBy || createdBy || "web",
                createdBy: createdBy || createBy || "web",
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
            openNotice({
              variant: "error",
              title: "출전 명단 등록 오류",
              body: "출전 명단 등록 중 오류가 발생하여 입금확인이 취소되었습니다.",
              body2: "네트워크 상태를 확인한 후 다시 시도해 주세요.",
            });
            return;
          }
        }

        const updatedInvoice = await updateInvoice.updateData(
          invoiceId,
          invoicePatch
        );
        if (!updatedInvoice) {
          if (createdEntries.length > 0) {
            await Promise.all(
              createdEntries.map((entry) => deleteEntry.deleteData(entry.id))
            );
          }
          openNotice({
            variant: "error",
            title: "입금확인 저장 실패",
            body: "입금확인 상태 저장 중 오류가 발생했습니다.",
            body2: "잠시 후 다시 시도해 주세요.",
          });
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
          openNotice({
            variant: "error",
            title: "출전 명단 해제 오류",
            body: "출전 명단 삭제 중 오류가 발생하여 입금확인 해제가 취소되었습니다.",
            body2: "다시 시도해 주세요.",
          });
          return;
        }

        const updatedInvoice = await updateInvoice.updateData(
          invoiceId,
          invoicePatch
        );
        if (!updatedInvoice) {
          openNotice({
            variant: "error",
            title: "신청서 상태 갱신 실패",
            body: "신청서 상태 업데이트 중 오류가 발생했습니다.",
            body2: "페이지를 새로고침한 후 확인해 주세요.",
          });
          return;
        }

        await writePriceCheckLog({
          action: "del",
          invoice: newInvoice,
          sessionUser,
          currentContest,
        });
      }

      setInvoiceList((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, ...invoicePatch } : inv))
      );
    } catch (error) {
      console.error(error);
      openNotice({
        variant: "error",
        title: "입금확인 처리 오류",
        body: "입금확인 처리 중 예기치 못한 오류가 발생했습니다.",
      });
    } finally {
      inFlightPriceCheckRef.current.delete(invoiceId);
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

  const activeTabMeta = tabArray.find((t) => t.id === currentTab) || tabArray[0];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <ConfirmationModal
        isOpen={modalOpen}
        message={noticeMessage}
        onCancel={() => setModalOpen(false)}
        onConfirm={() => setModalOpen(false)}
      />
      <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-6">
        {isLoading ? (
          <LoadingPage />
        ) : (
          <>
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
                  참가신청서 관리
                </h1>
                <p className="text-[13px] text-[#737373] mt-1">
                  {activeTabMeta.subTitle}
                </p>
              </div>
              <div className="flex items-center gap-4 text-[13px] text-[#525252]">
                <span>
                  총 접수{" "}
                  <strong className="font-mono font-medium tabular-nums text-[#171717]">
                    {invoiceList.length}
                  </strong>
                  건
                </span>
                <span className="text-[#171717]/15">|</span>
                <span>
                  입금완료{" "}
                  <strong className="font-mono font-medium tabular-nums text-[#16a34a]">
                    {tabCounts[2]}
                  </strong>
                  건
                </span>
                <span className="text-[#171717]/15">|</span>
                <span>
                  미확정{" "}
                  <strong className="font-mono font-medium tabular-nums text-[#b45309]">
                    {tabCounts[1]}
                  </strong>
                  건
                </span>
              </div>
            </header>

            <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              {/* 탭 네비게이션 */}
              <div className="flex items-center gap-1 px-4 pt-2 border-b border-[#171717]/[0.08] bg-[#fafafa] overflow-x-auto overflow-y-hidden no-scrollbar">
                {tabArray.map((tab) => {
                  const isActive = currentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setCurrentTab(tab.id);
                        setCurrentPage(1);
                      }}
                      className={`relative h-10 px-3.5 text-[13px] font-medium inline-flex items-center gap-2 shrink-0 transition-colors duration-150 after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] ${
                        isActive
                          ? "text-[#2563eb] after:bg-[#2563eb]"
                          : "text-[#525252] hover:text-[#171717] after:bg-transparent"
                      }`}
                    >
                      <span>{tab.title}</span>
                      {tab.id !== 5 && (
                        <span
                          className={`font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded-[4px] ${
                            isActive
                              ? "bg-[#2563eb]/[0.1] text-[#2563eb]"
                              : "bg-[#f4f4f5] text-[#737373]"
                          }`}
                        >
                          {tabCounts[tab.id] ?? 0}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {currentTab === 5 ? (
                <div className="p-5 sm:p-6 space-y-4">
                  {/* 정렬 옵션 */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f4f4f5] rounded-[8px] px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[#525252]">
                        정렬 기준
                      </span>
                      <select
                        value={logSortKey}
                        onChange={(e) => setLogSortKey(e.target.value)}
                        className="h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] px-2.5 text-[13px] text-[#171717] focus:outline-none focus:border-[#2563eb]"
                      >
                        <option value="timestamp">시간순</option>
                        <option value="action">처리 구분순</option>
                        <option value="playerName">선수명순</option>
                      </select>
                      <select
                        value={logSortOrder}
                        onChange={(e) => setLogSortOrder(e.target.value)}
                        className="h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] px-2.5 text-[13px] text-[#171717] focus:outline-none focus:border-[#2563eb]"
                      >
                        <option value="desc">내림차순</option>
                        <option value="asc">오름차순</option>
                      </select>
                    </div>
                    <span className="text-[12px] text-[#737373] font-mono tabular-nums">
                      총 {sortedLogs.length}건
                    </span>
                  </div>

                  {/* 로그 테이블 */}
                  <div className="overflow-x-auto border border-[#171717]/[0.08] rounded-[8px]">
                    <table className="w-full text-left text-[13px] border-collapse">
                      <thead>
                        <tr className="bg-[#f4f4f5] text-[#525252] border-b border-[#171717]/[0.08] h-10">
                          <th className="px-3 font-medium">처리 시각</th>
                          <th className="px-3 font-medium">구분</th>
                          <th className="px-3 font-medium">선수명</th>
                          <th className="px-3 font-medium">처리 계정</th>
                          <th className="px-3 font-medium">소속 조직</th>
                          <th className="px-3 font-medium">권한</th>
                          <th className="px-3 font-medium">IP</th>
                          <th className="px-3 font-medium">환경</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#171717]/[0.06]">
                        {paginatedLogs.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-4 py-10 text-center text-[13px] text-[#737373]"
                            >
                              기록된 입금 확인 로그가 없습니다
                            </td>
                          </tr>
                        ) : (
                          paginatedLogs.map((log) => {
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
                              <tr
                                key={log.id}
                                className="h-11 hover:bg-[#f4f4f5]/50 transition-colors duration-150"
                              >
                                <td className="px-3 font-mono text-[12px] tabular-nums text-[#525252]">
                                  {new Date(log.timestamp).toLocaleString(
                                    "ko-KR",
                                    {
                                      year: "numeric",
                                      month: "2-digit",
                                      day: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    }
                                  )}
                                </td>
                                <td className="px-3">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-medium ${
                                      log.action === "add"
                                        ? "bg-[#16a34a]/[0.08] text-[#16a34a]"
                                        : "bg-[#dc2626]/[0.08] text-[#dc2626]"
                                    }`}
                                  >
                                    {log.action === "add" ? "입금확인" : "확인해제"}
                                  </span>
                                </td>
                                <td className="px-3 font-medium text-[#171717]">
                                  {log.playerName || "-"}
                                </td>
                                <td className="px-3 font-mono text-[12px] text-[#525252]">
                                  {log.clientInfo?.userID || "-"}
                                </td>
                                <td className="px-3 text-[#525252]">
                                  {log.clientInfo?.userContext || "-"}
                                </td>
                                <td className="px-3 text-[#525252]">
                                  {log.clientInfo?.userGroup || "-"}
                                </td>
                                <td className="px-3 font-mono text-[12px] tabular-nums text-[#737373]">
                                  {log.clientInfo?.clientIp || "-"}
                                </td>
                                <td className="px-3 text-[12px] text-[#737373]">
                                  {deviceShort}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 로그 페이지네이션 */}
                  <div className="flex flex-wrap justify-between items-center gap-3 pt-1 text-[13px]">
                    <span className="text-[#737373] font-mono tabular-nums text-[12px]">
                      페이지 {logCurrentPage} / {Math.max(logTotalPages, 1)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={logCurrentPage === 1}
                        onClick={() => setLogCurrentPage((p) => p - 1)}
                        className="h-9 px-3 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] disabled:opacity-40 inline-flex items-center gap-1 text-[#171717] transition-colors duration-150"
                      >
                        <ChevronLeft size={15} strokeWidth={1.5} />
                        <span>이전</span>
                      </button>
                      <button
                        type="button"
                        disabled={
                          logCurrentPage === logTotalPages || logTotalPages === 0
                        }
                        onClick={() => setLogCurrentPage((p) => p + 1)}
                        className="h-9 px-3 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] disabled:opacity-40 inline-flex items-center gap-1 text-[#171717] transition-colors duration-150"
                      >
                        <span>다음</span>
                        <ChevronRight size={15} strokeWidth={1.5} />
                      </button>
                      <select
                        value={logItemsPerPage}
                        onChange={(e) => {
                          setLogItemsPerPage(parseInt(e.target.value, 10));
                          setLogCurrentPage(1);
                        }}
                        className="h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] px-2.5 text-[13px] text-[#171717] tabular-nums"
                      >
                        <option value={10}>10개씩</option>
                        <option value={20}>20개씩</option>
                        <option value={50}>50개씩</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 sm:p-6 space-y-4">
                  {/* 검색 바 */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#f4f4f5] rounded-[8px] p-2.5">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <div className="relative flex-1">
                        <Search
                          size={16}
                          strokeWidth={1.5}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] pointer-events-none"
                        />
                        <input
                          type="text"
                          placeholder="이름, 연락처, 소속 검색"
                          value={searchDraft}
                          onChange={(e) => setSearchDraft(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleSearch(searchDraft.trim())
                          }
                          className="w-full h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] pl-9 pr-8 text-[13px] text-[#171717] placeholder:text-[#737373] focus:outline-none focus:border-[#2563eb] transition-colors duration-150"
                        />
                        {searchDraft && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchDraft("");
                              handleSearch("");
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#171717]"
                          >
                            <X size={14} strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSearch(searchDraft.trim())}
                        className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[13px] font-medium shrink-0 transition-colors duration-150"
                      >
                        검색
                      </button>
                    </div>
                    <div className="text-[12px] text-[#737373] font-mono tabular-nums px-1">
                      조회 결과 {filteredData.length}건
                    </div>
                  </div>

                  <InvoiceTable
                    data={paginatedData}
                    handleInvoiceModal={handleInvoiceModal}
                    handleIsPriceCheckUpdate={handleIsPriceCheckUpdate}
                  />

                  {/* 페이지네이션 컨트롤 */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2 text-[13px] text-[#525252]">
                      <span>페이지당 표시</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(parseInt(e.target.value, 10));
                          setCurrentPage(1);
                        }}
                        className="h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] px-2.5 text-[13px] text-[#171717] tabular-nums focus:outline-none focus:border-[#2563eb]"
                      >
                        <option value={5}>5개</option>
                        <option value={10}>10개</option>
                        <option value={20}>20개</option>
                        <option value={50}>50개</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                        className="h-9 w-9 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] disabled:opacity-40 inline-flex items-center justify-center text-[#525252] transition-colors duration-150"
                      >
                        <ChevronLeft size={16} strokeWidth={1.5} />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => handlePageChange(page)}
                            className={`h-9 min-w-[36px] px-2.5 rounded-[8px] font-mono text-[13px] tabular-nums font-medium border transition-colors duration-150 ${
                              currentPage === page
                                ? "bg-[#2563eb] border-[#2563eb] text-white"
                                : "bg-white hover:bg-[#f4f4f5] border-[#171717]/[0.12] text-[#525252]"
                            }`}
                          >
                            {page}
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        disabled={currentPage >= totalPages || totalPages === 0}
                        onClick={() => handlePageChange(currentPage + 1)}
                        className="h-9 w-9 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] disabled:opacity-40 inline-flex items-center justify-center text-[#525252] transition-colors duration-150"
                      >
                        <ChevronRight size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <Drawer
              anchor="right"
              open={Boolean(isOpen.invoice)}
              onClose={handleInoviceClose}
              PaperProps={{
                sx: {
                  width: { xs: "100vw", sm: 580 },
                  bgcolor: "#ffffff",
                  boxShadow: "-12px 0 40px rgba(15, 23, 42, 0.14)",
                },
              }}
            >
              <div className="h-full w-full flex flex-col bg-white overflow-hidden">
                <InvoiceInfoModal
                  setClose={handleInoviceClose}
                  propState={isOpen}
                  setState={setInvoiceList}
                />
              </div>
            </Drawer>
          </>
        )}
      </div>
    </div>
  );
};

export default ContestInvoiceTable;
