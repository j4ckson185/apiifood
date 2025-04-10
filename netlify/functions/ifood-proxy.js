exports.handler = async (event) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-polling-merchants',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { path, method, body, additionalHeaders, isAuth } = JSON.parse(event.body);
    const baseURL = 'https://merchant-api.ifood.com.br';

    // Configurar headers para a requisição
    const requestHeaders = {
      ...additionalHeaders
    };

    // Se for autenticação, ajusta o content-type
    if (isAuth) {
      requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    console.log('Fazendo requisição para:', `${baseURL}${path}`);
    console.log('Headers:', requestHeaders);
    console.log('Body:', body);

    const fetchOptions = {
      method,
      headers: requestHeaders
    };

    if (body) {
      fetchOptions.body = body;
    }

    const response = await fetch(`${baseURL}${path}`, fetchOptions);
    const responseData = await response.json();

    console.log('Status da resposta:', response.status);
    console.log('Dados da resposta:', responseData);

    return {
      statusCode: response.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('Erro detalhado:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        details: 'Erro ao processar requisição'
      })
    };
  }
};
