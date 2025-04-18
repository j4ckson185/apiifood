// netlify/functions/ifood-webhook.js
const crypto = require('crypto');

// Função auxiliar para validar a assinatura
function validarAssinatura(payload, assinatura, clientSecret) {
  try {
    // Gera um HMAC SHA-256 com o clientSecret
    const hmac = crypto.createHmac('sha256', clientSecret);
    hmac.update(payload);
    const assinaturaCalculada = hmac.digest('hex');
    
    // Compara a assinatura calculada com a recebida
    return crypto.timingSafeEqual(
      Buffer.from(assinaturaCalculada, 'hex'),
      Buffer.from(assinatura, 'hex')
    );
  } catch (error) {
    console.error('Erro ao validar assinatura:', error);
    return false;
  }
}

// Estado para tracking de eventos já processados
let eventosProcessados = new Set();

// Limpa eventos processados a cada 24 horas para evitar crescimento infinito
setInterval(() => {
  console.log('Limpando cache de eventos processados...');
  eventosProcessados = new Set();
}, 24 * 60 * 60 * 1000);

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Responde a requisições OPTIONS (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Verifica se é uma requisição POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido' })
    };
  }

  try {
    // Configurações
    const clientSecret = '137o75y57ug8fm55ubfoxlwjpl0xm25jxj18ne5mser23mbprj5nfncvfnr82utnzx73ij4h449o298370rjwpycppazsfyh2s0l';
    
    // Obtém a assinatura do cabeçalho
    const assinatura = event.headers['x-signature'] || event.headers['X-Signature'];
    
    if (!assinatura) {
      console.error('Assinatura ausente no cabeçalho');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Assinatura ausente' })
      };
    }
    
    // Valida a assinatura
    const payloadRaw = event.body;
    const assinaturaValida = validarAssinatura(payloadRaw, assinatura, clientSecret);
    
    if (!assinaturaValida) {
      console.error('Assinatura inválida');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Assinatura inválida' })
      };
    }
    
    // Processa o payload
    const payload = JSON.parse(payloadRaw);
    console.log('Evento recebido via webhook:', payload);
    
    // Verifica se o evento já foi processado (idempotência)
    if (eventosProcessados.has(payload.id)) {
      console.log(`Evento ${payload.id} já foi processado anteriormente`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Evento já processado' })
      };
    }
    
    // Armazena o evento em localStorage para sincronização com o frontend
    try {
      // Armazena o evento para ser processado pelo frontend
      const eventoParaProcessar = {
        ...payload,
        recebidoEm: new Date().toISOString(),
        origem: 'webhook'
      };
      
      // Armazena em uma lista de eventos pendentes
      // Nota: Como estamos em um ambiente serverless, precisamos armazenar
      // os eventos de forma que possam ser recuperados pelo frontend
      // Uma opção seria usar um banco de dados, mas para manter simples,
      // vamos usar um endpoint adicional para o frontend buscar os eventos
      
      // Adiciona à lista de eventos processados para evitar duplicidade
      eventosProcessados.add(payload.id);
      
      // Retorna o evento no response para ser processado pelo frontend
      // Em produção, seria melhor usar uma solução de armazenamento persistente
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          evento: eventoParaProcessar,
          message: 'Evento recebido com sucesso'
        })
      };
    } catch (storageError) {
      console.error('Erro ao armazenar evento:', storageError);
      // Mesmo com erro no armazenamento, confirmamos o recebimento
      // para evitar que o iFood reenvie o evento
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Evento recebido, mas houve erro no processamento interno'
        })
      };
    }
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
