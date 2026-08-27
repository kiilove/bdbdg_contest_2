/**
 * 🎬 VideoCacheManager: 초고화질 무대 영상 안전 로컬 메모리 캐시 & 프리로더
 * 
 * 🚀 최적화 특징:
 * 1. 안전한 In-Memory Blob 캐시: 정상 다운로드된 비디오만 메모리 Blob으로 변환하여 버퍼링 제로 재생
 * 2. CORS/네트워크 오류 시 무중단 자동 폴백 (절대 에러가 화면을 멈추거나 백화시키지 않음)
 * 3. 실패한 URL은 즉시 원본 스트리밍/로컬 에셋으로 안전하게 우회
 */

const memoryBlobMap = new Map();
const activeDownloads = new Map();
const failedUrls = new Set();
const listeners = new Set();

/**
 * 📢 캐시 상태 변경 리스너 등록
 */
export const subscribeVideoCache = (callback) => {
  if (typeof callback !== "function") return () => {};
  listeners.add(callback);
  return () => {
    try {
      listeners.delete(callback);
    } catch {}
  };
};

const notifyListeners = (url, blobUrl) => {
  listeners.forEach((fn) => {
    try {
      fn(url, blobUrl);
    } catch (e) {
      console.warn("[VideoCacheManager] Listener error:", e);
    }
  });
};

/**
 * 🔍 특정 비디오 URL이 이미 캐시되어 있는지 확인하고 Blob URL 반환
 */
export const getCachedVideoBlobUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  if (!url.startsWith("http")) return url; // 로컬 에셋은 그대로 사용
  return memoryBlobMap.get(url) || null;
};

/**
 * 🚀 단일 비디오 프리로드 & 안전 Blob 변환
 */
export const preloadVideo = async (url) => {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return url;
  }

  // 1. 이미 실패했던 URL이면 원본 URL 반환 (재시도 루프 방지)
  if (failedUrls.has(url)) {
    return url;
  }

  // 2. 이미 메모리에 캐싱되어 있으면 즉시 반환
  if (memoryBlobMap.has(url)) {
    return memoryBlobMap.get(url);
  }

  // 3. 이미 다운로드 진행 중인 경우 해당 프로미스 공유
  if (activeDownloads.has(url)) {
    return activeDownloads.get(url);
  }

  const downloadPromise = (async () => {
    try {
      const response = await fetch(url, { method: "GET" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      // 비디오가 아닌 HTML 에러 페이지 등이 반환된 경우 무시
      if (contentType && !contentType.includes("video") && !contentType.includes("octet-stream") && !contentType.includes("mp4")) {
        throw new Error(`Invalid content-type: ${contentType}`);
      }

      const blob = await response.blob();
      if (blob && blob.size > 10000) {
        const blobUrl = URL.createObjectURL(blob);
        memoryBlobMap.set(url, blobUrl);
        notifyListeners(url, blobUrl);
        return blobUrl;
      }
      return url;
    } catch (err) {
      console.warn(`[VideoCacheManager] '${url}' 백그라운드 캐시 다운로드 건너뜀 (직접 스트리밍 사용):`, err.message);
      failedUrls.add(url);
      return url;
    } finally {
      activeDownloads.delete(url);
    }
  })();

  activeDownloads.set(url, downloadPromise);
  return downloadPromise;
};

/**
 * ⚡ 여러 비디오 일괄 병렬 프리로드 (안전 처리)
 */
export const preloadAllVideos = (urlList = []) => {
  try {
    const validUrls = (Array.isArray(urlList) ? urlList : [])
      .filter((u) => typeof u === "string" && u.startsWith("http") && !failedUrls.has(u));

    if (validUrls.length === 0) return Promise.resolve([]);
    return Promise.allSettled(validUrls.map(preloadVideo));
  } catch (e) {
    console.warn("[VideoCacheManager] preloadAllVideos error:", e);
    return Promise.resolve([]);
  }
};
