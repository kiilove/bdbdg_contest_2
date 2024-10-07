// components/Menu.js
export const MenuArray = [
  {
    id: 0,
    title: "대회관리",
    link: "/contest-management",
    requiredGroup: ["admin", "orgManager"], // admin과 orgManager에게 노출
    subMenus: [
      {
        id: 1,
        title: "새로운대회개설",
        link: "/newcontest",
        requiredGroup: ["admin"],
      },
      {
        id: 2,
        title: "대회정보관리",
        link: "/contestinfo",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 3,
        title: "참가신청서",
        link: "/contestinvoicetable",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 4,
        title: "참가신청서 수동작성",
        link: "/contestnewinvoicemanual",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 5,
        title: "기초데이터(1단계)",
        link: "/contesttimetable",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 6,
        title: "계측(2단계)",
        link: "/contestplayerordertable",
        requiredGroup: ["admin"],
      },
      {
        id: 7,
        title: "최종명단(3단계)",
        link: "/contestplayerordertableafter",
        requiredGroup: ["admin"],
      },
      {
        id: 8,
        title: "무대설정(4단계)",
        link: "/conteststagetable",
        requiredGroup: ["admin"],
      },
      {
        id: 9,
        title: "심판선발",
        link: "/contestjudgetable",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 10,
        title: "그랑프리명단",
        link: "/contestplayerordergrandprix",
        requiredGroup: ["admin"],
      },
      {
        id: 11,
        title: "최종명단강제등록",
        link: "/contestforcemanual",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 43,
        title: "참가신청서 랜덤",
        link: "/randomgenerator",
        requiredGroup: ["admin"],
      },
      {
        id: 44,
        title: "참가신청서 클리어",
        link: "/clear",
        requiredGroup: ["admin"],
      },
    ],
  },
  {
    id: 1,
    title: "출력관리",
    link: "/print-management",
    requiredGroup: ["admin", "orgManager"],
    subMenus: [
      {
        id: 1,
        title: "계측명단",
        link: "/measureprint",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 3,
        title: "출전명단",
        link: "/finalplayerlistprint",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 4,
        title: "순위표",
        link: "/printplayerstanding",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 6,
        title: "집계표",
        link: "/printsummary",
        requiredGroup: ["admin"],
      },
    ],
  },
  {
    id: 2,
    title: "수동모드",
    link: "/manual-mode",
    requiredGroup: ["admin"],
    subMenus: [
      {
        id: 1,
        title: "심사표 입력",
        link: "/manual-input",
        requiredGroup: ["admin"],
      },
    ],
  },
  {
    id: 3,
    title: "자동모드",
    link: "/auto-mode",
    requiredGroup: ["admin"],
    subMenus: [
      {
        id: 1,
        title: "전체 모니터링 화면",
        link: "/contestmonitoring/all",
        requiredGroup: ["admin"],
      },
      {
        id: 2,
        title: "본부석 모니터링 화면",
        link: "/contestmonitoring/main",
        requiredGroup: ["admin"],
      },
      {
        id: 3,
        title: "심판위원장 모니터링 화면",
        link: "/contestmonitoring/judgeHead",
        requiredGroup: ["admin"],
      },
      {
        id: 4,
        title: "사회자 모니터링 화면",
        link: "/contestmonitoring/MC",
        requiredGroup: ["admin"],
      },
      {
        id: 30,
        title: "스크린",
        link: "/screenlobby",
        requiredGroup: ["admin"],
      },
      {
        id: 31,
        title: "스크린딜레이세팅",
        link: "/delay",
        requiredGroup: ["admin"],
      },
    ],
  },
  {
    id: 4,
    title: "QRCode",
    link: "/qrcode",
    requiredGroup: ["admin", "orgManager"],
  },
  {
    id: 5,
    title: "로그아웃",
    link: "/logout",
    requiredGroup: ["admin", "orgManager"],
  },
];
