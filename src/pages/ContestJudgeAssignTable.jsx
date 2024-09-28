import React, { useContext, useEffect, useState, useMemo } from "react";
import {
  useFirestoreGetDocument,
  useFirestoreQuery,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { where } from "firebase/firestore";
import LoadingPage from "./LoadingPage";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import { generateUUID } from "../functions/functions";

// New modular components
import SectionAssign from "../components/SectionAssign";
import CategoryAssign from "../components/CategoryAssign";
import GradeAssign from "../components/GradeAssign";

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

  // Data loading function
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

  // Handle judge assignment update
  const handleUpdateJudgesAssign = async () => {
    console.log(judgesAssignInfo);
    try {
      setMessage({ body: "저장중...", isButton: false });
      setMsgOpen(true);
      await updateJudgesAssign.updateData(
        judgesAssignInfo.id,
        judgesAssignInfo
      );
      setMessage({
        body: "저장되었습니다.",
        isButton: true,
        confirmButtonText: "확인",
      });
    } catch (error) {
      console.log(error);
    }
  };

  // Section filtering
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
  }, [categoriesArray, gradesArray]);

  useEffect(() => {
    if (currentContest?.contests?.id) {
      fetchPool(currentContest.contests.id);
    }
    setCurrentSubTab("0");
  }, [currentContest]);

  return (
    <div className="flex flex-col  gap-y-2 w-full h-auto bg-white mb-3 rounded-t-lg rounded-b-lg p-2 gap-x-4">
      {isLoading ? (
        <LoadingPage />
      ) : (
        <>
          <ConfirmationModal
            isOpen={msgOpen}
            message={message}
            onCancel={() => setMsgOpen(false)}
            onConfirm={() => setMsgOpen(false)}
          />
          <div className="flex w-full h-auto justify-start items-center">
            {["섹션별", "종목별", "체급별"].map((label, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSubTab(idx.toString())}
                className={`w-40 h-10 ${
                  currentSubTab === idx.toString()
                    ? "bg-blue-500 text-gray-100"
                    : "bg-white text-gray-700 border-t border-r"
                } rounded-t-lg`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="w-full h-12 bg-gradient-to-r from-blue-300 to-cyan-200 rounded-lg"
            onClick={handleUpdateJudgesAssign}
          >
            저장
          </button>
          {/* Render based on the selected sub-tab */}
          {currentSubTab === "0" && (
            <SectionAssign
              judgesAssignInfo={judgesAssignInfo}
              judgesPoolArray={judgesPoolArray}
              filteredBySection={filteredBySection}
              setJudgesAssignInfo={setJudgesAssignInfo}
              currentContest={currentContest}
              generateUUID={generateUUID}
            />
          )}
          {currentSubTab === "1" && (
            <CategoryAssign
              judgesAssignInfo={judgesAssignInfo}
              judgesPoolArray={judgesPoolArray}
              setJudgesAssignInfo={setJudgesAssignInfo}
              categoriesArray={categoriesArray}
              gradesArray={gradesArray}
              currentContest={currentContest}
              generateUUID={generateUUID}
            />
          )}
          {currentSubTab === "2" && (
            <GradeAssign
              judgesAssignInfo={judgesAssignInfo}
              judgesPoolArray={judgesPoolArray}
              setJudgesAssignInfo={setJudgesAssignInfo}
              categoriesArray={categoriesArray}
              gradesArray={gradesArray}
              currentContest={currentContest}
              generateUUID={generateUUID}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ContestJudgeAssignTable;
