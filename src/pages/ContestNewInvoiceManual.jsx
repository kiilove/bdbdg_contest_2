"use client";

import { useRef, useState, useContext, useEffect } from "react";
import { Save } from "lucide-react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreGetDocument,
} from "../hooks/useFirestores";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateToday, generateUUID } from "../functions/functions";
import BibTag from "../components/ui/BibTag";

const inputClass =
  "w-full h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] px-3 text-[14px] text-[#171717] placeholder:text-[#737373] focus:outline-none focus:border-[#2563eb] transition-colors duration-150";

const ContestNewInvoiceManual = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [invoiceInfo, setInvoiceInfo] = useState({});
  const [playerList, setPlayerList] = useState({});
  const [playerArray, setPlayerArray] = useState([]);

  const [categorysArray, setCategorysArray] = useState([]);
  const [categorysList, setCategorysList] = useState({});
  const [gradesArray, setGradesArray] = useState([]);
  const [entrysArray, setEntrysArray] = useState([]);

  const [addMsgOpen, setAddMsgOpen] = useState(false);
  const [unDelMsgOpen, setUnDelMsgOpen] = useState(false);
  const [message, setMessage] = useState({});
  const invoiceInfoRef = useRef({});

  void playerList;
  void setPlayerList;
  void playerArray;
  void setPlayerArray;
  void categorysList;
  void entrysArray;
  void setEntrysArray;
  void unDelMsgOpen;
  void setUnDelMsgOpen;

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");

  const addInvoice = useFirestoreAddData("invoices_pool");

  const fetchPool = async () => {
    if (!currentContest?.contests?.id) return;

    if (currentContest.contests.contestCategorysListId) {
      const returnCategorys = await fetchCategoryDocument.getDocument(
        currentContest.contests.contestCategorysListId
      );
      if (returnCategorys) {
        setCategorysList({ ...returnCategorys });
        setCategorysArray(
          Array.isArray(returnCategorys?.categorys)
            ? [...returnCategorys.categorys].sort(
                (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
              )
            : []
        );
      } else {
        setCategorysList({});
        setCategorysArray([]);
      }
    }

    if (currentContest.contests.contestGradesListId) {
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
      if (findIndex !== -1) {
        dummy.splice(findIndex, 1);
      }
    } else if (!findCategory) {
      dummy.push({ ...newValue });
    } else {
      dummy.splice(findIndex, 1, { ...newValue });
    }

    setInvoiceInfo({ ...newInvoiceInfo, joins: [...dummy] });
  };

  const initInvoiceInfo = () => {
    const contestObj = currentContest?.contests || {};
    const infoObj = currentContest?.contestInfo || {};

    const { id: contestId = "" } = contestObj;

    const {
      contestTitle = "",
      contestDate = "",
      contestLocation = "",
      contestPromoter = "",
      contestPriceBasic = 0,
      contestPriceExtra = 0,
      contestPriceExtraType = "누적",
      contestPriceType1 = 0,
      contestPriceType2 = 0,
    } = infoObj;

    const initInfo = {
      contestId: contestId,
      contestTitle,
      contestDate,
      contestLocation,
      contestPromoter,
      contestPriceBasic,
      contestPriceExtra,
      contestPriceExtraType,
      contestPriceType1,
      contestPriceType2,
      contestPriceSum: 0,
      playerUid: "",
      playerName: "",
      playerTel: "",
      playerEmail: "",
      playerBirth: "",
      playerGym: "",
      playerGender: "m",
      playerText: "",
      isPriceCheck: false,
      isCanceled: false,
      joins: [],
    };

    return initInfo;
  };

  const handleAddInvoice = async (propData) => {
    if (!propData?.joins?.length) {
      setMessage({
        variant: "warning",
        title: "출전 종목 선택 필요",
        body: "참가 신청할 종목과 체급을 1개 이상 선택해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setAddMsgOpen(true);
      return;
    }

    setMessage({
      variant: "loading",
      title: "수동 접수 등록 중",
      body: "참가신청 정보를 저장하고 있습니다.",
      isButton: false,
    });
    setAddMsgOpen(true);

    const rawPriceSum = String(propData?.contestPriceSum ?? 0).replace(
      /,/g,
      ""
    );
    const parsedPriceSum = Number.parseInt(rawPriceSum, 10);

    const added = await addInvoice.addData({
      ...propData,
      createBy: "manual",
      playerUid: generateUUID(),
      invoiceCreateAt: generateToday(),
      contestPriceSum: Number.isNaN(parsedPriceSum) ? 0 : parsedPriceSum,
    });
    if (added) {
      setMessage({
        variant: "success",
        title: "수동 접수 등록 완료",
        body: `${propData.playerName || "선수"}의 참가신청서가 정상적으로 등록되었습니다.`,
        body2: "참가신청서 목록에서 입금 확인 및 확정을 진행할 수 있습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setInvoiceInfo(initInvoiceInfo());
    } else {
      setMessage({
        variant: "error",
        title: "수동 접수 저장 실패",
        body: "저장 중 오류가 발생했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  useEffect(() => {
    if (!currentContest?.contests?.id) return;
    setInvoiceInfo(initInvoiceInfo());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests?.id]);

  useEffect(() => {
    if (!currentContest?.contests?.id) return;
    fetchPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests?.id]);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-6">
        <ConfirmationModal
          isOpen={addMsgOpen}
          onConfirm={() => setAddMsgOpen(false)}
          onCancel={() => setAddMsgOpen(false)}
          message={message}
        />

        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              참가신청서 수동 작성
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              현장 또는 유선으로 접수된 선수의 참가신청서를 수동으로 등록합니다
            </p>
          </div>
          {currentContest?.contests?.id && (
            <div>
              <button
                type="button"
                onClick={() => handleAddInvoice(invoiceInfo)}
                className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
              >
                <Save size={16} strokeWidth={1.5} />
                <span>신청서 저장</span>
              </button>
            </div>
          )}
        </header>

        {currentContest?.contests?.id ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 좌측: 선수 기본 정보 */}
            <section className="lg:col-span-6 bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
              <div className="border-b border-[#171717]/[0.06] pb-3">
                <h2 className="text-[15px] font-medium text-[#171717]">
                  선수 인적사항 및 참가비
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#525252]">
                    이름
                  </label>
                  <input
                    type="text"
                    name="playerName"
                    placeholder="선수 이름"
                    value={invoiceInfo.playerName || ""}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerName = ref)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#525252]">
                    성별
                  </label>
                  <select
                    name="playerGender"
                    value={invoiceInfo.playerGender || "m"}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerGender = ref)}
                    className={inputClass}
                  >
                    <option value="m">남성</option>
                    <option value="f">여성</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#525252]">
                    연락처
                  </label>
                  <input
                    type="text"
                    name="playerTel"
                    placeholder="010-0000-0000"
                    value={invoiceInfo.playerTel || ""}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerTel = ref)}
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#525252]">
                    생년월일
                  </label>
                  <input
                    type="text"
                    name="playerBirth"
                    placeholder="YYYY-MM-DD"
                    value={invoiceInfo.playerBirth || ""}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerBirth = ref)}
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#525252]">
                    소속
                  </label>
                  <input
                    type="text"
                    name="playerGym"
                    placeholder="소속이 없으면 무소속 입력"
                    value={invoiceInfo.playerGym || ""}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerGym = ref)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#525252]">
                    이메일
                  </label>
                  <input
                    type="email"
                    name="playerEmail"
                    placeholder="example@email.com"
                    value={invoiceInfo.playerEmail || ""}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerEmail = ref)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#525252]">
                  참가비용 합계
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    name="contestPriceSum"
                    value={invoiceInfo.contestPriceSum?.toLocaleString() ?? "0"}
                    placeholder="수동 계산 금액 입력"
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) =>
                      (invoiceInfoRef.current.contestPriceSum = ref)
                    }
                    className={`${inputClass} pr-8 text-right font-mono tabular-nums`}
                  />
                  <span className="absolute right-3 text-[13px] text-[#737373] pointer-events-none">
                    원
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#525252]">
                  출전 동기 및 메모
                </label>
                <textarea
                  name="playerText"
                  value={invoiceInfo.playerText || ""}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (invoiceInfoRef.current.playerText = ref)}
                  placeholder="출전 동기 또는 참고 메모 입력"
                  className="w-full h-24 rounded-[8px] bg-white border border-[#171717]/[0.12] px-3 py-2 text-[14px] text-[#171717] placeholder:text-[#737373] resize-none focus:outline-none focus:border-[#2563eb] transition-colors duration-150"
                />
              </div>
            </section>

            {/* 우측: 참가종목 선택 */}
            <section className="lg:col-span-6 bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#171717]/[0.06] pb-3">
                <h2 className="text-[15px] font-medium text-[#171717]">
                  참가 종목 및 체급 선택
                </h2>
                <span className="text-[12px] font-mono tabular-nums text-[#737373]">
                  선택됨 {(invoiceInfo?.joins || []).length}종목
                </span>
              </div>

              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {categorysArray?.length > 0 ? (
                  categorysArray.map((category, cIdx) => {
                    const {
                      contestCategoryId: categoryId,
                      contestCategoryIndex: categoryIndex,
                      contestCategoryTitle: categoryTitle,
                      contestCategoryPriceType: categoryType,
                    } = category;

                    const matchedGrades = gradesArray
                      .filter((grade) => grade.refCategoryId === categoryId)
                      .sort(
                        (a, b) => a.contestGradeIndex - b.contestGradeIndex
                      );

                    const selectedJoin = invoiceInfo?.joins?.find(
                      (join) => join.contestCategoryId === categoryId
                    );
                    const isSelected = Boolean(selectedJoin);

                    const selectVal = selectedJoin
                      ? `${selectedJoin.contestGradeId},${selectedJoin.contestGradeTitle},${categoryType}`
                      : "체급선택";

                    return (
                      <div
                        key={categoryId || cIdx}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-[8px] border transition-colors duration-150 ${
                          isSelected
                            ? "bg-[#2563eb]/[0.06] border-[#2563eb]/40"
                            : "bg-[#fafafa] border-[#171717]/[0.08] hover:border-[#171717]/[0.16]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <BibTag
                            number={categoryIndex ?? cIdx + 1}
                            size="sm"
                            variant={isSelected ? "active" : "default"}
                          />
                          <span
                            className={`text-[14px] font-medium ${
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
                          className={`h-9 sm:w-52 rounded-[8px] px-3 text-[13px] font-medium focus:outline-none transition-colors duration-150 ${
                            isSelected
                              ? "bg-white border border-[#2563eb]/50 text-[#2563eb]"
                              : "bg-white border border-[#171717]/[0.12] text-[#525252]"
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
                                    gradeId +
                                    "," +
                                    gradeTitle +
                                    "," +
                                    categoryType
                                  }
                                >
                                  {gradeTitle}
                                </option>
                              );
                            })}
                        </select>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-[13px] text-[#737373]">
                    등록된 종목이 없습니다
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#171717]/[0.06] flex justify-end">
                <button
                  type="button"
                  onClick={() => handleAddInvoice(invoiceInfo)}
                  className="w-full sm:w-auto h-10 px-6 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[14px] font-medium inline-flex items-center justify-center gap-2 transition-colors duration-150"
                >
                  <Save size={16} strokeWidth={1.5} />
                  <span>참가신청서 저장</span>
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-10 text-center text-[14px] text-[#737373]">
            상단에서 대회를 먼저 선택해주세요
          </div>
        )}
      </div>
    </div>
  );
};

export default ContestNewInvoiceManual;
