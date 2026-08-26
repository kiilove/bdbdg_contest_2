import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Table, Tag, Input, Empty } from "antd";
import {
  TeamOutlined,
  SearchOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
  CrownOutlined,
} from "@ant-design/icons";

const JudgesOverviewPanel = ({ judges = [], judgesAssign = {} }) => {
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
      width: 70,
      align: "center",
      render: (_, __, index) => (
        <span className="font-bold text-slate-500 text-xs">{index + 1}</span>
      ),
    },
    {
      title: "심판 성명",
      dataIndex: "judgeName",
      key: "judgeName",
      width: 140,
      render: (name, record) => {
        const isHead =
          record.judgeTitle?.includes("위원장") ||
          record.position?.includes("위원장") ||
          record.isHead;
        return (
          <div className="flex items-center gap-2">
            {isHead ? (
              <CrownOutlined className="text-amber-500 text-base" />
            ) : (
              <SafetyCertificateOutlined className="text-blue-500 text-sm" />
            )}
            <span className="font-bold text-slate-800 text-sm">
              {name || record.name || "성명 미입력"}
            </span>
          </div>
        );
      },
    },
    {
      title: "직책 / 구분",
      dataIndex: "judgeTitle",
      key: "judgeTitle",
      width: 130,
      render: (title, record) => {
        const displayTitle = title || record.position || "심사위원";
        const isHead = displayTitle.includes("위원장");
        return (
          <Tag
            color={isHead ? "gold" : "blue"}
            className="font-bold text-xs px-2.5 py-0.5 rounded-full"
          >
            {displayTitle}
          </Tag>
        );
      },
    },
    {
      title: "소속 / 직함",
      dataIndex: "judgeGym",
      key: "judgeGym",
      render: (gym, record) => (
        <span className="text-slate-600 text-xs font-medium">
          {gym || record.gym || record.judgeAffiliation || "-"}
        </span>
      ),
    },
    {
      title: "자격 / 비고",
      dataIndex: "judgeGrade",
      key: "judgeGrade",
      width: 120,
      render: (grade, record) => (
        <span className="text-slate-500 text-xs">
          {grade || record.judgeNote || "공인심판"}
        </span>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      {/* 패널 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
            <TeamOutlined className="text-lg" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 m-0">
              위촉 심판진 명단 및 심사 운영
            </h3>
            <p className="text-xs text-slate-500 m-0">
              이번 대회에 위촉되어 심사를 담당하는 공인 심사위원진입니다.
            </p>
          </div>
        </div>

        {/* 퀵 링크 버튼들 */}
        <div className="flex items-center gap-2">
          <Link
            to="/contestjudgetable"
            className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 no-underline transition-colors flex items-center gap-1"
          >
            <SettingOutlined />
            <span>심판 배정 & 비밀번호 관리</span>
          </Link>
          <Link
            to="/judgeassignmentPrint"
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs no-underline transition-colors"
          >
            배정표 인쇄 ➔
          </Link>
        </div>
      </div>

      {/* 심판 채점 룰 안내 칩 */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-xs text-purple-900">
        <span className="font-bold flex items-center gap-1">
          <span>⚖️</span>
          <span>보디빌딩 심사 집계 룰:</span>
        </span>
        <span className="bg-white px-2 py-0.5 rounded border border-purple-200 font-medium">
          5심제: 5명 전원 합산
        </span>
        <span className="bg-white px-2 py-0.5 rounded border border-purple-200 font-medium">
          7심제: 최고 1개, 최저 1개 제외 후 5명 합산
        </span>
        <span className="bg-white px-2 py-0.5 rounded border border-purple-200 font-medium">
          9심제: 최고 2개, 최저 2개 제외 후 5명 합산
        </span>
      </div>

      {/* 검색 바 & 심판 인원 통계 */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold text-slate-600">
          총 위촉 심판: <strong className="text-purple-700">{judges.length}명</strong>
        </div>
        <div className="w-64">
          <Input
            placeholder="심판 성명, 소속 검색..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            size="small"
            className="rounded-lg"
          />
        </div>
      </div>

      {/* 심판 목록 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
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
                description="등록된 심판 정보가 없습니다."
              />
            ),
          }}
        />
      </div>
    </div>
  );
};

export default JudgesOverviewPanel;
