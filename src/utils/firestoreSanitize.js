/**
 * Firestore & Realtime Database 안전한 데이터 정제 유틸리티
 * - Firestore: undefined 키 제거, 배열 내 undefined -> null 변환, NaN 방어
 * - Realtime DB: update() 시 undefined 필드가 null로 변환되어 기존 필드를 삭제하는 문제 방지
 */

const isPlainObject = (val) => {
  if (val === null || typeof val !== "object") return false;
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
};

export const sanitizeForFirestore = (value) => {
  if (value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined ? null : sanitizeForFirestore(item)
    );
  }
  if (isPlainObject(value)) {
    const out = {};
    Object.keys(value).forEach((key) => {
      const v = value[key];
      if (v !== undefined) {
        out[key] = sanitizeForFirestore(v);
      }
    });
    return out;
  }
  return value;
};

export const sanitizeForRealtimeDb = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      const cleaned = sanitizeForRealtimeDb(item);
      return cleaned === undefined ? null : cleaned;
    });
  }
  if (isPlainObject(value)) {
    const out = {};
    Object.keys(value).forEach((key) => {
      const v = sanitizeForRealtimeDb(value[key]);
      if (v !== undefined) {
        out[key] = v;
      }
    });
    return out;
  }
  return value;
};

export const isValidRealtimePath = (path) => {
  if (typeof path !== "string") return false;
  const trimmed = path.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return false;
  const segments = trimmed.split("/");
  if (
    segments.some(
      (seg) =>
        !seg ||
        seg === "undefined" ||
        seg === "null" ||
        seg === "NaN" ||
        /[.#$[\]]/.test(seg)
    )
  ) {
    return false;
  }
  return true;
};
