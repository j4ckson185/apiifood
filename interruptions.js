// Gerenciamento de Interrupções
// Este arquivo contém funções para gerenciar interrupções da loja no sistema iFood

// Variáveis de estado para gerenciamento de interrupções
let currentInterruptions = [];
let currentMerchantIdForInterruption = null;

// Função para buscar interrupções ativas
async function fetchInterruptions(merchantId) {
    try {
        console.log('🔍 Buscando interrupções para o merchant ID:', merchantId);
        
        if (!state.accessToken) {
            console.log('❌ Token de acesso não disponível');
            showToast('Faça login primeiro para buscar interrupções', 'warning');
            return [];
        }
        
        currentMerchantIdForInterruption = merchantId;
        
        const response = await makeAuthorizedRequest(
            `/merchant/v1.0/merchants/${merchantId}/interruptions`, 
            'GET'
        );
        
        console.log('✅ Interrupções recebidas:', response);
        
        // Atualiza a variável global
        currentInterruptions = Array.isArray(response) ? response : [];
        
        // Atualiza a interface
        displayInterruptions(currentInterruptions);
        
        return currentInterruptions;
    } catch (error) {
        console.error('❌ Erro ao buscar interrupções:', error);
        showToast(`Erro ao buscar interrupções: ${error.message}`, 'error');
        return [];
    }
}

// Função corrigida para criar uma interrupção
async function createInterruption(merchantId, interruptionData) {
    try {
        console.log('🔍 Criando interrupção para o merchant ID:', merchantId);
        console.log('📦 Dados da interrupção:', interruptionData);
        
        if (!state.accessToken) {
            console.log('❌ Token de acesso não disponível');
            showToast('Faça login primeiro para criar interrupção', 'warning');
            return null;
        }
        
        // Payload estritamente conforme a API espera - apenas os campos obrigatórios
        const payload = {
            description: interruptionData.description,
            start: interruptionData.start.toISOString(),
            end: interruptionData.end.toISOString()
        };
        
        console.log('📦 Payload formatado:', payload);
        
        showLoading();
        
        const response = await makeAuthorizedRequest(
            `/merchant/v1.0/merchants/${merchantId}/interruptions`, 
            'POST',
            payload
        );
        
        console.log('✅ Resposta completa da API ao criar interrupção:', response);
        
        // Adiciona a nova interrupção à lista atual
        if (response) {
            if (!Array.isArray(currentInterruptions)) {
                currentInterruptions = [];
            }
            currentInterruptions.push(response);
            displayInterruptions(currentInterruptions);
            
            // Verifica o status atual da loja
            try {
                console.log('🔍 Verificando status da loja após criar interrupção...');
                const storeStatus = await makeAuthorizedRequest(
                    `/merchant/v1.0/merchants/${merchantId}/status`, 
                    'GET'
                );
                console.log('ℹ️ Status atual da loja após interrupção:', storeStatus);
            } catch (statusError) {
                console.error('❌ Erro ao verificar status da loja:', statusError);
            }
        }
        
        showToast('Interrupção criada com sucesso!', 'success');
        
        // Fecha o modal
        closeInterruptionModal();
        
        return response;
    } catch (error) {
        console.error('❌ Erro ao criar interrupção:', error);
        console.error('Detalhes do erro:', error.response || error.message || error);
        showToast(`Erro ao criar interrupção: ${error.message}`, 'error');
        return null;
    } finally {
        hideLoading();
    }
}

