import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  sanitizeForFirestore,
  sanitizeForRealtimeDb,
  isValidRealtimePath,
} from "../src/utils/firestoreSanitize.js";
import {
  isActiveStagePlayer,
  resolveEntryOrigin,
  resolveOriginalGradeTitle,
  resolveOriginalCategoryTitle,
  parseHeightWeightValue,
  formatHeightWeightValue,
  mergePreservingUnmatchedFinalEntries,
  getStagePlayersForGrade,
  getAllStagePlayers,
} from "../src/utils/playerEntryUtils.js";
import {
  isNonPlayerKey,
  isNonPlayerUrl,
  extractPlayerPhotos,
  resolveEffectiveStagePhotoFields,
} from "../src/utils/playerPhotoUtils.js";
import {
  isScoreEntered,
  getTrimCountPerSide,
  computeJudgeSeatNumbers,
  assignMinMaxAndCalculateRankTotal,
} from "../src/utils/scoringEngine.js";
import {
  buildContestResultDocId,
  dedupeContestResultsByGrade,
} from "../src/utils/contestResultsUtils.js";
import {
  removeStageCompareByLocalIndex,
  buildRealtimeCompareAfterCancel,
  getComparePlayerKey,
  buildAuthorityComparePlayers,
  extractTieBreakGroupsFromResult,
} from "../src/utils/compareVoteUtils.js";
import { buildStageWithSyncedMetadata } from "../src/utils/stageMetadataUtils.js";
import {
  isGrandPrixPlayerEntry,
  getStagePlayerSortIndex,
  syncGrandPrixPlayerIndexForStage,
  matchedGradewWithPlayers,
} from "../src/functions/functions.js";
import {
  resolveDedicatedStationRole,
  getAllowedTargetsForStation,
  sanitizeStationTargetScope,
  isPacketVisibleToStation,
  shouldAlertStation,
} from "../src/utils/liveIntercomRules.js";
import {
  buildLiveStageRealtimeSnapshot,
  resolveEffectiveStagePlayers,
} from "../src/utils/liveStageSnapshotUtils.js";
import { applyEmergencyJudgeSeatSwap } from "../src/utils/judgeAssignUtils.js";
import {
  applyStage1AssignDirectEdit,
  hydrateWeighInLayerPlayers,
  forwardWeighInToFinalPlayers,
  applyStage3FinalDirectEdit,
} from "../src/utils/layerPlayerEditUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");

test("1. firestoreSanitize & RTDB path safety", () => {
  const dirtyObj = {
    a: 1,
    b: undefined,
    c: Number.NaN,
    d: [10, undefined, { keep: "ok", drop: undefined }],
  };
  const fsClean = sanitizeForFirestore(dirtyObj);
  assert.deepEqual(fsClean, {
    a: 1,
    c: 0,
    d: [10, null, { keep: "ok" }],
  });
  assert.equal("b" in fsClean, false);

  // Realtime DB update() must OMIT undefined keys rather than turning them into null (which deletes fields!)
  const rtdbClean = sanitizeForRealtimeDb({
    stageId: "st_1",
    unchangedField: undefined,
    explicitDelete: null,
    badNum: Number.POSITIVE_INFINITY,
  });
  assert.deepEqual(rtdbClean, {
    stageId: "st_1",
    explicitDelete: null,
    badNum: 0,
  });
  assert.equal("unchangedField" in rtdbClean, false);

  assert.equal(isValidRealtimePath(""), false);
  assert.equal(isValidRealtimePath("/"), false);
  assert.equal(isValidRealtimePath("currentStage/undefined"), false);
  assert.equal(isValidRealtimePath("currentStage/null"), false);
  assert.equal(isValidRealtimePath("currentStage/bad.key"), false);
  assert.equal(isValidRealtimePath("currentStage/contest_2026"), true);
});

test("2. playerEntryUtils — active filter, provenance, merge & stage ordering", () => {
  assert.equal(isActiveStagePlayer({ playerName: "A" }), true);
  assert.equal(isActiveStagePlayer({ playerName: "A", playerNoShow: false }), true);
  assert.equal(isActiveStagePlayer({ playerName: "A", playerNoShow: null }), true);
  assert.equal(isActiveStagePlayer({ playerName: "A", playerNoShow: true }), false);
  assert.equal(isActiveStagePlayer(null), false);

  assert.equal(resolveEntryOrigin({ createdBy: "force" }), "force");
  assert.equal(resolveEntryOrigin({ createBy: "FORCE" }), "force");
  assert.equal(resolveEntryOrigin({ createBy: "manual" }), "manual");
  assert.equal(resolveEntryOrigin({}), "web");

  assert.equal(
    resolveOriginalGradeTitle({ originalgradeTitle: "-70kg" }),
    "-70kg"
  );
  assert.equal(
    resolveOriginalGradeTitle({ originalGradeTitle: "-75kg" }),
    "-75kg"
  );
  assert.equal(
    resolveOriginalCategoryTitle({ originalCategoryTitle: "보디빌딩" }),
    "보디빌딩"
  );

  assert.deepEqual(parseHeightWeightValue("178.5cm / 81.2kg"), {
    height: "178.5",
    weight: "81.2",
  });
  assert.equal(formatHeightWeightValue("178.5", "81.2"), "178.5 / 81.2");

  // mergePreservingUnmatchedFinalEntries: keep Grand Prix ("종목 그랑프리") & Force entries, drop stale gradeChanged duplicates
  const target = [
    {
      playerUid: "u1",
      playerNumber: 11,
      contestCategoryId: "cat_bb",
      contestGradeId: "g_75",
      originalGradeId: "g_70",
      isGradeChanged: true,
    },
  ];
  const existingFinal = [
    // Stale regular entry for same (u1, cat_bb) in old grade -> should NOT duplicate
    {
      playerUid: "u1",
      playerNumber: 11,
      contestCategoryId: "cat_bb",
      contestGradeId: "g_70",
      isGradeChanged: true,
    },
    // Grand Prix entry ("보디빌딩 그랑프리") -> MUST be preserved
    {
      playerUid: "u1",
      playerNumber: 11,
      contestCategoryId: "cat_gp",
      contestCategoryTitle: "보디빌딩 그랑프리",
      contestGradeId: "g_gp",
      grandPrixIndex: 1,
    },
    // Force entry -> MUST be preserved
    {
      playerUid: "u_force",
      playerNumber: 99,
      contestCategoryId: "cat_bb",
      contestGradeId: "g_75",
      createdBy: "force",
    },
  ];
  const merged = mergePreservingUnmatchedFinalEntries(target, existingFinal);
  assert.equal(merged.length, 3);
  assert.equal(merged.some((p) => p.contestGradeId === "g_gp"), true);
  assert.equal(merged.some((p) => p.playerUid === "u_force"), true);

  // Combined stage ordering: regular keeps +1000 isGradeChanged last; NoShow excluded
  const pool = [
    { playerUid: "p_moved", playerNumber: 5, contestGradeId: "g1", playerIndex: 1005, isGradeChanged: true, playerNoShow: false },
    { playerUid: "p_norm", playerNumber: 12, contestGradeId: "g1", playerIndex: 12 },
    { playerUid: "p_noshow", playerNumber: 1, contestGradeId: "g1", playerIndex: 1, playerNoShow: true },
    { playerUid: "p_g2", playerNumber: 20, contestGradeId: "g2", playerIndex: 20 },
  ];
  const stageAll = getAllStagePlayers(pool, [{ gradeId: "g1" }, { gradeId: "g2" }]);
  assert.deepEqual(
    stageAll.map((p) => p.playerUid),
    ["p_norm", "p_moved", "p_g2"]
  );
  assert.equal(getStagePlayersForGrade(pool, "g1").length, 2);
});

