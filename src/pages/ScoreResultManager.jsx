import React, { useEffect, useState, useContext, useRef } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { RefreshCw, Trash2 } from "lucide-react";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import BibTag from "../components/ui/BibTag";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const ScoreResultManager = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});
  const confirmActionRef = useRef(null);

  const openNotice = (config, onConfirm = null) => {
    confirmActionRef.current = onConfirm;
    setModalMessage({ isButton: true, confirmButtonText: "확인", ...config });
    setModalOpen(true);
  };

  const fetchScores = async () => {
    if (!currentContest?.contests?.collectionName) return;
    setLoading(true);
    try {
      const colRef = collection(db, currentContest.contests.collectionName);
      const snapshot = await getDocs(colRef);
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setScores(data);
    } catch (err) {
      console.error("채점 결과 불러오기 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    const target = scores.find((s) => s.id === id);
    openNotice(
      {
        variant: "danger",
        title: "심판 채점 원표 삭제",
        body: "선택한 심판 채점 결과를 삭제하시겠습니까?",
        body2: target
          ? `#${target.playerNumber || "-"} ${target.playerName || ""} · ${target.seatIndex || "-"}번 심판 (${target.playerScore ?? "-"}점)`
          : "삭제된 채점 데이터는 복구할 수 없습니다.",
        isCancelButton: true,
        confirmButtonText: "삭제",
        cancelButtonText: "취소",
      },
      async () => {
        setModalOpen(false);
        try {
          await deleteDoc(doc(db, currentContest.contests.collectionName, id));
          setScores((prev) => prev.filter((item) => item.id !== id));
          openNotice({
            variant: "success",
            title: "삭제 완료",
            body: "선택한 채점 원표가 삭제되었습니다.",
          });
        } catch (err) {
          console.error("삭제 중 오류:", err);
          openNotice({
            variant: "error",
            title: "삭제 오류",
            body: "채점 결과 삭제 중 오류가 발생했습니다.",
          });
        }
      }
    );
  };

  const buildHierarchy = (data) => {
    const grouped = {};
    data.forEach((item) => {
      const cat = item.categoryTitle || "기타";
      const grade = item.gradeTitle || "기타";
      const playerKey = `${item.playerNumber || 0} ${item.playerName || ""}`;
      if (!grouped[cat]) grouped[cat] = {};
      if (!grouped[cat][grade]) grouped[cat][grade] = {};
      if (!grouped[cat][grade][playerKey]) grouped[cat][grade][playerKey] = [];
      grouped[cat][grade][playerKey].push(item);
    });

    Object.keys(grouped).forEach((cat) =>
      Object.keys(grouped[cat]).forEach((grade) =>
        Object.keys(grouped[cat][grade]).forEach((player) => {
          grouped[cat][grade][player].sort(
            (a, b) => (a.seatIndex || 0) - (b.seatIndex || 0)
          );
        })
      )
    );

    return grouped;
  };

  const hierarchy = buildHierarchy(scores);
  const categoryKeys = Object.keys(hierarchy).sort((a, b) =>
    a.localeCompare(b)
  );
  const getGrades = (cat) =>
    Object.keys(hierarchy[cat]).sort((a, b) => a.localeCompare(b));
  const getPlayers = (cat, grade) =>
    Object.keys(hierarchy[cat][grade]).sort((a, b) => {
      const numA = parseInt(a.split(" ")[0], 10) || 0;
      const numB = parseInt(b.split(" ")[0], 10) || 0;
      return numA - numB;
    });

  useEffect(() => {
    fetchScores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests?.collectionName]);

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
      <div className="max-w-[1440px] mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              채점 결과 관리
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              {currentContest?.contestInfo?.contestTitle || "선택된 대회 없음"} ·
              종목·체급·선수별 심판 채점 원표를 확인하고 정리합니다
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-mono tabular-nums text-[#737373]">
              총 {scores.length}건
            </span>
            <button
              type="button"
              onClick={fetchScores}
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
          </div>
        </header>

        {loading ? (
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-12 text-center text-[13px] text-[#737373]">
            채점 결과를 불러오는 중입니다
          </div>
        ) : scores.length === 0 ? (
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-12 text-center text-[13px] text-[#737373]">
            저장된 채점 결과가 없습니다
          </div>
        ) : (
          <div className="space-y-6">
            {categoryKeys.map((cat) => (
              <section
                key={cat}
                className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-6"
              >
                <div className="border-b border-[#171717]/[0.08] pb-3 flex items-center justify-between">
                  <h2 className="text-[16px] font-medium text-[#171717]">
                    {cat}
                  </h2>
                  <span className="text-[12px] font-mono tabular-nums text-[#737373]">
                    {getGrades(cat).length}체급
                  </span>
                </div>

                <div className="space-y-6">
                  {getGrades(cat).map((grade) => (
                    <div key={grade} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#2563eb]/[0.08] text-[#2563eb] text-[12px] font-medium">
                          체급
                        </span>
                        <h3 className="text-[14px] font-medium text-[#171717]">
                          {grade}
                        </h3>
                      </div>

                      <div className="space-y-3 pl-0 sm:pl-3">
                        {getPlayers(cat, grade).map((playerKey) => {
                          const spaceIdx = playerKey.indexOf(" ");
                          const pNum =
                            spaceIdx !== -1
                              ? playerKey.slice(0, spaceIdx)
                              : playerKey;
                          const pName =
                            spaceIdx !== -1 ? playerKey.slice(spaceIdx + 1) : "";

                          return (
                            <div
                              key={playerKey}
                              className="rounded-[8px] border border-[#171717]/[0.08] overflow-hidden"
                            >
                              <div className="bg-[#f4f4f5] px-3.5 py-2 border-b border-[#171717]/[0.08] flex items-center gap-2">
                                <BibTag number={pNum} prefix="#" size="sm" />
                                <span className="text-[13px] font-medium text-[#171717]">
                                  {pName || "-"}
                                </span>
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
                                      <th className="px-3 font-medium text-center w-16">
                                        관리
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#171717]/[0.06]">
                                    {hierarchy[cat][grade][playerKey].map(
                                      (score) => (
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
                                          <td className="px-3 py-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleDelete(score.id)
                                              }
                                              aria-label="채점 삭제"
                                              className="h-8 w-8 rounded-[6px] inline-flex items-center justify-center text-[#dc2626] hover:bg-[#dc2626]/[0.08] transition-colors duration-150"
                                            >
                                              <Trash2
                                                size={15}
                                                strokeWidth={1.5}
                                              />
                                            </button>
                                          </td>
                                        </tr>
                                      )
                                    )}
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

export default ScoreResultManager;
