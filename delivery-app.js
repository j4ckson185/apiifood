// Sistema de Entregadores para PDV iFood
// Este arquivo adiciona um sistema de login e gerenciamento de entregadores
// sem modificar os arquivos originais do sistema

// Configuração dos entregadores
const entregadores = [
    { id: 'boaz', nome: 'Boaz', login: 'boaz', senha: 'boaz123' },
    { id: 'rafael', nome: 'Rafael Judson', login: 'rafael', senha: 'fodase' },
    { id: 'gabriel', nome: 'Gabriel Andrade', login: 'gabriel', senha: 'fuzileiro' },
    { id: 'narlison', nome: 'Narlison', login: 'narlison', senha: 'cabana123' }
];

// Configuração do admin
const admin = { id: 'admin', nome: 'Jackson', login: 'jackson', senha: 'cabana123' };

// Estado do sistema
let sistemaEntregadores = {
    usuarioLogado: null,
    pedidosAtribuidos: {}, // { entregadorId: [pedidoId1, pedidoId2, ...] }
    pedidosCache: {},      // Cache de pedidos completos { pedidoId: pedidoCompleto }
    estadoPedidos: {}      // { pedidoId: 'atribuido' | 'aceito' | 'despachado' | 'finalizado' }
};

// Carregar estado salvo se existir
function carregarEstadoSalvo() {
    try {
        const estadoSalvo = localStorage.getItem('sistemaEntregadores');
        if (estadoSalvo) {
            const parsed = JSON.parse(estadoSalvo);
            
            // Preserva apenas pedidosAtribuidos, pedidosCache e estadoPedidos
            // (não preserva o login para segurança)
            sistemaEntregadores.pedidosAtribuidos = parsed.pedidosAtribuidos || {};
            sistemaEntregadores.pedidosCache = parsed.pedidosCache || {};
            sistemaEntregadores.estadoPedidos = parsed.estadoPedidos || {};
            
            console.log('✅ Estado do sistema de entregadores carregado');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar estado do sistema de entregadores:', error);
    }
}

// Salvar estado atual
function salvarEstado() {
    try {
        localStorage.setItem('sistemaEntregadores', JSON.stringify(sistemaEntregadores));
        console.log('✅ Estado do sistema de entregadores salvo');
    } catch (error) {
        console.error('❌ Erro ao salvar estado do sistema de entregadores:', error);
    }
}

// Inicialização do sistema
function iniciarSistemaEntregadores() {
    console.log('🚚 Iniciando sistema de entregadores...');
    
    // Carregar estado salvo
    carregarEstadoSalvo();
    
    // Remove o elemento de loading se existir
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    // Verificar se há usuário logado no sessionStorage imediatamente
    const usuarioSalvo = sessionStorage.getItem('usuarioEntregadorLogado');
    if (usuarioSalvo) {
        try {
            sistemaEntregadores.usuarioLogado = JSON.parse(usuarioSalvo);
            console.log('✅ Usuário recuperado da sessão:', sistemaEntregadores.usuarioLogado.nome);
            
            // Se não for o admin, exibe interface de entregador imediatamente
            if (sistemaEntregadores.usuarioLogado.id !== 'admin') {
                exibirTelaEntregador();
            } else {
                // Se estamos na página delivery-app.html, redireciona para index.html
                if (window.location.pathname.includes('delivery-app.html')) {
                    window.location.href = 'index.html';
                    return;
                }
                
                // Espera o DOM carregar para modificar a interface admin
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', modificarInterfaceAdmin);
                } else {
                    // DOM já carregou
                    modificarInterfaceAdmin();
                }
            }
        } catch (error) {
            console.error('❌ Erro ao recuperar usuário da sessão:', error);
            exibirTelaLogin();
        }
    } else {
        // Nenhum usuário logado, exibe tela de login imediatamente
        exibirTelaLogin();
    }
}
}

