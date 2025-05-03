// Configurações
const CONFIG = {
    merchantId: '2733980',
    merchantUUID: '3a9fc83b-ffc3-43e9-aeb6-36c9e827a143',
    clientId: 'e6415912-782e-4bd9-b6ea-af48c81ae323',
    clientSecret: '137o75y57ug8fm55ubfoxlwjpl0xm25jxj18ne5mser23mbprj5nfncvfnr82utnzx73ij4h449o298370rjwpycppazsfyh2s0l',
    pollingInterval: 30000 // 30 segundos
};

// Estado da aplicação
let state = {
    accessToken: null,
    isPolling: false,
    activeTab: 'preparation', // Tab atual (preparation, dispatched, completed, cancelled)
    activeFilter: 'all' // Filtro atual (all, cash, card, online)
};

// Variáveis globais para controle de cancelamento
let currentCancellationOrderId = null;
let cancellationReasons = [];

// -------------------------------------------------
// Aqui definimos o ID do timer e o intervalo padrão
// -------------------------------------------------
let pollingTimeoutId = null;
const UNIFIED_POLLING_INTERVAL = CONFIG.pollingInterval;

// Funções de utilidade
const showLoading = () => document.getElementById('loading-overlay').classList.remove('hidden');
const hideLoading = () => document.getElementById('loading-overlay').classList.add('hidden');

const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Adiciona ícone baseado no tipo
    let icon = '';
    switch(type) {
        case 'success': icon = '<i class="fas fa-check-circle"></i>'; break;
        case 'error': icon = '<i class="fas fa-exclamation-circle"></i>'; break;
        case 'warning': icon = '<i class="fas fa-exclamation-triangle"></i>'; break;
        default: icon = '<i class="fas fa-info-circle"></i>';
    }
    
    toast.innerHTML = `${icon} ${message}`;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

