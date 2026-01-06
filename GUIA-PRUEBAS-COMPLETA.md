# 🧪 Guía Completa de Pruebas - Typingpress

## 📋 Preparación Inicial

### 1. 🧹 Limpieza de Cache del Navegador

**IMPORTANTE**: Antes de comenzar las pruebas, limpia completamente el cache:

#### Chrome/Edge:
1. Presiona `Ctrl + Shift + Delete` (Windows) o `Cmd + Shift + Delete` (Mac)
2. Selecciona "Todo el tiempo" en el rango de tiempo
3. Marca todas las opciones:
   - ✅ Historial de navegación
   - ✅ Historial de descargas
   - ✅ Cookies y otros datos de sitios
   - ✅ Imágenes y archivos almacenados en caché
   - ✅ Datos de aplicaciones alojadas
4. Haz clic en "Borrar datos"

#### Firefox:
1. Presiona `Ctrl + Shift + Delete`
2. Selecciona "Todo" en el rango de tiempo
3. Marca todas las opciones disponibles
4. Haz clic en "Limpiar ahora"

#### Alternativa - Modo Incógnito/Privado:
- Chrome: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`
- Edge: `Ctrl + Shift + N`

### 2. 🔧 Verificación del Entorno

Antes de comenzar, verifica que tienes:

- ✅ Node.js instalado (versión 14 o superior)
- ✅ Un sitio WordPress accesible
- ✅ Plugin Gemini WP-CLI instalado y activado
- ✅ Token de autenticación generado
- ✅ API Key de Gemini (opcional, para funciones avanzadas)

---

## 🚀 Fase 1: Inicio y Configuración

### Paso 1.1: Iniciar el Servidor
```bash
cd web-app
npm install
npm start
```

**Resultado esperado**: 
- Servidor iniciado en `http://localhost:3000`
- Mensaje: "Server running on port 3000"

### Paso 1.2: Abrir la Aplicación
1. Abre tu navegador (con cache limpio)
2. Navega a `http://localhost:3000`
3. Abre las herramientas de desarrollador (`F12`)
4. Ve a la pestaña "Console" para monitorear logs

**Resultado esperado**:
- ✅ Interfaz de Typingpress cargada
- ✅ Modal de configuración aparece automáticamente después de 2 segundos
- ✅ En console: "🔥 APP.JS v3.4 LOADED"

### Paso 1.3: Configurar Primer Sitio
1. **Nombre del sitio**: `Mi Sitio de Prueba`
2. **URL de WordPress**: `https://tu-sitio-wordpress.com`
3. **Token de autenticación**: `tu-token-generado`
4. **API Key de Gemini** (opcional): `tu-api-key`
5. Haz clic en "Guardar y Probar"

**Resultado esperado**:
- ✅ Mensaje: "Verificando API REST de WordPress..."
- ✅ Mensaje: "Probando autenticación..."
- ✅ Mensaje: "✅ Sitio añadido y configurado correctamente"
- ✅ Modal se cierra automáticamente
- ✅ Aparece mensaje de autodiagnóstico

---

## 🧪 Fase 2: Modo Sin Sitio Conectado (Stateless)

### Paso 2.1: Probar Chat Sin Sitio
1. Si tienes un sitio configurado, desconéctalo:
   - Haz clic en el selector de sitios (header)
   - Selecciona "Desconectar" en tu sitio
2. Escribe un mensaje: `Hola, ¿cómo estás?`

**Resultado esperado**:
- ✅ Indicador: "💬 Temporary Chat Mode"
- ✅ Respuesta conversacional de Gemini
- ✅ Mensaje: "No site connected • Stateless conversation"

### Paso 2.2: Probar Consulta WordPress Sin Sitio
Escribe: `¿Cómo optimizo mi WordPress?`

**Resultado esperado**:
- ✅ Respuesta de Gemini con consejos generales
- ✅ Sugerencia para conectar sitio: "💡 Tip: For WordPress-specific assistance..."

---

## 🔗 Fase 3: Conexión y Diagnóstico

### Paso 3.1: Conectar Sitio
1. Haz clic en el botón ⚙️ (configuración)
2. Configura tu sitio WordPress
3. Observa el proceso de autodiagnóstico

**Resultado esperado**:
- ✅ Mensaje: "🔍 Autodiagnosis in progress..."
- ✅ Detección automática de capacidades del servidor
- ✅ Activación de modo apropiado (WP-CLI Real o Emulation Mode)
- ✅ Indicador en header: "⚡ WP-CLI Real" o "🛡️ Emulation Mode"

### Paso 3.2: Verificar Información del Sitio
Observa la barra lateral derecha:

**Resultado esperado**:
- ✅ Información del sitio conectado
- ✅ Estado de la conexión
- ✅ Modo de operación
- ✅ Memoria de sesión inicializada

---

## 💬 Fase 4: Conversaciones y Memoria de Sesión

