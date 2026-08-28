/**
 * ⚡ 하드코딩된 특별 연출 커스텀 음원 카테고리 (VibeFlows 외 자체 업로드 관리)
 */
export const CUSTOM_CATEGORIES = [
  { key: "국민의례 음악", name: "국민의례 음악", icon: "🇰🇷", desc: "개회식, 국기에 대한 경례, 애국가, 순국선열 묵념 등 공식 의전 음원", tagColor: "magenta" },
  { key: "내빈소개 음악", name: "내빈소개 음악", icon: "🎙️", desc: "개회식, 주요 내빈 및 귀빈, 심사위원 소개 시 재생되는 배경음악", tagColor: "purple" },
  { key: "대기할때 음악", name: "대기할때 음악", icon: "⏳", desc: "선수 무대 대기 및 진행 준비 시 재생되는 배경음악", tagColor: "cyan" },
  { key: "시상식때의 음악", name: "시상식때의 음악", icon: "🏆", desc: "순위 발표 및 메달/트로피 수여 시 재생되는 웅장한 시상식 음악", tagColor: "gold" },
  { key: "쉬는시간의 음악", name: "쉬는시간의 음악", icon: "☕", desc: "인터미션 및 중간 휴식 시간에 재생되는 편안한 배경음악", tagColor: "geekblue" },
];

/**
 * 🎚️ 음악 탭별 표준 기본 설정 (페이드인/아웃 초, 다음 곡 자동 준비/연속재생 모드)
 */
export const DEFAULT_TAB_CONFIGS = {
  "국민의례 음악": { fadeDuration: 0.0, autoNext: false },
  "내빈소개 음악": { fadeDuration: 2.0, autoNext: true },
  "대기할때 음악": { fadeDuration: 10.0, autoNext: true },
  "시상식때의 음악": { fadeDuration: 10.0, autoNext: true },
  "쉬는시간의 음악": { fadeDuration: 10.0, autoNext: true },
  DEFAULT_CONTEST: { fadeDuration: 2.0, autoNext: true },
};

/**
 * 🚻 성별 판별 함수
 */
export const extractGender = (text = "", explicitGender = "") => {
  if (explicitGender) {
    const g = String(explicitGender).trim().toLowerCase();
    if (["남", "남자", "남성", "male", "m", "맨즈", "mens", "men"].includes(g)) return "MALE";
    if (["여", "여자", "여성", "female", "f", "우먼스", "womens", "women"].includes(g)) return "FEMALE";
  }

  if (!text || typeof text !== "string") return "ANY";
  const lower = text.toLowerCase().replace(/\s+/g, "");

  // 1. 여성 명시 키워드 or 본질적 여성 전용 종목
  if (
    /(여자|여성|우먼|우먼스|women|woman|female|비키니|모노키니|모던키니|바디피규어|피규어|보디피트니스|바디피트니스|bodyfitness)/.test(lower)
  ) {
    return "FEMALE";
  }

  // 2. 남성 명시 키워드
  if (/(남자|남성|맨즈|맨|men|man|male)/.test(lower)) {
    return "MALE";
  }

  // 3. 본질적 남성 종목 (보디빌딩, 피지크 등에서 성별 미지정 시 기본 남성)
  if (lower.includes("보디빌딩") || lower.includes("피지크")) {
    return "MALE";
  }

  return "ANY";
};

/**
 * 🏷️ 종목 어간 정규화
 */
export const normalizeCategory = (name = "") => {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/(여자|여성|우먼|우먼스|남자|남성|맨즈|일반부|마스터즈|학생부|클래스)/g, "");
};

/**
 * 🎯 [성별 엄격 구분] VibeFlows 카테고리와 대회 카테고리 간 지능형 매칭
 */
