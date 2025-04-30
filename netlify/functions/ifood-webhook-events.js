// netlify/functions/ifood-webhook-events.js
// Array para armazenar eventos temporariamente
const eventosRecebidos = [];
const MAX_EVENTOS = 100; 
const eventosProcessados = new Set(); // Para evitar duplicidade

// netlify/functions/ifood-webhook-events.js

exports.handler = async (event) => {
  console.log('[WEBHOOK-EVENTS] Webhook temporariamente desabilitado – ignorando payload.');
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: 'Webhook desabilitado, usando apenas polling'
    })
  };
};
