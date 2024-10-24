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

    try {
      const addedContest = await contestHook.addData({ isCompleted: false });
      if (addedContest) {
        setNewContestId(addedContest.id);
      }

      const [
        contestNoticeData,
        contestCategorysListData,
        contestGradesListData,
      ] = await Promise.all([
        contestNoticeHook
          .addData({
            refContestId: addedContest.id,
            contestStatus: "접수중",
            contestTitle: "새로운대회",
          })
          .catch((error) => {
            console.error("Error adding contest notice:", error);
            return null;
          }),

        contestCategorysListHook
          .addData({
            refContestId: addedContest.id,
            categorys: [],
          })
          .catch((error) => {
            console.error("Error adding contest category list:", error);
            return null;
          }),
        contestGradesListHook
          .addData({
            refContestId: addedContest.id,
            grades: [],
          })
          .catch((error) => {
            console.error("Error adding contest grades list:", error);
            return null;
          }),
        contestEntrysListHook
          .addData({
            refContestId: addedContest.id,
            entrys: [],
          })
          .catch((error) => {
            console.error("Error adding contest invoices list:", error);
            return null;
          }),
        invoicesPoolHook
          .addData({
            refContestId: addedContest.id,
            invoices: [],
          })
          .catch((error) => {
            console.error("Error adding contest invoices list:", error);
            return null;
          }),
      ]);

      if (
        contestNoticeData &&
        contestCategorysListData &&
        contestGradesListData
      ) {
        await updateContest.updateData(addedContest.id, {
          contestNoticeId: contestNoticeData.id,
          contestCategorysListId: contestCategorysListData.id,
          contestGradesListId: contestGradesListData.id,
        });

        setCurrentContest({
          contestId: addedContest.id,
          contestNoticeId: contestNoticeData.id,
          contestCategorysListId: contestCategorysListData.id,
          contestGradesListId: contestGradesListData.id,
        });

        localStorage.setItem(
          "currentContest",
          JSON.stringify({
            contestId: newContestId,
            contestNoticeId: contestNoticeData.id,
            contestCategorysListId: contestCategorysListData.id,
            contestGradesListId: contestGradesListData.id,
          })
        );
      } else {
        console.error(
          "One or more errors occurred while adding data to collections."
        );
      }
    } catch (error) {
      console.error("Error during the handleStart process:", error);
    } finally {
      setIsLoading(false);
      navigate("/contestinfo");
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
