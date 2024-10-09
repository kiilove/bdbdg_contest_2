import React, { useEffect, useRef, useState } from "react";
import { Select, Card } from "antd";
import * as echarts from "echarts";

const { Option } = Select;

const RegistrationTrendChart = ({ invoices }) => {
  const chartRef = useRef(null);
  const [filteredData, setFilteredData] = useState([]);
  const [dateRange, setDateRange] = useState("all"); // 기본값을 전체 기간으로 설정

  useEffect(() => {
    // 접수일자 데이터를 yyyy-mm-dd 형식으로 그룹화하고 joins 수를 합산
    const groupedByDate = invoices.reduce((acc, invoice) => {
      const dateStr = invoice.invoiceCreateAt.split(" ")[0];
      const joinsCount = Array.isArray(invoice.joins)
        ? invoice.joins.length
        : 0; // joins 배열의 길이를 구함
      acc[dateStr] = (acc[dateStr] || 0) + joinsCount; // 날짜별 joins 수 합산
      return acc;
    }, {});

    const dates = Object.keys(groupedByDate).sort();
    const counts = dates.map((date) => groupedByDate[date]);

    // 오늘 날짜 설정
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0); // 시간 정보 제거
    let startDate;

    // 선택된 dateRange에 따른 시작일 설정
    if (dateRange === "7d") {
      startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000); // 7일 전
    } else if (dateRange === "30d") {
      startDate = new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000); // 30일 전
    } else {
      startDate = new Date(dates[0]); // 전체 기간
    }

    // 선택된 기간 내의 데이터만 필터링
    const filteredDates = dates.filter((date) => {
      // 날짜 문자열을 정확하게 파싱하기 위해 split 사용
      const [year, month, day] = date.split("-");
      const currentDate = new Date(year, month - 1, day);
      currentDate.setHours(0, 0, 0, 0); // 시간 정보 제거
      return currentDate >= startDate && currentDate <= endDate;
    });
    const filteredCounts = filteredDates.map((date) => groupedByDate[date]);

    setFilteredData({ dates: filteredDates, counts: filteredCounts });
  }, [invoices, dateRange]);

  useEffect(() => {
    if (chartRef.current && filteredData.dates) {
      const chartInstance = echarts.init(chartRef.current);

      const options = {
        // 차트의 제목은 Card의 title로 대체하므로 제거합니다.
        tooltip: {
          trigger: "axis",
        },
        xAxis: {
          type: "category",
          data: filteredData.dates,
          axisLabel: {
            rotate: 45,
            formatter: (value) => value.replace(/-/g, "/"),
          },
        },
        yAxis: {
          type: "value",
          name: "종목수",
        },
        dataZoom: [
          {
            type: "slider",
            start: 0,
            end: 100,
          },
          {
            type: "inside",
            start: 0,
            end: 100,
          },
        ],
        series: [
          {
            data: filteredData.counts,
            type: "line",
            smooth: true,
            itemStyle: {
              color: "#FF6347",
            },
            lineStyle: {
              width: 3,
            },
            areaStyle: {
              color: "rgba(255, 99, 71, 0.2)",
            },
          },
        ],
      };

      chartInstance.setOption(options);

      return () => {
        chartInstance.dispose();
      };
    }
  }, [filteredData]);

  const handleRangeChange = (value) => {
    setDateRange(value);
  };

  return (
    <Card title="일자별 접수현황(중복포함)" style={{ marginBottom: 16 }}>
      <Select
        value={dateRange}
        style={{ width: 120, marginBottom: 16 }}
        onChange={handleRangeChange}
      >
        <Option value="all">전체 기간</Option>
        <Option value="7d">최근 1주일</Option>
        <Option value="30d">최근 1개월</Option>
      </Select>
      <div ref={chartRef} style={{ width: "100%", height: "400px" }} />
    </Card>
  );
};

export default RegistrationTrendChart;
