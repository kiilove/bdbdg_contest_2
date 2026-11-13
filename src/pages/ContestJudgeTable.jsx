import React, { useContext, useRef, useState, useEffect, useMemo } from "react";
import {
  useFirestoreQuery,
  useFirestoreUpdateData,
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreGetDocument,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import LoadingPage from "./LoadingPage";
import { Drawer } from "@mui/material";
import CanvasWithImageData from "../components/CanvasWithImageData";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import {
  UserCheck,
  Search,
  Crown,
  KeyRound,
  X,
  RefreshCw,
} from "lucide-react";

const hasSignature = (sig) => Boolean(sig && String(sig).trim());

const ContestJudgeTable = () => {
  const [currentTab, setCurrentTab] = useState(1);
  const [judgePasswords, setJudgePasswords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSync, setIsSync] = useState(true);
  const [judgesAllPool, setJudgesAllPool] = useState([]);
  const [judgesAssignPool, setJudgesAssignPool] = useState([]);
  const [searchInfo, setSearchInfo] = useState();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});

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

  const [passwordDocId, setPasswordDocId] = useState("");
  const inFlightPasswordsRef = useRef(new Set());
  const inFlightJudgesRef = useRef(new Set());
  const judgePasswordsRef = useRef([]);
  const fetchPasswordQuery = useFirestoreQuery();

  const getPassword = useFirestoreGetDocument("contest_passwords");
  const updatePassword = useFirestoreUpdateData("contest_passwords");
  const addPassword = useFirestoreAddData("contest_passwords");
  const updateContest = useFirestoreUpdateData("contests");

  const generatePasswords = () => {
    const passwords = [];
    const usedPasswords = new Set();
    while (passwords.length < 100) {
      const password = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
      if (!usedPasswords.has(password)) {
        passwords.push(password);
        usedPasswords.add(password);
      }
    }
    return passwords.map((password, pIdx) => ({
      id: pIdx,
      value: password,
      used: false,
    }));
  };

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

      let passId = currentContest?.contests?.contestPasswordId;
      let loadedPasswords = null;

      if (passId) {
        const passData = await getPassword.getDocument(passId);
        if (passData?.passwords && passData.passwords.length > 0) {
          loadedPasswords = passData.passwords;
          setPasswordDocId(passData.id || passId);
        }
      }

      if (!loadedPasswords) {
        const passDocs = await fetchPasswordQuery.getDocuments("contest_passwords", conditions);
        if (passDocs && passDocs.length > 0 && passDocs[0]?.passwords && passDocs[0].passwords.length > 0) {
          loadedPasswords = passDocs[0].passwords;
          setPasswordDocId(passDocs[0].id);
        }
      }

      // 비밀번호 풀이 완전히 없는 경우 즉시 100개 자동 생성 및 DB 연결
      if (!loadedPasswords) {
        const newGenerated = generatePasswords();
        const added = await addPassword.addData({
          contestId,
          passwords: newGenerated,
        });
        if (added?.id) {
          loadedPasswords = newGenerated;
          setPasswordDocId(added.id);
          await updateContest.updateData(contestId, {
            contestPasswordId: added.id,
          });
        }
      }

      if (loadedPasswords) {
        const clonedPasswords = [...loadedPasswords];
        judgePasswordsRef.current = clonedPasswords;
        setJudgePasswords(clonedPasswords);
      }
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

    const safeKeyword = (searchKeyword || "").trim();
    const matchesKeyword = (judge) =>
      !safeKeyword ||
      (judge.judgeName || "").includes(safeKeyword) ||
      (judge.judgeTel || "").includes(safeKeyword) ||
      (judge.judgePromoter || "").includes(safeKeyword);

    switch (currentTab) {
      case 0:
        newData = newJudgesAllPool.filter(matchesKeyword);
        break;

      case 1:
        newData = newJudgesAssignPool.filter(matchesKeyword);
        break;

      case 2:
        newData = newJudgesAllPool.filter(
          (judge) => !judge.isJoined && matchesKeyword(judge)
        );
        break;

      default:
        break;
    }

    return newData;
  }, [judgesAllPool, judgesAssignPool, searchKeyword, currentTab]);

  const handleJudgeHeadAssign = async (e, judgeAssignId) => {
    const { checked } = e.target;

    if (!judgeAssignId) {
      setModalMessage({
        variant: "warning",
        title: "심판 선발 필요",
        body: "먼저 대회 심판으로 배정한 후 위원장으로 지정해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    const findIndexJudge = judgesAssignPool.findIndex(
      (find) => find.id === judgeAssignId
    );
    if (findIndexJudge === -1) return;

    const targetJudgeInfo = judgesAssignPool[findIndexJudge];
    const nextHeadState = Boolean(checked);

    try {
      const updated = await updateJudgesAssignPool.updateData(judgeAssignId, {
        ...targetJudgeInfo,
        isHead: nextHeadState,
      });
      if (updated) {
        setJudgesAssignPool((prev) =>
          prev.map((item) =>
            item.id === judgeAssignId
              ? { ...item, isHead: nextHeadState }
              : item
          )
        );
      }
    } catch (error) {
      console.log(error);
    }
  };
  const handleJudgesAssignPool = async (
    e,
    judges,
    contestId,
    judgeAssignId,
    passwordIndex
  ) => {
    const { checked } = e.target;

    if (checked) {
      const judgeKey = judges?.judgeUid || judges?.judgeTel || judges?.judgeName;
      if (!judgeKey || inFlightJudgesRef.current.has(judgeKey)) {
        return;
      }

      const assignedPasswordValues = new Set(
        judgesAssignPool.map((j) => j.onedayPassword).filter(Boolean)
      );
      const currentPasswords =
        judgePasswordsRef.current.length > 0
          ? [...judgePasswordsRef.current]
          : [...judgePasswords];

      const availablePassword = currentPasswords.find(
        (password) =>
          (password.used === false || password.used === undefined) &&
          password.value &&
          !assignedPasswordValues.has(password.value) &&
          !inFlightPasswordsRef.current.has(password.value)
      );

      if (!availablePassword || !availablePassword.value) {
        setModalMessage({
          variant: "warning",
          title: "일회용 비밀번호 부족",
          body: "사용 가능한 심판 일회용 비밀번호가 부족합니다.",
          body2: "비밀번호 풀 설정을 확인하거나 사용하지 않는 심판 배정을 해제해 주세요.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        return;
      }

      const onedayPassword = availablePassword.value;
      inFlightJudgesRef.current.add(judgeKey);
      inFlightPasswordsRef.current.add(onedayPassword);

      // 동일 배치 내 연속 클릭 시 중복 비밀번호 배정을 막기 위해 즉시 예약 반영
      const reservedPasswords = currentPasswords.map((pw) =>
        pw.value === onedayPassword ? { ...pw, used: true } : pw
      );
      judgePasswordsRef.current = reservedPasswords;
      setJudgePasswords(reservedPasswords);

      try {
        const newJudgeInfo = {
          judgeName: judges.judgeName,
          judgePromoter: judges.judgePromoter,
          judgeSignature: judges.judgeSignature,
          judgeTel: judges.judgeTel,
          judgeUid: judges.judgeUid,
          isAcitve: true,
          isConfirmed: true,
        };

        const passTargetId =
          passwordDocId || currentContest?.contests?.contestPasswordId;

        const addedJudge = await addJudgesAssignPool.addData({
          ...newJudgeInfo,
          contestId,
          isJoined: true,
          isHead: false,
          onedayPassword,
        });

        if (!addedJudge?.id) {
          // 실패 시 예약 롤백
          const rollbackPasswords = judgePasswordsRef.current.map((pw) =>
            pw.value === onedayPassword ? { ...pw, used: false } : pw
          );
          judgePasswordsRef.current = rollbackPasswords;
          setJudgePasswords(rollbackPasswords);
          return;
        }

        setJudgesAssignPool((prev) => [...prev, { ...addedJudge }]);

        if (passTargetId) {
          await updatePassword.updateData(passTargetId, {
            contestId,
            passwords: [...judgePasswordsRef.current],
          });
        }
      } catch (error) {
        console.error("심판 배정 중 에러:", error);
        const rollbackPasswords = judgePasswordsRef.current.map((pw) =>
          pw.value === onedayPassword ? { ...pw, used: false } : pw
        );
        judgePasswordsRef.current = rollbackPasswords;
        setJudgePasswords(rollbackPasswords);
      } finally {
        inFlightJudgesRef.current.delete(judgeKey);
        inFlightPasswordsRef.current.delete(onedayPassword);
      }
    } else {
      if (!judgeAssignId) {
        return;
      } else {
        try {
          const targetJudge = judgesAssignPool.find(
            (judge) => judge.id === judgeAssignId
          );
          if (!targetJudge) return;

          const { onedayPassword } = targetJudge;
          const passTargetId =
            passwordDocId || currentContest?.contests?.contestPasswordId;

          const deleted = await deleteJudgesAssignPool.deleteData(
            judgeAssignId
          );
          if (!deleted) return;

          setJudgesAssignPool((prev) =>
            prev.filter((judge) => judge.id !== judgeAssignId)
          );

          const basePasswords =
            judgePasswordsRef.current.length > 0
              ? [...judgePasswordsRef.current]
              : [...judgePasswords];

          const nextPasswords = onedayPassword
            ? basePasswords.map((pw) =>
                pw.value === onedayPassword ? { ...pw, used: false } : pw
              )
            : basePasswords;

          judgePasswordsRef.current = nextPasswords;
          setJudgePasswords(nextPasswords);

          if (passTargetId) {
            await updatePassword.updateData(passTargetId, {
              contestId,
              passwords: [...nextPasswords],
            });
          }
        } catch (error) {
          console.error("심판 배정 취소 중 에러:", error);
        }
      }
    }
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(currentContest.contests.id);
    }
  }, [currentContest?.contests?.id]);

  const selectedJudge = isOpen?.info || {};

  const matchedPoolJudge = useMemo(() => {
    const targetName = (selectedJudge?.judgeName || "").trim();
    if (!targetName) return null;
    const candidates = judgesAllPool.filter(
      (j) =>
        (j.judgeName || "").trim() === targetName &&
        hasSignature(j.judgeSignature)
    );
    if (candidates.length === 0) return null;
    return (
      candidates.find(
        (j) => j.judgeUid && j.judgeUid === selectedJudge?.judgeUid
      ) || candidates[0]
    );
  }, [selectedJudge?.judgeName, selectedJudge?.judgeUid, judgesAllPool]);

  const handleSyncJudgeFromPool = async () => {
    const info = isOpen?.info;
    if (!info?.isJoined || !info?.judgeAssignId || !matchedPoolJudge) return;

    const existingAssign =
      judgesAssignPool.find((item) => item.id === info.judgeAssignId) || {};

    const nextPayload = {
      ...existingAssign,
      judgeName: existingAssign.judgeName || info.judgeName || "",
      judgeSignature: matchedPoolJudge.judgeSignature,
      judgeTel:
        matchedPoolJudge.judgeTel ||
        existingAssign.judgeTel ||
        info.judgeTel ||
        "",
      judgePromoter:
        matchedPoolJudge.judgePromoter ||
        existingAssign.judgePromoter ||
        info.judgePromoter ||
        "",
      judgeUid: existingAssign.judgeUid ?? info.judgeUid,
      onedayPassword:
        existingAssign.onedayPassword ?? info.onedayPassword ?? "",
      isHead: Boolean(existingAssign.isHead ?? info.isHead),
    };

    setIsSync(false);
    try {
      const updated = await updateJudgesAssignPool.updateData(
        info.judgeAssignId,
        nextPayload
      );
      if (updated) {
        setJudgesAssignPool((prev) =>
          prev.map((item) =>
            item.id === info.judgeAssignId ? { ...item, ...nextPayload } : item
          )
        );
        setIsOpen((prev) => ({
          ...prev,
          info: {
            ...prev.info,
            judgeSignature: nextPayload.judgeSignature,
            judgeTel: nextPayload.judgeTel,
            judgePromoter: nextPayload.judgePromoter,
            judgeUid: nextPayload.judgeUid,
            onedayPassword: nextPayload.onedayPassword,
            isHead: nextPayload.isHead,
          },
        }));
        setModalMessage({
          variant: "success",
          title: "최신 서명·정보 동기화 완료",
          body: `${info.judgeName} 심판의 최신 서명 및 소속·연락처 정보가 반영되었습니다.`,
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
      }
    } catch (error) {
      console.error("심판 정보 동기화 중 에러:", error);
      setModalMessage({
        variant: "error",
        title: "동기화 실패",
        body: "심판 정보를 동기화하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsSync(true);
    }
  };

  const ContestInvoiceUncompleteRender = (
    <div className="w-full space-y-4">
      <Drawer
        anchor="right"
        open={Boolean(isOpen.judge)}
        onClose={handleJudgeClose}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 440 },
            bgcolor: "#ffffff",
            boxShadow: "-12px 0 40px rgba(15, 23, 42, 0.14)",
          },
        }}
      >
        <div className="h-full flex flex-col bg-white text-[#171717]">
          {/* 드로어 상단 헤더 */}
          <div className="px-5 py-4 bg-[#fafafa] border-b border-[#171717]/[0.08] flex items-center justify-between gap-3 shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[8px] bg-white border border-[#171717]/[0.08] flex items-center justify-center">
                <UserCheck
                  size={15}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
              </div>
              <h2 className="text-base font-semibold text-[#171717] m-0">
                {isOpen?.title || "심판 상세 정보"}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleJudgeClose}
              aria-label="닫기"
              className="w-8 h-8 rounded-[8px] inline-flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#e4e4e7]/70 transition-colors duration-150 cursor-pointer"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* 드로어 본문 */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* 기본 정보 카드 */}
            <div className="rounded-[12px] border border-[#171717]/[0.08] bg-[#fafafa] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#171717]/[0.08]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-semibold text-[#171717]">
                    {selectedJudge.judgeName || "-"}
                  </span>
                  {selectedJudge.isHead && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] border border-[#b45309]/20 text-[11px] font-medium">
                      <Crown size={11} strokeWidth={1.5} />
                      <span>위원장</span>
                    </span>
                  )}
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-medium border ${
                    selectedJudge.isJoined
                      ? "bg-[#2563eb]/[0.08] text-[#2563eb] border-[#2563eb]/20"
                      : "bg-white text-[#737373] border-[#171717]/[0.10]"
                  }`}
                >
                  {selectedJudge.isJoined ? "대회 배정됨" : "미배정"}
                </span>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#737373]">
                    소속
                  </span>
                  <span className="text-sm font-medium text-[#171717] text-right">
                    {selectedJudge.judgePromoter || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#737373]">
                    연락처
                  </span>
                  <span className="text-sm font-mono tabular-nums text-[#171717]">
                    {selectedJudge.judgeTel || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#737373]">
                    개인 비밀번호
                  </span>
                  {selectedJudge.onedayPassword ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-white border border-[#171717]/[0.10] font-mono tabular-nums text-xs font-semibold text-[#171717]">
                      <KeyRound
                        size={12}
                        strokeWidth={1.5}
                        className="text-[#737373]"
                      />
                      <span>{selectedJudge.onedayPassword}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-[#737373]">미배정</span>
                  )}
                </div>
              </div>
            </div>

            {/* 서명 상태 카드 */}
            <div className="rounded-[12px] border border-[#171717]/[0.08] bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#525252]">
                  등록 서명 상태
                </span>
                {hasSignature(selectedJudge.judgeSignature) ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#16a34a]/[0.10] text-[#16a34a] border border-[#16a34a]/20 text-[11px] font-medium">
                    서명 등록됨
                  </span>
                ) : (
                  <span className="inline-flex items-center bg-[#f59e0b]/10 text-[#b45309] border border-[#f59e0b]/25 text-[11px] font-medium px-2 py-0.5 rounded-[4px]">
                    서명 미등록
                  </span>
                )}
              </div>

              <div className="rounded-[8px] border border-[#171717]/[0.08] bg-[#fafafa] min-h-[112px] flex items-center justify-center p-3">
                {hasSignature(selectedJudge.judgeSignature) ? (
                  <CanvasWithImageData
                    imageData={selectedJudge.judgeSignature}
                    style={{
                      width: "180px",
                      height: "88px",
                      padding: "0",
                    }}
                  />
                ) : (
                  <span className="text-xs text-[#737373]">
                    현재 대회 배정 정보에 등록된 서명이 없습니다.
                  </span>
                )}
              </div>
            </div>

            {/* 심판 풀 최신 서명·정보 동기화 섹션 */}
            {Boolean(
              selectedJudge.isJoined &&
                selectedJudge.judgeAssignId &&
                matchedPoolJudge
            ) && (
              <div className="rounded-[12px] border border-[#2563eb]/20 bg-[#2563eb]/[0.04] p-4 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-[#171717]">
                    심판 풀 최신 데이터 감지
                  </div>
                  <p className="text-xs text-[#525252] m-0 leading-relaxed">
                    전체 심판 풀(judges_pool)에 등록된{" "}
                    <strong>{matchedPoolJudge.judgeName}</strong> 심판의 최신
                    서명·연락처·소속 정보를 개인 비밀번호와 위원장 여부를 유지한
                    채 동기화합니다.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!isSync}
                  onClick={handleSyncJudgeFromPool}
                  className="w-full h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer border-0"
                >
                  <RefreshCw
                    size={14}
                    strokeWidth={1.5}
                    className={!isSync ? "animate-spin" : ""}
                  />
                  <span>
                    {!isSync ? "동기화 중..." : "최신 서명·정보 동기화"}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 드로어 하단 고정 푸터 */}
          <div className="px-5 py-3.5 bg-[#fafafa] border-t border-[#171717]/[0.08] flex items-center justify-end gap-2 shrink-0 sticky bottom-0">
            <button
              type="button"
              onClick={handleJudgeClose}
              className="h-9 px-4 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] text-xs font-medium transition-colors duration-150 cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </Drawer>

      {/* 검색 바 */}
      <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:max-w-md">
          <div className="relative flex-1 flex items-center">
            <Search
              size={15}
              strokeWidth={1.5}
              className="absolute left-3 text-[#737373] pointer-events-none"
            />
            <input
              type="text"
              name="contestCategoryTitle"
              value={searchInfo || ""}
              onChange={(e) => setSearchInfo(e.target.value.trim())}
              onKeyDown={(e) => {
                e.key === "Enter" && handleSearchKeyword();
              }}
              className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] pl-9 pr-3 text-sm text-[#171717] placeholder:text-[#737373] outline-none focus:border-[#2563eb] transition-colors duration-150"
              placeholder="이름, 연락처, 소속 검색"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors duration-150 cursor-pointer border-0 shrink-0"
            onClick={handleSearchKeyword}
          >
            검색
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#525252] font-mono tabular-nums">
          <span>선발 심판 {judgesAssignPool.length}명</span>
          <span className="text-[#171717]/[0.15]">|</span>
          <span>조회 {filteredData?.length || 0}명</span>
        </div>
      </div>

      {/* 심판 목록 테이블 */}
      <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] text-xs font-medium text-[#525252]">
                <th className="py-3 px-3 text-center w-20">배정</th>
                <th className="py-3 px-3 text-center w-20">위원장</th>
                <th className="py-3 px-4">이름</th>
                <th className="py-3 px-4 hidden lg:table-cell">연락처</th>
                <th className="py-3 px-4 hidden lg:table-cell">소속</th>
                <th className="py-3 px-4 hidden lg:table-cell w-36">서명</th>
                <th className="py-3 px-4 w-36">개인 비밀번호</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171717]/[0.06]">
              {filteredData?.length > 0 ? (
                filteredData.map((filtered, fIdx) => {
                  const {
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
                    <tr
                      className={`transition-colors duration-150 ${
                        isJoined
                          ? "bg-[#2563eb]/[0.02] hover:bg-[#2563eb]/[0.04]"
                          : "hover:bg-[#fafafa]"
                      }`}
                      key={judgeAssignId || judgeUid || fIdx}
                    >
                      <td className="py-2.5 px-3 text-center">
                        {!isConfirmed ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.08] text-[#dc2626] text-[11px] font-medium">
                            불가
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            name="judgeAssignJoin"
                            checked={isJoined}
                            onChange={(e) =>
                              handleJudgesAssignPool(
                                e,
                                filtered,
                                currentContest.contests.id,
                                judgeAssignId,
                                fIdx
                              )
                            }
                            className="w-4 h-4 rounded-[4px] accent-[#2563eb] cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          name="judgeAssignHead"
                          checked={isHead}
                          disabled={!isJoined || !judgeAssignId}
                          onChange={(e) =>
                            handleJudgeHeadAssign(e, judgeAssignId)
                          }
                          className="w-4 h-4 rounded-[4px] accent-[#2563eb] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setIsOpen({
                                judge: true,
                                title: "심판 상세 정보",
                                info: filtered,
                              })
                            }
                            className={`font-medium text-left bg-transparent border-0 p-0 cursor-pointer hover:text-[#2563eb] hover:underline transition-colors duration-150 ${
                              !isConfirmed
                                ? "line-through text-[#737373]"
                                : "text-[#171717]"
                            }`}
                          >
                            {judgeName}
                          </button>
                          {isHead && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] border border-[#b45309]/20 text-[11px] font-medium">
                              <Crown size={11} strokeWidth={1.5} />
                              <span>위원장</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-[#525252] font-mono tabular-nums hidden lg:table-cell">
                        {judgeTel || "-"}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-[#525252] hidden lg:table-cell">
                        {judgePromoter || "-"}
                      </td>
                      <td className="py-2 px-4 hidden lg:table-cell">
                        {hasSignature(judgeSignature) ? (
                          <CanvasWithImageData
                            imageData={judgeSignature}
                            style={{
                              width: "76px",
                              height: "52px",
                              padding: "0",
                            }}
                          />
                        ) : (
                          <span className="inline-flex items-center bg-[#f59e0b]/10 text-[#b45309] border border-[#f59e0b]/25 text-[11px] font-medium px-2 py-0.5 rounded-[4px]">
                            서명 미등록
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {onedayPassword ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] font-mono tabular-nums text-xs font-semibold text-[#171717]">
                            <KeyRound
                              size={12}
                              strokeWidth={1.5}
                              className="text-[#737373]"
                            />
                            <span>{onedayPassword}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-[#737373]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-sm text-[#737373]"
                  >
                    해당 조건에 일치하는 심판이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />
      {isLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
          {/* 상단 헤더 */}
          <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] flex items-center justify-center">
                <UserCheck
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[#171717] m-0 tracking-tight">
                  심판 선발 및 비밀번호 배정
                </h1>
                <p className="text-xs text-[#737373] m-0">
                  {tabArray[currentTab]?.subTitle ||
                    "이번 대회 심판진 선발 및 일회용 인증번호 관리"}
                </p>
              </div>
            </div>

            {/* 탭 필터 */}
            <div className="inline-flex items-center gap-1 bg-[#f4f4f5] p-1 rounded-[8px]">
              {tabArray.map((tab, tIdx) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`h-8 px-3.5 rounded-[6px] text-xs font-medium transition-colors duration-150 cursor-pointer border-0 ${
                    currentTab === tab.id
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "bg-transparent text-[#525252] hover:text-[#171717]"
                  }`}
                  onClick={() => setCurrentTab(tIdx)}
                >
                  {tab.title}
                </button>
              ))}
            </div>
          </div>

          {currentTab === 0 && ContestInvoiceUncompleteRender}
          {currentTab === 1 && ContestInvoiceUncompleteRender}
          {currentTab === 2 && ContestInvoiceUncompleteRender}
        </div>
      )}
    </div>
  );
};

export default ContestJudgeTable;
