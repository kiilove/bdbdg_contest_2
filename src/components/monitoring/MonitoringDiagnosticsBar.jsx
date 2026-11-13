import React, { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { message as antMessage } from "antd";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Database,
  ExternalLink,
  FileCheck2,
  Gavel,
  Layers,
  ListOrdered,
  Mic,
  Monitor,
  Music,
  Play,
  RefreshCw,
  Scale,
  Settings,
  SlidersHorizontal,
  Tv,
  Users,
  Wrench,
} from "lucide-react";
import { db } from "../../firebase";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import { StatusDot } from "../ui/BibTag";

/**
 * 대회 컬렉션명 해석 헬퍼 (contest_notice 및 contests 문서 양쪽 모두 폴백 지원)
 */
export const resolveEffectiveCollectionName = (contestInfo, currentContest) => {
  return (
    contestInfo?.contestCollectionName ||
    contestInfo?.collectionName ||
    currentContest?.contestInfo?.contestCollectionName ||
    currentContest?.contestInfo?.collectionName ||
    currentContest?.contests?.collectionName ||
    currentContest?.contests?.contestCollectionName ||
    currentContest?.collectionName ||
    ""
  );
};

/**
 * 모니터링 공통 데이터 준비 진단 체크리스트 계산
 */
export const buildMonitoringReadiness = ({
  currentContest,
  contestInfo,
  stagesCount,
  playersCount,
  judgesAssignCount,
  realtimeData,
  currentStagePlayersCount,
  emptyJudgeSeats = [],
  screenType = "basecamp", // "basecamp" | "judgeHead" | "host" | "mc" | "hub"
}) => {
  const contestsDoc = currentContest?.contests || currentContest || {};
  const contestId = contestsDoc?.id || "";
  const contestTitle =
    contestInfo?.contestTitle ||
    currentContest?.contestInfo?.contestTitle ||
    contestsDoc?.contestTitle ||
    "";

  const noticeId =
    contestsDoc?.contestNoticeId ||
    currentContest?.contestInfo?.contestNoticeId ||
    "";
  const categoryListId = contestsDoc?.contestCategorysListId || "";
  const gradeListId = contestsDoc?.contestGradesListId || "";
  const stageAssignId = contestsDoc?.contestStagesAssignId || "";
  const playerFinalId = contestsDoc?.contestPlayersFinalId || "";
  const judgeAssignId = contestsDoc?.contestJudgesAssignId || "";
  const compareListId = contestsDoc?.contestComparesListId || "";

  const effectiveCollectionName = resolveEffectiveCollectionName(
    contestInfo,
    currentContest
  );
  const noticeMissingCollectionName = Boolean(
    noticeId &&
      effectiveCollectionName &&
      !contestInfo?.contestCollectionName &&
      !currentContest?.contestInfo?.contestCollectionName
  );

  const hasContest = Boolean(contestId);
  const hasBasicSetup = Boolean(noticeId && categoryListId && gradeListId);
  const hasCollectionName = Boolean(effectiveCollectionName);

  const resolvedStagesCount =
    typeof stagesCount === "number" ? stagesCount : null;
  const resolvedPlayersCount =
    typeof playersCount === "number" ? playersCount : null;
  const resolvedJudgesCount =
    typeof judgesAssignCount === "number" ? judgesAssignCount : null;

  const hasStages =
    Boolean(stageAssignId) &&
    (resolvedStagesCount === null || resolvedStagesCount > 0);
  const hasFinalPlayers =
    Boolean(playerFinalId) &&
    (resolvedPlayersCount === null || resolvedPlayersCount > 0);
  const hasJudges =
    Boolean(judgeAssignId) &&
    (resolvedJudgesCount === null || resolvedJudgesCount > 0) &&
    emptyJudgeSeats.length === 0;
  const hasCompareDoc = Boolean(compareListId);
  const hasLiveStage = Boolean(realtimeData?.stageId);

  const steps = [
    {
      key: "contest",
      stepNo: 1,
      title: "대회 DB 선택",
      icon: Database,
      status: hasContest ? "ready" : "missing",
      valueText: hasContest
        ? contestTitle || `ID: ${contestId.slice(0, 8)}`
        : "선택된 대회 없음",
      reason: !hasContest
        ? "현재 브라우저 세션에 선택된 대회가 없습니다. 먼저 운영할 대회를 선택해야 모든 모니터링 데이터를 불러올 수 있습니다."
        : null,
      primaryAction: {
        label: hasContest ? "대회 변경" : "대회 선택하기",
        path: "/selectdatabase",
      },
    },
    {
      key: "collection",
      stepNo: 2,
      title: "대회 기본정보 · 채점 DB명",
      icon: Settings,
      status: !hasBasicSetup || !hasCollectionName
        ? "missing"
        : noticeMissingCollectionName
        ? "warning"
        : "ready",
      valueText: hasCollectionName
        ? `DB: ${effectiveCollectionName}`
        : "채점 컬렉션명 미설정",
      reason: !hasBasicSetup
        ? "대회 공지(contest_notice) 또는 종목·체급 기본 문서 연결이 누락되어 있습니다."
        : !hasCollectionName
        ? "채점표 저장용 DB 컬렉션명(collectionName)이 비어 있어 심판 점수를 조회하거나 집계할 수 없습니다."
        : noticeMissingCollectionName
        ? `대회 문서(${effectiveCollectionName})로 자동 연결 중이나 공지 문서(contest_notice)에는 채점 DB명이 비어 있습니다.`
        : null,
      autoFixType: noticeMissingCollectionName ? "syncCollectionName" : null,
      autoFixLabel: noticeMissingCollectionName
        ? "공지 문서에 DB명 즉시 동기화"
        : null,
      primaryAction: {
        label: "대회 기본정보",
        path: "/contestinfo",
      },
      secondaryAction: {
        label: "종목·체급 설정",
        path: "/contesttimetable",
      },
    },
    {
      key: "entries",
      stepNo: 3,
      title: "참가접수 · 입금 확정",
      icon: ClipboardCheck,
      status: hasContest ? "ready" : "missing",
      valueText: "접수 명단 보강 · 현장 추가",
      reason: null,
      primaryAction: {
        label: "참가신청서 관리",
        path: "/contestinvoicetable",
      },
      secondaryAction: {
        label: "수동 참가등록",
        path: "/contestnewinvoicemanual",
      },
    },
    {
      key: "players",
      stepNo: 4,
      title: "계측 · 최종 출전명단 확정",
      icon: Users,
      status: hasFinalPlayers ? "ready" : "missing",
      valueText: !playerFinalId
        ? "최종명단 문서 미연결"
        : resolvedPlayersCount === null
        ? "연결됨"
        : `확정 선수 ${resolvedPlayersCount}명`,
      reason: !playerFinalId
        ? "최종 출전선수 문서(contestPlayersFinalId)가 연결되지 않았습니다."
        : resolvedPlayersCount === 0
        ? "계측 후 최종 확정된 출전선수 명단(contest_players_final)이 0명입니다. 계측/번호 배정 후 최종 명단을 저장해 주세요."
        : null,
      primaryAction: {
        label: "계측 · 번호배정",
        path: "/contestplayerweighintable",
      },
      secondaryAction: {
        label: "최종 출전명단 확정",
        path: "/contestplayerordertableafter",
      },
    },
    {
      key: "stages",
      stepNo: 5,
      title: "무대 진행순서 편성",
      icon: ListOrdered,
      status: hasStages ? "ready" : "missing",
      valueText: !stageAssignId
        ? "무대배정 문서 미연결"
        : resolvedStagesCount === null
        ? "연결됨"
        : `편성 무대 ${resolvedStagesCount}개`,
      reason: !stageAssignId
        ? "무대 배정 문서(contestStagesAssignId)가 연결되지 않았습니다."
        : resolvedStagesCount === 0
        ? "편성된 무대 진행순서(contest_stages_assign)가 0개입니다. 무대 진행순서를 먼저 생성·저장해야 대회를 시작할 수 있습니다."
        : null,
      primaryAction: {
        label: "무대 진행순서 편성",
        path: "/conteststagetable",
      },
    },
    {
      key: "judges",
      stepNo: 6,
      title: "심판 위촉 · 좌석 배정",
      icon: Gavel,
      status:
        screenType === "host" || screenType === "mc"
          ? judgeAssignId
            ? "ready"
            : "warning"
          : !judgeAssignId || resolvedJudgesCount === 0
          ? "missing"
          : emptyJudgeSeats.length > 0
          ? "warning"
          : "ready",
      valueText: !judgeAssignId
        ? "심판배정 문서 미연결"
        : emptyJudgeSeats.length > 0
        ? `현재 무대 미배정: ${emptyJudgeSeats.join(", ")}번석`
        : resolvedJudgesCount !== null
        ? `좌석 배정 ${resolvedJudgesCount}건`
        : "심판배정 연결됨",
      reason:
        !judgeAssignId || resolvedJudgesCount === 0
          ? "심판 좌석 배정 데이터(contest_judges_assign)가 비어 있습니다. 심판석 로그인 및 채점을 위해 좌석 배정을 저장해 주세요."
          : emptyJudgeSeats.length > 0
          ? `현재 진행 무대에 심판이 배정되지 않은 좌석(${emptyJudgeSeats.join(
              ", "
            )}번)이 있습니다.`
          : null,
      primaryAction: {
        label: "심판 좌석배정",
        path: "/contestjudgetable",
      },
    },
    {
      key: "live",
      stepNo: 7,
      title: "비교심사 문서 · 실시간 무대 개시",
      icon: Play,
      status: !hasCompareDoc
        ? screenType === "judgeHead"
          ? "missing"
          : "warning"
        : hasLiveStage
        ? "ready"
        : "standby",
      valueText: !hasCompareDoc
        ? "비교심사 문서 누락"
        : hasLiveStage
        ? `#${realtimeData?.stageNumber ?? "-"} ${
            realtimeData?.categoryTitle || ""
          } 진행 중`
        : "본부석 개시 대기 중",
      reason: !hasCompareDoc
        ? "비교심사 기록 문서(contestComparesListId)가 대회 문서에 연결되어 있지 않아 비교심사 기능을 사용할 수 없습니다."
        : !hasLiveStage
        ? "사전 데이터를 불러왔으나 아직 본부석에서 [대회 시작]을 누르지 않아 실시간 진행 무대(currentStage) 신호가 없습니다."
        : null,
      autoFixType: !hasCompareDoc
        ? "createCompareDoc"
        : !hasLiveStage && hasStages
        ? "startStage"
        : null,
      autoFixLabel: !hasCompareDoc
        ? "비교심사 문서 자동 생성"
        : !hasLiveStage && hasStages
        ? screenType === "basecamp"
          ? "1번 무대 즉시 시작"
          : "본부석 화면으로 이동"
        : null,
      primaryAction: {
        label: "본부석 운영콘솔",
        path: "/contestmonitoring/main",
      },
    },
  ];

  // 현재 무대에 출전선수가 0명인 경우 추가 진단 사유
  const activeStageEmptyReason =
    hasLiveStage &&
    typeof currentStagePlayersCount === "number" &&
    currentStagePlayersCount === 0
      ? {
          key: "activeStageNoPlayers",
          title: "현재 진행 무대에 매칭된 출전선수가 0명입니다",
          description: `현재 무대(${
            realtimeData?.categoryTitle || "종목 미상"
          } / ${
            realtimeData?.gradeTitle || "체급 미상"
          })의 체급 ID와 일치하는 최종 출전선수가 없습니다. 계측 최종명단 확정 여부를 확인하거나 다음 무대로 이동해 주세요.`,
          primaryAction: {
            label: "최종 출전명단 확인",
            path: "/contestplayerordertableafter",
          },
          secondaryAction: {
            label: "계측 · 번호배정 확인",
            path: "/contestplayerweighintable",
          },
        }
      : null;

  const missingSteps = steps.filter((s) => s.status === "missing");
  const warningSteps = steps.filter((s) => s.status === "warning");
  const standbySteps = steps.filter((s) => s.status === "standby");
  const readyCount = steps.filter((s) => s.status === "ready").length;

  return {
    contestId,
    contestTitle,
    effectiveCollectionName,
    steps,
    missingSteps,
    warningSteps,
    standbySteps,
    readyCount,
    totalCount: steps.length,
    activeStageEmptyReason,
    hasLiveStage,
    hasStages,
    hasFinalPlayers,
  };
};

