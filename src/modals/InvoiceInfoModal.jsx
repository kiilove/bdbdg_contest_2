import React, { useContext, useEffect, useRef, useState } from "react";
import { Save, RotateCcw, Trash2, X } from "lucide-react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { where } from "firebase/firestore";
import BibTag from "../components/ui/BibTag";

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

const inputClass =
  "w-full h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] px-3 text-[13px] text-[#171717] placeholder:text-[#737373] focus:outline-none focus:border-[#2563eb] transition-colors duration-150";

const InvoiceInfoModal = ({ setClose, propState, setState }) => {
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

  const [delMsgOpen, setDelMsgOpen] = useState(false);
  const [unDelMsgOpen, setUnDelMsgOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveMsgOpen, setSaveMsgOpen] = useState(false);
  const [message, setMessage] = useState("");
  const invoiceInfoRef = useRef({});

  void setCurrentContest;
  void playerList;
  void setPlayerList;
  void playerArray;
  void setPlayerArray;
  void categorysList;
  void entrysArray;
  void setEntrysArray;

  const contestInvoiceDocument = useFirestoreGetDocument("invoices_pool");
  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const updateInvoice = useFirestoreUpdateData("invoices_pool");
  const deleteEntry = useFirestoreDeleteData("contest_entrys_list");
  const addEntry = useFirestoreAddData("contest_entrys_list");

  void contestInvoiceDocument;
  void addEntry;

  const getQuery = useFirestoreQuery();

  const fetchPool = async () => {
    if (currentContest?.contests?.contestCategorysListId) {
      const returnCategorys = await fetchCategoryDocument.getDocument(
        currentContest.contests.contestCategorysListId
      );
      setCategorysList({ ...returnCategorys });
      setCategorysArray(
        Array.isArray(returnCategorys?.categorys)
          ? [...returnCategorys.categorys].sort(
              (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
            )
          : []
      );

      const returnGrades = await fetchGradeDocument.getDocument(
        currentContest.contests.contestGradesListId
      );

      setGradesArray(
        Array.isArray(returnGrades?.grades) ? [...returnGrades.grades] : []
      );
    }
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
    const dummy = Array.isArray(invoiceInfo.joins)
      ? [...invoiceInfo.joins]
      : [];
    const newInvoiceInfo = { ...invoiceInfo };
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
      if (findIndex !== -1) dummy.splice(findIndex, 1);
    } else if (!findCategory) {
      dummy.push({ ...newValue });
    } else {
      dummy.splice(findIndex, 1, { ...newValue });
    }

    setInvoiceInfo({ ...newInvoiceInfo, joins: [...dummy] });
  };

  const handleOpenDelMsgBox = () => {
    setMessage({
      body: "참가신청을 삭제하시겠습니까?",
      isButton: true,
      cancelButtonText: "닫기",
      confirmButtonText: "삭제",
    });
    setDelMsgOpen(true);
  };

  const handleOpenUnDelMsgBox = () => {
    setMessage({
      body: "참가신청을 복원하시겠습니까?",
      isButton: true,
      cancelButtonText: "닫기",
      confirmButtonText: "복원",
    });
    setUnDelMsgOpen(true);
  };

  const deleteInvocieJoins = async (contestId, playerUid) => {
    const invoiceCondition = [where("contestId", "==", contestId)];

    const returnEntry = await getQuery.getDocuments(
      "contest_entrys_list",
      invoiceCondition
    );
    const filteredEntryByPlayerUid = (returnEntry || []).filter(
      (entry) => entry.playerUid === playerUid
    );

    if (filteredEntryByPlayerUid.length <= 0) {
      console.log("일치하는 선수명단이 없습니다.");
    }
    if (filteredEntryByPlayerUid.length > 0) {
      filteredEntryByPlayerUid.map(async (filter) => {
        await deleteEntry.deleteData(filter.id);
      });
    }
  };

  const updateInvoiceInList = (newInvoiceInfo) => {
    const dummy = [...(propState?.list || [])];
    const findInvoiceIndex = dummy.findIndex(
      (invoice) => invoice.id === newInvoiceInfo.id
    );
    if (findInvoiceIndex !== -1) {
      dummy.splice(findInvoiceIndex, 1, newInvoiceInfo);
      setState([...dummy]);
    }
  };

  const handleUpdateInvoice = async () => {
    setIsLoading(true);
    const newInvoice = { ...invoiceInfo };
    deleteInvocieJoins(newInvoice.contestId, newInvoice.playerUid);
    const cleanedPrice = String(invoiceInfo.contestPriceSum ?? 0).replace(
      /,/g,
      ""
    );
    newInvoice.contestPriceSum = parseInt(cleanedPrice, 10) || 0;
    newInvoice.isPriceCheck = false;
    newInvoice.invoiceEdited = true;
    try {
      await updateInvoice
        .updateData(newInvoice.id, { ...newInvoice })
        .then(() => {
          deleteInvocieJoins(newInvoice.contestId, newInvoice.playerUid);
          setIsLoading(false);
          setMessage(() => ({
            body: "수정이 완료되었습니다.",
            body2: "확정자도 미확정자로 이동되었습니다.",
            body3: "미확정자 목록에서 다시 한번 확인하세요.",
            isButton: true,
            confirmButtonText: "확인",
          }));
          updateInvoiceInList(newInvoice);
          setSaveMsgOpen(true);
        });
    } catch (error) {
      console.log(error);
      setIsLoading(false);
    }
  };

  const handleCancelUndo = async () => {
    const dummy = [...(propState?.list || [])];
    const findInvoiceIndex = dummy.findIndex(
      (invoice) => invoice.id === invoiceInfo.id
    );
    const newInvoiceInfo = {
      ...invoiceInfo,
      isCanceled: false,
      isPriceCheck: false,
    };
    if (findInvoiceIndex !== -1) {
      dummy.splice(findInvoiceIndex, 1, newInvoiceInfo);
    }

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
      .then(() => setUnDelMsgOpen(false))
      .catch((error) => console.log(error));
  };

  const handleCancelDo = async () => {
    const dummy = [...(propState?.list || [])];
    const findInvoiceIndex = dummy.findIndex(
      (invoice) => invoice.id === invoiceInfo.id
    );
    const newInvoiceInfo = {
      ...invoiceInfo,
      isCanceled: true,
      isPriceCheck: false,
    };
    if (findInvoiceIndex !== -1) {
      dummy.splice(findInvoiceIndex, 1, newInvoiceInfo);
    }

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
      .then(() => setDelMsgOpen(false))
      .catch((error) => console.log(error));
  };

  useEffect(() => {
    fetchPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (propState?.info) {
      setInvoiceInfo({ ...propState.info });
    }
  }, [propState]);

  const joinsList = Array.isArray(invoiceInfo?.joins) ? invoiceInfo.joins : [];

  return (
    <div className="flex flex-col w-full max-h-[90vh] bg-white text-[#171717]">
      <ConfirmationModal
        isOpen={delMsgOpen}
        onCancel={() => setDelMsgOpen(false)}
        onConfirm={handleCancelDo}
        message={message}
      />
      <ConfirmationModal
        isOpen={unDelMsgOpen}
        onCancel={() => setUnDelMsgOpen(false)}
        onConfirm={handleCancelUndo}
        message={message}
      />
      <ConfirmationModal
        isOpen={saveMsgOpen}
        onCancel={() => setSaveMsgOpen(false)}
        onConfirm={() => setSaveMsgOpen(false)}
        message={message}
      />

      {/* 모달 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#171717]/[0.08] bg-[#fafafa] shrink-0">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[16px] font-medium text-[#171717]">
            {propState?.title || "참가신청서 상세"}
          </h2>
          {invoiceInfo.isCanceled && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#dc2626]/[0.08] text-[#dc2626]">
              취소됨
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {invoiceInfo.isCanceled ? (
            <button
              type="button"
              onClick={() => handleOpenUnDelMsgBox()}
              className="h-8 px-3 rounded-[6px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150"
            >
              <RotateCcw size={13} strokeWidth={1.5} className="text-[#525252]" />
              <span>복원</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenDelMsgBox()}
              className="h-8 px-3 rounded-[6px] bg-[#dc2626]/[0.08] hover:bg-[#dc2626]/[0.14] text-[#dc2626] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150"
            >
              <Trash2 size={13} strokeWidth={1.5} />
              <span>신청 취소</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setClose()}
            aria-label="닫기"
            className="h-8 w-8 rounded-[6px] inline-flex items-center justify-center text-[#737373] hover:bg-[#f4f4f5] hover:text-[#171717] transition-colors duration-150"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 본문 폼 */}
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <label className="block text-[12px] font-medium text-[#525252]">
              이름
            </label>
            <input
              type="text"
              name="playerName"
              value={invoiceInfo.playerName || ""}
              onChange={(e) => handleInputValues(e)}
              ref={(ref) => (invoiceInfoRef.current.playerName = ref)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] font-medium text-[#525252]">
              성별
            </label>
            <select
              name="playerGender"
              value={invoiceInfo.playerGender || "m"}
              onChange={(e) => handleInputValues(e)}
              ref={(ref) => (invoiceInfoRef.current.playerGender = ref)}
              className={inputClass}
            >
              <option value="m">남</option>
              <option value="f">여</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] font-medium text-[#525252]">
              연락처
            </label>
            <input
              type="text"
              name="playerTel"
              value={invoiceInfo.playerTel || ""}
              onChange={(e) => handleInputValues(e)}
              ref={(ref) => (invoiceInfoRef.current.playerTel = ref)}
              className={`${inputClass} font-mono tabular-nums`}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] font-medium text-[#525252]">
              생년월일
            </label>
            <input
              type="text"
              name="playerBirth"
              value={invoiceInfo.playerBirth || ""}
              onChange={(e) => handleInputValues(e)}
              ref={(ref) => (invoiceInfoRef.current.playerBirth = ref)}
              className={`${inputClass} font-mono tabular-nums`}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] font-medium text-[#525252]">
              소속
            </label>
            <input
              type="text"
              name="playerGym"
              value={invoiceInfo.playerGym || ""}
              onChange={(e) => handleInputValues(e)}
              ref={(ref) => (invoiceInfoRef.current.playerGym = ref)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] font-medium text-[#525252]">
              참가비용
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                name="contestPriceSum"
                value={invoiceInfo.contestPriceSum?.toLocaleString() ?? "0"}
                onChange={(e) => handleInputValues(e)}
                ref={(ref) => (invoiceInfoRef.current.contestPriceSum = ref)}
                className={`${inputClass} pr-8 text-right font-mono tabular-nums`}
              />
              <span className="absolute right-3 text-[12px] text-[#737373] pointer-events-none">
                원
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-[12px] font-medium text-[#525252]">
            이메일
          </label>
          <input
            type="email"
            name="playerEmail"
            value={invoiceInfo.playerEmail || ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (invoiceInfoRef.current.playerEmail = ref)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[12px] font-medium text-[#525252]">
            출전 동기
          </label>
          <textarea
            name="playerText"
            value={invoiceInfo.playerText || ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (invoiceInfoRef.current.playerText = ref)}
            className="w-full h-16 rounded-[8px] bg-white border border-[#171717]/[0.12] px-3 py-2 text-[13px] text-[#171717] resize-none focus:outline-none focus:border-[#2563eb] transition-colors duration-150"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[12px] font-medium text-[#525252]">
              참가 신청 종목
            </label>
            <span className="font-mono text-[11px] tabular-nums text-[#737373]">
              선택됨 {joinsList.length}종목
            </span>
          </div>
          <div className="rounded-[8px] border border-[#171717]/[0.08] bg-[#fafafa] p-2.5 max-h-56 overflow-y-auto space-y-1.5">
            {categorysArray?.length > 0 &&
              categorysArray.map((category, cIdx) => {
                const {
                  contestCategoryId: categoryId,
                  contestCategoryIndex: categoryIndex,
                  contestCategoryTitle: categoryTitle,
                  contestCategoryPriceType: categoryType,
                } = category;

                const matchedGrades = gradesArray
                  .filter((grade) => grade.refCategoryId === categoryId)
                  .sort((a, b) => a.contestGradeIndex - b.contestGradeIndex);

                const selectedJoin = joinsList.find(
                  (join) => join.contestCategoryId === categoryId
                );
                const isSelected = Boolean(selectedJoin);

                const selectVal = selectedJoin
                  ? `${selectedJoin.contestGradeId},${selectedJoin.contestGradeTitle},${categoryType}`
                  : "체급선택";

                return (
                  <div
                    key={categoryId || cIdx}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-[6px] border transition-colors duration-150 ${
                      isSelected
                        ? "bg-[#2563eb]/[0.06] border-[#2563eb]/40"
                        : "bg-white border-[#171717]/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <BibTag
                        number={categoryIndex ?? cIdx + 1}
                        size="sm"
                        variant={isSelected ? "active" : "default"}
                      />
                      <span
                        className={`text-[13px] font-medium truncate ${
                          isSelected ? "text-[#2563eb]" : "text-[#171717]"
                        }`}
                      >
                        {categoryTitle}
                      </span>
                    </div>
                    <select
                      id={categoryId}
                      name={categoryTitle}
                      value={selectVal}
                      onChange={(e) => handleJoins(e)}
                      className={`h-8 rounded-[6px] px-2 text-[12px] font-medium focus:outline-none ${
                        isSelected
                          ? "bg-white border border-[#2563eb]/50 text-[#2563eb]"
                          : "bg-[#fafafa] border border-[#171717]/[0.12] text-[#525252]"
                      }`}
                    >
                      <option value="체급선택">체급선택</option>
                      {matchedGrades?.length > 0 &&
                        matchedGrades.map((match, mIdx) => {
                          const {
                            contestGradeId: gradeId,
                            contestGradeTitle: gradeTitle,
                          } = match;

                          return (
                            <option
                              key={gradeId || mIdx}
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

      {/* 모달 푸터 */}
      <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#171717]/[0.08] bg-[#fafafa] shrink-0">
        <button
          type="button"
          onClick={() => setClose()}
          className="h-9 px-4 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] text-[13px] font-medium transition-colors duration-150"
        >
          닫기
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => handleUpdateInvoice()}
          className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150"
        >
          <Save size={15} strokeWidth={1.5} />
          <span>{isLoading ? "저장 중" : "수정 저장"}</span>
        </button>
      </div>
    </div>
  );
};

export default InvoiceInfoModal;
