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
} from "antd";
import { where, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { UpOutlined, DownOutlined } from "@ant-design/icons";

const { Title } = Typography;
const { Sider, Content } = Layout;

export default function RealtimeAudioCenter() {
  const { currentContest } = useContext(CurrentContestContext);
  const [contestPlayList, setContestPlayList] = useState([]);
  const [trackPlayList, setTrackPlayList] = useState([]);
  const [tracks, setTracks] = useState([]);

  // 카테고리별
  const [entryTracks, setEntryTracks] = useState([]);
  const [lineupTracks, setLineupTracks] = useState([]);
  const [poseDownTracks, setPoseDownTracks] = useState([]);

  // 공통
  const [awardsMusic, setAwardsMusic] = useState([]);
  const [resultAnnouncementTracks, setResultAnnouncementTracks] = useState([]);
  const [waitingTracks, setWaitingTracks] = useState([]);

  // 오디오 관련 상태
  const [audioPlaylist, setAudioPlaylist] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [currentPlaylistType, setCurrentPlaylistType] = useState(null);

  // 기타
  const [showEntryTracks, setShowEntryTracks] = useState(false);
  const [showLineupTracks, setShowLineupTracks] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  const audioRef = useRef(null);
  const rafRef = useRef(null); // requestAnimationFrame ref (재생 시간 업데이트용)
  const categoryQuery = useFirestoreQuery();
  const trackPlayListQuery = useFirestoreQuery();

  const contestId = currentContest?.contests?.id;

  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );

  const categoryId = realtimeData?.categoryId;
  const categoryTitle = realtimeData?.categoryTitle;

  // =============================
  // Firestore 데이터 로드
  // =============================
  useEffect(() => {
    async function fetchData() {
      if (!contestId) return;
      setIsDataLoading(true);

      try {
        const condition = [where("contestId", "==", contestId)];
        const playListData = await categoryQuery.getDocuments(
          "contest_music_settings",
          condition
        );
        const trackPlayListData = await trackPlayListQuery.getDocuments(
          "track_play_list"
        );

        const allTracks = [];
        for (const playlist of trackPlayListData) {
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

        console.log("📀 playlists:", trackPlayListData.length);
        console.log("🎵 tracks:", allTracks.length);

        setContestPlayList(playListData[0]);
        setTrackPlayList(trackPlayListData);
        setTracks(allTracks);
      } catch (err) {
        console.error("❌ Firestore fetch error:", err);
        setDataError(err);
      } finally {
        setIsDataLoading(false);
      }
    }

    fetchData();
  }, [contestId]);

  // =============================
  // 공통 음악 및 카테고리별 음악 설정
  // (기존 로직 유지)
  // =============================
  useEffect(() => {
    if (!contestPlayList?.id || !tracks.length) return;
    const setList = (id, setter) => {
      if (!id) return setter([]);
      const list = tracks
        .filter((t) => t.playlistId === id)
        .sort((a, b) => (a.playIndex || 0) - (b.playIndex || 0));
      setter(list);
    };

    setList(contestPlayList?.commonMusic?.awardsMusic, setAwardsMusic);
    setList(
      contestPlayList?.commonMusic?.resultAnnouncementMusic,
      setResultAnnouncementTracks
    );
    setList(contestPlayList?.commonMusic?.waitingMusic, setWaitingTracks);
  }, [contestPlayList, tracks]);

  useEffect(() => {
    if (!categoryId || !contestPlayList?.id || !tracks.length) return;
    const categoryCfg = contestPlayList.categoryMusic.find(
      (f) => f.contestCategoryId === categoryId
    );
    if (!categoryCfg) return;

    const setList = (id, setter) => {
      if (!id) return setter([]);
      const list = tracks
        .filter((t) => t.playlistId === id)
        .sort((a, b) => (a.playIndex || 0) - (b.playIndex || 0));
      setter(list);
    };

    setList(categoryCfg.entryPlaylistId, setEntryTracks);
    setList(categoryCfg.lineupPlaylistId, setLineupTracks);
    setList(categoryCfg.poseDownPlaylistId, setPoseDownTracks);
  }, [categoryId, contestPlayList, tracks]);

  // =============================
  // 오디오 컨트롤 로직 (핵심 수정 부분)
  // =============================

  // 🔥 requestAnimationFrame으로 재생 시간 추적 시작
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

  const stopTracking = () => {
    cancelAnimationFrame(rafRef.current);
  };

  const playTrack = async (track) => {
    if (!audioRef.current) return;
    // 트랙 데이터에서 URL 가져오기 (제공된 문서 형식에 맞춤)
    const playableURL =
      track.url || track.path || track.downloadURL || track.fileUrl || null;

    if (!playableURL) {
      message.error("URL이 존재하지 않습니다.");
      return;
    }

    try {
      console.log("🎵 재생 시도:", track.name);
      console.log("➡️ URL:", playableURL);

      // 1. 기존 재생 정지 및 초기화
      stopTracking();
      audioRef.current.pause();
      audioRef.current.currentTime = 0; // 재생 위치 초기화

      // 2. 새로운 src 설정 (load() 불필요, src만 변경)
      audioRef.current.src = playableURL;
      audioRef.current.volume = 1;
      audioRef.current.muted = false;

      // 3. 🔥 재생 시작 시도 (Promise 기반으로 자동재생 차단 처리)
      // 브라우저가 src를 로드할 시간을 주기 위해 setTimeout을 사용하는 것은 제거했습니다.
      // play()를 호출하면 브라우저가 로드를 시작합니다.
      const playPromise = audioRef.current.play();

      if (playPromise) {
        playPromise
          .then(() => {
            // 재생 성공
            console.log("▶️ 재생 시작:", track.name);
            setIsPlaying(true);
            startTracking(); // 슬라이더 갱신 시작
          })
          .catch((err) => {
            // 재생 실패 (대부분 브라우저의 자동재생 차단 정책)
            console.warn("🚫 자동재생 차단 또는 재생 오류:", err);
            setIsPlaying(false);
            message.warning(
              "브라우저 자동재생이 차단되었습니다. 수동으로 재생 버튼을 눌러주세요."
            );
          });
      }
    } catch (e) {
      console.error("🎧 재생 오류:", e);
      setIsPlaying(false);
    }
  };

  const handlePlaySingleTrack = (track, type) => {
    setCurrentPlaylistType(type);
    setAudioPlaylist([track]);
    setCurrentTrackIndex(0);
    playTrack(track);
  };

  const handleAddAllToPlaylistAndPlay = (list, type) => {
    if (!list?.length) {
      message.info("트랙이 없습니다.");
      return;
    }
    setCurrentPlaylistType(type);
    setAudioPlaylist(list);
    setCurrentTrackIndex(0);
    playTrack(list[0]);
  };

  // 🔥 nextTrack 로직은 audio 태그의 onEnded로 처리됨
  const handleNextTrack = () => {
    if (!audioPlaylist.length) return;
    const nextIndex = currentTrackIndex + 1;

    if (nextIndex < audioPlaylist.length) {
      // 다음 트랙이 있으면 재생
      setCurrentTrackIndex(nextIndex);
      playTrack(audioPlaylist[nextIndex]);
    } else {
      // 플레이리스트 끝 (반복 재생이 아니라면 정지)
      setIsPlaying(false);
      stopTracking();
      setCurrentTrackIndex(0); // 처음으로 돌아가기
      message.info("플레이리스트 재생이 완료되었습니다.");
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopTracking();
    } else {
      // pause 상태일 때 play를 시도
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          startTracking();
        })
        .catch((e) => {
          console.warn("🚫 재생 차단됨:", e);
          message.warning("재생이 차단되었습니다. URL이 유효한지 확인하세요.");
        });
    }
  };

  const handleSliderChange = (value) => {
    if (!audioRef.current) return;
    // 슬라이더 조작 중에는 RAF를 일시 정지하지 않고,
    // 오디오의 currentTime을 업데이트하고 다시 RAF를 시작합니다.
    audioRef.current.currentTime = value;
    setCurrentTime(value);
    // 슬라이더 이동 후 재생 중이라면, 트래킹을 계속 시작합니다.
    if (!audioRef.current.paused) {
      startTracking();
    }
  };

  // Cleanup requestAnimationFrame on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // =============================
  // 렌더링
  // =============================
  if (realtimeLoading || isDataLoading) return <Spin tip="Loading..." />;
  if (realtimeError || dataError)
    return (
      <Alert
        message="Error"
        description={(realtimeError || dataError).message}
        type="error"
        showIcon
      />
    );

  return (
    <Layout style={{ height: "100vh" }}>
      <Sider
        width="30%"
        style={{
          backgroundColor: "#1a1a1a",
          padding: "20px",
          color: "white",
        }}
      >
        {/* 🔥 오디오 엘리먼트 수정 */}
        <audio
          ref={audioRef}
          onEnded={handleNextTrack}
          onLoadedMetadata={() => {
            // 메타데이터 로드 시 (트랙 길이)
            const d = audioRef.current.duration || 0;
            setTrackDuration(d);
            setCurrentTime(0); // 새 트랙 로드 시 0초로 초기화
          }}
          controls={false} // UI 컴포넌트로 대체
          volume={1}
          muted={false}
          style={{ display: "none" }}
        />
        <Title level={4} style={{ color: "#fff", marginBottom: 20 }}>
          🎧 Audio Player
        </Title>

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
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: i === currentTrackIndex ? "600" : "400",
                  }}
                >
                  {i === currentTrackIndex ? "▶️ " : ""}
                  {track.name}
                </div>
                <div style={{ fontSize: 12, color: "#aaa" }}>
                  {track.fullPath}
                </div>
              </div>
            </List.Item>
          )}
        />

        {audioPlaylist.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                marginBottom: 10,
                fontSize: 16,
                fontWeight: 600,
                color: "#fff",
              }}
            >
              {audioPlaylist[currentTrackIndex]?.name || "트랙 이름 없음"}
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
              step={0.1} // 더 부드러운 조작을 위해 step 설정
              value={currentTime}
              onChange={handleSliderChange}
              tooltipVisible={false}
              trackStyle={{ backgroundColor: "#1890ff", height: "4px" }}
              railStyle={{
                backgroundColor: "rgba(255,255,255,0.1)",
                height: "4px",
              }}
            />
            <div
              style={{
                color: "#aaa",
                fontSize: 12,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              {/* 시간을 MM:SS 형식으로 포맷팅 */}
              {`${Math.floor(currentTime / 60)
                .toString()
                .padStart(2, "0")}:${Math.floor(currentTime % 60)
                .toString()
                .padStart(2, "0")}s / ${Math.floor(trackDuration / 60)
                .toString()
                .padStart(2, "0")}:${Math.floor(trackDuration % 60)
                .toString()
                .padStart(2, "0")}s`}
            </div>
          </div>
        )}
      </Sider>

      {/* Content 영역은 변경 없음 */}
      <Content style={{ padding: 20, overflowY: "auto" }}>
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
              title={`${categoryTitle} - 입장 음악`}
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
              title="포즈다운 음악"
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
}
