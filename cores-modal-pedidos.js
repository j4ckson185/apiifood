// Melhorias visuais para o modal de pedidos do PDV iFood
// Versão final com correções: botões de ação no card e sem código em destaque

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎨 Carregando melhorias visuais para pedidos...');
    
    // Adiciona os estilos CSS
    adicionarEstilos();
    
    // Adiciona o container do modal ao body
    criarContainerModal();
    
    // Substituir a função de exibição do pedido
    if (typeof window.displayOrder === 'function') {
        // Guarda a função original para manter todas as funcionalidades
        const displayOrderOriginal = window.displayOrder;
        
        // Substitui a função de exibição do pedido
        window.displayOrder = function(order) {
            // Executa a função original primeiro para garantir que toda a lógica seja aplicada
            const result = displayOrderOriginal(order);
            
            // Agora aplica nossas melhorias visuais ao card que foi criado
            try {
                melhorarCardPedido(order);
            } catch (error) {
                console.error('❌ Erro ao aplicar melhorias visuais ao pedido:', error);
            }
            
            return result;
        };
        
        // Aplica melhorias aos cards já existentes
        setTimeout(() => {
            melhorarCardsExistentes();
        }, 500);
        
        console.log('✅ Melhorias visuais para pedidos carregadas com sucesso');
    } else {
        console.error('❌ Função displayOrder não encontrada. Melhorias visuais não aplicadas.');
    }
});

// Função para melhorar visualmente os cards de pedidos já existentes
function melhorarCardsExistentes() {
    const cards = document.querySelectorAll('.order-card');
    console.log(`Encontrados ${cards.length} cards para melhorar visualmente`);
    
    cards.forEach(card => {
        try {
            // Verifica se o card já foi melhorado
            if (!card.classList.contains('card-melhorado')) {
                melhorarCardPedidoElemento(card);
            }
        } catch (error) {
            console.error('❌ Erro ao melhorar card existente:', error);
        }
    });
}

// Função para melhorar visualmente um card de pedido após sua criação
function melhorarCardPedido(order) {
    // Busca o card pelo ID do pedido
    const card = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
    
    if (!card) {
        console.log('❌ Card do pedido não encontrado para melhorias visuais');
        return;
    }
    
    // Aplica as melhorias visuais
    melhorarCardPedidoElemento(card);
}

