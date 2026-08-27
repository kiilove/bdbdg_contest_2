/**
 * 🎬 indexedDbVideoStorage.js
 * 
 * 🚀 브라우저 로컬 디스크(IndexedDB) 기반 무대 영상 프리 다운로드 & 영구 저장소
 * 
 * 특징:
 * 1. 대용량 MP4 비디오(수백 MB)를 브라우저 로컬 디스크에 영구 보관
 * 2. 실시간 다운로드 프로그레스(0% ~ 100%) 추적 지원
 * 3. 사전 다운로드 완료 시 인터넷이 끊겨도 로컬 SSD에서 0초 무결점 60FPS 재생
 */

const DB_NAME = "StageVideoStorageDB_v1";
const STORE_NAME = "video_blobs";
const DB_VERSION = 1;

// 메모리 캐시 맵 (한 번 생성된 Blob URL 재사용)
const memoryBlobUrlMap = new Map();

/**
 * 📦 IndexedDB 초기화 및 열기
 */
export const openVideoDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB를 지원하지 않는 브라우저입니다."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "url" });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

/**
 * 🔍 특정 비디오 URL의 로컬 캐시 Blob 가져오기
 */
export const getStoredVideoBlob = async (url) => {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return null;
  }

  try {
    const db = await openVideoDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onsuccess = () => {
        const record = request.result;
        if (record && record.blob) {
          resolve(record.blob);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn("[IndexedDB] 비디오 조회 실패:", err);
    return null;
  }
};

/**
 * 🔗 특정 비디오 URL의 로컬 Blob URL 반환 (메모리 맵 우선)
 */
export const getStoredVideoBlobUrl = async (url) => {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return null;
  }

  if (memoryBlobUrlMap.has(url)) {
    return memoryBlobUrlMap.get(url);
  }

  const blob = await getStoredVideoBlob(url);
  if (blob) {
    const blobUrl = URL.createObjectURL(blob);
    memoryBlobUrlMap.set(url, blobUrl);
    return blobUrl;
  }

  return null;
};

/**
 * 💾 특정 비디오 Blob을 IndexedDB에 저장
 */
export const saveVideoBlobToDB = async (url, blob, originalSize = 0) => {
  if (!url || !blob) return;

  try {
    const db = await openVideoDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const record = {
        url,
        blob,
        size: originalSize || blob.size,
        savedAt: Date.now(),
      };

      const request = store.put(record);

      request.onsuccess = () => {
        const blobUrl = URL.createObjectURL(blob);
        memoryBlobUrlMap.set(url, blobUrl);
        resolve(blobUrl);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("[IndexedDB] 비디오 저장 실패:", err);
    throw err;
  }
};

/**
 * ⚡ 단일 비디오 사전 다운로드 (0% ~ 100% 프로그레스 추적 & IndexedDB 저장)
 */
export const downloadVideoWithProgress = async (url, onProgress = () => {}) => {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return { success: false, message: "올바른 URL이 아닙니다." };
  }

  // 1. 이미 다운로드되어 있으면 즉시 완료 반환
  const existingBlob = await getStoredVideoBlob(url);
  if (existingBlob) {
    onProgress(100, existingBlob.size, existingBlob.size);
    const blobUrl = memoryBlobUrlMap.get(url) || URL.createObjectURL(existingBlob);
    memoryBlobUrlMap.set(url, blobUrl);
    return { success: true, blobUrl, size: existingBlob.size, cached: true };
  }

  try {
    onProgress(0, 0, 0);
    const response = await fetch(url, { method: "GET" });

    if (!response.ok) {
      throw new Error(`서버 응답 오류 (HTTP ${response.status})`);
    }

    const contentLength = response.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    let receivedBytes = 0;
    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedBytes += value.length;

      if (totalBytes > 0) {
        const percent = Math.round((receivedBytes / totalBytes) * 100);
        onProgress(Math.min(percent, 99), receivedBytes, totalBytes);
      } else {
        onProgress(50, receivedBytes, receivedBytes);
      }
    }

    const blob = new Blob(chunks, { type: "video/mp4" });
    const blobUrl = await saveVideoBlobToDB(url, blob, receivedBytes);

    onProgress(100, receivedBytes, receivedBytes);
    return { success: true, blobUrl, size: receivedBytes, cached: false };
  } catch (err) {
    console.error(`[PreDownload] '${url}' 다운로드 실패:`, err);
    return { success: false, error: err.message };
  }
};

/**
 * 📊 저장된 모든 비디오 상태 목록 조회
 */
export const getAllStoredVideosInfo = async () => {
  try {
    const db = await openVideoDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result || [];
        const result = {};
        records.forEach((r) => {
          result[r.url] = {
            size: r.size,
            savedAt: r.savedAt,
          };
        });
        resolve(result);
      };

      request.onerror = () => {
        resolve({});
      };
    });
  } catch {
    return {};
  }
};

/**
 * 🗑️ 특정 비디오 또는 전체 비디오 캐시 삭제
 */
export const clearStoredVideos = async (targetUrl = null) => {
  try {
    const db = await openVideoDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      if (targetUrl) {
        store.delete(targetUrl);
        memoryBlobUrlMap.delete(targetUrl);
      } else {
        store.clear();
        memoryBlobUrlMap.clear();
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("[IndexedDB] 캐시 삭제 실패:", err);
    return false;
  }
};
