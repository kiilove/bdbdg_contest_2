import { getTrackAudioUrl } from "../pages/broadcast/vibeflow/constants.js";

/**
 * 브라우저 로컬 SSD(IndexedDB) 기반 대회 음원 오프라인 캐시 & CDN 워밍업 유틸리티
 *
 * 1. 트랙 고유 식별자(uuid / id / storagePath) 기준으로 IndexedDB에 오디오 Blob을 영구 저장하여
 *    다음 날 토큰 재발급이나 서명 쿼리 파라미터 변경 후에도 100% 로컬 캐시 히트 보장.
 * 2. 메모리 동기 맵(memoryAudioBlobUrlMap)을 유지하여 클릭 즉시 동기적(0ms)으로 Blob URL 반환
 *    → 브라우저 Autoplay 제스처 컨텍스트 및 듀얼 데크 크로스페이드 타이밍 완벽 보존.
 * 3. 만약 외부 CDN이 CORS fetch를 허용하지 않는 경우 자동으로 무음 Audio 프리로드 워밍업으로 폴백.
 */

const DB_NAME = "VibeFlowAudioCacheDB_v1";
const STORE_NAME = "audio_blobs";
const DB_VERSION = 1;
const WARMED_STORAGE_KEY = "vf_warmed_tracks_v1";
const WARMED_TTL_MS = 18 * 60 * 60 * 1000; // CDN/브라우저 워밍업 유효 표시 18시간

// 동기 조회용 인메모리 캐시 (cacheKey -> blob: URL)
const memoryAudioBlobUrlMap = new Map();

/**
 * URL에서 서명/만료용 휘발성 쿼리 파라미터를 제거한 정규화 키 반환
 */
export const normalizeAudioUrlForKey = (rawUrl = "") => {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return rawUrl.split("?")[0] || rawUrl;
  }
};

/**
 * 트랙 객체로부터 서명 URL 갱신에도 변하지 않는 안정적 캐시 키 추출
 */
export const getAudioCacheKey = (trackOrKey) => {
  if (!trackOrKey) return "";
  if (typeof trackOrKey === "string") return trackOrKey.trim();
  if (typeof trackOrKey !== "object") return "";

  if (trackOrKey.is_custom && trackOrKey.storagePath) {
    return `storage:${String(trackOrKey.storagePath).trim()}`;
  }

  const stableId =
    trackOrKey.uuid ||
    trackOrKey.id ||
    trackOrKey.song_id ||
    trackOrKey._id ||
    "";

  if (stableId) {
    const prefix = trackOrKey.is_custom ? "custom" : "vf";
    return `${prefix}:${String(stableId).trim()}`;
  }

  const rawUrl = getTrackAudioUrl(trackOrKey);
  if (rawUrl) {
    return `url:${normalizeAudioUrlForKey(rawUrl)}`;
  }

  return "";
};

/**
 * 재생용 소스 결정 순수 헬퍼 (원격 브로드캐스트용 URL과 로컬 재생용 Blob URL을 안전하게 분리)
 */
export const resolvePlayableAudioSource = (
  track,
  lookupBlobUrl = (key) => memoryAudioBlobUrlMap.get(key) || ""
) => {
  const remoteUrl = getTrackAudioUrl(track);
  const cacheKey = getAudioCacheKey(track);
  const cachedBlobUrl = cacheKey && typeof lookupBlobUrl === "function"
    ? lookupBlobUrl(cacheKey) || ""
    : "";

  return {
    src: cachedBlobUrl || remoteUrl || "",
    remoteUrl: remoteUrl || "",
    cacheKey,
    isCachedBlob: Boolean(cachedBlobUrl),
  };
};

/**
 * 인메모리 맵에서 동기적으로 로컬 Blob URL 조회
 */
export const getCachedAudioBlobUrlSync = (trackOrKey) => {
  const key = getAudioCacheKey(trackOrKey);
  if (!key) return "";
  return memoryAudioBlobUrlMap.get(key) || "";
};

