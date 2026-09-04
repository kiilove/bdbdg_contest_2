import React, { useContext, useEffect, useState } from "react";
import {
  Modal,
  Button,
  Tag,
  Space,
  Card,
  Alert,
  Spin,
  Typography,
  Tooltip,
  Divider,
  Progress,
  message as antMessage,
} from "antd";
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  SyncOutlined,
  ToolOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  CheckOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
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

const { Text, Title } = Typography;

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
      antMessage.error("대회 구조 진단 중 오류가 발생했습니다.");
    } finally {
      setChecking(false);
    }
  };

  // 🛠️ 누락 문서 자동 생성 및 원클릭 복구 실행
  const handleAutoHeal = async () => {
    if (!contestId) {
      antMessage.error("선택된 대회 정보가 없습니다.");
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

      antMessage.success(
        `대회 구조 복구 완료! (신규 생성: ${createdCount}건, 재연결: ${linkedCount}건)`
      );

      // 진단 재실행
      await runHealthCheck();
    } catch (error) {
      console.error("자동 복구 실패:", error);
      antMessage.error("복구 중 오류가 발생했습니다: " + error.message);
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
    <Modal
      open={isOpen}
      onCancel={onClose}
      width={780}
      footer={[
        <Button key="close" onClick={onClose}>
          닫기
        </Button>,
        <Button
          key="recheck"
          icon={<ReloadOutlined />}
          onClick={runHealthCheck}
          loading={checking}
        >
          다시 진단
        </Button>,
        <Button
          key="heal"
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleAutoHeal}
          loading={healing}
          danger={!isAllHealthy}
          className={
            isAllHealthy
              ? "bg-green-600 hover:bg-green-500 font-bold"
              : "bg-blue-600 hover:bg-blue-500 font-bold"
          }
        >
          {isAllHealthy ? "구조 재검증 및 동기화" : "누락 문서 자동 생성 및 연결 (원클릭 복구)"}
        </Button>,
      ]}
      title={
        <div className="flex items-center gap-2 text-lg">
          <SafetyCertificateOutlined className="text-blue-600 text-xl" />
          <span>대회 데이터 구조 무결성 검사 & 자동 복구</span>
        </div>
      }
    >
      <div className="py-2 space-y-4">
        {/* 상단 대회 요약 카드 */}
        <Card size="small" className="bg-slate-50 border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <div className="text-xs text-slate-500 font-medium">선택된 대회</div>
              <div className="text-base font-bold text-slate-800">
                {contestInfo?.contestTitle || "대회명 미설정"}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <span>Contest ID: <code className="bg-slate-200 px-1 rounded">{contestId || "없음"}</code></span>
                <span>•</span>
                <span>컬렉션명: <code className="bg-slate-200 px-1 rounded">{collectionNameVal || "미설정"}</code></span>
              </div>
            </div>
            <div className="text-right">
              <Tag color="cyan" className="font-bold">
                접수 신청서: {entryCount}건
              </Tag>
            </div>
          </div>
        </Card>

        {/* 상태 요약 배너 */}
        {checking ? (
          <div className="py-8 text-center">
            <Spin tip="대회 구조 및 Firestore 문서를 정밀 진단 중입니다..." size="large" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-white shadow-sm">
              <div className="flex items-center gap-3">
                {isAllHealthy ? (
                  <CheckCircleFilled className="text-3xl text-emerald-500" />
                ) : (
                  <ExclamationCircleFilled className="text-3xl text-amber-500" />
                )}
                <div>
                  <div className="font-bold text-slate-800 text-sm">
                    {isAllHealthy
                      ? "대회 필수 데이터 구조가 완벽하게 준비되었습니다."
                      : `${totalCount - okCount}개의 필수 문서 또는 연결이 누락되었습니다.`}
                  </div>
                  <div className="text-xs text-slate-500">
                    {isAllHealthy
                      ? "심판 배정, 계측명단, 무대 순서 등 모든 기능이 정상 작동합니다."
                      : "아래 [누락 문서 자동 생성 및 연결] 버튼을 누르면 즉시 자동 복구 및 동기화됩니다."}
                  </div>
                </div>
              </div>
              <div className="text-right w-36">
                <Progress
                  percent={percent}
                  size="small"
                  status={isAllHealthy ? "success" : "active"}
                  strokeColor={isAllHealthy ? "#10b981" : "#f59e0b"}
                />
                <span className="text-xs text-slate-500">{okCount} / {totalCount} 정상</span>
              </div>
            </div>

            {/* 컴패니언 문서 진단 리스트 */}
            <div className="border rounded-lg divide-y bg-white overflow-hidden max-h-[380px] overflow-y-auto">
              {healthResults.map((item) => {
                const isOk = item.status === "ok";
                const isUnlinked = item.status === "found_unlinked";

                return (
                  <div
                    key={item.key}
                    className={`p-3 flex items-center justify-between transition-colors ${
                      isOk ? "hover:bg-slate-50" : "bg-red-50/50 hover:bg-red-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {isOk && <CheckCircleFilled className="text-emerald-500 text-base" />}
                        {isUnlinked && <SyncOutlined className="text-blue-500 text-base" />}
                        {!isOk && !isUnlinked && <CloseCircleFilled className="text-rose-500 text-base" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800">{item.label}</span>
                          <Tag className="text-[11px] font-mono" color="default">
                            {item.collectionName}
                          </Tag>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {item.description}
                        </div>
                        <div className="text-xs text-slate-600 mt-1 flex items-center gap-1 font-mono">
                          <span>문서 ID:</span>
                          {item.docId ? (
                            <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">
                              {item.docId}
                            </code>
                          ) : (
                            <span className="text-red-500 font-bold">없음 (미생성)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {isOk && <Tag color="success">✅ 정상 연결</Tag>}
                      {isUnlinked && <Tag color="processing">🔄 재연결 가능</Tag>}
                      {!isOk && !isUnlinked && <Tag color="error">⚠️ 누락됨</Tag>}
                      <div className="text-xs text-slate-500 mt-1 font-medium">
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
    </Modal>
  );
};

export default ContestHealthCheckModal;
