<?php
// ================================================================
// publicidad.php — Gestión de espacios publicitarios por noticia
// GET  /api/publicidad.php?noticia_id=N → listar anuncios de la noticia
// POST /api/publicidad.php              → crear/actualizar anuncio
// DELETE /api/publicidad.php?id=N       → eliminar anuncio
// ================================================================
require_once __DIR__ . '/config.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET: listar anuncios de una noticia ─────────────────────────
if ($method === 'GET') {
    $noticiaId = intval($_GET['noticia_id'] ?? 0);
    if (!$noticiaId) {
        http_response_code(400);
        echo json_encode(['error' => 'noticia_id requerido']);
        exit;
    }
    $stmt = $db->prepare(
        'SELECT id, noticia_id, espacio, imagen_url, link_url, activo
         FROM publicidad WHERE noticia_id = ? AND activo = 1'
    );
    $stmt->execute([$noticiaId]);
    echo json_encode(['ok' => true, 'data' => $stmt->fetchAll()]);
    exit;
}

// ── POST: crear o actualizar anuncio ────────────────────────────
if ($method === 'POST') {
    requireAdmin();
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['noticia_id']) || empty($body['espacio'])) {
        http_response_code(400);
        echo json_encode(['error' => 'noticia_id y espacio son requeridos']);
        exit;
    }

    $espaciosValidos = ['banner_superior', 'lateral_der', 'banner_medio', 'banner_inferior'];
    if (!in_array($body['espacio'], $espaciosValidos)) {
        http_response_code(400);
        echo json_encode(['error' => 'Espacio no válido']);
        exit;
    }

    // Verificar si ya existe un anuncio en ese espacio para esta noticia
    $check = $db->prepare('SELECT id FROM publicidad WHERE noticia_id = ? AND espacio = ?');
    $check->execute([$body['noticia_id'], $body['espacio']]);
    $existing = $check->fetch();

    if ($existing) {
        // ACTUALIZAR
        $stmt = $db->prepare(
            'UPDATE publicidad SET imagen_url = :img, link_url = :link, activo = 1
             WHERE noticia_id = :nid AND espacio = :esp'
        );
        $stmt->execute([
            ':img'  => $body['imagen_url'] ?? '',
            ':link' => $body['link_url']   ?? '',
            ':nid'  => $body['noticia_id'],
            ':esp'  => $body['espacio'],
        ]);
        echo json_encode(['ok' => true, 'id' => $existing['id']]);
    } else {
        // INSERTAR
        $stmt = $db->prepare(
            'INSERT INTO publicidad (noticia_id, espacio, imagen_url, link_url)
             VALUES (:nid, :esp, :img, :link)'
        );
        $stmt->execute([
            ':nid'  => $body['noticia_id'],
            ':esp'  => $body['espacio'],
            ':img'  => $body['imagen_url'] ?? '',
            ':link' => $body['link_url']   ?? '',
        ]);
        echo json_encode(['ok' => true, 'id' => $db->lastInsertId()]);
    }
    exit;
}

// ── DELETE: eliminar anuncio ─────────────────────────────────────
if ($method === 'DELETE') {
    requireAdmin();
    $id = intval($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); exit; }
    $db->prepare('DELETE FROM publicidad WHERE id = ?')->execute([$id]);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
