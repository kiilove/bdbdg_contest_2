"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import bcrypt from "bcryptjs";
import { User, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { db } from "../firebase";
import { BibTag, StatusDot } from "../components/ui/BibTag";

const PREVIEW_ROWS = [
  {
    bib: "104",
    name: "김태훈",
    gym: "강남 바디랩",
    scores: [
      { v: 1, drop: "low" },
      { v: 1 },
      { v: 2, drop: "high" },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 2 },
    ],
    total: 6,
    rank: 1,
    active: true,
  },
  {
    bib: "107",
    name: "박성민",
    gym: "팀 아이언",
    scores: [
      { v: 2 },
      { v: 2 },
      { v: 1, drop: "low" },
      { v: 2 },
      { v: 3, drop: "high" },
      { v: 2 },
      { v: 1 },
    ],
    total: 9,
    rank: 2,
    active: false,
  },
  {
    bib: "112",
    name: "이준호",
    gym: "수성 피트니스",
    scores: [
      { v: 3 },
      { v: 3 },
      { v: 3 },
      { v: 4, drop: "high" },
      { v: 2, drop: "low" },
      { v: 3 },
      { v: 3 },
    ],
    total: 15,
    rank: 3,
    active: false,
  },
  {
    bib: "118",
    name: "정현우",
    gym: "개인 출전",
    scores: [
      { v: 4 },
      { v: 4 },
      { v: 4, drop: "high" },
      { v: 3, drop: "low" },
      { v: 4 },
      { v: 4 },
      { v: 4 },
    ],
    total: 20,
    rank: 4,
    active: false,
  },
];

