// Módulo de Negociação para Plataforma de Handshake do iFood
// Este arquivo implementa o suporte à plataforma de negociação para pedidos do iFood
// Ele permite responder a disputas (HANDSHAKE_DISPUTE) para casos como:
// 1. Cancelamento após conclusão, durante o preparo ou atraso na entrega
// 2. Solicitação de cancelamento com proposta de reembolso
// 3. Solicitação de cancelamento por atraso com proposta de novo tempo de entrega

// Estado para controle de disputas (negociações) ativas
let activeDisputes = [];
let currentDisputeId = null;

// Função para inicializar o módulo de negociação
function initNegociacao() {
    console.log('🤝 Inicializando módulo de negociação para plataforma de handshake...');
    
    // Adiciona os estilos CSS
    adicionarEstilosNegociacao();
    
    // Adiciona o container do modal ao body se não existir
    criarContainerModalNegociacao();
    
    // Estende o handler de eventos para capturar eventos de disputas
    estenderHandlerEventos();
    
    console.log('✅ Módulo de negociação inicializado com sucesso');
}

// Função para estender o handler de eventos para capturar eventos de disputas
function estenderHandlerEventos() {
    // Verifica se a função handleEvent existe
    if (typeof window.handleEvent !== 'function') {
        console.error('❌ Função handleEvent não encontrada. Módulo de negociação não funcionará corretamente.');
        return;
    }
    
    // Guarda a função original
    const originalHandleEvent = window.handleEvent;
    
    // Substitui a função de tratamento de eventos
    window.handleEvent = async function(event) {
        try {
            // Verifica se é um evento de disputa (HANDSHAKE_DISPUTE)
            if (event.code === 'HANDSHAKE_DISPUTE' || event.fullCode === 'HANDSHAKE_DISPUTE') {
                console.log('🤝 Evento de disputa (HANDSHAKE_DISPUTE) recebido:', event);
                
                // Processa o evento de disputa
                await processarEventoDisputa(event);
                
                // Retorna após processar, para não executar o fluxo original
                return;
            }
            
            // Para outros eventos, executa o handler original
            return originalHandleEvent(event);
        } catch (error) {
            console.error('❌ Erro ao processar evento:', error);
            return originalHandleEvent(event);
        }
    };
}

// Função para processar eventos de disputa (HANDSHAKE_DISPUTE)
async function processarEventoDisputa(event) {
    try {
        // Extract disputeId from event
        let disputeId = null;
        
        if (event.code === 'HANDSHAKE_DISPUTE' || event.fullCode === 'HANDSHAKE_DISPUTE') {
            // Check for disputeId in different possible locations
            if (event.disputeId) {
                disputeId = event.disputeId;
            } 
            else if (event.metadata && event.metadata.disputeId) {
                disputeId = event.metadata.disputeId;
            } else {
                console.error('❌ Evento de disputa sem disputeId:', event);
                
                // Try to find disputeId in any field
                for (const key in event) {
                    if (typeof event[key] === 'object' && event[key] !== null) {
                        if (event[key].disputeId) {
                            disputeId = event[key].disputeId;
                            console.log('✅ DisputeId encontrado em outro campo:', disputeId);
                            break;
                        }
                    }
                }
                
                if (!disputeId) {
                    console.error('❌ Não foi possível encontrar disputeId no evento:', event);
                    showToast('Evento de disputa inválido recebido', 'error');
                    return;
                }
            }
        } else {
            console.error('❌ Tipo de evento não reconhecido:', event.code);
            return;
        }
        
        console.log('✅ Processando disputa com ID:', disputeId);
        
        // Prepare dispute data
        const disputeData = {
            disputeId: disputeId,
            orderId: event.orderId,
            customerName: await getCustomerNameFromOrder(event.orderId) || 'Cliente',
            type: event.metadata?.handshakeType || 'UNKNOWN',
            reason: event.metadata?.message || 'Motivo não especificado',
            expiresAt: event.metadata?.expiresAt,
            timeoutAction: event.metadata?.timeoutAction,
            alternatives: event.metadata?.alternatives || [],
            metadata: event.metadata,
            ...event
        };
        
        console.log('Dados da disputa preparados:', disputeData);
        
        // Add to active disputes list
        addActiveDispute(disputeData);
        
        // Display negotiation modal
        exibirModalNegociacao(disputeData);
        
        // Play alert sound
        emitirAlertaNegociacao();
        
    } catch (error) {
        console.error('❌ Erro ao processar evento de disputa:', error);
        showToast('Erro ao processar solicitação de negociação', 'error');
    }
}

// Helper function to get customer name from order
async function getCustomerNameFromOrder(orderId) {
    if (!orderId) return null;
    
    try {
        const order = await makeAuthorizedRequest(`/order/v1.0/orders/${orderId}`, 'GET');
        return order?.customer?.name || null;
    } catch (error) {
        console.warn('⚠️ Não foi possível obter nome do cliente do pedido:', error);
        return null;
    }
}

// Função para adicionar uma disputa à lista de ativas
function addActiveDispute(dispute) {
    // Verifica se já existe uma disputa com o mesmo ID
    const existingIndex = activeDisputes.findIndex(d => d.disputeId === dispute.disputeId);
    
    if (existingIndex >= 0) {
        // Atualiza a disputa existente
        activeDisputes[existingIndex] = dispute;
    } else {
        // Adiciona nova disputa
        activeDisputes.push(dispute);
    }
    
    console.log('📋 Disputas ativas atualizadas:', activeDisputes);
}

