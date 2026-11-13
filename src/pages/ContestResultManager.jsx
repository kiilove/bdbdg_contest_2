"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { FileSpreadsheet, RefreshCw, Trash2 } from "lucide-react";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { exportContestResultsToExcel } from "../functions/functions";
import BibTag from "../components/ui/BibTag";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import ConfirmModalTrigger from "../components/ui/ConfirmModalTrigger";

const ContestResultManager = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const contestId = currentContest?.contests?.id;

  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState([]);
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});

  const openNotice = (nextMsg) => {
    setModalMessage(nextMsg);
    setMsgOpen(true);
  };

  const fetchDocs = async () => {
    if (!contestId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "contest_results_list"),
        where("contestId", "==", contestId)
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => {
        const c = (a.categoryTitle || "").localeCompare(b.categoryTitle || "");
        if (c !== 0) return c;
        return (a.gradeTitle || "").localeCompare(b.gradeTitle || "");
      });
      setDocs(rows);
    } catch (e) {
      console.error(e);
      openNotice({
        variant: "error",
        title: "결과 데이터 조회 실패",
        body: "최종 집계 결과를 불러오는 중 오류가 발생했습니다.",
        body4: e?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteOne = async (docId) => {
    try {
      await deleteDoc(doc(db, "contest_results_list", docId));
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      openNotice({
        variant: "success",
        title: "집계 문서 삭제 완료",
        body: "선택한 결과 문서가 삭제되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
    } catch (e) {
      console.error(e);
      openNotice({
        variant: "error",
        title: "문서 삭제 실패",
        body: "결과 문서를 삭제하는 중 오류가 발생했습니다.",
        body4: e?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  const deleteGradeGroup = async (cat, grd) => {
    const targets = grouped[cat][grd] || [];
    try {
      await Promise.all(
        targets.map((d) => deleteDoc(doc(db, "contest_results_list", d.id)))
      );
      setDocs((prev) =>
        prev.filter((d) => !(d.categoryTitle === cat && d.gradeTitle === grd))
      );
      openNotice({
        variant: "success",
        title: "체급 결과 삭제 완료",
        body: `'${cat} / ${grd}' 체급의 집계 결과가 삭제되었습니다.`,
        isButton: true,
        confirmButtonText: "확인",
      });
    } catch (e) {
      console.error(e);
      openNotice({
        variant: "error",
        title: "체급 결과 삭제 실패",
        body: "체급 결과를 삭제하는 중 오류가 발생했습니다.",
        body4: e?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  const deleteAllInContest = async () => {
    try {
      await Promise.all(
        docs.map((d) => deleteDoc(doc(db, "contest_results_list", d.id)))
      );
      setDocs([]);
      openNotice({
        variant: "success",
        title: "전체 결과 삭제 완료",
        body: "현재 대회의 모든 집계 결과 문서가 삭제되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
    } catch (e) {
      console.error(e);
      openNotice({
        variant: "error",
        title: "전체 삭제 실패",
        body: "전체 결과를 삭제하는 중 오류가 발생했습니다.",
        body4: e?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  const grouped = useMemo(() => {
    const o = {};
    for (const d of docs) {
      const cat = d.categoryTitle || "기타 종목";
      const grd = d.gradeTitle || "기타 체급";
      if (!o[cat]) o[cat] = {};
      if (!o[cat][grd]) o[cat][grd] = [];
      o[cat][grd].push(d);
    }
    return o;
  }, [docs]);

  useEffect(() => {
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    if (docs.length === 0) {
      openNotice({
        variant: "warning",
        title: "다운로드할 결과 없음",
        body: "확정된 최종 집계 결과 데이터가 없습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
      return;
    }
    try {
      setIsExporting(true);
      const contestTitle =
        currentContest?.contestInfo?.contestTitle ||
        currentContest?.contests?.contestTitle ||
        "제2회 DMZ한반도평화통일기원보디빌딩대회";

      await exportContestResultsToExcel(contestTitle, docs);
      openNotice({
        variant: "success",
        title: "엑셀 다운로드 완료",
        body: "최종 순위표 엑셀 파일 다운로드가 완료되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
    } catch (e) {
      console.error(e);
      openNotice({
        variant: "error",
        title: "엑셀 다운로드 실패",
        body: "엑셀 파일을 생성하는 중 오류가 발생했습니다.",
        body4: e?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />
      <div className="max-w-[1440px] mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              최종 집계 결과 관리
            </h1>
            <p className="text-[13px] text-[#737373] mt-1 font-mono tabular-nums">
              <span className="font-sans">대회 ID</span> {contestId || "-"} ·{" "}
              <span className="font-sans">집계 문서</span> {docs.length}
              <span className="font-sans">건</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={fetchDocs}
              disabled={loading}
              className="h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <RefreshCw
                size={15}
                strokeWidth={1.5}
                className={`text-[#525252] ${loading ? "animate-spin" : ""}`}
              />
              <span>새로고침</span>
            </button>

            <ConfirmModalTrigger
              variant="danger"
              title="전체 집계 결과 삭제"
              body="현재 대회에 저장된 모든 종목·체급의 최종 순위 결과를 삭제합니다."
              body2="삭제된 확정 결과 문서는 복구할 수 없습니다. 전체 삭제를 진행할까요?"
              confirmText="전체 삭제"
              cancelText="취소"
              onConfirm={deleteAllInContest}
              disabled={docs.length === 0}
            >
              <button
                type="button"
                disabled={docs.length === 0}
                className="h-9 px-3.5 rounded-[8px] bg-white hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/25 disabled:opacity-40 text-[#dc2626] text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150 cursor-pointer"
              >
                <Trash2 size={15} strokeWidth={1.5} />
                <span>전체 삭제</span>
              </button>
            </ConfirmModalTrigger>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={docs.length === 0 || isExporting}
              className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#f4f4f5] disabled:text-[#737373] disabled:border disabled:border-[#171717]/[0.08] text-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <FileSpreadsheet size={16} strokeWidth={1.5} />
              <span>{isExporting ? "내보내는 중" : "엑셀 다운로드"}</span>
            </button>
          </div>
        </header>

        {loading ? (
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-12 text-center text-[13px] text-[#737373]">
            최종 집계 결과를 불러오는 중입니다
          </div>
        ) : docs.length === 0 ? (
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-12 text-center text-[13px] text-[#737373]">
            이 대회에 저장된 최종 결과가 없습니다
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(grouped).map((cat) => (
              <section
                key={cat}
                className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-6"
              >
                <div className="border-b border-[#171717]/[0.08] pb-3 flex items-center justify-between">
                  <h2 className="text-[16px] font-medium text-[#171717]">
                    {cat}
                  </h2>
                  <span className="text-[12px] font-mono tabular-nums text-[#737373]">
                    {Object.keys(grouped[cat]).length}체급
                  </span>
                </div>

                <div className="space-y-6">
                  {Object.keys(grouped[cat]).map((grd) => (
                    <div key={grd} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] text-[12px] font-medium">
                            체급
                          </span>
                          <h3 className="text-[14px] font-medium text-[#171717]">
                            {grd}
                          </h3>
                        </div>

                        <ConfirmModalTrigger
                          variant="danger"
                          title="체급 결과 삭제"
                          body={`'${cat} / ${grd}' 체급에 저장된 확정 결과를 모두 삭제하시겠습니까?`}
                          body2="삭제된 결과 문서는 복구할 수 없습니다."
                          confirmText="체급 결과 삭제"
                          cancelText="취소"
                          onConfirm={() => deleteGradeGroup(cat, grd)}
                        >
                          <button
                            type="button"
                            className="h-8 px-3 rounded-[6px] bg-white hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/25 text-[#dc2626] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
                          >
                            <Trash2 size={13} strokeWidth={1.5} />
                            <span>체급 결과 삭제</span>
                          </button>
                        </ConfirmModalTrigger>
                      </div>

                      <div className="space-y-4">
                        {grouped[cat][grd].map((docu) => {
                          const { id, result = [], scoreType } = docu;
                          const isPointType = scoreType === "point";
                          const maxSeat =
                            result?.[0]?.score?.reduce(
                              (m, s) => Math.max(m, s.seatIndex || 0),
                              0
                            ) || 0;

                          return (
                            <div
                              key={id}
                              className="rounded-[8px] border border-[#171717]/[0.08] overflow-hidden"
                            >
                              <div className="bg-[#f4f4f5] px-4 py-2.5 border-b border-[#171717]/[0.08] flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[12px] text-[#737373]">
                                  문서 ID{" "}
                                  <code className="font-mono text-[#525252] ml-1">
                                    {id}
                                  </code>
                                </span>
                                <ConfirmModalTrigger
                                  variant="danger"
                                  title="결과 문서 삭제"
                                  body="선택한 확정 결과 문서를 삭제하시겠습니까?"
                                  body4={`문서 ID: ${id}`}
                                  confirmText="문서 삭제"
                                  cancelText="취소"
                                  onConfirm={() => deleteOne(id)}
                                >
                                  <button
                                    type="button"
                                    className="h-7 px-2.5 rounded-[6px] text-[#dc2626] hover:bg-[#dc2626]/[0.08] text-[12px] font-medium inline-flex items-center gap-1 transition-colors duration-150 cursor-pointer"
                                  >
                                    <Trash2 size={13} strokeWidth={1.5} />
                                    <span>문서 삭제</span>
                                  </button>
                                </ConfirmModalTrigger>
                              </div>

                              <div className="overflow-x-auto bg-white">
                                <table className="w-full text-left text-[13px] border-collapse">
                                  <thead>
                                    <tr className="bg-[#fafafa] text-[#525252] border-b border-[#171717]/[0.08] h-10 text-[12px]">
                                      <th className="px-3 text-center font-medium w-16">
                                        순위
                                      </th>
                                      <th className="px-3 text-center font-medium w-24">
                                        선수번호
                                      </th>
                                      <th className="px-3 font-medium">이름</th>
                                      <th className="px-3 font-medium">소속</th>
                                      <th className="px-3 text-center font-medium w-20">
                                        총점
                                      </th>
                                      {Array.from(
                                        { length: maxSeat },
                                        (_, i) => i + 1
                                      ).map((seat) => (
                                        <th
                                          key={seat}
                                          className="px-2.5 text-center font-mono tabular-nums font-medium"
                                        >
                                          {seat}번
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#171717]/[0.06]">
                                    {result
                                      .slice()
                                      .sort(
                                        (a, b) =>
                                          (a.playerRank || 9999) -
                                          (b.playerRank || 9999)
                                      )
                                      .map((row, idx) => (
                                        <tr
                                          key={idx}
                                          className="hover:bg-[#f4f4f5]/50 transition-colors duration-150"
                                        >
                                          <td className="px-3 py-2.5 text-center font-mono font-semibold tabular-nums">
                                            <span
                                              className={
                                                row.playerRank === 1
                                                  ? "text-[#2563eb]"
                                                  : "text-[#171717]"
                                              }
                                            >
                                              {row.playerRank ?? "-"}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2.5 text-center">
                                            <BibTag
                                              number={row.playerNumber}
                                              prefix="#"
                                              size="sm"
                                              variant={
                                                row.playerRank === 1
                                                  ? "active"
                                                  : "default"
                                              }
                                            />
                                          </td>
                                          <td className="px-3 py-2.5 font-medium text-[#171717]">
                                            {row.playerName ?? "-"}
                                          </td>
                                          <td className="px-3 py-2.5 text-[#525252]">
                                            {row.playerGym ?? "-"}
                                          </td>
                                          <td className="px-3 py-2.5 text-center font-mono font-semibold tabular-nums text-[#171717]">
                                            {row.totalScore ?? "-"}
                                          </td>
                                          {Array.from(
                                            { length: maxSeat },
                                            (_, i) => i + 1
                                          ).map((seat) => {
                                            const s = (row.score || []).find(
                                              (x) => x.seatIndex === seat
                                            );
                                            if (!s) {
                                              return (
                                                <td
                                                  key={seat}
                                                  className="px-2.5 py-2.5 text-center font-mono text-[#737373]"
                                                >
                                                  -
                                                </td>
                                              );
                                            }
                                            return (
                                              <td
                                                key={seat}
                                                className="px-2.5 py-2 text-center"
                                              >
                                                <div className="font-mono tabular-nums text-[#171717]">
                                                  {s.playerScore}
                                                </div>
                                                {(s.isMin || s.isMax) && (
                                                  <div className="mt-1 flex gap-1 justify-center">
                                                    {(() => {
                                                      const isHighest = isPointType
                                                        ? s.isMax
                                                        : s.isMin;
                                                      return isHighest ? (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] font-mono text-[10px] font-medium bg-[#2563eb]/[0.08] text-[#2563eb]">
                                                          최고제외
                                                        </span>
                                                      ) : (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] font-mono text-[10px] font-medium bg-[#dc2626]/[0.08] text-[#dc2626]">
                                                          최저제외
                                                        </span>
                                                      );
                                                    })()}
                                                  </div>
                                                )}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContestResultManager;
