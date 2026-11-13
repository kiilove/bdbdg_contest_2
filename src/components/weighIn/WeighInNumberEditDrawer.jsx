import React from "react";
import { Drawer, Button, InputNumber, Input } from "antd";
import { Pencil } from "lucide-react";

const WeighInNumberEditDrawer = ({
  open,
  onClose,
  editValues,
  setEditValues,
  onApply,
}) => {
  return (
    <Drawer
      placement="right"
      width={440}
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-[#171717]">
          <Pencil size={16} strokeWidth={1.5} className="text-[#525252]" />
          <span className="text-sm font-semibold">
            선수 번호 · 순서 · 신장/체중 수정
          </span>
        </div>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>취소</Button>
          <Button type="primary" onClick={onApply}>
            적용
          </Button>
        </div>
      }
      destroyOnClose
    >
      <div className="flex flex-col gap-3.5 py-2">
        <div className="flex items-center justify-between text-sm text-[#525252] bg-[#f4f4f5] px-3.5 py-2.5 rounded-[8px] border border-[#171717]/[0.08]">
          <span>선수 성명</span>
          <span className="font-semibold text-[#171717]">
            {editValues.playerName}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#525252]">
            배부 번호표 (playerNumber)
          </span>
          <InputNumber
            min={1}
            value={editValues.playerNumber}
            onChange={(v) =>
              setEditValues((prev) => ({ ...prev, playerNumber: v }))
            }
            className="w-40 h-9 rounded-[8px] font-mono tabular-nums"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#525252]">
            표시 순서 (playerIndex)
          </span>
          <InputNumber
            min={1}
            value={editValues.playerIndex}
            onChange={(v) =>
              setEditValues((prev) => ({ ...prev, playerIndex: v }))
            }
            className="w-40 h-9 rounded-[8px] font-mono tabular-nums"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#525252]">
            신장 / 체중 (cm / kg)
          </span>
          <div className="flex items-center gap-1.5">
            <div className="relative flex items-center">
              <Input
                value={editValues.height}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    height: e.target.value,
                  }))
                }
                placeholder="신장"
                className="w-24 h-9 rounded-[8px] text-xs font-mono tabular-nums pr-6 text-center"
              />
              <span className="absolute right-2 text-[11px] text-[#737373] pointer-events-none">
                cm
              </span>
            </div>
            <span className="text-[#737373] text-xs">/</span>
            <div className="relative flex items-center">
              <Input
                value={editValues.weight}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    weight: e.target.value,
                  }))
                }
                placeholder="체중"
                className="w-24 h-9 rounded-[8px] text-xs font-mono tabular-nums pr-6 text-center"
              />
              <span className="absolute right-2 text-[11px] text-[#737373] pointer-events-none">
                kg
              </span>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
};

export default WeighInNumberEditDrawer;
