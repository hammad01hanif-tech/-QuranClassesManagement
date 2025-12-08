// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, 
  collection, 
  getDocs,
  getDoc,
  doc, 
  query, 
  where, 
  setDoc, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  limit,
  startAt, 
  endAt, 
  updateDoc, 
  arrayUnion, 
  deleteDoc, 
  deleteField,
  arrayRemove,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyALjuy8zAf9oiyWV3h3epsTtx0ZKSccxRo",
  authDomain: "quranclassesmanagement.firebaseapp.com",
  projectId: "quranclassesmanagement",
  storageBucket: "quranclassesmanagement.firebasestorage.app",
  messagingSenderId: "868247342998",
  appId: "1:868247342998:web:95908153b6d0f25fb8d7b7",
  measurementId: "G-F1MW3KMZGG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
  db,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  setDoc,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  startAt,
  endAt,
  updateDoc,
  arrayUnion,
  deleteDoc,
  deleteField,
  arrayRemove,
  onSnapshot
};
