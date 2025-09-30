"use client";

import React from "react";
import { Card, Tag, Table, Progress } from "antd";
import { TrophyOutlined } from "@ant-design/icons";

const VoteSummary = ({
  matchedOriginalPlayers,
  votedResult,
  compareArray,
  currentTopN,
  topResult,
}) => {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const maxVotes = Math.max(
    ...matchedOriginalPlayers.map((p) => {
      const vc =
        votedResult.find((f) => f.playerNumber === p.playerNumber)
          ?.votedCount || 0;
      return vc;
    }),
    1
  );

  const columns = [
    {
      title: "구분",
      dataIndex: "label",
      key: "label",
      width: 100,
      className: "font-semibold",
    },
    ...matchedOriginalPlayers.map((p) => ({
      title: (
        <Tag color="gold" className="text-base px-3 py-1">
          {p.playerNumber}
        </Tag>
      ),
      dataIndex: `player_${p.playerNumber}`,
      key: `player_${p.playerNumber}`,
      align: "center",
      render: (value) => (
        <div className="flex flex-col items-center gap-1">
          <span className="font-semibold text-lg">{value}</span>
          <Progress
            percent={(value / maxVotes) * 100}
            showInfo={false}
            strokeColor="#1890ff"
            size="small"
            className="w-full"
          />
        </div>
      ),
    })),
  ];

  const dataSource = [
    {
      key: "votes",
      label: "득표수",
      ...matchedOriginalPlayers.reduce((acc, p) => {
        const vc =
          votedResult.find((f) => f.playerNumber === p.playerNumber)
            ?.votedCount || 0;
        acc[`player_${p.playerNumber}`] = vc;
        return acc;
      }, {}),
    },
  ];

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
            <TrophyOutlined className="text-white text-lg" />
          </div>
          <span>비교심사 득표 및 투표현황</span>
        </div>
      }
      className="mb-4"
    >
      {isMobile ? (
        <div className="flex flex-col gap-3">
          {matchedOriginalPlayers.map((p) => {
            const vc =
              votedResult.find((f) => f.playerNumber === p.playerNumber)
                ?.votedCount || 0;
            return (
              <Card key={p.playerNumber} size="small" className="shadow-sm">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <Tag color="gold" className="text-lg px-3 py-1">
                      {p.playerNumber}
                    </Tag>
                    <span className="font-semibold text-lg">득표수: {vc}</span>
                  </div>
                  <Progress
                    percent={(vc / maxVotes) * 100}
                    showInfo={false}
                    strokeColor="#1890ff"
                    size="small"
                  />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          bordered
          size="middle"
        />
      )}

      {compareArray?.length > 0 && (
        <Card
          size="small"
          className="mt-4 bg-blue-50"
          title={
            <span className="text-blue-600 font-semibold">
              {compareArray.length}차 TOP{" "}
              {compareArray[compareArray.length - 1]?.comparePlayerLength}
            </span>
          }
        >
          <div className="flex flex-wrap gap-3">
            {compareArray[compareArray.length - 1]?.players?.map((top) => (
              <Tag
                key={`${top.playerNumber}-${top.playerUid || ""}`}
                color="blue"
                className="text-xl px-4 py-2 font-semibold"
              >
                {top.playerNumber}
              </Tag>
            ))}
          </div>
        </Card>
      )}

      <Card
        size="small"
        className="mt-4 bg-green-50"
        title={
          <span className="text-green-600 font-semibold">
            현재 TOP {currentTopN}
          </span>
        }
      >
        <div className="flex flex-wrap gap-3">
          {topResult?.map((top) => (
            <Tag
              key={`${top.playerNumber}-${top.playerUid || ""}`}
              color="green"
              className="text-xl px-4 py-2 font-semibold"
            >
              {top.playerNumber}
            </Tag>
          ))}
        </div>
      </Card>
    </Card>
  );
};

export default VoteSummary;
