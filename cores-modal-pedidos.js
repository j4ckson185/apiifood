// Melhorias visuais para o modal de pedidos do PDV iFood
// Este arquivo pode ser incluído após script.js para substituir o visual do modal de pedidos
// mantendo todas as funcionalidades existentes

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎨 Carregando melhorias visuais para pedidos...');
    
    // Adicionar estilos CSS para o novo visual
    addOrderModalStyles();
    
    // Substituir a função de exibição do pedido
    if (typeof window.displayOrder === 'function') {
        // Guarda a função original para manter todas as funcionalidades
        const originalDisplayOrder = window.displayOrder;
        
        // Substitui a função de exibição do pedido
        window.displayOrder = function(order) {
            // Executa a função original primeiro para garantir que toda a lógica seja aplicada
            const result = originalDisplayOrder(order);
            
            // Agora aplica nossas melhorias visuais ao card que foi criado
            try {
                enhanceOrderCard(order);
            } catch (error) {
                console.error('❌ Erro ao aplicar melhorias visuais ao pedido:', error);
            }
            
            return result;
        };
        
        // Aplica melhorias aos cards já existentes
        enhanceExistingCards();
        
        console.log('✅ Melhorias visuais para pedidos carregadas com sucesso');
    } else {
        console.error('❌ Função displayOrder não encontrada. Melhorias visuais não aplicadas.');
    }
});

// Função para melhorar visualmente os cards de pedidos já existentes
function enhanceExistingCards() {
    const orderCards = document.querySelectorAll('.order-card');
    
    orderCards.forEach(card => {
        try {
            // Busca o ID do pedido para verificar se já foi melhorado
            const orderId = card.getAttribute('data-order-id');
            
            // Verifica se o card já foi melhorado
            if (!card.classList.contains('enhanced-card')) {
                // Aplica as melhorias visuais
                enhanceOrderCardElement(card);
            }
        } catch (error) {
            console.error('❌ Erro ao melhorar card existente:', error);
        }
    });
}

// Função para melhorar visualmente um card de pedido após sua criação
function enhanceOrderCard(order) {
    // Busca o card pelo ID do pedido
    const orderCard = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
    
    if (!orderCard) {
        console.log('❌ Card do pedido não encontrado para melhorias visuais');
        return;
    }
    
    // Aplica as melhorias visuais
    enhanceOrderCardElement(orderCard, order);
}

// Função principal que aplica as melhorias visuais a um elemento de card
function enhanceOrderCardElement(card, orderData = null) {
    // Evita melhorar o mesmo card duas vezes
    if (card.classList.contains('enhanced-card')) {
        return;
    }
    
    // Marca o card como melhorado
    card.classList.add('enhanced-card');
    
    // Remove o conteúdo atual para reorganizar
    const orderHeader = card.querySelector('.order-header');
    const orderContent = card.querySelector('.order-content');
    const actionButtons = card.querySelector('.order-actions');
    
    if (!orderHeader || !orderContent) {
        console.error('❌ Elementos necessários não encontrados no card');
        return;
    }
    
    // Guarda o conteúdo original para usar na versão expandida
    const originalContent = orderContent.innerHTML;
    
    // Limpa o conteúdo atual
    orderContent.innerHTML = '';
    
    // Cria a versão compacta do card
    createCompactView(card, orderHeader, orderContent);
    
    // Adiciona o botão de expansão ao header
    addExpandButton(card, orderHeader);
    
    // Cria o container da versão expandida
    const expandedContent = document.createElement('div');
    expandedContent.className = 'expanded-content hidden';
    expandedContent.innerHTML = originalContent;
    
    // Verifica se os botões de ação foram removidos na manipulação e os restaura
    if (actionButtons && !card.querySelector('.order-actions')) {
        expandedContent.appendChild(actionButtons);
    }
    
    // Adiciona o conteúdo expandido
    card.appendChild(expandedContent);
}

// Função para criar a visualização compacta do card
function createCompactView(card, header, content) {
    // Extrai informações básicas do card
    const orderNumber = header.querySelector('.order-number')?.textContent || '';
    const orderStatus = header.querySelector('.order-status')?.textContent || '';
    
    // Extrai informações do cliente
    const customerName = card.querySelector('.customer-info .customer-name')?.textContent || '';
    const customerNameOnly = customerName.replace('Cliente: ', '');
    
    // Extrai informações do tipo de pedido
    const orderType = card.querySelector('.order-type p')?.textContent || '';
    
    // Extrai informações de pagamento
    const paymentMethod = card.querySelector('.payment-info li')?.textContent || '';
    const paymentShort = paymentMethod.split(' - ')[0] || paymentMethod;
    
    // Total do pedido
    const orderTotal = card.querySelector('.order-total .total-amount')?.textContent || '';
    
    // Cria a nova visualização compacta
    const compactView = document.createElement('div');
    compactView.className = 'compact-view';
    
    // Adiciona informações básicas com ícones
    compactView.innerHTML = `
        <div class="compact-row">
            <div class="compact-item customer">
                <i class="fas fa-user"></i>
                <span>${customerNameOnly}</span>
            </div>
            <div class="compact-item order-type">
                <i class="${getOrderTypeIcon(orderType)}"></i>
                <span>${orderType}</span>
            </div>
        </div>
        <div class="compact-row">
            <div class="compact-item payment">
                <i class="${getPaymentIcon(paymentShort)}"></i>
                <span>${paymentShort}</span>
            </div>
            <div class="compact-item total">
                <i class="fas fa-receipt"></i>
                <span>${orderTotal}</span>
            </div>
        </div>
    `;
    
    // Adiciona à área de conteúdo
    content.appendChild(compactView);
    
    // Se houver um código de coleta, destaca-o
    const pickupCodeElement = card.querySelector('.pickup-code');
    if (pickupCodeElement) {
        // Move o código de coleta para a área compacta
        content.appendChild(pickupCodeElement);
    }
}

