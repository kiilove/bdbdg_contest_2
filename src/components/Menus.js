import {
  BsTrophyFill,
  BsPrinterFill,
  BsFillHandIndexThumbFill,
  BsCpuFill,
  BsCheckAll,
  BsInfoLg,
  BsListOl,
  BsCardChecklist,
} from "react-icons/bs";

import { AiOutlineGroup } from "react-icons/ai";
import { PiUsersFour } from "react-icons/pi";
import { CgUserList } from "react-icons/cg";
import { GiPodiumWinner } from "react-icons/gi";

import {
  TbCertificate,
  TbFileCertificate,
  TbHeartRateMonitor,
} from "react-icons/tb";
import { HiUserGroup, HiUsers } from "react-icons/hi";
import {
  MdTimeline,
  MdBalance,
  MdDoneAll,
  MdOutlineScale,
  MdOutlineTouchApp,
} from "react-icons/md";
import { BiAddToQueue, BiUserPlus } from "react-icons/bi";
import { BsClipboardData } from "react-icons/bs";

let user = { userGroup: "" };
const userParser = JSON.parse(sessionStorage.getItem("user"));
if (userParser?.userGroup !== null) {
  user = { ...userParser };
}
export const MenuArray = [
  {
    id: 0,
    title: "대회관리",
    isActive: true,
    icon: <BsTrophyFill />,
    subMenus: [
      {
        id: 1,
        title: "새로운대회개설",
        icon: <BiAddToQueue />,
        link: "/newcontest",
        isActive: user.userGroup === "admin" ? true : false,
      },
      {
        id: 2,
        title: "대회정보관리",
        icon: <BsInfoLg />,
        link: "/contestinfo",
        isActive: true,
      },

      {
        id: 3,
        title: "참가신청서",
        icon: <PiUsersFour />,
        link: "/contestinvoicetable",
        isActive: true,
      },
      {
        id: 4,
        title: "참가신청서 수동작성",
        icon: <BiUserPlus />,
        link: "/contestnewinvoicemanual",
        isActive: true,
      },

      {
        id: 5,
        title: "기초데이터(1단계)",
        icon: <BsClipboardData />,
        link: "/contesttimetable",
        isActive: true,
      },
      {
        id: 6,
        title: "계측(2단계)",
        icon: <MdOutlineScale />,
        link: "/contestplayerordertable",
        isActive: user.userGroup === "admin" ? true : false,
      },
      {
        id: 7,
        title: "최종명단(3단계)",
        icon: <CgUserList />,
        link: "/contestplayerordertableafter",
        isActive: user.userGroup === "admin" ? true : false,
      },
      {
        id: 8,
        title: "무대설정(4단계)",
        icon: <AiOutlineGroup />,
        link: "/conteststagetable",
        isActive: user.userGroup === "admin" ? true : false,
      },

      {
        id: 9,
        title: "심판선발",
        icon: <MdBalance />,
        link: "/contestjudgetable",
        isActive: true,
      },
      {
        id: 10,
        title: "그랑프리명단",
        icon: <GiPodiumWinner />,
        link: "/contestplayerordergrandprix",
        isActive: user.userGroup === "admin" ? true : false,
      },
      {
        id: 43,
        title: "참가신청서 랜덤",
        icon: <BiUserPlus />,
        link: "/randomgenerator",
        isActive: user.userGroup === "admin" ? true : false,
      },
      {
        id: 44,
        title: "참가신청서 클리어",
        icon: <BiUserPlus />,
        link: "/clear",
        isActive: user.userGroup === "admin" ? true : false,
      },
    ],
  },
  {
    id: 1,
    title: "출력관리",
    icon: <BsPrinterFill />,
    isActive: true,
    subMenus: [
      {
        id: 1,
        title: "계측명단 통합",
        icon: <MdOutlineScale />,
        link: "/printbase",
        isActive: true,
      },

      {
        id: 3,
        title: "선수명단 통합",
        icon: <HiUserGroup />,
        isActive: true,
        link: "/printplayersfinal",
      },

      {
        id: 4,
        title: "순위표 통합",
        icon: <BsListOl />,
        isActive: true,
        link: "/printplayerstanding",
      },

      {
        id: 6,
        title: "집계표 출력",
        icon: <BsCardChecklist />,
        isActive: user.userGroup === "admin" ? true : false,
        link: "/printsummary",
      },
      {
        id: 7,
        title: "상장 출력",
        icon: <TbCertificate />,
        isActive: true,
        isActive: user.userGroup === "admin" ? true : false,
      },
      {
        id: 9,
        title: "상장부여현황",
        icon: <TbFileCertificate />,
        isActive: user.userGroup === "admin" ? true : false,
      },
    ],
  },
  {
    id: 2,
    title: "수동모드",
    isActive: user.userGroup === "admin" ? true : false,
    icon: <BsFillHandIndexThumbFill />,
    subMenus: [{ id: 1, title: "심사표 입력", icon: <MdOutlineTouchApp /> }],
  },
  {
    id: 3,
    title: "자동모드",
    isActive: user.userGroup === "admin" ? true : false,
    icon: <BsCpuFill />,
    subMenus: [
      {
        id: 1,
        title: "전체 모니터링 화면",
        isActive: true,
        icon: <TbHeartRateMonitor />,
        link: "/contestmonitoring/all",
      },
      {
        id: 2,
        title: "본부석 모니터링 화면",
        isActive: true,
        icon: <TbHeartRateMonitor />,
        link: "/contestmonitoring/main",
      },
      {
        id: 3,
        title: "심판위원장 모니터링 화면",
        isActive: true,
        icon: <TbHeartRateMonitor />,
        link: "/contestmonitoring/judgeHead",
      },
      {
        id: 4,
        title: "사회자 모니터링 화면",
        isActive: true,
        icon: <TbHeartRateMonitor />,
        link: "/contestmonitoring/MC",
      },
      {
        id: 30,
        title: "스크린",
        isActive: true,
        icon: <TbHeartRateMonitor />,
        link: "/screenlobby",
      },
    ],
  },
  {
    id: 4,
    title: "접수링크",
    isActive: true,
    icon: <BsFillHandIndexThumbFill />,
    subMenus: [{ id: 1, title: "QR코드확인", icon: <MdOutlineTouchApp /> }],
  },
];
