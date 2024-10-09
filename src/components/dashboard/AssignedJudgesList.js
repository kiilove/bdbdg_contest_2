// components/AssignedJudgesList.js
import React from "react";
import { Table, Card } from "antd";

const AssignedJudgesList = ({ judges }) => (
  <Card title="배정된 심판 목록" className="mb-4">
    <Table
      dataSource={judges}
      columns={[
        { title: "심판 이름", dataIndex: "name", key: "name" },
        { title: "포지션", dataIndex: "position", key: "position" },
      ]}
      pagination={false}
      rowClassName="text-center"
    />
  </Card>
);

export default AssignedJudgesList;
