"use client";

import React, { useContext, useEffect, useState } from "react";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
  useFirestoreAddData,
  useFirestoreQuery,
} from "../../hooks/useFirestores";
import { storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { where } from "firebase/firestore";
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Tag,
  Typography,
  Popconfirm,
  message,
  Upload,
  Progress,
  Tabs,
  Select,
  InputNumber,
  Switch,
  Radio,
  Checkbox,
  Slider,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  NotificationOutlined,
  VideoCameraOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  FileImageOutlined,
  FieldTimeOutlined,
  ThunderboltOutlined,
  FireOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  calculateAdImpressionStats,
  resetAdImpressionCounts,
} from "../../utils/adEngine";

const { Text } = Typography;
const { Option } = Select;

const ContestSponsorManager = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const contestId = currentContest?.contests?.id || "";

  const [activeTab, setActiveTab] = useState("sponsors");
  const [sponsors, setSponsors] = useState([]);
  const [videoSettings, setVideoSettings] = useState({
    standbyVideoUrl: "",
    rankingVideoUrl: "",
    introVideoUrl: "",
  });
  const [docId, setDocId] = useState(null);

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [form] = Form.useForm();
  const [selectedMediaType, setSelectedMediaType] = useState("IMAGE");

  // 업로드 상태
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingTarget, setUploadingTarget] = useState("");
  const [mediaPreview, setMediaPreview] = useState("");

  const sponsorQuery = useFirestoreQuery();
  const updateSponsorData = useFirestoreUpdateData("contest_sponsor_list");
  const addSponsorData = useFirestoreAddData("contest_sponsor_list");

  // 데이터 로드
  const fetchSettings = async () => {
    if (!contestId) return;
    try {
      const condition = [where("contestId", "==", contestId)];
      const data = await sponsorQuery.getDocuments(
        "contest_sponsor_list",
        condition
      );

      if (data && data.length > 0) {
        setDocId(data[0].id);
        setSponsors(data[0].sponsors || []);
        setVideoSettings({
          standbyVideoUrl: data[0].standbyVideoUrl || "",
          rankingVideoUrl: data[0].rankingVideoUrl || "",
          introVideoUrl: data[0].introVideoUrl || "",
        });
      } else {
        setDocId(null);
        setSponsors([]);
      }
    } catch (error) {
      console.error("스폰서 설정 로드 실패:", error);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [contestId]);

  // 가중치 & 누적 노출 통계 계산
  const [statsTick, setStatsTick] = useState(0);
  const impressionStats = calculateAdImpressionStats(sponsors, "STAGE_LIVE");

  const handleResetStats = () => {
    resetAdImpressionCounts("STAGE_LIVE");
    setStatsTick((t) => t + 1);
    message.success("오늘의 광고 누적 노출 통계가 초기화되었습니다.");
  };

  // 모달 열기
  const openModal = (index = null) => {
    setEditingIndex(index);
    if (index !== null && sponsors[index]) {
      const sp = sponsors[index];
      setSelectedMediaType(sp.mediaType || (sp.videoUrl ? "VIDEO" : "IMAGE"));
      setMediaPreview(sp.videoUrl || sp.imageUrl || sp.logoUrl || "");
      form.setFieldsValue({
        ...sp,
        durationSeconds: sp.durationSeconds || sp.duration || 10,
        weight: sp.weight || 1,
        targetScenes: sp.targetScenes || ["POSEDOWN", "COMMERCIAL"],
      });
    } else {
      setSelectedMediaType("IMAGE");
      setMediaPreview("");
      form.resetFields();
      form.setFieldsValue({
        id: `sp_${Date.now()}`,
        name: "",
        slogan: "",
        tag: "OFFICIAL",
        mediaType: "IMAGE",
        durationSeconds: 10,
        weight: 1,
        targetScenes: ["POSEDOWN", "COMMERCIAL"],
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  // 📤 동영상 업로드 핸들러
  const handleVideoFileUpload = (file, targetField = "adVideo") => {
    if (!contestId) {
      message.error("대회 정보를 확인할 수 없습니다.");
      return false;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadingTarget(targetField);

    const fileExt = file.name.split(".").pop();
    const fileName = `broadcast/${contestId}_${targetField}_${Date.now()}.${fileExt}`;
    const storageRef = ref(storage, fileName);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setUploadProgress(percent);
      },
      (error) => {
        console.error("업로드 에러:", error);
        message.error("동영상 업로드에 실패했습니다.");
        setIsUploading(false);
        setUploadingTarget("");
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

        if (targetField === "adVideo") {
          form.setFieldsValue({ videoUrl: downloadUrl, mediaUrl: downloadUrl });
          setMediaPreview(downloadUrl);
        } else {
          const newVideos = { ...videoSettings, [targetField]: downloadUrl };
          setVideoSettings(newVideos);
          handleSaveVideosToFirestore(newVideos);
        }

        message.success("동영상이 성공적으로 업로드되었습니다!");
        setIsUploading(false);
        setUploadingTarget("");
      }
    );

    return false;
  };

  // 📤 이미지 업로드 핸들러
  const handleImageFileUpload = (file) => {
    if (!contestId) {
      message.error("대회 정보를 확인할 수 없습니다.");
      return false;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadingTarget("sponsorImage");

    const fileExt = file.name.split(".").pop();
    const fileName = `sponsors/${contestId}_${Date.now()}.${fileExt}`;
    const storageRef = ref(storage, fileName);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setUploadProgress(percent);
      },
      (error) => {
        console.error("업로드 에러:", error);
        message.error("이미지 업로드에 실패했습니다.");
        setIsUploading(false);
        setUploadingTarget("");
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        form.setFieldsValue({ imageUrl: downloadUrl, mediaUrl: downloadUrl });
        setMediaPreview(downloadUrl);
        message.success("이미지가 성공적으로 업로드되었습니다!");
        setIsUploading(false);
        setUploadingTarget("");
      }
    );

    return false;
  };

  // 비디오 설정 저장
  const handleSaveVideosToFirestore = async (newVideos) => {
    if (!contestId) return;
    try {
      if (docId) {
        await updateSponsorData.updateData(docId, {
          contestId,
          ...newVideos,
        });
      } else {
        await addSponsorData.addData({
          contestId,
          sponsors: [],
          ...newVideos,
        });
      }
      fetchSettings();
    } catch (error) {
      console.error("비디오 설정 저장 오류:", error);
    }
  };

  // 스폰서 저장
  const handleSaveSponsorsToFirestore = async (newSponsors) => {
    if (!contestId) return;
    try {
      if (docId) {
        await updateSponsorData.updateData(docId, {
          contestId,
          sponsors: newSponsors,
        });
      } else {
        await addSponsorData.addData({
          contestId,
          sponsors: newSponsors,
          ...videoSettings,
        });
      }
      message.success("광고 설정이 저장되었습니다.");
      fetchSettings();
    } catch (error) {
      console.error("스폰서 저장 실패:", error);
      message.error("저장에 실패했습니다.");
    }
  };

  // 스폰서 폼 제출
  const handleSubmitSponsor = (values) => {
    const newSponsors = [...sponsors];
    const itemData = {
      ...values,
      mediaType: selectedMediaType,
      duration: values.durationSeconds || 10,
      weight: Number(values.weight) || 1,
      targetScenes: values.targetScenes || ["POSEDOWN", "COMMERCIAL"],
      id: values.id || `sp_${Date.now()}`,
    };

    if (editingIndex !== null) {
      newSponsors[editingIndex] = itemData;
    } else {
      newSponsors.push(itemData);
    }

    handleSaveSponsorsToFirestore(newSponsors);
    setIsModalOpen(false);
  };

  const handleDelete = (index) => {
    const newSponsors = sponsors.filter((_, i) => i !== index);
    handleSaveSponsorsToFirestore(newSponsors);
  };

  // 노출 On/Off 토글
  const handleToggleActive = (index, checked) => {
    const newSponsors = [...sponsors];
    newSponsors[index] = {
      ...newSponsors[index],
      isActive: checked,
    };
    handleSaveSponsorsToFirestore(newSponsors);
  };

  const columns = [
    {
      title: "순서",
      dataIndex: "order",
      key: "order",
      width: 60,
      align: "center",
      render: (_, __, index) => <Tag color="blue">{index + 1}</Tag>,
    },
    {
      title: "노출",
      dataIndex: "isActive",
      key: "isActive",
      width: 70,
      align: "center",
      render: (active, _, index) => (
        <Switch
          size="small"
          checked={active !== false}
          onChange={(checked) => handleToggleActive(index, checked)}
        />
      ),
    },
    {
      title: "타입",
      dataIndex: "mediaType",
      key: "mediaType",
      width: 85,
      align: "center",
      render: (type, record) =>
        type === "VIDEO" || record.videoUrl ? (
          <Tag color="purple" icon={<VideoCameraOutlined />}>동영상</Tag>
        ) : (
          <Tag color="cyan" icon={<FileImageOutlined />}>이미지</Tag>
        ),
    },
    {
      title: "스폰서 / 광고명",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <div>
          <strong className="text-slate-900 text-sm">{text}</strong>
          {record.tag && <Tag color="orange" className="ml-2 text-xs">{record.tag}</Tag>}
        </div>
      ),
    },
    {
      title: "노출 가중치 (빈도)",
      dataIndex: "weight",
      key: "weight",
      width: 140,
      align: "center",
      render: (w, record) => {
        const found = impressionStats.find((p) => p.name === record.name);
        const targetPercent = found ? found.targetPercent : 0;
        const weightVal = Number(w) || 1;

        return (
          <div className="flex flex-col items-center">
            <span className="font-mono font-black text-amber-600">
              가중치 {weightVal}배
            </span>
            <span className="text-[10px] text-slate-500 font-bold">
              (목표 점유율 {targetPercent}%)
            </span>
          </div>
        );
      },
    },
    {
      title: "오늘 실제 누적 노출 (Impressions)",
      key: "impressions",
      width: 160,
      align: "center",
      render: (_, record) => {
        const found = impressionStats.find((p) => p.name === record.name);
        const count = found ? found.impressions : 0;
        const actualPercent = found ? found.actualPercent : 0;

        return (
          <div className="flex flex-col items-center">
            <Tag color="cyan" className="font-mono font-black text-xs mr-0">
              총 {count}회 송출
            </Tag>
            <span className="text-[10px] text-slate-500 font-semibold mt-0.5">
              실제 점유율: {actualPercent}%
            </span>
          </div>
        );
      },
    },
    {
      title: "노출 대상 화면",
      dataIndex: "targetScenes",
      key: "targetScenes",
      width: 160,
      render: (scenes) => {
        const list = Array.isArray(scenes) ? scenes : ["POSEDOWN", "COMMERCIAL"];
        return (
          <div className="flex flex-wrap gap-1">
            {list.includes("POSEDOWN") && <Tag color="volcano" className="mr-0 text-[10px]">🔥 포즈다운</Tag>}
            {list.includes("COMMERCIAL") && <Tag color="orange" className="mr-0 text-[10px]">📢 광고전용</Tag>}
            {list.includes("STANDBY") && <Tag color="blue" className="mr-0 text-[10px]">대기화면</Tag>}
          </div>
        );
      },
    },
    {
      title: "노출 시간",
      dataIndex: "durationSeconds",
      key: "durationSeconds",
      width: 95,
      align: "center",
      render: (val, record) => (
        <span className="font-mono font-bold text-slate-700">
          <FieldTimeOutlined className="mr-1 text-amber-500" />
          {val || record.duration || 10}초
        </span>
      ),
    },
    {
      title: "미리보기",
      key: "mediaPreview",
      width: 110,
      align: "center",
      render: (_, record) => {
        const isVideo = record.mediaType === "VIDEO" || !!record.videoUrl;
        const url = record.videoUrl || record.imageUrl;
        if (!url) return <span className="text-slate-400 text-xs">기본</span>;

        return isVideo ? (
          <video src={url} className="w-14 h-9 object-cover rounded border" muted />
        ) : (
          <img src={url} alt="배너" className="w-14 h-9 object-cover rounded border" />
        );
      },
    },
    {
      title: "관리",
      key: "action",
      width: 100,
      align: "center",
      render: (_, record, index) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openModal(index)}
          />
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(index)}
            okText="삭제"
            cancelText="취소"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 bg-slate-100 min-h-screen space-y-4">
      <Card className="shadow-sm rounded-2xl border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white text-2xl shadow-md">
              <VideoCameraOutlined />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 m-0">
                무대 전광판 미디어 & 스마트 광고 가중치 엔진 관리
              </h1>
              <p className="text-xs text-slate-500 m-0">
                스폰서별 가중치(노출 빈도 배수), 개별 노출 시간(초), 포즈다운/전광판 노출 대상을 관리합니다.
              </p>
            </div>
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: "sponsors", label: "스폰서 광고 엔진 관리" },
              { key: "videos", label: "무대 배경 비디오(MP4) 설정" },
            ]}
          />
        </div>
      </Card>

      {activeTab === "sponsors" && (
        <div className="space-y-4">
          {/* 🌟 스마트 광고 엔진 실시간 점유율 위젯 */}
          {impressionStats.length > 0 && (
            <Card size="small" className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl border-indigo-800 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <ThunderboltOutlined className="text-amber-400 text-lg" />
                  <span className="font-black text-sm text-white">
                    오늘 실시간 누적 노출 & 공정 가중치 보정 엔진 (Fair Weighted Deficit Scheduler)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-indigo-300 font-mono">
                    총 {impressionStats.length}개 광고 활성
                  </span>
                  <Popconfirm
                    title="오늘의 광고 누적 노출 횟수를 초기화하시겠습니까?"
                    onConfirm={handleResetStats}
                    okText="초기화"
                    cancelText="취소"
                  >
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      className="text-xs text-slate-300 bg-white/10 hover:bg-white/20 border-white/20"
                    >
                      노출 통계 리셋
                    </Button>
                  </Popconfirm>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                {impressionStats.map((ad, idx) => (
                  <div key={idx} className="bg-white/10 p-2.5 rounded-xl border border-white/15">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-black text-white truncate max-w-[120px]">{ad.name}</span>
                      <span className="font-mono text-cyan-300 font-black">
                        총 {ad.impressions}회 ({ad.actualPercent}%)
                      </span>
                    </div>
                    <Progress
                      percent={ad.actualPercent}
                      showInfo={false}
                      strokeColor="#22d3ee"
                      trailColor="rgba(255,255,255,0.15)"
                      size="small"
                    />
                    <div className="text-[10px] text-slate-300 flex justify-between pt-1">
                      <span>가중치: {ad.weight}배 (목표 {ad.targetPercent}%)</span>
                      <span className="text-amber-300">
                        {ad.actualPercent < ad.targetPercent ? "▲ 우선추첨대상" : "● 정상수렴"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card
            className="shadow-sm rounded-2xl border-slate-200"
            title={
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-800 text-base">
                  등록된 스폰서 광고 목록
                </span>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => openModal()}
                  className="bg-indigo-600 font-bold"
                >
                  새 광고 / 스폰서 등록
                </Button>
              </div>
            }
          >
            <Table
              dataSource={sponsors}
              columns={columns}
              rowKey={(r, idx) => r.id || idx}
              pagination={false}
              size="middle"
            />
          </Card>
        </div>
      )}

      {/* 2. 배경 비디오 설정 탭 */}
      {activeTab === "videos" && (
        <Card className="shadow-sm rounded-2xl border-slate-200" title={<span className="font-black text-slate-800">무대 전광판 배경 비디오 (MP4) 설정</span>}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* ① 대기 화면 배경 */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <Tag color="blue" className="font-bold">대기 화면</Tag>
                <span className="font-black text-sm text-slate-800">대기 및 종목 안내 비디오</span>
              </div>
              <Upload.Dragger
                accept="video/mp4,video/*"
                showUploadList={false}
                beforeUpload={(file) => handleVideoFileUpload(file, "standbyVideoUrl")}
                disabled={isUploading}
              >
                <p className="ant-upload-drag-icon"><InboxOutlined className="text-blue-500" /></p>
                <p className="ant-upload-text text-xs font-bold">대기 화면 비디오 업로드</p>
              </Upload.Dragger>
              {videoSettings.standbyVideoUrl && (
                <video src={videoSettings.standbyVideoUrl} controls className="w-full h-32 object-cover rounded-xl mt-2" />
              )}
            </div>

            {/* ② 선수 소개 배경 */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <Tag color="cyan" className="font-bold">선수 소개</Tag>
                <span className="font-black text-sm text-slate-800">선수 입장 스포트라이트 비디오</span>
              </div>
              <Upload.Dragger
                accept="video/mp4,video/*"
                showUploadList={false}
                beforeUpload={(file) => handleVideoFileUpload(file, "introVideoUrl")}
                disabled={isUploading}
              >
                <p className="ant-upload-drag-icon"><InboxOutlined className="text-cyan-500" /></p>
                <p className="ant-upload-text text-xs font-bold">선수 소개 비디오 업로드</p>
              </Upload.Dragger>
              {videoSettings.introVideoUrl && (
                <video src={videoSettings.introVideoUrl} controls className="w-full h-32 object-cover rounded-xl mt-2" />
              )}
            </div>

            {/* ③ 순위 발표 배경 */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <Tag color="gold" className="font-bold">순위 발표</Tag>
                <span className="font-black text-sm text-slate-800">순위 발표 & 챔피언 세레모니 비디오</span>
              </div>
              <Upload.Dragger
                accept="video/mp4,video/*"
                showUploadList={false}
                beforeUpload={(file) => handleVideoFileUpload(file, "rankingVideoUrl")}
                disabled={isUploading}
              >
                <p className="ant-upload-drag-icon"><InboxOutlined className="text-amber-500" /></p>
                <p className="ant-upload-text text-xs font-bold">순위 발표 비디오 업로드</p>
              </Upload.Dragger>
              {videoSettings.rankingVideoUrl && (
                <video src={videoSettings.rankingVideoUrl} controls className="w-full h-32 object-cover rounded-xl mt-2" />
              )}
            </div>

          </div>
        </Card>
      )}

      {/* 🌟 스폰서 광고 등록 / 수정 모달 (가중치 및 노출 대상 포함) */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <NotificationOutlined className="text-indigo-600" />
            <span className="font-black text-slate-900">
              {editingIndex !== null ? "스폰서 광고 및 가중치 수정" : "새 스폰서 광고 등록"}
            </span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnClose
        width={680}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitSponsor} className="pt-2">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item
              name="name"
              label="스폰서 / 광고명"
              rules={[{ required: true, message: "스폰서명을 입력하세요." }]}
            >
              <Input placeholder="예: (주)인바디, MONSTER ENERGY" />
            </Form.Item>

            <Form.Item name="tag" label="스폰서 등급 뱃지">
              <Select>
                <Option value="DIAMOND">💎 DIAMOND SPONSOR (메인)</Option>
                <Option value="PLATINUM">⭐ PLATINUM SPONSOR</Option>
                <Option value="GOLD">🏆 GOLD SPONSOR</Option>
                <Option value="OFFICIAL">🛡️ OFFICIAL PARTNER</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="slogan" label="광고 카피 / 슬로건 문구">
            <Input placeholder="예: 한계를 뛰어넘어라! 공식 에너지 드링크 파트너" />
          </Form.Item>

          {/* 🌟 노출 가중치 & 노출 시간 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4">
            <Form.Item
              name="weight"
              label={
                <span className="font-bold flex items-center gap-1">
                  <span>노출 가중치 (빈도 배수: 1~10배)</span>
                  <Tooltip title="가중치가 3이면 1인 광고보다 3배 더 자주 랜덤으로 배정되어 상영됩니다.">
                    <InfoCircleOutlined className="text-slate-400" />
                  </Tooltip>
                </span>
              }
              rules={[{ required: true }]}
            >
              <Slider min={1} max={10} marks={{ 1: "1배", 3: "3배(추천)", 5: "5배", 10: "10배(독점)" }} />
            </Form.Item>

            <Form.Item
              name="durationSeconds"
              label="1회 노출 시간 (초)"
              rules={[{ required: true }]}
            >
              <InputNumber min={5} max={30} step={1} className="w-full" addonAfter="초 (기본 10초)" />
            </Form.Item>
          </div>

          {/* 🌟 노출 대상 화면 선택 */}
          <Form.Item
            name="targetScenes"
            label="광고 노출 대상 화면"
            rules={[{ required: true, message: "노출할 화면을 최소 1개 이상 선택하세요." }]}
          >
            <Checkbox.Group
              options={[
                { label: "🔥 포즈다운 화면 (POSEDOWN)", value: "POSEDOWN" },
                { label: "📢 공식 광고 전용 화면 (COMMERCIAL)", value: "COMMERCIAL" },
                { label: "대기/종목안내 화면 (STANDBY)", value: "STANDBY" },
              ]}
            />
          </Form.Item>

          {/* 미디어 유형 선택 */}
          <Form.Item label="광고 콘텐츠 형태" required>
            <Radio.Group
              value={selectedMediaType}
              onChange={(e) => setSelectedMediaType(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="IMAGE">🖼️ 이미지 배너/포스터</Radio.Button>
              <Radio.Button value="VIDEO">🎬 MP4 동영상 광고</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {/* 미디어 업로드 / URL 입력 */}
          {selectedMediaType === "IMAGE" ? (
            <div className="space-y-2">
              <Form.Item name="imageUrl" label="이미지 URL 직접 입력 또는 파일 업로드">
                <Input placeholder="https://..." onChange={(e) => setMediaPreview(e.target.value)} />
              </Form.Item>
              <Upload.Dragger
                accept="image/*"
                showUploadList={false}
                beforeUpload={handleImageFileUpload}
                disabled={isUploading}
              >
                <p className="ant-upload-drag-icon"><InboxOutlined className="text-indigo-500" /></p>
                <p className="ant-upload-text text-xs font-bold">이미지 파일 드래그 & 드롭</p>
              </Upload.Dragger>
            </div>
          ) : (
            <div className="space-y-2">
              <Form.Item name="videoUrl" label="동영상 URL 직접 입력 또는 MP4 파일 업로드">
                <Input placeholder="https://...mp4" onChange={(e) => setMediaPreview(e.target.value)} />
              </Form.Item>
              <Upload.Dragger
                accept="video/mp4,video/*"
                showUploadList={false}
                beforeUpload={(file) => handleVideoFileUpload(file, "adVideo")}
                disabled={isUploading}
              >
                <p className="ant-upload-drag-icon"><InboxOutlined className="text-purple-500" /></p>
                <p className="ant-upload-text text-xs font-bold">MP4 동영상 파일 드래그 & 드롭</p>
              </Upload.Dragger>
            </div>
          )}

          {isUploading && (
            <div className="py-2">
              <Text className="text-xs text-indigo-600 font-bold">업로드 진행 중...</Text>
              <Progress percent={uploadProgress} size="small" />
            </div>
          )}

          {/* 미디어 미리보기 */}
          {mediaPreview && (
            <div className="mt-3 p-2 bg-slate-900 rounded-xl">
              <Text className="text-xs text-slate-400 block mb-1">미디어 미리보기</Text>
              {selectedMediaType === "VIDEO" ? (
                <video src={mediaPreview} controls className="w-full h-36 object-contain rounded-lg" />
              ) : (
                <img src={mediaPreview} alt="미리보기" className="w-full h-36 object-contain rounded-lg" />
              )}
            </div>
          )}

          <Form.Item name="id" hidden><Input /></Form.Item>

          <div className="flex justify-end gap-2 pt-4 mt-3 border-t">
            <Button onClick={() => setIsModalOpen(false)}>취소</Button>
            <Button type="primary" htmlType="submit" className="bg-indigo-600 font-bold">
              저장하기
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ContestSponsorManager;
