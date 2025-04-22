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
        
        // Estende a função de modal
        extendModalFunction();
        
        // Adiciona estilos customizados
        addCustomStyles();
        
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

    // Função para verificar se um pedido é agendado
    function isScheduledOrder(order) {
        return order.orderTiming === 'SCHEDULED' && order.scheduled;
    }

    // Função para calcular o horário de início do preparo
    function calculatePrepTime(order) {
        if (!order.scheduled?.deliveryDateTimeStart) return null;
        
        const deliveryTime = new Date(order.scheduled.deliveryDateTimeStart);
        const prepTime = new Date(deliveryTime);
        prepTime.setMinutes(prepTime.getMinutes() - (order.deliveryTime || 40)); // 40 min default
        
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

        const deliveryStart = new Date(order.scheduled.deliveryDateTimeStart);
        const prepStart = calculatePrepTime(order);

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
                <div class="order-total">
                    <h3>Total</h3>
                    <p class="total-amount">R$ ${order.total?.toFixed(2) || '0.00'}</p>
                </div>
                <button class="ver-pedido">Ver Detalhes</button>
            </div>
        `;

        // Adiciona evento para abrir o modal
        const btnVerPedido = card.querySelector('.ver-pedido');
        if (btnVerPedido) {
            btnVerPedido.addEventListener('click', () => {
                openScheduledOrderModal(order);
            });
        }

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

    // Função para abrir o modal customizado
    function openScheduledOrderModal(order) {
        const modalContainer = document.getElementById('modal-pedido-container');
        if (!modalContainer) return;

        modalContainer.innerHTML = createScheduledModalContent(order);
        modalContainer.style.display = 'flex';

        // Adiciona os botões de ação no footer
        const footerContainer = document.createElement('div');
        footerContainer.className = 'modal-pedido-footer';
        footerContainer.id = `modal-actions-container-${order.id}`;
        
        // Adiciona botão de fechar
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-pedido-fechar';
        closeButton.textContent = 'Fechar';
        closeButton.onclick = () => fecharModal();
        
        footerContainer.appendChild(closeButton);
        
        modalContainer.querySelector('.modal-pedido-content').appendChild(footerContainer);
        
        // Adiciona os botões de ação específicos
        const actionsContainer = footerContainer;
        const now = new Date();
        const prepStart = calculatePrepTime(order);
            
        if (prepStart) {
            if (now >= prepStart) {
                // Já está na hora de preparar - mostra botões normais
                window.addActionButtons(actionsContainer, order);
            } else {
                // Ainda não está na hora - mostra apenas botão de cancelar
                const cancelButton = document.createElement('button');
                cancelButton.className = 'action-button cancel';
                cancelButton.textContent = 'Cancelar';
                cancelButton.onclick = () => handleOrderAction(order.id, 'requestCancellation');
                actionsContainer.appendChild(cancelButton);
            }
        }
    }

    // Função para criar o conteúdo do modal
    function createScheduledModalContent(order) {
        // Formata as datas
        const deliveryStart = order.scheduled?.deliveryDateTimeStart ? 
            new Date(order.scheduled.deliveryDateTimeStart) : null;
        const deliveryEnd = order.scheduled?.deliveryDateTimeEnd ? 
            new Date(order.scheduled.deliveryDateTimeEnd) : null;
        const prepStart = calculatePrepTime(order);

        return `
            <div class="modal-pedido-content">
                <div class="modal-pedido-header">
                    <div class="modal-pedido-title">
                        <span class="scheduled-badge">
                            <i class="fas fa-calendar-alt"></i> AGENDADO
                        </span>
                        Pedido #${order.displayId || order.id?.substring(0, 6)}
                    </div>
                    <button class="modal-print-button" onclick="imprimirComanda('${order.id}')">
                        <i class="fas fa-print"></i>
                    </button>
                    <span class="modal-pedido-status">${getStatusText(order.status)}</span>
                    <button class="modal-pedido-close" onclick="fecharModal()">×</button>
                </div>
                
                <div class="modal-pedido-body">
                    <div class="modal-pedido-details">
                        <!-- Seção de Agendamento -->
                        <div class="scheduled-info-section">
                            <h3><i class="fas fa-clock"></i> Informações do Agendamento</h3>
                            <div class="scheduled-info-content">
                                <div class="scheduled-time-row">
                                    <span class="scheduled-label">Entrega Agendada:</span>
                                    <span class="scheduled-value">${deliveryStart ? deliveryStart.toLocaleString('pt-BR') : 'Não especificado'}</span>
                                </div>
                                ${deliveryEnd ? `
                                <div class="scheduled-time-row">
                                    <span class="scheduled-label">Horário Final:</span>
                                    <span class="scheduled-value">${deliveryEnd.toLocaleString('pt-BR')}</span>
                                </div>` : ''}
                                ${prepStart ? `
                                <div class="scheduled-time-row preparation-time">
                                    <span class="scheduled-label">Início do Preparo:</span>
                                    <span class="scheduled-value">${prepStart.toLocaleString('pt-BR')}</span>
                                </div>` : ''}
                                <div class="scheduled-time-alert">
                                    <i class="fas fa-info-circle"></i>
                                    Não inicie o preparo antes do horário recomendado
                                </div>
                            </div>
                        </div>

                        <!-- Informações do Cliente -->
                        <div class="customer-info">
                            <h3>Informações do Cliente</h3>
                            <p class="customer-name">Cliente: ${order.customer?.name || 'N/A'}</p>
                            <p class="customer-phone">Tel: ${typeof order.customer?.phone === 'string' ? 
                                order.customer.phone : 
                                (order.customer?.phone?.number || 'N/A')}</p>
                        </div>

                        ${order.delivery?.deliveryAddress ? `
                        <!-- Endereço de Entrega -->
                        <div class="customer-address">
                            <h3>Endereço de Entrega</h3>
                            <p>${order.delivery.deliveryAddress.streetName || ''}, ${order.delivery.deliveryAddress.streetNumber || ''}</p>
                            ${order.delivery.deliveryAddress.complement ? 
                                `<p>Complemento: ${order.delivery.deliveryAddress.complement}</p>` : ''}
                            ${order.delivery.deliveryAddress.reference ? 
                                `<p>Referência: ${order.delivery.deliveryAddress.reference}</p>` : ''}
                            <p>${order.delivery.deliveryAddress.neighborhood || ''}</p>
                            <p>${order.delivery.deliveryAddress.city || ''} - ${order.delivery.deliveryAddress.state || ''}</p>
                            ${order.delivery.deliveryAddress.postalCode ? 
                                `<p>CEP: ${order.delivery.deliveryAddress.postalCode}</p>` : ''}
                        </div>` : ''}

                        <!-- Tipo de Pedido -->
                        <div class="order-type">
                            <h3>Tipo de Pedido</h3>
                            <p>${order.orderType === 'DELIVERY' ? 'Entrega' : 
                                order.orderType === 'TAKEOUT' ? 'Para Retirar' : 
                                'Consumo no Local'}</p>
                        </div>

                        <!-- Itens do Pedido -->
                        <div class="order-items">
                            <h3>Itens do Pedido</h3>
                            <ul class="items-list">
                                ${order.items?.map(item => `
                                    <li>
                                        ${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}
                                        ${item.observations ? 
                                            `<span class="item-observations">Obs: ${item.observations}</span>` : ''}
                                        ${item.options?.length ? `
                                            <ul class="options-list">
                                                ${item.options.map(option => `
                                                    <li>${option.quantity}x ${option.name} 
                                                        (+R$ ${(option.price || option.addition || 0).toFixed(2)})
                                                    </li>`).join('')}
                                            </ul>` : ''}
                                    </li>`).join('') || '<li>Nenhum item encontrado</li>'}
                            </ul>
                        </div>

                        <!-- Total do Pedido -->
                        <div class="order-total">
                            <h3>Total do Pedido</h3>
                            <p class="total-amount">R$ ${order.total?.toFixed(2) || '0.00'}</p>
                        </div>

                        <!-- Formas de Pagamento -->
                        ${order.payments?.methods ? `
                        <div class="payment-info">
                            <h3>Forma de Pagamento</h3>
                            <ul>
                                ${order.payments.methods.map(payment => `
                                    <li>${payment.method} - R$ ${payment.value?.toFixed(2)}</li>`).join('')}
                            </ul>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // Função para estender a função de modal original
    function extendModalFunction() {
        // Guarda referência da função original
        const originalAbrirModal = window.abrirModalPedido;
        
        // Sobrescreve com nossa versão que verifica se é pedido agendado
        window.abrirModalPedido = function(card, orderId, orderNumber, conteudoOriginal, actionButtons) {
            // Busca o pedido no cache ou DOM
            const order = ordersCache[orderId];
            
            if (order && order.orderTiming === 'SCHEDULED') {
                // Se for agendado, usa nosso modal customizado
                openScheduledOrderModal(order);
            } else {
                // Se não for agendado, usa o modal original
                originalAbrirModal(card, orderId, orderNumber, conteudoOriginal, actionButtons);
            }
        };
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
                margin-right: 10px;
                display: inline-flex;
                align-items: center;
                gap: 5px;
            }

            .scheduled-info-section {
                background-color: #f3e5f5;
                padding: 1.5rem;
                border-radius: 8px;
                margin-bottom: 1.5rem;
                border-left: 4px solid #9c27b0;
            }

            .scheduled-info-section h3 {
                color: #9c27b0;
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 1rem;
            }

            .scheduled-info-content {
                background-color: white;
                padding: 1rem;
                border-radius: 6px;
            }

            .scheduled-time-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem;
                border-bottom: 1px solid #f0f0f0;
            }

            .scheduled-time-row:last-child {
                border-bottom: none;
            }

            .scheduled-label {
                color: #666;
                font-weight: 500;
            }

            .scheduled-value {
                color: #9c27b0;
                font-weight: bold;
            }

            .preparation-time {
                background-color: #fce4ec;
                border-radius: 4px;
                margin: 0.5rem 0;
            }

            .scheduled-time-alert {
                margin-top: 1rem;
                padding: 0.75rem;
                background-color: #fff3e0;
                border-radius: 4px;
                color: #f57c00;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.9rem;
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
