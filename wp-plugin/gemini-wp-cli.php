<?php
/*
Plugin Name: Typingpress – Gemini WP Bridge
Description: REST bridge real entre WordPress y Typingpress (Gemini Agent)
Version: 2.0.0
Author: Typingpress
*/

if (!defined('ABSPATH')) {
    exit;
}

/* ======================================================
 * UTILIDADES BÁSICAS
 * ====================================================== */

function typingpress_log($msg) {
    error_log('[Typingpress] ' . $msg);
}

/* ======================================================
 * TOKEN DE SEGURIDAD
 * ====================================================== */

function typingpress_get_token() {
    $token = get_option('typingpress_api_token');
    if (!$token) {
        $token = wp_generate_password(48, true, true);
        update_option('typingpress_api_token', $token);
        update_option('typingpress_api_token_date', current_time('mysql'));
    }
    return $token;
}

function typingpress_verify_token(WP_REST_Request $request) {
    $incoming = $request->get_header('x-gemini-auth');
    $real = typingpress_get_token();

    if (!$incoming || !hash_equals($real, $incoming)) {
        return new WP_Error(
            'invalid_token',
            'Invalid or missing token',
            ['status' => 403]
        );
    }

    return true;
}

/* ======================================================
 * REST API
 * ====================================================== */

add_action('rest_api_init', function () {

    /* ---------- DISCOVERY (con soporte para format=tools) ---------- */
    register_rest_route('typingpress/v1', '/discovery', [
        'methods'  => 'GET',
        'callback' => function (WP_REST_Request $request) {
            $format = $request->get_param('format');
            
            // Formato para Gemini Tools (JSON Schema)
            if ($format === 'tools') {
                return [
                    'status' => 'ok',
                    'tools' => typingpress_get_abilities_as_tools(),
                    'cache_key' => md5('abilities_' . get_bloginfo('version')),
                    'timestamp' => current_time('c')
                ];
            }
            
            // Formato legacy (compatibilidad)
            return [
                'status' => 'ok',
                'abilities' => typingpress_get_abilities_list(),
                'timestamp' => current_time('c')
            ];
        },
        'permission_callback' => 'typingpress_verify_token'
    ]);

    /* ---------- TEST ENDPOINT (para verificación de conexión) ---------- */
    register_rest_route('typingpress/v1', '/test', [
        'methods'  => 'GET',
        'callback' => function (WP_REST_Request $request) {
            return [
                'status' => 'ok',
                'message' => 'TypingPress plugin is active',
                'plugin_version' => '2.0.0',
                'namespace' => 'typingpress/v1',
                'abilities_count' => count(typingpress_get_abilities_list()),
                'timestamp' => current_time('c')
            ];
        },
        'permission_callback' => '__return_true' // Permitir acceso sin token para verificación básica
    ]);

    /* ---------- EXECUTE ABILITY (con soporte para mode=simulate) ---------- */
    register_rest_route('typingpress/v1', '/abilities/(?P<ability>[a-zA-Z0-9_-]+)/execute', [
        'methods'  => 'POST',
        'callback' => 'typingpress_execute_ability',
        'permission_callback' => 'typingpress_verify_token'
    ]);

});

/* ======================================================
 * ABILITIES DEFINITIONS
 * ====================================================== */

function typingpress_get_abilities_list() {
    return [
        [
            'name' => 'get_site_info',
            'description' => 'Get basic WordPress site information',
            'parameters' => []
        ],
        [
            'name' => 'list_plugins',
            'description' => 'List installed plugins with their status',
            'parameters' => []
        ],
        [
            'name' => 'list_themes',
            'description' => 'List installed themes',
            'parameters' => []
        ],
        [
            'name' => 'get_plugin_info',
            'description' => 'Get detailed information about a specific plugin',
            'parameters' => [
                'plugin_slug' => [
                    'type' => 'string',
                    'description' => 'Plugin slug or file path',
                    'required' => true
                ]
            ]
        ],
        [
            'name' => 'activate_plugin',
            'description' => 'Activate a WordPress plugin',
            'parameters' => [
                'plugin_slug' => [
                    'type' => 'string',
                    'description' => 'Plugin slug or file path',
                    'required' => true
                ]
            ]
        ],
        [
            'name' => 'deactivate_plugin',
            'description' => 'Deactivate a WordPress plugin',
            'parameters' => [
                'plugin_slug' => [
                    'type' => 'string',
                    'description' => 'Plugin slug or file path',
                    'required' => true
                ]
            ]
        ],
        [
            'name' => 'list_users',
            'description' => 'List WordPress users',
            'parameters' => [
                'role' => [
                    'type' => 'string',
                    'description' => 'Filter by user role (optional)',
                    'required' => false
                ]
            ]
        ],
        [
            'name' => 'get_user_info',
            'description' => 'Get information about a specific user',
            'parameters' => [
                'user_id' => [
                    'type' => 'integer',
                    'description' => 'User ID',
                    'required' => true
                ]
            ]
        ]
    ];
}

