// Módulo para gerenciamento de avaliações do iFood
// Este arquivo implementa a comunicação com a API de avaliações do iFood

// Estado das avaliações
let reviewsState = {
    merchantId: CONFIG.merchantUUID, // Usa o UUID especificamente para avaliações
    currentPage: 1,
    pageSize: 10,
    totalReviews: 0,
    reviews: [],
    selectedReview: null,
    isLoading: false
};

// No reviews.js, função fetchReviews
async function fetchReviews(page = 1, size = 10) {
    try {
        console.log('🔍 Buscando avaliações da página:', page);
        reviewsState.isLoading = true;
        updateReviewsLoading(true);

        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 89);
        const dateTo = new Date();

        const formatDate = (date) => date.toISOString().split('.')[0] + 'Z';

        const queryParams = new URLSearchParams({
            page: page.toString(),
            pageSize: size.toString(),
            addCount: 'false',
            dateFrom: formatDate(dateFrom),
            dateTo: formatDate(dateTo),
            sort: 'DESC',
            sortBy: 'CREATED_AT'
        }).toString();

        // Usa explicitamente o UUID para o endpoint de reviews
        const path = `/review/v2.0/merchants/${CONFIG.merchantUUID}/reviews?${queryParams}`;
        
        console.log('🔍 Caminho da requisição:', path); // Log para debug

        const response = await makeAuthorizedRequest(path, 'GET');

        console.log('✅ Avaliações recebidas:', response);

        if (response && Array.isArray(response.reviews)) {
            reviewsState.reviews = response.reviews;
            reviewsState.totalReviews = response.total || response.reviews.length;
            reviewsState.currentPage = page;
            reviewsState.pageSize = size;

            displayReviews(response.reviews);
            updatePagination(page, Math.ceil(reviewsState.totalReviews / size));
        } else {
            console.error('❌ Formato de resposta inválido para avaliações:', response);
            showToast('Erro ao carregar avaliações. Formato inválido.', 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao buscar avaliações:', error);
        showToast('Erro ao carregar avaliações', 'error');
    } finally {
        reviewsState.isLoading = false;
        updateReviewsLoading(false);
    }
}

async function fetchReviewDetails(reviewId) {
    try {
        console.log(`🔍 Buscando detalhes da avaliação ${reviewId}`);
        showLoading();

        const path = `/review/v2.0/merchants/${CONFIG.merchantUUID}/reviews/${reviewId}`;
        const response = await makeAuthorizedRequest(path, 'GET');

        // ... resto do código ...
    } catch (error) {
        console.error(`❌ Erro ao buscar detalhes da avaliação ${reviewId}:`, error);
        showToast('Erro ao carregar detalhes da avaliação', 'error');
    } finally {
        hideLoading();
    }
}

async function submitReviewAnswer(reviewId, text) {
    try {
        // ... validações iniciais ...

        const path = `/review/v2.0/merchants/${CONFIG.merchantUUID}/reviews/${reviewId}/answers`;
        const response = await makeAuthorizedRequest(path, 'POST', { text: text });

        // ... resto do código ...
    } catch (error) {
        console.error(`❌ Erro ao enviar resposta para avaliação ${reviewId}:`, error);
        showToast('Erro ao enviar resposta: ' + (error.message || 'Tente novamente'), 'error');
        return false;
    }
}

function displayReviews(reviews) {
    const reviewsContainer = document.getElementById('reviews-list');
    if (!reviewsContainer) {
        console.error('Elemento reviews-list não encontrado');
        return;
    }
    
    reviewsContainer.innerHTML = '';
    
    if (!reviews || reviews.length === 0) {
        reviewsContainer.innerHTML = `
            <div class="empty-reviews">
                <i class="fas fa-comment-slash"></i>
                <h3>Nenhuma avaliação encontrada</h3>
                <p>Quando os clientes avaliarem sua loja, as avaliações aparecerão aqui</p>
            </div>
        `;
        return;
    }
    
    reviews.forEach(review => {
        // Formata as datas
        const reviewDate = new Date(review.createdAt);
        const orderDate = new Date(review.order.createdAt);
        
        // Formata a nota com estrelas
        const starsHtml = Array(5).fill(0).map((_, index) => {
            return index < review.score ? 
                '<i class="fas fa-star"></i>' : 
                '<i class="far fa-star"></i>';
        }).join('');
        
        const reviewCard = document.createElement('div');
        reviewCard.className = 'review-card';
        reviewCard.innerHTML = `
            <div class="review-header">
                <div class="review-meta">
                    <span class="review-date">
                        <i class="far fa-calendar"></i>
                        ${reviewDate.toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                    <span class="review-id">
                        <i class="fas fa-hashtag"></i>
                        Pedido ${review.order.shortId}
                    </span>
                </div>
                <div class="review-score">
                    ${starsHtml}
                    <span class="score-value">${review.score.toFixed(1)}</span>
                </div>
            </div>
            
            <div class="review-content">
                ${review.comment ? `
                    <div class="review-comment">
                        <i class="fas fa-quote-left"></i>
                        <p>${review.comment}</p>
                        <i class="fas fa-quote-right"></i>
                    </div>
                ` : ''}
                
                ${review.replies && review.replies.length > 0 ? `
                    <div class="review-replies">
                        ${review.replies.map(reply => `
                            <div class="review-reply">
                                <div class="reply-header">
                                    <i class="fas fa-reply"></i>
                                    <span class="reply-from">Resposta da Loja</span>
                                    <span class="reply-date">
                                        ${new Date(reply.createdAt).toLocaleDateString('pt-BR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                                <div class="reply-content">
                                    <p>${reply.text}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="review-details">
                    <div class="detail-item">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value ${review.status.toLowerCase()}">
                            ${review.status === 'PUBLISHED' ? 'Publicado' : review.status}
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Data do Pedido:</span>
                        <span class="detail-value">
                            ${orderDate.toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="review-actions">
                ${!review.replies || review.replies.length === 0 ? `
                    <button class="action-button respond" onclick="showReviewModal('${review.id}')">
                        <i class="fas fa-reply"></i>
                        Responder
                    </button>
                ` : `
                    <button class="action-button view" onclick="showReviewModal('${review.id}')">
                        <i class="fas fa-eye"></i>
                        Ver Detalhes
                    </button>
                `}
            </div>
        `;
        
        reviewsContainer.appendChild(reviewCard);
    });
}

// Função para gerar HTML das estrelas
function generateStarsHtml(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    let starsHtml = '';
    
    // Estrelas cheias
    for (let i = 0; i < fullStars; i++) {
        starsHtml += '<i class="fas fa-star"></i>';
    }
    
    // Meia estrela
    if (halfStar) {
        starsHtml += '<i class="fas fa-star-half-alt"></i>';
    }
    
    // Estrelas vazias
    for (let i = 0; i < emptyStars; i++) {
        starsHtml += '<i class="far fa-star"></i>';
    }
    
    return starsHtml;
}

// Função para atualizar a paginação
function updatePagination(currentPage, totalPages) {
    const paginationElement = document.getElementById('reviews-pagination');
    if (!paginationElement) return;
    
    // Limpa o container
    paginationElement.innerHTML = '';
    
    // Se não houver páginas ou apenas uma, não mostra paginação
    if (!totalPages || totalPages <= 1) {
        paginationElement.classList.add('hidden');
        return;
    } else {
        paginationElement.classList.remove('hidden');
    }
    
    // Botão anterior
    const prevButton = document.createElement('button');
    prevButton.className = `pagination-button ${currentPage <= 1 ? 'disabled' : ''}`;
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.disabled = currentPage <= 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            fetchReviews(currentPage - 1, reviewsState.pageSize);
        }
    };
    paginationElement.appendChild(prevButton);
    
    // Informação de página
    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    paginationElement.appendChild(pageInfo);
    
    // Botão próximo
    const nextButton = document.createElement('button');
    nextButton.className = `pagination-button ${currentPage >= totalPages ? 'disabled' : ''}`;
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.disabled = currentPage >= totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            fetchReviews(currentPage + 1, reviewsState.pageSize);
        }
    };
    paginationElement.appendChild(nextButton);
}

