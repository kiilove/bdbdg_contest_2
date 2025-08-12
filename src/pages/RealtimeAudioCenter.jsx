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
} from "antd";
import { where } from "firebase/firestore";
import { UpOutlined, DownOutlined } from "@ant-design/icons";

const { Title } = Typography;
const { Sider, Content } = Layout;

const RealtimeAudioCenter = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [contestPlayList, setContestPlayList] = useState([]);
  const [currentCategoryPlayList, setCurrentCategoryPlayList] = useState([]);
  const [trackPlayList, setTrackPlayList] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [entryTracks, setEntryTracks] = useState([]);
  const [lineupTracks, setLineupTracks] = useState([]);
  const [poseDownTracks, setPoseDownTracks] = useState([]);

  // 추가된 상태들
  const [awardsMusic, setAwardsMusic] = useState([]);
  const [resultAnnouncementTracks, setResultAnnouncementTracks] = useState([]);
  const [waitingTracks, setWaitingTracks] = useState([]);

  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [audioPlaylist, setAudioPlaylist] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentPlaylistType, setCurrentPlaylistType] = useState(null);
  const [lastPlayedPositions, setLastPlayedPositions] = useState({
    entry: { lastIndex: 0, positions: {} },
    lineup: { lastIndex: 0, positions: {} },
    // poseDown은 마지막 재생 위치를 저장하지 않으므로 제거
  });

  // 트랙 리스트 표시 상태
  const [showEntryTracks, setShowEntryTracks] = useState(false);
  const [showLineupTracks, setShowLineupTracks] = useState(false);

  const audioRef = useRef(null);
  const categoryQuery = useFirestoreQuery();
  const trackPlayListQuery = useFirestoreQuery();
  const tracksQuery = useFirestoreQuery();

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

  useEffect(() => {
    async function fetchData() {
      if (!contestId) {
        console.warn("Contest ID is not available.");
        return;
      }

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
        const tracksData = await tracksQuery.getDocuments("tracks");
        setContestPlayList(playListData[0]);
        setTrackPlayList(trackPlayListData);
        setTracks(tracksData);
      } catch (error) {
        console.error("Error fetching data:", error);
        setDataError(error);
      } finally {
        setIsDataLoading(false);
      }
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId]);

  useEffect(() => {
    if (contestPlayList?.id && trackPlayList?.length > 0) {
      // 공통 음악 처리
      const processCommonMusic = (playlistId, setterFunction) => {
        const filteredList = trackPlayList.filter((f) => f.id === playlistId);
        if (filteredList[0]?.tracks.length > 0) {
          const processedTracks = filteredList[0].tracks
            .map((track) => tracks.find((f) => f.id === track.id))
            .filter(Boolean);
          setterFunction(processedTracks);
        } else {
          setterFunction([]);
        }
      };

      processCommonMusic(
        contestPlayList?.commonMusic?.awardsMusic,
        setAwardsMusic
      );
      processCommonMusic(
        contestPlayList?.commonMusic?.resultAnnouncementMusic,
        setResultAnnouncementTracks
      );
      processCommonMusic(
        contestPlayList?.commonMusic?.waitingMusic,
        setWaitingTracks
      );
    }
  }, [contestPlayList, trackPlayList, tracks]);

  useEffect(() => {
    if (categoryId && contestPlayList?.id && trackPlayList?.length > 0) {
      const filterCategoryPlayList = contestPlayList.categoryMusic.filter(
        (f) => f.contestCategoryId === categoryId
      );

      if (filterCategoryPlayList.length > 0) {
        const currentCategory = filterCategoryPlayList[0];
        setCurrentCategoryPlayList(currentCategory);

        const processPlaylist = (playlistId, setterFunction) => {
          const filteredList = trackPlayList.filter((f) => f.id === playlistId);
          if (filteredList[0]?.tracks.length > 0) {
            const processedTracks = filteredList[0].tracks
              .map((track) => tracks.find((f) => f.id === track.id))
              .filter(Boolean);
            setterFunction(processedTracks);
          } else {
            setterFunction([]);
          }
        };

        processPlaylist(currentCategory.entryPlaylistId, setEntryTracks);
        processPlaylist(currentCategory.lineupPlaylistId, setLineupTracks);
        processPlaylist(currentCategory.poseDownPlaylistId, setPoseDownTracks);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, contestPlayList, trackPlayList, tracks]);

  const saveCurrentPosition = () => {
    if (
      audioPlaylist.length > 0 &&
      audioPlaylist[currentTrackIndex] &&
      currentPlaylistType &&
      lastPlayedPositions[currentPlaylistType]
    ) {
      // 포즈다운이 아닐 때만 저장
      if (currentPlaylistType !== "poseDown") {
        const currentTrack = audioPlaylist[currentTrackIndex];
        const currentTime = audioRef.current?.currentTime || 0;
        const endTime =
          currentTrack.endTime ??
          currentTrack.duration ??
          currentTrack.playingTime;

        if (currentTime < endTime) {
          setLastPlayedPositions((prevPositions) => ({
            ...prevPositions,
            [currentPlaylistType]: {
              ...prevPositions[currentPlaylistType],
              lastIndex: currentTrackIndex,
              positions: {
                ...prevPositions[currentPlaylistType].positions,
                [currentTrack.id]: currentTime,
              },
            },
          }));
        }
      }
    }
  };

  const handlePlaySingleTrack = (track, type) => {
    if (currentPlaylistType && currentPlaylistType !== type) {
      saveCurrentPosition();
    }

    setCurrentPlaylistType(type);
    setAudioPlaylist([
      {
        ...track,
        startTime: track.startTime ?? 0,
        endTime: track.endTime ?? track.duration ?? track.playingTime ?? 0,
      },
    ]);
    setCurrentTrackIndex(0);
    setIsPlaying(true);
  };

  const handleAddAllToPlaylistAndPlay = (tracks, type) => {
    if (currentPlaylistType && currentPlaylistType !== type) {
      saveCurrentPosition();
    }

    const lastPlayedPosition = lastPlayedPositions[type];
    const startIndex = lastPlayedPosition?.lastIndex || 0;

    const updatedTracks = tracks.map((track) => ({
      ...track,
      startTime: track.startTime ?? 0,
      endTime: track.endTime ?? track.duration ?? track.playingTime ?? 0,
    }));

    setCurrentPlaylistType(type);
    setAudioPlaylist(updatedTracks);
    setCurrentTrackIndex(startIndex);
    setIsPlaying(true);
  };

  const playTrack = (track) => {
    if (!audioRef.current) return;

    // 시작 시간을 결정
    let startTime = track.startTime ?? 0;

    // 포즈다운과 공통 음악들은 항상 startTime에서 시작
    if (
      currentPlaylistType !== "poseDown" &&
      currentPlaylistType !== "common" &&
      currentPlaylistType !== "resultAnnouncement" &&
      currentPlaylistType !== "waiting"
    ) {
      const lastPlayedPosition =
        lastPlayedPositions[currentPlaylistType]?.positions[track.id];

      if (lastPlayedPosition !== undefined) {
        startTime = lastPlayedPosition;
      }
    }

    setIsPlaying(true);
    audioRef.current.src = track.path;
    audioRef.current.load();
    audioRef.current.onloadeddata = () => {
      audioRef.current.currentTime = startTime;
      audioRef.current
        .play()
        .catch((error) => console.error("Play error:", error));
    };
  };

  useEffect(() => {
    if (audioPlaylist.length > 0 && currentTrackIndex < audioPlaylist.length) {
      playTrack(audioPlaylist[currentTrackIndex]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioPlaylist, currentTrackIndex]);

  const clearPreviousTrackPosition = (prevIndex) => {
    if (
      currentPlaylistType &&
      audioPlaylist[prevIndex] &&
      currentPlaylistType !== "poseDown" &&
      currentPlaylistType !== "common" &&
      currentPlaylistType !== "resultAnnouncement" &&
      currentPlaylistType !== "waiting"
    ) {
      const prevTrack = audioPlaylist[prevIndex];
      setLastPlayedPositions((prevPositions) => ({
        ...prevPositions,
        [currentPlaylistType]: {
          ...prevPositions[currentPlaylistType],
          positions: {
            ...prevPositions[currentPlaylistType].positions,
            [prevTrack.id]: 0,
          },
        },
      }));
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      saveCurrentPosition();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleNextTrack = () => {
    const currentIndex = currentTrackIndex;
    setCurrentTrackIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;
      if (nextIndex < audioPlaylist.length) {
        clearPreviousTrackPosition(currentIndex);
        return nextIndex;
      } else {
        // 마지막 트랙인 경우 첫 번째 트랙으로 돌아감
        clearPreviousTrackPosition(currentIndex);
        return 0;
      }
    });
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioPlaylist[currentTrackIndex]) {
      const currentTime = audioRef.current.currentTime;
      const currentTrack = audioPlaylist[currentTrackIndex];
      setCurrentTime(currentTime);

      const endTime = parseFloat(
        currentTrack.endTime ??
          currentTrack.duration ??
          currentTrack.playingTime
      );

      if (endTime && currentTime >= endTime) {
        handleNextTrack();
      }
    }
  };

  const handleSliderChange = (value) => {
    if (audioRef.current && audioPlaylist[currentTrackIndex]) {
      audioRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  const handlePlaylistClick = (index) => {
    clearPreviousTrackPosition(currentTrackIndex);
    setCurrentTrackIndex(index);
  };

  useEffect(() => {
    return () => {
      saveCurrentPosition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          boxShadow: "2px 0 8px rgba(0,0,0,0.15)",
        }}
      >
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleNextTrack}
        />
        <div className="audio-player-container" style={{ height: "100%" }}>
          <Title
            level={4}
            style={{
              color: "#ffffff",
              marginBottom: "24px",
              textAlign: "center",
              fontSize: "24px",
              fontWeight: "600",
            }}
          >
            Audio Player
          </Title>

          <div
            className="playlist-container"
            style={{
              marginBottom: "20px",
              maxHeight: "calc(100vh - 250px)",
              overflowY: "auto",
              borderRadius: "8px",
              backgroundColor: "rgba(255,255,255,0.05)",
              padding: "10px",
            }}
          >
            <List
              dataSource={audioPlaylist}
              renderItem={(track, index) => (
                <List.Item
                  onClick={() => handlePlaylistClick(index)}
                  style={{
                    color: "white",
                    cursor: "pointer",
                    backgroundColor:
                      index === currentTrackIndex
                        ? "rgba(24,144,255,0.3)"
                        : "transparent",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    marginBottom: "4px",
                    transition: "all 0.3s ease",
                    border: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        minWidth: "24px",
                        marginRight: "12px",
                        color: index === currentTrackIndex ? "#1890ff" : "#888",
                      }}
                    >
                      {index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight:
                            index === currentTrackIndex ? "600" : "normal",
                        }}
                      >
                        {track.title}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#888",
                          marginTop: "4px",
                        }}
                      >
                        {track.language}
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </div>

          {audioPlaylist[currentTrackIndex] && (
            <div
              className="player-controls"
              style={{
                padding: "20px",
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: "12px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              }}
            >
              <Button
                onClick={handlePlayPause}
                type="primary"
                size="large"
                style={{
                  width: "100%",
                  height: "48px",
                  marginBottom: "20px",
                  borderRadius: "8px",
                  fontSize: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isPlaying ? "#1890ff" : "#40a9ff",
                }}
              >
                {isPlaying ? "일시정지" : "재생"}
              </Button>

              <div
                style={{
                  marginBottom: "8px",
                  color: "#888",
                  fontSize: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{Math.floor(currentTime)}초</span>
                <span>
                  {Math.floor(audioPlaylist[currentTrackIndex].endTime)}초
                </span>
              </div>

              <Slider
                min={audioPlaylist[currentTrackIndex].startTime || 0}
                max={audioPlaylist[currentTrackIndex].endTime || 100}
                value={currentTime}
                onChange={handleSliderChange}
                tooltipVisible={false}
                style={{ width: "100%" }}
                trackStyle={{ backgroundColor: "#1890ff", height: "4px" }}
                railStyle={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  height: "4px",
                }}
                handleStyle={{
                  borderColor: "#1890ff",
                  backgroundColor: "#fff",
                  width: "12px",
                  height: "12px",
                  marginTop: "-4px",
                }}
              />
            </div>
          )}
        </div>
      </Sider>

      <Content style={{ padding: "20px", overflowY: "auto" }}>
        <Row gutter={[16, 16]}>
          {/* 시상식 */}
          <Col xs={24} sm={12}>
            <Card
              title="시상식 음악"
              bordered
              extra={
                <Button
                  onClick={() =>
                    handleAddAllToPlaylistAndPlay(awardsMusic, "common")
                  }
                  style={{ width: "100px", height: "40px" }}
                >
                  리스트 재생
                </Button>
              }
            >
              <List
                dataSource={awardsMusic}
                renderItem={(track) => (
                  <List.Item
                    onClick={() => handlePlaySingleTrack(track, "common")}
                    style={{
                      backgroundColor:
                        currentPlaylistType === "common" &&
                        track.id === audioPlaylist[currentTrackIndex]?.id
                          ? "#e6f7ff"
                          : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <List.Item.Meta
                      title={`제목: ${track?.title}`}
                      description={`언어: ${track?.language}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          {/* 점수공개 */}
          <Col xs={24} sm={12}>
            <Card
              title="점수공개 음악"
              bordered
              extra={
                <Button
                  onClick={() =>
                    handleAddAllToPlaylistAndPlay(
                      resultAnnouncementTracks,
                      "resultAnnouncement"
                    )
                  }
                  style={{ width: "100px", height: "40px" }}
                >
                  리스트 재생
                </Button>
              }
            >
              <List
                dataSource={resultAnnouncementTracks}
                renderItem={(track) => (
                  <List.Item
                    onClick={() =>
                      handlePlaySingleTrack(track, "resultAnnouncement")
                    }
                    style={{
                      backgroundColor:
                        currentPlaylistType === "resultAnnouncement" &&
                        track.id === audioPlaylist[currentTrackIndex]?.id
                          ? "#e6f7ff"
                          : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <List.Item.Meta
                      title={`제목: ${track?.title}`}
                      description={`언어: ${track?.language}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          {/* 대기 */}
          <Col xs={24} sm={12}>
            <Card
              title="대기 음악"
              bordered
              extra={
                <Button
                  onClick={() =>
                    handleAddAllToPlaylistAndPlay(waitingTracks, "waiting")
                  }
                  style={{ width: "100px", height: "40px" }}
                >
                  리스트 재생
                </Button>
              }
            >
              <List
                dataSource={waitingTracks}
                renderItem={(track) => (
                  <List.Item
                    onClick={() => handlePlaySingleTrack(track, "waiting")}
                    style={{
                      backgroundColor:
                        currentPlaylistType === "waiting" &&
                        track.id === audioPlaylist[currentTrackIndex]?.id
                          ? "#e6f7ff"
                          : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <List.Item.Meta
                      title={`제목: ${track?.title}`}
                      description={`언어: ${track?.language}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          {/* 포즈다운 */}
          <Col xs={24} sm={12}>
            <Card
              title={`${categoryTitle} - 포즈다운 음악`}
              bordered
              extra={
                <Button
                  onClick={() =>
                    handleAddAllToPlaylistAndPlay(poseDownTracks, "poseDown")
                  }
                  style={{ width: "100px", height: "40px" }}
                >
                  리스트 재생
                </Button>
              }
            >
              <List
                dataSource={poseDownTracks}
                renderItem={(track) => (
                  <List.Item
                    onClick={() => handlePlaySingleTrack(track, "poseDown")}
                    style={{
                      backgroundColor:
                        currentPlaylistType === "poseDown" &&
                        track.id === audioPlaylist[currentTrackIndex]?.id
                          ? "#e6f7ff"
                          : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <List.Item.Meta
                      title={`제목: ${track?.title}`}
                      description={`언어: ${track?.language}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          {/* 입장 음악 */}
          <Col xs={24} sm={12}>
            <Card
              title={`${categoryTitle} - 입장 음악`}
              bordered
              extra={
                <Space>
                  <Button
                    onClick={() => setShowEntryTracks(!showEntryTracks)}
                    icon={showEntryTracks ? <UpOutlined /> : <DownOutlined />}
                    shape="circle"
                  />
                  <Button
                    onClick={() =>
                      handleAddAllToPlaylistAndPlay(entryTracks, "entry")
                    }
                    style={{ width: "100px", height: "40px" }}
                  >
                    리스트 재생
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
                      style={{
                        backgroundColor:
                          currentPlaylistType === "entry" &&
                          track.id === audioPlaylist[currentTrackIndex]?.id
                            ? "#e6f7ff"
                            : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <List.Item.Meta
                        title={`제목: ${track?.title}`}
                        description={`언어: ${track?.language} ${
                          track.id === audioPlaylist[currentTrackIndex]?.id
                            ? `- ${Math.floor(currentTime)}초`
                            : lastPlayedPositions.entry.positions[track.id]
                            ? `- 마지막 재생: ${Math.floor(
                                lastPlayedPositions.entry.positions[track.id]
                              )}초`
                            : ""
                        }`}
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>

          {/* 라인업 음악 */}
          <Col xs={24} sm={12}>
            <Card
              title="라인업 음악 목록"
              bordered
              extra={
                <Space>
                  <Button
                    onClick={() => setShowLineupTracks(!showLineupTracks)}
                    icon={showLineupTracks ? <UpOutlined /> : <DownOutlined />}
                    shape="circle"
                  />
                  <Button
                    onClick={() =>
                      handleAddAllToPlaylistAndPlay(lineupTracks, "lineup")
                    }
                    style={{ width: "100px", height: "40px" }}
                  >
                    리스트 재생
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
                      style={{
                        backgroundColor:
                          currentPlaylistType === "lineup" &&
                          track.id === audioPlaylist[currentTrackIndex]?.id
                            ? "#e6f7ff"
                            : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <List.Item.Meta
                        title={`제목: ${track?.title}`}
                        description={`언어: ${track?.language} ${
                          track.id === audioPlaylist[currentTrackIndex]?.id
                            ? `- ${Math.floor(currentTime)}초`
                            : lastPlayedPositions.lineup.positions[track.id]
                            ? `- 마지막 재생: ${Math.floor(
                                lastPlayedPositions.lineup.positions[track.id]
                              )}초`
                            : ""
                        }`}
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default RealtimeAudioCenter;
