# 🤖 TypingPress

**Asistente Conversacional Inteligente para WordPress con IA**

TypingPress es una herramienta avanzada que combina la potencia de Google Gemini AI con WordPress, permitiendo gestionar sitios web a través de conversación natural utilizando la **WordPress Abilities API** con sistema de permisos, auditoría y simulación.

## ✨ Características Principales

### 🧠 **Inteligencia Artificial Avanzada**
- **Gemini 2.5 Flash**: Modelo más rápido y eficiente de Google
- **Function Calling Automático**: Gemini detecta y ejecuta acciones de WordPress automáticamente
- **Análisis Contextual**: Distingue entre conversación y comandos automáticamente
- **Chat sin Conexión**: Funciona en modo conversacional incluso sin sitio WordPress conectado

### 🔧 **WordPress Abilities API**
- **8 Abilities Disponibles**: Sistema de acciones reales (no emulación WP-CLI)
  - `get_site_info` - Información del sitio
  - `list_plugins` - Listar plugins
  - `list_themes` - Listar temas
  - `get_plugin_info` - Información de plugin específico
  - `activate_plugin` - Activar plugin
  - `deactivate_plugin` - Desactivar plugin
  - `list_users` - Listar usuarios
  - `get_user_info` - Información de usuario específico
- **Modo Simulación**: Prueba acciones antes de ejecutarlas realmente
- **Reportes de Impacto**: Análisis detallado de qué cambiará cada acción
- **Sistema de Permisos**: Control de acceso basado en capacidades de WordPress

### 💬 **Interfaz Conversacional**
- **Chat Inteligente**: Habla naturalmente con tu WordPress
- **Multi-sitio**: Gestiona múltiples sitios desde una interfaz
- **Historial Persistente**: Mantiene contexto de conversaciones
- **Responsive**: Funciona en desktop y móvil
- **Syntax Highlighting**: Código formateado con resaltado de sintaxis

### 🛠️ **Capacidades Técnicas**
- **Generación de Código**: CSS, JavaScript, PHP personalizado
- **Seguridad**: Tokens seguros y validación de permisos
- **Auditoría**: Registro de todas las acciones ejecutadas
- **Tiempo Real**: Respuestas instantáneas y ejecución inmediata

## 🚀 Instalación Rápida

### **Requisitos Previos**
- Node.js 14+ 
- WordPress 5.0+
- Plugin TypingPress instalado en WordPress

### **1. Clonar el Repositorio**
```bash
git clone https://github.com/tu-usuario/typingpress.git
cd typingpress
```

### **2. Instalar Dependencias**
```bash
cd web-app
npm install
```

### **3. Configurar Variables de Entorno (Opcional)**
```bash
# Crear archivo .env en web-app/
GEMINI_API_KEY=tu_api_key_aqui
PORT=3001
```

**Nota**: La API Key de Gemini es opcional. Si no se proporciona, algunas funcionalidades avanzadas estarán limitadas, pero el chat básico funcionará.

### **4. Instalar Plugin WordPress**
1. Subir `wp-plugin/gemini-wp-cli.php` a `/wp-content/plugins/typingpress/`
2. Activar el plugin desde el admin de WordPress
3. Ir a **Configuración → Typingpress API Token**
4. Copiar el token generado

### **5. Iniciar la Aplicación**
```bash
# Desde la carpeta web-app
npm start

# O en modo desarrollo con auto-reload
npm run dev
```

### **6. Abrir la Aplicación**
Abre `public/index.html` en tu navegador o sirve los archivos estáticos desde un servidor web.

## 📖 Uso Básico

### **Configuración Inicial**
1. Abrir la aplicación en el navegador
2. Hacer clic en ⚙️ para configurar
3. Añadir URL de WordPress y token del plugin
4. ¡Listo para usar!

### **Ejemplos de Uso**

**Conversación Natural:**
```
Usuario: "Hola, ¿cómo está mi sitio?"
TypingPress: "¡Hola! Tu sitio está funcionando bien. WordPress 6.4, 15 plugins activos..."
```

**Acciones de WordPress (Automáticas):**
```
Usuario: "Lista todos los plugins"
TypingPress: [Ejecuta automáticamente list_plugins y muestra resultados]
```

**Modo Simulación:**
```
Usuario: "Simula activar el plugin hello-dolly"
TypingPress: [Muestra qué haría sin ejecutar, con reporte de impacto]
```

**Generación de Código:**
```
Usuario: "Dame CSS para un botón verde"
TypingPress: [Proporciona CSS personalizado listo para usar]
```

