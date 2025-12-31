// Configuración de la aplicación Gemini WP-CLI Terminal
const CONFIG = {
    // URL del servidor proxy (cambia esto según tu despliegue)
    SERVER_URL: 'http://localhost:3001',
    
    // URLs por defecto (se pueden cambiar desde la configuración)
    DEFAULT_WORDPRESS_URL: 'https://nicoarche.com',
    DEFAULT_AUTH_TOKEN: 'HACKATHON_GEMINI_2025_SECURE_KEY',
    
    // Configuración de la interfaz
    UI: {
        TERMINAL_TITLE: 'Gemini WP-CLI Terminal - Hackathon 2025',
        WELCOME_MESSAGE: `
            <strong>🤖 Gemini WP-CLI Terminal iniciado</strong><br><br>
            Hola! Soy tu asistente para WordPress. Puedes pedirme que ejecute comandos WP-CLI de forma segura.<br><br>
            <strong>Primeros pasos:</strong><br>
            1. Haz clic en ⚙️ para configurar tu sitio WordPress<br>
            2. Ingresa la URL y token de seguridad<br>
            3. ¡Empieza a usar comandos!<br><br>
            <strong>Ejemplos:</strong><br>
            • "Lista todos los plugins instalados"<br>
            • "Muestra la versión de WordPress"<br>
            • "Obtén información de los usuarios"<br>
            • "Verifica el estado de la base de datos"<br><br>
            <em>Todos los comandos serán revisados antes de ejecutarse.</em>
        `,
        AUTO_SCROLL: true,
        ANIMATION_DURATION: 300
    },
    
    // Mapeo de comandos comunes
    COMMAND_MAPPINGS: {
        'lista.*plugin': {
            command: 'wp plugin list',
            explanation: 'Voy a listar todos los plugins instalados en WordPress, mostrando su estado (activo/inactivo) y versión.',
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
            explanation: 'Voy a mostrar una lista de las publicaciones más recientes con su estado y fecha.',
            is_safe: true
        },
        'tema.*lista|lista.*tema': {
            command: 'wp theme list',
            explanation: 'Voy a listar todos los temas instalados y mostrar cuál está activo actualmente.',
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
            explanation: 'Voy a mostrar información del servidor y capacidades disponibles.',
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
    
    // Configuración de la API
    API: {
        TIMEOUT: 30000, // 30 segundos
        RETRY_ATTEMPTS: 3,
        ENDPOINTS: {
            EXECUTE: '/api/wp-cli/execute',
            TEST: '/api/wp-cli/test',
            SERVER_INFO: '/api/wp-cli/server-info',
            HEALTH: '/api/health',
            GEMINI_ASK: '/api/gemini/ask'  // 🧠 NUEVO ENDPOINT
        }
    }
};

// Exportar configuración para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}