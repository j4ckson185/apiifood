// Módulo para gerenciamento de pedidos agendados
const scheduledOrdersModule = (() => {
    // Cache de pedidos agendados
    let scheduledOrders = {};

    // Função para verificar se um pedido é agendado
    function isScheduledOrder(order) {
        return order.orderTiming === 'SCHEDULED' && 
               order.scheduled && 
               order.scheduled.deliveryDateTimeStart;
    }

    // Função para inicializar o módulo
    function initialize() {
        console.log('🔄 Inicializando módulo de pedidos agendados...');

        // Adiciona a nova aba de pedidos agendados
        addScheduledTab();
        
        // Estende a função displayOrder original
        extendDisplayOrder();
        
        console.log('✅ Módulo de pedidos agendados inicializado');
    }

    // Função para adicionar a aba de pedidos agendados
    function addScheduledTab() {
        // Adiciona o botão da tab
        const tabNavigation = document.querySelector('.tab-navigation');
        if (tabNavigation) {
            const scheduledTab = document.createElement('div');
            scheduledTab.className = 'tab-item';
            scheduledTab.setAttribute('data-tab', 'scheduled');
            scheduledTab.textContent = 'Agendados';
            tabNavigation.appendChild(scheduledTab);

            // Adiciona evento de clique
            scheduledTab.addEventListener('click', () => {
                switchOrderTab('scheduled');
            });
        }

        // Adiciona a seção de conteúdo
        const ordersSection = document.getElementById('orders-section');
        if (ordersSection) {
            const scheduledContent = document.createElement('div');
            scheduledContent.id = 'scheduled-tab';
            scheduledContent.className = 'tab-content';
            scheduledContent.innerHTML = `
                <div class="orders-grid" id="scheduled-orders"></div>
                <div class="no-orders scheduled-empty hidden">
                    <i class="fas fa-calendar-alt"></i>
                    <h3>Sem pedidos agendados</h3>
                    <p>Pedidos agendados aparecerão aqui</p>
                </div>
            `;
            ordersSection.appendChild(scheduledContent);
        }
    }

    // Função para estender displayOrder
    function extendDisplayOrder() {
        const originalDisplayOrder = window.displayOrder;
        if (!originalDisplayOrder) {
            console.error('❌ Função displayOrder não encontrada');
            return;
        }

        window.displayOrder = function(order) {
            if (isScheduledOrder(order)) {
                // Calcula o horário de início do preparo
                const startPrep = new Date(order.scheduled.deliveryDateTimeStart);
                startPrep.setMinutes(startPrep.getMinutes() - order.deliveryTime);
                
                // Verifica se já está na hora de exibir na aba de preparo
                const now = new Date();
                
                if (now >= startPrep) {
                    // Exibe na aba de preparo normalmente
                    return originalDisplayOrder(order);
                } else {
                    // Exibe na aba de agendados
                    displayScheduledOrder(order);
                    return true;
                }
            }
            
            // Para pedidos não agendados, usa a função original
            return originalDisplayOrder(order);
        };
    }

    // Função para exibir pedido agendado
    function displayScheduledOrder(order) {
        const container = document.getElementById('scheduled-orders');
        if (!container) return;

        // Cria o card do pedido
        const card = createScheduledOrderCard(order);
        
        // Adiciona ao container
        container.appendChild(card);
        
        // Adiciona ao cache
        scheduledOrders[order.id] = order;
        
        // Verifica se a mensagem de vazio deve ser mostrada
        checkForEmptyTab('scheduled');
        
        // Configura o timer para mover para aba de preparo
        setupScheduledOrderTimer(order);
    }

    // Função para criar o card de pedido agendado
    function createScheduledOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'order-card scheduled-order';
        card.setAttribute('data-order-id', order.id);

        // Formata as datas
        const deliveryStart = new Date(order.scheduled.deliveryDateTimeStart);
        const prepStart = new Date(deliveryStart);
        prepStart.setMinutes(prepStart.getMinutes() - order.deliveryTime);

        card.innerHTML = `
            <div class="order-header">
                <span class="order-number">#${order.displayId || order.id.substring(0, 6)}</span>
                <span class="order-status scheduled">Agendado</span>
            </div>
            <div class="order-content">
                <div class="scheduled-time">
                    <h3>Horário Agendado</h3>
                    <p><i class="fas fa-clock"></i> ${deliveryStart.toLocaleTimeString()}</p>
                    <p><i class="fas fa-calendar-alt"></i> ${deliveryStart.toLocaleDateString()}</p>
                </div>
                <div class="scheduled-prep">
                    <h3>Início do Preparo</h3>
                    <p><i class="fas fa-utensils"></i> ${prepStart.toLocaleTimeString()}</p>
                </div>
                <div class="customer-info">
                    <h3>Cliente</h3>
                    <p class="customer-name">Cliente: ${order.customer?.name || 'N/A'}</p>
                    <p class="customer-phone">Tel: ${order.customer?.phone || 'N/A'}</p>
                </div>
                <div class="order-items">
                    <h3>Itens do Pedido</h3>
                    <ul class="items-list">
                        ${order.items?.map(item => `
                            <li>${item.quantity}x ${item.name}</li>
                        `).join('') || '<li>Nenhum item encontrado</li>'}
                    </ul>
                </div>
                <div class="order-total">
                    <h3>Total</h3>
                    <p class="total-amount">R$ ${order.total?.toFixed(2) || '0.00'}</p>
                </div>
            </div>
        `;

        return card;
    }

    // Função para configurar timer do pedido agendado
    function setupScheduledOrderTimer(order) {
        const prepStart = new Date(order.scheduled.deliveryDateTimeStart);
        prepStart.setMinutes(prepStart.getMinutes() - order.deliveryTime);
        
        const now = new Date();
        const timeUntilPrep = prepStart.getTime() - now.getTime();
        
        if (timeUntilPrep > 0) {
            setTimeout(() => {
                moveToPreparation(order);
            }, timeUntilPrep);
        }
    }

    // Função para mover pedido para aba de preparo
    function moveToPreparation(order) {
        // Remove da aba de agendados
        const scheduledCard = document.querySelector(`#scheduled-orders .order-card[data-order-id="${order.id}"]`);
        if (scheduledCard) {
            scheduledCard.remove();
        }
        
        // Remove do cache de agendados
        delete scheduledOrders[order.id];
        
        // Exibe na aba de preparo usando a função original
        window.displayOrder(order);
        
        // Mostra notificação
        showToast(`Pedido #${order.displayId || order.id.substring(0, 6)} pronto para preparo!`, 'info');
        
        // Verifica se a aba de agendados ficou vazia
        checkForEmptyTab('scheduled');
    }

    // Retorna a API pública do módulo
    return {
        initialize,
        isScheduledOrder
    };
})();

// Inicializa o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    scheduledOrdersModule.initialize();
});
