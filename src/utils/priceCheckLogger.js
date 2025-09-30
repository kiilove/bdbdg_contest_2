// utils/priceCheckLogger.js

import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { getClientIp } from "./getClientIp";

/**
 * 참가 신청서 가격확인 로그 기록
 * @param {Object} options
 * @param {"add" | "del"} options.action  - "add" or "del"
 * @param {Object} options.invoice        - 클릭된 인보이스 전체 객체
 * @param {Object} options.sessionUser    - 현재 로그인한 사용자 세션 정보
 * @param {Object} options.currentContest - CurrentContestContext 값
 */
export const writePriceCheckLog = async ({
  action,
  invoice,
  sessionUser,
  currentContest,
}) => {
  if (!currentContest?.contests?.id) {
    console.warn("⚠️ contests.id 가 없습니다. 로그를 기록할 수 없습니다.");
    return;
  }

  const clientIp = await getClientIp();

  try {
    const logRef = collection(
      db,
      "contests",
      currentContest.contests.id,
      "priceCheckLogs"
    );

    await addDoc(logRef, {
      action, // add | del
      invoiceId: invoice.id,
      playerUid: invoice.playerUid || null,
      playerName: invoice.playerName || null,
      playerGym: invoice.playerGym || null,
      timestamp: new Date().toISOString(),
      clientInfo: {
        userID: sessionUser?.userID || null,
        userGroup: sessionUser?.userGroup || null,
        userContext: sessionUser?.userContext || null,
        userDocId: sessionUser?.id || null,
        clientDevice:
          typeof window !== "undefined" ? navigator.userAgent : "server",
        clientIp: clientIp || null,
      },
      contestInfoSnapshot: currentContest?.contestInfo || null,
    });
  } catch (err) {
    console.error("❌ priceCheckLogs 기록 중 오류:", err);
  }
};
