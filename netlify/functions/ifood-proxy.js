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

    if (body) {
      if (isAuth) {
        fetchOptions.body = body;
      } 
      // Tratamento especial para o endpoint de acknowledgment
      else if (path === '/events/v1.0/events/acknowledgment') {
        console.log('⚠️ Detectado endpoint de acknowledgment, aplicando formato especial');
        
        let acknowledgmentPayload;
        
        // Se o body já for uma string e parecer um array JSON, usamos diretamente
        if (typeof body === 'string' && body.trim().startsWith('[')) {
          fetchOptions.body = body;
          console.log('✅ Usando body de acknowledgment como está (array serializado)');
        }
        // Se o body for um array de objetos com id, usamos diretamente
        else if (Array.isArray(body) && body.length > 0 && typeof body[0] === 'object' && body[0].id) {
          fetchOptions.body = JSON.stringify(body);
          console.log('✅ Usando array de objetos com id diretamente');
        }
        // Se o body for um array de strings, convertemos para o formato correto
        else if (Array.isArray(body) && body.length > 0 && typeof body[0] === 'string') {
          acknowledgmentPayload = body.map(id => ({ id }));
          fetchOptions.body = JSON.stringify(acknowledgmentPayload);
          console.log('✅ Convertendo array de strings para o formato correto');
        }
        // Se o body for um objeto com a propriedade events, convertemos para o formato correto
        else if (typeof body === 'object' && body.events) {
          acknowledgmentPayload = body.events.map(id => {
            return typeof id === 'string' ? { id } : { id: id.id };
          });
          fetchOptions.body = JSON.stringify(acknowledgmentPayload);
          console.log('✅ Convertendo objeto events para o formato correto');
        }
        // Se o body for uma string que possivelmente é um JSON, tentamos processar
        else if (typeof body === 'string') {
          try {
            const parsedBody = JSON.parse(body);
            
            if (Array.isArray(parsedBody)) {
              fetchOptions.body = body; // Já está no formato correto
              console.log('✅ Usando array JSON analisado');
            } 
            else if (parsedBody.events) {
              acknowledgmentPayload = parsedBody.events.map(id => {
                return typeof id === 'string' ? { id } : { id: id.id };
              });
              fetchOptions.body = JSON.stringify(acknowledgmentPayload);
              console.log('✅ Convertendo objeto JSON para o formato correto');
            }
            else {
              console.error('❌ Formato de acknowledgment não reconhecido após parse');
              fetchOptions.body = body;
            }
          } catch (e) {
            console.error('❌ Erro ao analisar body para acknowledgment:', e);
            fetchOptions.body = body;
          }
        }
        else {
          console.error('❌ Formato de acknowledgment não reconhecido');
          fetchOptions.body = JSON.stringify(body);
        }
        
        console.log('📦 Payload final de acknowledgment:', fetchOptions.body);
      }
      else {
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