test("3. playerPhotoUtils — poster rejection & cleared slot non-resurrection", () => {
  assert.equal(isNonPlayerKey("contestPosterUrl"), true);
  assert.equal(isNonPlayerKey("playerPhotos"), false);
  assert.equal(isNonPlayerUrl("https://cdn.site/contest_poster_1.jpg"), true);
  assert.equal(isNonPlayerUrl("https://cdn.site/athletes/kim_1.jpg"), false);

  const extracted = extractPlayerPhotos({
    contestPoster: "https://cdn.site/poster_main.jpg",
    playerPhotoUrlsJson: JSON.stringify([
      "https://cdn.site/athletes/p1.jpg",
      "https://cdn.site/ybbf_logo.png",
      "https://cdn.site/athletes/p2.jpg",
    ]),
  });
  assert.deepEqual(extracted, [
    "https://cdn.site/athletes/p1.jpg",
    "https://cdn.site/athletes/p2.jpg",
  ]);

  // Explicit clear ("") in primarySource MUST NOT resurrect fallbackSource URLs
  const cleared = resolveEffectiveStagePhotoFields(
    { stagePhoto1: "", stagePhoto2: "", stagePhotoUrl: "" },
    {
      stagePhoto1: "https://cdn.site/athletes/old1.jpg",
      stagePhoto2: "https://cdn.site/athletes/old2.jpg",
      stagePhotoUrl: "https://cdn.site/athletes/old1.jpg",
    }
  );
  assert.equal(cleared.stagePhoto1, "");
  assert.equal(cleared.stagePhoto2, "");
  assert.equal(cleared.stagePhotoUrl, "");

  // Missing slot in primarySource inherits fallbackSource
  const inherited = resolveEffectiveStagePhotoFields(
    { playerName: "홍길동" },
    { stagePhoto1: "https://cdn.site/athletes/old1.jpg" }
  );
  assert.equal(inherited.stagePhoto1, "https://cdn.site/athletes/old1.jpg");
  assert.equal(inherited.stagePhotoUrl, "https://cdn.site/athletes/old1.jpg");
});

test("4. scoringEngine — 5/7/9-judge Rank & Point trimming + >=1000 rank exclusion", () => {
  assert.equal(isScoreEntered(0), false);
  assert.equal(isScoreEntered(""), false);
  assert.equal(isScoreEntered(null), false);
  assert.equal(isScoreEntered(1), true);

  assert.equal(getTrimCountPerSide(5), 0);
  assert.equal(getTrimCountPerSide(7), 1);
  assert.equal(getTrimCountPerSide(9), 2);
  assert.deepEqual(computeJudgeSeatNumbers([{ seatIndex: 1 }], 7), [1, 2, 3, 4, 5, 6, 7]);

  const mkScores = (vals) =>
    vals.map((v, idx) => ({ seatIndex: idx + 1, playerScore: v }));

  // 5-judge rank: no trim
  const r5 = assignMinMaxAndCalculateRankTotal({ score: mkScores([1, 2, 2, 3, 5]) });
  assert.equal(r5.totalScore, 13);

  // 7-judge rank: trim 1 min + 1 max
  const r7 = assignMinMaxAndCalculateRankTotal({
    score: mkScores([1, 1, 2, 2, 3, 3, 5]),
  });
  assert.equal(r7.totalScore, 11);
  assert.equal(r7.score.filter((s) => s.isMin).length, 1);
  assert.equal(r7.score.filter((s) => s.isMax).length, 1);

  // 7-judge rank with SINGLE 1000 outlier -> 1000 trimmed as worst, normal rank total!
  const r7Single1000 = assignMinMaxAndCalculateRankTotal({
    score: mkScores([1, 2, 2, 2, 3, 3, 1000]),
  });
  assert.equal(r7Single1000.totalScore, 12);

  // 7-judge rank with TWO 1000s -> one remains active -> rank-excluded (>= 1000)
  const r7Double1000 = assignMinMaxAndCalculateRankTotal({
    score: mkScores([1, 2, 2, 3, 3, 1000, 1000]),
  });
  assert.equal(r7Double1000.totalScore >= 1000, true);

  // 9-judge rank: trim 2 min + 2 max
  const r9 = assignMinMaxAndCalculateRankTotal({
    score: mkScores([1, 1, 2, 2, 2, 3, 3, 5, 6]),
  });
  assert.equal(r9.totalScore, 12);
});

test("5. contestResultsUtils — deterministic ID & cross-consumer deduplication", () => {
  const detId = buildContestResultDocId("contest_13", "grade_bb_70");
  assert.equal(detId, "contest_13__grade_bb_70");

  const docs = [
    { id: "legacy_old", contestId: "contest_13", gradeId: "grade_bb_70", savedAt: 1000, winner: "Old" },
    { id: "foreign_doc", contestId: "other_contest", gradeId: "grade_bb_70", savedAt: 9999, winner: "Foreign" },
    { id: detId, contestId: "contest_13", gradeId: "grade_bb_70", savedAt: 2000, winner: "Latest" },
  ];
  const deduped = dedupeContestResultsByGrade(docs, "contest_13");
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].winner, "Latest");

  // Order-independent deterministic selection when legacy docs lack timestamps
  const untimestampedA = [
    { id: "z_random", contestId: "c1", gradeId: "g1", tag: "random" },
    { id: "c1__g1", contestId: "c1", gradeId: "g1", tag: "deterministic" },
  ];
  const untimestampedB = [...untimestampedA].reverse();
  assert.equal(dedupeContestResultsByGrade(untimestampedA, "c1")[0].tag, "deterministic");
  assert.equal(dedupeContestResultsByGrade(untimestampedB, "c1")[0].tag, "deterministic");
});