// Função para remover uma disputa da lista de ativas
function removeActiveDispute(disputeId) {
    activeDisputes = activeDisputes.filter(d => d.disputeId !== disputeId);
    console.log('📋 Disputas ativas após remoção:', activeDisputes);
}

async function aceitarDisputa(disputeId) {
    try {
        console.log(`🤝 Aceitando disputa ${disputeId}...`);
        showLoading();
        
        // Busca a disputa na lista ativa
        const disputa = activeDisputes.find(d => d.disputeId === disputeId);
        let body = null;
        
        // Verifica se precisa enviar reason baseado no metadata
        if (disputa && disputa.metadata && disputa.metadata.metadata && 
            disputa.metadata.metadata.acceptCancellationReasons) {
            body = {
                reason: disputa.metadata.metadata.acceptCancellationReasons[0], // Usa o primeiro disponível
                detailReason: "Confirmado pelo estabelecimento"
            };
            console.log('✅ Enviando reason para aceitação:', body);
        }
        
        // Usa o endpoint correto com ou sem body conforme necessário
        const response = await makeAuthorizedRequest(`/order/v1.0/disputes/${disputeId}/accept`, 'POST', body);
        
        console.log('✅ Disputa aceita com sucesso:', response);
        showToast('Negociação aceita com sucesso', 'success');
        
        // Remove da lista de disputas ativas
        removeActiveDispute(disputeId);
        
        // Fecha o modal
        fecharModalNegociacao();
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao aceitar disputa:', error);
        showToast(`Erro ao aceitar negociação: ${error.message}`, 'error');
        return false;
    } finally {
        hideLoading();
    }
}

async function rejeitarDisputa(disputeId) {
    try {
        console.log(`🤝 Rejeitando disputa ${disputeId}...`);
        showLoading();
        
        // Obrigatório enviar reason para rejeição
        const body = {
            reason: "Rejeitado pelo estabelecimento"
        };
        
        const response = await makeAuthorizedRequest(`/order/v1.0/disputes/${disputeId}/reject`, 'POST', body);
        
        console.log('✅ Disputa rejeitada com sucesso:', response);
        showToast('Negociação rejeitada com sucesso', 'success');
        
        // Remove da lista de disputas ativas
        removeActiveDispute(disputeId);
        
        // Fecha o modal
        fecharModalNegociacao();
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao rejeitar disputa:', error);
        showToast(`Erro ao rejeitar negociação: ${error.message}`, 'error');
        return false;
    } finally {
        hideLoading();
    }
}

async function proporAlternativa(disputeId, alternativeId) {
    try {
        console.log(`🤝 Propondo alternativa ${alternativeId} para disputa ${disputeId}`);
        showLoading();

        // Find the dispute in the active disputes array
        const disputa = activeDisputes.find(d => d.disputeId === disputeId);
        if (!disputa) throw new Error("Disputa não encontrada");

        // Find the specific alternative in the dispute
        const alternatives = disputa.metadata?.alternatives || [];
        const alternative = alternatives.find(a => a.id === alternativeId);
        if (!alternative) throw new Error("Alternativa não encontrada");
        
        console.log("Alternativa selecionada:", alternative);

        // Create a proper payload according to iFood API
        const payload = {
            type: alternative.type
        };

        // Add metadata based on alternative type
        if (alternative.type === "ADDITIONAL_TIME") {
            payload.metadata = {
                additionalTimeInMinutes: String(alternative.metadata?.additionalTimeInMinutes || "15"),
                additionalTimeReason: alternative.metadata?.additionalTimeReason || "HIGH_STORE_DEMAND"
            };
        } else if (alternative.type === "REFUND" || alternative.type === "BENEFIT") {
            if (alternative.metadata?.maxAmount?.value) {
                payload.metadata = {
                    amount: {
                        value: String(parseInt(alternative.metadata.maxAmount.value)),
                        currency: "BRL"
                    }
                };
            }
        }

        console.log("Payload a ser enviado:", payload);

        const response = await makeAuthorizedRequest(
            `/order/v1.0/disputes/${disputeId}/alternatives/${alternativeId}`,
            "POST",
            payload
        );

        console.log("✅ Alternativa enviada com sucesso:", response);
        showToast("Alternativa proposta com sucesso", "success");

        // Remove from active disputes and close modal
        removeActiveDispute(disputeId);
        fecharModalNegociacao();

        return true;
    } catch (error) {
        console.error("❌ Erro ao propor alternativa:", error);
        showToast(`Erro: ${error.message}`, "error");
        return false;
    } finally {
        hideLoading();
    }
}

// Função para criar o modal de negociação
function criarContainerModalNegociacao() {
    // Verifica se o container já existe
    if (document.getElementById('modal-negociacao-container')) {
        return;
    }
    
    // Cria o container do modal
    const modalContainer = document.createElement('div');
    modalContainer.id = 'modal-negociacao-container';
    modalContainer.className = 'modal-negociacao-container';
    modalContainer.style.display = 'none';
    
    // Adiciona o container ao body
    document.body.appendChild(modalContainer);
    
    console.log('✅ Container do modal de negociação criado');
}

