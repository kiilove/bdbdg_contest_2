export const STATION_ROLES = {
  HQ: {
    key: "HQ",
    label: "본부석",
    shortLabel: "본부석",
    channelTitle: "본부석 전용 채널",
    group: "staff",
  },
  HEAD_JUDGE: {
    key: "HEAD_JUDGE",
    label: "심판위원장",
    shortLabel: "심판위원장",
    channelTitle: "심판위원장 전용 채널",
    group: "staff",
  },
  MC: {
    key: "MC",
    label: "사회자(MC)",
    shortLabel: "사회자",
    channelTitle: "사회자(MC) 전용 채널",
    group: "staff",
  },
};

export const TARGET_SCOPES = [
  { key: "HQ", label: "본부석", shortLabel: "본부석" },
  { key: "HEAD_JUDGE", label: "심판위원장", shortLabel: "위원장" },
  { key: "MC", label: "사회자(MC)", shortLabel: "사회자" },
  { key: "ALL_JUDGES", label: "전체 심판", shortLabel: "전심판" },
  { key: "ALL", label: "전체 공지", shortLabel: "전체공지" },
];

/**
 * 화면(라우트 + 통합모니터링 활성 탭)에 따른 전용 스테이션 역할 결정
 * - 수동 전환 없이 현재 열린 운영 화면에만 1:1 고정 귀속
 * - 대회 준비/행정/인쇄/전광판 송출 화면에서는 null 반환(비활성)
 */
export const resolveDedicatedStationRole = (
  pathname = "",
  syncedTabRole = null
) => {
  const lower = String(pathname || "").toLowerCase();

  // 1. 사회자(MC) 전용 화면
  if (
    lower === "/mc" ||
    lower === "/stage-mc" ||
    lower === "/mc-stage" ||
    lower.startsWith("/contestmonitoring/mc") ||
    lower.startsWith("/contestmonitoring/host")
  ) {
    return "MC";
  }

  // 2. 심판위원장 전용 화면
  if (
    lower.startsWith("/contestmonitoring/judgehead") ||
    lower.startsWith("/contestranksummary")
  ) {
    return "HEAD_JUDGE";
  }

  // 3. 통합 모니터링(/contestmonitoring/all): 현재 선택된 화면 탭에 자동 귀속
  if (lower.startsWith("/contestmonitoring/all")) {
    if (syncedTabRole && STATION_ROLES[syncedTabRole]) {
      return syncedTabRole;
    }
    return "HQ";
  }

  // 4. 본부석 라이브 운영 전용 화면 (진행 콘솔 · 음원센터 · 송출 컨트롤 허브)
  if (
    lower.startsWith("/contestmonitoring/main") ||
    lower.startsWith("/contestmonitoring/basecamp") ||
    lower === "/contestmonitoring" ||
    lower === "/live-monitoring" ||
    lower.startsWith("/audio-center") ||
    lower.startsWith("/vibeflowaudiocenter") ||
    lower.startsWith("/realtimeaudiocenter") ||
    lower.startsWith("/vibeflow-audio") ||
    lower.startsWith("/broadcast-hub")
  ) {
    return "HQ";
  }

  // 그 외 대회 설계·접수·배번·계측·인쇄·전광판 디스플레이 화면에서는 비활성
  return null;
};

/**
 * 스테이션별 허용된 수신 대상 목록 및 개별 심판석 지목 허용 여부
 * - HQ(본부석): 심판위원장, 사회자, 전체 심판, 전체 공지 + 개별 1~9번 심판석
 * - HEAD_JUDGE(심판위원장): 전체 심판, 본부석, 사회자 + 개별 1~9번 심판석
 * - MC(사회자): 오직 본부석, 심판위원장만 허용 (심판석 직접 교신 완전 차단)
 */