// Função para atualizar o estado de carregamento
function updateReviewsLoading(isLoading) {
    const reviewsContainer = document.getElementById('reviews-container');
    if (!reviewsContainer) return;
    
    const loadingElement = document.getElementById('reviews-loading');
    if (loadingElement) {
        if (isLoading) {
            loadingElement.classList.remove('hidden');
        } else {
            loadingElement.classList.add('hidden');
        }
    }
}

// Função para mostrar o modal de avaliação
function showReviewModal(review) {
    // Cria ou obtém o container do modal
    let modalContainer = document.getElementById('review-modal-container');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'review-modal-container';
        modalContainer.className = 'modal';
        document.body.appendChild(modalContainer);
    }
    
    // Formata a data
    const reviewDate = new Date(review.createdAt);
    const formattedDate = reviewDate.toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Gera as estrelas
    const starsHtml = generateStarsHtml(review.rating);
    
    // Verifica se tem resposta
    const hasAnswer = review.answer && review.answer.text;
    
    // Obtém informações do pedido
    const orderNumber = review.orderInfo?.orderId || 'N/A';
    const orderDate = review.orderInfo?.createdAt ? 
        new Date(review.orderInfo.createdAt).toLocaleDateString('pt-BR') : 'N/A';
    
    // Preparar a seção de resposta
    let responseSection = '';
    
    if (hasAnswer) {
        // Se já tem resposta, exibe
        responseSection = `
            <div class="response-section">
                <h3><i class="fas fa-reply"></i> Sua resposta</h3>
                <div class="review-answer-full">
                    <p>${review.answer.text}</p>
                    ${review.answer.createdAt ? `
                    <div class="answer-date">
                        Respondido em: ${new Date(review.answer.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    } else {
        // Se não tem resposta, exibe formulário
        responseSection = `
            <div class="response-section">
                <h3><i class="fas fa-reply"></i> Responder avaliação</h3>
                <div class="response-form">
                    <textarea id="review-response-text" 
                              placeholder="Digite sua resposta ao cliente..."
                              rows="4"></textarea>
                    <div class="form-help">
                        <i class="fas fa-info-circle"></i>
                        Lembre-se de seguir as diretrizes da <a href="#" onclick="showReviewPolicy(); return false;">Política de Avaliações</a>
                    </div>
                    <button id="submit-review-response" class="primary-button">
                        <i class="fas fa-paper-plane"></i> Enviar Resposta
                    </button>
                </div>
            </div>
        `;
    }
    
    // Define o conteúdo do modal
    modalContainer.innerHTML = `
        <div class="modal-content review-modal-content">
            <div class="modal-header">
                <h2>Detalhes da Avaliação</h2>
                <span class="close-modal" onclick="closeReviewModal()">&times;</span>
            </div>
            <div class="modal-body review-modal-body">
                <div class="review-details">
                    <div class="review-details-header">
                        <div class="review-customer-info">
                            <h3>${review.orderInfo?.customer?.name || 'Cliente'}</h3>
                            <div class="review-date-full">${formattedDate}</div>
                        </div>
                        <div class="review-rating-large">
                            ${starsHtml}
                        </div>
                    </div>
                    
                    ${review.comment ? `
                    <div class="review-comment-full">
                        <h3><i class="fas fa-comment"></i> Comentário do cliente</h3>
                        <p>${review.comment}</p>
                    </div>
                    ` : ''}
                    
                    <div class="review-order-info">
                        <h3><i class="fas fa-receipt"></i> Informações do pedido</h3>
                        <div class="order-info-grid">
                            <div class="order-info-item">
                                <span class="info-label">Número do pedido:</span>
                                <span class="info-value">${orderNumber}</span>
                            </div>
                            <div class="order-info-item">
                                <span class="info-label">Data do pedido:</span>
                                <span class="info-value">${orderDate}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${responseSection}
                </div>
            </div>
        </div>
    `;
    
    // Exibe o modal
    modalContainer.style.display = 'flex';
    
    // Adiciona evento ao botão de enviar resposta, se existir
    const submitButton = document.getElementById('submit-review-response');
    if (submitButton) {
        submitButton.onclick = () => {
            const responseText = document.getElementById('review-response-text').value;
            submitReviewAnswer(review.id, responseText);
        };
    }
}

// Função para fechar o modal de avaliação
function closeReviewModal() {
    const modalContainer = document.getElementById('review-modal-container');
    if (modalContainer) {
        modalContainer.style.display = 'none';
    }
}

// Função para mostrar a política de avaliações
function showReviewPolicy() {
    // Cria ou obtém o modal da política
    let policyModalContainer = document.getElementById('review-policy-modal-container');
    if (!policyModalContainer) {
        policyModalContainer = document.createElement('div');
        policyModalContainer.id = 'review-policy-modal-container';
        policyModalContainer.className = 'modal';
        document.body.appendChild(policyModalContainer);
    }
    
    // Conteúdo da política de avaliação conforme o documento fornecido
    policyModalContainer.innerHTML = `
        <div class="modal-content policy-modal-content">
            <div class="modal-header">
                <h2>Política de Avaliação</h2>
                <span class="close-modal" onclick="closeReviewPolicyModal()">&times;</span>
            </div>
            <div class="modal-body policy-modal-body">
                <div class="policy-content">
                    <div class="policy-section">
                        <p>A avaliação é um recurso disponibilizado pelo iFood para coletar a opinião de clientes sobre os pedidos feitos nas lojas parceiras e para que o uso da plataforma pelos clientes seja mais justo e confiável. Entenda as regras:</p>
                    </div>
                    
                    <div class="policy-section">
                        <h3>Para Clientes</h3>
                        <p>No prazo de 7 dias corridos, contados da compra, será permitido aos Clientes do iFood avaliar e publicar comentários na plataforma iFood sobre as lojas parceiras nas quais fizeram pedidos, bem como a entrega. Suas avaliações e comentários devem seguir as regras desta política e dos "Termos e Condições de Uso da Plataforma iFood" disponíveis em <a href="https://webmiddleware.ifood.com.br/termos?" target="_blank">https://webmiddleware.ifood.com.br/termos?</a>.</p>
                        
                        <h4>O que é permitido nas avaliações:</h4>
                        <ul>
                            <li>Expressar na avaliação a opinião pessoal do consumidor sobre o pedido</li>
                            <li>Comentar sobre a qualidade dos produtos, armazenamento, manipulação e prazo de validade</li>
                            <li>Incluir opinião sobre a entrega do pedido</li>
                        </ul>
                        
                        <h4>Para que siga as regras dos "Termos e Condições de Uso da Plataforma iFood" as avaliações não podem:</h4>
                        <ul>
                            <li>Ser realizadas por uma pessoa que tenha relação ou ligação comercial ou familiar com a loja parceira</li>
                            <li>Constituir avaliações falsas, ou seja, não baseadas em experiências reais, podendo ser positivas para beneficiar ou negativas para prejudicar a loja parceira</li>
                            <li>Conter opiniões pessoais sobre política, ética, religião, profissão ou questões sociais mais abrangentes (como racismo, por exemplo)</li>
                            <li>Ameaçar, intimidar ou insultar a loja parceira, a equipe do iFood ou os entregadores parceiros</li>
                            <li>Conter ofensa, desrespeito, vulgaridade ou tom agressivo relativo à loja parceira, aos seus colaboradores, ao iFood e aos entregadores parceiros</li>
                        </ul>
                        
                        <p>Avaliações ou comentários inapropriados na plataforma iFood poderão ser removidos sem aviso prévio. O perfil do usuário responsável poderá enfrentar penalidades, incluindo a suspensão ou exclusão da conta na plataforma iFood, além de possíveis medidas judiciais, as quais poderão ser tomadas por aquele(a) que se sinta violado(a).</p>
                    </div>
                    
                    <div class="policy-section">
                        <h3>Para o iFood</h3>
                        <p>As avaliações e comentários no iFood são opiniões dos clientes e não refletem a posição oficial da plataforma. O iFood não se responsabiliza por eventuais problemas causados por essas avaliações. No entanto, adota processos para monitorar e gerenciar avaliações inadequadas, garantindo que apenas comentários que seguem nossas regras sejam exibidos. É importante saber que o iFood não colabora com terceiros para melhorar avaliações ou a posição das lojas parceiras no aplicativo; qualquer oferta desse tipo deve ser reportada a nós.</p>
                    </div>
                    
                    <div class="policy-section">
                        <h3>Para as lojas parceiras</h3>
                        <p>A avaliação é um recurso disponibilizado pelo iFood para que você tenha retorno de como foi a experiência com os seus clientes e entenda em quais pontos sua loja pode melhorar para oferecer uma experiência incrível. Sendo assim, lojas com avaliações negativas baseadas somente no gosto pessoal do cliente não são retiradas da plataforma. Vale ressaltar que a avaliação não impacta na ordem em que as lojas aparecem no iFood, uma vez que essa posição é calculada pelo algoritmo de recomendação a cada usuário da plataforma. A nota interfere somente na percepção da reputação da sua loja por clientes.</p>
                        
                        <p>Tanto em casos de avaliações positivas quanto negativas, você sempre pode responder o comentário, desde que cumpra as políticas internas do iFood, especialmente a política de Conteúdo do iFood, disponível no portal do parceiro, e, adicionalmente, as seguintes regras:</p>
                        
                        <h4>O que não é permitido nas respostas:</h4>
                        <ul>
                            <li>Conteúdo comercial ou incentivo a pedidos por canais que não sejam vinculados ao iFood</li>
                            <li>Opiniões pessoais sobre política, ética, religião, profissão ou questões sociais mais abrangentes (como racismo, por exemplo)</li>
                            <li>Ameaçar, intimidar ou insultar os clientes, a equipe do iFood ou os entregadores parceiros</li>
                            <li>Ofensa, desrespeito, vulgaridade ou tom agressivo relativo ao cliente, seus familiares ou sua classe social ou categoria profissional</li>
                            <li>Divulgação ou compartilhamento de dados pessoais do cliente, tais como, mas não se limitando a, nome completo, telefone, endereço, perfil nas redes sociais e e-mail</li>
                            <li>Tentar restringir as contribuições dos clientes</li>
                            <li>Respostas direcionadas à equipe do iFood ou comentários sobre as políticas do iFood</li>
                        </ul>
                        
                        <p>As respostas que infringirem as regras previstas em qualquer das políticas do iFood poderão sofrer penalidades, como moderação do conteúdo ou até mesmo rescisão de contrato.</p>
                    </div>
                    
                    <div class="policy-section">
                        <h3>Moderação de avaliação</h3>
                        <p>Sua loja terá até 07 dias corridos para solicitar a moderação de uma avaliação ou responder o consumidor. Após esse período, não será possível realizar exclusão, réplica ou modificação da avaliação.</p>
                        
                        <h4>Quando não pedir moderação:</h4>
                        <ul>
                            <li>A avaliação conter a opinião pessoal do consumidor sobre o pedido; tanto em relação à qualidade dos itens como à quantidade</li>
                            <li>O comentário mencionar sobre a embalagem dos produtos</li>
                            <li>O comentário refletir uma opinião pessoal quanto ao armazenamento, manipulação e prazo de validade dos produtos</li>
                            <li>A avaliação refere-se a um processo de entrega própria</li>
                        </ul>
                        
                        <p>Considere a avaliação de sua loja e da sua entrega. Identifique os pontos que sua loja pode melhorar, seja em relação ao cardápio/disponibilidade dos produtos, descrição dos itens ou gerenciamento das expectativas dos clientes. Encare a avaliação recebida como uma crítica construtiva que contribuirá para o crescimento contínuo da sua loja.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Exibe o modal
    policyModalContainer.style.display = 'flex';
}

// Função para fechar o modal da política de avaliações
function closeReviewPolicyModal() {
    const policyModalContainer = document.getElementById('review-policy-modal-container');
    if (policyModalContainer) {
        policyModalContainer.style.display = 'none';
    }
}

// Adiciona estilos específicos para avaliações
function addReviewsStyles() {
    if (document.getElementById('reviews-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'reviews-styles';
    styles.textContent = `
        /* Estilos para a seção de avaliações */
        .reviews-container {
            background-color: white;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            padding: 2rem;
        }
        
        .reviews-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
        }
        
        .reviews-header h2 {
            font-size: 1.5rem;
            color: var(--dark-gray);
            margin: 0;
        }
        
        .reviews-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 1.5rem;
            margin-bottom: 2rem;
            background-color: var(--light-gray);
            padding: 1.5rem;
            border-radius: var(--border-radius);
        }
        
        .reviews-summary-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 120px;
        }
        
        .summary-label {
            font-size: 0.8rem;
            color: #666;
            margin-bottom: 0.5rem;
        }
        
        .summary-value {
            font-size: 2rem;
            font-weight: bold;
            color: var(--dark-gray);
        }
        
        .review-stars {
            color: var(--warning-color);
            font-size: 1.5rem;
            margin-top: 0.5rem;
        }
        
        .reviews-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .reviews-actions {
            display: flex;
            justify-content: center;
            margin-top: 1.5rem;
        }
        
        .show-policy-button {
            background-color: var(--light-gray);
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s;
        }
        
        .show-policy-button:hover {
            background-color: var(--medium-gray);
        }
        
        /* Styles for review cards */
        .review-card {
            background-color: var(--light-gray);
            border-radius: var(--border-radius);
            padding: 1.5rem;
            transition: all 0.2s;
            border-left: 4px solid var(--warning-color);
        }
        
        .review-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow);
        }
        
        .review-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        
        .review-rating {
            color: var(--warning-color);
            font-size: 1.2rem;
        }
        
        .review-date {
            font-size: 0.8rem;
            color: #666;
        }
        
        .review-content {
            margin-bottom: 1.5rem;
        }
        
        .review-customer {
            font-weight: bold;
            margin-bottom: 0.5rem;
            color: var(--dark-gray);
        }
        
        .review-comment {
            position: relative;
            background-color: white;
            padding: 1rem 1.5rem;
            border-radius: var(--border-radius);
            margin-bottom: 1rem;
        }
        
        .review-comment i {
            position: absolute;
            top: 0.5rem;
            left: 0.5rem;
            color: #ccc;
        }
        
        .review-comment p {
            margin: 0;
            padding-left: 1rem;
        }
        
        .review-answer {
            background-color: #e8f4fd;
            padding: 1rem;
            border-radius: var(--border-radius);
            margin-top: 1rem;
            border-left: 3px solid #4285f4;
        }
        
        .answer-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: #4285f4;
            margin-bottom: 0.5rem;
            font-weight: 500;
        }
        
        .review-footer {
            display: flex;
            justify-content: flex-end;
        }
        
        .review-action-button {
            background-color: #4285f4;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s;
        }
        
        .review-action-button:hover {
            background-color: #1a73e8;
        }
        
        /* Estilos para o modal de avaliação */
        .review-modal-content {
            max-width: 700px;
            width: 90%;
        }
        
        .review-modal-body {
            padding: 0;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .review-details {
            padding: 1.5rem;
        }
        
        .review-details-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid var(--light-gray);
            padding-bottom: 1.5rem;
        }
        
        .review-customer-info h3 {
            margin: 0 0 0.5rem 0;
            color: var(--dark-gray);
        }
        
        .review-date-full {
            font-size: 0.9rem;
            color: #666;
        }
        
        .review-rating-large {
            font-size: 1.5rem;
            color: var(--warning-color);
        }
        
        .review-comment-full {
            background-color: var(--light-gray);
            padding: 1.5rem;
            border-radius: var(--border-radius);
            margin-bottom: 1.5rem;
        }
        
        .review-comment-full h3 {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0 0 1rem 0;
            color: var(--dark-gray);
            font-size: 1rem;
        }
        
        .review-comment-full p {
            margin: 0;
            font-size: 1.1rem;
            line-height: 1.6;
        }
        
        .review-order-info {
            background-color: var(--light-gray);
            padding: 1.5rem;
            border-radius: var(--border-radius);
            margin-bottom: 1.5rem;
        }
        
        .review-order-info h3 {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0 0 1rem 0;
            color: var(--dark-gray);
            font-size: 1rem;
        }
        
        .order-info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1rem;
        }
        
        .order-info-item {
            display: flex;
            flex-direction: column;
        }
        
        .info-label {
            font-size: 0.8rem;
            color: #666;
        }
        
        .info-value {
            font-weight: 500;
        }
        
        .response-section {
            background-color: #e8f4fd;
            padding: 1.5rem;
            border-radius: var(--border-radius);
            border-left: 4px solid #4285f4;
        }
        
        .response-section h3 {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0 0 1rem 0;
            color: #4285f4;
            font-size: 1rem;
        }
        
        .review-answer-full {
            background-color: white;
            padding: 1.5rem;
            border-radius: var(--border-radius);
        }
        
        .review-answer-full p {
            margin: 0 0 1rem 0;
            font-size: 1.1rem;
            line-height: 1.6;
        }
        
        .answer-date {
            font-size: 0.9rem;
            color: #666;
            text-align: right;
        }
        
        .response-form {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        
        .response-form textarea {
            width: 100%;
            padding: 1rem;
            border: 1px solid #d0d0d0;
            border-radius: var(--border-radius);
            font-size: 1rem;
            resize: vertical;
        }
        
        .form-help {
            font-size: 0.9rem;
            color: #666;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .form-help a {
            color: #4285f4;
            text-decoration: none;
        }
        
        .form-help a:hover {
            text-decoration: underline;
        }
        
        /* Policy modal styles */
        .policy-modal-content {
            max-width: 800px;
            width: 90%;
        }
        
        .policy-modal-body {
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .policy-content {
            padding: 1.5rem;
        }
        
        .policy-section {
            margin-bottom: 2rem;
        }
        
        .policy-section h3 {
            color: var(--primary-color);
            margin: 0 0 1rem 0;
            font-size: 1.2rem;
        }
        
        .policy-section h4 {
            color: var(--dark-gray);
            margin: 1.5rem 0 0.5rem 0;
            font-size: 1rem;
        }
        
        .policy-section p {
            margin: 0 0 1rem 0;
            line-height: 1.6;
        }
        
        .policy-section ul {
            margin: 0 0 1rem 0;
            padding-left: 1.5rem;
        }
        
        .policy-section li {
            margin-bottom: 0.5rem;
            line-height: 1.6;
        }
        
        .policy-section a {
            color: #4285f4;
            text-decoration: none;
        }
        
        .policy-section a:hover {
            text-decoration: underline;
        }
        
        /* Empty state */
        .empty-reviews {
            text-align: center;
            padding: 3rem;
        }
        
        .empty-reviews i {
            font-size: 3rem;
            color: #ccc;
            margin-bottom: 1rem;
        }
        
        .empty-reviews h3 {
            color: var(--dark-gray);
            margin-bottom: 0.5rem;
        }
        
        .empty-reviews p {
            color: #666;
        }
        
        /* Loader */
        .reviews-loading {
            text-align: center;
            padding: 2rem;
        }
        
        .reviews-loader {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(0, 0, 0, 0.1);
            border-top: 4px solid var(--primary-color);
            border-radius: 50%;
            margin: 0 auto 1rem;
            animation: spin 1s linear infinite;
        }
        
        /* Pagination */
        .reviews-pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 1rem;
        }
        
        .pagination-button {
            background-color: var(--light-gray);
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        .pagination-button:hover:not(.disabled) {
            background-color: var(--medium-gray);
        }
        
        .pagination-button.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .pagination-info {
            font-size: 0.9rem;
            color: #666;
        }
        
        /* Responsividade */
        @media (max-width: 767px) {
            .reviews-summary {
                flex-direction: column;
                align-items: center;
            }
            
            .review-details-header {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .review-rating-large {
                margin-top: 1rem;
            }
            
            .order-info-grid {
                grid-template-columns: 1fr;
            }
        }
    `;
    
    document.head.appendChild(styles);
}

// Inicialização do módulo
function initReviewsModule() {
    console.log('🔄 Inicializando módulo de avaliações...');
    
    // Adiciona estilos
    addReviewsStyles();
    
    // Atualiza HTML da seção existente
    updateReviewsSection();
    
    // Expõe funções globais
    window.fetchReviews = fetchReviews;
    window.fetchReviewDetails = fetchReviewDetails;
    window.submitReviewAnswer = submitReviewAnswer;
    window.showReviewModal = showReviewModal;
    window.closeReviewModal = closeReviewModal;
    window.showReviewPolicy = showReviewPolicy;
    window.closeReviewPolicyModal = closeReviewPolicyModal;
    
    console.log('✅ Módulo de avaliações inicializado com sucesso');
}

// Atualiza o HTML da seção de avaliações
function updateReviewsSection() {
    const evaluationsSection = document.getElementById('evaluations-section');
    if (!evaluationsSection) {
        console.error('Seção de avaliações não encontrada');
        return;
    }
    
    // Substitui o conteúdo atual
    evaluationsSection.innerHTML = `
        <div class="reviews-container" id="reviews-container">
            <div class="reviews-header">
                <h2><i class="fas fa-star"></i> Avaliações dos Clientes</h2>
                <button class="refresh-button" onclick="fetchReviews(1)" title="Atualizar Avaliações">
                    <i class="fas fa-sync"></i>
                </button>
            </div>
            
            <div id="reviews-loading" class="reviews-loading hidden">
                <div class="reviews-loader"></div>
                <p>Carregando avaliações...</p>
            </div>
            
            <div class="reviews-summary">
                <div class="reviews-summary-item">
                    <span class="summary-label">Avaliação Média</span>
                    <span class="summary-value" id="average-rating">-</span>
                    <div class="review-stars" id="average-stars">
                        <i class="far fa-star"></i>
                        <i class="far fa-star"></i>
                        <i class="far fa-star"></i>
                        <i class="far fa-star"></i>
                        <i class="far fa-star"></i>
                    </div>
                </div>
                
                <div class="reviews-summary-item">
                    <span class="summary-label">Total de Avaliações</span>
                    <span class="summary-value" id="total-reviews">-</span>
                </div>
                
                <div class="reviews-summary-item">
                    <span class="summary-label">% Positivas (4-5★)</span>
                    <span class="summary-value" id="positive-percentage">-</span>
                </div>
                
                <div class="reviews-summary-item">
                    <span class="summary-label">% Respondidas</span>
                    <span class="summary-value" id="answered-percentage">-</span>
                </div>
            </div>
            
            <div id="reviews-list" class="reviews-list">
                <!-- As avaliações serão carregadas aqui -->
                <div class="empty-reviews">
                    <i class="fas fa-comments"></i>
                    <h3>Carregue suas avaliações</h3>
                    <p>Clique no botão de atualizar para ver suas avaliações</p>
                </div>
            </div>
            
            <div id="reviews-pagination" class="reviews-pagination hidden">
                <!-- Paginação será adicionada aqui -->
            </div>
            
            <div class="reviews-actions">
                <button class="show-policy-button" onclick="showReviewPolicy()">
                    <i class="fas fa-info-circle"></i> Ver Política de Avaliações
                </button>
            </div>
        </div>
    `;
}

// Executa a inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    initReviewsModule();
});
