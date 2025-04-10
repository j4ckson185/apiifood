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

    const { path, method, body, isAuth } = JSON.parse(event.body);
    const baseURL = 'https://merchant-api.ifood.com.br';
    
    const headers = {};
    
    // Define headers baseado no tipo de requisição
    if (isAuth) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      // Transforma o body em URLSearchParams se for autenticação
      const formBody = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: body.client_id,
        client_secret: body.client_secret
      }).toString();
      
      const authResponse = await fetch(`${baseURL}${path}`, {
        method: method,
        headers: headers,
        body: formBody
      });

      const data = await authResponse.json();
      
      return {
        statusCode: authResponse.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      };
    }

    // Para outras requisições
    headers['Content-Type'] = 'application/json';
    if (event.headers.authorization) {
      headers['Authorization'] = event.headers.authorization;
    }

    const options = {
      method: method,
      headers: headers
    };

    if (body && !isAuth) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${baseURL}${path}`, options);
    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Erro na função do Netlify:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
