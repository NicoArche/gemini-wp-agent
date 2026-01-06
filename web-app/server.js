const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

// Importar la función de Gemini
const { getWpCommand } = require('./gemini-logic.js');

const app = express();
const PORT = process.env.PORT || 3000;

// 🚦 Sistema de límites para usuarios gratuitos (en memoria)
const rateLimits = new Map(); // IP -> { count: number, resetTime: timestamp }
const FREE_TIER_LIMIT = 50; // 50 consultas por hora (aumentado para pruebas)
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hora en milisegundos

// Función para verificar límites de rate limiting (grado industrial)
function checkRateLimit(ip) {
    const now = Date.now();
    const userLimit = rateLimits.get(ip);
    
    console.log(`🚦 Verificando rate limit para IP: ${ip}`);
    
    // Validar IP
    if (!isValidIP(ip)) {
        console.warn(`⚠️ IP inválida detectada: ${ip}, usando fallback`);
        ip = '127.0.0.1';
    }
    
    // Si no existe registro o ha pasado la ventana de tiempo, resetear
    if (!userLimit || now > userLimit.resetTime) {
        console.log(`✅ Nueva ventana de tiempo para IP: ${ip}`);
        return { 
            allowed: true, 
            remaining: FREE_TIER_LIMIT, 
            resetTime: now + RATE_LIMIT_WINDOW,
            isNewWindow: true,
            ip: ip
        };
    }
    
    // Si ya excedió el límite
    if (userLimit.count >= FREE_TIER_LIMIT) {
        const timeUntilReset = Math.ceil((userLimit.resetTime - now) / 1000 / 60);
        console.log(`⛔ Rate limit excedido para IP: ${ip} (${userLimit.count}/${FREE_TIER_LIMIT}), reset en ${timeUntilReset} minutos`);
        return { 
            allowed: false, 
            remaining: 0, 
            resetTime: userLimit.resetTime,
            timeUntilReset: timeUntilReset,
            ip: ip
        };
    }
    
    // Permitir la consulta
    const remaining = FREE_TIER_LIMIT - userLimit.count - 1;
    console.log(`✅ Consulta permitida para IP: ${ip} (${remaining} restantes)`);
    return { 
        allowed: true, 
        remaining: remaining,
        resetTime: userLimit.resetTime,
        ip: ip
    };
}

// Función para incrementar el contador después de una consulta exitosa (grado industrial)
function incrementRateLimit(ip) {
    const now = Date.now();
    
    // Validar IP
    if (!isValidIP(ip)) {
        console.warn(`⚠️ IP inválida en incrementRateLimit: ${ip}, usando fallback`);
        ip = '127.0.0.1';
    }
    
    const userLimit = rateLimits.get(ip);
    
    if (!userLimit || now > userLimit.resetTime) {
        // Crear nuevo registro
        rateLimits.set(ip, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW,
            firstRequest: now,
            lastRequest: now
        });
        console.log(`📊 Nuevo registro de rate limit para IP: ${ip} (1/${FREE_TIER_LIMIT})`);
    } else {
        // Incrementar contador existente
        userLimit.count++;
        userLimit.lastRequest = now;
        rateLimits.set(ip, userLimit);
        console.log(`📊 Rate limit actualizado para IP: ${ip} (${userLimit.count}/${FREE_TIER_LIMIT})`);
    }
    
    // Limpiar registros antiguos para evitar memory leaks
    cleanupOldRateLimitRecords();
}

