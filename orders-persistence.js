// Cache para armazenar os dados completos dos pedidos
const ordersCache = {};
// Cache de timestamps para evitar chamadas repetidas de detalhes de pedidos
const lastOrderFetchTimestamps = {};

// Função para salvar os pedidos no localStorage
// Modificação na função saveOrdersToLocalStorage para incluir pedidos agendados
function saveOrdersToLocalStorage() {
    // Busca todos os containers de pedidos, incluindo pedidos agendados
    const containers = [
        'preparation-orders',
        'dispatched-orders',
        'completed-orders',
        'cancelled-orders',
        'scheduled-orders'  // Adicionamos o container de pedidos agendados
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

// Modificação na função loadOrdersFromLocalStorage para carregar pedidos agendados
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
                    console.log(`Exibindo pedido salvo: ${order.id} (Container: ${containerId})`);
                    
                    // Adiciona ao cache primeiro
                    ordersCache[order.id] = order;
                    
                    // Exibe na interface com base no container
                    if (containerId === 'scheduled-orders' && 
                        typeof displayScheduledOrder === 'function' && 
                        isScheduledOrder(order)) {
                        // Usa a função específica para pedidos agendados
                        displayScheduledOrder(order);
                    } else {
                        // Usa a função padrão para outros pedidos
                        displayOrder(order);
                    }
                    
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
    checkForEmptyTab('scheduled'); // Adiciona verificação para a tab de agendados
}

async function updateAllVisibleOrders() {
    try {
        console.log('Atualizando status de todos os pedidos visíveis...');
        
        const orderCards = document.querySelectorAll('.order-card');
        console.log(`Encontrados ${orderCards.length} pedidos para atualizar`);
        
        for (const card of orderCards) {
            const orderId = card.getAttribute('data-order-id');
            if (!orderId) continue;
            
            try {
                console.log(`Verificando necessidade de buscar detalhes para ${orderId}`);
                const now = Date.now();
                const lastFetch = lastOrderFetchTimestamps[orderId] || 0;
                let orderDetails;
                
 if (ordersCache[orderId]) {
    // Lê status em cache e na UI
    const cachedStatus = ordersCache[orderId].status;
    const uiStatusText = card.querySelector('.order-status')?.textContent;
    const uiStatusCode = Object.entries({
        'Novo':'PLACED','Confirmado':'CONFIRMED','Em Preparação':'IN_PREPARATION',
        'A Caminho':'DISPATCHED','Concluído':'CONCLUDED','Cancelado':'CANCELLED'
    }).find(([,code])=> getStatusText(code)===uiStatusText)?.[1] || cachedStatus;

    if (uiStatusCode === cachedStatus) {
        console.log(`Pedido ${orderId} sem mudança de status (“${cachedStatus}”); usando cache`);
        orderDetails = ordersCache[orderId];
    } else {
        console.log(`Status mudou de ${cachedStatus} para ${uiStatusCode}; buscando detalhes`);
        orderDetails = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
        ordersCache[orderId] = orderDetails;
        lastOrderFetchTimestamps[orderId] = now;
    }
} else {
    console.log(`Primeira vez vendo o pedido ${orderId}; buscando detalhes`);
    orderDetails = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
    ordersCache[orderId] = orderDetails;
    lastOrderFetchTimestamps[orderId] = now;
}
                
                if (orderDetails && orderDetails.status) {
                    ordersCache[orderId] = orderDetails;
                    // ... resto da lógica de updateStatus ...
                }
            } catch (err) {
                console.error(`Erro ao atualizar pedido ${orderId}:`, err);
            }
        }
        
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
    
    // Verifica se é um pedido agendado que deveria ir para a aba de agendados
    if (window.isScheduledOrder && typeof window.isScheduledOrder === 'function' && 
        window.isScheduledOrder(order)) {
        
        const prepTime = window.calculatePrepTime ? window.calculatePrepTime(order) : null;
        const now = new Date();
        
        // Se ainda não está na hora de preparar, exibe na aba de agendados
        if (prepTime && now < prepTime) {
            if (window.displayScheduledOrder && typeof window.displayScheduledOrder === 'function') {
                window.displayScheduledOrder(order);
                console.log(`Pedido agendado ${order.id} exibido na aba de agendados`);
                
                // Salva no localStorage
                saveOrdersToLocalStorage();
                
                return true;
            }
        }
    }
    
    // Se não for agendado ou já estiver na hora de preparar, usa a função original
    originalDisplayOrder(order);
    
    // Salva no localStorage
    saveOrdersToLocalStorage();
};

// Adicionamos verificação para tab de agendados
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

// Sobrescreve a função updateOrderStatus original para incluir cache
window.originalUpdateOrderStatus = window.updateOrderStatus; // Usando objeto window para evitar conflito
window.updateOrderStatus = function(orderId, status) {
    const currentStatus = ordersCache[orderId]?.status;
    
    // Protege contra rebaixamento de status, mas permite cancelamento
    const estadosFinais = ['DISPATCHED', 'CONCLUDED', 'CANCELLED'];
    if (estadosFinais.includes(currentStatus) && currentStatus !== status && status !== 'CANCELLED') {
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
    // Carregar pedidos salvos do localStorage e só então restaurar os agendados
    setTimeout(() => {
        loadOrdersFromLocalStorage();

        // Agora que o cache global (ordersCache) está preenchido,
        // invoque a restauração dos agendados na aba correta:
        if (
            window.scheduledOrdersModule &&
            typeof window.scheduledOrdersModule.restoreScheduledOrders === 'function'
        ) {
            window.scheduledOrdersModule.restoreScheduledOrders();
        }
    }, 2000);
});

// Removido override de pollEvents: agora usamos unifiedPolling() em script.js
// Mantemos um alias para compatibilidade (semelhante à antiga pollEvents)
window.pollEvents = unifiedPolling;

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
        // MODIFICAÇÃO: Tratamento específico para eventos de conclusão
        else if (event.code === 'CON' || event.code === 'CONC' || event.code === 'CONCLUDED') {
            console.log(`🏁 Recebido evento de conclusão (${event.code}) para pedido ${event.orderId}`);
            
            try {
                // Busca o pedido na DOM
                const existingOrder = document.querySelector(`.order-card[data-order-id="${event.orderId}"]`);
                
                if (existingOrder) {
                    console.log('Pedido encontrado na interface, atualizando status para CONCLUDED');
                    
                    // Forçar a atualização do status para CONCLUDED
                    updateOrderStatus(event.orderId, 'CONCLUDED');
                    
                    // Salva no cache
                    if (ordersCache[event.orderId]) {
                        ordersCache[event.orderId].status = 'CONCLUDED';
                    }
                    
                    showToast(`Pedido #${event.orderId.substring(0, 6)} foi concluído!`, 'success');
                    
                    // Garantir que o pedido seja movido para a tab correta
                    const tab = document.getElementById('completed-tab');
                    const container = document.getElementById('completed-orders');
                    
                    if (tab && container && existingOrder) {
                        // Move o card para o container correto
                        container.appendChild(existingOrder);
                        
                        // Verifica se há pedidos em cada tab
                        checkForEmptyTab('preparation');
                        checkForEmptyTab('dispatched');
                        checkForEmptyTab('completed');
                        checkForEmptyTab('cancelled');
                    }
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
                'CAN': 'CANCELLED',                // Código real do iFood para "cancelado"
                'CANC': 'CANCELLED'
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

// Adicione esta função para verificar especificamente pedidos com status de conclusão
async function checkForCompletedOrders() {
    try {
        console.log('🔍 Verificando pedidos concluídos...');
        
        // Busca todos os pedidos visíveis
        const orderCards = document.querySelectorAll('.order-card');
        
        for (const card of orderCards) {
            const orderId = card.getAttribute('data-order-id');
            if (!orderId) continue;
            
            // Verifica se o pedido já está marcado como concluído
            const statusElement = card.querySelector('.order-status');
            if (statusElement && statusElement.textContent === getStatusText('CONCLUDED')) {
                continue; // Já está concluído, não precisa verificar
            }
            
            try {
                // Busca o status atual do pedido
                const orderDetails = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
                
                // Verifica se o status voltou como concluído
                if (orderDetails.status === 'CONCLUDED' || 
                    orderDetails.status === 'CONC' || 
                    orderDetails.status === 'CON') {
                    
                    console.log(`🏁 Pedido ${orderId} está concluído no iFood, atualizando interface...`);
                    
                    // Atualiza o status no cache
                    if (ordersCache[orderId]) {
                        ordersCache[orderId].status = 'CONCLUDED';
                    }
                    
                    // Atualiza a interface
                    updateOrderStatus(orderId, 'CONCLUDED');
                    
                    // Mostra notificação
                    showToast(`Pedido #${orderId.substring(0, 6)} foi concluído!`, 'success');
                }
            } catch (error) {
                console.error(`Erro ao verificar status do pedido ${orderId}:`, error);
            }
        }
    } catch (error) {
        console.error('Erro ao verificar pedidos concluídos:', error);
    }
}

// Configurar verificação periódica de pedidos concluídos
function setupCompletedOrdersCheck() {
    // Verificar a cada 2 minutos
    setInterval(checkForCompletedOrders, 120000);
    
    // Também verifica na inicialização
    setTimeout(checkForCompletedOrders, 5000);
}
