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

const GradeStackBarChart = ({ data, title }) => {
  // 파스텔톤 컬러 배열 생성 (HSL 값을 이용)
  const pastelColors = Array.from(
    { length: 10 },
    (_, index) => `hsl(${index * 36}, 100%, 85%)`
  );

  // 각 등급의 출전 비율을 계산하는 함수
  const calculatePercentage = (gradeValue, total) => {
    return ((gradeValue / total) * 100).toFixed(1); // 소수점 1자리까지 계산
  };

  // 전체 출전 선수 수를 계산
  const totalPlayers = data.reduce(
    (acc, entry) =>
      acc +
      Object.keys(entry).reduce(
        (sum, key) => (key !== "category" ? sum + entry[key] : sum),
        0
      ),
    0
  );

  return (
    <div>
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={400}>
        {/* layout="vertical"을 추가하여 X축과 Y축을 변경 */}
        <BarChart
          layout="vertical" // X축과 Y축을 뒤집음
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          {/* Y축은 카테고리를 나타냄 */}
          <YAxis type="category" dataKey="category" />
          {/* X축은 출전 선수 수를 나타냄 */}
          <XAxis type="number" />
          <Tooltip />
          <Legend />
          {/* 등급별로 스택형 바 차트를 구현 */}
          {data.length > 0 &&
            Object.keys(data[0])
              .filter((key) => key !== "category")
              .map((grade, index) => (
                <Bar
                  key={grade}
                  dataKey={grade}
                  stackId="a"
                  fill={pastelColors[index % pastelColors.length]} // 파스텔톤 색상 적용
                >
                  {/* LabelList를 이용해 각 바 안에 grade 이름과 출전 숫자/비율을 표시 */}
                  <LabelList
                    dataKey={grade}
                    position="center"
                    formatter={(value) =>
                      `${grade}\n${value}명 (${calculatePercentage(
                        value,
                        totalPlayers
                      )}%)`
                    }
                    fill="#000" // 레이블을 검정색으로 지정
                  />
                </Bar>
              ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GradeStackBarChart;
