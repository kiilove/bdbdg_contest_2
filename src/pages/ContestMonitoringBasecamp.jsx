"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import _ from "lodash";
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
import { useNavigate } from "react-router-dom";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { Modal } from "@mui/material";
import ContestRankingSummaryPrintAll from "../modals/ContestRankingSummaryPrintAll";
import ContestAwardCreator from "./ContestAwardCreator";
import { useDevice } from "../contexts/DeviceContext";
import {
  Card,
  Button,
  Tabs,
  Table,
  Tag,
  Space,
  Typography,
  Spin,
  Divider,
} from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  TrophyOutlined,
  PrinterOutlined,
  EyeOutlined,
  CloseCircleOutlined,
  FastForwardOutlined,
  RedoOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { where } from "firebase/firestore";

const { Title, Text } = Typography;

const ContestMonitoringBasecamp = ({ isHolding, setIsHolding }) => {
  const navigate = useNavigate();
  const { currentContest } = useContext(CurrentContestContext);
  const { isTabletOrMobile } = useDevice();

  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [contestInfo, setContestInfo] = useState({});
  const [judgesIsEndValidated, setJudgesIsEndValidated] = useState(true);
  const [currentSubTab, setCurrentSubTab] = useState("0");

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [summaryPrintPreviewOpen, setSummaryPrintPreviewOpen] = useState(false);
  const [awardPrintPreviewOpen, setAwardPrintPreviewOpen] = useState(false);
  const [awardProp, setAwardProp] = useState({});
  const [summaryProp, setSummaryProp] = useState({});

  const [stagesArray, setStagesArray] = useState([]);
  const [playersArray, setPlayersArray] = useState([]);
  const [judgesArray, setJudgesArray] = useState([]);
  const [currentStageInfo, setCurrentStageInfo] = useState({ stageId: null });
  const [prevRealtimeData, setPrevRealtimeData] = useState({});

  const [normalScoreData, setNormalScoreData] = useState([]);

  const fetchNotice = useFirestoreGetDocument("contest_notice");
  const fetchStages = useFirestoreGetDocument("contest_stages_assign");
  const fetchJudgesAssign = useFirestoreGetDocument("contest_judges_assign");
  const fetchFinalPlayers = useFirestoreGetDocument("contest_players_final");
  const fetchScoreCardQuery = useFirestoreQuery();
  const fetchResultQuery = useFirestoreQuery();

  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
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
      const returnNotice = await fetchNotice.getDocument(noticeId);
      const returnContestStage = await fetchStages.getDocument(stageAssignId);
      const returnPlayersFinal = await fetchFinalPlayers.getDocument(
        playerFinalId
      );
      const returnJudgesAssign = await fetchJudgesAssign.getDocument(
        judgeAssignId
      );

      if (returnNotice && returnContestStage && returnJudgesAssign) {
        setStagesArray(
          returnContestStage.stages.sort(
            (a, b) => a.stageNumber - b.stageNumber
          )
        );
        setContestInfo({ ...returnNotice });
        setPlayersArray(
          returnPlayersFinal.players
            .sort((a, b) => a.playerIndex - b.playerIndex)
            .filter((f) => f.playerNoShow === false)
        );
        setJudgesArray(returnJudgesAssign?.judges || []);
        setIsLoading(false);
      }
    } catch (error) {
      setMessage({
        body: "데이터를 로드하지 못했습니다.",
        body4: error.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  const fetchResultAndScoreBoard = async (gradeId, gradeTitle) => {
    const condition = [where("gradeId", "==", gradeId)];
    try {
      const data = await fetchResultQuery.getDocuments(
        "contest_results_list",
        condition
      );

      if (data?.length === 0) {
        window.alert("데이터가 없습니다.");
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
    setIsLoading(false);
  };

  const handleForceScoreTableRefresh = (grades) => {
    if (grades?.length <= 0) return;
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
    let matchedJudgesCount = 0;
    let matchedPlayersCount = 0;
    let matchedJudgeAssignCount = 0;

    if (grades?.length === 0) {
      gradeTitle = "오류발생";
      gradeId = "";
    }
    if (grades.length === 1) {
      gradeTitle = grades[0].gradeTitle;
      gradeId = grades[0].gradeId;
      matchedJudgesCount = grades[0].categoryJudgeCount;
      matchedJudgeAssignCount = judgesArray.filter(
        (f) => f.contestGradeId === gradeId
      ).length;
      matchedPlayersCount = grades[0].playerCount;
    } else if (grades.length > 1) {
      const madeTitle = grades.map((grade) => grade.gradeTitle + " ");
      matchedJudgesCount = grades[0].categoryJudgeCount;

      matchedJudgeAssignCount = judgesArray.filter(
        (f) => f.contestGradeId === grades[0].gradeId
      ).length;
      grades.forEach((grade) => {
        matchedPlayersCount += Number.parseInt(grade.playerCount);
      });
      gradeId = grades[0].gradeId;
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
    const {
      stageId,
      stageNumber,
      categoryJudgeCount,
      categoryJudgeType,
      categoryId,
      categoryTitle,
      grades,
    } = stagesArray[currentStageId] || {};

    const { gradeTitle, gradeId } = handleGradeInfo(grades);

    const judgeInitState = Array.from(
      { length: categoryJudgeCount },
      (_, jIdx) => {
        const seat = jIdx + 1;
        const assigned = (judgesArray || []).find(
          (j) => j?.contestGradeId === gradeId && Number(j?.seatIndex) === seat
        );
        return {
          seatIndex: seat,
          isLogined: false,
          isEnd: false,
          judgeName: assigned?.judgeName ?? null,
          judgeUid: assigned?.judgeUid ?? null,
          onedayPassword: assigned?.onedayPassword ?? null,
        };
      }
    );

    await deleteCompare.deleteData(
      `currentStage/${currentContest.contests.id}/compares`
    );

    const newCurrentStateInfo = {
      stageId,
      stageNumber,
      categoryId,
      categoryTitle,
      categoryJudgeType,
      gradeId,
      gradeTitle,
      stageJudgeCount: categoryJudgeCount,
      judges: judgeInitState,
      resultSaved: [],
      compares: {
        status: {
          compareStart: false,
          compareEnd: false,
          compareCancel: false,
          compareIng: false,
        },
        confirmed: { count: 0, numbers: [] },
      },
      screen: { status: { playStart: false }, players: [] },
    };

    const collectionInfo = `currentStage/${currentContest.contests.id}`;

    try {
      await updateCurrentStage.updateData(collectionInfo, {
        ...newCurrentStateInfo,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleJudgeIsEndValidated = (judgesArray) => {
    if (judgesArray?.length <= 0) return;
    handleScoreTableByJudge(currentStageInfo.grades);
    const validate = judgesArray.some((s) => s.isEnd === false);
    return validate;
  };

  useEffect(() => {
    if (
      currentContest?.contests?.contestNoticeId &&
      currentContest?.contests?.contestStagesAssignId &&
      currentContest?.contests?.contestPlayersFinalId &&
      currentContest?.contests?.contestJudgesAssignId
    ) {
      fetchPool(
        currentContest.contests.contestNoticeId,
        currentContest.contests.contestStagesAssignId,
        currentContest?.contests?.contestPlayersFinalId,
        currentContest?.contests?.contestJudgesAssignId
      );
    }
  }, [currentContest]);

  useEffect(() => {
    setCurrentStageInfo({
      ...stagesArray.find((f) => f.stageId === realtimeData?.stageId),
    });
    if (realtimeData?.judges?.length > 0) {
      setJudgesIsEndValidated(() =>
        handleJudgeIsEndValidated(realtimeData?.judges)
      );
    }
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
    }
  }, [realtimeData, playersArray, currentStageInfo]);

  const JudgeCardView = ({ judges }) => {
    return (
      <div className="space-y-3">
        {judges?.map((judge, index) => {
          const {
            isEnd,
            isLogined,
            seatIndex,
            judgeName,
            judgeUid,
            onedayPassword,
          } = judge;
          let statusColor = "default";
          let statusText = "로그인대기";

          if (isEnd && isLogined) {
            statusColor = "success";
            statusText = "심사종료";
          } else if (!isEnd && isLogined) {
            statusColor = "processing";
            statusText = "심사중";
          }

          return (
            <Card key={index} size="small" className="shadow-sm">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Text strong className="text-base">
                      {seatIndex}번 심판석
                    </Text>
                    <Tag color={statusColor}>{statusText}</Tag>
                  </div>

                  {judgeName ? (
                    <div className="flex flex-col">
                      <Text strong>{judgeName}</Text>
                      {judgeUid && (
                        <Text type="secondary" className="text-xs">
                          {judgeUid} / {onedayPassword}
                        </Text>
                      )}
                    </div>
                  ) : (
                    <Text type="secondary">정보 없음</Text>
                  )}
                </div>

                <Button
                  size="small"
                  icon={<RedoOutlined />}
                  onClick={() =>
                    handleForceReStart(index, currentContest.contests.id)
                  }
                >
                  재시작
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const StageCardView = ({ stages }) => (
    <div className="space-y-3">
      {stages?.map((stage, index) => {
        const {
          categoryTitle,
          grades,
          categoryJudgeType,
          stageId,
          stageNumber,
        } = stage;
        const gradeTitle = handleGradeInfo(grades).gradeTitle;
        const playersCount = handleGradeInfo(grades).matchedPlayersCount;
        const judgesAssignCount =
          handleGradeInfo(grades).matchedJudgeAssignCount;
        const isCurrentStage = realtimeData?.stageId === stageId;

        return (
          <Card key={stageId} size="small" className="shadow-sm">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Text strong className="text-base">
                      {stageNumber}. {categoryTitle}
                    </Text>
                    <Tag
                      color={categoryJudgeType === "point" ? "blue" : "green"}
                    >
                      {categoryJudgeType === "point" ? "P" : "R"}
                    </Tag>
                    {isCurrentStage && (
                      <Tag icon={<Spin size="small" />} color="processing">
                        진행중
                      </Tag>
                    )}
                  </div>
                  <Text type="secondary" className="text-sm block mb-1">
                    {gradeTitle}
                  </Text>
                  <Text type="secondary" className="text-xs">
                    출전: {playersCount}명 | 심판: {judgesAssignCount}명
                  </Text>
                </div>
                <Button
                  type={isCurrentStage ? "default" : "primary"}
                  icon={
                    isCurrentStage ? <RedoOutlined /> : <PlayCircleOutlined />
                  }
                  onClick={() => handleUpdateCurrentStage(index)}
                  size="small"
                >
                  {isCurrentStage ? "재시작" : "시작"}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );

  const ScoreCardView = ({ players, judges }) => (
    <div className="space-y-3">
      {players?.map((player, pIdx) => {
        const playerNumber = player.playerNumber;

        return (
          <Card key={pIdx} size="small" className="shadow-sm">
            <div className="space-y-2">
              <Text strong className="text-base block">
                선수번호: {playerNumber}
              </Text>
              <Divider className="my-2" />
              <div className="grid grid-cols-2 gap-2">
                {judges?.map((judge, jIdx) => {
                  const finded = normalScoreData.find(
                    (f) =>
                      f.playerNumber === playerNumber &&
                      f.seatIndex === judge.seatIndex
                  );

                  let scoreDisplay = "-";
                  if (finded?.playerScore === 1000) {
                    scoreDisplay = <Tag color="error">순위제외</Tag>;
                  } else if (
                    finded?.playerScore !== 0 &&
                    finded?.playerScore !== undefined
                  ) {
                    scoreDisplay = (
                      <Text strong className="text-base">
                        {finded.playerScore}
                      </Text>
                    );
                  } else {
                    scoreDisplay = <Text type="secondary">-</Text>;
                  }

                  return (
                    <div
                      key={jIdx}
                      className="flex justify-between items-center p-2 bg-gray-50 rounded"
                    >
                      <Text type="secondary" className="text-sm">
                        {judge.seatIndex}번
                      </Text>
                      {scoreDisplay}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );

  const judgeColumns = [
    {
      title: "심판석",
      dataIndex: "seatIndex",
      key: "seatIndex",
      align: "center",
      width: isTabletOrMobile ? 80 : 100,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "심판정보",
      dataIndex: "judgeInfo",
      key: "judgeInfo",
      align: "center",
      render: (_, record) => {
        if (record?.judgeName) {
          return (
            <div className="flex flex-col items-center">
              <Text strong>{record.judgeName}</Text>
              {record?.judgeUid && (
                <Text type="secondary" className="text-xs">
                  {record.judgeUid} / {record.onedayPassword}
                </Text>
              )}
            </div>
          );
        }
        return <Text type="secondary">정보 없음</Text>;
      },
    },
    {
      title: "상태",
      dataIndex: "status",
      key: "status",
      align: "center",
      render: (_, record) => {
        const { isEnd, isLogined } = record;
        if (isEnd && isLogined) return <Tag color="success">심사종료</Tag>;
        if (!isEnd && isLogined) return <Tag color="processing">심사중</Tag>;
        return <Tag color="default">로그인대기</Tag>;
      },
    },
    {
      title: "관리",
      key: "action",
      align: "center",
      render: (_, record, index) => (
        <Button
          size="small"
          icon={<RedoOutlined />}
          onClick={() => handleForceReStart(index, currentContest.contests.id)}
        >
          강제 재시작
        </Button>
      ),
    },
  ];

  const stageColumns = [
    {
      title: "순서",
      dataIndex: "stageNumber",
      key: "stageNumber",
      align: "center",
      width: 80,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "종목 정보",
      key: "info",
      render: (_, record) => {
        const { categoryTitle, grades, categoryJudgeType, stageId } = record;
        const gradeTitle = handleGradeInfo(grades).gradeTitle;
        const playersCount = handleGradeInfo(grades).matchedPlayersCount;
        const judgesAssignCount =
          handleGradeInfo(grades).matchedJudgeAssignCount;

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Text strong className="text-base">
                {categoryTitle} ({gradeTitle})
              </Text>
              <Tag color={categoryJudgeType === "point" ? "blue" : "green"}>
                {categoryJudgeType === "point" ? "P" : "R"}
              </Tag>
              {realtimeData?.stageId === stageId && (
                <Tag icon={<Spin size="small" />} color="processing">
                  진행중
                </Tag>
              )}
            </div>
            <Text type="secondary" className="text-sm">
              출전인원: {playersCount}명 | 배정심판: {judgesAssignCount}명
            </Text>
          </div>
        );
      },
    },
    {
      title: "관리",
      key: "action",
      align: "center",
      width: isTabletOrMobile ? 120 : 150,
      render: (_, record, index) => {
        const isCurrentStage = realtimeData?.stageId === record.stageId;
        return (
          <Button
            type={isCurrentStage ? "default" : "primary"}
            icon={isCurrentStage ? <RedoOutlined /> : <PlayCircleOutlined />}
            onClick={() => handleUpdateCurrentStage(index)}
          >
            {isCurrentStage ? "재시작" : "시작"}
          </Button>
        );
      },
    },
  ];

  /** -----------------------------
   *  ✅ 섹션(=categorySection) 그룹핑 & 다가올 섹션 계산
   *  ----------------------------- */
  const sectionsWithOrder = useMemo(() => {
    // 섹션별로 모으되, 섹션의 "첫 stageNumber"로 정렬 기준을 만든다
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

    // 무조건 진행 순서(첫 무대 번호) 기준으로 정렬
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
    // 현재 섹션 다음 섹션
    return sectionsWithOrder[idx + 1]?.section ?? null;
  }, [currentSectionKey, sectionsWithOrder]);

  const scrollToSectionTable = (section) => {
    const el = document.querySelector(`[data-section-anchor="${section}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** ----------------------------- */

  return (
    <>
      {isLoading || realtimeLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage propStyles={{ width: "80", height: "60" }} />
        </div>
      ) : (
        <div className="flex flex-col w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 min-h-screen p-4 md:p-6">
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

          <Card className="mb-4 shadow-md">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1 space-y-2">
                <Title level={4} className="!mb-1">
                  {contestInfo.contestTitle}
                </Title>
                <div className="space-y-1">
                  <Text type="secondary" className="block text-sm">
                    채점표DB: {contestInfo.contestCollectionName}
                  </Text>
                  <div className="flex items-center gap-2">
                    <Text type="secondary" className="text-sm">
                      모니터링 상태:
                    </Text>
                    {realtimeData?.stageId && !isHolding && (
                      <Tag color="success" icon={<PlayCircleOutlined />}>
                        실시간 모니터링중
                      </Tag>
                    )}
                    {isHolding && (
                      <Tag color="warning" icon={<PauseCircleOutlined />}>
                        일시정지
                      </Tag>
                    )}
                    {!realtimeData?.stageId && !isHolding && (
                      <Tag color="default">대회 시작 전</Tag>
                    )}
                  </div>
                  {lastUpdated && (
                    <Text type="secondary" className="block text-xs">
                      마지막 업데이트: {lastUpdated}
                    </Text>
                  )}
                </div>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                {!isHolding && realtimeData?.stageId && (
                  <Button
                    size="large"
                    icon={<PauseCircleOutlined />}
                    onClick={() => {
                      setIsHolding(true);
                      setLastUpdated(new Date().toLocaleString("ko-KR"));
                    }}
                    className="flex-1 md:flex-none"
                  >
                    모니터링 일시정지
                  </Button>
                )}
                {isHolding && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlayCircleOutlined />}
                    onClick={() => setIsHolding(false)}
                    className="flex-1 md:flex-none"
                  >
                    모니터링 재개
                  </Button>
                )}
                {!realtimeData?.stageId && !isHolding && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleUpdateCurrentStage(0)}
                    className="flex-1 md:flex-none"
                  >
                    대회 시작
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card className="shadow-md">
            <Tabs
              activeKey={currentSubTab}
              onChange={setCurrentSubTab}
              items={[
                {
                  key: "0",
                  label: (
                    <span className="flex items-center gap-2">
                      <PlayCircleOutlined />
                      현재 무대상황
                    </span>
                  ),
                  children: realtimeData && (
                    <div className="space-y-4">
                      <Card
                        title={
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <Text strong>진행상황</Text>
                            {!judgesIsEndValidated && (
                              <Button
                                type="primary"
                                icon={<FastForwardOutlined />}
                                onClick={() =>
                                  handleUpdateCurrentStage(
                                    realtimeData.stageNumber
                                  )
                                }
                              >
                                다음 진행
                              </Button>
                            )}
                          </div>
                        }
                        className="shadow-sm"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Text strong className="text-lg">
                              {realtimeData?.categoryTitle} (
                              {realtimeData?.gradeTitle})
                            </Text>
                            <Tag
                              color={
                                stagesArray[realtimeData?.stageNumber - 1]
                                  ?.categoryJudgeType === "point"
                                  ? "blue"
                                  : "green"
                              }
                            >
                              {stagesArray[realtimeData?.stageNumber - 1]
                                ?.categoryJudgeType === "point"
                                ? "P"
                                : "R"}
                            </Tag>
                          </div>

                          {isTabletOrMobile ? (
                            <JudgeCardView judges={realtimeData?.judges} />
                          ) : (
                            <div className="overflow-x-auto">
                              <Table
                                columns={judgeColumns}
                                dataSource={realtimeData?.judges?.map(
                                  (judge, idx) => ({
                                    ...judge,
                                    key: idx,
                                    judgeInfo: {
                                      judgeName: judge.judgeName,
                                      judgeUid: judge.judgeUid,
                                      onedayPassword: judge.onedayPassword,
                                    },
                                  })
                                )}
                                pagination={false}
                                size="small"
                                bordered
                              />
                            </div>
                          )}
                        </div>
                      </Card>

                      <Card
                        title={
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <Text strong>집계상황</Text>
                            <Button
                              icon={<ReloadOutlined />}
                              onClick={() =>
                                handleForceScoreTableRefresh(
                                  currentStageInfo.grades
                                )
                              }
                              size={isTabletOrMobile ? "small" : "middle"}
                            >
                              새로고침
                            </Button>
                          </div>
                        }
                        className="shadow-sm"
                      >
                        {currentStageInfo?.grades?.length > 0 &&
                          currentStageInfo.grades.map((grade, gIdx) => {
                            const {
                              categoryTitle,
                              categoryJudgeType,
                              gradeTitle,
                              gradeId,
                            } = grade;
                            const filterdPlayers = playersArray
                              .filter(
                                (f) =>
                                  f.contestGradeId === gradeId &&
                                  f.playerNoShow === false
                              )
                              .sort((a, b) => a.playerIndex - b.playerIndex);

                            const scoreColumns = [
                              {
                                title: "선수번호",
                                dataIndex: "playerNumber",
                                key: "playerNumber",
                                align: "center",
                                width: 100,
                                fixed: isTabletOrMobile ? false : "left",
                                render: (text) => <Text strong>{text}</Text>,
                              },
                              ...(realtimeData?.judges || []).map(
                                (judge, jIdx) => ({
                                  title: `${judge.seatIndex}번`,
                                  key: `judge-${jIdx}`,
                                  align: "center",
                                  width: 100,
                                  render: (_, record) => {
                                    const finded = normalScoreData.find(
                                      (f) =>
                                        f.playerNumber ===
                                          record.playerNumber &&
                                        f.seatIndex === judge.seatIndex
                                    );
                                    if (
                                      finded?.playerScore !== 0 &&
                                      finded?.playerScore !== undefined &&
                                      finded?.playerScore !== 1000
                                    ) {
                                      return (
                                        <Text strong>{finded.playerScore}</Text>
                                      );
                                    }
                                    if (finded?.playerScore === 1000) {
                                      return <Tag color="error">순위제외</Tag>;
                                    }
                                    return <Text type="secondary">-</Text>;
                                  },
                                })
                              ),
                            ];

                            const scoreDataSource = filterdPlayers.map(
                              (player, pIdx) => ({
                                key: pIdx,
                                playerNumber: player.playerNumber,
                              })
                            );

                            return (
                              <div key={gIdx} className="mb-6 last:mb-0">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Text strong className="text-base">
                                      {categoryTitle} ({gradeTitle})
                                    </Text>
                                    {(realtimeData?.resultSaved || []).includes(
                                      gradeId
                                    ) && <Tag color="error">순위표 확정</Tag>}
                                  </div>

                                  <Space wrap size="small">
                                    <Button
                                      icon={<CloseCircleOutlined />}
                                      onClick={handleScreenEnd}
                                    >
                                      화면종료
                                    </Button>
                                    <Button
                                      type="primary"
                                      icon={<EyeOutlined />}
                                      onClick={() =>
                                        fetchResultAndScoreBoard(
                                          gradeId,
                                          gradeTitle
                                        )
                                      }
                                    >
                                      순위표공개
                                    </Button>
                                    <Button
                                      icon={<PrinterOutlined />}
                                      onClick={() => {
                                        setSummaryProp(() => ({
                                          contestId: currentContest.contests.id,
                                          gradeId,
                                          categoryTitle,
                                          gradeTitle,
                                          categoryJudgeType:
                                            currentStageInfo.categoryJudgeType,
                                        }));
                                        setSummaryPrintPreviewOpen(true);
                                      }}
                                    >
                                      집계출력
                                    </Button>
                                    {/* <Button
                                      size="small"
                                      icon={<TrophyOutlined />}
                                      onClick={() => {
                                        setAwardProp(() => ({
                                          contestId: currentContest.contests.id,
                                          gradeId,
                                          categoryTitle,
                                          gradeTitle,
                                          categoryJudgeType:
                                            currentStageInfo.categoryJudgeType,
                                        }));
                                        setAwardPrintPreviewOpen(true);
                                      }}
                                    >
                                      상장출력
                                    </Button> */}
                                  </Space>
                                </div>

                                {isTabletOrMobile ? (
                                  <ScoreCardView
                                    players={filterdPlayers}
                                    judges={realtimeData?.judges}
                                  />
                                ) : (
                                  <div className="overflow-x-auto">
                                    <Table
                                      columns={scoreColumns}
                                      dataSource={scoreDataSource}
                                      pagination={false}
                                      size="small"
                                      bordered
                                      scroll={{ x: "max-content" }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </Card>
                    </div>
                  ),
                },

                // ✅ 전체 무대목록 (아이콘 교체)
                {
                  key: "1",
                  label: (
                    <span className="flex items-center gap-2">
                      <UnorderedListOutlined />
                      전체 무대목록
                    </span>
                  ),
                  children:
                    realtimeData && stagesArray?.length > 0 ? (
                      <Card className="shadow-sm">
                        {isTabletOrMobile ? (
                          <StageCardView
                            stages={stagesArray.sort(
                              (a, b) => a.stageNumber - b.stageNumber
                            )}
                          />
                        ) : (
                          <div className="overflow-x-auto">
                            <Table
                              columns={stageColumns}
                              dataSource={stagesArray
                                .sort((a, b) => a.stageNumber - b.stageNumber)
                                .map((stage) => ({
                                  ...stage,
                                  key: stage.stageId,
                                }))}
                              pagination={false}
                              scroll={{ x: "max-content" }}
                            />
                          </div>
                        )}
                      </Card>
                    ) : null,
                },

                // ✅ 섹션별 한눈에 보기 (다가올 섹션 하이라이트)
                {
                  key: "2",
                  label: (
                    <span className="flex items-center gap-2">
                      <CalendarOutlined />
                      섹션별 한눈에 보기
                    </span>
                  ),
                  children:
                    sectionsWithOrder.length > 0 ? (
                      <div className="space-y-8">
                        {/* 상단 요약 바: 가로 스크롤, 다가올 섹션 강조 */}
                        <div className="overflow-x-auto pb-1">
                          <div className="flex gap-3 min-w-max">
                            {sectionsWithOrder.map(({ section, items }) => {
                              const isCurrent = section === currentSectionKey;
                              const isUpcoming = section === upcomingSectionKey;
                              const totalStages = items.length;
                              const firstNo = items[0]?.stageNumber ?? "-";
                              const lastNo =
                                items[items.length - 1]?.stageNumber ?? "-";
                              return (
                                <div
                                  key={String(section)}
                                  className={`p-4 rounded-xl shadow-sm border bg-white cursor-pointer select-none transition-all ${
                                    isUpcoming
                                      ? "border-blue-400 ring-2 ring-blue-200 animate-pulse"
                                      : isCurrent
                                      ? "border-green-400"
                                      : "border-gray-200"
                                  }`}
                                  onClick={() => scrollToSectionTable(section)}
                                  title={
                                    isUpcoming
                                      ? "다가올 섹션"
                                      : isCurrent
                                      ? "현재 섹션"
                                      : "섹션 이동"
                                  }
                                >
                                  <div className="text-sm text-gray-500">
                                    섹션
                                  </div>
                                  <div className="text-lg font-bold">
                                    {String(section)}
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    {firstNo} ~ {lastNo}번 무대
                                  </div>
                                  <div className="mt-1">
                                    <Tag
                                      color={isUpcoming ? "blue" : "default"}
                                    >
                                      {totalStages}개 무대
                                    </Tag>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 섹션별 표 모음 (앵커) */}
                        {sectionsWithOrder.map(({ section, items }) => (
                          <Card
                            key={String(section)}
                            className="shadow-sm"
                            title={
                              <div className="flex items-center gap-2">
                                <Text strong className="text-base">
                                  섹션: {String(section)}
                                </Text>
                                <Tag>{items.length}개 무대</Tag>
                                {section === currentSectionKey && (
                                  <Tag color="success">현재 섹션</Tag>
                                )}
                                {section === upcomingSectionKey && (
                                  <Tag color="blue">다가올 섹션</Tag>
                                )}
                              </div>
                            }
                            bodyStyle={{ scrollMarginTop: 80 }}
                            data-section-anchor={section}
                          >
                            <div className="overflow-x-auto">
                              <Table
                                columns={stageColumns}
                                dataSource={items.map((stage) => ({
                                  ...stage,
                                  key: stage.stageId,
                                }))}
                                pagination={false}
                                size="small"
                                scroll={{ x: "max-content" }}
                              />
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="shadow-sm">
                        <Text type="secondary">표시할 섹션이 없습니다.</Text>
                      </Card>
                    ),
                },

                // ✅ 섹션별 탭 보기
                {
                  key: "3",
                  label: (
                    <span className="flex items-center gap-2">
                      <AppstoreOutlined />
                      섹션별 탭
                    </span>
                  ),
                  children:
                    sectionsWithOrder.length > 0 ? (
                      <Card className="shadow-sm">
                        <Tabs
                          tabPosition="top"
                          items={sectionsWithOrder.map(
                            ({ section, items }) => ({
                              key: String(section),
                              label: (
                                <span className="flex items-center gap-2">
                                  {String(section)}
                                  <Tag>{items.length}</Tag>
                                  {section === currentSectionKey && (
                                    <Tag color="success">현재</Tag>
                                  )}
                                  {section === upcomingSectionKey && (
                                    <Tag color="blue">다가올</Tag>
                                  )}
                                </span>
                              ),
                              children: (
                                <div className="overflow-x-auto">
                                  <Table
                                    columns={stageColumns}
                                    dataSource={items.map((stage) => ({
                                      ...stage,
                                      key: stage.stageId,
                                    }))}
                                    pagination={false}
                                    size="small"
                                    scroll={{ x: "max-content" }}
                                  />
                                </div>
                              ),
                            })
                          )}
                        />
                      </Card>
                    ) : (
                      <Card className="shadow-sm">
                        <Text type="secondary">표시할 섹션이 없습니다.</Text>
                      </Card>
                    ),
                },
              ]}
            />
          </Card>
        </div>
      )}
    </>
  );
};

export default ContestMonitoringBasecamp;
