import { useState, useEffect } from "react";
import {
  get,
  ref,
  push,
  set,
  update,
  remove,
  onValue,
} from "firebase/database";
import { database } from "../firebase";

// 다중 문서를 실시간으로 구독하는 훅
import { query, orderByChild, equalTo } from "firebase/database";

// 다중 문서를 실시간으로 구독하는 훅 (필터링 적용)
export function useFirebaseRealtimeQuery(collectionInfo, fieldName, value) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!collectionInfo || !fieldName || value === undefined) {
      console.warn(
        "useFirebaseRealtimeQuery: collectionInfo, fieldName 또는 value가 제공되지 않았습니다."
      );
      setLoading(false);
      return;
    }

    const dataRef = ref(database, collectionInfo);
    const queryRef = query(dataRef, orderByChild(fieldName), equalTo(value));

    setLoading(true);

    const unsubscribe = onValue(
      queryRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const documents = Object.entries(snapshot.val()).map(
            ([id, data]) => ({
              id,
              ...data,
            })
          );
          setData(documents);
        } else {
          setData([]);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Firebase onValue 에러:", error);
        setError(error);
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
    if (!collectionInfo) {
      console.warn(
        "useFirebaseRealtimeGetDocument: collectionInfo가 제공되지 않았습니다."
      );
      setLoading(false);
      return;
    }

    const dataRef = ref(database, collectionInfo);

    setLoading(true);

    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.key, ...snapshot.val() });
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Firebase onValue 에러:", error);
        setError(error);
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

// Firebase Realtime DB는 객체 트리에 undefined가 포함되어 있으면 전체 쓰기가 실패(에러)하므로 안전하게 정제
const sanitizeFirebaseData = (obj) => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== "object") return obj;
  try {
    return JSON.parse(
      JSON.stringify(obj, (key, value) => (value === undefined ? null : value))
    );
  } catch {
    return obj;
  }
};

// 데이터 추가 훅
export function useFirebaseRealtimeAddData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const addData = async (collectionInfo, newData, key = null) => {
    try {
      setLoading(true);

      const cleanData = sanitizeFirebaseData(newData);
      let dataRef;
      if (key) {
        dataRef = ref(database, `${collectionInfo}/${key}`);
        await set(dataRef, cleanData);
      } else {
        dataRef = push(ref(database, collectionInfo));
        await set(dataRef, cleanData);
      }

      const newId = dataRef.key;

      setData({ id: newId, ...cleanData });
      setLoading(false);
      return { id: newId, ...cleanData };
    } catch (error) {
      console.error("데이터 추가 에러:", error);
      setError(error);
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
    try {
      setLoading(true);

      const cleanData = sanitizeFirebaseData(newData);
      const dataRef = ref(database, collectionInfo);
      await update(dataRef, cleanData);

      setData({ ...cleanData });
      setLoading(false);
      return { ...cleanData };
    } catch (error) {
      console.error("데이터 업데이트 에러:", error);
      setError(error);
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
    try {
      setLoading(true);
      const dataRef = ref(database, collectionInfo);
      await remove(dataRef);
      setLoading(false);
      return true;
    } catch (error) {
      console.error("데이터 삭제 에러:", error);
      setError(error);
      setLoading(false);
      return false;
    }
  };

  return { loading, error, deleteData };
}
