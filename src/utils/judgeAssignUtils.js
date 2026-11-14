/**
 * 심판 좌석 배정 정규화 · 공정 랜덤 추출 · 무결성 검증 유틸리티
 * 기존 Firestore `contest_judges_assign` 스키마와 100% 하위 호환을 유지합니다.
 */

export const normalizeSectionName = (value) => {
  const trimmed = (value ?? "").toString().trim();
  return trimmed || "미지정";
};

export const sortJudgesByName = (arr = []) =>
  [...arr].sort((a, b) =>
    (a?.judgeName || "").localeCompare(b?.judgeName || "", "ko", {
      sensitivity: "base",
      numeric: true,
    })
  );

/** Fisher-Yates 무편향 셔플 */
export const shuffleArray = (items = []) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * 체급 + 좌석 단일 배정 레코드 생성 (기존 스키마 100% 준수)
 */
export const buildJudgeAssignRecord = ({
  category,
  grade,
  judge,
  seatIndex,
  contestId,
  generateUUID,
  existingAssignId,
}) => {
  const catId = category?.contestCategoryId || grade?.refCategoryId || null;
  const sectionName = normalizeSectionName(category?.contestCategorySection);

  return {
    sectionName,
    categoryId: catId,
    refCategoryId: grade?.refCategoryId || catId,
    categoryTitle: category?.contestCategoryTitle || null,
    seatIndex: Number(seatIndex),
    judgeUid: judge.judgeUid,
    judgeName: judge.judgeName || "",
    judgesAssignId: existingAssignId || generateUUID(),
    contestId,
    isHead: Boolean(judge.isHead),
    onedayPassword: judge.onedayPassword || null,
    contestGradeId: grade.contestGradeId,
    contestGradeIndex:
      grade.contestGradeIndex !== undefined && grade.contestGradeIndex !== null
        ? grade.contestGradeIndex
        : 0,
    contestGradeTitle: grade.contestGradeTitle || "",
    isCompared: Boolean(grade.isCompared),
  };
};

/**
 * 저장본/원본 심판 배정 배열을 현재 종목·체급·심판풀 기준으로 정규화
 * - 삭제된 체급/종목 유령 레코드 제거
 * - 종목 심판 수(contestCategoryJudgeCount) 초과 좌석 제거
 * - 동일 (contestGradeId, seatIndex) 중복 제거 (최신 항목 우선)
 * - 섹션명 공백/변경 및 심판 비밀번호/위원장 여부 최신화
 */
export const normalizeJudgesAssignArray = ({
  judges = [],
  categories = [],
  grades = [],
  judgesPool = [],
  contestId = "",
  generateUUID = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
}) => {
  if (!categories.length || !grades.length) {
    return Array.isArray(judges) ? [...judges] : [];
  }

  const categoryById = {};
  categories.forEach((c) => {
    if (c?.contestCategoryId) {
      categoryById[c.contestCategoryId] = c;
    }
  });

  const gradeById = {};
  grades.forEach((g) => {
    if (g?.contestGradeId) {
      gradeById[g.contestGradeId] = g;
    }
  });

  const poolByUid = {};
  judgesPool.forEach((p) => {
    if (p?.judgeUid) {
      poolByUid[p.judgeUid] = p;
    }
  });

  // 동일 (contestGradeId, seatIndex) 중복 시 뒤에 추가된 최신 배정이 우선하도록 Map 사용
  const dedupedMap = new Map();

  (Array.isArray(judges) ? judges : []).forEach((row) => {
    if (!row || !row.judgeUid) return;

    const gradeId = row.contestGradeId || row.gradeId;
    const grade = gradeById[gradeId];
    if (!grade) return; // 삭제된 유령 체급 제거

    const cat = categoryById[grade.refCategoryId || row.categoryId || row.refCategoryId];
    if (!cat) return; // 삭제된 유령 종목 제거

    const maxSeats = Number(cat.contestCategoryJudgeCount || 0);
    const seatIndex = Number(row.seatIndex);
    if (!Number.isFinite(seatIndex) || seatIndex < 1) return;
    if (maxSeats > 0 && seatIndex > maxSeats) return; // 심판제 인원 초과 좌석 제거

    const liveJudge = poolByUid[row.judgeUid];
    const effectiveJudge = liveJudge
      ? {
          judgeUid: liveJudge.judgeUid,
          judgeName: liveJudge.judgeName || row.judgeName || "",
          isHead: Boolean(liveJudge.isHead),
          onedayPassword:
            liveJudge.onedayPassword ?? row.onedayPassword ?? null,
        }
      : {
          judgeUid: row.judgeUid,
          judgeName: row.judgeName || "",
          isHead: Boolean(row.isHead),
          onedayPassword: row.onedayPassword ?? null,
        };

    const key = `${grade.contestGradeId}__${seatIndex}`;
    dedupedMap.set(
      key,
      buildJudgeAssignRecord({
        category: cat,
        grade,
        judge: effectiveJudge,
        seatIndex,
        contestId: contestId || row.contestId || "",
        generateUUID,
        existingAssignId: row.judgesAssignId,
      })
    );
  });

  // 일관된 정렬: 종목순 → 체급순 → 좌석순
  return Array.from(dedupedMap.values()).sort((a, b) => {
    const catA = Number(categoryById[a.categoryId]?.contestCategoryIndex ?? 9999);
    const catB = Number(categoryById[b.categoryId]?.contestCategoryIndex ?? 9999);
    if (catA !== catB) return catA - catB;

    const grdA = Number(gradeById[a.contestGradeId]?.contestGradeIndex ?? 9999);
    const grdB = Number(gradeById[b.contestGradeId]?.contestGradeIndex ?? 9999);
    if (grdA !== grdB) return grdA - grdB;

    return Number(a.seatIndex) - Number(b.seatIndex);
  });
};

