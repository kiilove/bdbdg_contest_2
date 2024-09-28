import React, { useState } from "react";
import LoginBg3 from "../assets/img/loginbg3.jpg";
import LoginBg4 from "../assets/img/loginbg4.jpg";
import { FaUser, FaKey } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();
  const [userID, setUserID] = useState("");
  const [userPass, setUserPass] = useState("");
  const [error, setError] = useState("");

  const userTable = [
    {
      id: 0,
      userID: "ybbf",
      userPass: "20241110",
      userGroup: "orgManager",
      userContext: "용인특례시보디빌딩협회",
    },
    {
      id: 1,
      userID: "sbbf",
      userPass: "01056106006",
      userGroup: "orgManager",
      userContext: "시흥시보디빌딩협회",
    },
    {
      id: 100,
      userID: "jncore",
      userPass: "1201",
      userGroup: "admin",
      userContext: "관리자",
    },
  ];

  const handleLogin = () => {
    const user = userTable.find(
      (u) => u.userID === userID && u.userPass === userPass
    );

    if (user) {
      // 로그인 성공
      sessionStorage.setItem("user", JSON.stringify(user));
      navigate("/management");
    } else {
      // 로그인 실패
      setError("아이디 또는 비밀번호가 일치하지 않습니다.");
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-blue-300 to-sky-700">
      <div className="hidden md:flex justify-center items-center h-full px-3 lg:px-0">
        <div
          className="rounded-lg shadow-lg flex w-full lg:w-3/4 lg:h-3/4"
          style={{
            backgroundColor: "#f9f9f9",
            backgroundImage: `url(${LoginBg4})`,
            backgroundSize: "90% 100%",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="flex w-full h-full py-10 lg:mt-16">
            <div className="h-full flex flex-col p-10" style={{ width: "60%" }}>
              <div className="flex w-full justify-start items-start h-full flex-col gap-y-1">
                <div className="flex flex-col items-start my-10">
                  <h1 className="text-4xl font-san font-semibold text-gray-200">
                    BDBDg
                  </h1>
                  <h1 className="text-3xl font-san font-semibold text-gray-200">
                    협회 시스템
                  </h1>
                </div>

                <h2 className="text-gray-300 text-lg">
                  협회업무와 심사를 위한{" "}
                </h2>
                <h2 className="text-gray-300 text-lg">시스템입니다.</h2>
              </div>
            </div>
            <div
              className="flex w-auto h-full flex-col px-5 py-10"
              style={{ minWidth: "35%" }}
            >
              <div className="flex w-full justify-start items-center h-full flex-col gap-y-3">
                <div className="flex flex-col items-center my-5">
                  <h1 className="text-2xl font-san font-semibold text-gray-800">
                    사용자 로그인
                  </h1>
                </div>
                <div className="flex flex-col items-center w-full px-5 ml-5 gap-y-5">
                  <div className="flex w-full bg-gray-200 h-10 rounded-lg">
                    <div className="flex w-10 h-10 justify-center items-center">
                      <FaUser className="text-gray-600 text-lg" />
                    </div>
                    <input
                      name="userID"
                      type="text"
                      className=" bg-transparent outline-none w-full"
                      value={userID}
                      onChange={(e) => setUserID(e.target.value)}
                    />
                  </div>
                  <div className="flex w-full bg-gray-200 h-10 rounded-lg">
                    <div className="flex w-10 h-10 justify-center items-center">
                      <FaKey className="text-gray-600 text-lg" />
                    </div>
                    <input
                      name="userPass"
                      type="password"
                      className=" bg-transparent outline-none w-full"
                      value={userPass}
                      onChange={(e) => setUserPass(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleLogin();
                        }
                      }}
                    />
                  </div>
                  {error && (
                    <div className="text-red-500 text-sm mt-2">{error}</div>
                  )}
                  <div className="flex w-full h-20">
                    <button
                      className="w-full bg-gradient-to-r from-amber-400 to-pink-600 h-10 rounded-3xl mt-2"
                      onClick={handleLogin}
                    >
                      <span
                        className="font-semibold font-san text-gray-100"
                        style={{ letterSpacing: "10px" }}
                      >
                        로그인
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className="flex md:hidden h-full p-5 flex-col justify-start"
        style={{
          backgroundColor: "#f9f9f9",
          backgroundImage: `url(${LoginBg3})`,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="w-full h-auto flex flex-col justify-start items-start">
          <div className="flex w-full justify-start items-end h-full flex-col gap-y-1">
            <div className="flex flex-col items-start my-10">
              <h1 className="text-3xl font-san font-semibold text-gray-200">
                BDBDg
              </h1>
              <h1 className="text-2xl font-san font-semibold text-gray-200">
                협회 시스템
              </h1>
            </div>
          </div>
        </div>
        <div className="flex w-full h-auto flex-col mt-20">
          <div className="flex w-full h-auto flex-col px-5 py-10 ">
            <div className="flex w-full justify-start items-center flex-col gap-y-1">
              <div className="flex flex-col items-center my-5">
                <h1 className="text-2xl font-san font-semibold text-gray-800">
                  사용자 로그인
                </h1>
              </div>
              <div className="flex flex-col items-center w-full px-5 ml-5 gap-y-2">
                <div className="flex w-full bg-gray-200 h-10 rounded-lg">
                  <div className="flex w-10 h-10 justify-center items-center">
                    <FaUser className="text-gray-600 text-lg" />
                  </div>
                  <input
                    type="text"
                    className=" bg-transparent"
                    value={userID}
                    onChange={(e) => setUserID(e.target.value)}
                  />
                </div>
                <div className="flex w-full bg-gray-200 h-10 rounded-lg">
                  <div className="flex w-10 h-10 justify-center items-center">
                    <FaKey className="text-gray-600 text-lg" />
                  </div>
                  <input
                    type="password"
                    className=" bg-transparent"
                    value={userPass}
                    onChange={(e) => setUserPass(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleLogin();
                      }
                    }}
                  />
                </div>
                {error && (
                  <div className="text-red-500 text-sm mt-2">{error}</div>
                )}
                <div className="flex w-full h-20">
                  <button
                    className="w-full bg-gradient-to-r from-amber-400 to-pink-600 h-10 rounded-3xl mt-2"
                    onClick={handleLogin}
                  >
                    <span
                      className="font-semibold font-san text-gray-100"
                      style={{ letterSpacing: "10px" }}
                    >
                      로그인
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
