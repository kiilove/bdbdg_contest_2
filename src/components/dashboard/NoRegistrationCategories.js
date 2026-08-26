import React from "react";
import { Card, Empty, Tag } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";

const NoRegistrationCategories = ({ categories }) => {
  const items = categories || [];

  return (
    <Card
      title={
        <div className="flex items-center gap-2 text-slate-800">
          <ExclamationCircleOutlined className="text-orange-500" />
          <span>신청자가 없는 종목 / 체급</span>
          <span className="text-xs font-normal text-slate-500">
            (그랑프리 제외)
          </span>
        </div>
      }
      className="mb-4 shadow-sm border border-slate-200"
    >
      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="모든 종목에 참가 신청자가 등록되어 있습니다."
        />
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {items.map((item) => {
            const noRegGrades = (item.grades || []).filter(
              (g) => g.playerCount === 0
            );

            return (
              <div
                key={item.contestCategoryId}
                className="p-2.5 rounded-lg bg-slate-50 border border-slate-200"
              >
                <div className="font-bold text-slate-800 text-sm flex items-center justify-between">
                  <span>{item.contestCategoryTitle}</span>
                  <Tag color="orange" className="mr-0 font-semibold">
                    0명
                  </Tag>
                </div>
                {noRegGrades.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 pl-2 border-l-2 border-orange-300">
                    {noRegGrades.map((g) => (
                      <span
                        key={g.contestGradeId}
                        className="text-xs px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200"
                      >
                        {g.contestGradeTitle}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default NoRegistrationCategories;
