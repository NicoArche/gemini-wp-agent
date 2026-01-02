// 🚀 VERSIÓN 3.4 - DETECCIÓN DE CÓDIGO SIN TRIPLE BACKTICKS IMPLEMENTADA
console.log('🔥 APP.JS v3.4 CARGADO - DETECTA CÓDIGO GEMINI SIN BACKTICKS 🔥');

class GeminiWPCLI {
    constructor() {
        console.log('🔧 Inicializando constructor...');
        
        // Verificar elementos del DOM
        this.chatArea = document.getElementById('chatArea');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.configButton = document.getElementById('configButton');
        this.configModal = document.getElementById('configModal');
        this.configForm = document.getElementById('configForm');
        this.configCloseButton = document.getElementById('configCloseButton');
        this.configCancelButton = document.getElementById('configCancelButton');
        this.activeSiteSelect = document.getElementById('activeSiteSelect');
        this.savedSitesList = document.getElementById('savedSitesList');
        
        // Debug: verificar que todos los elementos existen
        const elements = {
            chatArea: this.chatArea,
            messageInput: this.messageInput,
            sendButton: this.sendButton,
            configButton: this.configButton,
            configModal: this.configModal,
            configForm: this.configForm,
            configCloseButton: this.configCloseButton,
            configCancelButton: this.configCancelButton,
            activeSiteSelect: this.activeSiteSelect,
            savedSitesList: this.savedSitesList
        };
        
        console.log('🔍 Elementos del DOM:', elements);
        
        // Verificar elementos críticos
        const missingElements = [];
        Object.entries(elements).forEach(([name, element]) => {
            if (!element) {
                missingElements.push(name);
            }
        });
        
        if (missingElements.length > 0) {
            console.error('❌ Elementos faltantes:', missingElements);
            throw new Error(`Elementos del DOM faltantes: ${missingElements.join(', ')}`);
        }
        
        console.log('✅ Todos los elementos del DOM encontrados');
        
        // Usar configuración base
        this.config = CONFIG;
        console.log('📋 Configuración cargada:', this.config);
        
        // Configuración actual del sitio activo
        this.currentSite = null;
        
        // Estado del servidor y capacidades
        this.serverCapabilities = null;
        this.emulationMode = false;
        
        // 🧠 Memoria a corto plazo: últimos 5 mensajes
        this.chatHistory = [];
        
        // 🔑 API Key global de Gemini (nueva funcionalidad)
        this.globalGeminiApiKey = this.loadGlobalGeminiApiKey();
        
        // Cargar sitios guardados
        console.log('💾 Cargando sitios guardados...');
        this.loadSavedSites();
        
        console.log('🎧 Inicializando event listeners...');
        this.initializeEventListeners();
        
        console.log('📏 Configurando textarea...');
        this.autoResizeTextarea();
        
        console.log('🌐 Verificando conexión del servidor...');
        this.checkServerConnection();
        
        console.log('🎉 Constructor completado exitosamente');
    }

    // 🔑 Gestión de API Key global de Gemini
    loadGlobalGeminiApiKey() {
        try {
            const apiKey = localStorage.getItem('gemini_global_api_key');
            console.log('🔑 API Key global cargada:', apiKey ? 'Sí (oculta por seguridad)' : 'No');
            return apiKey || '';
        } catch (error) {
            console.error('❌ Error cargando API Key global:', error);
            return '';
        }
    }

    saveGlobalGeminiApiKey(apiKey) {
        try {
            if (apiKey && apiKey.trim()) {
                localStorage.setItem('gemini_global_api_key', apiKey.trim());
                console.log('✅ API Key global guardada');
            } else {
                localStorage.removeItem('gemini_global_api_key');
                console.log('🗑️ API Key global eliminada');
            }
            this.globalGeminiApiKey = apiKey.trim();
        } catch (error) {
            console.error('❌ Error guardando API Key global:', error);
        }
    }

    hasGlobalGeminiApiKey() {
        return this.globalGeminiApiKey && this.globalGeminiApiKey.length > 0;
    }

    // 🧠 Gestión de memoria a corto plazo
    addToHistory(role, message, geminiResponse = null) {
        const historyEntry = {
            role: role, // 'user' o 'assistant'
            message: message,
            timestamp: new Date().toISOString()
        };
        
        // Si es respuesta de Gemini, añadir datos estructurados
        if (role === 'assistant' && geminiResponse) {
            historyEntry.gemini_data = {
                command: geminiResponse.command,
                explanation: geminiResponse.explanation,
                is_safe: geminiResponse.is_safe
            };
        }
        
        this.chatHistory.push(historyEntry);
        
        // Mantener solo los últimos 5 mensajes
        if (this.chatHistory.length > 5) {
            this.chatHistory.shift();
        }
        
        console.log('🧠 Historial actualizado:', this.chatHistory.length, 'mensajes');
    }

    getFormattedHistory() {
        return this.chatHistory.map(entry => {
            if (entry.role === 'user') {
                return `Usuario: ${entry.message}`;
            } else {
                // Para respuestas de Gemini, incluir el comando si está disponible
                if (entry.gemini_data) {
                    return `Gemini: ${entry.gemini_data.explanation} (Comando: ${entry.gemini_data.command})`;
                } else {
                    return `Gemini: ${entry.message}`;
                }
            }
        }).join('\n');
    }

    clearHistory() {
        this.chatHistory = [];
        console.log('🧠 Historial de chat limpiado');
        
        // Mostrar mensaje de confirmación al usuario
        this.addMessage('assistant', 
            `<strong>🧠 Memoria limpiada</strong><br><br>
            El historial de conversación ha sido reiniciado. Gemini AI empezará una nueva conversación sin contexto previo.`
        );
    }

    async performAutodiagnosis() {
        if (!this.currentSite) {
            console.log('⏭️ Saltando autodiagnóstico: no hay sitio configurado');
            return;
        }

        console.log('🔍 Iniciando autodiagnóstico del servidor WordPress...');
        
        try {
            // Mostrar mensaje de diagnóstico
            this.addMessage('assistant', 
                `<strong>🔍 Autodiagnóstico en progreso...</strong><br><br>
                Analizando las capacidades de tu servidor WordPress para optimizar la experiencia.`
            );

            // Llamar al endpoint de server-info
            const serverInfo = await this.getServerInfo();
            
            if (serverInfo && serverInfo.wp_cli) {
                this.serverCapabilities = serverInfo;
                this.emulationMode = !serverInfo.wp_cli.available;
                
                console.log('📊 Capacidades del servidor:', serverInfo);
                console.log('🔧 Modo emulación:', this.emulationMode ? 'ACTIVADO' : 'DESACTIVADO');
                
                // Mostrar mensaje según las capacidades detectadas
                if (this.emulationMode) {
                    this.addMessage('assistant', 
                        `<strong>🤖 Autodiagnóstico completado</strong><br><br>
                        He detectado que tu hosting es restrictivo y no tiene WP-CLI instalado.<br><br>
                        <strong>✅ Activando Modo de Emulación Nativa</strong><br>
                        • Máxima compatibilidad con hostings restrictivos<br>
                        • Usa la API nativa de WordPress<br>
                        • Funcionalidad completa garantizada<br><br>
                        <em>🛡️ Tu sitio está listo para usar con total seguridad.</em>`
                    );
                } else {
                    this.addMessage('assistant', 
                        `<strong>🚀 Autodiagnóstico completado</strong><br><br>
                        ¡Excelente! Tu servidor tiene WP-CLI instalado y funciones de ejecución disponibles.<br><br>
                        <strong>✅ Modo de Alto Rendimiento Activado</strong><br>
                        • WP-CLI real: <span style="color: #00ff88;">${serverInfo.wp_cli.version}</span><br>
                        • Método: <span style="color: #00ff88;">${serverInfo.wp_cli.method}</span><br>
                        • Funciones disponibles: <span style="color: #00ff88;">${this.getAvailableFunctions(serverInfo)}</span><br><br>
                        <em>⚡ Rendimiento óptimo garantizado.</em>`
                    );
                }
                
                // Actualizar el estado en la interfaz
                this.updateServerStatusIndicator();
                
            } else {
                throw new Error('No se pudo obtener información del servidor');
            }
            
        } catch (error) {
            console.error('❌ Error en autodiagnóstico:', error);
            this.emulationMode = true; // Activar modo seguro por defecto
            
            this.addMessage('assistant', 
                `<strong>⚠️ Autodiagnóstico con advertencias</strong><br><br>
                No pude conectar completamente con tu servidor, pero no te preocupes.<br><br>
                <strong>🛡️ Activando Modo Seguro</strong><br>
                • Compatibilidad máxima activada<br>
                • Funcionalidad básica garantizada<br>
                • Todos los comandos seguros disponibles<br><br>
                <em>Error: ${error.message}</em>`
            );
        }
    }

    getAvailableFunctions(serverInfo) {
        const capabilities = serverInfo.execution_capabilities || {};
        const available = Object.entries(capabilities)
            .filter(([func, isAvailable]) => isAvailable)
            .map(([func]) => func);
        
        return available.length > 0 ? available.join(', ') : 'API nativa';
    }

