import { useState, useEffect } from "react";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";

function sanitizeFirestoreData(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined ? null : sanitizeFirestoreData(item)
    );
  }
  if (value.constructor === Object) {
    const sanitized = {};
    Object.keys(value).forEach((key) => {
      const val = value[key];
      if (val !== undefined) {
        sanitized[key] = sanitizeFirestoreData(val);
      }
    });
    return sanitized;
  }
  return value;
}

export function useFirestoreQuery() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function getDocuments(
    collectionName,
    conditions = [],
    orderByField = "",
    orderByDirection = "asc",
    limitNumber = 0
  ) {
    if (!collectionName) {
      setLoading(false);
      return [];
    }

    try {
      setLoading(true);

      let q = collection(db, collectionName);

      if (Array.isArray(conditions) && conditions.length > 0) {
        conditions.forEach((condition) => {
          if (!condition) return;
          if (Array.isArray(condition) && condition.length === 3) {
            q = query(q, where(condition[0], condition[1], condition[2]));
          } else {
            q = query(q, condition);
          }
        });
      }
      if (orderByField) {
        q = query(q, orderBy(orderByField, orderByDirection));
      }
      if (limitNumber) {
        q = query(q, limit(limitNumber));
      }

      const querySnapshot = await getDocs(q);

      const documents = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 데이터가 없는 경우에도 state를 초기화함

      setData(documents);
      setLoading(false);
      return documents;
    } catch (error) {
      console.error(error);
      setError(error);
      setLoading(false);
      return [];
    }
  }

  return {
    data,
    loading,
    error,
    getDocuments,
  };
}

export function useFirestoreGetDocument(collectionName) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function getDocument(collectionId) {
    if (!collectionName || !collectionId) {
      setLoading(false);
      return null;
    }
    try {
      setLoading(true);
      const docSnapshot = await getDoc(doc(db, collectionName, collectionId));
      if (docSnapshot.exists()) {
        const getData = { id: docSnapshot.id, ...docSnapshot.data() };
        setData(getData);
        return getData;
      } else {
        setError({ message: "Document does not exist" });
        setData([]);
        return null;
      }
    } catch (error) {
      console.error(error);
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return {
    data,
    loading,
    error,
    getDocument,
  };
}

export function useFirestoreAddData(collectionName) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const addData = async (newData) => {
    if (!collectionName) {
      const err = new Error("Collection name is required for addData");
      console.error(err);
      setError(err);
      return null;
    }
    try {
      setLoading(true);
      const sanitizedData = sanitizeFirestoreData(newData);
      const docRef = await addDoc(
        collection(db, collectionName),
        sanitizedData
      );
      const addedData = { ...sanitizedData, id: docRef.id };
      setData(addedData);
      return addedData;
    } catch (error) {
      console.error(error);
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, addData };
}

export function useFirestoreUpdateData(collectionName) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateData = async (id, newData, callback) => {
    if (!collectionName || !id) {
      const err = new Error(
        "Collection name and document ID are required for updateData"
      );
      console.error(err);
      setError(err);
      return null;
    }
    try {
      setLoading(true);
      const sanitizedData = sanitizeFirestoreData(newData);
      await updateDoc(doc(db, collectionName, id), sanitizedData);
      const updatedData = { ...sanitizedData };
      setData(updatedData);
      setLoading(false);
      callback && callback();
      return updatedData;
    } catch (error) {
      console.error(error);
      setError(error);
      setLoading(false);
      return null;
    }
  };

  return { data, loading, error, updateData };
}

export function useFirestoreDeleteData(collectionName) {
  const [data, setData] = useState([]);

  const deleteData = async (id) => {
    if (!collectionName || !id) {
      console.error(
        new Error("Collection name and document ID are required for deleteData")
      );
      return false;
    }
    try {
      await deleteDoc(doc(db, collectionName, id));
      setData(id);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  return { data, deleteData };
}
