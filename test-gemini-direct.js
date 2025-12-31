const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testGemini() {
    try {
        console.log('🧪 Probando conexión directa con Gemini...');
        
        const apiKey = process.env.GEMINI_API_KEY;
        console.log('🔑 API Key:', apiKey ? 'Configurada' : 'NO CONFIGURADA');
        
        if (!apiKey) {
            throw new Error('API Key no configurada');
        }
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: "Eres un asistente útil. Responde de forma breve y amigable."
        });
        
        console.log('📤 Enviando mensaje de prueba...');
        const result = await model.generateContent("Hola, ¿cómo estás?");
        const response = result.response;
        const text = response.text();
        
        console.log('✅ Respuesta de Gemini:', text);
        console.log('🎉 Prueba exitosa!');
        
    } catch (error) {
        console.error('❌ Error en prueba:', error.message);
        console.error('📋 Detalles del error:', error);
    }
}

testGemini();