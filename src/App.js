import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";

import Login from "./pages/Login";
import ManagementHome from "./homes/ManagementHome";
import ContestInfo from "./pages/ContestInfo";
import ContestTimetable from "./pages/ContestTimetable";
import { CurrentContestProvider } from "./contexts/CurrentContestContext";
import NewContest from "./pages/NewContest";
import ContestInvoiceTable from "./pages/ContestInvoiceTable";
import ContestPlayerOrderTable from "./pages/ContestPlayerOrderTable";
import ContestNewInvoiceManual from "./pages/ContestNewInvoiceManual";
import ContestJudgeTable from "./pages/ContestJudgeTable";
import ContestPlayerOrderTableAfter from "./pages/ContestPlayerOrderTableAfter";
import ContestMonitoring from "./pages/ContestMonitoring";
import ContestRankSummary from "./pages/ContestRankSummary";
import ContestStagetable from "./pages/ContestStagetable";
import PrintBase from "./printForms/PrintBase";
import PrintPlayersFinal from "./printForms/PrintPlayersFinal";
import ContestPlayerOrderTableGrandPrix from "./pages/ContestPlayerOrderTableGrandPrix";
import AwardList from "./printForms/AwardList";
import StandingTableType1 from "./pages/StandingTableType1";
import RandomPlayerGenerator from "./pages/RandomPlayerGenerator";
import ContestSearchAndDelete from "./pages/ContestSearchAndDelete";
import PrintPlayerStanding from "./printForms/PrintPlayerStanding";
import RankingAnnouncement from "./pages/RankingAnnouncement";
import PrintSummary from "./printForms/PrintSummary";
import ScreenLobby from "./pages/ScreenLobby";
import Idle from "./pages/Idle";
import DelaySettings from "./pages/DelaySettings";
import ContestForceManual from "./pages/ContestForceManual";
import QRCodeGenerator from "./pages/QRcodeGenerator";
import SelectDatabase from "./pages/SelectDatabase";
import MeasurePrint from "./printForms/MeasurePrint";
import FinalPlayerListPrint from "./printForms/FinalPlayerListPrint";
import StandingPrint from "./printForms/StandingPrint";
import { DeviceProvider } from "./contexts/DeviceContext";
import UnifiedPrint from "./printForms/UnifiedPrint";

function App() {
  return (
    <CurrentContestProvider>
      <DeviceProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/management" element={<ManagementHome />} />
            <Route
              path="/newcontest"
              element={<ManagementHome children={<NewContest />} />}
            />
            <Route
              path="/contestinfo/"
              element={<ManagementHome children={<ContestInfo />} />}
            />
            <Route
              path="/contesttimetable"
              element={<ManagementHome children={<ContestTimetable />} />}
            />
            <Route
              path="/contestinvoicetable"
              element={<ManagementHome children={<ContestInvoiceTable />} />}
            />
            <Route
              path="/contestplayerordertable"
              element={
                <ManagementHome children={<ContestPlayerOrderTable />} />
              }
            />
            <Route
              path="/contestplayerordertableafter"
              element={
                <ManagementHome children={<ContestPlayerOrderTableAfter />} />
              }
            />
            <Route
              path="/conteststagetable"
              element={<ManagementHome children={<ContestStagetable />} />}
            />
            <Route
              path="/contestnewinvoicemanual"
              element={
                <ManagementHome children={<ContestNewInvoiceManual />} />
              }
            />
            <Route
              path="/contestforcemanual"
              element={<ManagementHome children={<ContestForceManual />} />}
            />
            <Route
              path="/randomgenerator"
              element={<ManagementHome children={<RandomPlayerGenerator />} />}
            />
            <Route
              path="/contestjudgetable"
              element={<ManagementHome children={<ContestJudgeTable />} />}
            />
            <Route
              path="/contestplayerordergrandprix"
              element={
                <ManagementHome
                  children={<ContestPlayerOrderTableGrandPrix />}
                />
              }
            />
            {/* <Route
            path="/contestmonitoring"
            element={<ManagementHome children={<ContestMonitoring />} />}
          /> */}
            <Route
              path="/contestmonitoring/:target"
              element={<ManagementHome children={<ContestMonitoring />} />}
            />
            <Route
              path="/contestranksummary"
              element={<ManagementHome children={<ContestRankSummary />} />}
            />
            <Route
              path="/measureprint"
              element={<ManagementHome children={<MeasurePrint />} />}
            />
            <Route
              path="/finalplayerlistprint"
              element={<ManagementHome children={<FinalPlayerListPrint />} />}
            />
            <Route
              path="/standingprint"
              element={<ManagementHome children={<StandingPrint />} />}
            />
            <Route
              path="/print/:printType"
              element={<ManagementHome children={<UnifiedPrint />} />}
            />
            <Route
              path="/printsummary"
              element={<ManagementHome children={<PrintSummary />} />}
            />
            <Route
              path="/awardlist"
              element={<ManagementHome children={<AwardList />} />}
            />
            <Route path="/screenlobby" element={<ScreenLobby />} />
            <Route path="/ranking" element={<RankingAnnouncement />} />
            <Route path="/idle" element={<Idle />} />
            <Route
              path="/qrcode"
              element={<ManagementHome children={<QRCodeGenerator />} />}
            />
            <Route
              path="/clear"
              element={<ManagementHome children={<ContestSearchAndDelete />} />}
            />
            <Route
              path="/delay"
              element={<ManagementHome children={<DelaySettings />} />}
            />
            <Route path="/selectdatabase" element={<SelectDatabase />} />
            <Route
              path="/screen1/:contestId"
              element={<StandingTableType1 />}
            />
          </Routes>
        </BrowserRouter>
      </DeviceProvider>
    </CurrentContestProvider>
  );
}

export default App;
