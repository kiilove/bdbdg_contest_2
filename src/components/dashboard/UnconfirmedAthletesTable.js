"use client";
import React, { useState } from "react";
import { Table, Checkbox, Input, Empty } from "antd";
import { Phone, Search } from "lucide-react";

const UnconfirmedAthletesTable = ({ data = [], onPriceCheckUpdate }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = data.filter((item) => {
    const name = item.playerName || "";
    const tel = item.playerTel || "";
    const gym = item.playerGym || "";
    const joins = (item.joins || [])
      .map((j) => `${j.contestCategoryTitle} ${j.contestGradeTitle}`)
      .join(" ");
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
      width: 96,
      align: "center",
      render: (_, record) => (
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
      title: "선수 성명 · 소속",
      key: "playerInfo",
      width: 196,
      render: (_, record) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span
              className={`text-[14px] leading-5 font-medium ${
                record.isCanceled
                  ? "line-through text-[#737373]"
                  : "text-[#171717]"
              }`}
            >
              {record.playerName}
            </span>
            {record.isCanceled && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#dc2626]/[0.08] text-[#dc2626] text-[11px] leading-4 font-medium">
                취소
              </span>
            )}
          </div>
          <div className="text-xs leading-4 text-[#737373]">
            {record.playerGym || "무소속 · 개인"}
          </div>
        </div>
      ),
    },
    {
      title: "연락처",
      dataIndex: "playerTel",
      key: "playerTel",
      width: 156,
      render: (tel) =>
        tel ? (
          <a
            href={`tel:${tel}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] font-mono text-xs leading-4 tabular-nums border border-[#171717]/[0.08] no-underline transition-colors duration-150"
          >
            <Phone size={13} strokeWidth={1.5} className="text-[#737373]" />
            <span>{tel}</span>
          </a>
        ) : (
          <span className="text-xs leading-4 text-[#737373]">연락처 없음</span>
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
              className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] text-[#171717] text-xs leading-4 font-medium border border-[#171717]/[0.08]"
            >
              {j.contestCategoryTitle}
              <span className="text-[#737373] font-normal ml-1">
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
      width: 148,
      render: (date) => (
        <span className="font-mono text-xs leading-4 text-[#737373] tabular-nums">
          {date ? date.substring(0, 16).replace("T", " ") : "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#171717]/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] leading-6 font-medium text-[#171717] m-0">
              미확정 선수 명단
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#b45309]/[0.08] text-[#b45309] font-mono text-xs leading-4 font-medium tabular-nums">
              {data.length}명 대기
            </span>
          </div>
          <p className="text-xs leading-4 text-[#737373] mt-1 mb-0">
            신청서를 접수했으나 출전 확정 승인이 완료되지 않은 선수 목록입니다
          </p>
        </div>

        <div className="w-full sm:w-72">
          <Input
            placeholder="선수명, 연락처, 소속, 종목 검색"
            prefix={
              <Search size={15} strokeWidth={1.5} className="text-[#737373]" />
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[8px] border border-[#171717]/[0.08]">
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
                description="모든 신청 선수의 등록 확정 처리가 완료되었습니다"
              />
            ),
          }}
        />
      </div>
    </div>
  );
};

export default UnconfirmedAthletesTable;
