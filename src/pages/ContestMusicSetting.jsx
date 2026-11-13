import React, { useContext, useState, useEffect } from "react";
import { Table, Select, Modal, message } from "antd";
import { Music, Save } from "lucide-react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreAddData,
  useFirestoreUpdateData,
  useFirestoreDeleteData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import dayjs from "dayjs";
import BibTag from "../components/ui/BibTag";

const SelectWithLabel = ({ label, value, onChange, options, style }) => (
  <div className="space-y-1 w-full" style={style}>
    <span className="block text-[12px] font-medium text-[#737373]">
      {label}
    </span>
    <Select
      style={{ width: "100%" }}
      placeholder={`${label} 선택`}
      onChange={onChange}
      value={value || undefined}
      options={options}
      allowClear
      showSearch
      optionFilterProp="label"
    />
  </div>
);

const ContestMusicSetting = () => {
  const [categories, setCategories] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { currentContest } = useContext(CurrentContestContext);

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
  const [createdAt, setCreatedAt] = useState(null);

  const fetchCategories = async (categoryId) => {
    try {
      const data = await categoryDocument.getDocument(categoryId);
      if (data?.categorys?.length > 0) {
        const sortedCategories = [...data.categorys].sort(
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
        setCategoryMusic((prev) => ({
          ...initialCategoryMusic,
          ...prev,
        }));
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
    if (!currentContest?.contests?.contestCategorysListId) return;
    setIsLoading(true);
    try {
      await Promise.all([
        fetchCategories(currentContest.contests.contestCategorysListId),
        fetchPlayList(),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sortDocsByLatest = (docs = []) => {
    return [...docs].sort((a, b) => {
      const timeA = dayjs(a?.updatedAt || a?.createdAt || 0).valueOf() || 0;
      const timeB = dayjs(b?.updatedAt || b?.createdAt || 0).valueOf() || 0;
      return timeB - timeA;
    });
  };

  useEffect(() => {
    let isCancelled = false;
    const init = async () => {
      if (!currentContest?.contests?.id) return;
      setCurrentDocId(null);
      setDuplicateDocs([]);
      await fetchPools();
      if (!isCancelled) {
        await checkDocumentStatus();
      }
    };
    init();
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests?.id]);

  const checkDocumentStatus = async () => {
    const contestId = currentContest?.contests?.id;
    if (!contestId) return;

    const docs = await musicSettingsQuery.getDocuments(
      "contest_music_settings",
      [where("contestId", "==", contestId)]
    );

    if (!docs || docs.length === 0) {
      console.log("No document found. Adding new document is required.");
      setCurrentDocId(null);
      setCreatedAt(dayjs().format("YYYY-MM-DD HH:mm:ss"));
    } else if (docs.length === 1) {
      console.log("Single document found. Proceed with update.");
      setCurrentDocId(docs[0].id);
      setCreatedAt(docs[0].createdAt);
      loadDocumentData(docs[0]);
    } else {
      console.log("Multiple documents found. Selecting latest and showing cleanup modal.");
      const sortedDocs = sortDocsByLatest(docs);
      const latestDoc = sortedDocs[0];
      setCurrentDocId(latestDoc.id);
      setCreatedAt(latestDoc.createdAt || dayjs().format("YYYY-MM-DD HH:mm:ss"));
      loadDocumentData(latestDoc);
      setDuplicateDocs(
        sortedDocs.map((d, idx) => ({
          ...d,
          delete: idx > 0,
        }))
      );
      setIsModalVisible(true);
    }
  };

  const loadDocumentData = (doc) => {
    if (!doc) return;
    setCommonMusic({
      waitingMusic: doc.commonMusic?.waitingMusic || "",
      resultAnnouncementMusic: doc.commonMusic?.resultAnnouncementMusic || "",
      awardsMusic: doc.commonMusic?.awardsMusic || "",
    });
    const loadedCategoryMusic = {};
    const rawCatMusic = doc.categoryMusic;
    if (Array.isArray(rawCatMusic)) {
      rawCatMusic.forEach((category) => {
        if (!category?.contestCategoryId) return;
        loadedCategoryMusic[category.contestCategoryId] = {
          entryMusic: category.entryPlaylistId || category.entryMusic || "",
          lineupMusic: category.lineupPlaylistId || category.lineupMusic || "",
          poseDownMusic: category.poseDownPlaylistId || category.poseDownMusic || "",
        };
      });
    } else if (rawCatMusic && typeof rawCatMusic === "object") {
      Object.entries(rawCatMusic).forEach(([catId, category]) => {
        loadedCategoryMusic[catId] = {
          entryMusic: category?.entryPlaylistId || category?.entryMusic || "",
          lineupMusic: category?.lineupPlaylistId || category?.lineupMusic || "",
          poseDownMusic: category?.poseDownPlaylistId || category?.poseDownMusic || "",
        };
      });
    }
    setCategoryMusic((prev) => ({
      ...prev,
      ...loadedCategoryMusic,
    }));
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
    const contestId = currentContest?.contests?.id;
    if (!contestId) {
      message.warning("선택된 대회가 없습니다.");
      return;
    }

    const nowFormatted = dayjs().format("YYYY-MM-DD HH:mm:ss");
    const saveData = {
      contestId,
      commonMusic: {
        waitingMusic: commonMusic.waitingMusic || "",
        resultAnnouncementMusic: commonMusic.resultAnnouncementMusic || "",
        awardsMusic: commonMusic.awardsMusic || "",
      },
      categoryMusic: Object.entries(categoryMusic).map(
        ([categoryId, music]) => ({
          contestCategoryId: categoryId,
          entryPlaylistId: music?.entryMusic || "",
          lineupPlaylistId: music?.lineupMusic || "",
          poseDownPlaylistId: music?.poseDownMusic || "",
        })
      ),
      createdAt: createdAt || nowFormatted,
      updatedAt: nowFormatted,
    };

    try {
      let targetDocId = currentDocId;

      if (!targetDocId) {
        const existingDocs = await musicSettingsQuery.getDocuments(
          "contest_music_settings",
          [where("contestId", "==", contestId)]
        );
        if (existingDocs && existingDocs.length > 0) {
          const latest = sortDocsByLatest(existingDocs)[0];
          targetDocId = latest.id;
          setCurrentDocId(latest.id);
        }
      }

      if (!targetDocId) {
        const added = await addMusicSetting.addData(saveData);
        if (added?.id) {
          setCurrentDocId(added.id);
        }
        console.log("Document added:", saveData);
        message.success("새 문서가 추가되었습니다.");
      } else {
        await updateMusicSetting.updateData(targetDocId, saveData);
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
    for (const docItem of duplicateDocs) {
      if (docItem.delete) {
        await deleteMusicSetting.deleteData(docItem.id);
      }
    }
    setDuplicateDocs(remainingDocs);
    if (remainingDocs.length > 0) {
      const latestRemaining = sortDocsByLatest(remainingDocs)[0];
      setCurrentDocId(latestRemaining.id);
      setCreatedAt(latestRemaining.createdAt || dayjs().format("YYYY-MM-DD HH:mm:ss"));
      loadDocumentData(latestRemaining);
    } else {
      setCurrentDocId(null);
    }
    setIsModalVisible(false);
    message.success("선택된 중복 문서가 정리되었습니다.");
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
  };

  const playlistOptions = playlists.map((p) => ({ label: p.name, value: p.id }));

  const commonColumns = [
    {
      title: "구분",
      width: 140,
      render: () => (
        <div className="inline-flex items-center gap-2 text-[13px] font-medium text-[#171717]">
          <Music size={16} strokeWidth={1.5} className="text-[#737373]" />
          <span>공통 음원</span>
        </div>
      ),
    },
    {
      title: "대기 음원",
      dataIndex: "waitingMusic",
      width: 260,
      render: () => (
        <SelectWithLabel
          label="대기 음원"
          value={commonMusic.waitingMusic}
          onChange={(value) => handleCommonMusicChange("waitingMusic", value)}
          options={playlistOptions}
        />
      ),
    },
    {
      title: "성적 발표 음원",
      dataIndex: "resultAnnouncementMusic",
      width: 260,
      render: () => (
        <SelectWithLabel
          label="성적 발표 음원"
          value={commonMusic.resultAnnouncementMusic}
          onChange={(value) =>
            handleCommonMusicChange("resultAnnouncementMusic", value)
          }
          options={playlistOptions}
        />
      ),
    },
    {
      title: "시상식 음원",
      dataIndex: "awardsMusic",
      width: 260,
      render: () => (
        <SelectWithLabel
          label="시상식 음원"
          value={commonMusic.awardsMusic}
          onChange={(value) => handleCommonMusicChange("awardsMusic", value)}
          options={playlistOptions}
        />
      ),
    },
  ];

  const categoryColumns = [
    {
      title: "순서",
      dataIndex: "contestCategoryIndex",
      width: 76,
      align: "center",
      render: (value) => <BibTag number={value} size="sm" />,
    },
    {
      title: "종목명",
      dataIndex: "contestCategoryTitle",
      width: 200,
      render: (value, record) => (
        <div className="space-y-0.5">
          <div className="text-[14px] font-medium text-[#171717]">{value}</div>
          {record.contestCategorySection && (
            <div className="text-[12px] text-[#737373]">
              {record.contestCategorySection}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "출전 음원",
      dataIndex: "entryMusic",
      width: 240,
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
          options={playlistOptions}
        />
      ),
    },
    {
      title: "라인업 음원",
      dataIndex: "lineupMusic",
      width: 240,
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
          options={playlistOptions}
        />
      ),
    },
    {
      title: "포즈다운 음원",
      dataIndex: "poseDownMusic",
      width: 240,
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
          options={playlistOptions}
        />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-[1440px] mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              음원 설정
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              대회 진행 공통 음원과 종목별 출전·라인업·포즈다운 재생목록을 지정합니다
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={handleSave}
              className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <Save size={16} strokeWidth={1.5} />
              <span>설정 저장</span>
            </button>
          </div>
        </header>

        <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
          <div className="border-b border-[#171717]/[0.06] pb-3">
            <h2 className="text-[15px] font-medium text-[#171717]">공통 음원</h2>
          </div>
          <div className="overflow-x-auto">
            <Table
              columns={commonColumns}
              dataSource={[{}]}
              pagination={false}
              loading={isLoading}
              rowKey={() => "common"}
            />
          </div>
        </section>

        <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#171717]/[0.06] pb-3">
            <h2 className="text-[15px] font-medium text-[#171717]">
              종목별 음원
            </h2>
            <span className="text-[12px] font-mono tabular-nums text-[#737373]">
              총 {categories.length}종목
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table
              columns={categoryColumns}
              dataSource={categories}
              pagination={false}
              loading={isLoading}
              rowKey="contestCategoryId"
            />
          </div>
        </section>

        <Modal
          title="중복 음원 설정 문서 정리"
          open={isModalVisible}
          onOk={handleModalOk}
          onCancel={handleModalCancel}
          okText="정리 실행"
          cancelText="취소"
          width={680}
        >
          <Table
            columns={[
              {
                title: "문서 ID",
                dataIndex: "id",
                render: (val) => (
                  <span className="font-mono text-[12px] text-[#525252]">
                    {val}
                  </span>
                ),
              },
              {
                title: "생성 시각",
                dataIndex: "createdAt",
                render: (value) => (
                  <span className="font-mono text-[12px] tabular-nums text-[#525252]">
                    {value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-"}
                  </span>
                ),
              },
              {
                title: "수정 시각",
                dataIndex: "updatedAt",
                render: (value) => (
                  <span className="font-mono text-[12px] tabular-nums text-[#525252]">
                    {value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-"}
                  </span>
                ),
              },
              {
                title: "처리 구분",
                dataIndex: "delete",
                render: (_, record) => (
                  <Select
                    options={[
                      { label: "삭제", value: true },
                      { label: "유지", value: false },
                    ]}
                    value={Boolean(record.delete)}
                    onChange={(value) =>
                      setDuplicateDocs((prev) =>
                        prev.map((item) =>
                          item.id === record.id
                            ? { ...item, delete: value }
                            : item
                        )
                      )
                    }
                  />
                ),
              },
            ]}
            dataSource={duplicateDocs}
            rowKey="id"
            pagination={false}
          />
        </Modal>
      </div>
    </div>
  );
};

export default ContestMusicSetting;
