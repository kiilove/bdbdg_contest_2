import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import Sidebar from "../components/SideBar";
import LoadingPage from "../pages/LoadingPage";

const ManagementHome = ({ children }) => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState({});
  const [isLoadingMain, setIsLoadingMain] = useState(true);

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem("user"));
    setUserInfo(user);
    if (!user) {
      // 세션에 로그인 정보가 없으면 로그인 페이지로 리다이렉트
      navigate("/login");
    }
  }, []);

  return (
    <div className="w-full h-full min-h-screen bg-gradient-to-br from-blue-300 to-sky-700">
      {isLoadingMain ? (
        <div className="flex w-full h-full justify-start items-start flex-col ">
          <div className="flex h-12 w-full shadow-md">
            <TopBar
              user={userInfo}
              isLoadingMain={isLoadingMain}
              setIsLoadingMain={setIsLoadingMain}
            />
          </div>
          <div className="flex justify-center items-center w-full h-screen bg-white">
            <LoadingPage />
          </div>
        </div>
      ) : (
        <div className="flex w-full h-full justify-start items-start flex-col ">
          <div className="flex h-12 w-full shadow-md">
            <TopBar
              user={userInfo}
              isLoadingMain={isLoadingMain}
              setIsLoadingMain={setIsLoadingMain}
            />
          </div>
          <div className=" flex w-full h-full justify-start items-start">
            <div className="hidden w-72 h-full bg-sky-800 shadow-md">
              <Sidebar />
            </div>
            <div
              className="flex w-full h-full p-2 overflow-y-auto"
              style={{ maxHeight: "900px" }}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagementHome;
