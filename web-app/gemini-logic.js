const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// 🔄 Retry function with exponential backoff for industrial grade
async function callGeminiWithRetry(modelInstance, fullPrompt, maxRetries = 2) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} calling Gemini`);
      
      const result = await modelInstance.generateContent(fullPrompt);
      
      console.log("✅ Gemini responded successfully on attempt", attempt);
      return result; // Return complete result, not just text
      
    } catch (error) {
      lastError = error;
      console.log(`❌ Attempt ${attempt} failed:`, error.message);
      
      // Check if it's an error worth retrying
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
        console.log(`🚫 Non-retryable error or maximum attempts reached`);
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s...
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      console.log(`⏳ Waiting ${delayMs}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}

// 🔄 WORKFLOW ENGINE: Function to get available workflows from WordPress site
async function discoverWordPressWorkflows(siteContext) {
  try {
    console.log("🔄 Discovering WordPress Workflows...");
    
    if (!siteContext.wordpressUrl || !siteContext.authToken) {
      console.log("⚠️ No site configuration for workflow discovery");
      return null;
    }
    
    const response = await fetch('/api/wp/workflows', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        wordpressUrl: siteContext.wordpressUrl,
        authToken: siteContext.authToken
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log("❌ Error in workflow discovery:", response.status, errorData.message);
      
      if (response.status === 404) {
        console.log("📝 Workflows not found, plugin not updated");
        return null;
      }
      
      return null;
    }
    
    const data = await response.json();
    
    if (data.status !== 'success' || !data.workflows) {
      console.log("❌ Invalid workflow discovery response:", data);
      return null;
    }
    
    console.log(`✅ Workflows discovered: ${data.workflows_count}`);
    
    return data.workflows;
    
  } catch (error) {
    console.error("❌ Error in workflow discovery:", error);
    return null;
  }
}

// 🔄 WORKFLOW ENGINE: Function to suggest workflows based on context
async function suggestWorkflowsForContext(siteContext, userInput, policyContext) {
  try {
    console.log("🔄 Suggesting workflows for context...");
    
    const availableWorkflows = await discoverWordPressWorkflows(siteContext);
    if (!availableWorkflows) {
      return null;
    }
    
    // Analyze user input and policy context to suggest workflows
    const suggestions = [];
    
    // Suggestions based on user input
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('seguridad') || lowerInput.includes('security') || lowerInput.includes('proteger')) {
      if (availableWorkflows['site_security_hardening']) {
        suggestions.push({
          workflow_id: 'site_security_hardening',
          workflow: availableWorkflows['site_security_hardening'],
          reason: 'User mentioned security',
          confidence: 'high',
          trigger_type: 'user_intent'
        });
      }
    }
    
    if (lowerInput.includes('lento') || lowerInput.includes('rendimiento') || lowerInput.includes('performance') || lowerInput.includes('optimizar')) {
      if (availableWorkflows['site_performance_optimization']) {
        suggestions.push({
          workflow_id: 'site_performance_optimization',
          workflow: availableWorkflows['site_performance_optimization'],
          reason: 'User mentioned performance issues',
          confidence: 'high',
          trigger_type: 'user_intent'
        });
      }
    }
    
    if (lowerInput.includes('mantenimiento') || lowerInput.includes('maintenance') || lowerInput.includes('rutina')) {
      if (availableWorkflows['site_maintenance_routine']) {
        suggestions.push({
          workflow_id: 'site_maintenance_routine',
          workflow: availableWorkflows['site_maintenance_routine'],
          reason: 'User mentioned maintenance',
          confidence: 'medium',
          trigger_type: 'user_intent'
        });
      }
    }
    
    // Suggestions based on activated policies
    if (policyContext && policyContext.policies_triggered > 0) {
      const policyCategories = policyContext.suggestions.map(s => s.category);
      
      if (policyCategories.includes('security') && availableWorkflows['site_security_hardening']) {
        suggestions.push({
          workflow_id: 'site_security_hardening',
          workflow: availableWorkflows['site_security_hardening'],
          reason: 'Security policies activated',
          confidence: 'high',
          trigger_type: 'policy_based',
          related_policies: policyContext.suggestions.filter(s => s.category === 'security')
        });
      }
      
      if (policyCategories.includes('performance') && availableWorkflows['site_performance_optimization']) {
        suggestions.push({
          workflow_id: 'site_performance_optimization',
          workflow: availableWorkflows['site_performance_optimization'],
          reason: 'Performance policies activated',
          confidence: 'high',
          trigger_type: 'policy_based',
          related_policies: policyContext.suggestions.filter(s => s.category === 'performance')
        });
      }
    }
    
    // Remove duplicates
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.workflow_id === suggestion.workflow_id)
    );
    
    console.log(`✅ Suggested workflows: ${uniqueSuggestions.length}`);
    
    return uniqueSuggestions.length > 0 ? uniqueSuggestions : null;
    
  } catch (error) {
    console.error("❌ Error suggesting workflows:", error);
    return null;
  }
}

