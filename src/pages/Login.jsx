"use client";

import { useState } from "react";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { Input, Button, Card, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import bcrypt from "bcryptjs";

const { Title, Text } = Typography;

const Login = () => {
  const navigate = useNavigate();
  const [userID, setUserID] = useState("");
  const [userPass, setUserPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!userID || !userPass) {
      return setError("아이디와 비밀번호를 입력하세요.");
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, "association_managers"),
        where("userID", "==", userID)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("존재하지 않는 아이디입니다.");
        setLoading(false);
        return;
      }

      const userData = snapshot.docs[0].data();

      const match = await bcrypt.compare(userPass, userData.passwordHash);
      if (!match) {
        setError("비밀번호가 일치하지 않습니다.");
        setLoading(false);
        return;
      }

      const user = {
        id: snapshot.docs[0].id,
        userID: userData.userID,
        userGroup: userData.userGroup,
        userContext: userData.userContext,
      };
      sessionStorage.setItem("user", JSON.stringify(user));
      navigate("/selectdatabase");
    } catch (err) {
      console.error(err);
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      {/* Desktop & Mobile Unified Design */}
      <div className="w-full max-w-4xl">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Side - Branding */}
          <div className="text-center lg:text-left space-y-6">
            <div className="space-y-2">
              <Title
                level={1}
                className="!text-4xl lg:!text-5xl !font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent !mb-0"
              >
                BDBDg
              </Title>
              <Title
                level={2}
                className="!text-2xl lg:!text-3xl !font-semibold !text-gray-700 !mt-0"
              >
                협회 시스템
              </Title>
            </div>

            <div className="space-y-2">
              <Text className="text-lg text-gray-600 block">
                협회 업무와 심사를 위한
              </Text>
              <Text className="text-lg text-gray-600 block">
                스마트 관리 시스템입니다
              </Text>
            </div>

            {/* Decorative Elements */}
            <div className="hidden lg:flex space-x-4 justify-start">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full opacity-20"></div>
              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full opacity-30 mt-2"></div>
              <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full opacity-25 mt-3"></div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="flex justify-center">
            <Card
              className="w-full max-w-md shadow-xl border-0"
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                borderRadius: "20px",
              }}
            >
              <div className="text-center mb-8">
                <Title level={3} className="!text-gray-800 !mb-2">
                  관리자 로그인
                </Title>
                <Text className="text-gray-500">계정 정보를 입력해주세요</Text>
              </div>

              <div className="space-y-4">
                <Input
                  size="large"
                  prefix={<UserOutlined className="text-gray-400" />}
                  placeholder="아이디를 입력하세요"
                  value={userID}
                  onChange={(e) => setUserID(e.target.value)}
                  className="rounded-xl border-gray-200 hover:border-blue-400 focus:border-blue-500"
                  style={{ height: "48px" }}
                />

                <Input.Password
                  size="large"
                  prefix={<LockOutlined className="text-gray-400" />}
                  placeholder="비밀번호를 입력하세요"
                  value={userPass}
                  onChange={(e) => setUserPass(e.target.value)}
                  onPressEnter={handleLogin}
                  className="rounded-xl border-gray-200 hover:border-blue-400 focus:border-blue-500"
                  style={{ height: "48px" }}
                />

                {error && (
                  <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg border border-red-200">
                    {error}
                  </div>
                )}

                <Button
                  type="primary"
                  size="large"
                  loading={loading}
                  onClick={handleLogin}
                  className="w-full h-12 rounded-xl font-semibold text-base"
                  style={{
                    background: loading
                      ? "#d1d5db"
                      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    border: "none",
                    boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
                  }}
                >
                  {loading ? "로그인 중..." : "로그인"}
                </Button>
              </div>

              {/* Footer */}
              <div className="text-center mt-6 pt-4 border-t border-gray-100">
                <Text className="text-xs text-gray-400">
                  © 2025 BDBDg 협회 시스템
                </Text>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
