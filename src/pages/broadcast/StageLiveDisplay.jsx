"use client";

import React, { useContext, useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import {
  useFirebaseRealtimeGetDocument,
  useFirebaseRealtimeUpdateData,
} from "../../hooks/useFirebaseRealtime";
import { useFirestoreQuery, useFirestoreGetDocument } from "../../hooks/useFirestores";
import { where } from "firebase/firestore";
import StandbyStageScene from "../../components/broadcast/StandbyStageScene";
import CommercialScene from "../../components/broadcast/CommercialScene";
import AthleteIntroScene from "../../components/broadcast/AthleteIntroScene";
import RankingCeremonyScene from "../../components/broadcast/RankingCeremonyScene";
import ChampionShowcaseScene from "../../components/broadcast/ChampionShowcaseScene";
import SpecialStageScene from "../../components/broadcast/SpecialStageScene";
import ComparisonCalloutScene from "../../components/broadcast/ComparisonCalloutScene";
import PosedownScene from "../../components/broadcast/PosedownScene";
import {
  FullscreenOutlined,
  FullscreenExitOutlined,
  DatabaseOutlined,
  CheckCircleFilled,
  ReloadOutlined,
  SearchOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { Modal, Input, message, Tag } from "antd";

const StageLiveDisplay = () => {
  const location = useLocation();
  const { currentContest, setCurrentContest } = useContext(CurrentContestContext);

  // 📡 1. Firebase Realtime DB 글로벌 전역 활성 대회 구독 (다른 화면/본부석에서 선택한 대회 실시간 연동)
  const { data: globalActiveContest } = useFirebaseRealtimeGetDocument(
    "systemSettings/activeContest"
  );
  const updateGlobalSetting = useFirebaseRealtimeUpdateData();

  // 🎯 2. 스크린 화면에서 수동으로 선택한 대회 정보
  const [manualContest, setManualContest] = useState(() => {
    try {
      const saved = localStorage.getItem("screen_manual_contest");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // 🏆 3. 최종 유효 contestId & contestTitle 도출 (URL > 수동선택 > Realtime전역 > Context > localStorage)
  const urlContestId = new URLSearchParams(location.search).get("contestId") || location?.state?.contestId;

  const contestId =
    urlContestId ||
    manualContest?.contestId ||
    globalActiveContest?.contestId ||
    currentContest?.contests?.id ||
    currentContest?.contestInfo?.id ||
    localStorage.getItem("screen_active_contest_id") ||
    "";

  const contestTitle =
    manualContest?.contestTitle ||
    globalActiveContest?.contestTitle ||
    currentContest?.contestInfo?.contestTitle ||
    currentContest?.contests?.contestTitle ||
    "2026 보디빌딩 & 피트니스 챔피언십";

  // 🗄️ 데이터베이스(대회) 선택 모달 상태
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [contestList, setContestList] = useState([]);
  const [isContestLoading, setIsContestLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCursorVisible, setIsCursorVisible] = useState(true);
  const cursorTimeoutRef = useRef(null);

  const [sponsors, setSponsors] = useState([]);
  const [videoSettings, setVideoSettings] = useState({
    standbyVideoUrl: "",
    rankingVideoUrl: "",
    introVideoUrl: "",
  });

  const sponsorQuery = useFirestoreQuery();
  const fetchNoticeQuery = useFirestoreQuery();
  const fetchContestsQuery = useFirestoreQuery();
  const fetchDocument = useFirestoreGetDocument("contest_notice");
  const updateBroadcast = useFirebaseRealtimeUpdateData();

  // 📡 Realtime DB 실시간 브로드캐스트 상태 리스너
  const { data: broadcastData } = useFirebaseRealtimeGetDocument(
    contestId ? `currentBroadcast/${contestId}` : null
  );

  // 📡 기존 currentStage 실시간 데이터도 함께 구독 (레거시 호환성 보장)
  const { data: legacyStageData } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );

  // 📋 전체 대회 목록 불러오기 (DB 선택 모달용)
  const loadAllContests = async () => {
    setIsContestLoading(true);
    try {
      const condition = [
        where("contestStatus", "in", [
          "접수중",
          "수정됨",
          "데모용",
          "수동접수",
          "대회마감",
          "종료됨",
        ]),
      ];
      const notices = await fetchNoticeQuery.getDocuments("contest_notice", condition);
      const sorted = (notices || []).sort((a, b) =>
        (a.contestTitle || "").localeCompare(b.contestTitle || "")
      );
      setContestList(sorted);
    } catch (error) {
      console.error("대회 목록 로드 오류:", error);
    } finally {
      setIsContestLoading(false);
    }
  };

  useEffect(() => {
    if (isDbModalOpen) {
      loadAllContests();
    }
  }, [isDbModalOpen]);

  // 🎯 특정 대회로 데이터베이스 즉시 변경 핸들러
  const handleSelectContest = async (notice) => {
    try {
      const condition = [where("contestNoticeId", "==", notice.id)];
      const returnContest = await fetchContestsQuery.getDocuments("contests", condition);

      if (returnContest && returnContest[0]?.id) {
        const selectedId = returnContest[0].id;
        const selectedTitle = notice.contestTitle || "";

        const newContestData = {
          contestId: selectedId,
          contestNoticeId: notice.id,
          contestTitle: selectedTitle,
        };

        // 1) 로컬 상태 및 스토리지 저장
        setManualContest(newContestData);
        localStorage.setItem("screen_manual_contest", JSON.stringify(newContestData));
        localStorage.setItem("screen_active_contest_id", selectedId);

        // 2) Context 및 SessionStorage 동기화
        const fullContestObj = {
          contestInfo: { ...notice },
          contests: { ...returnContest[0] },
        };
        setCurrentContest(fullContestObj);
        sessionStorage.setItem("currentContest", JSON.stringify(fullContestObj));

        // 3) Realtime DB 전역 활성 대회 동기화 (모든 전광판에 일괄 전파!)
        await updateGlobalSetting.updateData("systemSettings/activeContest", {
          contestId: selectedId,
          contestNoticeId: notice.id,
          contestTitle: selectedTitle,
          updatedAt: Date.now(),
        });

        message.success(`전광판 데이터베이스가 [${selectedTitle}] 로 변경되었습니다!`);
        setIsDbModalOpen(false);
      } else {
        message.warning("해당 대회의 세부 정보가 존재하지 않습니다.");
      }
    } catch (error) {
      console.error("대회 선택 오류:", error);
      message.error("대회 데이터베이스 변경 중 오류가 발생했습니다.");
    }
  };

  // 🖱️ 1초 동안 마우스 움직임이 없으면 마우스 커서 및 컨트롤 버튼 자동 숨김 (Auto-Hide Cursor)
  useEffect(() => {
    const handleActivity = () => {
      setIsCursorVisible(true);
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
      cursorTimeoutRef.current = setTimeout(() => {
        setIsCursorVisible(false);
      }, 1500);
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("keydown", handleActivity);

    cursorTimeoutRef.current = setTimeout(() => {
      setIsCursorVisible(false);
    }, 1500);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, []);

  // 스폰서 및 배경 동영상 설정 불러오기
  const fetchMediaSettings = async (cId) => {
    if (!cId) {
      setSponsors([]);
      setVideoSettings({ standbyVideoUrl: "", rankingVideoUrl: "", introVideoUrl: "" });
      return;
    }
    try {
      const condition = [where("contestId", "==", cId)];
      const data = await sponsorQuery.getDocuments("contest_sponsor_list", condition);
      if (data && data.length > 0 && data[0]?.sponsors) {
        setSponsors(data[0].sponsors || []);
        setVideoSettings({
          standbyVideoUrl: data[0]?.standbyVideoUrl || "",
          rankingVideoUrl: data[0]?.rankingVideoUrl || "",
          introVideoUrl: data[0]?.introVideoUrl || "",
        });
      } else {
        // 🌟 9회 대회처럼 광고를 세팅하지 않은 대회는 이전 대회 광고를 완전히 비움!
        setSponsors([]);
        setVideoSettings({
          standbyVideoUrl: "",
          rankingVideoUrl: "",
          introVideoUrl: "",
        });
      }
    } catch (error) {
      console.error("미디어 설정 로드 실패:", error);
      setSponsors([]);
    }
  };

  useEffect(() => {
    if (contestId) {
      fetchMediaSettings(contestId);
    }
  }, [contestId]);

  // 전체화면 토글
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // 키보드 이벤트 리스너 (F: 전체화면, D: DB 선택 모달)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
      if (e.key === "d" || e.key === "D") {
        setIsDbModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 🌟 현재 송출 모드 결정
  let currentMode = broadcastData?.mode || "STANDBY";

  if (!broadcastData?.mode && legacyStageData?.screen?.status?.playStart) {
    currentMode = "RANKING";
  }

  // 1. 스테이지 정보
  const stageInfo = broadcastData?.stageInfo || {
    categoryTitle: legacyStageData?.categoryTitle || legacyStageData?.screen?.gradeTitle || "",
    gradeTitle: legacyStageData?.gradeTitle || "",
    gradeId: legacyStageData?.gradeId || "",
    stageNumber: legacyStageData?.stageId || "",
  };

  // 2. 실시간 선수 소개 정보
  const activePlayer = broadcastData?.activePlayer || broadcastData?.player || null;

  // 3. 순위 발표 데이터
  const rankingData =
    broadcastData?.rankingData ||
    legacyStageData?.screen?.players ||
    [];

  // 1위 우승 선수 추출
  const top1Player =
    rankingData.find((p) => (p.playerRank || p.rank || 0) === 1) ||
    activePlayer ||
    null;

  // 🏁 순위 발표 종료 시 다음 종목 대기 화면으로 복귀 핸들러
  const handleFinishCeremony = async () => {
    if (!contestId) return;
    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, {
        mode: "STANDBY",
        activePlayer: null,
        specialScreenData: null,
        calloutData: null,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error("대기 화면 복귀 오류:", error);
    }
  };

  // 📋 순위표로 다시 돌아가기 핸들러
  const handleBackToRanking = async () => {
    if (!contestId) return;
    try {
      await updateBroadcast.updateData(`currentBroadcast/${contestId}`, {
        mode: "RANKING",
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error("순위표 복귀 오류:", error);
    }
  };

  const filteredContests = contestList.filter((c) =>
    (c.contestTitle || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden bg-black select-none ${
        !isCursorVisible ? "cursor-none" : ""
      }`}
    >
      {/* ========================================================================================= */}
      {/* 🌟 전체화면 & 데이터베이스(DB) 변경 컨트롤 버튼 바 (마우스 호버 시 1.5초 표시) */}
      {/* ========================================================================================= */}
      <div
        className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 transition-all duration-300 ${
          isCursorVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* 🗄️ 데이터베이스(대회) 변경 버튼 */}
        <button
          onClick={() => setIsDbModalOpen(true)}
          title="데이터베이스(대회) 변경 (단축키 D)"
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/75 hover:bg-slate-900 text-amber-300 hover:text-amber-200 border border-amber-500/50 backdrop-blur-xl shadow-[0_4px_20px_rgba(251,191,36,0.3)] transition-all cursor-pointer text-xs font-bold font-mono"
        >
          <DatabaseOutlined className="text-amber-400 text-sm" />
          <span className="max-w-[160px] truncate">{contestTitle || "DB 선택"}</span>
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px] text-amber-300 border border-amber-500/40">
            변경
          </span>
        </button>

        {/* ⛶ 전체화면 전환 버튼 */}
        <button
          onClick={toggleFullscreen}
          title="전체화면 전환 (단축키 F)"
          className="p-3 rounded-full bg-black/75 hover:bg-slate-900 backdrop-blur-xl text-white/70 hover:text-white border border-white/20 transition-all duration-300 shadow-xl cursor-pointer"
        >
          {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        </button>
      </div>

      {/* ========================================================================================= */}
      {/* 1. 모드별 메인 씬 렌더링 */}
      {/* ========================================================================================= */}

      {/* ① 대기 및 종목 안내 씬 */}
      {currentMode === "STANDBY" && (
        <StandbyStageScene
          contestTitle={contestTitle}
          stageInfo={stageInfo}
          sponsors={sponsors}
          backgroundVideoUrl={videoSettings.standbyVideoUrl}
          colorTheme={broadcastData?.colorTheme || "GOLD"}
        />
      )}

      {/* ② 선수 입장 전체 화면 스포트라이트 씬 */}
      {currentMode === "ATHLETE_INTRO" && (
        <AthleteIntroScene
          contestTitle={contestTitle}
          player={activePlayer}
          stageInfo={stageInfo}
          backgroundVideoUrl={videoSettings.introVideoUrl}
          colorTheme={broadcastData?.colorTheme || "GOLD"}
        />
      )}

      {/* ③ ⚔️ 비교심사 호명 씬 */}
      {currentMode === "COMPARISON_CALLOUT" && (
        <ComparisonCalloutScene
          contestTitle={contestTitle}
          stageInfo={stageInfo}
          calloutData={broadcastData?.calloutData}
          backgroundVideoUrl={videoSettings.rankingVideoUrl}
          colorTheme={broadcastData?.colorTheme || "GOLD"}
        />
      )}

      {/* ④ 🔥 포즈다운 배틀 씬 (광고 융합) */}
      {currentMode === "POSEDOWN" && (
        <PosedownScene
          contestTitle={contestTitle}
          stageInfo={stageInfo}
          currentPlayers={stageInfo?.players || legacyStageData?.screen?.players || []}
          sponsors={sponsors}
          backgroundVideoUrl={videoSettings.introVideoUrl || videoSettings.standbyVideoUrl}
          colorTheme={broadcastData?.colorTheme || "RED"}
        />
      )}

      {/* ④ 스폰서 광고 씬 (스크린골프 스타일 점수 집계중 화면) */}
      {currentMode === "COMMERCIAL" && (
        <CommercialScene
          contestTitle={contestTitle}
          stageInfo={stageInfo}
          sponsors={sponsors}
        />
      )}

      {/* ⑤ 2열 순위 발표 씬 */}
      {currentMode === "RANKING" && (
        <RankingCeremonyScene
          contestTitle={contestTitle}
          categoryTitle={stageInfo.categoryTitle || "공식 시상식"}
          gradeTitle={stageInfo.gradeTitle || ""}
          gradeId={stageInfo.gradeId || legacyStageData?.gradeId || ""}
          rankingData={rankingData}
          backgroundVideoUrl={videoSettings.rankingVideoUrl}
          colorTheme={broadcastData?.colorTheme || "GOLD"}
          onFinishCeremony={handleFinishCeremony}
        />
      )}

      {/* ⑥ 👑 1위 단독 챔피언 세레모니 씬 */}
      {currentMode === "CHAMPION_SHOWCASE" && (
        <ChampionShowcaseScene
          contestTitle={contestTitle}
          stageInfo={stageInfo}
          topPlayer={broadcastData?.topPlayer || top1Player}
          backgroundVideoUrl={videoSettings.rankingVideoUrl}
          colorTheme={broadcastData?.colorTheme || "GOLD"}
          onBackToRanking={handleBackToRanking}
          onFinishCeremony={handleFinishCeremony}
        />
      )}

      {/* ⑦ 특수 화면 씬 */}
      {currentMode === "SPECIAL_SCREEN" && (
        <SpecialStageScene
          contestTitle={contestTitle}
          stageInfo={stageInfo}
          specialData={broadcastData?.specialScreenData}
          backgroundVideoUrl={videoSettings.rankingVideoUrl}
          colorTheme={broadcastData?.colorTheme || "GOLD"}
          onFinish={handleFinishCeremony}
        />
      )}

      {/* ========================================================================================= */}
      {/* 🗄️ [초호화 전광판 데이터베이스(대회) 선택 팝업 모달] */}
      {/* ========================================================================================= */}
      <Modal
        open={isDbModalOpen}
        onCancel={() => setIsDbModalOpen(false)}
        footer={null}
        width={720}
        centered
        destroyOnClose
        className="stage-db-selector-modal"
        styles={{
          content: {
            backgroundColor: "#090d16",
            border: "2px solid rgba(251, 191, 36, 0.5)",
            borderRadius: "24px",
            boxShadow: "0 25px 80px rgba(0, 0, 0, 0.9)",
            padding: "24px",
          },
        }}
      >
        <div className="space-y-4 text-white">
          
          {/* 모달 상단 헤더 */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 text-xl shadow-lg">
                <DatabaseOutlined />
              </div>
              <div>
                <h2 className="text-lg font-black text-white m-0">전광판 데이터베이스(대회) 선택</h2>
                <p className="text-xs text-slate-400 m-0">
                  전광판이 실시간으로 바라볼 대회 데이터베이스를 선택하세요.
                </p>
              </div>
            </div>

            <button
              onClick={loadAllContests}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <ReloadOutlined className={isContestLoading ? "animate-spin" : ""} />
              <span>새로고침</span>
            </button>
          </div>

          {/* 현재 연결된 활성 대회 정보 */}
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <div>
                <span className="text-[10px] text-amber-400/80 font-mono font-bold uppercase block">
                  CURRENT CONNECTED DATABASE
                </span>
                <span className="text-sm font-black text-amber-200">{contestTitle}</span>
              </div>
            </div>
            <Tag color="gold" className="font-mono font-black text-xs mr-0">
              실시간 연결중
            </Tag>
          </div>

          {/* 대회 검색 입력창 */}
          <Input
            placeholder="대회명 검색..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-900 border-slate-700 text-white rounded-xl py-2.5"
            allowClear
          />

          {/* 대회 카드 리스트 */}
          <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
            {filteredContests.length === 0 ? (
              <div className="py-10 text-center text-slate-500 font-bold">
                {isContestLoading ? "대회 목록을 불러오는 중..." : "검색된 대회가 없습니다."}
              </div>
            ) : (
              filteredContests.map((notice) => {
                const isCurrent =
                  notice.id === globalActiveContest?.contestNoticeId ||
                  notice.contestTitle === contestTitle;

                return (
                  <div
                    key={notice.id}
                    onClick={() => handleSelectContest(notice)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent
                        ? "bg-slate-900 border-amber-400 ring-2 ring-amber-400/30 shadow-lg shadow-amber-400/10"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-600 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-white truncate">
                          {notice.contestTitle}
                        </span>
                        {notice.contestStatus && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-bold">
                            {notice.contestStatus}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3 mt-1">
                        <span>일자: {notice.contestDate || "미정"}</span>
                        <span>장소: {notice.contestLocation || "-"}</span>
                      </div>
                    </div>

                    {isCurrent ? (
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-400 bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-400/40 shrink-0">
                        <CheckCircleFilled /> 연결됨
                      </div>
                    ) : (
                      <button className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md shrink-0 border-none cursor-pointer">
                        이 DB로 연결
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="text-[11px] text-slate-500 text-center pt-2">
            💡 단축키: <span className="text-slate-300 font-mono">D</span> (DB 선택창), <span className="text-slate-300 font-mono">F</span> (전체화면)
          </div>

        </div>
      </Modal>

    </div>
  );
};

export default StageLiveDisplay;