function exibirModalNegociacao(dispute) {
    // Atualiza o ID da disputa atual
    currentDisputeId = dispute.disputeId;
    
    // Obtém o container do modal
    const modalContainer = document.getElementById('modal-negociacao-container');
    if (!modalContainer) {
        console.error('Container do modal de negociação não encontrado');
        return;
    }
    
    console.log("Exibindo modal para disputa:", dispute);
    
    // Extrai informações relevantes da disputa
    const orderId = dispute.orderId || 'N/A';
    const orderDisplayId = dispute.displayId || orderId.substring(0, 6);
    const customerName = dispute.customerName || 'Cliente';
    const expiresAt = dispute.expiresAt ? new Date(dispute.expiresAt) : null;
    const timeoutAction = dispute.timeoutAction || 'ACCEPT';
    const reason = dispute.reason || 'Não especificado';
    
    // Determina o tipo de disputa
    const disputeType = dispute.type || dispute.metadata?.handshakeType || 'UNKNOWN';
    console.log("Tipo de disputa:", disputeType);
    
    // Identifica se é uma disputa relacionada a atraso
    const isDelayRelated = 
        disputeType === 'PREPARATION_TIME' || 
        disputeType === 'ORDER_LATE' || 
        disputeType === 'DELAY' ||
        disputeType === 'CANCELLATION_WITH_DELAY_PROPOSAL';
    
    console.log("É disputa relacionada a atraso?", isDelayRelated);
    
    // Formata o tempo restante
    let timeRemaining = '';
    if (expiresAt) {
        const now = new Date();
        const diffMs = expiresAt - now;
        const diffMins = Math.round(diffMs / 60000);
        timeRemaining = diffMins > 0 ? `${diffMins} minutos` : 'expirando';
    }
    
    // Cria o título baseado no tipo de disputa
    let disputeTitle = 'Solicitação de Negociação';
    let disputeIcon = 'handshake';
    
    switch(disputeType) {
        case 'CANCELLATION_WITH_REFUND_PROPOSAL':
            disputeTitle = 'Solicitação de Cancelamento com Reembolso';
            disputeIcon = 'money-bill-wave';
            break;
        case 'CANCELLATION_WITH_DELAY_PROPOSAL':
        case 'PREPARATION_TIME': 
        case 'ORDER_LATE':
        case 'DELAY':
            disputeTitle = 'Cancelamento por Atraso';
            disputeIcon = 'clock';
            break;
        case 'CANCELLATION_REQUEST':
            disputeTitle = 'Solicitação de Cancelamento';
            disputeIcon = 'times-circle';
            break;
    }
    
    // Obtém as alternativas da disputa
    const alternatives = dispute.metadata?.alternatives || dispute.alternatives || [];
    console.log("Alternativas disponíveis:", alternatives);
    
    // Procura por alternativa de tempo adicional e extrai opções
    const timeAlternative = alternatives.find(a => a.type === "ADDITIONAL_TIME");
    console.log("Alternativa de tempo encontrada:", timeAlternative);
    
    // Extrai tempos e motivos permitidos
    const allowedTimes = timeAlternative?.metadata?.allowedsAdditionalTimeInMinutes || [10, 15, 20, 30];
    const allowedReasons = timeAlternative?.metadata?.allowedsAdditionalTimeReasons || ["HIGH_STORE_DEMAND"];
    
    console.log("Tempos permitidos:", allowedTimes);
    console.log("Motivos permitidos:", allowedReasons);
    
    // Inicia HTML vazio
    let alternativesHtml = '';
    
    // Se for disputa relacionada a atraso, monta a seção de opções de tempo
    if (isDelayRelated) {
        alternativesHtml = `
            <div class="negotiation-alternatives">
                <h3>Opções de Resposta</h3>
                
                <div class="time-options-section">
                    <h4>Adicionar Tempo ao Pedido</h4>
                    <div class="time-options-grid">`;
                    
// Adiciona um botão para cada tempo permitido
allowedTimes.forEach(minutes => {
    alternativesHtml += `
        <button class="time-option-button" onclick="selecionarMotivoTempo('${dispute.disputeId}', '${minutes}', '${timeAlternative?.id || ''}', ${JSON.stringify(allowedReasons)})">
            <i class="fas fa-clock"></i> +${minutes} minutos
        </button>`;
});
        
        alternativesHtml += `
                    </div>
                </div>
                
                <div class="cancellation-options-section">
                    <h4>Informar que o Pedido Não Será Entregue</h4>
                    <button class="cancellation-option-button" onclick="abrirModalMotivoCancelamento('${dispute.disputeId}')">
                        <i class="fas fa-times-circle"></i> Pedido Não Será Entregue
                    </button>
                </div>
            </div>
        `;
    }
    
    // Gera HTML para outras alternativas
    let otherAlternativesHtml = '';
    
    if (alternatives.length > 0) {
        // Filtra para remover ADDITIONAL_TIME se já estamos lidando com isso acima
        const otherAlts = isDelayRelated 
            ? alternatives.filter(a => a.type !== "ADDITIONAL_TIME") 
            : alternatives;
            
        if (otherAlts.length > 0) {
            otherAlternativesHtml = `
                <div class="negotiation-alternatives">
                    <h3>Outras Alternativas Disponíveis</h3>
                    <div class="alternatives-container">
            `;
            
            otherAlts.forEach(alternative => {
                let altContent = '';
                
                switch (alternative.type) {
                    case 'REFUND':
                        const refundValue = alternative.metadata && alternative.metadata.maxAmount 
                            ? `R$ ${parseFloat(alternative.metadata.maxAmount.value)/100}` 
                            : 'Valor não especificado';
                        altContent = `
                            <div class="alternative-details">
                                <i class="fas fa-money-bill-wave"></i>
                                <div>
                                    <h4>Proposta de Reembolso</h4>
                                    <p>Valor: ${refundValue}</p>
                                    <p>${alternative.description || ''}</p>
                                </div>
                            </div>
                        `;
                        break;
                        
                    case 'BENEFIT':
                        const benefitValue = alternative.metadata && alternative.metadata.maxAmount 
                            ? `R$ ${parseFloat(alternative.metadata.maxAmount.value)/100}` 
                            : 'Valor não especificado';
                        altContent = `
                            <div class="alternative-details">
                                <i class="fas fa-gift"></i>
                                <div>
                                    <h4>Oferecer Benefício</h4>
                                    <p>Valor: ${benefitValue}</p>
                                    <p>${alternative.description || ''}</p>
                                </div>
                            </div>
                        `;
                        break;
                        
                    default:
                        altContent = `
                            <div class="alternative-details">
                                <i class="fas fa-exclamation-circle"></i>
                                <div>
                                    <h4>${alternative.type || 'Alternativa'}</h4>
                                    <p>${alternative.description || 'Sem descrição'}</p>
                                </div>
                            </div>
                        `;
                }
                
                otherAlternativesHtml += `
                    <div class="alternative-option">
                        <div class="alternative-card">
                            ${altContent}
                        </div>
                        <button class="alternative-button" onclick="proporAlternativa('${dispute.disputeId}', '${alternative.id}')">
                            Propor esta alternativa
                        </button>
                    </div>
                `;
            });
            
            otherAlternativesHtml += `
                    </div>
                </div>
            `;
        }
    }
    
    // Adiciona seção para resposta do cliente se existir
    let clientResponseHtml = '';
    if (dispute.responseFromCustomer) {
        clientResponseHtml = `
            <div class="customer-response">
                <h3>Resposta do Cliente</h3>
                <div class="response-content">
                    <p><i class="fas fa-comment"></i> ${dispute.responseFromCustomer}</p>
                </div>
            </div>
        `;
    }
    
    // Cria o conteúdo do modal
    modalContainer.innerHTML = `
        <div class="modal-negociacao-content">
            <div class="modal-negociacao-header">
                <div class="modal-negociacao-title">
                    <i class="fas fa-${disputeIcon}"></i>
                    <h2>${disputeTitle}</h2>
                </div>
                <span class="modal-negociacao-pedido">Pedido #${orderDisplayId}</span>
                <button class="modal-negociacao-close" onclick="fecharModalNegociacao()">×</button>
            </div>
            
            <div class="modal-negociacao-body">
                <div class="dispute-info">
                    <div class="dispute-row">
                        <span class="dispute-label">Cliente:</span>
                        <span class="dispute-value">${customerName}</span>
                    </div>
                    <div class="dispute-row">
                        <span class="dispute-label">Motivo:</span>
                        <span class="dispute-value">${reason}</span>
                    </div>
                    ${expiresAt ? `
                    <div class="dispute-row">
                        <span class="dispute-label">Tempo restante:</span>
                        <span class="dispute-value dispute-timer">${timeRemaining}</span>
                    </div>
                    <div class="dispute-row">
                        <span class="dispute-label">Ação automática:</span>
                        <span class="dispute-value">${timeoutAction === 'ACCEPT' ? 'Aceitar cancelamento' : 'Rejeitar cancelamento'}</span>
                    </div>
                    ` : ''}
                </div>
                
                ${clientResponseHtml}
                
                ${dispute.photos && dispute.photos.length > 0 ? `
                <div class="dispute-photos">
                    <h3>Evidências do cliente</h3>
                    <div class="photos-container">
                        ${dispute.photos.map(photo => `
                            <div class="photo-item">
                                <img src="${photo.url}" alt="Evidência do cliente" onclick="abrirImagemAmpliada('${photo.url}')">
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                ${alternativesHtml}
                
                ${otherAlternativesHtml}
                
                <div class="dispute-message">
                    <p class="message-text">
                        <i class="fas fa-info-circle"></i>
                        ${isDelayRelated ? 
                            'Selecione uma das opções acima ou aceite/rejeite a solicitação de cancelamento.' : 
                            (alternatives.length > 0 ? 
                                'Você pode aceitar o cancelamento, rejeitá-lo ou oferecer uma alternativa.' : 
                                'Você pode aceitar ou rejeitar esta solicitação de cancelamento.')}
                    </p>
                </div>
            </div>
            
            <div class="modal-negociacao-footer">
                <button class="dispute-button reject" onclick="rejeitarDisputa('${dispute.disputeId}')">
                    <i class="fas fa-times"></i> Rejeitar
                </button>
                <button class="dispute-button accept" onclick="aceitarDisputa('${dispute.disputeId}')">
                    <i class="fas fa-check"></i> Aceitar
                </button>
            </div>
        </div>
    `;
    
    // Exibe o modal
    modalContainer.style.display = 'flex';
    
    // Inicia o timer de atualização do tempo restante
    if (expiresAt) {
        iniciarContadorTempo(expiresAt);
    }
    
    console.log('✅ Modal de negociação exibido para a disputa:', dispute);
}

// Variáveis para controle do seletor de motivo
let currentDisputeIdForReason = null;
let currentSelectedMinutes = null;
let currentAlternativeId = null;

// Função para abrir seleção de motivo após escolher o tempo
function selecionarMotivoTempo(disputeId, minutos, alternativeId, allowedReasons) {
    console.log(`🕰️ Selecionando motivo para atraso de ${minutos} minutos`);
    console.log("Motivos permitidos:", allowedReasons);
    
    // Preserva todos os valores para uso posterior
    currentDisputeIdForReason = disputeId;
    currentSelectedMinutes = minutos;
    currentAlternativeId = alternativeId;
    
    // Cria modal diretamente - abordagem simplificada
    const modalHTML = `
        <div id="modal-selecao-motivo" class="modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); z-index: 10000; justify-content: center; align-items: center;">
            <div class="modal-content" style="background-color: white; border-radius: 10px; width: 100%; max-width: 500px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.3);">
                <div class="modal-header" style="background-color: #0d6efd; color: white; padding: 15px 20px; position: relative;">
                    <h2 style="margin: 0; font-size: 18px;">Motivo do Atraso</h2>
                    <button onclick="document.getElementById('modal-selecao-motivo').remove(); document.getElementById('modal-negociacao-container').style.display='flex';" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.2); border: none; width: 30px; height: 30px; border-radius: 50%; color: white; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <p style="margin-bottom: 15px;">Selecione o motivo pelo qual o pedido atrasará <strong style="color: #0d6efd; font-size: 18px;">${minutos} minutos</strong>:</p>
                    <select id="motivo-atraso-select" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; margin-top: 10px; background-color: #f8f9fa;">
                        ${allowedReasons.map(reason => {
                            const reasonText = getReasonText(reason);
                            return `<option value="${reason}">${reasonText}</option>`;
                        }).join('')}
                    </select>
                </div>
                <div class="modal-footer" style="padding: 15px 20px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #eee;">
                    <button onclick="document.getElementById('modal-selecao-motivo').remove(); document.getElementById('modal-negociacao-container').style.display='flex';" style="padding: 10px 18px; background-color: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">Cancelar</button>
                    <button onclick="confirmarMotivoSelecionado()" style="padding: 10px 18px; background-color: #0d6efd; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">Confirmar</button>
                </div>
            </div>
        </div>
    `;
    
    // Adiciona o modal ao body
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalHTML;
    document.body.appendChild(modalDiv.firstChild);
    
    // Oculta o modal de negociação
    document.getElementById('modal-negociacao-container').style.display = 'none';
}

// Função auxiliar para obter texto amigável para os motivos
function getReasonText(reason) {
    const reasonMap = {
        'HIGH_STORE_DEMAND': 'Alta demanda na loja',
        'OPERATIONAL_ISSUES': 'Problemas operacionais',
        'LACK_OF_DRIVERS': 'Falta de entregadores',
        'ORDER_OUT_FOR_DELIVERY': 'Pedido já saiu para entrega',
        'DRIVER_IS_ALREADY_AT_THE_ADDRESS': 'Entregador já está no endereço',
        'DRIVER_COULDNT_FIND_THE_ADDRESS': 'Entregador não encontrou o endereço',
        'LACK_OF_PRODUCTS': 'Falta de produtos',
        'LOW_STORE_CAPACITY': 'Capacidade limitada da loja',
        'SYSTEM_ISSUES': 'Problemas no sistema'
    };
    
    return reasonMap[reason] || reason;
}

// Função para confirmar o motivo selecionado
function confirmarMotivoSelecionado() {
    // Obtém o motivo selecionado
    const motivoSelect = document.getElementById('motivo-atraso-select');
    const motivo = motivoSelect.value;
    
    // Remove o modal
    document.getElementById('modal-selecao-motivo').remove();
    
    // Chama a função para propor o tempo adicional com o motivo selecionado
    proporTempoAdicional(
        currentDisputeIdForReason,
        currentSelectedMinutes,
        motivo,
        currentAlternativeId
    );
}

// Função original ajustada para receber o motivo selecionado
async function proporTempoAdicional(disputeId, minutos, motivo, alternativeId = '') {
    try {
        console.log(`🤝 Propondo tempo adicional de ${minutos} minutos para a disputa ${disputeId}`);
        console.log(`📝 Motivo selecionado: ${motivo}`);
        showLoading();

        // Prepara o payload
        const payload = {
            type: "ADDITIONAL_TIME",
            metadata: {
                additionalTimeInMinutes: String(minutos),
                additionalTimeReason: motivo
            }
        };
        
        let endpoint = '';
        if (alternativeId && alternativeId.trim() !== '') {
            // Usa endpoint de alternativa
            endpoint = `/order/v1.0/disputes/${disputeId}/alternatives/${alternativeId}`;
        } else {
            // Usa endpoint padrão
            endpoint = `/order/v1.0/disputes/${disputeId}/additionalTime`;
        }

        console.log("📦 Payload a ser enviado:", payload);
        console.log("🔗 Endpoint:", endpoint);

        const response = await makeAuthorizedRequest(endpoint, "POST", payload);

        console.log("✅ Tempo adicional proposto com sucesso:", response);
        showToast(`Tempo adicional de ${minutos} minutos proposto com sucesso`, "success");

        // Remove from active disputes and close modal
        removeActiveDispute(disputeId);
        fecharModalNegociacao();

        return true;
    } catch (error) {
        console.error("❌ Erro ao propor tempo adicional:", error);
        showToast(`Erro: ${error.message}`, "error");
        return false;
    } finally {
        hideLoading();
    }
}

// Variáveis para controle do modal de motivo de cancelamento
let currentDisputeIdForCancellation = null;

// Função para abrir o modal de motivo de cancelamento
function abrirModalMotivoCancelamento(disputeId) {
    // Atualiza o ID da disputa atual para cancelamento
    currentDisputeIdForCancellation = disputeId;
    
    // Fecha o modal de negociação
    const modalNegociacao = document.getElementById('modal-negociacao-container');
    if (modalNegociacao) {
        modalNegociacao.style.display = 'none';
    }
    
    // Cria o modal se não existir
    let modalContainer = document.getElementById('modal-motivo-cancelamento');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modal-motivo-cancelamento';
        modalContainer.className = 'modal';
        
        modalContainer.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Motivo do Cancelamento</h2>
                    <span class="close-modal" onclick="fecharModalMotivoCancelamento()">&times;</span>
                </div>
                <div class="modal-body">
                    <p>Selecione o motivo pelo qual o pedido não será entregue:</p>
                    <select id="motivo-cancelamento" class="cancellation-select">
                        <option value="HIGH_STORE_DEMAND">Alta demanda na loja</option>
                        <option value="STORE_SYSTEM_ISSUE">Problemas no sistema da loja</option>
                        <option value="INTERNAL_DIFFICULTIES">A loja está passando por dificuldades internas</option>
                        <option value="OUT_OF_PRODUCT">Produtos indisponíveis</option>
                        <option value="CLOSED_STORE">Loja está fechando</option>
                        <option value="OTHER">Outro motivo</option>
                    </select>
                    
                    <div id="outro-motivo-container" style="display: none; margin-top: 15px;">
                        <label for="outro-motivo">Especifique o motivo:</label>
                        <textarea id="outro-motivo" rows="3" class="cancellation-textarea" placeholder="Descreva o motivo do cancelamento..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="confirmar-motivo-cancelamento" class="action-button cancel" onclick="confirmarCancelamentoLoja()">Confirmar Cancelamento</button>
                    <button class="action-button" onclick="fecharModalMotivoCancelamento()">Voltar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modalContainer);
        
        // Adiciona evento para mostrar/ocultar o campo "outro motivo"
        const selectMotivo = document.getElementById('motivo-cancelamento');
        selectMotivo.addEventListener('change', function() {
            const outroMotivoContainer = document.getElementById('outro-motivo-container');
            if (this.value === 'OTHER') {
                outroMotivoContainer.style.display = 'block';
            } else {
                outroMotivoContainer.style.display = 'none';
            }
        });
    }
    
    // Exibe o modal
    modalContainer.style.display = 'flex';
}

