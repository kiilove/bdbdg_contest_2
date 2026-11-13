import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoadingPage from "./LoadingPage";

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    sessionStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-[#fafafa] text-[#737373] flex flex-col items-center justify-center gap-3">
      <LoadingPage />
      <span className="text-xs leading-4">로그아웃 처리 중</span>
    </div>
  );
};

export default Logout;
