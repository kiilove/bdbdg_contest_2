import React, { useContext, useRef, useState, useEffect, useMemo } from "react";
import {
  useFirestoreQuery,
  useFirestoreUpdateData,
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreGetDocument,
} from "../hooks/useFirestores";
import { doc, runTransaction, where } from "firebase/firestore";
import { db } from "../firebase";
import { sanitizeForFirestore } from "../utils/firestoreSanitize";
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
  Check,
  Copy,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

const hasSignature = (sig) => Boolean(sig && String(sig).trim());

const ContestJudgeTable = ({ onGoAssign }) => {
  const [currentTab, setCurrentTab] = useState(1);
  const [onlyUnsigned, setOnlyUnsigned] = useState(false);
  const [judgePasswords, setJudgePasswords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSync, setIsSync] = useState(true);
  const [busyJudgeKeys, setBusyJudgeKeys] = useState({});
  const [copiedPwKey, setCopiedPwKey] = useState(null);
  const [judgesAllPool, setJudgesAllPool] = useState([]);
  const [judgesAssignPool, setJudgesAssignPool] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});

  const [isOpen, setIsOpen] = useState({
    judge: false,
    title: "",
    info: {},
  });

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
            [...data].sort((a, b) =>
              (a.judgeName || "").localeCompare(b.judgeName || "", "ko")
            )
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
        const passDocs = await fetchPasswordQuery.getDocuments(
          "contest_passwords",
          conditions
        );
        if (
          passDocs &&
          passDocs.length > 0 &&
          passDocs[0]?.passwords &&
          passDocs[0].passwords.length > 0
        ) {
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

  const handleJudgeClose = () => {
    setIsOpen({
      judge: false,
      title: "",
      info: {},
    });
  };

  const handleCopyPassword = (pw, rowKey) => {
    if (!pw || !navigator?.clipboard) return;
    navigator.clipboard.writeText(String(pw)).then(() => {
      setCopiedPwKey(rowKey);
      setTimeout(() => {
        setCopiedPwKey((prev) => (prev === rowKey ? null : prev));
      }, 1500);
    });
  };

  // 운영 요약 지표 계산
  const summaryStats = useMemo(() => {
    const totalPoolCount = judgesAllPool.length;
    const assignedCount = judgesAssignPool.length;
    const assignedUidSet = new Set(
      judgesAssignPool.map((j) => j.judgeUid).filter(Boolean)
    );
    const unassignedCount = judgesAllPool.filter(
      (j) => !assignedUidSet.has(j.judgeUid)
    ).length;

    const headJudges = judgesAssignPool.filter((j) => Boolean(j.isHead));
    const signedAssignedCount = judgesAssignPool.filter((j) =>
      hasSignature(j.judgeSignature)
    ).length;
    const unsignedAssignedCount = Math.max(
      0,
      assignedCount - signedAssignedCount
    );

    const assignedPwSet = new Set(
      judgesAssignPool.map((j) => j.onedayPassword).filter(Boolean)
    );
    const availablePasswordCount = judgePasswords.filter(
      (pw) =>
        (pw.used === false || pw.used === undefined) &&
        pw.value &&
        !assignedPwSet.has(pw.value)
    ).length;

    return {
      totalPoolCount,
      assignedCount,
      unassignedCount,
      headJudges,
      signedAssignedCount,
      unsignedAssignedCount,
      availablePasswordCount,
      totalPasswordCount: judgePasswords.length,
    };
  }, [judgesAllPool, judgesAssignPool, judgePasswords]);

  const tabItems = [
    {
      id: 1,
      title: "선발된 심판",
      count: summaryStats.assignedCount,
    },
    {
      id: 2,
      title: "미선발 풀",
      count: summaryStats.unassignedCount,
    },
    {
      id: 0,
      title: "전체 등록 풀",
      count: summaryStats.totalPoolCount,
    },
  ];

  const filteredData = useMemo(() => {
    const assignByUid = new Map(
      judgesAssignPool.map((a) => [a.judgeUid, a])
    );

    const newJudgesAllPool = [...judgesAllPool]
      .sort((a, b) =>
        (a.judgeName || "").localeCompare(b.judgeName || "", "ko")
      )
      .map((judge) => {
        const {
          judgeName,
          judgeTel,
          judgeUid,
          judgePromoter,
          isConfirmed,
          judgeSignature,
        } = judge;
        const foundAssign = assignByUid.get(judgeUid);
        const isJoined = Boolean(foundAssign);

        return {
          judgeUid,
          judgeName,
          judgePromoter,
          judgeTel,
          isJoined,
          isConfirmed,
          isHead: foundAssign?.isHead || false,
          judgeSignature: foundAssign?.judgeSignature ?? judgeSignature,
          onedayPassword: foundAssign?.onedayPassword || "",
          judgeAssignId: foundAssign?.id || "",
        };
      });

    const newJudgesAssignPool = [...judgesAssignPool]
      .sort((a, b) =>
        (a.judgeName || "").localeCompare(b.judgeName || "", "ko")
      )
      .map((judge) => {
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
          isConfirmed: isConfirmed ?? true,
          isHead,
          judgeSignature,
          onedayPassword,
          judgeAssignId: id,
        };
      });

    const safeKeyword = (searchKeyword || "").trim().toLowerCase();
    const matchesKeyword = (judge) => {
      if (onlyUnsigned && hasSignature(judge.judgeSignature)) return false;
      if (!safeKeyword) return true;
      return (
        (judge.judgeName || "").toLowerCase().includes(safeKeyword) ||
        (judge.judgeTel || "").toLowerCase().includes(safeKeyword) ||
        (judge.judgePromoter || "").toLowerCase().includes(safeKeyword) ||
        (judge.onedayPassword || "").toLowerCase().includes(safeKeyword)
      );
    };

    switch (currentTab) {
      case 0:
        return newJudgesAllPool.filter(matchesKeyword);
      case 1:
        return newJudgesAssignPool.filter(matchesKeyword);
      case 2:
        return newJudgesAllPool.filter(
          (judge) => !judge.isJoined && matchesKeyword(judge)
        );
      default:
        return [];
    }
  }, [judgesAllPool, judgesAssignPool, searchKeyword, currentTab, onlyUnsigned]);

  const handleJudgeHeadAssign = async (nextChecked, judgeAssignId) => {
    if (!judgeAssignId) {
      setModalMessage({
        variant: "warning",
        title: "심판 선발 필요",
        body: "먼저 대회 심판으로 선발한 후 위원장으로 지정해 주세요.",
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
    const nextHeadState = Boolean(nextChecked);

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
        setIsOpen((prev) =>
          prev?.judge && prev?.info?.judgeAssignId === judgeAssignId
            ? {
                ...prev,
                info: { ...prev.info, isHead: nextHeadState },
              }
            : prev
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleJudgesAssignPool = async (
    nextChecked,
    judges,
    contestId,
    judgeAssignId
  ) => {
    const judgeKey =
      judges?.judgeUid || judges?.judgeTel || judges?.judgeName || judgeAssignId;
    if (!judgeKey || inFlightJudgesRef.current.has(judgeKey)) {
      return;
    }

    setBusyJudgeKeys((prev) => ({ ...prev, [judgeKey]: true }));

    if (nextChecked) {
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
        setBusyJudgeKeys((prev) => {
          const next = { ...prev };
          delete next[judgeKey];
          return next;
        });
        setModalMessage({
          variant: "warning",
          title: "일회용 인증번호 부족",
          body: "사용 가능한 심판 일회용 인증번호가 부족합니다.",
          body2: "사용하지 않는 심판 선발을 해제한 뒤 다시 시도해 주세요.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        return;
      }

      let onedayPassword = availablePassword.value;
      inFlightJudgesRef.current.add(judgeKey);
      inFlightPasswordsRef.current.add(onedayPassword);

      // 동일 배치 내 연속 클릭 시 중복 비밀번호 배정을 막기 위해 즉시 예약 반영
      const reservedPasswords = currentPasswords.map((pw) =>
        pw.value === onedayPassword ? { ...pw, used: true } : pw
      );
      judgePasswordsRef.current = reservedPasswords;
      setJudgePasswords(reservedPasswords);

      const passTargetId =
        passwordDocId || currentContest?.contests?.contestPasswordId;
      let passwordClaimedInDb = false;

      const releaseClaimedPasswordInDb = async (pwValue) => {
        if (!passTargetId || !pwValue) return;
        try {
          const passRef = doc(db, "contest_passwords", passTargetId);
          const rolledBack = await runTransaction(db, async (transaction) => {
            const passSnap = await transaction.get(passRef);
            if (!passSnap.exists()) return null;
            const remotePasswords = Array.isArray(passSnap.data()?.passwords)
              ? passSnap.data().passwords
              : [];
            const updatedPasswords = remotePasswords.map((pw) =>
              pw?.value === pwValue ? { ...pw, used: false } : pw
            );
            transaction.update(
              passRef,
              sanitizeForFirestore({
                contestId,
                passwords: updatedPasswords,
              })
            );
            return updatedPasswords;
          });
          if (rolledBack) {
            judgePasswordsRef.current = rolledBack;
            setJudgePasswords(rolledBack);
          }
        } catch (rollbackErr) {
          console.error("비밀번호 예약 롤백 실패:", rollbackErr);
        }
      };

      try {
        if (passTargetId) {
          const passRef = doc(db, "contest_passwords", passTargetId);
          const txResult = await runTransaction(db, async (transaction) => {
            const passSnap = await transaction.get(passRef);
            const remotePasswords = passSnap.exists()
              ? Array.isArray(passSnap.data()?.passwords)
                ? passSnap.data().passwords
                : []
              : currentPasswords;

            let chosen = remotePasswords.find(
              (pw) =>
                pw?.value === onedayPassword &&
                (pw.used === false || pw.used === undefined) &&
                !assignedPasswordValues.has(pw.value)
            );
            if (!chosen) {
              chosen = remotePasswords.find(
                (pw) =>
                  (pw?.used === false || pw?.used === undefined) &&
                  pw?.value &&
                  !assignedPasswordValues.has(pw.value) &&
                  (!inFlightPasswordsRef.current.has(pw.value) ||
                    pw.value === onedayPassword)
              );
            }
            if (!chosen || !chosen.value) {
              return { claimedValue: null, passwords: remotePasswords };
            }

            const updatedPasswords = remotePasswords.map((pw) =>
              pw?.value === chosen.value ? { ...pw, used: true } : pw
            );

            if (passSnap.exists()) {
              transaction.update(
                passRef,
                sanitizeForFirestore({
                  contestId,
                  passwords: updatedPasswords,
                })
              );
            } else {
              transaction.set(
                passRef,
                sanitizeForFirestore({
                  contestId,
                  passwords: updatedPasswords,
                })
              );
            }

            return { claimedValue: chosen.value, passwords: updatedPasswords };
          });

          if (!txResult?.claimedValue) {
            const synced = txResult?.passwords || currentPasswords;
            judgePasswordsRef.current = synced;
            setJudgePasswords(synced);
            setModalMessage({
              variant: "warning",
              title: "일회용 인증번호 부족",
              body: "사용 가능한 심판 일회용 인증번호가 부족합니다.",
              body2:
                "사용하지 않는 심판 선발을 해제한 뒤 다시 시도해 주세요.",
              isButton: true,
              confirmButtonText: "확인",
            });
            setMsgOpen(true);
            return;
          }

          if (txResult.claimedValue !== onedayPassword) {
            inFlightPasswordsRef.current.delete(onedayPassword);
            onedayPassword = txResult.claimedValue;
            inFlightPasswordsRef.current.add(onedayPassword);
          }
          passwordClaimedInDb = true;
          judgePasswordsRef.current = txResult.passwords;
          setJudgePasswords(txResult.passwords);
        }

        const newJudgeInfo = {
          judgeName: judges.judgeName,
          judgePromoter: judges.judgePromoter,
          judgeSignature: judges.judgeSignature,
          judgeTel: judges.judgeTel,
          judgeUid: judges.judgeUid,
          isActive: true,
          isAcitve: true,
          isConfirmed: true,
        };

        const addedJudge = await addJudgesAssignPool.addData({
          ...newJudgeInfo,
          contestId,
          isJoined: true,
          isHead: false,
          onedayPassword,
        });

        if (!addedJudge?.id) {
          if (passwordClaimedInDb) {
            await releaseClaimedPasswordInDb(onedayPassword);
          } else {
            const rollbackPasswords = judgePasswordsRef.current.map((pw) =>
              pw.value === onedayPassword ? { ...pw, used: false } : pw
            );
            judgePasswordsRef.current = rollbackPasswords;
            setJudgePasswords(rollbackPasswords);
          }
          return;
        }

        setJudgesAssignPool((prev) =>
          [...prev, { ...addedJudge }].sort((a, b) =>
            (a.judgeName || "").localeCompare(b.judgeName || "", "ko")
          )
        );
      } catch (error) {
        console.error("심판 배정 중 에러:", error);
        if (passwordClaimedInDb) {
          await releaseClaimedPasswordInDb(onedayPassword);
        } else {
          const rollbackPasswords = judgePasswordsRef.current.map((pw) =>
            pw.value === onedayPassword ? { ...pw, used: false } : pw
          );
          judgePasswordsRef.current = rollbackPasswords;
          setJudgePasswords(rollbackPasswords);
        }
      } finally {
        inFlightJudgesRef.current.delete(judgeKey);
        inFlightPasswordsRef.current.delete(onedayPassword);
        setBusyJudgeKeys((prev) => {
          const next = { ...prev };
          delete next[judgeKey];
          return next;
        });
      }
    } else {
      if (!judgeAssignId) {
        setBusyJudgeKeys((prev) => {
          const next = { ...prev };
          delete next[judgeKey];
          return next;
        });
        return;
      }

      inFlightJudgesRef.current.add(judgeKey);
      try {
        const targetJudge = judgesAssignPool.find(
          (judge) => judge.id === judgeAssignId
        );
        if (!targetJudge) return;

        const { onedayPassword } = targetJudge;
        const passTargetId =
          passwordDocId || currentContest?.contests?.contestPasswordId;

        const deleted = await deleteJudgesAssignPool.deleteData(judgeAssignId);
        if (!deleted) return;

        setJudgesAssignPool((prev) =>
          prev.filter((judge) => judge.id !== judgeAssignId)
        );

        if (passTargetId && onedayPassword) {
          const passRef = doc(db, "contest_passwords", passTargetId);
          const updatedPasswords = await runTransaction(
            db,
            async (transaction) => {
              const passSnap = await transaction.get(passRef);
              if (!passSnap.exists()) return null;
              const remotePasswords = Array.isArray(passSnap.data()?.passwords)
                ? passSnap.data().passwords
                : [];
              const next = remotePasswords.map((pw) =>
                pw?.value === onedayPassword ? { ...pw, used: false } : pw
              );
              transaction.update(
                passRef,
                sanitizeForFirestore({
                  contestId,
                  passwords: next,
                })
              );
              return next;
            }
          );
          if (updatedPasswords) {
            judgePasswordsRef.current = updatedPasswords;
            setJudgePasswords(updatedPasswords);
          }
        } else {
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
        }
      } catch (error) {
        console.error("심판 배정 취소 중 에러:", error);
      } finally {
        inFlightJudgesRef.current.delete(judgeKey);
        setBusyJudgeKeys((prev) => {
          const next = { ...prev };
          delete next[judgeKey];
          return next;
        });
      }
    }
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(currentContest.contests.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="w-full bg-[#fafafa] text-[#171717]">
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />

      {/* 심판 상세 · 서명 동기화 드로어 */}
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
              className="w-8 h-8 rounded-[8px] inline-flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#e4e4e7]/70 transition-colors duration-150 cursor-pointer border-0 bg-transparent"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* 기본 정보 카드 */}
            <div className="rounded-[12px] border border-[#171717]/[0.08] bg-[#fafafa] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#171717]/[0.08]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-semibold text-[#171717]">
                    {selectedJudge.judgeName || "-"}
                  </span>
                  {selectedJudge.isHead && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] bg-[#b45309]/[0.10] text-[#b45309] border border-[#b45309]/20 text-[11px] font-medium">
                      <Crown size={11} strokeWidth={1.5} />
                      <span>위원장</span>
                    </span>
                  )}
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-medium border ${
                    selectedJudge.isJoined
                      ? "bg-[#2563eb]/[0.08] text-[#2563eb] border-[#2563eb]/20"
                      : "bg-white text-[#737373] border-[#171717]/[0.10]"
                  }`}
                >
                  {selectedJudge.isJoined ? "대회 선발됨" : "미선발"}
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
                    개인 인증번호
                  </span>
                  {selectedJudge.onedayPassword ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyPassword(
                          selectedJudge.onedayPassword,
                          "drawer-pw"
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] font-mono tabular-nums text-xs font-semibold text-[#171717] transition-colors duration-150 cursor-pointer"
                      title="클릭하여 인증번호 복사"
                    >
                      <KeyRound
                        size={12}
                        strokeWidth={1.5}
                        className="text-[#737373]"
                      />
                      <span>{selectedJudge.onedayPassword}</span>
                      {copiedPwKey === "drawer-pw" ? (
                        <Check
                          size={12}
                          strokeWidth={1.8}
                          className="text-[#16a34a]"
                        />
                      ) : (
                        <Copy
                          size={11}
                          strokeWidth={1.5}
                          className="text-[#737373]"
                        />
                      )}
                    </button>
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
                  전자서명 등록 상태
                </span>
                {hasSignature(selectedJudge.judgeSignature) ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] bg-[#16a34a]/[0.08] text-[#16a34a] border border-[#16a34a]/20 text-[11px] font-medium">
                    서명 등록됨
                  </span>
                ) : (
                  <span className="inline-flex items-center bg-[#b45309]/[0.08] text-[#b45309] border border-[#b45309]/20 text-[11px] font-medium px-2 py-0.5 rounded-[5px]">
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
                    등록된 전자서명이 없습니다
                  </span>
                )}
              </div>
            </div>

            {/* 심판 풀 최신 서명·정보 동기화 */}
            {Boolean(
              selectedJudge.isJoined &&
                selectedJudge.judgeAssignId &&
                matchedPoolJudge
            ) && (
              <div className="rounded-[12px] border border-[#2563eb]/20 bg-[#2563eb]/[0.04] p-4 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-[#171717]">
                    전체 심판 풀 최신 정보 동기화
                  </div>
                  <p className="text-xs text-[#525252] m-0 leading-relaxed">
                    원본 심판 풀(judges_pool)에 저장된{" "}
                    <strong>{matchedPoolJudge.judgeName}</strong> 심판의 최신
                    서명·소속·연락처를 현재 인증번호와 위원장 설정을 유지한 채
                    반영합니다.
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

      {isLoading ? (
        <div className="flex w-full min-h-[420px] justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-4">
          {/* 1. 운영 핵심 지표 스트립 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-4 flex flex-col justify-between gap-1.5">
              <span className="text-xs font-medium text-[#737373]">
                이번 대회 선발 심판
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-semibold font-mono tabular-nums text-[#171717]">
                  {summaryStats.assignedCount}
                  <span className="text-sm font-sans font-normal text-[#737373] ml-1">
                    명
                  </span>
                </span>
                <span className="text-xs font-mono tabular-nums text-[#737373]">
                  전체 풀 {summaryStats.totalPoolCount}명
                </span>
              </div>
            </div>

            <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-4 flex flex-col justify-between gap-1.5">
              <span className="text-xs font-medium text-[#737373]">
                심판위원장 지정
              </span>
              <div className="flex items-baseline justify-between gap-2 min-w-0">
                <span className="text-2xl font-semibold font-mono tabular-nums text-[#171717] shrink-0">
                  {summaryStats.headJudges.length}
                  <span className="text-sm font-sans font-normal text-[#737373] ml-1">
                    명
                  </span>
                </span>
                {summaryStats.headJudges.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#b45309] truncate">
                    <Crown size={12} strokeWidth={1.6} className="shrink-0" />
                    <span className="truncate">
                      {summaryStats.headJudges
                        .map((h) => h.judgeName)
                        .join(", ")}
                    </span>
                  </span>
                ) : summaryStats.assignedCount > 0 ? (
                  <span className="text-xs font-medium text-[#b45309]">
                    위원장 미지정
                  </span>
                ) : (
                  <span className="text-xs text-[#737373]">선발 대기</span>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-4 flex flex-col justify-between gap-1.5">
              <span className="text-xs font-medium text-[#737373]">
                전자서명 등록 (선발 기준)
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-semibold font-mono tabular-nums text-[#171717]">
                  {summaryStats.signedAssignedCount}
                  <span className="text-sm text-[#737373] font-normal">
                    {" "}
                    / {summaryStats.assignedCount}
                  </span>
                </span>
                {summaryStats.unsignedAssignedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab(1);
                      setOnlyUnsigned((v) => !v);
                    }}
                    className="text-xs font-medium text-[#b45309] hover:underline bg-transparent border-0 p-0 cursor-pointer"
                  >
                    미등록 {summaryStats.unsignedAssignedCount}명
                  </button>
                ) : (
                  <span className="text-xs font-medium text-[#16a34a]">
                    {summaryStats.assignedCount > 0 ? "전원 등록됨" : "-"}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-4 flex flex-col justify-between gap-1.5">
              <span className="text-xs font-medium text-[#737373]">
                일회용 인증번호 잔여
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-semibold font-mono tabular-nums text-[#171717]">
                  {summaryStats.availablePasswordCount}
                  <span className="text-sm font-sans font-normal text-[#737373] ml-1">
                    개
                  </span>
                </span>
                <span className="text-xs font-mono tabular-nums text-[#737373]">
                  총 {summaryStats.totalPasswordCount}개 풀
                </span>
              </div>
            </div>
          </div>

          {/* 2. 통합 필터 탭 & 실시간 검색 툴바 */}
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1 bg-[#f4f4f5] p-1 rounded-[8px]">
                {tabItems.map((tab) => {
                  const isActive = currentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCurrentTab(tab.id)}
                      className={`h-8 px-3 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer border-0 ${
                        isActive
                          ? "bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                          : "bg-transparent text-[#525252] hover:text-[#171717]"
                      }`}
                    >
                      <span>{tab.title}</span>
                      <span
                        className={`font-mono text-[11px] tabular-nums px-1.5 py-0 rounded-[4px] ${
                          isActive
                            ? "bg-[#2563eb]/[0.10] text-[#2563eb]"
                            : "bg-black/[0.05] text-[#737373]"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setOnlyUnsigned((v) => !v)}
                className={`h-8 px-3 rounded-[8px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer border ${
                  onlyUnsigned
                    ? "bg-[#b45309]/[0.10] text-[#b45309] border-[#b45309]/30"
                    : "bg-white text-[#525252] border-[#171717]/[0.10] hover:bg-[#f4f4f5]"
                }`}
              >
                <AlertTriangle size={13} strokeWidth={1.6} />
                <span>서명 미등록만</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 sm:w-72 flex items-center">
                <Search
                  size={15}
                  strokeWidth={1.5}
                  className="absolute left-3 text-[#737373] pointer-events-none"
                />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="이름, 소속, 연락처, 인증번호 검색"
                  className="h-9 w-full rounded-[8px] border border-[#171717]/[0.12] bg-[#fafafa] focus:bg-white pl-9 pr-8 text-sm text-[#171717] placeholder:text-[#737373] outline-none focus:border-[#2563eb] transition-colors duration-150"
                />
                {searchKeyword && (
                  <button
                    type="button"
                    onClick={() => setSearchKeyword("")}
                    aria-label="검색어 지우기"
                    className="absolute right-2 w-5 h-5 rounded-[4px] inline-flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#e4e4e7]/70 bg-transparent border-0 cursor-pointer"
                  >
                    <X size={13} strokeWidth={1.6} />
                  </button>
                )}
              </div>

              <span className="text-xs font-mono tabular-nums text-[#737373] px-1 shrink-0">
                조회 {filteredData.length}명
              </span>

              {onGoAssign && summaryStats.assignedCount > 0 && (
                <button
                  type="button"
                  onClick={onGoAssign}
                  className="h-9 px-3.5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer border-0 shrink-0"
                >
                  <span>좌석 배정 이동</span>
                  <ArrowRight size={14} strokeWidth={1.6} />
                </button>
              )}
            </div>
          </div>

          {/* 3. 심판 선발 · 위원장 · 인증번호 테이블 */}
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08] text-xs font-medium text-[#525252]">
                    <th className="py-3 px-4 w-28 text-center">대회 선발</th>
                    <th className="py-3 px-3 w-28 text-center">위원장 지정</th>
                    <th className="py-3 px-4">심판명</th>
                    <th className="py-3 px-4 hidden lg:table-cell">소속</th>
                    <th className="py-3 px-4 hidden lg:table-cell w-40">
                      연락처
                    </th>
                    <th className="py-3 px-4 w-32 text-center">전자서명</th>
                    <th className="py-3 px-4 w-40">개인 인증번호</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171717]/[0.06]">
                  {filteredData.length > 0 ? (
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

                      const rowKey = judgeAssignId || judgeUid || `row-${fIdx}`;
                      const busyKey =
                        judgeUid || judgeTel || judgeName || judgeAssignId;
                      const isRowBusy = Boolean(busyKey && busyJudgeKeys[busyKey]);

                      return (
                        <tr
                          key={rowKey}
                          className={`h-14 transition-colors duration-150 ${
                            isJoined
                              ? "bg-[#2563eb]/[0.015] hover:bg-[#2563eb]/[0.035]"
                              : "hover:bg-[#fafafa]"
                          }`}
                        >
                          {/* 대회 선발 토글 버튼 */}
                          <td className="py-2 px-4 text-center">
                            {!isConfirmed ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-[6px] bg-[#dc2626]/[0.08] text-[#dc2626] text-[11px] font-medium">
                                위촉 불가
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isRowBusy}
                                onClick={() =>
                                  handleJudgesAssignPool(
                                    !isJoined,
                                    filtered,
                                    currentContest.contests.id,
                                    judgeAssignId
                                  )
                                }
                                className={`h-8 min-w-[76px] px-2.5 rounded-[7px] text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer border disabled:opacity-50 ${
                                  isJoined
                                    ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white border-[#2563eb]"
                                    : "bg-white hover:bg-[#f4f4f5] text-[#525252] hover:text-[#171717] border-[#171717]/[0.14]"
                                }`}
                              >
                                {isRowBusy ? (
                                  <RefreshCw
                                    size={12}
                                    strokeWidth={1.6}
                                    className="animate-spin"
                                  />
                                ) : isJoined ? (
                                  <Check size={13} strokeWidth={1.8} />
                                ) : null}
                                <span>
                                  {isRowBusy
                                    ? "처리중"
                                    : isJoined
                                    ? "선발됨"
                                    : "선발"}
                                </span>
                              </button>
                            )}
                          </td>

                          {/* 위원장 지정 토글 */}
                          <td className="py-2 px-3 text-center">
                            {isJoined && judgeAssignId ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleJudgeHeadAssign(!isHead, judgeAssignId)
                                }
                                className={`h-8 min-w-[74px] px-2.5 rounded-[7px] text-xs font-medium inline-flex items-center justify-center gap-1 transition-colors duration-150 cursor-pointer border ${
                                  isHead
                                    ? "bg-[#b45309]/[0.10] hover:bg-[#b45309]/[0.16] text-[#b45309] border-[#b45309]/30"
                                    : "bg-transparent hover:bg-[#f4f4f5] text-[#737373] hover:text-[#171717] border-transparent hover:border-[#171717]/[0.10]"
                                }`}
                              >
                                <Crown size={12} strokeWidth={1.6} />
                                <span>{isHead ? "위원장" : "지정"}</span>
                              </button>
                            ) : (
                              <span className="text-xs text-[#737373]">-</span>
                            )}
                          </td>

                          {/* 심판명 + 모바일 보조 메타 */}
                          <td className="py-2 px-4">
                            <div className="flex flex-col">
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
                                  className={`text-sm font-medium text-left bg-transparent border-0 p-0 cursor-pointer hover:text-[#2563eb] hover:underline transition-colors duration-150 ${
                                    !isConfirmed
                                      ? "line-through text-[#737373]"
                                      : "text-[#171717]"
                                  }`}
                                >
                                  {judgeName || "-"}
                                </button>
                                {isHead && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[4px] bg-[#b45309]/[0.10] text-[#b45309] text-[11px] font-medium">
                                    위원장
                                  </span>
                                )}
                              </div>
                              <div className="lg:hidden text-xs text-[#737373] mt-0.5 truncate">
                                {judgePromoter || "소속 미기재"} ·{" "}
                                <span className="font-mono tabular-nums">
                                  {judgeTel || "-"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 소속 */}
                          <td className="py-2 px-4 text-sm text-[#525252] hidden lg:table-cell">
                            {judgePromoter || "-"}
                          </td>

                          {/* 연락처 */}
                          <td className="py-2 px-4 text-sm text-[#525252] font-mono tabular-nums hidden lg:table-cell">
                            {judgeTel || "-"}
                          </td>

                          {/* 균일 높이 전자서명 인감 프레임 */}
                          <td className="py-2 px-4 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setIsOpen({
                                  judge: true,
                                  title: "심판 상세 정보",
                                  info: filtered,
                                })
                              }
                              title="클릭하여 상세 및 서명 동기화 보기"
                              className={`w-[88px] h-[42px] mx-auto rounded-[6px] border inline-flex items-center justify-center overflow-hidden transition-colors duration-150 cursor-pointer ${
                                hasSignature(judgeSignature)
                                  ? "bg-[#fafafa] hover:bg-[#f4f4f5] border-[#171717]/[0.08]"
                                  : "bg-[#b45309]/[0.05] hover:bg-[#b45309]/[0.10] border-[#b45309]/20"
                              }`}
                            >
                              {hasSignature(judgeSignature) ? (
                                <CanvasWithImageData
                                  imageData={judgeSignature}
                                  style={{
                                    width: "76px",
                                    height: "38px",
                                    padding: "0",
                                  }}
                                />
                              ) : (
                                <span className="text-[11px] font-medium text-[#b45309]">
                                  미등록
                                </span>
                              )}
                            </button>
                          </td>

                          {/* 개인 인증번호 (클릭 즉시 복사) */}
                          <td className="py-2 px-4">
                            {onedayPassword ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyPassword(onedayPassword, rowKey)
                                }
                                title="클릭하여 인증번호 복사"
                                className="h-8 px-2.5 rounded-[6px] bg-[#f4f4f5] hover:bg-[#e4e4e7]/70 border border-[#171717]/[0.08] font-mono tabular-nums text-xs font-semibold text-[#171717] inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
                              >
                                <KeyRound
                                  size={12}
                                  strokeWidth={1.5}
                                  className="text-[#737373]"
                                />
                                <span>{onedayPassword}</span>
                                {copiedPwKey === rowKey ? (
                                  <Check
                                    size={12}
                                    strokeWidth={1.8}
                                    className="text-[#16a34a]"
                                  />
                                ) : (
                                  <Copy
                                    size={11}
                                    strokeWidth={1.5}
                                    className="text-[#737373] opacity-70"
                                  />
                                )}
                              </button>
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
                        className="py-14 text-center text-sm text-[#737373]"
                      >
                        조건에 일치하는 심판이 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContestJudgeTable;
