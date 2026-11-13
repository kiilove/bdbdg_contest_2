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
        if (
          parsedLocal &&
          typeof parsedLocal === "object" &&
          parsedLocal?.contests?.id
        ) {
          sessionStorage.setItem("currentContest", JSON.stringify(parsedLocal));
          return parsedLocal;
        }
      }
    } catch (error) {
      console.error("currentContest 스토리지 복원 오류:", error);
    }
    return null;
  });

  // currentContest 변경 시 sessionStorage 및 localStorage 동기화
  // -> rel="noopener" 새 탭 콘솔(/mc, /vibeflow-audio 등)에서도 항상 최신 대회를 즉시 상속받도록 보장
  useEffect(() => {
    try {
      if (currentContest) {
        const serialized = JSON.stringify(currentContest);
        sessionStorage.setItem("currentContest", serialized);
        localStorage.setItem("currentContest", serialized);
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