### Paso 4.1: Conversación Simple
Escribe: `Hola, ¿puedes ayudarme con mi sitio?`

**Resultado esperado**:
- ✅ Respuesta conversacional amigable
- ✅ Mensaje añadido a memoria de sesión
- ✅ Contador de memoria actualizado en sidebar

### Paso 4.2: Probar Memoria de Sesión
1. Escribe: `Mi sitio se llama "Ejemplo"`
2. Luego escribe: `¿Recuerdas el nombre de mi sitio?`

**Resultado esperado**:
- ✅ Gemini recuerda el nombre del sitio
- ✅ Respuesta coherente basada en contexto previo

### Paso 4.3: Limpiar Memoria
1. Haz clic en "🧠 Clear Memory" en la sidebar
2. Confirma la acción

**Resultado esperado**:
- ✅ Mensaje: "🧠 Session memory cleared"
- ✅ Contador de memoria reiniciado
- ✅ Contexto de conversación limpio

---

## 🔧 Fase 5: Abilities y Confirmaciones

### Paso 5.1: Solicitar Información del Sitio
Escribe: `¿Cómo está mi sitio?`

**Resultado esperado**:
- ✅ Gemini propone ejecutar: "Get Site Health Status"
- ✅ Aparece tarjeta de confirmación con 3 botones:
  - 🧪 Simulate First
  - ✅ Execute Directly  
  - ❌ Cancel

### Paso 5.2: Probar Simulación (Dry-Run)
1. Haz clic en "🧪 Simulate First"
2. Observa el resultado de la simulación

**Resultado esperado**:
- ✅ Mensaje: "🧪 Simulating..."
- ✅ Reporte completo de impacto:
  - 📊 Risk Level: READ (Safe)
  - 🎯 What will happen
  - 🔄 What will change: Nothing
  - 🛡️ What won't change
  - 📋 Resources affected
  - 🔄 Reversibility: Yes
- ✅ Nuevos botones: "🧪 Simulate Again", "✅ Execute Real Action", "❌ Cancel"

### Paso 5.3: Ejecutar Acción Real
1. Después de la simulación, haz clic en "✅ Execute Real Action"
2. Observa la ejecución

**Resultado esperado**:
- ✅ Mensaje: "Executing..."
- ✅ Resultado de la ejecución con información del sitio
- ✅ Mensaje: "✅ Action completed: gh_get_site_health"

### Paso 5.4: Probar Cancelación
1. Solicita otra acción: `Lista mis plugins`
2. Cuando aparezca la confirmación, haz clic en "❌ Cancel"

**Resultado esperado**:
- ✅ Mensaje: "❌ Action cancelled"
- ✅ Mensaje: "No action was executed on your WordPress site"
- ✅ Botones de confirmación ocultos

---

## 📝 Fase 6: Code Snippets

### Paso 6.1: Crear Snippet
1. Haz clic en "📝 Code Snippets" en la sidebar
2. Haz clic en "➕ Add Snippet"
3. Completa:
   - **Name**: `Custom CSS Menu`
   - **Type**: `CSS`
   - **Code**: 
   ```css
   .menu-item {
       background: #333;
       color: white;
       padding: 10px;
   }
   ```
4. Haz clic en "Save"

**Resultado esperado**:
- ✅ Snippet guardado en localStorage
- ✅ Aparece en la lista de snippets
- ✅ Contador actualizado

### Paso 6.2: Usar Snippet en Conversación
1. Haz clic en "📋 Use" junto al snippet creado
2. Observa cómo se inserta en el chat

**Resultado esperado**:
- ✅ Código insertado en el área de mensaje
- ✅ Mensaje automático: "Using code snippet: Custom CSS Menu"

### Paso 6.3: Eliminar Snippet
1. Haz clic en "🗑️ Delete" junto al snippet
2. Confirma la eliminación

**Resultado esperado**:
- ✅ Snippet eliminado
- ✅ Lista actualizada
- ✅ Contador decrementado

---

## 🤖 Fase 7: Sistema de Políticas (Avanzado)

### Paso 7.1: Activar Políticas
Escribe: `Mi sitio está lento y tengo problemas de seguridad`

**Resultado esperado**:
- ✅ Respuesta conversacional de Gemini
- ✅ Posible aparición de sugerencias de políticas
- ✅ Recomendaciones proactivas basadas en el contexto

### Paso 7.2: Seguir Recomendaciones
Si aparecen sugerencias de políticas:
1. Observa las recomendaciones categorizadas
2. Sigue las sugerencias de simulación
3. Ejecuta acciones recomendadas

**Resultado esperado**:
- ✅ Políticas activadas según el contexto
- ✅ Sugerencias específicas y accionables
- ✅ Flujo guiado de resolución de problemas

---

## 🔍 Fase 8: Pruebas de Error y Recuperación

