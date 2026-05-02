<?php
// ================================================================
// simuladores.php — API REST para simuladores/recursos educativos
// ================================================================
require_once __DIR__ . '/config.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

if ($method === 'GET') {
    $stmt = $db->query(
        'SELECT id, titulo, descripcion, embed_html, icono, color
         FROM simuladores WHERE activo = 1 ORDER BY creado_en DESC'
    );
    echo json_encode(['ok' => true, 'data' => $stmt->fetchAll()]);
    exit;
}

if ($method === 'POST') {
    requireAdmin();
    $body = json_decode(file_get_contents('php://input'), true);
    if (empty($body['titulo']) || empty($body['embed_html'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Título y embed_html son requeridos']);
        exit;
    }
    $stmt = $db->prepare(
        'INSERT INTO simuladores (titulo, descripcion, embed_html, icono, color)
         VALUES (:titulo, :descripcion, :embed_html, :icono, :color)'
    );
    $stmt->execute([
        ':titulo'      => $body['titulo'],
        ':descripcion' => $body['descripcion'] ?? '',
        ':embed_html'  => $body['embed_html'],
        ':icono'       => $body['icono'] ?? 'fas fa-gamepad',
        ':color'       => $body['color'] ?? '#ef4444',
    ]);
    echo json_encode(['ok' => true, 'id' => $db->lastInsertId()]);
    exit;
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = intval($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); exit; }
    $db->prepare('UPDATE simuladores SET activo = 0 WHERE id = ?')->execute([$id]);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
