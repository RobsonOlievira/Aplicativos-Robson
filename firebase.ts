// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBZciUUYsZsVLOAi9OJa_mfM33c7_3sZ0E",
  authDomain: "tripsplit-7fbbd.firebaseapp.com",
  projectId: "tripsplit-7fbbd",
  storageBucket: "tripsplit-7fbbd.firebasestorage.app",
  messagingSenderId: "688500735528",
  appId: "1:688500735528:web:57d5ee8c599961ce89bf1d",
  measurementId: "G-KLJ5SLLCKM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);