// dispatch-motoboy.js
// Substitui BroadcastChannel por canal real-time no Firestore
// Suporta tanto a página Admin (envio) quanto a motoboy.html (recepção)

import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 1) Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBuRHTtuKgpQE_qAdMIbT9_9qbjh4cbLI8",
  authDomain: "apiifood-e0d35.firebaseapp.com",
  projectId: "apiifood-e0d35",
  storageBucket: "apiifood-e0d35.appspot.com",
  messagingSenderId: "905864103175",
  appId: "1:905864103175:web:a198383d3a66a7d2cd31a2"
};

// Só inicializa se ainda não houver nenhum app DEFAULT
const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

const db = getFirestore(app);

// 2) Stubs de funções de UI — adapte ao seu HTML/JS real
function switchMainTab(tabName) {
  console.warn("switchMainTab não implementado:", tabName);
}
function showToast(msg, type = "info") {
  console.log(`[toast:${type}]`, msg);
}
async function fetchOrderDetails(orderId) {
  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
function renderActive(details) {
  console.log("renderActive:", details);
}
function saveLocal() {
  console.log("saveLocal()");
}

// 3) Admin: seleção de pedidos
const selectedOrders = new Set();

function refreshDispatchableOrders() {
  const container = document.getElementById("dispatch-orders");
  if (!container) return;
  container.innerHTML = "";
  document.querySelectorAll(".order-card.status-confirmed").forEach(card => {
    const id = card.dataset.id;
    if (!id) return;
    const mini = document.createElement("div");
    mini.className = "order-card-light";
    mini.dataset.id = id;
    mini.innerHTML = `<div class="info">#${id.slice(0,8)}</div>`;
    mini.onclick = () => {
      mini.classList.toggle("selected");
      if (mini.classList.contains("selected")) selectedOrders.add(id);
      else selectedOrders.delete(id);
      toggleSendBtn();
    };
    container.appendChild(mini);
  });
}

function toggleSendBtn() {
  const btn  = document.getElementById("send-to-courier");
  const user = document.getElementById("courier-select")?.value;
  if (btn) btn.disabled = selectedOrders.size === 0 || !user;
}

async function sendToMotoboy(user, orderIds) {
  if (!user || orderIds.length === 0) return;
  const batch = writeBatch(db);
  orderIds.forEach(id => {
    const ref = doc(db, "dispatchs", user, "orders", id);
    batch.set(ref, {
      orderId:      id,
      assignedAt:   serverTimestamp()
    });
  });
  await batch.commit();
}

// 4) Motoboy: escuta real-time
const state = { active: {}, finished: {} };

function startMotoboyListener() {
  const motoboyUser = localStorage.getItem("motoboyUser");
  if (!motoboyUser) return;
  const ordersCol = collection(db, "dispatchs", motoboyUser, "orders");
  onSnapshot(ordersCol, snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === "added") {
        const orderId = change.doc.id;
        if (!state.active[orderId] && !state.finished[orderId]) {
          const details = await fetchOrderDetails(orderId);
          state.active[orderId] = details;
          renderActive(details);
          saveLocal();
        }
      }
      // if (change.type === "removed") → remover da UI
    });
  });
}

// 5) Wiring: Admin vs Motoboy
document.addEventListener("DOMContentLoaded", () => {
  // Admin
  const sendBtn       = document.getElementById("send-to-courier");
  const courierSelect = document.getElementById("courier-select");
  const dispatchTab   = document.querySelector('.sidebar-item[data-target="dispatch"]');
  const dispatchSect  = document.getElementById("dispatch-section");

  if (sendBtn && courierSelect && dispatchTab && dispatchSect) {
    dispatchTab.addEventListener("click", () => switchMainTab("dispatch"));

    const observer = new MutationObserver(() => {
      if (!dispatchSect.classList.contains("hidden")) {
        refreshDispatchableOrders();
      }
    });
    observer.observe(dispatchSect, { attributes: true });

    courierSelect.addEventListener("change", toggleSendBtn);
    sendBtn.addEventListener("click", async () => {
      const user     = courierSelect.value;
      const arrayIds = [...selectedOrders];
      await sendToMotoboy(user, arrayIds);
      showToast(`${arrayIds.length} pedido(s) enviados ao motoboy ${user}`, "success");
      selectedOrders.clear();
      refreshDispatchableOrders();
      toggleSendBtn();
    });

    refreshDispatchableOrders();
  }

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// … seus imports e init do Firebase/App/Auth/Firestore …

// 1) DOMContentLoaded – só para o **Admin**:
document.addEventListener("DOMContentLoaded", () => {
  // …toda a sua lógica de montagem do dashboard Admin…
  // **remova** isto daqui:
  // if (localStorage.getItem("motoboyUser")) {
  //   startMotoboyListener();
  // }
});  // <-- este é o `});` que fecha o listener do DOMContentLoaded

// 2) onAuthStateChanged – para o **Motoboy**, só após o anon‐login completar:
onAuthStateChanged(auth, user => {
  if (!user) {
    console.warn("Aguardando autenticação...");
    return;
  }
  const motoboyUser = localStorage.getItem("motoboyUser");
  if (motoboyUser) {
    startMotoboyListener(motoboyUser);
  }
});
