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
} from "antd";
import { where } from "firebase/firestore";

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
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [audioPlaylist, setAudioPlaylist] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentPlaylistType, setCurrentPlaylistType] = useState(null); // 'entry' or 'lineup'
  const [lastPlayedPositions, setLastPlayedPositions] = useState({
    entry: { lastIndex: 0, positions: {} },
    lineup: { lastIndex: 0, positions: {} },
  });

  const audioRef = useRef(null);
  const commonQuery = useFirestoreQuery();
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
  }, [contestId]);

  useEffect(() => {
    if (categoryId && contestPlayList?.id && trackPlayList?.length > 0) {
      const filterCategoryPlayList = contestPlayList.categoryMusic.filter(
        (f) => f.contestCategoryId === categoryId
      );

      if (filterCategoryPlayList.length > 0) {
        setCurrentCategoryPlayList(filterCategoryPlayList[0]);

        const filteredEntryList = trackPlayList.filter(
          (f) => f.id === filterCategoryPlayList[0]?.entryPlaylistId
        );

        if (filteredEntryList[0]?.tracks.length > 0) {
          const filteredTracks = filteredEntryList[0]?.tracks.map((track) => {
            return tracks.find((f) => f.id === track.id);
          });
          setEntryTracks(filteredTracks);
        }
      }
    }
  }, [categoryId, contestPlayList, trackPlayList, tracks]);

  useEffect(() => {
    if (categoryId && currentCategoryPlayList?.lineupPlaylistId) {
      const filteredLineupList = trackPlayList.filter(
        (f) => f.id === currentCategoryPlayList.lineupPlaylistId
      );

      if (filteredLineupList[0]?.tracks.length > 0) {
        const lineupTracksData = filteredLineupList[0].tracks.map((track) => {
          return tracks.find((f) => f.id === track.id);
        });
        setLineupTracks(lineupTracksData);
      }
    }
  }, [categoryId, currentCategoryPlayList, trackPlayList, tracks]);

  // useEffect 추가
  useEffect(() => {
    if (categoryId && currentCategoryPlayList?.poseDownPlaylistId) {
      const filteredPoseDownList = trackPlayList.filter(
        (f) => f.id === currentCategoryPlayList.poseDownPlaylistId
      );

      if (filteredPoseDownList[0]?.tracks.length > 0) {
        const poseDownTracksData = filteredPoseDownList[0].tracks.map(
          (track) => {
            return tracks.find((f) => f.id === track.id);
          }
        );
        setPoseDownTracks(poseDownTracksData);
      }
    }
  }, [categoryId, currentCategoryPlayList, trackPlayList, tracks]);

  // 현재 재생 위치 저장 함수
  const saveCurrentPosition = () => {
    if (
      audioPlaylist.length > 0 &&
      audioPlaylist[currentTrackIndex] &&
      currentPlaylistType &&
      lastPlayedPositions[currentPlaylistType] // 이 부분 체크 추가
    ) {
      const currentTrack = audioPlaylist[currentTrackIndex];
      setLastPlayedPositions((prevPositions) => ({
        ...prevPositions,
        [currentPlaylistType]: {
          lastIndex: currentTrackIndex,
          positions: {
            ...prevPositions[currentPlaylistType].positions,
            [currentTrack.id]: audioRef.current?.currentTime || 0,
          },
        },
      }));
    }
  };

  // 플레이리스트 전환 함수 개선
  const handleAddAllToPlaylistAndPlay = (tracks, type) => {
    // 현재 재생 중인 플레이리스트의 위치 저장
    saveCurrentPosition();

    // 이전에 저장된 위치 정보 가져오기
    const lastPlayedPosition = lastPlayedPositions[type];
    const startIndex = lastPlayedPosition?.lastIndex || 0;

    const updatedTracks = tracks.map((track) => ({
      ...track,
      startTime: lastPlayedPosition?.positions[track.id] || 0,
    }));

    setCurrentPlaylistType(type);
    setAudioPlaylist(updatedTracks);
    setCurrentTrackIndex(startIndex);
    setIsPlaying(true);
  };

  const playTrack = (track) => {
    if (!audioRef.current) return;

    setIsPlaying(true);
    audioRef.current.src = track.path;
    audioRef.current.load();
    audioRef.current.onloadeddata = () => {
      // 저장된 시작 위치부터 재생
      const startPosition =
        lastPlayedPositions[currentPlaylistType]?.positions[track.id] || 0;
      audioRef.current.currentTime = startPosition;
      audioRef.current
        .play()
        .catch((error) => console.error("Play error:", error));
    };
  };

  useEffect(() => {
    if (audioPlaylist.length > 0 && currentTrackIndex < audioPlaylist.length) {
      playTrack(audioPlaylist[currentTrackIndex]);
    }
  }, [audioPlaylist, currentTrackIndex]);

  // 같은 리스트 내에서 이전 곡의 재생 시간을 클리어하는 함수 추가
  const clearPreviousTrackPosition = (prevIndex) => {
    if (currentPlaylistType && audioPlaylist[prevIndex]) {
      const prevTrack = audioPlaylist[prevIndex];
      setLastPlayedPositions((prevPositions) => ({
        ...prevPositions,
        [currentPlaylistType]: {
          ...prevPositions[currentPlaylistType],
          positions: {
            ...prevPositions[currentPlaylistType].positions,
            [prevTrack.id]: 0, // 이전 트랙의 재생 시간을 0으로 초기화
          },
        },
      }));
    }
  };

  // handleNextTrack 함수 수정
  const handleNextTrack = () => {
    const currentIndex = currentTrackIndex;
    setCurrentTrackIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;
      if (nextIndex < audioPlaylist.length) {
        clearPreviousTrackPosition(currentIndex); // 이전 트랙 재생 시간 클리어
        return nextIndex;
      } else {
        setIsPlaying(false);
        return prevIndex;
      }
    });
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      // poseDown이 아닐 때만 현재 위치 저장
      if (currentPlaylistType && currentPlaylistType !== "poseDown") {
        saveCurrentPosition();
      }
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioPlaylist[currentTrackIndex]) {
      setCurrentTime(audioRef.current.currentTime);
      const currentTrack = audioPlaylist[currentTrackIndex];
      if (audioRef.current.currentTime >= currentTrack.endTime) {
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

  // handlePlaylistClick 함수 수정
  const handlePlaylistClick = (index) => {
    clearPreviousTrackPosition(currentTrackIndex); // 이전 트랙 재생 시간 클리어
    setCurrentTrackIndex(index);
  };

  const handlePlaySingleTrack = (track, type) => {
    console.log(track);
    // 트랙의 원래 시작 시간과 종료 시간을 유지
    setCurrentPlaylistType(type);
    setAudioPlaylist([
      {
        ...track,
        startTime: track.startTime || 0, // startTime이 없을 경우 0으로 기본값 설정
        endTime: track.endTime || track.duration || 0, // endTime이 없을 경우 전체 길이로 설정
      },
    ]);
    setCurrentTrackIndex(0);
    setIsPlaying(true);
  };

  // 컴포넌트 언마운트 시 위치 저장
  useEffect(() => {
    return () => {
      saveCurrentPosition();
    };
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
        style={{ backgroundColor: "#001529", padding: "20px", color: "white" }}
      >
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleNextTrack}
        />
        <Title level={4} style={{ color: "#ffffff" }}>
          Audio Player
        </Title>
        <List
          dataSource={audioPlaylist}
          renderItem={(track, index) => (
            <List.Item
              onClick={() => handlePlaylistClick(index)}
              style={{
                color: "white",
                cursor: "pointer",
                backgroundColor:
                  index === currentTrackIndex ? "#1890ff" : "transparent",
              }}
            >
              {index + 1}. {track.title}
            </List.Item>
          )}
        />
        {audioPlaylist[currentTrackIndex] && (
          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <Button
              onClick={handlePlayPause}
              style={{ fontSize: "24px", margin: "0 10px" }}
            >
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Slider
              min={audioPlaylist[currentTrackIndex].startTime || 0}
              max={audioPlaylist[currentTrackIndex].endTime || 100}
              value={currentTime}
              onChange={handleSliderChange}
              tooltipVisible={false}
              style={{ width: "90%", marginTop: "20px" }}
            />
            <div style={{ marginTop: "10px" }}>
              현재 시간: {Math.floor(currentTime)}초
            </div>
          </div>
        )}
      </Sider>

      <Content style={{ padding: "20px" }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Card
            title={`${categoryTitle} - 입장 음악`}
            bordered
            extra={
              <Button
                onClick={() =>
                  handleAddAllToPlaylistAndPlay(entryTracks, "entry")
                }
                className="p-2"
                style={{ width: "100px", height: "40px" }}
              >
                리스트 재생
              </Button>
            }
          >
            <List
              dataSource={entryTracks}
              renderItem={(track) => (
                <List.Item
                  style={{
                    backgroundColor:
                      currentPlaylistType === "entry" &&
                      track.id === audioPlaylist[currentTrackIndex]?.id
                        ? "#e6f7ff"
                        : "transparent",
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
          </Card>
          <Card
            title="라인업 음악 목록"
            bordered
            extra={
              <Button
                onClick={() =>
                  handleAddAllToPlaylistAndPlay(lineupTracks, "lineup")
                }
                className="p-2"
                style={{ width: "100px", height: "40px" }}
              >
                리스트 재생
              </Button>
            }
          >
            <List
              dataSource={lineupTracks}
              renderItem={(track) => (
                <List.Item
                  style={{
                    backgroundColor:
                      currentPlaylistType === "lineup" &&
                      track.id === audioPlaylist[currentTrackIndex]?.id
                        ? "#e6f7ff"
                        : "transparent",
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
          </Card>
          <Card title={`${categoryTitle} - 포즈다운 음악`} bordered>
            <List
              dataSource={poseDownTracks}
              renderItem={(track) => (
                <List.Item
                  style={{
                    backgroundColor:
                      currentPlaylistType === "poseDown" &&
                      track.id === audioPlaylist[currentTrackIndex]?.id
                        ? "#e6f7ff"
                        : "transparent",
                  }}
                  actions={[
                    <Button
                      type="primary"
                      onClick={() => handlePlaySingleTrack(track, "poseDown")}
                      ghost={
                        !(
                          currentPlaylistType === "poseDown" &&
                          track.id === audioPlaylist[currentTrackIndex]?.id
                        )
                      }
                    >
                      {currentPlaylistType === "poseDown" &&
                      track.id === audioPlaylist[currentTrackIndex]?.id
                        ? "재생 중"
                        : "재생"}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={`제목: ${track?.title}`}
                    description={`언어: ${track?.language} ${
                      track.id === audioPlaylist[currentTrackIndex]?.id
                        ? `- ${Math.floor(currentTime)}초`
                        : ""
                    }`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Space>
      </Content>
    </Layout>
  );
};

export default RealtimeAudioCenter;