// 🆕 ABILITIES API: Function to get available abilities from WordPress site with cache
async function discoverWordPressAbilities(siteContext) {
  try {
    console.log("🔍 Discovering WordPress Abilities...");
    
    if (!siteContext.wordpressUrl || !siteContext.authToken) {
      console.log("⚠️ No site configuration for discovery");
      return null;
    }
    
    const response = await fetch('/api/wp/discovery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        wordpressUrl: siteContext.wordpressUrl,
        authToken: siteContext.authToken
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log("❌ Error in discovery:", response.status, errorData.message);
      
      // If it's 404, plugin is not installed - use fallback
      if (response.status === 404) {
        console.log("📝 Plugin not found, using legacy mode");
        return null;
      }
      
      return null;
    }
    
    const data = await response.json();
    
    if (data.status !== 'success' || !data.gemini_tools) {
      console.log("❌ Invalid discovery response:", data);
      return null;
    }
    
    console.log(`✅ Abilities discovered: ${data.abilities_count} (cache: ${data.cache_hit ? 'HIT' : 'MISS'})`);
    
    // Validate that tools have correct structure
    const validTools = data.gemini_tools.filter(tool => {
      return tool.name && tool.description && tool.parameters;
    });
    
    if (validTools.length !== data.gemini_tools.length) {
      console.log(`⚠️ Some tools have invalid structure. Valid: ${validTools.length}/${data.gemini_tools.length}`);
    }
    
    // 🛡️ SECURITY: Include permission context information if available
    const toolsWithSecurityContext = validTools.map(tool => {
      // Add security information if available in response
      if (data.security_context) {
        tool._security_context = {
          permissions_checked: data.security_context.permissions_checked,
          total_abilities: data.security_context.total_abilities,
          allowed_abilities: data.security_context.allowed_abilities,
          filtered_count: data.security_context.filtered_count
        };
      }
      return tool;
    });
    
    return toolsWithSecurityContext.length > 0 ? toolsWithSecurityContext : null;
    
  } catch (error) {
    console.error("❌ Error in discovery:", error);
    return null;
  }
}

// 🔄 WORKFLOW ENGINE: Función para obtener workflows disponibles
async function getWordPressWorkflows(siteContext) {
  try {
    console.log("🔄 Obteniendo workflows disponibles...");
    
    if (!siteContext.wordpressUrl || !siteContext.authToken) {
      console.log("⚠️ No hay configuración de sitio para workflows");
      return null;
    }
    
    const response = await fetch('/api/wp/workflows', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        wordpressUrl: siteContext.wordpressUrl,
        authToken: siteContext.authToken
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log("❌ Error obteniendo workflows:", response.status, errorData.message);
      return null;
    }
    
    const data = await response.json();
    
    if (data.status !== 'success' || !data.workflows) {
      console.log("❌ Respuesta de workflows inválida:", data);
      return null;
    }
    
    console.log(`✅ Workflows obtenidos: ${data.workflows_count}`);
    return data.workflows;
    
  } catch (error) {
    console.error("❌ Error obteniendo workflows:", error);
    return null;
  }
}

