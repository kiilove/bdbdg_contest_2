"use client";

import { useContext, useEffect, useState } from "react";
import { ref, get, child } from "firebase/database";
import { database } from "../firebase";
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { Card, Typography, Alert, Space, Table, Tag } from "antd";
import { TrophyOutlined, UserOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

// 필요한 필드값을 배열로 받아오는 함수
const fetchSpecificFields = async (path, fields) => {
  const dbRef = ref(database);
  const result = {};

  for (const field of fields) {
    const fieldPath = `${path}/${field}`;
    try {
      const snapshot = await get(child(dbRef, fieldPath));

      if (snapshot.exists()) {
        const data = snapshot.val();
        result[field] = data;
      } else {
        console.log(`데이터가 존재하지 않습니다: ${field}`);
      }
    } catch (error) {
      console.error(
        `데이터를 가져오는 중 오류가 발생했습니다: ${field}`,
        error
      );
      throw error;
    }
  }

  return result;
};

const ContestMonitoringMC = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stageInfo, setStageInfo] = useState({});
  const [currentContestId, setCurrentContestId] = useState("");
  const [currentCategoryId, setCurrentCategoryId] = useState("");
  const [currentGradeId, setCurrentGradeId] = useState("");
  const [currentStageId, setCurrentStageId] = useState("");
  const [varStageTitle, setVarStageTitle] = useState("");
  const { currentContest } = useContext(CurrentContestContext);
  const fetchEntriesQuery = useFirestoreQuery();
  const fetchStagesQuery = useFirestoreQuery();
  const fetchPlayers = useFirestoreQuery();
  const [playersArray, setPlayersArray] = useState([]);

  const stageIdWithGrades = async (contestId, stageId) => {
    console.log(stageId);
    try {
      const condition = [where("contestId", "==", contestId)];
      await fetchStagesQuery
        .getDocuments("contest_stages_assign", condition)
        .then((data) => {
          if (data?.length > 0) {
            setStageInfo({ ...data[0] });
            const findStageInGrades = data[0].stages.find(
              (f) => f.stageId === stageId
            ).grades;

            if (findStageInGrades.length === 0) {
              return;
            } else if (findStageInGrades.length === 1) {
              setVarStageTitle(
                findStageInGrades[0].categoryTitle +
                  " " +
                  findStageInGrades[0].gradeTitle
              );
            } else if (findStageInGrades.length > 1) {
              return;
            }
          }
        });
    } catch (error) {
      console.log(error);
    }
  };

  const fetchEntries = async (contestId, categoryId, gradeId) => {};

  const realTimeSetStageId = async (contestId, fields = []) => {
    const path = `currentStage/${contestId}`;

    await fetchSpecificFields(path, fields).then((data) =>
      setCurrentStageId(data.stageId)
    );
  };

  const fetchPlayersList = async (contestId, gradeId) => {
    try {
      const condition = [
        where("contestId", "==", contestId),
        where("contestGradeId", "==", gradeId),
      ];
      const players = await fetchPlayers.getDocuments(
        "contest_entrys_list",
        condition
      );
      setPlayersArray(
        players.sort((a, b) => (a.playerNumber || 0) - (b.playerNumber || 0))
      );
    } catch (error) {
      console.log(error);
      setPlayersArray([]);
    }
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      setIsLoading(false);
      setCurrentContestId(currentContest.contests.id);
      realTimeSetStageId(currentContest?.contests?.id, ["stageId"]);
    }
  }, [currentContest]);

  useEffect(() => {
    if (currentStageId && currentContestId) {
      stageIdWithGrades(currentContestId, currentStageId);
    }
  }, [currentStageId, currentContestId]);

  useEffect(() => {
    if (stageInfo?.stages && currentStageId && currentContestId) {
      const currentStage = stageInfo.stages.find(
        (s) => s.stageId === currentStageId
      );
      if (currentStage?.grades?.length === 1) {
        fetchPlayersList(currentContestId, currentStage.grades[0].gradeId);
      }
    }
  }, [stageInfo, currentStageId, currentContestId]);

  const playerColumns = [
    {
      title: "선수번호",
      dataIndex: "playerNumber",
      key: "playerNumber",
      width: 120,
      render: (number) => (
        <Tag color="gold" className="text-xl font-bold px-4 py-2">
          {number || "-"}
        </Tag>
      ),
    },
    {
      title: "이름",
      dataIndex: "playerName",
      key: "playerName",
      width: 150,
      render: (name) => (
        <div className="flex items-center gap-2">
          <UserOutlined className="text-blue-500" />
          <Text strong className="text-lg">
            {name}
          </Text>
        </div>
      ),
    },
    {
      title: "소속",
      dataIndex: "playerGym",
      key: "playerGym",
      render: (gym) => <Text className="text-base">{gym || "-"}</Text>,
    },
    {
      title: "출전동기",
      dataIndex: "playerMotivation",
      key: "playerMotivation",
      render: (motivation) => (
        <Text
          className="text-base"
          style={{ color: motivation ? "#1890ff" : "#999" }}
        >
          {motivation || "미입력"}
        </Text>
      ),
    },
  ];

  return (
    <>
      {isLoading && (
        <div className="w-full h-screen flex justify-center items-center bg-white">
          <LoadingPage />
        </div>
      )}

      {!isLoading && !error && (
        <div
          className="w-full min-h-screen flex flex-col justify-start items-center p-8 gap-6"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}
        >
          <Space direction="vertical" size="large" className="w-full max-w-7xl">
            {/* 대회 정보 */}
            {currentContest?.contests?.contestTitle && (
              <Card className="text-center shadow-2xl">
                <Space direction="vertical" size="small">
                  <div className="flex items-center justify-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{
                        background:
                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      }}
                    >
                      <TrophyOutlined className="text-white text-2xl" />
                    </div>
                    <Title level={2} className="!mb-0">
                      {currentContest.contests.contestTitle}
                    </Title>
                  </div>
                </Space>
              </Card>
            )}

            {/* 현재 진행 중인 종목/체급 */}
            {varStageTitle && (
              <Card
                className="text-center shadow-2xl border-0"
                style={{
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                }}
              >
                <Space direction="vertical" size="middle" className="w-full">
                  <Text className="text-white text-2xl font-light opacity-90">
                    현재 진행 중
                  </Text>
                  <Title
                    level={1}
                    className="!text-white !mb-0"
                    style={{ fontSize: "4rem" }}
                  >
                    {varStageTitle}
                  </Title>
                </Space>
              </Card>
            )}

            {playersArray.length > 0 && (
              <Card
                title={
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{
                        background:
                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      }}
                    >
                      <UserOutlined className="text-white text-xl" />
                    </div>
                    <Title level={3} className="!mb-0">
                      참가 선수 명단
                    </Title>
                    <Tag color="blue" className="text-base px-3 py-1">
                      {playersArray.length}명
                    </Tag>
                  </div>
                }
                className="shadow-2xl"
              >
                <Table
                  dataSource={playersArray}
                  columns={playerColumns}
                  rowKey="playerUid"
                  pagination={false}
                  scroll={{ y: 400 }}
                  className="player-list-table"
                />
              </Card>
            )}

            {/* 대기 중 메시지 */}
            {!varStageTitle && !error && (
              <Card className="text-center shadow-2xl">
                <Space direction="vertical" size="middle">
                  <Title level={3} className="!mb-0 text-gray-500">
                    대회 준비 중입니다
                  </Title>
                  <Text className="text-gray-400">곧 경기가 시작됩니다</Text>
                </Space>
              </Card>
            )}
          </Space>
        </div>
      )}

      {/* 에러 발생 시 에러 메시지 표시 */}
      {error && (
        <div className="w-full h-screen flex justify-center items-center p-8">
          <Alert
            message="오류 발생"
            description={error}
            type="error"
            showIcon
            className="max-w-2xl"
          />
        </div>
      )}

      <style jsx global>{`
        .player-list-table .ant-table-thead > tr > th {
          background: #fafafa;
          font-weight: 600;
          font-size: 16px;
          padding: 16px;
        }

        .player-list-table .ant-table-tbody > tr > td {
          padding: 16px;
          font-size: 15px;
        }

        .player-list-table .ant-table-tbody > tr:hover > td {
          background: #f0f5ff;
        }
      `}</style>
    </>
  );
};

export default ContestMonitoringMC;