// Exibir tela de login
function exibirTelaLogin() {
    console.log('🔐 Exibindo tela de login');
    
    // Oculta o conteúdo original
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.fontFamily = '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
    document.body.style.background = '#f5f5f5';
    document.body.style.height = '100vh';
    document.body.style.display = 'flex';
    document.body.style.justifyContent = 'center';
    document.body.style.alignItems = 'center';

    // Cria container de login
    const loginContainer = document.createElement('div');
    loginContainer.style.width = '90%';
    loginContainer.style.maxWidth = '400px';
    loginContainer.style.background = 'white';
    loginContainer.style.borderRadius = '10px';
    loginContainer.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
    loginContainer.style.padding = '2rem';
    
    // Logo e título
    loginContainer.innerHTML = `
        <div style="text-align: center; margin-bottom: 2rem;">
            <h1 style="color: #ea1d2c; margin-bottom: 0.5rem; font-size: 28px;">
                <i class="fas fa-store"></i> Cabana Delivery
            </h1>
            <p style="color: #666; margin: 0;">Sistema de Entregadores</p>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">Usuário</label>
            <input type="text" id="login-username" placeholder="Seu nome de usuário" 
                   style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px;">
        </div>
        
        <div style="margin-bottom: 2rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">Senha</label>
            <input type="password" id="login-password" placeholder="Sua senha" 
                   style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px;">
        </div>
        
        <div>
            <button id="login-button" 
                    style="width: 100%; padding: 12px; background: #ea1d2c; color: white; border: none; 
                           border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer;">
                Entrar
            </button>
        </div>
        
        <div id="login-error" style="color: #dc3545; margin-top: 1rem; text-align: center; display: none;"></div>
    `;
    
    document.body.appendChild(loginContainer);
    
    // Adicionar eventos
    document.getElementById('login-button').addEventListener('click', fazerLogin);
    document.getElementById('login-password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            fazerLogin();
        }
    });
}

