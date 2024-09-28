import React, { useContext } from "react";
import { useState } from "react";
import { BsCheckAll } from "react-icons/bs";
import { MdOutlineSearch } from "react-icons/md";

import {
  useFirestoreQuery,
  useFirestoreUpdateData,
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreGetDocument,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useEffect } from "react";
import { useMemo } from "react";
import LoadingPage from "./LoadingPage";
import { Link } from "react-router-dom";
import { Modal } from "@mui/material";
import judgeInfoModal from "../modals/JudgeInfoModal";
import CanvasWithImageData from "../components/CanvasWithImageData";
import { FaCrown } from "react-icons/fa";

const ContestJudgeTable = () => {
  const [currentTab, setCurrentTab] = useState(1);
  const [judgePasswords, setJudgePasswords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSync, setIsSync] = useState(true);
  const [judgesAllPool, setJudgesAllPool] = useState([]);
  const [judgesAssignPool, setJudgesAssignPool] = useState([]);
  const [searchInfo, setSearchInfo] = useState();
  const [searchKeyword, setSearchKeyword] = useState("");

  const [isOpen, setIsOpen] = useState({
    category: false,
    grade: false,
    player: false,
    categoryId: "",
    gradeId: "",
  });
  //const [filteredInvoiceList, setFilteredInvoiceList] = useState([]);
  const { currentContest } = useContext(CurrentContestContext);
  const fetchJudgesAllPool = useFirestoreQuery();
  const fetchJudgesAssignPool = useFirestoreQuery();
  const addJudgesAssignPool = useFirestoreAddData("contest_judges_pool");
  const updateJudgesAssignPool = useFirestoreUpdateData("contest_judges_pool");
  const deleteJudgesAssignPool = useFirestoreDeleteData("contest_judges_pool");

  const getPassword = useFirestoreGetDocument("contest_passwords");
  const updatePassword = useFirestoreUpdateData("contest_passwords");

  const fetchPool = async (contestId) => {
    setIsLoading(true);
    const conditions = [where("contestId", "==", contestId)];
    try {
      await fetchJudgesAllPool
        .getDocuments("judges_pool")
        .then((data) => setJudgesAllPool([...data]));

      await fetchJudgesAssignPool
        .getDocuments("contest_judges_pool", conditions)
        .then((data) =>
          setJudgesAssignPool(
            [...data].sort((a, b) => a.judgeName.localeCompare(b.judgeName))
          )
        );

      await getPassword
        .getDocument(currentContest.contests.contestPasswordId)
        .then((data) => setJudgePasswords([...data.passwords]));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const tabArray = [
    {
      id: 0,
      title: "전체목록",
      subTitle: "시스템에 등록된 전체 심판명단 입니다.",
      children: "",
    },
    {
      id: 1,
      title: "배정된목록",
      subTitle: "이번대회에 선발된 심판명단 입니다.",
      children: "",
    },
    {
      id: 2,
      title: "미배정된목록",
      subTitle: "이번대회에 선발되지 않은 심판명단 입니다.",
      children: "",
    },
  ];
  const handleJudgeClose = () => {
    setIsOpen(() => ({
      judge: false,
      title: "",
      info: {},
    }));
  };
  // const handleJudgeModal = (judgeUid, judgeInfo) => {
  //   if (judgeUid) {
  //     setIsOpen(() => ({
  //       judge: true,
  //       title: "심판정보",
  //       info: judgeInfo,
  //       list: judgeList,
  //       setList: setJudgeList,
  //     }));
  //   }
  // };
  const handleSearchKeyword = () => {
    setSearchKeyword(searchInfo);
  };

  const filteredData = useMemo(() => {
    let newData = [];
    const newJudgesAllPool = judgesAllPool
      .sort((a, b) => a.judgeName.localeCompare(b.judgeName))
      .map((judge, jIdx) => {
        const {
          judgeName,
          judgeTel,
          judgeUid,
          judgePromoter,
          isConfirmed,

          judgeSignature,
        } = judge;
        const isJoined = judgesAssignPool.some(
          (assign) => assign.judgeUid === judgeUid
        );
        const findJudesAssignInfo = judgesAssignPool.find(
          (assign) => assign.judgeUid === judgeUid
        );

        return {
          judgeUid,
          judgeName,
          judgePromoter,
          judgeTel,
          isJoined,
          isConfirmed,
          isHead: findJudesAssignInfo?.isHead || false,
          judgeSignature,
          onedayPassword: findJudesAssignInfo?.onedayPassword || "",
          judgeAssignId: findJudesAssignInfo?.id || "",
        };
      });

    const newJudgesAssignPool = judgesAssignPool
      .sort((a, b) => a.judgeName.localeCompare(b.judgeName))
      .map((judge, jIdx) => {
        const {
          judgeName,
          judgeTel,
          judgeUid,
          judgePromoter,
          judgeSignature,
          isHead,
          isConfirmed,
          onedayPassword,
          id,
        } = judge;

        return {
          judgeUid,
          judgeName,
          judgePromoter,
          judgeTel,
          isJoined: true,
          isConfirmed,
          isHead,
          judgeSignature,
          onedayPassword,
          judgeAssignId: id,
        };
      });

    switch (currentTab) {
      case 0:
        newData = newJudgesAllPool.filter(
          (judge) =>
            judge.judgeName.includes(searchKeyword) ||
            judge.judgeTel.includes(searchKeyword) ||
            judge.judgePromoter.includes(searchKeyword)
        );
        break;

      case 1:
        newData = newJudgesAssignPool.filter(
          (judge) =>
            judge.judgeName.includes(searchKeyword) ||
            judge.judgeTel.includes(searchKeyword) ||
            judge.judgePromoter.includes(searchKeyword)
        );

      default:
        break;
    }

    return newData;
  }, [judgesAllPool, judgesAssignPool, searchKeyword, currentTab]);

  const handleJudgeHeadAssign = async (e, judgeAssignId) => {
    const { name, checked } = e.target;

    const newJudgesAssignPool = [...judgesAssignPool];
    const findIndexJudge = newJudgesAssignPool.findIndex(
      (find) => find.id === judgeAssignId
    );
    const newJudgesInfo = newJudgesAssignPool[findIndexJudge];

    if (checked) {
      try {
        await updateJudgesAssignPool
          .updateData(judgeAssignId, {
            ...newJudgesInfo,
            isHead: true,
          })
          .then(() => {
            newJudgesAssignPool.splice(findIndexJudge, 1, {
              ...newJudgesInfo,
              isHead: true,
            });
          })
          .then(() => setJudgesAssignPool(() => [...newJudgesAssignPool]));
      } catch (error) {
        console.log(error);
      }
    } else {
      try {
        await updateJudgesAssignPool
          .updateData(judgeAssignId, {
            ...newJudgesInfo,
            isHead: false,
          })
          .then(() => {
            newJudgesAssignPool.splice(findIndexJudge, 1, {
              ...newJudgesInfo,
              isHead: false,
            });
          })
          .then(() => setJudgesAssignPool(() => [...newJudgesAssignPool]));
      } catch (error) {
        console.log(error);
      }
    }
  };
  const handleJudgesAssignPool = async (
    e,
    judges,
    contestId,
    judgeAssignId,
    passwordIndex
  ) => {
    const { name, checked } = e.target;

    if (checked) {
      try {
        const newJudgesAssignPool = [...judgesAssignPool];
        const newJudgeInfo = {
          judgeName: judges.judgeName,
          judgePromoter: judges.judgePromoter,
          judgeSignature: judges.judgeSignature,
          judgeTel: judges.judgeTel,
          judgeUid: judges.judgeUid,
          isAcitve: true,
          isConfirmed: true,
        };
        const newPassword = [...judgePasswords];
        const onedayPassword = newPassword.find(
          (password) => password.used === false
        ).value;

        const findIndexOneDayPassword = judgePasswords.findIndex(
          (password) => password.value === onedayPassword
        );

        newPassword.splice(findIndexOneDayPassword, 1, {
          ...newPassword[findIndexOneDayPassword],
          used: true,
        });

        await addJudgesAssignPool
          .addData({
            ...newJudgeInfo,
            contestId,
            isJoined: true,
            isHead: false,
            onedayPassword,
          })
          .then((data) => {
            newJudgesAssignPool.push({ ...data });
            setJudgesAssignPool(() => [...newJudgesAssignPool]);
          })
          .then(async () => {
            await updatePassword.updateData(
              currentContest.contests.contestPasswordId,
              { contestId, passwords: [...newPassword] }
            );
            setJudgePasswords(() => [...newPassword]);
          });
      } catch (error) {
        console.log(error);
      }
    } else {
      if (!judgeAssignId) {
        return;
      } else {
        try {
          const newJudgesAssignPool = [...judgesAssignPool];
          const findIndexJudgesAssignPool = newJudgesAssignPool.findIndex(
            (judge) => judge.id === judgeAssignId
          );
          const { onedayPassword } =
            newJudgesAssignPool[findIndexJudgesAssignPool];

          const newPassword = [...judgePasswords];

          const findIndexOneDayPassword = newPassword.findIndex(
            (password) => password.value === onedayPassword
          );

          newPassword.splice(findIndexOneDayPassword, 1, {
            ...newPassword[findIndexOneDayPassword],
            used: false,
          });

          await deleteJudgesAssignPool
            .deleteData(judgeAssignId)
            .then(() =>
              newJudgesAssignPool.splice(findIndexJudgesAssignPool, 1)
            )
            .then(() => setJudgesAssignPool(() => [...newJudgesAssignPool]))
            .then(async () => {
              await updatePassword.updateData(
                currentContest.contests.contestPasswordId,
                { contestId, passwords: [...newPassword] }
              );
              setJudgePasswords(() => [...newPassword]);
            });
        } catch (error) {
          console.log(error);
        }
      }
    }
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(currentContest.contests.id);
    }
  }, [currentContest?.contests?.id]);

  const ContestInvoiceUncompleteRender = (
    <div className="flex flex-col lg:flex-row gap-y-2 w-full h-auto bg-white mb-3 rounded-tr-lg rounded-b-lg p-2 gap-x-4">
      <Modal open={isOpen.judge} onClose={handleJudgeClose}>
        <div
          className="flex w-full lg:w-1/2 h-screen lg:h-auto absolute top-1/2 left-1/2 lg:shadow-md lg:rounded-lg bg-white p-3"
          style={{
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* <judgeInfoModal
            setClose={handleJudgeClose}
            propState={isOpen}
            setState={setJudgeList}
          /> */}
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
                  onChange={(e) => setSearchInfo(e.target.value.trim())}
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
                  <th
                    className="text-center text-sm font-normal lg:font-semibold lg:text-base"
                    style={{ width: "8%" }}
                  >
                    배정
                  </th>
                  <th
                    className="text-center text-sm font-normal lg:font-semibold lg:text-base"
                    style={{ width: "8%" }}
                  >
                    위원장
                  </th>
                  <th
                    className="text-left text-sm font-normal lg:font-semibold lg:text-base"
                    style={{ width: "20%" }}
                  >
                    이름
                  </th>
                  <th
                    className="text-left text-sm font-normal hidden lg:table-cell lg:font-semibold lg:text-base"
                    style={{ width: "20%" }}
                  >
                    연락처
                  </th>
                  <th
                    className="text-left hidden lg:table-cell"
                    style={{ width: "14%" }}
                  >
                    소속
                  </th>
                  <th
                    className="text-left hidden lg:table-cell"
                    style={{ width: "22%" }}
                  >
                    사인
                  </th>
                  <th
                    className="text-left text-sm font-normal lg:font-semibold lg:text-base"
                    style={{ width: "10%" }}
                  >
                    개인비밀번호
                  </th>
                </tr>
                {filteredData?.length > 0 &&
                  filteredData.map((filtered, fIdx) => {
                    const {
                      id,
                      judgeUid,
                      judgeName,
                      judgePromoter,
                      judgeTel,
                      judgeSignature,
                      isHead,
                      isJoined,
                      isConfirmed,
                      onedayPassword,
                      judgeAssignId,
                    } = filtered;

                    return (
                      <tr className="border border-t-0 border-x-0" key={id}>
                        <td className="text-center h-10">
                          {!isConfirmed ? (
                            <span className="text-sm">불가</span>
                          ) : (
                            <input
                              type="checkbox"
                              name="judgeAssignJoin"
                              checked={isJoined}
                              onClick={(e) =>
                                handleJudgesAssignPool(
                                  e,
                                  filtered,
                                  currentContest.contests.id,
                                  judgeAssignId,
                                  fIdx
                                )
                              }
                            />
                          )}
                        </td>
                        <td className="text-center h-10 ">
                          <input
                            type="checkbox"
                            name="judgeAssignHead"
                            checked={isHead}
                            onClick={(e) =>
                              handleJudgeHeadAssign(e, judgeAssignId)
                            }
                          />
                        </td>
                        <td className="text-left text-sm  lg:text-base">
                          <div className="flex justify-start items-center gap-x-2">
                            <span
                              className={`${
                                !isConfirmed
                                  ? " cursor-pointer line-through text-gray-500"
                                  : " cursor-pointer underline"
                              } `}
                            >
                              {judgeName}
                            </span>
                            {isHead && (
                              <span className="text-orange-500">
                                <FaCrown />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-left text-sm hidden lg:table-cell lg:text-base">
                          {judgeTel}
                        </td>

                        <td className="text-left hidden lg:table-cell">
                          {judgePromoter}
                        </td>
                        <td className="text-left hidden lg:table-cell ">
                          <CanvasWithImageData
                            imageData={judgeSignature}
                            style={{
                              width: "90px",
                              height: "90px",
                              padding: "0",
                            }}
                          />
                        </td>
                        <td className="text-left lg:table-cell">
                          {onedayPassword}
                        </td>
                      </tr>
                    );
                  })}
              </table>
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
                심판배정
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

                {currentTab === 0 && ContestInvoiceUncompleteRender}
                {currentTab === 1 && ContestInvoiceUncompleteRender}
                {currentTab === 2 && ContestInvoiceUncompleteRender}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ContestJudgeTable;
