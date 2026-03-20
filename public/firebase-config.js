/* ═══════════════════════════════════════════════════════════════
   Firebase Configuration — Client-Side
   ═══════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyChLzNHYtWhNWWuCzANcA7SpoyNr-BK1Fc",
  authDomain: "nexuspath76.firebaseapp.com",
  projectId: "nexuspath76",
  storageBucket: "nexuspath76.firebasestorage.app",
  messagingSenderId: "894531997991",
  appId: "1:894531997991:web:d0056c86071e84baea9902",
  measurementId: "G-TS4V8JWKG1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Auth & Firestore references
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
