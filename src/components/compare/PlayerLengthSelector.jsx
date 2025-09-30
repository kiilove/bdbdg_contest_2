"use client";
import { Button, Space, InputNumber } from "antd";

const PlayerLengthSelector = ({
  disabled,
  candidates,
  isCustom,
  value,
  onPick,
  onToggleCustom,
  onCustomChange,
}) => {
  return (
    <div className="flex w-full h-auto px-5 py-2 flex-col md:flex-row gap-2">
      <div className="flex h-auto justify-start items-center font-semibold min-w-[230px]">
        심사대상 인원수 설정
      </div>
      <Space wrap>
        {candidates >= 3 && (
          <Button
            type={value === 3 && !isCustom ? "primary" : "default"}
            disabled={disabled}
            onClick={() => !disabled && onPick(3)}
            className="min-w-[80px]"
            style={
              disabled && value === 3 && !isCustom
                ? {
                    backgroundColor: "#1890ff",
                    borderColor: "#1890ff",
                    color: "white",
                    opacity: 0.7,
                  }
                : {}
            }
          >
            TOP 3
          </Button>
        )}
        {candidates >= 5 && (
          <Button
            type={value === 5 && !isCustom ? "primary" : "default"}
            disabled={disabled}
            onClick={() => !disabled && onPick(5)}
            className="min-w-[80px]"
            style={
              disabled && value === 5 && !isCustom
                ? {
                    backgroundColor: "#1890ff",
                    borderColor: "#1890ff",
                    color: "white",
                    opacity: 0.7,
                  }
                : {}
            }
          >
            TOP 5
          </Button>
        )}
        {candidates >= 7 && (
          <Button
            type={value === 7 && !isCustom ? "primary" : "default"}
            disabled={disabled}
            onClick={() => !disabled && onPick(7)}
            className="min-w-[80px]"
            style={
              disabled && value === 7 && !isCustom
                ? {
                    backgroundColor: "#1890ff",
                    borderColor: "#1890ff",
                    color: "white",
                    opacity: 0.7,
                  }
                : {}
            }
          >
            TOP 7
          </Button>
        )}
        <Button
          type={isCustom ? "primary" : "default"}
          disabled={disabled}
          onClick={() => !disabled && onToggleCustom()}
          style={
            disabled && isCustom
              ? {
                  backgroundColor: "#1890ff",
                  borderColor: "#1890ff",
                  color: "white",
                  opacity: 0.7,
                }
              : {}
          }
        >
          직접입력
        </Button>
        {isCustom && (
          <InputNumber
            min={1}
            max={candidates}
            disabled={disabled}
            onChange={(n) => Number.isFinite(n) && onCustomChange(n)}
            className="w-[100px]"
            placeholder="인원수"
          />
        )}
      </Space>
    </div>
  );
};

export default PlayerLengthSelector;
