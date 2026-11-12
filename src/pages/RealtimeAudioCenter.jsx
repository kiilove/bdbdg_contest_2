"use client";

import React, { useEffect, useState, useContext, useRef } from "react";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  Layout,
  Card,
  List,
  Typography,
  Space,
  Spin,
  Alert,
  Button,
  Slider,
  Row,
  Col,
  message,
  Switch,
} from "antd";
import { where, collection, getDocs } from "firebase/firestore";
import { db, database } from "../firebase";
import { UpOutlined, DownOutlined, CloudSyncOutlined } from "@ant-design/icons";
import { ref, set } from "firebase/database";

const { Title } = Typography;
const { Sider, Content } = Layout;

export default function RealtimeAudioCenter() {
  const { currentContest } = useContext(CurrentContestContext);

  const [contestPlayList, setContestPlayList] = useState(null);
  const [trackPlayList, setTrackPlayList] = useState([]);
  const [tracks, setTracks] = useState([]);

  // 카테고리별 트랙
  const [entryTracks, setEntryTracks] = useState([]);
  const [lineupTracks, setLineupTracks] = useState([]);
  const [poseDownTracks, setPoseDownTracks] = useState([]);

  // 공통 트랙
  const [awardsMusic, setAwardsMusic] = useState([]);
  const [resultAnnouncementTracks, setResultAnnouncementTracks] = useState([]);
  const [waitingTracks, setWaitingTracks] = useState([]);

  // 오디오 플레이어 상태
  const [audioPlaylist, setAudioPlaylist] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [currentPlaylistType, setCurrentPlaylistType] = useState(null);

  // ✅ Volume 상태
  const [volume, setVolume] = useState(1);

  const [showEntryTracks, setShowEntryTracks] = useState(false);
  const [showLineupTracks, setShowLineupTracks] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  // ✅ Remote Sync 상태
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

  // ✅ nowPlaying 구독 (VibeFlow Remote 명세)
  const { data: nowPlaying } = useFirebaseRealtimeGetDocument("nowPlaying");

  useEffect(() => {
    if (!nowPlaying || !audioRef.current || !isRemoteSync) return;

    const { downloadURL, status, selectedAt } = nowPlaying;
    if (!downloadURL && status !== "stop") return;

    // 이미 처리한 타임스탬프이고 상태도 같은 경우 무시
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

    // 새로운 곡이거나 강제 재시작 타임스탬프인 경우
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
          message.warning("원격 재생이 차단되었습니다. 수동으로 재생을 눌러주세요.")
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

  // ✅ Remote Control 업데이트 함수
  const updateRemoteControl = (track, status) => {
    if (!isRemoteSync || !track) return;
    const timestamp = Date.now();
    setLastProcessedSelectedAt(timestamp);

    const data = {
      fileName: track.name || track.fileName || "Unknown",
      filePath: track.path || track.filePath || "",
      downloadURL: track.url || track.path || track.downloadURL || track.fileUrl || "",
      selectedAt: timestamp,
      status: status,
    };
    set(ref(database, "nowPlaying"), data);
  };

  // =============================
  // Firestore 데이터 로드
  // =============================
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

  // ✅ 음악 분류 (공통)
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

  // ✅ 음악 분류 (카테고리별)
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

  // =============================
  // 오디오 관련
  // =============================

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
      message.error("URL이 존재하지 않습니다.");
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
        message.warning("재생이 차단되었습니다. 수동으로 재생을 눌러주세요.")
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
    if (!list?.length) return message.info("트랙이 없습니다.");
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
          message.warning("재생이 차단되었습니다. 수동으로 재생을 눌러주세요.")
        );
    }
  };

  const handleSliderChange = (value) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
    if (!audioRef.current.paused) startTracking();
  };

  // ✅ Volume 컨트롤 함수
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

  const renderMainView = () => {
    if (realtimeLoading || isDataLoading) return <Spin tip="Loading..." />;
    if (realtimeError || dataError) {
      return (
        <Alert
          message="Error"
          description={
            (realtimeError || dataError)?.message ||
            "데이터 로드 중 오류가 발생했습니다."
          }
          type="error"
          showIcon
        />
      );
    }

    return (
      <Layout style={{ height: "100vh" }}>
        {/* ─────────────────────────────────────────────── */}
        {/* LEFT: Audio Player */}
        {/* ─────────────────────────────────────────────── */}

        <Sider
          width="30%"
          style={{
            backgroundColor: "#1a1a1a",
            padding: "20px",
            color: "white",
          }}
        >
          <Title level={4} style={{ color: "#fff", marginBottom: 16 }}>
            🎧 Audio Player
          </Title>

        {/* ✅ Remote Sync Toggle */}
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#fff" }}><CloudSyncOutlined /> Remote Sync</span>
          <Switch 
            checked={isRemoteSync} 
            onChange={(val) => setIsRemoteSync(val)} 
            size="small"
          />
        </div>

        {/* ✅ Volume Control */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: "#fff", marginBottom: 6 }}>🔊 Volume</div>

          <Slider
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            tooltipVisible={false}
          />

          <div
            style={{
              marginTop: 8,
              width: "100%",
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 4,
            }}
          >
            <Button size="small" onClick={() => setQuickVolume(0)}>
              0
            </Button>
            <Button size="small" onClick={() => setQuickVolume(0.1)}>
              10
            </Button>
            <Button size="small" type="dashed" onClick={() => setQuickVolume(0.2)}>
              20
            </Button>
            <Button size="small" onClick={() => setQuickVolume(0.5)}>
              50
            </Button>
            <Button size="small" onClick={() => setQuickVolume(0.8)}>
              80
            </Button>
            <Button size="small" type="primary" onClick={() => setQuickVolume(1)}>
              100
            </Button>
          </div>
        </div>

        {/* ✅ Playlist (현재 재생 목록) */}
        <List
          dataSource={audioPlaylist}
          renderItem={(track, i) => (
            <List.Item
              onClick={() => {
                setCurrentTrackIndex(i);
                playTrack(track);
              }}
              style={{
                cursor: "pointer",
                backgroundColor:
                  i === currentTrackIndex
                    ? "rgba(24,144,255,0.3)"
                    : "transparent",
                color: "white",
                borderRadius: 6,
              }}
            >
              {i === currentTrackIndex ? "▶️ " : ""}
              {track.name}
            </List.Item>
          )}
        />

        {/* ✅ 현재 트랙 컨트롤 UI */}
        {audioPlaylist.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ color: "#fff", marginBottom: 10 }}>
              {audioPlaylist[currentTrackIndex]?.name}
            </div>

            <Button
              type="primary"
              onClick={handlePlayPause}
              style={{ width: "100%", marginBottom: 10 }}
            >
              {isPlaying ? "⏸ 일시정지" : "▶️ 재생"}
            </Button>

            <Slider
              min={0}
              max={trackDuration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleSliderChange}
              tooltipVisible={false}
            />

            <div style={{ color: "#aaa", textAlign: "center", fontSize: 12 }}>
              {`${Math.floor(currentTime / 60)
                .toString()
                .padStart(2, "0")}:${Math.floor(currentTime % 60)
                .toString()
                .padStart(2, "0")} / ${Math.floor(trackDuration / 60)
                .toString()
                .padStart(2, "0")}:${Math.floor(trackDuration % 60)
                .toString()
                .padStart(2, "0")}`}
            </div>
          </div>
        )}
      </Sider>

      {/* ─────────────────────────────────────────────── */}
      {/* RIGHT: Music List UI */}
      {/* ─────────────────────────────────────────────── */}

      <Content style={{ padding: 20, overflowY: "auto" }}>
        {!contestId && (
          <Alert
            style={{ marginBottom: 16 }}
            message="선택된 대회가 없습니다"
            description="대회를 선택하면 종목별/공통 음악 목록이 표시됩니다."
            type="warning"
            showIcon
          />
        )}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Card
              title="🏆 시상식 음악"
              extra={
                <Button
                  onClick={() =>
                    handleAddAllToPlaylistAndPlay(awardsMusic, "awards")
                  }
                >
                  전체 재생
                </Button>
              }
            >
              <List
                dataSource={awardsMusic}
                renderItem={(track) => (
                  <List.Item
                    onClick={() => handlePlaySingleTrack(track, "awards")}
                    style={{ cursor: "pointer" }}
                  >
                    {track.name}
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12}>
            <Card
              title="📊 점수공개 음악"
              extra={
                <Button
                  onClick={() =>
                    handleAddAllToPlaylistAndPlay(
                      resultAnnouncementTracks,
                      "result"
                    )
                  }
                >
                  전체 재생
                </Button>
              }
            >
              <List
                dataSource={resultAnnouncementTracks}
                renderItem={(track) => (
                  <List.Item
                    onClick={() => handlePlaySingleTrack(track, "result")}
                    style={{ cursor: "pointer" }}
                  >
                    {track.name}
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12}>
            <Card
              title="⏳ 대기 음악"
              extra={
                <Button
                  onClick={() =>
                    handleAddAllToPlaylistAndPlay(waitingTracks, "waiting")
                  }
                >
                  전체 재생
                </Button>
              }
            >
              <List
                dataSource={waitingTracks}
                renderItem={(track) => (
                  <List.Item
                    onClick={() => handlePlaySingleTrack(track, "waiting")}
                    style={{ cursor: "pointer" }}
                  >
                    {track.name}
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12}>
            <Card
              title={`${categoryTitle || "현재 종목"} - 입장 음악`}
              extra={
                <Space>
                  <Button
                    icon={showEntryTracks ? <UpOutlined /> : <DownOutlined />}
                    onClick={() => setShowEntryTracks(!showEntryTracks)}
                  />
                  <Button
                    onClick={() =>
                      handleAddAllToPlaylistAndPlay(entryTracks, "entry")
                    }
                  >
                    전체 재생
                  </Button>
                </Space>
              }
            >
              {showEntryTracks && (
                <List
                  dataSource={entryTracks}
                  renderItem={(track) => (
                    <List.Item
                      onClick={() => handlePlaySingleTrack(track, "entry")}
                      style={{ cursor: "pointer" }}
                    >
                      {track.name}
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} sm={12}>
            <Card
              title="📋 라인업 음악"
              extra={
                <Space>
                  <Button
                    icon={showLineupTracks ? <UpOutlined /> : <DownOutlined />}
                    onClick={() => setShowLineupTracks(!showLineupTracks)}
                  />
                  <Button
                    onClick={() =>
                      handleAddAllToPlaylistAndPlay(lineupTracks, "lineup")
                    }
                  >
                    전체 재생
                  </Button>
                </Space>
              }
            >
              {showLineupTracks && (
                <List
                  dataSource={lineupTracks}
                  renderItem={(track) => (
                    <List.Item
                      onClick={() => handlePlaySingleTrack(track, "lineup")}
                      style={{ cursor: "pointer" }}
                    >
                      {track.name}
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} sm={12}>
            <Card
              title="🔥 포즈다운 음악"
              extra={
                <Button
                  onClick={() =>
                    handleAddAllToPlaylistAndPlay(poseDownTracks, "posedown")
                  }
                >
                  전체 재생
                </Button>
              }
            >
              <List
                dataSource={poseDownTracks}
                renderItem={(track) => (
                  <List.Item
                    onClick={() => handlePlaySingleTrack(track, "posedown")}
                    style={{ cursor: "pointer" }}
                  >
                    {track.name}
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
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
