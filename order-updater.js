// Arquivo independente para garantir atualização de pedidos
console.log('🔄 Inicializando atualizador de pedidos automático');

// Função para atualizar todos os pedidos visíveis
async function refreshAllOrders() {
    try {
        console.log('🔄 Verificando atualizações para todos os pedidos');
        
        // Busca todos os pedidos na interface
        const orderCards = document.querySelectorAll('.order-card');
        console.log(`📋 Encontrados ${orderCards.length} pedidos para verificar`);
        
        if (orderCards.length === 0) return;
        
        // Verifica se temos um token de acesso
        if (!state || !state.accessToken) {
            console.log('❌ Sem token de acesso, não é possível verificar pedidos');
            return;
        }
        
        // Para cada pedido, busca seu status atual
        for (const card of orderCards) {
            const orderId = card.getAttribute('data-order-id');
            if (!orderId) continue;
            
            try {
                console.log(`🔍 Verificando status do pedido: ${orderId}`);
                const currentStatusElem = card.querySelector('.order-status');
                const currentStatus = currentStatusElem ? currentStatusElem.textContent.trim() : 'Desconhecido';
                
                // Busca informações atualizadas do pedido na API
                const updatedOrder = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
                
                if (updatedOrder && updatedOrder.status) {
                    const newStatusText = getStatusText(updatedOrder.status);
                    
                    console.log(`📊 Status: API=${updatedOrder.status}, UI=${currentStatus}, Texto=${newStatusText}`);
                    
                    // Se o status for diferente, atualiza na interface
                    if (currentStatus !== newStatusText) {
                        console.log(`🔄 Atualizando pedido ${orderId} de "${currentStatus}" para "${newStatusText}"`);
                        updateOrderStatus(orderId, updatedOrder.status);
                        
                        // Notifica o usuário
                        showToast(`Pedido #${orderId.slice(0, 6)} atualizado para ${newStatusText}`, 'info');
                    }
                }
            } catch (error) {
                console.error(`❌ Erro ao verificar pedido ${orderId}:`, error);
            }
            
            // Pequena pausa entre requisições para não sobrecarregar
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error('❌ Erro geral na atualização de pedidos:', error);
    }
}

// Iniciar após carregamento da página
window.addEventListener('load', function() {
    console.log('🚀 Configurando atualizador automático de pedidos');
    
    // Primeira atualização após 5 segundos
    setTimeout(() => {
        refreshAllOrders();
        
        // Configurar atualizações regulares a cada 20 segundos
        setInterval(refreshAllOrders, 20000);
    }, 5000);
});