// Función para limpiar registros antiguos (prevenir memory leaks)
function cleanupOldRateLimitRecords() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [ip, record] of rateLimits.entries()) {
        // Eliminar registros que han expirado hace más de 1 hora
        if (now > record.resetTime + RATE_LIMIT_WINDOW) {
            rateLimits.delete(ip);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 Limpiados ${cleanedCount} registros antiguos de rate limit`);
    }
}

// Función para obtener IP real del cliente (grado industrial)
function getClientIP(req) {
    // Priorizar headers de proxy más comunes
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        // x-forwarded-for puede contener múltiples IPs separadas por comas
        // La primera es la IP real del cliente
        const ips = forwardedFor.split(',').map(ip => ip.trim());
        const clientIP = ips[0];
        
        // Validar que sea una IP válida
        if (isValidIP(clientIP)) {
            return clientIP;
        }
    }
    
    // Otros headers de proxy comunes
    const realIP = req.headers['x-real-ip'];
    if (realIP && isValidIP(realIP)) {
        return realIP;
    }
    
    const clientIPHeader = req.headers['x-client-ip'];
    if (clientIPHeader && isValidIP(clientIPHeader)) {
        return clientIPHeader;
    }
    
    // Fallback a conexión directa
    const directIP = req.connection?.remoteAddress || 
                    req.socket?.remoteAddress ||
                    req.ip ||
                    '127.0.0.1';
    
    // Limpiar IPv6 wrapping si existe
    const cleanIP = directIP.replace(/^::ffff:/, '');
    
    return isValidIP(cleanIP) ? cleanIP : '127.0.0.1';
}

// Función auxiliar para validar IPs
function isValidIP(ip) {
    if (!ip || typeof ip !== 'string') return false;
    
    // Regex básico para IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    // Regex básico para IPv6
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (ipv4Regex.test(ip)) {
        // Validar rangos IPv4 (0-255)
        const parts = ip.split('.');
        return parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
    }
    
    if (ipv6Regex.test(ip)) {
        return true; // IPv6 básico válido
    }
    
    return false;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// 🚀 SISTEMA DE CACHÉ PARA ABILITIES DISCOVERY
const abilitiesCache = new Map(); // site_url + token -> { tools, timestamp, cache_key }
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Función para generar clave de caché
function generateCacheKey(siteUrl, authToken) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(siteUrl + authToken).digest('hex');
}

// Función para verificar si el caché es válido
function isCacheValid(cacheEntry) {
    if (!cacheEntry) return false;
    const now = Date.now();
    return (now - cacheEntry.timestamp) < CACHE_DURATION;
}

// 🆕 ABILITIES API: Endpoint para discovery de WordPress Abilities con caché
app.post('/api/wp/discovery', async (req, res) => {
    const requestId = `discovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔍 [${requestId}] Iniciando discovery de WordPress Abilities`);
    
    try {
        const { wordpressUrl, authToken } = req.body;

        if (!wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: wordpressUrl, authToken',
                request_id: requestId
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida',
                request_id: requestId
            });
        }

        // Verificar caché primero
        const cacheKey = generateCacheKey(cleanUrl, authToken);
        const cachedEntry = abilitiesCache.get(cacheKey);
        
        if (isCacheValid(cachedEntry)) {
            console.log(`✅ [${requestId}] Usando caché para: ${cleanUrl}`);
            return res.json({
                status: 'success',
                request_id: requestId,
                wordpress_url: cleanUrl,
                abilities_count: cachedEntry.tools.length,
                gemini_tools: cachedEntry.tools,
                cache_hit: true,
                cache_age_seconds: Math.floor((Date.now() - cachedEntry.timestamp) / 1000),
                discovery_time: new Date().toISOString()
            });
        }

        console.log(`🔍 [${requestId}] Consultando abilities en: ${cleanUrl}`);

        // Llamar al endpoint real del plugin (namespace correcto)
        const wpResponse = await fetch(`${cleanUrl}/wp-json/gemini-wp-cli/v1/abilities?format=tools`, {
            method: 'GET',
            headers: {
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/3.0-Discovery',
                'Accept': 'application/json'
            },
            timeout: 15000
        });

        if (!wpResponse.ok) {
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log(`❌ [${requestId}] Error HTTP ${wpResponse.status}: ${errorContent.substring(0, 200)}`);
            
            // Detectar si es HTML (plugin no instalado/activo)
            if (errorContent.includes('<html') || errorContent.includes('<!DOCTYPE')) {
                if (wpResponse.status === 404) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Plugin Gemini WP-CLI no encontrado. Verifica que esté instalado y activo.',
                        error_type: 'PLUGIN_NOT_FOUND',
                        request_id: requestId,
                        suggestions: [
                            'Instala el plugin Gemini WP-CLI en WordPress',
                            'Verifica que el plugin esté activo',
                            'Comprueba que la URL del sitio sea correcta'
                        ]
                    });
                }
            }
            
            throw new Error(`WordPress API respondió con ${wpResponse.status}: ${wpResponse.statusText}`);
        }

        let wpData;
        let responseText;
        
        // Leer la respuesta como texto primero (evitar "body used already")
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta de WordPress: ${readError.message}`);
        }
        
        // Intentar parsear como JSON
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            console.log(`📄 [${requestId}] Respuesta no-JSON:`, responseText.substring(0, 500));
            throw new Error(`WordPress devolvió contenido no-JSON. Respuesta: ${responseText.substring(0, 200)}...`);
        }

        // Validar estructura de respuesta
        if (!wpData.tools || !Array.isArray(wpData.tools)) {
            throw new Error('Respuesta de WordPress no contiene tools válidas');
        }

        console.log(`✅ [${requestId}] Discovery exitoso. Tools encontradas: ${wpData.tools.length}`);

        // Guardar en caché
        const cacheEntry = {
            tools: wpData.tools,
            timestamp: Date.now(),
            cache_key: wpData.cache_key || 'unknown',
            wordpress_url: cleanUrl
        };
        
        abilitiesCache.set(cacheKey, cacheEntry);
        console.log(`💾 [${requestId}] Guardado en caché para: ${cleanUrl}`);

        // Limpiar caché antiguo cada 100 requests
        if (Math.random() < 0.01) {
            cleanupAbilitiesCache();
        }

        res.json({
            status: 'success',
            request_id: requestId,
            wordpress_url: cleanUrl,
            abilities_count: wpData.tools.length,
            gemini_tools: wpData.tools,
            cache_hit: false,
            cache_key: wpData.cache_key,
            discovery_time: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Error en discovery:`, error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            request_id: requestId,
            timestamp: new Date().toISOString()
        });
    }
});

// 📊 ENDPOINT: Información del caché de abilities
app.get('/api/wp/cache-info', (req, res) => {
    try {
        const cacheEntries = [];
        const now = Date.now();
        
        for (const [key, entry] of abilitiesCache.entries()) {
            const ageSeconds = Math.floor((now - entry.timestamp) / 1000);
            const isValid = isCacheValid(entry);
            
            cacheEntries.push({
                cache_key: key.substring(0, 8) + '...', // Mostrar solo parte de la clave
                wordpress_url: entry.wordpress_url,
                tools_count: entry.tools.length,
                age_seconds: ageSeconds,
                is_valid: isValid,
                cached_at: new Date(entry.timestamp).toISOString()
            });
        }
        
        res.json({
            status: 'success',
            cache_entries: cacheEntries,
            total_cached_sites: cacheEntries.length,
            cache_duration_seconds: CACHE_DURATION / 1000,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error en /api/wp/cache-info:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error consultando información de caché',
            timestamp: new Date().toISOString()
        });
    }
});

// Función para limpiar caché antiguo
function cleanupAbilitiesCache() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of abilitiesCache.entries()) {
        if ((now - entry.timestamp) > (CACHE_DURATION * 2)) { // Limpiar entradas 2x más antiguas
            abilitiesCache.delete(key);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 Limpiadas ${cleanedCount} entradas de caché de abilities`);
    }
}

// 🆕 ABILITIES API: Endpoint para ejecutar abilities específicas con soporte para simulación
app.post('/api/wp/execute-ability', async (req, res) => {
    const requestId = `exec_ability_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`⚡ [${requestId}] Ejecutando WordPress Ability`);
    
    try {
        const { abilityName, abilityInput, wordpressUrl, authToken, mode = 'execute' } = req.body;

        if (!abilityName || !wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: abilityName, wordpressUrl, authToken',
                request_id: requestId
            });
        }

        // 🧪 DRY-RUN: Validar modo de ejecución
        const validModes = ['execute', 'simulate'];
        if (!validModes.includes(mode)) {
            return res.status(400).json({
                status: 'error',
                message: `Modo inválido. Debe ser uno de: ${validModes.join(', ')}`,
                request_id: requestId
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida',
                request_id: requestId
            });
        }

        const logPrefix = mode === 'simulate' ? '🧪 [SIMULATE]' : '⚡ [EXECUTE]';
        console.log(`${logPrefix} [${requestId}] ${mode} ability: ${abilityName} en ${cleanUrl}`);

        // Construir URL con parámetro de modo
        const executeUrl = `${cleanUrl}/wp-json/gemini-wp-cli/v1/abilities/${encodeURIComponent(abilityName)}/execute?mode=${mode}`;

        // Llamar al endpoint de ejecución del plugin (namespace correcto)
        const wpResponse = await fetch(executeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Gemini-Auth': authToken,
                'User-Agent': `Gemini-WP-CLI-Terminal/3.0-${mode === 'simulate' ? 'Simulation' : 'Execution'}`
            },
            body: JSON.stringify(abilityInput || {}),
            timeout: mode === 'simulate' ? 15000 : 30000 // Menos timeout para simulaciones
        });

        if (!wpResponse.ok) {
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log(`❌ [${requestId}] Error en ${mode} de ability: ${errorContent.substring(0, 200)}`);
            throw new Error(`Error en ${mode} de ability: ${wpResponse.status} ${wpResponse.statusText}`);
        }

        let wpData;
        let responseText;
        
        // Leer respuesta como texto primero
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta: ${readError.message}`);
        }
        
        // Parsear como JSON
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            throw new Error(`Respuesta inválida de WordPress: ${responseText.substring(0, 200)}...`);
        }

        console.log(`✅ [${requestId}] Ability ${mode} exitoso: ${abilityName}`);

        // 🧪 DRY-RUN: Respuesta diferenciada por modo
        if (mode === 'simulate') {
            res.json({
                status: 'success',
                request_id: requestId,
                mode: 'simulation',
                ability_name: abilityName,
                simulation_result: wpData.simulation_result,
                impact_report: wpData.impact_report,
                execution_method: 'wordpress_abilities_api_simulation',
                wordpress_url: cleanUrl,
                execution_time: wpData.execution_time,
                processed_at: new Date().toISOString(),
                note: 'This was a simulation - no actual changes were made'
            });
        } else {
            res.json({
                status: 'success',
                request_id: requestId,
                mode: 'execution',
                ability_name: abilityName,
                ability_result: wpData.result,
                execution_method: 'wordpress_abilities_api',
                wordpress_url: cleanUrl,
                execution_time: wpData.execution_time,
                processed_at: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error(`❌ [${requestId}] Error en ${req.body.mode || 'execute'} de ability:`, error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            request_id: requestId,
            mode: req.body.mode || 'execute',
            timestamp: new Date().toISOString()
        });
    }
});

