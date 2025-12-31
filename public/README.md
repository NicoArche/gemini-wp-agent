# Gemini WP-CLI Terminal

Una interfaz web estilo terminal que permite ejecutar comandos WP-CLI de forma segura a través de un asistente AI (Gemini).

## 🚀 Características

- **Interfaz Terminal**: Diseño oscuro con fuente monoespaciada (JetBrains Mono)
- **Chat Inteligente**: Convierte solicitudes en lenguaje natural a comandos WP-CLI
- **Previsualización Segura**: Muestra qué comando se ejecutará antes de confirmar
- **Compatibilidad Universal**: Funciona en cualquier hosting (con o sin WP-CLI)
- **Seguridad Robusta**: Validación y filtrado de comandos peligrosos

## 📋 Requisitos

### Backend (Plugin WordPress)
- WordPress 5.0+
- PHP 7.4+
- Plugin "Gemini WP-CLI Bridge" instalado y activado

### Frontend
- Navegador moderno con soporte para ES6+
- Conexión a internet (para fuentes de Google)

## 🛠️ Instalación

### 1. Configurar el Plugin WordPress

1. Sube el archivo `gemini-wp-cli.php` a `/wp-content/plugins/gemini-wp-cli/`
2. Activa el plugin desde el admin de WordPress
3. Verifica que funciona visitando: `https://tu-sitio.com/wp-json/gemini/v1/test`

### 2. Configurar el Frontend

1. Sube los archivos de la carpeta `public/` a tu servidor web
2. Edita `config.js` y actualiza:
   ```javascript
   WORDPRESS_URL: 'https://tu-sitio-wordpress.com',
   AUTH_TOKEN: 'TU_TOKEN_SECRETO'
   ```
3. Asegúrate de que el token coincida con el del plugin WordPress

### 3. Probar la Conexión

1. Abre `index.html` en tu navegador
2. Escribe: "información del servidor"
3. Confirma la ejecución y verifica que se conecta correctamente

## 🎯 Uso

### Comandos Soportados

La aplicación reconoce solicitudes en lenguaje natural y las convierte a comandos WP-CLI:

| Solicitud | Comando WP-CLI | Descripción |
|-----------|----------------|-------------|
| "Lista los plugins" | `wp plugin list` | Muestra todos los plugins |
| "Versión de WordPress" | `wp --version` | Información del sistema |
| "Muestra los usuarios" | `wp user list` | Lista de usuarios |
| "Lista las entradas" | `wp post list` | Publicaciones recientes |
| "Temas instalados" | `wp theme list` | Temas disponibles |
| "Tamaño de la base de datos" | `wp db size` | Espacio usado por la BD |
| "Información del servidor" | Endpoint especial | Capacidades del servidor |

### Flujo de Trabajo

1. **Escribe tu solicitud** en lenguaje natural
2. **Gemini analiza** y propone un comando WP-CLI
3. **Revisa la previsualización** con explicación y nivel de seguridad
4. **Confirma la ejecución** si estás de acuerdo
5. **Ve los resultados** formateados en la terminal

### Indicadores de Seguridad

- 🟢 **Verde**: Comando seguro (solo lectura)
- 🔴 **Rojo**: Comando que requiere precaución (puede modificar datos)

## ⚙️ Configuración Avanzada

### Personalizar Comandos

Edita `config.js` para añadir nuevos patrones de reconocimiento:

```javascript
COMMAND_MAPPINGS: {
    'tu_patron_regex': {
        command: 'wp tu comando',
        explanation: 'Descripción de lo que hace',
        is_safe: true // o false
    }
}
```

### Cambiar Estilo

Modifica las variables CSS en `index.html`:

```css
:root {
    --bg-color: #1a1a1a;
    --text-color: #e0e0e0;
    --accent-color: #00ff88;
}
```

### Timeout y Reintentos

Ajusta en `config.js`:

```javascript
API: {
    TIMEOUT: 30000, // 30 segundos
    RETRY_ATTEMPTS: 3
}
```

## 🔒 Seguridad

### Medidas Implementadas

- **Autenticación por token**: Previene acceso no autorizado
- **Validación de comandos**: Solo acepta comandos que empiecen con "wp "
- **Lista negra**: Bloquea comandos peligrosos (db drop, config set, etc.)
- **Sanitización**: Previene inyección de comandos
- **Previsualización**: El usuario siempre confirma antes de ejecutar

### Comandos Bloqueados

Por seguridad, estos comandos están restringidos:
- `wp db drop` / `wp db reset`
- `wp config create` / `wp config set`
- `wp plugin delete` / `wp theme delete`
- `wp user delete` / `wp post delete`
- Comandos con `&&`, `||`, `;`, `|`

## 🐛 Solución de Problemas

### Error 404 al conectar

1. Verifica que el plugin esté activado
2. Comprueba la URL en `config.js`
3. Revisa los permalinks de WordPress

### Error de autenticación

1. Verifica que el token en `config.js` coincida con el del plugin
2. Asegúrate de que el header `X-Gemini-Auth` se envía correctamente

### Comandos no funcionan

1. Revisa la consola del navegador para errores
2. Verifica la conectividad con: `https://tu-sitio.com/wp-json/gemini/v1/test`
3. Comprueba los logs en `/wp-content/gemini-debug.log`

### Hosting restrictivo

Si tu hosting bloquea funciones de ejecución:
- El plugin automáticamente usará la API nativa de WordPress
- Funcionalidad limitada pero segura
- Verifica con "información del servidor" qué está disponible

## 📱 Responsive

La interfaz es completamente responsive y funciona en:
- 💻 Desktop (experiencia completa)
- 📱 Móviles (interfaz adaptada)
- 📟 Tablets (diseño optimizado)

## 🎨 Personalización

### Temas de Color

Puedes crear temas personalizados modificando las variables CSS:

```css
/* Tema Matrix */
--bg-color: #000000;
--text-color: #00ff00;
--accent-color: #00ff00;

/* Tema Cyberpunk */
--bg-color: #0f0f23;
--text-color: #ff00ff;
--accent-color: #00ffff;
```

### Fuentes Alternativas

Si JetBrains Mono no está disponible:

```css
font-family: 'Fira Code', 'Source Code Pro', 'Courier New', monospace;
```

## 📄 Licencia

Este proyecto fue creado para la Hackathon Gemini 2025.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📞 Soporte

Para problemas o preguntas:
1. Revisa la sección de solución de problemas
2. Verifica los logs del plugin
3. Comprueba la consola del navegador

---

**¡Disfruta usando Gemini WP-CLI Terminal!** 🚀