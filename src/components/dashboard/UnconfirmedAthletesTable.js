"use client";
import React, { useState } from "react";
import { Table, Checkbox, Tag, Input, Empty } from "antd";
import {
  PhoneOutlined,
  UserOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";

const UnconfirmedAthletesTable = ({ data = [], onPriceCheckUpdate }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = data.filter((item) => {
    const name = item.playerName || "";
    const tel = item.playerTel || "";
    const gym = item.playerGym || "";
    const joins = (item.joins || []).map((j) => `${j.contestCategoryTitle} ${j.contestGradeTitle}`).join(" ");
    const q = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(q) ||
      tel.includes(q) ||
      gym.toLowerCase().includes(q) ||
      joins.toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      title: "등록 승인",
      dataIndex: "isPriceCheck",
      key: "isPriceCheck",
      width: 100,
      align: "center",
      render: (val, record) => (
        <div className="flex flex-col items-center justify-center">
          <Checkbox
            checked={record.isPriceCheck}
            onChange={(e) =>
              onPriceCheckUpdate(record.id, record.playerUid, e.target.checked)
            }
            disabled={record.isCanceled}
            className="scale-125"
          />
          <span className="text-[10px] text-slate-400 mt-1">클릭 승인</span>
        </div>
      ),
    },
    {
      title: "선수 성명 / 소속",
      key: "playerInfo",
      width: 180,
      render: (_, record) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UserOutlined className="text-blue-500" />
            <span
              className={`font-black text-sm ${
                record.isCanceled
                  ? "line-through text-slate-400"
                  : "text-slate-900"
              }`}
            >
              {record.playerName}
            </span>
            {record.isCanceled && (
              <Tag color="red" className="text-[10px] px-1.5 py-0">
                취소
              </Tag>
            )}
          </div>
          <div className="text-xs text-slate-500 font-medium pl-5">
            소속: {record.playerGym || "무소속 / 개인"}
          </div>
        </div>
      ),
    },
    {
      title: "연락처",
      dataIndex: "playerTel",
      key: "playerTel",
      width: 150,
      render: (tel) => (
        tel ? (
          <a
            href={`tel:${tel}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 no-underline hover:bg-emerald-100 transition-colors"
          >
            <PhoneOutlined />
            <span>{tel}</span>
          </a>
        ) : (
          <span className="text-xs text-slate-400">연락처 없음</span>
        )
      ),
    },
    {
      title: "신청 종목 및 체급",
      dataIndex: "joins",
      key: "joins",
      render: (joins) => (
        <div className="flex flex-wrap gap-1.5">
          {joins?.map((j, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200"
            >
              {j.contestCategoryTitle}
              <span className="text-slate-500 font-normal ml-1">
                ({j.contestGradeTitle})
              </span>
            </span>
          ))}
        </div>
      ),
    },
    {
      title: "신청 일시",
      dataIndex: "invoiceCreateAt",
      key: "invoiceCreateAt",
      width: 140,
      render: (date) => (
        <span className="text-xs text-slate-500 font-medium">
          {date ? date.substring(0, 16).replace("T", " ") : "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <ExclamationCircleOutlined className="text-lg" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-800 m-0">
                미등록 (미확정) 선수 명단
              </h3>
              <Tag color="orange" className="font-extrabold text-xs rounded-full">
                {data.length}명 대기 중
              </Tag>
            </div>
            <p className="text-xs text-slate-500 m-0">
              참가 신청서를 접수하였으나 아직 출전 확정 승인이 완료되지 않은 선수들입니다.
            </p>
          </div>
        </div>

        {/* 검색 인풋 */}
        <div className="w-full sm:w-72">
          <Input
            placeholder="선수명, 연락처, 소속, 종목 검색..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            size="small"
            className="rounded-lg"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="모든 신청 선수의 등록 확정 처리가 완료되었습니다! 🎉"
              />
            ),
          }}
        />
      </div>
    </div>
  );
};

export default UnconfirmedAthletesTable;