// 🧠 ENDPOINT: Conectar con Gemini AI
app.post('/api/gemini/ask', async (req, res) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        console.log(`🚀 [${requestId}] Nueva solicitud a Gemini AI`);
        
        const { prompt, siteContext, chatHistory } = req.body;

        // 🔍 Validación robusta de entrada (grado industrial)
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            console.log(`❌ [${requestId}] Prompt inválido:`, typeof prompt, prompt?.length);
            return res.status(400).json({
                status: 'error',
                message: 'Se requiere un prompt válido',
                error_type: 'INVALID_PROMPT',
                request_id: requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Validar longitud del prompt (prevenir ataques)
        if (prompt.length > 10000) {
            console.log(`❌ [${requestId}] Prompt demasiado largo: ${prompt.length} caracteres`);
            return res.status(400).json({
                status: 'error',
                message: 'El prompt es demasiado largo (máximo 10,000 caracteres)',
                error_type: 'PROMPT_TOO_LONG',
                request_id: requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Validar siteContext
        const validatedSiteContext = siteContext && typeof siteContext === 'object' ? siteContext : {};
        
        // Validar chatHistory
        const validatedChatHistory = Array.isArray(chatHistory) ? chatHistory.slice(0, 10) : []; // Máximo 10 mensajes

        console.log(`🧠 [${requestId}] Gemini procesando: "${prompt.substring(0, 50)}..."`);
        console.log(`🔍 [${requestId}] Contexto del sitio:`, validatedSiteContext);
        console.log(`🧠 [${requestId}] Historial de chat: ${validatedChatHistory.length} mensajes`);

        // Verificar si el usuario envió su propia API Key
        const userApiKey = req.headers['x-user-gemini-key'];
        const clientIP = getClientIP(req);
        
        if (userApiKey) {
            console.log(`🔑 [${requestId}] Usando API Key personalizada del usuario`);
        } else {
            console.log(`🔑 [${requestId}] Usando API Key del servidor (compartida)`);
            console.log(`🌐 [${requestId}] IP del cliente: ${clientIP}`);
            
            // 🚦 Verificar límites solo para usuarios gratuitos (sin API Key)
            const rateLimitResult = checkRateLimit(clientIP);
            
            if (!rateLimitResult.allowed) {
                console.log(`⛔ Rate limit excedido para IP: ${clientIP}`);
                return res.status(429).json({
                    status: 'error',
                    message: 'Has agotado tus 50 consultas gratuitas por hora. Agrega tu propia API Key en configuración para seguir',
                    error_type: 'RATE_LIMIT_EXCEEDED',
                    rate_limit: {
                        limit: FREE_TIER_LIMIT,
                        remaining: 0,
                        reset_in_minutes: rateLimitResult.timeUntilReset,
                        reset_time: new Date(rateLimitResult.resetTime).toISOString()
                    },
                    timestamp: new Date().toISOString()
                });
            }
            
            console.log(`✅ Rate limit OK para IP: ${clientIP} (${rateLimitResult.remaining} consultas restantes)`);
        }

        // Llamar a la función de Gemini con contexto, historial y API Key opcional
        console.log(`🧠 [${requestId}] Llamando a getWpCommand con:`, {
            prompt: prompt.trim(),
            siteContextKeys: Object.keys(validatedSiteContext),
            chatHistoryLength: validatedChatHistory.length,
            hasUserApiKey: !!userApiKey
        });
        
        const geminiResponse = await getWpCommand(prompt.trim(), siteContext || {}, userApiKey, chatHistory || []);
        
        console.log(`✅ [${requestId}] getWpCommand completado:`, {
            hasCommand: !!geminiResponse.command,
            explanationLength: geminiResponse.explanation?.length || 0,
            isConversational: geminiResponse.is_conversational,
            isSafe: geminiResponse.is_safe
        });

        // Verificar si hubo error en Gemini
        if (geminiResponse.error) {
            return res.status(500).json({
                status: 'error',
                message: 'Error procesando con Gemini',
                gemini_error: geminiResponse.error,
                timestamp: new Date().toISOString()
            });
        }

        // Si llegamos aquí, la consulta fue exitosa
        // Incrementar contador solo para usuarios gratuitos
        if (!userApiKey) {
            incrementRateLimit(clientIP);
        }

        // Preparar respuesta exitosa
        const response = {
            status: 'success',
            prompt: prompt.trim(),
            site_context: siteContext,
            gemini_response: geminiResponse,
            processed_at: new Date().toISOString(),
            server_version: '1.0.0',
            api_key_source: userApiKey ? 'user' : 'server'
        };

        // Añadir información de rate limit solo para usuarios gratuitos
        if (!userApiKey) {
            const now = Date.now();
            const userLimit = rateLimits.get(clientIP);
            if (userLimit) {
                response.rate_limit = {
                    limit: FREE_TIER_LIMIT,
                    remaining: Math.max(0, FREE_TIER_LIMIT - userLimit.count),
                    used: userLimit.count,
                    reset_time: new Date(userLimit.resetTime).toISOString()
                };
            }
        }

        res.json(response);
        console.log(`✅ Gemini respondió: ${geminiResponse.command}`);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`❌ [${requestId}] Error en /api/gemini/ask (${processingTime}ms):`, error);
        
        // 🔍 Análisis detallado del error para grado industrial
        let errorType = 'INTERNAL_ERROR';
        let statusCode = 500;
        let userMessage = 'Error interno procesando con Gemini';
        
        if (error.message.includes('API key')) {
            errorType = 'API_KEY_ERROR';
            statusCode = 401;
            userMessage = 'Error de autenticación con Gemini AI';
        } else if (error.message.includes('quota') || error.message.includes('exhausted')) {
            errorType = 'QUOTA_EXCEEDED';
            statusCode = 429;
            userMessage = 'Cuota de Gemini AI agotada temporalmente';
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
            errorType = 'RATE_LIMITED';
            statusCode = 429;
            userMessage = 'Demasiadas solicitudes, intenta más tarde';
        } else if (error.message.includes('timeout') || error.message.includes('network')) {
            errorType = 'NETWORK_ERROR';
            statusCode = 503;
            userMessage = 'Error de conexión con Gemini AI';
        }
        
        res.status(statusCode).json({
            status: 'error',
            message: userMessage,
            error_details: error.message,
            error_type: errorType,
            request_id: requestId,
            processing_time_ms: processingTime,
            timestamp: new Date().toISOString(),
            retry_after: statusCode === 429 ? 60 : undefined // Sugerir retry después de 60 segundos para rate limits
        });
    }
});

// 🚦 ENDPOINT: Consultar estado de límites
app.get('/api/rate-limit/status', (req, res) => {
    try {
        const clientIP = getClientIP(req);
        const now = Date.now();
        const userLimit = rateLimits.get(clientIP);
        
        if (!userLimit || now > userLimit.resetTime) {
            // No hay límites o han expirado
            return res.json({
                status: 'success',
                rate_limit: {
                    limit: FREE_TIER_LIMIT,
                    remaining: FREE_TIER_LIMIT,
                    used: 0,
                    reset_time: new Date(now + RATE_LIMIT_WINDOW).toISOString(),
                    reset_in_minutes: 60
                },
                client_ip: clientIP,
                timestamp: new Date().toISOString()
            });
        }
        
        const remaining = Math.max(0, FREE_TIER_LIMIT - userLimit.count);
        const resetInMinutes = Math.ceil((userLimit.resetTime - now) / 1000 / 60);
        
        res.json({
            status: 'success',
            rate_limit: {
                limit: FREE_TIER_LIMIT,
                remaining: remaining,
                used: userLimit.count,
                reset_time: new Date(userLimit.resetTime).toISOString(),
                reset_in_minutes: resetInMinutes
            },
            client_ip: clientIP,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error en /api/rate-limit/status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error consultando estado de límites',
            timestamp: new Date().toISOString()
        });
    }
});

// 🔄 WORKFLOW ENGINE: Endpoint para obtener workflows disponibles
app.post('/api/wp/workflows', async (req, res) => {
    const requestId = `workflows_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔄 [${requestId}] Obteniendo workflows de WordPress`);
    
    try {
        const { wordpressUrl, authToken } = req.body;

        if (!wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: wordpressUrl, authToken',
                request_id: requestId
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida',
                request_id: requestId
            });
        }

        console.log(`🔄 [${requestId}] Consultando workflows en: ${cleanUrl}`);

        const wpResponse = await fetch(`${cleanUrl}/wp-json/gemini-wp-cli/v1/workflows`, {
            method: 'GET',
            headers: {
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/3.0-Workflows'
            },
            timeout: 15000
        });

        if (!wpResponse.ok) {
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log(`❌ [${requestId}] Error HTTP ${wpResponse.status}: ${errorContent.substring(0, 200)}`);
            
            if (wpResponse.status === 404) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Endpoint de workflows no encontrado. Verifica que el plugin esté actualizado.',
                    error_type: 'WORKFLOWS_ENDPOINT_NOT_FOUND',
                    request_id: requestId
                });
            }
            
            throw new Error(`WordPress API respondió con ${wpResponse.status}: ${wpResponse.statusText}`);
        }

        let wpData;
        let responseText;
        
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta: ${readError.message}`);
        }
        
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            throw new Error(`Respuesta inválida de WordPress: ${responseText.substring(0, 200)}...`);
        }

        console.log(`✅ [${requestId}] Workflows obtenidos exitosamente: ${wpData.workflows_count}`);

        res.json({
            status: 'success',
            request_id: requestId,
            wordpress_url: cleanUrl,
            workflows_count: wpData.workflows_count,
            workflows: wpData.workflows,
            workflow_engine_method: 'wordpress_workflow_api',
            processed_at: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Error obteniendo workflows:`, error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            request_id: requestId,
            timestamp: new Date().toISOString()
        });
    }
});

