import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD6MIu16wDmbOT37Fk01hi3Vt05ZyYJ-Z8",
  authDomain: "gridlychat.firebaseapp.com",
  projectId: "gridlychat",
  storageBucket: "gridlychat.appspot.com", // Corrected bucket
  messagingSenderId: "597486867743",
  appId: "1:597486867743:web:9a0072c064973d56dacc2a",
  measurementId: "G-L0HLBZY1PP",
};

// Initialize Firebase App (only once)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore and Storage
const firestore = getFirestore(app);
const storage = getStorage(app);

export { app, firestore, storage };