// Função principal que aplica as melhorias visuais a um elemento de card
function melhorarCardPedidoElemento(card) {
    try {
        // Evita melhorar o mesmo card duas vezes
        if (card.classList.contains('card-melhorado')) {
            return;
        }
        
        // Marca o card como melhorado
        card.classList.add('card-melhorado');
        
        // Extrai as informações básicas do card original
        const orderId = card.getAttribute('data-order-id');
        const orderNumber = card.querySelector('.order-number')?.textContent?.trim() || '';
        const orderStatus = card.querySelector('.order-status')?.textContent?.trim() || '';
        const customerName = card.querySelector('.customer-info .customer-name')?.textContent?.replace('Cliente:', '').trim() || '';
        const customerPhone = card.querySelector('.customer-info .customer-phone')?.textContent?.replace('Tel:', '').trim() || '';
        
        // Determina o tipo de pedido
        let orderTypeText = 'Tipo desconhecido';
        let orderTypeIcon = 'box';
        const orderTypeElem = card.querySelector('.order-type p');
        if (orderTypeElem) {
            orderTypeText = orderTypeElem.textContent?.trim() || '';
            
            if (orderTypeText.includes('Entrega')) {
                orderTypeIcon = 'motorcycle';
            } else if (orderTypeText.includes('Retirar')) {
                orderTypeIcon = 'shopping-bag';
            } else if (orderTypeText.includes('Local')) {
                orderTypeIcon = 'utensils';
            }
        }
        
        // Determina o método de pagamento
        let paymentText = 'Pagamento';
        let paymentIcon = 'wallet';
        const paymentElem = card.querySelector('.payment-info li');
        if (paymentElem) {
            paymentText = paymentElem.textContent?.split(' - ')[0]?.trim() || 'Pagamento';
            
            const payment = paymentText.toLowerCase();
            if (payment.includes('dinheiro')) {
                paymentIcon = 'money-bill-wave';
            } else if (payment.includes('cartão') || payment.includes('cartao')) {
                paymentIcon = 'credit-card';
            } else if (payment.includes('pix')) {
                paymentIcon = 'qrcode';
            } else if (payment.includes('online')) {
                paymentIcon = 'globe';
            }
        }
        
        // Obtém o total
        const totalValue = card.querySelector('.order-total .total-amount')?.textContent?.trim() || '';
        
        // Obtém o código de coleta se existir
        const pickupCode = card.querySelector('.code-display')?.textContent?.trim() || '';
        
        // Limpa o conteúdo atual para criar a versão compacta
        const orderContent = card.querySelector('.order-content');
        if (orderContent) {
            // Salva o conteúdo original para o modal
            const originalContent = orderContent.innerHTML;
            
            // Guarda o botões de ação originais
            const actionButtons = card.querySelector('.order-actions');
            
            // Limpa e cria novo conteúdo compacto
            orderContent.innerHTML = '';
            
            // Layout compacto para o card
            const compactView = document.createElement('div');
            compactView.className = 'compact-view';
            compactView.innerHTML = `
                <div class="compact-row">
                    <div class="compact-customer">
                        <i class="fas fa-user"></i>
                        <span>${customerName || 'Cliente'}</span>
                    </div>
                </div>
                <div class="compact-row">
                    <div class="compact-type">
                        <i class="fas fa-${orderTypeIcon}"></i>
                        <span>${orderTypeText}</span>
                    </div>
                </div>
                <div class="compact-row">
                    <div class="compact-payment">
                        <i class="fas fa-${paymentIcon}"></i>
                        <span>${paymentText}</span>
                    </div>
                </div>
                <div class="compact-row">
                    <div class="compact-total">
                        <i class="fas fa-receipt"></i>
                        <span>${totalValue}</span>
                    </div>
                </div>
                ${pickupCode ? `
                <div class="compact-row">
                    <div class="compact-pickup-code">
                        <i class="fas fa-ticket-alt"></i>
                        <span>Código Coleta: <strong>${pickupCode}</strong></span>
                    </div>
                </div>` : ''}
                <div class="compact-actions-container">
                </div>
                <button class="ver-pedido">Ver Detalhes</button>
            `;
            
            // Adiciona o conteúdo compacto
            orderContent.appendChild(compactView);
            
            // Adiciona os botões de ação originais, se existirem
            const actionsContainer = compactView.querySelector('.compact-actions-container');
            if (actionsContainer && actionButtons) {
                // Clona os botões para não remover do DOM original
                const clonedButtons = actionButtons.cloneNode(true);
                clonedButtons.classList.add('compact-actions');
                actionsContainer.appendChild(clonedButtons);
                
                // Adiciona os eventos novamente aos botões clonados
                clonedButtons.querySelectorAll('.action-button').forEach((button, index) => {
                    const originalButton = actionButtons.querySelectorAll('.action-button')[index];
                    if (originalButton && originalButton.onclick) {
                        button.onclick = originalButton.onclick;
                    }
                });
            }
            
            // Adiciona o evento para abrir o modal ao clicar no botão
            const btnVerPedido = compactView.querySelector('.ver-pedido');
            if (btnVerPedido) {
                btnVerPedido.addEventListener('click', function(e) {
                    e.stopPropagation();
                    abrirModalPedido(card, orderId, orderNumber, originalContent);
                });
            }
            
            // Adiciona o evento para abrir o modal ao clicar no card
            card.addEventListener('click', function(e) {
                // Evita conflitos com outros cliques
                if (!e.target.closest('.action-button') && !e.target.closest('.ver-pedido')) {
                    abrirModalPedido(card, orderId, orderNumber, originalContent);
                }
            });
        }
    } catch (error) {
        console.error('❌ Erro ao melhorar card:', error);
        console.error(error.stack);
    }
}