## 🏗️ Arquitectura del Proyecto

```
typingpress/
├── public/                 # Frontend (HTML, CSS, JS)
│   ├── index.html         # Interfaz principal
│   ├── app.js            # Lógica del frontend
│   └── config.js         # Configuración del cliente
├── web-app/              # Backend Node.js
│   ├── server.js         # Servidor Express
│   ├── gemini-logic.js   # Integración con Gemini AI
│   ├── package.json      # Dependencias Node.js
│   └── .env             # Variables de entorno (opcional)
├── wp-plugin/           # Plugin WordPress
│   └── gemini-wp-cli.php # WordPress Abilities API Bridge
├── README.md            # Este archivo
├── SETUP.md             # Guía detallada de instalación
├── TESTING.md           # Guía completa de pruebas
└── LICENSE              # Licencia MIT
```

## 🔐 Seguridad

- **Tokens Únicos**: Cada sitio genera su propio token de seguridad
- **Validación de Permisos**: Todas las acciones validan permisos antes de ejecutarse
- **Modo Simulación**: Prueba acciones sin riesgo antes de ejecutarlas
- **Auditoría**: Registro completo de todas las acciones ejecutadas
- **Sin Almacenamiento de Credenciales**: No guardamos passwords de WordPress
- **HTTPS Recomendado**: Para producción, usa conexiones seguras

## 📚 Documentación

- **[SETUP.md](SETUP.md)**: Guía detallada de instalación y configuración
- **[TESTING.md](TESTING.md)**: Guía completa de pruebas y validación
- **API Endpoints**: 
  - `/wp-json/typingpress/v1/discovery` - Descubrir abilities disponibles
  - `/wp-json/typingpress/v1/test` - Verificar que el plugin está activo
  - `/wp-json/typingpress/v1/abilities/{ability}/execute` - Ejecutar ability

## 🧪 Pruebas

Para una guía completa de pruebas, consulta [TESTING.md](TESTING.md).

**Prueba rápida del plugin:**
```bash
curl https://tu-sitio.com/wp-json/typingpress/v1/test
```

## 🔄 WordPress Abilities API

TypingPress utiliza la **WordPress Abilities API** en lugar de emular comandos WP-CLI. Esto proporciona:

- ✅ **Acciones Reales**: No emulación, acciones nativas de WordPress
- ✅ **Sistema de Permisos**: Control granular de acceso
- ✅ **Modo Simulación**: Prueba antes de ejecutar
- ✅ **Auditoría Completa**: Registro de todas las acciones
- ✅ **Extensibilidad**: Fácil agregar nuevas abilities

### Abilities Disponibles

| Ability | Tipo | Descripción |
|---------|------|-------------|
| `get_site_info` | Read | Información básica del sitio |
| `list_plugins` | Read | Lista de plugins instalados |
| `list_themes` | Read | Lista de temas instalados |
| `get_plugin_info` | Read | Información detallada de un plugin |
| `activate_plugin` | Write | Activar un plugin |
| `deactivate_plugin` | Write | Desactivar un plugin |
| `list_users` | Read | Lista de usuarios |
| `get_user_info` | Read | Información de un usuario |

## 🤝 Contribuir

1. Fork el repositorio
2. Crear rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -am 'Añadir nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crear Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🆘 Soporte

- **Issues**: [GitHub Issues](https://github.com/tu-usuario/typingpress/issues)
- **Documentación**: Consulta `SETUP.md` y `TESTING.md`
- **Problemas**: Revisa los logs del servidor Node.js y la consola del navegador

## 🎯 Roadmap

- [x] WordPress Abilities API (v2.0)
- [x] Modo Simulación
- [x] Sistema de Permisos
- [x] Auditoría de Acciones
- [ ] Más Abilities (gestión de posts, páginas, etc.)
- [ ] Interfaz visual mejorada
- [ ] Dashboard de analytics
- [ ] Integración con más herramientas de WordPress
- [ ] API REST para integraciones externas

## 🆕 Changelog

### v2.0.0 (Actual)
- ✅ Migración a WordPress Abilities API
- ✅ Modo simulación implementado
- ✅ Sistema de permisos y auditoría
- ✅ 8 abilities disponibles
- ✅ Mejoras en la integración con Gemini

### v1.0.0
- Versión inicial con emulación WP-CLI

---

**Desarrollado con ❤️ usando Gemini AI y WordPress**

*¿Tienes una idea para mejorar TypingPress? ¡Nos encantaría escucharla!*
