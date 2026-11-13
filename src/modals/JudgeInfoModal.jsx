import React, { useContext, useEffect, useRef, useState } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";

import {
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { FileText, Trash2, RotateCcw } from "lucide-react";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { where } from "firebase/firestore";

const initPlayerInfo = {
  contestPlayerIndex: "",
  contestPlayerId: "",
  contestPlayerName: "",
  contestPlayerPromoter: "",
  contestPlayerText: "",
  contestPlayerGender: "남",
  contestPlayerPhoneNumber: "",
  contestPlayerEmail: "",
};

const JudgeInfoModal = ({ setClose, propState, setState }) => {
  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );
  const [invoiceInfo, setInvoiceInfo] = useState({
    ...initPlayerInfo,
  });
  const [playerList, setPlayerList] = useState({});
  const [playerArray, setPlayerArray] = useState([]);

  const [categorysArray, setCategorysArray] = useState([]);
  const [categorysList, setCategorysList] = useState({});
  const [gradesArray, setGradesArray] = useState([]);
  const [entrysArray, setEntrysArray] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState({});
  const modalConfirmRef = useRef(null);
  const invoiceInfoRef = useRef({});

  const openModal = (nextMessage, onConfirmAction = null) => {
    modalConfirmRef.current = onConfirmAction;
    setMessage(nextMessage);
    setModalOpen(true);
  };

  const contestInvoiceDocument = useFirestoreGetDocument("invoices_pool");
  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const updateInvoice = useFirestoreUpdateData("invoices_pool");
  const deleteEntry = useFirestoreDeleteData("contest_entrys_list");
  const addEntry = useFirestoreAddData("contest_entrys_list");

  const getQuery = useFirestoreQuery();

  const fetchPool = async () => {
    if (currentContest.contests.contestCategorysListId) {
      const returnCategorys = await fetchCategoryDocument.getDocument(
        currentContest.contests.contestCategorysListId
      );
      setCategorysList({ ...returnCategorys });
      setCategorysArray([
        ...returnCategorys?.categorys.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        ),
      ]);

      const returnGrades = await fetchGradeDocument.getDocument(
        currentContest.contests.contestGradesListId
      );

      setGradesArray([...returnGrades?.grades]);
    }
  };

  const getInvoice = async () => {
    console.log(propState.info.id);
    const returnInvoices = await contestInvoiceDocument.getDocument(
      propState.info.id
    );
    console.log(returnInvoices);
    //setInvoiceInfo({ ...returnInvoices[0] });
  };

  const handleInputValues = (e) => {
    const { name, value } = e.target;

    setInvoiceInfo({
      ...invoiceInfo,
      [name]: value,
    });
  };

  const handleJoins = (e) => {
    const { name, id, value } = e.target;
    const splitValue = value.split(",");
    const gradeId = splitValue[0];
    const gradeTitle = splitValue[1];
    const categoryPriceType = splitValue[2];
    let dummy = [...invoiceInfo.joins];
    let newInvoiceInfo = { ...invoiceInfo };
    const findCategory = dummy.some(
      (category) => category.contestCategoryId === id
    );
    const findIndex = dummy.findIndex(
      (category) => category.contestCategoryId === id
    );

    const newValue = {
      contestCategoryId: id,
      contestCategoryTitle: name,
      contestCategoryPriceType: categoryPriceType,
      contestGradeId: gradeId,
      contestGradeTitle: gradeTitle,
    };

    if (gradeId === "체급선택") {
      dummy.splice(findIndex, 1);
    } else if (!findCategory) {
      dummy.push({ ...newValue });
    } else {
      dummy.splice(findIndex, 1, { ...newValue });
    }

    setInvoiceInfo({ ...newInvoiceInfo, joins: [...dummy] });
  };

  const handleOpenDelMsgBox = () => {
    openModal(
      {
        variant: "danger",
        title: "참가신청 취소(삭제) 확인",
        body: `${invoiceInfo?.playerName || "신청자"}의 참가신청을 취소 처리하시겠습니까?`,
        isButton: true,
        cancelButtonText: "닫기",
        confirmButtonText: "취소 처리",
      },
      handleCancelDo
    );
  };

  const handleOpenUnDelMsgBox = () => {
    openModal(
      {
        variant: "info",
        title: "참가신청 복원 확인",
        body: `${invoiceInfo?.playerName || "신청자"}의 참가신청을 복원하시겠습니까?`,
        isButton: true,
        cancelButtonText: "닫기",
        confirmButtonText: "복원",
      },
      handleCancelUndo
    );
  };

  const deleteInvocieJoins = async (contestId, playerUid) => {
    const invoiceCondition = [where("contestId", "==", contestId)];

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

  const handleCancelUndo = async () => {
    const dummy = [...propState.list];
    const findInvoiceIndex = dummy.findIndex(
      (invoice) => invoice.id === invoiceInfo.id
    );
    const newInvoiceInfo = {
      ...invoiceInfo,
      isCanceled: false,
      isPriceCheck: false,
    };
    dummy.splice(findInvoiceIndex, 1, newInvoiceInfo);

    await updateInvoice
      .updateData(invoiceInfo.id, { ...newInvoiceInfo })
      .then(
        async () =>
          findInvoiceIndex !== -1 &&
          (await deleteInvocieJoins(
            invoiceInfo.contestId,
            invoiceInfo.playerUid
          ))
      )
      .then(() => setState([...dummy]))
      .then(() => setModalOpen(false))
      .catch((error) => console.log(error));
  };
  const handleCancelDo = async () => {
    const dummy = [...propState.list];
    const findInvoiceIndex = dummy.findIndex(
      (invoice) => invoice.id === invoiceInfo.id
    );
    const newInvoiceInfo = {
      ...invoiceInfo,
      isCanceled: true,
      isPriceCheck: false,
    };
    dummy.splice(findInvoiceIndex, 1, newInvoiceInfo);

    await updateInvoice
      .updateData(invoiceInfo.id, { ...newInvoiceInfo })
      .then(
        async () =>
          findInvoiceIndex !== -1 &&
          (await deleteInvocieJoins(
            invoiceInfo.contestId,
            invoiceInfo.playerUid
          ))
      )
      .then(() => setState([...dummy]))
      .then(() => setModalOpen(false))
      .catch((error) => console.log(error));
  };

  useEffect(() => {
    //getInvoice();
    fetchPool();
    //invoiceInfoRef.current.playerName.focus();
  }, []);

  useEffect(() => {
    console.log(propState);
    setInvoiceInfo({ ...propState.info });
  }, [propState]);

  return (
    <div className="flex w-full flex-col gap-4 h-auto bg-[#ffffff] text-[#171717] p-2 overflow-y-auto">
      <ConfirmationModal
        isOpen={modalOpen}
        onCancel={() => {
          modalConfirmRef.current = null;
          setModalOpen(false);
        }}
        onConfirm={() => {
          const action = modalConfirmRef.current;
          modalConfirmRef.current = null;
          if (action) {
            action();
          } else {
            setModalOpen(false);
          }
        }}
        message={message}
      />

      <div className="flex w-full items-center justify-between gap-3 pb-3 border-b border-[#171717]/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] flex items-center justify-center">
            <FileText size={15} strokeWidth={1.5} className="text-[#525252]" />
          </div>
          <h1 className="text-base font-semibold text-[#171717] m-0">
            {propState?.title || "참가신청 정보"}
          </h1>
        </div>

        {invoiceInfo.isCanceled ? (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#b45309]/[0.08] hover:bg-[#b45309]/[0.14] text-[#b45309] text-xs font-medium border border-[#b45309]/25 transition-colors duration-150 cursor-pointer"
            onClick={() => handleOpenUnDelMsgBox()}
          >
            <RotateCcw size={14} strokeWidth={1.5} />
            <span>복원</span>
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#dc2626]/[0.06] hover:bg-[#dc2626]/[0.12] text-[#dc2626] text-xs font-medium border border-[#dc2626]/25 transition-colors duration-150 cursor-pointer"
            onClick={() => handleOpenDelMsgBox()}
          >
            <Trash2 size={14} strokeWidth={1.5} />
            <span>삭제</span>
          </button>
        )}
      </div>

      <div className="bg-[#fafafa] rounded-[12px] border border-[#171717]/[0.08] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            이름
          </label>
          <input
            type="text"
            value={invoiceInfo.playerName ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (invoiceInfoRef.current.playerName = ref)}
            name="playerName"
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            연락처
          </label>
          <input
            type="text"
            name="playerTel"
            value={invoiceInfo.playerTel ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (invoiceInfoRef.current.playerTel = ref)}
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm font-mono tabular-nums text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            생년월일
          </label>
          <input
            type="text"
            name="playerGym"
            value={invoiceInfo.playerBirth ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (invoiceInfoRef.current.playerBirth = ref)}
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm font-mono tabular-nums text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            소속
          </label>
          <input
            type="text"
            name="playerGym"
            value={invoiceInfo.playerGym ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (invoiceInfoRef.current.playerGym = ref)}
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            성별
          </label>
          <select
            name="playerGender"
            onChange={(e) => handleInputValues(e)}
            value={invoiceInfo.playerGender || "m"}
            ref={(ref) => (invoiceInfoRef.current.playerGender = ref)}
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          >
            <option value="m">남</option>
            <option value="f">여</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            이메일
          </label>
          <input
            type="email"
            name="playerEmail"
            value={invoiceInfo.playerEmail ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (invoiceInfoRef.current.playerEmail = ref)}
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            참가 비용
          </label>
          <input
            type="text"
            name="contestPriceSum"
            value={invoiceInfo.contestPriceSum?.toLocaleString() ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (invoiceInfoRef.current.contestPriceSum = ref)}
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm font-mono tabular-nums text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-start gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right pt-2">
            출전 동기
          </label>
          <textarea
            name="playerText"
            value={invoiceInfo.playerText ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (invoiceInfoRef.current.playerText = ref)}
            className="h-20 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] p-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-start gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right pt-2">
            참가 신청 종목
          </label>
          <div className="max-h-48 w-full rounded-[8px] border border-[#171717]/[0.12] bg-[#ffffff] p-2 overflow-y-auto space-y-1.5">
            {categorysArray?.length > 0 &&
              categorysArray.map((category) => {
                const {
                  contestCategoryId: categoryId,
                  contestCategoryTitle: categoryTitle,
                  contestCategoryPriceType: categoryType,
                } = category;

                const matchedGrades = gradesArray
                  .filter((grade) => grade.refCategoryId === categoryId)
                  .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex);

                const isSelectedCategory = invoiceInfo?.joins?.some(
                  (join) => join.contestCategoryId === categoryId
                );
                const selectedJoin = invoiceInfo?.joins?.find(
                  (join) => join.contestCategoryId === categoryId
                );

                return (
                  <div
                    key={categoryId}
                    className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-[6px] border transition-colors duration-150 ${
                      isSelectedCategory
                        ? "bg-[#2563eb]/[0.06] border-[#2563eb]/30"
                        : "bg-[#fafafa] border-[#171717]/[0.06]"
                    }`}
                  >
                    <span className="text-xs font-medium text-[#171717]">
                      {categoryTitle}
                    </span>
                    <select
                      id={categoryId}
                      name={categoryTitle}
                      value={
                        selectedJoin
                          ? `${selectedJoin.contestGradeId},${selectedJoin.contestGradeTitle},${categoryType}`
                          : "체급선택"
                      }
                      className="h-8 rounded-[6px] border border-[#171717]/[0.12] bg-[#ffffff] px-2 text-xs text-[#171717] outline-none"
                      onChange={(e) => handleJoins(e)}
                    >
                      <option value="체급선택">체급선택</option>
                      {matchedGrades?.length > 0 &&
                        matchedGrades.map((match) => {
                          const {
                            contestGradeId: gradeId,
                            contestGradeTitle: gradeTitle,
                          } = match;

                          return (
                            <option
                              key={gradeId}
                              id={gradeId}
                              value={
                                gradeId + "," + gradeTitle + "," + categoryType
                              }
                            >
                              {gradeTitle}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <div className="flex w-full justify-end gap-2 pt-1">
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] text-xs font-medium border border-[#171717]/[0.08] transition-colors duration-150 cursor-pointer"
          onClick={() => setClose()}
        >
          닫기
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 px-5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors duration-150 cursor-pointer border-0"
        >
          저장
        </button>
      </div>
    </div>
  );
};

export default JudgeInfoModal;