// Função para criar o container do modal
function criarContainerModal() {
    // Verifica se o container já existe
    if (document.getElementById('modal-pedido-container')) {
        return;
    }
    
    // Cria o container do modal
    const modalContainer = document.createElement('div');
    modalContainer.id = 'modal-pedido-container';
    modalContainer.className = 'modal-pedido-container';
    modalContainer.style.display = 'none';
    
    // Adiciona o evento para fechar o modal ao clicar fora dele
    modalContainer.addEventListener('click', function(e) {
        if (e.target === modalContainer) {
            fecharModal();
        }
    });
    
    // Adiciona o container ao body
    document.body.appendChild(modalContainer);
}

// Função para abrir o modal com os detalhes do pedido
function abrirModalPedido(card, orderId, orderNumber, conteudoOriginal) {
    // Obtém o container do modal
    const modalContainer = document.getElementById('modal-pedido-container');
    if (!modalContainer) {
        console.error('Container do modal não encontrado');
        return;
    }
    
    // Extrai outras informações relevantes
    const orderStatus = card.querySelector('.order-status')?.textContent || '';
    
    // Cria o conteúdo do modal
    modalContainer.innerHTML = `
        <div class="modal-pedido-content">
            <div class="modal-pedido-header">
                <h2 class="modal-pedido-title">Pedido ${orderNumber}</h2>
                <span class="modal-pedido-status">${orderStatus}</span>
                <button class="modal-pedido-close" onclick="fecharModal()">×</button>
            </div>
            <div class="modal-pedido-body">
                <div class="modal-pedido-details">
                    ${conteudoOriginal}
                </div>
            </div>
            <div class="modal-pedido-footer">
                <button class="modal-pedido-fechar" onclick="fecharModal()">Fechar</button>
            </div>
        </div>
    `;
    
    // Exibe o modal
    modalContainer.style.display = 'flex';
    
    // Adiciona a função de fechar no escopo global
    window.fecharModal = function() {
        modalContainer.style.display = 'none';
    };
}

