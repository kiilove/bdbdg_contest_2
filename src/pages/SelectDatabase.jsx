"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import { Select } from "antd";
import { where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { Database, ArrowRight, AlertCircle, LogOut } from "lucide-react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { useFirebaseRealtimeUpdateData } from "../hooks/useFirebaseRealtime";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import LoadingPage from "./LoadingPage";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const { Option } = Select;

const SelectDatabase = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [contestList, setContestList] = useState([]);
  const [contestNoticeId, setContestNoticeId] = useState(null);
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});
  const navigate = useNavigate();

  const openNotice = (config) => {
    setModalMessage({ isButton: true, confirmButtonText: "확인", ...config });
    setModalOpen(true);
  };

  const { setCurrentContest } = useContext(CurrentContestContext);
  const fetchQuery = useFirestoreQuery();
  const fetchDocument = useFirestoreGetDocument("contest_notice");
  const updateGlobalSetting = useFirebaseRealtimeUpdateData();

  const fetchList = async (userData) => {
    const condition = [
      where("contestStatus", "in", [
        "접수중",
        "수정됨",
        "데모용",
        "수동접수",
        "대회마감",
      ]),
    ];

    try {
      const returnData = await fetchQuery.getDocuments(
        "contest_notice",
        condition
      );

      const filteredData =
        userData.userGroup === "orgManager"
          ? returnData.filter(
              (contest) =>
                contest.contestAssociate === userData.userContext ||
                contest.contestPromoter === userData.userContext
            )
          : [...returnData];

      const sortedList = filteredData.sort((a, b) =>
        (a.contestTitle || "").localeCompare(b.contestTitle || "")
      );

      setContestList(sortedList);

      if (sortedList.length >= 1) {
        setContestNoticeId(sortedList[0].id);
      }
    } catch (error) {
      console.error("대회 목록을 가져오는 중 오류 발생:", error);
      setMessage("대회 목록을 가져오는 중 오류가 발생했습니다");
      openNotice({
        variant: "error",
        title: "대회 목록 조회 실패",
        body: "대회 목록을 가져오는 중 오류가 발생했습니다.",
      });
    }
  };

  const fetchContest = async () => {
    if (contestNoticeId) {
      const condition = [where("contestNoticeId", "==", contestNoticeId)];
      try {
        const returnContest = await fetchQuery.getDocuments(
          "contests",
          condition
        );
        const returnNotice = await fetchDocument.getDocument(contestNoticeId);

        if (returnContest[0]?.id && returnNotice?.id) {
          const contestData = {
            contestInfo: { ...returnNotice },
            contests: { ...returnContest[0] },
          };

          setCurrentContest(contestData);
          const serializedContest = JSON.stringify(contestData);
          sessionStorage.setItem("currentContest", serializedContest);
          localStorage.setItem("currentContest", serializedContest);

          try {
            await updateGlobalSetting.updateData(
              "systemSettings/activeContest",
              {
                contestId: returnContest[0].id,
                contestNoticeId: contestNoticeId,
                contestTitle: returnNotice.contestTitle || "",
                updatedAt: Date.now(),
              }
            );
          } catch (syncErr) {
            console.warn("전광판 전역 동기화 실패:", syncErr);
          }
        }
      } catch (error) {
        console.error("선택된 대회 정보를 가져오는 중 오류 발생:", error);
        setMessage("선택된 대회 정보를 가져오는 중 오류가 발생했습니다");
        openNotice({
          variant: "error",
          title: "대회 정보 로드 실패",
          body: "선택된 대회 정보를 가져오는 중 오류가 발생했습니다.",
        });
      }
    }
  };

  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    const storedContest = sessionStorage.getItem("currentContest");

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        if (storedContest) {
          const parsedContest = JSON.parse(storedContest);
          setCurrentContest(parsedContest);
        }
      } catch (e) {
        console.error("데이터 파싱 오류:", e);
        setMessage("로그인 정보를 다시 확인해 주세요");
        navigate("/login");
        return;
      }
    } else {
      setMessage("사용자 정보가 없습니다");
      navigate("/login");
      return;
    }
  }, [navigate, setCurrentContest]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let timeoutId;

    const loadData = async () => {
      try {
        await fetchList(user);
        clearTimeout(timeoutId);
        setIsLoading(false);
      } catch (error) {
        console.error("대회 목록을 가져오는 중 오류 발생:", error);
        clearTimeout(timeoutId);
        setIsLoading(false);
        setMessage("대회 목록을 가져오는 중 오류가 발생했습니다");
        openNotice({
          variant: "error",
          title: "대회 목록 조회 실패",
          body: "대회 목록을 가져오는 중 오류가 발생했습니다.",
        });
      }
    };

    setIsLoading(true);
    timeoutId = setTimeout(() => {
      setIsLoading(false);
      openNotice({
        variant: "warning",
        title: "데이터 응답 지연",
        body: "데이터 로딩 시간이 초과되었습니다. 네트워크 연결을 확인해 주세요.",
      });
    }, 3000);

    loadData();

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (contestNoticeId) {
      fetchContest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestNoticeId]);

  const handleSelectChange = (value) => {
    setContestNoticeId(value);
  };

  const handleNavigate = () => {
    if (!contestNoticeId) {
      openNotice({
        variant: "warning",
        title: "대회 선택 필요",
        body: "먼저 운영할 대회를 선택해 주세요.",
      });
      return;
    }
    navigate("/", { state: { showTopBar: true } });
  };

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const selectedContest = useMemo(
    () => contestList.find((c) => c.id === contestNoticeId) || null,
    [contestList, contestNoticeId]
  );

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#171717] flex items-center justify-center p-6">
      <ConfirmationModal
        isOpen={modalOpen}
        message={modalMessage}
        onCancel={() => setModalOpen(false)}
        onConfirm={() => setModalOpen(false)}
      />
      <div className="w-full max-w-[440px]">
        {isLoading ? (
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center gap-3">
            <LoadingPage />
            <span className="text-xs leading-4 text-[#737373]">
              대회 목록을 불러오는 중입니다
            </span>
          </div>
        ) : (
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            {/* Top Brand & Title */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[16px] leading-none font-semibold text-[#171717]">
                    BDBDg
                  </span>
                  <span className="text-xs leading-4 text-[#737373]">
                    데이터베이스 선택
                  </span>
                </div>
                <Database
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#737373]"
                />
              </div>

              <h1 className="text-[20px] leading-7 font-medium text-[#171717] m-0">
                운영할 대회 선택
              </h1>
              <p className="text-[13px] leading-5 text-[#737373] mt-1 mb-0">
                선택한 대회가 관리 콘솔과 전광판 송출 화면에 동기화됩니다
              </p>
            </div>

            {message && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-[8px] bg-[#dc2626]/[0.06] border border-[#dc2626]/20 text-[13px] leading-5 text-[#dc2626]">
                <AlertCircle
                  size={16}
                  strokeWidth={1.5}
                  className="shrink-0 text-[#dc2626]"
                />
                <span>{message}</span>
              </div>
            )}

            {contestList.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs leading-4 font-medium text-[#525252]">
                    대회 목록 ({contestList.length}개)
                  </label>
                  <Select
                    size="large"
                    value={contestNoticeId || ""}
                    onChange={handleSelectChange}
                    className="w-full"
                    placeholder="대회 선택"
                  >
                    {contestList.map((contest) => (
                      <Option key={contest.id} value={contest.id}>
                        {contest.contestTitle}
                      </Option>
                    ))}
                  </Select>
                </div>

                {selectedContest && (
                  <div className="rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.06] px-3.5 py-3 space-y-1.5 text-xs leading-4 tabular-nums">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#737373]">진행 상태</span>
                      <span className="font-medium text-[#171717]">
                        {selectedContest.contestStatus || "-"}
                      </span>
                    </div>
                    {selectedContest.contestDate && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#737373]">대회 일자</span>
                        <span className="font-mono text-[#525252]">
                          {selectedContest.contestDate}
                        </span>
                      </div>
                    )}
                    {selectedContest.contestAssociate && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#737373]">주관 단체</span>
                        <span className="text-[#525252] truncate max-w-[220px]">
                          {selectedContest.contestAssociate}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleNavigate}
                  className="w-full h-[44px] px-4 rounded-[8px] bg-[#171717] hover:bg-[#262626] active:scale-[0.98] text-white font-medium text-[14px] leading-5 inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/50"
                >
                  <span>관리 콘솔로 이동</span>
                  <ArrowRight size={16} strokeWidth={1.5} />
                </button>
              </div>
            ) : (
              <div className="rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] p-4 flex items-start gap-2.5">
                <AlertCircle
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#b45309] shrink-0 mt-0.5"
                />
                <div className="space-y-1">
                  <div className="text-[13px] leading-5 font-medium text-[#171717]">
                    선택 가능한 대회가 없습니다
                  </div>
                  <div className="text-xs leading-4 text-[#737373]">
                    현재 권한으로 접근 가능한 대회가 등록되어 있지 않습니다
                  </div>
                </div>
              </div>
            )}

            {/* Footer User & Logout */}
            <div className="mt-6 pt-4 border-t border-[#171717]/[0.08] flex items-center justify-between text-xs leading-4 text-[#737373]">
              <span className="truncate">
                접속 계정: <span className="text-[#525252] font-medium">{user?.userID || "-"}</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 text-[#525252] hover:text-[#171717] font-medium transition-colors duration-150"
              >
                <LogOut size={14} strokeWidth={1.5} className="text-[#737373]" />
                <span>로그아웃</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectDatabase;
