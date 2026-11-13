"use client";

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import ReactToPrint from "react-to-print";
import { Table, Checkbox } from "antd";
import {
  Printer,
  ArrowDown,
  CheckSquare,
  Eraser,
  UserCheck,
} from "lucide-react";

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
  const [printTick, setPrintTick] = useState(0);

  const onBeforeGetContent = () =>
    new Promise((resolve) => {
      // 리렌더 트리거
      setPrintTick((t) => t + 1);
      // DOM 업데이트 프레임을 보장
      requestAnimationFrame(() => setTimeout(resolve, 0));
    });

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

  const num = (v, d = 0) => {
    if (v == null) return d;
    // 공백이나 문자열 섞여도 안전하게 숫자만 추출
    const n = parseInt(
      String(v)
        .trim()
        .replace(/[^\d.-]/g, ""),
      10
    );
    return Number.isFinite(n) ? n : d;
  };

  const sectionOrder = (s) => {
    if (!s) return 9999;
    const m = String(s).match(/^(\d+)\s*부/); // "1부, 2부…" 같은 섹션
    return m ? parseInt(m[1], 10) : 9999;
  };

  const catIdx = (cat) => num(cat?.contestCategoryIndex, 9999);
  const gradeIdx = (grd) => num(grd?.contestGradeIndex, 9999);

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

        // 1) 섹션 오름차순 (예: "1부", "2부"...)
        const sa = sectionOrder(ca.contestCategorySection);
        const sb = sectionOrder(cb.contestCategorySection);
        if (sa !== sb) return sa - sb;

        // 2) 카테고리 인덱스 오름차순
        const cai = catIdx(ca); // 내부에서 num() 사용
        const cbi = catIdx(cb);
        if (cai !== cbi) return cai - cbi;

        // 3) 체급 인덱스 오름차순
        const ga = gradeMap[a.contestGradeId] || {};
        const gb = gradeMap[b.contestGradeId] || {};
        const gai = gradeIdx(ga); // 내부에서 num() 사용
        const gbi = gradeIdx(gb);
        if (gai !== gbi) return gai - gbi;

        // 4) 좌석 오름차순
        return num(a.seatIndex) - num(b.seatIndex);
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
      width: 140,
      sorter: (a, b) => byName(a, b),
      defaultSortOrder: "ascend",
      render: (_, rec) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-[#171717]">
            {rec.judgeName}
          </span>
          {rec.judgeGym ? (
            <span className="text-[12px] text-[#737373]">{rec.judgeGym}</span>
          ) : null}
        </div>
      ),
    },
    {
      title: "배정 요약",
      dataIndex: "summary",
      render: (_, rec) => {
        // 섹션 → (카테고리ID → { title, idx, seats:Set })
        const groups = {};
        rec.items.forEach((it) => {
          const cat = categoryMap[it.categoryId] || {};
          const sec = cat.contestCategorySection || "-";
          const catId = it.categoryId;
          const catTitle = cat.contestCategoryTitle || "-";
          const catIndex = num(cat.contestCategoryIndex, 9999); // 안전 숫자

          if (!groups[sec]) groups[sec] = {};
          if (!groups[sec][catId]) {
            groups[sec][catId] = {
              title: catTitle,
              idx: catIndex,
              seats: new Set(),
            };
          }
          groups[sec][catId].seats.add(num(it.seatIndex, 9999)); // 좌석도 숫자화
        });

        // 섹션 키 정렬 ("1부"→"2부"…)
        const sectionKeys = Object.keys(groups).sort(
          (a, b) => sectionOrder(a) - sectionOrder(b)
        );

        return (
          <div className="flex flex-col gap-1.5">
            {sectionKeys.map((sec) => {
              // 섹션 내 카테고리를 contestCategoryIndex 기준으로 정렬
              const cats = Object.values(groups[sec]).sort(
                (a, b) => a.idx - b.idx
              );

              return (
                <div key={sec} className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center h-5 px-2 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] text-[11px] font-medium">
                    {sec}
                  </span>

                  {cats.map((c, i) => (
                    <span
                      key={`${sec}-${c.title}-${i}`}
                      className="inline-flex items-center h-5 px-2 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#525252] text-[11px] font-normal tabular-nums"
                    >
                      {c.title} · 좌석 {Array.from(c.seats).sort(byNum).join(",")}
                    </span>
                  ))}
                </div>
              );
            })}
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

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-[#fafafa] text-[#737373] p-6 text-[13px]">
        심판 배정 데이터를 불러오는 중입니다...
      </div>
    );
  }

  const orgLogo = currentContest?.contestInfo?.contestOrgLogo;

  return (
    <div className="w-full min-h-screen bg-[#fafafa] text-[#171717]">
      <style>{`
        :root { --ink: #111827; --muted: #6b7280; --line: #e5e7eb; --brand: #111827; }
        .screen-card { background: #fff; border-radius: 12px; }

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
        #print-root table { border-collapse: collapse; width: 100%; font-size: 15.5px; line-height: 1.45; color: var(--ink); }
        #print-root thead th { background: #f8fafc; font-weight: 700; border: 1px solid var(--line); padding: 8px 10px; }
        #print-root tbody td { border: 1px solid var(--line); padding: 7px 10px; }
        #print-root tbody tr:nth-child(odd) td { background: #fcfdff; }
      `}</style>

      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
        {/* 타이틀 바 + 인쇄 버튼 */}
        <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-5 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[#525252] flex items-center justify-center shrink-0">
              <UserCheck size={16} strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#171717] m-0">
                  심판별 배정 안내 출력
                </h1>
                <span className="inline-flex items-center h-5 px-2 rounded-[4px] bg-[#f4f4f5] text-[11px] font-medium text-[#525252] tabular-nums">
                  선택 {selectedPersons.length} / 전체 {filteredPersons.length}명
                </span>
              </div>
              <p className="text-[12px] text-[#737373] m-0 mt-0.5">
                심판별 배정 좌석 및 원데이 비밀번호 안내서를 A4 용지로 인쇄합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={selectedPersons.length === 0}
              onClick={() => {
                window.scrollTo({
                  top: document.body.scrollHeight,
                  behavior: "smooth",
                });
              }}
              className="h-9 px-3.5 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.12] text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowDown size={14} strokeWidth={1.5} className="text-[#525252]" />
              <span>하단 미리보기로 이동</span>
            </button>

            <ReactToPrint
              trigger={() => (
                <button
                  type="button"
                  disabled={selectedPersons.length === 0}
                  className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-[#ffffff] text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Printer size={15} strokeWidth={1.5} />
                  <span>인쇄하기</span>
                </button>
              )}
              content={() => printRef.current}
              pageStyle="@page { size: A4; margin: 12mm; }"
              onBeforeGetContent={onBeforeGetContent}
            />
          </div>
        </div>

        {/* 상단 제어바 */}
        <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-4 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-[12px] font-medium text-[#525252] mb-1.5">
                섹션
              </label>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="w-full h-9 border border-[#171717]/[0.12] rounded-[8px] px-3 text-[13px] font-normal text-[#171717] bg-[#ffffff] focus:outline-none focus:border-[#2563eb]"
              >
                <option value="ALL">모든 섹션</option>
                {Array.from(
                  new Set(
                    categories
                      .map((c) => c.contestCategorySection)
                      .filter(Boolean)
                  )
                )
                  .sort((a, b) => sectionOrder(a) - sectionOrder(b))
                  .map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#525252] mb-1.5">
                이름 · 소속 검색
              </label>
              <input
                type="text"
                placeholder="예: 김판정, 제이짐"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full h-9 border border-[#171717]/[0.12] rounded-[8px] px-3 text-[13px] font-normal text-[#171717] bg-[#ffffff] placeholder:text-[#737373] focus:outline-none focus:border-[#2563eb]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#525252] mb-1.5">
                출력 제목
              </label>
              <input
                type="text"
                placeholder="심판 배정 안내"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                className="w-full h-9 border border-[#171717]/[0.12] rounded-[8px] px-3 text-[13px] font-normal text-[#171717] bg-[#ffffff] placeholder:text-[#737373] focus:outline-none focus:border-[#2563eb]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#525252] mb-1.5">
                보기 형태
              </label>
              <div className="inline-flex items-center gap-1 p-1 rounded-[8px] bg-[#f4f4f5] h-9 w-full">
                <button
                  type="button"
                  onClick={() => setViewMode("compact")}
                  className={`flex-1 h-7 rounded-[6px] text-[12px] font-medium transition-colors duration-150 ${
                    viewMode === "compact"
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  간단히
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("detail")}
                  className={`flex-1 h-7 rounded-[6px] text-[12px] font-medium transition-colors duration-150 ${
                    viewMode === "detail"
                      ? "bg-[#ffffff] text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-[#525252] hover:text-[#171717]"
                  }`}
                >
                  자세히
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="flex-1 h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#171717] border border-[#171717]/[0.12] text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors duration-150"
              >
                <CheckSquare size={14} strokeWidth={1.5} className="text-[#525252]" />
                <span>전체 선택</span>
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="flex-1 h-9 px-3 rounded-[8px] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#525252] border border-[#171717]/[0.12] text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors duration-150"
              >
                <Eraser size={14} strokeWidth={1.5} className="text-[#737373]" />
                <span>해제</span>
              </button>
            </div>
          </div>
        </div>

        {/* 사람 목록 (이름 정렬) */}
        <div className="no-print print:hidden bg-[#ffffff] rounded-[12px] p-4 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <Table
            rowKey={(r) => r.judgeUid}
            columns={columns}
            dataSource={filteredPersons}
            pagination={{ pageSize: 10 }}
            defaultSortOrder="ascend"
            size="small"
          />
        </div>

        {/* 인쇄 미리보기 */}
        <div className="screen-card bg-[#ffffff] rounded-[12px] p-6 border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="no-print print:hidden flex items-center justify-between pb-4 mb-4 border-b border-[#171717]/[0.08]">
            <h2 className="text-[14px] font-semibold text-[#171717] m-0">
              인쇄 미리보기
            </h2>
            <span className="text-[12px] text-[#737373] tabular-nums">
              선택된 심판 {selectedPersons.length}명
            </span>
          </div>
          {selectedPersons.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[#737373]">
              위 목록에서 인쇄할 심판을 선택하세요.
            </div>
          ) : (
            <div id="print-root" ref={printRef} key={printTick}>
            <div className="p-2">
              {selectedPersons.map((person) => {
                // 간단 모드 데이터 구성

                const compactRows = [];
                if (viewMode === "compact") {
                  // 섹션 + 카테고리ID 기준 버켓 (제목 X, ID O)
                  const bucket = new Map();
                  person.items.forEach((it) => {
                    const cat = categoryMap[it.categoryId] || {};
                    const grd = gradeMap[it.contestGradeId] || {};
                    const sec = cat.contestCategorySection || "-";
                    const catId = it.categoryId;
                    const key = `${sec}||${catId}`;

                    if (!bucket.has(key)) {
                      bucket.set(key, {
                        section: sec,
                        categoryId: catId,
                        categoryTitle: cat.contestCategoryTitle || "-",
                        catIdx: gradeIdx
                          ? num(cat.contestCategoryIndex, 9999)
                          : 9999,
                        seatSet: new Set(),
                        gradesMap: new Map(), // gradeId -> { title, idx, seat }
                      });
                    }

                    const row = bucket.get(key);
                    row.seatSet.add(num(it.seatIndex));

                    const gId = it.contestGradeId;
                    const gTitle = grd.contestGradeTitle || "-";
                    const gIdx = num(grd.contestGradeIndex, 9999);
                    row.gradesMap.set(gId, {
                      title: gTitle,
                      idx: gIdx,
                      seat: num(it.seatIndex),
                    });
                  });

                  // 버켓을 배열로 변환 + 내부 정렬
                  for (const row of bucket.values()) {
                    const seats = Array.from(row.seatSet).sort((a, b) => a - b);

                    const gradeEntries = Array.from(
                      row.gradesMap.values()
                    ).sort((a, b) => a.idx - b.idx || a.seat - b.seat);

                    // 좌석이 하나뿐이면 '좌석 변경' 표시 생략
                    const sameSeat = seats.length === 1;

                    compactRows.push({
                      section: row.section,
                      categoryTitle: row.categoryTitle,
                      catIdx: row.catIdx,
                      seats,
                      grades: sameSeat
                        ? []
                        : gradeEntries.map(
                            (g) => `${g.title} (좌석 ${g.seat})`
                          ),
                    });
                  }

                  // 최종 정렬: 섹션 → 카테고리 인덱스 → 카테고리 제목
                  compactRows.sort(
                    (a, b) =>
                      sectionOrder(a.section) - sectionOrder(b.section) ||
                      a.catIdx - b.catIdx ||
                      a.categoryTitle.localeCompare(b.categoryTitle, "ko")
                  );
                }
                // ---- 교체 끝 ----

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
                            <th style={{ widht: 200 }}>종목</th>
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
                            <th style={{ widht: 200 }}>종목</th>
                            <th style={{ width: "22%", textAlign: "center" }}>
                              좌석
                            </th>
                            <th style={{ width: 100 }}>비고</th>
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
        </div>
      </div>
    </div>
  );
};

export default JudgeAssignmentPrint;
