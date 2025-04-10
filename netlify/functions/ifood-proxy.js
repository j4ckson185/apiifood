exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Tratamento de preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { path, method, body, isAuth } = JSON.parse(event.body);
    const baseURL = 'https://merchant-api.ifood.com.br';

    const requestHeaders = {};

    // Configurar headers específicos para autenticação
    if (isAuth) {
      requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    } else {
      requestHeaders['Content-Type'] = 'application/json';
      if (event.headers.authorization) {
        requestHeaders['Authorization'] = event.headers.authorization;
      }
    }

    const fetchOptions = {
      method: method,
      headers: requestHeaders
    };

    // Adicionar body se necessário
    if (body) {
      fetchOptions.body = isAuth ? body : JSON.stringify(body);
    }

    const response = await fetch(`${baseURL}${path}`, fetchOptions);
    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Erro:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
