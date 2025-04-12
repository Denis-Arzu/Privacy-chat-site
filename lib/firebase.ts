// import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCmO9FWp-mPrIKW7y4ITwI7oTp_r8pMfSE",
  authDomain: "private-chat-app-ce9ac.firebaseapp.com",
  projectId: "private-chat-app-ce9ac",
  storageBucket: "private-chat-app-ce9ac.firebasestorage.app",
  messagingSenderId: "25927606495",
  appId: "1:25927606495:web:0220d99a4a3c86da6d896a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app)
export {app};



