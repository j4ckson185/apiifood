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
    activeTab: 'preparation', // Tab atual (preparation, dispatched, completed, cancelled)
    activeFilter: 'all' // Filtro atual (all, cash, card, online)
};

// Variáveis globais para controle de cancelamento
let currentCancellationOrderId = null;
let cancellationReasons = [];

// Funções de utilidade
const showLoading = () => document.getElementById('loading-overlay').classList.remove('hidden');
const hideLoading = () => document.getElementById('loading-overlay').classList.add('hidden');

const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Adiciona ícone baseado no tipo
    let icon = '';
    switch(type) {
        case 'success': icon = '<i class="fas fa-check-circle"></i>'; break;
        case 'error': icon = '<i class="fas fa-exclamation-circle"></i>'; break;
        case 'warning': icon = '<i class="fas fa-exclamation-triangle"></i>'; break;
        default: icon = '<i class="fas fa-info-circle"></i>';
    }
    
    toast.innerHTML = `${icon} ${message}`;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

// Função para alternar entre tabs de seções principais
function switchMainTab(tabId) {
    // Oculta todas as seções
    document.querySelectorAll('.tab-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Exibe a seção selecionada
    document.getElementById(`${tabId}-section`).classList.remove('hidden');
    
    // Atualiza os itens da sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelector(`.sidebar-item[data-target="${tabId}"]`).classList.add('active');
}

// Função para alternar entre tabs de pedidos
function switchOrderTab(tabId) {
    // Oculta todos os conteúdos de tab
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Exibe o conteúdo da tab selecionada
    document.getElementById(`${tabId}-tab`).classList.add('active');
    
    // Atualiza a tab ativa
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelector(`.tab-item[data-tab="${tabId}"]`).classList.add('active');
    
    // Atualiza o estado
    state.activeTab = tabId;
    
    // Verifica se há pedidos na tab atual
    checkForEmptyTab(tabId);
}

// Função para aplicar filtros
function applyFilter(filter) {
    state.activeFilter = filter;
    
    // Atualiza os botões de filtro
    document.querySelectorAll('.filter-button').forEach(button => {
        button.classList.remove('active');
    });
    
    document.querySelector(`.filter-button[data-filter="${filter}"]`).classList.add('active');
    
    // Aplica o filtro aos pedidos visíveis
    const orderCards = document.querySelectorAll('.order-card');
    
    orderCards.forEach(card => {
        if (filter === 'all') {
            card.style.display = 'block';
        } else {
            // Lógica de filtro baseada no tipo de pagamento
            const paymentType = card.getAttribute('data-payment-type') || '';
            
            if (filter === 'cash' && paymentType.includes('dinheiro')) {
                card.style.display = 'block';
            } else if (filter === 'card' && paymentType.includes('cartão')) {
                card.style.display = 'block';
            } else if (filter === 'online' && paymentType.includes('online')) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
}

// Função para verificar se uma tab está vazia e mostrar mensagem apropriada
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

// Função de busca de pedidos
function searchOrders(query) {
    query = query.toLowerCase().trim();
    
    const orderCards = document.querySelectorAll('.order-card');
    
    orderCards.forEach(card => {
        const orderText = card.textContent.toLowerCase();
        const orderId = card.getAttribute('data-order-id') || '';
        const customerName = card.querySelector('.customer-name')?.textContent.toLowerCase() || '';
        
        if (query === '' || 
            orderText.includes(query) || 
            orderId.includes(query) || 
            customerName.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
    
    // Verifica status de tabs vazias
    checkForEmptyTab('preparation');
    checkForEmptyTab('dispatched');
    checkForEmptyTab('completed');
    checkForEmptyTab('cancelled');
}

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

// Rastreamento de pedidos já processados para evitar duplicações - usando localStorage para persistência
// Inicializa o conjunto de IDs processados a partir do localStorage (se existir)
const processedOrderIds = new Set(
    JSON.parse(localStorage.getItem('processedOrderIds') || '[]')
);

// Função auxiliar para salvar IDs processados no localStorage
function saveProcessedIds() {
    localStorage.setItem('processedOrderIds', JSON.stringify([...processedOrderIds]));
}

// Polling de eventos corrigido para receber pedidos novamente
async function pollEvents() {
    if (!state.isPolling || !state.accessToken) return;

    try {
        console.log('Iniciando polling...');
        const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET', null);
        
        if (events && Array.isArray(events) && events.length > 0) {
            console.log('Eventos recebidos:', events);
            
            // Processa todos os eventos, mas lida com eles de forma seletiva em handleEvent
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

// Manipulador de eventos corrigido para receber pedidos novamente
async function handleEvent(event) {
    try {
        console.log(`Processando evento: ${event.code} para pedido ${event.orderId}`);
        
        // Verifica se é um evento relacionado a pedido
        if (!event.orderId) {
            console.log('Evento sem orderId, ignorando:', event);
            return;
        }
        
        // Para eventos PLACED (novos pedidos) - processa normalmente para exibir novos pedidos
        if (event.code === 'PLACED' || event.code === 'PLC') {
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
                    console.log(`Pedido ${order.id} já está na interface, ignorando duplicação`);
                }
            } catch (orderError) {
                console.error(`Erro ao buscar detalhes do pedido ${event.orderId}:`, orderError);
            }
        } 
        // Processar eventos de CANCELAMENTO para manter a interface sincronizada
        else if (event.code === 'CANCELLED' || event.code === 'CANC' || 
                 event.code === 'CANCELLATION_REQUESTED' || event.code === 'CANR') {
            // Atualiza o status para cancelado
            updateOrderStatus(event.orderId, 'CANCELLED');
            console.log(`Pedido ${event.orderId} foi cancelado, atualizando interface`);
        }
        // Para os outros eventos de status, registramos mas NÃO atualizamos a interface
        // para evitar mudanças automáticas de status após confirmação
        else {
            console.log(`Recebido evento de status ${event.code} para pedido ${event.orderId} - ignorando atualização automática`);
        }
    } catch (error) {
        console.error('Erro ao processar evento:', error);
    }
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

// Exibe o pedido na interface com organização por categorias
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
    
    // Adiciona informações de pagamento e define o tipo para filtros
    let paymentType = 'desconhecido';
    
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
            
            // Define o tipo de pagamento para filtros
            if (payment.method && payment.method.toLowerCase().includes('dinheiro')) {
                paymentType = 'dinheiro';
            } else if (payment.method && payment.method.toLowerCase().includes('cartão')) {
                paymentType = 'cartão';
            } else if (payment.type && payment.type.toLowerCase().includes('online')) {
                paymentType = 'online';
            }
            
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
            li.textContent = `${item.quantity}x ${item.name} - R$ ${typeof itemPrice === 'number' ? itemPrice.toFixed(2) : '0.00'}`;
            
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
                    optionLi.textContent = `${option.quantity}x ${option.name} (+R$ ${(option.addition || option.price || 0).toFixed(2)})`;
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
                subTotal.innerHTML = `<span>Subtotal:</span> <span>R$ ${order.total.subTotal.toFixed(2)}</span>`;
                totalDetails.appendChild(subTotal);
            }
            
            if (order.total.deliveryFee) {
                const deliveryFee = document.createElement('p');
                deliveryFee.innerHTML = `<span>Taxa de entrega:</span> <span>R$ ${order.total.deliveryFee.toFixed(2)}</span>`;
                totalDetails.appendChild(deliveryFee);
            }
            
            if (order.total.benefits && order.total.benefits > 0) {
                const benefits = document.createElement('p');
                benefits.innerHTML = `<span>Descontos:</span> <span>-R$ ${order.total.benefits.toFixed(2)}</span>`;
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
    
    // Adiciona atributo de tipo de pagamento para filtros
    orderCard.setAttribute('data-payment-type', paymentType);
    
    // Adiciona classe baseada no status
    if (order.status) {
        orderCard.classList.add(`status-${order.status.toLowerCase()}`);
    }

    // Determina em qual tab o pedido deve ser exibido
    let targetContainer;
    const status = order.status || 'PLACED';
    
    if (status === 'CANCELLED' || status === 'CANC') {
        targetContainer = document.getElementById('cancelled-orders');
    } else if (status === 'CONCLUDED' || status === 'CONC') {
        targetContainer = document.getElementById('completed-orders');
    } else if (status === 'DISPATCHED' || status === 'DDCR') {
        targetContainer = document.getElementById('dispatched-orders');
    } else {
        // Todos os outros statuses (PLACED, CONFIRMED, IN_PREPARATION, etc)
        targetContainer = document.getElementById('preparation-orders');
    }

// Adiciona ao container apropriado
   if (targetContainer) {
       targetContainer.appendChild(orderElement);
       // Verifica se a mensagem de "sem pedidos" deve ser ocultada
       const tabId = targetContainer.id.replace('-orders', '');
       checkForEmptyTab(tabId);
   }
   
   console.log('Pedido exibido com sucesso:', order.id);
}

// Função modificada para atualizar o status apenas quando explicitamente solicitado
function updateOrderStatus(orderId, status) {
   console.log(`Atualizando status do pedido ${orderId} para ${status}`);

   // Busca o card do pedido pelo data-order-id exato
   const card = document.querySelector(`.order-card[data-order-id="${orderId}"]`);

   if (card) {
       // Atualiza o status
       const statusElement = card.querySelector('.order-status');
       if (statusElement) {
           statusElement.textContent = getStatusText(status);
       }

       // Atualiza as ações disponíveis
       const actionsContainer = card.querySelector('.order-actions');
       if (actionsContainer) {
           // Adiciona novas ações baseadas no status atualizado
           addActionButtons(actionsContainer, { id: orderId, status });
       }
       
       // Atualiza classes do card baseado no status
       // Primeiro remove todas as classes de status existentes
       const statusClasses = Array.from(card.classList)
           .filter(className => className.startsWith('status-'));
       
       statusClasses.forEach(className => {
           card.classList.remove(className);
       });
       
       // Adiciona a nova classe de status
       if (status) {
           card.classList.add(`status-${status.toLowerCase()}`);
       }
       
       // Move o card para a tab correta baseado no novo status
       moveCardToCorrectTab(card, status);
   } else {
       console.log(`Pedido ${orderId} não encontrado na interface. Buscando detalhes...`);
       makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET')
           .then(order => {
               displayOrder(order);
           })
           .catch(error => {
               console.error(`Erro ao buscar detalhes do pedido ${orderId}:`, error);
           });
   }
}

// Função para mover o card para a tab correta após atualização de status
function moveCardToCorrectTab(card, status) {
   let targetContainerId;
   
   if (status === 'CANCELLED' || status === 'CANC') {
       targetContainerId = 'cancelled-orders';
   } else if (status === 'CONCLUDED' || status === 'CONC') {
       targetContainerId = 'completed-orders';
   } else if (status === 'DISPATCHED' || status === 'DDCR') {
       targetContainerId = 'dispatched-orders';
   } else {
       // Todos os outros statuses (PLACED, CONFIRMED, IN_PREPARATION, etc)
       targetContainerId = 'preparation-orders';
   }
   
   const targetContainer = document.getElementById(targetContainerId);
   const currentParent = card.parentElement;
   
   if (targetContainer && currentParent && currentParent.id !== targetContainerId) {
       // Move o card para o container correto
       targetContainer.appendChild(card);
       
       // Verifica se as tabs antigas e novas devem mostrar a mensagem "sem pedidos"
       const oldTabId = currentParent.id.replace('-orders', '');
       const newTabId = targetContainerId.replace('-orders', '');
       
       checkForEmptyTab(oldTabId);
       checkForEmptyTab(newTabId);
       
       // Mostra um toast informando sobre a mudança
       const statusText = getStatusText(status);
       showToast(`Pedido movido para "${statusText}"`, 'info');
   }
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
           { label: 'Despachar', action: 'dispatch', class: 'dispatch' },
           { label: 'Cancelar', action: 'requestCancellation', class: 'cancel' }
       ],
       'IN_PREPARATION': [
           { label: 'Despachar', action: 'dispatch', class: 'dispatch' },
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
   
   // Mapeamento de códigos de status para status normalizados
   const statusMap = {
       'PLC': 'PLACED',
       'CFM': 'CONFIRMED',
       'PREP': 'IN_PREPARATION',
       'PRS': 'IN_PREPARATION', // Adicional para lidar com 'PRS'
       'RTP': 'READY_TO_PICKUP',
       'DDCR': 'DISPATCHED',
       'CONC': 'CONCLUDED',
       'CANC': 'CANCELLED',
       'CANR': 'CANCELLATION_REQUESTED'
   };

   const normalizedStatus = statusMap[orderStatus] || orderStatus;
   
   // Usar o status normalizado para buscar as ações
   let orderActions = actions[normalizedStatus] || [];
   
   if (orderActions.length === 0) {
       if (orderStatus && typeof orderStatus === 'string') {
           // Tenta encontrar ações para status similares
           const statusLower = orderStatus.toLowerCase();
           
           if (statusLower.includes('placed') || statusLower.includes('new')) {
               orderActions = actions['PLACED'];
           } else if (statusLower.includes('confirm') || statusLower.includes('cfm')) {
               orderActions = actions['CONFIRMED'];
           } else if (statusLower.includes('prepar') || statusLower.includes('prs')) {
               orderActions = actions['IN_PREPARATION'];
           } else if (statusLower.includes('ready') || statusLower.includes('pickup')) {
               orderActions = actions['READY_TO_PICKUP'];
           } else if (statusLower.includes('dispatch') || statusLower.includes('ddcr')) {
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
async function fetchActiveOrders() {
   try {
       console.log('Buscando pedidos ativos via eventos...');
       showToast('Buscando pedidos ativos...', 'info');
       
       // Precisamos declarar esta variável, estava sendo usada sem declaração
       const successfulOrders = [];
       
       // Limpa os containers de pedidos
       clearOrdersContainers();
       
       // Buscar eventos recentes
       const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET');
       
       if (events && Array.isArray(events) && events.length > 0) {
           console.log('Eventos recebidos:', events);
           
           // Filtra eventos relacionados a pedidos - aceitamos todos os tipos de eventos
           const orderEvents = events.filter(event => event.orderId);
           
           if (orderEvents.length > 0) {
               // Conjunto para rastrear pedidos já processados nesta busca
               const processedInThisFetch = new Set();
               
               for (const event of orderEvents) {
                   // Evita processar o mesmo pedido múltiplas vezes nesta busca
                   if (!processedInThisFetch.has(event.orderId)) {
                       processedInThisFetch.add(event.orderId);
                       
                       try {
                           console.log(`Buscando detalhes do pedido ${event.orderId}`);
                           const orderDetails = await makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`, 'GET');
                           console.log(`Detalhes recebidos para pedido ${event.orderId}:`, orderDetails);
                           
                           // Verifica se o pedido já existe na interface
                           const existingOrder = document.querySelector(`.order-card[data-order-id="${orderDetails.id}"]`);
                           if (!existingOrder) {
                               displayOrder(orderDetails);
                               successfulOrders.push(orderDetails);
                               
                               // Adiciona aos pedidos processados para evitar processamento futuro
                               if (!processedOrderIds.has(event.orderId)) {
                                   processedOrderIds.add(event.orderId);
                                   saveProcessedIds();
                               }
                           } else {
                               console.log(`Pedido ${orderDetails.id} já está na interface, ignorando`);
                           }
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
       
       // Verifica se há pedidos em cada tab
       checkForEmptyTab('preparation');
       checkForEmptyTab('dispatched');
       checkForEmptyTab('completed');
       checkForEmptyTab('cancelled');
       
   } catch (error) {
       console.error('Erro ao buscar pedidos ativos:', error);
       showToast('Erro ao buscar pedidos', 'error');
   }
}

// Função para limpar os containers de pedidos
function clearOrdersContainers() {
   const containers = [
       'preparation-orders',
       'dispatched-orders',
       'completed-orders',
       'cancelled-orders'
   ];
   
   containers.forEach(containerId => {
       const container = document.getElementById(containerId);
       if (container) {
           while (container.firstChild) {
               container.removeChild(container.firstChild);
           }
       }
   });
}

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
           showLoading();
           try {
               cancellationReasons = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}/cancellationReasons`, 'GET');
               console.log('Motivos de cancelamento disponíveis:', cancellationReasons);
               
               if (cancellationReasons && cancellationReasons.length > 0) {
                   // Atualiza a variável global
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
                   
                   hideLoading();
                   
                   // Exibe o modal com um pequeno atraso para garantir que tudo esteja pronto
                   setTimeout(() => {
                       const modal = document.getElementById('cancellation-modal');
                       if (modal) modal.classList.remove('hidden');
                   }, 100);
               } else {
                   hideLoading();
                   showToast('Não foi possível obter os motivos de cancelamento', 'error');
               }
           } catch (cancelError) {
               hideLoading();
               console.error('Erro ao obter motivos de cancelamento:', cancelError);
               showToast('Erro ao obter motivos de cancelamento', 'error');
           }
       } else {
           // Todas as outras ações normais
           showLoading();
           const response = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}${endpoint}`, 'POST');
           console.log(`Resposta da ação ${action}:`, response);

           // Atualizar o status manualmente na interface de acordo com a ação executada
           let newStatus;
           switch(action) {
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
               default:
                   // Para outros casos, buscamos o status atual
                   const updatedOrder = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
                   newStatus = updatedOrder.status;
           }

           // Atualiza a UI com o novo status
           updateOrderStatus(orderId, newStatus);

           if (!processedOrderIds.has(orderId)) {
               processedOrderIds.add(orderId);
               saveProcessedIds();
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

// Função melhorada para fechar o modal de cancelamento
function closeCancellationModal() {
   console.log('Fechando modal de cancelamento');
   const modal = document.getElementById('cancellation-modal');
   if (modal) {
       modal.classList.add('hidden');
       currentCancellationOrderId = null;
   }
}

// Função modificada para confirmar cancelamento
function confirmCancellation() {
   console.log('Confirmando cancelamento...');
   const modal = document.getElementById('cancellation-modal');
   
   if (!currentCancellationOrderId) {
       showToast('Erro: ID do pedido não encontrado', 'error');
       if (modal) modal.classList.add('hidden');
       return;
   }
   
   const select = document.getElementById('cancellation-reason');
   const selectedReasonId = select.value;
   
   if (!selectedReasonId) {
       showToast('Selecione um motivo para cancelar', 'warning');
       return;
   }
   
   // Oculta o modal antes de continuar
   if (modal) modal.classList.add('hidden');
   
   // Encontra a descrição do motivo selecionado
   const selectedReason = cancellationReasons.find(r => r.cancelCodeId === selectedReasonId);
   
   if (!selectedReason) {
       showToast('Motivo inválido', 'error');
       currentCancellationOrderId = null;
       return;
   }
   
   // Continua com o processo de cancelamento...
   processCancellation(currentCancellationOrderId, selectedReason);
}

// Nova função para processar o cancelamento após confirmação
async function processCancellation(orderId, reason) {
   try {
       showLoading();
       
       // Envia a requisição de cancelamento com o motivo
       const response = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}/requestCancellation`, 'POST', {
           cancellationCode: reason.cancelCodeId,
           reason: reason.description
       });
       
       console.log('Resposta do cancelamento:', response);
       
       // Atualiza o status do pedido na interface
       updateOrderStatus(orderId, 'CANCELLED');
       
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

// Converte status para texto amigável
function getStatusText(status) {
   const statusMap = {
       'PLACED': 'Novo',
       'CONFIRMED': 'Confirmado',
       'IN_PREPARATION': 'Em Preparação',
       'READY_TO_PICKUP': 'Pronto para Retirada',
       'DISPATCHED': 'A Caminho',
       'CONCLUDED': 'Concluído',
       'CANCELLED': 'Cancelado',
       'PLC': 'Novo',
       'CFM': 'Confirmado',
       'PREP': 'Em Preparação',
       'PRS': 'Em Preparação',
       'RTP': 'Pronto para Retirada',
       'DDCR': 'A Caminho',
       'CONC': 'Concluído',
       'CANC': 'Cancelado',
       'CANR': 'Cancelamento Solicitado'
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
   // Garantir que o modal de cancelamento esteja HIDDEN inicialmente
   const cancelModal = document.getElementById('cancellation-modal');
   if (cancelModal) {
       cancelModal.classList.add('hidden');
       console.log("Modal escondido na inicialização");
   }
   
   // Remover e readicionar todos os event listeners para garantir funcionamento correto
   
   // Corrigir os listeners do modal de cancelamento
   const confirmButton = document.getElementById('confirm-cancellation');
   if (confirmButton) {
       const newConfirmButton = confirmButton.cloneNode(true);
       confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
       
       newConfirmButton.addEventListener('click', function() {
           console.log("Botão confirmar cancelamento clicado");
           confirmCancellation();
       });
   }
   
   const cancelButton = document.getElementById('cancel-cancellation');
   if (cancelButton) {
       const newCancelButton = cancelButton.cloneNode(true);
       cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
       
       newCancelButton.addEventListener('click', function() {
           console.log("Botão cancelar cancelamento clicado");
           closeCancellationModal();
       });
   }
   
   const closeModalX = document.querySelector('.close-modal');
   if (closeModalX) {
       const newCloseModalX = closeModalX.cloneNode(true);
       closeModalX.parentNode.replaceChild(newCloseModalX, closeModalX);
       
       newCloseModalX.addEventListener('click', function() {
           console.log("Botão X para fechar o modal clicado");
           closeCancellationModal();
       });
   }
   
   // Adicionar evento para fechar o modal ao clicar no fundo
   if (cancelModal) {
       cancelModal.addEventListener('click', function(event) {
           if (event.target === cancelModal) {
               console.log("Clique fora do modal detectado, fechando modal");
               closeCancellationModal();
           }
       });
   }
       
       // Readicionar os listeners para os botões dentro do novo modal
       const newConfirmBtn = newModal.querySelector('#confirm-cancellation');
       if (newConfirmBtn) {
           newConfirmBtn.addEventListener('click', function() {
               console.log("Botão confirmar cancelamento clicado (novo modal)");
               confirmCancellation();
           });
       }
       
       const newCancelBtn = newModal.querySelector('#cancel-cancellation');
       if (newCancelBtn) {
           newCancelBtn.addEventListener('click', function() {
               console.log("Botão cancelar cancelamento clicado (novo modal)");
               closeCancellationModal();
           });
       }
       
       const newCloseX = newModal.querySelector('.close-modal');
       if (newCloseX) {
           newCloseX.addEventListener('click', function() {
               console.log("Botão X para fechar o modal clicado (novo modal)");
               closeCancellationModal();
           });
       }
   }

   // Eventos para navegação entre seções principais
   document.querySelectorAll('.sidebar-item').forEach(item => {
       item.addEventListener('click', () => {
           const targetSection = item.getAttribute('data-target');
           if (targetSection) {
               switchMainTab(targetSection);
           }
       });
   });
   
   // Eventos para navegação entre tabs de pedidos
   document.querySelectorAll('.tab-item').forEach(tab => {
       tab.addEventListener('click', () => {
           const targetTab = tab.getAttribute('data-tab');
           if (targetTab) {
               switchOrderTab(targetTab);
           }
       });
   });
   
   // Eventos para filtros
   document.querySelectorAll('.filter-button').forEach(button => {
       button.addEventListener('click', () => {
           const filter = button.getAttribute('data-filter');
           if (filter) {
               applyFilter(filter);
           }
       });
   });
   
   // Evento para busca
   const searchInput = document.getElementById('search-orders');
   if (searchInput) {
       searchInput.addEventListener('input', () => {
           searchOrders(searchInput.value);
       });
   }

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
       // Garantir que o modal de cancelamento esteja oculto antes de qualquer operação
       const cancelModal = document.getElementById('cancellation-modal');
       if (cancelModal) {
           cancelModal.classList.add('hidden');
           console.log("Modal escondido na inicialização da função initialize");
       }
       
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