// Processar login
function fazerLogin() {
    const username = document.getElementById('login-username').value.toLowerCase().trim();
    const password = document.getElementById('login-password').value;
    
    console.log('Tentativa de login com usuário:', username);
    
    // Verificar admin
    if (username === admin.login && password === admin.senha) {
        console.log('✅ Login admin bem-sucedido');
        sistemaEntregadores.usuarioLogado = admin;
        sessionStorage.setItem('usuarioEntregadorLogado', JSON.stringify(admin));
        
        // Ao invés de recarregar a página, redirecionamos para o index.html
        if (window.location.pathname.includes('delivery-app.html')) {
            window.location.href = 'index.html';
        } else {
            // Se já estivermos no index, apenas removemos o overlay de login
            document.body.innerHTML = '';
            // Aguarda o carregamento completo da página original
            setTimeout(() => {
                modificarInterfaceAdmin();
            }, 500);
        }
        return;
    }
    
    // Verificar entregadores
    const entregador = entregadores.find(e => e.login === username && e.senha === password);
    if (entregador) {
        console.log('✅ Login entregador bem-sucedido:', entregador.nome);
        sistemaEntregadores.usuarioLogado = entregador;
        sessionStorage.setItem('usuarioEntregadorLogado', JSON.stringify(entregador));
        
        // Exibir interface de entregador diretamente
        document.body.innerHTML = '';
        exibirTelaEntregador();
        return;
    }
    
    // Login falhou
    console.log('❌ Login falhou para usuário:', username);
    const errorElement = document.getElementById('login-error');
    errorElement.textContent = 'Usuário ou senha incorretos';
    errorElement.style.display = 'block';
    
    // Animação de shake no erro
    const loginContainer = document.querySelector('div');
    loginContainer.style.animation = 'shake 0.5s';
    
    // Adiciona keyframes para shake se não existir
    if (!document.getElementById('shake-keyframes')) {
        const style = document.createElement('style');
        style.id = 'shake-keyframes';
        style.textContent = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Remove animação após término
    setTimeout(() => {
        loginContainer.style.animation = '';
    }, 500);
}

// Modificar a interface admin (adicionar botão de atribuir entregador)
function modificarInterfaceAdmin() {
    console.log('👑 Modificando interface para admin');
    
    // Adiciona botão de logout
    adicionarBotaoLogout();
    
    // Remove o container de status da loja e adiciona o de entregadores
    const statusContainer = document.querySelector('.status-container');
    if (statusContainer) {
        // Cria o novo elemento para a seção de entregadores
        const entregadoresSection = document.createElement('div');
        entregadoresSection.className = 'entregadores-section';
        entregadoresSection.style.display = 'flex';
        entregadoresSection.style.alignItems = 'center';
        entregadoresSection.style.gap = '10px';
        
        // Adiciona o rótulo
        const entregadoresLabel = document.createElement('span');
        entregadoresLabel.className = 'entregadores-label';
        entregadoresLabel.textContent = 'Entregador:';
        entregadoresLabel.style.fontWeight = '500';
        entregadoresSection.appendChild(entregadoresLabel);
        
        // Cria o dropdown de entregadores
        const entregadoresSelect = document.createElement('select');
        entregadoresSelect.id = 'entregadores-select';
        entregadoresSelect.style.padding = '8px 12px';
        entregadoresSelect.style.borderRadius = '6px';
        entregadoresSelect.style.border = '1px solid #ddd';
        
        // Adiciona opção padrão
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Selecionar entregador';
        entregadoresSelect.appendChild(defaultOption);
        
        // Adiciona os entregadores
        entregadores.forEach(entregador => {
            const option = document.createElement('option');
            option.value = entregador.id;
            option.textContent = entregador.nome;
            entregadoresSelect.appendChild(option);
        });
        
        entregadoresSection.appendChild(entregadoresSelect);
        
        // Substitui o container de status
        statusContainer.parentNode.replaceChild(entregadoresSection, statusContainer);
    }
    
    // Observar a criação de cards de pedidos para adicionar botão de atribuir
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList.contains('order-card')) {
                        // Verifica se já tem o botão de atribuir
                        if (!node.querySelector('.atribuir-entregador-btn')) {
                            adicionarBotaoAtribuir(node);
                        }
                    }
                });
            }
        });
    });
    
    // Observa todas as grids de pedidos
    const orderGrids = document.querySelectorAll('.orders-grid');
    orderGrids.forEach(grid => {
        observer.observe(grid, { childList: true });
        
        // Verifica cards existentes
        grid.querySelectorAll('.order-card').forEach(card => {
            if (!card.querySelector('.atribuir-entregador-btn')) {
                adicionarBotaoAtribuir(card);
            }
        });
    });
}

// Função para adicionar botão de logout
function adicionarBotaoLogout() {
    // Cria botão de logout
    const logoutButton = document.createElement('button');
    logoutButton.textContent = 'Sair';
    logoutButton.className = 'logout-button';
    logoutButton.style.background = '#6c757d';
    logoutButton.style.color = 'white';
    logoutButton.style.border = 'none';
    logoutButton.style.borderRadius = '4px';
    logoutButton.style.padding = '8px 12px';
    logoutButton.style.cursor = 'pointer';
    logoutButton.style.marginLeft = '10px';
    logoutButton.style.fontSize = '14px';
    
    // Adiciona evento
    logoutButton.addEventListener('click', fazerLogout);
    
    // Adiciona ao header
    const headerContent = document.querySelector('.header-content');
    if (headerContent) {
        headerContent.appendChild(logoutButton);
    }
}

// Função para fazer logout
function fazerLogout() {
    console.log('👋 Fazendo logout');
    sistemaEntregadores.usuarioLogado = null;
    sessionStorage.removeItem('usuarioEntregadorLogado');
    exibirTelaLogin();
}

