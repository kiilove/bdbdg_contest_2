// components/NoRegistrationCategories.js
import React from "react";
import { Card } from "antd";

const NoRegistrationCategories = ({ categories }) => {
  console.log(categories);
  return (
    <Card title="신청자가 없는 종목 목록" className="mb-4">
      <ul className="list-disc list-inside">
        {categories.map((item) => (
          <li key={item.contestCategoryId}>{item.contestCategoryTitle}</li>
        ))}
      </ul>
    </Card>
  );
};

export default NoRegistrationCategories;
