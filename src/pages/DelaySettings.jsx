import React, { useState, useEffect } from "react";
import { Save } from "lucide-react";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const DelaySettings = () => {
  const [rankingDelay, setRankingDelay] = useState(5);
  const [rankingFinalDelay, setRankingFinalDelay] = useState(5);
  const [pageDelay, setPageDelay] = useState(5);
  const [pageFinalDelay, setPageFinalDelay] = useState(5);
  const [scorePageDelay, setScorePageDelay] = useState(5);
  const [scoreFinalDelay, setScoreFinalDelay] = useState(5);
  const [playersToShow, setPlayersToShow] = useState(5);
  const [msgOpen, setMsgOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({});

  useEffect(() => {
    const savedRankingDelay = localStorage.getItem("rankingDelay") || 5;
    const savedRankingFinalDelay =
      localStorage.getItem("rankingFinalDelay") || 5;
    const savedPageDelay = localStorage.getItem("pageDelay") || 5;
    const savedPageFinalDelay = localStorage.getItem("pageFinalDelay") || 5;
    const savedScorePageDelay = localStorage.getItem("scorePageDelay") || 5;
    const savedScoreFinalDelay = localStorage.getItem("scoreFinalDelay") || 5;
    const savedPlayersToShow = localStorage.getItem("playersToShow") || 5;

    setRankingDelay(Number(savedRankingDelay));
    setRankingFinalDelay(Number(savedRankingFinalDelay));
    setPageDelay(Number(savedPageDelay));
    setPageFinalDelay(Number(savedPageFinalDelay));
    setScorePageDelay(Number(savedScorePageDelay));
    setScoreFinalDelay(Number(savedScoreFinalDelay));
    setPlayersToShow(Number(savedPlayersToShow));
  }, []);

  const handleSave = () => {
    localStorage.setItem("rankingDelay", rankingDelay);
    localStorage.setItem("rankingFinalDelay", rankingFinalDelay);
    localStorage.setItem("pageDelay", pageDelay);
    localStorage.setItem("pageFinalDelay", pageFinalDelay);
    localStorage.setItem("scorePageDelay", scorePageDelay);
    localStorage.setItem("scoreFinalDelay", scoreFinalDelay);
    localStorage.setItem("playersToShow", playersToShow);
    setModalMessage({
      variant: "success",
      title: "화면 전환 딜레이 저장 완료",
      body: "전광판 순위 공개 및 점수표 전환 시간 설정이 저장되었습니다.",
      isButton: true,
      confirmButtonText: "확인",
    });
    setMsgOpen(true);
  };

  const groups = [
    {
      step: "01",
      title: "1단계 · 순위 공개 애니메이션",
      items: [
        {
          label: "순위 공개 간격",
          desc: "개별 순위가 차례로 공개되는 사이의 대기 시간",
          value: rankingDelay,
          onChange: setRankingDelay,
          unit: "초",
        },
        {
          label: "최종 순위 공개 후 유지 시간",
          desc: "마지막 순위가 화면에 표시된 뒤 머무르는 시간",
          value: rankingFinalDelay,
          onChange: setRankingFinalDelay,
          unit: "초",
        },
        {
          label: "노출 선수 수",
          desc: "1단계 화면에서 한 번에 공개할 상위 선수 인원",
          value: playersToShow,
          onChange: setPlayersToShow,
          unit: "명",
        },
      ],
    },
    {
      step: "02",
      title: "2단계 · 전체 순위 페이지 전환",
      items: [
        {
          label: "페이지 전환 간격",
          desc: "전체 순위 목록 페이지가 넘어가는 주기",
          value: pageDelay,
          onChange: setPageDelay,
          unit: "초",
        },
        {
          label: "마지막 페이지 유지 시간",
          desc: "2단계 마지막 페이지에서 다음 단계로 넘어가기 전 대기 시간",
          value: pageFinalDelay,
          onChange: setPageFinalDelay,
          unit: "초",
        },
      ],
    },
    {
      step: "03",
      title: "3단계 · 상세 점수표 전환",
      items: [
        {
          label: "점수표 페이지 전환 간격",
          desc: "심판별 채점표 페이지가 전환되는 주기",
          value: scorePageDelay,
          onChange: setScorePageDelay,
          unit: "초",
        },
        {
          label: "마지막 점수표 유지 시간",
          desc: "점수표 마지막 화면에서 멈춰 있는 시간",
          value: scoreFinalDelay,
          onChange: setScoreFinalDelay,
          unit: "초",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <ConfirmationModal
        isOpen={msgOpen}
        message={modalMessage}
        onCancel={() => setMsgOpen(false)}
        onConfirm={() => setMsgOpen(false)}
      />
      <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              화면 전환 딜레이 설정
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              전광판 순위 발표 및 상세 채점표의 단계별 대기 시간을 설정합니다
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={handleSave}
              className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <Save size={16} strokeWidth={1.5} />
              <span>설정 저장</span>
            </button>
          </div>
        </header>

        <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          {groups.map((group) => (
            <section
              key={group.step}
              className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center gap-2.5 border-b border-[#171717]/[0.06] pb-3">
                <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.12] font-mono text-[11px] font-medium tabular-nums text-[#525252]">
                  {group.step}
                </span>
                <h2 className="text-[15px] font-medium text-[#171717]">
                  {group.title}
                </h2>
              </div>

              <div className="divide-y divide-[#171717]/[0.06]">
                {group.items.map((item) => (
                  <div
                    key={item.label}
                    className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <label className="block text-[14px] font-medium text-[#171717]">
                        {item.label}
                      </label>
                      <p className="text-[12px] text-[#737373]">{item.desc}</p>
                    </div>
                    <div className="relative flex items-center w-full sm:w-32 shrink-0">
                      <input
                        type="number"
                        min={1}
                        value={item.value}
                        onChange={(e) => item.onChange(e.target.value)}
                        className="w-full h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] pl-3 pr-8 text-right font-mono text-[14px] tabular-nums text-[#171717] focus:outline-none focus:border-[#2563eb] transition-colors duration-150"
                      />
                      <span className="absolute right-3 text-[12px] text-[#737373] pointer-events-none">
                        {item.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DelaySettings;
