"use client";

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import ReactToPrint from "react-to-print";
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Select,
  Input,
  Typography,
  Checkbox,
  Radio,
  Divider,
} from "antd";
import {
  PrinterOutlined,
  ExportOutlined,
  CheckSquareOutlined,
  ClearOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

const sectionOrder = (s) => {
  if (!s) return 9999;
  const m = String(s).match(/^(\d+)\s*부/);
  return m ? parseInt(m[1], 10) : 9999;
};
const byNum = (a, b) => Number(a ?? 0) - Number(b ?? 0);
const byName = (a, b) =>
  (a?.judgeName || "").localeCompare(b?.judgeName || "", "ko");

const JudgeAssignmentPrint = () => {
  const { currentContest } = useContext(CurrentContestContext);

  const fetchJudgesAssign = useFirestoreGetDocument("contest_judges_assign");
  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchPools = useFirestoreQuery();

  const [loading, setLoading] = useState(true);
  const [judgesAssign, setJudgesAssign] = useState([]);
  const [categories, setCategories] = useState([]);
  const [grades, setGrades] = useState([]);
  const [pools, setPools] = useState([]);

  const [sectionFilter, setSectionFilter] = useState("ALL");
  const [q, setQ] = useState("");
  const [selectedJudgeUids, setSelectedJudgeUids] = useState([]);

  const [viewMode, setViewMode] = useState("compact"); // "compact" | "detail"
  const [pageTitle, setPageTitle] = useState("심판 배정 안내");

  const printRef = useRef(null);

  useEffect(() => {
    const run = async () => {
      try {
        if (!currentContest?.contests?.id) return;
        const contestId = currentContest.contests.id;
        const [assignDoc, catDoc, gradeDoc, poolList] = await Promise.all([
          fetchJudgesAssign.getDocument(
            currentContest.contests.contestJudgesAssignId
          ),
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
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [currentContest]);

  const categoryMap = useMemo(() => {
    const m = {};
    categories.forEach((c) => (m[c.contestCategoryId] = c));
    return m;
  }, [categories]);

  const gradeMap = useMemo(() => {
    const m = {};
    grades.forEach((g) => (m[g.contestGradeId] = g));
    return m;
  }, [grades]);

  const poolMap = useMemo(() => {
    const m = {};
    pools.forEach((p) => (m[p.judgeUid] = p));
    return m;
  }, [pools]);

  // 사람 기준 그룹핑 + 내부 정렬
  const judgesByPerson = useMemo(() => {
    const byJudge = {};
    judgesAssign.forEach((row) => {
      const uid = row.judgeUid;
      if (!uid) return;
      if (!byJudge[uid]) {
        const pool = poolMap[uid] || {};
        byJudge[uid] = {
          judgeUid: uid,
          judgeName: row.judgeName || pool.judgeName || "-",
          judgeGym: pool.judgeGym || "",
          onedayPassword: row.onedayPassword ?? pool.onedayPassword ?? "",
          signature: pool.judgeSignature || "",
          items: [],
        };
      }
      byJudge[uid].items.push(row);
    });

    Object.values(byJudge).forEach((person) => {
      person.items.sort((a, b) => {
        const ca = categoryMap[a.categoryId] || {};
        const cb = categoryMap[b.categoryId] || {};
        const sa = sectionOrder(ca.contestCategorySection);
        const sb = sectionOrder(cb.contestCategorySection);
        if (sa !== sb) return sa - sb;

        const ci = parseInt(ca.contestCategoryIndex ?? "9999", 10);
        const cj = parseInt(cb.contestCategoryIndex ?? "9999", 10);
        if (ci !== cj) return ci - cj;

        const ga = gradeMap[a.contestGradeId] || {};
        const gb = gradeMap[b.contestGradeId] || {};
        const gi = parseInt(ga.contestGradeIndex ?? "9999", 10);
        const gj = parseInt(gb.contestGradeIndex ?? "9999", 10);
        if (gi !== gj) return gi - gj;

        return byNum(a.seatIndex, b.seatIndex);
      });
    });

    return Object.values(byJudge).sort(byName);
  }, [judgesAssign, categoryMap, gradeMap, poolMap]);

  // 필터/검색(이름/소속) — 결과도 이름순 유지
  const filteredPersons = useMemo(() => {
    let list = judgesByPerson;
    if (sectionFilter !== "ALL") {
      list = list
        .map((p) => ({
          ...p,
          items: p.items.filter((it) => {
            const cat = categoryMap[it.categoryId];
            return cat?.contestCategorySection === sectionFilter;
          }),
        }))
        .filter((p) => p.items.length > 0);
    }
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.judgeName || "").toLowerCase().includes(qq) ||
          (p.judgeGym || "").toLowerCase().includes(qq)
      );
    }
    return list.sort(byName);
  }, [judgesByPerson, sectionFilter, q, categoryMap]);

  const columns = [
    {
      title: "선택",
      dataIndex: "select",
      width: 76,
      render: (_, rec) => (
        <Checkbox
          checked={selectedJudgeUids.includes(rec.judgeUid)}
          onChange={(e) => {
            const on = e.target.checked;
            setSelectedJudgeUids((prev) =>
              on
                ? Array.from(new Set([...prev, rec.judgeUid]))
                : prev.filter((id) => id !== rec.judgeUid)
            );
          }}
        />
      ),
    },
    {
      title: "심판",
      dataIndex: "judgeName",
      sorter: (a, b) => byName(a, b),
      defaultSortOrder: "ascend",
      render: (_, rec) => (
        <div className="flex flex-col">
          <Text strong style={{ fontSize: 15 }}>
            {rec.judgeName}
          </Text>
          {rec.judgeGym ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {rec.judgeGym}
            </Text>
          ) : null}
        </div>
      ),
    },
    {
      title: "배정 요약",
      dataIndex: "summary",
      render: (_, rec) => {
        const groups = {};
        rec.items.forEach((it) => {
          const cat = categoryMap[it.categoryId] || {};
          const sec = cat.contestCategorySection || "-";
          const catTitle = cat.contestCategoryTitle || "-";
          if (!groups[sec]) groups[sec] = {};
          if (!groups[sec][catTitle]) groups[sec][catTitle] = new Set();
          groups[sec][catTitle].add(it.seatIndex);
        });
        const sectionKeys = Object.keys(groups).sort(
          (a, b) => sectionOrder(a) - sectionOrder(b)
        );
        return (
          <div className="flex flex-col gap-1">
            {sectionKeys.map((sec) => (
              <div key={sec} className="flex gap-8 flex-wrap">
                <Tag color="blue" style={{ borderRadius: 999 }}>
                  {sec}
                </Tag>
                {Object.keys(groups[sec]).map((c) => (
                  <Tag
                    key={c}
                    style={{
                      borderRadius: 999,
                      background: "#f7f7fb",
                      borderColor: "#e9e9f3",
                    }}
                  >
                    {c} · 좌석{" "}
                    {Array.from(groups[sec][c]).sort(byNum).join(",")}
                  </Tag>
                ))}
              </div>
            ))}
          </div>
        );
      },
    },
  ];

  const selectedPersons = useMemo(
    () =>
      filteredPersons
        .filter((p) => selectedJudgeUids.includes(p.judgeUid))
        .sort(byName),
    [filteredPersons, selectedJudgeUids]
  );

  const selectAll = () =>
    setSelectedJudgeUids(filteredPersons.map((p) => p.judgeUid));
  const clearAll = () => setSelectedJudgeUids([]);

  if (loading) return <div className="p-6">불러오는 중…</div>;

  const orgLogo = currentContest?.contestInfo?.contestOrgLogo;

  return (
    <div className="flex flex-col gap-12 p-4">
      <style>{`
        :root { --ink: #111827; --muted: #6b7280; --line: #e5e7eb; --brand: #111827; }
        .screen-card { background: #fff; border-radius: 10px; }

        /* 화면에서 헤더도 약간 크게(인쇄는 더 크게 별도 지정) */
        .screen-header__logo {
          width: 60px; height: 60px; object-fit: contain;
          border-radius: 10px; border: 1px solid #eee; background: #fff;
        }
        .screen-header__pageTitle { font-size: 18px; font-weight: 900; letter-spacing: .2px; }
        .screen-header__sub { font-size: 12.5px; color: var(--muted); margin-top: 3px; }

        /* 인쇄 설정 */
        @page { size: A4; margin: 12mm; }
        @media print {
          body { font-family: "Times New Roman", "Noto Serif KR", serif; }
          body * { visibility: hidden !important; }
          #print-root, #print-root * { visibility: visible !important; }
          #print-root { position: absolute; inset: 0; margin: 0; padding: 0; }
          .sheet { page-break-after: always; }
          .no-break { page-break-inside: avoid; }
          .screen-card, .ant-card { box-shadow: none !important; border: none !important; }
          .ant-table, .ant-btn, .ant-input, .ant-select, .ant-radio-group { display: none !important; }

          /* 인쇄용 헤더 강화 */
          .print-header {
            display: flex !important;
            align-items: center;
            gap: 18px;
            margin-bottom: 10px;
          }
          .print-header__logo {
            width: 76px; height: 76px; object-fit: contain;
            border-radius: 10px; border: 1px solid #e6e6ef; background: #fff;
          }
          .print-header__titles { flex: 1; min-width: 260px; }
          .print-header__pageTitle {
            font-size: 22px; font-weight: 900; letter-spacing: .2px;
          }
          .print-header__contestTitle {
            margin-top: 3px; font-size: 15px; font-weight: 700; color: #222;
          }
          .print-header__meta {
            margin-top: 2px; font-size: 12.5px; color: var(--muted);
          }
          .print-header__rule {
            height: 2px; background: var(--brand); opacity: .08; margin: 10px 0 16px 0;
          }
        }

        /* 프린트 테이블 공통 */
        table { border-collapse: collapse; width: 100%; font-size: 12.2px; line-height: 1.45; color: var(--ink); }
        thead th { background: #f8fafc; font-weight: 700; border: 1px solid var(--line); padding: 8px 10px; }
        tbody td { border: 1px solid var(--line); padding: 7px 10px; }
        tbody tr:nth-child(odd) td { background: #fcfdff; }
      `}</style>

      {/* 상단 제어바 + 인쇄 버튼 */}
      <Card className="shadow-md screen-card">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Text type="secondary">섹션</Text>
              <Select
                className="w-full"
                value={sectionFilter}
                onChange={setSectionFilter}
                options={[
                  { value: "ALL", label: "모든 섹션" },
                  ...Array.from(
                    new Set(
                      categories
                        .map((c) => c.contestCategorySection)
                        .filter(Boolean)
                    )
                  )
                    .sort((a, b) => sectionOrder(a) - sectionOrder(b))
                    .map((s) => ({ value: s, label: s })),
                ]}
              />
            </div>
            <div>
              <Text type="secondary">검색(이름/소속)</Text>
              <Input
                placeholder="예) 김판정 / 제이짐"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div>
              <Text type="secondary">출력 제목</Text>
              <Input
                placeholder="심판 배정 안내"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
              />
            </div>
            <div>
              <Text type="secondary">보기 형태</Text>
              <Radio.Group
                className="mt-1"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
              >
                <Radio.Button value="compact">간단히</Radio.Button>
                <Radio.Button value="detail">자세히</Radio.Button>
              </Radio.Group>
            </div>

            <div className="flex items-end">
              <Space wrap>
                <Button icon={<CheckSquareOutlined />} onClick={selectAll}>
                  전체 선택
                </Button>
                <Button icon={<ClearOutlined />} onClick={clearAll}>
                  선택 해제
                </Button>
              </Space>
            </div>
          </div>

          <div className="flex gap-8">
            <Space wrap>
              <ReactToPrint
                trigger={() => (
                  <Button
                    type="primary"
                    icon={<PrinterOutlined />}
                    disabled={selectedPersons.length === 0}
                  >
                    인쇄
                  </Button>
                )}
                content={() => printRef.current}
                pageStyle="@page { size: A4; margin: 12mm; }"
              />
              <Button
                icon={<ExportOutlined />}
                disabled={selectedPersons.length === 0}
                onClick={() => {
                  window.scrollTo({
                    top: document.body.scrollHeight,
                    behavior: "smooth",
                  });
                }}
              >
                하단 미리보기로 이동
              </Button>
            </Space>
          </div>
        </div>
      </Card>

      {/* 사람 목록 (이름 정렬) */}
      <Card className="shadow-md screen-card">
        <Table
          rowKey={(r) => r.judgeUid}
          columns={columns}
          dataSource={filteredPersons}
          pagination={{ pageSize: 10 }}
          defaultSortOrder="ascend"
        />
      </Card>

      {/* 인쇄 미리보기 */}
      <Card className="shadow-md screen-card">
        <Title level={5} className="!mt-0">
          인쇄 미리보기
        </Title>
        <Divider className="my-3" />
        {selectedPersons.length === 0 ? (
          <div className="text-gray-500">선택된 심판이 없습니다.</div>
        ) : (
          <div id="print-root" ref={printRef}>
            <div className="p-2">
              {selectedPersons.map((person) => {
                // 간단 모드 데이터 구성
                const compactRows = [];
                if (viewMode === "compact") {
                  const bucket = {};
                  person.items.forEach((it) => {
                    const cat = categoryMap[it.categoryId] || {};
                    const grd = gradeMap[it.contestGradeId] || {};
                    const sec = cat.contestCategorySection || "-";
                    const key = `${sec}||${cat.contestCategoryTitle || "-"}`;
                    if (!bucket[key]) {
                      bucket[key] = {
                        section: sec,
                        categoryTitle: cat.contestCategoryTitle || "-",
                        seatSet: new Set(),
                        gradeSet: new Set(),
                        seatByGrade: {},
                      };
                    }
                    bucket[key].seatSet.add(it.seatIndex);
                    const gTitle = grd.contestGradeTitle || "-";
                    bucket[key].gradeSet.add(gTitle);
                    bucket[key].seatByGrade[gTitle] = it.seatIndex;
                  });

                  Object.values(bucket).forEach((row) => {
                    const seats = Array.from(row.seatSet).sort(byNum);
                    const gradesList = Array.from(row.gradeSet).sort((a, b) =>
                      a.localeCompare(b)
                    );
                    const sameSeat = seats.length === 1;
                    compactRows.push({
                      section: row.section,
                      categoryTitle: row.categoryTitle,
                      seats,
                      grades: sameSeat
                        ? []
                        : gradesList.map(
                            (g) => `${g} (좌석 ${row.seatByGrade[g]})`
                          ),
                    });
                  });

                  compactRows.sort(
                    (a, b) =>
                      sectionOrder(a.section) - sectionOrder(b.section) ||
                      a.categoryTitle.localeCompare(b.categoryTitle)
                  );
                }

                const contestTitle =
                  currentContest?.contestInfo?.contestTitle || "";
                const contestDate =
                  currentContest?.contestInfo?.contestDate || "";

                return (
                  <div key={person.judgeUid} className="sheet mb-10">
                    {/* 헤더 - 화면/인쇄 겸용 클래스 (인쇄에서 더 크게 적용됨) */}
                    <div className="no-break">
                      <div
                        className="print-header"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                        }}
                      >
                        {orgLogo ? (
                          <img
                            src={orgLogo}
                            alt="logo"
                            className="screen-header__logo print-header__logo"
                          />
                        ) : null}
                        <div
                          className="print-header__titles"
                          style={{ flex: 1, minWidth: 240 }}
                        >
                          <div className="screen-header__pageTitle print-header__pageTitle">
                            {pageTitle}
                          </div>
                          <div className="screen-header__sub print-header__contestTitle">
                            {contestTitle}
                          </div>
                          <div className="print-header__meta">
                            {contestDate}
                          </div>
                        </div>
                      </div>
                      <div className="print-header__rule" />
                    </div>

                    {/* 이름 / 비번 / 서명 */}
                    <div className="flex justify-between items-start mb-10 gap-6 no-break">
                      <div className="flex-1 min-w-[260px]">
                        <div style={{ fontSize: 26, fontWeight: 800 }}>
                          {person.judgeName}
                        </div>
                        {person.judgeGym ? (
                          <div
                            style={{
                              fontSize: 12.5,
                              color: "var(--muted)",
                              marginTop: 4,
                            }}
                          >
                            {person.judgeGym}
                          </div>
                        ) : null}

                        {/* 전자채점비밀번호 */}
                        {person.onedayPassword ? (
                          <div
                            style={{
                              marginTop: 18,
                              border: "2px dashed #7c3aed",
                              borderRadius: 14,
                              padding: "14px 16px",
                              display: "inline-block",
                              background: "#faf5ff",
                              maxWidth: 360,
                            }}
                            className="no-break"
                          >
                            <div
                              style={{
                                fontSize: 12,
                                color: "#6b21a8",
                                marginBottom: 6,
                                fontWeight: 700,
                                letterSpacing: 0.3,
                              }}
                            >
                              전자채점비밀번호
                            </div>
                            <div
                              style={{
                                fontSize: 30,
                                fontWeight: 900,
                                letterSpacing: "2.2px",
                                color: "#4c1d95",
                                lineHeight: 1.1,
                              }}
                            >
                              {person.onedayPassword}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {person.signature ? (
                        <div
                          className="text-right no-break"
                          style={{ minWidth: 200 }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--muted)",
                              marginBottom: 6,
                            }}
                          >
                            서명
                          </div>
                          <img
                            src={person.signature}
                            alt="signature"
                            style={{
                              width: 200,
                              height: 120,
                              objectFit: "contain",
                              border: "1px solid #eee",
                              padding: 8,
                              borderRadius: 8,
                              background: "#fff",
                            }}
                          />
                        </div>
                      ) : null}
                    </div>

                    {/* 테이블 */}
                    {viewMode === "detail" ? (
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: "16%" }}>섹션</th>
                            <th>종목</th>
                            <th style={{ width: "28%" }}>체급</th>
                            <th style={{ width: 80, textAlign: "center" }}>
                              좌석
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {person.items.map((it, idx) => {
                            const cat = categoryMap[it.categoryId] || {};
                            const grd = gradeMap[it.contestGradeId] || {};
                            return (
                              <tr key={idx} className="no-break">
                                <td>{cat.contestCategorySection || "-"}</td>
                                <td>{cat.contestCategoryTitle || "-"}</td>
                                <td>{grd.contestGradeTitle || "-"}</td>
                                <td
                                  style={{
                                    textAlign: "center",
                                    fontWeight: 700,
                                  }}
                                >
                                  {it.seatIndex}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: "16%" }}>섹션</th>
                            <th>종목</th>
                            <th style={{ width: "22%", textAlign: "center" }}>
                              좌석
                            </th>
                            <th style={{ width: "32%" }}>비고</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compactRows.map((row, i) => (
                            <tr key={i} className="no-break">
                              <td>{row.section}</td>
                              <td>{row.categoryTitle}</td>
                              <td
                                style={{ textAlign: "center", fontWeight: 700 }}
                              >
                                {row.seats.join(", ")}
                              </td>
                              <td>
                                {row.grades.length > 0 ? (
                                  <div
                                    style={{
                                      fontSize: 11.5,
                                      color: "var(--muted)",
                                    }}
                                  >
                                    좌석 변경: {row.grades.join(" · ")}
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 11.5,
                                      color: "var(--muted)",
                                    }}
                                  >
                                    -
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <div
                      style={{
                        marginTop: 12,
                        fontSize: 11.5,
                        color: "var(--muted)",
                      }}
                    >
                      ※ 좌석 및 배정은 현장 사정으로 변경될 수 있습니다.
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default JudgeAssignmentPrint;
