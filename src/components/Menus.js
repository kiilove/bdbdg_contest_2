import React from "react";
import {
  LayoutDashboard,
  Info,
  Layers,
  ClipboardList,
  Hash,
  Scale,
  ListOrdered,
  SlidersHorizontal,
  UserCheck,
  Monitor,
  AudioWaveform,
  Tv,
  Printer,
  Table2,
  UserCog,
} from "lucide-react";

const iconProps = { size: 16, strokeWidth: 1.5 };

/**
 * BDBDg v3 메뉴 체계
 * - 5단계 원본 로우데이터(L0 접수원본 → L1 확정엔트리 → L2 초기배번 → L3 최종출전 → L4 무대/원시채점)는
 *   그대로 보존하면서, 37개 파편화 메뉴를 실제 운영 시간순 4개 그룹 · 14개 허브로 정돈합니다.
 * - matchPaths를 통해 기존 하위 URL로 진입하더라도 사이드바 활성 표시가 정확히 일치합니다.
 */
export const MenuArray = [
  {
    id: 0,
    title: "대시보드",
    icon: <LayoutDashboard {...iconProps} />,
    link: "/",
    matchPaths: ["/"],
    requiredGroup: ["admin", "orgManager"],
  },
  {
    id: 1,
    title: "1. 대회 설계 · 접수",
    link: "/group-setup",
    requiredGroup: ["admin", "orgManager"],
    subMenus: [
      {
        id: 101,
        title: "대회 기본 설정",
        icon: <Info {...iconProps} />,
        link: "/contest-setup",
        matchPaths: ["/contest-setup", "/contestinfo", "/newcontest", "/qrcode"],
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 102,
        title: "종목 · 체급 설계",
        icon: <Layers {...iconProps} />,
        link: "/contest-categories",
        matchPaths: ["/contest-categories", "/contesttimetable"],
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 103,
        title: "참가 접수 · 입금 확정",
        icon: <ClipboardList {...iconProps} />,
        link: "/contest-entries",
        matchPaths: [
          "/contest-entries",
          "/contestinvoicetable",
          "/contestnewinvoicemanual",
          "/simpleinvoiceadmin",
        ],
        requiredGroup: ["admin", "orgManager"],
      },
    ],
  },
  {
    id: 2,
    title: "2. 출전 확정 · 무대 편성",
    link: "/group-pipeline",
    requiredGroup: ["admin", "orgManager"],
    subMenus: [
      {
        id: 201,
        title: "① 초기 배번 확정",
        icon: <Hash {...iconProps} />,
        link: "/stage-1-numbering",
        matchPaths: ["/stage-1-numbering"],
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 202,
        title: "② 선수 계측 · 체급 확정",
        icon: <Scale {...iconProps} />,
        link: "/stage-2-weighin",
        matchPaths: ["/stage-2-weighin", "/contestplayerweighintable"],
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 203,
        title: "③ 최종 출전 · 그랑프리",
        icon: <ListOrdered {...iconProps} />,
        link: "/stage-3-final",
        matchPaths: [
          "/stage-3-final",
          "/contestplayerordertableafter",
          "/contestforcemanual",
          "/contestplayerordergrandprix",
        ],
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 204,
        title: "④ 무대 진행 큐 편성",
        icon: <SlidersHorizontal {...iconProps} />,
        link: "/stage-4-stages",
        matchPaths: ["/stage-4-stages", "/conteststagetable"],
        requiredGroup: ["admin"],
      },
      {
        id: 205,
        title: "심판 선발 · 좌석 배정",
        icon: <UserCheck {...iconProps} />,
        link: "/judges-hub",
        matchPaths: ["/judges-hub", "/contestjudgetable"],
        requiredGroup: ["admin", "orgManager"],
      },
    ],
  },
  {
    id: 3,
    title: "3. 본대회 라이브 운영",
    link: "/group-live",
    requiredGroup: ["admin", "orgManager"],
    subMenus: [
      {
        id: 301,
        title: "진행 · 채점 모니터링",
        icon: <Monitor {...iconProps} />,
        link: "/contestmonitoring/main",
        matchPaths: ["/live-monitoring", "/contestmonitoring"],
        requiredGroup: ["admin"],
      },
      {
        id: 302,
        title: "바이브플로우 음원센터",
        icon: <AudioWaveform {...iconProps} />,
        link: "/audio-center",
        matchPaths: [
          "/audio-center",
          "/vibeflowaudiocenter",
          "/realtimeaudiocenter",
          "/contestmusicsetting",
        ],
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 303,
        title: "전광판 · 스폰서 연출",
        icon: <Tv {...iconProps} />,
        link: "/broadcast-hub",
        matchPaths: [
          "/broadcast-hub",
          "/sponsors",
          "/sponsor-management",
          "/delay",
        ],
        requiredGroup: ["admin", "orgManager"],
      },
    ],
  },
  {
    id: 4,
    title: "4. 공식 기록 · 데이터 복구",
    link: "/group-records",
    requiredGroup: ["admin", "orgManager"],
    subMenus: [
      {
        id: 401,
        title: "출력 · 공식 집계 센터",
        icon: <Printer {...iconProps} />,
        link: "/print-center",
        matchPaths: [
          "/print-center",
          "/print",
          "/print-management",
          "/printsummary",
          "/printgymgroup",
          "/judgeassignmentPrint",
          "/judgeseatmatrixprint",
          "/measureprint",
          "/printbase",
        ],
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 402,
        title: "채점 · 순위 원복 관리",
        icon: <Table2 {...iconProps} />,
        link: "/recovery-scores",
        matchPaths: [
          "/recovery-scores",
          "/scoreresultmanager",
          "/contestresultmanager",
          "/manual-input",
        ],
        requiredGroup: ["admin"],
      },
      {
        id: 403,
        title: "시스템 · 테스트 도구",
        icon: <UserCog {...iconProps} />,
        link: "/system-tools",
        matchPaths: [
          "/system-tools",
          "/association-managers",
          "/randomgenerator",
          "/clear",
        ],
        requiredGroup: ["admin"],
      },
    ],
  },
];
