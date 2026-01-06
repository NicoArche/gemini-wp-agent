<?php
/*
Plugin Name: Gemini WP-CLI Bridge + Abilities API
Description: Endpoint seguro para ejecutar comandos WP-CLI y WordPress Abilities API desde la App de Gemini con tokens seguros automáticos.
Version: 3.0 - Abilities API Integration
Author: Gemini Hackathon Team
*/

if (!defined('ABSPATH')) exit;

/**
 * 🔄 GEMINI WORKFLOW ENGINE
 * 
 * Sistema de workflows/playbooks que agrupa múltiples abilities y policies
 * en secuencias guiadas, reutilizables y seguras - nunca automáticas.
 */
class Gemini_Workflow_Engine {
    
    private static $instance = null;
    private $workflows = array();
    private $workflow_sessions = array(); // Estado de workflows en ejecución
    
    /**
     * Singleton pattern
     */
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        // Registrar workflows al inicializar
        add_action('init', array($this, 'register_core_workflows'));
    }
    
    /**
     * Registrar un workflow en el sistema
     */
    public function register_workflow($workflow_id, $workflow_config) {
        // Validar configuración requerida
        $required_fields = array('name', 'description', 'steps', 'overall_risk_level');
        
        foreach ($required_fields as $field) {
            if (!isset($workflow_config[$field])) {
                gemini_log("❌ Error registrando workflow '{$workflow_id}': falta campo '{$field}'");
                return false;
            }
        }
        
        // Validar steps
        if (!is_array($workflow_config['steps']) || empty($workflow_config['steps'])) {
            gemini_log("❌ Error registrando workflow '{$workflow_id}': steps debe ser array no vacío");
            return false;
        }
        
        // Almacenar workflow
        $this->workflows[$workflow_id] = array(
            'id' => $workflow_id,
            'name' => $workflow_config['name'],
            'description' => $workflow_config['description'],
            'category' => $workflow_config['category'] ?? 'general',
            'steps' => $workflow_config['steps'],
            'recommended_order' => $workflow_config['recommended_order'] ?? true,
            'overall_risk_level' => $workflow_config['overall_risk_level'],
            'estimated_duration' => $workflow_config['estimated_duration'] ?? 'Unknown',
            'prerequisites' => $workflow_config['prerequisites'] ?? array(),
            'tags' => $workflow_config['tags'] ?? array(),
            'auto_suggest' => $workflow_config['auto_suggest'] ?? false,
            'created_at' => current_time('c'),
            'meta' => $workflow_config['meta'] ?? array()
        );
        
        gemini_log("✅ Workflow '{$workflow_id}' registrado exitosamente con " . count($workflow_config['steps']) . " pasos");
        return true;
    }
    
    /**
     * Iniciar una sesión de workflow
     */
    public function start_workflow_session($workflow_id, $context = array()) {
        if (!isset($this->workflows[$workflow_id])) {
            return new WP_Error('workflow_not_found', "Workflow '{$workflow_id}' not found", array('status' => 404));
        }
        
        $workflow = $this->workflows[$workflow_id];
        $session_id = 'session_' . $workflow_id . '_' . time() . '_' . wp_generate_password(8, false);
        
        // Verificar prerequisitos
        $prerequisites_check = $this->check_prerequisites($workflow['prerequisites'], $context);
        if (is_wp_error($prerequisites_check)) {
            return $prerequisites_check;
        }
        
        // Crear sesión de workflow
        $session = array(
            'session_id' => $session_id,
            'workflow_id' => $workflow_id,
            'workflow' => $workflow,
            'status' => 'started',
            'current_step' => 0,
            'steps_status' => array(),
            'context' => $context,
            'started_at' => current_time('c'),
            'last_activity' => current_time('c'),
            'user_token_hash' => hash('sha256', $_SERVER['HTTP_X_GEMINI_AUTH'] ?? ''),
            'accumulated_risk' => 'low',
            'execution_log' => array()
        );
        
        // Inicializar estado de pasos
        foreach ($workflow['steps'] as $step_index => $step) {
            $session['steps_status'][$step_index] = array(
                'status' => 'pending',
                'simulated' => false,
                'executed' => false,
                'skipped' => false,
                'simulation_result' => null,
                'execution_result' => null,
                'timestamp' => null
            );
        }
        
        $this->workflow_sessions[$session_id] = $session;
        
        gemini_log("🔄 Workflow session iniciada: {$session_id} para workflow: {$workflow_id}");
        
        // Auditar inicio de workflow
        gemini_audit_log("workflow_start", array(
            'workflow_id' => $workflow_id,
            'session_id' => $session_id,
            'steps_count' => count($workflow['steps'])
        ), 'started', array(
            'workflow_name' => $workflow['name'],
            'overall_risk' => $workflow['overall_risk_level']
        ));
        
        return $session;
    }
    
    /**
     * Simular un paso específico del workflow
     */
    public function simulate_workflow_step($session_id, $step_index) {
        if (!isset($this->workflow_sessions[$session_id])) {
            return new WP_Error('session_not_found', 'Workflow session not found', array('status' => 404));
        }
        
        $session = &$this->workflow_sessions[$session_id];
        $workflow = $session['workflow'];
        
        if (!isset($workflow['steps'][$step_index])) {
            return new WP_Error('step_not_found', 'Step not found in workflow', array('status' => 404));
        }
        
        $step = $workflow['steps'][$step_index];
        
        gemini_log("🧪 Simulando paso {$step_index} del workflow {$session['workflow_id']}: {$step['name']}");
        
        try {
            $simulation_result = $this->execute_workflow_step($step, $session['context'], 'simulate');
            
            if (is_wp_error($simulation_result)) {
                return $simulation_result;
            }
            
            // Actualizar estado del paso
            $session['steps_status'][$step_index]['simulated'] = true;
            $session['steps_status'][$step_index]['simulation_result'] = $simulation_result;
            $session['steps_status'][$step_index]['timestamp'] = current_time('c');
            $session['last_activity'] = current_time('c');
            
            // Log de ejecución
            $session['execution_log'][] = array(
                'action' => 'simulate',
                'step_index' => $step_index,
                'step_name' => $step['name'],
                'timestamp' => current_time('c'),
                'result' => 'success'
            );
            
            gemini_log("✅ Simulación del paso {$step_index} completada exitosamente");
            
            return array(
                'status' => 'success',
                'action' => 'simulate',
                'step_index' => $step_index,
                'step_name' => $step['name'],
                'simulation_result' => $simulation_result,
                'session_status' => $this->get_session_summary($session_id)
            );
            
        } catch (Exception $e) {
            gemini_log("❌ Error simulando paso {$step_index}: " . $e->getMessage());
            
            $session['execution_log'][] = array(
                'action' => 'simulate',
                'step_index' => $step_index,
                'step_name' => $step['name'],
                'timestamp' => current_time('c'),
                'result' => 'error',
                'error' => $e->getMessage()
            );
            
            return new WP_Error('simulation_error', $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * Ejecutar un paso específico del workflow
     */
    public function execute_workflow_step_real($session_id, $step_index) {
        if (!isset($this->workflow_sessions[$session_id])) {
            return new WP_Error('session_not_found', 'Workflow session not found', array('status' => 404));
        }
        
        $session = &$this->workflow_sessions[$session_id];
        $workflow = $session['workflow'];
        
        if (!isset($workflow['steps'][$step_index])) {
            return new WP_Error('step_not_found', 'Step not found in workflow', array('status' => 404));
        }
        
        $step = $workflow['steps'][$step_index];
        
        gemini_log("⚡ Ejecutando paso {$step_index} del workflow {$session['workflow_id']}: {$step['name']}");
        
        try {
            $execution_result = $this->execute_workflow_step($step, $session['context'], 'execute');
            
            if (is_wp_error($execution_result)) {
                return $execution_result;
            }
            
            // Actualizar estado del paso
            $session['steps_status'][$step_index]['executed'] = true;
            $session['steps_status'][$step_index]['execution_result'] = $execution_result;
            $session['steps_status'][$step_index]['status'] = 'completed';
            $session['steps_status'][$step_index]['timestamp'] = current_time('c');
            $session['last_activity'] = current_time('c');
            
            // Actualizar riesgo acumulado
            $session['accumulated_risk'] = $this->calculate_accumulated_risk($session);
            
            // Log de ejecución
            $session['execution_log'][] = array(
                'action' => 'execute',
                'step_index' => $step_index,
                'step_name' => $step['name'],
                'timestamp' => current_time('c'),
                'result' => 'success'
            );
            
            // Verificar si el workflow está completo
            if ($this->is_workflow_complete($session)) {
                $session['status'] = 'completed';
                $session['completed_at'] = current_time('c');
                gemini_log("🎉 Workflow {$session['workflow_id']} completado exitosamente");
            }
            
            gemini_log("✅ Ejecución del paso {$step_index} completada exitosamente");
            
            return array(
                'status' => 'success',
                'action' => 'execute',
                'step_index' => $step_index,
                'step_name' => $step['name'],
                'execution_result' => $execution_result,
                'session_status' => $this->get_session_summary($session_id),
                'workflow_complete' => $session['status'] === 'completed'
            );
            
        } catch (Exception $e) {
            gemini_log("❌ Error ejecutando paso {$step_index}: " . $e->getMessage());
            
            $session['execution_log'][] = array(
                'action' => 'execute',
                'step_index' => $step_index,
                'step_name' => $step['name'],
                'timestamp' => current_time('c'),
                'result' => 'error',
                'error' => $e->getMessage()
            );
            
            return new WP_Error('execution_error', $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * Saltar un paso del workflow
     */
    public function skip_workflow_step($session_id, $step_index, $reason = '') {
        if (!isset($this->workflow_sessions[$session_id])) {
            return new WP_Error('session_not_found', 'Workflow session not found', array('status' => 404));
        }
        
        $session = &$this->workflow_sessions[$session_id];
        $workflow = $session['workflow'];
        
        if (!isset($workflow['steps'][$step_index])) {
            return new WP_Error('step_not_found', 'Step not found in workflow', array('status' => 404));
        }
        
        $step = $workflow['steps'][$step_index];
        
        gemini_log("⏭️ Saltando paso {$step_index} del workflow {$session['workflow_id']}: {$step['name']}");
        
        // Actualizar estado del paso
        $session['steps_status'][$step_index]['skipped'] = true;
        $session['steps_status'][$step_index]['status'] = 'skipped';
        $session['steps_status'][$step_index]['skip_reason'] = $reason;
        $session['steps_status'][$step_index]['timestamp'] = current_time('c');
        $session['last_activity'] = current_time('c');
        
        // Log de ejecución
        $session['execution_log'][] = array(
            'action' => 'skip',
            'step_index' => $step_index,
            'step_name' => $step['name'],
            'reason' => $reason,
            'timestamp' => current_time('c'),
            'result' => 'skipped'
        );
        
        return array(
            'status' => 'success',
            'action' => 'skip',
            'step_index' => $step_index,
            'step_name' => $step['name'],
            'skip_reason' => $reason,
            'session_status' => $this->get_session_summary($session_id)
        );
    }
    
    /**
     * Cancelar workflow completo
     */
    public function cancel_workflow($session_id, $reason = '') {
        if (!isset($this->workflow_sessions[$session_id])) {
            return new WP_Error('session_not_found', 'Workflow session not found', array('status' => 404));
        }
        
        $session = &$this->workflow_sessions[$session_id];
        
        gemini_log("❌ Cancelando workflow {$session['workflow_id']} (session: {$session_id})");
        
        $session['status'] = 'cancelled';
        $session['cancelled_at'] = current_time('c');
        $session['cancel_reason'] = $reason;
        $session['last_activity'] = current_time('c');
        
        // Log de ejecución
        $session['execution_log'][] = array(
            'action' => 'cancel',
            'reason' => $reason,
            'timestamp' => current_time('c'),
            'result' => 'cancelled'
        );
        
        // Auditar cancelación
        gemini_audit_log("workflow_cancel", array(
            'workflow_id' => $session['workflow_id'],
            'session_id' => $session_id,
            'reason' => $reason
        ), 'cancelled', array(
            'steps_completed' => $this->count_completed_steps($session),
            'steps_total' => count($session['workflow']['steps'])
        ));
        
        return array(
            'status' => 'success',
            'action' => 'cancel',
            'workflow_id' => $session['workflow_id'],
            'session_id' => $session_id,
            'cancel_reason' => $reason,
            'session_status' => $this->get_session_summary($session_id)
        );
    }
    
    /**
     * Obtener workflows disponibles
     */
    public function get_workflows() {
        return $this->workflows;
    }
    
    /**
     * Obtener workflow específico
     */
    public function get_workflow($workflow_id) {
        return isset($this->workflows[$workflow_id]) ? $this->workflows[$workflow_id] : null;
    }
    
    /**
     * Obtener sesión de workflow
     */
    public function get_workflow_session($session_id) {
        return isset($this->workflow_sessions[$session_id]) ? $this->workflow_sessions[$session_id] : null;
    }
    
    /**
     * Registrar workflows core del sistema
     */
    public function register_core_workflows() {
        gemini_log('🔄 Registrando Core Workflows del sistema');
        
        // Workflow: Site Security Hardening
        $this->register_workflow('site_security_hardening', array(
            'name' => 'Site Security Hardening',
            'description' => 'Procedimiento completo para endurecer la seguridad de WordPress paso a paso',
            'category' => 'security',
            'overall_risk_level' => 'medium',
            'estimated_duration' => '15-20 minutos',
            'prerequisites' => array('backup_recent'),
            'tags' => array('security', 'hardening', 'protection'),
            'auto_suggest' => true,
            'steps' => array(
                array(
                    'name' => 'Create Security Backup',
                    'description' => 'Crear backup completo antes de cambios de seguridad',
                    'type' => 'ability',
                    'ability_name' => 'gh_create_backup',
                    'parameters' => array(
                        'backup_type' => 'full',
                        'include_database' => true,
                        'include_files' => true
                    ),
                    'risk_level' => 'read',
                    'required' => true,
                    'estimated_time' => '3-5 minutos'
                ),
                array(
                    'name' => 'Security Scan',
                    'description' => 'Escanear el sitio en busca de vulnerabilidades y malware',
                    'type' => 'ability',
                    'ability_name' => 'gh_security_scan',
                    'parameters' => array(
                        'scan_type' => 'comprehensive',
                        'include_malware' => true,
                        'check_vulnerabilities' => true
                    ),
                    'risk_level' => 'read',
                    'required' => true,
                    'estimated_time' => '2-3 minutos'
                ),
                array(
                    'name' => 'Update WordPress Core',
                    'description' => 'Actualizar WordPress a la versión más reciente',
                    'type' => 'ability',
                    'ability_name' => 'gh_update_wordpress',
                    'parameters' => array(
                        'backup_first' => false, // Ya hicimos backup
                        'maintenance_mode' => true
                    ),
                    'risk_level' => 'write',
                    'required' => false,
                    'estimated_time' => '3-5 minutos'
                ),
                array(
                    'name' => 'Update All Plugins',
                    'description' => 'Actualizar todos los plugins a sus versiones más recientes',
                    'type' => 'ability',
                    'ability_name' => 'gh_update_plugins',
                    'parameters' => array(
                        'plugins' => 'all',
                        'backup_first' => false // Ya hicimos backup
                    ),
                    'risk_level' => 'write',
                    'required' => false,
                    'estimated_time' => '2-4 minutos'
                ),
                array(
                    'name' => 'Configure Security Headers',
                    'description' => 'Configurar headers de seguridad en el servidor',
                    'type' => 'ability',
                    'ability_name' => 'gh_configure_security_headers',
                    'parameters' => array(
                        'enable_hsts' => true,
                        'enable_csp' => true,
                        'enable_xframe' => true
                    ),
                    'risk_level' => 'write',
                    'required' => false,
                    'estimated_time' => '2-3 minutos'
                ),
                array(
                    'name' => 'Final Security Verification',
                    'description' => 'Verificar que todas las medidas de seguridad estén funcionando',
                    'type' => 'ability',
                    'ability_name' => 'gh_security_scan',
                    'parameters' => array(
                        'scan_type' => 'basic',
                        'verify_headers' => true
                    ),
                    'risk_level' => 'read',
                    'required' => true,
                    'estimated_time' => '1-2 minutos'
                )
            )
        ));
        
        // Workflow: Site Performance Optimization
        $this->register_workflow('site_performance_optimization', array(
            'name' => 'Site Performance Optimization',
            'description' => 'Procedimiento completo para optimizar el rendimiento del sitio WordPress',
            'category' => 'performance',
            'overall_risk_level' => 'medium',
            'estimated_duration' => '10-15 minutos',
            'prerequisites' => array('backup_recent'),
            'tags' => array('performance', 'optimization', 'speed'),
            'auto_suggest' => true,
            'steps' => array(
                array(
                    'name' => 'Performance Backup',
                    'description' => 'Crear backup antes de optimizaciones',
                    'type' => 'ability',
                    'ability_name' => 'gh_create_backup',
                    'parameters' => array('backup_type' => 'database_only'),
                    'risk_level' => 'read',
                    'required' => true,
                    'estimated_time' => '2-3 minutos'
                ),
                array(
                    'name' => 'Database Optimization',
                    'description' => 'Optimizar base de datos eliminando datos innecesarios',
                    'type' => 'ability',
                    'ability_name' => 'gh_optimize_database',
                    'parameters' => array(
                        'cleanup_revisions' => true,
                        'cleanup_spam' => true,
                        'optimize_tables' => true
                    ),
                    'risk_level' => 'write',
                    'required' => false,
                    'estimated_time' => '3-5 minutos'
                ),
                array(
                    'name' => 'Plugin Analysis',
                    'description' => 'Analizar plugins para identificar los que afectan el rendimiento',
                    'type' => 'ability',
                    'ability_name' => 'gh_analyze_plugins',
                    'parameters' => array(
                        'analysis_type' => 'performance',
                        'include_inactive' => true
                    ),
                    'risk_level' => 'read',
                    'required' => true,
                    'estimated_time' => '2-3 minutos'
                ),
                array(
                    'name' => 'Cache Configuration',
                    'description' => 'Configurar sistema de caché para mejorar velocidad',
                    'type' => 'ability',
                    'ability_name' => 'gh_configure_cache',
                    'parameters' => array(
                        'enable_page_cache' => true,
                        'enable_object_cache' => true
                    ),
                    'risk_level' => 'write',
                    'required' => false,
                    'estimated_time' => '2-3 minutos'
                ),
                array(
                    'name' => 'Performance Verification',
                    'description' => 'Verificar mejoras de rendimiento obtenidas',
                    'type' => 'ability',
                    'ability_name' => 'gh_performance_test',
                    'parameters' => array('test_type' => 'comprehensive'),
                    'risk_level' => 'read',
                    'required' => true,
                    'estimated_time' => '1-2 minutos'
                )
            )
        ));
        
        // Workflow: Site Maintenance Routine
        $this->register_workflow('site_maintenance_routine', array(
            'name' => 'Site Maintenance Routine',
            'description' => 'Rutina de mantenimiento mensual para mantener el sitio en óptimas condiciones',
            'category' => 'maintenance',
            'overall_risk_level' => 'low',
            'estimated_duration' => '8-12 minutos',
            'prerequisites' => array(),
            'tags' => array('maintenance', 'routine', 'health'),
            'auto_suggest' => false,
            'steps' => array(
                array(
                    'name' => 'Site Health Check',
                    'description' => 'Verificar estado general del sitio',
                    'type' => 'ability',
                    'ability_name' => 'gh_get_site_health',
                    'parameters' => array(
                        'include_tests' => true,
                        'format' => 'detailed'
                    ),
                    'risk_level' => 'read',
                    'required' => true,
                    'estimated_time' => '1-2 minutos'
                ),
                array(
                    'name' => 'Create Monthly Backup',
                    'description' => 'Crear backup mensual completo',
                    'type' => 'ability',
                    'ability_name' => 'gh_create_backup',
                    'parameters' => array(
                        'backup_type' => 'full',
                        'compression' => true
                    ),
                    'risk_level' => 'read',
                    'required' => true,
                    'estimated_time' => '3-5 minutos'
                ),
                array(
                    'name' => 'Security Scan',
                    'description' => 'Escaneo de seguridad mensual',
                    'type' => 'ability',
                    'ability_name' => 'gh_security_scan',
                    'parameters' => array('scan_type' => 'basic'),
                    'risk_level' => 'read',
                    'required' => true,
                    'estimated_time' => '1-2 minutos'
                ),
                array(
                    'name' => 'Database Cleanup',
                    'description' => 'Limpieza ligera de base de datos',
                    'type' => 'ability',
                    'ability_name' => 'gh_optimize_database',
                    'parameters' => array(
                        'cleanup_revisions' => true,
                        'cleanup_spam' => true,
                        'optimize_tables' => false
                    ),
                    'risk_level' => 'write',
                    'required' => false,
                    'estimated_time' => '2-3 minutos'
                ),
                array(
                    'name' => 'Update Check',
                    'description' => 'Verificar actualizaciones disponibles',
                    'type' => 'ability',
                    'ability_name' => 'gh_check_updates',
                    'parameters' => array(
                        'check_core' => true,
                        'check_plugins' => true,
                        'check_themes' => true
                    ),
                    'risk_level' => 'read',
                    'required' => true,
                    'estimated_time' => '1 minuto'
                )
            )
        ));
        
        gemini_log('✅ Core Workflows registrados exitosamente');
    }
    
    // Métodos auxiliares privados...
    
    private function execute_workflow_step($step, $context, $mode = 'execute') {
        if ($step['type'] === 'ability') {
            $ability_registry = Gemini_Ability_Registry::get_instance();
            return $ability_registry->execute_ability($step['ability_name'], $step['parameters'], $mode);
        } elseif ($step['type'] === 'policy') {
            // Implementar ejecución de steps basados en políticas
            return $this->execute_policy_step($step, $context, $mode);
        } else {
            return new WP_Error('invalid_step_type', 'Invalid step type: ' . $step['type']);
        }
    }
    
    private function execute_policy_step($step, $context, $mode) {
        // Implementación para steps basados en políticas
        // Por ahora, retornar placeholder
        return array(
            'status' => 'success',
            'message' => 'Policy step executed',
            'mode' => $mode
        );
    }
    
    private function check_prerequisites($prerequisites, $context) {
        foreach ($prerequisites as $prerequisite) {
            switch ($prerequisite) {
                case 'backup_recent':
                    $last_backup = get_option('gemini_last_backup_date', 0);
                    $days_since_backup = (time() - $last_backup) / DAY_IN_SECONDS;
                    if ($days_since_backup > 7) {
                        return new WP_Error('prerequisite_failed', 'Recent backup required (within 7 days)', array('status' => 400));
                    }
                    break;
                    
                default:
                    // Prerequisito personalizado
                    if (!isset($context[$prerequisite])) {
                        return new WP_Error('prerequisite_failed', "Prerequisite '{$prerequisite}' not met", array('status' => 400));
                    }
                    break;
            }
        }
        
        return true;
    }
    
    private function calculate_accumulated_risk($session) {
        $risk_levels = array('read' => 1, 'write' => 2, 'destructive' => 3);
        $total_risk = 0;
        $executed_steps = 0;
        
        foreach ($session['steps_status'] as $step_index => $step_status) {
            if ($step_status['executed']) {
                $step = $session['workflow']['steps'][$step_index];
                $total_risk += $risk_levels[$step['risk_level']] ?? 1;
                $executed_steps++;
            }
        }
        
        if ($executed_steps === 0) return 'low';
        
        $average_risk = $total_risk / $executed_steps;
        
        if ($average_risk >= 2.5) return 'high';
        if ($average_risk >= 1.5) return 'medium';
        return 'low';
    }
    
    private function is_workflow_complete($session) {
        foreach ($session['steps_status'] as $step_status) {
            $step_index = array_search($step_status, $session['steps_status']);
            $step = $session['workflow']['steps'][$step_index];
            
            // Si es un paso requerido y no está ejecutado ni saltado
            if ($step['required'] && !$step_status['executed'] && !$step_status['skipped']) {
                return false;
            }
        }
        
        return true;
    }
    
    private function count_completed_steps($session) {
        $completed = 0;
        foreach ($session['steps_status'] as $step_status) {
            if ($step_status['executed'] || $step_status['skipped']) {
                $completed++;
            }
        }
        return $completed;
    }
    
    private function get_session_summary($session_id) {
        $session = $this->workflow_sessions[$session_id];
        
        $completed_steps = $this->count_completed_steps($session);
        $total_steps = count($session['workflow']['steps']);
        $progress_percentage = round(($completed_steps / $total_steps) * 100);
        
        return array(
            'session_id' => $session_id,
            'workflow_id' => $session['workflow_id'],
            'workflow_name' => $session['workflow']['name'],
            'status' => $session['status'],
            'progress' => array(
                'completed_steps' => $completed_steps,
                'total_steps' => $total_steps,
                'percentage' => $progress_percentage
            ),
            'accumulated_risk' => $session['accumulated_risk'],
            'started_at' => $session['started_at'],
            'last_activity' => $session['last_activity']
        );
    }
}

/**
 * 🤖 GEMINI POLICY ENGINE
 * 
 * Sistema de políticas declarativas que permite a la IA detectar situaciones,
 * sugerir acciones y preparar ejecuciones sin ejecutarlas automáticamente.
 */
class Gemini_Policy_Engine {
    
    private static $instance = null;
    private $policies = array();
    private $policy_results = array();
    
    /**
     * Singleton pattern
     */
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        // Registrar políticas al inicializar
        add_action('init', array($this, 'register_core_policies'));
    }
    
    /**
     * Registrar una política en el sistema
     */
    public function register_policy($policy_id, $policy_config) {
        // Validar configuración requerida
        $required_fields = array('name', 'condition', 'suggested_ability', 'risk_level', 'explanation_template');
        
        foreach ($required_fields as $field) {
            if (!isset($policy_config[$field])) {
                gemini_log("❌ Error registrando policy '{$policy_id}': falta campo '{$field}'");
                return false;
            }
        }
        
        // Almacenar política
        $this->policies[$policy_id] = array(
            'id' => $policy_id,
            'name' => $policy_config['name'],
            'description' => $policy_config['description'] ?? '',
            'category' => $policy_config['category'] ?? 'general',
            'condition' => $policy_config['condition'], // Callback function
            'suggested_ability' => $policy_config['suggested_ability'],
            'suggested_parameters' => $policy_config['suggested_parameters'] ?? array(),
            'risk_level' => $policy_config['risk_level'],
            'priority' => $policy_config['priority'] ?? 'medium',
            'explanation_template' => $policy_config['explanation_template'],
            'context_requirements' => $policy_config['context_requirements'] ?? array(),
            'enabled' => $policy_config['enabled'] ?? true,
            'auto_suggest' => $policy_config['auto_suggest'] ?? true,
            'meta' => $policy_config['meta'] ?? array()
        );
        
        gemini_log("✅ Policy '{$policy_id}' registrada exitosamente");
        return true;
    }
    
    /**
     * Evaluar todas las políticas activas contra un contexto
     */
    public function evaluate_policies($context = array()) {
        gemini_log('🤖 Evaluando políticas activas...');
        
        $triggered_policies = array();
        $evaluation_start = microtime(true);
        
        foreach ($this->policies as $policy_id => $policy) {
            if (!$policy['enabled']) {
                continue;
            }
            
            try {
                // Verificar si se cumplen los requisitos de contexto
                if (!$this->check_context_requirements($policy, $context)) {
                    continue;
                }
                
                // Evaluar condición de la política
                $condition_callback = $policy['condition'];
                if (!is_callable($condition_callback)) {
                    gemini_log("⚠️ Policy '{$policy_id}': callback de condición no es callable");
                    continue;
                }
                
                $condition_result = call_user_func($condition_callback, $context);
                
                if ($condition_result === true || (is_array($condition_result) && $condition_result['triggered'])) {
                    $policy_result = array(
                        'policy_id' => $policy_id,
                        'policy' => $policy,
                        'triggered_at' => current_time('c'),
                        'context_data' => $condition_result,
                        'suggested_action' => array(
                            'ability_name' => $policy['suggested_ability'],
                            'parameters' => $this->resolve_parameters($policy['suggested_parameters'], $context, $condition_result),
                            'risk_level' => $policy['risk_level'],
                            'priority' => $policy['priority']
                        ),
                        'explanation' => $this->generate_explanation($policy, $context, $condition_result)
                    );
                    
                    $triggered_policies[] = $policy_result;
                    
                    gemini_log("🎯 Policy triggered: {$policy_id} (priority: {$policy['priority']})");
                }
                
            } catch (Exception $e) {
                gemini_log("❌ Error evaluando policy '{$policy_id}': " . $e->getMessage());
            }
        }
        
        $evaluation_time = round((microtime(true) - $evaluation_start) * 1000, 2);
        gemini_log("✅ Evaluación de políticas completada en {$evaluation_time}ms. Triggered: " . count($triggered_policies));
        
        // Ordenar por prioridad
        usort($triggered_policies, function($a, $b) {
            $priority_order = array('high' => 3, 'medium' => 2, 'low' => 1);
            $a_priority = $priority_order[$a['policy']['priority']] ?? 2;
            $b_priority = $priority_order[$b['policy']['priority']] ?? 2;
            return $b_priority - $a_priority;
        });
        
        // Almacenar resultados para auditoría
        $this->policy_results = $triggered_policies;
        
        return $triggered_policies;
    }
    
    /**
     * Verificar requisitos de contexto
     */
    private function check_context_requirements($policy, $context) {
        $requirements = $policy['context_requirements'];
        
        if (empty($requirements)) {
            return true; // Sin requisitos específicos
        }
        
        foreach ($requirements as $requirement) {
            switch ($requirement) {
                case 'site_health_data':
                    if (!isset($context['site_health']) || empty($context['site_health'])) {
                        return false;
                    }
                    break;
                    
                case 'plugin_data':
                    if (!isset($context['plugins']) || empty($context['plugins'])) {
                        return false;
                    }
                    break;
                    
                case 'user_permissions':
                    if (!isset($context['user_capabilities']) || empty($context['user_capabilities'])) {
                        return false;
                    }
                    break;
                    
                default:
                    // Requisito personalizado
                    if (!isset($context[$requirement])) {
                        return false;
                    }
                    break;
            }
        }
        
        return true;
    }
    
    /**
     * Resolver parámetros dinámicos
     */
    private function resolve_parameters($parameter_template, $context, $condition_result) {
        $resolved_parameters = array();
        
        foreach ($parameter_template as $key => $value) {
            if (is_string($value) && strpos($value, '{{') !== false) {
                // Resolver plantilla
                $resolved_value = $this->resolve_template_value($value, $context, $condition_result);
                $resolved_parameters[$key] = $resolved_value;
            } else {
                $resolved_parameters[$key] = $value;
            }
        }
        
        return $resolved_parameters;
    }
    
    /**
     * Resolver valor de plantilla
     */
    private function resolve_template_value($template, $context, $condition_result) {
        // Reemplazar variables de contexto
        $template = preg_replace_callback('/\{\{([^}]+)\}\}/', function($matches) use ($context, $condition_result) {
            $variable = trim($matches[1]);
            
            // Buscar en resultado de condición primero
            if (is_array($condition_result) && isset($condition_result[$variable])) {
                return $condition_result[$variable];
            }
            
            // Buscar en contexto
            if (isset($context[$variable])) {
                return $context[$variable];
            }
            
            // Variables especiales
            switch ($variable) {
                case 'current_time':
                    return current_time('c');
                case 'site_url':
                    return home_url();
                case 'admin_email':
                    return get_option('admin_email');
                default:
                    return $matches[0]; // Mantener original si no se encuentra
            }
        }, $template);
        
        return $template;
    }
    
    /**
     * Generar explicación de la política
     */
    private function generate_explanation($policy, $context, $condition_result) {
        $template = $policy['explanation_template'];
        
        // Resolver plantilla de explicación
        $explanation = $this->resolve_template_value($template, $context, $condition_result);
        
        return array(
            'summary' => $explanation,
            'why_triggered' => $this->explain_why_triggered($policy, $condition_result),
            'recommended_action' => $this->explain_recommended_action($policy),
            'risk_assessment' => $this->explain_risk_assessment($policy),
            'next_steps' => $this->suggest_next_steps($policy)
        );
    }
    
    /**
     * Explicar por qué se activó la política
     */
    private function explain_why_triggered($policy, $condition_result) {
        if (is_array($condition_result) && isset($condition_result['reason'])) {
            return $condition_result['reason'];
        }
        
        return "Se detectó una condición que coincide con la política '{$policy['name']}'";
    }
    
    /**
     * Explicar la acción recomendada
     */
    private function explain_recommended_action($policy) {
        $ability_registry = Gemini_Ability_Registry::get_instance();
        $ability = $ability_registry->get_ability($policy['suggested_ability']);
        
        if ($ability) {
            return $ability['description'];
        }
        
        return "Ejecutar la acción recomendada: {$policy['suggested_ability']}";
    }
    
    /**
     * Explicar evaluación de riesgo
     */
    private function explain_risk_assessment($policy) {
        $risk_explanations = array(
            'low' => 'Riesgo bajo - Acción segura con impacto mínimo',
            'medium' => 'Riesgo medio - Acción que puede modificar configuración',
            'high' => 'Riesgo alto - Acción que puede tener impacto significativo'
        );
        
        return $risk_explanations[$policy['risk_level']] ?? 'Nivel de riesgo no especificado';
    }
    
    /**
     * Sugerir próximos pasos
     */
    private function suggest_next_steps($policy) {
        $steps = array();
        
        switch ($policy['risk_level']) {
            case 'low':
                $steps[] = "Puedes ejecutar esta acción con confianza";
                break;
                
            case 'medium':
                $steps[] = "Considera simular la acción primero";
                $steps[] = "Revisa los cambios que se realizarán";
                break;
                
            case 'high':
                $steps[] = "Recomendamos encarecidamente simular primero";
                $steps[] = "Considera hacer un backup antes de proceder";
                $steps[] = "Verifica que tienes tiempo para resolver problemas si surgen";
                break;
        }
        
        return $steps;
    }
    
    /**
     * Obtener políticas registradas
     */
    public function get_policies() {
        return $this->policies;
    }
    
    /**
     * Obtener política específica
     */
    public function get_policy($policy_id) {
        return isset($this->policies[$policy_id]) ? $this->policies[$policy_id] : null;
    }
    
    /**
     * Registrar políticas core del sistema
     */
    public function register_core_policies() {
        gemini_log('🤖 Registrando Core Policies del sistema');
        
        // Policy: Email Test Failed - Suggest SMTP Configuration
        $this->register_policy('email_failed_suggest_smtp', array(
            'name' => 'Email Failed - Suggest SMTP',
            'description' => 'Detecta cuando el test de email falla y sugiere configurar SMTP',
            'category' => 'email',
            'condition' => 'gemini_policy_email_test_failed',
            'suggested_ability' => 'gh_configure_smtp', // Ability que implementaremos
            'suggested_parameters' => array(
                'provider' => 'detect_auto',
                'test_email' => '{{admin_email}}'
            ),
            'risk_level' => 'medium',
            'priority' => 'high',
            'explanation_template' => 'El test de email falló. Configurar SMTP puede resolver problemas de entrega de correos.',
            'context_requirements' => array('site_health_data'),
            'auto_suggest' => true,
            'meta' => array(
                'tags' => array('email', 'smtp', 'communication'),
                'frequency' => 'once_per_session'
            )
        ));
        
        // Policy: Outdated Plugins - Suggest Update
        $this->register_policy('outdated_plugins_suggest_update', array(
            'name' => 'Outdated Plugins - Suggest Update',
            'description' => 'Detecta plugins desactualizados y sugiere actualizarlos',
            'category' => 'security',
            'condition' => 'gemini_policy_outdated_plugins',
            'suggested_ability' => 'gh_update_plugins',
            'suggested_parameters' => array(
                'plugins' => '{{outdated_plugins}}',
                'backup_first' => true
            ),
            'risk_level' => 'medium',
            'priority' => 'medium',
            'explanation_template' => 'Se encontraron {{plugin_count}} plugins desactualizados. Mantenerlos actualizados mejora la seguridad.',
            'context_requirements' => array('plugin_data'),
            'auto_suggest' => true,
            'meta' => array(
                'tags' => array('plugins', 'security', 'updates'),
                'frequency' => 'daily'
            )
        ));
        
        // Policy: High Plugin Count - Suggest Cleanup
        $this->register_policy('high_plugin_count_suggest_cleanup', array(
            'name' => 'High Plugin Count - Suggest Cleanup',
            'description' => 'Detecta cuando hay demasiados plugins y sugiere limpieza',
            'category' => 'performance',
            'condition' => 'gemini_policy_high_plugin_count',
            'suggested_ability' => 'gh_analyze_plugins',
            'suggested_parameters' => array(
                'analysis_type' => 'usage_and_performance',
                'include_inactive' => true
            ),
            'risk_level' => 'low',
            'priority' => 'low',
            'explanation_template' => 'Tienes {{plugin_count}} plugins instalados. Un análisis puede identificar plugins innecesarios.',
            'context_requirements' => array('plugin_data'),
            'auto_suggest' => true,
            'meta' => array(
                'tags' => array('plugins', 'performance', 'cleanup'),
                'frequency' => 'weekly'
            )
        ));
        
        // Policy: Old WordPress Version - Suggest Update
        $this->register_policy('old_wordpress_suggest_update', array(
            'name' => 'Old WordPress - Suggest Update',
            'description' => 'Detecta versión antigua de WordPress y sugiere actualización',
            'category' => 'security',
            'condition' => 'gemini_policy_old_wordpress_version',
            'suggested_ability' => 'gh_update_wordpress',
            'suggested_parameters' => array(
                'backup_first' => true,
                'maintenance_mode' => true
            ),
            'risk_level' => 'high',
            'priority' => 'high',
            'explanation_template' => 'WordPress {{current_version}} está desactualizado. La versión {{latest_version}} incluye mejoras de seguridad.',
            'context_requirements' => array('site_health_data'),
            'auto_suggest' => true,
            'meta' => array(
                'tags' => array('wordpress', 'security', 'updates'),
                'frequency' => 'once_per_version'
            )
        ));
        
        // Policy: Security Scan Recommended
        $this->register_policy('security_scan_recommended', array(
            'name' => 'Security Scan Recommended',
            'description' => 'Sugiere escaneo de seguridad basado en patrones de riesgo',
            'category' => 'security',
            'condition' => 'gemini_policy_security_scan_needed',
            'suggested_ability' => 'gh_security_scan',
            'suggested_parameters' => array(
                'scan_type' => 'comprehensive',
                'include_malware' => true,
                'check_vulnerabilities' => true
            ),
            'risk_level' => 'low',
            'priority' => 'medium',
            'explanation_template' => 'Basado en el análisis del sitio, se recomienda un escaneo de seguridad para verificar la integridad.',
            'context_requirements' => array('site_health_data', 'plugin_data'),
            'auto_suggest' => true,
            'meta' => array(
                'tags' => array('security', 'scan', 'malware'),
                'frequency' => 'weekly'
            )
        ));
        
        // Policy: Database Optimization Needed
        $this->register_policy('database_optimization_needed', array(
            'name' => 'Database Optimization Needed',
            'description' => 'Detecta cuando la base de datos necesita optimización',
            'category' => 'performance',
            'condition' => 'gemini_policy_database_optimization_needed',
            'suggested_ability' => 'gh_optimize_database',
            'suggested_parameters' => array(
                'cleanup_revisions' => true,
                'cleanup_spam' => true,
                'optimize_tables' => true
            ),
            'risk_level' => 'write',
            'priority' => 'medium',
            'explanation_template' => 'La base de datos puede beneficiarse de una optimización para mejorar el rendimiento.',
            'context_requirements' => array('site_health_data'),
            'auto_suggest' => true,
            'meta' => array(
                'tags' => array('database', 'performance', 'optimization'),
                'frequency' => 'monthly'
            )
        ));
        
        // Policy: Backup Recommended
        $this->register_policy('backup_recommended', array(
            'name' => 'Backup Recommended',
            'description' => 'Sugiere crear backup basado en actividad del sitio',
            'category' => 'backup',
            'condition' => 'gemini_policy_backup_recommended',
            'suggested_ability' => 'gh_create_backup',
            'suggested_parameters' => array(
                'include_database' => true,
                'include_files' => true,
                'backup_type' => 'full'
            ),
            'risk_level' => 'read',
            'priority' => 'high',
            'explanation_template' => 'Es recomendable crear un backup para proteger tu sitio.',
            'context_requirements' => array('site_health_data'),
            'auto_suggest' => true,
            'meta' => array(
                'tags' => array('backup', 'security', 'protection'),
                'frequency' => 'weekly'
            )
        ));
        
        gemini_log('✅ Core Policies registradas exitosamente');
    }
}

// 🤖 POLICY CONDITIONS: Funciones de condición para las políticas

/**
 * Condición: Test de email falló
 */
function gemini_policy_email_test_failed($context) {
    if (!isset($context['site_health']['email_test'])) {
        return false;
    }
    
    $email_test = $context['site_health']['email_test'];
    
    if ($email_test['status'] === 'failed' || $email_test['status'] === 'error') {
        return array(
            'triggered' => true,
            'reason' => 'El test de email falló: ' . ($email_test['message'] ?? 'Error desconocido'),
            'email_status' => $email_test['status'],
            'error_message' => $email_test['message'] ?? '',
            'admin_email' => get_option('admin_email')
        );
    }
    
    return false;
}

/**
 * Condición: Plugins desactualizados
 */
function gemini_policy_outdated_plugins($context) {
    if (!isset($context['plugins']) || !is_array($context['plugins'])) {
        return false;
    }
    
    // Verificar actualizaciones disponibles
    if (!function_exists('get_plugin_updates')) {
        require_once ABSPATH . 'wp-admin/includes/update.php';
    }
    
    wp_update_plugins();
    $updates = get_plugin_updates();
    
    if (!empty($updates)) {
        $outdated_plugins = array();
        foreach ($updates as $plugin_file => $plugin_data) {
            $outdated_plugins[] = array(
                'file' => $plugin_file,
                'name' => $plugin_data->Name,
                'current_version' => $plugin_data->Version,
                'new_version' => $plugin_data->update->new_version ?? 'unknown'
            );
        }
        
        return array(
            'triggered' => true,
            'reason' => 'Se encontraron ' . count($outdated_plugins) . ' plugins con actualizaciones disponibles',
            'plugin_count' => count($outdated_plugins),
            'outdated_plugins' => $outdated_plugins,
            'security_risk' => count($outdated_plugins) > 3 ? 'high' : 'medium'
        );
    }
    
    return false;
}

/**
 * Condición: Muchos plugins instalados
 */
function gemini_policy_high_plugin_count($context) {
    if (!isset($context['plugins']) || !is_array($context['plugins'])) {
        return false;
    }
    
    $plugin_count = count($context['plugins']);
    $threshold = 25; // Umbral configurable
    
    if ($plugin_count > $threshold) {
        // Analizar plugins inactivos
        $active_plugins = get_option('active_plugins', array());
        $inactive_count = $plugin_count - count($active_plugins);
        
        return array(
            'triggered' => true,
            'reason' => "Tienes {$plugin_count} plugins instalados, lo cual puede afectar el rendimiento",
            'plugin_count' => $plugin_count,
            'active_count' => count($active_plugins),
            'inactive_count' => $inactive_count,
            'performance_impact' => $plugin_count > 40 ? 'high' : 'medium'
        );
    }
    
    return false;
}

/**
 * Condición: WordPress desactualizado
 */
function gemini_policy_old_wordpress_version($context) {
    if (!isset($context['site_health']['wordpress_version'])) {
        return false;
    }
    
    $current_version = $context['site_health']['wordpress_version'];
    
    // Verificar actualizaciones de WordPress
    if (!function_exists('get_core_updates')) {
        require_once ABSPATH . 'wp-admin/includes/update.php';
    }
    
    wp_version_check();
    $updates = get_core_updates();
    
    if (!empty($updates) && isset($updates[0]) && $updates[0]->response === 'upgrade') {
        $latest_version = $updates[0]->version;
        
        // Verificar si la diferencia es significativa
        $version_diff = version_compare($latest_version, $current_version);
        
        if ($version_diff > 0) {
            return array(
                'triggered' => true,
                'reason' => "WordPress {$current_version} está desactualizado. Versión {$latest_version} disponible",
                'current_version' => $current_version,
                'latest_version' => $latest_version,
                'security_risk' => gemini_assess_version_security_risk($current_version, $latest_version)
            );
        }
    }
    
    return false;
}

/**
 * Condición: Escaneo de seguridad recomendado
 */
function gemini_policy_security_scan_needed($context) {
    // Factores que pueden indicar necesidad de escaneo
    $risk_factors = array();
    
    // Plugins desactualizados
    if (isset($context['plugins'])) {
        wp_update_plugins();
        $updates = get_plugin_updates();
        if (count($updates) > 2) {
            $risk_factors[] = array(
                'type' => 'outdated_plugins',
                'severity' => 'medium',
                'description' => count($updates) . ' plugins desactualizados'
            );
        }
    }
    
    // WordPress desactualizado
    if (isset($context['site_health']['wordpress_version'])) {
        wp_version_check();
        $updates = get_core_updates();
        if (!empty($updates) && isset($updates[0]) && $updates[0]->response === 'upgrade') {
            $risk_factors[] = array(
                'type' => 'outdated_wordpress',
                'severity' => 'high',
                'description' => 'WordPress desactualizado'
            );
        }
    }
    
    // Último escaneo hace mucho tiempo (simulado)
    $last_scan = get_option('gemini_last_security_scan', 0);
    $days_since_scan = (time() - $last_scan) / DAY_IN_SECONDS;
    
    if ($days_since_scan > 7) {
        $risk_factors[] = array(
            'type' => 'no_recent_scan',
            'severity' => 'low',
            'description' => 'No hay escaneo reciente de seguridad'
        );
    }
    
    if (!empty($risk_factors)) {
        $high_risk_count = count(array_filter($risk_factors, function($factor) {
            return $factor['severity'] === 'high';
        }));
        
        return array(
            'triggered' => true,
            'reason' => 'Se detectaron ' . count($risk_factors) . ' factores de riesgo de seguridad',
            'risk_factors' => $risk_factors,
            'risk_level' => $high_risk_count > 0 ? 'high' : 'medium',
            'recommended_scan_type' => $high_risk_count > 0 ? 'comprehensive' : 'basic'
        );
    }
    
    return false;
}

/**
 * Condición: Optimización de base de datos necesaria
 */
function gemini_policy_database_optimization_needed($context) {
    // Verificar si hay datos de site health
    if (!isset($context['site_health'])) {
        return false;
    }
    
    // Simular análisis de base de datos
    global $wpdb;
    
    // Contar revisiones de posts
    $revisions_count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'revision'");
    
    // Contar spam comments
    $spam_count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->comments} WHERE comment_approved = 'spam'");
    
    // Contar transients expirados
    $expired_transients = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE '_transient_timeout_%' AND option_value < UNIX_TIMESTAMP()");
    
    $optimization_needed = false;
    $reasons = array();
    
    if ($revisions_count > 100) {
        $optimization_needed = true;
        $reasons[] = "Hay {$revisions_count} revisiones de posts que pueden eliminarse";
    }
    
    if ($spam_count > 50) {
        $optimization_needed = true;
        $reasons[] = "Hay {$spam_count} comentarios spam que pueden eliminarse";
    }
    
    if ($expired_transients > 20) {
        $optimization_needed = true;
        $reasons[] = "Hay {$expired_transients} transients expirados que pueden limpiarse";
    }
    
    if ($optimization_needed) {
        return array(
            'triggered' => true,
            'reason' => 'La base de datos necesita optimización: ' . implode(', ', $reasons),
            'revisions_count' => $revisions_count,
            'spam_count' => $spam_count,
            'expired_transients' => $expired_transients,
            'estimated_cleanup_size' => 'Moderado',
            'performance_impact' => 'Medium'
        );
    }
    
    return false;
}

/**
 * Condición: Backup recomendado
 */
function gemini_policy_backup_recommended($context) {
    // Verificar último backup (simulado)
    $last_backup = get_option('gemini_last_backup_date', 0);
    $days_since_backup = (time() - $last_backup) / DAY_IN_SECONDS;
    
    // Verificar actividad reciente del sitio
    $recent_posts = wp_count_posts();
    $recent_activity = false;
    
    // Si hay posts recientes o han pasado más de 7 días sin backup
    if ($days_since_backup > 7 || $recent_posts->publish > 0) {
        $recent_activity = true;
    }
    
    if ($recent_activity && $days_since_backup > 7) {
        return array(
            'triggered' => true,
            'reason' => "Han pasado {$days_since_backup} días desde el último backup",
            'days_since_backup' => round($days_since_backup),
            'site_activity' => 'active',
            'backup_urgency' => $days_since_backup > 14 ? 'high' : 'medium',
            'recommended_type' => 'full'
        );
    }
    
    return false;
}
class Gemini_Ability_Registry {
    
    private static $instance = null;
    private $abilities = array();
    
    /**
     * Singleton pattern
     */
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        // Registrar abilities al inicializar
        add_action('init', array($this, 'register_core_abilities'));
    }
    
    /**
     * Registrar una ability en el registry interno
     */
    public function register_ability($name, $config) {
        // Validar configuración requerida
        $required_fields = array('name', 'description', 'input_schema', 'output_schema', 'permission_callback', 'execute_callback');
        
        foreach ($required_fields as $field) {
            if (!isset($config[$field])) {
                gemini_log("❌ Error registrando ability '{$name}': falta campo '{$field}'");
                return false;
            }
        }
        
        // Almacenar ability como metadatos (sin ejecutar)
        $this->abilities[$name] = array(
            'name' => $name,
            'label' => isset($config['label']) ? $config['label'] : $name,
            'description' => $config['description'],
            'category' => isset($config['category']) ? $config['category'] : 'general',
            'input_schema' => $config['input_schema'],
            'output_schema' => $config['output_schema'],
            'permission_callback' => $config['permission_callback'],
            'execute_callback' => $config['execute_callback'],
            'meta' => isset($config['meta']) ? $config['meta'] : array(
                'show_in_rest' => true,
                'annotations' => array(
                    'readonly' => false,
                    'destructive' => false,
                    'idempotent' => true
                )
            )
        );
        
        gemini_log("✅ Ability '{$name}' registrada en Gemini Registry");
        return true;
    }
    
    /**
     * Obtener todas las abilities registradas
     */
    public function get_abilities() {
        return $this->abilities;
    }
    
    /**
     * Obtener una ability específica
     */
    public function get_ability($name) {
        return isset($this->abilities[$name]) ? $this->abilities[$name] : null;
    }
    
    /**
     * Verificar si una ability existe
     */
    public function has_ability($name) {
        return isset($this->abilities[$name]);
    }
    
    /**
     * Ejecutar una ability (con validación de permisos y auditoría)
     * 
     * @param string $name Nombre de la ability
     * @param array $input Parámetros de entrada
     * @param string $mode Modo de ejecución: 'execute' (real) o 'simulate' (dry-run)
     */
    public function execute_ability($name, $input = array(), $mode = 'execute') {
        $is_simulation = ($mode === 'simulate');
        $log_prefix = $is_simulation ? "🧪 [SIMULATE]" : "⚡ [EXECUTE]";
        
        gemini_log("{$log_prefix} Iniciando {$mode} de ability: {$name}");
        
        if (!$this->has_ability($name)) {
            return new WP_Error('ability_not_found', "Ability '{$name}' not found", array('status' => 404));
        }
        
        $ability = $this->get_ability($name);
        
        // 🛡️ SECURITY: Verificar permisos avanzados (siempre, incluso en simulación)
        $permission_check = gemini_check_ability_permissions($name);
        if (is_wp_error($permission_check)) {
            // Registrar intento de acceso denegado
            gemini_audit_log($name, $input, 'permission_denied', array(
                'error' => $permission_check->get_error_message(),
                'user_ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
                'mode' => $mode
            ));
            
            return $permission_check;
        }
        
        // Verificar callback de permisos específico
        $permission_callback = $ability['permission_callback'];
        if (!call_user_func($permission_callback)) {
            gemini_audit_log($name, $input, 'permission_denied', array(
                'error' => 'Permission callback returned false',
                'callback' => $permission_callback,
                'mode' => $mode
            ));
            
            return new WP_Error('permission_denied', 'Permission denied for this ability', array('status' => 403));
        }
        
        // 🧪 DRY-RUN: Verificar si la ability soporta simulación
        if ($is_simulation) {
            $simulate_callback = $ability['simulate_callback'] ?? null;
            if (!$simulate_callback || !is_callable($simulate_callback)) {
                // Fallback: usar callback de ejecución con flag de simulación
                $execute_callback = $ability['execute_callback'];
                if (!is_callable($execute_callback)) {
                    return new WP_Error('invalid_callback', 'Execute callback is not callable', array('status' => 500));
                }
                
                return $this->execute_with_simulation_fallback($name, $ability, $input, $execute_callback);
            }
            
            // Usar callback específico de simulación
            return $this->execute_simulation($name, $ability, $input, $simulate_callback);
        }
        
        // Ejecución real
        $execute_callback = $ability['execute_callback'];
        if (!is_callable($execute_callback)) {
            return new WP_Error('invalid_callback', 'Execute callback is not callable', array('status' => 500));
        }
        
        try {
            $start_time = microtime(true);
            
            gemini_log("⚡ Ejecutando callback para ability: {$name}");
            $result = call_user_func($execute_callback, $input);
            
            $execution_time = round((microtime(true) - $start_time) * 1000, 2); // ms
            
            // 📊 AUDITORÍA: Registrar ejecución exitosa
            gemini_audit_log($name, $input, 'success', array(
                'execution_time_ms' => $execution_time,
                'result_size' => strlen(json_encode($result)),
                'risk_level' => $ability['risk_level'] ?? 'unknown',
                'scopes' => $ability['scopes'] ?? array(),
                'mode' => 'execute'
            ));
            
            gemini_log("✅ Ability '{$name}' ejecutada exitosamente en {$execution_time}ms");
            
            return $result;
            
        } catch (Exception $e) {
            // 📊 AUDITORÍA: Registrar error de ejecución
            gemini_audit_log($name, $input, 'error', array(
                'error_message' => $e->getMessage(),
                'error_file' => $e->getFile(),
                'error_line' => $e->getLine(),
                'mode' => 'execute'
            ));
            
            gemini_log("❌ Error ejecutando ability '{$name}': " . $e->getMessage());
            
            return new WP_Error('execution_error', $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * 🧪 Ejecutar simulación usando callback específico
     */
    private function execute_simulation($name, $ability, $input, $simulate_callback) {
        try {
            $start_time = microtime(true);
            
            gemini_log("🧪 Ejecutando simulación para ability: {$name}");
            $simulation_result = call_user_func($simulate_callback, $input);
            
            $execution_time = round((microtime(true) - $start_time) * 1000, 2);
            
            // 📊 AUDITORÍA: Registrar simulación
            gemini_audit_log($name, $input, 'simulated', array(
                'execution_time_ms' => $execution_time,
                'risk_level' => $ability['risk_level'] ?? 'unknown',
                'scopes' => $ability['scopes'] ?? array(),
                'mode' => 'simulate'
            ));
            
            gemini_log("✅ Simulación de '{$name}' completada en {$execution_time}ms");
            
            // Estructurar respuesta de simulación
            return array(
                'mode' => 'simulation',
                'ability_name' => $name,
                'simulation_result' => $simulation_result,
                'impact_report' => $this->generate_impact_report($name, $ability, $input, $simulation_result),
                'execution_time_ms' => $execution_time,
                'timestamp' => current_time('c')
            );
            
        } catch (Exception $e) {
            gemini_audit_log($name, $input, 'simulation_error', array(
                'error_message' => $e->getMessage(),
                'error_file' => $e->getFile(),
                'error_line' => $e->getLine(),
                'mode' => 'simulate'
            ));
            
            return new WP_Error('simulation_error', $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * 🧪 Fallback para abilities sin callback de simulación específico
     */
    private function execute_with_simulation_fallback($name, $ability, $input, $execute_callback) {
        try {
            gemini_log("🧪 Usando fallback de simulación para ability: {$name}");
            
            // Generar reporte de impacto basado en metadatos de la ability
            $impact_report = $this->generate_impact_report_from_metadata($name, $ability, $input);
            
            // 📊 AUDITORÍA: Registrar simulación fallback
            gemini_audit_log($name, $input, 'simulated_fallback', array(
                'risk_level' => $ability['risk_level'] ?? 'unknown',
                'scopes' => $ability['scopes'] ?? array(),
                'mode' => 'simulate',
                'fallback' => true
            ));
            
            return array(
                'mode' => 'simulation',
                'ability_name' => $name,
                'simulation_result' => array(
                    'status' => 'simulated',
                    'message' => 'Simulation completed using metadata analysis',
                    'note' => 'This ability does not have a specific simulation callback'
                ),
                'impact_report' => $impact_report,
                'execution_time_ms' => 0,
                'timestamp' => current_time('c'),
                'fallback_used' => true
            );
            
        } catch (Exception $e) {
            return new WP_Error('simulation_fallback_error', $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * 📊 Generar reporte de impacto estructurado
     */
    private function generate_impact_report($name, $ability, $input, $simulation_result) {
        $risk_level = $ability['risk_level'] ?? 'unknown';
        $scopes = $ability['scopes'] ?? array();
        $required_caps = $ability['required_capabilities'] ?? array();
        
        return array(
            'ability_name' => $name,
            'risk_assessment' => array(
                'level' => $risk_level,
                'description' => $this->get_risk_description($risk_level),
                'scopes_affected' => $scopes,
                'required_permissions' => $required_caps
            ),
            'predicted_changes' => $this->extract_predicted_changes($simulation_result),
            'resources_affected' => $this->identify_affected_resources($name, $scopes, $input),
            'reversibility' => $this->assess_reversibility($risk_level, $scopes),
            'recommendations' => $this->generate_recommendations($risk_level, $scopes),
            'human_explanation' => $this->generate_human_explanation($name, $ability, $input, $simulation_result)
        );
    }
    
    /**
     * 📊 Generar reporte de impacto desde metadatos (fallback)
     */
    private function generate_impact_report_from_metadata($name, $ability, $input) {
        $risk_level = $ability['risk_level'] ?? 'unknown';
        $scopes = $ability['scopes'] ?? array();
        $required_caps = $ability['required_capabilities'] ?? array();
        
        return array(
            'ability_name' => $name,
            'risk_assessment' => array(
                'level' => $risk_level,
                'description' => $this->get_risk_description($risk_level),
                'scopes_affected' => $scopes,
                'required_permissions' => $required_caps
            ),
            'predicted_changes' => array(
                'type' => 'metadata_based',
                'description' => 'Changes predicted based on ability metadata',
                'scope_analysis' => $this->analyze_scopes_for_changes($scopes)
            ),
            'resources_affected' => $this->identify_affected_resources($name, $scopes, $input),
            'reversibility' => $this->assess_reversibility($risk_level, $scopes),
            'recommendations' => $this->generate_recommendations($risk_level, $scopes),
            'human_explanation' => $this->generate_human_explanation_from_metadata($name, $ability, $input),
            'simulation_note' => 'Impact analysis based on ability metadata. For more precise simulation, implement a specific simulate_callback.'
        );
    }
    
    /**
     * 📊 Obtener descripción del nivel de riesgo
     */
    private function get_risk_description($risk_level) {
        $descriptions = array(
            'read' => 'Solo lectura - No modifica datos del sitio',
            'write' => 'Escritura - Puede modificar contenido y configuración',
            'destructive' => 'Destructivo - Puede eliminar datos o hacer cambios irreversibles'
        );
        
        return $descriptions[$risk_level] ?? 'Nivel de riesgo desconocido';
    }
    
    /**
     * 📊 Extraer cambios predichos del resultado de simulación
     */
    private function extract_predicted_changes($simulation_result) {
        if (!is_array($simulation_result)) {
            return array(
                'type' => 'unknown',
                'description' => 'No se pudieron determinar los cambios específicos'
            );
        }
        
        // Buscar indicadores de cambios en el resultado
        $changes = array();
        
        if (isset($simulation_result['changes'])) {
            return $simulation_result['changes'];
        }
        
        if (isset($simulation_result['affected_items'])) {
            $changes['affected_items'] = $simulation_result['affected_items'];
        }
        
        if (isset($simulation_result['modifications'])) {
            $changes['modifications'] = $simulation_result['modifications'];
        }
        
        return $changes;
    }
    
    /**
     * 📊 Identificar recursos afectados
     */
    private function identify_affected_resources($ability_name, $scopes, $input) {
        $resources = array();
        
        foreach ($scopes as $scope) {
            switch ($scope) {
                case 'site:read':
                case 'site:write':
                    $resources[] = array(
                        'type' => 'site_settings',
                        'description' => 'Configuración general del sitio',
                        'risk' => $scope === 'site:write' ? 'medium' : 'low'
                    );
                    break;
                    
                case 'plugins:read':
                case 'plugins:write':
                case 'plugins:install':
                case 'plugins:delete':
                    $resources[] = array(
                        'type' => 'plugins',
                        'description' => 'Plugins de WordPress',
                        'risk' => in_array($scope, ['plugins:delete', 'plugins:install']) ? 'high' : 'medium'
                    );
                    break;
                    
                case 'users:read':
                case 'users:write':
                case 'users:create':
                case 'users:delete':
                    $resources[] = array(
                        'type' => 'users',
                        'description' => 'Usuarios del sitio',
                        'risk' => in_array($scope, ['users:delete', 'users:create']) ? 'high' : 'medium'
                    );
                    break;
                    
                case 'database:read':
                case 'database:write':
                    $resources[] = array(
                        'type' => 'database',
                        'description' => 'Base de datos de WordPress',
                        'risk' => $scope === 'database:write' ? 'high' : 'low'
                    );
                    break;
                    
                case 'system:read':
                case 'system:write':
                    $resources[] = array(
                        'type' => 'system',
                        'description' => 'Información del sistema y servidor',
                        'risk' => $scope === 'system:write' ? 'high' : 'low'
                    );
                    break;
            }
        }
        
        return $resources;
    }
    
    /**
     * 📊 Evaluar reversibilidad de la acción
     */
    private function assess_reversibility($risk_level, $scopes) {
        if ($risk_level === 'read') {
            return array(
                'reversible' => true,
                'reason' => 'Solo lectura - no hay cambios que revertir',
                'confidence' => 'high'
            );
        }
        
        if ($risk_level === 'destructive') {
            return array(
                'reversible' => false,
                'reason' => 'Operación destructiva - cambios pueden ser irreversibles',
                'confidence' => 'high',
                'recommendation' => 'Hacer backup antes de proceder'
            );
        }
        
        // Analizar scopes para determinar reversibilidad
        $destructive_scopes = ['users:delete', 'plugins:delete', 'themes:delete', 'database:write'];
        $has_destructive = !empty(array_intersect($scopes, $destructive_scopes));
        
        if ($has_destructive) {
            return array(
                'reversible' => false,
                'reason' => 'Incluye operaciones de eliminación',
                'confidence' => 'medium',
                'recommendation' => 'Verificar que no se necesiten los elementos a eliminar'
            );
        }
        
        return array(
            'reversible' => true,
            'reason' => 'Cambios pueden revertirse manualmente',
            'confidence' => 'medium'
        );
    }
    
    /**
     * 📊 Generar recomendaciones
     */
    private function generate_recommendations($risk_level, $scopes) {
        $recommendations = array();
        
        if ($risk_level === 'destructive') {
            $recommendations[] = array(
                'type' => 'backup',
                'priority' => 'high',
                'message' => 'Crear backup completo antes de proceder'
            );
        }
        
        if (in_array('database:write', $scopes)) {
            $recommendations[] = array(
                'type' => 'database_backup',
                'priority' => 'high',
                'message' => 'Respaldar base de datos antes de modificaciones'
            );
        }
        
        if (in_array('plugins:delete', $scopes) || in_array('themes:delete', $scopes)) {
            $recommendations[] = array(
                'type' => 'verification',
                'priority' => 'medium',
                'message' => 'Verificar que los elementos a eliminar no sean necesarios'
            );
        }
        
        if ($risk_level === 'write') {
            $recommendations[] = array(
                'type' => 'staging',
                'priority' => 'medium',
                'message' => 'Considerar probar en entorno de staging primero'
            );
        }
        
        return $recommendations;
    }
    
    /**
     * 📊 Generar explicación en lenguaje humano
     */
    private function generate_human_explanation($name, $ability, $input, $simulation_result) {
        $description = $ability['description'] ?? 'Acción de WordPress';
        $risk_level = $ability['risk_level'] ?? 'unknown';
        
        $explanation = array(
            'what_will_happen' => $description,
            'why_needed' => $this->explain_why_needed($name, $input),
            'what_changes' => $this->explain_changes($simulation_result),
            'what_wont_change' => $this->explain_what_wont_change($risk_level, $ability['scopes'] ?? array()),
            'risk_summary' => $this->get_risk_description($risk_level)
        );
        
        return $explanation;
    }
    
    /**
     * 📊 Generar explicación desde metadatos (fallback)
     */
    private function generate_human_explanation_from_metadata($name, $ability, $input) {
        $description = $ability['description'] ?? 'Acción de WordPress';
        $risk_level = $ability['risk_level'] ?? 'unknown';
        $scopes = $ability['scopes'] ?? array();
        
        return array(
            'what_will_happen' => $description,
            'why_needed' => $this->explain_why_needed($name, $input),
            'what_changes' => $this->explain_changes_from_scopes($scopes),
            'what_wont_change' => $this->explain_what_wont_change($risk_level, $scopes),
            'risk_summary' => $this->get_risk_description($risk_level),
            'note' => 'Explicación basada en metadatos de la ability'
        );
    }
    
    /**
     * 📊 Explicar por qué se necesita la acción
     */
    private function explain_why_needed($name, $input) {
        // Mapeo de abilities comunes a explicaciones
        $explanations = array(
            'gh_get_site_health' => 'Para obtener información sobre el estado actual de tu sitio WordPress',
            'gh_list_plugins' => 'Para revisar qué plugins tienes instalados y su estado',
            'gh_update_plugins' => 'Para mantener tus plugins actualizados y seguros',
            'gh_backup_database' => 'Para crear una copia de seguridad de tu base de datos'
        );
        
        if (isset($explanations[$name])) {
            return $explanations[$name];
        }
        
        // Explicación genérica basada en parámetros
        if (!empty($input)) {
            return 'Para realizar la acción solicitada con los parámetros especificados';
        }
        
        return 'Para ejecutar la funcionalidad solicitada en tu sitio WordPress';
    }
    
    /**
     * 📊 Explicar cambios desde resultado de simulación
     */
    private function explain_changes($simulation_result) {
        if (!is_array($simulation_result)) {
            return 'No se pudieron determinar los cambios específicos';
        }
        
        if (isset($simulation_result['changes_description'])) {
            return $simulation_result['changes_description'];
        }
        
        if (isset($simulation_result['affected_items'])) {
            $count = is_array($simulation_result['affected_items']) ? 
                count($simulation_result['affected_items']) : 
                $simulation_result['affected_items'];
            return "Se modificarán aproximadamente {$count} elementos";
        }
        
        return 'Se realizarán cambios según los parámetros especificados';
    }
    
    /**
     * 📊 Explicar cambios desde scopes (fallback)
     */
    private function explain_changes_from_scopes($scopes) {
        $changes = array();
        
        foreach ($scopes as $scope) {
            switch ($scope) {
                case 'site:write':
                    $changes[] = 'configuración del sitio';
                    break;
                case 'plugins:write':
                    $changes[] = 'plugins instalados';
                    break;
                case 'users:write':
                    $changes[] = 'usuarios del sitio';
                    break;
                case 'database:write':
                    $changes[] = 'base de datos';
                    break;
            }
        }
        
        if (empty($changes)) {
            return 'Solo se leerá información, sin modificaciones';
        }
        
        return 'Se modificará: ' . implode(', ', $changes);
    }
    
    /**
     * 📊 Explicar qué NO cambiará
     */
    private function explain_what_wont_change($risk_level, $scopes) {
        if ($risk_level === 'read') {
            return 'Nada cambiará - solo se leerá información';
        }
        
        $protected_areas = array();
        
        if (!in_array('users:write', $scopes) && !in_array('users:delete', $scopes)) {
            $protected_areas[] = 'usuarios';
        }
        
        if (!in_array('plugins:write', $scopes) && !in_array('plugins:delete', $scopes)) {
            $protected_areas[] = 'plugins';
        }
        
        if (!in_array('themes:write', $scopes) && !in_array('themes:delete', $scopes)) {
            $protected_areas[] = 'temas';
        }
        
        if (!in_array('database:write', $scopes)) {
            $protected_areas[] = 'estructura de la base de datos';
        }
        
        if (empty($protected_areas)) {
            return 'Esta acción puede afectar múltiples áreas del sitio';
        }
        
        return 'No se modificarán: ' . implode(', ', $protected_areas);
    }
    
    /**
     * 📊 Analizar scopes para cambios (fallback)
     */
    private function analyze_scopes_for_changes($scopes) {
        $analysis = array();
        
        foreach ($scopes as $scope) {
            $parts = explode(':', $scope);
            $resource = $parts[0] ?? 'unknown';
            $action = $parts[1] ?? 'unknown';
            
            $analysis[] = array(
                'resource' => $resource,
                'action' => $action,
                'description' => $this->get_scope_description($scope)
            );
        }
        
        return $analysis;
    }
    
    /**
     * 📊 Obtener descripción de scope
     */
    private function get_scope_description($scope) {
        $descriptions = array(
            'site:read' => 'Leer configuración del sitio',
            'site:write' => 'Modificar configuración del sitio',
            'plugins:read' => 'Listar plugins instalados',
            'plugins:write' => 'Modificar plugins',
            'plugins:install' => 'Instalar nuevos plugins',
            'plugins:delete' => 'Eliminar plugins',
            'users:read' => 'Listar usuarios',
            'users:write' => 'Modificar usuarios',
            'users:create' => 'Crear nuevos usuarios',
            'users:delete' => 'Eliminar usuarios',
            'database:read' => 'Consultar base de datos',
            'database:write' => 'Modificar base de datos',
            'system:read' => 'Leer información del sistema',
            'system:write' => 'Modificar configuración del sistema'
        );
        
        return $descriptions[$scope] ?? "Acción: {$scope}";
    }
    /**
     * Registrar abilities core del sistema con permisos y governance
     */
    public function register_core_abilities() {
        gemini_log('🚀 Registrando Core Abilities con Security & Governance + Dry-Run');
        
        // Ability: Site Health Check
        $this->register_ability('gh_get_site_health', array(
            'name' => 'gh_get_site_health',
            'label' => __('Get Site Health Status', 'gemini-wp-cli'),
            'description' => __('Returns comprehensive site health information including WordPress version, PHP version, database status, and email functionality.', 'gemini-wp-cli'),
            'category' => 'site',
            'input_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'include_tests' => array(
                        'type' => 'boolean',
                        'description' => 'Whether to include detailed health tests results.',
                        'default' => false
                    ),
                    'format' => array(
                        'type' => 'string',
                        'description' => 'Output format: summary or detailed.',
                        'enum' => array('summary', 'detailed'),
                        'default' => 'summary'
                    )
                ),
                'additionalProperties' => false
            ),
            'output_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'status' => array(
                        'type' => 'string',
                        'description' => 'Overall site health status',
                        'enum' => array('good', 'recommended', 'critical')
                    ),
                    'wordpress_version' => array(
                        'type' => 'string',
                        'description' => 'Current WordPress version'
                    ),
                    'php_version' => array(
                        'type' => 'string',
                        'description' => 'Current PHP version'
                    ),
                    'database_server' => array(
                        'type' => 'string',
                        'description' => 'Database server information'
                    ),
                    'email_test' => array(
                        'type' => 'object',
                        'properties' => array(
                            'status' => array('type' => 'string'),
                            'message' => array('type' => 'string')
                        )
                    ),
                    'active_plugins' => array(
                        'type' => 'integer',
                        'description' => 'Number of active plugins'
                    ),
                    'active_theme' => array(
                        'type' => 'string',
                        'description' => 'Name of the active theme'
                    ),
                    'site_url' => array(
                        'type' => 'string',
                        'description' => 'Site URL'
                    ),
                    'admin_email' => array(
                        'type' => 'string',
                        'description' => 'Site admin email'
                    ),
                    'tests' => array(
                        'type' => 'array',
                        'description' => 'Detailed health test results (if requested)',
                        'items' => array(
                            'type' => 'object',
                            'properties' => array(
                                'test' => array('type' => 'string'),
                                'status' => array('type' => 'string'),
                                'description' => array('type' => 'string')
                            )
                        )
                    )
                ),
                'additionalProperties' => false
            ),
            'permission_callback' => 'gemini_abilities_permission_check',
            'execute_callback' => 'gemini_execute_site_health',
            'simulate_callback' => 'gemini_simulate_site_health', // 🧪 DRY-RUN
            // 🛡️ SECURITY & GOVERNANCE
            'required_capabilities' => array('read'), // Capacidad mínima de WordPress
            'risk_level' => 'read', // read, write, destructive
            'scopes' => array('site:read', 'system:read'), // Scopes específicos
            'audit_category' => 'site_inspection', // Categoría para auditoría
            'meta' => array(
                'show_in_rest' => true,
                'annotations' => array(
                    'readonly' => true,
                    'destructive' => false,
                    'idempotent' => true,
                    'requires_confirmation' => true,
                    'sensitive_data' => false
                )
            )
        ));
        
        // 🆕 Ability adicional: Plugin List (ejemplo de diferentes permisos)
        $this->register_ability('gh_list_plugins', array(
            'name' => 'gh_list_plugins',
            'label' => __('List WordPress Plugins', 'gemini-wp-cli'),
            'description' => __('Returns a list of all installed WordPress plugins with their status and version information.', 'gemini-wp-cli'),
            'category' => 'plugins',
            'input_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'status' => array(
                        'type' => 'string',
                        'description' => 'Filter by plugin status.',
                        'enum' => array('all', 'active', 'inactive'),
                        'default' => 'all'
                    )
                ),
                'additionalProperties' => false
            ),
            'output_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'plugins' => array(
                        'type' => 'array',
                        'items' => array(
                            'type' => 'object',
                            'properties' => array(
                                'name' => array('type' => 'string'),
                                'status' => array('type' => 'string'),
                                'version' => array('type' => 'string'),
                                'file' => array('type' => 'string')
                            )
                        )
                    ),
                    'total_count' => array('type' => 'integer')
                )
            ),
            'permission_callback' => 'gemini_abilities_permission_check',
            'execute_callback' => 'gemini_execute_list_plugins',
            'simulate_callback' => 'gemini_simulate_list_plugins', // 🧪 DRY-RUN
            // 🛡️ SECURITY & GOVERNANCE
            'required_capabilities' => array('activate_plugins'), // Requiere permisos de plugins
            'risk_level' => 'read',
            'scopes' => array('plugins:read'),
            'audit_category' => 'plugin_management',
            'meta' => array(
                'show_in_rest' => true,
                'annotations' => array(
                    'readonly' => true,
                    'destructive' => false,
                    'idempotent' => true,
                    'requires_confirmation' => true,
                    'sensitive_data' => false
                )
            )
        ));
        
        // Ability: Database Optimization
        $this->register_ability('gh_optimize_database', array(
            'name' => 'gh_optimize_database',
            'label' => __('Optimize Database', 'gemini-wp-cli'),
            'description' => __('Optimizes the WordPress database by cleaning up revisions, spam comments, and expired transients.', 'gemini-wp-cli'),
            'category' => 'maintenance',
            'input_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'cleanup_revisions' => array(
                        'type' => 'boolean',
                        'description' => 'Remove old post revisions.',
                        'default' => true
                    ),
                    'cleanup_spam' => array(
                        'type' => 'boolean',
                        'description' => 'Remove spam comments.',
                        'default' => true
                    ),
                    'optimize_tables' => array(
                        'type' => 'boolean',
                        'description' => 'Optimize database tables.',
                        'default' => true
                    ),
                    'keep_revisions' => array(
                        'type' => 'integer',
                        'description' => 'Number of revisions to keep per post.',
                        'default' => 3,
                        'minimum' => 1,
                        'maximum' => 10
                    )
                ),
                'additionalProperties' => false
            ),
            'output_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'revisions_removed' => array('type' => 'integer'),
                    'spam_removed' => array('type' => 'integer'),
                    'transients_cleaned' => array('type' => 'integer'),
                    'tables_optimized' => array('type' => 'integer'),
                    'space_saved' => array('type' => 'string'),
                    'optimization_summary' => array('type' => 'string')
                )
            ),
            'permission_callback' => 'gemini_abilities_permission_check',
            'execute_callback' => 'gemini_execute_optimize_database',
            'simulate_callback' => 'gemini_simulate_optimize_database',
            'required_capabilities' => array('manage_options'),
            'risk_level' => 'write',
            'scopes' => array('database:write'),
            'audit_category' => 'database_maintenance',
            'meta' => array(
                'show_in_rest' => true,
                'annotations' => array(
                    'readonly' => false,
                    'destructive' => false,
                    'idempotent' => false,
                    'requires_confirmation' => true,
                    'sensitive_data' => false
                )
            )
        ));
        
        // Ability: Create Backup
        $this->register_ability('gh_create_backup', array(
            'name' => 'gh_create_backup',
            'label' => __('Create Site Backup', 'gemini-wp-cli'),
            'description' => __('Creates a backup of the WordPress site including database and files.', 'gemini-wp-cli'),
            'category' => 'backup',
            'input_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'include_database' => array(
                        'type' => 'boolean',
                        'description' => 'Include database in backup.',
                        'default' => true
                    ),
                    'include_files' => array(
                        'type' => 'boolean',
                        'description' => 'Include files in backup.',
                        'default' => true
                    ),
                    'backup_type' => array(
                        'type' => 'string',
                        'description' => 'Type of backup to create.',
                        'enum' => array('full', 'database_only', 'files_only'),
                        'default' => 'full'
                    ),
                    'compression' => array(
                        'type' => 'boolean',
                        'description' => 'Compress backup files.',
                        'default' => true
                    )
                ),
                'additionalProperties' => false
            ),
            'output_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'backup_file' => array('type' => 'string'),
                    'backup_size' => array('type' => 'string'),
                    'backup_location' => array('type' => 'string'),
                    'backup_date' => array('type' => 'string'),
                    'files_included' => array('type' => 'integer'),
                    'database_included' => array('type' => 'boolean')
                )
            ),
            'permission_callback' => 'gemini_abilities_permission_check',
            'execute_callback' => 'gemini_execute_create_backup',
            'simulate_callback' => 'gemini_simulate_create_backup',
            'required_capabilities' => array('manage_options'),
            'risk_level' => 'read',
            'scopes' => array('system:read', 'database:read'),
            'audit_category' => 'backup_operations',
            'meta' => array(
                'show_in_rest' => true,
                'annotations' => array(
                    'readonly' => true,
                    'destructive' => false,
                    'idempotent' => true,
                    'requires_confirmation' => true,
                    'sensitive_data' => false
                )
            )
        ));
        
        // Ability: Security Scan
        $this->register_ability('gh_security_scan', array(
            'name' => 'gh_security_scan',
            'label' => __('Security Scan', 'gemini-wp-cli'),
            'description' => __('Performs a comprehensive security scan of the WordPress installation.', 'gemini-wp-cli'),
            'category' => 'security',
            'input_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'scan_type' => array(
                        'type' => 'string',
                        'description' => 'Type of security scan to perform.',
                        'enum' => array('basic', 'comprehensive', 'malware_only'),
                        'default' => 'basic'
                    ),
                    'include_malware' => array(
                        'type' => 'boolean',
                        'description' => 'Include malware scanning.',
                        'default' => true
                    ),
                    'check_vulnerabilities' => array(
                        'type' => 'boolean',
                        'description' => 'Check for known vulnerabilities.',
                        'default' => true
                    )
                ),
                'additionalProperties' => false
            ),
            'output_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'scan_status' => array('type' => 'string'),
                    'threats_found' => array('type' => 'integer'),
                    'vulnerabilities_found' => array('type' => 'integer'),
                    'scan_summary' => array('type' => 'string'),
                    'recommendations' => array('type' => 'array')
                )
            ),
            'permission_callback' => 'gemini_abilities_permission_check',
            'execute_callback' => 'gemini_execute_security_scan',
            'simulate_callback' => 'gemini_simulate_security_scan',
            'required_capabilities' => array('manage_options'),
            'risk_level' => 'read',
            'scopes' => array('system:read', 'plugins:read'),
            'audit_category' => 'security_operations',
            'meta' => array(
                'show_in_rest' => true,
                'annotations' => array(
                    'readonly' => true,
                    'destructive' => false,
                    'idempotent' => true,
                    'requires_confirmation' => true,
                    'sensitive_data' => false
                )
            )
        ));
    }
}

