// dispatch-motoboy.js
// Integra página-admin ↔ motoboy (via BroadcastChannel)

const dispatchChannel = new BroadcastChannel('dispatchChannel');
/* ─────────── NOVO BLOCO: responde a pedido de token ─────────── */
dispatchChannel.addEventListener('message', async (ev) => {
  if (ev.data?.type === 'token-request') {
    // garante que já temos token; se ainda não, autentica
    if (!state.accessToken && typeof authenticate === 'function') {
      try { await authenticate(); } catch {}
    }
    if (state.accessToken) {
      dispatchChannel.postMessage({ type: 'token', token: state.accessToken });
    }
  }
});
/* ─────────── FIM DO BLOCO ───────────────────────────────────── */
let selectedOrders = new Set();

// 1. Preenche a aba “Despachar para Motoboy” automaticamente
function refreshDispatchableOrders() {
  const container = document.getElementById('dispatch-orders');
  if (!container) return;
  container.innerHTML = '';

  // pega todos os cards CONFIRMED já existentes
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
window.refreshDispatchableOrders = refreshDispatchableOrders;

// 2. Habilita/desabilita botão “Enviar”
function toggleSendBtn() {
  document.getElementById('send-to-courier').disabled = selectedOrders.size === 0 ||
         !document.getElementById('courier-select').value;
}

// 3. Re-render sempre que mudar status dos pedidos
dispatchChannel.addEventListener('message',e=>{
  if(e.data?.type==='status-update'){
    // remove cards que já foram despachados/concluídos
    refreshDispatchableOrders();
  }
});

// 4. Listeners
document.addEventListener('DOMContentLoaded',()=>{
  // conecta aba lateral
  document.querySelector('.sidebar-item[data-target="dispatch"]')
          .addEventListener('click',() => switchMainTab('dispatch'));

  // quando a aba é mostrada
  const observer = new MutationObserver(() => {
     if (!document.getElementById('dispatch-section').classList.contains('hidden')) {
         refreshDispatchableOrders();
     }
  });
  observer.observe(document.getElementById('dispatch-section'),{attributes:true});

  // select motoboy
  document.getElementById('courier-select').addEventListener('change',toggleSendBtn);

  // botão enviar
  document.getElementById('send-to-courier').addEventListener('click',()=>{
     const user = document.getElementById('courier-select').value;
     if(!user) return;

     const arrayIds = [...selectedOrders];
     if(arrayIds.length===0) return;
     // avisa a página do motoboy
     dispatchChannel.postMessage({type:'assign',user,orders:arrayIds});
     showToast(`${arrayIds.length} pedido(s) enviados ao motoboy ${user}`,'success');
     // limpa seleção
     selectedOrders.clear();
     refreshDispatchableOrders();
     toggleSendBtn();
  });
});
