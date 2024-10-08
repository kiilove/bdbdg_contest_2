// components/SelectDatabase.js
import React, { useContext, useEffect, useState } from "react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useNavigate } from "react-router-dom";
import LoadingPage from "./LoadingPage";

const SelectDatabase = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [contestList, setContestList] = useState([]);
  const [contestNoticeId, setContestNoticeId] = useState(null);
  const [message, setMessage] = useState(""); // 간단한 메시지 상태
  const navigate = useNavigate();

  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );
  const fetchQuery = useFirestoreQuery();
  const fetchDocument = useFirestoreGetDocument("contest_notice");

  // 대회 목록 가져오기 함수
  const fetchList = async (userData) => {
    const condition = [
      where("contestStatus", "in", [
        "접수중",
        "수정됨",
        "데모용",
        "수동접수",
        "대회마감",
      ]),
    ];

    try {
      const returnData = await fetchQuery.getDocuments(
        "contest_notice",
        condition
      );

      // 사용자 그룹에 따른 필터링
      const filteredData =
        userData.userGroup === "orgManager"
          ? returnData.filter(
              (contest) =>
                contest.contestAssociate === userData.userContext ||
                contest.contestPromoter === userData.userContext
            )
          : [...returnData];

      // 대회 목록 정렬 및 설정
      const sortedList = filteredData.sort((a, b) =>
        a.contestTitle.localeCompare(b.contestTitle)
      );

      setContestList(sortedList);

      // 기본 대회 ID 설정 (첫 번째 대회)
      if (sortedList.length >= 1) {
        setContestNoticeId(sortedList[0].id);
      }
    } catch (error) {
      console.error("대회 목록을 가져오는 중 오류 발생:", error);
      setMessage("대회 목록을 가져오는 중 오류가 발생했습니다.");
      alert("대회 목록을 가져오는 중 오류가 발생했습니다.");
    }
  };

  // 선택된 대회 정보 가져오기 함수
  const fetchContest = async () => {
    if (contestNoticeId) {
      const condition = [where("contestNoticeId", "==", contestNoticeId)];
      try {
        const returnContest = await fetchQuery.getDocuments(
          "contests",
          condition
        );
        const returnNotice = await fetchDocument.getDocument(contestNoticeId);

        if (returnContest[0]?.id && returnNotice?.id) {
          const contestData = {
            contestInfo: { ...returnNotice },
            contests: { ...returnContest[0] },
          };

          setCurrentContest(contestData);

          // sessionStorage에 저장하여 리프레시 시에도 유지되도록 설정
          sessionStorage.setItem("currentContest", JSON.stringify(contestData));
        }
      } catch (error) {
        console.error("선택된 대회 정보를 가져오는 중 오류 발생:", error);
        setMessage("선택된 대회 정보를 가져오는 중 오류가 발생했습니다.");
        alert("선택된 대회 정보를 가져오는 중 오류가 발생했습니다.");
      }
    }
  };

  // 첫 번째 useEffect: 컴포넌트 마운트 시 user 정보 및 currentContest 정보 로드
  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    const storedContest = sessionStorage.getItem("currentContest");

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        if (storedContest) {
          const parsedContest = JSON.parse(storedContest);
          setCurrentContest(parsedContest);
        }
      } catch (e) {
        console.error("데이터 파싱 오류:", e);
        setMessage("로그인 정보를 다시 확인해 주세요.");
        navigate("/login");
        return;
      }
    } else {
      setMessage("사용자 정보가 없습니다. 로그인 해주세요.");
      navigate("/login");
      return;
    }
  }, [navigate]);

  // 두 번째 useEffect: user가 설정되면 대회 목록 로드
  useEffect(() => {
    if (!user) {
      return;
    }

    let timeoutId;

    const loadData = async () => {
      try {
        await fetchList(user); // 대회 목록 가져오기
        clearTimeout(timeoutId); // 타임아웃 취소
        setIsLoading(false); // 로딩 해제
      } catch (error) {
        console.error("대회 목록을 가져오는 중 오류 발생:", error);
        clearTimeout(timeoutId); // 타임아웃 취소
        setIsLoading(false); // 로딩 해제
        setMessage("대회 목록을 가져오는 중 오류가 발생했습니다.");
        alert("대회 목록을 가져오는 중 오류가 발생했습니다.");
      }
    };

    setIsLoading(true); // 로딩 시작
    timeoutId = setTimeout(() => {
      setIsLoading(false); // 3초 후 로딩 해제
      alert("데이터 로딩 시간이 초과되었습니다.");
    }, 3000);

    loadData();

    return () => {
      clearTimeout(timeoutId); // 컴포넌트 언마운트 시 타임아웃 정리
    };
  }, [user]);

  // 선택된 대회 ID 변경 시 대회 정보 가져오기
  useEffect(() => {
    if (contestNoticeId) {
      fetchContest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestNoticeId]);

  // 대회 선택 핸들러
  const handleSelectChange = (e) => {
    setContestNoticeId(e.target.value);
  };

  // 관리페이지로 이동 핸들러
  const handleNavigate = () => {
    if (!contestNoticeId) {
      alert("먼저 대회를 선택해주세요.");
      return;
    }
    navigate("/management", { state: { showTopBar: true } }); // 올바른 경로로 수정
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {isLoading ? (
        <LoadingPage />
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-4">대회 선택</h2>
          {contestList.length > 0 ? (
            <>
              <label
                htmlFor="contest-select"
                className="mb-2 text-lg font-medium"
              >
                대회 선택:
              </label>
              <select
                id="contest-select"
                value={contestNoticeId || ""}
                onChange={handleSelectChange}
                className="w-64 p-2 border border-gray-300 rounded mb-4"
              >
                {contestList.map((contest) => (
                  <option key={contest.id} value={contest.id}>
                    {contest.contestTitle}
                  </option>
                ))}
              </select>
              <button
                onClick={handleNavigate}
                className="w-64 p-2 bg-blue-500 text-white rounded"
              >
                관리페이지로 이동
              </button>
            </>
          ) : (
            <div className="text-red-500">선택 가능한 대회가 없습니다.</div>
          )}
        </>
      )}
    </div>
  );
};

export default SelectDatabase;
