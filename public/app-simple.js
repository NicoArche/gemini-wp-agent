// Versión simplificada para debug
console.log('🚀 Cargando app-simple.js...');

class SimpleGeminiApp {
    constructor() {
        console.log('🔧 Constructor SimpleGeminiApp iniciado');
        
        // Solo elementos esenciales
        this.configButton = document.getElementById('configButton');
        this.configModal = document.getElementById('configModal');
        
        if (!this.configButton) {
            console.error('❌ configButton no encontrado');
            return;
        }
        
        if (!this.configModal) {
            console.error('❌ configModal no encontrado');
            return;
        }
        
        console.log('✅ Elementos encontrados:', {
            configButton: this.configButton,
            configModal: this.configModal
        });
        
        this.initEvents();
    }
    
    initEvents() {
        console.log('🎧 Registrando eventos...');
        
        this.configButton.addEventListener('click', (e) => {
            console.log('🖱️ CLICK EN BOTÓN DE CONFIGURACIÓN');
            e.preventDefault();
            e.stopPropagation();
            this.showModal();
        });
        
        // Cerrar modal al hacer clic en la X
        const closeButton = document.getElementById('configCloseButton');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                console.log('🖱️ Click en cerrar');
                this.hideModal();
            });
        }
        
        // Cerrar modal al hacer clic fuera
        this.configModal.addEventListener('click', (e) => {
            if (e.target === this.configModal) {
                console.log('🖱️ Click fuera del modal');
                this.hideModal();
            }
        });
        
        console.log('✅ Eventos registrados');
    }
    
    showModal() {
        console.log('🔧 Mostrando modal...');
        this.configModal.classList.add('show');
        console.log('✅ Modal mostrado');
    }
    
    hideModal() {
        console.log('❌ Ocultando modal...');
        this.configModal.classList.remove('show');
        console.log('✅ Modal ocultado');
    }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM cargado, inicializando app simple...');
    
    try {
        window.simpleApp = new SimpleGeminiApp();
        console.log('✅ App simple inicializada');
    } catch (error) {
        console.error('❌ Error en app simple:', error);
    }
});

// Test automático después de 3 segundos
setTimeout(() => {
    console.log('🧪 Ejecutando test automático...');
    const button = document.getElementById('configButton');
    if (button) {
        console.log('🤖 Simulando click automático...');
        button.click();
    } else {
        console.error('❌ Botón no encontrado para test automático');
    }
}, 3000);