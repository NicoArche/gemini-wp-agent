const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// 3. Función principal para procesar el texto con contexto del sitio
async function getWpCommand(userInput, siteContext = {}, userApiKey = null) {
  try {
    console.log("🧠 Procesando con Gemini AI real:", userInput);
    console.log("🔍 Contexto del sitio:", siteContext);
    
    // Usar API Key personalizada si se proporciona, sino usar la del servidor
    const apiKeyToUse = userApiKey || process.env.GEMINI_API_KEY;
    const apiKeySource = userApiKey ? 'usuario' : 'servidor';
    console.log(`🔑 Usando API Key de: ${apiKeySource}`);
    
    // Crear instancia de Gemini con la API Key apropiada
    const genAIInstance = new GoogleGenerativeAI(apiKeyToUse);
    const modelInstance = genAIInstance.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      systemInstruction: `Eres Gemini WP-Agent, un experto en WordPress DevOps y seguridad. Tu misión es diagnosticar problemas y gestionar sitios WordPress mediante comandos WP-CLI.

CONTEXTO DEL SITIO: Siempre recibirás información sobre el sitio (Versión de WP, PHP y si WP-CLI real está disponible). Si WP-CLI no está disponible, prioriza comandos que sepas que están emulados (plugin, post, user, theme, core, db size).

REGLAS DE ORO:
- Responde únicamente en formato JSON válido.
- Si el usuario plantea un problema (ej: 'mi sitio está lento'), no te limites a traducir; razona la solución (ej: listar plugins activos o ver tamaño de BD).
- Clasifica la seguridad: is_safe: true para consultas o cambios menores; is_safe: false para borrados, cambios masivos o comandos que requieran backup.
- La explicación debe ser profesional, breve y en español.

FORMATO DE RESPUESTA JSON:
{
  "command": "wp ...",
  "explanation": "Explicación de por qué este comando resuelve el problema.",
  "is_safe": true/false,
  "agent_thought": "Breve nota interna de por qué elegiste este comando."
}`
    }, { apiVersion: 'v1beta' });
    
    // Construir el prompt con contexto del sitio
    const fullPrompt = `
CONTEXTO DEL SITIO:
- WordPress: ${siteContext.wordpress_version || 'Desconocido'}
- PHP: ${siteContext.php_version || 'Desconocido'}
- WP-CLI disponible: ${siteContext.wp_cli_available ? 'SÍ' : 'NO'}
- Método recomendado: ${siteContext.recommended_method || 'API nativa'}
- Servidor: ${siteContext.server_software || 'Desconocido'}

SOLICITUD DEL USUARIO: "${userInput}"

Analiza el problema y proporciona el comando WP-CLI más apropiado considerando las capacidades del servidor.

IMPORTANTE: Responde ÚNICAMENTE con un JSON válido en este formato exacto:
{
  "command": "wp comando aquí",
  "explanation": "Explicación profesional de por qué este comando resuelve el problema",
  "is_safe": true,
  "agent_thought": "Breve análisis interno de por qué elegiste este comando"
}

NO incluyas texto adicional fuera del JSON.`;

    const result = await modelInstance.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();
    
    console.log("🤖 Respuesta cruda de Gemini:", text);
    
    // Intentar parsear el JSON
    try {
      // Limpiar la respuesta para extraer solo el JSON
      let cleanText = text.trim();
      
      // Remover markdown si existe
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Buscar el JSON en la respuesta
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        console.log("✅ JSON parseado exitosamente:", parsedResponse);
        
        // Validar estructura mínima
        if (!parsedResponse.command || !parsedResponse.explanation) {
          throw new Error("Respuesta incompleta de Gemini");
        }
        
        // Asegurar que is_safe existe
        if (typeof parsedResponse.is_safe !== 'boolean') {
          parsedResponse.is_safe = true; // Por defecto seguro
        }
        
        // Asegurar que agent_thought existe
        if (!parsedResponse.agent_thought) {
          parsedResponse.agent_thought = "Análisis automático basado en el contexto del sitio";
        }
        
        return parsedResponse;
      } else {
        throw new Error("No se encontró JSON válido en la respuesta");
      }
    } catch (parseError) {
      console.error("❌ Error parseando JSON:", parseError);
      console.log("📄 Respuesta original:", text);
      
      // Fallback: crear respuesta estructurada basada en el input
      return createFallbackResponse(userInput, siteContext);
    }
    
  } catch (error) {
    console.error("❌ Error con Gemini AI:", error);
    
    // Proporcionar información más detallada del error
    let errorMessage = error.message;
    if (error.message.includes('Quota exceeded') || error.message.includes('quota')) {
      errorMessage = userApiKey ? 
        "Tu API Key de Gemini ha alcanzado el límite de cuota. Usando sistema de emergencia..." :
        "Gemini está procesando muchas solicitudes, intentando modo de emergencia...";
    } else if (error.message.includes('API key')) {
      errorMessage = userApiKey ?
        "Tu API Key de Gemini no es válida. Verifica que sea correcta." :
        "Error de API key. Verifica que tu clave de Gemini sea válida.";
    } else if (error.message.includes('404')) {
      errorMessage = "Modelo temporalmente no disponible. Usando sistema de emergencia.";
    }
    
    // Sistema de emergencia mejorado
    return createFallbackResponse(userInput, siteContext, errorMessage);
  }
}

// Función de fallback inteligente
function createFallbackResponse(userInput, siteContext, errorMessage = null) {
  const lowerInput = userInput.toLowerCase();
  
  // Determinar si es un error de cuota (Gemini funciona pero está limitado)
  const isQuotaError = errorMessage && (
    errorMessage.includes('Gemini está procesando muchas solicitudes') ||
    errorMessage.includes('Tu API Key de Gemini ha alcanzado el límite')
  );
  const quotaNote = isQuotaError ? 
    (errorMessage.includes('Tu API Key') ? " (Tu API Key ha alcanzado el límite)" : " (Gemini está procesando muchas solicitudes)") : 
    " (Sistema de emergencia activo)";
  
  // Análisis básico del problema
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