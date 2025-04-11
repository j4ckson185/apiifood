// ifood-status-sync.js - Nova versão simplificada e robusta
console.log('📡 Inicializando sincronizador de status iFood');

// Função para processar eventos do iFood
async function processIfoodEvents() {
    try {
        if (!state || !state.accessToken) {
            console.log('❌ Token não disponível, sincronização pulada');
            return;
        }

        console.log('🔍 Buscando eventos do iFood...');
        const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET');
        
        if (!events || !Array.isArray(events) || events.length === 0) {
            console.log('ℹ️ Nenhum evento encontrado neste ciclo');
            return;
        }
        
        console.log(`✅ ${events.length} eventos encontrados`, events);
        
        // Processar cada evento
        for (const event of events) {
            if (!event.orderId) continue;
            
            console.log(`📝 Processando evento: ${event.code} para pedido ${event.orderId}`);
            
            // Buscar o status atual do pedido na API
            try {
                const order = await makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`, 'GET');
                console.log(`📦 Pedido recebido:`, order);
                
                if (order && order.id) {
                    // Verifica se o pedido existe na interface
                    const orderCard = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
                    
                    if (orderCard) {
                        // Se o pedido já existe na interface, atualiza o status
                        if (order.status) {
                            console.log(`🔄 Atualizando status: ${order.status}`);
                            updateOrderStatus(order.id, order.status);
                        } else {
                            console.log('⚠️ Pedido sem status definido');
                        }
                    } else {
                        // Pedido não existe na interface, adiciona
                        console.log('➕ Adicionando novo pedido à interface');
                        displayOrder(order);
                    }
                }
            } catch (orderError) {
                console.error(`❌ Erro ao buscar pedido ${event.orderId}:`, orderError);
            }
        }
        
        // Enviar acknowledgment para todos os eventos
        try {
            const acknowledgmentFormat = events.map(event => ({ id: event.id }));
            await makeAuthorizedRequest('/events/v1.0/events/acknowledgment', 'POST', acknowledgmentFormat);
            console.log('✅ Acknowledgment enviado para todos os eventos');
        } catch (ackError) {
            console.error('❌ Erro ao enviar acknowledgment:', ackError);
        }
    } catch (error) {
        console.error('❌ Erro geral ao processar eventos:', error);
    }
}

// Função para buscar e atualizar pedidos existentes
async function updateExistingOrders() {
    console.log('🔄 Atualizando pedidos existentes...');
    const orderCards = document.querySelectorAll('.order-card');
    
    for (const card of orderCards) {
        const orderId = card.getAttribute('data-order-id');
        if (!orderId) continue;
        
        try {
            const order = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
            
            if (order && order.id && order.status) {
                // Verifica se o status atual é diferente
                const statusElem = card.querySelector('.order-status');
                const currentText = statusElem ? statusElem.textContent.trim() : '';
                const newText = getStatusText(order.status);
                
                if (currentText !== newText) {
                    console.log(`🔄 Atualizando pedido ${orderId} de "${currentText}" para "${newText}"`);
                    updateOrderStatus(orderId, order.status);
                }
            }
        } catch (error) {
            console.log(`⚠️ Não foi possível atualizar pedido ${orderId}:`, error);
        }
        
        // Pequena pausa entre requisições
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

// Iniciar o sincronizador
(function startSyncronizer() {
    // Primeira execução após 5 segundos
    setTimeout(() => {
        // Processar eventos a cada 15 segundos
        setInterval(processIfoodEvents, 15000);
        
        // Atualizar pedidos existentes a cada 60 segundos
        setInterval(updateExistingOrders, 60000);
        
        // Executa imediatamente na inicialização
        processIfoodEvents();
    }, 5000);
})();