/**
 * 공정 랜덤 심판 추출
 * - excludeHead: true일 때 위원장(isHead) 자동 제외
 * - balanceWorkload: true일 때 현재 누적 배정 체급 수가 적은 심판부터 우선 선발하되,
 *   동률 구간 내부 및 최종 좌석 배치 순서는 모두 Fisher-Yates로 무작위 셔플하여 좌석 번호 편향을 원천 차단
 */
export const pickFairRandomJudges = ({
  judgesPool = [],
  excludedJudgeUids = [],
  count = 0,
  currentJudges = [],
  excludeHead = true,
  balanceWorkload = true,
}) => {
  if (count <= 0) return [];

  const excludedSet = new Set(excludedJudgeUids.filter(Boolean));
  const candidates = judgesPool.filter((j) => {
    if (!j?.judgeUid) return false;
    if (excludedSet.has(j.judgeUid)) return false;
    if (excludeHead && j.isHead) return false;
    return true;
  });

  if (candidates.length === 0) return [];

  if (!balanceWorkload) {
    return shuffleArray(candidates).slice(0, count);
  }

  // 심판별 현재 배정된 고유 체급 수 & 고유 종목 수 집계
  const gradeSetByUid = {};
  const categorySetByUid = {};
  (currentJudges || []).forEach((row) => {
    if (!row?.judgeUid) return;
    if (!gradeSetByUid[row.judgeUid]) {
      gradeSetByUid[row.judgeUid] = new Set();
      categorySetByUid[row.judgeUid] = new Set();
    }
    if (row.contestGradeId) gradeSetByUid[row.judgeUid].add(row.contestGradeId);
    if (row.categoryId) categorySetByUid[row.judgeUid].add(row.categoryId);
  });

  // 전체 후보를 먼저 셔플한 뒤 누적 배정 수 오름차순 정렬 (동률 심판 간 완전 무작위 보장)
  const shuffledCandidates = shuffleArray(candidates);
  shuffledCandidates.sort((a, b) => {
    const gA = gradeSetByUid[a.judgeUid]?.size || 0;
    const gB = gradeSetByUid[b.judgeUid]?.size || 0;
    if (gA !== gB) return gA - gB;

    const cA = categorySetByUid[a.judgeUid]?.size || 0;
    const cB = categorySetByUid[b.judgeUid]?.size || 0;
    return cA - cB;
  });

  // 선발된 count명을 다시 한 번 셔플하여 1번~N번 좌석 위치가 특정 심판에게 고정되지 않도록 보장
  const chosen = shuffledCandidates.slice(0, count);
  return shuffleArray(chosen);
};

/**
 * 대상 체급 집합(targetGrades)에 대해 특정 좌석(seatNumber)의 배정 상태 계산
 * 반환 status:
 * - "empty"    : 배정된 체급 0건
 * - "complete" : 모든 대상 체급에 동일 심판 1명이 빠짐없이 배정됨
 * - "partial"  : 일부 체급에만 배정되고 나머지 체급은 비어있음 (신규 체급 추가 시 발생!)
 * - "multi"    : 하위 체급별로 서로 다른 심판(2명 이상)이 배정됨 (비어있는 체급 동반 여부도 함께 반환)
 */
