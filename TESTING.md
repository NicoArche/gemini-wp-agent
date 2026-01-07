# 🧪 Guía Completa de Pruebas - TypingPress

Esta guía te ayudará a evaluar todas las funcionalidades de TypingPress de manera sistemática.

---

## 📋 Índice

1. [Pruebas Básicas de Conexión](#1-pruebas-básicas-de-conexión)
2. [Pruebas de Abilities](#2-pruebas-de-abilities-8-disponibles)
3. [Pruebas de Modo Simulación](#3-pruebas-de-modo-simulación)
4. [Pruebas de Chat Conversacional](#4-pruebas-de-chat-conversacional)
5. [Pruebas de Integración con Gemini](#5-pruebas-de-integración-con-gemini)
6. [Pruebas de Seguridad y Permisos](#6-pruebas-de-seguridad-y-permisos)
7. [Pruebas de Casos de Error](#7-pruebas-de-casos-de-error)
8. [Pruebas de UI/UX](#8-pruebas-de-uiux)
9. [Pruebas de Rendimiento](#9-pruebas-de-rendimiento)
10. [Checklist de Validación Final](#10-checklist-de-validación-final)
11. [Escenarios de Prueba Recomendados](#11-escenarios-de-prueba-recomendados)
12. [Comandos curl para Pruebas Directas](#12-comandos-curl-para-pruebas-directas)

---

## 1. Pruebas Básicas de Conexión

### 1.1 Verificación de Endpoints

**Objetivo**: Confirmar que la conexión funciona correctamente sin errores.

**Pasos**:
1. Conecta tu sitio WordPress desde la interfaz
2. Verifica que no aparezcan errores en la consola del navegador (F12)
3. Confirma que el mensaje de conexión se muestre correctamente

**Resultado esperado**:
- ✅ Mensaje: "🔄 Site connected - Ready to use WordPress Abilities API!"
- ✅ Sin errores en consola
- ✅ El sitio aparece en la lista de sitios guardados

### 1.2 Endpoint de Test

**Objetivo**: Verificar que el endpoint de test responde correctamente.

**Comando curl**:
```bash
curl https://tu-sitio.com/wp-json/typingpress/v1/test
```

**Resultado esperado**:
```json
{
  "status": "ok",
  "message": "TypingPress plugin is active",
  "plugin_version": "2.0.0",
  "namespace": "typingpress/v1",
  "abilities_count": 8,
  "timestamp": "2025-01-01T12:00:00+00:00"
}
```

---

## 2. Pruebas de Abilities (8 disponibles)

### 2.1 Lectura (Read Operations)

#### A. `get_site_info`

**Pregunta de prueba**:
```
"Dame información sobre mi sitio"
```

**Resultado esperado**:
- URL del sitio
- Nombre del sitio
- Versión de WordPress
- Versión de PHP
- Tema activo
- Timezone
- Idioma

**Verificación**:
- ✅ Todos los campos están presentes
- ✅ Los datos son correctos
- ✅ El formato es legible

---

#### B. `list_plugins`

**Pregunta de prueba**:
```
"Lista los plugins instalados"
```

**Resultado esperado**:
- Lista completa de plugins
- Estado de cada plugin (activo/inactivo)
- Versión de cada plugin
- Nombre y slug de cada plugin

**Verificación**:
- ✅ Todos los plugins aparecen
- ✅ El estado es correcto
- ✅ La información es precisa

---

#### C. `list_themes`

**Pregunta de prueba**:
```
"¿Qué temas tengo instalados?"
```

**Resultado esperado**:
- Lista de temas instalados
- Tema activo claramente marcado
- Información básica de cada tema

**Verificación**:
- ✅ Todos los temas aparecen
- ✅ El tema activo está identificado
- ✅ La información es correcta

---

#### D. `get_plugin_info`

**Pregunta de prueba**:
```
"Dame información detallada del plugin [nombre-plugin]"
```

**Ejemplo**:
```
"Dame información detallada del plugin akismet"
```

**Resultado esperado**:
- Nombre completo del plugin
- Versión
- Descripción
- Autor
- Estado (activo/inactivo)
- Ruta del archivo

**Verificación**:
- ✅ La información es completa
- ✅ Los datos son precisos
- ✅ El plugin especificado es el correcto

---

#### E. `list_users`

**Pregunta de prueba**:
```
"Lista los usuarios del sitio"
```

**Resultado esperado**:
- Lista de usuarios
- Roles de cada usuario
- IDs de usuario
- Nombres de usuario

**Verificación**:
- ✅ Todos los usuarios aparecen
- ✅ Los roles son correctos
- ✅ La información es precisa

---

#### F. `get_user_info`

**Pregunta de prueba**:
```
"Dame información del usuario con ID 1"
```

**Resultado esperado**:
- Nombre de usuario
- Email
- Rol
- Fecha de registro
- Capacidades del usuario

**Verificación**:
- ✅ La información es completa
- ✅ Los datos son correctos
- ✅ El usuario especificado es el correcto

---

### 2.2 Escritura (Write Operations)

⚠️ **IMPORTANTE**: Usa un sitio de prueba o staging para estas pruebas.

#### G. `activate_plugin`

**Pregunta de prueba**:
```
"Activa el plugin [nombre-plugin]"
```

**Ejemplo**:
```
"Activa el plugin hello-dolly"
```

**Resultado esperado**:
- Confirmación de activación
- El plugin aparece como activo en WordPress
- Sin errores en la ejecución

**Verificación**:
- ✅ El plugin se activa correctamente
- ✅ Aparece en la lista de plugins activos
- ✅ No hay errores

---

#### H. `deactivate_plugin`

**Pregunta de prueba**:
```
"Desactiva el plugin [nombre-plugin]"
```

**Ejemplo**:
```
"Desactiva el plugin hello-dolly"
```

**Resultado esperado**:
- Confirmación de desactivación
- El plugin aparece como inactivo en WordPress
- Sin errores en la ejecución

**Verificación**:
- ✅ El plugin se desactiva correctamente
- ✅ Aparece en la lista de plugins inactivos
- ✅ No hay errores

---

## 3. Pruebas de Modo Simulación

### 3.1 Simulación de Acciones de Lectura

**Pregunta de prueba**:
```
"Simula obtener información del sitio"
```

**Resultado esperado**:
- La respuesta indica que es una simulación
- Muestra qué información se obtendría
- No ejecuta la acción real

**Verificación**:
- ✅ El modo simulación funciona
- ✅ La respuesta es clara sobre ser una simulación
- ✅ Los datos simulados son coherentes

---

### 3.2 Simulación de Acciones de Escritura

**Pregunta de prueba**:
```
"Simula activar el plugin [nombre]"
```

**Ejemplo**:
```
"Simula activar el plugin hello-dolly"
```

**Resultado esperado**:
- Muestra qué haría sin ejecutar
- Incluye reporte de impacto
- Explica los cambios que realizaría
- **NO modifica nada realmente**

**Verificación**:
- ✅ La simulación funciona correctamente
- ✅ El reporte de impacto es claro
- ✅ No se realizan cambios reales
- ✅ El plugin permanece en su estado original

---

## 4. Pruebas de Chat Conversacional

### 4.1 Conversación General

**Preguntas de prueba**:
```
"Hola, ¿cómo estás?"
"¿Qué puedes hacer?"
"Explícame cómo funciona WordPress"
```

**Resultado esperado**:
- Respuestas naturales y contextuales
- El asistente se presenta correctamente
- Las explicaciones son claras y útiles

**Verificación**:
- ✅ Las respuestas son coherentes
- ✅ El tono es apropiado
- ✅ La información es útil

---

### 4.2 Generación de Código

**Preguntas de prueba**:
```
"Dame código CSS para un menú horizontal"
"Genera un shortcode de WordPress"
"Crea una función PHP para custom post types"
```

**Resultado esperado**:
- Código bien formateado
- Código funcional y válido
- Syntax highlighting correcto
- Botón de copiar funciona

**Verificación**:
- ✅ El código es válido
- ✅ El formato es correcto
- ✅ El syntax highlighting funciona
- ✅ Se puede copiar fácilmente

---

### 4.3 Preguntas Técnicas

**Preguntas de prueba**:
```
"¿Cómo optimizo mi sitio WordPress?"
"¿Qué plugins recomiendas para SEO?"
"Explícame qué es un custom post type"
```

**Resultado esperado**:
- Respuestas técnicas y útiles
- Información precisa
- Explicaciones claras

**Verificación**:
- ✅ Las respuestas son técnicas
- ✅ La información es correcta
- ✅ Las explicaciones son claras

---

## 5. Pruebas de Integración con Gemini

### 5.1 Function Calling Automático

**Pregunta de prueba**:
```
"¿Cómo está mi sitio?"
```

**Resultado esperado**:
- Gemini llama automáticamente a `get_site_info`
- La respuesta incluye datos reales del sitio
- La integración funciona sin intervención manual

**Verificación**:
- ✅ Se ejecuta la ability automáticamente
- ✅ Los datos son reales y precisos
- ✅ La respuesta es coherente

---

### 5.2 Múltiples Abilities en una Conversación

**Pregunta de prueba**:
```
"Dame información del sitio y lista los plugins"
```

**Resultado esperado**:
- Se ejecutan múltiples abilities en secuencia
- La respuesta combina información de ambas
- La respuesta es coherente y completa

**Verificación**:
- ✅ Se ejecutan todas las abilities necesarias
- ✅ La respuesta combinada es coherente
- ✅ No hay errores en la ejecución

---

## 6. Pruebas de Seguridad y Permisos

### 6.1 Token Inválido

**Prueba**:
1. Intenta conectar con un token incorrecto
2. Intenta ejecutar una ability

**Resultado esperado**:
- Error de autenticación claro
- Mensaje explicativo
- No se ejecuta ninguna acción

**Verificación**:
- ✅ El error es claro
- ✅ El mensaje es útil
- ✅ No se ejecutan acciones no autorizadas

---

### 6.2 Acciones sin Permisos

**Prueba**:
1. Intenta ejecutar acciones que requieren permisos elevados
2. Usa un token con permisos limitados

**Resultado esperado**:
- Mensajes de error apropiados
- No se ejecutan acciones no permitidas
- Los mensajes explican qué permisos se necesitan

**Verificación**:
- ✅ Los errores son apropiados
- ✅ No se ejecutan acciones no permitidas
- ✅ Los mensajes son claros

---

## 7. Pruebas de Casos de Error

### 7.1 Plugin Inexistente

**Pregunta de prueba**:
```
"Activa el plugin plugin-que-no-existe"
```

**Resultado esperado**:
- Mensaje de error claro
- Explicación de qué salió mal
- Sugerencia de cómo corregirlo

**Verificación**:
- ✅ El error es claro
- ✅ El mensaje es útil
- ✅ No hay crashes

---

### 7.2 Usuario Inexistente

**Pregunta de prueba**:
```
"Dame información del usuario con ID 99999"
```

**Resultado esperado**:
- Manejo de error apropiado
- Mensaje claro sobre el usuario no encontrado
- No hay errores en la consola

**Verificación**:
- ✅ El error se maneja correctamente
- ✅ El mensaje es claro
- ✅ No hay errores técnicos

---

### 7.3 Sitio Desconectado

**Prueba**:
1. Desconecta el sitio
2. Intenta hacer una pregunta sobre WordPress

**Resultado esperado**:
- Mensaje indicando que no hay sitio conectado
- Sugerencia de conectar un sitio
- No se intenta ejecutar ninguna ability

**Verificación**:
- ✅ El mensaje es claro
- ✅ No se ejecutan acciones
- ✅ La UI es apropiada

---

## 8. Pruebas de UI/UX

### 8.1 Modal de Configuración

**Pruebas**:
1. Abre el modal de configuración
2. Cierra el modal
3. Agrega un nuevo sitio
4. Cambia entre sitios guardados
5. Elimina un sitio

**Resultado esperado**:
- Interfaz fluida y sin errores
- Los cambios se guardan correctamente
- La navegación es intuitiva

**Verificación**:
- ✅ El modal funciona correctamente
- ✅ Los cambios se persisten
- ✅ La navegación es fluida

---

### 8.2 Historial de Chat

**Pruebas**:
1. Realiza varias preguntas
2. Desplázate por el historial
3. Verifica el formato de los mensajes

**Resultado esperado**:
- El historial se mantiene
- El formato es correcto
- Los mensajes son legibles

**Verificación**:
- ✅ El historial funciona
- ✅ El formato es correcto
- ✅ La legibilidad es buena

---

### 8.3 Código en Respuestas

**Pruebas**:
1. Pide algo que genere código
2. Verifica el syntax highlighting
3. Prueba el botón de copiar

**Resultado esperado**:
- Código con syntax highlighting
- Botón de copiar funciona
- El código es legible

**Verificación**:
- ✅ El syntax highlighting funciona
- ✅ El botón de copiar funciona
- ✅ El código es legible

---

## 9. Pruebas de Rendimiento

### 9.1 Tiempo de Respuesta

**Pruebas**:
1. Ejecuta varias abilities
2. Mide el tiempo de respuesta
3. Verifica que sea aceptable

**Resultado esperado**:
- Respuestas en menos de 5 segundos (depende de la conexión)
- No hay timeouts
- La experiencia es fluida

**Verificación**:
- ✅ Los tiempos son aceptables
- ✅ No hay timeouts
- ✅ La experiencia es fluida

---

### 9.2 Múltiples Requests

**Pruebas**:
1. Realiza 5-10 preguntas seguidas
2. Verifica el rendimiento
3. Revisa la consola por errores

**Resultado esperado**:
- No hay degradación de rendimiento
- No hay errores en la consola
- La experiencia sigue siendo fluida

**Verificación**:
- ✅ No hay degradación
- ✅ No hay errores
- ✅ La experiencia es consistente

---

## 10. Checklist de Validación Final

Usa este checklist para asegurarte de que todo funciona correctamente:

### Conexión y Configuración
- [ ] Conexión al sitio funciona sin errores
- [ ] El token de autenticación funciona
- [ ] Los endpoints responden correctamente

### Abilities
- [ ] `get_site_info` funciona correctamente
- [ ] `list_plugins` funciona correctamente
- [ ] `list_themes` funciona correctamente
- [ ] `get_plugin_info` funciona correctamente
- [ ] `activate_plugin` funciona correctamente
- [ ] `deactivate_plugin` funciona correctamente
- [ ] `list_users` funciona correctamente
- [ ] `get_user_info` funciona correctamente

### Modo Simulación
- [ ] La simulación funciona para acciones de lectura
- [ ] La simulación funciona para acciones de escritura
- [ ] Los reportes de impacto son claros
- [ ] No se realizan cambios reales en modo simulación

### Chat y UI
- [ ] El chat conversacional funciona
- [ ] La generación de código funciona
- [ ] El syntax highlighting funciona
- [ ] El botón de copiar funciona
- [ ] El modal de configuración funciona
- [ ] El historial de chat funciona

### Integración
- [ ] Function calling automático funciona
- [ ] Múltiples abilities en una conversación funcionan
- [ ] La integración con Gemini es fluida

### Seguridad y Errores
- [ ] Los errores se manejan apropiadamente
- [ ] Los mensajes de error son claros
- [ ] La autenticación funciona correctamente
- [ ] Los permisos se respetan

### Rendimiento
- [ ] Los tiempos de respuesta son aceptables
- [ ] No hay degradación con múltiples requests
- [ ] No hay errores en la consola
- [ ] No hay errores en los logs del servidor

---

## 11. Escenarios de Prueba Recomendados

### Escenario 1: Usuario Nuevo Explorando

**Objetivo**: Verificar que un usuario nuevo puede usar la herramienta fácilmente.

**Pasos**:
1. Conecta el sitio
2. Pregunta: "¿Qué puedes hacer?"
3. Pregunta: "Dame información de mi sitio"
4. Pregunta: "Lista mis plugins"

**Resultado esperado**:
- El usuario entiende las capacidades
- Obtiene información útil
- La experiencia es positiva

---

### Escenario 2: Administrador Gestionando Plugins

**Objetivo**: Verificar la gestión completa de plugins.

**Pasos**:
1. Lista plugins instalados
2. Obtiene información de un plugin específico
3. Simula activar un plugin
4. Activa el plugin (si está seguro)
5. Verifica que se activó en WordPress

**Resultado esperado**:
- La gestión de plugins funciona correctamente
- La simulación es útil
- La activación es exitosa

---

### Escenario 3: Desarrollador Pidiendo Código

**Objetivo**: Verificar la generación de código.

**Pasos**:
1. Pide código CSS personalizado
2. Pide un shortcode de WordPress
3. Pide una función PHP
4. Verifica que el código es válido y útil

**Resultado esperado**:
- El código generado es válido
- El código es útil
- El formato es correcto

---

## 12. Comandos curl para Pruebas Directas

### Test Endpoint
```bash
curl https://tu-sitio.com/wp-json/typingpress/v1/test
```

### Discovery Endpoint (con token)
```bash
curl -H "X-Gemini-Auth: TU_TOKEN" \
  https://tu-sitio.com/wp-json/typingpress/v1/discovery?format=tools
```

### Execute Ability - Simulate
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Gemini-Auth: TU_TOKEN" \
  -d '{}' \
  https://tu-sitio.com/wp-json/typingpress/v1/abilities/get_site_info/execute?mode=simulate
```

### Execute Ability - Real
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Gemini-Auth: TU_TOKEN" \
  -d '{}' \
  https://tu-sitio.com/wp-json/typingpress/v1/abilities/get_site_info/execute
```

### List Plugins
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Gemini-Auth: TU_TOKEN" \
  -d '{}' \
  https://tu-sitio.com/wp-json/typingpress/v1/abilities/list_plugins/execute
```

---

## 📝 Notas Importantes

1. **Sitio de Prueba**: Usa un sitio de prueba o staging para acciones de escritura
2. **Logs**: Verifica los logs del servidor Node.js para errores
3. **Consola**: Revisa la consola del navegador (F12) durante las pruebas
4. **Navegadores**: Prueba en diferentes navegadores si es posible
5. **Documentación**: Documenta cualquier comportamiento inesperado

---

## 🐛 Reporte de Problemas

Si encuentras algún problema durante las pruebas:

1. **Captura de pantalla**: Toma una captura del error
2. **Consola**: Copia los errores de la consola del navegador
3. **Logs**: Revisa los logs del servidor Node.js
4. **Reproducción**: Documenta los pasos para reproducir el problema
5. **Contexto**: Incluye información sobre el entorno (navegador, versión, etc.)

---

**¡Buena suerte con las pruebas! 🚀**

