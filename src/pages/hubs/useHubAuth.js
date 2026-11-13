import { useMemo } from "react";

export const useIsAdmin = () => {
  return useMemo(() => {
    try {
      const raw = sessionStorage.getItem("user");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed?.userGroup === "admin";
    } catch {
      return false;
    }
  }, []);
};
