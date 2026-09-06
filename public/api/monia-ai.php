<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

session_name('monia_ai');
session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Strict',
    'path' => '/',
]);
session_start();

function reply(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function same_origin(): bool {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return true;
    $originHost = parse_url($origin, PHP_URL_HOST);
    $host = explode(':', $_SERVER['HTTP_HOST'] ?? '')[0];
    return is_string($originHost) && $host !== '' && hash_equals(strtolower($host), strtolower($originHost));
}

if (!same_origin()) reply(403, ['ok' => false, 'error' => 'origin refusée']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, ['ok' => false, 'error' => 'méthode refusée']);

$token = trim((string)getenv('MONIA_INFOMANIAK_AI_TOKEN'));
$productId = trim((string)getenv('MONIA_INFOMANIAK_AI_PRODUCT_ID'));
$model = trim((string)getenv('MONIA_INFOMANIAK_AI_MODEL')) ?: 'qwen3';
if ($token === '' || $productId === '' || !ctype_digit($productId)) {
    reply(503, ['ok' => false, 'error' => 'IA serveur non configurée']);
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 140000) reply(413, ['ok' => false, 'error' => 'requête trop volumineuse']);
$payload = json_decode($raw ?: '', true);
if (!is_array($payload)) reply(400, ['ok' => false, 'error' => 'JSON invalide']);
$task = (string)($payload['task'] ?? '');
$prompt = trim((string)($payload['prompt'] ?? ''));
if (!in_array($task, ['narration', 'director'], true) || $prompt === '') reply(400, ['ok' => false, 'error' => 'requête invalide']);
if (mb_strlen($prompt) > 50000) reply(413, ['ok' => false, 'error' => 'prompt trop long']);

$now = time();
$hits = array_values(array_filter((array)($_SESSION['monia_ai_hits'] ?? []), fn($t) => is_int($t) && $t > $now - 60));
if (count($hits) >= 24) reply(429, ['ok' => false, 'error' => 'trop de requêtes IA']);
$hits[] = $now;
$_SESSION['monia_ai_hits'] = $hits;

$body = [
    'model' => $model,
    'messages' => [
        ['role' => 'user', 'content' => $prompt],
    ],
    'temperature' => $task === 'director' ? 0.58 : 0.65,
    'top_p' => $task === 'director' ? 0.88 : 0.90,
    'max_completion_tokens' => $task === 'director' ? 320 : 180,
];

$url = 'https://api.infomaniak.com/2/ai/' . rawurlencode($productId) . '/openai/v1/chat/completions';
$ch = curl_init($url);
if ($ch === false) reply(500, ['ok' => false, 'error' => 'client IA indisponible']);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 6,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
        'Accept: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
]);
$response = curl_exec($ch);
$http = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($response === false) reply(502, ['ok' => false, 'error' => 'connexion IA impossible' . ($error ? ' · ' . $error : '')]);
$data = json_decode($response, true);
if ($http < 200 || $http >= 300) {
    $remote = is_array($data) ? (string)($data['error']['message'] ?? $data['message'] ?? '') : '';
    reply(502, ['ok' => false, 'error' => 'Infomaniak AI HTTP ' . $http . ($remote !== '' ? ' · ' . mb_substr($remote, 0, 180) : '')]);
}
$text = is_array($data) ? trim((string)($data['choices'][0]['message']['content'] ?? '')) : '';
if ($text === '') reply(502, ['ok' => false, 'error' => 'réponse IA vide']);
reply(200, [
    'ok' => true,
    'text' => $text,
    'model' => (string)($data['model'] ?? $model),
]);