const readWarmedMap = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(WARMED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const now = Date.now();
    const valid = {};
    let mutated = false;
    Object.entries(parsed).forEach(([k, v]) => {
      const savedAt = Number(v?.savedAt || v || 0);
      if (savedAt > 0 && now - savedAt < WARMED_TTL_MS) {
        valid[k] = { mode: "warmed", size: 0, savedAt };
      } else {
        mutated = true;
      }
    });
    if (mutated) {
      localStorage.setItem(WARMED_STORAGE_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return {};
  }
};

const markTrackWarmed = (cacheKey) => {
  if (typeof window === "undefined" || !cacheKey) return null;
  const now = Date.now();
  const entry = { mode: "warmed", size: 0, savedAt: now };
  try {
    const cur = readWarmedMap();
    cur[cacheKey] = entry;
    localStorage.setItem(WARMED_STORAGE_KEY, JSON.stringify(cur));
  } catch {}
  return entry;
};

const removeTrackWarmed = (cacheKey) => {
  if (typeof window === "undefined" || !cacheKey) return;
  try {
    const cur = readWarmedMap();
    if (cur[cacheKey]) {
      delete cur[cacheKey];
      localStorage.setItem(WARMED_STORAGE_KEY, JSON.stringify(cur));
    }
  } catch {}
};

/**
 * IndexedDB 열기
 */
export const openAudioCacheDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB를 지원하지 않는 환경입니다."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * 앱 마운트 시 IndexedDB에 저장된 모든 음원의 Blob URL을 인메모리 맵에 적재하고 상태 맵 반환
 */
export const hydrateAllStoredAudioBlobUrls = async () => {
  const statusMap = { ...readWarmedMap() };

  if (typeof window === "undefined" || !window.indexedDB) {
    return statusMap;
  }

  // 브라우저 디스크 압박 시에도 대회 음원 IndexedDB가 자동 정리되지 않도록 영구 스토리지 권한 요청
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }

  try {
    const db = await openAudioCacheDB();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const cursorReq = store.openCursor();

      cursorReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve();
          return;
        }
        const record = cursor.value;
        if (record?.cacheKey && record?.blob && record.blob.size > 1024) {
          if (!memoryAudioBlobUrlMap.has(record.cacheKey)) {
            try {
              const blobUrl = URL.createObjectURL(record.blob);
              memoryAudioBlobUrlMap.set(record.cacheKey, blobUrl);
            } catch {}
          }
          statusMap[record.cacheKey] = {
            cacheKey: record.cacheKey,
            mode: "cached",
            size: record.size || record.blob.size || 0,
            savedAt: record.savedAt || 0,
          };
        }
        cursor.continue();
      };

      cursorReq.onerror = () => resolve();
    });
  } catch (err) {
    console.warn("[AudioCache] IndexedDB 초기 로드 건너뜀:", err);
  }

  return statusMap;
};

const getStoredAudioRecord = async (cacheKey) => {
  if (!cacheKey) return null;
  try {
    const db = await openAudioCacheDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cacheKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

const saveAudioBlobRecord = async (cacheKey, blob, metadata = {}) => {
  const db = await openAudioCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const record = {
      cacheKey,
      blob,
      size: blob.size,
      mimeType: blob.type || "audio/mpeg",
      title: metadata.title || "",
      category: metadata.category || "",
      savedAt: Date.now(),
    };
    const req = store.put(record);
    req.onsuccess = () => {
      const prevUrl = memoryAudioBlobUrlMap.get(cacheKey);
      if (prevUrl) {
        try {
          URL.revokeObjectURL(prevUrl);
        } catch {}
      }
      const nextUrl = URL.createObjectURL(blob);
      memoryAudioBlobUrlMap.set(cacheKey, nextUrl);
      resolve({
        blobUrl: nextUrl,
        size: blob.size,
        savedAt: record.savedAt,
      });
    };
    req.onerror = () => reject(req.error);
  });
};

/**
 * 특정 트랙 캐시 개별 삭제 (커스텀 음원 삭제 또는 손상된 Blob 복구 시 사용)
 */
