"use client";
import { Button, Space } from "antd";

const VoteTargetSelector = ({ disabled, value, compareIndex, onChange }) => {
  return (
    <div className="flex w-full h-auto px-5 py-2 flex-col md:flex-row gap-2">
      <div className="flex h-auto justify-start items-center font-semibold min-w-[230px]">
        투표대상 설정
      </div>
      <Space wrap>
        <Button
          type={value === "all" ? "primary" : "default"}
          disabled={disabled}
          onClick={() => !disabled && onChange("all")}
          className="min-w-[120px]"
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
          해당체급 전체
        </Button>
        <Button
          type={value === "voted" ? "primary" : "default"}
          disabled={disabled}
          onClick={() => !disabled && onChange("voted")}
          className="min-w-[120px]"
          style={
            disabled && value === "voted"
              ? {
                  backgroundColor: "#1890ff",
                  borderColor: "#1890ff",
                  color: "white",
                  opacity: 0.7,
                }
              : {}
          }
        >
          {compareIndex - 1}차 선발인원만
        </Button>
      </Space>
    </div>
  );
};

export default VoteTargetSelector;
