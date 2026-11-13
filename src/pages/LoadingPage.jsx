import React from "react";
import { ThreeDots } from "react-loader-spinner";

const LoadingPage = (propStyles = {}) => {
  return (
    <div className="w-full h-full flex justify-center items-center py-4">
      <ThreeDots
        height={propStyles.height || "32"}
        width={propStyles.width || "48"}
        radius="6"
        color="#737373"
        ariaLabel="loading"
        wrapperStyle={{}}
        wrapperClassName=""
        visible={true}
      />
    </div>
  );
};

export default LoadingPage;
