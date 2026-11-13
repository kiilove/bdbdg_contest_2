import { useState } from "react";
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
import { sanitizeForFirestore } from "../utils/firestoreSanitize";

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
      setError(null);

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
      const documents = querySnapshot.docs.map((snap) => ({
        id: snap.id,
        ...snap.data(),
      }));

      setData(documents);
      setLoading(false);
      return documents;
    } catch (err) {
      console.error(err);
      setError(err);
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function getDocument(collectionId) {
    if (!collectionName || !collectionId) {
      setLoading(false);
      return null;
    }
    try {
      setLoading(true);
      setError(null);
      const docSnapshot = await getDoc(doc(db, collectionName, collectionId));
      if (docSnapshot.exists()) {
        const getData = { id: docSnapshot.id, ...docSnapshot.data() };
        setData(getData);
        return getData;
      } else {
        setData(null);
        return null;
      }
    } catch (err) {
      console.error(err);
      setError(err);
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
    if (!collectionName || !newData || typeof newData !== "object") {
      const err = new Error("Collection name and valid object payload are required for addData");
      console.error(err);
      setError(err);
      return null;
    }
    try {
      setLoading(true);
      setError(null);
      const sanitizedData = sanitizeForFirestore(newData);
      const docRef = await addDoc(
        collection(db, collectionName),
        sanitizedData
      );
      const addedData = { ...sanitizedData, id: docRef.id };
      setData(addedData);
      return addedData;
    } catch (err) {
      console.error(err);
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, addData };
}

export function useFirestoreUpdateData(collectionName) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateData = async (id, newData, callback) => {
    if (!collectionName || !id || !newData || typeof newData !== "object") {
      const err = new Error(
        "Collection name, document ID, and valid object payload are required for updateData"
      );
      console.error(err);
      setError(err);
      return null;
    }
    try {
      setLoading(true);
      setError(null);
      const sanitizedData = sanitizeForFirestore(newData);
      await updateDoc(doc(db, collectionName, id), sanitizedData);
      const updatedData = { ...sanitizedData };
      setData(updatedData);
      setLoading(false);
      if (typeof callback === "function") {
        callback();
      }
      return updatedData;
    } catch (err) {
      console.error(err);
      setError(err);
      setLoading(false);
      return null;
    }
  };

  return { data, loading, error, updateData };
}

export function useFirestoreDeleteData(collectionName) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deleteData = async (id) => {
    if (!collectionName || !id) {
      const err = new Error(
        "Collection name and document ID are required for deleteData"
      );
      console.error(err);
      setError(err);
      return false;
    }
    try {
      setLoading(true);
      setError(null);
      await deleteDoc(doc(db, collectionName, id));
      setData(id);
      return true;
    } catch (err) {
      console.error(err);
      setError(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, deleteData };
}
