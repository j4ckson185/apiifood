// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBuRHTtuKgpQE_qAdMIbT9_9qbjh4cbLI8",
  authDomain: "apiifood-e0d35.firebaseapp.com",
  projectId: "apiifood-e0d35",
  storageBucket: "apiifood-e0d35.firebasestorage.app",
  messagingSenderId: "905864103175",
  appId: "1:905864103175:web:a198383d3a66a7d2cd31a2"
};

// Inicializa o Firebase App
const app = initializeApp(firebaseConfig);

// Inicializa o Firestore
const db = getFirestore(app);

export { db };
