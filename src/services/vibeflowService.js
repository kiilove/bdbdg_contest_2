/**
 * 🎵 vibeflowService.js
 * 
 * VibeFlows 공식 인증 및 대회 전용 음원 API 클라이언트
 * - Auth Endpoint: https://auth.vibeflows.net/login
 * - Playlist Endpoint: https://api.vibeflows.net/playlist/contest-songs
 */

const VIBEFLOW_AUTH_URL = "https://auth.vibeflows.net/login";
const VIBEFLOW_API_URL = "https://api.vibeflows.net/playlist/contest-songs";

const TOKEN_STORAGE_KEY = "vf_access_token";
const USER_STORAGE_KEY = "vf_user_info";
const EXPIRY_STORAGE_KEY = "vf_token_expires_at";

// ⏱️ 토큰 로컬 저장 유효기간: 24시간 (밀리초)
export const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * ⌛ 토큰 만료 여부 확인
 * @returns {boolean} 만료되었으면 true, 유효하면 false
 */
export const isVibeFlowTokenExpired = () => {
  if (typeof window === "undefined") return true;

  const token =
    localStorage.getItem(TOKEN_STORAGE_KEY) ||
    sessionStorage.getItem(TOKEN_STORAGE_KEY);

  if (!token) return true;

  const rawExpiry =
    localStorage.getItem(EXPIRY_STORAGE_KEY) ||
    sessionStorage.getItem(EXPIRY_STORAGE_KEY);

  // 기존 로그인 세션 호환: 토큰이 이미 저장되어 있고 만료 기록만 없는 경우 24시간 새로 부여
  if (!rawExpiry) {
    const newExpiry = Date.now() + TOKEN_EXPIRY_MS;
    try {
      localStorage.setItem(EXPIRY_STORAGE_KEY, String(newExpiry));
    } catch {}
    return false;
  }

  const expiresAt = Number(rawExpiry);
  if (isNaN(expiresAt) || Date.now() >= expiresAt) {
    return true; // 24시간 초과
  }

  return false;
};

/**
 * 🔑 토큰 가져오기 (24시간 유효기간 검증 적용)
 */
export const getStoredVibeFlowToken = () => {
  if (typeof window === "undefined") return null;

  // 24시간 만료 여부 확인
  if (isVibeFlowTokenExpired()) {
    clearVibeFlowToken();
    return null;
  }

  const token =
    localStorage.getItem(TOKEN_STORAGE_KEY) ||
    sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
    null;

  return token;
};

/**
 * 💾 토큰 및 사용자 정보 저장 (24시간 유효기간 기록)
 */
export const saveVibeFlowToken = (token, rememberMe = true, user = null) => {
  if (typeof window === "undefined" || !token) return;

  const now = Date.now();
  const expiresAt = now + TOKEN_EXPIRY_MS;

  const userInfo = {
    ...user,
    savedAt: now,
    expiresAt: expiresAt,
  };

  if (rememberMe) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(EXPIRY_STORAGE_KEY, String(expiresAt));
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userInfo));
  } else {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(EXPIRY_STORAGE_KEY, String(expiresAt));
    if (user) sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userInfo));
  }
};

/**
 * 🚪 토큰 및 세션 삭제 (로그아웃 / 만료 시 자동 청소)
 */
export const clearVibeFlowToken = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(EXPIRY_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
    sessionStorage.removeItem(EXPIRY_STORAGE_KEY);
  } catch {}
};

/**
 * 👤 저장된 사용자 정보 가져오기 (24시간 유효기간 검증)
 */