// Função para alternar entre tabs de seções principais
function switchMainTab(tabId) {
    // Oculta todas as seções
    document.querySelectorAll('.tab-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Exibe a seção selecionada
    document.getElementById(`${tabId}-section`).classList.remove('hidden');
    
    // Atualiza os itens da sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelector(`.sidebar-item[data-target="${tabId}"]`).classList.add('active');
    
// Carrega avaliações automaticamente quando a tab de avaliações for selecionada
if (tabId === 'evaluations' && typeof fetchReviews === 'function') {
    if (state.accessToken) {
        fetchReviews(1);
    } else {
        authenticate().then(() => {
            if (state.accessToken) {
                fetchReviews(1);
            } else {
                showToast('Erro ao autenticar antes de carregar avaliações', 'error');
            }
        });
    }
}
}

// Função para alternar entre tabs de pedidos
function switchOrderTab(tabId) {
    // Oculta todos os conteúdos de tab
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Exibe o conteúdo da tab selecionada
    document.getElementById(`${tabId}-tab`).classList.add('active');
    
    // Atualiza a tab ativa
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelector(`.tab-item[data-tab="${tabId}"]`).classList.add('active');
    
    // Atualiza o estado
    state.activeTab = tabId;
    
    // Verifica se há pedidos na tab atual
    checkForEmptyTab(tabId);
}

// Função para aplicar filtros
function applyFilter(filter) {
    state.activeFilter = filter;
    
    // Atualiza os botões de filtro
    document.querySelectorAll('.filter-button').forEach(button => {
        button.classList.remove('active');
    });
    
    document.querySelector(`.filter-button[data-filter="${filter}"]`).classList.add('active');
    
    // Aplica o filtro aos pedidos visíveis
    const orderCards = document.querySelectorAll('.order-card');
    
    orderCards.forEach(card => {
        if (filter === 'all') {
            card.style.display = 'block';
        } else {
            // Lógica de filtro baseada no tipo de pagamento
            const paymentType = card.getAttribute('data-payment-type') || '';
            
            if (filter === 'cash' && paymentType.includes('dinheiro')) {
                card.style.display = 'block';
            } else if (filter === 'card' && paymentType.includes('cartão')) {
                card.style.display = 'block';
            } else if (filter === 'online' && paymentType.includes('online')) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
}

// Função para verificar se uma tab está vazia e mostrar mensagem apropriada
function checkForEmptyTab(tabId) {
    const ordersContainer = document.getElementById(`${tabId}-orders`);
    const emptyMessage = document.querySelector(`.${tabId}-empty`);
    
    if (ordersContainer && emptyMessage) {
        const visibleOrders = ordersContainer.querySelectorAll('.order-card:not([style*="display: none"])');
        
        if (visibleOrders.length === 0) {
            emptyMessage.classList.remove('hidden');
        } else {
            emptyMessage.classList.add('hidden');
        }
    }
}

// Função de busca de pedidos
function searchOrders(query) {
    query = query.toLowerCase().trim();
    
    const orderCards = document.querySelectorAll('.order-card');
    
    orderCards.forEach(card => {
        const orderText = card.textContent.toLowerCase();
        const orderId = card.getAttribute('data-order-id') || '';
        const customerName = card.querySelector('.customer-name')?.textContent.toLowerCase() || '';
        
        if (query === '' || 
            orderText.includes(query) || 
            orderId.includes(query) || 
            customerName.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
    
    // Verifica status de tabs vazias
    checkForEmptyTab('preparation');
    checkForEmptyTab('dispatched');
    checkForEmptyTab('completed');
    checkForEmptyTab('cancelled');
}

// Função de autenticação
async function authenticate() {
  try {
    showLoading();

    const formData = new URLSearchParams();
    formData.append('grantType', 'client_credentials');
    formData.append('clientId', CONFIG.clientId);
    formData.append('clientSecret', CONFIG.clientSecret);

    const response = await fetch('/.netlify/functions/ifood-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: '/authentication/v1.0/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
        isAuth: true
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na autenticação: ${response.status}`);
    }

    const data = await response.json();

    if (data.accessToken) {
      state.accessToken = data.accessToken;
      showToast('Autenticado com sucesso!', 'success');
      // polling só no DOMContentLoaded
    } else {
      throw new Error('Token não recebido');
    }

  } catch (error) {
    console.error('Erro na autenticação:', error);
    showToast('Erro na autenticação: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function makeAuthorizedRequest(path, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.accessToken}`
    };

    if (path === '/events/v1.0/events:polling' || path === '/events/v1.0/events/acknowledgment') {
        headers['x-polling-merchants'] = CONFIG.merchantUUID;
    }

    let processedBody = null;
    if (method !== 'GET' && body) {
        // Tratamento especial para o endpoint de acknowledgment
        if (path === '/events/v1.0/events/acknowledgment') {
            // Se o corpo já for um array de objetos com id, usamos diretamente
            if (Array.isArray(body) && body.length > 0 && typeof body[0] === 'object' && body[0].id) {
                processedBody = JSON.stringify(body);
            } 
            // Se for um array de strings, convertemos para o formato esperado
            else if (Array.isArray(body) && body.length > 0 && typeof body[0] === 'string') {
                processedBody = JSON.stringify(body.map(id => ({ id })));
            }
            // Se for um objeto com a propriedade 'events', convertemos para o formato correto
            else if (body && body.events && Array.isArray(body.events)) {
                processedBody = JSON.stringify(body.events.map(eventId => {
                    return typeof eventId === 'string' ? { id: eventId } : { id: eventId.id };
                }));
            } 
            else {
                console.error('❌ Formato inválido para acknowledgment:', body);
                throw new Error('Formato inválido para acknowledgment');
            }
        } else {
            processedBody = JSON.stringify(body);
        }
    }

    const payload = {
        path,
        method,
        headers,
        body: processedBody
    };

    console.log('🔍 Enviando requisição para proxy:');
    console.log('➡️ path:', path);
    console.log('➡️ method:', method);
    console.log('➡️ headers:', headers);
    console.log('➡️ body:', processedBody);

    try {
        const response = await fetch('/.netlify/functions/ifood-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        console.log('📨 Resposta bruta do proxy:', responseText);

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        try {
            return responseText ? JSON.parse(responseText) : {};
        } catch (e) {
            console.warn('⚠️ Resposta não é um JSON válido:', responseText);
            return { raw: responseText };
        }
    } catch (error) {
        console.error('❌ Erro na requisição:', error);
        throw error;
    }
}

// Rastreamento de pedidos já processados para evitar duplicações - usando localStorage para persistência
// Inicializa o conjunto de IDs processados a partir do localStorage (se existir)
const processedOrderIds = new Set(
    JSON.parse(localStorage.getItem('processedOrderIds') || '[]')
);

// Função auxiliar para salvar IDs processados no localStorage
function saveProcessedIds() {
    localStorage.setItem('processedOrderIds', JSON.stringify([...processedOrderIds]));
}

// ─── O seu unifiedPolling SEM auto-agendamento ─────────────────
async function unifiedPolling() {
  // Sai se o polling estiver desativado ou sem token
  if (!state.isPolling || !state.accessToken) return;

  console.log(`🔄 Polling unificado em ${new Date().toISOString()}`);

  try {
    // 1) Eventos iFood API
    const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET');
    if (Array.isArray(events) && events.length) {
      for (const e of events) {
        await handleEvent(e);
      }
      await makeAuthorizedRequest(
        '/events/v1.0/events/acknowledgment',
        'POST',
        events.map(ev => ({ id: ev.id }))
      );
    }

    // 2) Disputas (fallback)
    await pollForNewDisputesOnce();

    // 3) Webhook Netlify
    try {
      const res = await fetch('/.netlify/functions/ifood-webhook-events', { method: 'GET' });
      if (res.ok) {
        const { eventos } = await res.json();
        if (eventos?.length) {
          console.log(`[WEBHOOK] ${eventos.length} eventos recebidos via unifiedPolling`);
          for (const ev of eventos) await handleEvent(ev);
        }
      }
    } catch (err) {
      console.error('[WEBHOOK] Erro fetch webhook no unifiedPolling:', err);
    }

    // 4) Status da loja
    if (window.currentMerchantId) {
      const status = await fetchStoreStatus(window.currentMerchantId);
      if (status) displayStoreStatus(status);
    }

    // 5) Disputas expiradas
    if (typeof checkExpiredDisputes === 'function') {
      checkExpiredDisputes();
    }

    // 6) Atualiza todos os pedidos a cada 3 ciclos (~90 s)
    state.pollingCounter = (state.pollingCounter || 0) + 1;
    if (state.pollingCounter >= 3) {
      await updateAllVisibleOrders();
      state.pollingCounter = 0;
    }

    // 7) A cada 4 ciclos (~2 min), verifica pedidos concluídos
    state.completedCheckCounter = (state.completedCheckCounter || 0) + 1;
    if (state.completedCheckCounter >= 4) {
      await checkForCompletedOrders();
      state.completedCheckCounter = 0;
    }

  } catch (err) {
    console.error('❌ Erro no polling unificado:', err);
  }
  // **nenhum** setTimeout aqui!
}

// ─── Controle de polling aprimorado ───────────────────────────
let pollingTimeoutId = null;
let lastPoll = 0;

// dispara o unifiedPolling e agenda o próximo ciclo
async function doUnifiedPolling() {
  lastPoll = Date.now();
  await unifiedPolling();
  scheduleNextPoll(UNIFIED_POLLING_INTERVAL);
}

// agenda o próximo polling após “delay” ms
function scheduleNextPoll(delay) {
  clearTimeout(pollingTimeoutId);
  pollingTimeoutId = setTimeout(doUnifiedPolling, delay);
}

// pausa qualquer agendamento
function stopPolling() {
  console.log('⏸️ Aba em segundo plano: pausando polling');
  state.isPolling = false;
  clearTimeout(pollingTimeoutId);
}

// retoma o polling: ou dispara AGORA (se já passou o intervalo) ou agenda só o restante
function startPolling() {
  if (state.isPolling) return;
  console.log('▶️ Aba em foco: retomando polling');
  state.isPolling = true;

  const elapsed = Date.now() - lastPoll;
  if (elapsed >= UNIFIED_POLLING_INTERVAL) {
    // já atrasou: poll imediato
    doUnifiedPolling();
  } else {
    // aguarda só o restante
    scheduleNextPoll(UNIFIED_POLLING_INTERVAL - elapsed);
  }
}

// Page Visibility API: pausa/retoma
document.addEventListener('visibilitychange', () => {
  document.hidden ? stopPolling() : startPolling();
});

// ─── Inicialização (ex.: em DOMContentLoaded) ─────────────────
document.addEventListener('DOMContentLoaded', () => {
  state.isPolling = true;
  lastPoll = Date.now();
  doUnifiedPolling();
});

async function handleEvent(event) {
    try {
        console.log(`Processando evento: ${event.code} para pedido ${event.orderId}`);
        
        // Verifica se é um evento relacionado a pedido
        if (!event.orderId) {
            console.log('Evento sem orderId, ignorando:', event);
            return;
        }
        
        // Para eventos PLACED (novos pedidos) - processa normalmente para exibir novos pedidos
        if (event.code === 'PLACED' || event.code === 'PLC') {
            // Checa se já processamos este pedido antes
            if (processedOrderIds.has(event.orderId)) {
                console.log(`Pedido ${event.orderId} já foi processado anteriormente, ignorando`);
                return;
            }
            
            // Tenta buscar detalhes do pedido
            try {
                const order = await makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`, 'GET');
                console.log('Detalhes do pedido recebido:', order);
                
                // Verifica se o pedido já existe na interface pelo atributo data-order-id
                const existingOrder = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
                if (!existingOrder) {
                    // Exibe o pedido na interface
                    displayOrder(order);
                    showToast('Novo pedido recebido!', 'success');
                    
                    // Marca o pedido como processado
                    processedOrderIds.add(event.orderId);
                    saveProcessedIds();
                } else {
                    console.log(`Pedido ${order.id} já está na interface, ignorando duplicação`);
                }
            } catch (orderError) {
                console.error(`Erro ao buscar detalhes do pedido ${event.orderId}:`, orderError);
            }
        } 
        // IMPORTANTE: Tratamento especial para o evento CON (pedidos concluídos)
        else if (event.code === 'CON' || event.code === 'CONCLUDED' || event.code === 'CONC') {
            console.log(`🏁 Recebido evento de conclusão (${event.code}) para pedido ${event.orderId}`);
            
            try {
                // Busca o pedido na DOM
                const existingOrder = document.querySelector(`.order-card[data-order-id="${event.orderId}"]`);
                
                if (existingOrder) {
                    console.log('Pedido encontrado na interface, atualizando status para CONCLUDED');
                    // Atualiza o status para concluído
                    updateOrderStatus(event.orderId, 'CONCLUDED');
                    showToast(`Pedido #${event.orderId.substring(0, 6)} foi concluído!`, 'success');
                } else {
                    console.log('Pedido não está na interface, buscando detalhes para exibir');
                    // Busca detalhes completos apenas para exibição
                    try {
                        const orderDetails = await makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`, 'GET');
                        
                        // Força o status como concluído antes de exibir
                        orderDetails.status = 'CONCLUDED';
                        
                        // Exibe o pedido na interface já com status concluído
                        displayOrder(orderDetails);
                        showToast(`Pedido #${event.orderId.substring(0, 6)} foi concluído!`, 'success');
                        
                        processedOrderIds.add(event.orderId);
                        saveProcessedIds();
                    } catch (detailsError) {
                        console.error(`Erro ao buscar detalhes do pedido concluído ${event.orderId}:`, detailsError);
                    }
                }
            } catch (error) {
                console.error(`Erro ao processar evento de conclusão para pedido ${event.orderId}:`, error);
            }
        }
        // Processar eventos de CANCELAMENTO para manter a interface sincronizada
        else if (event.code === 'CANCELLED' || event.code === 'CANC' || 
                 event.code === 'CANCELLATION_REQUESTED' || event.code === 'CANR') {
            // Atualiza o status para cancelado
            updateOrderStatus(event.orderId, 'CANCELLED');
            console.log(`Pedido ${event.orderId} foi cancelado, atualizando interface`);
        }
        // Para os outros eventos de status, registramos mas NÃO atualizamos a interface
        // para evitar mudanças automáticas de status após confirmação
        else {
            console.log(`Recebido evento de status ${event.code} para pedido ${event.orderId} - ignorando atualização automática`);
        }
    } catch (error) {
        console.error('Erro ao processar evento:', error);
    }
}

// Função para limpar pedidos processados (opção para depuração)
function clearProcessedOrders() {
    processedOrderIds.clear();
    localStorage.removeItem('processedOrderIds');
    console.log('Lista de pedidos processados foi limpa');
}

// Função simplificada para atualizar o status da loja
async function updateStoreStatus() {
    try {
        console.log('Atualizando status da loja...');
        const statusElement = document.getElementById('store-status');
        
        // Verifica se temos um token válido - se sim, assume que a loja está online
        if (state.accessToken) {
            console.log('Token válido encontrado, assumindo loja online');
            statusElement.textContent = 'Online';
            statusElement.className = 'status-badge online';
            return;
        } else {
            statusElement.textContent = 'Offline';
            statusElement.className = 'status-badge offline';
        }
    } catch (error) {
        console.error('Erro geral ao atualizar status da loja:', error);
        // Assume online para não interromper a experiência do usuário
        const statusElement = document.getElementById('store-status');
        statusElement.textContent = 'Online (assumido)';
        statusElement.className = 'status-badge online';
    }
}

// Função simplificada para alternar o status da loja
async function toggleStoreStatus() {
    // Como não temos acesso real ao status, apenas atualizamos a interface
    const statusElement = document.getElementById('store-status');
    const isCurrentlyOnline = statusElement.textContent.includes('Online');
    
    try {
        showLoading();
        
        if (isCurrentlyOnline) {
            statusElement.textContent = 'Offline';
            statusElement.className = 'status-badge offline';
            showToast('Loja marcada como offline na interface', 'info');
        } else {
            statusElement.textContent = 'Online';
            statusElement.className = 'status-badge online';
            showToast('Loja marcada como online na interface', 'info');
        }
        
        // Aviso sobre a limitação
        console.log('Nota: O status real da loja não pôde ser alterado devido a limitações de permissão');
        setTimeout(() => {
            showToast('O status pode não ser sincronizado com o iFood devido a permissões', 'warning');
        }, 2000);
    } catch (error) {
        console.error('Erro ao alternar status da loja:', error);
        showToast('Erro ao alternar status da loja', 'error');
    } finally {
        hideLoading();
    }
}

// Função modificada para exibir pedidos com terceiro nível e melhorias de detalhes
function displayOrder(order) {
    const template = document.getElementById('order-modal-template');
    const orderElement = template.content.cloneNode(true);

    // Preenche informações básicas
    orderElement.querySelector('.order-number').textContent = `#${order.displayId || order.id.substring(0, 8)}`;
    orderElement.querySelector('.order-status').textContent = getStatusText(order.status);
    
    // Customer info
    orderElement.querySelector('.customer-name').textContent = `Cliente: ${order.customer?.name || 'N/A'}`;
    
    // Adiciona email do cliente se disponível
    if (order.customer?.email || (order.additionalInfo && order.additionalInfo.metadata && order.additionalInfo.metadata.customerEmail)) {
        const customerEmail = order.customer?.email || order.additionalInfo?.metadata?.customerEmail;
        const emailParagraph = document.createElement('p');
        emailParagraph.className = 'customer-email';
        emailParagraph.textContent = `Email: ${customerEmail}`;
        orderElement.querySelector('.customer-info').appendChild(emailParagraph);
    }
    
    // Formatação correta do telefone
    let phoneText = 'Tel: N/A';
    if (order.customer?.phone) {
        if (typeof order.customer.phone === 'string') {
            phoneText = `Tel: ${order.customer.phone}`;
        } else if (order.customer.phone.number) {
            phoneText = `Tel: ${order.customer.phone.number}`;
        }
    }
    orderElement.querySelector('.customer-phone').textContent = phoneText;
    
// Adiciona informações de endereço se for delivery
if (order.delivery && order.delivery.deliveryAddress) {
    const addressDiv = document.createElement('div');
    addressDiv.className = 'customer-address';
    
    const addressTitle = document.createElement('h3');
    addressTitle.textContent = 'Endereço de Entrega';
    addressDiv.appendChild(addressTitle);
    
    const address = order.delivery.deliveryAddress;
    
    // Endereço principal (rua e número)
    const addressMainText = document.createElement('p');
    addressMainText.textContent = `${address.streetName || ''}, ${address.streetNumber || ''}`;
    addressDiv.appendChild(addressMainText);
    
    // Complemento (se houver)
    if (address.complement) {
        const complementText = document.createElement('p');
        complementText.textContent = `Complemento: ${address.complement}`;
        addressDiv.appendChild(complementText);
    }
    
    // NOVO: Bairro (se houver)
    if (address.neighborhood) {
        const neighborhoodText = document.createElement('p');
        neighborhoodText.textContent = `Bairro: ${address.neighborhood}`;
        addressDiv.appendChild(neighborhoodText);
    }
    
    // Cidade e estado
    const cityStateText = document.createElement('p');
    cityStateText.textContent = `${address.city || ''} - ${address.state || ''}`;
    addressDiv.appendChild(cityStateText);
    
    // NOVO: CEP (se houver)
    if (address.postalCode) {
        const postalCodeText = document.createElement('p');
        postalCodeText.textContent = `CEP: ${address.postalCode}`;
        addressDiv.appendChild(postalCodeText);
    }
    
    // Referência (se houver)
    if (address.reference) {
        const referenceText = document.createElement('p');
        referenceText.textContent = `Referência: ${address.reference}`;
        addressDiv.appendChild(referenceText);
    }
    
    // Insere após as informações do cliente
    const customerInfo = orderElement.querySelector('.customer-info');
    customerInfo.parentNode.insertBefore(addressDiv, customerInfo.nextSibling);
}
    
    // Adiciona informação do tipo de pedido
    const orderTypeDiv = document.createElement('div');
    orderTypeDiv.className = 'order-type';
    const orderTypeTitle = document.createElement('h3');
    orderTypeTitle.textContent = 'Tipo de Pedido';
    orderTypeDiv.appendChild(orderTypeTitle);
    
    const orderTypeText = document.createElement('p');
    let orderTypeDescription = 'Desconhecido';
    
    if (order.orderType === 'DELIVERY') {
        orderTypeDescription = 'Entrega';
    } else if (order.takeout && order.takeout.mode) {
        orderTypeDescription = 'Para Retirar';
    } else if (order.indoor) {
        orderTypeDescription = 'Consumo no Local';
    }
    
    orderTypeText.textContent = orderTypeDescription;
    orderTypeDiv.appendChild(orderTypeText);
    
    // Insere após as informações do cliente
    const customerInfo = orderElement.querySelector('.customer-info');
    customerInfo.parentNode.insertBefore(orderTypeDiv, customerInfo.nextSibling);
    
    // Adiciona informações de pagamento e define o tipo para filtros
    let paymentType = 'desconhecido';
    
    if (order.payments && order.payments.methods && order.payments.methods.length > 0) {
        const paymentDiv = document.createElement('div');
        paymentDiv.className = 'payment-info';
        
        const paymentTitle = document.createElement('h3');
        paymentTitle.textContent = 'Forma de Pagamento';
        paymentDiv.appendChild(paymentTitle);
        
        const paymentList = document.createElement('ul');
        
        order.payments.methods.forEach(payment => {
            const paymentItem = document.createElement('li');
            let paymentText = payment.method || 'Método desconhecido';
            
// Tradução de métodos de pagamento comuns
if (payment.method) {
    if (payment.method.toLowerCase().includes('meal_voucher')) {
        paymentText = 'Vale Refeição';
    } else if (payment.method.toLowerCase().includes('food_voucher')) {
        paymentText = 'Vale Alimentação';
    } else if (payment.method.toLowerCase().includes('credit')) {
        paymentText = 'Cartão de Crédito';
    } else if (payment.method.toLowerCase().includes('debit')) {
        paymentText = 'Cartão de Débito';
    } else if (payment.method.toLowerCase().includes('cash') || 
               payment.method.toLowerCase() === 'cash') {
        paymentText = 'Dinheiro';
    } else if (payment.method.toLowerCase().includes('pix')) {
        paymentText = 'PIX';
    }
}

// Define o tipo de pagamento para filtros
if (payment.method && payment.method.toLowerCase().includes('dinheiro') ||
    payment.method && payment.method.toLowerCase() === 'cash') {
    paymentType = 'dinheiro';
} else if (payment.method && (payment.method.toLowerCase().includes('cartão') || 
                               payment.method.toLowerCase().includes('credit') || 
                               payment.method.toLowerCase().includes('debit'))) {
    paymentType = 'cartão';
} else if (payment.type && payment.type.toLowerCase().includes('online')) {
    paymentType = 'online';
} else if (payment.type && payment.type.toLowerCase().includes('offline')) {
    paymentType = 'dinheiro'; // Associa offline com dinheiro para o filtro
}

// Adiciona tipo de pagamento se disponível
if (payment.type) {
    const translatedType = (() => {
        if (payment.type.toLowerCase() === 'online') return 'Online';
        if (payment.type.toLowerCase() === 'offline') return 'Na Entrega';
        return payment.type;
    })();
    
    paymentText += ` (${translatedType})`;
}
            
            // Adiciona bandeira do cartão se disponível
            if (payment.card && payment.card.brand) {
                paymentText += ` - Bandeira: ${payment.card.brand}`;
            }
            
            // Adiciona valor se disponível
            if (payment.value) {
                paymentText += ` - R$ ${payment.value.toFixed(2)}`;
            }
            
            // Indica se já foi pago
            if (payment.prepaid) {
                paymentText += ' - Pré-pago';
            }
            
            paymentItem.textContent = paymentText;
            paymentList.appendChild(paymentItem);
        });
        
        paymentDiv.appendChild(paymentList);
        
        // Insere após as informações do tipo de pedido
        orderTypeDiv.parentNode.insertBefore(paymentDiv, orderTypeDiv.nextSibling);
    }

    // Agora que o bloco de pagamento existe, adiciona o troco
addChangeForField(orderElement, order);

    // Preenche itens do pedido
    const itemsList = orderElement.querySelector('.items-list');
    if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
            const li = document.createElement('li');
            // Usa totalPrice se disponível, senão calcula a partir do preço unitário e quantidade
            const itemPrice = item.totalPrice || (item.price * item.quantity);
            li.textContent = `${item.quantity}x ${item.name} - R$ ${typeof itemPrice === 'number' ? itemPrice.toFixed(2) : '0.00'}`;
            
            // Adiciona observações se houver
            if (item.observations) {
                const obsSpan = document.createElement('span');
                obsSpan.className = 'item-observations';
                obsSpan.textContent = `Obs: ${item.observations}`;
                li.appendChild(document.createElement('br'));
                li.appendChild(obsSpan);
            }
            
            // Adiciona opções se houver (segundo nível)
            if (item.options && item.options.length > 0) {
                const optionsList = document.createElement('ul');
                optionsList.className = 'options-list';
                
                item.options.forEach(option => {
                    const optionLi = document.createElement('li');
                    optionLi.textContent = `${option.quantity}x ${option.name} ${option.groupName ? `(${option.groupName})` : ''} (+R$ ${(option.addition || option.price || 0).toFixed(2)})`;
                    
                    // NOVO: Adiciona customizações (terceiro nível) se houver
                    if (option.customizations && option.customizations.length > 0) {
                        const customizationsList = document.createElement('ul');
                        customizationsList.className = 'customizations-list';
                        
                        option.customizations.forEach(customization => {
                            const customizationLi = document.createElement('li');
                            customizationLi.textContent = `${customization.quantity}x ${customization.name} ${customization.groupName ? `(${customization.groupName})` : ''} (+R$ ${(customization.addition || customization.price || 0).toFixed(2)})`;
                            customizationsList.appendChild(customizationLi);
                        });
                        
                        optionLi.appendChild(customizationsList);
                    }
                    
                    optionsList.appendChild(optionLi);
                });
                
                li.appendChild(optionsList);
            }
            
            itemsList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'Nenhum item encontrado';
        itemsList.appendChild(li);
    }

    // Preenche total com mais detalhes
    const totalAmount = orderElement.querySelector('.total-amount');
    
    if (order.total) {
        if (typeof order.total === 'number') {
            totalAmount.textContent = `R$ ${order.total.toFixed(2)}`;
        } else if (order.total.subTotal || order.total.orderAmount) {
            // Usa orderAmount ou subTotal + deliveryFee
            const totalValue = order.total.orderAmount || 
                              (order.total.subTotal + (order.total.deliveryFee || 0));
            totalAmount.textContent = `R$ ${totalValue.toFixed(2)}`;
            
            // Adiciona detalhamento do total
            const totalDetails = document.createElement('div');
            totalDetails.className = 'total-details';
            
            if (order.total.subTotal) {
                const subTotal = document.createElement('p');
                subTotal.innerHTML = `<span>Subtotal:</span> <span>R$ ${order.total.subTotal.toFixed(2)}</span>`;
                totalDetails.appendChild(subTotal);
            }
            
            if (order.total.deliveryFee) {
                const deliveryFee = document.createElement('p');
                deliveryFee.innerHTML = `<span>Taxa de entrega:</span> <span>R$ ${order.total.deliveryFee.toFixed(2)}</span>`;
                totalDetails.appendChild(deliveryFee);
            }
            
            // NOVO: Adiciona taxas adicionais se houver
            if (order.total.additionalFees && order.total.additionalFees > 0) {
                const additionalFees = document.createElement('p');
                additionalFees.innerHTML = `<span>Taxa de Serviço:</span> <span>R$ ${order.total.additionalFees.toFixed(2)}</span>`;
                totalDetails.appendChild(additionalFees);
            } else if (order.additionalFees && Array.isArray(order.additionalFees) && order.additionalFees.length > 0) {
                order.additionalFees.forEach(fee => {
                    const feeItem = document.createElement('p');
                    feeItem.innerHTML = `<span>${fee.description || 'Taxa de Serviço'}:</span> <span>R$ ${fee.value.toFixed(2)}</span>`;
                    totalDetails.appendChild(feeItem);
                });
            }
            
// === Início: exibe cada benefício ou cupom com patrocinador ===
if (order.benefits && Array.isArray(order.benefits) && order.benefits.length > 0) {
    // Mapeamento dos tipos de desconto (garante targetMap disponível)
    const targetMap = {
        'CART':         'Desconto no Carrinho',
        'DELIVERY_FEE': 'Desconto na Taxa de Entrega',
        'ITEM':         'Desconto no Item'
    };

    // Título dos cupons
    const benefitsTitle = document.createElement('div');
    benefitsTitle.className = 'benefits-title';
    benefitsTitle.innerHTML = '<i class="fas fa-ticket-alt"></i> Cupons de Desconto Aplicados:';
    totalDetails.appendChild(benefitsTitle);

    // Container de cupons
    const benefitsContainer = document.createElement('div');
    benefitsContainer.className = 'benefits-container';

    order.benefits.forEach(function(benefit) {
        if (!benefit.value) return;

        // Valor formatado
        const benefitValue = benefit.value > 100 ? benefit.value / 100 : benefit.value;

        // Item de cupom
        const benefitItem = document.createElement('div');
        benefitItem.className = 'benefit-item';

        // Cabeçalho do cupom
        const benefitHeader = document.createElement('div');
        benefitHeader.className = 'benefit-header';
        benefitHeader.innerHTML =
            '<span class="benefit-type">' + (targetMap[benefit.target] || 'Desconto') + '</span>' +
            '<span class="benefit-value">-R$ ' + benefitValue.toFixed(2) + '</span>';
if (benefit.campaign && benefit.campaign.name) {
    benefitHeader.innerHTML +=
        '<span class="benefit-campaign">' + benefit.campaign.name + '</span>';
}
benefitItem.appendChild(benefitHeader);

        // Exibe patrocinador de cada cupom
        if (benefit.sponsorshipValues && Array.isArray(benefit.sponsorshipValues)) {
            benefit.sponsorshipValues.forEach(function(sponsor) {
                if (!sponsor.value) return;
                const sponsorValue = sponsor.value > 100 ? sponsor.value / 100 : sponsor.value;
                const p = document.createElement('p');
                p.className = 'sponsor-info';
                p.innerHTML =
                    '<strong>Patrocinador:</strong> ' + sponsor.description +
                    ' <strong>- R$ ' + sponsorValue.toFixed(2) + '</strong>';
                benefitItem.appendChild(p);
            });
        }

        benefitsContainer.appendChild(benefitItem);
    });

    totalDetails.appendChild(benefitsContainer);

} else if (order.total && order.total.benefits && order.total.benefits > 0) {
    // Fallback: caso não haja array de benefits
    const p = document.createElement('p');
    p.innerHTML = '<span>Descontos:</span> <span>-R$ ' + order.total.benefits.toFixed(2) + '</span>';
    totalDetails.appendChild(p);
}
// === Fim do bloco de cupons ===

const totalElement = orderElement.querySelector('.order-total');
totalElement.appendChild(totalDetails);
        }
    } else {
        // Tenta calcular o total a partir dos itens
        let calculatedTotal = 0;
        if (order.items && Array.isArray(order.items)) {
            calculatedTotal = order.items.reduce((sum, item) => {
                return sum + (item.totalPrice || (item.price * item.quantity) || 0);
            }, 0);
        }
        totalAmount.textContent = `R$ ${calculatedTotal.toFixed(2)}`;
    }

    // Adiciona horário do pedido
    if (order.createdAt) {
        const createdAtDiv = document.createElement('div');
        createdAtDiv.className = 'order-created-at';
        
        const createdAtTitle = document.createElement('h3');
        createdAtTitle.textContent = 'Horário do Pedido';
        createdAtDiv.appendChild(createdAtTitle);
        
        const createdAtText = document.createElement('p');
        const createdDate = new Date(order.createdAt);
        createdAtText.textContent = createdDate.toLocaleString('pt-BR');
        createdAtDiv.appendChild(createdAtText);
        
        // Insere após o total
        const totalElement = orderElement.querySelector('.order-total');
        totalElement.parentNode.insertBefore(createdAtDiv, totalElement.nextSibling);
    }

    // Adiciona botões de ação
    const actionsContainer = orderElement.querySelector('.order-actions');
    addActionButtons(actionsContainer, order);

    // Adiciona atributo data-id ao card para facilitar atualizações
    const orderCard = orderElement.querySelector('.order-card');
    orderCard.setAttribute('data-order-id', order.id);
    
    // Adiciona atributo de tipo de pagamento para filtros
    orderCard.setAttribute('data-payment-type', paymentType);
    
    // Adiciona classe baseada no status
    if (order.status) {
        orderCard.classList.add(`status-${order.status.toLowerCase()}`);
    }

    // Determina em qual tab o pedido deve ser exibido
    let targetContainer;
    const status = order.status || 'PLACED';
    
    if (status === 'CANCELLED' || status === 'CANC') {
        targetContainer = document.getElementById('cancelled-orders');
    } else if (status === 'CONCLUDED' || status === 'CONC') {
        targetContainer = document.getElementById('completed-orders');
    } else if (status === 'DISPATCHED' || status === 'DDCR') {
        targetContainer = document.getElementById('dispatched-orders');
    } else {
        // Todos os outros statuses (PLACED, CONFIRMED, IN_PREPARATION, etc)
        targetContainer = document.getElementById('preparation-orders');
    }

    // Adiciona ao container apropriado
    if (targetContainer) {
        targetContainer.appendChild(orderElement);
        // Verifica se a mensagem de "sem pedidos" deve ser ocultada
        const tabId = targetContainer.id.replace('-orders', '');
        checkForEmptyTab(tabId);
    }
   
    console.log('Pedido exibido com sucesso:', order.id);
}

// Função modificada para atualizar o status apenas quando explicitamente solicitado
function updateOrderStatus(orderId, status) {
   console.log(`Atualizando status do pedido ${orderId} para ${status}`);

   // Busca o card do pedido pelo data-order-id exato
   const card = document.querySelector(`.order-card[data-order-id="${orderId}"]`);

   if (card) {
       // Atualiza o status
       const statusElement = card.querySelector('.order-status');
       if (statusElement) {
           statusElement.textContent = getStatusText(status);
       }

       // Atualiza as ações disponíveis
       const actionsContainer = card.querySelector('.order-actions');
       if (actionsContainer) {
           // Recupera os dados completos do pedido do cache
           const orderData = ordersCache[orderId] || { id: orderId };
           
           // Mantém o status atualizado
           orderData.status = status;
           
           // Adiciona novas ações baseadas no pedido completo com status atualizado
           addActionButtons(actionsContainer, orderData);
       }
       
       // Atualiza classes do card baseado no status
       // Primeiro remove todas as classes de status existentes
       const statusClasses = Array.from(card.classList)
           .filter(className => className.startsWith('status-'));
       
       statusClasses.forEach(className => {
           card.classList.remove(className);
       });
       
       // Adiciona a nova classe de status
       if (status) {
           card.classList.add(`status-${status.toLowerCase()}`);
       }
       
       // Move o card para a tab correta baseado no novo status
       moveCardToCorrectTab(card, status);
   } else {
       console.log(`Pedido ${orderId} não encontrado na interface. Buscando detalhes...`);
       makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET')
           .then(order => {
               displayOrder(order);
           })
           .catch(error => {
               console.error(`Erro ao buscar detalhes do pedido ${orderId}:`, error);
           });
   }
}

// Função para mover o card para a tab correta após atualização de status
function moveCardToCorrectTab(card, status) {
   let targetContainerId;
   
   if (status === 'CANCELLED' || status === 'CANC') {
       targetContainerId = 'cancelled-orders';
   } else if (status === 'CONCLUDED' || status === 'CONC') {
       targetContainerId = 'completed-orders';
   } else if (status === 'DISPATCHED' || status === 'DDCR') {
       targetContainerId = 'dispatched-orders';
   } else {
       // Todos os outros statuses (PLACED, CONFIRMED, IN_PREPARATION, etc)
       targetContainerId = 'preparation-orders';
   }
   
   const targetContainer = document.getElementById(targetContainerId);
   const currentParent = card.parentElement;
   
   if (targetContainer && currentParent && currentParent.id !== targetContainerId) {
       // Move o card para o container correto
       targetContainer.appendChild(card);
       
       // Verifica se as tabs antigas e novas devem mostrar a mensagem "sem pedidos"
       const oldTabId = currentParent.id.replace('-orders', '');
       const newTabId = targetContainerId.replace('-orders', '');
       
       checkForEmptyTab(oldTabId);
       checkForEmptyTab(newTabId);
       
       // Mostra um toast informando sobre a mudança
       const statusText = getStatusText(status);
       showToast(`Pedido movido para "${statusText}"`, 'info');
   }
}

// Adiciona botões de ação baseado no status do pedido
function addActionButtons(container, order) {
   console.log('Adicionando botões de ação para pedido com status:', order.status);
   
   // Limpa botões existentes
   while (container.firstChild) {
       container.removeChild(container.firstChild);
   }
   
   // Mapeamento detalhado de status para ações
const actions = {
    'PLACED': [
        { label: 'Confirmar', action: 'confirm', class: 'confirm' },
        { label: 'Cancelar', action: 'requestCancellation', class: 'cancel' }
    ],
    'CONFIRMED': [
        { label: 'Despachar', action: 'dispatch', class: 'dispatch' },
        { label: 'Cancelar', action: 'requestCancellation', class: 'cancel' }
    ],
    'READY_TO_PICKUP': [
        { label: 'Despachar', action: 'dispatch', class: 'dispatch' },
        { label: 'Cancelar', action: 'requestCancellation', class: 'cancel' }
    ],
    'DISPATCHED': [
        { label: 'Cancelar', action: 'requestCancellation', class: 'cancel' }
    ],
    'CANCELLATION_REQUESTED': [
        { label: 'Cancelamento Solicitado', action: null, class: 'disabled' }
    ],
    'CANCELLED': [
        { label: 'Pedido Cancelado', action: null, class: 'disabled' }
    ],
    'CONCLUDED': [
        { label: 'Pedido Concluído', action: null, class: 'disabled' }
    ]
};
   
   // Determina o tipo de pedido (delivery ou para retirar)
   let isDelivery = true;
   if (order.orderType === 'TAKEOUT' || (order.takeout && order.takeout.mode)) {
       isDelivery = false;
   }
   
   // Pega o status normalizado
   let orderStatus = order.status;
   if (!orderStatus && order.id) {
       // Se não tiver status mas tiver ID, considera como PLACED
       orderStatus = 'PLACED';
   }
   
   // Mapeamento de códigos de status para status normalizados
   const statusMap = {
       'PLC': 'PLACED',
       'CFM': 'CONFIRMED',
       'PREP': 'IN_PREPARATION',
       'PRS': 'IN_PREPARATION', // Adicional para lidar com 'PRS'
       'RTP': 'READY_TO_PICKUP',
       'DDCR': 'DISPATCHED',
       'CON': 'CONCLUDED',
       'CANC': 'CANCELLED',
       'CANR': 'CANCELLATION_REQUESTED'
   };

   const normalizedStatus = statusMap[orderStatus] || orderStatus;
   
   // Usar o status normalizado para buscar as ações
   let orderActions = actions[normalizedStatus] || [];
   
   if (orderActions.length === 0) {
       if (orderStatus && typeof orderStatus === 'string') {
           // Tenta encontrar ações para status similares
           const statusLower = orderStatus.toLowerCase();
           
           if (statusLower.includes('placed') || statusLower.includes('new')) {
               orderActions = actions['PLACED'];
           } else if (statusLower.includes('confirm') || statusLower.includes('cfm')) {
               orderActions = actions['CONFIRMED'];
           } else if (statusLower.includes('prepar') || statusLower.includes('prs')) {
               orderActions = actions['IN_PREPARATION'];
           } else if (statusLower.includes('ready') || statusLower.includes('pickup')) {
               orderActions = actions['READY_TO_PICKUP'];
           } else if (statusLower.includes('dispatch') || statusLower.includes('ddcr')) {
               orderActions = actions['DISPATCHED'];
           } else if (statusLower.includes('cancel')) {
               orderActions = actions['CANCELLED'];
           } else if (statusLower.includes('conclud')) {
               orderActions = actions['CONCLUDED'];
           }
       }
   }
   
   console.log(`Encontradas ${orderActions.length} ações para o status ${orderStatus}`);
   
   // Adiciona os botões de ação
   orderActions.forEach(({label, action, class: buttonClass}) => {
       const button = document.createElement('button');
       button.className = `action-button ${buttonClass || action}`;
       button.textContent = label;
       
       if (action) {
           button.onclick = () => handleOrderAction(order.id, action);
       } else {
           button.disabled = true;
       }
       
       container.appendChild(button);
   });
   
   // Se não houver ações disponíveis, mostra uma mensagem
   if (orderActions.length === 0) {
       const messageSpan = document.createElement('span');
       messageSpan.className = 'no-actions';
       messageSpan.textContent = 'Nenhuma ação disponível';
       container.appendChild(messageSpan);
   }
}

// Função para buscar pedidos ativos usando eventos
async function fetchActiveOrders() {
   try {
       console.log('Buscando pedidos ativos via eventos...');
       showToast('Buscando pedidos ativos...', 'info');
       
       // Precisamos declarar esta variável, estava sendo usada sem declaração
       const successfulOrders = [];
       
       // Limpa os containers de pedidos
       clearOrdersContainers();
       
       // Buscar eventos recentes
       const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET');
       
       if (events && Array.isArray(events) && events.length > 0) {
           console.log('Eventos recebidos:', events);
           
           // Filtra eventos relacionados a pedidos - aceitamos todos os tipos de eventos
           const orderEvents = events.filter(event => event.orderId);
           
           if (orderEvents.length > 0) {
               // Conjunto para rastrear pedidos já processados nesta busca
               const processedInThisFetch = new Set();
               
               for (const event of orderEvents) {
                   // Evita processar o mesmo pedido múltiplas vezes nesta busca
                   if (!processedInThisFetch.has(event.orderId)) {
                       processedInThisFetch.add(event.orderId);
                       
                       try {
                           console.log(`Buscando detalhes do pedido ${event.orderId}`);
                           const orderDetails = await makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`, 'GET');
                           console.log(`Detalhes recebidos para pedido ${event.orderId}:`, orderDetails);
                           
                           // Verifica se o pedido já existe na interface
                           const existingOrder = document.querySelector(`.order-card[data-order-id="${orderDetails.id}"]`);
                           if (!existingOrder) {
                               displayOrder(orderDetails);
                               successfulOrders.push(orderDetails);
                               
                               // Adiciona aos pedidos processados para evitar processamento futuro
                               if (!processedOrderIds.has(event.orderId)) {
                                   processedOrderIds.add(event.orderId);
                                   saveProcessedIds();
                               }
                           } else {
                               console.log(`Pedido ${orderDetails.id} já está na interface, ignorando`);
                           }
                       } catch (orderError) {
                           console.error(`Erro ao buscar detalhes do pedido ${event.orderId}:`, orderError);
                       }
                   }
               }
               
               // Fazer acknowledgment dos eventos processados
               if (events.length > 0) {
                   try {
                       const acknowledgmentFormat = events.map(event => ({ id: event.id }));
                       await makeAuthorizedRequest('/events/v1.0/events/acknowledgment', 'POST', acknowledgmentFormat);
                       console.log('Acknowledgment enviado com sucesso para eventos:', events.map(e => e.id));
                   } catch (ackError) {
                       console.error('Erro ao enviar acknowledgment:', ackError);
                   }
               }
               
               if (successfulOrders.length > 0) {
                   showToast(`${successfulOrders.length} pedidos carregados`, 'success');
               } else {
                   showToast('Nenhum pedido ativo encontrado', 'info');
               }
           } else {
               console.log('Nenhum evento de pedido encontrado');
               showToast('Nenhum pedido ativo no momento', 'info');
           }
       } else {
           console.log('Nenhum evento recebido');
           showToast('Nenhum pedido ativo no momento', 'info');
       }
       
       // Verifica se há pedidos em cada tab
       checkForEmptyTab('preparation');
       checkForEmptyTab('dispatched');
       checkForEmptyTab('completed');
       checkForEmptyTab('cancelled');
       
   } catch (error) {
       console.error('Erro ao buscar pedidos ativos:', error);
       showToast('Erro ao buscar pedidos', 'error');
   }
}

// Função para limpar os containers de pedidos
function clearOrdersContainers() {
   const containers = [
       'preparation-orders',
       'dispatched-orders',
       'completed-orders',
       'cancelled-orders'
   ];
   
   containers.forEach(containerId => {
       const container = document.getElementById(containerId);
       if (container) {
           while (container.firstChild) {
               container.removeChild(container.firstChild);
           }
       }
   });
}

async function handleOrderAction(orderId, action) {
   try {
       console.log(`Executando ação ${action} para o pedido ${orderId}`);
       
       // Mapeamento de ações para endpoints da API
       const actionEndpoints = {
           'confirm': '/confirm',
           'startPreparation': '/startPreparation',
           'readyToPickup': '/readyToPickup',
           'dispatch': '/dispatch',
           'requestCancellation': '/requestCancellation'
       };
       
       const endpoint = actionEndpoints[action];
       if (!endpoint) {
           throw new Error(`Ação desconhecida: ${action}`);
       }

       // Tratamento especial para cancelamento
       if (action === 'requestCancellation') {
           console.log('🚨 Iniciando processo de cancelamento');
           showLoading();
           try {
               cancellationReasons = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}/cancellationReasons`, 'GET');
               console.log('🚨 Motivos de cancelamento obtidos:', cancellationReasons);
               
               if (cancellationReasons && cancellationReasons.length > 0) {
                   // Atualiza a variável global
                   currentCancellationOrderId = orderId;
                   
                   // Preenche o select com os motivos
                   const select = document.getElementById('cancellation-reason');
                   select.innerHTML = '';
                   
                   cancellationReasons.forEach(reason => {
                       const option = document.createElement('option');
                       option.value = reason.cancelCodeId;
                       option.textContent = reason.description;
                       select.appendChild(option);
                   });
                   
                   hideLoading();
                   
                   // Exibe o modal com um atraso mínimo
                   setTimeout(() => {
                       const modal = document.getElementById('cancellation-modal');
                       if (modal) {
                           console.log('🚨 Tentando abrir modal de cancelamento');
                           modal.classList.remove('hidden');
                           modal.style.display = 'flex';
                           modal.removeAttribute('hidden');
                       } else {
                           console.error('🚨 Elemento do modal não encontrado');
                       }
                   }, 100);
               } else {
                   hideLoading();
                   showToast('Não foi possível obter os motivos de cancelamento', 'error');
               }
           } catch (cancelError) {
               hideLoading();
               console.error('Erro ao obter motivos de cancelamento:', cancelError);
               showToast('Erro ao obter motivos de cancelamento', 'error');
           }
       } else {
           // Todas as outras ações normais
           showLoading();
           const response = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}${endpoint}`, 'POST');
           console.log(`Resposta da ação ${action}:`, response);

           // Atualizar o status manualmente na interface de acordo com a ação executada
           let newStatus;
           switch(action) {
               case 'confirm':
                   newStatus = 'CONFIRMED';
                   break;
               case 'startPreparation':
                   newStatus = 'IN_PREPARATION';
                   break;
               case 'readyToPickup':
                   newStatus = 'READY_TO_PICKUP';
                   break;
               case 'dispatch':
                   newStatus = 'DISPATCHED';
                   break;
               default:
                   // Para outros casos, buscamos o status atual
                   const updatedOrder = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
                   newStatus = updatedOrder.status;
           }

           // Atualiza a UI com o novo status
           updateOrderStatus(orderId, newStatus);

           if (!processedOrderIds.has(orderId)) {
               processedOrderIds.add(orderId);
               saveProcessedIds();
           }

           hideLoading();
           showToast(`Ação "${action}" realizada com sucesso!`, 'success');
       }
   } catch (error) {
       hideLoading();
       console.error(`Erro ao realizar ação ${action} para o pedido ${orderId}:`, error);
       showToast(`Erro ao realizar ação: ${error.message}`, 'error');
   }
}

function closeCancellationModal() {
   console.log('Fechando modal de cancelamento');
   const modal = document.getElementById('cancellation-modal');
   if (modal) {
       modal.classList.add('hidden');
       modal.style.display = 'none';
       modal.setAttribute('hidden', 'true');
       currentCancellationOrderId = null;
   }
}

// Função modificada para confirmar cancelamento
function confirmCancellation() {
   console.log('Confirmando cancelamento...');
   const modal = document.getElementById('cancellation-modal');
   
   if (!currentCancellationOrderId) {
       showToast('Erro: ID do pedido não encontrado', 'error');
       if (modal) modal.classList.add('hidden');
       return;
   }
   
   const select = document.getElementById('cancellation-reason');
   const selectedReasonId = select.value;
   
   if (!selectedReasonId) {
       showToast('Selecione um motivo para cancelar', 'warning');
       return;
   }
   
   // Oculta o modal antes de continuar
   if (modal) modal.classList.add('hidden');
   
   // Encontra a descrição do motivo selecionado
   const selectedReason = cancellationReasons.find(r => r.cancelCodeId === selectedReasonId);
   
   if (!selectedReason) {
       showToast('Motivo inválido', 'error');
       currentCancellationOrderId = null;
       return;
   }
   
   // Continua com o processo de cancelamento...
   processCancellation(currentCancellationOrderId, selectedReason);
}

// Nova função para processar o cancelamento após confirmação
async function processCancellation(orderId, reason) {
   try {
       showLoading();
       
       // Envia a requisição de cancelamento com o motivo
       const response = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}/requestCancellation`, 'POST', {
           cancellationCode: reason.cancelCodeId,
           reason: reason.description
       });
       
       console.log('Resposta do cancelamento:', response);
       
       // Atualiza o status do pedido na interface
       updateOrderStatus(orderId, 'CANCELLED');
       
       hideLoading();
       showToast(`Pedido cancelado com sucesso!`, 'success');
   } catch (error) {
       hideLoading();
       console.error('Erro ao cancelar pedido:', error);
       showToast(`Erro ao cancelar pedido: ${error.message}`, 'error');
   } finally {
       // Limpa o ID do pedido atual
       currentCancellationOrderId = null;
   }
}

// Converte status para texto amigável
function getStatusText(status) {
   const statusMap = {
       'PLACED': 'Novo',
       'CONFIRMED': 'Confirmado',
       'IN_PREPARATION': 'Em Preparação',
       'READY_TO_PICKUP': 'Pronto para Retirada',
       'DISPATCHED': 'A Caminho',
       'CONCLUDED': 'Concluído',
       'CANCELLED': 'Cancelado',
       'PLC': 'Novo',
       'CFM': 'Confirmado',
       'PREP': 'Em Preparação',
       'PRS': 'Em Preparação',
       'RTP': 'Pronto para Retirada',
       'DDCR': 'A Caminho',
       'CONC': 'Concluído',
       'CANC': 'Cancelado',
       'CANR': 'Cancelamento Solicitado'
   };
   return statusMap[status] || status;
}

// Variáveis para controle de paginação
let currentPage = 1;
const pageSize = 10;
let totalStores = 0;

// Função para listar lojas
async function fetchStores(page = 1) {
    try {
        console.log('Buscando lojas da página:', page);
        showLoading();
        const response = await makeAuthorizedRequest(`/merchant/v1.0/merchants?page=${page}&size=${pageSize}`, 'GET');
        console.log('Resposta da busca de lojas:', response);
        
        const storesList = document.getElementById('stores-list');
        if (!storesList) {
            console.error('Elemento stores-list não encontrado');
            return;
        }
        
        storesList.innerHTML = '';
        
        if (response && Array.isArray(response)) {
            response.forEach(store => {
                const storeCard = document.createElement('div');
                storeCard.className = 'store-card';
                storeCard.innerHTML = `
                    <h3>${store.name || 'Nome não disponível'}</h3>
                    <p>${store.corporateName || 'Razão social não disponível'}</p>
                `;
                
                storeCard.onclick = () => fetchStoreDetails(store.id);
                storesList.appendChild(storeCard);
            });
            
            // Atualiza informações de paginação
            const pageInfo = document.getElementById('page-info');
            if (pageInfo) {
                pageInfo.textContent = `Página ${page}`;
            }
            currentPage = page;
            console.log('Lojas carregadas com sucesso');
        } else {
            console.log('Nenhuma loja encontrada ou formato de resposta inválido');
            showToast('Nenhuma loja encontrada', 'info');
        }
    } catch (error) {
        console.error('Erro ao buscar lojas:', error);
        showToast('Erro ao carregar lista de lojas', 'error');
    } finally {
        hideLoading();
    }
}

async function fetchStoreDetails(merchantId) {
    try {
        showLoading();
        const response = await makeAuthorizedRequest(`/merchant/v1.0/merchants/${merchantId}`, 'GET');
        
        const storeDetails = document.getElementById('store-details');
        storeDetails.innerHTML = `
            <h2>Detalhes da Loja</h2>
            <div class="store-detail-row">
                <span class="store-detail-label">ID:</span>
                <span class="store-detail-value">${response.id || 'N/A'}</span>
            </div>
            <div class="store-detail-row">
                <span class="store-detail-label">Nome:</span>
                <span class="store-detail-value">${response.name || 'N/A'}</span>
            </div>
            <div class="store-detail-row">
                <span class="store-detail-label">Razão Social:</span>
                <span class="store-detail-value">${response.corporateName || 'N/A'}</span>
            </div>
            <div class="store-detail-row">
                <span class="store-detail-label">Tipo:</span>
                <span class="store-detail-value">${response.type || 'N/A'}</span>
            </div>
            <div class="store-detail-row">
                <span class="store-detail-label">Endereço:</span>
                <span class="store-detail-value">
                    ${response.address ? 
                        `${response.address.street}, ${response.address.number}, 
                         ${response.address.city} - ${response.address.state}` : 
                        'N/A'}
                </span>
            </div>
            <div class="store-detail-row">
                <span class="store-detail-label">Operações:</span>
                <span class="store-detail-value">
                    ${response.operations ? 
                        `Nome: ${response.operations.name || 'N/A'}, 
                         Canal de Vendas: ${response.operations.salesChannel?.name || 'N/A'}, 
                         Habilitado: ${response.operations.salesChannel?.enabled || 'N/A'}` : 
                        'N/A'}
                </span>
            </div>
        `;
        
        storeDetails.classList.remove('hidden');
        
        // Busca os horários de funcionamento
        await fetchOpeningHours(merchantId);
        
    // … ao final de fetchStoreDetails:
    // startStatusPolling(merchantId);  // agora comentado: faz parte do unifiedPolling

                // ADICIONAR AQUI: Busca as interrupções da loja
        await fetchInterruptions(merchantId);
        
        // ADICIONAR AQUI: Exibe a seção de interrupções
        const interruptionsSection = document.getElementById('interruptions-section');
        if (interruptionsSection) {
            interruptionsSection.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('Erro ao buscar detalhes da loja:', error);
        showToast('Erro ao carregar detalhes da loja', 'error');
    } finally {
        hideLoading();
    }
}

    // Função para buscar horários de funcionamento
async function fetchOpeningHours(merchantId) {
    try {
        showLoading();
        const response = await makeAuthorizedRequest(`/merchant/v1.0/merchants/${merchantId}/opening-hours`, 'GET');
        console.log('Horários recebidos:', response);
        
        currentOpeningHours = response;
        currentMerchantId = merchantId;
        
        displayOpeningHours(response);
        
        // Mostra a seção de horários
        const openingHoursSection = document.getElementById('opening-hours');
        if (openingHoursSection) {
            openingHoursSection.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Erro ao buscar horários:', error);
        showToast('Erro ao carregar horários de funcionamento', 'error');
    } finally {
        hideLoading();
    }
}

// Função auxiliar para adicionar minutos a um horário
function addMinutesToTime(timeStr, minutes) {
    const [hours, mins] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, mins);
    date.setMinutes(date.getMinutes() + minutes);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Função para criar editor de turno
function createShiftEditor(day, shift) {
    const shiftDiv = document.createElement('div');
    shiftDiv.className = 'day-shift';
    
    shiftDiv.innerHTML = `
        <input type="time" class="shift-input start-time" value="${shift.start.substring(0, 5)}" required>
        <input type="number" class="shift-input duration" value="${shift.duration}" min="30" step="30" required>
        <span class="end-time">${addMinutesToTime(shift.start, shift.duration)}</span>
        <button class="remove-shift"><i class="fas fa-times"></i></button>
    `;
    
    // Atualiza o horário final quando start ou duration mudam
    const updateEndTime = () => {
        const startInput = shiftDiv.querySelector('.start-time');
        const durationInput = shiftDiv.querySelector('.duration');
        const endTimeSpan = shiftDiv.querySelector('.end-time');
        
        if (startInput.value && durationInput.value) {
            endTimeSpan.textContent = addMinutesToTime(startInput.value + ':00', parseInt(durationInput.value));
        }
    };
    
    shiftDiv.querySelector('.start-time').addEventListener('change', updateEndTime);
    shiftDiv.querySelector('.duration').addEventListener('change', updateEndTime);
    
    shiftDiv.querySelector('.remove-shift').onclick = () => shiftDiv.remove();
    
    return shiftDiv;
}

// Função para salvar os horários
async function saveOpeningHours() {
    try {
        showLoading();
        
        // Coleta os horários do modal
        const shifts = [];
        document.querySelectorAll('.shifts-container').forEach(container => {
            const day = container.getAttribute('data-day');
            
            container.querySelectorAll('.day-shift').forEach(shiftDiv => {
                const startTime = shiftDiv.querySelector('.start-time').value + ':00';
                const duration = parseInt(shiftDiv.querySelector('.duration').value);
                
                shifts.push({
                    dayOfWeek: day,
                    start: startTime,
                    duration: duration
                });
            });
        });
        
        const payload = {
            storeId: currentMerchantId,
            shifts: shifts
        };
        
        // Salva os horários
        await makeAuthorizedRequest(`/merchant/v1.0/merchants/${currentMerchantId}/opening-hours`, 'PUT', payload);
        
        // Busca os horários atualizados
        const updatedHours = await makeAuthorizedRequest(`/merchant/v1.0/merchants/${currentMerchantId}/opening-hours`, 'GET');
        
        // Atualiza a variável global e a interface
        currentOpeningHours = updatedHours;
        displayOpeningHours(updatedHours);
        
        showToast('Horários atualizados com sucesso!', 'success');
        const modal = document.getElementById('hours-modal');
        if (modal) {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        }
        
    } catch (error) {
        console.error('Erro ao salvar horários:', error);
        showToast('Erro ao salvar horários', 'error');
    } finally {
        hideLoading();
    }
}

// Função para exibir os horários na interface
function displayOpeningHours(data) {
    const grid = document.querySelector('.schedule-grid');
    if (!grid) {
        console.error('Grid de horários não encontrada');
        return;
    }
    
    grid.innerHTML = '';
    console.log('Exibindo horários:', data);
    
    const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    
    daysOfWeek.forEach((day, index) => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';
        
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = dayNames[index];
        
        dayColumn.appendChild(dayHeader);
        
        // Filtra os horários para este dia
        const shifts = data.shifts.filter(shift => shift.dayOfWeek === day);
        
        if (!shifts || shifts.length === 0) {
            const closedSlot = document.createElement('div');
            closedSlot.className = 'time-slot closed';
            closedSlot.textContent = 'Fechado';
            dayColumn.appendChild(closedSlot);
        } else {
            shifts.forEach(shift => {
                const timeSlot = document.createElement('div');
                timeSlot.className = 'time-slot';
                
                // Converte a duração em minutos para formato de hora
                const endTime = addMinutesToTime(shift.start, shift.duration);
                timeSlot.textContent = `${shift.start.substring(0, 5)} - ${endTime}`;
                
                dayColumn.appendChild(timeSlot);
            });
        }
        
        grid.appendChild(dayColumn);
    });
    
    // Mostra a seção de horários
    const openingHoursSection = document.getElementById('opening-hours');
    if (openingHoursSection) {
        openingHoursSection.classList.remove('hidden');
    }
}

// Função para mostrar o modal de edição
function showEditModal() {
    const modal = document.getElementById('hours-modal');
    const editor = document.getElementById('schedule-editor');
    if (!modal || !editor) return;
    
    // Limpa o editor
    editor.innerHTML = '';
    
    const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    
    daysOfWeek.forEach((day, index) => {
        const dayShifts = currentOpeningHours.shifts.filter(shift => shift.dayOfWeek === day);
        
        const daySection = document.createElement('div');
        daySection.className = 'day-section';
        daySection.innerHTML = `<h3>${dayNames[index]}</h3>`;
        
        const shiftsContainer = document.createElement('div');
        shiftsContainer.className = 'shifts-container';
        shiftsContainer.setAttribute('data-day', day);
        
        // Adiciona os turnos existentes
        dayShifts.forEach(shift => {
            shiftsContainer.appendChild(createShiftEditor(day, shift));
        });
        
        // Botão para adicionar novo turno
        const addButton = document.createElement('button');
        addButton.className = 'add-shift';
        addButton.innerHTML = '<i class="fas fa-plus"></i> Adicionar Turno';
        addButton.onclick = () => {
            const newShift = { dayOfWeek: day, start: '09:00:00', duration: 360 };
            shiftsContainer.appendChild(createShiftEditor(day, newShift));
        };
        
        daySection.appendChild(shiftsContainer);
        daySection.appendChild(addButton);
        editor.appendChild(daySection);
    });
    
    modal.classList.remove('hidden');
    modal.classList.add('show');
}

// Função para adicionar o campo "Troco Para" às informações do cliente
function addChangeForField(orderElement, order) {
    console.log('Verificando troco para pedido:', order.id);
    
    // Verifica se o pedido tem informações de pagamento
    if (order.payments && order.payments.methods && Array.isArray(order.payments.methods)) {
        console.log('Métodos de pagamento encontrados:', order.payments.methods.length);
        
        // Percorre todos os métodos de pagamento
        for (const method of order.payments.methods) {
            console.log('Verificando método:', method.method);
            
            // Verifica se é um pagamento em dinheiro com troco
            if (method.method && method.method.trim().toLowerCase().includes('cash') && 
                method.cash && method.cash.changeFor) {
                
                const valorTroco = method.cash.changeFor;
                console.log('Troco encontrado:', valorTroco);
                
                // Busca o elemento de lista de pagamentos
                const paymentList = orderElement.querySelector('.payment-info ul');
                
                if (paymentList) {
                    // Busca o item da lista que corresponde ao pagamento em dinheiro
                    const paymentItems = paymentList.querySelectorAll('li');
                    
                    for (const item of paymentItems) {
                        // Verifica se este item contém informação sobre pagamento em dinheiro
                        if (item.textContent.toLowerCase().includes('dinheiro') || 
                            item.textContent.toLowerCase().includes('cash')) {
                            
                            // Adiciona a informação de troco diretamente a este item
                            item.innerHTML += `<br><span class="change-for-info">Troco para: R$ ${valorTroco.toFixed(2)}</span>`;
                            console.log('Troco adicionado ao item de pagamento em dinheiro');
                            return; // Encerra após adicionar
                        }
                    }
                    
                    // Se não encontrou o item específico, adiciona como um novo item
                    const trocoItem = document.createElement('li');
                    trocoItem.className = 'payment-change-for';
                    trocoItem.innerHTML = `<strong>Troco para:</strong> R$ ${valorTroco.toFixed(2)}`;
                    paymentList.appendChild(trocoItem);
                    console.log('Troco adicionado como novo item na lista de pagamentos');
                } else {
                    console.log('Lista de pagamentos não encontrada');
                    
                    // Fallback: adiciona às informações do cliente
                    const customerInfo = orderElement.querySelector('.customer-info');
                    if (customerInfo) {
                        const changeForParagraph = document.createElement('p');
                        changeForParagraph.className = 'customer-change-for';
                        changeForParagraph.innerHTML = `<strong>Troco para:</strong> R$ ${valorTroco.toFixed(2)}`;
                        customerInfo.appendChild(changeForParagraph);
                        console.log('Troco adicionado às informações do cliente (fallback)');
                    }
                }
                
                break; // Encerra o loop após encontrar o troco
            }
        }
    }
}

// Event Listeners
// ─── UNIFICAR TODOS OS DOMContentLoaded ───────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[APP] DOMContentLoaded — iniciando aplicação…');

  // 1) Modal de cancelamento
  const cancelModal = document.getElementById('cancellation-modal');
  if (cancelModal) {
    cancelModal.classList.add('hidden');
    cancelModal.style.display = 'none';
    cancelModal.setAttribute('hidden', 'true');
    console.log("Modal escondido na inicialização do DOMContentLoaded");
  }

  // 2) Corrigir listeners do modal de cancelamento
  const confirmBtn = document.getElementById('confirm-cancellation');
  if (confirmBtn && typeof confirmCancellation === 'function') {
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', () => {
      console.log("Botão confirmar cancelamento clicado");
      confirmCancellation();
    });
  }
  const cancelBtnModal = document.getElementById('cancel-cancellation');
  if (cancelBtnModal && typeof closeCancellationModal === 'function') {
    const newCancelBtn = cancelBtnModal.cloneNode(true);
    cancelBtnModal.parentNode.replaceChild(newCancelBtn, cancelBtnModal);
    newCancelBtn.addEventListener('click', () => {
      console.log("Botão cancelar cancelamento clicado");
      closeCancellationModal();
    });
  }
  const closeModalX = document.querySelector('#cancellation-modal .close-modal');
  if (closeModalX && typeof closeCancellationModal === 'function') {
    const newCloseX = closeModalX.cloneNode(true);
    closeModalX.parentNode.replaceChild(newCloseX, closeModalX);
    newCloseX.addEventListener('click', () => {
      console.log("Botão X para fechar o modal clicado");
      closeCancellationModal();
    });
  }
  if (cancelModal && typeof closeCancellationModal === 'function') {
    cancelModal.addEventListener('click', event => {
      if (event.target === cancelModal) {
        console.log("Clique fora do modal detectado, fechando modal");
        closeCancellationModal();
      }
    });
  }

  // 3) Horários de funcionamento
  const editHoursBtn = document.getElementById('edit-hours');
  if (editHoursBtn && typeof showEditModal === 'function') {
    editHoursBtn.addEventListener('click', showEditModal);
  }
  const saveHoursBtn = document.getElementById('save-hours');
  if (saveHoursBtn && typeof saveOpeningHours === 'function') {
    saveHoursBtn.addEventListener('click', saveOpeningHours);
  }
  const cancelHoursBtn = document.getElementById('cancel-hours');
  if (cancelHoursBtn) {
    cancelHoursBtn.addEventListener('click', () => {
      const hoursModal = document.getElementById('hours-modal');
      if (hoursModal) hoursModal.classList.remove('show');
    });
  }
  const closeHoursX = document.querySelector('#hours-modal .close-modal');
  if (closeHoursX) {
    closeHoursX.addEventListener('click', () => {
      const hoursModal = document.getElementById('hours-modal');
      if (hoursModal) hoursModal.classList.remove('show');
    });
  }
  const hoursModal = document.getElementById('hours-modal');
  if (hoursModal) {
    hoursModal.addEventListener('click', e => {
      if (e.target === hoursModal) {
        hoursModal.classList.remove('show');
      }
    });
  }

  // 4) Limpar pedidos
  const clearOrdersBtn = document.getElementById('clear-orders');
  if (clearOrdersBtn && typeof clearAllOrders === 'function') {
    clearOrdersBtn.addEventListener('click', clearAllOrders);
  }

  // 5) Paginação de lojas
  const prevPageBtn = document.getElementById('prev-page');
  if (prevPageBtn && typeof fetchStores === 'function') {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) fetchStores(currentPage - 1);
    });
  }
  const nextPageBtn = document.getElementById('next-page');
  if (nextPageBtn && typeof fetchStores === 'function') {
    nextPageBtn.addEventListener('click', () => {
      fetchStores(currentPage + 1);
    });
  }

  // 6) Navegação lateral
  const storesSidebar = document.querySelector('.sidebar-item[data-target="stores"]');
  if (storesSidebar) {
    storesSidebar.addEventListener('click', () => {
      if (typeof switchMainTab === 'function') switchMainTab('stores');
      if (typeof fetchStores === 'function') fetchStores(1);
    });
  }
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      if (target && target !== 'stores' && typeof stopStatusPolling === 'function') {
        stopStatusPolling();
      }
      if (target && typeof switchMainTab === 'function') {
        switchMainTab(target);
      }
    });
  });

  // 7) Tabs de pedidos, filtros e busca
  document.querySelectorAll('.tab-item').forEach(tab => {
    const targetTab = tab.getAttribute('data-tab');
    if (targetTab && typeof switchOrderTab === 'function') {
      tab.addEventListener('click', () => switchOrderTab(targetTab));
    }
  });
  document.querySelectorAll('.filter-button').forEach(btn => {
    const filter = btn.getAttribute('data-filter');
    if (filter && typeof applyFilter === 'function') {
      btn.addEventListener('click', () => applyFilter(filter));
    }
  });
  const searchInput = document.getElementById('search-orders');
  if (searchInput && typeof searchOrders === 'function') {
    searchInput.addEventListener('input', () => searchOrders(searchInput.value));
  }

  // 8) Botão “Atualizar pedidos”
  const pollOrdersBtn = document.getElementById('poll-orders');
  if (pollOrdersBtn) {
    pollOrdersBtn.addEventListener('click', async () => {
      if (!state.accessToken && typeof authenticate === 'function') {
        await authenticate();
      }
      if (typeof showLoading === 'function') showLoading();
      try {
        if (typeof fetchActiveOrders === 'function') {
          await fetchActiveOrders();
        }
        state.isPolling = true;
        if (typeof unifiedPolling === 'function') unifiedPolling();
      } finally {
        if (typeof hideLoading === 'function') hideLoading();
      }
    });
  }

  // 9) Alternar status da loja
  const toggleStoreBtn = document.getElementById('toggle-store');
  if (toggleStoreBtn) {
    toggleStoreBtn.addEventListener('click', async () => {
      if (!state.accessToken && typeof authenticate === 'function') {
        await authenticate();
      } else if (typeof toggleStoreStatus === 'function') {
        await toggleStoreStatus();
      }
    });
  }

  // 10) Interrupção manual
  const createInterruptionBtn = document.getElementById('create-interruption');
  if (createInterruptionBtn) {
    createInterruptionBtn.addEventListener('click', () => {
      if (currentMerchantIdForInterruption && typeof openCreateInterruptionModal === 'function') {
        openCreateInterruptionModal();
      } else {
        showToast?.('Selecione uma loja primeiro', 'warning');
      }
    });
  }

  // --- Inicialização da app (auth + UI) ---
  if (typeof initialize === 'function') {
    await initialize();
  } else {
    console.warn('initialize() não definida');
  }

