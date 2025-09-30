"use client";
import { Button, Card, Space } from "antd";
import { TrophyOutlined } from "@ant-design/icons";

const CompareHeader = ({
  categoryTitle,
  gradeTitle,
  compareIndex,
  onCancel,
  onClose,
}) => {
  return (
    <Card className="mb-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <TrophyOutlined className="text-2xl text-white" />
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
            <span className="text-xl font-bold">
              {categoryTitle} - {gradeTitle}
            </span>
            <span className="text-lg font-semibold text-blue-600">
              {compareIndex}차 비교심사 설정
            </span>
          </div>
        </div>
        <Space>
          <Button danger onClick={onCancel}>
            비교심사취소
          </Button>
          <Button onClick={onClose}>닫기</Button>
        </Space>
      </div>
    </Card>
  );
};

export default CompareHeader;