export const inspectScopeSeat = ({
  judges = [],
  targetGrades = [],
  categoryById = {},
  seatIndex,
}) => {
  const eligibleGrades = (targetGrades || []).filter((g) => {
    const cat = categoryById[g?.refCategoryId];
    const maxSeats = Number(cat?.contestCategoryJudgeCount || 0);
    return maxSeats >= seatIndex;
  });

  const totalEligible = eligibleGrades.length;
  if (totalEligible === 0) {
    return {
      status: "not_applicable",
      totalEligible: 0,
      assignedCount: 0,
      missingCount: 0,
      uniqueJudgeUids: [],
      primaryJudgeUid: undefined,
      judgeBreakdown: [],
    };
  }

  const eligibleIds = new Set(eligibleGrades.map((g) => g.contestGradeId));
  const matchingRows = (judges || []).filter(
    (row) =>
      eligibleIds.has(row.contestGradeId) &&
      Number(row.seatIndex) === Number(seatIndex) &&
      Boolean(row.judgeUid)
  );

  // 체급별 배정 확인
  const byGradeId = new Map();
  matchingRows.forEach((r) => {
    byGradeId.set(r.contestGradeId, r);
  });

  const assignedCount = byGradeId.size;
  const missingCount = Math.max(0, totalEligible - assignedCount);

  const countByUid = new Map();
  const nameByUid = new Map();
  byGradeId.forEach((r) => {
    countByUid.set(r.judgeUid, (countByUid.get(r.judgeUid) || 0) + 1);
    if (!nameByUid.has(r.judgeUid)) {
      nameByUid.set(r.judgeUid, r.judgeName || "");
    }
  });

  const judgeBreakdown = Array.from(countByUid.entries())
    .map(([judgeUid, cnt]) => ({
      judgeUid,
      judgeName: nameByUid.get(judgeUid) || "",
      count: cnt,
    }))
    .sort((a, b) => b.count - a.count);

  const uniqueJudgeUids = judgeBreakdown.map((b) => b.judgeUid);

  if (assignedCount === 0) {
    return {
      status: "empty",
      totalEligible,
      assignedCount: 0,
      missingCount: totalEligible,
      uniqueJudgeUids: [],
      primaryJudgeUid: undefined,
      judgeBreakdown: [],
    };
  }

  if (uniqueJudgeUids.length === 1 && missingCount === 0) {
    return {
      status: "complete",
      totalEligible,
      assignedCount,
      missingCount: 0,
      uniqueJudgeUids,
      primaryJudgeUid: uniqueJudgeUids[0],
      judgeBreakdown,
    };
  }

  if (uniqueJudgeUids.length === 1 && missingCount > 0) {
    return {
      status: "partial",
      totalEligible,
      assignedCount,
      missingCount,
      uniqueJudgeUids,
      primaryJudgeUid: uniqueJudgeUids[0],
      judgeBreakdown,
    };
  }

  return {
    status: "multi",
    totalEligible,
    assignedCount,
    missingCount,
    uniqueJudgeUids,
    // 다중일 때는 가장 많은 체급에 배정된 심판을 대표로 두되 UI에서 다중임을 명시
    primaryJudgeUid: judgeBreakdown[0]?.judgeUid,
    judgeBreakdown,
  };
};

/**
 * 전체 대회 심판 배정 정확성·무결성 진단 리포트 생성
 */
