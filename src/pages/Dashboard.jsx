"use client";
import React, { useContext, useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { where } from "firebase/firestore";
import { Tabs } from "antd";
import {
  Users,
  UserCheck,
  BarChart3,
  ClipboardCheck,
  Scale,
  Printer,
  CalendarClock,
} from "lucide-react";

import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { writePriceCheckLog } from "../utils/priceCheckLogger";
import ConfirmationModal from "../messageBox/ConfirmationModal";

import LiveStageStatusCard from "../components/dashboard/LiveStageStatusCard";
import RegistrationMetricCards from "../components/dashboard/RegistrationMetricCards";
import RegistrationOverviewSection from "../components/dashboard/RegistrationOverviewSection";
import CategoryGradeStatusGrid from "../components/dashboard/CategoryGradeStatusGrid";
import JudgesOverviewPanel from "../components/dashboard/JudgesOverviewPanel";
import UnconfirmedAthletesTable from "../components/dashboard/UnconfirmedAthletesTable";
import AthleteRatioAnalytics from "../components/dashboard/AthleteRatioAnalytics";

const tabIconProps = { size: 16, strokeWidth: 1.5 };

const isGrandPrixCategory = (category) => {
  if (!category) return false;
  const section = category.contestCategorySection || "";
  const type = category.contestCategoryType || "";
  const title =
    category.contestCategoryTitle ||
    category.contestCategoryName ||
    category?.contestCategoryInfo?.name ||
    "";
  return (
    section.includes("그랑프리") ||
    type.includes("그랑프리") ||
    title.includes("그랑프리")
  );
};

const Dashboard = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [categories, setCategories] = useState([]);
  const [grades, setGrades] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [confirmedPlayers, setConfirmedPlayers] = useState([]);
  const [pendingPlayers, setPendingPlayers] = useState([]);
  const [judgesPool, setJudgesPool] = useState([]);
  const [activeTabKey, setActiveTabKey] = useState("analytics");
  const [isUpdatingInvoiceId, setIsUpdatingInvoiceId] = useState(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});

  const contestId = currentContest?.contests?.id;

  const { data: realtimeStageData } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );

  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const queryInvoices = useFirestoreQuery();
  const queryJudges = useFirestoreQuery();
  const addEntry = useFirestoreAddData("contest_entrys_list");
  const deleteEntry = useFirestoreDeleteData("contest_entrys_list");
  const updateInvoice = useFirestoreUpdateData("invoices_pool");

  const splitPlayersByStatus = (invoiceArray = []) => {
    const confirmed = [];
    const pending = [];

    invoiceArray.forEach((invoice) => {
      if (invoice.isCanceled) return;
      const entries = (invoice.joins || []).map((join) => ({
        ...invoice,
        contestCategoryId: join.contestCategoryId,
        contestCategoryTitle: join.contestCategoryTitle,
        contestGradeId: join.contestGradeId,
        contestGradeTitle: join.contestGradeTitle,
      }));
      if (invoice.isPriceCheck) {
        confirmed.push(...entries);
      } else {
        pending.push(...entries);
      }
    });

    setConfirmedPlayers(confirmed);
    setPendingPlayers(pending);
  };

  const fetchPool = async (categoryListId, gradeListId, targetContestId) => {
    const condition = [where("contestId", "==", targetContestId)];
    try {
      const [categoryArray, gradeArray, invoiceArray, judgesArray] =
        await Promise.all([
          categoryListId
            ? fetchCategories.getDocument(categoryListId)
            : Promise.resolve(null),
          gradeListId
            ? fetchGrades.getDocument(gradeListId)
            : Promise.resolve(null),
          queryInvoices.getDocuments("invoices_pool", condition),
          queryJudges.getDocuments("contest_judges_pool", condition),
        ]);

      const sortedCats =
        categoryArray?.categorys
          ?.slice()
          .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex) || [];
      const loadedGrades = gradeArray?.grades || [];
      const loadedInvoices = invoiceArray || [];

      setCategories(sortedCats);
      setGrades(loadedGrades);
      setInvoices(loadedInvoices);
      setJudgesPool(judgesArray || []);
      splitPlayersByStatus(loadedInvoices);
    } catch (error) {
      console.error("대시보드 데이터 로드 오류:", error);
    }
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId,
        currentContest.contests.id
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests?.id]);

  // 종목 + 체급별 확정 인원 / 입금대기 인원 매칭
  const categoriesWithPlayers = useMemo(() => {
    return categories.map((category) => {
      const catConfirmed = confirmedPlayers.filter(
        (p) => p.contestCategoryId === category.contestCategoryId
      );
      const catPending = pendingPlayers.filter(
        (p) => p.contestCategoryId === category.contestCategoryId
      );

      const catGrades = grades
        .filter((grade) => grade.refCategoryId === category.contestCategoryId)
        .sort(
          (a, b) => (a.contestGradeIndex ?? 999) - (b.contestGradeIndex ?? 999)
        )
        .map((grade) => {
          const gradeConfirmed = confirmedPlayers.filter(
            (p) => p.contestGradeId === grade.contestGradeId
          );
          const gradePending = pendingPlayers.filter(
            (p) => p.contestGradeId === grade.contestGradeId
          );
          return {
            ...grade,
            players: gradeConfirmed,
            pendingPlayers: gradePending,
            playerCount: gradeConfirmed.length,
            pendingCount: gradePending.length,
          };
        });

      return {
        ...category,
        players: catConfirmed,
        pendingPlayers: catPending,
        playerCount: catConfirmed.length,
        pendingCount: catPending.length,
        grades: catGrades,
      };
    });
  }, [categories, grades, confirmedPlayers, pendingPlayers]);

  // 정규 종목/체급 및 0명 미달 집계
  const {
    regularCategoriesCount,
    regularGradesCount,
    noRegistrationCategories,
    emptyGradesList,
  } = useMemo(() => {
    const regCats = categoriesWithPlayers.filter(
      (c) => !isGrandPrixCategory(c)
    );
    const noRegCats = regCats.filter(
      (c) => (c.playerCount || 0) + (c.pendingCount || 0) === 0
    );

    let regGradesTotal = 0;
    const emptyGrades = [];

    regCats.forEach((c) => {
      (c.grades || []).forEach((g) => {
        regGradesTotal += 1;
        if ((g.playerCount || 0) + (g.pendingCount || 0) === 0) {
          emptyGrades.push({
            ...g,
            categoryTitle: c.contestCategoryTitle,
          });
        }
      });
    });

    return {
      regularCategoriesCount: regCats.length,
      regularGradesCount: regGradesTotal,
      noRegistrationCategories: noRegCats,
      emptyGradesList: emptyGrades,
    };
  }, [categoriesWithPlayers]);

  const handleIsPriceCheckUpdate = async (invoiceId, playerUid, checked) => {
    if (!invoiceId || isUpdatingInvoiceId) return;
    const idx = invoices.findIndex((i) => i.id === invoiceId);
    if (idx < 0) return;

    const targetInvoice = invoices[idx];
    const newInvoices = [...invoices];
    const newInvoice = { ...targetInvoice, isPriceCheck: checked };
    newInvoices.splice(idx, 1, newInvoice);

    setIsUpdatingInvoiceId(invoiceId);
    const sessionUser = JSON.parse(sessionStorage.getItem("user") || "{}");

    try {
      if (checked) {
        let createdEntries = [];
        if (Array.isArray(newInvoice.joins) && newInvoice.joins.length > 0) {
          const resolvedContestId =
            newInvoice.contestId || currentContest?.contests?.id;
          const addedResults = await Promise.all(
            newInvoice.joins.map((join) =>
              addEntry.addData({
                contestId: resolvedContestId,
                invoiceId: invoiceId,
                playerUid: newInvoice.playerUid ?? "",
                playerName: newInvoice.playerName ?? "",
                playerBirth: newInvoice.playerBirth ?? "",
                playerGym: newInvoice.playerGym ?? "",
                playerTel: newInvoice.playerTel ?? "",
                playerText: newInvoice.playerText ?? "",
                invoiceCreateAt: newInvoice.invoiceCreateAt ?? null,
                createBy: newInvoice.createBy || "web",
                contestCategoryTitle: join.contestCategoryTitle,
                contestCategoryId: join.contestCategoryId,
                contestGradeTitle: join.contestGradeTitle,
                contestGradeId: join.contestGradeId,
                originalGradeTitle: join.contestGradeTitle,
                originalGradeId: join.contestGradeId,
                isGradeChanged: false,
                clientInfo: {
                  userID: sessionUser.userID || null,
                  userGroup: sessionUser.userGroup || null,
                  userContext: sessionUser.userContext || null,
                  userDocId: sessionUser.id || null,
                  clickedAt: new Date().toISOString(),
                  clientDevice: navigator.userAgent,
                },
              })
            )
          );

          createdEntries = addedResults.filter((res) => res && res.id);
          if (addedResults.some((res) => !res || !res.id)) {
            if (createdEntries.length > 0) {
              await Promise.all(
                createdEntries.map((entry) => deleteEntry.deleteData(entry.id))
              );
            }
            setModalMessage({
              variant: "error",
              title: "출전 명단 등록 오류",
              body: "출전 명단 등록 중 오류가 발생하여 입금확인이 취소되었습니다.",
              body2: "다시 시도해 주세요.",
              isButton: true,
              confirmButtonText: "확인",
            });
            setMsgOpen(true);
            return;
          }
        }

        const updated = await updateInvoice.updateData(invoiceId, {
          isPriceCheck: true,
        });
        if (!updated) {
          if (createdEntries.length > 0) {
            await Promise.all(
              createdEntries.map((entry) => deleteEntry.deleteData(entry.id))
            );
          }
          setModalMessage({
            variant: "error",
            title: "입금확인 저장 실패",
            body: "입금확인 상태 저장 중 오류가 발생했습니다.",
            isButton: true,
            confirmButtonText: "확인",
          });
          setMsgOpen(true);
          return;
        }

        await writePriceCheckLog({
          action: "add",
          invoice: newInvoice,
          sessionUser,
          currentContest,
        });
      } else {
        const entries = await queryInvoices.getDocuments(
          "contest_entrys_list",
          [where("contestId", "==", currentContest.contests.id)]
        );
        const myEntries = (entries || []).filter((e) =>
          e.invoiceId
            ? e.invoiceId === invoiceId
            : Boolean(playerUid && e.playerUid === playerUid)
        );
        for (const entry of myEntries) {
          await deleteEntry.deleteData(entry.id);
        }

        await updateInvoice.updateData(invoiceId, { isPriceCheck: false });
        await writePriceCheckLog({
          action: "del",
          invoice: newInvoice,
          sessionUser,
          currentContest,
        });
      }

      setInvoices(newInvoices);
      splitPlayersByStatus(newInvoices);
    } finally {
      setIsUpdatingInvoiceId(null);
    }
  };

  const {
    activeInvoicesCount,
    confirmedInvoicesCount,
    unconfirmedInvoicesCount,
    canceledInvoicesCount,
    confirmedFeeTotal,
    expectedFeeTotal,
  } = useMemo(() => {
    let active = 0;
    let confirmed = 0;
    let unconfirmed = 0;
    let canceled = 0;
    let confFee = 0;
    let expFee = 0;

    invoices.forEach((inv) => {
      const fee = Number(inv.contestPriceSum) || 0;
      if (inv.isCanceled) {
        canceled += 1;
        return;
      }
      active += 1;
      expFee += fee;
      if (inv.isPriceCheck) {
        confirmed += 1;
        confFee += fee;
      } else {
        unconfirmed += 1;
      }
    });

    return {
      activeInvoicesCount: active,
      confirmedInvoicesCount: confirmed,
      unconfirmedInvoicesCount: unconfirmed,
      canceledInvoicesCount: canceled,
      confirmedFeeTotal: confFee,
      expectedFeeTotal: expFee,
    };
  }, [invoices]);

  const unconfirmedAthletes = useMemo(
    () =>
      invoices.filter(
        (i) =>
          !i.isPriceCheck &&
          !i.isCanceled &&
          i.playerName &&
          i.playerName !== "이름 없음"
      ),
    [invoices]
  );

  const confirmedPlayersCount = useMemo(
    () =>
      new Set(
        invoices
          .filter((inv) => inv.isPriceCheck && !inv.isCanceled)
          .map((inv) => inv.playerUid || inv.id)
      ).size,
    [invoices]
  );

  const totalUniqueAthletes = useMemo(
    () =>
      new Set(
        invoices
          .filter((inv) => !inv.isCanceled)
          .map((inv) => inv.playerUid || inv.id)
      ).size,
    [invoices]
  );

  const totalEntries = confirmedPlayers.length;
  const pendingEntries = pendingPlayers.length;

  const totalGradesCount = grades.length;
  const savedGradeIds = realtimeStageData?.resultSaved || [];
  const savedGradesCount = savedGradeIds.length;

  const contestTitle =
    currentContest?.contestInfo?.contestTitle || "대회 운영 대시보드";
  const contestLocation = currentContest?.contestInfo?.contestLocation;
  const contestDate = currentContest?.contestInfo?.contestDate;
  const contestStatus = currentContest?.contestInfo?.contestStatus;
  const startPlayerNumber =
    Number(currentContest?.contests?.startPlayerNumber) >= 1
      ? Number(currentContest.contests.startPlayerNumber)
      : 1;

  const renderTabLabel = (icon, text, count, key) => {
    const isActive = activeTabKey === key;
    return (
      <span className="inline-flex items-center gap-2 px-1 tabular-nums">
        <span className={isActive ? "text-[#2563eb]" : "text-[#737373]"}>
          {icon}
        </span>
        <span
          className={`text-[14px] leading-5 font-medium ${
            isActive ? "text-[#171717]" : "text-[#525252]"
          }`}
        >
          {text}
        </span>
        {typeof count === "number" && (
          <span className="font-mono text-xs leading-4 text-[#737373]">
            {count}
          </span>
        )}
      </span>
    );
  };

  const prepShortcuts = [
    {
      to: "/contest-entries",
      label: "참가접수 · 입금확정",
      icon: <ClipboardCheck size={14} strokeWidth={1.5} />,
    },
    {
      to: "/stage-1-numbering",
      label: "① 초기 배번",
      icon: <Users size={14} strokeWidth={1.5} />,
    },
    {
      to: "/stage-2-weighin",
      label: "② 선수 계측",
      icon: <Scale size={14} strokeWidth={1.5} />,
    },
    {
      to: "/judges-hub",
      label: "심판 선발·배정",
      icon: <UserCheck size={14} strokeWidth={1.5} />,
    },
    {
      to: "/stage-4-stages",
      label: "④ 무대 편성",
      icon: <CalendarClock size={14} strokeWidth={1.5} />,
    },
    {
      to: "/print-center",
      label: "출력·집계 센터",
      icon: <Printer size={14} strokeWidth={1.5} />,
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5">
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />
      {/* Page Header & Pre-Contest Management Shortcuts */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] sm:text-[24px] leading-8 font-semibold text-[#171717] m-0 tracking-[-0.01em]">
              {contestTitle}
            </h1>
            {contestStatus && (
              <span className="px-2 py-0.5 rounded-[5px] bg-[#2563eb]/[0.08] border border-[#2563eb]/20 text-[#2563eb] text-xs font-medium">
                {contestStatus}
              </span>
            )}
          </div>
          {(contestDate || contestLocation) && (
            <div className="flex items-center gap-2 text-xs leading-4 text-[#737373] tabular-nums">
              {contestDate && <span className="font-mono">{contestDate}</span>}
              {contestDate && contestLocation && <span aria-hidden="true">·</span>}
              {contestLocation && <span>{contestLocation}</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {prepShortcuts.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="h-8 px-3 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs font-medium text-[#171717] no-underline inline-flex items-center gap-1.5 transition-colors duration-150"
            >
              <span className="text-[#525252]">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Slim Contest-Day Status Strip (평상시 1줄 최소화 · 당일 진행 시 상태 표시) */}
      <LiveStageStatusCard
        realtimeData={realtimeStageData}
        totalGradesCount={totalGradesCount}
        savedGradesCount={savedGradesCount}
      />

      {/* 1. 대회 전반 핵심 지표 6종 (접수 · 실인원 · 연인원 · 참가비 · 체급충원 · 일정) */}
      <RegistrationMetricCards
        activeInvoicesCount={activeInvoicesCount}
        confirmedInvoicesCount={confirmedInvoicesCount}
        unconfirmedInvoicesCount={unconfirmedInvoicesCount}
        canceledInvoicesCount={canceledInvoicesCount}
        confirmedPlayersCount={confirmedPlayersCount}
        totalUniqueAthletes={totalUniqueAthletes}
        totalEntries={totalEntries}
        pendingEntries={pendingEntries}
        confirmedFeeTotal={confirmedFeeTotal}
        expectedFeeTotal={expectedFeeTotal}
        regularCategoriesCount={regularCategoriesCount}
        regularGradesCount={regularGradesCount}
        emptyGradesList={emptyGradesList}
        noRegistrationCategories={noRegistrationCategories}
        judgesCount={judgesPool.length}
        contestDate={contestDate}
        startPlayerNumber={startPlayerNumber}
      />

      {/* 2. 접수 현황 파이프라인 & 최근/미확정 빠른 승인 섹션 */}
      <RegistrationOverviewSection
        invoices={invoices}
        onPriceCheckUpdate={handleIsPriceCheckUpdate}
        isUpdatingId={isUpdatingInvoiceId}
      />

      {/* 3. 종목 및 체급별 선수 분포 (메인 전면 배치) */}
      <section
        aria-label="종목 및 체급별 선수 분포"
        className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5"
      >
        <CategoryGradeStatusGrid
          categories={categoriesWithPlayers}
          savedGradeIds={savedGradeIds}
        />
      </section>

      {/* 4. 보조 운영 상세 탭 (통계 비율 · 심판진 명단 · 미확정 전체 검색) */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
        <Tabs
          activeKey={activeTabKey}
          onChange={setActiveTabKey}
          items={[
            {
              key: "analytics",
              label: renderTabLabel(
                <BarChart3 {...tabIconProps} />,
                "출전 통계 및 소속 분석",
                undefined,
                "analytics"
              ),
              children: (
                <div className="pt-2">
                  <AthleteRatioAnalytics
                    confirmedPlayersCount={confirmedPlayersCount}
                    unconfirmedPlayersCount={unconfirmedAthletes.length}
                    invoices={invoices}
                    categories={categoriesWithPlayers}
                  />
                </div>
              ),
            },
            {
              key: "unconfirmed",
              label: renderTabLabel(
                <UserCheck {...tabIconProps} />,
                "미확정 선수 전체 명단",
                unconfirmedAthletes.length,
                "unconfirmed"
              ),
              children: (
                <div className="pt-2">
                  <UnconfirmedAthletesTable
                    data={unconfirmedAthletes}
                    onPriceCheckUpdate={handleIsPriceCheckUpdate}
                  />
                </div>
              ),
            },
            {
              key: "judges",
              label: renderTabLabel(
                <Users {...tabIconProps} />,
                "위촉 심판진 및 배정 관리",
                judgesPool.length,
                "judges"
              ),
              children: (
                <div className="pt-2">
                  <JudgesOverviewPanel judges={judgesPool} />
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

export default Dashboard;
