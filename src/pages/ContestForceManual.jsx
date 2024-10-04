import React, { useRef, useState } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useContext } from "react";
import { useEffect } from "react";
import {
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { BsCheckAll } from "react-icons/bs";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateToday, generateUUID } from "../functions/functions";
import { where } from "firebase/firestore";

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
      let dummy = [...(invoiceInfo?.joins || [])];
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
    // setMessage({ body: "저장중", isButton: false });
    // setAddMsgOpen(true);
    // const added = await addInvoice.addData({
    //   ...propData,
    //   createBy: "manual",
    //   playerUid: generateUUID(),
    //   invoiceCreateAt: generateToday(),
    //   contestPriceSum: parseInt(propData.contestPriceSum),
    // });
    // if (added) {
    //   console.log(added.data);
    //   setMessage({
    //     body: "저장되었습니다.",
    //     isButton: true,
    //     confirmButtonText: "확인",
    //   });
    //   setInvoiceInfo(initInvoiceInfo());
    // }

    console.log(propData);

    if (propData?.joins?.length > 0) {
      const newData = { ...propData };
      delete newData.joins;
      const newFinal = playerFinalInfo?.players || [];
      propData.joins.map((join, idx) => {
        newFinal.push({
          ...newData,
          ...join,
          playerNumber: playerNumber + idx,
          playerIndex: playerNumber + idx,
        });
      });

      const newPlayersFinal = { ...playerFinalInfo, players: newFinal };
      console.log(newPlayersFinal);

      try {
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
      } catch (error) {
        console.log(error);
      }
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
        <div className="flex w-full flex-col gap-y-2 h-auto pt-4 pb-10 lg:pt-0 lg:pb-0 overflow-y-auto">
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
                  최종명단 강제등록
                </h1>
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
                    선수번호
                  </h3>
                </div>
                <div className="h-8 lg:h-12 w-3/4 rounded-lg px-3 bg-white">
                  <div className="flex w-full justify-start items-center">
                    <input
                      type="text"
                      value={invoiceInfo.playerNumber}
                      onChange={(e) => handleInputValues(e)}
                      ref={(ref) => (invoiceInfoRef.current.playerNumber = ref)}
                      name="playerNumber"
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
                      placeholder="010-0000-0000형식으로 입력 '-'까지 입력"
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
                      name="playerBirth"
                      placeholder="2000-01-01형식으로 입력 '-'까지 입력"
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
                      placeholder="소속없거나 모르면 무소속"
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
                      placeholder="abc@abc.com형식으로 입력"
                      onChange={(e) => handleInputValues(e)}
                      ref={(ref) => (invoiceInfoRef.current.playerEmail = ref)}
                      className="h-8 lg:h-12 outline-none text-sm lg:text-base"
                    />
                  </div>
                </div>
              </div>
              {/* <div className="flex w-full justify-start items-center ">
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
                      type="text"
                      name="contestPriceSum"
                      value={invoiceInfo.contestPriceSum?.toLocaleString()}
                      placeholder="참가비 수동으로 계산입력 ','는 제외"
                      onChange={(e) => handleInputValues(e)}
                      ref={(ref) =>
                        (invoiceInfoRef.current.contestPriceSum = ref)
                      }
                      className="h-8 lg:h-12 outline-none text-sm lg:text-base"
                    />
                  </div>
                </div>
              </div> */}

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
                <div className="h-auto w-3/4 rounded-lg px-3 bg-white pt-1 overflow-y-auto">
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
                            .filter(
                              (grade) => grade.refCategoryId === categoryId
                            )
                            .sort(
                              (a, b) =>
                                a.contestGradeIndex - b.contestGradeIndex
                            );

                          return (
                            <div
                              className={`${
                                invoiceInfo?.joins?.some(
                                  (join) =>
                                    join.contestCategoryId === categoryId
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
              className="w-full h-12 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-lg"
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
