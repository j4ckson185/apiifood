const axios = require('axios');

exports.handler = async (event) => {
  try {
    const { path, method, body } = JSON.parse(event.body);
    
    // Configurações base para todas as requisições
    const baseURL = 'https://merchant-api.ifood.com.br';
    const config = {
      method: method || 'GET',
      url: `${baseURL}${path}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Se houver body na requisição, adiciona ao config
    if (body) {
      config.data = body;
    }

    // Se houver token na requisição, adiciona ao header
    if (event.headers.authorization) {
      config.headers.Authorization = event.headers.authorization;
    }

    const response = await axios(config);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    console.error('Erro na função do Netlify:', error);
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({
        error: error.message,
        details: error.response?.data
      }),
    };
  }
};
