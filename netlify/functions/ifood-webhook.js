// netlify/functions/ifood-webhook.js
const crypto = require('crypto');

// Função auxiliar para validar a assinatura
function validarAssinatura(payload, assinatura, clientSecret) {
  try {
    // Gera um HMAC SHA-256 com o clientSecret
    const hmac = crypto.createHmac('sha256', clientSecret);
    hmac.update(payload);
    const assinaturaCalculada = hmac.digest('hex');
    
    console.log('Assinatura recebida:', assinatura);
    console.log('Assinatura calculada:', assinaturaCalculada);
    
    // Comparação direta para facilitar o debug
    return assinaturaCalculada === assinatura;
  } catch (error) {
    console.error('Erro ao validar assinatura:', error);
    return false;
  }
}

exports.handler = async (event) => {
  console.log('Webhook recebido:', event.httpMethod);
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Responde a requisições OPTIONS (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    console.log('Requisição OPTIONS recebida');
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Teste simples para verificar se o endpoint está funcionando
  if (event.httpMethod === 'GET') {
    console.log('Requisição GET recebida (teste)');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'Webhook endpoint operacional' })
    };
  }

  // Verifica se é uma requisição POST
  if (event.httpMethod !== 'POST') {
    console.log('Método não permitido:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido' })
    };
  }

  try {
    console.log('Processando requisição POST do webhook');
    
    // Configurações
    const clientSecret = '137o75y57ug8fm55ubfoxlwjpl0xm25jxj18ne5mser23mbprj5nfncvfnr82utnzx73ij4h449o298370rjwpycppazsfyh2s0l';
    
    // Obtém a assinatura do cabeçalho (tenta múltiplos formatos possíveis)
    const assinatura = event.headers['x-signature'] || event.headers['X-Signature'] || event.headers['x-ifood-signature'] || event.headers['X-Ifood-Signature'];
    console.log('Headers recebidos:', JSON.stringify(event.headers));
    
    // Para teste inicial, vamos aceitar qualquer requisição
    if (!assinatura) {
      console.log('Assinatura ausente, mas aceitando para teste');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Webhook recebido (modo teste sem assinatura)'
        })
      };
    }
    
    // Validação da assinatura
    const payloadRaw = event.body;
    console.log('Payload recebido:', payloadRaw);
    
    const assinaturaValida = validarAssinatura(payloadRaw, assinatura, clientSecret);
    console.log('Assinatura válida:', assinaturaValida);
    
    // TEMPORARIAMENTE aceitar mesmo com assinatura inválida para testes
    if (!assinaturaValida) {
      console.log('Assinatura inválida, mas aceitando para teste');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Webhook recebido (teste - ignorando assinatura inválida)'
        })
      };
    }
    
    // Processa o payload
    const payload = JSON.parse(payloadRaw);
    console.log('Evento recebido via webhook:', payload);
    
    // Responde com sucesso
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Evento recebido com sucesso'
      })
    };
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    
    // Sempre retorne 200 para evitar reenvios, mesmo em caso de erro
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Erro interno no processamento',
        message: 'Evento recebido, mas houve erro no processamento interno'
      })
    };
  }
};