// Função para adicionar botão de expansão
function addExpandButton(card, header) {
    const expandButton = document.createElement('button');
    expandButton.className = 'expand-button';
    expandButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
    expandButton.setAttribute('title', 'Expandir detalhes');
    expandButton.setAttribute('aria-label', 'Expandir detalhes do pedido');
    
    // Adiciona o botão ao header
    header.appendChild(expandButton);
    
    // Adiciona o evento de clique
    expandButton.addEventListener('click', function(e) {
        e.stopPropagation(); // Evita que o clique se propague para o card
        
        const expandedContent = card.querySelector('.expanded-content');
        const icon = expandButton.querySelector('i');
        
        if (expandedContent) {
            expandedContent.classList.toggle('hidden');
            
            // Atualiza o ícone
            if (expandedContent.classList.contains('hidden')) {
                icon.className = 'fas fa-chevron-down';
                expandButton.setAttribute('title', 'Expandir detalhes');
            } else {
                icon.className = 'fas fa-chevron-up';
                expandButton.setAttribute('title', 'Recolher detalhes');
            }
        }
    });
    
    // Adiciona evento de clique ao card inteiro para expandir/recolher
    card.addEventListener('click', function(e) {
        // Só expande se o clique for no card, não nos botões de ação
        if (!e.target.closest('.action-button') && !e.target.closest('.expand-button')) {
            expandButton.click();
        }
    });
}

// Função auxiliar para obter ícone baseado no tipo de pedido
function getOrderTypeIcon(orderType) {
    if (orderType.includes('Entrega')) {
        return 'fas fa-motorcycle';
    } else if (orderType.includes('Retirar')) {
        return 'fas fa-shopping-bag';
    } else if (orderType.includes('Local')) {
        return 'fas fa-utensils';
    }
    return 'fas fa-box';
}

// Função auxiliar para obter ícone baseado no método de pagamento
function getPaymentIcon(paymentMethod) {
    const method = paymentMethod.toLowerCase();
    
    if (method.includes('dinheiro')) {
        return 'fas fa-money-bill-wave';
    } else if (method.includes('cartão') || method.includes('cartao')) {
        return 'fas fa-credit-card';
    } else if (method.includes('pix')) {
        return 'fas fa-qrcode';
    } else if (method.includes('online')) {
        return 'fas fa-globe';
    }
    
    return 'fas fa-wallet';
}

// Função para adicionar os estilos CSS
function addOrderModalStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Estilos para o card melhorado */
        .order-card {
            transition: all 0.3s ease;
            cursor: pointer;
        }
        
        .order-card.enhanced-card {
            padding-bottom: 0;
        }
        
        .order-header {
            background-color: #f8f9fa;
            position: relative;
        }
        
        .expand-button {
            background: none;
            border: none;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #666;
            transition: all 0.2s ease;
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
        }
        
        .expand-button:hover {
            background-color: rgba(0,0,0,0.1);
            color: #333;
        }
        
        /* Visualização compacta */
        .compact-view {
            padding: 1rem 0;
        }
        
        .compact-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
        }
        
        .compact-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.95rem;
            padding: 6px 0;
        }
        
        .compact-item i {
            font-size: 1rem;
            width: 20px;
            text-align: center;
            color: var(--primary-color);
        }
        
        .compact-item.customer i {
            color: #3498db;
        }
        
        .compact-item.order-type i {
            color: #9b59b6;
        }
        
        .compact-item.payment i {
            color: #2ecc71;
        }
        
        .compact-item.total i {
            color: #e74c3c;
        }
        
        /* Versão expandida */
        .expanded-content {
            padding: 0 1rem 1rem;
            border-top: 1px dashed #eee;
            overflow: hidden;
            max-height: 1000px;
            transition: all 0.3s ease;
        }
        
        .expanded-content.hidden {
            max-height: 0;
            padding-top: 0;
            padding-bottom: 0;
            border-top: none;
        }
        
        /* Melhoria do código de coleta */
        .pickup-code {
            text-align: center;
            margin-top: 0.5rem;
            background-color: #f8f4e5;
            padding: 0.5rem;
            border-radius: 8px;
        }
        
        .pickup-code h3 {
            font-size: 0.75rem;
            text-transform: uppercase;
            color: #b9a888;
            margin-bottom: 0.3rem;
        }
        
        .code-display {
            background-color: white;
            border: 2px dashed #ddd;
            font-size: 1.3rem;
            padding: 0.3rem 1rem;
            letter-spacing: 3px;
            display: inline-block;
            font-weight: bold;
            color: var(--dark-gray);
        }
        
        /* Garantir que o botão não afete o layout original */
        .order-actions {
            margin-top: 1rem;
            width: 100%;
        }
    `;
    
    document.head.appendChild(styleElement);
}
