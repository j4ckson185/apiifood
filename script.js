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

        const response = await fetch('/.netlify/functions/ifood-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: '/authentication/v1.0/oauth/token',
                method: 'POST',
                body: `grantType=client_credentials&clientId=${CONFIG.clientId}&clientSecret=${CONFIG.clientSecret}`,
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

// Função para fazer requisições autenticadas
async function makeAuthorizedRequest(path, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.accessToken}`
    };

    // Adiciona o header de merchant apenas para o polling
    if (path === '/events/v1.0/events:polling') {
        headers['x-polling-merchants'] = CONFIG.merchantId;
    }

    try {
        const response = await fetch('/.netlify/functions/ifood-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path,
                method,
                body,
                headers // Enviando os headers específicos para o proxy
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        const data = await response.json();
        console.log('Resposta da requisição:', data);
        return data;
    } catch (error) {
        console.error('Erro na requisição:', error);
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

            // Envia acknowledgment
            await makeAuthorizedRequest('/events/v1.0/events/acknowledgment', 'POST', {
                id: events.map(event => event.id)
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

// Manipula um evento recebido
async function handleEvent(event) {
    try {
        if (event.code === 'PLACED') {
            const order = await makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`);
            displayOrder(order);
        } else if (['CONFIRMED', 'CANCELLED', 'READY_TO_PICKUP', 'DISPATCHED'].includes(event.code)) {
            updateOrderStatus(event.orderId, event.code);
        }
    } catch (error) {
        console.error('Erro ao processar evento:', error);
    }
}

// Exibe um pedido na interface
function displayOrder(order) {
    const template = document.getElementById('order-modal-template');
    const orderElement = template.content.cloneNode(true);
    const orderCard = orderElement.querySelector('.order-card');
    
    orderCard.dataset.orderId = order.id;
    orderElement.querySelector('.order-number').textContent = `#${order.id.substring(0, 8)}`;
    orderElement.querySelector('.order-status').textContent = getStatusText(order.status);
    orderElement.querySelector('.customer-name').textContent = `Cliente: ${order.customer.name}`;
    orderElement.querySelector('.customer-phone').textContent = `Tel: ${order.customer.phone || 'N/A'}`;

    const itemsList = orderElement.querySelector('.items-list');
    order.items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}`;
        itemsList.appendChild(li);
    });

    orderElement.querySelector('.total-amount').textContent = `R$ ${order.total.toFixed(2)}`;
    
    const actionsContainer = orderElement.querySelector('.order-actions');
    addActionButtons(actionsContainer, order);

    document.getElementById('orders-grid').appendChild(orderElement);
}

// Atualiza o status de um pedido
function updateOrderStatus(orderId, newStatus) {
    const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
    if (orderCard) {
        orderCard.querySelector('.order-status').textContent = getStatusText(newStatus);
        
        const actionsContainer = orderCard.querySelector('.order-actions');
        actionsContainer.innerHTML = '';
        addActionButtons(actionsContainer, { id: orderId, status: newStatus });
    }
}

// Adiciona botões de ação para um pedido
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

// Executa uma ação em um pedido
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
    showToast('Monitoramento de pedidos iniciado', 'success');
}

// Event Listeners
document.getElementById('poll-orders').addEventListener('click', () => {
    if (!state.accessToken) {
        authenticate();
    } else {
        startPolling();
    }
});

// Inicialização
authenticate();