// Adicionar botão de atribuir entregador ao card de pedido
function adicionarBotaoAtribuir(orderCard) {
    const orderId = orderCard.getAttribute('data-order-id');
    if (!orderId) return;
    
    // Verifica se este pedido já está atribuído
    let isAtribuido = false;
    let entregadorAtribuido = null;
    
    Object.entries(sistemaEntregadores.pedidosAtribuidos).forEach(([entregadorId, pedidos]) => {
        if (pedidos.includes(orderId)) {
            isAtribuido = true;
            entregadorAtribuido = entregadorId;
        }
    });
    
    // Obtém o container de ações
    const actionsContainer = orderCard.querySelector('.order-actions');
    if (!actionsContainer) return;
    
    // Remove qualquer botão existente
    const existingBtn = orderCard.querySelector('.atribuir-entregador-btn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    // Cria o novo botão
    const atribuirBtn = document.createElement('button');
    atribuirBtn.className = 'action-button atribuir-entregador-btn';
    
    if (isAtribuido) {
        // Já está atribuído, mostra para qual entregador
        const nomeEntregador = entregadores.find(e => e.id === entregadorAtribuido)?.nome || entregadorAtribuido;
        atribuirBtn.textContent = `Atribuído a: ${nomeEntregador}`;
        atribuirBtn.style.backgroundColor = '#28a745';
        atribuirBtn.title = 'Clique para trocar de entregador';
    } else {
        // Não está atribuído
        atribuirBtn.textContent = 'Atribuir Entregador';
        atribuirBtn.style.backgroundColor = '#6c757d';
    }
    
    // Adiciona evento para atribuir entregador
    atribuirBtn.addEventListener('click', () => atribuirEntregador(orderId, orderCard));
    
    // Adiciona ao container
    actionsContainer.appendChild(atribuirBtn);
}

// Atribuir um pedido a um entregador
function atribuirEntregador(orderId, orderCard) {
    // Obtém o entregador selecionado
    const entregadorId = document.getElementById('entregadores-select').value;
    
    if (!entregadorId) {
        alert('Por favor, selecione um entregador');
        return;
    }
    
    console.log(`🔄 Atribuindo pedido ${orderId} para entregador ${entregadorId}`);
    
    // Busca o pedido completo da DOM para guardar no cache
    let pedidoCompleto = null;
    
    // Tenta buscar o pedido no cache do sistema original
    if (window.ordersCache && window.ordersCache[orderId]) {
        pedidoCompleto = window.ordersCache[orderId];
    } else {
        // Extrai informações do card para criar um pedido básico
        const orderNumber = orderCard.querySelector('.order-number')?.textContent?.trim() || '';
        const customerName = orderCard.querySelector('.customer-name')?.textContent?.replace('Cliente:', '')?.trim() || '';
        const total = orderCard.querySelector('.total-amount')?.textContent?.trim() || '';
        
        pedidoCompleto = {
            id: orderId,
            displayId: orderNumber.replace('#', ''),
            customer: {
                name: customerName
            },
            total: total
        };
    }
    
    // Remove atribuição anterior se existir
    Object.keys(sistemaEntregadores.pedidosAtribuidos).forEach(id => {
        sistemaEntregadores.pedidosAtribuidos[id] = 
            sistemaEntregadores.pedidosAtribuidos[id].filter(pid => pid !== orderId);
    });
    
    // Inicializa array se não existir
    if (!sistemaEntregadores.pedidosAtribuidos[entregadorId]) {
        sistemaEntregadores.pedidosAtribuidos[entregadorId] = [];
    }
    
    // Adiciona o pedido à lista do entregador
    sistemaEntregadores.pedidosAtribuidos[entregadorId].push(orderId);
    
    // Salva o pedido no cache
    sistemaEntregadores.pedidosCache[orderId] = pedidoCompleto;
    
    // Atualiza o estado do pedido
    sistemaEntregadores.estadoPedidos[orderId] = 'atribuido';
    
    // Salva o estado
    salvarEstado();
    
    // Atualiza o botão
    adicionarBotaoAtribuir(orderCard);
    
    // Mensagem de sucesso
    const entregadorNome = entregadores.find(e => e.id === entregadorId)?.nome || entregadorId;
    showToast(`Pedido atribuído para ${entregadorNome}`, 'success');
}

// Exibir interface para entregador
function exibirTelaEntregador() {
    console.log('🚚 Exibindo tela para entregador:', sistemaEntregadores.usuarioLogado.nome);
    
    // Oculta o conteúdo original
    document.body.innerHTML = '';
    
    // Estilos globais
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            color: #333;
        }
        
        header {
            background-color: #ea1d2c;
            color: white;
            padding: 1rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .app-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.2rem;
            font-weight: 600;
        }
        
        .entregador-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .logout-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        
        .logout-btn:hover {
            background: rgba(255,255,255,0.3);
        }
        
        main {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1rem;
        }
        
        .status-banner {
            background-color: #e8f5e9;
            color: #2e7d32;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            text-align: center;
            font-weight: 500;
        }
        
        .empty-state {
            text-align: center;
            padding: 3rem 1rem;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            margin: 2rem 0;
        }
        
        .empty-state i {
            font-size: 3rem;
            color: #ccc;
            margin-bottom: 1rem;
            display: block;
        }
        
        .empty-state h3 {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
            color: #333;
        }
        
        .empty-state p {
            color: #666;
            max-width: 400px;
            margin: 0 auto;
        }
        
        .pedidos-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }
        
        .pedido-card {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
            transition: transform 0.2s;
        }
        
        .pedido-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        .pedido-header {
            padding: 1rem;
            background-color: #f8f9fa;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .pedido-id {
            font-weight: 600;
            font-size: 1.1rem;
        }
        
        .pedido-status {
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            background-color: #f8f9fa;
        }
        
        .status-atribuido {
            background-color: #e8f5e9;
            color: #2e7d32;
        }
        
        .status-aceito {
            background-color: #e3f2fd;
            color: #1565c0;
        }
        
        .status-despachado {
            background-color: #fff3e0;
            color: #e65100;
        }
        
        .status-finalizado {
            background-color: #e8eaf6;
            color: #3949ab;
        }
        
        .pedido-body {
            padding: 1rem;
        }
        
        .pedido-info-row {
            margin-bottom: 0.8rem;
        }
        
        .pedido-info-row h4 {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 0.3rem;
        }
        
        .pedido-info-row p {
            color: #333;
        }
        
        .pedido-actions {
            display: flex;
            gap: 0.5rem;
            margin-top: 1rem;
        }
        
        .action-btn {
            flex: 1;
            padding: 0.7rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9rem;
            transition: all 0.2s;
        }
        
        .btn-aceitar {
            background-color: #007bff;
            color: white;
        }
        
        .btn-aceitar:hover {
            background-color: #0069d9;
        }
        
        .btn-despachar {
            background-color: #fd7e14;
            color: white;
        }
        
        .btn-despachar:hover {
            background-color: #e8710a;
        }
        
        .btn-finalizar {
            background-color: #28a745;
            color: white;
        }
        
        .btn-finalizar:hover {
            background-color: #218838;
        }
        
        .toast-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
        }
        
        .toast {
            background-color: white;
            color: #333;
            padding: 1rem 1.5rem;
            margin: 0.5rem;
            border-radius: 6px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            animation: slideIn 0.3s ease;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .toast.success {
            border-left: 4px solid #28a745;
        }
        
        .toast.error {
            border-left: 4px solid #dc3545;
        }
        
        .toast.info {
            border-left: 4px solid #17a2b8;
        }
        
        .toast.warning {
            border-left: 4px solid #ffc107;
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        /* Modal de detalhes do pedido */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .modal-content {
            background-color: white;
            border-radius: 8px;
            width: 90%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }
        
        .modal-header {
            padding: 1rem;
            background-color: #ea1d2c;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .modal-title {
            font-size: 1.2rem;
            font-weight: 600;
        }
        
        .modal-close {
            background: none;
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
        }
        
        .modal-body {
            padding: 1.5rem;
        }
        
        .modal-section {
            margin-bottom: 1.5rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid #eee;
        }
        
        .modal-section:last-child {
            border-bottom: none;
            padding-bottom: 0;
            margin-bottom: 0;
        }
        
        .modal-section h3 {
            font-size: 1.1rem;
            margin-bottom: 1rem;
            color: #333;
        }
        
        .modal-footer {
            padding: 1rem;
            display: flex;
            justify-content: flex-end;
            gap: 1rem;
            border-top: 1px solid #eee;
        }
    `;
    document.head.appendChild(styleElement);
    
    // Criar estrutura básica
    document.body.innerHTML = `
        <header>
            <div class="header-content">
                <div class="app-title">
                    <i class="fas fa-motorcycle"></i>
                    Cabana Delivery
                </div>
                <div class="entregador-info">
                    <span>${sistemaEntregadores.usuarioLogado.nome}</span>
                    <button class="logout-btn" id="btn-logout">Sair</button>
                </div>
            </div>
        </header>
        
        <main>
            <div class="status-banner">
                <i class="fas fa-user-check"></i> 
                Você está logado como entregador
            </div>
            
            <div id="pedidos-container">
                <!-- Pedidos serão inseridos aqui -->
            </div>
            
            <div id="toast-container" class="toast-container"></div>
        </main>
    `;
    
    // Adicionar FontAwesome se não existir
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        document.head.appendChild(fontAwesome);
    }
    
    // Adicionar eventos
    document.getElementById('btn-logout').addEventListener('click', fazerLogout);
    
    // Carregar pedidos do entregador
    carregarPedidosEntregador();
    
    // Iniciar polling para verificar novos pedidos
    setInterval(carregarPedidosEntregador, 10000);
}

// Carregar pedidos do entregador atual
function carregarPedidosEntregador() {
    const entregadorId = sistemaEntregadores.usuarioLogado.id;
    const pedidosContainer = document.getElementById('pedidos-container');
    
    if (!pedidosContainer) return;
    
    // Obter pedidos atribuídos a este entregador
    const pedidosIds = sistemaEntregadores.pedidosAtribuidos[entregadorId] || [];
    
    if (pedidosIds.length === 0) {
        // Exibir estado vazio
        pedidosContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>Nenhum pedido atribuído</h3>
                <p>Quando você receber um pedido, ele aparecerá aqui.</p>
            </div>
        `;
        return;
    }
    
    // Monta o grid de pedidos
    let pedidosHTML = `<h2>Seus Pedidos (${pedidosIds.length})</h2>
                      <div class="pedidos-grid">`;
    
    // Adiciona cada pedido
    pedidosIds.forEach(pedidoId => {
        const pedido = sistemaEntregadores.pedidosCache[pedidoId];
        if (!pedido) return;
        
        const estado = sistemaEntregadores.estadoPedidos[pedidoId] || 'atribuido';
        let statusText = '';
        let statusClass = '';
        
        switch (estado) {
            case 'atribuido':
                statusText = 'Atribuído';
                statusClass = 'status-atribuido';
                break;
            case 'aceito':
                statusText = 'Aceito';
                statusClass = 'status-aceito';
                break;
            case 'despachado':
                statusText = 'A Caminho';
                statusClass = 'status-despachado';
                break;
            case 'finalizado':
                statusText = 'Finalizado';
                statusClass = 'status-finalizado';
                break;
        }
        
        // Determina quais botões mostrar com base no estado
        let botoesHTML = '';
        
        if (estado === 'atribuido') {
            botoesHTML = `
                <button class="action-btn btn-aceitar" onclick="aceitarPedido('${pedidoId}')">
                    <i class="fas fa-check"></i> Aceitar
                </button>`;
        } else if (estado === 'aceito') {
            botoesHTML = `
                <button class="action-btn btn-despachar" onclick="despacharPedido('${pedidoId}')">
                    <i class="fas fa-shipping-fast"></i> Despachar
                </button>`;
        } else if (estado === 'despachado') {
            botoesHTML = `
                <button class="action-btn btn-finalizar" onclick="finalizarPedido('${pedidoId}')">
                    <i class="fas fa-flag-checkered"></i> Finalizar
                </button>`;
        } else {
            botoesHTML = `
                <button class="action-btn" disabled style="background-color: #e9ecef; color: #868e96;">
                    <i class="fas fa-check-circle"></i> Concluído
                </button>`;
        }
        
        pedidosHTML += `
            <div class="pedido-card" data-pedido-id="${pedidoId}">
                <div class="pedido-header">
                    <div class="pedido-id">#${pedido.displayId || pedidoId.substring(0, 6)}</div>
                    <div class="pedido-status ${statusClass}">${statusText}</div>
                </div>
                <div class="pedido-body">
                    <div class="pedido-info-row">
                        <h4>Cliente</h4>
                        <p>${pedido.customer?.name || 'Cliente'}</p>
                    </div>
                    
                    <div class="pedido-info-row">
                        <h4>Total</h4>
                        <p>${pedido.total?.orderAmount ? 
                              `R$ ${pedido.total.orderAmount.toFixed(2)}` : 
                              pedido.total || 'R$ 0,00'}</p>
                    </div>
                    
                    <div class="pedido-actions">
                        <button class="action-btn" style="background-color: #6c757d; color: white;" 
                                onclick="verDetalhesPedido('${pedidoId}')">
                            <i class="fas fa-eye"></i> Ver Detalhes
                        </button>
                        ${botoesHTML}
                    </div>
                </div>
            </div>
        `;
    });
    
    pedidosHTML += '</div>';
    pedidosContainer.innerHTML = pedidosHTML;
}

