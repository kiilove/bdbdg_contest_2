"use client";
import React, { useContext, useEffect, useState, useMemo } from "react";
import { where } from "firebase/firestore";
import { Tabs } from "antd";
import {
  TeamOutlined,
  UserOutlined,
  TrophyOutlined,
  PieChartOutlined,
} from "@ant-design/icons";

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

// 새로 제작된 대시보드 컴포넌트들
import LiveStageStatusCard from "../components/dashboard/LiveStageStatusCard";
import RegistrationMetricCards from "../components/dashboard/RegistrationMetricCards";
import JudgesOverviewPanel from "../components/dashboard/JudgesOverviewPanel";
import UnconfirmedAthletesTable from "../components/dashboard/UnconfirmedAthletesTable";
import CategoryGradeStatusGrid from "../components/dashboard/CategoryGradeStatusGrid";
import AthleteRatioAnalytics from "../components/dashboard/AthleteRatioAnalytics";

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

  // 실시간 무대 정보 구독 (currentStage)
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

  /** Firestore 데이터 통합 로드 */
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

  /** 선수 데이터 병합 (확정된 선수만) */
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

  /** 카테고리 & 체급별 선수 매칭 */
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

  /** 그랑프리 종목 여부 판별 (사전 신청자가 없으므로 미달 집계에서 제외) */
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
  }, [players, categories, grades]);

  useEffect(() => {
    if (currentContest?.contests) {
      fetchPool(
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId,
        currentContest.contests.id
      );
    }
  }, [currentContest]);

  /** 입금/등록확인 토글 처리 로직 */
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

  /** 미확정 선수 목록 */
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

  // 확정 고유 선수 수
  const confirmedPlayersCount = useMemo(
    () =>
      new Set(
        invoices
          .filter((inv) => inv.isPriceCheck && !inv.isCanceled)
          .map((inv) => inv.playerUid)
      ).size,
    [invoices]
  );

  // 전체 고유 신청자 수
  const totalUniqueAthletes = useMemo(
    () => new Set(invoices.filter((inv) => !inv.isCanceled).map((inv) => inv.playerUid)).size,
    [invoices]
  );

  // 총 출전 번호표 (티켓) 수
  const totalEntries = useMemo(
    () =>
      invoices
        .filter((inv) => inv.isPriceCheck && !inv.isCanceled)
        .reduce((sum, inv) => sum + (inv.joins?.length || 0), 0),
    [invoices]
  );

  // 총 체급 수 및 심사 완료 체급 수 계산
  const totalGradesCount = grades.length;
  const savedGradeIds = realtimeStageData?.resultSaved || [];
  const savedGradesCount = savedGradeIds.length;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* 1. 실시간 LIVE 무대 관제 & 빠른 바로가기 카드 */}
      <LiveStageStatusCard
        realtimeData={realtimeStageData}
        currentContest={currentContest}
        totalGradesCount={totalGradesCount}
        savedGradesCount={savedGradesCount}
      />

      {/* 2. 선수 등록 & 심판 & 경기 운영 핵심 KPI 카드 5종 */}
      <RegistrationMetricCards
        invoices={invoices}
        confirmedPlayersCount={confirmedPlayersCount}
        unconfirmedPlayersCount={unconfirmedAthletes.length}
        totalUniqueAthletes={totalUniqueAthletes}
        totalEntries={totalEntries}
        judgesCount={judgesPool.length}
        noRegistrationCategories={noRegistrationCategories}
        contestDate={currentContest?.contestInfo?.contestDate}
      />

      {/* 3. 대회 실무 4대 운영 탭 허브 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <Tabs
          activeKey={activeTabKey}
          onChange={setActiveTabKey}
          size="large"
          items={[
            {
              key: "judges",
              label: (
                <span className="flex items-center gap-2 font-bold px-1">
                  <TeamOutlined className="text-purple-600 text-base" />
                  <span>심판진 운영 및 배정 ({judgesPool.length}명)</span>
                </span>
              ),
              children: (
                <div className="pt-2">
                  <JudgesOverviewPanel judges={judgesPool} />
                </div>
              ),
            },
            {
              key: "unconfirmed",
              label: (
                <span className="flex items-center gap-2 font-bold px-1">
                  <UserOutlined className="text-amber-500 text-base" />
                  <span>
                    미등록 선수 관리 ({unconfirmedAthletes.length}명)
                  </span>
                </span>
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
              label: (
                <span className="flex items-center gap-2 font-bold px-1">
                  <TrophyOutlined className="text-blue-600 text-base" />
                  <span>종목 및 체급별 출전 현황</span>
                </span>
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
              label: (
                <span className="flex items-center gap-2 font-bold px-1">
                  <PieChartOutlined className="text-emerald-600 text-base" />
                  <span>출전 데이터 통계 및 비율 분석</span>
                </span>
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