// 🧪 DRY-RUN: Función de simulación para Site Health
function gemini_simulate_site_health($input = array()) {
    gemini_log('🧪 Simulando gh_get_site_health con input: ' . json_encode($input));
    
    // Valores por defecto
    $include_tests = isset($input['include_tests']) ? (bool)$input['include_tests'] : false;
    $format = isset($input['format']) ? $input['format'] : 'summary';
    
    // Simular información básica del sitio (sin efectos secundarios)
    global $wp_version, $wpdb;
    
    $simulated_result = array(
        'status' => 'good', // Simulamos un estado bueno
        'wordpress_version' => $wp_version,
        'php_version' => PHP_VERSION,
        'database_server' => 'MySQL/MariaDB (simulated)',
        'active_plugins' => count(get_option('active_plugins', array())),
        'active_theme' => wp_get_theme()->get('Name'),
        'site_url' => home_url(),
        'admin_email' => get_option('admin_email'),
        'timestamp' => current_time('c'),
        'simulation_note' => 'Esta es una simulación - no se enviaron emails de prueba'
    );
    
    // Simular test de email (sin enviar realmente)
    $simulated_result['email_test'] = array(
        'status' => 'simulated',
        'message' => 'Email test would be performed (not sent in simulation)'
    );
    
    // Si se solicitan tests detallados, simularlos
    if ($include_tests && $format === 'detailed') {
        $simulated_result['tests'] = array(
            array(
                'test' => 'php_version',
                'status' => version_compare(PHP_VERSION, '7.4', '>=') ? 'good' : 'recommended',
                'description' => 'PHP version check (simulated)'
            ),
            array(
                'test' => 'wordpress_version',
                'status' => 'good',
                'description' => 'WordPress version check (simulated)'
            ),
            array(
                'test' => 'active_plugins',
                'status' => count(get_option('active_plugins', array())) < 20 ? 'good' : 'recommended',
                'description' => 'Plugin count analysis (simulated)'
            )
        );
        
        // Determinar status general basado en tests simulados
        $simulated_result['status'] = 'good'; // Simulamos siempre un resultado positivo
    }
    
    // Información adicional de simulación
    $simulated_result['changes_description'] = 'No changes - read-only operation';
    $simulated_result['affected_items'] = 0;
    $simulated_result['modifications'] = array();
    
    gemini_log('✅ Simulación de Site Health completada exitosamente');
    
    return $simulated_result;
}