// Função para fechar o modal de motivo de cancelamento
function fecharModalMotivoCancelamento() {
    const modalContainer = document.getElementById('modal-motivo-cancelamento');
    if (modalContainer) {
        modalContainer.style.display = 'none';
    }
    
    // Reexibe o modal de negociação
    const modalNegociacao = document.getElementById('modal-negociacao-container');
    if (modalNegociacao) {
        modalNegociacao.style.display = 'flex';
    }
    
    // Limpa o ID atual
    currentDisputeIdForCancellation = null;
}

// Função para confirmar cancelamento pela loja
async function confirmarCancelamentoLoja() {
    try {
        if (!currentDisputeIdForCancellation) {
            showToast('Erro: ID da disputa não encontrado', 'error');
            return;
        }
        
        // Obtém o motivo selecionado
        const selectMotivo = document.getElementById('motivo-cancelamento');
        const motivoSelecionado = selectMotivo.value;
        
        // Verifica se é "outro" e obtém a descrição
        let motivoDescricao = selectMotivo.options[selectMotivo.selectedIndex].text;
        if (motivoSelecionado === 'OTHER') {
            const outroMotivo = document.getElementById('outro-motivo').value.trim();
            if (!outroMotivo) {
                showToast('Por favor, especifique o motivo do cancelamento', 'warning');
                return;
            }
            motivoDescricao = outroMotivo;
        }
        
        // Fechar o modal
        fecharModalMotivoCancelamento();
        showLoading();
        
        // Enviar a requisição de aceitação de cancelamento
        const response = await makeAuthorizedRequest(`/order/v1.0/disputes/${currentDisputeIdForCancellation}/accept`, 'POST', {
            reason: motivoSelecionado,
            detailReason: motivoDescricao
        });
        
        console.log('✅ Cancelamento confirmado com sucesso:', response);
        showToast('Cancelamento confirmado com sucesso!', 'success');
        
        // Remove da lista de disputas ativas
        removeActiveDispute(currentDisputeIdForCancellation);
        
    } catch (error) {
        console.error('❌ Erro ao confirmar cancelamento:', error);
        showToast(`Erro ao confirmar cancelamento: ${error.message}`, 'error');
    } finally {
        hideLoading();
        currentDisputeIdForCancellation = null;
    }
}

