import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // sessionStorage에서 user 항목 삭제
    sessionStorage.removeItem("user");
    // /login으로 리다이렉트 (replace: true)
    navigate("/login", { replace: true });
  }, [navigate]);

  return <div>Logging out...</div>;
};

export default Logout;
