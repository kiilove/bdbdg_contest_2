import { onValue, ref, runTransaction, remove } from "firebase/database";
import { database } from "../firebase";
import {
  STATION_ROLES,
  TARGET_SCOPES,
  resolveDedicatedStationRole,
  getAllowedTargetsForStation,
  sanitizeStationTargetScope,
  getContextualPresets,
  getQuickBannerReplies,
  createClientInstanceId,
  formatStationLabel,
  formatTargetLabel,
  isPacketVisibleToStation,
  shouldAlertStation,
} from "./liveIntercomRules";

export {
  STATION_ROLES,
  TARGET_SCOPES,
  resolveDedicatedStationRole,
  getAllowedTargetsForStation,
  sanitizeStationTargetScope,
  getContextualPresets,
  getQuickBannerReplies,
  createClientInstanceId,
  formatStationLabel,
  formatTargetLabel,
  isPacketVisibleToStation,
  shouldAlertStation,
};

const MAX_BUFFER_PACKETS = 30;
const PACKET_TTL_MS = 1000 * 60 * 60 * 6; // 6시간 이후 오래된 패킷 자동 정리

/**
 * 보조 오디오 차임벨 (현장 소음 환경에서는 보조 수단으로만 동작)
 */
let sharedAudioCtx = null;
export const playIntercomTone = (priority = "normal") => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }

    const now = sharedAudioCtx.currentTime;
    const notes =
      priority === "urgent"
        ? [
            { freq: 880, start: 0, dur: 0.11, gain: 0.18 },
            { freq: 1174.66, start: 0.13, dur: 0.11, gain: 0.2 },
            { freq: 880, start: 0.26, dur: 0.14, gain: 0.18 },
          ]
        : [
            { freq: 659.25, start: 0, dur: 0.1, gain: 0.12 },
            { freq: 880, start: 0.11, dur: 0.14, gain: 0.14 },
          ];

    notes.forEach(({ freq, start, dur, gain }) => {
      const osc = sharedAudioCtx.createOscillator();
      const gainNode = sharedAudioCtx.createGain();
      osc.type = priority === "urgent" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now + start);

      gainNode.gain.setValueAtTime(0.0001, now + start);
      gainNode.gain.exponentialRampToValueAtTime(gain, now + start + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

      osc.connect(gainNode);
      gainNode.connect(sharedAudioCtx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  } catch {
    // 브라우저 자동재생 정책 등으로 실패 시 무시
  }
};

/**
 * 실시간 웹소켓 연결 상태(.info/connected) + 대회 채널(liveIntercom/{contestId}) 구독
 */
export const subscribeLiveIntercom = ({
  contestId,
  onPackets,
  onConnectionChange,
}) => {
  if (!contestId) return () => {};

  const connRef = ref(database, ".info/connected");
  const channelRef = ref(database, `liveIntercom/${contestId}/packets`);

  const unsubConn = onValue(
    connRef,
    (snap) => {
      onConnectionChange?.(Boolean(snap.val()));
    },
    () => {
      onConnectionChange?.(false);
    }
  );

  const unsubPackets = onValue(
    channelRef,
    (snap) => {
      const raw = snap.val();
      const list = Array.isArray(raw)
        ? raw.filter(Boolean)
        : raw && typeof raw === "object"
        ? Object.values(raw).filter(Boolean)
        : [];
      list.sort((a, b) => Number(a?.createdAt || 0) - Number(b?.createdAt || 0));
      onPackets?.(list);
    },
    (err) => {
      console.warn("[LiveIntercom] 채널 구독 오류:", err);
    }
  );

  return () => {
    unsubConn();
    unsubPackets();
  };
};

/**
 * 휘발성 링버퍼(최근 30개 유지)로 메시지 패킷 즉시 브로드캐스트
 */
export const sendIntercomPacket = async ({
  contestId,
  fromRole,
  fromLabel,
  fromInstanceId,
  toScope,
  toLabel,
  text,
  priority = "normal",
}) => {
  const trimmed = String(text || "").trim();
  if (!contestId || !fromRole || !trimmed) return null;

  const safeToScope = sanitizeStationTargetScope(fromRole, toScope);
  const now = Date.now();
  const packet = {
    id: `pkt_${now}_${Math.random().toString(36).slice(2, 7)}`,
    contestId,
    createdAt: now,
    priority: priority === "urgent" ? "urgent" : "normal",
    fromRole,
    fromLabel: fromLabel || formatStationLabel(fromRole),
    fromInstanceId: fromInstanceId || "",
    toScope: safeToScope,
    toLabel:
      safeToScope === toScope && toLabel
        ? toLabel
        : formatTargetLabel(safeToScope),
    text: trimmed.slice(0, 240),
    acks: {},
  };

  const packetsRef = ref(database, `liveIntercom/${contestId}/packets`);
  await runTransaction(packetsRef, (current) => {
    const prevList = Array.isArray(current)
      ? current.filter(Boolean)
      : current && typeof current === "object"
      ? Object.values(current).filter(Boolean)
      : [];
    const freshList = prevList.filter(
      (item) => now - Number(item?.createdAt || 0) < PACKET_TTL_MS
    );
    return [...freshList, packet].slice(-MAX_BUFFER_PACKETS);
  });

  return packet;
};

/**
 * 수신 확인(ACK) 원터치 마킹
 */
export const acknowledgeIntercomPacket = async ({
  contestId,
  packetId,
  stationRole,
  stationLabel,
}) => {
  if (!contestId || !packetId || !stationRole) return;
  const packetsRef = ref(database, `liveIntercom/${contestId}/packets`);

  await runTransaction(packetsRef, (current) => {
    const list = Array.isArray(current)
      ? current.filter(Boolean)
      : current && typeof current === "object"
      ? Object.values(current).filter(Boolean)
      : [];
    const idx = list.findIndex((p) => p?.id === packetId);
    if (idx === -1) return list;

    const target = list[idx];
    const nextAcks = {
      ...(target.acks || {}),
      [stationRole]: {
        label: stationLabel || formatStationLabel(stationRole),
        at: Date.now(),
      },
    };
    const nextList = [...list];
    nextList[idx] = { ...target, acks: nextAcks };
    return nextList;
  });
};

/**
 * 채널 메시지 전체 비우기 (본부석 초기화용)
 */
export const clearIntercomChannel = async (contestId) => {
  if (!contestId) return;
  await remove(ref(database, `liveIntercom/${contestId}`));
};