// Função para fechar o modal de negociação
function fecharModalNegociacao() {
    // Obtém o container do modal
    const modalContainer = document.getElementById('modal-negociacao-container');
    if (modalContainer) {
        modalContainer.style.display = 'none';
    }
    
    // Limpa o ID da disputa atual
    currentDisputeId = null;
    
    // Para o timer se estiver rodando
    if (window.timeUpdateInterval) {
        clearInterval(window.timeUpdateInterval);
        window.timeUpdateInterval = null;
    }
    
    console.log('✅ Modal de negociação fechado');
}

// Função para iniciar o contador de tempo
function iniciarContadorTempo(expiresAt) {
    // Limpa intervalo anterior se existir
    if (window.timeUpdateInterval) {
        clearInterval(window.timeUpdateInterval);
    }
    
    // Função para atualizar o contador
    const updateTimer = () => {
        const now = new Date();
        const diffMs = expiresAt - now;
        
        // Se já expirou
        if (diffMs <= 0) {
            clearInterval(window.timeUpdateInterval);
            document.querySelector('.dispute-timer').textContent = 'Expirado';
            document.querySelector('.dispute-timer').classList.add('expired');
            return;
        }
        
        // Calcula tempo restante
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        
        // Formata e atualiza
        const timeText = `${diffMins}:${diffSecs.toString().padStart(2, '0')}`;
        document.querySelector('.dispute-timer').textContent = timeText;
        
        // Adiciona classe de alerta quando faltar menos de 1 minuto
        if (diffMins < 1) {
            document.querySelector('.dispute-timer').classList.add('alert');
        }
    };
    
    // Executa imediatamente
    updateTimer();
    
    // Configura para executar a cada segundo
    window.timeUpdateInterval = setInterval(updateTimer, 1000);
}

