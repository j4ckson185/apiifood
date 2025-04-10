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
    
    const fetchOptions = {
      method,
      headers: requestHeaders
    };

    // MODIFICADO: Tratamento especial para o endpoint de acknowledgment
    if (body) {
      if (isAuth) {
        fetchOptions.body = body;
      } else if (path === '/events/v1.0/events/acknowledgment') {
        // Para o endpoint de acknowledgment, garantir formato exato
        console.log('⚠️ Detectado endpoint de acknowledgment, aplicando formato especial');
        
        let eventsArray;
        // Se o body já for um objeto com a propriedade events
        if (typeof body === 'object' && body.events) {
          eventsArray = body.events;
        } else if (typeof body === 'string') {
          // Se body for uma string, tentar parsear
          try {
            const parsed = JSON.parse(body);
            eventsArray = parsed.events || [];
          } catch (e) {
            console.error('Erro ao parsear body como JSON:', e);
            eventsArray = [];
          }
        } else {
          eventsArray = [];
        }
        
        // Garantir que os IDs são strings válidas
        eventsArray = eventsArray.filter(id => id && typeof id === 'string');
        
        const acknowledgmentPayload = {
          events: eventsArray
        };
        
        console.log('🔄 Payload final de acknowledgment:', acknowledgmentPayload);
        fetchOptions.body = JSON.stringify(acknowledgmentPayload);
      } else {
        // Comportamento padrão para outros endpoints
        try {
          const parsedObject = typeof body === 'string' ? JSON.parse(body) : body;
          fetchOptions.body = JSON.stringify(parsedObject);
          console.log('✅ Objeto enviado para o iFood:', parsedObject);
        } catch (e) {
          console.error('❌ Erro ao processar body:', e);
          fetchOptions.body = JSON.stringify(body);
        }
      }
      
      console.log('✅ Corpo final serializado:', fetchOptions.body);
    }

    console.log('🚀 Enviando requisição final para:', `${baseURL}${path}`);
    console.log('📦 Com opções:', fetchOptions);
    
    const response = await fetch(`${baseURL}${path}`, fetchOptions);
    console.log('📥 Status da resposta:', response.status);
    
    let responseData;
    try {
      const responseText = await response.text();
      console.log('📝 Resposta bruta:', responseText);
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.error('❌ Erro ao processar resposta:', e);
      responseData = { error: 'Erro ao processar resposta' };
    }

    console.log('📊 Dados da resposta processados:', responseData);

    return {
      statusCode: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('❌❌ Erro geral:', error);
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
