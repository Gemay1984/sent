<?php
// ================================================================
// noticias.php — API REST para noticias (con workflow editorial)
// GET  /api/noticias.php              → listar publicadas (público)
// GET  /api/noticias.php?todos=1      → listar todas (admin)
// GET  /api/noticias.php?id=N         → una noticia por id (admin)
// POST /api/noticias.php              → crear/editar (admin)
// POST /api/noticias.php?accion=aprobar → publicar borrador (admin)
// DELETE /api/noticias.php?id=N       → eliminar (admin)
// ================================================================
require_once __DIR__ . '/config.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

function makeSlug(string $text): string {
    $map = ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n',
            'Á'=>'a','É'=>'e','Í'=>'i','Ó'=>'o','Ú'=>'u','Ü'=>'u','Ñ'=>'n'];
    $text = strtr($text, $map);
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9\s\-]/', '', $text);
    $text = preg_replace('/[\s\-]+/', '-', $text);
    return trim($text, '-');
}

// ── GET: Listar noticias ─────────────────────────────────────────
if ($method === 'GET') {
    $token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    $isAdmin = ($token === ADMIN_TOKEN);

    // Una noticia por id (admin)
    if (!empty($_GET['id'])) {
        if (!$isAdmin) { http_response_code(403); echo json_encode(['error' => 'No autorizado']); exit; }
        $stmt = $db->prepare('SELECT * FROM noticias WHERE id = ?');
        $stmt->execute([intval($_GET['id'])]);
        $row = $stmt->fetch();
        echo json_encode(['ok' => true, 'data' => $row ?: null]);
        exit;
    }

    // Listar todas (admin) vs publicadas (público)
    if ($isAdmin && !empty($_GET['todos'])) {
        $stmt = $db->query(
            'SELECT id, titulo, slug, extracto, categoria, imagen_url, publicado, estado, autor, fecha, creado_en
             FROM noticias ORDER BY creado_en DESC LIMIT 100'
        );
    } else {
        $stmt = $db->query(
            'SELECT id, titulo, slug, extracto, contenido, categoria, imagen_url, fecha
             FROM noticias WHERE publicado = 1 ORDER BY fecha DESC, creado_en DESC LIMIT 50'
        );
    }
    echo json_encode(['ok' => true, 'data' => $stmt->fetchAll()]);
    exit;
}

// ── POST: Crear, Editar o Aprobar ────────────────────────────────
if ($method === 'POST') {
    requireAdmin();

    $accion = $_GET['accion'] ?? '';

    // APROBAR: cambia estado a publicado
    if ($accion === 'aprobar') {
        $id = intval($_GET['id'] ?? 0);
        if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); exit; }
        $stmt = $db->prepare(
            'UPDATE noticias SET estado = "publicado", publicado = 1, aprobado_en = NOW() WHERE id = ?'
        );
        $stmt->execute([$id]);
        echo json_encode(['ok' => true]);
        exit;
    }

    // CREAR / EDITAR noticia
    $body = json_decode(file_get_contents('php://input'), true);

    $campos = ['titulo','extracto','contenido','categoria'];
    foreach ($campos as $c) {
        if (empty($body[$c])) {
            http_response_code(400);
            echo json_encode(['error' => "El campo '$c' es requerido"]);
            exit;
        }
    }

    $slug   = makeSlug($body['titulo']);
    $estado = $body['estado'] ?? 'publicado';
    // Si se guarda como borrador, publicado=0; si es publicado, publicado=1
    $publicado = ($estado === 'publicado') ? 1 : 0;
    $autor  = $body['autor'] ?? 'Redacción SV';
    $fecha  = $body['fecha'] ?? date('Y-m-d');

    if (!empty($body['id'])) {
        // ACTUALIZAR
        $stmt = $db->prepare(
            'UPDATE noticias SET titulo=:titulo, slug=:slug, extracto=:extracto,
             contenido=:contenido, categoria=:categoria, imagen_url=:imagen_url,
             fecha=:fecha, estado=:estado, publicado=:publicado, autor=:autor
             WHERE id=:id'
        );
        $stmt->execute([
            ':id'         => $body['id'],
            ':titulo'     => $body['titulo'],
            ':slug'       => $slug,
            ':extracto'   => $body['extracto'],
            ':contenido'  => $body['contenido'],
            ':categoria'  => $body['categoria'],
            ':imagen_url' => $body['imagen_url'] ?? '',
            ':fecha'      => $fecha,
            ':estado'     => $estado,
            ':publicado'  => $publicado,
            ':autor'      => $autor,
        ]);
        echo json_encode(['ok' => true, 'id' => $body['id'], 'slug' => $slug]);
    } else {
        // CREAR
        $stmt = $db->prepare(
            'INSERT INTO noticias (titulo, slug, extracto, contenido, categoria, imagen_url, fecha, estado, publicado, autor)
             VALUES (:titulo, :slug, :extracto, :contenido, :categoria, :imagen_url, :fecha, :estado, :publicado, :autor)'
        );
        $stmt->execute([
            ':titulo'     => $body['titulo'],
            ':slug'       => $slug,
            ':extracto'   => $body['extracto'],
            ':contenido'  => $body['contenido'],
            ':categoria'  => $body['categoria'],
            ':imagen_url' => $body['imagen_url'] ?? '',
            ':fecha'      => $fecha,
            ':estado'     => $estado,
            ':publicado'  => $publicado,
            ':autor'      => $autor,
        ]);
        $id = $db->lastInsertId();
        echo json_encode(['ok' => true, 'id' => $id, 'slug' => $slug]);
    }
    exit;
}

// ── DELETE: Eliminar noticia ────────────────────────────────────
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
