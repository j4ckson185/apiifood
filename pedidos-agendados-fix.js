/**
 * SOLUÇÃO COMPLETA PARA PERSISTÊNCIA DE PEDIDOS AGENDADOS
 * 
 * Este código deve ser adicionado como um novo arquivo: "pedidos-agendados-fix.js"
 * O arquivo deve ser carregado APÓS o orders-persistence.js e scheduled-order-modal.js
 */

// Função auto-executável para não poluir o escopo global
(function() {
    console.log('🔧 Aplicando correção para persistência de pedidos agendados...');
    
    // Verifica se as funções necessárias existem
    if (!window.ordersCache || typeof window.saveOrdersToLocalStorage !== 'function') {
        console.error('❌ Funções necessárias não encontradas, a correção não pode ser aplicada');
        return;
    }
    
    // -------------------------------------------------
    // 1. MODIFICAÇÕES NA PERSISTÊNCIA DE PEDIDOS
    // -------------------------------------------------
    
    // Salva a função original
    const originalSaveOrdersToLocalStorage = window.saveOrdersToLocalStorage;
    
    // Sobrescreve a função para incluir pedidos agendados
    window.saveOrdersToLocalStorage = function() {
        // Busca todos os containers de pedidos, incluindo pedidos agendados
        const containers = [
            'preparation-orders',
            'dispatched-orders',
            'completed-orders',
            'cancelled-orders',
            'scheduled-orders'  // Adicionamos o container de pedidos agendados
        ];
        
        const savedOrders = {};
        
        containers.forEach(containerId => {
            savedOrders[containerId] = [];
            const container = document.getElementById(containerId);
            
            if (container) {
                // Para cada pedido no container
                container.querySelectorAll('.order-card').forEach(card => {
                    const orderId = card.getAttribute('data-order-id');
                    const orderData = window.ordersCache[orderId]; 
                    
                    if (orderData) {
                        // Adiciona uma propriedade para identificar o container
                        const orderDataWithContainer = { ...orderData, _container: containerId };
                        savedOrders[containerId].push(orderDataWithContainer);
                    }
                });
            }
        });
        
        localStorage.setItem('savedOrders', JSON.stringify(savedOrders));
        localStorage.setItem('lastSave', new Date().toISOString());
        console.log('📦 Pedidos salvos no localStorage, incluindo agendados');
    };
    
    // Salva a função original de carregamento
    const originalLoadOrdersFromLocalStorage = window.loadOrdersFromLocalStorage;
    
    // Sobrescreve a função para lidar com pedidos agendados
    window.loadOrdersFromLocalStorage = function() {
        const savedOrders = JSON.parse(localStorage.getItem('savedOrders'));
        
        if (!savedOrders) {
            console.log('❌ Nenhum pedido salvo encontrado no localStorage');
            return;
        }
        
        console.log('🔄 Carregando pedidos salvos do localStorage (modificado)');
        
        // Restaura os pedidos de cada container
        Object.keys(savedOrders).forEach(containerId => {
            const ordersList = savedOrders[containerId];
            console.log(`📂 Container ${containerId}: ${ordersList.length} pedidos`);
            
            // Para cada pedido salvo neste container
            ordersList.forEach(order => {
                if (order && order.id) {
                    // Verifica se já existe na interface
                    const existingOrder = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
                    if (!existingOrder) {
                        console.log(`⏳ Restaurando pedido: ${order.id} (Container: ${containerId})`);
                        
                        // Adiciona ao cache primeiro
                        window.ordersCache[order.id] = order;
                        
                        // Exibe na interface com base no container
                        if (containerId === 'scheduled-orders' && 
                            typeof window.displayScheduledOrder === 'function' && 
                            typeof window.isScheduledOrder === 'function' && 
                            window.isScheduledOrder(order)) {
                            // Usa a função específica para pedidos agendados
                            window.displayScheduledOrder(order);
                            console.log(`✅ Pedido agendado ${order.id} restaurado`);
                        } else {
                            // Usa a função padrão para outros pedidos
                            // Mas desabilita temporariamente o salvamento para evitar loop
                            const tempSave = window.saveOrdersToLocalStorage;
                            window.saveOrdersToLocalStorage = function() {}; // Função vazia
                            
                            // Exibe o pedido
                            window.displayOrder(order);
                            
                            // Restaura a função de salvamento
                            window.saveOrdersToLocalStorage = tempSave;
                            
                            console.log(`✅ Pedido ${order.id} restaurado para ${containerId}`);
                        }
                        
                        // Marca como já processado
                        if (window.processedOrderIds && !window.processedOrderIds.has(order.id)) {
                            window.processedOrderIds.add(order.id);
                            if (typeof window.saveProcessedIds === 'function') {
                                window.saveProcessedIds();
                            }
                        }
                    }
                }
            });
        });
        
        // Verifica se há pedidos em cada tab
        ['preparation', 'dispatched', 'completed', 'cancelled', 'scheduled'].forEach(tabId => {
            if (typeof window.checkForEmptyTab === 'function') {
                window.checkForEmptyTab(tabId);
            }
        });
        
        console.log('✅ Carregamento de pedidos concluído');
    };
    
    // -------------------------------------------------
    // 2. MODIFICAÇÕES NA FUNÇÃO DISPLAY_ORDER
    // -------------------------------------------------
    
    // Salva a função original
    const originalDisplayOrder = window.displayOrder;
    
    // Sobrescreve a função para lidar com pedidos agendados
    window.displayOrder = function(order) {
        // Adiciona ao cache
        window.ordersCache[order.id] = order;
        
        // Verifica se é um pedido agendado que deve ir para a aba específica
        if (typeof window.isScheduledOrder === 'function' && window.isScheduledOrder(order)) {
            const now = new Date();
            const prepTime = typeof window.calculatePrepTime === 'function' ? 
                            window.calculatePrepTime(order) : null;
            
            // Se ainda não está na hora de preparar, exibe na aba de agendados
            if (prepTime && now < prepTime) {
                if (typeof window.displayScheduledOrder === 'function') {
                    // Verifica se o pedido já existe na interface
                    const existingOrder = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
                    if (!existingOrder) {
                        window.displayScheduledOrder(order);
                        console.log(`📅 Pedido agendado ${order.id} exibido na aba específica`);
                        
                        // Salva no localStorage
                        window.saveOrdersToLocalStorage();
                        
                        return true;
                    }
                }
            }
        }
        
        // Se não for agendado ou já estiver na hora de preparar, usa a função original
        originalDisplayOrder(order);
        
        // Salva no localStorage
        window.saveOrdersToLocalStorage();
    };
    
    // -------------------------------------------------
    // 3. ADICIONA FUNÇÃO DE RESTAURAÇÃO AUTOMÁTICA
    // -------------------------------------------------
    
    // Cria função para restaurar pedidos agendados
    function restaurarPedidosAgendados() {
        console.log('🔄 Restaurando especificamente pedidos agendados...');
        
        // Obtém todos os pedidos do cache
        const pedidos = Object.values(window.ordersCache || {});
        
        // Filtra apenas os pedidos agendados que ainda não estão na interface
        const pedidosAgendados = pedidos.filter(order => {
            // Verifica se o pedido é agendado
            if (!order || typeof window.isScheduledOrder !== 'function' || 
                !window.isScheduledOrder(order)) {
                return false;
            }
            
            // Verifica se o pedido já está na interface
            const existingOrder = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
            if (existingOrder) {
                return false;
            }
            
            // Verifica se ainda não está na hora de preparar
            const now = new Date();
            const prepTime = typeof window.calculatePrepTime === 'function' ? 
                            window.calculatePrepTime(order) : null;
            
            return prepTime && now < prepTime;
        });
        
        console.log(`🔍 Encontrados ${pedidosAgendados.length} pedidos agendados para restaurar`);
        
        // Exibe cada pedido na aba de agendados
        pedidosAgendados.forEach(order => {
            if (typeof window.displayScheduledOrder === 'function') {
                window.displayScheduledOrder(order);
                console.log(`✅ Pedido agendado ${order.id} restaurado`);
            }
        });
        
        // Verifica se a aba de agendados está vazia
        if (typeof window.checkForEmptyTab === 'function') {
            window.checkForEmptyTab('scheduled');
        }
        
        // Se encontrou pedidos, força o salvamento
        if (pedidosAgendados.length > 0 && typeof window.saveOrdersToLocalStorage === 'function') {
            window.saveOrdersToLocalStorage();
        }
    }
    
    // Adiciona a função ao escopo global (para uso direto se necessário)
    window.restaurarPedidosAgendados = restaurarPedidosAgendados;
    
    // -------------------------------------------------
    // 4. MODIFICAÇÕES NO MÓDULO DE PEDIDOS AGENDADOS
    // -------------------------------------------------
    
    // Tenta estender o módulo se ele existir
    if (window.scheduledOrdersModule) {
        console.log('🔄 Estendendo módulo de pedidos agendados existente...');
        
        // Guarda a função original
        const originalDisplayScheduledOrder = window.displayScheduledOrder;
        
        // Sobrescreve para garantir persistência
        window.displayScheduledOrder = function(order) {
            // Verifica se o pedido já existe na interface
            const existingOrder = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
            if (existingOrder) {
                console.log(`⚠️ Pedido ${order.id} já existe na interface, ignorando duplicação`);
                return;
            }
            
            // Adiciona ao cache global
            window.ordersCache[order.id] = order;
            
            // Chama a função original
            originalDisplayScheduledOrder(order);
            
            // Força o salvamento
            if (typeof window.saveOrdersToLocalStorage === 'function') {
                setTimeout(window.saveOrdersToLocalStorage, 100);
            }
        };
    }
    
    // -------------------------------------------------
    // 5. INICIALIZAÇÃO AUTOMÁTICA
    // -------------------------------------------------
    
    // Executa a restauração ao carregar a página, após um atraso 
    // para garantir que todos os componentes foram inicializados
    window.addEventListener('load', () => {
        console.log('🚀 Configurando inicialização automática de pedidos agendados...');
        
        // Primeiro tenta o carregamento padrão
        setTimeout(() => {
            if (typeof window.loadOrdersFromLocalStorage === 'function') {
                window.loadOrdersFromLocalStorage();
            }
            
            // Depois verifica especificamente os pedidos agendados
            setTimeout(restaurarPedidosAgendados, 1000);
        }, 2000);
    });
    
    console.log('✅ Correção para persistência de pedidos agendados aplicada com sucesso!');
})();
