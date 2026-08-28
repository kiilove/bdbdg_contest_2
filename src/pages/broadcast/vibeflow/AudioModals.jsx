import React from "react";
import { Modal, Button, Input, Tag } from "antd";
import {
  CustomerServiceOutlined,
  CodeOutlined,
  BookOutlined,
} from "@ant-design/icons";

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
      {/* 🔐 로그인 모달 */}
      <Modal
        open={isLoginModalOpen}
        onCancel={() => setIsLoginModalOpen(false)}
        footer={null}
        width={420}
        centered
        destroyOnClose
      >
        <form onSubmit={handleLogin} className="space-y-4 pt-2">
          <div className="text-center space-y-1 pb-3 border-b border-slate-100">
            <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl shadow-xs mb-2">
              <CustomerServiceOutlined />
            </div>
            <h2 className="text-lg font-bold text-slate-900 m-0">
              VibeFlows 계정 로그인
            </h2>
            <p className="text-xs text-slate-500 m-0">
              VibeFlows 계정으로 인증하여 공식 대회 음원 목록을 가져옵니다.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                이메일 계정
              </label>
              <Input
                type="email"
                size="large"
                placeholder="example@vibeflows.net"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                비밀번호
              </label>
              <Input.Password
                size="large"
                placeholder="비밀번호 입력"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => setRememberLogin(e.target.checked)}
                  className="rounded"
                />
                <span>로그인 정보 로컬에 저장 (24시간 동안 유지)</span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={isLoggingIn}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold"
            >
              {isLoggingIn ? "인증 확인 중..." : "로그인 및 음원 로드"}
            </Button>
          </div>

          <div className="text-[11px] text-slate-400 text-center">
            🔒 토큰은 브라우저 로컬 스토리지에 안전하게 보관됩니다.
          </div>
        </form>
      </Modal>

      {/* 🔍 API Raw JSON 검사 모달 */}
      <Modal
        open={isRawModalOpen}
        onCancel={() => setIsRawModalOpen(false)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setIsRawModalOpen(false)}
            className="bg-indigo-600 rounded-lg font-bold"
          >
            닫기
          </Button>,
        ]}
        width={700}
        centered
        title={
          <span className="font-bold flex items-center gap-2 text-slate-900">
            <CodeOutlined className="text-indigo-600" />
            <span>VibeFlows API 응답 원본 (Raw JSON)</span>
          </span>
        }
      >
        <div className="space-y-2 pt-2">
          <div className="text-xs text-slate-500 font-mono">
            엔드포인트: GET https://api.vibeflows.net/playlist/contest-songs
          </div>
          <pre className="bg-slate-900 p-4 rounded-xl text-xs font-mono text-emerald-400 max-h-[420px] overflow-y-auto select-text">
            {JSON.stringify(rawApiResponse, null, 2)}
          </pre>
        </div>
      </Modal>

      {/* 📖 매칭 가이드 모달 */}
      <Modal
        open={isGuideModalOpen}
        onCancel={() => setIsGuideModalOpen(false)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setIsGuideModalOpen(false)}
            className="bg-indigo-600 rounded-lg font-bold"
          >
            확인
          </Button>,
        ]}
        width={640}
        centered
        title={
          <span className="font-bold flex items-center gap-2 text-slate-900">
            <BookOutlined className="text-indigo-600" />
            <span>스마트 오토파일럿 & 시드 매칭 시스템 안내</span>
          </span>
        }
      >
        <div className="space-y-3.5 pt-2 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-100 text-indigo-900">
            <span className="font-black">💡 스마트 오토파일럿(Smart Autopilot)이란?</span>
            <p className="mt-1 m-0">
              계측/진행석에서 무대(종목/체급)를 넘기면, 해당 무대에 최적화된 경기 음악을 자동으로 찾아 무중단 듀얼 데크로 연속 교차 재생해 주는 지능형 방송 엔진입니다.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Tag color="green">시드 1: 정밀 매칭</Tag>
              <span>현재 무대의 [종목 + 세부 체급]이 완벽히 일치하는 음원 풀</span>
            </div>
            <p className="pl-2 m-0 text-slate-500">
              선수들이 무대에 입장했을 때 가장 먼저 재생되는 최우선 맞춤 경기 음악입니다.
            </p>

            <div className="font-bold text-slate-800 flex items-center gap-1.5 pt-1">
              <Tag color="blue">시드 2: 확장 매칭</Tag>
              <span>동일 성별 & 동일 종목의 다른 체급 및 공통 음원 풀</span>
            </div>
            <p className="pl-2 m-0 text-slate-500">
              시드 1의 곡이 모두 소진되었을 때, 같은 분위기와 종목 템포를 유지하기 위해 확장 매칭되는 보조 음원 풀입니다.
            </p>

            <div className="font-bold text-slate-800 flex items-center gap-1.5 pt-1">
              <Tag color="purple">자체 특별 연출 음원</Tag>
              <span>국민의례, 시상식, 대기, 쉬는시간 전용 독립 BGM</span>
            </div>
            <p className="pl-2 m-0 text-slate-500">
              대회 경기 흐름과 독립적으로 운영되며, 탭별로 지정된 페이드 시간 및 연속 재생 규칙에 맞춰 안전하게 재생됩니다.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};