// 🔄 WORKFLOW ENGINE: Función para sugerir workflows basados en contexto
function suggestWorkflowsForContext(workflows, context, policyContext) {
  if (!workflows || !Array.isArray(workflows)) {
    return [];
  }
  
  const suggestions = [];
  
  // Analizar contexto para sugerir workflows apropiados
  workflows.forEach(workflow => {
    let relevanceScore = 0;
    let reasons = [];
    
    // Verificar si el workflow es auto-sugerible
    if (!workflow.auto_suggest) {
      return;
    }
    
    // Analizar políticas activadas para sugerir workflows
    if (policyContext && policyContext.suggestions) {
      policyContext.suggestions.forEach(suggestion => {
        if (workflow.category === suggestion.category) {
          relevanceScore += 3;
          reasons.push(`Política activada: ${suggestion.policy_name}`);
        }
        
        // Workflows de seguridad para políticas de seguridad
        if (workflow.category === 'security' && suggestion.category === 'security') {
          relevanceScore += 2;
          reasons.push('Problemas de seguridad detectados');
        }
        
        // Workflows de mantenimiento para múltiples políticas
        if (workflow.category === 'maintenance' && policyContext.suggestions.length >= 2) {
          relevanceScore += 1;
          reasons.push('Múltiples problemas detectados - mantenimiento recomendado');
        }
      });
    }
    
    // Sugerir workflows basados en contexto del sitio
    if (context.site_health) {
      if (workflow.category === 'security' && context.site_health.email_test?.status === 'failed') {
        relevanceScore += 1;
        reasons.push('Problemas de email detectados');
      }
      
      if (workflow.category === 'performance' && context.site_health.active_plugins_count > 25) {
        relevanceScore += 1;
        reasons.push('Alto número de plugins puede afectar rendimiento');
      }
    }
    
    // Solo sugerir workflows con relevancia mínima
    if (relevanceScore >= 1) {
      suggestions.push({
        workflow: workflow,
        relevance_score: relevanceScore,
        reasons: reasons,
        recommendation_strength: relevanceScore >= 3 ? 'high' : relevanceScore >= 2 ? 'medium' : 'low'
      });
    }
  });
  
  // Ordenar por relevancia
  suggestions.sort((a, b) => b.relevance_score - a.relevance_score);
  
  return suggestions.slice(0, 3); // Máximo 3 sugerencias
}

// 🔄 WORKFLOW ENGINE: Función para obtener workflows disponibles
async function getWordPressWorkflows(siteContext) {
  try {
    console.log("🔄 Obteniendo workflows disponibles...");
    
    if (!siteContext.wordpressUrl || !siteContext.authToken) {
      console.log("⚠️ No hay configuración de sitio para workflows");
      return null;
    }
    
    const response = await fetch('/api/wp/workflows', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        wordpressUrl: siteContext.wordpressUrl,
        authToken: siteContext.authToken
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log("❌ Error obteniendo workflows:", response.status, errorData.message);
      return null;
    }
    
    const data = await response.json();
    
    if (data.status !== 'success' || !data.workflows) {
      console.log("❌ Respuesta de workflows inválida:", data);
      return null;
    }
    
    console.log(`✅ Workflows obtenidos: ${data.workflows_count}`);
    return data.workflows;
    
  } catch (error) {
    console.error("❌ Error obteniendo workflows:", error);
    return null;
  }
}