// Função para exibir imagem ampliada
function abrirImagemAmpliada(url) {
    // Cria ou obtém o container para a imagem ampliada
    let imgContainer = document.getElementById('image-preview-container');
    
    if (!imgContainer) {
        imgContainer = document.createElement('div');
        imgContainer.id = 'image-preview-container';
        imgContainer.className = 'image-preview-container';
        imgContainer.onclick = fecharImagemAmpliada;
        document.body.appendChild(imgContainer);
    }
    
    // Define o conteúdo
    imgContainer.innerHTML = `
        <div class="image-preview-content" onclick="event.stopPropagation()">
            <img src="${url}" alt="Imagem ampliada">
            <button class="image-preview-close" onclick="fecharImagemAmpliada()">×</button>
        </div>
    `;
    
    // Exibe o container
    imgContainer.style.display = 'flex';
    
    // Registra função global para fechar
    window.fecharImagemAmpliada = fecharImagemAmpliada;
}

// Função para fechar imagem ampliada
function fecharImagemAmpliada() {
    const imgContainer = document.getElementById('image-preview-container');
    if (imgContainer) {
        imgContainer.style.display = 'none';
    }
}

// Função para emitir um alerta sonoro e visual
function emitirAlertaNegociacao() {
    // Toca um som de alerta (se suportado pelo navegador)
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.warn('⚠️ Não foi possível tocar alerta sonoro:', error);
    }
    
    // Cria notificação visual
    showToast('Nova solicitação de negociação recebida!', 'warning');
    
    // Pisca ícone na barra do topo
    const headerIcon = document.querySelector('.header-title i');
    if (headerIcon) {
        headerIcon.classList.add('pulsating');
        setTimeout(() => {
            headerIcon.classList.remove('pulsating');
        }, 5000);
    }
}

