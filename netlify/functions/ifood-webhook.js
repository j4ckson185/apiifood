// netlify/functions/ifood-webhook.js

exports.handler = async (event) => {
  console.log('[WEBHOOK] Temporariamente desabilitado – ignorando qualquer payload.');
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
