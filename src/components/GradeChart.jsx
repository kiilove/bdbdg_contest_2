import React from "react";
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from "recharts";

// 임의의 색상 배열
const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#ffbb28",
  "#83a6ed",
  "#8dd1e1",
  "#d0ed57",
  "#a4de6c",
  "#0088FE",
];

// label을 커스터마이즈하여 gradeTitle, 출전선수 숫자, %를 표시하도록 수정
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
  players,
}) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

  return (
    <text
      x={x}
      y={y}
      fill="black"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {`${name}: ${players}명 (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};

const GradeChart = ({ data, title }) => {
  return (
    <div>
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            dataKey="players" // 출전선수 숫자
            nameKey="name" // gradeTitle
            outerRadius={150}
            fill="#8884d8"
            label={renderCustomizedLabel} // 커스터마이즈된 label을 사용
            labelLine={false} // 선 라벨 제거
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]} // 색상 지정
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GradeChart;
