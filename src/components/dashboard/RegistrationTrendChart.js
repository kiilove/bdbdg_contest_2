// components/dashboard/RegistrationTrendChart.js
import React, { useEffect, useRef, useState } from "react";
import { Card, Button, DatePicker, Space } from "antd";
import * as echarts from "echarts";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";

dayjs.extend(isBetween);

const { RangePicker } = DatePicker;

const RegistrationTrendChart = ({ invoices }) => {
  const chartRef = useRef(null);
  const [filteredData, setFilteredData] = useState({ dates: [], counts: [] });
  const [dateRange, setDateRange] = useState("all");
  const [customRange, setCustomRange] = useState(null);

  /** 🧮 데이터 가공 */
  useEffect(() => {
    const groupedByDate = invoices.reduce((acc, invoice) => {
      const dateStr = invoice.invoiceCreateAt?.split(" ")[0];
      const joinsCount = Array.isArray(invoice.joins)
        ? invoice.joins.length
        : 0;
      if (dateStr) acc[dateStr] = (acc[dateStr] || 0) + joinsCount;
      return acc;
    }, {});

    const dates = Object.keys(groupedByDate).sort();
    if (dates.length === 0) {
      setFilteredData({ dates: [], counts: [] });
      return;
    }

    let startDate;
    let endDate = dayjs().startOf("day");

    if (dateRange === "7d") startDate = endDate.subtract(6, "day");
    else if (dateRange === "30d") startDate = endDate.subtract(29, "day");
    else if (dateRange === "custom" && customRange) {
      startDate = customRange[0].startOf("day");
      endDate = customRange[1].startOf("day");
    } else startDate = dayjs(dates[0]);

    const filteredDates = dates.filter((d) => {
      const current = dayjs(d, "YYYY-MM-DD");
      return current.isBetween(startDate, endDate, "day", "[]"); // 포함 범위
    });

    const filteredCounts = filteredDates.map((d) => groupedByDate[d]);
    setFilteredData({ dates: filteredDates, counts: filteredCounts });
  }, [invoices, dateRange, customRange]);

  /** 📈 차트 렌더링 */
  useEffect(() => {
    if (chartRef.current) {
      const chartInstance = echarts.init(chartRef.current);

      const options = {
        tooltip: { trigger: "axis" },
        xAxis: {
          type: "category",
          data: filteredData.dates,
          axisLabel: { rotate: 45, formatter: (v) => v.replace(/-/g, "/") },
          axisLine: { lineStyle: { color: "#aaa" } },
        },
        yAxis: {
          type: "value",
          name: "접수 종목 수",
          axisLine: { show: false },
          splitLine: { lineStyle: { color: "#eee" } },
        },
        dataZoom: [
          {
            type: "slider",
            show: true,
            height: 20,
            bottom: 10,
            backgroundColor: "rgba(200,200,200,0.15)",
            fillerColor: "rgba(64,158,255,0.35)",
            borderColor: "transparent",
            handleIcon:
              "M8.7,11.9v-1.8H7.3v1.8H8.7z M15.7,11.9v-1.8h-1.3v1.8H15.7z",
            handleSize: "120%",
            handleStyle: {
              color: "#409EFF",
              borderColor: "#409EFF",
              shadowBlur: 3,
              shadowColor: "rgba(0,0,0,0.2)",
              shadowOffsetX: 2,
              shadowOffsetY: 2,
            },
            textStyle: { color: "#666", fontSize: 11 },
          },
          { type: "inside", start: 0, end: 100 },
        ],
        series: [
          {
            data: filteredData.counts,
            type: "line",
            smooth: true,
            itemStyle: { color: "#FF6347" },
            lineStyle: { width: 3 },
            areaStyle: { color: "rgba(255, 99, 71, 0.15)" },
          },
        ],
      };

      chartInstance.setOption(options);
      return () => chartInstance.dispose();
    }
  }, [filteredData]);

  /** 🔘 빠른 기간 버튼 */
  const handleQuickRange = (value) => {
    setDateRange(value);
    if (value !== "custom") setCustomRange(null);
  };

  return (
    <Card
      title="일자별 접수 현황 (중복포함)"
      style={{ marginBottom: 16 }}
      extra={
        <Space>
          <Button
            type={dateRange === "all" ? "primary" : "default"}
            onClick={() => handleQuickRange("all")}
          >
            전체
          </Button>
          <Button
            type={dateRange === "7d" ? "primary" : "default"}
            onClick={() => handleQuickRange("7d")}
          >
            최근 7일
          </Button>
          <Button
            type={dateRange === "30d" ? "primary" : "default"}
            onClick={() => handleQuickRange("30d")}
          >
            최근 30일
          </Button>
          <RangePicker
            format="YYYY-MM-DD"
            onChange={(dates) => {
              setCustomRange(dates);
              if (dates) setDateRange("custom");
            }}
          />
        </Space>
      }
    >
      <div ref={chartRef} style={{ width: "100%", height: "400px" }} />
    </Card>
  );
};

export default RegistrationTrendChart;
