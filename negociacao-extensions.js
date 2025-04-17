// Extensões para a Plataforma de Negociação iFood
// Este arquivo estende a funcionalidade de negociacao.js para implementar:
// 1. Tratamento completo do evento HANDSHAKE_SETTLEMENT
// 2. Melhor tratamento de timeout
// 3. Resumo de negociações
// 4. Regras específicas para disputas por atraso

// Array para armazenar disputas resolvidas (após receber HANDSHAKE_SETTLEMENT)
let resolvedDisputes = [];
let disputeTimerIntervals = {};

// Carrega disputas resolvidas do localStorage na inicialização
function carregarDisputasResolvidas() {
    try {
        const savedDisputes = localStorage.getItem('resolvedDisputes');
        if (savedDisputes) {
            resolvedDisputes = JSON.parse(savedDisputes);
            console.log('📋 Carregadas disputas resolvidas:', resolvedDisputes.length);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar disputas resolvidas:', error);
        resolvedDisputes = [];
    }
}

// Salva disputas resolvidas no localStorage
function salvarDisputasResolvidas() {
    try {
        localStorage.setItem('resolvedDisputes', JSON.stringify(resolvedDisputes));
    } catch (error) {
        console.error('❌ Erro ao salvar disputas resolvidas:', error);
    }
}

// Adiciona uma nova disputa resolvida à lista
function adicionarDisputaResolvida(disputaResolvida) {
    // Verifica se já existe essa disputa na lista (por disputeId)
    const existingIndex = resolvedDisputes.findIndex(d => d.disputeId === disputaResolvida.disputeId);
    
    if (existingIndex >= 0) {
        // Atualiza a disputa existente
        resolvedDisputes[existingIndex] = disputaResolvida;
    } else {
        // Adiciona nova disputa
        resolvedDisputes.push(disputaResolvida);
    }
    
    // Salva a lista atualizada
    salvarDisputasResolvidas();
}

// Função para lidar com evento HANDSHAKE_SETTLEMENT
function processarEventoSettlement(event) {
    try {
        console.log('🤝 Evento HANDSHAKE_SETTLEMENT recebido:', event);
        
        // Extrai informações importantes
        const disputeId = event.disputeId;
        const orderId = event.orderId;
        const status = event.metadata?.status;
        
        if (!disputeId || !status) {
            console.error('❌ Evento HANDSHAKE_SETTLEMENT inválido:', event);
            return;
        }
        
        console.log(`🤝 Disputa ${disputeId} finalizada com status: ${status}`);
        
        // Busca a disputa ativa correspondente para obter informações adicionais
        const disputaAtiva = activeDisputes.find(d => d.disputeId === disputeId);
        
        // Cria um objeto de disputa resolvida
        const disputaResolvida = {
            disputeId: disputeId,
            orderId: orderId,
            statusFinal: status,
            tipoDeResposta: disputaAtiva?.tipoDeResposta || 'Desconhecido',
            resposta: disputaAtiva?.resposta || {},
            dataConclusao: new Date().toISOString(),
            metadata: {
                ...event.metadata,
                originalDispute: disputaAtiva
            }
        };
        
        // Adiciona à lista de disputas resolvidas
        adicionarDisputaResolvida(disputaResolvida);
        
        // Remove da lista de disputas ativas
        if (activeDisputes.includes(disputaAtiva)) {
            console.log(`🤝 Removendo disputa ${disputeId} da lista de ativas`);
            removeActiveDispute(disputeId);
        }
        
        // Fecha o modal se estiver aberto com esta disputa
        if (currentDisputeId === disputeId) {
            fecharModalNegociacao();
        }
        
        // Exibe um toast informando sobre a conclusão
        let statusText = 'finalizada';
        switch(status) {
            case 'ACCEPTED': statusText = 'aceita'; break;
            case 'REJECTED': statusText = 'rejeitada'; break;
            case 'ALTERNATIVE_OFFERED': statusText = 'com alternativa oferecida'; break;
            case 'EXPIRED': statusText = 'expirada'; break;
        }
        
        showToast(`Negociação ${statusText}!`, 'info');
        
        // Atualiza a interface para mostrar o botão de resumo no pedido
        atualizarBotaoResumoNegociacao(orderId);
        
    } catch (error) {
        console.error('❌ Erro ao processar evento HANDSHAKE_SETTLEMENT:', error);
    }
}

// Função para lidar com a expiração do tempo de resposta
function lidarComExpiracao(disputeId) {
    try {
        console.log(`⏰ Tempo de resposta expirado para disputa ${disputeId}`);
        
        // Busca a disputa ativa
        const disputa = activeDisputes.find(d => d.disputeId === disputeId);
        if (!disputa) {
            console.log('⚠️ Disputa não encontrada na lista de ativas, ignorando expiração');
            return;
        }
        
        // Verifica qual é o timeoutAction definido
        const timeoutAction = disputa.timeoutAction || 'VOID';
        console.log(`⏰ Ação automática definida: ${timeoutAction}`);
        
        // Se o modal estiver aberto para esta disputa, atualiza a interface
        if (currentDisputeId === disputeId) {
            // Desabilita todos os botões do modal
            const buttons = document.querySelectorAll('.modal-negociacao-footer button, .dispute-button, .alternative-button');
            buttons.forEach(button => {
                button.disabled = true;
                button.classList.add('disabled');
            });
            
            // Adiciona mensagem de expiração
            const messageElement = document.querySelector('.dispute-message .message-text');
            if (messageElement) {
                messageElement.innerHTML = `
                    <i class="fas fa-exclamation-circle"></i>
                    O tempo para resposta expirou. A ação automática "${getTimeoutActionText(timeoutAction)}" será aplicada.
                `;
                messageElement.classList.add('expired');
            }
            
            // Adiciona classe expirada ao timer
            const timerElement = document.querySelector('.dispute-timer');
            if (timerElement) {
                timerElement.textContent = 'Expirado';
                timerElement.classList.add('expired');
            }
            
            // Exibe toast de aviso
            showToast(`Tempo expirado para resposta! Ação automática: ${getTimeoutActionText(timeoutAction)}`, 'warning');
            
            // Fecha o modal após 5 segundos
            setTimeout(() => {
                fecharModalNegociacao();
            }, 5000);
        }
        
        // Limpa o intervalo para evitar chamadas repetidas
        if (disputeTimerIntervals[disputeId]) {
            clearInterval(disputeTimerIntervals[disputeId]);
            delete disputeTimerIntervals[disputeId];
        }
        
    } catch (error) {
        console.error('❌ Erro ao lidar com expiração de tempo:', error);
    }
}

// Função para obter texto descritivo da ação automática
function getTimeoutActionText(timeoutAction) {
    switch(timeoutAction) {
        case 'ACCEPT_CANCELLATION': return 'Aceitar cancelamento';
        case 'REJECT_CANCELLATION': return 'Rejeitar cancelamento';
        case 'VOID':
        default: return 'Ignorar solicitação';
    }
}

// Função para verificar se uma disputa é relacionada a atraso
function isDelayRelatedDispute(dispute) {
    if (!dispute) return false;
    
    // Verifica pelo tipo da disputa
    const disputeType = dispute.type || dispute.metadata?.handshakeType || '';
    const isDelayType = 
        disputeType.toUpperCase().includes('DELAY') || 
        disputeType.toUpperCase().includes('PREPARATION_TIME') || 
        disputeType.toUpperCase() === 'ORDER_LATE';
    
    // Verifica pelo motivo (reason)
    const reason = dispute.reason || '';
    const isDelayReason = 
        reason.toLowerCase().includes('atraso') || 
        reason.toLowerCase().includes('demora') || 
        reason.toLowerCase().includes('delay');
    
    return isDelayType || isDelayReason;
}

// Função para exibir o modal de resumo de negociação
function exibirResumoNegociacao(orderId) {
    try {
        console.log(`📊 Exibindo resumo de negociações para o pedido ${orderId}`);
        
        // Busca todas as disputas resolvidas para este pedido
        const disputasDoPedido = resolvedDisputes.filter(d => d.orderId === orderId);
        
        if (disputasDoPedido.length === 0) {
            showToast('Não foram encontradas negociações para este pedido', 'info');
            return;
        }
        
        // Cria o container do modal se não existir
        let resumoModalContainer = document.getElementById('modal-resumo-negociacao');
        if (!resumoModalContainer) {
            resumoModalContainer = document.createElement('div');
            resumoModalContainer.id = 'modal-resumo-negociacao';
            resumoModalContainer.className = 'modal-resumo-container';
            
            // Adiciona evento para fechar ao clicar fora
            resumoModalContainer.addEventListener('click', function(e) {
                if (e.target === resumoModalContainer) {
                    fecharResumoNegociacao();
                }
            });
            
            document.body.appendChild(resumoModalContainer);
        }
        
        // Gera o conteúdo do resumo
        let disputasHtml = '';
        
        disputasDoPedido.forEach((disputa, index) => {
            // Formata a data de conclusão
            const dataConclusao = new Date(disputa.dataConclusao);
            const dataFormatada = dataConclusao.toLocaleString('pt-BR');
            
            // Determina ícone e cor baseado no status
            let statusIcon = 'info-circle';
            let statusColor = '#1a73e8';
            let statusText = 'Desconhecido';
            
            switch(disputa.statusFinal) {
                case 'ACCEPTED':
                    statusIcon = 'check-circle';
                    statusColor = '#28a745';
                    statusText = 'Aceita';
                    break;
                case 'REJECTED':
                    statusIcon = 'times-circle';
                    statusColor = '#dc3545';
                    statusText = 'Rejeitada';
                    break;
                case 'ALTERNATIVE_OFFERED':
                    statusIcon = 'lightbulb';
                    statusColor = '#ffc107';
                    statusText = 'Alternativa Oferecida';
                    break;
                case 'EXPIRED':
                    statusIcon = 'clock';
                    statusColor = '#6c757d';
                    statusText = 'Expirada';
                    break;
            }
            
            // Formata o tipo de resposta
            let respostaHtml = '';
            if (disputa.tipoDeResposta === 'additionalTime' && disputa.resposta?.additionalTimeInMinutes) {
                respostaHtml = `<p><i class="fas fa-clock"></i> +${disputa.resposta.additionalTimeInMinutes} minutos adicionais</p>`;
            }
            else if (disputa.tipoDeResposta === 'refund' && disputa.resposta?.amount?.value) {
                respostaHtml = `<p><i class="fas fa-money-bill-wave"></i> Reembolso de R$ ${parseFloat(disputa.resposta.amount.value)/100}</p>`;
            }
            else if (disputa.tipoDeResposta === 'benefit' && disputa.resposta?.amount?.value) {
                respostaHtml = `<p><i class="fas fa-gift"></i> Benefício de R$ ${parseFloat(disputa.resposta.amount.value)/100}</p>`;
            }
            
            // Adiciona ao HTML
            disputasHtml += `
                <div class="resumo-item">
                    <div class="resumo-header" style="border-left: 4px solid ${statusColor}">
                        <div class="resumo-status">
                            <i class="fas fa-${statusIcon}" style="color: ${statusColor}"></i>
                            <span>${statusText}</span>
                        </div>
                        <div class="resumo-date">${dataFormatada}</div>
                    </div>
                    <div class="resumo-content">
                        <p class="resumo-reason">${disputa.metadata?.originalDispute?.reason || 'Motivo não especificado'}</p>
                        ${respostaHtml}
                    </div>
                </div>
            `;
        });
        
        // Monta o conteúdo completo do modal
        resumoModalContainer.innerHTML = `
            <div class="modal-resumo-content">
                <div class="modal-resumo-header">
                    <h2>Histórico de Negociações</h2>
                    <button class="modal-resumo-close" onclick="fecharResumoNegociacao()">×</button>
                </div>
                <div class="modal-resumo-body">
                    ${disputasHtml}
                </div>
                <div class="modal-resumo-footer">
                    <button class="modal-resumo-fechar" onclick="fecharResumoNegociacao()">Fechar</button>
                </div>
            </div>
        `;
        
        // Exibe o modal
        resumoModalContainer.style.display = 'flex';
        
    } catch (error) {
        console.error('❌ Erro ao exibir resumo de negociações:', error);
        showToast('Erro ao exibir resumo de negociações', 'error');
    }
}

// Função para fechar o modal de resumo
function fecharResumoNegociacao() {
    const modalContainer = document.getElementById('modal-resumo-negociacao');
    if (modalContainer) {
        modalContainer.style.display = 'none';
    }
}

// Função para adicionar botão de resumo de negociação ao pedido
function atualizarBotaoResumoNegociacao(orderId) {
    try {
        // Verifica se existem disputas resolvidas para este pedido
        const temDisputasResolvidas = resolvedDisputes.some(d => d.orderId === orderId);
        
        if (!temDisputasResolvidas) {
            console.log(`📊 Nenhuma disputa resolvida para o pedido ${orderId}, botão não será adicionado`);
            return;
        }
        
        // Busca o card do pedido
        const orderCard = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
        if (!orderCard) {
            console.log(`📊 Card do pedido ${orderId} não encontrado na interface`);
            return;
        }
        
        // Busca o container de ações
        const actionsContainer = orderCard.querySelector('.order-actions');
        if (!actionsContainer) {
            console.log(`📊 Container de ações não encontrado para o pedido ${orderId}`);
            return;
        }
        
        // Verifica se o botão já existe
        const existingButton = actionsContainer.querySelector('.view-negotiation');
        if (existingButton) {
            console.log(`📊 Botão de resumo já existe para o pedido ${orderId}`);
            return;
        }
        
        // Cria o botão de ver resumo
        const resumeButton = document.createElement('button');
        resumeButton.className = 'action-button view-negotiation';
        resumeButton.innerHTML = '<i class="fas fa-handshake"></i> Ver Negociações';
        resumeButton.onclick = (e) => {
            e.stopPropagation(); // Impede que o card abra
            exibirResumoNegociacao(orderId);
        };
        
        // Adiciona o botão ao container de ações
        actionsContainer.appendChild(resumeButton);
        
        console.log(`📊 Botão de resumo adicionado ao pedido ${orderId}`);
        
    } catch (error) {
        console.error('❌ Erro ao adicionar botão de resumo de negociação:', error);
    }
}

// Adiciona estilos CSS para os novos componentes
function adicionarEstilosExtendidos() {
    const estilosElement = document.createElement('style');
    estilosElement.id = 'estilos-negociacao-extendidos';
    estilosElement.textContent = `
        /* Estilos para mensagem de expiração */
        .dispute-message .message-text.expired {
            color: #dc3545;
            font-weight: bold;
            animation: pulse 1s infinite;
        }
        
        /* Estilos para o botão de ver negociações */
        .action-button.view-negotiation {
            background-color: #6c757d;
            color: white;
        }
        
        .action-button.view-negotiation:hover {
            background-color: #5a6268;
        }
        
        /* Estilos para o modal de resumo de negociações */
        .modal-resumo-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            padding: 20px;
        }
        
        .modal-resumo-content {
            background-color: white;
            border-radius: 10px;
            width: 100%;
            max-width: 600px;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        }
        
        .modal-resumo-header {
            background-color: #ea1d2c;
            color: white;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
        }
        
        .modal-resumo-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }
        
        .modal-resumo-close {
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background-color: rgba(255, 255, 255, 0.2);
        }
        
        .modal-resumo-body {
            padding: 20px;
            overflow-y: auto;
            max-height: calc(90vh - 140px);
        }
        
        .resumo-item {
            background-color: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 15px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .resumo-header {
            display: flex;
            justify-content: space-between;
            padding: 12px 15px;
            background-color: #fff;
            border-bottom: 1px solid #eee;
        }
        
        .resumo-status {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
        }
        
        .resumo-date {
            font-size: 0.85em;
            color: #666;
        }
        
        .resumo-content {
            padding: 15px;
        }
        
        .resumo-reason {
            font-style: italic;
            color: #555;
            margin-bottom: 10px;
        }
        
        .modal-resumo-footer {
            padding: 15px;
            display: flex;
            justify-content: flex-end;
            border-top: 1px solid #eee;
            background-color: #f9f9f9;
        }
        
        .modal-resumo-fechar {
            padding: 8px 16px;
            background-color: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .modal-resumo-fechar:hover {
            background-color: #5a6268;
        }
    `;
    
    document.head.appendChild(estilosElement);
}

// Verifica periodicamente por disputas ativas (polling de backup)
function iniciarPollingDeDisputas() {
    console.log('🔄 Iniciando polling de backup para disputas...');
    
    // Define intervalo para verificar disputas a cada 60 segundos
    setInterval(async () => {
        if (!state.accessToken) return;
        
        try {
            console.log('🔄 Verificando disputas ativas via polling...');
            
            // Busca eventos via polling
            const events = await makeAuthorizedRequest('/events/v1.0/events:polling', 'GET');
            
            if (events && Array.isArray(events) && events.length > 0) {
                console.log(`🔄 ${events.length} eventos recebidos via polling`);
                
                // Filtra eventos de disputa
                const disputeEvents = events.filter(event => 
                    event.code === 'HANDSHAKE_DISPUTE' || 
                    event.fullCode === 'HANDSHAKE_DISPUTE' ||
                    event.code === 'HANDSHAKE_SETTLEMENT' || 
                    event.fullCode === 'HANDSHAKE_SETTLEMENT'
                );
                
                if (disputeEvents.length > 0) {
                    console.log(`🔄 ${disputeEvents.length} eventos de disputa encontrados`);
                    
                    // Processa cada evento de disputa
                    for (const event of disputeEvents) {
                        if (event.code === 'HANDSHAKE_DISPUTE' || event.fullCode === 'HANDSHAKE_DISPUTE') {
                            // Verifica se já temos esta disputa na lista de ativas
                            const disputeId = event.disputeId || event.metadata?.disputeId;
                            const alreadyProcessed = activeDisputes.some(d => d.disputeId === disputeId);
                            
                            if (!alreadyProcessed && disputeId) {
                                console.log(`🔄 Nova disputa ${disputeId} encontrada via polling`);
                                await processarEventoDisputa(event);
                            }
                        }
                        else if (event.code === 'HANDSHAKE_SETTLEMENT' || event.fullCode === 'HANDSHAKE_SETTLEMENT') {
                            // Processa evento de settlement
                            processarEventoSettlement(event);
                        }
                    }
                }
                
                // Formato correto para acknowledgment
                const acknowledgmentFormat = events.map(event => ({ id: event.id }));
                
                try {
                    // Envia acknowledgment para todos os eventos
                    await makeAuthorizedRequest('/events/v1.0/events/acknowledgment', 'POST', acknowledgmentFormat);
                    console.log('✅ Acknowledgment enviado com sucesso');
                } catch (ackError) {
                    console.error('❌ Erro ao enviar acknowledgment:', ackError);
                }
            }
        } catch (error) {
            console.error('❌ Erro no polling de disputas:', error);
        }
    }, 60000); // 60 segundos
}

// Sobrescreve algumas funções existentes para adicionar as novas funcionalidades

// 1. Estender função de processamento de evento de disputa original
const originalProcessarEventoDisputa = processarEventoDisputa;
window.processarEventoDisputa = async function(event) {
    try {
        // Verifica se é um evento de settlement
        if (event.code === 'HANDSHAKE_SETTLEMENT' || event.fullCode === 'HANDSHAKE_SETTLEMENT') {
            return processarEventoSettlement(event);
        }
        
        // Para eventos de disputa, chama a função original
        await originalProcessarEventoDisputa(event);
        
        // Depois que a função original for executada, busca a disputa na lista de ativas
        // para configurar o timer de expiração
        const disputeId = event.disputeId || event.metadata?.disputeId;
        
        if (disputeId) {
            const disputa = activeDisputes.find(d => d.disputeId === disputeId);
            
            if (disputa && disputa.expiresAt) {
                // Configura o timer para expiração
                const expiresAt = new Date(disputa.expiresAt);
                const now = new Date();
                const diffMs = expiresAt - now;
                
                if (diffMs > 0) {
                    console.log(`⏰ Configurando timer para disputa ${disputeId}, expira em ${Math.round(diffMs/1000)} segundos`);
                    
                    // Limpa qualquer timer existente para esta disputa
                    if (disputeTimerIntervals[disputeId]) {
                        clearTimeout(disputeTimerIntervals[disputeId]);
                    }
                    
                    // Configura o timer para executar quando o tempo expirar
                    disputeTimerIntervals[disputeId] = setTimeout(() => {
                        lidarComExpiracao(disputeId);
                    }, diffMs);
                }
                else {
                    // Já expirou
                    console.log(`⏰ Disputa ${disputeId} já expirou`);
                    lidarComExpiracao(disputeId);
                }
            }
        }
    } catch (error) {
        console.error('❌ Erro ao processar evento de disputa extendido:', error);
    }
};

// 2. Estender função de exibição do modal de negociação
const originalExibirModalNegociacao = exibirModalNegociacao;
window.exibirModalNegociacao = function(dispute) {
    // Primeiro, chama a função original
    originalExibirModalNegociacao(dispute);
    
    try {
        // Depois, adiciona as adaptações para disputas por atraso
        if (isDelayRelatedDispute(dispute)) {
            console.log('⏱️ Disputa relacionada a atraso, adaptando modal...');
            
            // Desabilita o botão de rejeitar para disputas por atraso (conforme documentação)
            const rejectButton = document.querySelector('.modal-negociacao-footer .dispute-button.reject');
            if (rejectButton) {
                rejectButton.style.display = 'none';
                console.log('⏱️ Botão de rejeição ocultado para disputa por atraso');
            }
        }
    } catch (error) {
        console.error('❌ Erro ao adaptar modal para disputa por atraso:', error);
    }
};

// 3. Estender função de proporAlternativa para registrar o tipo de resposta
const originalProporAlternativa = proporAlternativa;
window.proporAlternativa = async function(disputeId, alternativeId) {
    try {
        // Busca a disputa e alternativa correspondentes
        const disputa = activeDisputes.find(d => d.disputeId === disputeId);
        if (!disputa) throw new Error("Disputa não encontrada");
        
        const alternatives = disputa.metadata?.alternatives || [];
        const alternative = alternatives.find(a => a.id === alternativeId);
        if (!alternative) throw new Error("Alternativa não encontrada");
        
        // Determina o tipo de resposta e salva na disputa
        disputa.tipoDeResposta = alternative.type.toLowerCase();
        
        // Prepara objeto de resposta para histórico
        let resposta = {};
        if (alternative.type === "ADDITIONAL_TIME") {
            resposta = {
                additionalTimeInMinutes: alternative.metadata?.additionalTimeInMinutes || "15",
                additionalTimeReason: alternative.metadata?.additionalTimeReason || "HIGH_STORE_DEMAND"
            };
        } else if (alternative.type === "REFUND" || alternative.type === "BENEFIT") {
            if (alternative.metadata?.maxAmount?.value) {
                resposta = {
                    amount: {
                        value: alternative.metadata.maxAmount.value,
                        currency: "BRL"
                    }
                };
            }
        }
        
        // Salva objeto de resposta na disputa
        disputa.resposta = resposta;
        
        // Chama a função original para enviar a resposta
        return await originalProporAlternativa(disputeId, alternativeId);
    } catch (error) {
        console.error('❌ Erro ao propor alternativa:', error);
        showToast(`Erro: ${error.message}`, 'error');
        return false;
    }
};

// 4. Estender função de aceitarDisputa para registrar o tipo de resposta
const originalAceitarDisputa = aceitarDisputa;
window.aceitarDisputa = async function(disputeId) {
    try {
        // Atualiza informações de resposta
        const disputa = activeDisputes.find(d => d.disputeId === disputeId);
        if (disputa) {
            disputa.tipoDeResposta = 'accept';
            disputa.resposta = { accepted: true };
        }
        
        // Chama a função original
        return await originalAceitarDisputa(disputeId);
    } catch (error) {
        console.error('❌ Erro ao aceitar disputa:', error);
        showToast(`Erro ao aceitar negociação: ${error.message}`, 'error');
        return false;
    }
};

// 5. Estender função de rejeitarDisputa para registrar o tipo de resposta
const originalRejeitarDisputa = rejeitarDisputa;
window.rejeitarDisputa = async function(disputeId) {
    try {
        // Atualiza informações de resposta
        const disputa = activeDisputes.find(d => d.disputeId === disputeId);
        if (disputa) {
            disputa.tipoDeResposta = 'reject';
            disputa.resposta = { rejected: true };
        }
        
        // Chama a função original
        return await originalRejeitarDisputa(disputeId);
    } catch (error) {
        console.error('❌ Erro ao rejeitar disputa:', error);
        showToast(`Erro ao rejeitar negociação: ${error.message}`, 'error');
        return false;
    }
};

// 6. Estender função de proporTempoAdicional para registrar o tipo de resposta
const originalProporTempoAdicional = proporTempoAdicional;
window.proporTempoAdicional = async function(disputeId, minutos, motivo, alternativeId = '') {
    try {
        // Atualiza informações de resposta
        const disputa = activeDisputes.find(d => d.disputeId === disputeId);
        if (disputa) {
            disputa.tipoDeResposta = 'additionalTime';
            disputa.resposta = {
                additionalTimeInMinutes: minutos,
                additionalTimeReason: motivo
            };
        }
        
        // Chama a função original
        return await originalProporTempoAdicional(disputeId, minutos, motivo, alternativeId);
    } catch (error) {
        console.error('❌ Erro ao propor tempo adicional:', error);
        showToast(`Erro: ${error.message}`, 'error');
        return false;
    }
};

// Estende o handler de eventos existente para processar HANDSHAKE_SETTLEMENT
const originalHandlerEventos = window.handleEvent;
window.handleEvent = async function(event) {
    try {
        // Verifica se é um evento HANDSHAKE_SETTLEMENT
        if (event.code === 'HANDSHAKE_SETTLEMENT' || event.fullCode === 'HANDSHAKE_SETTLEMENT') {
            console.log('🤝 Evento de HANDSHAKE_SETTLEMENT recebido:', event);
            processarEventoSettlement(event);
            return;
        }
        
        // Para outros eventos, executa o handler original
        return originalHandlerEventos(event);
    } catch (error) {
        console.error('❌ Erro no handler de eventos extendido:', error);
        // Executa o handler original para garantir que o evento seja processado
        return originalHandlerEventos(event);
    }
};

// Função para inicializar as extensões de negociação
function initNegociacaoExtensions() {
    console.log('🚀 Inicializando extensões do módulo de negociação...');
    
    // Adiciona estilos CSS
    adicionarEstilosExtendidos();
    
    // Carrega disputas resolvidas do localStorage
    carregarDisputasResolvidas();
    
    // Inicia polling de backup para disputas
    iniciarPollingDeDisputas();
    
    // Adiciona função global para exibir resumo
    window.exibirResumoNegociacao = exibirResumoNegociacao;
    window.fecharResumoNegociacao = fecharResumoNegociacao;
    
    console.log('✅ Extensões do módulo de negociação inicializadas com sucesso');
}

// Inicializa as extensões após o carregamento do documento
document.addEventListener('DOMContentLoaded', initNegociacaoExtensions);
