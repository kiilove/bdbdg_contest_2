"use client";
import React, { useContext, useEffect, useState, useMemo } from "react";
import { where } from "firebase/firestore";
import { Tabs } from "antd";
import { Users, UserCheck, Trophy, BarChart3 } from "lucide-react";

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

import LiveStageStatusCard from "../components/dashboard/LiveStageStatusCard";
import RegistrationMetricCards from "../components/dashboard/RegistrationMetricCards";
import JudgesOverviewPanel from "../components/dashboard/JudgesOverviewPanel";
import UnconfirmedAthletesTable from "../components/dashboard/UnconfirmedAthletesTable";
import CategoryGradeStatusGrid from "../components/dashboard/CategoryGradeStatusGrid";
import AthleteRatioAnalytics from "../components/dashboard/AthleteRatioAnalytics";

const tabIconProps = { size: 16, strokeWidth: 1.5 };

const Dashboard = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [categories, setCategories] = useState([]);
  const [grades, setGrades] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [players, setPlayers] = useState([]);
  const [judgesPool, setJudgesPool] = useState([]);
  const [categoriesWithPlayers, setCategoriesWithPlayers] = useState([]);
  const [noRegistrationCategories, setNoRegistrationCategories] = useState([]);
  const [activeTabKey, setActiveTabKey] = useState("judges");

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

  const fetchPool = async (categoryListId, gradeListId, contestId) => {
    const condition = [where("contestId", "==", contestId)];
    try {
      const [categoryArray, gradeArray, invoiceArray, judgesArray] =
        await Promise.all([
          fetchCategories.getDocument(categoryListId),
          fetchGrades.getDocument(gradeListId),
          queryInvoices.getDocuments("invoices_pool", condition),
          queryJudges.getDocuments("contest_judges_pool", condition),
        ]);

      setCategories(
        categoryArray?.categorys?.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        ) || []
      );
      setGrades(gradeArray?.grades || []);
      setInvoices(invoiceArray || []);
      setJudgesPool(judgesArray || []);
      mergePlayersWithGrades(gradeArray?.grades || [], invoiceArray || []);
    } catch (error) {
      console.error("대시보드 데이터 로드 오류:", error);
    }
  };

  const mergePlayersWithGrades = (grades, invoices) => {
    const flattenPlayers = invoices
      .filter((invoice) => invoice.isPriceCheck && !invoice.isCanceled)
      .flatMap((invoice) =>
        (invoice.joins || []).map((join) => ({
          ...invoice,
          contestCategoryId: join.contestCategoryId,
          contestCategoryTitle: join.contestCategoryTitle,
          contestGradeId: join.contestGradeId,
          contestGradeTitle: join.contestGradeTitle,
        }))
      );
    setPlayers(flattenPlayers);
  };

  const matchCategoriesAndPlayers = (categories, players, grades) =>
    categories.map((category) => {
      const matchingPlayers = players.filter(
        (player) => player.contestCategoryId === category.contestCategoryId
      );
      const catGrades = grades
        .filter((grade) => grade.refCategoryId === category.contestCategoryId)
        .map((grade) => {
          const gradePlayers = players.filter(
            (player) => player.contestGradeId === grade.contestGradeId
          );
          return {
            ...grade,
            players: gradePlayers,
            playerCount: gradePlayers.length,
          };
        });

      return {
        ...category,
        players: matchingPlayers,
        playerCount: matchingPlayers.length,
        grades: catGrades,
      };
    });

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

  const updateNoRegistrationCategories = (categoryData) => {
    const noRegCategories = categoryData.filter(
      (item) => item.playerCount === 0 && !isGrandPrixCategory(item)
    );
    setNoRegistrationCategories(noRegCategories);
  };

  useEffect(() => {
    const matchedData = matchCategoriesAndPlayers(categories, players, grades);
    setCategoriesWithPlayers(matchedData);
    updateNoRegistrationCategories(matchedData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, categories, grades]);

  useEffect(() => {
    if (currentContest?.contests) {
      fetchPool(
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId,
        currentContest.contests.id
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest]);

  const handleIsPriceCheckUpdate = async (invoiceId, playerUid, checked) => {
    const idx = invoices.findIndex((i) => i.id === invoiceId);
    if (idx < 0) return;

    const newInvoices = [...invoices];
    const newInvoice = { ...newInvoices[idx], isPriceCheck: checked };
    newInvoices.splice(idx, 1, newInvoice);
    setInvoices(newInvoices);

    const sessionUser = JSON.parse(sessionStorage.getItem("user") || "{}");

    if (checked) {
      if (newInvoice.joins?.length) {
        for (let join of newInvoice.joins) {
          await addEntry.addData({
            contestId: newInvoice.contestId,
            invoiceId: invoiceId,
            playerUid: newInvoice.playerUid,
            playerName: newInvoice.playerName,
            playerBirth: newInvoice.playerBirth,
            playerGym: newInvoice.playerGym,
            playerTel: newInvoice.playerTel,
            playerText: newInvoice.playerText,
            invoiceCreateAt: newInvoice.invoiceCreateAt,
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
          });
        }
      }

      await writePriceCheckLog({
        action: "add",
        invoice: newInvoice,
        sessionUser,
        currentContest,
      });
    } else {
      const entries = await queryInvoices.getDocuments("contest_entrys_list", [
        where("contestId", "==", currentContest.contests.id),
      ]);
      const myEntries = entries.filter((e) => e.playerUid === playerUid);
      for (let entry of myEntries) await deleteEntry.deleteData(entry.id);

      await writePriceCheckLog({
        action: "del",
        invoice: newInvoice,
        sessionUser,
        currentContest,
      });
    }

    await updateInvoice.updateData(invoiceId, { isPriceCheck: checked });
    mergePlayersWithGrades(grades, newInvoices);
  };

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
          .map((inv) => inv.playerUid)
      ).size,
    [invoices]
  );

  const totalUniqueAthletes = useMemo(
    () =>
      new Set(
        invoices.filter((inv) => !inv.isCanceled).map((inv) => inv.playerUid)
      ).size,
    [invoices]
  );

  const totalEntries = useMemo(
    () =>
      invoices
        .filter((inv) => inv.isPriceCheck && !inv.isCanceled)
        .reduce((sum, inv) => sum + (inv.joins?.length || 0), 0),
    [invoices]
  );

  const totalGradesCount = grades.length;
  const savedGradeIds = realtimeStageData?.resultSaved || [];
  const savedGradesCount = savedGradeIds.length;

  const contestTitle =
    currentContest?.contestInfo?.contestTitle || "대회 운영 대시보드";
  const contestLocation = currentContest?.contestInfo?.contestLocation;
  const contestDate = currentContest?.contestInfo?.contestDate;

  const renderTabLabel = (icon, text, count, key) => {
    const isActive = activeTabKey === key;
    return (
      <span className="inline-flex items-center gap-2 px-1 tabular-nums">
        <span
          className={
            isActive ? "text-[#2563eb]" : "text-[#737373]"
          }
        >
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

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Page Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <h1 className="text-[24px] leading-8 font-medium text-[#171717] m-0 tracking-[-0.01em]">
          {contestTitle}
        </h1>
        {(contestDate || contestLocation) && (
          <div className="flex items-center gap-2 text-xs leading-4 text-[#737373] tabular-nums">
            {contestDate && <span className="font-mono">{contestDate}</span>}
            {contestDate && contestLocation && <span aria-hidden="true">·</span>}
            {contestLocation && <span>{contestLocation}</span>}
          </div>
        )}
      </div>

      {/* 1. Moment #1: Dark Graphite Live Stage Instrument Console */}
      <LiveStageStatusCard
        realtimeData={realtimeStageData}
        currentContest={currentContest}
        totalGradesCount={totalGradesCount}
        savedGradesCount={savedGradesCount}
      />

      {/* 2. 5 Clean Stat Cards */}
      <RegistrationMetricCards
        invoices={invoices}
        confirmedPlayersCount={confirmedPlayersCount}
        unconfirmedPlayersCount={unconfirmedAthletes.length}
        totalUniqueAthletes={totalUniqueAthletes}
        totalEntries={totalEntries}
        judgesCount={judgesPool.length}
        noRegistrationCategories={noRegistrationCategories}
        contestDate={contestDate}
      />

      {/* 3. Operational Tabs Hub */}
      <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
        <Tabs
          activeKey={activeTabKey}
          onChange={setActiveTabKey}
          items={[
            {
              key: "judges",
              label: renderTabLabel(
                <Users {...tabIconProps} />,
                "심판진 운영 및 배정",
                judgesPool.length,
                "judges"
              ),
              children: (
                <div className="pt-2">
                  <JudgesOverviewPanel judges={judgesPool} />
                </div>
              ),
            },
            {
              key: "unconfirmed",
              label: renderTabLabel(
                <UserCheck {...tabIconProps} />,
                "미등록 선수 관리",
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
              key: "categories",
              label: renderTabLabel(
                <Trophy {...tabIconProps} />,
                "종목 및 체급별 출전 현황",
                undefined,
                "categories"
              ),
              children: (
                <div className="pt-2">
                  <CategoryGradeStatusGrid
                    categories={categoriesWithPlayers}
                    savedGradeIds={savedGradeIds}
                  />
                </div>
              ),
            },
            {
              key: "analytics",
              label: renderTabLabel(
                <BarChart3 {...tabIconProps} />,
                "출전 데이터 통계 및 비율",
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
          ]}
        />
      </div>
    </div>
  );
};

export default Dashboard;
