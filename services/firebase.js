import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider,
  onAuthStateChanged, linkWithPopup, signInWithCredential, updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  initializeFirestore, doc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, collection, query, writeBatch, getDocs, where, getDoc,
  persistentLocalCache, persistentMultipleTabManager
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

// Enable offline persistence with multi-tab support
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export {
  app, auth, db,
  signInAnonymously, signInWithPopup, GoogleAuthProvider,
  onAuthStateChanged, linkWithPopup, signInWithCredential, updateProfile,
  doc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, collection, query, writeBatch, getDocs, where, getDoc
};