export const isCategoryMatched = (
  vibeflowCat = "",
  stageCat = "",
  explicitStageGender = ""
) => {
  if (!vibeflowCat || !stageCat) return false;

  const vibeLower = String(vibeflowCat).toLowerCase().replace(/\s+/g, "");
  const stageLower = String(stageCat).toLowerCase().replace(/\s+/g, "");

  // 1. 🚻 성별 엄격 1차 검증
  const isVibeFemale = /(여자|여성|우먼|우먼스|female|women|woman|비키니|모노키니|모던키니|피규어|보디피트니스|바디피트니스)/.test(vibeLower);
  const isVibeMale = /(남자|남성|맨즈|맨|male|men|man)/.test(vibeLower);

  const isStageFemale = /(여자|여성|우먼|우먼스|female|women|woman|비키니|모노키니|모던키니|피규어|보디피트니스|바디피트니스)/.test(stageLower) ||
    ["여", "여자", "여성", "female", "f"].includes(String(explicitStageGender).trim().toLowerCase());
  const isStageMale = /(남자|남성|맨즈|맨|male|men|man)/.test(stageLower) ||
    ["남", "남자", "남성", "male", "m"].includes(String(explicitStageGender).trim().toLowerCase());

  if (isVibeFemale && isStageMale) return false;
  if (isVibeMale && isStageFemale) return false;

  // 2. 🚻 성별 엄격 2차 검증: extractGender 분석
  const vibeGender = extractGender(vibeflowCat);
  const stageGender = extractGender(stageCat, explicitStageGender);

  if (vibeGender !== "ANY" && stageGender !== "ANY") {
    if (vibeGender !== stageGender) {
      return false;
    }
  }

  // 🎯 [사용자 지정 특별 규칙]
  const isPhysiqueTargetStage =
    /((남자|남성|맨즈|맨)?\s*(스포츠모델|스포츠\s*모델|핏모델|핏\s*모델|피트니스모델|피지크|학생부\s*핏모델))/i.test(stageCat) &&
    stageGender !== "FEMALE";

  if (isPhysiqueTargetStage) {
    if (/스포츠모델|스포츠\s*모델/i.test(vibeflowCat)) {
      return false;
    }
    if (/피지크|physique/i.test(vibeflowCat) && vibeGender !== "FEMALE") {
      return true;
    }
  }

  if (vibeflowCat === stageCat) return true;

  // 3. 🏷️ 종목 어간 검증
  const nVibe = normalizeCategory(vibeflowCat);
  const nStage = normalizeCategory(stageCat);

  if (nVibe && nStage) {
    if (nVibe === nStage) return true;
    if (nVibe.includes(nStage) || nStage.includes(nVibe)) return true;
  }

  // 4. 📚 대표적 동의어 / 호환 종목 사전
  const SYNONYM_GROUPS = [
    ["비키니", "모던키니", "모노키니", "보디피트니스", "바디피트니스", "bodyfitness", "bikini"],
    ["피지크", "머슬", "physique"],
    ["보디빌딩", "바디빌딩", "보디빌더", "bodybuilding"],
    ["스포츠모델", "청바지모델", "청바지", "바디핏", "스포츠", "피트니스모델", "sportsmodel", "jean", "jeans"],
    ["클래식피지크", "classicphysique"],
    ["클래식보디빌딩", "classicbodybuilding"],
    ["피규어", "figure"],
    ["애슬레틱", "어슬레틱", "athletic"],
  ];

  for (const group of SYNONYM_GROUPS) {
    const matchVibe = group.some((k) => nVibe.includes(k));
    const matchStage = group.some((k) => nStage.includes(k));
    if (matchVibe && matchStage) return true;
  }

  return false;
};

/**
 * 🏷️ 체급/부문(Division) 유연 매칭
 */
export const isDivisionMatched = (vibeflowDiv = "", stageGrade = "") => {
  if (!vibeflowDiv || !stageGrade) return false;
  if (vibeflowDiv === stageGrade) return true;

  const nVibe = vibeflowDiv.replace(/\s+/g, "").toLowerCase();
  const nStage = stageGrade.replace(/\s+/g, "").toLowerCase();

  if (nVibe === nStage) return true;
  if (nVibe.includes(nStage) || nStage.includes(nVibe)) return true;

  const DIV_GROUPS = [
    ["일반부", "성인부", "오픈", "open", "adult", "성인"],
    ["학생부", "청소년부", "주니어", "junior", "고등부", "중등부"],
    ["마스터즈", "장년부", "시니어", "masters"],
    ["그랑프리", "통합", "overall"],
  ];

  for (const group of DIV_GROUPS) {
    const matchVibe = group.some((k) => nVibe.includes(k));
    const matchStage = group.some((k) => nStage.includes(k));
    if (matchVibe && matchStage) return true;
  }

  return false;
};

/**
 * 💪 보디빌딩 계열 종목 판별
 */
export const isBodybuildingFamily = (categoryTitle = "") => {
  if (!categoryTitle) return false;
  return /(보디빌딩|바디빌딩|bodybuilding|클래식보디빌딩|classicbodybuilding|클래식\s*보디빌딩|클래식피지크|classicphysique|클래식\s*피지크|머슬|muscle)/i.test(categoryTitle);
};

/**
 * 🎯 성인부 우선 매칭 대상 종목 판별
 */
export const isAdultPriorityCategory = (categoryTitle = "", gender = "") => {
  if (!categoryTitle) return false;
  if (isBodybuildingFamily(categoryTitle)) return true;
  return (
    /((남자|남성|맨즈|맨)?\s*(스포츠모델|스포츠\s*모델|핏모델|핏\s*모델|피트니스모델|피지크|학생부\s*핏모델))/i.test(categoryTitle) &&
    extractGender(categoryTitle, gender) !== "FEMALE"
  );
};

/**
 * 🔑 음원 고유 식별 키 추출
 */
export const getTrackKey = (t) => {
  if (!t || typeof t !== "object") return "";
  return String(t.uuid || t.id || t.song_id || t._id || t.audio_url || t.downloadURL || t.url || "");
};

/**
 * 🎵 두 음원 객체가 동일한지 판별
 */
