// components/NoRegistrationCategories.js
import React from "react";
import { Card } from "antd";

const NoRegistrationCategories = ({ categories }) => (
  <Card title="신청자가 없는 카테고리 목록" className="mb-4">
    <ul className="list-disc list-inside">
      {categories.map((item) => (
        <li key={item.category}>{item.category}</li>
      ))}
    </ul>
  </Card>
);

export default NoRegistrationCategories;
