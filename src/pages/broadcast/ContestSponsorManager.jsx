"use client";

import React, { useContext, useEffect, useState } from "react";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import {
  useFirestoreUpdateData,
  useFirestoreAddData,
  useFirestoreQuery,
} from "../../hooks/useFirestores";
import { storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { where } from "firebase/firestore";
import {
  Table,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Upload,
  Select,
  InputNumber,
  Switch,
  Radio,
  Checkbox,
  Slider,
  Tooltip,
} from "antd";
import ConfirmationModal from "../../messageBox/ConfirmationModal";
import {
  Plus,
  Pencil,
  Trash2,
  Film,
  Image as ImageIcon,
  Upload as UploadIcon,
  Clock,
  Activity,
  Info,
  RotateCcw,
  Download,
  Megaphone,
} from "lucide-react";
import PreDownloadModal from "../../components/broadcast/PreDownloadModal";
import {
  calculateAdImpressionStats,
  resetAdImpressionCounts,
} from "../../utils/adEngine";
import { BibTag, StatusDot } from "../../components/ui/BibTag";

const { Option } = Select;

const VIDEO_SLOTS = [
  {
    num: "01",
    key: "standbyVideoUrl",
    badge: "대기 화면",
    title: "대기 및 종목 안내",
    uploadLabel: "대기 화면 배경 비디오 업로드",
  },
  {
    num: "02",
    key: "introVideoUrl",
    badge: "선수 소개",
    title: "선수 입장 스포트라이트",
    uploadLabel: "선수 소개 배경 비디오 업로드",
  },
  {
    num: "03",
    key: "calloutVideoUrl",
    badge: "비교심사",
    title: "비교심사 호명",
    uploadLabel: "비교심사 배경 비디오 업로드",
  },
  {
    num: "04",
    key: "posedownVideoUrl",
    badge: "포즈다운",
    title: "60초 포즈다운 배틀",
    uploadLabel: "포즈다운 배경 비디오 업로드",
  },
  {
    num: "05",
    key: "rankingVideoUrl",
    badge: "순위 발표",
    title: "실시간 순위 발표 (2열 리스트)",
    uploadLabel: "순위 발표 배경 비디오 업로드",
  },
  {
    num: "06",
    key: "championVideoUrl",
    badge: "챔피언 세레모니",
    title: "1위 챔피언 단독 쇼케이스",
    uploadLabel: "챔피언 세레모니 배경 비디오 업로드",
  },
  {
    num: "07",
    key: "awardVideoUrl",
    badge: "공식 시상식",
    title: "시상식 및 포디움 단상",
    uploadLabel: "시상식 배경 비디오 업로드",
  },
];

const SCENE_LABELS = {
  POSEDOWN: "포즈다운",
  COMMERCIAL: "광고전용",
  STANDBY: "대기화면",
};

const ContestSponsorManager = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const contestId = currentContest?.contests?.id || "";

  const [activeTab, setActiveTab] = useState("sponsors");
  const [sponsors, setSponsors] = useState([]);
  const [specialVideos, setSpecialVideos] = useState([]);
  const [videoSettings, setVideoSettings] = useState({
    standbyVideoUrl: "",
    introVideoUrl: "",
    calloutVideoUrl: "",
    posedownVideoUrl: "",
    rankingVideoUrl: "",
    championVideoUrl: "",
    awardVideoUrl: "",
  });
  const [docId, setDocId] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreDownloadOpen, setIsPreDownloadOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [form] = Form.useForm();
  const [selectedMediaType, setSelectedMediaType] = useState("IMAGE");
  const watchedDuration = Form.useWatch("durationSeconds", form);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingTarget, setUploadingTarget] = useState("");
  const [mediaPreview, setMediaPreview] = useState("");

  const sponsorQuery = useFirestoreQuery();
  const updateSponsorData = useFirestoreUpdateData("contest_sponsor_list");
  const addSponsorData = useFirestoreAddData("contest_sponsor_list");

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
          introVideoUrl: data[0].introVideoUrl || "",
          calloutVideoUrl: data[0].calloutVideoUrl || "",
          posedownVideoUrl: data[0].posedownVideoUrl || "",
          rankingVideoUrl: data[0].rankingVideoUrl || "",
          championVideoUrl: data[0].championVideoUrl || "",
          awardVideoUrl: data[0].awardVideoUrl || "",
        });
      } else {
        setDocId(null);
        setSponsors([]);
      }

      const spData = await sponsorQuery.getDocuments(
        "contest_special_videos",
        condition
      );
      if (spData && spData.length > 0 && Array.isArray(spData[0]?.videos)) {
        setSpecialVideos(spData[0].videos);
      } else {
        setSpecialVideos([]);
      }
    } catch (error) {
      console.error("스폰서 설정 로드 실패:", error);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [contestId]);

  const [, setStatsTick] = useState(0);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState({});
  const impressionStats = calculateAdImpressionStats(sponsors, "STAGE_LIVE");

  const openNotice = (config) => {
    setNoticeMessage({ isButton: true, confirmButtonText: "확인", ...config });
    setNoticeOpen(true);
  };

  const handleResetStats = () => {
    resetAdImpressionCounts("STAGE_LIVE");
    setStatsTick((t) => t + 1);
    openNotice({
      variant: "success",
      title: "노출 통계 초기화 완료",
      body: "오늘의 광고 누적 노출 통계가 초기화되었습니다.",
    });
  };

  const openModal = (index = null) => {
    setEditingIndex(index);
    if (index !== null && sponsors[index]) {
      const sp = sponsors[index];
      const isVideo = sp.mediaType === "VIDEO" || !!sp.videoUrl;
      setSelectedMediaType(sp.mediaType || (isVideo ? "VIDEO" : "IMAGE"));
      setMediaPreview(sp.videoUrl || sp.imageUrl || sp.logoUrl || "");
      form.setFieldsValue({
        ...sp,
        durationSeconds:
          sp.durationSeconds || sp.duration || (isVideo ? 10 : 5),
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
        durationSeconds: 5,
        weight: 1,
        targetScenes: ["POSEDOWN", "COMMERCIAL"],
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleVideoFileUpload = (file, targetField = "adVideo") => {
    if (!contestId) {
      openNotice({
        variant: "error",
        title: "대회 정보 없음",
        body: "대회 정보를 확인할 수 없습니다.",
      });
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
        openNotice({
          variant: "error",
          title: "동영상 업로드 실패",
          body: "동영상 파일을 업로드하는 중 오류가 발생했습니다.",
        });
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

        openNotice({
          variant: "success",
          title: "동영상 업로드 완료",
          body: "동영상 파일이 업로드되어 설정에 반영되었습니다.",
        });
        setIsUploading(false);
        setUploadingTarget("");
      }
    );

    return false;
  };

  const handleImageFileUpload = (file) => {
    if (!contestId) {
      openNotice({
        variant: "error",
        title: "대회 정보 없음",
        body: "대회 정보를 확인할 수 없습니다.",
      });
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
        openNotice({
          variant: "error",
          title: "이미지 업로드 실패",
          body: "이미지 파일을 업로드하는 중 오류가 발생했습니다.",
        });
        setIsUploading(false);
        setUploadingTarget("");
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        form.setFieldsValue({ imageUrl: downloadUrl, mediaUrl: downloadUrl });
        setMediaPreview(downloadUrl);
        openNotice({
          variant: "success",
          title: "이미지 업로드 완료",
          body: "스폰서 이미지가 업로드되었습니다.",
        });
        setIsUploading(false);
        setUploadingTarget("");
      }
    );

    return false;
  };

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

  const handleSaveSponsorsToFirestore = async (
    newSponsors,
    { silent = false } = {}
  ) => {
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
      if (!silent) {
        openNotice({
          variant: "success",
          title: "광고 설정 저장 완료",
          body: "스폰서 광고 목록 및 노출 설정이 저장되었습니다.",
        });
      }
      fetchSettings();
    } catch (error) {
      console.error("스폰서 저장 실패:", error);
      openNotice({
        variant: "error",
        title: "광고 설정 저장 실패",
        body: "스폰서 광고 설정을 저장하는 중 오류가 발생했습니다.",
      });
    }
  };

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

  const handleToggleActive = (index, checked) => {
    const newSponsors = [...sponsors];
    newSponsors[index] = {
      ...newSponsors[index],
      isActive: checked,
    };
    handleSaveSponsorsToFirestore(newSponsors, { silent: true });
  };

  const columns = [
    {
      title: "순서",
      dataIndex: "order",
      key: "order",
      width: 68,
      align: "center",
      render: (_, __, index) => (
        <BibTag number={String(index + 1).padStart(2, "0")} size="sm" />
      ),
    },
    {
      title: "노출",
      dataIndex: "isActive",
      key: "isActive",
      width: 72,
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
      title: "유형",
      dataIndex: "mediaType",
      key: "mediaType",
      width: 96,
      align: "center",
      render: (type, record) => {
        const isVideo = type === "VIDEO" || Boolean(record.videoUrl);
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs text-[#525252]">
            {isVideo ? (
              <>
                <Film size={14} strokeWidth={1.5} className="text-[#737373]" />
                <span>동영상</span>
              </>
            ) : (
              <>
                <ImageIcon
                  size={14}
                  strokeWidth={1.5}
                  className="text-[#737373]"
                />
                <span>이미지</span>
              </>
            )}
          </span>
        );
      },
    },
    {
      title: "스폰서 및 광고명",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] leading-5 font-medium text-[#171717]">
              {text}
            </span>
            {record.tag && (
              <span className="text-[11px] leading-4 font-mono px-1.5 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.10] text-[#525252]">
                {record.tag}
              </span>
            )}
          </div>
          {record.slogan && (
            <div className="text-xs text-[#737373] truncate max-w-[280px]">
              {record.slogan}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "1회 송출",
      key: "durationSeconds",
      width: 96,
      align: "right",
      render: (_, record) => {
        const isVideo = record.mediaType === "VIDEO" || !!record.videoUrl;
        const sec =
          Number(record.durationSeconds || record.duration) ||
          (isVideo ? 10 : 5);
        return (
          <span className="inline-flex items-center gap-1 font-mono tabular-nums text-xs text-[#171717] font-medium">
            <Clock size={14} strokeWidth={1.5} className="text-[#737373]" />
            <span>{sec}s</span>
          </span>
        );
      },
    },
    {
      title: "노출 가중치",
      dataIndex: "weight",
      key: "weight",
      width: 132,
      align: "right",
      render: (w, record) => {
        const found = impressionStats.find((p) => p.name === record.name);
        const targetPercent = found ? found.targetPercent : 0;
        const weightVal = Number(w) || 1;

        return (
          <div className="text-right">
            <div className="font-mono tabular-nums text-xs font-medium text-[#171717]">
              {weightVal}배
            </div>
            <div className="text-[11px] leading-4 font-mono tabular-nums text-[#737373]">
              목표 {targetPercent}%
            </div>
          </div>
        );
      },
    },
    {
      title: "누적 송출",
      key: "impressions",
      width: 140,
      align: "right",
      render: (_, record) => {
        const found = impressionStats.find((p) => p.name === record.name);
        const count = found ? found.impressions : 0;
        const actualPercent = found ? found.actualPercent : 0;

        return (
          <div className="text-right">
            <div className="font-mono tabular-nums text-xs font-medium text-[#2563eb]">
              {count}회
            </div>
            <div className="text-[11px] leading-4 font-mono tabular-nums text-[#737373]">
              실제 {actualPercent}%
            </div>
          </div>
        );
      },
    },
    {
      title: "노출 대상 화면",
      dataIndex: "targetScenes",
      key: "targetScenes",
      width: 168,
      render: (scenes) => {
        const list = Array.isArray(scenes)
          ? scenes
          : ["POSEDOWN", "COMMERCIAL"];
        return (
          <div className="flex flex-wrap gap-1">
            {list.map((sc) => (
              <span
                key={sc}
                className="text-[11px] leading-4 px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#525252]"
              >
                {SCENE_LABELS[sc] || sc}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      title: "미리보기",
      key: "mediaPreview",
      width: 100,
      align: "center",
      render: (_, record) => {
        const isVideo = record.mediaType === "VIDEO" || !!record.videoUrl;
        const url = record.videoUrl || record.imageUrl;
        if (!url) return <span className="text-[#737373] text-xs">기본</span>;

        return isVideo ? (
          <video
            src={url}
            className="w-14 h-9 object-cover rounded-[4px] border border-[#171717]/[0.08] mx-auto"
            muted
          />
        ) : (
          <img
            src={url}
            alt="배너"
            className="w-14 h-9 object-cover rounded-[4px] border border-[#171717]/[0.08] mx-auto"
          />
        );
      },
    },
    {
      title: "관리",
      key: "action",
      width: 96,
      align: "right",
      render: (_, __, index) => (
        <div className="inline-flex items-center justify-end gap-1.5">
          <button
            type="button"
            aria-label="수정"
            onClick={() => openModal(index)}
            className="h-8 w-8 rounded-[6px] bg-[#ffffff] hover:bg-[#f4f4f5] border border-[#171717]/[0.10] text-[#525252] hover:text-[#171717] inline-flex items-center justify-center cursor-pointer transition-colors duration-150"
          >
            <Pencil size={15} strokeWidth={1.5} />
          </button>
          <Popconfirm
            title="이 스폰서 광고를 삭제하시겠습니까?"
            onConfirm={() => handleDelete(index)}
            okText="삭제"
            cancelText="취소"
          >
            <button
              type="button"
              aria-label="삭제"
              className="h-8 w-8 rounded-[6px] bg-[#ffffff] hover:bg-[#dc2626]/10 border border-[#171717]/[0.10] hover:border-[#dc2626]/30 text-[#737373] hover:text-[#dc2626] inline-flex items-center justify-center cursor-pointer transition-colors duration-150"
            >
              <Trash2 size={15} strokeWidth={1.5} />
            </button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#171717] w-full px-5 sm:px-6 lg:px-8 py-6">
      <ConfirmationModal
        isOpen={noticeOpen}
        message={noticeMessage}
        onCancel={() => setNoticeOpen(false)}
        onConfirm={() => setNoticeOpen(false)}
      />
      <div className="w-full space-y-5">
        <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] flex items-center justify-center text-[#525252] shrink-0">
                <Film size={18} strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="text-[20px] leading-7 font-medium text-[#171717] m-0">
                  전광판 미디어 및 스폰서 가중치 관리
                </h1>
                <p className="text-xs text-[#525252] m-0 mt-0.5">
                  스폰서별 노출 빈도 배수, 1회 송출 시간, 무대 화면별 배경 비디오를 설정합니다
                </p>
              </div>
            </div>

            <div className="inline-flex p-1 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] self-start md:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab("sponsors")}
                className={`h-8 px-3.5 rounded-[6px] text-xs font-medium cursor-pointer transition-[background-color,color] duration-150 ${
                  activeTab === "sponsors"
                    ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                    : "text-[#525252] hover:text-[#171717]"
                }`}
              >
                스폰서 광고 엔진
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("videos")}
                className={`h-8 px-3.5 rounded-[6px] text-xs font-medium cursor-pointer transition-[background-color,color] duration-150 ${
                  activeTab === "videos"
                    ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                    : "text-[#525252] hover:text-[#171717]"
                }`}
              >
                무대 배경 비디오 (7종)
              </button>
            </div>
          </div>
        </div>

        {activeTab === "sponsors" && (
          <div className="space-y-5">
            {impressionStats.length > 0 && (
              <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="bg-[#f4f4f5] px-5 py-3 border-b border-[#171717]/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Activity
                      size={16}
                      strokeWidth={1.5}
                      className="text-[#525252]"
                    />
                    <span className="text-[13px] leading-5 font-medium text-[#171717]">
                      금일 누적 송출 및 가중치 수렴 현황
                    </span>
                    <span className="text-xs font-mono tabular-nums text-[#737373] ml-1">
                      활성 {impressionStats.length}건
                    </span>
                  </div>
                  <Popconfirm
                    title="금일 광고 누적 노출 횟수를 초기화하시겠습니까?"
                    onConfirm={handleResetStats}
                    okText="초기화"
                    cancelText="취소"
                  >
                    <button
                      type="button"
                      className="h-8 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#fafafa] border border-[#171717]/[0.10] text-xs font-medium text-[#525252] hover:text-[#171717] inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150 self-start sm:self-auto"
                    >
                      <RotateCcw size={14} strokeWidth={1.5} />
                      <span>노출 통계 초기화</span>
                    </button>
                  </Popconfirm>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {impressionStats.map((ad, idx) => {
                    const isDeficit = ad.actualPercent < ad.targetPercent;
                    const ratio = Math.max(
                      0,
                      Math.min(1, (ad.actualPercent || 0) / 100)
                    );
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.08] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-[#171717] truncate">
                            {ad.name}
                          </span>
                          <span className="font-mono tabular-nums text-[#2563eb] font-medium shrink-0">
                            {ad.impressions}회 ({ad.actualPercent}%)
                          </span>
                        </div>

                        <div className="w-full h-1.5 rounded-[4px] bg-[#e4e4e7] overflow-hidden">
                          <div
                            className="w-full h-full bg-[#2563eb] origin-left transition-transform duration-200"
                            style={{ transform: `scaleX(${ratio})` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] leading-4 text-[#737373]">
                          <span className="font-mono tabular-nums">
                            가중치 {ad.weight}x · 목표 {ad.targetPercent}%
                          </span>
                          <span className="inline-flex items-center gap-1 text-[#525252]">
                            <StatusDot
                              status={isDeficit ? "active" : "live"}
                              live={false}
                            />
                            <span>{isDeficit ? "우선 배정" : "정상 수렴"}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="bg-[#f4f4f5] px-5 py-3.5 border-b border-[#171717]/[0.08] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] leading-5 font-medium text-[#171717]">
                    등록된 스폰서 광고 목록
                  </span>
                  <span className="text-xs font-mono tabular-nums text-[#737373]">
                    {sponsors.length}건
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openModal()}
                  className="h-9 px-3.5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-[background-color,transform] duration-150 active:scale-[0.98]"
                >
                  <Plus size={16} strokeWidth={1.5} />
                  <span>새 스폰서 등록</span>
                </button>
              </div>

              <div className="p-0">
                <Table
                  dataSource={sponsors}
                  columns={columns}
                  rowKey={(r, idx) => r.id || idx}
                  pagination={false}
                  size="middle"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "videos" && (
          <div className="bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="bg-[#f4f4f5] px-5 py-3.5 border-b border-[#171717]/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] leading-5 font-medium text-[#171717] m-0">
                  무대 전광판 화면별 배경 비디오 설정
                </h2>
                <p className="text-xs text-[#737373] m-0 mt-0.5">
                  7개 연출 화면에 독립 재생할 MP4 배경 영상을 등록합니다
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreDownloadOpen(true)}
                className="h-9 px-3.5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium inline-flex items-center gap-2 cursor-pointer transition-[background-color,transform] duration-150 active:scale-[0.98] self-start sm:self-auto"
              >
                <Download size={16} strokeWidth={1.5} />
                <span>무대 영상 사전 다운로드</span>
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {VIDEO_SLOTS.map((slot) => {
                const videoUrl = videoSettings[slot.key];
                const isSlotUploading =
                  isUploading && uploadingTarget === slot.key;

                return (
                  <div
                    key={slot.key}
                    className="p-4 bg-[#fafafa] rounded-[10px] border border-[#171717]/[0.08] flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <BibTag number={slot.num} size="sm" />
                          <span className="text-[13px] leading-5 font-medium text-[#171717] truncate">
                            {slot.title}
                          </span>
                        </div>
                        <span className="text-[11px] leading-4 px-2 py-0.5 rounded-[4px] bg-[#ffffff] border border-[#171717]/[0.08] text-[#525252] shrink-0">
                          {slot.badge}
                        </span>
                      </div>

                      <Upload.Dragger
                        accept="video/mp4,video/*"
                        showUploadList={false}
                        beforeUpload={(file) =>
                          handleVideoFileUpload(file, slot.key)
                        }
                        disabled={isUploading}
                      >
                        <div className="py-2 flex flex-col items-center gap-1.5">
                          <UploadIcon
                            size={18}
                            strokeWidth={1.5}
                            className="text-[#737373]"
                          />
                          <span className="text-xs font-medium text-[#525252]">
                            {isSlotUploading
                              ? `업로드 중 (${uploadProgress}%)`
                              : slot.uploadLabel}
                          </span>
                        </div>
                      </Upload.Dragger>
                    </div>

                    {videoUrl && (
                      <video
                        src={videoUrl}
                        controls
                        className="w-full h-28 object-cover rounded-[8px] border border-[#171717]/[0.08]"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Drawer
        placement="right"
        width={640}
        title={
          <div className="flex items-center gap-2 text-[#171717]">
            <Megaphone size={18} strokeWidth={1.5} className="text-[#525252]" />
            <span className="font-medium text-[15px]">
              {editingIndex !== null
                ? "스폰서 광고 및 가중치 수정"
                : "새 스폰서 광고 등록"}
            </span>
          </div>
        }
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        destroyOnClose
        styles={{
          header: {
            borderBottom: "1px solid rgba(23, 23, 23, 0.08)",
            padding: "16px 24px",
          },
          body: {
            padding: "20px 24px",
          },
          footer: {
            borderTop: "1px solid rgba(23, 23, 23, 0.08)",
            padding: "12px 24px",
          },
        }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="h-9 px-4 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] border border-[#171717]/[0.08] text-xs font-medium text-[#171717] cursor-pointer transition-colors duration-150"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => form.submit()}
              className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium cursor-pointer transition-colors duration-150"
            >
              저장하기
            </button>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitSponsor}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item
              name="name"
              label="스폰서 및 광고명"
              rules={[{ required: true, message: "스폰서명을 입력하세요" }]}
            >
              <Input placeholder="예: (주)인바디, MONSTER ENERGY" />
            </Form.Item>

            <Form.Item name="tag" label="스폰서 등급">
              <Select>
                <Option value="DIAMOND">DIAMOND (메인 스폰서)</Option>
                <Option value="PLATINUM">PLATINUM 스폰서</Option>
                <Option value="GOLD">GOLD 스폰서</Option>
                <Option value="OFFICIAL">OFFICIAL 파트너</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="slogan" label="광고 카피 및 슬로건">
            <Input placeholder="예: 공식 에너지 드링크 파트너" />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#f4f4f5] p-4 rounded-[8px] border border-[#171717]/[0.08] mb-4">
            <Form.Item
              name="weight"
              label={
                <span className="font-medium text-xs text-[#171717] flex items-center gap-1.5">
                  <span>노출 가중치 (1–10배)</span>
                  <Tooltip title="가중치가 3이면 1인 광고보다 3배 더 자주 배정되어 송출됩니다">
                    <Info
                      size={14}
                      strokeWidth={1.5}
                      className="text-[#737373]"
                    />
                  </Tooltip>
                </span>
              }
              rules={[{ required: true }]}
              className="mb-0"
            >
              <Slider
                min={1}
                max={10}
                marks={{ 1: "1x", 3: "3x", 5: "5x", 10: "10x" }}
              />
            </Form.Item>

            <div className="space-y-2">
              <Form.Item
                name="durationSeconds"
                label={
                  <span className="font-medium text-xs text-[#171717] flex items-center justify-between w-full gap-2">
                    <span>1회 송출 시간 (초)</span>
                    <span className="text-[11px] text-[#737373] font-normal">
                      {selectedMediaType === "VIDEO"
                        ? "권장 10초"
                        : "권장 5초"}
                    </span>
                  </span>
                }
                rules={[{ required: true, message: "송출 시간을 입력하세요" }]}
                className="mb-1"
              >
                <InputNumber
                  min={2}
                  max={60}
                  step={1}
                  className="w-full"
                  addonAfter="초"
                />
              </Form.Item>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { sec: 5, label: "5s 로고" },
                  { sec: 10, label: "10s 영상" },
                  { sec: 15, label: "15s" },
                  { sec: 20, label: "20s" },
                ].map((preset) => (
                  <button
                    key={preset.sec}
                    type="button"
                    onClick={() =>
                      form.setFieldsValue({ durationSeconds: preset.sec })
                    }
                    className={`h-7 px-2.5 rounded-[6px] border text-xs font-mono tabular-nums cursor-pointer transition-colors duration-150 ${
                      watchedDuration === preset.sec
                        ? "bg-[#2563eb] border-[#2563eb] text-white"
                        : "bg-[#ffffff] border-[#171717]/[0.10] text-[#525252] hover:text-[#171717]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Form.Item
            name="targetScenes"
            label="광고 노출 대상 화면"
            rules={[
              {
                required: true,
                message: "노출할 화면을 최소 1개 이상 선택하세요",
              },
            ]}
          >
            <Checkbox.Group
              options={[
                { label: "포즈다운 화면 (POSEDOWN)", value: "POSEDOWN" },
                { label: "공식 광고 화면 (COMMERCIAL)", value: "COMMERCIAL" },
                { label: "대기 및 안내 화면 (STANDBY)", value: "STANDBY" },
              ]}
            />
          </Form.Item>

          <Form.Item label="광고 콘텐츠 형태" required>
            <Radio.Group
              value={selectedMediaType}
              onChange={(e) => {
                const nextType = e.target.value;
                setSelectedMediaType(nextType);
                const curDur = form.getFieldValue("durationSeconds");
                if (nextType === "IMAGE" && curDur === 10) {
                  form.setFieldsValue({ durationSeconds: 5 });
                } else if (nextType === "VIDEO" && curDur === 5) {
                  form.setFieldsValue({ durationSeconds: 10 });
                }
              }}
              buttonStyle="solid"
            >
              <Radio.Button value="IMAGE">
                이미지 배너 및 포스터 (기본 5초)
              </Radio.Button>
              <Radio.Button value="VIDEO">
                MP4 동영상 광고 (기본 10초)
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          {selectedMediaType === "IMAGE" ? (
            <div className="space-y-2">
              <Form.Item
                name="imageUrl"
                label="이미지 URL 입력 또는 파일 업로드"
              >
                <Input
                  placeholder="https://..."
                  onChange={(e) => setMediaPreview(e.target.value)}
                />
              </Form.Item>
              <Upload.Dragger
                accept="image/*"
                showUploadList={false}
                beforeUpload={handleImageFileUpload}
                disabled={isUploading}
              >
                <div className="py-2 flex flex-col items-center gap-1.5">
                  <UploadIcon
                    size={18}
                    strokeWidth={1.5}
                    className="text-[#737373]"
                  />
                  <span className="text-xs font-medium text-[#525252]">
                    이미지 파일 드래그 또는 클릭하여 업로드
                  </span>
                </div>
              </Upload.Dragger>
            </div>
          ) : (
            <div className="space-y-2">
              <Form.Item
                name="videoUrl"
                label="동영상 URL 입력 또는 MP4 파일 업로드"
              >
                <Input
                  placeholder="https://...mp4"
                  onChange={(e) => setMediaPreview(e.target.value)}
                />
              </Form.Item>
              <Upload.Dragger
                accept="video/mp4,video/*"
                showUploadList={false}
                beforeUpload={(file) => handleVideoFileUpload(file, "adVideo")}
                disabled={isUploading}
              >
                <div className="py-2 flex flex-col items-center gap-1.5">
                  <UploadIcon
                    size={18}
                    strokeWidth={1.5}
                    className="text-[#737373]"
                  />
                  <span className="text-xs font-medium text-[#525252]">
                    MP4 동영상 파일 드래그 또는 클릭하여 업로드
                  </span>
                </div>
              </Upload.Dragger>
            </div>
          )}

          {isUploading && (
            <div className="py-3 space-y-1.5">
              <div className="flex justify-between text-xs text-[#525252]">
                <span>파일 업로드 진행 중</span>
                <span className="font-mono tabular-nums text-[#171717]">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#e4e4e7] rounded-[4px] overflow-hidden">
                <div
                  className="w-full h-full bg-[#2563eb] origin-left transition-transform duration-150"
                  style={{
                    transform: `scaleX(${Math.max(
                      0,
                      Math.min(1, (uploadProgress || 0) / 100)
                    )})`,
                  }}
                />
              </div>
            </div>
          )}

          {mediaPreview && (
            <div className="mt-3 p-3 bg-[#f4f4f5] rounded-[8px] border border-[#171717]/[0.08]">
              <div className="text-xs text-[#737373] mb-2">미디어 미리보기</div>
              {selectedMediaType === "VIDEO" ? (
                <video
                  src={mediaPreview}
                  controls
                  className="w-full h-36 object-contain rounded-[6px] bg-[#141415]"
                />
              ) : (
                <img
                  src={mediaPreview}
                  alt="미리보기"
                  className="w-full h-36 object-contain rounded-[6px] bg-[#ffffff]"
                />
              )}
            </div>
          )}

          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <button type="submit" className="hidden" aria-hidden="true" />
        </Form>
      </Drawer>

      <PreDownloadModal
        open={isPreDownloadOpen}
        onClose={() => setIsPreDownloadOpen(false)}
        videoSettings={videoSettings}
        sponsors={sponsors}
        specialVideos={specialVideos}
        contestId={contestId}
      />
    </div>
  );
};

export default ContestSponsorManager;
