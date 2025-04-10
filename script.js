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

// Função para atualizar o status da loja
async function updateStoreStatus() {
    try {
        console.log('Atualizando status da loja...');
        
        // Tenta obter o status da loja
        try {
            const storeStatus = await makeAuthorizedRequest(`/merchant/v1.0/merchants/${CONFIG.merchantUUID}/status`, 'GET');
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
            
            // Se for erro de permissão (403), assumimos que a loja está online para fins de UI
            const statusElement = document.getElementById('store-status');
            
            if (error.message && error.message.includes('403')) {
                console.log('Sem permissão para verificar status. Assumindo loja online.');
                statusElement.textContent = 'Online (assumido)';
                statusElement.className = 'status-badge online';
                
                // Desativa o botão de alternar loja
                const toggleButton = document.getElementById('toggle-store');
                if (toggleButton) {
                    toggleButton.disabled = true;
                    toggleButton.title = 'Sem permissão para alterar status';
                }
            } else {
                statusElement.textContent = 'Status desconhecido';
                statusElement.className = 'status-badge';
            }
        }
    } catch (error) {
        console.error('Erro geral ao atualizar status da loja:', error);
    }
}

// Função para alternar o status da loja
async function toggleStoreStatus() {
    try {
        showLoading();
        
        try {
            const storeStatus = await makeAuthorizedRequest(`/merchant/v1.0/merchants/${CONFIG.merchantUUID}/status`, 'GET');
            
            // Inverte o status atual
            const newStatus = !storeStatus.available;
            
            // Atualiza o status
            await makeAuthorizedRequest(`/merchant/v1.0/merchants/${CONFIG.merchantUUID}/status`, 'PUT', {
                available: newStatus
            });
            
            // Atualiza a interface
            updateStoreStatus();
            
            showToast(`Loja ${newStatus ? 'ativada' : 'desativada'} com sucesso`, 'success');
        } catch (error) {
            console.error('Erro ao alternar status da loja:', error);
            
            if (error.message && error.message.includes('403')) {
                showToast('Sem permissão para alterar o status da loja', 'error');
            } else {
                showToast('Erro ao alternar status da loja', 'error');
            }
        }
    } catch (error) {
        console.error('Erro geral ao alternar status da loja:', error);
        showToast('Erro ao alternar status da loja', 'error');
    } finally {
        hideLoading();
    }
}

