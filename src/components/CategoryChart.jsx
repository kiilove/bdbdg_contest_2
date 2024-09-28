import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";

// 15개의 색상 배열
const colors = [
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
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#A28BFB",
  "#FF6B6B",
];

// 데이터를 색상과 함께 포맷팅하는 함수
const formatDataWithColors = (data) => {
  return data.map((entry, index) => ({
    ...entry,
    fill: colors[index % colors.length], // 각 데이터에 색상 추가
  }));
};

// 커스텀 툴팁 컴포넌트
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="custom-tooltip"
        style={{
          backgroundColor: "#fff",
          padding: "10px",
          border: "1px solid #ccc",
        }}
      >
        <p className="label">{`${label}`}</p>
        <p className="desc">{`출전 선수: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

const CategoryChart = ({ data, title, onBarClick }) => {
  // 색상이 포함된 데이터를 만듦
  const formattedData = formatDataWithColors(data);

  return (
    <div>
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={formattedData} // 색상이 포함된 데이터 사용
          layout="vertical" // 수평형 차트로 변경
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          onClick={(e) => onBarClick && onBarClick(e)} // 클릭 이벤트 추가
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" /> {/* X축에 인원 표시 */}
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            interval={0}
            tick={{ fontSize: "12px" }}
          />{" "}
          {/* Y축 모든 레이블 표시 및 폰트 크기 조정 */}
          <Tooltip content={<CustomTooltip />} /> {/* 툴팁 추가 */}
          <Legend />
          <Bar dataKey="players" fill={({ payload }) => payload.fill}>
            {/* LabelList로 각 Bar 위에 출전 선수 숫자를 표시 */}
            <LabelList
              dataKey="players"
              position="right" // 레이블이 막대 오른쪽에 표시되도록 설정
              fill="#000" // 검정색 레이블
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CategoryChart;
