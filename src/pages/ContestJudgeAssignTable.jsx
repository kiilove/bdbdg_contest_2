"use client";

import React, { useContext, useEffect, useState, useMemo, useRef } from "react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { doc, runTransaction, where } from "firebase/firestore";
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateUUID } from "../functions/functions";
import { Checkbox } from "antd";
import {
  Save,
  Layers,
  Trophy,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  UserX,
  Crown,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";

import SectionAssign from "../components/SectionAssign";
import CategoryAssign from "../components/CategoryAssign";
import GradeAssign from "../components/GradeAssign";
import { db } from "../firebase";
import { sanitizeForFirestore } from "../utils/firestoreSanitize";
import {
  normalizeSectionName,
  normalizeJudgesAssignArray,
  analyzeJudgeAssignmentHealth,
  buildJudgeAssignRecord,
} from "../utils/judgeAssignUtils";

const getSeatSlotKey = (entry) =>
  `${entry?.contestGradeId || ""}__${Number(entry?.seatIndex) || 0}`;

const serializeSeatMap = (arr = []) =>
  (arr || [])
    .filter((r) => r?.contestGradeId && r?.seatIndex && r?.judgeUid)
    .map((r) => `${r.contestGradeId}__${Number(r.seatIndex)}:${r.judgeUid}`)
    .sort()
    .join("|");

const ContestJudgeAssignTable = ({ onGoPool }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentSubTab, setCurrentSubTab] = useState("0");
  const [focusCategoryId, setFocusCategoryId] = useState(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});
  const [showAuditDetail, setShowAuditDetail] = useState(false);
  const [baselineVersion, setBaselineVersion] = useState(0);

  // 랜덤 배정 정확성 제어 옵션
  const [excludeHeadInRandom, setExcludeHeadInRandom] = useState(true);
  const [balanceWorkload, setBalanceWorkload] = useState(true);

  const [judgesAssignInfoRaw, setJudgesAssignInfoRaw] = useState({
    id: "",
    judges: [],
  });
  const [savedRawJudges, setSavedRawJudges] = useState([]);
  const baselineJudgesRef = useRef([]);
  const [judgesPoolArray, setJudgesPoolArray] = useState([]);
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);

  const { currentContest } = useContext(CurrentContestContext);
  const fetchJudgesAssign = useFirestoreGetDocument("contest_judges_assign");
  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchJudgesPoolQuery = useFirestoreQuery();

  const fetchPool = async (contestId) => {
    try {
      const [judgesPool, judgesAssign, categories, grades] = await Promise.all([
        fetchJudgesPoolQuery.getDocuments("contest_judges_pool", [
          where("contestId", "==", contestId),
        ]),
        currentContest?.contests?.contestJudgesAssignId
          ? fetchJudgesAssign.getDocument(
              currentContest.contests.contestJudgesAssignId
            )
          : Promise.resolve(null),
        currentContest?.contests?.contestCategorysListId
          ? fetchCategories.getDocument(
              currentContest.contests.contestCategorysListId
            )
          : Promise.resolve(null),
        currentContest?.contests?.contestGradesListId
          ? fetchGrades.getDocument(
              currentContest.contests.contestGradesListId
            )
          : Promise.resolve(null),
      ]);

      const sortedCategories = [...(categories?.categorys || [])].sort(
        (a, b) =>
          Number(a?.contestCategoryIndex ?? 9999) -
          Number(b?.contestCategoryIndex ?? 9999)
      );
      const sortedGrades = [...(grades?.grades || [])].sort(
        (a, b) =>
          Number(a?.contestGradeIndex ?? 9999) -
          Number(b?.contestGradeIndex ?? 9999)
      );

      const rawDbJudges = Array.isArray(judgesAssign?.judges)
        ? judgesAssign.judges
        : [];
      const normalizedInitialJudges = normalizeJudgesAssignArray({
        judges: rawDbJudges,
        categories: sortedCategories,
        grades: sortedGrades,
        judgesPool: judgesPool || [],
        contestId,
        generateUUID,
      });
      baselineJudgesRef.current = normalizedInitialJudges;
      setBaselineVersion((v) => v + 1);

      setJudgesPoolArray(judgesPool || []);
      setSavedRawJudges(rawDbJudges);
      setJudgesAssignInfoRaw(
        judgesAssign && judgesAssign.id
          ? { ...judgesAssign, judges: normalizedInitialJudges }
          : {
              id: currentContest?.contests?.contestJudgesAssignId || "",
              contestId,
              judges: [],
            }
      );
      setCategoriesArray(sortedCategories);
      setGradesArray(sortedGrades);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // 섹션/종목/체급 필터 구조 (공백 정규화 적용)
  const filteredBySection = useMemo(() => {
    return (categoriesArray || []).reduce((acc, curr) => {
      const secName = normalizeSectionName(curr?.contestCategorySection);
      const section = acc.find((item) => item.sectionName === secName);
      const matchingGrades = (gradesArray || []).filter(
        (grade) => grade.refCategoryId === curr.contestCategoryId
      );

      if (!section) {
        acc.push({
          sectionName: secName,
          sectionCategory: [curr],
          sectionGrades: [...matchingGrades],
        });
      } else {
        section.sectionCategory.push(curr);
        section.sectionGrades.push(...matchingGrades);
      }

      return acc;
    }, []);
  }, [categoriesArray, gradesArray]);

  // 정규화 + 최신 메타데이터/비밀번호 동기화 버전 (표시 및 저장 공용)
  const judgesAssignInfoEnriched = useMemo(() => {
    const normalizedJudges = normalizeJudgesAssignArray({
      judges: judgesAssignInfoRaw?.judges || [],
      categories: categoriesArray,
      grades: gradesArray,
      judgesPool: judgesPoolArray,
      contestId: currentContest?.contests?.id || "",
      generateUUID,
    });

    return {
      ...(judgesAssignInfoRaw || {}),
      contestId:
        judgesAssignInfoRaw?.contestId || currentContest?.contests?.id || "",
      judges: normalizedJudges,
    };
  }, [
    judgesAssignInfoRaw,
    categoriesArray,
    gradesArray,
    judgesPoolArray,
    currentContest?.contests?.id,
  ]);

  // DB 원본 대비 삭제·재생성 체급 유령 레코드 건수 감지
  const orphanRowCount = useMemo(() => {
    if (!categoriesArray.length || !gradesArray.length) return 0;
    const validGradeIds = new Set(
      gradesArray.map((g) => g?.contestGradeId).filter(Boolean)
    );
    const validCatIds = new Set(
      categoriesArray.map((c) => c?.contestCategoryId).filter(Boolean)
    );
    return (savedRawJudges || []).filter((r) => {
      const gid = r?.contestGradeId || r?.gradeId;
      const cid = r?.categoryId || r?.refCategoryId;
      return !validGradeIds.has(gid) || (cid && !validCatIds.has(cid));
    }).length;
  }, [savedRawJudges, categoriesArray, gradesArray]);

  const rawCleanedDiff = Math.max(
    orphanRowCount,
    (judgesAssignInfoRaw?.judges?.length || 0) -
      (judgesAssignInfoEnriched?.judges?.length || 0)
  );

  // 상단 1클릭 복원용: 재생성 전 섹션 유령 좌석 탐지 (예: 그랑프리 1~7번석)
  const recoverableOrphanSections = useMemo(() => {
    if (!savedRawJudges.length || !filteredBySection.length) return [];

    const poolByUid = {};
    (judgesPoolArray || []).forEach((p) => {
      if (p?.judgeUid) poolByUid[p.judgeUid] = p;
    });
    const categoryById = {};
    (categoriesArray || []).forEach((c) => {
      if (c?.contestCategoryId) categoryById[c.contestCategoryId] = c;
    });

    const activeJudges = judgesAssignInfoEnriched?.judges || [];
    const results = [];

    filteredBySection.forEach((section) => {
      const sectionGrades = section.sectionGrades || [];
      if (sectionGrades.length === 0) return;

      const sectionGradeIds = new Set(
        sectionGrades.map((g) => g.contestGradeId).filter(Boolean)
      );
      const assignedInSection = activeJudges.filter(
        (r) => sectionGradeIds.has(r.contestGradeId) && Boolean(r.judgeUid)
      ).length;
      if (assignedInSection > 0) return;

      const judgeCounts = (section.sectionCategory || [])
        .map((c) => Number(c?.contestCategoryJudgeCount || 0))
        .filter((n) => n > 0);
      const maxSeats = judgeCounts.length > 0 ? Math.max(...judgeCounts) : 0;
      if (maxSeats <= 0) return;

      const orphanBySeat = new Map();
      savedRawJudges.forEach((r) => {
        const rSec = normalizeSectionName(r?.sectionName);
        const sNo = Number(r?.seatIndex);
        if (
          rSec === section.sectionName &&
          Number.isFinite(sNo) &&
          sNo >= 1 &&
          sNo <= maxSeats &&
          r?.judgeUid &&
          poolByUid[r.judgeUid] &&
          !sectionGradeIds.has(r.contestGradeId)
        ) {
          if (!orphanBySeat.has(sNo)) {
            orphanBySeat.set(sNo, poolByUid[r.judgeUid]);
          }
        }
      });

      if (orphanBySeat.size > 0) {
        const seats = Array.from(orphanBySeat.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([seatIndex, judge]) => ({ seatIndex, judge }));
        results.push({
          sectionName: section.sectionName,
          sectionGrades,
          categoryById,
          seats,
        });
      }
    });

    return results;
  }, [
    savedRawJudges,
    filteredBySection,
    judgesPoolArray,
    categoriesArray,
    judgesAssignInfoEnriched?.judges,
  ]);

  // 미저장 변경 여부 감지
  const hasUnsavedChanges = useMemo(() => {
    void baselineVersion;
    const baseSig = serializeSeatMap(baselineJudgesRef.current);
    const currSig = serializeSeatMap(judgesAssignInfoEnriched?.judges || []);
    return baseSig !== currSig || rawCleanedDiff > 0;
  }, [judgesAssignInfoEnriched?.judges, baselineVersion, rawCleanedDiff]);

  // 배정 정확성·무결성 실시간 분석
  const healthReport = useMemo(
    () =>
      analyzeJudgeAssignmentHealth({
        judges: judgesAssignInfoEnriched?.judges || [],
        categories: categoriesArray,
        grades: gradesArray,
        judgesPool: judgesPoolArray,
      }),
    [
      judgesAssignInfoEnriched?.judges,
      categoriesArray,
      gradesArray,
      judgesPoolArray,
    ]
  );

  // 드롭다운 및 카드에서 참조할 심판별 실시간 누적 배정 맵
  const workloadByUid = useMemo(() => {
    const map = {};
    (healthReport.perJudgeStats || []).forEach((st) => {
      if (st?.judgeUid) map[st.judgeUid] = st;
    });
    return map;
  }, [healthReport.perJudgeStats]);

  const maxGradeWorkload = useMemo(() => {
    const maxVal = Math.max(
      0,
      ...(healthReport.perJudgeStats || []).map((s) => s.gradeCount || 0)
    );
    return maxVal > 0 ? maxVal : 1;
  }, [healthReport.perJudgeStats]);

  // 자식용 함수형 상태 업데이터: 항상 최신 prev를 정규화하여 업데이트 (Stale closure 방지)
  const setJudgesAssignInfoFromChild = (updater) => {
    setJudgesAssignInfoRaw((prev) => {
      const normalizedPrev = {
        ...(prev || {}),
        judges: normalizeJudgesAssignArray({
          judges: prev?.judges || [],
          categories: categoriesArray,
          grades: gradesArray,
          judgesPool: judgesPoolArray,
          contestId: currentContest?.contests?.id || "",
          generateUUID,
        }),
      };
      const next =
        typeof updater === "function" ? updater(normalizedPrev) : updater;
      if (!next || !Array.isArray(next.judges)) {
        return { ...(next || {}), judges: [] };
      }
      return {
        ...next,
        judges: normalizeJudgesAssignArray({
          judges: next.judges,
          categories: categoriesArray,
          grades: gradesArray,
          judgesPool: judgesPoolArray,
          contestId: currentContest?.contests?.id || "",
          generateUUID,
        }),
      };
    });
  };

  // 선발 해제된 심판 좌석 일괄 비우기
  const handleClearRemovedPoolJudges = () => {
    const validPoolUids = new Set(
      (judgesPoolArray || []).map((p) => p.judgeUid).filter(Boolean)
    );
    setJudgesAssignInfoFromChild((prev) => ({
      ...(prev || {}),
      judges: (prev?.judges || []).filter((r) => validPoolUids.has(r.judgeUid)),
    }));
  };

  // 상단 배너에서 유령 섹션 배정 일괄 복원
  const handleRestoreAllOrphanSections = () => {
    const contestId = currentContest?.contests?.id;
    if (!contestId || !recoverableOrphanSections.length) return;

    setJudgesAssignInfoFromChild((prev) => {
      const targetGradeIds = new Set();
      recoverableOrphanSections.forEach((sec) => {
        (sec.sectionGrades || []).forEach((g) => {
          if (g?.contestGradeId) targetGradeIds.add(g.contestGradeId);
        });
      });

      const cleaned = (prev?.judges || []).filter(
        (r) => !targetGradeIds.has(r.contestGradeId)
      );
      const restored = [];

      recoverableOrphanSections.forEach((sec) => {
        sec.seats.forEach(({ seatIndex, judge }) => {
          (sec.sectionGrades || []).forEach((grade) => {
            if (!grade?.contestGradeId) return;
            const cat = sec.categoryById[grade.refCategoryId];
            if (!cat) return;
            const maxSeats = Number(cat.contestCategoryJudgeCount || 0);
            if (seatIndex > maxSeats) return;
            restored.push(
              buildJudgeAssignRecord({
                category: cat,
                grade,
                judge,
                seatIndex,
                contestId,
                generateUUID,
              })
            );
          });
        });
      });

      return {
        ...(prev || {}),
        judges: [...cleaned, ...restored],
      };
    });
  };

  // 저장
  const handleUpdateJudgesAssign = async () => {
    try {
      setMessage({
        variant: "loading",
        title: "심판 배정 저장 중",
        body: "배정 내역과 좌석 무결성을 검증하여 저장하고 있습니다.",
        isButton: false,
      });
      setMsgOpen(true);

      const targetId =
        judgesAssignInfoEnriched?.id ||
        judgesAssignInfoRaw?.id ||
        currentContest?.contests?.contestJudgesAssignId;
      if (!targetId) {
        throw new Error("심판 배정 문서 ID를 확인할 수 없습니다.");
      }

      const resolvedContestId =
        judgesAssignInfoEnriched?.contestId ||
        currentContest?.contests?.id ||
        "";
      const localJudges = judgesAssignInfoEnriched?.judges || [];
      const baselineJudges = baselineJudgesRef.current || [];

      const ref = doc(db, "contest_judges_assign", targetId);
      const savedPayload = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        const remoteJudgesRaw = snap.exists()
          ? Array.isArray(snap.data()?.judges)
            ? snap.data().judges
            : []
          : [];
        const remoteJudges = normalizeJudgesAssignArray({
          judges: remoteJudgesRaw,
          categories: categoriesArray,
          grades: gradesArray,
          judgesPool: judgesPoolArray,
          contestId: resolvedContestId,
          generateUUID,
        });

        const baselineMap = new Map(
          baselineJudges.map((j) => [getSeatSlotKey(j), j])
        );
        const localMap = new Map(
          localJudges.map((j) => [getSeatSlotKey(j), j])
        );
        const mergedMap = new Map(
          remoteJudges.map((j) => [getSeatSlotKey(j), j])
        );

        const allKeys = new Set([
          ...baselineMap.keys(),
          ...localMap.keys(),
          ...mergedMap.keys(),
        ]);

        allKeys.forEach((slotKey) => {
          if (!slotKey || slotKey === "__0") return;
          const baseEntry = baselineMap.get(slotKey);
          const localEntry = localMap.get(slotKey);
          const baseUid = baseEntry?.judgeUid || "";
          const localUid = localEntry?.judgeUid || "";
          if (localUid !== baseUid) {
            if (localEntry) {
              mergedMap.set(slotKey, localEntry);
            } else {
              mergedMap.delete(slotKey);
            }
          } else if (localEntry && !mergedMap.has(slotKey)) {
            mergedMap.set(slotKey, localEntry);
          }
        });

        const merged = normalizeJudgesAssignArray({
          judges: Array.from(mergedMap.values()),
          categories: categoriesArray,
          grades: gradesArray,
          judgesPool: judgesPoolArray,
          contestId: resolvedContestId,
          generateUUID,
        });

        const updatedAt = Date.now();
        if (snap.exists()) {
          transaction.update(
            ref,
            sanitizeForFirestore({
              judges: merged,
              contestId: resolvedContestId,
              updatedAt,
            })
          );
        } else {
          transaction.set(
            ref,
            sanitizeForFirestore({
              ...judgesAssignInfoEnriched,
              id: targetId,
              contestId: resolvedContestId,
              judges: merged,
              updatedAt,
            })
          );
        }

        return sanitizeForFirestore({
          ...(snap.exists() ? snap.data() : {}),
          ...judgesAssignInfoEnriched,
          id: targetId,
          contestId: resolvedContestId,
          judges: merged,
          updatedAt,
        });
      });

      baselineJudgesRef.current = savedPayload.judges || [];
      setBaselineVersion((v) => v + 1);
      setSavedRawJudges(savedPayload.judges || []);
      setJudgesAssignInfoRaw(savedPayload);

      const warnings = [];
      if (healthReport.missingSeatsTotal > 0) {
        warnings.push(
          `미배정 좌석 ${healthReport.missingSeatsTotal}석 (${healthReport.missingGrades.length}개 체급)`
        );
      }
      if (healthReport.removedFromPoolJudges.length > 0) {
        warnings.push(
          `선발 해제 심판 잔류 ${healthReport.removedFromPoolJudges.length}명`
        );
      }

      if (warnings.length > 0) {
        setMessage({
          variant: "warning",
          title: "심판 배정 저장 완료 (점검 필요)",
          body: "현재 배정 상태가 저장되었습니다.",
          body2: `확인 항목: ${warnings.join(" · ")}`,
          isButton: true,
          confirmButtonText: "확인",
        });
      } else {
        setMessage({
          variant: "success",
          title: "심판 배정 저장 완료",
          body: `모든 심판 좌석이 검증되어 저장되었습니다 (${healthReport.totalAssignedSeats}/${healthReport.totalExpectedSeats}석 완료).`,
          isButton: true,
          confirmButtonText: "확인",
        });
      }
    } catch (error) {
      console.error(error);
      setMessage({
        variant: "error",
        title: "심판 배정 저장 실패",
        body: "심판 배정 데이터를 저장하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(currentContest.contests.id);
    }
    setCurrentSubTab("0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests?.id]);

  const modeTabs = [
    {
      key: "0",
      label: "부(섹션) 일괄 배정",
      count: filteredBySection.length,
      icon: Layers,
    },
    {
      key: "1",
      label: "종목별 배정",
      count: categoriesArray.length,
      icon: Trophy,
    },
    {
      key: "2",
      label: "체급별 정밀 배정",
      count: gradesArray.length,
      icon: SlidersHorizontal,
    },
  ];

  const hasIssues =
    healthReport.missingSeatsTotal > 0 ||
    healthReport.removedFromPoolJudges.length > 0 ||
    healthReport.duplicateJudgeGrades.length > 0;

  const completionPct =
    healthReport.totalExpectedSeats > 0
      ? Math.min(
          100,
          Math.round(
            (healthReport.totalAssignedSeats / healthReport.totalExpectedSeats) *
              100
          )
        )
      : 0;

  return (
    <div className="w-full space-y-4">
      {isLoading ? (
        <div className="flex w-full min-h-[380px] justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <>
          <ConfirmationModal
            isOpen={msgOpen}
            message={message}
            onCancel={() => setMsgOpen(false)}
            onConfirm={() => {
              message?.onConfirm && message.onConfirm();
              setMsgOpen(false);
            }}
          />

          {/* 심판 선발 풀이 비어있을 때 명확한 안내 */}
          {judgesPoolArray.length === 0 && (
            <div className="bg-white rounded-[12px] border border-[#b45309]/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-sm text-[#b45309]">
                <AlertTriangle size={16} strokeWidth={1.6} className="shrink-0" />
                <span>
                  이번 대회에 선발된 심판이 아직 없습니다. 먼저 심판 선발 탭에서
                  대회 심판진을 선발해 주세요.
                </span>
              </div>
              {onGoPool && (
                <button
                  type="button"
                  onClick={onGoPool}
                  className="h-8 px-3 rounded-[8px] bg-[#171717] hover:bg-[#262626] text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer border-0 shrink-0"
                >
                  <ArrowLeft size={13} strokeWidth={1.6} />
                  <span>심판 선발로 이동</span>
                </button>
              )}
            </div>
          )}

          {/* 종목·체급 재생성으로 연결이 끊긴 유령 배정 감지 & 1클릭 복원 배너 */}
          {(recoverableOrphanSections.length > 0 || orphanRowCount > 0) && (
            <div className="bg-[#b45309]/[0.06] rounded-[12px] border border-[#b45309]/30 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#171717]">
                <AlertTriangle
                  size={16}
                  strokeWidth={1.75}
                  className="text-[#b45309] shrink-0 mt-0.5"
                />
                <div className="space-y-1">
                  <div className="font-semibold text-[#92400e]">
                    {recoverableOrphanSections.length > 0
                      ? `이전 삭제 체급 유령 배정 ${orphanRowCount}건 감지 (${recoverableOrphanSections
                          .map(
                            (s) =>
                              `${s.sectionName} ${s.seats.length}석`
                          )
                          .join(", ")})`
                      : `이전 삭제 체급 유령 배정 ${orphanRowCount}건 정리 대기 중`}
                  </div>
                  <div className="text-xs text-[#525252]">
                    {recoverableOrphanSections.length > 0
                      ? recoverableOrphanSections
                          .map(
                            (s) =>
                              `[${s.sectionName}] ${s.seats
                                .map((st) => `${st.seatIndex}번 ${st.judge.judgeName}`)
                                .join(" · ")}`
                          )
                          .join(" / ") +
                        " — 복원 버튼을 누른 뒤 [심판 배정 저장]을 눌러 현재 체급에 확정해 주세요."
                      : "현재 체급으로의 복원이 준비되었습니다. 우측 [심판 배정 저장] 버튼을 눌러 DB 유령 레코드를 최종 정리해 주세요."}
                  </div>
                </div>
              </div>

              {recoverableOrphanSections.length > 0 && (
                <button
                  type="button"
                  onClick={handleRestoreAllOrphanSections}
                  className="h-9 px-3.5 rounded-[8px] bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer border-0 shrink-0"
                >
                  <RotateCcw size={14} strokeWidth={1.7} />
                  <span>이전 배정 현재 체급에 복원</span>
                </button>
              )}
            </div>
          )}

          {/* 상단 고정 배정 모드 · 무결성 · 저장 콘솔 */}
          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border border-[#171717]/[0.10] rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 space-y-3">
            {/* Row 1: 배정 단위 세그먼트 스위처 + 검증/저장 버튼 */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 bg-[#f4f4f5] p-1 rounded-[8px] overflow-x-auto no-scrollbar">
                {modeTabs.map((tab) => {
                  const IconComp = tab.icon;
                  const isActive = currentSubTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setCurrentSubTab(tab.key)}
                      className={`h-8 px-3.5 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors duration-150 cursor-pointer border-0 ${
                        isActive
                          ? "bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                          : "bg-transparent text-[#525252] hover:text-[#171717]"
                      }`}
                    >
                      <IconComp
                        size={14}
                        strokeWidth={1.6}
                        className={isActive ? "text-[#2563eb]" : "text-[#737373]"}
                      />
                      <span>{tab.label}</span>
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

              <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                {hasUnsavedChanges ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#b45309]/[0.08] border border-[#b45309]/25 text-xs font-medium text-[#b45309]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#b45309]" />
                    <span>변경사항 미저장</span>
                  </span>
                ) : (
                  <span className="text-xs text-[#737373] px-1">
                    저장본과 일치
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setShowAuditDetail((v) => !v)}
                  className="h-9 px-3 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-xs font-medium text-[#171717] inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
                >
                  <span>심판별 횟수 · 누락 검증</span>
                  {showAuditDetail ? (
                    <ChevronUp size={14} strokeWidth={1.5} />
                  ) : (
                    <ChevronDown size={14} strokeWidth={1.5} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleUpdateJudgesAssign}
                  className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-xs font-medium text-white inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer border-0"
                >
                  <Save size={15} strokeWidth={1.6} />
                  <span>심판 배정 저장</span>
                </button>
              </div>
            </div>

            {/* Row 2: 좌석 점유율 게이지 + 상태 칩 + 랜덤 배정 기준 */}
            <div className="pt-2.5 border-t border-[#171717]/[0.06] flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <div
                  className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-[6px] border font-medium tabular-nums ${
                    healthReport.isHealthy
                      ? "bg-[#16a34a]/[0.08] border-[#16a34a]/20 text-[#16a34a]"
                      : "bg-[#fafafa] border-[#171717]/[0.10] text-[#171717]"
                  }`}
                >
                  {healthReport.isHealthy ? (
                    <CheckCircle2 size={14} strokeWidth={1.75} />
                  ) : (
                    <div className="w-16 h-1.5 rounded-full bg-[#e4e4e7] overflow-hidden">
                      <div
                        className="h-full bg-[#2563eb]"
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>
                  )}
                  <span className="font-mono">
                    좌석 충족 {healthReport.totalAssignedSeats}/
                    {healthReport.totalExpectedSeats}석 ({completionPct}%)
                  </span>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#fafafa] border border-[#171717]/[0.08] text-[#525252]">
                  <span>선발 풀</span>
                  <strong className="font-mono font-semibold tabular-nums text-[#171717]">
                    {judgesPoolArray.length}명
                  </strong>
                </span>

                {healthReport.missingSeatsTotal > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#dc2626]/[0.08] border border-[#dc2626]/20 text-[#dc2626] font-medium tabular-nums">
                    미배정 {healthReport.missingSeatsTotal}석 (
                    {healthReport.missingGrades.length}개 체급)
                  </span>
                )}

                {healthReport.unassignedActiveJudges.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#b45309]/[0.08] border border-[#b45309]/20 text-[#b45309] font-medium tabular-nums">
                    0회 배정 심판 {healthReport.unassignedActiveJudges.length}명
                  </span>
                )}

                {healthReport.removedFromPoolJudges.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#dc2626]/[0.08] border border-[#dc2626]/25 text-[#dc2626] font-medium tabular-nums">
                    <UserX size={13} strokeWidth={1.75} />
                    <span>
                      선발 해제 심판 {healthReport.removedFromPoolJudges.length}명
                      잔류
                    </span>
                    <button
                      type="button"
                      onClick={handleClearRemovedPoolJudges}
                      className="ml-1 underline hover:opacity-80 cursor-pointer bg-transparent border-0 p-0 text-xs text-[#dc2626] font-semibold"
                    >
                      일괄 비우기
                    </button>
                  </span>
                )}

                {rawCleanedDiff > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-[6px] bg-[#2563eb]/[0.08] text-[#2563eb] font-medium tabular-nums">
                    삭제 체급·중복 {rawCleanedDiff}건 정리 대기
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#525252]">
                <span className="font-medium text-[#171717]">랜덤 기준</span>
                <Checkbox
                  checked={excludeHeadInRandom}
                  onChange={(e) => setExcludeHeadInRandom(e.target.checked)}
                >
                  <span className="text-xs text-[#525252]">
                    위원장 자동 제외
                  </span>
                </Checkbox>
                <Checkbox
                  checked={balanceWorkload}
                  onChange={(e) => setBalanceWorkload(e.target.checked)}
                >
                  <span className="text-xs text-[#525252]">
                    심판별 횟수 균등화
                  </span>
                </Checkbox>
              </div>
            </div>

            {/* 상세 검증 및 심판별 배정 분포 패널 */}
            {(showAuditDetail || hasIssues) && (
              <div className="pt-3 border-t border-[#171717]/[0.08] space-y-3 max-h-[320px] overflow-y-auto">
                {healthReport.missingGrades.length > 0 && (
                  <div className="bg-[#fafafa] border border-[#dc2626]/20 rounded-[8px] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[#dc2626]">
                        미배정 좌석이 있는 체급 ({healthReport.missingGrades.length}
                        개)
                      </span>
                      <span className="text-[11px] text-[#737373]">
                        클릭하면 해당 종목의 체급별 정밀 배정으로 바로 이동합니다
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {healthReport.missingGrades.map((mg) => {
                        const gradeObj = gradesArray.find(
                          (g) => g.contestGradeId === mg.contestGradeId
                        );
                        return (
                          <button
                            key={mg.contestGradeId}
                            type="button"
                            onClick={() => {
                              if (gradeObj?.refCategoryId) {
                                setFocusCategoryId(gradeObj.refCategoryId);
                              }
                              setCurrentSubTab("2");
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-white hover:bg-[#dc2626]/[0.06] border border-[#dc2626]/20 text-xs text-[#171717] transition-colors duration-150 cursor-pointer"
                          >
                            <span className="text-[#737373]">
                              [{mg.sectionName}]
                            </span>
                            <span className="font-medium">
                              {mg.categoryTitle} · {mg.gradeTitle}
                            </span>
                            <span className="font-mono text-[11px] text-[#dc2626] tabular-nums">
                              ({mg.missingSeats.join(",")}번석)
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {showAuditDetail && (
                  <div className="bg-[#fafafa] border border-[#171717]/[0.08] rounded-[8px] p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#171717]">
                        선발 심판별 누적 배정 분포 ({healthReport.perJudgeStats.length}
                        명)
                      </span>
                      <span className="text-[11px] text-[#737373] font-mono tabular-nums">
                        이름순 · 종목 / 체급 수
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
                      {healthReport.perJudgeStats.map((st) => {
                        const isZeroWarning = !st.isHead && st.gradeCount === 0;
                        const barPct = Math.round(
                          ((st.gradeCount || 0) / maxGradeWorkload) * 100
                        );
                        return (
                          <div
                            key={st.judgeUid}
                            className={`px-2.5 py-2 rounded-[6px] border text-xs flex flex-col gap-1.5 ${
                              isZeroWarning
                                ? "bg-[#b45309]/[0.05] border-[#b45309]/25"
                                : "bg-white border-[#171717]/[0.08]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="min-w-0 flex items-center gap-1 truncate">
                                <span className="font-medium text-[#171717] truncate">
                                  {st.judgeName}
                                </span>
                                {st.isHead && (
                                  <Crown
                                    size={11}
                                    strokeWidth={1.6}
                                    className="text-[#b45309] shrink-0"
                                  />
                                )}
                              </div>
                              <span
                                className={`font-mono text-[11px] tabular-nums shrink-0 ${
                                  isZeroWarning
                                    ? "text-[#b45309] font-semibold"
                                    : "text-[#525252]"
                                }`}
                              >
                                {st.categoryCount}종목·{st.gradeCount}체급
                              </span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-[#e4e4e7] overflow-hidden">
                              <div
                                className={`h-full ${
                                  st.isHead ? "bg-[#737373]" : "bg-[#2563eb]"
                                }`}
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 배정 본문 뷰 (중첩 외곽 박스 없이 깔끔한 카드 스택) */}
          {currentSubTab === "0" && (
            <SectionAssign
              judgesAssignInfo={judgesAssignInfoEnriched}
              rawJudges={savedRawJudges}
              judgesPoolArray={judgesPoolArray}
              categoriesArray={categoriesArray}
              filteredBySection={filteredBySection}
              setJudgesAssignInfo={setJudgesAssignInfoFromChild}
              currentContest={currentContest}
              generateUUID={generateUUID}
              setMessage={setMessage}
              setMsgOpen={setMsgOpen}
              excludeHeadInRandom={excludeHeadInRandom}
              balanceWorkload={balanceWorkload}
              workloadByUid={workloadByUid}
            />
          )}

          {currentSubTab === "1" && (
            <CategoryAssign
              judgesAssignInfo={judgesAssignInfoEnriched}
              judgesPoolArray={judgesPoolArray}
              setJudgesAssignInfo={setJudgesAssignInfoFromChild}
              categoriesArray={categoriesArray}
              gradesArray={gradesArray}
              currentContest={currentContest}
              generateUUID={generateUUID}
              setMessage={setMessage}
              setMsgOpen={setMsgOpen}
              excludeHeadInRandom={excludeHeadInRandom}
              balanceWorkload={balanceWorkload}
              workloadByUid={workloadByUid}
            />
          )}

          {currentSubTab === "2" && (
            <GradeAssign
              judgesAssignInfo={judgesAssignInfoEnriched}
              judgesPoolArray={judgesPoolArray}
              setJudgesAssignInfo={setJudgesAssignInfoFromChild}
              categoriesArray={categoriesArray}
              gradesArray={gradesArray}
              currentContest={currentContest}
              generateUUID={generateUUID}
              setMessage={setMessage}
              setMsgOpen={setMsgOpen}
              excludeHeadInRandom={excludeHeadInRandom}
              balanceWorkload={balanceWorkload}
              focusCategoryId={focusCategoryId}
              onClearFocusCategory={() => setFocusCategoryId(null)}
              workloadByUid={workloadByUid}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ContestJudgeAssignTable;
