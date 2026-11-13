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
  assignMinMaxAndCalculatePointTotal,
} from "../src/utils/scoringEngine.js";
import {
  buildContestResultDocId,
  dedupeContestResultsByGrade,
} from "../src/utils/contestResultsUtils.js";
import {
  removeStageCompareByLocalIndex,
  buildRealtimeCompareAfterCancel,
} from "../src/utils/compareVoteUtils.js";
import { buildStageWithSyncedMetadata } from "../src/utils/stageMetadataUtils.js";
import {
  isGrandPrixPlayerEntry,
  getStagePlayerSortIndex,
  syncGrandPrixPlayerIndexForStage,
  matchedGradewWithPlayers,
} from "../src/functions/functions.js";

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

  // 7-judge point with SINGLE 1000 ("순위제외" treated as -1 worst) -> 1000 trimmed as isMin!
  const p7Single1000 = assignMinMaxAndCalculatePointTotal({
    score: mkScores([1000, 80, 85, 85, 90, 90, 95]),
  });
  assert.equal(p7Single1000.totalScore, 430);
  assert.equal(p7Single1000.score[0].isMin, true);
  assert.equal(p7Single1000.score[6].isMax, true);

  // 7-judge point with TWO 1000s -> rank-excluded (>= 1000)
  const p7Double1000 = assignMinMaxAndCalculatePointTotal({
    score: mkScores([1000, 1000, 80, 85, 90, 90, 95]),
  });
  assert.equal(p7Double1000.totalScore >= 1000, true);
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
  assert.equal(syncedStage.categoryJudgeType, "point");
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
