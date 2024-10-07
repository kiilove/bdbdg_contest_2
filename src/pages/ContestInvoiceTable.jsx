import React, { useContext, useState, useEffect, useMemo } from "react";
import { BsCheckAll } from "react-icons/bs";
import { where } from "firebase/firestore";
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
  const [selectedInvoice, setSelectedInvoice] = useState(null);
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
    { id: 4, title: "유료서비스", subTitle: "유료서비스 신청된목록입니다." },
  ];

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

  useEffect(() => {
    if (currentContest?.contests?.id) fetchQuery(currentContest.contests.id);
  }, [currentContest?.contests?.id]);

  const filteredData = useMemo(() => {
    let data = invoiceList;
    if (searchInfo) {
      data = data.filter(
        (invoice) =>
          invoice.playerName.includes(searchInfo) ||
          invoice.playerTel.includes(searchInfo) ||
          invoice.playerGym.includes(searchInfo)
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

  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);
  const handleSearch = (keyword) => {
    setSearchInfo(keyword);
    setCurrentPage(1);
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

  const handleInoviceClose = () => {
    setIsOpen(() => ({
      invoice: false,
      title: "",
      info: {},
    }));
  };

  const closeModal = () => setModalOpen(false);

  const handleIsPriceCheckUpdate = async (invoiceId, playerUid, checked) => {
    setIsLoading(true);
    //initInvoice(playerUid);
    const findIndex = invoiceList.findIndex(
      (invoice) => invoice.id === invoiceId
    );
    const newInvoiceList = [...invoiceList];

    const newInvoice = {
      ...newInvoiceList[findIndex],
      isPriceCheck: checked,
    };

    newInvoiceList.splice(findIndex, 1, {
      ...newInvoice,
    });

    if (checked) {
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

    if (!checked) {
      initInvoice(playerUid);
    }

    await updateInvoice
      .updateData(invoiceId, { ...newInvoice })
      .then(() => setInvoiceList([...newInvoiceList]))
      .then(() => setIsLoading(false))
      .catch((error) => console.log(error));
  };

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
        </>
      )}
    </div>
  );
};

export default ContestInvoiceTable;
