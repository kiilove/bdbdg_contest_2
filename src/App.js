import React, { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ConfigProvider } from "antd";
import koKR from "antd/locale/ko_KR";
import "./App.css";

import Login from "./pages/Login";
import ManagementHome from "./homes/ManagementHome";
import LoadingPage from "./pages/LoadingPage";
import { CurrentContestProvider } from "./contexts/CurrentContestContext";
import { DeviceProvider } from "./contexts/DeviceContext";
import SelectDatabase from "./pages/SelectDatabase";
import Logout from "./pages/Logout";
import LiveIntercomDock from "./components/intercom/LiveIntercomDock";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ContestRankSummary = lazy(() => import("./pages/ContestRankSummary"));
const PrintBase = lazy(() => import("./printForms/PrintBase"));
const MeasurePrint = lazy(() => import("./printForms/MeasurePrint"));
const StandingTableType1 = lazy(() => import("./pages/StandingTableType1"));
const RankingAnnouncement = lazy(() => import("./pages/RankingAnnouncement"));
const ScreenLobby = lazy(() => import("./pages/ScreenLobby"));
const Idle = lazy(() => import("./pages/Idle"));
const VibeFlowAudioCenter = lazy(() =>
  import("./pages/broadcast/VibeFlowAudioCenter")
);
const StageLiveDisplay = lazy(() =>
  import("./pages/broadcast/StageLiveDisplay")
);
const StageLiveDisplaySquare = lazy(() =>
  import("./pages/broadcast/StageLiveDisplaySquare")
);
const ContestMonitoringMC = lazy(() => import("./pages/ContestMonitoringMC"));

// BDBDg v3 Workflow Hubs (5-Layer Raw-Data Preserving Pipeline)
const ContestSetupHub = lazy(() => import("./pages/hubs/ContestSetupHub"));
const ContestCategoriesHub = lazy(() =>
  import("./pages/hubs/ContestCategoriesHub")
);
const ContestEntriesHub = lazy(() => import("./pages/hubs/ContestEntriesHub"));
const Stage1NumberingHub = lazy(() =>
  import("./pages/hubs/Stage1NumberingHub")
);
const Stage2WeighInHub = lazy(() => import("./pages/hubs/Stage2WeighInHub"));
const Stage3FinalPlayersHub = lazy(() =>
  import("./pages/hubs/Stage3FinalPlayersHub")
);
const Stage4StagesHub = lazy(() => import("./pages/hubs/Stage4StagesHub"));
const JudgesHub = lazy(() => import("./pages/hubs/JudgesHub"));
const LiveMonitoringHub = lazy(() => import("./pages/hubs/LiveMonitoringHub"));
const AudioCenterHub = lazy(() => import("./pages/hubs/AudioCenterHub"));
const BroadcastHub = lazy(() => import("./pages/hubs/BroadcastHub"));
const PrintCenterHub = lazy(() => import("./pages/hubs/PrintCenterHub"));
const RecoveryScoresHub = lazy(() => import("./pages/hubs/RecoveryScoresHub"));
const SystemToolsHub = lazy(() => import("./pages/hubs/SystemToolsHub"));

/**
 * Legacy /contesttimetable 호환 라우터:
 * state.tabId가 1이면 ① 초기 배번 확정, 2이면 심판 좌석 배정, 기본값은 종목·체급 설계로 연결
 */
const LegacyTimetableRedirect = () => {
  const location = useLocation();
  const tabId = String(location?.state?.tabId ?? "0");
  if (tabId === "1") {
    return <Stage1NumberingHub />;
  }
  if (tabId === "2") {
    return <JudgesHub defaultTab="assign" />;
  }
  return <ContestCategoriesHub />;
};

const STANDALONE_DISPLAY_PREFIXES = [
  "/stage-live",
  "/broadcast",
  "/stage-square",
  "/broadcast-square",
  "/ranking",
  "/ranking-square",
  "/screenlobby",
  "/idle",
  "/screen1",
];

const UiScaleController = () => {
  const location = useLocation();
  React.useEffect(() => {
    const path = (location.pathname || "").toLowerCase();
    const isStandaloneLed = STANDALONE_DISPLAY_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    );
    document.documentElement.classList.toggle("mgmt-ui-scale", !isStandaloneLed);
  }, [location.pathname]);
  return null;
};