// 🔄 WORKFLOW ENGINE: Endpoint para iniciar workflow
app.post('/api/wp/workflows/:workflowId/start', async (req, res) => {
    const requestId = `start_workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const workflowId = req.params.workflowId;
    console.log(`🔄 [${requestId}] Iniciando workflow: ${workflowId}`);
    
    try {
        const { wordpressUrl, authToken, context = {} } = req.body;

        if (!wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: wordpressUrl, authToken',
                request_id: requestId
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida',
                request_id: requestId
            });
        }

        console.log(`🔄 [${requestId}] Iniciando workflow ${workflowId} en: ${cleanUrl}`);

        const wpResponse = await fetch(`${cleanUrl}/wp-json/gemini-wp-cli/v1/workflows/${encodeURIComponent(workflowId)}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/3.0-Workflows'
            },
            body: JSON.stringify({ context: context }),
            timeout: 20000
        });

        if (!wpResponse.ok) {
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log(`❌ [${requestId}] Error iniciando workflow: ${errorContent.substring(0, 200)}`);
            throw new Error(`Error iniciando workflow: ${wpResponse.status} ${wpResponse.statusText}`);
        }

        let wpData;
        let responseText;
        
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta: ${readError.message}`);
        }
        
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            throw new Error(`Respuesta inválida de WordPress: ${responseText.substring(0, 200)}...`);
        }

        console.log(`✅ [${requestId}] Workflow iniciado exitosamente: ${wpData.session_id}`);

        res.json({
            status: 'success',
            request_id: requestId,
            workflow_id: workflowId,
            session_id: wpData.session_id,
            session_data: wpData.session_data,
            workflow_method: 'wordpress_workflow_api',
            processed_at: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Error iniciando workflow:`, error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            request_id: requestId,
            workflow_id: workflowId,
            timestamp: new Date().toISOString()
        });
    }
});

