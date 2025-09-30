import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, Layout, Drawer, Button, Typography } from "antd";
import { MenuOutlined, CloseOutlined } from "@ant-design/icons";
import LoadingPage from "../pages/LoadingPage";
import { MenuArray } from "../components/Menus";
import { useMediaQuery } from "react-responsive";
import { CurrentContestContext } from "../contexts/CurrentContestContext";

const { Header, Content } = Layout;
const { Title } = Typography;

const ManagementHome = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userInfo, setUserInfo] = useState(null);
  const [isLoadingMain, setIsLoadingMain] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState([]); // openKeys 상태 추가
  const isTabletOrMobile = useMediaQuery({ query: "(max-width: 1024px)" });

  const { currentContest } = useContext(CurrentContestContext);

  // 사용자 정보 로드
  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUserInfo(parsedUser);
      } catch (e) {
        console.error("사용자 정보 파싱 오류:", e);

        navigate("/login");
      }
    } else {
      navigate("/login");
    }
    setIsLoadingMain(false);
  }, [navigate]);

  // MenuArray를 userGroup에 따라 필터링
  const filterMenu = (menus, userGroup) => {
    return menus
      .filter((menu) => menu.requiredGroup.includes(userGroup))
      .map((menu) => {
        if (menu.title === "로그아웃") {
          return {
            key: menu.link,
            label: (
              <>
                {menu.icon}
                <span style={{ marginLeft: "8px" }}>{menu.title}</span>
              </>
            ),
            onClick: () => {
              sessionStorage.removeItem("user");
              navigate("/login");
              if (isTabletOrMobile) toggleDrawer();
            },
          };
        }
        if (menu.subMenus && menu.subMenus.length > 0) {
          const filteredSubMenus = menu.subMenus.filter((subMenu) =>
            subMenu.requiredGroup.includes(userGroup)
          );
          if (filteredSubMenus.length > 0) {
            return {
              key: menu.link,
              label: (
                <>
                  {menu.icon}
                  <span style={{ marginLeft: "8px" }}>{menu.title}</span>
                </>
              ),
              children: filteredSubMenus.map((subMenu) => ({
                key: subMenu.link,
                label: (
                  <>
                    {subMenu.icon}
                    <span style={{ marginLeft: "8px" }}>{subMenu.title}</span>
                  </>
                ),
                onClick: () => {
                  navigate(subMenu.link);
                  if (isTabletOrMobile) toggleDrawer();
                },
              })),
            };
          }
        } else {
          return {
            key: menu.link,
            label: (
              <>
                {menu.icon}
                <span style={{ marginLeft: "8px" }}>{menu.title}</span>
              </>
            ),
            onClick: () => {
              navigate(menu.link);
              if (isTabletOrMobile) toggleDrawer();
            },
          };
        }
      })
      .filter((menu) => menu !== null);
  };

  const filteredMenuItems = userInfo
    ? filterMenu(MenuArray, userInfo.userGroup)
    : [];

  // 드로어 토글 핸들러
  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
    if (!drawerOpen) setOpenKeys([]); // Drawer가 닫힐 때 모든 메뉴를 닫기
  };

  // 대분류 메뉴 클릭 시 서브메뉴 토글
  const onOpenChange = (keys) => {
    const latestOpenKey = keys.find((key) => !openKeys.includes(key));
    if (MenuArray.map((menu) => menu.link).includes(latestOpenKey)) {
      setOpenKeys(latestOpenKey ? [latestOpenKey] : []);
    } else {
      setOpenKeys(keys);
    }
  };

  return (
    <Layout className="min-h-screen">
      {isLoadingMain ? (
        <div className="flex w-full h-full justify-center items-center">
          <LoadingPage />
        </div>
      ) : (
        <Layout>
          {isTabletOrMobile ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 16px",
                  backgroundColor: "#003a8c",
                }}
              >
                <Button
                  icon={<MenuOutlined />}
                  onClick={toggleDrawer}
                  style={{
                    marginRight: "16px",
                    backgroundColor: "#0050b3",
                    color: "#fff",
                  }}
                >
                  메뉴
                </Button>
                <Title level={4} style={{ margin: 0, color: "#fff" }}>
                  대회 관리 시스템
                </Title>
              </div>
              <Drawer
                title={
                  <span
                    className="font-bold"
                    style={{ fontSize: "18px", color: "#fff" }}
                  >
                    {currentContest?.contestInfo?.contestTitle}
                  </span>
                }
                placement="left"
                closable={true}
                onClose={toggleDrawer}
                open={drawerOpen}
                style={{
                  backgroundColor: "#002864",
                }}
                closeIcon={<CloseOutlined style={{ color: "#fff" }} />}
              >
                <Menu
                  mode="inline"
                  items={filteredMenuItems}
                  selectable={false}
                  openKeys={openKeys}
                  onOpenChange={onOpenChange} // openChange 핸들러 추가
                  style={{
                    fontSize: "18px",
                    fontWeight: 500,
                    backgroundColor: "#002864",
                    height: "50px",
                  }}
                  theme="dark"
                />
              </Drawer>
            </>
          ) : (
            <Header
              style={{
                backgroundColor: "#003a8c",
                zIndex: 10,
                position: "sticky",
                top: 0,
                width: "100%",
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
              }}
            >
              <Title
                level={3}
                style={{
                  margin: 0,
                  color: "#fff",
                  flexShrink: 0,
                  marginRight: "20px",
                }}
              >
                대회 관리 시스템
              </Title>
              <Menu
                mode="horizontal"
                items={filteredMenuItems}
                theme="dark"
                selectable={false}
                selectedKeys={[location.pathname]}
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  backgroundColor: "#003a8c",
                  zIndex: 10,
                  flexGrow: 1,
                }}
                itemStyle={{
                  padding: "12px 20px",
                  height: "50px",
                  color: "#fff",
                }}
              />
            </Header>
          )}
          <Content style={{ padding: isTabletOrMobile ? "1px" : "24px" }}>
            <div
              style={{
                padding: 0,
                margin: 0,
                minHeight: 280,
                background: "#fff",
              }}
            >
              {children}
            </div>
          </Content>
        </Layout>
      )}
    </Layout>
  );
};

export default ManagementHome;
