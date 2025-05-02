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

// Debug log
console.log('🚀 Inicializando sistema de entregadores Cabana Delivery v1.0.2');

// === helper para ler o cookie de assignments ===
function getAssignmentsCookie() {
  const match = document.cookie.match(/(?:^|; )assignments=([^;]+)/);
  if (!match) return {};
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return {};
  }
}

// CORREÇÃO 7: Nova função para salvar o estado de forma síncrona
// e garantir que os pedidos estejam disponíveis em ambos os formatos
function salvarEstado() {
    try {
        // Salva o estado completo
        localStorage.setItem('sistemaEntregadores', JSON.stringify(sistemaEntregadores));
        
        // Salva também os pedidos de cada entregador individualmente para garantir compatibilidade
        Object.keys(sistemaEntregadores.pedidosAtribuidos).forEach(entregadorId => {
            const pedidos = sistemaEntregadores.pedidosAtribuidos[entregadorId];
            if (Array.isArray(pedidos)) {
                localStorage.setItem(`pedidos_${entregadorId}`, JSON.stringify(pedidos));
            }
        });
        
        console.log('✅ Estado do sistema de entregadores salvo');
    } catch (error) {
        console.error('❌ Erro ao salvar estado do sistema de entregadores:', error);
    }
}

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

// Modificar a função iniciarSistemaEntregadores para incluir sincronização
function iniciarSistemaEntregadores() {
    console.log('🚚 Iniciando sistema de entregadores...');
    
    // Sincroniza pedidos entre admin e entregador antes de carregar o estado
    // sincronizarPedidosEntreAdminEEntregador();
    
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
            // 1) Sincroniza dados agora que sabemos quem está logado
            sincronizarPedidosEntreAdminEEntregador();
            // 2) Exibe a UI e aí sim carrega os pedidos sem erros
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

// Exibir tela de login
function exibirTelaLogin() {
    console.log('🔐 Exibindo tela de login');
    
    // Verifica se estamos na página delivery-app.html
    if (window.location.pathname.includes('delivery-app.html')) {
        // Verifica se já existe o elemento de login
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            // Esconde o loading e mostra a tela de login
            document.getElementById('loading').style.display = 'none';
            loginScreen.style.display = 'block';
            
            // Adiciona eventos
            document.getElementById('login-button').addEventListener('click', fazerLogin);
            document.getElementById('login-password').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    fazerLogin();
                }
            });
            
            return;
        }
    }
    
    // Se não estamos na página delivery-app.html ou o elemento de login não existe
    // então criamos dinamicamente a tela de login
    
    // Oculta o conteúdo original
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.fontFamily = '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
    document.body.style.background = '#f5f5f5';
    document.body.style.minHeight = '100vh';
    
    // Cria container de login
    const loginContainer = document.createElement('div');
    loginContainer.style.width = '90%';
    loginContainer.style.maxWidth = '400px';
    loginContainer.style.background = 'white';
    loginContainer.style.borderRadius = '10px';
    loginContainer.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
    loginContainer.style.padding = '2rem';
    loginContainer.style.margin = '50px auto';
    
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
    
    // Adicionar FontAwesome se não existir
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        document.head.appendChild(fontAwesome);
    }
    
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
        const entregador = entregadores.find(e =>
        e.login.toLowerCase() === username &&
        e.senha === password
    );
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
    
    // Ocultar elementos de loading e login
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
        loginScreen.style.display = 'none';
    }
    
    // Adiciona botão de logout
    adicionarBotaoLogout();
    
    // Modificação: Remove o container de status da loja e adiciona o de entregadores
    const statusContainer = document.querySelector('.status-container');
    if (statusContainer) {
        // Cria o novo elemento para a seção de entregadores
        const entregadoresSection = document.createElement('div');
        entregadoresSection.className = 'entregadores-section';
        entregadoresSection.style.display = 'flex';
        entregadoresSection.style.alignItems = 'center';
        entregadoresSection.style.gap = '10px';
        entregadoresSection.style.background = '#f8f9fa';
        entregadoresSection.style.padding = '8px 15px';
        entregadoresSection.style.borderRadius = '20px';
        
        // Adiciona o rótulo
        const entregadoresLabel = document.createElement('span');
        entregadoresLabel.className = 'entregadores-label';
        entregadoresLabel.textContent = 'Entregador:';
        entregadoresLabel.style.fontWeight = '500';
        entregadoresLabel.style.color = '#343a40';
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
    } else {
        console.log('❌ Container de status não encontrado');
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
    if (orderGrids.length > 0) {
        orderGrids.forEach(grid => {
            observer.observe(grid, { childList: true });
            
            // Verifica cards existentes
            grid.querySelectorAll('.order-card').forEach(card => {
                if (!card.querySelector('.atribuir-entregador-btn')) {
                    adicionarBotaoAtribuir(card);
                }
            });
        });
        console.log(`✅ Observando ${orderGrids.length} grids de pedidos`);
    } else {
        console.log('⚠️ Nenhuma grid de pedidos encontrada para observar');
        
        // Talvez a página não tenha carregado completamente ainda
        // Programamos uma nova tentativa após 1 segundo
        setTimeout(() => {
            const retryGrids = document.querySelectorAll('.orders-grid');
            if (retryGrids.length > 0) {
                console.log(`✅ Retry: Encontradas ${retryGrids.length} grids de pedidos`);
                retryGrids.forEach(grid => {
                    observer.observe(grid, { childList: true });
                    
                    // Verifica cards existentes
                    grid.querySelectorAll('.order-card').forEach(card => {
                        if (!card.querySelector('.atribuir-entregador-btn')) {
                            adicionarBotaoAtribuir(card);
                        }
                    });
                });
            } else {
                console.log('❌ Retry: Nenhuma grid de pedidos encontrada mesmo após espera');
            }
        }, 1000);
    }
    
    console.log('✅ Interface admin modificada com sucesso');
}

