import React from "react";
import { Table, Input, Tag, Button, Tooltip, Space } from "antd";
import {
  SearchOutlined,
  PlayCircleFilled,
  PauseCircleFilled,
  DeleteOutlined,
  CustomerServiceOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import {
  CUSTOM_CATEGORIES,
  extractGender,
  getTrackKey,
  isTrackEqual,
  formatSeconds,
  isMatchingCustomTab,
} from "./constants";

export const AudioTrackTable = ({
  filteredTracks = [],
  allAvailableTracks = [],
  isLoadingTracks,
  searchText,
  setSearchText,
  selectedCategoryTab,
  setSelectedCategoryTab,
  selectedDivision,
  setSelectedDivision,
  currentTrack,
  isPlaying,
  handlePlayTrack,
  handleDeleteCustomMusic,
  seed1Pool = [],
  seed2Pool = [],
  token,
}) => {
  const seed1Set = new Set(seed1Pool.map((t) => getTrackKey(t)).filter(Boolean));
  const seed2Set = new Set(seed2Pool.map((t) => getTrackKey(t)).filter(Boolean));

  const totalAllCount = allAvailableTracks.length;
  const isFiltered = selectedCategoryTab !== "ALL" || selectedDivision !== "ALL" || !!searchText;

  const handleResetFilters = () => {
    if (setSelectedCategoryTab) setSelectedCategoryTab("ALL");
    if (setSelectedDivision) setSelectedDivision("ALL");
    if (setSearchText) setSearchText("");
  };

  const columns = [
    {
      title: "No / 시드",
      key: "index",
      width: 90,
      align: "center",
      render: (_, record, idx) => {
        const key = getTrackKey(record);
        const isSeed1 = key && seed1Set.has(key);
        const isSeed2 = key && seed2Set.has(key);
        const isThisTrackActive = isTrackEqual(currentTrack, record);

        if (isThisTrackActive) {
          return (
            <div className="flex justify-center">
              <span className="flex h-5 w-5 relative items-center justify-center">
                {isPlaying && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                )}
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span>
              </span>
            </div>
          );
        }

        if (isSeed1) {
          return (
            <Tag color="green" className="font-bold text-[10px] m-0">
              시드 1
            </Tag>
          );
        }
        if (isSeed2) {
          return (
            <Tag color="blue" className="font-bold text-[10px] m-0">
              시드 2
            </Tag>
          );
        }
        return <span className="text-slate-400 font-mono text-xs">{idx + 1}</span>;
      },
    },
    {
      title: "음원 정보",
      key: "track_info",
      render: (_, record) => {
        const isThisTrackActive = isTrackEqual(currentTrack, record);
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-xs font-bold ${
                  isThisTrackActive ? "text-indigo-600" : "text-slate-800"
                }`}
              >
                {record.title || record.name || "Untitled"}
              </span>
              {isThisTrackActive && isPlaying && (
                <Tag color="processing" className="text-[10px] font-bold">
                  재생중
                </Tag>
              )}
            </div>
            <div className="text-xs text-slate-500">
              {record.artist || "Unknown Artist"}
            </div>
          </div>
        );
      },
    },
    {
      title: "대회 종목 (Category)",
      dataIndex: "contest_category_kr",
      key: "category",
      width: 170,
      render: (cat, record) => {
        const categoryName = cat || record.category || record.folder || "";
        if (record.is_custom) {
          const customObj = CUSTOM_CATEGORIES.find((c) =>
            isMatchingCustomTab(record, c.name)
          );
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm">{customObj?.icon || "🎵"}</span>
              <Tag
                color={customObj?.tagColor || "geekblue"}
                className="font-bold rounded-md text-[10px] m-0 px-1.5 py-0"
              >
                자체음원
              </Tag>
              <span className="font-bold text-xs text-slate-800">
                {categoryName || customObj?.name || "특별 연출"}
              </span>
            </div>
          );
        }
        if (!categoryName) return <span className="text-slate-400 text-xs">-</span>;
        const g = extractGender(categoryName);
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {g === "FEMALE" ? (
              <Tag
                color="magenta"
                className="font-bold rounded-md text-[10px] m-0 px-1.5 py-0"
              >
                ♀️ 여성
              </Tag>
            ) : g === "MALE" ? (
              <Tag
                color="blue"
                className="font-bold rounded-md text-[10px] m-0 px-1.5 py-0"
              >
                ♂️ 남성
              </Tag>
            ) : null}
            <span className="font-bold text-xs text-slate-800">{categoryName}</span>
          </div>
        );
      },
    },
    {
      title: "부문 / 체급 (Division)",
      dataIndex: "contest_division_kr",
      key: "division",
      width: 150,
      render: (div) =>
        div && div !== "공통 / 전체" ? (
          <Tooltip title={`클릭 시 '${div}' 체급 음원만 필터링`}>
            <Tag
              color="purple"
              className="font-bold rounded-md cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setSelectedDivision && setSelectedDivision(div)}
            >
              {div}
            </Tag>
          </Tooltip>
        ) : (
          <span className="text-slate-400 text-xs font-mono">공통 / 전체</span>
        ),
    },
    {
      title: "재생시간",
      dataIndex: "duration",
      key: "duration",
      width: 90,
      align: "center",
      render: (dur) => (
        <span className="font-mono text-xs text-slate-600 font-medium">
          {formatSeconds(dur)}
        </span>
      ),
    },
    {
      title: "재생 제어 (수동 선곡)",
      key: "action",
      width: 140,
      align: "center",
      render: (_, record) => {
        const isThisTrackActive = isTrackEqual(currentTrack, record);
        const activePlaying = isThisTrackActive && isPlaying;

        return (
          <Space size="small">
            <Button
              type={activePlaying ? "default" : "primary"}
              size="middle"
              icon={
                activePlaying ? (
                  <PauseCircleFilled className="text-amber-500" />
                ) : (
                  <PlayCircleFilled />
                )
              }
              onClick={() => handlePlayTrack(record)}
              className={
                activePlaying
                  ? "font-bold rounded-lg border-amber-400 text-amber-600 bg-amber-50 shadow-xs"
                  : "bg-indigo-600 hover:bg-indigo-500 font-bold rounded-lg shadow-xs"
              }
            >
              {activePlaying ? "정지" : "재생"}
            </Button>
            {record.is_custom && (
              <Tooltip title="자체 음원 삭제">
                <Button
                  danger
                  type="text"
                  size="middle"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteCustomMusic(record)}
                  className="rounded-lg hover:bg-red-50"
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="space-y-3">
      {/* 상단 검색 및 퀵 선곡 툴바 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px] max-w-md">
          <Input
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="곡 제목, 아티스트, 종목명, 체급 검색..."
            value={searchText}
            onChange={(e) => setSearchText && setSearchText(e.target.value)}
            allowClear
            className="rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2">
          {isFiltered && (
            <Button
              size="small"
              onClick={handleResetFilters}
              className="rounded-lg text-xs font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            >
              전체 목록 보기 ({totalAllCount}곡)
            </Button>
          )}
          <div className="text-xs text-slate-500 font-medium">
            표시 중 <strong className="text-indigo-600 font-mono text-sm">{filteredTracks.length}</strong> / 전체 {totalAllCount}곡
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <Table
        dataSource={filteredTracks}
        columns={columns}
        rowKey={(record, idx) => getTrackKey(record) || idx}
        loading={isLoadingTracks}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50", "100"],
          className: "pt-2",
        }}
        locale={{
          emptyText: (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <CustomerServiceOutlined className="text-4xl text-slate-300" />
              <div className="text-sm font-medium text-slate-600">
                선택하신 조건에 일치하는 음원이 없습니다.
              </div>
              {totalAllCount > 0 && (
                <div>
                  <Button
                    type="primary"
                    onClick={handleResetFilters}
                    className="bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl"
                  >
                    🎵 전체 음원 목록 ({totalAllCount}곡) 모두 보기
                  </Button>
                </div>
              )}
            </div>
          ),
        }}
      />
    </div>
  );
};