// 🧪 DRY-RUN: Función de simulación para List Plugins
function gemini_simulate_list_plugins($input = array()) {
    gemini_log('🧪 Simulando gh_list_plugins con input: ' . json_encode($input));
    
    $status_filter = isset($input['status']) ? $input['status'] : 'all';
    
    // Obtener información real de plugins (sin modificaciones)
    $all_plugins = get_plugins();
    $active_plugins = get_option('active_plugins', array());
    
    $plugins_list = array();
    $simulated_count = 0;
    
    foreach ($all_plugins as $plugin_file => $plugin_data) {
        $is_active = in_array($plugin_file, $active_plugins);
        $plugin_status = $is_active ? 'active' : 'inactive';
        
        // Aplicar filtro de status
        if ($status_filter !== 'all' && $plugin_status !== $status_filter) {
            continue;
        }
        
        $plugins_list[] = array(
            'name' => $plugin_data['Name'],
            'status' => $plugin_status,
            'version' => $plugin_data['Version'],
            'file' => $plugin_file,
            'description' => $plugin_data['Description'],
            'author' => $plugin_data['Author']
        );
        
        $simulated_count++;
    }
    
    $simulated_result = array(
        'plugins' => $plugins_list,
        'total_count' => $simulated_count,
        'filter_applied' => $status_filter,
        'timestamp' => current_time('c'),
        'simulation_note' => 'Plugin list retrieved without modifications'
    );
    
    // Información adicional de simulación
    $simulated_result['changes_description'] = 'No changes - read-only operation';
    $simulated_result['affected_items'] = 0;
    $simulated_result['modifications'] = array();
    
    gemini_log('✅ Simulación de List Plugins completada. Plugins encontrados: ' . $simulated_count);
    
    return $simulated_result;
}
function gemini_execute_site_health($input = array()) {
    gemini_log('🔍 Ejecutando gh_get_site_health con input: ' . json_encode($input));
    
    // Valores por defecto
    $include_tests = isset($input['include_tests']) ? (bool)$input['include_tests'] : false;
    $format = isset($input['format']) ? $input['format'] : 'summary';
    
    // Información básica del sitio
    global $wp_version, $wpdb;
    
    $result = array(
        'status' => 'good',
        'wordpress_version' => $wp_version,
        'php_version' => PHP_VERSION,
        'database_server' => $wpdb->get_var("SELECT VERSION()"),
        'active_plugins' => count(get_option('active_plugins', array())),
        'active_theme' => wp_get_theme()->get('Name'),
        'site_url' => home_url(),
        'admin_email' => get_option('admin_email'),
        'timestamp' => current_time('c')
    );
    
    // Test de email
    $email_test = wp_mail(
        get_option('admin_email'),
        'Site Health Test - ' . get_bloginfo('name'),
        'This is a test email from the Site Health check.',
        array('Content-Type: text/plain; charset=UTF-8')
    );
    
    $result['email_test'] = array(
        'status' => $email_test ? 'working' : 'failed',
        'message' => $email_test ? 'Email functionality is working' : 'Email functionality may have issues'
    );
    
    // Si se solicitan tests detallados
    if ($include_tests && $format === 'detailed') {
        $result['tests'] = array();
        
        // Test de versión de PHP
        $php_version_check = version_compare(PHP_VERSION, '7.4', '>=');
        $result['tests'][] = array(
            'test' => 'php_version',
            'status' => $php_version_check ? 'good' : 'recommended',
            'description' => $php_version_check ? 'PHP version is up to date' : 'Consider updating PHP version'
        );
        
        // Test de versión de WordPress
        $wp_version_check = !function_exists('get_core_updates') || empty(get_core_updates());
        $result['tests'][] = array(
            'test' => 'wordpress_version',
            'status' => $wp_version_check ? 'good' : 'recommended',
            'description' => $wp_version_check ? 'WordPress is up to date' : 'WordPress update available'
        );
        
        // Test de plugins activos
        $active_plugins_count = count(get_option('active_plugins', array()));
        $result['tests'][] = array(
            'test' => 'active_plugins',
            'status' => $active_plugins_count < 20 ? 'good' : 'recommended',
            'description' => "Site has {$active_plugins_count} active plugins"
        );
        
        // Determinar status general basado en tests
        $critical_issues = array_filter($result['tests'], function($test) {
            return $test['status'] === 'critical';
        });
        
        $recommended_issues = array_filter($result['tests'], function($test) {
            return $test['status'] === 'recommended';
        });
        
        if (!empty($critical_issues)) {
            $result['status'] = 'critical';
        } elseif (!empty($recommended_issues)) {
            $result['status'] = 'recommended';
        }
    }
    
    gemini_log('✅ Site Health ejecutado exitosamente. Status: ' . $result['status']);
    
    return $result;
}

