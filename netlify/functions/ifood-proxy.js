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
    const { path, method, body, headers = {}, isAuth } = JSON.parse(event.body);
    const baseURL = 'https://merchant-api.ifood.com.br';

    // Usa os headers enviados pela requisição
    const requestHeaders = { ...headers };

    // Adiciona Authorization se existir
    if (event.headers.authorization) {
      requestHeaders.Authorization = event.headers.authorization;
    }

    console.log('Requisição para:', `${baseURL}${path}`);
    console.log('Headers:', requestHeaders);
    console.log('Body:', body);

    const fetchOptions = {
      method,
      headers: requestHeaders
    };

    // Adiciona body se existir
    if (body) {
      if (isAuth) {
        // Para autenticação, envia o body direto como string
        fetchOptions.body = body;
      } else {
        // Para outras requisições, converte para JSON
        fetchOptions.body = JSON.stringify(body);
      }
    }

    const response = await fetch(`${baseURL}${path}`, fetchOptions);
    const data = await response.json();

    console.log('Status da resposta:', response.status);
    console.log('Dados da resposta:', data);

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
