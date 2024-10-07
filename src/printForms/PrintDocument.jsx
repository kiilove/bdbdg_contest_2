// PrintDocument.js
import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// 1. 폰트 등록
Font.register({
  family: "NotoSans",
  src: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap",
});

const styles = StyleSheet.create({
  body: {
    padding: 10,
    fontFamily: "NotoSans", // 사용 폰트 지정
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  table: {
    display: "table",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableCol: {
    width: "20%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
  },
  tableCell: {
    fontSize: 12,
    textAlign: "center",
  },
});

const PrintDocument = ({ contestTitle, categories }) => (
  <Document>
    {categories.map((category, idx) => (
      <Page key={idx} size="A4" style={styles.body}>
        <Text style={styles.title}>{contestTitle} 계측명단</Text>
        <Text style={styles.title}>{category.contestCategoryTitle}</Text>
        {category.grades.map((grade, gradeIdx) => (
          <View key={gradeIdx} style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableCol}>순번</Text>
              <Text style={styles.tableCol}>선수번호</Text>
              <Text style={styles.tableCol}>이름</Text>
              <Text style={styles.tableCol}>신장/체중</Text>
              <Text style={styles.tableCol}>비고</Text>
            </View>
            {grade.players.map((player, playerIdx) => (
              <View key={playerIdx} style={styles.tableRow}>
                <Text style={styles.tableCell}>{playerIdx + 1}</Text>
                <Text style={styles.tableCell}>{player.playerNumber}</Text>
                <Text style={styles.tableCell}>{player.playerName}</Text>
                <Text style={styles.tableCell}>/</Text>
                <Text style={styles.tableCell}></Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    ))}
  </Document>
);

export default PrintDocument;
