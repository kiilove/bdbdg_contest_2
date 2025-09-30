"use client";

import React from "react";
import { Card, Button, Table, Tag } from "antd";
import { CheckCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";

const JudgesStatus = ({ judgesMap, pending, onConfirm }) => {
  const judges = Object.values(judgesMap || {});

  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const columns = [
    {
      title: "심판번호",
      dataIndex: "seatIndex",
      key: "seatIndex",
      align: "center",
      width: 100,
    },
    {
      title: "투표상황",
      dataIndex: "messageStatus",
      key: "messageStatus",
      align: "center",
      render: (status) => (
        <Tag
          color={status === "투표완료" ? "success" : "warning"}
          icon={
            status === "투표완료" ? (
              <CheckCircleOutlined />
            ) : (
              <ClockCircleOutlined />
            )
          }
        >
          {status}
        </Tag>
      ),
    },
  ];

  return (
    <Card
      title="심판 투표 현황"
      className="mb-4"
      extra={
        <Button
          type="primary"
          size="large"
          disabled={pending}
          onClick={onConfirm}
          className="w-full md:w-auto"
        >
          {pending ? "투표중" : "선수명단 확정"}
        </Button>
      }
    >
      {isMobile ? (
        <div className="flex flex-col gap-2">
          {judges.map((j) => (
            <Card key={j.seatIndex} size="small">
              <div className="flex justify-between items-center">
                <span className="font-semibold">심판 {j.seatIndex}</span>
                <Tag
                  color={j.messageStatus === "투표완료" ? "success" : "warning"}
                  icon={
                    j.messageStatus === "투표완료" ? (
                      <CheckCircleOutlined />
                    ) : (
                      <ClockCircleOutlined />
                    )
                  }
                >
                  {j.messageStatus}
                </Tag>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={judges}
          pagination={false}
          bordered
          size="small"
          rowKey="seatIndex"
        />
      )}
    </Card>
  );
};

export default JudgesStatus;