function adicionarBotaoLogout() {
    // Se já existe, não cria de novo
    if (document.getElementById('logout-button')) return;

    // Cria botão de logout
    const logoutButton = document.createElement('button');
    logoutButton.id = 'logout-button';           // atribui um id para o check
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
    
    // Limpa dados de usuário
    sistemaEntregadores.usuarioLogado = null;
    sessionStorage.removeItem('usuarioEntregadorLogado');
    
    // Verifica se estamos na página do sistema ou na página principal
    if (window.location.pathname.includes('delivery-app.html')) {
        // Estamos na página do sistema - apenas exibe tela de login
        exibirTelaLogin();
    } else {
        // Estamos na página principal - redireciona para a página do sistema
        window.location.href = 'delivery-app.html';
    }
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
    
    // CORREÇÃO 1: Garante que estamos salvando o cache de pedidos corretamente
    sistemaEntregadores.pedidosCache[orderId] = pedidoCompleto;

    // CORREÇÃO 2: Salva em dois formatos para garantir compatibilidade
    // Formato 1: Usando a chave pedidos_${entregadorId}
    localStorage.setItem(`pedidos_${entregadorId}`, JSON.stringify(sistemaEntregadores.pedidosAtribuidos[entregadorId]));
    
    // Formato 2: Usando a chave sistemaEntregadores
    localStorage.setItem('sistemaEntregadores', JSON.stringify(sistemaEntregadores));
    
    // Atualiza o estado do pedido
    sistemaEntregadores.estadoPedidos[orderId] = 'atribuido';
    
    // Atualiza o botão
    adicionarBotaoAtribuir(orderCard);
    
    // Mensagem de sucesso
    const entregadorNome = entregadores.find(e => e.id === entregadorId)?.nome || entregadorId;
    showToast(`Pedido atribuído para ${entregadorNome}`, 'success');
}

// Modificar a função exibirTelaEntregador para forçar sincronização antes de carregar pedidos
function exibirTelaEntregador() {
    console.log('🚚 Exibindo tela para entregador:', sistemaEntregadores.usuarioLogado.nome);
    
    // Oculta o carregando se estiver visível
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    // Oculta a tela de login se estiver visível
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
        loginScreen.style.display = 'none';
    }
    
    // Container para a aplicação sem limpar nada do DOM
    const container = document.getElementById('app-container') || document.body;

