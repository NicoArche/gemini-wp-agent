const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// 🔄 Función de retry con backoff exponencial para grado industrial
async function callGeminiWithRetry(modelInstance, fullPrompt, maxRetries = 2) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Intento ${attempt}/${maxRetries} de llamada a Gemini`);
      
      const result = await modelInstance.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();
      
      console.log("✅ Gemini respondió exitosamente en intento", attempt);
      return text;
      
    } catch (error) {
      lastError = error;
      console.log(`❌ Intento ${attempt} falló:`, error.message);
      
      // Verificar si es un error que vale la pena reintentar
      const isRetryableError = (
        error.message.includes('exhausted') ||
        error.message.includes('rate limit') ||
        error.message.includes('quota') ||
        error.message.includes('429') ||
        error.message.includes('503') ||
        error.message.includes('timeout') ||
        error.message.includes('network') ||
        error.message.includes('connection')
      );
      
      if (!isRetryableError || attempt === maxRetries) {
        console.log(`🚫 Error no reintentable o máximo de intentos alcanzado`);
        throw error;
      }
      
      // Backoff exponencial: 1s, 2s, 4s...
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      console.log(`⏳ Esperando ${delayMs}ms antes del siguiente intento...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}

// 3. Función principal para procesar el texto con contexto del sitio
async function getWpCommand(userInput, siteContext = {}, userApiKey = null, chatHistory = []) {
  try {
    console.log("🧠 Procesando con Gemini AI real:", userInput);
    console.log("🔍 Contexto del sitio:", siteContext);
    console.log("🧠 Historial de chat:", chatHistory.length, "mensajes");
    
    // Usar API Key personalizada si se proporciona, sino usar la del servidor
    const apiKeyToUse = userApiKey || process.env.GEMINI_API_KEY;
    const apiKeySource = userApiKey ? 'usuario' : 'servidor';
    console.log(`🔑 Usando API Key de: ${apiKeySource}`);
    
    // Verificar que tenemos API Key
    if (!apiKeyToUse) {
      console.error("❌ No hay API Key disponible");
      throw new Error("API Key de Gemini no configurada");
    }
    
    // Crear instancia de Gemini con la API Key apropiada
    const genAIInstance = new GoogleGenerativeAI(apiKeyToUse);
    const modelInstance = genAIInstance.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `Eres Gemini WP-Agent, un asistente conversacional experto en WordPress.

IMPORTANTE: Analiza cada mensaje y responde apropiadamente:

1. CONVERSACIÓN (responde con texto plano):
- Saludos: "Hola", "¿Cómo estás?"
- Preguntas generales: "¿Qué puedes hacer?"
- Código: "Dame CSS para el menú"
- Explicaciones: "¿Cómo funciona WordPress?"

2. COMANDOS WORDPRESS (responde con JSON):
- Acciones: "Lista los plugins", "Crea una página"
- Gestión: "Instala Yoast", "Actualiza WordPress"

Para CONVERSACIÓN: Responde solo con texto amigable.
Para COMANDOS: Responde con JSON: {"command": "wp ...", "explanation": "...", "is_safe": true}`
    }, { apiVersion: 'v1beta' });
    
    // Construir prompt simplificado
    let fullPrompt = `Usuario: "${userInput}"

Analiza si esto es:
- CONVERSACIÓN → Responde con texto plano amigable
- COMANDO WORDPRESS → Responde con JSON

Responde apropiadamente:`;

    // 🔄 Llamar a Gemini con retry logic
    const text = await callGeminiWithRetry(modelInstance, fullPrompt);
    
    console.log("🤖 Respuesta cruda de Gemini:", text);
    
    // Procesar respuesta
    try {
      let cleanText = text.trim();
      
      // Remover markdown
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Verificar si es conversacional (no contiene JSON)
      if (!cleanText.includes('{"command"') && !cleanText.includes('"command":')) {
        console.log("💬 Respuesta conversacional detectada");
        return {
          command: null,
          explanation: cleanText,
          is_safe: true,
          agent_thought: "Respuesta conversacional",
          is_conversational: true
        };
      }
      
      // Buscar JSON
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        console.log("✅ JSON parseado:", parsedResponse);
        
        // Validar estructura
        if (!parsedResponse.explanation) {
          throw new Error("Respuesta incompleta");
        }
        
        // Completar campos faltantes
        if (!parsedResponse.agent_thought) {
          parsedResponse.agent_thought = "Comando generado por Gemini AI";
        }
        if (typeof parsedResponse.is_safe !== 'boolean') {
          parsedResponse.is_safe = true;
        }
        
        return parsedResponse;
      } else {
        // Tratar como conversacional
        console.log("💬 Sin JSON válido, tratando como conversacional");
        return {
          command: null,
          explanation: cleanText,
          is_safe: true,
          agent_thought: "Respuesta conversacional",
          is_conversational: true
        };
      }
    } catch (parseError) {
      console.error("❌ Error parseando respuesta:", parseError);
      console.log("📄 Respuesta original:", text);
      
      // Si hay contenido útil, tratarlo como conversacional
      if (text && text.trim().length > 0) {
        console.log("💬 Error de parsing, tratando como conversacional");
        return {
          command: null,
          explanation: text.trim(),
          is_safe: true,
          agent_thought: "Respuesta conversacional - error de parsing",
          is_conversational: true
        };
      }
      
      // Fallback final
      return createFallbackResponse(userInput, siteContext);
    }
    
  } catch (error) {
    console.error("❌ Error con Gemini AI:", error);
    console.error("📋 Stack trace:", error.stack);
    
    // Información detallada del error
    let errorMessage = error.message;
    if (error.message.includes('API key')) {
      errorMessage = "Error de API key. Verifica que tu clave de Gemini sea válida.";
    } else if (error.message.includes('quota') || error.message.includes('Quota')) {
      errorMessage = "Cuota de Gemini agotada. Usando sistema de emergencia.";
    } else if (error.message.includes('404')) {
      errorMessage = "Modelo no disponible. Usando sistema de emergencia.";
    }
    
    console.log("🚨 Llamando a createFallbackResponse con:", userInput);
    return createFallbackResponse(userInput, siteContext, errorMessage);
  }
}

