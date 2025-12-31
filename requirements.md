Paso 1: El Cerebro (Prompt Engineering en gemini-logic.js)
Objetivo: Que Gemini no solo "hable", sino que devuelva JSON puro con el comando WP-CLI.
Tarea para Kiro: "Configura gemini-logic.js para que el System Instruction obligue a Gemini a responder siempre en un formato JSON: { "command": "wp post list", "explanation": "..." }. No debe incluir texto extra fuera del JSON."

Paso 2: El Puente (Seguridad y Conexión en server.js)
Objetivo: Conectar tu Web App con el WordPress de forma segura.
Tarea para Kiro: "En server.js, implementa una función que envíe el comando generado por Gemini al endpoint REST API de nuestro plugin de WordPress, usando un Application Password de WordPress para la autenticación."

Paso 3: El Ejecutor (Refinamiento del Plugin PHP)
Objetivo: Que el plugin reciba el comando y lo ejecute de forma segura.
Tarea para Kiro: "Modifica el plugin de WordPress para que solo acepte comandos de una 'lista blanca' (ej: post, plugin, theme) y devuelva el resultado de la ejecución (STDOUT) en formato JSON al servidor."

Paso 4: La Experiencia (Frontend y Terminal)
Objetivo: Una interfaz que se sienta como una terminal inteligente.
Tarea para Kiro: "Crea una UI simple con una caja de texto central. Cuando el usuario escriba, muestra una animación de 'Gemini pensando' y luego muestra el comando generado antes de ejecutarlo, pidiendo confirmación al usuario."

Paso 5: El Ciclo de Feedback (Manejo de Errores)
Objetivo: Si un comando falla, Gemini debe explicar por qué en lenguaje natural.
Tarea para Kiro: "Si el plugin devuelve un error, envía ese error de vuelta a Gemini para que le explique al usuario qué salió mal y sugiera una corrección."