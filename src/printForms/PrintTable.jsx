import React from "react";

const PrintTable = ({ data, columns, addEmptyRows, documentTitle }) => {
  return (
    <div className="w-full h-full">
      {documentTitle && (
        <div
          className="flex w-full mb-5 h-14 justify-center items-center bg-white border border-gray-400 rounded-md"
          style={{
            borderTopColor: "#cbd5e0",
            borderLeftColor: "#cbd5e0",
            borderBottomColor: "#4a5568",
            borderRightColor: "#4a5568",
          }}
        >
          <span className="text-lg font-semibold text-gray-800">
            {documentTitle}
          </span>
        </div>
      )}
      {data.map((category, cIdx) =>
        category.grades.map((grade, gIdx) => (
          <div
            key={`${cIdx}-${gIdx}`}
            className="mb-6 break-page"
            style={{ pageBreakInside: "avoid" }}
          >
            <h2 className="text-left font-bold text-lg mb-2 ml-4">
              {category.contestCategoryTitle || category.categoryTitle} /{" "}
              {grade.contestGradeTitle}
            </h2>
            <table
              className="w-full border-collapse border border-gray-400 text-center"
              style={{
                fontSize: "14px",
                marginBottom: "20px",
                borderRadius: "5px",
              }}
            >
              <thead>
                <tr className="bg-gray-300">
                  {columns.map((col) => (
                    <th
                      key={col.key || col.label}
                      className="border px-2 py-1"
                      style={{ width: col.width ? `${col.width}%` : "20%" }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grade.players.map((player, pIdx) => (
                  <tr key={pIdx} className="border-t">
                    {columns.map((col) => {
                      let cellContent;
                      if (col.key === "index") {
                        cellContent = pIdx + 1;
                      } else if (col.mergeKeys) {
                        cellContent = col.mergeKeys
                          .map((key) => player[key] || "")
                          .filter(Boolean)
                          .join(". ");
                      } else {
                        cellContent = col.forcedValue || player[col.key] || "";
                      }
                      return (
                        <td
                          key={col.key || col.label}
                          className="p-2 border"
                          style={{ width: col.width ? `${col.width}%` : "20%" }}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {addEmptyRows &&
                  [...Array(3)].map((_, idx) => (
                    <tr key={`empty-${idx}`} className="border-t">
                      {columns.map((col) => (
                        <td key={col.key || col.label} className="p-2 border">
                          &nbsp;
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
};

export default PrintTable;
