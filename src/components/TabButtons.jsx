// ../components/TabButtons.js
import React from "react";

const TabButtons = ({ currentSubTab, setCurrentSubTab }) => (
  <div className="flex w-full h-auto justify-start items-center">
    <button
      onClick={() => setCurrentSubTab("0")}
      className={`${
        currentSubTab === "0"
          ? "w-40 h-10 bg-blue-500 text-gray-100 rounded-t-lg"
          : "w-40 h-10 bg-white text-gray-700 rounded-t-lg border-t border-r"
      }`}
    >
      현재 무대상황
    </button>
    <button
      onClick={() => setCurrentSubTab("1")}
      className={`${
        currentSubTab === "1"
          ? "w-40 h-10 bg-blue-500 text-gray-100 rounded-t-lg"
          : "w-40 h-10 bg-white text-gray-700 rounded-t-lg border-t border-r"
      }`}
    >
      전체 무대목록
    </button>
  </div>
);

export default TabButtons;