async function removeInterruption(merchantId, interruptionId) {
    try {
        console.log(`🔍 Removendo interrupção ${interruptionId} do merchant ID: ${merchantId}`);
        
        if (!state.accessToken) {
            console.log('❌ Token de acesso não disponível');
            showToast('Faça login primeiro para remover interrupção', 'warning');
            return false;
        }
        
        // Confirmação do usuário
        if (!confirm('Tem certeza que deseja remover esta interrupção?')) {
            return false;
        }
        
        showLoading();
        
        await makeAuthorizedRequest(
            `/merchant/v1.0/merchants/${merchantId}/interruptions/${interruptionId}`, 
            'DELETE'
        );
        
        console.log('✅ Interrupção removida com sucesso');
        
        // Remove diretamente da variável global e atualiza a interface
        currentInterruptions = currentInterruptions.filter(item => item.id !== interruptionId);
        displayInterruptions(currentInterruptions);
        
        showToast('Interrupção removida com sucesso!', 'success');
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao remover interrupção:', error);
        showToast(`Erro ao remover interrupção: ${error.message}`, 'error');
        return false;
    } finally {
        hideLoading();
    }
}

// Função para exibir as interrupções na interface
function displayInterruptions(interruptions) {
    // Busca o elemento onde as interrupções serão exibidas
    const interruptionsContainer = document.getElementById('interruptions-list');
    
    if (!interruptionsContainer) {
        console.error('Elemento interruptions-list não encontrado');
        return;
    }
    
    // Limpa o container
    interruptionsContainer.innerHTML = '';
    
    // Verifique se interruptions é um array
    if (!interruptions || !Array.isArray(interruptions) || interruptions.length === 0) {
        // Caso não haja interrupções
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-interruptions';
        emptyState.innerHTML = `
            <i class="fas fa-clock"></i>
            <h3>Sem interrupções ativas</h3>
            <p>A loja está operando normalmente</p>
        `;
        interruptionsContainer.appendChild(emptyState);
        return;
    }
    
    // Cria um elemento para cada interrupção
    interruptions.forEach(interruption => {
        const interruptionCard = document.createElement('div');
        interruptionCard.className = 'interruption-card';
        
        // Formata as datas considerando o fuso horário
        const startDate = new Date(interruption.start);
        const endDate = new Date(interruption.end);
        
        // Usa toLocaleString para formatar no fuso horário local
        const formattedStart = startDate.toLocaleString('pt-BR');
        const formattedEnd = endDate.toLocaleString('pt-BR');
        
        // Para o status, use as datas
        const now = new Date();
        const isActive = now >= startDate && now <= endDate;
        const isScheduled = now < startDate;
        const isPast = now > endDate;
        
        let statusClass = '';
        let statusText = '';
        
        if (isActive) {
            statusClass = 'status-active';
            statusText = 'Ativa';
        } else if (isScheduled) {
            statusClass = 'status-scheduled';
            statusText = 'Agendada';
        } else if (isPast) {
            statusClass = 'status-past';
            statusText = 'Finalizada';
        }
        
        interruptionCard.innerHTML = `
            <div class="interruption-header">
                <h3>${interruption.description || 'Interrupção sem descrição'}</h3>
                <span class="interruption-status ${statusClass}">${statusText}</span>
            </div>
            <div class="interruption-content">
                <div class="interruption-time">
                    <div class="time-item">
                        <span class="time-label">Início:</span>
                        <span class="time-value">${formattedStart}</span>
                    </div>
                    <div class="time-item">
                        <span class="time-label">Fim:</span>
                        <span class="time-value">${formattedEnd}</span>
                    </div>
                </div>
                <div class="interruption-actions">
                    <button class="remove-interruption" data-id="${interruption.id}">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            </div>
        `;
        
        // Adiciona o evento para remover a interrupção
        interruptionCard.querySelector('.remove-interruption').addEventListener('click', function() {
            const interruptionId = this.getAttribute('data-id');
            removeInterruption(currentMerchantIdForInterruption, interruptionId);
        });
        
        interruptionsContainer.appendChild(interruptionCard);
    });
}

