// Módulo minimalista para tratar apenas eventos HANDSHAKE_SETTLEMENT
// Não interfere com outros fluxos ou na exibição de pedidos novos

// Array para armazenar disputas resolvidas
let resolvedDisputes = [];

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
        
        // Extrai informações importantes - CORREÇÃO AQUI
        const disputeId = event.metadata?.disputeId;
        const orderId = event.orderId;
        const status = event.metadata?.status;
        
        if (!disputeId || !status) {
            console.error('❌ Evento HANDSHAKE_SETTLEMENT inválido - Faltando disputeId ou status:', event);
            return;
        }
        
        console.log(`🤝 Disputa ${disputeId} finalizada com status: ${status}`);
        
        // Busca a disputa ativa correspondente
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
        if (disputaAtiva) {
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

// Verificar se uma disputa está relacionada a atraso
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

// Função para ocultar o botão "Rejeitar" em disputas por atraso
function ocultarBotaoRejeitar() {
    // Estende a função existente
    const originalExibirModalNegociacao = window.exibirModalNegociacao;
    
    if (typeof originalExibirModalNegociacao !== 'function') {
        console.error('❌ Função exibirModalNegociacao não encontrada');
        return;
    }
    
    window.exibirModalNegociacao = function(dispute) {
        // Primeiro, chama a função original
        originalExibirModalNegociacao(dispute);
        
        try {
            // Verifica se é uma disputa relacionada a atraso
            if (isDelayRelatedDispute(dispute)) {
                console.log('⏱️ Disputa relacionada a atraso, ocultando botão de rejeitar');
                
                // Usa setTimeout para garantir que o DOM esteja atualizado
                setTimeout(() => {
                    const rejectButton = document.querySelector('.modal-negociacao-footer .dispute-button.reject');
                    if (rejectButton) {
                        rejectButton.style.display = 'none';
                        console.log('⏱️ Botão de rejeição ocultado com sucesso');
                    } else {
                        console.log('⏱️ Botão de rejeição não encontrado');
                    }
                }, 100);
            }
        } catch (error) {
            console.error('❌ Erro ao processar modal de atraso:', error);
        }
    };
    
    console.log('✅ Interceptor para ocultar botão rejeitar adicionado');
}

// Adiciona estilos CSS específicos para o resumo
function adicionarEstilosMinimalistas() {
    // Verifica se os estilos já foram adicionados
    if (document.getElementById('estilos-negociacao-minimalistas')) {
        return;
    }

    const estilosElement = document.createElement('style');
    estilosElement.id = 'estilos-negociacao-minimalistas';
    estilosElement.textContent = `
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

// Estender proporTempoAdicional para registrar tipo de resposta
function estenderProporTempoAdicional() {
    const originalProporTempoAdicional = window.proporTempoAdicional;
    
    if (typeof originalProporTempoAdicional !== 'function') {
        console.error('❌ Função proporTempoAdicional não encontrada');
        return;
    }
    
    window.proporTempoAdicional = async function(disputeId, minutos, motivo, alternativeId = '') {
        // Registra tipo de resposta apenas para histórico
        const disputa = activeDisputes.find(d => d.disputeId === disputeId);
        if (disputa) {
            disputa.tipoDeResposta = 'additionalTime';
            disputa.resposta = {
                additionalTimeInMinutes: minutos,
                additionalTimeReason: motivo
            };
        }
        
        // Chama a função original sem modificá-la
        return await originalProporTempoAdicional.apply(this, arguments);
    };
}

// Apenas adiciona um interceptor mínimo para HANDSHAKE_SETTLEMENT
function adicionarInterceptorSettlement() {
    // Busca eventos HANDSHAKE_SETTLEMENT no polling existente
    const originalHandleEvent = window.handleEvent;
    
    if (typeof originalHandleEvent !== 'function') {
        console.error('❌ Função handleEvent não encontrada');
        return;
    }
    
    // Sobrescreve de forma segura
    window.handleEvent = async function(event) {
        try {
            // Intercepta apenas eventos HANDSHAKE_SETTLEMENT antes de prosseguir
            if ((event.code === 'HANDSHAKE_SETTLEMENT' || event.fullCode === 'HANDSHAKE_SETTLEMENT') &&
                event.metadata?.disputeId && 
                event.metadata?.status) {
                console.log('🤝 Interceptado HANDSHAKE_SETTLEMENT no handleEvent');
                processarEventoSettlement(event);
            }
            
            // Continua com o processamento normal
            return await originalHandleEvent.apply(this, arguments);
        } catch (error) {
            console.error('❌ Erro no interceptor de HANDSHAKE_SETTLEMENT:', error);
            // Continua com o processamento normal em caso de erro
            return await originalHandleEvent.apply(this, arguments);
        }
    };
    
    console.log('✅ Interceptor minimalista para HANDSHAKE_SETTLEMENT adicionado');
}

// Função principal para inicializar (sem afetar outros componentes)
function initMinimalistaSettlement() {
    console.log('🚀 Inicializando tratamento minimalista para HANDSHAKE_SETTLEMENT...');
    
    // Carrega histórico de negociações
    carregarDisputasResolvidas();
    
    // Adiciona estilos necessários para o resumo
    adicionarEstilosMinimalistas();
    
    // Intercepta HANDSHAKE_SETTLEMENT sem interferir no fluxo principal
    adicionarInterceptorSettlement();
    
    // Estende proporTempoAdicional para registrar o tipo de resposta
    estenderProporTempoAdicional();
    
    // Adiciona interceptor para ocultar botão rejeitar em disputas por atraso
    ocultarBotaoRejeitar();
    
    // Expõe funções globalmente
    window.processarEventoSettlement = processarEventoSettlement;
    window.exibirResumoNegociacao = exibirResumoNegociacao;
    window.fecharResumoNegociacao = fecharResumoNegociacao;
    
    console.log('✅ Tratamento minimalista para HANDSHAKE_SETTLEMENT inicializado');
}

// Inicializa apenas quando o documento estiver totalmente carregado
document.addEventListener('DOMContentLoaded', initMinimalistaSettlement);
