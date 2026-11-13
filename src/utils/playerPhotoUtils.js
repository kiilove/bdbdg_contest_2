/**
 * 선수 사진 추출 및 슬롯 결정 순수 유틸리티
 * - 대회 포스터, 배너, 로고 등 비선수 이미지를 엄격 제외합니다.
 * - stagePhoto1 / stagePhoto2 명시적 초기화("") 시 이전 URL이 되살아나지 않도록 보장합니다.
 */

export const isNonPlayerKey = (key) => {
  if (!key || typeof key !== "string") return false;
  const lower = key.toLowerCase();
  return (
    lower.includes("poster") ||
    lower.includes("banner") ||
    lower.includes("logo") ||
    lower.includes("notice") ||
    lower.includes("certificate") ||
    lower.includes("trophy") ||
    lower.includes("award") ||
    lower.includes("sponsor") ||
    lower.includes("receipt") ||
    lower.includes("payment") ||
    lower.includes("stamp") ||
    lower.includes("signature") ||
    lower.includes("contest") ||
    lower.includes("org") ||
    lower.includes("association") ||
    lower.includes("background") ||
    lower.includes("qr") ||
    lower.includes("icon")
  );
};

export const isNonPlayerUrl = (url) => {
  if (!url || typeof url !== "string") return true;
  const lower = url.toLowerCase().trim();
  if (lower.length < 6) return true;
  if (
    !lower.startsWith("http://") &&
    !lower.startsWith("https://") &&
    !lower.startsWith("data:image/") &&
    !lower.startsWith("blob:")
  ) {
    return true;
  }
  return (
    lower.includes("/poster") ||
    lower.includes("_poster") ||
    lower.includes("poster_") ||
    lower.includes("contest_poster") ||
    lower.includes("/banner") ||
    lower.includes("_banner") ||
    lower.includes("/logo") ||
    lower.includes("_logo") ||
    lower.includes("/sponsor") ||
    lower.includes("ybbf_logo") ||
    lower.includes("sbbf_logo") ||
    lower.includes("ybbf_stamp") ||
    lower.includes("idlebackground") ||
    lower.includes("darkbackground") ||
    lower.includes(".mp4") ||
    lower.includes(".webm") ||
    lower.includes(".mp3") ||
    lower.includes(".wav") ||
    lower.includes(".pdf")
  );
};

export const extractUrlFromStringOrObject = (item) => {
  if (!item) return [];

  if (typeof item === "string") {
    const trimmed = item.trim();
    if (!trimmed) return [];

    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractUrlFromStringOrObject(parsed);
      } catch {
        // ignore JSON parse error and fall through
      }
    }

    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:image")
    ) {
      return isNonPlayerUrl(trimmed) ? [] : [trimmed];
    }
    return [];
  }

  if (Array.isArray(item)) {
    return item.flatMap((sub) => extractUrlFromStringOrObject(sub));
  }

  if (typeof item === "object") {
    const urls = [];
    const playerPhotoProps = [
      "url",
      "compressedUrl",
      "originalUrl",
      "downloadURL",
      "downloadUrl",
      "photoUrl",
      "playerPhotoUrl",
      "playerPhotoUrlsJson",
      "playerPhotoUrls",
      "photoUrlsJson",
      "photoUrls",
      "photosJson",
      "playerPhoto",
      "profileImageUrl",
      "stagePhotoUrl",
      "imageUrl",
      "pictureUrl",
      "fileUrl",
      "src",
      "thumbUrl",
      "preview",
    ];

    playerPhotoProps.forEach((prop) => {
      if (item[prop] && !isNonPlayerKey(prop)) {
        urls.push(...extractUrlFromStringOrObject(item[prop]));
      }
    });

    if (item.response) {
      urls.push(...extractUrlFromStringOrObject(item.response));
    }

    Object.entries(item).forEach(([k, v]) => {
      if (
        !playerPhotoProps.includes(k) &&
        !isNonPlayerKey(k) &&
        k !== "clientInfo"
      ) {
        if (Array.isArray(v) || (typeof v === "object" && v !== null)) {
          urls.push(...extractUrlFromStringOrObject(v));
        } else if (
          typeof v === "string" &&
          (v.startsWith("http") ||
            v.startsWith("[") ||
            v.startsWith("{") ||
            v.startsWith("data:image"))
        ) {
          urls.push(...extractUrlFromStringOrObject(v));
        }
      }
    });

    return urls;
  }

  return [];
};

