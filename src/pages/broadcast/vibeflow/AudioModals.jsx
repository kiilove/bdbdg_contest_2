import React, { useState, useMemo } from "react";
import { Drawer, Input } from "antd";
import {
  Radio,
  Code,
  BookOpen,
  Lock,
  X,
  HardDrive,
  Download,
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { getAudioCacheKey } from "../../../utils/indexedDbAudioStorage";

const darkDrawerStyles = {
  header: {
    backgroundColor: "#141415",
    borderBottom: "1px solid rgba(237, 237, 237, 0.08)",
    padding: "16px 24px",
  },
  content: {
    backgroundColor: "#141415",
  },
  body: {
    backgroundColor: "#141415",
    borderLeft: "1px solid rgba(237, 237, 237, 0.08)",
    padding: "24px",
  },
  footer: {
    backgroundColor: "#141415",
    borderTop: "1px solid rgba(237, 237, 237, 0.08)",
    padding: "12px 24px",
  },
};

export const AudioModals = ({
  isLoginModalOpen,
  setIsLoginModalOpen,
  handleLogin,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  rememberLogin,
  setRememberLogin,
  isLoggingIn,
  isRawModalOpen,
  setIsRawModalOpen,
  rawApiResponse,
  isGuideModalOpen,
  setIsGuideModalOpen,
  isCacheModalOpen = false,
  setIsCacheModalOpen,
  allAvailableTracks = [],
  ssdOnlyMode = true,
  setSsdOnlyMode,
  audioCacheMap = {},
  isBatchCaching = false,
  batchCacheProgress = null,
  handleStartBatchCache,
  handleCancelBatchCache,
  handleCacheSingleTrack,
  handleClearAudioCache,
}) => {
  const [cacheFilter, setCacheFilter] = useState("all");

  const uniqueCacheTracks = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const t of allAvailableTracks) {
      const ck = getAudioCacheKey(t);
      if (!ck || seen.has(ck)) continue;
      seen.add(ck);
      list.push({ track: t, cacheKey: ck, status: audioCacheMap[ck] || null });
    }
    return list;
  }, [allAvailableTracks, audioCacheMap]);

  const cacheStats = useMemo(() => {
    let cached = 0;
    let warmed = 0;
    let failed = 0;
    let pending = 0;
    let totalBytes = 0;
    for (const item of uniqueCacheTracks) {
      const mode = item.status?.mode;
      if (mode === "cached") {
        cached += 1;
        totalBytes += Number(item.status?.size || 0);
      } else if (mode === "warmed") {
        warmed += 1;
      } else if (mode === "failed") {
        failed += 1;
      } else {
        pending += 1;
      }
    }
    return {
      total: uniqueCacheTracks.length,
      cached,
      warmed,
      ready: cached + warmed,
      failed,
      pending,
      totalMb: (totalBytes / (1024 * 1024)).toFixed(1),
    };
  }, [uniqueCacheTracks]);

  const visibleCacheItems = useMemo(() => {
    if (cacheFilter === "pending") {
      return uniqueCacheTracks.filter(
        (i) => !i.status?.mode || i.status.mode === "downloading"
      );
    }
    if (cacheFilter === "ready") {
      return uniqueCacheTracks.filter(
        (i) => i.status?.mode === "cached" || i.status?.mode === "warmed"
      );
    }
    if (cacheFilter === "failed") {
      return uniqueCacheTracks.filter((i) => i.status?.mode === "failed");
    }
    return uniqueCacheTracks;
  }, [uniqueCacheTracks, cacheFilter]);
  return (
    <>
      <Drawer
        placement="right"
        width={460}
        open={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        closable={false}
        destroyOnClose
        styles={{
          header: { display: "none" },
          content: darkDrawerStyles.content,
          body: darkDrawerStyles.body,
        }}
      >
        <form onSubmit={handleLogin} className="space-y-4 text-[#ededed]">
          <div className="space-y-1.5 pb-4 border-b border-[#ededed]/[0.08]">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-[8px] bg-[#19191b] border border-[#ededed]/[0.08] text-[#a1a1a6] flex items-center justify-center">
                <Radio size={18} strokeWidth={1.5} />
              </div>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                aria-label="닫기"
                className="w-8 h-8 rounded-[6px] bg-transparent hover:bg-[#19191b] text-[#85858b] hover:text-[#ededed] inline-flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
            <h2 className="text-[18px] leading-6 font-medium text-[#ededed] m-0">
              VibeFlows 계정 로그인
            </h2>
            <p className="text-xs text-[#a1a1a6] m-0">
              계정을 인증하여 공식 대회 음원 목록을 동기화합니다
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[#a1a1a6] block mb-1.5">
                이메일 계정
              </label>
              <Input
                type="email"
                size="large"
                placeholder="example@vibeflows.net"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[#a1a1a6] block mb-1.5">
                비밀번호
              </label>
              <Input.Password
                size="large"
                placeholder="비밀번호 입력"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[#a1a1a6]">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => setRememberLogin(e.target.checked)}
                  className="rounded accent-[#2563eb]"
                />
                <span>로그인 세션 로컬 유지 (24시간)</span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-11 rounded-[8px] bg-[#ededed] hover:bg-white text-[#141415] text-[13px] font-medium cursor-pointer transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoggingIn ? "인증 확인 중" : "로그인 및 음원 로드"}
            </button>
          </div>

          <div className="text-xs text-[#85858b] flex items-center justify-center gap-1.5">
            <Lock size={14} strokeWidth={1.5} />
            <span>인증 토큰은 브라우저 로컬 스토리지에 보관됩니다</span>
          </div>
        </form>
      </Drawer>

      <Drawer
        placement="right"
        width={600}
        open={isRawModalOpen}
        onClose={() => setIsRawModalOpen(false)}
        styles={darkDrawerStyles}
        title={
          <span className="font-medium text-[15px] flex items-center gap-2 text-[#ededed]">
            <Code size={18} strokeWidth={1.5} className="text-[#85858b]" />
            <span>VibeFlows API 응답 원본 (JSON)</span>
          </span>
        }
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsRawModalOpen(false)}
              className="h-9 px-4 rounded-[8px] bg-[#ededed] hover:bg-white text-[#141415] text-xs font-medium cursor-pointer transition-colors duration-150"
            >
              닫기
            </button>
          </div>
        }
      >
        <div className="flex flex-col h-full gap-3">
          <div className="text-xs text-[#85858b] font-mono shrink-0">
            GET https://api.vibeflows.net/playlist/contest-songs
          </div>
          <pre className="bg-[#0f0f10] border border-[#ededed]/[0.08] p-4 rounded-[8px] text-xs font-mono text-[#ededed] flex-1 min-h-0 overflow-y-auto select-text m-0">
            {JSON.stringify(rawApiResponse, null, 2)}
          </pre>
        </div>
      </Drawer>

      <Drawer
        placement="right"
        width={560}
        open={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        styles={darkDrawerStyles}
        title={
          <span className="font-medium text-[15px] flex items-center gap-2 text-[#ededed]">
            <BookOpen size={18} strokeWidth={1.5} className="text-[#85858b]" />
            <span>스마트 오토파일럿 및 시드 매칭 안내</span>
          </span>
        }
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsGuideModalOpen(false)}
              className="h-9 px-4 rounded-[8px] bg-[#ededed] hover:bg-white text-[#141415] text-xs font-medium cursor-pointer transition-colors duration-150"
            >
              확인
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs text-[#a1a1a6] leading-relaxed">
          <div className="p-3.5 bg-[#19191b] rounded-[8px] border border-[#ededed]/[0.08]">
            <div className="font-medium text-[#ededed] text-[13px]">
              스마트 오토파일럿 동작 원리
            </div>
            <p className="mt-1 m-0 text-[#a1a1a6]">
              진행석에서 무대(종목 및 체급)를 전환하면 해당 무대에 맞는 경기 음악을 자동으로 선별하여 듀얼 데크 크로스페이드로 연속 재생합니다.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-[#141415] rounded-[8px] border border-[#ededed]/[0.08] space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-[4px] bg-[#2563eb]/20 text-[#60a5fa] border border-[#2563eb]/35">
                  시드 1
                </span>
                <span className="font-medium text-[#ededed]">
                  현재 무대의 종목 및 세부 체급 일치 음원 풀
                </span>
              </div>
              <p className="m-0 text-[#85858b]">
                선수 입장 시 최우선으로 선택되는 종목별 맞춤 경기 음악입니다.
              </p>
            </div>

            <div className="p-3 bg-[#141415] rounded-[8px] border border-[#ededed]/[0.08] space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-[4px] bg-[#232325] text-[#ededed] border border-[#ededed]/[0.10]">
                  시드 2
                </span>
                <span className="font-medium text-[#ededed]">
                  동일 성별 및 동일 종목 확장 음원 풀
                </span>
              </div>
              <p className="m-0 text-[#85858b]">
                시드 1 음원이 모두 재생된 이후 동일 종목 템포를 유지하기 위해 연결되는 보조 풀입니다.
              </p>
            </div>

            <div className="p-3 bg-[#141415] rounded-[8px] border border-[#ededed]/[0.08] space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-[4px] bg-[#232325] text-[#a1a1a6] border border-[#ededed]/[0.10]">
                  특별 연출
                </span>
                <span className="font-medium text-[#ededed]">
                  국민의례, 내빈소개, 시상식, 대기, 휴식 독립 음원
                </span>
              </div>
              <p className="m-0 text-[#85858b]">
                무대 전환 시에도 자동 중단되지 않으며, 각 탭에 지정된 페이드 시간과 연속 재생 설정을 따릅니다.
              </p>
            </div>
          </div>
        </div>
      </Drawer>

      <Drawer
        placement="right"
        width={580}
        open={isCacheModalOpen}
        onClose={() => setIsCacheModalOpen && setIsCacheModalOpen(false)}
        styles={darkDrawerStyles}
        title={
          <span className="font-medium text-[15px] flex items-center gap-2 text-[#ededed]">
            <HardDrive size={18} strokeWidth={1.5} className="text-[#85858b]" />
            <span>전곡 사전 다운로드 · 로컬 오프라인 캐시</span>
          </span>
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={isBatchCaching || cacheStats.ready === 0}
              onClick={() => handleClearAudioCache && handleClearAudioCache()}
              className="h-9 px-3 rounded-[8px] bg-[#19191b] hover:bg-[#e5484d]/15 border border-[#ededed]/[0.08] hover:border-[#e5484d]/40 text-xs font-medium text-[#a1a1a6] hover:text-[#e5484d] inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} strokeWidth={1.5} />
              <span>캐시 비우기</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCacheModalOpen && setIsCacheModalOpen(false)}
              className="h-9 px-4 rounded-[8px] bg-[#232325] hover:bg-[#2c2c2f] border border-[#ededed]/[0.10] text-[#ededed] text-xs font-medium cursor-pointer transition-colors duration-150"
            >
              닫기
            </button>
          </div>
        }
      >
        <div className="flex flex-col h-full gap-4 text-xs text-[#a1a1a6]">
          <div className="grid grid-cols-4 gap-2.5 shrink-0">
            <div className="p-3 rounded-[8px] bg-[#19191b] border border-[#ededed]/[0.08]">
              <div className="text-[11px] text-[#85858b]">전체 음원</div>
              <div className="mt-1 text-[18px] leading-6 font-mono tabular-nums font-medium text-[#ededed]">
                {cacheStats.total}
              </div>
            </div>
            <div className="p-3 rounded-[8px] bg-[#19191b] border border-[#10b981]/25">
              <div className="text-[11px] text-[#6ee7b7]">SSD 영구 저장</div>
              <div className="mt-1 text-[18px] leading-6 font-mono tabular-nums font-medium text-[#34d399]">
                {cacheStats.cached}
              </div>
            </div>
            <div className="p-3 rounded-[8px] bg-[#19191b] border border-[#ededed]/[0.08]">
              <div className="text-[11px] text-[#85858b]">워밍업 / 미저장</div>
              <div className="mt-1 text-[18px] leading-6 font-mono tabular-nums font-medium text-[#ededed]">
                {cacheStats.warmed} / {cacheStats.pending}
              </div>
            </div>
            <div className="p-3 rounded-[8px] bg-[#19191b] border border-[#ededed]/[0.08]">
              <div className="text-[11px] text-[#85858b]">저장 용량</div>
              <div className="mt-1 text-[18px] leading-6 font-mono tabular-nums font-medium text-[#ededed]">
                {cacheStats.totalMb}
                <span className="text-[11px] text-[#85858b] ml-0.5">MB</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-[8px] bg-[#19191b] border border-[#ededed]/[0.08] space-y-3 shrink-0">
            {ssdOnlyMode && (
              <div className="px-3 py-2 rounded-[6px] bg-[#10b981]/10 border border-[#10b981]/30 flex items-center justify-between gap-2 text-[11px] text-[#a7f3d0]">
                <span>
                  메인 재생 목록·오토파일럿에는 <strong>SSD 저장 완료({cacheStats.cached}곡)</strong>만 노출됩니다. 미저장 음원은 이 창에서만 확인·다운로드할 수 있습니다.
                </span>
                {typeof setSsdOnlyMode === "function" && (
                  <button
                    type="button"
                    onClick={() => setSsdOnlyMode(false)}
                    className="shrink-0 px-2 py-1 rounded bg-[#141415]/70 hover:bg-[#141415] border border-[#10b981]/30 text-[#6ee7b7] cursor-pointer"
                  >
                    전체 표시로 전환
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-[13px] font-medium text-[#ededed]">
                  {isBatchCaching
                    ? "노트북 디스크에 음원을 내려받는 중입니다 (절전 자동 방지 중)"
                    : cacheStats.total > 0 && cacheStats.ready >= cacheStats.total
                    ? "모든 대회 음원이 준비되었습니다"
                    : "대회 전곡을 미리 내려받아 현장 재생 지연을 원천 차단합니다"}
                </div>
                <div className="text-[11px] text-[#85858b] mt-0.5">
                  현재 도메인({typeof window !== "undefined" ? window.location.host : "bdbdgmain3.web.app"})의 로컬 IndexedDB에 보관되어 인터넷이 느려도 0초 즉시 재생됩니다.
                </div>
              </div>
            </div>

            {isBatchCaching && batchCacheProgress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-[#93c5fd] truncate max-w-[360px]">
                    {batchCacheProgress.activeTitles?.length > 0
                      ? `수신 중: ${batchCacheProgress.activeTitles.join(", ")}`
                      : "대기열 정리 중..."}
                  </span>
                  <span className="text-[#ededed]">
                    {batchCacheProgress.completed}/{batchCacheProgress.total} ({batchCacheProgress.percent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#0f0f10] overflow-hidden border border-[#ededed]/[0.06]">
                  <div
                    className="h-full bg-[#2563eb] transition-[width] duration-200"
                    style={{ width: `${batchCacheProgress.percent || 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {isBatchCaching ? (
                <button
                  type="button"
                  onClick={() => handleCancelBatchCache && handleCancelBatchCache()}
                  className="h-9 px-4 rounded-[8px] bg-[#e5484d]/20 hover:bg-[#e5484d]/30 border border-[#e5484d]/45 text-[#fca5a5] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>다운로드 일시 중지</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={cacheStats.total === 0}
                    onClick={() =>
                      handleStartBatchCache && handleStartBatchCache({ force: false })
                    }
                    className="h-9 px-4 rounded-[8px] bg-[#ededed] hover:bg-white text-[#141415] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download size={14} strokeWidth={1.75} />
                    <span>
                      {cacheStats.pending > 0 || cacheStats.failed > 0
                        ? `미저장 음원 일괄 다운로드 (${cacheStats.pending + cacheStats.failed}곡)`
                        : "전곡 캐시 상태 재확인"}
                    </span>
                  </button>

                  {cacheStats.ready > 0 && (
                    <button
                      type="button"
                      disabled={cacheStats.total === 0}
                      onClick={() =>
                        handleStartBatchCache && handleStartBatchCache({ force: true })
                      }
                      className="h-9 px-3 rounded-[8px] bg-[#232325] hover:bg-[#2c2c2f] border border-[#ededed]/[0.10] text-[#ededed] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <RotateCcw size={13} strokeWidth={1.6} />
                      <span>전체 다시 받기</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1">
              {[
                { key: "all", label: `전체 (${cacheStats.total})` },
                { key: "pending", label: `미저장 (${cacheStats.pending})` },
                { key: "ready", label: `준비됨 (${cacheStats.ready})` },
                { key: "failed", label: `실패 (${cacheStats.failed})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCacheFilter(tab.key)}
                  className={`h-7 px-2.5 rounded-[6px] text-[11px] font-medium cursor-pointer transition-colors ${
                    cacheFilter === tab.key
                      ? "bg-[#232325] text-[#ededed] border border-[#ededed]/[0.14]"
                      : "bg-transparent text-[#85858b] hover:text-[#ededed]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[#85858b]">
              로그인 갱신 후에도 캐시 유지됨
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto rounded-[8px] border border-[#ededed]/[0.08] bg-[#0f0f10] divide-y divide-[#ededed]/[0.06]">
            {visibleCacheItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#85858b]">
                {cacheStats.total === 0
                  ? "먼저 VibeFlows 로그인 또는 음원 로드를 진행해 주세요."
                  : "해당 조건의 음원이 없습니다."}
              </div>
            ) : (
              visibleCacheItems.map(({ track, cacheKey, status }, i) => {
                const mode = status?.mode;
                const category =
                  track.contest_category_kr || track.category || track.folder || "기타";
                const sizeMb = status?.size
                  ? `${(status.size / (1024 * 1024)).toFixed(1)}MB`
                  : "";

                return (
                  <div
                    key={cacheKey}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-[#19191b]/70"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-[11px] text-[#85858b]">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-xs font-medium text-[#ededed] truncate">
                          {track.title || track.name || "Untitled"}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#85858b] truncate">
                        {category}
                        {track.contest_division_kr
                          ? ` · ${track.contest_division_kr}`
                          : ""}
                        {sizeMb ? ` · ${sizeMb}` : ""}
                        {mode === "failed" && status?.error
                          ? ` · ${status.error}`
                          : ""}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {mode === "cached" ? (
                        <span className="h-6 px-2 rounded-[4px] bg-[#10b981]/12 border border-[#10b981]/30 text-[#34d399] text-[11px] font-mono inline-flex items-center gap-1">
                          <Check size={12} strokeWidth={2} />
                          <span>SSD 저장됨</span>
                        </span>
                      ) : mode === "warmed" ? (
                        <span className="h-6 px-2 rounded-[4px] bg-[#2563eb]/15 border border-[#2563eb]/35 text-[#93c5fd] text-[11px] font-mono inline-flex items-center gap-1">
                          <Check size={12} strokeWidth={2} />
                          <span>워밍업됨</span>
                        </span>
                      ) : mode === "downloading" ? (
                        <span className="h-6 px-2 rounded-[4px] bg-[#232325] border border-[#ededed]/[0.10] text-[#93c5fd] text-[11px] font-mono tabular-nums inline-flex items-center gap-1">
                          <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                          <span>{status?.progress || 0}%</span>
                        </span>
                      ) : mode === "failed" ? (
                        <button
                          type="button"
                          disabled={isBatchCaching}
                          onClick={() =>
                            handleCacheSingleTrack && handleCacheSingleTrack(track)
                          }
                          className="h-7 px-2.5 rounded-[6px] bg-[#e5484d]/15 hover:bg-[#e5484d]/25 border border-[#e5484d]/35 text-[#fca5a5] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          <AlertCircle size={12} strokeWidth={1.8} />
                          <span>재시도</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBatchCaching}
                          onClick={() =>
                            handleCacheSingleTrack && handleCacheSingleTrack(track)
                          }
                          className="h-7 px-2.5 rounded-[6px] bg-[#19191b] hover:bg-[#232325] border border-[#ededed]/[0.10] text-[#a1a1a6] hover:text-[#ededed] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          <Download size={12} strokeWidth={1.6} />
                          <span>저장</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Drawer>
    </>
  );
};