export const evictCachedAudioTrack = async (trackOrKey) => {
  const cacheKey = getAudioCacheKey(trackOrKey);
  if (!cacheKey) return;

  const existingUrl = memoryAudioBlobUrlMap.get(cacheKey);
  if (existingUrl) {
    try {
      URL.revokeObjectURL(existingUrl);
    } catch {}
    memoryAudioBlobUrlMap.delete(cacheKey);
  }
  removeTrackWarmed(cacheKey);

  try {
    const db = await openAudioCacheDB();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(cacheKey);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}
};

/**
 * 전체 로컬 오디오 캐시 초기화
 */
export const clearAllCachedAudio = async () => {
  for (const [, blobUrl] of memoryAudioBlobUrlMap.entries()) {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {}
  }
  memoryAudioBlobUrlMap.clear();

  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(WARMED_STORAGE_KEY);
    } catch {}
  }

  try {
    const db = await openAudioCacheDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[AudioCache] 전체 캐시 삭제 실패:", err);
  }
};

/**
 * CORS 차단 환경용 폴백: 무음 Audio 객체로 CDN 엣지 & 브라우저 미디어 캐시 워밍업
 */
const warmTrackViaAudioElement = (remoteUrl, signal, timeoutMs = 25000) => {
  return new Promise((resolve, reject) => {
    if (typeof Audio === "undefined") {
      reject(new Error("Audio 객체를 사용할 수 없습니다."));
      return;
    }
    if (signal?.aborted) {
      const abortErr = new Error("Aborted");
      abortErr.name = "AbortError";
      reject(abortErr);
      return;
    }

    const audio = new Audio();
    let settled = false;
    let timerId = null;

    const cleanup = () => {
      if (timerId) clearTimeout(timerId);
      audio.oncanplaythrough = null;
      audio.onloadeddata = null;
      audio.onerror = null;
      if (signal) signal.removeEventListener("abort", handleAbort);
      try {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      } catch {}
    };

    const finishOk = () => {
      if (settled) return;
      settled = true;
      // canplaythrough 직후 추가 버퍼가 채워지도록 짧게 대기 후 정리
      setTimeout(() => {
        cleanup();
        resolve();
      }, 350);
    };

    const finishErr = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const handleAbort = () => {
      const abortErr = new Error("Aborted");
      abortErr.name = "AbortError";
      finishErr(abortErr);
    };

    if (signal) {
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    timerId = setTimeout(() => {
      if (audio.readyState >= 2) {
        finishOk();
      } else {
        finishErr(new Error("음원 버퍼링 시간 초과"));
      }
    }, timeoutMs);

    audio.preload = "auto";
    audio.muted = true;
    audio.volume = 0;
    audio.oncanplaythrough = finishOk;
    audio.onerror = () => finishErr(new Error("음원 스트림 로드 실패"));
    audio.src = remoteUrl;
    audio.load();
  });
};

/**
 * 단일 트랙 오프라인 캐시 저장 (1순위: IndexedDB 전체 다운로드 / 2순위: 무음 Audio CDN 워밍업)
 */
export const cacheOrWarmAudioTrack = async (
  track,
  { signal, force = false, onProgress } = {}
) => {
  const remoteUrl = getTrackAudioUrl(track);
  const cacheKey = getAudioCacheKey(track);

  if (!remoteUrl || !cacheKey) {
    return {
      success: false,
      mode: "failed",
      cacheKey,
      size: 0,
      error: "유효한 음원 URL이 없습니다.",
    };
  }

  if (!force) {
    const existing = await getStoredAudioRecord(cacheKey);
    if (existing?.blob && existing.blob.size > 1024) {
      if (!memoryAudioBlobUrlMap.has(cacheKey)) {
        try {
          memoryAudioBlobUrlMap.set(cacheKey, URL.createObjectURL(existing.blob));
        } catch {}
      }
      if (onProgress) onProgress(100);
      return {
        success: true,
        mode: "cached",
        alreadyCached: true,
        cacheKey,
        size: existing.size || existing.blob.size,
        savedAt: existing.savedAt || Date.now(),
      };
    }
  }

  // 1순위: fetch로 전체 바이트 수신 후 로컬 SSD(IndexedDB) 영구 저장
  let lastFetchErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let attemptTimeoutId = null;
    const attemptController = new AbortController();
    const onParentAbort = () => attemptController.abort();
    if (signal) {
      if (signal.aborted) {
        const abortErr = new Error("Aborted");
        abortErr.name = "AbortError";
        throw abortErr;
      }
      signal.addEventListener("abort", onParentAbort, { once: true });
    }
    attemptTimeoutId = setTimeout(() => attemptController.abort(), 14000);

    try {
      const response = await fetch(remoteUrl, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        signal: attemptController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("text/html") || contentType.includes("application/json")) {
        throw new Error(`오디오가 아닌 응답 형식 (${contentType})`);
      }

      const totalBytes = Number(response.headers.get("content-length") || 0);
      let blob = null;

      if (response.body && typeof response.body.getReader === "function") {
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.byteLength || value.length || 0;
            if (onProgress && totalBytes > 0) {
              onProgress(Math.min(99, Math.round((received / totalBytes) * 100)));
            }
          }
        }
        blob = new Blob(chunks, { type: contentType || "audio/mpeg" });
      } else {
        blob = await response.blob();
      }

      if (!blob || blob.size <= 1024) {
        throw new Error("수신된 오디오 파일 크기가 비정상입니다.");
      }

      const saved = await saveAudioBlobRecord(cacheKey, blob, {
        title: track.title || track.name || "",
        category: track.contest_category_kr || track.category || "",
      });
      if (onProgress) onProgress(100);

      return {
        success: true,
        mode: "cached",
        alreadyCached: false,
        cacheKey,
        size: saved.size,
        savedAt: saved.savedAt,
      };
    } catch (fetchErr) {
      if (signal?.aborted) {
        throw fetchErr;
      }
      if (fetchErr?.name === "AbortError") {
        lastFetchErr = new Error("HTTP 응답 시간 초과");
      } else {
        lastFetchErr = fetchErr;
      }
      const msg = lastFetchErr?.message || "";
      const is429 = /^HTTP\s+429/.test(msg);
      const isOther4xx = /^HTTP\s+4\d\d/.test(msg) && !is429;
      if (isOther4xx || attempt === 2) break;
      await new Promise((r) => setTimeout(r, is429 ? 1200 : 500));
    } finally {
      if (attemptTimeoutId) clearTimeout(attemptTimeoutId);
      if (signal) signal.removeEventListener("abort", onParentAbort);
    }
  }

  {
    const fetchErr = lastFetchErr;

    // HTTP 404/403 등 명시적 상태 코드 오류는 즉시 실패 반환, 네트워크/CORS TypeError는 Audio 워밍업 폴백
    const isHttpStatusError = /^HTTP\s+\d+/.test(fetchErr?.message || "");
    if (isHttpStatusError) {
      return {
        success: false,
        mode: "failed",
        cacheKey,
        size: 0,
        error: fetchErr.message,
      };
    }

    // 2순위: CORS 미허용 CDN일 경우 무음 Audio 프리로드로 CDN + 브라우저 미디어 캐시 워밍업
    try {
      await warmTrackViaAudioElement(remoteUrl, signal);
      const warmedEntry = markTrackWarmed(cacheKey);
      if (onProgress) onProgress(100);
      return {
        success: true,
        mode: "warmed",
        alreadyCached: false,
        cacheKey,
        size: 0,
        savedAt: warmedEntry?.savedAt || Date.now(),
      };
    } catch (warmErr) {
      if (warmErr?.name === "AbortError" || signal?.aborted) {
        throw warmErr;
      }
      return {
        success: false,
        mode: "failed",
        cacheKey,
        size: 0,
        error: warmErr?.message || fetchErr?.message || "음원 준비 실패",
      };
    }
  }
};

