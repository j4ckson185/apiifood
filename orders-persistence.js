// Cache para armazenar os dados completos dos pedidos
const ordersCache = {};

// Função para salvar os pedidos no localStorage
function saveOrdersToLocalStorage() {
    // Busca todos os containers de pedidos
    const containers = [
        'preparation-orders',
        'dispatched-orders',
        'completed-orders',
        'cancelled-orders'
    ];
    
    const savedOrders = {};
    
    containers.forEach(containerId => {
        savedOrders[containerId] = [];
        const container = document.getElementById(containerId);
        
        if (container) {
            // Para cada pedido no container
            container.querySelectorAll('.order-card').forEach(card => {
                const orderId = card.getAttribute('data-order-id');
                const orderData = ordersCache[orderId]; 
                
                if (orderData) {
                    savedOrders[containerId].push(orderData);
                }
            });
        }
    });
    
    localStorage.setItem('savedOrders', JSON.stringify(savedOrders));
    console.log('Pedidos salvos no localStorage:', Object.keys(savedOrders).length);
}

// Função para carregar os pedidos do localStorage
function loadOrdersFromLocalStorage() {
    const savedOrders = JSON.parse(localStorage.getItem('savedOrders'));
    
    if (!savedOrders) {
        console.log('Nenhum pedido salvo encontrado no localStorage');
        return;
    }
    
    console.log('Carregando pedidos salvos do localStorage');
    
    // Para cada container de pedidos
    Object.keys(savedOrders).forEach(containerId => {
        const ordersList = savedOrders[containerId];
        console.log(`Container ${containerId}: ${ordersList.length} pedidos`);
        
        // Para cada pedido salvo neste container
        ordersList.forEach(order => {
            if (order && order.id) {
                // Verifica se já existe na interface
                const existingOrder = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
                if (!existingOrder) {
                    console.log(`Exibindo pedido salvo: ${order.id}`);
                    // Adiciona ao cache primeiro
                    ordersCache[order.id] = order;
                    // Exibe na interface
                    displayOrder(order);
                    // Marca como já processado
                    processedOrderIds.add(order.id);
                }
            }
        });
    });
    
    // Verifica se há pedidos em cada tab
    checkForEmptyTab('preparation');
    checkForEmptyTab('dispatched');
    checkForEmptyTab('completed');
    checkForEmptyTab('cancelled');
}

// Função para atualizar todos os pedidos visíveis
async function updateAllVisibleOrders() {
    try {
        console.log('Atualizando status de todos os pedidos visíveis...');
        
        // Busca todos os pedidos na interface
        const orderCards = document.querySelectorAll('.order-card');
        console.log(`Encontrados ${orderCards.length} pedidos para atualizar`);
        
        for (const card of orderCards) {
            const orderId = card.getAttribute('data-order-id');
            if (!orderId) continue;
            
            try {
                console.log(`Buscando status atualizado do pedido ${orderId}`);
                const orderDetails = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
                
                if (orderDetails && orderDetails.status) {
                    // Atualiza o cache
                    ordersCache[orderId] = orderDetails;
                    
                    // Verifica se o status mudou
                    const currentStatusElem = card.querySelector('.order-status');
                    if (currentStatusElem) {
                        const currentStatus = currentStatusElem.textContent;
                        const newStatusText = getStatusText(orderDetails.status);
                        
                        if (currentStatus !== newStatusText) {
                            console.log(`Status do pedido ${orderId} mudou de "${currentStatus}" para "${newStatusText}"`);
                            updateOrderStatus(orderId, orderDetails.status);
                        }
                    }
                }
            } catch (err) {
                console.error(`Erro ao atualizar pedido ${orderId}:`, err);
            }
        }
        
        // Salva atualizações no localStorage
        saveOrdersToLocalStorage();
    } catch (error) {
        console.error('Erro ao atualizar todos os pedidos:', error);
    }
}

// Sobrescreve a função displayOrder original para incluir cache
const originalDisplayOrder = displayOrder;
window.displayOrder = function(order) {
    // Adiciona ao cache
    ordersCache[order.id] = order;
    
    // Chama função original
    originalDisplayOrder(order);
    
    // Salva no localStorage
    saveOrdersToLocalStorage();
};

// Sobrescreve a função updateOrderStatus original para incluir cache
const originalUpdateOrderStatus = updateOrderStatus;
window.updateOrderStatus = function(orderId, status) {
    // Se o pedido estiver no cache, atualiza seu status
    if (ordersCache[orderId]) {
        ordersCache[orderId].status = status;
    }
    
    // Chama função original
    originalUpdateOrderStatus(orderId, status);
    
    // Salva no localStorage
    saveOrdersToLocalStorage();
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando persistência de pedidos');
    
    // Carregar pedidos salvos do localStorage
    setTimeout(() => {
        loadOrdersFromLocalStorage();
    }, 2000); // Aguarda 2 segundos para garantir que a página foi carregada
});

