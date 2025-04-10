exports.handler = async (event) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { path, method, body, isAuth } = JSON.parse(event.body);
    const baseURL = 'https://merchant-api.ifood.com.br';

    const requestHeaders = {
      'Content-Type': isAuth ? 'application/x-www-form-urlencoded' : 'application/json'
    };

    if (event.headers.authorization) {
      requestHeaders.Authorization = event.headers.authorization;
    }

    const response = await fetch(`${baseURL}${path}`, {
      method,
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
