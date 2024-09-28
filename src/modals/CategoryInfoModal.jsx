import React, { useContext, useEffect, useRef, useState } from "react";
import { BiCategory } from "react-icons/bi";
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { v4 as uuidv4 } from "uuid";
import {
  useFirestoreGetDocument,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import ConfirmationModal from "../messageBox/ConfirmationModal";

const initCategoryInfo = {
  contestCategoryId: "",
  contestCategoryIndex: "",
  contestCategoryTitle: "",
  contestCategorySection: "",
  contestCategroyGender: "남",
  contestCategoryPriceType: "기본참가비",
  contestCategroyIsOverall: "off",
  contestCategoryType: "",
  contestCategoryJudgeType: "ranking",
};

const CategoryInfoModal = ({ setClose, propState, setState, setRefresh }) => {
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setmessage] = useState({});
  const { currentContest, setCurrentContest } = useContext(
    CurrentContestContext
  );
  const [categoryInfo, setCategoryInfo] = useState({
    ...initCategoryInfo,
    contestCategoryIndex: parseInt(propState.count) + 1,
  });
  const [categorysList, setCategorysList] = useState({});
  const [categorysArray, setCategorysArray] = useState([]);

  const categoryInfoRef = useRef({});

  const contestCategoryDocument = useFirestoreGetDocument(
    "contest_categorys_list"
  );
  const contestCategoryUpdate = useFirestoreUpdateData(
    "contest_categorys_list"
  );

  const getCategorys = async () => {
    const returnCategorys = await contestCategoryDocument.getDocument(
      currentContest.contests.contestCategorysListId
    );
    setCategorysList({ ...returnCategorys });
    setCategorysArray([...returnCategorys.categorys]);
  };

  const handleUpdateCategorys = async () => {
    if (
      categoryInfoRef.current.contestCategoryIndex.value === "" ||
      categoryInfoRef.current.contestCategoryTitle.value === ""
    ) {
      return;
    }
    const updatedCategoryInfo = Object.keys(categoryInfoRef.current).reduce(
      (updatedInfo, key) => {
        const currentElement = categoryInfoRef.current[key];
        updatedInfo[key] =
          currentElement.type === "checkbox"
            ? currentElement.checked
            : currentElement.value;
        return updatedInfo;
      },
      {}
    );

    setCategoryInfo((prevInfo) => ({
      ...prevInfo,
      ...updatedCategoryInfo,
    }));

    const dummy = [...categorysArray];

    switch (propState.title) {
      case "종목추가":
        dummy.push({
          ...updatedCategoryInfo,
          contestCategoryId: uuidv4(),
          contestCategoryIndex: parseInt(
            updatedCategoryInfo.contestCategoryIndex
          ),
        });

        await handleSaveCategorys(dummy);
        setCategorysArray(dummy);
        setState(dummy);
        setCategoryInfo({
          ...initCategoryInfo,
          contestCategoryIndex:
            parseInt(updatedCategoryInfo.contestCategoryIndex) + 1,
          contestCategoryJudgeCount: parseInt(
            updatedCategoryInfo.contestCategoryJudgeCount
          ),
        });

        categoryInfoRef.current.contestCategorySection.focus();

        break;

      case "종목수정":
        const findCategoryIndex = dummy.findIndex(
          (category) => category.contestCategoryId === propState.categoryId
        );

        if (findCategoryIndex !== -1) {
          dummy.splice(findCategoryIndex, 1, {
            ...dummy[findCategoryIndex],
            ...updatedCategoryInfo,
            contestCategoryIndex: parseInt(
              updatedCategoryInfo.contestCategoryIndex
            ),
            contestCategoryJudgeCount: parseInt(
              updatedCategoryInfo.contestCategoryJudgeCount
            ),
          });
          await handleSaveCategorys(dummy);
          setCategorysArray(dummy);
          setState(dummy);
        }
        break;

      default:
        break;
    }
  };

  const handleSaveCategorys = async (data) => {
    try {
      await contestCategoryUpdate
        .updateData(currentContest.contests.contestCategorysListId, {
          ...categorysList,
          categorys: [...data],
        })
        .then(() => {
          setmessage({
            body: "저장되었습니다.",
            isButton: true,
            confirmButtonText: "확인",
          });
          setMsgOpen(true);
        });
    } catch (error) {
      console.log(error);
    }
  };

  const handleInputValues = (e) => {
    const { name, value } = e.target;

    if (name === "contestCategoryIsOverall") {
      setCategoryInfo({
        ...categoryInfo,
        contestCategoryIsOverall: e.target.checked,
      });
    } else if (name === "contestCategoryIndex") {
      setCategoryInfo({
        ...categoryInfo,
        contestCategoryIndex: parseInt(value),
      });
    } else {
      setCategoryInfo({
        ...categoryInfo,
        [name]: value,
      });
    }
  };

  useEffect(() => {
    getCategorys();
    if (propState.title === "종목수정") {
      setCategoryInfo({ ...propState.info });
    }
    categoryInfoRef.current.contestCategorySection.focus();
  }, []);

  useEffect(() => {
    console.log(propState);
  }, [propState]);

  return (
    <div className="flex w-full flex-col gap-y-2 h-auto">
      <ConfirmationModal
        isOpen={msgOpen}
        message={message}
        onCancel={() => {
          setRefresh(true);
          setClose();
        }}
        onConfirm={() => {
          setRefresh(true);
          setClose();
        }}
      />
      <div className="flex w-full h-14">
        <div className="flex w-full bg-gray-100 justify-start items-center rounded-lg px-3">
          <span className="font-sans text-lg font-semibold w-6 h-6 flex justify-center items-center rounded-2xl bg-blue-400 text-white mr-3">
            <BiCategory />
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
                개최순서
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  value={categoryInfo.contestCategoryIndex}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryIndex = ref)
                  }
                  name="contestCategoryIndex"
                  className="h-12 outline-none"
                  placeholder="개최순서(숫자)"
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
                구분
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="contestCategorySection"
                  value={categoryInfo.contestCategorySection}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategorySection = ref)
                  }
                  className="h-12 outline-none"
                  placeholder="예)1부, 2부"
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
                종목대분류
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="contestCategoryType"
                  placeholder="예)피지크, 보디빌딩"
                  value={categoryInfo.contestCategoryType}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryType = ref)
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
                종목명
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="contestCategoryTitle"
                  value={categoryInfo.contestCategoryTitle}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryTitle = ref)
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
                참가가능성별
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg ">
              <div className="flex w-full justify-start items-center h-12">
                <select
                  name="contestCategoryGender"
                  onChange={(e) => handleInputValues(e)}
                  value={categoryInfo.contestCategoryGender}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryGender = ref)
                  }
                  className="w-full h-full pl-2"
                >
                  <option>남</option>
                  <option>여</option>
                  <option>무관</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                참가비종류
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg ">
              <div className="flex w-full justify-start items-center h-12">
                <select
                  name="contestCategoryPriceType"
                  onChange={(e) => handleInputValues(e)}
                  value={categoryInfo.contestCategoryPriceType}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryPriceType = ref)
                  }
                  className="w-full h-full pl-2"
                >
                  <option>기본참가비</option>
                  <option>타입1</option>
                  <option>타입2</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                심사종류
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg ">
              <div className="flex w-full justify-start items-center h-12">
                <select
                  name="contestCategoryJudgeType"
                  onChange={(e) => handleInputValues(e)}
                  value={categoryInfo.contestCategoryJudgeType}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryJudgeType = ref)
                  }
                  className="w-full h-full pl-2"
                >
                  <option
                    value="ranking"
                    selected={
                      categoryInfo.contestCategoryJudgeType === "ranking"
                    }
                  >
                    랭킹형
                  </option>
                  <option
                    value="point"
                    selected={categoryInfo.contestCategoryJudgeType === "point"}
                  >
                    점수형
                  </option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex w-full justify-start items-center ">
            <div className="flex w-1/4 justify-end mr-2">
              <h3
                className="font-sans font-semibold"
                style={{ letterSpacing: "2px" }}
              >
                심판수
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg px-3 bg-white">
              <div className="flex w-full justify-start items-center">
                <input
                  type="text"
                  name="contestCategoryJudgeCount"
                  value={categoryInfo.contestCategoryJudgeCount}
                  onChange={(e) => handleInputValues(e)}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryJudgeCount = ref)
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
                오버롤종목
              </h3>
            </div>
            <div className="h-12 w-3/4 rounded-lg ">
              <div className="flex w-full justify-start items-center h-12">
                <input
                  type="checkbox"
                  name="contestCategoryIsOverall"
                  checked={categoryInfo.contestCategoryIsOverall}
                  ref={(ref) =>
                    (categoryInfoRef.current.contestCategoryIsOverall = ref)
                  }
                  onChange={(e) => handleInputValues(e)}
                  className="w-6"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex w-full gap-x-2 h-auto">
        <button
          className="w-full h-12 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-lg"
          onClick={() => handleUpdateCategorys()}
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

export default CategoryInfoModal;
