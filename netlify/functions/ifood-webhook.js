// netlify/functions/ifood-webhook.js
const crypto = require('crypto');

// Função auxiliar para validar a assinatura
function validarAssinatura(payload, assinatura, clientSecret) {
  try {
    // Gera um HMAC SHA-256 com o clientSecret
    const hmac = crypto.createHmac('sha256', clientSecret);
    hmac.update(payload);
    const assinaturaCalculada = hmac.digest('hex');
    
    console.log('[WEBHOOK] Assinatura recebida:', assinatura);
    console.log('[WEBHOOK] Assinatura calculada:', assinaturaCalculada);
    
    // Comparação direta para facilitar o debug
    return assinaturaCalculada === assinatura;
  } catch (error) {
    console.error('[WEBHOOK] Erro ao validar assinatura:', error);
    return false;
  }
}

exports.handler = async (event) => {
  // Adicionando logs detalhados logo no início para diagnóstico
  const timestamp = new Date().toISOString();
  console.log(`[WEBHOOK][${timestamp}] VERIFICAÇÃO DE INVOCAÇÃO`);
  console.log('[WEBHOOK] Método HTTP:', event.httpMethod);
  console.log('[WEBHOOK] Cabeçalhos completos:', JSON.stringify(event.headers));
  console.log('[WEBHOOK] Corpo da requisição:', event.body ? 'Presente' : 'Ausente');
  console.log('[WEBHOOK] Tamanho do corpo:', event.body ? event.body.length : 0);
  
  const timestamp = new Date().toISOString();
  console.log(`[WEBHOOK][${timestamp}] Requisição recebida: ${event.httpMethod}`);
  console.log('[WEBHOOK] Headers completos:', JSON.stringify(event.headers));
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Signature, X-Ifood-Signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  };

  // Responde a requisições OPTIONS (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    console.log('[WEBHOOK] Requisição OPTIONS processada');
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Teste simples para verificar se o endpoint está funcionando
  if (event.httpMethod === 'GET') {
    console.log('[WEBHOOK] Teste GET processado com sucesso');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        status: 'Webhook endpoint operacional',
        timestamp: timestamp,
        message: 'Endpoint de webhook disponível e respondendo corretamente'
      })
    };
  }

  // Verifica se é uma requisição POST
  if (event.httpMethod !== 'POST') {
    console.log(`[WEBHOOK] Método não permitido: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido' })
    };
  }

  try {
    console.log('[WEBHOOK] Iniciando processamento de requisição POST');
    
    // Configurações
    const clientSecret = '137o75y57ug8fm55ubfoxlwjpl0xm25jxj18ne5mser23mbprj5nfncvfnr82utnzx73ij4h449o298370rjwpycppazsfyh2s0l';
    
    // Obtém a assinatura do cabeçalho (tenta múltiplos formatos possíveis)
    const assinatura = 
      event.headers['x-signature'] || 
      event.headers['X-Signature'] || 
      event.headers['x-ifood-signature'] || 
      event.headers['X-Ifood-Signature'];
    
    console.log('[WEBHOOK] Assinatura encontrada:', assinatura ? 'Sim' : 'Não');
    
    // Exibe os 10 primeiros caracteres da assinatura se existir (por segurança)
    if (assinatura) {
      console.log('[WEBHOOK] Primeiros caracteres da assinatura:', assinatura.substring(0, 10) + '...');
    }
    
    // Para teste inicial, vamos aceitar qualquer requisição
    if (!assinatura) {
      console.log('[WEBHOOK] AVISO: Assinatura ausente, mas aceitando para teste');
      
      // Tenta processar o payload mesmo sem assinatura
      const payloadRaw = event.body;
      console.log('[WEBHOOK] Body recebido (primeiros 200 caracteres):', 
        payloadRaw ? (payloadRaw.substring(0, 200) + '...') : 'Vazio');
      
      try {
        // Tenta analisar o payload como JSON se existir
        if (payloadRaw) {
          const payload = JSON.parse(payloadRaw);
          console.log('[WEBHOOK] Evento recebido sem assinatura:', JSON.stringify(payload));
          
          // Extrai informações principais para log
          if (payload.id) {
            console.log(`[WEBHOOK] Detalhes do evento: ID=${payload.id}, Code=${payload.code}, OrderId=${payload.orderId}`);
          }
        }
      } catch (parseError) {
        console.error('[WEBHOOK] Erro ao analisar payload:', parseError);
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Webhook recebido (modo teste sem assinatura)',
          timestamp: timestamp
        })
      };
    }
    
    // Validação da assinatura
    const payloadRaw = event.body;
    console.log('[WEBHOOK] Body recebido (primeiros 200 caracteres):', 
      payloadRaw ? (payloadRaw.substring(0, 200) + '...') : 'Vazio');
    
    const assinaturaValida = validarAssinatura(payloadRaw, assinatura, clientSecret);
    console.log('[WEBHOOK] Assinatura válida:', assinaturaValida);
    
    // TEMPORARIAMENTE aceitar mesmo com assinatura inválida para testes
    if (!assinaturaValida) {
      console.log('[WEBHOOK] AVISO: Assinatura inválida, mas aceitando para teste');
      
      try {
        // Tenta analisar o payload como JSON se existir
        if (payloadRaw) {
          const payload = JSON.parse(payloadRaw);
          console.log('[WEBHOOK] Evento recebido com assinatura inválida:', JSON.stringify(payload));
          
          // Extrai informações principais para log
          if (payload.id) {
            console.log(`[WEBHOOK] Detalhes do evento: ID=${payload.id}, Code=${payload.code}, OrderId=${payload.orderId}`);
          }
          
          // Tenta encaminhar o evento para processamento (opcional)
          try {
            await fetch('/.netlify/functions/ifood-webhook-events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ evento: payload })
            });
            console.log('[WEBHOOK] Evento encaminhado para processamento');
          } catch (fetchError) {
            console.error('[WEBHOOK] Erro ao encaminhar evento:', fetchError);
          }
        }
      } catch (parseError) {
        console.error('[WEBHOOK] Erro ao analisar payload:', parseError);
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Webhook recebido (teste - ignorando assinatura inválida)',
          timestamp: timestamp
        })
      };
    }
    
    // Processa o payload
    let payload;
    try {
      payload = JSON.parse(payloadRaw);
      console.log('[WEBHOOK] Evento recebido e validado:', JSON.stringify(payload));
      
      // Extrai informações principais para log
      if (payload.id) {
        console.log(`[WEBHOOK] Detalhes do evento: ID=${payload.id}, Code=${payload.code}, OrderId=${payload.orderId}, MerchantId=${payload.merchantId}`);
      }
      
      // Encaminha o evento para processamento
      try {
        await fetch('/.netlify/functions/ifood-webhook-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evento: payload })
        });
        console.log('[WEBHOOK] Evento encaminhado para processamento');
      } catch (fetchError) {
        console.error('[WEBHOOK] Erro ao encaminhar evento:', fetchError);
      }
    } catch (parseError) {
      console.error('[WEBHOOK] Erro ao analisar payload:', parseError);
      payload = null;
    }
    
    // Responde com sucesso
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Evento recebido com sucesso',
        eventId: payload?.id || 'desconhecido',
        timestamp: timestamp
      })
    };
  } catch (error) {
    console.error('[WEBHOOK] Erro ao processar webhook:', error);
    
    // Sempre retorne 200 para evitar reenvios, mesmo em caso de erro
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Erro interno no processamento',
        message: 'Evento recebido, mas houve erro no processamento interno',
        timestamp: timestamp
      })
    };
  }
};
