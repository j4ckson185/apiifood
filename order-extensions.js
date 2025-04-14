// Extensões para funcionalidades pendentes de pedidos no PDV iFood
// Este arquivo complementa o script.js existente e adiciona suporte para:
// 1. Pedidos agendados (SCHEDULED)
// 2. Melhor tratamento para pedidos para retirar (TAKEOUT)
// 3. Exibição do código de coleta

// Aguarda o carregamento do script principal
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 Carregando extensões de pedidos...');
    
    // Verifica se a função displayOrder existe
    if (typeof window.displayOrder !== 'function') {
        console.error('❌ Função displayOrder não encontrada. Extensões não serão aplicadas.');
        return;
    }
    
    // Backup da função original para estender
    const originalDisplayOrder = window.displayOrder;
    
    // Estende a função displayOrder para adicionar nossas novas funcionalidades
    window.displayOrder = function(order) {
        // Primeiro, deixa a função original executar
        const result = originalDisplayOrder(order);
        
        // Depois, adiciona nossas extensões
        try {
            // Busca o card que acabou de ser criado
            const orderCard = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
            if (!orderCard) {
                console.log('❌ Card do pedido não encontrado para extensões');
                return result;
            }
            
            // 1. Tratamento para pedidos agendados
            if (order.orderTiming === 'SCHEDULED' && order.scheduledDateTimeForDelivery) {
                addScheduledInfo(orderCard, order);
            }
            
            // 2. Melhor tratamento para pedidos para retirar
            if (order.orderType === 'TAKEOUT' || (order.takeout && order.takeout.mode)) {
                enhanceTakeoutInfo(orderCard, order);
            }
            
            // 3. Adiciona código de coleta
            addPickupCode(orderCard, order);
            
            console.log('✅ Extensões aplicadas ao pedido:', order.id);
        } catch (error) {
            console.error('❌ Erro ao aplicar extensões ao pedido:', error);
        }
        
        return result;
    };
    
    console.log('✅ Extensões de pedidos carregadas com sucesso');
});

// 1. Adiciona informações de agendamento ao card do pedido
function addScheduledInfo(orderCard, order) {
    if (!order.scheduledDateTimeForDelivery) return;
    
    try {
        // Cria elemento para exibir data e hora agendadas
        const scheduledDate = new Date(order.scheduledDateTimeForDelivery);
        const formattedDate = scheduledDate.toLocaleDateString('pt-BR');
        const formattedTime = scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const scheduledDiv = document.createElement('div');
        scheduledDiv.className = 'scheduled-info';
        
        const scheduledTitle = document.createElement('h3');
        scheduledTitle.textContent = 'Pedido Agendado';
        scheduledDiv.appendChild(scheduledTitle);
        
        const scheduledText = document.createElement('p');
        scheduledText.innerHTML = `<span class="scheduled-date">📅 ${formattedDate}</span> <span class="scheduled-time">⏰ ${formattedTime}</span>`;
        scheduledDiv.appendChild(scheduledText);
        
        // Adiciona um destaque visual ao pedido agendado
        orderCard.classList.add('scheduled-order');
        
        // Busca onde inserir - após informações de tipo de pedido
        const orderTypeDiv = orderCard.querySelector('.order-type');
        if (orderTypeDiv) {
            orderTypeDiv.parentNode.insertBefore(scheduledDiv, orderTypeDiv.nextSibling);
        } else {
            // Caso não encontre, insere após as informações do cliente
            const customerInfo = orderCard.querySelector('.customer-info');
            if (customerInfo) {
                customerInfo.parentNode.insertBefore(scheduledDiv, customerInfo.nextSibling);
            }
        }
        
        console.log('✅ Informações de agendamento adicionadas ao pedido:', order.id);
    } catch (error) {
        console.error('❌ Erro ao adicionar informações de agendamento:', error);
    }
}

