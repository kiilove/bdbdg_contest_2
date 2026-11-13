import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import { Drawer } from "@mui/material";
import {
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  LogOut,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import LoadingPage from "../pages/LoadingPage";
import { MenuArray } from "../components/Menus";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreGetDocument } from "../hooks/useFirestores";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import {
  MonitoringDiagnosticsBar,
  resolveEffectiveCollectionName,
} from "../components/monitoring/MonitoringDiagnosticsBar";

const ManagementHome = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userInfo, setUserInfo] = useState(null);
  const [isLoadingMain, setIsLoadingMain] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try {
      return localStorage.getItem("bdbdg_sidebar_hidden") === "1";
    } catch {
      return false;
    }
  });
  const [quickCheckOpen, setQuickCheckOpen] = useState(false);
  const [quickCheckCounts, setQuickCheckCounts] = useState({
    stagesCount: undefined,
    playersCount: undefined,
    judgesAssignCount: undefined,
    contestInfo: null,
  });
  const [collapsedSections, setCollapsedSections] = useState({});
  const isTabletOrMobile = useMediaQuery({ query: "(max-width: 1024px)" });

  const { currentContest } = useContext(CurrentContestContext);
  const contestId = currentContest?.contests?.id || currentContest?.id || "";

  const fetchNoticeDoc = useFirestoreGetDocument("contest_notice");
  const fetchStagesDoc = useFirestoreGetDocument("contest_stages_assign");
  const fetchPlayersDoc = useFirestoreGetDocument("contest_players_final");
  const fetchJudgesDoc = useFirestoreGetDocument("contest_judges_assign");
  const { data: liveStageRealtime } = useFirebaseRealtimeGetDocument(
    quickCheckOpen && contestId ? `currentStage/${contestId}` : null
  );

  const loadQuickCheckCounts = async () => {
    const c = currentContest?.contests || {};
    if (!contestId) {
      setQuickCheckCounts({
        stagesCount: undefined,
        playersCount: undefined,
        judgesAssignCount: undefined,
        contestInfo: null,
      });
      return;
    }
    try {
      const [nDoc, sDoc, pDoc, jDoc] = await Promise.all([
        c.contestNoticeId
          ? fetchNoticeDoc.getDocument(c.contestNoticeId)
          : Promise.resolve(null),
        c.contestStagesAssignId
          ? fetchStagesDoc.getDocument(c.contestStagesAssignId)
          : Promise.resolve(null),
        c.contestPlayersFinalId
          ? fetchPlayersDoc.getDocument(c.contestPlayersFinalId)
          : Promise.resolve(null),
        c.contestJudgesAssignId
          ? fetchJudgesDoc.getDocument(c.contestJudgesAssignId)
          : Promise.resolve(null),
      ]);
      setQuickCheckCounts({
        contestInfo: nDoc || null,
        stagesCount: Array.isArray(sDoc?.stages) ? sDoc.stages.length : 0,
        playersCount: Array.isArray(pDoc?.players)
          ? pDoc.players.filter((p) => p && p.playerNoShow !== true).length
          : 0,
        judgesAssignCount: Array.isArray(jDoc?.judges) ? jDoc.judges.length : 0,
      });
    } catch (e) {
      console.error("[QuickCheck] 카운트 조회 오류:", e);
    }
  };

  useEffect(() => {
    if (quickCheckOpen) {
      loadQuickCheckCounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCheckOpen, contestId]);

  useEffect(() => {
    setQuickCheckOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && typeof parsedUser === "object") {
          setUserInfo(parsedUser);
          setIsLoadingMain(false);
          return;
        }
      } catch (e) {
        console.error("사용자 정보 파싱 오류:", e);
      }
    }
    setUserInfo(null);
    setIsLoadingMain(false);
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!isTabletOrMobile && drawerOpen) {
      setDrawerOpen(false);
    }
  }, [isTabletOrMobile, drawerOpen]);

  const toggleSidebarHidden = () => {
    setSidebarHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("bdbdg_sidebar_hidden", next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && drawerOpen) {
        setDrawerOpen(false);
        return;
      }
      if (
        !isTabletOrMobile &&
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        (e.key === "b" || e.key === "B") &&
        !e.target?.isContentEditable
      ) {
        e.preventDefault();
        toggleSidebarHidden();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen, isTabletOrMobile]);

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    setDrawerOpen(false);
    navigate("/login");
  };

  const handleNavigate = (link, title) => {
    if (title === "로그아웃" || link === "/logout") {
      handleLogout();
      return;
    }
    navigate(link);
    if (isTabletOrMobile) {
      setDrawerOpen(false);
    }
  };

  const toggleSection = (sectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const isRouteActive = (link) => {
    if (!link) return false;
    if (link === "/") {
      return location.pathname === "/";
    }
    return (
      location.pathname === link || location.pathname.startsWith(`${link}/`)
    );
  };

  const filteredMenus = useMemo(() => {
    const userGroup = userInfo?.userGroup;
    if (!Array.isArray(MenuArray) || !userGroup) return [];

    return MenuArray.filter(
      (menu) => !menu?.hidden && menu?.requiredGroup?.includes(userGroup)
    )
      .map((menu) => {
        if (menu.subMenus && menu.subMenus.length > 0) {
          const visibleSubMenus = menu.subMenus.filter(
            (sub) =>
              !sub?.hidden &&
              sub?.requiredGroup?.includes(userGroup) &&
              sub.title !== "로그아웃"
          );
          if (visibleSubMenus.length === 0) return null;
          return {
            ...menu,
            subMenus: visibleSubMenus,
          };
        }
        return menu;
      })
      .filter(Boolean);
  }, [userInfo]);

  const activeContestTitle =
    currentContest?.contestInfo?.contestTitle ||
    currentContest?.contests?.contestTitle ||
    "선택된 대회 없음";

  const quickMissingLinkCount = useMemo(() => {
    const c = currentContest?.contests || {};
    if (!contestId) return 1;
    let missing = 0;
    if (!resolveEffectiveCollectionName(currentContest?.contestInfo, currentContest))
      missing += 1;
    if (!c.contestPlayersFinalId) missing += 1;
    if (!c.contestStagesAssignId) missing += 1;
    if (!c.contestJudgesAssignId) missing += 1;
    if (!c.contestComparesListId) missing += 1;
    return missing;
  }, [currentContest, contestId]);

  const roleLabel =
    userInfo?.userGroup === "admin"
      ? "시스템 관리자"
      : userInfo?.userContext || "운영 매니저";

  const renderNavItem = (item) => {
    const active = isRouteActive(item.link);
    return (
      <button
        key={item.link}
        type="button"
        onClick={() => handleNavigate(item.link, item.title)}
        className={`group w-full h-[34px] px-2.5 rounded-[8px] flex items-center gap-2.5 text-[14px] leading-5 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 ${
          active
            ? "bg-white text-[#171717] font-medium border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            : "text-[#525252] font-normal border border-transparent hover:bg-[#171717]/[0.04] hover:text-[#171717]"
        }`}
      >
        <span
          className={`w-4 h-4 shrink-0 flex items-center justify-center transition-colors duration-150 ${
            active
              ? "text-[#2563eb]"
              : "text-[#737373] group-hover:text-[#525252]"
          }`}
        >
          {item.icon}
        </span>
        <span className="truncate flex-1">{item.title}</span>
        {active && (
          <span
            aria-hidden="true"
            className="w-1.5 h-1.5 rounded-full bg-[#2563eb] shrink-0"
          />
        )}
      </button>
    );
  };

  const renderSidebarBody = (showCloseButton = false) => (
    <div className="flex flex-col h-full bg-[#f4f4f5] text-[#171717]">
      {/* Top Brand Header (56px) */}
      <div className="h-[56px] px-4 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => handleNavigate("/")}
          className="flex items-baseline gap-2 text-left focus:outline-none cursor-pointer"
        >
          <span className="text-[16px] leading-none font-semibold text-[#171717]">
            BDBDg
          </span>
          <span className="text-xs leading-4 text-[#737373]">
            대회 운영 시스템
          </span>
        </button>
        {showCloseButton ? (
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="메뉴 닫기"
            className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#171717]/[0.05] transition-colors duration-150 cursor-pointer"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleSidebarHidden}
            title="사이드바 숨기기 (Ctrl+B)"
            aria-label="사이드바 숨기기"
            className="h-7 px-2 rounded-[7px] inline-flex items-center gap-1 text-xs font-medium text-[#737373] hover:text-[#171717] hover:bg-[#171717]/[0.06] transition-colors duration-150 cursor-pointer"
          >
            <PanelLeftClose size={15} strokeWidth={1.6} />
            <span>숨김</span>
          </button>
        )}
      </div>

      {/* Active Contest Quick Switcher Card + Ultra-Quick Launcher */}
      <div className="px-3 pb-2 shrink-0 space-y-1.5">
        <button
          type="button"
          onClick={() => handleNavigate("/selectdatabase")}
          className="w-full text-left rounded-[8px] bg-white border border-[#171717]/[0.08] hover:border-[#171717]/[0.16] px-3 py-2 transition-colors duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] leading-4 text-[#737373]">
              활성 대회
            </span>
            <span className="inline-flex items-center gap-0.5 text-[11px] leading-4 font-medium text-[#2563eb]">
              변경
              <ArrowUpRight size={12} strokeWidth={1.5} />
            </span>
          </div>
          <div className="mt-0.5 text-[13px] leading-5 font-medium text-[#171717] truncate">
            {activeContestTitle}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            if (isTabletOrMobile) setDrawerOpen(false);
            setQuickCheckOpen((prev) => !prev);
          }}
          className={`w-full h-8 px-2.5 rounded-[8px] border flex items-center justify-between gap-2 text-xs font-medium transition-colors cursor-pointer ${
            quickCheckOpen
              ? "bg-[#2563eb] text-white border-[#2563eb]"
              : "bg-white hover:bg-[#fafafa] text-[#171717] border-[#171717]/[0.09] shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          }`}
        >
          <span className="inline-flex items-center gap-1.5 truncate">
            <Wrench
              size={13}
              strokeWidth={1.6}
              className={quickCheckOpen ? "text-white" : "text-[#2563eb]"}
            />
            <span>필수 데이터 점검</span>
          </span>
          {quickMissingLinkCount > 0 ? (
            <span
              className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold tabular-nums ${
                quickCheckOpen
                  ? "bg-white/20 text-white"
                  : "bg-[#dc2626]/10 text-[#dc2626]"
              }`}
            >
              누락 {quickMissingLinkCount}
            </span>
          ) : (
            <span
              className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium ${
                quickCheckOpen
                  ? "bg-white/20 text-white"
                  : "bg-[#f4f4f5] text-[#525252]"
              }`}
            >
              점검
            </span>
          )}
        </button>
      </div>

      {/* Scrollable Navigation Groups */}
      <nav
        aria-label="주요 메뉴"
        className="flex-1 overflow-y-auto px-3 pb-4 pt-2"
      >
        {filteredMenus.map((section) => {
          if (!section.subMenus || section.subMenus.length === 0) {
            return (
              <div key={section.link} className="space-y-0.5">
                {renderNavItem(section)}
              </div>
            );
          }

          const isCollapsed = Boolean(collapsedSections[section.link]);
          return (
            <div key={section.link}>
              <button
                type="button"
                onClick={() => toggleSection(section.link)}
                className="w-full px-3 pt-5 pb-1.5 flex items-center justify-between text-xs leading-4 font-medium text-[#737373] hover:text-[#525252] transition-colors duration-150 focus:outline-none"
              >
                <span>{section.title}</span>
                <span className="text-[#737373]">
                  {isCollapsed ? (
                    <ChevronRight size={14} strokeWidth={1.5} />
                  ) : (
                    <ChevronDown size={14} strokeWidth={1.5} />
                  )}
                </span>
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {section.subMenus.map((subItem) => renderNavItem(subItem))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom User & Logout Footer */}
      <div className="shrink-0 border-t border-[#171717]/[0.08] p-3 flex items-center justify-between gap-2 bg-[#f4f4f5]">
        <div className="min-w-0">
          <div className="text-[13px] leading-4 font-medium text-[#171717] truncate">
            {userInfo?.userID}
          </div>
          <div className="text-[11px] leading-4 text-[#737373] truncate mt-0.5">
            {roleLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="h-8 px-2.5 rounded-[8px] inline-flex items-center gap-1.5 text-xs leading-4 font-medium text-[#525252] hover:text-[#171717] hover:bg-[#171717]/[0.05] transition-colors duration-150 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40"
        >
          <LogOut size={15} strokeWidth={1.5} className="text-[#737373]" />
          <span>로그아웃</span>
        </button>
      </div>
    </div>
  );

  if (isLoadingMain || !userInfo) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#fafafa]">
        <LoadingPage />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#fafafa] text-[#171717] print:block print:bg-white">
      {isTabletOrMobile ? (
        <>
          {/* Tablet & Mobile 56px Top Bar */}
          <header className="h-[56px] px-4 bg-[#f4f4f5] border-b border-[#171717]/[0.08] flex items-center justify-between gap-3 sticky top-0 z-30 print:hidden no-print">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="메뉴 열기"
                className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[#525252] hover:text-[#171717] hover:bg-[#171717]/[0.05] transition-colors duration-150 shrink-0"
              >
                <Menu size={18} strokeWidth={1.5} />
              </button>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-[16px] leading-none font-semibold text-[#171717] shrink-0">
                  BDBDg
                </span>
                <span className="text-xs leading-4 text-[#737373] truncate">
                  {activeContestTitle}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setQuickCheckOpen((prev) => !prev)}
                className={`h-8 px-2.5 rounded-[8px] border inline-flex items-center gap-1 text-xs leading-4 font-medium transition-colors cursor-pointer ${
                  quickCheckOpen
                    ? "bg-[#2563eb] text-white border-[#2563eb]"
                    : "bg-white border-[#171717]/[0.08] text-[#171717]"
                }`}
              >
                <Wrench size={13} strokeWidth={1.6} />
                <span>데이터 점검</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/selectdatabase")}
                className="h-8 px-2.5 rounded-[8px] bg-white border border-[#171717]/[0.08] text-xs leading-4 font-medium text-[#525252] hover:text-[#171717] transition-colors duration-150 shrink-0"
              >
                대회 변경
              </button>
            </div>
          </header>

          {/* Slide-over Drawer */}
          <div
            className={`fixed inset-0 z-50 print:hidden no-print transition-opacity duration-200 ${
              drawerOpen
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }`}
            aria-hidden={!drawerOpen}
          >
            <div
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-[#171717]/30"
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="모바일 내비게이션"
              className={`relative w-[264px] max-w-[82vw] h-full bg-[#f4f4f5] border-r border-[#171717]/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-transform duration-200 ${
                drawerOpen ? "translate-x-0" : "-translate-x-full"
              }`}
              style={{
                transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {renderSidebarBody(true)}
            </aside>
          </div>
        </>
      ) : !sidebarHidden ? (
        /* Desktop 248px Fixed Left Sidebar */
        <aside className="w-[248px] shrink-0 bg-[#f4f4f5] border-r border-[#171717]/[0.08] flex flex-col h-screen sticky top-0 print:hidden no-print">
          {renderSidebarBody(false)}
        </aside>
      ) : (
        /* Desktop Sidebar Hidden — Left-edge Restore Tab */
        <button
          type="button"
          onClick={toggleSidebarHidden}
          title="사이드바 펼치기 (Ctrl+B)"
          aria-label="사이드바 펼치기"
          className="fixed left-0 bottom-5 z-40 h-9 pl-2.5 pr-3 rounded-r-[10px] bg-white/95 hover:bg-white border border-l-0 border-[#171717]/15 shadow-[0_2px_10px_rgba(0,0,0,0.10)] inline-flex items-center gap-1.5 text-xs font-semibold text-[#171717] transition-all cursor-pointer print:hidden no-print"
        >
          <PanelLeftOpen size={15} strokeWidth={1.8} className="text-[#2563eb]" />
          <span>메뉴</span>
        </button>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-[#fafafa] min-h-screen print:bg-white relative">
        <Drawer
          anchor="right"
          open={quickCheckOpen}
          onClose={() => setQuickCheckOpen(false)}
          PaperProps={{
            sx: {
              width: { xs: "100vw", md: "min(92vw, 920px)" },
              bgcolor: "#ffffff",
              boxShadow: "-12px 0 40px rgba(15, 23, 42, 0.14)",
            },
          }}
        >
          <div className="h-full flex flex-col bg-white print:hidden no-print">
            <div className="px-5 py-3.5 bg-[#fafafa] border-b border-[#171717]/[0.08] flex items-center justify-between gap-3 shrink-0 sticky top-0 z-10">
              <div className="flex items-center gap-2 min-w-0">
                <Wrench
                  size={16}
                  strokeWidth={1.6}
                  className="text-[#2563eb] shrink-0"
                />
                <span className="text-sm font-semibold text-[#171717]">
                  대회 데이터 점검 · 빠른 보강
                </span>
                <span className="text-xs text-[#737373] hidden sm:inline truncate">
                  · 대회 전·당일 누락 데이터를 한눈에 진단하고 즉시 이동합니다
                </span>
              </div>
              <button
                type="button"
                onClick={() => setQuickCheckOpen(false)}
                className="w-8 h-8 rounded-[8px] inline-flex items-center justify-center text-[#525252] hover:text-[#171717] hover:bg-[#e4e4e7]/70 transition-colors cursor-pointer shrink-0"
                aria-label="닫기"
              >
                <X size={16} strokeWidth={1.6} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-5">
              <MonitoringDiagnosticsBar
                variant="light"
                screenType="hub"
                contestInfo={quickCheckCounts.contestInfo}
                stagesCount={quickCheckCounts.stagesCount}
                playersCount={quickCheckCounts.playersCount}
                judgesAssignCount={quickCheckCounts.judgesAssignCount}
                realtimeData={liveStageRealtime}
                onRefreshData={loadQuickCheckCounts}
                defaultExpanded={true}
              />
            </div>
          </div>
        </Drawer>
        {children}
      </main>
    </div>
  );
};

export default ManagementHome;