// 🔄 WORKFLOW ENGINE: Función para sugerir workflows basados en contexto
function suggestWorkflowsForContext(workflows, context, policyContext) {
  if (!workflows || !Array.isArray(workflows)) {
    return [];
  }
  
  const suggestions = [];
  
  // Analizar contexto para sugerir workflows apropiados
  workflows.forEach(workflow => {
    let relevanceScore = 0;
    let reasons = [];
    
    // Verificar si el workflow es auto-sugerible
    if (!workflow.auto_suggest) {
      return;
    }
    
    // Analizar políticas activadas para sugerir workflows
    if (policyContext && policyContext.suggestions) {
      policyContext.suggestions.forEach(suggestion => {
        if (workflow.category === suggestion.category) {
          relevanceScore += 3;
          reasons.push(`Política activada: ${suggestion.policy_name}`);
        }
        
        // Workflows de seguridad para políticas de seguridad
        if (workflow.category === 'security' && suggestion.category === 'security') {
          relevanceScore += 2;
          reasons.push('Problemas de seguridad detectados');
        }
        
        // Workflows de mantenimiento para múltiples políticas
        if (workflow.category === 'maintenance' && policyContext.suggestions.length >= 2) {
          relevanceScore += 1;
          reasons.push('Múltiples problemas detectados - mantenimiento recomendado');
        }
      });
    }
    
    // Sugerir workflows basados en contexto del sitio
    if (context.site_health) {
      if (workflow.category === 'security' && context.site_health.email_test?.status === 'failed') {
        relevanceScore += 1;
        reasons.push('Problemas de email detectados');
      }
      
      if (workflow.category === 'performance' && context.site_health.active_plugins_count > 25) {
        relevanceScore += 1;
        reasons.push('Alto número de plugins puede afectar rendimiento');
      }
    }
    
    // Solo sugerir workflows con relevancia mínima
    if (relevanceScore >= 1) {
      suggestions.push({
        workflow: workflow,
        relevance_score: relevanceScore,
        reasons: reasons,
        recommendation_strength: relevanceScore >= 3 ? 'high' : relevanceScore >= 2 ? 'medium' : 'low'
      });
    }
  });
  
  // Ordenar por relevancia
  suggestions.sort((a, b) => b.relevance_score - a.relevance_score);
  
  return suggestions.slice(0, 3); // Máximo 3 sugerencias
}

// 🤖 POLICY ENGINE: Function to evaluate WordPress site policies
async function evaluateWordPressPolicies(siteContext, includeContext = {}) {
  try {
    console.log("🤖 Evaluating WordPress policies...");
    
    if (!siteContext.wordpressUrl || !siteContext.authToken) {
      console.log("⚠️ No site configuration for policy evaluation");
      return null;
    }
    
    const response = await fetch('/api/wp/evaluate-policies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        wordpressUrl: siteContext.wordpressUrl,
        authToken: siteContext.authToken,
        context: includeContext,
        include_suggestions: true
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log("❌ Error en evaluación de políticas:", response.status, errorData.message);
      
      if (response.status === 404) {
        console.log("📝 Endpoint de políticas no encontrado, plugin no actualizado");
        return null;
      }
      
      return null;
    }
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      console.log("❌ Respuesta de evaluación de políticas inválida:", data);
      return null;
    }
    
    console.log(`✅ Políticas evaluadas: ${data.policies_evaluated}, triggered: ${data.policies_triggered}`);
    
    return {
      policies_evaluated: data.policies_evaluated,
      policies_triggered: data.policies_triggered,
      triggered_policies: data.triggered_policies || [],
      suggestions: data.suggestions || [],
      context_used: data.context_used || []
    };
    
  } catch (error) {
    console.error("❌ Error en evaluación de políticas:", error);
    return null;
  }
}

