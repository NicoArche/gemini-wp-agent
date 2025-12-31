# 🚀 Guía de Instalación - Gemini WP-CLI Terminal

## 📋 Requisitos Previos

- **Node.js** 14+ instalado
- **WordPress** con el plugin instalado
- **Navegador** moderno

## 🛠️ Instalación Paso a Paso

### 1. Configurar el Plugin WordPress

1. **Subir el plugin:**
   ```bash
   # Copia el archivo a tu WordPress
   wp-content/plugins/gemini-wp-cli/gemini-wp-cli.php
   ```

2. **Activar el plugin:**
   - Ve al admin de WordPress → Plugins
   - Activa "Gemini WP-CLI Bridge"

3. **Verificar funcionamiento:**
   ```bash
   # Visita esta URL en tu navegador
   https://tu-sitio.com/wp-json/gemini/v1/test
   ```

### 2. Configurar el Servidor

1. **Instalar dependencias:**
   ```bash
   cd web-app
   npm install
   ```

2. **Iniciar el servidor:**
   ```bash
   # Desarrollo
   npm run dev

   # Producción
   npm start
   ```

3. **Verificar servidor:**
   ```bash
   # Debe responder con información del servidor
   curl http://localhost:3000/api/health
   ```

### 3. Configurar el Frontend

1. **Abrir la aplicación:**
   ```
   http://localhost:3000
   ```

2. **Configurar conexión:**
   - Haz clic en el icono ⚙️
   - Ingresa tu URL de WordPress
   - Ingresa el token de seguridad
   - Haz clic en "Guardar Configuración"

## 🔧 Configuración

### Variables de Entorno (Opcional)

Crea un archivo `.env` en la carpeta `web-app/`:

```env
PORT=3000
NODE_ENV=production
```

### Configuración del Plugin

En `wp-plugin/gemini-wp-cli.php`, línea 25:
```php
$secret_token = 'TU_TOKEN_PERSONALIZADO';
```

### Configuración del Frontend

En `public/config.js`:
```javascript
SERVER_URL: 'http://tu-servidor.com:3000',
DEFAULT_WORDPRESS_URL: 'https://tu-sitio.com',
DEFAULT_AUTH_TOKEN: 'TU_TOKEN_PERSONALIZADO'
```

## 🚀 Despliegue en Producción

### Opción 1: Servidor VPS

1. **Subir archivos al servidor**
2. **Instalar dependencias:**
   ```bash
   cd web-app
   npm install --production
   ```
3. **Usar PM2 para mantener el proceso:**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "gemini-wp-cli"
   pm2 startup
   pm2 save
   ```

### Opción 2: Netlify/Vercel (Solo Frontend)

1. **Configurar para servir archivos estáticos**
2. **Actualizar `config.js` con la URL de tu API**
3. **Desplegar la carpeta `public/`**

### Opción 3: Heroku

1. **Crear `Procfile`:**
   ```
   web: node web-app/server.js
   ```
2. **Configurar variables de entorno**
3. **Desplegar con Git**

## 🔒 Seguridad en Producción

### 1. Cambiar Token por Defecto
```php
// En el plugin WordPress
$secret_token = 'GENERA_UN_TOKEN_ALEATORIO_SEGURO';
```

### 2. Configurar HTTPS
- Usar certificados SSL
- Forzar HTTPS en WordPress

### 3. Configurar CORS
```javascript
// En server.js, línea 8
app.use(cors({
    origin: ['https://tu-dominio.com'],
    credentials: true
}));
```

### 4. Rate Limiting
```bash
npm install express-rate-limit
```

```javascript
// Añadir al server.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // máximo 100 requests por IP
});

app.use('/api/', limiter);
```

## 🐛 Solución de Problemas

### Error: "Cannot connect to server"
1. Verificar que el servidor esté ejecutándose
2. Comprobar la URL en `config.js`
3. Revisar logs del servidor

### Error: "WordPress API error"
1. Verificar que el plugin esté activado
2. Comprobar el token de autenticación
3. Revisar logs en `/wp-content/gemini-debug.log`

### Error: "CORS policy"
1. Configurar CORS en el servidor
2. Verificar que las URLs coincidan

### Frontend no carga
1. Verificar que los archivos estén en `public/`
2. Comprobar la consola del navegador
3. Verificar permisos de archivos

## 📊 Monitoreo

### Logs del Servidor
```bash
# Ver logs en tiempo real
tail -f logs/server.log

# Con PM2
pm2 logs gemini-wp-cli
```

### Logs de WordPress
```bash
# Ver logs del plugin
tail -f wp-content/gemini-debug.log
```

### Health Check
```bash
# Verificar estado del servidor
curl http://localhost:3000/api/health

# Verificar WordPress
curl https://tu-sitio.com/wp-json/gemini/v1/test
```

## 🎯 Comandos Útiles

### Desarrollo
```bash
# Instalar dependencias
npm install

# Modo desarrollo (auto-reload)
npm run dev

# Verificar sintaxis
npm run lint
```

### Producción
```bash
# Iniciar servidor
npm start

# Reiniciar con PM2
pm2 restart gemini-wp-cli

# Ver estado
pm2 status
```

### WordPress
```bash
# Activar plugin via WP-CLI
wp plugin activate gemini-wp-cli

# Verificar estado
wp plugin status gemini-wp-cli

# Ver logs
wp eval "echo file_get_contents(WP_CONTENT_DIR . '/gemini-debug.log');"
```

## 📞 Soporte

Si encuentras problemas:

1. **Revisa los logs** del servidor y WordPress
2. **Verifica la configuración** en todos los archivos
3. **Comprueba la conectividad** entre componentes
4. **Consulta la documentación** de cada componente

---

**¡Tu terminal Gemini WP-CLI está listo para la hackathon!** 🎉