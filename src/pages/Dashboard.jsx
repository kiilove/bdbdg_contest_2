// components/Dashboard.js
import React from "react";
import UnconfirmedAthletesTable from "../components/dashboard/UnconfirmedAthletesTable";
import CategoryDistributionChart from "../components/dashboard/CategoryDistributionChart";
import NoRegistrationCategories from "../components/dashboard/NoRegistrationCategories";
import AssignedJudgesList from "../components/dashboard/AssignedJudgesList";

// 가상 데이터
const unconfirmedAthletes = [
  { key: 1, name: "홍길동", category: "70kg", status: "Pending" },
  { key: 2, name: "이순신", category: "80kg", status: "Pending" },
  // 더 많은 데이터 추가 가능
];

const categoryDistribution = [
  { category: "70kg", count: 10 },
  { category: "80kg", count: 5 },
  { category: "90kg", count: 0 },
];

const noRegistrationCategories = categoryDistribution.filter(
  (item) => item.count === 0
);

const assignedJudges = [
  { key: 1, name: "박심판", position: "Head Judge" },
  { key: 2, name: "김심판", position: "Judge" },
  // 더 많은 데이터 추가 가능
];

const Dashboard = () => (
  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
    <UnconfirmedAthletesTable data={unconfirmedAthletes} />
    <CategoryDistributionChart data={categoryDistribution} />
    <NoRegistrationCategories categories={noRegistrationCategories} />
    <AssignedJudgesList judges={assignedJudges} />
  </div>
);

export default Dashboard;