function typingpress_get_abilities_as_tools() {
    $abilities = typingpress_get_abilities_list();
    $tools = [];
    
    foreach ($abilities as $ability) {
        $tool = [
            'name' => $ability['name'],
            'description' => $ability['description'],
            'parameters' => [
                'type' => 'object',
                'properties' => [],
                'required' => []
            ]
        ];
        
        // Convertir parámetros al formato JSON Schema
        if (!empty($ability['parameters'])) {
            foreach ($ability['parameters'] as $paramName => $paramDef) {
                $tool['parameters']['properties'][$paramName] = [
                    'type' => $paramDef['type'] ?? 'string',
                    'description' => $paramDef['description'] ?? ''
                ];
                
                if (!empty($paramDef['required']) && $paramDef['required']) {
                    $tool['parameters']['required'][] = $paramName;
                }
            }
        }
        
        $tools[] = $tool;
    }
    
    return $tools;
}

/* ======================================================
 * ABILITIES REALES
 * ====================================================== */

function typingpress_execute_ability(WP_REST_Request $request) {
    $ability = $request->get_param('ability');
    $mode = $request->get_param('mode') ?: 'execute';
    $body = $request->get_json_params() ?: [];
    
    typingpress_log("Executing ability: $ability (mode: $mode)");
    
    // 🧪 SIMULATE MODE: Solo devolver qué haría sin ejecutar
    if ($mode === 'simulate') {
        return typingpress_simulate_ability($ability, $body);
    }
    
    // ⚡ EXECUTE MODE: Ejecución real
    switch ($ability) {
        case 'get_site_info':
            return [
                'status' => 'success',
                'result' => [
                    'site_url' => home_url(),
                    'site_name' => get_bloginfo('name'),
                    'wp_version' => get_bloginfo('version'),
                    'php_version' => PHP_VERSION,
                    'theme' => [
                        'name' => wp_get_theme()->get('Name'),
                        'version' => wp_get_theme()->get('Version')
                    ],
                    'multisite' => is_multisite(),
                    'language' => get_bloginfo('language'),
                    'timezone' => wp_timezone_string()
                ],
                'execution_time' => 0.1
            ];

        case 'list_plugins':
            if (!function_exists('get_plugins')) {
                require_once ABSPATH . 'wp-admin/includes/plugin.php';
            }

            $plugins = get_plugins();
            $active = get_option('active_plugins', []);

            $result = [];
            foreach ($plugins as $file => $data) {
                $result[] = [
                    'name' => $data['Name'],
                    'slug' => dirname($file),
                    'version' => $data['Version'],
                    'active' => in_array($file, $active),
                    'file' => $file
                ];
            }

            return [
                'status' => 'success',
                'result' => [
                    'total' => count($result),
                    'plugins' => $result
                ],
                'execution_time' => 0.2
            ];

        case 'list_themes':
            $themes = wp_get_themes();
            $active_theme = wp_get_theme();
            $result = [];
            
            foreach ($themes as $theme) {
                $result[] = [
                    'name' => $theme->get('Name'),
                    'version' => $theme->get('Version'),
                    'active' => ($theme->get_stylesheet() === $active_theme->get_stylesheet()),
                    'stylesheet' => $theme->get_stylesheet()
                ];
            }
            
            return [
                'status' => 'success',
                'result' => [
                    'total' => count($result),
                    'themes' => $result
                ],
                'execution_time' => 0.15
            ];

        case 'get_plugin_info':
            $plugin_slug = $body['plugin_slug'] ?? '';
            if (!$plugin_slug) {
                return new WP_Error('missing_param', 'plugin_slug is required', ['status' => 400]);
            }
            
            if (!function_exists('get_plugins')) {
                require_once ABSPATH . 'wp-admin/includes/plugin.php';
            }
            
            $plugins = get_plugins();
            $active = get_option('active_plugins', []);
            
            // Buscar por slug o file
            foreach ($plugins as $file => $data) {
                if ($file === $plugin_slug || dirname($file) === $plugin_slug) {
                    return [
                        'status' => 'success',
                        'result' => [
                            'name' => $data['Name'],
                            'slug' => dirname($file),
                            'version' => $data['Version'],
                            'description' => $data['Description'],
                            'author' => $data['Author'],
                            'active' => in_array($file, $active),
                            'file' => $file
                        ],
                        'execution_time' => 0.1
                    ];
                }
            }
            
            return new WP_Error('plugin_not_found', 'Plugin not found', ['status' => 404]);

        case 'activate_plugin':
            $plugin_slug = $body['plugin_slug'] ?? '';
            if (!$plugin_slug) {
                return new WP_Error('missing_param', 'plugin_slug is required', ['status' => 400]);
            }
            
            if (!current_user_can('activate_plugins')) {
                return new WP_Error('insufficient_permissions', 'User cannot activate plugins', ['status' => 403]);
            }
            
            $result = activate_plugin($plugin_slug);
            if (is_wp_error($result)) {
                return $result;
            }
            
            return [
                'status' => 'success',
                'result' => ['message' => 'Plugin activated successfully'],
                'execution_time' => 0.3
            ];

        case 'deactivate_plugin':
            $plugin_slug = $body['plugin_slug'] ?? '';
            if (!$plugin_slug) {
                return new WP_Error('missing_param', 'plugin_slug is required', ['status' => 400]);
            }
            
            if (!current_user_can('deactivate_plugins')) {
                return new WP_Error('insufficient_permissions', 'User cannot deactivate plugins', ['status' => 403]);
            }
            
            deactivate_plugins($plugin_slug);
            
            return [
                'status' => 'success',
                'result' => ['message' => 'Plugin deactivated successfully'],
                'execution_time' => 0.3
            ];

        case 'list_users':
            $role = $body['role'] ?? '';
            $args = ['number' => -1];
            if ($role) {
                $args['role'] = $role;
            }
            
            $users = get_users($args);
            $result = [];
            
            foreach ($users as $user) {
                $result[] = [
                    'id' => $user->ID,
                    'username' => $user->user_login,
                    'email' => $user->user_email,
                    'display_name' => $user->display_name,
                    'roles' => $user->roles
                ];
            }
            
            return [
                'status' => 'success',
                'result' => [
                    'total' => count($result),
                    'users' => $result
                ],
                'execution_time' => 0.2
            ];

        case 'get_user_info':
            $user_id = intval($body['user_id'] ?? 0);
            if (!$user_id) {
                return new WP_Error('missing_param', 'user_id is required', ['status' => 400]);
            }
            
            $user = get_userdata($user_id);
            if (!$user) {
                return new WP_Error('user_not_found', 'User not found', ['status' => 404]);
            }
            
            return [
                'status' => 'success',
                'result' => [
                    'id' => $user->ID,
                    'username' => $user->user_login,
                    'email' => $user->user_email,
                    'display_name' => $user->display_name,
                    'roles' => $user->roles,
                    'registered' => $user->user_registered,
                    'capabilities' => array_keys($user->allcaps)
                ],
                'execution_time' => 0.1
            ];

        default:
            return new WP_Error(
                'unknown_ability',
                'Ability not found: ' . $ability,
                ['status' => 404]
            );
    }
}

