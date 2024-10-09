// components/CategoryDistributionChart.js
import React, { useEffect, useRef, useState } from "react";
import { Card, Select, Button } from "antd";
import * as echarts from "echarts";
import "echarts-gl";
import { useDevice } from "../../contexts/DeviceContext";

const { Option } = Select;

const CategoryDistributionChart = ({ data }) => {
  const { isMobile } = useDevice();
  const chartRef = useRef(null);
  const [chartType, setChartType] = useState("pie");
  const [selectedGrades, setSelectedGrades] = useState(null); // 하위 체급 데이터 상태
  const [totalRegistrations, setTotalRegistrations] = useState(0); // 총 접수 인원 상태

  useEffect(() => {
    if (chartRef.current && data && data.length > 0) {
      const chartInstance = echarts.init(chartRef.current);

      const transformedData = selectedGrades || data;
      const filteredData = transformedData.filter(
        (item) => item.playerCount > 0
      );
      const totalPlayers = filteredData.reduce(
        (sum, item) => sum + item.playerCount,
        0
      );
      setTotalRegistrations(totalPlayers); // 총 접수 인원 업데이트

      const pieOptions = {
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b}: {c} ({d}%)",
        },
        series: [
          {
            name: selectedGrades ? "체급별 분포" : "카테고리별 참가 신청 분포",
            type: "pie",
            radius: isMobile ? ["25%", "65%"] : ["25%", "60%"],
            center: ["50%", "50%"],
            roseType: "area",
            itemStyle: {
              borderRadius: 8,
              borderColor: "#fff",
              borderWidth: 2,
            },
            label: {
              fontSize: 12,
              fontWeight: "bold",
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0, 0, 0, 0.5)",
              },
            },
            data: filteredData.map((item, index) => ({
              value: item.playerCount,
              name: selectedGrades
                ? item.contestGradeTitle
                : item.contestCategoryTitle,
              itemStyle: {
                color: echarts.color.lerp(index / filteredData.length, [
                  "#FF6347",
                  "#87CEEB",
                  "#32CD32",
                  "#FF69B4",
                  "#8A2BE2",
                  "#FFA500",
                  "#FF4500",
                  "#DA70D6",
                  "#7FFF00",
                  "#7B68EE",
                  "#4682B4",
                  "#ADFF2F",
                  "#CD5C5C",
                  "#4B0082",
                  "#FF1493",
                  "#FFD700",
                  "#00FA9A",
                  "#20B2AA",
                  "#9370DB",
                  "#FF7F50",
                  "#3CB371",
                  "#BA55D3",
                  "#FF8C00",
                  "#6495ED",
                  "#FFB6C1",
                ]),
              },
            })),
          },
        ],
      };

      const barOptions = {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (params) => {
            const { value } = params[0].data;
            const percentage = ((value / totalPlayers) * 100).toFixed(2);
            return `${params[0].name}: ${value} (${percentage}%)`;
          },
        },
        xAxis: {
          type: "category",
          data: filteredData.map((item) =>
            selectedGrades ? item.contestGradeTitle : item.contestCategoryTitle
          ),
        },
        yAxis: {
          type: "value",
        },
        series: [
          {
            data: filteredData.map((item) => ({
              value: item.playerCount,
              name: selectedGrades
                ? item.contestGradeTitle
                : item.contestCategoryTitle,
            })),
            type: "bar",
            itemStyle: {
              color: (params) =>
                echarts.color.lerp(params.dataIndex / filteredData.length, [
                  "#FF6347",
                  "#87CEEB",
                  "#32CD32",
                  "#FF69B4",
                  "#8A2BE2",
                  "#FFA500",
                  "#FF4500",
                  "#DA70D6",
                  "#7FFF00",
                  "#7B68EE",
                  "#4682B4",
                  "#ADFF2F",
                  "#CD5C5C",
                  "#4B0082",
                  "#FF1493",
                  "#FFD700",
                  "#00FA9A",
                  "#20B2AA",
                  "#9370DB",
                  "#FF7F50",
                  "#3CB371",
                  "#BA55D3",
                  "#FF8C00",
                  "#6495ED",
                  "#FFB6C1",
                ]),
              borderColor: "#fff",
              borderWidth: 2,
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0, 0, 0, 0.5)",
              },
            },
          },
        ],
      };

      const chartOptions = chartType === "pie" ? pieOptions : barOptions;
      chartInstance.setOption(chartOptions);

      chartInstance.on("click", handleCategoryClick);

      return () => {
        chartInstance.off("click", handleCategoryClick);
        chartInstance.dispose();
      };
    }
  }, [data, isMobile, chartType, selectedGrades]);

  const handleCategoryClick = (params) => {
    const category = data.find(
      (cat) => cat.contestCategoryTitle === params.name
    );
    if (category) {
      setSelectedGrades(category.grades);
    }
  };

  return (
    <Card
      title={
        <div>
          {selectedGrades ? (
            <Button
              onClick={() => setSelectedGrades(null)}
              style={{ marginRight: "16px" }}
            >
              되돌아가기
            </Button>
          ) : null}
          <span>
            {selectedGrades ? "체급별 분포" : "종목별 참가 신청 분포"}
          </span>
          {!selectedGrades && (
            <Select
              value={chartType}
              style={{ width: 120, marginLeft: "16px" }}
              onChange={(value) => setChartType(value)}
            >
              <Option value="pie">파이차트</Option>
              <Option value="bar">막대그래프</Option>
            </Select>
          )}
        </div>
      }
      className="mb-4"
    >
      <>
        <div className="flex w-full h-auto items-center justify-center">
          <span style={{ fontSize: 14, fontWeight: "bold" }}>
            {" 총 접수 인원: " + totalRegistrations + "명(중복포함)"}
          </span>
        </div>
        <div
          ref={chartRef}
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: isMobile ? "350px" : "450px",
          }}
        />
      </>
    </Card>
  );
};

export default CategoryDistributionChart;
