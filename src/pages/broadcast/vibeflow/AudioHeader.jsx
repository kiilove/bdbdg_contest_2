import React from "react";
import { Card, Typography, Tag, Button, Switch, Tooltip } from "antd";
import {
  CustomerServiceOutlined,
  CloudSyncOutlined,
  CodeOutlined,
  ReloadOutlined,
  LogoutOutlined,
  LoginOutlined,
} from "@ant-design/icons";

const { Title } = Typography;

export const AudioHeader = ({
  currentStageCategory,
  isRemoteSync,
  setIsRemoteSync,
  rawApiResponse,
  setIsRawModalOpen,
  isLoadingTracks,
  loadVibeFlowTracks,
  token,
  user,
  handleLogout,
  setIsLoginModalOpen,
}) => {
  return (
    <Card className="shadow-sm rounded-2xl border-slate-200 bg-white">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-2xl shadow-xs">
            <CustomerServiceOutlined />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Title
                level={4}
                style={{ margin: 0, fontWeight: 800, color: "#1e293b" }}
              >
                VibeFlows 공식 대회 음향 센터
              </Title>
              <Tag color="indigo" className="font-bold">
                Official API
              </Tag>
            </div>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              {currentStageCategory ? (
                <span className="text-indigo-600 font-bold">
                  🏆 현재 무대 진행 종목: [{currentStageCategory}]
                </span>
              ) : (
                "VibeFlows 클라우드 음원 실시간 스트리밍 및 무대 전광판 동기화"
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* 원격 무대 동기화 스위치 */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <CloudSyncOutlined
              className={
                isRemoteSync
                  ? "text-emerald-500 text-base"
                  : "text-slate-400 text-base"
              }
            />
            <span className="text-xs font-bold text-slate-700">
              무대 전광판 원격 동기화
            </span>
            <Switch
              checked={isRemoteSync}
              onChange={setIsRemoteSync}
              size="small"
            />
          </div>

          {/* API Raw Inspector 버튼 */}
          {rawApiResponse && (
            <Button
              icon={<CodeOutlined />}
              onClick={() => setIsRawModalOpen(true)}
              className="rounded-xl font-semibold text-xs border-slate-300"
            >
              API 응답 검사
            </Button>
          )}

          {/* 음원 리스트 새로고침 */}
          <Button
            icon={<ReloadOutlined spin={isLoadingTracks} />}
            loading={isLoadingTracks}
            onClick={() => loadVibeFlowTracks()}
            className="rounded-xl font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            음원 새로고침
          </Button>

          {/* 계정 로그인 / 로그아웃 */}
          {token ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-medium flex items-center justify-end gap-1">
                  <span>연결 계정</span>
                  <Tooltip title="보안을 위해 로그인 세션은 24시간 동안 유효하며, 24시간 후 자동 로그아웃됩니다.">
                    <Tag
                      color="cyan"
                      className="m-0 text-[9px] px-1 py-0 rounded font-bold cursor-help"
                    >
                      24시간 유효
                    </Tag>
                  </Tooltip>
                </div>
                <div className="text-xs font-bold text-indigo-600 truncate max-w-[150px]">
                  {user?.email || "VibeFlows Account"}
                </div>
              </div>
              <Button
                danger
                size="small"
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                className="rounded-lg text-xs font-semibold"
              >
                로그아웃
              </Button>
            </div>
          ) : (
            <Button
              type="primary"
              icon={<LoginOutlined />}
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold"
            >
              VibeFlows 로그인
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
