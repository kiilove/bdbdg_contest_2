import React from "react";
import ybbf from "../assets/img/ybbf_logo.png";
import CanvasWithImageData from "./CanvasWithImageData";

const ScoreCardPointForm = ({
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
              <img src={ybbf} alt="" className="w-32" />
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
          <span>6th</span> <span>YONGIN</span> <span>BODYBUILDING</span>
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
              제6회 용인특례시 보디빌딩협회장배 Mr&Ms 보디빌딩 및 피트니스 대회
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
              용인시청 에이스홀
            </div>
            <div className="flex justify-end" style={{ width: "90px" }}>
              DATE :
            </div>
            <div className="flex justify-start ml-2">2023-08-26</div>
          </div>
        </div>
        <div
          className="flex  w-full justify-center items-start p-2 gap-x-3 h-auto font-light text-sm"
          style={{ minHeight: "65%" }}
        >
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
                  className="flex border-black justify-center items-center h-14 flex-col bg-gray-400 border-r-2 "
                  style={{ width: "100px" }}
                >
                  <span>TOTAL</span>
                </div>
                <div
                  className="flex border-black justify-center items-center h-14 flex-col bg-gray-400"
                  style={{ width: "500px" }}
                >
                  <div className="flex border-black border-b w-full justify-center items-center h-7">
                    <span>JUDGING CRITERIA</span>
                  </div>
                  <div className="flex border-black w-full justify-center items-center h-7">
                    <span className="border-r border-black  w-1/6 text-xs h-full flex justify-center items-center">
                      근육발달/선명도
                    </span>
                    <span className="border-r border-black  w-1/6 text-xs h-full flex justify-center items-center">
                      신체대칭/균형
                    </span>
                    <span className="border-r border-black  w-1/6 text-xs h-full flex justify-center items-center">
                      무대포즈와 표현
                    </span>
                    <span className="border-r border-black  w-1/6 text-xs h-full flex justify-center items-center">
                      규정준수
                    </span>
                    <span className="border-r border-black  w-1/6 text-xs h-full flex justify-center items-center">
                      의상/스타일
                    </span>
                    <span className=" border-black  w-1/6 text-xs h-full flex justify-center items-center">
                      비교평가
                    </span>
                  </div>
                </div>
              </div>
              {players?.length > 0 &&
                players
                  .sort((a, b) => a.playerIndex - b.playerIndex)
                  .map((player, pIdx) => {
                    const { playerNumber, playerScore, playerPointArray } =
                      player;
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
                          className="flex border-black justify-center items-center h-14 flex-col bg-white border-r-2"
                          style={{ width: "100px" }}
                        >
                          <span className="text-4xl font-semibold font-sans">
                            {playerScore}
                          </span>
                        </div>
                        <div
                          className="flex border-black justify-center items-center h-14 bg-white"
                          style={{ width: "500px" }}
                        >
                          {playerPointArray?.length > 0 &&
                            playerPointArray.map((item, iIdx) => {
                              const { point } = item;

                              return (
                                <div className="flex w-1/6 h-full justify-center items-center font-semibold font-sans text-xl border-r border-black last:border-r-0">
                                  {point}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
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

export default ScoreCardPointForm;