export const getAllowedTargetsForStation = (stationRole) => {
  if (stationRole === "HQ") {
    return {
      groupTargets: TARGET_SCOPES.filter((t) =>
        ["HEAD_JUDGE", "MC", "ALL_JUDGES", "ALL"].includes(t.key)
      ),
      allowIndividualJudges: true,
      defaultTarget: "HEAD_JUDGE",
    };
  }

  if (stationRole === "HEAD_JUDGE") {
    return {
      groupTargets: TARGET_SCOPES.filter((t) =>
        ["ALL_JUDGES", "HQ", "MC"].includes(t.key)
      ),
      allowIndividualJudges: true,
      defaultTarget: "ALL_JUDGES",
    };
  }

  if (stationRole === "MC") {
    return {
      groupTargets: TARGET_SCOPES.filter((t) =>
        ["HQ", "HEAD_JUDGE"].includes(t.key)
      ),
      allowIndividualJudges: false,
      defaultTarget: "HQ",
    };
  }

  return {
    groupTargets: [],
    allowIndividualJudges: false,
    defaultTarget: "HQ",
  };
};

/**
 * 발신 스테이션 권한에 맞지 않는 수신처 요청을 엔진 레벨에서 강제 차단/보정
 */
export const sanitizeStationTargetScope = (fromRole, rawScope) => {
  const { groupTargets, allowIndividualJudges, defaultTarget } =
    getAllowedTargetsForStation(fromRole);

  const scope = String(rawScope || "");
  if (allowIndividualJudges && /^JUDGE_[1-9]\d*$/.test(scope)) {
    return scope;
  }
  if (groupTargets.some((t) => t.key === scope)) {
    return scope;
  }
  return defaultTarget || "HQ";
};

/**
 * [발신 스테이션 역할 × 현재 선택된 수신 대상] 맞춤형 원터치 상용구
 */
const CONTEXTUAL_PRESETS = {
  HQ: {
    HEAD_JUDGE: [
      { text: "집계 확인 및 순위 확정 부탁드립니다.", priority: "urgent" },
      { text: "비교심사 진행 여부 확인 부탁드립니다.", priority: "normal" },
      { text: "동점자 발생 체급 확인 부탁드립니다.", priority: "urgent" },
      { text: "다음 무대 전환 준비 완료되었습니다.", priority: "normal" },
    ],
    MC: [
      { text: "선수 입장 및 호명 진행 부탁드립니다.", priority: "urgent" },
      {
        text: "집계 확인 중입니다. 잠시 멘트로 대기 부탁드립니다.",
        priority: "normal",
      },
      {
        text: "집계 완료되었습니다. 시상식 진행 부탁드립니다.",
        priority: "normal",
      },
      { text: "음악 재생 큐 사인 맞춰주세요.", priority: "normal" },
    ],
    JUDGE: [
      { text: "채점 제출 마무리 부탁드립니다.", priority: "urgent" },
      { text: "비교심사 투표/채점 준비해 주세요.", priority: "normal" },
      { text: "채점표 다시 확인 부탁드립니다.", priority: "urgent" },
      {
        text: "단말기 초기화 완료했습니다. 다시 진입해 주세요.",
        priority: "normal",
      },
    ],
    ALL: [
      {
        text: "잠시 진행 대기합니다. 안내 전까지 대기해 주세요.",
        priority: "urgent",
      },
      {
        text: "확인 완료되었습니다. 다음 무대 바로 진행합니다.",
        priority: "normal",
      },
    ],
  },
  HEAD_JUDGE: {
    JUDGE: [
      { text: "미제출 좌석 채점 마무리 부탁드립니다.", priority: "urgent" },
      { text: "비교심사 대상자 투표 부탁드립니다.", priority: "urgent" },
      { text: "비교심사 채점 진행해 주세요.", priority: "normal" },
      {
        text: "순위 착오 없는지 채점표 재확인 부탁드립니다.",
        priority: "urgent",
      },
    ],
    HQ: [
      {
        text: "순위 집계 이상 없습니다. 다음 무대 진행해 주세요.",
        priority: "normal",
      },
      {
        text: "비교심사 진행 예정입니다. 잠시 대기해 주세요.",
        priority: "urgent",
      },
      { text: "심판 좌석 채점 초기화 지원 부탁드립니다.", priority: "urgent" },
      { text: "네, 확인했습니다.", priority: "normal" },
    ],
    MC: [
      {
        text: "호명 선수 무대 중앙 라인업 재정렬 부탁드립니다.",
        priority: "urgent",
      },
      { text: "비교심사 규정포즈 진행 부탁드립니다.", priority: "normal" },
      {
        text: "심사 완료되었습니다. 선수 퇴장 안내해 주세요.",
        priority: "normal",
      },
    ],
  },
  MC: {
    HQ: [
      { text: "다음 무대 선수 입장시켜도 될까요?", priority: "normal" },
      { text: "음악 큐 재생 부탁드립니다.", priority: "urgent" },
      { text: "시상식 진행 준비 완료되었습니다.", priority: "normal" },
      { text: "네, 확인했습니다. 바로 진행하겠습니다.", priority: "normal" },
    ],
    HEAD_JUDGE: [
      { text: "비교심사 호명 번호 확인 부탁드립니다.", priority: "urgent" },
      {
        text: "심사 완료되었으면 선수 퇴장 안내할까요?",
        priority: "normal",
      },
      { text: "규정포즈 한 바퀴 더 진행할까요?", priority: "normal" },
      { text: "네, 확인했습니다. 바로 호명하겠습니다.", priority: "normal" },
    ],
  },
};