const unslopAntdTheme = {
  token: {
    colorPrimary: "#2563eb",
    colorInfo: "#2563eb",
    colorSuccess: "#16a34a",
    colorWarning: "#b45309",
    colorError: "#dc2626",
    colorBgLayout: "#fafafa",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorText: "#171717",
    colorTextSecondary: "#525252",
    colorTextDescription: "#737373",
    colorBorder: "rgba(23, 23, 23, 0.10)",
    colorBorderSecondary: "rgba(23, 23, 23, 0.06)",
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    fontFamily:
      '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif',
    fontSize: 15,
    wireframe: false,
    boxShadowTertiary: "0 1px 2px rgba(0, 0, 0, 0.04)",
  },
  components: {
    Button: {
      controlHeight: 38,
      controlHeightLG: 46,
      controlHeightSM: 30,
      fontWeight: 500,
      primaryShadow: "none",
      defaultShadow: "none",
      dangerShadow: "none",
    },
    Card: {
      borderRadiusLG: 12,
      paddingLG: 20,
    },
    Table: {
      headerBg: "#f4f4f5",
      headerColor: "#525252",
      rowHoverBg: "#f8f8f9",
      borderColor: "rgba(23, 23, 23, 0.06)",
      borderRadius: 8,
    },
    Input: {
      controlHeight: 38,
      controlHeightLG: 46,
      borderRadius: 8,
    },
    Select: {
      controlHeight: 38,
      controlHeightLG: 46,
      borderRadius: 8,
    },
    Tabs: {
      itemSelectedColor: "#171717",
      inkBarColor: "#2563eb",
      titleFontSize: 15,
      titleFontSizeLG: 16,
    },
  },
};

