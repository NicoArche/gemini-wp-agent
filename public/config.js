// Gemini WP-CLI Terminal application configuration
const CONFIG = {
    // Proxy server URL (change this according to your deployment)
    SERVER_URL: 'http://localhost:3001',
    
    // Default URLs (can be changed from configuration)
    DEFAULT_WORDPRESS_URL: 'https://nicoarche.com',
    DEFAULT_AUTH_TOKEN: 'HACKATHON_GEMINI_2025_SECURE_KEY',
    
    // Interface configuration
    UI: {
        TERMINAL_TITLE: 'Gemini WP-CLI Terminal - Hackathon 2025',
        WELCOME_MESSAGE: `
            <strong>🤖 Gemini WP-CLI Terminal iniciado</strong><br><br>
            Hello! I'm your WordPress assistant. You can ask me to execute WP-CLI commands safely.<br><br>
            <strong>Getting started:</strong><br>
            1. Click ⚙️ to configure your WordPress site<br>
            2. Enter the URL and security token<br>
            3. Start using commands!<br><br>
            <strong>Examples:</strong><br>
            • "List all installed plugins"<br>
            • "Show WordPress version"<br>
            • "Get user information"<br>
            • "Check database status"<br><br>
            <em>All commands will be reviewed before execution.</em>
        `,
        AUTO_SCROLL: true,
        ANIMATION_DURATION: 300
    },
    
    // Mapeo de comandos comunes
    COMMAND_MAPPINGS: {
        'lista.*plugin': {
            command: 'wp plugin list',
            explanation: 'I will list all plugins installed in WordPress, showing their status (active/inactive) and version.',
            is_safe: true
        },
        'versión.*wordpress|wordpress.*versión': {
            command: 'wp --version',
            explanation: 'Voy a mostrar la versión actual de WordPress y información del sistema.',
            is_safe: true
        },
        'usuario.*lista|lista.*usuario': {
            command: 'wp user list',
            explanation: 'Voy a listar todos los usuarios registrados en WordPress con sus roles y información básica.',
            is_safe: true
        },
        'post.*lista|lista.*post|entradas': {
            command: 'wp post list',
            explanation: 'I will show a list of the most recent posts with their status and date.',
            is_safe: true
        },
        'tema.*lista|lista.*tema': {
            command: 'wp theme list',
            explanation: 'I will list all installed themes and show which one is currently active.',
            is_safe: true
        },
        'base.*datos.*tamaño|tamaño.*base.*datos': {
            command: 'wp db size',
            explanation: 'Voy a verificar el tamaño actual de la base de datos de WordPress.',
            is_safe: true
        },
        'core.*versión|versión.*core': {
            command: 'wp core version',
            explanation: 'Voy a mostrar la versión específica del núcleo de WordPress.',
            is_safe: true
        },
        'información.*servidor|servidor.*info': {
            command: 'wp --version',
            explanation: 'I will show server information and available capabilities.',
            is_safe: true,
            use_server_info: true
        }
    },
    
    // Comandos peligrosos que requieren confirmación adicional
    DANGEROUS_COMMANDS: [
        'db drop',
        'db reset',
        'plugin delete',
        'theme delete',
        'user delete',
        'post delete',
        'config'
    ],
    
    // API configuration
    API: {
        TIMEOUT: 30000, // 30 segundos
        RETRY_ATTEMPTS: 3,
        ENDPOINTS: {
            EXECUTE: '/api/wp-cli/execute',
            TEST: '/api/wp-cli/test',
            CHECK_API: '/api/wp-cli/check-api',  // 🔍 NUEVO ENDPOINT PARA DIAGNÓSTICO
            SERVER_INFO: '/api/wp-cli/server-info',
            HEALTH: '/api/health',
            GEMINI_ASK: '/api/gemini/ask'  // 🧠 NUEVO ENDPOINT
        }
    }
};

// Export configuration for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}