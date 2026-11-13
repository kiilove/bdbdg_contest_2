import React, { useState, useEffect, useMemo, useRef, useContext, useCallback } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";
import { Award, Printer, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Empty } from "antd";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { where } from "firebase/firestore";
import { useDevice } from "../contexts/DeviceContext";

const UNAFFILIATED_PATTERNS = new Set([
  "",
  "-",
  "--",
  "_",
  "무",
  "무소속",
  "없음",
  "소속없음",
  "해당없음",
  "개인",
  "개인출전",
  "미기재",
  "미정",
  "x",
  "none",
  "null",
]);

/** 소속명 정규화: 무소속 변형 통합 + 공백/대소문자 차이 흡수 + 원본 표시명 보존 */
const normalizeGymInfo = (rawGymValue) => {
  const displayTrimmed = String(rawGymValue ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const compactKey = displayTrimmed.replace(/\s+/g, "").toLowerCase();

  // '무소속(개인)' 같은 변형도 무소속으로 통합
  if (
    UNAFFILIATED_PATTERNS.has(compactKey) ||
    compactKey.startsWith("무소속(")
  ) {
    return {
      isUnaffiliated: true,
      gymKey: "__UNAFFILIATED__",
      displayGym: "무소속",
    };
  }

  return {
    isUnaffiliated: false,
    gymKey: compactKey,
    displayGym: displayTrimmed,
  };
};

/** 결과 문서 타임스탬프 추출 (동일 체급 중복 문서 발생 시 최신본 우선 채택용) */
const extractDocTimestamp = (docItem) => {
  const candidates = [
    docItem?.updatedAt,
    docItem?.savedAt,
    docItem?.createdAt,
  ];
  for (const val of candidates) {
    if (!val) continue;
    if (typeof val === "number") return val;
    if (typeof val?.toMillis === "function") return val.toMillis();
    if (typeof val?.seconds === "number") return val.seconds * 1000;
    const parsed = Date.parse(String(val));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
};

const GymGroupPrint = () => {
  const { isTabletOrMobile } = useDevice();
  const { currentContest } = useContext(CurrentContestContext);
  const [isLoading, setIsLoading] = useState(false);
  const [resultArray, setResultArray] = useState([]);
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [finalPlayersArray, setFinalPlayersArray] = useState([]);
  const [includeUnaffiliated, setIncludeUnaffiliated] = useState(true);
  const [includeGrandPrix, setIncludeGrandPrix] = useState(true);
  const [rankingLimit, setRankingLimit] = useState("top5");
  const [expandedGymKey, setExpandedGymKey] = useState(null);

  const printRef = useRef();
  const fetchResults = useFirestoreQuery();
  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchPlayersFinal = useFirestoreGetDocument("contest_players_final");

  const fetchPool = useCallback(async () => {
    const contestInfo = currentContest?.contests;
    const contestId = contestInfo?.id;
    if (!contestId) return;

    const condition = [where("contestId", "==", contestId)];
    setIsLoading(true);
    try {
      const [resultsDocs, catDoc, finalDoc] = await Promise.all([
        fetchResults.getDocuments("contest_results_list", condition),
        contestInfo?.contestCategorysListId
          ? fetchCategories.getDocument(contestInfo.contestCategorysListId)
          : Promise.resolve(null),
        contestInfo?.contestPlayersFinalId
          ? fetchPlayersFinal.getDocument(contestInfo.contestPlayersFinalId)
          : Promise.resolve(null),
      ]);
      setResultArray(resultsDocs || []);
      setCategoriesArray(catDoc?.categorys || []);
      setFinalPlayersArray(finalDoc?.players || []);
    } catch (error) {
      console.error("클럽별 집계 데이터 로드 오류:", error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentContest?.contests?.id,
    currentContest?.contests?.contestCategorysListId,
    currentContest?.contests?.contestPlayersFinalId,
  ]);

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool();
    }
  }, [currentContest?.contests?.id, fetchPool]);

  const { topGroupedData, dedupedGradeCount, duplicateSkippedCount } =
    useMemo(() => {
      // 1. 종목 메타데이터 맵 (그랑프리 섹션 정확 판별용)
      const categoryById = new Map(
        (categoriesArray || []).map((c) => [c?.contestCategoryId, c])
      );

      // 2. 최종 출전 명단 소속 보강 맵 (결과 문서에 playerGym이 비어 있을 때 최신 소속 복원)
      const gymFallbackByGradeAndNum = new Map();
      const gymFallbackByUid = new Map();
      (finalPlayersArray || []).forEach((fp) => {
        if (!fp) return;
        const gymText = String(fp.playerGym ?? "").trim();
        if (!gymText) return;
        if (fp.contestGradeId && fp.playerNumber != null) {
          gymFallbackByGradeAndNum.set(
            `${fp.contestGradeId}__${fp.playerNumber}`,
            gymText
          );
        }
        if (fp.playerUid && !gymFallbackByUid.has(fp.playerUid)) {
          gymFallbackByUid.set(fp.playerUid, gymText);
        }
      });

      // 3. 동일 체급(gradeId) 중복 결과 문서 제거 (최신 문서 1개만 채택하여 이중 집계 원천 방지)
      const latestDocByGradeKey = new Map();
      let skippedDuplicates = 0;

      (resultArray || []).forEach((item) => {
        if (!item) return;
        const gradeKey =
          item.gradeId ||
          `${item.categoryId || item.categoryTitle || ""}__${
            item.gradeTitle || item.id || ""
          }`;
        const existing = latestDocByGradeKey.get(gradeKey);
        if (!existing) {
          latestDocByGradeKey.set(gradeKey, item);
        } else {
          skippedDuplicates += 1;
          if (extractDocTimestamp(item) >= extractDocTimestamp(existing)) {
            latestDocByGradeKey.set(gradeKey, item);
          }
        }
      });

      const uniqueResultDocs = Array.from(latestDocByGradeKey.values());

      // 4. 유효 입상 선수 평탄화 + 체급 내 동일 선수 중복 제거
      const playersFlat = [];
      uniqueResultDocs.forEach((item) => {
        const catMeta = item?.categoryId
          ? categoryById.get(item.categoryId)
          : null;
        const catTitle = String(
          item?.categoryTitle || catMeta?.contestCategoryTitle || ""
        ).trim();
        const gradeTitle = String(item?.gradeTitle || "").trim();
        const catSection = String(
          item?.categorySection || catMeta?.contestCategorySection || ""
        ).trim();

        const isGrandPrixResult =
          catSection === "그랑프리" ||
          catTitle === "그랑프리" ||
          catTitle.includes("그랑프리") ||
          gradeTitle.includes("그랑프리");

        if (!includeGrandPrix && isGrandPrixResult) {
          return;
        }

        const seenInGrade = new Set();
        (item?.result || []).forEach((player) => {
          const rankNum = Number(player?.playerRank);
          if (!Number.isFinite(rankNum) || rankNum < 1 || rankNum >= 1000) {
            return;
          }

          const playerKey = String(
            player?.playerUid ||
              (player?.playerNumber != null
                ? `num:${player.playerNumber}`
                : "") ||
              player?.playerName ||
              ""
          ).trim();
          if (playerKey && seenInGrade.has(playerKey)) {
            return;
          }
          if (playerKey) seenInGrade.add(playerKey);

          const rawResultGym = String(player?.playerGym ?? "").trim();
          const fallbackGym =
            (!rawResultGym &&
              item?.gradeId &&
              player?.playerNumber != null &&
              gymFallbackByGradeAndNum.get(
                `${item.gradeId}__${player.playerNumber}`
              )) ||
            (!rawResultGym &&
              player?.playerUid &&
              gymFallbackByUid.get(player.playerUid)) ||
            "";

          const { isUnaffiliated, gymKey, displayGym } = normalizeGymInfo(
            rawResultGym || fallbackGym
          );

          if (!includeUnaffiliated && isUnaffiliated) {
            return;
          }

          playersFlat.push({
            playerNumber: player?.playerNumber,
            playerName: player?.playerName || "",
            playerRank: rankNum,
            contestCategoryTitle: catTitle,
            contestGradeTitle: gradeTitle,
            isGrandPrixResult,
            isUnaffiliated,
            gymKey,
            displayGym,
          });
        });
      });

      const resolvedMaxRank =
        rankingLimit === "all"
          ? playersFlat.length > 0
            ? Math.max(1, ...playersFlat.map((p) => p.playerRank || 0))
            : 5
          : parseInt(rankingLimit.replace("top", ""), 10);

      // 5. 클럽별 순위 집계 + 가장 많이 쓰인 원본 표기명을 대표 클럽명으로 선택
      const groupedMap = new Map();

      playersFlat.forEach((player) => {
        if (!(player.playerRank >= 1 && player.playerRank <= resolvedMaxRank)) {
          return;
        }

        if (!groupedMap.has(player.gymKey)) {
          const rankBuckets = {};
          for (let r = 1; r <= resolvedMaxRank; r++) {
            rankBuckets[r] = { count: 0, players: [] };
          }
          groupedMap.set(player.gymKey, {
            gymKey: player.gymKey,
            nameCounts: new Map(),
            rankBuckets,
            allPlayers: [],
          });
        }

        const entry = groupedMap.get(player.gymKey);
        entry.nameCounts.set(
          player.displayGym,
          (entry.nameCounts.get(player.displayGym) || 0) + 1
        );
        entry.rankBuckets[player.playerRank].count += 1;
        entry.rankBuckets[player.playerRank].players.push(player);
        entry.allPlayers.push(player);
      });

      const sortedClubs = Array.from(groupedMap.values())
        .map((club) => {
          let bestDisplayName = "무소속";
          let bestCount = -1;
          club.nameCounts.forEach((cnt, name) => {
            if (cnt > bestCount) {
              bestCount = cnt;
              bestDisplayName = name;
            }
          });

          let totalMedals = 0;
          const rankCounts = {};
          for (let r = 1; r <= resolvedMaxRank; r++) {
            const c = club.rankBuckets[r]?.count || 0;
            rankCounts[`rank${r}`] = c;
            totalMedals += c;
          }

          const sortedAwardPlayers = [...club.allPlayers].sort((a, b) => {
            if (a.playerRank !== b.playerRank) {
              return a.playerRank - b.playerRank;
            }
            return String(a.contestCategoryTitle).localeCompare(
              String(b.contestCategoryTitle),
              "ko"
            );
          });

          return {
            gymKey: club.gymKey,
            gymName: bestDisplayName,
            rankCounts,
            totalMedals,
            awardPlayers: sortedAwardPlayers,
          };
        })
        .sort((a, b) => {
          for (let r = 1; r <= resolvedMaxRank; r++) {
            const diff =
              (b.rankCounts[`rank${r}`] || 0) -
              (a.rankCounts[`rank${r}`] || 0);
            if (diff !== 0) return diff;
          }
          return String(a.gymName).localeCompare(String(b.gymName), "ko");
        });

      // 6. 동순위(1위..N위 모든 메달 수가 완전히 동일한 경우 공동 순위) 부여
      let currentRank = 1;
      let prevSignature = null;

      const finalRows = sortedClubs.map((club, index) => {
        const signature = Array.from(
          { length: resolvedMaxRank },
          (_, i) => club.rankCounts[`rank${i + 1}`] || 0
        ).join(",");

        if (prevSignature === null || signature !== prevSignature) {
          currentRank = index + 1;
          prevSignature = signature;
        }

        return {
          gymKey: club.gymKey,
          gymName: club.gymName,
          clubRank: currentRank,
          ...club.rankCounts,
          totalMedals: club.totalMedals,
          awardPlayers: club.awardPlayers,
        };
      });

      return {
        topGroupedData: finalRows,
        dedupedGradeCount: uniqueResultDocs.length,
        duplicateSkippedCount: skippedDuplicates,
      };
    }, [
      resultArray,
      categoriesArray,
      finalPlayersArray,
      includeUnaffiliated,
      includeGrandPrix,
      rankingLimit,
    ]);

  const maxRankForCols = useMemo(() => {
    if (rankingLimit !== "all") {
      return parseInt(rankingLimit.replace("top", ""), 10);
    }
    if (topGroupedData.length === 0) return 5;
    return Math.max(
      1,
      ...topGroupedData.flatMap((row) =>
        Object.keys(row)
          .filter((key) => key.startsWith("rank"))
          .map((key) => parseInt(key.replace("rank", ""), 10) || 0)
      )
    );
  }, [rankingLimit, topGroupedData]);

  const columns = useMemo(() => {
    const rankColTotalWidth = 46;
    const perRankWidth = Number((rankColTotalWidth / maxRankForCols).toFixed(2));

    return [
      { key: "clubRank", label: "순위", width: 10 },
      { key: "gymName", label: "클럽(소속)명", width: 34 },
      ...Array.from({ length: maxRankForCols }, (_, i) => ({
        key: `rank${i + 1}`,
        label: `${i + 1}위`,
        width: perRankWidth,
      })),
      { key: "totalMedals", label: "합계", width: 10 },
    ];
  }, [maxRankForCols]);

  const contestTitle =
    currentContest?.contestInfo?.contestTitle ||
    currentContest?.contests?.contestTitle ||
    "대회";

  const filterConditions = `${
    includeUnaffiliated ? "무소속 포함" : "무소속 제외"
  } · ${includeGrandPrix ? "그랑프리 포함" : "그랑프리 제외"} · ${
    rankingLimit === "all"
      ? "전체 순위"
      : `상위 ${rankingLimit.replace("top", "")}위 기준`
  }`;

  return (
    <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
        {isLoading ? (
          <LoadingPage />
        ) : (
          <>
            <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-5 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#525252] flex items-center justify-center shrink-0">
                  <Award size={16} strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#171717] m-0">
                    클럽별 집계 출력
                  </h1>
                  <p className="text-[12px] text-[#737373] m-0 mt-0.5">
                    소속 클럽별 입상 현황을 자동 검산·집계하여 인쇄합니다. (행 클릭 시 입상 선수 상세 내역 확인)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchPool}
                  className="h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] font-medium text-[13px] inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw size={14} strokeWidth={1.5} className="text-[#525252]" />
                  <span>새로고침</span>
                </button>

                <ReactToPrint
                  trigger={() => (
                    <button
                      type="button"
                      className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-[#ffffff] font-medium text-[13px] inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer border-0 whitespace-nowrap"
                    >
                      <Printer size={15} strokeWidth={1.5} />
                      <span>인쇄하기</span>
                    </button>
                  )}
                  content={() => printRef.current}
                />
              </div>
            </div>

            <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-4 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-[8px] bg-[#f4f4f5]">
                <button
                  type="button"
                  onClick={() => setIncludeUnaffiliated(true)}
                  className={`h-7 px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-150 cursor-pointer ${
                    includeUnaffiliated
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  무소속 포함
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeUnaffiliated(false)}
                  className={`h-7 px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-150 cursor-pointer ${
                    !includeUnaffiliated
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  무소속 제외
                </button>
              </div>

              <div className="inline-flex items-center gap-1 p-1 rounded-[8px] bg-[#f4f4f5]">
                <button
                  type="button"
                  onClick={() => setIncludeGrandPrix(true)}
                  className={`h-7 px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-150 cursor-pointer ${
                    includeGrandPrix
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  그랑프리 포함
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeGrandPrix(false)}
                  className={`h-7 px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-150 cursor-pointer ${
                    !includeGrandPrix
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  그랑프리 제외
                </button>
              </div>

              <div className="inline-flex items-center gap-1 p-1 rounded-[8px] bg-[#f4f4f5]">
                {[
                  { value: "top3", label: "상위 3위" },
                  { value: "top5", label: "상위 5위" },
                  { value: "all", label: "전체 순위" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRankingLimit(opt.value)}
                    className={`h-7 px-3 rounded-[6px] text-[12px] font-medium tabular-nums transition-colors duration-150 cursor-pointer ${
                      rankingLimit === opt.value
                        ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                        : "text-[#525252] hover:text-[#171717]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2 text-[12px] text-[#737373] font-mono tabular-nums">
                <span>확정 {dedupedGradeCount}체급</span>
                {duplicateSkippedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-[4px] bg-[#fffbeb] text-[#b45309] border border-[#d97706]/20 text-[11px] font-sans">
                    중복 결과문서 {duplicateSkippedCount}건 자동제외
                  </span>
                )}
                <span>· 집계 클럽 {topGroupedData.length}곳</span>
              </div>
            </div>

            <div className="flex w-full bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-x-auto p-4 sm:p-6 print:border-0 print:shadow-none print:p-0">
              <div
                ref={printRef}
                className={`w-full h-full flex justify-center items-start bg-white ${
                  isTabletOrMobile ? "p-2" : "p-4"
                }`}
              >
                {topGroupedData.length === 0 ? (
                  <div className="py-12 text-center text-[#737373]">
                    <Empty description="집계할 확정 순위 데이터가 없습니다." />
                  </div>
                ) : (
                  <div className="flex w-full h-full flex-col">
                    <div className="flex w-full flex-col mb-5 py-4 px-4 justify-center items-center bg-[#fafafa] border border-[#171717]/20 rounded-[8px]">
                      <span className="text-[12px] font-medium text-[#525252] mb-0.5">
                        {contestTitle}
                      </span>
                      <span className="text-[18px] font-bold text-[#171717] tracking-tight">
                        클럽(소속)별 입상 집계표
                      </span>
                      <div className="text-[12px] text-[#525252] mt-1 font-medium">
                        {filterConditions}
                      </div>
                    </div>

                    <table
                      className="w-full border-collapse border border-[#171717]/25 text-center"
                      style={{
                        fontSize: "13px",
                        marginBottom: "20px",
                      }}
                    >
                      <thead>
                        <tr className="bg-[#f4f4f5] text-[#171717]">
                          {columns.map((col) => (
                            <th
                              key={col.key}
                              className="border border-[#171717]/25 px-2 py-2 font-semibold whitespace-nowrap"
                              style={{ width: `${col.width}%` }}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {topGroupedData.map((row) => {
                          const isExpanded = expandedGymKey === row.gymKey;
                          return (
                            <React.Fragment key={row.gymKey}>
                              <tr
                                onClick={() =>
                                  setExpandedGymKey((prev) =>
                                    prev === row.gymKey ? null : row.gymKey
                                  )
                                }
                                className="hover:bg-[#fafafa] transition-colors cursor-pointer print:cursor-default"
                                title="클릭하여 입상 선수 상세 내역 확인"
                              >
                                {columns.map((col) => {
                                  if (col.key === "gymName") {
                                    return (
                                      <td
                                        key={col.key}
                                        className="px-3 py-2 border border-[#171717]/20 text-left font-medium text-[#171717]"
                                        style={{ width: `${col.width}%` }}
                                      >
                                        <div className="flex items-center justify-between gap-1.5">
                                          <span>{row.gymName || "-"}</span>
                                          <span className="no-print print:hidden text-[#737373] shrink-0">
                                            {isExpanded ? (
                                              <ChevronUp size={13} strokeWidth={1.5} />
                                            ) : (
                                              <ChevronDown size={13} strokeWidth={1.5} />
                                            )}
                                          </span>
                                        </div>
                                      </td>
                                    );
                                  }

                                  const numVal = row[col.key] ?? 0;
                                  const isRankCol = col.key.startsWith("rank");
                                  const isTotalCol = col.key === "totalMedals";

                                  return (
                                    <td
                                      key={col.key}
                                      className={`px-2 py-2 border border-[#171717]/20 font-mono tabular-nums ${
                                        col.key === "clubRank"
                                          ? "font-semibold text-[#171717]"
                                          : isTotalCol
                                          ? "font-semibold text-[#2563eb] print:text-[#171717] bg-[#fafafa]"
                                          : isRankCol && numVal === 0
                                          ? "text-[#a3a3a3]"
                                          : "font-medium text-[#171717]"
                                      }`}
                                      style={{ width: `${col.width}%` }}
                                    >
                                      {numVal}
                                    </td>
                                  );
                                })}
                              </tr>

                              {isExpanded && (
                                <tr className="no-print print:hidden bg-[#fafafa]">
                                  <td
                                    colSpan={columns.length}
                                    className="px-4 py-3 border border-[#171717]/15 text-left"
                                  >
                                    <div className="text-[11px] font-medium text-[#525252] mb-2">
                                      {row.gymName} 입상 상세 내역 ({row.awardPlayers.length}건 · 인쇄 시 제외됨)
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {row.awardPlayers.map((ap, apIdx) => (
                                        <span
                                          key={`${ap.contestCategoryTitle}_${ap.contestGradeTitle}_${ap.playerNumber}_${apIdx}`}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#ffffff] border border-[#171717]/[0.10] text-[12px] text-[#171717]"
                                        >
                                          <span className="font-semibold text-[#2563eb] font-mono tabular-nums">
                                            {ap.playerRank}위
                                          </span>
                                          <span className="font-medium">
                                            #{ap.playerNumber} {ap.playerName}
                                          </span>
                                          <span className="text-[#737373] text-[11px]">
                                            ({ap.contestCategoryTitle} / {ap.contestGradeTitle})
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GymGroupPrint;
