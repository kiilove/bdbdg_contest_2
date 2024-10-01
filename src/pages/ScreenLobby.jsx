import React, { useContext, useEffect, useState } from "react";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import { useNavigate } from "react-router-dom";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { BsTrophyFill } from "react-icons/bs";

const ScreenLobby = () => {
  const [stageArray, setStageArray] = useState([]);
  const [contestList, setContestList] = useState([]);
  const [contestNoticeId, setContestNoticeId] = useState();
  const [contestId, setContestId] = useState("");
  const navigate = useNavigate();
  const { currentContest } = useContext(CurrentContestContext);
  const fetchStages = useFirestoreQuery();
  const fetchQuery = useFirestoreQuery();
  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );

  const fetchList = async () => {
    const condition = [
      where("contestStatus", "in", ["접수중", "수정됨", "데모용"]),
    ];

    const returnData = await fetchQuery.getDocuments(
      "contest_notice",
      condition
    );

    setContestList([
      ...returnData.sort((a, b) =>
        a.contestTitle.localeCompare(b.contestTitle)
      ),
    ]);

    if (returnData?.length >= 1) {
      setContestNoticeId(returnData[0].id);
    }
  };

  const handleStageInfo = async (contestId, realtimeStageId) => {
    const condition = [where("contestId", "==", contestId)];
    try {
      await fetchStages
        .getDocuments("contest_stages_assign", condition)
        .then((data, error) => {
          console.log({ data, error });
          if (data?.length > 0 && data?.stages?.length > 0 && realtimeStageId) {
            const findStage = data.stages.filter(
              (f) => f.stageId === realtimeStageId
            );
            console.log(findStage);
          }
        });
    } catch (error) {
      console.log(error);
    }
  };

  const handleNavigate = () => {
    console.log(realtimeData); // realtimeData가 올바른 값인지 확인
    if (realtimeData) {
      if (realtimeData?.screen?.status?.playStart === false) {
        console.log("Navigating to /idle with contestId:", contestId); // contestId 출력
        navigate("/idle", { state: { contestId } });
      } else {
        console.log("Navigating to /ranking");
        navigate("/ranking", { state: { contestId } });
      }
    }
  };

  useEffect(() => {
    if (contestId && realtimeData?.stageId) {
      handleStageInfo(contestId, realtimeData?.stageId);
    }
  }, [contestId]);

  useEffect(() => {
    const findContestId = contestList.find((f) => f.id === contestNoticeId);

    if (findContestId) {
      setContestId(findContestId.refContestId);
    }
  }, [contestNoticeId]);

  useEffect(() => {
    fetchList();
  }, []);

  return (
    <div className="flex w-full h-screen justify-center items-center gap-x-2">
      <span className="text-sm text-gray-500">
        <BsTrophyFill />
      </span>
      <select
        className=" bg-transparent text-base"
        onClick={(e) => {
          setContestNoticeId(e.target.value);
        }}
        onChange={(e) => {
          setContestNoticeId(e.target.value);
        }}
      >
        {contestList.length > 0 &&
          contestList.map((list, lIdx) => (
            <option key={lIdx} value={list.id}>
              {list.contestTitle}
            </option>
          ))}
      </select>
      {realtimeData?.screen && (
        <button
          className="bg-blue-500 px-5 py-2 rounded-lg text-white ml-5"
          style={{ width: "150px, height:30px" }}
          onClick={() => handleNavigate()}
        >
          화면전환
        </button>
      )}
    </div>
  );
};

export default ScreenLobby;
