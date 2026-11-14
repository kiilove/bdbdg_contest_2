import React from "react";
import { Switch, Tooltip } from "antd";
import { Radio, Code, RefreshCw, LogOut, LogIn, HardDrive, Loader2, Check } from "lucide-react";
import { StatusDot } from "../../../components/ui/BibTag";

export const AudioHeader = ({
  currentStageCategory,
  isRemoteSync,
  setIsRemoteSync,
  ssdOnlyMode = true,
  setSsdOnlyMode,
  ssdCachedCount = 0,
  rawApiResponse,
  setIsRawModalOpen,
  isLoadingTracks,
  loadVibeFlowTracks,
  token,
  user,
  handleLogout,
  setIsLoginModalOpen,
  onOpenCacheModal,
  totalTrackCount = 0,
  readyTrackCount = 0,
  isBatchCaching = false,
  batchCacheProgress = null,
}) => {
  const isAllReady = totalTrackCount > 0 && readyTrackCount >= totalTrackCount;
  return (
    <header className="bg-[#0f0f10] border-b border-[#ededed]/[0.08]">
      <div className="w-full px-5 sm:px-6 lg:px-8 py-3 min-h-[60px] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[8px] bg-[#19191b] border border-[#ededed]/[0.08] flex items-center justify-center text-[#a1a1a6] shrink-0">
            <Radio size={18} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[16px] leading-5 font-medium text-[#ededed] m-0">
                VibeFlows 대회 음향 콘솔
              </h1>
              <span className="text-[11px] leading-4 font-mono text-[#85858b] px-2 py-0.5 rounded-[4px] bg-[#19191b] border border-[#ededed]/[0.08]">
                Official API
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              {currentStageCategory ? (
                <>
                  <StatusDot status="live" live />
                  <span className="text-[#85858b]">현재 무대</span>
                  <span className="text-[#ededed] font-medium truncate">
                    {currentStageCategory}
                  </span>
                </>
              ) : (
                <span className="text-[#85858b]">
                  클라우드 음원 스트리밍 및 무대 전광판 동기화
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {typeof setSsdOnlyMode === "function" && (
            <Tooltip title="켜두면 이 노트북 SSD(IndexedDB)에 저장된 음원만 재생 목록과 오토파일럿에 표시되어 외부 서버 요청(429 리밋)이 0회가 됩니다">
              <div
                className={`h-9 px-3 rounded-[8px] border flex items-center gap-2.5 transition-colors ${
                  ssdOnlyMode
                    ? "bg-[#10b981]/12 border-[#10b981]/35 text-[#6ee7b7]"
                    : "bg-[#19191b] border-[#ededed]/[0.08] text-[#a1a1a6]"
                }`}
              >
                <HardDrive
                  size={14}
                  strokeWidth={1.6}
                  className={ssdOnlyMode ? "text-[#34d399]" : "text-[#85858b]"}
                />
                <span className="text-xs font-medium">
                  SSD 전용 목록{" "}
                  <span className="font-mono tabular-nums">({ssdCachedCount}곡)</span>
                </span>
                <Switch
                  checked={ssdOnlyMode}
                  onChange={setSsdOnlyMode}
                  size="small"
                />
              </div>
            </Tooltip>
          )}

          <div className="h-9 px-3 rounded-[8px] bg-[#19191b] border border-[#ededed]/[0.08] flex items-center gap-2.5">
            <StatusDot status={isRemoteSync ? "live" : "idle"} live={isRemoteSync} />
            <span className="text-xs font-medium text-[#a1a1a6]">
              전광판 원격 동기화
            </span>
            <Switch
              checked={isRemoteSync}
              onChange={setIsRemoteSync}
              size="small"
            />
          </div>

          {rawApiResponse && (
            <button
              type="button"
              onClick={() => setIsRawModalOpen(true)}
              className="h-9 px-3 rounded-[8px] bg-[#19191b] hover:bg-[#232325] border border-[#ededed]/[0.08] text-xs font-medium text-[#a1a1a6] hover:text-[#ededed] flex items-center gap-2 cursor-pointer transition-[background-color,color,transform] duration-150 active:scale-[0.98]"
            >
              <Code size={16} strokeWidth={1.5} className="text-[#85858b]" />
              <span>API 응답 검사</span>
            </button>
          )}

          <button
            type="button"
            disabled={isLoadingTracks}
            onClick={() => loadVibeFlowTracks()}
            className="h-9 px-3 rounded-[8px] bg-[#19191b] hover:bg-[#232325] border border-[#ededed]/[0.08] text-xs font-medium text-[#ededed] flex items-center gap-2 cursor-pointer transition-[background-color,color,transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              size={16}
              strokeWidth={1.5}
              className={`text-[#a1a1a6] ${isLoadingTracks ? "animate-spin" : ""}`}
            />
            <span>음원 새로고침</span>
          </button>

          {onOpenCacheModal && (
            <Tooltip title="대회 전곡을 이 노트북 디스크(IndexedDB)에 미리 내려받아 현장 네트워크 지연 없이 즉시 재생합니다">
              <button
                type="button"
                onClick={onOpenCacheModal}
                className={`h-9 px-3 rounded-[8px] border text-xs font-medium flex items-center gap-2 cursor-pointer transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] ${
                  isBatchCaching
                    ? "bg-[#2563eb]/20 hover:bg-[#2563eb]/30 border-[#3b82f6]/45 text-[#93c5fd]"
                    : isAllReady
                    ? "bg-[#10b981]/12 hover:bg-[#10b981]/20 border-[#10b981]/35 text-[#6ee7b7]"
                    : "bg-[#19191b] hover:bg-[#232325] border-[#ededed]/[0.12] text-[#ededed]"
                }`}
              >
                {isBatchCaching ? (
                  <>
                    <Loader2 size={15} strokeWidth={1.75} className="animate-spin text-[#60a5fa]" />
                    <span className="font-mono tabular-nums">
                      사전 다운로드 {batchCacheProgress?.completed || 0}/{batchCacheProgress?.total || totalTrackCount}
                    </span>
                  </>
                ) : isAllReady ? (
                  <>
                    <Check size={15} strokeWidth={1.8} className="text-[#34d399]" />
                    <span>
                      전곡 준비됨{" "}
                      <span className="font-mono tabular-nums text-[#a7f3d0]">
                        ({readyTrackCount}/{totalTrackCount})
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <HardDrive size={15} strokeWidth={1.5} className="text-[#a1a1a6]" />
                    <span>
                      전곡 사전 다운로드{" "}
                      {totalTrackCount > 0 && (
                        <span className="font-mono tabular-nums text-[#85858b]">
                          ({readyTrackCount}/{totalTrackCount})
                        </span>
                      )}
                    </span>
                  </>
                )}
              </button>
            </Tooltip>
          )}

          {token ? (
            <div className="flex items-center gap-2.5 pl-3 border-l border-[#ededed]/[0.08]">
              <Tooltip title="로그인 세션은 24시간 동안 유지됩니다">
                <div className="text-right cursor-default">
                  <div className="text-[11px] leading-4 text-[#85858b]">
                    연결된 계정
                  </div>
                  <div className="text-xs font-mono text-[#ededed] truncate max-w-[160px]">
                    {user?.email || "VibeFlows"}
                  </div>
                </div>
              </Tooltip>
              <button
                type="button"
                onClick={handleLogout}
                className="h-9 px-3 rounded-[8px] bg-[#19191b] hover:bg-[#e5484d]/15 border border-[#ededed]/[0.08] hover:border-[#e5484d]/40 text-xs font-medium text-[#a1a1a6] hover:text-[#e5484d] flex items-center gap-2 cursor-pointer transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98]"
              >
                <LogOut size={16} strokeWidth={1.5} />
                <span>로그아웃</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="h-9 px-3.5 rounded-[8px] bg-[#ededed] hover:bg-white text-[#141415] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] text-xs font-medium flex items-center gap-2 cursor-pointer transition-[background-color,transform] duration-150 active:scale-[0.98]"
            >
              <LogIn size={16} strokeWidth={1.5} />
              <span>VibeFlows 로그인</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
