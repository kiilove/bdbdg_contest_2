"use client";

import { useCallback, useState, useEffect, useContext, useRef } from "react";
import _ from "lodash";
import LoadingPage from "./LoadingPage";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirebaseRealtimeAddData,
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import { useNavigate } from "react-router-dom";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { Modal } from "@mui/material";
import CompareSetting from "../modals/CompareSetting";
import ContestRankingSummary from "../modals/ContestRankingSummary";
import ContestPointSummary from "../modals/ContestPointSummary";
import dayjs from "dayjs";
import { where } from "firebase/firestore";
import { Card, Button, Badge, Space, Table, Tag, Descriptions } from "antd";
import {
  TrophyOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  CameraOutlined,
} from "@ant-design/icons";
import html2canvas from "html2canvas";

const ContestMonitoringJudgeHead = ({ isHolding, setIsHolding }) => {
  const navigate = useNavigate();
  const { currentContest } = useContext(CurrentContestContext);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [compareMode, setCompareMode] = useState({
    isCompare: false,
    compareStart: false,
    compareEnd: false,
    compareCancel: false,
  });

  const [isLoading, setIsLoading] = useState(true);

  const [contestInfo, setContestInfo] = useState({});

  const [parentRefresh, setParentRefresh] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [compareCancelMsgOpen, setCompareCancelMsgOpen] = useState(false);
  const [rankingSummaryOpen, setRankingSummaryOpen] = useState(false);
  const [rankingSummaryProp, setRankingSummaryProp] = useState({});
  const [pointSummaryOpen, setPointSummaryOpen] = useState(false);
  const [pointSummaryProp, setPointSummaryProp] = useState({});
  const [message, setMessage] = useState({});

  // 🔥 채점 완료 강력 알럿 모달 상태
  const [urgentModalOpen, setUrgentModalOpen] = useState(false);
  const [urgentGradeInfo, setUrgentGradeInfo] = useState(null);

  // 🔔 브라우저 내장 Web Audio 알림음 재생
  const playChimeSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // 1st note (587Hz - D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // 2nd note (880Hz - A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.2);
      gain2.gain.setValueAtTime(0.3, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.8);
    } catch (e) {
      console.warn("Audio playback not allowed:", e);
    }
  };

  // 📷 집계상황 캡처 중복 방지 ref
  const hasCapturedRef = useRef({});

  // 📸 집계표 영역 자동 캡처 및 이미지 다운로드 함수
  const captureScoreTable = async (gradeId, categoryTitle, gradeTitle) => {
    try {
      const element = document.getElementById(`score-table-card-${gradeId}`);
      if (!element) {
        console.warn(`Element #score-table-card-${gradeId} not found`);
        return;
      }

      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2, // 2배 고화질 캡처
        useCORS: true,
        logging: false,
      });

      const now = dayjs().format("YYYYMMDD_HHmmss");
      const rawContestTitle =
        contestInfo?.contestTitle ||
        currentContest?.contestInfo?.contestTitle ||
        currentContest?.contests?.contestTitle ||
        "대회";

      const cleanContest = rawContestTitle
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim();
      const cleanCategory = (categoryTitle || "종목")
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim();
      const cleanGrade = (gradeTitle || "체급")
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim();
      const fileName = `${cleanContest}_${cleanCategory}_${cleanGrade}_${now}.png`;

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log(`📸 집계상황 캡처 다운로드 완료: ${fileName}`);
        }
      });
    } catch (error) {
      console.error("화면 캡처 실패:", error);
    }
  };

  const [compareOpen, setCompareOpen] = useState(false);
  const [compareInfo, setCompareInfo] = useState({
    playerLength: undefined,
    scoreMode: undefined,
  });
  const [stagesArray, setStagesArray] = useState([]);
  const [playersArray, setPlayersArray] = useState([]);
  const [comparesList, setComparesList] = useState({});
  const [comparesArray, setComparesArray] = useState([]);
  const [currentCompareInfo, setCurrentCompareInfo] = useState({});
  const [matchedOriginalPlayers, setMatchedOriginalPlayers] = useState([]);
  const [currentStageInfo, setCurrentStageInfo] = useState({ stageId: null });
  const [prevRealtimeData, setPrevRealtimeData] = useState({});
  const [compareStatus, setCompareStatus] = useState({
    compareStart: false,
    compareEnd: false,
    compareCancel: false,
    compareIng: false,
  });
  const [normalScoreData, setNormalScoreData] = useState([]);
  const [normalScoreTable, setNormalScoreTable] = useState([]);
  const [isMobile, setIsMobile] = useState(false);

  const fetchNotice = useFirestoreGetDocument("contest_notice");
  const fetchStages = useFirestoreGetDocument("contest_stages_assign");
  const fetchFinalPlayers = useFirestoreGetDocument("contest_players_final");
  const fetchCompares = useFirestoreGetDocument("contest_compares_list");
  const updateCompare = useFirestoreUpdateData("contest_compares_list");
  const fetchScoreCardQuery = useFirestoreQuery();

  // 개선된 훅 사용 (onValue 활용)
  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    currentContest?.contests?.id
      ? `currentStage/${currentContest.contests.id}`
      : null
  );

  const addCurrentStage = useFirebaseRealtimeAddData();
  const updateRealtimeCompare = useFirebaseRealtimeUpdateData();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchPool = async (
    noticeId,
    stageAssignId,
    playerFinalId,
    compareListId
  ) => {
    try {
      const returnNotice = await fetchNotice.getDocument(noticeId);
      const returnContestStage = await fetchStages.getDocument(stageAssignId);
      const returnPlayersFinal = await fetchFinalPlayers.getDocument(
        playerFinalId
      );
      const returnCompareList = await fetchCompares.getDocument(compareListId);
      console.log(returnCompareList);

      if (returnNotice && returnContestStage) {
        const promises = [
          setStagesArray(
            returnContestStage.stages.sort(
              (a, b) => a.stageNumber - b.stageNumber
            )
          ),
          setContestInfo({ ...returnNotice }),
          setPlayersArray(
            returnPlayersFinal.players
              .sort((a, b) => a.playerIndex - b.playerIndex)
              .filter((f) => f.playerNoShow === false)
          ),
        ];

        Promise.all(promises);

        setIsLoading(false);
      }

      if (returnCompareList) {
        setComparesList({ ...returnCompareList });
        setComparesArray([...returnCompareList.compares]);
      }

      if (returnCompareList?.compares?.length === 0) {
        setCurrentCompareInfo({});
      }

      // if (returnCompareList) {
      //   console.log(returnCompareList);
      //   console.log("stage", currentStageId);
      //   // 원본 compare 리스트 저장 (Firestore 데이터 그대로)
      //   setComparesList({ ...returnCompareList });

      //   const currentContestId = currentContest?.contests?.id;
      //   const currentStageId = realtimeData?.stageId;
      //   console.log(currentContestId);

      //   // 현재 스테이지 정보 찾기
      //   const currentStageFromAssign = (returnContestStage?.stages || []).find(
      //     (stage) => stage.stageId === currentStageId
      //   );

      //   const currentCategoryId = currentStageFromAssign?.categoryId;
      //   const currentGradeIds = (currentStageFromAssign?.grades || []).map(
      //     (g) => g.gradeId
      //   );

      //   console.log(currentContestId);
      //   // ✅ 현재 스테이지 조건에 맞는 compare만 필터
      //   const filtered = (returnCompareList?.compares || []).filter((c) => {
      //     if (!currentContestId) return false;
      //     if (c.contestId !== currentContestId) return false;
      //     if (currentCategoryId && c.categoryId !== currentCategoryId)
      //       return false;
      //     if (
      //       currentGradeIds.length > 0 &&
      //       !currentGradeIds.includes(c.gradeId)
      //     )
      //       return false;
      //     return true;
      //   });

      //   // ✅ 필터된 데이터만 화면 상태에 반영
      //   setComparesArray(filtered);
      //   setCurrentCompareInfo(
      //     filtered.length > 0 ? { ...filtered[filtered.length - 1] } : {}
      //   );
      // }
    } catch (error) {
      setMessage({
        body: "데이터를 로드하지 못했습니다.",
        body4: error.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  const fetchScoreTable = async (grades) => {
    if (!grades || grades.length === 0) return;

    const allData = [];

    for (const grade of grades) {
      const { gradeId } = grade;
      try {
        const condition = [where("gradeId", "==", gradeId)];
        const data = await fetchScoreCardQuery.getDocuments(
          contestInfo.contestCollectionName,
          condition
        );
        allData.push(...data);
      } catch (error) {
        console.log(error);
      }
    }

    setNormalScoreData(allData);
  };

  const handleJudgeIsLoginedValidated = (judgesArray) => {
    if (judgesArray?.length <= 0) {
      return;
    }
    const validate = judgesArray.some((s) => s.isLogined === false);
    return validate;
  };
  const handleForceScoreTableRefresh = (grades) => {
    if (grades?.length <= 0) {
      return;
    }

    fetchScoreTable(grades);
  };

  const handleScoreTableByJudge = (grades) => {
    if (!_.isEqual(realtimeData?.judges, prevRealtimeData?.judges)) {
      fetchScoreTable(grades);
    }
  };

  const handleGradeInfo = (grades) => {
    let gradeTitle = "";
    let gradeId = "";

    if (grades?.length === 0) {
      gradeTitle = "오류발생";
      gradeId = "";
    } else if (grades.length === 1) {
      gradeTitle = grades[0].gradeTitle;
      gradeId = grades[0].gradeId;
    } else if (grades.length > 1) {
      const madeTitle = grades.map((grade, gIdx) => {
        return grade.gradeTitle + " ";
      });
      gradeId = grades[0].gradeId;
      gradeTitle = madeTitle + "통합";
    }

    return { gradeTitle, gradeId };
  };

  const handleAddCurrentStage = async () => {
    const {
      stageId,
      stageNumber,
      categoryJudgeCount,
      categoryId,
      categoryTitle,
      grades,
    } = stagesArray[0];

    const { gradeTitle, gradeId } = handleGradeInfo(grades);

    const judgeInitState = Array.from(
      { length: categoryJudgeCount },
      (_, jIdx) => jIdx + 1
    ).map((number) => {
      return { seatIndex: number, isLogined: false, isEnd: false };
    });

    const newCurrentStateInfo = {
      stageId,
      stageNumber,
      categoryId,
      categoryTitle,
      gradeId,
      gradeTitle,
      stageJudgeCount: categoryJudgeCount,
      judges: judgeInitState,
    };
    try {
      await addCurrentStage.addData(
        "currentStage",
        newCurrentStateInfo,
        currentContest.contests.id
      );
    } catch (error) {
      console.log(error);
    }
  };

  const handleGotoSummary = (categoryId, categoryTitle, grades) => {
    navigate("/contestranksummary", {
      state: { categoryId, categoryTitle, grades },
    });
  };

  const handleCompareCancel = async (contestId, compareIndex) => {
    const collectionInfoByCompares = `currentStage/${contestId}/compares`;
    const newCompareArray = [...comparesArray];
    newCompareArray.splice(compareIndex, 1);
    let newRealtimeInfo = {
      status: {
        compareStart: false,
        compareEnd: false,
        compareCancel: false,
        compareIng: false,
      },
    };

    if (compareIndex > 0) {
      newRealtimeInfo = {
        compareIndex: comparesArray[compareIndex - 1].compareIndex,
        status: {
          compareStart: false,
          compareEnd: false,
          compareCancel: false,
          compareIng: true,
        },
        playerLength: comparesArray[compareIndex - 1].comparePlayerLength,
        scoreMode: comparesArray[compareIndex - 1].compareScoreMode,
        players: [...comparesArray[compareIndex - 1].players],
      };
    }

    try {
      await updateRealtimeCompare.updateData(collectionInfoByCompares, {
        ...newRealtimeInfo,
      });
      setCompareStatus(() => ({
        compareStart: false,
        compareEnd: false,
        compareCancel: true,
        compareIng: false,
      }));
      await updateCompare.updateData(comparesList.id, {
        ...comparesList,
        compares: [...newCompareArray],
      });
      setComparesList(() => ({
        ...comparesList,
        compares: [...newCompareArray],
      }));
      setComparesArray(() => [...newCompareArray]);
      setParentRefresh(true);
      setCompareCancelMsgOpen(false);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (
      currentContest?.contests?.contestNoticeId &&
      currentContest?.contests?.contestStagesAssignId &&
      currentContest?.contests?.contestPlayersFinalId &&
      currentContest?.contests?.contestComparesListId
    ) {
      fetchPool(
        currentContest.contests.contestNoticeId,
        currentContest.contests.contestStagesAssignId,
        currentContest?.contests?.contestPlayersFinalId,
        currentContest?.contests?.contestComparesListId
      );
    }
  }, [currentContest, realtimeData?.compares]);

  useEffect(() => {
    if (parentRefresh) {
      setIsLoading(true);
      fetchPool(
        currentContest.contests.contestNoticeId,
        currentContest.contests.contestStagesAssignId,
        currentContest?.contests?.contestPlayersFinalId,
        currentContest?.contests?.contestComparesListId
      );
      setParentRefresh(false);
    }
  }, [parentRefresh]);

  useEffect(() => {
    setCurrentStageInfo({
      ...stagesArray.find((f) => f.stageId === realtimeData?.stageId),
    });
  }, [realtimeData, stagesArray]);

  useEffect(() => {
    if (realtimeData?.judges) {
      setPrevRealtimeData(() => ({ ...realtimeData }));
    }

    if (
      realtimeData?.stageJudgeCount &&
      currentStageInfo?.grades?.length > 0 &&
      playersArray?.length > 0
    ) {
      handleScoreTableByJudge(currentStageInfo.grades);
      setMatchedOriginalPlayers(
        playersArray
          .filter(
            (f) => f.contestGradeId === currentStageInfo.grades[0].gradeId
          )
          .sort((a, b) => a.playerIndex - b.playerIndex)
      );
    }
  }, [realtimeData, currentStageInfo, playersArray]);

  useEffect(() => {
    if (compareMode.compareStart) {
      setCompareOpen(true);
    }
  }, [compareMode]);

  useEffect(() => {
    if (
      compareInfo.playerLength !== undefined &&
      compareInfo.scoreMode !== undefined
    ) {
      setCompareMode(() => ({
        compareIng: true,
        compareStart: true,
        compareEnd: false,
        compareCancel: false,
      }));
    }
  }, [compareInfo]);

  // 수동 갱신 함수
  const handleForceUpdate = useCallback(() => {
    if (currentContest?.contests?.id) {
      setLastUpdated(dayjs().format("YYYY-MM-DD HH:mm:ss"));
    }
    if (currentStageInfo?.grades) {
      handleForceScoreTableRefresh(currentStageInfo.grades);
    }
  }, [currentContest, currentStageInfo]);
  // ✅ 현재 스테이지(gradeId)와 일치하는 비교심사만 화면에 표시
  useEffect(() => {
    const currentStageId = realtimeData?.stageId;
    if (!currentStageId) {
      setComparesArray([]);
      setCurrentCompareInfo({});
      return;
    }

    if (comparesArray.length > 0) {
      const filterCurrentStageCompareInfo = comparesArray.filter(
        (f) =>
          f.categoryId === realtimeData.categoryId &&
          f.gradeId === realtimeData.gradeId
      );
      setCurrentCompareInfo({
        ...filterCurrentStageCompareInfo[
          filterCurrentStageCompareInfo?.length - 1
        ],
      });
    }

    const all = comparesList?.compares || [];
    // ✅ 이번 스테이지의 compare만 표시. stageId가 없는 예전 이력은 제외.
    const filtered = all.filter((c) => c.stageId === currentStageId);

    setComparesArray(filtered);
    setCurrentCompareInfo(
      filtered.length > 0 ? { ...filtered[filtered.length - 1] } : {}
    );
  }, [comparesList, realtimeData?.stageId]);

  const prevStageIdRef = useRef(null);

  const resetComparesForNewStage = async () => {
    try {
      // 너의 기존 경로 패턴 유지
      const path = `currentStage/${currentContest?.contests?.id}/compares`;
      await updateRealtimeCompare.updateData(path, {
        compareIndex: 0,
        status: {
          compareStart: false,
          compareEnd: false,
          compareCancel: false,
          compareIng: false,
        },
        playerLength: 0,
        scoreMode: null,
        players: [],
        confirmed: { count: 0, numbers: [] },
        judges: [],
      });
    } catch (e) {
      console.warn("스테이지 변경 시 비교 상태 리셋 실패:", e?.message);
    }
    // 로컬도 정리 (Firestore 이력은 건드리지 않음)
    setCompareMode({
      isCompare: false,
      compareStart: false,
      compareEnd: false,
      compareCancel: false,
    });
    setCompareStatus({
      compareStart: false,
      compareEnd: false,
      compareCancel: false,
      compareIng: false,
    });
    setCurrentCompareInfo({});
    setCompareOpen(false);
  };

  useEffect(() => {
    const currentStageId = realtimeData?.stageId || null;
    if (
      prevStageIdRef.current !== null &&
      currentStageId &&
      prevStageIdRef.current !== currentStageId
    ) {
      resetComparesForNewStage();
    }
    prevStageIdRef.current = currentStageId;
  }, [realtimeData?.stageId]);

  const hasAlertedRef = useRef({});
  const alertTimerRef = useRef(null);

  // 스테이지 변경 시 알럿 이력 및 타이머 초기화
  useEffect(() => {
    hasAlertedRef.current = {};
    hasCapturedRef.current = {};
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }
  }, [realtimeData?.stageId]);

  // 모든 심사위원 채점 완료 감지 및 자동 캡처 + 5초 후 순위확정 알럿 표시
  useEffect(() => {
    if (
      !currentStageInfo?.grades ||
      currentStageInfo.grades.length === 0 ||
      !realtimeData?.judges ||
      realtimeData.judges.length === 0 ||
      rankingSummaryOpen ||
      pointSummaryOpen
    ) {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }
      return;
    }

    const unconfirmedGrades = currentStageInfo.grades.filter(
      (g) => !(realtimeData?.resultSaved || []).includes(g.gradeId)
    );

    if (unconfirmedGrades.length === 0) {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }
      return;
    }

    // 미확정 체급 중 모든 선수의 모든 심판 점수가 채워진 체급 찾기
    const fullyScoredUnconfirmedGrade = unconfirmedGrades.find((grade) => {
      const filtered = playersArray.filter(
        (f) => f.contestGradeId === grade.gradeId && f.playerNoShow === false
      );

      if (filtered.length === 0) return false;

      const isComplete = filtered.every((player) =>
        realtimeData.judges.every((judge) => {
          const scoreEntry = normalScoreData.find(
            (f) =>
              f.playerNumber === player.playerNumber &&
              f.seatIndex === judge.seatIndex
          );
          return (
            scoreEntry &&
            scoreEntry.playerScore !== 0 &&
            scoreEntry.playerScore !== undefined &&
            scoreEntry.playerScore !== null
          );
        })
      );

      return isComplete;
    });

    if (fullyScoredUnconfirmedGrade) {
      // 📸 1. 점수 모두 들어왔을 때 자동으로 집계상황 카드 캡처 및 로컬 파일 저장 (1회)
      if (!hasCapturedRef.current[fullyScoredUnconfirmedGrade.gradeId]) {
        hasCapturedRef.current[fullyScoredUnconfirmedGrade.gradeId] = true;
        setTimeout(() => {
          captureScoreTable(
            fullyScoredUnconfirmedGrade.gradeId,
            fullyScoredUnconfirmedGrade.categoryTitle,
            fullyScoredUnconfirmedGrade.gradeTitle
          );
        }, 500);
      }

      // 🚨 2. 5초 후에도 순위확정을 안 누르면 강력 경고 알럿 모달 표시
      if (!alertTimerRef.current && !hasAlertedRef.current[fullyScoredUnconfirmedGrade.gradeId]) {
        alertTimerRef.current = setTimeout(() => {
          playChimeSound();
          setUrgentGradeInfo(fullyScoredUnconfirmedGrade);
          setUrgentModalOpen(true);
          hasAlertedRef.current[fullyScoredUnconfirmedGrade.gradeId] = true;
          alertTimerRef.current = null;
        }, 5000);
      }
    } else {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }
    }

    return () => {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }
    };
  }, [
    normalScoreData,
    currentStageInfo,
    realtimeData?.judges,
    realtimeData?.resultSaved,
    playersArray,
    rankingSummaryOpen,
    pointSummaryOpen,
  ]);

  useEffect(() => {
    console.log("현재체급 비교심사정보", currentCompareInfo);
  }, [currentCompareInfo]);

  return (
    <>
      {isLoading || realtimeLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage propStyles={{ width: "80", height: "60" }} />
        </div>
      ) : (
        <div className="flex flex-col w-full h-full bg-gray-50 rounded-lg p-4 gap-4">
          {/* 🔥 심판위원장 전용 강력한 순위확정 유도 모달 */}
          <Modal
            open={urgentModalOpen}
            onClose={() => setUrgentModalOpen(false)}
          >
            <div
              className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/70 backdrop-blur-sm"
              style={{ transform: "none" }}
            >
              <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border-4 border-red-500 overflow-hidden animate-bounce-short">
                {/* 상단 강렬한 그라디언트 배너 */}
                <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-6 text-white text-center relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 opacity-15 text-8xl select-none">
                    🏆
                  </div>
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-md mb-2 shadow-inner">
                    <span className="text-3xl animate-bounce">🚨</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white m-0">
                    심사위원 채점 완료!
                  </h2>
                  <p className="text-red-100 text-sm md:text-base mt-1 font-semibold">
                    순위표를 즉시 확인하고 확정해 주세요
                  </p>
                </div>

                {/* 본문 체급 정보 및 경고 문구 */}
                <div className="p-6 space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-inner">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      대기 중인 무대 체급
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <span className="px-3.5 py-1.5 bg-blue-600 text-white font-extrabold rounded-xl text-base shadow-sm">
                        {urgentGradeInfo?.categoryTitle}
                      </span>
                      <span className="px-3.5 py-1.5 bg-emerald-600 text-white font-extrabold rounded-xl text-base shadow-sm">
                        {urgentGradeInfo?.gradeTitle}
                      </span>
                    </div>
                  </div>

                  <div className="bg-amber-50 border-l-4 border-amber-500 p-3.5 rounded-r-xl">
                    <p className="text-amber-950 text-sm font-medium m-0 flex items-start gap-2">
                      <span className="text-lg leading-none">⚠️</span>
                      <span>
                        심사위원들의 채점이 모두 끝났습니다. 순위 확정을 완료해야 <strong>다음 무대 진행 및 결과 집계가 정상 진행</strong>됩니다.
                      </span>
                    </p>
                  </div>

                  {/* 원클릭 직행 액션 버튼 */}
                  <div className="pt-2 flex flex-col gap-3">
                    <button
                      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-lg md:text-xl shadow-xl shadow-blue-500/40 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
                      onClick={() => {
                        setUrgentModalOpen(false);
                        if (urgentGradeInfo?.categoryJudgeType === "point") {
                          setPointSummaryProp({
                            categoryId: urgentGradeInfo.categoryId,
                            gradeId: urgentGradeInfo.gradeId,
                            categoryJudgeType: urgentGradeInfo.categoryJudgeType,
                          });
                          setPointSummaryOpen(true);
                        } else {
                          setRankingSummaryProp({
                            categoryId: urgentGradeInfo.categoryId,
                            gradeId: urgentGradeInfo.gradeId,
                            categoryJudgeType: urgentGradeInfo.categoryJudgeType,
                          });
                          setRankingSummaryOpen(true);
                        }
                      }}
                    >
                      <span>🏆 지금 바로 순위표 확인 및 확정하기</span>
                      <span className="text-2xl">➔</span>
                    </button>

                    <button
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm transition-colors cursor-pointer border-none"
                      onClick={() => setUrgentModalOpen(false)}
                    >
                      창 닫기 (나중에 확인)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Modal>

          <ConfirmationModal
            isOpen={msgOpen}
            message={message}
            onCancel={() => setMsgOpen(false)}
            onConfirm={() => setMsgOpen(false)}
          />
          <ConfirmationModal
            isOpen={compareCancelMsgOpen}
            message={message}
            onCancel={() => setCompareCancelMsgOpen(false)}
            onConfirm={() =>
              handleCompareCancel(
                currentContest.contests.id,
                comparesArray?.length - 1
              )
            }
          />
          <Modal open={compareOpen} onClose={() => setCompareOpen(false)}>
            <CompareSetting
              stageInfo={currentStageInfo}
              setClose={setCompareOpen}
              matchedOriginalPlayers={matchedOriginalPlayers}
              setRefresh={setParentRefresh}
              propCompareIndex={comparesArray?.length + 1}
              handleCompareCancel={() =>
                handleCompareCancel(
                  currentContest.contests.id,
                  comparesArray?.length - 1
                )
              }
            />
          </Modal>
          <Modal open={rankingSummaryOpen}>
            <ContestRankingSummary
              categoryId={rankingSummaryProp?.categoryId}
              gradeId={rankingSummaryProp?.gradeId}
              stageId={realtimeData?.stageId}
              setClose={setRankingSummaryOpen}
              currentResultSaved={realtimeData?.resultSaved}
            />
          </Modal>
          <Modal open={pointSummaryOpen}>
            <ContestPointSummary
              categoryId={pointSummaryProp?.categoryId}
              gradeId={pointSummaryProp?.gradeId}
              stageId={realtimeData?.stageId}
              setClose={setPointSummaryOpen}
              currentResultSaved={realtimeData?.resultSaved}
            />
          </Modal>

          <Card className="shadow-sm">
            <Descriptions column={isMobile ? 1 : 2} bordered size="small">
              <Descriptions.Item label="대회명" span={isMobile ? 1 : 2}>
                <span className="font-semibold">
                  {contestInfo.contestTitle}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="현재 진행중인 무대">
                {realtimeData?.categoryTitle} / {realtimeData?.gradeTitle}
              </Descriptions.Item>
              {lastUpdated && (
                <Descriptions.Item label="마지막 확인">
                  <span className="text-gray-500 text-sm">{lastUpdated}</span>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {realtimeData && (
            <Card
              title={
                <Space>
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg"
                    style={{
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    }}
                  >
                    <TrophyOutlined className="text-white text-xl" />
                  </div>
                  <span className="text-lg font-semibold">비교심사</span>
                </Space>
              }
              className="shadow-sm"
            >
              {realtimeData.judges && comparesArray && (
                <div className="mb-4">
                  <Space
                    direction={isMobile ? "vertical" : "horizontal"}
                    className="w-full"
                    size="middle"
                  >
                    <Button
                      type="primary"
                      size="large"
                      icon={<PlayCircleOutlined />}
                      onClick={() =>
                        setCompareMode((prev) => ({
                          ...prev,
                          compareStart: true,
                        }))
                      }
                      className={isMobile ? "w-full" : ""}
                    >
                      {(comparesArray?.length ?? 0) + 1}차 비교심사 시작
                    </Button>
                    <Button
                      size="large"
                      icon={<SettingOutlined />}
                      onClick={() => setCompareOpen(true)}
                      className={isMobile ? "w-full" : ""}
                    >
                      비교심사 설정 보기
                    </Button>
                  </Space>
                </div>
              )}

              {currentCompareInfo?.players?.length > 0 && (
                <div className="flex flex-col gap-4">
                  <Card size="small" className="bg-blue-50">
                    <Space direction="vertical" className="w-full" size="small">
                      <div className="flex flex-wrap gap-2">
                        <Tag color="blue" className="text-base px-3 py-1">
                          {currentCompareInfo?.compareIndex}차 비교심사
                        </Tag>
                        <Tag color="cyan" className="text-base px-3 py-1">
                          선발인원: {currentCompareInfo?.comparePlayerLength}
                        </Tag>
                        <Tag color="purple" className="text-base px-3 py-1">
                          채점모드:{" "}
                          {currentCompareInfo?.compareScoreMode === "compare" ||
                          currentCompareInfo?.compareScoreMode === "topOnly"
                            ? "대상자만 채점"
                            : "전체 채점"}
                        </Tag>
                      </div>
                    </Space>
                  </Card>

                  {comparesArray?.length > 0 &&
                    comparesArray.map((compare, cIdx) => {
                      const { players, compareIndex } = compare;

                      return (
                        <Card key={cIdx} size="small">
                          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <Space wrap size="small">
                              {players?.map((top, tIdx) => (
                                <Badge
                                  key={tIdx}
                                  count={top.playerNumber}
                                  overflowCount={9999}
                                  style={{
                                    backgroundColor: "#1890ff",
                                    fontSize: "16px",
                                    minWidth: "48px",
                                    width: "auto",
                                    height: "48px",
                                    padding: "0 12px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                />
                              ))}
                            </Space>
                            {/* ✅ 필터된 목록 기준 마지막 compare만 취소 가능 */}
                            {cIdx === comparesArray.length - 1 && (
                              <Button
                                danger
                                icon={<CloseCircleOutlined />}
                                onClick={() => {
                                  setMessage({
                                    body: "비교심사를 취소하시겠습니까?",
                                    isButton: true,
                                    cancelButtonText: "아니오",
                                    confirmButtonText: "예",
                                  });
                                  setCompareCancelMsgOpen(true);
                                }}
                              >
                                {compareIndex}차 비교심사 취소
                              </Button>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                </div>
              )}
            </Card>
          )}

          {realtimeData && (
            <Card
              title={
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <Space>
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-lg"
                      style={{
                        background:
                          "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                      }}
                    >
                      <CheckCircleOutlined className="text-white text-xl" />
                    </div>
                    <span className="text-lg font-semibold">집계상황</span>
                  </Space>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() =>
                      handleForceScoreTableRefresh(currentStageInfo.grades)
                    }
                  >
                    새로고침
                  </Button>
                </div>
              }
              className="shadow-sm"
            >
              {currentStageInfo?.grades?.length > 0 &&
                currentStageInfo.grades.map((grade, gIdx) => {
                  const { categoryTitle, categoryId, gradeTitle, gradeId } =
                    grade;

                  const { categoryJudgeType } = currentStageInfo;

                  const filterdPlayers = playersArray
                    .filter(
                      (f) =>
                        f.contestGradeId === gradeId && f.playerNoShow === false
                    )
                    .sort((a, b) => a.playerIndex - b.playerIndex);

                  const columns = [
                    {
                      title: "선수번호",
                      dataIndex: "playerNumber",
                      key: "playerNumber",
                      width: 100,
                      fixed: isMobile ? false : "left",
                      render: (text) => (
                        <Badge
                          count={text}
                          overflowCount={9999}
                          style={{
                            backgroundColor: "#52c41a",
                            fontSize: "14px",
                          }}
                        />
                      ),
                    },
                    ...(realtimeData?.judges || []).map((judge, jIdx) => ({
                      title: `${judge.seatIndex}번 심판`,
                      dataIndex: `judge_${judge.seatIndex}`,
                      key: `judge_${judge.seatIndex}`,
                      width: 100,
                      align: "center",
                      render: (text, record) => {
                        const finded = normalScoreData.find(
                          (f) =>
                            f.playerNumber === record.playerNumber &&
                            f.seatIndex === judge.seatIndex
                        );

                        if (finded?.playerScore === 1000) {
                          return <Tag color="red">순위제외</Tag>;
                        }
                        if (
                          finded?.playerScore !== 0 &&
                          finded?.playerScore !== undefined
                        ) {
                          return (
                            <span className="font-semibold">
                              {finded.playerScore}
                            </span>
                          );
                        }
                        return <span className="text-gray-400">-</span>;
                      },
                    })),
                  ];

                  const dataSource = filterdPlayers.map((player, pIdx) => ({
                    key: pIdx,
                    playerNumber: player.playerNumber,
                  }));

                  const isAllScored =
                    filterdPlayers.length > 0 &&
                    (realtimeData?.judges || []).length > 0 &&
                    filterdPlayers.every((player) =>
                      (realtimeData?.judges || []).every((judge) => {
                        const scoreEntry = normalScoreData.find(
                          (f) =>
                            f.playerNumber === player.playerNumber &&
                            f.seatIndex === judge.seatIndex
                        );
                        return (
                          scoreEntry &&
                          scoreEntry.playerScore !== 0 &&
                          scoreEntry.playerScore !== undefined &&
                          scoreEntry.playerScore !== null
                        );
                      })
                    );

                  return (
                    <div
                      key={gIdx}
                      id={`score-table-card-${gradeId}`}
                      className="mb-6 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <span>🏆</span>
                            <span>
                              {contestInfo?.contestTitle ||
                                currentContest?.contestInfo?.contestTitle ||
                                currentContest?.contests?.contestTitle ||
                                "대회"}
                            </span>
                          </div>
                          <Space wrap>
                            <Tag color="blue" className="text-base font-bold px-3 py-1">
                              {categoryTitle}
                            </Tag>
                            <Tag color="cyan" className="text-base font-bold px-3 py-1">
                              {gradeTitle}
                            </Tag>
                          </Space>
                        </div>
                        <Space>
                          <Button
                            icon={<CameraOutlined />}
                            onClick={() =>
                              captureScoreTable(
                                gradeId,
                                categoryTitle,
                                gradeTitle
                              )
                            }
                          >
                            캡처
                          </Button>
                          {categoryJudgeType === "point" ? (
                            <Button
                              type={
                                (realtimeData?.resultSaved || []).includes(
                                  gradeId
                                )
                                  ? "default"
                                  : "primary"
                              }
                              danger={
                                isAllScored &&
                                !(realtimeData?.resultSaved || []).includes(
                                  gradeId
                                )
                              }
                              size="large"
                              icon={
                                isAllScored &&
                                !(realtimeData?.resultSaved || []).includes(
                                  gradeId
                                ) ? (
                                  <span className="animate-bounce">🚨</span>
                                ) : (
                                  <CheckCircleOutlined />
                                )
                              }
                              className={
                                (realtimeData?.resultSaved || []).includes(
                                  gradeId
                                )
                                  ? "font-medium text-slate-400"
                                  : isAllScored
                                  ? "animate-pulse font-black text-base shadow-xl shadow-red-500/40 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 text-white border-none transform hover:scale-105 transition-all cursor-pointer"
                                  : "font-semibold shadow-sm"
                              }
                              style={
                                isAllScored &&
                                !(realtimeData?.resultSaved || []).includes(
                                  gradeId
                                )
                                  ? {
                                      backgroundColor: "#dc2626",
                                      borderColor: "#dc2626",
                                      color: "#ffffff",
                                    }
                                  : {}
                              }
                              onClick={() => {
                                if (
                                  !(realtimeData?.resultSaved || []).includes(
                                    gradeId
                                  )
                                ) {
                                  setPointSummaryProp({
                                    categoryId,
                                    gradeId,
                                    categoryJudgeType,
                                  });
                                  setPointSummaryOpen(true);
                                }
                              }}
                              disabled={(
                                realtimeData?.resultSaved || []
                              ).includes(gradeId)}
                            >
                              {(realtimeData?.resultSaved || []).includes(
                                gradeId
                              )
                                ? "✅ 순위표 확정됨"
                                : isAllScored
                                ? "🚨 점수형 순위확정 (채점완료 - 클릭!)"
                                : "점수형 집계 및 순위확인"}
                            </Button>
                          ) : (
                            <Button
                              type={
                                (realtimeData?.resultSaved || []).includes(
                                  gradeId
                                )
                                  ? "default"
                                  : "primary"
                              }
                              size="large"
                              danger={
                                isAllScored &&
                                !(realtimeData?.resultSaved || []).includes(
                                  gradeId
                                )
                              }
                              icon={
                                isAllScored &&
                                !(realtimeData?.resultSaved || []).includes(
                                  gradeId
                                ) ? (
                                  <span className="animate-bounce">🚨</span>
                                ) : (
                                  <CheckCircleOutlined />
                                )
                              }
                              className={
                                (realtimeData?.resultSaved || []).includes(
                                  gradeId
                                )
                                  ? "font-medium text-slate-400"
                                  : isAllScored
                                  ? "animate-pulse font-black text-base shadow-xl shadow-red-500/40 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 text-white border-none transform hover:scale-105 transition-all cursor-pointer"
                                  : "font-semibold shadow-sm"
                              }
                              style={
                                isAllScored &&
                                !(realtimeData?.resultSaved || []).includes(
                                  gradeId
                                )
                                  ? {
                                      backgroundColor: "#dc2626",
                                      borderColor: "#dc2626",
                                      color: "#ffffff",
                                    }
                                  : {}
                              }
                              onClick={() => {
                                if (
                                  !(realtimeData?.resultSaved || []).includes(
                                    gradeId
                                  )
                                ) {
                                  setRankingSummaryProp({
                                    categoryId,
                                    gradeId,
                                    categoryJudgeType,
                                  });
                                  setRankingSummaryOpen(true);
                                }
                              }}
                              disabled={(
                                realtimeData?.resultSaved || []
                              ).includes(gradeId)}
                            >
                              {(realtimeData?.resultSaved || []).includes(
                                gradeId
                              )
                                ? "✅ 순위표 확정됨"
                                : isAllScored
                                ? "🚨 랭킹형 순위확정 (채점완료 - 클릭!)"
                                : "랭킹형 집계 및 순위확인"}
                            </Button>
                          )}
                        </Space>
                      </div>

                      <Table
                        columns={columns}
                        dataSource={dataSource}
                        pagination={false}
                        scroll={{ x: "max-content" }}
                        size="small"
                        bordered
                      />
                    </div>
                  );
                })}
            </Card>
          )}
        </div>
      )}
    </>
  );
};

export default ContestMonitoringJudgeHead;
