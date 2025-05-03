// Módulo para tratamento de eventos HANDSHAKE_SETTLEMENT e histórico de negociações
// Este arquivo complementa o negociacao.js existente adicionando:
// 1. Tratamento do evento HANDSHAKE_SETTLEMENT
// 2. Armazenamento do histórico de negociações
// 3. Exibição do resumo de negociações no modal padrão
// 4. Fallback por polling para disputas
// 5. Timeout automático

// Garante que exista um resolvedDisputes global para ser lido por updateOrderStatus
window.resolvedDisputes = window.resolvedDisputes || [];
var resolvedDisputes = window.resolvedDisputes;

// ─── INÍCIO do IIFE ─────────────────────────────────────────
;(function(
  ordersCache,
  lastOrderFetchTimestamps,
  MIN_ORDER_FETCH_INTERVAL
) {

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

// Somente busca uma vez, chamado pelo unifiedPolling()
async function pollForNewDisputesOnce() {
    if (!state.accessToken) return;
    try {
        const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET');
        if (Array.isArray(events)) {
            const disputes = events.filter(ev =>
                ev.code === 'HANDSHAKE_DISPUTE' || ev.fullCode === 'HANDSHAKE_DISPUTE'
            );
            for (const d of disputes) {
                if (!activeDisputes.find(x => x.disputeId === d.disputeId)) {
                    await processarEventoDisputa(d);
                }
            }
            if (events.length) {
                await makeAuthorizedRequest(
                    '/events/v1.0/events/acknowledgment',
                    'POST',
                    events.map(e => ({ id: e.id }))
                );
            }
        }
    } catch (e) {
        console.error('❌ Erro no polling de disputas:', e);
    }
}

// DEPOIS (substitui as mesmas linhas, ~88–96)
function startDisputePolling() {
    if (!isDisputePollingActive) {
        isDisputePollingActive = true;
        console.log('🔄 Iniciando polling de disputas...');
        if (typeof pollForNewDisputesOnce === 'function') {
            pollForNewDisputesOnce();
        } else {
            console.error('❌ pollForNewDisputesOnce não está definida, abortando polling de disputas');
        }
    }
}

function stopDisputePolling() {
    isDisputePollingActive = false;
    console.log('⏹️ Polling de disputas parado');
}

// Nova função para preservar estado do pedido antes de fechar modal
function anteciparLimpezaModalNegociacao() {
    // Obtém a disputa atual antes que seja limpa
    const disputa = activeDisputes.find(d => d.disputeId === currentDisputeId);
    let pedidoId = null;
    
    if (disputa) {
        pedidoId = disputa.orderId;
        
        // Armazena o status original do pedido para restauração
        const orderCard = document.querySelector(`.order-card[data-order-id="${pedidoId}"]`);
        if (orderCard) {
            const statusElement = orderCard.querySelector('.order-status');
            if (statusElement) {
                const statusText = statusElement.textContent;
                
                // Armazena o status em um dataAttribute para usar depois
                orderCard.setAttribute('data-original-status', statusText);
                console.log(`💾 Status original do pedido ${pedidoId} preservado: ${statusText}`);
            }
        }
    }
    
    return pedidoId;
}

// Função melhorada para garantir a restauração dos botões
function garantirRestauracaoBotoes(orderId) {
    if (!orderId) return;
    
    console.log(`🔄 Garantindo restauração dos botões para pedido ${orderId}`);
    
    // Tenta múltiplas vezes para garantir
    const tentativas = [300, 800, 1500, 3000]; // Tempos em ms
    
    tentativas.forEach(tempo => {
        setTimeout(() => {
            try {
                const card = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
                if (!card) {
                    console.log(`❌ Card não encontrado para tempo ${tempo}ms`);
                    return;
                }
                
                // Verifica se já tem botões de ação (exceto o resumo)
                const acoesExistentes = Array.from(card.querySelectorAll('.action-button'))
                    .filter(btn => !btn.classList.contains('ver-resumo-negociacao'));
                    
                if (acoesExistentes.length === 0) {
                    console.log(`⚠️ Restaurando botões em ${tempo}ms para o pedido ${orderId}`);
                    
                    // Obtém o status original do atributo data-
                    const originalStatus = card.getAttribute('data-original-status');
                    console.log(`🔍 Status original do pedido: ${originalStatus}`);
                    
                    // Converte texto do status para código se necessário
                    let statusCode = 'CONFIRMED'; // Default fallback
                    
                    if (originalStatus) {
                        const statusMap = {
                            'Novo': 'PLACED',
                            'Confirmado': 'CONFIRMED',
                            'Em Preparação': 'IN_PREPARATION',
                            'Pronto para Retirada': 'READY_TO_PICKUP',
                            'A Caminho': 'DISPATCHED',
                            'Concluído': 'CONCLUDED',
                            'Cancelado': 'CANCELLED',
                            'Cancelamento Solicitado': 'CANCELLATION_REQUESTED'
                        };
                        
                        statusCode = statusMap[originalStatus] || statusCode;
                    } else if (ordersCache[orderId] && ordersCache[orderId].status) {
                        // Tenta obter do cache
                        statusCode = ordersCache[orderId].status;
                    }
                    
                    console.log(`⚙️ Usando status ${statusCode} para restaurar botões`);
                    
                    // Busca o container de ações
                    const actionsContainer = card.querySelector('.order-actions');
                    if (actionsContainer) {
                        // Limpa o container (preservando o botão de resumo se existir)
                        const resumoBtn = actionsContainer.querySelector('.ver-resumo-negociacao');
                        actionsContainer.innerHTML = '';
                        
                        // Adiciona os botões corretos
                        addActionButtons(actionsContainer, { id: orderId, status: statusCode });
                        
                        // Re-adiciona o botão de resumo, se existia
                        if (resumoBtn) {
                            actionsContainer.appendChild(resumoBtn);
                        }
                        
                        console.log(`✅ Botões de ação restaurados em ${tempo}ms`);
                    } else {
                        console.log(`❌ Container de ações não encontrado em ${tempo}ms`);
                    }
                } else {
                    console.log(`✅ ${acoesExistentes.length} botões de ação já existem em ${tempo}ms`);
                }
            } catch (err) {
                console.error(`❌ Erro na restauração em ${tempo}ms:`, err);
            }
        }, tempo);
    });
}

// Função principal para tratar eventos HANDSHAKE_SETTLEMENT
async function handleSettlementEvent(event) {
  try {
    console.log('🔍 Processando evento HANDSHAKE_SETTLEMENT:', event);

    // extrai os campos
    const disputeId = event.disputeId || event.metadata?.disputeId;
    const orderId   = event.orderId;

    // validações básicas (removida a checagem de merchantId)
    if (!orderId || !disputeId) {
      console.error(
        '❌ Evento HANDSHAKE_SETTLEMENT inválido (falta orderId ou disputeId):',
        event
      );
      return;
    }

    // ── CACHE “FLAT” POR orderId ───────────────────────
    lastOrderFetchTimestamps[orderId] = lastOrderFetchTimestamps[orderId] || 0;
    ordersCache[orderId] = {
      disputeId,
      // … qualquer outro dado de settlement que você queira guardar …
    };

    // … resto da sua lógica original continua exatamente igual …
        
        // Traduz o status do settlement
        const statusMap = {
            'ACCEPTED': 'ACEITA',
            'REJECTED': 'REJEITADA',
            'ALTERNATIVE_OFFERED': 'ALTERNATIVA OFERECIDA',
            'ALTERNATIVE_REPLIED': 'ALTERNATIVA ACEITA',
            'EXPIRED': 'EXPIRADA'
        };
        
        // Busca detalhes da disputa original
        const originalDispute = activeDisputes.find(d => d.disputeId === disputeId);
        
        // IMPORTANTE: Antes de resolver a disputa, verifica o status atual do pedido
        // e o armazena para restaurar depois
        const orderCard = document.querySelector(`.order-card[data-order-id="${event.orderId}"]`);
        let originalStatus = null;

        if (orderCard) {
            // Verifica se o status está no cache
            originalStatus = ordersCache[event.orderId]?.status;
            
            // Se não estiver no cache, tenta buscar das classes do card
            if (!originalStatus || originalStatus === 'PLACED') {
                console.log('🔍 Status não encontrado no cache ou é PLACED, tentando pelas classes do card...');
                
                // Verifica as classes de status do card
                const statusClasses = Array.from(orderCard.classList)
                    .filter(className => className.startsWith('status-'));
                    
                if (statusClasses.length > 0) {
                    const cardStatus = statusClasses[0].replace('status-', '').toUpperCase();
                    if (cardStatus && cardStatus !== 'PLACED') {
                        console.log('✅ Status deduzido das classes do card:', cardStatus);
                        originalStatus = cardStatus;
                    }
                }
            }
            
            // Verifica também qualquer status armazenado no atributo personalizado
            if (!originalStatus || originalStatus === 'PLACED') {
                const storedStatus = orderCard.getAttribute('data-original-status');
                if (storedStatus) {
                    // Converte texto do status para código
                    const statusMap = {
                        'Novo': 'PLACED',
                        'Confirmado': 'CONFIRMED',
                        'Em Preparação': 'IN_PREPARATION',
                        'Pronto para Retirada': 'READY_TO_PICKUP',
                        'A Caminho': 'DISPATCHED',
                        'Concluído': 'CONCLUDED',
                        'Cancelado': 'CANCELLED'
                    };
                    
                    originalStatus = statusMap[storedStatus] || originalStatus;
                    console.log('✅ Status encontrado no atributo data:', originalStatus);
                }
            }
            
            console.log('📊 Status original antes da negociação:', originalStatus);
        }
        
        // Cria registro da disputa resolvida
        const resolvedDispute = {
            orderId: event.orderId,
            disputeId: disputeId,
            statusFinal: statusMap[event.metadata?.status] || event.metadata?.status || 'DESCONHECIDO',
            tipoDeResposta: originalDispute?.responseType || 'NÃO ESPECIFICADO',
            dataConclusao: new Date().toISOString(),
            detalhesResposta: originalDispute?.responseDetails || {},
            isDelayRelated: isDelayDispute(originalDispute),
            originalStatus: originalStatus  // Armazena o status original para uso posterior
        };
        
        console.log('✅ Detalhes da resolução da disputa:', JSON.stringify(resolvedDispute));
        
        // Remove qualquer registro anterior da mesma disputa
        resolvedDisputes = resolvedDisputes.filter(d => d.disputeId !== disputeId);
        
        // Adiciona o novo registro
        resolvedDisputes.push(resolvedDispute);
        
        // Salva no localStorage
        saveResolvedDisputes();
        
        // Remove da lista de disputas ativas
        removeActiveDispute(disputeId);
        
        // Fecha o modal de negociação se estiver aberto
        fecharModalNegociacao();
        
        // Atualiza a interface se necessário
        if (orderCard) {
            // Adiciona o botão de resumo da negociação
            addNegotiationSummaryButton(orderCard, resolvedDispute);
            
            // IMPORTANTE: Restaura os botões de ação baseados no status correto
            console.log('🔍 Buscando status atual do pedido para restaurar botões...');
            
            try {
                // Aguarda um pequeno intervalo para garantir que a API esteja atualizada
                await new Promise(resolve => setTimeout(resolve, 1000));
                
// Primeira estratégia: tentar obter o status atual via API (protegido pelo intervalo mínimo)
console.log('📡 Tentativa 1: Buscar status atual via API…');

let currentStatus = null;
let successfulFetch = false;

// 1. Verifica se já fizemos fetch recentemente
const now = Date.now();
const lastFetch = lastOrderFetchTimestamps[event.orderId] || 0;
let orderDetailsFromApi = null;

if (now - lastFetch < MIN_ORDER_FETCH_INTERVAL) {
    console.log(
      `⏱️ Pulando fetch (settlement) para ${event.orderId}; última há ${((now - lastFetch)/60000).toFixed(1)} min`
    );
    orderDetailsFromApi = ordersCache[event.orderId];
} else {
    // Faz o fetch e atualiza timestamp
    try {
        console.log(`🔄 Fetch (settlement) do pedido ${event.orderId}`);
        orderDetailsFromApi = await makeAuthorizedRequest(
          `/order/v1.0/orders/${event.orderId}`, 'GET'
        );
        lastOrderFetchTimestamps[event.orderId] = now;
    } catch (apiError) {
        console.error('❌ Erro ao buscar status via API:', apiError);
    }
}

// 2. Se obteve dados válidos, atualiza status, flag e cache
if (orderDetailsFromApi && orderDetailsFromApi.status) {
    currentStatus = orderDetailsFromApi.status;
    console.log('✅ Status atualizado obtido via API:', currentStatus);
    successfulFetch = true;
    ordersCache[event.orderId] = orderDetailsFromApi;
}
                
                // Segunda estratégia: usar o status em cache se a API falhou
                if (!successfulFetch || !currentStatus || currentStatus === 'PLACED') {
                    console.log('📡 Tentativa 2: Verificando status em cache...');
                    
                    currentStatus = ordersCache[event.orderId]?.status;
                    if (currentStatus && currentStatus !== 'PLACED') {
                        console.log('✅ Status válido encontrado no cache:', currentStatus);
                    } else {
                        console.log('⚠️ Status em cache inválido ou PLACED:', currentStatus);
                    }
                }
                
                // Terceira estratégia: usar o status original armazenado
                if (!currentStatus || currentStatus === 'PLACED') {
                    console.log('📡 Tentativa 3: Usando status original armazenado...');
                    
                    if (resolvedDispute.originalStatus && resolvedDispute.originalStatus !== 'PLACED') {
                        currentStatus = resolvedDispute.originalStatus;
                        console.log('✅ Usando status original armazenado:', currentStatus);
                    } else {
                        console.log('⚠️ Status original inválido ou PLACED:', resolvedDispute.originalStatus);
                    }
                }
                
                // Quarta estratégia: usar status das classes do card
                if (!currentStatus || currentStatus === 'PLACED') {
                    console.log('📡 Tentativa 4: Deduzindo status das classes do card...');
                    
                    const statusClasses = Array.from(orderCard.classList)
                        .filter(className => className.startsWith('status-'));
                        
                    if (statusClasses.length > 0) {
                        const cardStatus = statusClasses[0].replace('status-', '').toUpperCase();
                        if (cardStatus && cardStatus !== 'PLACED') {
                            currentStatus = cardStatus;
                            console.log('✅ Status deduzido das classes do card:', currentStatus);
                        } else {
                            console.log('⚠️ Status das classes inválido ou PLACED:', cardStatus);
                        }
                    } else {
                        console.log('⚠️ Nenhuma classe de status encontrada no card');
                    }
                }
                
                // Quinta estratégia: Fallback para CONFIRMED como último recurso
                if (!currentStatus || currentStatus === 'PLACED') {
                    console.log('📡 Tentativa 5: Usando CONFIRMED como fallback de segurança');
                    currentStatus = 'CONFIRMED';
                }
                
                console.log('🎯 Status final para restauração dos botões:', currentStatus);
                
                // Atualiza o status na interface (isso também vai atualizar os botões)
                updateOrderStatus(event.orderId, currentStatus);
                
                // Força a recriação dos botões com o status correto
                const actionsContainer = orderCard.querySelector('.order-actions');
                if (actionsContainer) {
                    console.log('🔧 Forçando recriação dos botões de ação com status:', currentStatus);
                    
                    // Cria um objeto simples com o status correto
                    const orderWithStatus = { id: event.orderId, status: currentStatus };
                    
                    // Limpa o container de ações
                    while (actionsContainer.firstChild) {
                        actionsContainer.removeChild(actionsContainer.firstChild);
                    }
                    
                    // Adiciona os botões corretos
                    addActionButtons(actionsContainer, orderWithStatus);
                    
                    // IMPORTANTE: Readiciona o botão de resumo de negociação que pode ter sido removido
                    setTimeout(() => {
                        addNegotiationSummaryButton(orderCard, resolvedDispute);
                        console.log('🔄 Botão de resumo de negociação readicionado');
                    }, 200);
                }
                
                // Garantir que os botões de ação sejam restaurados mesmo após todas as tentativas
                garantirRestauracaoBotoes(event.orderId);
                
            } catch (error) {
                console.error('❌ Erro ao restaurar botões de ação:', error);
            }
        }
        
        // Exibe notificação
        showToast(`Negociação ${resolvedDispute.statusFinal.toLowerCase()}`, 'info');
        
        console.log('✅ Evento HANDSHAKE_SETTLEMENT processado com sucesso');

        // MODIFICAÇÃO CRÍTICA: Restaurar os botões com o status original
        setTimeout(() => {
            const orderCard = document.querySelector(`.order-card[data-order-id="${event.orderId}"]`);
            if (orderCard) {
                // Tenta obter o status original
                const originalStatus = orderCard.getAttribute('data-original-status');
                console.log(`🔍 Status original do pedido: ${originalStatus}`);
                
                if (originalStatus) {
                    // Converte o texto para o código de status
                    const statusMap = {
                        'Novo': 'PLACED',
                        'Confirmado': 'CONFIRMED',
                        'Em Preparação': 'IN_PREPARATION', 
                        'Pronto para Retirada': 'READY_TO_PICKUP',
                        'A Caminho': 'DISPATCHED',
                        'Concluído': 'CONCLUDED',
                        'Cancelado': 'CANCELLED'
                    };
                    
                    const statusCode = statusMap[originalStatus] || 'CONFIRMED';
                    
                    // Busca o container de ações
                    const actionsContainer = orderCard.querySelector('.order-actions');
                    if (actionsContainer) {
                        // Salva o botão de resumo se existir
                        const resumoBtn = actionsContainer.querySelector('.ver-resumo-negociacao');
                        
                        // Limpa o container
                        actionsContainer.innerHTML = '';
                        
                        // Adiciona botões para o status original
                        addActionButtons(actionsContainer, { id: event.orderId, status: statusCode });
                        console.log(`✅ Botões restaurados com status original: ${statusCode}`);
                        
                        // Readiciona o botão de resumo
                        if (resumoBtn) {
                            actionsContainer.appendChild(resumoBtn);
                        }
                    }
                }
            }
        }, 500);
        
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

// Função melhorada para adicionar botão de resumo da negociação
function addNegotiationSummaryButton(orderCard, dispute) {
    // Remove botão existente se houver
    const existingButton = orderCard.querySelector('.ver-resumo-negociacao');
    if (existingButton) {
        existingButton.remove();
    }
    
    // Cria novo botão
    const actionsContainer = orderCard.querySelector('.order-actions');
    if (actionsContainer) {
        // Cria o botão
        const summaryButton = document.createElement('button');
        summaryButton.className = 'action-button ver-resumo-negociacao';
        summaryButton.innerHTML = '<i class="fas fa-history"></i> Ver Resumo da Negociação';
        summaryButton.onclick = (e) => {
            e.stopPropagation(); // Evita propagação do evento
            showNegotiationSummaryModal(dispute);
        };
        
        // Adiciona o botão ao container
        actionsContainer.appendChild(summaryButton);
        
        console.log('✅ Botão de resumo de negociação adicionado');
    } else {
        console.warn('⚠️ Container de ações não encontrado para adicionar botão de resumo');
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

// Versão melhorada da função que restaura os botões (cache “flat” por orderId)
async function restoreOrderButtons(orderId) {
    try {
        console.log('🔄 Restaurando botões de ação para o pedido:', orderId);
        
        // 1) Busca o pedido na DOM
        const orderCard = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
        if (!orderCard) {
            console.log('❌ Card do pedido não encontrado para restauração de botões');
            return;
        }
        
        // 2) Busca o container de ações do pedido
        const actionsContainer = orderCard.querySelector('.order-actions');
        if (!actionsContainer) {
            console.log('❌ Container de ações não encontrado no card do pedido');
            return;
        }
        
        // 3) Busca a disputa resolvida para este pedido (a mais recente)
        const resolvedDispute = resolvedDisputes
            .filter(d => d.orderId === orderId)
            .sort((a, b) => new Date(b.dataConclusao) - new Date(a.dataConclusao))[0];
        
        // Estratégia 1: status armazenado na disputa resolvida
        let orderStatus = null;
        if (
            resolvedDispute &&
            resolvedDispute.originalStatus &&
            resolvedDispute.originalStatus !== 'PLACED'
        ) {
            orderStatus = resolvedDispute.originalStatus;
            console.log('✅ Usando status armazenado na disputa resolvida:', orderStatus);
        }
        
        // Estratégia 2: cache “flat” por orderId
        if (!orderStatus || orderStatus === 'PLACED') {
            const cachedStatus = ordersCache[orderId]?.status;
            console.log('ℹ️ Status no cache:', cachedStatus);
            if (cachedStatus && cachedStatus !== 'PLACED') {
                orderStatus = cachedStatus;
            } else {
                // Estratégia 3: fetch protegido por intervalo mínimo e retry
                const nowRestore       = Date.now();
                const lastFetchRestore = lastOrderFetchTimestamps[orderId] || 0;
                
                if (nowRestore - lastFetchRestore < MIN_ORDER_FETCH_INTERVAL) {
                    console.log(
                      `⏱️ Pulando fetch em restoreOrderButtons para ${orderId}; última há ${((nowRestore - lastFetchRestore)/60000).toFixed(1)} min`
                    );
                } else {
                    console.log('🔍 Cache ausente ou PLACED, buscando da API (retry)…');
                    for (let i = 0; i < 3; i++) {
                        try {
                            const fetched = await makeAuthorizedRequest(
                              `/order/v1.0/orders/${orderId}`, 'GET'
                            );
                            if (fetched?.status) {
                                console.log(`✅ Tentativa ${i+1}: Status obtido:`, fetched.status);
                                orderStatus = fetched.status;
                                ordersCache[orderId] = fetched;
                                lastOrderFetchTimestamps[orderId] = nowRestore;
                                break;
                            }
                            console.log(`⏳ Tentativa ${i+1}: aguardando status do pedido...`);
                        } catch (err) {
                            console.error(`❌ Erro na tentativa ${i+1}:`, err);
                        }
                        await new Promise(res => setTimeout(res, 1000));
                    }
                }
            }
        }
        
        // Estratégia 4: deduzir status pelas classes do card
        if (!orderStatus || orderStatus === 'PLACED') {
            console.log('🔍 Tentando deduzir status pelas classes do card...');
            const statusClasses = Array.from(orderCard.classList)
                .filter(className => className.startsWith('status-'));
            if (statusClasses.length > 0) {
                const cardStatus = statusClasses[0].replace('status-', '').toUpperCase();
                if (cardStatus && cardStatus !== 'PLACED') {
                    orderStatus = cardStatus;
                    console.log('✅ Status deduzido das classes do card:', orderStatus);
                }
            }
        }
        
        // Estratégia 5: verificar atributo data-original-status
        if (!orderStatus || orderStatus === 'PLACED') {
            const storedStatus = orderCard.getAttribute('data-original-status');
            if (storedStatus) {
                const statusMap = {
                    'Novo': 'PLACED',
                    'Confirmado': 'CONFIRMED',
                    'Em Preparação': 'IN_PREPARATION',
                    'Pronto para Retirada': 'READY_TO_PICKUP',
                    'A Caminho': 'DISPATCHED',
                    'Concluído': 'CONCLUDED',
                    'Cancelado': 'CANCELLED'
                };
                orderStatus = statusMap[storedStatus] || orderStatus;
                console.log('✅ Status encontrado no atributo data-original-status:', orderStatus);
            }
        }
        
        // Estratégia 6: fallback seguro
        if (!orderStatus || orderStatus === 'PLACED') {
            console.warn('⚠️ Usando CONFIRMED como fallback de segurança');
            orderStatus = 'CONFIRMED';
        }
        
        console.log('✅ Status final para restauração de botões:', orderStatus);
        
        // 4) Limpa o container de ações antes de adicionar novos botões
        while (actionsContainer.firstChild) {
            actionsContainer.removeChild(actionsContainer.firstChild);
        }
        
        // 5) Recria os botões de ação baseados no status atual
        addActionButtons(actionsContainer, { id: orderId, status: orderStatus });
        
        // 6) Se tiver disputa resolvida, re-adiciona o botão de resumo
        if (resolvedDispute) {
            setTimeout(() => {
                addNegotiationSummaryButton(orderCard, resolvedDispute);
            }, 100);
        }
        
        // Retorna o status para possível uso
        return orderStatus;
    } catch (error) {
        console.error('❌ Erro ao restaurar botões de ação:', error);
        return null;
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
    // (removido) startDisputePolling();
    
    // Inicia verificação periódica de disputas expiradas
    setInterval(checkExpiredDisputes, 1000);
    
    // Adiciona função global para fechar modal
    window.closeNegotiationSummaryModal = closeNegotiationSummaryModal;
    
    console.log('✅ Módulo de tratamento de HANDSHAKE_SETTLEMENT inicializado');
});

  // Exponha as funções necessárias
  window.handleSettlementEvent          = handleSettlementEvent;
  window.showNegotiationSummaryModal    = showNegotiationSummaryModal;
  window.closeNegotiationSummaryModal   = closeNegotiationSummaryModal;
  window.startDisputePolling            = startDisputePolling;
  window.stopDisputePolling             = stopDisputePolling;
  window.garantirRestauracaoBotoes      = garantirRestauracaoBotoes;
  window.restoreOrderButtons            = restoreOrderButtons;
  window.pollForNewDisputesOnce         = pollForNewDisputesOnce;

})( 
  window.ordersCache,
  window.lastOrderFetchTimestamps,
  window.MIN_ORDER_FETCH_INTERVAL
);
// ─── FIM do IIFE ────────────────────────────────────────────
