// dispatch-motoboy.js
// Usa canal real-time do Firestore para comunicação Admin ↔ Motoboy

// 0) Imports completos de App, Firestore e Auth
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

import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// 1) Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBuRHTtuKgpQE_qAdMIbT9_9qbjh4cbLI8",
  authDomain: "apiifood-e0d35.firebaseapp.com",
  projectId: "apiifood-e0d35",
  storageBucket: "apiifood-e0d35.appspot.com",
  messagingSenderId: "905864103175",
  appId: "1:905864103175:web:a198383d3a66a7d2cd31a2"
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// 2) Stubs de UI — adapte aos seus elementos reais
function switchMainTab(tabName) {
  // 1) Esconder todas as seções
  document.querySelectorAll(".tab-section").forEach(sec =>
    sec.classList.add("hidden")
  );

  // 2) Mostrar a seção correspondente (ex: dispatch → #dispatch-section)
  const panel = document.getElementById(`${tabName}-section`);
  if (panel) panel.classList.remove("hidden");

  // 3) Atualizar o estado ativo da sidebar
  document.querySelectorAll(".sidebar-item").forEach(item =>
    item.classList.remove("active")
  );
  const btn = document.querySelector(`.sidebar-item[data-target="${tabName}"]`);
  if (btn) btn.classList.add("active");
}

function showToast(msg, type = "info") {
  console.log(`[toast:${type}]`, msg);
}
async function fetchOrderDetails(orderId) {
  const ref  = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
function renderActive(details) {
  console.log("renderActive:", details);
}
function saveLocal() {
  console.log("saveLocal()");
}

// 3) ADMINISTRADOR
const selectedOrders = new Set();

function refreshDispatchableOrders() {
  const container = document.getElementById("dispatch-orders");
  if (!container) return;
  container.innerHTML = "";

  // Seleciona cards com status confirmed (texto) ou cfm (código)
  document
    .querySelectorAll(".order-card.status-confirmed, .order-card.status-cfm")
    .forEach(card => {
      // No seu HTML principal o atributo é data-order-id
      const id = card.getAttribute("data-order-id");
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

  // atualiza estado do botão “Enviar”
  toggleSendBtn();
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
      orderId:    id,
      assignedAt: serverTimestamp()
    });
  });
  await batch.commit();
}

// 4) MOTOBOY
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
      // if (change.type === "removed") → aqui você pode remover da UI
    });
  });
}

// 5) WIRING
document.addEventListener("DOMContentLoaded", () => {
  // === Admin ===
  const sendBtn       = document.getElementById("send-to-courier");
  const courierSelect = document.getElementById("courier-select");
  const dispatchTab   = document.querySelector('.sidebar-item[data-target="dispatch"]');
  const dispatchSect  = document.getElementById("dispatch-section");

  if (sendBtn && courierSelect && dispatchTab && dispatchSect) {
    dispatchTab.addEventListener("click", () => switchMainTab("dispatch"));

    // Quando a aba ficar visível, recarrega os pedidos
    const observer = new MutationObserver(() => {
      if (!dispatchSect.classList.contains("hidden")) {
        refreshDispatchableOrders();
      }
    });
    observer.observe(dispatchSect, { attributes: true, attributeFilter: ["class"] });

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

    // Primeira carga
    refreshDispatchableOrders();
  }
});

// === Motoboy: auth anônimo + listener real-time ===
onAuthStateChanged(auth, async user => {
  if (!user) {
    // Se ainda não estiver logado, faz anon-login
    await signInAnonymously(auth);
    return;
  }
  // Após o anon-login, inicia o listener
  const motoboyUser = localStorage.getItem("motoboyUser");
  if (motoboyUser) {
    startMotoboyListener();
  } else {
    console.warn("Nenhum motoboyUser em localStorage, listener não iniciado.");
  }
});