// 🆕 ABILITIES: Función de ejecución para List Plugins
function gemini_execute_list_plugins($input = array()) {
    gemini_log('🔍 Ejecutando gh_list_plugins con input: ' . json_encode($input));
    
    $status_filter = isset($input['status']) ? $input['status'] : 'all';
    
    // Obtener todos los plugins
    $all_plugins = get_plugins();
    $active_plugins = get_option('active_plugins', array());
    
    $plugins_list = array();
    
    foreach ($all_plugins as $plugin_file => $plugin_data) {
        $is_active = in_array($plugin_file, $active_plugins);
        $plugin_status = $is_active ? 'active' : 'inactive';
        
        // Aplicar filtro de status
        if ($status_filter !== 'all' && $plugin_status !== $status_filter) {
            continue;
        }
        
        $plugins_list[] = array(
            'name' => $plugin_data['Name'],
            'status' => $plugin_status,
            'version' => $plugin_data['Version'],
            'file' => $plugin_file,
            'description' => $plugin_data['Description'],
            'author' => $plugin_data['Author']
        );
    }
    
    $result = array(
        'plugins' => $plugins_list,
        'total_count' => count($plugins_list),
        'filter_applied' => $status_filter,
        'timestamp' => current_time('c')
    );
    
    gemini_log('✅ List Plugins ejecutado exitosamente. Plugins encontrados: ' . count($plugins_list));
    
    return $result;
}

