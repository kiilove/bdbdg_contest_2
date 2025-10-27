"use client";

import { useContext, useEffect, useState, useMemo } from "react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
} from "../hooks/useFirestores";
import { doc, setDoc, where } from "firebase/firestore";
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateUUID } from "../functions/functions";
import { Tabs, Button, Card } from "antd";
import {
  SaveOutlined,
  TeamOutlined,
  TrophyOutlined,
  StarOutlined,
} from "@ant-design/icons";

// Child components
import SectionAssign from "../components/SectionAssign";
import CategoryAssign from "../components/CategoryAssign";
import GradeAssign from "../components/GradeAssign";
import { db } from "../firebase";

const ContestJudgeAssignTable = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentSubTab, setCurrentSubTab] = useState("0");
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});
  // ✅ 부모는 “원본”만 보관
  const [judgesAssignInfoRaw, setJudgesAssignInfoRaw] = useState({
    id: "",
    judges: [],
  });
  const [judgesPoolArray, setJudgesPoolArray] = useState([]);
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);

  const { currentContest } = useContext(CurrentContestContext);
  const fetchJudgesAssign = useFirestoreGetDocument("contest_judges_assign");
  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchJudgesPoolQuery = useFirestoreQuery();

  const fetchPool = async (contestId) => {
    try {
      const [judgesPool, judgesAssign, categories, grades] = await Promise.all([
        fetchJudgesPoolQuery.getDocuments("contest_judges_pool", [
          where("contestId", "==", contestId),
        ]),
        fetchJudgesAssign.getDocument(
          currentContest.contests.contestJudgesAssignId
        ),
        fetchCategories.getDocument(
          currentContest.contests.contestCategorysListId
        ),
        fetchGrades.getDocument(currentContest.contests.contestGradesListId),
      ]);

      setJudgesPoolArray(judgesPool || []);
      // 원본 상태에 저장
      setJudgesAssignInfoRaw(
        judgesAssign && judgesAssign.id ? judgesAssign : { id: "", judges: [] }
      );
      setCategoriesArray(categories?.categorys || []);
      setGradesArray(grades?.grades || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔎 섹션/종목/체급 필터 구조: 자식들이 재사용
  const filteredBySection = useMemo(() => {
    return (categoriesArray || []).reduce((acc, curr) => {
      const section = acc.find(
        (item) => item.sectionName === curr.contestCategorySection
      );
      const matchingGrades = (gradesArray || []).filter(
        (grade) => grade.refCategoryId === curr.contestCategoryId
      );

      if (!section) {
        acc.push({
          sectionName: curr.contestCategorySection,
          sectionCategory: [curr],
          sectionGrades: matchingGrades,
        });
      } else {
        section.sectionCategory.push(curr);
        section.sectionGrades.push(...matchingGrades);
      }

      return acc;
    }, []);
  }, [categoriesArray, gradesArray]);

  // 🔎 카테고리 ID → 제목 일괄 맵
  const categoryTitleMap = useMemo(() => {
    const map = {};
    (categoriesArray || []).forEach((cat) => {
      if (cat?.contestCategoryId) {
        map[cat.contestCategoryId] = cat.contestCategoryTitle || "";
      }
    });
    return map;
  }, [categoriesArray]);

  // ✅ 파생: 원본 judges에 categoryTitle을 붙인 버전 (표시/저장 둘 다 이걸 사용)
  const judgesAssignInfoEnriched = useMemo(() => {
    const cloned = {
      ...(judgesAssignInfoRaw || {}),
      judges: [...(judgesAssignInfoRaw?.judges || [])],
    };
    cloned.judges = cloned.judges.map((j) => ({
      ...j,
      categoryTitle:
        categoryTitleMap[j?.refCategoryId || j?.categoryId] || null,
    }));
    return cloned;
  }, [judgesAssignInfoRaw, categoryTitleMap]);

  // 자식이 사용하는 setter: 항상 “원본”을 업데이트하게 강제
  const setJudgesAssignInfoFromChild = (updater) => {
    setJudgesAssignInfoRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // 안전 가드
      if (!next || !Array.isArray(next.judges)) {
        return { ...(next || {}), judges: [] };
      }
      return next;
    });
  };

  // 저장: 파생(제목 포함) 버전을 통째로 저장
  const handleUpdateJudgesAssign = async () => {
    try {
      setMessage({ body: "저장중...", isButton: false });
      setMsgOpen(true);

      const targetId = judgesAssignInfoEnriched?.id || judgesAssignInfoRaw?.id;
      if (!targetId) {
        throw new Error("judgesAssignInfo 문서 id가 없습니다.");
      }
      const ref = doc(db, "contest_judges_assign", targetId);
      await setDoc(ref, judgesAssignInfoEnriched, { merge: false });

      setMessage({
        body: "저장되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
    } catch (error) {
      console.log(error);
      setMessage({
        body: "저장 중 오류가 발생했습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(currentContest.contests.id);
    }
    setCurrentSubTab("0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest]);

  const tabItems = [
    {
      key: "0",
      label: (
        <span className="flex items-center gap-2">
          <TeamOutlined />
          섹션별
        </span>
      ),
      children: (
        <SectionAssign
          judgesAssignInfo={judgesAssignInfoEnriched} // 표시/랜더용 (제목 포함)
          judgesPoolArray={judgesPoolArray}
          filteredBySection={filteredBySection}
          setJudgesAssignInfo={setJudgesAssignInfoFromChild} // 원본만 업데이트
          currentContest={currentContest}
          generateUUID={generateUUID}
          setMessage={setMessage}
          setMsgOpen={setMsgOpen}
        />
      ),
    },
    {
      key: "1",
      label: (
        <span className="flex items-center gap-2">
          <TrophyOutlined />
          종목별
        </span>
      ),
      children: (
        <CategoryAssign
          judgesAssignInfo={judgesAssignInfoEnriched}
          judgesPoolArray={judgesPoolArray}
          setJudgesAssignInfo={setJudgesAssignInfoFromChild}
          categoriesArray={categoriesArray}
          gradesArray={gradesArray}
          currentContest={currentContest}
          generateUUID={generateUUID}
          setMessage={setMessage}
          setMsgOpen={setMsgOpen}
        />
      ),
    },
    {
      key: "2",
      label: (
        <span className="flex items-center gap-2">
          <StarOutlined />
          체급별
        </span>
      ),
      children: (
        <GradeAssign
          judgesAssignInfo={judgesAssignInfoEnriched}
          judgesPoolArray={judgesPoolArray}
          setJudgesAssignInfo={setJudgesAssignInfoFromChild}
          categoriesArray={categoriesArray}
          gradesArray={gradesArray}
          currentContest={currentContest}
          generateUUID={generateUUID}
          setMessage={setMessage}
          setMsgOpen={setMsgOpen}
        />
      ),
    },
  ];

  return (
    <div className="w-full mb-3">
      {isLoading ? (
        <LoadingPage />
      ) : (
        <>
          <ConfirmationModal
            isOpen={msgOpen}
            message={message}
            onCancel={() => setMsgOpen(false)}
            onConfirm={() => {
              message?.onConfirm && message.onConfirm();
              setMsgOpen(false);
            }}
          />
          <Card className="shadow-md">
            <div className="mb-4">
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                onClick={handleUpdateJudgesAssign}
                className="w-full"
              >
                저장
              </Button>
            </div>

            <Tabs
              activeKey={currentSubTab}
              onChange={setCurrentSubTab}
              items={tabItems}
              size="large"
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default ContestJudgeAssignTable;
