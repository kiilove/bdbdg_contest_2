import React, { useContext, useEffect, useState } from "react";
import { Drawer, Spin } from "antd";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  X,
} from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";

const COMPANION_SPECS = [
  {
    key: "contestPasswordId",
    collectionName: "contest_passwords",
    label: "심판 비밀번호 풀",
    description: "심판 채점용 고유 4자리 비밀번호 100개 풀",
    required: true,
    generateData: (contestId) => {
      const passwords = [];
      const used = new Set();
      while (passwords.length < 100) {
        const pwd = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
        if (!used.has(pwd)) {
          passwords.push(pwd);
          used.add(pwd);
        }
      }
      return {
        contestId,
        passwords: passwords.map((p, idx) => ({
          id: idx,
          value: p,
          used: false,
        })),
      };
    },
    getInfo: (data) =>
      data?.passwords?.length
        ? `${data.passwords.length}개 비밀번호 준비됨`
        : "비밀번호 없음",
    isValid: (data) => Boolean(data?.passwords && data.passwords.length > 0),
  },
  {
    key: "contestPlayersAssignId",
    collectionName: "contest_players_assign",
    label: "선수 번호 배정 (1단계)",
    description: "등번호 배정 및 신청서 매칭 명단 저장소",
    required: true,
    generateData: (contestId) => ({
      contestId,
      players: [],
    }),
    getInfo: (data) =>
      data?.players ? `선수 ${data.players.length}명 배정됨` : "데이터 없음",
    isValid: (data) => data !== null && typeof data === "object",
  },
  {
    key: "contestPlayersFinalId",
    collectionName: "contest_players_final",
    label: "계측 최종 명단 (2단계)",
    description: "계측 완료 및 최종 무대 명단 저장소",
    required: true,
    generateData: (contestId) => ({
      contestId,
      players: [],
    }),
    getInfo: (data) =>
      data?.players ? `선수 ${data.players.length}명 등록됨` : "데이터 없음",
    isValid: (data) => data !== null && typeof data === "object",
  },
  {
    key: "contestStagesAssignId",
    collectionName: "contest_stages_assign",
    label: "무대 순서 배정",
    description: "경기 무대 진행 순서 및 체급 배정 저장소",
    required: true,
    generateData: (contestId, info) => ({
      contestId,
      collectionName:
        info?.contestCollectionName ||
        info?.contestTitle ||
        `contest_${contestId.slice(0, 6)}`,
      stages: [],
    }),
    getInfo: (data) =>
      data?.stages ? `무대 ${data.stages.length}개 설정됨` : "데이터 없음",
    isValid: (data) => data !== null && typeof data === "object",
  },
  {
    key: "contestJudgesAssignId",
    collectionName: "contest_judges_assign",
    label: "심판 배정 목록",
    description: "대회 투입 심판 목록 및 심판석 배정 저장소",
    required: true,
    generateData: (contestId) => ({
      contestId,
      judges: [],
    }),
    getInfo: (data) =>
      data?.judges ? `심판 ${data.judges.length}명 배정됨` : "데이터 없음",
    isValid: (data) => data !== null && typeof data === "object",
  },
  {
    key: "contestComparesListId",
    collectionName: "contest_compares_list",
    label: "비교 심사 목록",
    description: "체급별 비교 심사(Callout) 설정 데이터",
    required: true,
    generateData: (contestId) => ({
      contestId,
      compares: [],
    }),
    getInfo: (data) =>
      data?.compares ? `비교심사 ${data.compares.length}건 설정됨` : "데이터 없음",
    isValid: (data) => data !== null && typeof data === "object",
  },
  {
    key: "contestCategorysListId",
    collectionName: "contest_categorys_list",
    label: "종목 카테고리 목록",
    description: "보디빌딩, 피지크 등 대회 종목 목록",
    required: true,
    generateData: (contestId) => ({
      contestId,
      categorys: [],
    }),
    getInfo: (data) =>
      data?.categorys ? `종목 ${data.categorys.length}개 등록됨` : "데이터 없음",
    isValid: (data) => data !== null && typeof data === "object",
  },
  {
    key: "contestGradesListId",
    collectionName: "contest_grades_list",
    label: "체급(그레이드) 목록",
    description: "종목별 세부 체급(-65kg, +175cm 등) 목록",
    required: true,
    generateData: (contestId) => ({
      contestId,
      grades: [],
    }),
    getInfo: (data) =>
      data?.grades ? `체급 ${data.grades.length}개 등록됨` : "데이터 없음",
    isValid: (data) => data !== null && typeof data === "object",
  },
];

