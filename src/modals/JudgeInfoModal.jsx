import React, { useContext, useEffect, useRef, useState } from "react";
import { BiCategory } from "react-icons/bi";
import { CurrentContestContext } from "../contexts/CurrentContestContext";

import {
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { TbUsers } from "react-icons/tb";
import { BsCheckAll } from "react-icons/bs";
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

  const [delMsgOpen, setDelMsgOpen] = useState(false);
  const [unDelMsgOpen, setUnDelMsgOpen] = useState(false);
  const [message, setMessage] = useState("");
  const invoiceInfoRef = useRef({});

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
      body: "참가신청를 복원하시겠습니까?",
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
      .then(() => setUnDelMsgOpen(false))
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
      .then(() => setDelMsgOpen(false))
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
    <div className="flex w-full flex-col gap-y-2 h-auto pt-4 pb-10 lg:pt-0 lg:pb-0 overflow-y-auto">
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
      <div className="flex w-full h-14">
        <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
          <div className="flex w-5/6">
            <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
              <BsCheckAll />
            </span>
            <h1
              className="font-sans text-lg font-semibold"
              style={{ letterSpacing: "2px" }}
            >
              {propState?.title || ""}
            </h1>
          </div>
          <div className="flex w-1/6">
            {invoiceInfo.isCanceled ? (
              <button
                className="w-full h-12 bg-gradient-to-r from-orange-300 to-red-300 rounded-lg text-sm"
                onClick={() => handleOpenUnDelMsgBox()}
              >
                복원
              </button>
            ) : (
              <button
                className="w-full h-12 bg-gradient-to-r from-orange-300 to-red-300 rounded-lg text-sm"
                onClick={() => handleOpenDelMsgBox()}
              >
                삭제
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex bg-gradient-to-r from-blue-200 to-cyan-200 p-3 rounded-lg">
        <div className="flex w-full bg-gray-100 h-auto rounded-lg justify-start items-start lg:items-center gay-y-2 flex-col p-2 gap-y-2">
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold text-sm lg:text-base"
                style={{ letterSpacing: "2px" }}
              >
                이름
              </h3>
            </div>
            <div className="h-8 lg:h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  value={invoiceInfo.playerName}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (invoiceInfoRef.current.playerName = ref)}
                  name="playerName"
                  className="h-8 lg:h-12 outline-none text-sm lg:text-base"
                />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold text-sm lg:text-base"
                style={{ letterSpacing: "2px" }}
              >
                연락처
              </h3>
            </div>
            <div className="h-8 lg:h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="playerTel"
                  value={invoiceInfo.playerTel}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (invoiceInfoRef.current.playerTel = ref)}
                  className="h-8 lg:h-12 outline-none  text-sm lg:text-base"
                />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold text-sm lg:text-base"
                style={{ letterSpacing: "2px" }}
              >
                생년월일
              </h3>
            </div>
            <div className="h-8 lg:h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="playerGym"
                  value={invoiceInfo.playerBirth}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (invoiceInfoRef.current.playerBirth = ref)}
                  className="h-8 lg:h-12 outline-none text-sm lg:text-base"
                />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold text-sm lg:text-base"
                style={{ letterSpacing: "2px" }}
              >
                소속
              </h3>
            </div>
            <div className="h-8 lg:h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="playerGym"
                  value={invoiceInfo.playerGym}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (invoiceInfoRef.current.playerGym = ref)}
                  className="h-8 lg:h-12 outline-none text-sm lg:text-base"
                />
              </div>
            </div>
          </div>

          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold text-sm lg:text-base"
                style={{ letterSpacing: "2px" }}
              >
                성별
              </h3>
            </div>
            <div className="h-8 lg:h-12 w-3/4 rounded-lg">
              <div className="flex w-full justify-start items-center h-8 lg:h-12 bg-white rounded-lg">
                <select
                  name="playerGender"
                  onChange={(e) => handleInputValues(e)}
                  //value={invoiceInfo.playerGender}

                  ref={(ref) => (invoiceInfoRef.current.playerGender = ref)}
                  className="w-full h-full pl-2 text-sm lg:text-base bg-transparent rounded-lg"
                >
                  <option selected={invoiceInfo.playerGender === "m"} value="m">
                    남
                  </option>
                  <option selected={invoiceInfo.playerGender === "f"} value="f">
                    여
                  </option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold text-sm lg:text-base"
                style={{ letterSpacing: "2px" }}
              >
                이메일
              </h3>
            </div>
            <div className="h-8 lg:h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="email"
                  name="playerEmail"
                  value={invoiceInfo.playerEmail}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (invoiceInfoRef.current.playerEmail = ref)}
                  className="h-8 lg:h-12 outline-none text-sm lg:text-base"
                />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold text-sm lg:text-base"
                style={{ letterSpacing: "2px" }}
              >
                참가비용
              </h3>
            </div>
            <div className="h-8 lg:h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="email"
                  name="contestPriceSum"
                  value={invoiceInfo.contestPriceSum?.toLocaleString()}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (invoiceInfoRef.current.contestPriceSum = ref)}
                  className="h-8 lg:h-12 outline-none text-sm lg:text-base"
                />
              </div>
            </div>
          </div>

          <div className="flex w-full justify-start items-center h-auto ">
            <div className="flex w-1/4 justify-end mr-2 h-14 items-start">
              <h3
                className="font-sans font-semibold text-sm lg:text-base"
                style={{ letterSpacing: "2px" }}
              >
                출전동기
              </h3>
            </div>
            <div className="h-auto w-3/4 rounded-lg px-3 bg-white pt-1">
              <div className="flex w-full justify-start items-center">
                <textarea
                  name="playerText"
                  value={invoiceInfo.playerText}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (invoiceInfoRef.current.playerText = ref)}
                  className="h-16 outline-none w-full text-sm lg:text-base"
                />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center h-auto ">
            <div className="flex w-1/4 justify-end mr-2 h-full items-start">
              <h3
                className="font-sans font-semibold text-sm lg:text-base"
                style={{ letterSpacing: "2px" }}
              >
                참가신청종목
              </h3>
            </div>
            <div className="h-44 w-3/4 rounded-lg px-3 bg-white pt-1 overflow-y-auto">
              <div className="flex w-full justify-start items-center">
                <div className="flex flex-col w-full h-auto gap-y-1">
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

                      return (
                        <div
                          className={`${
                            invoiceInfo?.joins.some(
                              (join) => join.contestCategoryId === categoryId
                            )
                              ? "flex w-full  border  bg-blue-300 rounded-lg"
                              : "flex w-full  border rounded-lg "
                          }`}
                        >
                          <div className="flex w-1/2 p-2">
                            <span className="text-sm">{categoryTitle}</span>
                          </div>
                          <div className="flex p-2">
                            <select
                              id={categoryId}
                              name={categoryTitle}
                              className="text-sm bg-transparent"
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
                                      className="text-sm"
                                      id={gradeId}
                                      selected={invoiceInfo?.joins.some(
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
      </div>
      <div className="flex w-full gap-x-2 h-auto">
        <button
          className="w-full h-12 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-lg"
          // onClick={() => handleUpdatePlayers()}
        >
          저장
        </button>
        <button
          className="w-full h-12 bg-gradient-to-r from-blue-300 to-cyan-300 rounded-lg"
          onClick={() => setClose()}
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default JudgeInfoModal;