/* ======================================================
 * SIMULATE MODE
 * ====================================================== */

function typingpress_simulate_ability($ability, $body) {
    $simulations = [
        'get_site_info' => [
            'simulation_result' => [
                'would_return' => 'Site information including URL, WordPress version, PHP version, active theme, and multisite status'
            ],
            'impact_report' => [
                'risk_level' => 'read',
                'resources_affected' => [],
                'reversibility' => 'N/A - Read-only operation',
                'recommendations' => ['This is a safe read-only operation']
            ]
        ],
        'list_plugins' => [
            'simulation_result' => [
                'would_return' => 'List of all installed plugins with their status (active/inactive)'
            ],
            'impact_report' => [
                'risk_level' => 'read',
                'resources_affected' => [],
                'reversibility' => 'N/A - Read-only operation',
                'recommendations' => ['This is a safe read-only operation']
            ]
        ],
        'list_themes' => [
            'simulation_result' => [
                'would_return' => 'List of all installed themes with their status'
            ],
            'impact_report' => [
                'risk_level' => 'read',
                'resources_affected' => [],
                'reversibility' => 'N/A - Read-only operation',
                'recommendations' => ['This is a safe read-only operation']
            ]
        ],
        'get_plugin_info' => [
            'simulation_result' => [
                'would_return' => 'Detailed information about the specified plugin'
            ],
            'impact_report' => [
                'risk_level' => 'read',
                'resources_affected' => [],
                'reversibility' => 'N/A - Read-only operation',
                'recommendations' => ['This is a safe read-only operation']
            ]
        ],
        'activate_plugin' => [
            'simulation_result' => [
                'would_activate' => $body['plugin_slug'] ?? 'unknown',
                'would_enable' => 'Plugin functionality and hooks'
            ],
            'impact_report' => [
                'risk_level' => 'write',
                'resources_affected' => [
                    ['resource' => 'Plugin: ' . ($body['plugin_slug'] ?? 'unknown'), 'risk' => 'medium']
                ],
                'reversibility' => 'Reversible - Plugin can be deactivated',
                'recommendations' => [
                    'Verify plugin compatibility before activation',
                    'Test in staging environment first if possible'
                ]
            ]
        ],
        'deactivate_plugin' => [
            'simulation_result' => [
                'would_deactivate' => $body['plugin_slug'] ?? 'unknown',
                'would_disable' => 'Plugin functionality and hooks'
            ],
            'impact_report' => [
                'risk_level' => 'write',
                'resources_affected' => [
                    ['resource' => 'Plugin: ' . ($body['plugin_slug'] ?? 'unknown'), 'risk' => 'low']
                ],
                'reversibility' => 'Reversible - Plugin can be reactivated',
                'recommendations' => [
                    'Ensure no critical functionality depends on this plugin',
                    'Backup before deactivation if needed'
                ]
            ]
        ],
        'list_users' => [
            'simulation_result' => [
                'would_return' => 'List of WordPress users' . (!empty($body['role']) ? ' filtered by role: ' . $body['role'] : '')
            ],
            'impact_report' => [
                'risk_level' => 'read',
                'resources_affected' => [],
                'reversibility' => 'N/A - Read-only operation',
                'recommendations' => ['This is a safe read-only operation']
            ]
        ],
        'get_user_info' => [
            'simulation_result' => [
                'would_return' => 'Detailed information about user ID: ' . ($body['user_id'] ?? 'unknown')
            ],
            'impact_report' => [
                'risk_level' => 'read',
                'resources_affected' => [],
                'reversibility' => 'N/A - Read-only operation',
                'recommendations' => ['This is a safe read-only operation']
            ]
        ]
    ];
    
    $simulation = $simulations[$ability] ?? [
        'simulation_result' => [
            'would_execute' => "Ability: $ability",
            'parameters' => $body
        ],
        'impact_report' => [
            'risk_level' => 'unknown',
            'resources_affected' => [],
            'reversibility' => 'Unknown',
            'recommendations' => ['Review this ability before execution']
        ]
    ];
    
    return [
        'status' => 'success',
        'mode' => 'simulation',
        'ability_name' => $ability,
        'simulation_result' => $simulation['simulation_result'],
        'impact_report' => $simulation['impact_report'],
        'execution_time' => 0.05
    ];
}

/* ======================================================
 * ADMIN – MOSTRAR TOKEN
 * ====================================================== */

add_action('admin_menu', function () {
    add_options_page(
        'Typingpress Token',
        'Typingpress',
        'manage_options',
        'typingpress-token',
        'typingpress_admin_page'
    );
});

function typingpress_admin_page() {
    $token = typingpress_get_token();
    $abilities_count = count(typingpress_get_abilities_list());
    ?>
    <div class="wrap">
        <h1>Typingpress API Token</h1>
        <p>Usá este token en la app Typingpress / Gemini:</p>
        <code style="display:block;padding:12px;background:#f1f1f1;font-size:14px;margin:10px 0;">
            <?php echo esc_html($token); ?>
        </code>
        <p><strong>Abilities disponibles:</strong> <?php echo $abilities_count; ?></p>
        <p><strong>API Endpoint:</strong> <code><?php echo rest_url('typingpress/v1/'); ?></code></p>
    </div>
    <?php
}
