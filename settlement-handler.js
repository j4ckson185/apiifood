// Módulo para tratamento de eventos HANDSHAKE_SETTLEMENT e histórico de negociações
// Este arquivo complementa o negociacao.js existente adicionando:
// 1. Tratamento do evento HANDSHAKE_SETTLEMENT
// 2. Armazenamento do histórico de negociações
// 3. Exibição do resumo de negociações no modal padrão
// 4. Fallback por polling para disputas
// 5. Timeout automático

// Estado para armazenar histórico de negociações resolvidas
let resolvedDisputes = [];

// Estado para controle do polling de disputas
let isDisputePollingActive = false;
const DISPUTE_POLLING_INTERVAL = 60000; // 1 minuto

// Carrega disputas resolvidas do localStorage na inicialização
function loadResolvedDisputes() {
    try {
        const saved = localStorage.getItem('resolvedDisputes');
        if (saved) {
            resolvedDisputes = JSON.parse(saved);
            console.log('📋 Disputas resolvidas carregadas:', resolvedDisputes.length);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar disputas resolvidas:', error);
        resolvedDisputes = [];
    }
}

// Salva disputas resolvidas no localStorage
function saveResolvedDisputes() {
    try {
        localStorage.setItem('resolvedDisputes', JSON.stringify(resolvedDisputes));
        console.log('✅ Disputas resolvidas salvas:', resolvedDisputes.length);
    } catch (error) {
        console.error('❌ Erro ao salvar disputas resolvidas:', error);
    }
}

// Verifica se a disputa é relacionada a atraso
function isDelayDispute(dispute) {
    if (!dispute) return false;
    
    // Verifica o tipo da disputa
    const delayTypes = [
        'PREPARATION_TIME',
        'ORDER_LATE',
        'DELAY',
        'CANCELLATION_WITH_DELAY_PROPOSAL'
    ];
    
    return delayTypes.includes(dispute.type) || 
           delayTypes.includes(dispute.metadata?.handshakeType) ||
           (dispute.metadata?.message && 
            dispute.metadata.message.toLowerCase().includes('atraso'));
}

// Função que busca novas disputas via polling (fallback)
async function pollForNewDisputes() {
    if (!isDisputePollingActive || !state.accessToken) return;
    
    try {
        console.log('🔍 Buscando novas disputas via polling...');
        
        // Busca eventos recentes
        const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET');
        
        if (events && Array.isArray(events)) {
            // Filtra apenas eventos HANDSHAKE_DISPUTE
            const disputeEvents = events.filter(event => 
                event.code === 'HANDSHAKE_DISPUTE' || 
                event.fullCode === 'HANDSHAKE_DISPUTE'
            );
            
            // Processa cada disputa encontrada
            for (const event of disputeEvents) {
                // Verifica se já temos essa disputa
                const existingDispute = activeDisputes.find(d => d.disputeId === event.disputeId);
                
                if (!existingDispute) {
                    console.log('🆕 Nova disputa encontrada via polling:', event);
                    await processarEventoDisputa(event);
                }
            }
            
            // Envia acknowledgment
            if (events.length > 0) {
                const acknowledgeFormat = events.map(event => ({ id: event.id }));
                await makeAuthorizedRequest('/events/v1.0/events/acknowledgment', 'POST', acknowledgeFormat);
            }
        }
    } catch (error) {
        console.error('❌ Erro no polling de disputas:', error);
    } finally {
        // Agenda próximo polling
        if (isDisputePollingActive) {
            setTimeout(pollForNewDisputes, DISPUTE_POLLING_INTERVAL);
        }
    }
}

// Função que inicia o polling de disputas
function startDisputePolling() {
    if (!isDisputePollingActive) {
        isDisputePollingActive = true;
        console.log('🔄 Iniciando polling de disputas...');
        pollForNewDisputes();
    }
}

// Função que para o polling de disputas
function stopDisputePolling() {
    isDisputePollingActive = false;
    console.log('⏹️ Polling de disputas parado');
}

// Função principal para tratar eventos HANDSHAKE_SETTLEMENT
async function handleSettlementEvent(event) {
    try {
        console.log('🔍 Processando evento HANDSHAKE_SETTLEMENT:', event);
        
        // Extrair o disputeId e orderId adequadamente
        const disputeId = event.disputeId || event.metadata?.disputeId;
        const orderId = event.orderId;
        
        if (!orderId) {
            console.error('❌ Evento HANDSHAKE_SETTLEMENT inválido (sem orderId):', event);
            return;
        }
        
        console.log(`🔍 Processando HANDSHAKE_SETTLEMENT para pedido ${orderId} e disputa ${disputeId || 'desconhecida'}`);
        
        // Traduz o status do settlement
        const statusMap = {
            'ACCEPTED': 'ACEITA',
            'REJECTED': 'REJEITADA',
            'ALTERNATIVE_OFFERED': 'ALTERNATIVA OFERECIDA',
            'ALTERNATIVE_REPLIED': 'ALTERNATIVA ACEITA',
            'EXPIRED': 'EXPIRADA'
        };
        
        // Busca detalhes da disputa original mesmo se disputeId for undefined
        const originalDispute = disputeId ? activeDisputes.find(d => d.disputeId === disputeId) : null;
        
        // Cria registro da disputa resolvida
        const resolvedDispute = {
            orderId: orderId,
            disputeId: disputeId || 'unknown',
            statusFinal: statusMap[event.metadata?.status] || event.metadata?.status || 'DESCONHECIDO',
            tipoDeResposta: originalDispute?.responseType || 'NÃO ESPECIFICADO',
            dataConclusao: new Date().toISOString(),
            detalhesResposta: originalDispute?.responseDetails || {},
            isDelayRelated: isDelayDispute(originalDispute)
        };
        
        // Remove qualquer registro anterior da mesma disputa se houver disputeId
        if (disputeId) {
            resolvedDisputes = resolvedDisputes.filter(d => d.disputeId !== disputeId);
        }
        
        // Adiciona o novo registro
        resolvedDisputes.push(resolvedDispute);
        
        // Salva no localStorage
        saveResolvedDisputes();
        
        // Remove da lista de disputas ativas se tiver disputeId
        if (disputeId) {
            removeActiveDispute(disputeId);
        }
        
        // Fecha o modal de negociação se estiver aberto
        fecharModalNegociacao();
        
        // Atualiza a interface
        const orderCard = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
        if (orderCard) {
            addNegotiationSummaryButton(orderCard, resolvedDispute);
            
            // IMPORTANTE: Forçar a restauração dos botões de ação independente do disputeId
            setTimeout(() => {
                restoreOrderButtons(orderId);
            }, 1000);
        }
        
        // Atualiza o status do pedido somente se for cancelamento aceito de fato
        const settlementStatus = event.metadata?.status || 'UNKNOWN';
        
        if (
            settlementStatus === 'ACCEPTED' &&
            originalDispute?.type === 'CANCELLATION'
        ) {
            updateOrderStatus(orderId, 'CANCELLED');
        }
        
        // Exibe notificação
        showToast(`Negociação ${resolvedDispute.statusFinal.toLowerCase()}`, 'info');
        
        console.log('✅ Evento HANDSHAKE_SETTLEMENT processado:', resolvedDispute);
    } catch (error) {
        console.error('❌ Erro ao processar HANDSHAKE_SETTLEMENT:', error);
    }
}

// Estende a função addActionButtons do cores-modal-pedidos.js
const originalAddActionButtons = window.addActionButtons;
window.addActionButtons = function(container, dispute) {
    // Se for disputa por atraso, modifica o container antes de adicionar botões
if (isDelayDispute(dispute)) {
    setTimeout(() => {
        const rejectBtn = document.querySelector('.modal-negociacao-footer .action-button.reject');
        if (rejectBtn) {
            rejectBtn.remove(); // Remove mesmo que ele tenha sido re-inserido depois
            console.log('⛔ Botão de rejeição removido para disputa por atraso');
        }
    }, 100); // delay suficiente pra garantir que tudo foi renderizado
}


    // Chama função original
    return originalAddActionButtons(container, dispute);
};

// Função para adicionar botão de resumo da negociação ao card do pedido
function addNegotiationSummaryButton(orderCard, dispute) {
    // Remove botão existente se houver
    const existingButton = orderCard.querySelector('.ver-resumo-negociacao');
    if (existingButton) {
        existingButton.remove();
    }
    
    // Cria novo botão
    const actionsContainer = orderCard.querySelector('.order-actions');
    if (actionsContainer) {
        const summaryButton = document.createElement('button');
        summaryButton.className = 'action-button ver-resumo-negociacao';
        summaryButton.innerHTML = '<i class="fas fa-history"></i> Ver Resumo da Negociação';
        summaryButton.onclick = () => showNegotiationSummaryModal(dispute);
        
        actionsContainer.appendChild(summaryButton);
    }
}

// Função para exibir modal com resumo da negociação
function showNegotiationSummaryModal(dispute) {
    // Cria ou obtém o container do modal
    let modalContainer = document.getElementById('modal-resumo-negociacao');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modal-resumo-negociacao';
        modalContainer.className = 'modal';
        document.body.appendChild(modalContainer);
    }
    
    // Formata a data de conclusão
    const dataConclusao = new Date(dispute.dataConclusao);
    const dataFormatada = dataConclusao.toLocaleString('pt-BR');
    
    // Prepara detalhes da resposta baseado no tipo
    let detalhesHtml = '';
    if (dispute.isDelayRelated && dispute.detalhesResposta) {
        if (dispute.detalhesResposta.additionalTimeInMinutes) {
            detalhesHtml = `
                <div class="resumo-detalhe">
                    <span class="detalhe-label">Tempo Adicional:</span>
                    <span class="detalhe-value">+${dispute.detalhesResposta.additionalTimeInMinutes} minutos</span>
                </div>
                ${dispute.detalhesResposta.additionalTimeReason ? `
                <div class="resumo-detalhe">
                    <span class="detalhe-label">Motivo:</span>
                    <span class="detalhe-value">${dispute.detalhesResposta.additionalTimeReason}</span>
                </div>` : ''}
            `;
        }
    }
    
    // Define a classe de status
    let statusClass = '';
    switch(dispute.statusFinal) {
        case 'ACEITA':
            statusClass = 'status-aceita';
            break;
        case 'REJEITADA':
            statusClass = 'status-rejeitada';
            break;
        case 'EXPIRADA':
            statusClass = 'status-expirada';
            break;
        case 'ALTERNATIVA OFERECIDA':
            statusClass = 'status-alternativa';
            break;
    }
    
    // Define o conteúdo do modal
    modalContainer.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-history"></i> Resumo da Negociação</h2>
                <span class="close-modal" onclick="closeNegotiationSummaryModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="resumo-status ${statusClass}">
                    <span class="status-label">Status Final:</span>
                    <span class="status-value">${dispute.statusFinal}</span>
                </div>
                
                ${detalhesHtml}
                
                <div class="resumo-conclusao">
                    <span class="conclusao-label">Concluída em:</span>
                    <span class="conclusao-value">${dataFormatada}</span>
                </div>
            </div>
            <div class="modal-footer">
                <button class="action-button" onclick="closeNegotiationSummaryModal()">Fechar</button>
            </div>
        </div>
    `;
    
    // Adiciona estilos específicos para o modal
    addNegotiationSummaryStyles();
    
    // Exibe o modal
    modalContainer.style.display = 'flex';
}

// Função para fechar o modal de resumo
function closeNegotiationSummaryModal() {
    const modalContainer = document.getElementById('modal-resumo-negociacao');
    if (modalContainer) {
        modalContainer.style.display = 'none';
    }
}

// Função para restaurar os botões de ação normais do pedido após uma negociação
// Função para restaurar os botões de ação normais do pedido após uma negociação
async function restoreOrderButtons(orderId) {
    try {
        console.log('🔄 Restaurando botões de ação para o pedido:', orderId);
        
        // Busca o pedido na DOM
        const orderCard = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
        
        if (!orderCard) {
            console.log('❌ Card do pedido não encontrado para restauração de botões');
            return;
        }
        
        // Busca o container de ações do pedido
        const actionsContainer = orderCard.querySelector('.order-actions');
        if (!actionsContainer) {
            console.log('❌ Container de ações não encontrado no card do pedido');
            return;
        }
        
        // Limpa o container de ações atual
        while (actionsContainer.firstChild) {
            actionsContainer.removeChild(actionsContainer.firstChild);
        }
        
        // Busca o status atual do pedido via API
        const orderDetails = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
        
        if (!orderDetails) {
            console.log('❌ Erro ao obter detalhes do pedido para restauração de botões');
            return;
        }
        
        console.log('✅ Detalhes do pedido obtidos para restauração de botões:', orderDetails);
        
        // Recria os botões de ação baseados no status atual do pedido
        addActionButtons(actionsContainer, orderDetails);
        
        console.log('✅ Botões de ação restaurados para o pedido:', orderId);
        
        // Se o pedido estiver aberto no modal, atualiza o modal também
        const modalContainer = document.getElementById('modal-pedido-container');
        if (modalContainer && modalContainer.style.display === 'flex') {
            const modalActionsContainer = modalContainer.querySelector(`#modal-actions-container-${orderId}`);
            if (modalActionsContainer) {
                // Limpa o container de ações do modal
                while (modalActionsContainer.firstChild) {
                    if (modalActionsContainer.firstChild.tagName !== 'BUTTON' || 
                        !modalActionsContainer.firstChild.classList.contains('modal-pedido-fechar')) {
                        modalActionsContainer.removeChild(modalActionsContainer.firstChild);
                    } else {
                        break; // Mantém o botão "Fechar"
                    }
                }
                
                // Clona os botões do card para o modal
                const newButtons = actionsContainer.cloneNode(true);
                newButtons.classList.add('modal-actions');
                
                // Adiciona eventos aos botões clonados
                newButtons.querySelectorAll('.action-button').forEach((button, index) => {
                    const originalButton = actionsContainer.querySelectorAll('.action-button')[index];
                    if (originalButton && originalButton.onclick) {
                        button.onclick = originalButton.onclick;
                    }
                });
                
                // Adiciona ao início do container
                modalActionsContainer.insertBefore(newButtons, modalActionsContainer.firstChild);
            }
        }
    } catch (error) {
        console.error('❌ Erro ao restaurar botões de ação:', error);
    }
}

