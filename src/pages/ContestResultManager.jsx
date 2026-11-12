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
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  Card,
  Button,
  Tag,
  Typography,
  Space,
  Popconfirm,
  message,
} from "antd";
import { FileExcelOutlined, ReloadOutlined, DeleteOutlined } from "@ant-design/icons";
import { exportContestResultsToExcel } from "../functions/functions";

const { Title, Text } = Typography;

const ContestResultManager = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const contestId = currentContest?.contests?.id;

  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState([]); // contest_result_list 문서들

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
      // 보기 좋게 정렬
      rows.sort((a, b) => {
        const c = (a.categoryTitle || "").localeCompare(b.categoryTitle || "");
        if (c !== 0) return c;
        return (a.gradeTitle || "").localeCompare(b.gradeTitle || "");
      });
      setDocs(rows);
    } catch (e) {
      console.error(e);
      message.error("결과 불러오기 실패");
    } finally {
      setLoading(false);
    }
  };

  const deleteOne = async (docId) => {
    try {
      await deleteDoc(doc(db, "contest_results_list", docId));
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      message.success("삭제되었습니다");
    } catch (e) {
      console.error(e);
      message.error("삭제 중 오류가 발생했습니다");
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
      message.success(`"${cat} / ${grd}" 결과가 삭제되었습니다`);
    } catch (e) {
      console.error(e);
      message.error("체급 삭제 중 오류가 발생했습니다");
    }
  };

  const deleteAllInContest = async () => {
    try {
      await Promise.all(
        docs.map((d) => deleteDoc(doc(db, "contest_results_list", d.id)))
      );
      setDocs([]);
      message.success("이 대회의 모든 결과가 삭제되었습니다");
    } catch (e) {
      console.error(e);
      message.error("전체 삭제 중 오류가 발생했습니다");
    }
  };

  // 카테고리 → 체급으로 그룹핑
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
  }, [contestId]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    if (docs.length === 0) {
      message.warning("다운로드할 최종 결과 데이터가 없습니다.");
      return;
    }
    try {
      setIsExporting(true);
      const contestTitle =
        currentContest?.contestInfo?.contestTitle ||
        currentContest?.contests?.contestTitle ||
        "제2회 DMZ한반도평화통일기원보디빌딩대회";

      await exportContestResultsToExcel(contestTitle, docs);
      message.success("엑셀 파일이 다운로드되었습니다.");
    } catch (e) {
      console.error(e);
      message.error("엑셀 다운로드 중 오류 발생: " + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col w-full gap-4 p-4">
      <Card className="shadow-md">
        <div className="flex items-center justify-between">
          <Title level={4} style={{ margin: 0 }}>
            최종 결과(집계) 관리
          </Title>
          <Space>
            <Button
              type="primary"
              style={{ backgroundColor: "#059669", borderColor: "#059669" }}
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              loading={isExporting}
              disabled={docs.length === 0}
            >
              엑셀 다운로드
            </Button>
            <Popconfirm
              title="이 대회의 모든 결과를 삭제할까요?"
              okText="삭제"
              cancelText="취소"
              onConfirm={deleteAllInContest}
              disabled={docs.length === 0}
            >
              <Button danger disabled={docs.length === 0}>
                전체 삭제
              </Button>
            </Popconfirm>
            <Button onClick={fetchDocs} loading={loading} type="default" icon={<ReloadOutlined />}>
              새로고침
            </Button>
          </Space>
        </div>
        <Text type="secondary">
          대회ID: {contestId || "-"} / 결과문서: {docs.length}
        </Text>
      </Card>

      {loading ? (
        <Card className="shadow-sm">불러오는 중…</Card>
      ) : docs.length === 0 ? (
        <Card className="shadow-sm">
          이 대회에 저장된 최종 결과가 없습니다.
        </Card>
      ) : (
        Object.keys(grouped).map((cat) => (
          <Card key={cat} className="shadow-md">
            <div className="flex items-center justify-between mb-8">
              <Title level={5} style={{ margin: 0 }}>
                🏆 종목: {cat}
              </Title>
            </div>

            {Object.keys(grouped[cat]).map((grd) => (
              <div key={grd} className="mb-10">
                <div className="flex items-center justify-between mb-3">
                  <Text strong>체급: {grd}</Text>
                  <Popconfirm
                    title={`"${cat} / ${grd}" 결과를 모두 삭제할까요?`}
                    okText="삭제"
                    cancelText="취소"
                    onConfirm={() => deleteGradeGroup(cat, grd)}
                  >
                    <Button danger>체급 결과 전체 삭제</Button>
                  </Popconfirm>
                </div>

                {grouped[cat][grd].map((docu) => {
                  const { id, result = [] } = docu;
                  // 좌석 컬럼 수(첫 선수의 score 참고)
                  const maxSeat =
                    result?.[0]?.score?.reduce(
                      (m, s) => Math.max(m, s.seatIndex || 0),
                      0
                    ) || 0;

                  return (
                    <Card key={id} size="small" className="shadow-sm mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <Text type="secondary">
                          문서ID: <code>{id}</code>
                        </Text>
                        <Popconfirm
                          title="이 결과 문서를 삭제할까요?"
                          okText="삭제"
                          cancelText="취소"
                          onConfirm={() => deleteOne(id)}
                        >
                          <Button danger>이 문서 삭제</Button>
                        </Popconfirm>
                      </div>

                      <div className="overflow-auto">
                        <table className="table-auto w-full text-sm border">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 border">순위</th>
                              <th className="p-2 border">선수번호</th>
                              <th className="p-2 border">이름</th>
                              <th className="p-2 border">소속</th>
                              <th className="p-2 border">총점</th>
                              {Array.from(
                                { length: maxSeat },
                                (_, i) => i + 1
                              ).map((seat) => (
                                <th key={seat} className="p-2 border">
                                  {seat}번
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result
                              .slice()
                              .sort(
                                (a, b) =>
                                  (a.playerRank || 9999) -
                                  (b.playerRank || 9999)
                              )
                              .map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="p-2 border text-center">
                                    {row.playerRank ?? "-"}
                                  </td>
                                  <td className="p-2 border text-center">
                                    {row.playerNumber ?? "-"}
                                  </td>
                                  <td className="p-2 border">
                                    {row.playerName ?? "-"}
                                  </td>
                                  <td className="p-2 border">
                                    {row.playerGym ?? "-"}
                                  </td>
                                  <td className="p-2 border text-center">
                                    <Text strong>{row.totalScore ?? "-"}</Text>
                                  </td>
                                  {Array.from(
                                    { length: maxSeat },
                                    (_, i) => i + 1
                                  ).map((seat) => {
                                    const s = (row.score || []).find(
                                      (x) => x.seatIndex === seat
                                    );
                                    if (!s)
                                      return (
                                        <td
                                          key={seat}
                                          className="p-2 border text-center"
                                        >
                                          -
                                        </td>
                                      );
                                    return (
                                      <td
                                        key={seat}
                                        className="p-2 border text-center"
                                      >
                                        <span>{s.playerScore}</span>
                                        <div className="mt-1 flex gap-1 justify-center">
                                          {s.isMin && (
                                            <Tag color="red">MIN</Tag>
                                          )}
                                          {s.isMax && (
                                            <Tag color="blue">MAX</Tag>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ))}
          </Card>
        ))
      )}
    </div>
  );
};

export default ContestResultManager;
