# 🤖 Gemini WP-Agent

**Asistente Conversacional Inteligente para WordPress con IA**

Gemini WP-Agent es una herramienta avanzada que combina la potencia de Google Gemini AI con WordPress, permitiendo gestionar sitios web a través de conversación natural y comandos inteligentes.

## ✨ Características Principales

### 🧠 **Inteligencia Artificial Avanzada**
- **Gemini 2.5 Flash**: Modelo más rápido y eficiente de Google
- **Análisis Contextual**: Distingue entre conversación y comandos automáticamente
- **Sistema de Respaldo**: Funciona incluso sin conexión a Gemini
- **Autodiagnóstico**: Detecta y resuelve problemas automáticamente

### 🔧 **Gestión WordPress Completa**
- **WP-CLI Integration**: Comandos completos de WordPress
- **Multi-sitio**: Gestiona múltiples sitios desde una interfaz
- **Seguridad**: Tokens seguros y conexiones encriptadas
- **Tiempo Real**: Respuestas instantáneas y ejecución inmediata

### 💬 **Interfaz Conversacional**
- **Chat Inteligente**: Habla naturalmente con tu WordPress
- **Comandos Mixtos**: Combina conversación y comandos técnicos
- **Historial Persistente**: Mantiene contexto de conversaciones
- **Responsive**: Funciona en desktop y móvil

### 🛠️ **Capacidades Técnicas**
- **Diagnóstico Automático**: Detecta problemas de rendimiento, seguridad y configuración
- **Generación de Código**: CSS, JavaScript, PHP personalizado
- **Gestión de Contenido**: Crea páginas y posts con bloques Gutenberg
- **Optimización**: Limpieza de base de datos y mejoras de rendimiento

## 🚀 Instalación Rápida

### **Requisitos Previos**
- Node.js 16+ 
- WordPress 5.0+
- Plugin Gemini WP-CLI Bridge instalado en WordPress

### **1. Clonar el Repositorio**
```bash
git clone https://github.com/tu-usuario/gemini-wp-agent.git
cd gemini-wp-agent
```

### **2. Instalar Dependencias**
```bash
npm install
```

### **3. Configurar Variables de Entorno**
```bash
cp web-app/.env.example web-app/.env
# Editar .env con tu API Key de Gemini (opcional)
```

### **4. Instalar Plugin WordPress**
1. Subir `wp-plugin/gemini-wp-cli.php` a `/wp-content/plugins/`
2. Activar el plugin desde el admin de WordPress
3. Copiar el token generado

### **5. Iniciar la Aplicación**
```bash
# Servidor backend
cd web-app
npm start

# Abrir frontend
# Navegar a public/index.html en tu navegador
```

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
Gemini: "¡Hola! Tu sitio está funcionando bien. WordPress 6.4, 15 plugins activos..."
```

**Comandos WordPress:**
```
Usuario: "Lista todos los plugins"
Gemini: Ejecuta wp plugin list y muestra resultados formateados
```

**Generación de Código:**
```
Usuario: "Dame CSS para un botón verde"
Gemini: Proporciona CSS personalizado listo para usar
```

**Resolución de Problemas:**
```
Usuario: "Mi sitio está lento"
Gemini: Ejecuta diagnóstico automático y sugiere optimizaciones
```

## 🏗️ Arquitectura del Proyecto

```
gemini-wp-agent/
├── public/                 # Frontend (HTML, CSS, JS)
│   ├── index.html         # Interfaz principal
│   ├── app.js            # Lógica del frontend
│   └── config.js         # Configuración del cliente
├── web-app/              # Backend Node.js
│   ├── server.js         # Servidor Express
│   ├── gemini-logic.js   # Integración con Gemini AI
│   └── .env             # Variables de entorno
├── wp-plugin/           # Plugin WordPress
│   └── gemini-wp-cli.php # Bridge WP-CLI
└── docs/               # Documentación
```

## 🔐 Seguridad

- **Tokens Únicos**: Cada sitio genera su propio token de seguridad
- **Validación de Comandos**: Todos los comandos son validados antes de ejecutarse
- **Conexiones Seguras**: HTTPS requerido para producción
- **Sin Almacenamiento de Credenciales**: No guardamos passwords de WordPress

## 🤝 Contribuir

1. Fork el repositorio
2. Crear rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -am 'Añadir nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crear Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🆘 Soporte

- **Issues**: [GitHub Issues](https://github.com/tu-usuario/gemini-wp-agent/issues)
- **Documentación**: [Wiki del Proyecto](https://github.com/tu-usuario/gemini-wp-agent/wiki)
- **Email**: tu-email@ejemplo.com

## 🎯 Roadmap

- [ ] Interfaz visual mejorada inspirada en TypingMind
- [ ] Soporte para más modelos de IA (Claude, GPT-4)
- [ ] Dashboard de analytics y métricas
- [ ] Integración con más herramientas de WordPress
- [ ] API REST para integraciones externas

---

**Desarrollado con ❤️ usando Gemini AI y WordPress**

*¿Tienes una idea para mejorar Gemini WP-Agent? ¡Nos encantaría escucharla!*