test("6. compareVoteUtils — multi-stage compare cancel isolation & RTDB reset", () => {
  const allCompares = [
    { stageId: "stage_1", compareIndex: 1, players: [{ playerNumber: 1 }] },
    { stageId: "stage_2", compareIndex: 1, players: [{ playerNumber: 10 }, { playerNumber: 12 }] },
    { stageId: "stage_2", compareIndex: 2, players: [{ playerNumber: 10 }, { playerNumber: 15 }] },
    { stageId: "stage_3", compareIndex: 1, players: [{ playerNumber: 30 }] },
  ];

  // Cancel 2nd compare (local index 1) of stage_2 -> stage_1 and stage_3 MUST remain intact!
  const { nextAllCompares, nextStageCompares } = removeStageCompareByLocalIndex(
    allCompares,
    "stage_2",
    1
  );
  assert.equal(nextAllCompares.length, 3);
  assert.equal(nextStageCompares.length, 1);
  assert.equal(nextAllCompares.some((c) => c.stageId === "stage_1"), true);
  assert.equal(nextAllCompares.some((c) => c.stageId === "stage_3"), true);

  const restoredRtdb = buildRealtimeCompareAfterCancel(nextStageCompares);
  assert.equal(restoredRtdb.compareIndex, 1);
  assert.equal(restoredRtdb.status.compareIng, true);
  assert.deepEqual(restoredRtdb.confirmed.numbers, [10, 12]);

  // Cancel last remaining compare of stage_2 -> RTDB players & confirmed cleanly cleared!
  const afterZero = removeStageCompareByLocalIndex(nextAllCompares, "stage_2", 0);
  assert.equal(afterZero.nextStageCompares.length, 0);
  assert.equal(afterZero.nextAllCompares.length, 2); // stage_1 & stage_3 still preserved!
  const clearedRtdb = buildRealtimeCompareAfterCancel(afterZero.nextStageCompares);
  assert.equal(clearedRtdb.compareIndex, null);
  assert.equal(clearedRtdb.status.compareIng, false);
  assert.deepEqual(clearedRtdb.players, []);
  assert.deepEqual(clearedRtdb.confirmed, { count: 0, numbers: [] });

  // Head Judge direct authority confirmation (0 votes & partial votes)
  const stageCandidates = [
    { playerUid: "u5", playerNumber: 5, playerName: "김오번" },
    { playerUid: "u1", playerNumber: 1, playerName: "홍일번", playerGym: "서울짐" },
    { playerUid: "u3", playerNumber: 3 },
  ];
  const selectedKeys = [
    getComparePlayerKey(stageCandidates[0]),
    getComparePlayerKey(stageCandidates[1]),
    getComparePlayerKey(stageCandidates[2]),
  ];
  const zeroVoteConfirmed = buildAuthorityComparePlayers(stageCandidates, selectedKeys, []);
  assert.deepEqual(
    zeroVoteConfirmed.map((p) => p.playerNumber),
    [1, 3, 5]
  );
  assert.equal(zeroVoteConfirmed.every((p) => p.votedCount === 0), true);
  assert.equal(
    zeroVoteConfirmed.every((p) =>
      Object.values(p).every((val) => val !== undefined)
    ),
    true
  );

  const partialVoteConfirmed = buildAuthorityComparePlayers(
    stageCandidates,
    selectedKeys,
    [{ playerUid: "u3", playerNumber: 3, votedCount: 4 }]
  );
  assert.equal(
    partialVoteConfirmed.find((p) => p.playerNumber === 3)?.votedCount,
    4
  );
});

test("7. stageMetadataUtils & Grand Prix playerIndexOriginal / playerIndex sync", () => {
  const categories = [
    {
      contestCategoryId: "cat_2_bb",
      contestCategoryTitle: "보디빌딩",
      contestCategoryJudgeCount: 7,
      contestCategoryJudgeType: "point",
      contestCategoryIsOverall: true,
      contestCategorySection: "2부",
    },
    {
      contestCategoryId: "cat_gp",
      contestCategoryTitle: "보디빌딩 그랑프리",
      contestCategoryJudgeCount: 7,
      contestCategoryJudgeType: "ranking",
      contestCategoryIsOverall: false,
      contestCategorySection: "그랑프리",
    },
  ];
  const players = [
    { playerUid: "u1", playerNumber: 10, contestGradeId: "g_bb_1", playerIndex: 1010, isGradeChanged: true, playerNoShow: false },
    { playerUid: "u2", playerNumber: 11, contestGradeId: "g_bb_1", playerIndex: 11, playerNoShow: true },
    // Grand Prix entries: u1 won -70kg (grade idx 1, had +1000 regular index 1010), u3 won -80kg (grade idx 3, regular index 31)
    { playerUid: "u3", playerNumber: 31, contestGradeId: "g_gp", contestCategorySection: "그랑프리", originalGradeId: "g_bb_3", originalGradeIndex: 3, playerIndex: 31, grandPrixIndex: 2 },
    { playerUid: "u1", playerNumber: 10, contestGradeId: "g_gp", contestCategorySection: "그랑프리", originalGradeId: "g_bb_1", originalGradeIndex: 1, playerIndex: 1010, grandPrixIndex: 1, isGradeChanged: true },
  ];

  const syncedStage = buildStageWithSyncedMetadata(
    { stageId: "s1", stageNumber: 1 },
    [{ gradeId: "g_bb_1", categoryId: "cat_2_bb", gradeTitle: "-70kg" }],
    categories,
    players
  );
  assert.equal(syncedStage.categoryJudgeCount, 7);
  assert.equal(syncedStage.categorySection, "2부");
  assert.equal(syncedStage.categoryJudgeType, "ranking");
  assert.equal(syncedStage.categoryIsOverall, true);
  assert.equal(syncedStage.grades[0].playerCount, 1); // u2 (NoShow) excluded!

  // Regular stage -> syncGrandPrixPlayerIndexForStage MUST NOT touch anything
  const regSync = syncGrandPrixPlayerIndexForStage(players, syncedStage, categories);
  assert.equal(regSync.isGrandPrixStage, false);
  assert.equal(regSync.changed, false);
  assert.equal(regSync.players[0].playerIndex, 1010);

  // Grand Prix stage -> overwrites playerIndex with grandPrixIndex (1, 2) and preserves playerIndexOriginal (1010, 31)
  const gpStage = {
    stageId: "s_gp",
    categoryId: "cat_gp",
    categorySection: "그랑프리",
    grades: [{ gradeId: "g_gp" }],
  };
  const gpSync1 = syncGrandPrixPlayerIndexForStage(players, gpStage, categories);
  assert.equal(gpSync1.isGrandPrixStage, true);
  assert.equal(gpSync1.changed, true);

  const gpU1 = gpSync1.players.find((p) => p.contestGradeId === "g_gp" && p.playerUid === "u1");
  const gpU3 = gpSync1.players.find((p) => p.contestGradeId === "g_gp" && p.playerUid === "u3");
  assert.equal(gpU1.playerIndexOriginal, 1010);
  assert.equal(gpU1.playerIndex, 1);
  assert.equal(gpU1.grandPrixIndex, 1);
  assert.equal(gpU1.isGradeChanged, false);
  assert.equal(gpU3.playerIndexOriginal, 31);
  assert.equal(gpU3.playerIndex, 2);

  // Regular entry of u1 MUST still keep playerIndex 1010 & isGradeChanged: true!
  const regU1 = gpSync1.players.find((p) => p.contestGradeId === "g_bb_1" && p.playerUid === "u1");
  assert.equal(regU1.playerIndex, 1010);
  assert.equal(regU1.isGradeChanged, true);

  // Idempotency: calling a 2nd time MUST return changed: false and keep playerIndexOriginal === 1010
  const gpSync2 = syncGrandPrixPlayerIndexForStage(gpSync1.players, gpStage, categories);
  assert.equal(gpSync2.changed, false);
  const gpU1After2 = gpSync2.players.find((p) => p.contestGradeId === "g_gp" && p.playerUid === "u1");
  assert.equal(gpU1After2.playerIndexOriginal, 1010);

  assert.equal(isGrandPrixPlayerEntry(gpU1), true);
  assert.equal(getStagePlayerSortIndex(gpU1), 1);
  assert.equal(matchedGradewWithPlayers("", "g_bb_1", players).length, 1);
});