const ContestHealthCheckModal = ({ isOpen, onClose }) => {
  const { currentContest, setCurrentContest } = useContext(CurrentContestContext);
  const [checking, setChecking] = useState(false);
  const [healing, setHealing] = useState(false);
  const [healthResults, setHealthResults] = useState([]);
  const [entryCount, setEntryCount] = useState(0);
  const [collectionNameVal, setCollectionNameVal] = useState("");
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});

  const openNotice = (nextMsg) => {
    setModalMessage(nextMsg);
    setMsgOpen(true);
  };

  const contestId = currentContest?.contests?.id;
  const contestInfo = currentContest?.contestInfo;
  const contestDoc = currentContest?.contests;

  // 🩺 대회 무결성 진단 실행
  const runHealthCheck = async () => {
    if (!contestId) return;
    setChecking(true);

    try {
      // 1. 신청서 수량 확인
      try {
        const entrySnap = await getDocs(
          query(collection(db, "contest_entrys_list"), where("contestId", "==", contestId))
        );
        setEntryCount(entrySnap.size);
      } catch (err) {
        console.warn("신청서 확인 실패:", err);
      }

      // 2. 최신 contest 문서 조회
      const freshContestSnap = await getDoc(doc(db, "contests", contestId));
      const freshContest = freshContestSnap.exists()
        ? freshContestSnap.data()
        : contestDoc || {};

      setCollectionNameVal(freshContest?.collectionName || "");

      // 3. 각 컴패니언 문서 상태 진단
      const results = await Promise.all(
        COMPANION_SPECS.map(async (spec) => {
          const docId = freshContest?.[spec.key];
          let status = "missing"; // "ok" | "missing" | "invalid"
          let details = "문서 ID 미연결";
          let actualDocId = docId || null;

          if (docId) {
            try {
              const docSnap = await getDoc(doc(db, spec.collectionName, docId));
              if (docSnap.exists()) {
                const data = docSnap.data();
                if (spec.isValid(data)) {
                  status = "ok";
                  details = spec.getInfo(data);
                } else {
                  status = "invalid";
                  details = "문서 데이터 구조 불완전 (" + spec.getInfo(data) + ")";
                }
              } else {
                status = "missing";
                details = "연결된 문서 ID가 Firestore에 존재하지 않음";
              }
            } catch (e) {
              status = "missing";
              details = "문서 조회 실패: " + e.message;
            }
          }

          // 만약 contest 문서에 ID가 없지만, Firestore에 contestId로 이미 만들어진 문서가 있는지 탐색
          if (status !== "ok") {
            try {
              const orphanQuery = await getDocs(
                query(
                  collection(db, spec.collectionName),
                  where("contestId", "==", contestId)
                )
              );
              if (!orphanQuery.empty) {
                const orphanDoc = orphanQuery.docs[0];
                const orphanData = orphanDoc.data();
                if (spec.isValid(orphanData)) {
                  status = "found_unlinked";
                  actualDocId = orphanDoc.id;
                  details = `기존 문서 발견됨(ID: ${orphanDoc.id}) - 재연결 필요`;
                }
              }
            } catch (e) {
              // Ignore
            }
          }

          return {
            ...spec,
            docId: actualDocId,
            status,
            details,
          };
        })
      );

      setHealthResults(results);
    } catch (error) {
      console.error("진단 중 오류:", error);
      openNotice({
        variant: "error",
        title: "구조 진단 실패",
        body: "대회 데이터 구조를 진단하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    } finally {
      setChecking(false);
    }
  };

  // 누락 문서 자동 생성 및 원클릭 복구 실행
  const handleAutoHeal = async () => {
    if (!contestId) {
      openNotice({
        variant: "warning",
        title: "대회 선택 필요",
        body: "선택된 대회 정보가 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      return;
    }

    setHealing(true);
    try {
      // 1. 최신 contest 문서 가져오기
      const contestRef = doc(db, "contests", contestId);
      const contestSnap = await getDoc(contestRef);
      const currentData = contestSnap.exists() ? contestSnap.data() : contestDoc || {};

      const updatesToContest = {};
      let createdCount = 0;
      let linkedCount = 0;

      for (const spec of COMPANION_SPECS) {
        const existingId = currentData[spec.key];
        let needsNew = false;
        let validDocId = null;

        if (existingId) {
          const checkSnap = await getDoc(doc(db, spec.collectionName, existingId));
          if (checkSnap.exists()) {
            const data = checkSnap.data();
            if (spec.isValid(data)) {
              validDocId = existingId;
            } else if (spec.key === "contestPasswordId" && (!data.passwords || data.passwords.length === 0)) {
              // 비밀번호만 비어있는 경우 채워넣기
              const newPass = spec.generateData(contestId);
              await updateDoc(doc(db, spec.collectionName, existingId), newPass);
              validDocId = existingId;
              linkedCount++;
            } else {
              validDocId = existingId;
            }
          } else {
            needsNew = true;
          }
        } else {
          needsNew = true;
        }

        // Firestore에 이미 존재하는 문서가 있는지 검색
        if (needsNew) {
          const orphanQuery = await getDocs(
            query(collection(db, spec.collectionName), where("contestId", "==", contestId))
          );
          if (!orphanQuery.empty) {
            validDocId = orphanQuery.docs[0].id;
            linkedCount++;
          } else {
            // 새로 생성
            const initialData = spec.generateData(contestId, contestInfo);
            const addedRef = await addDoc(collection(db, spec.collectionName), initialData);
            validDocId = addedRef.id;
            createdCount++;
          }
        }

        if (validDocId && currentData[spec.key] !== validDocId) {
          updatesToContest[spec.key] = validDocId;
        }
      }

      // collectionName이 비어있다면 자동 부여
      if (!currentData.collectionName) {
        const safeName = (contestInfo?.contestTitle || "대회")
          .replace(/[^a-zA-Z0-9가-힣]/g, "")
          .slice(0, 20);
        updatesToContest.collectionName = safeName;
      }

      // contests 문서 업데이트
      if (Object.keys(updatesToContest).length > 0) {
        await updateDoc(contestRef, updatesToContest);
      }

      // 최신 contest 데이터 조회 후 Context + sessionStorage 실시간 갱신!
      const updatedSnap = await getDoc(contestRef);
      const updatedContestData = { id: contestId, ...updatedSnap.data() };

      setCurrentContest({
        ...currentContest,
        contests: updatedContestData,
      });

      openNotice({
        variant: "success",
        title: "대회 구조 복구 완료",
        body: `누락 문서 복구가 완료되었습니다 (신규 생성 ${createdCount}건 · 재연결 ${linkedCount}건).`,
        isButton: true,
        confirmButtonText: "확인",
      });

      // 진단 재실행
      await runHealthCheck();
    } catch (error) {
      console.error("자동 복구 실패:", error);
      openNotice({
        variant: "error",
        title: "구조 복구 실패",
        body: "자동 복구 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    } finally {
      setHealing(false);
    }
  };

  useEffect(() => {
    if (isOpen && contestId) {
      runHealthCheck();
    }
  }, [isOpen, contestId]);

  const okCount = healthResults.filter((r) => r.status === "ok").length;
  const totalCount = COMPANION_SPECS.length;
  const isAllHealthy = okCount === totalCount;
  const percent = Math.round((okCount / totalCount) * 100);

  return (
    <>
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />
      <Drawer
        placement="right"
        width={680}
        open={isOpen}
        onClose={onClose}
        closable={false}
        destroyOnClose
        styles={{
          body: {
            padding: 0,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          },
          header: { display: "none" },
        }}
      >
        <div className="h-full flex flex-col bg-white text-[#171717]">
          {/* 상단 고정 헤더 */}
          <div className="px-5 py-4 bg-[#fafafa] border-b border-[#171717]/[0.08] flex items-center justify-between gap-3 shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-2.5 text-[#171717]">
              <div className="w-8 h-8 rounded-[8px] bg-white border border-[#171717]/[0.08] flex items-center justify-center shrink-0">
                <ShieldCheck
                  size={16}
                  strokeWidth={1.5}
                  className="text-[#525252]"
                />
              </div>
              <span className="text-base font-semibold">
                대회 데이터 구조 무결성 점검 및 복구
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="w-8 h-8 rounded-[8px] inline-flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#e4e4e7]/70 transition-colors duration-150 cursor-pointer shrink-0"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* 스크롤 본문 */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-[#171717]">
            {/* 상단 대회 요약 카드 */}
            <div className="bg-[#f4f4f5] rounded-[8px] border border-[#171717]/[0.08] p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="text-[11px] text-[#737373] font-medium">
                  선택된 대회
                </div>
                <div className="text-sm font-semibold text-[#171717] mt-0.5">
                  {contestInfo?.contestTitle || "대회명 미설정"}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#525252] mt-1 flex-wrap">
                  <span>
                    Contest ID:{" "}
                    <code className="bg-[#ffffff] border border-[#171717]/[0.08] px-1.5 py-0.5 rounded-[4px] font-mono text-[11px]">
                      {contestId || "없음"}
                    </code>
                  </span>
                  <span className="text-[#171717]/[0.2]">·</span>
                  <span>
                    컬렉션명:{" "}
                    <code className="bg-[#ffffff] border border-[#171717]/[0.08] px-1.5 py-0.5 rounded-[4px] font-mono text-[11px]">
                      {collectionNameVal || "미설정"}
                    </code>
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-[4px] bg-[#ffffff] border border-[#171717]/[0.08] text-xs font-medium text-[#171717] font-mono tabular-nums">
                접수 신청서 {entryCount}건
              </span>
            </div>

            {/* 상태 요약 배너 */}
            {checking ? (
              <div className="py-10 text-center">
                <Spin tip="대회 구조 및 문서를 진단하는 중입니다..." />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 p-3.5 rounded-[8px] border border-[#171717]/[0.08] bg-[#ffffff]">
                  <div className="flex items-center gap-3">
                    {isAllHealthy ? (
                      <CheckCircle2
                        size={20}
                        strokeWidth={1.5}
                        className="text-[#16a34a] shrink-0"
                      />
                    ) : (
                      <AlertCircle
                        size={20}
                        strokeWidth={1.5}
                        className="text-[#b45309] shrink-0"
                      />
                    )}
                    <div>
                      <div className="font-semibold text-[#171717] text-sm">
                        {isAllHealthy
                          ? "대회 필수 데이터 구조가 모두 정상 연결되어 있습니다."
                          : `${
                              totalCount - okCount
                            }개의 필수 문서 또는 연결이 누락되었습니다.`}
                      </div>
                      <div className="text-xs text-[#737373] mt-0.5">
                        {isAllHealthy
                          ? "심판 배정, 계측명단, 무대 순서 등 모든 기능이 정상 작동합니다."
                          : "누락 문서 자동 생성 및 연결 버튼을 선택하면 즉시 복구됩니다."}
                      </div>
                    </div>
                  </div>
                  <div className="text-right min-w-[120px]">
                    <div className="flex items-center justify-end gap-1.5 text-xs font-mono tabular-nums text-[#171717] font-medium mb-1">
                      <span>{percent}%</span>
                      <span className="text-[#737373]">
                        ({okCount}/{totalCount})
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#f4f4f5] rounded-[4px] overflow-hidden">
                      <div
                        className={`h-1.5 rounded-[4px] transition-all duration-300 ${
                          isAllHealthy ? "bg-[#16a34a]" : "bg-[#b45309]"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 컴패니언 문서 진단 리스트 */}
                <div className="border border-[#171717]/[0.08] rounded-[8px] divide-y divide-[#171717]/[0.06] bg-[#ffffff] overflow-hidden">
                  {healthResults.map((item) => {
                    const isOk = item.status === "ok";
                    const isUnlinked = item.status === "found_unlinked";

                    return (
                      <div
                        key={item.key}
                        className={`p-3.5 flex items-center justify-between gap-3 transition-colors duration-150 ${
                          isOk
                            ? "hover:bg-[#fafafa]"
                            : "bg-[#dc2626]/[0.03] hover:bg-[#dc2626]/[0.05]"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 shrink-0">
                            {isOk && (
                              <CheckCircle2
                                size={16}
                                strokeWidth={1.5}
                                className="text-[#16a34a]"
                              />
                            )}
                            {isUnlinked && (
                              <RefreshCw
                                size={16}
                                strokeWidth={1.5}
                                className="text-[#2563eb]"
                              />
                            )}
                            {!isOk && !isUnlinked && (
                              <XCircle
                                size={16}
                                strokeWidth={1.5}
                                className="text-[#dc2626]"
                              />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-[#171717]">
                                {item.label}
                              </span>
                              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[11px] font-mono text-[#525252]">
                                {item.collectionName}
                              </span>
                            </div>
                            <div className="text-xs text-[#737373] mt-0.5">
                              {item.description}
                            </div>
                            <div className="text-[11px] text-[#525252] mt-1 flex items-center gap-1 font-mono">
                              <span>문서 ID:</span>
                              {item.docId ? (
                                <code className="text-[#171717] bg-[#f4f4f5] px-1.5 py-0.2 rounded-[4px]">
                                  {item.docId}
                                </code>
                              ) : (
                                <span className="text-[#dc2626] font-medium">
                                  미생성
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {isOk && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#16a34a]/[0.10] text-[#16a34a] border border-[#16a34a]/20 text-[11px] font-medium">
                              정상 연결
                            </span>
                          )}
                          {isUnlinked && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#2563eb]/[0.10] text-[#2563eb] border border-[#2563eb]/20 text-[11px] font-medium">
                              재연결 가능
                            </span>
                          )}
                          {!isOk && !isUnlinked && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#dc2626]/[0.10] text-[#dc2626] border border-[#dc2626]/20 text-[11px] font-medium">
                              누락됨
                            </span>
                          )}
                          <div className="text-[11px] text-[#525252] mt-1 tabular-nums">
                            {item.details}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 하단 고정 액션 바 */}
          <div className="px-5 py-3.5 bg-[#fafafa] border-t border-[#171717]/[0.08] flex items-center justify-end gap-2 shrink-0 sticky bottom-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={runHealthCheck}
              disabled={checking}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                strokeWidth={1.5}
                className={`text-[#525252] ${checking ? "animate-spin" : ""}`}
              />
              <span>다시 진단</span>
            </button>
            <button
              type="button"
              onClick={handleAutoHeal}
              disabled={healing}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors duration-150 cursor-pointer border-0 disabled:opacity-50"
            >
              <Zap size={14} strokeWidth={1.5} />
              <span>
                {healing
                  ? "복구 진행 중..."
                  : isAllHealthy
                  ? "구조 재검증 및 동기화"
                  : "누락 문서 자동 생성 및 연결"}
              </span>
            </button>
          </div>
        </div>
      </Drawer>
    </>
  );
};

export default ContestHealthCheckModal;
