import React, { useContext, useState } from "react";
import { ThreeDots } from "react-loader-spinner";
import { useNavigate } from "react-router-dom";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";

const NewContest = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [newContestId, setNewContestId] = useState();
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

  const handleStart = async () => {
    setIsLoading(true);
    let createdSuccess = false;

    try {
      const addedContest = await contestHook.addData({ isCompleted: false });
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
        alert("대회 기본 컬렉션 생성 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error("Error during the handleStart process:", error);
      alert("새로운 대회를 개설하는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
      if (createdSuccess) {
        navigate("/contestinfo");
      }
    }
  };

  return (
    <div className="flex flex-col justify-center items-center w-full h-screen bg-gray-100">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
        <h1 className="text-2xl text-center mb-4">새로운 대회를 개설합니다</h1>
        <div className="flex justify-center">
          {isLoading ? (
            <button className="w-40 h-12 bg-gray-900 text-white font-bold rounded-lg flex justify-center items-center">
              <ThreeDots
                height="40"
                width="40"
                radius="9"
                color="#fff"
                ariaLabel="three-dots-loading"
                wrapperStyle={{}}
                wrapperClassName=""
                visible={true}
              />
            </button>
          ) : (
            <button
              className="w-40 h-12 bg-blue-600 text-white font-bold rounded-lg"
              onClick={() => handleStart()}
            >
              대회개설
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewContest;