// 3. Función principal para procesar el texto con contexto del sitio
async function getWpCommand(userInput, siteContext = {}, userApiKey = null, chatHistory = []) {
  try {
    console.log("🧠 Procesando con Gemini AI real:", userInput);
    console.log("🔍 Contexto del sitio:", siteContext);
    console.log("🧠 Historial de chat:", chatHistory.length, "mensajes");
    
    // 🆕 STATELESS MODE: Detect if no site is connected
    const isStatelessMode = !siteContext.wordpressUrl || Object.keys(siteContext).length === 0;
    
    if (isStatelessMode) {
      console.log("💬 STATELESS MODE: No site connected - pure Gemini chat");
      return await handleStatelessChat(userInput, userApiKey);
    }
    
    // Usar API Key personalizada si se proporciona, sino usar la del servidor
    const apiKeyToUse = userApiKey || process.env.GEMINI_API_KEY;
    const apiKeySource = userApiKey ? 'usuario' : 'servidor';
    console.log(`🔑 Usando API Key de: ${apiKeySource}`);
    
    // Verificar que tenemos API Key
    if (!apiKeyToUse) {
      console.error("❌ No hay API Key disponible");
      throw new Error("API Key de Gemini no configurada");
    }
    
    // 🆕 ABILITIES API: Intentar descubrir abilities disponibles
    const availableTools = await discoverWordPressAbilities(siteContext);
    const useAbilitiesAPI = availableTools && availableTools.length > 0;
    
    // 🤖 POLICY ENGINE: Evaluar políticas del sitio
    const policyEvaluation = await evaluateWordPressPolicies(siteContext);
    const hasPolicySuggestions = policyEvaluation && policyEvaluation.suggestions.length > 0;
    
    // 🔄 WORKFLOW ENGINE: Evaluar workflows sugeridos
    const workflowSuggestions = await suggestWorkflowsForContext(siteContext, userInput, policyEvaluation);
    const hasWorkflowSuggestions = workflowSuggestions && workflowSuggestions.length > 0;
    
    console.log(`🔄 Workflows sugeridos: ${hasWorkflowSuggestions ? workflowSuggestions.length : 0}`);
    
    console.log(`🔧 Modo de operación: ${useAbilitiesAPI ? 'WordPress Abilities API' : 'WP-CLI Legacy'}`);
    console.log(`🛠️ Tools disponibles: ${availableTools ? availableTools.length : 0}`);
    console.log(`🤖 Políticas evaluadas: ${policyEvaluation ? policyEvaluation.policies_evaluated : 0}, triggered: ${policyEvaluation ? policyEvaluation.policies_triggered : 0}`);
    console.log(`🔄 Workflows sugeridos: ${hasWorkflowSuggestions ? workflowSuggestions.length : 0}`);
    
    // Crear instancia de Gemini con la API Key apropiada
    const genAIInstance = new GoogleGenerativeAI(apiKeyToUse);
    
    let modelConfig = {
      model: "gemini-2.5-flash",
      systemInstruction: useAbilitiesAPI ? 
        `You are Typingpress, a conversational assistant expert in WordPress.

IMPORTANT: You have access to WordPress Abilities API with permissions system, auditing and simulation. Analyze each message and respond appropriately:

1. CONVERSACIÓN (responde con texto plano):
- Saludos: "Hola", "¿Cómo estás?"
- Preguntas generales: "¿Qué puedes hacer?"
- Código: "Dame CSS para el menú"
- Explicaciones: "¿Cómo funciona WordPress?"

2. ACCIONES WORDPRESS (usa function calling):
- Para acciones específicas como "Dime cómo está mi sitio", usa las abilities disponibles
- Llama a las funciones apropiadas en lugar de generar comandos de texto
- IMPORTANTE: Solo puedes usar las abilities que tienes disponibles según tus permisos
- Todas las acciones requieren confirmación explícita del usuario

🧪 SIMULACIÓN Y EXPLAINABILITY:
- SIEMPRE explica qué hará la acción antes de ejecutarla
- Usa lenguaje claro y comprensible para el usuario
- Menciona qué cambiará y qué NO cambiará
- Indica el nivel de riesgo de la operación
- El sistema puede simular acciones antes de ejecutarlas realmente

🛡️ CONTEXTO DE SEGURIDAD:
- Tus acciones están limitadas por un sistema de permisos basado en capacidades de WordPress
- Cada ability tiene un nivel de riesgo (read, write, destructive) y scopes específicos
- Todas las ejecuciones se registran en un sistema de auditoría
- El usuario debe confirmar explícitamente cada acción antes de la ejecución

🔄 WORKFLOW GUIDANCE:
${hasWorkflowSuggestions ? `
- IMPORTANTE: Se identificaron ${workflowSuggestions.length} workflows recomendados para tu situación
- Considera mencionar estos procedimientos guiados al usuario
- Principle: "A workflow is not automation. It's an intelligent checklist guided by AI."
` : '- No se identificaron workflows específicos para la situación actual'}

🤖 POLICY-DRIVEN ASSISTANCE:
${hasPolicySuggestions ? `
- IMPORTANTE: Se detectaron ${policyEvaluation.policies_triggered} situaciones que requieren atención
- Activated policies: ${policyEvaluation.suggestions.map(s => s.policy_name).join(', ')}
- Consider mentioning these situations to the user and suggest recommended actions
- Principle: "AI doesn't automate actions. AI automates understanding and preparation."
` : '- No se detectaron situaciones que requieran atención inmediata'}

For CONVERSATION: Respond only with friendly text.
For ACTIONS: Use available function calls, clearly explain what you will do and why it's necessary.` :
        `You are Typingpress, a conversational assistant expert in WordPress.

IMPORTANT: Analyze each message and respond appropriately:

1. CONVERSACIÓN (responde con texto plano):
- Saludos: "Hola", "¿Cómo estás?"
- Preguntas generales: "¿Qué puedes hacer?"
- Código: "Dame CSS para el menú"
- Explicaciones: "¿Cómo funciona WordPress?"

2. COMANDOS WORDPRESS (responde con JSON):
- Acciones: "Lista los plugins", "Crea una página"
- Gestión: "Instala Yoast", "Actualiza WordPress"

🤖 POLICY-DRIVEN ASSISTANCE:
${hasPolicySuggestions ? `
- IMPORTANT: ${policyEvaluation.policies_triggered} situations requiring attention were detected
- Consider mentioning these situations to the user and suggest appropriate actions
- Principle: "AI doesn't automate actions. AI automates understanding and preparation."
` : '- No se detectaron situaciones que requieran atención inmediata'}

Para CONVERSACIÓN: Responde solo con texto amigable.
Para COMANDOS: Responde con JSON: {"command": "wp ...", "explanation": "...", "is_safe": true}`,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };
    
    // 🆕 ABILITIES API: Agregar tools si están disponibles
    if (useAbilitiesAPI && availableTools.length > 0) {
      modelConfig.tools = [{
        functionDeclarations: availableTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }))
      }];
      console.log("🔧 Tools configurados para Gemini:", modelConfig.tools[0].functionDeclarations.length);
    }
    
    const modelInstance = genAIInstance.getGenerativeModel(modelConfig);
    
    // Construir prompt con contexto de políticas y sesión
    const sessionContextPrompt = processSessionContext(siteContext, chatHistory);
    
    let fullPrompt = useAbilitiesAPI ? 
      `Usuario: "${userInput}"
${sessionContextPrompt}

${hasPolicySuggestions ? `
🤖 CONTEXTO DE POLÍTICAS DETECTADAS:
${policyEvaluation.suggestions.map(s => 
  `• ${s.policy_name} (${s.priority}): ${s.description}`
).join('\n')}

