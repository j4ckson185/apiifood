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

  // 🔽 ADICIONE AQUI
console.log('🔍 event.body recebido bruto:', event.body);

  try {
    const { path, method, body, headers = {}, isAuth } = JSON.parse(event.body);
    console.log('📩 Body recebido pelo proxy:', body);
    const baseURL = 'https://merchant-api.ifood.com.br';

    // Usa os headers enviados pela requisição
const requestHeaders = {
  'Content-Type': headers['Content-Type'] || 'application/json',
  'Authorization': headers['Authorization'] || headers['authorization'],
  'x-polling-merchants': headers['x-polling-merchants']
};

    console.log('Requisição para:', `${baseURL}${path}`);
    console.log('📤 Enviando para iFood com headers:', requestHeaders);
    console.log('Body:', body);
    console.log('🔐 Authorization enviado para o iFood:', requestHeaders.Authorization);


    const fetchOptions = {
      method,
      headers: requestHeaders
    };

// Adiciona body se existir (já vem como string)
if (body) {
  const parsed = isAuth ? body : JSON.stringify(JSON.parse(body));
  fetchOptions.body = parsed;

  // ✅ Log que mostra o corpo final enviado pro iFood
  console.log('✅ Corpo final enviado:', parsed);
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
