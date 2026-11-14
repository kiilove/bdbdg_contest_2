import React, { useEffect, useState, useContext, useRef, useMemo } from "react";
import {
  collection,
  getDocs,
  doc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { FileCheck2, RefreshCw, Trash2, UserX, ClipboardX } from "lucide-react";
import { db, database } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import BibTag from "../components/ui/BibTag";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import {
  deleteContestResultDocumentById,
  extractResultDocTimestamp,
  formatResultDocTimestamp,
} from "../utils/contestResultsUtils";

const isCollectionSeedDoc = (item) => {
  if (!item) return true;
  if (item.isCollectionSeed === true) return true;
  return (
    !item.gradeId &&
    !item.categoryTitle &&
    !item.gradeTitle &&
    item.playerNumber === undefined &&
    item.playerScore === undefined &&
    item.seatIndex === undefined
  );
};

const ScoreResultManager = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const contestId = currentContest?.contests?.id || currentContest?.id || "";
  const effectiveCollectionName =
    currentContest?.contests?.collectionName ||
    currentContest?.contestInfo?.contestCollectionName ||
    currentContest?.contests?.contestCollectionName ||
    "";

  const [scores, setScores] = useState([]);
  const [resultDocs, setResultDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});
  const confirmActionRef = useRef(null);

  const openNotice = (config, onConfirm = null) => {
    confirmActionRef.current = onConfirm;
    setModalMessage({ isButton: true, confirmButtonText: "확인", ...config });
    setModalOpen(true);
  };

  const fetchAll = async () => {
    if (!effectiveCollectionName && !contestId) return;
    setLoading(true);
    try {
      const tasks = [];

      if (effectiveCollectionName) {
        tasks.push(
          getDocs(collection(db, effectiveCollectionName)).then((snapshot) =>
            snapshot.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((item) => !isCollectionSeedDoc(item))
          )
        );
      } else {
        tasks.push(Promise.resolve([]));
      }

      if (contestId) {
        tasks.push(
          getDocs(
            query(
              collection(db, "contest_results_list"),
              where("contestId", "==", contestId)
            )
          ).then((snap) => {
            const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            rows.sort((a, b) => {
              const catCmp = (a.categoryTitle || "").localeCompare(
                b.categoryTitle || ""
              );
              if (catCmp !== 0) return catCmp;
              const grdCmp = (a.gradeTitle || "").localeCompare(
                b.gradeTitle || ""
              );
              if (grdCmp !== 0) return grdCmp;
              return extractResultDocTimestamp(b) - extractResultDocTimestamp(a);
            });
            return rows;
          })
        );
      } else {
        tasks.push(Promise.resolve([]));
      }

      const [rawScoreRows, confirmedResultRows] = await Promise.all(tasks);
      setScores(rawScoreRows);
      setResultDocs(confirmedResultRows);
    } catch (err) {
      console.error("채점 결과 불러오기 실패:", err);
      openNotice({
        variant: "error",
        title: "채점 데이터 조회 실패",
        body: "채점 결과 및 채점표 문서를 불러오는 중 오류가 발생했습니다.",
        body4: err?.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteRawDocsByExactIds = async (targetItems = []) => {
    if (!effectiveCollectionName) {
      throw new Error("대회 원시 채점 컬렉션명을 확인할 수 없습니다.");
    }
    const exactIds = Array.from(
      new Set(
        (targetItems || [])
          .filter((item) => item && !isCollectionSeedDoc(item))
          .map((item) => String(item.id || "").trim())
          .filter(Boolean)
      )
    );
    if (exactIds.length === 0) return [];

    const CHUNK_SIZE = 400;
    for (let i = 0; i < exactIds.length; i += CHUNK_SIZE) {
      const chunk = exactIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((exactId) => {
        batch.delete(doc(db, effectiveCollectionName, exactId));
      });
      await batch.commit();
    }

    const deletedSet = new Set(exactIds);
    setScores((prev) => prev.filter((item) => !deletedSet.has(item.id)));
    return exactIds;
  };

  const handleDeleteSingleRaw = (target) => {
    if (!target?.id || busyDelete) return;
    openNotice(
      {
        variant: "danger",
        title: "심판 채점 원표 단건 삭제",
        body: "선택한 심판 채점 원표 문서 1건만 삭제하시겠습니까?",
        body2: `#${target.playerNumber ?? "-"} ${target.playerName || ""} · ${
          target.seatIndex ?? "-"
        }번 ${target.judgeName || "심판"} (${target.playerScore ?? "-"}점)`,
        body4: `컬렉션: ${effectiveCollectionName} | 문서 ID: ${target.id}`,
        isCancelButton: true,
        confirmButtonText: "삭제",
        cancelButtonText: "취소",
      },
      async () => {
        setModalOpen(false);
        setBusyDelete(true);
        try {
          await deleteRawDocsByExactIds([target]);
          openNotice({
            variant: "success",
            title: "삭제 완료",
            body: "선택한 채점 원표 문서 1건이 정확히 삭제되었습니다.",
          });
        } catch (err) {
          console.error("단건 삭제 중 오류:", err);
          openNotice({
            variant: "error",
            title: "삭제 오류",
            body: "채점 원표 삭제 중 오류가 발생했습니다.",
            body4: err?.message,
          });
        } finally {
          setBusyDelete(false);
        }
      }
    );
  };

  const handleDeletePlayerRaw = ({
    catTitle,
    gradeTitle,
    playerNumber,
    playerName,
    items = [],
  }) => {
    if (!items.length || busyDelete) return;
    const exactIds = items.map((x) => x.id).filter(Boolean);
    openNotice(
      {
        variant: "danger",
        title: "선수 채점 데이터 일괄 삭제",
        body: `'${catTitle} · ${gradeTitle}' 체급의 #${playerNumber} ${
          playerName || "-"
        } 선수 채점 데이터를 모두 삭제하시겠습니까?`,
        body2: `해당 선수의 심판 기표 문서 ${exactIds.length}건만 정확히 삭제되며, 다른 선수 및 다른 체급 데이터는 유지됩니다.`,
        body4: `컬렉션: ${effectiveCollectionName} | 삭제 대상 ${exactIds.length}건`,
        isCancelButton: true,
        confirmButtonText: `선수 데이터 ${exactIds.length}건 삭제`,
        cancelButtonText: "취소",
      },
      async () => {
        setModalOpen(false);
        setBusyDelete(true);
        try {
          const deleted = await deleteRawDocsByExactIds(items);
          openNotice({
            variant: "success",
            title: "선수 데이터 삭제 완료",
            body: `#${playerNumber} ${playerName || "-"} 선수의 채점 데이터 ${
              deleted.length
            }건이 일괄 삭제되었습니다.`,
          });
        } catch (err) {
          console.error("선수 일괄 삭제 오류:", err);
          openNotice({
            variant: "error",
            title: "선수 데이터 삭제 실패",
            body: "선수 채점 데이터를 삭제하는 중 오류가 발생했습니다.",
            body4: err?.message,
          });
        } finally {
          setBusyDelete(false);
        }
      }
    );
  };

  const handleDeleteSeatScorecard = ({
    catTitle,
    gradeTitle,
    seatIndex,
    judgeName,
    items = [],
  }) => {
    if (!items.length || busyDelete) return;
    const exactIds = items.map((x) => x.id).filter(Boolean);
    const seatLabel = seatIndex !== undefined && seatIndex !== null && seatIndex !== ""
      ? `${seatIndex}번`
      : "미지정 좌석";
    openNotice(
      {
        variant: "danger",
        title: "심판 제출 채점표 삭제",
        body: `'${catTitle} · ${gradeTitle}' 체급에서 ${seatLabel} ${
          judgeName || "심판"
        }이 제출한 채점표(${exactIds.length}건)만 삭제하시겠습니까?`,
        body2: "해당 심판석이 이 체급에 기표한 원시 문서들만 정확히 삭제되며, 다른 심판석의 채점표는 그대로 보존됩니다.",
        body4: `컬렉션: ${effectiveCollectionName} | 삭제 대상 문서 ${exactIds.length}건 (${exactIds
          .slice(0, 3)
          .join(", ")}${exactIds.length > 3 ? " 외" : ""})`,
        isCancelButton: true,
        confirmButtonText: `${seatLabel} 채점표 삭제`,
        cancelButtonText: "취소",
      },
      async () => {
        setModalOpen(false);
        setBusyDelete(true);
        try {
          const deleted = await deleteRawDocsByExactIds(items);
          openNotice({
            variant: "success",
            title: "심판 채점표 삭제 완료",
            body: `'${catTitle} · ${gradeTitle}' 체급의 ${seatLabel} ${
              judgeName || "심판"
            } 채점표(${deleted.length}건)가 삭제되었습니다.`,
          });
        } catch (err) {
          console.error("심판 채점표 삭제 오류:", err);
          openNotice({
            variant: "error",
            title: "채점표 삭제 실패",
            body: "심판 채점표를 삭제하는 중 오류가 발생했습니다.",
            body4: err?.message,
          });
        } finally {
          setBusyDelete(false);
        }
      }
    );
  };

  const handleDeleteGradeRaw = ({
    catTitle,
    gradeTitle,
    gradeId,
    playerCount,
    items = [],
  }) => {
    if (!items.length || busyDelete) return;
    const exactIds = items.map((x) => x.id).filter(Boolean);
    openNotice(
      {
        variant: "danger",
        title: "체급 채점 데이터 전체 삭제",
        body: `'${catTitle} · ${gradeTitle}' 체급의 원시 채점 데이터를 모두 삭제하시겠습니까?`,
        body2: `총 ${playerCount}명 선수에 대한 심판 기표 문서 ${exactIds.length}건만 정확히 삭제됩니다. 다른 체급 데이터와 컬렉션 기본 시드 문서는 안전하게 유지됩니다.`,
        body4: `컬렉션: ${effectiveCollectionName}${
          gradeId ? ` | gradeId: ${gradeId}` : ""
        } | 삭제 대상 ${exactIds.length}건`,
        isCancelButton: true,
        confirmButtonText: `체급 데이터 ${exactIds.length}건 삭제`,
        cancelButtonText: "취소",
      },
      async () => {
        setModalOpen(false);
        setBusyDelete(true);
        try {
          const deleted = await deleteRawDocsByExactIds(items);
          openNotice({
            variant: "success",
            title: "체급 데이터 삭제 완료",
            body: `'${catTitle} · ${gradeTitle}' 체급의 원시 채점 데이터 ${deleted.length}건이 모두 삭제되었습니다.`,
          });
        } catch (err) {
          console.error("체급 일괄 삭제 오류:", err);
          openNotice({
            variant: "error",
            title: "체급 데이터 삭제 실패",
            body: "체급 채점 데이터를 삭제하는 중 오류가 발생했습니다.",
            body4: err?.message,
          });
        } finally {
          setBusyDelete(false);
        }
      }
    );
  };

  const handleDeleteResultSheetDoc = (docu) => {
    if (!docu?.id || busyDelete) return;
    const exactDocId = String(docu.id).trim();
    const catLabel = docu.categoryTitle || "미지정 종목";
    const grdLabel = docu.gradeTitle || "미지정 체급";
    const playerLen = Array.isArray(docu.result) ? docu.result.length : 0;

    openNotice(
      {
        variant: "danger",
        title: "확정 채점표(집계표) 문서 단건 삭제",
        body: "선택한 확정 채점표(순위 집계표) 문서 1건만 정확히 삭제하시겠습니까?",
        body2: `'${catLabel} · ${grdLabel}' (${playerLen}명 집계) — 지정된 문서 ID 1건만 삭제되며, 다른 문서 및 심판 원시 기표 데이터는 건드리지 않습니다.`,
        body4: `컬렉션: contest_results_list | 문서 ID: ${exactDocId}`,
        isCancelButton: true,
        confirmButtonText: "이 문서만 정확히 삭제",
        cancelButtonText: "취소",
      },
      async () => {
        setModalOpen(false);
        setBusyDelete(true);
        try {
          await deleteContestResultDocumentById({
            db,
            database,
            docId: exactDocId,
            contestId: docu.contestId || contestId,
            gradeId: docu.gradeId || "",
          });
          setResultDocs((prev) => prev.filter((item) => item.id !== exactDocId));
          openNotice({
            variant: "success",
            title: "채점표 문서 삭제 완료",
            body: "선택한 채점표(집계표) 문서가 정확히 삭제되었습니다.",
            body4: `삭제된 문서 ID: ${exactDocId}`,
          });
        } catch (err) {
          console.error("확정 채점표 문서 삭제 실패:", err);
          openNotice({
            variant: "error",
            title: "채점표 문서 삭제 실패",
            body: "채점표 문서를 삭제하는 중 오류가 발생했습니다.",
            body4: err?.message,
          });
        } finally {
          setBusyDelete(false);
        }
      }
    );
  };

  const categoriesHierarchy = useMemo(() => {
    const catMap = new Map();

    scores.forEach((item) => {
      const catTitle = item.categoryTitle || "기타";
      const catKey = item.categoryId
        ? `${item.categoryId}::${catTitle}`
        : `title::${catTitle}`;
      if (!catMap.has(catKey)) {
        catMap.set(catKey, {
          catKey,
          categoryId: item.categoryId || "",
          categoryTitle: catTitle,
          gradesMap: new Map(),
        });
      }
      const catEntry = catMap.get(catKey);

      const gradeTitle = item.gradeTitle || "기타";
      const gradeKey = item.gradeId
        ? `gid::${item.gradeId}`
        : `gtitle::${catTitle}::${gradeTitle}`;
      if (!catEntry.gradesMap.has(gradeKey)) {
        catEntry.gradesMap.set(gradeKey, {
          gradeKey,
          gradeId: item.gradeId || "",
          gradeTitle,
          items: [],
          playersMap: new Map(),
          seatsMap: new Map(),
        });
      }
      const gradeEntry = catEntry.gradesMap.get(gradeKey);
      gradeEntry.items.push(item);

      const pNum = item.playerNumber ?? 0;
      const pName = item.playerName || "";
      const playerKey = item.playerUid
        ? `uid::${item.playerUid}`
        : `num::${pNum}::${pName}`;
      if (!gradeEntry.playersMap.has(playerKey)) {
        gradeEntry.playersMap.set(playerKey, {
          playerKey,
          playerNumber: pNum,
          playerName: pName,
          items: [],
        });
      }
      gradeEntry.playersMap.get(playerKey).items.push(item);

      const seatIdx = item.seatIndex ?? "-";
      const seatKey =
        item.seatIndex !== undefined && item.seatIndex !== null
          ? `seat::${item.seatIndex}`
          : `judge::${item.judgeUid || item.judgeName || "unknown"}`;
      if (!gradeEntry.seatsMap.has(seatKey)) {
        gradeEntry.seatsMap.set(seatKey, {
          seatKey,
          seatIndex: seatIdx,
          judgeName: item.judgeName || "",
          judgeUid: item.judgeUid || "",
          items: [],
        });
      }
      const seatEntry = gradeEntry.seatsMap.get(seatKey);
      if (!seatEntry.judgeName && item.judgeName) {
        seatEntry.judgeName = item.judgeName;
      }
      seatEntry.items.push(item);
    });

    return Array.from(catMap.values())
      .sort((a, b) => a.categoryTitle.localeCompare(b.categoryTitle))
      .map((cat) => {
        const grades = Array.from(cat.gradesMap.values())
          .sort((a, b) => a.gradeTitle.localeCompare(b.gradeTitle))
          .map((grd) => {
            const players = Array.from(grd.playersMap.values())
              .sort((a, b) => {
                const numDiff =
                  (Number(a.playerNumber) || 0) - (Number(b.playerNumber) || 0);
                if (numDiff !== 0) return numDiff;
                return (a.playerName || "").localeCompare(b.playerName || "");
              })
              .map((pl) => ({
                ...pl,
                items: pl.items
                  .slice()
                  .sort((a, b) => (a.seatIndex || 0) - (b.seatIndex || 0)),
              }));

            const seats = Array.from(grd.seatsMap.values())
              .sort(
                (a, b) =>
                  (Number(a.seatIndex) || 999) - (Number(b.seatIndex) || 999)
              )
              .map((st) => ({
                ...st,
                items: st.items
                  .slice()
                  .sort(
                    (a, b) =>
                      (Number(a.playerNumber) || 0) -
                      (Number(b.playerNumber) || 0)
                  ),
              }));

            return {
              gradeKey: grd.gradeKey,
              gradeId: grd.gradeId,
              gradeTitle: grd.gradeTitle,
              items: grd.items,
              players,
              seats,
            };
          });

        return {
          catKey: cat.catKey,
          categoryId: cat.categoryId,
          categoryTitle: cat.categoryTitle,
          grades,
        };
      });
  }, [scores]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCollectionName, contestId]);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <ConfirmationModal
        isOpen={modalOpen}
        message={modalMessage}
        onCancel={() => {
          confirmActionRef.current = null;
          setModalOpen(false);
        }}
        onConfirm={() => {
          const fn = confirmActionRef.current;
          confirmActionRef.current = null;
          if (fn) {
            fn();
          } else {
            setModalOpen(false);
          }
        }}
      />
      <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              채점 결과 관리
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              {currentContest?.contestInfo?.contestTitle || "선택된 대회 없음"} ·
              종목·체급·선수·심판별 채점 원표와 확정 채점표 문서를 정확히 선택해 정리합니다
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[12px] font-mono tabular-nums text-[#737373]">
              원시 기표 {scores.length}건 · 확정 채점표 {resultDocs.length}건
            </span>
            <button
              type="button"
              onClick={fetchAll}
              disabled={loading || busyDelete}
              className="h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                strokeWidth={1.5}
                className={`text-[#525252] ${loading ? "animate-spin" : ""}`}
              />
              <span>새로고침</span>
            </button>
          </div>
        </header>

        {/* 확정 채점표 · 순위 집계표 문서 단건 정밀 삭제 섹션 (contest_results_list) */}
        {!loading && resultDocs.length > 0 && (
          <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#171717]/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-[8px] bg-[#eff6ff] border border-[#2563eb]/15 text-[#2563eb] inline-flex items-center justify-center shrink-0">
                  <FileCheck2 size={16} strokeWidth={1.7} />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-[#171717]">
                    저장된 확정 채점표 · 집계표 문서
                  </h2>
                  <p className="text-[12px] text-[#737373]">
                    컬렉션 <code className="font-mono text-[#525252]">contest_results_list</code> · 테스트로 저장된 채점표가 있다면 문서 ID를 확인하고 해당 문서 1건만 정확히 삭제할 수 있습니다
                  </p>
                </div>
              </div>
              <span className="text-[12px] font-mono tabular-nums text-[#525252]">
                총 {resultDocs.length}개 문서
              </span>
            </div>

            <div className="divide-y divide-[#171717]/[0.06] rounded-[8px] border border-[#171717]/[0.08] overflow-hidden">
              {resultDocs.map((docu) => {
                const savedTime = formatResultDocTimestamp(docu);
                const playerCount = Array.isArray(docu.result)
                  ? docu.result.length
                  : 0;
                const seatCount =
                  docu.result?.[0]?.score?.length || 0;

                return (
                  <div
                    key={docu.id}
                    className="px-4 py-3 bg-white hover:bg-[#fafafa] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 transition-colors duration-150"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] text-[11px] font-medium">
                          채점표 문서
                        </span>
                        <span className="text-[13px] font-semibold text-[#171717]">
                          {docu.categoryTitle || "미지정 종목"} ·{" "}
                          {docu.gradeTitle || "미지정 체급"}
                        </span>
                        <span className="text-[12px] text-[#737373] font-mono tabular-nums">
                          ({playerCount}명{seatCount ? ` · ${seatCount}심` : ""})
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#737373]">
                        <span>
                          문서 ID:{" "}
                          <code className="font-mono text-[#171717] bg-[#f4f4f5] px-1.5 py-0.5 rounded">
                            {docu.id}
                          </code>
                        </span>
                        {docu.gradeId && (
                          <span>
                            체급 ID:{" "}
                            <code className="font-mono text-[#525252]">
                              {docu.gradeId}
                            </code>
                          </span>
                        )}
                        {savedTime && <span>저장 시각: {savedTime}</span>}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyDelete}
                        onClick={() => handleDeleteResultSheetDoc(docu)}
                        className="h-8 px-3 rounded-[6px] bg-white hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/30 text-[#dc2626] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <Trash2 size={13} strokeWidth={1.6} />
                        <span>이 채점표 문서만 삭제</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {loading ? (
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-12 text-center text-[13px] text-[#737373]">
            채점 결과를 불러오는 중입니다
          </div>
        ) : scores.length === 0 ? (
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-12 text-center text-[13px] text-[#737373]">
            저장된 원시 채점 결과가 없습니다
          </div>
        ) : (
          <div className="space-y-6">
            {categoriesHierarchy.map((cat) => (
              <section
                key={cat.catKey}
                className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-6"
              >
                <div className="border-b border-[#171717]/[0.08] pb-3 flex items-center justify-between gap-2">
                  <h2 className="text-[16px] font-medium text-[#171717]">
                    {cat.categoryTitle}
                  </h2>
                  <span className="text-[12px] font-mono tabular-nums text-[#737373]">
                    {cat.grades.length}체급
                  </span>
                </div>

                <div className="space-y-6">
                  {cat.grades.map((grd) => {
                    const matchedResultDocs = resultDocs.filter((r) =>
                      grd.gradeId && r.gradeId
                        ? r.gradeId === grd.gradeId
                        : r.categoryTitle === cat.categoryTitle &&
                          r.gradeTitle === grd.gradeTitle
                    );

                    return (
                      <div
                        key={grd.gradeKey}
                        className="space-y-3.5 rounded-[10px] border border-[#171717]/[0.07] bg-[#fafafa]/60 p-4"
                      >
                        {/* 체급 헤더 + 체급 데이터 일괄 삭제 버튼 */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#171717]/[0.06]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] text-[12px] font-medium">
                              체급
                            </span>
                            <h3 className="text-[14px] font-semibold text-[#171717]">
                              {grd.gradeTitle}
                            </h3>
                            <span className="text-[12px] font-mono tabular-nums text-[#737373]">
                              선수 {grd.players.length}명 · 원표 {grd.items.length}건
                            </span>
                            {grd.gradeId && (
                              <code className="text-[11px] font-mono text-[#737373] bg-white border border-[#171717]/[0.08] px-1.5 py-0.5 rounded">
                                {grd.gradeId}
                              </code>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {matchedResultDocs.map((mDoc) => (
                              <button
                                key={mDoc.id}
                                type="button"
                                disabled={busyDelete}
                                onClick={() => handleDeleteResultSheetDoc(mDoc)}
                                title={`contest_results_list 문서 ID: ${mDoc.id}`}
                                className="h-8 px-2.5 rounded-[6px] bg-white hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/25 text-[#dc2626] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              >
                                <FileCheck2 size={13} strokeWidth={1.6} />
                                <span>확정 채점표 문서 삭제</span>
                              </button>
                            ))}

                            <button
                              type="button"
                              disabled={busyDelete}
                              onClick={() =>
                                handleDeleteGradeRaw({
                                  catTitle: cat.categoryTitle,
                                  gradeTitle: grd.gradeTitle,
                                  gradeId: grd.gradeId,
                                  playerCount: grd.players.length,
                                  items: grd.items,
                                })
                              }
                              className="h-8 px-3 rounded-[6px] bg-white hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/30 text-[#dc2626] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                              <Trash2 size={13} strokeWidth={1.6} />
                              <span>체급 데이터 전체 삭제 ({grd.items.length}건)</span>
                            </button>
                          </div>
                        </div>

                        {/* 심판석별 제출 채점표 개별 삭제 바 */}
                        {grd.seats.length > 0 && (
                          <div className="bg-white rounded-[8px] border border-[#171717]/[0.08] px-3.5 py-2.5 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#525252] mr-1">
                              <ClipboardX size={13.5} className="text-[#737373]" />
                              <span>심판별 제출 채점표 삭제:</span>
                            </span>
                            {grd.seats.map((seat) => (
                              <button
                                key={seat.seatKey}
                                type="button"
                                disabled={busyDelete}
                                onClick={() =>
                                  handleDeleteSeatScorecard({
                                    catTitle: cat.categoryTitle,
                                    gradeTitle: grd.gradeTitle,
                                    seatIndex: seat.seatIndex,
                                    judgeName: seat.judgeName,
                                    items: seat.items,
                                  })
                                }
                                className="h-7 px-2.5 rounded-[6px] bg-[#fafafa] hover:bg-[#dc2626]/[0.08] border border-[#171717]/[0.10] hover:border-[#dc2626]/30 text-[#171717] hover:text-[#dc2626] text-[12px] inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              >
                                <span className="font-mono font-semibold tabular-nums">
                                  {seat.seatIndex}번
                                </span>
                                <span>{seat.judgeName || "심판"}</span>
                                <span className="text-[11px] font-mono text-[#737373]">
                                  ({seat.items.length}건)
                                </span>
                                <Trash2
                                  size={12}
                                  strokeWidth={1.6}
                                  className="text-[#dc2626]"
                                />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* 선수별 카드 목록 */}
                        <div className="space-y-3">
                          {grd.players.map((player) => (
                            <div
                              key={player.playerKey}
                              className="rounded-[8px] border border-[#171717]/[0.08] overflow-hidden bg-white"
                            >
                              <div className="bg-[#f4f4f5] px-3.5 py-2 border-b border-[#171717]/[0.08] flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <BibTag
                                    number={player.playerNumber}
                                    prefix="#"
                                    size="sm"
                                  />
                                  <span className="text-[13px] font-medium text-[#171717]">
                                    {player.playerName || "-"}
                                  </span>
                                  <span className="text-[11.5px] font-mono tabular-nums text-[#737373]">
                                    ({player.items.length}건)
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  disabled={busyDelete}
                                  onClick={() =>
                                    handleDeletePlayerRaw({
                                      catTitle: cat.categoryTitle,
                                      gradeTitle: grd.gradeTitle,
                                      playerNumber: player.playerNumber,
                                      playerName: player.playerName,
                                      items: player.items,
                                    })
                                  }
                                  className="h-7 px-2.5 rounded-[6px] bg-white hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/25 text-[#dc2626] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                >
                                  <UserX size={13} strokeWidth={1.6} />
                                  <span>
                                    이 선수 데이터 삭제 ({player.items.length}건)
                                  </span>
                                </button>
                              </div>

                              <div className="overflow-x-auto bg-white">
                                <table className="w-full text-left text-[13px] border-collapse">
                                  <thead>
                                    <tr className="bg-[#fafafa] text-[#737373] border-b border-[#171717]/[0.06] h-9 text-[12px]">
                                      <th className="px-3 font-medium">대회명</th>
                                      <th className="px-3 font-medium">종목</th>
                                      <th className="px-3 font-medium">체급</th>
                                      <th className="px-3 font-medium text-center w-24">
                                        선수번호
                                      </th>
                                      <th className="px-3 font-medium">선수명</th>
                                      <th className="px-3 font-medium text-center w-20">
                                        좌석
                                      </th>
                                      <th className="px-3 font-medium">심판명</th>
                                      <th className="px-3 font-medium text-right w-24">
                                        점수
                                      </th>
                                      <th className="px-3 font-medium w-36">
                                        문서 ID
                                      </th>
                                      <th className="px-3 font-medium text-center w-16">
                                        관리
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#171717]/[0.06]">
                                    {player.items.map((score) => (
                                      <tr
                                        key={score.id}
                                        className="hover:bg-[#f4f4f5]/50 transition-colors duration-150"
                                      >
                                        <td className="px-3 py-2 text-[#525252]">
                                          {currentContest?.contestInfo
                                            ?.contestTitle || "-"}
                                        </td>
                                        <td className="px-3 py-2 text-[#525252]">
                                          {score.categoryTitle}
                                        </td>
                                        <td className="px-3 py-2 text-[#525252]">
                                          {score.gradeTitle}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <BibTag
                                            number={score.playerNumber}
                                            size="sm"
                                          />
                                        </td>
                                        <td className="px-3 py-2 font-medium text-[#171717]">
                                          {score.playerName}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <BibTag
                                            number={score.seatIndex ?? "-"}
                                            size="sm"
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-[#525252]">
                                          {score.judgeName || "-"}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono font-medium tabular-nums text-[#171717]">
                                          {score.playerScore}
                                        </td>
                                        <td
                                          className="px-3 py-2 font-mono text-[11px] text-[#737373] max-w-[140px] truncate"
                                          title={score.id}
                                        >
                                          {score.id}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <button
                                            type="button"
                                            disabled={busyDelete}
                                            onClick={() =>
                                              handleDeleteSingleRaw(score)
                                            }
                                            aria-label="채점 삭제"
                                            title={`문서 ID ${score.id} 삭제`}
                                            className="h-8 w-8 rounded-[6px] inline-flex items-center justify-center text-[#dc2626] hover:bg-[#dc2626]/[0.08] transition-colors duration-150 cursor-pointer disabled:opacity-50"
                                          >
                                            <Trash2
                                              size={15}
                                              strokeWidth={1.5}
                                            />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoreResultManager;
