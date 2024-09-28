import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ref, get, child } from "firebase/database";
import { database } from "../firebase"; // Firebase 초기화 파일
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";

// 필요한 필드값을 배열로 받아오는 함수
const fetchSpecificFields = async (path, fields) => {
  const dbRef = ref(database);
  const result = {};

  // 필드 배열에 대해 루프를 돌며 각 필드의 데이터를 가져옴
  for (const field of fields) {
    const fieldPath = `${path}/${field}`;
    try {
      const snapshot = await get(child(dbRef, fieldPath));

      if (snapshot.exists()) {
        const data = snapshot.val();
        result[field] = data; // 결과 객체에 각 필드 데이터 추가
      } else {
        console.log(`데이터가 존재하지 않습니다: ${field}`);
      }
    } catch (error) {
      console.error(
        `데이터를 가져오는 중 오류가 발생했습니다: ${field}`,
        error
      );
      throw error;
    }
  }

  return result; // 모든 필드 데이터를 포함한 객체 반환
};

const ContestMonitoringMC = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stageInfo, setStageInfo] = useState({});
  const [currentContestId, setCurrentContestId] = useState("");
  const [currentCategoryId, setCurrentCategoryId] = useState("");
  const [currentGradeId, setCurrentGradeId] = useState("");
  const [currentStageId, setCurrentStageId] = useState("");
  const [varStageTitle, setVarStageTitle] = useState("");
  const { currentContest } = useContext(CurrentContestContext);
  const fetchEntriesQuery = useFirestoreQuery();
  const fetchStagesQuery = useFirestoreQuery();

  const stageIdWithGrades = async (contestId, stageId) => {
    console.log(stageId);
    try {
      const condition = [where("contestId", "==", contestId)];
      await fetchStagesQuery
        .getDocuments("contest_stages_assign", condition)
        .then((data) => {
          if (data?.length > 0) {
            setStageInfo({ ...data[0] });
            const findStageInGrades = data[0].stages.find(
              (f) => f.stageId === stageId
            ).grades;

            if (findStageInGrades.length === 0) {
              return;
            } else if (findStageInGrades.length === 1) {
              setVarStageTitle(
                findStageInGrades[0].categoryTitle +
                  " " +
                  findStageInGrades[0].gradeTitle
              );
            } else if (findStageInGrades.length > 1) {
              return;
            }
          }
        });
    } catch (error) {
      console.log(error);
    }
  };
  const fetchEntries = async (contestId, categoryId, gradeId) => {};

  const realTimeSetStageId = async (contestId, fields = []) => {
    const path = `currentStage/${contestId}`; // 실제 데이터 경로로 변경

    await fetchSpecificFields(path, fields).then((data) =>
      setCurrentStageId(data.stageId)
    );
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      setIsLoading(false);
      setCurrentContestId(currentContest.contests.id);
      realTimeSetStageId(currentContest?.contests?.id, ["stageId"]);
    }
  }, [currentContest]);

  useEffect(() => {
    if (currentStageId && currentContestId) {
      stageIdWithGrades(currentContestId, currentStageId);
    }
  }, [currentStageId, currentContestId]);

  return (
    <>
      {isLoading && (
        <div className="w-full h-screen flex justify-center items-center bg-white">
          <LoadingPage />
        </div>
      )}

      {/* 데이터가 로드되었을 때 화면에 출력 */}
      {!isLoading && data && (
        <div>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}

      {/* 에러 발생 시 에러 메시지 표시 */}
      {error && (
        <div>
          <p>{error}</p>
        </div>
      )}
    </>
  );
};

export default ContestMonitoringMC;
