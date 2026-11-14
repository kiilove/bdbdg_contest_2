import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import {
  MessageCircle,
  Send,
  X,
  Volume2,
  VolumeX,
  Check,
  AlertTriangle,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
} from "lucide-react";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import { useFirebaseRealtimeGetDocument } from "../../hooks/useFirebaseRealtime";
import {
  STATION_ROLES,
  resolveDedicatedStationRole,
  getAllowedTargetsForStation,
  getContextualPresets,
  getQuickBannerReplies,
  createClientInstanceId,
  formatStationLabel,
  formatTargetLabel,
  isPacketVisibleToStation,
  shouldAlertStation,
  playIntercomTone,
  subscribeLiveIntercom,
  sendIntercomPacket,
  acknowledgeIntercomPacket,
  clearIntercomChannel,
} from "../../utils/liveIntercomEngine";

const RECENT_ALERT_WINDOW_MS = 1000 * 60 * 15; // 최근 15분 이내 미확인 메시지는 새로고침 후에도 시각 표시 유지

// 카카오톡 스타일 시각 포맷 (예: 오후 1:42)
const formatKakaoTime = (ts) => {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
};

// 발신자 역할별 카톡형 스쿼클 프로필 배지 스타일
const getAvatarSpec = (roleKey = "", label = "") => {
  if (roleKey === "HQ") {
    return { text: "본부", bg: "#1E293B", fg: "#FFFFFF" };
  }
  if (roleKey === "HEAD_JUDGE") {
    return { text: "위원장", bg: "#7C2D12", fg: "#FEF08A" };
  }
  if (roleKey === "MC") {
    return { text: "사회", bg: "#065F46", fg: "#FFFFFF" };
  }
  if (String(roleKey).startsWith("JUDGE_")) {
    const seatNo = String(roleKey).replace("JUDGE_", "");
    return { text: `${seatNo}번`, bg: "#3B5BDB", fg: "#FFFFFF" };
  }
  return {
    text: String(label || "안내").slice(0, 2),
    bg: "#475569",
    fg: "#FFFFFF",
  };
};

// 특정 대화방(roomKey)과 패킷이 매칭되는지 판별
const isPacketInRoom = (pkt, myRole, roomKey) => {
  if (!pkt || !myRole || !roomKey) return false;
  if (roomKey === "__ALL__") return true;

  // 전체 공지 대화방 (전체 심판 공지방 / 전체 진행석 공지방)
  if (
    roomKey === "ALL_JUDGES" ||
    roomKey === "ALL" ||
    roomKey === "ALL_STATIONS"
  ) {
    return (
      pkt.toScope === roomKey ||
      (roomKey === "ALL" && pkt.toScope === "ALL_STATIONS")
    );
  }

  // 1:1 대화방 (예: 본부석 <-> 3번 심판, 본부석 <-> 심판위원장, 사회자 <-> 본부석)
  const sentByMeToRoom = pkt.fromRole === myRole && pkt.toScope === roomKey;
  const sentByRoomToMe =
    pkt.fromRole === roomKey &&
    (pkt.toScope === myRole ||
      pkt.toScope === "ALL" ||
      pkt.toScope === "ALL_STATIONS" ||
      (myRole === "HEAD_JUDGE" && pkt.toScope === "ALL_JUDGES") ||
      (String(myRole).startsWith("JUDGE_") && pkt.toScope === "ALL_JUDGES"));

  return sentByMeToRoom || sentByRoomToMe;
};

const TALLY_KEYFRAMES_CSS = `
@keyframes bdbdgTallyUrgentFrame {
  0%, 100% {
    box-shadow: inset 0 0 0 8px rgba(220, 38, 38, 0.95), inset 0 0 36px rgba(220, 38, 38, 0.50);
  }
  50% {
    box-shadow: inset 0 0 0 10px rgba(250, 204, 21, 0.98), inset 0 0 44px rgba(250, 204, 21, 0.58);
  }
}
@keyframes bdbdgTallyKakaoFrame {
  0%, 100% {
    box-shadow: inset 0 0 0 7px rgba(254, 229, 0, 0.96), inset 0 0 32px rgba(250, 204, 21, 0.45);
  }
  50% {
    box-shadow: inset 0 0 0 8px rgba(59, 130, 246, 0.92), inset 0 0 34px rgba(59, 130, 246, 0.42);
  }
}
@keyframes bdbdgKakaoFloatPulse {
  0%, 100% { transform: translateY(0px) scale(1); }
  50% { transform: translateY(-3px) scale(1.03); }
}
`;

