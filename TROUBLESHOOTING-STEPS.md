# 🔧 Pasos de Troubleshooting

## 🎯 Problema: Los cambios no se ven en la webapp

### ✅ Paso 1: Limpiar Caché del Navegador

**Opción A - Recarga Forzada:**
- **Chrome/Edge:** `Ctrl+Shift+R` (Windows) o `Cmd+Shift+R` (Mac)
- **Firefox:** `Ctrl+F5` (Windows) o `Cmd+Shift+R` (Mac)

**Opción B - Modo Incógnito:**
- Abre la webapp en una ventana de incógnito/privada
- Esto evita completamente la caché

**Opción C - Limpiar Caché Manualmente:**
1. F12 → Network tab
2. Click derecho → "Clear browser cache"
3. Recarga la página

### ✅ Paso 2: Verificar que los Archivos se Actualizaron

He añadido `?v=2.0` a los scripts para forzar la recarga:
```html
<script src="config.js?v=2.0"></script>
<script src="app.js?v=2.0"></script>
```

### ✅ Paso 3: Verificar Logs de Debug

Abre la consola (F12) y busca estos logs cuando uses la webapp:

**Al cargar la página:**
```
📋 CONFIG cargado: ✅
🔧 CONFIG: Object
🚀 Inicializando Gemini WP-CLI Terminal...
✅ Aplicación inicializada correctamente
```

**Al enviar un mensaje del asistente:**
```
🔍 addMessage llamado: {type: "assistant", contentLength: 123}
🎨 Aplicando renderizado Markdown...
🔧 renderMarkdown iniciado, contenido: # Mi título...
🔍 Bloques de código encontrados: 1
🎨 Procesando bloque de código: {lang: "php", displayName: "PHP", codeLength: 45}
✅ Renderizado completado, longitud final: 567
✅ Markdown renderizado, longitud: 567
```

### ✅ Paso 4: Prueba Directa en Consola

Pega este código en la consola de la webapp:

```javascript
// Verificar que todo esté cargado
console.log('Marked.js:', typeof marked !== 'undefined' ? '✅' : '❌');
console.log('Highlight.js:', typeof hljs !== 'undefined' ? '✅' : '❌');
console.log('GeminiWPCLI:', typeof window.geminiApp !== 'undefined' ? '✅' : '❌');

// Probar renderizado directo
if (window.geminiApp && window.geminiApp.renderMarkdown) {
    const testContent = `# Test de Renderizado

Aquí tienes un ejemplo de **código PHP**:

\`\`\`php
<?php
function mi_shortcode() {
    return '<div>¡Hola WordPress!</div>';
}
add_shortcode('mi_shortcode', 'mi_shortcode');
?>
\`\`\`

Y también código \`inline\` que debería verse diferente.`;

    console.log('🧪 Probando renderMarkdown directamente...');
    const result = window.geminiApp.renderMarkdown(testContent);
    console.log('📄 Resultado:', result);
    
    // Añadir el mensaje directamente
    window.geminiApp.addMessage('assistant', testContent);
} else {
    console.error('❌ window.geminiApp o renderMarkdown no están disponibles');
}
```

### ✅ Paso 5: Diagnóstico por Síntomas

**Si NO ves los logs de debug:**
- ❌ El archivo `app.js` no se está cargando
- ❌ Hay un error de JavaScript que impide la ejecución
- ❌ La caché del navegador sigue activa
- **Solución:** Recarga forzada o modo incógnito

**Si VES los logs pero NO el formato visual:**
- ❌ Los estilos CSS no se están aplicando
- ❌ Hay conflictos de CSS
- ❌ Las librerías externas (marked.js, highlight.js) no cargan
- **Solución:** Verificar conexión a internet y CDN

**Si VES el formato pero NO funciona el botón copiar:**
- ❌ La función `copyCodeToClipboard` no está definida
- ❌ Error en la función de copia
- **Solución:** Verificar que la función esté al final de `app.js`

### ✅ Paso 6: Verificar Archivos Específicos

**Verificar que `public/index.html` tenga:**
```html
<!-- Librerías Markdown -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/11.1.1/marked.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>

<!-- Scripts con versión para evitar caché -->
<script src="config.js?v=2.0"></script>
<script src="app.js?v=2.0"></script>
```

**Verificar que `public/app.js` tenga:**
- ✅ `this.renderMarkdown(content)` en la función `addMessage`
- ✅ Función `renderMarkdown(content)` definida
- ✅ Función `copyCodeToClipboard` al final del archivo

### ✅ Paso 7: Test de Emergencia

Si nada funciona, usa este HTML temporal que incluye todo inline:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Test Emergencia</title>
    <style>
        .code-block { background: #0d1117; border: 1px solid #30363d; border-radius: 8px; margin: 16px 0; overflow: hidden; }
        .code-header { background: #161b22; padding: 12px 16px; display: flex; justify-content: space-between; border-bottom: 1px solid #30363d; }
        .code-language { color: #8b949e; font-weight: 600; }
        .copy-button { background: transparent; color: #8b949e; border: 1px solid #30363d; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
        .code-content { padding: 16px; background: #0d1117; color: #f8f8f2; font-family: monospace; }
    </style>
</head>
<body>
    <div id="test"></div>
    <script>
        const testContent = `# Test\n\n\`\`\`php\n<?php echo "test"; ?>\n\`\`\``;
        const rendered = testContent.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
            return `<div class="code-block"><div class="code-header"><span class="code-language">${lang}</span><button class="copy-button">Copiar</button></div><pre class="code-content">${code.trim()}</pre></div>`;
        });
        document.getElementById('test').innerHTML = rendered;
    </script>
</body>
</html>
```

### 🎯 Resultado Esperado

Después de seguir estos pasos, deberías ver:
- ✅ Logs de debug en la consola
- ✅ Bloques de código con header tipo ChatGPT
- ✅ Botón de copiar funcional
- ✅ Syntax highlighting (si las librerías cargan)

### 📞 Si Aún No Funciona

Comparte conmigo:
1. **Logs de la consola** (screenshot o texto)
2. **Resultado del test directo** en la consola
3. **Navegador y versión** que estás usando
4. **Si los archivos de prueba funcionan** correctamente

Esto me ayudará a identificar exactamente dónde está el problema.