/**
 * 심판 채점(랭킹형 / 점수형) 최고·최저 제외 및 합산 순수 엔진
 * - 기존 비즈니스 로직(5심제=제외없음, 7심제=최고/최저 각 1명 제외, 9심제=각 2명 제외,
 *   순위제외 >= 1000 처리 규칙)을 100% 동일하게 보존합니다.
 */

export const isScoreEntered = (val) =>
  val !== undefined && val !== null && val !== "" && Number(val) !== 0;

/**
 * 심판제별 최고·최저 제외 인원 (5심제=0명, 7심제=각 1명씩 제외, 9심제=각 2명씩 제외)
 */
export const getTrimCountPerSide = (count) => {
  const n = Number(count) || 0;
  if (n >= 9) return 2;
  if (n >= 7) return 1;
  return 0;
};

/**
 * 기대 심판 좌석 번호 배열(1..N) 산출
 */
export const computeJudgeSeatNumbers = (
  scoreData = [],
  expectedJudgeCount = 0
) => {
  const expected = Number(expectedJudgeCount) || 0;
  const maxInScores = (Array.isArray(scoreData) ? scoreData : []).reduce(
    (max, item) => Math.max(max, Number(item?.seatIndex) || 0),
    0
  );
  const totalSeats = expected > 0 ? expected : maxInScores;
  if (totalSeats > 0) {
    return Array.from({ length: totalSeats }, (_, i) => i + 1);
  }
  return [];
};

/**
 * [랭킹형(순위형)] 최고(가장 작은 등수) · 최저(가장 큰 등수) 제외 및 합산
 */
export const assignMinMaxAndCalculateRankTotal = (group) => {
  if (!group || !Array.isArray(group.score)) return group;

  group.score.forEach((s) => {
    s.isMin = false;
    s.isMax = false;
  });

  const validSubmitted = group.score.filter((s) =>
    isScoreEntered(s.playerScore)
  );
  const N = validSubmitted.length;
  const trimCount = getTrimCountPerSide(N);

  if (trimCount > 0) {
    const sorted = [...validSubmitted].sort(
      (a, b) => Number(a.playerScore) - Number(b.playerScore)
    );

    // 가장 좋은 등수(가장 작은 숫자 = 최고점) trimCount명 제외 -> isMin = true
    for (let i = 0; i < trimCount; i++) {
      sorted[i].isMin = true;
    }

    // 가장 낮은 등수(가장 큰 숫자 = 최저점) trimCount명 제외 -> isMax = true
    for (let i = N - trimCount; i < N; i++) {
      sorted[i].isMax = true;
    }
  }

  const activeScores = validSubmitted.filter((s) => !s.isMin && !s.isMax);
  if (activeScores.length === 0) {
    group.totalScore = 0;
  } else if (activeScores.some((s) => Number(s.playerScore) >= 1000)) {
    group.totalScore = Math.max(
      1000,
      activeScores.reduce((acc, curr) => acc + Number(curr.playerScore || 0), 0)
    );
  } else {
    group.totalScore = activeScores.reduce(
      (acc, curr) => acc + Number(curr.playerScore || 0),
      0
    );
  }
  return group;
};

/**
 * [점수형(포인트형)] 최저점 · 최고점 제외 및 합산 (순위제외 >= 1000은 최저점 취급)
 */
export const assignMinMaxAndCalculatePointTotal = (group) => {
  if (!group || !Array.isArray(group.score)) return group;

  group.score.forEach((s) => {
    s.isMin = false;
    s.isMax = false;
  });

  const validSubmitted = group.score.filter((s) =>
    isScoreEntered(s.playerScore)
  );
  const N = validSubmitted.length;
  const trimCount = getTrimCountPerSide(N);

  if (trimCount > 0) {
    const toComparablePoint = (val) => {
      const num = Number(val) || 0;
      return num >= 1000 ? -1 : num;
    };
    const sorted = [...validSubmitted].sort(
      (a, b) =>
        toComparablePoint(a.playerScore) - toComparablePoint(b.playerScore)
    );

    // 최저점(가장 작은 숫자) trimCount명 제외 -> isMin = true
    for (let i = 0; i < trimCount; i++) {
      sorted[i].isMin = true;
    }

    // 최고점(가장 큰 숫자) trimCount명 제외 -> isMax = true
    for (let i = N - trimCount; i < N; i++) {
      sorted[i].isMax = true;
    }
  }

  const activeScores = validSubmitted.filter((s) => !s.isMin && !s.isMax);
  if (activeScores.length === 0) {
    group.totalScore = 0;
  } else if (activeScores.some((s) => Number(s.playerScore) >= 1000)) {
    group.totalScore = Math.max(
      1000,
      activeScores.reduce((acc, curr) => acc + Number(curr.playerScore || 0), 0)
    );
  } else {
    group.totalScore = activeScores.reduce(
      (acc, curr) => acc + Number(curr.playerScore || 0),
      0
    );
  }
  return group;
};

/**
 * 경고 알림음 재생 (재생 종료 후 AudioContext 즉시 close하여 브라우저 오디오 스레드 누수 방지)
 */
export const playWarningSoundSafe = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => {
      try {
        ctx.close();
      } catch {
        // ignore close error
      }
    };
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  } catch {
    // 오디오 자동재생 제한 환경에서는 조용히 무시
  }
};
