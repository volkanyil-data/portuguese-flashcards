import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCXDsCumpqmBbFtHk8cfLuU0OeTpfti0vM",
  authDomain: "portuguese-flashcards-8586a.firebaseapp.com",
  projectId: "portuguese-flashcards-8586a",
  storageBucket: "portuguese-flashcards-8586a.firebasestorage.app",
  messagingSenderId: "725114652321",
  appId: "1:725114652321:web:0bacea9ba59efedfc192e0",
  measurementId: "G-C8H6NB3FEQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
