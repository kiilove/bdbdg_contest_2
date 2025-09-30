"use client";
import { useState, useEffect } from "react";
import { Table, Card, Checkbox, Tag, Space, Typography } from "antd";
import {
  PhoneOutlined,
  UserOutlined,
  MoneyCollectOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

const UnconfirmedAthletesTable = ({ data, onPriceCheckUpdate }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const columns = [
    {
      title: "입금",
      dataIndex: "isPriceCheck",
      key: "isPriceCheck",
      width: 80,
      fixed: "left",
      render: (val, record) => (
        <Checkbox
          checked={record.isPriceCheck}
          onChange={(e) =>
            onPriceCheckUpdate(record.id, record.playerUid, e.target.checked)
          }
          disabled={record.isCanceled}
        />
      ),
    },
    {
      title: "선수 정보",
      key: "playerInfo",
      render: (text, record) => (
        <Space direction="vertical" size="small">
          <div className="flex items-center gap-2">
            <UserOutlined className="text-blue-500" />
            <Text
              strong
              className={
                record.isCanceled
                  ? "line-through text-gray-500"
                  : "text-gray-800"
              }
            >
              {record.playerName}
            </Text>
          </div>
          {record.playerTel && (
            <div className="flex items-center gap-2">
              <PhoneOutlined className="text-green-500" />
              <a
                href={`tel:${record.playerTel}`}
                className="text-blue-600 hover:text-blue-800 transition-colors"
              >
                {record.playerTel}
              </a>
            </div>
          )}
        </Space>
      ),
    },
    {
      title: "출전 종목",
      dataIndex: "joins",
      key: "joins",
      render: (joins) => (
        <Space direction="vertical" size="small">
          {joins?.map((j, i) => (
            <Tag key={i} color="blue" className="mb-1">
              {j.contestCategoryTitle} ({j.contestGradeTitle})
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "참가비",
      dataIndex: "contestPriceSum",
      key: "contestPriceSum",
      width: 120,
      render: (price) => (
        <div className="flex items-center gap-2">
          <Text strong className="text-orange-600">
            {price ? `₩${price.toLocaleString()}` : "-"}
          </Text>
        </div>
      ),
    },
  ];

  const renderMobileCards = () => {
    return (
      <Space direction="vertical" size="middle" className="w-full">
        {data?.map((record) => (
          <Card
            key={record.id}
            className={`shadow-sm border border-gray-200 rounded-lg ${
              record.isCanceled ? "opacity-60 bg-gray-50" : ""
            }`}
            bodyStyle={{ padding: "16px" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={record.isPriceCheck}
                  onChange={(e) =>
                    onPriceCheckUpdate(
                      record.id,
                      record.playerUid,
                      e.target.checked
                    )
                  }
                  disabled={record.isCanceled}
                />
                <Text className="text-sm text-gray-600">입금 확인</Text>
              </div>
              {record.isCanceled && (
                <Tag color="red" className="m-0">
                  취소
                </Tag>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserOutlined className="text-blue-500" />
                <Text
                  strong
                  className={
                    record.isCanceled
                      ? "line-through text-gray-500"
                      : "text-gray-800 text-base"
                  }
                >
                  {record.playerName}
                </Text>
              </div>

              {record.playerTel && (
                <div className="flex items-center gap-2">
                  <PhoneOutlined className="text-green-500" />
                  <a
                    href={`tel:${record.playerTel}`}
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {record.playerTel}
                  </a>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100">
                <Text className="text-sm text-gray-600 block mb-2">
                  출전 종목
                </Text>
                <Space direction="vertical" size="small" className="w-full">
                  {record.joins?.map((j, i) => (
                    <Tag key={i} color="blue" className="mb-1">
                      {j.contestCategoryTitle} ({j.contestGradeTitle})
                    </Tag>
                  ))}
                </Space>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <Text className="text-sm text-gray-600">참가비</Text>
                <div className="flex items-center gap-2">
                  <Text strong className="text-orange-600 text-base">
                    {record.contestPriceSum
                      ? `₩${record.contestPriceSum.toLocaleString()}`
                      : "-"}
                  </Text>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </Space>
    );
  };

  return (
    <div className="w-full">
      <Card
        title={
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
            <Text className="text-lg font-semibold text-gray-800">
              확정되지 않은 선수 목록
            </Text>
            <Tag color="orange" className="ml-2">
              입금 대기
            </Tag>
          </div>
        }
        className="mb-4 shadow-sm border border-gray-200 rounded-lg overflow-hidden"
        bodyStyle={{ padding: isMobile ? "16px" : "24px" }}
        headStyle={{
          background: "#fafafa",
          color: "#374151",
          border: "none",
          padding: isMobile ? "12px 16px" : "16px 24px",
        }}
      >
        {isMobile ? (
          renderMobileCards()
        ) : (
          <div className="overflow-x-auto">
            <Table
              rowKey="id"
              dataSource={data}
              columns={columns}
              pagination={false}
              scroll={{ x: 800 }}
              className="custom-table"
              rowClassName={(record) =>
                record.isCanceled
                  ? "bg-gray-50 opacity-60"
                  : "hover:bg-blue-50 transition-colors duration-200"
              }
            />
          </div>
        )}
      </Card>

      <style jsx>{`
        .custom-table .ant-table-thead > tr > th {
          background: #fafafa;
          border-bottom: 1px solid #e5e7eb;
          font-weight: 500;
          color: #6b7280;
          padding: 12px 16px;
          font-size: 14px;
        }

        .custom-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f3f4f6;
          padding: 16px;
        }

        .custom-table .ant-table-tbody > tr:last-child > td {
          border-bottom: none;
        }

        .custom-table .ant-table {
          border-radius: 8px;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default UnconfirmedAthletesTable;
