import React, { useRef, useState } from "react";
import LoadingPage from "../pages/LoadingPage";
import ReactToPrint from "react-to-print";

const ScalePrint = ({ setClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const printRef = useRef();
  return (
    <div className="w-full h-auto flex flex-col bg-gray-100 justify-start items-center overflow-auto">
      {isLoading && <LoadingPage />}
      {!isLoading && (
        <div>
          <div
            className="flex h-14 justify-end items-center gap-x-2"
            style={{ width: "210mm" }}
          >
            <ReactToPrint
              trigger={() => (
                <button className="w-40 h-10 bg-blue-300 rounded-lg">
                  집계표출력
                </button>
              )}
              content={() => printRef.current}
              pageStyle="@page { size: A4; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; box-shadow:none; } }"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ScalePrint;
