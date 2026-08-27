"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Modal, Button, Progress, message, Tag } from "antd";
import {
  CloudDownloadOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  ThunderboltFilled,
  HddOutlined,
  NotificationOutlined,
  VideoCameraOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import {
  downloadVideoWithProgress,
  getAllStoredVideosInfo,
  clearStoredVideos,
} from "../../utils/indexedDbVideoStorage";

const SCREEN_SLOTS = [
  { key: "standbyVideoUrl", title: "1. 대기 및 종목 안내", desc: "무대 시작 전 및 종목 준비 화면", color: "blue" },
  { key: "introVideoUrl", title: "2. 선수 소개 스포트라이트", desc: "선수 단독 입장 및 바이오 스펙", color: "cyan" },
  { key: "calloutVideoUrl", title: "3. 비교심사 호명 (Callout)", desc: "심사위원 비교심사 대상 호명", color: "orange" },
  { key: "posedownVideoUrl", title: "4. 포즈다운 배틀 (60초)", desc: "출전 선수 포즈다운 및 광고 융합", color: "red" },
  { key: "rankingVideoUrl", title: "5. 실시간 순위 발표", desc: "TOP 5 순위 실시간 2열 발표", color: "gold" },
  { key: "championVideoUrl", title: "6. 👑 1위 챔피언 세레모니", desc: "체급/그랑프리 1위 대상 단독 쇼케이스", color: "volcano" },
  { key: "awardVideoUrl", title: "7. 🏅 공식 시상식 & 단상", desc: "1~3위 포디움 시상 및 축하", color: "purple" },
];

export const PreDownloadModal = ({
  open,
  onClose,
  videoSettings = {},
  sponsors = [],
}) => {
  const [cacheInfo, setCacheInfo] = useState({});
  const [downloadProgress, setDownloadProgress] = useState({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [currentDownloadingKey, setCurrentDownloadingKey] = useState(null);

  // 로컬 캐시 상태 새로고침
  const refreshCacheInfo = async () => {
    const info = await getAllStoredVideosInfo();
    setCacheInfo(info);
  };

  useEffect(() => {
    if (open) {
      refreshCacheInfo();
    }
  }, [open, videoSettings, sponsors]);

  // 바이트 포맷팅 (MB 변환)
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // 📥 스폰서 광고 미디어 목록 정제 (동영상, 이미지, 로고)
  const sponsorSlots = useMemo(() => {
    const list = [];
    const seenUrls = new Set();

    (sponsors || []).forEach((sp, idx) => {
      const vid = sp.videoUrl || sp.mediaUrl;
      const img = sp.imageUrl || sp.logoUrl;

      if (vid && typeof vid === "string" && vid.startsWith("http") && !seenUrls.has(vid)) {
        seenUrls.add(vid);
        list.push({
          key: `sp_vid_${sp.id || idx}`,
          url: vid,
          title: `[광고 동영상] ${sp.name || "협찬사"}`,
          desc: sp.slogan || `${sp.tag || "스폰서"} 비디오 광고`,
          type: "video",
          color: "magenta",
        });
      }

      if (img && typeof img === "string" && img.startsWith("http") && !seenUrls.has(img)) {
        seenUrls.add(img);
        list.push({
          key: `sp_img_${sp.id || idx}`,
          url: img,
          title: `[광고 이미지] ${sp.name || "협찬사"}`,
          desc: sp.slogan || `${sp.tag || "스폰서"} 로고/배너`,
          type: "image",
          color: "lime",
        });
      }
    });

    return list;
  }, [sponsors]);

  // 단일 미디어 다운로드
  const handleDownloadSingle = async (slotKey, url) => {
    if (!url) {
      message.warning("설정된 미디어 URL이 없습니다.");
      return;
    }

    setCurrentDownloadingKey(slotKey);
    setDownloadProgress((prev) => ({ ...prev, [slotKey]: { percent: 0, status: "active" } }));

    const res = await downloadVideoWithProgress(url, (percent, received, total) => {
      setDownloadProgress((prev) => ({
        ...prev,
        [slotKey]: {
          percent,
          received,
          total,
          status: percent === 100 ? "success" : "active",
        },
      }));
    });

    if (res.success) {
      message.success(`다운로드 완료! (${formatBytes(res.size)})`);
      await refreshCacheInfo();
    } else {
      message.error(`다운로드 실패: ${res.error || "네트워크 오류"}`);
    }

    setCurrentDownloadingKey(null);
  };

  // 전체 미디어 (무대 7종 비디오 + 스폰서 광고 전체) 일괄 사전 다운로드
  const handleDownloadAll = async () => {
    const activeStageSlots = SCREEN_SLOTS
      .map((s) => ({ ...s, url: videoSettings[s.key] }))
      .filter((s) => Boolean(s.url && s.url.startsWith("http")));

    const activeSponsorSlots = sponsorSlots.filter((s) => Boolean(s.url && s.url.startsWith("http")));
    const allSlotsToDownload = [...activeStageSlots, ...activeSponsorSlots];

    if (allSlotsToDownload.length === 0) {
      message.info("사전 다운로드할 외부 미디어 URL이 없습니다. (기본 에셋 사용중)");
      return;
    }

    setIsDownloadingAll(true);
    message.loading({
      content: `전체 미디어 총 ${allSlotsToDownload.length}개(무대 영상 + 광고) 사전 다운로드를 시작합니다...`,
      key: "downloadAll",
      duration: 0,
    });

    for (const slot of allSlotsToDownload) {
      if (slot.url) {
        setCurrentDownloadingKey(slot.key);
        await downloadVideoWithProgress(slot.url, (percent, received, total) => {
          setDownloadProgress((prev) => ({
            ...prev,
            [slot.key]: {
              percent,
              received,
              total,
              status: percent === 100 ? "success" : "active",
            },
          }));
        });
      }
    }

    await refreshCacheInfo();
    setIsDownloadingAll(false);
    setCurrentDownloadingKey(null);
    message.success({
      content: "🎉 모든 무대 비디오 및 스폰서 광고가 브라우저에 안전하게 보관되었습니다! 이제 인터넷 없이도 100% 끊김 없이 재생됩니다.",
      key: "downloadAll",
      duration: 5,
    });
  };

  // 전체 캐시 삭제
  const handleClearCache = async () => {
    Modal.confirm({
      title: "로컬 미디어 캐시를 모두 비우시겠습니까?",
      content: "브라우저 로컬 디스크(IndexedDB)에 저장된 영상 및 광고 파일들이 삭제되며, 이후 재생 시 네트워크에서 다시 다운로드됩니다.",
      okText: "캐시 삭제",
      okType: "danger",
      cancelText: "취소",
      onOk: async () => {
        await clearStoredVideos();
        setCacheInfo({});
        setDownloadProgress({});
        message.success("로컬 미디어 캐시가 비워졌습니다.");
      },
    });
  };

  // 총 저장 용량 계산
  const totalCachedBytes = Object.values(cacheInfo).reduce((acc, cur) => acc + (cur?.size || 0), 0);
  
  const configuredStageCount = SCREEN_SLOTS.filter((s) => Boolean(videoSettings[s.key] && videoSettings[s.key].startsWith("http"))).length;
  const configuredSponsorCount = sponsorSlots.length;
  const totalConfiguredCount = configuredStageCount + configuredSponsorCount;

  const downloadedStageCount = SCREEN_SLOTS.filter((s) => Boolean(videoSettings[s.key] && cacheInfo[videoSettings[s.key]])).length;
  const downloadedSponsorCount = sponsorSlots.filter((s) => Boolean(cacheInfo[s.url])).length;
  const totalDownloadedCount = downloadedStageCount + downloadedSponsorCount;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={840}
      centered
      destroyOnClose
      styles={{
        content: {
          backgroundColor: "#090d16",
          border: "1px solid rgba(251, 191, 36, 0.3)",
          borderRadius: "24px",
          padding: "24px",
          color: "#fff",
        },
      }}
    >
      <div className="space-y-5 select-none">
        
        {/* 상단 타이틀 헤더 */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg">
              <CloudDownloadOutlined />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white m-0 tracking-tight">
                  무대 영상 & 스폰서 광고 사전 다운로드 매니저
                </h2>
                <Tag color="gold" className="font-bold border-amber-400/40">
                  SSD 영구 보관
                </Tag>
              </div>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                대회 무대 영상과 협찬사 광고 미디어를 100% 미리 받아두어 인터넷 버퍼링 없이 즉시 재생합니다.
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-slate-400">보관된 로컬 용량</div>
            <div className="text-lg font-black text-amber-400 font-mono">
              {formatBytes(totalCachedBytes)}
            </div>
          </div>
        </div>

        {/* 종합 상태 대시보드 카드 */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 text-xl shrink-0">
              <HddOutlined />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">준비 현황</div>
              <div className="text-sm sm:text-base font-black text-white">
                설정 미디어 <span className="text-amber-400">{totalConfiguredCount}개</span> 중{" "}
                <span className="text-emerald-400">{totalDownloadedCount}개 로컬 SSD 저장 완료</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltFilled />}
              loading={isDownloadingAll}
              onClick={handleDownloadAll}
              className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black border-none rounded-xl shadow-lg hover:opacity-90 h-11 px-4 text-xs sm:text-sm"
            >
              {isDownloadingAll ? "사전 다운로드 진행중..." : "전체 미디어(무대+광고) 일괄 다운로드"}
            </Button>

            {totalCachedBytes > 0 && (
              <Button
                danger
                size="large"
                icon={<DeleteOutlined />}
                onClick={handleClearCache}
                className="rounded-xl font-bold h-11 px-3 text-xs"
              >
                캐시 비우기
              </Button>
            )}
          </div>
        </div>

        {/* 상세 리스트 (무대 7종 영상 + 스폰서 광고) */}
        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1.5">
          
          {/* 1. 무대 메인 7종 영상 섹션 */}
          <div className="space-y-2">
            <div className="text-xs font-black text-amber-400 flex items-center gap-1.5 px-1">
              <VideoCameraOutlined />
              <span>1. 무대 7대 메인 배경 영상</span>
            </div>

            {SCREEN_SLOTS.map((slot) => {
              const url = videoSettings[slot.key];
              const isCached = Boolean(url && cacheInfo[url]);
              const cachedSize = url && cacheInfo[url]?.size;
              const progress = downloadProgress[slot.key];
              const isCurrentlyDownloading = currentDownloadingKey === slot.key;

              return (
                <div
                  key={slot.key}
                  className="bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-2xl p-3 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Tag color={slot.color} className="font-bold text-[10px] m-0">
                        {slot.title}
                      </Tag>
                      <span className="text-xs text-slate-400 font-bold truncate">
                        {slot.desc}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      {url ? (
                        <span className="text-slate-300 truncate max-w-md">
                          {url.split("?")[0].split("/").pop()}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">
                          (기본 고성능 로컬 에셋 재생중)
                        </span>
                      )}
                    </div>

                    {isCurrentlyDownloading && progress && (
                      <div className="pt-1">
                        <Progress
                          percent={progress.percent}
                          size="small"
                          status="active"
                          strokeColor={{ "0%": "#f59e0b", "100%": "#10b981" }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {url ? (
                      isCached ? (
                        <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-1 rounded-xl text-xs font-black text-emerald-400">
                          <CheckCircleFilled className="text-emerald-400" />
                          <span>보관 완료 ({formatBytes(cachedSize)})</span>
                        </div>
                      ) : (
                        <Button
                          size="small"
                          icon={<CloudDownloadOutlined />}
                          loading={isCurrentlyDownloading}
                          onClick={() => handleDownloadSingle(slot.key, url)}
                          className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-xl font-bold text-xs"
                        >
                          다운로드
                        </Button>
                      )
                    ) : (
                      <Tag className="bg-white/5 border-white/10 text-slate-400 text-xs">
                        기본 에셋
                      </Tag>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. 공식 협찬사 / 스폰서 광고 미디어 섹션 */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="text-xs font-black text-cyan-400 flex items-center gap-1.5 px-1">
              <NotificationOutlined />
              <span>2. 공식 협찬사 & 스폰서 광고 미디어 ({sponsorSlots.length}개)</span>
            </div>

            {sponsorSlots.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 text-center text-xs text-slate-400 font-bold">
                등록된 커스텀 협찬사 미디어 URL이 없습니다. (기본 4종 프리셋 에셋 자동 적용중)
              </div>
            ) : (
              sponsorSlots.map((slot) => {
                const url = slot.url;
                const isCached = Boolean(url && cacheInfo[url]);
                const cachedSize = url && cacheInfo[url]?.size;
                const progress = downloadProgress[slot.key];
                const isCurrentlyDownloading = currentDownloadingKey === slot.key;

                return (
                  <div
                    key={slot.key}
                    className="bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-2xl p-3 flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Tag color={slot.color} className="font-bold text-[10px] m-0">
                          {slot.title}
                        </Tag>
                        {slot.type === "video" ? (
                          <span className="text-[10px] text-amber-300 font-bold flex items-center gap-1">
                            <VideoCameraOutlined /> 비디오 광고
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-300 font-bold flex items-center gap-1">
                            <PictureOutlined /> 이미지 배너/로고
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-bold truncate">
                          {slot.desc}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-slate-300 truncate max-w-md">
                        {url.split("?")[0].split("/").pop()}
                      </div>

                      {isCurrentlyDownloading && progress && (
                        <div className="pt-1">
                          <Progress
                            percent={progress.percent}
                            size="small"
                            status="active"
                            strokeColor={{ "0%": "#06b6d4", "100%": "#10b981" }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isCached ? (
                        <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-1 rounded-xl text-xs font-black text-emerald-400">
                          <CheckCircleFilled className="text-emerald-400" />
                          <span>보관 완료 ({formatBytes(cachedSize)})</span>
                        </div>
                      ) : (
                        <Button
                          size="small"
                          icon={<CloudDownloadOutlined />}
                          loading={isCurrentlyDownloading}
                          onClick={() => handleDownloadSingle(slot.key, url)}
                          className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 rounded-xl font-bold text-xs"
                        >
                          다운로드
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* 하단 안내 캡션 */}
        <div className="text-[11px] text-slate-400 text-center border-t border-white/10 pt-3">
          💡 다운로드된 무대 영상과 스폰서 광고는 브라우저 로컬 디스크(IndexedDB)에 영구 보관되어 실시간 송출 시 0초 버퍼링 없이 즉시 재생됩니다.
        </div>

      </div>
    </Modal>
  );
};

export default PreDownloadModal;