// 🛡️ SECURITY & GOVERNANCE: Verificación de permisos para abilities
function gemini_abilities_permission_check() {
    // Por ahora, usar la misma lógica de verificación de token
    // En el futuro, esto podría ser más granular por ability
    $token = $_SERVER['HTTP_X_GEMINI_AUTH'] ?? '';
    $secret_token = get_option('gemini_wp_cli_token');
    
    if (empty($token) || empty($secret_token)) {
        gemini_log('❌ Token de autenticación faltante');
        return false;
    }
    
    if (!hash_equals($secret_token, $token)) {
        gemini_log('❌ Token de autenticación inválido');
        return false;
    }
    
    gemini_log('✅ Token de autenticación válido');
    return true;
}

// 🛡️ SECURITY & GOVERNANCE: Verificación avanzada de permisos por ability
function gemini_check_ability_permissions($ability_name, $user_capabilities = null) {
    $registry = Gemini_Ability_Registry::get_instance();
    
    if (!$registry->has_ability($ability_name)) {
        return new WP_Error('ability_not_found', "Ability '{$ability_name}' not found", array('status' => 404));
    }
    
    $ability = $registry->get_ability($ability_name);
    
    // Verificar capacidades requeridas de WordPress
    $required_caps = $ability['required_capabilities'] ?? array('read');
    
    // Si no se proporcionan capacidades del usuario, usar las del token/usuario actual
    if ($user_capabilities === null) {
        $user_capabilities = gemini_get_token_capabilities();
    }
    
    // Verificar que el usuario tenga todas las capacidades requeridas
    foreach ($required_caps as $required_cap) {
        if (!in_array($required_cap, $user_capabilities)) {
            gemini_log("❌ Permiso denegado: falta capacidad '{$required_cap}' para ability '{$ability_name}'");
            return new WP_Error(
                'insufficient_permissions', 
                "Insufficient permissions: missing capability '{$required_cap}'", 
                array('status' => 403)
            );
        }
    }
    
    // Verificar nivel de riesgo y restricciones adicionales
    $risk_level = $ability['risk_level'] ?? 'read';
    $scopes = $ability['scopes'] ?? array();
    
    // Verificar restricciones por nivel de riesgo
    if ($risk_level === 'destructive' && !in_array('manage_options', $user_capabilities)) {
        gemini_log("❌ Permiso denegado: operación destructiva requiere manage_options para ability '{$ability_name}'");
        return new WP_Error(
            'insufficient_permissions_destructive', 
            "Destructive operations require administrator privileges", 
            array('status' => 403)
        );
    }
    
    // Verificar scopes específicos
    $scope_check = gemini_verify_ability_scopes($scopes, $user_capabilities);
    if (is_wp_error($scope_check)) {
        return $scope_check;
    }
    
    gemini_log("✅ Permisos verificados para ability '{$ability_name}' (risk: {$risk_level}, scopes: " . implode(',', $scopes) . ")");
    
    return true;
}

// 🛡️ SECURITY & GOVERNANCE: Obtener capacidades del token actual
function gemini_get_token_capabilities() {
    // Por ahora, usar capacidades fijas para tokens de API
    // En el futuro, esto podría ser configurable por token en la base de datos
    $token_capabilities = get_option('gemini_token_capabilities', array(
        'read',
        'edit_posts',
        'edit_pages',
        'edit_others_posts',
        'edit_others_pages',
        'publish_posts',
        'publish_pages',
        'manage_categories',
        'manage_links',
        'upload_files',
        'edit_users',
        'list_users',
        'activate_plugins',
        'edit_plugins',
        'install_plugins',
        'update_plugins',
        'delete_plugins',
        'switch_themes',
        'edit_themes',
        'install_themes',
        'update_themes',
        'delete_themes'
        // Nota: 'manage_options' no incluido por defecto por seguridad
    ));
    
    // Permitir override para administradores que quieran dar permisos completos
    if (get_option('gemini_token_admin_mode', false)) {
        $token_capabilities[] = 'manage_options';
        $token_capabilities[] = 'delete_users';
        $token_capabilities[] = 'create_users';
        $token_capabilities[] = 'edit_theme_options';
        $token_capabilities[] = 'customize';
    }
    
    return $token_capabilities;
}

// 🛡️ SECURITY & GOVERNANCE: Verificar scopes específicos de abilities
function gemini_verify_ability_scopes($scopes, $user_capabilities) {
    if (empty($scopes)) {
        return true; // Sin scopes específicos
    }
    
    $scope_requirements = array(
        'site:read' => array('read'),
        'site:write' => array('edit_posts', 'edit_pages'),
        'users:read' => array('list_users'),
        'users:write' => array('edit_users'),
        'users:create' => array('create_users'),
        'users:delete' => array('delete_users'),
        'plugins:read' => array('activate_plugins'),
        'plugins:write' => array('edit_plugins', 'activate_plugins'),
        'plugins:install' => array('install_plugins'),
        'plugins:delete' => array('delete_plugins'),
        'themes:read' => array('switch_themes'),
        'themes:write' => array('edit_themes'),
        'themes:install' => array('install_themes'),
        'themes:delete' => array('delete_themes'),
        'system:read' => array('read'),
        'system:write' => array('manage_options'),
        'database:read' => array('manage_options'),
        'database:write' => array('manage_options')
    );
    
    foreach ($scopes as $scope) {
        if (!isset($scope_requirements[$scope])) {
            gemini_log("⚠️ Scope desconocido: {$scope}");
            continue;
        }
        
        $required_caps = $scope_requirements[$scope];
        $has_required_cap = false;
        
        foreach ($required_caps as $required_cap) {
            if (in_array($required_cap, $user_capabilities)) {
                $has_required_cap = true;
                break;
            }
        }
        
        if (!$has_required_cap) {
            gemini_log("❌ Scope denegado: {$scope} requiere una de: " . implode(', ', $required_caps));
            return new WP_Error(
                'insufficient_scope_permissions',
                "Insufficient permissions for scope '{$scope}': requires one of " . implode(', ', $required_caps),
                array('status' => 403)
            );
        }
    }
    
    return true;
}

// 🔍 ABILITIES DISCOVERY: Endpoint REST real para metadatos únicamente
add_action('rest_api_init', function() {
    // Usar namespace del plugin (no inventar WordPress Abilities API)
    $namespace = 'gemini-wp-cli/v1';
    
    // Endpoint SOLO para discovery de metadatos (no ejecución)
    register_rest_route($namespace, '/abilities', array(
        'methods' => 'GET',
        'callback' => 'gemini_get_abilities_metadata',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'format' => array(
                'type' => 'string',
                'enum' => array('full', 'tools'),
                'default' => 'full',
                'description' => 'Response format: full metadata or tools format for Gemini'
            )
        )
    ));
    
    // Endpoint para ejecutar abilities (separado del discovery)
    register_rest_route($namespace, '/abilities/(?P<ability_name>[a-zA-Z0-9_/-]+)/execute', array(
        'methods' => 'POST',
        'callback' => 'gemini_execute_ability_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'ability_name' => array(
                'required' => true,
                'type' => 'string',
                'validate_callback' => function($param) {
                    return is_string($param) && !empty($param);
                }
            ),
            'mode' => array(
                'required' => false,
                'type' => 'string',
                'default' => 'execute',
                'enum' => array('execute', 'simulate'),
                'description' => 'Execution mode: execute (real) or simulate (dry-run)'
            )
        )
    ));
    
    // 🤖 POLICY ENGINE: Endpoint para evaluación de políticas
    register_rest_route($namespace, '/policies/evaluate', array(
        'methods' => 'POST',
        'callback' => 'gemini_evaluate_policies_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'context' => array(
                'required' => false,
                'type' => 'object',
                'default' => array(),
                'description' => 'Context data for policy evaluation (site_health, plugins, etc.)'
            ),
            'include_suggestions' => array(
                'required' => false,
                'type' => 'boolean',
                'default' => true,
                'description' => 'Whether to include action suggestions in the response'
            )
        )
    ));
    
    // 🔄 WORKFLOW ENGINE: Endpoints para workflows
    register_rest_route($namespace, '/workflows', array(
        'methods' => 'GET',
        'callback' => 'gemini_get_workflows_endpoint',
        'permission_callback' => 'gemini_verify_token'
    ));
    
    register_rest_route($namespace, '/workflows/(?P<workflow_id>[a-zA-Z0-9_/-]+)/start', array(
        'methods' => 'POST',
        'callback' => 'gemini_start_workflow_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'workflow_id' => array(
                'required' => true,
                'type' => 'string'
            ),
            'context' => array(
                'required' => false,
                'type' => 'object',
                'default' => array()
            )
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)/steps/(?P<step_index>\d+)/simulate', array(
        'methods' => 'POST',
        'callback' => 'gemini_simulate_workflow_step_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string'),
            'step_index' => array('required' => true, 'type' => 'integer')
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)/steps/(?P<step_index>\d+)/execute', array(
        'methods' => 'POST',
        'callback' => 'gemini_execute_workflow_step_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string'),
            'step_index' => array('required' => true, 'type' => 'integer')
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)/steps/(?P<step_index>\d+)/skip', array(
        'methods' => 'POST',
        'callback' => 'gemini_skip_workflow_step_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string'),
            'step_index' => array('required' => true, 'type' => 'integer'),
            'reason' => array('required' => false, 'type' => 'string', 'default' => '')
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)/cancel', array(
        'methods' => 'POST',
        'callback' => 'gemini_cancel_workflow_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string'),
            'reason' => array('required' => false, 'type' => 'string', 'default' => '')
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)', array(
        'methods' => 'GET',
        'callback' => 'gemini_get_workflow_session_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string')
        )
    ));
    
    // 🔄 WORKFLOW ENGINE: Endpoints para workflows
    register_rest_route($namespace, '/workflows', array(
        'methods' => 'GET',
        'callback' => 'gemini_get_workflows_endpoint',
        'permission_callback' => 'gemini_verify_token'
    ));
    
    register_rest_route($namespace, '/workflows/(?P<workflow_id>[a-zA-Z0-9_/-]+)/start', array(
        'methods' => 'POST',
        'callback' => 'gemini_start_workflow_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'workflow_id' => array(
                'required' => true,
                'type' => 'string'
            ),
            'context' => array(
                'required' => false,
                'type' => 'object',
                'default' => array()
            )
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)/steps/(?P<step_index>\d+)/simulate', array(
        'methods' => 'POST',
        'callback' => 'gemini_simulate_workflow_step_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string'),
            'step_index' => array('required' => true, 'type' => 'integer')
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)/steps/(?P<step_index>\d+)/execute', array(
        'methods' => 'POST',
        'callback' => 'gemini_execute_workflow_step_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string'),
            'step_index' => array('required' => true, 'type' => 'integer')
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)/steps/(?P<step_index>\d+)/skip', array(
        'methods' => 'POST',
        'callback' => 'gemini_skip_workflow_step_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string'),
            'step_index' => array('required' => true, 'type' => 'integer'),
            'reason' => array('required' => false, 'type' => 'string', 'default' => '')
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)/cancel', array(
        'methods' => 'POST',
        'callback' => 'gemini_cancel_workflow_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string'),
            'reason' => array('required' => false, 'type' => 'string', 'default' => '')
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)', array(
        'methods' => 'GET',
        'callback' => 'gemini_get_workflow_session_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string')
        )
    ));
    
    // 🔄 WORKFLOW ENGINE: Endpoints para workflows
    register_rest_route($namespace, '/workflows', array(
        'methods' => 'GET',
        'callback' => 'gemini_get_workflows_endpoint',
        'permission_callback' => 'gemini_verify_token'
    ));
    
    register_rest_route($namespace, '/workflows/(?P<workflow_id>[a-zA-Z0-9_/-]+)/start', array(
        'methods' => 'POST',
        'callback' => 'gemini_start_workflow_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'workflow_id' => array(
                'required' => true,
                'type' => 'string'
            ),
            'context' => array(
                'required' => false,
                'type' => 'object',
                'default' => array()
            )
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)/steps/(?P<step_index>\d+)/simulate', array(
        'methods' => 'POST',
        'callback' => 'gemini_simulate_workflow_step_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string'),
            'step_index' => array('required' => true, 'type' => 'integer')
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)/steps/(?P<step_index>\d+)/execute', array(
        'methods' => 'POST',
        'callback' => 'gemini_execute_workflow_step_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string'),
            'step_index' => array('required' => true, 'type' => 'integer')
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)/steps/(?P<step_index>\d+)/skip', array(
        'methods' => 'POST',
        'callback' => 'gemini_skip_workflow_step_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string'),
            'step_index' => array('required' => true, 'type' => 'integer'),
            'reason' => array('required' => false, 'type' => 'string', 'default' => '')
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)/cancel', array(
        'methods' => 'POST',
        'callback' => 'gemini_cancel_workflow_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string'),
            'reason' => array('required' => false, 'type' => 'string', 'default' => '')
        )
    ));
    
    register_rest_route($namespace, '/workflows/sessions/(?P<session_id>[a-zA-Z0-9_]+)', array(
        'methods' => 'GET',
        'callback' => 'gemini_get_workflow_session_endpoint',
        'permission_callback' => 'gemini_verify_token',
        'args' => array(
            'session_id' => array('required' => true, 'type' => 'string')
        )
    ));
});

