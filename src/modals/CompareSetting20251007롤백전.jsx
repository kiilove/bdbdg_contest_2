"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import LoadingPage from "../pages/LoadingPage";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { Card, Button, Space } from "antd";

import CompareHeader from "../components/compare/CompareHeader";
import VoteTargetSelector from "../components/compare/VoteTargetSelector";
import PlayerLengthSelector from "../components/compare/PlayerLengthSelector";
import ScoreModeSelector from "../components/compare/ScoreModeSelector";
import VoteSummary from "../components/compare/VoteSummary";
import JudgesStatus from "../components/compare/JudgesStatus";

// ✅ compareRealtime 유틸
import {
  startCompare,
  confirmCompare,
  cancelCompare,
  countVotes,
  pickTop,
} from "../utils/compareRealtime";

const CompareSetting2025 = ({
  stageInfo,
  setClose,
  matchedOriginalPlayers,
  setRefresh,
  propCompareIndex,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [compareList, setCompareList] = useState({});
  const [compareArray, setCompareArray] = useState([]);
  const [isVotedPlayerLengthInput, setIsVotedPlayerLengthInput] =
    useState(false);

  const [compareMsgOpen, setCompareMsgOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});

  const [votedInfo, setVotedInfo] = useState({
    playerLength: undefined,
    scoreMode: undefined,
    voteRange: "all",
  });

  const [votedResult, setVotedResult] = useState([]);
  const [topResult, setTopResult] = useState([]);
  const [votedValidate, setVotedValidate] = useState(true);

  const fetchCompare = useFirestoreGetDocument("contest_compares_list");
  const updateCompare = useFirestoreUpdateData("contest_compares_list");

  const { currentContest } = useContext(CurrentContestContext);

  const { data: realtimeData, loading: realtimeLoading } =
    useFirebaseRealtimeGetDocument(
      currentContest?.contests?.id
        ? `currentStage/${currentContest.contests.id}`
        : null
    );

  const safeGradeId = stageInfo?.grades?.[0]?.gradeId || null;
  const safeGradeTitle = stageInfo?.grades?.[0]?.gradeTitle || "";

  const comparePhase = realtimeData?.compares?.phase || null;
  const compareSettings = realtimeData?.compares?.settings || null;
  const compareJudgesMap = realtimeData?.compares?.judges || null;
  const legacyStatus = realtimeData?.compares?.status || null;

  const isVoting =
    comparePhase === "voting" ||
    (legacyStatus?.compareStart && !legacyStatus?.compareIng);

  const countVotesLocal = (judgesMap) => {
    if (!judgesMap) return [];
    return countVotes(Object.values(judgesMap));
  };

  const fetchPool = async (gradeId, compareListId) => {
    if (!gradeId || !compareListId) {
      setMessage({
        body: "데이터 로드에 문제가 발생했습니다.",
        body2: "다시 시도해주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
      setIsLoading(false);
      return;
    }
    try {
      const doc = await fetchCompare.getDocument(compareListId);
      setCompareList({ ...doc });
      setCompareArray(Array.isArray(doc?.compares) ? doc.compares : []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (safeGradeId && currentContest?.contests?.contestComparesListId) {
      fetchPool(safeGradeId, currentContest.contests.contestComparesListId);
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeGradeId, currentContest?.contests?.contestComparesListId]);

  useEffect(() => {
    if (isVoting && compareSettings) {
      setVotedInfo({
        playerLength: compareSettings?.playerLength,
        scoreMode: compareSettings?.scoreMode,
        voteRange: compareSettings?.voteRange,
      });
    }
  }, [isVoting, compareSettings]);

  useEffect(() => {
    if (isVoting && compareJudgesMap && Object.keys(compareJudgesMap).length) {
      const votes = countVotesLocal(compareJudgesMap);
      setVotedResult(votes);
      const anyPending = Object.values(compareJudgesMap).some(
        (j) => j?.messageStatus !== "투표완료"
      );
      setVotedValidate(anyPending);
    } else {
      setVotedResult([]);
      setVotedValidate(true);
    }
  }, [isVoting, compareJudgesMap]);

  useEffect(() => {
    if (!isVoting) {
      setTopResult([]);
      return;
    }
    const N = compareSettings?.playerLength ?? votedInfo.playerLength;
    if (Number.isFinite(N) && N > 0 && votedResult.length > 0) {
      setTopResult(pickTop(votedResult, N));
    } else {
      setTopResult([]);
    }
  }, [
    isVoting,
    votedResult,
    compareSettings?.playerLength,
    votedInfo.playerLength,
  ]);

  /** ✅ 비교심사 시작 */
  const handleAdd = async () => {
    const contestId = currentContest?.contests?.id;
    if (!contestId) return;

    const judgesArray = (realtimeData?.judges || []).map((j) => ({
      seatIndex: j?.seatIndex,
      judgeUid: j?.judgeUid || null,
      judgeName: j?.judgeName || null,
      messageStatus: "확인전",
      votedPlayerNumber: [],
    }));

    await startCompare({
      contestId,
      index: propCompareIndex,
      playerLength: votedInfo.playerLength,
      scoreMode: votedInfo.scoreMode,
      voteRange: votedInfo.voteRange,
      judgesArray,
      updatedBy: null,
    });
  };

  /** ✅ 비교심사 취소 */
  const handleCompareCancel = async () => {
    const contestId = currentContest?.contests?.id;
    if (!contestId) return;

    await cancelCompare({ contestId, updatedBy: null });
    setRefresh(true);
    setClose(false);
  };

  /** ✅ 정상 확정 (모든 투표 완료 시) */
  const handleConfirmPlayers = async () => {
    const contestId = currentContest?.contests?.id;
    if (!contestId) return;

    await confirmCompare({
      contestId,
      index: propCompareIndex,
      selectedPlayers: topResult,
      updatedBy: "chief_judge",
    });

    if (compareList?.id) {
      const entry = {
        contestId,
        categoryId: stageInfo?.categoryId,
        gradeId: safeGradeId,
        categoryTitle: stageInfo?.categoryTitle,
        gradeTitle: safeGradeTitle,
        compareIndex: propCompareIndex,
        comparePlayerLength: Number(votedInfo.playerLength),
        compareScoreMode: votedInfo.scoreMode,
        players: [...topResult],
        votedResult: [...votedResult],
      };
      await updateCompare.updateData(compareList.id, {
        ...compareList,
        compares: [...(compareList?.compares || []), entry],
      });
      setCompareArray((prev) => [...prev, entry]);
      setCompareList((prev) => ({
        ...prev,
        compares: [...(prev?.compares || []), entry],
      }));
    }

    setRefresh(true);
    setClose(false);
  };

  /** ✅ 심판위원장 직권 확정 (투표 미완료 상태에서 강제 확정) */
  const handleForceConfirmPlayers = async () => {
    const contestId = currentContest?.contests?.id;
    if (!contestId) return;

    const N = compareSettings?.playerLength ?? votedInfo.playerLength ?? 0;
    const forcedTop = pickTop(votedResult, N);

    await confirmCompare({
      contestId,
      index: propCompareIndex,
      selectedPlayers: forcedTop,
      updatedBy: "chief_judge_forced",
    });

    if (compareList?.id) {
      const entry = {
        contestId,
        categoryId: stageInfo?.categoryId,
        gradeId: safeGradeId,
        categoryTitle: stageInfo?.categoryTitle,
        gradeTitle: safeGradeTitle,
        compareIndex: propCompareIndex,
        comparePlayerLength: Number(votedInfo.playerLength),
        compareScoreMode: votedInfo.scoreMode,
        players: [...forcedTop],
        votedResult: [...votedResult],
        forced: true,
      };
      await updateCompare.updateData(compareList.id, {
        ...compareList,
        compares: [...(compareList?.compares || []), entry],
      });
      setCompareArray((prev) => [...prev, entry]);
      setCompareList((prev) => ({
        ...prev,
        compares: [...(prev?.compares || []), entry],
      }));
    }

    setRefresh(true);
    setClose(false);
  };

  const currentTopN = useMemo(
    () => compareSettings?.playerLength ?? votedInfo.playerLength ?? 0,
    [compareSettings?.playerLength, votedInfo.playerLength]
  );

  return (
    <div className="flex w-full h-full flex-col bg-white justify-start items-center p-5 gap-y-2 overflow-y-auto">
      {(isLoading || realtimeLoading) && <LoadingPage />}

      {!isLoading && !realtimeLoading && (
        <div className="w-full max-w-6xl">
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
            message={{
              body: "비교심사를 취소하시겠습니까?",
              isButton: true,
              cancelButtonText: "아니오",
              confirmButtonText: "예",
            }}
            onCancel={() => setCompareMsgOpen(false)}
            onConfirm={handleCompareCancel}
          />

          <CompareHeader
            categoryTitle={stageInfo?.categoryTitle}
            gradeTitle={safeGradeTitle}
            compareIndex={propCompareIndex}
            onCancel={() => setCompareMsgOpen(true)}
            onClose={() => {
              setRefresh(true);
              setClose(false);
            }}
          />

          <Card className="mb-4">
            <Space direction="vertical" size="large" className="w-full">
              {propCompareIndex > 1 && (
                <VoteTargetSelector
                  disabled={isVoting}
                  value={
                    isVoting ? compareSettings?.voteRange : votedInfo.voteRange
                  }
                  compareIndex={propCompareIndex}
                  onChange={(val) =>
                    setVotedInfo((s) => ({ ...s, voteRange: val }))
                  }
                />
              )}

              <PlayerLengthSelector
                disabled={isVoting}
                candidates={matchedOriginalPlayers?.length || 0}
                isCustom={isVotedPlayerLengthInput}
                value={
                  isVoting
                    ? compareSettings?.playerLength
                    : votedInfo.playerLength
                }
                onPick={(n) => {
                  setVotedInfo((s) => ({ ...s, playerLength: n }));
                  setIsVotedPlayerLengthInput(false);
                }}
                onToggleCustom={() => {
                  setIsVotedPlayerLengthInput((v) => !v);
                  setVotedInfo((s) => ({ ...s, playerLength: undefined }));
                }}
                onCustomChange={(n) =>
                  Number.isFinite(n) &&
                  setVotedInfo((s) => ({ ...s, playerLength: n }))
                }
              />

              <ScoreModeSelector
                disabled={isVoting}
                compareIndex={propCompareIndex}
                value={
                  isVoting ? compareSettings?.scoreMode : votedInfo.scoreMode
                }
                onChange={(mode) =>
                  setVotedInfo((s) => ({ ...s, scoreMode: mode }))
                }
              />

              <div className="flex w-full justify-center pt-4">
                {isVoting ? (
                  <Button
                    type="default"
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
                      onClick={handleAdd}
                      className="w-full md:w-auto min-w-[200px]"
                    >
                      비교심사 투표개시
                    </Button>
                  )
                )}
              </div>
            </Space>
          </Card>

          {isVoting && (
            <div className="flex w-full h-auto flex-col gap-y-4">
              <VoteSummary
                matchedOriginalPlayers={matchedOriginalPlayers}
                votedResult={votedResult}
                compareArray={compareArray}
                currentTopN={currentTopN}
                topResult={topResult}
              />

              <JudgesStatus
                judgesMap={compareJudgesMap}
                pending={votedValidate}
              />

              {/* ✅ 버튼 영역 */}
              <div className="flex justify-center gap-4 pt-4">
                {!votedValidate && topResult.length > 0 && (
                  <Button
                    type="primary"
                    size="large"
                    onClick={handleConfirmPlayers}
                  >
                    비교심사 명단 확정
                  </Button>
                )}

                {votedValidate && votedResult.length > 0 && (
                  <Button
                    type="dashed"
                    danger
                    size="large"
                    onClick={handleForceConfirmPlayers}
                  >
                    심판위원장 직권으로 확정
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompareSetting2025;
