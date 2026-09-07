<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

session_name('monia_kaggle_dispatch');
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

$githubToken = trim((string)getenv('MONIA_GITHUB_TOKEN'));
if ($githubToken === '') reply(503, ['ok' => false, 'error' => 'pont Kaggle non configuré']);

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 60000) reply(413, ['ok' => false, 'error' => 'requête trop volumineuse']);
$payload = json_decode($raw ?: '', true);
if (!is_array($payload)) reply(400, ['ok' => false, 'error' => 'JSON invalide']);
$job = $payload['job'] ?? null;
if (!is_array($job)) reply(400, ['ok' => false, 'error' => 'job manquant']);

$id = (string)($job['id'] ?? '');
if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,80}$/', $id)) reply(400, ['ok' => false, 'error' => 'id invalide']);
if (($job['candidateOnly'] ?? null) !== true || ($job['narrativeAuthority'] ?? null) !== false) {
    reply(400, ['ok' => false, 'error' => 'garde-fous candidat requis']);
}
if (!isset($job['prompt']) || !is_string($job['prompt']) || trim($job['prompt']) === '') {
    reply(400, ['ok' => false, 'error' => 'prompt manquant']);
}
$characters = $job['characters'] ?? [];
if (!is_array($characters) || count($characters) < 1 || count($characters) > 4) reply(400, ['ok' => false, 'error' => 'personnages invalides']);

$now = time();
$hits = array_values(array_filter((array)($_SESSION['monia_kaggle_hits'] ?? []), fn($t) => is_int($t) && $t > $now - 300));
if (count($hits) >= 3) reply(429, ['ok' => false, 'error' => 'trop de générations rapprochées']);
$hits[] = $now;
$_SESSION['monia_kaggle_hits'] = $hits;

$jobJson = json_encode($job, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if ($jobJson === false || strlen($jobJson) > 48000) reply(413, ['ok' => false, 'error' => 'job trop volumineux']);

$dispatch = [
    'event_type' => 'monia_kaggle_run',
    'client_payload' => [
        'job_id' => $id,
        'job_b64' => base64_encode($jobJson),
    ],
];

$ch = curl_init('https://api.github.com/repos/vartcom38-collab/marion-lucas-game/dispatches');
if ($ch === false) reply(500, ['ok' => false, 'error' => 'client GitHub indisponible']);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 6,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $githubToken,
        'Accept: application/vnd.github+json',
        'Content-Type: application/json',
        'User-Agent: Marion-Lucas-MonIA',
        'X-GitHub-Api-Version: 2022-11-28',
    ],
    CURLOPT_POSTFIELDS => json_encode($dispatch, JSON_UNESCAPED_SLASHES),
]);
$response = curl_exec($ch);
$http = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($response === false || $http < 200 || $http >= 300) {
    reply(502, ['ok' => false, 'error' => 'déclenchement GitHub impossible' . ($error ? ' · ' . $error : '')]);
}

reply(202, ['ok' => true, 'jobId' => $id, 'state' => 'queued', 'candidateOnly' => true, 'narrativeAuthority' => false]);
