import React, { createContext, useEffect, useState } from "react";

export const CurrentContestContext = createContext();

export const CurrentContestProvider = ({ children }) => {
  const [currentContest, setCurrentContest] = useState(() => {
    try {
      const storedContest = sessionStorage.getItem("currentContest");
      if (storedContest) {
        const parsed = JSON.parse(storedContest);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      }
      const localContest = localStorage.getItem("currentContest");
      if (localContest) {
        const parsedLocal = JSON.parse(localContest);
        if (parsedLocal && typeof parsedLocal === "object" && parsedLocal?.contests?.id) {
          sessionStorage.setItem("currentContest", JSON.stringify(parsedLocal));
          return parsedLocal;
        }
      }
    } catch (error) {
      console.error("currentContest 스토리지 복원 오류:", error);
    }
    return null;
  });

  // currentContest가 변경될 때마다 sessionStorage에 저장
  useEffect(() => {
    try {
      if (currentContest) {
        sessionStorage.setItem("currentContest", JSON.stringify(currentContest));
      }
    } catch (error) {
      console.error("currentContest 스토리지 저장 오류:", error);
    }
  }, [currentContest]);

  return (
    <CurrentContestContext.Provider
      value={{ currentContest, setCurrentContest }}
    >
      {children}
    </CurrentContestContext.Provider>
  );
};
