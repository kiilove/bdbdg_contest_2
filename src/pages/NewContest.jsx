import React, { useMemo } from "react";
import { useContext } from "react";
import { useState } from "react";
import { ThreeDots } from "react-loader-spinner";
import { useNavigate } from "react-router-dom";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";

import Body from "../assets/img/body4.jpg";

const NewContest = () => {
  const [isLoading, setIsLoading] = useState(false);
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

      // Check if any errors occurred during the Promise.all execution
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

        // Save the contest data to local storage
        localStorage.setItem(
          "currentContest",
          JSON.stringify({
            contestId: addedContest.id,
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
    <div
      className="flex w-full bg-transparent flex-col justify-center items-center"
      style={{ minHeight: "850px" }}
    >
      <div
        className="flex w-full h-full p-10 bg-white rounded-lg shadow-lg"
        style={{
          backgroundImage: `url(${Body})`,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "left",
          minHeight: "100%",
        }}
      >
        <div
          className="flex w-full justify-center items-end mt-5 flex-col p-10 rounded-lg shadow-lg"
          style={{ backgroundColor: "rgba(7,11,41,0.7)" }}
        >
          <div className="flex w-full h-full justify-center items-center lg:items-end flex-col">
            <div className="flex w-full h-full justify-center items-center lg:justify-end">
              <h1 className="text-2xl lg:text-3xl text-gray-200">
                새로운 대회를 개설합니다.
              </h1>
            </div>
            <div className="flex h-full">
              {isLoading ? (
                <button className=" w-40 h-10 md:h-14 bg-gray-900 border text-white text-lg font-bold">
                  <span className="flex w-full h-full text-white text-base justify-center items-center">
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
                  </span>
                </button>
              ) : (
                <button
                  className=" w-40 h-10 md:h-14 bg-gray-900 border text-white text-lg font-bold"
                  onClick={() => handleStart()}
                >
                  <span>대회개설</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewContest;
