"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";

import { where } from "firebase/firestore";
import ReactToPrint from "react-to-print";

import { Button, Typography } from "antd";
import { PrinterOutlined, FileExcelOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";

const { Title } = Typography;

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
    const maxSeat = Math.max(
      ...judgesAssign.map((j) => num(j.seatIndex, 0)),
      0
    );
    return maxSeat <= 7 ? 7 : 9;
  }, [judgesAssign]);

  const seatMatrix = useMemo(() => {
    if (!categories || !grades || !judgesAssign) return {};

    const matrix = {};

    categories
      .sort((a, b) => num(a.contestCategoryIndex) - num(b.contestCategoryIndex))
      .forEach((cat) => {
        matrix[cat.contestCategoryId] = {
          categoryId: cat.contestCategoryId,
          categoryTitle: cat.contestCategoryTitle,
          grades: {},
        };
      });

    grades
      .sort((a, b) => num(a.contestGradeIndex) - num(b.contestGradeIndex))
      .forEach((gr) => {
        const catId = gr.refCategoryId;
        if (!matrix[catId]) return;

        matrix[catId].grades[gr.contestGradeId] = {
          gradeId: gr.contestGradeId,
          gradeTitle: gr.contestGradeTitle,
          seats: {},
        };
      });

    judgesAssign.forEach((row) => {
      const catId = row.categoryId;
      const grdId = row.contestGradeId;
      const seat = num(row.seatIndex);
      const judgeName = row.judgeName || poolMap[row.judgeUid]?.judgeName || "";

      if (matrix[catId]?.grades[grdId]) {
        matrix[catId].grades[grdId].seats[seat] = judgeName;
      }
    });

    return matrix;
  }, [categories, grades, judgesAssign, poolMap]);

  if (loading) return <div className="p-6">불러오는 중…</div>;

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

      <div
        style={{
          padding: "24px",
          backgroundColor: "#f5f5f5",
          minHeight: "100vh",
        }}
      >
        <div
          className="print-hide"
          style={{
            backgroundColor: "#ffffff",
            padding: "20px 24px",
            borderRadius: "8px",
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            심판 좌석 배정 매트릭스
          </Title>

          <div style={{ display: "flex", gap: 8 }}>
            <Button icon={<FileExcelOutlined />} onClick={exportExcel}>
              엑셀 다운로드
            </Button>

            <ReactToPrint
              trigger={() => (
                <Button type="primary" icon={<PrinterOutlined />}>
                  인쇄하기 (A4 세로)
                </Button>
              )}
              content={() => printRef.current}
              pageStyle="@page { size: A4 portrait; margin: 15mm 20mm; }"
            />
          </div>
        </div>

        <div
          className="print-area"
          style={{
            backgroundColor: "#ffffff",
            padding: "48px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
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
    </>
  );
}
