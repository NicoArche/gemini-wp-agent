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
        const geminiResponse = await getWpCommand(prompt.trim(), siteContext || {}, userApiKey, chatHistory || []);

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

        // Probar endpoint de test
        const wpResponse = await fetch(`${cleanUrl}/wp-json/gemini/v1/test`, {
            method: 'GET',
            headers: {
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/1.0'
            },
            timeout: 10000 // 10 segundos
        });

        if (!wpResponse.ok) {
            throw new Error(`WordPress API respondió con ${wpResponse.status}: ${wpResponse.statusText}`);
        }

        const wpData = await wpResponse.json();

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

        const wpData = await wpResponse.json();

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
    try {
        const { command, wordpressUrl, authToken } = req.body;

        if (!command || !wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros: command, wordpressUrl, authToken'
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

        console.log(`🚀 Ejecutando comando: ${command} en ${cleanUrl}`);

        // 🧪 MODO DEMO: Si la URL contiene "demo" o "test", simular respuesta
        if (cleanUrl.includes('demo') || cleanUrl.includes('test') || cleanUrl.includes('localhost')) {
            console.log('🧪 Modo demo activado - simulando respuesta');
            
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

        // Llamar al endpoint de ejecución del plugin WordPress
        const wpResponse = await fetch(`${cleanUrl}/wp-json/gemini/v1/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/1.0'
            },
            body: JSON.stringify({
                command: command
            }),
            timeout: 30000 // 30 segundos
        });

        if (!wpResponse.ok) {
            throw new Error(`WordPress API respondió con ${wpResponse.status}: ${wpResponse.statusText}`);
        }

        const wpData = await wpResponse.json();

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
        console.error('❌ Error en /api/wp-cli/execute:', error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            command: req.body.command,
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