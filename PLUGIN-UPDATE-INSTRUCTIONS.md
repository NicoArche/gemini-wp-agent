# 🔧 Instrucciones para Actualizar el Plugin WordPress

## ❌ Problema Actual
El comando `wp plugin update --all` está fallando con el error:
```
Plugin '--all' not found.
```

## ✅ Solución
El plugin de WordPress necesita ser actualizado para soportar el flag `--all` en los comandos de actualización.

## 📋 Pasos para Actualizar

### Opción 1: Actualización Manual (Recomendada)

1. **Accede al panel de WordPress** en `https://nicoarche.com/wp-admin`

2. **Ve a Plugins → Editor de archivos**

3. **Selecciona "Gemini WP-CLI Bridge"**

4. **Reemplaza todo el contenido** del archivo `gemini-wp-cli.php` con el contenido del archivo `wp-plugin/gemini-wp-cli-updated.php`

5. **Guarda los cambios**

6. **Desactiva y reactiva el plugin** para aplicar los cambios:
   - Plugins → Plugins instalados
   - Desactivar "Gemini WP-CLI Bridge"
   - Activar "Gemini WP-CLI Bridge"

### Opción 2: Subir Archivo Actualizado

1. **Descarga el archivo** `wp-plugin/gemini-wp-cli-updated.php`

2. **Renómbralo a** `gemini-wp-cli.php`

3. **Sube el archivo** vía FTP o File Manager a:
   ```
   /wp-content/plugins/gemini-wp-cli-bridge/gemini-wp-cli.php
   ```

4. **Desactiva y reactiva el plugin** desde el panel de WordPress

## 🆕 Nuevas Características en v2.1

### ✅ Soporte para `--all`
- `wp plugin update --all` - Actualiza todos los plugins
- `wp theme update --all` - Actualiza todos los temas

### ✅ Mejor Logging
- Logs más detallados para debugging
- Información de versión en respuestas

### ✅ Endpoint de Test Mejorado
- Información de nuevas características
- Verificación de versión

## 🧪 Verificar la Actualización

### 1. Test del Endpoint
```bash
curl https://nicoarche.com/wp-json/gemini/v1/test
```

Deberías ver:
```json
{
  "status": "ok",
  "message": "Plugin Gemini v2.1 funcionando correctamente",
  "version": "2.1",
  "new_features": {
    "plugin_update_all": "wp plugin update --all",
    "theme_update_all": "wp theme update --all"
  }
}
```

### 2. Test del Comando
Desde la webapp, ejecuta:
```
actualizar todos los plugins
```

Debería funcionar sin errores.

## 🔑 Token Actual
El token sigue siendo el mismo:
```
3c747755c3f66d2793e2d3e37f45c3e717ea766e722db18ee5a82634f812e815
```

## 📞 Si Hay Problemas

1. **Verifica los logs** en `/wp-content/gemini-debug.log`
2. **Revisa la consola** del navegador para errores
3. **Confirma que el plugin está activo** en WordPress
4. **Prueba desactivar/activar** el plugin

## 🎯 Resultado Esperado

Después de la actualización:
- ✅ `wp plugin update --all` funcionará correctamente
- ✅ `wp theme update --all` funcionará correctamente  
- ✅ El comando "actualizar todos los plugins" desde la webapp funcionará
- ✅ Se mostrarán los plugins actualizados y los que fallaron