// 🔄 WORKFLOW ENGINE: Endpoints para acciones de pasos
app.post('/api/wp/workflows/sessions/:sessionId/steps/:stepIndex/:action', async (req, res) => {
    const requestId = `workflow_step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { sessionId, stepIndex, action } = req.params;
    console.log(`🔄 [${requestId}] Acción de workflow: ${action} paso ${stepIndex} sesión ${sessionId}`);
    
    try {
        const { wordpressUrl, authToken, reason = '' } = req.body;

        if (!wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: wordpressUrl, authToken',
                request_id: requestId
            });
        }

        const validActions = ['simulate', 'execute', 'skip'];
        if (!validActions.includes(action)) {
            return res.status(400).json({
                status: 'error',
                message: `Acción inválida. Debe ser una de: ${validActions.join(', ')}`,
                request_id: requestId
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida',
                request_id: requestId
            });
        }

        console.log(`🔄 [${requestId}] ${action} paso ${stepIndex} en: ${cleanUrl}`);

        const endpoint = `${cleanUrl}/wp-json/gemini-wp-cli/v1/workflows/sessions/${encodeURIComponent(sessionId)}/steps/${stepIndex}/${action}`;
        const requestBody = action === 'skip' ? { reason: reason } : {};

        const wpResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/3.0-Workflows'
            },
            body: JSON.stringify(requestBody),
            timeout: action === 'execute' ? 60000 : 30000 // Más tiempo para ejecución
        });

        if (!wpResponse.ok) {
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log(`❌ [${requestId}] Error en ${action}: ${errorContent.substring(0, 200)}`);
            throw new Error(`Error en ${action}: ${wpResponse.status} ${wpResponse.statusText}`);
        }

        let wpData;
        let responseText;
        
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta: ${readError.message}`);
        }
        
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            throw new Error(`Respuesta inválida de WordPress: ${responseText.substring(0, 200)}...`);
        }

        console.log(`✅ [${requestId}] ${action} completado exitosamente`);

        res.json({
            status: 'success',
            request_id: requestId,
            session_id: sessionId,
            step_index: parseInt(stepIndex),
            action: action,
            result: wpData,
            workflow_method: 'wordpress_workflow_api',
            processed_at: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Error en ${action} de workflow:`, error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            request_id: requestId,
            session_id: sessionId,
            step_index: parseInt(stepIndex),
            action: action,
            timestamp: new Date().toISOString()
        });
    }
});

// 🔄 WORKFLOW ENGINE: Endpoint para obtener workflows disponibles
app.post('/api/wp/workflows', async (req, res) => {
    const requestId = `workflows_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔄 [${requestId}] Obteniendo workflows disponibles`);
    
    try {
        const { wordpressUrl, authToken } = req.body;

        if (!wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: wordpressUrl, authToken',
                request_id: requestId
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida',
                request_id: requestId
            });
        }

        console.log(`🔄 [${requestId}] Obteniendo workflows de: ${cleanUrl}`);

        const wpResponse = await fetch(`${cleanUrl}/wp-json/gemini-wp-cli/v1/workflows`, {
            method: 'GET',
            headers: {
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/3.0-Workflows'
            },
            timeout: 15000
        });

        if (!wpResponse.ok) {
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log(`❌ [${requestId}] Error HTTP ${wpResponse.status}: ${errorContent.substring(0, 200)}`);
            
            if (wpResponse.status === 404) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Endpoint de workflows no encontrado. Verifica que el plugin esté actualizado.',
                    error_type: 'WORKFLOWS_ENDPOINT_NOT_FOUND',
                    request_id: requestId
                });
            }
            
            throw new Error(`WordPress API respondió con ${wpResponse.status}: ${wpResponse.statusText}`);
        }

        let wpData;
        let responseText;
        
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta: ${readError.message}`);
        }
        
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            throw new Error(`Respuesta inválida de WordPress: ${responseText.substring(0, 200)}...`);
        }

        console.log(`✅ [${requestId}] Workflows obtenidos exitosamente: ${wpData.workflows_count}`);

        res.json({
            status: 'success',
            request_id: requestId,
            wordpress_url: cleanUrl,
            workflows_count: wpData.workflows_count,
            workflows: wpData.workflows,
            workflow_engine_method: 'wordpress_workflow_api',
            processed_at: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Error obteniendo workflows:`, error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            request_id: requestId,
            timestamp: new Date().toISOString()
        });
    }
});

// 🔄 WORKFLOW ENGINE: Endpoint para iniciar workflow
app.post('/api/wp/workflows/:workflowId/start', async (req, res) => {
    const requestId = `start_workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const workflowId = req.params.workflowId;
    console.log(`🔄 [${requestId}] Iniciando workflow: ${workflowId}`);
    
    try {
        const { wordpressUrl, authToken, context = {} } = req.body;

        if (!wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: wordpressUrl, authToken',
                request_id: requestId
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida',
                request_id: requestId
            });
        }

        console.log(`🔄 [${requestId}] Iniciando workflow ${workflowId} en: ${cleanUrl}`);

        const wpResponse = await fetch(`${cleanUrl}/wp-json/gemini-wp-cli/v1/workflows/${encodeURIComponent(workflowId)}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/3.0-Workflows'
            },
            body: JSON.stringify({ context }),
            timeout: 15000
        });

        if (!wpResponse.ok) {
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log(`❌ [${requestId}] Error iniciando workflow: ${errorContent.substring(0, 200)}`);
            throw new Error(`Error iniciando workflow: ${wpResponse.status} ${wpResponse.statusText}`);
        }

        let wpData;
        let responseText;
        
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta: ${readError.message}`);
        }
        
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            throw new Error(`Respuesta inválida de WordPress: ${responseText.substring(0, 200)}...`);
        }

        console.log(`✅ [${requestId}] Workflow iniciado exitosamente: ${wpData.session_id}`);

        res.json({
            status: 'success',
            request_id: requestId,
            workflow_id: workflowId,
            session_id: wpData.session_id,
            session_data: wpData.session_data,
            workflow_engine_method: 'wordpress_workflow_api',
            processed_at: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Error iniciando workflow:`, error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            request_id: requestId,
            workflow_id: workflowId,
            timestamp: new Date().toISOString()
        });
    }
});

// 🔄 WORKFLOW ENGINE: Endpoint para acciones de pasos de workflow
app.post('/api/wp/workflows/sessions/:sessionId/steps/:stepIndex/:action', async (req, res) => {
    const requestId = `workflow_step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = req.params.sessionId;
    const stepIndex = parseInt(req.params.stepIndex);
    const action = req.params.action; // simulate, execute, skip
    console.log(`🔄 [${requestId}] Acción ${action} en paso ${stepIndex} de sesión ${sessionId}`);
    
    try {
        const { wordpressUrl, authToken, reason = '' } = req.body;

        if (!wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: wordpressUrl, authToken',
                request_id: requestId
            });
        }

        if (!['simulate', 'execute', 'skip'].includes(action)) {
            return res.status(400).json({
                status: 'error',
                message: 'Acción inválida. Debe ser: simulate, execute, skip',
                request_id: requestId
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida',
                request_id: requestId
            });
        }

        console.log(`🔄 [${requestId}] ${action} paso ${stepIndex} en: ${cleanUrl}`);

        let endpoint = `${cleanUrl}/wp-json/gemini-wp-cli/v1/workflows/sessions/${encodeURIComponent(sessionId)}/steps/${stepIndex}/${action}`;
        let requestBody = action === 'skip' ? { reason } : {};

        const wpResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/3.0-Workflows'
            },
            body: JSON.stringify(requestBody),
            timeout: action === 'execute' ? 30000 : 15000
        });

        if (!wpResponse.ok) {
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log(`❌ [${requestId}] Error en ${action}: ${errorContent.substring(0, 200)}`);
            throw new Error(`Error en ${action}: ${wpResponse.status} ${wpResponse.statusText}`);
        }

        let wpData;
        let responseText;
        
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta: ${readError.message}`);
        }
        
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            throw new Error(`Respuesta inválida de WordPress: ${responseText.substring(0, 200)}...`);
        }

        console.log(`✅ [${requestId}] ${action} completado exitosamente`);

        res.json({
            status: 'success',
            request_id: requestId,
            session_id: sessionId,
            step_index: stepIndex,
            action: action,
            result: wpData,
            workflow_engine_method: 'wordpress_workflow_api',
            processed_at: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Error en ${action} de workflow:`, error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            request_id: requestId,
            session_id: sessionId,
            step_index: stepIndex,
            action: action,
            timestamp: new Date().toISOString()
        });
    }
});

// 🔄 WORKFLOW ENGINE: Endpoint para obtener workflows disponibles
app.post('/api/wp/workflows', async (req, res) => {
    const requestId = `workflows_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔄 [${requestId}] Obteniendo workflows disponibles`);
    
    try {
        const { wordpressUrl, authToken } = req.body;

        if (!wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: wordpressUrl, authToken',
                request_id: requestId
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida',
                request_id: requestId
            });
        }

        console.log(`🔄 [${requestId}] Consultando workflows en: ${cleanUrl}`);

        const wpResponse = await fetch(`${cleanUrl}/wp-json/gemini-wp-cli/v1/workflows`, {
            method: 'GET',
            headers: {
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/3.0-Workflows',
                'Accept': 'application/json'
            },
            timeout: 15000
        });

        if (!wpResponse.ok) {
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log(`❌ [${requestId}] Error HTTP ${wpResponse.status}: ${errorContent.substring(0, 200)}`);
            
            if (wpResponse.status === 404) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Workflows no encontrados. Verifica que el plugin esté actualizado.',
                    error_type: 'WORKFLOWS_NOT_FOUND',
                    request_id: requestId
                });
            }
            
            throw new Error(`WordPress API respondió con ${wpResponse.status}: ${wpResponse.statusText}`);
        }

        let wpData;
        let responseText;
        
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta: ${readError.message}`);
        }
        
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            throw new Error(`Respuesta inválida de WordPress: ${responseText.substring(0, 200)}...`);
        }

        console.log(`✅ [${requestId}] Workflows obtenidos exitosamente: ${wpData.workflows_count}`);

        res.json({
            status: 'success',
            request_id: requestId,
            wordpress_url: cleanUrl,
            workflows_count: wpData.workflows_count,
            workflows: wpData.workflows,
            discovery_method: 'wordpress_workflow_engine',
            processed_at: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Error en workflows:`, error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            request_id: requestId,
            timestamp: new Date().toISOString()
        });
    }
});

