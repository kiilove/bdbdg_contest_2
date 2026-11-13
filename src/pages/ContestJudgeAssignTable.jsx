"use client";

import { useContext, useEffect, useState, useMemo } from "react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { doc, setDoc, where } from "firebase/firestore";
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateUUID } from "../functions/functions";
import { Checkbox, Tabs } from "antd";
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
} from "lucide-react";

// Child components
import SectionAssign from "../components/SectionAssign";
import CategoryAssign from "../components/CategoryAssign";
import GradeAssign from "../components/GradeAssign";
import { db } from "../firebase";
import {
  normalizeSectionName,
  normalizeJudgesAssignArray,
  analyzeJudgeAssignmentHealth,
} from "../utils/judgeAssignUtils";

const sanitizeForFirestore = (data) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) => (value === undefined ? null : value))
  );

const ContestJudgeAssignTable = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentSubTab, setCurrentSubTab] = useState("0");
  const [focusCategoryId, setFocusCategoryId] = useState(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});
  const [showAuditDetail, setShowAuditDetail] = useState(false);

  // 랜덤 배정 정확성 제어 옵션
  const [excludeHeadInRandom, setExcludeHeadInRandom] = useState(true);
  const [balanceWorkload, setBalanceWorkload] = useState(true);

  const [judgesAssignInfoRaw, setJudgesAssignInfoRaw] = useState({
    id: "",
    judges: [],
  });
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

      setJudgesPoolArray(judgesPool || []);
      setJudgesAssignInfoRaw(
        judgesAssign && judgesAssign.id
          ? judgesAssign
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

  const rawCleanedDiff = Math.max(
    0,
    (judgesAssignInfoRaw?.judges?.length || 0) -
      (judgesAssignInfoEnriched?.judges?.length || 0)
  );

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

  // 저장
  const handleUpdateJudgesAssign = async () => {
    try {
      setMessage({ body: "저장 중입니다...", isButton: false });
      setMsgOpen(true);

      const targetId =
        judgesAssignInfoEnriched?.id ||
        judgesAssignInfoRaw?.id ||
        currentContest?.contests?.contestJudgesAssignId;
      if (!targetId) {
        throw new Error("심판 배정 문서 ID를 확인할 수 없습니다.");
      }

      const payload = sanitizeForFirestore({
        ...judgesAssignInfoEnriched,
        id: targetId,
        contestId:
          judgesAssignInfoEnriched?.contestId ||
          currentContest?.contests?.id ||
          "",
        updatedAt: Date.now(),
      });

      const ref = doc(db, "contest_judges_assign", targetId);
      await setDoc(ref, payload, { merge: false });
      setJudgesAssignInfoRaw(payload);

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

      setMessage({
        body:
          warnings.length > 0
            ? `저장되었습니다. 확인 필요: ${warnings.join(" · ")}`
            : `심판 배정이 정확하게 검증·저장되었습니다 (${healthReport.totalAssignedSeats}/${healthReport.totalExpectedSeats}석 완료)`,
        isButton: true,
        confirmButtonText: "확인",
      });
    } catch (error) {
      console.error(error);
      setMessage({
        body: "저장 중 오류가 발생했습니다.",
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

  const tabItems = [
    {
      key: "0",
      label: (
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Layers size={16} strokeWidth={1.5} className="text-[#737373]" />
          <span>섹션별 배정</span>
        </span>
      ),
      children: (
        <SectionAssign
          judgesAssignInfo={judgesAssignInfoEnriched}
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
        />
      ),
    },
    {
      key: "1",
      label: (
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Trophy size={16} strokeWidth={1.5} className="text-[#737373]" />
          <span>종목별 배정</span>
        </span>
      ),
      children: (
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
        />
      ),
    },
    {
      key: "2",
      label: (
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal
            size={16}
            strokeWidth={1.5}
            className="text-[#737373]"
          />
          <span>체급별 배정</span>
        </span>
      ),
      children: (
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
        />
      ),
    },
  ];

  const hasIssues =
    healthReport.missingSeatsTotal > 0 ||
    healthReport.removedFromPoolJudges.length > 0 ||
    healthReport.duplicateJudgeGrades.length > 0;

  return (
    <div className="w-full space-y-4 pt-2">
      {isLoading ? (
        <LoadingPage />
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

          {/* 상단 컨트롤 및 배정 무결성 상태 바 */}
          <div className="bg-[#fafafa] border border-[#171717]/[0.08] rounded-[12px] p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#ffffff] border border-[#171717]/[0.08] text-[#525252]">
                  선발 심판 풀{" "}
                  <strong className="font-mono font-semibold tabular-nums text-[#171717]">
                    {judgesPoolArray.length}
                  </strong>
                  명
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] border font-medium tabular-nums ${
                    healthReport.isHealthy
                      ? "bg-[#16a34a]/[0.08] border-[#16a34a]/20 text-[#16a34a]"
                      : "bg-[#b45309]/[0.08] border-[#b45309]/25 text-[#b45309]"
                  }`}
                >
                  {healthReport.isHealthy ? (
                    <CheckCircle2 size={14} strokeWidth={1.75} />
                  ) : (
                    <AlertTriangle size={14} strokeWidth={1.75} />
                  )}
                  <span>
                    좌석 충족 {healthReport.totalAssignedSeats} /{" "}
                    {healthReport.totalExpectedSeats}석
                  </span>
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
                      className="ml-1 underline hover:opacity-80 cursor-pointer"
                    >
                      비우기
                    </button>
                  </span>
                )}

                {rawCleanedDiff > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-[6px] bg-[#2563eb]/[0.08] text-[#2563eb] font-medium tabular-nums">
                    삭제 체급/중복 {rawCleanedDiff}건 자동 정리 대기(저장 시 반영)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowAuditDetail((v) => !v)}
                  className="h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-xs font-medium text-[#171717] inline-flex items-center gap-1.5 transition-colors duration-150"
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
                  className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-sm font-medium text-white inline-flex items-center justify-center gap-2 transition-colors duration-150"
                >
                  <Save size={16} strokeWidth={1.5} />
                  <span>심판 배정 저장</span>
                </button>
              </div>
            </div>

            {/* 랜덤 배정 규칙 설정 */}
            <div className="pt-2.5 border-t border-[#171717]/[0.06] flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#525252]">
              <span className="font-medium text-[#171717]">랜덤 배정 기준</span>
              <Checkbox
                checked={excludeHeadInRandom}
                onChange={(e) => setExcludeHeadInRandom(e.target.checked)}
              >
                <span className="text-xs text-[#525252]">
                  위원장(isHead) 랜덤 배정 제외
                </span>
              </Checkbox>
              <Checkbox
                checked={balanceWorkload}
                onChange={(e) => setBalanceWorkload(e.target.checked)}
              >
                <span className="text-xs text-[#525252]">
                  심판별 배정 횟수 균등화 (저빈도 심판 우선 + 무작위 좌석 셔플)
                </span>
              </Checkbox>
            </div>

            {/* 상세 검증 패널 */}
            {(showAuditDetail || hasIssues) && (
              <div className="pt-3 border-t border-[#171717]/[0.08] space-y-3">
                {/* 미배정 체급 목록 */}
                {healthReport.missingGrades.length > 0 && (
                  <div className="bg-[#ffffff] border border-[#dc2626]/20 rounded-[8px] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#dc2626]">
                        미배정 좌석이 있는 체급 ({healthReport.missingGrades.length}
                        개)
                      </span>
                      <span className="text-[11px] text-[#737373]">
                        클릭하면 해당 체급 배정 화면으로 바로 이동합니다
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
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#dc2626]/[0.05] hover:bg-[#dc2626]/[0.10] border border-[#dc2626]/20 text-xs text-[#171717] transition-colors"
                          >
                            <span className="text-[#737373]">
                              [{mg.sectionName}]
                            </span>
                            <span className="font-medium">
                              {mg.categoryTitle} · {mg.gradeTitle}
                            </span>
                            <span className="font-mono text-[11px] text-[#dc2626] tabular-nums">
                              (좌석 {mg.missingSeats.join(",")} 미배정)
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 심판별 누적 배정 횟수 요약 */}
                {showAuditDetail && (
                  <div className="bg-[#ffffff] border border-[#171717]/[0.08] rounded-[8px] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#171717]">
                        선발 심판별 누적 배정 현황 ({healthReport.perJudgeStats.length}
                        명)
                      </span>
                      <span className="text-[11px] text-[#737373]">
                        이름순 · 종목 수 / 체급 수
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {healthReport.perJudgeStats.map((st) => {
                        const isZeroWarning = !st.isHead && st.gradeCount === 0;
                        return (
                          <div
                            key={st.judgeUid}
                            className={`px-2.5 py-2 rounded-[6px] border text-xs flex items-center justify-between gap-2 ${
                              isZeroWarning
                                ? "bg-[#b45309]/[0.06] border-[#b45309]/25"
                                : "bg-[#fafafa] border-[#171717]/[0.06]"
                            }`}
                          >
                            <div className="min-w-0 truncate">
                              <span className="font-medium text-[#171717]">
                                {st.judgeName}
                              </span>
                              {st.isHead && (
                                <span className="ml-1 text-[10px] font-medium text-[#b45309]">
                                  위원장
                                </span>
                              )}
                            </div>
                            <span
                              className={`font-mono tabular-nums shrink-0 ${
                                isZeroWarning
                                  ? "text-[#b45309] font-semibold"
                                  : "text-[#525252]"
                              }`}
                            >
                              {st.categoryCount}종목·{st.gradeCount}체급
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] p-4">
            <Tabs
              activeKey={currentSubTab}
              onChange={setCurrentSubTab}
              items={tabItems}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default ContestJudgeAssignTable;
