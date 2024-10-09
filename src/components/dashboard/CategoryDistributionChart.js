// components/CategoryDistributionChart.js
import React, { useContext, useEffect, useState } from "react";
import { Card } from "antd";
import { PieChart, Pie, Cell, Tooltip, Legend, Text } from "recharts";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../../hooks/useFirestores";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import { where } from "firebase/firestore";
import {
  matchedGradewWithPlayers,
  matchingCategoriesWithGrades,
} from "../../functions/functions";
import { CHART_COLORS } from "../constColors";

const CategoryDistributionChart = ({ data }) => {
  const { currentContest } = useContext(CurrentContestContext);
  const [categories, setCategories] = useState([]);
  const [grades, setGrades] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [players, setPlayers] = useState([]);
  const [categoriesWithPlayers, setCategoriesWithPlayers] = useState([]);
  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const queryInvoices = useFirestoreQuery();

  const fetchPool = async (categoryListId, gradeListId, contestId) => {
    const condition = [
      where("contestId", "==", contestId),
      where("isPriceCheck", "==", true),
    ];
    try {
      // Promise.all을 사용하여 병렬로 데이터 가져오기
      const [categoryArray, gradeArray, invoiceArray] = await Promise.all([
        fetchCategories.getDocument(categoryListId),
        fetchGrades.getDocument(gradeListId),
        queryInvoices.getDocuments("invoices_pool", condition),
      ]);

      console.log({ categoryArray, gradeArray, invoiceArray });
      // 가져온 데이터를 상태에 할당
      setCategories(
        categoryArray?.categorys.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        ) || []
      );
      setGrades(gradeArray?.grades || []);
      setInvoices(invoiceArray);
    } catch (error) {
      console.error("Error fetching categories or grades:", error);
      // 에러 처리 로직을 추가할 수 있습니다.
    }
  };

  const matchingGradesWithInvoices = (grades, invoices) => {
    const flattenPlayers = invoices.flatMap((player) =>
      player.joins.map((join) => ({
        ...player,
        contestCategoryId: join.contestCategoryId,
        contestCategoryTitle: join.contestCategoryTitle,
        contestGradeId: join.contestGradeId,
        contestGradeTitle: join.contestGradeTitle,
      }))
    );
    setPlayers(flattenPlayers);
    return flattenPlayers;
  };

  const matchingCategoryAndPlayers = (categories, players) => {
    const matchedData = categories.map((category) => {
      const matchingPlayers = players.filter(
        (f) => f.contestCategoryId === category.contestCategoryId
      );

      return {
        ...category,
        players: [...matchingPlayers],
        playerCount: matchingPlayers.length,
      };
    });

    return matchedData;
  };

  useEffect(() => {
    console.log(matchingCategoriesWithGrades(categories, grades));
    console.log(matchingGradesWithInvoices(grades, invoices));
  }, [categories, grades, invoices]);

  useEffect(() => {
    console.log(matchingCategoryAndPlayers(categories, players));
    setCategoriesWithPlayers(matchingCategoryAndPlayers(categories, players));
  }, [players, categories]);

  useEffect(() => {
    if (currentContest?.contests) {
      console.log(currentContest.contests);
      fetchPool(
        currentContest.contests.contestCategorysListId,
        currentContest.contests.contestGradesListId,
        currentContest.contests.id
      );
    }
  }, [currentContest]);

  // 데이터가 없는 경우 메시지 표시
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500">데이터가 없습니다.</div>;
  }

  // 색상 팔레트 설정
  const COLORS = [...CHART_COLORS];

  const CustomLabel = ({ x, y, name, percent }) => {
    return (
      <Text
        x={x}
        y={y}
        fill="#000000" // 검정색으로 설정
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
      >
        {name}
      </Text>
    );
  };

  return (
    <Card title="카테고리별 참가 신청 분포" className="mb-4">
      <PieChart width={500} height={500}>
        <Pie
          data={categoriesWithPlayers.filter((f) => f.playerCount > 0)}
          dataKey="playerCount"
          nameKey="contestCategoryTitle"
          cx="50%"
          cy="50%"
          outerRadius={100}
          fill="#8884d8"
          label={<CustomLabel />}
        >
          {categoriesWithPlayers.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </Card>
  );
};

export default CategoryDistributionChart;
