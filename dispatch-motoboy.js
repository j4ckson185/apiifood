<!-- Inclua este script como módulo -->
<script type="module">
// ----------------------------------------------------------------------------
// 1) Imports e inicialização do Firebase
// ----------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBuRHTtuKgpQE_qAdMIbT9_9qbjh4cbLI8",
  authDomain: "apiifood-e0d35.firebaseapp.com",
  projectId: "apiifood-e0d35",
  storageBucket: "apiifood-e0d35.appspot.com",
  messagingSenderId: "905864103175",
  appId: "1:905864103175:web:a198383d3a66a7d2cd31a2"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ----------------------------------------------------------------------------
// 2) Funções utilitárias (implemente conforme seu front)
// ----------------------------------------------------------------------------
function switchMainTab(tabName) {
  // stub: ative a aba correta do seu dashboard
  console.warn("switchMainTab não implementado:", tabName);
}

function showToast(msg, type = "info") {
  // stub: exiba um toast na UI
  console.log(`[toast:${type}]`, msg);
}

async function fetchOrderDetails(orderId) {
  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

function renderActive(details) {
  // stub: adicione o card de pedido ativo na UI do motoboy
  console.log("renderActive:", details);
}

function saveLocal() {
  // stub: persista no localStorage ou IndexedDB
  console.log("saveLocal()");
}

// ----------------------------------------------------------------------------
// 3) Código do Admin
// ----------------------------------------------------------------------------

// estado local de pedidos selecionados
const selectedOrders = new Set();

function refreshDispatchableOrders() {
  const container = document.getElementById("dispatch-orders");
  if (!container) return;
  container.innerHTML = "";

  // note: seu HTML deve usar data-id="…"
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
  const btn = document.getElementById("send-to-courier");
  const user = document.getElementById("courier-select")?.value;
  if (btn) btn.disabled = selectedOrders.size === 0 || !user;
}

async function sendToMotoboy(user, orderIds) {
  if (!user || orderIds.length === 0) return;
  const batch = writeBatch(db);
  orderIds.forEach(id => {
    const ref = doc(db, "dispatchs", user, "orders", id);
    batch.set(ref, {
      orderId: id,
      assignedAt: serverTimestamp()
    });
  });
  await batch.commit();
}

// ----------------------------------------------------------------------------
// 4) Código do Motoboy
// ----------------------------------------------------------------------------

const state = {
  active: {},   // pedidos em trânsito
  finished: {}  // pedidos concluídos (opcional)
};

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
      // se quiser tratar remoção:
      // if (change.type === "removed") { … }
    });
  });
}

// ----------------------------------------------------------------------------
// 5) Wiring: detecta Admin vs Motoboy
// ----------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // admin
  const sendBtn       = document.getElementById("send-to-courier");
  const courierSelect = document.getElementById("courier-select");
  const dispatchTab   = document.querySelector('.sidebar-item[data-target="dispatch"]');
  const dispatchSect  = document.getElementById("dispatch-section");

  if (sendBtn && courierSelect && dispatchTab && dispatchSect) {
    // 5.1) ao clicar na aba
    dispatchTab.addEventListener("click", () => switchMainTab("dispatch"));

    // 5.2) ao abrir a aba, atualiza lista
    const observer = new MutationObserver(() => {
      if (!dispatchSect.classList.contains("hidden")) {
        refreshDispatchableOrders();
      }
    });
    observer.observe(dispatchSect, { attributes: true });

    // 5.3) interações
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

    // 5.4) primeira carga
    refreshDispatchableOrders();
  }

  // motoboy
  if (localStorage.getItem("motoboyUser")) {
    startMotoboyListener();
  }
});
</script>
