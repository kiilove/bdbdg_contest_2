// utils/getClientIp.js
export const getClientIp = async () => {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || null;
  } catch (e) {
    console.error("IP 가져오기 실패:", e);
    return null;
  }
};
