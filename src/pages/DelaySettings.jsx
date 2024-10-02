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
    localStorage.setItem("playersToShow", playersToShow); // 설정한 선수 수 저장
  };

  return (
    <div>
      <h2>Delay Settings</h2>
      {/* Delay 설정 입력 필드 */}
      <label>
        Ranking Delay (seconds):
        <input
          type="number"
          value={rankingDelay}
          onChange={(e) => setRankingDelay(e.target.value)}
        />
      </label>
      <br />
      <label>
        Final Ranking Delay (seconds):
        <input
          type="number"
          value={rankingFinalDelay}
          onChange={(e) => setRankingFinalDelay(e.target.value)}
        />
      </label>
      <br />
      <label>
        Page Delay (Step 2) (seconds):
        <input
          type="number"
          value={pageDelay}
          onChange={(e) => setPageDelay(e.target.value)}
        />
      </label>
      <br />
      <label>
        Final Page Delay (Step 2) (seconds):
        <input
          type="number"
          value={pageFinalDelay}
          onChange={(e) => setPageFinalDelay(e.target.value)}
        />
      </label>
      <br />
      <label>
        Score Page Delay (Step 3) (seconds):
        <input
          type="number"
          value={scorePageDelay}
          onChange={(e) => setScorePageDelay(e.target.value)}
        />
      </label>
      <br />
      <label>
        Final Score Page Delay (Step 3) (seconds):
        <input
          type="number"
          value={scoreFinalDelay}
          onChange={(e) => setScoreFinalDelay(e.target.value)}
        />
      </label>
      <br />
      {/* 1번 애니메이션에서 보여줄 선수 수 설정 */}
      <label>
        Players to Show (Step 1):
        <input
          type="number"
          value={playersToShow}
          onChange={(e) => setPlayersToShow(e.target.value)}
        />
      </label>
      <br />
      <button onClick={handleSave}>Save</button>
    </div>
  );
};

export default DelaySettings;