// Estilos globais
    
    if (!document.getElementById('entregador-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'entregador-styles';
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
    }
    
    // Adicionar FontAwesome se não existir
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        document.head.appendChild(fontAwesome);
    }
    
    // Criar estrutura básica
    const entregadorInterface = document.createElement('div');
    entregadorInterface.className = 'entregador-interface';
    entregadorInterface.innerHTML = `
        <header>
            <div class="header-content">
                <div class="app-title">
                    <i class="fas fa-motorcycle"></i>
                    Cabana Delivery
                </div>
                <div class="entregador-info">
                    <span>${sistemaEntregadores.usuarioLogado.nome}</span>
                 <!-- logout será adicionado dinamicamente -->
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
    
    container.appendChild(entregadorInterface);
    
    // Adicionar logout de forma segura / idempotente
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', fazerLogout);
    } else {
        adicionarBotaoLogout();
    }

    // Carregar pedidos do entregador
    carregarPedidosEntregador();

    // Iniciar polling para verificar novos pedidos
    setInterval(carregarPedidosEntregador, 10000);

    console.log('✅ Interface de entregador exibida com sucesso');
}

function carregarPedidosEntregador() {
    // Logs para debug
    console.log('[DEBUG Motoboy] sistemaEntregadores.usuarioLogado =', sistemaEntregadores.usuarioLogado);
    console.log('[DEBUG Motoboy] keys em localStorage:', Object.keys(localStorage));

    const entregadorId = sistemaEntregadores.usuarioLogado.id.toLowerCase();
    console.log('[DEBUG Motoboy] entregadorId usado:', entregadorId);

    // Array para armazenar IDs de pedidos
    let pedidosIds = [];
    
    // CORREÇÃO 3: Prioridade de fontes de dados
    // 1. Primeiro, tenta obter do localStorage em formato array direto
    const rawPedidos = localStorage.getItem(`pedidos_${entregadorId}`);
    if (rawPedidos) {
        try {
            console.log('[DEBUG Motoboy] raw de pedidos_'+entregadorId+':', rawPedidos);
            const parsedPedidos = JSON.parse(rawPedidos);
            if (Array.isArray(parsedPedidos)) {
                pedidosIds = parsedPedidos;
                console.log('[DEBUG Motoboy] Pedidos encontrados no localStorage:', pedidosIds);
            }
        } catch (error) {
            console.error('[DEBUG Motoboy] Erro ao parsear pedidos do localStorage:', error);
        }
    }
    
    // 2. Se não encontrou nada, tenta obter do objeto sistemaEntregadores no memory
    if (pedidosIds.length === 0) {
        if (sistemaEntregadores.pedidosAtribuidos && sistemaEntregadores.pedidosAtribuidos[entregadorId]) {
            pedidosIds = sistemaEntregadores.pedidosAtribuidos[entregadorId];
            console.log('[DEBUG Motoboy] Pedidos encontrados em sistemaEntregadores (memory):', pedidosIds);
        }
    }
    
    // 3. Se ainda não encontrou, tenta obter do sistemaEntregadores no localStorage
    if (pedidosIds.length === 0) {
        const rawSystem = localStorage.getItem('sistemaEntregadores');
        if (rawSystem) {
            try {
                const sistema = JSON.parse(rawSystem);
                if (sistema && sistema.pedidosAtribuidos && sistema.pedidosAtribuidos[entregadorId]) {
                    pedidosIds = sistema.pedidosAtribuidos[entregadorId];
                    console.log('[DEBUG Motoboy] Pedidos encontrados em sistemaEntregadores (localStorage):', pedidosIds);
                    
                    // CORREÇÃO 4: Sincroniza de volta para o formato específico
                    localStorage.setItem(`pedidos_${entregadorId}`, JSON.stringify(pedidosIds));
                    
                    // CORREÇÃO 5: Atualiza também o objeto em memória
                    sistemaEntregadores.pedidosAtribuidos[entregadorId] = pedidosIds;
                }
            } catch (error) {
                console.error('[DEBUG Motoboy] Erro ao parsear sistemaEntregadores:', error);
            }
        }
    }

    console.log('[DEBUG Motoboy] pedidosIds final (array):', pedidosIds);

    const pedidosContainer = document.getElementById('pedidos-container');
    if (!pedidosContainer) {
        console.warn('[DEBUG Motoboy] #pedidos-container não encontrado');
        return;
    }

    // Se não há pedidos, exibe mensagem apropriada
    if (pedidosIds.length === 0) {
        pedidosContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>Nenhum pedido atribuído</h3>
                <p>Quando você receber um pedido, ele aparecerá aqui.</p>
            </div>
        `;
        return;
    }

    // CORREÇÃO 6: Verifica e gera pedidos se necessário, mas prioriza dados reais
    pedidosIds.forEach(pedidoId => {
        // Se o pedido não estiver no cache, tenta recuperá-lo de sistemaEntregadores no localStorage
        if (!sistemaEntregadores.pedidosCache[pedidoId]) {
            const rawSystem = localStorage.getItem('sistemaEntregadores');
            if (rawSystem) {
                try {
                    const sistema = JSON.parse(rawSystem);
                    if (sistema && sistema.pedidosCache && sistema.pedidosCache[pedidoId]) {
                        sistemaEntregadores.pedidosCache[pedidoId] = sistema.pedidosCache[pedidoId];
                        console.log(`[DEBUG Motoboy] Recuperado pedido ${pedidoId} do cache do sistema`);
                    }
                } catch (error) {
                    console.error('[DEBUG Motoboy] Erro ao recuperar pedido do cache:', error);
                }
            }
        }
        
        // Se ainda não encontrou o pedido, cria um fictício
        if (!sistemaEntregadores.pedidosCache[pedidoId]) {
            console.log('[DEBUG Motoboy] Criando pedido fictício para:', pedidoId);
            
            // Gera dados para um pedido fictício
            sistemaEntregadores.pedidosCache[pedidoId] = {
                id: pedidoId,
                displayId: pedidoId.substring(0, 6),
                customer: {
                    name: 'Cliente ' + Math.floor(Math.random() * 1000),
                    phone: '(11) 9' + Math.floor(Math.random() * 10000000)
                },
                total: {
                    orderAmount: Math.floor(Math.random() * 10000) / 100, // 0-100 reais
                    subTotal: Math.floor(Math.random() * 8000) / 100,
                    deliveryFee: Math.floor(Math.random() * 2000) / 100
                },
                items: [
                    {
                        name: 'Hambúrguer Especial',
                        quantity: 1,
                        price: 28.90
                    },
                    {
                        name: 'Batata Frita',
                        quantity: 1,
                        price: 12.90
                    },
                    {
                        name: 'Refrigerante',
                        quantity: 1,
                        price: 6.90
                    }
                ],
                delivery: {
                    deliveryAddress: {
                        streetName: 'Rua Exemplo',
                        streetNumber: '123',
                        neighborhood: 'Centro',
                        city: 'São Paulo',
                        state: 'SP'
                    }
                }
            };
            
            // Se não houver estado definido, define como 'atribuido'
            if (!sistemaEntregadores.estadoPedidos[pedidoId]) {
                sistemaEntregadores.estadoPedidos[pedidoId] = 'atribuido';
            }
            
            // Salva no localStorage para persistência
            salvarEstado();
        }
    });

    // Monta o grid de pedidos
    let pedidosHTML = `
        <h2>Seus Pedidos (${pedidosIds.length})</h2>
        <div class="pedidos-grid">`;

    pedidosIds.forEach(pedidoId => {
        const pedido = sistemaEntregadores.pedidosCache[pedidoId];
        if (!pedido) {
            console.warn('[DEBUG Motoboy] Pedido não encontrado no cache mesmo após criação:', pedidoId);
            return;
        }

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
                        <p>${pedido.total?.orderAmount
                            ? `R$ ${pedido.total.orderAmount.toFixed(2)}`
                            : (typeof pedido.total === 'string' ? pedido.total : 'R$ 0,00')}</p>
                    </div>
                    <div class="pedido-actions">
                        <button class="action-btn" style="background-color: #6c757d; color: white;"
                                onclick="verDetalhesPedido('${pedidoId}')">
                            <i class="fas fa-eye"></i> Ver Detalhes
                        </button>
                        ${botoesHTML}
                    </div>
                </div>
            </div>`;
    });

    pedidosHTML += '</div>';
    pedidosContainer.innerHTML = pedidosHTML;
    
    console.log('[DEBUG Motoboy] Interface de pedidos atualizada com sucesso');
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

// Adicionar ao arquivo delivery-app.js
// Esta função garante que os pedidos atribuídos por admins sejam corretamente
// sincronizados e visíveis na interface do entregador

// Função para sincronizar pedidos entre admin e entregador
function sincronizarPedidosEntreAdminEEntregador() {
    console.log('🔄 Sincronizando pedidos entre admin e entregador...');
    
    // 1. Verificar todas as atribuições no formato sistemaEntregadores
    let sistemaStorage = localStorage.getItem('sistemaEntregadores');
    let sistema = null;
    
    if (sistemaStorage) {
        try {
            sistema = JSON.parse(sistemaStorage);
            
            // Verificar se tem pedidosAtribuidos
            if (sistema && sistema.pedidosAtribuidos) {
                // Percorrer cada entregador
                Object.keys(sistema.pedidosAtribuidos).forEach(entregadorId => {
                    const pedidos = sistema.pedidosAtribuidos[entregadorId];
                    
                    if (Array.isArray(pedidos) && pedidos.length > 0) {
                        // Salva esses pedidos no formato específico esperado pelo entregador
                        localStorage.setItem(`pedidos_${entregadorId}`, JSON.stringify(pedidos));
                        console.log(`✅ Sincronizados ${pedidos.length} pedidos para ${entregadorId} no formato específico`);
                        
                        // Garante que cada pedido exista no cache
                        pedidos.forEach(pedidoId => {
                            if (!sistema.pedidosCache || !sistema.pedidosCache[pedidoId]) {
                                // Se o pedido não existe no cache, cria um pedido básico
                                if (!sistema.pedidosCache) sistema.pedidosCache = {};
                                
                                sistema.pedidosCache[pedidoId] = {
                                    id: pedidoId,
                                    displayId: pedidoId.substring(0, 6),
                                    customer: {
                                        name: `Cliente do pedido ${pedidoId}`
                                    },
                                    total: 'Verificando...'
                                };
                                
                                console.log(`🔄 Criado pedido básico no cache para ${pedidoId}`);
                            }
                            
                            // Garante que o pedido tenha um estado
                            if (!sistema.estadoPedidos) sistema.estadoPedidos = {};
                            if (!sistema.estadoPedidos[pedidoId]) {
                                sistema.estadoPedidos[pedidoId] = 'atribuido';
                                console.log(`🔄 Definido estado inicial para ${pedidoId}`);
                            }
                        });
                        
                        // Atualiza o sistema no localStorage com os novos caches/estados
                        localStorage.setItem('sistemaEntregadores', JSON.stringify(sistema));
                    }
                });
            }
        } catch (error) {
            console.error('❌ Erro ao sincronizar pedidos:', error);
        }
    }
    
    // 2. Verificar todos os pedidos_* no localStorage para garantir que estejam no sistema
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('pedidos_')) {
            const entregadorId = key.replace('pedidos_', '');
            
            try {
                const pedidos = JSON.parse(localStorage.getItem(key));
                
                if (Array.isArray(pedidos) && pedidos.length > 0) {
                    // Garantir que esses pedidos estejam no sistema também
                    if (!sistema) {
                        sistema = {
                            pedidosAtribuidos: {},
                            pedidosCache: {},
                            estadoPedidos: {}
                        };
                    }
                    
                    // Atualiza pedidosAtribuidos
                    sistema.pedidosAtribuidos[entregadorId] = pedidos;
                    
                    // Garante que cada pedido exista no cache
                    pedidos.forEach(pedidoId => {
                        if (!sistema.pedidosCache[pedidoId]) {
                            sistema.pedidosCache[pedidoId] = {
                                id: pedidoId,
                                displayId: pedidoId.substring(0, 6),
                                customer: {
                                    name: `Cliente do pedido ${pedidoId}`
                                },
                                total: 'Verificando...'
                            };
                        }
                        
                        // Garante que o pedido tenha um estado
                        if (!sistema.estadoPedidos[pedidoId]) {
                            sistema.estadoPedidos[pedidoId] = 'atribuido';
                        }
                    });
                    
                    // Atualiza o sistema no localStorage
                    localStorage.setItem('sistemaEntregadores', JSON.stringify(sistema));
                    console.log(`✅ Sincronizados ${pedidos.length} pedidos de ${entregadorId} para o sistema`);
                }
            } catch (error) {
                console.error(`❌ Erro ao sincronizar pedidos_${entregadorId}:`, error);
            }
        }
    });
    
    // 3. Atualiza o objeto sistemaEntregadores em memória se estivermos logados
    if (sistemaEntregadores) {
        const sistemaAtualizado = JSON.parse(localStorage.getItem('sistemaEntregadores') || '{}');
        
        // Atualiza com os dados do localStorage
        sistemaEntregadores.pedidosAtribuidos = sistemaAtualizado.pedidosAtribuidos || sistemaEntregadores.pedidosAtribuidos || {};
        sistemaEntregadores.pedidosCache = sistemaAtualizado.pedidosCache || sistemaEntregadores.pedidosCache || {};
        sistemaEntregadores.estadoPedidos = sistemaAtualizado.estadoPedidos || sistemaEntregadores.estadoPedidos || {};
        
        console.log('✅ Sistema em memória sincronizado com localStorage');
    }
    
    console.log('✅ Sincronização concluída');
}

// Ferramentas de debug para o sistema de entregadores
// Adicione estas funções ao final do arquivo delivery-app.js

// Função para verificar o estado completo do sistema no console
window.debugSistemaEntregadores = function() {
  console.group('🔍 DEBUG: Sistema de Entregadores');
  
  // Verifica usuário logado
  console.log('👤 Usuário logado:', sistemaEntregadores.usuarioLogado);
  
  // Verifica o localStorage
  console.log('💾 Keys no localStorage:', Object.keys(localStorage));
  
  // Verifica pedidos atribuídos
  console.log('📋 Pedidos atribuídos por entregador:');
  Object.keys(sistemaEntregadores.pedidosAtribuidos || {}).forEach(entregadorId => {
    const pedidos = sistemaEntregadores.pedidosAtribuidos[entregadorId];
    console.log(`- ${entregadorId}: ${pedidos?.length || 0} pedidos`, pedidos);
    
    // Verifica se existe o formato individual também
    const rawIndividual = localStorage.getItem(`pedidos_${entregadorId}`);
    if (rawIndividual) {
      try {
        const pedidosIndividual = JSON.parse(rawIndividual);
        console.log(`  Formato individual: ${pedidosIndividual?.length || 0} pedidos`, pedidosIndividual);
        
        // Verifica se há diferença entre os dois formatos
        if (JSON.stringify(pedidos) !== JSON.stringify(pedidosIndividual)) {
          console.warn('⚠️ ATENÇÃO: Formatos não sincronizados!');
        }
      } catch (error) {
        console.error(`  Erro ao parsear pedidos_${entregadorId}:`, error);
      }
    } else {
      console.warn(`⚠️ Formato individual não encontrado para ${entregadorId}`);
    }
  });
  
  // Verifica cache de pedidos
  const totalPedidosCache = Object.keys(sistemaEntregadores.pedidosCache || {}).length;
  console.log(`🗃️ Cache de pedidos: ${totalPedidosCache} pedidos`);
  
  // Verifica estado dos pedidos
  const totalEstadosPedidos = Object.keys(sistemaEntregadores.estadoPedidos || {}).length;
  console.log(`📊 Estados de pedidos: ${totalEstadosPedidos} pedidos`);
  
  console.groupEnd();
  
  return {
    usuarioLogado: sistemaEntregadores.usuarioLogado,
    pedidosAtribuidos: sistemaEntregadores.pedidosAtribuidos,
    pedidosCache: sistemaEntregadores.pedidosCache,
    estadoPedidos: sistemaEntregadores.estadoPedidos
  };
};

// Função para limpar todos os dados do sistema
window.limparSistemaEntregadores = function() {
  if (confirm('⚠️ ATENÇÃO: Esta ação irá limpar todos os dados do sistema de entregadores. Continuar?')) {
    // Limpa o objeto em memória
    sistemaEntregadores = {
      usuarioLogado: sistemaEntregadores.usuarioLogado, // Mantém usuário logado
      pedidosAtribuidos: {},
      pedidosCache: {},
      estadoPedidos: {}
    };
    
    // Limpa localStorage
    Object.keys(localStorage).forEach(key => {
      if (key === 'sistemaEntregadores' || key.startsWith('pedidos_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Salva objeto limpo
    localStorage.setItem('sistemaEntregadores', JSON.stringify(sistemaEntregadores));
    
    console.log('🧹 Sistema de entregadores limpo com sucesso');
    
    // Recarrega a interface se for um entregador
    if (sistemaEntregadores.usuarioLogado && sistemaEntregadores.usuarioLogado.id !== 'admin') {
      carregarPedidosEntregador();
    }
    
    return true;
  }
  return false;
};

// Função para forçar a sincronização entre formatos
window.forcarSincronizacao = function() {
  sincronizarPedidosEntreAdminEEntregador();
  
  // Recarrega a interface se for um entregador
  if (sistemaEntregadores.usuarioLogado && sistemaEntregadores.usuarioLogado.id !== 'admin') {
    carregarPedidosEntregador();
  }
  
  return 'Sincronização forçada concluída!';
};

// Função para atribuir um pedido teste
window.criarPedidoTeste = function(entregadorId) {
  if (!entregadorId) {
    if (sistemaEntregadores.usuarioLogado && sistemaEntregadores.usuarioLogado.id !== 'admin') {
      entregadorId = sistemaEntregadores.usuarioLogado.id;
    } else {
      alert('Especifique o ID do entregador');
      return false;
    }
  }
  
  const pedidoId = 'teste-' + Math.floor(Math.random() * 1000000);
  
  // Inicializa arrays se necessário
  if (!sistemaEntregadores.pedidosAtribuidos[entregadorId]) {
    sistemaEntregadores.pedidosAtribuidos[entregadorId] = [];
  }
  
  // Adiciona o pedido
  sistemaEntregadores.pedidosAtribuidos[entregadorId].push(pedidoId);
  
  // Cria o pedido no cache
  sistemaEntregadores.pedidosCache[pedidoId] = {
    id: pedidoId,
    displayId: pedidoId.substring(0, 6),
    customer: {
      name: 'Cliente Teste',
      phone: '(11) 99999-9999'
    },
    total: {
      orderAmount: 59.90,
      subTotal: 49.90,
      deliveryFee: 10.00
    },
    items: [
      {
        name: 'Pedido de Teste',
        quantity: 1,
        price: 49.90
      }
    ],
    delivery: {
      deliveryAddress: {
        streetName: 'Rua de Teste',
        streetNumber: '123',
        neighborhood: 'Bairro Teste',
        city: 'Cidade Teste',
        state: 'ST'
      }
    }
  };
  
  // Define estado
  sistemaEntregadores.estadoPedidos[pedidoId] = 'atribuido';
  
  // Salva nos dois formatos
  localStorage.setItem('sistemaEntregadores', JSON.stringify(sistemaEntregadores));
  localStorage.setItem(`pedidos_${entregadorId}`, JSON.stringify(sistemaEntregadores.pedidosAtribuidos[entregadorId]));
  
  console.log(`✅ Pedido teste ${pedidoId} criado para ${entregadorId}`);
  
  // Recarrega a interface se for um entregador
  if (sistemaEntregadores.usuarioLogado && sistemaEntregadores.usuarioLogado.id === entregadorId) {
    carregarPedidosEntregador();
  }
  
  return pedidoId;
};

// Botão de debug na interface do entregador
function adicionarBotaoDebug() {
  // Verifica se já existe
  if (document.getElementById('debug-btn')) return;
  
  // Cria o botão
  const btn = document.createElement('button');
  btn.id = 'debug-btn';
  btn.innerHTML = '🐞 Debug';
  btn.style.position = 'fixed';
  btn.style.bottom = '10px';
  btn.style.right = '10px';
  btn.style.zIndex = '9999';
  btn.style.padding = '10px';
  btn.style.background = '#333';
  btn.style.color = 'white';
  btn.style.border = 'none';
  btn.style.borderRadius = '5px';
  btn.style.cursor = 'pointer';
  
  // Adiciona evento
  btn.addEventListener('click', () => {
    const actions = [
      'Verificar sistema (no console)',
      'Forçar sincronização',
      'Criar pedido teste',
      'Limpar todo o sistema'
    ];
    
    const action = prompt(`Escolha uma ação de debug:\n${actions.map((a, i) => `${i+1}. ${a}`).join('\n')}`);
    
    switch (action) {
      case '1':
        window.debugSistemaEntregadores();
        break;
      case '2':
        window.forcarSincronizacao();
        break;
      case '3':
        window.criarPedidoTeste();
        break;
      case '4':
        window.limparSistemaEntregadores();
        break;
      default:
        alert('Ação inválida ou cancelada');
    }
  });
  
  // Adiciona ao body
  document.body.appendChild(btn);
}

// Adiciona o botão quando a interface do entregador é exibida
const originalExibirTelaEntregador = exibirTelaEntregador;
window.exibirTelaEntregador = function() {
  originalExibirTelaEntregador();
  
  // Adiciona botão de debug com delay para garantir que o DOM esteja pronto
  setTimeout(adicionarBotaoDebug, 1000);
};

// Não espera polling, já exibe logo os pedidos
window.addEventListener('focus', () => {
  if (sistemaEntregadores.usuarioEntregadorLogado) {
    carregarPedidosEntregador();
  }
});
