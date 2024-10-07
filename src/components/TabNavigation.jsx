import React from "react";

const TabNavigation = ({ tabs, currentTab, onTabChange }) => (
  <div className="flex w-full">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        className={`h-14 rounded-t-lg transition-colors duration-300 ${
          currentTab === tab.id ? "bg-blue-400 text-white" : "bg-gray-100"
        }`}
        style={{ width: "100px" }}
        onClick={() => onTabChange(tab.id)}
      >
        {tab.title}
      </button>
    ))}
  </div>
);

export default TabNavigation;
