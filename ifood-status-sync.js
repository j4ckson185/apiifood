// Sincronizador de status com a API do iFood
console.log('📡 Inicializando sincronizador de status com iFood');

// Função para buscar o status real de um pedido
async function getOrderRealStatus(orderId) {
    try {
        console.log(`🔍 Buscando status real do pedido: ${orderId}`);
        
        // Garante que temos um token válido
        if (!state || !state.accessToken) {
            console.log('❌ Token de acesso não disponível');
            return null;
        }
        
        // Faz requisição para a API
        const order = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
        
        // Log detalhado da resposta para debug
        console.log('📦 Resposta completa do pedido:', order);
        
        // Extrai status da resposta
        let realStatus = null;
        
        if (order) {
            // Tenta obter o status de diferentes locais na resposta
            if (order.status) {
                realStatus = order.status;
                console.log(`✅ Status encontrado diretamente: ${realStatus}`);
            } 
            else if (order.orderTiming && order.orderTiming.status) {
                realStatus = order.orderTiming.status;
                console.log(`✅ Status encontrado em orderTiming: ${realStatus}`);
            }
            else if (order.events && order.events.length > 0) {
                // Pega o status do evento mais recente
                const lastEvent = order.events[order.events.length - 1];
                if (lastEvent.code) {
                    // Mapeia códigos de evento para status
                    const eventMap = {
                        'PLC': 'PLACED',
                        'CFM': 'CONFIRMED',
                        'PREP': 'IN_PREPARATION',
                        'RTP': 'READY_TO_PICKUP',
                        'DDCR': 'DISPATCHED',
                        'CONC': 'CONCLUDED',
                        'CANC': 'CANCELLED',
                        'CAN': 'CANCELLED',
                        'CAR': 'CANCELLATION_REQUESTED'
                    };
                    
                    realStatus = eventMap[lastEvent.code] || lastEvent.code;
                    console.log(`✅ Status obtido do último evento: ${realStatus}`);
                }
            }
        }
        
        return realStatus;
    } catch (error) {
        console.error(`❌ Erro ao buscar status do pedido ${orderId}:`, error);
        return null;
    }
}

// Função para sincronizar todos os pedidos
async function syncAllOrdersStatus() {
    try {
        const orderCards = document.querySelectorAll('.order-card');
        console.log(`🔄 Sincronizando ${orderCards.length} pedidos...`);
        
        for (const card of orderCards) {
            const orderId = card.getAttribute('data-order-id');
            if (!orderId) continue;
            
            // Obtém status atual na interface
            const statusElem = card.querySelector('.order-status');
            const currentStatus = statusElem ? statusElem.textContent.trim() : 'Desconhecido';
            
            // Busca status real na API
            const realStatus = await getOrderRealStatus(orderId);
            
            if (realStatus) {
                // Converte para texto amigável
                const realStatusText = getStatusText(realStatus);
                
                console.log(`📊 Pedido ${orderId}: UI=${currentStatus}, API=${realStatusText}`);
                
                // Se diferente, atualiza
                if (currentStatus !== realStatusText) {
                    console.log(`🔄 Atualizando pedido ${orderId} para ${realStatus}`);
                    updateOrderStatus(orderId, realStatus);
                    showToast(`Status do pedido atualizado: ${realStatusText}`, 'info');
                }
            }
            
            // Pequena pausa para não sobrecarregar
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        console.error('❌ Erro ao sincronizar pedidos:', error);
    }
}

// Configura sincronização periódica
window.addEventListener('load', function() {
    // Primeira sincronização após 5 segundos
    setTimeout(() => {
        syncAllOrdersStatus();
        
        // Configura sincronização a cada 20 segundos
        setInterval(syncAllOrdersStatus, 20000);
    }, 5000);
});
