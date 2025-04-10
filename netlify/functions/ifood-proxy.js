exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-polling-merchants',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers: corsHeaders, 
      body: '' 
    };
  }

  try {
    const { path, method, body, headers } = JSON.parse(event.body);
    const baseURL = 'https://merchant-api.ifood.com.br';

    console.log('Requisição para:', path);
    console.log('Headers recebidos:', headers);

    const response = await fetch(`${baseURL}${path}`, {
      method: method,
      headers: headers, // Usando os headers recebidos
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    console.log('Resposta:', data);

    return {
      statusCode: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: error.message,
        details: error.stack 
      })
    };
  }
};