export const analyzeJudgeAssignmentHealth = ({
  judges = [],
  categories = [],
  grades = [],
  judgesPool = [],
}) => {
  const categoryById = {};
  categories.forEach((c) => {
    if (c?.contestCategoryId) categoryById[c.contestCategoryId] = c;
  });

  const poolByUid = {};
  judgesPool.forEach((p) => {
    if (p?.judgeUid) poolByUid[p.judgeUid] = p;
  });

  // 체급별 배정 맵
  const seatMapByGrade = {};
  (judges || []).forEach((r) => {
    if (!r?.contestGradeId || !r?.seatIndex) return;
    if (!seatMapByGrade[r.contestGradeId]) {
      seatMapByGrade[r.contestGradeId] = {};
    }
    seatMapByGrade[r.contestGradeId][Number(r.seatIndex)] = r;
  });

  let totalExpectedSeats = 0;
  let totalAssignedSeats = 0;
  const missingGrades = [];
  const duplicateJudgeGrades = [];

  const sortedGrades = [...grades].sort((a, b) => {
    const ca = Number(categoryById[a.refCategoryId]?.contestCategoryIndex ?? 9999);
    const cb = Number(categoryById[b.refCategoryId]?.contestCategoryIndex ?? 9999);
    if (ca !== cb) return ca - cb;
    return Number(a.contestGradeIndex ?? 9999) - Number(b.contestGradeIndex ?? 9999);
  });

  sortedGrades.forEach((g) => {
    const cat = categoryById[g.refCategoryId];
    if (!cat) return;
    const judgeCount = Number(cat.contestCategoryJudgeCount || 0);
    if (judgeCount <= 0) return;

    totalExpectedSeats += judgeCount;
    const gSeats = seatMapByGrade[g.contestGradeId] || {};
    const missingSeatNums = [];
    const uidCountInGrade = {};

    for (let s = 1; s <= judgeCount; s++) {
      const assigned = gSeats[s];
      if (assigned?.judgeUid) {
        totalAssignedSeats++;
        uidCountInGrade[assigned.judgeUid] =
          (uidCountInGrade[assigned.judgeUid] || 0) + 1;
      } else {
        missingSeatNums.push(s);
      }
    }

    if (missingSeatNums.length > 0) {
      missingGrades.push({
        contestGradeId: g.contestGradeId,
        sectionName: normalizeSectionName(cat.contestCategorySection),
        categoryTitle: cat.contestCategoryTitle || "이름 없는 종목",
        gradeTitle: g.contestGradeTitle || "이름 없는 체급",
        expected: judgeCount,
        missingSeats: missingSeatNums,
      });
    }

    const dupUids = Object.entries(uidCountInGrade)
      .filter(([, cnt]) => cnt > 1)
      .map(([uid]) => poolByUid[uid]?.judgeName || uid);

    if (dupUids.length > 0) {
      duplicateJudgeGrades.push({
        contestGradeId: g.contestGradeId,
        categoryTitle: cat.contestCategoryTitle || "",
        gradeTitle: g.contestGradeTitle || "",
        judgeNames: dupUids,
      });
    }
  });

  // 선발 풀에서 해제되었는데 좌석에 남아있는 배정 확인
  const removedPoolMap = new Map();
  (judges || []).forEach((r) => {
    if (r?.judgeUid && !poolByUid[r.judgeUid]) {
      const prev = removedPoolMap.get(r.judgeUid) || {
        judgeUid: r.judgeUid,
        judgeName: r.judgeName || r.judgeUid,
        count: 0,
      };
      prev.count += 1;
      removedPoolMap.set(r.judgeUid, prev);
    }
  });
  const removedFromPoolJudges = Array.from(removedPoolMap.values());

  // 선발 심판별 배정 통계
  const perJudgeStats = sortJudgesByName(judgesPool).map((p) => {
    const rows = (judges || []).filter((r) => r.judgeUid === p.judgeUid);
    const sections = new Set(rows.map((r) => r.sectionName).filter(Boolean));
    const cats = new Set(rows.map((r) => r.categoryId).filter(Boolean));
    const grds = new Set(rows.map((r) => r.contestGradeId).filter(Boolean));
    return {
      judgeUid: p.judgeUid,
      judgeName: p.judgeName || "-",
      judgePromoter: p.judgePromoter || "",
      isHead: Boolean(p.isHead),
      onedayPassword: p.onedayPassword || "",
      sectionCount: sections.size,
      categoryCount: cats.size,
      gradeCount: grds.size,
    };
  });

  // 위원장이 아닌 일반 선발 심판 중 0건 배정된 심판
  const unassignedActiveJudges = perJudgeStats.filter(
    (s) => !s.isHead && s.gradeCount === 0
  );

  const missingSeatsTotal = Math.max(0, totalExpectedSeats - totalAssignedSeats);
  const isHealthy =
    totalExpectedSeats > 0 &&
    missingSeatsTotal === 0 &&
    duplicateJudgeGrades.length === 0 &&
    removedFromPoolJudges.length === 0;

  return {
    totalExpectedSeats,
    totalAssignedSeats,
    missingSeatsTotal,
    missingGrades,
    duplicateJudgeGrades,
    removedFromPoolJudges,
    perJudgeStats,
    unassignedActiveJudges,
    isHealthy,
  };
};

/**
 * 사전 점검 · 모니터링 공용: 전체 부(1부/2부/그랑프리)·종목·무대 기준 심판 빈 좌석 사전 예고 요약기
 * - 삭제된 유령 체급 배정(orphan row)은 자동 제외하고 실제 유효 좌석만 집계합니다.
 * - categories+grades 또는 stages 어느 쪽이 주어져도 정확히 빈 좌석(예: "2부 7번석")을 탐지합니다.
 */
