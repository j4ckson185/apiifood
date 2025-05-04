// dispatch-motoboy.js
// Substitui BroadcastChannel por canal real-time no Firestore
// Suporta tanto a página Admin (envio) quanto a motoboy.html (recepção)

// ① cria o canal de comunicação motoboy ↔ admin
const channel = new BroadcastChannel('dispatchChannel');

channel.addEventListener('message', e => {
  const msg = e.data;
  if (msg?.type === 'dispatch-request') {
    const orderId = msg.orderId;
    // ② encontra o card e o botão “Despachar” no dashboard do admin
    const card = document.querySelector(`.order-card[data-id="${orderId}"]`);
    const btn  = card?.querySelector('button.dispatch');
    if (btn) {
      // ③ dispara exatamente o clique que já aciona a API iFood
      btn.click();
    }
  }
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 1) Firebase Config e Inicialização
const firebaseConfig = {
  apiKey: "AIzaSyBuRHTtuKgpQE_qAdMIbT9_9qbjh4cbLI8",
  authDomain: "apiifood-e0d35.firebaseapp.com",
  projectId: "apiifood-e0d35",
  storageBucket: "apiifood-e0d35.firebasestorage.app",
  messagingSenderId: "905864103175",
  appId: "1:905864103175:web:a198383d3a66a7d2cd31a2"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// 2) Estado local de pedidos selecionados (Admin)
let selectedOrders = new Set();

// 3) Função que monta a lista de pedidos “CONFIRMED” para despacho
function refreshDispatchableOrders() {
  const container = document.getElementById('dispatch-orders');
  if (!container) return;
  container.innerHTML = '';
  document.querySelectorAll('.order-card.status-confirmed')
    .forEach(card => {
      const id = card.dataset.orderId;
      const mini = document.createElement('div');
      mini.className = 'order-card-light';
      mini.dataset.orderId = id;
      mini.innerHTML = `<div class="info">#${id.slice(0,8)}</div>`;
      mini.onclick = () => {
        mini.classList.toggle('selected');
        if (mini.classList.contains('selected')) selectedOrders.add(id);
        else selectedOrders.delete(id);
        toggleSendBtn();
      };
      container.appendChild(mini);
    });
}

// 4) Habilita/desabilita botão “Enviar”
function toggleSendBtn() {
  const btn = document.getElementById('send-to-courier');
  const user = document.getElementById('courier-select')?.value;
  btn && (btn.disabled = selectedOrders.size === 0 || !user);
}

// 5) Função de envio (Admin → Firestore)
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

// 6) Listener em tempo real (motoboy.html)
function startMotoboyListener() {
  const motoboyUser = localStorage.getItem('motoboyUser');
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
      // opcional: if change.type==="removed" → remover UI
    });
  });
}

// 7) Wiring: detecta Admin vs Motoboy
document.addEventListener('DOMContentLoaded', () => {
  // --- Admin page: elementos de despacho existem? ---
  const sendBtn       = document.getElementById('send-to-courier');
  const courierSelect = document.getElementById('courier-select');
  const dispatchTab   = document.querySelector('.sidebar-item[data-target="dispatch"]');
  const dispatchSect  = document.getElementById('dispatch-section');

  if (sendBtn && courierSelect && dispatchTab && dispatchSect) {
    // 7.1) sidebar → aba dispatch
    dispatchTab.addEventListener('click', () => switchMainTab('dispatch'));

    // 7.2) quando a aba abre, recarrega lista
    const observer = new MutationObserver(() => {
      if (!dispatchSect.classList.contains('hidden')) {
        refreshDispatchableOrders();
      }
    });
    observer.observe(dispatchSect, { attributes: true });

    // 7.3) interações
    courierSelect.addEventListener('change', toggleSendBtn);
    sendBtn.addEventListener('click', async () => {
      const user     = courierSelect.value;
      const arrayIds = [...selectedOrders];
      await sendToMotoboy(user, arrayIds);
      showToast(`${arrayIds.length} pedido(s) enviados ao motoboy ${user}`, 'success');
      selectedOrders.clear();
      refreshDispatchableOrders();
      toggleSendBtn();
    });

    // 7.4) primeira carga
    refreshDispatchableOrders();
  }

  // --- Motoboy page: se houver motoboyUser definido, escuta o Firestore ---
  if (localStorage.getItem('motoboyUser')) {
    startMotoboyListener();
  }
});
