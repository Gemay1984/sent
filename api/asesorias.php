<?php
// ================================================================
// asesorias.php — Recibir y listar solicitudes de asesoría
// POST /api/asesorias.php     → guardar solicitud (público)
// GET  /api/asesorias.php     → listar (solo admin)
// POST /api/asesorias.php?accion=atender&id=N → marcar atendido
// ================================================================
require_once __DIR__ . '/config.php';
setCorsHeaders();

$method  = $_SERVER['REQUEST_METHOD'];
$db      = getDB();
$accion  = $_GET['accion'] ?? '';

// ── POST público: recibir solicitud ─────────────────────────────
if ($method === 'POST' && $accion === '') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (empty($body['nombre']) || empty($body['whatsapp'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Nombre y WhatsApp son requeridos']);
        exit;
    }
    $stmt = $db->prepare(
        'INSERT INTO asesorias (nombre, whatsapp, entidad, tipo_caso, descripcion)
         VALUES (:nombre, :whatsapp, :entidad, :tipo_caso, :descripcion)'
    );
    $stmt->execute([
        ':nombre'      => $body['nombre'],
        ':whatsapp'    => $body['whatsapp'],
        ':entidad'     => $body['entidad'] ?? '',
        ':tipo_caso'   => $body['tipo_caso'] ?? '',
        ':descripcion' => $body['descripcion'] ?? '',
    ]);
    echo json_encode(['ok' => true, 'mensaje' => 'Solicitud recibida. Le contactaremos pronto.']);
    exit;
}

// ── GET admin: listar todas las solicitudes ──────────────────────
if ($method === 'GET') {
    requireAdmin();
    $stmt = $db->query(
        'SELECT id, nombre, whatsapp, entidad, tipo_caso, descripcion, atendido, fecha
         FROM asesorias ORDER BY atendido ASC, fecha DESC LIMIT 100'
    );
    echo json_encode(['ok' => true, 'data' => $stmt->fetchAll()]);
    exit;
}

// ── POST admin: marcar como atendido ─────────────────────────────
if ($method === 'POST' && $accion === 'atender') {
    requireAdmin();
    $id = intval($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); exit; }
    $db->prepare('UPDATE asesorias SET atendido = 1 WHERE id = ?')->execute([$id]);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