// Exibe o pedido na interface
function displayOrder(order) {
    const template = document.getElementById('order-modal-template');
    const orderElement = template.content.cloneNode(true);

    // Preenche informações básicas
    orderElement.querySelector('.order-number').textContent = `#${order.displayId || order.id.substring(0, 8)}`;
    orderElement.querySelector('.order-status').textContent = getStatusText(order.status);
    
    // Customer info
    orderElement.querySelector('.customer-name').textContent = `Cliente: ${order.customer?.name || 'N/A'}`;
    
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
        const addressText = document.createElement('p');
        addressText.textContent = address.formattedAddress || 
            `${address.streetName}, ${address.streetNumber}, ${address.complement || ''}, ${address.neighborhood}, ${address.city}`;
        addressDiv.appendChild(addressText);
        
        // Adiciona referência se existir
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
    
    // Adiciona informações de pagamento
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
            
            if (payment.type) {
                paymentText += ` (${payment.type})`;
            }
            
            if (payment.value) {
                paymentText += ` - R$ ${payment.value.toFixed(2)}`;
            }
            
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

    // Preenche itens do pedido
    const itemsList = orderElement.querySelector('.items-list');
    if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
            const li = document.createElement('li');
            // Usa totalPrice se disponível, senão calcula a partir do preço unitário e quantidade
            const itemPrice = item.totalPrice || (item.price * item.quantity);
            li.textContent = `${item.quantity}x ${item.name} - R$ ${itemPrice.toFixed(2)}`;
            
            // Adiciona observações se houver
            if (item.observations) {
                const obsSpan = document.createElement('span');
                obsSpan.className = 'item-observations';
                obsSpan.textContent = `Obs: ${item.observations}`;
                li.appendChild(document.createElement('br'));
                li.appendChild(obsSpan);
            }
            
            // Adiciona opções se houver
            if (item.options && item.options.length > 0) {
                const optionsList = document.createElement('ul');
                optionsList.className = 'options-list';
                
                item.options.forEach(option => {
                    const optionLi = document.createElement('li');
                    optionLi.textContent = `${option.quantity}x ${option.name} (+R$ ${option.addition || option.price || 0})`;
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

    // Preenche total
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
                subTotal.textContent = `Subtotal: R$ ${order.total.subTotal.toFixed(2)}`;
                totalDetails.appendChild(subTotal);
            }
            
            if (order.total.deliveryFee) {
                const deliveryFee = document.createElement('p');
                deliveryFee.textContent = `Taxa de entrega: R$ ${order.total.deliveryFee.toFixed(2)}`;
                totalDetails.appendChild(deliveryFee);
            }
            
            if (order.total.benefits && order.total.benefits > 0) {
                const benefits = document.createElement('p');
                benefits.textContent = `Descontos: -R$ ${order.total.benefits.toFixed(2)}`;
                totalDetails.appendChild(benefits);
            }
            
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
    
    // Adiciona classe baseada no status
    if (order.status) {
        orderCard.classList.add(`status-${order.status.toLowerCase()}`);
    }

    // Adiciona ao grid de pedidos
    document.getElementById('orders-grid').appendChild(orderElement);
    
    console.log('Pedido exibido com sucesso:', order.id);
}

// Adiciona botões de ação baseado no status do pedido
function addActionButtons(container, order) {
    console.log('Adicionando botões de ação para pedido com status:', order.status);
    
    // Limpa botões existentes
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    const actions = {
        'PLACED': [
            { label: 'Confirmar', action: 'confirm', class: 'confirm' },
            { label: 'Cancelar', action: 'requestCancellation', class: 'cancel' }
        ],
        'CONFIRMED': [
            { label: 'Iniciar Preparo', action: 'startPreparation', class: 'prepare' }
        ],
        'IN_PREPARATION': [
            { label: 'Pronto para Retirada', action: 'readyToPickup', class: 'ready' }
        ],
        'READY_TO_PICKUP': [
            { label: 'Despachar', action: 'dispatch', class: 'dispatch' }
        ],
        // Adicione outros status conforme necessário
    };
    
    // Se não encontramos o status na lista acima, verificamos se o status começa com algum dos prefixos conhecidos
    let orderActions = actions[order.status] || [];
    
    if (orderActions.length === 0) {
        if (order.status && typeof order.status === 'string') {
            // Tenta encontrar ações para status similares
            const statusLower = order.status.toLowerCase();
            
            if (statusLower.includes('placed') || statusLower.includes('new')) {
                orderActions = actions['PLACED'];
            } else if (statusLower.includes('confirm')) {
                orderActions = actions['CONFIRMED'];
            } else if (statusLower.includes('prepar')) {
                orderActions = actions['IN_PREPARATION'];
            } else if (statusLower.includes('ready') || statusLower.includes('pickup')) {
                orderActions = actions['READY_TO_PICKUP'];
            }
        }
    }
    
    console.log(`Encontradas ${orderActions.length} ações para o status ${order.status}`);
    
    // Se ainda não encontramos ações, verificamos pelo tipo de pedido
    if (orderActions.length === 0 && !order.status) {
        // Pedido novo sem status explícito
        orderActions = actions['PLACED'];
        console.log('Usando ações de pedido novo para pedido sem status');
    }
    
    // Adiciona os botões de ação
    orderActions.forEach(({label, action, class: buttonClass}) => {
        const button = document.createElement('button');
        button.className = `action-button ${buttonClass || action}`;
        button.textContent = label;
        button.onclick = () => handleOrderAction(order.id, action);
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

// Manipula ações do pedido
async function handleOrderAction(orderId, action) {
    try {
        console.log(`Executando ação ${action} para o pedido ${orderId}`);
        showLoading();
        
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
        
        // Executa a ação na API
        const response = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}${endpoint}`, 'POST');
        console.log(`Resposta da ação ${action}:`, response);
        
        // Atualiza o status do pedido na interface
        let newStatus;
        switch (action) {
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
            case 'requestCancellation':
                newStatus = 'CANCELLATION_REQUESTED';
                break;
        }
        
        if (newStatus) {
            updateOrderStatus(orderId, newStatus);
        }
        
        showToast(`Ação "${action}" realizada com sucesso!`, 'success');
    } catch (error) {
        console.error(`Erro ao realizar ação ${action} para o pedido ${orderId}:`, error);
        showToast(`Erro ao realizar ação: ${error.message}`, 'error');
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