// --- Dispara o polling unificado pela primeira vez ---
  state.isPolling = true;
  lastPoll = Date.now();               // marca agora como último poll
  doUnifiedPolling().then(() => {
    scheduleNextPoll(UNIFIED_POLLING_INTERVAL);
  });

  // --- Correção de pedidos de retirada existentes ---
  console.log('🔄 Verificando pedidos existentes para retirada READY_TO_PICKUP');
  setTimeout(() => {
    document.querySelectorAll('.order-card').forEach(card => {
      const orderId = card.getAttribute('data-order-id');
      if (!orderId) return;
      const order = ordersCache[orderId];
      if (!order) return;
      const isTakeout = typeof isOrderTakeout === 'function' && isOrderTakeout(order);
      const isReady = ['READY_TO_PICKUP','RTP'].includes(order.status)
        || card.classList.contains('status-ready_to_pickup');
      if (isTakeout && isReady) {
        console.log(`🔧 Corrigindo botões para pedido existente ${orderId}`);
        const actions = card.querySelector('.order-actions');
        if (!actions) return;
        actions.innerHTML = '';
        const statusDiv = document.createElement('div');
        statusDiv.className = 'status-message';
        statusDiv.textContent = 'Aguardando Retirada';
        actions.appendChild(statusDiv);
        const btn = document.createElement('button');
        btn.className = 'action-button cancel';
        btn.textContent = 'Cancelar';
        btn.onclick = () => handleOrderAction?.(orderId, 'requestCancellation');
        actions.appendChild(btn);
      }
    });
  }, 2000);

}); // fim do DOMContentLoaded

