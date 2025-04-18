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
                        
                        const estadosFinais = ['DISPATCHED', 'CONCLUDED', 'CANCELLED'];
                        if (
                            currentStatus !== newStatusText &&
                            !estadosFinais.includes(currentStatus)
                        ) {
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
    const currentStatus = ordersCache[orderId]?.status;

    // Protege contra rebaixamento de status
    const estadosFinais = ['DISPATCHED', 'CONCLUDED', 'CANCELLED'];
    if (estadosFinais.includes(currentStatus) && currentStatus !== status) {
        console.log(`⚠️ Ignorando update para ${orderId} de ${currentStatus} para ${status}`);
        return;
    }

    if (ordersCache[orderId]) {
        ordersCache[orderId].status = status;
    }

    originalUpdateOrderStatus(orderId, status);
    // Reinsere botão de resumo da negociação, se houver disputa resolvida
if (resolvedDisputes?.[orderId]) {
    const orderCard = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
    if (orderCard) {
        addNegotiationSummaryButton(orderCard, resolvedDisputes[orderId]);
        console.log('🔁 Botão de resumo de negociação reinserido após update de status');
    }
}
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

// Modificar a função handleEvent para incluir logs mais detalhados
window.handleEvent = async function(event) {
    try {
        console.log(`Processando evento: ${event.code} para pedido ${event.orderId}`);
        
        if (!event.orderId) {
            console.log('Evento sem orderId, ignorando:', event);
            return;
        }
        
        if (event.code === 'PLACED' || event.code === 'PLC') {
            if (processedOrderIds.has(event.orderId)) {
                console.log(`Pedido ${event.orderId} já foi processado anteriormente, ignorando`);
                return;
            }
            
            try {
                const order = await makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`, 'GET');
                console.log('Detalhes do pedido recebido:', order);
                
                const existingOrder = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
                if (!existingOrder) {
                    displayOrder(order);
                    showToast('Novo pedido recebido!', 'success');
                    
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
            console.log(`=== EVENTO DE STATUS RECEBIDO ===`);
            console.log(`Timestamp: ${new Date().toLocaleString()}`);
            console.log(`Tipo de evento: ${event.code}`);
            
const eventToStatusMap = {
    'CONFIRMED': 'CONFIRMED',
    'CFM': 'CONFIRMED',
    'READY_TO_PICKUP': 'READY_TO_PICKUP',
    'RTP': 'READY_TO_PICKUP',
    'DISPATCHED': 'DISPATCHED',
    'DDCR': 'DISPATCHED',
    'DSP': 'DISPATCHED',
    'CONCLUDED': 'CONCLUDED',
    'CONC': 'CONCLUDED',
    'CON': 'CONCLUDED',          // ADICIONADO: Mapeamento para CON
    'CAR': 'CANCELLATION_REQUESTED',  // Código real do iFood para "cancelamento solicitado"
    'CAN': 'CANCELLED'                // Código real do iFood para "cancelado"
};
            
if (event.code in eventToStatusMap) {
    const mappedStatus = eventToStatusMap[event.code];

// ✅ Proteção contra regressão de status
const currentStatus = ordersCache[event.orderId]?.status;
const statusPriority = ['PLACED', 'CONFIRMED', 'READY_TO_PICKUP', 'DISPATCHED', 'CONCLUDED', 'CANCELLED'];

const currentIndex = statusPriority.indexOf(currentStatus);
const incomingIndex = statusPriority.indexOf(mappedStatus);

if (currentIndex > -1 && incomingIndex > -1 && incomingIndex < currentIndex) {
    console.log(`⛔ Ignorando regressão de status: ${mappedStatus} < ${currentStatus}`);
    return;
}

    console.log(`=== PROCESSANDO MUDANÇA DE STATUS ===`);
    console.log(`Timestamp: ${new Date().toLocaleString()}`);
    console.log(`Tipo de evento: ${event.code}`);
    console.log(`FullCode do evento: ${event.fullCode || event.code}`);
    console.log(`Novo status mapeado: ${mappedStatus}`);
    console.log(`ID do pedido: ${event.orderId}`);

    const existingOrder = document.querySelector(`.order-card[data-order-id="${event.orderId}"]`);
    const statusNaInterface = existingOrder?.querySelector('.order-status')?.textContent;

    // Evita que DDCR/DSP atualizem automaticamente a interface
    const isSensitiveStatus = ['DISPATCHED'].includes(mappedStatus);

    if (isSensitiveStatus) {
        console.log(`⚠️ Evento ${event.code} mapeado como ${mappedStatus}, mas não será aplicado automaticamente.`);
    } else if (!existingOrder) {
        console.log('Pedido ainda não está na interface. Será exibido agora.');
        // Busca detalhes completos apenas para exibição
        const orderDetails = await makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`, 'GET');
        displayOrder(orderDetails);
        processedOrderIds.add(event.orderId);
        saveProcessedIds();
    } else if (statusNaInterface !== getStatusText(mappedStatus)) {
        console.log(`Atualizando status na interface para: ${mappedStatus}`);
        updateOrderStatus(event.orderId, mappedStatus);
    } else {
        console.log('Status já está atualizado na interface.');
    }

    console.log('=== FIM DO PROCESSAMENTO ===\n');
}

        }
    } catch (error) {
        console.error('Erro ao processar evento:', error);
    }
};
