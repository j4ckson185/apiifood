// Funções para gerenciar o status da loja
let statusPollingInterval = null;

// Função para obter o status da loja
async function fetchStoreStatus(merchantId) {
    try {
        console.log('🔍 Buscando status da loja:', merchantId);
        
        if (!state.accessToken) {
            console.log('❌ Token de acesso não disponível');
            return null;
        }
        
        const response = await makeAuthorizedRequest(`/merchant/v1.0/merchants/${merchantId}/status`, 'GET');
        console.log('✅ Status da loja recebido:', response);
        
        return response;
    } catch (error) {
        console.error('❌ Erro ao obter status da loja:', error);
        return null;
    }
}

// Função para exibir o status da loja na interface
function displayStoreStatus(status) {
    // Busca o elemento de detalhes da loja onde o status será exibido
    const storeDetails = document.getElementById('store-details');
    if (!storeDetails) {
        console.error('Elemento store-details não encontrado');
        return;
    }

    // Remove qualquer elemento de status anterior se existir
    const existingStatus = document.getElementById('store-status-details');
    if (existingStatus) {
        existingStatus.remove();
    }

    // Cria o elemento de status
    const statusElement = document.createElement('div');
    statusElement.id = 'store-status-details';
    statusElement.className = 'store-detail-row';

    // Define o conteúdo baseado na resposta da API
    let statusText = 'Desconhecido';
    let statusClass = '';
    let additionalInfo = '';

    if (status) {
        console.log('Processando status:', status);
        
        // Verifica se o status é um array (como na resposta da API)
        if (Array.isArray(status) && status.length > 0) {
            // Verifica o status do primeiro canal (normalmente o ifood-app)
            const channel = status[0];
            
            if (channel.available === true) {
                statusText = 'Aberta';
                statusClass = 'status-online';
            } else {
                statusText = 'Fechada';
                statusClass = 'status-offline';
            }
            
            // Adiciona informações adicionais
            if (channel.state) {
                additionalInfo += ` (Estado: ${channel.state})`;
            }
            
            if (channel.salesChannel) {
                additionalInfo += ` Canal: ${channel.salesChannel}`;
            }
            
            if (channel.operation) {
                additionalInfo += ` Operação: ${channel.operation}`;
            }
        } 
        // Caso a API retorne um único objeto em vez de um array
        else if (status.available !== undefined) {
            if (status.available === true) {
                statusText = 'Aberta';
                statusClass = 'status-online';
            } else {
                statusText = 'Fechada';
                statusClass = 'status-offline';
            }
            
            // Adiciona informações adicionais se disponíveis
            if (status.reason) {
                additionalInfo += ` (${status.reason})`;
            }
        }
    }

    statusElement.innerHTML = `
        <span class="store-detail-label">Status da Loja:</span>
        <span class="store-detail-value ${statusClass}">${statusText}</span>
        <span class="status-additional">${additionalInfo}</span>
    `;

    // Adiciona o elemento ao detalhe da loja (após o primeiro elemento)
    if (storeDetails.firstChild) {
        storeDetails.insertBefore(statusElement, storeDetails.children[1]);
    } else {
        storeDetails.appendChild(statusElement);
    }
}

// Função para iniciar polling de status
function startStatusPolling(merchantId) {
    // Para qualquer polling anterior se existir
    stopStatusPolling();
    
    // Busca o status imediatamente
    fetchStoreStatus(merchantId).then(status => {
        displayStoreStatus(status);
    });
    
    // Configura o polling a cada 30 segundos
    statusPollingInterval = setInterval(() => {
        fetchStoreStatus(merchantId).then(status => {
            displayStoreStatus(status);
        });
    }, 30000); // 30 segundos
}

// Função para parar o polling
function stopStatusPolling() {
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        statusPollingInterval = null;
    }
}

// Adicionando CSS para os status
const styleElement = document.createElement('style');
styleElement.textContent = `
    .status-online {
        color: var(--success-color);
        font-weight: bold;
    }
    
    .status-offline {
        color: var(--danger-color);
        font-weight: bold;
    }
    
    #store-status-details {
        background-color: var(--light-gray);
        padding: 10px;
        border-radius: var(--border-radius);
        margin-bottom: 10px;
    }
`;
document.head.appendChild(styleElement);
