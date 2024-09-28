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

const ContestJudgeTable = () => {
  const [currentTab, setCurrentTab] = useState(1);
  const [judgePasswords, setJudgePasswords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSync, setIsSync] = useState(true);
  const [judgePool, setJudgePool] = useState([]);
  const [judgeList, setJudgeList] = useState([]);
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
  const getPool = useFirestoreQuery();
  const getList = useFirestoreQuery();

  const updateJudgeList = useFirestoreUpdateData("contest_judges_pool");
  const addJudge = useFirestoreAddData("contest_judges_pool");
  const getPassword = useFirestoreGetDocument("contest_passwords");

  const fetchQuery = async (contestId) => {
    setIsLoading(true);
    const conditions = [where("contestId", "==", contestId)];
    const judgePoolData = await getPool.getDocuments("judges_pool");
    const judgeListData = await getList.getDocuments(
      "contest_judges_pool",
      conditions
    );
    const judgePasswordData = await getPassword.getDocument(
      currentContest.contests.contestPasswordId
    );

    setJudgeList([
      ...judgeListData.sort((a, b) => a.judgeName.localeCompare(b.judgeName)),
    ]);

    setJudgePool([...judgePoolData]);

    if (judgePoolData?.length !== judgeListData?.length) {
      const newJudge = getNewJudges(judgePoolData, judgeListData);

      const newJudgeList = [...judgeListData];
      newJudgeList.push(newJudge);

      newJudge.map(async (judge, jIdx) => {
        try {
          await addJudge.addData({ ...judge, contestId });
        } catch (error) {
          console.log(error.message);
        }
      });
      console.log(newJudgeList);
      setJudgeList(...newJudgeList);
    }

    setJudgePasswords([...judgePasswordData.passwords]);

    setIsLoading(false);
  };

  const getNewJudges = (judgePoolData, judgeListData) => {
    const selectedJudgeUids = judgeListData.map((judge) => judge.judgeUid);
    const unselectedJudges = judgePoolData
      .filter((judge) => !selectedJudgeUids.includes(judge.judgeUid))
      .map(({ id, ...rest }) => rest);

    console.log(...unselectedJudges);
    return unselectedJudges;
  };

  const filteredData = useMemo(() => {
    console.log(judgeList);
    setIsLoading(true);

    let newData = [];
    if (judgeList?.length > 0) {
      switch (currentTab) {
        case 0:
          newData = judgePool.filter(
            (judge) =>
              judge.judgeName.includes(searchKeyword) ||
              judge.judgeTel.includes(searchKeyword) ||
              judge.judgePromoter.includes(searchKeyword)
          );
          break;
        case 1:
          newData = judgeList.filter(
            (judge) =>
              judge.isConfirmed &&
              judge.isActived &&
              judge.isJoined &&
              (judge.judgeName.includes(searchKeyword) ||
                judge.judgeTel.includes(searchKeyword) ||
                judge.judgePromoter.includes(searchKeyword))
          );
          break;
        case 2:
          newData = judgeList.filter(
            (judge) =>
              judge.isConfirmed &&
              judge.isActived &&
              !judge.isJoined &&
              (judge.judgeName.includes(searchKeyword) ||
                judge.judgeTel.includes(searchKeyword) ||
                judge.judgePromoter.includes(searchKeyword))
          );
          break;

        default:
          break;
      }
    }
    setIsLoading(false);
    return newData;
  }, [currentTab, searchKeyword, judgeList]);

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
  const handleJudgeModal = (judgeUid, judgeInfo) => {
    if (judgeUid) {
      setIsOpen(() => ({
        judge: true,
        title: "심판정보",
        info: judgeInfo,
        list: judgeList,
        setList: setJudgeList,
      }));
    }
  };
  const handleSearchKeyword = () => {
    setSearchKeyword(searchInfo);
  };

  const handleJudgeJoinUpdate = async (judgeId, judgeUid, e) => {
    setIsLoading(true);
    //initInvoice(playerUid);
    const findIndex = judgeList.findIndex(
      (judge) => judge.judgeUid === judgeUid
    );
    console.log(findIndex);
    const newJudgeList = [...judgeList];

    const newJudgeInfo = {
      ...newJudgeList[findIndex],
      isJoined: e.target.checked,
      onedayPassword: e.target.checked ? judgePasswords[findIndex] : null,
      isHead: false,
    };

    newJudgeList.splice(findIndex, 1, {
      ...newJudgeInfo,
    });

    await updateJudgeList
      .updateData(judgeId, { ...newJudgeInfo })
      .then(() => setJudgeList([...newJudgeList]))
      .then(() => setIsLoading(false))
      .catch((error) => console.log(error));
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchQuery(currentContest.contests.id);
    }
    console.log(currentContest?.contests);
  }, [currentContest]);

  useEffect(() => {
    console.log(filteredData);
  }, [filteredData]);

  useEffect(() => {
    console.log(judgePasswords);
  }, [judgePasswords]);

  const ContestInvoiceUncompleteRender = (
    <div className="flex flex-col lg:flex-row gap-y-2 w-full h-auto bg-white mb-3 rounded-tr-lg rounded-b-lg p-2 gap-x-4">
      <Modal open={isOpen.judge} onClose={handleJudgeClose}>
        <div
          className="flex w-full lg:w-1/2 h-screen lg:h-auto absolute top-1/2 left-1/2 lg:shadow-md lg:rounded-lg bg-white p-3"
          style={{
            transform: "translate(-50%, -50%)",
          }}
        >
          <judgeInfoModal
            setClose={handleJudgeClose}
            propState={isOpen}
            setState={setJudgeList}
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
                  <th className="w-1/12 text-center text-sm font-normal lg:font-semibold lg:text-base">
                    배정여부
                  </th>
                  <th className="text-left w-1/12 text-sm font-normal lg:font-semibold lg:text-base">
                    위원장
                  </th>
                  <th className="text-left w-2/12 text-sm font-normal lg:font-semibold lg:text-base">
                    이름
                  </th>
                  <th className="text-left w-2/12 text-sm font-normal hidden lg:table-cell lg:font-semibold lg:text-base">
                    연락처
                  </th>
                  <th className="text-left w-3/12 hidden lg:table-cell">
                    소속
                  </th>
                  <th className="text-left w-2/12 text-sm font-normal lg:font-semibold lg:text-base">
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
                      isHead,
                      isJoined,
                      isConfirmed,
                      onedayPassword,
                    } = filtered;

                    return (
                      <tr className="border border-t-0 border-x-0" key={id}>
                        <td className="text-center w-1/12 h-10">
                          {!isConfirmed ? (
                            <span className="text-sm">불가</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isJoined}
                              onClick={(e) =>
                                handleJudgeJoinUpdate(id, judgeUid, e)
                              }
                            />
                          )}
                        </td>
                        <td className="text-center w-1/12 h-10 ">
                          <div className="flex justify-start w-full">
                            {isHead ? (
                              <button>배정취소</button>
                            ) : (
                              <button>위원장배정</button>
                            )}
                          </div>
                        </td>
                        <td className="text-left w-2/12 text-sm  lg:text-base">
                          <div className="flex flex-col">
                            <span
                              onClick={() =>
                                handleJudgeModal(judgeUid, filtered)
                              }
                              className={`${
                                !isConfirmed
                                  ? " cursor-pointer line-through text-gray-500"
                                  : " cursor-pointer underline"
                              } `}
                            >
                              {judgeName}
                            </span>
                          </div>
                        </td>
                        <td className="text-left w-2/12 text-sm hidden lg:table-cell lg:text-base">
                          {judgeTel}
                        </td>

                        <td className="text-left w-3/12 hidden lg:table-cell">
                          {judgePromoter}
                        </td>
                        <td className="text-left w-2/12 lg:table-cell">
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
