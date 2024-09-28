import React, { useState } from "react";
import { useFirestoreAddData } from "../hooks/useFirestores";
import { collection } from "firebase/firestore";

export async function CRUDAddData(collectionName, collectionData) {
  const [message, setMessage] = useState({ state: false, message: "" });
  const [loading, setLoading] = useState(true);
  const {
    data,
    error: addedError,
    addData,
  } = useFirestoreAddData(collectionName);
  console.log(collectionName);
  console.log(collectionData);
  if (collectionData !== null) {
    try {
      await addData(collectionData);
      setMessage(() => ({ state: false, message: data.id }));
    } catch (error) {
      console.log(error);
      setMessage(() => ({ state: true, message: error.message }));
    } finally {
      setLoading(false);
    }
  } else {
    setMessage(() => ({ state: true, message: "저장할 데이터가 없습니다." }));
    setLoading(false);
  }

  return { data, loading, message };
}
