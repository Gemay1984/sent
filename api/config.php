<?php
// ================================================================
// config.php — Credenciales de Base de Datos
// NUNCA subir a un repositorio público
// ================================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'u638339419_sentido');
define('DB_USER', 'u638339419_admin');
define('DB_PASS', 'Vial2026');

// ⚠️ PON AQUÍ TU CLAVE REAL DE GEMINI (la obtienes en https://aistudio.google.com/app/apikey)
define('GEMINI_API_KEY', 'TU_CLAVE_GEMINI_REAL_AQUI');
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
                    $sql = preg_replace('/CREATE DATABASE.*?;/i', '', $sql);
                    $sql = preg_replace('/USE .*?;/i', '', $sql);
                    $pdo->exec($sql);
                }
            } else {
                // Migraciones: agregar columnas/tablas nuevas si ya existe la tabla
                runMigrations($pdo);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['error' => 'Error de conexión a la base de datos MySQL. Revisa config.php.']));
        }
    }
    return $pdo;
}

// ── Migraciones de base de datos ────────────────────────────────
function runMigrations(PDO $pdo): void {
    // Agregar columna slug si no existe
    $cols = $pdo->query("SHOW COLUMNS FROM noticias LIKE 'slug'")->fetchAll();
    if (empty($cols)) {
        $pdo->exec("ALTER TABLE noticias ADD COLUMN slug VARCHAR(400) DEFAULT '' AFTER titulo");
    }
    // Agregar columna estado si no existe
    $cols = $pdo->query("SHOW COLUMNS FROM noticias LIKE 'estado'")->fetchAll();
    if (empty($cols)) {
        $pdo->exec("ALTER TABLE noticias
            ADD COLUMN estado ENUM('borrador','revision','aprobado','publicado') NOT NULL DEFAULT 'publicado' AFTER imagen_url,
            ADD COLUMN autor VARCHAR(100) DEFAULT 'Redacción SV' AFTER estado,
            ADD COLUMN aprobado_en DATETIME DEFAULT NULL AFTER autor");
    }
    // Crear tabla publicidad si no existe
    $tables = $pdo->query("SHOW TABLES LIKE 'publicidad'")->fetchAll();
    if (empty($tables)) {
        $pdo->exec("CREATE TABLE publicidad (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            noticia_id INT NOT NULL,
            espacio    ENUM('banner_superior','lateral_der','banner_medio','banner_inferior') NOT NULL,
            imagen_url VARCHAR(600) DEFAULT '',
            link_url   VARCHAR(600) DEFAULT '',
            activo     TINYINT(1) NOT NULL DEFAULT 1,
            creado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB");
    }
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