Si el usuario pregunta sobre el estado del sitio o necesita ayuda, considera mencionar estas situaciones detectadas.
` : ''}

Analiza si esto es:
- CONVERSACIÓN → Responde con texto plano amigable
- ACCIÓN WORDPRESS → Usa las function calls disponibles

Responde apropiadamente:` :
      `Usuario: "${userInput}"
${sessionContextPrompt}

${hasPolicySuggestions ? `
🤖 CONTEXTO DE POLÍTICAS DETECTADAS:
${policyEvaluation.suggestions.map(s => 
  `• ${s.policy_name} (${s.priority}): ${s.description}`
).join('\n')}

Si el usuario pregunta sobre el estado del sitio o necesita ayuda, considera mencionar estas situaciones detectadas.
` : ''}

Analiza si esto es:
- CONVERSACIÓN → Responde con texto plano amigable
- COMANDO WORDPRESS → Responde con JSON

Responde apropiadamente:`;

    // 🔄 Llamar a Gemini con retry logic
    const result = await callGeminiWithRetry(modelInstance, fullPrompt);
    
    // 🆕 ABILITIES API: Procesar respuesta con function calls
    if (useAbilitiesAPI) {
      const response = await processAbilitiesResponse(result, siteContext);
      
      // 🤖 POLICY ENGINE: Añadir contexto de políticas a la respuesta
      if (hasPolicySuggestions && response.is_conversational) {
        response.policy_context = {
          policies_triggered: policyEvaluation.policies_triggered,
          suggestions: policyEvaluation.suggestions,
          has_suggestions: true
        };
      }
      
      // 🔄 WORKFLOW ENGINE: Añadir contexto de workflows a la respuesta
      if (hasWorkflowSuggestions && response.is_conversational) {
        response.workflow_context = {
          workflow_suggestions: workflowSuggestions,
          has_suggestions: true
        };
      }
      
      return response;
    } else {
      const response = await processLegacyResponse(result, siteContext);
      
      // 🤖 POLICY ENGINE: Añadir contexto de políticas a la respuesta legacy
      if (hasPolicySuggestions && response.is_conversational) {
        response.policy_context = {
          policies_triggered: policyEvaluation.policies_triggered,
          suggestions: policyEvaluation.suggestions,
          has_suggestions: true
        };
      }
      
      return response;
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

// 🆕 STATELESS MODE: Handle pure Gemini chat without WordPress site
async function handleStatelessChat(userInput, userApiKey = null) {
  try {
    console.log("💬 Processing stateless chat with Gemini AI:", userInput);
    
    // Use custom API Key if provided, otherwise use server's
    const apiKeyToUse = userApiKey || process.env.GEMINI_API_KEY;
    const apiKeySource = userApiKey ? 'user' : 'server';
    console.log(`🔑 Using API Key from: ${apiKeySource}`);
    
    // Verify we have API Key
    if (!apiKeyToUse) {
      console.error("❌ No API Key available for stateless chat");
      throw new Error("Gemini API Key not configured");
    }
    
    // Create Gemini instance
    const genAIInstance = new GoogleGenerativeAI(apiKeyToUse);
    
    const modelConfig = {
      model: "gemini-2.5-flash",
      systemInstruction: `You are Gemini, a helpful AI assistant. You are currently in a temporary chat mode without any WordPress site connected.

IMPORTANT BEHAVIOR:
- This is a stateless conversation - no memory is stored
- No WordPress-specific actions are available
- Focus on general assistance, explanations, and code generation
- Be friendly and helpful for general questions
- If asked about WordPress, suggest connecting a site for full capabilities

CAPABILITIES IN THIS MODE:
- Answer general questions
- Explain concepts and technologies
- Generate code examples (HTML, CSS, JavaScript, PHP, etc.)
- Provide tutorials and guidance
- General conversation

LIMITATIONS:
- Cannot execute WordPress commands
- Cannot access site data
- No conversation history is maintained
- No policies or workflows are available

Respond naturally and helpfully while being clear about the current limitations.`,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };
    
    const modelInstance = genAIInstance.getGenerativeModel(modelConfig);
    
    // Simple prompt for stateless mode
    const fullPrompt = `User: "${userInput}"

Please respond helpfully. Remember this is a temporary chat mode without site connection.`;

    // Call Gemini with retry logic
    const result = await callGeminiWithRetry(modelInstance, fullPrompt);
    
    // Process stateless response
    const text = result.response.text();
    console.log("✅ Stateless Gemini response:", text);
    
    return {
      command: null,
      explanation: text,
      is_safe: true,
      agent_thought: "Stateless chat response",
      is_conversational: true,
      stateless_mode: true
    };
    
  } catch (error) {
    console.error("❌ Error in stateless chat:", error);
    
    // Fallback for stateless mode
    return {
      command: null,
      explanation: `I'm having trouble connecting to Gemini AI right now. This is a temporary chat mode without site connection.

To get the full WordPress assistance experience, please:
1. Click the ⚙️ configuration button
2. Connect your WordPress site  
3. Enjoy policy-driven AI assistance with full capabilities

Error: ${error.message}`,
      is_safe: true,
      agent_thought: "Stateless chat error fallback",
      is_conversational: true,
      stateless_mode: true,
      error: error.message
    };
  }
}

// 🧠 Enhanced session context processing
function processSessionContext(siteContext, chatHistory) {
  // Extract session context if available
  const sessionContext = siteContext.session_context || {};
  
  // Build enhanced context for Gemini
  let contextPrompt = '';
  
  if (sessionContext.session_duration_minutes > 0) {
    contextPrompt += `\n🧠 SESSION CONTEXT:
- Session duration: ${sessionContext.session_duration_minutes} minutes
- Total messages: ${sessionContext.total_messages}
- Recent actions: ${sessionContext.recent_actions?.length || 0}`;
    
    if (sessionContext.site_context) {
      contextPrompt += `\n- Connected site: ${sessionContext.site_context.siteName}`;
    }
    
    if (sessionContext.recent_actions && sessionContext.recent_actions.length > 0) {
      contextPrompt += `\n- Recent actions: ${sessionContext.recent_actions.map(a => a.type).join(', ')}`;
    }
    
    if (sessionContext.conversation_history) {
      contextPrompt += `\n\n🗨️ RECENT CONVERSATION:
${sessionContext.conversation_history}`;
    }
  }
  
  return contextPrompt;
}

// 🆕 ABILITIES API: Procesar respuesta con function calls (SIN EJECUCIÓN AUTOMÁTICA)
async function processAbilitiesResponse(result, siteContext) {
  try {
    const response = result.response;
    const text = response.text();
    
    console.log("🤖 Respuesta de Gemini (Abilities):", text);
    
    // Verificar si hay function calls
    const functionCalls = response.functionCalls();
    
    if (functionCalls && functionCalls.length > 0) {
      console.log("🔧 Function calls detectados:", functionCalls.length);
      
      // Procesar el primer function call
      const functionCall = functionCalls[0];
      console.log("⚡ Function call detectado (PENDIENTE DE CONFIRMACIÓN):", functionCall.name);
      
      // 🛡️ CRÍTICO: NO EJECUTAR AUTOMÁTICAMENTE
      // Devolver información para que el usuario confirme
      return {
        command: null,
        explanation: text || `Quiero ejecutar la acción "${functionCall.name}". ¿Confirmas que proceda?`,
        is_safe: true,
        agent_thought: "Function call detectado - requiere confirmación del usuario",
        is_conversational: false,
        function_call_pending: {
          name: functionCall.name,
          args: functionCall.args || {},
          description: `Ejecutar la función ${functionCall.name}`,
          requires_confirmation: true,
          site_context: {
            wordpressUrl: siteContext.wordpressUrl,
            authToken: siteContext.authToken
          }
        },
        execution_method: 'wordpress_abilities_api_pending'
      };
      
    } else {
      // No hay function calls, tratar como conversacional
      console.log("💬 Respuesta conversacional (sin function calls)");
      return {
        command: null,
        explanation: text,
        is_safe: true,
        agent_thought: "Respuesta conversacional",
        is_conversational: true
      };
    }
    
  } catch (error) {
    console.error("❌ Error procesando respuesta de Abilities:", error);
    return {
      command: null,
      explanation: "Error procesando la respuesta del asistente.",
      is_safe: true,
      agent_thought: "Error en procesamiento de Abilities",
      is_conversational: false,
      error: error.message
    };
  }
}

// 🔄 Procesar respuesta legacy (WP-CLI)
async function processLegacyResponse(result, siteContext) {
  const text = result.response.text();
  console.log("🤖 Respuesta cruda de Gemini (Legacy):", text);
  
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
    return createFallbackResponse("", siteContext);
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
      explanation: `Hello! I'm Typingpress, your WordPress specialist assistant. I can help you manage your site, create content, generate CSS/JavaScript code, and answer any WordPress questions${quotaNote}. How can I help you today?`,
      is_safe: true,
      agent_thought: "Greeting detected - conversational response",
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