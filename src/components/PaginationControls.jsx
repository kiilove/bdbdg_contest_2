import React from "react";

const PaginationControls = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
}) => (
  <div className="flex justify-between mt-4 items-center">
    <div className="flex items-center">
      <span className="mr-2">페이지 당 목록:</span>
      <select
        value={itemsPerPage}
        onChange={onItemsPerPageChange}
        className="px-2 py-1 border rounded"
      >
        <option value={5}>5</option>
        <option value={10}>10</option>
        <option value={20}>20</option>
      </select>
    </div>
    <div>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-1 border rounded ${
            currentPage === page ? "bg-blue-500 text-white" : "bg-white"
          }`}
        >
          {page}
        </button>
      ))}
    </div>
  </div>
);

export default PaginationControls;
