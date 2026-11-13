import React, { useContext, useEffect, useRef, useState } from "react";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { v4 as uuidv4 } from "uuid";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { Users } from "lucide-react";

const initPlayerInfo = {
  contestPlayerIndex: "",
  contestPlayerId: "",
  contestPlayerName: "",
  contestPlayerPromoter: "",
  contestPlayerText: "",
  contestPlayerGender: "남",
  contestPlayerPhoneNumber: "",
  contestPlayerEmail: "",
};

const PlayerInfoModal = ({ setClose, propState, setState }) => {
  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );
  const [playerInfo, setPlayerInfo] = useState({
    ...initPlayerInfo,
  });
  const [playerList, setPlayerList] = useState({});
  const [playerArray, setPlayerArray] = useState([]);

  const playerInfoRef = useRef({});

  const contestInvoiceDocument = useFirestoreGetDocument(
    "contest_invoices_list"
  );
  const contestCategoryUpdate = useFirestoreUpdateData("contest_invoices_list");

  const getInvoice = async () => {
    const returnInvoices = await contestInvoiceDocument.getDocument(
      currentContest.contests.contestInvoicesListId
    );
    setPlayerList({ ...returnInvoices });
    setPlayerArray([...returnInvoices.players]);
  };

  const handleUpdatePlayers = async () => {
    if (
      playerInfoRef.current.contestPlayerName.value === "" ||
      playerInfoRef.current.contestPlayerPromoter.value === ""
    ) {
      return;
    }
    const updatedPlayerInfo = Object.keys(playerInfoRef.current).reduce(
      (updatedInfo, key) => {
        const currentElement = playerInfoRef.current[key];
        updatedInfo[key] =
          currentElement.type === "checkbox"
            ? currentElement.checked
            : currentElement.value;
        return updatedInfo;
      },
      {}
    );

    setPlayerInfo((prevInfo) => ({
      ...prevInfo,
      ...updatedPlayerInfo,
      contestPlayerIndex: parseInt(updatedPlayerInfo.contestPlayerIndex),
    }));

    const dummy = [...playerArray];

    switch (propState.title) {
      case "선수추가":
        dummy.push({
          ...updatedPlayerInfo,
          contestPlayerId: uuidv4(),
          contestPlayerIndex: parseInt(updatedPlayerInfo.contestPlayerIndex),
        });

        await handleSaveCategorys(dummy);
        setPlayerArray(dummy);
        setState(dummy);
        setPlayerInfo({
          ...initPlayerInfo,
        });

        playerInfoRef.current.contestPlayerName.focus();

        break;

      case "신청서수정":
        const findPlayerIndex = dummy.findIndex(
          (player) => player.contestPlayerId === propState.playerId
        );

        if (findPlayerIndex !== -1) {
          dummy.splice(findPlayerIndex, 1, {
            ...dummy[findPlayerIndex],
            ...updatedPlayerInfo,
            contestPlayerIndex: parseInt(updatedPlayerInfo.contestPlayerIndex),
          });
          await handleSaveCategorys(dummy);
          setPlayerArray(dummy);
          setState(dummy);
        }
        break;

      default:
        break;
    }
  };

  const handleSaveCategorys = async (data) => {
    try {
      await contestCategoryUpdate.updateData(
        currentContest.contests.contestInvoicesListId,
        { ...playerList, categorys: [...data] }
      );
    } catch (error) {
      console.log(error);
    }
  };

  const handleInputValues = (e) => {
    const { name, value } = e.target;

    setPlayerInfo({
      ...playerInfo,
      [name]: value,
    });
  };

  useEffect(() => {
    getInvoice();
    if (propState.title === "신청서수정") {
      setPlayerInfo({ ...propState.info });
    }
    playerInfoRef.current.contestPlayerName.focus();
  }, []);

  useEffect(() => {
    console.log(propState);
  }, [propState]);

  return (
    <div className="flex w-full flex-col gap-4 h-auto bg-[#ffffff] text-[#171717] p-2">
      <div className="flex w-full items-center gap-2.5 pb-3 border-b border-[#171717]/[0.08]">
        <div className="w-8 h-8 rounded-[8px] bg-[#f4f4f5] border border-[#171717]/[0.08] flex items-center justify-center">
          <Users size={15} strokeWidth={1.5} className="text-[#525252]" />
        </div>
        <h1 className="text-base font-semibold text-[#171717] m-0">
          {propState?.title || "선수 정보"}
        </h1>
      </div>

      <div className="bg-[#fafafa] rounded-[12px] border border-[#171717]/[0.08] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            출전 순서
          </label>
          <input
            type="text"
            value={playerInfo.contestPlayerIndex ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (playerInfoRef.current.contestPlayerIndex = ref)}
            name="contestPlayerIndex"
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm font-mono tabular-nums text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
            placeholder="출전 순서 (숫자)"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            이름
          </label>
          <input
            type="text"
            value={playerInfo.contestPlayerName ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (playerInfoRef.current.contestPlayerName = ref)}
            name="contestPlayerName"
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            소속
          </label>
          <input
            type="text"
            name="contestPlayerPromoter"
            value={playerInfo.contestPlayerPromoter ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (playerInfoRef.current.contestPlayerPromoter = ref)}
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            연락처
          </label>
          <input
            type="text"
            name="contestPlayerPhoneNumber"
            value={playerInfo.contestPlayerPhoneNumber ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) =>
              (playerInfoRef.current.contestPlayerPhoneNumber = ref)
            }
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm font-mono tabular-nums text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            이메일
          </label>
          <input
            type="email"
            name="contestPlayerEmail"
            value={playerInfo.contestPlayerEmail ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (playerInfoRef.current.contestPlayerEmail = ref)}
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right">
            성별
          </label>
          <select
            name="contestPlayerGender"
            onChange={(e) => handleInputValues(e)}
            value={playerInfo.contestPlayerGender}
            ref={(ref) => (playerInfoRef.current.contestPlayerGender = ref)}
            className="h-9 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] px-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150"
          >
            <option>남</option>
            <option>여</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] items-start gap-2">
          <label className="text-xs font-medium text-[#525252] sm:text-right pt-2">
            출전 동기
          </label>
          <textarea
            name="contestPlayerText"
            value={playerInfo.contestPlayerText ?? ""}
            onChange={(e) => handleInputValues(e)}
            ref={(ref) => (playerInfoRef.current.contestPlayerText = ref)}
            className="h-24 w-full rounded-[8px] border border-[#171717]/[0.14] bg-[#ffffff] p-3 text-sm text-[#171717] outline-none focus:border-[#2563eb] transition-colors duration-150 resize-none"
          />
        </div>
      </div>

      <div className="flex w-full justify-end gap-2 pt-1">
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#171717] text-xs font-medium border border-[#171717]/[0.08] transition-colors duration-150 cursor-pointer"
          onClick={() => setClose()}
        >
          닫기
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 px-5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors duration-150 cursor-pointer border-0"
          onClick={() => handleUpdatePlayers()}
        >
          저장
        </button>
      </div>
    </div>
  );
};

export default PlayerInfoModal;
