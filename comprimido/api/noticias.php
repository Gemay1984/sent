<?php
// ================================================================
// noticias.php — API REST para noticias
// GET  /api/noticias.php         → listar todas
// POST /api/noticias.php         → crear (requiere admin token)
// DELETE /api/noticias.php?id=N  → eliminar (requiere admin token)
// ================================================================
require_once __DIR__ . '/config.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET: Listar noticias publicadas ──────────────────────────────
if ($method === 'GET') {
    $stmt = $db->query(
        'SELECT id, titulo, extracto, contenido, categoria, imagen_url, fecha
         FROM noticias WHERE publicado = 1 ORDER BY fecha DESC, creado_en DESC LIMIT 50'
    );
    echo json_encode(['ok' => true, 'data' => $stmt->fetchAll()]);
    exit;
}

// ── POST: Crear o Editar noticia (solo admin) ─────────────────────────────
if ($method === 'POST') {
    requireAdmin();
    $body = json_decode(file_get_contents('php://input'), true);

    $campos = ['titulo','extracto','contenido','categoria'];
    foreach ($campos as $c) {
        if (empty($body[$c])) {
            http_response_code(400);
            echo json_encode(['error' => "El campo '$c' es requerido"]);
            exit;
        }
    }

    if (!empty($body['id'])) {
        // ACTUALIZAR
        $stmt = $db->prepare(
            'UPDATE noticias SET titulo=:titulo, extracto=:extracto, contenido=:contenido, categoria=:categoria, imagen_url=:imagen_url, fecha=:fecha WHERE id=:id'
        );
        $stmt->execute([
            ':id'         => $body['id'],
            ':titulo'     => $body['titulo'],
            ':extracto'   => $body['extracto'],
            ':contenido'  => $body['contenido'],
            ':categoria'  => $body['categoria'],
            ':imagen_url' => $body['imagen_url'] ?? '',
            ':fecha'      => $body['fecha'] ?? date('Y-m-d'),
        ]);
        echo json_encode(['ok' => true]);
    } else {
        // CREAR
        $stmt = $db->prepare(
            'INSERT INTO noticias (titulo, extracto, contenido, categoria, imagen_url, fecha)
             VALUES (:titulo, :extracto, :contenido, :categoria, :imagen_url, :fecha)'
        );
        $stmt->execute([
            ':titulo'     => $body['titulo'],
            ':extracto'   => $body['extracto'],
            ':contenido'  => $body['contenido'],
            ':categoria'  => $body['categoria'],
            ':imagen_url' => $body['imagen_url'] ?? '',
            ':fecha'      => $body['fecha'] ?? date('Y-m-d'),
        ]);
        echo json_encode(['ok' => true, 'id' => $db->lastInsertId()]);
    }
    exit;
}

// ── DELETE: Eliminar noticia (solo admin) ────────────────────────
if ($method === 'DELETE') {
    requireAdmin();
    $id = intval($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); exit; }
    $db->prepare('DELETE FROM noticias WHERE id = ?')->execute([$id]);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