export const extractPlayerPhotos = (p) => {
  if (!p || typeof p !== "object") return [];
  const list = [];

  const targetFields = [
    "photos",
    "playerPhotos",
    "playerPhotoUrlsJson",
    "playerPhotoUrls",
    "photoUrlsJson",
    "photoUrls",
    "photosJson",
    "gallery",
    "images",
    "fileList",
    "files",
    "photoList",
    "attachments",
    "stagePhotoUrl",
    "profileImageUrl",
    "playerPhotoUrl",
    "photoUrl",
    "playerPhoto",
    "photo",
    "photoURL",
    "playerProfileUrl",
    "pictureUrl",
    "imageUrl",
    "fileUrl",
    "userPhotoUrl",
    "downloadURL",
    "downloadUrl",
    "compressedUrl",
    "originalUrl",
  ];

  targetFields.forEach((field) => {
    if (p[field] && !isNonPlayerKey(field)) {
      list.push(...extractUrlFromStringOrObject(p[field]));
    }
  });

  const nestedPlayerFields = [
    "player",
    "playerInfo",
    "userInfo",
    "user",
    "clientInfo",
    "applicantInfo",
    "invoice",
    "invoiceInfo",
    "extra",
  ];
  nestedPlayerFields.forEach((field) => {
    if (p[field] && typeof p[field] === "object" && !isNonPlayerKey(field)) {
      list.push(...extractPlayerPhotos(p[field]));
    }
  });

  if (Array.isArray(p.joins)) {
    p.joins.forEach((j) => {
      if (j && typeof j === "object" && !isNonPlayerKey("joins")) {
        list.push(...extractPlayerPhotos(j));
      }
    });
  }

  Object.entries(p).forEach(([key, val]) => {
    if (
      !targetFields.includes(key) &&
      !nestedPlayerFields.includes(key) &&
      key !== "joins" &&
      !isNonPlayerKey(key)
    ) {
      list.push(...extractUrlFromStringOrObject(val));
    }
  });

  return Array.from(
    new Set(
      list
        .filter((url) => typeof url === "string" && url.trim().length > 5)
        .filter((url) => !isNonPlayerUrl(url))
        .map((url) => url.trim())
    )
  );
};

/**
 * 무대 슬롯 사진(stagePhoto1, stagePhoto2, stagePhotoUrl) 병합 시
 * 명시적으로 비워진("") 슬롯이 이전 URL로 되살아나지 않도록 안전하게 결정
 */
export const resolveEffectiveStagePhotoFields = (
  primarySource = {},
  fallbackSource = {}
) => {
  const filterValid = (u) => (u && !isNonPlayerUrl(u) ? u : "");
  const hasExplicitPrimarySlot1 =
    primarySource &&
    (Object.prototype.hasOwnProperty.call(primarySource, "stagePhoto1") ||
      Object.prototype.hasOwnProperty.call(primarySource, "stagePhotoUrl1"));
  const hasExplicitPrimarySlot2 =
    primarySource &&
    (Object.prototype.hasOwnProperty.call(primarySource, "stagePhoto2") ||
      Object.prototype.hasOwnProperty.call(primarySource, "stagePhotoUrl2"));

  const slot1 = hasExplicitPrimarySlot1
    ? filterValid(primarySource.stagePhoto1 ?? primarySource.stagePhotoUrl1 ?? "")
    : filterValid(
        fallbackSource?.stagePhoto1 ?? fallbackSource?.stagePhotoUrl1 ?? ""
      );

  const slot2 = hasExplicitPrimarySlot2
    ? filterValid(primarySource.stagePhoto2 ?? primarySource.stagePhotoUrl2 ?? "")
    : filterValid(
        fallbackSource?.stagePhoto2 ?? fallbackSource?.stagePhotoUrl2 ?? ""
      );

  const bothExplicitlyCleared =
    hasExplicitPrimarySlot1 &&
    hasExplicitPrimarySlot2 &&
    !slot1 &&
    !slot2 &&
    primarySource.stagePhotoUrl === "";

  const designated = bothExplicitlyCleared
    ? ""
    : slot1 ||
      slot2 ||
      filterValid(primarySource?.stagePhotoUrl) ||
      filterValid(fallbackSource?.stagePhotoUrl) ||
      filterValid(primarySource?.profileImageUrl) ||
      filterValid(fallbackSource?.profileImageUrl) ||
      "";

  return {
    stagePhoto1: slot1,
    stagePhoto2: slot2,
    stagePhotoUrl1: slot1,
    stagePhotoUrl2: slot2,
    stagePhotoUrl: designated,
    profileImageUrl: designated,
    photoUrl: designated,
    playerPhoto: designated,
  };
};
