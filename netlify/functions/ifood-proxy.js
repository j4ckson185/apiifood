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
    
    // Configuração padrão para todas as requisições
    const headers = {
      'Accept': 'application/json'
    };

    let requestBody;
    
    // Tratamento especial para autenticação
    if (path.includes('/oauth/token')) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const params = new URLSearchParams();
      params.append('grant_type', body.grant_type);
      params.append('client_id', body.client_id);
      params.append('client_secret', body.client_secret);
      requestBody = params.toString();
    } else {
      headers['Content-Type'] = 'application/json';
      if (event.headers.authorization) {
        headers['Authorization'] = event.headers.authorization;
      }
      requestBody = body ? JSON.stringify(body) : undefined;
    }

    console.log('Request URL:', `${baseURL}${path}`);
    console.log('Request Headers:', headers);
    console.log('Request Body:', requestBody);

    const fetchResponse = await fetch(`${baseURL}${path}`, {
      method: method,
      headers: headers,
      body: requestBody
    });

    const responseData = await fetchResponse.json();

    console.log('Response Status:', fetchResponse.status);
    console.log('Response Data:', responseData);

    return {
      statusCode: fetchResponse.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(responseData)
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
        error: error.message,
        details: error.stack
      })
    };
  }
};
