import React, { useEffect, useState } from "react";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import { useNavigate } from "react-router-dom";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { BsTrophyFill } from "react-icons/bs";

const ScreenLobby = () => {
  const [, setStageArray] = useState([]);
  const [contestList, setContestList] = useState([]);
  const [contestNoticeId, setContestNoticeId] = useState();
  const [contestId, setContestId] = useState("");
  const navigate = useNavigate();
  const fetchStages = useFirestoreQuery();
  const fetchQuery = useFirestoreQuery();
  const { data: realtimeData } = useFirebaseRealtimeGetDocument(
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

    const sortedList = [...(returnData || [])].sort((a, b) =>
      (a?.contestTitle || "").localeCompare(b?.contestTitle || "")
    );
    setContestList(sortedList);

    if (sortedList.length >= 1) {
      setContestNoticeId(sortedList[0].id);
    }
  };

  const handleStageInfo = async (targetContestId, realtimeStageId) => {
    const condition = [where("contestId", "==", targetContestId)];
    try {
      const data = await fetchStages.getDocuments(
        "contest_stages_assign",
        condition
      );
      const stageDoc = Array.isArray(data) ? data[0] : data;
      if (stageDoc?.stages?.length > 0) {
        setStageArray(stageDoc.stages || []);
        if (realtimeStageId) {
          stageDoc.stages.filter((f) => f.stageId === realtimeStageId);
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleNavigate = () => {
    if (realtimeData) {
      if (realtimeData?.screen?.status?.playStart === false) {
        navigate("/idle", { state: { contestId } });
      } else {
        navigate("/ranking", { state: { contestId } });
      }
    }
  };

  useEffect(() => {
    if (contestId && realtimeData?.stageId) {
      handleStageInfo(contestId, realtimeData?.stageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId, realtimeData?.stageId]);

  useEffect(() => {
    const findContestId = contestList.find((f) => f.id === contestNoticeId);

    if (findContestId) {
      setContestId(findContestId.refContestId);
    }
  }, [contestNoticeId, contestList]);

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
