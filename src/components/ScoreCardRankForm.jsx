import React from "react";
import ybbf from "../assets/img/ybbf_logo.png";
import sbbf from "../assets/img/sbbf_logo.png";

import CanvasWithImageData from "./CanvasWithImageData";

const ScoreCardRankForm = ({
  contestInfo,
  seatIndex,
  categoryTitle,
  gradeTitle,
  judgeSignature,
  judgeName,
  judgePromoter,
  players,
}) => {
  return (
    <div className="flex w-full h-full bg-white justify-center items-start ">
      <div
        className="w-full h-full bg-white flex flex-col p-5"
        style={{
          width: "210mm",
          height: "297mm",
        }}
      >
        <div className="flex w-full h-auto justify-center items-center p-2">
          <div className="flex w-1/3"></div>
          <div className="flex w-1/3 justify-center items-center">
            <div className="flex">
              <img src={contestInfo?.contestOrgLogo} alt="" className="w-32" />
            </div>
          </div>
          <div className="flex w-1/3 justify-end">
            <div className="flex flex-col w-full h-full justify-center items-center">
              <div className="flex w-40 h-28 border-4 border-black justify-center items-center">
                <span className="text-7xl font-semibold font-sans">
                  {seatIndex}
                </span>
              </div>
              <div className="flex justify-center items-start text-sm">
                JUDGE`S NUMBER
              </div>
            </div>
          </div>
        </div>
        <div className="flex w-full h-auto justify-center items-center p-2 gap-x-2">
          <span>BODYBUILDING</span>
          <span>FERDERATIONS</span>
        </div>
        <div className="flex w-full justify-center items-center p-2 gap-x-3 bg-black h-7 text-white font-light text-sm">
          <span>FINALS</span>
          <span>MARK</span>
          <span>SHEET</span>
        </div>
        <div className="flex w-full justify-center items-center p-2 gap-x-3 h-auto font-light text-sm flex-col">
          <div className="flex w-full h-auto text-xs">
            <div className="flex justify-end" style={{ width: "90px" }}>
              COMPETITION :
            </div>
            <div className="flex w-1/2 justify-start ml-2">
              {contestInfo?.contestTitle}
            </div>
            <div className="flex justify-end" style={{ width: "90px" }}>
              CATEGORY :
            </div>
            <div className="flex justify-start ml-2">
              {categoryTitle}/{gradeTitle}
            </div>
          </div>
          <div className="flex w-full h-auto text-xs">
            <div className="flex justify-end" style={{ width: "90px" }}>
              PLACE :
            </div>
            <div className="flex w-1/2 justify-start ml-2">
              {contestInfo?.contestLocation}
            </div>
            <div className="flex justify-end" style={{ width: "90px" }}>
              DATE :
            </div>
            <div className="flex justify-start ml-2">
              {contestInfo?.contestDate}
            </div>
          </div>
        </div>
        <div
          className="flex  w-full justify-center items-start p-2 gap-x-3 h-auto font-light text-sm"
          style={{ minHeight: "65%" }}
        >
          <div className="flex flex-col w-1/4 text-xs gap-y-3">
            <div className="flex justify-center">
              <span>PROCEDURES</span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">1. </span>
              <span>
                Enter your judge's number in the box provided in the upper
                right-hand corner
              </span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">2. </span>
              <span>
                Complete the top portion of the form by filling in the
                competition, category, place, and date.
              </span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">3. </span>
              <span>
                Enter ther competitors number in the numerical order, lowest to
                highest, in the "competitor number" column.
              </span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">4. </span>
              <span>
                Place the top5 competitors from 1 to 5 by entering their place
                in the "place" column.
              </span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">5. </span>
              <span>Do not give two or more competitors the same place.</span>
            </div>{" "}
            <div className="flex justify-start">
              <span className="mr-1">6. </span>
              <span>All competitors must be placed.</span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">7. </span>
              <span>
                If you make a mistake place an "X" through the mistake and write
                the correct decision to ther right of this.
              </span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">8. </span>
              <span>Print your name and country.</span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">9. </span>
              <span>Write your signature.</span>
            </div>
          </div>
          <div className="flex w-1/2 justify-center">
            <div className="flex border-2 w-auto h-auto border-black flex-col items-start justify-center">
              <div className="flex w-auto">
                <div
                  className="flex border-r-2 border-black justify-center items-center h-14 flex-col bg-gray-400"
                  style={{ width: "100px" }}
                >
                  <span>COMPETITOR</span>
                  <span>NUMBER</span>
                </div>
                <div
                  className="flex border-black justify-center items-center h-14 flex-col bg-gray-400"
                  style={{ width: "100px" }}
                >
                  <span>PLACE</span>
                </div>
              </div>
              {players?.length > 0 &&
                players
                  .sort((a, b) => a.playerIndex - b.playerIndex)
                  .map((player, pIdx) => {
                    const { playerNumber, playerScore } = player;
                    if (playerScore >= 1000) {
                      return null;
                    }
                    return (
                      <div className="flex w-auto border-t-2 border-black">
                        <div
                          className="flex border-r-2 border-black justify-center items-center h-14 flex-col bg-white"
                          style={{ width: "100px" }}
                        >
                          <span className="text-2xl font-semibold font-sans italic text-gray-700">
                            {playerNumber}
                          </span>
                        </div>
                        <div
                          className="flex border-black justify-center items-center h-14 flex-col bg-white"
                          style={{ width: "100px" }}
                        >
                          <span className="text-4xl font-semibold font-sans">
                            {playerScore}
                          </span>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
          <div className="flex flex-col w-1/4 text-xs  gap-y-3">
            <div className="flex justify-center w-full">
              <span>절차</span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">1. </span>
              <span>
                오른쪽 위에 있는 네모칸안에 심판의 번호를 기입하십시오
              </span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">2. </span>
              <span>대회명, 체급, 장소, 날짜를 정확하게 기입하십시오.</span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">3. </span>
              <span>
                COMPETITOR NUMBER칸에 출전선수들이 번호를 순서대로 기입하십시오.
              </span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">4. </span>
              <span>PLACE칸에 선수들의 성적을 1위부터 기입하십시오.</span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">5. </span>
              <span>한 등위를 두명 이상의 선수에게 기입하면 안됩니다.</span>
            </div>{" "}
            <div className="flex justify-start">
              <span className="mr-1">6. </span>
              <span>모든 선수들의 성적을 기입해야 합니다.</span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">7. </span>
              <span>
                만약 등위를 잘못 기입하였다면 "X" 표시를하고, 오른쪽에 정확한
                등위를 다시 기입한 후 본인의 서명을 하십시오.
              </span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">8. </span>
              <span>당신의 성명과 나라(시,도)를 기입하십시오.</span>
            </div>
            <div className="flex justify-start">
              <span className="mr-1">9. </span>
              <span>당신의 서명을 하십시오.</span>
            </div>
          </div>
        </div>
        <div className="flex w-full h-auto justify-center items-center p-2">
          <div className="flex w-1/3 flex-col justify-start items-start px-5">
            <span className="text-xs w-full">JUDGE'S NAME(PRINT) (성명)</span>
            <div className="flex h-10 border-b border-black w-full items-end">
              <span className="text-lg font-semibold">{judgeName}</span>
            </div>
          </div>
          <div className="flex w-1/3 flex-col justify-start items-start px-5">
            <span className="text-xs w-full">COUNTRY(PRINT) (소속/시,도)</span>
            <div className="flex h-10 border-b border-black w-full items-end">
              <span className="text-lg font-semibold">{judgePromoter}</span>
            </div>
          </div>
          <div className="flex w-1/3 flex-col justify-start items-start px-5">
            <span className="text-xs w-full">JUDGE'S SIGNATURE (서명)</span>
            <div className="flex h-10 border-b border-black w-full items-end ">
              <span className="text-lg font-semibold">
                <CanvasWithImageData
                  imageData={judgeSignature}
                  style={{ width: "220px" }}
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreCardRankForm;
