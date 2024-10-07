import React, { createContext, useEffect, useState } from "react";

export const CurrentContestContext = createContext();

export const CurrentContestProvider = ({ children }) => {
  const [currentContest, setCurrentContest] = useState(null);

  // currentContest가 변경될 때마다 sessionStorage에 저장
  useEffect(() => {
    console.log(currentContest);
    if (currentContest) {
      sessionStorage.setItem("currentContest", JSON.stringify(currentContest));
    }
  }, [currentContest]);

  // 컴포넌트 초기화 시 sessionStorage에서 currentContest 불러오기
  useEffect(() => {
    const storedContest = sessionStorage.getItem("currentContest");
    if (storedContest) {
      setCurrentContest(JSON.parse(storedContest));
    }
  }, []);

  return (
    <CurrentContestContext.Provider
      value={{ currentContest, setCurrentContest }}
    >
      {children}
    </CurrentContestContext.Provider>
  );
};