export const isTrackEqual = (t1, t2) => {
  if (!t1 || !t2) return false;
  if (t1 === t2) return true;

  const key1 = getTrackKey(t1);
  const key2 = getTrackKey(t2);

  if (key1 && key2) {
    return key1 === key2;
  }

  return false;
};

/**
 * 🇰🇷 국민의례 음원 판별
 */
export const isNationalCeremonyTrack = (t) => {
  if (!t) return false;
  const cat = (t.contest_category_kr || t.category || t.folder || "").trim();
  const title = (t.title || t.name || "").trim();
  if (cat.includes("국민의례") || cat.includes("애국가") || cat.includes("묵념") || cat.includes("의전")) return true;
  if (title.includes("국민의례") || title.includes("애국가") || title.includes("국기에 대한") || title.includes("순국선열")) return true;
  return false;
};

/**
 * 🎲 로컬/커스텀 음원 판별
 */
export const isCustomTrack = (t) => {
  if (!t) return false;
  if (t.is_custom || t.isCustom || t.isLocal || t.is_local) return true;
  const cat = (t.contest_category_kr || t.category || t.folder || "").trim();
  if (CUSTOM_CATEGORIES.some((c) => c.name === cat || c.key === cat)) return true;
  if (
    cat.includes("국민의례") ||
    cat.includes("애국가") ||
    cat.includes("묵념") ||
    cat.includes("내빈") ||
    cat.includes("귀빈") ||
    cat.includes("소개") ||
    cat.includes("시상") ||
    cat.includes("대기") ||
    cat.includes("휴식") ||
    cat.includes("인터미션")
  ) return true;
  return false;
};

/**
 * 🏷️ 특정 특별 연출 탭과 음원 간의 지능형 매칭 판별
 */
export const isMatchingCustomTab = (track, tabName) => {
  if (!track || !tabName) return false;
  if (!track.is_custom) return false; // 🔒 VibeFlows 공식 경기 음원은 절대 특별 연출 탭에 섞이지 않도록 차단
  const cat = String(track.contest_category_kr || track.category || track.folder || "").trim();
  const title = String(track.title || track.name || track.fileName || "").trim();
  const lowerCat = cat.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerTab = tabName.toLowerCase();

  if (cat === tabName) return true;
  if (cat && (lowerCat.includes(lowerTab) || lowerTab.includes(lowerCat))) return true;

  if (tabName === "국민의례 음악") {
    return (
      lowerCat.includes("국민의례") ||
      lowerCat.includes("애국가") ||
      lowerCat.includes("의전") ||
      lowerCat.includes("묵념") ||
      lowerTitle.includes("국민의례") ||
      lowerTitle.includes("애국가") ||
      lowerTitle.includes("국기에") ||
      lowerTitle.includes("묵념")
    );
  }

  if (tabName === "내빈소개 음악" || tabName === "내빈소개") {
    return (
      lowerCat.includes("내빈") ||
      lowerCat.includes("귀빈") ||
      lowerCat.includes("소개") ||
      lowerCat.includes("vip") ||
      lowerCat.includes("guest") ||
      lowerTitle.includes("내빈") ||
      lowerTitle.includes("귀빈") ||
      lowerTitle.includes("소개") ||
      lowerTitle.includes("vip") ||
      lowerTitle.includes("guest")
    );
  }

  if (tabName === "시상식때의 음악") {
    return (
      lowerCat.includes("시상") ||
      lowerCat.includes("순위") ||
      lowerCat.includes("발표") ||
      lowerCat.includes("award") ||
      lowerTitle.includes("시상") ||
      lowerTitle.includes("award") ||
      lowerTitle.includes("트로피") ||
      lowerTitle.includes("순위")
    );
  }

  if (tabName === "대기할때 음악") {
    return (
      lowerCat.includes("대기") ||
      lowerCat.includes("wait") ||
      lowerCat.includes("입장") ||
      lowerTitle.includes("대기") ||
      lowerTitle.includes("입장") ||
      lowerTitle.includes("wait")
    );
  }

  if (tabName === "쉬는시간의 음악") {
    return (
      lowerCat.includes("쉬는") ||
      lowerCat.includes("휴식") ||
      lowerCat.includes("인터미션") ||
      lowerCat.includes("intermission") ||
      lowerTitle.includes("휴식") ||
      lowerTitle.includes("쉬는") ||
      lowerTitle.includes("intermission")
    );
  }

  return false;
};

/**
 * ⏱️ 초 단위 시간 포맷 (00:00)
 */
export const formatSeconds = (sec) => {
  if (!sec || isNaN(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

/**
 * 🎵 음원 URL 안전 추출 함수
 */
export const getTrackAudioUrl = (track) => {
  if (!track) return "";
  return (
    track.audio_url ||
    track.downloadURL ||
    track.audioUrl ||
    track.url ||
    track.song_url ||
    track.songUrl ||
    track.file_url ||
    track.fileUrl ||
    track.music_url ||
    track.musicUrl ||
    track.src ||
    track.path ||
    ""
  );
};


