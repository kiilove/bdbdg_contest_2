import React from "react";
import { generateToday } from "../functions/functions";
import dayjs from "dayjs";
import ybbfStamp from "../assets/img/ybbf_stamp.png";

const PrintAwardForm = ({
  playerName,
  awardNumber,
  categoryTitle1,
  categoryTitle2,
  categoryFontSize,
  gradeTitle,
  playerRank,
  playerGym1,
  playerGym2,
  playerGymFontSize,
}) => {
  return (
    <div
      className="flex w-full h-full bg-white flex-col justify-start items-start p-14 "
      style={{ fontFamily: "ChosunGs", width: "210mm" }}
    >
      <div className="flex justify-start items-end w-full h-24 gap-x-1 px-20">
        <div className="flex">제</div>
        <div className="flex">{dayjs(generateToday()).year()}</div>
        <div className="flex">-</div>
        <div className="flex">{awardNumber}</div>
        <div className="flex">호</div>
      </div>
      <div className="flex justify-center items-center w-full h-52">
        <span
          className="text-7xl font-bold"
          style={{ fontFamily: "ChosunGs", letterSpacing: "60px" }}
        >
          상장
        </span>
      </div>
      <div className="flex justify-center items-start w-full h-auto px-10">
        <div
          className="flex w-1/4 flex-col items-end justify-center text-lg mr-2 h-auto "
          style={{
            lineHeight: "18px",
            minHeight: "50px",
            fontSize: `${categoryFontSize}`,
          }}
        >
          <span>{categoryTitle1}</span>
          <span>{categoryTitle2}</span>
          <span>{gradeTitle}</span>
        </div>
        <div
          className="flex w-2/4 justify-between items-center "
          style={{ letterSpacing: "10px", fontSize: "24px", minHeight: "50px" }}
        >
          <span>급</span>
          <span>소속:</span>
        </div>
        <div
          className="flex w-1/4 justify-center items-start flex-col "
          style={{
            fontSize: `${playerGymFontSize}`,
            minHeight: "50px",
            lineHeight: "18px",
          }}
        >
          <span className="flex justify-start items-start h-auto">
            {playerGym1}
          </span>
          <span>{playerGym2}</span>
        </div>
      </div>
      <div className="flex justify-center items-start w-full h-auto px-10 mt-2">
        <div
          className="flex w-1/4 flex-col items-end mr-2"
          style={{ fontSize: "24px" }}
        >
          <span>{playerRank}</span>
        </div>
        <div
          className="flex w-2/4 justify-between"
          style={{ letterSpacing: "10px", fontSize: "24px" }}
        >
          <span>위</span>
          <span>성명:</span>
        </div>
        <div
          className="flex w-1/4 justify-start items-start"
          style={{ fontSize: "24px" }}
        >
          <span>{playerName}</span>
        </div>
      </div>
      <div className="flex w-full flex-col items-center justify-start gap-y-2 mt-24">
        <div
          className="flex w-full justify-center items-start text-3xl font-semibold"
          style={{ letterSpacing: "7px" }}
        >
          위는 제6회 용인특례시 보디빌딩 및
        </div>
        <div
          className="flex w-full justify-center items-start text-3xl font-semibold"
          style={{ letterSpacing: "7px" }}
        >
          피트니스 대회에서 두서와 같은 성적
        </div>
        <div
          className="flex w-full justify-center items-start text-3xl font-semibold"
          style={{ letterSpacing: "7px" }}
        >
          을 거두어 이에 상장을 수여합니다.
        </div>
      </div>
      <div
        className="flex w-full flex-col items-center justify-start gap-y-2 mt-20 text-2xl font-semibold"
        style={{ letterSpacing: "3px" }}
      >
        2023년 8월 26일
      </div>
      <div className="flex w-full flex-col items-center justify-start gap-y-2 mt-14 text-xl relative z-10">
        <div className="flex flex-col w-5/6 gap-y-2 ">
          <div
            className="flex text-3xl font-bold"
            style={{ letterSpacing: "24px" }}
          >
            용인특례시보디빌딩협회
          </div>
          <div className="flex text-3xl font-bold">
            <span className="mr-10" style={{ letterSpacing: "70px" }}>
              회장
            </span>
            <div className="flex" style={{ width: "30px" }}></div>
            <div className=" flex justify-end w-1/2 gap-x-24">
              <span>윤</span>
              <span>송</span>
              <span className="mr-2">훈</span>
            </div>
          </div>
        </div>
        <div className="flex absolute -top-3 right-11 -z-10">
          <img src={ybbfStamp} className="z-0" />
        </div>
      </div>
    </div>
  );
};

export default PrintAwardForm;
