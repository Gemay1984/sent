<?php
// api/upload.php
require_once __DIR__ . '/config.php';
setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireAdmin();

    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'No se subió ninguna imagen o hubo un error']);
        exit;
    }

    $file = $_FILES['image'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    
    $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!in_array($ext, $allowed)) {
        http_response_code(400);
        echo json_encode(['error' => 'Formato no permitido']);
        exit;
    }

    $uploadDir = __DIR__ . '/uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $filename = time() . '_' . uniqid() . '.' . $ext;
    $destination = $uploadDir . $filename;

    if (move_uploaded_file($file['tmp_name'], $destination)) {
        // Devolver la ruta relativa pública
        echo json_encode(['ok' => true, 'url' => 'api/uploads/' . $filename]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Error al mover el archivo al servidor']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