// Função para adicionar estilos CSS
function adicionarEstilosNegociacao() {
    // Verifica se os estilos já foram adicionados
    if (document.getElementById('estilos-negociacao')) {
        return;
    }
    
    // Cria elemento de estilo
    const style = document.createElement('style');
    style.id = 'estilos-negociacao';
    style.textContent = `
        /* Estilos para o modal de negociação */
        .modal-negociacao-container {
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

        .modal-negociacao-content {
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

        .modal-negociacao-header {
            background-color: #ea1d2c;
            color: white;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
        }

        .modal-negociacao-title {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .modal-negociacao-title i {
            font-size: 20px;
        }

        .modal-negociacao-title h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }

        .modal-negociacao-pedido {
            background-color: rgba(255, 255, 255, 0.2);
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
        }

        .modal-negociacao-close {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
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

        .modal-negociacao-body {
            padding: 20px;
            overflow-y: auto;
            max-height: calc(90vh - 140px);
        }

        .dispute-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .dispute-row {
            display: flex;
            margin-bottom: 10px;
        }

        .dispute-row:last-child {
            margin-bottom: 0;
        }

        .dispute-label {
            width: 140px;
            font-weight: 600;
            color: #444;
        }

        .dispute-value {
            flex: 1;
        }

        .dispute-timer {
            font-weight: 600;
            color: #28a745;
        }

        .dispute-timer.alert {
            color: #ffc107;
            animation: pulse 1s infinite;
        }

        .dispute-timer.expired {
            color: #dc3545;
        }

        .dispute-photos {
            margin-bottom: 20px;
        }

        .dispute-photos h3 {
            font-size: 16px;
            margin-bottom: 10px;
            color: #444;
        }

        .photos-container {
            display: flex;
            gap: 10px;
            overflow-x: auto;
            padding-bottom: 10px;
        }

        .photo-item {
            width: 100px;
            height: 100px;
            border-radius: 8px;
            overflow: hidden;
            flex-shrink: 0;
            cursor: pointer;
            border: 1px solid #ddd;
        }

        .photo-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .negotiation-alternatives {
            margin-bottom: 20px;
        }

        .negotiation-alternatives h3 {
            font-size: 16px;
            margin-bottom: 15px;
            color: #444;
        }

        .alternatives-container {
            display: grid;
            gap: 15px;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        }

        .alternative-option {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .alternative-card {
            background-color: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            padding: 15px;
            height: 100%;
        }

        .alternative-details {
            display: flex;
            gap: 15px;
        }

        .alternative-details i {
            font-size: 20px;
            color: #ea1d2c;
        }

        .alternative-details h4 {
            margin: 0 0 8px 0;
            font-size: 14px;
            color: #333;
        }

        .alternative-details p {
            margin: 0 0 8px 0;
            font-size: 13px;
            color: #666;
        }

        .custom-refund-input {
            margin-top: 10px;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .custom-refund-input input {
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #ddd;
        }

        .alternative-button {
            background-color: #28a745;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 10px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            transition: background-color 0.2s;
        }

        .alternative-button:hover {
            background-color: #218838;
        }

        .dispute-message {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
        }

        .message-text {
            margin: 0;
            color: #856404;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .message-text i {
            font-size: 20px;
        }

        .modal-negociacao-footer {
            padding: 15px 20px;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            border-top: 1px solid #f1f3f4;
            background-color: #f9f9f9;
        }

        .dispute-button {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: background-color 0.2s;
        }

        .dispute-button.reject {
            background-color: #f8f9fa;
            color: #dc3545;
            border: 1px solid #dc3545;
        }

        .dispute-button.reject:hover {
            background-color: #feeaec;
        }

        .dispute-button.accept {
            background-color: #ea1d2c;
            color: white;
        }

        .dispute-button.accept:hover {
            background-color: #d41a28;
        }

        /* Estilos para visualização de imagem ampliada */
        .image-preview-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.9);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }

        .image-preview-content {
            position: relative;
            max-width: 90%;
            max-height: 90%;
        }

        .image-preview-content img {
            max-width: 100%;
            max-height: 90vh;
            border-radius: 4px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }

        .image-preview-close {
            position: absolute;
            top: -20px;
            right: -20px;
            background: rgba(255, 255, 255, 0.3);
            border: none;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }

/* Estilos para opções de tempo */
.time-options-section,
.cancellation-options-section {
    background-color: #f0f9ff;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    border-left: 4px solid #0d6efd;
    position: relative;
}

.time-options-section h4,
.cancellation-options-section h4 {
    font-size: 16px;
    color: #0d6efd;
    margin-bottom: 15px;
    font-weight: 600;
}

.cancellation-options-section {
    background-color: #feeeee;
    border-left-color: #dc3545;
}

.cancellation-options-section h4 {
    color: #dc3545;
}

.time-options-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
    margin-top: 15px;
}

.time-option-button {
    background-color: #0d6efd;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 15px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 600;
    font-size: 15px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.time-option-button:hover {
    background-color: #0b5ed7;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.time-option-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 3px rgba(0,0,0,0.1);
}

.time-option-button i {
    font-size: 22px;
    margin-bottom: 5px;
}

.cancellation-option-button {
    background-color: #dc3545;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 15px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 15px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 600;
    font-size: 16px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.15);
}

.cancellation-option-button:hover {
    background-color: #bb2d3b;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.cancellation-option-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 3px rgba(0,0,0,0.1);
}

.cancellation-option-button i {
    font-size: 20px;
}

/* Estilos para o modal de seleção de motivo */
#modal-selecao-motivo .modal-content {
    max-width: 500px;
}

#modal-selecao-motivo .modal-header {
    background-color: #0d6efd;
}

#modal-selecao-motivo .modal-body {
    padding: 20px;
}

#modal-selecao-motivo .modal-body p {
    margin-bottom: 15px;
    font-size: 16px;
}

#modal-selecao-motivo .modal-body p strong {
    color: #0d6efd;
    font-size: 18px;
}

#motivo-atraso {
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 16px;
    margin-top: 10px;
    background-color: #f8f9fa;
}

#modal-selecao-motivo .modal-footer {
    padding: 15px 20px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

#confirmar-motivo-atraso {
    background-color: #0d6efd;
    padding: 12px 20px;
}

#confirmar-motivo-atraso:hover {
    background-color: #0b5ed7;
}

        /* Animações */
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.6; }
            100% { opacity: 1; }
        }

        .pulsating {
            animation: pulse 0.8s infinite;
        }
    `;
    
    // Adiciona ao head
    document.head.appendChild(style);
    console.log('✅ Estilos de negociação adicionados');
}

// Inicializa o módulo automaticamente
document.addEventListener('DOMContentLoaded', initNegociacao);

// Exporta funções para uso global
window.fecharModalNegociacao = fecharModalNegociacao;
window.aceitarDisputa = aceitarDisputa;
window.rejeitarDisputa = rejeitarDisputa;
window.proporAlternativa = proporAlternativa;
window.proporTempoAdicional = proporTempoAdicional;
window.selecionarMotivoTempo = selecionarMotivoTempo; // Nova função que estamos adicionando
window.getReasonText = getReasonText; // Nova função que estamos adicionando
window.confirmarMotivoSelecionado = confirmarMotivoSelecionado; // Nova função que estamos adicionando
window.abrirModalMotivoCancelamento = abrirModalMotivoCancelamento;
window.fecharModalMotivoCancelamento = fecharModalMotivoCancelamento;
window.confirmarCancelamentoLoja = confirmarCancelamentoLoja;
window.abrirImagemAmpliada = abrirImagemAmpliada;
window.fecharImagemAmpliada = fecharImagemAmpliada;