// Função para abrir o modal de criação de interrupção
function openCreateInterruptionModal() {
    const modal = document.getElementById('interruption-modal');
    if (!modal) return;
    
    // Reset do formulário
    const form = document.getElementById('interruption-form');
    if (form) form.reset();
    
    // Preenche com valores padrão
    const startDateInput = document.getElementById('interruption-start-date');
    const startTimeInput = document.getElementById('interruption-start-time');
    const endDateInput = document.getElementById('interruption-end-date');
    const endTimeInput = document.getElementById('interruption-end-time');
    
    if (startDateInput && startTimeInput && endDateInput && endTimeInput) {
        // Define data e hora atual como padrão
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        // Define 1 hora a frente para o fim
        const endTime = new Date(now);
        endTime.setHours(now.getHours() + 1);
        const endHours = String(endTime.getHours()).padStart(2, '0');
        
        startDateInput.value = `${year}-${month}-${day}`;
        startTimeInput.value = `${hours}:${minutes}`;
        endDateInput.value = `${year}-${month}-${day}`;
        endTimeInput.value = `${endHours}:${minutes}`;
    }
    
    // Exibe o modal
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

// Função para fechar o modal de interrupção
function closeInterruptionModal() {
    const modal = document.getElementById('interruption-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

// Função modificada para enviar o formulário de interrupção
// Função corrigida para enviar o formulário de interrupção
function submitInterruptionForm() {
    // Obtém os dados do formulário
    const description = document.getElementById('interruption-description').value;
    const startDate = document.getElementById('interruption-start-date').value;
    const startTime = document.getElementById('interruption-start-time').value;
    const endDate = document.getElementById('interruption-end-date').value;
    const endTime = document.getElementById('interruption-end-time').value;
    
    // Validação básica
    if (!description || !startDate || !startTime || !endDate || !endTime) {
        showToast('Preencha todos os campos', 'warning');
        return;
    }
    
    // Combina data e hora sem ajustes de fuso horário
    const start = new Date(`${startDate}T${startTime}:00`);
    const end = new Date(`${endDate}T${endTime}:00`);
    
    // Validação das datas
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        showToast('Data ou hora inválida', 'error');
        return;
    }
    
    if (start >= end) {
        showToast('A data de início deve ser anterior à data de fim', 'warning');
        return;
    }
    
    // Cria o objeto de interrupção - apenas com os campos obrigatórios
    const interruptionData = {
        description,
        start,
        end
    };
    
    // Log para verificar os dados antes de enviar
    console.log('📋 Dados da interrupção a ser criada:', interruptionData);
    console.log('Data de início (ISO):', start.toISOString());
    console.log('Data de fim (ISO):', end.toISOString());
    
    // Envia a requisição
    createInterruption(currentMerchantIdForInterruption, interruptionData);
}

// Função para verificar e monitorar interrupções ativas
async function verifyActiveInterruptions(merchantId) {
    try {
        console.log('🔍 Verificando interrupções ativas para merchant ID:', merchantId);
        
        const interruptions = await fetchInterruptions(merchantId);
        
        // Verificar status atual da loja
        const storeStatus = await makeAuthorizedRequest(
            `/merchant/v1.0/merchants/${merchantId}/status`, 
            'GET'
        );
        
        console.log('ℹ️ Status atual da loja:', storeStatus);
        console.log('ℹ️ Interrupções ativas:', interruptions);
        
        // Verificar se há alguma interrupção ativa no momento
        const now = new Date();
        const activeInterruptions = interruptions.filter(interruption => {
            const startDate = new Date(interruption.start);
            const endDate = new Date(interruption.end);
            return now >= startDate && now <= endDate;
        });
        
        console.log('ℹ️ Interrupções ativas no momento:', activeInterruptions.length);
        if (activeInterruptions.length > 0) {
            console.log('📋 Detalhes das interrupções ativas:', activeInterruptions);
            
            // Se a loja estiver aberta mas há interrupções ativas, algo está errado
            if (storeStatus && storeStatus.length > 0 && storeStatus[0].available === true) {
                console.warn('⚠️ ALERTA: Loja está aberta mesmo com interrupções ativas!');
                showToast('A loja está aberta mesmo com interrupções ativas!', 'warning');
            }
        }
        
        return { storeStatus, activeInterruptions };
    } catch (error) {
        console.error('❌ Erro ao verificar interrupções ativas:', error);
        return { error };
    }
}

// Adiciona mais estilos CSS para as interrupções
function addInterruptionStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        #interruptions-section {
            margin-top: 2rem;
            background-color: white;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            padding: 1.5rem;
        }
        
        .interruptions-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
        }
        
        .interruption-card {
            background-color: var(--light-gray);
            border-radius: var(--border-radius);
            margin-bottom: 1rem;
            overflow: hidden;
        }
        
        .interruption-header {
            background-color: var(--secondary-color);
            color: white;
            padding: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .interruption-header h3 {
            margin: 0;
            font-size: 1rem;
        }
        
        .interruption-status {
            font-size: 0.8rem;
            padding: 4px 8px;
            border-radius: 20px;
            background-color: #666;
        }
        
        .status-active {
            background-color: var(--danger-color);
        }
        
        .status-scheduled {
            background-color: var(--warning-color);
            color: #333;
        }
        
        .status-past {
            background-color: var(--success-color);
        }
        
        .interruption-content {
            padding: 1rem;
        }
        
        .interruption-time {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1rem;
        }
        
        .time-item {
            display: flex;
            flex-direction: column;
        }
        
        .time-label {
            font-size: 0.8rem;
            color: #666;
        }
        
        .time-value {
            font-weight: bold;
        }
        
        .interruption-actions {
            display: flex;
            justify-content: flex-end;
        }
        
        .remove-interruption {
            padding: 0.5rem 1rem;
            background-color: var(--danger-color);
            color: white;
            border: none;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .remove-interruption:hover {
            background-color: #c82333;
        }
        
        .empty-interruptions {
            text-align: center;
            padding: 2rem;
        }
        
        .empty-interruptions i {
            font-size: 3rem;
            color: #ccc;
            margin-bottom: 1rem;
        }
        
        /* Modal de interrupção */
        #interruption-form {
            display: grid;
            gap: 1rem;
        }
        
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        
        .form-group label {
            font-weight: bold;
        }
        
        .form-group input, .form-group textarea {
            padding: 0.75rem;
            border: 1px solid #ddd;
            border-radius: var(--border-radius);
        }
        
        .datetime-inputs {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5rem;
        }
    `;
    document.head.appendChild(styleElement);
}

// Estrutura correta para inicialização do módulo
function initInterruptionsMonitoring() {
    // Verifica interrupções ativas a cada 5 minutos
    setInterval(() => {
        if (currentMerchantIdForInterruption) {
            verifyActiveInterruptions(currentMerchantIdForInterruption);
        }
    }, 5 * 60 * 1000); // 5 minutos
}

// Função para inicializar o módulo de interrupções
function initInterruptions() {
    console.log('Inicializando módulo de interrupções...');
    addInterruptionStyles();
    
    // Iniciar monitoramento de interrupções
    initInterruptionsMonitoring();
}

// Configuração correta dos event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Eventos para o modal de criação de interrupção
    document.getElementById('create-interruption')?.addEventListener('click', openCreateInterruptionModal);
    document.getElementById('cancel-interruption')?.addEventListener('click', closeInterruptionModal);
    document.getElementById('submit-interruption')?.addEventListener('click', submitInterruptionForm);
    
    // Fecha o modal ao clicar fora dele
    document.getElementById('interruption-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('interruption-modal')) {
            closeInterruptionModal();
        }
    });
    
    // Fecha o modal ao clicar no X
    document.querySelector('#interruption-modal .close-modal')?.addEventListener('click', closeInterruptionModal);
});

// A linha abaixo deve estar FORA de qualquer função
// initInterruptions();
