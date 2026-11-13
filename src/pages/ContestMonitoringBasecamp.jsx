"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import LoadingPage from "./LoadingPage";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirebaseRealtimeDeleteData,
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { Modal } from "@mui/material";
import ContestRankingSummaryPrintAll from "../modals/ContestRankingSummaryPrintAll";
import ContestAwardCreator from "./ContestAwardCreator";
import StageBroadcastController from "../components/broadcast/StageBroadcastController";
import { useDevice } from "../contexts/DeviceContext";
import { collection, query, where, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  Play,
  Pause,
  RefreshCw,
  Printer,
  Eye,
  XCircle,
  SkipForward,
  RotateCcw,
  Activity,
  List,
  LayoutGrid,
  Layers,
  AlertCircle,
  Check,
} from "lucide-react";
import { BibTag, StatusDot } from "../components/ui/BibTag";
import {
  MonitoringBlockingState,
  MonitoringDiagnosticsBar,
  resolveEffectiveCollectionName,
} from "../components/monitoring/MonitoringDiagnosticsBar";

// 본부석 실시간 렌더링 에러 바운더리
class BasecampErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[BasecampErrorBoundary Captured Error]:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 bg-white border border-[#dc2626]/30 rounded-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-4">
          <div className="flex items-center gap-2 text-[#dc2626]">
            <AlertCircle size={18} strokeWidth={1.5} />
            <h2 className="text-base font-semibold m-0">
              본부석 화면 렌더링 오류가 감지되었습니다
            </h2>
          </div>
          <p className="text-sm text-[#525252] m-0">
            화면 구성 요소를 표시하는 중 예외가 발생했습니다. 아래 디버그 로그를 확인해 주세요.
          </p>
          <div className="text-xs font-mono text-[#171717] bg-[#fafafa] p-4 rounded-[8px] border border-[#171717]/[0.08] overflow-auto max-h-72 whitespace-pre-wrap select-all">
            {this.state.error?.toString()}
            {"\n\n[Component Stack]:\n"}
            {this.state.errorInfo?.componentStack || "No stack trace available"}
          </div>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <RefreshCw size={14} strokeWidth={1.5} />
            <span>본부석 화면 새로고침</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ContestMonitoringBasecamp = ({ isHolding, setIsHolding }) => {
  const { currentContest } = useContext(CurrentContestContext);
  const { isTabletOrMobile } = useDevice();

  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [contestInfo, setContestInfo] = useState({});
  const [judgesIsEndValidated, setJudgesIsEndValidated] = useState(true);
  const [currentSubTab, setCurrentSubTab] = useState("0");
  const [selectedSectionTab, setSelectedSectionTab] = useState("");

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [summaryPrintPreviewOpen, setSummaryPrintPreviewOpen] = useState(false);
  const [awardPrintPreviewOpen, setAwardPrintPreviewOpen] = useState(false);
  const [awardProp, setAwardProp] = useState({});
  const [summaryProp, setSummaryProp] = useState({});

  const [stagesArray, setStagesArray] = useState([]);
  const [playersArray, setPlayersArray] = useState([]);
  const [judgesArray, setJudgesArray] = useState([]);
  const [judgesPoolMap, setJudgesPoolMap] = useState({});
  const [currentStageInfo, setCurrentStageInfo] = useState({ stageId: null });
  const [prevRealtimeData, setPrevRealtimeData] = useState({});

  const [normalScoreData, setNormalScoreData] = useState([]);

  const fetchNotice = useFirestoreGetDocument("contest_notice");
  const fetchStages = useFirestoreGetDocument("contest_stages_assign");
  const fetchJudgesAssign = useFirestoreGetDocument("contest_judges_assign");
  const fetchFinalPlayers = useFirestoreGetDocument("contest_players_final");
  const fetchScoreCardQuery = useFirestoreQuery();
  const fetchResultQuery = useFirestoreQuery();

  const { data: realtimeData, loading: realtimeLoading } =
    useFirebaseRealtimeGetDocument(
      currentContest?.contests?.id
        ? `currentStage/${currentContest.contests.id}`
        : null
    );

  const updateCurrentStage = useFirebaseRealtimeUpdateData();
  const deleteCompare = useFirebaseRealtimeDeleteData();

  const fetchPool = async (
    noticeId,
    stageAssignId,
    playerFinalId,
    judgeAssignId
  ) => {
    try {
      const returnNotice = noticeId
        ? await fetchNotice.getDocument(noticeId)
        : null;
      const returnContestStage = stageAssignId
        ? await fetchStages.getDocument(stageAssignId)
        : null;
      const returnPlayersFinal = playerFinalId
        ? await fetchFinalPlayers.getDocument(playerFinalId)
        : null;
      const returnJudgesAssign = judgeAssignId
        ? await fetchJudgesAssign.getDocument(judgeAssignId)
        : null;

      if (returnNotice) {
        setContestInfo({ ...returnNotice });
      }
      if (returnContestStage?.stages) {
        setStagesArray(
          (returnContestStage.stages || []).sort(
            (a, b) => (a.stageNumber || 0) - (b.stageNumber || 0)
          )
        );
      }
      if (returnPlayersFinal?.players) {
        setPlayersArray(
          (returnPlayersFinal.players || [])
            .sort((a, b) => (a.playerIndex || 0) - (b.playerIndex || 0))
            .filter((f) => f.playerNoShow === false)
        );
      }
      if (returnJudgesAssign?.judges) {
        setJudgesArray(returnJudgesAssign.judges || []);
      }
    } catch (error) {
      console.error("[ContestMonitoringBasecamp] fetchPool 예외 발생:", error);
      setMessage({
        variant: "error",
        title: "모니터링 데이터 로드 실패",
        body: "본부석 운영 데이터를 불러오지 못했습니다.",
        body4: error.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 계측 파이널 및 사진 변경 실시간 Live-Sync 리스너
  useEffect(() => {
    const finalDocId = currentContest?.contests?.contestPlayersFinalId;
    if (!finalDocId) return;

    const unsub = onSnapshot(
      doc(db, "contest_players_final", finalDocId),
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          const remotePlayers = remoteData?.players || [];
          if (remotePlayers.length > 0) {
            const cleanList = remotePlayers
              .sort((a, b) => (a.playerIndex || 0) - (b.playerIndex || 0))
              .filter((f) => f.playerNoShow === false);
            setPlayersArray(cleanList);
          }
        }
      },
      (err) => {
        console.warn(
          "[Basecamp] contest_players_final 실시간 리스너 오류:",
          err
        );
      }
    );

    return () => unsub();
  }, [currentContest?.contests?.contestPlayersFinalId]);

  // 심판 좌석 배정 및 심판 풀(개인 비밀번호/이름) 실시간 Live-Sync 리스너
  useEffect(() => {
    const judgeAssignDocId =
      currentContest?.contests?.contestJudgesAssignId ||
      currentContest?.contestJudgesAssignId;
    const contestId = currentContest?.contests?.id || currentContest?.id;
    const unsubs = [];

    if (judgeAssignDocId) {
      unsubs.push(
        onSnapshot(
          doc(db, "contest_judges_assign", judgeAssignDocId),
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (Array.isArray(data?.judges)) {
                setJudgesArray(data.judges);
              }
            }
          },
          (err) => {
            console.warn(
              "[Basecamp] contest_judges_assign 실시간 리스너 오류:",
              err
            );
          }
        )
      );
    }

    if (contestId) {
      unsubs.push(
        onSnapshot(
          query(
            collection(db, "contest_judges_pool"),
            where("contestId", "==", contestId)
          ),
          (snap) => {
            const nextMap = {};
            snap.docs.forEach((d) => {
              const item = d.data();
              if (item?.judgeUid) {
                nextMap[item.judgeUid] = item;
              }
            });
            setJudgesPoolMap(nextMap);
          },
          (err) => {
            console.warn(
              "[Basecamp] contest_judges_pool 실시간 리스너 오류:",
              err
            );
          }
        )
      );
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [
    currentContest?.contests?.contestJudgesAssignId,
    currentContest?.contestJudgesAssignId,
    currentContest?.contests?.id,
    currentContest?.id,
  ]);

  const fetchResultAndScoreBoard = async (gradeId, gradeTitle) => {
    const condition = [where("gradeId", "==", gradeId)];
    try {
      const data = await fetchResultQuery.getDocuments(
        "contest_results_list",
        condition
      );

      if (data?.length === 0) {
        setMessage({
          variant: "warning",
          title: "확정된 순위 데이터 없음",
          body: `'${gradeTitle || "해당 체급"}'의 확정된 순위 결과가 아직 등록되지 않았습니다.`,
          body2: "심판위원장 화면에서 순위표 확정을 먼저 완료해 주세요.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
        return;
      }

      const standingData = data[0].result.sort(
        (a, b) => a.playerRank - b.playerRank
      );

      const collectionInfo = `currentStage/${currentContest.contests.id}/screen`;
      const newState = {
        players: [...standingData],
        gradeTitle: gradeTitle,
        status: { playStart: true },
      };
      await updateCurrentStage.updateData(collectionInfo, { ...newState });
    } catch (error) {
      console.log(error);
    }
  };

  const handleScreenEnd = async () => {
    const collectionInfo = `currentStage/${currentContest.contests.id}/screen/status`;
    const newState = {
      playStart: false,
      standingStart: false,
    };
    await updateCurrentStage.updateData(collectionInfo, { ...newState });
  };

  const effectiveCollectionName = resolveEffectiveCollectionName(
    contestInfo,
    currentContest
  );

  const fetchScoreTable = async (grades) => {
    if (!effectiveCollectionName || !grades || grades.length === 0) return;

    const allData = [];

    for (const grade of grades) {
      const { gradeId } = grade || {};
      if (!gradeId) continue;
      try {
        const condition = [where("gradeId", "==", gradeId)];
        const data = await fetchScoreCardQuery.getDocuments(
          effectiveCollectionName,
          condition
        );
        if (Array.isArray(data)) {
          allData.push(...data);
        }
      } catch (error) {
        console.log(error);
      }
    }

    setNormalScoreData(allData);
  };

  const handleForceScoreTableRefresh = (grades) => {
    if (!grades || grades.length <= 0) return;
    fetchScoreTable(grades);
  };

  const handleGradeInfo = (grades) => {
    let gradeTitle = "";
    let gradeId = "";
    let matchedJudgesCount = 0;
    let matchedPlayersCount = 0;
    let matchedJudgeAssignCount = 0;

    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      return {
        gradeTitle: "오류발생",
        gradeId: "",
        matchedJudgesCount: 0,
        matchedPlayersCount: 0,
        matchedJudgeAssignCount: 0,
      };
    }

    if (grades.length === 1) {
      gradeTitle = grades[0]?.gradeTitle || "";
      gradeId = grades[0]?.gradeId || "";
      matchedJudgesCount = Number(grades[0]?.categoryJudgeCount) || 0;
      matchedJudgeAssignCount = (judgesArray || []).filter(
        (f) => f?.contestGradeId === gradeId || f?.gradeId === gradeId
      ).length;
      matchedPlayersCount = Number(grades[0]?.playerCount) || 0;
    } else if (grades.length > 1) {
      const madeTitle = grades
        .map((grade) => (grade?.gradeTitle || "") + " ")
        .join("");
      matchedJudgesCount = Number(grades[0]?.categoryJudgeCount) || 0;

      matchedJudgeAssignCount = (judgesArray || []).filter(
        (f) =>
          f?.contestGradeId === grades[0]?.gradeId ||
          f?.gradeId === grades[0]?.gradeId
      ).length;
      grades.forEach((grade) => {
        matchedPlayersCount +=
          Number.parseInt(grade?.playerCount || 0, 10) || 0;
      });
      gradeId = grades[0]?.gradeId || "";
      gradeTitle = madeTitle + "통합";
    }

    return {
      gradeTitle,
      gradeId,
      matchedJudgesCount,
      matchedPlayersCount,
      matchedJudgeAssignCount,
    };
  };

  const handleForceReStart = async (judgeIndex, contestId) => {
    const collectionInfo = `currentStage/${contestId}/judges/${judgeIndex}`;
    const newStatus = {
      seatIndex: judgeIndex + 1,
      isLogined: false,
      isEnd: false,
    };
    try {
      await updateCurrentStage.updateData(collectionInfo, { ...newStatus });
    } catch (error) {
      console.log(error);
    }
  };

  const handleUpdateCurrentStage = async (currentStageId) => {
    if (!stagesArray || stagesArray.length === 0) {
      setMessage({
        variant: "warning",
        title: "무대 진행 순서 미설정",
        body: "무대 설정(타임테이블) 데이터가 없습니다.",
        body2: "무대설정 메뉴에서 먼저 무대 진행 순서를 생성하고 저장해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    const targetStage = stagesArray[currentStageId];
    if (!targetStage) {
      setMessage({
        variant: "error",
        title: "무대 정보 확인 불가",
        body: `해당 순번(${currentStageId + 1}번)의 무대 정보를 찾을 수 없습니다.`,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    const {
      stageId,
      stageNumber,
      categoryJudgeCount,
      categoryJudgeType,
      categoryId,
      categoryTitle,
      grades,
    } = targetStage;

    const { gradeTitle, gradeId } = handleGradeInfo(grades);

    const targetJudgeCount = Number(categoryJudgeCount) || 5;

    const judgeInitState = Array.from(
      { length: targetJudgeCount },
      (_, jIdx) => {
        const seat = jIdx + 1;
        // 동일 (gradeId, seat) 중복 레코드가 혹시 존재할 경우 가장 마지막(최신) 배정을 사용
        const matchingRows = (judgesArray || []).filter(
          (j) =>
            (j?.contestGradeId === gradeId || j?.gradeId === gradeId) &&
            Number(j?.seatIndex) === seat
        );
        const assigned =
          matchingRows.length > 0
            ? matchingRows[matchingRows.length - 1]
            : null;
        const liveJudge = assigned?.judgeUid
          ? judgesPoolMap[assigned.judgeUid]
          : null;

        return {
          seatIndex: seat,
          isLogined: false,
          isEnd: false,
          judgeName: liveJudge?.judgeName ?? assigned?.judgeName ?? null,
          judgeUid: assigned?.judgeUid ?? null,
          onedayPassword:
            liveJudge?.onedayPassword ?? assigned?.onedayPassword ?? null,
        };
      }
    );

    const emptySeatNumbers = judgeInitState
      .filter((j) => !j.judgeUid)
      .map((j) => j.seatIndex);
    let stageNoticeModal = null;
    if (emptySeatNumbers.length > 0) {
      stageNoticeModal = {
        variant: "warning",
        title: "심판 미배정 좌석 확인",
        body: `무대는 개시되었으나 현재 무대에 심판 미배정 좌석(${emptySeatNumbers.join(", ")}번)이 있습니다.`,
        body2: "심판 배정 관리에서 누락된 좌석을 확인해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      };
    } else if (Array.isArray(grades) && grades.length > 1) {
      const hasCombinedMismatch = grades.slice(1).some((subGrade) =>
        judgeInitState.some((seatObj) => {
          const subRows = (judgesArray || []).filter(
            (j) =>
              (j?.contestGradeId === subGrade?.gradeId ||
                j?.gradeId === subGrade?.gradeId) &&
              Number(j?.seatIndex) === seatObj.seatIndex
          );
          const subAssigned =
            subRows.length > 0 ? subRows[subRows.length - 1] : null;
          return (subAssigned?.judgeUid || null) !== (seatObj.judgeUid || null);
        })
      );
      if (hasCombinedMismatch) {
        stageNoticeModal = {
          variant: "info",
          title: "통합 무대 심판진 안내",
          body: `합쳐진 체급 간 배정 심판이 달라 대표 체급('${grades[0]?.gradeTitle}') 기준 심판진으로 진행됩니다.`,
          isButton: true,
          confirmButtonText: "확인",
        };
      }
    }

    const contestId = currentContest?.contests?.id || currentContest?.id;
    if (!contestId) {
      setMessage({
        variant: "error",
        title: "대회 선택 확인 필요",
        body: "대회 정보(contestId)를 찾을 수 없습니다. 대회를 다시 선택해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    try {
      await deleteCompare.deleteData(`currentStage/${contestId}/compares`);
    } catch (e) {
      console.warn("compares 삭제 에러:", e);
    }

    const newCurrentStateInfo = {
      stageId: stageId || "",
      stageNumber: stageNumber || currentStageId + 1,
      categoryId: categoryId || "",
      categoryTitle: categoryTitle || "",
      categoryJudgeType: categoryJudgeType || "point",
      gradeId: gradeId || "",
      gradeTitle: gradeTitle || "",
      stageJudgeCount: targetJudgeCount,
      judges: judgeInitState,
      resultSaved: [],
      compares: {
        status: {
          compareStart: false,
          compareEnd: false,
          compareCancel: false,
          compareIng: false,
        },
        confirmed: { count: 0 },
      },
      screen: { status: { playStart: false } },
    };

    const collectionInfo = `currentStage/${contestId}`;

    try {
      const res = await updateCurrentStage.updateData(collectionInfo, {
        ...newCurrentStateInfo,
      });

      // 종목/체급 변경 시 전광판 스크린 화면을 대기 및 종목/체급 안내(STANDBY)로 전환
      await updateCurrentStage
        .updateData(`currentBroadcast/${contestId}`, {
          mode: "STANDBY",
          contestTitle:
            currentContest?.contestInfo?.contestTitle ||
            currentContest?.contests?.contestTitle ||
            "",
          stageInfo: {
            categoryTitle: categoryTitle || "",
            gradeTitle: gradeTitle || "",
            gradeId: targetStage?.grades?.[0]?.gradeId || gradeId || "",
            stageNumber: newCurrentStateInfo.stageNumber || "",
            playerCount: targetStage?.players?.length || 0,
          },
          activePlayer: null,
          specialScreenData: null,
          calloutData: null,
          updatedAt: Date.now(),
        })
        .catch(() => {});

      if (res) {
        setLastUpdated(new Date().toLocaleTimeString("ko-KR"));
        if (stageNoticeModal) {
          setMessage(stageNoticeModal);
          setMsgOpen(true);
        }
      } else {
        setMessage({
          variant: "error",
          title: "무대 전환 업데이트 실패",
          body: "실시간 무대 데이터 업데이트에 실패했습니다.",
          body2: "Firebase 권한 또는 네트워크 연결 상태를 확인해 주세요.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
      }
    } catch (error) {
      console.error("handleUpdateCurrentStage error:", error);
      setMessage({
        variant: "error",
        title: "무대 시작 오류",
        body: "무대를 개시하는 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    }
  };

  const handleJudgeIsEndValidated = (judgesList) => {
    if (!Array.isArray(judgesList) || judgesList.length <= 0) return true;
    const validate = judgesList.some((s) => s.isEnd === false);
    return validate;
  };

  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  const reloadBasecampData = () => {
    const noticeId =
      currentContest?.contests?.contestNoticeId ||
      currentContest?.contestInfo?.contestNoticeId ||
      currentContest?.contestNoticeId;
    const stageAssignId =
      currentContest?.contests?.contestStagesAssignId ||
      currentContest?.contestStagesAssignId;
    const playerFinalId =
      currentContest?.contests?.contestPlayersFinalId ||
      currentContest?.contestPlayersFinalId;
    const judgeAssignId =
      currentContest?.contests?.contestJudgesAssignId ||
      currentContest?.contestJudgesAssignId;

    if (noticeId || stageAssignId || playerFinalId || judgeAssignId) {
      setIsLoading(true);
      fetchPool(noticeId, stageAssignId, playerFinalId, judgeAssignId);
    } else {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadBasecampData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest]);

  useEffect(() => {
    if (!(isLoading || realtimeLoading)) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      setLoadingTimedOut(true);
    }, 7000);
    return () => clearTimeout(timer);
  }, [isLoading, realtimeLoading]);

  useEffect(() => {
    const foundStage = stagesArray.find(
      (f) => f.stageId === realtimeData?.stageId
    );
    setCurrentStageInfo(foundStage ? { ...foundStage } : { stageId: null });
    setJudgesIsEndValidated(handleJudgeIsEndValidated(realtimeData?.judges));
  }, [realtimeData, stagesArray]);

  // 무대 변경 시 이전 점수 초기화
  useEffect(() => {
    setNormalScoreData([]);
  }, [realtimeData?.stageId]);

  const judgesSignature = JSON.stringify(realtimeData?.judges || []);
  const stageGradesSignature = JSON.stringify(
    (currentStageInfo?.grades || []).map((g) => g?.gradeId)
  );

  useEffect(() => {
    if (realtimeData?.judges) {
      setPrevRealtimeData(() => ({ ...realtimeData }));
    }
  }, [realtimeData]);

  // H5: contestCollectionName, stageId, judges 변경 시 안전하게 점수표 갱신
  useEffect(() => {
    if (
      !effectiveCollectionName ||
      !currentStageInfo?.stageId ||
      !currentStageInfo?.grades?.length
    ) {
      return;
    }

    let cancelled = false;
    (async () => {
      const allData = [];
      for (const grade of currentStageInfo.grades) {
        if (!grade?.gradeId) continue;
        try {
          const data = await fetchScoreCardQuery.getDocuments(
            effectiveCollectionName,
            [where("gradeId", "==", grade.gradeId)]
          );
          if (Array.isArray(data)) {
            allData.push(...data);
          }
        } catch (error) {
          console.log(error);
        }
      }
      if (!cancelled) {
        setNormalScoreData(allData);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveCollectionName,
    currentStageInfo?.stageId,
    stageGradesSignature,
    judgesSignature,
  ]);

  /** 섹션(=categorySection) 그룹핑 & 다가올 섹션 계산 */
  const sectionsWithOrder = useMemo(() => {
    const map = new Map();
    (stagesArray || [])
      .slice()
      .sort((a, b) => a.stageNumber - b.stageNumber)
      .forEach((s) => {
        const key = s?.categorySection || "미지정";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(s);
      });

    const arr = Array.from(map.entries()).map(([section, items]) => {
      const firstStageNumber = items[0]?.stageNumber ?? 999999;
      return { section, items, firstStageNumber };
    });

    return arr.sort((a, b) => a.firstStageNumber - b.firstStageNumber);
  }, [stagesArray]);

  const currentSectionKey = useMemo(() => {
    if (!realtimeData?.stageId) return null;
    const current = stagesArray.find((s) => s.stageId === realtimeData.stageId);
    return current?.categorySection || "미지정";
  }, [realtimeData?.stageId, stagesArray]);

  const upcomingSectionKey = useMemo(() => {
    if (!currentSectionKey) {
      return sectionsWithOrder?.[0]?.section ?? null;
    }
    const idx = sectionsWithOrder.findIndex(
      (s) => s.section === currentSectionKey
    );
    if (idx < 0) return sectionsWithOrder?.[0]?.section ?? null;
    if (idx === sectionsWithOrder.length - 1) return null;
    return sectionsWithOrder[idx + 1]?.section ?? null;
  }, [currentSectionKey, sectionsWithOrder]);

  useEffect(() => {
    if (!selectedSectionTab && sectionsWithOrder.length > 0) {
      setSelectedSectionTab(
        String(currentSectionKey || sectionsWithOrder[0].section)
      );
    }
  }, [sectionsWithOrder, currentSectionKey, selectedSectionTab]);

  const currentStageIdx = useMemo(
    () => stagesArray.findIndex((s) => s.stageId === realtimeData?.stageId),
    [stagesArray, realtimeData?.stageId]
  );

  const hasNextStage =
    currentStageIdx !== -1 && currentStageIdx + 1 < stagesArray.length;

  const currentStageJudgeType =
    (currentStageIdx !== -1
      ? stagesArray[currentStageIdx]?.categoryJudgeType
      : null) ||
    currentStageInfo?.categoryJudgeType ||
    realtimeData?.categoryJudgeType;

  const scrollToSectionTable = (section) => {
    const el = document.querySelector(`[data-section-anchor="${section}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  void prevRealtimeData;
  void setAwardProp;

  const JudgeCardView = ({ judges }) => (
    <div className="space-y-2.5">
      {judges?.map((judge, index) => {
        const {
          isEnd,
          isLogined,
          seatIndex,
          judgeName,
          judgeUid,
          onedayPassword,
        } = judge;

        let dotStatus = "idle";
        let statusText = "로그인 대기";
        if (isEnd && isLogined) {
          dotStatus = "live";
          statusText = "심사 종료";
        } else if (!isEnd && isLogined) {
          dotStatus = "active";
          statusText = "심사 중";
        }

        return (
          <div
            key={index}
            className="p-3.5 rounded-[8px] bg-white border border-[#171717]/[0.08] flex justify-between items-center gap-3"
          >
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <BibTag number={seatIndex} size="sm" />
                <span className="text-xs font-medium text-[#525252]">
                  심판석
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs font-medium text-[#171717]">
                  <StatusDot
                    status={dotStatus}
                    live={!isEnd && Boolean(isLogined)}
                  />
                  <span>{statusText}</span>
                </span>
              </div>

              {judgeName ? (
                <div>
                  <div className="text-sm font-semibold text-[#171717]">
                    {judgeName}
                  </div>
                  {judgeUid && (
                    <div className="text-xs font-mono tabular-nums text-[#737373]">
                      {judgeUid} / {onedayPassword}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[#737373]">배정 정보 없음</div>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                handleForceReStart(index, currentContest.contests.id)
              }
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium shrink-0 cursor-pointer"
            >
              <RotateCcw size={13} strokeWidth={1.5} />
              <span>재시작</span>
            </button>
          </div>
        );
      })}
    </div>
  );

  const StageCardView = ({ stages }) => (
    <div className="space-y-2.5">
      {stages?.map((stage) => {
        const {
          categoryTitle,
          grades,
          categoryJudgeType,
          stageId,
          stageNumber,
        } = stage;
        const info = handleGradeInfo(grades);
        const isCurrentStage = realtimeData?.stageId === stageId;
        const globalIndex = stagesArray.findIndex((s) => s.stageId === stageId);

        return (
          <div
            key={stageId}
            className={`p-3.5 rounded-[8px] border flex items-start justify-between gap-3 ${
              isCurrentStage
                ? "bg-[#2563eb]/[0.04] border-[#2563eb]/40"
                : "bg-white border-[#171717]/[0.08]"
            }`}
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <BibTag
                  prefix="#"
                  number={stageNumber}
                  variant={isCurrentStage ? "active" : "default"}
                  size="sm"
                />
                <span className="text-sm font-semibold text-[#171717]">
                  {categoryTitle}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/10 text-[11px] font-mono font-medium text-[#525252]">
                  {categoryJudgeType === "point" ? "P" : "R"}
                </span>
                {isCurrentStage && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] text-xs font-medium">
                    <StatusDot status="live" live />
                    <span>진행 중</span>
                  </span>
                )}
              </div>
              <div className="text-xs text-[#525252]">{info.gradeTitle}</div>
              <div className="text-xs font-mono tabular-nums text-[#737373]">
                출전 {info.matchedPlayersCount}명 · 심판{" "}
                {info.matchedJudgeAssignCount}명
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                globalIndex > -1 && handleUpdateCurrentStage(globalIndex)
              }
              className={`inline-flex items-center gap-1 h-8 px-3 rounded-[6px] text-xs font-medium shrink-0 cursor-pointer transition-colors ${
                isCurrentStage
                  ? "border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] text-[#171717]"
                  : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              }`}
            >
              {isCurrentStage ? (
                <>
                  <RotateCcw size={13} strokeWidth={1.5} />
                  <span>재시작</span>
                </>
              ) : (
                <>
                  <Play size={13} strokeWidth={1.5} />
                  <span>시작</span>
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );

  const ScoreCardView = ({ players, judges }) => (
    <div className="space-y-2.5">
      {players?.map((player, pIdx) => {
        const playerNumber = player.playerNumber;

        return (
          <div
            key={pIdx}
            className="p-3.5 rounded-[8px] bg-white border border-[#171717]/[0.08] space-y-2.5"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-[#171717]/[0.06]">
              <span className="text-xs font-medium text-[#737373]">
                선수번호
              </span>
              <BibTag number={playerNumber} size="md" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {judges?.map((judge, jIdx) => {
                const finded = normalScoreData.find(
                  (f) =>
                    f.playerNumber === playerNumber &&
                    f.seatIndex === judge.seatIndex
                );

                let scoreDisplay = (
                  <span className="font-mono tabular-nums text-[#737373]">
                    -
                  </span>
                );
                if (finded?.playerScore >= 1000) {
                  scoreDisplay = (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#737373] text-[11px] font-medium">
                      순위제외
                    </span>
                  );
                } else if (
                  finded?.playerScore !== 0 &&
                  finded?.playerScore !== undefined &&
                  finded?.playerScore !== null
                ) {
                  scoreDisplay = (
                    <span className="font-mono font-semibold tabular-nums text-[#171717]">
                      {finded.playerScore}
                    </span>
                  );
                }

                return (
                  <div
                    key={jIdx}
                    className="flex justify-between items-center px-2.5 py-2 bg-[#fafafa] rounded-[6px] border border-[#171717]/[0.06]"
                  >
                    <span className="text-xs font-mono tabular-nums text-[#525252]">
                      {judge.seatIndex}번
                    </span>
                    {scoreDisplay}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderStageTable = (items) => (
    <div className="overflow-x-auto rounded-[8px] border border-[#171717]/[0.08]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08]">
            <th className="px-3.5 py-2.5 text-center text-xs font-medium text-[#525252] w-[84px] whitespace-nowrap">
              순서
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-[#525252]">
              종목 및 체급 정보
            </th>
            <th className="px-4 py-2.5 text-center text-xs font-medium text-[#525252] w-[140px] whitespace-nowrap">
              관리
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#171717]/[0.06] bg-white">
          {items.map((record) => {
            const { categoryTitle, grades, categoryJudgeType, stageId } =
              record;
            const info = handleGradeInfo(grades);
            const isCurrentStage = realtimeData?.stageId === stageId;
            const globalIndex = stagesArray.findIndex(
              (s) => s.stageId === stageId
            );

            return (
              <tr
                key={stageId}
                className={`transition-colors ${
                  isCurrentStage
                    ? "bg-[#2563eb]/[0.04]"
                    : "hover:bg-[#fafafa]"
                }`}
              >
                <td className="px-3.5 py-3 text-center whitespace-nowrap">
                  <BibTag
                    prefix="#"
                    number={record.stageNumber}
                    variant={isCurrentStage ? "active" : "default"}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#171717]">
                        {categoryTitle} ({info.gradeTitle})
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/10 text-[11px] font-mono font-medium text-[#525252]">
                        {categoryJudgeType === "point" ? "P" : "R"}
                      </span>
                      {isCurrentStage && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] text-xs font-medium">
                          <StatusDot status="live" live />
                          <span>진행 중</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono tabular-nums text-[#737373]">
                      출전인원: {info.matchedPlayersCount}명 · 배정심판:{" "}
                      {info.matchedJudgeAssignCount}명
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() =>
                      globalIndex > -1 && handleUpdateCurrentStage(globalIndex)
                    }
                    className={`inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                      isCurrentStage
                        ? "border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] text-[#171717]"
                        : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                    }`}
                  >
                    {isCurrentStage ? (
                      <>
                        <RotateCcw size={13} strokeWidth={1.5} />
                        <span>재시작</span>
                      </>
                    ) : (
                      <>
                        <Play size={13} strokeWidth={1.5} />
                        <span>시작</span>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const subTabs = [
    { key: "0", label: "현재 무대상황", icon: Activity },
    { key: "1", label: "전체 무대목록", icon: List },
    { key: "2", label: "섹션별 한눈에", icon: LayoutGrid },
    { key: "3", label: "섹션별 탭", icon: Layers },
  ];

  // 현재 무대(또는 개시 예정 1번 무대) 출전선수 및 미배정 심판석 진단 계산
  const activeStageMatchedPlayersCount = useMemo(() => {
    if (!realtimeData?.stageId) return undefined;
    const grades = currentStageInfo?.grades || [];
    if (!grades.length) return 0;
    const gradeSet = new Set(grades.map((g) => g?.gradeId).filter(Boolean));
    return (playersArray || []).filter((p) => gradeSet.has(p.contestGradeId))
      .length;
  }, [realtimeData?.stageId, currentStageInfo?.grades, playersArray]);

  const emptyJudgeSeatsForDiag = useMemo(() => {
    if (realtimeData?.judges?.length > 0) {
      return realtimeData.judges
        .filter((j) => !j?.judgeUid && !j?.judgeName)
        .map((j, i) => j?.seatIndex ?? i + 1);
    }
    const firstStage = stagesArray?.[0];
    if (!firstStage) return [];
    const targetCount = Number(firstStage?.categoryJudgeCount) || 0;
    const repGradeId = firstStage?.grades?.[0]?.gradeId;
    if (!targetCount || !repGradeId) return [];
    const missing = [];
    for (let seat = 1; seat <= targetCount; seat += 1) {
      const hasSeat = (judgesArray || []).some(
        (j) =>
          (j?.contestGradeId === repGradeId || j?.gradeId === repGradeId) &&
          Number(j?.seatIndex) === seat &&
          Boolean(j?.judgeUid)
      );
      if (!hasSeat) missing.push(seat);
    }
    return missing;
  }, [realtimeData?.judges, stagesArray, judgesArray]);

  return (
    <BasecampErrorBoundary>
      {(isLoading || realtimeLoading) && !loadingTimedOut ? (
        <div className="flex w-full min-h-[60vh] justify-center items-center bg-[#fafafa]">
          <LoadingPage propStyles={{ width: "80", height: "60" }} />
        </div>
      ) : (
        <div className="flex flex-col w-full min-h-screen bg-[#fafafa] text-[#171717] p-4 md:p-6 gap-4">
          <ConfirmationModal
            isOpen={msgOpen}
            message={message}
            onCancel={() => setMsgOpen(false)}
            onConfirm={() => setMsgOpen(false)}
          />

          <Modal open={summaryPrintPreviewOpen}>
            <ContestRankingSummaryPrintAll
              props={summaryProp}
              setClose={setSummaryPrintPreviewOpen}
            />
          </Modal>
          <Modal open={awardPrintPreviewOpen}>
            <ContestAwardCreator
              props={awardProp}
              setClose={setAwardPrintPreviewOpen}
            />
          </Modal>

          {/* 울트라퀵 데이터 보강 메뉴 바 */}
          <MonitoringDiagnosticsBar
            variant="light"
            screenType="basecamp"
            contestInfo={contestInfo}
            stagesCount={stagesArray.length}
            playersCount={playersArray.length}
            judgesAssignCount={judgesArray.length}
            realtimeData={realtimeData}
            currentStagePlayersCount={activeStageMatchedPlayersCount}
            emptyJudgeSeats={emptyJudgeSeatsForDiag}
            onStartFirstStage={
              stagesArray.length > 0 ? () => handleUpdateCurrentStage(0) : null
            }
            onRefreshData={reloadBasecampData}
          />

          {/* 상단 대회 본부석 요약 바 */}
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 md:p-5">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs font-medium text-[#171717]">
                    <StatusDot
                      status={
                        realtimeData?.stageId && !isHolding
                          ? "live"
                          : isHolding
                          ? "warning"
                          : "idle"
                      }
                      live={Boolean(realtimeData?.stageId && !isHolding)}
                    />
                    <span>
                      {realtimeData?.stageId && !isHolding
                        ? "실시간 모니터링 중"
                        : isHolding
                        ? "모니터링 일시정지"
                        : "대회 시작 전"}
                    </span>
                  </span>

                  {effectiveCollectionName && (
                    <span className="text-xs font-mono text-[#737373]">
                      DB: {effectiveCollectionName}
                    </span>
                  )}

                  {lastUpdated && (
                    <span className="text-xs font-mono tabular-nums text-[#737373]">
                      · 최근 갱신 {lastUpdated}
                    </span>
                  )}
                </div>

                <h1 className="text-lg font-semibold tracking-[-0.02em] text-[#171717] m-0">
                  {contestInfo.contestTitle || "대회 본부석 운영 콘솔"}
                </h1>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                {!isHolding && realtimeData?.stageId && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsHolding(true);
                      setLastUpdated(new Date().toLocaleString("ko-KR"));
                    }}
                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[8px] border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Pause size={15} strokeWidth={1.5} />
                    <span>모니터링 일시정지</span>
                  </button>
                )}
                {isHolding && (
                  <button
                    type="button"
                    onClick={() => setIsHolding(false)}
                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Play size={15} strokeWidth={1.5} />
                    <span>모니터링 재개</span>
                  </button>
                )}
                {!realtimeData?.stageId && !isHolding && (
                  <button
                    type="button"
                    onClick={() => handleUpdateCurrentStage(0)}
                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Play size={15} strokeWidth={1.5} />
                    <span>대회 시작</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 실시간 무대 전광판 송출 콘솔 */}
          <StageBroadcastController
            currentStage={currentStageInfo}
            currentPlayers={
              currentStageInfo?.grades
                ? playersArray.filter((p) =>
                    currentStageInfo.grades.some(
                      (g) => g.gradeId === p.contestGradeId
                    )
                  )
                : []
            }
          />

          {/* 본부석 진행 및 무대 관리 탭 영역 */}
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-4 md:px-5 py-3 bg-[#f4f4f5] border-b border-[#171717]/[0.08] overflow-x-auto overflow-y-hidden no-scrollbar">
              <div className="inline-flex items-center gap-1 p-1 rounded-[8px] bg-[#e4e4e7]/60 min-w-max">
                {subTabs.map((tab) => {
                  const IconComponent = tab.icon;
                  const active = currentSubTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setCurrentSubTab(tab.key)}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? "bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                          : "text-[#525252] hover:text-[#171717]"
                      }`}
                    >
                      <IconComponent size={15} strokeWidth={1.5} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 md:p-5">
              {/* 탭 0: 현재 무대상황 */}
              {currentSubTab === "0" && (
                <>
                  {realtimeData?.stageId ? (
                    <div className="space-y-5">
                      {(!effectiveCollectionName ||
                        activeStageMatchedPlayersCount === 0) && (
                        <MonitoringBlockingState
                          variant="light"
                          screenType="basecamp"
                          screenLabel="본부석 현재 무대 점검"
                          contestInfo={contestInfo}
                          stagesCount={stagesArray.length}
                          playersCount={playersArray.length}
                          judgesAssignCount={judgesArray.length}
                          realtimeData={realtimeData}
                          currentStagePlayersCount={
                            activeStageMatchedPlayersCount
                          }
                          emptyJudgeSeats={emptyJudgeSeatsForDiag}
                          onRefreshData={reloadBasecampData}
                        />
                      )}
                      {/* 진행상황 (심판석 모니터링) */}
                      <div className="rounded-[10px] border border-[#171717]/[0.08] overflow-hidden">
                        <div className="flex justify-between items-center flex-wrap gap-2 px-4 py-3 bg-[#f4f4f5] border-b border-[#171717]/[0.08]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[#171717]">
                              심판석 진행상황
                            </span>
                            {realtimeData?.stageNumber !== undefined && (
                              <BibTag
                                prefix="#"
                                number={realtimeData.stageNumber}
                                size="sm"
                              />
                            )}
                            <span className="text-sm font-medium text-[#525252]">
                              {realtimeData?.categoryTitle} (
                              {realtimeData?.gradeTitle})
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-white border border-[#171717]/10 text-[11px] font-mono font-medium text-[#525252]">
                              {currentStageJudgeType === "point" ? "P" : "R"}
                            </span>
                          </div>

                          {!judgesIsEndValidated && hasNextStage && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateCurrentStage(currentStageIdx + 1)
                              }
                              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[6px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors cursor-pointer"
                            >
                              <SkipForward size={14} strokeWidth={1.5} />
                              <span>다음 무대 진행</span>
                            </button>
                          )}
                        </div>

                        <div className="p-4 bg-white">
                          {isTabletOrMobile ? (
                            <JudgeCardView judges={realtimeData?.judges} />
                          ) : (
                            <div className="overflow-x-auto rounded-[8px] border border-[#171717]/[0.08]">
                              <table className="w-full border-collapse text-sm">
                                <thead>
                                  <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08]">
                                    <th className="px-3.5 py-2.5 text-center text-xs font-medium text-[#525252] w-[96px]">
                                      심판석
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#525252]">
                                      심판 정보
                                    </th>
                                    <th className="px-4 py-2.5 text-center text-xs font-medium text-[#525252] w-[140px]">
                                      상태
                                    </th>
                                    <th className="px-4 py-2.5 text-center text-xs font-medium text-[#525252] w-[140px]">
                                      관리
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#171717]/[0.06] bg-white">
                                  {(realtimeData?.judges || []).map(
                                    (judge, idx) => {
                                      const { isEnd, isLogined } = judge;
                                      let dotStatus = "idle";
                                      let statusLabel = "로그인 대기";
                                      if (isEnd && isLogined) {
                                        dotStatus = "live";
                                        statusLabel = "심사 종료";
                                      } else if (!isEnd && isLogined) {
                                        dotStatus = "active";
                                        statusLabel = "심사 중";
                                      }

                                      return (
                                        <tr
                                          key={idx}
                                          className="hover:bg-[#fafafa] transition-colors"
                                        >
                                          <td className="px-3.5 py-2.5 text-center">
                                            <BibTag
                                              number={judge.seatIndex}
                                              size="sm"
                                            />
                                          </td>
                                          <td className="px-4 py-2.5">
                                            {judge?.judgeName ? (
                                              <div className="flex flex-col">
                                                <span className="font-medium text-[#171717]">
                                                  {judge.judgeName}
                                                </span>
                                                {judge?.judgeUid && (
                                                  <span className="text-xs font-mono tabular-nums text-[#737373]">
                                                    {judge.judgeUid} /{" "}
                                                    {judge.onedayPassword}
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="text-xs text-[#737373]">
                                                정보 없음
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-2.5 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs font-medium text-[#171717]">
                                              <StatusDot
                                                status={dotStatus}
                                                live={
                                                  !isEnd && Boolean(isLogined)
                                                }
                                              />
                                              <span>{statusLabel}</span>
                                            </span>
                                          </td>
                                          <td className="px-4 py-2.5 text-center">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleForceReStart(
                                                  idx,
                                                  currentContest.contests.id
                                                )
                                              }
                                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium transition-colors cursor-pointer"
                                            >
                                              <RotateCcw
                                                size={12}
                                                strokeWidth={1.5}
                                              />
                                              <span>강제 재시작</span>
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    }
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 집계상황 매트릭스 */}
                      <div className="rounded-[10px] border border-[#171717]/[0.08] overflow-hidden">
                        <div className="flex justify-between items-center flex-wrap gap-2 px-4 py-3 bg-[#f4f4f5] border-b border-[#171717]/[0.08]">
                          <span className="text-sm font-semibold text-[#171717]">
                            집계상황
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleForceScoreTableRefresh(
                                currentStageInfo.grades
                              )
                            }
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#fafafa] text-[#171717] text-xs font-medium transition-colors cursor-pointer"
                          >
                            <RefreshCw size={14} strokeWidth={1.5} />
                            <span>새로고침</span>
                          </button>
                        </div>

                        <div className="p-4 space-y-6 bg-white">
                          {currentStageInfo?.grades?.length > 0 ? (
                            currentStageInfo.grades.map((grade, gIdx) => {
                              const { categoryTitle, gradeTitle, gradeId } =
                                grade;
                              const filterdPlayers = playersArray
                                .filter(
                                  (f) =>
                                    f.contestGradeId === gradeId &&
                                    f.playerNoShow === false
                                )
                                .sort((a, b) => a.playerIndex - b.playerIndex);

                              const judges = realtimeData?.judges || [];
                              const isGradeSaved =
                                Array.isArray(realtimeData?.resultSaved) &&
                                realtimeData.resultSaved.includes(gradeId);

                              return (
                                <div key={gIdx} className="space-y-3">
                                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-base font-semibold text-[#171717]">
                                        {categoryTitle} ({gradeTitle})
                                      </span>
                                      {isGradeSaved && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#16a34a]/10 text-[#16a34a] text-xs font-medium">
                                          <Check size={13} strokeWidth={1.5} />
                                          <span>순위표 확정</span>
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={handleScreenEnd}
                                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium transition-colors cursor-pointer"
                                      >
                                        <XCircle size={14} strokeWidth={1.5} />
                                        <span>화면종료</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          fetchResultAndScoreBoard(
                                            gradeId,
                                            gradeTitle
                                          )
                                        }
                                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors cursor-pointer"
                                      >
                                        <Eye size={14} strokeWidth={1.5} />
                                        <span>순위표공개</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSummaryProp(() => ({
                                            contestId:
                                              currentContest.contests.id,
                                            gradeId,
                                            categoryTitle,
                                            gradeTitle,
                                            categoryJudgeType:
                                              currentStageInfo.categoryJudgeType,
                                          }));
                                          setSummaryPrintPreviewOpen(true);
                                        }}
                                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[#171717]/15 bg-white hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium transition-colors cursor-pointer"
                                      >
                                        <Printer size={14} strokeWidth={1.5} />
                                        <span>집계출력</span>
                                      </button>
                                    </div>
                                  </div>

                                  {isTabletOrMobile ? (
                                    <ScoreCardView
                                      players={filterdPlayers}
                                      judges={judges}
                                    />
                                  ) : (
                                    <div className="overflow-x-auto rounded-[8px] border border-[#171717]/[0.08]">
                                      <table className="w-full border-collapse text-sm">
                                        <thead>
                                          <tr className="bg-[#f4f4f5] border-b border-[#171717]/[0.08]">
                                            <th className="sticky left-0 z-10 bg-[#f4f4f5] px-3.5 py-2.5 text-left text-xs font-medium text-[#525252] border-r border-[#171717]/[0.08] w-[108px] whitespace-nowrap">
                                              선수번호
                                            </th>
                                            {judges.map((judge, jIdx) => (
                                              <th
                                                key={`judge-${jIdx}`}
                                                className="px-3 py-2.5 text-center text-xs font-medium text-[#525252] min-w-[84px] whitespace-nowrap"
                                              >
                                                <span className="font-mono tabular-nums">
                                                  {judge.seatIndex}
                                                </span>
                                                번
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#171717]/[0.06] bg-white">
                                          {filterdPlayers.map(
                                            (player, pIdx) => (
                                              <tr
                                                key={player.playerUid || pIdx}
                                                className="hover:bg-[#fafafa] transition-colors"
                                              >
                                                <td className="sticky left-0 z-10 bg-white px-3.5 py-2.5 border-r border-[#171717]/[0.08] whitespace-nowrap">
                                                  <BibTag
                                                    number={player.playerNumber}
                                                    size="md"
                                                  />
                                                </td>
                                                {judges.map((judge, jIdx) => {
                                                  const finded =
                                                    normalScoreData.find(
                                                      (f) =>
                                                        f.playerNumber ===
                                                          player.playerNumber &&
                                                        f.seatIndex ===
                                                          judge.seatIndex
                                                    );

                                                  let content = (
                                                    <span className="font-mono tabular-nums text-[#737373]">
                                                      -
                                                    </span>
                                                  );
                                                  if (
                                                    finded?.playerScore >= 1000
                                                  ) {
                                                    content = (
                                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#737373] text-[11px] font-medium">
                                                        순위제외
                                                      </span>
                                                    );
                                                  } else if (
                                                    finded?.playerScore !== 0 &&
                                                    finded?.playerScore !==
                                                      undefined &&
                                                    finded?.playerScore !== null
                                                  ) {
                                                    content = (
                                                      <span className="font-mono font-medium tabular-nums text-[#171717]">
                                                        {finded.playerScore}
                                                      </span>
                                                    );
                                                  }

                                                  return (
                                                    <td
                                                      key={`score-${pIdx}-${jIdx}`}
                                                      className="px-3 py-2.5 text-center whitespace-nowrap"
                                                    >
                                                      {content}
                                                    </td>
                                                  );
                                                })}
                                              </tr>
                                            )
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-xs text-[#737373] py-4 text-center">
                              현재 배정된 체급이 없습니다.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <MonitoringBlockingState
                      variant="light"
                      screenType="basecamp"
                      screenLabel="본부석 현재 무대 모니터링"
                      contestInfo={contestInfo}
                      stagesCount={stagesArray.length}
                      playersCount={playersArray.length}
                      judgesAssignCount={judgesArray.length}
                      realtimeData={realtimeData}
                      emptyJudgeSeats={emptyJudgeSeatsForDiag}
                      onStartFirstStage={
                        stagesArray.length > 0
                          ? () => handleUpdateCurrentStage(0)
                          : null
                      }
                      onRefreshData={reloadBasecampData}
                    />
                  )}
                </>
              )}

              {/* 탭 1: 전체 무대목록 */}
              {currentSubTab === "1" && (
                <>
                  {stagesArray?.length > 0 ? (
                    isTabletOrMobile ? (
                      <StageCardView
                        stages={[...stagesArray].sort(
                          (a, b) => a.stageNumber - b.stageNumber
                        )}
                      />
                    ) : (
                      renderStageTable(
                        [...stagesArray].sort(
                          (a, b) => a.stageNumber - b.stageNumber
                        )
                      )
                    )
                  ) : (
                    <MonitoringBlockingState
                      variant="light"
                      screenType="basecamp"
                      screenLabel="본부석 전체 무대목록"
                      contestInfo={contestInfo}
                      stagesCount={stagesArray.length}
                      playersCount={playersArray.length}
                      judgesAssignCount={judgesArray.length}
                      realtimeData={realtimeData}
                      emptyJudgeSeats={emptyJudgeSeatsForDiag}
                      onRefreshData={reloadBasecampData}
                    />
                  )}
                </>
              )}

              {/* 탭 2: 섹션별 한눈에 보기 */}
              {currentSubTab === "2" && (
                <>
                  {sectionsWithOrder.length > 0 ? (
                    <div className="space-y-6">
                      <div className="overflow-x-auto pb-2">
                        <div className="flex gap-2.5 min-w-max">
                          {sectionsWithOrder.map(({ section, items }, idx) => {
                            const isCurrent = section === currentSectionKey;
                            const isUpcoming = section === upcomingSectionKey;
                            const isLast = idx === sectionsWithOrder.length - 1;
                            const totalStages = items.length;
                            const firstNo = items[0]?.stageNumber ?? "-";
                            const lastNo =
                              items[items.length - 1]?.stageNumber ?? "-";

                            return (
                              <div
                                key={String(section)}
                                onClick={() => scrollToSectionTable(section)}
                                className={`p-3.5 rounded-[10px] border cursor-pointer select-none transition-colors min-w-[152px] ${
                                  isCurrent
                                    ? "bg-[#16a34a]/[0.05] border-[#16a34a]/50"
                                    : isUpcoming
                                    ? "bg-[#2563eb]/[0.05] border-[#2563eb]/50"
                                    : "bg-white border-[#171717]/10 hover:bg-[#fafafa]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-xs text-[#737373]">
                                    섹션
                                  </span>
                                  {(isCurrent || isUpcoming) && (
                                    <StatusDot
                                      status={isCurrent ? "live" : "active"}
                                      live={isCurrent}
                                    />
                                  )}
                                </div>
                                <div className="text-base font-semibold text-[#171717] mb-1 truncate">
                                  {String(section)}
                                </div>
                                <div className="text-xs font-mono tabular-nums text-[#525252] mb-2">
                                  #{firstNo} – #{lastNo}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/10 text-[11px] font-mono tabular-nums text-[#525252]">
                                    {totalStages}개
                                  </span>
                                  {isCurrent && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#16a34a]/10 text-[#16a34a] text-[11px] font-medium">
                                      현재
                                    </span>
                                  )}
                                  {isUpcoming && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#2563eb]/10 text-[#2563eb] text-[11px] font-medium">
                                      다음
                                    </span>
                                  )}
                                  {isLast && isCurrent && !isUpcoming && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#525252] text-[11px] font-medium">
                                      마지막
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {sectionsWithOrder.map(({ section, items }, idx) => {
                        const isCurrent = section === currentSectionKey;
                        const isUpcoming = section === upcomingSectionKey;
                        const isLast = idx === sectionsWithOrder.length - 1;

                        return (
                          <div
                            key={String(section)}
                            data-section-anchor={section}
                            style={{ scrollMarginTop: 80 }}
                            className="rounded-[10px] border border-[#171717]/[0.08] overflow-hidden"
                          >
                            <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#f4f4f5] border-b border-[#171717]/[0.08]">
                              <span className="text-sm font-semibold text-[#171717]">
                                섹션: {String(section)}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-white border border-[#171717]/10 text-xs font-mono tabular-nums text-[#525252]">
                                {items.length}개 무대
                              </span>
                              {isCurrent && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#16a34a]/10 text-[#16a34a] text-xs font-medium">
                                  <StatusDot status="live" live />
                                  <span>현재 섹션</span>
                                </span>
                              )}
                              {isUpcoming && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#2563eb]/10 text-[#2563eb] text-xs font-medium">
                                  <StatusDot status="active" />
                                  <span>다가올 섹션</span>
                                </span>
                              )}
                              {isLast && isCurrent && !isUpcoming && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-white border border-[#171717]/10 text-xs font-medium text-[#525252]">
                                  마지막 섹션
                                </span>
                              )}
                            </div>

                            <div className="p-4 bg-white">
                              {isTabletOrMobile ? (
                                <StageCardView stages={items} />
                              ) : (
                                renderStageTable(items)
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-[#737373] py-6 text-center">
                      표시할 섹션이 없습니다.
                    </div>
                  )}
                </>
              )}

              {/* 탭 3: 섹션별 탭 */}
              {currentSubTab === "3" && (
                <>
                  {sectionsWithOrder.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-1.5 flex-wrap pb-3 border-b border-[#171717]/[0.08]">
                        {sectionsWithOrder.map(({ section, items }, idx) => {
                          const keyStr = String(section);
                          const isSelected =
                            selectedSectionTab === keyStr ||
                            (!selectedSectionTab && idx === 0);
                          const isCurrent = section === currentSectionKey;
                          const isUpcoming = section === upcomingSectionKey;

                          return (
                            <button
                              key={keyStr}
                              type="button"
                              onClick={() => setSelectedSectionTab(keyStr)}
                              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] text-xs font-medium border transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-[#2563eb] text-white border-[#2563eb]"
                                  : "bg-[#f4f4f5] hover:bg-[#e4e4e7]/70 text-[#171717] border-[#171717]/[0.08]"
                              }`}
                            >
                              {isCurrent && (
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    isSelected ? "bg-white" : "bg-[#16a34a]"
                                  }`}
                                />
                              )}
                              <span>{keyStr}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded-[4px] text-[11px] font-mono tabular-nums ${
                                  isSelected
                                    ? "bg-white/20 text-white"
                                    : "bg-white text-[#525252]"
                                }`}
                              >
                                {items.length}
                              </span>
                              {!isSelected && isUpcoming && (
                                <span className="text-[10px] text-[#2563eb]">
                                  다음
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {(() => {
                        const activeSection =
                          sectionsWithOrder.find(
                            (s) => String(s.section) === selectedSectionTab
                          ) || sectionsWithOrder[0];

                        if (!activeSection) return null;

                        return isTabletOrMobile ? (
                          <StageCardView stages={activeSection.items} />
                        ) : (
                          renderStageTable(activeSection.items)
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="text-xs text-[#737373] py-6 text-center">
                      표시할 섹션이 없습니다.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </BasecampErrorBoundary>
  );
};

export default ContestMonitoringBasecamp;