const Login = () => {
  const navigate = useNavigate();
  const [userID, setUserID] = useState("");
  const [userPass, setUserPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    setError("");
    if (!userID || !userPass) {
      return setError("아이디와 비밀번호를 입력하세요");
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, "association_managers"),
        where("userID", "==", userID)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("존재하지 않는 아이디입니다");
        setLoading(false);
        return;
      }

      const userData = snapshot.docs[0].data();

      const match = await bcrypt.compare(userPass, userData.passwordHash);
      if (!match) {
        setError("비밀번호가 일치하지 않습니다");
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
      setError("로그인 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#171717] flex items-center">
      <div className="w-full max-w-[1120px] mx-auto min-h-screen grid lg:grid-cols-12 gap-10 lg:gap-12 items-center px-6 py-12">
        {/* Left Column (7 cols): Brand, Specific Headline & Real Product Preview */}
        <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[16px] leading-none font-semibold text-[#171717]">
                BDBDg
              </span>
              <span className="text-xs leading-4 text-[#737373]">
                협회 경기 운영 시스템
              </span>
            </div>

            <h1 className="text-[28px] sm:text-[34px] leading-[1.2] tracking-[-0.02em] font-medium text-[#171717] m-0">
              보디빌딩·피트니스 협회 실시간 경기 운영 콘솔
            </h1>

            <p className="text-[15px] leading-6 text-[#525252] max-w-[560px] m-0">
              참가 접수, 현장 계측, 심판 집계, 무대 음향과 전광판 송출을 한 화면에서 관리합니다
            </p>
          </div>

          {/* Code-built Real Product Preview Card */}
          <div
            aria-label="실시간 무대 및 7심제 심사 집계 화면 미리보기"
            className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.05)] space-y-3"
          >
            {/* Dark Graphite Stage Header */}
            <div className="rounded-[8px] bg-[#141415] text-[#ededed] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <StatusDot status="live" live />
                <BibTag variant="dark" size="sm" prefix="#" number="12" />
                <span className="text-[13px] leading-5 font-medium text-[#ededed] truncate">
                  남자 일반부 보디빌딩 -75kg
                </span>
              </div>
              <span className="font-mono text-[11px] leading-4 text-[#a1a1a6] tabular-nums">
                7심제 · 최고/최저 제외 합산
              </span>
            </div>

            {/* 7-Judge Matrix Preview Table */}
            <div className="rounded-[8px] border border-[#171717]/[0.08] overflow-hidden">
              <table className="w-full border-collapse text-left tabular-nums">
                <thead>
                  <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] text-[11px] leading-4 text-[#737373]">
                    <th className="py-2 px-3 font-medium">번호</th>
                    <th className="py-2 px-3 font-medium">선수</th>
                    {["J1", "J2", "J3", "J4", "J5", "J6", "J7"].map((j) => (
                      <th
                        key={j}
                        className="hidden sm:table-cell py-2 px-1.5 text-center font-mono font-medium"
                      >
                        {j}
                      </th>
                    ))}
                    <th className="py-2 px-3 text-right font-medium">기점</th>
                    <th className="py-2 px-3 text-right font-medium">순위</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171717]/[0.06] text-[13px] leading-5">
                  {PREVIEW_ROWS.map((row) => (
                    <tr
                      key={row.bib}
                      className={
                        row.active ? "bg-[#2563eb]/[0.04]" : "bg-white"
                      }
                    >
                      <td className="py-2 px-3">
                        <BibTag
                          size="sm"
                          variant={row.active ? "active" : "default"}
                          number={row.bib}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-medium text-[#171717]">
                            {row.name}
                          </span>
                          <span className="text-[11px] leading-4 text-[#737373] hidden md:inline">
                            {row.gym}
                          </span>
                        </div>
                      </td>
                      {row.scores.map((s, idx) => (
                        <td
                          key={idx}
                          className={`hidden sm:table-cell py-2 px-1.5 text-center font-mono text-xs ${
                            s.drop
                              ? "text-[#737373]/60 line-through"
                              : "text-[#525252]"
                          }`}
                        >
                          {s.v}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono text-xs font-medium text-[#171717]">
                        {row.total}점
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs font-medium">
                        <span
                          className={
                            row.rank === 1
                              ? "text-[#2563eb]"
                              : "text-[#525252]"
                          }
                        >
                          {row.rank}위
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Console Meta Row */}
            <div className="flex items-center justify-between text-xs leading-4 text-[#737373] tabular-nums pt-0.5">
              <span>심판 채점 수신 7 / 7 완료</span>
              <span>본부석 · 사회자 · 전광판 실시간 연동</span>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Login Form Card */}
        <div className="lg:col-span-5 order-1 lg:order-2">
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="mb-6">
              <h2 className="text-[18px] leading-6 font-medium text-[#171717] m-0">
                관리자 로그인
              </h2>
              <p className="text-[13px] leading-5 text-[#737373] mt-1 mb-0">
                발급받은 협회 운영 계정으로 접속하세요
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="login-userid"
                  className="block text-xs leading-4 font-medium text-[#525252]"
                >
                  아이디
                </label>
                <div className="relative flex items-center">
                  <User
                    size={16}
                    strokeWidth={1.5}
                    className="absolute left-3.5 text-[#737373] pointer-events-none"
                  />
                  <input
                    id="login-userid"
                    type="text"
                    autoComplete="username"
                    placeholder="아이디 입력"
                    value={userID}
                    onChange={(e) => setUserID(e.target.value)}
                    className="w-full h-[44px] pl-10 pr-3.5 rounded-[8px] bg-white border border-[#171717]/[0.12] text-[14px] text-[#171717] placeholder:text-[#737373] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition-colors duration-150"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs leading-4 font-medium text-[#525252]"
                >
                  비밀번호
                </label>
                <div className="relative flex items-center">
                  <Lock
                    size={16}
                    strokeWidth={1.5}
                    className="absolute left-3.5 text-[#737373] pointer-events-none"
                  />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="비밀번호 입력"
                    value={userPass}
                    onChange={(e) => setUserPass(e.target.value)}
                    className="w-full h-[44px] pl-10 pr-10 rounded-[8px] bg-white border border-[#171717]/[0.12] text-[14px] text-[#171717] placeholder:text-[#737373] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition-colors duration-150"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "비밀번호 숨기기" : "비밀번호 보기"
                    }
                    className="absolute right-3 text-[#737373] hover:text-[#525252] p-1 rounded-[4px] transition-colors duration-150"
                  >
                    {showPassword ? (
                      <EyeOff size={16} strokeWidth={1.5} />
                    ) : (
                      <Eye size={16} strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] bg-[#dc2626]/[0.06] border border-[#dc2626]/20 text-[13px] leading-5 text-[#dc2626]"
                >
                  <AlertCircle
                    size={16}
                    strokeWidth={1.5}
                    className="shrink-0 text-[#dc2626]"
                  />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[44px] rounded-[8px] bg-[#171717] hover:bg-[#262626] disabled:bg-[#737373] disabled:cursor-not-allowed active:scale-[0.98] text-white font-medium text-[14px] leading-5 transition-[background-color,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/50"
              >
                {loading ? "로그인 확인 중" : "로그인"}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-[#171717]/[0.08] flex items-center justify-between text-xs leading-4 text-[#737373] tabular-nums">
              <span>BDBDg 경기 운영 시스템</span>
              <span>© 2026 BDBDg</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
