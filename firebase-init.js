// firebase-init.js
import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBuRHTtuKgpQE_qAdMIbT9_9qbjh4cbLI8",
  authDomain: "apiifood-e0d35.firebaseapp.com",
  projectId: "apiifood-e0d35",
  storageBucket: "apiifood-e0d35.appspot.com",
  messagingSenderId: "905864103175",
  appId: "1:905864103175:web:a198383d3a66a7d2cd31a2"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
