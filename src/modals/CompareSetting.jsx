"use client";

import { useContext, useEffect, useRef, useState } from "react";
import LoadingPage from "../pages/LoadingPage";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../hooks/useFirebaseRealtime";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { Card, Button, Space, Tag, InputNumber, Progress, Badge } from "antd";
import { message } from "antd";
import {
  TrophyOutlined,
  InfoCircleOutlined,
  CloseOutlined,
  StopOutlined,
} from "@ant-design/icons";

const CompareSetting = ({
  stageInfo,
  setClose,
  matchedOriginalPlayers,
  setRefresh,
  propCompareIndex,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [compareList, setCompareList] = useState({});
  const [compareArray, setCompareArray] = useState([]);
  const [currentCompareArray, setCurrentCompareArray] = useState([]);
  const [isVotedPlayerLengthInput, setIsVotedPlayerLengthInput] =
    useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [compareMsgOpen, setCompareMsgOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [votedInfo, setVotedInfo] = useState({
    playerLength: undefined,
    scoreMode: undefined,
    voteRange: "all",
  });

  const [compareStatus, setCompareStatus] = useState({
    compareStart: false,
    compareEnd: false,
    compareCancel: false,
    compareIng: false,
  });

  const [votedResult, setVotedResult] = useState([]);
  const [topResult, setTopResult] = useState([]);
  const [votedValidate, setVotedValidate] = useState(true);

  // ✅ 롤백용: 모달 오픈 시점의 compares 스냅샷 + 세션내 시작 여부
  const initialComparesRef = useRef(null);
  const snapshotTakenRef = useRef(false);
  const [startedInThisSession, setStartedInThisSession] = useState(false);

  const updateRealtimeCompare = useFirebaseRealtimeUpdateData();

  const fetchCompare = useFirestoreGetDocument("contest_compares_list");
  const updateCompare = useFirestoreUpdateData("contest_compares_list");

  const { currentContest } = useContext(CurrentContestContext);

  const { data: realtimeData } = useFirebaseRealtimeGetDocument(
    currentContest?.contests?.id
      ? `currentStage/${currentContest.contests.id}`
      : null
  );

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ✅ 모달 로드시 Firestore 비교 이력 로드
  const fetchPool = async (gradeId, compareListId) => {
    if (gradeId === undefined || compareListId === undefined) {
      setMessage({
        body: "데이터 로드에 문제가 발생했습니다.",
        body2: "다시 시도해주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    try {
      const compareData = await fetchCompare.getDocument(compareListId);
      setCompareList({ ...compareData });
      if (compareData?.compares?.length > 0) {
        setCompareArray([...compareData.compares]);
      }
    } catch (error) {
      console.error("Error fetching compare data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompareModeStart = async (contestId, data) => {
    const collectionInfo = `currentStage/${contestId}/compares`;
    try {
      setVotedInfo({});
      await updateRealtimeCompare.updateData(collectionInfo, data);
      setCompareStatus({
        compareStart: true,
        compareEnd: false,
        compareCancel: false,
        compareIng: false,
      });
      // ✅ 이 모달 세션에서 시작함 표시
      setStartedInThisSession(true);
    } catch (error) {
      console.error("Error starting compare mode:", error);
    }
  };

  // 🔁 CompareSetting 내 handleCompareCancel — 현재 스테이지/체급의 마지막 compare만 제거
  const handleCompareCancel = async (contestId) => {
    const collectionInfoByCompares = `currentStage/${contestId}/compares`;

    const currentStageId = stageInfo?.stageId;
    const currentCategoryId = stageInfo?.categoryId;
    const currentGradeId = stageInfo?.grades?.[0]?.gradeId;

    const all = Array.isArray(compareArray) ? compareArray : [];

    const isCurrentGroup = (c) =>
      c?.stageId === currentStageId &&
      c?.categoryId === currentCategoryId &&
      c?.gradeId === currentGradeId;

    const currentGroup = all.filter(isCurrentGroup);
    const others = all.filter((c) => !isCurrentGroup(c));

    if (currentGroup.length === 0) {
      setRefresh(true);
      setClose(false);
      return;
    }

    const maxIdx = Math.max(
      ...currentGroup.map((c) => Number(c.compareIndex || 0))
    );
    const trimmedGroup = currentGroup.filter(
      (c) => Number(c.compareIndex) !== maxIdx
    );

    const newCompares = [...others, ...trimmedGroup];

    try {
      // 1) 실시간 DB 상태 리셋
      await updateRealtimeCompare.updateData(collectionInfoByCompares, {
        status: {
          compareStart: false,
          compareEnd: false,
          compareCancel: true,
          compareIng: false,
        },
        confirmed: { count: 0, numbers: [] },
        players: [],
        playerLength: 0,
        scoreMode: null,
        judges: (realtimeData?.compares?.judges || []).map((j) => ({
          ...j,
          messageStatus: "확인전",
        })),
      });

      // 2) Firestore(compare 이력) 업데이트
      await updateCompare.updateData(compareList.id, {
        ...compareList,
        compares: newCompares,
      });

      // 3) 로컬 상태 동기화
      setCompareArray(newCompares);
      setCompareList((prev) => ({ ...(prev || {}), compares: newCompares }));

      setCompareStatus({
        compareStart: false,
        compareEnd: false,
        compareCancel: true,
        compareIng: false,
      });

      // 취소는 ‘명시적 작업’이므로 롤백하지 않도록 세션 플래그 해제
      setStartedInThisSession(false);

      setRefresh(true);
      setClose(false);
    } catch (error) {
      console.error("Error cancelling compare:", error);
    }
  };

  const handleAdd = async (contestId) => {
    setTopResult([]);
    const newCompareMode = {
      compareStart: true,
      compareEnd: false,
      compareCancel: false,
      compareIng: false,
    };

    const judgeMessageInfo = (realtimeData?.judges || []).map((judge) => {
      const { seatIndex } = judge;
      return { seatIndex, messageStatus: "확인전" };
    });

    const realtimeCompareInfo = {
      compareIndex: propCompareIndex,
      status: { ...newCompareMode },
      playerLength: votedInfo.playerLength,
      scoreMode: votedInfo.scoreMode,
      voteRange: votedInfo.voteRange,
      judges: [...judgeMessageInfo],
    };

    try {
      await handleCompareModeStart(contestId, realtimeCompareInfo);
    } catch (error) {
      console.error("Error adding compare:", error);
    }
  };

  const getConfirmedNumbersSorted = (players) => {
    if (!Array.isArray(players)) return [];
    return players
      .map((p) => Number(p.playerNumber))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  };

  const handleUpdateComparePlayers = async (
    playerTopResult,
    playerVoteResult,
    contestId,
    compareListId
  ) => {
    const primaryGrade = stageInfo?.grades?.[0];
    if (!primaryGrade?.gradeId) {
      setMessage({
        body: "체급 정보를 찾을 수 없어 비교심사 명단을 확정할 수 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      return;
    }

    const combinedGradeTitle =
      stageInfo?.grades?.length > 1
        ? `${stageInfo.grades
            .map((g) => g?.gradeTitle || "")
            .filter(Boolean)
            .join(" ")} 통합`
        : primaryGrade?.gradeTitle || "";

    const compareInfo = {
      contestId,
      stageId: stageInfo?.stageId || "",
      categoryId: stageInfo?.categoryId || "",
      gradeId: primaryGrade.gradeId,
      categoryTitle: stageInfo?.categoryTitle || "",
      gradeTitle: combinedGradeTitle,
      compareIndex: propCompareIndex,
      comparePlayerLength: Number.parseInt(votedInfo.playerLength, 10),
      compareScoreMode: votedInfo.scoreMode,
      players: [...(playerTopResult || [])],
      votedResult: [...(playerVoteResult || [])],
    };

    try {
      const collectionInfoCompares = `currentStage/${contestId}/compares`;

      const newStatus = {
        compareStart: false,
        compareEnd: false,
        compareCancel: false,
        compareIng: true,
      };

      const newCompares = [...compareArray, compareInfo];

      const confirmedNumbers = (playerTopResult || [])
        .map((p) => Number(p.playerNumber))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);

      await updateRealtimeCompare.updateData(collectionInfoCompares, {
        ...realtimeData?.compares,
        status: { ...newStatus },
        players: [...playerTopResult],
        confirmed: {
          count: confirmedNumbers.length,
          numbers: confirmedNumbers,
        },
      });

      await updateCompare.updateData(compareListId, {
        ...compareList,
        compares: [...newCompares],
      });

      setCompareArray(newCompares);
      setCompareList((prev) => ({ ...(prev || {}), compares: newCompares }));

      // ✅ 명단확정까지 완료했으므로 롤백 대상 아님
      setStartedInThisSession(false);

      setRefresh(true);
      setClose(false);
    } catch (error) {
      console.error("Error updating compare players:", error);
    }
  };

  const handleGetTopPlayers = (players, playerLength) => {
    console.log(players, playerLength);
    if (!Array.isArray(players) || !playerLength || playerLength <= 0) {
      return [];
    }
    const validPlayers = players.filter((p) => p?.votedCount !== undefined);
    if (validPlayers.length === 0) return [];

    const sortedPlayers = [...validPlayers].sort(
      (a, b) => b.votedCount - a.votedCount
    );
    const topPlayers = sortedPlayers.slice(0, playerLength);
    if (topPlayers.length === 0) return [];

    const lastVotedCount = topPlayers[topPlayers.length - 1].votedCount;
    let i = playerLength;
    while (sortedPlayers[i] && sortedPlayers[i].votedCount === lastVotedCount) {
      topPlayers.push(sortedPlayers[i]);
      i++;
    }

    return topPlayers;
  };

  const handleCountPlayerVotes = (data) => {
    const voteCounts = {};
    if (data?.length > 0) {
      data.forEach((entry) => {
        if (
          entry.votedPlayerNumber &&
          Array.isArray(entry.votedPlayerNumber) &&
          entry.votedPlayerNumber.length > 0
        ) {
          entry.votedPlayerNumber.forEach((vote) => {
            const key = `${vote.playerNumber}-${vote.playerUid}`;
            if (!voteCounts[key]) {
              voteCounts[key] = {
                playerNumber: vote.playerNumber,
                playerUid: vote.playerUid,
                votedCount: 0,
              };
            }
            voteCounts[key].votedCount += 1;
          });
        }
      });
    }
    return Object.values(voteCounts);
  };

  const emptyTopTest = () => {
    setTopResult([]);
  };
  const handleManualRecalculate = async () => {
    const playerLength = Number(realtimeData?.compares?.playerLength || 0);

    if (!playerLength || votedResult.length === 0) {
      window.postMessage({
        type: "TOAST",
        message: "재계산할 수 있는 데이터가 없습니다.",
      });
      return;
    }

    const newTop = handleGetTopPlayers(votedResult, playerLength);
    console.log(newTop);
    setTopResult(newTop);

    const confirmedNumbers = newTop
      .map((p) => Number(p.playerNumber))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    // ✅ Realtime DB에 TOP N까지 저장해서 UI가 최신 데이터로 렌더링되도록
    await updateRealtimeCompare.updateData(
      `currentStage/${currentContest.contests.id}/compares`,
      {
        ...realtimeData?.compares,
        players: [...newTop], // ⬅⬅ 여기 추가!!!
        confirmed: {
          count: confirmedNumbers.length,
          numbers: confirmedNumbers,
        },
        status: {
          ...realtimeData?.compares?.status,
          compareStart: true, // 계속 투표중임을 명확하게 표시
        },
      }
    );

    window.postMessage({
      type: "TOAST",
      message: "TOP 인원을 다시 계산했습니다 ✅",
    });
  };

  // ✅ 모달 초기에 compares 스냅샷 1회 저장
  useEffect(() => {
    if (!snapshotTakenRef.current && realtimeData?.compares) {
      snapshotTakenRef.current = true;
      initialComparesRef.current = JSON.parse(
        JSON.stringify(realtimeData.compares)
      );
    }
  }, [realtimeData?.compares]);

  // ✅ Firestore 이력/필터
  useEffect(() => {
    const firstGradeId = stageInfo?.grades?.[0]?.gradeId;
    const compareListId = currentContest?.contests?.contestComparesListId;
    if (firstGradeId && compareListId) {
      fetchPool(firstGradeId, compareListId);
    } else if (stageInfo && currentContest?.contests) {
      setIsLoading(false);
    }
  }, [stageInfo?.grades, currentContest?.contests?.contestComparesListId]);

  useEffect(() => {
    if (realtimeData?.compares?.status?.compareStart) {
      setVotedInfo({
        playerLength: realtimeData.compares.playerLength,
        scoreMode: realtimeData.compares.scoreMode,
        voteRange: realtimeData.compares.voteRange,
      });
    }
    if (compareArray?.length > 0) {
      const filterCompares = compareArray.filter(
        (f) =>
          f.categoryId === realtimeData?.categoryId &&
          f.gradeId === realtimeData?.gradeId
      );
      // (필요시 setCurrentCompareArray 여기서도 가능)
    }
  }, [realtimeData?.compares]);

  useEffect(() => {
    if (compareArray?.length > 0) {
      const filterCompares = compareArray.filter(
        (f) =>
          f.categoryId === realtimeData?.categoryId &&
          f.gradeId === realtimeData?.gradeId
      );
      setCurrentCompareArray(filterCompares);
    }
  }, [
    realtimeData?.stageId,
    compareArray,
    realtimeData?.categoryId,
    realtimeData?.gradeId,
  ]);

  useEffect(() => {
    if (realtimeData?.compares?.judges?.length > 0) {
      setVotedResult(handleCountPlayerVotes(realtimeData.compares.judges));
      const validatedMessages = realtimeData.compares.judges.some(
        (s) => s.messageStatus !== "투표완료"
      );
      setVotedValidate(validatedMessages);
    }
  }, [realtimeData?.compares?.judges]);

  useEffect(() => {
    if (votedResult?.length > 0 && realtimeData?.compares?.playerLength) {
      setTopResult(
        handleGetTopPlayers(votedResult, realtimeData.compares.playerLength)
      );
    }
  }, [votedResult, realtimeData?.compares?.playerLength]);

  const maxVotes =
    votedResult.length > 0
      ? Math.max(...votedResult.map((v) => v.votedCount))
      : 0;

  // ✅ 닫기 시 롤백 처리
  const handleCloseWithRollback = async () => {
    try {
      const contestId = currentContest?.contests?.id;
      const path = `currentStage/${contestId}/compares`;
      const compares = realtimeData?.compares ?? {};
      const { compareIndex = 0, status = {} } = compares;

      const shouldRollback =
        Boolean(contestId) &&
        startedInThisSession &&
        status.compareStart === true &&
        status.compareIng !== true;

      if (shouldRollback) {
        if (compareIndex > 1 && initialComparesRef.current) {
          // ✅ 2차 이상 → 스냅샷으로 롤백
          await updateRealtimeCompare.updateData(
            path,
            JSON.parse(JSON.stringify(initialComparesRef.current))
          );
        } else {
          // ✅ compareIndex === 1 → 완전 초기화 (compareIndex 포함 모든 데이터 리셋)
          await updateRealtimeCompare.updateData(path, {
            compareIndex: 0,
            playerLength: 0,
            scoreMode: null,
            voteRange: null,
            players: [],
            confirmed: { count: 0, numbers: [] },
            judges: [],
            status: {
              compareStart: false,
              compareIng: false,
              compareEnd: false,
              compareCancel: false,
            },
          });
        }
      }
    } catch (e) {
      console.warn("닫기 롤백 실패:", e?.message);
    } finally {
      setRefresh(true); // UI 리프레시
      setClose(false); // 모달 닫기
    }
  };

  return (
    <>
      <div className="flex w-full h-full flex-col bg-white justify-start items-center p-5 gap-y-2 overflow-y-auto">
        {isLoading && <LoadingPage />}
        {!isLoading && (
          <>
            <ConfirmationModal
              isOpen={msgOpen}
              message={message}
              onCancel={() => setMsgOpen(false)}
              onConfirm={() => {
                setClose(false);
                setMsgOpen(false);
              }}
            />
            <ConfirmationModal
              isOpen={compareMsgOpen}
              message={message}
              onCancel={() => setCompareMsgOpen(false)}
              onConfirm={() => {
                handleCompareCancel(currentContest?.contests?.id);
              }}
            />

            <Card className="w-full mb-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-lg"
                    style={{
                      width: "48px",
                      height: "48px",
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    }}
                  >
                    <TrophyOutlined className="text-white text-2xl" />
                  </div>
                  <div className="flex flex-col">
                    <div className="text-xl font-bold text-gray-800">
                      {stageInfo?.categoryTitle || ""}
                      {stageInfo?.grades?.length > 0 &&
                        `(${
                          stageInfo.grades.length > 1
                            ? `${stageInfo.grades
                                .map((g) => g?.gradeTitle || "")
                                .filter(Boolean)
                                .join(" ")} 통합`
                            : stageInfo.grades[0]?.gradeTitle || ""
                        })`}
                    </div>
                    <div className="text-base text-gray-600">
                      {propCompareIndex}차 비교심사 설정
                    </div>
                  </div>
                </div>
                <Space>
                  {/* <Button
                    danger
                    icon={<StopOutlined />}
                    onClick={() => {
                      setMessage({
                        body: "비교심사를 취소하시겠습니까?",
                        isButton: true,
                        cancelButtonText: "아니오",
                        confirmButtonText: "예",
                      });
                      setCompareMsgOpen(true);
                    }}
                  >
                    비교심사취소
                  </Button> */}
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    onClick={handleCloseWithRollback}
                  >
                    취소(오류시 재비교심사설정)
                  </Button>
                </Space>
              </div>
            </Card>

            <Card className="w-full mb-4">
              <Space direction="vertical" size="large" className="w-full">
                {/* 투표대상 설정 */}
                {propCompareIndex > 1 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-base font-semibold text-gray-700">
                      투표대상 설정
                    </div>
                    <Space wrap>
                      {realtimeData?.compares?.status?.compareStart ? (
                        <Button
                          disabled
                          style={
                            votedInfo?.voteRange === "all"
                              ? {
                                  backgroundColor: "#1890ff",
                                  borderColor: "#1890ff",
                                  color: "white",
                                  opacity: 0.7,
                                }
                              : {}
                          }
                          className="min-w-[120px]"
                        >
                          {votedInfo?.voteRange === "all"
                            ? "해당체급 전체"
                            : `${propCompareIndex - 1}차 선발인원만`}
                        </Button>
                      ) : (
                        <>
                          <Button
                            type={
                              votedInfo.voteRange === "all"
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                voteRange: "all",
                              }));
                            }}
                            className="min-w-[120px]"
                          >
                            해당체급 전체
                          </Button>
                          <Button
                            type={
                              votedInfo.voteRange === "voted"
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                voteRange: "voted",
                              }));
                            }}
                            className="min-w-[120px]"
                          >
                            {propCompareIndex - 1}차 선발인원만
                          </Button>
                        </>
                      )}
                    </Space>
                  </div>
                )}

                {/* 심사대상 인원수 설정 */}
                <div className="flex flex-col gap-2">
                  <div className="text-base font-semibold text-gray-700">
                    심사대상 인원수 설정
                  </div>
                  <Space wrap>
                    {realtimeData?.compares?.status?.compareStart ? (
                      <Button
                        disabled
                        style={{
                          backgroundColor: "#1890ff",
                          borderColor: "#1890ff",
                          color: "white",
                          opacity: 0.7,
                        }}
                        className="min-w-[120px]"
                      >
                        TOP {votedInfo.playerLength}
                      </Button>
                    ) : (
                      <>
                        {matchedOriginalPlayers?.length >= 3 && (
                          <Button
                            type={
                              votedInfo.playerLength === 3
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                playerLength: 3,
                              }));
                              setIsVotedPlayerLengthInput(false);
                            }}
                            className="min-w-[120px]"
                          >
                            TOP 3
                          </Button>
                        )}
                        {matchedOriginalPlayers?.length >= 5 && (
                          <Button
                            type={
                              votedInfo.playerLength === 5
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                playerLength: 5,
                              }));
                              setIsVotedPlayerLengthInput(false);
                            }}
                            className="min-w-[120px]"
                          >
                            TOP 5
                          </Button>
                        )}
                        {matchedOriginalPlayers?.length >= 7 && (
                          <Button
                            type={
                              votedInfo.playerLength === 7
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                playerLength: 7,
                              }));
                              setIsVotedPlayerLengthInput(false);
                            }}
                            className="min-w-[120px]"
                          >
                            TOP 7
                          </Button>
                        )}
                        <Button
                          type={
                            isVotedPlayerLengthInput ? "primary" : "default"
                          }
                          onClick={() => {
                            setIsVotedPlayerLengthInput((prev) => !prev);
                            setVotedInfo((prev) => ({
                              ...prev,
                              playerLength: undefined,
                            }));
                          }}
                          className="min-w-[120px]"
                        >
                          직접입력
                        </Button>
                        {isVotedPlayerLengthInput && (
                          <InputNumber
                            min={1}
                            max={matchedOriginalPlayers?.length}
                            placeholder="인원수"
                            onChange={(value) => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                playerLength: Number.parseInt(value),
                              }));
                            }}
                            className="w-24"
                          />
                        )}
                      </>
                    )}
                  </Space>
                </div>

                {/* 채점모드 설정 */}
                <div className="flex flex-col gap-2">
                  <div className="text-base font-semibold text-gray-700">
                    채점모드 설정
                  </div>
                  <Space wrap>
                    {realtimeData?.compares?.status?.compareStart ? (
                      <Button
                        disabled
                        style={{
                          backgroundColor: "#1890ff",
                          borderColor: "#1890ff",
                          color: "white",
                          opacity: 0.7,
                        }}
                        className="min-w-[120px]"
                      >
                        {votedInfo.scoreMode === "all" && "전체"}
                        {votedInfo.scoreMode === "topOnly" && "대상자"}
                        {votedInfo.scoreMode === "topWithSub" &&
                          `${propCompareIndex - 1}차 전체`}
                      </Button>
                    ) : (
                      <>
                        <Button
                          type={
                            votedInfo.scoreMode === "all"
                              ? "primary"
                              : "default"
                          }
                          onClick={() => {
                            setVotedInfo((prev) => ({
                              ...prev,
                              scoreMode: "all",
                            }));
                          }}
                          className="min-w-[120px]"
                        >
                          전체
                        </Button>
                        {propCompareIndex > 1 && (
                          <Button
                            type={
                              votedInfo.scoreMode === "topWithSub"
                                ? "primary"
                                : "default"
                            }
                            onClick={() => {
                              setVotedInfo((prev) => ({
                                ...prev,
                                scoreMode: "topWithSub",
                              }));
                            }}
                            className="min-w-[120px]"
                          >
                            {propCompareIndex - 1}차 전체
                          </Button>
                        )}
                        <Button
                          type={
                            votedInfo.scoreMode === "topOnly"
                              ? "primary"
                              : "default"
                          }
                          onClick={() => {
                            setVotedInfo((prev) => ({
                              ...prev,
                              scoreMode: "topOnly",
                            }));
                          }}
                          className="min-w-[120px]"
                        >
                          대상자
                        </Button>
                      </>
                    )}
                  </Space>
                  {!realtimeData?.compares?.status?.compareStart && (
                    <div className="flex items-center gap-2 mt-2 p-3 bg-blue-50 rounded-lg">
                      <InfoCircleOutlined className="text-blue-600" />
                      <span className="text-sm text-gray-700">
                        {votedInfo.scoreMode === "all" &&
                          "출전선수 전원 채점을 완료해야합니다."}
                        {votedInfo.scoreMode === "topOnly" &&
                          "비교심사 대상만 채점합니다. 나머지 선수는 순위외 처리됩니다."}
                        {votedInfo.scoreMode === "topWithSub" &&
                          "이전 차수 비교심사 대상 전체를 채점합니다."}
                      </span>
                    </div>
                  )}
                </div>

                {/* 비교심사 투표개시 버튼 */}
                <div className="flex justify-center pt-4">
                  {realtimeData?.compares?.status?.compareStart ? (
                    <Button
                      size="large"
                      disabled
                      className="w-full md:w-auto min-w-[200px]"
                    >
                      비교심사 투표중
                    </Button>
                  ) : (
                    votedInfo.playerLength !== undefined &&
                    votedInfo.scoreMode !== undefined && (
                      <Button
                        type="primary"
                        size="large"
                        onClick={() => handleAdd(currentContest.contests.id)}
                        className="w-full md:w-auto min-w-[200px]"
                      >
                        비교심사 투표개시
                      </Button>
                    )
                  )}
                </div>
              </Space>
            </Card>

            {realtimeData?.compares?.status?.compareStart && (
              <div className="flex w-full h-auto flex-col gap-y-4">
                {/* 득표 현황 */}
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center justify-center rounded-lg"
                        style={{
                          width: "32px",
                          height: "32px",
                          background:
                            "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                        }}
                      >
                        <TrophyOutlined className="text-white" />
                      </div>
                      <span>비교심사 득표 및 투표현황</span>
                    </div>
                  }
                >
                  {!isMobile ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 p-3 text-left font-semibold">
                              선수번호
                            </th>
                            {(matchedOriginalPlayers || []).map((player, pIdx) => (
                              <th
                                key={pIdx}
                                className="border border-gray-300 p-3 text-center font-semibold"
                              >
                                <Tag color="blue" className="text-base">
                                  {player.playerNumber}
                                </Tag>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 p-3 font-semibold bg-gray-50">
                              득표수
                            </td>
                            {(matchedOriginalPlayers || []).map((player, pIdx) => {
                              const votes =
                                votedResult?.find(
                                  (f) => f.playerNumber === player.playerNumber
                                )?.votedCount || 0;
                              const percentage =
                                maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                              return (
                                <td
                                  key={pIdx}
                                  className="border border-gray-300 p-3 text-center"
                                >
                                  <div className="flex flex-col gap-2">
                                    <span className="text-lg font-bold">
                                      {votes}표
                                    </span>
                                    <Progress
                                      percent={percentage}
                                      showInfo={false}
                                      strokeColor="#1890ff"
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Space
                      direction="vertical"
                      size="middle"
                      className="w-full"
                    >
                      {(matchedOriginalPlayers || []).map((player, pIdx) => {
                        const votes =
                          votedResult?.find(
                            (f) => f.playerNumber === player.playerNumber
                          )?.votedCount || 0;
                        const percentage =
                          maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                        return (
                          <Card key={pIdx} size="small">
                            <div className="flex justify-between items-center mb-2">
                              <Tag color="blue" className="text-base">
                                선수 {player.playerNumber}
                              </Tag>
                              <span className="text-lg font-bold">
                                {votes}표
                              </span>
                            </div>
                            <Progress
                              percent={percentage}
                              strokeColor="#1890ff"
                            />
                          </Card>
                        );
                      })}
                    </Space>
                  )}

                  {/* 이전 차수 TOP N */}
                  {currentCompareArray?.length > 0 && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <div className="text-base font-semibold mb-3 text-gray-700">
                        {currentCompareArray?.length}차 TOP{" "}
                        {
                          currentCompareArray[currentCompareArray?.length - 1]
                            ?.comparePlayerLength
                        }
                      </div>
                      <Space wrap>
                        {currentCompareArray[
                          currentCompareArray?.length - 1
                        ]?.players?.map((top, tIdx) => (
                          <Badge
                            key={tIdx}
                            count={top.playerNumber}
                            overflowCount={9999}
                            style={{
                              backgroundColor: "#1890ff",
                              fontSize: "16px",
                              width: "auto",
                              minWidth: "48px",
                              height: "48px",
                              padding: "0 12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          />
                        ))}
                      </Space>
                    </div>
                  )}

                  {/* 현재 TOP N */}
                  <div className="mt-4 p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-base font-semibold text-gray-700">
                        현재 TOP {realtimeData?.compares?.playerLength}
                      </span>
                      <Space>
                        <Button
                          type="default"
                          onClick={handleManualRecalculate}
                        >
                          재계산
                        </Button>
                        {/* <Button type="default" onClick={emptyTopTest}>
                          다차 비교심사 임시버튼(최초 1회만 눌러야합니다.)
                        </Button> */}
                      </Space>
                    </div>

                    <Space wrap>
                      {topResult?.length > 0 &&
                        topResult?.map((top, tIdx) => (
                          <Badge
                            key={tIdx}
                            count={top.playerNumber}
                            overflowCount={9999}
                            style={{
                              backgroundColor: "#52c41a",
                              fontSize: "16px",
                              width: "auto",
                              minWidth: "48px",
                              height: "48px",
                              padding: "0 12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          />
                        ))}
                    </Space>
                  </div>
                </Card>

                {/* 심판 투표 상황 */}
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center justify-center rounded-lg"
                        style={{
                          width: "32px",
                          height: "32px",
                          background:
                            "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                        }}
                      >
                        <InfoCircleOutlined className="text-white" />
                      </div>
                      <span>심판 투표 상황</span>
                    </div>
                  }
                >
                  {!isMobile ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 p-3 text-left font-semibold">
                              심판번호
                            </th>
                            {(realtimeData?.judges || []).map((judge, pIdx) => (
                              <th
                                key={pIdx}
                                className="border border-gray-300 p-3 text-center font-semibold"
                              >
                                {judge.seatIndex}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 p-3 font-semibold bg-gray-50">
                              투표상황
                            </td>
                            {(realtimeData?.compares?.judges || []).map(
                              (judge, pIdx) => (
                                <td
                                  key={pIdx}
                                  className="border border-gray-300 p-3 text-center"
                                >
                                  <Tag
                                    color={
                                      judge.messageStatus === "투표완료"
                                        ? "success"
                                        : "default"
                                    }
                                  >
                                    {judge.messageStatus}
                                  </Tag>
                                </td>
                              )
                            )}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Space
                      direction="vertical"
                      size="middle"
                      className="w-full"
                    >
                      {(realtimeData?.compares?.judges || []).map(
                        (judge, pIdx) => (
                          <Card key={pIdx} size="small">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold">
                                심판 {judge.seatIndex}
                              </span>
                              <Tag
                                color={
                                  judge.messageStatus === "투표완료"
                                    ? "success"
                                    : "default"
                                }
                              >
                                {judge.messageStatus}
                              </Tag>
                            </div>
                          </Card>
                        )
                      )}
                    </Space>
                  )}

                  <div className="flex justify-center mt-6">
                    <Space
                      direction="vertical"
                      size="small"
                      className="w-full items-center"
                    >
                      {/* 메인 버튼: 투표중 또는 명단확정 */}
                      {votedValidate ? (
                        <Button
                          size="large"
                          disabled
                          className="w-full md:w-auto min-w-[200px]"
                        >
                          투표중
                        </Button>
                      ) : (
                        <Button
                          type="primary"
                          size="large"
                          onClick={() =>
                            handleUpdateComparePlayers(
                              topResult,
                              votedResult,
                              currentContest.contests.id,
                              currentContest.contests.contestComparesListId
                            )
                          }
                          className="w-full md:w-auto min-w-[200px]"
                        >
                          명단확정
                        </Button>
                      )}

                      {/* 서브 버튼: 직권확정 */}
                      <Button
                        type="link"
                        size="small"
                        onClick={() =>
                          handleUpdateComparePlayers(
                            topResult,
                            votedResult,
                            currentContest.contests.id,
                            currentContest.contests.contestComparesListId
                          )
                        }
                        className="text-gray-400 hover:text-gray-600"
                      >
                        직권확정
                      </Button>
                    </Space>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default CompareSetting;
