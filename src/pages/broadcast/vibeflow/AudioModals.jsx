import React from "react";
import { Modal, Input } from "antd";
import { Radio, Code, BookOpen, Lock } from "lucide-react";

export const AudioModals = ({
  isLoginModalOpen,
  setIsLoginModalOpen,
  handleLogin,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  rememberLogin,
  setRememberLogin,
  isLoggingIn,
  isRawModalOpen,
  setIsRawModalOpen,
  rawApiResponse,
  isGuideModalOpen,
  setIsGuideModalOpen,
}) => {
  return (
    <>
      <Modal
        open={isLoginModalOpen}
        onCancel={() => setIsLoginModalOpen(false)}
        footer={null}
        width={420}
        centered
        destroyOnClose
      >
        <form onSubmit={handleLogin} className="space-y-4 pt-2 text-[#ededed]">
          <div className="space-y-1.5 pb-4 border-b border-[#ededed]/[0.08]">
            <div className="w-10 h-10 rounded-[8px] bg-[#19191b] border border-[#ededed]/[0.08] text-[#a1a1a6] flex items-center justify-center mb-3">
              <Radio size={18} strokeWidth={1.5} />
            </div>
            <h2 className="text-[18px] leading-6 font-medium text-[#ededed] m-0">
              VibeFlows 계정 로그인
            </h2>
            <p className="text-xs text-[#a1a1a6] m-0">
              계정을 인증하여 공식 대회 음원 목록을 동기화합니다
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[#a1a1a6] block mb-1.5">
                이메일 계정
              </label>
              <Input
                type="email"
                size="large"
                placeholder="example@vibeflows.net"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[#a1a1a6] block mb-1.5">
                비밀번호
              </label>
              <Input.Password
                size="large"
                placeholder="비밀번호 입력"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[#a1a1a6]">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => setRememberLogin(e.target.checked)}
                  className="rounded accent-[#2563eb]"
                />
                <span>로그인 세션 로컬 유지 (24시간)</span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-11 rounded-[8px] bg-[#ededed] hover:bg-white text-[#141415] text-[13px] font-medium cursor-pointer transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoggingIn ? "인증 확인 중" : "로그인 및 음원 로드"}
            </button>
          </div>

          <div className="text-xs text-[#85858b] flex items-center justify-center gap-1.5">
            <Lock size={14} strokeWidth={1.5} />
            <span>인증 토큰은 브라우저 로컬 스토리지에 보관됩니다</span>
          </div>
        </form>
      </Modal>

      <Modal
        open={isRawModalOpen}
        onCancel={() => setIsRawModalOpen(false)}
        footer={
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsRawModalOpen(false)}
              className="h-9 px-4 rounded-[8px] bg-[#ededed] hover:bg-white text-[#141415] text-xs font-medium cursor-pointer transition-colors duration-150"
            >
              닫기
            </button>
          </div>
        }
        width={700}
        centered
        title={
          <span className="font-medium text-[15px] flex items-center gap-2 text-[#ededed]">
            <Code size={18} strokeWidth={1.5} className="text-[#85858b]" />
            <span>VibeFlows API 응답 원본 (JSON)</span>
          </span>
        }
      >
        <div className="space-y-3 pt-2">
          <div className="text-xs text-[#85858b] font-mono">
            GET https://api.vibeflows.net/playlist/contest-songs
          </div>
          <pre className="bg-[#0f0f10] border border-[#ededed]/[0.08] p-4 rounded-[8px] text-xs font-mono text-[#ededed] max-h-[420px] overflow-y-auto select-text m-0">
            {JSON.stringify(rawApiResponse, null, 2)}
          </pre>
        </div>
      </Modal>

      <Modal
        open={isGuideModalOpen}
        onCancel={() => setIsGuideModalOpen(false)}
        footer={
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsGuideModalOpen(false)}
              className="h-9 px-4 rounded-[8px] bg-[#ededed] hover:bg-white text-[#141415] text-xs font-medium cursor-pointer transition-colors duration-150"
            >
              확인
            </button>
          </div>
        }
        width={640}
        centered
        title={
          <span className="font-medium text-[15px] flex items-center gap-2 text-[#ededed]">
            <BookOpen size={18} strokeWidth={1.5} className="text-[#85858b]" />
            <span>스마트 오토파일럿 및 시드 매칭 안내</span>
          </span>
        }
      >
        <div className="space-y-4 pt-2 text-xs text-[#a1a1a6] leading-relaxed">
          <div className="p-3.5 bg-[#19191b] rounded-[8px] border border-[#ededed]/[0.08]">
            <div className="font-medium text-[#ededed] text-[13px]">
              스마트 오토파일럿 동작 원리
            </div>
            <p className="mt-1 m-0 text-[#a1a1a6]">
              진행석에서 무대(종목 및 체급)를 전환하면 해당 무대에 맞는 경기 음악을 자동으로 선별하여 듀얼 데크 크로스페이드로 연속 재생합니다.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-[#141415] rounded-[8px] border border-[#ededed]/[0.08] space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-[4px] bg-[#2563eb]/20 text-[#60a5fa] border border-[#2563eb]/35">
                  시드 1
                </span>
                <span className="font-medium text-[#ededed]">
                  현재 무대의 종목 및 세부 체급 일치 음원 풀
                </span>
              </div>
              <p className="m-0 text-[#85858b]">
                선수 입장 시 최우선으로 선택되는 종목별 맞춤 경기 음악입니다.
              </p>
            </div>

            <div className="p-3 bg-[#141415] rounded-[8px] border border-[#ededed]/[0.08] space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-[4px] bg-[#232325] text-[#ededed] border border-[#ededed]/[0.10]">
                  시드 2
                </span>
                <span className="font-medium text-[#ededed]">
                  동일 성별 및 동일 종목 확장 음원 풀
                </span>
              </div>
              <p className="m-0 text-[#85858b]">
                시드 1 음원이 모두 재생된 이후 동일 종목 템포를 유지하기 위해 연결되는 보조 풀입니다.
              </p>
            </div>

            <div className="p-3 bg-[#141415] rounded-[8px] border border-[#ededed]/[0.08] space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-[4px] bg-[#232325] text-[#a1a1a6] border border-[#ededed]/[0.10]">
                  특별 연출
                </span>
                <span className="font-medium text-[#ededed]">
                  국민의례, 내빈소개, 시상식, 대기, 휴식 독립 음원
                </span>
              </div>
              <p className="m-0 text-[#85858b]">
                무대 전환 시에도 자동 중단되지 않으며, 각 탭에 지정된 페이드 시간과 연속 재생 설정을 따릅니다.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