// 2. Melhora as informações de pedidos para retirar
function enhanceTakeoutInfo(orderCard, order) {
    try {
        // Verifica se as informações de takeout existem
        if (!order.takeout) return;
        
        // Busca ou cria o elemento para informações de retirada
        let takeoutDiv = orderCard.querySelector('.takeout-info');
        
        if (!takeoutDiv) {
            takeoutDiv = document.createElement('div');
            takeoutDiv.className = 'takeout-info';
            
            const takeoutTitle = document.createElement('h3');
            takeoutTitle.textContent = 'Informações para Retirada';
            takeoutDiv.appendChild(takeoutTitle);
            
            // Adiciona após as informações do cliente ou tipo de pedido
            const orderTypeDiv = orderCard.querySelector('.order-type');
            if (orderTypeDiv) {
                orderTypeDiv.parentNode.insertBefore(takeoutDiv, orderTypeDiv.nextSibling);
            } else {
                const customerInfo = orderCard.querySelector('.customer-info');
                if (customerInfo) {
                    customerInfo.parentNode.insertBefore(takeoutDiv, customerInfo.nextSibling);
                }
            }
        }
        
        // Adiciona informações de modo de retirada
        if (order.takeout.mode) {
            const modeText = document.createElement('p');
            modeText.innerHTML = `<strong>Modo:</strong> ${getModeText(order.takeout.mode)}`;
            takeoutDiv.appendChild(modeText);
        }
        
        // Adiciona nome de quem vai retirar
        if (order.takeout.retrieverName) {
            const retrieverText = document.createElement('p');
            retrieverText.innerHTML = `<strong>Quem retira:</strong> ${order.takeout.retrieverName}`;
            takeoutDiv.appendChild(retrieverText);
        }
        
        // Adiciona horário de retirada (se for agendado)
        if (order.takeout.takeoutDatetime) {
            const takeoutDate = new Date(order.takeout.takeoutDatetime);
            const formattedTakeoutTime = takeoutDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            const takeoutTimeText = document.createElement('p');
            takeoutTimeText.innerHTML = `<strong>Horário:</strong> ${formattedTakeoutTime}`;
            takeoutDiv.appendChild(takeoutTimeText);
        }
        
        // Adiciona um estilo especial para pedidos de retirada
        orderCard.classList.add('takeout-order');
        
        console.log('✅ Informações de retirada melhoradas para o pedido:', order.id);
    } catch (error) {
        console.error('❌ Erro ao melhorar informações de retirada:', error);
    }
}

// 3. Adiciona código de coleta ao card do pedido
function addPickupCode(orderCard, order) {
    try {
// Verifica se o código existe em diferentes locais possíveis na API
let pickupCode = null;

if (order.pickupCode) {
    pickupCode = order.pickupCode;
} else if (order.takeout && order.takeout.code) {
    pickupCode = order.takeout.code;
} else if (order.displayId) {
    pickupCode = order.displayId;
} else if (order.code) {
    pickupCode = order.code;
} else if (order.shortId) {
    pickupCode = order.shortId;
}
        
        // Se não encontrou código, usa os últimos 4 caracteres do ID
        if (!pickupCode && order.id) {
            pickupCode = order.id.substring(order.id.length - 4).toUpperCase();
        }
        
        if (!pickupCode) return;
        
        // Cria elemento para o código de coleta
        const pickupCodeDiv = document.createElement('div');
        pickupCodeDiv.className = 'pickup-code';
        
        const pickupCodeTitle = document.createElement('h3');
        pickupCodeTitle.textContent = 'Código de Coleta';
        pickupCodeDiv.appendChild(pickupCodeTitle);
        
        const codeDisplay = document.createElement('div');
        codeDisplay.className = 'code-display';
        codeDisplay.textContent = pickupCode;
        pickupCodeDiv.appendChild(codeDisplay);
        
        // Insere após o header do card
        const orderHeader = orderCard.querySelector('.order-header');
        if (orderHeader) {
            orderHeader.parentNode.insertBefore(pickupCodeDiv, orderHeader.nextSibling);
        } else {
            // Fallback: adiciona no início do conteúdo
            const orderContent = orderCard.querySelector('.order-content');
            if (orderContent && orderContent.firstChild) {
                orderContent.insertBefore(pickupCodeDiv, orderContent.firstChild);
            }
        }
        
        console.log('✅ Código de coleta adicionado ao pedido:', order.id);
    } catch (error) {
        console.error('❌ Erro ao adicionar código de coleta:', error);
    }
}

// Função auxiliar para traduzir o modo de retirada
function getModeText(mode) {
    const modeMap = {
        'TAKEOUT': 'Retirada no Balcão',
        'CURBSIDE': 'Retirada na Calçada',
        'DRIVE_THRU': 'Drive-Thru'
    };
    
    return modeMap[mode] || mode;
}

// Adiciona estilos CSS para as novas funcionalidades
(function addExtensionStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Estilos para pedidos agendados */
        .scheduled-info {
            background-color: #fff3cd;
            padding: 0.75rem;
            border-radius: var(--border-radius);
            margin: 0.75rem 0;
            border-left: 3px solid #ffc107;
        }
        
        .scheduled-order {
            border-left: 4px solid #9c27b0 !important;
        }
        
        .scheduled-date, .scheduled-time {
            font-weight: bold;
            margin-right: 10px;
        }
        
        /* Estilos para pedidos para retirar */
        .takeout-info {
            background-color: #e0f7fa;
            padding: 0.75rem;
            border-radius: var(--border-radius);
            margin: 0.75rem 0;
            border-left: 3px solid #00bcd4;
        }
        
        .takeout-order {
            border-left: 4px solid #00bcd4 !important;
        }
        
        /* Estilos para código de coleta */
        .pickup-code {
            margin: 0.75rem 0;
            text-align: center;
        }
        
        .code-display {
            font-size: 1.5rem;
            font-weight: bold;
            background-color: #f8f9fa;
            padding: 0.5rem 1rem;
            border-radius: var(--border-radius);
            display: inline-block;
            letter-spacing: 2px;
            border: 2px dashed #aaa;
        }
    `;
    document.head.appendChild(styleElement);
})();