test("8. Static Codebase Integrity — 0 broken imports, 0 dead JS/JSX files, PrintTable & worktree locks", () => {
  const allSrcFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else allSrcFiles.push(full);
    }
  };
  walk(SRC_DIR);

  const codeFiles = allSrcFiles.filter(
    (f) => /\.(js|jsx)$/.test(f) && !/\.test\.(js|jsx|mjs)$/.test(f)
  );

  const resolveImport = (fromFile, spec) => {
    const base = path.resolve(path.dirname(fromFile), spec);
    const candidates = [
      base,
      `${base}.js`,
      `${base}.jsx`,
      `${base}.json`,
      `${base}.css`,
      path.join(base, "index.js"),
      path.join(base, "index.jsx"),
    ];
    return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || null;
  };

  const importRegex =
    /(?:import\s+(?:[^"']*?\s+from\s+)?|export\s+[^"']*?\s+from\s+|import\s*\(\s*)["'](\.[^"']+)["']/g;

  const brokenImports = [];
  const adjacency = new Map();

  for (const file of codeFiles) {
    const src = fs.readFileSync(file, "utf8");
    const deps = [];
    let match;
    while ((match = importRegex.exec(src)) !== null) {
      const spec = match[1];
      const resolved = resolveImport(file, spec);
      if (!resolved) {
        brokenImports.push(`${path.relative(ROOT_DIR, file)} -> ${spec}`);
      } else {
        deps.push(resolved);
      }
    }
    adjacency.set(file, deps);
  }

  assert.deepEqual(brokenImports, [], `Broken imports detected: ${brokenImports.join(", ")}`);

  // Reachability traversal from index.js
  const entryFile = path.join(SRC_DIR, "index.js");
  const visited = new Set();
  const queue = [entryFile];
  while (queue.length > 0) {
    const curr = queue.shift();
    if (visited.has(curr)) continue;
    visited.add(curr);
    for (const next of adjacency.get(curr) || []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  const unreachableCodeFiles = codeFiles
    .filter((f) => !visited.has(f))
    .map((f) => path.relative(ROOT_DIR, f));

  assert.deepEqual(
    unreachableCodeFiles,
    [],
    `Unreachable dead JS/JSX files remaining in src/: ${unreachableCodeFiles.join(", ")}`
  );

  // Verify PrintTable.jsx is untouched
  const printTableDiff = execSync("git diff -- src/printForms/PrintTable.jsx", {
    cwd: ROOT_DIR,
    encoding: "utf8",
  }).trim();
  assert.equal(printTableDiff, "", "src/printForms/PrintTable.jsx must never be modified!");
});

test("9. Pipeline-wide contest_results_list deduplication & sourcemap hygiene", () => {
  const allSrcFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(entry.name)) allSrcFiles.push(full);
    }
  };
  walk(SRC_DIR);

  const rawAdminAllowlist = new Set([
    "ContestResultManager.jsx",
    "ContestSearchAndDelete.jsx",
    "RecoveryScoresHub.jsx",
    "ScoreResultManager.jsx",
    "Stage3FinalPlayersHub.jsx",
    "contestResultsUtils.js",
  ]);

  const unguardedConsumers = [];
  for (const file of allSrcFiles) {
    const base = path.basename(file);
    if (rawAdminAllowlist.has(base)) continue;
    const text = fs.readFileSync(file, "utf8");
    if (text.includes('"contest_results_list"') || text.includes("'contest_results_list'")) {
      if (
        !text.includes("dedupeContestResultsByGrade") &&
        !text.includes("saveGradeResultsAtomically")
      ) {
        unguardedConsumers.push(path.relative(ROOT_DIR, file));
      }
    }
  }
  assert.deepEqual(
    unguardedConsumers,
    [],
    `Found contest_results_list consumers without deduplication/atomic save: ${unguardedConsumers.join(", ")}`
  );

  // Verify production build has zero .js.map sourcemap leaks
  const buildAssetsDir = path.join(ROOT_DIR, "build", "assets");
  if (fs.existsSync(buildAssetsDir)) {
    const mapFiles = fs
      .readdirSync(buildAssetsDir)
      .filter((name) => name.endsWith(".map"));
    assert.deepEqual(mapFiles, [], `Public sourcemap files found in build/assets: ${mapFiles.join(", ")}`);
  }
});

test("10. Live Intercom screen-dedicated station binding & channel isolation", () => {
  // 1) Screen-dedicated station resolution (no manual role switching, inactive on admin/LED routes)
  assert.equal(resolveDedicatedStationRole("/contestmonitoring/main"), "HQ");
  assert.equal(resolveDedicatedStationRole("/audio-center"), "HQ");
  assert.equal(resolveDedicatedStationRole("/contestmonitoring/judgeHead"), "HEAD_JUDGE");
  assert.equal(resolveDedicatedStationRole("/contestranksummary"), "HEAD_JUDGE");
  assert.equal(resolveDedicatedStationRole("/mc"), "MC");
  assert.equal(resolveDedicatedStationRole("/contestmonitoring/MC"), "MC");
  assert.equal(resolveDedicatedStationRole("/contestmonitoring/all", "HEAD_JUDGE"), "HEAD_JUDGE");
  assert.equal(resolveDedicatedStationRole("/contestmonitoring/all", "MC"), "MC");
  assert.equal(resolveDedicatedStationRole("/contest-setup"), null);
  assert.equal(resolveDedicatedStationRole("/stage-live"), null);
  assert.equal(resolveDedicatedStationRole("/print/base"), null);

  // 2) Recipient restrictions: MC cannot target judges; HQ & HEAD_JUDGE can target individual seats
  const mcTargets = getAllowedTargetsForStation("MC");
  assert.equal(mcTargets.allowIndividualJudges, false);
  assert.deepEqual(
    mcTargets.groupTargets.map((t) => t.key),
    ["HQ", "HEAD_JUDGE"]
  );
  assert.equal(sanitizeStationTargetScope("MC", "JUDGE_3"), "HQ");
  assert.equal(sanitizeStationTargetScope("MC", "ALL_JUDGES"), "HQ");
  assert.equal(sanitizeStationTargetScope("MC", "HEAD_JUDGE"), "HEAD_JUDGE");
  assert.equal(sanitizeStationTargetScope("HEAD_JUDGE", "JUDGE_5"), "JUDGE_5");

  // 3) Feed & Tally isolation: MC never sees or gets alerted by judge-only traffic
  const judgeUrgentPacket = {
    id: "pkt_1",
    fromRole: "HEAD_JUDGE",
    toScope: "ALL_JUDGES",
    priority: "urgent",
    text: "미제출 좌석 채점 마무리 부탁드립니다.",
  };
  assert.equal(isPacketVisibleToStation(judgeUrgentPacket, "MC", false), false);
  assert.equal(shouldAlertStation(judgeUrgentPacket, "MC", "inst_mc"), false);
  assert.equal(isPacketVisibleToStation(judgeUrgentPacket, "HEAD_JUDGE", false), true);
  assert.equal(isPacketVisibleToStation(judgeUrgentPacket, "HQ", false), false);
  assert.equal(isPacketVisibleToStation(judgeUrgentPacket, "HQ", true), true); // HQ control-tower watch mode
});

test("11. Live stage RTDB player snapshot — additive schema, V1 fallback & emergency override", () => {
  const stage = {
    stageId: "st_10",
    stageNumber: 10,
    categoryId: "cat_phys",
    categoryTitle: "맨즈 피지크",
    grades: [{ gradeId: "g_175", gradeTitle: "-175cm" }],
  };
  const firestorePlayers = [
    { playerUid: "p1", playerNumber: 21, playerIndex: 1, playerName: "김일번", contestGradeId: "g_175", playerNoShow: false },
    { playerUid: "p2", playerNumber: 22, playerIndex: 2, playerName: "박이번", contestGradeId: "g_175", playerNoShow: true },
  ];

  // 1) Normal stage start snapshot excludes NoShow and contains zero undefined values
  const snap = buildLiveStageRealtimeSnapshot({
    targetStage: stage,
    playersPool: firestorePlayers,
  });
  assert.equal(snap.hasLiveStageSnapshot, true);
  assert.equal(snap.stagePlayerCount, 1);
  assert.equal(snap.stageGrades[0].playerCount, 1);
  assert.equal(snap.stagePlayers[0].playerNumber, 21);
  assert.equal(
    snap.stagePlayers.every((p) =>
      Object.values(p).every((v) => v !== undefined)
    ),
    true
  );

  // 2) Emergency override pushes late arrival (22) + walk-in (99)
  const overrideSnap = buildLiveStageRealtimeSnapshot({
    targetStage: stage,
    customStagePlayers: [
      { playerUid: "p1", playerNumber: 21, playerName: "김일번", contestGradeId: "g_175" },
      { playerUid: "p2", playerNumber: 22, playerName: "박이번", contestGradeId: "g_175", isLiveOverride: true },
      { playerNumber: "99", playerName: "현장투입", contestGradeId: "g_175", isLiveOverride: true },
    ],
    pushIdPrefix: "liveoverride",
  });
  assert.equal(overrideSnap.stagePlayerCount, 3);
  const resolvedFromLive = resolveEffectiveStagePlayers({
    realtimeData: { stageId: "st_10", ...overrideSnap },
    fallbackPlayers: firestorePlayers,
    gradeIds: "g_175",
    stageInfo: stage,
  });
  assert.deepEqual(
    resolvedFromLive.map((p) => p.playerNumber),
    [21, 22, 99]
  );

  // 3) V1 backward compatibility: when hasLiveStageSnapshot is absent, falls back to Firestore pool
  const resolvedFromV1 = resolveEffectiveStagePlayers({
    realtimeData: { stageId: "st_10", gradeId: "g_175" },
    fallbackPlayers: firestorePlayers,
    gradeIds: "g_175",
    stageInfo: stage,
  });
  assert.deepEqual(
    resolvedFromV1.map((p) => p.playerNumber),
    [21]
  );
});

test("12. Tie-Break Re-Callout (동점자 전용 재비교심사) — exact rank window & non-tied locked rank preservation", () => {
  // Case A: 2-way tie at 1st place (#2 & #3 -> 1, 2위 선택; #4=3위, #5=4위, #1/#6=순위제외)
  const firstPlaceTieResult = [
    { playerNumber: 1, playerUid: "u1", playerIndex: 1, totalScore: 5000, playerRank: 1000, score: [{ isMissing: false }] },
    { playerNumber: 2, playerUid: "u2", playerIndex: 2, playerName: "문영준", totalScore: 10, playerRank: 1, score: [{ isMissing: false }] },
    { playerNumber: 3, playerUid: "u3", playerIndex: 3, playerName: "신민석", totalScore: 10, playerRank: 1, score: [{ isMissing: false }] },
    { playerNumber: 4, playerUid: "u4", playerIndex: 4, playerName: "박시우", totalScore: 12, playerRank: 3, score: [{ isMissing: false }] },
    { playerNumber: 5, playerUid: "u5", playerIndex: 5, playerName: "전민준", totalScore: 19, playerRank: 4, score: [{ isMissing: false }] },
    { playerNumber: 6, playerUid: "u6", playerIndex: 6, totalScore: 5000, playerRank: 1000, score: [{ isMissing: false }] },
  ];

  const groupsA = extractTieBreakGroupsFromResult(firstPlaceTieResult, "g_open");
  assert.equal(groupsA.length, 1);
  assert.equal(groupsA[0].startRank, 1);
  assert.equal(groupsA[0].endRank, 2);
  assert.deepEqual(groupsA[0].rankRange, [1, 2]);
  assert.deepEqual(
    groupsA[0].tiedPlayers.map((p) => p.playerNumber),
    [2, 3]
  );
  assert.deepEqual(
    groupsA[0].lockedPlayers.map((lp) => [lp.playerNumber, lp.lockedRank]),
    [
      [1, 1000],
      [4, 3],
      [5, 4],
      [6, 1000],
    ]
  );

  // Case B: 2-way tie at 2nd place (#1=1위, #2&#3=2위 동점 -> 2, 3위만 선택, #4=4위)
  const secondPlaceTieResult = [
    { playerNumber: 1, playerUid: "u1", playerIndex: 1, totalScore: 5, playerRank: 1, score: [{ isMissing: false }] },
    { playerNumber: 2, playerUid: "u2", playerIndex: 2, totalScore: 12, playerRank: 2, score: [{ isMissing: false }] },
    { playerNumber: 3, playerUid: "u3", playerIndex: 3, totalScore: 12, playerRank: 2, score: [{ isMissing: false }] },
    { playerNumber: 4, playerUid: "u4", playerIndex: 4, totalScore: 20, playerRank: 4, score: [{ isMissing: false }] },
  ];

  const groupsB = extractTieBreakGroupsFromResult(secondPlaceTieResult, "g_open");
  assert.equal(groupsB.length, 1);
  assert.equal(groupsB[0].startRank, 2);
  assert.equal(groupsB[0].endRank, 3);
  assert.deepEqual(groupsB[0].rankRange, [2, 3]);

  // Simulate 7 judges submitting tie-break ranks [2, 3] while lockedPlayers keep [1] and [4]
  const judgeChoicesFor2 = [2, 2, 2, 2, 3, 2, 3]; // trimmed: [2, 2, 2, 2, 3] => sum = 11
  const judgeChoicesFor3 = [3, 3, 3, 3, 2, 3, 2]; // trimmed: [2, 3, 3, 3, 3] => sum = 14
  const make7JudgeGroup = (scores) =>
    assignMinMaxAndCalculateRankTotal({
      score: scores.map((val, idx) => ({ seatIndex: idx + 1, playerScore: val })),
    });

  const postP1 = make7JudgeGroup([1, 1, 1, 1, 1, 1, 1]);
  const postP2 = make7JudgeGroup(judgeChoicesFor2);
  const postP3 = make7JudgeGroup(judgeChoicesFor3);
  const postP4 = make7JudgeGroup([4, 4, 4, 4, 4, 4, 4]);

  assert.equal(postP1.totalScore, 5);
  assert.equal(postP2.totalScore, 11);
  assert.equal(postP3.totalScore, 14);
  assert.equal(postP4.totalScore, 20);
  assert.ok(
    postP1.totalScore < postP2.totalScore &&
      postP2.totalScore < postP3.totalScore &&
      postP3.totalScore < postP4.totalScore
  );

  // Case C: Missing judge score blocks tie-break extraction & cancel restores tieBreak metadata cleanly
  const incompleteResult = [
    { playerNumber: 2, totalScore: 8, playerRank: 1, score: [{ isMissing: true }] },
    { playerNumber: 3, totalScore: 8, playerRank: 1, score: [{ isMissing: false }] },
  ];
  assert.deepEqual(extractTieBreakGroupsFromResult(incompleteResult, "g_open"), []);

  const restored = buildRealtimeCompareAfterCancel([
    {
      stageId: "st_1",
      gradeId: "g_open",
      gradeTitle: "오픈",
      compareIndex: 2,
      comparePlayerLength: 2,
      compareScoreMode: "tieBreak",
      tieBreakStartRank: 2,
      tieBreakEndRank: 3,
      players: groupsB[0].tiedPlayers,
      lockedPlayers: groupsB[0].lockedPlayers,
    },
  ]);
  assert.equal(restored.scoreMode, "tieBreak");
  assert.equal(restored.tieBreakStartRank, 2);
  assert.equal(restored.tieBreakEndRank, 3);
  assert.equal(restored.status.isTieBreak, true);
  assert.equal(restored.lockedPlayers.length, 2);
});

test("13. Emergency live judge seat swap (single stage, 1:1 seat exchange, and section-remaining batch)", () => {
  const categories = [
    {
      contestCategoryId: "cat_1",
      contestCategoryTitle: "남자 학생부 보디빌딩",
      contestCategorySection: "1부",
      contestCategoryJudgeCount: 5,
    },
    {
      contestCategoryId: "cat_2",
      contestCategoryTitle: "남자 마스터즈 보디빌딩",
      contestCategorySection: "1부",
      contestCategoryJudgeCount: 5,
    },
    {
      contestCategoryId: "cat_3",
      contestCategoryTitle: "남자 피지크",
      contestCategorySection: "2부",
      contestCategoryJudgeCount: 5,
    },
  ];
  const grades = [
    { contestGradeId: "g_1", contestGradeTitle: "오픈", refCategoryId: "cat_1", contestGradeIndex: 0 },
    { contestGradeId: "g_2", contestGradeTitle: "-60세", refCategoryId: "cat_2", contestGradeIndex: 0 },
    { contestGradeId: "g_3", contestGradeTitle: "-175cm", refCategoryId: "cat_3", contestGradeIndex: 0 },
  ];
  const stages = [
    {
      stageId: "st_1",
      stageNumber: 1,
      categoryId: "cat_1",
      categoryTitle: "남자 학생부 보디빌딩",
      categorySection: "1부",
      categoryJudgeCount: 5,
      grades: [{ gradeId: "g_1", gradeTitle: "오픈" }],
    },
    {
      stageId: "st_2",
      stageNumber: 2,
      categoryId: "cat_2",
      categoryTitle: "남자 마스터즈 보디빌딩",
      categorySection: "1부",
      categoryJudgeCount: 5,
      grades: [{ gradeId: "g_2", gradeTitle: "-60세" }],
    },
    {
      stageId: "st_3",
      stageNumber: 3,
      categoryId: "cat_3",
      categoryTitle: "남자 피지크",
      categorySection: "2부",
      categoryJudgeCount: 5,
      grades: [{ gradeId: "g_3", gradeTitle: "-175cm" }],
    },
  ];

  const initialJudgesAssign = [
    { contestGradeId: "g_1", categoryId: "cat_1", seatIndex: 3, judgeUid: "j_old", judgeName: "이선화", onedayPassword: "0986" },
    { contestGradeId: "g_1", categoryId: "cat_1", seatIndex: 5, judgeUid: "j_five", judgeName: "유중기", onedayPassword: "5596" },
    { contestGradeId: "g_2", categoryId: "cat_2", seatIndex: 3, judgeUid: "j_old", judgeName: "이선화", onedayPassword: "0986" },
    { contestGradeId: "g_3", categoryId: "cat_3", seatIndex: 3, judgeUid: "j_old", judgeName: "이선화", onedayPassword: "0986" },
  ];

  const realtimeJudges = [
    { seatIndex: 1, judgeUid: "j_1", judgeName: "여철영", onedayPassword: "4268", isLogined: true, isEnd: false },
    { seatIndex: 2, judgeUid: "j_2", judgeName: "김재효", onedayPassword: "8384", isLogined: true, isEnd: false },
    { seatIndex: 3, judgeUid: "j_old", judgeName: "이선화", onedayPassword: "0986", isLogined: true, isEnd: true },
    { seatIndex: 4, judgeUid: "j_4", judgeName: "이환희", onedayPassword: "9881", isLogined: false, isEnd: false },
    { seatIndex: 5, judgeUid: "j_five", judgeName: "유중기", onedayPassword: "5596", isLogined: true, isEnd: false },
  ];

  // Case A: Single-stage replacement with standby judge
  const singleSwap = applyEmergencyJudgeSeatSwap({
    judges: initialJudgesAssign,
    categories,
    grades,
    stages,
    currentStage: stages[0],
    seatIndex: 3,
    replacementJudge: { judgeUid: "j_new", judgeName: "박철수", onedayPassword: "4821", isHead: false },
    scope: "current_stage",
    swapMode: "replace",
    currentRealtimeJudges: realtimeJudges,
    contestId: "contest_1",
    timestamp: 1700000001234,
  });

  assert.equal(singleSwap.affectedStagesCount, 1);
  assert.deepEqual(singleSwap.affectedSeats, [3]);
  assert.equal(singleSwap.nextRealtimeJudges[2].judgeUid, "j_new");
  assert.equal(singleSwap.nextRealtimeJudges[2].judgeName, "박철수");
  assert.equal(singleSwap.nextRealtimeJudges[2].onedayPassword, "4821");
  assert.equal(singleSwap.nextRealtimeJudges[2].isLogined, false);
  assert.equal(singleSwap.nextRealtimeJudges[2].isEnd, false);
  assert.equal(singleSwap.nextRealtimeJudges[2].judgeSwappedAt, 1700000001234);

  const g1Seat3 = singleSwap.nextJudgesAssign.find((r) => r.contestGradeId === "g_1" && r.seatIndex === 3);
  const g2Seat3 = singleSwap.nextJudgesAssign.find((r) => r.contestGradeId === "g_2" && r.seatIndex === 3);
  assert.equal(g1Seat3.judgeUid, "j_new");
  assert.equal(g2Seat3.judgeUid, "j_old", "Stage 2 must stay untouched in current_stage scope");

  // Case B: 1:1 Seat Exchange between Seat 3 (이선화) and Seat 5 (유중기)
  const exchangeSwap = applyEmergencyJudgeSeatSwap({
    judges: initialJudgesAssign,
    categories,
    grades,
    stages,
    currentStage: stages[0],
    seatIndex: 3,
    replacementJudge: { judgeUid: "j_five", judgeName: "유중기", onedayPassword: "5596", isHead: false },
    scope: "current_stage",
    swapMode: "exchange",
    partnerSeatIndex: 5,
    currentRealtimeJudges: realtimeJudges,
    contestId: "contest_1",
    timestamp: 1700000005678,
  });

  assert.equal(exchangeSwap.isSeatExchange, true);
  assert.deepEqual(exchangeSwap.affectedSeats, [3, 5]);
  assert.equal(exchangeSwap.nextRealtimeJudges[2].judgeUid, "j_five");
  assert.equal(exchangeSwap.nextRealtimeJudges[4].judgeUid, "j_old");
  assert.equal(exchangeSwap.nextRealtimeJudges[4].isLogined, false);

  // Case C: Section-remaining batch swap updates Stage 1 & Stage 2 (both in '1부'), leaves Stage 3 ('2부') untouched
  const sectionSwap = applyEmergencyJudgeSeatSwap({
    judges: initialJudgesAssign,
    categories,
    grades,
    stages,
    currentStage: stages[0],
    seatIndex: 3,
    replacementJudge: { judgeUid: "j_new", judgeName: "박철수", onedayPassword: "4821", isHead: false },
    scope: "section_remaining",
    swapMode: "replace",
    currentRealtimeJudges: realtimeJudges,
    contestId: "contest_1",
    timestamp: 1700000009999,
  });

  assert.equal(sectionSwap.affectedStagesCount, 2);
  assert.equal(
    sectionSwap.nextJudgesAssign.find((r) => r.contestGradeId === "g_1" && r.seatIndex === 3).judgeUid,
    "j_new"
  );
  assert.equal(
    sectionSwap.nextJudgesAssign.find((r) => r.contestGradeId === "g_2" && r.seatIndex === 3).judgeUid,
    "j_new"
  );
  assert.equal(
    sectionSwap.nextJudgesAssign.find((r) => r.contestGradeId === "g_3" && r.seatIndex === 3).judgeUid,
    "j_old"
  );
});

test("14. Layer-isolated direct player edit & forward-only inheritance (Zero Retroactive Overwrite)", () => {
  const baseAssignPlayers = [
    {
      playerUid: "u_101",
      playerNumber: 10,
      playerIndex: 10,
      playerName: "홍길동",
      playerGym: "A짐",
      contestCategoryId: "cat_bb",
      contestCategoryTitle: "남자 일반부 보디빌딩",
      contestGradeId: "gr_70",
      contestGradeTitle: "-70kg",
    },
    {
      playerUid: "u_102",
      playerNumber: 11,
      playerIndex: 11,
      playerName: "김철수",
      playerGym: "B짐",
      contestCategoryId: "cat_bb",
      contestCategoryTitle: "남자 일반부 보디빌딩",
      contestGradeId: "gr_70",
      contestGradeTitle: "-70kg",
    },
  ];

  // 1) Stage ① direct edit updates Stage ① (contest_players_assign) ONLY
  const editedAssignPlayers = applyStage1AssignDirectEdit(
    baseAssignPlayers,
    baseAssignPlayers[0],
    { playerNumber: 15, playerName: "홍길동(수정1)", playerGym: "슈퍼짐" },
    "2026-11-14T07:00:00.000Z"
  );
  assert.equal(editedAssignPlayers[0].playerNumber, 15);
  assert.equal(editedAssignPlayers[0].playerName, "홍길동(수정1)");
  assert.equal(editedAssignPlayers[0].playerGym, "슈퍼짐");
  assert.equal(editedAssignPlayers[1].playerName, "김철수");

  // 2) Stage ② NOT yet saved -> inherits Stage ①'s edited values automatically
  const hydratedBeforeL2Save = hydrateWeighInLayerPlayers({
    assignPlayers: editedAssignPlayers,
    finalDocData: null,
  });
  assert.equal(hydratedBeforeL2Save[0].playerNumber, 15);
  assert.equal(hydratedBeforeL2Save[0].playerName, "홍길동(수정1)");
  assert.equal(hydratedBeforeL2Save[0].playerGym, "슈퍼짐");

  // 3) Stage ② saves weigh-in & edits player 102 -> then Stage ① is edited AGAIN retroactively.
  //    Stage ② MUST preserve its own saved weighInPlayers and NEVER be overwritten by Stage ①!
  const savedWeighInPlayers = hydratedBeforeL2Save.map((p) =>
    p.playerUid === "u_102"
      ? {
          ...p,
          playerGym: "2단계확정짐",
          heightWeight: "178 / 69.4",
          isWeighedIn: true,
        }
      : { ...p, heightWeight: "175 / 68.1", isWeighedIn: true }
  );

  const retroEditedAssign = applyStage1AssignDirectEdit(
    editedAssignPlayers,
    editedAssignPlayers[0],
    { playerNumber: 99, playerName: "뒤늦은1단계수정", playerGym: "과거짐" },
    "2026-11-14T08:00:00.000Z"
  );

  const hydratedAfterL2Save = hydrateWeighInLayerPlayers({
    assignPlayers: retroEditedAssign,
    finalDocData: {
      weighInPlayers: savedWeighInPlayers,
      players: savedWeighInPlayers,
    },
  });
  assert.equal(hydratedAfterL2Save[0].playerNumber, 15);
  assert.equal(hydratedAfterL2Save[0].playerName, "홍길동(수정1)");
  assert.equal(hydratedAfterL2Save[1].playerGym, "2단계확정짐");

  // 4) Stage ③ direct edit marks entry with layer3Edited: true (plus a Grand Prix entry).
  //    Subsequent Stage ② edits forward to UNEDITED Stage ③ rows, while NEVER overwriting layer3Edited or GP rows!
  const initialStage3Players = [
    ...savedWeighInPlayers,
    {
      playerUid: "u_101",
      playerNumber: 15,
      playerIndex: 1,
      grandPrixIndex: 1,
      playerName: "홍길동(그랑프리전용표기)",
      playerGym: "슈퍼짐",
      contestCategoryId: "cat_gp",
      contestCategoryTitle: "남자 보디빌딩 그랑프리",
      contestCategorySection: "그랑프리",
      contestGradeId: "gr_gp",
      contestGradeTitle: "그랑프리",
      originalGradeId: "gr_70",
      originalGradeTitle: "-70kg",
      gpLayerSaved: true,
      layer3Edited: true,
    },
  ];

  // Operator directly edits u_101 in Stage ③ regular list
  const stage3AfterDirectEdit = applyStage3FinalDirectEdit(
    initialStage3Players,
    initialStage3Players[0],
    { playerGym: "3단계최종수정짐", playerNumber: 15 },
    { isGrandPrix: false, nowIso: "2026-11-14T08:30:00.000Z" }
  );
  assert.equal(stage3AfterDirectEdit[0].playerGym, "3단계최종수정짐");
  assert.equal(stage3AfterDirectEdit[0].layer3Edited, true);
  // Grand Prix entry of u_101 remains untouched!
  assert.equal(stage3AfterDirectEdit[2].playerName, "홍길동(그랑프리전용표기)");
  assert.equal(stage3AfterDirectEdit[2].playerGym, "슈퍼짐");

  // Now operator goes back to Stage ② and edits BOTH u_101 and u_102:
  // - u_101 WAS directly edited in Stage ③ (`layer3Edited: true`) -> Stage ③ keeps "3단계최종수정짐"
  // - u_102 was NOT edited in Stage ③ -> Stage ③ inherits Stage ②'s new gym "2단계재수정짐"
  // - GP entry of u_101 -> untouched
  const nextWeighInAfterL2Edit = savedWeighInPlayers.map((p) =>
    p.playerUid === "u_101"
      ? { ...p, playerGym: "2단계에서바꾼짐(전파차단대상)" }
      : { ...p, playerGym: "2단계재수정짐(3단계승계대상)" }
  );

  const forwardedStage3 = forwardWeighInToFinalPlayers({
    nextWeighInPlayers: nextWeighInAfterL2Edit,
    existingFinalPlayers: stage3AfterDirectEdit,
  });

  const u101Regular = forwardedStage3.find(
    (p) => p.playerUid === "u_101" && p.contestCategoryId === "cat_bb"
  );
  const u102Regular = forwardedStage3.find(
    (p) => p.playerUid === "u_102" && p.contestCategoryId === "cat_bb"
  );
  const u101Gp = forwardedStage3.find(
    (p) => p.playerUid === "u_101" && p.contestCategoryId === "cat_gp"
  );

  assert.equal(u101Regular.playerGym, "3단계최종수정짐");
  assert.equal(u102Regular.playerGym, "2단계재수정짐(3단계승계대상)");
  assert.equal(u101Gp.playerName, "홍길동(그랑프리전용표기)");
  assert.equal(u101Gp.playerGym, "슈퍼짐");
});
