// Arquivo para gerenciar impressão de comandas do PDV iFood
// Este arquivo contém funções para gerar e imprimir comandas de pedidos

// Função principal para imprimir a comanda de um pedido
function imprimirComanda(orderId) {
    console.log(`🖨️ Iniciando impressão da comanda para o pedido: ${orderId}`);
    
    try {
        // Busca o pedido no cache ou na DOM
        const pedido = ordersCache[orderId];
        
        if (!pedido) {
            console.error('❌ Pedido não encontrado para impressão');
            showToast('Erro ao imprimir: pedido não encontrado', 'error');
            return;
        }
        
        // Gera o conteúdo da comanda
        const conteudoComanda = gerarConteudoComanda(pedido);
        
        // Cria uma janela de impressão
        const janelaImpressao = window.open('', '_blank', 'width=800,height=600');
        
        if (!janelaImpressao) {
            console.error('❌ Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.');
            showToast('Erro ao abrir janela de impressão. Verifique o bloqueador de pop-ups.', 'error');
            return;
        }
        
        // Define o conteúdo da janela de impressão
        janelaImpressao.document.write(`
            <html>
                <head>
                    <title>Comanda Pedido #${pedido.displayId || pedido.id.substring(0, 6)}</title>
                    <style>
                        ${estilosComanda()}
                    </style>
                </head>
                <body>
                    <div class="comanda-container">
                        ${conteudoComanda}
                    </div>
                    <script>
                        // Inicia a impressão automaticamente após carregar
                        window.onload = function() {
                            window.print();
                            // Fecha a janela após imprimir (ou cancelar)
                            setTimeout(function() {
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        
        janelaImpressao.document.close();
        console.log('✅ Comanda enviada para impressão');
        showToast('Comanda enviada para impressão', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao imprimir comanda:', error);
        showToast('Erro ao gerar comanda para impressão', 'error');
    }
}

// Função para gerar o conteúdo da comanda
function gerarConteudoComanda(pedido) {
    // Formatação de data e hora
    const dataPedido = new Date(pedido.createdAt);
    const dataEntrega = pedido.scheduledDateTimeForDelivery ? 
                        new Date(pedido.scheduledDateTimeForDelivery) : 
                        new Date(dataPedido.getTime() + 30 * 60000); // +30min como padrão

    // Formatação de valores monetários
    const formatarValor = (valor) => `R$ ${typeof valor === 'number' ? valor.toFixed(2) : '0,00'}`;
    
    // Obtém tipos de entrega e retirada
    let tipoEntrega = 'Desconhecido';
    if (pedido.orderType === 'DELIVERY') {
        tipoEntrega = 'Delivery';
    } else if (pedido.takeout && pedido.takeout.mode) {
        tipoEntrega = pedido.takeout.mode === 'TAKEOUT' ? 'Pra Retirar' : 
                     (pedido.takeout.mode === 'CURBSIDE' ? 'Na Mesa' : pedido.takeout.mode);
    } else if (pedido.indoor) {
        tipoEntrega = 'No Local';
    }
    
    // Nome da loja
    const nomeLoja = 'NOME DO MERCHANT';
    
    // Informações do cliente
    const nomeCliente = pedido.customer?.name || 'NOME DO CLIENTE';
    const telefoneCliente = typeof pedido.customer?.phone === 'string' ? 
                          pedido.customer.phone : 
                          (pedido.customer?.phone?.number || '0000 000 0000');
    
    // Contador de pedidos do cliente (mock)
    const contadorPedidos = pedido.customer?.orderCount || Math.floor(Math.random() * 10) + 1;
    
    // Gera a parte de itens do pedido
    let itensHtml = '';
    
    if (pedido.items && Array.isArray(pedido.items)) {
        pedido.items.forEach((item, index) => {
            const precoItem = item.totalPrice || (item.price * item.quantity);
            
            // Início do item
            itensHtml += `
                <div class="item-pedido">
                    <div class="item-header">
                        ${item.quantity} UN
                        <span class="item-nome">${item.name}</span>
                        <span class="item-preco">${formatarValor(precoItem)}</span>
                    </div>
            `;
            
            // Adiciona opções (segundo nível)
            let opcoesHtml = '';
            let totalOpcoes = 0;
            
            if (item.options && item.options.length > 0) {
                item.options.forEach((opcao, idx) => {
                    opcoesHtml += `
                        <div class="item-opcao">
                            ${idx + 1} ${opcao.quantity}UN ${opcao.name}
                            <span class="opcao-preco">${formatarValor(opcao.price || opcao.addition || 0)}</span>
                        </div>
                    `;
                    
                    // Adiciona customizações (terceiro nível)
                    if (opcao.customizations && opcao.customizations.length > 0) {
                        opcao.customizations.forEach(customizacao => {
                            opcoesHtml += `
                                <div class="item-customizacao">
                                    ${customizacao.quantity}UN ${customizacao.name}
                                    <span class="customizacao-preco">${formatarValor(customizacao.price || customizacao.addition || 0)}</span>
                                </div>
                            `;
                            totalOpcoes += (customizacao.price || customizacao.addition || 0) * customizacao.quantity;
                        });
                    }
                    
                    totalOpcoes += (opcao.price || opcao.addition || 0) * opcao.quantity;
                });
            }
            
            // Adiciona observações do item
            if (item.observations) {
                opcoesHtml += `
                    <div class="item-observacao">
                        Obs: ${item.observations}
                    </div>
                `;
            }
            
            // Adiciona total do item com opções
            const totalItemComOpcoes = precoItem + totalOpcoes;
            
            itensHtml += `
                    ${opcoesHtml}
                    <div class="item-total">
                        Total do item ${formatarValor(totalItemComOpcoes)}
                    </div>
                </div>
                <div class="separador"></div>
            `;
        });
    } else {
        itensHtml = '<div class="sem-itens">Nenhum item no pedido</div>';
    }
    
    // Gera a parte de totais e pagamentos
    let totaisHtml = '';
    
    if (pedido.total) {
        const subTotal = pedido.total.subTotal || 0;
        const taxaEntrega = pedido.total.deliveryFee || 0;
        const taxaAdicional = pedido.total.additionalFees || 0;
        const desconto = pedido.total.benefits || 0;
        const totalPedido = pedido.total.orderAmount || (subTotal + taxaEntrega + taxaAdicional - desconto);
        
        totaisHtml = `
            <div class="totais-container">
                <div class="totais-header">TOTAL</div>
                <div class="totais-linha">
                    <span>Valor total dos itens</span>
                    <span>${formatarValor(subTotal)}</span>
                </div>
                <div class="totais-linha">
                    <span>Taxa de Entrega</span>
                    <span>${formatarValor(taxaEntrega)}</span>
                </div>
                ${taxaAdicional > 0 ? `
                <div class="totais-linha">
                    <span>Taxa Adicional</span>
                    <span>${formatarValor(taxaAdicional)}</span>
                </div>` : ''}
                ${desconto > 0 ? `
                <div class="totais-linha">
                    <span>Desconto (IFOOD / LOJA)</span>
                    <span>-${formatarValor(desconto)}</span>
                </div>` : ''}
                <div class="totais-linha total-final">
                    <span>VALOR TOTAL</span>
                    <span>${formatarValor(totalPedido)}</span>
                </div>
            </div>
        `;
        
        // Formas de pagamento
        let pagamentosHtml = '<div class="pagamentos-header">FORMAS DE PAGAMENTO</div>';
        
        if (pedido.payments && pedido.payments.methods && pedido.payments.methods.length > 0) {
            pedido.payments.methods.forEach(metodo => {
                let metodoTexto = metodo.method || '';
                
                // Tradução de métodos de pagamento
                if (metodoTexto.toLowerCase().includes('meal_voucher')) {
                    metodoTexto = 'Vale Refeição';
                } else if (metodoTexto.toLowerCase().includes('credit')) {
                    metodoTexto = 'Pagamento Online (CRÉDITO)';
                } else if (metodoTexto.toLowerCase().includes('debit')) {
                    metodoTexto = 'DÉBITO';
                }
                
                // Adiciona bandeira se disponível
                if (metodo.card && metodo.card.brand) {
                    metodoTexto += ` - ${metodo.card.brand}`;
                }
                
                pagamentosHtml += `
                    <div class="pagamento-linha">
                        <span>${metodoTexto}</span>
                        <span>${formatarValor(metodo.value || 0)}</span>
                    </div>
                `;
            });
            
            // Se houver valor a cobrar na entrega
            if (pedido.payments.pending && pedido.payments.pending > 0) {
                pagamentosHtml += `
                    <div class="pagamento-linha">
                        <span>Cobrar do cliente na entrega</span>
                        <span>${formatarValor(pedido.payments.pending)}</span>
                    </div>
                `;
            }
        } else {
            pagamentosHtml += `
                <div class="pagamento-linha">
                    <span>Informações de pagamento não disponíveis</span>
                </div>
            `;
        }
        
        totaisHtml += `<div class="pagamentos-container">${pagamentosHtml}</div>`;
    }
    
    // Informações fiscais
    const infosFiscais = `
        <div class="infos-fiscais">
            <div>Informações Adicionais</div>
            <div>Incluir CPF na nota fiscal:</div>
            <div>000.000.000-00</div>
        </div>
    `;
    
    // Informações de entrega
    let infoEntrega = '';
    
    if (pedido.orderType === 'DELIVERY' && pedido.delivery && pedido.delivery.deliveryAddress) {
        const endereco = pedido.delivery.deliveryAddress;
        
        infoEntrega = `
            <div class="entrega-container">
                <div class="entrega-header">ENTREGA PEDIDO #${pedido.displayId || pedido.id.substring(0, 6)}</div>
                <div class="entrega-linha">Entregue por: LOJA / PARCEIRO IFOOD</div>
                <div class="entrega-linha">Horário da entrega: ${dataEntrega.toLocaleString('pt-BR')}</div>
                <div class="entrega-cliente">CLIENTE: ${nomeCliente}</div>
                <div class="entrega-endereco">
                    <div>Endereço: ${endereco.streetName || ''}, ${endereco.streetNumber || ''}</div>
                    ${endereco.complement ? `<div>Compl: ${endereco.complement}</div>` : ''}
                    ${endereco.reference ? `<div>Ref: ${endereco.reference}</div>` : ''}
                    ${endereco.neighborhood ? `<div>Bairro: ${endereco.neighborhood}</div>` : ''}
                    <div>${endereco.city || ''} - ${endereco.state || ''}</div>
                    ${endereco.postalCode ? `<div>CEP: ${endereco.postalCode}</div>` : ''}
                </div>
            </div>
        `;
    } else if (pedido.takeout) {
        infoEntrega = `
            <div class="entrega-container">
                <div class="entrega-header">RETIRADA PEDIDO #${pedido.displayId || pedido.id.substring(0, 6)}</div>
                <div class="entrega-linha">Horário de retirada: ${dataEntrega.toLocaleString('pt-BR')}</div>
                <div class="entrega-cliente">CLIENTE: ${nomeCliente}</div>
                ${pedido.takeout.code ? `<div class="codigo-retirada">Código de retirada: ${pedido.takeout.code}</div>` : ''}
                ${pedido.takeout.retrieverName ? `<div class="entrega-linha">Quem retira: ${pedido.takeout.retrieverName}</div>` : ''}
            </div>
        `;
    }
    
    // Informações do aplicativo (rodapé)
    const rodape = `
        <div class="rodape">
            Impresso por:
            <div>Nome do Aplicativo (vX.X) - Desenvolvedor</div>
        </div>
    `;
    
    // Montar o HTML completo da comanda
    return `
        <div class="comanda-header">
            <div class="comanda-titulo">***** PEDIDO #${pedido.displayId || pedido.id.substring(0, 6)} *****</div>
            <div class="comanda-tipo">${tipoEntrega}</div>
            <div class="comanda-loja">${nomeLoja}</div>
            <div class="comanda-datas">
                <div>Data do Pedido: ${dataPedido.toLocaleString('pt-BR')}</div>
                <div>Data de Entrega: ${dataEntrega.toLocaleString('pt-BR')}</div>
            </div>
            <div class="comanda-cliente">
                <div>Cliente: ${nomeCliente}</div>
                <div>Telefone: ${telefoneCliente}</div>
                <div>${contadorPedidos} pedidos na sua loja</div>
            </div>
        </div>
        
        <div class="comanda-itens-header">ITENS DO PEDIDO</div>
        
        <div class="comanda-itens">
            ${itensHtml}
        </div>
        
        ${totaisHtml}
        
        ${infosFiscais}
        
        ${infoEntrega}
        
        ${rodape}
    `;
}

// Estilos CSS para a comanda
function estilosComanda() {
    return `
        @media print {
            @page {
                size: 80mm auto;
                margin: 0;
            }
            
            body {
                width: 80mm;
                margin: 0;
                padding: 0;
            }
        }
        
        body {
            font-family: monospace;
            font-size: 12px;
            line-height: 1.2;
            background-color: #fffae0;
            color: #000;
            margin: 0;
            padding: 0;
        }
        
        .comanda-container {
            width: 80mm;
            padding: 5px;
            background-color: #fffae0;
        }
        
        .comanda-header {
            text-align: center;
            margin-bottom: 10px;
        }
        
        .comanda-titulo {
            font-size: 14px;
            font-weight: bold;
        }
        
        .comanda-tipo {
            font-size: 13px;
        }
        
        .comanda-loja {
            font-weight: bold;
            margin: 5px 0;
        }
        
        .comanda-datas, .comanda-cliente {
            text-align: left;
            margin: 5px 0;
        }
        
        .comanda-itens-header {
            text-align: center;
            font-weight: bold;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 3px 0;
            margin: 5px 0;
        }
        
        .comanda-itens {
            margin-bottom: 10px;
        }
        
        .item-pedido {
            margin: 5px 0;
        }
        
        .item-header {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
        }
        
        .item-nome {
            flex-grow: 1;
            margin: 0 5px;
        }
        
        .item-opcao, .item-customizacao {
            margin-left: 15px;
            display: flex;
            justify-content: space-between;
        }
        
        .item-customizacao {
            margin-left: 30px;
            font-style: italic;
        }
        
        .item-observacao {
            margin-left: 15px;
            font-style: italic;
            margin-top: 3px;
        }
        
        .item-total {
            text-align: right;
            font-weight: bold;
            margin-top: 3px;
        }
        
        .separador {
            border-bottom: 1px dotted #000;
            margin: 5px 0;
        }
        
        .totais-container {
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 5px 0;
            margin: 10px 0;
        }
        
        .totais-header {
            text-align: center;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .totais-linha {
            display: flex;
            justify-content: space-between;
        }
        
        .total-final {
            font-weight: bold;
            border-top: 1px dotted #000;
            margin-top: 5px;
            padding-top: 3px;
        }
        
        .pagamentos-container {
            margin: 10px 0;
        }
        
        .pagamentos-header {
            text-align: center;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .pagamento-linha {
            display: flex;
            justify-content: space-between;
            border: 1px dotted #000;
            padding: 3px;
            margin-bottom: 5px;
        }
        
        .infos-fiscais {
            margin: 10px 0;
            text-align: center;
        }
        
        .entrega-container {
            margin: 10px 0;
            border-top: 1px dashed #000;
            padding-top: 5px;
        }
        
        .entrega-header {
            text-align: center;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .entrega-cliente {
            font-weight: bold;
            margin: 5px 0;
        }
        
        .entrega-endereco {
            margin: 5px 0;
        }
        
        .codigo-retirada {
            font-weight: bold;
            margin: 5px 0;
            font-size: 14px;
        }
        
        .rodape {
            margin-top: 15px;
            text-align: center;
            border-top: 1px dashed #000;
            padding-top: 5px;
        }
    `;
}

// Registra evento para botão de impressão
document.addEventListener('DOMContentLoaded', function() {
    console.log('🖨️ Inicializando módulo de impressão...');
});

// Exporta função para uso global
window.imprimirComanda = imprimirComanda;
