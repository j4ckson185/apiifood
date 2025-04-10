exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers, 
      body: '' 
    };
  }

  try {
    const { path, method, body, additionalHeaders } = JSON.parse(event.body);
    const baseURL = 'https://merchant-api.ifood.com.br';

    const requestHeaders = {
      'Accept': 'application/json',
      ...additionalHeaders
    };

    // Configurar headers específicos para autenticação ou outras requisições
    if (isAuth) {
      requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    } else {
      requestHeaders['Content-Type'] = 'application/json';
      if (event.headers.authorization) {
        requestHeaders.Authorization = event.headers.authorization;
      }
    }

    const response = await fetch(`${baseURL}${path}`, {
      method: method,
      headers: requestHeaders,
      body: isAuth ? body : JSON.stringify(body)
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Erro:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
