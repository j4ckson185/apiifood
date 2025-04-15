// Melhorias visuais para o modal de pedidos do PDV iFood
// Versão corrigida - Compatível com a estrutura existente

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎨 Carregando melhorias visuais para pedidos...');
    
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
        setTimeout(() => {
            enhanceExistingCards();
        }, 500); // Pequeno delay para garantir que todos os cards estejam carregados
        
        console.log('✅ Melhorias visuais para pedidos carregadas com sucesso');
    } else {
        console.error('❌ Função displayOrder não encontrada. Melhorias visuais não aplicadas.');
    }
});

// Função para melhorar visualmente os cards de pedidos já existentes
function enhanceExistingCards() {
    const orderCards = document.querySelectorAll('.order-card');
    console.log(`Encontrados ${orderCards.length} cards para melhorar visualmente`);
    
    orderCards.forEach(card => {
        try {
            // Verifica se o card já foi melhorado
            if (!card.classList.contains('visually-enhanced')) {
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
    enhanceOrderCardElement(orderCard);
}

// Função principal que aplica as melhorias visuais a um elemento de card
function enhanceOrderCardElement(card) {
    // Evita melhorar o mesmo card duas vezes
    if (card.classList.contains('visually-enhanced')) {
        return;
    }
    
    try {
        // Marca o card como melhorado
        card.classList.add('visually-enhanced');
        
        // Extrai informações necessárias
        const orderNumber = card.querySelector('.order-number')?.textContent || '';
        const orderStatus = card.querySelector('.order-status')?.textContent || '';
        const customerName = card.querySelector('.customer-info .customer-name')?.textContent?.replace('Cliente: ', '') || 'Cliente';
        
        // Determina o tipo de pedido
        let orderTypeText = 'Tipo desconhecido';
        let orderTypeIcon = 'fas fa-box';
        
        const orderTypeElem = card.querySelector('.order-type p');
        if (orderTypeElem) {
            orderTypeText = orderTypeElem.textContent || '';
            
            if (orderTypeText.includes('Entrega')) {
                orderTypeIcon = 'fas fa-motorcycle';
            } else if (orderTypeText.includes('Retirar')) {
                orderTypeIcon = 'fas fa-shopping-bag';
            } else if (orderTypeText.includes('Local')) {
                orderTypeIcon = 'fas fa-utensils';
            }
        }
        
        // Determina o método de pagamento
        let paymentText = 'Pagamento';
        let paymentIcon = 'fas fa-wallet';
        
        const paymentElem = card.querySelector('.payment-info li');
        if (paymentElem) {
            paymentText = paymentElem.textContent?.split(' - ')[0] || paymentElem.textContent || '';
            
            const payment = paymentText.toLowerCase();
            if (payment.includes('dinheiro')) {
                paymentIcon = 'fas fa-money-bill-wave';
            } else if (payment.includes('cartão') || payment.includes('cartao')) {
                paymentIcon = 'fas fa-credit-card';
            } else if (payment.includes('pix')) {
                paymentIcon = 'fas fa-qrcode';
            } else if (payment.includes('online')) {
                paymentIcon = 'fas fa-globe';
            }
        }
        
        // Obtém o total
        const totalText = card.querySelector('.order-total .total-amount')?.textContent || '';
        
        // Cria os elementos da visualização compacta
        const headerContent = card.querySelector('.order-header');
        const mainContent = card.querySelector('.order-content');
        
        if (!headerContent || !mainContent) {
            console.error('Elementos necessários não encontrados no card:', card);
            return;
        }
        
        // Salva os botões de ação originais
        const actionButtons = card.querySelector('.order-actions');
        
        // Salva o conteúdo original
        const originalContent = mainContent.innerHTML;
        
        // Limpa o conteúdo existente
        mainContent.innerHTML = '';
        
        // Cria a visualização compacta
        const compactView = document.createElement('div');
        compactView.className = 'compact-view';
        compactView.innerHTML = `
            <div class="compact-row">
                <div class="compact-item customer">
                    <i class="fas fa-user"></i>
                    <span>${customerName}</span>
                </div>
                <div class="compact-item order-type">
                    <i class="${orderTypeIcon}"></i>
                    <span>${orderTypeText}</span>
                </div>
            </div>
            <div class="compact-row">
                <div class="compact-item payment">
                    <i class="${paymentIcon}"></i>
                    <span>${paymentText}</span>
                </div>
                <div class="compact-item total">
                    <i class="fas fa-receipt"></i>
                    <span>${totalText}</span>
                </div>
            </div>
        `;
        
        // Adiciona a visualização compacta ao conteúdo
        mainContent.appendChild(compactView);
        
        // Move o código de coleta para área compacta, se existir
        const pickupCode = card.querySelector('.pickup-code');
        if (pickupCode) {
            mainContent.appendChild(pickupCode);
        }
        
        // Adiciona botão de expansão
        const expandButton = document.createElement('button');
        expandButton.className = 'expand-button';
        expandButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
        expandButton.setAttribute('title', 'Expandir detalhes');
        headerContent.appendChild(expandButton);
        
        // Cria a área de conteúdo expandido
        const expandedContent = document.createElement('div');
        expandedContent.className = 'expanded-content hidden';
        
        // Reorganiza o conteúdo original para o expandido
        expandedContent.innerHTML = originalContent;
        
        // Certifica-se de que os botões de ação estão presentes
        if (actionButtons && !expandedContent.querySelector('.order-actions')) {
            expandedContent.appendChild(actionButtons);
        }
        
        // Adiciona a área expandida ao card
        card.appendChild(expandedContent);
        
        // Adiciona evento de clique ao botão de expansão
        expandButton.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Alterna a visibilidade do conteúdo expandido
            expandedContent.classList.toggle('hidden');
            
            // Alterna o ícone
            const icon = expandButton.querySelector('i');
            if (expandedContent.classList.contains('hidden')) {
                icon.className = 'fas fa-chevron-down';
                expandButton.setAttribute('title', 'Expandir detalhes');
            } else {
                icon.className = 'fas fa-chevron-up';
                expandButton.setAttribute('title', 'Recolher detalhes');
            }
        });
        
        // Adiciona evento de clique ao card
        card.addEventListener('click', function(e) {
            // Evita conflito com botões de ação
            if (!e.target.closest('.action-button') && !e.target.closest('.expand-button')) {
                expandButton.click();
            }
        });
    } catch (error) {
        console.error('❌ Erro ao melhorar card:', error);
    }
}

// Para garantir que os cards sejam melhorados mesmo após mudanças de tab ou filtros
// Observa mudanças no DOM para pegar novos cards que possam aparecer
function setupMutationObserver() {
    // Configuração do observador
    const config = { 
        childList: true,
        subtree: true 
    };
    
    // Callback para quando ocorrem mudanças
    const callback = function(mutationsList, observer) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                // Verifica se algum novo card de pedido foi adicionado
                setTimeout(() => {
                    enhanceExistingCards();
                }, 100);
            }
        }
    };
    
    // Cria um observador com a callback
    const observer = new MutationObserver(callback);
    
    // Começa a observar o documento com a configuração especificada
    observer.observe(document.body, config);
    
    console.log('✅ Observador de mudanças configurado');
}

// Inicia o observador de mutações após o carregamento da página
window.addEventListener('load', setupMutationObserver);

// Adiciona listeners para quando usuário muda de tab ou aplica filtros
document.addEventListener('DOMContentLoaded', function() {
    // Listener para mudança de tabs
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            setTimeout(enhanceExistingCards, 100);
        });
    });
    
    // Listener para filtros
    document.querySelectorAll('.filter-button').forEach(button => {
        button.addEventListener('click', () => {
            setTimeout(enhanceExistingCards, 100);
        });
    });
});
