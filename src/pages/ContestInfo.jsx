"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { Upload, Save, Plus, ShieldCheck } from "lucide-react";
import ContestHealthCheckModal from "../modals/ContestHealthCheckModal";
import ConfirmationModal from "../messageBox/ConfirmationModal";
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

const inputBaseClass =
  "w-full h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] px-3 text-[14px] text-[#171717] placeholder:text-[#737373] focus:outline-none focus:border-[#2563eb] transition-colors duration-150";

const ContestInfo = () => {
  const [currentContestInfo, setCurrentContestInfo] = useState({});
  const [originalContestInfo, setOriginalContestInfo] = useState({});
  const [changed, setChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});
  const confirmActionRef = useRef(null);

  const openModalMessage = (nextMsg, onConfirmAction = null) => {
    confirmActionRef.current = onConfirmAction;
    setModalMessage(nextMsg);
    setMsgOpen(true);
  };
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

  const targetCollectionName = (
    currentContestInfo?.contestCollectionName ||
    currentContest?.contests?.collectionName ||
    ""
  ).trim();
  const addCollection = useFirestoreAddData(targetCollectionName);
  const addPlayersAssign = useFirestoreAddData("contest_players_assign");
  const addPlayersFinal = useFirestoreAddData("contest_players_final");
  const addJudgesAssign = useFirestoreAddData("contest_judges_assign");
  const addPasswords = useFirestoreAddData("contest_passwords");
  const addStagesAssign = useFirestoreAddData("contest_stages_assign");
  const addComparesList = useFirestoreAddData("contest_compares_list");
  const updateContest = useFirestoreUpdateData("contests");
  const params = useParams();

  void errors;
  void orgLogoErrors;
  void params;

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
    if (value === undefined || value === null || value === "") return 0;
    const cleaned = String(value).replace(/,/g, "").trim();
    if (cleaned === "" || isNaN(Number(cleaned))) return 0;
    return Number.parseInt(cleaned, 10).toLocaleString();
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
        openModalMessage({
          variant: "success",
          title: "대회 정보 저장 완료",
          body: "대회 기본 요강 및 운영 정보가 저장되었습니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
      }
    } catch (error) {
      console.error(error);
      openModalMessage({
        variant: "error",
        title: "대회 정보 저장 실패",
        body: "저장 중 오류가 발생했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    } finally {
      setLoading(false);
    }
  };

  const executeCollectionCreation = async (trimmedCollectionName) => {
    openModalMessage({
      variant: "loading",
      title: "대회 운영 컬렉션 생성 중",
      body: "배정·계측·비밀번호·비교심사 보조 문서를 생성하고 있습니다.",
      isButton: false,
    });

    try {
      const contestId = currentContest.contests.id;
      const addedCollection = await addCollection.addData({
        contestId,
      });
      const addedStagesAssign = await addStagesAssign.addData({
        contestId,
        collectionName: trimmedCollectionName,
        stages: [],
      });
      const addedPlayersAssign = await addPlayersAssign.addData({
        contestId,
        players: [],
      });
      const addedJudgesAssign = await addJudgesAssign.addData({
        contestId,
        judges: [],
      });
      const addedPlayersFinal = await addPlayersFinal.addData({
        contestId,
        players: [],
      });
      const addedPassword = await addPasswords.addData({
        passwords: [...judgePasswords],
        contestId,
      });
      const addedCompare = await addComparesList.addData({
        contestId,
        compares: [],
      });

      if (
        !addedCollection?.id ||
        !addedStagesAssign?.id ||
        !addedPlayersAssign?.id ||
        !addedJudgesAssign?.id ||
        !addedPlayersFinal?.id ||
        !addedPassword?.id ||
        !addedCompare?.id
      ) {
        openModalMessage({
          variant: "error",
          title: "컬렉션 생성 불완전",
          body: "일부 보조 문서 생성에 실패했습니다. 구조 무결성 점검에서 복구해 주세요.",
          isButton: true,
          confirmButtonText: "확인",
        });
        return;
      }

      const nextContestsDoc = {
        ...currentContest.contests,
        contestStagesAssignId: addedStagesAssign.id,
        contestPasswordId: addedPassword.id,
        contestPlayersAssignId: addedPlayersAssign.id,
        contestPlayersFinalId: addedPlayersFinal.id,
        contestJudgesAssignId: addedJudgesAssign.id,
        contestComparesListId: addedCompare.id,
        collectionName: trimmedCollectionName,
      };

      const updated = await updateContest.updateData(contestId, nextContestsDoc);
      if (updated) {
        setCurrentContest({
          ...currentContest,
          contests: nextContestsDoc,
        });
        openModalMessage({
          variant: "success",
          title: "대회 컬렉션 생성 완료",
          body: `'${trimmedCollectionName}' 채점 DB 및 보조 운영 문서가 생성되었습니다.`,
          isButton: true,
          confirmButtonText: "확인",
        });
      }
    } catch (error) {
      console.error(error);
      openModalMessage({
        variant: "error",
        title: "컬렉션 생성 실패",
        body: "컬렉션 생성 중 오류가 발생했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  const handleCollectionAdd = async () => {
    if (!currentContest?.contests?.id) {
      openModalMessage({
        variant: "warning",
        title: "대회 선택 필요",
        body: "현재 선택된 대회 정보가 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      return;
    }

    const trimmedCollectionName = (
      currentContestInfo?.contestCollectionName || ""
    ).trim();
    if (!trimmedCollectionName) {
      openModalMessage({
        variant: "warning",
        title: "컬렉션 이름 입력 필요",
        body: "생성할 채점 DB 컬렉션 이름을 먼저 입력해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      return;
    }

    const existingCompanionKeys = [
      "contestStagesAssignId",
      "contestPasswordId",
      "contestPlayersAssignId",
      "contestPlayersFinalId",
      "contestJudgesAssignId",
      "contestComparesListId",
    ];
    const hasExistingCompanions = existingCompanionKeys.some((key) =>
      Boolean(currentContest?.contests?.[key])
    );

    if (hasExistingCompanions) {
      openModalMessage(
        {
          variant: "danger",
          title: "기존 보조 컬렉션 덮어쓰기 확인",
          body: "이미 생성된 대회 보조 컬렉션(배정·비밀번호·비교심사 등)이 존재합니다.",
          body2: "새로 생성하면 기존 문서 연결이 새 문서로 교체됩니다. 계속하시겠습니까?",
          isButton: true,
          cancelButtonText: "취소",
          confirmButtonText: "새로 생성",
        },
        () => executeCollectionCreation(trimmedCollectionName)
      );
      return;
    }

    await executeCollectionCreation(trimmedCollectionName);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="w-full min-h-screen bg-[#fafafa]">
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => {
          confirmActionRef.current = null;
          setMsgOpen(false);
        }}
        onConfirm={() => {
          const action = confirmActionRef.current;
          confirmActionRef.current = null;
          setMsgOpen(false);
          if (action) action();
        }}
      />
      <div className="max-w-[1440px] mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              대회 정보 관리
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              대회 기본 요강, 입금 계좌, 참가비 및 운영 컬렉션을 관리합니다
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {changed && (
              <span className="inline-flex items-center h-9 px-3 rounded-[8px] bg-[#dc2626]/[0.08] text-[#dc2626] text-[12px] font-medium">
                저장되지 않은 변경사항 있음
              </span>
            )}
            <button
              type="button"
              onClick={() => setHealthModalOpen(true)}
              className="h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <ShieldCheck size={16} strokeWidth={1.5} className="text-[#525252]" />
              <span>구조 무결성 점검</span>
            </button>
            <button
              type="button"
              disabled={!changed || loading}
              onClick={() =>
                handleUpdateContestInfo(currentContest?.contests?.contestNoticeId)
              }
              className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#f4f4f5] disabled:text-[#737373] disabled:border disabled:border-[#171717]/[0.08] text-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <Save size={16} strokeWidth={1.5} />
              <span>{loading ? "저장 중" : "변경사항 저장"}</span>
            </button>
          </div>
        </header>

        <ContestHealthCheckModal
          isOpen={healthModalOpen}
          onClose={() => setHealthModalOpen(false)}
        />

        {progress > 0 && progress < 100 && (
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 flex items-center gap-4">
            <span className="text-[13px] font-medium text-[#525252] shrink-0">
              포스터 업로드 중
            </span>
            <div className="flex-1 h-2 bg-[#f4f4f5] rounded-[4px] overflow-hidden">
              <div
                className="h-full bg-[#2563eb] transition-colors duration-150"
                style={{ width: `${Math.round(progress)}%` }}
              />
            </div>
            <span className="text-[12px] font-mono tabular-nums text-[#525252]">
              {Math.round(progress)}%
            </span>
          </div>
        )}

        {orgLogoProgress > 0 && orgLogoProgress < 100 && (
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 flex items-center gap-4">
            <span className="text-[13px] font-medium text-[#525252] shrink-0">
              로고 업로드 중
            </span>
            <div className="flex-1 h-2 bg-[#f4f4f5] rounded-[4px] overflow-hidden">
              <div
                className="h-full bg-[#2563eb] transition-colors duration-150"
                style={{ width: `${Math.round(orgLogoProgress)}%` }}
              />
            </div>
            <span className="text-[12px] font-mono tabular-nums text-[#525252]">
              {Math.round(orgLogoProgress)}%
            </span>
          </div>
        )}

        {/* 이미지 관리 */}
        <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
          <div className="border-b border-[#171717]/[0.06] pb-3">
            <h2 className="text-[15px] font-medium text-[#171717]">이미지 관리</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-[#525252]">
                대회 포스터
              </label>
              <div className="flex flex-col items-center justify-between gap-4 p-5 border border-dashed border-[#171717]/[0.14] rounded-[8px] bg-[#fafafa] min-h-[180px]">
                {currentContestInfo?.contestPoster ? (
                  <img
                    src={currentContestInfo.contestPoster || "/placeholder.svg"}
                    className="w-full max-w-[180px] h-auto rounded-[8px] border border-[#171717]/[0.08]"
                    alt="poster"
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[13px] text-[#737373]">
                    등록된 포스터가 없습니다
                  </div>
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
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("contestPoster")?.click()
                  }
                  className="h-9 px-4 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
                >
                  <Upload size={16} strokeWidth={1.5} className="text-[#525252]" />
                  <span>포스터 업로드</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-[#525252]">
                협회 로고
              </label>
              <div className="flex flex-col items-center justify-between gap-4 p-5 border border-dashed border-[#171717]/[0.14] rounded-[8px] bg-[#fafafa] min-h-[180px]">
                {currentContestInfo?.contestOrgLogo ? (
                  <img
                    src={currentContestInfo.contestOrgLogo || "/placeholder.svg"}
                    className="w-full max-w-[180px] h-auto rounded-[8px] border border-[#171717]/[0.08]"
                    alt="logo"
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[13px] text-[#737373]">
                    등록된 협회 로고가 없습니다
                  </div>
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
                <button
                  type="button"
                  onClick={() => document.getElementById("orgLogo")?.click()}
                  className="h-9 px-4 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
                >
                  <Upload size={16} strokeWidth={1.5} className="text-[#525252]" />
                  <span>로고 업로드</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 기본 정보 */}
        <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
          <div className="border-b border-[#171717]/[0.06] pb-3">
            <h2 className="text-[15px] font-medium text-[#171717]">기본 정보</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#525252]">
                대회명
              </label>
              <input
                name="contestTitle"
                placeholder="대회명 입력"
                value={currentContestInfo?.contestTitle || ""}
                onChange={handleContestInfo}
                className={inputBaseClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#525252]">
                짧은 대회명
              </label>
              <input
                name="contestTitleShort"
                placeholder="약칭 입력"
                value={currentContestInfo?.contestTitleShort || ""}
                onChange={handleContestInfo}
                className={inputBaseClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#525252]">
                대회 장소
              </label>
              <input
                name="contestLocation"
                placeholder="개최 장소 입력"
                value={currentContestInfo?.contestLocation || ""}
                onChange={handleContestInfo}
                className={inputBaseClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#525252]">
                대회 일자
              </label>
              <input
                name="contestDate"
                placeholder="YYYY-MM-DD"
                value={currentContestInfo?.contestDate || ""}
                onChange={handleContestInfo}
                className={`${inputBaseClass} tabular-nums`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#525252]">
                주관
              </label>
              <input
                name="contestAssociate"
                placeholder="주관 기관 입력"
                value={currentContestInfo?.contestAssociate || ""}
                onChange={handleContestInfo}
                className={inputBaseClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#525252]">
                주최
              </label>
              <input
                name="contestPromoter"
                placeholder="주최 기관 입력"
                value={currentContestInfo?.contestPromoter || ""}
                onChange={handleContestInfo}
                className={inputBaseClass}
              />
            </div>
          </div>
        </section>

        {/* 계좌 정보 */}
        <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
          <div className="border-b border-[#171717]/[0.06] pb-3">
            <h2 className="text-[15px] font-medium text-[#171717]">계좌 정보</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#525252]">
                은행명
              </label>
              <input
                name="contestBankName"
                placeholder="은행명"
                value={currentContestInfo?.contestBankName || ""}
                onChange={handleContestInfo}
                className={inputBaseClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#525252]">
                계좌번호
              </label>
              <input
                name="contestAccountNumber"
                placeholder="계좌번호"
                value={currentContestInfo?.contestAccountNumber || ""}
                onChange={handleContestInfo}
                className={`${inputBaseClass} tabular-nums`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#525252]">
                예금주
              </label>
              <input
                name="contestAccountOwner"
                placeholder="예금주"
                value={currentContestInfo?.contestAccountOwner || ""}
                onChange={handleContestInfo}
                className={inputBaseClass}
              />
            </div>
          </div>
        </section>

        {/* 참가비 정보 */}
        <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
          <div className="border-b border-[#171717]/[0.06] pb-3">
            <h2 className="text-[15px] font-medium text-[#171717]">참가비 정보</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "contestPriceBasic", label: "기본 참가비" },
              { name: "contestPriceExtra", label: "중복 참가비" },
              { name: "contestPriceType1", label: "타입1 참가비 · 학생부" },
              { name: "contestPriceType2", label: "타입2 참가비 · 대학생부" },
            ].map((item) => (
              <div key={item.name} className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#525252]">
                  {item.label}
                </label>
                <div className="relative flex items-center">
                  <input
                    name={item.name}
                    placeholder="0"
                    value={
                      currentContestInfo?.[item.name]?.toLocaleString?.() || ""
                    }
                    onChange={handleContestInfo}
                    onBlur={handelContestInfoPrice}
                    className={`${inputBaseClass} pr-8 text-right tabular-nums`}
                  />
                  <span className="absolute right-3 text-[13px] text-[#737373] pointer-events-none">
                    원
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 추가 정보 */}
        <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
          <div className="border-b border-[#171717]/[0.06] pb-3">
            <h2 className="text-[15px] font-medium text-[#171717]">추가 정보</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#525252]">
                공고문 링크
              </label>
              <input
                name="contestCollectionFileLink"
                placeholder="https://"
                value={currentContestInfo?.contestCollectionFileLink || ""}
                onChange={handleContestInfo}
                className={inputBaseClass}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[13px] font-medium text-[#525252]">
                  컬렉션 이름
                </label>
                <span className="text-[12px] text-[#dc2626]">
                  운영 중 임의 수정 금지
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  name="contestCollectionName"
                  placeholder="컬렉션 식별자 입력"
                  value={currentContestInfo?.contestCollectionName || ""}
                  onChange={handleContestInfo}
                  className={`${inputBaseClass} flex-1 font-mono text-[13px]`}
                />
                {currentContestInfo?.contestCollectionName && (
                  <button
                    type="button"
                    onClick={handleCollectionAdd}
                    className="h-9 px-3.5 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] border border-[#171717]/[0.12] text-[#171717] text-[13px] font-medium inline-flex items-center justify-center gap-2 shrink-0 transition-colors duration-150"
                  >
                    <Plus size={16} strokeWidth={1.5} className="text-[#525252]" />
                    <span>컬렉션 생성</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={!changed || loading}
            onClick={() =>
              handleUpdateContestInfo(currentContest?.contests?.contestNoticeId)
            }
            className="h-10 px-6 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#f4f4f5] disabled:text-[#737373] disabled:border disabled:border-[#171717]/[0.08] text-white text-[14px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
          >
            <Save size={16} strokeWidth={1.5} />
            <span>{loading ? "저장 중" : "변경사항 저장"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContestInfo;
