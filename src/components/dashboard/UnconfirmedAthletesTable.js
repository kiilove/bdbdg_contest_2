// components/UnconfirmedAthletesTable.js
import React from "react";
import { Table, Card } from "antd";

const UnconfirmedAthletesTable = ({ data }) => (
  <Card title="확정되지 않은 선수 목록" className="mb-4">
    <Table
      dataSource={data}
      columns={[
        { title: "선수 이름", dataIndex: "name", key: "name" },
        { title: "카테고리", dataIndex: "category", key: "category" },
        { title: "상태", dataIndex: "status", key: "status" },
      ]}
      pagination={false}
      rowClassName="text-center"
    />
  </Card>
);

export default UnconfirmedAthletesTable;
