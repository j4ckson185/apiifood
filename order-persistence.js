// order-persistence.js

// Constantes
const STORAGE_KEY = 'ifood_orders';
const STATUS_POLLING_INTERVAL = 30000; // 30 segundos

// Função para salvar pedidos no localStorage
function saveOrdersToStorage(orders) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch (error) {
        console.error('Erro ao salvar pedidos:', error);
    }
}

// Função para carregar pedidos do localStorage
function loadOrdersFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        return {};
    }
}

// Função para adicionar ou atualizar um pedido
function updateStoredOrder(order) {
    const orders = loadOrdersFromStorage();
    orders[order.id] = {
        ...order,
        lastUpdated: new Date().toISOString()
    };
    saveOrdersToStorage(orders);
}

// Função para remover pedidos antigos (mais de 24h)
function cleanOldOrders() {
    const orders = loadOrdersFromStorage();
    const now = new Date();
    const filteredOrders = Object.entries(orders).reduce((acc, [id, order]) => {
        const orderDate = new Date(order.lastUpdated);
        if (now - orderDate < 24 * 60 * 60 * 1000) { // 24 horas
            acc[id] = order;
        }
        return acc;
    }, {});
    saveOrdersToStorage(filteredOrders);
}

// Função para carregar pedidos salvos na interface
function loadSavedOrders() {
    const orders = loadOrdersFromStorage();
    Object.values(orders).forEach(order => {
        // Verifica se o pedido já existe na interface
        const existingOrder = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
        if (!existingOrder) {
            displayOrder(order);
        }
    });
}

// Função para monitorar status dos pedidos
async function monitorOrderStatus() {
    const orders = loadOrdersFromStorage();
    
    for (const [orderId, order] of Object.entries(orders)) {
        try {
            const response = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
            
            if (response && response.status !== order.status) {
                console.log(`Status atualizado para pedido ${orderId}: ${response.status}`);
                
                // Atualiza o status na interface
                updateOrderStatus(orderId, response.status);
                
                // Atualiza o pedido no storage
                updateStoredOrder({
                    ...order,
                    status: response.status
                });
            }
        } catch (error) {
            console.error(`Erro ao verificar status do pedido ${orderId}:`, error);
        }
    }
}

// Modificar a função handleEvent existente no script.js
// Adicionar após o processamento do evento:
function modifiedHandleEvent(event) {
    // ... código existente ...
    
    if (event.orderId) {
        makeAuthorizedRequest(`/order/v1.0/orders/${event.orderId}`, 'GET')
            .then(orderDetails => {
                updateStoredOrder(orderDetails);
                
                // Se o pedido já existe na interface, apenas atualiza o status
                const existingOrder = document.querySelector(`.order-card[data-order-id="${orderDetails.id}"]`);
                if (existingOrder) {
                    updateOrderStatus(orderDetails.id, orderDetails.status);
                } else {
                    displayOrder(orderDetails);
                }
            })
            .catch(error => {
                console.error(`Erro ao buscar detalhes do pedido ${event.orderId}:`, error);
            });
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Carrega pedidos salvos
    loadSavedOrders();
    
    // Limpa pedidos antigos
    cleanOldOrders();
    
    // Inicia monitoramento de status
    setInterval(monitorOrderStatus, STATUS_POLLING_INTERVAL);
});

// Intercepta novos pedidos
const originalDisplayOrder = window.displayOrder;
window.displayOrder = function(order) {
    updateStoredOrder(order);
    return originalDisplayOrder.call(this, order);
};
