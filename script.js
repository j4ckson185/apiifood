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

    // Adiciona o header x-polling-merchants apenas para os endpoints específicos
    if (path === '/events/v1.0/events:polling' || path === '/events/v1.0/events/acknowledgment') {
        headers['x-polling-merchants'] = CONFIG.merchantUUID;
    }

    // Preparação especial para o endpoint de acknowledgment
    let processedBody = null;
    if (method !== 'GET' && body) {
        if (path === '/events/v1.0/events/acknowledgment') {
            // Garantimos que o formato é exatamente { events: [ids] }
            if (body.events && Array.isArray(body.events)) {
                processedBody = JSON.stringify({ 
                    events: body.events.filter(id => id && typeof id === 'string')
                });
            } else {
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

    console.log(`📤 Enviando requisição para ${path}:`);
    console.log('🔐 Headers:', headers);
    console.log('📦 Body:', processedBody);

    try {
        const response = await fetch('/.netlify/functions/ifood-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        console.log(`📥 Resposta bruta de ${path}:`, responseText);

        if (!response.ok) {
            console.error(`❌ Erro ${response.status} ao chamar ${path}`);
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        // Tenta parsear a resposta como JSON
        try {
            return responseText ? JSON.parse(responseText) : {};
        } catch (e) {
            console.warn('⚠️ Resposta não é um JSON válido:', responseText);
            return { raw: responseText };
        }
    } catch (error) {
        console.error(`❌ Erro ao chamar ${path}:`, error);
        throw error;
    }
}


// Polling de eventos
async function pollEvents() {
    if (!state.isPolling || !state.accessToken) return;

    try {
        console.log('📊 Iniciando polling de eventos...');
        const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET', null);
        
        if (events && Array.isArray(events) && events.length > 0) {
            console.log('📬 Eventos recebidos:', events);
            
            // Extrai apenas os IDs dos eventos para acknowledgment
            const eventIds = events.map(event => event.id);
            console.log('🆔 IDs dos eventos para acknowledgment:', eventIds);
            
            // Processa os eventos
            for (const event of events) {
                await handleEvent(event);
            }

            if (eventIds.length > 0) {
                console.log('📤 Enviando acknowledgment com payload:', { events: eventIds });
                
                try {
                    // Envia acknowledgment com formato rigorosamente controlado
                    const ackResponse = await makeAuthorizedRequest(
                        '/events/v1.0/events/acknowledgment', 
                        'POST', 
                        { events: eventIds }
                    );
                    
                    console.log('✅ Acknowledgment enviado com sucesso. Resposta:', ackResponse);
                } catch (ackError) {
                    console.error('❌ Erro no acknowledgment:', ackError);
                    
                    // Tentativa alternativa com formato modificado (última tentativa)
                    console.log('🔄 Tentando formato alternativo para acknowledgment...');
                    try {
                        const ackResponse = await fetch('/.netlify/functions/ifood-proxy', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                path: '/events/v1.0/events/acknowledgment',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${state.accessToken}`,
                                    'x-polling-merchants': CONFIG.merchantUUID
                                },
                                body: JSON.stringify({ events: eventIds })
                            })
                        });
                        
                        const responseText = await ackResponse.text();
                        console.log('📨 Resposta bruta da tentativa alternativa:', responseText);
                    } catch (altError) {
                        console.error('❌ Erro na tentativa alternativa:', altError);
                    }
                }
            }
        } else {
            console.log('📭 Nenhum evento recebido neste polling');
        }
    } catch (error) {
        console.error('❌ Erro no polling:', error);
        
        // Verificar se o token expirou e renovar se necessário
        if (error.message && error.message.includes('401')) {
            console.log('🔑 Token possivelmente expirado. Tentando renovar...');
            state.accessToken = null;
            await authenticate();
        }
    } finally {
        if (state.isPolling) {
            console.log(`⏱️ Agendando próximo polling em ${CONFIG.pollingInterval/1000} segundos`);
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
document.getElementById('poll-orders').addEventListener('click', () => {
    if (!state.accessToken) {
        authenticate();
    } else {
        startPolling();
    }
});

// Inicialização
authenticate();
