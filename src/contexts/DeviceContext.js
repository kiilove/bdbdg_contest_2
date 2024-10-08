import React, { createContext, useContext } from "react";
import { useMediaQuery } from "react-responsive";

const DeviceContext = createContext();

export const useDevice = () => useContext(DeviceContext);

export const DeviceProvider = ({ children }) => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1024 });
  const isTabletOrMobile = isMobile || isTablet;

  return (
    <DeviceContext.Provider value={{ isMobile, isTablet, isTabletOrMobile }}>
      {children}
    </DeviceContext.Provider>
  );
};
