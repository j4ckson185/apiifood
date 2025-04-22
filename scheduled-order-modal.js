// Módulo unificado para gerenciamento de pedidos agendados
const scheduledOrdersModule = (() => {
    // Cache de pedidos agendados
    let scheduledOrders = {};

    // Função para inicializar o módulo
    function initialize() {
        console.log('🔄 Inicializando módulo de pedidos agendados...');

        // Adiciona a nova aba
        addScheduledTab();
        
        // Estende a função de displayOrder
        extendDisplayOrder();
        
        // Adiciona estilos customizados
        addCustomStyles();
        
        console.log('✅ Módulo de pedidos agendados inicializado');
    }

    // Função para verificar se um pedido é agendado
    function isScheduledOrder(order) {
        return order?.orderTiming === 'SCHEDULED';
    }

    // Função para calcular o horário de início do preparo
    function calculatePrepTime(order) {
        if (!order.preparationStartDateTime && !order.scheduledDateTimeForDelivery) return null;
        
        // Usa preparationStartDateTime se disponível
        if (order.preparationStartDateTime) {
            return new Date(order.preparationStartDateTime);
        }

        // Senão, calcula baseado no scheduledDateTimeForDelivery
        const deliveryTime = new Date(order.scheduledDateTimeForDelivery);
        const prepTime = new Date(deliveryTime);
        prepTime.setMinutes(prepTime.getMinutes() - (order.deliveryTime || 40));
        return prepTime;
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
                const prepTime = calculatePrepTime(order);
                const now = new Date();
                
                // Se ainda não está na hora de preparar, exibe na aba de agendados
                if (prepTime && now < prepTime) {
                    displayScheduledOrder(order);
                    return true;
                }
            }
            
            // Para pedidos não agendados ou já na hora de preparar, usa função original
            return originalDisplayOrder(order);
        };

        // Modifica o template do pedido para incluir badge de agendado
        const originalTemplate = document.getElementById('order-modal-template');
        if (originalTemplate) {
            const orderHeader = originalTemplate.content.querySelector('.order-header');
            if (orderHeader) {
                orderHeader.innerHTML = `
                    <span class="order-number"></span>
                    <div class="order-badges">
                        <span class="scheduled-badge" style="display: none;">
                            <i class="fas fa-calendar-alt"></i> AGENDADO
                        </span>
                        <span class="order-status"></span>
                    </div>
                `;
            }
        }

        // Estende a função addActionButtons
        const originalAddActionButtons = window.addActionButtons;
        window.addActionButtons = function(container, order) {
            if (isScheduledOrder(order)) {
                // Limpa o container
                container.innerHTML = '';
                
                // Para pedidos agendados, mostra apenas status e botão de cancelar
                const statusDiv = document.createElement('div');
                statusDiv.className = 'status-message scheduled';
                statusDiv.textContent = 'Pedido Agendado';
                container.appendChild(statusDiv);

                const cancelButton = document.createElement('button');
                cancelButton.className = 'action-button cancel';
                cancelButton.textContent = 'Cancelar';
                cancelButton.onclick = () => handleOrderAction(order.id, 'requestCancellation');
                container.appendChild(cancelButton);
            } else {
                // Para outros pedidos, usa função original
                originalAddActionButtons(container, order);
            }
        };
    }

    // Função para exibir pedido na aba de agendados
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

        const prepStart = calculatePrepTime(order);

        card.innerHTML = `
            <div class="order-header">
                <span class="order-number">#${order.displayId || order.id.substring(0, 6)}</span>
                <div class="order-badges">
                    <span class="scheduled-badge">
                        <i class="fas fa-calendar-alt"></i> AGENDADO
                    </span>
                    <span class="order-status scheduled">Agendado</span>
                </div>
            </div>
            <div class="order-content">
                <div class="scheduled-time">
                    <h3>Horário Agendado</h3>
                    <p><i class="fas fa-clock"></i> ${prepStart ? prepStart.toLocaleTimeString() : 'Horário não definido'}</p>
                    <p><i class="fas fa-calendar-alt"></i> ${prepStart ? prepStart.toLocaleDateString() : 'Data não definida'}</p>
                </div>
                <div class="scheduled-prep">
                    <h3>Início do Preparo</h3>
                    <p><i class="fas fa-utensils"></i> ${prepStart ? prepStart.toLocaleString('pt-BR') : 'Não especificado'}</p>
                </div>
                <div class="customer-info">
                    <h3>Cliente</h3>
                    <p class="customer-name">Cliente: ${order.customer?.name || 'N/A'}</p>
                    <p class="customer-phone">Tel: ${order.customer?.phone || 'N/A'}</p>
                </div>
                <div class="order-total">
                    <h3>Total</h3>
                    <p class="total-amount">
                        R$ ${typeof order.total === 'number' ? 
                            order.total.toFixed(2) : 
                            (order.total?.orderAmount?.toFixed(2) || '0.00')}
                    </p>
                </div>
                <button class="ver-pedido">Ver Detalhes</button>
            </div>
        `;

        // Adiciona evento para abrir o modal
        card.addEventListener('click', function() {
            abrirModalPedido(card, order.id, order.displayId || order.id.substring(0, 6), '', null);
        });

        return card;
    }

    // Função para configurar timer do pedido agendado
    function setupScheduledOrderTimer(order) {
        const prepStart = calculatePrepTime(order);
        if (!prepStart) return;
        
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

    // Função para adicionar estilos customizados
    function addCustomStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .scheduled-badge {
                background-color: #9c27b0;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.8rem;
                display: inline-flex;
                align-items: center;
                gap: 5px;
            }

            .order-badges {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .status-message.scheduled {
                background-color: #f3e5f5;
                color: #9c27b0;
                font-weight: bold;
                padding: 8px;
                border-radius: 4px;
                margin-bottom: 10px;
                text-align: center;
            }

            /* Estilos para a aba de agendados */
            .tab-item[data-tab="scheduled"] {
                color: #9c27b0;
            }

            .tab-item[data-tab="scheduled"].active::after {
                background-color: #9c27b0;
            }

            /* Estilos para cards de pedidos agendados */
            .scheduled-order {
                border-left: 4px solid #9c27b0 !important;
            }

            .scheduled-order .order-status.scheduled {
                background-color: #9c27b0;
                color: white;
            }

            .scheduled-time, .scheduled-prep {
                background-color: #f3e5f5;
                padding: 1rem;
                border-radius: var(--border-radius);
                margin-bottom: 1rem;
            }

            .scheduled-time h3, .scheduled-prep h3 {
                color: #9c27b0;
                font-size: 0.9rem;
                margin-bottom: 0.5rem;
            }

            .scheduled-time p, .scheduled-prep p {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin: 0.3rem 0;
            }

            .scheduled-time i, .scheduled-prep i {
                color: #9c27b0;
            }
        `;
        
        document.head.appendChild(style);
    }

    // Retorna API pública
    return {
        initialize,
        isScheduledOrder
    };
})();

// Inicializa o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    scheduledOrdersModule.initialize();
});
