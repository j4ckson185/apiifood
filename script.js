// Configurações
const CONFIG = {
    merchantId: '2733980',
    merchantUUID: '3a9fc83b-ffc3-43e9-aeb6-36c9e827a143',
    clientId: 'e6415912-782e-4bd9-b6ea-af48c81ae323',
    clientSecret: '137o75y57ug8fm55ubfoxlwjpl0xm25jxj18ne5mser23mbprj5nfncvfnr82utnzx73ij4h449o298370rjwpycppazsfyh2s0l'
};

// Estado da aplicação
let state = {
    accessToken: null
};

// Funções de utilidade
const showLoading = () => document.getElementById('loading-overlay').classList.remove('hidden');
const hideLoading = () => document.getElementById('loading-overlay').classList.add('hidden');

const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

// Função de autenticação
async function authenticate() {
    try {
        showLoading();

        const formData = new URLSearchParams();
        formData.append('grantType', 'client_credentials');
        formData.append('clientId', CONFIG.clientId);
        formData.append('clientSecret', CONFIG.clientSecret);

        const response = await fetch('/.netlify/functions/ifood-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: '/authentication/v1.0/oauth/token',
                method: 'POST',
                body: formData.toString(),
                isAuth: true
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na autenticação: ${response.status}`);
        }

        const data = await response.json();
        state.accessToken = data.accessToken;
        
        if (state.accessToken) {
            showToast('Autenticado com sucesso!', 'success');
            // Após autenticação, buscar lojas
            fetchMerchants();
        } else {
            throw new Error('Token não recebido');
        }
    } catch (error) {
        console.error('Erro na autenticação:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Função para buscar lojas
async function fetchMerchants() {
    try {
        showLoading();
        const response = await fetch('/.netlify/functions/ifood-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.accessToken}`
            },
            body: JSON.stringify({
                path: '/merchant/v1.0/merchants',
                method: 'GET'
            })
        });

        if (!response.ok) {
            throw new Error(`Erro ao buscar lojas: ${response.status}`);
        }

        const merchants = await response.json();
        console.log('Lojas:', merchants);
        showToast('Lojas carregadas com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao buscar lojas:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Event Listeners
document.getElementById('poll-orders').addEventListener('click', authenticate);

// Inicialização
authenticate();