// Modificar a função de polling para atualizar todos os pedidos periodicamente
const originalPollEvents = pollEvents;
window.pollEvents = async function() {
    if (!state.isPolling || !state.accessToken) return;

    try {
        console.log('Iniciando polling...');
        const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET');
        
        // Código original
        if (events && Array.isArray(events) && events.length > 0) {
            console.log('Eventos recebidos:', events);
            
            // Processa todos os eventos
            for (const event of events) {
                await handleEvent(event);
            }

            // Formato correto para acknowledgment
            const acknowledgmentFormat = events.map(event => ({ id: event.id }));
            console.log('📤 Enviando acknowledgment com formato:', acknowledgmentFormat);

            try {
                // Envia acknowledgment para todos os eventos
                await makeAuthorizedRequest('/events/v1.0/events/acknowledgment', 'POST', acknowledgmentFormat);
                console.log('✅ Acknowledgment enviado com sucesso');
            } catch (ackError) {
                console.error('❌ Erro ao enviar acknowledgment:', ackError);
            }
        } else {
            console.log('Nenhum evento recebido neste polling');
        }
        
        // Adicionar contador para atualização periódica de todos os pedidos
        state.pollingCounter = (state.pollingCounter || 0) + 1;
        if (state.pollingCounter >= 3) { // A cada 3 ciclos (90 segundos)
            await updateAllVisibleOrders();
            state.pollingCounter = 0;
        }
    } catch (error) {
        console.error('Erro no polling:', error);
        
        // Verificar se o token expirou e renovar se necessário
        if (error.message && error.message.includes('401')) {
            console.log('🔑 Token possivelmente expirado. Tentando renovar...');
            state.accessToken = null;
            await authenticate();
        }
    } finally {
        if (state.isPolling) {
            setTimeout(pollEvents, CONFIG.pollingInterval);
        }
    }
};

// Modificar a função handleEvent para atualizar status a partir de eventos
const originalHandleEvent = handleEvent;
window.handleEvent = async function(event) {
    try {
        console.log(`Processando evento: ${event.code} para pedido ${event.orderId}`);
        
        // Verifica se é um evento relacionado a pedido
        if (!event.orderId) {
            console.log('Evento sem orderId, ignorando:', event);
            return;
        }
        
        // Para eventos PLACED (novos pedidos) - mantém comportamento original
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
else {
    console.log('Processando evento de atualização de status');
    const eventToStatusMap = {
        'CONFIRMED': 'READY_TO_PICKUP',
        'CFM': 'READY_TO_PICKUP',
        'READY_TO_PICKUP': 'READY_TO_PICKUP',
        'RTP': 'READY_TO_PICKUP',
        'DISPATCHED': 'DISPATCHED',
        'DDCR': 'DISPATCHED',
        'CONCLUDED': 'CONCLUDED',
        'CONC': 'CONCLUDED',
        'CANCELLED': 'CANCELLED',
        'CANC': 'CANCELLED',
        'CANCELLATION_REQUESTED': 'CANCELLATION_REQUESTED',
        'CANR': 'CANCELLATION_REQUESTED'
    };
    
    // Se for um evento de status conhecido, atualiza a interface
    if (event.code in eventToStatusMap) {
        const newStatus = eventToStatusMap[event.code];
        console.log(`=== EVENTO DE STATUS RECEBIDO ===`);
        console.log(`Timestamp: ${new Date().toLocaleString()}`);
        console.log(`Tipo de evento: ${event.code}`);
        console.log(`Novo status mapeado: ${newStatus}`);
        console.log(`ID do pedido: ${event.orderId}`);
        
        // Verifica se o pedido está na interface pelo atributo data-order-id
        const existingOrder = document.querySelector(`.order-card[data-order-id="${event.orderId}"]`);
        
        if (existingOrder) {
            // Pedido está na interface, atualiza seu status
            const currentStatus = existingOrder.querySelector('.order-status')?.textContent;
            console.log(`Status atual na interface: ${currentStatus}`);
            console.log(`Atualizando status para: ${newStatus}`);
            updateOrderStatus(event.orderId, newStatus);
        } else {
            // Pedido não está na interface, busca detalhes e exibe
            console.log('Pedido não encontrado na interface, buscando detalhes...');
            try {
                const order = await makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`, 'GET');
                console.log('Detalhes do pedido recebido:', order);
                displayOrder(order);
                processedOrderIds.add(event.orderId);
                saveProcessedIds();
            } catch (orderError) {
                console.error(`Erro ao buscar detalhes do pedido ${event.orderId}:`, orderError);
            }
        }
        console.log('=== FIM DO PROCESSAMENTO ===\n');
    }
}
