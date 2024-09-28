import React from "react";
import { useState } from "react";
import { useFirestoreAddData, useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { useEffect } from "react";
import dayjs from "dayjs";
import { generateToday } from "../functions/functions";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const ContestAwardCreator = ({ props, setClose }) => {
  const [resultArray, setResultArray] = useState([]);
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});
  const [awardArray, setAwardArray] = useState([]);
  const [currentResult, setCurrentResult] = useState([]);
  const [awardAddArray, setAwardAddArray] = useState([]);
  const [awardUniqeNumber, setAwardUniqueNumber] = useState();
  const fetchQuery = useFirestoreQuery();
  const addDataAward = useFirestoreAddData("contest_award_list");
  const { categoryId, categoryTitle, gradeId, gradeTitle, contestId } = props;

  const fetchPool = async () => {
    const condition = [where("contestId", "==", contestId)];
    const fetchedData = await fetchQuery.getDocuments(
      "contest_results_list",
      condition
    );

    const fetchAwardData = await fetchQuery.getDocuments(
      "contest_award_list",
      condition
    );

    setResultArray(() => [...fetchedData]);
    setAwardArray(() => [...fetchAwardData]);
  };

  const findCurrentResultAndFlatten = (arr) => {
    const finded = arr.find(
      (f) => f.contestId === contestId && f.gradeId === gradeId
    );

    if (finded) {
      const newPlayerInfo = {
        ...finded,
      };

      const flattenPlayerInfo = newPlayerInfo?.result?.map((player, pIdx) => {
        const { playerName, playerGym, playerNumber, playerRank, playerUid } =
          player;
        const { categoryId, categoryTitle, gradeId, gradeTitle, contestId } =
          newPlayerInfo;
        const newInfo = {
          categoryId,
          categoryTitle1: categoryTitle,
          categoryTitle2: "",
          categoryTitle,
          gradeId,
          gradeTitle,
          contestId,
          playerName,
          playerGym,
          playerGym1: playerGym,
          playerGym2: "",
          playerNumber,
          playerRank,
          playerUid,
          isAward: false,
          isMaded: false,
          playerGymFontSize: "22px",
          categoryFontSize: "18px",
          madeYear: dayjs(generateToday()).year().toString(),
        };

        return newInfo;
      });

      console.log(flattenPlayerInfo);

      return flattenPlayerInfo;
    }
  };
  const handleAwardCheck = (e, listIndex, awardNumber) => {
    const { value, checked } = e.target;

    const newAdded = [...awardAddArray];

    if (checked) {
      newAdded.push({
        ...currentResult[listIndex],
        isAward: checked,
        awardNumber,
      });
      setAwardUniqueNumber(() => awardArray.length);
    } else {
      newAdded.splice(listIndex, 1);
    }

    setAwardAddArray(() => [...newAdded]);
  };

  const handleSaveAwardList = async (addArr = []) => {
    if (addArr.length > 0) {
      addArr.map(async (add, aIdx) => {
        try {
          await addDataAward.addData({ ...add }).then(() => {
            setMessage({
              body: "저장완료",
              isButton: true,
              confirmButtonText: "확인",
            });
            setMsgOpen(true);
          });
        } catch (error) {
          console.log(error);
        }
      });
    }
  };

  useEffect(() => {
    setAwardUniqueNumber(() => awardArray.length);
  }, [awardArray]);
  useEffect(() => {
    if (resultArray.length > 0) {
      setCurrentResult(() => [...findCurrentResultAndFlatten(resultArray)]);
    }
  }, [resultArray]);

  useEffect(() => {
    fetchPool();
  }, [contestId]);

  return (
    <div className="flex w-full h-full flex-col p-5 bg-gray-200">
      <ConfirmationModal
        isOpen={msgOpen}
        message={message}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />
      <div className="flex w-full h-14 bg-blue-200 p-2">
        <div className="flex bg-white h-full justify-start items-center w-full px-2">
          종목/체급:{categoryTitle}({gradeTitle})
        </div>
      </div>
      <div className="flex w-full h-14 bg-blue-200 p-2">
        <div className="flex bg-white h-full justify-start items-center w-full px-2">
          순위표
        </div>
      </div>
      <div className="flex w-full h-auto flex-col justify-center items-start">
        <div className="flex w-full h-10 bg-gray-400">
          <div
            className="flex h-full justify-center items-center"
            style={{ width: "10%" }}
          >
            전체
          </div>
          <div
            className="flex h-full justify-center items-center"
            style={{ width: "10%" }}
          >
            연번
          </div>
          <div
            className="flex h-full justify-center items-center"
            style={{ width: "10%" }}
          >
            순위
          </div>
          <div
            className="flex h-full justify-center items-center"
            style={{ width: "10%" }}
          >
            이름
          </div>
          <div
            className="flex h-full justify-center items-center"
            style={{ width: "60%" }}
          >
            소속
          </div>
        </div>
        {currentResult.length > 0 &&
          currentResult
            .sort((a, b) => a.playerRank - b.playerRank)
            .map((curr, cIdx) => {
              const { playerName, playerRank, playerUid, playerGym } = curr;

              return (
                <div className="flex w-full h-10 bg-white">
                  <div
                    className="flex h-full justify-center items-center"
                    style={{ width: "10%" }}
                  >
                    <input
                      type="checkbox"
                      name="playerAward"
                      className="w-5 h-5"
                      value={playerUid}
                      onChange={(e) => {
                        handleAwardCheck(e, cIdx, awardUniqeNumber + cIdx + 1);
                      }}
                    />
                  </div>
                  <div
                    className="flex h-full justify-center items-center"
                    style={{ width: "10%" }}
                  >
                    {awardUniqeNumber + cIdx + 1}
                  </div>
                  <div
                    className="flex h-full justify-center items-center"
                    style={{ width: "10%" }}
                  >
                    {playerRank}
                  </div>
                  <div
                    className="flex h-full justify-center items-center"
                    style={{ width: "10%" }}
                  >
                    {playerName}
                  </div>
                  <div
                    className="flex h-full justify-center items-center"
                    style={{ width: "60%" }}
                  >
                    {playerGym}
                  </div>
                </div>
              );
            })}
        {awardAddArray.length > 0 && (
          <div className="flex w-full h-10 bg-gray-400 justify-center items-center">
            <button onClick={() => handleSaveAwardList(awardAddArray)}>
              상장추가
            </button>
          </div>
        )}
        <div className="flex w-full h-10 bg-gray-400 justify-center items-center">
          <button onClick={() => setClose(false)}>닫기</button>
        </div>
      </div>
    </div>
  );
};

export default ContestAwardCreator;
