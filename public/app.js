// 🚀 VERSIÓN 3.4 - DETECCIÓN DE CÓDIGO SIN TRIPLE BACKTICKS IMPLEMENTADA
console.log('🔥 APP.JS v3.4 LOADED - DETECTS GEMINI CODE WITHOUT BACKTICKS 🔥');

class GeminiWPCLI {
    constructor() {
        console.log('🔧 Initializing constructor...');
        
        // Verify DOM elements
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
        
        // Debug: verify that all elements exist
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
        
        console.log('🔍 DOM Elements:', elements);
        
        // Verify critical elements
        const missingElements = [];
        Object.entries(elements).forEach(([name, element]) => {
            if (!element) {
                missingElements.push(name);
            }
        });
        
        if (missingElements.length > 0) {
            console.error('❌ Missing elements:', missingElements);
            throw new Error(`Missing DOM elements: ${missingElements.join(', ')}`);
        }
        
        console.log('✅ All DOM elements found');
        
        // Use base configuration
        this.config = CONFIG;
        console.log('📋 Configuration loaded:', this.config);
        
        // Current active site configuration
        this.currentSite = null;
        
        // Server status and capabilities
        this.serverCapabilities = null;
        this.emulationMode = false;
        
        // 🧠 Enhanced session memory system
        this.sessionMemory = {
            chatHistory: [],
            siteContext: null,
            executedActions: [],
            sessionStartTime: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };
        
        // 📝 Code snippets system (v0.1)
        this.codeSnippets = this.loadCodeSnippets();
        
        // 🔑 Global Gemini API Key (new functionality)
        this.globalGeminiApiKey = this.loadGlobalGeminiApiKey();
        
        // Load saved sites
        console.log('💾 Loading saved sites...');
        this.loadSavedSites();
        
        console.log('🎧 Initializing event listeners...');
        this.initializeEventListeners();
        
        console.log('📏 Configuring textarea...');
        this.autoResizeTextarea();
        
        console.log('🌐 Checking server connection...');
        this.checkServerConnection();
        
        console.log('🎉 Constructor completed successfully');
    }

    // 🔑 Gestión de API Key global de Gemini
    loadGlobalGeminiApiKey() {
        try {
            const apiKey = localStorage.getItem('gemini_global_api_key');
            console.log('🔑 Global API Key loaded:', apiKey ? 'Yes (hidden for security)' : 'No');
            return apiKey || '';
        } catch (error) {
            console.error('❌ Error loading global API Key:', error);
            return '';
        }
    }

    saveGlobalGeminiApiKey(apiKey) {
        try {
            if (apiKey && apiKey.trim()) {
                localStorage.setItem('gemini_global_api_key', apiKey.trim());
                console.log('✅ Global API Key saved');
            } else {
                localStorage.removeItem('gemini_global_api_key');
                console.log('🗑️ Global API Key deleted');
            }
            this.globalGeminiApiKey = apiKey.trim();
        } catch (error) {
            console.error('❌ Error saving global API Key:', error);
        }
    }

    hasGlobalGeminiApiKey() {
        return this.globalGeminiApiKey && this.globalGeminiApiKey.length > 0;
    }

    // 🧠 Enhanced session memory management
    addToSessionMemory(role, message, additionalData = {}) {
        const memoryEntry = {
            role: role, // 'user', 'assistant', 'system'
            message: message,
            timestamp: new Date().toISOString(),
            sessionTime: Date.now() - new Date(this.sessionMemory.sessionStartTime).getTime(),
            ...additionalData
        };
        
        // Add to chat history
        this.sessionMemory.chatHistory.push(memoryEntry);
        
        // Keep only the last 10 messages for better context
        if (this.sessionMemory.chatHistory.length > 10) {
            this.sessionMemory.chatHistory.shift();
        }
        
        // Update last activity
        this.sessionMemory.lastActivity = new Date().toISOString();
        
        console.log('🧠 Session memory updated:', {
            totalMessages: this.sessionMemory.chatHistory.length,
            executedActions: this.sessionMemory.executedActions.length,
            sessionDuration: this.getSessionDuration()
        });
    }

    // 🧠 Add executed action to memory
    addActionToMemory(action) {
        const actionEntry = {
            timestamp: new Date().toISOString(),
            sessionTime: Date.now() - new Date(this.sessionMemory.sessionStartTime).getTime(),
            ...action
        };
        
        this.sessionMemory.executedActions.push(actionEntry);
        
        // Keep only the last 20 actions
        if (this.sessionMemory.executedActions.length > 20) {
            this.sessionMemory.executedActions.shift();
        }
        
        console.log('🧠 Action added to memory:', action.type || 'unknown');
    }

    // 🧠 Update site context in memory
    updateSiteContextInMemory() {
        if (this.currentSite) {
            this.sessionMemory.siteContext = {
                siteName: this.currentSite.name,
                siteUrl: this.currentSite.url,
                connectedAt: new Date().toISOString(),
                serverCapabilities: this.serverCapabilities,
                emulationMode: this.emulationMode
            };
        } else {
            this.sessionMemory.siteContext = null;
        }
        
        console.log('🧠 Site context updated in memory:', this.sessionMemory.siteContext?.siteName || 'No site');
    }

    // 🧠 Get formatted conversation history for Gemini
    getFormattedSessionHistory() {
        const recentHistory = this.sessionMemory.chatHistory.slice(-8); // Last 8 messages for context
        
        return recentHistory.map(entry => {
            let formattedEntry = `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.message}`;
            
            // Add command context if available
            if (entry.gemini_data?.command) {
                formattedEntry += ` [Executed: ${entry.gemini_data.command}]`;
            }
            
            // Add action context if available
            if (entry.action_type) {
                formattedEntry += ` [Action: ${entry.action_type}]`;
            }
            
            return formattedEntry;
        }).join('\n');
    }

    // 🧠 Get session context for Gemini
    getSessionContextForGemini() {
        const sessionDuration = this.getSessionDuration();
        const recentActions = this.sessionMemory.executedActions.slice(-5); // Last 5 actions
        
        return {
            session_duration_minutes: Math.round(sessionDuration / 60000),
            total_messages: this.sessionMemory.chatHistory.length,
            recent_actions: recentActions.map(action => ({
                type: action.type,
                description: action.description,
                timestamp: action.timestamp,
                success: action.success
            })),
            site_context: this.sessionMemory.siteContext,
            conversation_history: this.getFormattedSessionHistory()
        };
    }

    // 🧠 Get session duration in milliseconds
    getSessionDuration() {
        return Date.now() - new Date(this.sessionMemory.sessionStartTime).getTime();
    }

    // 🧠 Clear session memory
    clearSessionMemory() {
        const oldSessionDuration = this.getSessionDuration();
        
        this.sessionMemory = {
            chatHistory: [],
            siteContext: this.currentSite ? {
                siteName: this.currentSite.name,
                siteUrl: this.currentSite.url,
                connectedAt: new Date().toISOString()
            } : null,
            executedActions: [],
            sessionStartTime: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };
        
        console.log('🧠 Session memory cleared. Previous session duration:', Math.round(oldSessionDuration / 60000), 'minutes');
        
        // Show confirmation message to user
        this.addMessage('assistant', 
            `<strong>🧠 Session memory cleared</strong><br><br>
            Conversation history and context have been reset. Starting fresh session.<br>
            <small style="color: #8e8ea0;">Previous session duration: ${Math.round(oldSessionDuration / 60000)} minutes</small>`
        );
    }

    // 🧠 Legacy compatibility - keep existing chatHistory property
    get chatHistory() {
        return this.sessionMemory.chatHistory;
    }

    // 🧠 Legacy compatibility methods
    addToHistory(role, message, geminiResponse = null) {
        const additionalData = {};
        
        if (role === 'assistant' && geminiResponse) {
            additionalData.gemini_data = {
                command: geminiResponse.command,
                explanation: geminiResponse.explanation,
                is_safe: geminiResponse.is_safe,
                is_conversational: geminiResponse.is_conversational,
                stateless_mode: geminiResponse.stateless_mode
            };
        }
        
        this.addToSessionMemory(role, message, additionalData);
    }

    getFormattedHistory() {
        return this.getFormattedSessionHistory();
    }

    clearHistory() {
        this.clearSessionMemory();
    }

    async performAutodiagnosis() {
        // Autodiagnosis disabled - not needed with Abilities API
        console.log('⏭️ Autodiagnosis disabled');
        return;
        
        /* DISABLED CODE - Original autodiagnosis logic
        if (!this.currentSite) {
            console.log('⏭️ Skipping autodiagnosis: no site configured');
            return;
        }

        console.log('🔍 Starting WordPress server autodiagnosis...');
        
        try {
            // Show diagnosis message
            this.addMessage('assistant', 
                `<strong>🔍 Autodiagnosis in progress...</strong><br><br>
                Analyzing your WordPress server capabilities to optimize the experience.`
            );

            // Llamar al endpoint de server-info
            const serverInfo = await this.getServerInfo();
            
            if (serverInfo && serverInfo.wp_cli) {
                this.serverCapabilities = serverInfo;
                this.emulationMode = !serverInfo.wp_cli.available;
                
                console.log('📊 Server capabilities:', serverInfo);
                console.log('🔧 Emulation mode:', this.emulationMode ? 'ENABLED' : 'DISABLED');
                
                // Show message according to detected capabilities
                if (this.emulationMode) {
                    this.addMessage('assistant', 
                        `<strong>🤖 Autodiagnosis completed</strong><br><br>
                        I detected that your hosting is restrictive and doesn't have WP-CLI installed.<br><br>
                        <strong>✅ Activating Native Emulation Mode</strong><br>
                        • Maximum compatibility with restrictive hosting<br>
                        • Uses WordPress native API<br>
                        • Complete functionality guaranteed<br><br>
                        <em>🛡️ Your site is ready to use with total security.</em>`
                    );
                } else {
                    this.addMessage('assistant', 
                        `<strong>🚀 Autodiagnosis completed</strong><br><br>
                        Excellent! Your server has WP-CLI installed and execution functions available.<br><br>
                        <strong>✅ High Performance Mode Activated</strong><br>
                        • Real WP-CLI: <span style="color: #00ff88;">${serverInfo.wp_cli.version}</span><br>
                        • Method: <span style="color: #00ff88;">${serverInfo.wp_cli.method}</span><br>
                        • Available functions: <span style="color: #00ff88;">${this.getAvailableFunctions(serverInfo)}</span><br><br>
                        <em>⚡ Optimal performance guaranteed.</em>`
                    );
                }
                
                // Update interface status
                this.updateServerStatusIndicator();
                
            } else {
                throw new Error('Could not get server information');
            }
            
        } catch (error) {
            console.error('❌ Error in autodiagnosis:', error);
            this.emulationMode = true; // Activate safe mode by default
            
            this.addMessage('assistant', 
                `<strong>⚠️ Autodiagnosis with warnings</strong><br><br>
                I couldn't connect completely with your server, but don't worry.<br><br>
                <strong>🛡️ Activating Safe Mode</strong><br>
                • Maximum compatibility activated<br>
                • Basic functionality guaranteed<br>
                • All safe commands available<br><br>
                <em>Error: ${error.message}</em>`
            );
        }
        */
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
                <span>Emulation Mode</span>
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
        console.log('💾 Starting saved sites loading...');
        
        try {
            const savedData = localStorage.getItem('gemini-wp-cli-sites');
            const now = new Date().getTime();
            
            if (savedData) {
                console.log('📄 Datos encontrados en localStorage');
                const sitesData = JSON.parse(savedData);
                
                // Filter sites that haven't expired (30 days)
                this.savedSites = sitesData.sites.filter(site => {
                    const siteAge = now - new Date(site.savedAt).getTime();
                    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
                    return siteAge < thirtyDays;
                });
                
                // Load active site
                const activeSiteId = sitesData.activeSiteId;
                this.currentSite = this.savedSites.find(site => site.id === activeSiteId) || null;
                
                console.log(`✅ Loaded ${this.savedSites.length} sites from localStorage`);
                
            } else {
                console.log('📄 No saved data, initializing empty arrays');
                this.savedSites = [];
                this.currentSite = null;
            }
            
            // If there are no sites or the active one expired, show modal after some time
            if (this.savedSites.length === 0 || !this.currentSite) {
                console.log('⏰ Scheduling configuration modal display in 2 seconds...');
                setTimeout(() => {
                    console.log('⏰ Executing scheduled modal display...');
                    this.showConfigModal();
                }, 2000);
            }
            
        } catch (error) {
            console.warn('⚠️ Error loading saved sites:', error);
            this.savedSites = [];
            this.currentSite = null;
            
            console.log('⏰ Scheduling error modal display in 2 seconds...');
            setTimeout(() => {
                console.log('⏰ Executing error modal display...');
                this.showConfigModal();
            }, 2000);
        }
        
        console.log('💾 Sites loading completed');
        
        // 🆕 Update site information if there's an active one
        if (this.currentSite) {
            console.log('🔄 Updating active site information on load...');
            this.updateSidebarSiteInfo();
            this.updateSiteContextInMemory();
        } else {
            console.log('💬 No site connected - showing stateless mode indicator');
            this.showStatelessModeIndicator();
        }
        
        // 🧠 Initialize session memory UI
        this.initializeMemoryUI();
        
        // 📝 Initialize code snippets UI
        this.initializeSnippetsUI();
    }