// Função para adicionar os estilos CSS
function adicionarEstilos() {
    if (document.getElementById('estilos-modal-pedidos')) {
        return;
    }
    
    const estilos = document.createElement('style');
    estilos.id = 'estilos-modal-pedidos';
    estilos.textContent = `
        /* Estilos para o card compacto */
        .order-card.card-melhorado {
            transition: all 0.2s ease;
            cursor: pointer;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
            border-left: 4px solid #1a73e8 !important;
        }
        
        .order-card.card-melhorado:hover {
            transform: translateY(-3px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .order-card.card-melhorado .order-header {
            padding: 14px 15px;
            background: #f8f9fa;
            border-top-right-radius: 8px;
            border-bottom: 1px solid rgba(0,0,0,0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .order-card.card-melhorado .order-number {
            font-size: 18px;
            font-weight: 700;
            color: #202124;
            padding-left: 8px;
            border-left: 3px solid #1a73e8;
        }
        
        .order-card.card-melhorado .order-status {
            font-size: 13px;
            padding: 5px 12px;
            border-radius: 12px;
            font-weight: 600;
            background-color: #1a73e8;
            color: white;
            box-shadow: 0 2px 4px rgba(26, 115, 232, 0.2);
        }
        
        /* Status específicos */
        .status-confirmed .order-status {
            background-color: #1a73e8 !important;
        }
        
        .status-ready_to_pickup .order-status,
        .status-in_preparation .order-status {
            background-color: #00c853 !important;
        }
        
        .status-dispatched .order-status {
            background-color: #ff9800 !important;
        }
        
        .status-cancelled .order-status {
            background-color: #f44336 !important;
        }
        
        .status-concluded .order-status {
            background-color: #4caf50 !important;
        }
        
        /* Conteúdo compacto */
        .compact-view {
            padding: 12px 15px;
        }
        
        .compact-row {
            margin-bottom: 8px;
        }
        
        .compact-row:last-of-type {
            margin-bottom: 12px;
        }
        
        .compact-customer,
        .compact-type,
        .compact-payment,
        .compact-total,
        .compact-pickup-code {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 15px;
            color: #202124;
            padding: 5px 0;
            font-weight: 500;
        }
        
        .compact-customer i,
        .compact-type i,
        .compact-payment i,
        .compact-total i,
        .compact-pickup-code i {
            font-size: 16px;
            min-width: 20px;
            text-align: center;
        }
        
        .compact-customer i {
            color: #1a73e8;
        }
        
        .compact-type i {
            color: #673ab7;
        }
        
        .compact-payment i {
            color: #009688;
        }
        
        .compact-total i {
            color: #e53935;
        }
        
        .compact-pickup-code i {
            color: #ff9800;
        }
        
        .compact-pickup-code strong {
            font-weight: 600;
            letter-spacing: 1px;
            color: #e65100;
        }
        
        /* Estilo para os botões de ação no card */
        .compact-actions-container {
            margin: 0 0 12px 0;
        }
        
        .compact-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 0 !important;
            width: 100%;
        }
        
        .compact-actions .action-button {
            flex: 1;
            min-width: auto;
            margin: 0;
            padding: 8px 12px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .compact-actions .action-button.confirm {
            background-color: #00c853;
        }
        
        .compact-actions .action-button.confirm:hover {
            background-color: #00b248;
        }
        
        .compact-actions .action-button.cancel {
            background-color: #f44336;
        }
        
        .compact-actions .action-button.cancel:hover {
            background-color: #e53935;
        }
        
        .compact-actions .action-button.prepare,
        .compact-actions .action-button.ready {
            background-color: #ff9800;
            color: white;
        }
        
        .compact-actions .action-button.prepare:hover,
        .compact-actions .action-button.ready:hover {
            background-color: #f57c00;
        }
        
        .compact-actions .action-button.dispatch {
            background-color: #1a73e8;
        }
        
        .compact-actions .action-button.dispatch:hover {
            background-color: #1565c0;
        }
        
        .compact-actions .action-button.disabled {
            background-color: #e0e0e0;
            color: #757575;
            cursor: not-allowed;
            box-shadow: none;
        }
        
        .ver-pedido {
            display: block;
            width: 100%;
            padding: 10px;
            background-color: #1a73e8;
            color: white;
            border: none;
            border-radius: 4px;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            transition: background-color 0.2s;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }
        
        .ver-pedido:hover {
            background-color: #1565c0;
        }
        
        /* Estilos para o modal */
        .modal-pedido-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            padding: 20px;
        }
        
        .modal-pedido-content {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
            width: 100%;
            max-width: 650px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: modalFadeIn 0.3s ease;
            position: relative;
        }
        
        @keyframes modalFadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .modal-pedido-header {
            padding: 16px 20px;
            background-color: #1a73e8;
            display: flex;
            align-items: center;
            position: relative;
        }
        
        .modal-pedido-title {
            font-size: 20px;
            font-weight: 700;
            color: white;
            margin: 0;
            flex-grow: 1;
        }
        
        .modal-pedido-status {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            background-color: white;
            color: #1a73e8;
            margin-right: 40px;
        }
        
        .modal-pedido-close {
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            width: 36px;
            height: 36px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            font-size: 28px;
            line-height: 28px;
            color: white;
            cursor: pointer;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-pedido-close:hover {
            background-color: rgba(255, 255, 255, 0.3);
        }
        
        .modal-pedido-body {
            padding: 0;
            overflow-y: auto;
            max-height: calc(90vh - 130px);
        }
        
        .modal-pedido-details {
            padding: 0;
        }
        
        /* Estilizar itens específicos dentro do modal */
        .modal-pedido-details .customer-info,
        .modal-pedido-details .customer-address,
        .modal-pedido-details .order-type,
        .modal-pedido-details .payment-info,
        .modal-pedido-details .order-items,
        .modal-pedido-details .order-total,
        .modal-pedido-details .order-created-at,
        .modal-pedido-details .scheduled-info,
        .modal-pedido-details .takeout-info,
        .modal-pedido-details .pickup-code {
            padding: 16px 20px;
            border-bottom: 1px solid #f1f3f4;
            margin: 0 !important;
        }
        
        /* Ocultar o código de coleta duplicado na seção principal */
        .modal-pedido-body .code-display {
            display: none;
        }
        
        .modal-pedido-details h3 {
            font-size: 16px;
            color: #202124;
            margin: 0 0 10px 0;
            padding: 0;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* Adicionar ícones aos cabeçalhos */
        .modal-pedido-details .customer-info h3:before {
            content: "\\f007";
            font-family: "Font Awesome 5 Free";
            font-weight: 900;
            color: #1a73e8;
            font-size: 16px;
        }
        
        .modal-pedido-details .customer-address h3:before {
            content: "\\f3c5";
            font-family: "Font Awesome 5 Free";
            font-weight: 900;
            color: #4285f4;
        }
        
        .modal-pedido-details .order-type h3:before {
            content: "\\f0d1";
            font-family: "Font Awesome 5 Free";
            font-weight: 900;
            color: #673ab7;
        }
        
        .modal-pedido-details .payment-info h3:before {
            content: "\\f09d";
            font-family: "Font Awesome 5 Free";
            font-weight: 900;
            color: #009688;
        }
        
        .modal-pedido-details .order-items h3:before {
            content: "\\f805";
            font-family: "Font Awesome 5 Free";
            font-weight: 900;
            color: #f57c00;
        }
        
        .modal-pedido-details .order-total h3:before {
            content: "\\f3d1";
            font-family: "Font Awesome 5 Free";
            font-weight: 900;
            color: #e53935;
        }
        
        .modal-pedido-details .order-created-at h3:before {
            content: "\\f017";
            font-family: "Font Awesome 5 Free";
            font-weight: 900;
            color: #607d8b;
        }
        
        .modal-pedido-details .pickup-code h3:before {
            content: "\\f145";
            font-family: "Font Awesome 5 Free";
            font-weight: 900;
            color: #ff9800;
        }
        
        .modal-pedido-details p {
            margin: 8px 0;
            font-size: 16px;
            color: #202124;
            font-weight: 500;
        }
        
        /* Melhorias na lista de itens */
        .modal-pedido-details .items-list {
            margin: 0;
            padding: 0;
            list-style: none;
        }
        
        .modal-pedido-details .items-list li {
            padding: 12px 0;
            border-bottom: 1px solid #f1f3f4;
            position: relative;
            padding-left: 28px;
            color: #202124;
            font-size: 16px;
            font-weight: 500;
        }
        
        .modal-pedido-details .items-list li:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }
        
        .modal-pedido-details .items-list li:before {
            content: "\\f058";
            font-family: "Font Awesome 5 Free";
            font-weight: 900;
            position: absolute;
            left: 0;
            top: 14px;
            color: #f57c00;
            font-size: 18px;
        }
        
        .modal-pedido-details .item-observations {
            font-style: italic;
            color: #5f6368;
            margin-top: 6px;
            padding-left: 8px;
            border-left: 3px solid #f1f3f4;
            display: block;
            font-size: 15px;
        }
        
        /* Melhorias footer e botões */
        .modal-pedido-footer {
            padding: 16px 20px;
            background-color: #f8f9fa;
            border-top: 1px solid #e9ecef;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .modal-pedido-footer .order-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            flex: 1;
            justify-content: flex-start;
            margin: 0;
        }
        
        .modal-pedido-fechar {
            padding: 10px 18px;
            background-color: #5f6368;
            color: white;
            border: none;
            border-radius: 4px;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            transition: background-color 0.2s;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .modal-pedido-fechar:hover {
            background-color: #4b4f53;
        }
        
        /* Responsividade */
        @media (max-width: 767px) {
            .compact-actions {
                flex-direction: column;
            }
            
            .modal-pedido-content {
                width: 95%;
                max-height: 95vh;
            }
            
            .modal-pedido-footer {
                flex-direction: column-reverse;
            }
            
            .modal-pedido-footer .order-actions {
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .modal-pedido-fechar {
                width: 100%;
            }
        }
    `;
    
    document.head.appendChild(estilos);
    console.log('✅ Estilos do modal adicionados');
}