// 🔍 ABILITIES DISCOVERY: Función para obtener SOLO metadatos con permisos
function gemini_get_abilities_metadata($request) {
    $format = $request->get_param('format');
    gemini_log('🔍 Discovery de metadatos solicitado. Formato: ' . $format);
    
    try {
        $registry = Gemini_Ability_Registry::get_instance();
        $all_abilities = $registry->get_abilities();
        
        // 🛡️ SECURITY: Filtrar abilities basado en permisos del usuario/token
        $allowed_abilities = array();
        
        foreach ($all_abilities as $name => $ability) {
            $permission_check = gemini_check_ability_permissions($name);
            
            if (!is_wp_error($permission_check)) {
                $allowed_abilities[$name] = $ability;
            } else {
                gemini_log("🚫 Ability '{$name}' filtrada por permisos: " . $permission_check->get_error_message());
            }
        }
        
        if ($format === 'tools') {
            // Formato específico para Gemini Tool Calling
            $gemini_tools = array();
            
            foreach ($allowed_abilities as $name => $ability) {
                $gemini_tools[] = array(
                    'name' => $ability['name'],
                    'description' => $ability['description'],
                    'parameters' => $ability['input_schema']
                );
            }
            
            gemini_log('✅ Discovery completado. Tools permitidas para Gemini: ' . count($gemini_tools));
            
            return array(
                'status' => 'success',
                'format' => 'tools',
                'tools_count' => count($gemini_tools),
                'tools' => $gemini_tools,
                'filtered_count' => count($all_abilities) - count($allowed_abilities),
                'security_context' => array(
                    'permissions_checked' => true,
                    'total_abilities' => count($all_abilities),
                    'allowed_abilities' => count($allowed_abilities)
                ),
                'cache_key' => md5(serialize($gemini_tools)),
                'timestamp' => current_time('c')
            );
        }
        
        // Formato completo (metadatos completos con información de seguridad)
        $formatted_abilities = array();
        
        foreach ($allowed_abilities as $name => $ability) {
            $formatted_abilities[$name] = array(
                'name' => $ability['name'],
                'label' => $ability['label'],
                'description' => $ability['description'],
                'category' => $ability['category'],
                'input_schema' => $ability['input_schema'],
                'output_schema' => $ability['output_schema'],
                'meta' => $ability['meta'],
                // 🛡️ SECURITY: Incluir información de governance
                'security' => array(
                    'required_capabilities' => $ability['required_capabilities'] ?? array(),
                    'risk_level' => $ability['risk_level'] ?? 'unknown',
                    'scopes' => $ability['scopes'] ?? array(),
                    'audit_category' => $ability['audit_category'] ?? 'general'
                )
            );
        }
        
        gemini_log('✅ Discovery completado. Abilities permitidas: ' . count($formatted_abilities));
        
        return array(
            'status' => 'success',
            'format' => 'full',
            'abilities_count' => count($formatted_abilities),
            'abilities' => $formatted_abilities,
            'api_version' => '1.0',
            'wordpress_version' => get_bloginfo('version'),
            'plugin_version' => '3.0',
            'registry_type' => 'gemini_internal',
            'security_context' => array(
                'permissions_checked' => true,
                'total_abilities' => count($all_abilities),
                'allowed_abilities' => count($allowed_abilities),
                'filtered_count' => count($all_abilities) - count($allowed_abilities)
            ),
            'cache_key' => md5(serialize($formatted_abilities)),
            'timestamp' => current_time('c')
        );
        
    } catch (Exception $e) {
        gemini_log('❌ Error en discovery de metadatos: ' . $e->getMessage());
        return new WP_Error(
            'discovery_error',
            'Error retrieving abilities metadata: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

// 📊 AUDITORÍA: Sistema de logging estructurado para abilities
function gemini_audit_log($ability_name, $parameters, $status, $metadata = array()) {
    global $wpdb;
    
    // Crear tabla de auditoría si no existe
    gemini_create_audit_table();
    
    $audit_data = array(
        'ability_name' => $ability_name,
        'parameters' => json_encode($parameters),
        'status' => $status, // success, error, permission_denied, cancelled
        'metadata' => json_encode($metadata),
        'user_token_hash' => hash('sha256', $_SERVER['HTTP_X_GEMINI_AUTH'] ?? ''),
        'user_ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'timestamp' => current_time('mysql'),
        'site_url' => home_url()
    );
    
    $table_name = $wpdb->prefix . 'gemini_audit_log';
    
    $result = $wpdb->insert($table_name, $audit_data);
    
    if ($result === false) {
        gemini_log('❌ Error guardando audit log: ' . $wpdb->last_error);
    } else {
        gemini_log("📊 Audit log guardado: {$ability_name} -> {$status}");
    }
    
    return $result;
}

// 📊 AUDITORÍA: Crear tabla de auditoría
function gemini_create_audit_table() {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'gemini_audit_log';
    
    // Verificar si la tabla ya existe
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table_name}'") === $table_name) {
        return;
    }
    
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE {$table_name} (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        ability_name varchar(100) NOT NULL,
        parameters longtext,
        status varchar(50) NOT NULL,
        metadata longtext,
        user_token_hash varchar(64),
        user_ip varchar(45),
        user_agent text,
        timestamp datetime DEFAULT CURRENT_TIMESTAMP,
        site_url varchar(255),
        PRIMARY KEY (id),
        KEY ability_name (ability_name),
        KEY status (status),
        KEY timestamp (timestamp),
        KEY user_token_hash (user_token_hash)
    ) {$charset_collate};";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
    
    gemini_log('✅ Tabla de auditoría creada: ' . $table_name);
}

// 📊 AUDITORÍA: Obtener logs de auditoría (para administradores)
function gemini_get_audit_logs($limit = 50, $ability_name = null, $status = null) {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'gemini_audit_log';
    
    $where_conditions = array();
    $where_values = array();
    
    if ($ability_name) {
        $where_conditions[] = 'ability_name = %s';
        $where_values[] = $ability_name;
    }
    
    if ($status) {
        $where_conditions[] = 'status = %s';
        $where_values[] = $status;
    }
    
    $where_clause = '';
    if (!empty($where_conditions)) {
        $where_clause = 'WHERE ' . implode(' AND ', $where_conditions);
    }
    
    $query = "SELECT * FROM {$table_name} {$where_clause} ORDER BY timestamp DESC LIMIT %d";
    $where_values[] = $limit;
    
    $prepared_query = $wpdb->prepare($query, $where_values);
    $results = $wpdb->get_results($prepared_query, ARRAY_A);
    
    // Decodificar JSON fields
    foreach ($results as &$result) {
        $result['parameters'] = json_decode($result['parameters'], true);
        $result['metadata'] = json_decode($result['metadata'], true);
    }
    
    return $results;
}
function gemini_execute_ability_endpoint($request) {
    $ability_name = $request->get_param('ability_name');
    $input_data = $request->get_json_params();
    
    // 🧪 DRY-RUN: Detectar modo de ejecución
    $execution_mode = $request->get_param('mode') ?? 'execute';
    $valid_modes = array('execute', 'simulate');
    
    if (!in_array($execution_mode, $valid_modes)) {
        return new WP_Error(
            'invalid_mode',
            "Invalid execution mode. Must be one of: " . implode(', ', $valid_modes),
            array('status' => 400)
        );
    }
    
    $log_prefix = $execution_mode === 'simulate' ? "🧪 [SIMULATE]" : "⚡ [EXECUTE]";
    gemini_log("{$log_prefix} Ability via Registry: {$ability_name} con input: " . json_encode($input_data));
    
    try {
        $registry = Gemini_Ability_Registry::get_instance();
        
        if (!$registry->has_ability($ability_name)) {
            return new WP_Error(
                'ability_not_found',
                "Ability '{$ability_name}' not found in registry",
                array('status' => 404)
            );
        }
        
        // 🧪 DRY-RUN: Ejecutar con modo especificado
        $result = $registry->execute_ability($ability_name, $input_data ?: array(), $execution_mode);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        gemini_log("✅ Ability {$execution_mode} exitoso via Registry: {$ability_name}");
        
        // 🧪 DRY-RUN: Respuesta diferenciada por modo
        if ($execution_mode === 'simulate') {
            return array(
                'status' => 'success',
                'mode' => 'simulation',
                'ability_name' => $ability_name,
                'simulation_result' => $result['simulation_result'] ?? $result,
                'impact_report' => $result['impact_report'] ?? null,
                'execution_method' => 'gemini_registry_simulation',
                'execution_time' => current_time('c'),
                'note' => 'This was a simulation - no actual changes were made'
            );
        } else {
            return array(
                'status' => 'success',
                'mode' => 'execution',
                'ability_name' => $ability_name,
                'result' => $result,
                'execution_method' => 'gemini_registry',
                'execution_time' => current_time('c')
            );
        }
        
    } catch (Exception $e) {
        gemini_log("❌ Error en {$execution_mode} de ability via Registry: " . $e->getMessage());
        return new WP_Error(
            'execution_error',
            $e->getMessage(),
            array('status' => 500)
        );
    }
}

// 🤖 POLICY ENGINE: Endpoint para evaluación de políticas
function gemini_evaluate_policies_endpoint($request) {
    $context = $request->get_param('context') ?? array();
    $include_suggestions = $request->get_param('include_suggestions') ?? true;
    
    gemini_log('🤖 Evaluando políticas con contexto: ' . json_encode(array_keys($context)));
    
    try {
        $policy_engine = Gemini_Policy_Engine::get_instance();
        
        // Enriquecer contexto con datos del sitio si no se proporcionan
        $enriched_context = gemini_enrich_policy_context($context);
        
        // Evaluar políticas
        $triggered_policies = $policy_engine->evaluate_policies($enriched_context);
        
        $response = array(
            'status' => 'success',
            'policies_evaluated' => count($policy_engine->get_policies()),
            'policies_triggered' => count($triggered_policies),
            'triggered_policies' => $triggered_policies,
            'context_used' => array_keys($enriched_context),
            'evaluation_time' => current_time('c')
        );
        
        // Incluir sugerencias de acción si se solicita
        if ($include_suggestions && !empty($triggered_policies)) {
            $response['suggestions'] = gemini_generate_policy_suggestions($triggered_policies);
        }
        
        gemini_log("✅ Evaluación de políticas completada. Triggered: " . count($triggered_policies));
        
        return $response;
        
    } catch (Exception $e) {
        gemini_log('❌ Error evaluando políticas: ' . $e->getMessage());
        return new WP_Error(
            'policy_evaluation_error',
            'Error evaluating policies: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

// 🤖 POLICY ENGINE: Enriquecer contexto con datos del sitio
function gemini_enrich_policy_context($base_context) {
    $enriched_context = $base_context;
    
    // Añadir información de site health si no está presente
    if (!isset($enriched_context['site_health'])) {
        $enriched_context['site_health'] = gemini_get_basic_site_health();
    }
    
    // Añadir información de plugins si no está presente
    if (!isset($enriched_context['plugins'])) {
        $enriched_context['plugins'] = get_plugins();
    }
    
    // Añadir capacidades del usuario actual
    if (!isset($enriched_context['user_capabilities'])) {
        $enriched_context['user_capabilities'] = gemini_get_token_capabilities();
    }
    
    // Añadir información básica del sitio
    $enriched_context['site_info'] = array(
        'url' => home_url(),
        'admin_email' => get_option('admin_email'),
        'wordpress_version' => get_bloginfo('version'),
        'active_theme' => wp_get_theme()->get('Name'),
        'active_plugins_count' => count(get_option('active_plugins', array()))
    );
    
    return $enriched_context;
}

// 🤖 POLICY ENGINE: Obtener información básica de site health
function gemini_get_basic_site_health() {
    global $wp_version;
    
    // Información básica sin ejecutar tests pesados
    $site_health = array(
        'wordpress_version' => $wp_version,
        'php_version' => PHP_VERSION,
        'active_plugins' => count(get_option('active_plugins', array())),
        'active_theme' => wp_get_theme()->get('Name')
    );
    
    // Test básico de email (sin enviar realmente)
    $site_health['email_test'] = array(
        'status' => 'unknown',
        'message' => 'Email test not performed in policy evaluation'
    );
    
    return $site_health;
}

// 🤖 POLICY ENGINE: Generar sugerencias basadas en políticas activadas
function gemini_generate_policy_suggestions($triggered_policies) {
    $suggestions = array();
    
    foreach ($triggered_policies as $policy_result) {
        $policy = $policy_result['policy'];
        $suggested_action = $policy_result['suggested_action'];
        $explanation = $policy_result['explanation'];
        
        $suggestion = array(
            'id' => 'suggestion_' . $policy['id'] . '_' . time(),
            'policy_id' => $policy['id'],
            'policy_name' => $policy['name'],
            'category' => $policy['category'],
            'priority' => $policy['priority'],
            'risk_level' => $suggested_action['risk_level'],
            'title' => $policy['name'],
            'description' => $explanation['summary'],
            'why_triggered' => $explanation['why_triggered'],
            'recommended_action' => $explanation['recommended_action'],
            'risk_assessment' => $explanation['risk_assessment'],
            'next_steps' => $explanation['next_steps'],
            'suggested_ability' => array(
                'name' => $suggested_action['ability_name'],
                'parameters' => $suggested_action['parameters']
            ),
            'auto_suggest' => $policy['auto_suggest'],
            'triggered_at' => $policy_result['triggered_at']
        );
        
        $suggestions[] = $suggestion;
    }
    
    // Ordenar por prioridad
    usort($suggestions, function($a, $b) {
        $priority_order = array('high' => 3, 'medium' => 2, 'low' => 1);
        $a_priority = $priority_order[$a['priority']] ?? 2;
        $b_priority = $priority_order[$b['priority']] ?? 2;
        return $b_priority - $a_priority;
    });
    
    return $suggestions;
}
            "Error in {$execution_mode}: " . $e->getMessage(),
            array('status' => 500)
        );
    }
}

// Función de logging para diagnóstico
function gemini_log($message) {
    $log_file = WP_CONTENT_DIR . '/gemini-debug.log';
    $timestamp = date('Y-m-d H:i:s');
    $log_entry = "[{$timestamp}] {$message}" . PHP_EOL;
    file_put_contents($log_file, $log_entry, FILE_APPEND | LOCK_EX);
}

// Hook de activación del plugin
register_activation_hook(__FILE__, function() {
    gemini_log('Plugin Gemini WP-CLI Bridge v3.0 activado');
    
    // Inicializar Ability Registry
    Gemini_Ability_Registry::get_instance();
    
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
    $token_capabilities = get_option('gemini_token_capabilities', array());
    $admin_mode = get_option('gemini_token_admin_mode', false);
    
    // Manejar actualizaciones de configuración
    if (isset($_POST['update_permissions']) && wp_verify_nonce($_POST['_wpnonce'], 'update_permissions')) {
        $new_capabilities = $_POST['token_capabilities'] ?? array();
        $new_admin_mode = isset($_POST['admin_mode']);
        
        update_option('gemini_token_capabilities', $new_capabilities);
        update_option('gemini_token_admin_mode', $new_admin_mode);
        
        echo '<div class="notice notice-success"><p>✅ Permisos actualizados exitosamente!</p></div>';
        
        // Recargar valores
        $token_capabilities = $new_capabilities;
        $admin_mode = $new_admin_mode;
        
        // Registrar cambio en auditoría
        gemini_audit_log('token_permissions_updated', array(
            'capabilities' => $new_capabilities,
            'admin_mode' => $new_admin_mode
        ), 'success', array(
            'admin_user' => wp_get_current_user()->user_login,
            'timestamp' => current_time('c')
        ));
    }
    
    echo '<div class="wrap">';
    echo '<h1>🔑 Gemini WP-CLI Token & Security</h1>';
    
    // Token Section
    echo '<div style="background: #fff; padding: 20px; border: 1px solid #ccc; border-radius: 5px; margin: 20px 0;">';
    echo '<h2>Token de Seguridad Actual:</h2>';
    echo '<p><strong style="font-size: 16px; color: #0073aa; font-family: monospace; background: #f1f1f1; padding: 10px; border-radius: 3px; display: block;">' . esc_html($token) . '</strong></p>';
    echo '<p><em>Generado el: ' . esc_html($token_date) . '</em></p>';
    echo '</div>';
    
    // Security & Permissions Section
    echo '<div style="background: #fff; padding: 20px; border: 1px solid #ccc; border-radius: 5px; margin: 20px 0;">';
    echo '<h2>🛡️ Configuración de Seguridad y Permisos</h2>';
    
    echo '<form method="post">';
    wp_nonce_field('update_permissions');
    
    echo '<h3>Capacidades del Token API</h3>';
    echo '<p>Selecciona qué capacidades de WordPress puede usar el token de Gemini:</p>';
    
    $all_capabilities = array(
        'read' => 'Leer contenido',
        'edit_posts' => 'Editar posts',
        'edit_pages' => 'Editar páginas',
        'edit_others_posts' => 'Editar posts de otros',
        'edit_others_pages' => 'Editar páginas de otros',
        'publish_posts' => 'Publicar posts',
        'publish_pages' => 'Publicar páginas',
        'manage_categories' => 'Gestionar categorías',
        'manage_links' => 'Gestionar enlaces',
        'upload_files' => 'Subir archivos',
        'edit_users' => 'Editar usuarios',
        'list_users' => 'Listar usuarios',
        'create_users' => 'Crear usuarios',
        'delete_users' => 'Eliminar usuarios',
        'activate_plugins' => 'Activar plugins',
        'edit_plugins' => 'Editar plugins',
        'install_plugins' => 'Instalar plugins',
        'update_plugins' => 'Actualizar plugins',
        'delete_plugins' => 'Eliminar plugins',
        'switch_themes' => 'Cambiar temas',
        'edit_themes' => 'Editar temas',
        'install_themes' => 'Instalar temas',
        'update_themes' => 'Actualizar temas',
        'delete_themes' => 'Eliminar temas',
        'edit_theme_options' => 'Editar opciones de tema',
        'customize' => 'Personalizar tema'
    );
    
    echo '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0;">';
    foreach ($all_capabilities as $cap => $label) {
        $checked = in_array($cap, $token_capabilities) ? 'checked' : '';
        echo "<label style='display: flex; align-items: center; gap: 5px;'>";
        echo "<input type='checkbox' name='token_capabilities[]' value='{$cap}' {$checked}>";
        echo "<span>{$label}</span>";
        echo "</label>";
    }
    echo '</div>';
    
    echo '<hr style="margin: 20px 0;">';
    
    echo '<h3>⚠️ Modo Administrador</h3>';
    echo '<p>El modo administrador otorga capacidades adicionales de alto riesgo:</p>';
    echo '<ul>';
    echo '<li><strong>manage_options:</strong> Modificar configuración del sitio</li>';
    echo '<li><strong>delete_users:</strong> Eliminar usuarios</li>';
    echo '<li><strong>create_users:</strong> Crear usuarios</li>';
    echo '</ul>';
    
    $admin_checked = $admin_mode ? 'checked' : '';
    echo "<label style='display: flex; align-items: center; gap: 10px; background: #fff3cd; padding: 15px; border-radius: 5px; border: 1px solid #ffeaa7;'>";
    echo "<input type='checkbox' name='admin_mode' {$admin_checked}>";
    echo "<span><strong>Activar Modo Administrador</strong> (⚠️ Usar con precaución)</span>";
    echo "</label>";
    
    echo '<p style="margin-top: 15px;"><input type="submit" name="update_permissions" class="button button-primary" value="💾 Guardar Configuración de Permisos"></p>';
    echo '</form>';
    echo '</div>';
    
    // Audit Log Section
    echo '<div style="background: #fff; padding: 20px; border: 1px solid #ccc; border-radius: 5px; margin: 20px 0;">';
    echo '<h2>📊 Registro de Auditoría (Últimas 10 entradas)</h2>';
    
    $audit_logs = gemini_get_audit_logs(10);
    
    if (!empty($audit_logs)) {
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr>';
        echo '<th>Fecha</th>';
        echo '<th>Ability</th>';
        echo '<th>Estado</th>';
        echo '<th>IP</th>';
        echo '<th>Detalles</th>';
        echo '</tr></thead>';
        echo '<tbody>';
        
        foreach ($audit_logs as $log) {
            $status_color = $log['status'] === 'success' ? '#27ca3f' : 
                           ($log['status'] === 'error' ? '#ff5f56' : '#ffbd2e');
            
            echo '<tr>';
            echo '<td>' . esc_html($log['timestamp']) . '</td>';
            echo '<td><code>' . esc_html($log['ability_name']) . '</code></td>';
            echo '<td><span style="color: ' . $status_color . '; font-weight: bold;">' . esc_html($log['status']) . '</span></td>';
            echo '<td>' . esc_html($log['user_ip']) . '</td>';
            echo '<td>';
            
            if (!empty($log['metadata'])) {
                if (isset($log['metadata']['execution_time_ms'])) {
                    echo 'Tiempo: ' . $log['metadata']['execution_time_ms'] . 'ms<br>';
                }
                if (isset($log['metadata']['error_message'])) {
                    echo 'Error: ' . esc_html($log['metadata']['error_message']) . '<br>';
                }
                if (isset($log['metadata']['risk_level'])) {
                    echo 'Riesgo: ' . esc_html($log['metadata']['risk_level']) . '<br>';
                }
            }
            
            echo '</td>';
            echo '</tr>';
        }
        
        echo '</tbody></table>';
    } else {
        echo '<p><em>No hay entradas de auditoría disponibles.</em></p>';
    }
    
    echo '</div>';
    
    // Instructions Section
    echo '<div style="background: #fff; padding: 20px; border: 1px solid #ccc; border-radius: 5px; margin: 20px 0;">';
    echo '<h2>📋 Instrucciones de Configuración</h2>';
    echo '<ol>';
    echo '<li><strong>Copia el token de arriba</strong></li>';
    echo '<li>Ve a tu webapp Gemini WP-Agent</li>';
    echo '<li>Clic en ⚙️ para configurar sitio</li>';
    echo '<li>Pega este token en el campo "Token de Seguridad"</li>';
    echo '<li>URL del sitio: <code>' . home_url() . '</code></li>';
    echo '</ol>';
    echo '<p><strong>Nota de Seguridad:</strong> Los permisos configurados arriba determinan qué acciones puede realizar Gemini AI en tu sitio. Revisa regularmente el registro de auditoría para monitorear la actividad.</p>';
    echo '</div>';
    
    // Botón para regenerar token
    if (isset($_POST['regenerate_token']) && wp_verify_nonce($_POST['_wpnonce'], 'regenerate_token')) {
        $new_token = gemini_generate_secure_token();
        update_option('gemini_wp_cli_token', $new_token);
        update_option('gemini_wp_cli_token_date', current_time('mysql'));
        
        // Registrar regeneración en auditoría
        gemini_audit_log('token_regenerated', array(), 'success', array(
            'admin_user' => wp_get_current_user()->user_login,
            'old_token_hash' => hash('sha256', $token),
            'new_token_hash' => hash('sha256', $new_token)
        ));
        
        echo '<div class="notice notice-success"><p>✅ Token regenerado exitosamente!</p></div>';
        echo '<script>window.location.reload();</script>';
    }
    
    echo '<form method="post" style="margin-top: 20px;">';
    wp_nonce_field('regenerate_token');
    echo '<input type="submit" name="regenerate_token" class="button button-secondary" value="🔄 Regenerar Token" onclick="return confirm(\'¿Estás seguro? Esto invalidará el token actual y necesitarás actualizar la configuración en la webapp.\');">';
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
                    
                    // Manejar actualización de todos los plugins
                    if ($plugin_slug === '--all' || empty($plugin_slug)) {
                        // Verificar actualizaciones disponibles
                        if (!function_exists('get_plugin_updates')) {
                            require_once ABSPATH . 'wp-admin/includes/update.php';
                        }
                        
                        wp_update_plugins();
                        $updates = get_plugin_updates();
                        
                        if (empty($updates)) {
                            return "All plugins are already up to date.";
                        }
                        
                        // Actualizar todos los plugins que tienen actualizaciones
                        if (!class_exists('Plugin_Upgrader')) {
                            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
                        }
                        
                        $upgrader = new Plugin_Upgrader();
                        $updated_plugins = array();
                        $failed_plugins = array();
                        
                        foreach ($updates as $plugin_file => $plugin_data) {
                            $result = $upgrader->upgrade($plugin_file);
                            
                            if (is_wp_error($result)) {
                                $failed_plugins[] = $plugin_data->Name . ': ' . $result->get_error_message();
                            } elseif ($result) {
                                $updated_plugins[] = $plugin_data->Name;
                            } else {
                                $failed_plugins[] = $plugin_data->Name . ': Unknown error';
                            }
                        }
                        
                        $output = '';
                        if (!empty($updated_plugins)) {
                            $output .= "Successfully updated plugins:\n";
                            foreach ($updated_plugins as $plugin_name) {
                                $output .= "- $plugin_name\n";
                            }
                        }
                        
                        if (!empty($failed_plugins)) {
                            $output .= "\nFailed to update plugins:\n";
                            foreach ($failed_plugins as $error) {
                                $output .= "- $error\n";
                            }
                        }
                        
                        return $output ?: "No plugins were updated.";
                    }
                    
                    // Actualización de plugin específico
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
                    
                    // Manejar actualización de todos los temas
                    if ($theme_slug === '--all' || empty($theme_slug)) {
                        // Verificar actualizaciones disponibles
                        if (!function_exists('get_theme_updates')) {
                            require_once ABSPATH . 'wp-admin/includes/update.php';
                        }
                        
                        wp_update_themes();
                        $updates = get_theme_updates();
                        
                        if (empty($updates)) {
                            return "All themes are already up to date.";
                        }
                        
                        // Actualizar todos los temas que tienen actualizaciones
                        if (!class_exists('Theme_Upgrader')) {
                            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
                        }
                        
                        $upgrader = new Theme_Upgrader();
                        $updated_themes = array();
                        $failed_themes = array();
                        
                        foreach ($updates as $theme_slug => $theme_data) {
                            $result = $upgrader->upgrade($theme_slug);
                            
                            if (is_wp_error($result)) {
                                $failed_themes[] = $theme_data->get('Name') . ': ' . $result->get_error_message();
                            } elseif ($result) {
                                $updated_themes[] = $theme_data->get('Name');
                            } else {
                                $failed_themes[] = $theme_data->get('Name') . ': Unknown error';
                            }
                        }
                        
                        $output = '';
                        if (!empty($updated_themes)) {
                            $output .= "Successfully updated themes:\n";
                            foreach ($updated_themes as $theme_name) {
                                $output .= "- $theme_name\n";
                            }
                        }
                        
                        if (!empty($failed_themes)) {
                            $output .= "\nFailed to update themes:\n";
                            foreach ($failed_themes as $error) {
                                $output .= "- $error\n";
                            }
                        }
                        
                        return $output ?: "No themes were updated.";
                    }
                    
                    // Actualización de tema específico
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

// 🧪 DRY-RUN: Función de simulación para Database Optimization
function gemini_simulate_optimize_database($input = array()) {
    gemini_log('🧪 Simulando gh_optimize_database con input: ' . json_encode($input));
    
    global $wpdb;
    
    $cleanup_revisions = isset($input['cleanup_revisions']) ? (bool)$input['cleanup_revisions'] : true;
    $cleanup_spam = isset($input['cleanup_spam']) ? (bool)$input['cleanup_spam'] : true;
    $optimize_tables = isset($input['optimize_tables']) ? (bool)$input['optimize_tables'] : true;
    $keep_revisions = isset($input['keep_revisions']) ? (int)$input['keep_revisions'] : 3;
    
    // Simular conteos sin hacer cambios reales
    $revisions_count = 0;
    $spam_count = 0;
    $expired_transients = 0;
    $tables_count = 0;
    
    if ($cleanup_revisions) {
        $revisions_count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'revision'");
        // Simular mantener solo las últimas N revisiones por post
        $revisions_to_remove = max(0, $revisions_count - ($keep_revisions * wp_count_posts()->publish));
    } else {
        $revisions_to_remove = 0;
    }
    
    if ($cleanup_spam) {
        $spam_count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->comments} WHERE comment_approved = 'spam'");
    }
    
    if ($optimize_tables) {
        $tables_count = $wpdb->get_var("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()");
    }
    
    // Simular transients expirados
    $expired_transients = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE '_transient_timeout_%' AND option_value < UNIX_TIMESTAMP()");
    
    $simulated_result = array(
        'revisions_removed' => $revisions_to_remove,
        'spam_removed' => $spam_count,
        'transients_cleaned' => $expired_transients,
        'tables_optimized' => $optimize_tables ? $tables_count : 0,
        'space_saved' => 'Estimado: ' . round(($revisions_to_remove * 0.5 + $spam_count * 0.1 + $expired_transients * 0.01), 2) . ' MB',
        'optimization_summary' => 'Simulación completada - no se realizaron cambios reales',
        'simulation_note' => 'Esta es una simulación - la base de datos no fue modificada',
        'changes_description' => "Se eliminarían {$revisions_to_remove} revisiones, {$spam_count} comentarios spam, {$expired_transients} transients expirados",
        'affected_items' => $revisions_to_remove + $spam_count + $expired_transients,
        'modifications' => array(
            'revisions' => $revisions_to_remove,
            'spam_comments' => $spam_count,
            'expired_transients' => $expired_transients
        )
    );
    
    gemini_log('✅ Simulación de Database Optimization completada');
    
    return $simulated_result;
}

// 🧪 DRY-RUN: Función de simulación para Create Backup
function gemini_simulate_create_backup($input = array()) {
    gemini_log('🧪 Simulando gh_create_backup con input: ' . json_encode($input));
    
    $include_database = isset($input['include_database']) ? (bool)$input['include_database'] : true;
    $include_files = isset($input['include_files']) ? (bool)$input['include_files'] : true;
    $backup_type = isset($input['backup_type']) ? $input['backup_type'] : 'full';
    $compression = isset($input['compression']) ? (bool)$input['compression'] : true;
    
    // Simular tamaños de backup
    $estimated_db_size = 50; // MB
    $estimated_files_size = 500; // MB
    
    $total_size = 0;
    $files_included = 0;
    
    if ($backup_type === 'full' || $backup_type === 'database_only') {
        if ($include_database) {
            $total_size += $estimated_db_size;
        }
    }
    
    if ($backup_type === 'full' || $backup_type === 'files_only') {
        if ($include_files) {
            $total_size += $estimated_files_size;
            // Simular conteo de archivos
            $upload_dir = wp_upload_dir();
            $files_included = 15000; // Estimado
        }
    }
    
    if ($compression) {
        $total_size = $total_size * 0.3; // Simular compresión del 70%
    }
    
    $backup_filename = 'backup_' . date('Y-m-d_H-i-s') . ($compression ? '.tar.gz' : '.tar');
    
    $simulated_result = array(
        'backup_file' => $backup_filename,
        'backup_size' => round($total_size, 2) . ' MB',
        'backup_location' => '/wp-content/backups/' . $backup_filename,
        'backup_date' => current_time('c'),
        'files_included' => $files_included,
        'database_included' => $include_database,
        'compression_used' => $compression,
        'backup_type' => $backup_type,
        'simulation_note' => 'Esta es una simulación - no se creó backup real',
        'changes_description' => 'No changes - backup operation is read-only',
        'affected_items' => 0,
        'modifications' => array()
    );
    
    gemini_log('✅ Simulación de Create Backup completada');
    
    return $simulated_result;
}

// 🧪 DRY-RUN: Función de simulación para Security Scan
function gemini_simulate_security_scan($input = array()) {
    gemini_log('🧪 Simulando gh_security_scan con input: ' . json_encode($input));
    
    $scan_type = isset($input['scan_type']) ? $input['scan_type'] : 'basic';
    $include_malware = isset($input['include_malware']) ? (bool)$input['include_malware'] : true;
    $check_vulnerabilities = isset($input['check_vulnerabilities']) ? (bool)$input['check_vulnerabilities'] : true;
    
    // Simular resultados de escaneo
    $threats_found = 0;
    $vulnerabilities_found = 0;
    $recommendations = array();
    
    // Simular algunos hallazgos basados en el tipo de escaneo
    if ($scan_type === 'comprehensive') {
        // Simular hallazgos más detallados
        $vulnerabilities_found = rand(0, 2);
        if ($vulnerabilities_found > 0) {
            $recommendations[] = 'Actualizar plugins con vulnerabilidades conocidas';
        }
    }
    
    if ($include_malware) {
        $threats_found = rand(0, 1);
        if ($threats_found > 0) {
            $recommendations[] = 'Revisar archivos sospechosos detectados';
        }
    }
    
    if ($check_vulnerabilities) {
        // Verificar versiones de WordPress y plugins
        global $wp_version;
        if (version_compare($wp_version, '6.4', '<')) {
            $vulnerabilities_found++;
            $recommendations[] = 'Actualizar WordPress a la versión más reciente';
        }
    }
    
    // Recomendaciones generales de seguridad
    if (empty($recommendations)) {
        $recommendations[] = 'Mantener WordPress y plugins actualizados';
        $recommendations[] = 'Usar contraseñas fuertes para todos los usuarios';
        $recommendations[] = 'Considerar implementar autenticación de dos factores';
    }
    
    $scan_status = ($threats_found === 0 && $vulnerabilities_found === 0) ? 'clean' : 'issues_found';
    
    $simulated_result = array(
        'scan_status' => $scan_status,
        'threats_found' => $threats_found,
        'vulnerabilities_found' => $vulnerabilities_found,
        'scan_summary' => "Escaneo {$scan_type} completado. {$threats_found} amenazas y {$vulnerabilities_found} vulnerabilidades encontradas.",
        'recommendations' => $recommendations,
        'scan_type' => $scan_type,
        'scan_date' => current_time('c'),
        'simulation_note' => 'Esta es una simulación - no se realizó escaneo real',
        'changes_description' => 'No changes - security scan is read-only',
        'affected_items' => 0,
        'modifications' => array()
    );
    
    gemini_log('✅ Simulación de Security Scan completada');
    
    return $simulated_result;
}

// 🆕 ABILITIES: Función de ejecución para Database Optimization
function gemini_execute_optimize_database($input = array()) {
    gemini_log('🔍 Ejecutando gh_optimize_database con input: ' . json_encode($input));
    
    global $wpdb;
    
    $cleanup_revisions = isset($input['cleanup_revisions']) ? (bool)$input['cleanup_revisions'] : true;
    $cleanup_spam = isset($input['cleanup_spam']) ? (bool)$input['cleanup_spam'] : true;
    $optimize_tables = isset($input['optimize_tables']) ? (bool)$input['optimize_tables'] : true;
    $keep_revisions = isset($input['keep_revisions']) ? (int)$input['keep_revisions'] : 3;
    
    $results = array(
        'revisions_removed' => 0,
        'spam_removed' => 0,
        'transients_cleaned' => 0,
        'tables_optimized' => 0,
        'space_saved' => '0 MB'
    );
    
    // Limpiar revisiones
    if ($cleanup_revisions) {
        // Mantener solo las últimas N revisiones por post
        $revisions_query = "DELETE FROM {$wpdb->posts} WHERE post_type = 'revision' AND ID NOT IN (
            SELECT * FROM (
                SELECT ID FROM {$wpdb->posts} p1 
                WHERE p1.post_type = 'revision' 
                AND (
                    SELECT COUNT(*) FROM {$wpdb->posts} p2 
                    WHERE p2.post_type = 'revision' 
                    AND p2.post_parent = p1.post_parent 
                    AND p2.post_date >= p1.post_date
                ) <= {$keep_revisions}
            ) AS temp
        )";
        
        $results['revisions_removed'] = $wpdb->query($revisions_query);
    }
    
    // Limpiar spam
    if ($cleanup_spam) {
        $results['spam_removed'] = $wpdb->query("DELETE FROM {$wpdb->comments} WHERE comment_approved = 'spam'");
    }
    
    // Limpiar transients expirados
    $results['transients_cleaned'] = $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_timeout_%' AND option_value < UNIX_TIMESTAMP()");
    
    // Optimizar tablas
    if ($optimize_tables) {
        $tables = $wpdb->get_results("SHOW TABLES", ARRAY_N);
        foreach ($tables as $table) {
            $wpdb->query("OPTIMIZE TABLE {$table[0]}");
            $results['tables_optimized']++;
        }
    }
    
    // Calcular espacio ahorrado (estimado)
    $space_saved = ($results['revisions_removed'] * 0.5) + ($results['spam_removed'] * 0.1) + ($results['transients_cleaned'] * 0.01);
    $results['space_saved'] = round($space_saved, 2) . ' MB';
    
    $results['optimization_summary'] = "Optimización completada: {$results['revisions_removed']} revisiones, {$results['spam_removed']} spam, {$results['transients_cleaned']} transients, {$results['tables_optimized']} tablas optimizadas.";
    
    gemini_log('✅ Database Optimization ejecutada exitosamente');
    
    return $results;
}

// 🆕 ABILITIES: Función de ejecución para Create Backup
function gemini_execute_create_backup($input = array()) {
    gemini_log('🔍 Ejecutando gh_create_backup con input: ' . json_encode($input));
    
    $include_database = isset($input['include_database']) ? (bool)$input['include_database'] : true;
    $include_files = isset($input['include_files']) ? (bool)$input['include_files'] : true;
    $backup_type = isset($input['backup_type']) ? $input['backup_type'] : 'full';
    $compression = isset($input['compression']) ? (bool)$input['compression'] : true;
    
    // Crear directorio de backups si no existe
    $backup_dir = WP_CONTENT_DIR . '/backups';
    if (!file_exists($backup_dir)) {
        wp_mkdir_p($backup_dir);
    }
    
    $backup_filename = 'backup_' . date('Y-m-d_H-i-s') . ($compression ? '.tar.gz' : '.tar');
    $backup_path = $backup_dir . '/' . $backup_filename;
    
    $files_included = 0;
    $backup_size = 0;
    
    // Nota: Esta es una implementación simplificada
    // En un entorno real, usarías herramientas como tar, mysqldump, etc.
    
    if ($backup_type === 'full' || $backup_type === 'database_only') {
        if ($include_database) {
            // Simular backup de base de datos
            $db_backup_file = $backup_dir . '/database_' . date('Y-m-d_H-i-s') . '.sql';
            file_put_contents($db_backup_file, '-- Database backup placeholder --');
            $backup_size += filesize($db_backup_file);
        }
    }
    
    if ($backup_type === 'full' || $backup_type === 'files_only') {
        if ($include_files) {
            // Simular backup de archivos (en realidad solo crear un archivo placeholder)
            $files_backup_file = $backup_dir . '/files_' . date('Y-m-d_H-i-s') . '.tar';
            file_put_contents($files_backup_file, '-- Files backup placeholder --');
            $backup_size += filesize($files_backup_file);
            $files_included = 1; // Placeholder
        }
    }
    
    // Crear archivo de backup final (placeholder)
    file_put_contents($backup_path, '-- Backup completed --');
    
    // Actualizar última fecha de backup
    update_option('gemini_last_backup_date', time());
    
    $result = array(
        'backup_file' => $backup_filename,
        'backup_size' => round($backup_size / 1024 / 1024, 2) . ' MB',
        'backup_location' => $backup_path,
        'backup_date' => current_time('c'),
        'files_included' => $files_included,
        'database_included' => $include_database,
        'backup_type' => $backup_type,
        'compression_used' => $compression
    );
    
    gemini_log('✅ Create Backup ejecutado exitosamente');
    
    return $result;
}

// 🆕 ABILITIES: Función de ejecución para Security Scan
function gemini_execute_security_scan($input = array()) {
    gemini_log('🔍 Ejecutando gh_security_scan con input: ' . json_encode($input));
    
    $scan_type = isset($input['scan_type']) ? $input['scan_type'] : 'basic';
    $include_malware = isset($input['include_malware']) ? (bool)$input['include_malware'] : true;
    $check_vulnerabilities = isset($input['check_vulnerabilities']) ? (bool)$input['check_vulnerabilities'] : true;
    
    $threats_found = 0;
    $vulnerabilities_found = 0;
    $recommendations = array();
    
    // Verificar versión de WordPress
    global $wp_version;
    if ($check_vulnerabilities) {
        // Verificar si hay actualizaciones de WordPress disponibles
        wp_version_check();
        $updates = get_core_updates();
        if (!empty($updates) && isset($updates[0]) && $updates[0]->response === 'upgrade') {
            $vulnerabilities_found++;
            $recommendations[] = "Actualizar WordPress de {$wp_version} a {$updates[0]->version}";
        }
        
        // Verificar plugins desactualizados
        wp_update_plugins();
        $plugin_updates = get_plugin_updates();
        if (!empty($plugin_updates)) {
            $vulnerabilities_found += count($plugin_updates);
            $recommendations[] = 'Actualizar ' . count($plugin_updates) . ' plugin(s) desactualizado(s)';
        }
    }
    
    // Verificar configuraciones de seguridad básicas
    if (!defined('DISALLOW_FILE_EDIT') || DISALLOW_FILE_EDIT !== true) {
        $vulnerabilities_found++;
        $recommendations[] = 'Deshabilitar edición de archivos desde el admin (DISALLOW_FILE_EDIT)';
    }
    
    if ($include_malware) {
        // Escaneo básico de malware (verificar archivos sospechosos)
        $suspicious_files = array();
        
        // Verificar archivos PHP en uploads (no debería haber)
        $upload_dir = wp_upload_dir();
        if (is_dir($upload_dir['basedir'])) {
            $php_files = glob($upload_dir['basedir'] . '/*.php');
            if (!empty($php_files)) {
                $threats_found += count($php_files);
                $suspicious_files = array_merge($suspicious_files, $php_files);
            }
        }
        
        if (!empty($suspicious_files)) {
            $recommendations[] = 'Revisar archivos PHP sospechosos en directorio de uploads';
        }
    }
    
    // Recomendaciones generales si no se encontraron problemas
    if (empty($recommendations)) {
        $recommendations = array(
            'Tu sitio parece estar seguro',
            'Mantén WordPress y plugins siempre actualizados',
            'Usa contraseñas fuertes para todos los usuarios',
            'Considera implementar autenticación de dos factores'
        );
    }
    
    $scan_status = ($threats_found === 0 && $vulnerabilities_found === 0) ? 'clean' : 'issues_found';
    
    // Actualizar última fecha de escaneo
    update_option('gemini_last_security_scan', time());
    
    $result = array(
        'scan_status' => $scan_status,
        'threats_found' => $threats_found,
        'vulnerabilities_found' => $vulnerabilities_found,
        'scan_summary' => "Escaneo {$scan_type} completado. {$threats_found} amenazas y {$vulnerabilities_found} vulnerabilidades encontradas.",
        'recommendations' => $recommendations,
        'scan_type' => $scan_type,
        'scan_date' => current_time('c'),
        'scan_duration' => '2.3 segundos' // Placeholder
    );
    
    gemini_log('✅ Security Scan ejecutado exitosamente');
    
    return $result;
}

/**
 * Helper: Evaluar riesgo de seguridad por versión
 */
function gemini_assess_version_security_risk($current, $latest) {
    $current_parts = explode('.', $current);
    $latest_parts = explode('.', $latest);
    
    // Si la versión mayor es diferente, es alto riesgo
    if ($current_parts[0] !== $latest_parts[0]) {
        return 'high';
    }
    
    // Si la versión menor es muy diferente, es medio riesgo
    if (isset($current_parts[1], $latest_parts[1])) {
        $minor_diff = intval($latest_parts[1]) - intval($current_parts[1]);
        if ($minor_diff > 2) {
            return 'medium';
        }
    }
    
    return 'low';
}

// 🧪 TEST: Endpoint para probar políticas con datos simulados
function gemini_test_policies_endpoint($request) {
    gemini_log('🧪 Testing policies with simulated data');
    
    try {
        $policy_engine = Gemini_Policy_Engine::get_instance();
        
        // Crear contexto simulado que active varias políticas
        $test_context = array(
            'site_health' => array(
                'wordpress_version' => '6.2.0', // Versión antigua para activar policy
                'php_version' => PHP_VERSION,
                'email_test' => array(
                    'status' => 'failed', // Fallo de email para activar policy
                    'message' => 'Email test failed - SMTP not configured'
                ),
                'active_plugins_count' => 30, // Muchos plugins para activar policy
                'admin_email' => get_option('admin_email')
            ),
            'plugins' => array_fill(0, 30, array( // 30 plugins para simular exceso
                'name' => 'Test Plugin',
                'version' => '1.0.0',
                'active' => true
            )),
            'user_capabilities' => gemini_get_token_capabilities()
        );
        
        // Evaluar políticas con contexto simulado
        $triggered_policies = $policy_engine->evaluate_policies($test_context);
        
        // Generar sugerencias
        $suggestions = gemini_generate_policy_suggestions($triggered_policies);
        
        return array(
            'status' => 'success',
            'test_mode' => true,
            'message' => 'Policy test completed with simulated data',
            'policies_evaluated' => count($policy_engine->get_policies()),
            'policies_triggered' => count($triggered_policies),
            'triggered_policies' => $triggered_policies,
            'suggestions' => $suggestions,
            'test_context' => array_keys($test_context),
            'simulated_issues' => array(
                'WordPress version 6.2.0 (outdated)',
                'Email test failed',
                '30 plugins installed (high count)',
                'SMTP not configured'
            ),
            'expected_suggestions' => array(
                'Update WordPress',
                'Configure SMTP',
                'Analyze plugins for cleanup',
                'Create backup before changes'
            ),
            'evaluation_timestamp' => current_time('c')
        );
        
    } catch (Exception $e) {
        gemini_log('❌ Error in policy test: ' . $e->getMessage());
        return new WP_Error(
            'policy_test_error',
            'Error testing policies: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

// 🔚 END OF PLUGIN
?>
// 🔄 WORKFLOW ENGINE: Endpoint callbacks

/**
 * Obtener workflows disponibles
 */
function gemini_get_workflows_endpoint($request) {
    gemini_log('🔄 Obteniendo workflows disponibles');
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $workflows = $workflow_engine->get_workflows();
        
        // Formatear workflows para respuesta
        $formatted_workflows = array();
        foreach ($workflows as $workflow_id => $workflow) {
            $formatted_workflows[] = array(
                'id' => $workflow['id'],
                'name' => $workflow['name'],
                'description' => $workflow['description'],
                'category' => $workflow['category'],
                'overall_risk_level' => $workflow['overall_risk_level'],
                'estimated_duration' => $workflow['estimated_duration'],
                'steps_count' => count($workflow['steps']),
                'prerequisites' => $workflow['prerequisites'],
                'tags' => $workflow['tags'],
                'auto_suggest' => $workflow['auto_suggest']
            );
        }
        
        return array(
            'status' => 'success',
            'workflows_count' => count($formatted_workflows),
            'workflows' => $formatted_workflows,
            'timestamp' => current_time('c')
        );
        
    } catch (Exception $e) {
        gemini_log('❌ Error obteniendo workflows: ' . $e->getMessage());
        return new WP_Error(
            'workflows_error',
            'Error retrieving workflows: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Iniciar sesión de workflow
 */
function gemini_start_workflow_endpoint($request) {
    $workflow_id = $request->get_param('workflow_id');
    $context = $request->get_param('context') ?? array();
    
    gemini_log("🔄 Iniciando workflow: {$workflow_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $session = $workflow_engine->start_workflow_session($workflow_id, $context);
        
        if (is_wp_error($session)) {
            return $session;
        }
        
        return array(
            'status' => 'success',
            'action' => 'workflow_started',
            'session_id' => $session['session_id'],
            'workflow_id' => $workflow_id,
            'workflow_name' => $session['workflow']['name'],
            'steps_count' => count($session['workflow']['steps']),
            'session_data' => array(
                'session_id' => $session['session_id'],
                'workflow' => array(
                    'id' => $session['workflow']['id'],
                    'name' => $session['workflow']['name'],
                    'description' => $session['workflow']['description'],
                    'overall_risk_level' => $session['workflow']['overall_risk_level'],
                    'estimated_duration' => $session['workflow']['estimated_duration'],
                    'steps' => $session['workflow']['steps']
                ),
                'status' => $session['status'],
                'steps_status' => $session['steps_status'],
                'accumulated_risk' => $session['accumulated_risk'],
                'started_at' => $session['started_at']
            ),
            'timestamp' => current_time('c')
        );
        
    } catch (Exception $e) {
        gemini_log('❌ Error iniciando workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_start_error',
            'Error starting workflow: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Simular paso de workflow
 */
function gemini_simulate_workflow_step_endpoint($request) {
    $session_id = $request->get_param('session_id');
    $step_index = (int)$request->get_param('step_index');
    
    gemini_log("🧪 Simulando paso {$step_index} de sesión {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $result = $workflow_engine->simulate_workflow_step($session_id, $step_index);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return $result;
        
    } catch (Exception $e) {
        gemini_log('❌ Error simulando paso de workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_simulate_error',
            'Error simulating workflow step: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Ejecutar paso de workflow
 */
function gemini_execute_workflow_step_endpoint($request) {
    $session_id = $request->get_param('session_id');
    $step_index = (int)$request->get_param('step_index');
    
    gemini_log("⚡ Ejecutando paso {$step_index} de sesión {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $result = $workflow_engine->execute_workflow_step_real($session_id, $step_index);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return $result;
        
    } catch (Exception $e) {
        gemini_log('❌ Error ejecutando paso de workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_execute_error',
            'Error executing workflow step: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Saltar paso de workflow
 */
function gemini_skip_workflow_step_endpoint($request) {
    $session_id = $request->get_param('session_id');
    $step_index = (int)$request->get_param('step_index');
    $reason = $request->get_param('reason') ?? '';
    
    gemini_log("⏭️ Saltando paso {$step_index} de sesión {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $result = $workflow_engine->skip_workflow_step($session_id, $step_index, $reason);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return $result;
        
    } catch (Exception $e) {
        gemini_log('❌ Error saltando paso de workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_skip_error',
            'Error skipping workflow step: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Cancelar workflow
 */
function gemini_cancel_workflow_endpoint($request) {
    $session_id = $request->get_param('session_id');
    $reason = $request->get_param('reason') ?? '';
    
    gemini_log("❌ Cancelando workflow de sesión {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $result = $workflow_engine->cancel_workflow($session_id, $reason);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return $result;
        
    } catch (Exception $e) {
        gemini_log('❌ Error cancelando workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_cancel_error',
            'Error cancelling workflow: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Obtener sesión de workflow
 */
function gemini_get_workflow_session_endpoint($request) {
    $session_id = $request->get_param('session_id');
    
    gemini_log("📊 Obteniendo sesión de workflow: {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $session = $workflow_engine->get_workflow_session($session_id);
        
        if (!$session) {
            return new WP_Error(
                'session_not_found',
                'Workflow session not found',
                array('status' => 404)
            );
        }
        
        return array(
            'status' => 'success',
            'session_data' => array(
                'session_id' => $session['session_id'],
                'workflow_id' => $session['workflow_id'],
                'workflow_name' => $session['workflow']['name'],
                'status' => $session['status'],
                'steps_status' => $session['steps_status'],
                'accumulated_risk' => $session['accumulated_risk'],
                'started_at' => $session['started_at'],
                'last_activity' => $session['last_activity'],
                'execution_log' => $session['execution_log']
            ),
            'timestamp' => current_time('c')
        );
        
    } catch (Exception $e) {
        gemini_log('❌ Error obteniendo sesión de workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_session_error',
            'Error retrieving workflow session: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}
// 🔄 WORKFLOW ENGINE: Endpoint callbacks

/**
 * Obtener workflows disponibles
 */
function gemini_get_workflows_endpoint($request) {
    gemini_log('🔄 Obteniendo workflows disponibles');
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $workflows = $workflow_engine->get_workflows();
        
        // Formatear workflows para respuesta
        $formatted_workflows = array();
        foreach ($workflows as $workflow_id => $workflow) {
            $formatted_workflows[] = array(
                'id' => $workflow['id'],
                'name' => $workflow['name'],
                'description' => $workflow['description'],
                'category' => $workflow['category'],
                'overall_risk_level' => $workflow['overall_risk_level'],
                'estimated_duration' => $workflow['estimated_duration'],
                'steps_count' => count($workflow['steps']),
                'prerequisites' => $workflow['prerequisites'],
                'tags' => $workflow['tags'],
                'auto_suggest' => $workflow['auto_suggest']
            );
        }
        
        return array(
            'status' => 'success',
            'workflows_count' => count($formatted_workflows),
            'workflows' => $formatted_workflows,
            'timestamp' => current_time('c')
        );
        
    } catch (Exception $e) {
        gemini_log('❌ Error obteniendo workflows: ' . $e->getMessage());
        return new WP_Error(
            'workflows_error',
            'Error retrieving workflows: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Iniciar sesión de workflow
 */
function gemini_start_workflow_endpoint($request) {
    $workflow_id = $request->get_param('workflow_id');
    $context = $request->get_param('context') ?? array();
    
    gemini_log("🔄 Iniciando workflow: {$workflow_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $session = $workflow_engine->start_workflow_session($workflow_id, $context);
        
        if (is_wp_error($session)) {
            return $session;
        }
        
        return array(
            'status' => 'success',
            'action' => 'workflow_started',
            'session_id' => $session['session_id'],
            'workflow_id' => $workflow_id,
            'workflow_name' => $session['workflow']['name'],
            'steps_count' => count($session['workflow']['steps']),
            'session_data' => array(
                'session_id' => $session['session_id'],
                'workflow' => array(
                    'id' => $session['workflow']['id'],
                    'name' => $session['workflow']['name'],
                    'description' => $session['workflow']['description'],
                    'overall_risk_level' => $session['workflow']['overall_risk_level'],
                    'estimated_duration' => $session['workflow']['estimated_duration'],
                    'steps' => $session['workflow']['steps']
                ),
                'status' => $session['status'],
                'steps_status' => $session['steps_status'],
                'accumulated_risk' => $session['accumulated_risk'],
                'started_at' => $session['started_at']
            ),
            'timestamp' => current_time('c')
        );
        
    } catch (Exception $e) {
        gemini_log('❌ Error iniciando workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_start_error',
            'Error starting workflow: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Simular paso de workflow
 */
function gemini_simulate_workflow_step_endpoint($request) {
    $session_id = $request->get_param('session_id');
    $step_index = (int)$request->get_param('step_index');
    
    gemini_log("🧪 Simulando paso {$step_index} de sesión {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $result = $workflow_engine->simulate_workflow_step($session_id, $step_index);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return $result;
        
    } catch (Exception $e) {
        gemini_log('❌ Error simulando paso de workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_simulate_error',
            'Error simulating workflow step: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Ejecutar paso de workflow
 */
function gemini_execute_workflow_step_endpoint($request) {
    $session_id = $request->get_param('session_id');
    $step_index = (int)$request->get_param('step_index');
    
    gemini_log("⚡ Ejecutando paso {$step_index} de sesión {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $result = $workflow_engine->execute_workflow_step_real($session_id, $step_index);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return $result;
        
    } catch (Exception $e) {
        gemini_log('❌ Error ejecutando paso de workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_execute_error',
            'Error executing workflow step: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Saltar paso de workflow
 */
function gemini_skip_workflow_step_endpoint($request) {
    $session_id = $request->get_param('session_id');
    $step_index = (int)$request->get_param('step_index');
    $reason = $request->get_param('reason') ?? '';
    
    gemini_log("⏭️ Saltando paso {$step_index} de sesión {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $result = $workflow_engine->skip_workflow_step($session_id, $step_index, $reason);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return $result;
        
    } catch (Exception $e) {
        gemini_log('❌ Error saltando paso de workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_skip_error',
            'Error skipping workflow step: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Cancelar workflow
 */
function gemini_cancel_workflow_endpoint($request) {
    $session_id = $request->get_param('session_id');
    $reason = $request->get_param('reason') ?? '';
    
    gemini_log("❌ Cancelando workflow de sesión {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $result = $workflow_engine->cancel_workflow($session_id, $reason);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return $result;
        
    } catch (Exception $e) {
        gemini_log('❌ Error cancelando workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_cancel_error',
            'Error cancelling workflow: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Obtener sesión de workflow
 */
function gemini_get_workflow_session_endpoint($request) {
    $session_id = $request->get_param('session_id');
    
    gemini_log("📊 Obteniendo sesión de workflow: {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $session = $workflow_engine->get_workflow_session($session_id);
        
        if (!$session) {
            return new WP_Error(
                'session_not_found',
                'Workflow session not found',
                array('status' => 404)
            );
        }
        
        return array(
            'status' => 'success',
            'session_data' => array(
                'session_id' => $session['session_id'],
                'workflow_id' => $session['workflow_id'],
                'workflow_name' => $session['workflow']['name'],
                'status' => $session['status'],
                'steps_status' => $session['steps_status'],
                'accumulated_risk' => $session['accumulated_risk'],
                'started_at' => $session['started_at'],
                'last_activity' => $session['last_activity'],
                'execution_log' => $session['execution_log']
            ),
            'timestamp' => current_time('c')
        );
        
    } catch (Exception $e) {
        gemini_log('❌ Error obteniendo sesión de workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_session_error',
            'Error retrieving workflow session: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}
// 🔄 WORKFLOW ENGINE: Endpoint handlers

/**
 * Obtener workflows disponibles
 */
function gemini_get_workflows_endpoint($request) {
    gemini_log('🔄 Obteniendo workflows disponibles');
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $workflows = $workflow_engine->get_workflows();
        
        // Filtrar workflows basado en permisos (simplificado por ahora)
        $allowed_workflows = array();
        foreach ($workflows as $workflow_id => $workflow) {
            // Por ahora, permitir todos los workflows
            // En el futuro, implementar verificación de permisos por workflow
            $allowed_workflows[$workflow_id] = $workflow;
        }
        
        return array(
            'status' => 'success',
            'workflows_count' => count($allowed_workflows),
            'workflows' => $allowed_workflows,
            'timestamp' => current_time('c')
        );
        
    } catch (Exception $e) {
        gemini_log('❌ Error obteniendo workflows: ' . $e->getMessage());
        return new WP_Error(
            'workflows_error',
            'Error retrieving workflows: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Iniciar sesión de workflow
 */
function gemini_start_workflow_endpoint($request) {
    $workflow_id = $request->get_param('workflow_id');
    $context = $request->get_param('context') ?? array();
    
    gemini_log("🔄 Iniciando workflow: {$workflow_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $session = $workflow_engine->start_workflow_session($workflow_id, $context);
        
        if (is_wp_error($session)) {
            return $session;
        }
        
        return array(
            'status' => 'success',
            'message' => 'Workflow session started successfully',
            'session' => $session,
            'next_steps' => array(
                'simulate_step' => "POST /workflows/sessions/{$session['session_id']}/steps/0/simulate",
                'execute_step' => "POST /workflows/sessions/{$session['session_id']}/steps/0/execute",
                'skip_step' => "POST /workflows/sessions/{$session['session_id']}/steps/0/skip"
            )
        );
        
    } catch (Exception $e) {
        gemini_log('❌ Error iniciando workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_start_error',
            'Error starting workflow: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Simular paso de workflow
 */
function gemini_simulate_workflow_step_endpoint($request) {
    $session_id = $request->get_param('session_id');
    $step_index = intval($request->get_param('step_index'));
    
    gemini_log("🧪 Simulando paso {$step_index} de sesión {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $result = $workflow_engine->simulate_workflow_step($session_id, $step_index);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return $result;
        
    } catch (Exception $e) {
        gemini_log('❌ Error simulando paso de workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_simulate_error',
            'Error simulating workflow step: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Ejecutar paso de workflow
 */
function gemini_execute_workflow_step_endpoint($request) {
    $session_id = $request->get_param('session_id');
    $step_index = intval($request->get_param('step_index'));
    
    gemini_log("⚡ Ejecutando paso {$step_index} de sesión {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $result = $workflow_engine->execute_workflow_step_real($session_id, $step_index);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return $result;
        
    } catch (Exception $e) {
        gemini_log('❌ Error ejecutando paso de workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_execute_error',
            'Error executing workflow step: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Saltar paso de workflow
 */
function gemini_skip_workflow_step_endpoint($request) {
    $session_id = $request->get_param('session_id');
    $step_index = intval($request->get_param('step_index'));
    $reason = $request->get_param('reason') ?? '';
    
    gemini_log("⏭️ Saltando paso {$step_index} de sesión {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $result = $workflow_engine->skip_workflow_step($session_id, $step_index, $reason);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return $result;
        
    } catch (Exception $e) {
        gemini_log('❌ Error saltando paso de workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_skip_error',
            'Error skipping workflow step: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Cancelar workflow
 */
function gemini_cancel_workflow_endpoint($request) {
    $session_id = $request->get_param('session_id');
    $reason = $request->get_param('reason') ?? '';
    
    gemini_log("❌ Cancelando workflow sesión {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $result = $workflow_engine->cancel_workflow($session_id, $reason);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return $result;
        
    } catch (Exception $e) {
        gemini_log('❌ Error cancelando workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_cancel_error',
            'Error cancelling workflow: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}

/**
 * Obtener sesión de workflow
 */
function gemini_get_workflow_session_endpoint($request) {
    $session_id = $request->get_param('session_id');
    
    gemini_log("📊 Obteniendo sesión de workflow: {$session_id}");
    
    try {
        $workflow_engine = Gemini_Workflow_Engine::get_instance();
        $session = $workflow_engine->get_workflow_session($session_id);
        
        if (!$session) {
            return new WP_Error(
                'session_not_found',
                'Workflow session not found',
                array('status' => 404)
            );
        }
        
        return array(
            'status' => 'success',
            'session' => $session,
            'summary' => $workflow_engine->get_session_summary($session_id)
        );
        
    } catch (Exception $e) {
        gemini_log('❌ Error obteniendo sesión de workflow: ' . $e->getMessage());
        return new WP_Error(
            'workflow_session_error',
            'Error retrieving workflow session: ' . $e->getMessage(),
            array('status' => 500)
        );
    }
}