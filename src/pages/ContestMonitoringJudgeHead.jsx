"use client";

import { useCallback, useState, useEffect, useContext } from "react";
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
} from "@ant-design/icons";

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

        if (returnCompareList?.compares?.length === 0) {
          setCurrentCompareInfo({});
        }
        if (returnCompareList.compares.length > 0) {
          setCurrentCompareInfo({
            ...returnCompareList.compares[
              returnCompareList.compares.length - 1
            ],
          });
        }
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

  return (
    <>
      {isLoading || realtimeLoading ? (
        <div className="flex w-full h-screen justify-center items-center">
          <LoadingPage propStyles={{ width: "80", height: "60" }} />
        </div>
      ) : (
        <div className="flex flex-col w-full h-full bg-gray-50 rounded-lg p-4 gap-4">
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
              <Descriptions.Item label="모니터링 상태">
                {!isHolding && realtimeData?.stageId && (
                  <Tag color="green">실시간 모니터링중</Tag>
                )}
                {isHolding && <Tag color="orange">모니터링 일시정지</Tag>}
                {!realtimeData?.stageId && !isHolding && (
                  <Tag color="default">대회시작전</Tag>
                )}
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
                        setCompareMode(() => ({
                          ...compareMode,
                          compareStart: true,
                        }))
                      }
                      className={isMobile ? "w-full" : ""}
                    >
                      {comparesArray.length + 1}차 비교심사 시작
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
                          {currentCompareInfo?.compareScoreMode === "compare"
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
                            {compareIndex >= comparesArray?.length && (
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

                  return (
                    <div key={gIdx} className="mb-6">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4">
                        <Space>
                          <Tag color="blue" className="text-base px-3 py-1">
                            {categoryTitle}
                          </Tag>
                          <Tag color="cyan" className="text-base px-3 py-1">
                            {gradeTitle}
                          </Tag>
                        </Space>
                        {categoryJudgeType === "point" ? (
                          <Button
                            type={
                              (realtimeData?.resultSave || []).includes(gradeId)
                                ? "default"
                                : "primary"
                            }
                            danger={(realtimeData?.resultSave || []).includes(
                              gradeId
                            )}
                            icon={<CheckCircleOutlined />}
                            onClick={() => {
                              if (
                                !(realtimeData?.resultSave || []).includes(
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
                            disabled={(realtimeData?.resultSave || []).includes(
                              gradeId
                            )}
                          >
                            {(realtimeData?.resultSave || []).includes(gradeId)
                              ? "순위표 확정됨"
                              : "점수형 집계 및 순위확인"}
                          </Button>
                        ) : (
                          <Button
                            type={
                              (realtimeData?.resultSave || []).includes(gradeId)
                                ? "default"
                                : "primary"
                            }
                            danger={(realtimeData?.resultSave || []).includes(
                              gradeId
                            )}
                            icon={<CheckCircleOutlined />}
                            onClick={() => {
                              if (
                                !(realtimeData?.resultSave || []).includes(
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
                            disabled={(realtimeData?.resultSave || []).includes(
                              gradeId
                            )}
                          >
                            {(realtimeData?.resultSave || []).includes(gradeId)
                              ? "순위표 확정됨"
                              : "랭킹형 집계 및 순위확인"}
                          </Button>
                        )}
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
