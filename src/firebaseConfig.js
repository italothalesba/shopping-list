// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDm02X3Qpto14dfiDOKlE-tVOr3vjy8y84",
  authDomain: "shopping-list-5905b.firebaseapp.com",
  projectId: "shopping-list-5905b",
  storageBucket: "shopping-list-5905b.firebasestorage.app",
  messagingSenderId: "1051260610086",
  appId: "1:1051260610086:web:9348bf2a1bf89d3ad768e7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export { db };