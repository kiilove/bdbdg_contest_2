"use client";

import { useRef, useState } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useContext } from "react";
import { useEffect } from "react";
import {
  useFirestoreAddData,
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { BsCheckAll } from "react-icons/bs";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateUUID } from "../functions/functions";

const ContestForceManual = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [invoiceInfo, setInvoiceInfo] = useState({});
  const [playerFinalArray, setPlayerFinalArray] = useState([]);
  const [playerFinalInfo, setPlayerFinalInfo] = useState({});

  const [playerList, setPlayerList] = useState({});
  const [playerArray, setPlayerArray] = useState([]);
  const [playerNumber, setPlayerNumber] = useState(0);

  const [categorysArray, setCategorysArray] = useState([]);
  const [categorysList, setCategorysList] = useState({});
  const [gradesArray, setGradesArray] = useState([]);
  const [entrysArray, setEntrysArray] = useState([]);

  const [addMsgOpen, setAddMsgOpen] = useState(false);
  const [errorMsgOpen, setErrorMsgOpen] = useState(false);

  const [unDelMsgOpen, setUnDelMsgOpen] = useState(false);
  const [message, setMessage] = useState("");
  const invoiceInfoRef = useRef({});

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersFinal = useFirestoreGetDocument("contest_players_final");

  const addInvoice = useFirestoreAddData("invoices_pool");
  const updatePlayersFinal = useFirestoreUpdateData("contest_players_final");

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

      const returnPlayersFinal = await fetchPlayersFinal.getDocument(
        currentContest.contests.contestPlayersFinalId
      );

      setPlayerFinalInfo(() => ({ ...returnPlayersFinal }));
      console.log(returnPlayersFinal);

      if (returnPlayersFinal) {
        setMessage({
          body: "선수번호를 갱신합니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setPlayerNumber(returnPlayersFinal?.players?.length + 1 || 0);
        setInvoiceInfo((prev) => ({
          ...prev,
          playerNumber: returnPlayersFinal?.players?.length + 1 || 0,
        }));
        console.log({
          ...invoiceInfo,
          playerNumber: returnPlayersFinal?.players?.length + 1 || 0,
        });
        setErrorMsgOpen(true);
      }
    }
  };

  const handleInputValues = (e) => {
    const { name, value } = e.target;
    setInvoiceInfo((prevInfo) => ({
      ...prevInfo,
      [name]: value,
    }));
  };

  const handleJoins = (e) => {
    try {
      const { name, id, value } = e.target;
      console.log({ name, id, value });

      // value의 형식이 예상대로 나오는지 확인
      const splitValue = value.split(",");
      if (splitValue.length < 3) {
        throw new Error("Value format is incorrect");
      }

      const gradeId = splitValue[0];
      const gradeTitle = splitValue[1];
      const categoryPriceType = 0;

      // invoiceInfo?.joins가 undefined일 경우 빈 배열로 초기화
      const dummy = [...(invoiceInfo?.joins || [])];
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
        contestGradeId: gradeId,
        contestGradeTitle: gradeTitle,
        isGradeChanged: false,
        originalGradeId: gradeId,
        originalGradeTitle: gradeTitle,
      };

      if (gradeId === "체급선택") {
        // findIndex가 -1이 아니어야 splice 가능
        if (findIndex !== -1) {
          dummy.splice(findIndex, 1);
        }
      } else if (!findCategory) {
        dummy.push({ ...newValue });
      } else {
        // findIndex가 -1이 아니어야 splice 가능
        if (findIndex !== -1) {
          dummy.splice(findIndex, 1, { ...newValue });
        }
      }

      setInvoiceInfo({ ...newInvoiceInfo, joins: [...dummy] });
    } catch (error) {
      console.error("Error in handleJoins:", error);
      // 필요하다면 사용자에게 오류를 알려주는 로직 추가
    }
  };

  const initInvoiceInfo = () => {
    const {
      invoicesPoolId: invoicePoolId,
      contestCategorysListId: categoryListId,
      contestGradesListId: gradeListId,
      contestNoticeId: noticeId,
      id: contestId,
    } = currentContest.contests;

    const initInfo = {
      //invoicePoolId: invoicePoolId,

      contestId: contestId,
      createdBy: "force",
      contestPriceSum: 0,
      playerUid: generateUUID(),
      playerNumber: playerNumber,
      playerName: "",
      playerTel: "",
      playerEmail: "force@force.com",
      playerBirth: "",
      playerGym: "",
      playerGender: "m",
      playerText: "",
      isPriceCheck: true,
      isCanceled: false,
      playerNoShow: false,
      joins: [],
    };

    console.log(initInfo);
    return initInfo;
  };

  const handleAddInvoice = async (propData) => {
    if (propData?.joins?.length > 0) {
      const newData = { ...propData };
      delete newData.joins;

      const startNumber = Number.parseInt(propData.playerNumber) || 0;
      const newFinal = playerFinalInfo?.players || [];

      propData.joins.forEach((join, idx) => {
        newFinal.push({
          ...newData,
          ...join,
          playerNumber: startNumber + idx,
          playerIndex: startNumber + idx,
        });
      });

      const newPlayersFinal = { ...playerFinalInfo, players: newFinal };
      await updatePlayersFinal.updateData(
        currentContest.contests.contestPlayersFinalId,
        { ...newPlayersFinal }
      );
      setMessage({
        body: "최종명단에 강제추가했습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setErrorMsgOpen(true);
    }
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      const initInfo = initInvoiceInfo();
      console.log("초기화 정보:", initInfo); // 초기화 값이 제대로 나오는지 확인
      setInvoiceInfo(initInfo); // 초기화 정보를 상태로 설정
    }
  }, [currentContest?.contests?.id]);

  useEffect(() => {
    fetchPool();
  }, [currentContest?.contests?.id]);

  useEffect(() => {
    console.log(invoiceInfo);
  }, [invoiceInfo]);

  useEffect(() => {
    console.log({ categorysArray, gradesArray });
  }, [categorysArray, gradesArray]);

  useEffect(() => {
    initInvoiceInfo();
  }, []);

  return (
    <>
      {currentContest?.contests?.id ? (
        <div className="flex w-full flex-col gap-y-4 h-auto pt-4 pb-10 lg:pt-0 lg:pb-0 overflow-y-auto">
          <ConfirmationModal
            isOpen={addMsgOpen}
            onConfirm={() => {
              setInvoiceInfo(initInvoiceInfo());
              setAddMsgOpen(false);
            }}
            onCancel={() => setAddMsgOpen(false)}
            message={message}
          />
          <ConfirmationModal
            isOpen={errorMsgOpen}
            onConfirm={() => {
              setErrorMsgOpen(false);
            }}
            onCancel={() => setErrorMsgOpen(false)}
            message={message}
          />
          <div className="flex w-full h-auto">
            <div className="flex w-full bg-gradient-to-r from-blue-50 to-cyan-50 justify-start items-center rounded-xl px-4 py-3 shadow-sm">
              <div className="flex w-full items-center gap-3">
                <span className="font-sans text-lg font-semibold w-7 h-7 flex justify-center items-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md">
                  <BsCheckAll className="w-5 h-5" />
                </span>
                <h1
                  className="font-sans text-lg lg:text-xl font-bold text-gray-800"
                  style={{ letterSpacing: "1px" }}
                >
                  최종명단 강제등록
                </h1>
              </div>
            </div>
          </div>
          <div className="flex bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 p-4 rounded-xl shadow-sm">
            <div className="flex w-full bg-white h-auto rounded-xl justify-start items-start lg:items-center flex-col p-4 lg:p-6 gap-y-4 shadow-inner">
              <div className="flex w-full justify-start items-center">
                <div className="flex w-1/4 justify-end mr-4">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    선수번호
                  </h3>
                </div>
                <div className="h-12 w-3/4 rounded-lg px-4 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all duration-200">
                  <div className="flex w-full h-full justify-start items-center">
                    <input
                      type="text"
                      value={invoiceInfo.playerNumber}
                      onChange={(e) => handleInputValues(e)}
                      ref={(ref) => (invoiceInfoRef.current.playerNumber = ref)}
                      name="playerNumber"
                      className="w-full h-full outline-none text-sm lg:text-base bg-transparent"
                    />
                  </div>
                </div>
              </div>
              <div className="flex w-full justify-start items-center">
                <div className="flex w-1/4 justify-end mr-4">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    이름
                  </h3>
                </div>
                <div className="h-12 w-3/4 rounded-lg px-4 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all duration-200">
                  <div className="flex w-full h-full justify-start items-center">
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
              </div>
              <div className="flex w-full justify-start items-center">
                <div className="flex w-1/4 justify-end mr-4">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    연락처
                  </h3>
                </div>
                <div className="h-12 w-3/4 rounded-lg px-4 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all duration-200">
                  <div className="flex w-full h-full justify-start items-center">
                    <input
                      type="text"
                      name="playerTel"
                      placeholder="010-0000-0000형식으로 입력 '-'까지 입력"
                      value={invoiceInfo.playerTel}
                      onChange={(e) => handleInputValues(e)}
                      ref={(ref) => (invoiceInfoRef.current.playerTel = ref)}
                      className="w-full h-full outline-none text-sm lg:text-base bg-transparent placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>
              <div className="flex w-full justify-start items-center">
                <div className="flex w-1/4 justify-end mr-4">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    생년월일
                  </h3>
                </div>
                <div className="h-12 w-3/4 rounded-lg px-4 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all duration-200">
                  <div className="flex w-full h-full justify-start items-center">
                    <input
                      type="text"
                      name="playerBirth"
                      placeholder="2000-01-01형식으로 입력 '-'까지 입력"
                      value={invoiceInfo.playerBirth}
                      onChange={(e) => handleInputValues(e)}
                      ref={(ref) => (invoiceInfoRef.current.playerBirth = ref)}
                      className="w-full h-full outline-none text-sm lg:text-base bg-transparent placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>
              <div className="flex w-full justify-start items-center">
                <div className="flex w-1/4 justify-end mr-4">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    소속
                  </h3>
                </div>
                <div className="h-12 w-3/4 rounded-lg px-4 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all duration-200">
                  <div className="flex w-full h-full justify-start items-center">
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
              </div>
              <div className="flex w-full justify-start items-center">
                <div className="flex w-1/4 justify-end mr-4">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    성별
                  </h3>
                </div>
                <div className="h-12 w-3/4 rounded-lg bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all duration-200">
                  <div className="flex w-full h-full justify-start items-center">
                    <select
                      name="playerGender"
                      onChange={(e) => handleInputValues(e)}
                      ref={(ref) => (invoiceInfoRef.current.playerGender = ref)}
                      className="w-full h-full pl-4 pr-2 text-sm lg:text-base bg-transparent rounded-lg outline-none cursor-pointer"
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
              </div>
              <div className="flex w-full justify-start items-center">
                <div className="flex w-1/4 justify-end mr-4">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    이메일
                  </h3>
                </div>
                <div className="h-12 w-3/4 rounded-lg px-4 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all duration-200">
                  <div className="flex w-full h-full justify-start items-center">
                    <input
                      type="email"
                      name="playerEmail"
                      value={invoiceInfo.playerEmail}
                      placeholder="abc@abc.com형식으로 입력"
                      onChange={(e) => handleInputValues(e)}
                      ref={(ref) => (invoiceInfoRef.current.playerEmail = ref)}
                      className="w-full h-full outline-none text-sm lg:text-base bg-transparent placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>
              <div className="flex w-full justify-start items-start h-auto">
                <div className="flex w-1/4 justify-end mr-4 pt-3">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    출전동기
                  </h3>
                </div>
                <div className="h-auto w-3/4 rounded-lg px-4 py-3 bg-gray-50 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all duration-200">
                  <div className="flex w-full justify-start items-center">
                    <textarea
                      name="playerText"
                      value={invoiceInfo.playerText}
                      onChange={(e) => handleInputValues(e)}
                      ref={(ref) => (invoiceInfoRef.current.playerText = ref)}
                      className="h-20 outline-none w-full text-sm lg:text-base bg-transparent resize-none"
                    />
                  </div>
                </div>
              </div>
              <div className="flex w-full justify-start items-start h-auto">
                <div className="flex w-1/4 justify-end mr-4 pt-3">
                  <h3
                    className="font-sans font-semibold text-sm lg:text-base text-gray-700"
                    style={{ letterSpacing: "1px" }}
                  >
                    참가신청종목
                  </h3>
                </div>
                <div className="h-auto w-3/4 rounded-lg px-4 py-3 bg-gray-50 border border-gray-200 overflow-y-auto max-h-96">
                  <div className="flex w-full justify-start items-center">
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
                            .filter(
                              (grade) => grade.refCategoryId === categoryId
                            )
                            .sort(
                              (a, b) =>
                                a.contestGradeIndex - b.contestGradeIndex
                            );

                          return (
                            <div
                              key={cIdx}
                              className={`${
                                invoiceInfo?.joins?.some(
                                  (join) =>
                                    join.contestCategoryId === categoryId
                                )
                                  ? "flex w-full border-2 border-blue-400 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg shadow-md"
                                  : "flex w-full border border-gray-200 bg-white rounded-lg hover:border-gray-300 transition-all duration-200"
                              }`}
                            >
                              <div className="flex w-1/2 p-3">
                                <span
                                  className={`text-sm lg:text-base font-medium ${
                                    invoiceInfo?.joins?.some(
                                      (join) =>
                                        join.contestCategoryId === categoryId
                                    )
                                      ? "text-blue-700"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {categoryTitle}
                                </span>
                              </div>
                              <div className="flex w-1/2 p-3 justify-end">
                                <select
                                  id={categoryId}
                                  name={categoryTitle}
                                  className={`text-sm lg:text-base bg-transparent outline-none cursor-pointer font-medium ${
                                    invoiceInfo?.joins?.some(
                                      (join) =>
                                        join.contestCategoryId === categoryId
                                    )
                                      ? "text-blue-700"
                                      : "text-gray-600"
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
                                          className="text-sm lg:text-base"
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
          </div>
          <div className="flex w-full gap-x-2 h-auto">
            <button
              className="w-full h-14 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold text-base lg:text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
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

export default ContestForceManual;
