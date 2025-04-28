// Módulo para gerenciamento de pedidos para retirar
const takeoutOrdersModule = (() => {
    // Cache de pedidos para retirar
    let takeoutOrders = {};

    // Função para verificar se um pedido é para retirar
    function isTakeoutOrder(order) {
        return order.orderType === 'TAKEOUT' || 
               (order.takeout && order.takeout.mode);
    }

    // Função para inicializar o módulo
    function initialize() {
        console.log('🔄 Inicializando módulo de pedidos para retirar...');

        // Estende as funções necessárias
        extendDisplayOrder();
        extendAddActionButtons();
        
        console.log('✅ Módulo de pedidos para retirar inicializado');
    }

    // Função para estender displayOrder
    function extendDisplayOrder() {
        const originalDisplayOrder = window.displayOrder;
        if (!originalDisplayOrder) {
            console.error('❌ Função displayOrder não encontrada');
            return;
        }

        window.displayOrder = function(order) {
            if (isTakeoutOrder(order)) {
                // Adiciona informações específicas de retirada
                enhanceOrderWithTakeoutInfo(order);
            }
            
            // Usa a função original para exibir
            return originalDisplayOrder(order);
        };
    }

// Função para estender addActionButtons
function extendAddActionButtons() {
    const originalAddActionButtons = window.addActionButtons;
    if (!originalAddActionButtons) {
        console.error('❌ Função addActionButtons não encontrada');
        return;
    }

    window.addActionButtons = function(container, order) {
        if (isTakeoutOrder(order)) {
            // Adiciona botões específicos para pedidos de retirada
            addTakeoutButtons(container, order);
            return;
        }
        
        // Usa a função original para outros tipos de pedido
        return originalAddActionButtons(container, order);
    };
    
    // Salva a referência para uso interno
    takeoutOrdersModule.originalAddActionButtons = originalAddActionButtons;
}

    // Função para adicionar informações de retirada ao pedido
    function enhanceOrderWithTakeoutInfo(order) {
        const pickupInfo = {
            mode: order.takeout?.mode || 'DEFAULT',
            pickupTime: order.takeout?.takeoutDateTime,
            retrieverName: order.takeout?.retrieverName,
            code: order.takeout?.code
        };

        order.enhancedTakeoutInfo = pickupInfo;
        takeoutOrders[order.id] = order;
    }

// Função para adicionar botões específicos para pedidos de retirada
function addTakeoutButtons(container, order) {
    // Limpa o container
    container.innerHTML = '';

    switch(order.status) {
        case 'PLACED':
            // Pedido novo - botões de confirmar e cancelar
            addButton(container, 'Confirmar', 'confirm', () => {
                handleOrderAction(order.id, 'confirm');
            });
            addButton(container, 'Cancelar', 'cancel', () => {
                handleOrderAction(order.id, 'requestCancellation');
            });
            break;

        case 'CONFIRMED':
        case 'IN_PREPARATION':
            // Pedido confirmado/em preparo - botões de pronto e cancelar
            addButton(container, 'Informar pedido pronto', 'ready', () => {
                handleReadyToPickup(order.id);
            });
            addButton(container, 'Cancelar', 'cancel', () => {
                handleOrderAction(order.id, 'requestCancellation');
            });
            break;

        case 'READY_TO_PICKUP':
            // Pedido pronto - mostrar mensagem e botão de cancelar
            addStatusMessage(container, 'Aguardando Retirada');
            addButton(container, 'Cancelar', 'cancel', () => {
                handleOrderAction(order.id, 'requestCancellation');
            });
            break;

        case 'CANCELLED':
            // Pedido cancelado - apenas mensagem
            addStatusMessage(container, 'Pedido Cancelado', 'disabled');
            break;

        case 'CONCLUDED':
            // Pedido concluído - apenas mensagem
            addStatusMessage(container, 'Pedido Concluído', 'disabled');
            break;

        default:
            // Status desconhecido - botões padrão via função original original (não a atual)
            takeoutOrdersModule.originalAddActionButtons(container, order);
    }
}

    // Função auxiliar para adicionar botão
    function addButton(container, label, className, onClick) {
        const button = document.createElement('button');
        button.className = `action-button ${className}`;
        button.textContent = label;
        button.onclick = onClick;
        container.appendChild(button);
    }

    // Função auxiliar para adicionar mensagem de status
    function addStatusMessage(container, message, className = '') {
        const statusDiv = document.createElement('div');
        statusDiv.className = `status-message ${className}`;
        statusDiv.textContent = message;
        container.appendChild(statusDiv);
    }

    // Função para marcar pedido como pronto para retirada
    async function handleReadyToPickup(orderId) {
        try {
            showLoading();
            
            // Envia requisição para API
            const response = await makeAuthorizedRequest(
                `/order/v1.0/orders/${orderId}/readyToPickup`,
                'POST'
            );

            console.log('✅ Pedido marcado como pronto para retirada:', response);
            
            // Atualiza status na interface
            updateOrderStatus(orderId, 'READY_TO_PICKUP');
            
            // Mostra notificação
            showToast('Pedido marcado como pronto para retirada!', 'success');
            
            hideLoading();
        } catch (error) {
            console.error('❌ Erro ao marcar pedido como pronto:', error);
            showToast(`Erro: ${error.message}`, 'error');
            hideLoading();
        }
    }

    // Retorna a API pública do módulo
    return {
        initialize,
        isTakeoutOrder
    };
})();

// Inicializa o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    takeoutOrdersModule.initialize();
});
