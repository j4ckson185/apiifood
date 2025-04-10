// Configurações
const CONFIG = {
    merchantId: '2733980',
    merchantUUID: '3a9fc83b-ffc3-43e9-aeb6-36c9e827a143',
    clientId: 'e6415912-782e-4bd9-b6ea-af48c81ae323',
    clientSecret: '137o75y57ug8fm55ubfoxlwjpl0xm25jxj18ne5mser23mbprj5nfncvfnr82utnzx73ij4h449o298370rjwpycppazsfyh2s0l',
    pollingInterval: 30000, // 30 segundos
};

// Estado da aplicação
let state = {
    accessToken: null,
    isPolling: false,
    activeOrders: new Map(),
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

// Funções de API
async function makeRequest(path, method = 'GET', body = null) {
    try {
        const config = {
            path,
            method,
            body,
            isAuth: path.includes('/oauth/token')
        };

        const fetchResponse = await fetch('/.netlify/functions/ifood-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(state.accessToken && !config.isAuth ? { 'Authorization': `Bearer ${state.accessToken}` } : {})
            },
            body: JSON.stringify(config)
        });

        if (!fetchResponse.ok) {
            throw new Error(`Erro na requisição: ${fetchResponse.status}`);
        }

        return await fetchResponse.json();
    } catch (error) {
        console.error('Erro na requisição:', error);
        showToast(error.message, 'error');
        throw error;
    }
}

async function authenticate() {
    try {
        showLoading();
        const authResponse = await makeRequest('/authentication/v1.0/oauth/token', 'POST', {
            grant_type: 'client_credentials',
            client_id: CONFIG.clientId,
            client_secret: CONFIG.clientSecret
        });

        if (authResponse.accessToken) {
            state.accessToken = authResponse.accessToken;
            initializePolling();
            showToast('Autenticado com sucesso!', 'success');
        } else {
            throw new Error('Token não recebido');
        }
    } catch (error) {
        showToast('Erro na autenticação: ' + error.message, 'error');
        console.error(error);
    } finally {
        hideLoading();
    }
}

async function pollEvents() {
    if (!state.isPolling) return;

    try {
        const events = await makeRequest('/events/1.0/events:polling');
        
        for (const event of events) {
            await processEvent(event);
        }

        // Acknowledge events
        if (events.length > 0) {
            await makeRequest('/events/1.0/acknowledgment', 'POST', {
                id: events.map(e => e.id)
            });
        }
    } catch (error) {
        console.error('Erro no polling:', error);
    } finally {
        if (state.isPolling) {
            setTimeout(pollEvents, CONFIG.pollingInterval);
        }
    }
}

async function processEvent(event) {
    switch (event.code) {
        case 'PLACED':
            await fetchAndDisplayOrder(event.orderId);
            break;
        case 'CONFIRMED':
        case 'CANCELLED':
        case 'READY_TO_PICKUP':
        case 'DISPATCHED':
            updateOrderStatus(event.orderId, event.code);
            break;
    }
}

async function fetchAndDisplayOrder(orderId) {
    try {
        const order = await makeRequest(`/order/v1.0/orders/${orderId}`);
        displayOrder(order);
    } catch (error) {
        showToast(`Erro ao buscar pedido ${orderId}`, 'error');
    }
}

function displayOrder(order) {
    const template = document.getElementById('order-modal-template');
    const orderElement = template.content.cloneNode(true);

    // Preencher informações do pedido
    orderElement.querySelector('.order-number').textContent = `Pedido #${order.id.substring(0, 8)}`;
    orderElement.querySelector('.order-status').textContent = getStatusText(order.status);
    orderElement.querySelector('.customer-name').textContent = `Cliente: ${order.customer.name}`;
    orderElement.querySelector('.customer-phone').textContent = `Telefone: ${order.customer.phone || 'Não informado'}`;

    // Preencher itens
    const itemsList = orderElement.querySelector('.items-list');
    order.items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.quantity}x ${item.name} - R$ ${item.price.toFixed(2)}`;
        itemsList.appendChild(li);
    });

    // Preencher total
    orderElement.querySelector('.total-amount').textContent = `R$ ${order.total.toFixed(2)}`;

    // Adicionar botões de ação baseado no status
    const actionsContainer = orderElement.querySelector('.order-actions');
    addActionButtons(actionsContainer, order);

    // Adicionar ao grid de pedidos
    const ordersGrid = document.getElementById('orders-grid');
    ordersGrid.appendChild(orderElement);
    state.activeOrders.set(order.id, order);
}

function addActionButtons(container, order) {
    const actions = getAvailableActions(order.status);
    actions.forEach(action => {
        const button = document.createElement('button');
        button.className = `action-button ${action.type}`;
        button.textContent = action.label;
        button.onclick = () => handleOrderAction(order.id, action.action);
        container.appendChild(button);
    });
}

function getAvailableActions(status) {
    switch (status) {
        case 'PLACED':
            return [
                { label: 'Confirmar', action: 'confirm', type: 'confirm' },
                { label: 'Cancelar', action: 'cancel', type: 'cancel' }
            ];
        case 'CONFIRMED':
            return [
                { label: 'Iniciar Preparação', action: 'startPreparation', type: 'confirm' }
            ];
        case 'IN_PREPARATION':
            return [
                { label: 'Pronto para Retirada', action: 'readyToPickup', type: 'confirm' }
            ];
        case 'READY_TO_PICKUP':
            return [
                { label: 'Despachar', action: 'dispatch', type: 'confirm' }
            ];
        default:
            return [];
    }
}

async function handleOrderAction(orderId, action) {
    try {
        showLoading();
        await makeRequest(`/order/v1.0/orders/${orderId}/${action}`, 'POST');
        showToast('Ação realizada com sucesso!', 'success');
    } catch (error) {
        showToast('Erro ao realizar ação', 'error');
    } finally {
        hideLoading();
    }
}

function getStatusText(status) {
    const statusMap = {
        'PLACED': 'Novo',
        'CONFIRMED': 'Confirmado',
        'IN_PREPARATION': 'Em Preparação',
        'READY_TO_PICKUP': 'Pronto para Retirada',
        'DISPATCHED': 'Despachado',
        'CANCELLED': 'Cancelado'
    };
    return statusMap[status] || status;
}

async function toggleStore() {
    try {
        showLoading();
        const status = await makeRequest(`/merchant/v1.0/merchants/${CONFIG.merchantId}/status`);
        const newStatus = status.available ? 'CLOSED' : 'AVAILABLE';
        
        await makeRequest(`/merchant/v1.0/merchants/${CONFIG.merchantId}/status`, 'PUT', {
            status: newStatus
        });
        
        updateStoreStatus(newStatus);
        showToast(`Loja ${newStatus === 'AVAILABLE' ? 'aberta' : 'fechada'} com sucesso!`, 'success');
    } catch (error) {
        showToast('Erro ao alterar status da loja', 'error');
    } finally {
        hideLoading();
    }
}

function updateStoreStatus(status) {
    const statusElement = document.getElementById('store-status');
    statusElement.textContent = status === 'AVAILABLE' ? 'Aberta' : 'Fechada';
    statusElement.className = `status-badge ${status === 'AVAILABLE' ? 'online' : 'offline'}`;
}

function initializePolling() {
    state.isPolling = true;
    pollEvents();
}

// Event Listeners
document.getElementById('poll-orders').addEventListener('click', () => {
    if (!state.accessToken) {
        authenticate();
    } else {
        pollEvents();
    }
});

document.getElementById('toggle-store').addEventListener('click', toggleStore);

// Inicialização
authenticate();