// Función de fallback inteligente
function createFallbackResponse(userInput, siteContext, errorMessage = null) {
  const lowerInput = userInput.toLowerCase();
  
  console.log("🔍 DEBUG createFallbackResponse:");
  console.log("  - userInput:", userInput);
  console.log("  - lowerInput:", lowerInput);
  console.log("  - errorMessage:", errorMessage);
  
  // Determinar si es un error de cuota (Gemini funciona pero está limitado)
  const isQuotaError = errorMessage && (
    errorMessage.includes('Gemini está procesando muchas solicitudes') ||
    errorMessage.includes('Tu API Key de Gemini ha alcanzado el límite')
  );
  const quotaNote = isQuotaError ? 
    (errorMessage.includes('Tu API Key') ? " (Tu API Key ha alcanzado el límite)" : " (Gemini está procesando muchas solicitudes)") : 
    " (Sistema de emergencia activo)";
  
  // 💬 DETECCIÓN DE CONVERSACIÓN (Sistema de emergencia)
  if (lowerInput.includes('hola') || lowerInput.includes('buenos días') || lowerInput.includes('buenas tardes') || lowerInput.includes('buenas noches')) {
    return {
      command: null,
      explanation: `¡Hola! Soy Gemini WP-Agent, tu asistente especializado en WordPress. Puedo ayudarte a gestionar tu sitio, crear contenido, generar código CSS/JavaScript, y responder cualquier pregunta sobre WordPress${quotaNote}. ¿En qué puedo ayudarte hoy?`,
      is_safe: true,
      agent_thought: "Saludo detectado - respuesta conversacional",
      is_conversational: true
    };
  }
  
  if (lowerInput.includes('¿cómo estás') || lowerInput.includes('como estas') || lowerInput.includes('qué tal')) {
    return {
      command: null,
      explanation: `¡Muy bien, gracias por preguntar! Estoy funcionando perfectamente y listo para ayudarte con tu sitio WordPress. Puedo ejecutar comandos, crear contenido, generar código personalizado, o simplemente conversar sobre desarrollo web${quotaNote}. ¿Qué necesitas?`,
      is_safe: true,
      agent_thought: "Pregunta sobre estado - respuesta conversacional",
      is_conversational: true
    };
  }
  
  if (lowerInput.includes('qué puedes hacer') || lowerInput.includes('que puedes hacer') || lowerInput.includes('ayuda') || lowerInput.includes('help')) {
    return {
      command: null,
      explanation: `¡Tengo muchas capacidades! Puedo:

🔧 **Gestionar WordPress**: Instalar/actualizar plugins y temas, crear usuarios, gestionar contenido
🎨 **Crear código**: CSS personalizado, JavaScript, PHP, HTML según tus necesidades  
📝 **Generar contenido**: Páginas y posts con bloques de Gutenberg
🗄️ **Optimizar**: Limpiar base de datos, gestionar cache, mejorar rendimiento
💬 **Conversar**: Explicar conceptos, dar consejos, resolver dudas técnicas

Ejemplos de lo que puedes pedirme:
- "Lista todos los plugins"
- "Dame CSS para cambiar el color del menú"
- "Crea una página de contacto"
- "¿Cómo optimizar WordPress?"
- "Explícame qué son los hooks"

${quotaNote}. ¿Qué te gustaría hacer?`,
      is_safe: true,
      agent_thought: "Solicitud de capacidades - respuesta conversacional detallada",
      is_conversational: true
    };
  }
  
  if (lowerInput.includes('css') && (lowerInput.includes('código') || lowerInput.includes('codigo') || lowerInput.includes('dame') || lowerInput.includes('genera'))) {
    return {
      command: null,
      explanation: `¡Por supuesto! Puedo generar CSS personalizado para ti. Aquí tienes algunos ejemplos comunes:

**Cambiar color del menú:**
\`\`\`css
.main-navigation {
    background-color: #2c3e50;
}
.main-navigation a {
    color: #ffffff;
}
.main-navigation a:hover {
    color: #3498db;
}
\`\`\`

**Botón personalizado:**
\`\`\`css
.custom-button {
    background: linear-gradient(45deg, #3498db, #2980b9);
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: transform 0.2s;
}
.custom-button:hover {
    transform: translateY(-2px);
}
\`\`\`

${quotaNote}. ¿Qué estilo específico necesitas? Puedo crear CSS para cualquier elemento.`,
      is_safe: true,
      agent_thought: "Solicitud de código CSS - respuesta conversacional con ejemplos",
      is_conversational: true
    };
  }
  
  if (lowerInput.includes('javascript') && (lowerInput.includes('código') || lowerInput.includes('codigo') || lowerInput.includes('dame') || lowerInput.includes('genera'))) {
    return {
      command: null,
      explanation: `¡Perfecto! Puedo crear JavaScript para ti. Aquí algunos ejemplos útiles:

**Validación de formulario:**
\`\`\`javascript
function validateForm() {
    const email = document.getElementById('email').value;
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    
    if (!emailRegex.test(email)) {
        alert('Por favor ingresa un email válido');
        return false;
    }
    return true;
}
\`\`\`

**Smooth scroll:**
\`\`\`javascript
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});
\`\`\`

${quotaNote}. ¿Qué funcionalidad específica necesitas? Puedo crear JavaScript para cualquier propósito.`,
      is_safe: true,
      agent_thought: "Solicitud de código JavaScript - respuesta conversacional con ejemplos",
      is_conversational: true
    };
  }
  
  if (lowerInput.includes('gracias') || lowerInput.includes('perfecto') || lowerInput.includes('excelente') || lowerInput.includes('genial')) {
    return {
      command: null,
      explanation: `¡De nada! Me alegra poder ayudarte. Estoy aquí siempre que necesites gestionar tu WordPress, crear código personalizado, o resolver cualquier duda técnica${quotaNote}. ¡No dudes en preguntarme lo que necesites!`,
      is_safe: true,
      agent_thought: "Agradecimiento - respuesta conversacional positiva",
      is_conversational: true
    };
  }
  
  // 🎨 Capacidades de diseño de contenido (sistema de emergencia) - PRIORIDAD ALTA
  if (lowerInput.includes('crea') && (lowerInput.includes('página') || lowerInput.includes('pagina') || lowerInput.includes('post') || lowerInput.includes('entrada'))) {
    console.log("🎨 DEBUG: Detectada solicitud de creación de contenido");
    // Detectar si es una página de inicio específica
    if (lowerInput.includes('inicio') && lowerInput.includes('columnas') && lowerInput.includes('servicios')) {
      console.log("🎨 DEBUG: Detectada página de inicio con columnas y servicios");
      const blockContent = `<!-- wp:heading {"level":1} --><h1>¡Bienvenido a nuestro sitio!</h1><!-- /wp:heading --><!-- wp:paragraph --><p>Nos complace darte la bienvenida. Descubre nuestros servicios profesionales diseñados especialmente para ti.</p><!-- /wp:paragraph --><!-- wp:columns --><div class="wp-block-columns"><!-- wp:column --><div class="wp-block-column"><!-- wp:heading {"level":3} --><h3>Servicio Premium</h3><!-- /wp:heading --><!-- wp:paragraph --><p>Ofrecemos soluciones de alta calidad con atención personalizada y resultados garantizados.</p><!-- /wp:paragraph --><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link">Más información</a></div><!-- /wp:button --></div><!-- /wp:column --><!-- wp:column --><div class="wp-block-column"><!-- wp:heading {"level":3} --><h3>Soporte 24/7</h3><!-- /wp:heading --><!-- wp:paragraph --><p>Nuestro equipo está disponible las 24 horas para brindarte el mejor soporte técnico.</p><!-- /wp:paragraph --><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link">Contactar</a></div><!-- /wp:button --></div><!-- /wp:column --></div><!-- /wp:columns -->`;
      
      return {
        command: `wp post create --post_type=page --post_title="Inicio" --post_content='${blockContent}' --post_status=publish`,
        explanation: `Creando página de inicio con saludo y dos columnas de servicios usando bloques de WordPress (Gutenberg)${quotaNote}.`,
        is_safe: true,
        agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: creando página de inicio con diseño de bloques de WordPress"
      };
    } else if (lowerInput.includes('página') || lowerInput.includes('pagina')) {
      console.log("🎨 DEBUG: Detectada creación de página básica");
      const basicPageContent = `<!-- wp:heading {"level":1} --><h1>Nueva Página</h1><!-- /wp:heading --><!-- wp:paragraph --><p>Contenido de la página creado automáticamente. Puedes editarlo desde el panel de WordPress.</p><!-- /wp:paragraph -->`;
      
      return {
        command: `wp post create --post_type=page --post_title="Nueva Página" --post_content='${basicPageContent}' --post_status=draft`,
        explanation: `Creando nueva página con bloques de WordPress${quotaNote}.`,
        is_safe: true,
        agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: creando página básica con bloques"
      };
    } else {
      console.log("🎨 DEBUG: Detectada creación de post básico");
      const basicPostContent = `<!-- wp:heading {"level":2} --><h2>Nuevo Post</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Contenido del post creado automáticamente con bloques de WordPress.</p><!-- /wp:paragraph -->`;
      
      return {
        command: `wp post create --post_title="Nuevo Post" --post_content='${basicPostContent}' --post_status=draft`,
        explanation: `Creando nuevo post con bloques de WordPress${quotaNote}.`,
        is_safe: true,
        agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: creando post básico con bloques"
      };
    }
  }
  
  // 🔧 ANÁLISIS DE PROBLEMAS WORDPRESS
  if (lowerInput.includes('lento') || lowerInput.includes('slow') || lowerInput.includes('rendimiento')) {
    return {
      command: "wp plugin list --status=active",
      explanation: `Problema de rendimiento detectado. Los plugins activos son la causa más común de sitios lentos, por lo que empezamos revisándolos${quotaNote}.`,
      is_safe: true,
      agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: detecté problema de rendimiento, priorizo revisar plugins activos"
    };
  } else if (lowerInput.includes('error 500') || lowerInput.includes('error interno')) {
    return {
      command: "wp plugin list --status=active",
      explanation: `Error 500 detectado. Generalmente causado por plugins defectuosos, empezamos listando los plugins activos para identificar el problema${quotaNote}.`,
      is_safe: true,
      agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: error 500 típicamente indica problema de plugin"
    };
  } else if (lowerInput.includes('login') || lowerInput.includes('acceso') || lowerInput.includes('entrar')) {
    return {
      command: "wp user list --role=administrator",
      explanation: `Problema de acceso detectado. Verificamos los usuarios administradores para diagnosticar problemas de login${quotaNote}.`,
      is_safe: true,
      agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: problema de acceso, verifico usuarios admin"
    };
  } else if (lowerInput.includes('actualizar') && (lowerInput.includes('plugin') || lowerInput.includes('plugins'))) {
    if (lowerInput.includes('todos') || lowerInput.includes('all')) {
      return {
        command: "wp plugin update --all",
        explanation: `Actualizando todos los plugins que tengan actualizaciones disponibles${quotaNote}.`,
        is_safe: true,
        agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: actualización masiva de plugins"
      };
    } else {
      return {
        command: "wp plugin list",
        explanation: `Mostrando lista de plugins para que puedas elegir cuáles actualizar${quotaNote}.`,
        is_safe: true,
        agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: listado de plugins para actualización selectiva"
      };
    }
  } else if (lowerInput.includes('actualizar') && (lowerInput.includes('tema') || lowerInput.includes('temas') || lowerInput.includes('theme'))) {
    if (lowerInput.includes('todos') || lowerInput.includes('all')) {
      return {
        command: "wp theme update --all",
        explanation: `Actualizando todos los temas que tengan actualizaciones disponibles${quotaNote}.`,
        is_safe: true,
        agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: actualización masiva de temas"
      };
    } else {
      return {
        command: "wp theme list",
        explanation: `Mostrando lista de temas para que puedas elegir cuáles actualizar${quotaNote}.`,
        is_safe: true,
        agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: listado de temas para actualización selectiva"
      };
    }
  } else if (lowerInput.includes('plugin')) {
    return {
      command: "wp plugin list",
      explanation: `Solicitud relacionada con plugins. Listamos todos los plugins instalados con su estado y versión${quotaNote}.`,
      is_safe: true,
      agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: solicitud de plugins, comando básico de listado"
    };
  } else if (lowerInput.includes('usuario') || lowerInput.includes('user')) {
    return {
      command: "wp user list",
      explanation: `Solicitud relacionada con usuarios. Mostramos la lista de usuarios registrados en WordPress${quotaNote}.`,
      is_safe: true,
      agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: solicitud de usuarios, comando básico de listado"
    };
  } else {
    return {
      command: "wp --version",
      explanation: errorMessage ? 
        `${errorMessage} Mostrando información básica del sistema${quotaNote}.` :
        `No pude identificar el problema específico. Mostrando información del sistema para comenzar el diagnóstico${quotaNote}.`,
      is_safe: true,
      agent_thought: isQuotaError ? "Gemini AI disponible pero con límite de cuota alcanzado" : "Sistema de emergencia: comando genérico de diagnóstico"
    };
  }
}

module.exports = { getWpCommand };