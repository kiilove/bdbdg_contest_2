import React, { useContext, useState, useEffect } from "react";
import {
  Table,
  Select,
  Button,
  Card,
  Typography,
  Space,
  Modal,
  message,
} from "antd";
import { CustomerServiceOutlined, SaveOutlined } from "@ant-design/icons";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreAddData,
  useFirestoreUpdateData,
  useFirestoreDeleteData,
} from "../hooks/useFirestores";
import dayjs from "dayjs";

const { Title } = Typography;

const SelectWithLabel = ({ label, value, onChange, options, style }) => (
  <Space direction="vertical" size={2} style={{ width: "100%", ...style }}>
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {label}
    </Typography.Text>
    <Select
      style={{ width: "100%" }}
      placeholder={`${label} 선택`}
      onChange={onChange}
      value={value}
      options={options}
      showSearch
      optionFilterProp="children"
    />
  </Space>
);

const ContestMusicSetting = () => {
  const [categories, setCategories] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { currentContest } = useContext(CurrentContestContext);

  // Firestore hooks for each operation
  const categoryDocument = useFirestoreGetDocument("contest_categorys_list");
  const trackPlaylistQuery = useFirestoreQuery();
  const musicSettingsQuery = useFirestoreQuery();
  const addMusicSetting = useFirestoreAddData("contest_music_settings");
  const updateMusicSetting = useFirestoreUpdateData("contest_music_settings");
  const deleteMusicSetting = useFirestoreDeleteData("contest_music_settings");

  const [commonMusic, setCommonMusic] = useState({
    waitingMusic: "",
    resultAnnouncementMusic: "",
    awardsMusic: "",
  });
  const [categoryMusic, setCategoryMusic] = useState({});
  const [duplicateDocs, setDuplicateDocs] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentDocId, setCurrentDocId] = useState(null);
  const [createdAt, setCreatedAt] = useState(null); // createdAt state

  const fetchCategories = async (categoryId) => {
    try {
      const data = await categoryDocument.getDocument(categoryId);
      if (data?.categorys?.length > 0) {
        const sortedCategories = data.categorys.sort(
          (a, b) => a.contestCategoryIndex - b.contestCategoryIndex
        );
        setCategories(sortedCategories);

        const initialCategoryMusic = {};
        sortedCategories.forEach((category) => {
          initialCategoryMusic[category.contestCategoryId] = {
            entryMusic: "",
            lineupMusic: "",
            poseDownMusic: "",
          };
        });
        setCategoryMusic(initialCategoryMusic);
      }
    } catch (error) {
      console.log("Error fetching categories:", error);
    }
  };

  const fetchPlayList = async () => {
    try {
      const data = await trackPlaylistQuery.getDocuments("track_play_list");
      if (data?.length > 0) {
        setPlaylists(data);
      }
    } catch (error) {
      console.log("Error fetching playlists:", error);
    }
  };

  const fetchPools = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchCategories(currentContest.contests.contestCategorysListId),
      fetchPlayList(),
    ]);
    setIsLoading(false);
  };

  useEffect(() => {
    if (currentContest?.contests) {
      fetchPools();
      checkDocumentStatus();
    }
  }, [currentContest]);

  const checkDocumentStatus = async () => {
    const contestId = currentContest.contests.id;
    const docs = await musicSettingsQuery.getDocuments(
      "contest_music_settings",
      [["contestId", "==", contestId]]
    );

    if (!docs || docs.length === 0) {
      console.log("No document found. Adding new document is required.");
      setCreatedAt(dayjs().format("YYYY-MM-DD HH:mm:ss"));
    } else if (docs.length === 1) {
      console.log("Single document found. Proceed with update.");
      setCurrentDocId(docs[0].id);
      setCreatedAt(docs[0].createdAt); // 기존 문서의 createdAt을 저장
      loadDocumentData(docs[0]);
    } else {
      console.log("Multiple documents found. Showing modal for selection.");
      setDuplicateDocs(docs);
      setIsModalVisible(true);
    }
  };

  const loadDocumentData = (doc) => {
    setCommonMusic({
      waitingMusic: doc.commonMusic?.waitingMusic || "",
      resultAnnouncementMusic: doc.commonMusic?.resultAnnouncementMusic || "",
      awardsMusic: doc.commonMusic?.awardsMusic || "",
    });
    const loadedCategoryMusic = {};
    (doc.categoryMusic || []).forEach((category) => {
      loadedCategoryMusic[category.contestCategoryId] = {
        entryMusic: category.entryPlaylistId || "",
        lineupMusic: category.lineupPlaylistId || "",
        poseDownMusic: category.poseDownPlaylistId || "",
      };
    });
    setCategoryMusic(loadedCategoryMusic);
  };

  const handleCommonMusicChange = (field, value) => {
    setCommonMusic((prev) => ({
      ...prev,
      [field]: value || "",
    }));
  };

  const handleCategoryMusicChange = (categoryId, field, value) => {
    setCategoryMusic((prev) => ({
      ...prev,
      [categoryId]: {
        ...(prev[categoryId] || {}),
        [field]: value || "",
      },
    }));
  };

  const handleSave = async () => {
    const saveData = {
      contestId: currentContest.contests.id,
      commonMusic: {
        waitingMusic: commonMusic.waitingMusic || "",
        resultAnnouncementMusic: commonMusic.resultAnnouncementMusic || "",
        awardsMusic: commonMusic.awardsMusic || "",
      },
      categoryMusic: Object.entries(categoryMusic).map(
        ([categoryId, music]) => ({
          contestCategoryId: categoryId,
          entryPlaylistId: music.entryMusic || "",
          lineupPlaylistId: music.lineupMusic || "",
          poseDownPlaylistId: music.poseDownMusic || "",
        })
      ),
      // 기존 createdAt 값이 null일 경우 현재 시간을 사용
      createdAt: createdAt || dayjs().format("YYYY-MM-DD HH:mm:ss"),
      updatedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    };

    try {
      if (!currentDocId) {
        await addMusicSetting.addData(saveData);
        console.log("Document added:", saveData);
        message.success("새 문서가 추가되었습니다.");
      } else {
        await updateMusicSetting.updateData(currentDocId, saveData);
        console.log("Document updated:", saveData);
        message.success("문서가 업데이트되었습니다.");
      }
    } catch (error) {
      console.error("Error during save operation:", error);
      message.error("저장 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const handleModalOk = async () => {
    const remainingDocs = duplicateDocs.filter((doc) => !doc.delete);
    for (let doc of duplicateDocs) {
      if (doc.delete) await deleteMusicSetting.deleteData(doc.id);
    }
    setDuplicateDocs(remainingDocs);
    setIsModalVisible(false);
    message.success("선택된 문서가 삭제되었습니다.");
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
  };

  // 공통 음원과 종목별 음원에 대한 테이블 컬럼 정의
  const commonColumns = [
    {
      title: "구분",
      width: 120,
      render: () => (
        <Space>
          <CustomerServiceOutlined />
          <span>공통 음원</span>
        </Space>
      ),
    },
    {
      title: "대기음원",
      dataIndex: "waitingMusic",
      width: 250,
      render: () => (
        <SelectWithLabel
          label="대기 음원"
          value={commonMusic.waitingMusic}
          onChange={(value) => handleCommonMusicChange("waitingMusic", value)}
          options={playlists.map((p) => ({ label: p.name, value: p.id }))}
        />
      ),
    },
    {
      title: "성적발표음원",
      dataIndex: "resultAnnouncementMusic",
      width: 250,
      render: () => (
        <SelectWithLabel
          label="성적 발표 음원"
          value={commonMusic.resultAnnouncementMusic}
          onChange={(value) =>
            handleCommonMusicChange("resultAnnouncementMusic", value)
          }
          options={playlists.map((p) => ({ label: p.name, value: p.id }))}
        />
      ),
    },
    {
      title: "시상식음원",
      dataIndex: "awardsMusic",
      width: 250,
      render: () => (
        <SelectWithLabel
          label="시상식 음원"
          value={commonMusic.awardsMusic}
          onChange={(value) => handleCommonMusicChange("awardsMusic", value)}
          options={playlists.map((p) => ({ label: p.name, value: p.id }))}
        />
      ),
    },
  ];

  const categoryColumns = [
    {
      title: "순서",
      dataIndex: "contestCategoryIndex",
      width: 70,
      align: "center",
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: "종목명",
      dataIndex: "contestCategoryTitle",
      width: 200,
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.contestCategorySection}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "출전음원",
      dataIndex: "entryMusic",
      width: 250,
      render: (_, record) => (
        <SelectWithLabel
          label="출전 음원"
          value={categoryMusic[record.contestCategoryId]?.entryMusic}
          onChange={(value) =>
            handleCategoryMusicChange(
              record.contestCategoryId,
              "entryMusic",
              value
            )
          }
          options={playlists.map((p) => ({ label: p.name, value: p.id }))}
        />
      ),
    },
    {
      title: "라인업음원",
      dataIndex: "lineupMusic",
      width: 250,
      render: (_, record) => (
        <SelectWithLabel
          label="라인업 음원"
          value={categoryMusic[record.contestCategoryId]?.lineupMusic}
          onChange={(value) =>
            handleCategoryMusicChange(
              record.contestCategoryId,
              "lineupMusic",
              value
            )
          }
          options={playlists.map((p) => ({ label: p.name, value: p.id }))}
        />
      ),
    },
    {
      title: "포즈다운음원",
      dataIndex: "poseDownMusic",
      width: 250,
      render: (_, record) => (
        <SelectWithLabel
          label="포즈다운 음원"
          value={categoryMusic[record.contestCategoryId]?.poseDownMusic}
          onChange={(value) =>
            handleCategoryMusicChange(
              record.contestCategoryId,
              "poseDownMusic",
              value
            )
          }
          options={playlists.map((p) => ({ label: p.name, value: p.id }))}
        />
      ),
    },
  ];

  return (
    <Card bordered={false} style={{ background: "#f5f5f5" }}>
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            음원 설정
          </Title>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            size="large"
          >
            저장
          </Button>
        </div>

        <Card title="공통 음원" bordered={false}>
          <Table
            columns={commonColumns}
            dataSource={[{}]}
            pagination={false}
            loading={isLoading}
            rowKey={() => "common"}
          />
        </Card>

        <Card title="종목별 음원" bordered={false}>
          <Table
            columns={categoryColumns}
            dataSource={categories}
            pagination={false}
            loading={isLoading}
            rowKey="contestCategoryId"
          />
        </Card>
      </Space>

      <Modal
        title="중복 문서 관리"
        visible={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText="삭제 확인"
        cancelText="취소"
      >
        <Table
          columns={[
            { title: "문서 ID", dataIndex: "id" },
            {
              title: "생성 날짜",
              dataIndex: "createdAt",
              render: (value) => dayjs(value).format("YYYY-MM-DD HH:mm:ss"),
            },
            {
              title: "수정 날짜",
              dataIndex: "updatedAt",
              render: (value) => dayjs(value).format("YYYY-MM-DD HH:mm:ss"),
            },
            {
              title: "삭제 선택",
              dataIndex: "delete",
              render: (_, record) => (
                <Select
                  options={[
                    { label: "삭제", value: true },
                    { label: "유지", value: false },
                  ]}
                  onChange={(value) => (record.delete = value)}
                  defaultValue={false}
                />
              ),
            },
          ]}
          dataSource={duplicateDocs}
          rowKey="id"
          pagination={false}
        />
      </Modal>
    </Card>
  );
};

export default ContestMusicSetting;
