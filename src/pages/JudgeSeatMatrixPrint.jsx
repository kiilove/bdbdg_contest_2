"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";

import { where } from "firebase/firestore";
import ReactToPrint from "react-to-print";

import { Printer, FileSpreadsheet, LayoutGrid } from "lucide-react";
import * as XLSX from "xlsx";

const num = (v, d = 0) => {
  const n = Number.parseInt(String(v).replace(/[^\d.-]/g, ""), 10);
  return Number.isFinite(n) ? n : d;
};

export default function JudgeSeatMatrixPrint() {
  const { currentContest } = useContext(CurrentContestContext);

  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchAssign = useFirestoreGetDocument("contest_judges_assign");
  const fetchPools = useFirestoreQuery();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [grades, setGrades] = useState([]);
  const [judgesAssign, setJudgesAssign] = useState([]);
  const [pools, setPools] = useState([]);

  const printRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      if (!currentContest?.contests?.id) return;

      const contestId = currentContest.contests.id;

      const [assignDoc, catDoc, gradeDoc, poolList] = await Promise.all([
        fetchAssign.getDocument(currentContest.contests.contestJudgesAssignId),
        fetchCategories.getDocument(
          currentContest.contests.contestCategorysListId
        ),
        fetchGrades.getDocument(currentContest.contests.contestGradesListId),
        fetchPools.getDocuments("contest_judges_pool", [
          where("contestId", "==", contestId),
        ]),
      ]);

      setJudgesAssign(assignDoc?.judges ?? []);
      setCategories(catDoc?.categorys ?? []);
      setGrades(gradeDoc?.grades ?? []);
      setPools(poolList ?? []);

      console.group(
        "%c📥 FIRESTORE LOAD RESULT",
        "color:#00aaff;font-weight:700"
      );
      console.log("categories:", catDoc?.categorys);
      console.log("grades:", gradeDoc?.grades);
      console.log("judgesAssign:", assignDoc?.judges);
      console.log("pools:", poolList);
      console.groupEnd();

      setLoading(false);
    };

    load();
  }, [currentContest]);

  const poolMap = useMemo(() => {
    const m = {};
    pools.forEach((p) => (m[p.judgeUid] = p));
    return m;
  }, [pools]);

  const seatCount = useMemo(() => {
    const maxFromCategories = Math.max(
      ...(categories || []).map((c) => num(c?.contestCategoryJudgeCount, 0)),
      0
    );
    if (maxFromCategories > 0) return maxFromCategories;
    const maxSeat = Math.max(
      ...judgesAssign.map((j) => num(j.seatIndex, 0)),
      0
    );
    return maxSeat <= 7 ? 7 : 9;
  }, [categories, judgesAssign]);

  const seatMatrix = useMemo(() => {
    if (!categories || !grades || !judgesAssign) return {};

    const matrix = {};
    const catById = {};
    const grdById = {};

    [...categories]
      .sort((a, b) => num(a.contestCategoryIndex) - num(b.contestCategoryIndex))
      .forEach((cat) => {
        catById[cat.contestCategoryId] = cat;
        matrix[cat.contestCategoryId] = {
          categoryId: cat.contestCategoryId,
          categoryTitle: cat.contestCategoryTitle,
          judgeCount: num(cat.contestCategoryJudgeCount, seatCount),
          grades: {},
        };
      });

    [...grades]
      .sort((a, b) => num(a.contestGradeIndex) - num(b.contestGradeIndex))
      .forEach((gr) => {
        grdById[gr.contestGradeId] = gr;
        const catId = gr.refCategoryId;
        if (!matrix[catId]) return;

        matrix[catId].grades[gr.contestGradeId] = {
          gradeId: gr.contestGradeId,
          gradeTitle: gr.contestGradeTitle,
          seats: {},
        };
      });

    judgesAssign.forEach((row) => {
      const grdId = row.contestGradeId;
      const grd = grdById[grdId];
      const catId = grd?.refCategoryId || row.categoryId;
      const cat = catById[catId];
      if (!grd || !cat) return;

      const maxCatSeat = num(cat.contestCategoryJudgeCount, seatCount);
      const seat = num(row.seatIndex);
      if (seat < 1 || (maxCatSeat > 0 && seat > maxCatSeat)) return;

      const judgeName = poolMap[row.judgeUid]?.judgeName || row.judgeName || "";

      if (matrix[catId]?.grades[grdId]) {
        matrix[catId].grades[grdId].seats[seat] = judgeName;
      }
    });

    return matrix;
  }, [categories, grades, judgesAssign, poolMap, seatCount]);

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-[#fafafa] text-[#737373] p-6 text-[13px]">
        심판 좌석 배정 매트릭스를 불러오는 중입니다...
      </div>
    );
  }

  const exportExcel = () => {
    const rows = [];
    Object.values(seatMatrix).forEach((cat) => {
      rows.push([cat.categoryTitle]);

      const header = ["체급"];
      for (let i = 1; i <= seatCount; i++) header.push(`좌석 ${i}`);
      rows.push(header);

      Object.values(cat.grades).forEach((gr) => {
        const row = [gr.gradeTitle];
        for (let i = 1; i <= seatCount; i++) {
          row.push(gr.seats[i] || "배정안됨");
        }
        rows.push(row);
      });

      rows.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "JudgeMatrix");

    const title = currentContest?.contestInfo?.contestTitle ?? "Contest";
    XLSX.writeFile(wb, `${title}_심판배정매트릭스.xlsx`);
  };

  return (
    <>
      <style>{`
        @media print {
          .print-hide {
            display: none !important;
          }
          .print-area {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
        <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-5">
          <div className="print-hide no-print print:hidden bg-[#ffffff] rounded-[12px] p-5 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#525252] flex items-center justify-center shrink-0">
                <LayoutGrid size={16} strokeWidth={1.5} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#171717] m-0">
                    심판 좌석 배정 매트릭스
                  </h1>
                  <span className="inline-flex items-center h-5 px-2 rounded-[4px] bg-[#f4f4f5] text-[11px] font-medium text-[#525252] tabular-nums">
                    {seatCount}인 심판제
                  </span>
                </div>
                <p className="text-[12px] text-[#737373] m-0 mt-0.5">
                  종목·체급별 심판 좌석 배정 현황표를 A4 세로 규격으로 출력합니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportExcel}
                className="h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.12] text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
              >
                <FileSpreadsheet size={15} strokeWidth={1.5} className="text-[#525252]" />
                <span>엑셀 다운로드</span>
              </button>

              <ReactToPrint
                trigger={() => (
                  <button
                    type="button"
                    className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-[#ffffff] text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer border-0"
                  >
                    <Printer size={15} strokeWidth={1.5} />
                    <span>인쇄하기 (A4 세로)</span>
                  </button>
                )}
                content={() => printRef.current}
                pageStyle="@page { size: A4 portrait; margin: 15mm 20mm; }"
              />
            </div>
          </div>

          <div
            className="print-area bg-[#ffffff] rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            style={{
              padding: "48px",
              maxWidth: "1200px",
              margin: "0 auto",
            }}
          >
          <div ref={printRef}>
            <div
              style={{
                borderBottom: "3px double #000",
                paddingBottom: "16px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  fontFamily: "'Malgun Gothic', sans-serif",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: "#666",
                    marginBottom: "8px",
                    letterSpacing: "2px",
                  }}
                >
                  심판 배정 현황
                </div>
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    margin: "0 0 12px 0",
                    letterSpacing: "-0.5px",
                  }}
                >
                  {currentContest?.contestInfo?.contestTitle ?? "대회명 없음"}
                </h2>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#333",
                  }}
                >
                  심판 좌석 배정 매트릭스
                </div>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  display: "flex",
                  justifyContent: "flex-end",
                  fontSize: "11px",
                  color: "#666",
                }}
              >
                <div>
                  <div>
                    발행일:{" "}
                    {new Date().toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </div>
            </div>

            {Object.values(seatMatrix).map((cat, idx) => (
              <div
                key={cat.categoryId}
                style={{
                  marginTop: idx === 0 ? 0 : "32px",
                  pageBreakInside: "avoid",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#f8f9fa",
                    border: "1px solid #dee2e6",
                    borderBottom: "2px solid #495057",
                    padding: "8px 12px",
                    marginBottom: "0",
                    fontWeight: "700",
                    fontSize: "14px",
                    letterSpacing: "-0.3px",
                  }}
                >
                  {cat.categoryTitle}
                </div>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "12px",
                    fontFamily: "'Malgun Gothic', sans-serif",
                    border: "1px solid #dee2e6",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f8f9fa" }}>
                      <th
                        style={{
                          width: "120px",
                          padding: "10px 8px",
                          border: "1px solid #dee2e6",
                          borderTop: "none",
                          fontWeight: "600",
                          textAlign: "center",
                          fontSize: "12px",
                          color: "#212529",
                        }}
                      >
                        체급
                      </th>

                      {Array.from({ length: seatCount }, (_, i) => i + 1).map(
                        (seat) => (
                          <th
                            key={seat}
                            style={{
                              border: "1px solid #dee2e6",
                              borderTop: "none",
                              padding: "10px 8px",
                              fontWeight: "600",
                              textAlign: "center",
                              fontSize: "11px",
                              color: "#495057",
                            }}
                          >
                            좌석 {seat}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {Object.values(cat.grades).map((gr, grIdx) => (
                      <tr
                        key={gr.gradeId}
                        style={{
                          backgroundColor:
                            grIdx % 2 === 0 ? "#ffffff" : "#fafbfc",
                        }}
                      >
                        <td
                          style={{
                            border: "1px solid #dee2e6",
                            fontWeight: "600",
                            padding: "10px 8px",
                            textAlign: "center",
                            fontSize: "12px",
                            color: "#212529",
                          }}
                        >
                          {gr.gradeTitle}
                        </td>

                        {Array.from({ length: seatCount }, (_, i) => i + 1).map(
                          (seat) => (
                            <td
                              key={seat}
                              style={{
                                border: "1px solid #dee2e6",
                                padding: "10px 8px",
                                textAlign: "center",
                                fontSize: "11px",
                                color: gr.seats[seat] ? "#212529" : "#dc3545",
                                fontWeight: gr.seats[seat] ? "500" : "600",
                                letterSpacing: gr.seats[seat] ? "0px" : "0.5px",
                              }}
                            >
                              {gr.seats[seat] || "배정안됨"}
                            </td>
                          )
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            <div
              style={{
                marginTop: "40px",
                paddingTop: "16px",
                borderTop: "1px solid #dee2e6",
                fontSize: "10px",
                color: "#868e96",
                textAlign: "center",
              }}
            >
              본 문서는 {currentContest?.contestInfo?.contestTitle ?? "대회"}{" "}
              심판 배정 현황을 나타냅니다.
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
