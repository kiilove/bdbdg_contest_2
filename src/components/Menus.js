// components/Menu.js

import {
  FaTrophy,
  FaClipboardList,
  FaUsers,
  FaCog,
  FaSignOutAlt,
  FaChartLine,
  FaClipboardCheck,
  FaChartPie,
  FaQuestionCircle,
  FaPrint,
  FaFileExport,
  FaFileInvoice,
} from "react-icons/fa";
import {
  AiOutlineFileText,
  AiOutlineUser,
  AiOutlineSetting,
  AiFillDashboard,
  AiFillPrinter,
} from "react-icons/ai";
import {
  RiDashboardLine,
  RiFileList3Line,
  RiSettings3Line,
  RiPrinterFill,
} from "react-icons/ri";
import { BiBarcodeReader, BiDesktop } from "react-icons/bi";
import {
  GiPodiumWinner,
  GiGearStickPattern,
  GiMagicLamp,
} from "react-icons/gi";
import { PiProjectorScreenChartThin, PiChartBarThin } from "react-icons/pi";
import {
  MdAdminPanelSettings,
  MdReportProblem,
  MdMonitor,
} from "react-icons/md";

export const MenuArray = [
  {
    id: 0,
    title: "대시보드",
    link: "/",
    // icon: <AiFillDashboard />, // 아이콘 제거
    requiredGroup: ["admin", "orgManager"],
  },
  {
    id: 1,
    title: "대회 준비",
    link: "/contest-preparation",
    // icon: <FaClipboardCheck />, // 아이콘 제거
    requiredGroup: ["admin", "orgManager"],
    subMenus: [
      {
        id: 1,
        title: "대회 개설",
        icon: <FaTrophy />,
        link: "/newcontest",
        requiredGroup: ["admin"],
      },
      {
        id: 2,
        title: "대회 정보",
        icon: <AiOutlineUser />,
        link: "/contestinfo",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 3,
        title: "참가 신청 관리",
        icon: <FaClipboardList />,
        link: "/contestinvoicetable",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 4,
        title: "참가 신청서 작성",
        icon: <AiOutlineFileText />,
        link: "/contestnewinvoicemanual",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 5,
        title: "대회 음원 설정",
        icon: <AiOutlineFileText />,
        link: "/contestmusicsetting",
        requiredGroup: ["admin"],
      },
    ],
  },
  {
    id: 2,
    title: "경기 관리",
    link: "/contest-management",
    // icon: <FaChartLine />, // 아이콘 제거
    requiredGroup: ["admin", "orgManager"],
    subMenus: [
      {
        id: 1,
        title: "기초 데이터 입력 (1단계)",
        icon: <AiOutlineFileText />,
        link: "/contesttimetable",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 2,
        title: "선수 계측 (2단계)",
        icon: <FaUsers />,
        link: "/contestplayerordertable",
        requiredGroup: ["admin"],
      },
      {
        id: 3,
        title: "최종 명단 (3단계)",
        icon: <RiFileList3Line />,
        link: "/contestplayerordertableafter",
        requiredGroup: ["admin"],
      },
      {
        id: 4,
        title: "무대 설정 (4단계)",
        icon: <RiSettings3Line />,
        link: "/conteststagetable",
        requiredGroup: ["admin"],
      },
      {
        id: 5,
        title: "심판 관리",
        icon: <FaUsers />,
        link: "/contestjudgetable",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 6,
        title: "그랑프리 명단",
        icon: <GiPodiumWinner />,
        link: "/contestplayerordergrandprix",
        requiredGroup: ["admin"],
      },
    ],
  },

  {
    id: 3,
    title: "출력 관리",
    link: "/print-management",
    // icon: <FaPrint />, // 아이콘 제거
    requiredGroup: ["admin", "orgManager"],
    subMenus: [
      {
        id: 1,
        title: "계측 명단 출력",
        icon: <RiPrinterFill />, // 새로운 아이콘
        link: "/print/measurement",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 2,
        title: "출전 명단 출력",
        icon: <FaFileExport />, // 새로운 아이콘
        link: "/print/final",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 3,
        title: "순위표 출력",
        icon: <FaChartPie />,
        link: "/print/ranking",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 4,
        title: "집계표 출력",
        icon: <FaFileInvoice />,
        link: "/printsummary",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 5,
        title: "클럽별 집계 출력",
        icon: <FaFileInvoice />,
        link: "/printgymgroup",
        requiredGroup: ["admin", "orgManager"],
      },
    ],
  },
  {
    id: 4,
    title: "자동 모니터링",
    link: "/auto-monitoring",
    // icon: <MdMonitor />, // 아이콘 제거
    requiredGroup: ["admin"],
    subMenus: [
      {
        id: 1,
        title: "전체 모니터링",
        icon: <RiDashboardLine />,
        link: "/contestmonitoring/all",
        requiredGroup: ["admin"],
      },
      {
        id: 2,
        title: "본부석 모니터링",
        icon: <BiDesktop />,
        link: "/contestmonitoring/main",
        requiredGroup: ["admin"],
      },
      {
        id: 3,
        title: "심판장 모니터링",
        icon: <GiGearStickPattern />,
        link: "/contestmonitoring/judgeHead",
        requiredGroup: ["admin"],
      },
      {
        id: 4,
        title: "사회자 모니터링",
        icon: <GiMagicLamp />,
        link: "/contestmonitoring/MC",
        requiredGroup: ["admin"],
      },
      {
        id: 5,
        title: "스크린",
        icon: <PiProjectorScreenChartThin />,
        link: "/screenlobby",
        requiredGroup: ["admin"],
      },
      {
        id: 6,
        title: "음원 모니터링",
        icon: <GiMagicLamp />,
        link: "/realtimeaudiocenter",
        requiredGroup: ["admin"],
      },
    ],
  },
  {
    id: 5,
    title: "관리자메뉴",
    link: "/admin-tools",
    // icon: <MdAdminPanelSettings />, // 아이콘 제거
    requiredGroup: ["admin"],
    subMenus: [
      {
        id: 1,
        title: "최종 명단 강제 등록",
        icon: <AiOutlineSetting />,
        link: "/contestforcemanual",
        requiredGroup: ["admin"],
      },
      {
        id: 2,
        title: "스크린 딜레이 설정",
        icon: <RiSettings3Line />,
        link: "/delay",
        requiredGroup: ["admin"],
      },
      {
        id: 3,
        title: "랜덤 신청서 생성",
        icon: <FaQuestionCircle />,
        link: "/randomgenerator",
        requiredGroup: ["admin"],
      },
      {
        id: 4,
        title: "신청서 초기화",
        icon: <MdReportProblem />,
        link: "/clear",
        requiredGroup: ["admin"],
      },
      {
        id: 5,
        title: "심사 결과 입력",
        icon: <AiOutlineFileText />,
        link: "/manual-input",
        requiredGroup: ["admin"],
      },
    ],
  },
  {
    id: 6,
    title: "기타",
    link: "/miscellaneous",
    // icon: <FaChartLine />, // 아이콘 제거
    requiredGroup: ["admin", "orgManager"],
    subMenus: [
      {
        id: 1,
        title: "QR Code",
        icon: <BiBarcodeReader />,
        link: "/qrcode",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 2,
        title: "데이터베이스선택",
        icon: <FaSignOutAlt />,
        link: "/selectdatabase",
        requiredGroup: ["admin", "orgManager"],
      },
      {
        id: 3,
        title: "로그아웃",
        icon: <FaSignOutAlt />,
        link: "/logout",
        requiredGroup: ["admin", "orgManager"],
      },
    ],
  },
];
