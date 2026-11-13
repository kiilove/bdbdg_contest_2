import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_KEY,
  authDomain: "bdbdgmain.firebaseapp.com",
  projectId: "bdbdgmain",
  storageBucket: "bdbdgmain.appspot.com",
  databaseURL:
    "https://bdbdgmain-default-rtdb.asia-southeast1.firebasedatabase.app",
  messagingSenderId: "193967452980",
  appId: "1:193967452980:web:c98e06d5312714483a6b61",
  measurementId: "G-JXECRGC3L2",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const database = getDatabase(app);