// 🔄 WORKFLOW ENGINE: Endpoint para iniciar workflow
app.post('/api/wp/workflows/:workflowId/start', async (req, res) => {
    const requestId = `start_workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const workflowId = req.params.workflowId;
    console.log(`🔄 [${requestId}] Iniciando workflow: ${workflowId}`);
    
    try {
        const { wordpressUrl, authToken, context = {} } = req.body;

        if (!wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: wordpressUrl, authToken',
                request_id: requestId
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida',
                request_id: requestId
            });
        }

        console.log(`🔄 [${requestId}] Iniciando workflow ${workflowId} en: ${cleanUrl}`);

        const wpResponse = await fetch(`${cleanUrl}/wp-json/gemini-wp-cli/v1/workflows/${encodeURIComponent(workflowId)}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/3.0-Workflows'
            },
            body: JSON.stringify({ context }),
            timeout: 15000
        });

        if (!wpResponse.ok) {
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log(`❌ [${requestId}] Error iniciando workflow: ${errorContent.substring(0, 200)}`);
            throw new Error(`Error iniciando workflow: ${wpResponse.status} ${wpResponse.statusText}`);
        }

        let wpData;
        let responseText;
        
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta: ${readError.message}`);
        }
        
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            throw new Error(`Respuesta inválida de WordPress: ${responseText.substring(0, 200)}...`);
        }

        console.log(`✅ [${requestId}] Workflow iniciado exitosamente: ${workflowId}`);

        res.json({
            status: 'success',
            request_id: requestId,
            workflow_id: workflowId,
            session: wpData.session,
            next_steps: wpData.next_steps,
            execution_method: 'wordpress_workflow_engine',
            processed_at: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Error iniciando workflow:`, error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            request_id: requestId,
            workflow_id: workflowId,
            timestamp: new Date().toISOString()
        });
    }
});