// ─── FUNÇÃO initialize (sem fetchActiveOrders no boot) ─────────
async function initialize() {
  try {
    const cancelModal = document.getElementById('cancellation-modal');
    if (cancelModal) {
      cancelModal.classList.add('hidden');
      cancelModal.style.display = 'none';
      cancelModal.setAttribute('hidden', 'true');
      console.log("Modal escondido na inicialização");
    }
    if (typeof showLoading === 'function') showLoading();
    if (typeof authenticate === 'function') await authenticate();
    if (typeof updateStoreStatus === 'function') await updateStoreStatus();
    // fetchActiveOrders() removido do boot
  } catch (error) {
    console.error('Erro na inicialização:', error);
    if (typeof showToast === 'function') showToast('Erro ao inicializar aplicação', 'error');
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}

// ─── Evento load para garantir modal sempre oculto ─────────────
window.addEventListener('load', () => {
  const cancelModal = document.getElementById('cancellation-modal');
  if (cancelModal) {
    cancelModal.classList.add('hidden');
    cancelModal.style.display = 'none';
    cancelModal.setAttribute('hidden', 'true');
    console.log("Modal escondido no evento load");
  }
});

// ─── BLOCO DE WEBHOOK UNIFICADO ────────────────────────────────
const webhookIntegration = (() => {
  const POLLING_INTERVAL = CONFIG.pollingInterval;
  let isPolling = false, totalEvents = 0, lastTimestamp = null;

  async function pollWebhookEvents() {
    if (!isPolling || !state.accessToken) return;
    lastTimestamp = new Date().toISOString();
    console.log(`[WEBHOOK] Polling em ${lastTimestamp}`);
    try {
      const res = await fetch('/.netlify/functions/ifood-webhook-events');
      if (!res.ok) throw new Error(res.statusText);
      const { eventos } = await res.json();
      if (eventos?.length) {
        console.log(`[WEBHOOK] ${eventos.length} eventos`, eventos);
        totalEvents += eventos.length;
        for (const ev of eventos) {
          try { await handleEvent(ev); console.log(`[WEBHOOK] Evento ${ev.id} processado`); }
          catch (err) { console.error(`[WEBHOOK] Falha em ${ev.id}:`, err); }
        }
        if (typeof showToast === 'function') showToast(`${eventos.length} eventos via webhook`, 'info');
      }
    } catch (err) {
      console.error('[WEBHOOK] Erro no polling:', err);
    }
  }

  return {
    start() {
      if (!isPolling) {
        isPolling = true; totalEvents = 0;
        console.log('[WEBHOOK] Iniciando polling');
        pollWebhookEvents();
      }
    },
    stop() {
      isPolling = false;
      console.log(`[WEBHOOK] Polling parado. Total eventos: ${totalEvents}`);
    },
    status() {
      console.log(`
[WEBHOOK] STATUS
Polling: ${isPolling}
Última execução: ${lastTimestamp}
Total de eventos: ${totalEvents}
Intervalo: ${POLLING_INTERVAL}ms
      `);
    }
  };
})();

// ─── VERIFICAÇÃO DIRETA DO WEBHOOK ────────────────────────────
function verificarEventosDiretamente() {
  console.log('[WEBHOOK-CHECK] Verificando eventos diretamente...');
  fetch('/.netlify/functions/ifood-webhook?check=true')
    .then(r => r.json())
    .then(data => {
      console.log('[WEBHOOK-CHECK] Resposta:', data);
      if (data.lastEvent) console.log('[WEBHOOK-CHECK] Último evento:', data.lastEvent);
    })
    .catch(err => console.error('[WEBHOOK-CHECK] Erro:', err));
}
window.verificarWebhookEventos = verificarEventosDiretamente;

// ─── FUNÇÃO PARA TESTAR O WEBHOOK ────────────────────────────
window.testarWebhook = () => {
  console.log('Testando endpoint do webhook…');
  fetch('/.netlify/functions/ifood-webhook')
    .then(r => r.json())
    .then(() => showToast?.('Endpoint OK','success'))
    .catch(() => showToast?.('Erro no webhook','error'));
};

// ─── CHECK FOR COMPLETED ORDERS ──────────────────────────────
window.checkForCompletedOrders = async function() {
  try {
    console.log('🔍 Verificando pedidos concluídos…');
    document.querySelectorAll('.order-card').forEach(async card => {
      const orderId = card.getAttribute('data-order-id');
      if (!orderId) return;
      const statusEl = card.querySelector('.order-status');
      if (statusEl && statusEl.textContent === getStatusText('CONCLUDED')) return;
      try {
        const details = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
        if (['CONCLUDED','CONC','CON'].includes(details.status)) {
          console.log(`🏁 Pedido ${orderId} concluído, atualizando interface…`);
          ordersCache[orderId].status = 'CONCLUDED';
          updateOrderStatus(orderId,'CONCLUDED');
          showToast?.(`Pedido #${orderId.slice(0,6)} concluído!`,'success');
        }
      } catch (e) {
        console.error(`Erro ao verificar pedido ${orderId}:`, e);
      }
    });
  } catch (e) {
    console.error('Erro ao verificar pedidos concluídos:', e);
  }
};

// ─── SOBRESCREVER updateOrderStatus PARA TAKEOUT ─────────────
(function(){
  const orig = window.updateOrderStatus;
  window.updateOrderStatus = function(orderId, status) {
    console.log(`🔍 Atualizando status do pedido ${orderId} para ${status}`);
    orig && orig(orderId, status);
    setTimeout(() => {
      const card = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
      const order = ordersCache[orderId];
      const isTakeout = typeof isOrderTakeout === 'function' && isOrderTakeout(order);
      const isReady = ['READY_TO_PICKUP','RTP'].includes(status);
      if (card && order && isTakeout && isReady) {
        console.log(`🔧 Corrigindo botões para takeout ${orderId}`);
        const actions = card.querySelector('.order-actions');
        if (!actions) return;
        actions.innerHTML = '';
        const statusDiv = document.createElement('div');
        statusDiv.className = 'status-message';
        statusDiv.textContent = 'Aguardando Retirada';
        actions.appendChild(statusDiv);
        const btn = document.createElement('button');
        btn.className = 'action-button cancel';
        btn.textContent = 'Cancelar';
        btn.onclick = () => handleOrderAction?.(orderId,'requestCancellation');
        actions.appendChild(btn);
      }
    }, 100);
  };
})();

// ─── MELHORAR isTakeoutOrder EXISTENTE ───────────────────────
(function(){
  const mod = window.takeoutOrdersModule;
  if (mod && typeof mod.isTakeoutOrder === 'function') {
    const orig = mod.isTakeoutOrder;
    mod.isTakeoutOrder = function(order) {
      return orig(order) ||
        order.orderType==='TAKEOUT' ||
        order.takeout?.mode ||
        order.enhancedTakeoutInfo?.mode;
    };
  }
})();

// ─── AUXILIAR isOrderTakeout ─────────────────────────────────
function isOrderTakeout(order) {
  return order?.orderType==='TAKEOUT' ||
         order?.takeout?.mode ||
         order?.enhancedTakeoutInfo?.mode;
}

// ─── EXPÕE PARA OUTROS MÓDULOS ───────────────────────────────
window.displayOrder = displayOrder;
window.state        = state;
window.CONFIG       = CONFIG;

// ─── OVERRIDE GLOBAL fetch PARA IGNORAR WEBHOOK ──────────────
(function(){
  const origFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    const url = typeof input==='string' ? input : input.url;
    if (url.includes('/.netlify/functions/ifood-webhook') ||
        url.includes('/.netlify/functions/ifood-webhook-events')) {
      console.log('🚫 Ignorando webhook:', url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success:true, events:[] })
      });
    }
    return origFetch(input, init);
  };
})();