/**
 * 전곡 일괄 사전 다운로드 / 워밍업 실행기 (절전 방지 Wake Lock 자동 유지)
 */
export const batchCacheOrWarmTracks = async (
  tracks = [],
  {
    concurrency = 3,
    force = false,
    existingStatusMap = {},
    signal,
    onTrackUpdate,
    onProgressSummary,
  } = {}
) => {
  // 중복 트랙 제거
  const seenKeys = new Set();
  const uniqueTracks = [];
  for (const t of tracks) {
    const key = getAudioCacheKey(t);
    const url = getTrackAudioUrl(t);
    if (!key || !url || seenKeys.has(key)) continue;
    seenKeys.add(key);
    uniqueTracks.push({ track: t, cacheKey: key });
  }

  const total = uniqueTracks.length;
  let completed = 0;
  let cachedCount = 0;
  let warmedCount = 0;
  let failedCount = 0;
  let addedBytes = 0;
  const activeTitles = new Set();

  const emitSummary = () => {
    if (typeof onProgressSummary === "function") {
      onProgressSummary({
        total,
        completed,
        cachedCount,
        warmedCount,
        failedCount,
        addedBytes,
        percent: total > 0 ? Math.round((completed / total) * 100) : 100,
        activeTitles: Array.from(activeTitles),
      });
    }
  };

  emitSummary();
  if (total === 0) {
    return { total: 0, completed: 0, cachedCount: 0, warmedCount: 0, failedCount: 0 };
  }

  // 야간 일괄 다운로드 중 노트북 화면/네트워크 절전 진입 방지
  let wakeLockSentinel = null;
  if (typeof navigator !== "undefined" && navigator.wakeLock?.request) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
    } catch {}
  }

  let cursor = 0;

  const runWorker = async () => {
    while (cursor < uniqueTracks.length) {
      if (signal?.aborted) break;
      const idx = cursor++;
      const item = uniqueTracks[idx];
      if (!item) break;

      const { track, cacheKey } = item;
      const title = track.title || track.name || cacheKey;

      if (!force && existingStatusMap[cacheKey]?.mode === "cached" && memoryAudioBlobUrlMap.has(cacheKey)) {
        completed += 1;
        cachedCount += 1;
        emitSummary();
        continue;
      }

      activeTitles.add(title);
      if (onTrackUpdate) {
        onTrackUpdate(cacheKey, { mode: "downloading", progress: 0 });
      }
      emitSummary();

      try {
        const res = await cacheOrWarmAudioTrack(track, {
          signal,
          force,
          onProgress: (pct) => {
            if (onTrackUpdate) {
              onTrackUpdate(cacheKey, { mode: "downloading", progress: pct });
            }
          },
        });

        activeTitles.delete(title);
        completed += 1;

        if (res.success && res.mode === "cached") {
          cachedCount += 1;
          if (!res.alreadyCached) addedBytes += res.size || 0;
          if (onTrackUpdate) {
            onTrackUpdate(cacheKey, {
              mode: "cached",
              size: res.size || 0,
              savedAt: res.savedAt || Date.now(),
            });
          }
        } else if (res.success && res.mode === "warmed") {
          warmedCount += 1;
          if (onTrackUpdate) {
            onTrackUpdate(cacheKey, {
              mode: "warmed",
              size: 0,
              savedAt: res.savedAt || Date.now(),
            });
          }
        } else {
          failedCount += 1;
          if (onTrackUpdate) {
            onTrackUpdate(cacheKey, {
              mode: "failed",
              error: res.error || "다운로드 실패",
            });
          }
        }
        emitSummary();
        if (!res.alreadyCached && cursor < uniqueTracks.length && !signal?.aborted) {
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch (err) {
        activeTitles.delete(title);
        if (err?.name === "AbortError" || signal?.aborted) {
          if (onTrackUpdate) {
            onTrackUpdate(cacheKey, existingStatusMap[cacheKey] || null);
          }
          break;
        }
        completed += 1;
        failedCount += 1;
        if (onTrackUpdate) {
          onTrackUpdate(cacheKey, {
            mode: "failed",
            error: err?.message || "오류 발생",
          });
        }
        emitSummary();
      }
    }
  };

  try {
    const workerCount = Math.max(1, Math.min(concurrency, uniqueTracks.length));
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  } finally {
    if (wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
      } catch {}
    }
  }

  return {
    total,
    completed,
    cachedCount,
    warmedCount,
    failedCount,
    addedBytes,
    aborted: Boolean(signal?.aborted),
  };
};