export const summarizeJudgeSeatGaps = ({
  judges = [],
  categories = [],
  grades = [],
  stages = [],
} = {}) => {
  const categoryById = {};
  (Array.isArray(categories) ? categories : []).forEach((c) => {
    if (c?.contestCategoryId) {
      categoryById[c.contestCategoryId] = c;
    }
  });

  const sectionHintByGradeId = {};
  const sectionHintByCategoryId = {};
  const assignedSeatsByGradeId = {};

  (Array.isArray(judges) ? judges : []).forEach((r) => {
    const gid = r?.contestGradeId || r?.gradeId;
    const cid = r?.categoryId || r?.refCategoryId;
    const rawSec = (r?.sectionName ?? "").toString().trim();
    if (rawSec && rawSec !== "미지정") {
      if (gid && !sectionHintByGradeId[gid]) sectionHintByGradeId[gid] = rawSec;
      if (cid && !sectionHintByCategoryId[cid]) sectionHintByCategoryId[cid] = rawSec;
    }
    const seatNo = Number(r?.seatIndex);
    if (gid && Number.isFinite(seatNo) && seatNo >= 1 && Boolean(r?.judgeUid)) {
      if (!assignedSeatsByGradeId[gid]) {
        assignedSeatsByGradeId[gid] = new Set();
      }
      assignedSeatsByGradeId[gid].add(seatNo);
    }
  });

  const stageNumsByGradeId = {};
  (Array.isArray(stages) ? stages : []).forEach((st) => {
    const stNo = Number(st?.stageNumber);
    const stSec = (st?.sectionName ?? "").toString().trim();
    if (stSec && st?.categoryId && !sectionHintByCategoryId[st.categoryId]) {
      sectionHintByCategoryId[st.categoryId] = stSec;
    }
    (Array.isArray(st?.grades) ? st.grades : []).forEach((sg) => {
      const gid = sg?.gradeId || sg?.contestGradeId;
      if (!gid) return;
      if (stSec && !sectionHintByGradeId[gid]) {
        sectionHintByGradeId[gid] = stSec;
      }
      if (Number.isFinite(stNo) && stNo > 0) {
        if (!stageNumsByGradeId[gid]) stageNumsByGradeId[gid] = new Set();
        stageNumsByGradeId[gid].add(stNo);
      }
    });
  });

  const targetGradeSpecs = [];
  const hasCategoryGradePool =
    Array.isArray(categories) &&
    categories.length > 0 &&
    Array.isArray(grades) &&
    grades.length > 0;

  if (hasCategoryGradePool) {
    const sortedGrades = [...grades].sort((a, b) => {
      const ca = Number(categoryById[a?.refCategoryId]?.contestCategoryIndex ?? 9999);
      const cb = Number(categoryById[b?.refCategoryId]?.contestCategoryIndex ?? 9999);
      if (ca !== cb) return ca - cb;
      return Number(a?.contestGradeIndex ?? 9999) - Number(b?.contestGradeIndex ?? 9999);
    });

    sortedGrades.forEach((g) => {
      if (!g?.contestGradeId) return;
      const cat = categoryById[g.refCategoryId];
      if (!cat) return;
      const expectedSeats = Number(cat.contestCategoryJudgeCount || 0);
      if (expectedSeats <= 0) return;

      const stageNumbers = Array.from(stageNumsByGradeId[g.contestGradeId] || []).sort(
        (a, b) => a - b
      );
      targetGradeSpecs.push({
        gradeId: g.contestGradeId,
        gradeTitle: g.contestGradeTitle || "체급",
        categoryId: cat.contestCategoryId,
        categoryTitle: cat.contestCategoryTitle || "종목",
        sectionName: normalizeSectionName(
          cat.contestCategorySection ||
            sectionHintByGradeId[g.contestGradeId] ||
            sectionHintByCategoryId[cat.contestCategoryId]
        ),
        expectedSeats,
        stageNumbers,
      });
    });
  } else if (Array.isArray(stages) && stages.length > 0) {
    const seenGradeIds = new Set();
    const sortedStages = [...stages].sort(
      (a, b) => Number(a?.stageNumber || 0) - Number(b?.stageNumber || 0)
    );

    sortedStages.forEach((st) => {
      const cat = st?.categoryId ? categoryById[st.categoryId] : null;
      const expectedSeats = Number(
        st?.categoryJudgeCount || cat?.contestCategoryJudgeCount || 0
      );
      if (expectedSeats <= 0) return;

      (Array.isArray(st?.grades) ? st.grades : []).forEach((sg) => {
        const gid = sg?.gradeId || sg?.contestGradeId;
        if (!gid || seenGradeIds.has(gid)) return;
        seenGradeIds.add(gid);

        const stageNumbers = Array.from(stageNumsByGradeId[gid] || []).sort(
          (a, b) => a - b
        );
        targetGradeSpecs.push({
          gradeId: gid,
          gradeTitle: sg?.gradeTitle || sg?.contestGradeTitle || "체급",
          categoryId: st?.categoryId || cat?.contestCategoryId || "",
          categoryTitle:
            st?.categoryTitle || cat?.contestCategoryTitle || "종목",
          sectionName: normalizeSectionName(
            st?.sectionName ||
              cat?.contestCategorySection ||
              sectionHintByGradeId[gid] ||
              sectionHintByCategoryId[st?.categoryId]
          ),
          expectedSeats,
          stageNumbers,
        });
      });
    });
  }

  let totalExpectedSeats = 0;
  let totalAssignedSeats = 0;
  const missingGradeItems = [];

  targetGradeSpecs.forEach((spec) => {
    totalExpectedSeats += spec.expectedSeats;
    const assignedSet = assignedSeatsByGradeId[spec.gradeId] || new Set();
    const missingSeats = [];

    for (let s = 1; s <= spec.expectedSeats; s += 1) {
      if (assignedSet.has(s)) {
        totalAssignedSeats += 1;
      } else {
        missingSeats.push(s);
      }
    }

    if (missingSeats.length > 0) {
      missingGradeItems.push({
        ...spec,
        missingSeats,
      });
    }
  });

  const missingSeatsTotal = Math.max(0, totalExpectedSeats - totalAssignedSeats);

  const sectionOrder = [];
  const sectionMap = new Map();
  missingGradeItems.forEach((item) => {
    if (!sectionMap.has(item.sectionName)) {
      sectionOrder.push(item.sectionName);
      sectionMap.set(item.sectionName, {
        sectionName: item.sectionName,
        seatSet: new Set(),
        categoryTitles: [],
        categorySet: new Set(),
        stageSet: new Set(),
        missingGradesCount: 0,
      });
    }
    const bucket = sectionMap.get(item.sectionName);
    bucket.missingGradesCount += 1;
    item.missingSeats.forEach((s) => bucket.seatSet.add(s));
    if (item.categoryTitle && !bucket.categorySet.has(item.categoryTitle)) {
      bucket.categorySet.add(item.categoryTitle);
      bucket.categoryTitles.push(item.categoryTitle);
    }
    (item.stageNumbers || []).forEach((n) => bucket.stageSet.add(n));
  });

  const formatStageRange = (nums) => {
    if (!nums.length) return "";
    if (nums.length === 1) return `무대 #${nums[0]}`;
    const min = nums[0];
    const max = nums[nums.length - 1];
    const isContiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    if (isContiguous || nums.length > 4) {
      return `무대 #${min}~#${max}`;
    }
    return `무대 ${nums.map((n) => `#${n}`).join(", ")}`;
  };

  const sectionSummaries = sectionOrder.map((secName) => {
    const b = sectionMap.get(secName);
    const seatNumbers = Array.from(b.seatSet).sort((a, c) => a - c);
    const stageNumbers = Array.from(b.stageSet).sort((a, c) => a - c);
    const seatTextShort = `${seatNumbers.join("·")}번석`;
    const shortLabel =
      secName && secName !== "미지정"
        ? `${secName} ${seatTextShort}`
        : seatTextShort;

    const catText =
      b.categoryTitles.length <= 2
        ? b.categoryTitles.join(", ")
        : `${b.categoryTitles[0]} 외 ${b.categoryTitles.length - 1}개 종목`;
    const stageText = formatStageRange(stageNumbers);
    const scopePrefix = secName && secName !== "미지정" ? `[${secName}] ` : "";

    const detailText = `${scopePrefix}${seatNumbers.join(
      ", "
    )}번 자리 심판 비어있음 (${catText} · ${b.missingGradesCount}개 체급${
      stageText ? ` · ${stageText}` : ""
    })`;

    return {
      sectionName: secName,
      seatNumbers,
      missingGradesCount: b.missingGradesCount,
      categoryTitles: b.categoryTitles,
      stageNumbers,
      shortLabel,
      detailText,
    };
  });

  const hasGap = missingSeatsTotal > 0;
  const shortJoined = sectionSummaries.map((s) => s.shortLabel).join(" · ");
  const headlineText = hasGap
    ? `${shortJoined} 미배정 (${totalAssignedSeats}/${totalExpectedSeats}석)`
    : totalExpectedSeats > 0
    ? `전 좌석 배정 완료 (${totalAssignedSeats}/${totalExpectedSeats}석)`
    : "";

  const preWarningText = hasGap
    ? `사전 예고: ${sectionSummaries
        .map((s) => s.detailText)
        .join(" / ")}. 대회 진행 전 심판 좌석 배정을 완료해 주세요.`
    : null;

  return {
    hasGap,
    totalExpectedSeats,
    totalAssignedSeats,
    missingSeatsTotal,
    missingGradesCount: missingGradeItems.length,
    missingGradeItems,
    sectionSummaries,
    shortJoined,
    headlineText,
    preWarningText,
  };
};

