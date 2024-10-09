// components/Dashboard.js
import React, { useContext, useEffect, useState } from "react";
import UnconfirmedAthletesTable from "../components/dashboard/UnconfirmedAthletesTable";
import CategoryDistributionChart from "../components/dashboard/CategoryDistributionChart";
import NoRegistrationCategories from "../components/dashboard/NoRegistrationCategories";
import AssignedJudgesList from "../components/dashboard/AssignedJudgesList";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import RegistrationTrendChart from "../components/dashboard/RegistrationTrendChart";

const mockData = {
  unconfirmedAthletes: [
    { key: 1, name: "홍길동", category: "70kg", status: "Pending" },
    { key: 2, name: "이순신", category: "80kg", status: "Pending" },
  ],
  categoryDistribution: [
    { category: "70kg", count: 10 },
    { category: "80kg", count: 5 },
    { category: "90kg", count: 0 },
  ],
  assignedJudges: [
    { key: 1, name: "박심판", position: "Head Judge" },
    { key: 2, name: "김심판", position: "Judge" },
  ],
};

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

  const fetchPool = async (categoryListId, gradeListId, contestId) => {
    const condition = [
      where("contestId", "==", contestId),
      where("isPriceCheck", "==", true),
    ];

    try {
      const [categoryArray, gradeArray, invoiceArray] = await Promise.all([
        fetchCategories.getDocument(categoryListId),
        fetchGrades.getDocument(gradeListId),
        queryInvoices.getDocuments("invoices_pool", condition),
      ]);

      setCategories(
        categoryArray?.categorys.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        ) || []
      );
      setGrades(gradeArray?.grades || []);
      setInvoices(invoiceArray);
      mergePlayersWithGrades(gradeArray?.grades || [], invoiceArray);
    } catch (error) {
      console.error("Error fetching categories or grades:", error);
    }
  };

  // 선수 데이터 병합
  const mergePlayersWithGrades = (grades, invoices) => {
    const flattenPlayers = invoices.flatMap((invoice) =>
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

  // 카테고리와 선수 매칭
  const matchCategoriesAndPlayers = (categories, players) => {
    const matchedData = categories.map((category) => {
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
    return matchedData;
  };

  // 체급과 선수 매칭
  const matchGradesAndPlayers = (category, grades, players) => {
    return grades
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
  };

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
    console.log(categoriesWithPlayers);
  }, [categoriesWithPlayers]);

  useEffect(() => {
    if (currentContest?.contests) {
      fetchPool(
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId,
        currentContest.contests.id
      );
    }
  }, [currentContest]);

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <CategoryDistributionChart data={categoriesWithPlayers} />
      <RegistrationTrendChart invoices={invoices} />
      <UnconfirmedAthletesTable data={mockData.unconfirmedAthletes} />
      <NoRegistrationCategories categories={noRegistrationCategories} />
      <AssignedJudgesList judges={mockData.assignedJudges} />
    </div>
  );
};

export default Dashboard;
