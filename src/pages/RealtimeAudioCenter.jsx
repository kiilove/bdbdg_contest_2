"use client";

import React, { useEffect, useState, useContext, useRef } from "react";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { Slider, message, Switch } from "antd";
import { where, collection, getDocs } from "firebase/firestore";
import { db, database } from "../firebase";
import { ref, set } from "firebase/database";
import {
  Radio,
  Volume2,
  Play,
  Pause,
  ListMusic,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { BibTag, StatusDot } from "../components/ui/BibTag";

const formatClock = (sec) => {
  if (!sec || isNaN(sec)) return "00:00";
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};

export default function RealtimeAudioCenter() {
  const { currentContest } = useContext(CurrentContestContext);

  const [contestPlayList, setContestPlayList] = useState(null);
  const [, setTrackPlayList] = useState([]);
  const [tracks, setTracks] = useState([]);

  const [entryTracks, setEntryTracks] = useState([]);
  const [lineupTracks, setLineupTracks] = useState([]);
  const [poseDownTracks, setPoseDownTracks] = useState([]);

  const [awardsMusic, setAwardsMusic] = useState([]);
  const [resultAnnouncementTracks, setResultAnnouncementTracks] = useState([]);
  const [waitingTracks, setWaitingTracks] = useState([]);

  const [audioPlaylist, setAudioPlaylist] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [currentPlaylistType, setCurrentPlaylistType] = useState(null);

  const [volume, setVolume] = useState(1);

  const [showEntryTracks, setShowEntryTracks] = useState(false);
  const [showLineupTracks, setShowLineupTracks] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  const [isRemoteSync, setIsRemoteSync] = useState(true);
  const [lastProcessedSelectedAt, setLastProcessedSelectedAt] = useState(0);

  const audioRef = useRef(null);
  const rafRef = useRef(null);

  const categoryQuery = useFirestoreQuery();
  const trackPlayListQuery = useFirestoreQuery();

  const contestId =
    currentContest?.contests?.id ||
    currentContest?.contestInfo?.id ||
    currentContest?.id ||
    "";

  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );

  const categoryId = realtimeData?.categoryId;
  const categoryTitle = realtimeData?.categoryTitle;

  const { data: nowPlaying } = useFirebaseRealtimeGetDocument("nowPlaying");

  useEffect(() => {
    if (!nowPlaying || !audioRef.current || !isRemoteSync) return;

    const { downloadURL, status, selectedAt } = nowPlaying;
    if (!downloadURL && status !== "stop") return;

    if (selectedAt === lastProcessedSelectedAt) {
      if (status === "play" && audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else if (status === "pause" && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else if (status === "stop") {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
      return;
    }

    setLastProcessedSelectedAt(selectedAt);

    if (status === "play") {
      const playableURL = downloadURL;
      if (!playableURL) return;

      stopTracking();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = playableURL;
      audioRef.current.volume = volume;

      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          startTracking();
        })
        .catch(() =>
          message.warning(
            "원격 재생이 차단되었습니다. 수동으로 재생을 눌러주세요"
          )
        );
    } else if (status === "stop") {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      stopTracking();
    } else if (status === "pause") {
      audioRef.current.pause();
      setIsPlaying(false);
      stopTracking();
    }
  }, [nowPlaying, isRemoteSync]);

  const updateRemoteControl = (track, status) => {
    if (!isRemoteSync || !track) return;
    const timestamp = Date.now();
    setLastProcessedSelectedAt(timestamp);

    const data = {
      fileName: track.name || track.fileName || "Unknown",
      filePath: track.path || track.filePath || "",
      downloadURL:
        track.url || track.path || track.downloadURL || track.fileUrl || "",
      selectedAt: timestamp,
      status: status,
    };
    set(ref(database, "nowPlaying"), data);
  };

  useEffect(() => {
    let isCancelled = false;

    async function fetchData() {
      if (!contestId) {
        if (!isCancelled) {
          setContestPlayList(null);
          setDataError(null);
          setIsDataLoading(false);
        }
        return;
      }

      if (!isCancelled) {
        setIsDataLoading(true);
        setDataError(null);
      }

      try {
        const playListData = await categoryQuery.getDocuments(
          "contest_music_settings",
          [where("contestId", "==", contestId)]
        );
        const trackPlayListData = await trackPlayListQuery.getDocuments(
          "track_play_list"
        );

        const safePlaylists = Array.isArray(trackPlayListData)
          ? trackPlayListData
          : [];
        const allTracks = [];
        for (const playlist of safePlaylists) {
          if (!playlist?.id) continue;
          const subRef = collection(
            db,
            "track_play_list",
            playlist.id,
            "tracks"
          );
          const subSnap = await getDocs(subRef);

          subSnap.forEach((docSnap) => {
            const data = docSnap.data();
            allTracks.push({
              id: docSnap.id,
              ...data,
              playlistId: playlist.id,
            });
          });
        }

        const sortedSettings = [...(playListData || [])].sort((a, b) => {
          const tA = new Date(a?.updatedAt || a?.createdAt || 0).getTime() || 0;
          const tB = new Date(b?.updatedAt || b?.createdAt || 0).getTime() || 0;
          return tB - tA;
        });

        if (!isCancelled) {
          setContestPlayList(sortedSettings[0] || null);
          setTrackPlayList(safePlaylists);
          setTracks(allTracks);
        }
      } catch (err) {
        if (!isCancelled) {
          setDataError(err);
        }
      } finally {
        if (!isCancelled) {
          setIsDataLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      isCancelled = true;
    };
  }, [contestId]);

  useEffect(() => {
    if (!contestPlayList?.id || !tracks.length) {
      setAwardsMusic([]);
      setResultAnnouncementTracks([]);
      setWaitingTracks([]);
      return;
    }

    const commonMusic = contestPlayList?.commonMusic || {};

    const setList = (id, setter) => {
      if (!id) return setter([]);
      setter(
        tracks
          .filter((t) => t.playlistId === id)
          .sort((a, b) => (a.playIndex || 0) - (b.playIndex || 0))
      );
    };

    setList(commonMusic.awardsMusic, setAwardsMusic);
    setList(
      commonMusic.resultAnnouncementMusic,
      setResultAnnouncementTracks
    );
    setList(commonMusic.waitingMusic, setWaitingTracks);
  }, [contestPlayList, tracks]);

  useEffect(() => {
    if (!categoryId || !contestPlayList?.id || !tracks.length) {
      setEntryTracks([]);
      setLineupTracks([]);
      setPoseDownTracks([]);
      return;
    }

    const rawCategoryMusic = contestPlayList?.categoryMusic || {};
    const cfg = Array.isArray(rawCategoryMusic)
      ? rawCategoryMusic.find((f) => f?.contestCategoryId === categoryId)
      : rawCategoryMusic?.[categoryId] || null;

    if (!cfg) {
      setEntryTracks([]);
      setLineupTracks([]);
      setPoseDownTracks([]);
      return;
    }

    const setList = (id, setter) => {
      if (!id) return setter([]);
      setter(
        tracks
          .filter((t) => t.playlistId === id)
          .sort((a, b) => (a.playIndex || 0) - (b.playIndex || 0))
      );
    };

    setList(cfg.entryPlaylistId || cfg.entryMusic, setEntryTracks);
    setList(cfg.lineupPlaylistId || cfg.lineupMusic, setLineupTracks);
    setList(cfg.poseDownPlaylistId || cfg.poseDownMusic, setPoseDownTracks);
  }, [categoryId, contestPlayList, tracks]);

  const updateProgress = () => {
    if (audioRef.current && !audioRef.current.paused) {
      setCurrentTime(audioRef.current.currentTime);
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  };

  const startTracking = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateProgress);
  };

  const stopTracking = () => cancelAnimationFrame(rafRef.current);

  const playTrack = (track) => {
    if (!audioRef.current) return;
    const playableURL =
      track.url || track.path || track.downloadURL || track.fileUrl;

    if (!playableURL) {
      message.error("음원 URL이 존재하지 않습니다");
      return;
    }

    stopTracking();
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.src = playableURL;
    audioRef.current.volume = volume;

    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        startTracking();
      })
      .catch(() =>
        message.warning("재생이 차단되었습니다. 수동으로 재생을 눌러주세요")
      );
  };

  const handlePlaySingleTrack = (track, type) => {
    setCurrentPlaylistType(type);
    setAudioPlaylist([track]);
    setCurrentTrackIndex(0);
    playTrack(track);
    updateRemoteControl(track, "play");
  };

  const handleAddAllToPlaylistAndPlay = (list, type) => {
    if (!list?.length) return message.info("재생할 트랙이 없습니다");
    setCurrentPlaylistType(type);
    setAudioPlaylist(list);
    setCurrentTrackIndex(0);
    playTrack(list[0]);
    updateRemoteControl(list[0], "play");
  };

  const handleNextTrack = () => {
    if (!audioPlaylist.length) return;

    const nextIndex = currentTrackIndex + 1;
    if (nextIndex < audioPlaylist.length) {
      setCurrentTrackIndex(nextIndex);
      playTrack(audioPlaylist[nextIndex]);
      updateRemoteControl(audioPlaylist[nextIndex], "play");
    } else {
      setIsPlaying(false);
      stopTracking();
      setCurrentTrackIndex(0);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopTracking();
      if (isRemoteSync && nowPlaying) {
        set(ref(database, "nowPlaying/status"), "pause");
      }
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          startTracking();
          if (isRemoteSync && nowPlaying) {
            set(ref(database, "nowPlaying/status"), "play");
          }
        })
        .catch(() =>
          message.warning("재생이 차단되었습니다. 수동으로 재생을 눌러주세요")
        );
    }
  };

  const handleSliderChange = (value) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
    if (!audioRef.current.paused) startTracking();
  };

  const handleVolumeChange = (value) => {
    setVolume(value);
    if (audioRef.current) audioRef.current.volume = value;
  };

  const setQuickVolume = (v) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const renderTrackGroupCard = ({
    title,
    typeKey,
    list,
    collapsible = false,
    expanded = true,
    onToggleExpand,
  }) => {
    const isGroupActive = currentPlaylistType === typeKey;

    return (
      <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="bg-[#f4f4f5] px-4 py-3 border-b border-[#171717]/[0.08] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isGroupActive && isPlaying && <StatusDot status="live" live />}
            <span className="text-[14px] leading-5 font-medium text-[#171717] truncate">
              {title}
            </span>
            <span className="text-xs font-mono tabular-nums text-[#737373] shrink-0">
              {list.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {collapsible && (
              <button
                type="button"
                aria-label={expanded ? "접기" : "펼치기"}
                onClick={onToggleExpand}
                className="h-8 w-8 rounded-[6px] bg-[#ffffff] hover:bg-[#fafafa] border border-[#171717]/[0.10] text-[#525252] hover:text-[#171717] inline-flex items-center justify-center cursor-pointer transition-colors duration-150"
              >
                {expanded ? (
                  <ChevronUp size={15} strokeWidth={1.5} />
                ) : (
                  <ChevronDown size={15} strokeWidth={1.5} />
                )}
              </button>
            )}

            <button
              type="button"
              disabled={!list.length}
              onClick={() => handleAddAllToPlaylistAndPlay(list, typeKey)}
              className="h-8 px-3 rounded-[6px] bg-[#ffffff] hover:bg-[#2563eb] border border-[#171717]/[0.10] hover:border-[#2563eb] text-xs font-medium text-[#171717] hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-[background-color,border-color,color,opacity] duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={14} strokeWidth={1.5} />
              <span>전체 재생</span>
            </button>
          </div>
        </div>

        {expanded && (
          <div className="divide-y divide-[#171717]/[0.06]">
            {list.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-[#737373]">
                배정된 음원이 없습니다
              </div>
            ) : (
              list.map((track, idx) => {
                const isSelected =
                  isGroupActive &&
                  audioPlaylist[currentTrackIndex]?.id === track.id;

                return (
                  <button
                    key={track.id || idx}
                    type="button"
                    onClick={() => handlePlaySingleTrack(track, typeKey)}
                    className={`w-full h-10 px-4 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors duration-150 ${
                      isSelected
                        ? "bg-[#2563eb]/[0.08] text-[#2563eb]"
                        : "bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BibTag
                        number={String(idx + 1).padStart(2, "0")}
                        variant={isSelected ? "active" : "default"}
                        size="sm"
                      />
                      <span className="text-[13px] leading-5 truncate font-medium">
                        {track.name}
                      </span>
                    </div>
                    {isSelected && isPlaying && (
                      <StatusDot status="live" live />
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMainView = () => {
    if (realtimeLoading || isDataLoading) {
      return (
        <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
          <div className="inline-flex items-center gap-2 text-xs text-[#525252]">
            <RefreshCw
              size={16}
              strokeWidth={1.5}
              className="animate-spin text-[#737373]"
            />
            <span>음원 설정을 불러오는 중</span>
          </div>
        </div>
      );
    }

    if (realtimeError || dataError) {
      return (
        <div className="min-h-screen bg-[#fafafa] p-6">
          <div className="max-w-xl mx-auto p-4 rounded-[12px] bg-[#ffffff] border border-[#dc2626]/30 flex items-start gap-3">
            <AlertCircle
              size={18}
              strokeWidth={1.5}
              className="text-[#dc2626] shrink-0 mt-0.5"
            />
            <div>
              <div className="text-[14px] font-medium text-[#171717]">
                데이터 로드 오류
              </div>
              <div className="text-xs text-[#525252] mt-1">
                {(realtimeError || dataError)?.message ||
                  "데이터를 불러오는 중 오류가 발생했습니다"}
              </div>
            </div>
          </div>
        </div>
      );
    }

    const volumePercent = Math.round(volume * 100);
    const activeTrack = audioPlaylist[currentTrackIndex];

    return (
      <div className="min-h-screen bg-[#fafafa] text-[#171717]">
        <header className="bg-[#ffffff] border-b border-[#171717]/[0.08]">
          <div className="w-full px-5 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] flex items-center justify-center text-[#525252] shrink-0">
                <Radio size={18} strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="text-[18px] leading-6 font-medium text-[#171717] m-0">
                  실시간 무대 음향 센터
                </h1>
                <div className="text-xs text-[#525252] flex items-center gap-2 mt-0.5">
                  {categoryTitle ? (
                    <>
                      <StatusDot status="live" live />
                      <span>현재 진행 종목: {categoryTitle}</span>
                    </>
                  ) : (
                    <span className="text-[#737373]">
                      종목별 지정 플레이리스트 및 원격 음원 수신기
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="h-9 px-3 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] inline-flex items-center gap-2.5 self-start sm:self-auto">
              <StatusDot
                status={isRemoteSync ? "live" : "idle"}
                live={isRemoteSync}
              />
              <span className="text-xs font-medium text-[#525252]">
                원격 동기화 수신
              </span>
              <Switch
                checked={isRemoteSync}
                onChange={(val) => setIsRemoteSync(val)}
                size="small"
              />
            </div>
          </div>
        </header>

        <div className="w-full px-5 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="bg-[#f4f4f5] px-5 py-3 border-b border-[#171717]/[0.08] flex items-center justify-between">
                <span className="text-[13px] leading-5 font-medium text-[#171717]">
                  오디오 플레이어
                </span>
                <div className="inline-flex items-center gap-1.5 text-xs text-[#525252]">
                  <StatusDot
                    status={isPlaying ? "live" : "idle"}
                    live={isPlaying}
                  />
                  <span>{isPlaying ? "재생 중" : "대기"}</span>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div className="space-y-3">
                  <div className="p-3 rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.08]">
                    <div className="text-[11px] leading-4 text-[#737373]">
                      선택된 트랙
                    </div>
                    <div className="text-[14px] leading-5 font-medium text-[#171717] truncate mt-0.5">
                      {activeTrack?.name ||
                        nowPlaying?.fileName ||
                        "재생 대기 중"}
                    </div>
                  </div>

                  {audioPlaylist.length > 0 && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handlePlayPause}
                        className="w-full h-10 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[13px] font-medium inline-flex items-center justify-center gap-2 cursor-pointer transition-[background-color,transform] duration-150 active:scale-[0.98]"
                      >
                        {isPlaying ? (
                          <>
                            <Pause size={16} strokeWidth={1.5} />
                            <span>일시정지</span>
                          </>
                        ) : (
                          <>
                            <Play size={16} strokeWidth={1.5} />
                            <span>재생</span>
                          </>
                        )}
                      </button>

                      <Slider
                        min={0}
                        max={trackDuration || 0}
                        step={0.1}
                        value={currentTime}
                        onChange={handleSliderChange}
                        tooltip={{ open: false }}
                        className="m-0"
                      />

                      <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[#737373]">
                        <span className="text-[#171717]">
                          {formatClock(currentTime)}
                        </span>
                        <span>
                          {formatClock(currentTime)} /{" "}
                          {formatClock(trackDuration)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#171717]/[0.08] space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-[#525252]">
                      <Volume2
                        size={16}
                        strokeWidth={1.5}
                        className="text-[#737373]"
                      />
                      <span>출력 볼륨</span>
                    </span>
                    <span className="font-mono tabular-nums font-medium text-[#171717]">
                      {volumePercent}%
                    </span>
                  </div>

                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={handleVolumeChange}
                    tooltip={{ open: false }}
                    className="m-0"
                  />

                  <div className="grid grid-cols-6 gap-1.5 pt-1">
                    {[
                      { val: 0, label: "0" },
                      { val: 0.1, label: "10" },
                      { val: 0.2, label: "20" },
                      { val: 0.5, label: "50" },
                      { val: 0.8, label: "80" },
                      { val: 1, label: "100" },
                    ].map((preset) => {
                      const active =
                        Math.abs(volumePercent - Math.round(preset.val * 100)) <=
                        3;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setQuickVolume(preset.val)}
                          className={`h-8 rounded-[6px] border font-mono tabular-nums text-xs font-medium cursor-pointer transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] ${
                            active
                              ? "bg-[#2563eb] border-[#2563eb] text-white"
                              : "bg-[#f4f4f5] hover:bg-[#e4e4e7] border-[#171717]/[0.08] text-[#171717]"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="bg-[#f4f4f5] px-5 py-3 border-b border-[#171717]/[0.08] flex items-center justify-between">
                <span className="text-[13px] leading-5 font-medium text-[#171717] flex items-center gap-2">
                  <ListMusic
                    size={16}
                    strokeWidth={1.5}
                    className="text-[#737373]"
                  />
                  <span>현재 재생 대기열</span>
                </span>
                <span className="text-xs font-mono tabular-nums text-[#737373]">
                  {audioPlaylist.length}곡
                </span>
              </div>

              <div className="divide-y divide-[#171717]/[0.06] max-h-[320px] overflow-y-auto">
                {audioPlaylist.length === 0 ? (
                  <div className="py-8 px-4 text-center text-xs text-[#737373]">
                    우측 목록에서 음원을 선택하면 대기열에 추가됩니다
                  </div>
                ) : (
                  audioPlaylist.map((track, i) => {
                    const active = i === currentTrackIndex;
                    return (
                      <button
                        key={track.id || i}
                        type="button"
                        onClick={() => {
                          setCurrentTrackIndex(i);
                          playTrack(track);
                        }}
                        className={`w-full h-10 px-4 text-left flex items-center justify-between gap-2.5 cursor-pointer transition-colors duration-150 ${
                          active
                            ? "bg-[#2563eb]/[0.08] text-[#2563eb]"
                            : "bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BibTag
                            number={String(i + 1).padStart(2, "0")}
                            variant={active ? "active" : "default"}
                            size="sm"
                          />
                          <span className="text-xs font-medium truncate">
                            {track.name}
                          </span>
                        </div>
                        {active && isPlaying && (
                          <StatusDot status="live" live />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            {!contestId && (
              <div className="p-4 rounded-[12px] bg-[#ffffff] border border-[#b45309]/25 flex items-start gap-3">
                <AlertCircle
                  size={18}
                  strokeWidth={1.5}
                  className="text-[#b45309] shrink-0 mt-0.5"
                />
                <div>
                  <div className="text-[13px] font-medium text-[#171717]">
                    선택된 대회가 없습니다
                  </div>
                  <div className="text-xs text-[#525252] mt-0.5">
                    대회를 선택하면 종목별 및 공통 음악 목록이 표시됩니다
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderTrackGroupCard({
                title: "시상식 음악",
                typeKey: "awards",
                list: awardsMusic,
              })}

              {renderTrackGroupCard({
                title: "점수 공개 음악",
                typeKey: "result",
                list: resultAnnouncementTracks,
              })}

              {renderTrackGroupCard({
                title: "대기 음악",
                typeKey: "waiting",
                list: waitingTracks,
              })}

              {renderTrackGroupCard({
                title: `${categoryTitle || "현재 종목"} 입장 음악`,
                typeKey: "entry",
                list: entryTracks,
                collapsible: true,
                expanded: showEntryTracks,
                onToggleExpand: () => setShowEntryTracks(!showEntryTracks),
              })}

              {renderTrackGroupCard({
                title: "라인업 음악",
                typeKey: "lineup",
                list: lineupTracks,
                collapsible: true,
                expanded: showLineupTracks,
                onToggleExpand: () => setShowLineupTracks(!showLineupTracks),
              })}

              {renderTrackGroupCard({
                title: "포즈다운 음악",
                typeKey: "posedown",
                list: poseDownTracks,
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <audio
        ref={audioRef}
        onEnded={handleNextTrack}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setTrackDuration(audioRef.current.duration || 0);
            setCurrentTime(0);
          }
        }}
        controls={false}
      />
      {renderMainView()}
    </>
  );
}
