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
                body: formData.toString(),
                isAuth: true
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Erro na autenticação: ${response.status}`);
        }

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
        const headers = {
            'Content-Type': 'application/json'
        };

        if (state.accessToken) {
            headers.Authorization = `Bearer ${state.accessToken}`;
        }

        const response = await fetch('/.netlify/functions/ifood-proxy', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                path,
                method,
                body
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
    }
}

// Polling de eventos
async function pollEvents() {
    if (!state.isPolling) return;

    try {
        const events = await makeRequest('/events/1.0/events:polling');
        
        if (events && events.length > 0) {
            console.log('Eventos recebidos:', events);
            
            // Processa cada evento
            for (const event of events) {
                if (event.code === 'PLACED') {
                    await fetchOrderDetails(event.orderId);
                }
            }

            // Confirma o recebimento dos eventos
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

// Busca detalhes do pedido
async function fetchOrderDetails(orderId) {
    try {
        const order = await makeRequest(`/order/v1.0/orders/${orderId}`);
        displayOrder(order);
    } catch (error) {
        console.error('Erro ao buscar pedido:', error);
        showToast(`Erro ao buscar pedido ${orderId}`, 'error');
    }
}

// Exibe o pedido na interface
function displayOrder(order) {
    const template = document.getElementById('order-modal-template');
    const orderElement = template.content.cloneNode(true);

    // Preenche informações básicas
    orderElement.querySelector('.order-number').textContent = `#${order.id.substring(0, 8)}`;
    orderElement.querySelector('.order-status').textContent = getStatusText(order.status);
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
