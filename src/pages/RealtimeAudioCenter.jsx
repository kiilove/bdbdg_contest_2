import React, { useEffect, useState, useContext } from "react";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime"; // Realtime database hook
import { useFirestoreQuery } from "../hooks/useFirestores"; // Firestore query hook
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { Card, List, Typography, Space, Spin, Alert } from "antd";

const { Title } = Typography;

const RealtimeAudioCenter = () => {
  const { currentContest } = useContext(CurrentContestContext);

  const [commonTracks, setCommonTracks] = useState([]);
  const [categoryTracks, setCategoryTracks] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  const commonQuery = useFirestoreQuery();
  const categoryQuery = useFirestoreQuery();

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
        // Define condition for common playlist query
        const commonConditions = [
          ["contestId", "==", contestId],
          ["categoryId", "==", null],
        ];

        // Fetch common playlist from contest_music_settings
        const commonData = await commonQuery.getDocuments(
          "contest_music_settings",
          commonConditions
        );
        if (commonData && commonData.length > 0) {
          const sortedCommonTracks = (
            commonData[0].commonMusic.tracks || []
          ).sort((a, b) => a.playIndex - b.playIndex);
          setCommonTracks(sortedCommonTracks);
        }

        // Fetch category-specific playlist from contest_music_settings if categoryId is available
        if (categoryId) {
          const categoryConditions = [
            ["contestId", "==", contestId],
            ["categoryId", "==", categoryId],
          ];

          const categoryData = await categoryQuery.getDocuments(
            "contest_music_settings",
            categoryConditions
          );
          if (categoryData && categoryData.length > 0) {
            const sortedCategoryTracks = (
              categoryData[0].categoryMusic.tracks || []
            ).sort((a, b) => a.playIndex - b.playIndex);
            setCategoryTracks(sortedCategoryTracks);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setDataError(error);
      } finally {
        setIsDataLoading(false);
      }
    }

    fetchData();
  }, [contestId, categoryId]);

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
    <div style={{ padding: "20px" }}>
      <Card bordered={false} style={{ marginBottom: "20px" }}>
        <Title level={4}>현재 진행 중인 카테고리</Title>
        <p>
          <strong>Category ID:</strong> {categoryId}
        </p>
        <p>
          <strong>Category Title:</strong> {categoryTitle}
        </p>
      </Card>

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Common Tracks */}
        <Card title="공통 음원 목록" bordered>
          <List
            dataSource={commonTracks}
            renderItem={(track) => (
              <List.Item>
                <List.Item.Meta
                  title={`Play Index: ${track.playIndex}`}
                  description={`Track ID: ${track.id}`}
                />
              </List.Item>
            )}
          />
        </Card>

        {/* Category-Specific Tracks */}
        <Card title={`${categoryTitle} - 종목별 음원 목록`} bordered>
          <List
            dataSource={categoryTracks}
            renderItem={(track) => (
              <List.Item>
                <List.Item.Meta
                  title={`Play Index: ${track.playIndex}`}
                  description={`Track ID: ${track.id}`}
                />
              </List.Item>
            )}
          />
        </Card>
      </Space>
    </div>
  );
};

export default RealtimeAudioCenter;
