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
  const [audioPlaylist, setAudioPlaylist] = useState([]); // 오디오 플레이어의 플레이리스트
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0); // 현재 재생 중인 트랙 인덱스
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
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
  }, [categoryId, contestPlayList]);

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

  const handleAddAllToPlaylistAndPlay = (tracks) => {
    setAudioPlaylist(tracks); // 새 트랙 리스트로 덮어쓰기
    setCurrentTrackIndex(0);
  };

  const playTrack = (track) => {
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = track.path;
      audioRef.current.load();
      audioRef.current.onloadeddata = () => {
        audioRef.current.currentTime = track.startTime;
        audioRef.current
          .play()
          .catch((error) => console.error("Play error:", error));
      };
    }
  };

  useEffect(() => {
    if (audioPlaylist.length > 0 && currentTrackIndex < audioPlaylist.length) {
      playTrack(audioPlaylist[currentTrackIndex]);
    }
  }, [audioPlaylist, currentTrackIndex]);

  const handleNextTrack = () => {
    setCurrentTrackIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;
      if (nextIndex < audioPlaylist.length) {
        return nextIndex;
      } else {
        setIsPlaying(false);
        return prevIndex;
      }
    });
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioPlaylist[currentTrackIndex]) {
      setCurrentTime(audioRef.current.currentTime);
      if (
        audioRef.current.currentTime >= audioPlaylist[currentTrackIndex].endTime
      ) {
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
    setCurrentTrackIndex(index); // 선택된 인덱스로 재생 위치 설정
  };

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
      {/* Left Player Section */}
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
              onClick={() => handlePlaylistClick(index)} // 클릭 시 해당 트랙으로 재생
              style={{ color: "white", cursor: "pointer" }}
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
          </div>
        )}
      </Sider>

      {/* Right Playlist Section */}
      <Content style={{ padding: "20px" }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Card
            title={`${categoryTitle} - 입장 음악`}
            bordered
            extra={
              <Button
                onClick={() => handleAddAllToPlaylistAndPlay(entryTracks)}
              >
                재생
              </Button>
            }
          >
            <List
              dataSource={entryTracks}
              renderItem={(track) => (
                <List.Item>
                  <List.Item.Meta
                    title={`제목: ${track?.title}`}
                    description={`언어: ${track?.language}`}
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
                onClick={() => handleAddAllToPlaylistAndPlay(lineupTracks)}
              >
                재생
              </Button>
            }
          >
            <List
              dataSource={lineupTracks}
              renderItem={(track) => (
                <List.Item>
                  <List.Item.Meta
                    title={`제목: ${track?.title}`}
                    description={`언어: ${track?.language}`}
                  />
                </List.Item>
              )}
            />
          </Card>
          <Card
            title="포즈다운 음악 목록"
            bordered
            extra={
              <Button
                onClick={() => handleAddAllToPlaylistAndPlay(poseDownTracks)}
              >
                재생
              </Button>
            }
          >
            <List
              dataSource={poseDownTracks}
              renderItem={(track) => (
                <List.Item>
                  <List.Item.Meta
                    title={`제목: ${track?.title}`}
                    description={`언어: ${track?.language}`}
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
