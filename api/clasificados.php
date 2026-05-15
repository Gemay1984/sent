<?php
// ================================================================
// clasificados.php — API REST para mercado vial
// ================================================================
require_once __DIR__ . '/config.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET: Listar clasificados ──────────────────────────────
if ($method === 'GET') {
    // Si es admin, muestra todos. Si no, solo los aprobados.
    $esAdmin = ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '') === ADMIN_TOKEN;
    
    if ($esAdmin) {
        $stmt = $db->query('SELECT * FROM clasificados ORDER BY fecha DESC');
    } else {
        $stmt = $db->query('SELECT * FROM clasificados WHERE aprobado = 1 ORDER BY fecha DESC');
    }
    
    echo json_encode(['ok' => true, 'data' => $stmt->fetchAll()]);
    exit;
}

// ── POST: Crear o aprobar ─────────────────────────────
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    
    // Acción de aprobar (solo admin)
    if (isset($_GET['accion']) && $_GET['accion'] === 'aprobar') {
        requireAdmin();
        $id = intval($_GET['id'] ?? 0);
        $db->prepare('UPDATE clasificados SET aprobado = 1 WHERE id = ?')->execute([$id]);
        echo json_encode(['ok' => true]);
        exit;
    }

    // Crear nuevo clasificado
    if (empty($body['titulo']) || empty($body['whatsapp'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Título y WhatsApp son requeridos']);
        exit;
    }

    $esAdmin = ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '') === ADMIN_TOKEN;

    $stmt = $db->prepare(
        'INSERT INTO clasificados (tipo, titulo, precio, ciudad, whatsapp, descripcion, imagen_url, aprobado)
         VALUES (:tipo, :titulo, :precio, :ciudad, :whatsapp, :descripcion, :imagen_url, :aprobado)'
    );
    $stmt->execute([
        ':tipo'        => $body['tipo'] ?? 'Venta',
        ':titulo'      => $body['titulo'],
        ':precio'      => $body['precio'] ?? 0,
        ':ciudad'      => $body['ciudad'] ?? 'Armenia',
        ':whatsapp'    => $body['whatsapp'],
        ':descripcion' => $body['descripcion'] ?? '',
        ':imagen_url'  => $body['imagen_url'] ?? '',
        ':aprobado'    => $esAdmin ? 1 : 0
    ]);
    echo json_encode(['ok' => true, 'id' => $db->lastInsertId(), 'mensaje' => $esAdmin ? 'Publicado' : 'En revisión']);
    exit;
}

// ── DELETE: Eliminar ────────────────────────
if ($method === 'DELETE') {
    requireAdmin();
    $id = intval($_GET['id'] ?? 0);
    $db->prepare('DELETE FROM clasificados WHERE id = ?')->execute([$id]);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
