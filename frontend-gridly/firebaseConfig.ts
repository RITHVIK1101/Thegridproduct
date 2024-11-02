import axios from 'axios';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
    apiKey: "AIzaSyATf4Ts4_hJyLKn9AZSxtF8vpVpQqQftz4",
    authDomain: "the-gridly.firebaseapp.com",
    projectId: "the-gridly",
    storageBucket: "the-gridly.firebasestorage.app",
    messagingSenderId: "803581911146",
    appId: "1:803581911146:web:11e12aeeb538a114ea2a13"
  };
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

// Firebase Auth REST API endpoints
const API_KEY = firebaseConfig.apiKey;
const SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
const LOGIN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;

export const signUp = async (email: string, password: string) => {
  try {
    const response = await axios.post(SIGNUP_URL, {
      email,
      password,
      returnSecureToken: true,
    });
    return response.data;
  } catch (error) {
    console.error("Error in sign-up:", error);
    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const response = await axios.post(LOGIN_URL, {
      email,
      password,
      returnSecureToken: true,
    });
    return response.data;
  } catch (error) {
    console.error("Error in login:", error);
    throw error;
  }
};

export const addUserToFirestore = async (userId: string, data: { firstName: string; lastName: string; university: string; major?: string }) => {
    try {
      const userRef = doc(firestore, "users", userId);
      await setDoc(userRef, data);
    } catch (error) {
      console.error("Error adding user to Firestore:", error);
    }
  };
  

export { firestore };