### Paso 8.1: Probar Sin Conexión a Internet
1. Desconecta tu internet
2. Intenta enviar un mensaje

**Resultado esperado**:
- ✅ Mensaje de error claro
- ✅ Sugerencia de verificar conexión
- ✅ Interfaz sigue funcional

### Paso 8.2: Probar con Token Inválido
1. Ve a configuración
2. Cambia el token por uno inválido
3. Intenta ejecutar una acción

**Resultado esperado**:
- ✅ Error de autenticación claro
- ✅ Sugerencia de verificar token
- ✅ No se ejecuta ninguna acción

### Paso 8.3: Probar con Sitio Inaccesible
1. Cambia la URL del sitio por una inválida
2. Intenta conectar

**Resultado esperado**:
- ✅ Error de conexión específico
- ✅ Sugerencias de solución
- ✅ Activación automática de modo seguro

---

## 📊 Fase 9: Monitoreo y Logs

### Paso 9.1: Verificar Logs del Navegador
1. Abre herramientas de desarrollador (`F12`)
2. Ve a la pestaña "Console"
3. Ejecuta algunas acciones

**Resultado esperado**:
- ✅ Logs estructurados y claros
- ✅ Información de debug útil
- ✅ Sin errores críticos en console

### Paso 9.2: Verificar Logs del Servidor
1. Observa la terminal donde corre el servidor
2. Ejecuta acciones en la interfaz

**Resultado esperado**:
- ✅ Logs de requests y responses
- ✅ Información de procesamiento de Gemini
- ✅ Manejo adecuado de errores

### Paso 9.3: Verificar Auditoría en WordPress
1. Ve a tu WordPress Admin
2. Navega a Settings → Gemini Token
3. Revisa los logs de auditoría

**Resultado esperado**:
- ✅ Todas las acciones registradas
- ✅ Información completa de cada ejecución
- ✅ Estados claros (success, error, permission_denied)

---

## ✅ Checklist Final de Validación

### Funcionalidad Core
- [ ] ✅ Aplicación carga correctamente
- [ ] ✅ Modal de configuración aparece automáticamente
- [ ] ✅ Conexión a WordPress funciona
- [ ] ✅ Autodiagnóstico detecta capacidades
- [ ] ✅ Chat conversacional funciona
- [ ] ✅ Modo sin sitio conectado funciona

### Seguridad y Confirmaciones
- [ ] ✅ Ninguna acción se ejecuta automáticamente
- [ ] ✅ Todas las acciones requieren confirmación explícita
- [ ] ✅ Simulación disponible para todas las acciones
- [ ] ✅ Explicaciones claras y comprensibles
- [ ] ✅ Cancelación siempre disponible

### Características Avanzadas
- [ ] ✅ Memoria de sesión funciona correctamente
- [ ] ✅ Code snippets se guardan y usan correctamente
- [ ] ✅ Sistema de políticas responde al contexto
- [ ] ✅ Manejo de errores es robusto
- [ ] ✅ Logs y auditoría funcionan

### Experiencia de Usuario
- [ ] ✅ Interfaz es intuitiva y clara
- [ ] ✅ Feedback visual apropiado
- [ ] ✅ Tiempos de respuesta aceptables
- [ ] ✅ Mensajes de error son útiles
- [ ] ✅ Navegación es fluida

---

## 🚨 Problemas Comunes y Soluciones

### Problema: Modal no aparece
**Solución**: 
- Limpia cache del navegador completamente
- Verifica que no hay errores en console
- Recarga la página

### Problema: "Plugin not found"
**Solución**:
- Verifica que el plugin está instalado y activado
- Comprueba que la URL de WordPress es correcta
- Asegúrate de que el sitio es accesible

### Problema: Token inválido
**Solución**:
- Ve a WordPress Admin → Settings → Gemini Token
- Regenera el token
- Copia el nuevo token exactamente

### Problema: Gemini no responde
**Solución**:
- Verifica tu API Key de Gemini
- Comprueba conexión a internet
- Revisa logs del servidor para errores específicos

### Problema: Simulación falla
**Solución**:
- Verifica permisos del token
- Comprueba que el plugin está actualizado
- Revisa logs de auditoría en WordPress

---

## 🎯 Criterios de Éxito

La aplicación está lista para demo/producción cuando:

1. **✅ Todas las fases de prueba pasan sin errores críticos**
2. **✅ Las confirmaciones funcionan en el 100% de los casos**
3. **✅ La simulación está disponible para todas las acciones**
4. **✅ Los mensajes de error son claros y accionables**
5. **✅ La auditoría registra todas las operaciones**
6. **✅ La interfaz es estable bajo diferentes condiciones**

---

**🎉 ¡Felicidades! Si todas las pruebas pasan, Typingpress está listo para demostración con confianza total.**

---

*Fecha de creación: 6 de enero de 2026*  
*Versión: 1.0 - Guía Completa de Pruebas*  
*Estado: Listo para Demo*