    updateServerStatusIndicator() {
        // Añadir indicador visual en el header
        const header = document.querySelector('.terminal-header');
        const existingIndicator = header.querySelector('.server-status');
        
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        const indicator = document.createElement('div');
        indicator.className = 'server-status';
        indicator.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #888;
            margin-left: 15px;
        `;
        
        if (this.emulationMode) {
            indicator.innerHTML = `
                <span style="color: #ffbd2e;">🛡️</span>
                <span>Modo Emulación</span>
            `;
        } else {
            indicator.innerHTML = `
                <span style="color: #27ca3f;">⚡</span>
                <span>WP-CLI Real</span>
            `;
        }
        
        const title = header.querySelector('.terminal-title');
        title.parentNode.insertBefore(indicator, title.nextSibling);
    }

    loadSavedSites() {
        console.log('💾 Iniciando carga de sitios guardados...');
        
        try {
            const savedData = localStorage.getItem('gemini-wp-cli-sites');
            const now = new Date().getTime();
            
            if (savedData) {
                console.log('📄 Datos encontrados en localStorage');
                const sitesData = JSON.parse(savedData);
                
                // Filtrar sitios que no han expirado (30 días)
                this.savedSites = sitesData.sites.filter(site => {
                    const siteAge = now - new Date(site.savedAt).getTime();
                    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
                    return siteAge < thirtyDays;
                });
                
                // Cargar sitio activo
                const activeSiteId = sitesData.activeSiteId;
                this.currentSite = this.savedSites.find(site => site.id === activeSiteId) || null;
                
                console.log(`✅ Cargados ${this.savedSites.length} sitios desde localStorage`);
                
            } else {
                console.log('📄 No hay datos guardados, inicializando arrays vacíos');
                this.savedSites = [];
                this.currentSite = null;
            }
            
            // Si no hay sitios o el activo expiró, mostrar modal después de un tiempo
            if (this.savedSites.length === 0 || !this.currentSite) {
                console.log('⏰ Programando mostrar modal de configuración en 2 segundos...');
                setTimeout(() => {
                    console.log('⏰ Ejecutando mostrar modal programado...');
                    this.showConfigModal();
                }, 2000);
            }
            
        } catch (error) {
            console.warn('⚠️ Error al cargar sitios guardados:', error);
            this.savedSites = [];
            this.currentSite = null;
            
            console.log('⏰ Programando mostrar modal por error en 2 segundos...');
            setTimeout(() => {
                console.log('⏰ Ejecutando mostrar modal por error...');
                this.showConfigModal();
            }, 2000);
        }
        
        console.log('💾 Carga de sitios completada');
        
        // 🆕 Actualizar información del sitio si hay uno activo
        if (this.currentSite) {
            console.log('🔄 Actualizando información del sitio activo al cargar...');
            this.updateSidebarSiteInfo();
        }
    }

    async runManualDiagnosis() {
        if (!this.currentSite) {
            this.addErrorMessage('No hay sitio configurado. Configura un sitio primero para ejecutar el diagnóstico.');
            return;
        }
        
        await this.performAutodiagnosis();
    }

    saveSitesToStorage() {
        const sitesData = {
            sites: this.savedSites,
            activeSiteId: this.currentSite?.id || null,
            lastUpdated: new Date().toISOString()
        };
        
        localStorage.setItem('gemini-wp-cli-sites', JSON.stringify(sitesData));
        console.log('✅ Sitios guardados en localStorage');
    }

    generateSiteId() {
        return 'site_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    addNewSite(name, url, token) {
        // Verificar límite de 5 sitios
        if (this.savedSites.length >= 5) {
            throw new Error('Máximo 5 sitios permitidos. Elimina uno existente primero.');
        }
        
        // Verificar si la URL ya existe
        const existingSite = this.savedSites.find(site => site.url === url);
        if (existingSite) {
            throw new Error('Este sitio ya está configurado.');
        }
        
        const newSite = {
            id: this.generateSiteId(),
            name: name.trim(),
            url: url.replace(/\/$/, ''), // Remover trailing slash
            token: token.trim(),
            savedAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            status: 'unknown'
        };
        
        this.savedSites.push(newSite);
        this.saveSitesToStorage();
        
        return newSite;
    }

    deleteSite(siteId) {
        this.savedSites = this.savedSites.filter(site => site.id !== siteId);
        
        // Si el sitio eliminado era el activo, limpiar
        if (this.currentSite?.id === siteId) {
            this.currentSite = null;
        }
        
        this.saveSitesToStorage();
        this.updateSitesDisplay();
    }

    selectSite(siteId) {
        const site = this.savedSites.find(site => site.id === siteId);
        if (site) {
            this.currentSite = site;
            site.lastUsed = new Date().toISOString();
            this.saveSitesToStorage();
            this.updateSitesDisplay();
            
            // 🎨 Actualizar información en la sidebar
            this.updateSidebarSiteInfo();
            
            // Mostrar mensaje de cambio de sitio
            this.addMessage('assistant', 
                `<strong>🔄 Sitio cambiado</strong><br><br>
                Ahora conectado a: <code>${site.name}</code><br>
                URL: <span style="color: #00bcd4;">${site.url}</span><br><br>
                <em>Iniciando autodiagnóstico del servidor...</em>`
            );
            
            // Ejecutar autodiagnóstico automáticamente
            setTimeout(() => {
                this.performAutodiagnosis();
            }, 1000);
        }
    }

    updateSitesDisplay() {
        // Actualizar lista de sitios guardados en la sidebar
        this.savedSitesList.innerHTML = '';
        
        if (this.savedSites.length === 0) {
            this.savedSitesList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px; font-size: 12px;">No hay sitios configurados</p>';
            return;
        }
        
        this.savedSites.forEach(site => {
            const siteDiv = document.createElement('div');
            siteDiv.className = `saved-site-item ${this.currentSite?.id === site.id ? 'active' : ''}`;
            
            const isActive = this.currentSite?.id === site.id;
            
            siteDiv.innerHTML = `
                <div class="saved-site-name">${site.name}</div>
                <div class="saved-site-url">${site.url}</div>
                <div class="saved-site-actions">
                    ${isActive ? 
                        '<span class="site-action-btn active-indicator">● Activo</span>' : 
                        `<button class="site-action-btn" onclick="window.geminiApp.selectSite('${site.id}')">Usar</button>`
                    }
                    <button class="site-action-btn delete" onclick="window.geminiApp.deleteSiteWithConfirmation('${site.id}')">Desconectar</button>
                </div>
            `;
            
            this.savedSitesList.appendChild(siteDiv);
        });
    }

    formatSiteStatus(site) {
        const lastUsed = new Date(site.lastUsed);
        const now = new Date();
        const diffHours = Math.floor((now - lastUsed) / (1000 * 60 * 60));
        
        let timeText = '';
        if (diffHours < 1) timeText = 'Usado hace menos de 1 hora';
        else if (diffHours < 24) timeText = `Usado hace ${diffHours} horas`;
        else timeText = `Usado hace ${Math.floor(diffHours / 24)} días`;
        
        return `${site.status === 'connected' ? 'Conectado' : 
                 site.status === 'error' ? 'Error de conexión' : 'Sin probar'} • ${timeText}`;
    }

    deleteSiteWithConfirmation(siteId) {
        const site = this.savedSites.find(s => s.id === siteId);
        if (!site) return;
        
        if (confirm(`¿Desconectar "${site.name}"?\n\nEsto eliminará la configuración guardada.`)) {
            this.deleteSite(siteId);
            
            // Mostrar mensaje de confirmación
            this.addMessage('assistant', 
                `<strong>🔌 Sitio desconectado</strong><br><br>
                Se eliminó: <code>${site.name}</code><br>
                <em>Puedes reconectarlo cuando quieras.</em>`
            );
        }
    }

    showConfigModal() {
        console.log('🔧 Mostrando modal de configuración...');
        
        try {
            // Limpiar formulario
            document.getElementById('siteName').value = '';
            document.getElementById('wordpressUrl').value = '';
            document.getElementById('authToken').value = '';
            
            // Actualizar displays
            console.log('📊 Actualizando display de sitios...');
            this.updateSitesDisplay();
            
            console.log('👁️ Mostrando modal...');
            this.configModal.classList.add('show');
            
            console.log('🎯 Enfocando campo nombre...');
            const siteNameField = document.getElementById('siteName');
            if (siteNameField) {
                siteNameField.focus();
            }
            
            console.log('✅ Modal mostrado correctamente');
        } catch (error) {
            console.error('❌ Error al mostrar modal:', error);
        }
    }

    hideConfigModal() {
        this.configModal.classList.remove('show');
        this.hideConfigStatus();
    }

    showConfigStatus(message, type = 'success') {
        const statusDiv = document.getElementById('configStatus');
        statusDiv.textContent = message;
        statusDiv.className = `config-status ${type}`;
        statusDiv.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => this.hideConfigStatus(), 3000);
        }
    }

    hideConfigStatus() {
        const statusDiv = document.getElementById('configStatus');
        statusDiv.style.display = 'none';
    }

    async testConnection(wordpressUrl, authToken) {
        try {
            const response = await fetch(`${this.config.SERVER_URL}${this.config.API.ENDPOINTS.TEST}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    wordpressUrl: wordpressUrl,
                    authToken: authToken
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                return { success: true, data };
            } else {
                const errorData = await response.json();
                return { success: false, error: errorData.message || `HTTP ${response.status}` };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async checkServerConnection() {
        if (!this.currentSite) {
            return;
        }

        try {
            const response = await fetch(`${this.config.SERVER_URL}${this.config.API.ENDPOINTS.HEALTH}`);
            if (response.ok) {
                console.log('✅ Conexión con servidor proxy establecida');
            }
        } catch (error) {
            console.warn('⚠️ No se pudo conectar con el servidor proxy:', error.message);
        }
    }

    initializeEventListeners() {
        console.log('🎧 Registrando event listeners...');
        
        // Eventos existentes
        console.log('📝 Registrando evento de envío...');
        this.sendButton.addEventListener('click', () => {
            console.log('🖱️ Click en botón enviar');
            this.sendMessage();
        });
        
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                console.log('⌨️ Enter presionado en input');
                this.sendMessage();
            }
        });

        this.messageInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        // Eventos del modal de configuración
        console.log('⚙️ Registrando evento del botón de configuración...');
        this.configButton.addEventListener('click', (e) => {
            console.log('🖱️ Click en botón de configuración');
            e.preventDefault();
            e.stopPropagation();
            this.showConfigModal();
        });
        
        console.log('❌ Registrando evento de cerrar modal...');
        this.configCloseButton.addEventListener('click', () => {
            console.log('🖱️ Click en cerrar modal');
            this.hideConfigModal();
        });
        
        this.configCancelButton.addEventListener('click', () => {
            console.log('🖱️ Click en cancelar');
            this.hideConfigModal();
        });
        
        // Cerrar modal al hacer clic fuera
        this.configModal.addEventListener('click', (e) => {
            if (e.target === this.configModal) {
                console.log('🖱️ Click fuera del modal');
                this.hideConfigModal();
            }
        });

        // Selector de sitio activo (mantener para compatibilidad)
        console.log('🔄 Registrando selector de sitio...');
        this.activeSiteSelect.addEventListener('change', (e) => {
            console.log('🔄 Cambio de sitio:', e.target.value);
            if (e.target.value) {
                this.selectSite(e.target.value);
            }
        });

        // Manejar envío del formulario
        console.log('📋 Registrando formulario...');
        this.configForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('📋 Envío de formulario');
            await this.handleConfigSave();
        });

        // Cerrar modal con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.configModal.classList.contains('show')) {
                console.log('⌨️ Escape presionado');
                this.hideConfigModal();
            }
        });

        // 🆕 EVENT LISTENERS PARA EL DESPLEGABLE DE SITIOS
        
        // Botón selector de sitios en el header
        const siteSelectorBtn = document.getElementById('siteSelectorBtn');
        if (siteSelectorBtn) {
            console.log('✅ Registrando event listener para siteSelectorBtn');
            siteSelectorBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Click en siteSelectorBtn detectado');
                this.toggleSiteDropdown();
            });
        } else {
            console.error('❌ Elemento siteSelectorBtn no encontrado');
        }

        // Botón "Añadir Sitio" desde el desplegable
        const addSiteFromDropdown = document.getElementById('addSiteFromDropdown');
        if (addSiteFromDropdown) {
            console.log('✅ Registrando event listener para addSiteFromDropdown');
            addSiteFromDropdown.addEventListener('click', () => {
                console.log('➕ Añadir sitio desde desplegable');
                this.hideSiteDropdown();
                this.showConfigModal();
            });
        } else {
            console.error('❌ Elemento addSiteFromDropdown no encontrado');
        }

        // Cerrar desplegable con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const dropdown = document.getElementById('siteDropdown');
                if (dropdown && dropdown.style.display === 'block') {
                    console.log('⌨️ Escape presionado, ocultando dropdown');
                    this.hideSiteDropdown();
                }
            }
        });
        
        console.log('✅ Todos los event listeners registrados');
    }

    async handleConfigSave() {
        const siteName = document.getElementById('siteName').value.trim();
        const wordpressUrl = document.getElementById('wordpressUrl').value.trim();
        const authToken = document.getElementById('authToken').value.trim();
        const globalGeminiApiKey = document.getElementById('globalGeminiApiKey').value.trim();

        if (!siteName || !wordpressUrl || !authToken) {
            this.showConfigStatus('Por favor, completa todos los campos requeridos', 'error');
            return;
        }

        // Limpiar URL (remover trailing slash)
        const cleanUrl = wordpressUrl.replace(/\/$/, '');

        try {
            this.showConfigStatus('Probando conexión...', 'success');

            // Probar conexión
            const testResult = await this.testConnection(cleanUrl, authToken);

            if (testResult.success) {
                // Guardar API Key global si se proporcionó
                if (globalGeminiApiKey) {
                    this.saveGlobalGeminiApiKey(globalGeminiApiKey);
                    console.log('🔑 API Key global guardada');
                }
                
                // Añadir sitio (sin API Key por sitio)
                const newSite = this.addNewSite(siteName, cleanUrl, authToken);
                newSite.status = 'connected';
                
                // Seleccionar como sitio activo
                this.selectSite(newSite.id);
                
                // 🎨 Actualizar información en la sidebar
                this.updateSidebarSiteInfo();
                
                this.showConfigStatus('✅ Sitio añadido y configurado correctamente', 'success');
                
                // Limpiar formulario
                document.getElementById('siteName').value = '';
                document.getElementById('wordpressUrl').value = '';
                document.getElementById('authToken').value = '';
                document.getElementById('globalGeminiApiKey').value = '';
                
                // Actualizar display
                this.updateSitesDisplay();
                
                // Cerrar modal después de un momento
                setTimeout(() => this.hideConfigModal(), 2000);
                
                // El autodiagnóstico se ejecutará automáticamente por selectSite()
                
            } else {
                this.showConfigStatus(`❌ Error de conexión: ${testResult.error}`, 'error');
            }
        } catch (error) {
            this.showConfigStatus(`❌ Error: ${error.message}`, 'error');
        }
    }

    autoResizeTextarea() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Verificar que hay un sitio configurado
        if (!this.currentSite) {
            this.addErrorMessage('No hay sitio WordPress configurado. Haz clic en ⚙️ para configurar uno.');
            return;
        }

        // Deshabilitar input mientras se procesa
        this.setInputState(false);
        
        // Mostrar mensaje del usuario
        this.addMessage('user', message);
        
        // 🧠 Añadir mensaje del usuario al historial
        this.addToHistory('user', message);
        
        // Limpiar input
        this.messageInput.value = '';
        this.autoResizeTextarea();

        // Mostrar animación de "pensando"
        const thinkingId = this.addThinkingAnimation();

        try {
            // Llamar a Gemini AI para procesar el mensaje
            console.log('🧠 Procesando mensaje con Gemini AI...');
            const geminiResponse = await this.getGeminiResponse(message);
            
            // Remover animación de pensando
            this.removeThinkingAnimation(thinkingId);
            
            // Verificar que tenemos una respuesta válida
            if (!geminiResponse || !geminiResponse.explanation) {
                throw new Error('Respuesta inválida de Gemini');
            }
            
            // Verificar si es una respuesta conversacional
            if (geminiResponse.is_conversational || !geminiResponse.command) {
                console.log('💬 Procesando respuesta conversacional');
                
                // Para respuestas conversacionales, mostrar directamente la explicación
                this.addMessage('assistant', geminiResponse.explanation);
                
                // 🧠 Añadir respuesta conversacional al historial
                this.addToHistory('assistant', geminiResponse.explanation);
                
                return; // No ejecutar comando ni mostrar preview card
            }
            
            // Para respuestas con comandos, continuar con el flujo normal
            console.log('🔧 Procesando respuesta con comando:', geminiResponse.command);
            
            // Mostrar respuesta de Gemini con información adicional
            let responseMessage = `<strong>🤖 Gemini AI ha procesado tu solicitud:</strong><br><br>`;
            responseMessage += `"${geminiResponse.explanation}"`;
            
            // Añadir indicador si es respuesta de emergencia
            if (geminiResponse.explanation && geminiResponse.explanation.includes('emergencia')) {
                responseMessage += `<br><br><em style="color: #ffbd2e;">⚠️ Nota: Gemini AI no está disponible, usando sistema de emergencia.</em>`;
            }
            
            this.addMessage('assistant', responseMessage);
            
            // 🧠 Añadir respuesta de Gemini al historial
            this.addToHistory('assistant', geminiResponse.explanation, geminiResponse);
            
            // Mostrar tarjeta de previsualización con los datos reales de Gemini
            this.addPreviewCard(geminiResponse);
            
        } catch (error) {
            console.error('❌ Error procesando mensaje:', error);
            this.removeThinkingAnimation(thinkingId);
            this.addErrorMessage(`Error procesando tu solicitud: ${error.message}`);
        } finally {
            this.setInputState(true);
        }
    }

    addThinkingAnimation() {
        const thinkingId = 'thinking_' + Date.now();
        const thinkingDiv = document.createElement('div');
        thinkingDiv.id = thinkingId;
        thinkingDiv.className = 'message assistant';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `
            <div class="gemini-thinking">
                <div class="audio-bars">
                    <div class="audio-bar"></div>
                    <div class="audio-bar"></div>
                    <div class="audio-bar"></div>
                    <div class="audio-bar"></div>
                    <div class="audio-bar"></div>
                    <div class="audio-bar"></div>
                    <div class="audio-bar"></div>
                    <div class="audio-bar"></div>
                </div>
                <div class="thinking-text">🧠 Gemini AI está analizando tu solicitud...</div>
            </div>
        `;
        
        thinkingDiv.appendChild(contentDiv);
        this.chatArea.appendChild(thinkingDiv);
        this.scrollToBottom();
        
        return thinkingId;
    }

    removeThinkingAnimation(thinkingId) {
        const thinkingElement = document.getElementById(thinkingId);
        if (thinkingElement) {
            thinkingElement.remove();
        }
    }

    setInputState(enabled) {
        this.messageInput.disabled = !enabled;
        this.sendButton.disabled = !enabled;
        
        if (enabled) {
            this.sendButton.textContent = 'Enviar';
            this.sendButton.classList.remove('loading-gradient');
            this.messageInput.focus();
        } else {
            this.sendButton.innerHTML = '<div class="loading"></div>';
            this.sendButton.classList.add('loading-gradient');
        }
    }

    addMessage(type, content) {
        console.log('🔍 addMessage llamado:', { type, contentLength: content?.length });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Aplicar renderizado Markdown mejorado solo a mensajes del asistente
        if (type === 'assistant') {
            console.log('🎨 Aplicando renderizado Markdown...');
            const renderedContent = this.renderMarkdown(content);
            console.log('✅ Markdown renderizado, longitud:', renderedContent?.length);
            contentDiv.innerHTML = renderedContent;
        } else {
            console.log('👤 Mensaje de usuario, sin renderizado');
            contentDiv.innerHTML = content;
        }
        
        messageDiv.appendChild(contentDiv);
        this.chatArea.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addPreviewCard(geminiResponse) {
        console.log('🎨 addPreviewCard llamado con:', { 
            is_conversational: geminiResponse.is_conversational, 
            has_command: !!geminiResponse.command,
            explanation_length: geminiResponse.explanation?.length 
        });
        
        const cardDiv = document.createElement('div');
        cardDiv.className = 'message assistant';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Verificar si es una respuesta conversacional
        if (geminiResponse.is_conversational || !geminiResponse.command) {
            console.log('💬 Respuesta conversacional detectada, aplicando renderizado Markdown...');
            
            // APLICAR RENDERIZADO MARKDOWN A LA EXPLICACIÓN
            const renderedExplanation = this.renderMarkdown(geminiResponse.explanation);
            console.log('✅ Markdown aplicado a explicación conversacional');
            
            contentDiv.innerHTML = `
                <div class="preview-card conversational">
                    <div class="preview-section">
                        <div class="preview-icon">💬</div>
                        <div class="preview-label">Gemini AI:</div>
                        <div class="preview-content">${renderedExplanation}</div>
                    </div>
                    
                    ${geminiResponse.agent_thought ? `
                    <div class="preview-section">
                        <div class="preview-icon">🧠</div>
                        <div class="preview-label">Nota:</div>
                        <div class="preview-content">
                            <small style="color: #888; font-style: italic;">${geminiResponse.agent_thought}</small>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
            
            cardDiv.appendChild(contentDiv);
            this.chatArea.appendChild(cardDiv);
            this.scrollToBottom();
            return;
        }
        
        console.log('🔧 Respuesta con comando detectada, aplicando renderizado Markdown a explicación...');
        
        // APLICAR RENDERIZADO MARKDOWN A LA EXPLICACIÓN TAMBIÉN EN COMANDOS
        const renderedExplanation = this.renderMarkdown(geminiResponse.explanation);
        console.log('✅ Markdown aplicado a explicación de comando');
        
        // Generar ID único para el botón (solo para comandos)
        const buttonId = 'btn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        contentDiv.innerHTML = `
            <div class="preview-card">
                <div class="preview-section">
                    <div class="preview-icon">🤖</div>
                    <div class="preview-label">Explicación:</div>
                    <div class="preview-content">${renderedExplanation}</div>
                </div>
                
                <div class="preview-section">
                    <div class="preview-icon">💻</div>
                    <div class="preview-label">Comando:</div>
                    <div class="preview-content">
                        <div class="command-code">${geminiResponse.command}</div>
                    </div>
                </div>
                
                <div class="preview-section">
                    <div class="preview-icon">🛡️</div>
                    <div class="preview-label">Seguridad:</div>
                    <div class="preview-content">
                        <div class="security-indicator ${geminiResponse.is_safe ? 'security-safe' : 'security-unsafe'}">
                            ${geminiResponse.is_safe ? '✅ Comando seguro' : '⚠️ Comando requiere precaución'}
                            ${!geminiResponse.is_safe ? '<br><small>Este comando puede modificar datos importantes</small>' : ''}
                        </div>
                    </div>
                </div>
                
                ${geminiResponse.agent_thought ? `
                <div class="preview-section">
                    <div class="preview-icon">🧠</div>
                    <div class="preview-label">Análisis IA:</div>
                    <div class="preview-content">
                        <small style="color: #888; font-style: italic;">${geminiResponse.agent_thought}</small>
                    </div>
                </div>
                ` : ''}
                
                <button id="${buttonId}" class="execute-button">
                    Confirmar Ejecución
                </button>
            </div>
        `;
        
        cardDiv.appendChild(contentDiv);
        this.chatArea.appendChild(cardDiv);
        
        // Agregar event listener al botón
        document.getElementById(buttonId).addEventListener('click', (e) => {
            this.executeCommand(geminiResponse.command, e.target, geminiResponse.use_server_info);
        });
        
        this.scrollToBottom();
    }

    async executeCommand(command, buttonElement, useServerInfo = false) {
        const originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<div class="loading"></div> Ejecutando...';
        buttonElement.classList.add('loading-gradient');

        try {
            let response;
            
            if (useServerInfo) {
                // Usar endpoint de información del servidor
                response = await this.getServerInfo();
            } else {
                // Ejecutar comando normal
                response = await this.callWordPressAPI(command);
            }
            
            // 🔧 Auto-healing: Verificar si hay errores en la respuesta
            const hasError = this.detectCommandError(response);
            
            if (hasError) {
                console.log('🔧 Auto-healing: Error detectado, iniciando recuperación automática...');
                
                // Mostrar resultado del error primero
                this.addCommandResult(command, response, useServerInfo);
                
                // Cambiar botón a estado de error
                buttonElement.textContent = '❌ Error detectado';
                buttonElement.classList.remove('loading-gradient');
                buttonElement.style.backgroundColor = '#ff5f56';
                
                // Iniciar proceso de auto-healing
                await this.performAutoHealing(command, response);
                
            } else {
                // Mostrar resultado exitoso
                this.addCommandResult(command, response, useServerInfo);
                
                // Cambiar botón a completado
                buttonElement.textContent = '✅ Ejecutado';
                buttonElement.classList.remove('loading-gradient');
                buttonElement.style.backgroundColor = '#27ca3f';
            }
            
        } catch (error) {
            console.log('🔧 Auto-healing: Excepción capturada, iniciando recuperación...');
            
            // Mostrar error original
            this.addErrorMessage('Error al ejecutar comando: ' + error.message);
            
            // Cambiar botón a estado de error
            buttonElement.textContent = '❌ Error de conexión';
            buttonElement.classList.remove('loading-gradient');
            buttonElement.style.backgroundColor = '#ff5f56';
            
            // Iniciar auto-healing para errores de conexión
            await this.performAutoHealing(command, { error: error.message, status: 'connection_error' });
        }
    }

    // 🔧 Auto-healing: Detectar errores en respuestas de WordPress
    detectCommandError(response) {
        if (!response) return false;
        
        // Verificar status de error explícito
        if (response.status === 'error') return true;
        
        // Verificar mensajes de error comunes en la respuesta
        const errorMessage = (response.response || response.message || '').toLowerCase();
        
        const errorPatterns = [
            'error',
            'failed',
            'permission denied',
            'permiso denegado',
            'access denied',
            'acceso denegado',
            'already exists',
            'ya existe',
            'not found',
            'no encontrado',
            'invalid',
            'inválido',
            'forbidden',
            'prohibido',
            'unauthorized',
            'no autorizado',
            'timeout',
            'connection failed',
            'conexión falló'
        ];
        
        return errorPatterns.some(pattern => errorMessage.includes(pattern));
    }

    // 🔧 Auto-healing: Realizar recuperación automática
    async performAutoHealing(originalCommand, errorResponse) {
        try {
            console.log('🔧 Iniciando auto-healing para comando:', originalCommand);
            
            // Mostrar mensaje de que se está analizando el error
            this.addRecoveryMessage('🔧 Analizando el error y buscando soluciones...');
            
            // Extraer mensaje de error
            const errorMessage = this.extractErrorMessage(errorResponse);
            
            // Crear prompt invisible para Gemini
            const healingPrompt = `El comando anterior falló con este error: ${errorMessage}. Analiza por qué falló y sugiere al usuario una solución o un comando alternativo.`;
            
            console.log('🔧 Enviando a Gemini para análisis:', healingPrompt);
            
            // Llamar directamente a la API de Gemini sin añadir al historial
            const geminiResponse = await this.callGeminiForHealing(healingPrompt);
            
            if (geminiResponse && geminiResponse.explanation) {
                // Mostrar sugerencia de recuperación
                this.addRecoveryMessage(`🤖 **Asistente de Recuperación**\n\n${geminiResponse.explanation}`, geminiResponse);
            } else {
                // Fallback si Gemini no responde
                this.addRecoveryMessage('🔧 No pude analizar el error automáticamente. Revisa el mensaje de error anterior y verifica la configuración.');
            }
            
        } catch (error) {
            console.error('❌ Error en auto-healing:', error);
            this.addRecoveryMessage('🔧 El sistema de recuperación automática no está disponible en este momento.');
        }
    }

    // 🔧 Llamar a Gemini específicamente para auto-healing (sin historial)
    async callGeminiForHealing(healingPrompt) {
        try {
            console.log('🔧 Llamada directa a Gemini para auto-healing');
            
            // Preparar contexto del sitio
            const siteContext = {
                wordpress_version: this.serverCapabilities?.server_info?.wordpress_version || 'Desconocido',
                php_version: this.serverCapabilities?.server_info?.php_version || 'Desconocido',
                server_software: this.serverCapabilities?.server_info?.server_software || 'Desconocido',
                wp_cli_available: this.serverCapabilities?.wp_cli?.available || false,
                recommended_method: this.serverCapabilities?.recommended_method || 'API nativa',
                emulation_mode: this.emulationMode,
                execution_capabilities: this.serverCapabilities?.execution_capabilities || {}
            };
            
            // Preparar headers
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // 🔑 Añadir API Key global si existe
            if (this.hasGlobalGeminiApiKey()) {
                headers['x-user-gemini-key'] = this.globalGeminiApiKey;
                console.log('🔑 Auto-healing usando API Key global personalizada');
            } else {
                console.log('🔑 Auto-healing usando API Key del servidor (compartida)');
            }
            
            // Llamar al endpoint de Gemini (sin historial para auto-healing)
            const response = await fetch(`${this.config.SERVER_URL}${this.config.API.ENDPOINTS.GEMINI_ASK}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    prompt: healingPrompt,
                    siteContext: siteContext,
                    chatHistory: [] // Auto-healing no usa historial
                }),
                timeout: this.config.API.TIMEOUT
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.status === 'success' && data.gemini_response) {
                console.log('✅ Auto-healing: Respuesta exitosa de Gemini AI');
                return data.gemini_response;
            } else {
                throw new Error(data.message || data.gemini_error || 'Error en la respuesta de Gemini para auto-healing');
            }
            
        } catch (error) {
            console.error('❌ Error en auto-healing con Gemini:', error);
            
            // Fallback para auto-healing
            return this.getHealingFallback(healingPrompt);
        }
    }

    // 🔧 Fallback para auto-healing cuando Gemini no está disponible
    getHealingFallback(healingPrompt) {
        console.log('🔧 Usando fallback para auto-healing');
        
        const lowerPrompt = healingPrompt.toLowerCase();
        
        if (lowerPrompt.includes('permission denied') || lowerPrompt.includes('permiso denegado')) {
            return {
                command: 'wp user list --role=administrator',
                explanation: 'Error de permisos detectado. Verifica que tengas permisos de administrador y que el token de autenticación sea válido. Puedes revisar los usuarios administradores con el comando sugerido.',
                is_safe: true
            };
        } else if (lowerPrompt.includes('already exists') || lowerPrompt.includes('ya existe')) {
            return {
                command: 'wp --help',
                explanation: 'El elemento que intentas crear ya existe. Considera usar un nombre diferente o verificar si realmente necesitas crear uno nuevo. Revisa la documentación para más opciones.',
                is_safe: true
            };
        } else if (lowerPrompt.includes('not found') || lowerPrompt.includes('no encontrado')) {
            return {
                command: 'wp --version',
                explanation: 'Elemento no encontrado. Verifica que el nombre o ID sea correcto y que el elemento exista en tu sitio WordPress.',
                is_safe: true
            };
        } else {
            return {
                command: 'wp --help',
                explanation: 'Se detectó un error en la ejecución del comando. Revisa la sintaxis del comando y verifica que todos los parámetros sean correctos.',
                is_safe: true
            };
        }
    }

    // 🔧 Extraer mensaje de error limpio
    extractErrorMessage(errorResponse) {
        if (typeof errorResponse === 'string') return errorResponse;
        
        if (errorResponse.error) return errorResponse.error;
        if (errorResponse.message) return errorResponse.message;
        if (errorResponse.response) return errorResponse.response;
        
        return 'Error desconocido en la ejecución del comando';
    }

    // 🔧 Mostrar mensaje de recuperación con estilo especial
    addRecoveryMessage(message, geminiResponse = null) {
        const recoveryDiv = document.createElement('div');
        recoveryDiv.className = 'message recovery';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Si hay respuesta de Gemini, mostrar con botón de acción
        if (geminiResponse && geminiResponse.command) {
            const buttonId = 'recovery_btn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            contentDiv.innerHTML = `
                <div class="recovery-card">
                    <div class="recovery-header">
                        <div class="recovery-icon">🔧</div>
                        <div class="recovery-title">Asistente de Recuperación</div>
                    </div>
                    
                    <div class="recovery-content">
                        <div class="recovery-explanation">${geminiResponse.explanation}</div>
                        
                        ${geminiResponse.command !== 'wp --version' ? `
                        <div class="recovery-suggestion">
                            <div class="recovery-label">💡 Comando sugerido:</div>
                            <div class="command-code">${geminiResponse.command}</div>
                            <button id="${buttonId}" class="recovery-button">
                                🔄 Probar Solución
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            recoveryDiv.appendChild(contentDiv);
            this.chatArea.appendChild(recoveryDiv);
            
            // Añadir event listener si hay comando sugerido
            if (geminiResponse.command !== 'wp --version') {
                document.getElementById(buttonId).addEventListener('click', (e) => {
                    this.executeCommand(geminiResponse.command, e.target);
                });
            }
            
        } else {
            // Mensaje simple sin comando
            contentDiv.innerHTML = `
                <div class="recovery-card">
                    <div class="recovery-header">
                        <div class="recovery-icon">🔧</div>
                        <div class="recovery-title">Asistente de Recuperación</div>
                    </div>
                    <div class="recovery-content">
                        <div class="recovery-explanation">${message}</div>
                    </div>
                </div>
            `;
            
            recoveryDiv.appendChild(contentDiv);
            this.chatArea.appendChild(recoveryDiv);
        }
        
        this.scrollToBottom();
    }

    async getServerInfo() {
        if (!this.currentSite) {
            throw new Error('No hay sitio WordPress configurado');
        }

        const response = await fetch(`${this.config.SERVER_URL}${this.config.API.ENDPOINTS.SERVER_INFO}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                wordpressUrl: this.currentSite.url,
                authToken: this.currentSite.token
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    addCommandResult(command, response, isServerInfo = false) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'message assistant';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        let statusColor = '#27ca3f'; // Verde por defecto
        let statusIcon = '✅';
        
        if (response.status === 'error') {
            statusColor = '#ff5f56';
            statusIcon = '❌';
        }
        
        if (isServerInfo) {
            // Formato especial para información del servidor
            contentDiv.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <strong>🖥️ Información del Servidor WordPress</strong>
                </div>
                
                <div class="command-output syntax-highlight" data-language="server-info">${this.formatServerInfo(response)}</div>
            `;
        } else {
            // Detectar tipo de comando para el atributo data-language
            const language = this.detectOutputLanguage(command, response);
            
            contentDiv.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <strong>${statusIcon} Resultado de: <code style="background: #333; padding: 2px 6px; border-radius: 3px;">${command}</code></strong>
                </div>
                
                ${response.exec_method ? `
                    <div style="margin-bottom: 8px; font-size: 12px; color: #888;">
                        Método: <span class="highlight-keyword">${response.exec_method}</span> | Estado: <span style="color: ${statusColor}">${response.status}</span>
                        ${response.server_capabilities ? `| Servidor: <span class="highlight-info">Compatible</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="command-output syntax-highlight" data-language="${language}">${this.formatCommandOutput(response.response || response.message)}</div>
            `;
        }
        
        resultDiv.appendChild(contentDiv);
        this.chatArea.appendChild(resultDiv);
        this.scrollToBottom();
    }

    detectOutputLanguage(command, response) {
        const cmd = command.toLowerCase();
        
        if (cmd.includes('plugin list') || cmd.includes('theme list')) return 'table';
        if (cmd.includes('user list') || cmd.includes('post list')) return 'table';
        if (cmd.includes('--version') || cmd.includes('version')) return 'version';
        if (cmd.includes('db ')) return 'database';
        if (cmd.includes('option get')) return 'json';
        if (response.status === 'error') return 'error';
        
        return 'wp-cli';
    }

    formatServerInfo(info) {
        const serverInfo = `
<strong>📊 Información del Sistema:</strong>
• WordPress: <span class="highlight-version">${info.server_info?.wordpress_version || 'N/A'}</span>
• PHP: <span class="highlight-version">${info.server_info?.php_version || 'N/A'}</span>
• Servidor: <span class="highlight-keyword">${info.server_info?.server_software || 'N/A'}</span>
• OS: <span class="highlight-keyword">${info.server_info?.operating_system || 'N/A'}</span>

<strong>⚙️ Capacidades de Ejecución:</strong>
• shell_exec: ${info.execution_capabilities?.shell_exec ? '<span class="status-indicator success">✅ Disponible</span>' : '<span class="status-indicator error">❌ Desactivado</span>'}
• exec: ${info.execution_capabilities?.exec ? '<span class="status-indicator success">✅ Disponible</span>' : '<span class="status-indicator error">❌ Desactivado</span>'}
• system: ${info.execution_capabilities?.system ? '<span class="status-indicator success">✅ Disponible</span>' : '<span class="status-indicator error">❌ Desactivado</span>'}
• passthru: ${info.execution_capabilities?.passthru ? '<span class="status-indicator success">✅ Disponible</span>' : '<span class="status-indicator error">❌ Desactivado</span>'}

<strong>🔧 WP-CLI:</strong>
• Estado: ${info.wp_cli?.available ? '<span class="status-indicator success">✅ Instalado</span>' : '<span class="status-indicator error">❌ No disponible</span>'}
• Ruta: <span class="highlight-path">${info.wp_cli?.path || 'N/A'}</span>
• Versión: <span class="highlight-version">${info.wp_cli?.version || 'N/A'}</span>
• Método: <span class="highlight-keyword">${info.wp_cli?.method || 'N/A'}</span>

<strong>🛡️ Seguridad:</strong>
• Safe Mode: <span class="highlight-keyword">${info.security_status?.safe_mode || 'N/A'}</span>
• Open Basedir: <span class="highlight-info">${info.security_status?.open_basedir || 'N/A'}</span>
• Funciones deshabilitadas: <span class="highlight-warning">${info.security_status?.disable_functions || 'Ninguna'}</span>

<strong>💡 Método Recomendado:</strong> <span class="highlight-keyword">${info.recommended_method || 'N/A'}</span>
        `.trim();
        
        return serverInfo;
    }

    formatCommandOutput(output) {
        if (!output) return 'Sin salida';
        
        // Escapar HTML
        let escaped = output.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // Detectar tipo de salida y aplicar formato específico
        if (this.isTableOutput(escaped)) {
            return this.formatTableOutput(escaped);
        }
        
        // Aplicar resaltado de sintaxis general
        return this.applySyntaxHighlighting(escaped);
    }

    isTableOutput(output) {
        // Detectar si la salida es una tabla (contiene tabs y headers típicos)
        const lines = output.split('\n');
        if (lines.length < 2) return false;
        
        const firstLine = lines[0].toLowerCase();
        const hasTabSeparators = output.includes('\t');
        const hasCommonHeaders = /^(id|name|status|version|title|login|email)/.test(firstLine);
        
        return hasTabSeparators && hasCommonHeaders;
    }

    formatTableOutput(output) {
        const lines = output.split('\n').filter(line => line.trim());
        if (lines.length < 2) return this.applySyntaxHighlighting(output);
        
        const headers = lines[0].split('\t');
        const rows = lines.slice(1).map(line => line.split('\t'));
        
        let tableHtml = '<table class="output-table">';
        
        // Headers
        tableHtml += '<thead><tr>';
        headers.forEach(header => {
            tableHtml += `<th>${header.trim()}</th>`;
        });
        tableHtml += '</tr></thead>';
        
        // Rows
        tableHtml += '<tbody>';
        rows.forEach(row => {
            tableHtml += '<tr>';
            row.forEach((cell, index) => {
                const cellContent = this.formatTableCell(cell.trim(), headers[index]);
                tableHtml += `<td>${cellContent}</td>`;
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
        
        return tableHtml;
    }

    formatTableCell(content, header) {
        const headerLower = (header || '').toLowerCase();
        
        // Status columns
        if (headerLower.includes('status')) {
            if (content.toLowerCase() === 'active') {
                return `<span class="status-indicator success">✅ ${content}</span>`;
            } else if (content.toLowerCase() === 'inactive') {
                return `<span class="status-indicator error">❌ ${content}</span>`;
            }
        }
        
        // Version numbers
        if (headerLower.includes('version') && /\d+\.\d+/.test(content)) {
            return `<span class="highlight-version">${content}</span>`;
        }
        
        // IDs
        if (headerLower === 'id' && /^\d+$/.test(content)) {
            return `<span class="highlight-number">${content}</span>`;
        }
        
        // URLs
        if (content.startsWith('http')) {
            return `<span class="highlight-url">${content}</span>`;
        }
        
        return content;
    }

    applySyntaxHighlighting(output) {
        return output
            // Mensajes de estado
            .replace(/^(Error:|ERROR:)/gm, '<span class="highlight-error">❌ $1</span>')
            .replace(/^(Success:|SUCCESS:)/gm, '<span class="highlight-success">✅ $1</span>')
            .replace(/^(Warning:|WARNING:)/gm, '<span class="highlight-warning">⚠️ $1</span>')
            .replace(/^(Info:|INFO:)/gm, '<span class="highlight-info">ℹ️ $1</span>')
            
            // Versiones y números
            .replace(/(\d+\.\d+\.\d+)/g, '<span class="highlight-version">$1</span>')
            .replace(/(\d+\.\d+)/g, '<span class="highlight-number">$1</span>')
            
            // Estados
            .replace(/(^|\s)(active|enabled)(\s|$)/gi, '$1<span class="highlight-active">$2</span>$3')
            .replace(/(^|\s)(inactive|disabled)(\s|$)/gi, '$1<span class="highlight-inactive">$2</span>$3')
            
            // URLs y paths
            .replace(/(https?:\/\/[^\s]+)/g, '<span class="highlight-url">$1</span>')
            .replace(/(\/[^\s]*)/g, '<span class="highlight-path">$1</span>')
            
            // Palabras clave de WordPress
            .replace(/\b(WordPress|WP-CLI|PHP|MySQL|Apache|Nginx)\b/g, '<span class="highlight-keyword">$1</span>')
            
            // Strings entre comillas
            .replace(/"([^"]+)"/g, '<span class="highlight-string">"$1"</span>')
            .replace(/'([^']+)'/g, '<span class="highlight-string">\'$1\'</span>')
            
            // Comentarios (líneas que empiezan con #)
            .replace(/^#.*$/gm, '<span class="highlight-comment">$&</span>')
            
            // Códigos de salida
            .replace(/exit code:?\s*(\d+)/gi, 'Exit Code: <span class="highlight-number">$1</span>');
    }

    addErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message assistant';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `<div class="error-message">❌ ${message}</div>`;
        
        errorDiv.appendChild(contentDiv);
        this.chatArea.appendChild(errorDiv);
        this.scrollToBottom();
    }

    scrollToBottom() {
        if (this.config.UI.AUTO_SCROLL) {
            setTimeout(() => {
                this.chatArea.scrollTop = this.chatArea.scrollHeight;
            }, this.config.UI.ANIMATION_DURATION);
        }
    }

    async getGeminiResponse(userMessage, addToHistory = true) {
        try {
            console.log('🧠 Enviando prompt a Gemini AI:', userMessage);
            console.log('🔧 Modo emulación:', this.emulationMode ? 'ACTIVADO' : 'DESACTIVADO');
            
            // Preparar contexto del sitio para Gemini
            const siteContext = {
                wordpress_version: this.serverCapabilities?.server_info?.wordpress_version || 'Desconocido',
                php_version: this.serverCapabilities?.server_info?.php_version || 'Desconocido',
                server_software: this.serverCapabilities?.server_info?.server_software || 'Desconocido',
                wp_cli_available: this.serverCapabilities?.wp_cli?.available || false,
                recommended_method: this.serverCapabilities?.recommended_method || 'API nativa',
                emulation_mode: this.emulationMode,
                execution_capabilities: this.serverCapabilities?.execution_capabilities || {}
            };
            
            console.log('📊 Contexto del sitio para Gemini:', siteContext);
            
            // 🧠 Preparar historial de conversación
            const formattedHistory = this.getFormattedHistory();
            console.log('🧠 Enviando historial de conversación:', formattedHistory ? 'Sí (' + this.chatHistory.length + ' mensajes)' : 'No');
            
            // Preparar headers
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // 🔑 Añadir API Key global si existe
            if (this.hasGlobalGeminiApiKey()) {
                headers['x-user-gemini-key'] = this.globalGeminiApiKey;
                console.log('🔑 Usando API Key global personalizada');
            } else {
                console.log('🔑 Usando API Key del servidor (compartida)');
            }
            
            // Llamar al endpoint real de Gemini con contexto
            const response = await fetch(`${this.config.SERVER_URL}${this.config.API.ENDPOINTS.GEMINI_ASK}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    prompt: userMessage,
                    siteContext: siteContext,
                    chatHistory: this.chatHistory // 🧠 Enviar historial de chat
                }),
                timeout: this.config.API.TIMEOUT
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.status === 'success' && data.gemini_response) {
                console.log('✅ Respuesta exitosa de Gemini AI:', data.gemini_response);
                
                // Validar que la respuesta tenga la estructura esperada
                const geminiResp = data.gemini_response;
                if (geminiResp.explanation && typeof geminiResp.is_safe === 'boolean') {
                    // Para respuestas conversacionales, command puede ser null
                    return geminiResp;
                } else {
                    console.warn('⚠️ Respuesta de Gemini con estructura incompleta:', geminiResp);
                    throw new Error('Respuesta de Gemini con formato incorrecto');
                }
            } else {
                throw new Error(data.message || data.gemini_error || 'Error en la respuesta de Gemini');
            }
            
        } catch (error) {
            console.error('❌ Error conectando con Gemini AI:', error);
            
            // Mostrar error específico al usuario
            this.addErrorMessage(`Error de IA: ${error.message}. Usando respuesta de emergencia.`);
            
            // Fallback a respuesta local si Gemini falla
            console.log('🔄 Usando sistema de emergencia...');
            return this.getEmergencyResponse(userMessage);
        }
    }

    getEmergencyResponse(userMessage) {
        // Sistema de emergencia cuando Gemini no está disponible
        console.log('🚨 Activando Gemini WP-Agent de emergencia para:', userMessage);
        
        const lowerMessage = userMessage.toLowerCase();
        
        // Diagnóstico inteligente de problemas (sistema de emergencia)
        if (lowerMessage.includes('lento') || lowerMessage.includes('slow') || lowerMessage.includes('rendimiento')) {
            return {
                command: 'wp plugin list --status=active',
                explanation: 'Problema de rendimiento detectado. Revisando plugins activos (la causa más común de sitios lentos) - Sistema de emergencia activo.',
                is_safe: true
            };
        } else if (lowerMessage.includes('error 500') || lowerMessage.includes('error interno')) {
            return {
                command: 'wp plugin list --status=active',
                explanation: 'Error 500 detectado. Verificando plugins activos que suelen causar este error - Sistema de emergencia activo.',
                is_safe: true
            };
        } else if (lowerMessage.includes('error 404') || lowerMessage.includes('no encontrada')) {
            return {
                command: 'wp rewrite flush',
                explanation: 'Error 404 detectado. Regenerando permalinks para resolver páginas no encontradas - Sistema de emergencia activo.',
                is_safe: true
            };
        } else if (lowerMessage.includes('no puedo entrar') || lowerMessage.includes('login') || lowerMessage.includes('acceso')) {
            return {
                command: 'wp user list --role=administrator',
                explanation: 'Problema de acceso detectado. Verificando usuarios administradores - Sistema de emergencia activo.',
                is_safe: true
            };
        } else if (lowerMessage.includes('hackea') || lowerMessage.includes('malware') || lowerMessage.includes('infectado')) {
            return {
                command: 'wp user list --role=administrator',
                explanation: 'Posible compromiso de seguridad. Revisando usuarios admin para detectar cuentas no autorizadas - Sistema de emergencia activo.',
                is_safe: true
            };
        } else if (lowerMessage.includes('borrar') || lowerMessage.includes('eliminar') || lowerMessage.includes('delete')) {
            return {
                command: 'wp --help',
                explanation: 'ADVERTENCIA: Operación peligrosa detectada. Mostrando ayuda por seguridad. Haz backup antes de eliminar - Sistema de emergencia activo.',
                is_safe: false
            };
        }
        
        // 🎨 Capacidades de diseño de contenido (sistema de emergencia)
        else if (lowerMessage.includes('crea') && (lowerMessage.includes('página') || lowerMessage.includes('post') || lowerMessage.includes('entrada'))) {
            // Detectar si es una página de inicio específica
            if (lowerMessage.includes('inicio') && lowerMessage.includes('columnas') && lowerMessage.includes('servicios')) {
                const blockContent = `<!-- wp:heading {"level":1} --><h1>¡Bienvenido a nuestro sitio!</h1><!-- /wp:heading --><!-- wp:paragraph --><p>Nos complace darte la bienvenida. Descubre nuestros servicios profesionales diseñados especialmente para ti.</p><!-- /wp:paragraph --><!-- wp:columns --><div class="wp-block-columns"><!-- wp:column --><div class="wp-block-column"><!-- wp:heading {"level":3} --><h3>Servicio Premium</h3><!-- /wp:heading --><!-- wp:paragraph --><p>Ofrecemos soluciones de alta calidad con atención personalizada y resultados garantizados.</p><!-- /wp:paragraph --><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link">Más información</a></div><!-- /wp:button --></div><!-- /wp:column --><!-- wp:column --><div class="wp-block-column"><!-- wp:heading {"level":3} --><h3>Soporte 24/7</h3><!-- /wp:heading --><!-- wp:paragraph --><p>Nuestro equipo está disponible las 24 horas para brindarte el mejor soporte técnico.</p><!-- /wp:paragraph --><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link">Contactar</a></div><!-- /wp:button --></div><!-- /wp:column --></div><!-- /wp:columns -->`;
                
                return {
                    command: `wp post create --post_type=page --post_title="Inicio" --post_content='${blockContent}' --post_status=publish`,
                    explanation: 'Creando página de inicio con saludo y dos columnas de servicios usando bloques de WordPress (Gutenberg) - Sistema de emergencia activo.',
                    is_safe: true
                };
            } else if (lowerMessage.includes('página')) {
                const basicPageContent = `<!-- wp:heading {"level":1} --><h1>Nueva Página</h1><!-- /wp:heading --><!-- wp:paragraph --><p>Contenido de la página creado automáticamente. Puedes editarlo desde el panel de WordPress.</p><!-- /wp:paragraph -->`;
                
                return {
                    command: `wp post create --post_type=page --post_title="Nueva Página" --post_content='${basicPageContent}' --post_status=draft`,
                    explanation: 'Creando nueva página con bloques de WordPress (sistema de emergencia)',
                    is_safe: true
                };
            } else {
                const basicPostContent = `<!-- wp:heading {"level":2} --><h2>Nuevo Post</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Contenido del post creado automáticamente con bloques de WordPress.</p><!-- /wp:paragraph -->`;
                
                return {
                    command: `wp post create --post_title="Nuevo Post" --post_content='${basicPostContent}' --post_status=draft`,
                    explanation: 'Creando nuevo post con bloques de WordPress (sistema de emergencia)',
                    is_safe: true
                };
            }
        }
        
        // Patrones básicos de emergencia (más simples que los de config)
        else if (lowerMessage.includes('plugin')) {
            return {
                command: 'wp plugin list',
                explanation: 'Lista plugins instalados (sistema de emergencia - Gemini WP-Agent no disponible)',
                is_safe: true
            };
        } else if (lowerMessage.includes('usuario') || lowerMessage.includes('user')) {
            return {
                command: 'wp user list',
                explanation: 'Lista usuarios registrados (sistema de emergencia)',
                is_safe: true
            };
        } else if (lowerMessage.includes('tema') || lowerMessage.includes('theme')) {
            return {
                command: 'wp theme list',
                explanation: 'Lista temas instalados (sistema de emergencia)',
                is_safe: true
            };
        } else if (lowerMessage.includes('versión') || lowerMessage.includes('version') || lowerMessage.includes('wordpress')) {
            return {
                command: 'wp --version',
                explanation: 'Información del sistema WordPress (sistema de emergencia)',
                is_safe: true
            };
        } else if (lowerMessage.includes('post') || lowerMessage.includes('entrada')) {
            return {
                command: 'wp post list',
                explanation: 'Lista publicaciones recientes (sistema de emergencia)',
                is_safe: true
            };
        } else if (lowerMessage.includes('base') && lowerMessage.includes('datos')) {
            return {
                command: 'wp db size',
                explanation: 'Muestra tamaño de la base de datos (sistema de emergencia)',
                is_safe: true
            };
        }
        
        // Respuesta por defecto de emergencia
        return {
            command: 'wp --version',
            explanation: 'Gemini WP-Agent no está disponible. Sistema de emergencia activo. Describe tu problema específico (ej: "sitio lento", "error 500") para mejor diagnóstico.',
            is_safe: true
        };
    }

    async callWordPressAPI(command) {
        if (!this.currentSite) {
            throw new Error('No hay sitio WordPress configurado. Configura un sitio primero.');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.API.TIMEOUT);

        try {
            const response = await fetch(`${this.config.SERVER_URL}${this.config.API.ENDPOINTS.EXECUTE}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    command: command,
                    wordpressUrl: this.currentSite.url,
                    authToken: this.currentSite.token
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            // Actualizar último uso del sitio
            this.currentSite.lastUsed = new Date().toISOString();
            this.saveSitesToStorage();

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    // 🎨 NUEVAS FUNCIONES PARA LA SIDEBAR

    showGlobalApiKeyModal() {
        // Por ahora, usar el modal principal pero pre-llenar la API key
        this.showConfigModal();
        
        // Pre-llenar la API key global si existe
        setTimeout(() => {
            const globalApiKeyInput = document.getElementById('globalGeminiApiKey');
            if (globalApiKeyInput && this.globalGeminiApiKey) {
                globalApiKeyInput.value = this.globalGeminiApiKey;
                globalApiKeyInput.focus();
            }
        }, 100);
    }

    async runAutodiagnosis() {
        if (!this.currentSite) {
            this.addMessage('assistant', '⚠️ Necesitas conectar un sitio WordPress primero. Usa el botón ⚙️ para configurar tu sitio.');
            return;
        }

        this.addMessage('user', '🔍 Ejecutar autodiagnóstico completo');
        
        try {
            // Ejecutar diagnóstico del servidor
            const serverInfo = await this.getServerInfo();
            
            let diagnosticMessage = `🔍 **Autodiagnóstico Completo**\n\n`;
            diagnosticMessage += `**Sitio:** ${this.currentSite.name}\n`;
            diagnosticMessage += `**URL:** ${this.currentSite.url}\n\n`;
            diagnosticMessage += `**Información del Servidor:**\n`;
            diagnosticMessage += `• WordPress: ${serverInfo.server_info?.wordpress_version || 'Desconocido'}\n`;
            diagnosticMessage += `• PHP: ${serverInfo.server_info?.php_version || 'Desconocido'}\n`;
            diagnosticMessage += `• Servidor: ${serverInfo.server_info?.server_software || 'Desconocido'}\n`;
            diagnosticMessage += `• WP-CLI: ${serverInfo.wp_cli?.available ? 'Disponible' : 'No disponible'}\n`;
            diagnosticMessage += `• Método recomendado: ${serverInfo.recommended_method || 'API nativa'}\n\n`;
            
            if (serverInfo.execution_capabilities) {
                const capabilities = serverInfo.execution_capabilities;
                diagnosticMessage += `**Capacidades de Ejecución:**\n`;
                diagnosticMessage += `• shell_exec: ${capabilities.shell_exec ? '✅' : '❌'}\n`;
                diagnosticMessage += `• exec: ${capabilities.exec ? '✅' : '❌'}\n`;
                diagnosticMessage += `• system: ${capabilities.system ? '✅' : '❌'}\n`;
                diagnosticMessage += `• passthru: ${capabilities.passthru ? '✅' : '❌'}\n\n`;
            }
            
            diagnosticMessage += `✅ Diagnóstico completado. Tu sitio está configurado correctamente.`;
            
            this.addMessage('assistant', diagnosticMessage);
            
        } catch (error) {
            console.error('❌ Error en autodiagnóstico:', error);
            this.addMessage('assistant', '❌ Error ejecutando autodiagnóstico. Verifica que tu sitio esté conectado correctamente.');
        }
    }

    async runCleanup() {
        if (!this.currentSite) {
            this.addMessage('assistant', '⚠️ Necesitas conectar un sitio WordPress primero. Usa el botón ⚙️ para configurar tu sitio.');
            return;
        }

        this.addMessage('user', '🧹 Ejecutar limpieza y optimización');
        
        try {
            // Ejecutar comandos de limpieza
            const cleanupCommands = [
                'wp cache flush',
                'wp db clean',
                'wp db optimize'
            ];
            
            let cleanupMessage = `🧹 **Limpieza y Optimización Iniciada**\n\n`;
            
            for (const command of cleanupCommands) {
                try {
                    const result = await this.executeCommand(command);
                    cleanupMessage += `✅ ${command}: Completado\n`;
                } catch (error) {
                    cleanupMessage += `⚠️ ${command}: ${error.message}\n`;
                }
            }
            
            cleanupMessage += `\n🎉 Proceso de limpieza completado. Tu sitio ha sido optimizado.`;
            
            this.addMessage('assistant', cleanupMessage);
            
        } catch (error) {
            console.error('❌ Error en limpieza:', error);
            this.addMessage('assistant', '❌ Error ejecutando limpieza. Algunos comandos pueden no estar disponibles en tu hosting.');
        }
    }

    clearChatHistory() {
        // Limpiar el área de chat
        this.chatArea.innerHTML = '';
        
        // Limpiar historial en memoria
        this.chatHistory = [];
        
        // Añadir mensaje de bienvenida
        this.addMessage('assistant', `¡Hola! Soy Gemini WP-Agent, tu asistente conversacional especializado en WordPress. 

Puedo ayudarte con:
🔧 Gestionar tu sitio WordPress (plugins, temas, usuarios, contenido)
🎨 Generar código CSS, JavaScript, PHP personalizado
💬 Responder preguntas sobre desarrollo web
📝 Crear contenido con bloques de Gutenberg
🗄️ Optimizar y mantener tu base de datos

¿En qué puedo ayudarte hoy?`);
        
        console.log('🗑️ Historial de chat limpiado');
    }

    // Actualizar información del sitio en la sidebar
    updateSidebarSiteInfo() {
        console.log('🔄 Actualizando información del sitio en sidebar y header...');
        
        const connectedSiteInfo = document.getElementById('connectedSiteInfo');
        const currentSiteName = document.getElementById('currentSiteName');
        const currentSiteUrl = document.getElementById('currentSiteUrl');
        const currentSiteStatus = document.getElementById('currentSiteStatus');
        
        // 🆕 Elementos del header
        const activeSiteIndicator = document.getElementById('activeSiteIndicator');
        const activeSiteName = document.getElementById('activeSiteName');
        
        console.log('📊 Sitio actual:', this.currentSite?.name || 'Ninguno');
        console.log('📊 Elementos encontrados:', {
            connectedSiteInfo: !!connectedSiteInfo,
            activeSiteIndicator: !!activeSiteIndicator,
            activeSiteName: !!activeSiteName
        });
        
        if (this.currentSite) {
            // Actualizar sidebar
            if (connectedSiteInfo) {
                connectedSiteInfo.style.display = 'block';
            }
            if (currentSiteName) {
                currentSiteName.textContent = this.currentSite.name;
            }
            if (currentSiteUrl) {
                currentSiteUrl.textContent = this.currentSite.url;
            }
            
            if (currentSiteStatus) {
                if (this.currentSite.status === 'connected') {
                    currentSiteStatus.textContent = 'Conectado';
                    currentSiteStatus.className = 'site-status connected';
                } else {
                    currentSiteStatus.textContent = 'Desconectado';
                    currentSiteStatus.className = 'site-status disconnected';
                }
            }
            
            // 🆕 Actualizar indicador del header
            if (activeSiteIndicator) {
                activeSiteIndicator.style.display = 'flex';
                console.log('✅ Mostrando indicador de sitio activo');
            }
            if (activeSiteName) {
                activeSiteName.textContent = this.currentSite.name;
                console.log('✅ Nombre del sitio actualizado en header:', this.currentSite.name);
            }
            
        } else {
            // Sin sitio conectado
            if (connectedSiteInfo) {
                connectedSiteInfo.style.display = 'none';
            }
            if (activeSiteIndicator) {
                activeSiteIndicator.style.display = 'none';
                console.log('❌ Ocultando indicador de sitio activo');
            }
        }
        
        // Actualizar estado de API
        const apiStatusValue = document.getElementById('apiStatusValue');
        if (apiStatusValue) {
            if (this.hasGlobalGeminiApiKey()) {
                apiStatusValue.textContent = 'API Key personal (ilimitada)';
                apiStatusValue.className = 'api-status-value';
            } else {
                apiStatusValue.textContent = 'Consultas gratuitas (50/hora)';
                apiStatusValue.className = 'api-status-value free';
            }
        }
        
        // 🆕 Actualizar desplegable de sitios
        this.updateSiteDropdown();
        
        console.log('✅ Información del sitio actualizada correctamente');
    }

    // 🆕 Función para actualizar el desplegable de sitios - VERSIÓN SIMPLIFICADA
    updateSiteDropdown() {
        console.log('📋 Actualizando desplegable de sitios...');
        const siteDropdownList = document.getElementById('siteDropdownList');
        
        if (!siteDropdownList) {
            console.error('❌ Elemento siteDropdownList no encontrado');
            return;
        }
        
        // Limpiar contenido
        siteDropdownList.innerHTML = '';
        
        if (this.savedSites.length === 0) {
            siteDropdownList.innerHTML = `
                <div style="padding: 12px 16px; text-align: center; color: #888;">
                    No hay sitios configurados
                </div>
            `;
            return;
        }
        
        // Crear elementos de sitios con estilos inline
        this.savedSites.forEach((site) => {
            const isActive = this.currentSite?.id === site.id;
            const statusText = site.status === 'connected' ? 'Conectado' : 'Desconectado';
            const statusColor = site.status === 'connected' ? '#27ca3f' : '#ff5f56';
            
            const siteItem = document.createElement('div');
            siteItem.style.cssText = `
                padding: 12px 16px;
                cursor: pointer;
                border-bottom: 1px solid #333;
                color: #e0e0e0;
                transition: background-color 0.2s ease;
                ${isActive ? 'background-color: rgba(39, 202, 63, 0.1); border-left: 3px solid #27ca3f;' : ''}
            `;
            
            siteItem.innerHTML = `
                <div style="font-size: 14px; font-weight: 500; margin-bottom: 2px;">${site.name}</div>
                <div style="font-size: 11px; color: #888; margin-bottom: 4px;">${site.url}</div>
                <div style="font-size: 10px; padding: 2px 6px; border-radius: 4px; display: inline-block; background-color: rgba(${statusColor === '#27ca3f' ? '39, 202, 63' : '255, 95, 86'}, 0.2); color: ${statusColor};">${statusText}</div>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    ${!isActive ? `<button onclick="window.geminiApp.selectSiteFromDropdown('${site.id}')" style="background: none; border: 1px solid #404040; color: #888; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">Usar</button>` : '<span style="color: #27ca3f; font-size: 10px;">● Activo</span>'}
                    <button onclick="window.geminiApp.deleteSiteFromDropdown('${site.id}')" style="background: none; border: 1px solid #404040; color: #888; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">Desconectar</button>
                </div>
            `;
            
            // Efectos hover
            siteItem.addEventListener('mouseenter', () => {
                if (!isActive) siteItem.style.backgroundColor = '#404040';
            });
            siteItem.addEventListener('mouseleave', () => {
                if (!isActive) siteItem.style.backgroundColor = 'transparent';
            });
            
            siteDropdownList.appendChild(siteItem);
        });
        
        console.log('✅ Desplegable actualizado correctamente');
    }

    // 🆕 Función para seleccionar sitio desde el desplegable
    selectSiteFromDropdown(siteId) {
        this.selectSite(siteId);
        this.hideSiteDropdown();
    }

    // 🆕 Función para eliminar sitio desde el desplegable
    deleteSiteFromDropdown(siteId) {
        const site = this.savedSites.find(s => s.id === siteId);
        if (!site) return;
        
        if (confirm(`¿Estás seguro de que quieres desconectar "${site.name}"?\n\nEsto eliminará la configuración guardada de este sitio.`)) {
            this.deleteSite(siteId);
            this.updateSiteDropdown();
            
            // Mostrar mensaje de confirmación
            this.addMessage('assistant', 
                `<strong>🔌 Sitio desconectado</strong><br><br>
                Se ha eliminado la configuración de: <code>${site.name}</code><br>
                URL: <span style="color: #888;">${site.url}</span><br><br>
                <em>Puedes volver a conectarlo cuando quieras usando el botón ⚙️</em>`
            );
        }
    }

    // 🆕 IMPLEMENTACIÓN SIMPLIFICADA DEL DROPDOWN
    
    // 🆕 Función para mostrar/ocultar el desplegable
    toggleSiteDropdown() {
        console.log('🔄 toggleSiteDropdown llamado');
        const dropdown = document.getElementById('siteDropdown');
        
        if (!dropdown) {
            console.error('❌ Elemento siteDropdown no encontrado en el DOM');
            return;
        }
        
        const isVisible = dropdown.style.display === 'block';
        console.log('📂 Estado actual del dropdown:', isVisible ? 'visible' : 'oculto');
        
        if (isVisible) {
            this.hideSiteDropdown();
        } else {
            this.showSiteDropdown();
        }
    }

    // 🆕 Función para mostrar el desplegable - VERSIÓN SIMPLIFICADA
    showSiteDropdown() {
        console.log('📂 Mostrando desplegable de sitios');
        const dropdown = document.getElementById('siteDropdown');
        
        if (!dropdown) {
            console.error('❌ Elemento siteDropdown no encontrado');
            return;
        }
        
        // Actualizar contenido primero
        this.updateSiteDropdown();
        
        // Mostrar con estilos inline para forzar visibilidad
        dropdown.style.cssText = `
            display: block !important;
            position: absolute !important;
            top: 100% !important;
            right: 0 !important;
            background-color: #2d2d2d !important;
            border: 1px solid #404040 !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
            z-index: 9999 !important;
            min-width: 250px !important;
            max-height: 300px !important;
            overflow-y: auto !important;
            margin-top: 4px !important;
        `;
        
        // Añadir clase para animación
        dropdown.classList.add('show');
        
        // Event listener para cerrar al hacer clic fuera
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick.bind(this), { once: true });
        }, 100);
        
        console.log('✅ Dropdown mostrado con estilos inline');
    }

    // 🆕 Función para ocultar el desplegable - VERSIÓN SIMPLIFICADA
    hideSiteDropdown() {
        console.log('📂 Ocultando desplegable de sitios');
        const dropdown = document.getElementById('siteDropdown');
        
        if (!dropdown) return;
        
        dropdown.style.display = 'none';
        dropdown.classList.remove('show');
        
        console.log('✅ Dropdown ocultado');
    }

    // 🆕 Función para manejar clics fuera - VERSIÓN SIMPLIFICADA
    handleOutsideClick(event) {
        const dropdown = document.getElementById('siteDropdown');
        const indicator = document.getElementById('activeSiteIndicator');
        
        if (!dropdown || !indicator) return;
        
        // Si el clic fue fuera del dropdown y del indicador, cerrar
        if (!dropdown.contains(event.target) && !indicator.contains(event.target)) {
            console.log('👆 Clic fuera detectado, cerrando dropdown');
            this.hideSiteDropdown();
        }
    }

    // Función para normalizar texto de Gemini antes del renderizado Markdown
    normalizeGeminiMarkdown(text) {
        if (!text) return text;
        
        console.log('🔧 Normalizando texto de Gemini...');
        
        // Debug: mostrar algunos caracteres problemáticos
        const problematicChars = text.match(/[\u2018\u2019\u00B4\u201C\u201D\u2028\u2029\u200B-\u200D\uFEFF]/g);
        if (problematicChars) {
            console.log('⚠️ Caracteres problemáticos encontrados:', problematicChars.map(c => `${c} (U+${c.charCodeAt(0).toString(16).toUpperCase()})`));
        }
        
        return text
            // Normalizar backticks falsos a backticks ASCII
            .replace(/[\u2018\u2019\u00B4]/g, '`')  // Comillas curvas y acento agudo → backtick
            .replace(/[\u201C\u201D]/g, '"')        // Comillas dobles curvas → comillas ASCII
            
            // Normalizar saltos de línea
            .replace(/\r\n/g, '\n')                // Windows line endings → Unix
            .replace(/\u2028|\u2029/g, '\n')       // Unicode line/paragraph separators → \n
            
            // Eliminar caracteres invisibles
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces, BOM, etc.
            
            // Normalizar espacios no estándar
            .replace(/\u00A0/g, ' ')               // Non-breaking space → space
            .replace(/\u2000-\u200A/g, ' ')        // Various Unicode spaces → space
            
            // Limpiar múltiples espacios y líneas vacías excesivas
            .replace(/[ \t]+/g, ' ')               // Multiple spaces/tabs → single space
            .replace(/\n{3,}/g, '\n\n');           // Multiple newlines → max 2
    }

    // Función para renderizar Markdown básico
    renderMarkdown(content) {
        console.log('🔧 renderMarkdown iniciado, contenido:', content?.substring(0, 100) + '...');
        
        if (!content) {
            console.log('❌ Contenido vacío, retornando string vacío');
            return '';
        }
        
        // NORMALIZAR CONTENIDO ANTES DE PROCESAR
        const normalizedContent = this.normalizeGeminiMarkdown(content);
        console.log('✅ Contenido normalizado');
        
        // Debug: comparar contenido original vs normalizado
        if (content !== normalizedContent) {
            console.log('🔄 Contenido cambió después de normalización');
            console.log('📄 Original (primeros 200 chars):', content.substring(0, 200));
            console.log('📄 Normalizado (primeros 200 chars):', normalizedContent.substring(0, 200));
        }
        
        let formatted = normalizedContent;
        console.log('📝 Contenido a procesar:', formatted.length, 'caracteres');
        
        // 🔍 DEBUG AVANZADO: Analizar el contenido completo
        console.log('🔍 ANÁLISIS COMPLETO DEL CONTENIDO:');
        console.log('📄 Contenido completo:', formatted);
        
        // Buscar diferentes patrones de código
        const patterns = {
            'triple_backticks': /```[\s\S]*?```/g,
            'triple_backticks_with_lang': /```\w+[\s\S]*?```/g,
            'single_backticks': /`[^`]+`/g,
            'code_word': /código|code|php|css|javascript|html/gi
        };
        
        Object.entries(patterns).forEach(([name, pattern]) => {
            const matches = formatted.match(pattern);
            console.log(`🔍 Patrón ${name}:`, matches?.length || 0, matches ? matches.slice(0, 3) : 'ninguno');
        });
        
        // Procesar bloques de código con contenido normalizado
        const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
        const codeMatches = formatted.match(codeBlockRegex);
        console.log('🔍 Bloques de código encontrados:', codeMatches?.length || 0);
        
        // 🆕 DETECTAR CÓDIGO SIN TRIPLE BACKTICKS (formato Gemini alternativo)
        if ((!codeMatches || codeMatches.length === 0)) {
            console.log('🔍 Buscando patrones alternativos de código...');
            
            // Patrón: "css" o "php" seguido directamente de código (sin backticks)
            const altCodeRegex = /\n(css|php|javascript|js|html|sql|bash|python|py)\n?([\s\S]*?)(?=\n\n|\*\*|$)/gi;
            const altMatches = formatted.match(altCodeRegex);
            
            if (altMatches && altMatches.length > 0) {
                console.log('✅ Encontrados bloques alternativos:', altMatches.length);
                
                formatted = formatted.replace(altCodeRegex, (match, language, code) => {
                    const lang = language.toLowerCase();
                    const cleanCode = code.trim();
                    const codeId = 'code_' + Math.random().toString(36).substr(2, 9);
                    const displayName = this.getLanguageDisplayName(lang);
                    
                    console.log('🎨 Procesando bloque alternativo:', { lang, displayName, codeLength: cleanCode.length });
                    
                    return `
                        <div class="code-block">
                            <div class="code-header">
                                <span class="code-language language-${lang}">${displayName}</span>
                                <button class="copy-button" onclick="copyCodeToClipboard('${codeId}', this)">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    Copiar código
                                </button>
                            </div>
                            <pre class="code-content" id="${codeId}"><code class="language-${lang}">${this.escapeHtml(cleanCode)}</code></pre>
                        </div>
                    `;
                });
            }
        }
        
        // Debug: si no encuentra bloques, mostrar muestra del contenido
        if (!codeMatches || codeMatches.length === 0) {
            console.log('🔍 Buscando backticks en el contenido...');
            const backtickMatches = formatted.match(/`/g);
            console.log('📊 Backticks ASCII encontrados:', backtickMatches?.length || 0);
            
            // Mostrar contexto alrededor de posibles bloques de código
            const possibleCodeBlocks = formatted.match(/```[\s\S]{0,50}/g);
            if (possibleCodeBlocks) {
                console.log('🔍 Posibles inicios de bloques:', possibleCodeBlocks);
            }
            
            // 🆕 Buscar patrones alternativos que Gemini podría usar
            const alternativePatterns = [
                /\n\s*```[\s\S]*?```\s*\n/g,  // Con espacios alrededor
                /```[^`]*```/g,                // Sin saltos de línea internos
                /`{3,}[\s\S]*?`{3,}/g         // 3 o más backticks
            ];
            
            alternativePatterns.forEach((pattern, index) => {
                const altMatches = formatted.match(pattern);
                if (altMatches) {
                    console.log(`🔍 Patrón alternativo ${index + 1}:`, altMatches.length, altMatches);
                }
            });
        }
        
        formatted = formatted.replace(codeBlockRegex, (match, language, code) => {
            const lang = language || 'text';
            const cleanCode = code.trim();
            const codeId = 'code_' + Math.random().toString(36).substr(2, 9);
            const displayName = this.getLanguageDisplayName(lang);
            
            console.log('🎨 Procesando bloque de código:', { lang, displayName, codeLength: cleanCode.length });
            
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="code-language language-${lang}">${displayName}</span>
                        <button class="copy-button" onclick="copyCodeToClipboard('${codeId}', this)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copiar código
                        </button>
                    </div>
                    <pre class="code-content" id="${codeId}"><code class="language-${lang}">${this.escapeHtml(cleanCode)}</code></pre>
                </div>
            `;
        });
        
        // Procesar encabezados
        formatted = formatted
            .replace(/^### (.*$)/gm, '<h3 class="response-h3">$1</h3>')
            .replace(/^## (.*$)/gm, '<h2 class="response-h2">$1</h2>')
            .replace(/^# (.*$)/gm, '<h1 class="response-h1">$1</h1>');
        
        // Procesar párrafos
        formatted = formatted
            .split('\n\n')
            .map(paragraph => {
                const trimmed = paragraph.trim();
                if (trimmed && !trimmed.startsWith('<')) {
                    return `<p class="response-paragraph">${trimmed}</p>`;
                }
                return trimmed;
            })
            .join('\n\n');
        
        // Procesar texto en negrita y cursiva
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="text-highlight">$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em class="text-emphasis">$1</em>');
        
        // Procesar código inline
        formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        
        console.log('✅ Renderizado completado, longitud final:', formatted.length);
        
        // Debug: verificar si se generaron bloques de código
        const codeBlockCount = (formatted.match(/class="code-block"/g) || []).length;
        console.log('🔍 Bloques de código generados en HTML:', codeBlockCount);
        
        if (codeBlockCount > 0) {
            console.log('📄 HTML generado (primeros 500 chars):', formatted.substring(0, 500));
        }
        
        return formatted;
    }

    // Obtener nombre de display para el lenguaje
    getLanguageDisplayName(lang) {
        const languageNames = {
            'js': 'JavaScript',
            'javascript': 'JavaScript',
            'php': 'PHP',
            'html': 'HTML',
            'css': 'CSS',
            'bash': 'Bash',
            'shell': 'Shell',
            'sql': 'SQL',
            'json': 'JSON',
            'xml': 'XML',
            'yaml': 'YAML',
            'yml': 'YAML',
            'python': 'Python',
            'py': 'Python',
            'text': 'Texto',
            'txt': 'Texto'
        };
        
        return languageNames[lang.toLowerCase()] || lang.toUpperCase();
    }

    // Escapar HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Inicializar la aplicación cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando Gemini WP-CLI Terminal...');
    
    try {
        window.geminiApp = new GeminiWPCLI();
        console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error);
        
        // Mostrar error en la interfaz
        const chatArea = document.getElementById('chatArea');
        if (chatArea) {
            chatArea.innerHTML = `
                <div class="message assistant">
                    <div class="message-content">
                        <div class="error-message">
                            ❌ Error al inicializar la aplicación: ${error.message}<br><br>
                            Por favor, recarga la página o revisa la consola del navegador.
                        </div>
                    </div>
                </div>
            `;
        }
    }
});

// Función global para copiar código al portapapeles
function copyCodeToClipboard(codeId, button) {
    const codeElement = document.getElementById(codeId);
    if (!codeElement) return;
    
    // Obtener el texto del código (sin el HTML de highlight.js)
    const code = codeElement.textContent || codeElement.innerText;
    const originalText = button.innerHTML;
    
    navigator.clipboard.writeText(code).then(() => {
        // Cambiar el botón temporalmente
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
            ¡Copiado!
        `;
        button.classList.add('copied');
        
        // Restaurar después de 2 segundos
        setTimeout(() => {
            button.innerHTML = originalText;
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Error al copiar:', err);
        // Fallback para navegadores más antiguos
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
                ¡Copiado!
            `;
            button.classList.add('copied');
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('copied');
            }, 2000);
        } catch (fallbackErr) {
            console.error('Error en fallback de copia:', fallbackErr);
        } finally {
            document.body.removeChild(textArea);
        }
    });
}

// 🧪 Función de prueba para simular respuesta de Gemini con código
function testGeminiResponseWithCode() {
    console.log('🧪 INICIANDO PRUEBA DE RESPUESTA GEMINI CON CÓDIGO');
    
    // Simular diferentes tipos de respuestas que Gemini podría enviar
    const testResponses = [
        {
            name: 'Respuesta con código CSS normal',
            content: `¡Hola! Claro, puedo ayudarte con eso.

Para dejar fijo un header en WordPress, normalmente necesitas añadir CSS personalizado. Aquí tienes el código:

\`\`\`css
.site-header {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 999;
    background: #fff;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

body {
    padding-top: 80px; /* Ajusta según la altura de tu header */
}
\`\`\`

Este código hará que tu header se mantenga fijo en la parte superior de la página.`
        },
        {
            name: 'Respuesta con caracteres Unicode problemáticos',
            content: `¡Hola! Claro, puedo ayudarte con eso.

Para dejar fijo un header en WordPress, normalmente necesitas añadir CSS personalizado. Aquí tienes el código:

\u2018\u2018\u2018css
.site-header {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 999;
    background: #fff;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

body {
    padding-top: 80px; /* Ajusta según la altura de tu header */
}
\u2019\u2019\u2019

Este código hará que tu header se mantenga fijo en la parte superior de la página.`
        }
    ];
    
    testResponses.forEach((testResponse, index) => {
        console.log(`\n🧪 PRUEBA ${index + 1}: ${testResponse.name}`);
        console.log('📄 Contenido original:', testResponse.content);
        
        if (window.geminiApp && window.geminiApp.renderMarkdown) {
            const result = window.geminiApp.renderMarkdown(testResponse.content);
            console.log('✅ Resultado renderizado:', result);
            
            // Añadir el mensaje a la interfaz
            window.geminiApp.addMessage('assistant', testResponse.content);
        } else {
            console.error('❌ window.geminiApp no disponible');
        }
    });
    
    console.log('\n🧪 PRUEBAS COMPLETADAS');
}
// 🧪 Función de prueba específica para formato Gemini sin backticks
function testGeminiAlternativeFormat() {
    console.log('🧪 INICIANDO PRUEBA DE FORMATO ALTERNATIVO GEMINI');
    
    // Simular la respuesta real que recibiste de Gemini
    const realGeminiResponse = `¡Claro que sí! Para dejar fijo un header en WordPress, generalmente necesitas aplicar algo de CSS. Aquí tienes un ejemplo básico que puedes añadir a tu archivo \`style.css\` del tema hijo, o en el personalizador de WordPress (Apariencia > Personalizar > CSS Adicional):

css
/* Para un header fijo en la parte superior */
.site-header { /* O el selector de tu header, como #masthead, #header, etc. */
    position: fixed;
    top: 0;
    width: 100%; /* Asegura que ocupe todo el ancho */
    background-color: #ffffff; /* Un color de fondo para que el contenido no se vea a través */
    z-index: 1000; /* Asegura que el header esté por encima de otros elementos */
    box-shadow: 0 2px 5px rgba(0,0,0,0.1); /* Opcional: una sombra sutil */
}

/* IMPORTANTE: Añade un padding al body para que el contenido no quede debajo del header fijo */
body {
    padding-top: 80px; /* Ajusta este valor según la altura de tu header */
}

**Explicación:**

1. **\`.site-header\`**: Este es un selector de ejemplo.`;
    
    console.log('📄 Contenido de prueba (formato real Gemini):', realGeminiResponse);
    
    if (window.geminiApp && window.geminiApp.renderMarkdown) {
        const result = window.geminiApp.renderMarkdown(realGeminiResponse);
        console.log('✅ Resultado renderizado:', result);
        
        // Añadir el mensaje a la interfaz
        window.geminiApp.addMessage('assistant', realGeminiResponse);
    } else {
        console.error('❌ window.geminiApp no disponible');
    }
    
    console.log('🧪 PRUEBA DE FORMATO ALTERNATIVO COMPLETADA');
}