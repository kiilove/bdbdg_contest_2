import React, { useContext } from "react";
import { useState } from "react";
import { BsCheckAll } from "react-icons/bs";
import { MdOutlineSearch } from "react-icons/md";
import ReactVirtualizedTable from "../components/VirtualizedTable";
import {
  useFirestoreQuery,
  useFirestoreUpdateData,
  useFirestoreAddData,
  useFirestoreDeleteData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useEffect } from "react";
import { useMemo } from "react";
import LoadingPage from "./LoadingPage";
import { Link } from "react-router-dom";
import { Modal } from "@mui/material";
import InvoiceInfoModal from "../modals/InvoiceInfoModal";

const ContestInvoiceTable = () => {
  const [currentTab, setCurrentTab] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceList, setInvoiceList] = useState([]);
  const [entryList, setEntryList] = useState([]);
  const [searchInfo, setSearchInfo] = useState();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10); // Items per page state
  const [currentPage, setCurrentPage] = useState(1); // Current page state

  const [isOpen, setIsOpen] = useState({
    category: false,
    grade: false,
    player: false,
    categoryId: "",
    gradeId: "",
  });
  //const [filteredInvoiceList, setFilteredInvoiceList] = useState([]);
  const { currentContest } = useContext(CurrentContestContext);
  const getQuery = useFirestoreQuery();
  const updateInvoice = useFirestoreUpdateData("invoices_pool");
  const deleteEntry = useFirestoreDeleteData("contest_entrys_list");
  const addEntry = useFirestoreAddData("contest_entrys_list");

  const fetchQuery = async (contestId) => {
    setIsLoading(true);
    const invoiceCondition = [where("contestId", "==", contestId)];
    //lYp6h55jtZzQRYDvHToe
    const invoiceData = await getQuery.getDocuments(
      "invoices_pool",
      invoiceCondition
    );
    console.log(invoiceData);

    const entryData = await getQuery.getDocuments(
      "contest_entrys_list",
      invoiceCondition
    );

    if (invoiceData?.length > 0) {
      setInvoiceList([...invoiceData]);
    } else {
      setInvoiceList([]);
    }
    if (entryData?.length > 0) {
      setEntryList([...entryData]);
    } else {
      setEntryList([]);
    }

    setIsLoading(false);
    console.log(invoiceList);
  };

  const filteredData = useMemo(() => {
    setIsLoading(true);
    let newData = [];
    if (invoiceList?.length > 0) {
      switch (currentTab) {
        case 0:
          newData = invoiceList.filter(
            (invoice) =>
              invoice.playerName.includes(searchKeyword) ||
              invoice.playerTel.includes(searchKeyword) ||
              invoice.playerGym.includes(searchKeyword)
          );

          break;
        case 1:
          newData = invoiceList.filter(
            (invoice) =>
              !invoice.isPriceCheck &&
              !invoice.isCanceled &&
              (invoice.playerName.includes(searchKeyword) ||
                invoice.playerTel.includes(searchKeyword) ||
                invoice.playerGym.includes(searchKeyword))
          );
          break;
        case 2:
          newData = invoiceList.filter(
            (invoice) =>
              invoice.isPriceCheck &&
              !invoice.isCanceled &&
              (invoice.playerName.includes(searchKeyword) ||
                invoice.playerTel.includes(searchKeyword) ||
                invoice.playerGym.includes(searchKeyword))
          );
          break;
        case 3:
          newData = invoiceList.filter(
            (invoice) =>
              invoice.isCanceled &&
              (invoice.playerName.includes(searchKeyword) ||
                invoice.playerTel.includes(searchKeyword) ||
                invoice.playerGym.includes(searchKeyword))
          );
          break;

        case 4:
          newData = invoiceList.filter(
            (invoice) =>
              invoice.isPriceCheck &&
              !invoice.isCanceled &&
              invoice.playerService &&
              (invoice.playerName.includes(searchKeyword) ||
                invoice.playerTel.includes(searchKeyword) ||
                invoice.playerGym.includes(searchKeyword))
          );
          break;

        default:
          break;
      }
    }
    setIsLoading(false);
    return newData;
  }, [currentTab, invoiceList, searchKeyword, currentContest?.contests?.id]);

  const tabArray = [
    {
      id: 0,
      title: "전체목록",
      subTitle: "접수된 전체 신청서목록입니다.",
      children: "",
    },
    {
      id: 1,
      title: "미확정목록",
      subTitle: "입금확인이 필요한 신청서목록입니다.",
      children: "",
    },
    {
      id: 2,
      title: "확정목록",
      subTitle: "입금확인된 신청서목록입니다.",
      children: "",
    },
    {
      id: 3,
      title: "취소목록",
      subTitle: "참가신청후 취소된목록입니다.",
      children: "",
    },
    {
      id: 4,
      title: "유료서비스",
      subTitle: "유료서비스 신청된목록입니다.",
      children: "",
    },
  ];

  const handleInoviceClose = () => {
    setIsOpen(() => ({
      invoice: false,
      title: "",
      info: {},
    }));
  };
  const handleInvoiceModal = (invoiceId, invoiceInfo) => {
    if (invoiceId) {
      setIsOpen(() => ({
        invoice: true,
        title: "신청서확인",
        info: invoiceInfo,
        list: invoiceList,
        setList: setInvoiceList,
      }));
    }
  };

  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    return filteredData.slice(startIdx, endIdx);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleSearchKeyword = () => {
    if (searchInfo === "") {
      setSearchKeyword(""); // Clear the filter to show all data
    } else {
      setSearchKeyword(searchInfo); // Apply the search filter
    }
    setCurrentPage(1); // Reset pagination to the first page
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset page to 1 when items per page change
  };

  const pageNumbers = [...Array(totalPages)].map((_, i) => i + 1);

  const initInvoice = async (playerUid) => {
    const invoiceCondition = [
      where("contestId", "==", currentContest.contests.id),
    ];

    const returnEntry = await getQuery.getDocuments(
      "contest_entrys_list",
      invoiceCondition
    );
    const filteredEntryByPlayerUid = returnEntry.filter(
      (entry) => entry.playerUid === playerUid
    );

    if (filteredEntryByPlayerUid <= 0) {
      console.log("일치하는 선수명단이 없습니다.");
    }
    if (filteredEntryByPlayerUid) {
      filteredEntryByPlayerUid.map(async (filter, fIdx) => {
        await deleteEntry.deleteData(filter.id);
      });
    }
  };

  const handleIsPriceCheckUpdate = async (invoiceId, playerUid, e) => {
    setIsLoading(true);
    //initInvoice(playerUid);
    const findIndex = invoiceList.findIndex(
      (invoice) => invoice.id === invoiceId
    );
    const newInvoiceList = [...invoiceList];

    const newInvoice = {
      ...newInvoiceList[findIndex],
      isPriceCheck: e.target.checked,
    };

    newInvoiceList.splice(findIndex, 1, {
      ...newInvoice,
    });

    if (e.target.checked) {
      //initInvoice();
      if (newInvoiceList[findIndex].joins.length > 0) {
        const {
          contestId,
          playerUid,
          playerName,
          playerBirth,
          playerGym,
          playerTel,
          playerText,
          invoiceCreateAt,
          createBy,
        } = newInvoiceList[findIndex];
        newInvoiceList[findIndex].joins.map(async (join, jIdx) => {
          const {
            contestCategoryTitle,
            contestCategoryId,
            contestGradeTitle,
            contestGradeId,
          } = join;

          const entryInfo = {
            contestId,
            invoiceId,
            playerUid,
            playerName,
            playerBirth,
            playerGym,
            playerTel,
            playerText,
            invoiceCreateAt,
            createBy: createBy || "web",
            contestCategoryTitle,
            contestCategoryId,
            contestGradeTitle,
            contestGradeId,
            originalGradeTitle: contestGradeTitle,
            originalGradeId: contestGradeId,
            isGradeChanged: false,
          };

          await addEntry.addData({ ...entryInfo });
        });
      }
    }

    if (!e.target.checked) {
      initInvoice(playerUid);
    }

    await updateInvoice
      .updateData(invoiceId, { ...newInvoice })
      .then(() => setInvoiceList([...newInvoiceList]))
      .then(() => setIsLoading(false))
      .catch((error) => console.log(error));
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchQuery(currentContest.contests.id);
    }
    //console.log(currentContest?.contests?.contestNoticeId);
  }, [currentContest?.contests?.id]);

  useEffect(() => {
    //console.log(filteredData);
  }, [filteredData]);

  useEffect(() => {
    // If searchInfo is empty, reset searchKeyword to show all data
    if (searchInfo === "") {
      setSearchKeyword(""); // Show all items
    }
  }, [searchInfo]); // This will trigger whenever searchInfo changes

  const ContestInvoiceUncompleteRender = (
    <div className="flex flex-col lg:flex-row gap-y-2 w-full h-auto bg-white mb-3 rounded-tr-lg rounded-b-lg p-2 gap-x-4">
      <Modal open={isOpen.invoice} onClose={handleInoviceClose}>
        <div
          className="flex w-full lg:w-1/2 h-screen lg:h-auto absolute top-1/2 left-1/2 lg:shadow-md lg:rounded-lg bg-white p-3"
          style={{
            transform: "translate(-50%, -50%)",
          }}
        >
          <InvoiceInfoModal
            setClose={handleInoviceClose}
            propState={isOpen}
            setState={setInvoiceList}
          />
        </div>
      </Modal>
      <div className="w-full bg-blue-100 flex rounded-lg flex-col p-2 h-full gap-y-2">
        <div className="flex bg-gray-100 h-auto rounded-lg justify-start categoryIdart lg:items-center gay-y-2 flex-col p-2 gap-y-2">
          <div className="flex w-full justify-start items-center ">
            <div className="h-12 w-full rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center h-full">
                <h1 className="text-2xl text-gray-600 mr-3">
                  <MdOutlineSearch />
                </h1>
                <input
                  type="text"
                  name="contestCategoryTitle"
                  value={searchInfo}
                  onChange={(e) => {
                    setSearchInfo(e.target.value); // Remove trim here
                    if (e.target.value === "") {
                      // Check for empty value directly
                      handleSearchKeyword(); // Show all items
                    }
                  }}
                  onKeyDown={(e) => {
                    e.key === "Enter" && handleSearchKeyword();
                  }}
                  className="h-12 outline-none w-full"
                  placeholder="검색(이름, 전화번호, 소속)"
                />

                <button
                  className="w-20 bg-blue-200 h-full"
                  onClick={handleSearchKeyword}
                >
                  검색
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex bg-gray-100 h-auto rounded-lg justify-start categoryIdart lg:items-center gay-y-2 flex-col p-0 lg:p-2 gap-y-2">
          <div className="flex w-full justify-start items-center ">
            <div className="w-full rounded-lg px-0 lg:px-3 h-auto py-0 lg:py-2">
              <table className="w-full bg-white">
                <tr className="bg-gray-200 h-10">
                  <th className="w-1/12 text-center text-sm font-normal lg:font-semibold lg:text-base">
                    입금확인
                  </th>
                  <th className="text-left w-1/12 text-sm font-normal lg:font-semibold lg:text-base">
                    이름
                  </th>
                  <th className="text-left w-2/12 text-sm font-normal lg:font-semibold lg:text-base">
                    연락처
                  </th>
                  <th className="text-left w-2/12 hidden lg:table-cell">
                    생년월일
                  </th>
                  <th className="text-left w-2/12 hidden lg:table-cell">
                    소속
                  </th>
                  <th className="text-left w-2/12 hidden lg:table-cell">
                    신청종목
                  </th>
                  <th className="text-left w-1/12 text-sm font-normal lg:font-semibold lg:text-base">
                    참가비용
                  </th>
                </tr>
                {paginatedData?.length > 0 &&
                  paginatedData.map((filtered, fIdx) => {
                    const {
                      id,
                      joins,
                      playerUid,
                      playerName,
                      playerTel,
                      playerBirth,
                      playerGym,
                      isPriceCheck,
                      isCanceled,
                      invoiceEdited,
                      contestPriceSum,
                    } = filtered;

                    return (
                      <tr className="border border-t-0 border-x-0" key={id}>
                        <td className="text-center w-1/12 h-10">
                          {isCanceled ? (
                            <span className="text-sm">불가</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isPriceCheck}
                              onClick={(e) =>
                                handleIsPriceCheckUpdate(id, playerUid, e)
                              }
                            />
                          )}
                        </td>
                        <td className="text-left w-1/12 text-sm lg:text-lg">
                          <div className="flex flex-col">
                            <span
                              onClick={() => handleInvoiceModal(id, filtered)}
                              className={`${
                                isCanceled
                                  ? " cursor-pointer line-through text-gray-500"
                                  : " cursor-pointer underline"
                              } `}
                            >
                              {playerName}
                            </span>
                            {isCanceled && (
                              <span className="bg-red-300 text-center">
                                취소신청됨
                              </span>
                            )}
                            {!isCanceled && invoiceEdited && !isPriceCheck && (
                              <span>변경신청됨</span>
                            )}
                          </div>
                        </td>
                        <td className="text-left w-2/12 text-sm  lg:text-lg">
                          {playerTel}
                        </td>
                        <td className="text-left w-2/12 hidden lg:table-cell text-sm  lg:text-lg">
                          {playerBirth}
                        </td>
                        <td className="text-left w-2/12 hidden lg:table-cell text-sm  lg:text-lg">
                          {playerGym}
                        </td>
                        <td className="text-left w-2/12 hidden lg:table-cell text-sm ">
                          {joins?.length > 0 &&
                            joins.map((join, jIdx) => {
                              const {
                                contestCategoryTitle,
                                contestGradeTitle,
                              } = join;

                              return (
                                <div className="flex w-full h-8 justify-start items-center">
                                  {contestCategoryTitle +
                                    "(" +
                                    contestGradeTitle +
                                    ")"}
                                </div>
                              );
                            })}
                        </td>
                        <td className="text-left w-1/12  text-sm  lg:text-lg">
                          {contestPriceSum &&
                            parseInt(contestPriceSum).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
              </table>
              {/* Paging controls */}
              <div className="flex flex-col sm:flex-row justify-between mt-4 items-center">
                {/* Items per page selector */}
                <div className="flex items-center mb-2 sm:mb-0">
                  <span className="mr-2">한 페이지당 표시할 목록 갯수:</span>
                  <select
                    value={itemsPerPage}
                    onChange={handleItemsPerPageChange}
                    className="px-2 py-1 border rounded"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                {/* Page numbers for larger screens */}
                <div className="hidden sm:flex space-x-2">
                  {pageNumbers.map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 border rounded ${
                        currentPage === page
                          ? "bg-blue-500 text-white"
                          : "bg-white"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                {/* Mobile pagination controls (visible only on small screens) */}
                <div className="flex sm:hidden justify-between items-center w-full mt-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
                  >
                    이전
                  </button>
                  <span>
                    페이지 {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-3 gap-y-2">
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <>
          <div className="flex w-full h-14">
            <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
              <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
                <BsCheckAll />
              </span>
              <h1
                className="font-sans text-lg font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                참가신청서
              </h1>
            </div>
          </div>
          <div className="flex w-full h-full ">
            <div className="flex w-full justify-start items-center">
              <div className="flex w-full h-full justify-start categoryIdart px-3 pt-3 flex-col bg-gray-100 rounded-lg">
                <div className="flex w-full">
                  {tabArray.map((tab, tIdx) => (
                    <>
                      <button
                        className={`${
                          currentTab === tab.id
                            ? " flex w-auto h-10 bg-white px-4"
                            : " flex w-auto h-10 bg-gray-100 px-4"
                        }  h-14 rounded-t-lg justify-center items-center`}
                        onClick={() => setCurrentTab(tIdx)}
                      >
                        <span>{tab.title}</span>
                      </button>
                    </>
                  ))}
                </div>

                {(currentTab === 0 || currentTab) &&
                  ContestInvoiceUncompleteRender}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ContestInvoiceTable;
