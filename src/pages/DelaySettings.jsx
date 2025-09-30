import React, { useState, useEffect } from "react";

const DelaySettings = () => {
  const [rankingDelay, setRankingDelay] = useState(5); // 1번 애니메이션 딜레이
  const [rankingFinalDelay, setRankingFinalDelay] = useState(5); // 마지막 순위 딜레이
  const [pageDelay, setPageDelay] = useState(5); // 2번 애니메이션 딜레이
  const [pageFinalDelay, setPageFinalDelay] = useState(5); // 2번 마지막 페이지 딜레이
  const [scorePageDelay, setScorePageDelay] = useState(5); // 3번 페이지 딜레이
  const [scoreFinalDelay, setScoreFinalDelay] = useState(5); // 3번 마지막 페이지 딜레이
  const [playersToShow, setPlayersToShow] = useState(5); // 1번 애니메이션에서 보여줄 선수 수

  useEffect(() => {
    const savedRankingDelay = localStorage.getItem("rankingDelay") || 5;
    const savedRankingFinalDelay =
      localStorage.getItem("rankingFinalDelay") || 5;
    const savedPageDelay = localStorage.getItem("pageDelay") || 5;
    const savedPageFinalDelay = localStorage.getItem("pageFinalDelay") || 5;
    const savedScorePageDelay = localStorage.getItem("scorePageDelay") || 5;
    const savedScoreFinalDelay = localStorage.getItem("scoreFinalDelay") || 5;
    const savedPlayersToShow = localStorage.getItem("playersToShow") || 5;

    setRankingDelay(Number(savedRankingDelay));
    setRankingFinalDelay(Number(savedRankingFinalDelay));
    setPageDelay(Number(savedPageDelay));
    setPageFinalDelay(Number(savedPageFinalDelay));
    setScorePageDelay(Number(savedScorePageDelay));
    setScoreFinalDelay(Number(savedScoreFinalDelay));
    setPlayersToShow(Number(savedPlayersToShow));
  }, []);

  const handleSave = () => {
    localStorage.setItem("rankingDelay", rankingDelay);
    localStorage.setItem("rankingFinalDelay", rankingFinalDelay);
    localStorage.setItem("pageDelay", pageDelay);
    localStorage.setItem("pageFinalDelay", pageFinalDelay);
    localStorage.setItem("scorePageDelay", scorePageDelay);
    localStorage.setItem("scoreFinalDelay", scoreFinalDelay);
    localStorage.setItem("playersToShow", playersToShow);
    alert("설정이 저장되었습니다.");
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        ⏱️ 애니메이션 딜레이 설정
      </h2>

      <div className="flex flex-col gap-4">
        {/* 1번 애니메이션 */}
        <div>
          <label className="block font-semibold mb-1 text-gray-700">
            1단계 순위 애니메이션 딜레이 (초)
          </label>
          <p className="text-sm text-gray-500 mb-1">
            순위 공개 애니메이션 사이의 대기 시간을 설정합니다.
          </p>
          <input
            type="number"
            min={1}
            className="w-full border rounded px-3 py-2"
            value={rankingDelay}
            onChange={(e) => setRankingDelay(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-semibold mb-1 text-gray-700">
            1단계 마지막 순위 딜레이 (초)
          </label>
          <p className="text-sm text-gray-500 mb-1">
            마지막 순위가 공개된 후 멈추는 시간을 설정합니다.
          </p>
          <input
            type="number"
            min={1}
            className="w-full border rounded px-3 py-2"
            value={rankingFinalDelay}
            onChange={(e) => setRankingFinalDelay(e.target.value)}
          />
        </div>

        {/* 2번 페이지 전환 */}
        <div>
          <label className="block font-semibold mb-1 text-gray-700">
            2단계 페이지 전환 딜레이 (초)
          </label>
          <p className="text-sm text-gray-500 mb-1">
            2단계 순위 페이지가 넘어가는 속도를 설정합니다.
          </p>
          <input
            type="number"
            min={1}
            className="w-full border rounded px-3 py-2"
            value={pageDelay}
            onChange={(e) => setPageDelay(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-semibold mb-1 text-gray-700">
            2단계 마지막 페이지 대기 시간 (초)
          </label>
          <p className="text-sm text-gray-500 mb-1">
            2단계의 마지막 페이지에서 멈추는 시간을 설정합니다.
          </p>
          <input
            type="number"
            min={1}
            className="w-full border rounded px-3 py-2"
            value={pageFinalDelay}
            onChange={(e) => setPageFinalDelay(e.target.value)}
          />
        </div>

        {/* 3번 점수 페이지 */}
        <div>
          <label className="block font-semibold mb-1 text-gray-700">
            3단계 점수 페이지 딜레이 (초)
          </label>
          <p className="text-sm text-gray-500 mb-1">
            점수 페이지가 전환되는 속도를 설정합니다.
          </p>
          <input
            type="number"
            min={1}
            className="w-full border rounded px-3 py-2"
            value={scorePageDelay}
            onChange={(e) => setScorePageDelay(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-semibold mb-1 text-gray-700">
            3단계 마지막 점수 페이지 대기 시간 (초)
          </label>
          <p className="text-sm text-gray-500 mb-1">
            점수 페이지 마지막 화면에서 멈추는 시간을 설정합니다.
          </p>
          <input
            type="number"
            min={1}
            className="w-full border rounded px-3 py-2"
            value={scoreFinalDelay}
            onChange={(e) => setScoreFinalDelay(e.target.value)}
          />
        </div>

        {/* 1번 애니메이션에서 보여줄 선수 수 */}
        <div>
          <label className="block font-semibold mb-1 text-gray-700">
            1단계에서 보여줄 선수 수
          </label>
          <p className="text-sm text-gray-500 mb-1">
            한 번에 공개할 선수의 수를 설정합니다.
          </p>
          <input
            type="number"
            min={1}
            className="w-full border rounded px-3 py-2"
            value={playersToShow}
            onChange={(e) => setPlayersToShow(e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        className="mt-6 w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition-colors"
      >
        💾 설정 저장
      </button>
    </div>
  );
};

export default DelaySettings;
