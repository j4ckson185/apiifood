// Modificações no arquivo scheduled-order-modal.js

// Melhorando o módulo de pedidos agendados para persistência e carregamento correto
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
    
// 1) Carrega TODOS os pedidos salvos (incluindo agendados) no localStorage para window.ordersCache
if (typeof window.loadOrdersFromLocalStorage === 'function') {
  window.loadOrdersFromLocalStorage();
}

// 2) Agora restaura apenas os agendados do cache (que já estará preenchido)
restoreScheduledOrders();
    
    console.log('✅ Módulo de pedidos agendados inicializado');
}

    // Função para verificar se um pedido é agendado
    function isScheduledOrder(order) {
        return order?.orderTiming === 'SCHEDULED';
    }

    // Função para calcular o horário de início do preparo
    function calculatePrepTime(order) {
        if (!order.preparationStartDateTime && !order.scheduledDateTimeForDelivery) return null;
        
        // Sempre usa preparationStartDateTime da API se disponível
        if (order.preparationStartDateTime) {
            return new Date(order.preparationStartDateTime);
        }

        // Não calcula manualmente se não tiver o horário de entrega
        return null;
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
                    // *** MODIFICADO: Garante que o pedido seja salvo no cache global
                    if (window.ordersCache) {
                        window.ordersCache[order.id] = order;
                    }
                    
                    // *** MODIFICADO: Adiciona ao cache de pedidos agendados
                    scheduledOrders[order.id] = order;
                    
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

    // Função para restaurar pedidos agendados
    function restoreScheduledOrders() {
        console.log('🔄 Restaurando pedidos agendados do localStorage...');
        
        // Obtem os pedidos do cache global
        const allOrders = window.ordersCache || {};
        
        // Filtra apenas os pedidos agendados
        const scheduled = Object.values(allOrders).filter(order => {
            if (!order || !isScheduledOrder(order)) return false;
            
            const prepTime = calculatePrepTime(order);
            const now = new Date();
            
            // Filtra apenas pedidos agendados que ainda não estão na hora de preparar
            return prepTime && now < prepTime;
        });
        
        console.log(`📋 Encontrados ${scheduled.length} pedidos agendados para restaurar`);
        
        // Exibe cada pedido na aba de agendados
        scheduled.forEach(order => {
            // Verifica se o pedido já existe na interface
            const existingOrder = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
            if (!existingOrder) {
                displayScheduledOrder(order);
                console.log(`✅ Pedido agendado ${order.id} restaurado`);
            }
        });
        
        // Verifica se a aba de agendados está vazia
        checkForEmptyTab('scheduled');
    }

    // Função para exibir pedido na aba de agendados
    function displayScheduledOrder(order) {
        const container = document.getElementById('scheduled-orders');
        if (!container) return;

        // *** VERIFICAÇÃO: Evitar duplicação de pedidos
        const existingOrder = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
        if (existingOrder) {
            console.log(`Pedido ${order.id} já existe na interface, ignorando duplicação`);
            return;
        }

        // Cria o card do pedido
        const card = createScheduledOrderCard(order);
        
        // Adiciona ao container
        container.appendChild(card);
        
        // Adiciona ao cache
        scheduledOrders[order.id] = order;
        
        // Garante que o pedido esteja no cache global
        if (window.ordersCache) {
            window.ordersCache[order.id] = order;
        }
        
        // Verifica se a mensagem de vazio deve ser mostrada
        checkForEmptyTab('scheduled');
        
        // Configura o timer para mover para aba de preparo
        setupScheduledOrderTimer(order);
        
        // *** NOVO: Força o salvamento no localStorage
        if (typeof window.saveOrdersToLocalStorage === 'function') {
            setTimeout(() => window.saveOrdersToLocalStorage(), 500);
        }
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
                    <p class="customer-phone">Tel: ${typeof order.customer?.phone === 'string' ? 
                        order.customer.phone : 
                        (order.customer?.phone?.number || 'N/A')}</p>
                </div>
                <div class="order-total">
                    <h3>Total</h3>
                    <p class="total-amount">
                        R$ ${typeof order.total === 'number' ? 
                            order.total.toFixed(2) : 
                            (order.total?.orderAmount?.toFixed(2) || '0.00')}
                    </p>
                </div>
                <div class="order-actions">
                    <button class="action-button cancel" onclick="handleOrderAction('${order.id}', 'requestCancellation')">Cancelar</button>
                    <button class="ver-pedido">Ver Detalhes</button>
                </div>
            </div>
        `;

        // Adiciona evento para abrir o modal
        card.querySelector('.ver-pedido').addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Cria o conteúdo detalhado do pedido
            const conteudoDetalhado = `
                <div class="order-content">
                    <!-- Seção de Agendamento -->
                    <div class="scheduled-info-section">
                        <h3>Informações do Agendamento</h3>
                        <div class="scheduled-info-content">
                            <div class="scheduled-time-row">
                                <span class="scheduled-label">Entrega Agendada:</span>
                                <span class="scheduled-value">${order.scheduledDateTimeForDelivery ? 
                                    new Date(order.scheduledDateTimeForDelivery).toLocaleString('pt-BR') : 'Não definido'}</span>
                            </div>
                            <div class="scheduled-time-row preparation-time">
                                <span class="scheduled-label">Início do Preparo:</span>
                                <span class="scheduled-value">${order.preparationStartDateTime ? 
                                    new Date(order.preparationStartDateTime).toLocaleString('pt-BR') : 
                                    'Não definido'}</span>
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
                                    ${item.quantity}x ${item.name} - R$ ${(typeof item.totalPrice === 'number' ? 
                                        item.totalPrice : (item.price * item.quantity)).toFixed(2)}
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
                        <p class="total-amount">
                            R$ ${typeof order.total === 'number' ? 
                                order.total.toFixed(2) : 
                                (order.total?.orderAmount?.toFixed(2) || '0.00')}
                        </p>
                    </div>

                    <!-- Formas de Pagamento -->
                    ${order.payments?.methods ? `
                    <div class="payment-info">
                        <h3>Forma de Pagamento</h3>
                        <ul>
                            ${order.payments.methods.map(payment => {
                                let methodText = payment.method || '';
                                let trocoInfo = '';

                                // Traduz método de pagamento
                                if (methodText.toLowerCase().includes('cash')) {
                                    methodText = 'Dinheiro (Na Entrega)';
                                    // Adiciona informação de troco se disponível
                                    if (payment.cash?.changeFor) {
                                        trocoInfo = `<li class="payment-change-for">Troco para: R$ ${payment.cash.changeFor.toFixed(2)}</li>`;
                                    }
                                }

                                return `
                                    <li>${methodText} - R$ ${payment.value?.toFixed(2)}</li>
                                    ${trocoInfo}
                                `;
                            }).join('')}
                        </ul>
                    </div>` : ''}
                </div>
            `;

            // Abre o modal com o conteúdo detalhado
            if (typeof abrirModalPedido === 'function') {
                abrirModalPedido(card, order.id, order.displayId || order.id.substring(0, 6), conteudoDetalhado, null);
            }
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
        
        // Atualiza o localStorage
        if (typeof window.saveOrdersToLocalStorage === 'function') {
            window.saveOrdersToLocalStorage();
        }
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

    // Exponha as funções que precisam ser acessíveis globalmente
    window.isScheduledOrder = isScheduledOrder;
    window.calculatePrepTime = calculatePrepTime;
    window.displayScheduledOrder = displayScheduledOrder;
    
    // Retorna API pública
    return {
        initialize,
        isScheduledOrder,
        scheduledOrders,
        restoreScheduledOrders  // Expõe a função para restauração manual se necessário
    };
})();

// Inicializa o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    scheduledOrdersModule.initialize();
});
