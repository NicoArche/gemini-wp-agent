# 🌐 Sistema de Múltiples Sitios WordPress

## 📋 Características

- **Hasta 5 sitios** WordPress simultáneos
- **Persistencia de 30 días** automática
- **Cambio rápido** entre sitios
- **Pruebas de conexión** individuales
- **Gestión visual** completa

## 🚀 Cómo Usar

### 1. Añadir un Nuevo Sitio

1. **Hacer clic en ⚙️** (esquina superior derecha)
2. **Completar el formulario:**
   - **Nombre del Sitio**: Nombre descriptivo (ej: "Mi Blog Personal")
   - **URL de WordPress**: URL completa (ej: https://mi-sitio.com)
   - **Token de Seguridad**: Token del plugin WordPress
3. **Hacer clic en "Añadir Sitio"**
4. El sistema **probará la conexión** automáticamente

### 2. Cambiar de Sitio Activo

**Opción A: Desde el selector**
- Usar el dropdown "Sitio Activo"
- Seleccionar el sitio deseado

**Opción B: Desde la lista**
- Hacer clic en "Usar" junto al sitio deseado

### 3. Gestionar Sitios

**Probar Conexión:**
- Hacer clic en "Test" junto a cualquier sitio
- Verifica estado y actualiza el indicador

**Eliminar Sitio:**
- Hacer clic en "Eliminar" junto al sitio
- Confirmación automática

## 💾 Persistencia de Datos

### Almacenamiento Local
- Los sitios se guardan en **localStorage** del navegador
- **Duración**: 30 días desde la última actualización
- **Limpieza automática** de sitios expirados

### Datos Guardados
```json
{
  "sites": [
    {
      "id": "site_1234567890_abc123",
      "name": "Mi Sitio WordPress",
      "url": "https://mi-sitio.com",
      "token": "MI_TOKEN_SECRETO",
      "savedAt": "2025-12-29T10:00:00.000Z",
      "lastUsed": "2025-12-29T15:30:00.000Z",
      "status": "connected"
    }
  ],
  "activeSiteId": "site_1234567890_abc123",
  "lastUpdated": "2025-12-29T15:30:00.000Z"
}
```

### Renovación Automática
- **Cada uso** del sitio renueva la fecha de expiración
- **Cambio de sitio activo** actualiza `lastUsed`
- **Pruebas de conexión** mantienen el sitio activo

## 🔒 Seguridad

### Tokens de Seguridad
- Se almacenan **localmente** en el navegador
- **No se envían** a servidores externos (excepto el proxy)
- **Encriptación** del navegador (localStorage)

### Validación
- **URLs válidas** requeridas
- **Pruebas de conexión** antes de guardar
- **Tokens únicos** por sitio

### Límites
- **Máximo 5 sitios** por navegador
- **Expiración automática** a los 30 días
- **Validación** en cada operación

## 🎯 Estados de Sitios

### Indicadores Visuales

**🟢 Conectado**
- Última prueba exitosa
- Listo para usar

**🔴 Error de Conexión**
- Problema con URL o token
- Requiere verificación

**⚪ Sin Probar**
- Sitio recién añadido
- Hacer "Test" para verificar

### Información Adicional
- **Tiempo desde último uso**
- **Estado de conexión**
- **Sitio activo** resaltado

## 🛠️ Solución de Problemas

### Error: "Máximo 5 sitios permitidos"
**Solución:** Eliminar un sitio existente antes de añadir uno nuevo

### Error: "Este sitio ya está configurado"
**Solución:** La URL ya existe, usar el sitio existente o cambiar la URL

### Error: "No hay sitio WordPress configurado"
**Solución:** Añadir al menos un sitio y seleccionarlo como activo

### Sitio no aparece en la lista
**Posibles causas:**
1. **Expirado** (más de 30 días)
2. **Error en localStorage**
3. **Navegador en modo incógnito**

**Solución:** Añadir el sitio nuevamente

### Conexión falla constantemente
**Verificar:**
1. **URL correcta** (sin /wp-json al final)
2. **Token coincide** con el plugin WordPress
3. **Plugin activado** en WordPress
4. **Servidor proxy** funcionando

## 📊 Límites y Restricciones

### Límites Técnicos
- **5 sitios máximo** por navegador
- **30 días** de persistencia
- **Dependiente de localStorage** (≈5-10MB)

### Limitaciones del Navegador
- **Modo incógnito**: No persiste datos
- **Limpiar datos**: Elimina todos los sitios
- **Diferentes navegadores**: Configuraciones separadas

## 🔄 Migración y Backup

### Exportar Configuración
```javascript
// En la consola del navegador
const sites = localStorage.getItem('gemini-wp-cli-sites');
console.log(sites); // Copiar este JSON
```

### Importar Configuración
```javascript
// En la consola del navegador
const sitesData = '{"sites":[...]}'; // Pegar JSON aquí
localStorage.setItem('gemini-wp-cli-sites', sitesData);
location.reload(); // Recargar página
```

### Limpiar Todo
```javascript
// En la consola del navegador
localStorage.removeItem('gemini-wp-cli-sites');
location.reload(); // Recargar página
```

## 💡 Consejos de Uso

### Organización
- **Nombres descriptivos** para sitios
- **Agrupar por proyecto** o cliente
- **Probar conexiones** regularmente

### Rendimiento
- **Cambiar sitios** es instantáneo
- **Tokens se cachean** localmente
- **Sin límite** de comandos por sitio

### Mantenimiento
- **Revisar sitios** mensualmente
- **Actualizar tokens** si cambian
- **Eliminar sitios** no utilizados

---

**¡Gestiona múltiples sitios WordPress de forma eficiente!** 🚀