"use client";

import { useContext, useEffect, useState, useMemo } from "react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
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
  const [judgesAssignInfo, setJudgesAssignInfo] = useState({});
  const [judgesPoolArray, setJudgesPoolArray] = useState([]);
  const [categoriesArray, setCategoriesArray] = useState([]);
  const [gradesArray, setGradesArray] = useState([]);

  const { currentContest } = useContext(CurrentContestContext);
  const fetchJudgesAssign = useFirestoreGetDocument("contest_judges_assign");
  const fetchCategories = useFirestoreGetDocument("contest_categorys_list");
  const fetchGrades = useFirestoreGetDocument("contest_grades_list");
  const fetchJudgesPoolQuery = useFirestoreQuery();
  const updateJudgesAssign = useFirestoreUpdateData("contest_judges_assign");

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

      setJudgesPoolArray(judgesPool);
      setJudgesAssignInfo(judgesAssign);
      setCategoriesArray(categories.categorys);
      setGradesArray(grades.grades);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateJudgesAssign = async () => {
    try {
      setMessage({ body: "저장중...", isButton: false });
      setMsgOpen(true);

      // ⚠️ 여기서는 기존 useFirestoreUpdateData 훅을 쓰지 않습니다.
      // 이유: updateDoc(부분 업데이트) → 기존 키가 남아 일관성 깨질 수 있음
      // 이 화면은 "완전 덮어쓰기(기존 키 삭제 포함)"가 요구되므로
      // setDoc(merge:false)로 문서를 통째로 교체합니다.
      const ref = doc(db, "contest_judges_assign", judgesAssignInfo.id);
      await setDoc(ref, judgesAssignInfo, { merge: false });

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
  // const handleUpdateJudgesAssign = async () => {
  //   try {
  //     setMessage({ body: "저장중...", isButton: false });
  //     setMsgOpen(true);
  //     await updateJudgesAssign.updateData(
  //       judgesAssignInfo.id,
  //       judgesAssignInfo
  //     );
  //     setMessage({
  //       body: "저장되었습니다.",
  //       isButton: true,
  //       confirmButtonText: "확인",
  //     });
  //   } catch (error) {
  //     console.log(error);
  //   }
  // };

  const filteredBySection = useMemo(() => {
    return categoriesArray.reduce((acc, curr) => {
      const section = acc.find(
        (item) => item.sectionName === curr.contestCategorySection
      );
      const matchingGrades = gradesArray.filter(
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
  }, [categoriesArray, gradesArray, judgesAssignInfo]);

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(currentContest.contests.id);
    }
    setCurrentSubTab("0");
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
          judgesAssignInfo={judgesAssignInfo}
          judgesPoolArray={judgesPoolArray}
          filteredBySection={filteredBySection}
          setJudgesAssignInfo={setJudgesAssignInfo}
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
          judgesAssignInfo={judgesAssignInfo}
          judgesPoolArray={judgesPoolArray}
          setJudgesAssignInfo={setJudgesAssignInfo}
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
          judgesAssignInfo={judgesAssignInfo}
          judgesPoolArray={judgesPoolArray}
          setJudgesAssignInfo={setJudgesAssignInfo}
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
