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
    orders: new Map()
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
                body: formData.toString(),
                isAuth: true
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na autenticação: ${response.status}`);
        }

        const data = await response.json();
        state.accessToken = data.accessToken;
        
        if (state.accessToken) {
            showToast('Autenticado com sucesso!', 'success');
            startPolling();
        } else {
            throw new Error('Token não recebido');
        }
    } catch (error) {
        console.error('Erro na autenticação:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Função para fazer requisições autenticadas
async function makeRequest(path, method = 'GET', body = null) {
    try {
        console.log(`Fazendo requisição ${method} para ${path}`);
        
        if (!state.accessToken && !path.includes('/oauth/token')) {
            throw new Error('Token não disponível');
        }

        const response = await fetch('/.netlify/functions/ifood-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(state.accessToken && !path.includes('/oauth/token') ? {
                    'Authorization': `Bearer ${state.accessToken}`
                } : {})
            },
            body: JSON.stringify({
                path,
                method,
                body
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Erro na resposta:', data);
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        return data;
}

// Polling de eventos
async function pollEvents() {
    if (!state.isPolling || !state.accessToken) return;

    try {
        console.log('Iniciando polling...');
        const events = await makeRequest('/events/1.0/events:polling', 'GET');
        
        console.log('Resposta do polling:', events);
        
        if (Array.isArray(events) && events.length > 0) {
            console.log('Eventos recebidos:', events);
            
            // Processa cada evento
            for (const event of events) {
                if (event && event.orderId) {
                    await processEvent(event);
                }
            }

            // Confirma o recebimento dos eventos
            try {
                await makeRequest('/events/1.0/acknowledgment', 'POST', {
                    id: events.map(e => e.id).filter(Boolean)
                });
            } catch (ackError) {
                console.error('Erro no acknowledgment:', ackError);
            }
        } else {
            console.log('Nenhum evento novo.');
        }
    } catch (error) {
        console.error('Erro no polling:', error);
        showToast('Erro ao buscar eventos. Tentando novamente...', 'error');
        
        // Se for erro de autenticação, tenta autenticar novamente
        if (error.message.includes('401')) {
            state.isPolling = false;
            authenticate();
            return;
        }
    } finally {
        if (state.isPolling) {
            console.log('Agendando próximo polling...');
            setTimeout(pollEvents, CONFIG.pollingInterval);
        }
    }
}

// Processa cada evento recebido
async function processEvent(event) {
    try {
        switch (event.code) {
            case 'PLACED':
                const order = await makeRequest(`/order/v1.0/orders/${event.orderId}`);
                displayOrder(order);
                break;
            case 'CONFIRMED':
            case 'CANCELLED':
            case 'READY_TO_PICKUP':
            case 'DISPATCHED':
                updateOrderStatus(event.orderId, event.code);
                break;
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
    
    // Adiciona ID do pedido ao card
    orderCard.dataset.orderId = order.id;

    // Preenche informações básicas
    orderElement.querySelector('.order-number').textContent = `#${order.id.substring(0, 8)}`;
    orderElement.querySelector('.order-status').textContent = getStatusText(order.status);

    // Preenche informações do cliente
    orderElement.querySelector('.customer-name').textContent = `Cliente: ${order.customer.name}`;
    orderElement.querySelector('.customer-phone').textContent = `Tel: ${order.customer.phone || 'N/A'}`;

    // Preenche itens do pedido
    const itemsList = orderElement.querySelector('.items-list');
    order.items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}`;
        itemsList.appendChild(li);
    });

    // Preenche total
    orderElement.querySelector('.total-amount').textContent = `R$ ${order.total.toFixed(2)}`;

    // Adiciona botões de ação
    const actionsContainer = orderElement.querySelector('.order-actions');
    addActionButtons(actionsContainer, order);

    // Adiciona ao grid de pedidos
    document.getElementById('orders-grid').appendChild(orderElement);
    state.orders.set(order.id, order);
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

// Manipula ações do pedido
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

// Atualiza o status de um pedido na interface
function updateOrderStatus(orderId, newStatus) {
    const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
    if (orderCard) {
        orderCard.querySelector('.order-status').textContent = getStatusText(newStatus);
        
        // Atualiza botões de ação
        const actionsContainer = orderCard.querySelector('.order-actions');
        actionsContainer.innerHTML = '';
        
        if (state.orders.has(orderId)) {
            const order = state.orders.get(orderId);
            order.status = newStatus;
            addActionButtons(actionsContainer, order);
        }
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
document.getElementById('poll-orders').addEventListener('click', () => {
    if (!state.accessToken) {
        authenticate();
    } else {
        startPolling();
    }
});

// Inicialização
authenticate();
