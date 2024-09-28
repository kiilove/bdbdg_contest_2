import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MenuArray } from "./Menus"; // MenuArray는 초기 값
import { CurrentContestContext } from "../contexts/CurrentContestContext";
import { MdLogout } from "react-icons/md";

const Drawbar = ({ setOpen }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null); // 유저 정보 상태
  const [menuVisible, setMenuVisible] = useState({
    menuId: null,
    isHidden: true,
  });
  const [menuItem, setMenuItem] = useState([...MenuArray]); // MenuArray를 상태로 복사
  const [loading, setLoading] = useState(true); // 로딩 상태

  const { currentContest } = useContext(CurrentContestContext);
  const contestId = currentContest?.contests?.id;

  // sessionStorage에서 유저 정보를 불러와 상태 업데이트
  useEffect(() => {
    const userParser = JSON.parse(sessionStorage.getItem("user"));
    if (userParser && userParser.userGroup) {
      setUser(userParser);
      setLoading(false);
    } else {
      setLoading(false); // 유저 정보가 없을 때도 로딩을 중지
    }
  }, []);

  // 유저 정보가 업데이트된 후 메뉴 필터링
  useEffect(() => {
    if (user) {
      const filteredMenu = MenuArray.map((menu) => {
        return {
          ...menu,
          subMenus: menu.subMenus?.filter((subMenu) => subMenu.isActive),
        };
      });
      setMenuItem(filteredMenu); // 필터링된 메뉴로 상태 업데이트
    }
  }, [user]);

  const handleMenuClick = (id) => {
    const selectedMenu = menuItem.find((menu) => menu.id === id);

    if (selectedMenu?.subMenus) {
      setMenuVisible((prevState) => ({
        menuId: id,
        isHidden: prevState.menuId === id ? !prevState.isHidden : false,
      }));
    } else {
      const link = selectedMenu.link.includes("/screen1")
        ? `${selectedMenu.link}/${contestId}`
        : selectedMenu.link;

      navigate(link);

      setMenuVisible({
        menuId: id,
        isHidden: true,
      });
    }
  };

  const handleSubMenuClick = (parentId, subId) => {
    const parentMenu = menuItem.find((menu) => menu.id === parentId);
    const subMenu = parentMenu?.subMenus.find((sub) => sub.id === subId);

    if (subMenu?.link) {
      const linkWithContestId = subMenu.link.includes("/screen1")
        ? `${subMenu.link}/${contestId}`
        : subMenu.link;

      setOpen();
      navigate(linkWithContestId);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    navigate("/login");
  };

  // 로딩 중일 때는 렌더링을 지연
  if (loading) {
    return null; // 로딩 중에는 아무것도 표시하지 않음
  }

  return (
    <div className="flex flex-col w-full bg-sky-800 h-screen">
      <div className="flex w-full justify-center items-center h-16 ">
        <h1 className="text-white" style={{ fontSize: 21 }}>
          대회관리시스템
        </h1>
      </div>
      {menuItem
        .filter((menu) => menu.isActive === true)
        .map((menu) => (
          <div key={menu.id} className="flex flex-col">
            <div
              className={`${
                menuVisible.menuId === menu.id && "bg-sky-800"
              } flex w-full h-14 justify-start items-center hover:bg-sky-900 hover:text-white  text-gray-300 md:px-1 lg:px-3`}
              onClick={() => handleMenuClick(menu.id)}
            >
              <div className="flex justify-between w-full items-center">
                <div className="flex">
                  <button className="flex w-full h-10 justify-start items-center ml-4">
                    <div className="flex justify-start items-center">
                      <span className="mr-2">{menu.icon}</span>
                      <span className="">{menu.title}</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            {menuVisible.menuId === menu.id &&
              menuVisible.isHidden === false &&
              menu?.subMenus && (
                <div className="flex flex-col text-gray-200 text-base bg-sky-700 w-full">
                  {menu.subMenus
                    .filter((sub) => sub.isActive === true)
                    .map((subMenu) => (
                      <div className="flex w-full" key={subMenu.id}>
                        <div className="flex w-full h-12">
                          <button
                            className="py-2 px-10 hover:text-gray-200 w-full flex justify-start items-center"
                            onClick={() => {
                              handleSubMenuClick(menu.id, subMenu.id);
                            }}
                          >
                            <div className="flex justify-start items-center">
                              <span className="text-base text-white mr-2">
                                {subMenu.icon}
                              </span>
                              <span className="text-sm text-white">
                                {subMenu.title}
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
          </div>
        ))}
      <div className="flex w-full justify-between items-end h-16 px-5">
        <button onClick={() => setOpen(false)}>
          <span className="text-base text-gray-200">닫기</span>
        </button>
        <button onClick={() => handleLogout()}>
          <span className="text-lg text-gray-200">
            <MdLogout />
          </span>
        </button>
      </div>
    </div>
  );
};

export default Drawbar;