const LiveIntercomDock = () => {
  const location = useLocation();
  const { currentContest } = useContext(CurrentContestContext);
  const contestId = currentContest?.contests?.id || currentContest?.id || "";

  // /contestmonitoring/all 내부 탭 전환 신호 동기화
  const [syncedAllTabRole, setSyncedAllTabRole] = useState("HQ");

  const activeRole = useMemo(
    () => resolveDedicatedStationRole(location.pathname, syncedAllTabRole),
    [location.pathname, syncedAllTabRole]
  );

  const allowedTargetConfig = useMemo(
    () => getAllowedTargetsForStation(activeRole),
    [activeRole]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [packets, setPackets] = useState([]);
  const [toScope, setToScope] = useState("HQ");
  const [viewAllRooms, setViewAllRooms] = useState(false);
  const [priority, setPriority] = useState("normal");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [bannerFolded, setBannerFolded] = useState(false);
  const [dismissedIds, setDismissedIds] = useState({});
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("bdbdg_intercom_muted") === "1";
    } catch {
      return false;
    }
  });

  const instanceIdRef = useRef(createClientInstanceId());
  const tonedPacketIdsRef = useRef(new Set());
  const autoAckingIdsRef = useRef(new Set());
  const initialSnapshotDoneRef = useRef(false);
  const listBottomRef = useRef(null);

  // 현재 무대에 배정된 실시간 심판 좌석 정보 (HQ · 심판위원장 화면에서 1:1 심판 톡방 구성)
  const { data: stageRealtime } = useFirebaseRealtimeGetDocument(
    activeRole && allowedTargetConfig.allowIndividualJudges && contestId
      ? `currentStage/${contestId}`
      : null
  );

  const stageJudges = useMemo(() => {
    const raw = stageRealtime?.judges;
    const arr = Array.isArray(raw)
      ? raw.filter(Boolean)
      : raw && typeof raw === "object"
      ? Object.values(raw).filter(Boolean)
      : [];
    if (arr.length > 0) {
      return arr
        .map((j, idx) => ({
          seatIndex: Number(j?.seatIndex || idx + 1),
          judgeName: j?.judgeName || "",
          isLogined: Boolean(j?.isLogined),
          isEnd: Boolean(j?.isEnd),
        }))
        .sort((a, b) => a.seatIndex - b.seatIndex);
    }
    const fallbackCount = Number(stageRealtime?.stageJudgeCount) || 7;
    return Array.from({ length: fallbackCount }, (_, i) => ({
      seatIndex: i + 1,
      judgeName: "",
      isLogined: false,
      isEnd: false,
    }));
  }, [stageRealtime?.judges, stageRealtime?.stageJudgeCount]);

  const judgeNameMap = useMemo(() => {
    const map = {};
    stageJudges.forEach((j) => {
      if (j.seatIndex && j.judgeName) {
        map[j.seatIndex] = j.judgeName;
      }
    });
    return map;
  }, [stageJudges]);

  // 화면 전환 시 허용된 기본 대화방으로 자동 정렬
  useEffect(() => {
    if (!activeRole) return;
    setToScope((prev) => {
      const isAllowedGroup = allowedTargetConfig.groupTargets.some(
        (t) => t.key === prev
      );
      const isAllowedJudge =
        allowedTargetConfig.allowIndividualJudges &&
        String(prev || "").startsWith("JUDGE_");
      if (isAllowedGroup || isAllowedJudge) return prev;
      return allowedTargetConfig.defaultTarget;
    });
  }, [activeRole, allowedTargetConfig]);

  // 외부 상단 버튼 열기 이벤트 및 /contestmonitoring/all 탭 동기화
  useEffect(() => {
    const handleExternalOpen = (e) => {
      const requestedScope = e?.detail?.toScope;
      if (requestedScope) {
        const isAllowedGroup = allowedTargetConfig.groupTargets.some(
          (t) => t.key === requestedScope
        );
        const isAllowedJudge =
          allowedTargetConfig.allowIndividualJudges &&
          String(requestedScope).startsWith("JUDGE_");
        if (isAllowedGroup || isAllowedJudge) {
          setToScope(requestedScope);
          setViewAllRooms(false);
        }
      }
      setIsOpen(true);
    };
    const handleRoleSync = (e) => {
      if (e?.detail?.role && STATION_ROLES[e.detail.role]) {
        setSyncedAllTabRole(e.detail.role);
      }
    };
    window.addEventListener("bdbdg:open-intercom", handleExternalOpen);
    window.addEventListener("bdbdg:intercom-role-sync", handleRoleSync);
    return () => {
      window.removeEventListener("bdbdg:open-intercom", handleExternalOpen);
      window.removeEventListener("bdbdg:intercom-role-sync", handleRoleSync);
    };
  }, [allowedTargetConfig]);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("bdbdg_intercom_muted", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  // 실시간 소켓 구독
  useEffect(() => {
    if (!contestId || !activeRole) {
      setPackets([]);
      setIsConnected(false);
      return undefined;
    }

    initialSnapshotDoneRef.current = false;
    tonedPacketIdsRef.current = new Set();

    const unsubscribe = subscribeLiveIntercom({
      contestId,
      onConnectionChange: setIsConnected,
      onPackets: (incomingList) => {
        setPackets(incomingList);

        if (!initialSnapshotDoneRef.current) {
          incomingList.forEach((p) => {
            if (p?.id) tonedPacketIdsRef.current.add(p.id);
          });
          initialSnapshotDoneRef.current = true;
          return;
        }

        incomingList.forEach((pkt) => {
          if (!pkt?.id || tonedPacketIdsRef.current.has(pkt.id)) return;
          tonedPacketIdsRef.current.add(pkt.id);

          if (shouldAlertStation(pkt, activeRole, instanceIdRef.current)) {
            setBannerFolded(false);
            if (!muted) {
              playIntercomTone(pkt.priority);
            }
          }
        });
      },
    });

    return () => unsubscribe();
  }, [contestId, activeRole, muted]);

  const myStationLabel = useMemo(
    () => formatStationLabel(activeRole),
    [activeRole]
  );

  // 아직 읽음(확인) 처리되지 않은 수신 메시지 목록
  const unackedAlertPackets = useMemo(() => {
    if (!activeRole) return [];
    const now = Date.now();
    return packets.filter((pkt) => {
      if (!pkt?.id) return false;
      if (dismissedIds[pkt.id]) return false;
      if (now - Number(pkt.createdAt || 0) > RECENT_ALERT_WINDOW_MS) {
        return false;
      }
      if (!shouldAlertStation(pkt, activeRole, instanceIdRef.current)) {
        return false;
      }
      if (pkt.acks?.[activeRole]) {
        return false;
      }
      return true;
    });
  }, [packets, activeRole, dismissedIds]);

  // 대화방별 안읽은 메시지 개수 집계 (카톡 빨간 숫자 배지용)
  const unreadBySenderRole = useMemo(() => {
    const counts = {};
    unackedAlertPackets.forEach((pkt) => {
      const sender = pkt.fromRole;
      if (sender) {
        counts[sender] = (counts[sender] || 0) + 1;
      }
    });
    return counts;
  }, [unackedAlertPackets]);

  const latestUnackedPacket =
    unackedAlertPackets.length > 0
      ? unackedAlertPackets[unackedAlertPackets.length - 1]
      : null;

  const hasUrgentUnacked = useMemo(
    () => unackedAlertPackets.some((p) => p.priority === "urgent"),
    [unackedAlertPackets]
  );

  // 상단 헤더(LiveMonitoringHub 등)에 미확인 배지 상태 공유
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("bdbdg:intercom-unread-state", {
        detail: {
          unreadCount: unackedAlertPackets.length,
          hasUrgent: hasUrgentUnacked,
          activeRole,
          isConnected,
        },
      })
    );
  }, [
    unackedAlertPackets.length,
    hasUrgentUnacked,
    activeRole,
    isConnected,
  ]);

  const visiblePackets = useMemo(
    () =>
      packets.filter((p) =>
        isPacketVisibleToStation(p, activeRole, activeRole === "HQ" && viewAllRooms)
      ),
    [packets, activeRole, viewAllRooms]
  );

  const roomPackets = useMemo(() => {
    if (viewAllRooms) return visiblePackets;
    return visiblePackets.filter((p) => isPacketInRoom(p, activeRole, toScope));
  }, [visiblePackets, viewAllRooms, activeRole, toScope]);

  // 카카오톡 자동 읽음 처리: 대화창이 열려 있고 해당 대화방을 보고 있으면 자동으로 '읽음' 처리!
  useEffect(() => {
    if (!isOpen || !contestId || !activeRole) return;
    const unreadInOpenRoom = unackedAlertPackets.filter(
      (pkt) => viewAllRooms || isPacketInRoom(pkt, activeRole, toScope)
    );
    if (unreadInOpenRoom.length === 0) return;

    unreadInOpenRoom.forEach((pkt) => {
      if (autoAckingIdsRef.current.has(pkt.id)) return;
      autoAckingIdsRef.current.add(pkt.id);
      setDismissedIds((prev) => ({ ...prev, [pkt.id]: true }));
      acknowledgeIntercomPacket({
        contestId,
        packetId: pkt.id,
        stationRole: activeRole,
        stationLabel: myStationLabel,
      }).catch(() => {
        autoAckingIdsRef.current.delete(pkt.id);
      });
    });
  }, [
    isOpen,
    contestId,
    activeRole,
    toScope,
    viewAllRooms,
    unackedAlertPackets,
    myStationLabel,
  ]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        listBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    }
  }, [isOpen, roomPackets.length, toScope, viewAllRooms]);

  const contextualPresets = useMemo(
    () => getContextualPresets(activeRole, toScope),
    [activeRole, toScope]
  );

  const quickBannerReplies = useMemo(
    () => getQuickBannerReplies(activeRole),
    [activeRole]
  );

  const isTargetAllowedForMe = useCallback(
    (candidateScope) => {
      if (!candidateScope || !activeRole) return false;
      const inGroups = allowedTargetConfig.groupTargets.some(
        (t) => t.key === candidateScope
      );
      if (inGroups) return true;
      if (
        allowedTargetConfig.allowIndividualJudges &&
        String(candidateScope).startsWith("JUDGE_")
      ) {
        return true;
      }
      return false;
    },
    [activeRole, allowedTargetConfig]
  );

  const handleSend = useCallback(
    async (overrideText, overridePriority, overrideTarget) => {
      const finalText = String(overrideText ?? draft).trim();
      if (!finalText || !contestId || !activeRole || sending) return;

      const candidateTarget = overrideTarget || toScope;
      const finalTarget = isTargetAllowedForMe(candidateTarget)
        ? candidateTarget
        : allowedTargetConfig.defaultTarget;
      const finalPriority = overridePriority || priority || "normal";

      try {
        setSending(true);
        await sendIntercomPacket({
          contestId,
          fromRole: activeRole,
          fromLabel: myStationLabel,
          fromInstanceId: instanceIdRef.current,
          toScope: finalTarget,
          toLabel: formatTargetLabel(finalTarget, judgeNameMap),
          text: finalText,
          priority: finalPriority,
        });
        if (overrideText === undefined) {
          setDraft("");
          setPriority("normal");
        }
      } catch (err) {
        console.error("[LiveIntercom] 메시지 전송 실패:", err);
      } finally {
        setSending(false);
      }
    },
    [
      draft,
      contestId,
      activeRole,
      sending,
      toScope,
      isTargetAllowedForMe,
      allowedTargetConfig.defaultTarget,
      priority,
      myStationLabel,
      judgeNameMap,
    ]
  );

  const handleAck = async (pkt) => {
    if (!pkt?.id || !contestId || !activeRole) return;
    setDismissedIds((prev) => ({ ...prev, [pkt.id]: true }));
    try {
      await acknowledgeIntercomPacket({
        contestId,
        packetId: pkt.id,
        stationRole: activeRole,
        stationLabel: myStationLabel,
      });
    } catch (err) {
      console.error("[LiveIntercom] 읽음 처리 실패:", err);
    }
  };

  const handleAckAllUnacked = async () => {
    const targets = [...unackedAlertPackets];
    if (targets.length === 0) return;
    const nextMap = { ...dismissedIds };
    targets.forEach((p) => {
      nextMap[p.id] = true;
    });
    setDismissedIds(nextMap);

    for (const pkt of targets) {
      try {
        await acknowledgeIntercomPacket({
          contestId,
          packetId: pkt.id,
          stationRole: activeRole,
          stationLabel: myStationLabel,
        });
      } catch {
        // ignore
      }
    }
  };

  const handleQuickReplyAndAck = async (
    pkt,
    replyText,
    replyPriority = "normal"
  ) => {
    if (!pkt) return;
    const replyTarget = isTargetAllowedForMe(pkt.fromRole)
      ? pkt.fromRole
      : allowedTargetConfig.defaultTarget;
    await handleAck(pkt);
    await handleSend(replyText, replyPriority, replyTarget);
  };

  const handleOpenRoomForPacket = (pkt) => {
    if (pkt?.fromRole && isTargetAllowedForMe(pkt.fromRole)) {
      setToScope(pkt.fromRole);
      setViewAllRooms(false);
    }
    setIsOpen(true);
  };

  const handleOpenMessenger = () => {
    // 안 읽은 메시지가 있으면 보낸 사람의 대화방으로 바로 열어주기 (카톡 알림 터치와 동일!)
    if (
      latestUnackedPacket?.fromRole &&
      isTargetAllowedForMe(latestUnackedPacket.fromRole)
    ) {
      setToScope(latestUnackedPacket.fromRole);
      setViewAllRooms(false);
    }
    setIsOpen(true);
  };

  const handleClearAll = async () => {
    if (!contestId || activeRole !== "HQ") return;
    if (
      !window.confirm("현재 대회의 실시간 카톡 대화 기록을 모두 비우시겠습니까?")
    ) {
      return;
    }
    try {
      await clearIntercomChannel(contestId);
      setDismissedIds({});
    } catch (err) {
      console.error("[LiveIntercom] 대화 비우기 오류:", err);
    }
  };

  if (!contestId || !activeRole) return null;

  const roleMeta = STATION_ROLES[activeRole] || STATION_ROLES.HQ;
  const activeRoomTitle = viewAllRooms
    ? "전체 대화 모아보기"
    : formatTargetLabel(toScope, judgeNameMap);

  return (
    <div className="no-print print:hidden">
      <style>{TALLY_KEYFRAMES_CSS}</style>

      {/* [1단계] 시끄러운 대회장에서도 한눈에 들어오는 화면 외곽 불빛 알림 (터치 간섭 없음) */}
      {latestUnackedPacket && !isOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[1385] pointer-events-none"
          style={{
            animation: hasUrgentUnacked
              ? "bdbdgTallyUrgentFrame 0.8s ease-in-out infinite"
              : "bdbdgTallyKakaoFrame 1.2s ease-in-out infinite",
          }}
        />
      )}

      {/* [2단계] 친근한 카카오톡 스타일 상단 메시지 도착 카드 (확인/대화창 열기 전까지 유지) */}
      {latestUnackedPacket && !isOpen && !bannerFolded && (
        <div className="fixed top-3 inset-x-0 z-[1400] px-3 sm:px-5 flex justify-center pointer-events-none">
          <div
            className={`pointer-events-auto w-full max-w-[640px] rounded-[20px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.32)] border-2 bg-white text-[#191919] ${
              latestUnackedPacket.priority === "urgent"
                ? "border-[#EF4444]"
                : "border-[#FEE500]"
            }`}
          >
            {/* 카톡 감성 상단 바 (일반: 따뜻한 카톡 옐로우 / 긴급일 때만 레드) */}
            <div
              className={`px-4 py-2.5 flex items-center justify-between gap-2 ${
                latestUnackedPacket.priority === "urgent"
                  ? "bg-[#DC2626] text-white"
                  : "bg-[#FEE500] text-[#191919]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {latestUnackedPacket.priority === "urgent" ? (
                  <AlertTriangle size={17} strokeWidth={2.5} className="shrink-0" />
                ) : (
                  <MessageCircle
                    size={17}
                    strokeWidth={2.4}
                    className="shrink-0 fill-[#191919]"
                  />
                )}
                <span className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                  {latestUnackedPacket.priority === "urgent"
                    ? `긴급 메시지 도착 · ${latestUnackedPacket.fromLabel}`
                    : `${latestUnackedPacket.fromLabel}에서 톡이 도착했습니다`}
                </span>
                {unackedAlertPackets.length > 1 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FF3B30] text-white text-xs font-extrabold shrink-0 tabular-nums">
                    +{unackedAlertPackets.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold opacity-80">
                  {formatKakaoTime(latestUnackedPacket.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => setBannerFolded(true)}
                  className={`h-7 px-2.5 rounded-full text-xs font-bold inline-flex items-center gap-1 border-0 cursor-pointer ${
                    latestUnackedPacket.priority === "urgent"
                      ? "bg-black/25 hover:bg-black/35 text-white"
                      : "bg-black/10 hover:bg-black/15 text-[#191919]"
                  }`}
                >
                  <ChevronUp size={14} strokeWidth={2.2} />
                  <span>접어두기</span>
                </button>
              </div>
            </div>

            {/* 카톡 프로필 + 말풍선 본문 + 원터치 답장 */}
            <div className="p-4 sm:p-5 bg-[#BACEE0]/35 space-y-3.5">
              <div className="flex items-start gap-3">
                {(() => {
                  const av = getAvatarSpec(
                    latestUnackedPacket.fromRole,
                    latestUnackedPacket.fromLabel
                  );
                  return (
                    <div
                      className="w-11 h-11 rounded-[15px] flex items-center justify-center text-xs font-extrabold shrink-0 shadow-sm"
                      style={{ backgroundColor: av.bg, color: av.fg }}
                    >
                      {av.text}
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[#475569] mb-1">
                    {latestUnackedPacket.fromLabel}
                  </div>
                  <div className="inline-block max-w-full bg-white rounded-[18px] rounded-tl-[4px] px-4 py-3 shadow-sm border border-black/5 text-lg sm:text-xl font-extrabold text-[#191919] leading-snug break-words">
                    {latestUnackedPacket.text}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-black/10">
                {/* 터치 한 번으로 바로 답장 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {quickBannerReplies.map((qr, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={sending}
                      onClick={() =>
                        handleQuickReplyAndAck(
                          latestUnackedPacket,
                          qr.text,
                          qr.priority
                        )
                      }
                      className="h-9 px-3.5 rounded-full bg-white hover:bg-[#FEF9C3] text-[#191919] text-xs sm:text-sm font-bold border border-black/15 shadow-sm cursor-pointer transition-colors"
                    >
                      💬 {qr.text}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleOpenRoomForPacket(latestUnackedPacket)}
                    className="h-9 px-3.5 rounded-full bg-white/80 hover:bg-white text-[#334155] text-xs font-bold border border-black/15 cursor-pointer"
                  >
                    대화방 열기
                  </button>
                </div>

                {/* 확인(닫기) 버튼 */}
                <div className="flex items-center gap-2 shrink-0">
                  {unackedAlertPackets.length > 1 && (
                    <button
                      type="button"
                      onClick={handleAckAllUnacked}
                      className="h-10 px-3.5 rounded-[12px] bg-white hover:bg-slate-100 text-[#334155] text-xs font-bold border border-black/15 cursor-pointer"
                    >
                      모두 읽음({unackedAlertPackets.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAck(latestUnackedPacket)}
                    className="flex-1 sm:flex-initial h-10 px-5 rounded-[12px] bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] text-sm font-extrabold inline-flex items-center justify-center gap-1.5 shadow-sm border border-black/10 cursor-pointer"
                  >
                    <Check size={17} strokeWidth={2.8} />
                    <span>확인했어요</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* [3단계] 잠시 접어두었을 때 상단에 남는 미니 카톡 알림 바 */}
      {latestUnackedPacket && !isOpen && bannerFolded && (
        <div className="fixed top-2 inset-x-0 z-[1395] px-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto max-w-[600px] w-full h-11 px-4 rounded-full bg-[#FEE500] text-[#191919] shadow-xl border-2 border-[#191919]/15 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setBannerFolded(false)}
              className="flex-1 min-w-0 flex items-center gap-2 text-left bg-transparent border-0 text-[#191919] cursor-pointer p-0"
            >
              <span className="px-2 py-0.5 rounded-full bg-[#FF3B30] text-white text-xs font-extrabold shrink-0">
                새 톡 {unackedAlertPackets.length}
              </span>
              <span className="text-xs sm:text-sm font-extrabold shrink-0">
                {latestUnackedPacket.fromLabel}:
              </span>
              <span className="text-xs sm:text-sm font-bold truncate">
                {latestUnackedPacket.text}
              </span>
              <ChevronDown size={15} className="shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => handleAck(latestUnackedPacket)}
              className="h-7 px-3 rounded-full bg-[#191919] text-white text-xs font-bold border-0 cursor-pointer shrink-0"
            >
              읽음 확인
            </button>
          </div>
        </div>
      )}

      {/* 우측 하단 카카오톡 스타일 실시간 톡 창 */}
      {isOpen ? (
        <div className="fixed bottom-4 right-4 z-[1350] w-[calc(100vw-1.5rem)] sm:w-[440px] max-h-[calc(100vh-2rem)] bg-[#BACEE0] rounded-[20px] border border-black/15 shadow-[0_24px_60px_rgba(0,0,0,0.28)] flex flex-col overflow-hidden">
          {/* 상단 카톡 헤더 */}
          <div className="px-4 py-3 bg-[#A9BDCE] text-[#191919] border-b border-black/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-[11px] bg-[#FEE500] text-[#191919] flex items-center justify-center shadow-sm shrink-0">
                <MessageCircle
                  size={17}
                  strokeWidth={2.3}
                  className="fill-[#191919]"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold tracking-tight truncate">
                    {activeRoomTitle}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isConnected ? "bg-[#16a34a]" : "bg-[#f59e0b]"
                    }`}
                    title={isConnected ? "실시간 연결됨" : "연결 확인 중"}
                  />
                </div>
                <div className="text-[11px] font-semibold text-[#334155] truncate">
                  내 프로필: {myStationLabel}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {activeRole === "HQ" && (
                <button
                  type="button"
                  onClick={() => setViewAllRooms((v) => !v)}
                  title="전체 대화방 한꺼번에 보기"
                  className={`h-7 px-2.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 border-0 cursor-pointer ${
                    viewAllRooms
                      ? "bg-[#191919] text-[#FEE500]"
                      : "bg-white/60 hover:bg-white/85 text-[#191919]"
                  }`}
                >
                  <Layers size={12} strokeWidth={2} />
                  <span>{viewAllRooms ? "대화방별" : "전체보기"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={toggleMute}
                title={muted ? "알림음 켜기" : "알림음 끄기"}
                className={`w-8 h-8 rounded-full inline-flex items-center justify-center border-0 cursor-pointer ${
                  muted
                    ? "bg-[#FEE2E2] text-[#DC2626]"
                    : "bg-white/60 hover:bg-white/85 text-[#191919]"
                }`}
              >
                {muted ? (
                  <VolumeX size={15} strokeWidth={2} />
                ) : (
                  <Volume2 size={15} strokeWidth={2} />
                )}
              </button>

              {activeRole === "HQ" && visiblePackets.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  title="대화 내용 비우기"
                  className="w-8 h-8 rounded-full bg-white/60 hover:bg-[#FEE2E2] hover:text-[#DC2626] text-[#334155] inline-flex items-center justify-center border-0 cursor-pointer"
                >
                  <Trash2 size={14} strokeWidth={1.9} />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/60 hover:bg-white/90 text-[#191919] inline-flex items-center justify-center border-0 cursor-pointer"
                aria-label="창 닫기"
              >
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {/* 대화 상대방(톡방) 탭 선택 바 — 빨간 안읽음 숫자 배지 표시 */}
          <div className="px-3 py-2.5 bg-white/95 border-b border-black/10 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {allowedTargetConfig.groupTargets.map((t) => {
                const selected = !viewAllRooms && toScope === t.key;
                const roomUnread = unreadBySenderRole[t.key] || 0;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setToScope(t.key);
                      setViewAllRooms(false);
                    }}
                    className={`h-8 px-3 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 border cursor-pointer transition-all ${
                      selected
                        ? "bg-[#FEE500] text-[#191919] border-[#EAB308] shadow-sm"
                        : "bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#3F3F46] border-transparent"
                    }`}
                  >
                    <span>
                      {t.key === "ALL_JUDGES" ? "📢 심판 전체공지" : t.label}
                    </span>
                    {roomUnread > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3B30] text-white text-[10px] font-extrabold inline-flex items-center justify-center tabular-nums">
                        {roomUnread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 심판 1:1 톡방 선택 (본부석 · 심판위원장 전용) */}
            {allowedTargetConfig.allowIndividualJudges && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {stageJudges.map((j) => {
                  const key = `JUDGE_${j.seatIndex}`;
                  const selected = !viewAllRooms && toScope === key;
                  const roomUnread = unreadBySenderRole[key] || 0;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setToScope(key);
                        setViewAllRooms(false);
                      }}
                      className={`h-7 px-2.5 rounded-full text-[11px] inline-flex items-center gap-1 border cursor-pointer transition-all ${
                        selected
                          ? "bg-[#191919] text-[#FEE500] border-[#191919] font-extrabold shadow-sm"
                          : roomUnread > 0
                          ? "bg-[#FFF1F2] text-[#BE123C] border-[#FDA4AF] font-extrabold"
                          : "bg-white hover:bg-[#F4F4F5] text-[#3F3F46] border-black/10 font-semibold"
                      }`}
                    >
                      <span>
                        {j.seatIndex}번{j.judgeName ? ` ${j.judgeName}` : ""}
                      </span>
                      {roomUnread > 0 ? (
                        <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-[#FF3B30] text-white text-[10px] font-extrabold inline-flex items-center justify-center">
                          {roomUnread}
                        </span>
                      ) : (
                        stageRealtime?.stageId && (
                          <span
                            className={
                              selected
                                ? "text-[#FEE500]"
                                : j.isEnd
                                ? "text-[#16a34a]"
                                : "text-[#d97706]"
                            }
                            title={j.isEnd ? "채점제출 완료" : "채점 진행 중"}
                          >
                            {j.isEnd ? "✓" : "·"}
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 카카오톡 대화방 본문 (#BACEE0 하늘색 배경 + 흰색/노란색 말풍선 + 숫자 1 읽음 표시) */}
          <div className="flex-1 min-h-[230px] max-h-[300px] overflow-y-auto px-3.5 py-3.5 space-y-3 bg-[#BACEE0]">
            {roomPackets.length === 0 ? (
              <div className="h-[195px] flex flex-col items-center justify-center text-center px-4 gap-1.5">
                <div className="w-11 h-11 rounded-full bg-white/60 text-[#334155] flex items-center justify-center mb-1">
                  <MessageCircle size={22} strokeWidth={1.8} />
                </div>
                <span className="text-xs sm:text-sm font-extrabold text-[#1E293B]">
                  {activeRoomTitle} 대화방입니다
                </span>
                <span className="text-xs text-[#334155]/85 leading-relaxed">
                  아래 자주 쓰는 말을 누르거나 메시지를 입력해 카톡처럼 편하게 대화하세요.
                </span>
              </div>
            ) : (
              roomPackets.map((pkt) => {
                const isMine = pkt.fromRole === activeRole;
                const ackKeys = Object.keys(pkt.acks || {});
                const isJudgeBroadcast =
                  pkt.toScope === "ALL_JUDGES" && stageJudges.length > 0;

                // 카카오톡 '안읽음 숫자' 계산 (상대가 읽으면 즉시 사라짐!)
                let unreadCountForMyMsg = 0;
                if (isMine) {
                  if (isJudgeBroadcast) {
                    const readSeats = stageJudges.filter(
                      (j) => pkt.acks?.[`JUDGE_${j.seatIndex}`]
                    ).length;
                    unreadCountForMyMsg = Math.max(
                      0,
                      stageJudges.length - readSeats
                    );
                  } else {
                    unreadCountForMyMsg = ackKeys.length > 0 ? 0 : 1;
                  }
                }

                if (isMine) {
                  return (
                    <div key={pkt.id} className="flex flex-col items-end">
                      {viewAllRooms && (
                        <span className="text-[10px] font-bold text-[#334155] mb-0.5 mr-1">
                          {pkt.toLabel}에게 보냄
                        </span>
                      )}
                      <div className="flex items-end justify-end gap-1.5 max-w-[92%]">
                        <div className="flex flex-col items-end shrink-0 leading-none pb-0.5">
                          {unreadCountForMyMsg > 0 ? (
                            <span className="text-[11px] font-extrabold text-[#FFEB3B] drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)] tabular-nums mb-0.5">
                              {unreadCountForMyMsg}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-[#334155]/80 mb-0.5">
                              읽음
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-[#334155] whitespace-nowrap">
                            {formatKakaoTime(pkt.createdAt)}
                          </span>
                        </div>

                        <div className="rounded-[16px] rounded-tr-[3px] px-3.5 py-2.5 text-[13px] sm:text-sm leading-snug break-words shadow-sm bg-[#FEE500] text-[#191919] font-semibold">
                          {pkt.priority === "urgent" && (
                            <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-[#DC2626] text-white text-[10px] font-extrabold align-middle">
                              긴급
                            </span>
                          )}
                          {pkt.text}
                        </div>
                      </div>

                      {/* 전체 심판 공지일 때 몇 번 심판이 읽었는지 작고 직관적인 칩으로 표시 */}
                      {isJudgeBroadcast && (
                        <div className="flex flex-wrap justify-end gap-1 mt-1 max-w-[92%]">
                          {stageJudges.map((j) => {
                            const acked = Boolean(
                              pkt.acks?.[`JUDGE_${j.seatIndex}`]
                            );
                            return (
                              <span
                                key={j.seatIndex}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${
                                  acked
                                    ? "bg-white/80 text-[#15803d]"
                                    : "bg-black/10 text-[#334155]"
                                }`}
                              >
                                {j.seatIndex}번{acked ? " 읽음" : ""}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                const avatar = getAvatarSpec(pkt.fromRole, pkt.fromLabel);
                return (
                  <div key={pkt.id} className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isTargetAllowedForMe(pkt.fromRole)) {
                          setToScope(pkt.fromRole);
                          setViewAllRooms(false);
                        }
                      }}
                      className="w-9 h-9 rounded-[13px] flex items-center justify-center text-[11px] font-extrabold shrink-0 shadow-sm border-0 cursor-pointer"
                      style={{ backgroundColor: avatar.bg, color: avatar.fg }}
                      title={`${pkt.fromLabel} 대화방으로 전환`}
                    >
                      {avatar.text}
                    </button>

                    <div className="flex flex-col items-start min-w-0 max-w-[84%]">
                      <span className="text-[11px] font-bold text-[#1E293B] mb-1 ml-0.5">
                        {pkt.fromLabel}
                        {pkt.toScope === "ALL_JUDGES" ||
                        pkt.toScope === "ALL_STATIONS"
                          ? " · 전체공지"
                          : ""}
                      </span>

                      <div className="flex items-end gap-1.5 max-w-full">
                        <div
                          className={`rounded-[16px] rounded-tl-[3px] px-3.5 py-2.5 text-[13px] sm:text-sm leading-snug break-words shadow-sm ${
                            pkt.priority === "urgent"
                              ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5] font-bold"
                              : "bg-white text-[#191919] font-semibold"
                          }`}
                        >
                          {pkt.priority === "urgent" && (
                            <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-[#DC2626] text-white text-[10px] font-extrabold align-middle">
                              긴급
                            </span>
                          )}
                          {pkt.text}
                        </div>

                        <span className="text-[10px] font-medium text-[#334155] whitespace-nowrap shrink-0 pb-0.5">
                          {formatKakaoTime(pkt.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={listBottomRef} />
          </div>

          {/* 자주 쓰는 말 (터치 한 번으로 바로 전송) */}
          <div className="px-3 py-2 bg-[#F8FAFC] border-t border-black/10">
            <div className="text-[11px] font-bold text-[#475569] mb-1.5">
              자주 쓰는 말 · 누르면{" "}
              <strong className="text-[#191919]">
                {formatTargetLabel(toScope, judgeNameMap)}
              </strong>
              에 바로 전송됩니다
            </div>
            <div className="flex flex-wrap gap-1 max-h-[68px] overflow-y-auto">
              {contextualPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={sending}
                  onClick={() =>
                    handleSend(preset.text, preset.priority, toScope)
                  }
                  className={`h-7 px-2.5 rounded-full text-[11px] border cursor-pointer transition-colors truncate max-w-full ${
                    preset.priority === "urgent"
                      ? "bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA] font-bold"
                      : "bg-white hover:bg-[#FEF9C3] text-[#191919] border-black/15 font-semibold"
                  }`}
                >
                  {preset.text}
                </button>
              ))}
            </div>
          </div>

          {/* 카톡 스타일 하단 입력창 + 노란 전송 버튼 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-white border-t border-black/10 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() =>
                setPriority((p) => (p === "urgent" ? "normal" : "urgent"))
              }
              className={`h-10 px-2.5 rounded-[10px] text-xs font-extrabold border cursor-pointer shrink-0 transition-colors ${
                priority === "urgent"
                  ? "bg-[#DC2626] text-white border-[#DC2626]"
                  : "bg-[#F4F4F5] text-[#52525B] border-transparent hover:bg-[#E4E4E7]"
              }`}
              title="긴급 빨간 테두리 알림으로 보내기"
            >
              {priority === "urgent" ? "🚨 긴급" : "일반"}
            </button>

            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`${formatTargetLabel(
                toScope,
                judgeNameMap
              )}에 카톡처럼 메시지 입력...`}
              maxLength={200}
              className="flex-1 min-w-0 h-10 px-3.5 rounded-full border border-black/15 bg-[#F8FAFC] text-xs sm:text-sm text-[#191919] focus:outline-none focus:bg-white focus:border-[#EAB308]"
            />

            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="h-10 px-4 rounded-full bg-[#FEE500] hover:bg-[#FDD835] disabled:bg-[#F4F4F5] disabled:text-[#A1A1AA] text-[#191919] text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 border-0 cursor-pointer shrink-0 transition-colors"
            >
              <Send size={14} strokeWidth={2.2} />
              <span>전송</span>
            </button>
          </form>
        </div>
      ) : (
        /* 접힌 상태: 누구나 한눈에 아는 카톡 노란 말풍선 버튼 + 빨간 안읽음 배지 */
        <button
          type="button"
          onClick={handleOpenMessenger}
          style={
            unackedAlertPackets.length > 0
              ? {
                  animation: "bdbdgKakaoFloatPulse 0.9s ease-in-out infinite",
                }
              : undefined
          }
          className={`fixed bottom-4 right-4 z-[1300] h-13 py-3 px-4 rounded-full shadow-[0_10px_28px_rgba(0,0,0,0.24)] inline-flex items-center gap-2 cursor-pointer transition-transform active:scale-95 border-2 ${
            unackedAlertPackets.length > 0
              ? hasUrgentUnacked
                ? "bg-[#DC2626] text-white border-[#FEE500] font-extrabold"
                : "bg-[#FEE500] text-[#191919] border-[#191919] font-extrabold"
              : "bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] border-black/15 font-extrabold"
          }`}
        >
          <MessageCircle
            size={18}
            strokeWidth={2.3}
            className={
              unackedAlertPackets.length > 0 && hasUrgentUnacked
                ? "fill-white"
                : "fill-[#191919]"
            }
          />
          <span className="text-xs sm:text-sm">
            {roleMeta.shortLabel} 실시간 톡
          </span>
          {unackedAlertPackets.length > 0 && (
            <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#FF3B30] text-white text-xs font-extrabold tabular-nums inline-flex items-center justify-center shadow-sm">
              {unackedAlertPackets.length}
            </span>
          )}
        </button>
      )}
    </div>
  );
};

export default LiveIntercomDock;
