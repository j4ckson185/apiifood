// netlify/functions/ifood-webhook-events.js
// Array para armazenar eventos temporariamente
const eventosRecebidos = [];
const MAX_EVENTOS = 100; 

exports.handler = async (event) => {
  console.log('Função de eventos de webhook acionada:', event.httpMethod);
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Endpoint para adicionar eventos recebidos do webhook principal
  if (event.httpMethod === 'POST') {
    try {
      const payload = JSON.parse(event.body);
      console.log('Evento a ser armazenado:', payload);
      
      if (payload && payload.evento) {
        // Adiciona o evento à lista
        eventosRecebidos.unshift(payload.evento);
        
        // Limita o tamanho da lista
        if (eventosRecebidos.length > MAX_EVENTOS) {
          eventosRecebidos.length = MAX_EVENTOS;
        }
        
        console.log(`Total de eventos armazenados: ${eventosRecebidos.length}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        };
      }
      
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Payload inválido' })
      };
    } catch (error) {
      console.error('Erro ao adicionar evento:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Erro interno' })
      };
    }
  }

  // Endpoint para o frontend buscar eventos pendentes
  if (event.httpMethod === 'GET') {
    console.log(`Retornando ${eventosRecebidos.length} eventos armazenados`);
    
    // Retorna os eventos e limpa a lista
    const eventos = [...eventosRecebidos];
    eventosRecebidos.length = 0;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ eventos })
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ success: false, error: 'Método não permitido' })
  };
};