function App() {
  return (
    <ConfigProvider locale={koKR} theme={unslopAntdTheme}>
      <CurrentContestProvider>
        <DeviceProvider>
          <BrowserRouter>
            <UiScaleController />
            <LiveIntercomDock />
            <Suspense fallback={<LoadingPage />}>
              <Routes>
              {/* 대시보드 & 인증 */}
              <Route
                path="/"
                element={<ManagementHome children={<Dashboard />} />}
              />
              <Route path="/login" element={<Login />} />
              <Route path="/selectdatabase" element={<SelectDatabase />} />
              <Route path="/logout" element={<Logout />} />

              {/* 그룹 1. 대회 설계 · 접수 (L0 → L1) */}
              <Route
                path="/contest-setup"
                element={<ManagementHome children={<ContestSetupHub />} />}
              />
              <Route
                path="/contestinfo/*"
                element={
                  <ManagementHome
                    children={<ContestSetupHub defaultTab="info" />}
                  />
                }
              />
              <Route
                path="/qrcode"
                element={
                  <ManagementHome
                    children={<ContestSetupHub defaultTab="qr" />}
                  />
                }
              />
              <Route
                path="/newcontest"
                element={
                  <ManagementHome
                    children={<ContestSetupHub defaultTab="new" />}
                  />
                }
              />

              <Route
                path="/contest-categories"
                element={<ManagementHome children={<ContestCategoriesHub />} />}
              />
              <Route
                path="/contesttimetable"
                element={
                  <ManagementHome children={<LegacyTimetableRedirect />} />
                }
              />

              <Route
                path="/contest-entries"
                element={<ManagementHome children={<ContestEntriesHub />} />}
              />
              <Route
                path="/contestinvoicetable"
                element={
                  <ManagementHome
                    children={<ContestEntriesHub defaultTab="invoices" />}
                  />
                }
              />
              <Route
                path="/contestnewinvoicemanual"
                element={
                  <ManagementHome
                    children={<ContestEntriesHub defaultTab="manual" />}
                  />
                }
              />
              <Route
                path="/simpleinvoiceadmin"
                element={
                  <ManagementHome
                    children={<ContestEntriesHub defaultTab="raw" />}
                  />
                }
              />

              {/* 그룹 2. 출전 확정 · 무대 편성 (L1 → L4) */}
              <Route
                path="/stage-1-numbering"
                element={<ManagementHome children={<Stage1NumberingHub />} />}
              />
              <Route
                path="/stage-2-weighin"
                element={<ManagementHome children={<Stage2WeighInHub />} />}
              />
              <Route
                path="/contestplayerweighintable"
                element={<ManagementHome children={<Stage2WeighInHub />} />}
              />

              <Route
                path="/stage-3-final"
                element={
                  <ManagementHome children={<Stage3FinalPlayersHub />} />
                }
              />
              <Route
                path="/contestplayerordertableafter"
                element={
                  <ManagementHome
                    children={<Stage3FinalPlayersHub defaultTab="final" />}
                  />
                }
              />
              <Route
                path="/contestforcemanual"
                element={
                  <ManagementHome
                    children={<Stage3FinalPlayersHub defaultTab="force" />}
                  />
                }
              />
              <Route
                path="/contestplayerordergrandprix"
                element={
                  <ManagementHome
                    children={<Stage3FinalPlayersHub defaultTab="grandprix" />}
                  />
                }
              />

              <Route
                path="/stage-4-stages"
                element={<ManagementHome children={<Stage4StagesHub />} />}
              />
              <Route
                path="/conteststagetable"
                element={<ManagementHome children={<Stage4StagesHub />} />}
              />

              <Route
                path="/judges-hub"
                element={<ManagementHome children={<JudgesHub />} />}
              />
              <Route
                path="/contestjudgetable"
                element={
                  <ManagementHome children={<JudgesHub defaultTab="pool" />} />
                }
              />

              {/* 그룹 3. 본대회 라이브 운영 */}
              <Route
                path="/live-monitoring"
                element={<Navigate to="/contestmonitoring/main" replace />}
              />
              <Route
                path="/contestmonitoring/:target"
                element={<ManagementHome children={<LiveMonitoringHub />} />}
              />
              <Route
                path="/contestranksummary"
                element={<ManagementHome children={<ContestRankSummary />} />}
              />

              <Route
                path="/audio-center"
                element={<ManagementHome children={<AudioCenterHub />} />}
              />
              <Route
                path="/vibeflowaudiocenter"
                element={
                  <ManagementHome
                    children={<AudioCenterHub defaultTab="vibeflow" />}
                  />
                }
              />
              <Route
                path="/realtimeaudiocenter"
                element={
                  <ManagementHome
                    children={<AudioCenterHub defaultTab="legacy" />}
                  />
                }
              />
              <Route
                path="/contestmusicsetting"
                element={
                  <ManagementHome
                    children={<AudioCenterHub defaultTab="setting" />}
                  />
                }
              />
              <Route path="/vibeflow-audio" element={<VibeFlowAudioCenter />} />

              <Route
                path="/broadcast-hub"
                element={<ManagementHome children={<BroadcastHub />} />}
              />
              <Route
                path="/sponsors"
                element={
                  <ManagementHome
                    children={<BroadcastHub defaultTab="sponsors" />}
                  />
                }
              />
              <Route
                path="/sponsor-management"
                element={
                  <ManagementHome
                    children={<BroadcastHub defaultTab="sponsors" />}
                  />
                }
              />
              <Route
                path="/delay"
                element={
                  <ManagementHome
                    children={<BroadcastHub defaultTab="delay" />}
                  />
                }
              />

              {/* 그룹 4. 공식 기록 · 데이터 복구 */}
              <Route
                path="/print-center"
                element={<ManagementHome children={<PrintCenterHub />} />}
              />
              <Route
                path="/print-management"
                element={<ManagementHome children={<PrintCenterHub />} />}
              />
              <Route
                path="/print/:printType"
                element={<ManagementHome children={<PrintCenterHub />} />}
              />
              <Route
                path="/printgymgroup"
                element={
                  <ManagementHome
                    children={<PrintCenterHub defaultType="gymgroup" />}
                  />
                }
              />
              <Route
                path="/printsummary"
                element={
                  <ManagementHome
                    children={<PrintCenterHub defaultType="summary" />}
                  />
                }
              />
              <Route
                path="/judgeassignmentPrint"
                element={
                  <ManagementHome
                    children={<PrintCenterHub defaultType="judgeassign" />}
                  />
                }
              />
              <Route
                path="/judgeseatmatrixprint"
                element={
                  <ManagementHome
                    children={<PrintCenterHub defaultType="judgematrix" />}
                  />
                }
              />
              <Route
                path="/measureprint"
                element={<ManagementHome children={<MeasurePrint />} />}
              />
              <Route
                path="/printbase"
                element={<ManagementHome children={<PrintBase />} />}
              />

              <Route
                path="/recovery-scores"
                element={<ManagementHome children={<RecoveryScoresHub />} />}
              />
              <Route
                path="/scoreresultmanager"
                element={
                  <ManagementHome
                    children={<RecoveryScoresHub defaultTab="raw" />}
                  />
                }
              />
              <Route
                path="/contestresultmanager"
                element={
                  <ManagementHome
                    children={<RecoveryScoresHub defaultTab="results" />}
                  />
                }
              />
              <Route
                path="/manual-input"
                element={
                  <ManagementHome
                    children={<RecoveryScoresHub defaultTab="results" />}
                  />
                }
              />

              <Route
                path="/system-tools"
                element={<ManagementHome children={<SystemToolsHub />} />}
              />
              <Route
                path="/association-managers"
                element={
                  <ManagementHome
                    children={<SystemToolsHub defaultTab="managers" />}
                  />
                }
              />
              <Route
                path="/randomgenerator"
                element={
                  <ManagementHome
                    children={<SystemToolsHub defaultTab="random" />}
                  />
                }
              />
              <Route
                path="/clear"
                element={
                  <ManagementHome
                    children={<SystemToolsHub defaultTab="clear" />}
                  />
                }
              />

              {/* 단독 송출 스크린 라우트 (사이드바 없음) */}
              <Route path="/screenlobby" element={<ScreenLobby />} />
              <Route path="/ranking" element={<RankingAnnouncement />} />
              <Route path="/idle" element={<Idle />} />
              <Route
                path="/screen1/:contestId"
                element={<StandingTableType1 />}
              />
              <Route path="/stage-live" element={<StageLiveDisplay />} />
              <Route path="/broadcast" element={<StageLiveDisplay />} />
              <Route
                path="/stage-square"
                element={<StageLiveDisplaySquare />}
              />
              <Route
                path="/broadcast-square"
                element={<StageLiveDisplaySquare />}
              />
              <Route
                path="/ranking-square"
                element={<StageLiveDisplaySquare />}
              />
              <Route path="/mc" element={<ContestMonitoringMC />} />
              <Route path="/stage-mc" element={<ContestMonitoringMC />} />
              <Route path="/mc-stage" element={<ContestMonitoringMC />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </DeviceProvider>
      </CurrentContestProvider>
    </ConfigProvider>
  );
}

export default App;
