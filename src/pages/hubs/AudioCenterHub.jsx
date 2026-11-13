import React from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { AudioWaveform, Volume2, Music, ExternalLink } from "lucide-react";
import VibeFlowAudioCenter from "../broadcast/VibeFlowAudioCenter";
import RealtimeAudioCenter from "../RealtimeAudioCenter";
import ContestMusicSetting from "../ContestMusicSetting";
import { useIsAdmin } from "./useHubAuth";

const AudioCenterHub = ({ defaultTab }) => {
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const inferredDefault =
    defaultTab ||
    (location.pathname === "/realtimeaudiocenter"
      ? "legacy"
      : location.pathname === "/contestmusicsetting"
      ? "setting"
      : "vibeflow");

  const rawTab = searchParams.get("tab") || inferredDefault;
  const activeTab =
    (rawTab === "legacy" || rawTab === "setting") && !isAdmin
      ? "vibeflow"
      : rawTab;

  return (
    <div className="w-full min-h-screen bg-[#fafafa]">
      <div className="no-print print:hidden bg-white border-b border-[#171717]/[0.08]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSearchParams({ tab: "vibeflow" })}
              className={`h-8 px-3 rounded-[8px] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer border-0 transition-colors ${
                activeTab === "vibeflow"
                  ? "bg-[#171717] text-white"
                  : "bg-transparent text-[#525252] hover:bg-[#f4f4f5]"
              }`}
            >
              <AudioWaveform size={14} strokeWidth={1.6} />
              <span>바이브플로우 음원센터 (표준)</span>
            </button>
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setSearchParams({ tab: "legacy" })}
                  className={`h-8 px-3 rounded-[8px] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer border-0 transition-colors ${
                    activeTab === "legacy"
                      ? "bg-[#171717] text-white"
                      : "bg-transparent text-[#525252] hover:bg-[#f4f4f5]"
                  }`}
                >
                  <Volume2 size={14} strokeWidth={1.6} />
                  <span>기존 음원 콘솔 (보조)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSearchParams({ tab: "setting" })}
                  className={`h-8 px-3 rounded-[8px] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer border-0 transition-colors ${
                    activeTab === "setting"
                      ? "bg-[#171717] text-white"
                      : "bg-transparent text-[#525252] hover:bg-[#f4f4f5]"
                  }`}
                >
                  <Music size={14} strokeWidth={1.6} />
                  <span>대회 음원 기본설정</span>
                </button>
              </>
            )}
          </div>

          <a
            href="/vibeflow-audio"
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 px-2.5 rounded-[6px] bg-[#fafafa] hover:bg-[#f4f4f5] border border-[#171717]/[0.08] text-xs text-[#525252] hover:text-[#171717] no-underline inline-flex items-center gap-1 transition-colors"
          >
            <span>음원 콘솔 단독 새 창</span>
            <ExternalLink size={11} strokeWidth={1.6} />
          </a>
        </div>
      </div>

      {activeTab === "legacy" && isAdmin ? (
        <RealtimeAudioCenter />
      ) : activeTab === "setting" && isAdmin ? (
        <ContestMusicSetting />
      ) : (
        <VibeFlowAudioCenter />
      )}
    </div>
  );
};

export default AudioCenterHub;
