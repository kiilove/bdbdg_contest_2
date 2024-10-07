import React, { useState } from "react";
import { MdOutlineSearch } from "react-icons/md";

const SearchBar = ({ onSearch }) => {
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = () => {
    onSearch(searchValue.trim());
  };

  return (
    <div
      className="flex items-center bg-gray-100 rounded-lg p-2"
      style={{ height: "50px" }}
    >
      <MdOutlineSearch className="text-2xl text-gray-600 mr-3" />
      <input
        type="text"
        placeholder="검색(이름, 전화번호, 소속)"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        className="flex-grow outline-none py-1 px-2"
        style={{
          maxWidth: "60%",
          height: "40px", // Set the height to match the button
        }}
      />
      <button
        onClick={handleSearch}
        className="bg-blue-200 p-2 ml-2 rounded"
        style={{
          width: "80px", // Fixed width for the button
          height: "40px", // Set the height to match the input
        }}
      >
        검색
      </button>
    </div>
  );
};

export default SearchBar;