    async runManualDiagnosis() {
        if (!this.currentSite) {
            this.addErrorMessage('No WordPress site configured. Configure a site first to run the diagnosis.');
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
        console.log('✅ Sites saved to localStorage');
    }

    generateSiteId() {
        return 'site_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    addNewSite(name, url, token) {
        // Verify limit of 5 sites
        if (this.savedSites.length >= 5) {
            throw new Error('Maximum 5 sites allowed. Delete an existing one first.');
        }
        
        // Verify if URL already exists
        const existingSite = this.savedSites.find(site => site.url === url);
        if (existingSite) {
            throw new Error('This site is already configured.');
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
        const site = this.savedSites.find(s => s.id === siteId);
        this.savedSites = this.savedSites.filter(site => site.id !== siteId);
        
        // If deleted site was active, clear it
        if (this.currentSite?.id === siteId) {
            this.currentSite = null;
            
            // 🧠 Update session memory
            this.updateSiteContextInMemory();
            this.addActionToMemory({
                type: 'site_disconnected',
                description: `Disconnected from site: ${site?.name || 'Unknown'}`,
                site_name: site?.name,
                success: true
            });
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
            
            // 🧠 Update session memory with new site context
            this.updateSiteContextInMemory();
            this.addActionToMemory({
                type: 'site_connected',
                description: `Connected to site: ${site.name}`,
                site_name: site.name,
                site_url: site.url,
                success: true
            });
            
            // 🎨 Actualizar información en la sidebar
            this.updateSidebarSiteInfo();
            
            // Show site change message
            this.addMessage('assistant', 
                `<strong>🔄 Site connected</strong><br><br>
                Now connected to: <code>${site.name}</code><br>
                URL: <span style="color: #00bcd4;">${site.url}</span><br><br>
                <em>Ready to use WordPress Abilities API!</em>`
            );
            
            // Autodiagnosis disabled - not needed with Abilities API
            // setTimeout(() => {
            //     this.performAutodiagnosis();
            // }, 1000);
        }
    }

    updateSitesDisplay() {
        // Update saved sites list in sidebar
        this.savedSitesList.innerHTML = '';
        
        if (this.savedSites.length === 0) {
            this.savedSitesList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px; font-size: 12px;">No sites configured</p>';
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
                        '<span class="site-action-btn active-indicator">● Active</span>' : 
                        `<button class="site-action-btn" onclick="window.geminiApp.selectSite('${site.id}')">Use</button>`
                    }
                    <button class="site-action-btn delete" onclick="window.geminiApp.deleteSiteWithConfirmation('${site.id}')">Disconnect</button>
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
        if (diffHours < 1) timeText = 'Used less than 1 hour ago';
        else if (diffHours < 24) timeText = `Used ${diffHours} hours ago`;
        else timeText = `Used ${Math.floor(diffHours / 24)} days ago`;
        
        return `${site.status === 'connected' ? 'Connected' : 
                 site.status === 'error' ? 'Connection error' : 'Not tested'} • ${timeText}`;
    }

    deleteSiteWithConfirmation(siteId) {
        const site = this.savedSites.find(s => s.id === siteId);
        if (!site) return;
        
        if (confirm(`Disconnect "${site.name}"?\n\nThis will remove the saved configuration.`)) {
            this.deleteSite(siteId);
            
            // Show confirmation message
            this.addMessage('assistant', 
                `<strong>🔌 Site disconnected</strong><br><br>
                Removed: <code>${site.name}</code><br>
                <em>You can reconnect it whenever you want.</em>`
            );
            
            // If no sites remain, show stateless mode
            if (this.savedSites.length === 0 || !this.currentSite) {
                setTimeout(() => {
                    this.showStatelessModeIndicator();
                }, 1000);
            }
        }
    }

    showConfigModal() {
        console.log('🔧 Showing configuration modal...');
        
        try {
            // Clear form
            document.getElementById('siteName').value = '';
            document.getElementById('wordpressUrl').value = '';
            document.getElementById('authToken').value = '';
            
            // Update displays
            console.log('📊 Updating sites display...');
            this.updateSitesDisplay();
            
            console.log('👁️ Showing modal...');
            this.configModal.classList.add('show');
            
            console.log('🎯 Enfocando campo nombre...');
            const siteNameField = document.getElementById('siteName');
            if (siteNameField) {
                siteNameField.focus();
            }
            
            console.log('✅ Modal shown correctly');
        } catch (error) {
            console.error('❌ Error showing modal:', error);
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

    async checkWordPressAPI(wordpressUrl) {
        try {
            console.log('🔍 Verifying WordPress REST API...');
            
            const response = await fetch(`${this.config.SERVER_URL}${this.config.API.ENDPOINTS.CHECK_API}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    wordpressUrl: wordpressUrl
                })
            });

            const result = await response.json();
            console.log('📊 API verification result:', result);
            
            return result;

        } catch (error) {
            console.error('❌ Error verificando API REST:', error);
            return {
                status: 'error',
                message: error.message,
                api_rest_available: false,
                plugin_installed: false
            };
        }
    }

    async testConnection(wordpressUrl, authToken) {
        try {
            console.log('🔍 Iniciando test de conexión avanzado...');
            
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
                console.log('✅ Test de conexión exitoso:', data);
                return { success: true, data };
            } else {
                const errorData = await response.json();
                console.error('❌ Error en test de conexión:', errorData);
                
                // Proporcionar información más útil al usuario
                let userFriendlyMessage = errorData.message || `HTTP ${response.status}`;
                
                if (errorData.error_type === 'ETIMEDOUT' || errorData.message.includes('timeout')) {
                    userFriendlyMessage = `Timeout connecting to WordPress.\n\nPossible causes:\n${errorData.suggestions ? errorData.suggestions.join('\n') : '- Site not accessible\n- Plugin not installed\n- Firewall blocking connections'}\n\nURL tested: ${errorData.debug_info?.target_url || wordpressUrl}`;
                } else if (errorData.error_type === 'ENOTFOUND') {
                    userFriendlyMessage = `Could not resolve domain.\n\nVerify that the URL is correct: ${wordpressUrl}`;
                }
                
                return { success: false, error: userFriendlyMessage, details: errorData };
            }
        } catch (error) {
            console.error('❌ Error en testConnection:', error);
            return { success: false, error: `Error de red: ${error.message}` };
        }
    }

    async checkServerConnection() {
        if (!this.currentSite) {
            return;
        }

        try {
            const response = await fetch(`${this.config.SERVER_URL}${this.config.API.ENDPOINTS.HEALTH}`);
            if (response.ok) {
                console.log('✅ Proxy server connection established');
            }
        } catch (error) {
            console.warn('⚠️ Could not connect to proxy server:', error.message);
        }
    }

    initializeEventListeners() {
        console.log('🎧 Registering event listeners...');
        
        // Eventos existentes
        console.log('📝 Registering send event...');
        this.sendButton.addEventListener('click', () => {
            console.log('🖱️ Click on send button');
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

        // Configuration modal events
        console.log('⚙️ Registering configuration button event...');
        this.configButton.addEventListener('click', (e) => {
            console.log('🖱️ Click on configuration button');
            e.preventDefault();
            e.stopPropagation();
            this.showConfigModal();
        });
        
        console.log('❌ Registering close modal event...');
        this.configCloseButton.addEventListener('click', () => {
            console.log('🖱️ Click on close modal');
            this.hideConfigModal();
        });
        
        this.configCancelButton.addEventListener('click', () => {
            console.log('🖱️ Click on cancel');
            this.hideConfigModal();
        });
        
        // Cerrar modal al hacer clic fuera
        this.configModal.addEventListener('click', (e) => {
            if (e.target === this.configModal) {
                console.log('🖱️ Click outside modal');
                this.hideConfigModal();
            }
        });

        // Active site selector (keep for compatibility)
        console.log('🔄 Registering site selector...');
        this.activeSiteSelect.addEventListener('change', (e) => {
            console.log('🔄 Site change:', e.target.value);
            if (e.target.value) {
                this.selectSite(e.target.value);
            }
        });

        // Manejar envío del formulario
        console.log('📋 Registering form...');
        this.configForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('📋 Envío de formulario');
            await this.handleConfigSave();
        });

        // Cerrar modal con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.configModal.classList.contains('show')) {
                console.log('⌨️ Escape pressed');
                this.hideConfigModal();
            }
        });

        // 🆕 EVENT LISTENERS PARA EL DESPLEGABLE DE SITIOS
        
        // Botón selector de sitios en el header
        const siteSelectorBtn = document.getElementById('siteSelectorBtn');
        if (siteSelectorBtn) {
            console.log('✅ Registering event listener for siteSelectorBtn');
            siteSelectorBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Click on siteSelectorBtn detected');
                this.toggleSiteDropdown();
            });
        } else {
            console.error('❌ Elemento siteSelectorBtn no encontrado');
        }

        // Botón "Añadir Sitio" desde el desplegable
        const addSiteFromDropdown = document.getElementById('addSiteFromDropdown');
        if (addSiteFromDropdown) {
            console.log('✅ Registering event listener for addSiteFromDropdown');
            addSiteFromDropdown.addEventListener('click', () => {
                console.log('➕ Add site from dropdown');
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
                    console.log('⌨️ Escape pressed, hiding dropdown');
                    this.hideSiteDropdown();
                }
            }
        });
        
        console.log('✅ All event listeners registered');
    }

    async handleConfigSave() {
        const siteName = document.getElementById('siteName').value.trim();
        const wordpressUrl = document.getElementById('wordpressUrl').value.trim();
        const authToken = document.getElementById('authToken').value.trim();
        const globalGeminiApiKey = document.getElementById('globalGeminiApiKey').value.trim();

        if (!siteName || !wordpressUrl || !authToken) {
            this.showConfigStatus('Please complete all required fields', 'error');
            return;
        }

        // Clean URL (remove trailing slash)
        const cleanUrl = wordpressUrl.replace(/\/$/, '');

        try {
            this.showConfigStatus('Testing connection...', 'success');

            // Step 1: Verify basic REST API
            console.log('🔍 Step 1: Verifying WordPress REST API...');
            const apiCheck = await this.checkWordPressAPI(cleanUrl);
            
            if (!apiCheck.api_rest_available) {
                throw new Error(`WordPress REST API not available.\n\nVerify that:\n• The site is accessible: ${cleanUrl}\n• WordPress is working correctly\n• No plugins are blocking the REST API`);
            }
            
            if (!apiCheck.plugin_installed) {
                throw new Error(`Gemini WP-CLI plugin not found.\n\nTo continue you need:\n\n1. Download the plugin from the repository\n2. Install it at: ${cleanUrl}/wp-admin/plugin-install.php\n3. Activate it from: ${cleanUrl}/wp-admin/plugins.php\n4. Get the token from: ${cleanUrl}/wp-admin/options-general.php?page=gemini-token\n\nEndpoints verified:\n• REST API: ${apiCheck.endpoints?.api_rest || 'N/A'}\n• Plugin Test: ${apiCheck.endpoints?.plugin_test || 'N/A'}`);
            }
            
            console.log('✅ REST API and plugin verified correctly');

            // Step 2: Test connection with authentication
            console.log('🔍 Step 2: Testing authentication...');
            const testResult = await this.testConnection(cleanUrl, authToken);

            if (testResult.success) {
                // Save global API Key if provided
                if (globalGeminiApiKey) {
                    this.saveGlobalGeminiApiKey(globalGeminiApiKey);
                    console.log('🔑 Global API Key saved');
                }
                
                // Add site (without per-site API Key)
                const newSite = this.addNewSite(siteName, cleanUrl, authToken);
                newSite.status = 'connected';
                
                // Select as active site
                this.selectSite(newSite.id);
                
                // 🎨 Update sidebar information
                this.updateSidebarSiteInfo();
                
                this.showConfigStatus('✅ Site added and configured correctly', 'success');
                
                // Clear form
                document.getElementById('siteName').value = '';
                document.getElementById('wordpressUrl').value = '';
                document.getElementById('authToken').value = '';
                document.getElementById('globalGeminiApiKey').value = '';
                
                // Update display
                this.updateSitesDisplay();
                
                // Close modal after a moment
                setTimeout(() => this.hideConfigModal(), 2000);
                
                // Autodiagnosis will run automatically via selectSite()
                
            } else {
                this.showConfigStatus(`❌ Connection error: ${testResult.error}`, 'error');
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

        // 🆕 NO SITE CONNECTED MODE: Allow pure Gemini chat without site
        if (!this.currentSite) {
            console.log('💬 No site connected - entering stateless chat mode');
            this.handleNoSiteConnectedChat(message);
            return;
        }

        // Disable input while processing
        this.setInputState(false);
        
        // Show user message
        this.addMessage('user', message);
        
        // 🧠 Add user message to history
        this.addToHistory('user', message);
        
        // Clear input
        this.messageInput.value = '';
        this.autoResizeTextarea();

        // Show "thinking" animation
        const thinkingId = this.addThinkingAnimation('thinking');

        try {
            // Update phase: analyzing
            setTimeout(() => this.updateThinkingPhase(thinkingId, 'analyzing'), 500);
            
            // Call Gemini AI to process the message
            console.log('🧠 Processing message with Gemini AI...');
            
            // Update phase: processing
            setTimeout(() => this.updateThinkingPhase(thinkingId, 'processing'), 1000);
            
            const geminiResponse = await this.getGeminiResponse(message);
            
            // Update phase: responding
            this.updateThinkingPhase(thinkingId, 'responding');
            
            // Small pause to show the "responding" phase
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Remove thinking animation
            this.removeThinkingAnimation(thinkingId);
            
            // Verify we have a valid response
            if (!geminiResponse || !geminiResponse.explanation) {
                throw new Error('Invalid response from Gemini');
            }
            
            // Check if it's a conversational response
            if (geminiResponse.is_conversational || !geminiResponse.command) {
                console.log('💬 Processing conversational response');
                
                // For conversational responses, show explanation directly
                this.addMessage('assistant', geminiResponse.explanation);
                
                // 🧠 Add conversational response to history
                this.addToHistory('assistant', geminiResponse.explanation);
                
                // 🔄 WORKFLOW ENGINE: Show workflow suggestions if available
                if (geminiResponse.workflow_context && geminiResponse.workflow_context.has_suggestions) {
                    console.log('🔄 Showing workflow suggestions in conversational response');
                    this.addWorkflowSuggestions(geminiResponse.workflow_context);
                }
                
                // 🤖 POLICY ENGINE: Show policy suggestions if available
                if (geminiResponse.policy_context && geminiResponse.policy_context.has_suggestions) {
                    console.log('🤖 Showing policy suggestions in conversational response');
                    this.addPolicySuggestions(geminiResponse.policy_context);
                }
                
                // 🔄 WORKFLOW ENGINE: Show workflow suggestions if available
                if (geminiResponse.workflow_context && geminiResponse.workflow_context.has_suggestions) {
                    console.log('🔄 Showing workflow suggestions in conversational response');
                    this.addWorkflowSuggestions(geminiResponse.workflow_context);
                }
                
                return; // Don't execute command or show preview card
            }
            
            // For responses with commands, continue with normal flow
            console.log('🔧 Processing response with command:', geminiResponse.command);
            
            // Show Gemini response with additional information
            let responseMessage = `<strong>🤖 Gemini AI has processed your request:</strong><br><br>`;
            responseMessage += `"${geminiResponse.explanation}"`;
            
            // Add indicator if it's emergency response
            if (geminiResponse.explanation && geminiResponse.explanation.includes('emergencia')) {
                responseMessage += `<br><br><em style="color: #ffbd2e;">⚠️ Note: Gemini AI is not available, using emergency system.</em>`;
            }
            
            this.addMessage('assistant', responseMessage);
            
            // 🧠 Add Gemini response to history
            this.addToHistory('assistant', geminiResponse.explanation, geminiResponse);
            
            // Show preview card with real Gemini data
            this.addPreviewCard(geminiResponse);
            
        } catch (error) {
            console.error('❌ Error processing message:', error);
            this.removeThinkingAnimation(thinkingId);
            this.addErrorMessage(`Error processing your request: ${error.message}`);
        } finally {
            this.setInputState(true);
        }
    }

    // 🆕 NO SITE CONNECTED MODE: Handle pure Gemini chat without WordPress site
    async handleNoSiteConnectedChat(message) {
        // Disable input while processing
        this.setInputState(false);
        
        // Show user message
        this.addMessage('user', message);
        
        // Clear input
        this.messageInput.value = '';
        this.autoResizeTextarea();

        // Show "thinking" animation
        const thinkingId = this.addThinkingAnimation('thinking');

        try {
            // Update phase: analyzing
            setTimeout(() => this.updateThinkingPhase(thinkingId, 'analyzing'), 500);
            
            console.log('💬 Processing stateless chat with Gemini AI...');
            
            // Update phase: processing
            setTimeout(() => this.updateThinkingPhase(thinkingId, 'processing'), 1000);
            
            // Call Gemini AI in stateless mode (no site context, no history)
            const geminiResponse = await this.getStatelessGeminiResponse(message);
            
            // Update phase: responding
            this.updateThinkingPhase(thinkingId, 'responding');
            
            // Small pause to show the "responding" phase
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Remove thinking animation
            this.removeThinkingAnimation(thinkingId);
            
            // Verify we have a valid response
            if (!geminiResponse || !geminiResponse.explanation) {
                throw new Error('Invalid response from Gemini');
            }
            
            // Show Gemini response with stateless indicator
            let responseMessage = `<div style="background: rgba(255, 189, 46, 0.1); border: 1px solid #ffbd2e; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                <strong>💬 Temporary Chat Mode</strong><br>
                <small style="color: #ffbd2e;">No site connected • Stateless conversation • No memory stored</small>
            </div>`;
            
            responseMessage += geminiResponse.explanation;
            
            this.addMessage('assistant', responseMessage);
            
            // Show suggestion to connect a site if user asks WordPress-related questions
            if (this.isWordPressRelatedQuery(message)) {
                setTimeout(() => {
                    this.addMessage('assistant', 
                        `<div style="background: rgba(16, 163, 127, 0.1); border: 1px solid #10a37f; border-radius: 8px; padding: 12px; margin-top: 16px;">
                            <strong>💡 Tip</strong><br>
                            For WordPress-specific assistance, connect your site using the ⚙️ button to unlock:
                            <ul style="margin: 8px 0 0 20px; color: #10a37f;">
                                <li>Site analysis and diagnostics</li>
                                <li>Policy-driven recommendations</li>
                                <li>Guided workflows</li>
                                <li>Real WordPress abilities</li>
                            </ul>
                        </div>`
                    );
                }, 1000);
            }
            
        } catch (error) {
            console.error('❌ Error in stateless chat:', error);
            this.removeThinkingAnimation(thinkingId);
            this.addErrorMessage(`Error processing your request: ${error.message}`);
        } finally {
            this.setInputState(true);
        }
    }

    // 🆕 Check if the user query is WordPress-related
    isWordPressRelatedQuery(message) {
        const wpKeywords = [
            'wordpress', 'wp-', 'plugin', 'theme', 'post', 'page', 'admin', 'dashboard',
            'database', 'mysql', 'php', 'apache', 'nginx', 'hosting', 'domain',
            'seo', 'yoast', 'woocommerce', 'elementor', 'gutenberg', 'block',
            'sitio', 'página', 'entrada', 'administrador', 'base de datos'
        ];
        
        const lowerMessage = message.toLowerCase();
        return wpKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    // 🆕 Get Gemini response in stateless mode (no site context, no history)
    async getStatelessGeminiResponse(userMessage) {
        try {
            console.log('💬 Sending stateless prompt to Gemini AI:', userMessage);
            
            // Preparar headers
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // 🔑 Añadir API Key global si existe
            if (this.hasGlobalGeminiApiKey()) {
                headers['x-user-gemini-key'] = this.globalGeminiApiKey;
                console.log('🔑 Using custom global API Key for stateless chat');
            } else {
                console.log('🔑 Using server API Key (shared) for stateless chat');
            }
            
            // Call Gemini endpoint with NO site context and NO chat history
            const response = await fetch(`${this.config.SERVER_URL}${this.config.API.ENDPOINTS.GEMINI_ASK}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    prompt: userMessage,
                    siteContext: {}, // Empty site context
                    chatHistory: []  // No chat history - stateless
                }),
                timeout: this.config.API.TIMEOUT
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.status === 'success' && data.gemini_response) {
                console.log('✅ Stateless response from Gemini AI:', data.gemini_response);
                
                const geminiResp = data.gemini_response;
                if (geminiResp.explanation) {
                    return geminiResp;
                } else {
                    console.warn('⚠️ Stateless Gemini response with incomplete structure:', geminiResp);
                    throw new Error('Invalid Gemini response format');
                }
            } else {
                throw new Error(data.message || data.gemini_error || 'Error in Gemini response');
            }
            
        } catch (error) {
            console.error('❌ Error in stateless Gemini chat:', error);
            
            // Fallback to basic response for stateless mode (no memory tracking)
            return {
                explanation: `I'm having trouble connecting to Gemini AI right now. This is a temporary chat mode without site connection.
                
To get the full WordPress assistance experience, please:
1. Click the ⚙️ configuration button
2. Connect your WordPress site
3. Enjoy policy-driven AI assistance with full capabilities

Error: ${error.message}`,
                is_conversational: true,
                is_safe: true
            };
        }
    }

    addThinkingAnimation() {
        const thinkingId = 'thinking_' + Date.now();
        const thinkingDiv = document.createElement('div');
        thinkingDiv.id = thinkingId;
        thinkingDiv.className = 'message assistant';
        
        // Create message header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';
        headerDiv.innerHTML = `
            <div class="message-avatar assistant">🤖</div>
            <div class="message-author">Typingpress</div>
            <div class="message-time">Now</div>
        `;
        
        // Create thinking indicator
        const thinkingIndicator = document.createElement('div');
        thinkingIndicator.className = 'typing-indicator';
        thinkingIndicator.innerHTML = `
            <div class="typing-avatar">🤖</div>
            <div class="typing-text">
                <span id="thinking-phase-${thinkingId}">Thinking</span>
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        
        thinkingDiv.appendChild(headerDiv);
        thinkingDiv.appendChild(thinkingIndicator);
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

    updateThinkingPhase(thinkingId, phase) {
        const phaseElement = document.getElementById(`thinking-phase-${thinkingId}`);
        if (phaseElement) {
            const phaseText = {
                'thinking': 'Thinking',
                'analyzing': 'Analyzing',
                'processing': 'Processing',
                'responding': 'Responding'
            };
            phaseElement.textContent = phaseText[phase] || 'Thinking';
        }
    }

    setInputState(enabled) {
        this.messageInput.disabled = !enabled;
        this.sendButton.disabled = !enabled;
        
        if (enabled) {
            this.sendButton.textContent = 'Send';
            this.sendButton.classList.remove('loading-gradient');
            this.messageInput.placeholder = 'Tell me your problem or request... E.g: \'My site is slow\', \'500 error\', \'List plugins\'';
            this.messageInput.focus();
        } else {
            this.sendButton.innerHTML = '<div class="loading"></div>';
            this.sendButton.classList.add('loading-gradient');
            this.messageInput.placeholder = 'Typingpress is thinking...';
        }
    }

    addMessage(type, content) {
        console.log('🔍 addMessage llamado:', { type, contentLength: content?.length });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Apply enhanced Markdown rendering only to assistant messages
        if (type === 'assistant') {
            console.log('🎨 Aplicando renderizado Markdown...');
            const renderedContent = this.renderMarkdown(content);
            console.log('✅ Markdown renderizado, longitud:', renderedContent?.length);
            contentDiv.innerHTML = renderedContent;
        } else {
            console.log('👤 User message, no rendering');
            contentDiv.innerHTML = content;
        }
        
        messageDiv.appendChild(contentDiv);
        this.chatArea.appendChild(messageDiv);
        this.scrollToBottom();
    }

    // 🤖 POLICY ENGINE: Mostrar sugerencias de políticas
    addPolicySuggestions(policyContext) {
        if (!policyContext || !policyContext.has_suggestions || !policyContext.suggestions.length) {
            return;
        }
        
        console.log('🤖 Mostrando sugerencias de políticas:', policyContext.suggestions.length);
        
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'message assistant policy-suggestions';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        let suggestionsHtml = `
            <div class="policy-suggestions-container">
                <div class="policy-header">
                    <div class="policy-icon">🤖</div>
                    <div class="policy-title">Proactive Assistant - Detected Situations</div>
                    <div class="policy-count">${policyContext.suggestions.length} suggestion${policyContext.suggestions.length > 1 ? 's' : ''}</div>
                </div>
                
                <div class="policy-principle">
                    <strong>Principle:</strong> "AI doesn't automate actions. AI automates understanding and preparation."
                </div>
                
                <div class="policy-suggestions-list">
        `;
        
        policyContext.suggestions.forEach((suggestion, index) => {
            const priorityIcon = this.getPriorityIcon(suggestion.priority);
            const riskColor = this.getRiskColor(suggestion.risk_level);
            
            // Generar IDs únicos para los botones
            const simulateButtonId = `policy_simulate_${suggestion.id}_${Date.now()}`;
            const executeButtonId = `policy_execute_${suggestion.id}_${Date.now()}`;
            const dismissButtonId = `policy_dismiss_${suggestion.id}_${Date.now()}`;
            
            suggestionsHtml += `
                <div class="policy-suggestion-card" data-priority="${suggestion.priority}">
                    <div class="suggestion-header">
                        <div class="suggestion-priority">${priorityIcon} ${suggestion.priority.toUpperCase()}</div>
                        <div class="suggestion-category">${suggestion.category}</div>
                        <div class="suggestion-risk" style="color: ${riskColor}">
                            ${this.getRiskIcon(suggestion.risk_level)} ${suggestion.risk_level}
                        </div>
                    </div>
                    
                    <div class="suggestion-content">
                        <h4 class="suggestion-title">${suggestion.title}</h4>
                        <p class="suggestion-description">${suggestion.description}</p>
                        
                        <div class="suggestion-details">
                            <div class="detail-section">
                                <strong>Why was it triggered?</strong>
                                <p>${suggestion.why_triggered}</p>
                            </div>
                            
                            <div class="detail-section">
                                <strong>Recommended action:</strong>
                                <p>${suggestion.recommended_action}</p>
                            </div>
                            
                            <div class="detail-section">
                                <strong>Risk assessment:</strong>
                                <p>${suggestion.risk_assessment}</p>
                            </div>
                            
                            ${suggestion.next_steps && suggestion.next_steps.length > 0 ? `
                            <div class="detail-section">
                                <strong>Next steps:</strong>
                                <ul>
                                    ${suggestion.next_steps.map(step => `<li>${step}</li>`).join('')}
                                </ul>
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="suggestion-ability">
                            <strong>Suggested action:</strong> <code>${suggestion.suggested_ability.name}</code>
                            ${Object.keys(suggestion.suggested_ability.parameters).length > 0 ? `
                            <div class="ability-parameters">
                                <strong>Parameters:</strong>
                                <pre>${JSON.stringify(suggestion.suggested_ability.parameters, null, 2)}</pre>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="suggestion-actions">
                        <button id="${simulateButtonId}" class="policy-action-button simulate">
                            🧪 Simulate Action
                        </button>
                        <button id="${executeButtonId}" class="policy-action-button execute">
                            ✅ Execute Action
                        </button>
                        <button id="${dismissButtonId}" class="policy-action-button dismiss">
                            ❌ Ignore
                        </button>
                    </div>
                    
                    <div class="suggestion-timestamp">
                        <small>Detected: ${new Date(suggestion.triggered_at).toLocaleString()}</small>
                    </div>
                </div>
            `;
        });
        
        suggestionsHtml += `
                </div>
                
                <div class="policy-footer">
                    <small>💡 These suggestions are based on automatic analysis of your WordPress site status.</small>
                </div>
            </div>
        `;
        
        contentDiv.innerHTML = suggestionsHtml;
        suggestionsDiv.appendChild(contentDiv);
        this.chatArea.appendChild(suggestionsDiv);
        
        // Agregar event listeners para todos los botones
        policyContext.suggestions.forEach((suggestion, index) => {
            const simulateButtonId = `policy_simulate_${suggestion.id}_${Date.now()}`;
            const executeButtonId = `policy_execute_${suggestion.id}_${Date.now()}`;
            const dismissButtonId = `policy_dismiss_${suggestion.id}_${Date.now()}`;
            
            const simulateButton = document.getElementById(simulateButtonId);
            const executeButton = document.getElementById(executeButtonId);
            const dismissButton = document.getElementById(dismissButtonId);
            
            if (simulateButton) {
                simulateButton.addEventListener('click', (e) => {
                    this.simulatePolicySuggestion(suggestion, e.target);
                });
            }
            
            if (executeButton) {
                executeButton.addEventListener('click', (e) => {
                    this.executePolicySuggestion(suggestion, e.target);
                });
            }
            
            if (dismissButton) {
                dismissButton.addEventListener('click', (e) => {
                    this.dismissPolicySuggestion(suggestion, e.target);
                });
            }
        });
        
        this.scrollToBottom();
    }
    
    // 🤖 POLICY ENGINE: Obtener icono de prioridad
    getPriorityIcon(priority) {
        const icons = {
            'high': '🔴',
            'medium': '🟡',
            'low': '🟢'
        };
        return icons[priority] || '⚪';
    }
    
    // 🤖 POLICY ENGINE: Obtener color de riesgo
    getRiskColor(riskLevel) {
        const colors = {
            'read': '#27ca3f',
            'write': '#ffbd2e',
            'destructive': '#ff5f56'
        };
        return colors[riskLevel] || '#888';
    }
    
    // 🤖 POLICY ENGINE: Obtener icono de riesgo
    getRiskIcon(riskLevel) {
        const icons = {
            'read': '👁️',
            'write': '✏️',
            'destructive': '⚠️'
        };
        return icons[riskLevel] || '❓';
    }
    
    // 🤖 POLICY ENGINE: Simular sugerencia de política
    async simulatePolicySuggestion(suggestion, buttonElement) {
        const originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<div class="loading"></div> Simulating...';
        buttonElement.classList.add('loading-gradient');
        
        console.log('🧪 Simulating policy suggestion:', suggestion.suggested_ability.name);
        
        try {
            const response = await fetch('/api/wp/execute-ability', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    abilityName: suggestion.suggested_ability.name,
                    abilityInput: suggestion.suggested_ability.parameters,
                    wordpressUrl: this.currentSite.url,
                    authToken: this.currentSite.token,
                    mode: 'simulate'
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ Policy simulation completed:', data);
            
            // Show simulation result
            this.showPolicySimulationResult(suggestion, data);
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
            
        } catch (error) {
            console.error('❌ Error simulating policy suggestion:', error);
            
            const errorMessage = `
                <div class="policy-simulation-error">
                    <strong>❌ Simulation error for ${suggestion.title}</strong><br>
                    ${error.message}
                </div>
            `;
            
            this.addMessage('assistant', errorMessage);
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
        }
    }
    
    // 🤖 POLICY ENGINE: Ejecutar sugerencia de política
    async executePolicySuggestion(suggestion, buttonElement) {
        const originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<div class="loading"></div> Executing...';
        buttonElement.classList.add('loading-gradient');
        
        console.log('⚡ Executing policy suggestion:', suggestion.suggested_ability.name);
        
        try {
            const response = await fetch('/api/wp/execute-ability', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    abilityName: suggestion.suggested_ability.name,
                    abilityInput: suggestion.suggested_ability.parameters,
                    wordpressUrl: this.currentSite.url,
                    authToken: this.currentSite.token,
                    mode: 'execute'
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ Policy execution completed:', data);
            
            // Show execution result
            const resultMessage = `
                <div class="policy-execution-result">
                    <div class="result-header">
                        <strong>✅ Action completed: ${suggestion.title}</strong>
                    </div>
                    <div class="result-content">
                        ${this.formatFunctionResult(data.ability_result)}
                    </div>
                    <div class="result-meta">
                        <small>Executed on ${new Date().toLocaleString()}</small>
                    </div>
                </div>
            `;
            
            this.addMessage('assistant', resultMessage);
            
            // Change button to completed
            buttonElement.textContent = '✅ Completed';
            buttonElement.classList.remove('loading-gradient');
            buttonElement.style.backgroundColor = '#27ca3f';
            
        } catch (error) {
            console.error('❌ Error executing policy suggestion:', error);
            
            const errorMessage = `
                <div class="policy-execution-error">
                    <strong>❌ Error executing ${suggestion.title}</strong><br>
                    ${error.message}
                </div>
            `;
            
            this.addMessage('assistant', errorMessage);
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
        }
    }
    
    // 🤖 POLICY ENGINE: Ignorar sugerencia de política
    dismissPolicySuggestion(suggestion, buttonElement) {
        console.log('❌ User ignored policy suggestion:', suggestion.policy_id);
        
        // Show confirmation message
        const dismissMessage = `
            <div class="policy-dismissal">
                <strong>❌ Suggestion ignored: ${suggestion.title}</strong><br>
                <small>You can re-evaluate policies later if you change your mind.</small>
            </div>
        `;
        
        this.addMessage('assistant', dismissMessage);
        
        // Ocultar la tarjeta de sugerencia
        const suggestionCard = buttonElement.closest('.policy-suggestion-card');
        if (suggestionCard) {
            suggestionCard.style.opacity = '0.5';
            suggestionCard.style.pointerEvents = 'none';
        }
    }
    
    // 🤖 POLICY ENGINE: Show policy simulation result
    showPolicySimulationResult(suggestion, simulationData) {
        const simulationMessage = `
            <div class="policy-simulation-result">
                <div class="simulation-header">
                    <strong>🧪 Simulation completed: ${suggestion.title}</strong>
                </div>
                
                <div class="simulation-content">
                    <div class="simulation-data">
                        ${this.formatSimulationResult(simulationData.simulation_result)}
                    </div>
                    
                    ${simulationData.impact_report ? `
                    <div class="impact-report">
                        <h4>📊 Impact Analysis:</h4>
                        <div class="impact-details">
                            ${this.formatImpactReport(simulationData.impact_report)}
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="simulation-note">
                    <small>💡 This was a simulation - no real changes were made to your site.</small>
                </div>
            </div>
        `;
        
        this.addMessage('assistant', simulationMessage);
    }
    
    // 🤖 POLICY ENGINE: Format impact report
    formatImpactReport(impactReport) {
        if (!impactReport) return 'No impact report available';
        
        let formatted = '';
        
        if (impactReport.risk_assessment) {
            formatted += `<div class="impact-section">
                <strong>Risk Assessment:</strong> ${impactReport.risk_assessment.description}<br>
                <strong>Level:</strong> ${impactReport.risk_assessment.level}<br>
            </div>`;
        }
        
        if (impactReport.predicted_changes) {
            formatted += `<div class="impact-section">
                <strong>Predicted Changes:</strong> ${impactReport.predicted_changes.description || 'See technical details'}<br>
            </div>`;
        }
        
        if (impactReport.resources_affected && impactReport.resources_affected.length > 0) {
            formatted += `<div class="impact-section">
                <strong>Affected Resources:</strong><br>
                <ul>
                    ${impactReport.resources_affected.map(resource => 
                        `<li>${resource.description} (${resource.type})</li>`
                    ).join('')}
                </ul>
            </div>`;
        }
        
        if (impactReport.reversibility) {
            formatted += `<div class="impact-section">
                <strong>Reversibility:</strong> ${impactReport.reversibility.reversible ? '✅ Reversible' : '❌ Irreversible'}<br>
                <small>${impactReport.reversibility.reason}</small>
            </div>`;
        }
        
        if (impactReport.recommendations && impactReport.recommendations.length > 0) {
            formatted += `<div class="impact-section">
                <strong>Recommendations:</strong><br>
                <ul>
                    ${impactReport.recommendations.map(rec => 
                        `<li><strong>${rec.type}:</strong> ${rec.message}</li>`
                    ).join('')}
                </ul>
            </div>`;
        }
        
        return formatted || 'Impact report not available';
    }

    addPreviewCard(geminiResponse) {
        console.log('🎨 addPreviewCard llamado con:', { 
            is_conversational: geminiResponse.is_conversational, 
            has_command: !!geminiResponse.command,
            has_function_call_pending: !!geminiResponse.function_call_pending,
            explanation_length: geminiResponse.explanation?.length 
        });
        
        const cardDiv = document.createElement('div');
        cardDiv.className = 'message assistant';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // 🛡️ ABILITIES API: Manejar function calls PENDIENTES de confirmación
        if (geminiResponse.function_call_pending) {
            console.log('⏸️ Pending function call detected');
            
            const renderedExplanation = this.renderMarkdown(geminiResponse.explanation);
            const functionCall = geminiResponse.function_call_pending;
            
            // Generar ID único para los botones de confirmación
            const simulateButtonId = 'simulate_ability_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const confirmButtonId = 'confirm_ability_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const cancelButtonId = 'cancel_ability_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Formatear parámetros para mostrar al usuario
            const parametersDisplay = Object.keys(functionCall.args).length > 0 
                ? Object.entries(functionCall.args).map(([key, value]) => 
                    `<strong>${key}:</strong> ${typeof value === 'object' ? JSON.stringify(value) : value}`
                  ).join('<br>')
                : 'Sin parámetros';
            
            contentDiv.innerHTML = `
                <div class="preview-card function-call-pending">
                    <div class="preview-section">
                        <div class="preview-icon">🤖</div>
                        <div class="preview-label">Gemini AI wants to execute:</div>
                        <div class="preview-content">${renderedExplanation}</div>
                    </div>
                    
                    <div class="preview-section">
                        <div class="preview-icon">🔧</div>
                        <div class="preview-label">Action to Execute:</div>
                        <div class="preview-content">
                            <div class="ability-name">${functionCall.name}</div>
                            <div class="ability-description">${functionCall.description}</div>
                        </div>
                    </div>
                    
                    <div class="preview-section">
                        <div class="preview-icon">📋</div>
                        <div class="preview-label">Parameters:</div>
                        <div class="preview-content">
                            <div class="ability-parameters">${parametersDisplay}</div>
                        </div>
                    </div>
                    
                    <div class="preview-section">
                        <div class="preview-icon">🧪</div>
                        <div class="preview-label">Explainability & Dry-Run:</div>
                        <div class="preview-content">
                            <div class="explainability-info">
                                <strong>🧠 Principle:</strong> "Never execute something you can't explain. Never explain something you can't simulate."
                                <br><br>
                                <strong>🧪 Simulation:</strong> You can simulate this action first to see exactly what will happen, what will change and what risks exist.
                                <br><br>
                                <strong>✅ Execution:</strong> Only after fully understanding the impact, you can execute the real action.
                            </div>
                        </div>
                    </div>
                    
                    <div class="confirmation-buttons">
                        <button id="${simulateButtonId}" class="simulate-ability-button">
                            🧪 Simulate First
                        </button>
                        <button id="${confirmButtonId}" class="confirm-ability-button">
                            ✅ Execute Directly
                        </button>
                        <button id="${cancelButtonId}" class="cancel-ability-button">
                            ❌ Cancel
                        </button>
                    </div>
                    
                    <div class="confirmation-note">
                        <small>💡 <strong>Recommendation:</strong> Use "Simulate First" to understand the impact before executing.</small>
                    </div>
                </div>
            `;
            
            cardDiv.appendChild(contentDiv);
            this.chatArea.appendChild(cardDiv);
            
            // Agregar event listeners para los botones
            document.getElementById(simulateButtonId).addEventListener('click', (e) => {
                this.simulateAbility(functionCall, e.target);
            });
            
            document.getElementById(confirmButtonId).addEventListener('click', (e) => {
                this.executeAbility(functionCall, e.target);
            });
            
            document.getElementById(cancelButtonId).addEventListener('click', (e) => {
                this.cancelAbility(e.target);
            });
            
            this.scrollToBottom();
            return;
        }
        
        // 🆕 ABILITIES API: Manejar respuestas con function calls YA EJECUTADOS (para compatibilidad)
        if (geminiResponse.function_call && geminiResponse.function_call.result) {
            console.log('⚡ Respuesta con function call ejecutado detectada');
            
            const renderedExplanation = this.renderMarkdown(geminiResponse.explanation);
            
            contentDiv.innerHTML = `
                <div class="preview-card function-call-executed">
                    <div class="preview-section">
                        <div class="preview-icon">✅</div>
                        <div class="preview-label">Action Completed:</div>
                        <div class="preview-content">${renderedExplanation}</div>
                    </div>
                    
                    <div class="preview-section">
                        <div class="preview-icon">🔧</div>
                        <div class="preview-label">Function:</div>
                        <div class="preview-content">
                            <div class="function-name">${geminiResponse.function_call.name}</div>
                        </div>
                    </div>
                    
                    <div class="preview-section">
                        <div class="preview-icon">📊</div>
                        <div class="preview-label">Result:</div>
                        <div class="preview-content">
                            <div class="function-result">${this.formatFunctionResult(geminiResponse.function_call.result)}</div>
                        </div>
                    </div>
                    
                    <div class="preview-section">
                        <div class="preview-icon">🚀</div>
                        <div class="preview-label">Method:</div>
                        <div class="preview-content">
                            <div class="execution-method">WordPress Abilities API</div>
                        </div>
                    </div>
                </div>
            `;
            
            cardDiv.appendChild(contentDiv);
            this.chatArea.appendChild(cardDiv);
            this.scrollToBottom();
            return;
        }
        
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
                    <div class="preview-label">Explanation:</div>
                    <div class="preview-content">${renderedExplanation}</div>
                </div>
                
                <div class="preview-section">
                    <div class="preview-icon">💻</div>
                    <div class="preview-label">Command:</div>
                    <div class="preview-content">
                        <div class="command-code">${geminiResponse.command}</div>
                    </div>
                </div>
                
                <div class="preview-section">
                    <div class="preview-icon">🛡️</div>
                    <div class="preview-label">Security:</div>
                    <div class="preview-content">
                        <div class="security-indicator ${geminiResponse.is_safe ? 'security-safe' : 'security-unsafe'}">
                            ${geminiResponse.is_safe ? '✅ Safe command' : '⚠️ Command requires caution'}
                            ${!geminiResponse.is_safe ? '<br><small>This command may modify important data</small>' : ''}
                        </div>
                    </div>
                </div>
                
                ${geminiResponse.agent_thought ? `
                <div class="preview-section">
                    <div class="preview-icon">🧠</div>
                    <div class="preview-label">AI Analysis:</div>
                    <div class="preview-content">
                        <small style="color: #888; font-style: italic;">${geminiResponse.agent_thought}</small>
                    </div>
                </div>
                ` : ''}
                
                <button id="${buttonId}" class="execute-button">
                    Confirm Execution
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

    // 🛡️ ABILITIES API: Ejecutar ability después de confirmación explícita
    async executeAbility(functionCall, buttonElement) {
        const originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<div class="loading"></div> Executing...';
        buttonElement.classList.add('loading-gradient');
        
        // Disable cancel button too
        const cancelButton = buttonElement.parentElement.querySelector('.cancel-ability-button');
        if (cancelButton) {
            cancelButton.disabled = true;
            cancelButton.style.opacity = '0.5';
        }
        
        console.log('⚡ Executing confirmed ability:', functionCall.name);
        
        try {
            const response = await fetch('/api/wp/execute-ability', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    abilityName: functionCall.name,
                    abilityInput: functionCall.args,
                    wordpressUrl: functionCall.site_context.wordpressUrl,
                    authToken: functionCall.site_context.authToken,
                    mode: 'execute' // Ejecución real
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ Ability ejecutada exitosamente:', data);
            
            // Mostrar resultado de la ejecución
            const resultMessage = `
                <div class="ability-execution-result">
                    <div class="result-header">
                        <strong>✅ Action completed: ${functionCall.name}</strong>
                    </div>
                    <div class="result-content">
                        ${this.formatFunctionResult(data.ability_result)}
                    </div>
                    <div class="result-meta">
                        <small>Executed on ${new Date().toLocaleString()}</small>
                    </div>
                </div>
            `;
            
            this.addMessage('assistant', resultMessage);
            
            // Hide confirmation buttons
            const confirmationButtons = buttonElement.parentElement;
            if (confirmationButtons) {
                confirmationButtons.style.display = 'none';
            }
            
        } catch (error) {
            console.error('❌ Error ejecutando ability:', error);
            
            // Show error to user
            const errorMessage = `
                <div class="ability-execution-error">
                    <div class="error-header">
                        <strong>❌ Error executing ${functionCall.name}</strong>
                    </div>
                    <div class="error-content">
                        ${error.message}
                    </div>
                    <div class="error-suggestion">
                        <small>Check the connection with WordPress and try again.</small>
                    </div>
                </div>
            `;
            
            this.addMessage('assistant', errorMessage);
            
            // Restore buttons to allow retry
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
            
            if (cancelButton) {
                cancelButton.disabled = false;
                cancelButton.style.opacity = '1';
            }
        }
    }
    
    // 🧪 DRY-RUN: Simular ability antes de ejecución
    async simulateAbility(functionCall, buttonElement) {
        const originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<div class="loading"></div> Simulating...';
        buttonElement.classList.add('loading-gradient');
        
        console.log('🧪 Simulating ability:', functionCall.name);
        
        try {
            const response = await fetch('/api/wp/execute-ability', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    abilityName: functionCall.name,
                    abilityInput: functionCall.args,
                    wordpressUrl: functionCall.site_context.wordpressUrl,
                    authToken: functionCall.site_context.authToken,
                    mode: 'simulate' // Modo simulación
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ Simulación completada:', data);
            
            // Show simulation result with impact analysis
            this.showSimulationResult(functionCall, data);
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
            
        } catch (error) {
            console.error('❌ Error en simulación:', error);
            
            // Mostrar error de simulación
            const errorMessage = `
                <div class="simulation-error">
                    <div class="error-header">
                        <strong>❌ Error en simulación de ${functionCall.name}</strong>
                    </div>
                    <div class="error-content">
                        ${error.message}
                    </div>
                    <div class="error-suggestion">
                        <small>La simulación falló, pero aún puedes ejecutar la acción real si estás seguro.</small>
                    </div>
                </div>
            `;
            
            this.addMessage('assistant', errorMessage);
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
        }
    }
    
    // 🧪 DRY-RUN: Show simulation result with impact analysis
    showSimulationResult(functionCall, simulationData) {
        const impactReport = simulationData.impact_report;
        const simulationResult = simulationData.simulation_result;
        
        // Generar ID único para los nuevos botones
        const executeButtonId = 'execute_after_sim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const simulateAgainButtonId = 'simulate_again_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const cancelButtonId = 'cancel_after_sim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Format affected resources
        const resourcesHtml = impactReport?.resources_affected ? 
            impactReport.resources_affected.map(resource => 
                `<div class="resource-item risk-${resource.risk}">
                    <strong>${resource.type}:</strong> ${resource.description}
                    <span class="risk-badge risk-${resource.risk}">${resource.risk}</span>
                </div>`
            ).join('') : 
            '<div class="resource-item">No specific resources identified</div>';
        
        // Format recommendations
        const recommendationsHtml = impactReport?.recommendations ? 
            impactReport.recommendations.map(rec => 
                `<div class="recommendation-item priority-${rec.priority}">
                    <span class="priority-badge priority-${rec.priority}">${rec.priority}</span>
                    ${rec.message}
                </div>`
            ).join('') : 
            '<div class="recommendation-item">No specific recommendations</div>';
        
        const simulationMessage = `
            <div class="simulation-result-display">
                <div class="simulation-header">
                    <h3>🧪 Simulation Result: ${functionCall.name}</h3>
                    <div class="simulation-badge">SIMULATION - No real changes</div>
                </div>
                
                <div class="impact-analysis">
                    <div class="impact-section">
                        <h4>📊 Impact Analysis</h4>
                        <div class="risk-assessment">
                            <div class="risk-level risk-${impactReport?.risk_assessment?.level || 'unknown'}">
                                <strong>Risk Level:</strong> ${impactReport?.risk_assessment?.level || 'Unknown'}
                            </div>
                            <div class="risk-description">
                                ${impactReport?.risk_assessment?.description || 'No description available'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="impact-section">
                        <h4>🎯 What will happen</h4>
                        <div class="what-will-happen">
                            ${impactReport?.human_explanation?.what_will_happen || 'WordPress action'}
                        </div>
                    </div>
                    
                    <div class="impact-section">
                        <h4>🔄 What will change</h4>
                        <div class="what-changes">
                            ${impactReport?.human_explanation?.what_changes || 'Changes according to specified parameters'}
                        </div>
                    </div>
                    
                    <div class="impact-section">
                        <h4>🛡️ What will NOT change</h4>
                        <div class="what-wont-change">
                            ${impactReport?.human_explanation?.what_wont_change || 'Other site areas will remain intact'}
                        </div>
                    </div>
                    
                    <div class="impact-section">
                        <h4>📋 Affected Resources</h4>
                        <div class="resources-affected">
                            ${resourcesHtml}
                        </div>
                    </div>
                    
                    <div class="impact-section">
                        <h4>🔄 Reversibility</h4>
                        <div class="reversibility ${impactReport?.reversibility?.reversible ? 'reversible' : 'not-reversible'}">
                            <strong>${impactReport?.reversibility?.reversible ? '✅ Reversible' : '⚠️ Not reversible'}</strong>
                            <div class="reversibility-reason">
                                ${impactReport?.reversibility?.reason || 'No reversibility information'}
                            </div>
                            ${impactReport?.reversibility?.recommendation ? 
                                `<div class="reversibility-recommendation">💡 ${impactReport.reversibility.recommendation}</div>` : 
                                ''
                            }
                        </div>
                    </div>
                    
                    <div class="impact-section">
                        <h4>💡 Recommendations</h4>
                        <div class="recommendations">
                            ${recommendationsHtml}
                        </div>
                    </div>
                    
                    <div class="impact-section">
                        <h4>🔍 Simulation Result</h4>
                        <div class="simulation-data">
                            ${this.formatSimulationResult(simulationResult)}
                        </div>
                    </div>
                </div>
                
                <div class="simulation-actions">
                    <h4>What do you want to do now?</h4>
                    <div class="simulation-buttons">
                        <button id="${simulateAgainButtonId}" class="simulate-again-button">
                            🧪 Simulate Again
                        </button>
                        <button id="${executeButtonId}" class="execute-after-simulation-button">
                            ✅ Execute Real Action
                        </button>
                        <button id="${cancelButtonId}" class="cancel-after-simulation-button">
                            ❌ Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.addMessage('assistant', simulationMessage);
        
        // Agregar event listeners para los nuevos botones
        document.getElementById(executeButtonId).addEventListener('click', (e) => {
            this.executeAbility(functionCall, e.target);
        });
        
        document.getElementById(simulateAgainButtonId).addEventListener('click', (e) => {
            this.simulateAbility(functionCall, e.target);
        });
        
        document.getElementById(cancelButtonId).addEventListener('click', (e) => {
            this.cancelAbility(e.target);
        });
        
        this.scrollToBottom();
    }
    
    // 🧪 DRY-RUN: Formatear resultado de simulación
    formatSimulationResult(simulationResult) {
        if (!simulationResult) return 'Sin resultado de simulación';
        
        if (typeof simulationResult === 'string') {
            return simulationResult;
        }
        
        if (typeof simulationResult === 'object') {
            // Formatear objetos de simulación de manera legible
            let formatted = '';
            
            if (simulationResult.status) {
                formatted += `<strong>Status:</strong> ${simulationResult.status}<br>`;
            }
            
            if (simulationResult.message) {
                formatted += `<strong>Message:</strong> ${simulationResult.message}<br>`;
            }
            
            if (simulationResult.simulation_note) {
                formatted += `<div class="simulation-note">📝 ${simulationResult.simulation_note}</div>`;
            }
            
            if (simulationResult.changes_description) {
                formatted += `<strong>Changes:</strong> ${simulationResult.changes_description}<br>`;
            }
            
            if (simulationResult.affected_items !== undefined) {
                formatted += `<strong>Affected items:</strong> ${simulationResult.affected_items}<br>`;
            }
            
            // Si no hay formato específico, mostrar JSON estructurado
            if (!formatted) {
                formatted = '<pre>' + JSON.stringify(simulationResult, null, 2) + '</pre>';
            }
            
            return formatted;
        }
        
        return String(simulationResult);
    }
    
    // 🛡️ ABILITIES API: Cancel ability execution
    cancelAbility(buttonElement) {
        console.log('❌ User cancelled ability execution');
        
        // Show cancellation message
        const cancelMessage = `
            <div class="ability-execution-cancelled">
                <div class="cancel-header">
                    <strong>❌ Action cancelled</strong>
                </div>
                <div class="cancel-content">
                    No action was executed on your WordPress site.
                </div>
            </div>
        `;
        
        this.addMessage('assistant', cancelMessage);
        
        // Hide confirmation buttons
        const confirmationButtons = buttonElement.parentElement;
        if (confirmationButtons) {
            confirmationButtons.style.display = 'none';
        }
    }

    // 🆕 ABILITIES API: Format function call result
    formatFunctionResult(result) {
        if (!result) return 'No result';
        
        if (typeof result === 'string') {
            return result;
        }
        
        if (typeof result === 'object') {
            // Format objects in a readable way
            if (result.status && result.wordpress_version) {
                // Site Health result
                let formatted = `<strong>Status:</strong> ${result.status}<br>`;
                formatted += `<strong>WordPress:</strong> ${result.wordpress_version}<br>`;
                formatted += `<strong>PHP:</strong> ${result.php_version}<br>`;
                
                if (result.email_test) {
                    formatted += `<strong>Email:</strong> ${result.email_test.status}<br>`;
                }
                
                formatted += `<strong>Active plugins:</strong> ${result.active_plugins}<br>`;
                formatted += `<strong>Active theme:</strong> ${result.active_theme}<br>`;
                
                return formatted;
            }
            
            // Generic format for other objects
            return '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
        }
        
        return String(result);
    }

    async executeCommand(command, buttonElement, useServerInfo = false) {
        const originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<div class="loading"></div> Executing...';
        buttonElement.classList.add('loading-gradient');

        // 🧠 Track command execution start
        const executionStart = Date.now();
        this.addActionToMemory({
            type: 'command_execution_start',
            description: `Starting execution: ${command}`,
            command: command,
            use_server_info: useServerInfo,
            success: null // Will be updated when complete
        });

        try {
            let response;
            
            if (useServerInfo) {
                // Use server information endpoint
                response = await this.getServerInfo();
            } else {
                // Ejecutar comando normal
                response = await this.callWordPressAPI(command);
            }
            
            // 🧠 Track successful execution
            const executionTime = Date.now() - executionStart;
            this.addActionToMemory({
                type: 'command_executed',
                description: `Successfully executed: ${command}`,
                command: command,
                execution_time_ms: executionTime,
                response_status: response?.status || 'success',
                success: true
            });
            
            // 🔧 Auto-healing: Check if there are errors in the response
            const hasError = this.detectCommandError(response);
            
            if (hasError) {
                console.log('🔧 Auto-healing: Error detected, starting automatic recovery...');
                
                // 🧠 Track error detection
                this.addActionToMemory({
                    type: 'error_detected',
                    description: `Error detected in command response: ${command}`,
                    command: command,
                    error_details: response?.message || 'Unknown error',
                    success: false
                });
                
                // Show error result first
                this.addCommandResult(command, response, useServerInfo);
                
                // Change button to error state
                buttonElement.textContent = '❌ Error detected';
                buttonElement.classList.remove('loading-gradient');
                buttonElement.style.backgroundColor = '#ff5f56';
                
                // Start auto-healing process
                await this.performAutoHealing(command, response);
                
            } else {
                // Show successful result
                this.addCommandResult(command, response, useServerInfo);
                
                // Change button to completed
                buttonElement.textContent = '✅ Executed';
                buttonElement.classList.remove('loading-gradient');
                buttonElement.style.backgroundColor = '#27ca3f';
            }
            
        } catch (error) {
            console.log('🔧 Auto-healing: Excepción capturada, iniciando recuperación...');
            
            // 🧠 Track execution error
            const executionTime = Date.now() - executionStart;
            this.addActionToMemory({
                type: 'command_execution_error',
                description: `Command execution failed: ${command}`,
                command: command,
                execution_time_ms: executionTime,
                error: error.message,
                success: false
            });
            
            // Mostrar error original
            this.addErrorMessage('Error executing command: ' + error.message);
            
            // Change button to error state
            buttonElement.textContent = '❌ Connection error';
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
        
        // Check common error messages in response
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
            
            // Show message that error is being analyzed
            this.addRecoveryMessage('🔧 Analyzing the error and looking for solutions...');
            
            // Extract error message
            const errorMessage = this.extractErrorMessage(errorResponse);
            
            // Crear prompt invisible para Gemini
            const healingPrompt = `The previous command failed with this error: ${errorMessage}. Analyze why it failed and suggest a solution or alternative command to the user.`;
            
            console.log('🔧 Enviando a Gemini para análisis:', healingPrompt);
            
            // Llamar directamente a la API de Gemini sin añadir al historial
            const geminiResponse = await this.callGeminiForHealing(healingPrompt);
            
            if (geminiResponse && geminiResponse.explanation) {
                // Mostrar sugerencia de recuperación
                this.addRecoveryMessage(`🤖 **Recovery Assistant**\n\n${geminiResponse.explanation}`, geminiResponse);
            } else {
                // Fallback si Gemini no responde
                this.addRecoveryMessage('🔧 I could not analyze the error automatically. Review the previous error message and verify the configuration.');
            }
            
        } catch (error) {
            console.error('❌ Error in auto-healing:', error);
            this.addRecoveryMessage('🔧 The automatic recovery system is not available at this time.');
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
                console.log('🔑 Auto-healing using custom global API Key');
            } else {
                console.log('🔑 Auto-healing using server API Key (shared)');
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
            console.error('❌ Error in auto-healing with Gemini:', error);
            
            // Fallback para auto-healing
            return this.getHealingFallback(healingPrompt);
        }
    }

    // 🔧 Fallback for auto-healing when Gemini is not available
    getHealingFallback(healingPrompt) {
        console.log('🔧 Using fallback for auto-healing');
        
        const lowerPrompt = healingPrompt.toLowerCase();
        
        if (lowerPrompt.includes('permission denied') || lowerPrompt.includes('permiso denegado')) {
            return {
                command: 'wp user list --role=administrator',
                explanation: 'Permission error detected. Verify that you have administrator permissions and that the authentication token is valid. You can check administrator users with the suggested command.',
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

    // 🔧 Extract clean error message
    extractErrorMessage(errorResponse) {
        if (typeof errorResponse === 'string') return errorResponse;
        
        if (errorResponse.error) return errorResponse.error;
        if (errorResponse.message) return errorResponse.message;
        if (errorResponse.response) return errorResponse.response;
        
        return 'Error desconocido en la ejecución del comando';
    }

    // 🔧 Show recovery message with special style
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
            // Simple message without command
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
            // Special format for server information
            contentDiv.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <strong>🖥️ WordPress Server Information</strong>
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
                        Method: <span class="highlight-keyword">${response.exec_method}</span> | Status: <span style="color: ${statusColor}">${response.status}</span>
                        ${response.server_capabilities ? `| Server: <span class="highlight-info">Compatible</span>` : ''}
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
• Server: <span class="highlight-keyword">${info.server_info?.server_software || 'N/A'}</span>
• OS: <span class="highlight-keyword">${info.server_info?.operating_system || 'N/A'}</span>

<strong>⚙️ Execution Capabilities:</strong>
• shell_exec: ${info.execution_capabilities?.shell_exec ? '<span class="status-indicator success">✅ Available</span>' : '<span class="status-indicator error">❌ Disabled</span>'}
• exec: ${info.execution_capabilities?.exec ? '<span class="status-indicator success">✅ Available</span>' : '<span class="status-indicator error">❌ Disabled</span>'}
• system: ${info.execution_capabilities?.system ? '<span class="status-indicator success">✅ Available</span>' : '<span class="status-indicator error">❌ Disabled</span>'}
• passthru: ${info.execution_capabilities?.passthru ? '<span class="status-indicator success">✅ Available</span>' : '<span class="status-indicator error">❌ Disabled</span>'}

<strong>🔧 WP-CLI:</strong>
• Status: ${info.wp_cli?.available ? '<span class="status-indicator success">✅ Installed</span>' : '<span class="status-indicator error">❌ Not available</span>'}
• Ruta: <span class="highlight-path">${info.wp_cli?.path || 'N/A'}</span>
• Versión: <span class="highlight-version">${info.wp_cli?.version || 'N/A'}</span>
• Method: <span class="highlight-keyword">${info.wp_cli?.method || 'N/A'}</span>

<strong>🛡️ Seguridad:</strong>
• Safe Mode: <span class="highlight-keyword">${info.security_status?.safe_mode || 'N/A'}</span>
• Open Basedir: <span class="highlight-info">${info.security_status?.open_basedir || 'N/A'}</span>
• Funciones deshabilitadas: <span class="highlight-warning">${info.security_status?.disable_functions || 'Ninguna'}</span>

<strong>💡 Recommended Method:</strong> <span class="highlight-keyword">${info.recommended_method || 'N/A'}</span>
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
            // Status messages
            .replace(/^(Error:|ERROR:)/gm, '<span class="highlight-error">❌ $1</span>')
            .replace(/^(Success:|SUCCESS:)/gm, '<span class="highlight-success">✅ $1</span>')
            .replace(/^(Warning:|WARNING:)/gm, '<span class="highlight-warning">⚠️ $1</span>')
            .replace(/^(Info:|INFO:)/gm, '<span class="highlight-info">ℹ️ $1</span>')
            
            // Versiones y números
            .replace(/(\d+\.\d+\.\d+)/g, '<span class="highlight-version">$1</span>')
            .replace(/(\d+\.\d+)/g, '<span class="highlight-number">$1</span>')
            
            // Status
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
            
            // 🧠 Get enhanced session context
            const sessionContext = this.getSessionContextForGemini();
            console.log('🧠 Session context:', {
                duration: sessionContext.session_duration_minutes + ' min',
                messages: sessionContext.total_messages,
                actions: sessionContext.recent_actions.length,
                site: sessionContext.site_context?.siteName || 'None'
            });
            
            // Preparar contexto del sitio para Gemini
            const siteContext = {
                wordpress_version: this.serverCapabilities?.server_info?.wordpress_version || 'Desconocido',
                php_version: this.serverCapabilities?.server_info?.php_version || 'Desconocido',
                server_software: this.serverCapabilities?.server_info?.server_software || 'Desconocido',
                wp_cli_available: this.serverCapabilities?.wp_cli?.available || false,
                recommended_method: this.serverCapabilities?.recommended_method || 'API nativa',
                emulation_mode: this.emulationMode,
                execution_capabilities: this.serverCapabilities?.execution_capabilities || {},
                // 🧠 Add session context
                session_context: sessionContext
            };
            
            console.log('📊 Contexto del sitio para Gemini:', siteContext);
            
            // Preparar headers
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // 🔑 Añadir API Key global si existe
            if (this.hasGlobalGeminiApiKey()) {
                headers['x-user-gemini-key'] = this.globalGeminiApiKey;
                console.log('🔑 Using custom global API Key');
            } else {
                console.log('🔑 Using server API Key (shared)');
            }
            
            // Llamar al endpoint real de Gemini con contexto
            const response = await fetch(`${this.config.SERVER_URL}${this.config.API.ENDPOINTS.GEMINI_ASK}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    prompt: userMessage,
                    siteContext: siteContext,
                    chatHistory: this.sessionMemory.chatHistory // 🧠 Send enhanced session memory
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
            
            // 🧠 Add error to session memory
            this.addActionToMemory({
                type: 'gemini_error',
                description: `Gemini AI error: ${error.message}`,
                success: false,
                error: error.message
            });
            
            // Mostrar error específico al usuario
            this.addErrorMessage(`Error de IA: ${error.message}. Usando respuesta de emergencia.`);
            
            // Fallback a respuesta local si Gemini falla
            console.log('🔄 Usando sistema de emergencia...');
            return this.getEmergencyResponse(userMessage);
        }
    }

    getEmergencyResponse(userMessage) {
        // Emergency system when Gemini is not available
        console.log('🚨 Activating Typingpress emergency system for:', userMessage);
        
        const lowerMessage = userMessage.toLowerCase();
        
        // Intelligent problem diagnosis (emergency system)
        if (lowerMessage.includes('lento') || lowerMessage.includes('slow') || lowerMessage.includes('rendimiento')) {
            return {
                command: 'wp plugin list --status=active',
                explanation: 'Performance issue detected. Checking active plugins (the most common cause of slow sites) - Emergency system active.',
                is_safe: true
            };
        } else if (lowerMessage.includes('error 500') || lowerMessage.includes('error interno')) {
            return {
                command: 'wp plugin list --status=active',
                explanation: 'Error 500 detected. Checking active plugins that usually cause this error - Emergency system active.',
                is_safe: true
            };
        } else if (lowerMessage.includes('error 404') || lowerMessage.includes('no encontrada')) {
            return {
                command: 'wp rewrite flush',
                explanation: 'Error 404 detected. Regenerating permalinks to resolve pages not found - Emergency system active.',
                is_safe: true
            };
        } else if (lowerMessage.includes('no puedo entrar') || lowerMessage.includes('login') || lowerMessage.includes('acceso')) {
            return {
                command: 'wp user list --role=administrator',
                explanation: 'Access problem detected. Checking administrator users - Emergency system active.',
                is_safe: true
            };
        } else if (lowerMessage.includes('hackea') || lowerMessage.includes('malware') || lowerMessage.includes('infectado')) {
            return {
                command: 'wp user list --role=administrator',
                explanation: 'Possible security compromise. Checking admin users to detect unauthorized accounts - Emergency system active.',
                is_safe: true
            };
        } else if (lowerMessage.includes('borrar') || lowerMessage.includes('eliminar') || lowerMessage.includes('delete')) {
            return {
                command: 'wp --help',
                explanation: 'WARNING: Dangerous operation detected. Showing help for safety. Make backup before deleting - Emergency system active.',
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
                    explanation: 'Creating homepage with greeting and two service columns using WordPress blocks (Gutenberg) - Emergency system active.',
                    is_safe: true
                };
            } else if (lowerMessage.includes('página')) {
                const basicPageContent = `<!-- wp:heading {"level":1} --><h1>Nueva Página</h1><!-- /wp:heading --><!-- wp:paragraph --><p>Contenido de la página creado automáticamente. Puedes editarlo desde el panel de WordPress.</p><!-- /wp:paragraph -->`;
                
                return {
                    command: `wp post create --post_type=page --post_title="Nueva Página" --post_content='${basicPageContent}' --post_status=draft`,
                    explanation: 'Creating new page with WordPress blocks (emergency system)',
                    is_safe: true
                };
            } else {
                const basicPostContent = `<!-- wp:heading {"level":2} --><h2>Nuevo Post</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Contenido del post creado automáticamente con bloques de WordPress.</p><!-- /wp:paragraph -->`;
                
                return {
                    command: `wp post create --post_title="Nuevo Post" --post_content='${basicPostContent}' --post_status=draft`,
                    explanation: 'Creating new post with WordPress blocks (emergency system)',
                    is_safe: true
                };
            }
        }
        
        // Basic emergency patterns (simpler than config ones)
        else if (lowerMessage.includes('plugin')) {
            return {
                command: 'wp plugin list',
                explanation: 'List installed plugins (emergency system - Typingpress not available)',
                is_safe: true
            };
        } else if (lowerMessage.includes('usuario') || lowerMessage.includes('user')) {
            return {
                command: 'wp user list',
                explanation: 'List registered users (emergency system)',
                is_safe: true
            };
        } else if (lowerMessage.includes('tema') || lowerMessage.includes('theme')) {
            return {
                command: 'wp theme list',
                explanation: 'List installed themes (emergency system)',
                is_safe: true
            };
        } else if (lowerMessage.includes('versión') || lowerMessage.includes('version') || lowerMessage.includes('wordpress')) {
            return {
                command: 'wp --version',
                explanation: 'WordPress system information (emergency system)',
                is_safe: true
            };
        } else if (lowerMessage.includes('post') || lowerMessage.includes('entrada')) {
            return {
                command: 'wp post list',
                explanation: 'List recent posts (emergency system)',
                is_safe: true
            };
        } else if (lowerMessage.includes('base') && lowerMessage.includes('datos')) {
            return {
                command: 'wp db size',
                explanation: 'Show database size (emergency system)',
                is_safe: true
            };
        }
        
        // Default emergency response
        return {
            command: 'wp --version',
            explanation: 'Typingpress is not available. Emergency system active. Describe your specific problem (e.g., "slow site", "500 error") for better diagnosis.',
            is_safe: true
        };
    }

    async callWordPressAPI(command) {
        if (!this.currentSite) {
            throw new Error('No WordPress site configured. Configure a site first.');
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
                
                // Improve error messages for the user
                let userFriendlyMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
                
                if (errorData.error_type === 'CONNECTION_ERROR') {
                    if (errorData.error_code === 'ETIMEDOUT') {
                        userFriendlyMessage = `⏱️ Timeout connecting to WordPress\n\n` +
                            `The server couldn't connect to your site within the expected time.\n\n` +
                            `**Possible solutions:**\n` +
                            `${errorData.suggestions ? errorData.suggestions.map(s => `• ${s}`).join('\n') : 
                            '• Verify the site is accessible\n• Check that the plugin is installed\n• Try again in a few minutes'}`;
                    } else if (errorData.error_code === 'ENOTFOUND') {
                        userFriendlyMessage = `🌐 Could not find the site\n\n` +
                            `Verify the URL is correct: ${this.currentSite.url}`;
                    } else if (errorData.error_code === 'ECONNREFUSED') {
                        userFriendlyMessage = `🚫 Connection refused\n\n` +
                            `The WordPress server refused the connection. Verify the site is working.`;
                    }
                }
                
                throw new Error(userFriendlyMessage);
            }

            // Update last site usage
            this.currentSite.lastUsed = new Date().toISOString();
            this.saveSitesToStorage();

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            // Handle AbortController errors (client timeout)
            if (error.name === 'AbortError') {
                throw new Error(`⏱️ Application timeout\n\nThe request took longer than ${this.config.API.TIMEOUT/1000} seconds.\n\n**Possible causes:**\n• The WordPress site is overloaded\n• Connectivity issues\n• The command requires more time than expected\n\n**Solution:** Try again in a few minutes.`);
            }
            
            throw error;
        }
    }

    // 🎨 NEW FUNCTIONS FOR THE SIDEBAR

    showGlobalApiKeyModal() {
        // For now, use the main modal but pre-fill the API key
        this.showConfigModal();
        
        // Pre-fill the global API key if it exists
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
            this.addMessage('assistant', '⚠️ You need to connect a WordPress site first. Use the ⚙️ button to configure your site.');
            return;
        }

        this.addMessage('user', '🔍 Run complete autodiagnosis');
        
        try {
            // Show start message
            this.addMessage('assistant', '🔍 **Starting Complete Diagnosis**\n\nAnalyzing connectivity and server capabilities...');
            
            // Step 1: Check basic connectivity
            console.log('🔍 Step 1: Checking connectivity...');
            const connectivityTest = await this.testConnection(this.currentSite.url, this.currentSite.token);
            
            if (!connectivityTest.success) {
                this.addMessage('assistant', `❌ **Connectivity Error Detected**\n\n${connectivityTest.error}\n\n**Recommendations:**\n• Verify the site is accessible: ${this.currentSite.url}\n• Check that the Gemini WP-CLI plugin is installed and active\n• Review the security token configuration\n• Contact your hosting if the problem persists`);
                return;
            }
            
            // Step 2: Get server information
            console.log('🔍 Step 2: Getting server information...');
            const serverInfo = await this.getServerInfo();
            
            let diagnosticMessage = `✅ **Diagnosis Completed Successfully**\n\n`;
            diagnosticMessage += `**Site Information:**\n`;
            diagnosticMessage += `• Name: ${this.currentSite.name}\n`;
            diagnosticMessage += `• URL: ${this.currentSite.url}\n`;
            diagnosticMessage += `• Status: 🟢 Connected and working\n\n`;
            
            diagnosticMessage += `**Server Information:**\n`;
            diagnosticMessage += `• WordPress: ${serverInfo.server_info?.wordpress_version || 'Unknown'}\n`;
            diagnosticMessage += `• PHP: ${serverInfo.server_info?.php_version || 'Unknown'}\n`;
            diagnosticMessage += `• Server: ${serverInfo.server_info?.server_software || 'Unknown'}\n`;
            diagnosticMessage += `• WP-CLI: ${serverInfo.wp_cli?.available ? '✅ Available' : '❌ Not available'}\n`;
            diagnosticMessage += `• Recommended method: ${serverInfo.recommended_method || 'Native API'}\n\n`;
            
            if (serverInfo.execution_capabilities) {
                const capabilities = serverInfo.execution_capabilities;
                diagnosticMessage += `**Execution Capabilities:**\n`;
                diagnosticMessage += `• shell_exec: ${capabilities.shell_exec ? '✅' : '❌'}\n`;
                diagnosticMessage += `• exec: ${capabilities.exec ? '✅' : '❌'}\n`;
                diagnosticMessage += `• system: ${capabilities.system ? '✅' : '❌'}\n`;
                diagnosticMessage += `• passthru: ${capabilities.passthru ? '✅' : '❌'}\n\n`;
            }
            
            // Add recommendations based on capabilities
            if (serverInfo.wp_cli?.available) {
                diagnosticMessage += `🚀 **Excellent**: Your server has WP-CLI installed. You'll have full access to all commands with maximum performance.`;
            } else {
                diagnosticMessage += `⚠️ **Note**: Your server doesn't have WP-CLI installed, but don't worry. We'll use WordPress native API which works perfectly for most commands.`;
            }
            
            this.addMessage('assistant', diagnosticMessage);
            
        } catch (error) {
            console.error('❌ Error in autodiagnosis:', error);
            this.addMessage('assistant', `❌ **Diagnosis Error**\n\n${error.message}\n\n**Possible causes:**\n• Connectivity issues with the site\n• Plugin not installed or inactive\n• Incorrect security token\n• Hosting restrictions\n\n**Solution:** Check the site configuration and try again.`);
        }
    }

    async runCleanup() {
        if (!this.currentSite) {
            this.addMessage('assistant', '⚠️ You need to connect a WordPress site first. Use the ⚙️ button to configure your site.');
            return;
        }

        this.addMessage('user', '🧹 Run cleanup and optimization');
        
        try {
            // Execute cleanup commands
            const cleanupCommands = [
                'wp cache flush',
                'wp db clean',
                'wp db optimize'
            ];
            
            let cleanupMessage = `🧹 **Cleanup and Optimization Started**\n\n`;
            
            for (const command of cleanupCommands) {
                try {
                    const result = await this.executeCommand(command);
                    cleanupMessage += `✅ ${command}: Completed\n`;
                } catch (error) {
                    cleanupMessage += `⚠️ ${command}: ${error.message}\n`;
                }
            }
            
            cleanupMessage += `\n🎉 Cleanup process completed. Your site has been optimized.`;
            
            this.addMessage('assistant', cleanupMessage);
            
        } catch (error) {
            console.error('❌ Error in cleanup:', error);
            this.addMessage('assistant', '❌ Error executing cleanup. Some commands may not be available on your hosting.');
        }
    }

    clearChatHistory() {
        // Clear chat area
        this.chatArea.innerHTML = '';
        
        // Clear history in memory
        this.chatHistory = [];
        
        // Add welcome message
        this.addMessage('assistant', `Hello! I'm Typingpress, your personal Gemini agent for WordPress. 

I can help you with:
🔧 Managing your WordPress site (plugins, themes, users, content)
🎨 Generating custom CSS, JavaScript, PHP code
💬 Answering web development questions
📝 Creating content with Gutenberg blocks
🗄️ Optimizing and maintaining your database

How can I help you today?`);
        
        console.log('🗑️ Chat history cleared');
    }

    // Update site information in sidebar
    updateSidebarSiteInfo() {
        console.log('🔄 Updating site information in sidebar and header...');
        
        const connectedSiteInfo = document.getElementById('connectedSiteInfo');
        const currentSiteName = document.getElementById('currentSiteName');
        const currentSiteUrl = document.getElementById('currentSiteUrl');
        const currentSiteStatus = document.getElementById('currentSiteStatus');
        
        // 🆕 Header elements
        const activeSiteIndicator = document.getElementById('activeSiteIndicator');
        const activeSiteName = document.getElementById('activeSiteName');
        
        console.log('📊 Current site:', this.currentSite?.name || 'None');
        console.log('📊 Elements found:', {
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
                    currentSiteStatus.textContent = 'Connected';
                    currentSiteStatus.className = 'site-status connected';
                } else {
                    currentSiteStatus.textContent = 'Disconnected';
                    currentSiteStatus.className = 'site-status disconnected';
                }
            }
            
            // 🆕 Update header indicator
            if (activeSiteIndicator) {
                activeSiteIndicator.style.display = 'flex';
                console.log('✅ Showing active site indicator');
            }
            if (activeSiteName) {
                activeSiteName.textContent = this.currentSite.name;
                console.log('✅ Site name updated in header:', this.currentSite.name);
            }
            
        } else {
            // No connected site
            if (connectedSiteInfo) {
                connectedSiteInfo.style.display = 'none';
            }
            if (activeSiteIndicator) {
                activeSiteIndicator.style.display = 'none';
                console.log('❌ Hiding active site indicator');
            }
        }
        
        // Update API status
        const apiStatusValue = document.getElementById('apiStatusValue');
        if (apiStatusValue) {
            if (this.hasGlobalGeminiApiKey()) {
                apiStatusValue.textContent = 'Personal API Key (unlimited)';
                apiStatusValue.className = 'api-status-value';
            } else {
                apiStatusValue.textContent = 'Free queries (50/hour)';
                apiStatusValue.className = 'api-status-value free';
            }
        }
        
        // 🆕 Update site dropdown
        this.updateSiteDropdown();
        
        console.log('✅ Site information updated correctly');
    }

    // 🆕 Show stateless mode indicator in sidebar
    showStatelessModeIndicator() {
        const connectedSiteInfo = document.getElementById('connectedSiteInfo');
        if (connectedSiteInfo) {
            connectedSiteInfo.style.display = 'block';
            
            const siteName = document.getElementById('currentSiteName');
            const siteUrl = document.getElementById('currentSiteUrl');
            const siteStatus = document.getElementById('currentSiteStatus');
            
            if (siteName) siteName.textContent = 'No site connected';
            if (siteUrl) siteUrl.textContent = 'Temporary chat mode';
            if (siteStatus) {
                siteStatus.textContent = 'Stateless';
                siteStatus.className = 'site-status disconnected';
            }
        }
        
        // Update header indicator
        this.updateHeaderForStatelessMode();
        
        // Show welcome message for stateless mode
        this.showStatelessWelcomeMessage();
    }

    // 🆕 Update header to show stateless mode
    updateHeaderForStatelessMode() {
        const activeSiteIndicator = document.querySelector('.active-site-indicator');
        if (activeSiteIndicator) {
            const siteIndicatorName = activeSiteIndicator.querySelector('.site-indicator-name');
            const siteIndicatorLabel = activeSiteIndicator.querySelector('.site-indicator-label');
            
            if (siteIndicatorName) {
                siteIndicatorName.textContent = 'No site connected';
                siteIndicatorName.style.color = '#ffbd2e';
            }
            if (siteIndicatorLabel) {
                siteIndicatorLabel.textContent = 'Temporary chat';
            }
        }
    }

    // 🆕 Show welcome message for stateless mode
    showStatelessWelcomeMessage() {
        this.addMessage('assistant', 
            `<div style="background: rgba(255, 189, 46, 0.1); border: 1px solid #ffbd2e; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <strong>💬 Welcome to Temporary Chat Mode</strong><br><br>
                You're chatting with Gemini AI without a WordPress site connected. This mode offers:
                <ul style="margin: 12px 0 0 20px; color: #e0e0e0;">
                    <li>General AI assistance and conversation</li>
                    <li>Code generation (HTML, CSS, JavaScript, PHP)</li>
                    <li>Explanations and tutorials</li>
                    <li>No conversation history stored</li>
                </ul>
            </div>
            
            <strong>🚀 Ready to unlock full WordPress capabilities?</strong><br><br>
            Connect your WordPress site using the ⚙️ button to access:
            <ul style="margin: 8px 0 0 20px; color: #10a37f;">
                <li>Site analysis and diagnostics</li>
                <li>Policy-driven recommendations</li>
                <li>Guided workflows and automation</li>
                <li>Real WordPress abilities and commands</li>
                <li>Conversation memory and context</li>
            </ul>
            
            <br><em style="color: #8e8ea0;">Ask me anything to get started! 🤖</em>`
        );
    }

    // 🧠 Initialize memory management UI
    initializeMemoryUI() {
        // Add memory status to sidebar
        this.updateMemoryStatusUI();
        
        // Update memory status every 30 seconds
        setInterval(() => {
            this.updateMemoryStatusUI();
        }, 30000);
    }

    // 🧠 Update memory status in UI
    updateMemoryStatusUI() {
        const memoryStatusElement = document.getElementById('memoryStatus');
        if (memoryStatusElement) {
            const sessionDuration = Math.round(this.getSessionDuration() / 60000);
            const messageCount = this.sessionMemory.chatHistory.length;
            const actionCount = this.sessionMemory.executedActions.length;
            
            memoryStatusElement.innerHTML = `
                <div class="memory-status-title">Session Memory</div>
                <div class="memory-status-details">
                    <div>Duration: ${sessionDuration}m</div>
                    <div>Messages: ${messageCount}/10</div>
                    <div>Actions: ${actionCount}/20</div>
                </div>
                <button class="memory-clear-btn" onclick="window.geminiApp.clearSessionMemory()">
                    Clear Memory
                </button>
            `;
        }
    }

    // 🆕 Function to update site dropdown - SIMPLIFIED VERSION
    updateSiteDropdown() {
        console.log('📋 Updating site dropdown...');
        const siteDropdownList = document.getElementById('siteDropdownList');
        
        if (!siteDropdownList) {
            console.error('❌ siteDropdownList element not found');
            return;
        }
        
        // Clear content
        siteDropdownList.innerHTML = '';
        
        if (this.savedSites.length === 0) {
            siteDropdownList.innerHTML = `
                <div style="padding: 12px 16px; text-align: center; color: #888;">
                    No sites configured
                </div>
            `;
            return;
        }
        
        // Create site elements with inline styles
        this.savedSites.forEach((site) => {
            const isActive = this.currentSite?.id === site.id;
            const statusText = site.status === 'connected' ? 'Connected' : 'Disconnected';
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
                    ${!isActive ? `<button onclick="window.geminiApp.selectSiteFromDropdown('${site.id}')" style="background: none; border: 1px solid #404040; color: #888; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">Use</button>` : '<span style="color: #27ca3f; font-size: 10px;">● Active</span>'}
                    <button onclick="window.geminiApp.deleteSiteFromDropdown('${site.id}')" style="background: none; border: 1px solid #404040; color: #888; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">Disconnect</button>
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
        
        console.log('✅ Dropdown updated correctly');
    }

    // 🆕 Function to select site from dropdown
    selectSiteFromDropdown(siteId) {
        this.selectSite(siteId);
        this.hideSiteDropdown();
    }

    // 🆕 Function to delete site from dropdown
    deleteSiteFromDropdown(siteId) {
        const site = this.savedSites.find(s => s.id === siteId);
        if (!site) return;
        
        if (confirm(`Are you sure you want to disconnect "${site.name}"?\n\nThis will remove the saved configuration for this site.`)) {
            this.deleteSite(siteId);
            this.updateSiteDropdown();
            
            // Show confirmation message
            this.addMessage('assistant', 
                `<strong>🔌 Site disconnected</strong><br><br>
                Removed configuration for: <code>${site.name}</code><br>
                URL: <span style="color: #888;">${site.url}</span><br><br>
                <em>You can reconnect it anytime using the ⚙️ button</em>`
            );
        }
    }

    // 🆕 SIMPLIFIED DROPDOWN IMPLEMENTATION
    
    // 🆕 Function to show/hide dropdown
    toggleSiteDropdown() {
        console.log('🔄 toggleSiteDropdown called');
        const dropdown = document.getElementById('siteDropdown');
        
        if (!dropdown) {
            console.error('❌ siteDropdown element not found in DOM');
            return;
        }
        
        const isVisible = dropdown.style.display === 'block';
        console.log('📂 Current dropdown state:', isVisible ? 'visible' : 'hidden');
        
        if (isVisible) {
            this.hideSiteDropdown();
        } else {
            this.showSiteDropdown();
        }
    }

    // 🆕 Function to show dropdown - SIMPLIFIED VERSION
    showSiteDropdown() {
        console.log('📂 Showing site dropdown');
        const dropdown = document.getElementById('siteDropdown');
        
        if (!dropdown) {
            console.error('❌ siteDropdown element not found');
            return;
        }
        
        // Update content first
        this.updateSiteDropdown();
        
        // Show with inline styles to force visibility
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
        
        // Add class for animation
        dropdown.classList.add('show');
        
        // Event listener to close when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick.bind(this), { once: true });
        }, 100);
        
        console.log('✅ Dropdown shown with inline styles');
    }

    // 🆕 Function to hide dropdown - SIMPLIFIED VERSION
    hideSiteDropdown() {
        console.log('📂 Hiding site dropdown');
        const dropdown = document.getElementById('siteDropdown');
        
        if (!dropdown) return;
        
        dropdown.style.display = 'none';
        dropdown.classList.remove('show');
        
        console.log('✅ Dropdown hidden');
    }

    // 🆕 Function to handle outside clicks - SIMPLIFIED VERSION
    handleOutsideClick(event) {
        const dropdown = document.getElementById('siteDropdown');
        const indicator = document.getElementById('activeSiteIndicator');
        
        if (!dropdown || !indicator) return;
        
        // If click was outside dropdown and indicator, close
        if (!dropdown.contains(event.target) && !indicator.contains(event.target)) {
            console.log('👆 Outside click detected, closing dropdown');
            this.hideSiteDropdown();
        }
    }

    // Function to normalize Gemini text before Markdown rendering
    normalizeGeminiMarkdown(text) {
        if (!text) return text;
        
        console.log('🔧 Normalizing Gemini text...');
        
        // Debug: show some problematic characters
        const problematicChars = text.match(/[\u2018\u2019\u00B4\u201C\u201D\u2028\u2029\u200B-\u200D\uFEFF]/g);
        if (problematicChars) {
            console.log('⚠️ Problematic characters found:', problematicChars.map(c => `${c} (U+${c.charCodeAt(0).toString(16).toUpperCase()})`));
        }
        
        return text
            // Normalize fake backticks to ASCII backticks
            .replace(/[\u2018\u2019\u00B4]/g, '`')  // Curved quotes and acute accent → backtick
            .replace(/[\u201C\u201D]/g, '"')        // Curved double quotes → ASCII quotes
            
            // Normalize line breaks
            .replace(/\r\n/g, '\n')                // Windows line endings → Unix
            .replace(/\u2028|\u2029/g, '\n')       // Unicode line/paragraph separators → \n
            
            // Remove invisible characters
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces, BOM, etc.
            
            // Normalize non-standard spaces
            .replace(/\u00A0/g, ' ')               // Non-breaking space → space
            .replace(/\u2000-\u200A/g, ' ')        // Various Unicode spaces → space
            
            // Clean multiple spaces and excessive empty lines
            .replace(/[ \t]+/g, ' ')               // Multiple spaces/tabs → single space
            .replace(/\n{3,}/g, '\n\n');           // Multiple newlines → max 2
    }

    // Function to render basic Markdown
    renderMarkdown(content) {
        console.log('🔧 renderMarkdown started, content:', content?.substring(0, 100) + '...');
        
        if (!content) {
            console.log('❌ Empty content, returning empty string');
            return '';
        }
        
        // NORMALIZE CONTENT BEFORE PROCESSING
        const normalizedContent = this.normalizeGeminiMarkdown(content);
        console.log('✅ Content normalized');
        
        // Debug: compare original vs normalized content
        if (content !== normalizedContent) {
            console.log('🔄 Content changed after normalization');
            console.log('📄 Original (first 200 chars):', content.substring(0, 200));
            console.log('📄 Normalized (first 200 chars):', normalizedContent.substring(0, 200));
        }
        
        let formatted = normalizedContent;
        console.log('📝 Content to process:', formatted.length, 'characters');
        
        // 🔍 ADVANCED DEBUG: Analyze complete content
        console.log('🔍 COMPLETE CONTENT ANALYSIS:');
        console.log('📄 Complete content:', formatted);
        
        // Search for different code patterns
        const patterns = {
            'triple_backticks': /```[\s\S]*?```/g,
            'triple_backticks_with_lang': /```\w+[\s\S]*?```/g,
            'single_backticks': /`[^`]+`/g,
            'code_word': /código|code|php|css|javascript|html/gi
        };
        
        Object.entries(patterns).forEach(([name, pattern]) => {
            const matches = formatted.match(pattern);
            console.log(`🔍 Pattern ${name}:`, matches?.length || 0, matches ? matches.slice(0, 3) : 'none');
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
                                    Copy code
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
                            Copy code
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

    // 🔄 WORKFLOW ENGINE: Show workflow suggestions
    addWorkflowSuggestions(workflowContext) {
        if (!workflowContext || !workflowContext.has_suggestions || !workflowContext.suggestions.length) {
            return;
        }
        
        console.log('🔄 Mostrando sugerencias de workflows:', workflowContext.suggestions.length);
        
        const workflowsDiv = document.createElement('div');
        workflowsDiv.className = 'message assistant workflow-suggestions';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        let workflowsHtml = `
            <div class="workflow-suggestions-container">
                <div class="workflow-header">
                    <div class="workflow-icon">🔄</div>
                    <div class="workflow-title">Procedimientos Guiados Recomendados</div>
                    <div class="workflow-count">${workflowContext.suggestions.length} workflow${workflowContext.suggestions.length > 1 ? 's' : ''}</div>
                </div>
                
                <div class="workflow-principle">
                    <strong>Principle:</strong> "A workflow is not automation. It's an intelligent checklist guided by AI."
                </div>
                
                <div class="workflow-suggestions-list">
        `;
        
        workflowContext.suggestions.forEach((suggestion, index) => {
            const strengthIcon = this.getWorkflowStrengthIcon(suggestion.recommendation_strength);
            const strengthColor = this.getWorkflowStrengthColor(suggestion.recommendation_strength);
            
            // Generar ID único para el botón
            const startButtonId = `workflow_start_${suggestion.workflow.id}_${Date.now()}`;
            
            workflowsHtml += `
                <div class="workflow-suggestion-card" data-strength="${suggestion.recommendation_strength}">
                    <div class="workflow-card-header">
                        <div class="workflow-strength" style="color: ${strengthColor}">
                            ${strengthIcon} ${suggestion.recommendation_strength.toUpperCase()}
                        </div>
                        <div class="workflow-category">${suggestion.workflow.category}</div>
                        <div class="workflow-risk" style="color: ${this.getRiskColor(suggestion.workflow.overall_risk_level)}">
                            ${this.getRiskIcon(suggestion.workflow.overall_risk_level)} ${suggestion.workflow.overall_risk_level}
                        </div>
                    </div>
                    
                    <div class="workflow-content">
                        <h4 class="workflow-title">${suggestion.workflow.name}</h4>
                        <p class="workflow-description">${suggestion.workflow.description}</p>
                        
                        <div class="workflow-details">
                            <div class="workflow-info">
                                <span class="workflow-info-item">
                                    <strong>Pasos:</strong> ${suggestion.workflow.steps_count}
                                </span>
                                <span class="workflow-info-item">
                                    <strong>Duración:</strong> ${suggestion.workflow.estimated_duration}
                                </span>
                                <span class="workflow-info-item">
                                    <strong>Riesgo:</strong> ${suggestion.workflow.overall_risk_level}
                                </span>
                            </div>
                            
                            <div class="workflow-reasons">
                                <strong>¿Por qué se recomienda?</strong>
                                <ul>
                                    ${suggestion.reasons.map(reason => `<li>${reason}</li>`).join('')}
                                </ul>
                            </div>
                            
                            ${suggestion.workflow.prerequisites && suggestion.workflow.prerequisites.length > 0 ? `
                            <div class="workflow-prerequisites">
                                <strong>Prerequisites:</strong>
                                <ul>
                                    ${suggestion.workflow.prerequisites.map(prereq => `<li>${this.formatPrerequisite(prereq)}</li>`).join('')}
                                </ul>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="workflow-actions">
                        <button id="${startButtonId}" class="workflow-action-button start">
                            🚀 Iniciar Procedimiento Guiado
                        </button>
                    </div>
                    
                    <div class="workflow-tags">
                        ${suggestion.workflow.tags.map(tag => `<span class="workflow-tag">${tag}</span>`).join('')}
                    </div>
                </div>
            `;
        });
        
        workflowsHtml += `
                </div>
                
                <div class="workflow-footer">
                    <small>🔄 Los workflows te guían paso a paso manteniendo control total sobre cada acción.</small>
                </div>
            </div>
        `;
        
        contentDiv.innerHTML = workflowsHtml;
        workflowsDiv.appendChild(contentDiv);
        this.chatArea.appendChild(workflowsDiv);
        
        // Agregar event listeners para todos los botones
        workflowContext.suggestions.forEach((suggestion, index) => {
            const startButtonId = `workflow_start_${suggestion.workflow.id}_${Date.now()}`;
            const startButton = document.getElementById(startButtonId);
            
            if (startButton) {
                startButton.addEventListener('click', (e) => {
                    this.startWorkflow(suggestion.workflow, e.target);
                });
            }
        });
        
        this.scrollToBottom();
    }
    
    // 🔄 WORKFLOW ENGINE: Obtener icono de fuerza de recomendación
    getWorkflowStrengthIcon(strength) {
        const icons = {
            'high': '🔥',
            'medium': '⭐',
            'low': '💡'
        };
        return icons[strength] || '📋';
    }
    
    // 🔄 WORKFLOW ENGINE: Obtener color de fuerza de recomendación
    getWorkflowStrengthColor(strength) {
        const colors = {
            'high': '#ff5f56',
            'medium': '#ffbd2e',
            'low': '#27ca3f'
        };
        return colors[strength] || '#888';
    }
    
    // 🔄 WORKFLOW ENGINE: Formatear prerequisito
    formatPrerequisite(prereq) {
        const prereqNames = {
            'backup_recent': 'Backup reciente (últimos 7 días)',
            'admin_access': 'Acceso de administrador',
            'maintenance_window': 'Ventana de mantenimiento'
        };
        return prereqNames[prereq] || prereq;
    }
    
    // 🔄 WORKFLOW ENGINE: Iniciar workflow
    async startWorkflow(workflow, buttonElement) {
        const originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<div class="loading"></div> Iniciando...';
        buttonElement.classList.add('loading-gradient');
        
        console.log('🔄 Iniciando workflow:', workflow.id);
        
        try {
            const response = await fetch(`/api/wp/workflows/${workflow.id}/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    wordpressUrl: this.currentSite.url,
                    authToken: this.currentSite.token,
                    context: {
                        user_initiated: true,
                        source: 'workflow_suggestion'
                    }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
            
            // Mostrar interfaz de workflow
            this.displayWorkflowInterface(data.session_data);
            
            // Mensaje de confirmación
            const startMessage = `
                <div class="workflow-started-message">
                    <h4>🚀 Procedimiento Iniciado</h4>
                    <p><strong>${workflow.name}</strong> ha sido iniciado exitosamente.</p>
                    <p>Sesión ID: <code>${data.session_id}</code></p>
                    <p>Ahora puedes proceder paso a paso con control total sobre cada acción.</p>
                </div>
            `;
            
            this.addMessage('assistant', startMessage);
            
        } catch (error) {
            console.error('❌ Error iniciando workflow:', error);
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
            
            const errorMessage = `
                <div class="workflow-error-message">
                    <h4>❌ Error Iniciando Procedimiento</h4>
                    <p>No se pudo iniciar el workflow <strong>${workflow.name}</strong>.</p>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p>Por favor, verifica tu conexión y vuelve a intentar.</p>
                </div>
            `;
            
            this.addMessage('assistant', errorMessage);
        }
    }
    
    // 🔄 WORKFLOW ENGINE: Mostrar interfaz de workflow
    displayWorkflowInterface(sessionData) {
        const workflowDiv = document.createElement('div');
        workflowDiv.className = 'message assistant workflow-interface';
        workflowDiv.id = `workflow_${sessionData.session_id}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        let interfaceHtml = `
            <div class="workflow-interface-container">
                <div class="workflow-interface-header">
                    <div class="workflow-interface-title">
                        <h3>🔄 ${sessionData.workflow.name}</h3>
                        <p>${sessionData.workflow.description}</p>
                    </div>
                    <div class="workflow-interface-status">
                        <span class="workflow-status ${sessionData.status}">${sessionData.status.toUpperCase()}</span>
                        <span class="workflow-risk ${sessionData.accumulated_risk}">Riesgo: ${sessionData.accumulated_risk.toUpperCase()}</span>
                    </div>
                </div>
                
                <div class="workflow-progress">
                    <div class="workflow-progress-bar">
                        <div class="workflow-progress-fill" style="width: ${sessionData.progress ? sessionData.progress.percentage : 0}%"></div>
                    </div>
                    <div class="workflow-progress-text">
                        Progreso: ${sessionData.progress ? sessionData.progress.completed_steps : 0}/${sessionData.workflow.steps.length} pasos
                    </div>
                </div>
                
                <div class="workflow-steps-list">
        `;
        
        sessionData.workflow.steps.forEach((step, index) => {
            const stepStatus = sessionData.steps_status[index];
            const statusClass = stepStatus.status;
            const statusIcon = this.getStepStatusIcon(stepStatus);
            
            interfaceHtml += `
                <div class="workflow-step" data-step-index="${index}" data-status="${statusClass}">
                    <div class="workflow-step-header">
                        <div class="workflow-step-status">
                            ${statusIcon} <span class="step-number">${index + 1}</span>
                        </div>
                        <div class="workflow-step-title">
                            <h4>${step.name}</h4>
                            <p>${step.description}</p>
                        </div>
                        <div class="workflow-step-info">
                            <span class="step-risk ${step.risk_level}">${step.risk_level}</span>
                            <span class="step-time">${step.estimated_time}</span>
                            ${step.required ? '<span class="step-required">REQUERIDO</span>' : '<span class="step-optional">OPCIONAL</span>'}
                        </div>
                    </div>
                    
                    <div class="workflow-step-actions">
                        <button class="workflow-step-button simulate" data-session="${sessionData.session_id}" data-step="${index}">
                            🧪 Simulate
                        </button>
                        <button class="workflow-step-button execute" data-session="${sessionData.session_id}" data-step="${index}">
                            ✅ Execute
                        </button>
                        <button class="workflow-step-button skip" data-session="${sessionData.session_id}" data-step="${index}">
                            ⏭️ Saltar
                        </button>
                    </div>
                    
                    <div class="workflow-step-result" id="step_result_${sessionData.session_id}_${index}">
                        <!-- Resultados aparecerán aquí -->
                    </div>
                </div>
            `;
        });
        
        interfaceHtml += `
                </div>
                
                <div class="workflow-interface-footer">
                    <button class="workflow-cancel-button" data-session="${sessionData.session_id}">
                        ❌ Cancel Procedure
                    </button>
                    <div class="workflow-session-info">
                        <small>Sesión: ${sessionData.session_id} | Iniciado: ${new Date(sessionData.started_at).toLocaleString()}</small>
                    </div>
                </div>
            </div>
        `;
        
        contentDiv.innerHTML = interfaceHtml;
        workflowDiv.appendChild(contentDiv);
        this.chatArea.appendChild(workflowDiv);
        
        // Agregar event listeners para todos los botones de pasos
        this.attachWorkflowStepListeners(sessionData.session_id);
        
        this.scrollToBottom();
    }
    
    // 🔄 WORKFLOW ENGINE: Get step status icon
    getStepStatusIcon(stepStatus) {
        const icons = {
            'pending': '⏳',
            'simulated': '🧪',
            'completed': '✅',
            'skipped': '⏭️',
            'error': '❌'
        };
        return icons[stepStatus.status] || '⏳';
    }
    
    // 🔄 WORKFLOW ENGINE: Adjuntar listeners a botones de pasos
    attachWorkflowStepListeners(sessionId) {
        // Botones de simular
        document.querySelectorAll(`.workflow-step-button.simulate[data-session="${sessionId}"]`).forEach(button => {
            button.addEventListener('click', (e) => {
                const stepIndex = parseInt(e.target.dataset.step);
                this.simulateWorkflowStep(sessionId, stepIndex, e.target);
            });
        });
        
        // Botones de ejecutar
        document.querySelectorAll(`.workflow-step-button.execute[data-session="${sessionId}"]`).forEach(button => {
            button.addEventListener('click', (e) => {
                const stepIndex = parseInt(e.target.dataset.step);
                this.executeWorkflowStep(sessionId, stepIndex, e.target);
            });
        });
        
        // Botones de saltar
        document.querySelectorAll(`.workflow-step-button.skip[data-session="${sessionId}"]`).forEach(button => {
            button.addEventListener('click', (e) => {
                const stepIndex = parseInt(e.target.dataset.step);
                this.skipWorkflowStep(sessionId, stepIndex, e.target);
            });
        });
        
        // Botón de cancelar
        document.querySelectorAll(`.workflow-cancel-button[data-session="${sessionId}"]`).forEach(button => {
            button.addEventListener('click', (e) => {
                this.cancelWorkflow(sessionId, e.target);
            });
        });
    }
    
    // 🔄 WORKFLOW ENGINE: Simular paso de workflow
    async simulateWorkflowStep(sessionId, stepIndex, buttonElement) {
        const originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<div class="loading"></div> Simulando...';
        buttonElement.classList.add('loading-gradient');
        
        console.log(`🧪 Simulando paso ${stepIndex} de sesión ${sessionId}`);
        
        try {
            const response = await fetch(`/api/wp/workflows/sessions/${sessionId}/steps/${stepIndex}/simulate`, {
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
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
            
            // Mostrar resultado de simulación
            this.displayStepResult(sessionId, stepIndex, data.result, 'simulation');
            
            // Update visual step status
            this.updateStepStatus(sessionId, stepIndex, 'simulated');
            
        } catch (error) {
            console.error('❌ Error simulando paso:', error);
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
            
            // Mostrar error
            this.displayStepResult(sessionId, stepIndex, { error: error.message }, 'error');
        }
    }
    
    // 🔄 WORKFLOW ENGINE: Ejecutar paso de workflow
    async executeWorkflowStep(sessionId, stepIndex, buttonElement) {
        // Confirmar ejecución
        if (!confirm('¿Estás seguro de que quieres ejecutar este paso? Esta acción realizará cambios reales en tu sitio.')) {
            return;
        }
        
        const originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<div class="loading"></div> Ejecutando...';
        buttonElement.classList.add('loading-gradient');
        
        console.log(`⚡ Ejecutando paso ${stepIndex} de sesión ${sessionId}`);
        
        try {
            const response = await fetch(`/api/wp/workflows/sessions/${sessionId}/steps/${stepIndex}/execute`, {
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
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
            
            // Mostrar resultado de ejecución
            this.displayStepResult(sessionId, stepIndex, data.result, 'execution');
            
            // Update visual step status
            this.updateStepStatus(sessionId, stepIndex, 'completed');
            
            // Verificar si el workflow está completo
            if (data.result.workflow_complete) {
                this.displayWorkflowCompletion(sessionId);
            }
            
        } catch (error) {
            console.error('❌ Error ejecutando paso:', error);
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
            
            // Mostrar error
            this.displayStepResult(sessionId, stepIndex, { error: error.message }, 'error');
            this.updateStepStatus(sessionId, stepIndex, 'error');
        }
    }
    
    // 🔄 WORKFLOW ENGINE: Saltar paso de workflow
    async skipWorkflowStep(sessionId, stepIndex, buttonElement) {
        const reason = prompt('¿Por qué quieres saltar este paso? (opcional)') || '';
        
        const originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<div class="loading"></div> Saltando...';
        buttonElement.classList.add('loading-gradient');
        
        console.log(`⏭️ Saltando paso ${stepIndex} de sesión ${sessionId}`);
        
        try {
            const response = await fetch(`/api/wp/workflows/sessions/${sessionId}/steps/${stepIndex}/skip`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    wordpressUrl: this.currentSite.url,
                    authToken: this.currentSite.token,
                    reason: reason
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
            
            // Mostrar resultado
            this.displayStepResult(sessionId, stepIndex, { 
                message: `Paso saltado${reason ? ': ' + reason : ''}`,
                skip_reason: reason 
            }, 'skip');
            
            // Update visual step status
            this.updateStepStatus(sessionId, stepIndex, 'skipped');
            
        } catch (error) {
            console.error('❌ Error saltando paso:', error);
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
            
            // Mostrar error
            this.displayStepResult(sessionId, stepIndex, { error: error.message }, 'error');
        }
    }
    
    // 🔄 WORKFLOW ENGINE: Cancelar workflow
    async cancelWorkflow(sessionId, buttonElement) {
        if (!confirm('¿Estás seguro de que quieres cancelar este procedimiento? Se perderá el progreso actual.')) {
            return;
        }
        
        const reason = prompt('¿Por qué cancelas el procedimiento? (opcional)') || '';
        
        const originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<div class="loading"></div> Cancelando...';
        buttonElement.classList.add('loading-gradient');
        
        console.log(`❌ Cancelling workflow for session ${sessionId}`);
        
        try {
            const response = await fetch(`/api/wp/workflows/sessions/${sessionId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    wordpressUrl: this.currentSite.url,
                    authToken: this.currentSite.token,
                    reason: reason
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Deshabilitar toda la interfaz del workflow
            const workflowInterface = document.getElementById(`workflow_${sessionId}`);
            if (workflowInterface) {
                workflowInterface.classList.add('workflow-cancelled');
                workflowInterface.querySelectorAll('button').forEach(btn => btn.disabled = true);
            }
            
            const cancelMessage = `
                <div class="workflow-cancelled-message">
                    <h4>❌ Procedure Cancelled</h4>
                    <p>The workflow has been cancelled successfully.</p>
                    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                    <p>You can start a new procedure whenever you want.</p>
                </div>
            `;
            
            this.addMessage('assistant', cancelMessage);
            
        } catch (error) {
            console.error('❌ Error cancelando workflow:', error);
            
            // Restaurar botón
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('loading-gradient');
            
            const errorMessage = `
                <div class="workflow-error-message">
                    <h4>❌ Error Cancelando Procedimiento</h4>
                    <p><strong>Error:</strong> ${error.message}</p>
                </div>
            `;
            
            this.addMessage('assistant', errorMessage);
        }
    }
    
    // 🔄 WORKFLOW ENGINE: Mostrar resultado de paso
    displayStepResult(sessionId, stepIndex, result, type) {
        const resultContainer = document.getElementById(`step_result_${sessionId}_${stepIndex}`);
        if (!resultContainer) return;
        
        let resultHtml = '';
        
        switch (type) {
            case 'simulation':
                resultHtml = `
                    <div class="step-result simulation">
                        <h5>🧪 Resultado de Simulación</h5>
                        <div class="result-content">
                            ${this.formatStepResult(result.simulation_result)}
                        </div>
                        <div class="impact-report">
                            <strong>Impacto Previsto:</strong>
                            <p>${result.impact_report?.human_explanation?.what_will_happen || 'Cambios según parámetros especificados'}</p>
                        </div>
                    </div>
                `;
                break;
                
            case 'execution':
                resultHtml = `
                    <div class="step-result execution">
                        <h5>✅ Resultado de Ejecución</h5>
                        <div class="result-content">
                            ${this.formatStepResult(result.execution_result)}
                        </div>
                        <div class="execution-time">
                            <small>Ejecutado en: ${result.execution_result?.execution_time || 'N/A'}</small>
                        </div>
                    </div>
                `;
                break;
                
            case 'skip':
                resultHtml = `
                    <div class="step-result skip">
                        <h5>⏭️ Paso Saltado</h5>
                        <p>${result.message}</p>
                    </div>
                `;
                break;
                
            case 'error':
                resultHtml = `
                    <div class="step-result error">
                        <h5>❌ Error</h5>
                        <p>${result.error}</p>
                    </div>
                `;
                break;
        }
        
        resultContainer.innerHTML = resultHtml;
    }
    
    // 🔄 WORKFLOW ENGINE: Formatear resultado de paso
    formatStepResult(result) {
        if (!result) return '<p>No result available</p>';
        
        if (typeof result === 'string') {
            return `<p>${result}</p>`;
        }
        
        if (typeof result === 'object') {
            let html = '';
            
            if (result.message) {
                html += `<p><strong>Mensaje:</strong> ${result.message}</p>`;
            }
            
            if (result.summary) {
                html += `<p><strong>Resumen:</strong> ${result.summary}</p>`;
            }
            
            if (result.changes_description) {
                html += `<p><strong>Cambios:</strong> ${result.changes_description}</p>`;
            }
            
            if (result.affected_items) {
                html += `<p><strong>Elementos afectados:</strong> ${result.affected_items}</p>`;
            }
            
            return html || '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
        }
        
        return '<p>' + String(result) + '</p>';
    }
    
    // 🔄 WORKFLOW ENGINE: Update visual step status
    updateStepStatus(sessionId, stepIndex, status) {
        const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
        if (stepElement) {
            stepElement.dataset.status = status;
            
            const statusIcon = stepElement.querySelector('.workflow-step-status');
            if (statusIcon) {
                statusIcon.innerHTML = this.getStepStatusIcon({ status }) + ` <span class="step-number">${stepIndex + 1}</span>`;
            }
        }
    }
    
    // 🔄 WORKFLOW ENGINE: Mostrar completación de workflow
    displayWorkflowCompletion(sessionId) {
        const completionMessage = `
            <div class="workflow-completion-message">
                <h3>🎉 Procedure Completed</h3>
                <p>The workflow has been completed successfully.</p>
                <p>All required steps have been executed or skipped according to your decisions.</p>
                <p><strong>Session:</strong> ${sessionId}</p>
            </div>
        `;
        
        this.addMessage('assistant', completionMessage);
        
        // Disable completed workflow buttons
        const workflowInterface = document.getElementById(`workflow_${sessionId}`);
        if (workflowInterface) {
            workflowInterface.classList.add('workflow-completed');
            workflowInterface.querySelectorAll('.workflow-step-button').forEach(btn => btn.disabled = true);
        }
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

// Global function to copy code to clipboard
function copyCodeToClipboard(codeId, button) {
    const codeElement = document.getElementById(codeId);
    if (!codeElement) return;
    
    // Get code text (without highlight.js HTML)
    const code = codeElement.textContent || codeElement.innerText;
    const originalText = button.innerHTML;
    
    navigator.clipboard.writeText(code).then(() => {
        // Change button temporarily
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
            Copied!
        `;
        button.classList.add('copied');
        
        // Restore after 2 seconds
        setTimeout(() => {
            button.innerHTML = originalText;
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Error copying:', err);
        // Fallback for older browsers
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
                Copied!
            `;
            button.classList.add('copied');
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('copied');
            }, 2000);
        } catch (fallbackErr) {
            console.error('Error in copy fallback:', fallbackErr);
        } finally {
            document.body.removeChild(textArea);
        }
    });
}

// 🧪 Test function to simulate Gemini response with code
function testGeminiResponseWithCode() {
    console.log('🧪 STARTING GEMINI RESPONSE WITH CODE TEST');
    
    // Simulate different types of responses that Gemini could send
    const testResponses = [
        {
            name: 'Response with normal CSS code',
            content: `Hello! Of course, I can help you with that.

To make a header fixed in WordPress, you usually need to add custom CSS. Here's the code:

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
    padding-top: 80px; /* Adjust according to your header height */
}
\`\`\`

This code will make your header stay fixed at the top of the page.`
        },
        {
            name: 'Response with problematic Unicode characters',
            content: `Hello! Of course, I can help you with that.

To make a header fixed in WordPress, you usually need to add custom CSS. Here's the code:

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
    padding-top: 80px; /* Adjust according to your header height */
}
\u2019\u2019\u2019

This code will make your header stay fixed at the top of the page.`
        }
    ];
    
    testResponses.forEach((testResponse, index) => {
        console.log(`\n🧪 TEST ${index + 1}: ${testResponse.name}`);
        console.log('📄 Original content:', testResponse.content);
        
        if (window.geminiApp && window.geminiApp.renderMarkdown) {
            const result = window.geminiApp.renderMarkdown(testResponse.content);
            console.log('✅ Rendered result:', result);
            
            // Add message to interface
            window.geminiApp.addMessage('assistant', testResponse.content);
        } else {
            console.error('❌ window.geminiApp not available');
        }
    });
    
    console.log('\n🧪 TESTS COMPLETED');
}
// 🧪 Specific test function for Gemini format without backticks
function testGeminiAlternativeFormat() {
    console.log('🧪 STARTING GEMINI ALTERNATIVE FORMAT TEST');
    
    // Simulate the real response you received from Gemini
    const realGeminiResponse = `Of course! To make a header fixed in WordPress, you generally need to apply some CSS. Here's a basic example you can add to your child theme's \`style.css\` file, or in the WordPress customizer (Appearance > Customize > Additional CSS):

css
/* For a fixed header at the top */
.site-header { /* Or your header selector, like #masthead, #header, etc. */
    position: fixed;
    top: 0;
    width: 100%; /* Ensures it takes the full width */
    background-color: #ffffff; /* A background color so content doesn't show through */
    z-index: 1000; /* Ensures the header is above other elements */
    box-shadow: 0 2px 5px rgba(0,0,0,0.1); /* Optional: a subtle shadow */
}

/* IMPORTANT: Add padding to body so content doesn't go under the fixed header */
body {
    padding-top: 80px; /* Adjust this value according to your header height */
}

**Explanation:**

1. **\`.site-header\`**: This is an example selector.`;
    
    console.log('📄 Test content (real Gemini format):', realGeminiResponse);
    
    if (window.geminiApp && window.geminiApp.renderMarkdown) {
        const result = window.geminiApp.renderMarkdown(realGeminiResponse);
        console.log('✅ Resultado renderizado:', result);
        
        // Añadir el mensaje a la interfaz
        window.geminiApp.addMessage('assistant', realGeminiResponse);
    } else {
        console.error('❌ window.geminiApp not available');
    }
    
    console.log('🧪 PRUEBA DE FORMATO ALTERNATIVO COMPLETADA');
}

// 📝 CODE SNIPPETS SYSTEM (v0.1) - Extension to GeminiWPCLI class

// Load code snippets from localStorage
GeminiWPCLI.prototype.loadCodeSnippets = function() {
    try {
        const savedSnippets = localStorage.getItem('gemini-wp-cli-snippets');
        if (savedSnippets) {
            const snippets = JSON.parse(savedSnippets);
            console.log('📝 Loaded', snippets.length, 'code snippets');
            return snippets;
        }
    } catch (error) {
        console.error('❌ Error loading code snippets:', error);
    }
    return [];
};

// Save code snippets to localStorage
GeminiWPCLI.prototype.saveCodeSnippets = function() {
    try {
        localStorage.setItem('gemini-wp-cli-snippets', JSON.stringify(this.codeSnippets));
        console.log('📝 Saved', this.codeSnippets.length, 'code snippets');
    } catch (error) {
        console.error('❌ Error saving code snippets:', error);
    }
};

// Add a new code snippet
GeminiWPCLI.prototype.addCodeSnippet = function(name, type, code, description = '') {
    const snippet = {
        id: 'snippet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: name.trim(),
        type: type, // 'php', 'css', 'js'
        code: code.trim(),
        description: description.trim(),
        createdAt: new Date().toISOString(),
        lastUsed: null,
        useCount: 0
    };

    this.codeSnippets.push(snippet);
    this.saveCodeSnippets();
    
    // 🧠 Track snippet creation in session memory
    this.addActionToMemory({
        type: 'snippet_created',
        description: `Created ${type.toUpperCase()} snippet: ${name}`,
        snippet_name: name,
        snippet_type: type,
        success: true
    });

    console.log('📝 Added code snippet:', name, `(${type})`);
    return snippet;
};

// Delete a code snippet
GeminiWPCLI.prototype.deleteCodeSnippet = function(snippetId) {
    const snippet = this.codeSnippets.find(s => s.id === snippetId);
    if (snippet) {
        this.codeSnippets = this.codeSnippets.filter(s => s.id !== snippetId);
        this.saveCodeSnippets();
        
        // 🧠 Track snippet deletion
        this.addActionToMemory({
            type: 'snippet_deleted',
            description: `Deleted ${snippet.type.toUpperCase()} snippet: ${snippet.name}`,
            snippet_name: snippet.name,
            snippet_type: snippet.type,
            success: true
        });

        console.log('📝 Deleted code snippet:', snippet.name);
        return true;
    }
    return false;
};

// Use a code snippet (increment usage counter)
GeminiWPCLI.prototype.useCodeSnippet = function(snippetId) {
    const snippet = this.codeSnippets.find(s => s.id === snippetId);
    if (snippet) {
        snippet.useCount++;
        snippet.lastUsed = new Date().toISOString();
        this.saveCodeSnippets();
        
        // 🧠 Track snippet usage
        this.addActionToMemory({
            type: 'snippet_used',
            description: `Used ${snippet.type.toUpperCase()} snippet: ${snippet.name}`,
            snippet_name: snippet.name,
            snippet_type: snippet.type,
            success: true
        });

        console.log('📝 Used code snippet:', snippet.name, `(${snippet.useCount} times)`);
        return snippet;
    }
    return null;
};

// Get snippets by type
GeminiWPCLI.prototype.getSnippetsByType = function(type) {
    return this.codeSnippets.filter(s => s.type === type);
};

// Search snippets by name or content
GeminiWPCLI.prototype.searchSnippets = function(query) {
    const lowerQuery = query.toLowerCase();
    return this.codeSnippets.filter(snippet => 
        snippet.name.toLowerCase().includes(lowerQuery) ||
        snippet.description.toLowerCase().includes(lowerQuery) ||
        snippet.code.toLowerCase().includes(lowerQuery)
    );
};

// Show code snippets modal
GeminiWPCLI.prototype.showCodeSnippetsModal = function() {
    const modal = document.getElementById('snippetsModal');
    if (modal) {
        this.updateSnippetsDisplay();
        modal.classList.add('show');
    }
};

// Hide code snippets modal
GeminiWPCLI.prototype.hideCodeSnippetsModal = function() {
    const modal = document.getElementById('snippetsModal');
    if (modal) {
        modal.classList.remove('show');
    }
};

// Update snippets display in modal
GeminiWPCLI.prototype.updateSnippetsDisplay = function() {
    const snippetsList = document.getElementById('snippetsList');
    if (!snippetsList) return;

    if (this.codeSnippets.length === 0) {
        snippetsList.innerHTML = `
            <div class="no-snippets">
                <p>No code snippets saved yet.</p>
                <p>Create your first snippet to get started!</p>
            </div>
        `;
        return;
    }

    // Group snippets by type
    const snippetsByType = {
        php: this.getSnippetsByType('php'),
        css: this.getSnippetsByType('css'),
        js: this.getSnippetsByType('js')
    };

    let html = '';
    
    Object.entries(snippetsByType).forEach(([type, snippets]) => {
        if (snippets.length > 0) {
            const typeIcon = type === 'php' ? '🐘' : type === 'css' ? '🎨' : '⚡';
            html += `
                <div class="snippets-section">
                    <h3 class="snippets-section-title">${typeIcon} ${type.toUpperCase()} Snippets (${snippets.length})</h3>
                    <div class="snippets-grid">
            `;
            
            snippets.forEach(snippet => {
                const lastUsed = snippet.lastUsed ? 
                    new Date(snippet.lastUsed).toLocaleDateString() : 'Never';
                
                html += `
                    <div class="snippet-card" data-snippet-id="${snippet.id}">
                        <div class="snippet-header">
                            <div class="snippet-name">${snippet.name}</div>
                            <div class="snippet-actions">
                                <button class="snippet-action-btn use-btn" onclick="window.geminiApp.insertSnippetIntoChat('${snippet.id}')">
                                    Use
                                </button>
                                <button class="snippet-action-btn delete-btn" onclick="window.geminiApp.deleteSnippetWithConfirmation('${snippet.id}')">
                                    Delete
                                </button>
                            </div>
                        </div>
                        ${snippet.description ? `<div class="snippet-description">${snippet.description}</div>` : ''}
                        <div class="snippet-code">
                            <pre><code>${this.escapeHtml(snippet.code)}</code></pre>
                        </div>
                        <div class="snippet-meta">
                            <span>Used ${snippet.useCount} times</span>
                            <span>Last used: ${lastUsed}</span>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
    });

    snippetsList.innerHTML = html;
};

// Insert snippet into chat input
GeminiWPCLI.prototype.insertSnippetIntoChat = function(snippetId) {
    const snippet = this.useCodeSnippet(snippetId);
    if (snippet) {
        const messageInput = this.messageInput;
        const currentValue = messageInput.value;
        const snippetText = `\n\n// ${snippet.name} (${snippet.type.toUpperCase()})\n${snippet.code}\n`;
        
        messageInput.value = currentValue + snippetText;
        this.autoResizeTextarea();
        messageInput.focus();
        
        this.hideCodeSnippetsModal();
        
        // Show confirmation
        this.addMessage('assistant', 
            `<strong>📝 Code snippet inserted</strong><br><br>
            Added "${snippet.name}" (${snippet.type.toUpperCase()}) to your message.<br>
            <em>Remember: This is for reference only. Execution still requires confirmation.</em>`
        );
    }
};

// Delete snippet with confirmation
GeminiWPCLI.prototype.deleteSnippetWithConfirmation = function(snippetId) {
    const snippet = this.codeSnippets.find(s => s.id === snippetId);
    if (snippet && confirm(`Delete snippet "${snippet.name}"?\n\nThis action cannot be undone.`)) {
        this.deleteCodeSnippet(snippetId);
        this.updateSnippetsDisplay();
        
        this.addMessage('assistant', 
            `<strong>📝 Snippet deleted</strong><br><br>
            Removed "${snippet.name}" (${snippet.type.toUpperCase()}) from your snippets.`
        );
    }
};

// Show create snippet modal
GeminiWPCLI.prototype.showCreateSnippetModal = function() {
    const modal = document.getElementById('createSnippetModal');
    if (modal) {
        // Clear form
        document.getElementById('snippetName').value = '';
        document.getElementById('snippetType').value = 'php';
        document.getElementById('snippetCode').value = '';
        document.getElementById('snippetDescription').value = '';
        
        modal.classList.add('show');
        document.getElementById('snippetName').focus();
    }
};

// Hide create snippet modal
GeminiWPCLI.prototype.hideCreateSnippetModal = function() {
    const modal = document.getElementById('createSnippetModal');
    if (modal) {
        modal.classList.remove('show');
    }
};

// Handle create snippet form submission
GeminiWPCLI.prototype.handleCreateSnippet = function() {
    const name = document.getElementById('snippetName').value.trim();
    const type = document.getElementById('snippetType').value;
    const code = document.getElementById('snippetCode').value.trim();
    const description = document.getElementById('snippetDescription').value.trim();

    if (!name) {
        alert('Please enter a snippet name.');
        return;
    }

    if (!code) {
        alert('Please enter the code content.');
        return;
    }

    // Check for duplicate names
    if (this.codeSnippets.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        alert('A snippet with this name already exists. Please choose a different name.');
        return;
    }

    const snippet = this.addCodeSnippet(name, type, code, description);
    this.hideCreateSnippetModal();
    
    this.addMessage('assistant', 
        `<strong>📝 Code snippet created</strong><br><br>
        Created "${snippet.name}" (${snippet.type.toUpperCase()}) snippet.<br>
        You can now use it in future conversations for reference.`
    );
};

// Utility function to escape HTML
GeminiWPCLI.prototype.escapeHtml = function(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// 📝 Initialize code snippets UI
GeminiWPCLI.prototype.initializeSnippetsUI = function() {
    // Add event listener for code snippets button
    const codeSnippetsButton = document.getElementById('codeSnippetsButton');
    if (codeSnippetsButton) {
        codeSnippetsButton.addEventListener('click', () => {
            console.log('📝 Opening code snippets modal');
            this.showCodeSnippetsModal();
        });
        console.log('📝 Code snippets button initialized');
    } else {
        console.error('❌ Code snippets button not found');
    }

    // Add keyboard shortcuts for snippets
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Shift + S to open snippets
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            this.showCodeSnippetsModal();
        }
    });

    console.log('📝 Code snippets UI initialized');
};