// Dashboard.js
import React, { useContext, useEffect, useState, useMemo } from "react";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import CategoryDistributionChart from "../components/dashboard/CategoryDistributionChart";
import NoRegistrationCategories from "../components/dashboard/NoRegistrationCategories";
import RegistrationTrendChart from "../components/dashboard/RegistrationTrendChart";
import AgeGenderDistributionChart from "../components/dashboard/AgeGenderDistributionChart";
import UnconfirmedAthletesTable from "../components/dashboard/UnconfirmedAthletesTable";
import SummaryCards from "../components/dashboard/SummaryCards";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreAddData,
  useFirestoreDeleteData,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";

const Dashboard = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [categories, setCategories] = useState([]);
  const [grades, setGrades] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [players, setPlayers] = useState([]);
  const [categoriesWithPlayers, setCategoriesWithPlayers] = useState([]);
  const [noRegistrationCategories, setNoRegistrationCategories] = useState([]);

  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const queryInvoices = useFirestoreQuery();
  const addEntry = useFirestoreAddData("contest_entrys_list");
  const deleteEntry = useFirestoreDeleteData("contest_entrys_list");
  const updateInvoice = useFirestoreUpdateData("invoices_pool");

  /** 🛠️ Firestore 데이터 불러오기 */
  const fetchPool = async (categoryListId, gradeListId, contestId) => {
    const condition = [where("contestId", "==", contestId)];
    try {
      const [categoryArray, gradeArray, invoiceArray] = await Promise.all([
        fetchCategories.getDocument(categoryListId),
        fetchGrades.getDocument(gradeListId),
        queryInvoices.getDocuments("invoices_pool", condition),
      ]);

      setCategories(
        categoryArray?.categorys?.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        ) || []
      );
      setGrades(gradeArray?.grades || []);
      setInvoices(invoiceArray || []);
      mergePlayersWithGrades(gradeArray?.grades || [], invoiceArray || []);
    } catch (error) {
      console.error("Error fetching categories or grades:", error);
    }
  };

  /** 선수 데이터 병합 (입금확정 + 취소되지 않은 선수만 포함) */
  const mergePlayersWithGrades = (grades, invoices) => {
    const flattenPlayers = invoices
      .filter((invoice) => invoice.isPriceCheck && !invoice.isCanceled)
      .flatMap((invoice) =>
        invoice.joins.map((join) => ({
          ...invoice,
          contestCategoryId: join.contestCategoryId,
          contestCategoryTitle: join.contestCategoryTitle,
          contestGradeId: join.contestGradeId,
          contestGradeTitle: join.contestGradeTitle,
        }))
      );
    setPlayers(flattenPlayers);
  };

  /** 카테고리 & 선수 매칭 */
  const matchCategoriesAndPlayers = (categories, players) =>
    categories.map((category) => {
      const matchingPlayers = players.filter(
        (player) => player.contestCategoryId === category.contestCategoryId
      );
      return {
        ...category,
        players: matchingPlayers,
        playerCount: matchingPlayers.length,
        grades: matchGradesAndPlayers(category, grades, matchingPlayers),
      };
    });

  /** 체급 & 선수 매칭 */
  const matchGradesAndPlayers = (category, grades, players) =>
    grades
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

  const updateNoRegistrationCategories = (categoryData) => {
    const noRegCategories = categoryData.filter(
      (item) => item.playerCount === 0
    );
    setNoRegistrationCategories(noRegCategories);
  };

  useEffect(() => {
    const matchedData = matchCategoriesAndPlayers(categories, players);
    setCategoriesWithPlayers(matchedData);
    updateNoRegistrationCategories(matchedData);
  }, [players, categories]);

  useEffect(() => {
    if (currentContest?.contests) {
      fetchPool(
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId,
        currentContest.contests.id
      );
    }
  }, [currentContest]);

  /** ✅ 입금확인 처리 로직 */
  const handleIsPriceCheckUpdate = async (invoiceId, playerUid, checked) => {
    const idx = invoices.findIndex((i) => i.id === invoiceId);
    if (idx < 0) return;

    const newInvoices = [...invoices];
    const newInvoice = { ...newInvoices[idx], isPriceCheck: checked };
    newInvoices.splice(idx, 1, newInvoice);
    setInvoices(newInvoices);

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
          });
        }
      }
    } else {
      const entries = await queryInvoices.getDocuments("contest_entrys_list", [
        where("contestId", "==", currentContest.contests.id),
      ]);
      const myEntries = entries.filter((e) => e.playerUid === playerUid);
      for (let entry of myEntries) await deleteEntry.deleteData(entry.id);
    }

    await updateInvoice.updateData(invoiceId, { isPriceCheck: checked });
  };

  /** ✅ 미확정 선수만 필터링 */
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

  return (
    <div className="p-4 space-y-4">
      {/* ✅ 요약 정보 카드 (전체 폭) */}
      <div className="grid grid-cols-1">
        <SummaryCards
          categories={categoriesWithPlayers}
          invoices={invoices.filter(
            (inv) => inv.isPriceCheck && !inv.isCanceled
          )}
          contestDate={currentContest?.contestInfo?.contestDate}
          noRegistrationCategories={noRegistrationCategories}
        />
      </div>

      {/* ✅ 미확정 선수 테이블 (전체 폭) */}
      <div className="grid grid-cols-1">
        <UnconfirmedAthletesTable
          data={unconfirmedAthletes}
          onPriceCheckUpdate={handleIsPriceCheckUpdate}
        />
      </div>

      {/* ✅ 나머지 차트들은 1줄 2개 배치 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CategoryDistributionChart data={categoriesWithPlayers} />
        <AgeGenderDistributionChart invoices={invoices} />
        <RegistrationTrendChart invoices={invoices} />
        <NoRegistrationCategories categories={noRegistrationCategories} />
      </div>
    </div>
  );
};

export default Dashboard;
