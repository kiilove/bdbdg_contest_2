import React from "react";
import { Input } from "antd";
import { Search, RefreshCw } from "lucide-react";

const WeighInFilterToolbar = ({
  searchKeyword,
  onSearchChange,
  sectionOptions,
  selectedSection,
  onSelectSection,
  filterWeighedStatus,
  onSelectStatus,
  totalPlayersCount,
  activePlayersCount,
  gradeChangedCount,
  noShowCount,
  onRefresh,
}) => {
  return (
    <div className="bg-[#ffffff] rounded-[12px] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-[#171717]/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="w-full lg:w-80">
        <Input
          placeholder="선수명, 배부번호, 소속, 전화번호 뒤 4자리 검색"
          prefix={
            <Search
              size={15}
              strokeWidth={1.5}
              className="text-[#737373] mr-1"
            />
          }
          value={searchKeyword}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          className="h-9 rounded-[8px] border-[#171717]/[0.14] text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 bg-[#f4f4f5] p-1 rounded-[8px]">
          {sectionOptions.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => onSelectSection(sec)}
              className={`h-7 px-2.5 rounded-[6px] text-xs font-medium transition-colors duration-150 border-0 cursor-pointer ${
                selectedSection === sec
                  ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "bg-transparent text-[#525252] hover:text-[#171717]"
              }`}
            >
              {sec === "all" ? "전체 부문" : sec}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-[#f4f4f5] p-1 rounded-[8px] tabular-nums">
          <button
            type="button"
            onClick={() => onSelectStatus("all")}
            className={`h-7 px-2.5 rounded-[6px] text-xs font-medium border-0 cursor-pointer transition-colors duration-150 ${
              filterWeighedStatus === "all"
                ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "bg-transparent text-[#525252] hover:text-[#171717]"
            }`}
          >
            전체 ({totalPlayersCount})
          </button>
          <button
            type="button"
            onClick={() => onSelectStatus("active")}
            className={`h-7 px-2.5 rounded-[6px] text-xs font-medium border-0 cursor-pointer transition-colors duration-150 ${
              filterWeighedStatus === "active"
                ? "bg-[#16a34a] text-white"
                : "bg-transparent text-[#16a34a] hover:bg-[#16a34a]/[0.08]"
            }`}
          >
            정상출전 ({activePlayersCount})
          </button>
          <button
            type="button"
            onClick={() => onSelectStatus("gradeChanged")}
            className={`h-7 px-2.5 rounded-[6px] text-xs font-medium border-0 cursor-pointer transition-colors duration-150 ${
              filterWeighedStatus === "gradeChanged"
                ? "bg-[#b45309] text-white"
                : "bg-transparent text-[#b45309] hover:bg-[#b45309]/[0.08]"
            }`}
          >
            월체 ({gradeChangedCount})
          </button>
          <button
            type="button"
            onClick={() => onSelectStatus("noshow")}
            className={`h-7 px-2.5 rounded-[6px] text-xs font-medium border-0 cursor-pointer transition-colors duration-150 ${
              filterWeighedStatus === "noshow"
                ? "bg-[#dc2626] text-white"
                : "bg-transparent text-[#dc2626] hover:bg-[#dc2626]/[0.08]"
            }`}
          >
            불참 ({noShowCount})
          </button>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          title="최신 DB 동기화"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] text-xs font-medium border border-[#171717]/[0.12] transition-colors duration-150 cursor-pointer"
        >
          <RefreshCw size={14} strokeWidth={1.5} className="text-[#525252]" />
          <span>새로고침</span>
        </button>
      </div>
    </div>
  );
};

export default WeighInFilterToolbar;