// 🤖 POLICY ENGINE: Endpoint para evaluación de políticas
app.post('/api/wp/evaluate-policies', async (req, res) => {
    const requestId = `eval_policies_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🤖 [${requestId}] Evaluando políticas de WordPress`);
    
    try {
        const { wordpressUrl, authToken, context = {}, include_suggestions = true } = req.body;

        if (!wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: wordpressUrl, authToken',
                request_id: requestId
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida',
                request_id: requestId
            });
        }

        console.log(`🤖 [${requestId}] Evaluando políticas en: ${cleanUrl}`);

        // Llamar al endpoint de evaluación de políticas del plugin
        const wpResponse = await fetch(`${cleanUrl}/wp-json/gemini-wp-cli/v1/policies/evaluate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/3.0-PolicyEngine'
            },
            body: JSON.stringify({
                context: context,
                include_suggestions: include_suggestions
            }),
            timeout: 15000
        });

        if (!wpResponse.ok) {
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log(`❌ [${requestId}] Error HTTP ${wpResponse.status}: ${errorContent.substring(0, 200)}`);
            
            if (wpResponse.status === 404) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Endpoint de políticas no encontrado. Verifica que el plugin esté actualizado.',
                    error_type: 'POLICY_ENDPOINT_NOT_FOUND',
                    request_id: requestId
                });
            }
            
            throw new Error(`WordPress API respondió con ${wpResponse.status}: ${wpResponse.statusText}`);
        }

        let wpData;
        let responseText;
        
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta: ${readError.message}`);
        }
        
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            throw new Error(`Respuesta inválida de WordPress: ${responseText.substring(0, 200)}...`);
        }

        console.log(`✅ [${requestId}] Evaluación de políticas exitosa. Triggered: ${wpData.policies_triggered}`);

        res.json({
            status: 'success',
            request_id: requestId,
            wordpress_url: cleanUrl,
            policies_evaluated: wpData.policies_evaluated,
            policies_triggered: wpData.policies_triggered,
            triggered_policies: wpData.triggered_policies || [],
            suggestions: wpData.suggestions || [],
            context_used: wpData.context_used || [],
            evaluation_method: 'wordpress_policy_engine',
            processed_at: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Error en evaluación de políticas:`, error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            request_id: requestId,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint para verificar si la API REST de WordPress está disponible
app.post('/api/wp-cli/check-api', async (req, res) => {
    try {
        const { wordpressUrl } = req.body;

        if (!wordpressUrl) {
            return res.status(400).json({
                status: 'error',
                message: 'Falta parámetro: wordpressUrl'
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida'
            });
        }

        console.log(`Verificando API REST de WordPress: ${cleanUrl}`);

        // Primero verificar la API REST básica
        const apiResponse = await fetch(`${cleanUrl}/wp-json/`, {
            method: 'GET',
            headers: {
                'User-Agent': 'Gemini-WP-CLI-Terminal/1.0'
            },
            timeout: 10000
        });

        if (!apiResponse.ok) {
            return res.json({
                status: 'error',
                message: 'API REST de WordPress no disponible',
                api_rest_available: false,
                plugin_installed: false,
                details: `HTTP ${apiResponse.status}: ${apiResponse.statusText}`
            });
        }

        // Verificar si el endpoint específico del plugin existe
        const pluginResponse = await fetch(`${cleanUrl}/wp-json/gemini/v1/test`, {
            method: 'GET',
            headers: {
                'User-Agent': 'Gemini-WP-CLI-Terminal/1.0'
            },
            timeout: 10000
        });

        const pluginInstalled = pluginResponse.status !== 404;
        
        res.json({
            status: 'success',
            api_rest_available: true,
            plugin_installed: pluginInstalled,
            plugin_status: pluginResponse.status,
            message: pluginInstalled ? 
                'Plugin Gemini WP-CLI detectado' : 
                'Plugin Gemini WP-CLI no encontrado',
            endpoints: {
                api_rest: `${cleanUrl}/wp-json/`,
                plugin_test: `${cleanUrl}/wp-json/gemini/v1/test`,
                plugin_execute: `${cleanUrl}/wp-json/gemini/v1/execute`
            },
            tested_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error en /api/wp-cli/check-api:', error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint para probar conexión con WordPress
app.post('/api/wp-cli/test', async (req, res) => {
    try {
        const { wordpressUrl, authToken } = req.body;

        if (!wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: wordpressUrl, authToken'
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida'
            });
        }

        console.log(`Probando conexión con: ${cleanUrl}`);

        // Probar endpoint de test con mejor manejo de errores
        let wpResponse;
        try {
            wpResponse = await fetch(`${cleanUrl}/wp-json/gemini/v1/test`, {
                method: 'GET',
                headers: {
                    'X-Gemini-Auth': authToken,
                    'User-Agent': 'Gemini-WP-CLI-Terminal/1.0'
                },
                timeout: 15000 // 15 segundos para test
            });
        } catch (fetchError) {
            console.error('Error de conexión en test:', fetchError);
            
            let errorMessage = 'Error de conexión con WordPress';
            let suggestions = [];
            
            if (fetchError.code === 'ETIMEDOUT' || fetchError.message.includes('timeout')) {
                errorMessage = 'Timeout al conectar con WordPress';
                suggestions = [
                    '1. Verifica que el sitio esté accesible: ' + cleanUrl,
                    '2. Comprueba que el plugin Gemini WP-CLI esté instalado',
                    '3. Revisa si hay un firewall bloqueando conexiones',
                    '4. Intenta acceder manualmente a: ' + cleanUrl + '/wp-json/gemini/v1/test'
                ];
            } else if (fetchError.code === 'ENOTFOUND') {
                errorMessage = 'No se pudo resolver el dominio';
                suggestions = [
                    '1. Verifica que la URL sea correcta: ' + cleanUrl,
                    '2. Comprueba que el dominio esté activo'
                ];
            }
            
            return res.status(500).json({
                status: 'error',
                message: errorMessage,
                error_type: fetchError.code || 'CONNECTION_ERROR',
                suggestions: suggestions,
                debug_info: {
                    target_url: cleanUrl + '/wp-json/gemini/v1/test',
                    timeout_used: '15 seconds',
                    original_error: fetchError.message
                },
                timestamp: new Date().toISOString()
            });
        }

        if (!wpResponse.ok) {
            // Leer respuesta como texto para mejor diagnóstico en test
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log('📄 Contenido de error del test:', errorContent.substring(0, 500));
            
            // Detectar diferentes tipos de errores
            if (errorContent.includes('<html') || errorContent.includes('<!DOCTYPE')) {
                if (wpResponse.status === 404) {
                    throw new Error(`Plugin no encontrado (404).\n\nEl endpoint /wp-json/gemini/v1/test no existe.\n\nEsto significa que:\n• El plugin Gemini WP-CLI no está instalado\n• El plugin está instalado pero no activo\n• Hay un problema con la API REST de WordPress\n\nSolución:\n1. Instala el plugin desde: ${cleanUrl}/wp-admin/plugin-install.php\n2. O actívalo desde: ${cleanUrl}/wp-admin/plugins.php`);
                } else if (wpResponse.status === 403) {
                    throw new Error(`Acceso denegado (403).\n\nEl token de autenticación es incorrecto o el plugin no está configurado.\n\nSolución:\n1. Ve a ${cleanUrl}/wp-admin/options-general.php?page=gemini-token\n2. Copia el token correcto\n3. Actualiza la configuración en la webapp`);
                } else {
                    throw new Error(`Error ${wpResponse.status}: WordPress devolvió HTML.\n\nEsto indica un problema con:\n• Plugin no instalado/activo\n• API REST deshabilitada\n• Error del servidor WordPress\n\nRespuesta: ${errorContent.substring(0, 200)}...`);
                }
            }
            
            throw new Error(`WordPress API respondió con ${wpResponse.status}: ${wpResponse.statusText}\n\nRespuesta: ${errorContent.substring(0, 200)}...`);
        }

        let wpData;
        let responseText;
        
        // Leer la respuesta como texto primero
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta de WordPress: ${readError.message}`);
        }
        
        // Intentar parsear como JSON
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            console.log('📄 Respuesta no-JSON en test:', responseText.substring(0, 500));
            
            throw new Error(`WordPress devolvió contenido no-JSON en test.\n\nEsto indica que el plugin no está funcionando correctamente.\n\nRespuesta recibida: ${responseText.substring(0, 200)}...`);
        }

        res.json({
            status: 'success',
            message: 'Conexión exitosa con WordPress',
            wordpress_data: wpData,
            tested_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error en /api/wp-cli/test:', error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint para obtener información del servidor WordPress
app.post('/api/wp-cli/server-info', async (req, res) => {
    try {
        const { wordpressUrl, authToken } = req.body;

        if (!wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: wordpressUrl, authToken'
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida'
            });
        }

        console.log(`Obteniendo info del servidor: ${cleanUrl}`);

        const wpResponse = await fetch(`${cleanUrl}/wp-json/gemini/v1/server-info`, {
            method: 'GET',
            headers: {
                'User-Agent': 'Gemini-WP-CLI-Terminal/1.0'
            },
            timeout: 10000
        });

        if (!wpResponse.ok) {
            throw new Error(`WordPress API respondió con ${wpResponse.status}: ${wpResponse.statusText}`);
        }

        let wpData;
        try {
            wpData = await wpResponse.json();
        } catch (jsonError) {
            throw new Error(`Error parseando respuesta JSON: ${jsonError.message}`);
        }

        res.json({
            ...wpData,
            proxy_info: {
                server_version: '1.0.0',
                processed_at: new Date().toISOString(),
                wordpress_url: cleanUrl
            }
        });

    } catch (error) {
        console.error('Error en /api/wp-cli/server-info:', error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            timestamp: new Date().toISOString()
        });
    }
});