/**
 * 상단 울트라퀵 데이터 보강 메뉴 바 (Light / Dark 양쪽 테마 지원)
 */
export const MonitoringDiagnosticsBar = ({
  variant = "light", // "light" | "dark"
  screenType = "basecamp",
  contestInfo = null,
  stagesCount,
  playersCount,
  judgesAssignCount,
  realtimeData = null,
  currentStagePlayersCount,
  emptyJudgeSeats = [],
  onStartFirstStage = null,
  onRefreshData = null,
  defaultExpanded,
}) => {
  const navigate = useNavigate();
  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );
  const [busyAction, setBusyAction] = useState("");

  const readiness = useMemo(
    () =>
      buildMonitoringReadiness({
        currentContest,
        contestInfo,
        stagesCount,
        playersCount,
        judgesAssignCount,
        realtimeData,
        currentStagePlayersCount,
        emptyJudgeSeats,
        screenType,
      }),
    [
      currentContest,
      contestInfo,
      stagesCount,
      playersCount,
      judgesAssignCount,
      realtimeData,
      currentStagePlayersCount,
      emptyJudgeSeats,
      screenType,
    ]
  );

  const hasCriticalIssue =
    readiness.missingSteps.length > 0 ||
    Boolean(readiness.activeStageEmptyReason);

  const [isOpen, setIsOpen] = useState(() =>
    typeof defaultExpanded === "boolean" ? defaultExpanded : false
  );

  const effectiveOpen = isOpen || (defaultExpanded === undefined && false);
  const [userToggled, setUserToggled] = useState(false);
  const drawerVisible = userToggled ? effectiveOpen : hasCriticalIssue;

  const toggleDrawer = () => {
    setUserToggled(true);
    setIsOpen(!drawerVisible);
  };

  const isDark = variant === "dark";

  // 인라인 원클릭 자동 보강 액션 실행기
  const handleAutoFix = async (fixType) => {
    const contestsDoc = currentContest?.contests || {};
    const cId = contestsDoc?.id || currentContest?.id;

    if (fixType === "startStage") {
      if (typeof onStartFirstStage === "function") {
        onStartFirstStage();
      } else {
        navigate("/contestmonitoring/main");
      }
      return;
    }

    if (!cId) {
      antMessage.warning("먼저 대회를 선택해 주세요.");
      navigate("/selectdatabase");
      return;
    }

    setBusyAction(fixType);
    try {
      if (fixType === "createCompareDoc") {
        const docRef = await addDoc(collection(db, "contest_compares_list"), {
          contestId: cId,
          compares: [],
        });
        await updateDoc(doc(db, "contests", cId), {
          contestComparesListId: docRef.id,
        });
        const nextContest = {
          ...currentContest,
          contests: {
            ...(currentContest?.contests || {}),
            contestComparesListId: docRef.id,
          },
        };
        setCurrentContest(nextContest);
        try {
          sessionStorage.setItem("currentContest", JSON.stringify(nextContest));
          localStorage.setItem("currentContest", JSON.stringify(nextContest));
        } catch (e) {
          // 스토리지 예외 무시
        }
        antMessage.success(
          "비교심사 데이터 문서(contest_compares_list)가 생성·연결되었습니다."
        );
        if (typeof onRefreshData === "function") onRefreshData();
      } else if (fixType === "syncCollectionName") {
        const noticeId =
          contestsDoc?.contestNoticeId ||
          currentContest?.contestInfo?.contestNoticeId;
        const colName = readiness.effectiveCollectionName;
        if (noticeId && colName) {
          await updateDoc(doc(db, "contest_notice", noticeId), {
            contestCollectionName: colName,
          });
          const nextContest = {
            ...currentContest,
            contestInfo: {
              ...(currentContest?.contestInfo || {}),
              contestCollectionName: colName,
            },
          };
          setCurrentContest(nextContest);
          try {
            sessionStorage.setItem(
              "currentContest",
              JSON.stringify(nextContest)
            );
            localStorage.setItem("currentContest", JSON.stringify(nextContest));
          } catch (e) {
            // 스토리지 예외 무시
          }
          antMessage.success(
            `공지 문서에 채점 DB명(${colName})이 동기화되었습니다.`
          );
          if (typeof onRefreshData === "function") onRefreshData();
        }
      }
    } catch (error) {
      console.error("[MonitoringDiagnosticsBar] 자동 보강 오류:", error);
      antMessage.error(`자동 보강 실패: ${error.message}`);
    } finally {
      setBusyAction("");
    }
  };

  // 모니터링 콘솔 간 빠른 이동 링크
  const consoleShortcuts = [
    {
      key: "basecamp",
      label: "본부석",
      path: "/contestmonitoring/main",
      icon: Monitor,
    },
    {
      key: "judgeHead",
      label: "심판위원장",
      path: "/contestmonitoring/judgeHead",
      icon: Scale,
    },
    {
      key: "host",
      label: "사회자 프롬프터",
      path: "/contestmonitoring/MC",
      icon: Mic,
    },
    {
      key: "mc",
      label: "방송제어 MC",
      path: "/mc",
      icon: SlidersHorizontal,
      newTab: true,
    },
    {
      key: "live",
      label: "전광판 화면",
      path: "/stage-live",
      icon: Tv,
      newTab: true,
    },
    {
      key: "audio",
      label: "음향센터",
      path: "/vibeflow-audio",
      icon: Music,
      newTab: true,
    },
  ];

  // 상태 요약 배지 텍스트 및 스타일
  const issueCount =
    readiness.missingSteps.length +
    readiness.warningSteps.length +
    (readiness.activeStageEmptyReason ? 1 : 0);

  const summaryBadgeClass =
    readiness.missingSteps.length > 0 || readiness.activeStageEmptyReason
      ? isDark
        ? "bg-[#e5484d]/15 text-[#ff8589] border-[#e5484d]/40"
        : "bg-[#dc2626]/[0.08] text-[#dc2626] border-[#dc2626]/25"
      : readiness.warningSteps.length > 0
      ? isDark
        ? "bg-[#f59e0b]/15 text-[#fcd34d] border-[#f59e0b]/40"
        : "bg-[#b45309]/[0.08] text-[#b45309] border-[#b45309]/25"
      : readiness.standbySteps.length > 0
      ? isDark
        ? "bg-[#2563eb]/20 text-[#93c5fd] border-[#2563eb]/40"
        : "bg-[#2563eb]/[0.08] text-[#2563eb] border-[#2563eb]/25"
      : isDark
      ? "bg-[#4cc38a]/15 text-[#4cc38a] border-[#4cc38a]/35"
      : "bg-[#16a34a]/[0.08] text-[#16a34a] border-[#16a34a]/25";

  const summaryLabel =
    readiness.missingSteps.length > 0 || readiness.activeStageEmptyReason
      ? `필수 데이터 보강 필요 ${
          readiness.missingSteps.length +
          (readiness.activeStageEmptyReason ? 1 : 0)
        }건`
      : readiness.warningSteps.length > 0
      ? `점검 권장 ${readiness.warningSteps.length}건`
      : readiness.standbySteps.length > 0
      ? "사전 데이터 준비 완료 · 개시 대기"
      : `모든 데이터 정상 (${readiness.readyCount}/${readiness.totalCount})`;

  return (
    <div
      className={`rounded-[12px] border transition-colors ${
        isDark
          ? "bg-[#19191b] border-[#ededed]/[0.09] text-[#ededed]"
          : "bg-white border-[#171717]/[0.08] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      }`}
    >
      {/* 상단 1줄 요약 & 울트라퀵 토글 바 */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={toggleDrawer}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] text-xs font-semibold border transition-colors cursor-pointer ${
              drawerVisible
                ? "bg-[#2563eb] text-white border-[#2563eb]"
                : isDark
                ? "bg-[#232325] hover:bg-[#2c2c2f] text-[#ededed] border-[#ededed]/[0.12]"
                : "bg-[#f4f4f5] hover:bg-[#e4e4e7]/80 text-[#171717] border-[#171717]/[0.1]"
            }`}
          >
            <Wrench size={13.5} strokeWidth={1.75} />
            <span>울트라퀵 데이터 보강</span>
            {drawerVisible ? (
              <ChevronUp size={14} strokeWidth={1.75} />
            ) : (
              <ChevronDown size={14} strokeWidth={1.75} />
            )}
          </button>

          <span
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] border text-xs font-medium tabular-nums ${summaryBadgeClass}`}
          >
            <StatusDot
              status={
                readiness.missingSteps.length > 0 ||
                readiness.activeStageEmptyReason
                  ? "error"
                  : issueCount > 0
                  ? "warning"
                  : readiness.hasLiveStage
                  ? "live"
                  : "active"
              }
              live={readiness.hasLiveStage && issueCount === 0}
            />
            <span>{summaryLabel}</span>
          </span>

          {/* 핵심 수치 미니 인디케이터 */}
          <div
            className={`hidden xl:flex items-center gap-2 text-xs font-mono tabular-nums pl-1 ${
              isDark ? "text-[#a1a1a6]" : "text-[#737373]"
            }`}
          >
            <span>
              DB:{" "}
              <strong
                className={
                  readiness.effectiveCollectionName
                    ? isDark
                      ? "text-[#ededed] font-medium"
                      : "text-[#171717] font-medium"
                    : "text-[#dc2626] font-semibold"
                }
              >
                {readiness.effectiveCollectionName || "미설정"}
              </strong>
            </span>
            {typeof stagesCount === "number" && (
              <>
                <span>·</span>
                <span>
                  무대{" "}
                  <strong
                    className={
                      stagesCount > 0
                        ? isDark
                          ? "text-[#ededed] font-medium"
                          : "text-[#171717] font-medium"
                        : "text-[#dc2626] font-semibold"
                    }
                  >
                    {stagesCount}
                  </strong>
                </span>
              </>
            )}
            {typeof playersCount === "number" && (
              <>
                <span>·</span>
                <span>
                  출전선수{" "}
                  <strong
                    className={
                      playersCount > 0
                        ? isDark
                          ? "text-[#ededed] font-medium"
                          : "text-[#171717] font-medium"
                        : "text-[#dc2626] font-semibold"
                    }
                  >
                    {playersCount}명
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* 우측: 콘솔 스위처 + 새로고침 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {consoleShortcuts.map((item) => {
            const Icon = item.icon;
            const isCurrent = item.key === screenType;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.newTab) {
                    window.open(item.path, "_blank", "noopener,noreferrer");
                  } else {
                    navigate(item.path);
                  }
                }}
                className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-[6px] text-[11px] font-medium border transition-colors cursor-pointer ${
                  isCurrent
                    ? isDark
                      ? "bg-[#ededed] text-[#141415] border-[#ededed]"
                      : "bg-[#171717] text-white border-[#171717]"
                    : isDark
                    ? "bg-[#141415] hover:bg-[#232325] text-[#a1a1a6] hover:text-[#ededed] border-[#ededed]/[0.08]"
                    : "bg-[#fafafa] hover:bg-[#f4f4f5] text-[#525252] hover:text-[#171717] border-[#171717]/[0.08]"
                }`}
              >
                <Icon size={12.5} strokeWidth={1.5} />
                <span>{item.label}</span>
                {item.newTab && (
                  <ExternalLink
                    size={10.5}
                    strokeWidth={1.5}
                    className="opacity-65"
                  />
                )}
              </button>
            );
          })}

          {typeof onRefreshData === "function" && (
            <button
              type="button"
              onClick={onRefreshData}
              title="모니터링 데이터 다시 불러오기"
              className={`inline-flex items-center justify-center h-7 w-7 rounded-[6px] border transition-colors cursor-pointer ${
                isDark
                  ? "bg-[#232325] hover:bg-[#2c2c2f] text-[#a1a1a6] hover:text-[#ededed] border-[#ededed]/[0.1]"
                  : "bg-[#fafafa] hover:bg-[#f4f4f5] text-[#525252] hover:text-[#171717] border-[#171717]/[0.08]"
              }`}
            >
              <RefreshCw size={13} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* 확장형 울트라퀵 데이터 보강 드로어 */}
      {drawerVisible && (
        <div
          className={`px-4 pb-4 pt-3 border-t space-y-3 ${
            isDark
              ? "border-[#ededed]/[0.08] bg-[#141415]/60"
              : "border-[#171717]/[0.07] bg-[#fafafa]/80"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium flex items-center gap-1.5">
              <Layers
                size={14}
                strokeWidth={1.5}
                className={isDark ? "text-[#93c5fd]" : "text-[#2563eb]"}
              />
              <span className={isDark ? "text-[#ededed]" : "text-[#171717]"}>
                대회 운영 필수 데이터 7단계 진단 및 즉시 보강 바로가기
              </span>
            </div>
            <span
              className={`text-[11px] ${
                isDark ? "text-[#85858b]" : "text-[#737373]"
              }`}
            >
              누락된 단계의 버튼을 누르면 해당 데이터 설정 화면으로 즉시 이동하거나 자동 생성합니다
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
            {readiness.steps.map((step) => {
              const StepIcon = step.icon;
              const isMissing = step.status === "missing";
              const isWarning = step.status === "warning";
              const isStandby = step.status === "standby";

              const cardStyle = isMissing
                ? isDark
                  ? "bg-[#241618] border-[#e5484d]/50"
                  : "bg-[#fef2f2]/80 border-[#dc2626]/35"
                : isWarning
                ? isDark
                  ? "bg-[#231e14] border-[#f59e0b]/45"
                  : "bg-[#fffbeb]/80 border-[#b45309]/30"
                : isStandby
                ? isDark
                  ? "bg-[#172033] border-[#2563eb]/45"
                  : "bg-[#eff6ff]/70 border-[#2563eb]/30"
                : isDark
                ? "bg-[#19191b] border-[#ededed]/[0.08]"
                : "bg-white border-[#171717]/[0.08]";

              const statusTag = isMissing
                ? {
                    text: "누락",
                    cls: isDark
                      ? "bg-[#e5484d]/20 text-[#ff8589]"
                      : "bg-[#dc2626]/10 text-[#dc2626]",
                  }
                : isWarning
                ? {
                    text: "확인",
                    cls: isDark
                      ? "bg-[#f59e0b]/20 text-[#fcd34d]"
                      : "bg-[#b45309]/10 text-[#b45309]",
                  }
                : isStandby
                ? {
                    text: "대기",
                    cls: isDark
                      ? "bg-[#2563eb]/25 text-[#93c5fd]"
                      : "bg-[#2563eb]/10 text-[#2563eb]",
                  }
                : {
                    text: "정상",
                    cls: isDark
                      ? "bg-[#4cc38a]/15 text-[#4cc38a]"
                      : "bg-[#16a34a]/10 text-[#16a34a]",
                  };

              return (
                <div
                  key={step.key}
                  className={`rounded-[10px] border p-3 flex flex-col justify-between gap-2.5 ${cardStyle}`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-mono tabular-nums ${
                          isDark ? "text-[#85858b]" : "text-[#737373]"
                        }`}
                      >
                        <StepIcon size={12.5} strokeWidth={1.5} />
                        <span>STEP {step.stepNo}</span>
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold ${statusTag.cls}`}
                      >
                        {statusTag.text}
                      </span>
                    </div>

                    <div
                      className={`text-xs font-semibold leading-snug ${
                        isDark ? "text-[#ededed]" : "text-[#171717]"
                      }`}
                    >
                      {step.title}
                    </div>

                    <div
                      className={`text-xs tabular-nums truncate ${
                        isMissing
                          ? isDark
                            ? "text-[#ff8589] font-medium"
                            : "text-[#dc2626] font-medium"
                          : isDark
                          ? "text-[#a1a1a6]"
                          : "text-[#525252]"
                      }`}
                      title={step.valueText}
                    >
                      {step.valueText}
                    </div>

                    {step.reason && (
                      <p
                        className={`text-[11px] leading-relaxed m-0 pt-0.5 ${
                          isDark ? "text-[#a1a1a6]" : "text-[#525252]"
                        }`}
                      >
                        {step.reason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    {step.autoFixType && (
                      <button
                        type="button"
                        disabled={busyAction === step.autoFixType}
                        onClick={() => handleAutoFix(step.autoFixType)}
                        className="w-full inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-[6px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Play size={11.5} strokeWidth={1.75} />
                        <span>
                          {busyAction === step.autoFixType
                            ? "처리 중..."
                            : step.autoFixLabel}
                        </span>
                      </button>
                    )}

                    {step.primaryAction && (
                      <button
                        type="button"
                        onClick={() => navigate(step.primaryAction.path)}
                        className={`w-full inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-[6px] text-[11px] font-medium border transition-colors cursor-pointer ${
                          isMissing && !step.autoFixType
                            ? "bg-[#2563eb] hover:bg-[#1d4ed8] text-white border-[#2563eb]"
                            : isDark
                            ? "bg-[#232325] hover:bg-[#2c2c2f] text-[#ededed] border-[#ededed]/[0.1]"
                            : "bg-white hover:bg-[#f4f4f5] text-[#171717] border-[#171717]/[0.12]"
                        }`}
                      >
                        <span>{step.primaryAction.label}</span>
                        <ArrowUpRight size={12} strokeWidth={1.5} />
                      </button>
                    )}

                    {step.secondaryAction && (
                      <button
                        type="button"
                        onClick={() => navigate(step.secondaryAction.path)}
                        className={`w-full inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-[6px] text-[11px] font-medium border transition-colors cursor-pointer ${
                          isDark
                            ? "bg-transparent hover:bg-[#232325] text-[#a1a1a6] hover:text-[#ededed] border-[#ededed]/[0.08]"
                            : "bg-[#f4f4f5]/70 hover:bg-[#e4e4e7]/70 text-[#525252] hover:text-[#171717] border-[#171717]/[0.08]"
                        }`}
                      >
                        <span>{step.secondaryAction.label}</span>
                        <ArrowUpRight size={11.5} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 화면 표시 불가 / 대기 시 구체적인 누락 데이터를 정확히 안내하는 진단 카드
 */
export const MonitoringBlockingState = ({
  variant = "light", // "light" | "dark"
  screenType = "basecamp",
  screenLabel = "모니터링 화면",
  contestInfo = null,
  stagesCount,
  playersCount,
  judgesAssignCount,
  realtimeData = null,
  currentStagePlayersCount,
  emptyJudgeSeats = [],
  onStartFirstStage = null,
  onRefreshData = null,
}) => {
  const navigate = useNavigate();
  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );
  const [busyFix, setBusyFix] = useState("");
  const isDark = variant === "dark";

  const handleBlockingAutoFix = async (fixType) => {
    const contestsDoc = currentContest?.contests || {};
    const cId = contestsDoc?.id || currentContest?.id;
    if (!cId) {
      navigate("/selectdatabase");
      return;
    }
    setBusyFix(fixType);
    try {
      if (fixType === "createCompareDoc") {
        const docRef = await addDoc(collection(db, "contest_compares_list"), {
          contestId: cId,
          compares: [],
        });
        await updateDoc(doc(db, "contests", cId), {
          contestComparesListId: docRef.id,
        });
        const nextContest = {
          ...currentContest,
          contests: {
            ...(currentContest?.contests || {}),
            contestComparesListId: docRef.id,
          },
        };
        setCurrentContest(nextContest);
        try {
          sessionStorage.setItem("currentContest", JSON.stringify(nextContest));
          localStorage.setItem("currentContest", JSON.stringify(nextContest));
        } catch (e) {
          // 스토리지 예외 무시
        }
        antMessage.success(
          "비교심사 데이터 문서(contest_compares_list)가 생성·연결되었습니다."
        );
        if (typeof onRefreshData === "function") onRefreshData();
      } else if (fixType === "syncCollectionName") {
        const noticeId =
          contestsDoc?.contestNoticeId ||
          currentContest?.contestInfo?.contestNoticeId;
        const colName = resolveEffectiveCollectionName(
          contestInfo,
          currentContest
        );
        if (noticeId && colName) {
          await updateDoc(doc(db, "contest_notice", noticeId), {
            contestCollectionName: colName,
          });
          antMessage.success(
            `공지 문서에 채점 DB명(${colName})이 동기화되었습니다.`
          );
          if (typeof onRefreshData === "function") onRefreshData();
        }
      }
    } catch (err) {
      antMessage.error(`자동 보강 실패: ${err.message}`);
    } finally {
      setBusyFix("");
    }
  };

  const readiness = useMemo(
    () =>
      buildMonitoringReadiness({
        currentContest,
        contestInfo,
        stagesCount,
        playersCount,
        judgesAssignCount,
        realtimeData,
        currentStagePlayersCount,
        emptyJudgeSeats,
        screenType,
      }),
    [
      currentContest,
      contestInfo,
      stagesCount,
      playersCount,
      judgesAssignCount,
      realtimeData,
      currentStagePlayersCount,
      emptyJudgeSeats,
      screenType,
    ]
  );

  // 표시 불가 직접 원인 수집
  const blockingItems = [
    ...readiness.missingSteps.map((s) => ({
      key: s.key,
      severity: "missing",
      title: `${s.title} 데이터가 준비되지 않았습니다 (${s.valueText})`,
      description: s.reason,
      primaryAction: s.primaryAction,
      secondaryAction: s.secondaryAction,
      autoFixType: s.autoFixType,
      autoFixLabel: s.autoFixLabel,
    })),
    ...(readiness.activeStageEmptyReason
      ? [
          {
            key: readiness.activeStageEmptyReason.key,
            severity: "missing",
            title: readiness.activeStageEmptyReason.title,
            description: readiness.activeStageEmptyReason.description,
            primaryAction: readiness.activeStageEmptyReason.primaryAction,
            secondaryAction: readiness.activeStageEmptyReason.secondaryAction,
          },
        ]
      : []),
    ...readiness.warningSteps.map((s) => ({
      key: s.key,
      severity: "warning",
      title: `${s.title} 점검 필요 (${s.valueText})`,
      description: s.reason,
      primaryAction: s.primaryAction,
      secondaryAction: s.secondaryAction,
    })),
    ...readiness.standbySteps.map((s) => ({
      key: s.key,
      severity: "standby",
      title: "사전 데이터는 준비 완료되었으나 아직 무대가 개시되지 않았습니다",
      description:
        screenType === "basecamp"
          ? "상단 또는 아래의 [1번 무대 시작 (대회 시작)] 버튼을 누르면 즉시 실시간 채점 및 전광판·사회자 연동이 시작됩니다."
          : "본부석 운영콘솔에서 [대회 시작]을 눌러 첫 무대를 개시하면 이 화면에 자동으로 종목·선수·심판 데이터가 표시됩니다.",
      primaryAction:
        screenType === "basecamp"
          ? null
          : {
              label: "본부석 화면으로 이동",
              path: "/contestmonitoring/main",
            },
      canStartHere: screenType === "basecamp" && readiness.hasStages,
    })),
  ];

  const hasMissing =
    readiness.missingSteps.length > 0 ||
    Boolean(readiness.activeStageEmptyReason);

  return (
    <div
      className={`rounded-[12px] border p-5 md:p-6 space-y-5 ${
        isDark
          ? "bg-[#19191b] border-[#ededed]/[0.09] text-[#ededed]"
          : "bg-white border-[#171717]/[0.08] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      }`}
    >
      {/* 헤더 영역 */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border ${
              hasMissing
                ? isDark
                  ? "bg-[#e5484d]/15 border-[#e5484d]/40 text-[#ff8589]"
                  : "bg-[#dc2626]/[0.08] border-[#dc2626]/25 text-[#dc2626]"
                : isDark
                ? "bg-[#2563eb]/20 border-[#2563eb]/40 text-[#93c5fd]"
                : "bg-[#2563eb]/[0.08] border-[#2563eb]/25 text-[#2563eb]"
            }`}
          >
            {hasMissing ? (
              <AlertTriangle size={19} strokeWidth={1.6} />
            ) : (
              <FileCheck2 size={19} strokeWidth={1.6} />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-[4px] ${
                  hasMissing
                    ? isDark
                      ? "bg-[#e5484d]/20 text-[#ff8589]"
                      : "bg-[#dc2626]/10 text-[#dc2626]"
                    : isDark
                    ? "bg-[#2563eb]/20 text-[#93c5fd]"
                    : "bg-[#2563eb]/10 text-[#2563eb]"
                }`}
              >
                {hasMissing ? "데이터 준비 필요" : "본부석 무대 개시 대기"}
              </span>
              <span
                className={`text-xs ${
                  isDark ? "text-[#85858b]" : "text-[#737373]"
                }`}
              >
                {screenLabel}
              </span>
            </div>

            <h2
              className={`text-base md:text-lg font-semibold tracking-[-0.02em] m-0 ${
                isDark ? "text-[#ededed]" : "text-[#171717]"
              }`}
            >
              {hasMissing
                ? "다음 데이터가 아직 준비되지 않아 실시간 화면을 표시할 수 없습니다"
                : "필수 데이터 확인 완료 — 본부석에서 첫 무대를 시작하면 즉시 연동됩니다"}
            </h2>
            <p
              className={`text-xs md:text-sm m-0 leading-relaxed ${
                isDark ? "text-[#a1a1a6]" : "text-[#525252]"
              }`}
            >
              {hasMissing
                ? "화면 오류가 아니라 아래 항목이 아직 입력·확정되지 않은 상태입니다. 각 항목 우측의 바로가기 버튼으로 데이터를 보강해 주세요."
                : "무대 편성 및 출전선수 명단이 정상 연결되어 있습니다. 대회를 시작하기 전까지 대기 상태를 유지합니다."}
            </p>
          </div>
        </div>

        {typeof onRefreshData === "function" && (
          <button
            type="button"
            onClick={onRefreshData}
            className={`inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[8px] text-xs font-medium border shrink-0 transition-colors cursor-pointer ${
              isDark
                ? "bg-[#232325] hover:bg-[#2c2c2f] text-[#ededed] border-[#ededed]/[0.1]"
                : "bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] border-[#171717]/[0.08]"
            }`}
          >
            <RefreshCw size={14} strokeWidth={1.5} />
            <span>상태 다시 확인</span>
          </button>
        )}
      </div>

      {/* 구체적 사유 리스트 */}
      {blockingItems.length > 0 && (
        <div className="space-y-2.5">
          {blockingItems.map((item) => {
            const isMissing = item.severity === "missing";
            const isWarning = item.severity === "warning";

            return (
              <div
                key={item.key}
                className={`rounded-[10px] border p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  isMissing
                    ? isDark
                      ? "bg-[#241618]/80 border-[#e5484d]/40"
                      : "bg-[#fef2f2]/70 border-[#dc2626]/25"
                    : isWarning
                    ? isDark
                      ? "bg-[#231e14]/80 border-[#f59e0b]/40"
                      : "bg-[#fffbeb]/70 border-[#b45309]/25"
                    : isDark
                    ? "bg-[#141415] border-[#ededed]/[0.08]"
                    : "bg-[#fafafa] border-[#171717]/[0.08]"
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-[4px] text-[11px] font-semibold ${
                        isMissing
                          ? isDark
                            ? "bg-[#e5484d]/20 text-[#ff8589]"
                            : "bg-[#dc2626]/10 text-[#dc2626]"
                          : isWarning
                          ? isDark
                            ? "bg-[#f59e0b]/20 text-[#fcd34d]"
                            : "bg-[#b45309]/10 text-[#b45309]"
                          : isDark
                          ? "bg-[#2563eb]/20 text-[#93c5fd]"
                          : "bg-[#2563eb]/10 text-[#2563eb]"
                      }`}
                    >
                      {isMissing
                        ? "필수 누락"
                        : isWarning
                        ? "권장 점검"
                        : "개시 대기"}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        isDark ? "text-[#ededed]" : "text-[#171717]"
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>
                  {item.description && (
                    <p
                      className={`text-xs leading-relaxed m-0 ${
                        isDark ? "text-[#a1a1a6]" : "text-[#525252]"
                      }`}
                    >
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {item.autoFixType &&
                    item.autoFixType !== "startStage" &&
                    item.autoFixLabel && (
                      <button
                        type="button"
                        disabled={busyFix === item.autoFixType}
                        onClick={() => handleBlockingAutoFix(item.autoFixType)}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Wrench size={13.5} strokeWidth={1.6} />
                        <span>
                          {busyFix === item.autoFixType
                            ? "자동 생성 중..."
                            : item.autoFixLabel}
                        </span>
                      </button>
                    )}

                  {item.canStartHere &&
                    typeof onStartFirstStage === "function" && (
                      <button
                        type="button"
                        onClick={onStartFirstStage}
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Play size={14} strokeWidth={1.75} />
                        <span>1번 무대 시작 (대회 시작)</span>
                      </button>
                    )}

                  {item.primaryAction && (
                    <button
                      type="button"
                      onClick={() => navigate(item.primaryAction.path)}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      <span>{item.primaryAction.label}</span>
                      <ArrowUpRight size={14} strokeWidth={1.5} />
                    </button>
                  )}

                  {item.secondaryAction && (
                    <button
                      type="button"
                      onClick={() => navigate(item.secondaryAction.path)}
                      className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] text-xs font-medium border transition-colors cursor-pointer ${
                        isDark
                          ? "bg-[#232325] hover:bg-[#2c2c2f] text-[#ededed] border-[#ededed]/[0.12]"
                          : "bg-white hover:bg-[#f4f4f5] text-[#171717] border-[#171717]/[0.15]"
                      }`}
                    >
                      <span>{item.secondaryAction.label}</span>
                      <ArrowUpRight size={14} strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 준비 완료된 항목 요약 표시 */}
      <div
        className={`pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs ${
          isDark
            ? "border-[#ededed]/[0.08] text-[#85858b]"
            : "border-[#171717]/[0.08] text-[#737373]"
        }`}
      >
        <span className="font-medium">연결 확인된 데이터:</span>
        {readiness.steps
          .filter((s) => s.status === "ready")
          .map((s) => (
            <span
              key={s.key}
              className={`inline-flex items-center gap-1 ${
                isDark ? "text-[#a1a1a6]" : "text-[#525252]"
              }`}
            >
              <CheckCircle2
                size={13}
                strokeWidth={1.6}
                className={isDark ? "text-[#4cc38a]" : "text-[#16a34a]"}
              />
              <span>
                {s.title} ({s.valueText})
              </span>
            </span>
          ))}
      </div>
    </div>
  );
};

export default MonitoringDiagnosticsBar;
