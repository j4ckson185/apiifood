// netlify/functions/ifood-webhook-events.js
// Array para armazenar eventos temporariamente
const eventosRecebidos = [];
const MAX_EVENTOS = 100; 
const eventosProcessados = new Set(); // Para evitar duplicidade

exports.handler = async (event) => {
  const timestamp = new Date().toISOString();
  console.log(`[WEBHOOK-EVENTS][${timestamp}] Função acionada: ${event.httpMethod}`);
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    console.log('[WEBHOOK-EVENTS] Requisição OPTIONS processada');
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Endpoint para adicionar eventos recebidos do webhook principal
  if (event.httpMethod === 'POST') {
    try {
      console.log('[WEBHOOK-EVENTS] Processando requisição POST');
      const payload = JSON.parse(event.body);
      
      if (payload && payload.evento) {
        console.log('[WEBHOOK-EVENTS] Evento recebido para armazenamento:', JSON.stringify(payload.evento));
        
        // Verifica se o evento já foi processado (idempotência)
        if (eventosProcessados.has(payload.evento.id)) {
          console.log(`[WEBHOOK-EVENTS] Evento ${payload.evento.id} já foi processado anteriormente, ignorando`);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              success: true, 
              duplicate: true,
              message: 'Evento já processado' 
            })
          };
        }
        
        // Adiciona à lista de eventos processados
        eventosProcessados.add(payload.evento.id);
        
        // Adiciona o evento à lista com timestamp
        eventosRecebidos.unshift({
          ...payload.evento,
          recebidoEm: timestamp,
          origem: 'webhook'
        });
        
        // Limita o tamanho da lista
        if (eventosRecebidos.length > MAX_EVENTOS) {
          eventosRecebidos.length = MAX_EVENTOS;
        }
        
        console.log(`[WEBHOOK-EVENTS] Evento ${payload.evento.id} armazenado com sucesso. Total de eventos: ${eventosRecebidos.length}`);
        console.log(`[WEBHOOK-EVENTS] Detalhes: Code=${payload.evento.code}, OrderId=${payload.evento.orderId}`);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true,
            message: 'Evento armazenado com sucesso',
            timestamp: timestamp
          })
        };
      }
      
      console.log('[WEBHOOK-EVENTS] Payload inválido recebido:', JSON.stringify(payload));
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Payload inválido',
          timestamp: timestamp
        })
      };
    } catch (error) {
      console.error('[WEBHOOK-EVENTS] Erro ao adicionar evento:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Erro interno',
          timestamp: timestamp
        })
      };
    }
  }

  // Endpoint para o frontend buscar eventos pendentes
  if (event.httpMethod === 'GET') {
    console.log(`[WEBHOOK-EVENTS] GET - Retornando ${eventosRecebidos.length} eventos armazenados`);
    
    if (eventosRecebidos.length > 0) {
      console.log('[WEBHOOK-EVENTS] IDs dos eventos sendo retornados:', 
        eventosRecebidos.map(e => e.id).join(', '));
    }
    
    // Retorna os eventos e limpa a lista
    const eventos = [...eventosRecebidos];
    eventosRecebidos.length = 0;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        eventos,
        count: eventos.length,
        timestamp: timestamp
      })
    };
  }

  console.log(`[WEBHOOK-EVENTS] Método não permitido: ${event.httpMethod}`);
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ 
      success: false, 
      error: 'Método não permitido',
      timestamp: timestamp
    })
  };
};
