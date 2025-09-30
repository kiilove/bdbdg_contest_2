import { Card, Col, Row, Statistic, Popover, List } from "antd";
import {
  CalendarOutlined,
  AppstoreOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const SummaryCards = ({
  categories,
  invoices,
  contestDate,
  noRegistrationCategories,
}) => {
  const totalCategories = categories?.length || 0;

  // ✅ 총 출전 인원 (중복 포함 = 번호표 수)
  const totalEntries = invoices.reduce(
    (sum, inv) => sum + (inv.joins?.length || 0),
    0
  );

  // ✅ 총 참가자 수 (고유 선수)
  const totalPlayers = new Set(invoices.map((inv) => inv.playerUid)).size;

  const noPlayersList = noRegistrationCategories || [];
  const noPlayers = noPlayersList.length;

  const getCategoryDisplayName = (c) =>
    c.contestCategoryTitle ||
    c.contestCategoryName ||
    c?.contestCategoryInfo?.name ||
    "이름 없는 카테고리";

  const formatDDay = (dateStr) => {
    if (!dateStr) return "정보 없음";
    const target = dayjs(dateStr, "YYYY-MM-DD", true);
    if (!target.isValid()) return "정보 없음";
    const diff = target.startOf("day").diff(dayjs().startOf("day"), "day");
    if (diff === 0) return "오늘";
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  };

  const dDayText = formatDDay(contestDate);

  const getDDayColor = (dDayText) => {
    if (dDayText === "오늘") return "#ff4d4f";
    if (dDayText.includes("D-")) {
      const days = Number.parseInt(dDayText.replace("D-", ""));
      if (days <= 3) return "#ff7a45";
      if (days <= 7) return "#ffa940";
      return "#52c41a";
    }
    return "#8c8c8c";
  };

  const getNoPlayersColor = () => (noPlayers > 0 ? "#ff4d4f" : "#52c41a");

  return (
    <Row gutter={[16, 16]} className="mb-6">
      {/* D-Day */}
      <Col xs={24} sm={12} md={6}>
        <Card
          className="h-full shadow-md hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-blue-500"
          bodyStyle={{ padding: "20px" }}
        >
          <Statistic
            title={
              <div className="flex items-center gap-2 text-gray-600 font-medium">
                <CalendarOutlined className="text-blue-500" />
                대회 D-Day
              </div>
            }
            value={dDayText}
            valueStyle={{
              color: getDDayColor(dDayText),
              fontSize: "24px",
              fontWeight: "bold",
            }}
          />
        </Card>
      </Col>

      {/* 총 카테고리 */}
      <Col xs={24} sm={12} md={6}>
        <Card
          className="h-full shadow-md hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-green-500"
          bodyStyle={{ padding: "20px" }}
        >
          <Statistic
            title={
              <div className="flex items-center gap-2 text-gray-600 font-medium">
                <AppstoreOutlined className="text-green-500" />총 종목 수
              </div>
            }
            value={totalCategories}
            suffix="개"
            valueStyle={{
              color: "#52c41a",
              fontSize: "24px",
              fontWeight: "bold",
            }}
          />
        </Card>
      </Col>

      {/* 총 참가자 (고유 / 총 출전) */}
      <Col xs={24} sm={12} md={6}>
        <Card
          className="h-full shadow-md hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-purple-500"
          bodyStyle={{ padding: "20px" }}
        >
          <Statistic
            title={
              <div className="flex items-center gap-2 text-gray-600 font-medium">
                <UserOutlined className="text-purple-500" />총 참가 인원수 / 총
                참가 번호수
              </div>
            }
            value={`${totalPlayers}명 / ${totalEntries}명`}
            valueStyle={{
              color: "#722ed1",
              fontSize: "22px",
              fontWeight: "bold",
            }}
          />
        </Card>
      </Col>

      {/* 미달 종목 */}
      <Col xs={24} sm={12} md={6}>
        <Popover
          placement="top"
          content={
            noPlayers > 0 ? (
              <List
                size="small"
                dataSource={noPlayersList}
                renderItem={(c) => (
                  <List.Item>{getCategoryDisplayName(c)}</List.Item>
                )}
              />
            ) : (
              "모든 체급에 참가자가 있습니다."
            )
          }
          trigger="hover"
        >
          <Card
            className="h-full shadow-md hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-orange-500 cursor-pointer"
            bodyStyle={{ padding: "20px" }}
          >
            <Statistic
              title={
                <div className="flex items-center gap-2 text-gray-600 font-medium">
                  <ExclamationCircleOutlined className="text-orange-500" />
                  미달 종목
                </div>
              }
              value={noPlayers > 0 ? `${noPlayers} 개` : "없음"}
              valueStyle={{
                color: getNoPlayersColor(),
                fontSize: "24px",
                fontWeight: "bold",
              }}
            />
          </Card>
        </Popover>
      </Col>
    </Row>
  );
};

export default SummaryCards;
