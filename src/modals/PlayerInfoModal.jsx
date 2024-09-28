import React, { useContext, useEffect, useRef, useState } from "react";
import { BiCategory } from "react-icons/bi";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { v4 as uuidv4 } from "uuid";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { TbUsers } from "react-icons/tb";

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
    <div className="flex w-full flex-col gap-y-2 h-auto">
      <div className="flex w-full h-14">
        <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
          <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
            <TbUsers />
          </span>
          <h1
            className="font-sans text-lg font-semibold"
            style={{ letterSpacing: "2px" }}
          >
            {propState?.title || ""}
          </h1>
        </div>
      </div>
      <div className="flex bg-gradient-to-r from-blue-200 to-cyan-200 p-3 rounded-lg">
        <div className="flex w-full bg-gray-100 h-auto rounded-lg justify-start items-start lg:items-center gay-y-2 flex-col p-2 gap-y-2">
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                출전순서
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  value={playerInfo.contestPlayerIndex}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (playerInfoRef.current.contestPlayerIndex = ref)
                  }
                  name="contestPlayerName"
                  className="h-12 outline-none"
                  placeholder="출전순서(숫자)"
                />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                이름
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  value={playerInfo.contestPlayerName}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (playerInfoRef.current.contestPlayerName = ref)}
                  name="contestPlayerName"
                  className="h-12 outline-none"
                />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                소속
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="contestPlayerPromoter"
                  value={playerInfo.contestPlayerPromoter}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (playerInfoRef.current.contestPlayerPromoter = ref)
                  }
                  className="h-12 outline-none"
                />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                연락처
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="contestPlayerPhoneNumber"
                  value={playerInfo.contestPlayerPhoneNumber}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (playerInfoRef.current.contestPlayerPhoneNumber = ref)
                  }
                  className="h-12 outline-none"
                />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                이메일
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="email"
                  name="contestPlayerEmail"
                  value={playerInfo.contestPlayerEmail}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (playerInfoRef.current.contestPlayerEmail = ref)
                  }
                  className="h-12 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                성별
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg ">
              <div className="flex w-full justify-start items-center h-12">
                <select
                  name="contestPlayerGender"
                  onChange={(e) => handleInputValues(e)}
                  value={playerInfo.contestPlayerGender}
                  ref={(ref) =>
                    (playerInfoRef.current.contestPlayerGender = ref)
                  }
                  className="w-full h-full pl-2"
                >
                  <option>남</option>
                  <option>여</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center h-auto ">
            <div className="flex w-1/4 justify-end mr-2 h-28 items-start">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                출전동기
              </h3>
            </div>
            <div className="h-28 w-3/4 rounded-lg px-3 bg-white pt-1">
              <div className="flex w-full justify-start items-center">
                <textarea
                  name="contestPlayerText"
                  value={playerInfo.contestPlayerText}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) => (playerInfoRef.current.contestPlayerText = ref)}
                  className="h-24 outline-none w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex w-full gap-x-2 h-auto">
        <button
          className="w-full h-12 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-lg"
          onClick={() => handleUpdatePlayers()}
        >
          저장
        </button>
        <button
          className="w-full h-12 bg-gradient-to-r from-blue-300 to-cyan-300 rounded-lg"
          onClick={() => setClose()}
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default PlayerInfoModal;
