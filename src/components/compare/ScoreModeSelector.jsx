"use client";
import { Button, Space, Alert } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";

const ScoreModeSelector = ({ disabled, compareIndex, value, onChange }) => {
  const getHelpMessage = () => {
    if (value === "all") {
      return "출전선수 전원 채점을 완료해야합니다.";
    }
    if (value === "topOnly") {
      return "비교심사 대상만 채점합니다. 나머지 선수는 순위외 처리됩니다.";
    }
    if (value === "topWithSub") {
      return "이전 차수 비교심사 대상 전체를 채점합니다.";
    }
    return null;
  };

  return (
    <div className="flex w-full h-auto px-5 py-2 flex-col gap-2">
      <div className="flex flex-col md:flex-row gap-2">
        <div className="flex h-auto justify-start items-center font-semibold min-w-[230px]">
          채점모드 설정
        </div>
        <Space wrap>
          <Button
            type={value === "all" ? "primary" : "default"}
            disabled={disabled}
            onClick={() => !disabled && onChange("all")}
            className="min-w-[80px]"
            style={
              disabled && value === "all"
                ? {
                    backgroundColor: "#1890ff",
                    borderColor: "#1890ff",
                    color: "white",
                    opacity: 0.7,
                  }
                : {}
            }
          >
            전체
          </Button>
          {compareIndex > 1 && (
            <Button
              type={value === "topWithSub" ? "primary" : "default"}
              disabled={disabled}
              onClick={() => !disabled && onChange("topWithSub")}
              className="min-w-[100px]"
              style={
                disabled && value === "topWithSub"
                  ? {
                      backgroundColor: "#1890ff",
                      borderColor: "#1890ff",
                      color: "white",
                      opacity: 0.7,
                    }
                  : {}
              }
            >
              {compareIndex - 1}차 전체
            </Button>
          )}
          <Button
            type={value === "topOnly" ? "primary" : "default"}
            disabled={disabled}
            onClick={() => !disabled && onChange("topOnly")}
            className="min-w-[80px]"
            style={
              disabled && value === "topOnly"
                ? {
                    backgroundColor: "#1890ff",
                    borderColor: "#1890ff",
                    color: "white",
                    opacity: 0.7,
                  }
                : {}
            }
          >
            대상자
          </Button>
        </Space>
      </div>
      {!disabled && getHelpMessage() && (
        <div className="md:ml-[230px]">
          <Alert
            message={getHelpMessage()}
            type="info"
            icon={<InfoCircleOutlined />}
            showIcon
            className="text-sm"
          />
        </div>
      )}
    </div>
  );
};

export default ScoreModeSelector;