// 🚀 ENDPOINT: Ejecutar comandos WP-CLI
app.post('/api/wp-cli/execute', async (req, res) => {
    const requestId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🚀 [${requestId}] Nueva solicitud de ejecución de comando`);
    
    try {
        const { command, wordpressUrl, authToken } = req.body;
        
        console.log(`🔍 [${requestId}] Parámetros recibidos:`, {
            command: command,
            wordpressUrl: wordpressUrl,
            hasAuthToken: !!authToken
        });

        if (!command || !wordpressUrl || !authToken) {
            console.log(`❌ [${requestId}] Parámetros faltantes`);
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: command, wordpressUrl, authToken'
            });
        }

        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
            console.log(`✅ [${requestId}] URL limpia: ${cleanUrl}`);
        } catch (error) {
            console.log(`❌ [${requestId}] URL inválida: ${wordpressUrl}`);
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida'
            });
        }

        console.log(`🚀 [${requestId}] Ejecutando comando: ${command} en ${cleanUrl}`);

        // 🧪 MODO DEMO: Si la URL contiene "demo" o "test", simular respuesta
        if (cleanUrl.includes('demo') || cleanUrl.includes('test') || cleanUrl.includes('localhost')) {
            console.log(`🧪 [${requestId}] Modo demo activado - simulando respuesta`);
            
            let demoResponse = '';
            
            if (command.includes('plugin list')) {
                demoResponse = `+------------------+----------+---------+---------+
| name             | status   | update  | version |
+------------------+----------+---------+---------+
| akismet          | active   | none    | 5.3.1   |
| elementor        | active   | none    | 3.18.3  |
| yoast            | inactive | none    | 21.8    |
| woocommerce      | active   | none    | 8.4.0   |
+------------------+----------+---------+---------+`;
            } else if (command.includes('post create')) {
                demoResponse = `Success: Created post 123.
https://tu-sitio.com/nueva-pagina/`;
            } else if (command.includes('user list')) {
                demoResponse = `+----+----------+------------------+---------------------+
| ID | user_login | display_name    | user_email         |
+----+----------+------------------+---------------------+
| 1  | admin    | Administrador   | admin@tu-sitio.com |
| 2  | editor   | Editor Principal| editor@tu-sitio.com|
+----+----------+------------------+---------------------+`;
            } else if (command.includes('--version')) {
                demoResponse = `WP-CLI 2.9.0
WordPress 6.4.2`;
            } else {
                demoResponse = `Success: Comando ejecutado correctamente.
Resultado: ${command}`;
            }

            console.log(`✅ [${requestId}] Respuesta demo generada`);
            return res.json({
                status: 'success',
                command: command,
                wordpress_url: cleanUrl,
                response: demoResponse,
                exec_method: 'demo_mode',
                server_capabilities: true,
                processed_at: new Date().toISOString(),
                demo_mode: true
            });
        }

        console.log(`🌐 [${requestId}] Intentando conectar con WordPress real...`);
        
        // Llamar al endpoint de ejecución del plugin WordPress con mejor manejo de errores
        let wpResponse;
        try {
            wpResponse = await fetch(`${cleanUrl}/wp-json/gemini/v1/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Gemini-Auth': authToken,
                    'User-Agent': 'Gemini-WP-CLI-Terminal/1.0'
                },
                body: JSON.stringify({
                    command: command
                }),
                timeout: 45000 // Aumentar timeout a 45 segundos
            });
        } catch (fetchError) {
            console.error(`❌ [${requestId}] Error de conexión:`, fetchError);
            
            // Proporcionar información más detallada del error
            let errorMessage = 'Error de conexión con WordPress';
            let suggestions = [];
            
            if (fetchError.code === 'ETIMEDOUT' || fetchError.message.includes('timeout')) {
                errorMessage = 'Timeout al conectar con WordPress';
                suggestions = [
                    'Verifica que el sitio esté accesible desde internet',
                    'Comprueba que el plugin Gemini WP-CLI esté instalado y activo',
                    'Revisa si hay un firewall bloqueando conexiones externas',
                    'Intenta nuevamente en unos minutos'
                ];
            } else if (fetchError.code === 'ENOTFOUND') {
                errorMessage = 'No se pudo resolver el dominio';
                suggestions = [
                    'Verifica que la URL del sitio sea correcta',
                    'Comprueba que el dominio esté activo y accesible'
                ];
            } else if (fetchError.code === 'ECONNREFUSED') {
                errorMessage = 'Conexión rechazada por el servidor';
                suggestions = [
                    'El servidor WordPress puede estar caído',
                    'Verifica que el sitio esté funcionando correctamente'
                ];
            }
            
            return res.status(500).json({
                status: 'error',
                message: errorMessage,
                error_type: 'CONNECTION_ERROR',
                error_code: fetchError.code,
                command: command,
                request_id: requestId,
                suggestions: suggestions,
                timestamp: new Date().toISOString(),
                debug_info: {
                    target_url: `${cleanUrl}/wp-json/gemini/v1/execute`,
                    timeout_used: '45 seconds',
                    original_error: fetchError.message
                }
            });
        }
        
        console.log(`📡 [${requestId}] Respuesta de WordPress: ${wpResponse.status} ${wpResponse.statusText}`);

        if (!wpResponse.ok) {
            // Intentar leer la respuesta como texto para mejor diagnóstico
            let errorContent;
            try {
                errorContent = await wpResponse.text();
            } catch (readError) {
                errorContent = 'No se pudo leer la respuesta del servidor';
            }
            
            console.log(`📄 [${requestId}] Contenido de error:`, errorContent.substring(0, 500));
            
            // Detectar si es HTML (página de error)
            if (errorContent.includes('<html') || errorContent.includes('<!DOCTYPE')) {
                throw new Error(`WordPress devolvió una página HTML en lugar de JSON.\n\nEsto indica:\n• El plugin Gemini WP-CLI no está instalado o activo\n• El endpoint /wp-json/gemini/v1/execute no existe\n• Hay un error 404 o 500 en WordPress\n\nVerifica que el plugin esté instalado y activo en: ${cleanUrl}/wp-admin/plugins.php`);
            }
            
            throw new Error(`WordPress API respondió con ${wpResponse.status}: ${wpResponse.statusText}\n\nRespuesta: ${errorContent.substring(0, 200)}...`);
        }

        let wpData;
        let responseText;
        
        // Leer la respuesta como texto primero
        try {
            responseText = await wpResponse.text();
        } catch (readError) {
            throw new Error(`No se pudo leer la respuesta de WordPress: ${readError.message}`);
        }
        
        // Intentar parsear como JSON
        try {
            wpData = JSON.parse(responseText);
        } catch (jsonError) {
            // Si no se puede parsear como JSON, usar el texto para diagnóstico
            console.log(`📄 [${requestId}] Respuesta no-JSON:`, responseText.substring(0, 500));
            
            if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
                throw new Error(`WordPress devolvió HTML en lugar de JSON.\n\nEsto indica que:\n• El plugin Gemini WP-CLI no está instalado o activo\n• El endpoint no existe o hay un error en WordPress\n• Puede haber un error 404, 500 o de autenticación\n\nPor favor:\n1. Verifica que el plugin esté activo en ${cleanUrl}/wp-admin/plugins.php\n2. Comprueba que puedas acceder a ${cleanUrl}/wp-json/\n3. Verifica el token de autenticación`);
            }
            
            throw new Error(`Respuesta inválida de WordPress (no es JSON válido).\n\nRespuesta recibida: ${responseText.substring(0, 200)}...`);
        }
        console.log(`✅ [${requestId}] Datos recibidos de WordPress:`, Object.keys(wpData));

        res.json({
            status: 'success',
            command: command,
            wordpress_url: cleanUrl,
            response: wpData.response || wpData.message,
            exec_method: wpData.exec_method || 'wordpress_api',
            server_capabilities: wpData.server_capabilities || false,
            processed_at: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Error en /api/wp-cli/execute:`, error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            command: req.body.command,
            request_id: requestId,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint de salud del servidor
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Gemini WP-CLI Server funcionando correctamente',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Servir archivos estáticos (frontend)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Endpoint no encontrado',
        path: req.path,
        method: req.method
    });
});

// Manejo de errores globales
app.use((error, req, res, next) => {
    console.error('Error no manejado:', error);
    res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Gemini WP-CLI Server iniciado en puerto ${PORT}`);
    console.log(`📱 Frontend disponible en: http://localhost:${PORT}`);
    console.log(`🔧 API disponible en: http://localhost:${PORT}/api`);
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
    
    // 🧹 Iniciar limpieza automática de rate limits cada 30 minutos (grado industrial)
    setInterval(() => {
        console.log('🧹 Ejecutando limpieza automática de rate limits...');
        cleanupOldRateLimitRecords();
        console.log(`📊 Rate limits activos: ${rateLimits.size}`);
    }, 30 * 60 * 1000); // 30 minutos
    
    console.log('🔧 Sistema de limpieza automática iniciado (cada 30 minutos)');
});

module.exports = app;