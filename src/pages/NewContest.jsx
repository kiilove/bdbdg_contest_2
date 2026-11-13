import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, FolderPlus } from "lucide-react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const NewContest = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [newContestId, setNewContestId] = useState();
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});
  const contestHook = useFirestoreAddData("contests");
  const updateContest = useFirestoreUpdateData("contests");
  const contestNoticeHook = useFirestoreAddData("contest_notice");
  const contestJudgesListHook = useFirestoreAddData("contest_judges_list");
  const contestCategorysListHook = useFirestoreAddData(
    "contest_categorys_list"
  );
  const contestGradesListHook = useFirestoreAddData("contest_grades_list");
  const contestEntrysListHook = useFirestoreAddData("contest_entrys_list");
  const invoicesPoolHook = useFirestoreAddData("invoices_pool");
  const { setCurrentContest } = useContext(CurrentContestContext);
  const navigate = useNavigate();

  // Keep unused hook references intact
  void contestJudgesListHook;
  void contestEntrysListHook;
  void invoicesPoolHook;

  const handleStart = async () => {
    setIsLoading(true);
    let createdSuccess = false;

    try {
      const addedContest = await contestHook.addData({
        isCompleted: false,
        startPlayerNumber: 1,
      });
      if (!addedContest?.id) {
        throw new Error("대회 문서 생성에 실패했습니다.");
      }

      const createdContestId = addedContest.id;
      setNewContestId(createdContestId);

      const [
        contestNoticeData,
        contestCategorysListData,
        contestGradesListData,
      ] = await Promise.all([
        contestNoticeHook
          .addData({
            contestId: createdContestId,
            refContestId: createdContestId,
            contestStatus: "접수중",
            contestTitle: "새로운대회",
          })
          .catch((error) => {
            console.error("Error adding contest notice:", error);
            return null;
          }),

        contestCategorysListHook
          .addData({
            contestId: createdContestId,
            refContestId: createdContestId,
            categorys: [],
          })
          .catch((error) => {
            console.error("Error adding contest category list:", error);
            return null;
          }),
        contestGradesListHook
          .addData({
            contestId: createdContestId,
            refContestId: createdContestId,
            grades: [],
          })
          .catch((error) => {
            console.error("Error adding contest grades list:", error);
            return null;
          }),
      ]);

      if (
        contestNoticeData &&
        contestCategorysListData &&
        contestGradesListData
      ) {
        const contestLinks = {
          contestNoticeId: contestNoticeData.id,
          contestCategorysListId: contestCategorysListData.id,
          contestGradesListId: contestGradesListData.id,
        };

        await updateContest.updateData(createdContestId, contestLinks);

        const nextContestContext = {
          contests: {
            ...addedContest,
            ...contestLinks,
            id: createdContestId,
          },
          contestInfo: { ...contestNoticeData },
        };

        setCurrentContest(nextContestContext);
        sessionStorage.setItem(
          "currentContest",
          JSON.stringify(nextContestContext)
        );
        localStorage.setItem(
          "currentContest",
          JSON.stringify(nextContestContext)
        );
        createdSuccess = true;
      } else {
        console.error(
          "One or more errors occurred while adding data to collections."
        );
        setModalMessage({
          variant: "error",
          title: "대회 컬렉션 생성 오류",
          body: "대회 기본 컬렉션 생성 중 오류가 발생했습니다.",
          isButton: true,
          confirmButtonText: "확인",
        });
        setMsgOpen(true);
      }
    } catch (error) {
      console.error("Error during the handleStart process:", error);
      setModalMessage({
        variant: "error",
        title: "대회 개설 실패",
        body: "새로운 대회를 개설하는 중 오류가 발생했습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      setMsgOpen(true);
    } finally {
      setIsLoading(false);
      if (createdSuccess) {
        navigate("/contestinfo");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />
      <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              새 대회 개설
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              신규 대회의 기본 요강 문서와 종목·체급 컬렉션을 초기화합니다
            </p>
          </div>
        </header>

        <div className="max-w-2xl bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-6 space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] flex items-center justify-center shrink-0">
              <FolderPlus size={18} strokeWidth={1.5} className="text-[#525252]" />
            </div>
            <div className="space-y-1">
              <h2 className="text-[15px] font-medium text-[#171717]">
                대회 데이터 공간 생성
              </h2>
              <p className="text-[13px] text-[#525252] leading-5">
                개설 즉시 접수 상태의 기본 대회가 생성되며, 완료 후 대회 정보 설정 화면으로 이동합니다
              </p>
            </div>
          </div>

          <div className="bg-[#f4f4f5] rounded-[8px] p-4 space-y-2 border border-[#171717]/[0.06]">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#525252]">초기 상태</span>
              <span className="font-medium text-[#171717]">접수중</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#525252]">자동 생성 컬렉션</span>
              <span className="font-mono text-[12px] text-[#525252] tabular-nums">
                notice · categorys · grades
              </span>
            </div>
            {newContestId && (
              <div className="flex items-center justify-between text-[13px] pt-1 border-t border-[#171717]/[0.06]">
                <span className="text-[#525252]">생성된 대회 ID</span>
                <span className="font-mono text-[12px] text-[#171717] tabular-nums">
                  {newContestId}
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleStart()}
              className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white text-[13px] font-medium inline-flex items-center justify-center gap-2 transition-colors duration-150"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                  <span>개설 처리 중</span>
                </>
              ) : (
                <>
                  <Plus size={16} strokeWidth={1.5} />
                  <span>대회 개설</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewContest;
