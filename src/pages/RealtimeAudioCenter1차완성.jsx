import React, { useEffect, useState, useContext, useRef } from "react";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime"; // Realtime database hook
import { useFirestoreQuery } from "../hooks/useFirestores"; // Firestore query hook
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
  const [currentTrack, setCurrentTrack] = useState(null);
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

  const handleTrackClick = (track) => {
    setCurrentTrack(track);
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

  const handlePlayPause = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = currentTrack?.startTime || 0;
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && currentTrack) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.currentTime >= currentTrack.endTime) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleSliderChange = (value) => {
    if (audioRef.current && currentTrack) {
      audioRef.current.currentTime = value;
      setCurrentTime(value);
    }
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
          onEnded={() => setCurrentTrack(null)}
        />
        <Title level={4} style={{ color: "#ffffff" }}>
          Audio Player
        </Title>
        {currentTrack && (
          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <Button
              onClick={handlePlayPause}
              style={{ fontSize: "24px", margin: "0 10px" }}
            >
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Button
              onClick={handleStop}
              style={{ fontSize: "24px", margin: "0 10px" }}
            >
              Stop
            </Button>
            <Slider
              min={currentTrack.startTime || 0}
              max={currentTrack.endTime || 100}
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
          <Card title={`${categoryTitle} - 입장 음악`} bordered>
            <List
              dataSource={entryTracks}
              renderItem={(track) => (
                <List.Item
                  onClick={() => handleTrackClick(track)}
                  style={{ cursor: "pointer" }}
                >
                  <List.Item.Meta
                    title={`제목: ${track?.title}`}
                    description={`언어: ${track?.language}`}
                  />
                </List.Item>
              )}
            />
          </Card>
          <Card title="라인업 음악 목록" bordered>
            <List
              dataSource={lineupTracks}
              renderItem={(track) => (
                <List.Item
                  onClick={() => handleTrackClick(track)}
                  style={{ cursor: "pointer" }}
                >
                  <List.Item.Meta
                    title={`제목: ${track?.title}`}
                    description={`언어: ${track?.language}`}
                  />
                </List.Item>
              )}
            />
          </Card>
          <Card title="포즈다운 음악 목록" bordered>
            <List
              dataSource={poseDownTracks}
              renderItem={(track) => (
                <List.Item
                  onClick={() => handleTrackClick(track)}
                  style={{ cursor: "pointer" }}
                >
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
