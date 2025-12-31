# 🔄 Guía de Actualización del Plugin

## 📋 Pasos para Actualizar

### **Paso 1: Respaldar el Plugin Actual (Opcional)**
```bash
# Si quieres hacer backup del plugin anterior
cp wp-content/plugins/gemini-wp-cli/gemini-wp-cli.php wp-content/plugins/gemini-wp-cli/gemini-wp-cli.php.backup
```

### **Paso 2: Subir el Plugin Actualizado**

**Opción A: Via FTP/cPanel**
1. Sube el archivo `wp-plugin/gemini-wp-cli.php` actualizado
2. Reemplaza el archivo existente en:
   ```
   /wp-content/plugins/gemini-wp-cli/gemini-wp-cli.php
   ```

**Opción B: Via WordPress Admin**
1. Ve a **Plugins → Editor de plugins**
2. Selecciona "Gemini WP-CLI Bridge"
3. Copia y pega el contenido del archivo actualizado
4. Haz clic en **"Actualizar archivo"**

### **Paso 3: Reactivar el Plugin**
1. Ve a **Plugins → Plugins instalados**
2. **Desactiva** "Gemini WP-CLI Bridge"
3. **Activa** "Gemini WP-CLI Bridge" de nuevo

**¿Por qué reactivar?**
- Ejecuta el hook de activación
- Genera el token seguro automáticamente
- Actualiza las rutas de la API

### **Paso 4: Verificar la Actualización**

**Verificar versión:**
```
https://tu-sitio.com/wp-json/gemini/v1/test
```

Deberías ver algo como:
```json
{
  "status": "ok",
  "message": "Plugin Gemini funcionando correctamente",
  "timestamp": "2025-12-29T...",
  "wp_version": "6.9"
}
```

### **Paso 5: Obtener el Nuevo Token**

**Opción A: Desde WordPress Admin**
1. Ve a **Configuración → Gemini WP-CLI**
2. Verás la nueva página de administración
3. Copia el token generado automáticamente

**Opción B: Desde API (si estás logueado como admin)**
```
https://tu-sitio.com/wp-json/gemini/v1/token
```

**Opción C: Desde la herramienta web**
```
http://localhost:3000/get-token.html
```

### **Paso 6: Actualizar la Aplicación Terminal**

1. Abre `http://localhost:3000/index.html`
2. Haz clic en ⚙️ para abrir configuración
3. **Elimina el sitio anterior** (si existe)
4. **Añade un nuevo sitio** con:
   - **Nombre**: `nicoarche.com (Seguro)`
   - **URL**: `https://nicoarche.com`
   - **Token**: `[el nuevo token generado]`

## ✅ Verificación de Funcionamiento

### **Test 1: Conexión Básica**
```
https://nicoarche.com/wp-json/gemini/v1/test
```
**Esperado**: Respuesta JSON exitosa

### **Test 2: Token de Administrador**
```
https://nicoarche.com/wp-json/gemini/v1/token
```
**Esperado**: Token completo (solo si estás logueado como admin)

### **Test 3: Comando WP-CLI**
En la terminal, probar:
```
"Lista los plugins"
```
**Esperado**: Comando ejecutado exitosamente

## 🔒 Nuevas Características de Seguridad

### **✅ Lo que Cambió:**
- ❌ **Token hardcodeado eliminado**
- ✅ **Token único generado automáticamente**
- ✅ **Página de administración añadida**
- ✅ **API de gestión de tokens**
- ✅ **Comparación segura con hash_equals()**
- ✅ **Regeneración de tokens**

### **✅ Lo que Sigue Igual:**
- ✅ **Todos los comandos WP-CLI funcionan igual**
- ✅ **Misma API REST**
- ✅ **Compatibilidad con hostings restrictivos**
- ✅ **Logs de debug**

## 🚨 Solución de Problemas

### **Error: "Token inválido"**
**Causa**: Usando el token anterior
**Solución**: Obtener el nuevo token y actualizar la configuración

### **Error: "Plugin no encontrado"**
**Causa**: Plugin no activado correctamente
**Solución**: Desactivar y reactivar el plugin

### **Error: "Página de administración no aparece"**
**Causa**: Cache de WordPress
**Solución**: Limpiar cache o esperar unos minutos

### **Error: "No se puede obtener token via API"**
**Causa**: No estás logueado como administrador
**Solución**: Iniciar sesión como admin en WordPress

## 📞 Verificación Final

**Cuando todo esté funcionando, deberías poder:**

1. ✅ **Ver la página de administración** en Configuración → Gemini WP-CLI
2. ✅ **Copiar el token** desde la página de admin
3. ✅ **Conectar la terminal** con el nuevo token
4. ✅ **Ejecutar comandos** WP-CLI sin problemas
5. ✅ **Regenerar tokens** cuando sea necesario

---

**¡La actualización mejora significativamente la seguridad sin afectar la funcionalidad!** 🔒✨