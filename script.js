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
    isPolling: false
};

// Funções de utilidade
const showLoading = () => document.getElementById('loading-overlay').classList.remove('hidden');
const hideLoading = () => document.getElementById('loading-overlay').classList.add('hidden');

const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

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
            startPolling();
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

// Polling de eventos
async function pollEvents() {
    if (!state.isPolling || !state.accessToken) return;

    try {
        console.log('Iniciando polling...');
        const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET', null);
        
        if (events && Array.isArray(events) && events.length > 0) {
            console.log('Eventos recebidos:', events);
            
            // Processa os eventos
            for (const event of events) {
                await handleEvent(event);
            }

            // Formato correto para acknowledgment - array de objetos com propriedade "id"
            const acknowledgmentFormat = events.map(event => ({ id: event.id }));
            console.log('📤 Enviando acknowledgment com formato:', acknowledgmentFormat);

            try {
                // Envia acknowledgment com o formato correto
                const ackResponse = await makeAuthorizedRequest('/events/v1.0/events/acknowledgment', 'POST', acknowledgmentFormat);
                console.log('✅ Acknowledgment enviado com sucesso:', ackResponse);
            } catch (ackError) {
                console.error('❌ Erro no acknowledgment:', ackError);
            }
        } else {
            console.log('Nenhum evento recebido neste polling');
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
}

// Manipula um evento recebido
async function handleEvent(event) {
    try {
        console.log(`Processando evento: ${event.code} para pedido ${event.orderId}`);
        
        // Verifica se é um evento relacionado a pedido
        if (!event.orderId) {
            console.log('Evento sem orderId, ignorando:', event);
            return;
        }
        
        switch (event.code) {
            case 'PLACED':
                // Novo pedido recebido
                console.log('Novo pedido recebido:', event.orderId);
                const order = await makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`, 'GET');
                displayOrder(order);
                showToast('Novo pedido recebido!', 'success');
                break;
                
            case 'CONFIRMED':
            case 'CFM':
                // Pedido confirmado
                updateOrderStatus(event.orderId, 'CONFIRMED');
                break;
                
            case 'READY_TO_PICKUP':
            case 'RTP':
                // Pedido pronto para entrega
                updateOrderStatus(event.orderId, 'READY_TO_PICKUP');
                break;
                
            case 'CANCELLED':
            case 'CAN':
                // Pedido cancelado
                updateOrderStatus(event.orderId, 'CANCELLED');
                break;
                
            case 'CONCLUDED':
            case 'CON':
                // Pedido concluído
                updateOrderStatus(event.orderId, 'CONCLUDED');
                break;
                
            case 'INTEGRATED':
                // Pedido integrado - podemos atualizar dados da loja
                updateStoreStatus();
                break;
                
            default:
                console.log(`Evento não tratado especificamente: ${event.code}`);
                // Para outros eventos de pedido, atualizamos o status
                if (event.orderId) {
                    updateOrderStatus(event.orderId, event.code);
                }
        }
    } catch (error) {
        console.error('Erro ao processar evento:', error);
    }
}

// Atualiza o status de um pedido na interface
function updateOrderStatus(orderId, status) {
    console.log(`Atualizando status do pedido ${orderId} para ${status}`);
    
    // Busca o card do pedido pelo ID parcial
    const orderCards = document.querySelectorAll('.order-card');
    const shortOrderId = orderId.substring(0, 8);
    
    let found = false;
    
    orderCards.forEach(card => {
        const orderNumberElement = card.querySelector('.order-number');
        if (orderNumberElement && orderNumberElement.textContent.includes(shortOrderId)) {
            found = true;
            
            // Atualiza o status
            const statusElement = card.querySelector('.order-status');
            if (statusElement) {
                statusElement.textContent = getStatusText(status);
            }
            
            // Atualiza as ações disponíveis
            const actionsContainer = card.querySelector('.order-actions');
            if (actionsContainer) {
                // Limpa ações existentes
                while (actionsContainer.firstChild) {
                    actionsContainer.removeChild(actionsContainer.firstChild);
                }
                
                // Adiciona novas ações baseadas no status atualizado
                addActionButtons(actionsContainer, { id: orderId, status });
            }
        }
    });
    
    if (!found) {
        console.log(`Pedido ${orderId} não encontrado na interface. Buscando detalhes...`);
        // Se o pedido não estiver na interface, buscamos seus detalhes
        makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET')
            .then(order => {
                displayOrder(order);
            })
            .catch(error => {
                console.error(`Erro ao buscar detalhes do pedido ${orderId}:`, error);
            });
    }
}

// Exibe o pedido na interface
function displayOrder(order) {
    const template = document.getElementById('order-modal-template');
    const orderElement = template.content.cloneNode(true);

    // Preenche informações básicas
    orderElement.querySelector('.order-number').textContent = `#${order.id.substring(0, 8)}`;
    orderElement.querySelector('.order-status').textContent = getStatusText(order.status);
    orderElement.querySelector('.customer-name').textContent = `Cliente: ${order.customer?.name || 'N/A'}`;
    orderElement.querySelector('.customer-phone').textContent = `Tel: ${order.customer?.phone || 'N/A'}`;

    // Preenche itens do pedido
    const itemsList = orderElement.querySelector('.items-list');
    if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
            const li = document.createElement('li');
            const itemPrice = (item.price * item.quantity).toFixed(2);
            li.textContent = `${item.quantity}x ${item.name} - R$ ${itemPrice}`;
            itemsList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'Nenhum item encontrado';
        itemsList.appendChild(li);
    }

    // Preenche total - verifica se total é um número antes de usar toFixed
    const totalAmount = orderElement.querySelector('.total-amount');
    if (typeof order.total === 'number') {
        totalAmount.textContent = `R$ ${order.total.toFixed(2)}`;
    } else if (order.total && typeof order.total.value === 'number') {
        // Em alguns casos, total pode ser um objeto com propriedade value
        totalAmount.textContent = `R$ ${order.total.value.toFixed(2)}`;
    } else {
        // Tenta calcular o total a partir dos itens
        let calculatedTotal = 0;
        if (order.items && Array.isArray(order.items)) {
            calculatedTotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        }
        totalAmount.textContent = `R$ ${calculatedTotal.toFixed(2)}`;
    }

    // Adiciona botões de ação
    const actionsContainer = orderElement.querySelector('.order-actions');
    addActionButtons(actionsContainer, order);

    // Adiciona ao grid de pedidos
    document.getElementById('orders-grid').appendChild(orderElement);
    
    console.log('Pedido exibido com sucesso:', order.id);
}

// Adiciona botões de ação baseado no status do pedido
function addActionButtons(container, order) {
    const actions = {
        'PLACED': [
            { label: 'Confirmar', action: 'confirm' },
            { label: 'Cancelar', action: 'requestCancellation' }
        ],
        'CONFIRMED': [
            { label: 'Iniciar Preparo', action: 'startPreparation' }
        ],
        'IN_PREPARATION': [
            { label: 'Pronto para Retirada', action: 'readyToPickup' }
        ],
        'READY_TO_PICKUP': [
            { label: 'Despachar', action: 'dispatch' }
        ]
    };

    const orderActions = actions[order.status] || [];
    
    orderActions.forEach(({label, action}) => {
        const button = document.createElement('button');
        button.className = `action-button ${action}`;
        button.textContent = label;
        button.onclick = () => handleOrderAction(order.id, action);
        container.appendChild(button);
    });
}

// Função para buscar pedidos ativos usando eventos
async function fetchActiveOrders() {
    try {
        console.log('Buscando pedidos ativos via eventos...');
        
        // Buscar eventos recentes
        const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET');
        
        if (events && Array.isArray(events) && events.length > 0) {
            console.log('Eventos recebidos:', events);
            
            // Filtra eventos relacionados a pedidos
            const orderEvents = events.filter(event => event.orderId);
            
            if (orderEvents.length > 0) {
                // Limpa grid de pedidos existentes
                clearOrdersGrid();
                
                // Busca detalhes de cada pedido único
                const processedOrderIds = new Set();
                
                for (const event of orderEvents) {
                    // Evita processar o mesmo pedido múltiplas vezes
                    if (!processedOrderIds.has(event.orderId)) {
                        processedOrderIds.add(event.orderId);
                        
                        try {
                            const orderDetails = await makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`, 'GET');
                            displayOrder(orderDetails);
                        } catch (orderError) {
                            console.error(`Erro ao buscar detalhes do pedido ${event.orderId}:`, orderError);
                        }
                    }
                }
                
                // Fazer acknowledgment dos eventos processados
                const acknowledgmentFormat = events.map(event => ({ id: event.id }));
                await makeAuthorizedRequest('/events/v1.0/events/acknowledgment', 'POST', acknowledgmentFormat);
                
                showToast(`${processedOrderIds.size} pedidos carregados`, 'success');
            } else {
                console.log('Nenhum evento de pedido encontrado');
                showToast('Nenhum pedido ativo no momento', 'info');
            }
        } else {
            console.log('Nenhum evento recebido');
            showToast('Nenhum pedido ativo no momento', 'info');
        }
    } catch (error) {
        console.error('Erro ao buscar pedidos ativos:', error);
        showToast('Erro ao buscar pedidos', 'error');
    }
}

// Função para limpar o grid de pedidos
function clearOrdersGrid() {
    const ordersGrid = document.getElementById('orders-grid');
    while (ordersGrid.firstChild) {
        ordersGrid.removeChild(ordersGrid.firstChild);
    }
}

// Função para atualizar o status da loja
async function updateStoreStatus() {
    try {
        const storeStatus = await makeAuthorizedRequest(`/merchant/v1.0/merchants/${CONFIG.merchantId}/status`, 'GET');
        const statusElement = document.getElementById('store-status');
        
        if (storeStatus && storeStatus.available) {
            statusElement.textContent = 'Online';
            statusElement.className = 'status-badge online';
        } else {
            statusElement.textContent = 'Offline';
            statusElement.className = 'status-badge offline';
        }
    } catch (error) {
        console.error('Erro ao buscar status da loja:', error);
        const statusElement = document.getElementById('store-status');
        statusElement.textContent = 'Erro';
        statusElement.className = 'status-badge';
    }
}

// Função para alternar o status da loja
async function toggleStoreStatus() {
    try {
        showLoading();
        const storeStatus = await makeAuthorizedRequest(`/merchant/v1.0/merchants/${CONFIG.merchantId}/status`, 'GET');
        
        // Inverte o status atual
        const newStatus = !storeStatus.available;
        
        // Atualiza o status
        await makeAuthorizedRequest(`/merchant/v1.0/merchants/${CONFIG.merchantId}/status`, 'PUT', {
            available: newStatus
        });
        
        // Atualiza a interface
        updateStoreStatus();
        
        showToast(`Loja ${newStatus ? 'ativada' : 'desativada'} com sucesso`, 'success');
    } catch (error) {
        console.error('Erro ao alternar status da loja:', error);
        showToast('Erro ao alternar status da loja', 'error');
    } finally {
        hideLoading();
    }
}

// Manipula ações do pedido
async function handleOrderAction(orderId, action) {
    try {
        showLoading();
        await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}/${action}`, 'POST');
        showToast('Ação realizada com sucesso!', 'success');
    } catch (error) {
        showToast('Erro ao realizar ação', 'error');
    } finally {
        hideLoading();
    }
}

// Converte status para texto amigável
function getStatusText(status) {
    const statusMap = {
        'PLACED': 'Novo',
        'CONFIRMED': 'Confirmado',
        'IN_PREPARATION': 'Em Preparação',
        'READY_TO_PICKUP': 'Pronto para Retirada',
        'DISPATCHED': 'Despachado',
        'CONCLUDED': 'Concluído',
        'CANCELLED': 'Cancelado'
    };
    return statusMap[status] || status;
}

// Inicia o polling de eventos
function startPolling() {
    state.isPolling = true;
    pollEvents();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Botão para atualizar pedidos
    document.getElementById('poll-orders').addEventListener('click', async () => {
        if (!state.accessToken) {
            await authenticate();
        }
        
        showLoading();
        try {
            await fetchActiveOrders();
            startPolling();
        } finally {
            hideLoading();
        }
    });

    // Botão para alternar status da loja
    document.getElementById('toggle-store').addEventListener('click', async () => {
        if (!state.accessToken) {
            await authenticate();
        } else {
            await toggleStoreStatus();
        }
    });

    // Inicialização
    initialize();
});

// Função de inicialização
async function initialize() {
    try {
        showLoading();
        
        // Autenticação inicial
        await authenticate();
        
        // Atualiza status da loja
        await updateStoreStatus();
        
        // Carrega pedidos ativos iniciais
        await fetchActiveOrders();
        
        // Inicia polling de eventos
        startPolling();
    } catch (error) {
        console.error('Erro na inicialização:', error);
        showToast('Erro ao inicializar aplicação', 'error');
    } finally {
        hideLoading();
    }
}
