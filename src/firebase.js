// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBkI3HziXvnw86fRjbt6H2uNC4CTffJLus",
  authDomain: "grandmother-0204.firebaseapp.com",
  projectId: "grandmother-0204",
  storageBucket: "grandmother-0204.firebasestorage.app",
  messagingSenderId: "547171042078",
  appId: "1:547171042078:web:8135155055acd43eb6bf0f",
  measurementId: "G-FHQ7H1NL7C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db = getFirestore(app);