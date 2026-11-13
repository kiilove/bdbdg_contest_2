import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Table, Input, Empty } from "antd";
import { Search, Settings2, Printer } from "lucide-react";
import { BibTag } from "../ui/BibTag";

const JudgesOverviewPanel = ({ judges = [] }) => {
  const [searchText, setSearchText] = useState("");

  const filteredJudges = judges.filter((judge) => {
    const name = judge.judgeName || judge.name || "";
    const gym = judge.judgeGym || judge.gym || "";
    const title = judge.judgeTitle || judge.title || "";
    const query = searchText.toLowerCase();
    return (
      name.toLowerCase().includes(query) ||
      gym.toLowerCase().includes(query) ||
      title.toLowerCase().includes(query)
    );
  });

  const columns = [
    {
      title: "순번",
      key: "index",
      width: 72,
      align: "center",
      render: (_, record, index) => (
        <BibTag size="sm" number={record.seatIndex || index + 1} />
      ),
    },
    {
      title: "심판 성명",
      dataIndex: "judgeName",
      key: "judgeName",
      width: 160,
      render: (name, record) => (
        <span className="text-[14px] leading-5 font-medium text-[#171717]">
          {name || record.name || "성명 미입력"}
        </span>
      ),
    },
    {
      title: "직책 · 구분",
      dataIndex: "judgeTitle",
      key: "judgeTitle",
      width: 140,
      render: (title, record) => {
        const displayTitle = title || record.position || "심사위원";
        const isHead =
          displayTitle.includes("위원장") || Boolean(record.isHead);
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-xs leading-4 font-medium border ${
              isHead
                ? "bg-[#2563eb]/[0.08] text-[#2563eb] border-[#2563eb]/20"
                : "bg-[#f4f4f5] text-[#525252] border-[#171717]/[0.08]"
            }`}
          >
            {displayTitle}
          </span>
        );
      },
    },
    {
      title: "소속 · 직함",
      dataIndex: "judgeGym",
      key: "judgeGym",
      render: (gym, record) => (
        <span className="text-[13px] leading-5 text-[#525252]">
          {gym || record.gym || record.judgeAffiliation || "-"}
        </span>
      ),
    },
    {
      title: "자격 · 비고",
      dataIndex: "judgeGrade",
      key: "judgeGrade",
      width: 132,
      render: (grade, record) => (
        <span className="text-xs leading-4 text-[#737373]">
          {grade || record.judgeNote || "공인 심판"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#171717]/[0.08]">
        <div>
          <h3 className="text-[16px] leading-6 font-medium text-[#171717] m-0">
            위촉 심판진 명단 및 심사 운영
          </h3>
          <p className="text-xs leading-4 text-[#737373] mt-1 mb-0">
            대회에 위촉된 공인 심사위원 명단과 좌석 배정 관리입니다
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/contestjudgetable"
            className="h-[34px] px-3 rounded-[8px] bg-[#171717] hover:bg-[#262626] active:scale-[0.98] text-white font-medium text-xs leading-4 no-underline transition-[background-color,transform] duration-150 inline-flex items-center gap-1.5"
          >
            <Settings2 size={15} strokeWidth={1.5} className="text-white/80" />
            <span>심판 배정 및 비밀번호 관리</span>
          </Link>
          <Link
            to="/judgeassignmentPrint"
            className="h-[34px] px-3 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] active:scale-[0.98] border border-[#171717]/[0.08] text-[#171717] font-medium text-xs leading-4 no-underline transition-[background-color,transform] duration-150 inline-flex items-center gap-1.5"
          >
            <Printer size={15} strokeWidth={1.5} className="text-[#737373]" />
            <span>배정표 인쇄</span>
          </Link>
        </div>
      </div>

      {/* Scoring Rule Summary Strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2.5 bg-[#f4f4f5] rounded-[8px] border border-[#171717]/[0.06] text-xs leading-4 text-[#525252] tabular-nums">
        <span className="font-medium text-[#171717]">심사 집계 기준</span>
        <span>5심제: 5명 전원 합산</span>
        <span className="text-[#737373]" aria-hidden="true">
          ·
        </span>
        <span>7심제: 최고 1개, 최저 1개 제외 후 5명 합산</span>
        <span className="text-[#737373]" aria-hidden="true">
          ·
        </span>
        <span>9심제: 최고 2개, 최저 2개 제외 후 5명 합산</span>
      </div>

      {/* Search & Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs leading-4 text-[#525252] tabular-nums">
          총 위촉 심판{" "}
          <span className="font-mono font-medium text-[#171717]">
            {judges.length}명
          </span>
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="성명 또는 소속 검색"
            prefix={
              <Search size={15} strokeWidth={1.5} className="text-[#737373]" />
            }
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        </div>
      </div>

      {/* Judges Table */}
      <div className="overflow-x-auto rounded-[8px] border border-[#171717]/[0.08]">
        <Table
          dataSource={filteredJudges}
          columns={columns}
          rowKey={(record, idx) => record.id || record.judgeUid || idx}
          pagination={false}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="등록된 심판 정보가 없습니다"
              />
            ),
          }}
        />
      </div>
    </div>
  );
};

export default JudgesOverviewPanel;
