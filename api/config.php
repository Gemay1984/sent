<?php
// ================================================================
// config.php — Credenciales de Base de Datos
// NUNCA subir a un repositorio público
// ================================================================

define('DB_HOST', 'localhost');          // Siempre localhost en Hostinger
define('DB_NAME', 'sentidovial_db');    // Nombre de tu BD en hPanel
define('DB_USER', 'tu_usuario_bd');     // Usuario creado en hPanel → MySQL
define('DB_PASS', 'tu_contrasena_bd');  // Contraseña de la BD

// ── Gemini AI (guardada SOLO en el servidor, nunca en frontend) ──
define('GEMINI_API_KEY', 'TU_NUEVA_CLAVE_GEMINI_AQUI');
define('GEMINI_URL', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');

// ── Conectar a MySQL y Autoinstalar Tablas ───────────────────────
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER,
                DB_PASS,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                 PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
            );
            
            // Auto-instalar tablas si no existen (Ej: primera ejecución en Hostinger)
            $check = $pdo->query("SHOW TABLES LIKE 'noticias'");
            if ($check->rowCount() === 0) {
                $schemaFile = __DIR__ . '/schema.sql';
                if (file_exists($schemaFile)) {
                    $sql = file_get_contents($schemaFile);
                    // Eliminar comandos CREATE DATABASE y USE para evitar errores de permisos
                    $sql = preg_replace('/CREATE DATABASE.*?;/i', '', $sql);
                    $sql = preg_replace('/USE .*?;/i', '', $sql);
                    $pdo->exec($sql);
                }
            }
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['error' => 'Error de conexión a la base de datos MySQL. Revisa config.php.']));
        }
    }
    return $pdo;
}

// ── Headers CORS (permite llamadas desde tu dominio) ─────────────
function setCorsHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }
}

// ── Verificación de token admin (simple pero funcional) ──────────
define('ADMIN_TOKEN', hash('sha256', 'vial2026_admin_token_secreto'));

function requireAdmin(): void {
    $token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    if ($token !== ADMIN_TOKEN) {
        http_response_code(403);
        die(json_encode(['error' => 'Acceso no autorizado']));
    }
}
