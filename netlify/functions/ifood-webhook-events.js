// netlify/functions/ifood-webhook-events.js
// Array para armazenar eventos temporariamente
const eventosRecebidos = [];
const MAX_EVENTOS = 100; 
const eventosProcessados = new Set(); // Para evitar duplicidade

// netlify/functions/ifood-webhook-events.js

// netlify/functions/ifood-webhook-events.js

exports.handler = async (event) => {
  // Ignora totalmente qualquer chamada ao webhook
  console.log('[WEBHOOK-EVENTS] Desabilitado – ignorando payload e retornando lista vazia.');
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    // devolve sempre um array vazio de events
    body: JSON.stringify({ eventos: [] })
  };
};
