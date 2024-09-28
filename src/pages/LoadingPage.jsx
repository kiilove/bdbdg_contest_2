import React from "react";
import { ThreeDots } from "react-loader-spinner";

const LoadingPage = (propStyles) => {
  return (
    <div className="w-full h-full flex justify-center items-center">
      <ThreeDots
        height={propStyles.height || "40"}
        width={propStyles.width || "60"}
        radius="9"
        color="#4b7fdf"
        ariaLabel="three-dots-loading"
        wrapperStyle={{}}
        wrapperClassName=""
        visible={true}
      />
    </div>
  );
};

export default LoadingPage;