// Funções para atualizar o estado do pedido
function aceitarPedido(pedidoId) {
    sistemaEntregadores.estadoPedidos[pedidoId] = 'aceito';
    salvarEstado();
    mostrarToast('Pedido aceito com sucesso!', 'success');
    carregarPedidosEntregador();
}

function despacharPedido(pedidoId) {
    sistemaEntregadores.estadoPedidos[pedidoId] = 'despachado';
    salvarEstado();
    mostrarToast('Pedido despachado!', 'success');
    carregarPedidosEntregador();
}

function finalizarPedido(pedidoId) {
    sistemaEntregadores.estadoPedidos[pedidoId] = 'finalizado';
    salvarEstado();
    mostrarToast('Pedido finalizado com sucesso!', 'success');
    carregarPedidosEntregador();
}

// Função para exibir detalhes completos do pedido
function verDetalhesPedido(pedidoId) {
    const pedido = sistemaEntregadores.pedidosCache[pedidoId];
    if (!pedido) {
        mostrarToast('Pedido não encontrado', 'error');
        return;
    }
    
    // Cria o elemento modal
    const modalElement = document.createElement('div');
    modalElement.className = 'modal-overlay';
    
    // Preparando os dados do cliente
    const clienteNome = pedido.customer?.name || 'Cliente';
    const clienteTelefone = pedido.customer?.phone || 'N/A';
    
    // Preparando endereço se existir
    let enderecoHTML = '<p>Endereço não disponível</p>';
    if (pedido.delivery && pedido.delivery.deliveryAddress) {
        const endereco = pedido.delivery.deliveryAddress;
        enderecoHTML = `
            <p>${endereco.streetName || ''}, ${endereco.streetNumber || ''}</p>
            ${endereco.complement ? `<p>Complemento: ${endereco.complement}</p>` : ''}
            ${endereco.reference ? `<p>Referência: ${endereco.reference}</p>` : ''}
            ${endereco.neighborhood ? `<p>Bairro: ${endereco.neighborhood}</p>` : ''}
            <p>${endereco.city || ''} - ${endereco.state || ''}</p>
        `;
    }
    
    // Preparando itens do pedido
    let itensHTML = '<p>Nenhum item disponível</p>';
    if (pedido.items && Array.isArray(pedido.items) && pedido.items.length > 0) {
        itensHTML = '<ul style="list-style: none; padding: 0;">';
        pedido.items.forEach(item => {
            itensHTML += `
                <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>${item.quantity}x ${item.name}</span>
                        <span>R$ ${(item.totalPrice || (item.price * item.quantity) || 0).toFixed(2)}</span>
                    </div>
                    ${item.observations ? `<div style="font-style: italic; color: #666; margin-top: 5px;">Obs: ${item.observations}</div>` : ''}
                </li>
            `;
        });
        itensHTML += '</ul>';
    }
    
    // Preparando forma de pagamento
    let pagamentoHTML = '<p>Informação de pagamento não disponível</p>';
    if (pedido.payments && pedido.payments.methods && pedido.payments.methods.length > 0) {
        pagamentoHTML = '<ul style="list-style: none; padding: 0;">';
        pedido.payments.methods.forEach(metodo => {
            let metodoPagamento = metodo.method || 'Método desconhecido';
            let valorPagamento = metodo.value ? `R$ ${metodo.value.toFixed(2)}` : '';
            
            pagamentoHTML += `<li>${metodoPagamento} ${valorPagamento}</li>`;
            
            // Adiciona informação de troco se for em dinheiro
            if (metodo.method && metodo.method.toLowerCase().includes('cash') && 
                metodo.cash && metodo.cash.changeFor) {
                pagamentoHTML += `
                    <li style="color: #28a745; font-weight: bold; margin-top: 8px;">
                        Troco para: R$ ${metodo.cash.changeFor.toFixed(2)}
                    </li>
                `;
            }
        });
        pagamentoHTML += '</ul>';
    }
    
    // Montando HTML do modal
    modalElement.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-title">Detalhes do Pedido #${pedido.displayId || pedidoId.substring(0, 6)}</div>
                <button class="modal-close" onclick="fecharModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <h3><i class="fas fa-user"></i> Informações do Cliente</h3>
                    <p><strong>Nome:</strong> ${clienteNome}</p>
                    <p><strong>Telefone:</strong> ${clienteTelefone}</p>
                </div>
                
                <div class="modal-section">
                    <h3><i class="fas fa-map-marker-alt"></i> Endereço de Entrega</h3>
                    ${enderecoHTML}
                </div>
                
                <div class="modal-section">
                    <h3><i class="fas fa-shopping-basket"></i> Itens do Pedido</h3>
                    ${itensHTML}
                </div>
                
                <div class="modal-section">
                    <h3><i class="fas fa-money-bill-wave"></i> Forma de Pagamento</h3>
                    ${pagamentoHTML}
                </div>
                
                <div class="modal-section">
                    <h3><i class="fas fa-receipt"></i> Total</h3>
                    <p style="font-size: 1.2rem; font-weight: 600;">
                        ${pedido.total?.orderAmount ? 
                            `R$ ${pedido.total.orderAmount.toFixed(2)}` : 
                            pedido.total || 'R$ 0,00'}
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="action-btn" style="background-color: #6c757d; color: white;" onclick="fecharModal()">
                    Fechar
                </button>
            </div>
        </div>
    `;
    
    // Adiciona o modal ao corpo do documento
    document.body.appendChild(modalElement);
    
    // Adiciona função global para fechar o modal
    window.fecharModal = function() {
        document.body.removeChild(modalElement);
    };
    
    // Adiciona evento para fechar o modal ao clicar fora
    modalElement.addEventListener('click', function(e) {
        if (e.target === modalElement) {
            fecharModal();
        }
    });
}

// Função para exibir toast
function mostrarToast(mensagem, tipo = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    
    // Adiciona ícone baseado no tipo
    let icone = '';
    switch(tipo) {
        case 'success': icone = '<i class="fas fa-check-circle"></i>'; break;
        case 'error': icone = '<i class="fas fa-exclamation-circle"></i>'; break;
        case 'warning': icone = '<i class="fas fa-exclamation-triangle"></i>'; break;
        default: icone = '<i class="fas fa-info-circle"></i>';
    }
    
    toast.innerHTML = `${icone} ${mensagem}`;
    toastContainer.appendChild(toast);
    
    // Remove o toast após 3 segundos
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Inicia o sistema
iniciarSistemaEntregadores();
