import { useState, useEffect } from "react";
import {
  ref,
  push,
  set,
  update,
  remove,
  onValue,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";
import { database } from "../firebase";
import {
  isValidRealtimePath,
  sanitizeForRealtimeDb,
} from "../utils/firestoreSanitize";

// 다중 문서를 실시간으로 구독하는 훅 (필터링 적용)
export function useFirebaseRealtimeQuery(collectionInfo, fieldName, value) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isValidRealtimePath(collectionInfo) || !fieldName || value === undefined) {
      setData([]);
      setLoading(false);
      return;
    }

    const dataRef = ref(database, collectionInfo);
    const queryRef = query(dataRef, orderByChild(fieldName), equalTo(value));

    setLoading(true);
    setError(null);

    const unsubscribe = onValue(
      queryRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const rawVal = snapshot.val();
          if (rawVal && typeof rawVal === "object" && !Array.isArray(rawVal)) {
            const documents = Object.entries(rawVal).map(([id, item]) =>
              item && typeof item === "object" && !Array.isArray(item)
                ? { id, ...item }
                : { id, value: item }
            );
            setData(documents);
          } else {
            setData([]);
          }
        } else {
          setData([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firebase onValue 에러:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [collectionInfo, fieldName, value]);

  return {
    data,
    loading,
    error,
  };
}

// 단일 문서를 실시간으로 구독하는 훅
export function useFirebaseRealtimeGetDocument(collectionInfo) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isValidRealtimePath(collectionInfo)) {
      setData(null);
      setLoading(false);
      return;
    }

    const dataRef = ref(database, collectionInfo);

    setLoading(true);
    setError(null);

    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const rawVal = snapshot.val();
          if (rawVal && typeof rawVal === "object" && !Array.isArray(rawVal)) {
            setData({ id: snapshot.key, ...rawVal });
          } else {
            setData({ id: snapshot.key, value: rawVal });
          }
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firebase onValue 에러:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [collectionInfo]);

  return {
    data,
    loading,
    error,
  };
}

// 데이터 추가 훅
export function useFirebaseRealtimeAddData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const addData = async (collectionInfo, newData, key = null) => {
    const targetPath = key ? `${collectionInfo}/${key}` : collectionInfo;
    if (!isValidRealtimePath(targetPath)) {
      const err = new Error(
        `유효하지 않은 Realtime DB 경로입니다: ${String(targetPath)}`
      );
      console.error("데이터 추가 경로 차단:", err);
      setError(err);
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const cleanData = sanitizeForRealtimeDb(newData) ?? {};
      let dataRef;
      if (key) {
        dataRef = ref(database, targetPath);
        await set(dataRef, cleanData);
      } else {
        dataRef = push(ref(database, collectionInfo));
        await set(dataRef, cleanData);
      }

      const newId = dataRef.key;
      const resultObj =
        cleanData && typeof cleanData === "object" && !Array.isArray(cleanData)
          ? { id: newId, ...cleanData }
          : { id: newId, value: cleanData };

      setData(resultObj);
      setLoading(false);
      return resultObj;
    } catch (err) {
      console.error("데이터 추가 에러:", err);
      setError(err);
      setLoading(false);
      return null;
    }
  };

  return { data, loading, error, addData };
}

// 데이터 업데이트 훅
export function useFirebaseRealtimeUpdateData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateData = async (collectionInfo, newData) => {
    if (!isValidRealtimePath(collectionInfo)) {
      const err = new Error(
        `유효하지 않은 Realtime DB 업데이트 경로입니다: ${String(collectionInfo)}`
      );
      console.error("데이터 업데이트 경로 차단:", err);
      setError(err);
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const cleanData = sanitizeForRealtimeDb(newData);
      if (!cleanData || typeof cleanData !== "object" || Array.isArray(cleanData)) {
        const err = new Error("Realtime DB updateData에는 유효한 객체가 필요합니다.");
        setError(err);
        setLoading(false);
        return null;
      }

      const dataRef = ref(database, collectionInfo);
      await update(dataRef, cleanData);

      setData({ ...cleanData });
      setLoading(false);
      return { ...cleanData };
    } catch (err) {
      console.error("데이터 업데이트 에러:", err);
      setError(err);
      setLoading(false);
      return null;
    }
  };

  return { data, loading, error, updateData };
}

// 데이터 삭제 훅
export function useFirebaseRealtimeDeleteData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deleteData = async (collectionInfo) => {
    // 최상위 루트("") 및 단일 1단계 컬렉션명만 넘어온 경우(슬래시 없는 루트 컬렉션 전체 삭제 위험) 원천 차단
    if (
      !isValidRealtimePath(collectionInfo) ||
      !String(collectionInfo).trim().replace(/^\/+|\/+$/g, "").includes("/")
    ) {
      const err = new Error(
        `안전하지 않은 Realtime DB 삭제 경로가 차단되었습니다: ${String(
          collectionInfo
        )}`
      );
      console.error(err);
      setError(err);
      return false;
    }

    try {
      setLoading(true);
      setError(null);
      const dataRef = ref(database, collectionInfo);
      await remove(dataRef);
      setLoading(false);
      return true;
    } catch (err) {
      console.error("데이터 삭제 에러:", err);
      setError(err);
      setLoading(false);
      return false;
    }
  };

  return { loading, error, deleteData };
}
