<?php
// ================================================================
// ia.php — Proxy seguro para Google Gemini AI
// La API key NUNCA se expone al frontend
// POST /api/ia.php  body: { "prompt": "...", "accion": "noticia|mejora|extracto" }
// ================================================================
require_once __DIR__ . '/config.php';
setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Solo POST permitido']);
    exit;
}

requireAdmin();

$body   = json_decode(file_get_contents('php://input'), true);
$prompt = trim($body['prompt'] ?? '');
$accion = trim($body['accion'] ?? 'noticia');

if (!$prompt) {
    http_response_code(400);
    echo json_encode(['error' => 'El prompt es requerido']);
    exit;
}

// ── Construir el prompt según la acción solicitada ────────────────
$systemContext = "Eres el redactor jefe del portal de movilidad 'Sentido Vial Quindío', especializado en tránsito, seguridad vial, decreto SETTA, pico y placa, fotomultas, Código Nacional de Tránsito (Colombia) y vías del Eje Cafetero (Armenia, Calarcá, La Tebaida, Montenegro, Quimbaya). Redactas en español colombiano formal y periodístico.";

switch ($accion) {
    case 'noticia':
        $instruccion = "$systemContext\n\nRedacta una noticia completa sobre: \"$prompt\"\n\nDevuelve EXACTAMENTE este JSON (sin markdown):\n{\"titulo\": \"...\", \"extracto\": \"máximo 2 líneas\", \"contenido\": \"HTML con <p> tags\", \"categoria\": \"SETTA|Movilidad|Nacional|Judicial\"}";
        break;
    case 'mejora':
        $instruccion = "$systemContext\n\nMejora este texto periodísticamente: \"$prompt\"\n\nDevuelve EXACTAMENTE este JSON:\n{\"contenido\": \"HTML mejorado con <p> tags\"}";
        break;
    case 'extracto':
        $instruccion = "$systemContext\n\nGenera un extracto de máximo 2 líneas para: \"$prompt\"\n\nDevuelve EXACTAMENTE este JSON:\n{\"extracto\": \"...\"}";
        break;
    case 'clasificado':
        $instruccion = "$systemContext\n\nRedacta una descripción atractiva para este anuncio de vehículo: \"$prompt\"\n\nDevuelve EXACTAMENTE este JSON:\n{\"descripcion\": \"...\"}";
        break;
    default:
        $instruccion = "$systemContext\n\n$prompt";
}

// ── Llamada a Gemini API con fallback de modelos ─────────────────
$modelos = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
$response = null;
$httpCode = 0;
$ultimoError = '';

if ($accion === 'imagen') {
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=' . GEMINI_API_KEY;
    $aspectRatio = $body['aspectRatio'] ?? '16:9';
    $payload = json_encode([
        'instances' => [['prompt' => $prompt]],
        'parameters' => ['sampleCount' => 1, 'aspectRatio' => $aspectRatio]
    ]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $response = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200) {
        $detalle = $curlError ?: $response;
        $gemErr  = json_decode($response, true);
        $msg     = $gemErr['error']['message'] ?? $detalle;
        http_response_code(502);
        echo json_encode(['error' => 'Error generando imagen: ' . $msg]);
        exit;
    }

    $geminiData = json_decode($response, true);
    $b64 = $geminiData['predictions'][0]['bytesBase64Encoded'] ?? null;
    if ($b64) {
        echo json_encode(['ok' => true, 'data' => ['base64' => $b64]]);
    } else {
        echo json_encode(['error' => 'La IA no generó imagen.', 'detalle' => $response]);
    }
    exit;
}

// Textos: intentar modelos en orden hasta que uno funcione
foreach ($modelos as $modelo) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$modelo}:generateContent?key=" . GEMINI_API_KEY;

    $parts = [['text' => $instruccion]];
    if (!empty($body['imagen_b64'])) {
        $parts[] = [
            'inline_data' => [
                'mime_type' => 'image/jpeg',
                'data' => preg_replace('/^data:image\/\w+;base64,/', '', $body['imagen_b64'])
            ]
        ];
    }
    $payload = json_encode([
        'contents' => [['parts' => $parts]],
        'generationConfig' => ['temperature' => 0.7, 'maxOutputTokens' => 2048]
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $response  = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($httpCode === 200) break; // éxito

    // Guardar el error de este intento
    $errData    = json_decode($response, true);
    $ultimoError = $errData['error']['message'] ?? ($curlError ?: "HTTP $httpCode");
}

if ($httpCode !== 200) {
    http_response_code(502);
    echo json_encode(['error' => 'Error comunicando con Gemini AI: ' . $ultimoError]);
    exit;
}

$geminiData = json_decode($response, true);
$textRaw    = $geminiData['candidates'][0]['content']['parts'][0]['text'] ?? '';

// Intentar parsear el JSON que devuelve Gemini
$textClean = preg_replace('/```json|```/i', '', $textRaw);
$textClean = trim($textClean);
$parsed    = json_decode($textClean, true);

if ($parsed) {
    echo json_encode(['ok' => true, 'data' => $parsed]);
} else {
    echo json_encode(['ok' => true, 'data' => ['texto' => $textRaw]]);
}
