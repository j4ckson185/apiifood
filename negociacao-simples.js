// Versão simplificada da plataforma de negociação (standalone)
(function() {
    console.log('🤝 Carregando módulo simplificado de negociação');
    
    // Função para exibir o modal de negociação
    function mostrarNegociacao(pedidoId) {
        // Cria os dados de disputa
        const disputa = {
            disputeId: 'disp_' + Date.now(),
            orderId: pedidoId,
            type: 'CANCELLATION_REQUEST',
            customerName: 'Cliente Teste',
            reason: 'DELAY: Pedido atrasado em mais de 1 hora',
            expiresAt: new Date(Date.now() + 300000).toISOString(),
            timeoutAction: 'ACCEPT'
        };
        
        // Cria o container do modal se não existir
        let modalContainer = document.getElementById('modal-negociacao-simples');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'modal-negociacao-simples';
            modalContainer.style.position = 'fixed';
            modalContainer.style.top = '0';
            modalContainer.style.left = '0';
            modalContainer.style.width = '100%';
            modalContainer.style.height = '100%';
            modalContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            modalContainer.style.display = 'flex';
            modalContainer.style.justifyContent = 'center';
            modalContainer.style.alignItems = 'center';
            modalContainer.style.zIndex = '9999';
            document.body.appendChild(modalContainer);
        }
        
        // Define o conteúdo do modal
        modalContainer.innerHTML = `
            <div style="background-color: white; border-radius: 10px; max-width: 500px; width: 100%;">
                <div style="background-color: #ea1d2c; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; border-top-left-radius: 10px; border-top-right-radius: 10px;">
                    <h2 style="margin: 0; font-size: 18px;">Solicitação de Cancelamento</h2>
                    <span style="background-color: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px; font-size: 14px;">Pedido #${pedidoId.substring(0, 8)}</span>
                    <button onclick="fecharNegociacaoSimples()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">×</button>
                </div>
                <div style="padding: 20px;">
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p><strong>Cliente:</strong> ${disputa.customerName}</p>
                        <p><strong>Motivo:</strong> ${disputa.reason}</p>
                        <p><strong>Tempo restante:</strong> 5:00</p>
                        <p><strong>Ação automática:</strong> Aceitar cancelamento</p>
                    </div>
                    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin-top: 20px;">
                        <p style="margin: 0; display: flex; align-items: center; gap: 10px;">
                            <i style="font-size: 20px;">ℹ️</i>
                            Você pode aceitar ou rejeitar esta solicitação de cancelamento.
                        </p>
                    </div>
                </div>
                <div style="padding: 15px 20px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #f1f3f4; background-color: #f9f9f9; border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;">
                    <button onclick="responderNegociacao('${disputa.disputeId}', 'REJECT')" style="padding: 10px 20px; background-color: white; color: #dc3545; border: 1px solid #dc3545; border-radius: 6px; font-weight: 600; cursor: pointer;">
                        Rejeitar
                    </button>
                    <button onclick="responderNegociacao('${disputa.disputeId}', 'ACCEPT')" style="padding: 10px 20px; background-color: #ea1d2c; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
                        Aceitar
                    </button>
                </div>
            </div>
        `;
        
        // Exibe o modal
        modalContainer.style.display = 'flex';
        
        // Emite alerta sonoro
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JmKacmH10ZVNXZnuNpK6xraWUiXluZWx2gYqRlJGMgHNpYWRpcH2GjpOTjoR5aVxUUldbYmt3gIuTlZONhXx0b2hibHN5gIaLjY2IgHVrZGNocHN5f4OFhYN/eG9oZGNmaW9ydn+Hi4+RkIyCdmlhXl9jZ3J4f4OEhYGAenRtaGVna293fIGGiouJhoF8d3Nwd3l9f4GBf316dnBraWlrbXF0eH2ChouMioaBeXNubGxucHR4e36BgoKBfnp1cW1ra2xvcXR3en2ChIeIhoN+enZycXJzdXd6e36AgIB+e3dzb21tbW9xdHZ6fYCDhYaFgX15dXFvcHFydXd6fYCAgIB9enZybmxrbG5ucHN2en2ChIaGhIB8eHRwb29wcXR3en2AgIB/fHl1cW5sa2xucHN1eHyCg4WFg4B9eXVxb29wcnV3en2AgIB+e3dzb21sbW9xdHd6fYGDhIWEgX56dnJwcHFzdXh7foCAf316dnJubGxtb3J1eHuAgoSFhIJ/e3dzb29wcnR3en1/gIB+e3hzbWxrbG5wcnV4e3+Cg4WDgX97d3Rvb3Bydnh7foCAf356dnJubGxtb3J1eHuAgoSFhIJ/e3dzb29wcnR3en1/gIB+e3hzbWxrbG5wcnV4e3+Cg4WDgX97d3Rvb3Bydnh7foCAf356dnJubGxtb3J1eHuAgoSFhIJ/e3dzb29wcnR3en1/gIB+e3hzbWxrbG5wcnV4e3+Cg4WDgX97d3Rvb3Bydnh7foCAf356dnJubGxtb3J1eHuAgoSFhIJ/e3dzb29wcnR3en1/gIB+e3hzbWxrbG5wcnV4e3+Cg4WDgX97d3Rvb3Bydnh7foCAf356dnJubGxtb3J1eHuAgoSFhIJ/e3dzb29wcnR3en1/gIB+e3hzbWxrbG5wcnV4e3+Cg4WDgX97d3Rvb3Bydnh7foCAf356dnJubGxtb3J1eHuAgoSFhIJ/e3dzb29wcnR3en1/gIB+e3hzbWxrbG5wcnV4e3+Cg4WDgX97d3Rvb3Bydnh7foCAf356dnJubGxtb3J1eHuAgoSFhIJ/e3dzb29wcnR3en1/gIB+e3hzbWxrbG5wcnV4e3+Cg4WDgX97d3Rvb3Bydnh7foCAf356dnJubGxtb3J1eHuAgoSFhIJ/e3dzb29wcnR3en1/gIB+e3hzbWxrbG5wcnV4e3+Cg4WDgX97d3Rvb3Bydnh7foCAf356dnJubGxtb3J1eHuAgoSFhIJ/e3dzb29wcnR3en1/gIB+e3hzbWxrbG5wcnV4e3+Cg4WDgX97d3Rvb3Bydnh7foCAf356dnJubGxtb3J1eHuAgoSFhIJ/e3dzb29wcnR3en1/gIB+e3hzbWxrbG5wcnV4e3+Cg4WDgX97d3Rvb3Bydnh7foCAf356dnJubGxtb3J1eHuAgoSFhIJ/e3dzb29wcnR3en1/gIB+e3hzbWxrbG5wcnV4e3+Cg4WDgX97d3Rvb3Bydnh7foCAf356dnJubA==');
            audio.play();
        } catch (error) {
            console.warn('Erro ao tocar som de alerta:', error);
        }
        
        // Registra funções globais
        window.fecharNegociacaoSimples = fecharNegociacaoSimples;
        window.responderNegociacao = responderNegociacao;
        
        // Mostra notificação
        mostrarNotificacao('Nova solicitação de negociação recebida!', 'warning');
    }
    
    // Função para fechar o modal
    function fecharNegociacaoSimples() {
        const modalContainer = document.getElementById('modal-negociacao-simples');
        if (modalContainer) {
            modalContainer.style.display = 'none';
        }
    }
    
    // Função para responder a negociação
    function responderNegociacao(disputeId, resposta) {
        let tipoResposta = resposta === 'ACCEPT' ? 'aceita' : 'rejeitada';
        mostrarNotificacao(`Negociação ${tipoResposta} com sucesso!`, 'success');
        fecharNegociacaoSimples();
    }
    
    // Função para mostrar notificação
    function mostrarNotificacao(mensagem, tipo = 'info') {
        // Busca container ou cria um novo
        let container = document.getElementById('notificacao-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificacao-container';
            container.style.position = 'fixed';
            container.style.bottom = '20px';
            container.style.right = '20px';
            container.style.zIndex = '10000';
            document.body.appendChild(container);
        }
        
        // Cria toast
        const toast = document.createElement('div');
        toast.style.backgroundColor = 'white';
        toast.style.color = '#333';
        toast.style.padding = '12px 20px';
        toast.style.margin = '10px';
        toast.style.borderRadius = '6px';
        toast.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
        toast.style.minWidth = '300px';
        
        // Define borda baseada no tipo
        if (tipo === 'success') {
            toast.style.borderLeft = '4px solid #28a745';
        } else if (tipo === 'error') {
            toast.style.borderLeft = '4px solid #dc3545';
        } else if (tipo === 'warning') {
            toast.style.borderLeft = '4px solid #ffc107';
        } else {
            toast.style.borderLeft = '4px solid #17a2b8';
        }
        
        // Adiciona ícone e mensagem
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span>${mensagem}</span>
            </div>
        `;
        
        // Adiciona ao container
        container.appendChild(toast);
        
        // Remove após 3 segundos
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    
    // Expõe a função principal globalmente
    window.mostrarNegociacao = mostrarNegociacao;
    
    // Adiciona botão de teste na interface
    function adicionarBotaoTeste() {
        const botao = document.createElement('button');
        botao.textContent = 'Testar Negociação';
        botao.style.position = 'fixed';
        botao.style.top = '10px';
        botao.style.right = '10px';
        botao.style.zIndex = '1000';
        botao.style.padding = '8px 16px';
        botao.style.backgroundColor = '#ea1d2c';
        botao.style.color = 'white';
        botao.style.border = 'none';
        botao.style.borderRadius = '4px';
        botao.style.cursor = 'pointer';
        
        botao.addEventListener('click', function() {
            // Usa o ID do pedido fornecido ou gera um novo
            const pedidoId = '68192402-8549-4199-be76-7de73cac9595';
            mostrarNegociacao(pedidoId);
        });
        
        document.body.appendChild(botao);
    }
    
    // Inicializa
    setTimeout(adicionarBotaoTeste, 1000);
    console.log('🤝 Módulo simplificado de negociação carregado com sucesso');
})();
