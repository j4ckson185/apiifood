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
        // Extract disputeId from metadata for HANDSHAKE_DISPUTE events
        let disputeId = null;
        
        if (event.code === 'HANDSHAKE_DISPUTE' || event.fullCode === 'HANDSHAKE_DISPUTE') {
            // Check if disputeId is directly in the event
            if (event.disputeId) {
                disputeId = event.disputeId;
            } 
            // Check if disputeId is in the metadata
            else if (event.metadata && event.metadata.disputeId) {
                disputeId = event.metadata.disputeId;
            } else {
                console.error('❌ Evento de disputa sem disputeId, tentando localizar em outro campo:', event);
                
                // Try to extract dispute ID from any available field in the event
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
        
        // Now we have the disputeId, we can proceed with the rest of the function
        console.log('✅ Processando disputa com ID:', disputeId);
        
        // Buscar detalhes completos da disputa
        let disputeDetails;
        try {
            disputeDetails = await makeAuthorizedRequest(`/order/v1.0/disputes/${disputeId}`, 'GET');
            console.log('✅ Detalhes da disputa recebidos:', disputeDetails);
        } catch (error) {
            console.warn('⚠️ Não foi possível obter detalhes adicionais da disputa:', error);
            
            // Cria um objeto de disputa a partir dos dados do evento
            disputeDetails = {
                disputeId: disputeId,
                orderId: event.orderId,
                type: event.metadata?.handshakeType || 'CANCELLATION_REQUEST',
                reason: event.metadata?.message || 'Motivo não especificado',
                // Use customer name from the order if available
                customerName: await getCustomerNameFromOrder(event.orderId) || 'Cliente',
                expiresAt: event.metadata?.expiresAt,
                timeoutAction: event.metadata?.timeoutAction || 'ACCEPT'
            };
            
            console.log('✅ Criado objeto de disputa a partir do evento:', disputeDetails);
        }
        
        // Combina os dados do evento com os detalhes obtidos
        const disputeData = {
            ...event,
            ...disputeDetails,
            disputeId: disputeId
        };
        
        // Adiciona à lista de disputas ativas
        addActiveDispute(disputeData);
        
        // Exibe o modal de negociação
        exibirModalNegociacao(disputeData);
        
        // Emite som de alerta e notificação
        emitirAlertaNegociacao();
        
    } catch (error) {
        console.error('❌ Erro ao processar evento de disputa:', error);
        showToast('Erro ao processar solicitação de negociação', 'error');
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

// Funções para responder às disputas
async function aceitarDisputa(disputeId) {
    try {
        console.log(`🤝 Aceitando disputa ${disputeId}...`);
        showLoading();
        
        const response = await makeAuthorizedRequest(`/order/v1.0/disputes/${disputeId}/accept`, 'POST');
        
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
        
        const response = await makeAuthorizedRequest(`/order/v1.0/disputes/${disputeId}/reject`, 'POST');
        
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
        console.log(`🤝 Propondo alternativa ${alternativeId} para disputa ${disputeId}...`);
        showLoading();
        
        // No caso de reembolso personalizado, pode ser necessário enviar um valor no body
        let body = null;
        const disputa = activeDisputes.find(d => d.disputeId === disputeId);
        
        // Se for reembolso personalizado, adiciona o valor ao body
        if (disputa && disputa.alternatives) {
            const alternative = disputa.alternatives.find(a => a.id === alternativeId);
            if (alternative && alternative.type === 'CUSTOM_REFUND') {
                // Obtém o valor do input de reembolso personalizado
                const customRefundValue = document.getElementById('custom-refund-value').value;
                if (customRefundValue) {
                    body = { value: parseFloat(customRefundValue) };
                }
            }
        }
        
        const response = await makeAuthorizedRequest(
            `/order/v1.0/disputes/${disputeId}/alternatives/${alternativeId}`, 
            'POST',
            body
        );
        
        console.log('✅ Alternativa proposta com sucesso:', response);
        showToast('Alternativa de negociação enviada com sucesso', 'success');
        
        // Remove da lista de disputas ativas
        removeActiveDispute(disputeId);
        
        // Fecha o modal
        fecharModalNegociacao();
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao propor alternativa:', error);
        showToast(`Erro ao propor alternativa: ${error.message}`, 'error');
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

// Função para exibir o modal de negociação
function exibirModalNegociacao(dispute) {
    // Atualiza o ID da disputa atual
    currentDisputeId = dispute.disputeId;
    
    // Obtém o container do modal
    const modalContainer = document.getElementById('modal-negociacao-container');
    if (!modalContainer) {
        console.error('Container do modal de negociação não encontrado');
        return;
    }
    
    // Extrai informações relevantes da disputa
    const orderId = dispute.orderId || 'N/A';
    const orderDisplayId = dispute.displayId || orderId.substring(0, 6);
    const customerName = dispute.customerName || 'Cliente';
    const expiresAt = dispute.expiresAt ? new Date(dispute.expiresAt) : null;
    const timeoutAction = dispute.timeoutAction || 'ACCEPT';
    const reason = dispute.reason || 'Não especificado';
    const disputeType = dispute.type || 'UNKNOWN';
    
    // Formata o tempo restante
    let timeRemaining = '';
    if (expiresAt) {
        const now = new Date();
        const diffMs = expiresAt - now;
        const diffMins = Math.round(diffMs / 60000);
        timeRemaining = diffMins > 0 ? `${diffMins} minutos` : 'expirando';
    }
    
    // Verifica se há alternativas disponíveis
    const hasAlternatives = dispute.alternatives && dispute.alternatives.length > 0;
    
    // Cria o título baseado no tipo de disputa
    let disputeTitle = 'Solicitação de Negociação';
    let disputeIcon = 'handshake';
    
    switch(disputeType) {
        case 'CANCELLATION_WITH_REFUND_PROPOSAL':
            disputeTitle = 'Solicitação de Cancelamento com Reembolso';
            disputeIcon = 'money-bill-wave';
            break;
        case 'CANCELLATION_WITH_DELAY_PROPOSAL':
            disputeTitle = 'Cancelamento por Atraso';
            disputeIcon = 'clock';
            break;
        case 'CANCELLATION_REQUEST':
            disputeTitle = 'Solicitação de Cancelamento';
            disputeIcon = 'times-circle';
            break;
    }
    
    // Gera HTML para as alternativas, se existirem
    let alternativesHtml = '';
    if (hasAlternatives) {
        alternativesHtml = `
            <div class="negotiation-alternatives">
                <h3>Alternativas Disponíveis</h3>
                <div class="alternatives-container">
        `;
        
        dispute.alternatives.forEach(alternative => {
            let altContent = '';
            
            switch (alternative.type) {
                case 'REFUND_PROPOSAL':
                    const refundValue = alternative.value ? `R$ ${alternative.value.toFixed(2)}` : 'Valor não especificado';
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
                    
                case 'CUSTOM_REFUND':
                    altContent = `
                        <div class="alternative-details">
                            <i class="fas fa-calculator"></i>
                            <div>
                                <h4>Reembolso Personalizado</h4>
                                <p>${alternative.description || 'Defina um valor de reembolso'}</p>
                                <div class="custom-refund-input">
                                    <label>Valor do reembolso (R$):</label>
                                    <input type="number" id="custom-refund-value" min="1" step="0.01" placeholder="0.00">
                                </div>
                            </div>
                        </div>
                    `;
                    break;
                    
                case 'DELIVERY_TIME_PROPOSAL':
                    altContent = `
                        <div class="alternative-details">
                            <i class="fas fa-clock"></i>
                            <div>
                                <h4>Novo Prazo de Entrega</h4>
                                <p>${alternative.description || 'Propor novo prazo para entrega'}</p>
                                <p>Tempo adicional: ${alternative.additionalTime || '?'} minutos</p>
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
            
            alternativesHtml += `
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
        
        alternativesHtml += `
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
                
                <div class="dispute-message">
                    <p class="message-text">
                        <i class="fas fa-info-circle"></i>
                        ${hasAlternatives ? 
                            'Você pode aceitar o cancelamento, rejeitá-lo ou oferecer uma alternativa.' : 
                            'Você pode aceitar ou rejeitar esta solicitação de cancelamento.'}
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
    
    // Registra função global para fechar o modal
    window.fecharModalNegociacao = fecharModalNegociacao;
    
    // Registra funções globais para ações da disputa
    window.aceitarDisputa = aceitarDisputa;
    window.rejeitarDisputa = rejeitarDisputa;
    window.proporAlternativa = proporAlternativa;
    
    console.log('✅ Modal de negociação exibido para a disputa:', dispute.disputeId);
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
window.abrirImagemAmpliada = abrirImagemAmpliada;
window.fecharImagemAmpliada = fecharImagemAmpliada;