// Função para adicionar estilos específicos do modal de resumo
function addNegotiationSummaryStyles() {
    if (document.getElementById('negotiation-summary-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'negotiation-summary-styles';
    styles.textContent = `
        #modal-resumo-negociacao .modal-content {
            max-width: 500px;
            width: 90%;
        }
        
        .resumo-status {
            padding: 1rem;
            border-radius: var(--border-radius);
            margin-bottom: 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
        }
        
        .status-aceita {
            background-color: #e8f5e9;
            color: #2e7d32;
        }
        
        .status-rejeitada {
            background-color: #ffebee;
            color: #c62828;
        }
        
        .status-expirada {
            background-color: #fff3e0;
            color: #ef6c00;
        }
        
        .status-alternativa {
            background-color: #e3f2fd;
            color: #1565c0;
        }
        
        .resumo-detalhe {
            padding: 0.75rem;
            border-bottom: 1px solid var(--light-gray);
            display: flex;
            justify-content: space-between;
        }
        
        .detalhe-label {
            color: var(--dark-gray);
            font-weight: 500;
        }
        
        .detalhe-value {
            color: var(--primary-color);
            font-weight: bold;
        }
        
        .resumo-conclusao {
            margin-top: 1.5rem;
            padding: 0.75rem;
            background-color: var(--light-gray);
            border-radius: var(--border-radius);
            display: flex;
            justify-content: space-between;
        }
        
        .conclusao-label {
            color: #666;
        }
        
        .conclusao-value {
            font-weight: 500;
        }
        
        .ver-resumo-negociacao {
            background-color: #6c757d !important;
            color: white !important;
        }
        
        .ver-resumo-negociacao:hover {
            background-color: #5a6268 !important;
        }
        
        .dispute-expired-alert {
            background-color: #fff3cd;
            color: #856404;
            padding: 1rem;
            margin-bottom: 1rem;
            border-radius: var(--border-radius);
            border-left: 4px solid #ffc107;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
    `;
    
    document.head.appendChild(styles);
}

// Polling periódico para verificar disputas expiradas
const checkExpiredDisputes = () => {
    const now = new Date();
    
    // Verifica disputas ativas com tempo expirado
    activeDisputes.forEach(dispute => {
        if (dispute.expiresAt) {
            const expiresAt = new Date(dispute.expiresAt);
            
            if (now >= expiresAt) {
                // Bloqueia ações no modal
                const modal = document.getElementById('modal-negociacao-container');
                if (modal && modal.style.display !== 'none') {
                    const buttons = modal.querySelectorAll('button:not(.modal-pedido-close)');
                    buttons.forEach(button => {
                        button.disabled = true;
                        button.style.opacity = '0.5';
                    });
                    
                    // Adiciona alerta visual se ainda não existe
                    if (!modal.querySelector('.dispute-expired-alert')) {
                        const alertDiv = document.createElement('div');
                        alertDiv.className = 'dispute-expired-alert';
                        alertDiv.innerHTML = `
                            <i class="fas fa-exclamation-triangle"></i>
                            Tempo expirado! Aguardando ação automática: ${dispute.timeoutAction}
                        `;
                        
                        const modalBody = modal.querySelector('.modal-negociacao-body');
                        if (modalBody) {
                            modalBody.insertBefore(alertDiv, modalBody.firstChild);
                        }
                    }
                }
                
                // Executa ação automática conforme timeoutAction
                handleTimeoutAction(dispute);
            }
        }
    });
};

// Função para executar ação automática quando disputa expira
async function handleTimeoutAction(dispute) {
    if (!dispute.timeoutAction) return;
    
    try {
        console.log(`⏰ Executando ação automática para disputa expirada: ${dispute.timeoutAction}`);
        
        switch(dispute.timeoutAction) {
            case 'ACCEPT_CANCELLATION':
                await aceitarDisputa(dispute.disputeId);
                break;
                
            case 'REJECT_CANCELLATION':
                await rejeitarDisputa(dispute.disputeId);
                break;
                
            case 'VOID':
                // Apenas remove a disputa sem ação
                removeActiveDispute(dispute.disputeId);
                break;
        }
    } catch (error) {
        console.error('❌ Erro ao executar ação automática:', error);
    }
}

// Estende o handleEvent original para incluir tratamento de HANDSHAKE_SETTLEMENT
const originalHandleEvent = window.handleEvent;
window.handleEvent = async function(event) {
    // Se for um evento HANDSHAKE_SETTLEMENT, processa primeiro
    if (event.code === 'HANDSHAKE_SETTLEMENT' || event.fullCode === 'HANDSHAKE_SETTLEMENT') {
        await handleSettlementEvent(event);
    }
    
    // Em seguida, passa para o handler original
    return originalHandleEvent(event);
};

// Inicialização do módulo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 Inicializando módulo de tratamento de HANDSHAKE_SETTLEMENT...');
    
    // Carrega disputas resolvidas do localStorage
    loadResolvedDisputes();
    
    // Inicia polling de disputas
    startDisputePolling();
    
    // Inicia verificação periódica de disputas expiradas
    setInterval(checkExpiredDisputes, 1000);
    
    // Adiciona função global para fechar modal
    window.closeNegotiationSummaryModal = closeNegotiationSummaryModal;
    
    console.log('✅ Módulo de tratamento de HANDSHAKE_SETTLEMENT inicializado');
});

// Exporta funções necessárias
window.handleSettlementEvent = handleSettlementEvent;
window.showNegotiationSummaryModal = showNegotiationSummaryModal;
window.closeNegotiationSummaryModal = closeNegotiationSummaryModal;
window.startDisputePolling = startDisputePolling;
window.stopDisputePolling = stopDisputePolling;
