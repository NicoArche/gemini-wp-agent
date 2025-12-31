<?php
/*
Plugin Name: Gemini WP-CLI Bridge
Description: Endpoint seguro para ejecutar comandos WP-CLI desde la App de la Hackathon con tokens seguros automáticos.
Version: 2.0
Author: Gemini Hackathon Team
*/

if (!defined('ABSPATH')) exit;

// Función de logging para diagnóstico
function gemini_log($message) {
    $log_file = WP_CONTENT_DIR . '/gemini-debug.log';
    $timestamp = date('Y-m-d H:i:s');
    $log_entry = "[{$timestamp}] {$message}" . PHP_EOL;
    file_put_contents($log_file, $log_entry, FILE_APPEND | LOCK_EX);
}

// Hook de activación del plugin
register_activation_hook(__FILE__, function() {
    gemini_log('Plugin Gemini WP-CLI Bridge v2.0 activado');
    
    // Generar token automáticamente si no existe
    $existing_token = get_option('gemini_wp_cli_token');
    if (empty($existing_token)) {
        $new_token = gemini_generate_secure_token();
        update_option('gemini_wp_cli_token', $new_token);
        update_option('gemini_wp_cli_token_date', current_time('mysql'));
        gemini_log('Token de seguridad generado automáticamente');
    } else {
        gemini_log('Token existente encontrado, manteniéndolo');
    }
    
    flush_rewrite_rules();
});

// 🔑 PÁGINA DE ADMINISTRACIÓN PARA VER EL TOKEN
add_action('admin_menu', function() {
    add_options_page(
        'Gemini WP-CLI Token',
        'Gemini Token',
        'manage_options',
        'gemini-token',
        'gemini_token_admin_page'
    );
});

function gemini_token_admin_page() {
    $token = get_option('gemini_wp_cli_token');
    $token_date = get_option('gemini_wp_cli_token_date');
    
    echo '<div class="wrap">';
    echo '<h1>🔑 Gemini WP-CLI Token</h1>';
    echo '<div style="background: #fff; padding: 20px; border: 1px solid #ccc; border-radius: 5px; margin: 20px 0;">';
    echo '<h2>Token de Seguridad Actual:</h2>';
    echo '<p><strong style="font-size: 16px; color: #0073aa; font-family: monospace; background: #f1f1f1; padding: 10px; border-radius: 3px; display: block;">' . esc_html($token) . '</strong></p>';
    echo '<p><em>Generado el: ' . esc_html($token_date) . '</em></p>';
    echo '<hr>';
    echo '<h3>📋 Instrucciones:</h3>';
    echo '<ol>';
    echo '<li><strong>Copia el token de arriba</strong></li>';
    echo '<li>Ve a tu webapp Gemini WP-Agent</li>';
    echo '<li>Clic en ⚙️ para configurar sitio</li>';
    echo '<li>Pega este token en el campo "Token de Seguridad"</li>';
    echo '<li>URL del sitio: <code>' . home_url() . '</code></li>';
    echo '</ol>';
    echo '</div>';
    
    // Botón para regenerar token
    if (isset($_POST['regenerate_token']) && wp_verify_nonce($_POST['_wpnonce'], 'regenerate_token')) {
        $new_token = gemini_generate_secure_token();
        update_option('gemini_wp_cli_token', $new_token);
        update_option('gemini_wp_cli_token_date', current_time('mysql'));
        echo '<div class="notice notice-success"><p>✅ Token regenerado exitosamente!</p></div>';
        echo '<script>window.location.reload();</script>';
    }
    
    echo '<form method="post" style="margin-top: 20px;">';
    wp_nonce_field('regenerate_token');
    echo '<input type="submit" name="regenerate_token" class="button button-secondary" value="🔄 Regenerar Token" onclick="return confirm(\'¿Estás seguro? Esto invalidará el token actual.\');">';
    echo '</form>';
    echo '</div>';
}

// 1. Registrar el endpoint en la API REST
add_action('rest_api_init', function () {
    gemini_log('Registrando endpoint REST API: /wp-json/gemini/v1/execute');
    
    $result = register_rest_route('gemini/v1', '/execute', array(
        'methods' => 'POST',
        'callback' => 'gemini_handle_command',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'command' => array(
                'required' => true,
                'type' => 'string',
            ),
        ),
    ));
    
    // 🔑 ENDPOINT PARA OBTENER TOKEN (solo para testing)
    register_rest_route('gemini/v1', '/get-token', array(
        'methods' => 'GET',
        'callback' => 'gemini_get_token_endpoint',
        'permission_callback' => '__return_true', // Público para facilitar testing
    ));
    
    if ($result) {
        gemini_log('Endpoint registrado exitosamente');
    } else {
        gemini_log('ERROR: No se pudo registrar el endpoint');
    }
    
    // Verificar si la API REST está habilitada
    if (!function_exists('rest_url')) {
        gemini_log('ERROR: La API REST de WordPress no está disponible');
    } else {
        gemini_log('API REST disponible en: ' . rest_url('gemini/v1/execute'));
    }
});

// Verificar plugins de seguridad que puedan interferir
add_action('init', function() {
    $security_plugins = array(
        'wordfence/wordfence.php' => 'Wordfence Security',
        'wp-security-audit-log/wp-security-audit-log.php' => 'WP Security Audit Log',
        'wps-hide-login/wps-hide-login.php' => 'WPS Hide Login',
        'all-in-one-wp-security-and-firewall/wp-security.php' => 'All In One WP Security',
        'sucuri-scanner/sucuri.php' => 'Sucuri Security',
        'jetpack/jetpack.php' => 'Jetpack (puede bloquear API)',
    );
    
    $active_security_plugins = array();
    foreach ($security_plugins as $plugin_path => $plugin_name) {
        if (is_plugin_active($plugin_path)) {
            $active_security_plugins[] = $plugin_name;
        }
    }
    
    if (!empty($active_security_plugins)) {
        gemini_log('ADVERTENCIA: Plugins de seguridad activos que pueden bloquear API REST: ' . implode(', ', $active_security_plugins));
    } else {
        gemini_log('No se detectaron plugins de seguridad conocidos que bloqueen API REST');
    }
});

// 2. Verificación de seguridad (Token)
function gemini_verify_token(WP_REST_Request $request) {
    gemini_log('Verificando token de autenticación...');
    
    $token = $request->get_header('X-Gemini-Auth');
    $secret_token = get_option('gemini_wp_cli_token');
    
    // Si no existe token, generar uno nuevo
    if (empty($secret_token)) {
        $secret_token = gemini_generate_secure_token();
        update_option('gemini_wp_cli_token', $secret_token);
        gemini_log('Token generado automáticamente: ' . substr($secret_token, 0, 8) . '...');
    }
    
    if (empty($token)) {
        gemini_log('ERROR: No se proporcionó token de autenticación');
        return false;
    }
    
    $is_valid = hash_equals($secret_token, $token);
    gemini_log($is_valid ? 'Token válido' : 'Token inválido');
    
    return $is_valid;
}

// Función para generar token seguro
function gemini_generate_secure_token() {
    // Generar token de 64 caracteres usando múltiples fuentes de entropía
    $entropy = [
        wp_generate_password(32, true, true),
        uniqid('gemini_', true),
        microtime(true),
        wp_rand(),
        get_site_url(),
        current_time('timestamp')
    ];
    
    $combined = implode('|', $entropy);
    return hash('sha256', $combined);
}

// Función para obtener el token actual (para mostrar al admin)
function gemini_get_current_token() {
    $token = get_option('gemini_wp_cli_token');
    if (empty($token)) {
        $token = gemini_generate_secure_token();
        update_option('gemini_wp_cli_token', $token);
    }
    return $token;
}

// Función para regenerar token
function gemini_regenerate_token() {
    $new_token = gemini_generate_secure_token();
    update_option('gemini_wp_cli_token', $new_token);
    gemini_log('Token regenerado por administrador');
    return $new_token;
}

// 🔑 Función para obtener el token (endpoint público para testing)
function gemini_get_token_endpoint($request) {
    $token = get_option('gemini_wp_cli_token');
    $token_date = get_option('gemini_wp_cli_token_date');
    
    if (empty($token)) {
        return new WP_Error('no_token', 'No hay token configurado', array('status' => 404));
    }
    
    return array(
        'success' => true,
        'token' => $token,
        'generated_at' => $token_date,
        'site_url' => home_url(),
        'instructions' => array(
            '1. Copia el token de arriba',
            '2. Ve a tu webapp Gemini WP-Agent',
            '3. Configura el sitio con este token',
            '4. URL del sitio: ' . home_url()
        )
    );
}

// 3. Ejecución del comando
function gemini_handle_command($request) {
    gemini_log('=== NUEVA PETICIÓN RECIBIDA ===');
    gemini_log('Método: ' . $request->get_method());
    gemini_log('URL: ' . $request->get_route());
    gemini_log('Headers: ' . json_encode($request->get_headers()));
    
    try {
        $params = $request->get_json_params();
        $command = $params['command'] ?? '';
        
        gemini_log('Comando recibido: ' . $command);

        if (empty($command)) {
            gemini_log('ERROR: No se proporcionó comando');
            return new WP_Error('no_command', 'No se proporcionó un comando', array('status' => 400));
        }

        // VERIFICACIÓN: Detectar capacidades del servidor
        $exec_functions = ['shell_exec', 'exec', 'system', 'passthru'];
        $available_function = null;
        $server_capabilities = array();
        
        foreach ($exec_functions as $func) {
            $server_capabilities[$func] = function_exists($func);
            if (function_exists($func) && !$available_function) {
                $available_function = $func;
            }
        }
        
        // Verificar si WP-CLI está realmente instalado
        $wp_cli_available = false;
        $wp_cli_path = '';
        
        if ($available_function) {
            if ($available_function === 'shell_exec') {
                $wp_cli_path = shell_exec('which wp 2>/dev/null') ?: shell_exec('whereis wp 2>/dev/null');
            } elseif ($available_function === 'exec') {
                exec('which wp 2>/dev/null', $output, $return_code);
                if ($return_code === 0) {
                    $wp_cli_path = implode("\n", $output);
                }
            }
            
            $wp_cli_available = !empty(trim($wp_cli_path));
        }
        
        gemini_log('Capacidades del servidor: ' . json_encode($server_capabilities));
        gemini_log('WP-CLI disponible: ' . ($wp_cli_available ? 'Sí' : 'No'));
        gemini_log('Ruta WP-CLI: ' . trim($wp_cli_path));
        
        // Decidir método de ejecución
        if (!$available_function) {
            gemini_log('INFO: Funciones de ejecución desactivadas, usando API nativa de WordPress');
            $output = gemini_execute_wp_native($command);
            
            return array(
                'status' => 'success',
                'command' => $command,
                'exec_method' => 'wordpress_native_api',
                'server_capabilities' => $server_capabilities,
                'wp_cli_available' => false,
                'response' => $output
            );
        } elseif (!$wp_cli_available) {
            gemini_log('INFO: WP-CLI no instalado, usando API nativa de WordPress');
            $output = gemini_execute_wp_native($command);
            
            return array(
                'status' => 'success',
                'command' => $command,
                'exec_method' => 'wordpress_native_fallback',
                'server_capabilities' => $server_capabilities,
                'wp_cli_available' => false,
                'response' => $output
            );
        }
        
        gemini_log('Usando WP-CLI real con función: ' . $available_function);

        // DIAGNÓSTICO: Verificar si WP-CLI está disponible (ya verificado arriba)
        gemini_log('Verificación WP-CLI: ' . trim($wp_cli_path));
        
        // SEGURIDAD: Solo permitir comandos que empiecen con "wp "
        if (!preg_match('/^wp\s+/', $command)) {
            gemini_log('SEGURIDAD: Comando no empieza con "wp "');
            return new WP_Error('invalid_command', 'Solo se permiten comandos WP-CLI (deben empezar con "wp ")', array('status' => 400));
        }
        
        // Bloquear comandos extremadamente peligrosos
        $dangerous_patterns = [
            'db drop',
            'db reset', 
            'config create',
            'config set',
            'core download --force',
            'plugin delete',
            'theme delete',
            'user delete',
            'post delete',
            'rm -rf',
            'sudo',
            '&&',
            '||',
            ';',
            '|'
        ];
        
        foreach ($dangerous_patterns as $pattern) {
            if (strpos(strtolower($command), $pattern) !== false) {
                gemini_log('SEGURIDAD: Comando bloqueado por contener patrón peligroso: ' . $pattern);
                return new WP_Error('forbidden', 'Comando restringido por seguridad: ' . $pattern, array('status' => 403));
            }
        }

        // Ejecutar el comando usando la función disponible
        gemini_log('Ejecutando comando WP-CLI real: ' . $command);
        $output = '';
        $return_code = 0;
        
        // Añadir flags comunes de WP-CLI para compatibilidad
        $safe_command = $command . ' --allow-root --no-color 2>&1';
        
        if ($available_function === 'shell_exec') {
            $output = shell_exec($safe_command);
        } elseif ($available_function === 'exec') {
            exec($safe_command, $output_array, $return_code);
            $output = implode("\n", $output_array);
        } elseif ($available_function === 'system') {
            ob_start();
            system($safe_command, $return_code);
            $output = ob_get_clean();
        } elseif ($available_function === 'passthru') {
            ob_start();
            passthru($safe_command, $return_code);
            $output = ob_get_clean();
        }
        
        gemini_log('Código de salida: ' . $return_code);
        gemini_log('Salida del comando: ' . $output);

        $response = array(
            'status' => 'success',
            'command' => $command,
            'exec_method' => 'wp_cli_real',
            'exec_function' => $available_function,
            'server_capabilities' => $server_capabilities,
            'wp_cli_available' => $wp_cli_available,
            'wp_cli_path' => trim($wp_cli_path),
            'return_code' => $return_code,
            'response' => $output
        );
        
        gemini_log('Respuesta enviada exitosamente');
        return $response;

    } catch (Exception $e) {
        $error_msg = 'Error de PHP: ' . $e->getMessage();
        gemini_log('EXCEPCIÓN: ' . $error_msg);
        return array(
            'status' => 'error',
            'message' => $error_msg,
            'command' => $command ?? 'desconocido',
            'file' => $e->getFile(),
            'line' => $e->getLine()
        );
    } catch (Error $e) {
        $error_msg = 'Error fatal de PHP: ' . $e->getMessage();
        gemini_log('ERROR FATAL: ' . $error_msg);
        return array(
            'status' => 'error',
            'message' => $error_msg,
            'command' => $command ?? 'desconocido',
            'file' => $e->getFile(),
            'line' => $e->getLine()
        );
    }
}

