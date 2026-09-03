<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

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
    return is_string($originHost) && hash_equals(strtolower($host), strtolower($originHost));
}

$root = dirname(__DIR__) . '/resources/monia/generated';
$file = $root . '/intro-status.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!is_file($file)) reply(200, ['ok' => true, 'status' => null]);
    $raw = file_get_contents($file);
    $data = json_decode($raw ?: '', true);
    reply(200, ['ok' => true, 'status' => is_array($data) ? $data : null]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, ['ok' => false, 'error' => 'méthode refusée']);
if (!same_origin()) reply(403, ['ok' => false, 'error' => 'origin refusée']);

$payload = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($payload)) reply(400, ['ok' => false, 'error' => 'JSON invalide']);

$shotId = preg_replace('/[^a-z0-9_-]/i', '', (string)($payload['shotId'] ?? '')) ?: 'unknown';
$stage = mb_substr(trim((string)($payload['stage'] ?? 'unknown')), 0, 80);
$detail = mb_substr(trim((string)($payload['detail'] ?? '')), 0, 500);
$ok = array_key_exists('ok', $payload) ? (bool)$payload['ok'] : null;

if (!is_dir($root) && !mkdir($root, 0755, true) && !is_dir($root)) reply(500, ['ok' => false, 'error' => 'dossier diagnostic indisponible']);
$status = [
    'shotId' => $shotId,
    'stage' => $stage,
    'detail' => $detail,
    'ok' => $ok,
    'updatedAt' => (int)round(microtime(true) * 1000),
    'serverTime' => gmdate('c'),
];
if (file_put_contents($file, json_encode($status, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX) === false) {
    reply(500, ['ok' => false, 'error' => 'écriture diagnostic impossible']);
}
reply(200, ['ok' => true]);
