"use client";

import { useRef, useState, useContext, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import {
  useFirestoreAddData,
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import ConfirmationModal from "../messageBox/ConfirmationModal";
import {
  generateUUID,
  isGrandPrixPlayerEntry,
} from "../functions/functions";
import { sanitizeForFirestore } from "../utils/firestoreSanitize";
import BibTag from "../components/ui/BibTag";

const inputClass =
  "w-full h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] px-3 text-[14px] text-[#171717] placeholder:text-[#737373] focus:outline-none focus:border-[#2563eb] transition-colors duration-150";

const isSamePlayerEntry = (a, b) => {
  if (!a || !b) return false;
  const gradeA = a.contestGradeId || "";
  const gradeB = b.contestGradeId || "";
  if (gradeA !== gradeB) return false;
  if (a.playerUid && b.playerUid && a.playerUid === b.playerUid) {
    return true;
  }
  return (
    Number(a.playerNumber) === Number(b.playerNumber) &&
    (a.playerName || "").trim() !== "" &&
    (a.playerName || "").trim() === (b.playerName || "").trim()
  );
};

const ContestForceManual = () => {
  const { currentContest } = useContext(CurrentContestContext);
  const [invoiceInfo, setInvoiceInfo] = useState({});
  const [playerFinalArray, setPlayerFinalArray] = useState([]);
  const [playerFinalInfo, setPlayerFinalInfo] = useState({});

  const [playerList, setPlayerList] = useState({});
  const [playerArray, setPlayerArray] = useState([]);
  const [playerNumber, setPlayerNumber] = useState(0);

  const [categorysArray, setCategorysArray] = useState([]);
  const [categorysList, setCategorysList] = useState({});
  const [gradesArray, setGradesArray] = useState([]);
  const [entrysArray, setEntrysArray] = useState([]);

  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState({});
  const msgConfirmActionRef = useRef(null);
  const invoiceInfoRef = useRef({});

  const openModalMessage = (nextMessage, onConfirmAction = null) => {
    msgConfirmActionRef.current = onConfirmAction;
    setMessage(nextMessage);
    setMsgOpen(true);
  };

  void playerFinalArray;
  void setPlayerFinalArray;
  void playerList;
  void setPlayerList;
  void playerArray;
  void setPlayerArray;
  void categorysList;
  void entrysArray;
  void setEntrysArray;

  const fetchCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const fetchGradeDocument = useFirestoreGetDocument("contest_grades_list");
  const fetchPlayersFinal = useFirestoreGetDocument("contest_players_final");

  const addInvoice = useFirestoreAddData("invoices_pool");
  const updatePlayersFinal = useFirestoreUpdateData("contest_players_final");

  void addInvoice;
  void updatePlayersFinal;

  const fetchPool = async () => {
    if (!currentContest?.contests?.id) return;

    try {
      if (currentContest.contests.contestCategorysListId) {
        const returnCategorys = await fetchCategoryDocument.getDocument(
          currentContest.contests.contestCategorysListId
        );
        setCategorysList({ ...(returnCategorys || {}) });
        setCategorysArray([
          ...(returnCategorys?.categorys || [])
            .slice()
            .sort((a, b) => a.contestCategoryIndex - b.contestCategoryIndex),
        ]);
      }

      if (currentContest.contests.contestGradesListId) {
        const returnGrades = await fetchGradeDocument.getDocument(
          currentContest.contests.contestGradesListId
        );
        setGradesArray([...(returnGrades?.grades || [])]);
      }

      if (currentContest.contests.contestPlayersFinalId) {
        const returnPlayersFinal = await fetchPlayersFinal.getDocument(
          currentContest.contests.contestPlayersFinalId
        );

        setPlayerFinalInfo(() => ({ ...(returnPlayersFinal || {}) }));

        if (returnPlayersFinal) {
          const existingPlayers = returnPlayersFinal?.players || [];
          const maxNum = existingPlayers.reduce(
            (acc, p) => Math.max(acc, Number(p?.playerNumber) || 0),
            existingPlayers.length
          );
          const nextNum = maxNum + 1;

          setPlayerNumber(nextNum);
          setInvoiceInfo((prev) => ({
            ...prev,
            playerNumber: nextNum,
          }));
          openModalMessage({
            variant: "info",
            title: "다음 선수번호 자동 설정",
            body: `최종명단 기준 다음 부여 선수번호가 #${nextNum}번으로 갱신되었습니다.`,
            body2: "필요한 경우 선수번호 입력란에서 직접 변경할 수 있습니다.",
            isButton: true,
            confirmButtonText: "확인",
          });
        }
      }
    } catch (error) {
      console.error("강제등록 초기 데이터 로드 실패:", error);
      openModalMessage({
        variant: "error",
        title: "데이터 로드 실패",
        body: "강제 등록에 필요한 대회 데이터를 불러오지 못했습니다.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  const handleInputValues = (e) => {
    const { name, value } = e.target;
    setInvoiceInfo((prevInfo) => ({
      ...prevInfo,
      [name]: value,
    }));
  };

  const handleJoins = (e) => {
    try {
      const { name, id, value } = e.target;

      const rawValue = String(value || "");
      const gradeId =
        rawValue === "체급선택" || rawValue.startsWith("체급선택,")
          ? "체급선택"
          : gradesArray.some((g) => g.contestGradeId === rawValue)
          ? rawValue
          : rawValue.split(",")[0];

      const dummy = [...(invoiceInfo?.joins || [])];
      const newInvoiceInfo = { ...invoiceInfo };

      const findCategory = dummy.some(
        (category) => category.contestCategoryId === id
      );
      const findIndex = dummy.findIndex(
        (category) => category.contestCategoryId === id
      );

      if (gradeId === "체급선택" || !gradeId) {
        if (findIndex !== -1) {
          dummy.splice(findIndex, 1);
        }
        setInvoiceInfo({ ...newInvoiceInfo, joins: [...dummy] });
        return;
      }

      const matchedCategory = categorysArray.find(
        (category) => category.contestCategoryId === id
      );
      const matchedGrade =
        gradesArray.find(
          (grade) =>
            grade.contestGradeId === gradeId && grade.refCategoryId === id
        ) || gradesArray.find((grade) => grade.contestGradeId === gradeId);

      const resolvedGradeTitle = matchedGrade?.contestGradeTitle || "";
      const resolvedCategoryTitle =
        matchedCategory?.contestCategoryTitle || name || "";

      const newValue = {
        contestCategoryId: id,
        contestCategoryTitle: resolvedCategoryTitle,
        ...(matchedCategory?.contestCategorySection
          ? { contestCategorySection: matchedCategory.contestCategorySection }
          : {}),
        ...(matchedCategory?.contestCategoryPriceType
          ? { contestCategoryPriceType: matchedCategory.contestCategoryPriceType }
          : {}),
        contestGradeId: gradeId,
        contestGradeTitle: resolvedGradeTitle,
        isGradeChanged: false,
        originalGradeId: gradeId,
        originalGradeTitle: resolvedGradeTitle,
      };

      if (!findCategory) {
        dummy.push({ ...newValue });
      } else if (findIndex !== -1) {
        dummy.splice(findIndex, 1, { ...newValue });
      }

      setInvoiceInfo({ ...newInvoiceInfo, joins: [...dummy] });
    } catch (error) {
      console.error("Error in handleJoins:", error);
    }
  };

  const initInvoiceInfo = (overrideNumber) => {
    if (!currentContest?.contests?.id) return {};

    const { id: contestId } = currentContest.contests;

    const initInfo = {
      contestId: contestId,
      createdBy: "force",
      createBy: "force",
      contestPriceSum: 0,
      playerUid: generateUUID(),
      playerNumber: overrideNumber !== undefined ? overrideNumber : playerNumber,
      playerName: "",
      playerTel: "",
      playerEmail: "force@force.com",
      playerBirth: "",
      playerGym: "",
      playerGender: "m",
      playerText: "",
      isPriceCheck: true,
      isCanceled: false,
      playerNoShow: false,
      joins: [],
    };

    return initInfo;
  };

  const handleAddInvoice = async (propData) => {
    if (!currentContest?.contests?.id) return;

    if (!propData?.joins?.length) {
      openModalMessage({
        variant: "warning",
        title: "출전 종목 선택 필요",
        body: "참가 신청할 종목과 체급을 1개 이상 선택해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      return;
    }

    const finalId = currentContest.contests.contestPlayersFinalId;
    const assignId = currentContest.contests.contestPlayersAssignId;
    const contestId = currentContest.contests.id;

    if (!finalId) {
      openModalMessage({
        variant: "error",
        title: "최종명단 문서 확인 필요",
        body: "최종명단 문서를 확인할 수 없습니다. 대회 데이터 설정을 먼저 확인해 주세요.",
        isButton: true,
        confirmButtonText: "확인",
      });
      return;
    }

    openModalMessage({
      variant: "loading",
      title: "최종명단 강제 등록 중",
      body: "최종 출전 명단과 배정 목록에 선수를 등록하고 있습니다.",
      isButton: false,
    });

    try {
      const newData = { ...propData };
      delete newData.joins;

      const startNumber = Number.parseInt(propData.playerNumber, 10) || 0;
      const entriesToAdd = propData.joins.map((join, idx) => ({
        ...newData,
        ...join,
        contestId: newData.contestId || contestId,
        createdBy: "force",
        createBy: "force",
        playerNoShow: Boolean(newData.playerNoShow),
        playerNumber: startNumber + idx,
        playerIndex: startNumber + idx,
      }));

      let updatedFinalDocState = null;

      await runTransaction(db, async (transaction) => {
        const finalRef = doc(db, "contest_players_final", finalId);
        const assignRef = assignId
          ? doc(db, "contest_players_assign", assignId)
          : null;

        const finalSnap = await transaction.get(finalRef);
        const assignSnap = assignRef ? await transaction.get(assignRef) : null;

        const existingFinalData = finalSnap.exists()
          ? finalSnap.data()
          : { ...(playerFinalInfo || {}), contestId, players: [] };
        const mergedFinalPlayers = [...(existingFinalData?.players || [])];

        entriesToAdd.forEach((entry) => {
          if (!mergedFinalPlayers.some((p) => isSamePlayerEntry(p, entry))) {
            const matchedCat = categorysArray.find(
              (c) => c?.contestCategoryId === entry.contestCategoryId
            );
            if (isGrandPrixPlayerEntry(entry, matchedCat)) {
              const sameGradeGpList = mergedFinalPlayers.filter(
                (p) => p?.contestGradeId === entry.contestGradeId
              );
              const maxGpIdx = sameGradeGpList.reduce(
                (maxVal, p) =>
                  Math.max(
                    maxVal,
                    Number(p?.grandPrixIndex ?? p?.playerIndex ?? 0) || 0
                  ),
                0
              );
              const nextGpIdx = maxGpIdx + 1;
              mergedFinalPlayers.push({
                ...entry,
                contestCategorySection:
                  entry.contestCategorySection ||
                  matchedCat?.contestCategorySection ||
                  "그랑프리",
                playerIndexOriginal: entry.playerIndex,
                grandPrixIndex: nextGpIdx,
                playerIndex: nextGpIdx,
                isGradeChange: false,
                isGradeChanged: false,
              });
            } else {
              mergedFinalPlayers.push(entry);
            }
          }
        });

        const nextFinalDoc = sanitizeForFirestore({
          ...existingFinalData,
          contestId,
          players: mergedFinalPlayers,
          updatedAt: new Date().toISOString(),
        });
        updatedFinalDocState = nextFinalDoc;

        if (finalSnap.exists()) {
          transaction.update(finalRef, nextFinalDoc);
        } else {
          transaction.set(finalRef, nextFinalDoc);
        }

        if (assignRef && assignSnap?.exists()) {
          const existingAssignData = assignSnap.data() || {};
          const mergedAssignPlayers = [...(existingAssignData.players || [])];

          entriesToAdd.forEach((entry) => {
            if (!mergedAssignPlayers.some((p) => isSamePlayerEntry(p, entry))) {
              mergedAssignPlayers.push(entry);
            }
          });

          transaction.update(
            assignRef,
            sanitizeForFirestore({
              ...existingAssignData,
              contestId: existingAssignData.contestId || contestId,
              players: mergedAssignPlayers,
              updatedAt: new Date().toISOString(),
            })
          );
        }
      });

      const nextNumber = startNumber + entriesToAdd.length;
      if (updatedFinalDocState) {
        setPlayerFinalInfo(updatedFinalDocState);
      }
      setPlayerNumber(nextNumber);
      openModalMessage(
        {
          variant: "success",
          title: "최종명단 강제 등록 완료",
          body: `${propData.playerName || "선수"}의 출전 명단(${entriesToAdd.length}종목)이 추가되었습니다.`,
          body2: `다음 등록 대기 번호는 #${nextNumber}번으로 설정됩니다.`,
          isButton: true,
          confirmButtonText: "확인",
        },
        () => {
          setInvoiceInfo(initInvoiceInfo(nextNumber));
        }
      );
    } catch (error) {
      console.error("강제등록 저장 오류:", error);
      openModalMessage({
        variant: "error",
        title: "강제 등록 실패",
        body: "저장 중 오류가 발생했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
        body4: error?.message,
        isButton: true,
        confirmButtonText: "확인",
      });
    }
  };

  useEffect(() => {
    if (currentContest?.contests?.id) {
      const initInfo = initInvoiceInfo();
      setInvoiceInfo(initInfo);
      fetchPool();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContest?.contests?.id]);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="w-full px-5 sm:px-6 lg:px-8 py-6 space-y-6">
        <ConfirmationModal
          isOpen={msgOpen}
          onConfirm={() => {
            const action = msgConfirmActionRef.current;
            msgConfirmActionRef.current = null;
            setMsgOpen(false);
            if (action) action();
          }}
          onCancel={() => {
            msgConfirmActionRef.current = null;
            setMsgOpen(false);
          }}
          message={message}
        />

        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              최종명단 강제 등록
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              계측 마감 이후 확정된 최종 출전 명단과 배정 목록에 선수를 즉시 추가합니다
            </p>
          </div>
          {currentContest?.contests?.id && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-[13px] text-[#525252]">
                <span>배정 예정 번호</span>
                <BibTag
                  number={invoiceInfo.playerNumber ?? playerNumber}
                  prefix="#"
                  variant="active"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddInvoice(invoiceInfo)}
                className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
              >
                <UserPlus size={16} strokeWidth={1.5} />
                <span>최종명단 등록</span>
              </button>
            </div>
          )}
        </header>

        {currentContest?.contests?.id ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 좌측: 선수 번호 및 인적사항 */}
            <section className="lg:col-span-6 bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
              <div className="border-b border-[#171717]/[0.06] pb-3">
                <h2 className="text-[15px] font-medium text-[#171717]">
                  선수 번호 및 인적사항
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#525252]">
                    선수번호
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      name="playerNumber"
                      value={invoiceInfo.playerNumber ?? ""}
                      onChange={(e) => handleInputValues(e)}
                      ref={(ref) => (invoiceInfoRef.current.playerNumber = ref)}
                      className={`${inputClass} font-mono tabular-nums`}
                    />
                    <BibTag
                      number={invoiceInfo.playerNumber || "-"}
                      prefix="#"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#525252]">
                    이름
                  </label>
                  <input
                    type="text"
                    name="playerName"
                    placeholder="선수 이름"
                    value={invoiceInfo.playerName || ""}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerName = ref)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#525252]">
                    연락처
                  </label>
                  <input
                    type="text"
                    name="playerTel"
                    placeholder="010-0000-0000"
                    value={invoiceInfo.playerTel || ""}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerTel = ref)}
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#525252]">
                    생년월일
                  </label>
                  <input
                    type="text"
                    name="playerBirth"
                    placeholder="YYYY-MM-DD"
                    value={invoiceInfo.playerBirth || ""}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerBirth = ref)}
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#525252]">
                    소속
                  </label>
                  <input
                    type="text"
                    name="playerGym"
                    placeholder="소속이 없으면 무소속 입력"
                    value={invoiceInfo.playerGym || ""}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerGym = ref)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#525252]">
                    성별
                  </label>
                  <select
                    name="playerGender"
                    value={invoiceInfo.playerGender || "m"}
                    onChange={(e) => handleInputValues(e)}
                    ref={(ref) => (invoiceInfoRef.current.playerGender = ref)}
                    className={inputClass}
                  >
                    <option value="m">남성</option>
                    <option value="f">여성</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#525252]">
                  이메일
                </label>
                <input
                  type="email"
                  name="playerEmail"
                  placeholder="force@force.com"
                  value={invoiceInfo.playerEmail || ""}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (invoiceInfoRef.current.playerEmail = ref)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#525252]">
                  출전 동기 및 비고
                </label>
                <textarea
                  name="playerText"
                  value={invoiceInfo.playerText || ""}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (invoiceInfoRef.current.playerText = ref)}
                  placeholder="참고 메모 입력"
                  className="w-full h-24 rounded-[8px] bg-white border border-[#171717]/[0.12] px-3 py-2 text-[14px] text-[#171717] placeholder:text-[#737373] resize-none focus:outline-none focus:border-[#2563eb] transition-colors duration-150"
                />
              </div>
            </section>

            {/* 우측: 참가신청종목 */}
            <section className="lg:col-span-6 bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#171717]/[0.06] pb-3">
                <h2 className="text-[15px] font-medium text-[#171717]">
                  출전 종목 및 체급 배정
                </h2>
                <span className="text-[12px] font-mono tabular-nums text-[#737373]">
                  선택됨 {(invoiceInfo?.joins || []).length}종목
                </span>
              </div>

              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {categorysArray?.length > 0 ? (
                  categorysArray.map((category, cIdx) => {
                    const {
                      contestCategoryId: categoryId,
                      contestCategoryIndex: categoryIndex,
                      contestCategoryTitle: categoryTitle,
                    } = category;

                    const matchedGrades = gradesArray
                      .filter((grade) => grade.refCategoryId === categoryId)
                      .sort(
                        (a, b) => a.contestGradeIndex - b.contestGradeIndex
                      );

                    const selectedJoin = invoiceInfo?.joins?.find(
                      (join) => join.contestCategoryId === categoryId
                    );
                    const isSelected = Boolean(selectedJoin);

                    const selectVal = selectedJoin
                      ? selectedJoin.contestGradeId
                      : "체급선택";

                    return (
                      <div
                        key={categoryId || cIdx}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-[8px] border transition-colors duration-150 ${
                          isSelected
                            ? "bg-[#2563eb]/[0.06] border-[#2563eb]/40"
                            : "bg-[#fafafa] border-[#171717]/[0.08] hover:border-[#171717]/[0.16]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <BibTag
                            number={categoryIndex ?? cIdx + 1}
                            size="sm"
                            variant={isSelected ? "active" : "default"}
                          />
                          <span
                            className={`text-[14px] font-medium ${
                              isSelected ? "text-[#2563eb]" : "text-[#171717]"
                            }`}
                          >
                            {categoryTitle}
                          </span>
                        </div>

                        <select
                          id={categoryId}
                          name={categoryTitle}
                          value={selectVal}
                          onChange={(e) => handleJoins(e)}
                          className={`h-9 sm:w-52 rounded-[8px] px-3 text-[13px] font-medium focus:outline-none transition-colors duration-150 ${
                            isSelected
                              ? "bg-white border border-[#2563eb]/50 text-[#2563eb]"
                              : "bg-white border border-[#171717]/[0.12] text-[#525252]"
                          }`}
                        >
                          <option value="체급선택">체급선택</option>
                          {matchedGrades?.length > 0 &&
                            matchedGrades.map((match, mIdx) => {
                              const {
                                contestGradeId: gradeId,
                                contestGradeTitle: gradeTitle,
                              } = match;

                              return (
                                <option
                                  key={gradeId || mIdx}
                                  id={gradeId}
                                  value={gradeId}
                                >
                                  {gradeTitle}
                                </option>
                              );
                            })}
                        </select>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-[13px] text-[#737373]">
                    등록된 종목이 없습니다
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#171717]/[0.06] flex justify-end">
                <button
                  type="button"
                  onClick={() => handleAddInvoice(invoiceInfo)}
                  className="w-full sm:w-auto h-10 px-6 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[14px] font-medium inline-flex items-center justify-center gap-2 transition-colors duration-150"
                >
                  <UserPlus size={16} strokeWidth={1.5} />
                  <span>최종명단 강제 등록</span>
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="bg-white rounded-[12px] border border-[#171717]/[0.08] p-10 text-center text-[14px] text-[#737373]">
            상단에서 대회를 먼저 선택해주세요
          </div>
        )}
      </div>
    </div>
  );
};

export default ContestForceManual;
