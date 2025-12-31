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
const FREE_TIER_LIMIT = 3; // 3 consultas por hora
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hora en milisegundos

// Función para verificar y actualizar límites de rate limiting
function checkRateLimit(ip) {
    const now = Date.now();
    const userLimit = rateLimits.get(ip);
    
    // Si no existe registro o ha pasado la ventana de tiempo, resetear
    if (!userLimit || now > userLimit.resetTime) {
        rateLimits.set(ip, {
            count: 0, // Empezar en 0, se incrementará después
            resetTime: now + RATE_LIMIT_WINDOW
        });
        return { allowed: true, remaining: FREE_TIER_LIMIT, resetTime: now + RATE_LIMIT_WINDOW };
    }
    
    // Si ya excedió el límite
    if (userLimit.count >= FREE_TIER_LIMIT) {
        return { 
            allowed: false, 
            remaining: 0, 
            resetTime: userLimit.resetTime,
            timeUntilReset: Math.ceil((userLimit.resetTime - now) / 1000 / 60) // minutos
        };
    }
    
    // Permitir la consulta (el contador se incrementará después)
    return { 
        allowed: true, 
        remaining: FREE_TIER_LIMIT - userLimit.count - 1, // -1 porque se va a consumir esta consulta
        resetTime: userLimit.resetTime 
    };
}

// Función para incrementar el contador después de una consulta exitosa
function incrementRateLimit(ip) {
    const userLimit = rateLimits.get(ip);
    if (userLimit) {
        userLimit.count++;
        rateLimits.set(ip, userLimit);
    }
}

// Función para obtener IP real del cliente
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
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

// Endpoint para proxy de comandos WP-CLI
app.post('/api/wp-cli/execute', async (req, res) => {
    try {
        const { command, wordpressUrl, authToken } = req.body;

        // Validar datos requeridos
        if (!command || !wordpressUrl || !authToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Faltan parámetros requeridos: command, wordpressUrl, authToken'
            });
        }

        // Validar formato de URL
        let cleanUrl;
        try {
            cleanUrl = new URL(wordpressUrl).origin;
        } catch (error) {
            return res.status(400).json({
                status: 'error',
                message: 'URL de WordPress inválida'
            });
        }

        console.log(`Ejecutando comando: ${command} en ${cleanUrl}`);

        // Hacer petición al plugin de WordPress
        const wpResponse = await fetch(`${cleanUrl}/wp-json/gemini/v1/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Gemini-Auth': authToken,
                'User-Agent': 'Gemini-WP-CLI-Terminal/1.0'
            },
            body: JSON.stringify({ command }),
            timeout: 30000 // 30 segundos
        });

        if (!wpResponse.ok) {
            throw new Error(`WordPress API respondió con ${wpResponse.status}: ${wpResponse.statusText}`);
        }

        const wpData = await wpResponse.json();

        // Añadir metadatos del servidor
        const response = {
            ...wpData,
            server_info: {
                processed_at: new Date().toISOString(),
                server_version: '1.0.0',
                wordpress_url: cleanUrl
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Error en /api/wp-cli/execute:', error);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            error_type: error.name,
            timestamp: new Date().toISOString()
        });
    }
});

// 🧠 NUEVO ENDPOINT: Conectar con Gemini AI
app.post('/api/gemini/ask', async (req, res) => {
    try {
        const { prompt, siteContext } = req.body;

        // Validar que se proporcione un prompt
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Se requiere un prompt válido'
            });
        }

        console.log(`🧠 Gemini procesando: "${prompt.substring(0, 50)}..."`);
        console.log(`🔍 Contexto del sitio:`, siteContext);

        // Verificar si el usuario envió su propia API Key
        const userApiKey = req.headers['x-user-gemini-key'];
        const clientIP = getClientIP(req);
        
        if (userApiKey) {
            console.log('🔑 Usando API Key personalizada del usuario');
        } else {
            console.log('🔑 Usando API Key del servidor (compartida)');
            console.log(`🌐 IP del cliente: ${clientIP}`);
            
            // 🚦 Verificar límites solo para usuarios gratuitos (sin API Key)
            const rateLimitResult = checkRateLimit(clientIP);
            
            if (!rateLimitResult.allowed) {
                console.log(`⛔ Rate limit excedido para IP: ${clientIP}`);
                return res.status(429).json({
                    status: 'error',
                    message: 'Has agotado tus consultas gratuitas. Agrega tu propia API Key en configuración para seguir',
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

        // Llamar a la función de Gemini con contexto y API Key opcional
        let geminiResponse;
        try {
            geminiResponse = await getWpCommand(prompt.trim(), siteContext || {}, userApiKey);
        } catch (error) {
            console.error('❌ Error específico de Gemini:', error.message);
            
            // Manejo específico de errores de cuota
            if (error.message === 'QUOTA_EXCEEDED') {
                console.log('⛔ Cuota de Gemini excedida');
                
                const isUserApiKey = error.apiKeySource === 'usuario';
                const message = isUserApiKey ? 
                    'Tu API Key de Gemini ha alcanzado el límite de cuota. Intenta de nuevo más tarde.' :
                    'El servidor está saturado. Intenta de nuevo en 60 segundos o usa tu propia API Key';
                
                return res.status(429).json({
                    status: 'error',
                    message: message,
                    error_type: 'GEMINI_QUOTA_EXCEEDED',
                    api_key_source: isUserApiKey ? 'user' : 'server',
                    retry_after_seconds: 60,
                    suggestion: isUserApiKey ? 
                        'Espera unos minutos antes de intentar de nuevo' :
                        'Agrega tu propia API Key en configuración para evitar estos límites',
                    timestamp: new Date().toISOString()
                });
            }
            
            // Manejo específico de errores de API Key inválida
            if (error.message === 'INVALID_API_KEY') {
                console.log('🔑 API Key inválida');
                
                const isUserApiKey = error.apiKeySource === 'usuario';
                const message = isUserApiKey ?
                    'Tu API Key de Gemini no es válida. Verifica que sea correcta.' :
                    'Error de configuración del servidor. Contacta al administrador.';
                
                return res.status(401).json({
                    status: 'error',
                    message: message,
                    error_type: 'INVALID_API_KEY',
                    api_key_source: isUserApiKey ? 'user' : 'server',
                    suggestion: isUserApiKey ?
                        'Verifica tu API Key en la configuración' :
                        'Contacta al administrador del sistema',
                    timestamp: new Date().toISOString()
                });
            }
            
            // Para otros errores, devolver error genérico
            return res.status(500).json({
                status: 'error',
                message: 'Error interno procesando con Gemini',
                error_details: error.message,
                error_type: 'GEMINI_ERROR',
                timestamp: new Date().toISOString()
            });
        }

        // Verificar si hubo error en Gemini (respuesta de fallback)
        if (geminiResponse.error) {
            return res.status(500).json({
                status: 'error',
                message: 'Error procesando con Gemini',
                gemini_error: geminiResponse.error,
                timestamp: new Date().toISOString()
            });
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
            const currentLimit = checkRateLimit(clientIP);
            response.rate_limit = {
                limit: FREE_TIER_LIMIT,
                remaining: Math.max(0, currentLimit.remaining - 1), // -1 porque ya se consumió esta consulta
                reset_time: new Date(currentLimit.resetTime).toISOString()
            };
        }

        res.json(response);

        console.log(`✅ Gemini respondió: ${geminiResponse.command}`);

    } catch (error) {
        console.error('Error en /api/gemini/ask:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Error interno procesando con Gemini',
            error_details: error.message,
            error_type: error.name,
            timestamp: new Date().toISOString()
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
});

module.exports = app;