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

// Rastreamento de pedidos já processados para evitar duplicações
const processedOrderIds = new Set();

// Rastreamento de pedidos já processados para evitar duplicações - usando localStorage para persistência
// Inicializa o conjunto de IDs processados a partir do localStorage (se existir)
const processedOrderIds = new Set(
    JSON.parse(localStorage.getItem('processedOrderIds') || '[]')
);

// Função auxiliar para salvar IDs processados no localStorage
function saveProcessedIds() {
    localStorage.setItem('processedOrderIds', JSON.stringify([...processedOrderIds]));
}

// Polling de eventos melhorado para evitar duplicações
async function pollEvents() {
    if (!state.isPolling || !state.accessToken) return;

    try {
        console.log('Iniciando polling...');
        const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET', null);
        
        if (events && Array.isArray(events) && events.length > 0) {
            console.log('Eventos recebidos:', events);
            
            // Processa os eventos evitando duplicações
            for (const event of events) {
                await handleEvent(event);
            }

            // Formato correto para acknowledgment
            const acknowledgmentFormat = events.map(event => ({ id: event.id }));
            console.log('📤 Enviando acknowledgment com formato:', acknowledgmentFormat);

            try {
                // Envia acknowledgment
                await makeAuthorizedRequest('/events/v1.0/events/acknowledgment', 'POST', acknowledgmentFormat);
                console.log('✅ Acknowledgment enviado com sucesso');
            } catch (ackError) {
                console.error('❌ Erro ao enviar acknowledgment:', ackError);
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

// Manipulador de eventos melhorado para evitar duplicações
async function handleEvent(event) {
    try {
        console.log(`Processando evento: ${event.code} para pedido ${event.orderId}`);
        
        // Verifica se é um evento relacionado a pedido
        if (!event.orderId) {
            console.log('Evento sem orderId, ignorando:', event);
            return;
        }
        
        // Para eventos PLACED (novos pedidos)
        if (event.code === 'PLACED') {
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
                    console.log(`Pedido ${order.id} já está na interface, atualizando status`);
                    updateOrderStatus(order.id, order.status);
                }
            } catch (orderError) {
                console.error(`Erro ao buscar detalhes do pedido ${event.orderId}:`, orderError);
            }
        } else {
            // Para outros tipos de evento, apenas atualiza o status
            // Não precisamos rastrear esses eventos, pois não criam duplicatas
            updateOrderStatus(event.orderId, event.code);
        }
    } catch (error) {
        console.error('Erro ao processar evento:', error);
    }
}

// Função modificada de exibição de pedido para garantir que cada pedido tem um atributo data-order-id
function displayOrder(order) {
    const template = document.getElementById('order-modal-template');
    const orderElement = template.content.cloneNode(true);

    // Preenche informações básicas
    orderElement.querySelector('.order-number').textContent = `#${order.displayId || order.id.substring(0, 8)}`;
    orderElement.querySelector('.order-status').textContent = getStatusText(order.status);
    orderElement.querySelector('.customer-name').textContent = `Cliente: ${order.customer?.name || 'N/A'}`;
    
    // Adaptação para diferentes formatos de telefone
    let phoneText = 'Tel: N/A';
    if (order.customer?.phone) {
        if (typeof order.customer.phone === 'string') {
            phoneText = `Tel: ${order.customer.phone}`;
        } else if (order.customer.phone.number) {
            phoneText = `Tel: ${order.customer.phone.number}`;
        }
    }
    orderElement.querySelector('.customer-phone').textContent = phoneText;

    // Preenche itens do pedido
    const itemsList = orderElement.querySelector('.items-list');
    if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
            const li = document.createElement('li');
            
            // Adaptação para diferentes formatos de preço
            let itemPrice;
            if (typeof item.price === 'number' && typeof item.quantity === 'number') {
                itemPrice = (item.price * item.quantity).toFixed(2);
            } else if (item.totalPrice) {
                itemPrice = item.totalPrice.toFixed(2);
            } else {
                itemPrice = '0.00';
            }
            
            li.textContent = `${item.quantity}x ${item.name} - R$ ${itemPrice}`;
            itemsList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'Nenhum item encontrado';
        itemsList.appendChild(li);
    }

    // Preenche total - adaptação para diferentes formatos
    const totalAmount = orderElement.querySelector('.total-amount');
    if (typeof order.total === 'number') {
        totalAmount.textContent = `R$ ${order.total.toFixed(2)}`;
    } else if (order.total && typeof order.total.value === 'number') {
        totalAmount.textContent = `R$ ${order.total.value.toFixed(2)}`;
    } else if (order.total && (order.total.subTotal || order.total.orderAmount)) {
        // Usa orderAmount ou subTotal + deliveryFee
        const totalValue = order.total.orderAmount || 
                          (order.total.subTotal + (order.total.deliveryFee || 0));
        totalAmount.textContent = `R$ ${totalValue.toFixed(2)}`;
    } else {
        // Tenta calcular o total a partir dos itens
        let calculatedTotal = 0;
        if (order.items && Array.isArray(order.items)) {
            calculatedTotal = order.items.reduce((sum, item) => {
                let itemTotal = 0;
                if (item.totalPrice) {
                    itemTotal = item.totalPrice;
                } else if (typeof item.price === 'number' && typeof item.quantity === 'number') {
                    itemTotal = item.price * item.quantity;
                }
                return sum + itemTotal;
            }, 0);
        }
        totalAmount.textContent = `R$ ${calculatedTotal.toFixed(2)}`;
    }

    // Adiciona botões de ação
    const actionsContainer = orderElement.querySelector('.order-actions');
    addActionButtons(actionsContainer, order);

    // IMPORTANTE: Adiciona um data-attribute com o ID do pedido para facilitar atualizações e evitar duplicações
    const orderCard = orderElement.querySelector('.order-card');
    orderCard.setAttribute('data-order-id', order.id);

    // Adiciona ao grid de pedidos
    document.getElementById('orders-grid').appendChild(orderElement);
    
    console.log('Pedido exibido com sucesso:', order.id);
}

// Função para limpar pedidos processados (opção para depuração)
function clearProcessedOrders() {
    processedOrderIds.clear();
    localStorage.removeItem('processedOrderIds');
    console.log('Lista de pedidos processados foi limpa');
}

// Função simplificada para atualizar o status da loja
async function updateStoreStatus() {
    try {
        console.log('Atualizando status da loja...');
        const statusElement = document.getElementById('store-status');
        
        // Verifica se temos um token válido - se sim, assume que a loja está online
        if (state.accessToken) {
            console.log('Token válido encontrado, assumindo loja online');
            statusElement.textContent = 'Online';
            statusElement.className = 'status-badge online';
            return;
        } else {
            statusElement.textContent = 'Offline';
            statusElement.className = 'status-badge offline';
        }
    } catch (error) {
        console.error('Erro geral ao atualizar status da loja:', error);
        // Assume online para não interromper a experiência do usuário
        const statusElement = document.getElementById('store-status');
        statusElement.textContent = 'Online (assumido)';
        statusElement.className = 'status-badge online';
    }
}

// Função simplificada para alternar o status da loja
async function toggleStoreStatus() {
    // Como não temos acesso real ao status, apenas atualizamos a interface
    const statusElement = document.getElementById('store-status');
    const isCurrentlyOnline = statusElement.textContent.includes('Online');
    
    try {
        showLoading();
        
        if (isCurrentlyOnline) {
            statusElement.textContent = 'Offline';
            statusElement.className = 'status-badge offline';
            showToast('Loja marcada como offline na interface', 'info');
        } else {
            statusElement.textContent = 'Online';
            statusElement.className = 'status-badge online';
            showToast('Loja marcada como online na interface', 'info');
        }
        
        // Aviso sobre a limitação
        console.log('Nota: O status real da loja não pôde ser alterado devido a limitações de permissão');
        setTimeout(() => {
            showToast('O status pode não ser sincronizado com o iFood devido a permissões', 'warning');
        }, 2000);
    } catch (error) {
        console.error('Erro ao alternar status da loja:', error);
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
    
    // Mapeamento detalhado de status para ações
    const actions = {
        'PLACED': [
            { label: 'Confirmar', action: 'confirm', class: 'confirm' },
            { label: 'Cancelar', action: 'requestCancellation', class: 'cancel' }
        ],
        'CONFIRMED': [
            { label: 'Iniciar Preparo', action: 'startPreparation', class: 'prepare' },
            { label: 'Cancelar', action: 'requestCancellation', class: 'cancel' }
        ],
        'IN_PREPARATION': [
            { label: 'Pronto para Retirada', action: 'readyToPickup', class: 'ready' },
            { label: 'Cancelar', action: 'requestCancellation', class: 'cancel' }
        ],
        'READY_TO_PICKUP': [
            { label: 'Despachar', action: 'dispatch', class: 'dispatch' },
            { label: 'Cancelar', action: 'requestCancellation', class: 'cancel' }
        ],
        'DISPATCHED': [
            { label: 'Cancelar', action: 'requestCancellation', class: 'cancel' }
        ],
        'CANCELLATION_REQUESTED': [
            { label: 'Cancelamento Solicitado', action: null, class: 'disabled' }
        ],
        'CANCELLED': [
            { label: 'Pedido Cancelado', action: null, class: 'disabled' }
        ],
        'CONCLUDED': [
            { label: 'Pedido Concluído', action: null, class: 'disabled' }
        ]
    };
    
    // Determina o tipo de pedido (delivery ou para retirar)
    let isDelivery = true;
    if (order.orderType === 'TAKEOUT' || (order.takeout && order.takeout.mode)) {
        isDelivery = false;
    }
    
    // Pega o status normalizado
    let orderStatus = order.status;
    if (!orderStatus && order.id) {
        // Se não tiver status mas tiver ID, considera como PLACED
        orderStatus = 'PLACED';
    }
    
    // Se não encontramos o status na lista acima, verificamos se o status começa com algum dos prefixos conhecidos
    let orderActions = actions[orderStatus] || [];
    
    if (orderActions.length === 0) {
        if (orderStatus && typeof orderStatus === 'string') {
            // Tenta encontrar ações para status similares
            const statusLower = orderStatus.toLowerCase();
            
            if (statusLower.includes('placed') || statusLower.includes('new')) {
                orderActions = actions['PLACED'];
            } else if (statusLower.includes('confirm')) {
                orderActions = actions['CONFIRMED'];
            } else if (statusLower.includes('prepar')) {
                orderActions = actions['IN_PREPARATION'];
            } else if (statusLower.includes('ready') || statusLower.includes('pickup')) {
                orderActions = actions['READY_TO_PICKUP'];
            } else if (statusLower.includes('dispatch') || statusLower.includes('delivered')) {
                orderActions = actions['DISPATCHED'];
            } else if (statusLower.includes('cancel')) {
                orderActions = actions['CANCELLED'];
            } else if (statusLower.includes('conclud')) {
                orderActions = actions['CONCLUDED'];
            }
        }
    }
    
    console.log(`Encontradas ${orderActions.length} ações para o status ${orderStatus}`);
    
    // Adiciona os botões de ação
    orderActions.forEach(({label, action, class: buttonClass}) => {
        const button = document.createElement('button');
        button.className = `action-button ${buttonClass || action}`;
        button.textContent = label;
        
        if (action) {
            button.onclick = () => handleOrderAction(order.id, action);
        } else {
            button.disabled = true;
        }
        
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
// Função para buscar pedidos ativos usando eventos
async function fetchActiveOrders() {
    try {
        console.log('Buscando pedidos ativos via eventos...');
        showToast('Buscando pedidos ativos...', 'info');
        
        // Buscar eventos recentes
        const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET');
        
        if (events && Array.isArray(events) && events.length > 0) {
            console.log('Eventos recebidos:', events);
            
            // Filtra eventos relacionados a pedidos
            const orderEvents = events.filter(event => event.orderId);
            
            if (orderEvents.length > 0) {
                // Limpa grid de pedidos existentes para evitar duplicações
                clearOrdersGrid();
                
                // Busca detalhes de cada pedido único
                const processedOrderIds = new Set();
                const successfulOrders = [];
                
                for (const event of orderEvents) {
                    // Evita processar o mesmo pedido múltiplas vezes
                    if (!processedOrderIds.has(event.orderId)) {
                        processedOrderIds.add(event.orderId);
                        
                        try {
                            console.log(`Buscando detalhes do pedido ${event.orderId}`);
                            const orderDetails = await makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`, 'GET');
                            console.log(`Detalhes recebidos para pedido ${event.orderId}:`, orderDetails);
                            
                            displayOrder(orderDetails);
                            successfulOrders.push(orderDetails);
                        } catch (orderError) {
                            console.error(`Erro ao buscar detalhes do pedido ${event.orderId}:`, orderError);
                        }
                    }
                }
                
                // Fazer acknowledgment dos eventos processados
                if (events.length > 0) {
                    try {
                        const acknowledgmentFormat = events.map(event => ({ id: event.id }));
                        await makeAuthorizedRequest('/events/v1.0/events/acknowledgment', 'POST', acknowledgmentFormat);
                        console.log('Acknowledgment enviado com sucesso para eventos:', events.map(e => e.id));
                    } catch (ackError) {
                        console.error('Erro ao enviar acknowledgment:', ackError);
                    }
                }
                
                if (successfulOrders.length > 0) {
                    showToast(`${successfulOrders.length} pedidos carregados`, 'success');
                } else {
                    showToast('Nenhum pedido ativo encontrado', 'info');
                }
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

// Função para atualizar o status da loja - nova tentativa com endpoint correto
async function updateStoreStatus() {
    try {
        console.log('Atualizando status da loja...');
        
        // Tenta obter o status da loja usando o endpoint correto da documentação
        try {
            // Nota: Usando apenas merchantId (numérico), não UUID
            const response = await makeAuthorizedRequest(`/merchant/v1.0/merchants/${CONFIG.merchantId}/status`, 'GET');
            console.log('Resposta completa do status da loja:', response);
            
            const statusElement = document.getElementById('store-status');
            
            // Verificar se recebemos uma resposta válida
            if (response && Array.isArray(response) && response.length > 0) {
                // Procura pelo status DEFAULT ou qualquer outra operação disponível
                const defaultStatus = response.find(s => s.operation === 'DEFAULT') || response[0];
                
                if (defaultStatus && defaultStatus.available) {
                    statusElement.textContent = 'Online';
                    statusElement.className = 'status-badge online';
                } else {
                    statusElement.textContent = 'Offline';
                    statusElement.className = 'status-badge offline';
                }
            } else {
                // Se não receber dados válidos
                statusElement.textContent = 'Status desconhecido';
                statusElement.className = 'status-badge';
            }
        } catch (error) {
            console.error('Erro detalhado ao buscar status da loja:', error);
            console.log('Tentando abordagem alternativa...');
            
            // ALTERNATIVA: tentar outro endpoint que não exija permissões especiais
            try {
                // Tentar obter detalhes básicos do merchant que também podem indicar status
                const merchantDetails = await makeAuthorizedRequest(`/merchant/v1.0/merchants/${CONFIG.merchantId}`, 'GET');
                console.log('Detalhes do merchant:', merchantDetails);
                
                const statusElement = document.getElementById('store-status');
                
                if (merchantDetails && merchantDetails.status) {
                    // Se obtivermos um status dos detalhes do merchant
                    const isActive = merchantDetails.status === 'ACTIVE';
                    statusElement.textContent = isActive ? 'Online' : 'Offline';
                    statusElement.className = isActive ? 'status-badge online' : 'status-badge offline';
                } else {
                    // Assume online se conseguimos obter os detalhes
                    statusElement.textContent = 'Online (assumido)';
                    statusElement.className = 'status-badge online';
                }
            } catch (altError) {
                console.error('Erro também na abordagem alternativa:', altError);
                
                // Última alternativa: assumir status com base no token
                const statusElement = document.getElementById('store-status');
                statusElement.textContent = 'Online (assumido)';
                statusElement.className = 'status-badge online';
            }
        }
    } catch (error) {
        console.error('Erro geral ao atualizar status da loja:', error);
    }
}

// Variáveis globais para controle de cancelamento
let currentCancellationOrderId = null;
let cancellationReasons = [];

// Manipula ações do pedido
async function handleOrderAction(orderId, action) {
    try {
        console.log(`Executando ação ${action} para o pedido ${orderId}`);
        
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
        
        // Tratamento especial para cancelamento
        if (action === 'requestCancellation') {
            // Primeiro, buscar os motivos de cancelamento disponíveis
            showLoading();
            try {
                cancellationReasons = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}/cancellationReasons`, 'GET');
                console.log('Motivos de cancelamento disponíveis:', cancellationReasons);
                
                if (cancellationReasons && cancellationReasons.length > 0) {
                    // Guarda o ID do pedido atual para cancelamento
                    currentCancellationOrderId = orderId;
                    
                    // Preenche o select com os motivos
                    const select = document.getElementById('cancellation-reason');
                    select.innerHTML = '';
                    
                    cancellationReasons.forEach(reason => {
                        const option = document.createElement('option');
                        option.value = reason.cancelCodeId;
                        option.textContent = reason.description;
                        select.appendChild(option);
                    });
                    
                    // Mostra o modal de cancelamento
                    hideLoading();
                    document.getElementById('cancellation-modal').classList.remove('hidden');
                } else {
                    // Se não tiver motivos disponíveis
                    hideLoading();
                    showToast('Não foi possível obter os motivos de cancelamento', 'error');
                }
            } catch (cancelError) {
                hideLoading();
                console.error('Erro ao obter motivos de cancelamento:', cancelError);
                showToast('Erro ao obter motivos de cancelamento', 'error');
            }
        } else {
            // Para outras ações, envia normalmente
            showLoading();
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
            }
            
            if (newStatus) {
                updateOrderStatus(orderId, newStatus);
            }
            
            hideLoading();
            showToast(`Ação "${action}" realizada com sucesso!`, 'success');
        }
    } catch (error) {
        hideLoading();
        console.error(`Erro ao realizar ação ${action} para o pedido ${orderId}:`, error);
        showToast(`Erro ao realizar ação: ${error.message}`, 'error');
    }
}

// Função para confirmar o cancelamento com o motivo selecionado
async function confirmCancellation() {
    if (!currentCancellationOrderId) {
        showToast('Erro: ID do pedido não encontrado', 'error');
        return;
    }
    
    const select = document.getElementById('cancellation-reason');
    const selectedReasonId = select.value;
    
    if (!selectedReasonId) {
        showToast('Selecione um motivo para cancelar', 'warning');
        return;
    }
    
    // Encontra a descrição do motivo selecionado
    const selectedReason = cancellationReasons.find(r => r.cancelCodeId === selectedReasonId);
    
    if (!selectedReason) {
        showToast('Motivo inválido', 'error');
        return;
    }
    
    try {
        showLoading();
        // Fecha o modal
        document.getElementById('cancellation-modal').classList.add('hidden');
        
        // Envia a requisição de cancelamento com o motivo
        const response = await makeAuthorizedRequest(`/order/v1.0/orders/${currentCancellationOrderId}/requestCancellation`, 'POST', {
            cancellationCode: selectedReason.cancelCodeId,
            reason: selectedReason.description
        });
        
        console.log('Resposta do cancelamento:', response);
        
        // Atualiza o status do pedido na interface
        updateOrderStatus(currentCancellationOrderId, 'CANCELLED');
        
        hideLoading();
        showToast(`Pedido cancelado com sucesso!`, 'success');
    } catch (error) {
        hideLoading();
        console.error('Erro ao cancelar pedido:', error);
        showToast(`Erro ao cancelar pedido: ${error.message}`, 'error');
    } finally {
        // Limpa o ID do pedido atual
        currentCancellationOrderId = null;
    }
}

// Função para fechar o modal de cancelamento
function closeCancellationModal() {
    document.getElementById('cancellation-modal').classList.add('hidden');
    currentCancellationOrderId = null;
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

// Adicione estes event listeners no final do seu arquivo script.js
// ou dentro da função de inicialização

// Event listeners para o modal de cancelamento
document.addEventListener('DOMContentLoaded', () => {
    // Botão de confirmar cancelamento
    document.getElementById('confirm-cancellation').addEventListener('click', () => {
        confirmCancellation();
    });
    
    // Botão de cancelar cancelamento
    document.getElementById('cancel-cancellation').addEventListener('click', () => {
        closeCancellationModal();
    });
    
    // Botão X para fechar o modal
    document.querySelector('.close-modal').addEventListener('click', () => {
        closeCancellationModal();
    });
    
    // Fechar o modal ao clicar fora dele
    document.getElementById('cancellation-modal').addEventListener('click', (event) => {
        if (event.target === document.getElementById('cancellation-modal')) {
            closeCancellationModal();
        }
    });
});