export const getContextualPresets = (stationRole, toScope) => {
  const roleMap = CONTEXTUAL_PRESETS[stationRole];
  if (!roleMap) return [];

  const targetBucket =
    toScope === "ALL_JUDGES" || String(toScope || "").startsWith("JUDGE_")
      ? "JUDGE"
      : toScope || "HQ";

  return roleMap[targetBucket] || Object.values(roleMap)[0] || [];
};

export const getQuickBannerReplies = (stationRole) => {
  if (stationRole === "MC") {
    return [
      { text: "네, 바로 안내하겠습니다.", priority: "normal" },
      { text: "잠시 대기 중입니다.", priority: "normal" },
    ];
  }
  if (stationRole === "HEAD_JUDGE") {
    return [
      { text: "확인 중입니다. 잠시 대기해 주세요.", priority: "normal" },
      { text: "확인 완료했습니다. 진행해 주세요.", priority: "normal" },
    ];
  }
  return [
    { text: "확인했습니다. 바로 조치하겠습니다.", priority: "normal" },
    { text: "잠시만 대기 부탁드립니다.", priority: "normal" },
  ];
};

export const createClientInstanceId = () =>
  `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const formatStationLabel = (roleKey, judgeName = "") => {
  if (!roleKey) return "알 수 없음";
  if (STATION_ROLES[roleKey]) return STATION_ROLES[roleKey].label;
  if (roleKey.startsWith("JUDGE_")) {
    const seatNo = roleKey.replace("JUDGE_", "");
    return judgeName ? `${seatNo}번 심판 (${judgeName})` : `${seatNo}번 심판`;
  }
  return roleKey;
};

export const formatTargetLabel = (toScope, judgeNameMap = {}) => {
  const preset = TARGET_SCOPES.find((t) => t.key === toScope);
  if (preset) return preset.label;
  if (String(toScope || "").startsWith("JUDGE_")) {
    const seatNo = String(toScope).replace("JUDGE_", "");
    const jName = judgeNameMap[seatNo] || judgeNameMap[Number(seatNo)] || "";
    return jName ? `${seatNo}번 심판 (${jName})` : `${seatNo}번 심판`;
  }
  return toScope || "전체";
};

/**
 * 해당 스테이션 화면 목록에 표시할 메시지인지 엄격 판별
 */
export const isPacketVisibleToStation = (
  packet,
  stationRole,
  showAllForHq = false
) => {
  if (!packet || !stationRole) return false;
  if (stationRole === "HQ" && showAllForHq) return true;
  if (packet.fromRole === stationRole) return true;
  if (packet.toScope === "ALL") return true;
  if (packet.toScope === stationRole) return true;

  if (stationRole === "HEAD_JUDGE" && packet.toScope === "ALL_JUDGES") {
    return true;
  }

  return false;
};

/**
 * 해당 스테이션 화면에 시각 점멸 알림(Tally & 배너)을 띄워야 하는지 판별
 */
export const shouldAlertStation = (packet, stationRole, myInstanceId) => {
  if (!packet || !stationRole) return false;
  if (packet.fromInstanceId && packet.fromInstanceId === myInstanceId) {
    return false;
  }
  if (packet.fromRole === stationRole) return false;

  if (packet.toScope === "ALL") return true;
  if (packet.toScope === stationRole) return true;
  if (stationRole === "HEAD_JUDGE" && packet.toScope === "ALL_JUDGES") {
    return true;
  }
  return false;
};
