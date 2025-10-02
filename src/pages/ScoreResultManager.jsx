import React, { useEffect, useState, useContext } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { BsTrash } from "react-icons/bs";

const ScoreResultManager = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchScores = async () => {
    if (!currentContest?.contests?.collectionName) return;
    setLoading(true);
    try {
      const colRef = collection(db, currentContest.contests.collectionName);
      const snapshot = await getDocs(colRef);
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setScores(data);
    } catch (err) {
      console.error("채점 결과 불러오기 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("정말로 이 채점 결과를 삭제하시겠습니까?")) return;
    try {
      await deleteDoc(doc(db, currentContest.contests.collectionName, id));
      setScores((prev) => prev.filter((item) => item.id !== id));
      alert("삭제되었습니다.");
    } catch (err) {
      console.error("삭제 중 오류:", err);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  /** 🔹 Category → Grade → Player 트리 구조 생성 */
  const buildHierarchy = (data) => {
    const grouped = {};
    data.forEach((item) => {
      const cat = item.categoryTitle || "기타";
      const grade = item.gradeTitle || "기타";
      const playerKey = `${item.playerNumber || 0} ${item.playerName || ""}`;
      if (!grouped[cat]) grouped[cat] = {};
      if (!grouped[cat][grade]) grouped[cat][grade] = {};
      if (!grouped[cat][grade][playerKey]) grouped[cat][grade][playerKey] = [];
      grouped[cat][grade][playerKey].push(item);
    });

    // 각 선수별로 seatIndex 오름차순 정렬
    Object.keys(grouped).forEach((cat) =>
      Object.keys(grouped[cat]).forEach((grade) =>
        Object.keys(grouped[cat][grade]).forEach((player) => {
          grouped[cat][grade][player].sort(
            (a, b) => (a.seatIndex || 0) - (b.seatIndex || 0)
          );
        })
      )
    );

    return grouped;
  };

  const hierarchy = buildHierarchy(scores);
  const categoryKeys = Object.keys(hierarchy).sort((a, b) =>
    a.localeCompare(b)
  );
  const getGrades = (cat) =>
    Object.keys(hierarchy[cat]).sort((a, b) => a.localeCompare(b));
  const getPlayers = (cat, grade) =>
    Object.keys(hierarchy[cat][grade]).sort((a, b) => {
      const numA = parseInt(a.split(" ")[0]) || 0;
      const numB = parseInt(b.split(" ")[0]) || 0;
      return numA - numB; // 선수번호 오름차순
    });

  useEffect(() => {
    fetchScores();
  }, [currentContest?.contests?.collectionName]);

  return (
    <div className="flex flex-col w-full p-4 bg-white rounded shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">채점 결과 관리</h2>
        <button
          onClick={fetchScores}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          🔄 새로고침
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">불러오는 중...</p>
      ) : scores.length === 0 ? (
        <p className="text-gray-500">저장된 채점 결과가 없습니다.</p>
      ) : (
        categoryKeys.map((cat) => (
          <div key={cat} className="mb-8">
            {/* ✅ 종목 */}
            <h2 className="text-lg font-bold mb-2">🏆 종목: {cat}</h2>

            {getGrades(cat).map((grade) => (
              <div key={grade} className="mb-6 ml-4">
                {/* ✅ 체급 */}
                <h3 className="font-semibold mb-2 text-blue-600">
                  ▶ 체급: {grade}
                </h3>

                {getPlayers(cat, grade).map((playerKey) => (
                  <div key={playerKey} className="mb-3 ml-6">
                    {/* ✅ 선수 */}
                    <h4 className="font-medium text-gray-800 mb-1">
                      선수: {playerKey}
                    </h4>
                    <div className="overflow-auto border rounded">
                      <table className="table-auto w-full text-sm text-left">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-2 border">대회명</th>
                            <th className="p-2 border">종목</th>
                            <th className="p-2 border">체급</th>
                            <th className="p-2 border">선수번호</th>{" "}
                            {/* ✅ 추가 */}
                            <th className="p-2 border">선수명</th>
                            <th className="p-2 border">좌석</th>
                            <th className="p-2 border">심판명</th>
                            <th className="p-2 border">점수</th>
                            <th className="p-2 border text-center">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hierarchy[cat][grade][playerKey].map((score) => (
                            <tr key={score.id} className="hover:bg-gray-50">
                              <td className="p-2 border">
                                {currentContest?.contestInfo?.contestTitle ||
                                  "-"}
                              </td>
                              <td className="p-2 border">
                                {score.categoryTitle}
                              </td>
                              <td className="p-2 border">{score.gradeTitle}</td>
                              <td className="p-2 border">
                                {score.playerNumber}
                              </td>{" "}
                              {/* ✅ 추가 */}
                              <td className="p-2 border">{score.playerName}</td>
                              <td className="p-2 border">
                                {score.seatIndex ?? "-"}
                              </td>
                              <td className="p-2 border">{score.judgeName}</td>
                              <td className="p-2 border">
                                {score.playerScore}
                              </td>
                              <td className="p-2 border text-center">
                                <button
                                  onClick={() => handleDelete(score.id)}
                                  className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                >
                                  <BsTrash />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

export default ScoreResultManager;