/**
 * 본부석 실시간 심판 긴급 변경 / 좌석 맞교체 순수 계산 헬퍼
 * - scope === "current_stage": 현재 진행 무대에 속한 체급들만 변경
 * - scope === "section_remaining": 현재 무대 + 동일 섹션(부)의 이후 남은 무대 체급들까지 일괄 변경
 * - swapMode === "replace": 대상 좌석(seatIndex)에 선택 심판 배정
 * - swapMode === "exchange": 현재 무대 다른 좌석(partnerSeatIndex)에 앉아있는 심판과 1:1 좌석 맞교체
 *
 * V1 / V2 / V3 하위 호환을 위해 Firestore `contest_judges_assign` 배열과
 * RTDB `currentStage/{contestId}/judges` 배열을 동시에 정합성 있게 생성합니다.
 */
export const applyEmergencyJudgeSeatSwap = ({
  judges = [],
  categories = [],
  grades = [],
  stages = [],
  currentStage = null,
  seatIndex,
  replacementJudge,
  scope = "current_stage",
  swapMode = "replace",
  partnerSeatIndex = null,
  currentRealtimeJudges = [],
  contestId = "",
  timestamp = Date.now(),
  generateUUID = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
}) => {
  const targetSeat = Number(seatIndex);
  if (!Number.isFinite(targetSeat) || targetSeat < 1) {
    throw new Error("유효한 심판석 번호(seatIndex)가 필요합니다.");
  }
  if (!replacementJudge?.judgeUid) {
    throw new Error("교체할 심판 정보(judgeUid)가 필요합니다.");
  }

  const categoryById = {};
  (Array.isArray(categories) ? categories : []).forEach((c) => {
    if (c?.contestCategoryId) {
      categoryById[c.contestCategoryId] = c;
    }
  });

  const gradeById = {};
  (Array.isArray(grades) ? grades : []).forEach((g) => {
    if (g?.contestGradeId) {
      gradeById[g.contestGradeId] = g;
    }
  });

  const sortedStages = [...(Array.isArray(stages) ? stages : [])].sort(
    (a, b) => Number(a?.stageNumber || 0) - Number(b?.stageNumber || 0)
  );

  const matchedCurrentStage =
    (currentStage?.stageId &&
      sortedStages.find((s) => s?.stageId === currentStage.stageId)) ||
    currentStage ||
    null;

  const extractStageGradeEntries = (stageObj) => {
    if (!stageObj) return [];
    if (Array.isArray(stageObj.grades) && stageObj.grades.length > 0) {
      return stageObj.grades
        .map((g) => ({
          gradeId: g?.gradeId || g?.contestGradeId || "",
          gradeTitle: g?.gradeTitle || g?.contestGradeTitle || "",
          categoryId:
            g?.categoryId || g?.refCategoryId || stageObj?.categoryId || "",
          categoryTitle: stageObj?.categoryTitle || "",
          categorySection: stageObj?.categorySection || "",
          categoryJudgeCount: Number(stageObj?.categoryJudgeCount || 0),
        }))
        .filter((g) => Boolean(g.gradeId));
    }
    if (stageObj.gradeId) {
      return [
        {
          gradeId: stageObj.gradeId,
          gradeTitle: stageObj.gradeTitle || "",
          categoryId: stageObj.categoryId || "",
          categoryTitle: stageObj.categoryTitle || "",
          categorySection: stageObj.categorySection || "",
          categoryJudgeCount: Number(stageObj.categoryJudgeCount || 0),
        },
      ];
    }
    return [];
  };

  const currentStageGradeEntries = extractStageGradeEntries(matchedCurrentStage);
  const currentStageGradeIds = Array.from(
    new Set(currentStageGradeEntries.map((g) => g.gradeId).filter(Boolean))
  );

  let targetStages = matchedCurrentStage ? [matchedCurrentStage] : [];
  if (scope === "section_remaining" && matchedCurrentStage) {
    const activeCat = categoryById[matchedCurrentStage.categoryId];
    const activeSection = normalizeSectionName(
      matchedCurrentStage.categorySection || activeCat?.contestCategorySection
    );
    const currentStageNum = Number(matchedCurrentStage.stageNumber || 0);

    const remainingInSection = sortedStages.filter((st) => {
      if (!st || st.stageId === matchedCurrentStage.stageId) return false;
      if (Number(st.stageNumber || 0) <= currentStageNum) return false;
      const stCat = categoryById[st.categoryId];
      const stSection = normalizeSectionName(
        st.categorySection || stCat?.contestCategorySection
      );
      return stSection === activeSection;
    });

    targetStages = [matchedCurrentStage, ...remainingInSection];
  }

  const realtimeList = Array.isArray(currentRealtimeJudges)
    ? currentRealtimeJudges.map((j) => (j ? { ...j } : j))
    : [];

  const findRealtimeSlotIndex = (sIdx) => {
    const byField = realtimeList.findIndex(
      (j) => Number(j?.seatIndex) === Number(sIdx)
    );
    if (byField !== -1) return byField;
    if (sIdx - 1 >= 0 && sIdx - 1 < realtimeList.length) return sIdx - 1;
    return -1;
  };

  const targetSlotIdx = findRealtimeSlotIndex(targetSeat);
  const existingTargetSlot =
    targetSlotIdx !== -1 ? realtimeList[targetSlotIdx] : null;

  const primaryGradeId = currentStageGradeIds[0] || "";
  const fallbackAssignedTarget = (Array.isArray(judges) ? judges : []).find(
    (r) =>
      Number(r?.seatIndex) === targetSeat &&
      (r?.contestGradeId === primaryGradeId || r?.gradeId === primaryGradeId)
  );

  const outgoingJudge =
    existingTargetSlot?.judgeUid
      ? {
          judgeUid: existingTargetSlot.judgeUid,
          judgeName: existingTargetSlot.judgeName || "",
          onedayPassword: existingTargetSlot.onedayPassword ?? null,
          isHead: Boolean(
            existingTargetSlot.isHead ?? fallbackAssignedTarget?.isHead
          ),
        }
      : fallbackAssignedTarget?.judgeUid
      ? {
          judgeUid: fallbackAssignedTarget.judgeUid,
          judgeName: fallbackAssignedTarget.judgeName || "",
          onedayPassword: fallbackAssignedTarget.onedayPassword ?? null,
          isHead: Boolean(fallbackAssignedTarget.isHead),
        }
      : null;

  const numericPartnerSeat = Number(partnerSeatIndex);
  const isSeatExchange =
    swapMode === "exchange" &&
    Number.isFinite(numericPartnerSeat) &&
    numericPartnerSeat >= 1 &&
    numericPartnerSeat !== targetSeat;

  // 대상 체급 목록 추출 (좌석 수가 해당 좌석 이상인 체급만 적용)
  const targetGradeMetaMap = new Map();
  targetStages.forEach((st) => {
    extractStageGradeEntries(st).forEach((entry) => {
      const cat = categoryById[entry.categoryId];
      const maxSeats = Number(
        cat?.contestCategoryJudgeCount || entry.categoryJudgeCount || 0
      );
      if (maxSeats > 0 && targetSeat > maxSeats) {
        return;
      }
      if (!targetGradeMetaMap.has(entry.gradeId)) {
        targetGradeMetaMap.set(entry.gradeId, {
          ...entry,
          maxSeats,
        });
      }
    });
  });

  const buildSafeAssignRow = ({ gradeMeta, seatNum, judgeObj, prevRow }) => {
    const gradeObj = gradeById[gradeMeta.gradeId] || {
      contestGradeId: gradeMeta.gradeId,
      contestGradeTitle:
        gradeMeta.gradeTitle || prevRow?.contestGradeTitle || "",
      contestGradeIndex: prevRow?.contestGradeIndex ?? 0,
      refCategoryId:
        gradeMeta.categoryId || prevRow?.refCategoryId || prevRow?.categoryId || null,
      isCompared: Boolean(prevRow?.isCompared),
    };
    const catObj =
      categoryById[
        gradeObj.refCategoryId || gradeMeta.categoryId || prevRow?.categoryId
      ] || {
        contestCategoryId:
          gradeMeta.categoryId || prevRow?.categoryId || gradeObj.refCategoryId || null,
        contestCategoryTitle:
          gradeMeta.categoryTitle || prevRow?.categoryTitle || null,
        contestCategorySection:
          gradeMeta.categorySection || prevRow?.sectionName || "미지정",
      };

    return buildJudgeAssignRecord({
      category: catObj,
      grade: gradeObj,
      judge: judgeObj,
      seatIndex: seatNum,
      contestId: contestId || prevRow?.contestId || "",
      generateUUID,
      existingAssignId: prevRow?.judgesAssignId,
    });
  };

  const updatedRows = [...(Array.isArray(judges) ? judges : [])];

  const upsertGradeSeat = (gradeMeta, seatNum, judgeObj) => {
    const gId = gradeMeta.gradeId;
    let prevRow = null;
    for (let i = updatedRows.length - 1; i >= 0; i--) {
      const r = updatedRows[i];
      const rGradeId = r?.contestGradeId || r?.gradeId;
      if (rGradeId === gId && Number(r?.seatIndex) === Number(seatNum)) {
        if (!prevRow) prevRow = r;
        updatedRows.splice(i, 1);
      }
    }

    if (judgeObj?.judgeUid) {
      updatedRows.push(
        buildSafeAssignRow({
          gradeMeta,
          seatNum,
          judgeObj,
          prevRow,
        })
      );
    }
  };

  targetGradeMetaMap.forEach((gradeMeta) => {
    upsertGradeSeat(gradeMeta, targetSeat, replacementJudge);

    if (isSeatExchange) {
      const canApplyPartner =
        gradeMeta.maxSeats <= 0 || numericPartnerSeat <= gradeMeta.maxSeats;
      if (canApplyPartner) {
        // 맞교체 시 기존 targetSeat에 심판이 있었다면 partnerSeat로 이동, 없었다면(미배정 좌석) partnerSeat를 비움
        upsertGradeSeat(gradeMeta, numericPartnerSeat, outgoingJudge);
      }
    }
  });

  // RTDB currentStage.judges 갱신
  const buildSwappedSlot = (existingSlot, seatNum, judgeObj) => ({
    ...(existingSlot || {}),
    seatIndex: Number(seatNum),
    judgeUid: judgeObj?.judgeUid ?? null,
    judgeName: judgeObj?.judgeName ?? null,
    onedayPassword: judgeObj?.onedayPassword ?? null,
    isHead: Boolean(judgeObj?.isHead),
    isLogined: false,
    isEnd: false,
    errors: "",
    forceRestartAt: timestamp,
    judgeSwappedAt: timestamp,
  });

  if (targetSlotIdx !== -1) {
    realtimeList[targetSlotIdx] = buildSwappedSlot(
      realtimeList[targetSlotIdx],
      targetSeat,
      replacementJudge
    );
  } else if (targetSeat >= 1) {
    realtimeList[targetSeat - 1] = buildSwappedSlot(
      null,
      targetSeat,
      replacementJudge
    );
  }

  const affectedSeats = [targetSeat];

  if (isSeatExchange) {
    const partnerSlotIdx = findRealtimeSlotIndex(numericPartnerSeat);
    if (partnerSlotIdx !== -1) {
      realtimeList[partnerSlotIdx] = buildSwappedSlot(
        realtimeList[partnerSlotIdx],
        numericPartnerSeat,
        outgoingJudge
      );
      affectedSeats.push(numericPartnerSeat);
    }
  }

  return {
    nextJudgesAssign: updatedRows,
    nextRealtimeJudges: realtimeList,
    affectedSeats,
    isSeatExchange,
    outgoingJudge,
    targetGradeIds: Array.from(targetGradeMetaMap.keys()),
    currentStageGradeIds,
    affectedStagesCount: targetStages.length,
  };
};
