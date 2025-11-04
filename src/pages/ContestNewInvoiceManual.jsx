"use client";

import { useRef, useState } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useContext } from "react";
import { useEffect } from "react";
import {
  useFirestoreAddData,
  useFirestoreGetDocument,
} from "../hooks/useFirestores";
import { BsCheckAll } from "react-icons/bs";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateToday, generateUUID } from "../functions/functions";

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
  const [message, setMessage] = useState("");
  const invoiceInfoRef = useRef({});

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");

  const addInvoice = useFirestoreAddData("invoices_pool");

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
    const dummy = [...invoiceInfo.joins];
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
      dummy.splice(findIndex, 1);
    } else if (!findCategory) {
      dummy.push({ ...newValue });
    } else {
      dummy.splice(findIndex, 1, { ...newValue });
    }

    setInvoiceInfo({ ...newInvoiceInfo, joins: [...dummy] });
  };

  const initInvoiceInfo = () => {
    const {
      invoicesPoolId: invoicePoolId,
      contestCategorysListId: categoryListId,
      contestGradesListId: gradeListId,
      contestNoticeId: noticeId,
      id: contestId,
    } = currentContest.contests;

    const {
      contestTitle,
      contestDate,
      contestLocation,
      contestPromoter,
      contestPriceBasic,
      contestPriceExtra,
      contestPriceExtraType,
      contestPriceType1,
      contestPriceType2,
    } = currentContest.contestInfo;

    const initInfo = {
      //invoicePoolId: invoicePoolId,
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
    setMessage({ body: "저장중", isButton: false });
    setAddMsgOpen(true);

    const added = await addInvoice.addData({
      ...propData,
      createBy: "manual",
      playerUid: generateUUID(),
      invoiceCreateAt: generateToday(),
      contestPriceSum: Number.parseInt(propData.contestPriceSum),
    });
    if (added) {
      console.log(added.data);
      setMessage({
        body: "저장되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setInvoiceInfo(initInvoiceInfo());
    }
  };

  useEffect(() => {
    if (currentContest?.contests.id) {
      setInvoiceInfo(initInvoiceInfo());
    }
  }, [currentContest?.contests?.id]);

  useEffect(() => {
    fetchPool();
  }, []);

  useEffect(() => {
    //console.log(invoiceInfo);
  }, [invoiceInfo]);

  useEffect(() => {
    console.log({ categorysArray, gradesArray });
  }, [categorysArray, gradesArray]);

  return (
    <>
      {currentContest?.contests?.id ? (
        <div className="flex w-full flex-col gap-y-3 h-auto pt-4 pb-10 lg:pt-0 lg:pb-0 overflow-y-auto px-2 lg:px-0">
          <ConfirmationModal
            isOpen={addMsgOpen}
            onConfirm={() => {
              setInvoiceInfo(initInvoiceInfo());
              setAddMsgOpen(false);
            }}
            onCancel={() => setAddMsgOpen(false)}
            message={message}
          />
          <div className="flex w-full h-auto min-h-14">
            <div className="flex w-full bg-gradient-to-r from-blue-50 to-cyan-50 justify-start items-center rounded-lg px-4 py-3 shadow-sm border border-blue-100">
              <div className="flex w-full items-center gap-x-3">
                <span className="font-sans text-lg font-semibold w-7 h-7 flex justify-center items-center rounded-full bg-blue-500 text-white flex-shrink-0">
                  <BsCheckAll />
                </span>
                <h1
                  className="font-sans text-base lg:text-lg font-semibold text-gray-800"
                  style={{ letterSpacing: "1px" }}
                >
                  참가신청서 수동작성
                </h1>
              </div>
            </div>
          </div>
          <div className="flex bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 p-4 rounded-lg shadow-sm border border-blue-100">
            <div className="flex w-full bg-white h-auto rounded-lg justify-start items-start flex-col p-4 lg:p-6 gap-y-4">
              <div className="flex w-full justify-start items-center gap-x-3">
                <div className="flex w-24 lg:w-28 justify-end flex-shrink-0">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    이름
                  </h3>
                </div>
                <div className="flex-1 h-10 lg:h-12 rounded-lg px-3 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all">
                  <input
                    type="text"
                    value={invoiceInfo.playerName}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerName = ref)}
                    name="playerName"
                    className="w-full h-full outline-none text-sm lg:text-base bg-transparent"
                  />
                </div>
              </div>
              <div className="flex w-full justify-start items-center gap-x-3">
                <div className="flex w-24 lg:w-28 justify-end flex-shrink-0">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    연락처
                  </h3>
                </div>
                <div className="flex-1 h-10 lg:h-12 rounded-lg px-3 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all">
                  <input
                    type="text"
                    name="playerTel"
                    placeholder="010-0000-0000 형식으로 입력"
                    value={invoiceInfo.playerTel}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerTel = ref)}
                    className="w-full h-full outline-none text-sm lg:text-base bg-transparent placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div className="flex w-full justify-start items-center gap-x-3">
                <div className="flex w-24 lg:w-28 justify-end flex-shrink-0">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    생년월일
                  </h3>
                </div>
                <div className="flex-1 h-10 lg:h-12 rounded-lg px-3 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all">
                  <input
                    type="text"
                    name="playerBirth"
                    placeholder="2000-01-01 형식으로 입력"
                    value={invoiceInfo.playerBirth}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerBirth = ref)}
                    className="w-full h-full outline-none text-sm lg:text-base bg-transparent placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div className="flex w-full justify-start items-center gap-x-3">
                <div className="flex w-24 lg:w-28 justify-end flex-shrink-0">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    소속
                  </h3>
                </div>
                <div className="flex-1 h-10 lg:h-12 rounded-lg px-3 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all">
                  <input
                    type="text"
                    name="playerGym"
                    value={invoiceInfo.playerGym}
                    placeholder="소속없거나 모르면 무소속"
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerGym = ref)}
                    className="w-full h-full outline-none text-sm lg:text-base bg-transparent placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="flex w-full justify-start items-center gap-x-3">
                <div className="flex w-24 lg:w-28 justify-end flex-shrink-0">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    성별
                  </h3>
                </div>
                <div className="flex-1 h-10 lg:h-12 rounded-lg bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all overflow-hidden">
                  <select
                    name="playerGender"
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerGender = ref)}
                    className="w-full h-full px-3 text-sm lg:text-base bg-transparent outline-none cursor-pointer"
                  >
                    <option
                      selected={invoiceInfo.playerGender === "m"}
                      value="m"
                    >
                      남
                    </option>
                    <option
                      selected={invoiceInfo.playerGender === "f"}
                      value="f"
                    >
                      여
                    </option>
                  </select>
                </div>
              </div>
              <div className="flex w-full justify-start items-center gap-x-3">
                <div className="flex w-24 lg:w-28 justify-end flex-shrink-0">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    이메일
                  </h3>
                </div>
                <div className="flex-1 h-10 lg:h-12 rounded-lg px-3 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all">
                  <input
                    type="email"
                    name="playerEmail"
                    value={invoiceInfo.playerEmail}
                    placeholder="abc@abc.com 형식으로 입력"
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerEmail = ref)}
                    className="w-full h-full outline-none text-sm lg:text-base bg-transparent placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div className="flex w-full justify-start items-center gap-x-3">
                <div className="flex w-24 lg:w-28 justify-end flex-shrink-0">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    참가비용
                  </h3>
                </div>
                <div className="flex-1 h-10 lg:h-12 rounded-lg px-3 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all">
                  <input
                    type="text"
                    name="contestPriceSum"
                    value={invoiceInfo.contestPriceSum?.toLocaleString()}
                    placeholder="참가비 수동으로 계산입력"
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) =>
                      (invoiceInfoRef.current.contestPriceSum = ref)
                    }
                    className="w-full h-full outline-none text-sm lg:text-base bg-transparent placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="flex w-full justify-start items-start gap-x-3">
                <div className="flex w-24 lg:w-28 justify-end flex-shrink-0 pt-2">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    출전동기
                  </h3>
                </div>
                <div className="flex-1 rounded-lg px-3 py-2 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all">
                  <textarea
                    name="playerText"
                    value={invoiceInfo.playerText}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerText = ref)}
                    className="w-full h-20 lg:h-24 outline-none text-sm lg:text-base bg-transparent resize-none placeholder:text-gray-400"
                    placeholder="출전동기를 입력해주세요"
                  />
                </div>
              </div>
              <div className="flex w-full justify-start items-start gap-x-3">
                <div className="flex w-24 lg:w-28 justify-end flex-shrink-0 pt-2">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    참가종목
                  </h3>
                </div>
                <div className="flex-1 rounded-lg p-3 bg-gray-50 border border-gray-200 max-h-80 overflow-y-auto">
                  <div className="flex flex-col w-full h-auto gap-y-2">
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
                          .sort(
                            (a, b) => a.contestGradeIndex - b.contestGradeIndex
                          );

                        const isSelected = invoiceInfo?.joins?.some(
                          (join) => join.contestCategoryId === categoryId
                        );

                        return (
                          <div
                            key={cIdx}
                            className={`flex flex-col lg:flex-row w-full border rounded-lg overflow-hidden transition-all ${
                              isSelected
                                ? "bg-blue-500 border-blue-600 shadow-md"
                                : "bg-white border-gray-200 hover:border-blue-300"
                            }`}
                          >
                            <div className="flex w-full lg:w-1/2 p-3 items-center">
                              <span
                                className={`text-sm lg:text-base font-medium ${
                                  isSelected ? "text-white" : "text-gray-800"
                                }`}
                              >
                                {categoryTitle}
                              </span>
                            </div>
                            <div className="flex w-full lg:w-1/2 p-3 lg:justify-end items-center border-t lg:border-t-0 lg:border-l border-gray-200">
                              <select
                                id={categoryId}
                                name={categoryTitle}
                                className={`w-full lg:w-auto text-sm lg:text-base px-2 py-1 rounded outline-none cursor-pointer ${
                                  isSelected
                                    ? "bg-blue-600 text-white border border-blue-400"
                                    : "bg-gray-50 text-gray-700 border border-gray-300"
                                }`}
                                onChange={(e) => handleJoins(e)}
                              >
                                <option>체급선택</option>
                                {matchedGrades?.length > 0 &&
                                  matchedGrades.map((match, mIdx) => {
                                    const {
                                      contestGradeId: gradeId,
                                      contestGradeTitle: gradeTitle,
                                      contestGradeIndex: gradeIndex,
                                    } = match;

                                    return (
                                      <option
                                        key={mIdx}
                                        className="text-sm"
                                        id={gradeId}
                                        selected={invoiceInfo?.joins?.some(
                                          (i) => i.contestGradeId === gradeId
                                        )}
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
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex w-full gap-x-2 h-auto">
            <button
              className="w-full h-12 lg:h-14 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg text-white font-semibold text-base lg:text-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
              onClick={() => handleAddInvoice(invoiceInfo)}
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <div></div>
      )}
    </>
  );
};

export default ContestNewInvoiceManual;
