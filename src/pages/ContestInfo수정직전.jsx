import React, { useContext, useEffect, useState } from "react";

import { BsInfoLg } from "react-icons/bs";

import "react-datepicker/dist/react-datepicker.css";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import ko from "date-fns/locale/ko"; // Import Korean locale
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
  const returnValue = passwords.map((password, pIdx) => {
    return { id: pIdx, value: password, used: false };
  });
  return returnValue;
};

const ContestInfo = () => {
  const [currentContestInfo, setCurrentContestInfo] = useState({});
  const [judgePasswords, setJudgePasswords] = useState(generatePasswords());
  const updateContestInfo = useFirestoreUpdateData("contest_notice");
  const [files, setFiles] = useState([]);

  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );
  const { progress, urls, errors, representativeImage } = useFirebaseStorage(
    files,
    "images/poster"
  );

  const addCollection = useFirestoreAddData(
    currentContest.contests.collectionName
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
  };
  const formatNumber = (value) => {
    if (isNaN(value) || value === "") {
      return 0;
    } else if (value.length >= 4) {
      return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    } else {
      return parseInt(value).toLocaleString();
    }
  };

  const handleContestInfo = (e) => {
    const { name, value } = e.target;
    const newValue = { ...currentContestInfo, [name]: value };
    setCurrentContestInfo({ ...newValue });
  };

  const handelContestInfoPrice = (e) => {
    const { name, value } = e.target;
    const newValue = { ...currentContestInfo, [name]: formatNumber(value) };
    setCurrentContestInfo({ ...newValue });
  };

  const handleUpdateContestInfo = async (noticeID = null) => {
    console.log(noticeID);
    const contestPriceReformat = (field) => {
      let reFormatNumber = 0;
      if (
        currentContestInfo[field] === undefined ||
        currentContestInfo[field] === null
      ) {
        reFormatNumber = 0;
      } else if (
        currentContestInfo[field] !== "0" &&
        currentContestInfo[field].length > 3
      ) {
        reFormatNumber = parseInt(
          currentContestInfo[field].replaceAll(",", "")
        );
      } else {
        reFormatNumber = parseInt(currentContestInfo[field]);
      }
      return reFormatNumber;
    };

    const dbContestInfo = {
      ...currentContestInfo,
      contestPriceBasic: contestPriceReformat("contestPriceBasic"),
      contestPriceExtra: contestPriceReformat("contestPriceExtra"),
      contestPriceType1: contestPriceReformat("contestPriceType1"),
      contestPriceType2: contestPriceReformat("contestPriceType2"),
    };

    if (noticeID !== null) {
      const updatedData = await updateContestInfo.updateData(
        noticeID,
        dbContestInfo
      );

      if (updatedData) {
        setCurrentContest({
          ...currentContest,
          contestInfo: { ...updatedData },
        });
      }
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
      console.log(error);
    }
  };

  useEffect(() => {
    if (currentContest?.contestInfo) {
      setCurrentContestInfo({ ...initContestInfo });
      setCurrentContestInfo({ ...currentContest.contestInfo });
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
    console.log(currentContest);
  }, [currentContest]);

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg p-3 gap-y-2 justify-start items-start">
      <div className="flex w-full h-14">
        <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
          <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
            <BsInfoLg />
          </span>
          <h1
            className="font-sans text-lg font-semibold"
            style={{ letterSpacing: "2px" }}
          >
            대회정보관리
          </h1>
        </div>
      </div>
      <div className="flex w-full h-full items-start">
        <div className="flex w-full h-full justify-start items-start">
          <div className="hidden lg:flex w-1/4 h-full justify-start items-end pr-3 flex-col gap-y-3 bg-gray-100 rounded-lg">
            <div
              className="flex w-full justify-end items-center "
              style={{ height: "130px" }}
            >
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                대회포스터
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                대회명
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                짧은대회명
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                대회장소
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                대회일자
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                주관
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                주최
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                계좌정보
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                참가비
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                종복참가비
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                타입1 참가비(예:학생부)
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                타입2 참가비(예:대학생부)
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                공고문링크
              </h3>
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                컬렉션이름(임의수정금지)
              </h3>
            </div>
          </div>

          <div className="flex w-full lg:w-3/4 h-full justify-start items-start px-3 lg:pt-0 lg:gap-y-3 flex-col">
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">대회포스터</h3>
            </div>
            <div className="flex w-full h-auto lg:h-32 justify-start items-center rounded-lg mb-3 lg:mb-0 gap-x-2">
              <div className="flex justify-start items-center">
                {currentContestInfo?.contestPoster && (
                  <img
                    src={currentContestInfo.contestPoster}
                    className="w-24 h-32 rounded-lg"
                  />
                )}
              </div>
              <div className="flex justify-start items-end h-full">
                <label htmlFor="contestPoster">
                  <input
                    type="file"
                    multiple
                    name="contestPoster"
                    id="contestPoster"
                    hidden
                    onChange={(e) => setFiles(e.target.files)}
                  />
                  <div className="w-32 h-8 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-lg mt-2 flex justify-center items-center">
                    포스터올리기
                  </div>
                </label>
              </div>
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">대회명</h3>
            </div>
            <div className="flex w-full h-12 justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
              <input
                type="text"
                name="contestTitle"
                id="contestTitle"
                value={currentContestInfo?.contestTitle}
                onChange={(e) => handleContestInfo(e)}
                className="h-10 w-full outline-none mb-1"
              />
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">짧은대회명</h3>
            </div>
            <div className="flex w-full h-12 justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
              <input
                type="text"
                name="contestTitleShort"
                id="contestTitleShort"
                value={currentContestInfo?.contestTitleShort}
                onChange={(e) => handleContestInfo(e)}
                className="h-10 w-full outline-none mb-1"
              />
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">대회장소</h3>
            </div>
            <div className="flex w-full h-12 justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
              <input
                type="text"
                name="contestLocation"
                id="contestLocation"
                value={currentContestInfo?.contestLocation}
                onChange={(e) => handleContestInfo(e)}
                className="h-10 w-full outline-none mb-1"
              />
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">대회일자</h3>
            </div>
            <div className="flex w-full h-12 justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
              <input
                type="text"
                name="contestDate"
                id="contestDate"
                value={currentContestInfo?.contestDate}
                onChange={(e) => handleContestInfo(e)}
                className="h-10 w-full outline-none mb-1"
              />
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">주관</h3>
            </div>
            <div className="flex w-full h-12 justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
              <input
                type="text"
                name="contestAssociate"
                id="contestAssociate"
                value={currentContestInfo?.contestAssociate}
                onChange={(e) => handleContestInfo(e)}
                className="h-10 w-full outline-none mb-1"
              />
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">주최</h3>
            </div>
            <div className="flex w-full h-12 justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
              <input
                type="text"
                name="contestPromoter"
                id="contestPromoter"
                value={currentContestInfo?.contestPromoter}
                onChange={(e) => handleContestInfo(e)}
                className="h-10 w-full outline-none mb-1"
              />
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">계좌정보</h3>
            </div>
            <div className="flex flex-col w-full h-36 lg:h-12 lg:flex-row justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
              <input
                type="text"
                name="contestBankName"
                id="contestBankName"
                value={currentContestInfo?.contestBankName}
                onChange={(e) => handleContestInfo(e)}
                className="h-10 w-full outline-none mb-1"
                placeholder="은행명"
              />
              <input
                type="text"
                name="contestAccountNumber"
                id="contestAccountNumber"
                value={currentContestInfo?.contestAccountNumber}
                onChange={(e) => handleContestInfo(e)}
                className="h-10 w-full outline-none mb-1"
                placeholder="계좌번호"
              />
              <input
                type="text"
                name="contestAccountOwner"
                id="contestAccountOwner"
                value={currentContestInfo?.contestAccountOwner}
                onChange={(e) => handleContestInfo(e)}
                className="h-10 w-full outline-none mb-1"
                placeholder="예금주"
              />
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">기본참가비</h3>
            </div>
            <div className="flex w-full h-12 justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
              <input
                type="text"
                name="contestPriceBasic"
                id="contestPriceBasic"
                value={currentContestInfo.contestPriceBasic?.toLocaleString()}
                onChange={(e) => handleContestInfo(e)}
                onBlur={(e) => handelContestInfoPrice(e)}
                className="h-10 w-full outline-none mb-1"
              />
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">중복참가비</h3>
            </div>
            <div className="flex w-full justify-start items-center rounded-lg mb-3 lg:mb-0 gap-x-2">
              <div className="flex w-1/2 lg:w-1/4 h-12 justify-around items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0 ">
                <label htmlFor="contestPriceExtraTypeSum">
                  <input
                    type="radio"
                    name="contestPriceExtraType"
                    id="contestPriceExtraTypeSum"
                    checked={
                      currentContestInfo?.contestPriceExtraType === "누적"
                    }
                    onChange={(e) => handleContestInfo(e)}
                    value="누적"
                  />
                  <span className="ml-1">누적</span>
                </label>
                <label htmlFor="contestPriceExtraTypeFixed">
                  <input
                    type="radio"
                    name="contestPriceExtraType"
                    id="contestPriceExtraTypeFixed"
                    onChange={(e) => handleContestInfo(e)}
                    value="정액"
                  />
                  <span className="ml-1">정액</span>
                </label>
                <label htmlFor="contestPriceExtraTypeNone">
                  <input
                    type="radio"
                    name="contestPriceExtraType"
                    id="contestPriceExtraTypeNone"
                    onChange={(e) => handleContestInfo(e)}
                    value="없음"
                  />
                  <span className="ml-1">없음</span>
                </label>
              </div>
              <div className="flex w-1/2 lg:w-3/4 h-12 justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
                <input
                  type="text"
                  name="contestPriceExtra"
                  id="contestPriceExtra"
                  value={currentContestInfo.contestPriceExtra?.toLocaleString()}
                  onChange={(e) => handleContestInfo(e)}
                  onBlur={(e) => handelContestInfoPrice(e)}
                  className="h-10 w-full outline-none mb-1"
                />
              </div>
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">
                타입1 참가비(예:학생부)
              </h3>
            </div>
            <div className="flex w-full h-12 justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
              <input
                type="text"
                name="contestPriceType1"
                id="contestPriceType1"
                value={currentContestInfo.contestPriceType1?.toLocaleString()}
                onChange={(e) => handleContestInfo(e)}
                onBlur={(e) => handelContestInfoPrice(e)}
                className="h-10 w-full outline-none mb-1"
              />
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">
                타입2 참가비(예:대학생부)
              </h3>
            </div>
            <div className="flex w-full h-12 justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
              <input
                type="text"
                name="contestPriceType2"
                id="contestPriceType2"
                value={currentContestInfo.contestPriceType2?.toLocaleString()}
                onChange={(e) => handleContestInfo(e)}
                onBlur={(e) => handelContestInfoPrice(e)}
                className="h-10 w-full outline-none mb-1"
              />
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">공고문링크</h3>
            </div>
            <div className="flex w-full h-12 justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
              <input
                type="text"
                name="contestCollectionFileLink"
                id="contestCollectionFileLink"
                value={currentContestInfo?.contestCollectionFileLink}
                onChange={(e) => handleContestInfo(e)}
                className="h-10 w-full outline-none mb-1"
              />
            </div>
            <div className="flex lg:hidden px-3">
              <h3 className="font-sans font-semibold">
                컬렉션이름(임의수정금지)
              </h3>
            </div>
            <div className="flex w-full h-12 justify-start items-center border-b-gray-300 border border-b-2 border-r-2 rounded-lg px-3 mb-3 lg:mb-0">
              <input
                type="text"
                name="contestCollectionName"
                id="contestCollectionName"
                value={currentContestInfo?.contestCollectionName}
                onChange={(e) => handleContestInfo(e)}
                className="h-10 w-5/6 outline-none mb-1"
              />
              {currentContestInfo?.contestCollectionName && (
                <button className="w-1/6" onClick={() => handleCollectionAdd()}>
                  컬렉션생성
                </button>
              )}
            </div>
            <div className="flex w-full h-12 justify-end items-center">
              <button
                className="w-32 h-12 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-lg mt-2"
                onClick={() =>
                  handleUpdateContestInfo(
                    currentContest.contests.contestNoticeId
                  )
                }
              >
                저장
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContestInfo;
