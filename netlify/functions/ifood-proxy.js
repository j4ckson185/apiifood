exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: ''
      };
    }

    const { path, method, body } = JSON.parse(event.body);
    
    // Configurações base para todas as requisições
    const baseURL = 'https://merchant-api.ifood.com.br';
    
    const options = {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    // Se houver body na requisição, adiciona ao config
    if (body) {
      if (path.includes('/oauth/token')) {
        options.body = body;  // Já está no formato correto de URL encoded
      } else {
        options.body = JSON.stringify(body);
      }
    }

    // Se houver token na requisição, adiciona ao header
    if (event.headers.authorization) {
      options.headers.Authorization = event.headers.authorization;
    }

    const response = await fetch(`${baseURL}${path}`, options);
    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Erro na função do Netlify:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
