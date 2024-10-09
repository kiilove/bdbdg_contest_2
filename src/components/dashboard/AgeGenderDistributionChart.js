// components/AgeGenderDistributionChart.js
import React, { useEffect, useRef, useState } from "react";
import { Card, Select } from "antd";
import * as echarts from "echarts";

const { Option } = Select;

const AgeGenderDistributionChart = ({ invoices }) => {
  const chartRef = useRef(null);
  const [chartType, setChartType] = useState("bar");
  useEffect(() => {
    // 데이터 구조 초기화
    const ageCounts = { 남성: {}, 여성: {} };
    const scatterData = { 남성: [], 여성: [] };
    const groupedData = { 남성: {}, 여성: {} };

    invoices.forEach((invoice) => {
      const { playerBirth, playerGender } = invoice;

      if (
        playerBirth &&
        typeof playerBirth === "string" &&
        playerGender &&
        typeof playerGender === "string"
      ) {
        const birthDate = new Date(playerBirth);
        if (!isNaN(birthDate)) {
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (
            monthDiff < 0 ||
            (monthDiff === 0 && today.getDate() < birthDate.getDate())
          ) {
            age--;
          }

          const gender = playerGender.toLowerCase() === "m" ? "남성" : "여성";

          if (chartType === "scatter") {
            // 산점도용 데이터: x = 나이, y = 인원수, size = 인원수
            if (!ageCounts[gender][age]) {
              ageCounts[gender][age] = 0;
            }
            ageCounts[gender][age] += 1;
          } else {
            // 막대 및 선 그래프용 데이터: 10년 단위로 그룹화
            const ageGroup = Math.floor(age / 10) * 10;
            if (!groupedData[gender][ageGroup]) {
              groupedData[gender][ageGroup] = 0;
            }
            groupedData[gender][ageGroup] += 1;
          }
        }
      }
    });

    // 산점도 데이터 생성
    if (chartType === "scatter") {
      Object.keys(ageCounts["남성"]).forEach((age) => {
        scatterData["남성"].push({
          value: [parseInt(age, 10), ageCounts["남성"][age]],
          symbolSize: ageCounts["남성"][age] * 5, // 인원수에 비례하여 크기 설정
        });
      });
      Object.keys(ageCounts["여성"]).forEach((age) => {
        scatterData["여성"].push({
          value: [parseInt(age, 10), ageCounts["여성"][age]],
          symbolSize: ageCounts["여성"][age] * 5, // 인원수에 비례하여 크기 설정
        });
      });
    }

    // 10년 단위 그룹화된 데이터를 배열로 변환
    const ageGroups = [
      ...new Set([
        ...Object.keys(groupedData["남성"]),
        ...Object.keys(groupedData["여성"]),
      ]),
    ]
      .map((key) => parseInt(key, 10))
      .sort((a, b) => a - b);

    const maleGroupedData = ageGroups.map(
      (key) => groupedData["남성"][key] || 0
    );
    const femaleGroupedData = ageGroups.map(
      (key) => groupedData["여성"][key] || 0
    );

    // 시리즈 데이터 생성
    const seriesData =
      chartType === "scatter"
        ? [
            {
              name: "남성",
              type: "scatter",
              data: scatterData["남성"],
              itemStyle: { color: "#1f77b4" }, // 남성 색상
            },
            {
              name: "여성",
              type: "scatter",
              data: scatterData["여성"],
              itemStyle: { color: "#ff69b4" }, // 여성 색상 (핑크)
            },
          ]
        : [
            {
              name: "남성",
              type: chartType,
              stack: "total",
              data: maleGroupedData,
              itemStyle: { color: "#1f77b4" }, // 남성 색상
              smooth: chartType === "line",
            },
            {
              name: "여성",
              type: chartType,
              stack: "total",
              data: femaleGroupedData,
              itemStyle: { color: "#ff69b4" }, // 여성 색상 (핑크)
              smooth: chartType === "line",
            },
          ];

    // 차트 옵션 설정
    if (chartRef.current) {
      const chartInstance = echarts.init(chartRef.current);

      const options = {
        title: {
          text: "연령별 성별 인원수 분포도",
          left: "center",
        },
        tooltip: {
          trigger: chartType === "scatter" ? "item" : "axis",
          formatter: (params) =>
            chartType === "scatter"
              ? `나이: ${params.value[0]}<br/>인원수: ${params.value[1]}`
              : `나이대: ${ageGroups[params.dataIndex]}대<br/>인원수: ${
                  params.value
                }`,
        },
        legend: {
          top: "bottom",
        },
        xAxis: {
          type: chartType === "scatter" ? "value" : "category",
          name: chartType === "scatter" ? "나이" : "나이대",
          data:
            chartType === "scatter"
              ? undefined
              : ageGroups.map((ageGroup) => `${ageGroup}대`),
          boundaryGap: chartType !== "scatter", // 산점도는 경계 간격 없음
        },
        yAxis: {
          type: "value",
          name: "인원수",
          show: chartType !== "scatter",
        },
        series: seriesData,
      };

      chartInstance.setOption(options);

      // 리사이즈 이벤트 처리
      const handleResize = () => {
        chartInstance.resize();
      };
      window.addEventListener("resize", handleResize);

      return () => {
        chartInstance.dispose();
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [invoices, chartType]);

  const handleChartTypeChange = (value) => {
    setChartType(value);
  };

  const cardTitle = (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>연령별 성별 인원수 분포도</span>
      <Select
        value={chartType}
        onChange={handleChartTypeChange}
        style={{ width: 150 }}
      >
        <Option value="scatter">산점도</Option>
        <Option value="bar">막대 그래프</Option>
        <Option value="line">선 그래프</Option>
      </Select>
    </div>
  );

  return (
    <Card title={cardTitle} style={{ marginBottom: 16 }}>
      <div ref={chartRef} style={{ width: "100%", height: "400px" }} />
    </Card>
  );
};

export default AgeGenderDistributionChart;
