"use client";

import { useContext, useEffect, useState } from "react";
import { BsInfoLg } from "react-icons/bs";
import { message, Progress, Card, Input, Button } from "antd";
import { UploadOutlined, SaveOutlined, PlusOutlined } from "@ant-design/icons";
import "react-datepicker/dist/react-datepicker.css";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useParams } from "react-router-dom";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import useFirebaseStorage from "../hooks/useFirebaseStorage";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Seoul");

const generatePasswords = () => {
  const passwords = [];
  const usedPasswords = new Set();
  while (passwords.length < 100) {
    const password = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    if (!usedPasswords.has(password)) {
      passwords.push(password);
      usedPasswords.add(password);
    }
  }
  return passwords.map((password, pIdx) => ({
    id: pIdx,
    value: password,
    used: false,
  }));
};

const ContestInfo = () => {
  const [currentContestInfo, setCurrentContestInfo] = useState({});
  const [originalContestInfo, setOriginalContestInfo] = useState({});
  const [changed, setChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [judgePasswords] = useState(generatePasswords());
  const updateContestInfo = useFirestoreUpdateData("contest_notice");
  const [files, setFiles] = useState([]);
  const [orgLogo, setOrgLogo] = useState([]);

  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );
  const { progress, urls, errors } = useFirebaseStorage(files, "images/poster");
  const {
    progress: orgLogoProgress,
    urls: orgLogoUrls,
    errors: orgLogoErrors,
  } = useFirebaseStorage(orgLogo, "org/logos");

  const addCollection = useFirestoreAddData(
    currentContest?.contests?.collectionName || ""
  );
  const addPlayersAssign = useFirestoreAddData("contest_players_assign");
  const addPlayersFinal = useFirestoreAddData("contest_players_final");
  const addJudgesAssign = useFirestoreAddData("contest_judges_assign");
  const addPasswords = useFirestoreAddData("contest_passwords");
  const addStagesAssign = useFirestoreAddData("contest_stages_assign");
  const addComparesList = useFirestoreAddData("contest_compares_list");
  const updateContest = useFirestoreUpdateData("contests");
  const params = useParams();

  const initContestInfo = {
    contestAccountNumber: "",
    contestAccountOwner: "",
    contestAssociate: "",
    contestBankName: "",
    contestCollectionFileLink: "",
    contestDate: "",
    contestLocation: "",
    contestPoster: "",
    contestPosterTheme: [],
    contestPriceBasic: 0,
    contestPriceExtra: 0,
    contestPriceExtraType: "누적",
    contestPriceType1: 0,
    contestPriceType2: 0,
    contestPromoter: "",
    contestStatus: "",
    contestTitle: "",
    contestTitleShort: "",
    contestOrgLogo: "",
  };

  useEffect(() => {
    setChanged(
      JSON.stringify(originalContestInfo) !== JSON.stringify(currentContestInfo)
    );
  }, [currentContestInfo, originalContestInfo]);

  const formatNumber = (value) => {
    if (isNaN(value) || value === "") return 0;
    if (value.length >= 4) return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return Number.parseInt(value).toLocaleString();
  };

  const handleContestInfo = (e) => {
    const { name, value } = e.target;
    setCurrentContestInfo({ ...currentContestInfo, [name]: value });
  };

  const handelContestInfoPrice = (e) => {
    const { name, value } = e.target;
    setCurrentContestInfo({
      ...currentContestInfo,
      [name]: formatNumber(value),
    });
  };

  const handleUpdateContestInfo = async (noticeID = null) => {
    if (!currentContest?.contests?.contestNoticeId && !noticeID) return;
    const targetId = noticeID || currentContest.contests.contestNoticeId;
    setLoading(true);

    const contestPriceReformat = (field) => {
      const v = currentContestInfo[field];
      if (v === undefined || v === null) return 0;
      if (typeof v === "string" && v.includes(","))
        return Number.parseInt(v.replaceAll(",", ""));
      return Number.parseInt(v) || 0;
    };

    const dbContestInfo = {
      ...currentContestInfo,
      contestPriceBasic: contestPriceReformat("contestPriceBasic"),
      contestPriceExtra: contestPriceReformat("contestPriceExtra"),
      contestPriceType1: contestPriceReformat("contestPriceType1"),
      contestPriceType2: contestPriceReformat("contestPriceType2"),
    };

    try {
      const updatedData = await updateContestInfo.updateData(
        targetId,
        dbContestInfo
      );
      if (updatedData) {
        setCurrentContest({
          ...currentContest,
          contestInfo: { ...updatedData },
        });
        setOriginalContestInfo({ ...updatedData });
        setChanged(false);
        message.success("대회 정보가 저장되었습니다");
      }
    } catch (error) {
      console.error(error);
      message.error("저장 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleCollectionAdd = async () => {
    try {
      const addedCollection = await addCollection.addData({
        contestId: currentContest.contests.id,
      });
      const addedStagesAssign = await addStagesAssign.addData({
        contestId: currentContest.contests.id,
        collectionName: currentContestInfo.contestCollectionName,
        stages: [],
      });
      const addedPlayersAssign = await addPlayersAssign.addData({
        contestId: currentContest.contests.id,
        players: [],
      });
      const addedJudgesAssign = await addJudgesAssign.addData({
        contestId: currentContest.contests.id,
        judges: [],
      });
      const addedPlayersFinal = await addPlayersFinal.addData({
        contestId: currentContest.contests.id,
        players: [],
      });
      const addedPassword = await addPasswords.addData({
        passwords: [...judgePasswords],
        contestId: currentContest.contests.id,
      });
      const addedCompare = await addComparesList.addData({
        contestId: currentContest.contests.id,
        compares: [],
      });

      await updateContest.updateData(currentContest.contests.id, {
        ...currentContest.contests,
        contestStagesAssignId: addedStagesAssign.id,
        contestPasswordId: addedPassword.id,
        contestPlayersAssignId: addedPlayersAssign.id,
        contestPlayersFinalId: addedPlayersFinal.id,
        contestJudgesAssignId: addedJudgesAssign.id,
        contestComparesListId: addedCompare.id,
        collectionName: currentContestInfo.contestCollectionName,
      });
    } catch (error) {
      console.error(error);
      message.error("컬렉션 생성 중 오류가 발생했습니다");
    }
  };

  useEffect(() => {
    if (currentContest?.contestInfo) {
      setCurrentContestInfo({
        ...initContestInfo,
        ...currentContest.contestInfo,
      });
      setOriginalContestInfo({
        ...initContestInfo,
        ...currentContest.contestInfo,
      });
    }
  }, [currentContest?.contestInfo]);

  useEffect(() => {
    if (urls.length > 0) {
      setFiles([]);
      setCurrentContestInfo((prev) => ({
        ...prev,
        contestPoster: urls[0].compressedUrl,
        contestPosterTheme: [...urls[0].colorTheme],
      }));
    }
  }, [urls]);

  useEffect(() => {
    if (orgLogoUrls.length > 0) {
      setOrgLogo([]);
      setCurrentContestInfo((prev) => ({
        ...prev,
        contestOrgLogo: orgLogoUrls[0].compressedUrl,
      }));
    }
  }, [orgLogoUrls]);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <Card className="mb-6 shadow-sm border-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-md">
                <BsInfoLg className="text-xl" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">대회정보관리</h1>
            </div>
            {changed && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-lg border border-red-200">
                <span className="text-red-600 text-sm font-medium">
                  수정사항이 저장되지 않았습니다
                </span>
              </div>
            )}
          </div>
        </Card>

        {progress > 0 && progress < 100 && (
          <Card className="mb-4 shadow-sm border-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">
                포스터 업로드 중
              </span>
              <Progress
                percent={Math.round(progress)}
                size="small"
                status="active"
                className="flex-1"
              />
            </div>
          </Card>
        )}
        {orgLogoProgress > 0 && orgLogoProgress < 100 && (
          <Card className="mb-4 shadow-sm border-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">
                로고 업로드 중
              </span>
              <Progress
                percent={Math.round(orgLogoProgress)}
                size="small"
                status="active"
                className="flex-1"
              />
            </div>
          </Card>
        )}

        <Card title="이미지 관리" className="mb-6 shadow-sm border-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 포스터 업로드 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                대회 포스터
              </label>
              <div className="flex flex-col items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 transition-colors bg-gray-50">
                {currentContestInfo?.contestPoster && (
                  <img
                    src={currentContestInfo.contestPoster || "/placeholder.svg"}
                    className="w-full max-w-[200px] h-auto rounded-lg shadow-md"
                    alt="poster"
                  />
                )}
                <input
                  type="file"
                  multiple
                  id="contestPoster"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const fileArr = Array.from(e.target.files || []);
                    if (fileArr.length > 0) setFiles(fileArr);
                    e.target.value = "";
                  }}
                />
                <Button
                  icon={<UploadOutlined />}
                  className="w-full"
                  size="large"
                  type="primary"
                  onClick={() =>
                    document.getElementById("contestPoster")?.click()
                  }
                >
                  포스터 업로드
                </Button>
              </div>
            </div>

            {/* 로고 업로드 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                협회 로고
              </label>
              <div className="flex flex-col items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 transition-colors bg-gray-50">
                {currentContestInfo?.contestOrgLogo && (
                  <img
                    src={
                      currentContestInfo.contestOrgLogo || "/placeholder.svg"
                    }
                    className="w-full max-w-[200px] h-auto rounded-lg shadow-md"
                    alt="logo"
                  />
                )}
                <input
                  type="file"
                  multiple
                  id="orgLogo"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const fileArr = Array.from(e.target.files || []);
                    if (fileArr.length > 0) setOrgLogo(fileArr);
                    e.target.value = "";
                  }}
                />
                <Button
                  icon={<UploadOutlined />}
                  className="w-full"
                  size="large"
                  type="primary"
                  onClick={() => document.getElementById("orgLogo")?.click()}
                >
                  로고 업로드
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card title="기본 정보" className="mb-6 shadow-sm border-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                대회명
              </label>
              <Input
                name="contestTitle"
                placeholder="대회명을 입력하세요"
                value={currentContestInfo?.contestTitle || ""}
                onChange={handleContestInfo}
                size="large"
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                짧은 대회명
              </label>
              <Input
                name="contestTitleShort"
                placeholder="짧은 대회명을 입력하세요"
                value={currentContestInfo?.contestTitleShort || ""}
                onChange={handleContestInfo}
                size="large"
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                대회 장소
              </label>
              <Input
                name="contestLocation"
                placeholder="대회 장소를 입력하세요"
                value={currentContestInfo?.contestLocation || ""}
                onChange={handleContestInfo}
                size="large"
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                대회 일자
              </label>
              <Input
                name="contestDate"
                placeholder="YYYY-MM-DD"
                value={currentContestInfo?.contestDate || ""}
                onChange={handleContestInfo}
                size="large"
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                주관
              </label>
              <Input
                name="contestAssociate"
                placeholder="주관 기관을 입력하세요"
                value={currentContestInfo?.contestAssociate || ""}
                onChange={handleContestInfo}
                size="large"
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                주최
              </label>
              <Input
                name="contestPromoter"
                placeholder="주최 기관을 입력하세요"
                value={currentContestInfo?.contestPromoter || ""}
                onChange={handleContestInfo}
                size="large"
                className="rounded-lg"
              />
            </div>
          </div>
        </Card>

        <Card title="계좌 정보" className="mb-6 shadow-sm border-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                은행명
              </label>
              <Input
                name="contestBankName"
                placeholder="은행명"
                value={currentContestInfo?.contestBankName || ""}
                onChange={handleContestInfo}
                size="large"
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                계좌번호
              </label>
              <Input
                name="contestAccountNumber"
                placeholder="계좌번호"
                value={currentContestInfo?.contestAccountNumber || ""}
                onChange={handleContestInfo}
                size="large"
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                예금주
              </label>
              <Input
                name="contestAccountOwner"
                placeholder="예금주"
                value={currentContestInfo?.contestAccountOwner || ""}
                onChange={handleContestInfo}
                size="large"
                className="rounded-lg"
              />
            </div>
          </div>
        </Card>

        <Card title="참가비 정보" className="mb-6 shadow-sm border-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                기본 참가비
              </label>
              <Input
                name="contestPriceBasic"
                placeholder="기본 참가비"
                value={
                  currentContestInfo?.contestPriceBasic?.toLocaleString?.() ||
                  ""
                }
                onChange={handleContestInfo}
                onBlur={handelContestInfoPrice}
                size="large"
                className="rounded-lg"
                suffix="원"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                중복 참가비
              </label>
              <Input
                name="contestPriceExtra"
                placeholder="중복 참가비"
                value={
                  currentContestInfo?.contestPriceExtra?.toLocaleString?.() ||
                  ""
                }
                onChange={handleContestInfo}
                onBlur={handelContestInfoPrice}
                size="large"
                className="rounded-lg"
                suffix="원"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                타입1 참가비 (예: 학생부)
              </label>
              <Input
                name="contestPriceType1"
                placeholder="타입1 참가비"
                value={
                  currentContestInfo?.contestPriceType1?.toLocaleString?.() ||
                  ""
                }
                onChange={handleContestInfo}
                onBlur={handelContestInfoPrice}
                size="large"
                className="rounded-lg"
                suffix="원"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                타입2 참가비 (예: 대학생부)
              </label>
              <Input
                name="contestPriceType2"
                placeholder="타입2 참가비"
                value={
                  currentContestInfo?.contestPriceType2?.toLocaleString?.() ||
                  ""
                }
                onChange={handleContestInfo}
                onBlur={handelContestInfoPrice}
                size="large"
                className="rounded-lg"
                suffix="원"
              />
            </div>
          </div>
        </Card>

        <Card title="추가 정보" className="mb-6 shadow-sm border-0">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                공고문 링크
              </label>
              <Input
                name="contestCollectionFileLink"
                placeholder="공고문 링크를 입력하세요"
                value={currentContestInfo?.contestCollectionFileLink || ""}
                onChange={handleContestInfo}
                size="large"
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                컬렉션 이름{" "}
                <span className="text-red-500 text-xs">(임의 수정 금지)</span>
              </label>
              <div className="flex gap-3">
                <Input
                  name="contestCollectionName"
                  placeholder="컬렉션 이름"
                  value={currentContestInfo?.contestCollectionName || ""}
                  onChange={handleContestInfo}
                  size="large"
                  className="rounded-lg flex-1"
                />
                {currentContestInfo?.contestCollectionName && (
                  <Button
                    icon={<PlusOutlined />}
                    onClick={handleCollectionAdd}
                    size="large"
                    type="dashed"
                  >
                    컬렉션 생성
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-end sticky bottom-4 z-10">
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            loading={loading}
            disabled={!changed}
            onClick={() =>
              handleUpdateContestInfo(currentContest?.contests?.contestNoticeId)
            }
            className={`px-8 h-12 rounded-xl shadow-lg ${
              changed
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 border-0"
                : ""
            }`}
          >
            저장하기
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ContestInfo;
