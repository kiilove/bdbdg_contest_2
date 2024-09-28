import React, { useContext, useEffect, useState } from "react";
import Drawer from "react-modern-drawer";
import { BsTrophyFill, BsInfoSquareFill } from "react-icons/bs";
import { MdLogout } from "react-icons/md";
import { RxHamburgerMenu } from "react-icons/rx";
import Drawbar from "./Drawbar";
import "react-modern-drawer/dist/index.css";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useNavigate } from "react-router-dom";

const TopBar = ({ user, isLoadingMain, setIsLoadingMain }) => {
  const [isOpenDrawer, setIsOpenDrawer] = useState(false);
  const [contestList, setContestList] = useState([]);
  const [contestNoticeId, setContestNoticeId] = useState();

  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );
  const fetchQuery = useFirestoreQuery();
  const fetchDocument = useFirestoreGetDocument("contest_notice");
  const navigate = useNavigate(); // useNavigate 훅 추가

  const handleDrawer = () => {
    setIsOpenDrawer((prev) => !prev);
    console.log(isOpenDrawer);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("user"); // 세션에서 사용자 정보 삭제
    navigate("/login"); // 로그인 페이지로 리다이렉트
  };

  const fetchList = async () => {
    const condition = [
      where("contestStatus", "in", ["접수중", "수정됨", "데모용"]),
    ];

    const returnData = await fetchQuery.getDocuments(
      "contest_notice",
      condition
    );

    const filteredData =
      user.userGroup === "orgManager"
        ? returnData.filter(
            (contest) =>
              contest.contestAssociate === user.userContext ||
              contest.contestPromoter === user.userContext
          )
        : [...returnData];

    setContestList([
      ...filteredData.sort((a, b) =>
        a.contestTitle.localeCompare(b.contestTitle)
      ),
    ]);

    if (returnData?.length >= 1) {
      setContestNoticeId(filteredData[0].id);
    }
  };

  const fetchContest = async () => {
    if (contestNoticeId) {
      const condition = [where("contestNoticeId", "==", contestNoticeId)];
      const returnContest = await fetchQuery.getDocuments(
        "contests",
        condition
      );
      console.log(returnContest);
      const returnNotice = await fetchDocument.getDocument(contestNoticeId);

      if (returnContest[0].id && returnNotice.id) {
        setCurrentContest({
          contestInfo: { ...returnNotice },
          contests: { ...returnContest[0] },
        });
      }
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    const loadData = async () => {
      await fetchList(); // userState가 설정된 후에 fetchList 실행
      setTimeout(() => {
        setIsLoadingMain(false); // 2초 후에 로딩 상태 해제
      }, 3000);
    };

    loadData();
  }, [user]);

  useEffect(() => {
    fetchContest();
  }, [contestNoticeId]);

  return (
    <div className="flex w-full h-full justify-start items-center bg-white">
      <div className="flex w-full h-full items-center ">
        <div className="flex w-full h-full items-center  px-5">
          <button
            onClick={() => handleDrawer()}
            className="flex w-10 h-10 justify-center items-center"
          >
            <RxHamburgerMenu className="text-2xl" />
          </button>
          <div className="flex justify-start items-center h-8 px-10 gap-x-1 overflow-hidden">
            <span className="text-sm text-gray-500">
              <BsTrophyFill />
            </span>
            <select
              className=" bg-transparent text-base"
              onClick={(e) => setContestNoticeId(e.target.value)}
            >
              {contestList.length > 0 &&
                contestList.map((list, lIdx) => (
                  <option key={lIdx} value={list.id}>
                    {list.contestTitle}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <Drawer
          open={isOpenDrawer}
          onClose={handleDrawer}
          direction="left"
          size={300}
        >
          <Drawbar setOpen={handleDrawer} />
        </Drawer>
        <div
          className="flex justify-start items-center h-8 px-5 gap-x-2 cursor-pointer"
          onClick={handleLogout}
          style={{ width: "250px" }}
        >
          <span className="text-sm text-gray-500">
            <MdLogout />
          </span>
          <span style={{ fontSize: 12 }}>{user?.userContext} 로그아웃</span>
        </div>
      </div>

      <div className="hidden  justify-between w-full">
        <div className="flex w-auto">
          <button className="w-auto h-full px-5 py-2">
            <span className="font-sans text-gray-500 font-semibold font-sm">
              BDBDg협회시스템
            </span>
          </button>
        </div>
        <div className="flex justify-end items-center w-auto px-5">
          <div className="flex justify-start items-center border border-t-0 border-b-0 border-l-gray-500 border-r-gray-500 h-8 px-5 gap-x-2">
            <span className="text-sm text-gray-500">
              <BsTrophyFill />
            </span>
            <select
              className=" bg-transparent"
              onClick={(e) => setContestNoticeId(e.target.value)}
            >
              {contestList.length > 0 &&
                contestList.map((list, lIdx) => (
                  <option key={lIdx} value={list.id}>
                    {list.contestTitle}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex justify-start items-center border border-t-0 border-b-0  border-r-gray-500 h-8 px-5 gap-x-2">
            <span className="text-sm text-gray-500">
              <BsInfoSquareFill />
            </span>
            <span>수동모드</span>
          </div>
          <div
            className="flex justify-start items-center h-8 px-5 gap-x-2 cursor-pointer"
            onClick={handleLogout}
          >
            <span className="text-sm text-gray-500">
              <MdLogout />
            </span>
            <span>로그아웃</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
