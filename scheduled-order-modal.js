// Módulo para customizar o modal de pedidos agendados
const scheduledOrderModalModule = (() => {
    // Template do modal customizado para pedidos agendados
    const createScheduledModalContent = (order) => {
        // Formata as datas de entrega agendada
        const deliveryStart = order.scheduled?.deliveryDateTimeStart ? 
            new Date(order.scheduled.deliveryDateTimeStart) : null;
        const deliveryEnd = order.scheduled?.deliveryDateTimeEnd ? 
            new Date(order.scheduled.deliveryDateTimeEnd) : null;

        // Calcula o horário de início do preparo
        const prepStartTime = deliveryStart ? new Date(deliveryStart) : null;
        if (prepStartTime && order.deliveryTime) {
            prepStartTime.setMinutes(prepStartTime.getMinutes() - order.deliveryTime);
        }

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
                                ${prepStartTime ? `
                                <div class="scheduled-time-row preparation-time">
                                    <span class="scheduled-label">Início do Preparo:</span>
                                    <span class="scheduled-value">${prepStartTime.toLocaleString('pt-BR')}</span>
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
    };

    // Função para abrir o modal customizado
    function openScheduledOrderModal(order) {
        const modalContainer = document.getElementById('modal-pedido-container');
        if (!modalContainer) return;

        modalContainer.innerHTML = createScheduledModalContent(order);
        modalContainer.style.display = 'flex';

        // Adiciona os botões de ação
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
        const prepStart = order.scheduled?.deliveryDateTimeStart ? 
            new Date(order.scheduled.deliveryDateTimeStart) : null;
            
        if (prepStart) {
            prepStart.setMinutes(prepStart.getMinutes() - (order.deliveryTime || 0));
            
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

    // Função de inicialização
    function initialize() {
        console.log('🔄 Inicializando módulo de modal para pedidos agendados...');

        // Estende a função de abrir modal original
        extendModalFunction();
        
        // Adiciona estilos customizados
        addCustomStyles();
        
        console.log('✅ Módulo de modal para pedidos agendados inicializado');
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
        `;
        
        document.head.appendChild(style);
    }

    // Retorna API pública
    return {
        initialize,
        openScheduledOrderModal
    };
})();

// Inicializa o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    scheduledOrderModalModule.initialize();
});