export const getStoredVibeFlowUser = () => {
  if (typeof window === "undefined") return null;

  if (isVibeFlowTokenExpired()) {
    clearVibeFlowToken();
    return null;
  }

  try {
    const raw =
      localStorage.getItem(USER_STORAGE_KEY) ||
      sessionStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * ⏱️ 토큰 남은 시간(분) 계산 헬퍼
 */
export const getVibeFlowTokenRemainingMinutes = () => {
  if (typeof window === "undefined") return 0;
  const rawExpiry =
    localStorage.getItem(EXPIRY_STORAGE_KEY) ||
    sessionStorage.getItem(EXPIRY_STORAGE_KEY);

  if (!rawExpiry) return 0;
  const diff = Number(rawExpiry) - Date.now();
  return diff > 0 ? Math.floor(diff / (60 * 1000)) : 0;
};

/**
 * 🔐 VibeFlows 로그인
 * @param {string} email
 * @param {string} password
 * @param {boolean} rememberMe
 * @returns {Promise<{success: boolean, token?: string, error?: string, raw?: any}>}
 */
export const loginVibeFlow = async (email, password, rememberMe = true) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(VIBEFLOW_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok || !data.accessToken) {
      throw new Error(data.error || data.message || "로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.");
    }

    const token = data.accessToken;
    const user = { email, loggedInAt: Date.now(), ...data.user };
    saveVibeFlowToken(token, rememberMe, user);

    return {
      success: true,
      token,
      user,
      raw: data,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[VibeFlow Auth Error]:", error);
    return {
      success: false,
      error: error.name === "AbortError" ? "인증 요청 시간이 초과되었습니다." : (error.message || "서버 통신 중 오류가 발생했습니다."),
    };
  }
};

/**
 * 👁️ VibeFlows 공식 API 명세 기반 음원 노출 여부 판별 함수
 * 
 * 📌 노출 여부 필드 상세 (VibeFlows DB & API)
 * - 필드명: is_active (contest_songs & songs)
 * - is_active = 1 (또는 true): 노출 중 (공개)
 * - is_active = 0 (또는 false): 노출 안함 (비노출 / 숨김)
 */
export const isTrackExposed = (track) => {
  if (!track || typeof track !== "object") return false;

  // 1. 📌 [공식 명세 1순위 검증] is_active / active / contest_is_active 등 비활성(0, false, "0", "false")인 경우 100% 제외
  if (
    track.is_active === 0 ||
    track.is_active === "0" ||
    track.is_active === false ||
    track.is_active === "false" ||
    track.active === 0 ||
    track.active === "0" ||
    track.active === false ||
    track.active === "false" ||
    track.contest_is_active === 0 ||
    track.contest_is_active === "0" ||
    track.contest_is_active === false ||
    track.contest_is_active === "false" ||
    track.song_is_active === 0 ||
    track.song_is_active === "0" ||
    track.song_is_active === false ||
    track.song_is_active === "false" ||
    track.is_exposed === 0 ||
    track.is_exposed === "0" ||
    track.is_exposed === false ||
    track.is_exposed === "false" ||
    track.exposed === 0 ||
    track.exposed === "0" ||
    track.exposed === false ||
    track.exposed === "false" ||
    track.is_display === 0 ||
    track.is_display === "0" ||
    track.is_display === false ||
    track.is_display === "false" ||
    track.display === 0 ||
    track.display === "0" ||
    track.display === false ||
    track.display === "false" ||
    track.is_visible === 0 ||
    track.is_visible === "0" ||
    track.is_visible === false ||
    track.is_visible === "false" ||
    track.visible === 0 ||
    track.visible === "0" ||
    track.visible === false ||
    track.visible === "false" ||
    track.is_show === 0 ||
    track.is_show === "0" ||
    track.is_show === false ||
    track.is_show === "false" ||
    track.is_use === 0 ||
    track.is_use === "0" ||
    track.is_use === false ||
    track.is_use === "false" ||
    track.is_enabled === 0 ||
    track.is_enabled === "0" ||
    track.is_enabled === false ||
    track.is_enabled === "false"
  ) {
    return false;
  }

  // 2. 숨김(is_hidden) / 삭제(is_deleted) 플래그 검증
  if (
    track.is_hidden === 1 ||
    track.is_hidden === true ||
    track.is_hidden === "1" ||
    track.is_hidden === "true" ||
    track.hidden === 1 ||
    track.hidden === true ||
    track.hidden === "1" ||
    track.hidden === "true" ||
    track.is_hide === 1 ||
    track.is_hide === true ||
    track.is_hide === "1" ||
    track.is_deleted === 1 ||
    track.is_deleted === true ||
    track.is_deleted === "1" ||
    track.is_deleted === "true" ||
    track.deleted === 1 ||
    track.deleted === true ||
    track.deleted === "1" ||
    track.deleted === "true"
  ) {
    return false;
  }

  // 3. 상태(status) 문자열이 비노출 계열인 경우 제외
  if (typeof track.status === "string") {
    const s = track.status.trim().toLowerCase();
    if (["hidden", "inactive", "draft", "deleted", "disabled", "private", "hide", "block", "0", "unexposed", "invisible"].includes(s)) {
      return false;
    }
  }

  return true;
};

/**
 * 🎼 VibeFlows 대회 음원 목록 가져오기 (?is_active=1 파라미터 적용)
 * @param {string} [customToken] - 지정하지 않을 시 스토리지 토큰 사용
 * @returns {Promise<{success: boolean, tracks?: Array<any>, total?: number, rawTotal?: number, error?: string, raw?: any, isUnauthorized?: boolean}>}
 */
export const fetchVibeFlowContestSongs = async (customToken = null) => {
  const token = customToken || getStoredVibeFlowToken();

  if (!token) {
    return {
      success: false,
      error: "VibeFlows 인증 토큰이 없습니다. 먼저 로그인해주세요.",
      isUnauthorized: true,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    // 📌 [공식 API 쿼리 파라미터] 노출 중인 음원만 필터링 조회: ?is_active=1&active=1
    const requestUrl = `${VIBEFLOW_API_URL}?is_active=1&active=1`;

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 401) {
      clearVibeFlowToken();
      return {
        success: false,
        error: "인증 세션이 만료되었습니다. 다시 로그인해주세요.",
        isUnauthorized: true,
      };
    }

    const data = await response.json();

    // 트랙 배열 추출 (data.tracks or data.data or data)
    let rawTracks = [];
    if (Array.isArray(data.tracks)) {
      rawTracks = data.tracks;
    } else if (Array.isArray(data.data)) {
      rawTracks = data.data;
    } else if (Array.isArray(data)) {
      rawTracks = data;
    }

    // 👁️ '노출 안 함 (비노출/숨김)' 체크된 음원 100% 필터링하여 제외
    const exposedTracks = rawTracks.filter(isTrackExposed);

    return {
      success: true,
      tracks: exposedTracks,
      total: exposedTracks.length,
      rawTotal: rawTracks.length,
      raw: data,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[VibeFlow API Error]:", error);
    return {
      success: false,
      error: error.name === "AbortError" ? "음원 목록 요청 시간이 초과되었습니다." : (error.message || "음원 목록을 불러오는 중 네트워크 오류가 발생했습니다."),
    };
  }
};