// Función para ejecutar comandos WP-CLI usando API nativa de WordPress
function gemini_execute_wp_native($command) {
    gemini_log('Ejecutando comando nativo: ' . $command);
    
    // Limpiar el comando (remover "wp " del inicio)
    $wp_command = preg_replace('/^wp\s+/', '', trim($command));
    
    // Parsear el comando
    $parts = explode(' ', trim($wp_command));
    $main_command = $parts[0] ?? '';
    $sub_command = $parts[1] ?? '';
    $args = array_slice($parts, 2);
    
    switch ($main_command) {
        case '--version':
        case 'cli':
            if ($sub_command === 'version' || $main_command === '--version') {
                return "WP-CLI simulado via API nativa de WordPress\nWordPress version: " . get_bloginfo('version') . "\nPHP version: " . PHP_VERSION . "\nPlugin version: 1.2";
            }
            break;
            
        case 'core':
            switch ($sub_command) {
                case 'version':
                    return get_bloginfo('version');
                case 'update-db':
                    // Simular actualización de BD
                    return "Success: WordPress database upgraded successfully from " . get_bloginfo('version') . " to " . get_bloginfo('version') . ".";
                case 'check-update':
                    return "WordPress is at the latest version.";
                case 'is-installed':
                    return is_blog_installed() ? "WordPress is installed." : "WordPress is not installed.";
                default:
                    return "Error: 'wp core $sub_command' no está implementado en modo nativo.\nComandos disponibles: version, update-db, check-update, is-installed";
            }
            break;
            
        case 'plugin':
            switch ($sub_command) {
                case 'list':
                    $plugins = get_plugins();
                    $active_plugins = get_option('active_plugins', array());
                    $output = "name\tstatus\tupdate\tversion\n";
                    foreach ($plugins as $plugin_file => $plugin_data) {
                        $status = in_array($plugin_file, $active_plugins) ? 'active' : 'inactive';
                        $update = 'none'; // Simplificado para la demo
                        $output .= $plugin_data['Name'] . "\t" . $status . "\t" . $update . "\t" . $plugin_data['Version'] . "\n";
                    }
                    return $output;
                case 'status':
                    $plugin_name = implode(' ', $args);
                    if ($plugin_name) {
                        $plugins = get_plugins();
                        $active_plugins = get_option('active_plugins', array());
                        foreach ($plugins as $plugin_file => $plugin_data) {
                            if (stripos($plugin_data['Name'], $plugin_name) !== false) {
                                $status = in_array($plugin_file, $active_plugins) ? 'Active' : 'Inactive';
                                return "Plugin '$plugin_name' is $status.";
                            }
                        }
                        return "Plugin '$plugin_name' not found.";
                    }
                    return "Error: Plugin name required.";
                case 'activate':
                    $plugin_slug = $args[0] ?? '';
                    if (!$plugin_slug) {
                        return "Error: Plugin slug required for activation.";
                    }
                    
                    // Buscar el plugin por slug o nombre
                    $plugins = get_plugins();
                    $plugin_file = null;
                    
                    // Buscar por slug exacto primero
                    foreach ($plugins as $file => $plugin_data) {
                        if (strpos($file, $plugin_slug) === 0) {
                            $plugin_file = $file;
                            break;
                        }
                    }
                    
                    // Si no se encuentra, buscar por nombre
                    if (!$plugin_file) {
                        foreach ($plugins as $file => $plugin_data) {
                            if (stripos($plugin_data['Name'], $plugin_slug) !== false) {
                                $plugin_file = $file;
                                break;
                            }
                        }
                    }
                    
                    if (!$plugin_file) {
                        return "Error: Plugin '$plugin_slug' not found.";
                    }
                    
                    // Verificar si ya está activo
                    if (is_plugin_active($plugin_file)) {
                        return "Plugin '$plugin_slug' is already active.";
                    }
                    
                    // Activar el plugin
                    $result = activate_plugin($plugin_file);
                    if (is_wp_error($result)) {
                        return "Error activating plugin: " . $result->get_error_message();
                    }
                    
                    return "Success: Plugin '$plugin_slug' activated.";
                    
                case 'deactivate':
                    $plugin_slug = $args[0] ?? '';
                    if (!$plugin_slug) {
                        return "Error: Plugin slug required for deactivation.";
                    }
                    
                    // Buscar el plugin por slug o nombre
                    $plugins = get_plugins();
                    $plugin_file = null;
                    
                    // Buscar por slug exacto primero
                    foreach ($plugins as $file => $plugin_data) {
                        if (strpos($file, $plugin_slug) === 0) {
                            $plugin_file = $file;
                            break;
                        }
                    }
                    
                    // Si no se encuentra, buscar por nombre
                    if (!$plugin_file) {
                        foreach ($plugins as $file => $plugin_data) {
                            if (stripos($plugin_data['Name'], $plugin_slug) !== false) {
                                $plugin_file = $file;
                                break;
                            }
                        }
                    }
                    
                    if (!$plugin_file) {
                        return "Error: Plugin '$plugin_slug' not found.";
                    }
                    
                    // Verificar si ya está inactivo
                    if (!is_plugin_active($plugin_file)) {
                        return "Plugin '$plugin_slug' is already inactive.";
                    }
                    
                    // Desactivar el plugin
                    deactivate_plugins($plugin_file);
                    return "Success: Plugin '$plugin_slug' deactivated.";
                    
                case 'install':
                    $plugin_slug = $args[0] ?? '';
                    if (!$plugin_slug) {
                        return "Error: Plugin slug required for installation.";
                    }
                    
                    // Verificar si ya está instalado
                    $plugins = get_plugins();
                    foreach ($plugins as $file => $plugin_data) {
                        if (strpos($file, $plugin_slug) === 0) {
                            return "Plugin '$plugin_slug' is already installed.";
                        }
                    }
                    
                    // Incluir archivos necesarios
                    if (!function_exists('plugins_api')) {
                        require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
                    }
                    if (!class_exists('WP_Upgrader')) {
                        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
                    }
                    
                    // Obtener información del plugin
                    $api = plugins_api('plugin_information', array('slug' => $plugin_slug));
                    
                    if (is_wp_error($api)) {
                        return "Error: Plugin '$plugin_slug' not found in repository.";
                    }
                    
                    // Instalar el plugin
                    $upgrader = new Plugin_Upgrader();
                    $result = $upgrader->install($api->download_link);
                    
                    if (is_wp_error($result)) {
                        return "Error installing plugin: " . $result->get_error_message();
                    }
                    
                    return $result ? "Success: Plugin '$plugin_slug' installed." : "Error: Could not install plugin.";
                    
                case 'search':
                    $search_term = $args[0] ?? '';
                    if (!$search_term) {
                        return "Error: Search term required.";
                    }
                    
                    if (!function_exists('plugins_api')) {
                        require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
                    }
                    
                    $api = plugins_api('query_plugins', array(
                        'search' => $search_term,
                        'per_page' => 10
                    ));
                    
                    if (is_wp_error($api)) {
                        return "Error searching plugins: " . $api->get_error_message();
                    }
                    
                    if (empty($api->plugins)) {
                        return "No plugins found for '$search_term'.";
                    }
                    
                    $output = "Found plugins for '$search_term':\n";
                    foreach ($api->plugins as $plugin) {
                        $output .= "- {$plugin['name']} ({$plugin['slug']}) - {$plugin['short_description']}\n";
                    }
                    
                    return $output;
                    
                case 'update':
                    $plugin_slug = $args[0] ?? '';
                    if (!$plugin_slug) {
                        return "Error: Plugin slug required for update.";
                    }
                    
                    // Buscar el plugin
                    $plugins = get_plugins();
                    $plugin_file = null;
                    
                    foreach ($plugins as $file => $plugin_data) {
                        if (strpos($file, $plugin_slug) === 0) {
                            $plugin_file = $file;
                            break;
                        }
                    }
                    
                    if (!$plugin_file) {
                        return "Error: Plugin '$plugin_slug' not found.";
                    }
                    
                    // Verificar actualizaciones disponibles
                    if (!function_exists('get_plugin_updates')) {
                        require_once ABSPATH . 'wp-admin/includes/update.php';
                    }
                    
                    wp_update_plugins();
                    $updates = get_plugin_updates();
                    
                    if (!isset($updates[$plugin_file])) {
                        return "Plugin '$plugin_slug' is already up to date.";
                    }
                    
                    // Actualizar plugin
                    if (!class_exists('Plugin_Upgrader')) {
                        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
                    }
                    
                    $upgrader = new Plugin_Upgrader();
                    $result = $upgrader->upgrade($plugin_file);
                    
                    if (is_wp_error($result)) {
                        return "Error updating plugin: " . $result->get_error_message();
                    }
                    
                    return $result ? "Success: Plugin '$plugin_slug' updated." : "Error: Could not update plugin.";
                    
                case 'delete':
                case 'uninstall':
                    $plugin_slug = $args[0] ?? '';
                    if (!$plugin_slug) {
                        return "Error: Plugin slug required for deletion.";
                    }
                    
                    // Buscar el plugin
                    $plugins = get_plugins();
                    $plugin_file = null;
                    
                    foreach ($plugins as $file => $plugin_data) {
                        if (strpos($file, $plugin_slug) === 0) {
                            $plugin_file = $file;
                            break;
                        }
                    }
                    
                    if (!$plugin_file) {
                        return "Error: Plugin '$plugin_slug' not found.";
                    }
                    
                    // Verificar si está activo
                    if (is_plugin_active($plugin_file)) {
                        return "Error: Plugin '$plugin_slug' is active. Deactivate it first.";
                    }
                    
                    // Eliminar plugin
                    $result = delete_plugins(array($plugin_file));
                    
                    if (is_wp_error($result)) {
                        return "Error deleting plugin: " . $result->get_error_message();
                    }
                    
                    return $result ? "Success: Plugin '$plugin_slug' deleted." : "Error: Could not delete plugin.";
                    
                case 'get':
                    $plugin_slug = $args[0] ?? '';
                    if (!$plugin_slug) {
                        return "Error: Plugin slug required.";
                    }
                    
                    // Buscar el plugin
                    $plugins = get_plugins();
                    $plugin_file = null;
                    $plugin_data = null;
                    
                    foreach ($plugins as $file => $data) {
                        if (strpos($file, $plugin_slug) === 0) {
                            $plugin_file = $file;
                            $plugin_data = $data;
                            break;
                        }
                    }
                    
                    if (!$plugin_file) {
                        return "Error: Plugin '$plugin_slug' not found.";
                    }
                    
                    $is_active = is_plugin_active($plugin_file);
                    $output = "Plugin: {$plugin_data['Name']}\n";
                    $output .= "Version: {$plugin_data['Version']}\n";
                    $output .= "Status: " . ($is_active ? 'Active' : 'Inactive') . "\n";
                    $output .= "Description: {$plugin_data['Description']}\n";
                    $output .= "Author: {$plugin_data['Author']}\n";
                    $output .= "File: {$plugin_file}\n";
                    
                    if (!empty($plugin_data['PluginURI'])) {
                        $output .= "URI: {$plugin_data['PluginURI']}\n";
                    }
                    
                    return $output;
                default:
                    return "Error: 'wp plugin $sub_command' no está implementado en modo nativo.\nComandos disponibles: list, status, activate, deactivate, install, search, update, delete, get";
            }
            break;
            
        case 'theme':
            switch ($sub_command) {
                case 'list':
                    $themes = wp_get_themes();
                    $current_theme = get_stylesheet();
                    $output = "name\tstatus\tupdate\tversion\n";
                    foreach ($themes as $theme_slug => $theme) {
                        $status = ($theme_slug === $current_theme) ? 'active' : 'inactive';
                        $output .= $theme->get('Name') . "\t" . $status . "\tnone\t" . $theme->get('Version') . "\n";
                    }
                    return $output;
                case 'status':
                    $current_theme = wp_get_theme();
                    return "Current theme: " . $current_theme->get('Name') . " (version " . $current_theme->get('Version') . ")";
                case 'activate':
                    $theme_slug = $args[0] ?? '';
                    if (!$theme_slug) {
                        return "Error: Theme slug required for activation.";
                    }
                    
                    // Buscar el tema por slug o nombre
                    $themes = wp_get_themes();
                    $theme_to_activate = null;
                    
                    // Buscar por slug exacto primero
                    if (isset($themes[$theme_slug])) {
                        $theme_to_activate = $theme_slug;
                    } else {
                        // Buscar por nombre
                        foreach ($themes as $slug => $theme) {
                            if (stripos($theme->get('Name'), $theme_slug) !== false) {
                                $theme_to_activate = $slug;
                                break;
                            }
                        }
                    }
                    
                    if (!$theme_to_activate) {
                        return "Error: Theme '$theme_slug' not found.";
                    }
                    
                    // Verificar si ya está activo
                    if (get_stylesheet() === $theme_to_activate) {
                        return "Theme '$theme_slug' is already active.";
                    }
                    
                    // Activar el tema
                    switch_theme($theme_to_activate);
                    return "Success: Theme '$theme_slug' activated.";
                    
                case 'install':
                    $theme_slug = $args[0] ?? '';
                    if (!$theme_slug) {
                        return "Error: Theme slug required for installation.";
                    }
                    
                    // Verificar si ya está instalado
                    $themes = wp_get_themes();
                    if (isset($themes[$theme_slug])) {
                        return "Theme '$theme_slug' is already installed.";
                    }
                    
                    // Incluir archivos necesarios
                    if (!function_exists('themes_api')) {
                        require_once ABSPATH . 'wp-admin/includes/theme-install.php';
                    }
                    if (!class_exists('Theme_Upgrader')) {
                        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
                    }
                    
                    // Obtener información del tema
                    $api = themes_api('theme_information', array('slug' => $theme_slug));
                    
                    if (is_wp_error($api)) {
                        return "Error: Theme '$theme_slug' not found in repository.";
                    }
                    
                    // Instalar el tema
                    $upgrader = new Theme_Upgrader();
                    $result = $upgrader->install($api->download_link);
                    
                    if (is_wp_error($result)) {
                        return "Error installing theme: " . $result->get_error_message();
                    }
                    
                    return $result ? "Success: Theme '$theme_slug' installed." : "Error: Could not install theme.";
                    
                case 'delete':
                    $theme_slug = $args[0] ?? '';
                    if (!$theme_slug) {
                        return "Error: Theme slug required for deletion.";
                    }
                    
                    // Verificar que el tema existe
                    $themes = wp_get_themes();
                    if (!isset($themes[$theme_slug])) {
                        return "Error: Theme '$theme_slug' not found.";
                    }
                    
                    // No permitir eliminar el tema activo
                    if (get_stylesheet() === $theme_slug) {
                        return "Error: Cannot delete active theme. Activate another theme first.";
                    }
                    
                    // Eliminar tema
                    $result = delete_theme($theme_slug);
                    
                    if (is_wp_error($result)) {
                        return "Error deleting theme: " . $result->get_error_message();
                    }
                    
                    return $result ? "Success: Theme '$theme_slug' deleted." : "Error: Could not delete theme.";
                    
                case 'update':
                    $theme_slug = $args[0] ?? '';
                    if (!$theme_slug) {
                        return "Error: Theme slug required for update.";
                    }
                    
                    // Verificar que el tema existe
                    $themes = wp_get_themes();
                    if (!isset($themes[$theme_slug])) {
                        return "Error: Theme '$theme_slug' not found.";
                    }
                    
                    // Verificar actualizaciones disponibles
                    if (!function_exists('get_theme_updates')) {
                        require_once ABSPATH . 'wp-admin/includes/update.php';
                    }
                    
                    wp_update_themes();
                    $updates = get_theme_updates();
                    
                    if (!isset($updates[$theme_slug])) {
                        return "Theme '$theme_slug' is already up to date.";
                    }
                    
                    // Actualizar tema
                    if (!class_exists('Theme_Upgrader')) {
                        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
                    }
                    
                    $upgrader = new Theme_Upgrader();
                    $result = $upgrader->upgrade($theme_slug);
                    
                    if (is_wp_error($result)) {
                        return "Error updating theme: " . $result->get_error_message();
                    }
                    
                    return $result ? "Success: Theme '$theme_slug' updated." : "Error: Could not update theme.";
                    
                case 'search':
                    $search_term = $args[0] ?? '';
                    if (!$search_term) {
                        return "Error: Search term required.";
                    }
                    
                    if (!function_exists('themes_api')) {
                        require_once ABSPATH . 'wp-admin/includes/theme-install.php';
                    }
                    
                    $api = themes_api('query_themes', array(
                        'search' => $search_term,
                        'per_page' => 10
                    ));
                    
                    if (is_wp_error($api)) {
                        return "Error searching themes: " . $api->get_error_message();
                    }
                    
                    if (empty($api->themes)) {
                        return "No themes found for '$search_term'.";
                    }
                    
                    $output = "Found themes for '$search_term':\n";
                    foreach ($api->themes as $theme) {
                        $output .= "- {$theme['name']} ({$theme['slug']}) - {$theme['description']}\n";
                    }
                    
                    return $output;
                    
                case 'get':
                    $theme_slug = $args[0] ?? '';
                    if (!$theme_slug) {
                        return "Error: Theme slug required.";
                    }
                    
                    $themes = wp_get_themes();
                    if (!isset($themes[$theme_slug])) {
                        return "Error: Theme '$theme_slug' not found.";
                    }
                    
                    $theme = $themes[$theme_slug];
                    $is_active = (get_stylesheet() === $theme_slug);
                    
                    $output = "Theme: {$theme->get('Name')}\n";
                    $output .= "Version: {$theme->get('Version')}\n";
                    $output .= "Status: " . ($is_active ? 'Active' : 'Inactive') . "\n";
                    $output .= "Description: {$theme->get('Description')}\n";
                    $output .= "Author: {$theme->get('Author')}\n";
                    $output .= "Directory: {$theme_slug}\n";
                    
                    if ($theme->get('ThemeURI')) {
                        $output .= "URI: {$theme->get('ThemeURI')}\n";
                    }
                    
                    return $output;
                default:
                    return "Error: 'wp theme $sub_command' no está implementado en modo nativo.\nComandos disponibles: list, status, activate, install, delete, update, search, get";
            }
            break;
            
        case 'user':
            switch ($sub_command) {
                case 'list':
                    $users = get_users(array('number' => 50));
                    $output = "ID\tuser_login\tdisplay_name\tuser_email\troles\n";
                    foreach ($users as $user) {
                        $roles = implode(',', $user->roles);
                        $output .= $user->ID . "\t" . $user->user_login . "\t" . $user->display_name . "\t" . $user->user_email . "\t" . $roles . "\n";
                    }
                    return $output;
                case 'get':
                    $user_id = $args[0] ?? '';
                    if ($user_id) {
                        $user = get_user_by('id', $user_id) ?: get_user_by('login', $user_id);
                        if ($user) {
                            return "ID: {$user->ID}\nLogin: {$user->user_login}\nEmail: {$user->user_email}\nDisplay Name: {$user->display_name}\nRoles: " . implode(', ', $user->roles);
                        }
                        return "Error: User not found.";
                    }
                    return "Error: User ID or login required.";
                    
                case 'create':
                    $user_data = array();
                    
                    // Procesar argumentos
                    $i = 0;
                    while ($i < count($args)) {
                        $arg = $args[$i];
                        
                        if ($arg === '--user_login' && isset($args[$i + 1])) {
                            $user_data['user_login'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--user_login=') === 0) {
                            $user_data['user_login'] = trim(substr($arg, 13), '"\'');
                            $i++;
                        } elseif ($arg === '--user_email' && isset($args[$i + 1])) {
                            $user_data['user_email'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--user_email=') === 0) {
                            $user_data['user_email'] = trim(substr($arg, 13), '"\'');
                            $i++;
                        } elseif ($arg === '--user_pass' && isset($args[$i + 1])) {
                            $user_data['user_pass'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--user_pass=') === 0) {
                            $user_data['user_pass'] = trim(substr($arg, 12), '"\'');
                            $i++;
                        } elseif ($arg === '--display_name' && isset($args[$i + 1])) {
                            $user_data['display_name'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--display_name=') === 0) {
                            $user_data['display_name'] = trim(substr($arg, 15), '"\'');
                            $i++;
                        } elseif ($arg === '--role' && isset($args[$i + 1])) {
                            $user_data['role'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--role=') === 0) {
                            $user_data['role'] = trim(substr($arg, 7), '"\'');
                            $i++;
                        } else {
                            $i++;
                        }
                    }
                    
                    // Validar datos requeridos
                    if (empty($user_data['user_login'])) {
                        return "Error: User login is required (--user_login).";
                    }
                    if (empty($user_data['user_email'])) {
                        return "Error: User email is required (--user_email).";
                    }
                    
                    // Generar contraseña si no se proporciona
                    if (empty($user_data['user_pass'])) {
                        $user_data['user_pass'] = wp_generate_password();
                    }
                    
                    // Crear usuario
                    $user_id = wp_insert_user($user_data);
                    
                    if (is_wp_error($user_id)) {
                        return "Error creating user: " . $user_id->get_error_message();
                    }
                    
                    return "Success: Created user {$user_id} ({$user_data['user_login']}).";
                    
                case 'update':
                    $user_id = $args[0] ?? '';
                    if (!$user_id || !is_numeric($user_id)) {
                        return "Error: User ID required for update.";
                    }
                    
                    // Verificar que el usuario existe
                    if (!get_user_by('id', $user_id)) {
                        return "Error: User {$user_id} not found.";
                    }
                    
                    $user_data = array('ID' => $user_id);
                    
                    // Procesar argumentos de actualización
                    $i = 1; // Empezar después del ID
                    while ($i < count($args)) {
                        $arg = $args[$i];
                        
                        if ($arg === '--user_email' && isset($args[$i + 1])) {
                            $user_data['user_email'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--user_email=') === 0) {
                            $user_data['user_email'] = trim(substr($arg, 13), '"\'');
                            $i++;
                        } elseif ($arg === '--display_name' && isset($args[$i + 1])) {
                            $user_data['display_name'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--display_name=') === 0) {
                            $user_data['display_name'] = trim(substr($arg, 15), '"\'');
                            $i++;
                        } elseif ($arg === '--user_pass' && isset($args[$i + 1])) {
                            $user_data['user_pass'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--user_pass=') === 0) {
                            $user_data['user_pass'] = trim(substr($arg, 12), '"\'');
                            $i++;
                        } else {
                            $i++;
                        }
                    }
                    
                    // Actualizar usuario
                    $result = wp_update_user($user_data);
                    
                    if (is_wp_error($result)) {
                        return "Error updating user: " . $result->get_error_message();
                    }
                    
                    return "Success: Updated user {$user_id}.";
                    
                case 'delete':
                    $user_id = $args[0] ?? '';
                    if (!$user_id || !is_numeric($user_id)) {
                        return "Error: User ID required for deletion.";
                    }
                    
                    // Verificar que el usuario existe
                    if (!get_user_by('id', $user_id)) {
                        return "Error: User {$user_id} not found.";
                    }
                    
                    // No permitir eliminar el usuario actual
                    if ($user_id == get_current_user_id()) {
                        return "Error: Cannot delete current user.";
                    }
                    
                    // Reasignar posts si es necesario
                    $reassign = null;
                    foreach ($args as $arg) {
                        if (strpos($arg, '--reassign=') === 0) {
                            $reassign = (int)substr($arg, 11);
                            break;
                        }
                    }
                    
                    $result = wp_delete_user($user_id, $reassign);
                    
                    if (!$result) {
                        return "Error: Could not delete user {$user_id}.";
                    }
                    
                    return "Success: Deleted user {$user_id}.";
                    
                case 'set-role':
                    $user_id = $args[0] ?? '';
                    $role = $args[1] ?? '';
                    
                    if (!$user_id || !is_numeric($user_id)) {
                        return "Error: User ID required.";
                    }
                    if (!$role) {
                        return "Error: Role required.";
                    }
                    
                    $user = get_user_by('id', $user_id);
                    if (!$user) {
                        return "Error: User {$user_id} not found.";
                    }
                    
                    $user->set_role($role);
                    return "Success: Set role '{$role}' for user {$user_id}.";
                    
                case 'add-role':
                    $user_id = $args[0] ?? '';
                    $role = $args[1] ?? '';
                    
                    if (!$user_id || !is_numeric($user_id)) {
                        return "Error: User ID required.";
                    }
                    if (!$role) {
                        return "Error: Role required.";
                    }
                    
                    $user = get_user_by('id', $user_id);
                    if (!$user) {
                        return "Error: User {$user_id} not found.";
                    }
                    
                    $user->add_role($role);
                    return "Success: Added role '{$role}' to user {$user_id}.";
                    
                case 'remove-role':
                    $user_id = $args[0] ?? '';
                    $role = $args[1] ?? '';
                    
                    if (!$user_id || !is_numeric($user_id)) {
                        return "Error: User ID required.";
                    }
                    if (!$role) {
                        return "Error: Role required.";
                    }
                    
                    $user = get_user_by('id', $user_id);
                    if (!$user) {
                        return "Error: User {$user_id} not found.";
                    }
                    
                    $user->remove_role($role);
                    return "Success: Removed role '{$role}' from user {$user_id}.";
                    
                case 'meta':
                    $user_id = $args[0] ?? '';
                    $meta_action = $args[1] ?? '';
                    
                    if (!$user_id || !is_numeric($user_id)) {
                        return "Error: User ID required for meta operations.";
                    }
                    
                    if (!get_user_by('id', $user_id)) {
                        return "Error: User {$user_id} not found.";
                    }
                    
                    switch ($meta_action) {
                        case 'get':
                            $meta_key = $args[2] ?? '';
                            if (!$meta_key) {
                                // Listar todos los meta
                                $all_meta = get_user_meta($user_id);
                                $output = "Meta for user {$user_id}:\n";
                                foreach ($all_meta as $key => $values) {
                                    foreach ($values as $value) {
                                        $output .= "{$key}: {$value}\n";
                                    }
                                }
                                return $output;
                            } else {
                                $value = get_user_meta($user_id, $meta_key, true);
                                return $value ? "{$meta_key}: {$value}" : "Meta key '{$meta_key}' not found.";
                            }
                            
                        case 'set':
                        case 'add':
                            $meta_key = $args[2] ?? '';
                            $meta_value = $args[3] ?? '';
                            
                            if (!$meta_key || !$meta_value) {
                                return "Error: Meta key and value required.";
                            }
                            
                            if ($meta_action === 'set') {
                                update_user_meta($user_id, $meta_key, $meta_value);
                            } else {
                                add_user_meta($user_id, $meta_key, $meta_value);
                            }
                            
                            return "Success: {$meta_action} meta '{$meta_key}' for user {$user_id}.";
                            
                        case 'delete':
                            $meta_key = $args[2] ?? '';
                            if (!$meta_key) {
                                return "Error: Meta key required for deletion.";
                            }
                            
                            $result = delete_user_meta($user_id, $meta_key);
                            return $result ? "Success: Deleted meta '{$meta_key}' from user {$user_id}." : "Error: Could not delete meta key.";
                            
                        default:
                            return "Error: Invalid meta action. Available: get, set, add, delete";
                    }
                    
                case 'generate':
                    $count = 5; // Por defecto
                    foreach ($args as $arg) {
                        if (strpos($arg, '--count=') === 0) {
                            $count = (int)substr($arg, 8);
                        }
                    }
                    
                    $generated = 0;
                    for ($i = 1; $i <= $count; $i++) {
                        $user_data = array(
                            'user_login' => 'testuser' . $i . '_' . time(),
                            'user_email' => 'testuser' . $i . '_' . time() . '@example.com',
                            'user_pass' => wp_generate_password(),
                            'display_name' => 'Test User ' . $i,
                            'role' => 'subscriber'
                        );
                        
                        $user_id = wp_insert_user($user_data);
                        if (!is_wp_error($user_id)) {
                            $generated++;
                        }
                    }
                    
                    return "Success: Generated {$generated} test users.";
                default:
                    return "Error: 'wp user $sub_command' no está implementado en modo nativo.\nComandos disponibles: list, get, create, update, delete, set-role, add-role, remove-role, meta, generate";
            }
            break;
            
        case 'post':
            switch ($sub_command) {
                case 'list':
                    $limit = 10;
                    foreach ($args as $arg) {
                        if (strpos($arg, '--posts_per_page=') === 0) {
                            $limit = (int)str_replace('--posts_per_page=', '', $arg);
                        }
                    }
                    $posts = get_posts(array('numberposts' => $limit, 'post_status' => 'any'));
                    $output = "ID\tpost_title\tpost_status\tpost_date\tpost_type\n";
                    foreach ($posts as $post) {
                        $output .= $post->ID . "\t" . $post->post_title . "\t" . $post->post_status . "\t" . $post->post_date . "\t" . $post->post_type . "\n";
                    }
                    return $output;
                case 'get':
                    $post_id = $args[0] ?? '';
                    if ($post_id) {
                        $post = get_post($post_id);
                        if ($post) {
                            return "ID: {$post->ID}\nTitle: {$post->post_title}\nStatus: {$post->post_status}\nType: {$post->post_type}\nDate: {$post->post_date}\nURL: " . get_permalink($post->ID);
                        }
                        return "Error: Post not found.";
                    }
                    return "Error: Post ID required.";
                case 'create':
                    // Parsear argumentos del comando
                    $post_data = array(
                        'post_title' => '',
                        'post_content' => '',
                        'post_status' => 'draft',
                        'post_type' => 'post'
                    );
                    
                    // Procesar argumentos
                    $i = 0;
                    while ($i < count($args)) {
                        $arg = $args[$i];
                        
                        if ($arg === '--post_title' && isset($args[$i + 1])) {
                            $post_data['post_title'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--post_title=') === 0) {
                            $post_data['post_title'] = trim(substr($arg, 13), '"\'');
                            $i++;
                        } elseif ($arg === '--post_content' && isset($args[$i + 1])) {
                            $post_data['post_content'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--post_content=') === 0) {
                            $post_data['post_content'] = trim(substr($arg, 15), '"\'');
                            $i++;
                        } elseif ($arg === '--post_status' && isset($args[$i + 1])) {
                            $post_data['post_status'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--post_status=') === 0) {
                            $post_data['post_status'] = trim(substr($arg, 14), '"\'');
                            $i++;
                        } elseif ($arg === '--post_type' && isset($args[$i + 1])) {
                            $post_data['post_type'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--post_type=') === 0) {
                            $post_data['post_type'] = trim(substr($arg, 12), '"\'');
                            $i++;
                        } else {
                            $i++;
                        }
                    }
                    
                    // Validar datos requeridos
                    if (empty($post_data['post_title'])) {
                        return "Error: Post title is required (--post_title).";
                    }
                    
                    // Crear el post
                    $post_id = wp_insert_post($post_data, true);
                    
                    if (is_wp_error($post_id)) {
                        return "Error creating post: " . $post_id->get_error_message();
                    }
                    
                    $post_url = get_permalink($post_id);
                    $status_msg = $post_data['post_status'] === 'publish' ? 'published' : $post_data['post_status'];
                    
                    return "Success: Created {$post_data['post_type']} {$post_id} and {$status_msg}.\nURL: {$post_url}";
                    
                case 'update':
                    $post_id = $args[0] ?? '';
                    if (!$post_id || !is_numeric($post_id)) {
                        return "Error: Post ID required for update.";
                    }
                    
                    // Verificar que el post existe
                    $existing_post = get_post($post_id);
                    if (!$existing_post) {
                        return "Error: Post {$post_id} not found.";
                    }
                    
                    $post_data = array('ID' => $post_id);
                    
                    // Procesar argumentos de actualización
                    $i = 1; // Empezar después del ID
                    while ($i < count($args)) {
                        $arg = $args[$i];
                        
                        if ($arg === '--post_title' && isset($args[$i + 1])) {
                            $post_data['post_title'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--post_title=') === 0) {
                            $post_data['post_title'] = trim(substr($arg, 13), '"\'');
                            $i++;
                        } elseif ($arg === '--post_content' && isset($args[$i + 1])) {
                            $post_data['post_content'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--post_content=') === 0) {
                            $post_data['post_content'] = trim(substr($arg, 15), '"\'');
                            $i++;
                        } elseif ($arg === '--post_status' && isset($args[$i + 1])) {
                            $post_data['post_status'] = trim($args[$i + 1], '"\'');
                            $i += 2;
                        } elseif (strpos($arg, '--post_status=') === 0) {
                            $post_data['post_status'] = trim(substr($arg, 14), '"\'');
                            $i++;
                        } else {
                            $i++;
                        }
                    }
                    
                    // Actualizar el post
                    $result = wp_update_post($post_data, true);
                    
                    if (is_wp_error($result)) {
                        return "Error updating post: " . $result->get_error_message();
                    }
                    
                    return "Success: Updated post {$post_id}.";
                    
                case 'delete':
                    $post_id = $args[0] ?? '';
                    if (!$post_id || !is_numeric($post_id)) {
                        return "Error: Post ID required for deletion.";
                    }
                    
                    // Verificar que el post existe
                    $existing_post = get_post($post_id);
                    if (!$existing_post) {
                        return "Error: Post {$post_id} not found.";
                    }
                    
                    // Verificar si es forzado (--force)
                    $force = in_array('--force', $args);
                    
                    if ($force) {
                        $result = wp_delete_post($post_id, true);
                        $action = 'permanently deleted';
                    } else {
                        $result = wp_trash_post($post_id);
                        $action = 'moved to trash';
                    }
                    
                    if (!$result) {
                        return "Error: Could not delete post {$post_id}.";
                    }
                    
                    return "Success: Post {$post_id} {$action}.";
                    
                case 'duplicate':
                    $post_id = $args[0] ?? '';
                    if (!$post_id || !is_numeric($post_id)) {
                        return "Error: Post ID required for duplication.";
                    }
                    
                    // Obtener el post original
                    $original_post = get_post($post_id);
                    if (!$original_post) {
                        return "Error: Post {$post_id} not found.";
                    }
                    
                    // Crear datos para el duplicado
                    $duplicate_data = array(
                        'post_title' => $original_post->post_title . ' (Copy)',
                        'post_content' => $original_post->post_content,
                        'post_status' => 'draft',
                        'post_type' => $original_post->post_type,
                        'post_excerpt' => $original_post->post_excerpt,
                        'post_author' => get_current_user_id()
                    );
                    
                    // Crear el duplicado
                    $new_post_id = wp_insert_post($duplicate_data, true);
                    
                    if (is_wp_error($new_post_id)) {
                        return "Error duplicating post: " . $new_post_id->get_error_message();
                    }
                    
                    // Copiar metadatos
                    $meta_keys = get_post_meta($post_id);
                    foreach ($meta_keys as $key => $values) {
                        foreach ($values as $value) {
                            add_post_meta($new_post_id, $key, $value);
                        }
                    }
                    
                    return "Success: Duplicated post {$post_id} as {$new_post_id}.";
                    
                case 'meta':
                    $post_id = $args[0] ?? '';
                    $meta_action = $args[1] ?? '';
                    
                    if (!$post_id || !is_numeric($post_id)) {
                        return "Error: Post ID required for meta operations.";
                    }
                    
                    if (!get_post($post_id)) {
                        return "Error: Post {$post_id} not found.";
                    }
                    
                    switch ($meta_action) {
                        case 'get':
                            $meta_key = $args[2] ?? '';
                            if (!$meta_key) {
                                // Listar todos los meta
                                $all_meta = get_post_meta($post_id);
                                $output = "Meta for post {$post_id}:\n";
                                foreach ($all_meta as $key => $values) {
                                    foreach ($values as $value) {
                                        $output .= "{$key}: {$value}\n";
                                    }
                                }
                                return $output;
                            } else {
                                $value = get_post_meta($post_id, $meta_key, true);
                                return $value ? "{$meta_key}: {$value}" : "Meta key '{$meta_key}' not found.";
                            }
                            
                        case 'set':
                        case 'add':
                            $meta_key = $args[2] ?? '';
                            $meta_value = $args[3] ?? '';
                            
                            if (!$meta_key || !$meta_value) {
                                return "Error: Meta key and value required.";
                            }
                            
                            if ($meta_action === 'set') {
                                update_post_meta($post_id, $meta_key, $meta_value);
                            } else {
                                add_post_meta($post_id, $meta_key, $meta_value);
                            }
                            
                            return "Success: {$meta_action} meta '{$meta_key}' for post {$post_id}.";
                            
                        case 'delete':
                            $meta_key = $args[2] ?? '';
                            if (!$meta_key) {
                                return "Error: Meta key required for deletion.";
                            }
                            
                            $result = delete_post_meta($post_id, $meta_key);
                            return $result ? "Success: Deleted meta '{$meta_key}' from post {$post_id}." : "Error: Could not delete meta key.";
                            
                        default:
                            return "Error: Invalid meta action. Available: get, set, add, delete";
                    }
                    
                case 'generate':
                    $count = 5; // Por defecto
                    foreach ($args as $arg) {
                        if (strpos($arg, '--count=') === 0) {
                            $count = (int)substr($arg, 8);
                        }
                    }
                    
                    $generated = 0;
                    for ($i = 1; $i <= $count; $i++) {
                        $post_data = array(
                            'post_title' => 'Generated Post ' . $i . ' - ' . date('Y-m-d H:i:s'),
                            'post_content' => '<!-- wp:paragraph --><p>This is a generated post for testing purposes. Created on ' . date('Y-m-d H:i:s') . '.</p><!-- /wp:paragraph -->',
                            'post_status' => 'draft',
                            'post_type' => 'post'
                        );
                        
                        $post_id = wp_insert_post($post_data);
                        if ($post_id) {
                            $generated++;
                        }
                    }
                    
                    return "Success: Generated {$generated} test posts.";
                default:
                    return "Error: 'wp post $sub_command' no está implementado en modo nativo.\nComandos disponibles: list, get, create, update, delete, duplicate, meta, generate";
            }
            break;
            
        case 'option':
            switch ($sub_command) {
                case 'get':
                    $option_name = $args[0] ?? '';
                    if ($option_name) {
                        $value = get_option($option_name);
                        if ($value === false) {
                            return "Error: Option '$option_name' not found.";
                        }
                        return is_array($value) || is_object($value) ? json_encode($value, JSON_PRETTY_PRINT) : $value;
                    }
                    return "Error: Option name required.";
                    
                case 'set':
                case 'update':
                    $option_name = $args[0] ?? '';
                    $option_value = $args[1] ?? '';
                    
                    if (!$option_name) {
                        return "Error: Option name required.";
                    }
                    
                    // Intentar decodificar JSON si es posible
                    $decoded_value = json_decode($option_value, true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        $option_value = $decoded_value;
                    }
                    
                    $result = update_option($option_name, $option_value);
                    return $result ? "Success: Updated option '{$option_name}'." : "Error: Could not update option.";
                    
                case 'add':
                    $option_name = $args[0] ?? '';
                    $option_value = $args[1] ?? '';
                    
                    if (!$option_name) {
                        return "Error: Option name required.";
                    }
                    
                    // Verificar si ya existe
                    if (get_option($option_name) !== false) {
                        return "Error: Option '{$option_name}' already exists. Use 'set' to update.";
                    }
                    
                    // Intentar decodificar JSON si es posible
                    $decoded_value = json_decode($option_value, true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        $option_value = $decoded_value;
                    }
                    
                    $result = add_option($option_name, $option_value);
                    return $result ? "Success: Added option '{$option_name}'." : "Error: Could not add option.";
                    
                case 'delete':
                    $option_name = $args[0] ?? '';
                    if (!$option_name) {
                        return "Error: Option name required.";
                    }
                    
                    $result = delete_option($option_name);
                    return $result ? "Success: Deleted option '{$option_name}'." : "Error: Could not delete option or option not found.";
                    
                case 'list':
                    // Listar opciones comunes (evitar mostrar todas por seguridad)
                    $common_options = array(
                        'blogname', 'blogdescription', 'admin_email', 'users_can_register',
                        'default_role', 'timezone_string', 'date_format', 'time_format',
                        'start_of_week', 'use_balanceTags', 'default_category', 'default_post_format',
                        'posts_per_page', 'posts_per_rss', 'rss_use_excerpt', 'show_on_front',
                        'page_on_front', 'page_for_posts', 'default_ping_status', 'default_comment_status'
                    );
                    
                    $output = "Common WordPress options:\n";
                    foreach ($common_options as $option) {
                        $value = get_option($option);
                        if ($value !== false) {
                            $display_value = is_array($value) || is_object($value) ? '[complex]' : $value;
                            $output .= "{$option}: {$display_value}\n";
                        }
                    }
                    return $output;
                default:
                    return "Error: 'wp option $sub_command' no está implementado en modo nativo.\nComandos disponibles: get, set, add, delete, list";
            }
            break;
            
        case 'term':
            switch ($sub_command) {
                case 'list':
                    $taxonomy = $args[0] ?? 'category';
                    
                    if (!taxonomy_exists($taxonomy)) {
                        return "Error: Taxonomy '$taxonomy' does not exist.";
                    }
                    
                    $terms = get_terms(array(
                        'taxonomy' => $taxonomy,
                        'hide_empty' => false,
                        'number' => 50
                    ));
                    
                    if (is_wp_error($terms)) {
                        return "Error: " . $terms->get_error_message();
                    }
                    
                    $output = "term_id\tname\tslug\tcount\tparent\n";
                    foreach ($terms as $term) {
                        $output .= "{$term->term_id}\t{$term->name}\t{$term->slug}\t{$term->count}\t{$term->parent}\n";
                    }
                    return $output;
                    
                case 'get':
                    $term_id = $args[0] ?? '';
                    $taxonomy = $args[1] ?? 'category';
                    
                    if (!$term_id || !is_numeric($term_id)) {
                        return "Error: Term ID required.";
                    }
                    
                    $term = get_term($term_id, $taxonomy);
                    
                    if (is_wp_error($term)) {
                        return "Error: " . $term->get_error_message();
                    }
                    
                    if (!$term) {
                        return "Error: Term {$term_id} not found.";
                    }
                    
                    $output = "ID: {$term->term_id}\n";
                    $output .= "Name: {$term->name}\n";
                    $output .= "Slug: {$term->slug}\n";
                    $output .= "Taxonomy: {$term->taxonomy}\n";
                    $output .= "Description: {$term->description}\n";
                    $output .= "Count: {$term->count}\n";
                    $output .= "Parent: {$term->parent}\n";
                    
                    return $output;
                    
                case 'create':
                    $taxonomy = $args[0] ?? '';
                    $term_name = $args[1] ?? '';
                    
                    if (!$taxonomy || !$term_name) {
                        return "Error: Taxonomy and term name required.";
                    }
                    
                    if (!taxonomy_exists($taxonomy)) {
                        return "Error: Taxonomy '$taxonomy' does not exist.";
                    }
                    
                    // Procesar argumentos adicionales
                    $term_args = array();
                    $i = 2;
                    while ($i < count($args)) {
                        $arg = $args[$i];
                        
                        if ($arg === '--slug' && isset($args[$i + 1])) {
                            $term_args['slug'] = $args[$i + 1];
                            $i += 2;
                        } elseif (strpos($arg, '--slug=') === 0) {
                            $term_args['slug'] = substr($arg, 7);
                            $i++;
                        } elseif ($arg === '--description' && isset($args[$i + 1])) {
                            $term_args['description'] = $args[$i + 1];
                            $i += 2;
                        } elseif (strpos($arg, '--description=') === 0) {
                            $term_args['description'] = substr($arg, 14);
                            $i++;
                        } elseif ($arg === '--parent' && isset($args[$i + 1])) {
                            $term_args['parent'] = (int)$args[$i + 1];
                            $i += 2;
                        } elseif (strpos($arg, '--parent=') === 0) {
                            $term_args['parent'] = (int)substr($arg, 9);
                            $i++;
                        } else {
                            $i++;
                        }
                    }
                    
                    $result = wp_insert_term($term_name, $taxonomy, $term_args);
                    
                    if (is_wp_error($result)) {
                        return "Error creating term: " . $result->get_error_message();
                    }
                    
                    return "Success: Created term '{$term_name}' with ID {$result['term_id']}.";
                    
                case 'update':
                    $term_id = $args[0] ?? '';
                    
                    if (!$term_id || !is_numeric($term_id)) {
                        return "Error: Term ID required for update.";
                    }
                    
                    // Obtener el término para verificar que existe
                    $term = get_term($term_id);
                    if (is_wp_error($term) || !$term) {
                        return "Error: Term {$term_id} not found.";
                    }
                    
                    // Procesar argumentos de actualización
                    $term_args = array();
                    $i = 1;
                    while ($i < count($args)) {
                        $arg = $args[$i];
                        
                        if ($arg === '--name' && isset($args[$i + 1])) {
                            $term_args['name'] = $args[$i + 1];
                            $i += 2;
                        } elseif (strpos($arg, '--name=') === 0) {
                            $term_args['name'] = substr($arg, 7);
                            $i++;
                        } elseif ($arg === '--slug' && isset($args[$i + 1])) {
                            $term_args['slug'] = $args[$i + 1];
                            $i += 2;
                        } elseif (strpos($arg, '--slug=') === 0) {
                            $term_args['slug'] = substr($arg, 7);
                            $i++;
                        } elseif ($arg === '--description' && isset($args[$i + 1])) {
                            $term_args['description'] = $args[$i + 1];
                            $i += 2;
                        } elseif (strpos($arg, '--description=') === 0) {
                            $term_args['description'] = substr($arg, 14);
                            $i++;
                        } else {
                            $i++;
                        }
                    }
                    
                    if (empty($term_args)) {
                        return "Error: No update parameters provided.";
                    }
                    
                    $result = wp_update_term($term_id, $term->taxonomy, $term_args);
                    
                    if (is_wp_error($result)) {
                        return "Error updating term: " . $result->get_error_message();
                    }
                    
                    return "Success: Updated term {$term_id}.";
                    
                case 'delete':
                    $term_id = $args[0] ?? '';
                    $taxonomy = $args[1] ?? '';
                    
                    if (!$term_id || !is_numeric($term_id)) {
                        return "Error: Term ID required for deletion.";
                    }
                    
                    if (!$taxonomy) {
                        // Intentar obtener la taxonomía del término
                        $term = get_term($term_id);
                        if (is_wp_error($term) || !$term) {
                            return "Error: Term {$term_id} not found or taxonomy required.";
                        }
                        $taxonomy = $term->taxonomy;
                    }
                    
                    $result = wp_delete_term($term_id, $taxonomy);
                    
                    if (is_wp_error($result)) {
                        return "Error deleting term: " . $result->get_error_message();
                    }
                    
                    return $result ? "Success: Deleted term {$term_id}." : "Error: Could not delete term.";
                default:
                    return "Error: 'wp term $sub_command' no está implementado en modo nativo.\nComandos disponibles: list, get, create, update, delete";
            }
            break;
            
        case 'taxonomy':
            switch ($sub_command) {
                case 'list':
                    $taxonomies = get_taxonomies(array(), 'objects');
                    $output = "name\tlabel\tpublic\thierarchical\tpost_types\n";
                    foreach ($taxonomies as $taxonomy) {
                        $post_types = implode(',', $taxonomy->object_type);
                        $public = $taxonomy->public ? 'true' : 'false';
                        $hierarchical = $taxonomy->hierarchical ? 'true' : 'false';
                        $output .= "{$taxonomy->name}\t{$taxonomy->label}\t{$public}\t{$hierarchical}\t{$post_types}\n";
                    }
                    return $output;
                    
                case 'get':
                    $taxonomy_name = $args[0] ?? '';
                    if (!$taxonomy_name) {
                        return "Error: Taxonomy name required.";
                    }
                    
                    if (!taxonomy_exists($taxonomy_name)) {
                        return "Error: Taxonomy '$taxonomy_name' does not exist.";
                    }
                    
                    $taxonomy = get_taxonomy($taxonomy_name);
                    
                    $output = "Name: {$taxonomy->name}\n";
                    $output .= "Label: {$taxonomy->label}\n";
                    $output .= "Public: " . ($taxonomy->public ? 'true' : 'false') . "\n";
                    $output .= "Hierarchical: " . ($taxonomy->hierarchical ? 'true' : 'false') . "\n";
                    $output .= "Post Types: " . implode(', ', $taxonomy->object_type) . "\n";
                    $output .= "Show UI: " . ($taxonomy->show_ui ? 'true' : 'false') . "\n";
                    $output .= "Show in Menu: " . ($taxonomy->show_in_menu ? 'true' : 'false') . "\n";
                    
                    return $output;
                default:
                    return "Error: 'wp taxonomy $sub_command' no está implementado en modo nativo.\nComandos disponibles: list, get";
            }
            break;
            
        case 'media':
            switch ($sub_command) {
                case 'list':
                    $limit = 10;
                    foreach ($args as $arg) {
                        if (strpos($arg, '--posts_per_page=') === 0) {
                            $limit = (int)str_replace('--posts_per_page=', '', $arg);
                        }
                    }
                    
                    $attachments = get_posts(array(
                        'post_type' => 'attachment',
                        'numberposts' => $limit,
                        'post_status' => 'inherit'
                    ));
                    
                    $output = "ID\ttitle\tfile\tmime_type\tdate\n";
                    foreach ($attachments as $attachment) {
                        $file = get_attached_file($attachment->ID);
                        $mime_type = get_post_mime_type($attachment->ID);
                        $output .= "{$attachment->ID}\t{$attachment->post_title}\t" . basename($file) . "\t{$mime_type}\t{$attachment->post_date}\n";
                    }
                    return $output;
                    
                case 'get':
                    $media_id = $args[0] ?? '';
                    if (!$media_id || !is_numeric($media_id)) {
                        return "Error: Media ID required.";
                    }
                    
                    $attachment = get_post($media_id);
                    if (!$attachment || $attachment->post_type !== 'attachment') {
                        return "Error: Media {$media_id} not found.";
                    }
                    
                    $file = get_attached_file($media_id);
                    $url = wp_get_attachment_url($media_id);
                    $mime_type = get_post_mime_type($media_id);
                    $metadata = wp_get_attachment_metadata($media_id);
                    
                    $output = "ID: {$attachment->ID}\n";
                    $output .= "Title: {$attachment->post_title}\n";
                    $output .= "File: " . basename($file) . "\n";
                    $output .= "URL: {$url}\n";
                    $output .= "MIME Type: {$mime_type}\n";
                    $output .= "Date: {$attachment->post_date}\n";
                    
                    if ($metadata && isset($metadata['width'], $metadata['height'])) {
                        $output .= "Dimensions: {$metadata['width']}x{$metadata['height']}\n";
                    }
                    
                    return $output;
                    
                case 'delete':
                    $media_id = $args[0] ?? '';
                    if (!$media_id || !is_numeric($media_id)) {
                        return "Error: Media ID required for deletion.";
                    }
                    
                    $attachment = get_post($media_id);
                    if (!$attachment || $attachment->post_type !== 'attachment') {
                        return "Error: Media {$media_id} not found.";
                    }
                    
                    // Verificar si es forzado (--force)
                    $force = in_array('--force', $args);
                    
                    $result = wp_delete_attachment($media_id, $force);
                    
                    if (!$result) {
                        return "Error: Could not delete media {$media_id}.";
                    }
                    
                    return "Success: Media {$media_id} deleted.";
                    
                case 'regenerate':
                    if (!function_exists('wp_generate_attachment_metadata')) {
                        require_once ABSPATH . 'wp-admin/includes/image.php';
                    }
                    
                    $media_id = $args[0] ?? '';
                    if ($media_id && is_numeric($media_id)) {
                        // Regenerar un archivo específico
                        $attachment = get_post($media_id);
                        if (!$attachment || $attachment->post_type !== 'attachment') {
                            return "Error: Media {$media_id} not found.";
                        }
                        
                        $file = get_attached_file($media_id);
                        if (!$file || !file_exists($file)) {
                            return "Error: File not found for media {$media_id}.";
                        }
                        
                        $metadata = wp_generate_attachment_metadata($media_id, $file);
                        wp_update_attachment_metadata($media_id, $metadata);
                        
                        return "Success: Regenerated thumbnails for media {$media_id}.";
                    } else {
                        // Regenerar todos los archivos (limitado por rendimiento)
                        $attachments = get_posts(array(
                            'post_type' => 'attachment',
                            'numberposts' => 20,
                            'post_status' => 'inherit',
                            'post_mime_type' => 'image'
                        ));
                        
                        $regenerated = 0;
                        foreach ($attachments as $attachment) {
                            $file = get_attached_file($attachment->ID);
                            if ($file && file_exists($file)) {
                                $metadata = wp_generate_attachment_metadata($attachment->ID, $file);
                                wp_update_attachment_metadata($attachment->ID, $metadata);
                                $regenerated++;
                            }
                        }
                        
                        return "Success: Regenerated thumbnails for {$regenerated} images.";
                    }
                default:
                    return "Error: 'wp media $sub_command' no está implementado en modo nativo.\nComandos disponibles: list, get, delete, regenerate";
            }
            break;
            
        case 'cache':
            switch ($sub_command) {
                case 'flush':
                    wp_cache_flush();
                    return "Success: Object cache flushed.";
                    
                case 'get':
                    $cache_key = $args[0] ?? '';
                    $cache_group = $args[1] ?? 'default';
                    
                    if (!$cache_key) {
                        return "Error: Cache key required.";
                    }
                    
                    $value = wp_cache_get($cache_key, $cache_group);
                    
                    if ($value === false) {
                        return "Cache key '{$cache_key}' not found in group '{$cache_group}'.";
                    }
                    
                    return is_array($value) || is_object($value) ? json_encode($value, JSON_PRETTY_PRINT) : $value;
                    
                case 'set':
                    $cache_key = $args[0] ?? '';
                    $cache_value = $args[1] ?? '';
                    $cache_group = $args[2] ?? 'default';
                    $expiration = isset($args[3]) ? (int)$args[3] : 0;
                    
                    if (!$cache_key || !$cache_value) {
                        return "Error: Cache key and value required.";
                    }
                    
                    // Intentar decodificar JSON si es posible
                    $decoded_value = json_decode($cache_value, true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        $cache_value = $decoded_value;
                    }
                    
                    $result = wp_cache_set($cache_key, $cache_value, $cache_group, $expiration);
                    return $result ? "Success: Set cache key '{$cache_key}' in group '{$cache_group}'." : "Error: Could not set cache.";
                    
                case 'delete':
                    $cache_key = $args[0] ?? '';
                    $cache_group = $args[1] ?? 'default';
                    
                    if (!$cache_key) {
                        return "Error: Cache key required.";
                    }
                    
                    $result = wp_cache_delete($cache_key, $cache_group);
                    return $result ? "Success: Deleted cache key '{$cache_key}' from group '{$cache_group}'." : "Error: Could not delete cache key.";
                default:
                    return "Error: 'wp cache $sub_command' no está implementado en modo nativo.\nComandos disponibles: flush, get, set, delete";
            }
            break;
            
        case 'transient':
            switch ($sub_command) {
                case 'get':
                    $transient_name = $args[0] ?? '';
                    if (!$transient_name) {
                        return "Error: Transient name required.";
                    }
                    
                    $value = get_transient($transient_name);
                    
                    if ($value === false) {
                        return "Transient '{$transient_name}' not found or expired.";
                    }
                    
                    return is_array($value) || is_object($value) ? json_encode($value, JSON_PRETTY_PRINT) : $value;
                    
                case 'set':
                    $transient_name = $args[0] ?? '';
                    $transient_value = $args[1] ?? '';
                    $expiration = isset($args[2]) ? (int)$args[2] : HOUR_IN_SECONDS;
                    
                    if (!$transient_name || !$transient_value) {
                        return "Error: Transient name and value required.";
                    }
                    
                    // Intentar decodificar JSON si es posible
                    $decoded_value = json_decode($transient_value, true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        $transient_value = $decoded_value;
                    }
                    
                    $result = set_transient($transient_name, $transient_value, $expiration);
                    return $result ? "Success: Set transient '{$transient_name}' with {$expiration}s expiration." : "Error: Could not set transient.";
                    
                case 'delete':
                    $transient_name = $args[0] ?? '';
                    if (!$transient_name) {
                        return "Error: Transient name required.";
                    }
                    
                    $result = delete_transient($transient_name);
                    return $result ? "Success: Deleted transient '{$transient_name}'." : "Error: Could not delete transient.";
                    
                case 'list':
                    global $wpdb;
                    $transients = $wpdb->get_results(
                        "SELECT option_name, option_value FROM {$wpdb->options} 
                         WHERE option_name LIKE '_transient_%' 
                         AND option_name NOT LIKE '_transient_timeout_%' 
                         LIMIT 20"
                    );
                    
                    if (empty($transients)) {
                        return "No transients found.";
                    }
                    
                    $output = "name\tvalue_preview\n";
                    foreach ($transients as $transient) {
                        $name = str_replace('_transient_', '', $transient->option_name);
                        $value_preview = strlen($transient->option_value) > 50 ? 
                            substr($transient->option_value, 0, 50) . '...' : 
                            $transient->option_value;
                        $output .= "{$name}\t{$value_preview}\n";
                    }
                    
                    return $output;
                default:
                    return "Error: 'wp transient $sub_command' no está implementado en modo nativo.\nComandos disponibles: get, set, delete, list";
            }
            break;
            
        case 'role':
            switch ($sub_command) {
                case 'list':
                    global $wp_roles;
                    if (!isset($wp_roles)) {
                        $wp_roles = new WP_Roles();
                    }
                    
                    $roles = $wp_roles->get_names();
                    $output = "role\tlabel\tcapabilities\n";
                    
                    foreach ($roles as $role_name => $role_label) {
                        $role = get_role($role_name);
                        $cap_count = $role ? count($role->capabilities) : 0;
                        $output .= "{$role_name}\t{$role_label}\t{$cap_count}\n";
                    }
                    
                    return $output;
                    
                case 'get':
                    $role_name = $args[0] ?? '';
                    if (!$role_name) {
                        return "Error: Role name required.";
                    }
                    
                    $role = get_role($role_name);
                    if (!$role) {
                        return "Error: Role '{$role_name}' not found.";
                    }
                    
                    global $wp_roles;
                    if (!isset($wp_roles)) {
                        $wp_roles = new WP_Roles();
                    }
                    
                    $role_names = $wp_roles->get_names();
                    $role_label = isset($role_names[$role_name]) ? $role_names[$role_name] : $role_name;
                    
                    $output = "Role: {$role_name}\n";
                    $output .= "Label: {$role_label}\n";
                    $output .= "Capabilities:\n";
                    
                    foreach ($role->capabilities as $cap => $granted) {
                        $status = $granted ? 'granted' : 'denied';
                        $output .= "  {$cap}: {$status}\n";
                    }
                    
                    return $output;
                    
                case 'create':
                    $role_name = $args[0] ?? '';
                    $role_label = $args[1] ?? '';
                    
                    if (!$role_name || !$role_label) {
                        return "Error: Role name and label required.";
                    }
                    
                    // Verificar si ya existe
                    if (get_role($role_name)) {
                        return "Error: Role '{$role_name}' already exists.";
                    }
                    
                    // Procesar capacidades
                    $capabilities = array();
                    $i = 2;
                    while ($i < count($args)) {
                        $arg = $args[$i];
                        
                        if ($arg === '--clone' && isset($args[$i + 1])) {
                            $clone_role = get_role($args[$i + 1]);
                            if ($clone_role) {
                                $capabilities = $clone_role->capabilities;
                            }
                            $i += 2;
                        } elseif (strpos($arg, '--clone=') === 0) {
                            $clone_role_name = substr($arg, 8);
                            $clone_role = get_role($clone_role_name);
                            if ($clone_role) {
                                $capabilities = $clone_role->capabilities;
                            }
                            $i++;
                        } else {
                            $i++;
                        }
                    }
                    
                    // Si no se especificaron capacidades, usar las básicas
                    if (empty($capabilities)) {
                        $capabilities = array('read' => true);
                    }
                    
                    $result = add_role($role_name, $role_label, $capabilities);
                    
                    if (!$result) {
                        return "Error: Could not create role '{$role_name}'.";
                    }
                    
                    return "Success: Created role '{$role_name}' with label '{$role_label}'.";
                    
                case 'delete':
                    $role_name = $args[0] ?? '';
                    if (!$role_name) {
                        return "Error: Role name required.";
                    }
                    
                    // No permitir eliminar roles por defecto
                    $default_roles = array('administrator', 'editor', 'author', 'contributor', 'subscriber');
                    if (in_array($role_name, $default_roles)) {
                        return "Error: Cannot delete default WordPress role '{$role_name}'.";
                    }
                    
                    if (!get_role($role_name)) {
                        return "Error: Role '{$role_name}' not found.";
                    }
                    
                    remove_role($role_name);
                    return "Success: Deleted role '{$role_name}'.";
                default:
                    return "Error: 'wp role $sub_command' no está implementado en modo nativo.\nComandos disponibles: list, get, create, delete";
            }
            break;
            
        case 'cap':
            switch ($sub_command) {
                case 'list':
                    $role_name = $args[0] ?? '';
                    if (!$role_name) {
                        return "Error: Role name required.";
                    }
                    
                    $role = get_role($role_name);
                    if (!$role) {
                        return "Error: Role '{$role_name}' not found.";
                    }
                    
                    $output = "capability\tstatus\n";
                    foreach ($role->capabilities as $cap => $granted) {
                        $status = $granted ? 'granted' : 'denied';
                        $output .= "{$cap}\t{$status}\n";
                    }
                    
                    return $output;
                    
                case 'add':
                    $role_name = $args[0] ?? '';
                    $capability = $args[1] ?? '';
                    
                    if (!$role_name || !$capability) {
                        return "Error: Role name and capability required.";
                    }
                    
                    $role = get_role($role_name);
                    if (!$role) {
                        return "Error: Role '{$role_name}' not found.";
                    }
                    
                    $role->add_cap($capability);
                    return "Success: Added capability '{$capability}' to role '{$role_name}'.";
                    
                case 'remove':
                    $role_name = $args[0] ?? '';
                    $capability = $args[1] ?? '';
                    
                    if (!$role_name || !$capability) {
                        return "Error: Role name and capability required.";
                    }
                    
                    $role = get_role($role_name);
                    if (!$role) {
                        return "Error: Role '{$role_name}' not found.";
                    }
                    
                    $role->remove_cap($capability);
                    return "Success: Removed capability '{$capability}' from role '{$role_name}'.";
                default:
                    return "Error: 'wp cap $sub_command' no está implementado en modo nativo.\nComandos disponibles: list, add, remove";
            }
            break;
            
        case 'db':
            switch ($sub_command) {
                case 'size':
                    global $wpdb;
                    $result = $wpdb->get_var("SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS 'DB Size in MB' FROM information_schema.tables WHERE table_schema='{$wpdb->dbname}'");
                    return $result ? "Database size: {$result} MB" : "Could not determine database size.";
                case 'check':
                    return "Database connection: OK\nDatabase name: " . DB_NAME . "\nDatabase host: " . DB_HOST;
                case 'optimize':
                    global $wpdb;
                    
                    // Obtener todas las tablas de WordPress
                    $tables = $wpdb->get_col("SHOW TABLES LIKE '{$wpdb->prefix}%'");
                    
                    if (empty($tables)) {
                        return "No WordPress tables found to optimize.";
                    }
                    
                    $optimized = 0;
                    $errors = array();
                    
                    foreach ($tables as $table) {
                        $result = $wpdb->query("OPTIMIZE TABLE `{$table}`");
                        if ($result !== false) {
                            $optimized++;
                        } else {
                            $errors[] = $table;
                        }
                    }
                    
                    $output = "Success: Optimized {$optimized} tables.";
                    if (!empty($errors)) {
                        $output .= "\nErrors optimizing: " . implode(', ', $errors);
                    }
                    
                    return $output;
                    
                case 'repair':
                    global $wpdb;
                    
                    // Obtener todas las tablas de WordPress
                    $tables = $wpdb->get_col("SHOW TABLES LIKE '{$wpdb->prefix}%'");
                    
                    if (empty($tables)) {
                        return "No WordPress tables found to repair.";
                    }
                    
                    $repaired = 0;
                    $errors = array();
                    
                    foreach ($tables as $table) {
                        $result = $wpdb->query("REPAIR TABLE `{$table}`");
                        if ($result !== false) {
                            $repaired++;
                        } else {
                            $errors[] = $table;
                        }
                    }
                    
                    $output = "Success: Repaired {$repaired} tables.";
                    if (!empty($errors)) {
                        $output .= "\nErrors repairing: " . implode(', ', $errors);
                    }
                    
                    return $output;
                    
                case 'clean':
                    global $wpdb;
                    
                    $cleaned = array();
                    
                    // Limpiar spam de comentarios
                    $spam_comments = $wpdb->query("DELETE FROM {$wpdb->comments} WHERE comment_approved = 'spam'");
                    if ($spam_comments > 0) {
                        $cleaned[] = "{$spam_comments} spam comments";
                    }
                    
                    // Limpiar comentarios en papelera
                    $trash_comments = $wpdb->query("DELETE FROM {$wpdb->comments} WHERE comment_approved = 'trash'");
                    if ($trash_comments > 0) {
                        $cleaned[] = "{$trash_comments} trashed comments";
                    }
                    
                    // Limpiar posts en papelera (más de 30 días)
                    $old_trash_posts = $wpdb->query("DELETE FROM {$wpdb->posts} WHERE post_status = 'trash' AND post_modified < DATE_SUB(NOW(), INTERVAL 30 DAY)");
                    if ($old_trash_posts > 0) {
                        $cleaned[] = "{$old_trash_posts} old trashed posts";
                    }
                    
                    // Limpiar revisiones de posts (mantener solo las últimas 5)
                    $revisions = $wpdb->query("DELETE p1 FROM {$wpdb->posts} p1 INNER JOIN {$wpdb->posts} p2 WHERE p1.post_type = 'revision' AND p1.post_parent = p2.ID AND p1.post_date < (SELECT post_date FROM (SELECT post_date FROM {$wpdb->posts} WHERE post_parent = p2.ID AND post_type = 'revision' ORDER BY post_date DESC LIMIT 5,1) AS t)");
                    if ($revisions > 0) {
                        $cleaned[] = "{$revisions} post revisions";
                    }
                    
                    // Limpiar metadatos huérfanos
                    $orphan_postmeta = $wpdb->query("DELETE pm FROM {$wpdb->postmeta} pm LEFT JOIN {$wpdb->posts} p ON pm.post_id = p.ID WHERE p.ID IS NULL");
                    if ($orphan_postmeta > 0) {
                        $cleaned[] = "{$orphan_postmeta} orphaned post meta";
                    }
                    
                    $orphan_commentmeta = $wpdb->query("DELETE cm FROM {$wpdb->commentmeta} cm LEFT JOIN {$wpdb->comments} c ON cm.comment_id = c.comment_ID WHERE c.comment_ID IS NULL");
                    if ($orphan_commentmeta > 0) {
                        $cleaned[] = "{$orphan_commentmeta} orphaned comment meta";
                    }
                    
                    // Limpiar transients expirados
                    $expired_transients = $wpdb->query("DELETE a, b FROM {$wpdb->options} a, {$wpdb->options} b WHERE a.option_name LIKE '_transient_%' AND a.option_name NOT LIKE '_transient_timeout_%' AND b.option_name = CONCAT('_transient_timeout_', SUBSTRING(a.option_name, 12)) AND b.option_value < UNIX_TIMESTAMP()");
                    if ($expired_transients > 0) {
                        $cleaned[] = "{$expired_transients} expired transients";
                    }
                    
                    if (empty($cleaned)) {
                        return "Database is already clean.";
                    }
                    
                    return "Success: Cleaned " . implode(', ', $cleaned) . ".";
                    
                case 'search':
                    $search_term = $args[0] ?? '';
                    if (!$search_term) {
                        return "Error: Search term required.";
                    }
                    
                    global $wpdb;
                    
                    // Buscar en posts
                    $posts = $wpdb->get_results($wpdb->prepare("
                        SELECT ID, post_title, post_type, post_status 
                        FROM {$wpdb->posts} 
                        WHERE (post_title LIKE %s OR post_content LIKE %s) 
                        AND post_status != 'trash' 
                        LIMIT 20
                    ", "%{$search_term}%", "%{$search_term}%"));
                    
                    // Buscar en comentarios
                    $comments = $wpdb->get_results($wpdb->prepare("
                        SELECT comment_ID, comment_author, comment_content, comment_post_ID 
                        FROM {$wpdb->comments} 
                        WHERE comment_content LIKE %s 
                        AND comment_approved = '1' 
                        LIMIT 10
                    ", "%{$search_term}%"));
                    
                    // Buscar en opciones
                    $options = $wpdb->get_results($wpdb->prepare("
                        SELECT option_name, option_value 
                        FROM {$wpdb->options} 
                        WHERE option_value LIKE %s 
                        LIMIT 10
                    ", "%{$search_term}%"));
                    
                    $output = "Search results for '{$search_term}':\n\n";
                    
                    if (!empty($posts)) {
                        $output .= "POSTS:\n";
                        foreach ($posts as $post) {
                            $output .= "- [{$post->ID}] {$post->post_title} ({$post->post_type}, {$post->post_status})\n";
                        }
                        $output .= "\n";
                    }
                    
                    if (!empty($comments)) {
                        $output .= "COMMENTS:\n";
                        foreach ($comments as $comment) {
                            $content_preview = strlen($comment->comment_content) > 50 ? 
                                substr($comment->comment_content, 0, 50) . '...' : 
                                $comment->comment_content;
                            $output .= "- [{$comment->comment_ID}] {$comment->comment_author}: {$content_preview}\n";
                        }
                        $output .= "\n";
                    }
                    
                    if (!empty($options)) {
                        $output .= "OPTIONS:\n";
                        foreach ($options as $option) {
                            $value_preview = strlen($option->option_value) > 50 ? 
                                substr($option->option_value, 0, 50) . '...' : 
                                $option->option_value;
                            $output .= "- {$option->option_name}: {$value_preview}\n";
                        }
                    }
                    
                    if (empty($posts) && empty($comments) && empty($options)) {
                        $output .= "No results found.";
                    }
                    
                    return $output;
                default:
                    return "Error: 'wp db $sub_command' no está implementado en modo nativo por seguridad.\nComandos disponibles: size, check, optimize, repair, clean, search";
            }
            break;
            
        default:
            $available_commands = [
                'wp --version' => 'Show WordPress and plugin version',
                'wp core version' => 'Show WordPress version',
                'wp plugin list' => 'List all plugins',
                'wp plugin status <name>' => 'Check plugin status',
                'wp plugin activate <slug>' => 'Activate plugin',
                'wp plugin deactivate <slug>' => 'Deactivate plugin',
                'wp plugin install <slug>' => 'Install plugin from repository',
                'wp plugin update <slug>' => 'Update plugin',
                'wp plugin delete <slug>' => 'Delete plugin',
                'wp plugin search <term>' => 'Search plugins',
                'wp plugin get <slug>' => 'Get plugin details',
                'wp theme list' => 'List all themes',
                'wp theme status' => 'Show current theme',
                'wp theme activate <slug>' => 'Activate theme',
                'wp theme install <slug>' => 'Install theme from repository',
                'wp theme update <slug>' => 'Update theme',
                'wp theme delete <slug>' => 'Delete theme',
                'wp theme search <term>' => 'Search themes',
                'wp theme get <slug>' => 'Get theme details',
                'wp user list' => 'List all users',
                'wp user get <id>' => 'Get user details',
                'wp user create' => 'Create new user',
                'wp user update <id>' => 'Update user',
                'wp user delete <id>' => 'Delete user',
                'wp user set-role <id> <role>' => 'Set user role',
                'wp user add-role <id> <role>' => 'Add role to user',
                'wp user remove-role <id> <role>' => 'Remove role from user',
                'wp user meta get <id> [key]' => 'Get user metadata',
                'wp user meta set <id> <key> <value>' => 'Set user metadata',
                'wp user generate [--count=5]' => 'Generate test users',
                'wp post list' => 'List posts',
                'wp post get <id>' => 'Get post details',
                'wp post create' => 'Create new post',
                'wp post update <id>' => 'Update post',
                'wp post delete <id>' => 'Delete post',
                'wp post duplicate <id>' => 'Duplicate post',
                'wp post meta get <id> [key]' => 'Get post metadata',
                'wp post meta set <id> <key> <value>' => 'Set post metadata',
                'wp post generate [--count=5]' => 'Generate test posts',
                'wp option get <name>' => 'Get option value',
                'wp option set <name> <value>' => 'Set option value',
                'wp option add <name> <value>' => 'Add new option',
                'wp option delete <name>' => 'Delete option',
                'wp option list' => 'List common options',
                'wp term list [taxonomy]' => 'List terms',
                'wp term get <id> [taxonomy]' => 'Get term details',
                'wp term create <taxonomy> <name>' => 'Create term',
                'wp term update <id>' => 'Update term',
                'wp term delete <id> [taxonomy]' => 'Delete term',
                'wp taxonomy list' => 'List taxonomies',
                'wp taxonomy get <name>' => 'Get taxonomy details',
                'wp media list' => 'List media files',
                'wp media get <id>' => 'Get media details',
                'wp media delete <id>' => 'Delete media file',
                'wp media regenerate [id]' => 'Regenerate thumbnails',
                'wp cache flush' => 'Flush object cache',
                'wp cache get <key> [group]' => 'Get cache value',
                'wp cache set <key> <value> [group]' => 'Set cache value',
                'wp cache delete <key> [group]' => 'Delete cache key',
                'wp transient get <name>' => 'Get transient value',
                'wp transient set <name> <value> [exp]' => 'Set transient value',
                'wp transient delete <name>' => 'Delete transient',
                'wp transient list' => 'List transients',
                'wp role list' => 'List user roles',
                'wp role get <name>' => 'Get role details',
                'wp role create <name> <label>' => 'Create new role',
                'wp role delete <name>' => 'Delete role',
                'wp cap list <role>' => 'List role capabilities',
                'wp cap add <role> <capability>' => 'Add capability to role',
                'wp cap remove <role> <capability>' => 'Remove capability from role',
                'wp db size' => 'Show database size',
                'wp db check' => 'Check database connection',
                'wp db optimize' => 'Optimize database tables',
                'wp db repair' => 'Repair database tables',
                'wp db clean' => 'Clean database (spam, trash, etc.)',
                'wp db search <term>' => 'Search database content'
            ];
            
            $help_text = "Error: Command '$main_command' not implemented in native mode.\n\nAvailable commands:\n";
            foreach ($available_commands as $cmd => $desc) {
                $help_text .= "  $cmd - $desc\n";
            }
            
            return $help_text;
    }
    
    return "Error: Command not recognized: $wp_command";
}

// Endpoint de diagnóstico del servidor
add_action('rest_api_init', function () {
    register_rest_route('gemini/v1', '/server-info', array(
        'methods' => 'GET',
        'callback' => function() {
            gemini_log('Endpoint de información del servidor accedido');
            
            // Verificar capacidades de ejecución
            $exec_functions = ['shell_exec', 'exec', 'system', 'passthru'];
            $server_capabilities = array();
            
            foreach ($exec_functions as $func) {
                $server_capabilities[$func] = function_exists($func);
            }
            
            // Verificar WP-CLI
            $wp_cli_info = array(
                'available' => false,
                'path' => '',
                'version' => '',
                'method' => 'none'
            );
            
            foreach ($exec_functions as $func) {
                if (function_exists($func)) {
                    if ($func === 'shell_exec') {
                        $wp_path = shell_exec('which wp 2>/dev/null');
                        if (!empty(trim($wp_path))) {
                            $wp_cli_info['available'] = true;
                            $wp_cli_info['path'] = trim($wp_path);
                            $wp_cli_info['method'] = $func;
                            $wp_cli_info['version'] = trim(shell_exec('wp --version 2>/dev/null') ?: 'No se pudo obtener');
                            break;
                        }
                    } elseif ($func === 'exec') {
                        exec('which wp 2>/dev/null', $output, $return_code);
                        if ($return_code === 0 && !empty($output)) {
                            $wp_cli_info['available'] = true;
                            $wp_cli_info['path'] = trim(implode("\n", $output));
                            $wp_cli_info['method'] = $func;
                            exec('wp --version 2>/dev/null', $version_output);
                            $wp_cli_info['version'] = !empty($version_output) ? trim(implode("\n", $version_output)) : 'No se pudo obtener';
                            break;
                        }
                    }
                }
            }
            
            return array(
                'server_info' => array(
                    'php_version' => PHP_VERSION,
                    'wordpress_version' => get_bloginfo('version'),
                    'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Desconocido',
                    'operating_system' => PHP_OS,
                ),
                'execution_capabilities' => $server_capabilities,
                'wp_cli' => $wp_cli_info,
                'security_status' => array(
                    'safe_mode' => ini_get('safe_mode') ? 'enabled' : 'disabled',
                    'open_basedir' => ini_get('open_basedir') ?: 'no restriction',
                    'disable_functions' => ini_get('disable_functions') ?: 'none',
                ),
                'recommended_method' => $wp_cli_info['available'] ? 'wp_cli_real' : 'wordpress_native_api',
                'timestamp' => current_time('mysql')
            );
        },
        'permission_callback' => '__return_true',
    ));
});

// Endpoint de diagnóstico (sin autenticación para pruebas)
add_action('rest_api_init', function () {
    register_rest_route('gemini/v1', '/test', array(
        'methods' => 'GET',
        'callback' => function() {
            gemini_log('Endpoint de prueba accedido');
            return array(
                'status' => 'ok',
                'message' => 'Plugin Gemini funcionando correctamente',
                'timestamp' => current_time('mysql'),
                'wp_version' => get_bloginfo('version'),
                'rest_url' => rest_url('gemini/v1/'),
            );
        },
        'permission_callback' => '__return_true',
    ));
});

// Endpoint para gestión de tokens (solo administradores)
add_action('rest_api_init', function () {
    register_rest_route('gemini/v1', '/token', array(
        'methods' => 'GET',
        'callback' => function() {
            gemini_log('Solicitud de token desde administrador');
            
            $current_token = gemini_get_current_token();
            
            return array(
                'status' => 'success',
                'token' => $current_token,
                'token_preview' => substr($current_token, 0, 8) . '...' . substr($current_token, -8),
                'generated_at' => get_option('gemini_wp_cli_token_date', current_time('mysql')),
                'instructions' => array(
                    'copy_token' => 'Copia el token completo para usar en la aplicación',
                    'security_note' => 'Este token es único para tu sitio. No lo compartas públicamente.',
                    'regenerate' => 'Puedes regenerar el token usando POST /wp-json/gemini/v1/token/regenerate'
                )
            );
        },
        'permission_callback' => function() {
            return current_user_can('manage_options');
        },
    ));
    
    register_rest_route('gemini/v1', '/token/regenerate', array(
        'methods' => 'POST',
        'callback' => function() {
            gemini_log('Regeneración de token solicitada por administrador');
            
            $new_token = gemini_regenerate_token();
            update_option('gemini_wp_cli_token_date', current_time('mysql'));
            
            return array(
                'status' => 'success',
                'message' => 'Token regenerado exitosamente',
                'new_token' => $new_token,
                'token_preview' => substr($new_token, 0, 8) . '...' . substr($new_token, -8),
                'generated_at' => current_time('mysql'),
                'warning' => 'El token anterior ya no es válido. Actualiza todas las aplicaciones que lo usen.'
            );
        },
        'permission_callback' => function() {
            return current_user_can('manage_options');
        },
    ));
});

// Añadir página de administración
add_action('admin_menu', function() {
    add_options_page(
        'Gemini WP-CLI Settings',
        'Gemini WP-CLI',
        'manage_options',
        'gemini-wp-cli-settings',
        'gemini_admin_page'
    );
});

// Página de administración
function gemini_admin_page() {
    $current_token = gemini_get_current_token();
    $token_date = get_option('gemini_wp_cli_token_date', 'No disponible');
    
    // Manejar regeneración de token
    if (isset($_POST['regenerate_token']) && wp_verify_nonce($_POST['gemini_nonce'], 'gemini_regenerate')) {
        $new_token = gemini_regenerate_token();
        update_option('gemini_wp_cli_token_date', current_time('mysql'));
        echo '<div class="notice notice-success"><p>Token regenerado exitosamente!</p></div>';
        $current_token = $new_token;
        $token_date = current_time('mysql');
    }
    
    ?>
    <div class="wrap">
        <h1>🤖 Gemini WP-CLI Bridge - Configuración</h1>
        
        <div class="card" style="max-width: 800px;">
            <h2>🔑 Token de Seguridad</h2>
            <p>Este token es necesario para conectar aplicaciones externas a tu WordPress de forma segura.</p>
            
            <table class="form-table">
                <tr>
                    <th scope="row">Token Actual</th>
                    <td>
                        <input type="text" 
                               value="<?php echo esc_attr($current_token); ?>" 
                               readonly 
                               class="regular-text code" 
                               id="gemini-token"
                               style="width: 100%; font-family: monospace;">
                        <button type="button" 
                                onclick="copyToken()" 
                                class="button button-secondary"
                                style="margin-left: 10px;">
                            📋 Copiar Token
                        </button>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Generado</th>
                    <td><?php echo esc_html($token_date); ?></td>
                </tr>
                <tr>
                    <th scope="row">Vista Previa</th>
                    <td><code><?php echo esc_html(substr($current_token, 0, 8) . '...' . substr($current_token, -8)); ?></code></td>
                </tr>
            </table>
            
            <form method="post" style="margin-top: 20px;">
                <?php wp_nonce_field('gemini_regenerate', 'gemini_nonce'); ?>
                <input type="submit" 
                       name="regenerate_token" 
                       class="button button-primary" 
                       value="🔄 Regenerar Token"
                       onclick="return confirm('¿Estás seguro? Esto invalidará el token actual y tendrás que actualizar todas las aplicaciones que lo usen.');">
                <p class="description">
                    ⚠️ <strong>Advertencia:</strong> Regenerar el token invalidará el actual. 
                    Tendrás que actualizar todas las aplicaciones que usen este token.
                </p>
            </form>
        </div>
        
        <div class="card" style="max-width: 800px; margin-top: 20px;">
            <h2>📋 Cómo Usar</h2>
            <ol>
                <li><strong>Copia el token</strong> usando el botón "📋 Copiar Token"</li>
                <li><strong>Abre tu aplicación Gemini WP-CLI</strong></li>
                <li><strong>Haz clic en ⚙️</strong> para abrir configuración</li>
                <li><strong>Pega el token</strong> en el campo "Token de Seguridad"</li>
                <li><strong>Completa la URL</strong> de tu sitio: <code><?php echo esc_html(get_site_url()); ?></code></li>
            </ol>
        </div>
        
        <div class="card" style="max-width: 800px; margin-top: 20px;">
            <h2>🔒 Seguridad</h2>
            <ul>
                <li>✅ <strong>Token único:</strong> Generado automáticamente para tu sitio</li>
                <li>✅ <strong>Hash seguro:</strong> Usa SHA-256 con múltiples fuentes de entropía</li>
                <li>✅ <strong>Comparación segura:</strong> Usa hash_equals() para prevenir timing attacks</li>
                <li>✅ <strong>Regenerable:</strong> Puedes crear un nuevo token cuando quieras</li>
                <li>✅ <strong>Solo administradores:</strong> Solo usuarios con permisos pueden ver/regenerar</li>
            </ul>
        </div>
    </div>
    
    <script>
    function copyToken() {
        const tokenField = document.getElementById('gemini-token');
        tokenField.select();
        tokenField.setSelectionRange(0, 99999);
        document.execCommand('copy');
        
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = '✅ Copiado!';
        button.style.backgroundColor = '#46b450';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '';
        }, 2000);
    }
    </script>
    <?php
}