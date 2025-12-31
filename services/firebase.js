import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
  getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider, 
  onAuthStateChanged, linkWithPopup, signInWithCredential, updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { 
  getFirestore, doc, setDoc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, collection, query, writeBatch, getDocs, where, getDoc,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDaAjvHoTMe18sy1YOomGjz7_cck9xX6xU",
  authDomain: "daily-dost.firebaseapp.com",
  projectId: "daily-dost",
  storageBucket: "daily-dost.firebasestorage.app",
  messagingSenderId: "354533623697",
  measurementId: "G-4F772YDC6Z"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
  .catch((err) => {
      if (err.code == 'failed-precondition') {
          console.log('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
      } else if (err.code == 'unimplemented') {
          console.log('The current browser does not support all of the features required to enable persistence');
      }
  });

export { 
  app, auth, db, 
  signInAnonymously, signInWithPopup, GoogleAuthProvider, 
  onAuthStateChanged, linkWithPopup, signInWithCredential, updateProfile,
  doc, setDoc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, collection, query, writeBatch, getDocs, where, getDoc 
};
