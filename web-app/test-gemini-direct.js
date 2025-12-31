const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testGeminiDirect() {
    console.log('🔍 Probando conexión directa con Gemini API...');
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Lista de modelos a probar (incluyendo modelos más nuevos)
    const modelsToTest = [
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b', 
        'gemini-1.5-pro',
        'gemini-pro',
        'gemini-1.0-pro'
    ];
    
    const apiVersions = ['v1beta', 'v1'];
    
    for (const apiVersion of apiVersions) {
        console.log(`\n🔧 === PROBANDO API ${apiVersion.toUpperCase()} ===`);
        
        for (const modelName of modelsToTest) {
            try {
                console.log(`\n🧪 Probando: ${modelName} con API ${apiVersion}`);
                
                const model = genAI.getGenerativeModel({ 
                    model: modelName 
                }, { apiVersion: apiVersion });
                
                const result = await model.generateContent("Responde solo: OK");
                const response = result.response;
                const text = response.text();
                
                console.log(`✅ ${modelName} (${apiVersion}): FUNCIONA`);
                console.log(`📝 Respuesta: ${text}`);
                
                // Si encontramos un modelo que funciona, probamos con JSON
                console.log(`🧠 Probando respuesta JSON...`);
                const jsonTest = await model.generateContent(`
                    Eres un experto en WordPress. Responde SOLO con JSON válido:
                    {
                        "command": "wp plugin list",
                        "explanation": "Lista los plugins instalados",
                        "is_safe": true,
                        "agent_thought": "Comando básico de consulta"
                    }
                `);
                
                const jsonResponse = jsonTest.response.text();
                console.log(`📋 Respuesta JSON: ${jsonResponse}`);
                
                // Intentar parsear el JSON
                try {
                    const cleanJson = jsonResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    const parsed = JSON.parse(cleanJson);
                    console.log(`✅ JSON válido parseado correctamente`);
                    console.log(`🎯 MODELO FUNCIONANDO: ${modelName} (${apiVersion})`);
                    return { 
                        success: true, 
                        model: modelName, 
                        apiVersion: apiVersion,
                        response: parsed 
                    };
                } catch (parseError) {
                    console.log(`⚠️ JSON no válido, pero el modelo responde`);
                    console.log(`🔍 Error de parsing: ${parseError.message}`);
                }
                
            } catch (error) {
                console.log(`❌ ${modelName} (${apiVersion}): ${error.message.substring(0, 100)}...`);
                
                // Analizar el tipo de error
                if (error.message.includes('quota') || error.message.includes('Quota')) {
                    console.log(`💡 Cuota excedida - API funcionando pero limitada`);
                    return { 
                        success: false, 
                        quotaExceeded: true, 
                        model: modelName, 
                        apiVersion: apiVersion,
                        message: 'Cuota excedida - API funcionando' 
                    };
                } else if (error.message.includes('404') || error.message.includes('not found')) {
                    console.log(`🚫 Modelo no disponible en ${apiVersion}`);
                } else if (error.message.includes('API key')) {
                    console.log(`🔑 Problema con API key`);
                    return { 
                        success: false, 
                        apiKeyError: true,
                        message: 'Error de API key' 
                    };
                } else {
                    console.log(`🔍 Error: ${error.message.substring(0, 150)}`);
                }
            }
        }
    }
    
    return { success: false, message: 'Ningún modelo disponible en ninguna API' };
}

// Ejecutar la prueba
testGeminiDirect()
    .then(result => {
        console.log('\n🏁 RESULTADO FINAL:');
        console.log(result);
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 ERROR FATAL:', error);
        process.exit(1);
    });