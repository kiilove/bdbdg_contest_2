/**
 * 🎯 스마트 중앙 집중식 공정 광고 엔진 (Smart 2-Second Pre-fetch Ad Engine)
 * 
 * 🌟 2초 전 사전 질의 & 프리로드 메커니즘:
 * 1. ⏱️ 광고 종료 2초 전(8초 시점)에 화면이 `prepareNextAd(...)`를 호출하여 다음 광고를 미리 수신!
 * 2. 🚀 화면은 수신된 다음 광고의 미디어(MP4/이미지)를 백그라운드에서 즉시 프리로드(Preload) 및 버퍼링!
 * 3. 🎯 10초가 완료되는 순간 이미 로드된 다음 광고로 0.001초 지연 없이 부드럽게 전환 & 누적 카운트 확정 기록!
 */

const STORAGE_KEY_PREFIX = "BDBDG_AD_IMPRESSIONS_";

/**
 * 특정 대회의 오늘 광고 누적 노출 횟수 맵 로드
 */
export const getAdImpressionCounts = (contestId = "DEFAULT") => {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${contestId}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("광고 누적 노출 로드 오류:", e);
    return {};
  }
};

/**
 * 광고 노출 시 1회 누적 카운트 증가 & 저장
 */
export const recordAdImpression = (contestId = "DEFAULT", adIdentifier) => {
  if (!adIdentifier) return getAdImpressionCounts(contestId);
  try {
    const current = getAdImpressionCounts(contestId);
    const updated = {
      ...current,
      [adIdentifier]: (current[adIdentifier] || 0) + 1,
    };
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${contestId}`,
      JSON.stringify(updated)
    );
    return updated;
  } catch (e) {
    console.error("광고 누적 노출 기록 오류:", e);
    return {};
  }
};

/**
 * 대회 누적 노출 카운트 초기화
 */
export const resetAdImpressionCounts = (contestId = "DEFAULT") => {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${contestId}`);
  } catch (e) {
    console.error("노출 카운트 초기화 오류:", e);
  }
};

/**
 * 🎯 [2초 전 사전 질의] 다음 광고 후보를 미리 선출 (미디어 프리로드용)
 * 
 * @param {Array} sponsors 등록된 전체 스폰서 광고 목록
 * @param {Object|null} currentAd 현재(직전) 노출 중인 광고 객체
 * @param {string} contestId 대회 ID
 * @param {string} scene 송출 화면 명 ("COMMERCIAL", "POSEDOWN", "ALL" 등)
 * @returns {Object} 2초 후 송출될 최적의 다음 광고 객체
 */
export const prepareNextAd = (
  sponsors = [],
  currentAd = null,
  contestId = "STAGE_LIVE",
  scene = "ALL"
) => {
  if (!sponsors || sponsors.length === 0) return null;

  // 1. 활성 광고 필터링
  let validAds = sponsors.filter((ad) => {
    if (ad.isActive === false) return false;
    if (!scene || scene === "ALL") return true;
    if (Array.isArray(ad.targetScenes) && ad.targetScenes.length > 0) {
      return ad.targetScenes.includes(scene) || ad.targetScenes.includes("ALL");
    }
    return true;
  });

  if (validAds.length === 0) {
    validAds = sponsors.filter((ad) => ad.isActive !== false);
  }
  if (validAds.length === 0) {
    validAds = sponsors;
  }
  if (validAds.length === 1) {
    return validAds[0];
  }

  // 2. 🛡️ 직전 광고 제외 후보군 구성 (연속 2회 노출 100% 원천 차단)
  let candidatePool = validAds;
  if (currentAd && validAds.length > 1) {
    const withoutCurrent = validAds.filter(
      (a) => (a.id || a.name) !== (currentAd.id || currentAd.name)
    );
    if (withoutCurrent.length > 0) {
      candidatePool = withoutCurrent;
    }
  }

  // 3. 🧠 오늘 대회 누적 노출 횟수 및 총 가중치 계산
  const impressionsMap = getAdImpressionCounts(contestId);

  const totalWeight = candidatePool.reduce(
    (sum, ad) => sum + Math.max(Number(ad.weight) || 1, 1),
    0
  );

  const totalImpressions = candidatePool.reduce((sum, ad) => {
    const key = ad.id || ad.name;
    return sum + (impressionsMap[key] || 0);
  }, 0);

  // 4. ⚖️ 결손 점수(Deficit Score) 기반 최적 광고 선출
  let bestAd = candidatePool[0];
  let maxDeficit = -Infinity;

  candidatePool.forEach((ad) => {
    const key = ad.id || ad.name;
    const currentCount = impressionsMap[key] || 0;
    const weight = Math.max(Number(ad.weight) || 1, 1);
    const targetRatio = weight / totalWeight;

    const expectedCount = (totalImpressions + 1) * targetRatio;
    const deficit = expectedCount - currentCount;

    const score = deficit + Math.random() * 0.05;

    if (score > maxDeficit) {
      maxDeficit = score;
      bestAd = ad;
    }
  });

  return bestAd || candidatePool[0];
};

/**
 * 🎯 [즉시 요청 & 카운트 기록]
 */
export const requestNextAd = (
  sponsors = [],
  currentAd = null,
  contestId = "STAGE_LIVE",
  scene = "ALL"
) => {
  const selected = prepareNextAd(sponsors, currentAd, contestId, scene);
  if (selected) {
    recordAdImpression(contestId, selected.id || selected.name);
  }
  return selected;
};

/**
 * 관리자용 실시간 통계 계산기
 */
export const calculateAdImpressionStats = (ads = [], contestId = "STAGE_LIVE") => {
  if (!ads || ads.length === 0) return [];

  const impressionsMap = getAdImpressionCounts(contestId);
  const activeAds = ads.filter((a) => a.isActive !== false);

  const totalWeight = activeAds.reduce(
    (sum, ad) => sum + Math.max(Number(ad.weight) || 1, 1),
    0
  );

  const totalImpressions = activeAds.reduce((sum, ad) => {
    const key = ad.id || ad.name;
    return sum + (impressionsMap[key] || 0);
  }, 0);

  return activeAds.map((ad) => {
    const key = ad.id || ad.name;
    const count = impressionsMap[key] || 0;
    const weight = Math.max(Number(ad.weight) || 1, 1);
    const targetPercent = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
    const actualPercent =
      totalImpressions > 0 ? Math.round((count / totalImpressions) * 100) : 0;

    return {
      ...ad,
      impressions: count,
      targetPercent,
      actualPercent,
      weight,
    };
  });
};
